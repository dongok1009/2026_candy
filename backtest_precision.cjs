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
  return { macdLine, signalLine };
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
const START_TIME = new Date('2025-01-01T00:00:00+09:00').getTime(); 
const ACTUAL_START_TIME = new Date('2026-01-01T00:00:00+09:00').getTime();
const END_TIME = Date.now();

const LEVERAGE = 5;
const TARGET_NET_ROI = 0.03; // 3%
const TARGET_SL_ROI = 0.15; // 15%
const INITIAL_BALANCE = 1000;
const TRADE_AMOUNT = 100; // Fixed $100 margin per trade

const TAKER_FEE_RATE = 0.0005;
const MAKER_FEE_RATE = 0.0002;
const FUNDING_FEE_RATE = 0.0001;

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${interval} klines...`);
  while (currentStart < endTime) { 
    try {
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
        params: { symbol, interval, startTime: currentStart, limit: 1500 }
      });
      if (response.data.length === 0) break;
      allKlines.push(...response.data);
      currentStart = response.data[response.data.length - 1][0] + 1;
      if (response.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 150)); 
    } catch (e) { console.log(e.message); break; }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function runHighPrecisionBacktest() {
  const klines5m = await fetchKlines(SYMBOL, '5m', START_TIME, END_TIME);
  const klines1h = await fetchKlines(SYMBOL, '1h', START_TIME, END_TIME);
  const klines1d = await fetchKlines(SYMBOL, '1d', START_TIME, END_TIME);
  const klines1m = await fetchKlines(SYMBOL, '1m', ACTUAL_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d.map(k => k.close))) };

  let balance = INITIAL_BALANCE;
  let prevGlobalSignal = 'hold';
  const totalFeesOnMargin = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
  
  // Mapping klines to time-based lookup
  const getIdx = (data, time, intervalMs) => {
    const boundary = time - intervalMs;
    const idx = data.findIndex(k => k.time > boundary) - 1;
    return idx < 0 ? -1 : idx;
  };

  const output = [];
  output.push("Time(KST),Price,5m_MACD,5m_Sig,5m_K,5m_D,1h_MACD,1h_Sig,1h_K,1h_D,1d_MACD,1d_Sig,1d_K,1d_D,TradeAction,Result,TradeBalance");

  let activeTrade = null;
  let m5Idx = 0;

  for (let i = 0; i < klines1m.length; i++) {
    const k1m = klines1m[i];
    const time = k1m.time;

    // Find indices for current candle
    while (m5Idx < klines5m.length && klines5m[m5Idx].time <= time) m5Idx++;
    const idx5m = m5Idx - 2; // Previous confirmed 5m candle
    
    const idx1h = getIdx(klines1h, time, 3600000);
    const idx1d = getIdx(klines1d, time, 86400000);

    const m5 = idx5m >= 0 ? indicators5m.macd.macdLine[idx5m] : null;
    const s5 = idx5m >= 0 ? indicators5m.macd.signalLine[idx5m] : null;
    const k5 = idx5m >= 0 ? indicators5m.stoch.kLine[idx5m] : null;
    const d5 = idx5m >= 0 ? indicators5m.stoch.dLine[idx5m] : null;

    const m1h = idx1h >= 0 ? indicators1h.macd.macdLine[idx1h] : null;
    const s1h = idx1h >= 0 ? indicators1h.macd.signalLine[idx1h] : null;
    const k1h = idx1h >= 0 ? indicators1h.stoch.kLine[idx1h] : null;
    const d1h = idx1h >= 0 ? indicators1h.stoch.dLine[idx1h] : null;

    const m1d = idx1d >= 0 ? indicators1d.macd.macdLine[idx1d] : null;
    const s1d = idx1d >= 0 ? indicators1d.macd.signalLine[idx1d] : null;
    const k1d = idx1d >= 0 ? indicators1d.stoch.kLine[idx1d] : null;
    const d1d = idx1d >= 0 ? indicators1d.stoch.dLine[idx1d] : null;

    let tradeAction = "";
    let tradeResult = "";

    if (activeTrade) {
      // Funding Fee check
      const dObj = new Date(time);
      if (dObj.getUTCMinutes() === 0 && [0, 8, 16].includes(dObj.getUTCHours())) {
        balance -= (TRADE_AMOUNT * FUNDING_FEE_RATE * LEVERAGE);
      }

      const { type, entryPrice, tp, sl } = activeTrade;
      let exitResult = 0;
      let exited = false;

      if (type === 'LONG') {
        if (k1m.high >= tp) { exitResult = TARGET_NET_ROI; exited = true; tradeResult = "WIN"; }
        else if (k1m.low <= sl) { exitResult = -TARGET_SL_ROI - totalFeesOnMargin; exited = true; tradeResult = "LOSS"; }
      } else {
        if (k1m.low <= tp) { exitResult = TARGET_NET_ROI; exited = true; tradeResult = "WIN"; }
        else if (k1m.high >= sl) { exitResult = -TARGET_SL_ROI - totalFeesOnMargin; exited = true; tradeResult = "LOSS"; }
      }

      if (exited) {
        const profitDollars = TRADE_AMOUNT * exitResult;
        balance += profitDollars;
        tradeAction = `EXIT_${type}`;
        activeTrade = null;
        prevGlobalSignal = 'hold'; // Re-entry logic
      }
    } else {
      // Check entry
      let isL = (m5 > s5 && k5 > d5) && (m1h > s1h && k1h > d1h) && (m1d > s1d && k1d > d1d);
      let isS = (m5 < s5 && k5 < d5) && (m1h < s1h && k1h < d1h) && (m1d < s1d && k1d < d1d);
      
      let global = isL ? 'long' : (isS ? 'short' : 'hold');

      if (global !== prevGlobalSignal && global !== 'hold') {
        const type = global.toUpperCase();
        const entryPrice = k1m.close;
        const tp = type === 'LONG' ? entryPrice * (1 + (TARGET_NET_ROI + totalFeesOnMargin)/LEVERAGE) : entryPrice * (1 - (TARGET_NET_ROI + totalFeesOnMargin)/LEVERAGE);
        const sl = type === 'LONG' ? entryPrice * (1 - (TARGET_SL_ROI)/LEVERAGE) : entryPrice * (1 + (TARGET_SL_ROI)/LEVERAGE);
        
        activeTrade = { type, entryPrice, tp, sl };
        tradeAction = `ENTER_${type}`;
      }
      prevGlobalSignal = global;
    }

    const line = [
      toKSTString(time), k1m.close,
      m5?.toFixed(2), s5?.toFixed(2), k5?.toFixed(2), d5?.toFixed(2),
      m1h?.toFixed(2), s1h?.toFixed(2), k1h?.toFixed(2), d1h?.toFixed(2),
      m1d?.toFixed(2), s1d?.toFixed(2), k1d?.toFixed(2), d1d?.toFixed(2),
      tradeAction, tradeResult, balance.toFixed(2)
    ].join(",");
    output.push(line);
  }

  fs.writeFileSync('C:/dev/2026_candy/backtest_high_precision_1m.csv', output.join("\n"));
  console.log(`Simulation complete. High precision log saved to C:/dev/2026_candy/backtest_high_precision_1m.csv`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);
}

runHighPrecisionBacktest();
