const axios = require('axios');
const fs = require('fs');

// --- Indicators Logic ---
const calculateEMA = (data, period) => {
  const ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
};

const calculateSMA = (data, period) => {
  const sma = new Array(data.length).fill(null);
  if (data.length < period) return sma;
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    sma[i] = sum / period;
  }
  return sma;
};

const calculateRSI = (closes, period = 14) => {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;
  let avgGain = 0; let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  if (avgLoss === 0) rsi[period] = 100; else rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    if (avgLoss === 0) rsi[i] = 100; else rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
};

const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);
  const macdLine = fastEMA.map((f, i) => (f !== null && slowEMA[i] !== null) ? f - slowEMA[i] : null);
  const nonNullMacd = macdLine.filter(m => m !== null);
  const signalEMA = calculateEMA(nonNullMacd, signal);
  const signalLine = new Array(macdLine.length).fill(null);
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && signalIdx < signalEMA.length) signalLine[i] = signalEMA[signalIdx++];
  }
  const histogram = macdLine.map((m, i) => (m !== null && signalLine[i] !== null) ? m - signalLine[i] : null);
  return { macdLine, signalLine, histogram };
};

const calculateStochRSI = (rsiValues, period = 14, k = 3, d = 3) => {
  const rawStoch = new Array(rsiValues.length).fill(null);
  for (let i = period; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - period + 1, i + 1).filter(v => v !== null);
    if (window.length < period) continue;
    const min = Math.min(...window); const max = Math.max(...window);
    if (max - min === 0) rawStoch[i] = 100; else rawStoch[i] = ((rsiValues[i] - min) / (max - min)) * 100;
  }
  const nonNullStoch = rawStoch.filter(s => s !== null);
  const kLineValues = calculateSMA(nonNullStoch, k);
  const kLine = new Array(rawStoch.length).fill(null);
  let kIdx = 0;
  for (let i = 0; i < rawStoch.length; i++) {
    if (rawStoch[i] !== null && kIdx < kLineValues.length) kLine[i] = kLineValues[kIdx++];
  }
  const nonNullK = kLine.filter(kVal => kVal !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  }
  return { kLine, dLine };
};

// --- Config ---
const SYMBOL = 'BTCUSDT';
const START_TIME = new Date('2023-09-01T00:00:00Z').getTime();
const ACTUAL_START_TIME = new Date('2025-07-26T00:00:00Z').getTime();
const END_TIME = Date.now();

const LEVERAGE = 5;
const TARGET_NET_ROI = 0.04; // 4% net profit
const TARGET_SL_ROI = 0.15; // 15%
const INITIAL_BALANCE = 1000;
const SLIPPAGE_RATE = 0;

// Binance Futures Fees
const TAKER_FEE_RATE = 0.0005; // 0.05% (Market Buy)
const MAKER_FEE_RATE = 0.0002; // 0.02% (Limit Sell)
const FUNDING_FEE_RATE = 0.0001; // 0.01% every 8 hours

// To get 3.00% NET on margin, we need Gross ROI = 3.00% + (Fees on Notion)
const TOTAL_FEES_ON_MARGIN = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
const GROSS_TARGET_ROI = TARGET_NET_ROI + TOTAL_FEES_ON_MARGIN;

const TP_PRICE_MOVE = GROSS_TARGET_ROI / LEVERAGE;
const SL_PRICE_MOVE = TARGET_SL_ROI / LEVERAGE;

const RULES = {
  '5m': {
    long: { macdValueEnabled: false, macdValue: -10, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 10, macdCrossEnabled: true, stochCrossEnabled: true }
  },
  '1h': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true }
  },
  '1d': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true }
  }
};

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

// --- Data Fetching ---
async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${interval} klines for ${symbol}...`);
  while (allKlines.length < 1000000 && currentStart < endTime) { 
    try {
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
        params: { symbol, interval, startTime: currentStart, limit: 1500 }
      });
      if (response.data.length === 0) break;
      allKlines.push(...response.data);
      currentStart = response.data[response.data.length - 1][0] + 1;
      if (response.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 300)); 
    } catch (e) {
      console.error(`Error fetching ${interval}:`, e.message);
      break;
    }
  }
  return allKlines.map(d => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4])
  }));
}

function getSignalWithData(rule, m, s, k, d) {
  let isLong = true; let isShort = true;
  if (m === null || s === null) { isLong = false; isShort = false; }
  else {
    if (rule.long) {
      let activeLongCondCount = 0;
      if (rule.long.macdValueEnabled) { activeLongCondCount++; if (!(m < parseFloat(rule.long.macdValue))) isLong = false; }
      if (rule.long.macdCrossEnabled) { activeLongCondCount++; if (!(m > s)) isLong = false; }
      if (rule.long.stochCrossEnabled) { activeLongCondCount++; if (!(d !== null && k !== null && d < k)) isLong = false; }
      if (activeLongCondCount === 0) isLong = false;
    } else isLong = false;
    if (rule.short) {
      let activeShortCondCount = 0;
      if (rule.short.macdValueEnabled) { activeShortCondCount++; if (!(m > parseFloat(rule.short.macdValue))) isShort = false; }
      if (rule.short.macdCrossEnabled) { activeShortCondCount++; if (!(m < s)) isShort = false; }
      if (rule.short.stochCrossEnabled) { activeShortCondCount++; if (!(d !== null && k !== null && d > k)) isShort = false; }
      if (activeShortCondCount === 0) isShort = false;
    } else isShort = false;
  }
  return {
    signal: isLong ? 'long' : (isShort ? 'short' : 'hold'),
    data: { m, s, k, d }
  };
}

async function runBacktest() {
  const klines5m = await fetchKlines(SYMBOL, '5m', START_TIME, END_TIME);
  const klines1h = await fetchKlines(SYMBOL, '1h', START_TIME, END_TIME);
  const klines1d = await fetchKlines(SYMBOL, '1d', START_TIME, END_TIME);

  console.log(`Data fetched (${klines5m.length} 5m candles). Processing...`);
  const closes5m = klines5m.map(k => k.close);
  const indicators5m = { macd: calculateMACD(closes5m), stoch: calculateStochRSI(calculateRSI(closes5m)) };
  const indicators1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d.map(k => k.close))) };

    console.log(`Data fetched (${klines5m.length} 5m candles). Fetching 1m for exit precision...`);
  const klines1m = await fetchKlines(SYMBOL, '1m', ACTUAL_START_TIME, END_TIME);
  console.log(`1m data fetched (${klines1m.length} candles). Processing...`);

  let balance = INITIAL_BALANCE;
  let inTrade = null;
  const tradeHistory = [];
  let prevGlobalSignal = 'hold';

  // Optimization: 1m index pointer
  let m1Idx = 0;

  for (let i = 0; i < klines5m.length; i++) {
    const k5m = klines5m[i];
    const time = k5m.time;

    if (time < ACTUAL_START_TIME || i === 0) continue;
    
    // Always use the PREVIOUS (completed) candle data for signals
    const res5m = getSignalWithData(RULES['5m'], indicators5m.macd.macdLine[i-1], indicators5m.macd.signalLine[i-1], indicators5m.stoch.kLine[i-1], indicators5m.stoch.dLine[i-1]);
    
    // Find the latest 1h candle that ended BEFORE 'time'
    const idx1h = klines1h.findIndex(k => k.time >= time) - 1; 
    const realIdx1h = idx1h < 0 ? klines1h.length - 1 : idx1h;
    const res1h = getSignalWithData(RULES['1h'], indicators1h.macd.macdLine[realIdx1h], indicators1h.macd.signalLine[realIdx1h], indicators1h.stoch.kLine[realIdx1h], indicators1h.stoch.dLine[realIdx1h]);
    
    // Find the latest 1d candle that ended BEFORE 'time'
    const idx1d = klines1d.findIndex(k => k.time >= time) - 1;
    const realIdx1d = idx1d < 0 ? klines1d.length - 1 : idx1d;
    const res1d = getSignalWithData(RULES['1d'], indicators1d.macd.macdLine[realIdx1d], indicators1d.macd.signalLine[realIdx1d], indicators1d.stoch.kLine[realIdx1d], indicators1d.stoch.dLine[realIdx1d]);
    
    // Extra Restriction: Daily StochRSI |K - D| > 2
    const kdDiff1d = Math.abs((indicators1d.stoch.kLine[realIdx1d] || 0) - (indicators1d.stoch.dLine[realIdx1d] || 0));
    if (kdDiff1d <= 2) {
      res1d.signal = 'hold';
    }

    // Extra Restriction: Daily MACD Histogram Magnitude > 150
    const macdHist1d = Math.abs((indicators1d.macd.macdLine[realIdx1d] || 0) - (indicators1d.macd.signalLine[realIdx1d] || 0));
    if (macdHist1d <= 150) {
      res1d.signal = 'hold';
    }

    const globalSignal = (res5m.signal === 'long' && res1h.signal === 'long' && res1d.signal === 'long') ? 'long' :
                         (res5m.signal === 'short' && res1h.signal === 'short' && res1d.signal === 'short') ? 'short' : 'hold';

    if (globalSignal !== prevGlobalSignal && globalSignal !== 'hold') {
      const type = globalSignal.toUpperCase();
      const rawPrice = k5m.close;
      const entryPrice = type === 'LONG' ? rawPrice * (1 + SLIPPAGE_RATE) : rawPrice * (1 - SLIPPAGE_RATE);
      const tp = type === 'LONG' ? entryPrice * (1 + TP_PRICE_MOVE) : entryPrice * (1 - TP_PRICE_MOVE);
      const sl = type === 'LONG' ? entryPrice * (1 - SL_PRICE_MOVE) : entryPrice * (1 + SL_PRICE_MOVE);

      // Start 1m exit search
      while (m1Idx < klines1m.length && klines1m[m1Idx].time < time) m1Idx++;
      
      let exitCandle = null;
      let result = 0;
      for (let j = m1Idx; j < klines1m.length; j++) {
        const k1m = klines1m[j];
        
        // Funding Fee Deduction (Inside trade duration ONLY)
        const d = new Date(k1m.time);
        if (d.getUTCMinutes() === 0 && [0, 8, 16].includes(d.getUTCHours())) {
          balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
        }

        if (type === 'LONG') {
          if (k1m.high >= tp) { result = TARGET_NET_ROI; exitCandle = k1m; break; }
          if (k1m.low <= sl) { result = -TARGET_SL_ROI - TOTAL_FEES_ON_MARGIN; exitCandle = k1m; break; }
        } else {
          if (k1m.low <= tp) { result = TARGET_NET_ROI; exitCandle = k1m; break; }
          if (k1m.high >= sl) { result = -TARGET_SL_ROI - TOTAL_FEES_ON_MARGIN; exitCandle = k1m; break; }
        }
      }

      if (exitCandle) {
        balance *= (1 + result);
        tradeHistory.push({
          entryTimeKST: toKSTString(time), entryTimeRaw: time, type, leverage: LEVERAGE, entryPrice,
          tp, sl,
          exitTimeKST: toKSTString(exitCandle.time), exitPrice: result > 0 ? tp : sl,
          result: result > 0 ? 'WIN' : 'LOSS',
          profit: result, balance,
          details: {
            '5m': { ...res5m.data, cond: res5m.signal },
            '1h': { ...res1h.data, cond: res1h.signal },
            '1d': { ...res1d.data, cond: res1d.signal }
          }
        });
        
        // Fast-forward 5m loop to after exit candle
        while (i < klines5m.length && klines5m[i].time <= exitCandle.time) i++;
        i--; // Adjust for loop increment
        
        // Reset prevGlobalSignal so we can re-enter immediately on the next candle if conditions stay valid
        prevGlobalSignal = 'hold';
        continue;
      }
    }
    prevGlobalSignal = globalSignal;
  }

  console.log(`Simulation complete with details.`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);

  let header = 'EntryTime(KST),Type,Leverage,EntryPrice,ExitTime(KST),ExitPrice,Result,ROI% on Capital,Final Balance,';
  header += '5m_MACD,5m_Signal,5m_StochK,5m_StochD,5m_Cond,';
  header += '1h_MACD,1h_Signal,1h_StochK,1h_StochD,1h_Cond,';
  header += '1d_MACD,1d_Signal,1d_StochK,1d_StochD,1d_Cond\n';
  
  let csv = header;
  tradeHistory.forEach(t => {
    let line = `${t.entryTimeKST},${t.type},${t.leverage}x,${t.entryPrice},${t.exitTimeKST},${t.exitPrice},${t.result},${(t.profit*100).toFixed(2)}%,${t.balance.toFixed(2)},`;
    ['5m', '1h', '1d'].forEach(tf => {
      const d = t.details[tf];
      line += `${d.m?.toFixed(2)||''},${d.s?.toFixed(2)||''},${d.k?.toFixed(2)||''},${d.d?.toFixed(2)||''},${d.cond},`;
    });
    csv += line.slice(0, -1) + '\n';
  });
  
  fs.writeFileSync('C:/dev/2026_candy/backtest_trading_results_detailed_KST.csv', csv);
  console.log(`Detailed history saved to C:/dev/2026_candy/backtest_trading_results_detailed_KST.csv`);
}

runBacktest();
