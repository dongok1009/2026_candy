const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v7_0_0_ADX_Energy_Filter',
    description: 'v7.0.0 ADX 에너지 필터 (1h & 5m ADX >= 30)',
    header: "Entry_Time,Exit_Time,Balance,Cum_ROI,Side,Entry_Price,Exit_Price,Net_Profit,ROE,Quantity,Fee,FundingFee,M5_StochK,M5_StochD,M5_ADX,H1_MACD,H1_Sig,H1_StochK,H1_StochD,H1_ADX,D1_MACD,D1_Sig,D1_ADX",
    
    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-12-01T00:00:00+09:00').getTime(),
        ACTUAL_START_TIME: new Date('2025-01-01T00:00:00+09:00').getTime(),
        END_TIME: new Date('2025-12-31T23:59:59+09:00').getTime(),
        
        LEVERAGE: 5,
        INITIAL_BALANCE: 1000,
        MAKER_FEE_RATE: 0.0002,
        TAKER_FEE_RATE: 0.0005,
        EXIT_MAKER_FEE_RATE: 0.0002,
        FUNDING_FEE_RATE: 0.0001,
        
        TARGET_NET_ROI: 0.03,
        SL_ROI: 0.15,
        
        RETRACE_P: 0.015, // 1.5%
        ADX_THRESHOLD: 30
    },

    indicators_logic: (klines) => {
        return {
            m5: { 
                stoch: calculateStochRSI(calculateRSI(klines.m5.map(d=>d.close))),
                adx: calculateADX(klines.m5)
            },
            h1: { 
                macd: calculateMACD(klines.h1.map(d=>d.close)), 
                stoch: calculateStochRSI(calculateRSI(klines.h1.map(d=>d.close))),
                adx: calculateADX(klines.h1)
            },
            d1: { 
                macd: calculateMACD(klines.d1.map(d=>d.close)),
                adx: calculateADX(klines.d1)
            }
        };
    },

    signal_logic: (indicators, indices) => {
        const { idx5m, r1h, r1d } = indices;
        
        // 5m conditions
        const k5 = indicators.m5.stoch.k[idx5m], d5 = indicators.m5.stoch.d[idx5m];
        const adx5 = indicators.m5.adx[idx5m];
        const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
        
        // 1h conditions
        const m1h = indicators.h1.macd.m[r1h], s1h = indicators.h1.macd.s[r1h], 
              kh = indicators.h1.stoch.k[r1h], dh = indicators.h1.stoch.d[r1h];
        const adxH = indicators.h1.adx[r1h];
        const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');

        // 1d conditions
        const m1d = indicators.d1.macd.m[r1d], s1d = indicators.d1.macd.s[r1d];
        const adxD = indicators.d1.adx[r1d];
        const cond1d = (m1d > s1d) ? 'long' : (m1d < s1d ? 'short' : 'hold');
        
        // ADX Condition: All timeframes must have ADX >= Threshold
        const threshold = strategy.config.ADX_THRESHOLD;
        const adxCond = (adx5 >= threshold && adxH >= threshold && adxD >= threshold);

        if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long' && adxCond) return 'long';
        if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short' && adxCond) return 'short';
        
        return 'hold';
    },


    entry_logic: (sig, k1m, k5_prev, klines1m, currentIndex, config) => {
        // v7.0.0 uses Retrace Entry: Signal Price * (1 +/- 1.5%)
        const signalPrice = k1m.close;
        const retraceP = 0.015;
        const limitTargetPrice = sig === 'long' ? signalPrice * (1 - retraceP) : signalPrice * (1 + retraceP);

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        let entryType = "RETRACE_LIMIT";

        // [ENTRY WAIT LIMIT] 설정된 대기 시간 초과 시 무시
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        for (let j = currentIndex; j < klines1m.length; j++) {
            const ex = klines1m[j];
            if (sig === 'long' && ex.low <= limitTargetPrice) { 
                finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; break; 
            }
            if (sig === 'short' && ex.high >= limitTargetPrice) { 
                finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; break; 
            }
            if (j - currentIndex > waitLimit) break;
        }

        return { executed, finalEntryPrice, entryType, entryTimeIdx };
    }
};

module.exports = strategy;
