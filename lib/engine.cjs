const fs = require('fs');
const path = require('path');
const { fetchKlines, toKSTString } = require('./utils.cjs');
const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX, calculateBBW, calculateBBWP, calculateROC } = require('./indicators.cjs');

function formatYYMMDD(timestamp) {
    if (!timestamp) return 'unknown';
    // Convert to KST (+9h)
    const kstDate = new Date(Number(timestamp) + 32400000);
    const yy = String(kstDate.getUTCFullYear()).slice(-2);
    const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kstDate.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
}

function getKSTTimeHHMMSS() {
    const kstDate = new Date(Date.now() + 32400000);
    const hh = String(kstDate.getUTCHours()).padStart(2, '0');
    const mm = String(kstDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(kstDate.getUTCSeconds()).padStart(2, '0');
    return `${hh}${mm}${ss}`;
}

function formatRulesToText(rules) {
    if (!rules) return '설정된 규칙 없음';
    
    const formatSide = (sideRules, sideName) => {
        if (!sideRules) return `  - ${sideName}: 없음`;
        const lines = [];
        
        Object.entries(sideRules).forEach(([tf, tfRules]) => {
            const activeRules = [];
            
            if (tfRules.useMacdVal) {
                activeRules.push(`|MACD| < ${tfRules.macdVal ?? 0}`);
            }
            if (tfRules.useMacdBeyondSig) {
                const operator = sideName === 'Long' ? '>' : '<';
                activeRules.push(`MACD ${operator} Signal`);
            }
            if (tfRules.useMacdSigDiff) {
                activeRules.push(`MACD 차이 > ${tfRules.macdSigDiff ?? 0}`);
            }
            if (tfRules.useStochCross) {
                const crossText = sideName === 'Long' ? 'K > D' : 'K < D';
                activeRules.push(`Stoch 크로스 (${crossText})`);
            }
            if (tfRules.useStochKLimit) {
                const low = tfRules.stochKLow ?? 0;
                const high = tfRules.stochKHigh ?? tfRules.stochKThreshold ?? 80;
                activeRules.push(`${low} < Stoch K < ${high}`);
            }
            if (tfRules.useADX) {
                const low = tfRules.adxLow ?? tfRules.adxThreshold ?? 25;
                const high = tfRules.adxHigh ?? 99;
                activeRules.push(`${low} < ADX < ${high}`);
            }
            if (tfRules.useRSI) {
                const low = tfRules.rsiLow ?? 30;
                const high = tfRules.rsiHigh ?? 70;
                activeRules.push(`${low} < RSI < ${high}`);
            }
            
            if (activeRules.length > 0) {
                lines.push(`  - ${tf}: ${activeRules.join(', ')}`);
            }
        });
        
        if (lines.length === 0) return `  - ${sideName}: 활성화된 지표 필터 없음`;
        return `  - ${sideName} 조건:\n` + lines.map(l => `    ${l}`).join('\n');
    };
    
    const longText = formatSide(rules.long, 'Long');
    const shortText = formatSide(rules.short, 'Short');
    
    return `\n${longText}\n${shortText}`;
}

function aggregateKlines(klines1m, intervalMin) {
    const aggregated = [];
    for (let i = 0; i < klines1m.length; i += intervalMin) {
        const chunk = klines1m.slice(i, i + intervalMin);
        if (chunk.length === 0) continue;
        aggregated.push({
            time: chunk[0].time,
            open: chunk[0].open,
            high: Math.max(...chunk.map(k => k.high)),
            low: Math.min(...chunk.map(k => k.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((sum, k) => sum + k.volume, 0)
        });
    }
    return aggregated;
}

async function runBacktest(strategy) {
    const {
        name,
        config,
        indicators_logic,
        signal_logic,
        entry_logic
    } = strategy;

    console.log(`--- [${name}] Backtest Started (Fast-Forward Mode) ---`);

    // 1. Fetch 1m Data only (to ensure consistency and save bandwidth)
    console.log(`Fetching 1m base data for ${config.SYMBOL}...`);
    const klines1m_all = await fetchKlines(config.SYMBOL, '1m', config.FETCH_START_TIME, config.END_TIME);
    
    console.log("Aggregating timeframes (3m, 5m, 10m, 15m, 1h, 12h, 1d)...");
    const klines3m_all = aggregateKlines(klines1m_all, 3);
    const klines5m_all = aggregateKlines(klines1m_all, 5);
    const klines10m_all = aggregateKlines(klines1m_all, 10);
    const klines15m_all = aggregateKlines(klines1m_all, 15);
    const klines1h_all = aggregateKlines(klines1m_all, 60);
    const klines12h_all = aggregateKlines(klines1m_all, 720);
    const klines1d_all = aggregateKlines(klines1m_all, 1440);

    // 2. Pre-calculate Indicators
    console.log("Calculating indicators...");
    const indicators = indicators_logic({
        m1: klines1m_all,
        m3: klines3m_all,
        m5: klines5m_all,
        h1: klines1h_all,
        h12: klines12h_all,
        d1: klines1d_all
    }) || {};

    // [New] 매매전략(indicators_logic)에 포함되지 않더라도 UI에 표기된 5m, 1h, 1d 지표를 무조건 보장 (강제 계산 및 보충)
    const intervalsToVerify = [
        { key: 'm5', klines: klines5m_all },
        { key: 'h1', klines: klines1h_all },
        { key: 'd1', klines: klines1d_all }
    ];

    intervalsToVerify.forEach(itv => {
        if (!indicators[itv.key]) {
            indicators[itv.key] = {};
        }
        const target = indicators[itv.key];
        const closes = itv.klines.map(k => k.close);

        // 1. MACD 보장
        if (!target.macd || !target.macd.m || !target.macd.s) {
            target.macd = calculateMACD(closes);
        }
        // 2. RSI 보장
        if (!target.rsi) {
            target.rsi = calculateRSI(closes);
        }
        // 3. StochRSI 보장
        if (!target.stoch || !target.stoch.k || !target.stoch.d) {
            target.stoch = calculateStochRSI(target.rsi || calculateRSI(closes));
        }
        // 4. ADX 보장
        if (!target.adx) {
            target.adx = calculateADX(itv.klines);
        }
        // 5. BBW 보장
        if (!target.bbw) {
            target.bbw = calculateBBW(closes);
        }
        // 6. BBWP 보장
        if (!target.bbwp) {
            target.bbwp = calculateBBWP(target.bbw);
        }
        // 7. BBW ROC 보장
        if (!target.bbw_roc) {
            target.bbw_roc = calculateROC(target.bbw);
        }
    });

    // 3. State Setup & Optimization Mapping
    for (let idx = 0; idx < klines1m_all.length; idx++) {
        klines1m_all[idx].allIdx = idx;
    }

    const map1mTo3mIdx = new Int32Array(klines1m_all.length);
    const map1mTo5mIdx = new Int32Array(klines1m_all.length);
    const map1mTo10mIdx = new Int32Array(klines1m_all.length);
    const map1mTo15mIdx = new Int32Array(klines1m_all.length);
    const map1mTo1hIdx = new Int32Array(klines1m_all.length);
    const map1mTo12hIdx = new Int32Array(klines1m_all.length);
    const map1mTo1dIdx = new Int32Array(klines1m_all.length);

    let cur3m = 0, cur5m = 0, cur10m = 0, cur15m = 0, cur1h = 0, cur12h = 0, cur1d = 0;
    for (let idx = 0; idx < klines1m_all.length; idx++) {
        const t = klines1m_all[idx].time;
        const targetTime = t + 60000;
        
        while (cur3m + 1 < klines3m_all.length && klines3m_all[cur3m + 1].time + 180000 <= targetTime) {
            cur3m++;
        }
        while (cur5m + 1 < klines5m_all.length && klines5m_all[cur5m + 1].time + 300000 <= targetTime) {
            cur5m++;
        }
        while (cur10m + 1 < klines10m_all.length && klines10m_all[cur10m + 1].time + 600000 <= targetTime) {
            cur10m++;
        }
        while (cur15m + 1 < klines15m_all.length && klines15m_all[cur15m + 1].time + 900000 <= targetTime) {
            cur15m++;
        }
        while (cur1h + 1 < klines1h_all.length && klines1h_all[cur1h + 1].time + 3600000 <= targetTime) {
            cur1h++;
        }
        while (cur12h + 1 < klines12h_all.length && klines12h_all[cur12h + 1].time + (12 * 3600000) <= targetTime) {
            cur12h++;
        }
        while (cur1d + 1 < klines1d_all.length && klines1d_all[cur1d + 1].time + 86400000 <= targetTime) {
            cur1d++;
        }

        map1mTo3mIdx[idx] = cur3m;
        map1mTo5mIdx[idx] = cur5m;
        map1mTo10mIdx[idx] = cur10m;
        map1mTo15mIdx[idx] = cur15m;
        map1mTo1hIdx[idx] = cur1h;
        map1mTo12hIdx[idx] = cur12h;
        map1mTo1dIdx[idx] = cur1d;
    }

    const klines1m = klines1m_all.filter(k => k.time >= config.ACTUAL_START_TIME);
    const initialBalance = config.INITIAL_BALANCE;
    let balance = initialBalance;
    let maxBalance = initialBalance;
    let mdd = 0;
    let wins = 0, losses = 0;
    let mismatchCount = 0;
    const trades = [];
    const signalRows = [];

    // Metadata block to prepend to CSV files
    const metadataLines = [
        `# === BACKTEST METADATA ===`,
        `# Version: ${name || 'Unknown'}`,
        `# Symbol: ${config.SYMBOL || 'Unknown'}`,
        `# Period: ${config.ACTUAL_START_TIME ? toKSTString(config.ACTUAL_START_TIME) : 'Unknown'} ~ ${config.END_TIME ? toKSTString(config.END_TIME) : 'Unknown'}`,
        `# Leverage: ${config.LEVERAGE || 1}x`,
        `# Initial Balance: ${config.INITIAL_BALANCE || 1000}`,
        `# Target ROI: ${config.TARGET_NET_ROI !== undefined ? (config.TARGET_NET_ROI * 100).toFixed(2) + '%' : 'Default'}`,
        `# Stop Loss: ${config.SL_ROI !== undefined ? (config.SL_ROI * 100).toFixed(2) + '%' : 'Default'}`,
        `# Entry Wait: ${config.ENTRY_WAIT_MIN || 'Default'} min`,
        `# Exit Wait: ${config.EXIT_WAIT_MIN || 'Default'} min`,
        `# Rules:`,
        ...formatRulesToText(config.overrideRules).split('\n').map(line => `#   ${line}`),
        `# =========================`,
        ``
    ];

    // Header (Professional Mode)
    const output = [
        ...metadataLines,
        "entryTime,exitTime,balance,cumRoi,side,entryBasis,entryPrice,exitPrice,netProfit,roe,quantity,fee,fundingFee,m3_stochK,m3_stochD,m3_adx,m5_stochK,m5_stochD,m5_adx,m5_rsi,m5_macd,m5_macdSig,h1_macd,h1_macdSig,h1_stochK,h1_stochD,h1_adx,h1_rsi,h12_macd,h12_macdSig,h12_stochK,h12_stochD,h12_adx,d1_macd,d1_macdSig,d1_stochK,d1_stochD,d1_adx,d1_rsi,m5_bbw,m5_bbwp,h1_bbw,h1_bbwp,d1_bbw,d1_bbwp,m5_bbw_roc,h1_bbw_roc,d1_bbw_roc"
    ];

    // [New] 통합 검증 리포트용 헤더 (방향, 진입가 포함)
    const fullValidationRows = [
        ...metadataLines,
        "Trade#,Side,Status,Time,Open,High,Low,Close,EntryBasis,EntryPrice,TargetTP,TargetSL,M5_StochK,M5_StochD,M5_ADX,M5_RSI,M5_MACD,M5_MACDSig,Conf_H1_MACD,Conf_H1_Sig,Conf_H1_StochK,Conf_H1_StochD,Conf_H1_RSI,H1_MACD,H1_MACDSig,H1_StochK,H1_StochD,H1_ADX,H1_RSI,D1_MACD,D1_MACDSig,D1_StochK,D1_StochD,D1_ADX,D1_RSI,M5_BBW,M5_BBWP,H1_BBW,H1_BBWP,D1_BBW,D1_BBWP,M5_BBW_ROC,H1_BBW_ROC,D1_BBW_ROC"
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

        // 상위 봉 인덱스 계산 (Pre-calculated Map Lookup)
        const refAllIdx = klines1m[i - 1].allIdx;
        const idx3m = map1mTo3mIdx[refAllIdx];
        const idx5m = map1mTo5mIdx[refAllIdx];
        const idx10m = map1mTo10mIdx[refAllIdx];
        const idx15m = map1mTo15mIdx[refAllIdx];
        const r1h = map1mTo1hIdx[refAllIdx];
        const r12h = map1mTo12hIdx[refAllIdx];
        const r1d = map1mTo1dIdx[refAllIdx];

        if (idx3m < 0 && idx5m < 0) continue; // 최소한 하나의 소분봉 데이터는 있어야 함
        if (r1h < 0 || (r1d < 0 && r12h < 0)) continue;

        // [핵심] 대시보드 설정을 overrideRules로 전달하여 동적 신호 판단
        const signal = signal_logic(indicators, { idx3m, idx5m, r1h, r12h, r1d, idx1m: i - 1 }, config.overrideRules);
        if (signal === 'hold') continue;

        // 전략 요구 사항에 맞는 기준봉 전달
        const k_confirmed = (indicators.m3 ? klines3m_all[idx3m] : klines5m_all[idx5m]);
        const entryResult = entry_logic(signal, k1m, k_confirmed, klines1m, i, config, {
            idx3m, idx5m, idx10m, idx15m,
            klines3m: klines3m_all,
            klines5m: klines5m_all,
            klines10m: klines10m_all,
            klines15m: klines15m_all
        });
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
        let tpPrice = side === 'LONG' ? entryPrice * (1 + grossTP / config.LEVERAGE) : entryPrice * (1 - grossTP / config.LEVERAGE);
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

            // [DYNAMIC TARGET ROI REDUCTION] 진입 후 일정 시간 지나면 목표수익률 감소
            const reduceTpWaitMin = Number(config.reduceTpWaitMin || 0);
            if (reduceTpWaitMin > 0 && duration >= reduceTpWaitMin) {
                const reducedTargetRoi = Number(config.reducedTargetRoi !== undefined ? config.reducedTargetRoi : 0.01);
                const grossReducedTP = reducedTargetRoi + totalFeesRate;
                tpPrice = side === 'LONG'
                    ? entryPrice * (1 + grossReducedTP / config.LEVERAGE)
                    : entryPrice * (1 - grossReducedTP / config.LEVERAGE);
            }

            const penetrationRate = config.PENETRATION_RATE !== undefined ? parseFloat(config.PENETRATION_RATE) : 0.0;
            if (!exitReason) {
                if (side === 'LONG') {
                    if (lk.high >= tpPrice * (1 + penetrationRate)) { exitReason = 'TP'; exitPrice = tpPrice; }
                    else if (lk.low <= slPrice) { exitReason = 'SL'; exitPrice = slPrice; }
                } else {
                    if (lk.low <= tpPrice * (1 - penetrationRate)) { exitReason = 'TP'; exitPrice = tpPrice; }
                    else if (lk.high >= slPrice) { exitReason = 'SL'; exitPrice = slPrice; }
                }
            }

            if (exitReason) {
                // 수량(Quantity) 계산: 진입 시점 잔고 * 레버리지 / 진입가
                const qty = (balance * config.LEVERAGE) / entryPrice;
                const feeRate = (exitReason === 'TP' || exitReason === 'TIMEOUT') ? (config.MAKER_FEE_RATE + config.EXIT_MAKER_FEE_RATE) : (config.MAKER_FEE_RATE + config.TAKER_FEE_RATE);

                let finalNetRoi = 0;
                if (exitReason === 'TP') {
                    const reduceTpWaitMin = Number(config.reduceTpWaitMin || 0);
                    if (reduceTpWaitMin > 0 && duration >= reduceTpWaitMin) {
                        finalNetRoi = Number(config.reducedTargetRoi !== undefined ? config.reducedTargetRoi : 0.01);
                    } else {
                        finalNetRoi = config.TARGET_NET_ROI;
                    }
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

                // MDD (Maximum Drawdown) 계산
                if (balance > maxBalance) {
                    maxBalance = balance;
                }
                const currentDrawdown = ((maxBalance - balance) / maxBalance) * 100;
                if (currentDrawdown > mdd) {
                    mdd = currentDrawdown;
                }

                const cumRoi = ((balance / initialBalance - 1) * 100).toFixed(2);
                const exitTimeKST = toKSTString(lk.time);

                // [FIX] 요약 리포트의 지표 기록 시점을 진입 시점에서 '시그널 발생 시점(Signal Time)'으로 변경하여 일치시킴
                const finalIdx3m = idx3m;
                const finalIdx5m = idx5m;
                const finalR1h = r1h;
                const finalR12h = r12h;
                const finalR1d = r1d;

                const m3k = indicators.m3?.stoch?.k?.[finalIdx3m]?.toFixed(1) || '-';
                const m3d = indicators.m3?.stoch?.d?.[finalIdx3m]?.toFixed(1) || '-';
                const m3adx = indicators.m3?.adx?.[finalIdx3m]?.toFixed(1) || '-';
                const m5k = indicators.m5?.stoch?.k?.[finalIdx5m]?.toFixed(1) || '-';
                const m5d = indicators.m5?.stoch?.d?.[finalIdx5m]?.toFixed(1) || '-';
                const m5adx = indicators.m5?.adx?.[finalIdx5m]?.toFixed(1) || '-';
                const m5rsi = indicators.m5?.rsi?.[finalIdx5m]?.toFixed(1) || '-';
                const m5m = indicators.m5?.macd?.m?.[finalIdx5m]?.toFixed(2) || '-';
                const m5s = indicators.m5?.macd?.s?.[finalIdx5m]?.toFixed(2) || '-';
                const h1m = indicators.h1?.macd?.m?.[finalR1h]?.toFixed(2) || '-';
                const h1s = indicators.h1?.macd?.s?.[finalR1h]?.toFixed(2) || '-';
                const h1k = indicators.h1?.stoch?.k?.[finalR1h]?.toFixed(1) || '-';
                const h1d = indicators.h1?.stoch?.d?.[finalR1h]?.toFixed(1) || '-';
                const h1adx = indicators.h1?.adx?.[finalR1h]?.toFixed(1) || '-';
                const h1rsi = indicators.h1?.rsi?.[finalR1h]?.toFixed(1) || '-';

                const h12m = indicators.h12?.macd?.m?.[finalR12h]?.toFixed(2) || '-';
                const h12s = indicators.h12?.macd?.s?.[finalR12h]?.toFixed(2) || '-';
                const h12k = indicators.h12?.stoch?.k?.[finalR12h]?.toFixed(1) || '-';
                const h12d = indicators.h12?.stoch?.d?.[finalR12h]?.toFixed(1) || '-';
                const h12adx = indicators.h12?.adx?.[finalR12h]?.toFixed(1) || '-';
                const d1rsi = indicators.d1?.rsi?.[finalR1d]?.toFixed(1) || '-';

                const tradeData = {
                    entryTime: entryTimeKST,
                    exitTime: exitTimeKST,
                    side,
                    entryPrice,
                    exitPrice,
                    tpPrice,
                    slPrice,
                    exitReason,
                    entryBasis: entryResult.entryBasis || entryResult.entryType || '-',
                    quantity: qty.toFixed(4),
                    fee: totalFee.toFixed(2),
                    fundingFee: fundingFee.toFixed(2),
                    netProfit: prof.toFixed(2),
                    balance: balance.toFixed(2),
                    roe: `${(finalNetRoi * 100).toFixed(2)}%`,
                    m5_stochK: m5k, m5_stochD: m5d, m5_adx: m5adx, m5_rsi: m5rsi, m5_macd: m5m, m5_macdSig: m5s,
                    h1_macd: h1m, h1_macdSig: h1s, h1_stochK: h1k, h1_stochD: h1d, h1_adx: h1adx, h1_rsi: h1rsi,
                    h12_macd: h12m, h12_macdSig: h12s, h12_stochK: h12k, h12_stochD: h12d, h12_adx: h12adx,
                    d1_macd: indicators.d1?.macd?.m?.[finalR1d]?.toFixed(2) || '-',
                    d1_macdSig: indicators.d1?.macd?.s?.[finalR1d]?.toFixed(2) || '-',
                    d1_stochK: indicators.d1?.stoch?.k?.[finalR1d]?.toFixed(1) || '-',
                    d1_stochD: indicators.d1?.stoch?.d?.[finalR1d]?.toFixed(1) || '-',
                    d1_adx: indicators.d1?.adx?.[finalR1d]?.toFixed(1) || '-',
                    d1_rsi: d1rsi,
                    m5_bbw: indicators.m5?.bbw?.[finalIdx5m]?.toFixed(4) || '-',
                    m5_bbwp: indicators.m5?.bbwp?.[finalIdx5m]?.toFixed(1) || '-',
                    h1_bbw: indicators.h1?.bbw?.[finalR1h]?.toFixed(4) || '-',
                    h1_bbwp: indicators.h1?.bbwp?.[finalR1h]?.toFixed(1) || '-',
                    d1_bbw: indicators.d1?.bbw?.[finalR1d]?.toFixed(4) || '-',
                    d1_bbwp: indicators.d1?.bbwp?.[finalR1d]?.toFixed(1) || '-',
                    m5_bbw_roc: indicators.m5?.bbw_roc?.[finalIdx5m]?.toFixed(1) || '-',
                    h1_bbw_roc: indicators.h1?.bbw_roc?.[finalR1h]?.toFixed(1) || '-',
                    d1_bbw_roc: indicators.d1?.bbw_roc?.[finalR1d]?.toFixed(1) || '-',
                    mismatch: mismatchWarnings.join(' | ')
                };
                trades.push(tradeData);

                // 시그널 발생 분봉 지표값 계산 및 결과 기록용 행 추가 (배열 맞춤)
                const sigTimeKST = toKSTString(klines1m[i].time);
                const sigIdx3m = idx3m;
                const sigIdx5m = idx5m;
                const sigR1h = r1h;
                const sigR12h = r12h;
                const sigR1d = r1d;

                const sm3k = indicators.m3?.stoch?.k?.[sigIdx3m]?.toFixed(1) || '-';
                const sm3d = indicators.m3?.stoch?.d?.[sigIdx3m]?.toFixed(1) || '-';
                const sm3adx = indicators.m3?.adx?.[sigIdx3m]?.toFixed(1) || '-';

                const sm5k = indicators.m5?.stoch?.k?.[sigIdx5m]?.toFixed(1) || '-';
                const sm5d = indicators.m5?.stoch?.d?.[sigIdx5m]?.toFixed(1) || '-';
                const sm5adx = indicators.m5?.adx?.[sigIdx5m]?.toFixed(1) || '-';
                const sm5rsi = indicators.m5?.rsi?.[sigIdx5m]?.toFixed(1) || '-';
                const sm5m = indicators.m5?.macd?.m?.[sigIdx5m]?.toFixed(2) || '-';
                const sm5s = indicators.m5?.macd?.s?.[sigIdx5m]?.toFixed(2) || '-';

                const sh1m = indicators.h1?.macd?.m?.[sigR1h]?.toFixed(2) || '-';
                const sh1s = indicators.h1?.macd?.s?.[sigR1h]?.toFixed(2) || '-';
                const sh1k = indicators.h1?.stoch?.k?.[sigR1h]?.toFixed(1) || '-';
                const sh1d = indicators.h1?.stoch?.d?.[sigR1h]?.toFixed(1) || '-';
                const sh1adx = indicators.h1?.adx?.[sigR1h]?.toFixed(1) || '-';
                const sh1rsi = indicators.h1?.rsi?.[sigR1h]?.toFixed(1) || '-';

                const sh12m = indicators.h12?.macd?.m?.[sigR12h]?.toFixed(2) || '-';
                const sh12s = indicators.h12?.macd?.s?.[sigR12h]?.toFixed(2) || '-';
                const sh12k = indicators.h12?.stoch?.k?.[sigR12h]?.toFixed(1) || '-';
                const sh12d = indicators.h12?.stoch?.d?.[sigR12h]?.toFixed(1) || '-';
                const sh12adx = indicators.h12?.adx?.[sigR12h]?.toFixed(1) || '-';

                const sd1m = indicators.d1?.macd?.m?.[sigR1d]?.toFixed(2) || '-';
                const sd1s = indicators.d1?.macd?.s?.[sigR1d]?.toFixed(2) || '-';
                const sd1k = indicators.d1?.stoch?.k?.[sigR1d]?.toFixed(1) || '-';
                const sd1d = indicators.d1?.stoch?.d?.[sigR1d]?.toFixed(1) || '-';
                const sd1adx = indicators.d1?.adx?.[sigR1d]?.toFixed(1) || '-';
                const sd1rsi = indicators.d1?.rsi?.[sigR1d]?.toFixed(1) || '-';

                const sm5bbw = indicators.m5?.bbw?.[sigIdx5m]?.toFixed(4) || '-';
                const sm5bbwp = indicators.m5?.bbwp?.[sigIdx5m]?.toFixed(1) || '-';
                const sh1bbw = indicators.h1?.bbw?.[sigR1h]?.toFixed(4) || '-';
                const sh1bbwp = indicators.h1?.bbwp?.[sigR1h]?.toFixed(1) || '-';
                const sd1bbw = indicators.d1?.bbw?.[sigR1d]?.toFixed(4) || '-';
                const sd1bbwp = indicators.d1?.bbwp?.[sigR1d]?.toFixed(1) || '-';

                const sm5bbwroc = indicators.m5?.bbw_roc?.[sigIdx5m]?.toFixed(1) || '-';
                const sh1bbwroc = indicators.h1?.bbw_roc?.[sigR1h]?.toFixed(1) || '-';
                const sd1bbwroc = indicators.d1?.bbw_roc?.[sigR1d]?.toFixed(1) || '-';

                const vk = klines1m[i];
                signalRows.push([
                    sigTimeKST,                  // 1. entryTime
                    '',                          // 2. exitTime
                    `SIGNAL_T${trades.length}`,  // 3. balance
                    '',                          // 4. cumRoi
                    side,                        // 5. side
                    vk.open,                     // 6. entryBasis (시가)
                    vk.high,                     // 7. entryPrice (고가)
                    vk.low,                      // 8. exitPrice (저가)
                    vk.close,                    // 9. netProfit (종가)
                    tradeData.roe,               // 10. roe
                    '',                          // 11. quantity
                    '',                          // 12. fee
                    '',                          // 13. fundingFee
                    sm3k, sm3d, sm3adx,          // 14~16. m3 지표
                    sm5k, sm5d, sm5adx, sm5rsi, sm5m, sm5s, // 17~22. m5 지표
                    sh1m, sh1s, sh1k, sh1d, sh1adx, sh1rsi, // 23~28. h1 지표
                    sh12m, sh12s, sh12k, sh12d, sh12adx,    // 29~33. h12 지표
                    sd1m, sd1s, sd1k, sd1d, sd1adx, sd1rsi, // 34~39. d1 지표
                    sm5bbw, sm5bbwp, sh1bbw, sh1bbwp, sd1bbw, sd1bbwp, // 40~45. bbw, bbwp 지표
                    sm5bbwroc, sh1bbwroc, sd1bbwroc // 46~48. bbw_roc 지표
                ].join(','));

                // [VALIDATION] 전체 매매 사이클 기록 (Signal 감지 30분 전 ~ 청산 완료 시점)
                try {
                    const signalTimeIdx = i; // 신호 발생 시점
                    const valStartTimeIdx = Math.max(0, signalTimeIdx - 30);
                    const valEndTimeIdx = j; // 청산 완료 시점
                    const tradeNum = trades.length;

                    for (let vIdx = valStartTimeIdx; vIdx <= valEndTimeIdx; vIdx++) {
                        const vk = klines1m[vIdx];
                        const vkAllIdx = vk.allIdx;
                        const vIdx5m = map1mTo5mIdx[vkAllIdx];
                        const vR1h = map1mTo1hIdx[vkAllIdx];
                        const vR1d = map1mTo1dIdx[vkAllIdx];

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
                            toKSTString(vk.time),
                            vk.open, vk.high, vk.low, vk.close,
                            tradeData.entryBasis || '-',
                            tradeData.entryPrice || '-',
                            tradeData.tpPrice ? tradeData.tpPrice.toFixed(2) : '-',
                            tradeData.slPrice ? tradeData.slPrice.toFixed(2) : '-',
                            // M5 실시간 데이터
                            indicators.m5?.stoch?.k?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.stoch?.d?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.adx?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.rsi?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.m5?.macd?.m?.[vIdx5m]?.toFixed(2) || '-',
                            indicators.m5?.macd?.s?.[vIdx5m]?.toFixed(2) || '-',
                            // [New] 확정 데이터 (판단 근거) -> M5 뒤로 이동
                            indicators.h1?.macd?.m?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.macd?.s?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.stoch?.k?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.stoch?.d?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.rsi?.[vR1h]?.toFixed(1) || '-',
                            // H1 실시간 데이터
                            indicators.h1?.macd?.m?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.macd?.s?.[vR1h]?.toFixed(2) || '-',
                            indicators.h1?.stoch?.k?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.stoch?.d?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.adx?.[vR1h]?.toFixed(1) || '-',
                            indicators.h1?.rsi?.[vR1h]?.toFixed(1) || '-',
                            indicators.d1?.macd?.m?.[vR1d]?.toFixed(2) || indicators.d1?.macd?.m?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(2) || '-',
                            indicators.d1?.macd?.s?.[vR1d]?.toFixed(2) || indicators.d1?.macd?.s?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(2) || '-',
                            indicators.d1?.stoch?.k?.[vR1d]?.toFixed(1) || indicators.d1?.stoch?.k?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            indicators.d1?.stoch?.d?.[vR1d]?.toFixed(1) || indicators.d1?.stoch?.d?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            indicators.d1?.adx?.[vR1d]?.toFixed(1) || indicators.d1?.adx?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            indicators.d1?.rsi?.[vR1d]?.toFixed(1) || indicators.d1?.rsi?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            // BBW, BBWP 실시간 데이터 추가
                            indicators.m5?.bbw?.[vIdx5m]?.toFixed(4) || '-',
                            indicators.m5?.bbwp?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.h1?.bbw?.[vR1h]?.toFixed(4) || '-',
                            indicators.h1?.bbwp?.[vR1h]?.toFixed(1) || '-',
                            indicators.d1?.bbw?.[vR1d]?.toFixed(4) || indicators.d1?.bbw?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(4) || '-',
                            indicators.d1?.bbwp?.[vR1d]?.toFixed(1) || indicators.d1?.bbwp?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-',
                            // BBW ROC 실시간 데이터 추가
                            indicators.m5?.bbw_roc?.[vIdx5m]?.toFixed(1) || '-',
                            indicators.h1?.bbw_roc?.[vR1h]?.toFixed(1) || '-',
                            indicators.d1?.bbw_roc?.[vR1d]?.toFixed(1) || indicators.d1?.bbw_roc?.slice(0, vR1d).reverse().find(v => v !== null)?.toFixed(1) || '-'
                        ].join(','));
                    }
                    fullValidationRows.push(""); // 거래 간 구분선
                } catch (vErr) {
                    console.warn(`[VALIDATION ERROR] T${trades.length}: ${vErr.message}`);
                }


                // CSV 출력 컬럼 순서 연동
                output.push([
                    entryTimeKST,               // 1. entryTime
                    exitTimeKST,                // 2. exitTime
                    balance.toFixed(2),         // 3. balance
                    `${cumRoi}%`,               // 4. cumRoi
                    side,                       // 5. side
                    tradeData.entryBasis,       // 6. entryBasis
                    entryPrice,                 // 7. entryPrice
                    exitPrice,                  // 8. exitPrice
                    prof.toFixed(2),            // 9. netProfit
                    tradeData.roe,              // 10. roe
                    qty.toFixed(4),             // 11. quantity
                    totalFee.toFixed(2),        // 12. fee
                    fundingFee.toFixed(2),      // 13. fundingFee
                    m3k, m3d, m3adx,            // 14~16. m3 지표
                    m5k, m5d, m5adx, m5rsi, m5m, m5s, // 17~22. m5 지표
                    h1m, h1s, h1k, h1d, h1adx, h1rsi, // 23~28. h1 지표
                    h12m, h12s, h12k, h12d, h12adx,   // 29~33. h12 지표
                    tradeData.d1_macd, tradeData.d1_macdSig, tradeData.d1_stochK, tradeData.d1_stochD, tradeData.d1_adx, tradeData.d1_rsi, // 34~39. d1 지표
                    tradeData.m5_bbw, tradeData.m5_bbwp,
                    tradeData.h1_bbw, tradeData.h1_bbwp,
                    tradeData.d1_bbw, tradeData.d1_bbwp,
                    tradeData.m5_bbw_roc, tradeData.h1_bbw_roc, tradeData.d1_bbw_roc
                ].join(','));

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



    const startStr = config.ACTUAL_START_TIME ? formatYYMMDD(config.ACTUAL_START_TIME) : 'unknown';
    const endStr = config.END_TIME ? formatYYMMDD(config.END_TIME) : 'unknown';

    // 종합수익률(ROI), 승률(Win Rate), MDD 포맷팅 (정수로 반올림)
    const roiRounded = Math.round((balance / initialBalance - 1) * 100);

    const totalTrades = wins + losses;
    const winRateRounded = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    const mddRounded = Math.round(mdd);

    const resDir = path.join('c:/dev/2026_candy/results');
    if (!fs.existsSync(resDir)) fs.mkdirSync(resDir);

    // 중복 방지를 위한 1, 2, 3, 4 순서의 일련번호 검사 로직
    let counter = 1;
    let fPath = '';
    let valFilePath = '';
    while (true) {
        const fileSuffix = `${startStr}_${endStr}_${roiRounded}_${winRateRounded}_${mddRounded}_${counter}`;
        const tempFPath = path.join(resDir, `result_${name.replace(/\s+/g, '_')}_${fileSuffix}.csv`);
        const tempValFilePath = path.join(resDir, `validation_FULL_${name.replace(/\s+/g, '_')}_${fileSuffix}.csv`);
        
        if (!fs.existsSync(tempFPath) && !fs.existsSync(tempValFilePath)) {
            fPath = tempFPath;
            valFilePath = tempValFilePath;
            break;
        }
        counter++;
    }

    fs.writeFileSync(fPath, '\ufeff' + output.join('\n'), 'utf8');

    // 통합 검증 리포트 저장
    fs.writeFileSync(valFilePath, '\ufeff' + fullValidationRows.join('\n'), 'utf8');

    return {
        roi: ((balance / initialBalance - 1) * 100).toFixed(2),
        wins, losses,
        finalBalance: balance,
        mdd: mdd.toFixed(2),
        trades,
        mismatchCount,
        detailFile: fPath,
        validationFile: valFilePath // 통합 검증 파일 경로 반환
    };
}

module.exports = { runBacktest };
