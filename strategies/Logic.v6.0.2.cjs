const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v6_0_2_Retrace_Optimized',
    description: 'v6.0.2 리트레이스 최적화 모델 (1.5% Retrace Entry)',
    header: "Time_KST,SignalType,Entry_Price,Entry_Type,Exit_Time,Exit_Price,Result,ROI,Balance",
    
    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-11-01T00:00:00+09:00').getTime(),
        ACTUAL_START_TIME: new Date('2025-01-01T00:00:00+09:00').getTime(),
        END_TIME: new Date('2025-12-31T23:59:59+09:00').getTime(),
        
        LEVERAGE: 5,
        INITIAL_BALANCE: 1000,
        MAKER_FEE_RATE: 0.0002,
        TAKER_FEE_RATE: 0.0005,
        EXIT_MAKER_FEE_RATE: 0.0002,
        FUNDING_FEE_RATE: 0.0001,
        
        TARGET_NET_ROI: 0.03, // 3% Net
        SL_ROI: 0.15, // 15% SL
        
        RETRACE_P: 0.015, // 1.5% Retrace
        TIMEOUT_MINS: 180 // 3 Hours
    },

    indicators_logic: (klines) => {
        return {
            m5: { stoch: calculateStochRSI(calculateRSI(klines.m5.map(k => k.close))) },
            h1: { 
                macd: calculateMACD(klines.h1.map(k => k.close)), 
                stoch: calculateStochRSI(calculateRSI(klines.h1.map(k => k.close))) 
            },
            d1: { macd: calculateMACD(klines.d1.map(k => k.close)) }
        };
    },

    signal_logic: (indicators, indices) => {
        const { idx5m, r1h, r1d } = indices;
        
        const k5 = indicators.m5.stoch.k[idx5m], d5 = indicators.m5.stoch.d[idx5m];
        const m1h = indicators.h1.macd.m[r1h], s1h = indicators.h1.macd.s[r1h], 
              kh = indicators.h1.stoch.k[r1h], dh = indicators.h1.stoch.d[r1h];
        const m1d = indicators.d1.macd.m[r1d], s1d = indicators.d1.macd.s[r1d];

        const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
        const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
        const cond1d = (m1d > s1d) ? 'long' : (m1d < s1d ? 'short' : 'hold');

        if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') return 'long';
        if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') return 'short';
        
        return 'hold';
    },

    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config) => {
        // v6.0.2 uses fixed 1.5% retrace from signal (k.open)
        const signalPrice = k1m.open;
        const retraceP = 0.015;
        const limitTargetPrice = sig === 'long' ? signalPrice * (1 - retraceP) : signalPrice * (1 + retraceP);

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "RETRACE_LIMIT";

        // [ENTRY WAIT LIMIT] 설정된 대기 시간 초과 시 무시
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        // Limit Order Check
        for (let j = currentIndex; j < klines1m.length; j++) {
            const ex = klines1m[j];
            if (sig === 'long' && ex.low <= limitTargetPrice) { 
                finalEntryPrice = ex.open <= limitTargetPrice ? ex.open : limitTargetPrice;
                executed = true; entryTimeIdx = j; break; 
            }
            if (sig === 'short' && ex.high >= limitTargetPrice) { 
                finalEntryPrice = ex.open >= limitTargetPrice ? ex.open : limitTargetPrice;
                executed = true; entryTimeIdx = j; break; 
            }
            if (j - currentIndex > waitLimit) break;
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
