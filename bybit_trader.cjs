const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// .env 로드 (시작 시)
dotenv.config();

// 전략 로직 모듈 동적 로드 (기본값 v7.0.3)
const strategyVersion = process.env.STRATEGY_VERSION || 'Logic.v7.0.3.cjs';
const strategy = require('./strategies/' + strategyVersion);

const STATE_FILE = path.join(__dirname, 'bybit_live_state.json');
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

async function sendTelegram(message) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error("Telegram send error:", err.message);
    }
}

async function fetchOHLCV(interval, limit = 200) {
    const symbol = strategy.config.SYMBOL;
    const bybitInterval = interval === '1h' ? '60' : (interval === '12h' ? '720' : (interval === '5m' ? '5' : 'D'));
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

async function checkMarkets() {
    const config = strategy.config;
    // 한국 시간(KST)으로 로그 시간 표시
    const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(11, 19);
    console.log(`\n[${nowKST}] --- BYBIT SCANNING (v7.0.3 Mode) ---`);

    try {
        const [m5, h1, d1] = await Promise.all([
            fetchOHLCV('5m', 1000),
            fetchOHLCV('1h', 1000),
            fetchOHLCV('1d', 1000)
        ]);

        liveState.lastPrice = m5[m5.length - 1].close;

        const klines = { m5, h1, d1 };
        const indicators = strategy.indicators_logic(klines);
        const indices = { idx5m: m5.length - 2, r1h: h1.length - 2, r1d: d1.length - 2 };

        const overrideRules = fs.existsSync(RULES_FILE) ? JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')) : null;

        if (liveState.status === 'IDLE') {
            const finalSignal = strategy.signal_logic(indicators, indices, overrideRules);
            
            // 개별 지표 계산 (로그용)
            const m5Long = indicators.m5.adx[indices.idx5m] >= 30 && indicators.m5.stoch.k[indices.idx5m] > indicators.m5.stoch.d[indices.idx5m];
            const h1Long = indicators.h1.macd.m[indices.r1h] > indicators.h1.macd.s[indices.r1h] && indicators.h1.stoch.k[indices.r1h] > indicators.h1.stoch.d[indices.r1h];
            const d1Long = indicators.d1.macd.m[indices.r1d] > indicators.d1.macd.s[indices.r1d];

            const adxVal = indicators.m5.adx[indices.idx5m];
            const m5K = indicators.m5.stoch.k[indices.idx5m];
            const m5D = indicators.m5.stoch.d[indices.idx5m];
            const h1K = indicators.h1.stoch.k[indices.r1h];
            const h1D = indicators.h1.stoch.d[indices.r1h];

            console.log(`[SCAN] LONG [M5] : ${m5Long ? 'OK' : 'WAIT'} (ADX:${adxVal.toFixed(1)}/30, Stoch:${m5K.toFixed(1)}/${m5D.toFixed(1)})`);
            console.log(`[SCAN] LONG [H1] : ${h1Long ? 'OK' : 'WAIT'} (MACD:${indicators.h1.macd.m[indices.r1h]>indicators.h1.macd.s[indices.r1h]?'OK':'WAIT'}, Stoch:${h1K.toFixed(1)}/${h1D.toFixed(1)})`);
            console.log(`[SCAN] LONG [D1] : ${d1Long ? 'OK' : 'WAIT'} (MACD:${indicators.d1.macd.m[indices.r1d]>indicators.d1.macd.s[indices.r1d]?'OK':'WAIT'})`);
            
            const isLong = finalSignal === 'long';
            const isShort = finalSignal === 'short';
            console.log(`--- 최종 결과: ${isLong || isShort ? '🔥 SIGNAL (' + finalSignal.toUpperCase() + ')' : 'PASS'} ---`);

            if (isLong) await handleEntry('LONG', m5[m5.length - 1].close);
            else if (isShort) await handleEntry('SHORT', m5[m5.length - 1].close);
        } else {
            await monitorPosition(m5[m5.length - 1].close);
        }
    } catch (err) {
        console.error("[SCAN ERROR]", err.message);
    }
}

async function handleEntry(side, price) {
    const config = strategy.config;
    console.log(`\n🚀 [ENTRY SIGNAL] ${side} at $${price}`);

    try {
        // 실제 잔고 확인
        const balance = await exchange.fetchBalance();
        const availableBalance = balance.free.USDT || 0;
        
        // .env에서 주문 기준 금액 설정 (AMOUNT 또는 INITIAL_BALANCE)
        const envAmount = parseFloat(process.env.AMOUNT) || parseFloat(process.env.INITIAL_BALANCE) || 1000;
        console.log(`[DEBUG] ENV 설정 금액: $${envAmount}, 실제 가용 잔고: $${availableBalance.toFixed(2)}`);

        // 설정 금액과 실제 잔고 중 더 작은 값을 기준으로 주문 (에러 방지)
        const finalAmount = Math.min(envAmount, availableBalance);
        console.log(`[DEBUG] 최종 주문 기준 금액 (마진): $${finalAmount}`);

        if (finalAmount <= 0) {
            throw new Error(`Available balance is 0 or less. Cannot place order.`);
        }

        const leverage = parseFloat(process.env.LEVERAGE) || 5;
        const amount = finalAmount * leverage / price;
        const contracts = exchange.amountToPrecision(config.SYMBOL, amount);

        const orderSide = side === 'LONG' ? 'buy' : 'sell';
        const order = await exchange.createOrder(config.SYMBOL, 'market', orderSide, contracts);
        console.log(`✅ [BYBIT ENTRY] Order Placed: ${order.id}`);

        liveState.status = 'IN_POSITION';
        liveState.position = side;
        liveState.entryPrice = price;
        liveState.entryTime = Date.now();
        saveState();

        const targetRoi = strategy.config.TARGET_NET_ROI || 0.03;
        const slRoi = strategy.config.SL_ROI || 0.15;

        const tpPrice = side === 'LONG' 
            ? parseFloat((price * (1 + targetRoi / leverage)).toFixed(2))
            : parseFloat((price * (1 - targetRoi / leverage)).toFixed(2));
        const slPrice = side === 'LONG'
            ? parseFloat((price * (1 - slRoi / leverage)).toFixed(2))
            : parseFloat((price * (1 + slRoi / leverage)).toFixed(2));

        try {
            const tpslParams = {
                'category': 'linear', 
                'symbol': config.SYMBOL,
                'takeProfit': tpPrice.toString(), 
                'stopLoss': slPrice.toString(),
                'tpOrderType': 'Limit', 
                'slOrderType': 'Market', 
                'tpslMode': 'Full', 
                'tpLimitPrice': tpPrice.toString()
            };

            // 3중 안전장치: 가능한 모든 함수 명칭 시도
            const methods = [
                'v5PrivatePostPositionSetTpsl',
                'v5_private_post_position_set_tpsl',
                'privatePostV5PositionSetTpsl',
                'private_post_v5_position_set_tpsl'
            ];
            
            let success = false;
            for (const m of methods) {
                if (typeof exchange[m] === 'function') {
                    await exchange[m](tpslParams);
                    success = true;
                    console.log(`✅ [TPSL SET SUCCESS] Used method: ${m}`);
                    break;
                }
            }

            if (!success) {
                // 마지막 수단: 직접 요청
                await exchange.request('position/set-tpsl', 'v5Private', 'POST', tpslParams);
                console.log(`✅ [TPSL SET SUCCESS] Used direct request`);
            }
        } catch (e) {
            console.error("TPSL Set Error (Retrying later):", e.message);
        }

        // 텔레그램 메시지 스타일 (신호봇과 동일하게 맞춤)
        const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        const ampm = kstDate.getUTCHours() >= 12 ? 'PM' : 'AM';
        const displayHour = kstDate.getUTCHours() % 12 || 12;
        const timeStr = `${kstDate.getUTCFullYear()}. ${kstDate.getUTCMonth() + 1}. ${kstDate.getUTCDate()}. ${ampm} ${displayHour}:${kstDate.getUTCMinutes().toString().padStart(2, '0')}:${kstDate.getUTCSeconds().toString().padStart(2, '0')}`;

        const msg = `🚀 <b>[v7.0.3 LIVE] 신호 발생!</b>\n\n` +
                    `⌚ <b>체크 시간:</b> ${timeStr}\n` +
                    `💰 <b>현재 가격:</b> $${price.toLocaleString()}\n\n` +
                    `📌 <b>포지션:</b> ${side}\n` +
                    `💵 <b>진입 가격:</b> $${price.toLocaleString()}\n` +
                    `✅ <b>익절가(TP):</b> $${tpPrice.toLocaleString()} (ROI ${(targetRoi * 100).toFixed(1)}%)\n` +
                    `❌ <b>손절가(SL):</b> $${slPrice.toLocaleString()} (ROI ${(slRoi * 100).toFixed(1)}%)\n\n` +
                    `📡 레버리지 ${leverage}배 기준 계산됨`;

        await sendTelegram(msg);
    } catch (err) {
        console.error("[BYBIT ENTRY ERROR]", err.message);
    }
}

async function monitorPosition(currentPrice) {
    const entry = liveState.entryPrice;
    const side = liveState.position;
    const leverage = parseFloat(process.env.LEVERAGE) || 5;

    const roe = side === 'LONG' ? (currentPrice - entry) / entry * leverage : (entry - currentPrice) / entry * leverage;
    const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
    console.log(`[MONITOR] ${side} | ROE: ${(roe * 100).toFixed(2)}% | Time: ${durationMin}m`);

    const target = strategy.config.TARGET_NET_ROI || 0.03;
    const sl = strategy.config.SL_ROI || 0.15;

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
            liveState.status = 'IDLE'; saveState(); return;
        }

        const contracts = parseFloat(pos.contracts);
        const orderSide = pos.side.toLowerCase() === 'long' || pos.side.toLowerCase() === 'buy' ? 'sell' : 'buy';
        await exchange.createOrder(symbol, 'market', orderSide, contracts, undefined, { reduceOnly: true });

        const finalRoe = (roe * 100).toFixed(2);
        await sendTelegram(`🏁 <b>[BYBIT EXIT] ${symbol} ${side}</b>\n• Reason: ${reason}\n• Price: $${currentPrice}\n• Final ROE: <b>${finalRoe}%</b>\n• Duration: ${durationMin}m`);
        
        liveState.status = 'IDLE'; liveState.position = null; saveState();
    } catch (err) {
        console.error("[BYBIT EXIT ERROR]", err.message);
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

            if (liveState.status !== 'IN_POSITION' || liveState.position !== correctSide) {
                liveState.status = 'IN_POSITION'; liveState.position = correctSide;
                liveState.entryPrice = parseFloat(pos.entryPrice || pos.avgPrice);
                liveState.entryTime = liveState.entryTime || Date.now();
                saveState();
            }

            if (!pos.takeProfit || !pos.stopLoss || parseFloat(pos.takeProfit) === 0 || parseFloat(pos.stopLoss) === 0) {
                const entry = parseFloat(pos.entryPrice || pos.avgPrice);
                const tpPrice = correctSide === 'LONG' ? parseFloat((entry * (1 + 0.03/leverage)).toFixed(2)) : parseFloat((entry * (1 - 0.03/leverage)).toFixed(2));
                const slPrice = correctSide === 'LONG' ? parseFloat((entry * (1 - 0.15/leverage)).toFixed(2)) : parseFloat((entry * (1 + 0.15/leverage)).toFixed(2));

                console.log(`[TPSL SYNC] Setting TP: ${tpPrice}, SL: ${slPrice}`);
                const tpslParams = {
                    'category': 'linear', 
                    'symbol': symbol,
                    'takeProfit': tpPrice.toString(), 
                    'stopLoss': slPrice.toString(),
                    'tpOrderType': 'Limit', 
                    'slOrderType': 'Market', 
                    'tpslMode': 'Full', 
                    'tpLimitPrice': tpPrice.toString()
                };

                const methods = [
                    'v5PrivatePostPositionSetTpsl',
                    'v5_private_post_position_set_tpsl',
                    'privatePostV5PositionSetTpsl',
                    'private_post_v5_position_set_tpsl'
                ];
                
                let success = false;
                for (const m of methods) {
                    if (typeof exchange[m] === 'function') {
                        await exchange[m](tpslParams);
                        success = true;
                        console.log(`✅ [TPSL SYNC SUCCESS] Used method: ${m}`);
                        break;
                    }
                }

                if (!success) {
                    await exchange.request('position/set-tpsl', 'v5Private', 'POST', tpslParams);
                    console.log(`✅ [TPSL SYNC SUCCESS] Used direct request`);
                }
            }
        }
    } catch (err) {
        console.error("[TPSL SYNC ERROR] (Retrying later):", err.message);
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

    const targetHours = [9, 11, 13, 15, 17, 19, 21];
    
    if (targetHours.includes(kstHour) && lastStatusSentHour !== kstHour) {
        const timeStr = kstDate.toISOString().replace('T', ' ').substring(0, 19);
        await sendTelegram(`🔔 <b>[v7.0.3 LIVE] 시스템 가동 중</b>\n• 체크 시간: ${timeStr} (KST)\n• 봇 상태: ${liveState.status}\n• 현재가: $${liveState.lastPrice || '계산중'}`);
        lastStatusSentHour = kstHour;
    }
}

async function init() {
    loadState();
    console.log(`\n🤖 [Antigravity ${strategyVersion}] Bybit Live Bot Starting...`);
    const leverage = parseFloat(process.env.LEVERAGE) || 5;
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
