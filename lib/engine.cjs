const fs = require('fs');
const path = require('path');
const { fetchKlines, toKSTString } = require('./utils.cjs');

async function runBacktest(strategy) {
    const { 
        name,
        config,
        indicators_logic,
        signal_logic,
        entry_logic
    } = strategy;

    console.log(`--- [${name}] Backtest Started (Fast-Forward Mode) ---`);

    // 1. Fetch Data
    const klines1m_all = await fetchKlines(config.SYMBOL, '1m', config.FETCH_START_TIME, config.END_TIME);
    const klines5m_all = await fetchKlines(config.SYMBOL, '5m', config.FETCH_START_TIME, config.END_TIME);
    const klines1h_all = await fetchKlines(config.SYMBOL, '1h', config.FETCH_START_TIME, config.END_TIME);
    const klines1d_all = await fetchKlines(config.SYMBOL, '1d', config.FETCH_START_TIME, config.END_TIME);

    // 2. Pre-calculate Indicators
    console.log("Calculating indicators...");
    const indicators = indicators_logic({
        m1: klines1m_all,
        m5: klines5m_all,
        h1: klines1h_all,
        d1: klines1d_all
    });

    // 3. State Setup
    const klines1m = klines1m_all.filter(k => k.time >= config.ACTUAL_START_TIME);
    const initialBalance = config.INITIAL_BALANCE;
    let balance = initialBalance;
    let wins = 0, losses = 0;
    const trades = [];

    // Header (Professional Mode)
    const output = [
        "entryTime,exitTime,balance,cumRoi,side,entryPrice,exitPrice,netProfit,roe,m5_stochK,m5_stochD,m5_adx,h1_macd,h1_macdSig,h1_stochK,h1_stochD,h1_adx,d1_macd,d1_macdSig,d1_adx"
    ];

    // 4. Main Simulation Loop (Fast-Forward)
    for (let i = 1; i < klines1m.length; i++) {
        const k1m = klines1m[i];
        const time = k1m.time;

        const idx5m = klines5m_all.findIndex(k => k.time >= time) - 1;
        const r1h = klines1h_all.findIndex(k => k.time > time - 3600000) - 1;
        const r1d = klines1d_all.findIndex(k => k.time > time - 86400000) - 1;

        if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

        const signal = signal_logic(indicators, { idx5m, r1h, r1d });
        if (signal === 'hold') continue;

        const entryResult = entry_logic(signal, k1m, klines5m_all[idx5m], klines1m, i, config);
        if (!entryResult.executed) continue;

        const entryPrice = entryResult.finalEntryPrice;
        const entryTimeIdx = entryResult.entryTimeIdx;
        const entryTimeKST = toKSTString(klines1m[entryTimeIdx].time);
        const side = signal.toUpperCase();

        const totalFeesRate = (config.MAKER_FEE_RATE + config.EXIT_MAKER_FEE_RATE) * config.LEVERAGE;
        const grossTP = config.TARGET_NET_ROI + totalFeesRate;
        const tpPrice = side === 'LONG' ? entryPrice * (1 + grossTP / config.LEVERAGE) : entryPrice * (1 - grossTP / config.LEVERAGE);
        const slPrice = side === 'LONG' ? entryPrice * (1 - config.SL_ROI / config.LEVERAGE) : entryPrice * (1 + config.SL_ROI / config.LEVERAGE);

        let exitFound = false;
        for (let j = entryTimeIdx + 1; j < klines1m.length; j++) {
            const lk = klines1m[j];
            let exitReason = '', exitPrice = 0;

            // [EXIT WAIT LIMIT] 타임아웃 체크
            const duration = j - entryTimeIdx;
            if (config.EXIT_WAIT_MIN && duration >= config.EXIT_WAIT_MIN) {
                exitReason = 'TIMEOUT';
                exitPrice = lk.close; // 타임아웃 시 시장가(종가) 청산
            }

            if (!exitReason) {
                if (side === 'LONG') {
                    if (lk.high >= tpPrice) { exitReason = 'TP'; exitPrice = tpPrice; }
                    else if (lk.low <= slPrice) { exitReason = 'SL'; exitPrice = slPrice; }
                } else {
                    if (lk.low <= tpPrice) { exitReason = 'TP'; exitPrice = tpPrice; }
                    else if (lk.high >= slPrice) { exitReason = 'SL'; exitPrice = slPrice; }
                }
            }

            if (exitReason) {
                // 수량(Quantity) 계산: 진입 시점 잔고 * 레버리지 / 진입가
                const qty = (balance * config.LEVERAGE) / entryPrice;
                const feeRate = (exitReason === 'TP' || exitReason === 'TIMEOUT') ? (config.MAKER_FEE_RATE + config.EXIT_MAKER_FEE_RATE) : (config.MAKER_FEE_RATE + config.TAKER_FEE_RATE);
                
                let finalNetRoi = 0;
                if (exitReason === 'TP') {
                    finalNetRoi = config.TARGET_NET_ROI;
                } else if (exitReason === 'SL') {
                    finalNetRoi = -(config.SL_ROI + (feeRate * config.LEVERAGE));
                } else { // TIMEOUT (시장가 차익 계산)
                    const priceDiff = side === 'LONG' ? (exitPrice / entryPrice - 1) : (entryPrice / exitPrice - 1);
                    finalNetRoi = (priceDiff * config.LEVERAGE) - (feeRate * config.LEVERAGE);
                }
                
                const totalFee = (balance * config.LEVERAGE * feeRate);
                const fundingFee = (balance * config.LEVERAGE * config.FUNDING_FEE_RATE); // 샘플 펀딩피
                
                // [Compounding] 복리 적용
                const prof = (balance * finalNetRoi);
                balance += prof;
                if (finalNetRoi > 0) wins++; else losses++;

                const cumRoi = ((balance / initialBalance - 1) * 100).toFixed(2);
                const exitTimeKST = toKSTString(lk.time);
                
                const m5k = indicators.m5?.stoch?.k?.[idx5m]?.toFixed(1) || '-';
                const m5d = indicators.m5?.stoch?.d?.[idx5m]?.toFixed(1) || '-';
                const m5adx = indicators.m5?.adx?.[idx5m]?.toFixed(1) || '-';
                const h1m = indicators.h1?.macd?.m?.[r1h]?.toFixed(2) || '-';
                const h1s = indicators.h1?.macd?.s?.[r1h]?.toFixed(2) || '-';
                const h1k = indicators.h1?.stoch?.k?.[r1h]?.toFixed(1) || '-';
                const h1d = indicators.h1?.stoch?.d?.[r1h]?.toFixed(1) || '-';
                const h1adx = indicators.h1?.adx?.[r1h]?.toFixed(1) || '-';

                const tradeData = {
                    entryTime: entryTimeKST, 
                    exitTime: exitTimeKST, 
                    side,
                    entryPrice, 
                    exitPrice, 
                    exitReason,
                    quantity: qty.toFixed(4),
                    fee: totalFee.toFixed(2),
                    fundingFee: fundingFee.toFixed(2),
                    netProfit: prof.toFixed(2), 
                    balance: balance.toFixed(2),
                    roe: `${(finalNetRoi * 100).toFixed(2)}%`,
                    m5_stochK: m5k, m5_stochD: m5d, m5_adx: m5adx,
                    h1_macd: h1m, h1_macdSig: h1s, h1_stochK: h1k, h1_stochD: h1d, h1_adx: h1adx,
                    d1_macd: indicators.d1?.macd?.m?.[r1d]?.toFixed(2) || '-',
                    d1_macdSig: indicators.d1?.macd?.s?.[r1d]?.toFixed(2) || '-',
                    d1_adx: indicators.d1?.adx?.[r1d]?.toFixed(1) || '-'
                };
                trades.push(tradeData);
                
                // CSV 출력 컬럼 순서 연동: #,진입,청산,잔액,누적ROI,방향,진입가,청산가,순수익,ROE,수량,수수료,펀딩피... (필요에 따라 순서 조정)
                output.push(`${entryTimeKST},${exitTimeKST},${balance.toFixed(2)},${cumRoi}%,${side},${entryPrice},${exitPrice},${prof.toFixed(2)},${tradeData.roe},${qty.toFixed(4)},${totalFee.toFixed(2)},${fundingFee.toFixed(2)},${m5k},${m5d},${m5adx},${h1m},${h1s},${h1k},${h1d},${h1adx},${tradeData.d1_macd},${tradeData.d1_macdSig},${tradeData.d1_adx}`);
                
                i = j; // Jump to exit candle
                exitFound = true;
                break;
            }
        }
        
        // If trade opened but never closed, skip to end to prevent overlapping opens
        if (!exitFound) {
            i = klines1m.length;
        }
        if (!exitFound) break;
    }

    const resDir = path.join('c:/dev/2026_candy/results');
    if (!fs.existsSync(resDir)) fs.mkdirSync(resDir);
    const fPath = path.join(resDir, `result_${name.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    fs.writeFileSync(fPath, output.join('\n'));

    return {
        roi: ((balance / initialBalance - 1) * 100).toFixed(2),
        wins, losses,
        finalBalance: balance,
        trades,
        detailFile: fPath
    };
}

module.exports = { runBacktest };
