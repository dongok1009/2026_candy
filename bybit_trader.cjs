const ccxt = require('ccxt');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// 전략 로직 모듈 동적 로드 (기본값 v7.0.3)
const strategyVersion = process.env.STRATEGY_VERSION || 'Logic.v7.0.3.cjs';
const strategy = require('./strategies/' + strategyVersion);

const config = {
    apiKey: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_API_SECRET,
    symbol: (process.env.SYMBOL || 'BTCUSDT').toUpperCase(),
    useTestnet: process.env.USE_TESTNET === 'true',
    telegramToken: process.env.TELEGRAM_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
};

async function sendTelegram(message) {
    let token = config.telegramToken || "";
    let chatId = config.telegramChatId || "";

    if (token.startsWith('bot')) token = token.replace(/^bot/, '');
    
    if (!token || !chatId || token.length < 5) return;

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    } catch (e) { 
        console.error("Telegram send error:", e.message); 
    }
}

// 실시간 상태 저장 (포지션 추적용)
const STATE_FILE = path.join(__dirname, 'bybit_live_state.json');
let liveState = {
    position: null, // 'LONG', 'SHORT', null
    entryPrice: 0,
    entryTime: null,
    status: 'IDLE', // 'IDLE', 'IN_POSITION'
    lastUpdate: null,
    lastSignal: 'hold'
};

if (fs.existsSync(STATE_FILE)) {
    try {
        liveState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {}
}

const RULES_FILE = path.join(__dirname, 'live_rules.json');
let liveRules = {};

const saveState = () => {
    liveState.lastUpdate = new Date().toLocaleString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(liveState, null, 2));
};

// 바이비트 거래소 설정 (선물 - Linear)
const exchange = new ccxt.bybit({
    apiKey: config.apiKey,
    secret: config.secret,
    options: { defaultType: 'linear' }
});

if (config.useTestnet) {
    exchange.setSandboxMode(true);
    console.log("⚠️ [BYBIT LIVE] TESTNET MODE ACTIVE - 가짜 돈으로 매매됩니다 ⚠️");
}

async function init() {
    try {
        console.log(`[INIT] Connecting to Bybit Futures... (${config.symbol})`);
        
        // 포지션 모드 확인 (단방향 모드 강제)
        try {
            await exchange.setPositionMode(false, config.symbol); 
        } catch (e) {
            // 이미 단방향이거나 설정 불가능할 경우 무시
        }

        await sendTelegram(`🤖 <b>[Antigravity v7.0.3] 바이비트 실전 매매 봇 가동</b>\n• 종목: ${config.symbol}\n• 상태: 시장 감시 시작...`);
        runLoop();
    } catch (err) {
        console.error("[INIT ERROR]", err.message);
    }
}

async function fetchOHLCV(interval, limit = 1000) {
    const bybitInterval = interval === '1h' ? '60' : (interval === '12h' ? '720' : (interval === '5m' ? '5' : 'D'));
    const candles = await exchange.fetchOHLCV(config.symbol, bybitInterval, undefined, limit);
    return candles.map(c => ({
        time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
    }));
}

async function runLoop() {
    while (true) {
        try {
            await checkMarkets();
        } catch (err) {
            console.error("[LOOP ERROR]", err.message);
        }
        
        // 정각 동기화 대기 (1분마다 체크)
        const now = Date.now();
        const nextMinute = Math.ceil(now / 60000) * 60000;
        await new Promise(r => setTimeout(r, nextMinute - now + 2000));
    }
}

async function checkMarkets() {
    const now = new Date();
    console.log(`\n[${now.toLocaleTimeString()}] --- BYBIT SCANNING ---`);

    const [m5, h1, h12, d1] = await Promise.all([
        fetchOHLCV('5m', 1000),
        fetchOHLCV('1h', 1000),
        fetchOHLCV('12h', 1000),
        fetchOHLCV('1d', 1000)
    ]);

    if (fs.existsSync(RULES_FILE)) {
        liveRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
    }

    const indicators = strategy.indicators_logic({ m5, h1, h12, d1 });
    const indices = { idx5m: m5.length - 2, r1h: h1.length - 2, r12h: h12.length - 2, r1d: d1.length - 2 };
    const signal = strategy.signal_logic(indicators, indices, liveRules);
    
    let lev = parseInt(process.env.LEVERAGE) || liveRules?.global?.leverage || 5;

    // 포지션 진입 로직
    if (liveState.status === 'IDLE' && signal !== 'hold' && signal !== liveState.lastSignal) {
        const lastM5 = m5[m5.length - 1];
        await handleEntry(signal, lastM5, lev);
    } 
    // 진행 중인 포지션 감시 및 청산 로직
    else if (liveState.status === 'IN_POSITION') {
        const currentPrice = m5[m5.length - 1].close;
        await monitorPosition(currentPrice, lev);
    }

    liveState.lastSignal = signal;
    saveState();
}

async function handleEntry(signal, lastM5, leverage) {
    console.log(`🔥 [ENTRY] Signal Detect: ${signal.toUpperCase()}`);
    
    // 바이비트 레버리지 설정 (매번 진입 전 확인)
    try {
        await exchange.setLeverage(leverage, config.symbol);
    } catch(e) {}

    // 진입가는 5분봉의 꼬리(그림자) 노림
    const targetPrice = signal === 'long' ? lastM5.low : lastM5.high;
    const currentPrice = lastM5.close;

    // 수량 계산 (환경변수에서 가져옴)
    const margin = parseFloat(process.env.ORDER_AMOUNT) || 100; 
    let quantity = (margin * leverage) / currentPrice;
    
    // 바이비트 최소 수량 소수점 맞춤 (BTCUSDT 기준 보통 0.001)
    quantity = parseFloat(quantity.toFixed(3)); 

    const tpPrice = signal === 'long' 
        ? parseFloat((targetPrice * (1 + strategy.config.TARGET_NET_ROI / leverage)).toFixed(2))
        : parseFloat((targetPrice * (1 - strategy.config.TARGET_NET_ROI / leverage)).toFixed(2));
    
    const slPrice = signal === 'long'
        ? parseFloat((targetPrice * (1 - strategy.config.SL_ROI / leverage)).toFixed(2))
        : parseFloat((targetPrice * (1 + strategy.config.SL_ROI / leverage)).toFixed(2));

    console.log(`[TRADE] Placing ${signal.toUpperCase()} Limit Order @ ${targetPrice} (Qty: ${quantity})`);
    console.log(`[TPSL] Expected TP (Limit): ${tpPrice}, SL (Market): ${slPrice}`);

    try {
        // [실전 매매 API 호출]
        const order = await exchange.createOrder(
            config.symbol, 
            'limit', 
            signal === 'long' ? 'buy' : 'sell', 
            quantity, 
            targetPrice,
            {
                takeProfit: tpPrice,
                stopLoss: slPrice,
                tpOrderType: 'Limit', // 익절은 지정가(Maker)
                slOrderType: 'Market', // 손절은 시장가(Taker) 확실한 보호
                tpslMode: 'Partial',   // 지정가 익절을 위해 Partial 모드 사용
                tpLimitPrice: tpPrice  // 지정가 익절의 실제 가격
            }
        );
        
        liveState.status = 'IN_POSITION';
        liveState.position = signal.toUpperCase();
        liveState.entryPrice = targetPrice;
        liveState.entryTime = Date.now();
        saveState();

        await sendTelegram(`🚀 <b>[BYBIT ENTRY] ${config.symbol} ${liveState.position}</b>\n• Price: $${targetPrice}\n• TP (Limit): $${tpPrice}\n• SL (Market): $${slPrice}\n• Leverage: ${leverage}x`);
    } catch (err) {
        console.error("[BYBIT ENTRY ERROR]", err.message);
        await sendTelegram(`⚠️ <b>[진입 에러]</b>\n${err.message}`);
    }
}

async function monitorPosition(currentPrice, leverage) {
    const entry = liveState.entryPrice;
    const side = liveState.position === 'LONG' ? 1 : -1;
    const roe = ((currentPrice / entry - 1) * side) * leverage;
    const durationMin = Math.floor((Date.now() - liveState.entryTime) / (1000 * 60));

    const tp = strategy.config.TARGET_NET_ROI || 0.03;
    const sl = strategy.config.SL_ROI || 0.15;
    const waitLimit = strategy.config.EXIT_WAIT_MIN || 2000;

    process.stdout.write(`\r[MONITOR] ${liveState.position} | ROE: ${(roe * 100).toFixed(2)}% | Time: ${durationMin}m `);

    let exitReason = null;
    if (roe >= tp) exitReason = 'TAKE_PROFIT';
    else if (roe <= -sl) exitReason = 'STOP_LOSS';
    else if (durationMin >= waitLimit) exitReason = 'TIMEOUT';

    // 만약 거래소 서버에 TP/SL이 안 걸려있다면 다시 한 번 시도 (백업)
    if (exitReason) {
        console.log(`\n🏁 [EXIT] ${exitReason} Triggered! Closing Position...`);
        try {
            const positions = await exchange.fetchPositions([config.symbol]);
            const pos = positions.find(p => p.symbol === config.symbol && parseFloat(p.contracts) > 0);
            
            if (pos) {
                await exchange.createOrder(
                    config.symbol,
                    'market',
                    liveState.position === 'LONG' ? 'sell' : 'buy',
                    pos.contracts,
                    undefined,
                    { reduceOnly: true }
                );
            }

            const finalRoe = (roe * 100).toFixed(2);
            await sendTelegram(`🏁 <b>[BYBIT EXIT] ${config.symbol} ${liveState.position}</b>\n• Reason: ${exitReason}\n• Price: $${currentPrice}\n• Final ROE: <b>${finalRoe}%</b>\n• Duration: ${durationMin}m`);
            
            liveState.status = 'IDLE';
            liveState.position = null;
            saveState();
        } catch (err) {
            console.error("[BYBIT EXIT ERROR]", err.message);
        }
    } else {
        // 매 5분마다 한 번씩 거래소의 TPSL 상태를 체크하여 동기화
        if (durationMin % 5 === 0 && durationMin > 0) {
            const leverage = parseFloat(process.env.LEVERAGE) || 5;
            await syncExchangeTPSL(leverage);
        }
    }
}

async function syncExchangeTPSL(leverage) {
    try {
        const positions = await exchange.fetchPositions(); // 전체 포지션 가져오기
        console.log(`[DEBUG] Found ${positions.length} active positions on Exchange.`);
        
        positions.forEach(p => {
            if (parseFloat(p.contracts) > 0) {
                console.log(`[DEBUG] Detected Active Position: ${p.symbol} (${p.contracts} contracts)`);
            }
        });

        const pos = positions.find(p => {
            const isMatch = p.symbol === config.symbol || 
                          p.info.symbol === config.symbol || 
                          p.symbol.replace(/\W/g, '') === config.symbol.replace(/\W/g, '');
            return isMatch && parseFloat(p.contracts) > 0;
        });
        
        if (pos) {
            console.log(`[DEBUG] Current Position: ${pos.symbol} matched! | Side: ${pos.side} | Qty: ${pos.contracts} | TP: ${pos.takeProfit} | SL: ${pos.stopLoss}`);
            
            // 봇 상태 강제 동기화 (팔았다고 착각하고 있는 상태 방지)
            if (liveState.status !== 'IN_POSITION') {
                console.log(`⚠️ [SYNC] Bot state was IDLE, but Position exists. Updating state to IN_POSITION.`);
                liveState.status = 'IN_POSITION';
                const sideLower = pos.side.toLowerCase();
                liveState.position = (sideLower === 'long' || sideLower === 'buy') ? 'LONG' : 'SHORT';
                liveState.entryPrice = parseFloat(pos.entryPrice);
                liveState.entryTime = liveState.entryTime || Date.now();
                saveState();
            }
        }

        // 익절이나 손절 중 하나라도 없으면 재설정
        if (pos && (!pos.takeProfit || !pos.stopLoss || pos.takeProfit === 0 || pos.stopLoss === 0)) {
            console.log(`\n🔄 [SYNC] Missing TPSL on Exchange. Setting now...`);
            
            const entry = parseFloat(pos.entryPrice);
            const side = pos.side === 'Buy' ? 1 : -1;
            
            // UI에서 가져온 설정값 사용
            const tpRate = strategy.config.TARGET_NET_ROI || 0.03;
            const slRate = strategy.config.SL_ROI || 0.15;

            const tpPrice = side === 1 
                ? parseFloat((entry * (1 + tpRate / leverage)).toFixed(2))
                : parseFloat((entry * (1 - tpRate / leverage)).toFixed(2));
            
            const slPrice = side === 1
                ? parseFloat((entry * (1 - slRate / leverage)).toFixed(2))
                : parseFloat((entry * (1 + slRate / leverage)).toFixed(2));

            // ccxt 바이비트 v5 전용 메서드 사용 (setTakeProfit, setStopLoss 등은 버전마다 다를 수 있어 가장 확실한 파라미터 방식 사용)
            await exchange.setTakeProfit(config.symbol, tpPrice, {
                'stopLoss': slPrice,
                'tpOrderType': 'Limit',
                'slOrderType': 'Market',
                'tpslMode': 'Partial',
                'tpLimitPrice': tpPrice
            });
            console.log(`✅ [SYNC] Exchange TPSL set: TP ${tpPrice}, SL ${slPrice}`);
            await sendTelegram(`🔄 <b>[BYBIT SYNC] TPSL Updated</b>\n• TP (Limit): $${tpPrice}\n• SL (Market): $${slPrice}`);
        }
    } catch (err) {
        console.error("[SYNC ERROR]", err.message);
    }
}

async function init() {
    console.log("🚀 Starting Bybit Live Bot...");
    // 시작 시 현재 포지션 동기화
    const leverage = parseFloat(process.env.LEVERAGE) || 5;
    await syncExchangeTPSL(leverage);
    
    while(true) {
        await checkMarkets();
        await new Promise(r => setTimeout(r, 60000)); // 1분 대기
    }
}

init();
