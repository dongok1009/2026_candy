const ccxt = require('ccxt');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { buildRulesFromEnv, ensureEnvTemplate, evaluateWhatIfFilters } = require('./lib/rules_helper.cjs');

// .env 로드 (시작 시)
dotenv.config();

// 오라클 서버는 api.telegram.org의 IPv6 경로가 없어 Node가 IPv6로 붙으면 ETIMEDOUT난다(curl은 IPv4라 정상).
// axios는 텔레그램 전용이므로 기본 소켓을 IPv4 전용으로 못 박아 송·수신 타임아웃을 막는다. (family:4로 검증됨)
axios.defaults.httpsAgent = new https.Agent({ family: 4, keepAlive: true });

// 전략 로직 모듈 동적 로드 (기본값 v7.0.3)
const strategyVersion = process.env.STRATEGY_VERSION || 'Logic.v7.0.3.cjs';
const strategy = require('./strategies/' + strategyVersion);
const displayVersion = (strategy.name || strategyVersion).replace('Logic.', '').replace('.cjs', '');

const STATE_FILE = path.join(__dirname, 'bybit_live_state.json');
const CONTROL_FILE = path.join(__dirname, 'bot_control.json'); // 원격 일시정지 플래그(재시작에도 유지)
const RULES_FILE = path.join(__dirname, 'live_rules.json');

// Bybit 클라이언트 설정
const exchange = new ccxt.bybit({
    apiKey: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_API_SECRET,
    enableRateLimit: true,
    options: { defaultType: 'linear' }
});

let liveState = {
    status: 'IDLE',
    position: null,
    entryPrice: 0,
    entryTime: null,
    orderId: null,
    quantity: 0,
    totalAmount: 0,
    tpPrice: 0,
    slPrice: 0,
    filledNotified: false,
    lastNotifiedSignalTime: 0, // 신호 알림 중복 방지용
    lastUpdate: null,
    lastPrice: null
};

// 심볼 매칭 헬퍼 함수
function isSymbolMatch(exchangeSymbol, targetSymbol) {
    if (!exchangeSymbol || !targetSymbol) return false;
    const cleanE = exchangeSymbol.replace(/\W/g, '').toUpperCase();
    const cleanT = targetSymbol.replace(/\W/g, '').toUpperCase();
    return cleanE === cleanT || cleanE.includes(cleanT) || cleanT.includes(cleanE);
}

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        liveState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
}

function saveState() {
    liveState.lastUpdate = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(liveState, null, 2));
}

// [일시정지 제어] 텔레그램 /pause 명령으로 신규 진입만 중단. 파일에 저장돼 pm2 재시작에도 유지됨.
let tradingPaused = false;

function loadControl() {
    try {
        if (fs.existsSync(CONTROL_FILE)) {
            const c = JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
            tradingPaused = !!c.paused;
        }
    } catch (e) { console.error("[CONTROL LOAD ERROR]", e.message); }
}

function saveControl() {
    try { fs.writeFileSync(CONTROL_FILE, JSON.stringify({ paused: tradingPaused }, null, 2)); }
    catch (e) { console.error("[CONTROL SAVE ERROR]", e.message); }
}

async function sendTelegram(message) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = { chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true };
    // 오라클 서버에서 Node 내장 fetch가 'fetch failed'로 실패하는 문제로 axios 사용(작동 검증된 signal-bot과 동일).
    // 텔레그램 연결이 간헐적으로 끊기므로 1회 재시도.
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await axios.post(url, payload, { timeout: 10000 });
            return;
        } catch (err) {
            const detail = err.response ? JSON.stringify(err.response.data) : err.message;
            console.error(`Telegram send error (attempt ${attempt}):`, detail);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// [원격 제어] 텔레그램 명령(/pause /resume /status)을 폴링해 신규 진입을 껐다 켠다. 거래 루프와 분리됨.
let telegramUpdateOffset = 0;

// 시작 시 밀린 과거 업데이트(오래된 /pause 등)를 건너뛴다. 마지막 update_id 다음으로 오프셋을 맞춘다.
async function initTelegramOffset() {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) return;
    try {
        const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { params: { offset: -1 }, timeout: 10000 });
        const updates = res.data.result || [];
        if (updates.length > 0) telegramUpdateOffset = updates[updates.length - 1].update_id + 1;
    } catch (e) {
        console.error("[TG INIT ERROR]", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

async function pollTelegramCommands() {
    const token = process.env.TELEGRAM_TOKEN;
    const authChatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !authChatId) return;
    try {
        const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { params: { offset: telegramUpdateOffset }, timeout: 10000 });
        const updates = res.data.result || [];
        for (const u of updates) {
            telegramUpdateOffset = u.update_id + 1;
            const msg = u.message;
            if (!msg || !msg.text) continue;
            // 인증: 지정된 chat_id에서 온 명령만 수락(타인 명령 무시).
            if (String(msg.chat.id) !== String(authChatId)) continue;
            const text = msg.text.trim().toLowerCase();

            if (text === '/pause') {
                if (tradingPaused) {
                    await sendTelegram("⏸️ 이미 일시정지 상태입니다.");
                } else {
                    tradingPaused = true; saveControl();
                    console.log("⏸️ [CONTROL] 매매 일시정지 (텔레그램 /pause)");
                    await sendTelegram("⏸️ <b>매매 일시정지</b>\n신규 진입을 중단합니다. 보유 포지션은 계속 정상 관리·청산됩니다.\n재개하려면 /resume");
                }
            } else if (text === '/resume') {
                if (!tradingPaused) {
                    await sendTelegram("▶️ 이미 매매 가동 중입니다.");
                } else {
                    tradingPaused = false; saveControl();
                    console.log("▶️ [CONTROL] 매매 재개 (텔레그램 /resume)");
                    await sendTelegram("▶️ <b>매매 재개</b>\n신규 진입을 다시 시작합니다.");
                }
            } else if (text === '/status') {
                await sendTelegram(
                    `📊 <b>[${displayVersion} LIVE] 봇 상태</b>\n` +
                    `• 매매: ${tradingPaused ? '⏸️ 일시정지' : '▶️ 가동중'}\n` +
                    `• 포지션 상태: ${liveState.status}\n` +
                    `• 현재 신호: ${liveState.currentSignal || 'HOLD'}\n` +
                    `• 현재가: $${(liveState.lastPrice || 0).toLocaleString()}`
                );
            }
        }
    } catch (e) {
        // getUpdates 실패는 다음 주기에 재시도. 거래 루프를 막지 않도록 조용히 로그만 남긴다.
        console.error("[TG POLL ERROR]", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

// 월별 트레이딩 로그 기록 함수
function updateTradeLog(event, data) {
    try {
        const kstOffset = 9 * 60 * 60 * 1000;
        const nowKST = new Date(Date.now() + kstOffset);
        const monthStr = nowKST.toISOString().substring(0, 7).replace('-', '_'); // 2026_05
        const logFile = path.join(__dirname, `trade_log_${monthStr}.json`);
        
        let logs = [];
        if (fs.existsSync(logFile)) {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
        
        logs.push({
            timeKST: nowKST.toISOString().replace('T', ' ').substring(0, 19),
            event: event,
            ...data
        });
        
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("Log Write Error:", e.message);
    }
}

// 거래소의 실제 청산 체결가와 실현손익을 조회 (기록 정확도 전용)
// 봇이 관측한 시세는 청산을 '감지한 시점'의 값이라 실제 체결가와 다르다. 백테스트 대조를 위해 실측값을 남긴다.
// 조회 실패 시 null을 반환하며, 호출부는 기존 추정값으로 계속 진행한다 (매매 흐름에 영향 없음).
async function fetchActualExit(symbol, sinceMs) {
    try {
        const res = await exchange.privateGetV5PositionClosedPnl({
            category: 'linear',
            symbol: String(symbol).split(':')[0].replace(/\W/g, '').toUpperCase(), // 'BTC/USDT:USDT' → 'BTCUSDT'
            limit: 1
        });
        const rec = res && res.result && res.result.list && res.result.list[0];
        if (!rec) return null;

        // 이번 포지션의 기록인지 확인 (진입 시각보다 오래된 기록이면 이전 거래의 잔여 데이터)
        const updated = Number(rec.updatedTime);
        if (sinceMs && updated && updated < sinceMs) {
            console.log(`ℹ️ [CLOSED-PNL] 최신 기록이 이번 포지션보다 이전 시각이라 사용하지 않음`);
            return null;
        }

        const exitPrice = parseFloat(rec.avgExitPrice);
        const entryPrice = parseFloat(rec.avgEntryPrice);
        const qty = parseFloat(rec.closedSize);
        const closedPnl = parseFloat(rec.closedPnl);
        if (!isFinite(exitPrice) || !isFinite(entryPrice) || !qty) return null;

        const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;
        const margin = (entryPrice * qty) / leverage;
        const roe = margin > 0 ? (closedPnl / margin) * 100 : null;

        return { exitPrice, entryPrice, qty, closedPnl, roe, updatedTime: updated };
    } catch (e) {
        console.error("[CLOSED-PNL] 실제 체결가 조회 실패:", e.message);
        return null;
    }
}

async function fetchOHLCV(interval, limit = 200) {
    const symbol = strategy.config.SYMBOL;
    const bybitInterval = interval === '1h' ? '60' : (interval === '12h' ? '720' : (interval === '5m' ? '5' : (interval === '10m' ? '10' : (interval === '15m' ? '15' : 'D'))));
    const ohlcv = await exchange.fetchOHLCV(symbol, bybitInterval, undefined, limit);
    return ohlcv.map(o => ({
        time: o[0],
        open: o[1],
        high: o[2],
        low: o[3],
        close: o[4],
        volume: o[5]
    }));
}

// [SIGNAL MONITOR] signal-bot(v600) 통합: 신호 변화 시 정보 알림. 거래/주문/상태 로직과 완전히 분리됨.
let lastMonitorSig = 'hold';
let lastMonitorEntryPrice = 0;
let lastMonitorEntryTime = 0;

async function checkSignalTransition(currentSig, traderStatus, currentPrice, completedM5) {
    if (!completedM5) return;
    if (currentSig === lastMonitorSig) return; // 신호 변화가 있을 때만 알림

    const leverage = parseFloat(strategy.config.LEVERAGE) || 5;
    const checkTime = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toLocaleString('ko-KR');

    if (currentSig !== 'hold') {
        const isLong = currentSig.includes('long');
        const entryRef = isLong ? completedM5.low : completedM5.high;
        // 가상 ROE 계산용 기준가 보존
        lastMonitorEntryPrice = entryRef;
        lastMonitorEntryTime = Date.now();

        // IDLE이고 가동 중이면 handleEntry가 진입 알림을 보내므로 여기선 생략(중복 방지).
        // 봇이 신규 진입하지 않는 경우(포지션 보유/대기 중 OR 일시정지)엔 '관망' 정보 알림만 보낸다.
        if (traderStatus !== 'IDLE' || tradingPaused) {
            const holding = traderStatus !== 'IDLE';
            const reason = holding ? '포지션 보유중' : '일시정지 중';
            const tail = holding
                ? 'ℹ️ 현재 포지션 보유/대기 중이라 실전 봇은 이 신호로 신규 진입하지 않습니다.'
                : '⏸️ 일시정지 상태라 실전 봇은 이 신호로 신규 진입하지 않습니다.';
            const targetRoi = strategy.config.TARGET_NET_ROI || 0.05;
            const slRoi = strategy.config.SL_ROI || 0.14;
            const tpPrice = entryRef * (isLong ? (1 + targetRoi / leverage) : (1 - targetRoi / leverage));
            const slPrice = entryRef * (isLong ? (1 - slRoi / leverage) : (1 + slRoi / leverage));
            await sendTelegram(
                `🚀 <b>[${displayVersion} LIVE] 신호 발생! (${reason} · 관망)</b>\n\n` +
                `⌚ <b>체크 시간:</b> ${checkTime}\n` +
                `💰 <b>현재 가격:</b> $${currentPrice.toLocaleString()}\n\n` +
                `📌 <b>방향:</b> ${currentSig.toUpperCase()}\n` +
                `💵 <b>진입 희망가:</b> $${entryRef.toLocaleString()}\n` +
                `✅ <b>익절가(TP):</b> $${tpPrice.toLocaleString()}\n` +
                `❌ <b>손절가(SL):</b> $${slPrice.toLocaleString()}\n\n` +
                `${tail}`
            );
        }
    } else if (lastMonitorSig !== 'hold') {
        // 신호 종료(HOLD 전환): 가상 ROE와 함께 알림 (트레이더 상태 무관)
        const wasLong = lastMonitorSig.includes('long');
        const roe = lastMonitorEntryPrice > 0
            ? (wasLong ? (currentPrice - lastMonitorEntryPrice) : (lastMonitorEntryPrice - currentPrice)) / lastMonitorEntryPrice * leverage
            : 0;
        const roePct = (roe * 100).toFixed(2);
        const icon = roe >= 0 ? '🟢 Profit' : '🔴 Loss';
        const durMin = Math.floor((Date.now() - lastMonitorEntryTime) / 60000);
        await sendTelegram(
            `💤 <b>[${displayVersion} LIVE] 신호 종료! (HOLD)</b>\n\n` +
            `⌚ <b>종료 시간:</b> ${checkTime}\n` +
            `💰 <b>종료 가격:</b> $${currentPrice.toLocaleString()}\n\n` +
            `📌 <b>이전 신호:</b> ${lastMonitorSig.toUpperCase()}\n` +
            `📈 <b>가상 수익률(ROE):</b> ${roePct}% (${icon})\n` +
            `⏱️ <b>유지 시간:</b> ${durMin}분`
        );
    }

    lastMonitorSig = currentSig;
}

async function checkMarkets() {
    const config = strategy.config;
    // 한국 시간(KST)으로 로그 시간 표시
    const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(11, 19);
    console.log(`\n[${nowKST}] --- BYBIT SCANNING (${displayVersion} Mode) ---`);

    try {
        const [m5, m10, m15, h1, d1] = await Promise.all([
            fetchOHLCV('5m', 1000),
            fetchOHLCV('10m', 1000),
            fetchOHLCV('15m', 1000),
            fetchOHLCV('1h', 1000),
            fetchOHLCV('1d', 1000)
        ]);

        liveState.lastPrice = m5[m5.length - 1].close;

        const klines = { m5, m10, m15, h1, d1 };
        const indicators = strategy.indicators_logic(klines);
        const indices = { idx5m: m5.length - 2, r1h: h1.length - 2, r1d: d1.length - 2 };

        let overrideRules = null;
        const envRules = buildRulesFromEnv();
        if (envRules) {
            overrideRules = envRules;
            console.log(`[OVERRIDE] Rules applied from .env file (1st Priority)!`);
        } else if (fs.existsSync(RULES_FILE)) {
            overrideRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
            console.log(`[OVERRIDE] Rules applied from live_rules.json!`);
        }

        if (overrideRules && overrideRules.global) {
            const g = overrideRules.global;
            if (g.leverage !== undefined) strategy.config.LEVERAGE = g.leverage;
            if (g.entryWaitMin !== undefined) strategy.config.ENTRY_WAIT_MIN = g.entryWaitMin;
            if (g.exitWaitMin !== undefined) strategy.config.EXIT_WAIT_MIN = g.exitWaitMin;
            if (g.targetRoi !== undefined) strategy.config.TARGET_NET_ROI = g.targetRoi;
            if (g.slRoi !== undefined) strategy.config.SL_ROI = g.slRoi;
            if (g.reduceTpWaitMin !== undefined) strategy.config.reduceTpWaitMin = g.reduceTpWaitMin;
            if (g.reducedTargetRoi !== undefined) strategy.config.reducedTargetRoi = g.reducedTargetRoi;
            if (g.orderAmount !== undefined) strategy.config.orderAmount = g.orderAmount;
            if (g.useTrailingStop !== undefined) strategy.config.useTrailingStop = g.useTrailingStop;
            if (g.trailStopPct !== undefined) strategy.config.trailStopPct = g.trailStopPct;
            console.log(`[OVERRIDE] Global config overrides applied!`);
        }

        // [RESCUE] IDLE 상태라 하더라도 실제 거래소에 포지션이나 미체결 주문이 있는지 최종 확인
        // 일시정지 중에는 거래소 포지션(수동 매매 포함)을 입양하지 않는다 → 봇이 손대지 않음
        if (!tradingPaused && liveState.status === 'IDLE') {
            const positions = await exchange.fetchPositions();
            const pos = positions.find(p => isSymbolMatch(p.symbol, config.SYMBOL) && parseFloat(p.contracts) > 0);
            if (pos) {
                console.log(`⚠️ [RESCUE] Active position found on exchange. Syncing status to IN_POSITION.`);
                liveState.status = 'IN_POSITION';
                liveState.position = pos.side.toUpperCase();
                liveState.entryPrice = parseFloat(pos.entryPrice || pos.avgPrice);
                liveState.entryTime = liveState.entryTime || Date.now();
                saveState();
            } else {
                const openOrders = await exchange.fetchOpenOrders(config.SYMBOL);
                if (openOrders.length > 0) {
                    console.log(`⚠️ [RESCUE] Open orders found on exchange. Syncing status to WAITING.`);
                    liveState.status = 'WAITING';
                    liveState.orderId = openOrders[0].id;
                    liveState.entryTime = liveState.entryTime || Date.now();
                    saveState();
                }
            }
        }

        // [SIGNAL MONITOR] 모든 상태에서 신호를 계산해 정보 알림(signal-bot 통합). 오류가 거래를 막지 않도록 격리.
        const currentSig = strategy.signal_logic(indicators, indices, overrideRules);
        liveState.currentSignal = currentSig.toUpperCase();
        try {
            await checkSignalTransition(currentSig, liveState.status, m5[m5.length - 1].close, m5[m5.length - 2]);
        } catch (sigErr) {
            console.error("[SIGNAL MONITOR ERROR]", sigErr.message);
        }

        if (liveState.status === 'IDLE') {
            const finalSignal = currentSig;
            
            // 개별 지표 계산 (로그용)
            const m5K = indicators.m5.stoch.k[indices.idx5m];
            const m5D = indicators.m5.stoch.d[indices.idx5m];
            const m5Long = indicators.m5.adx[indices.idx5m] >= 30 && (m5K > m5D || (m5K >= 100 && m5D >= 100));
            const h1Long = indicators.h1.macd.m[indices.r1h] > indicators.h1.macd.s[indices.r1h] && indicators.h1.stoch.k[indices.r1h] > indicators.h1.stoch.d[indices.r1h];
            const d1Long = indicators.d1.macd.m[indices.r1d] > indicators.d1.macd.s[indices.r1d];

            const adxVal = indicators.m5.adx[indices.idx5m];
            const h1K = indicators.h1.stoch.k[indices.r1h];
            const h1D = indicators.h1.stoch.d[indices.r1h];

            console.log(`[SCAN] LONG [M5] : ${m5Long ? 'OK' : 'WAIT'} (ADX:${adxVal.toFixed(1)}/30, Stoch:${m5K.toFixed(1)}/${m5D.toFixed(1)})`);
            console.log(`[SCAN] LONG [H1] : ${h1Long ? 'OK' : 'WAIT'} (MACD:${indicators.h1.macd.m[indices.r1h]>indicators.h1.macd.s[indices.r1h]?'OK':'WAIT'}, Stoch:${h1K.toFixed(1)}/${h1D.toFixed(1)})`);
            console.log(`[SCAN] LONG [D1] : ${d1Long ? 'OK' : 'WAIT'} (MACD:${indicators.d1.macd.m[indices.r1d]>indicators.d1.macd.s[indices.r1d]?'OK':'WAIT'})`);
            
            const isLong = finalSignal === 'long' || finalSignal === 'extreme_long';
            const isShort = finalSignal === 'short' || finalSignal === 'extreme_short';
            const lastSignal = liveState.lastSignal || 'HOLD';
            console.log(`--- 최종 결과: ${isLong || isShort ? '🔥 SIGNAL (' + finalSignal.toUpperCase() + ')' : 'PASS'} ---`);

            if ((isLong || isShort) && tradingPaused) {
                // 일시정지 상태: 신규 진입 신호가 있어도 진입하지 않는다(보유 포지션 관리는 별개로 계속).
                console.log(`⏸️ [PAUSED] 신규 진입 신호(${finalSignal.toUpperCase()}) 감지됐으나 일시정지 상태 → 진입 스킵`);
            } else if (isLong || isShort) {
                updateTradeLog('SIGNAL', {
                    side: finalSignal.toUpperCase(),
                    price: m5[m5.length - 1].close,
                    adx: adxVal,
                    m5Stoch: `${m5K.toFixed(1)}/${m5D.toFixed(1)}`
                });

                const now = Date.now();
                const signalCooldown = 60 * 60 * 1000; // 1시간 쿨다운
                const skipNotify = (now - liveState.lastNotifiedSignalTime < signalCooldown);

                if (isLong) await handleEntry('LONG', m5[m5.length - 1].close, klines, skipNotify, finalSignal === 'extreme_long', indicators, indices, overrideRules);
                else if (isShort) await handleEntry('SHORT', m5[m5.length - 1].close, klines, skipNotify, finalSignal === 'extreme_short', indicators, indices, overrideRules);

                if (!skipNotify) {
                    liveState.lastNotifiedSignalTime = now;
                }
            } else if (finalSignal === 'HOLD' && lastSignal !== 'HOLD' && liveState.status === 'IDLE') {
                await sendTelegram(`💤 <b>[${displayVersion} LIVE]</b>\n\n신호가 종료되었습니다. (포지션: HOLD)\n⌚ <b>시간:</b> ${new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toLocaleString('ko-KR')}\n💰 <b>가격:</b> $${m5[m5.length - 1].close.toLocaleString()}`);
            }

            liveState.lastSignal = finalSignal.toUpperCase();
            saveState();
        } else if (tradingPaused) {
            // 일시정지 중에는 보유/거래소 포지션 관리를 하지 않는다(타임아웃·스위칭·청산 규칙 미적용).
            // 봇이 이전에 건 거래소 측 TP/SL 주문은 그대로 남아 보호는 유지된다.
            console.log(`⏸️ [PAUSED] 포지션 관리 스킵 → 거래소 포지션에 손대지 않음`);
        } else {
            await monitorPosition(m5[m5.length - 1].close, indicators, indices, overrideRules, klines);
        }
    } catch (err) {
        console.error("[SCAN ERROR]", err.message);
    }
}

async function handleEntry(side, price, klines, skipNotify = false, isExtremeBypass = false, indicators, indices, overrideRules) {
    const config = strategy.config;
    
    // v8.2.4 다중 진입 모드 및 돌파 필터 적용 (극단값 우회 시에는 무조건 시장가 진입)
    const entryMode = isExtremeBypass ? 'MARKET' : (strategy.config.ENTRY_MODE || 'HYBRID_5M');
    
    let targetPrice = 0;
    if (entryMode === 'HYBRID_5M') {
        const prevM5 = klines.m5[klines.m5.length - 2];
        targetPrice = side === 'LONG' ? prevM5.low : prevM5.high;
    } else if (entryMode === 'HYBRID_10M') {
        const prevM10 = klines.m10[klines.m10.length - 2];
        targetPrice = side === 'LONG' ? prevM10.low : prevM10.high;
    } else if (entryMode === 'HYBRID_15M') {
        const prevM15 = klines.m15[klines.m15.length - 2];
        targetPrice = side === 'LONG' ? prevM15.low : prevM15.high;
    } else { // HYBRID_BETTER 또는 MARKET 기본값
        const prevM5 = klines.m5[klines.m5.length - 2];
        targetPrice = side === 'LONG' ? prevM5.low : prevM5.high;
    }
    
    console.log(`\n🚀 [ENTRY SIGNAL] ${side} (Mode: ${entryMode})`);
    console.log(`• 현재가: $${price} | 진입 희망가(Target): $${targetPrice}`);

    try {
        // WHAT-IF 동적 진입 필터 평가
        const whatIf = evaluateWhatIfFilters(side, { idx5m: indices.idx5m, r1h: indices.r1h, r1d: indices.r1d }, indicators, overrideRules);
        if (whatIf.isBlocked) {
            console.log(`🚫 [WHAT-IF BLOCK] 진입 차단 조건이 충족되어 매매를 스킵합니다.`);
            await sendTelegram(`🚫 <b>[${displayVersion} LIVE] 진입 차단!</b>\n\nWHAT-IF 필터 차단 조건이 만족되어 진입이 생략되었습니다.\n💰 <b>현재가:</b> $${price.toLocaleString()}\n📌 <b>방향:</b> ${side}`);
            return;
        }

        const balance = await exchange.fetchBalance();
        const availableBalance = balance.free.USDT || 0;
        
        // 동적 로드된 orderAmount가 있다면 1순위로 활용하고, 없으면 .env 또는 100$ 기본값 사용
        const envAmount = strategy.config.orderAmount !== undefined 
            ? strategy.config.orderAmount 
            : (parseFloat(process.env.ORDER_AMOUNT) || parseFloat(process.env.AMOUNT) || parseFloat(process.env.INITIAL_BALANCE) || 100);
        const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;

        // 1h 20MA 대비 포지션 규모 필터 계산 (0.5x or 1.0x) + WHAT-IF 비중 배율
        let sizeMultiplier = 1.0 * whatIf.sizeMultiplier;
        const h1Rules = overrideRules?.[side.toLowerCase()]?.['1h'];
        if (h1Rules && h1Rules.useMaSizeFilter && indicators && indices) {
            const h1MaVal = indicators.h1.ma[indices.r1h];
            if (h1MaVal !== null && h1MaVal !== undefined) {
                if (side === 'LONG' && price < h1MaVal) {
                    sizeMultiplier *= 0.5;
                } else if (side === 'SHORT' && price > h1MaVal) {
                    sizeMultiplier *= 0.5;
                }
            }
        }

        // 실제 가용 잔고와 설정 금액 중 작은 값 선택 (수수료 및 증거금 버퍼 확보를 위해 가용 잔고의 95%만 활용하도록 핫픽스, 사이즈 필터 적용)
        const finalAmount = Math.min(envAmount, availableBalance * 0.95) * sizeMultiplier;
        
        console.log(`[DEBUG] ENV_AMOUNT:$${envAmount}, BYBIT_FREE:$${availableBalance.toFixed(2)}, FINAL_MARGIN:$${finalAmount} (SizeMult:${sizeMultiplier})`);
        updateTradeLog('DEBUG_AMOUNT', { envAmount, availableBalance, finalAmount, sizeMultiplier });

        let entryPrice = 0;
        let isMarketOrder = false;

        if (entryMode === 'MARKET') {
            entryPrice = price;
            isMarketOrder = true;
        } else {
            // 하이브리드 모드 (HYBRID_5M, HYBRID_10M, HYBRID_15M 및 폴백)
            if (side === 'LONG') {
                if (price <= targetPrice) {
                    entryPrice = price;
                    isMarketOrder = true;
                } else {
                    entryPrice = targetPrice;
                }
            } else {
                if (price >= targetPrice) {
                    entryPrice = price;
                    isMarketOrder = true;
                } else {
                    entryPrice = targetPrice;
                }
            }
        }

        const amount = (finalAmount * leverage) / entryPrice;
        const contracts = exchange.amountToPrecision(config.SYMBOL, amount);

        console.log(`[DEBUG] 주문수량: ${contracts} BTC (마진 $${finalAmount} x ${leverage}배)`);

        const targetRoi = (strategy.config.TARGET_NET_ROI || 0.03) * whatIf.tpMultiplier;
        const slRoi = (strategy.config.SL_ROI || 0.15) * whatIf.slMultiplier;

        const tpPrice = side === 'LONG' 
            ? parseFloat((entryPrice * (1 + targetRoi / leverage)).toFixed(2))
            : parseFloat((entryPrice * (1 - targetRoi / leverage)).toFixed(2));
        const slPrice = side === 'LONG'
            ? parseFloat((entryPrice * (1 - slRoi / leverage)).toFixed(2))
            : parseFloat((entryPrice * (1 + slRoi / leverage)).toFixed(2));

        const orderSide = side === 'LONG' ? 'buy' : 'sell';

        // [TRAILING STOP] TP 대신 트레일링 스탑을 쓰는 경우 Bybit 네이티브 파라미터로 매핑.
        // - activePrice = tpPrice (이 가격에 도달해야 트레일링 시작)
        // - trailingStop = entryPrice * trailStopPct / leverage
        //   trailStopPct는 레버리지 반영 수익률 기준. ROI X% 되돌림 = 가격 entry*X/lev 거리 (백테스트 엔진과 동일)
        // - stopLoss = slPrice 유지 (활성화 전 손절, 활성화 후엔 안전판)
        const useTrailingStop = strategy.config.useTrailingStop === true;
        const trailStopPct = Number(strategy.config.trailStopPct || 0);
        const trailDistance = parseFloat((entryPrice * trailStopPct / leverage).toFixed(2));
        let orderParams;
        if (useTrailingStop && trailStopPct > 0) {
            orderParams = {
                'stopLoss': slPrice.toString(),
                'slOrderType': 'Market',
                'tpslMode': 'Full',
                'trailingStop': trailDistance.toString(),
                'activePrice': tpPrice.toString()
            };
        } else {
            orderParams = {
                'takeProfit': tpPrice.toString(),
                'stopLoss': slPrice.toString(),
                'tpOrderType': 'Market',
                'slOrderType': 'Market',
                'tpslMode': 'Full'
            };
        }

        const orderType = isMarketOrder ? 'market' : 'limit';
        const orderPrice = isMarketOrder ? undefined : entryPrice;

        const order = await exchange.createOrder(config.SYMBOL, orderType, orderSide, contracts, orderPrice, orderParams);
        console.log(`✅ [BYBIT ENTRY] ${orderType.toUpperCase()} Order Placed: ${order.id} with TP/SL`);

        liveState.status = isMarketOrder ? 'IN_POSITION' : 'WAITING';
        liveState.position = side;
        liveState.entryPrice = isMarketOrder ? (parseFloat(order.price || order.average || price)) : entryPrice;
        liveState.entryTime = Date.now();
        liveState.orderId = isMarketOrder ? null : order.id;
        liveState.quantity = contracts;
        liveState.totalAmount = finalAmount * leverage;
        liveState.tpPrice = tpPrice;
        liveState.slPrice = slPrice;
        liveState.filledNotified = isMarketOrder ? true : false;
        saveState();

        updateTradeLog('ENTRY_ORDER', {
            side, price: entryPrice, quantity: contracts, totalAmount: liveState.totalAmount, tp: tpPrice, sl: slPrice
        });

        // 기존의 별도 TP/SL 설정 로직은 예외 처리 강화 (이미 주문 시 설정되었으므로 중복 방지)
        try {
            // [Optional Fallback] 포지션이 이미 체결된 경우를 대비한 동기화 시도
            // 하지만 주문 시 설정했으므로 여기서는 10001 에러를 무시하도록 처리
            // 트레일링 모드에서는 takeProfit 대신 trailingStop/activePrice를 사용해야 한다.
            const tpslParams = (useTrailingStop && trailStopPct > 0)
                ? {
                    'category': 'linear', 'symbol': config.SYMBOL,
                    'stopLoss': slPrice.toString(), 'slOrderType': 'Market', 'tpslMode': 'Full',
                    'trailingStop': trailDistance.toString(),
                    'activePrice': tpPrice.toString()
                  }
                : {
                    'category': 'linear', 'symbol': config.SYMBOL,
                    'takeProfit': tpPrice.toString(), 'stopLoss': slPrice.toString(),
                    'tpOrderType': 'Market', 'slOrderType': 'Market', 'tpslMode': 'Full'
                  };

            await exchange.privatePostV5PositionTradingStop(tpslParams);
            console.log(useTrailingStop && trailStopPct > 0
                ? `✅ [TPSL SET SUCCESS] TRAILING active@${tpPrice} dist=${trailDistance} (ROI ${(trailStopPct * 100).toFixed(2)}%), SL: ${slPrice}`
                : `✅ [TPSL SET SUCCESS] TP: ${tpPrice}, SL: ${slPrice}`);
        } catch (e) {
            if (e.message.includes('not modified') || e.message.includes('10001') || e.message.includes('zero position')) {
                console.log(`ℹ️ [TPSL SYNC] TP/SL already set or waiting for order fill`);
            } else {
                console.error("TPSL Set Error:", e.message);
            }
        }

        // 텔레그램 메시지 스타일 (신호봇과 동일하게 맞춤)
        const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        const ampm = kstDate.getUTCHours() >= 12 ? 'PM' : 'AM';
        const displayHour = kstDate.getUTCHours() % 12 || 12;
        const timeStr = `${kstDate.getUTCFullYear()}. ${kstDate.getUTCMonth() + 1}. ${kstDate.getUTCDate()}. ${ampm} ${displayHour}:${kstDate.getUTCMinutes().toString().padStart(2, '0')}:${kstDate.getUTCSeconds().toString().padStart(2, '0')}`;

        const msg = `🚀 <b>[${displayVersion} LIVE] 신호 발생!</b>\n\n` +
                    `⌚ <b>체크 시간:</b> ${timeStr}\n` +
                    `💰 <b>현재 가격:</b> $${price.toLocaleString()}\n\n` +
                    `📌 <b>포지션:</b> ${side}\n` +
                    `💵 <b>진입 가격:</b> $${entryPrice.toLocaleString()}\n` +
                    `📦 <b>수량:</b> ${contracts} BTC\n` +
                    `💰 <b>총 금액:</b> $${(finalAmount * leverage).toLocaleString()}\n` +
                    (useTrailingStop && trailStopPct > 0
                        ? `📈 <b>트레일링:</b> $${tpPrice.toLocaleString()} 도달 후 고점대비 ${(trailStopPct * 100).toFixed(2)}% 하락 시 청산\n`
                        : `✅ <b>익절가(TP):</b> $${tpPrice.toLocaleString()} (ROI ${(targetRoi * 100).toFixed(1)}%)\n`) +
                    `❌ <b>손절가(SL):</b> $${slPrice.toLocaleString()} (ROI ${(slRoi * 100).toFixed(1)}%)\n\n` +
                    `📡 레버리지 ${leverage}배 기준 계산됨`;

        if (!skipNotify) {
            await sendTelegram(msg);
        }
    } catch (err) {
        console.error("[BYBIT ENTRY ERROR]", err.message);
    }
}

async function monitorPosition(currentPrice, indicators, indices, overrideRules, klines) {
    const entry = liveState.entryPrice;
    const side = liveState.position;
    const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;

    // [SWITCHING] 반대 신호 시 즉시 청산 후 스위칭 진입
    if (liveState.status === 'IN_POSITION' && overrideRules?.global?.switchingEnabled && indicators && indices) {
        const checkSignal = strategy.signal_logic(indicators, indices, overrideRules);
        const isOpposite = (side === 'LONG' && (checkSignal === 'short' || checkSignal === 'extreme_short')) ||
                           (side === 'SHORT' && (checkSignal === 'long' || checkSignal === 'extreme_long'));
        if (isOpposite) {
            console.log(`🔄 [SWITCHING SIGNAL] Opposite signal detected: ${checkSignal.toUpperCase()}. Switching...`);
            const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
            const roe = side === 'LONG' ? (currentPrice - entry) / entry * leverage : (entry - currentPrice) / entry * leverage;
            
            // 기존 포지션 청산
            await closePosition(side, 'SWITCHING', currentPrice, roe, durationMin);
            
            // 즉시 반대 포지션 진입
            const oppositeSide = side === 'LONG' ? 'SHORT' : 'LONG';
            const isExtreme = checkSignal.startsWith('extreme');
            await handleEntry(oppositeSide, currentPrice, klines, false, isExtreme, indicators, indices, overrideRules);
            return;
        }
    }

    // WAITING 상태이면 체결 확인만 수행
    if (liveState.status === 'WAITING') {
        const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
        console.log(`[MONITOR] WAITING for Fill | Time: ${durationMin}m`);
        await syncExchangeTPSL(leverage);
        return;
    }

    const roe = side === 'LONG' ? (currentPrice - entry) / entry * leverage : (entry - currentPrice) / entry * leverage;
    const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
    console.log(`[MONITOR] ${side} | ROE: ${(roe * 100).toFixed(2)}% | Time: ${durationMin}m`);

    let target = strategy.config.TARGET_NET_ROI || 0.03;
    const reduceTpWaitMin = strategy.config.reduceTpWaitMin !== undefined ? Number(strategy.config.reduceTpWaitMin) : 60; // 0일 때 비활성화 보장
    const reducedTargetRoi = strategy.config.reducedTargetRoi !== undefined ? strategy.config.reducedTargetRoi : 0.01; // 기본값 1%

    if (reduceTpWaitMin > 0 && durationMin >= reduceTpWaitMin) {
        target = reducedTargetRoi;
    }

    const sl = strategy.config.SL_ROI || 0.15;
    const exitWait = strategy.config.EXIT_WAIT_MIN || 2000;

    // [TIME_OUT] 2000분 초과 시 강제 종료
    if (durationMin >= exitWait) {
        await closePosition(side, `TIME_OUT (${exitWait}m)`, currentPrice, roe, durationMin);
        return;
    }

    if (roe >= target) await closePosition(side, 'TAKE_PROFIT', currentPrice, roe, durationMin);
    else if (roe <= -sl) await closePosition(side, 'STOP_LOSS', currentPrice, roe, durationMin);
    else {
        if (durationMin % 5 === 0 && durationMin > 0) await syncExchangeTPSL(leverage);
    }
}

async function closePosition(side, reason, currentPrice, roe, durationMin) {
    try {
        const symbol = strategy.config.SYMBOL;
        const positions = await exchange.fetchPositions();
        const pos = positions.find(p => isSymbolMatch(p.symbol, symbol) && parseFloat(p.contracts) > 0);

        if (!pos) {
            // [강력한 보완] 거래소에 이미 포지션이 없더라도 봇이 수량을 들고 있었고 상태가 IN_POSITION인 경우에만 
            // 거래소 자체 TP/SL 또는 수동 청산으로 간주하고 알림을 보냅니다.
            if (liveState.status === 'IN_POSITION' && liveState.quantity > 0 && (liveState.position === 'LONG' || liveState.position === 'SHORT')) {
                const finalRoe = (roe * 100).toFixed(2);
                const profitAmount = side === 'LONG' 
                    ? (currentPrice - liveState.entryPrice) * liveState.quantity 
                    : (liveState.entryPrice - currentPrice) * liveState.quantity;

                const actual = await fetchActualExit(symbol, liveState.entryTime);

                const msg = `🏁 <b>[BYBIT EXIT (Exchange Cleared)] ${symbol} ${side}</b>\n` +
                            `• Reason: ${reason} (Already Cleared on Bybit)\n` +
                            (actual
                                ? `• <b>Actual Price: $${actual.exitPrice.toLocaleString()}</b> (est. $${currentPrice.toLocaleString()})\n`
                                : `• Est. Price: $${currentPrice.toLocaleString()}\n`) +
                            `• Quantity: ${liveState.quantity} BTC\n` +
                            (actual
                                ? `• <b>Actual ROE: ${actual.roe.toFixed(2)}%</b> (est. ${finalRoe}%)\n` +
                                  `• <b>Realized PnL: $${actual.closedPnl.toFixed(2)}</b>\n`
                                : `• <b>Final ROE: ${finalRoe}%</b>\n` +
                                  `• <b>Profit: $${profitAmount.toFixed(2)}</b>\n`) +
                            `• Duration: ${durationMin}m`;

                await sendTelegram(msg);
                updateTradeLog('EXIT', {
                    side, reason: reason + '_EXCHANGE_CLEARED', price: currentPrice, quantity: liveState.quantity, roe: finalRoe, profit: profitAmount, duration: durationMin,
                    actualExitPrice: actual ? actual.exitPrice : null,
                    actualEntryPrice: actual ? actual.entryPrice : null,
                    actualRoe: actual ? Number(actual.roe.toFixed(2)) : null,
                    closedPnl: actual ? actual.closedPnl : null
                });
            }
            liveState.status = 'IDLE'; liveState.position = null; liveState.quantity = 0; liveState.totalAmount = 0; saveState(); return;
        }

        const contracts = parseFloat(pos.contracts);
        const orderSide = pos.side.toLowerCase() === 'long' || pos.side.toLowerCase() === 'buy' ? 'sell' : 'buy';
        
        // 실제 API 주문은 별도의 try-catch로 감싸서, 주문이 실패하더라도 알림 및 상태 초기화는 보장한다!
        let orderSuccess = true;
        try {
            await exchange.createOrder(symbol, 'market', orderSide, contracts, undefined, { reduceOnly: true });
            console.log(`✅ [BYBIT EXIT ORDER SUCCESS] Market order sent for ${contracts} BTC.`);
        } catch (orderErr) {
            console.error("❌ [BYBIT EXIT ORDER API FAIL] Failed to send close order:", orderErr.message);
            orderSuccess = false;
        }

        const finalRoe = (roe * 100).toFixed(2);
        const profitAmount = side === 'LONG' 
            ? (currentPrice - liveState.entryPrice) * liveState.quantity 
            : (liveState.entryPrice - currentPrice) * liveState.quantity;

        // 시장가 청산 주문이 체결·정산되기까지 짧게 대기한 뒤 실제 체결가 조회
        const actual = orderSuccess
            ? await new Promise(r => setTimeout(r, 2000)).then(() => fetchActualExit(symbol, liveState.entryTime))
            : null;

        const statusLabel = orderSuccess ? 'BYBIT EXIT' : 'BYBIT EXIT (API FAILED - STATE RESET)';
        const msg = `🏁 <b>[${statusLabel}] ${symbol} ${side}</b>\n` +
                    `• Reason: ${reason}\n` +
                    (actual
                        ? `• <b>Actual Price: $${actual.exitPrice.toLocaleString()}</b> (est. $${currentPrice.toLocaleString()})\n`
                        : `• Price: $${currentPrice.toLocaleString()}\n`) +
                    `• Quantity: ${liveState.quantity} BTC\n` +
                    (actual
                        ? `• <b>Actual ROE: ${actual.roe.toFixed(2)}%</b> (est. ${finalRoe}%)\n` +
                          `• <b>Realized PnL: $${actual.closedPnl.toFixed(2)}</b>\n`
                        : `• <b>Final ROE: ${finalRoe}%</b>\n` +
                          `• <b>Profit: $${profitAmount.toFixed(2)}</b>\n`) +
                    `• Duration: ${durationMin}m`;

        await sendTelegram(msg);
        updateTradeLog('EXIT', {
            side, reason: reason + (orderSuccess ? '' : '_API_FAIL'), price: currentPrice, quantity: liveState.quantity, roe: finalRoe, profit: profitAmount, duration: durationMin,
            actualExitPrice: actual ? actual.exitPrice : null,
            actualEntryPrice: actual ? actual.entryPrice : null,
            actualRoe: actual ? Number(actual.roe.toFixed(2)) : null,
            closedPnl: actual ? actual.closedPnl : null
        });
        
        // 무조건 상태 초기화 및 보존
        liveState.status = 'IDLE'; 
        liveState.position = null; 
        liveState.quantity = 0; 
        liveState.totalAmount = 0; 
        saveState();
    } catch (err) {
        console.error("[BYBIT EXIT ERROR]", err.message);
        // 최후의 안전장치: 루트 catch에서도 상태 강제 초기화하여 봇이 먹통이 되는 버그 방지!
        liveState.status = 'IDLE'; 
        liveState.position = null; 
        liveState.quantity = 0; 
        liveState.totalAmount = 0; 
        saveState();
    }
}

async function syncExchangeTPSL(leverage) {
    const symbol = strategy.config.SYMBOL;
    try {
        const positions = await exchange.fetchPositions(); 
        const pos = positions.find(p => isSymbolMatch(p.symbol, symbol) && parseFloat(p.contracts) > 0);
        
        if (pos) {
            const sideLower = pos.side.toLowerCase();
            const correctSide = (sideLower === 'long' || sideLower === 'buy') ? 'LONG' : 'SHORT';

            // 기존 상태에 정보가 없거나 부족한 경우 강제 업데이트
            if (liveState.status !== 'IN_POSITION' || liveState.position !== correctSide || !liveState.quantity || !liveState.tpPrice) {
                liveState.status = 'IN_POSITION'; liveState.position = correctSide;
                liveState.entryPrice = parseFloat(pos.entryPrice || pos.avgPrice);
                liveState.entryTime = liveState.entryTime || Date.now();
                liveState.quantity = parseFloat(pos.contracts);
                liveState.totalAmount = liveState.entryPrice * liveState.quantity;
                
                // TP/SL 확인 (거래소 데이터 우선, 없으면 전략 기반 계산)
                const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;
                const targetRoi = strategy.config.TARGET_NET_ROI || 0.03;
                const slRoi = strategy.config.SL_ROI || 0.15;

                liveState.tpPrice = parseFloat(pos.takeProfit || pos.info?.takeProfit || 0);
                liveState.slPrice = parseFloat(pos.stopLoss || pos.info?.stopLoss || 0);

                if (liveState.tpPrice === 0) {
                    liveState.tpPrice = correctSide === 'LONG' 
                        ? parseFloat((liveState.entryPrice * (1 + targetRoi / leverage)).toFixed(2))
                        : parseFloat((liveState.entryPrice * (1 - targetRoi / leverage)).toFixed(2));
                }
                if (liveState.slPrice === 0) {
                    liveState.slPrice = correctSide === 'LONG'
                        ? parseFloat((liveState.entryPrice * (1 - slRoi / leverage)).toFixed(2))
                        : parseFloat((liveState.entryPrice * (1 + slRoi / leverage)).toFixed(2));
                }

                saveState();
                console.log(`✅ [SYNC] Position data updated: ${liveState.quantity} BTC | TP: ${liveState.tpPrice}`);
            }

            // [FULL FILL CHECK] 모든 수량이 매수되었을 때만 알림 (분할 매수 대응)
            if (!liveState.filledNotified) {
                let isFullFill = false;
                if (liveState.orderId) {
                    try {
                        const order = await exchange.fetchOrder(liveState.orderId, symbol, { acknowledged: true });
                        if (order.status === 'closed') isFullFill = true;
                    } catch (e) {
                        // 주문 조회 실패 시 수량 비교로 대체
                        if (parseFloat(pos.contracts) >= parseFloat(liveState.quantity)) isFullFill = true;
                    }
                } else {
                    // 주문 ID가 없는 경우 현재 수량으로 판단
                    if (parseFloat(pos.contracts) >= parseFloat(liveState.quantity)) isFullFill = true;
                }

                if (isFullFill) {
                    const msg = `✅ <b>[${displayVersion} LIVE] 주문 전량 체결 완료!</b>\n\n` +
                                `📌 <b>포지션:</b> ${liveState.position}\n` +
                                `💵 <b>진입가:</b> $${liveState.entryPrice.toLocaleString()}\n` +
                                `📦 <b>수량:</b> ${liveState.quantity} BTC\n` +
                                `💰 <b>총 금액:</b> $${(liveState.totalAmount || 0).toLocaleString()}\n` +
                                `✅ <b>익절가:</b> $${(liveState.tpPrice || 0).toLocaleString()}\n` +
                                `❌ <b>손절가:</b> $${(liveState.slPrice || 0).toLocaleString()}`;
                    await sendTelegram(msg);
                    liveState.status = 'IN_POSITION'; // 체결 완료 시 상태 변경
                    liveState.filledNotified = true;
                    liveState.orderId = null; // 전량 체결 시 주문 ID 초기화
                    saveState();
                    updateTradeLog('FULL_FILL', { side: correctSide, price: liveState.entryPrice, quantity: liveState.quantity });
                }
            }

            const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
            const reduceTpWaitMin = strategy.config.reduceTpWaitMin !== undefined ? Number(strategy.config.reduceTpWaitMin) : 60; // 0일 때 비활성화 보장
            const reducedTargetRoi = strategy.config.reducedTargetRoi !== undefined ? strategy.config.reducedTargetRoi : 0.01;
            const originalTargetRoi = strategy.config.TARGET_NET_ROI || 0.03;
            const slRoi = strategy.config.SL_ROI || 0.15;
            const entry = parseFloat(pos.entryPrice || pos.avgPrice || liveState.entryPrice);

            let expectedTargetRoi = originalTargetRoi;
            let expectedReason = "NORMAL";
            if (reduceTpWaitMin > 0 && durationMin >= reduceTpWaitMin) {
                expectedTargetRoi = reducedTargetRoi;
                expectedReason = "REDUCED";
            }

            const expectedTpPrice = correctSide === 'LONG' 
                ? parseFloat((entry * (1 + expectedTargetRoi / leverage)).toFixed(2))
                : parseFloat((entry * (1 - expectedTargetRoi / leverage)).toFixed(2));
            const expectedSlPrice = correctSide === 'LONG'
                ? parseFloat((entry * (1 - slRoi / leverage)).toFixed(2))
                : parseFloat((entry * (1 + slRoi / leverage)).toFixed(2));

            const currentExchangeTp = parseFloat(pos.takeProfit || pos.info?.takeProfit || 0);

            // 거래소에 TP가 없거나, 상태가 REDUCED인데 거래소 TP가 expectedTpPrice와 차이가 있는 경우 정정 수행
            const needsUpdate = currentExchangeTp === 0 || 
                (expectedReason === "REDUCED" && Math.abs(currentExchangeTp - expectedTpPrice) > 1.0);

            if (needsUpdate) {
                console.log(`[TPSL SYNC] Updating Exchange TP/SL (Reason: ${expectedReason}) | Curr TP: ${currentExchangeTp} -> Target TP: ${expectedTpPrice}`);
                
                const tpslParams = {
                    'category': 'linear', 'symbol': symbol,
                    'takeProfit': expectedTpPrice.toString(), 'stopLoss': expectedSlPrice.toString(),
                    'tpOrderType': 'Market', 'slOrderType': 'Market', 'tpslMode': 'Full'
                };

                try {
                    await exchange.privatePostV5PositionTradingStop(tpslParams);
                    console.log(`✅ [TPSL SYNC SUCCESS] TP/SL Updated on Exchange | TP: ${expectedTpPrice}`);
                    liveState.tpPrice = expectedTpPrice;
                    liveState.slPrice = expectedSlPrice;
                    saveState();
                } catch (apiErr) {
                    console.error("❌ [TPSL SYNC API ERR]", apiErr.message);
                }
            }
        } else {
            // [SYNC] 거래소에 포지션이 없는데 봇이 IN_POSITION 또는 WAITING인 경우
            if (liveState.status === 'IN_POSITION' || liveState.status === 'WAITING') {
                const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
                const entryWait = strategy.config.ENTRY_WAIT_MIN || 180;

                // [강력한 보완] 봇이 실제로 포지션을 들고 있었던 경우 (수량이 등록된 상태이며 상태가 IN_POSITION인 경우)라면 
                // 주문 ID의 잔존 여부와 무관하게 거래소 청산으로 즉시 간주하여 알림 발송!
                if (liveState.status === 'IN_POSITION' && liveState.quantity > 0 && (liveState.position === 'LONG' || liveState.position === 'SHORT')) {
                    const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;
                    const currentPrice = liveState.lastPrice || 0;
                    const roe = liveState.position === 'LONG' 
                        ? (currentPrice - liveState.entryPrice) / liveState.entryPrice * leverage 
                        : (liveState.entryPrice - currentPrice) / liveState.entryPrice * leverage;
                    const profitAmount = liveState.position === 'LONG' 
                        ? (currentPrice - liveState.entryPrice) * liveState.quantity 
                        : (liveState.entryPrice - currentPrice) * liveState.quantity;

                    const actual = await fetchActualExit(symbol, liveState.entryTime);

                    const msg = `🏁 <b>[EXCHANGE EXIT]</b>\n` +
                                `• ${liveState.position} closed on Bybit (TP/SL or Manual).\n` +
                                (actual
                                    ? `• <b>Actual Price: $${actual.exitPrice.toLocaleString()}</b> (est. $${currentPrice.toLocaleString()})\n`
                                    : `• Est. Price: $${currentPrice.toLocaleString()}\n`) +
                                `• Quantity: ${liveState.quantity} BTC\n` +
                                (actual
                                    ? `• <b>Actual ROE: ${actual.roe.toFixed(2)}%</b> (est. ${(roe * 100).toFixed(2)}%)\n` +
                                      `• <b>Realized PnL: $${actual.closedPnl.toFixed(2)}</b>`
                                    : `• Est. ROE: ${(roe * 100).toFixed(2)}%\n` +
                                      `• Est. Profit: $${profitAmount.toFixed(2)}`);

                    console.log(`🏁 [SYNC] Position closed on exchange. Resetting to IDLE.`);
                    await sendTelegram(msg);
                    updateTradeLog('EXCHANGE_EXIT', {
                        side: liveState.position, price: currentPrice, quantity: liveState.quantity, roe: (roe * 100).toFixed(2), profit: profitAmount,
                        actualExitPrice: actual ? actual.exitPrice : null,
                        actualEntryPrice: actual ? actual.entryPrice : null,
                        actualRoe: actual ? Number(actual.roe.toFixed(2)) : null,
                        closedPnl: actual ? actual.closedPnl : null
                    });

                    liveState.status = 'IDLE';
                    liveState.position = null;
                    liveState.orderId = null;
                    liveState.quantity = 0;
                    liveState.totalAmount = 0;
                    saveState();
                    return; // 즉시 종료
                }

                // 이하 포지션 수량이 0이었던 경우 (단순 진입 대기 WAITING 단계 또는 주문 상태 체크)
                if (liveState.orderId) {
                    try {
                        const order = await exchange.fetchOrder(liveState.orderId, symbol, { acknowledged: true });
                        if (order.status === 'open') {
                            // [CORRECTIVE SYNC] 포지션은 없는데 주문만 있는 경우 상태를 WAITING으로 강제 조정
                            if (liveState.status === 'IN_POSITION') {
                                console.log(`⚠️ [SYNC] No position but open order found. Correcting status to WAITING.`);
                                liveState.status = 'WAITING';
                                saveState();
                            }

                            if (durationMin >= entryWait) {
                                console.log(`⚠️ [ENTRY TIMEOUT] Order ${liveState.orderId} not filled for ${durationMin}m. Cancelling...`);
                                await exchange.cancelOrder(liveState.orderId, symbol);
                                await sendTelegram(`⚠️ <b>[ENTRY TIMEOUT]</b>\n• Order cancelled after ${durationMin}m waiting.`);
                                liveState.status = 'IDLE';
                                liveState.orderId = null;
                                saveState();
                            } else {
                                console.log(`⏳ [WAITING] Order ${liveState.orderId} is still open (${durationMin}/${entryWait}m)`);
                            }
                        } else {
                            // 주문이 취소되었거나 이미 처리됨 (하지만 포지션은 없음)
                            console.log(`⚠️ [SYNC] Order ${liveState.orderId} status is ${order.status} but no position found.`);
                            await sendTelegram(`ℹ️ <b>[ORDER SYNC]</b>\n• Order status: ${order.status}\n• No active position found. Resetting to IDLE.`);
                            liveState.status = 'IDLE';
                            liveState.orderId = null;
                            saveState();
                        }
                    } catch (e) {
                        console.error("[FETCH ORDER ERROR]", e.message);
                        if (e.message.includes('not found') || e.message.includes('Order does not exist')) {
                            liveState.status = 'IDLE';
                            liveState.orderId = null;
                            saveState();
                        }
                    }
                } else {
                    // orderId도 없고 수량도 없는 진짜 빈 WAITING 상태 (오류 방지 리셋)
                    if (liveState.status === 'WAITING') {
                         console.log(`⚠️ [SYNC] Order ${liveState.orderId} disappeared without fill. Resetting to IDLE.`);
                         liveState.status = 'IDLE'; liveState.orderId = null; saveState(); return;
                    }
                    liveState.status = 'IDLE';
                    liveState.position = null;
                    liveState.orderId = null;
                    liveState.quantity = 0;
                    liveState.totalAmount = 0;
                    saveState();
                }
            }
        }
    } catch (err) {
        if (err.message.includes('not modified')) {
            console.log(`ℹ️ [TPSL SYNC] Already up to date`);
        } else {
            console.error("[TPSL SYNC ERROR]:", err.message);
        }
    }
}

let lastStatusSentHour = -1;

async function checkStatusNotification() {
    const now = new Date();
    // 한국 시간(KST, UTC+9) 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const kstHour = kstDate.getUTCHours();
    const kstMin = kstDate.getUTCMinutes();

    const targetHours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    
    if (targetHours.includes(kstHour) && lastStatusSentHour !== kstHour) {
        const timeStr = kstDate.toISOString().replace('T', ' ').substring(0, 19);
        let msg = `🔔 <b>[${displayVersion} LIVE] 시스템 가동 중</b>\n` +
                  `• 체크 시간: ${timeStr} (KST)\n` +
                  `• 매매: ${tradingPaused ? '⏸️ 일시정지' : '▶️ 가동중'}\n` +
                  `• 봇 상태: ${liveState.status}\n` +
                  `• 현재 신호: ${liveState.currentSignal || 'HOLD'}\n` +
                  `• 현재가: $${(liveState.lastPrice || 0).toLocaleString()}`;
        
        if (liveState.status === 'IN_POSITION' && liveState.entryPrice && liveState.lastPrice) {
            const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;
            const entry = liveState.entryPrice;
            const current = liveState.lastPrice;
            const side = liveState.position;
            const roe = side === 'LONG' ? (current - entry) / entry * leverage : (entry - current) / entry * leverage;
            const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
            
            msg += `\n• <b>진입가: $${entry.toLocaleString()}</b>` +
                   `\n• <b>레버리지: ${leverage}배</b>` +
                   `\n• <b>수량: ${liveState.quantity} BTC</b>` +
                   `\n• <b>총 금액: $${(liveState.totalAmount || 0).toLocaleString()}</b>` +
                   `\n• <b>익절가: $${(liveState.tpPrice || 0).toLocaleString()}</b>` +
                   `\n• <b>손절가: $${(liveState.slPrice || 0).toLocaleString()}</b>` +
                   `\n• <b>ROE: ${(roe * 100).toFixed(2)}%</b>` +
                   `\n• <b>Duration: ${durationMin}m</b>`;
        }

        await sendTelegram(msg);
        lastStatusSentHour = kstHour;
    }
}

async function init() {
    ensureEnvTemplate();
    loadState();
    loadControl();
    console.log(`\n🤖 [Antigravity ${strategyVersion}] Bybit Live Bot Starting...`);
    const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;

    // 시작 시 텔레그램 알림 추가
    await sendTelegram(`🤖 <b>[${displayVersion} LIVE] 봇 시작됨</b>\n• 전략 버전: ${strategyVersion}\n• 레버리지: ${leverage}배\n• 상태: ${liveState.status}\n• 매매: ${tradingPaused ? '⏸️ 일시정지' : '▶️ 가동중'}`);

    // 원격 제어 명령 폴러 시작: 시작 시 과거 백로그를 건너뛴 뒤 5초 주기로 /pause·/resume·/status 처리.
    await initTelegramOffset();
    setInterval(pollTelegramCommands, 5000);

    await syncExchangeTPSL(leverage);
    while(true) {
        try {
            await checkMarkets();
            await checkStatusNotification();
        } catch (e) {
            console.error("Loop Error:", e.message);
        }
        await new Promise(r => setTimeout(r, 60000));
    }
}

init();
