const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');

console.log(`[LOADED] Logic.v7.0.6.cjs loaded at ${new Date().toISOString()}`);

const strategy = {
    name: 'Logic.v7.0.6',
    description: 'v7.0.6 (12h Filter Edition)',
    header: "Entry_Time,Exit_Time,Balance,Cum_ROI,Side,Entry_Price,Exit_Price,Net_Profit,ROE,Quantity,Fee,FundingFee,M5_StochK,M5_StochD,M5_ADX,H1_MACD,H1_Sig,H1_StochK,H1_StochD,H1_ADX,H12_MACD,H12_Sig,H12_StochK,H12_StochD,H12_ADX",

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

        ADX_THRESHOLD: 30, // Default fallback
        ENTRY_WAIT_MIN: 180,
        EXIT_WAIT_MIN: 2000
    },

    indicators_logic: (klines) => {
        return {
            m5: {
                macd: calculateMACD(klines.m5.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.m5.map(k => k.close))),
                adx: calculateADX(klines.m5)
            },
            h1: {
                macd: calculateMACD(klines.h1.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.h1.map(k => k.close))),
                adx: calculateADX(klines.h1)
            },
            h12: {
                macd: calculateMACD(klines.h12.map(k => k.close)),
                stoch: calculateStochRSI(calculateRSI(klines.h12.map(k => k.close))),
                adx: calculateADX(klines.h12)
            }
        };
    },

    signal_logic: (indicators, indices, overrideRules) => {
        const { idx5m, r1h, r12h } = indices;

        const checkCondition = (side, interval, idx, indicatorsObj) => {
            const data = indicatorsObj[interval];
            if (!data) return true;

            const timeframeMap = { 'm5': '5m', 'h1': '1h', 'h12': '12h' };
            const uiInterval = timeframeMap[interval] || interval;

            let rules = null;
            if (overrideRules) {
                if (overrideRules[side] && overrideRules[side][uiInterval]) {
                    rules = overrideRules[side][uiInterval];
                } else if (overrideRules[uiInterval] && overrideRules[uiInterval][side]) {
                    rules = overrideRules[uiInterval][side];
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

            if (!rules) {
                if (side === 'long') {
                    if (interval === 'm5') return data.adx[idx] >= 30 && data.stoch.k[idx] > data.stoch.d[idx];
                    if (interval === 'h1') return data.macd.m[idx] > data.macd.s[idx] && data.stoch.k[idx] > data.stoch.d[idx];
                    if (interval === 'h12') return data.macd.m[idx] > data.macd.s[idx];
                } else {
                    if (interval === 'm5') return data.adx[idx] >= 30 && data.stoch.k[idx] < data.stoch.d[idx];
                    if (interval === 'h1') return data.macd.m[idx] < data.macd.s[idx] && data.stoch.k[idx] < data.stoch.d[idx];
                    if (interval === 'h12') return data.macd.m[idx] < data.macd.s[idx];
                }
                return true;
            }

            if (chk('adxEnabled') || chk('useADX')) {
                const threshold = rules.adxThreshold || 30;
                const val = data.adx[idx];
                logDetail += `ADX:${val.toFixed(1)}>${threshold} `;
                if (val < threshold) match = false;
            }

            if ((chk('macdCrossEnabled') || chk('useMacdBeyondSig')) && data.macd) {
                const m = data.macd.m[idx], s = data.macd.s[idx];
                logDetail += `MACD:${side === 'long' ? (m > s ? 'OK' : 'NO') : (m < s ? 'OK' : 'NO')} `;
                if (side === 'long' && m <= s) match = false;
                if (side === 'short' && m >= s) match = false;
            }

            if (chk('stochCrossEnabled') || chk('useStochCross')) {
                const k = data.stoch.k[idx], d = data.stoch.d[idx];
                logDetail += `Stoch:${side === 'long' ? (k > d ? 'OK' : 'NO') : (k < d ? 'OK' : 'NO')} `;
                if (side === 'long' && k <= d) match = false;
                if (side === 'short' && k >= d) match = false;
            }

            if (match) console.log(`${side.toUpperCase()} ${logDetail} -> PASS`);
            return match;
        };

        const longMatch = ['m5', 'h1', 'h12'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r12h);
            return checkCondition('long', iv, idx, indicators);
        });

        const shortMatch = ['m5', 'h1', 'h12'].every(iv => {
            const idx = iv === 'm5' ? idx5m : (iv === 'h1' ? r1h : r12h);
            return checkCondition('short', iv, idx, indicators);
        });

        if (longMatch) return 'long';
        if (shortMatch) return 'short';

        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config) => {
        const signalPrice = k1m.open;
        const targetPrice = sig === 'long' ? k5_prev.low : k5_prev.high;

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "";

        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        if (sig === 'long' && signalPrice <= targetPrice) {
            finalEntryPrice = signalPrice;
            executed = true;
            entryType = "MARKET(Better)";
        } else if (sig === 'short' && signalPrice >= targetPrice) {
            finalEntryPrice = signalPrice;
            executed = true;
            entryType = "MARKET(Better)";
        } else {
            for (let j = currentIndex; j < klines1m.length; j++) {
                const ex = klines1m[j];
                if (sig === 'long' && ex.low <= targetPrice) {
                    finalEntryPrice = ex.open <= targetPrice ? ex.open : targetPrice;
                    executed = true; entryTimeIdx = j; entryType = "LIMIT"; break;
                }
                if (sig === 'short' && ex.high >= targetPrice) {
                    finalEntryPrice = ex.open >= targetPrice ? ex.open : targetPrice;
                    executed = true; entryTimeIdx = j; entryType = "LIMIT"; break;
                }
                if (j - currentIndex > waitLimit) break;
            }
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
