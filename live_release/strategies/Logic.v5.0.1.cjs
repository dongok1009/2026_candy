const { calculateMACD, calculateStochRSI, calculateRSI } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v5_0_1_Hybrid_Entry',
    description: 'v5.0.1 하이브리드 진입 모델 (Better Price logic)',
    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-12-01T00:00:00+09:00').getTime(),
        ACTUAL_START_TIME: new Date('2025-01-01T00:00:00+09:00').getTime(),
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
                stoch: calculateStochRSI(calculateRSI(klines.m5.map(k => k.close))) 
            },
            h1: { 
                macd: calculateMACD(klines.h1.map(k => k.close)), 
                stoch: calculateStochRSI(calculateRSI(klines.h1.map(k => k.close))) 
            },
            d1: { 
                macd: calculateMACD(klines.d1.map(k => k.close)), 
                stoch: calculateStochRSI(calculateRSI(klines.d1.map(k => k.close))) 
            }
        };
    },

    signal_logic: (indicators, indices) => {
        const { idx5m, r1h, r1d } = indices;
        
        const k5 = indicators.m5.stoch.k[idx5m], d5 = indicators.m5.stoch.d[idx5m];
        const m1h = indicators.h1.macd.m[r1h], s1h = indicators.h1.macd.s[r1h], kh = indicators.h1.stoch.k[r1h], dh = indicators.h1.stoch.d[r1h];
        const m1d = indicators.d1.macd.m[r1d], s1d = indicators.d1.macd.s[r1d], kd = indicators.d1.stoch.k[r1d], dd = indicators.d1.stoch.d[r1d];

        const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
        const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
        const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

        if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') return 'long';
        if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') return 'short';
        
        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config) => {
        const marketPriceAtSignal = k1m.close;
        const limitTargetPrice = sig === 'long' ? k5_prev.low : k5_prev.high;

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "";

        // Hybrid Entry: Better Price Logic
        if (sig === 'long' && marketPriceAtSignal <= limitTargetPrice) {
            finalEntryPrice = marketPriceAtSignal; executed = true; entryType = "MARKET(Better)";
        } else if (sig === 'short' && marketPriceAtSignal >= limitTargetPrice) {
            finalEntryPrice = marketPriceAtSignal; executed = true; entryType = "MARKET(Better)";
        } else {
            const waitLimit = (config && config.ENTRY_WAIT_MIN) || 60;
            for (let j = currentIndex; j < klines1m.length; j++) {
                const ex = klines1m[j];
                if (sig === 'long' && ex.low <= limitTargetPrice) { finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; entryType = "LIMIT"; break; }
                if (sig === 'short' && ex.high >= limitTargetPrice) { finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; entryType = "LIMIT"; break; }
                if (j - currentIndex > waitLimit) break;
            }
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
