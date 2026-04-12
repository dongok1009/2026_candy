const ccxt = require('ccxt');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 로직 모듈 로드 (v7.0.2 기준)
const strategy = require('./strategies/Logic.v7.0.2.cjs');

dotenv.config();

const config = {
    apiKey: process.env.BINANCE_API_KEY,
    secret: process.env.BINANCE_API_SECRET,
    symbol: process.env.SYMBOL || 'BTCUSDT',
    leverage: parseInt(process.env.LEVERAGE || '5'),
    useTestnet: process.env.USE_TESTNET === 'true'
};

// 실시간 상태 저장용
const STATE_FILE = path.join(__dirname, 'live_state.json');
let liveState = {
    position: null, // 'LONG', 'SHORT', null
    entryPrice: 0,
    entryTime: null,
    status: 'IDLE', // 'IDLE', 'ENTRY_WAIT', 'IN_POSITION'
    lastUpdate: null,
    pnl: 0
};

// 상태 로드
if (fs.existsSync(STATE_FILE)) {
    try {
        liveState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) { console.error("State load error, starting fresh."); }
}

// 규칙(Rules) 로드 (UI에서 설정한 것과 연동 가능하도록)
const RULES_FILE = path.join(__dirname, 'live_rules.json');
let liveRules = {};
if (fs.existsSync(RULES_FILE)) {
    liveRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}

const saveState = () => {
    liveState.lastUpdate = new Date().toLocaleString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(liveState, null, 2));
};

const exchange = new ccxt.binance({
    apiKey: config.apiKey,
    secret: config.secret,
    options: { defaultType: 'future' }
});

if (config.useTestnet) {
    exchange.setSandboxMode(true);
    console.log("⚠️ [LIVE] TESTNET MODE ACTIVE - NOT REAL MONEY ⚠️");
}

async function init() {
    try {
        console.log(`[INIT] Connecting to Binance Futures... (${config.symbol})`);
        await exchange.setLeverage(config.leverage, config.symbol);
        console.log(`[INIT] Leverage set to ${config.leverage}x`);
        
        // 메인 루프 실행
        runLoop();
    } catch (err) {
        console.error("[INIT ERROR]", err.message);
    }
}

async function runLoop() {
    console.log(`[LIVE] Starting Trader Loop...`);
    
    while (true) {
        try {
            await checkMarkets();
        } catch (err) {
            console.error("[LOOP ERROR]", err.message);
        }
        // 1분마다 체크 (5분봉 마감 대응)
        await new Promise(r => setTimeout(r, 60000));
    }
}

async function fetchOHLCV(interval, limit = 500) {
    const candles = await exchange.fetchOHLCV(config.symbol, interval, undefined, limit);
    return candles.map(c => ({
        time: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
    }));
}

async function checkMarkets() {
    const now = new Date();
    console.log(`\n[${now.toLocaleTimeString()}] --- SCANNING MARKET ---`);

    // 1. 데이터 가져오기 (5m, 1h, 1d)
    const [m5, h1, d1] = await Promise.all([
        fetchOHLCV('5m', 500),
        fetchOHLCV('1h', 500),
        fetchOHLCV('1d', 500)
    ]);

    // 2. 지표 계산 (직전 마감봉 기준 T-1)
    const klines = { m5, h1, d1 };
    const indicators = strategy.indicators_logic(klines);

    // T-1 인덱스 (마지막 봉은 진행 중이므로 그 전 봉을 사용)
    const indices = {
        idx5m: m5.length - 2,
        r1h: h1.length - 2,
        r1d: d1.length - 2
    };

    // 3. 신호 판단
    const signal = strategy.signal_logic(indicators, indices, liveRules);
    console.log(`[SIGNAL] Current signal: ${signal.toUpperCase()}`);

    // 4. 매매 판단 로직
    if (liveState.status === 'IDLE') {
        if (signal !== 'hold') {
            await handleEntry(signal, m5[m5.length - 1]);
        }
    } else if (liveState.status === 'IN_POSITION') {
        const currentPrice = m5[m5.length - 1].close;
        await monitorPosition(currentPrice);
    }
}

async function handleEntry(signal, lastM5) {
    console.log(`🔥 [ENTRY] Signal Detect: ${signal}. Setting up Limit Order...`);
    
    // v7.0.2: 진입가는 5분봉의 Low(Long) 또는 High(Short)
    const targetPrice = signal === 'long' ? lastM5.low : lastM5.high;
    const currentPrice = lastM5.close;

    // 수량 계산 (1000$ 기준, 레버리지 5x 적용)
    const margin = 1000; // 가상 증거금
    const quantity = (margin * config.leverage) / currentPrice;

    console.log(`[ENTRY] Target Price: ${targetPrice}, Current: ${currentPrice}, Qty: ${quantity.toFixed(4)}`);

    try {
        // 실제 주문 (테스트넷/실전)
        // const order = await exchange.createOrder(config.symbol, 'limit', signal === 'long' ? 'buy' : 'sell', quantity, targetPrice);
        
        // 실전 시뮬레이션 상태 업데이트
        liveState.status = 'IN_POSITION';
        liveState.position = signal.toUpperCase();
        liveState.entryPrice = targetPrice; // 또는 체결가
        liveState.entryTime = Date.now();
        console.log(`✅ [TRADE] Order Placed & Position Tracked: ${liveState.position} @ ${targetPrice}`);
        saveState();
    } catch (err) {
        console.error("[ENTRY ERROR]", err.message);
    }
}

async function monitorPosition(currentPrice) {
    const entry = liveState.entryPrice;
    const side = liveState.position === 'LONG' ? 1 : -1;
    
    // 수익률 계산 (ROE)
    const roe = ((currentPrice / entry - 1) * side) * config.leverage;
    const duration = Math.floor((Date.now() - liveState.entryTime) / (1000 * 60)); // 경과 시간(분)

    const tp = strategy.config.TARGET_NET_ROI || 0.03;
    const sl = strategy.config.SL_ROI || 0.15;
    const waitLimit = strategy.config.EXIT_WAIT_MIN || 2000;

    process.stdout.write(`\r[MONITOR] ${liveState.position} | ROE: ${(roe * 100).toFixed(2)}% | Duration: ${duration}min / ${waitLimit}min  `);

    // 청산 조건 체크
    let exitReason = null;
    if (roe >= tp) exitReason = 'TAKE_PROFIT';
    else if (roe <= -sl) exitReason = 'STOP_LOSS';
    else if (duration >= waitLimit) exitReason = 'TIMEOUT_FORCED';

    if (exitReason) {
        console.log(`\n🚀 [EXIT] ${exitReason} triggered at ${currentPrice}! Closing position...`);
        try {
            // 실제 청산 주문
            // await exchange.createOrder(config.symbol, 'market', side === 1 ? 'sell' : 'buy', ...);
            
            liveState.status = 'IDLE';
            liveState.position = null;
            saveState();
            console.log("🏁 [TRADE] Position Closed Successfully.");
        } catch (err) {
            console.error("[EXIT ERROR]", err.message);
        }
    }
}

init();
