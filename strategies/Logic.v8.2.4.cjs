const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');

console.log(`[LOADED] Logic.v8.2.4.cjs loaded at ${new Date().toISOString()}`);

const strategy = {
    name: 'Logic.v8.2.4',
    description: 'v8.2.4 (Custom Entry Modes & Penetration Rate Integration - BTC Only)',
    header: "Entry_Time,Exit_Time,Balance,Cum_ROI,Side,Entry_Price,Exit_Price,Net_Profit,ROE,Quantity,Fee,FundingFee,M5_StochK,M5_StochD,M5_ADX,M5_RSI,H1_MACD,H1_Sig,H1_StochK,H1_StochD,H1_ADX,H1_RSI,D1_MACD,D1_Sig,D1_StochK,D1_StochD,D1_ADX,D1_RSI",

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

        TARGET_NET_ROI: 0.03,
        SL_ROI: 0.15,

        ENTRY_WAIT_MIN: 180,
        EXIT_WAIT_MIN: 2000,

        // [New v8.2.4 parameters]
        PENETRATION_RATE: 0.001, // 0.1% 돌파 시 체결로 판정
        ENTRY_MODE: 'HYBRID_BETTER' // MARKET, LIMIT_5M, LIMIT_10M, LIMIT_15M, HYBRID_BETTER
    },

    indicators_logic: (klines) => {
        return {
            m5: {
                macd: calculateMACD(klines.m5.map(k => k.close)),
                rsi: calculateRSI(klines.m5.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.m5.map(k => k.close))),
                adx: calculateADX(klines.m5)
            },
            h1: {
                macd: calculateMACD(klines.h1.map(k => k.close)),
                rsi: calculateRSI(klines.h1.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.h1.map(k => k.close))),
                adx: calculateADX(klines.h1)
            },
            d1: {
                macd: calculateMACD(klines.d1.map(k => k.close)),
                rsi: calculateRSI(klines.d1.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.d1.map(k => k.close))),
                adx: calculateADX(klines.d1)
            }
        };
    },

    signal_logic: (indicators, indices, overrideRules) => {
        const { idx5m, r1h, r1d } = indices;

        const checkCondition = (side, interval, idx, indicatorsObj) => {
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
            if ((chk('macdCrossEnabled') || chk('useMacdBeyondSig')) && data.macd) {
                const m = data.macd.m[idx], s = data.macd.s[idx];
                logDetail += `MACD:${side === 'long' ? (m > s ? 'OK' : 'NO') : (m < s ? 'OK' : 'NO')} `;
                if (side === 'long' && m <= s) match = false;
                if (side === 'short' && m >= s) match = false;
            }

            // 4. Stoch Cross
            if (chk('stochCrossEnabled') || chk('useStochCross')) {
                const k = data.stoch.k[idx], d = data.stoch.d[idx];
                logDetail += `Stoch:${side === 'long' ? (k > d ? 'OK' : 'NO') : (k < d ? 'OK' : 'NO')} `;
                if (side === 'long' && k <= d) match = false;
                if (side === 'short' && k >= d) match = false;
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

            return match;
        };

        const longMatch = ['m5', 'h1', 'd1'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r1d);
            return checkCondition('long', iv, idx, indicators);
        });

        const shortMatch = ['m5', 'h1', 'd1'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r1d);
            return checkCondition('short', iv, idx, indicators);
        });

        if (longMatch) return 'long';
        if (shortMatch) return 'short';

        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config, extraContext) => {
        const penetrationRate = (config && config.PENETRATION_RATE) !== undefined ? parseFloat(config.PENETRATION_RATE) : 0.0;
        const entryMode = (config && config.ENTRY_MODE) || "HYBRID_BETTER";
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        let targetPrice = 0;
        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "";

        // 1. 진입 방식별 타겟 지정가 결정
        if (entryMode === "LIMIT_5M") {
            const prev5m = extraContext ? extraContext.klines5m[extraContext.idx5m] : k5_prev;
            targetPrice = sig === 'long' ? prev5m.low : prev5m.high;
        } else if (entryMode === "LIMIT_10M" && extraContext) {
            const prev10m = extraContext.klines10m[extraContext.idx10m];
            targetPrice = sig === 'long' ? prev10m.low : prev10m.high;
        } else if (entryMode === "LIMIT_15M" && extraContext) {
            const prev15m = extraContext.klines15m[extraContext.idx15m];
            targetPrice = sig === 'long' ? prev15m.low : prev15m.high;
        } else {
            // HYBRID_BETTER 또는 MARKET용 기본 5m 타겟팅
            const prev5m = extraContext ? extraContext.klines5m[extraContext.idx5m] : k5_prev;
            targetPrice = sig === 'long' ? prev5m.low : prev5m.high;
        }

        // 2. 진입 로직 실행
        if (entryMode === "MARKET") {
            // 즉시 시장가 진입
            finalEntryPrice = k1m.open;
            executed = true;
            entryType = "MARKET";
        } else if (entryMode === "HYBRID_BETTER") {
            // 시가가 지정가보다 유리하면 즉시 시장가 진입
            const signalPrice = k1m.open;
            if (sig === 'long' && signalPrice <= targetPrice) {
                finalEntryPrice = signalPrice;
                executed = true;
                entryType = "MARKET(Better)";
            } else if (sig === 'short' && signalPrice >= targetPrice) {
                finalEntryPrice = signalPrice;
                executed = true;
                entryType = "MARKET(Better)";
            } else {
                // 유리하지 않으면 지정가 주문 대기 (돌파 깊이 적용)
                for (let j = currentIndex; j < klines1m.length; j++) {
                    const ex = klines1m[j];
                    if (sig === 'long' && ex.low <= targetPrice * (1 - penetrationRate)) {
                        finalEntryPrice = ex.open <= targetPrice ? ex.open : targetPrice;
                        executed = true; entryTimeIdx = j; entryType = "LIMIT"; break;
                    }
                    if (sig === 'short' && ex.high >= targetPrice * (1 + penetrationRate)) {
                        finalEntryPrice = ex.open >= targetPrice ? ex.open : targetPrice;
                        executed = true; entryTimeIdx = j; entryType = "LIMIT"; break;
                    }
                    if (j - currentIndex > waitLimit) break;
                }
            }
        } else {
            // 일반 LIMIT 모드 (LIMIT_5M, LIMIT_10M, LIMIT_15M)
            for (let j = currentIndex; j < klines1m.length; j++) {
                const ex = klines1m[j];
                if (sig === 'long' && ex.low <= targetPrice * (1 - penetrationRate)) {
                    finalEntryPrice = ex.open <= targetPrice ? ex.open : targetPrice;
                    executed = true; entryTimeIdx = j; entryType = entryMode; break;
                }
                if (sig === 'short' && ex.high >= targetPrice * (1 + penetrationRate)) {
                    finalEntryPrice = ex.open >= targetPrice ? ex.open : targetPrice;
                    executed = true; entryTimeIdx = j; entryType = entryMode; break;
                }
                if (j - currentIndex > waitLimit) break;
            }
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
