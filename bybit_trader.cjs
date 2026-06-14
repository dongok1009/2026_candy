const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { buildRulesFromEnv, ensureEnvTemplate } = require('./lib/rules_helper.cjs');

// .env 로드 (시작 시)
dotenv.config();

// 전략 로직 모듈 동적 로드 (기본값 v7.0.3)
const strategyVersion = process.env.STRATEGY_VERSION || 'Logic.v7.0.3.cjs';
const strategy = require('./strategies/' + strategyVersion);
const displayVersion = (strategy.name || strategyVersion).replace('Logic.', '').replace('.cjs', '');

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
            console.log(`[OVERRIDE] Global config overrides applied!`);
        }

        // [RESCUE] IDLE 상태라 하더라도 실제 거래소에 포지션이나 미체결 주문이 있는지 최종 확인
        if (liveState.status === 'IDLE') {
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

        if (liveState.status === 'IDLE') {
            const finalSignal = strategy.signal_logic(indicators, indices, overrideRules);
            
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

            if (isLong || isShort) {
                updateTradeLog('SIGNAL', {
                    side: finalSignal.toUpperCase(),
                    price: m5[m5.length - 1].close,
                    adx: adxVal,
                    m5Stoch: `${m5K.toFixed(1)}/${m5D.toFixed(1)}`
                });

                const now = Date.now();
                const signalCooldown = 60 * 60 * 1000; // 1시간 쿨다운
                const skipNotify = (now - liveState.lastNotifiedSignalTime < signalCooldown);

                if (isLong) await handleEntry('LONG', m5[m5.length - 1].close, klines, skipNotify, finalSignal === 'extreme_long');
                else if (isShort) await handleEntry('SHORT', m5[m5.length - 1].close, klines, skipNotify, finalSignal === 'extreme_short');
                
                if (!skipNotify) {
                    liveState.lastNotifiedSignalTime = now;
                }
            } else if (finalSignal === 'HOLD' && lastSignal !== 'HOLD' && liveState.status === 'IDLE') {
                await sendTelegram(`💤 <b>[${displayVersion} LIVE]</b>\n\n신호가 종료되었습니다. (포지션: HOLD)\n⌚ <b>시간:</b> ${new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toLocaleString('ko-KR')}\n💰 <b>가격:</b> $${m5[m5.length - 1].close.toLocaleString()}`);
            }

            liveState.lastSignal = finalSignal.toUpperCase();
            saveState();
        } else {
            await monitorPosition(m5[m5.length - 1].close);
        }
    } catch (err) {
        console.error("[SCAN ERROR]", err.message);
    }
}

async function handleEntry(side, price, klines, skipNotify = false, isExtremeBypass = false) {
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
        const balance = await exchange.fetchBalance();
        const availableBalance = balance.free.USDT || 0;
        
        // 동적 로드된 orderAmount가 있다면 1순위로 활용하고, 없으면 .env 또는 100$ 기본값 사용
        const envAmount = strategy.config.orderAmount !== undefined 
            ? strategy.config.orderAmount 
            : (parseFloat(process.env.ORDER_AMOUNT) || parseFloat(process.env.AMOUNT) || parseFloat(process.env.INITIAL_BALANCE) || 100);
        const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;

        // 실제 가용 잔고와 설정 금액 중 작은 값 선택 (수수료 및 증거금 버퍼 확보를 위해 가용 잔고의 95%만 활용하도록 핫픽스)
        const finalAmount = Math.min(envAmount, availableBalance * 0.95);
        
        console.log(`[DEBUG] ENV_AMOUNT:$${envAmount}, BYBIT_FREE:$${availableBalance.toFixed(2)}, FINAL_MARGIN:$${finalAmount}`);
        updateTradeLog('DEBUG_AMOUNT', { envAmount, availableBalance, finalAmount });

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

        const targetRoi = strategy.config.TARGET_NET_ROI || 0.03;
        const slRoi = strategy.config.SL_ROI || 0.15;

        const tpPrice = side === 'LONG' 
            ? parseFloat((entryPrice * (1 + targetRoi / leverage)).toFixed(2))
            : parseFloat((entryPrice * (1 - targetRoi / leverage)).toFixed(2));
        const slPrice = side === 'LONG'
            ? parseFloat((entryPrice * (1 - slRoi / leverage)).toFixed(2))
            : parseFloat((entryPrice * (1 + slRoi / leverage)).toFixed(2));

        const orderSide = side === 'LONG' ? 'buy' : 'sell';
        const orderParams = {
            'takeProfit': tpPrice.toString(),
            'stopLoss': slPrice.toString(),
            'tpOrderType': 'Market',
            'slOrderType': 'Market',
            'tpslMode': 'Full'
        };

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
            const tpslParams = {
                'category': 'linear', 'symbol': config.SYMBOL,
                'takeProfit': tpPrice.toString(), 'stopLoss': slPrice.toString(),
                'tpOrderType': 'Market', 'slOrderType': 'Market', 'tpslMode': 'Full'
            };

            await exchange.privatePostV5PositionTradingStop(tpslParams);
            console.log(`✅ [TPSL SET SUCCESS] TP: ${tpPrice}, SL: ${slPrice}`);
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
                    `✅ <b>익절가(TP):</b> $${tpPrice.toLocaleString()} (ROI ${(targetRoi * 100).toFixed(1)}%)\n` +
                    `❌ <b>손절가(SL):</b> $${slPrice.toLocaleString()} (ROI ${(slRoi * 100).toFixed(1)}%)\n\n` +
                    `📡 레버리지 ${leverage}배 기준 계산됨`;

        if (!skipNotify) {
            await sendTelegram(msg);
        }
    } catch (err) {
        console.error("[BYBIT ENTRY ERROR]", err.message);
    }
}

async function monitorPosition(currentPrice) {
    const entry = liveState.entryPrice;
    const side = liveState.position;
    const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;

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

                const msg = `🏁 <b>[BYBIT EXIT (Exchange Cleared)] ${symbol} ${side}</b>\n` +
                            `• Reason: ${reason} (Already Cleared on Bybit)\n` +
                            `• Est. Price: $${currentPrice.toLocaleString()}\n` +
                            `• Quantity: ${liveState.quantity} BTC\n` +
                            `• <b>Final ROE: ${finalRoe}%</b>\n` +
                            `• <b>Profit: $${profitAmount.toFixed(2)}</b>\n` +
                            `• Duration: ${durationMin}m`;

                await sendTelegram(msg);
                updateTradeLog('EXIT', {
                    side, reason: reason + '_EXCHANGE_CLEARED', price: currentPrice, quantity: liveState.quantity, roe: finalRoe, profit: profitAmount, duration: durationMin
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

        const statusLabel = orderSuccess ? 'BYBIT EXIT' : 'BYBIT EXIT (API FAILED - STATE RESET)';
        const msg = `🏁 <b>[${statusLabel}] ${symbol} ${side}</b>\n` +
                    `• Reason: ${reason}\n` +
                    `• Price: $${currentPrice.toLocaleString()}\n` +
                    `• Quantity: ${liveState.quantity} BTC\n` +
                    `• <b>Final ROE: ${finalRoe}%</b>\n` +
                    `• <b>Profit: $${profitAmount.toFixed(2)}</b>\n` +
                    `• Duration: ${durationMin}m`;
        
        await sendTelegram(msg);
        updateTradeLog('EXIT', {
            side, reason: reason + (orderSuccess ? '' : '_API_FAIL'), price: currentPrice, quantity: liveState.quantity, roe: finalRoe, profit: profitAmount, duration: durationMin
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

                    const msg = `🏁 <b>[EXCHANGE EXIT]</b>\n` +
                                `• ${liveState.position} closed on Bybit (TP/SL or Manual).\n` +
                                `• Est. Price: $${currentPrice.toLocaleString()}\n` +
                                `• Quantity: ${liveState.quantity} BTC\n` +
                                `• Est. ROE: ${(roe * 100).toFixed(2)}%\n` +
                                `• Est. Profit: $${profitAmount.toFixed(2)}`;

                    console.log(`🏁 [SYNC] Position closed on exchange. Resetting to IDLE.`);
                    await sendTelegram(msg);
                    updateTradeLog('EXCHANGE_EXIT', {
                        side: liveState.position, price: currentPrice, quantity: liveState.quantity, roe: (roe * 100).toFixed(2), profit: profitAmount
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
                  `• 봇 상태: ${liveState.status}\n` +
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
    console.log(`\n🤖 [Antigravity ${strategyVersion}] Bybit Live Bot Starting...`);
    const leverage = parseFloat(strategy.config.LEVERAGE) || parseFloat(process.env.LEVERAGE) || 5;
    
    // 시작 시 텔레그램 알림 추가
    await sendTelegram(`🤖 <b>[${displayVersion} LIVE] 봇 시작됨</b>\n• 전략 버전: ${strategyVersion}\n• 레버리지: ${leverage}배\n• 상태: ${liveState.status}`);
    
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
