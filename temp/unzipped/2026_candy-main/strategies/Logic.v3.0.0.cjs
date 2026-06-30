const { calculateMACD, calculateStochRSI, calculateRSI } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v3_0_0_Baseline',
    description: 'v3.0.0 표준 베이스라인 (1d 에너지 필터 300)',
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
        SL_ROI: 0.15,
        HIST_THRESHOLD: 300
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
        
        const m5 = indicators.m5.macd.m[idx5m], s5 = indicators.m5.macd.s[idx5m], k5 = indicators.m5.stoch.k[idx5m], d5 = indicators.m5.stoch.d[idx5m];
        const m1h = indicators.h1.macd.m[r1h], s1h = indicators.h1.macd.s[r1h], kh = indicators.h1.stoch.k[r1h], dh = indicators.h1.stoch.d[r1h];
        const m1d = indicators.d1.macd.m[r1d], s1d = indicators.d1.macd.s[r1d], kd = indicators.d1.stoch.k[r1d], dd = indicators.d1.stoch.d[r1d];

        const cond5m = (m5 > s5 && k5 > d5) ? 'long' : (m5 < s5 && k5 < d5 ? 'short' : 'hold');
        const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
        const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

        let isL = (cond5m === 'long' && cond1h === 'long' && cond1d === 'long');
        let isS = (cond5m === 'short' && cond1h === 'short' && cond1d === 'short');

        const hd = m1d - s1d;
        if (Math.abs(hd) <= strategy.config.HIST_THRESHOLD) { isL = false; isS = false; }

        if (isL) return 'long';
        if (isS) return 'short';
        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex) => {
        // v3.0.0 uses Market Entry at Signal Candle Close
        return { executed: true, finalEntryPrice: k1m.close, entryType: "MARKET", entryTimeIdx: currentIndex };
    }
};

module.exports = strategy;
