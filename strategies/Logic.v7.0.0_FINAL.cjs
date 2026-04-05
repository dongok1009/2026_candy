const indicators = require('../lib/indicators.cjs');

// [v7.0.0 FINAL Official Edition]
// - Global Standard Multi-timeframe Filter (5M, 1H, 1D)
// - Hybrid Entry Management (Immediate/Retrace)
// - Backtest Engine v7.0.0 Compatibility
const config = {
    SYMBOL: 'BTCUSDT',
    LEVERAGE: 5,
    INITIAL_BALANCE: 1000,
    TARGET_NET_ROI: 0.03,
    SL_ROI: 0.15,
    MAKER_FEE_RATE: 0.0002,
    TAKER_FEE_RATE: 0.0005,
    EXIT_MAKER_FEE_RATE: 0.0002,
    FUNDING_FEE_RATE: 0.0001,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    STOCH_P: 14,
    STOCH_K: 3,
    STOCH_D: 3,
    ADX_PERIOD: 14,
    ENTRY_TYPE: 'hybrid',
    ENTRY_WAIT_MIN: 60,
    EXIT_WAIT_MIN: 2000
};

const rules = {
    long: {
        m5: { stochK_low: 20, adx_min: 25 },
        h1: { macd_cross_up: true, stochK_low: 30, adx_min: 20 },
        d1: { macd_above_zero: true, adx_min: 15 }
    },
    short: {
        m5: { stochK_high: 80, adx_min: 25 },
        h1: { macd_cross_down: true, stochK_high: 70, adx_min: 20 },
        d1: { macd_below_zero: true, adx_min: 15 }
    }
};

function calculate_indicators(klines1m, klines5m, klines1h, klines1d) {
    const m5 = {
        stoch: indicators.calculateStochRSI(klines5m.close, config.STOCH_P, config.STOCH_K, config.STOCH_D),
        adx: indicators.calculateADX(klines5m, config.ADX_PERIOD)
    };
    const h1 = {
        macd: indicators.calculateMACD(klines1h.close, config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL),
        stoch: indicators.calculateStochRSI(klines1h.close, config.STOCH_P, config.STOCH_K, config.STOCH_D),
        adx: indicators.calculateADX(klines1h, config.ADX_PERIOD)
    };
    const d1 = {
        macd: indicators.calculateMACD(klines1d.close, config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL),
        adx: indicators.calculateADX(klines1d, config.ADX_PERIOD)
    };
    return { m5, h1, d1 };
}

function signal_logic(inds, indices) {
    const { idx5m, r1h, r1d } = indices;
    
    const longCond = 
        inds.h1.macd.m[r1h] > inds.h1.macd.s[r1h] && 
        inds.h1.macd.m[r1h-1] <= inds.h1.macd.s[r1h-1] &&
        inds.m5.stoch.k[idx5m] < 20 &&
        inds.m5.adx[idx5m] > 25;

    const shortCond = 
        inds.h1.macd.m[r1h] < inds.h1.macd.s[r1h] && 
        inds.h1.macd.m[r1h-1] >= inds.h1.macd.s[r1h-1] &&
        inds.m5.stoch.k[idx5m] > 80 &&
        inds.m5.adx[idx5m] > 25;

    if (longCond) return 'long';
    if (shortCond) return 'short';
    return 'hold';
}

function entry_logic(sig, k1m, k5m, klines1m, i) {
    const entryType = config.ENTRY_TYPE;
    
    if (entryType === 'immediate') {
        return { executed: true, finalEntryPrice: k1m.close, entryType: 'MARKET', entryTimeIdx: i };
    }
    
    const targetPrice = sig === 'long' ? k5m.low : k5m.high;
    const limitRange = config.ENTRY_WAIT_MIN;
    
    for (let j = i; j < i + limitRange && j < klines1m.length; j++) {
        const ex = klines1m[j];
        if (sig === 'long' && ex.low <= targetPrice) {
            return { executed: true, finalEntryPrice: targetPrice, entryType: 'RETRACE_LIMIT', entryTimeIdx: j };
        }
        if (sig === 'short' && ex.high >= targetPrice) {
            return { executed: true, finalEntryPrice: targetPrice, entryType: 'RETRACE_LIMIT', entryTimeIdx: j };
        }
    }
    
    return { executed: false };
}

module.exports = { config, rules, calculate_indicators, signal_logic, entry_logic };
