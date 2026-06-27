const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX, calculateBBW, calculateBBWP, calculateROC, calculateSlope } = require('../lib/indicators.cjs');

console.log(`[LOADED] Logic.v8.2.5.cjs loaded at ${new Date().toISOString()}`);

const strategy = {
    name: 'Logic.v8.2.5',
    description: 'v8.2.5 (MA Slope, ROC & Switching/Sizing Filters)',
    header: "Entry_Time,Exit_Time,Balance,Cum_ROI,Side,Entry_Price,Exit_Price,Net_Profit,ROE,Quantity,Fee,FundingFee,M3_StochK,M3_StochD,M3_ADX,M5_StochK,M5_StochD,M5_ADX,M5_RSI,M5_MACD,M5_MACDSig,M5_BBW,M5_BBWP,M5_BBW_ROC,M5_MA_Slope,M5_MA_ROC,H1_MACD,H1_MACDSig,H1_StochK,H1_StochD,H1_ADX,H1_RSI,H1_BBW,H1_BBWP,H1_BBW_ROC,H1_MA_Slope,H1_MA_ROC,H12_MACD,H12_MACDSig,H12_StochK,H12_StochD,H12_ADX,D1_MACD,D1_MACDSig,D1_StochK,D1_StochD,D1_ADX,D1_RSI,D1_BBW,D1_BBWP,D1_BBW_ROC,D1_MA_Slope,D1_MA_ROC",

    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-01-01T00:00:00+09:00').getTime(),
        ACTUAL_START_TIME: new Date('2025-01-01T00:00:00+09:00').getTime(),
        END_TIME: new Date('2026-12-31T23:59:59+09:00').getTime(),

        LEVERAGE: 5,
        INITIAL_BALANCE: 1000,
        MAKER_FEE_RATE: 0.0002,
        TAKER_FEE_RATE: 0.0005,
        EXIT_MAKER_FEE_RATE: 0.0002,
        FUNDING_FEE_RATE: 0.0001,

        TARGET_NET_ROI: 0.05,
        SL_ROI: 0.14,

        ENTRY_WAIT_MIN: 180,
        EXIT_WAIT_MIN: 1500,

        PENETRATION_RATE: 0.001,
        ENTRY_MODE: 'HYBRID_5M'
    },

    indicators_logic: (klines, overrideRules) => {
        const m5Closes = klines.m5.map(k => k.close);
        const h1Closes = klines.h1.map(k => k.close);
        const d1Closes = klines.d1.map(k => k.close);

        const m5Bbw = calculateBBW(m5Closes);
        const h1Bbw = calculateBBW(h1Closes);
        const d1Bbw = calculateBBW(d1Closes);

        const m5Ma = calculateSMA(m5Closes, 20);
        const h1Ma = calculateSMA(h1Closes, 20);
        const d1Ma = calculateSMA(d1Closes, 20);

        const res = {
            m5: {
                macd: calculateMACD(m5Closes),
                rsi: calculateRSI(m5Closes),
                stoch: calculateStochRSI(calculateRSI(m5Closes)),
                adx: calculateADX(klines.m5),
                bbw: m5Bbw,
                bbwp: calculateBBWP(m5Bbw),
                bbw_roc: calculateROC(m5Bbw),
                ma: m5Ma,
                ma_slope: calculateSlope(m5Ma),
                ma_roc: calculateROC(m5Ma)
            },
            h1: {
                macd: calculateMACD(h1Closes),
                rsi: calculateRSI(h1Closes),
                stoch: calculateStochRSI(calculateRSI(h1Closes)),
                adx: calculateADX(klines.h1),
                bbw: h1Bbw,
                bbwp: calculateBBWP(h1Bbw),
                bbw_roc: calculateROC(h1Bbw),
                ma: h1Ma,
                ma_slope: calculateSlope(h1Ma),
                ma_roc: calculateROC(h1Ma)
            },
            d1: {
                macd: calculateMACD(d1Closes),
                rsi: calculateRSI(d1Closes),
                stoch: calculateStochRSI(calculateRSI(d1Closes)),
                adx: calculateADX(klines.d1),
                bbw: d1Bbw,
                bbwp: calculateBBWP(d1Bbw),
                bbw_roc: calculateROC(d1Bbw),
                ma: d1Ma,
                ma_slope: calculateSlope(d1Ma),
                ma_roc: calculateROC(d1Ma)
            }
        };

        // 1분봉(m1)에 대한 동적 MA 지표 사전 계산 및 캐싱
        if (klines.m1) {
            res.m1 = {};
            const closesM1 = klines.m1.map(k => k.close);
            const m1Periods = new Set([20]); // 기본 20 보장
            if (overrideRules) {
                ['long', 'short'].forEach(side => {
                    ['5m', '1h', '1d'].forEach(tf => {
                        const r = overrideRules[side]?.[tf];
                        if (r) {
                            if (r.maSlopePeriod !== undefined) {
                                const p = parseInt(r.maSlopePeriod);
                                if (p > 0) m1Periods.add(p);
                            }
                            if (r.maRocPeriod !== undefined) {
                                const p = parseInt(r.maRocPeriod);
                                if (p > 0) m1Periods.add(p);
                            }
                        }
                    });
                });
            }

            m1Periods.forEach(p => {
                const maKey = `ma_${p}`;
                const slopeKey = `ma_slope_${p}`;
                const rocKey = `ma_roc_${p}`;

                res.m1[maKey] = calculateSMA(closesM1, p);
                res.m1[slopeKey] = calculateSlope(res.m1[maKey]);
                res.m1[rocKey] = calculateROC(res.m1[maKey]);

                if (p === 20) {
                    res.m1.ma = res.m1[maKey];
                    res.m1.ma_slope = res.m1[slopeKey];
                    res.m1.ma_roc = res.m1[rocKey];
                }
            });
        }

        return res;
    },

    signal_logic: (indicators, indices, overrideRules) => {
        const { idx5m, r1h, r1d, idx1m } = indices;

        let isExtremeLong = false;
        let isExtremeShort = false;

        const checkCondition = (side, interval, idx, indicatorsObj, idx1mVal) => {
            const data = indicatorsObj[interval];
            if (!data) return true;

            const timeframeMap = { 'm5': '5m', 'h1': '1h', 'd1': '1d' };
            const uiInterval = timeframeMap[interval] || interval;

            let rules = null;
            if (overrideRules) {
                if (overrideRules[side] && overrideRules[side][uiInterval]) {
                    rules = overrideRules[side][uiInterval];
                } else if (overrideRules[uiInterval] && overrideRules[uiInterval][side]) {
                    rules = overrideRules[uiInterval][side];
                } else if (overrideRules[uiInterval]) {
                    rules = overrideRules[uiInterval];
                } else if (overrideRules[side] && overrideRules[side][interval]) {
                    rules = overrideRules[side][interval];
                }
            }

            const chk = (key) => {
                if (!rules) return false;
                const variations = [
                    key, key.toLowerCase(), key.toUpperCase(),
                    'use' + key, 'use' + key.toLowerCase(),
                    key.replace(/^use/, ''), key.replace(/^use/, '').toLowerCase()
                ];
                for (const k of variations) {
                    if (rules[k] !== undefined) {
                        const v = rules[k];
                        return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
                    }
                }
                return false;
            };

            let match = true;
            let logDetail = `[${interval.toUpperCase()}] `;

            // 1. If NO rules provided (Fallback)
            if (!rules) {
                if (side === 'long') {
                    if (interval === 'm5') return data.adx[idx] >= 30 && data.stoch.k[idx] > data.stoch.d[idx];
                    if (interval === 'h1') return data.macd.m[idx] > data.macd.s[idx] && data.stoch.k[idx] > data.stoch.d[idx];
                    if (interval === 'd1') return data.macd.m[idx] > data.macd.s[idx];
                } else {
                    if (interval === 'm5') return data.adx[idx] >= 30 && data.stoch.k[idx] < data.stoch.d[idx];
                    if (interval === 'h1') return data.macd.m[idx] < data.macd.s[idx] && data.stoch.k[idx] < data.stoch.d[idx];
                    if (interval === 'd1') return data.macd.m[idx] < data.macd.s[idx];
                }
                return true;
            }

            // 2. ADX Filter
            if (chk('adxEnabled') || chk('useADX')) {
                const low = rules.adxLow !== undefined ? parseFloat(rules.adxLow) : 30;
                const high = rules.adxHigh !== undefined ? parseFloat(rules.adxHigh) : 99;
                const val = data.adx[idx];
                logDetail += `ADX:${val.toFixed(1)} (${low}~${high}) `;
                if (val < low || val > high) match = false;
            }

            // 3. MACD Cross
            if ((chk('macdCrossEnabled') || chk('useMacdBeyondSig') || chk('useMacdCross')) && data.macd) {
                const m = data.macd.m[idx], s = data.macd.s[idx];
                logDetail += `MACD:${side === 'long' ? (m > s ? 'OK' : 'NO') : (m < s ? 'OK' : 'NO')} `;
                if (side === 'long' && m <= s) match = false;
                if (side === 'short' && m >= s) match = false;
            }

            // 4. Stoch Cross
            if ((chk('stochCrossEnabled') || chk('useStochCross')) && data.stoch) {
                const k = data.stoch.k[idx], d = data.stoch.d[idx];
                
                // 5분봉(m5) 기준 K와 D가 모두 100(롱 급등)이거나 모두 0(숏 급락)인 극단적 상황에는 크로스 무시 통과
                let isExtreme = false;
                if (interval === 'm5' && (chk('useStochExtremeBypass') || chk('stochExtremeBypassEnabled'))) {
                    if (side === 'long' && k >= 100 && d >= 100) {
                        isExtreme = true;
                        isExtremeLong = true;
                    } else if (side === 'short' && k <= 0 && d <= 0) {
                        isExtreme = true;
                        isExtremeShort = true;
                    }
                }

                logDetail += `Stoch:${side === 'long' ? (k > d ? 'OK' : 'NO') : (k < d ? 'OK' : 'NO')}${isExtreme ? '(EXTREME)' : ''} `;
                if (!isExtreme) {
                    if (side === 'long' && k <= d) match = false;
                    if (side === 'short' && k >= d) match = false;
                }
            }

            // 5. MACD Value
            if ((chk('macdValueEnabled') || chk('useMacdVal')) && data.macd) {
                const m = data.macd.m[idx];
                const threshold = rules.macdValue || rules.macdVal;
                if (Math.abs(m) >= threshold) match = false;
            }

            // 6. Stoch K Limit
            if ((chk('stochKLimitEnabled') || chk('useStochKLimit')) && data.stoch) {
                const low = rules.stochKLow !== undefined ? parseFloat(rules.stochKLow) : 0;
                const high = rules.stochKHigh !== undefined ? parseFloat(rules.stochKHigh) : (rules.stochKThreshold !== undefined ? parseFloat(rules.stochKThreshold) : 99);
                const val = data.stoch.k[idx];
                logDetail += `${interval.toUpperCase()}-StochK:${val !== null ? val.toFixed(1) : 'null'} (${low}~${high}) `;
                if (val !== null && (val < low || val > high)) match = false;
            }

            // 7. RSI Range
            if ((chk('rsiEnabled') || chk('useRSI')) && data.rsi) {
                const low = rules.rsiLow !== undefined ? parseFloat(rules.rsiLow) : 5;
                const high = rules.rsiHigh !== undefined ? parseFloat(rules.rsiHigh) : 95;
                const val = data.rsi[idx];
                logDetail += `RSI:${val !== null && val !== undefined ? val.toFixed(1) : 'null'} (${low}~${high}) `;
                if (val !== null && val !== undefined && (val <= low || val >= high)) match = false;
            }

            // 8. MA Slope Filter (0 기준)
            if (chk('maSlopeEnabled') || chk('useMaSlope')) {
                const period = rules && rules.maSlopePeriod !== undefined ? parseInt(rules.maSlopePeriod) : 20;
                const m1Idx = idx1mVal !== undefined ? idx1mVal : (idx * (interval === 'm5' ? 5 : (interval === 'h1' ? 60 : 1440)));
                const val = indicatorsObj.m1 && indicatorsObj.m1[`ma_slope_${period}`] ? indicatorsObj.m1[`ma_slope_${period}`][m1Idx] : null;
                logDetail += `MASlope(${period}):${val !== null && val !== undefined ? val.toFixed(4) : 'null'} `;
                if (val !== null && val !== undefined) {
                    if (side === 'long') {
                        if (val < 0) match = false;
                    } else {
                        if (val >= 0) match = false;
                    }
                }
            }

            // 9. MA ROC Filter (0 기준)
            if (chk('maRocEnabled') || chk('useMaRoc')) {
                const period = rules && rules.maRocPeriod !== undefined ? parseInt(rules.maRocPeriod) : 20;
                const m1Idx = idx1mVal !== undefined ? idx1mVal : (idx * (interval === 'm5' ? 5 : (interval === 'h1' ? 60 : 1440)));
                const val = indicatorsObj.m1 && indicatorsObj.m1[`ma_roc_${period}`] ? indicatorsObj.m1[`ma_roc_${period}`][m1Idx] : null;
                logDetail += `MAROC(${period}):${val !== null && val !== undefined ? val.toFixed(1) : 'null'} `;
                if (val !== null && val !== undefined) {
                    if (side === 'long') {
                        if (val < 0) match = false;
                    } else {
                        if (val >= 0) match = false;
                    }
                }
            }

            return match;
        };

        const longMatch = ['m5', 'h1', 'd1'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r1d);
            return checkCondition('long', iv, idx, indicators, idx1m);
        });

        const shortMatch = ['m5', 'h1', 'd1'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r1d);
            return checkCondition('short', iv, idx, indicators, idx1m);
        });

        if (longMatch) return isExtremeLong ? 'extreme_long' : 'long';
        if (shortMatch) return isExtremeShort ? 'extreme_short' : 'short';

        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config, extraContext) => {
        const penetrationRate = (config && config.PENETRATION_RATE) !== undefined ? parseFloat(config.PENETRATION_RATE) : 0.0;
        const entryMode = (config && config.ENTRY_MODE) || "HYBRID_5M";
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        let targetPrice = 0;
        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "";

        if (sig === 'extreme_long' || sig === 'extreme_short') {
            finalEntryPrice = k1m.open;
            executed = true;
            entryType = "MARKET(EXTREME_BYPASS)";
            return { executed, finalEntryPrice, entryType, entryTimeIdx };
        }

        if (entryMode === "HYBRID_5M") {
            const prev5m = extraContext ? extraContext.klines5m[extraContext.idx5m] : k5_prev;
            targetPrice = sig === 'long' ? prev5m.low : prev5m.high;
        } else if (entryMode === "HYBRID_10M" && extraContext) {
            const prev10m = extraContext.klines10m[extraContext.idx10m];
            targetPrice = sig === 'long' ? prev10m.low : prev10m.high;
        } else if (entryMode === "HYBRID_15M" && extraContext) {
            const prev15m = extraContext.klines15m[extraContext.idx15m];
            targetPrice = sig === 'long' ? prev15m.low : prev15m.high;
        } else {
            const prev5m = extraContext ? extraContext.klines5m[extraContext.idx5m] : k5_prev;
            targetPrice = sig === 'long' ? prev5m.low : prev5m.high;
        }

        if (entryMode === "MARKET") {
            finalEntryPrice = k1m.open;
            executed = true;
            entryType = "MARKET";
        } else {
            const signalPrice = k1m.open;
            if (sig === 'long' && signalPrice <= targetPrice) {
                finalEntryPrice = signalPrice;
                executed = true;
                entryType = `MARKET(${entryMode})`;
            } else if (sig === 'short' && signalPrice >= targetPrice) {
                finalEntryPrice = signalPrice;
                executed = true;
                entryType = `MARKET(${entryMode})`;
            } else {
                for (let j = currentIndex; j < klines1m.length; j++) {
                    const ex = klines1m[j];
                    if (sig === 'long' && ex.low <= targetPrice * (1 - penetrationRate)) {
                        finalEntryPrice = ex.open <= targetPrice ? ex.open : targetPrice;
                        executed = true; entryTimeIdx = j; entryType = `LIMIT(${entryMode})`; break;
                    }
                    if (sig === 'short' && ex.high >= targetPrice * (1 + penetrationRate)) {
                        finalEntryPrice = ex.open >= targetPrice ? ex.open : targetPrice;
                        executed = true; entryTimeIdx = j; entryType = `LIMIT(${entryMode})`; break;
                    }
                    if (j - currentIndex > waitLimit) break;
                }
            }
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
