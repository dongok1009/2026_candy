const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v6_0_0_HighFreq_Optimized',
    description: 'v6.0.0 고빈도 수익 최적화 모델 (1d StochRSI OFF)',
    header: "Time_KST,SignalType,Entry_Price,Entry_Type,Exit_Time,Exit_Price,Result,ROI,Balance", // Header for CSV
    
    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-12-01T00:00:00+09:00').getTime(),
        ACTUAL_START_TIME: new Date('2025-01-01T00:00:00+09:00').getTime(),
        END_TIME: new Date('2026-03-31T23:59:59+09:00').getTime(), // Fixed End Date!
        
        LEVERAGE: 5,
        INITIAL_BALANCE: 1000,
        MAKER_FEE_RATE: 0.0002,
        TAKER_FEE_RATE: 0.0005,
        EXIT_MAKER_FEE_RATE: 0.0002,
        FUNDING_FEE_RATE: 0.0001,
        
        TARGET_NET_ROI: 0.03,
        SL_ROI: 0.15 
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
            d1: { 
                macd: calculateMACD(klines.d1.map(k => k.close)),
                adx: calculateADX(klines.d1)
            }
        };
    },

    signal_logic: (indicators, indices, overrideRules) => {
        const { idx5m, r1h, r1d } = indices;

        const checkCondition = (side, interval, idx, indicatorsObj) => {
            const rules = overrideRules && overrideRules[side] && overrideRules[side][interval];
            const data = indicatorsObj[interval];
            if (!data) return true;

            const chk = (key) => {
                const v = rules ? (rules[key] ?? rules[key.toLowerCase()] ?? rules[key.toUpperCase()]) : undefined;
                return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
            };

            let match = true;

            // ADX 필터
            if (chk('useADX')) {
                if (data.adx[idx] < (rules.adxThreshold || 30)) match = false;
            }

            // MACD 및 Stoch 조건
            if (side === 'long') {
                const m = data.macd?.m?.[idx], s = data.macd?.s?.[idx];
                const k = data.stoch?.k?.[idx], d = data.stoch?.d?.[idx];
                
                if (interval === 'm5') {
                    if (k < d) match = false;
                } else if (interval === 'h1') {
                    if (m < s || k < d) match = false;
                } else if (interval === 'd1') {
                    if (m < s) match = false;
                }
            } else {
                const m = data.macd?.m?.[idx], s = data.macd?.s?.[idx];
                const k = data.stoch?.k?.[idx], d = data.stoch?.d?.[idx];

                if (interval === 'm5') {
                    if (k > d) match = false;
                } else if (interval === 'h1') {
                    if (m > s || k > d) match = false;
                } else if (interval === 'd1') {
                    if (m > s) match = false;
                }
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

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config) => {
        const marketPriceAtSignal = k1m.close;
        const limitTargetPrice = sig === 'long' ? k5_prev.low : k5_prev.high;

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "";

        // [ENTRY WAIT LIMIT] 설정된 대기 시간 초과 시 무시
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 60;

        // Better Price Entry Logic (handles gaps)
        if (sig === 'long' && marketPriceAtSignal <= limitTargetPrice) {
            finalEntryPrice = marketPriceAtSignal; executed = true; entryType = "MARKET(Better)";
        } else if (sig === 'short' && marketPriceAtSignal >= limitTargetPrice) {
            finalEntryPrice = marketPriceAtSignal; executed = true; entryType = "MARKET(Better)";
        } else {
            // Limit Order Check
            for (let j = currentIndex; j < klines1m.length; j++) {
                const ex = klines1m[j];
                if (sig === 'long' && ex.low <= limitTargetPrice) { 
                    // Use open price if it's already below limit (Gap down)
                    finalEntryPrice = ex.open <= limitTargetPrice ? ex.open : limitTargetPrice;
                    executed = true; entryTimeIdx = j; entryType = "LIMIT"; break; 
                }
                if (sig === 'short' && ex.high >= limitTargetPrice) { 
                    // Use open price if it's already above limit (Gap up)
                    finalEntryPrice = ex.open >= limitTargetPrice ? ex.open : limitTargetPrice;
                    executed = true; entryTimeIdx = j; entryType = "LIMIT"; break; 
                }
                if (j - currentIndex > waitLimit) break;
            }
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
