const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');

const strategy = {
    name: 'v7_0_0_ADX_Energy_Filter',
    description: 'v7.0.0 ADX 에너지 필터 (1h & 5m ADX >= 30)',
    header: "Entry_Time,Exit_Time,Balance,Cum_ROI,Side,Entry_Price,Exit_Price,Net_Profit,ROE,Quantity,Fee,FundingFee,M5_StochK,M5_StochD,M5_ADX,H1_MACD,H1_Sig,H1_StochK,H1_StochD,H1_ADX,D1_MACD,D1_Sig,D1_ADX",
    
    config: {
        SYMBOL: 'BTCUSDT',
        FETCH_START_TIME: new Date('2024-10-01T00:00:00+09:00').getTime(),
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

    signal_logic: (indicators, indices, overrideRules) => {
        const { idx5m, r1h, r1d } = indices;

        const checkCondition = (side, interval, idx, indicatorsObj) => {
            const rules = overrideRules && overrideRules[side] && overrideRules[side][interval];
            const data = indicatorsObj[interval];
            if (!data) return true;

            let match = true;

            // [CASE-INSENSITIVE CHECK] useADX, useAdx 모두 허용
            const chk = (key) => {
                const v = rules ? (rules[key] ?? rules[key.toLowerCase()] ?? rules[key.toUpperCase()]) : undefined;
                return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
            };

            // ADX 필터
            if (!rules) {
                // 기본값 (v7.0.0 하드코딩 기준 준수)
                if (data.adx[idx] < 30) match = false;
            } else if (chk('useADX')) {
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
        // v7.0.0 : 5분 확정봉(k5_prev)의 고가/저가 기준 0.15% 여유 진입
        const limitTargetPrice = sig === 'long' ? k5_prev.low * 0.9985 : k5_prev.high * 1.0015; 

        let finalEntryPrice = 0;
        let executed = false;
        let entryTimeIdx = currentIndex;
        const entryType = sig === 'long' ? "low x 0.9985" : "high x 1.0015";

        // [ENTRY WAIT LIMIT] 설정된 대기 시간 초과 시 무시
        const waitLimit = (config && config.ENTRY_WAIT_MIN) || 180;

        for (let j = currentIndex + 1; j < klines1m.length; j++) {
            const ex = klines1m[j];
            if (sig === 'long' && ex.low <= limitTargetPrice) { 
                finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; break; 
            }
            if (sig === 'short' && ex.high >= limitTargetPrice) { 
                finalEntryPrice = limitTargetPrice; executed = true; entryTimeIdx = j; break; 
            }
            if (j - currentIndex > waitLimit) break;
        }

        return { executed, finalEntryPrice, entryBasis: entryType, entryTimeIdx };
    }
};

module.exports = strategy;
