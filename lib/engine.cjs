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
    let mismatchCount = 0;
    const trades = [];

    // Header (Professional Mode)
    const output = [
        "entryTime,exitTime,balance,cumRoi,side,entryBasis,entryPrice,exitPrice,netProfit,roe,quantity,fee,fundingFee,m5_stochK,m5_stochD,m5_adx,h1_macd,h1_macdSig,h1_stochK,h1_stochD,h1_adx,d1_macd,d1_macdSig,d1_stochK,d1_stochD,d1_adx"
    ];

    // [New] 통합 검증 리포트용 헤더 (방향, 진입가 포함)
    const fullValidationRows = [
        "Trade#,Side,Status,Time,Open,High,Low,Close,EntryBasis,EntryPrice,TargetTP,TargetSL,M5_StochK,M5_StochD,M5_ADX,M5_MACD,M5_MACDSig,H1_MACD,H1_MACDSig,H1_StochK,H1_StochD,H1_ADX,D1_MACD,D1_MACDSig,D1_StochK,D1_StochD,D1_ADX"
    ];

    // [GHOST BUG TRACKER] 전달된 전체 설정을 JSON으로 출력 (유실 확인용)
    console.log(`[ENGINE] FULL OVERRIDE RULES: ${JSON.stringify(config.overrideRules || 'EMPTY')}`);
    const adx5m = config.overrideRules?.long?.['5m']?.useADX;
    console.log(`[ENGINE] ADX Filter Detected: ${adx5m ? 'YES' : 'NO'}`);

    // 4. Main Simulation Loop (Fast-Forward)
    for (let i = 1; i < klines1m.length; i++) {
        const k1m = klines1m[i];
        const time = k1m.time;
        // 시그널 판단은 '이전 1분봉' 마감 시점의 데이터를 기준으로 함 (Look-ahead Bias 완벽 제거)
        const referenceTime = klines1m[i - 1].time; 

        // 상위 봉 인덱스: referenceTime(T-1 마감시점) 이전에 시작된 봉 중 가장 최근 것
        const idx5m = klines5m_all.findLastIndex(k => k.time + 300000 <= referenceTime + 60000); 
        const r1h = klines1h_all.findLastIndex(k => k.time + 3600000 <= referenceTime + 60000);
        const r1d = klines1d_all.findLastIndex(k => k.time + 86400000 <= referenceTime + 60000);

        if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

        // [핵심] 대시보드 설정을 overrideRules로 전달하여 동적 신호 판단
        const signal = signal_logic(indicators, { idx5m, r1h, r1d, idx1m: i - 1 }, config.overrideRules);
        if (signal === 'hold') continue;

        const k5_confirmed = klines5m_all[idx5m]; 
        const entryResult = entry_logic(signal, k1m, k5_confirmed, klines1m, i, config);
        if (!entryResult.executed) continue;

        const entryPrice = entryResult.finalEntryPrice;
        const entryTimeIdx = entryResult.entryTimeIdx;
        const entryTimeKST = toKSTString(klines1m[entryTimeIdx].time);
        const side = signal.toUpperCase();

        // [SELF-CHECK] 진입 정합성 검증 (Mismatch Alert)
        let mismatchWarnings = [];
        // 1. 가격 실현성 체크 (해당 1분봉 범위 내에 있는지)
        if (entryPrice < k1m.low * 0.999 || entryPrice > k1m.high * 1.001) {
            mismatchWarnings.push(`가격 불일치: 진입가(${entryPrice.toFixed(2)})가 봉 범위(${k1m.low} ~ ${k1m.high})를 벗어남`);
        }
        // 2. 지표 조건 재검증 (로그용)
        const checkM5K = indicators.m5?.stoch?.k?.[idx5m];
        const checkM5D = indicators.m5?.stoch?.d?.[idx5m];

        if (mismatchWarnings.length > 0) {
            mismatchCount++;
            console.warn(`[MISMATCH ALERT ⚠️] ${toKSTString(time)} | T${trades.length + 1} | ${side} | ${mismatchWarnings.join(', ')}`);
        }

        const totalFeesRate = (config.MAKER_FEE_RATE + config.EXIT_MAKER_FEE_RATE) * config.LEVERAGE;
        const grossTP = config.TARGET_NET_ROI + totalFeesRate;
        const tpPrice = side === 'LONG' ? entryPrice * (1 + grossTP / config.LEVERAGE) : entryPrice * (1 - grossTP / config.LEVERAGE);
        const slPrice = side === 'LONG' ? entryPrice * (1 - config.SL_ROI / config.LEVERAGE) : entryPrice * (1 + config.SL_ROI / config.LEVERAGE);

        let exitFound = false;
        for (let j = entryTimeIdx + 1; j < klines1m.length; j++) {
            const lk = klines1m[j];
            let exitReason = '', exitPrice = 0;

            // [EXIT WAIT LIMIT] 타임아웃 체크 (최우선 순위)
            const duration = j - entryTimeIdx;
            const exitWaitLimit = Number(config.EXIT_WAIT_MIN || 0);
            
            if (exitWaitLimit > 0 && duration >= exitWaitLimit) {
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

                // [FIX] 요약 리포트의 지표 기록 시점을 '진입 시점(Entry Time)'으로 일치시킴
                const finalIdx5m = klines5m_all.findIndex(k => k.time >= klines1m[entryTimeIdx].time) - 1;
                const finalR1h = klines1h_all.findIndex(k => k.time > klines1m[entryTimeIdx].time - 3600000) - 1;
                const finalR1d = klines1d_all.findLastIndex(k => k.time + 86400000 <= klines1m[entryTimeIdx].time);

                const m5k = indicators.m5?.stoch?.k?.[finalIdx5m]?.toFixed(1) || '-';
                const m5d = indicators.m5?.stoch?.d?.[finalIdx5m]?.toFixed(1) || '-';
                const m5adx = indicators.m5?.adx?.[finalIdx5m]?.toFixed(1) || '-';
                const h1m = indicators.h1?.macd?.m?.[finalR1h]?.toFixed(2) || '-';
                const h1s = indicators.h1?.macd?.s?.[finalR1h]?.toFixed(2) || '-';
                const h1k = indicators.h1?.stoch?.k?.[finalR1h]?.toFixed(1) || '-';
                const h1d = indicators.h1?.stoch?.d?.[finalR1h]?.toFixed(1) || '-';
                const h1adx = indicators.h1?.adx?.[finalR1h]?.toFixed(1) || '-';

                const tradeData = {
                    entryTime: entryTimeKST,
                    exitTime: exitTimeKST,
                    side,
                    entryPrice,
                    exitPrice,
                    tpPrice, // 추가
                    slPrice, // 추가
                    exitReason,
                    entryBasis: entryResult.entryBasis || entryResult.entryType || '-',
                    quantity: qty.toFixed(4),
                    fee: totalFee.toFixed(2),
                    fundingFee: fundingFee.toFixed(2),
                    netProfit: prof.toFixed(2),
                    balance: balance.toFixed(2),
                    roe: `${(finalNetRoi * 100).toFixed(2)}%`,
                    m5_stochK: m5k, m5_stochD: m5d, m5_adx: m5adx,
                    h1_macd: h1m, h1_macdSig: h1s, h1_stochK: h1k, h1_stochD: h1d, h1_adx: h1adx,
                    d1_macd: indicators.d1?.macd?.m?.[finalR1d]?.toFixed(2) || '-',
                    d1_macdSig: indicators.d1?.macd?.s?.[finalR1d]?.toFixed(2) || '-',
                    d1_stochK: indicators.d1?.stoch?.k?.[finalR1d]?.toFixed(1) || '-',
                    d1_stochD: indicators.d1?.stoch?.d?.[finalR1d]?.toFixed(1) || '-',
                    d1_adx: indicators.d1?.adx?.[finalR1d]?.toFixed(1) || '-',
                    mismatch: mismatchWarnings.join(' | ')
                };
                trades.push(tradeData);

                // [VALIDATION] 전체 매매 사이클 기록 (Signal 감지 30분 전 ~ 청산 완료 시점)
                try {
                    const signalTimeIdx = i; // 신호 발생 시점
                    const valStartTimeIdx = Math.max(0, signalTimeIdx - 30);
                    const valEndTimeIdx = j; // 청산 완료 시점
                    const tradeNum = trades.length;

                    for (let vIdx = valStartTimeIdx; vIdx <= valEndTimeIdx; vIdx++) {
                        const vk = klines1m[vIdx];
                        const vTime = vk.time;
                        const vIdx5m = klines5m_all.findLastIndex(k => k.time + 300000 <= vTime);
                        const vR1h = klines1h_all.findLastIndex(k => k.time + 3600000 <= vTime);
                        const vR1d = klines1d_all.findLastIndex(k => k.time + 86400000 <= vTime);

                        let status = "-";
                        if (vIdx === signalTimeIdx) status = `SIGNAL_T${tradeNum}`;
                        else if (vIdx > signalTimeIdx && vIdx < entryTimeIdx) status = `WAITING_T${tradeNum}`;
                        else if (vIdx === entryTimeIdx) status = `ENTRY_T${tradeNum}`;
                        else if (vIdx > entryTimeIdx && vIdx < valEndTimeIdx) status = `IN_TRADE_T${tradeNum}`;
                        else if (vIdx === valEndTimeIdx) status = `${tradeData.exitReason}_T${tradeNum}`;

                        fullValidationRows.push([
                            `T${tradeNum}`,
                            tradeData.side,
                            status,
                            toKSTString(vTime),
                            vk.open, vk.high, vk.low, vk.close,
                            tradeData.entryBasis || '-',
                            tradeData.entryPrice || '-',
                            tradeData.tpPrice ? tradeData.tpPrice.toFixed(2) : '-',
                            tradeData.slPrice ? tradeData.slPrice.toFixed(2) : '-',
                            indicators.m5?.stoch?.k?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.stoch?.d?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.adx?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.macd?.m?.[vIdx5m]?.toFixed(2) || '-',
                            indicators.m5?.macd?.s?.[vIdx5m]?.toFixed(2) || '-',
                            indicators.h1?.macd?.m?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.macd?.s?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.stoch?.k?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.stoch?.d?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.adx?.[vR1h]?.toFixed(1) || '-',
                            indicators.d1?.macd?.m?.[vR1d]?.toFixed(2) || indicators.d1?.macd?.m?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(2) || '-',
                            indicators.d1?.macd?.s?.[vR1d]?.toFixed(2) || indicators.d1?.macd?.s?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(2) || '-',
                            indicators.d1?.stoch?.k?.[vR1d]?.toFixed(1) || indicators.d1?.stoch?.k?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            indicators.d1?.stoch?.d?.[vR1d]?.toFixed(1) || indicators.d1?.stoch?.d?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            indicators.d1?.adx?.[vR1d]?.toFixed(1) || indicators.d1?.adx?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-'
                        ].join(','));
                    }
                    fullValidationRows.push(""); // 거래 간 구분선
                } catch (vErr) {
                    console.warn(`[VALIDATION ERROR] T${trades.length}: ${vErr.message}`);
                }


                // CSV 출력 컬럼 순서 연동
                output.push(`${entryTimeKST},${exitTimeKST},${balance.toFixed(2)},${cumRoi}%,${side},${tradeData.entryBasis},${entryPrice},${exitPrice},${prof.toFixed(2)},${tradeData.roe},${qty.toFixed(4)},${totalFee.toFixed(2)},${fundingFee.toFixed(2)},${m5k},${m5d},${m5adx},${h1m},${h1s},${h1k},${h1d},${h1adx},${tradeData.d1_macd},${tradeData.d1_macdSig},${tradeData.d1_stochK},${tradeData.d1_stochD},${tradeData.d1_adx}`);

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

    // 통합 검증 리포트 저장
    const valFilePath = path.join(resDir, `validation_FULL_${name.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    fs.writeFileSync(valFilePath, fullValidationRows.join('\n'));

    return {
        roi: ((balance / initialBalance - 1) * 100).toFixed(2),
        wins, losses,
        finalBalance: balance,
        trades,
        mismatchCount,
        detailFile: fPath,
        validationFile: valFilePath // 통합 검증 파일 경로 반환
    };
}

module.exports = { runBacktest };
