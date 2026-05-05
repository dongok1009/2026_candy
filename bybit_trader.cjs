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
    lastUpdate: null
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
    console.log(`\n[${new Date().toLocaleTimeString()}] --- BYBIT SCANNING ---`);

    const [m5, h1, h12, d1] = await Promise.all([
        fetchOHLCV('5m', 1000),
        fetchOHLCV('1h', 1000),
        fetchOHLCV('12h', 1000),
        fetchOHLCV('1d', 1000)
    ]);

    const indicators = strategy.indicators_logic({ m5, h1, h12, d1 });
    const indices = { idx5m: m5.length - 2, r1h: h1.length - 2, r12h: h12.length - 2, r1d: d1.length - 2 };

    const overrideRules = fs.existsSync(RULES_FILE) ? JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')) : null;

    if (liveState.status === 'IDLE') {
        const longStatus = {
            m5: strategy.indicators_logic({ m5, h1, h12, d1 }).m5 ? 'OK' : 'WAIT', // 이 부분은 예시이며 실제 로직 결과를 가져와야 함
        };
        
        // 실제 전략의 개별 조건을 체크하도록 보강
        const m5Long = strategy.indicators_logic({m5}).m5.adx[indices.idx5m] >= 30 && indicators.m5.stoch.k[indices.idx5m] > indicators.m5.stoch.d[indices.idx5m];
        const h1Long = indicators.h1.macd.m[indices.r1h] > indicators.h1.macd.s[indices.r1h] && indicators.h1.stoch.k[indices.r1h] > indicators.h1.stoch.d[indices.r1h];
        const d1Long = indicators.d1.macd.m[indices.r1d] > indicators.d1.macd.s[indices.r1d];

        const longSignal = m5Long && h1Long && d1Long;
        const shortSignal = false; // 숏은 일단 제외하거나 나중에 추가

        console.log(`[SCAN] LONG  | M5:${m5Long?'OK':'WAIT'} | H1:${h1Long?'OK':'WAIT'} | D1:${d1Long?'OK':'WAIT'} -> ${longSignal ? '🔥 SIGNAL' : 'PASS'}`);

        if (longSignal) await handleEntry('LONG', m5[m5.length - 1].close);
        else if (shortSignal) await handleEntry('SHORT', m5[m5.length - 1].close);
    } else {
        await monitorPosition(m5[m5.length - 1].close);
    }
}

async function handleEntry(side, price) {
    const config = strategy.config;
    console.log(`\n🚀 [ENTRY SIGNAL] ${side} at $${price}`);

    try {
        const amount = (parseFloat(process.env.INITIAL_BALANCE) || 1000) * (parseFloat(process.env.LEVERAGE) || 5) / price;
        const contracts = exchange.amountToLots(config.SYMBOL, amount);

        const order = await exchange.createOrder(config.SYMBOL, 'market', side === 'LONG' ? 'buy' : 'sell', contracts);
        console.log(`✅ [BYBIT ENTRY] Order Placed: ${order.id}`);

        liveState.status = 'IN_POSITION';
        liveState.position = side;
        liveState.entryPrice = price;
        liveState.entryTime = Date.now();
        saveState();

        // TPSL 계산
        const leverage = parseFloat(process.env.LEVERAGE) || 5;
        const targetRoi = strategy.config.TARGET_NET_ROI || 0.03;
        const slRoi = strategy.config.SL_ROI || 0.15;

        const tpPrice = side === 'LONG' 
            ? parseFloat((price * (1 + targetRoi / leverage)).toFixed(2))
            : parseFloat((price * (1 - targetRoi / leverage)).toFixed(2));
        const slPrice = side === 'LONG'
            ? parseFloat((price * (1 - slRoi / leverage)).toFixed(2))
            : parseFloat((price * (1 + slRoi / leverage)).toFixed(2));

        // Exchange-side TPSL 등록 (Partial Mode + Limit TP)
        try {
            await exchange.privatePostV5PositionSetTpsl({
                'category': 'linear',
                'symbol': config.SYMBOL,
                'takeProfit': tpPrice.toString(),
                'stopLoss': slPrice.toString(),
                'tpOrderType': 'Limit',
                'slOrderType': 'Market',
                'tpslMode': 'Partial',
                'tpLimitPrice': tpPrice.toString()
            });
            console.log(`✅ [TPSL SET] TP: ${tpPrice}, SL: ${slPrice}`);
        } catch (e) {
            console.error("TPSL Set Error:", e.message);
        }

        await sendTelegram(`🚀 <b>[BYBIT ENTRY] ${config.SYMBOL} ${side}</b>\n• Price: $${price}\n• Qty: ${contracts}\n• Leverage: ${leverage}x`);
    } catch (err) {
        console.error("[BYBIT ENTRY ERROR]", err.message);
    }
}

async function monitorPosition(currentPrice) {
    const config = strategy.config;
    const entry = liveState.entryPrice;
    const side = liveState.position;
    const leverage = parseFloat(process.env.LEVERAGE) || 5;

    const roe = side === 'LONG' 
        ? (currentPrice - entry) / entry * leverage 
        : (entry - currentPrice) / entry * leverage;

    const durationMin = Math.floor((Date.now() - liveState.entryTime) / 60000);
    console.log(`[MONITOR] ${side} | ROE: ${(roe * 100).toFixed(2)}% | Time: ${durationMin}m`);

    const target = strategy.config.TARGET_NET_ROI || 0.03;
    const sl = strategy.config.SL_ROI || 0.15;

    let exitReason = null;
    if (roe >= target) exitReason = 'TAKE_PROFIT';
    else if (roe <= -sl) exitReason = 'STOP_LOSS';

    if (exitReason) {
        console.log(`\n🏁 [EXIT] ${exitReason} Triggered! Closing Position...`);
        await closePosition(side, exitReason, currentPrice, roe, durationMin);
    } else {
        // 5분마다 동기화 체크
        if (durationMin % 5 === 0 && durationMin > 0) {
            await syncExchangeTPSL(leverage);
        }
    }
}

async function closePosition(side, reason, currentPrice, roe, durationMin) {
    try {
        const symbol = strategy.config.SYMBOL;
        const positions = await exchange.fetchPositions();
        const pos = positions.find(p => isSymbolMatch(p.symbol, symbol) && parseFloat(p.contracts) > 0);

        if (!pos) {
            console.log(`⚠️ [EXIT] No active position found on Exchange for ${symbol}. Updating state to IDLE.`);
            liveState.status = 'IDLE';
            saveState();
            return;
        }

        const contracts = parseFloat(pos.contracts);
        const orderSide = pos.side.toLowerCase() === 'long' || pos.side.toLowerCase() === 'buy' ? 'sell' : 'buy';

        console.log(`🔥 [BYBIT EXIT ORDER] ${symbol} | Side: ${orderSide} | Qty: ${contracts}`);
        await exchange.createOrder(symbol, 'market', orderSide, contracts, undefined, { reduceOnly: true });

        const finalRoe = (roe * 100).toFixed(2);
        await sendTelegram(`🏁 <b>[BYBIT EXIT] ${symbol} ${side}</b>\n• Reason: ${reason}\n• Price: $${currentPrice}\n• Final ROE: <b>${finalRoe}%</b>\n• Duration: ${durationMin}m`);
        
        liveState.status = 'IDLE';
        liveState.position = null;
        saveState();
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
                console.log(`⚠️ [SYNC] Correcting State: ${liveState.status} -> IN_POSITION | Side: ${correctSide}`);
                liveState.status = 'IN_POSITION';
                liveState.position = correctSide;
                liveState.entryPrice = parseFloat(pos.entryPrice || pos.avgPrice);
                liveState.entryTime = liveState.entryTime || Date.now();
                saveState();
            }

            // TPSL 설정 안되어 있으면 시도
            if (!pos.takeProfit || !pos.stopLoss || pos.takeProfit === 0 || pos.stopLoss === 0) {
                console.log(`🔄 [SYNC] Setting missing TPSL on Exchange...`);
                const entry = parseFloat(pos.entryPrice || pos.avgPrice);
                const targetRoi = strategy.config.TARGET_NET_ROI || 0.03;
                const slRoi = strategy.config.SL_ROI || 0.15;

                const tpPrice = correctSide === 'LONG' 
                    ? parseFloat((entry * (1 + targetRoi / leverage)).toFixed(2))
                    : parseFloat((entry * (1 - targetRoi / leverage)).toFixed(2));
                const slPrice = correctSide === 'LONG'
                    ? parseFloat((entry * (1 - slRoi / leverage)).toFixed(2))
                    : parseFloat((entry * (1 + slRoi / leverage)).toFixed(2));

                try {
                    // ccxt 버전에 상관없이 바이비트 v5 API 직접 호출
                    await exchange.privatePostV5PositionSetTpsl({
                        'category': 'linear',
                        'symbol': symbol,
                        'takeProfit': tpPrice.toString(),
                        'stopLoss': slPrice.toString(),
                        'tpOrderType': 'Limit',
                        'slOrderType': 'Market',
                        'tpslMode': 'Partial',
                        'tpLimitPrice': tpPrice.toString()
                    });
                    console.log(`✅ [SYNC] TPSL Set Success (Raw API)`);
                } catch (e) {
                    console.log(`[SYNC ERROR] ${e.message}`);
                }
            }
        }
    } catch (err) {
        console.error("[SYNC ERROR]", err.message);
    }
}

async function init() {
    loadState();
    console.log(`\n🤖 [Antigravity ${strategyVersion}] Bybit Live Bot Starting...`);
    console.log(`• Symbol: ${strategy.config.SYMBOL}`);
    console.log(`• Status: ${liveState.status} ${liveState.status === 'IN_POSITION' ? '(' + liveState.position + ')' : ''}`);

    const leverage = parseFloat(process.env.LEVERAGE) || 5;
    await syncExchangeTPSL(leverage);

    while(true) {
        try {
            await checkMarkets();
        } catch (err) {
            console.error("[LOOP ERROR]", err.message);
        }
        await new Promise(r => setTimeout(r, 60000));
    }
}

init();
