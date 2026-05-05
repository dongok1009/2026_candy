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
const START_TIME = new Date('2024-09-01T00:00:00+09:00').getTime(); 
const ACTUAL_START_TIME = new Date('2025-01-01T00:00:00+09:00').getTime();
const END_TIME = new Date('2025-12-31T23:59:59+09:00').getTime();

const LEVERAGE = 5;
const INITIAL_BALANCE = 1000;
const TAKER_FEE_RATE = 0.0005;
const MAKER_FEE_RATE = 0.0002;
const FUNDING_FEE_RATE = 0.0001;

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
      await new Promise(r => setTimeout(r, 100)); 
    } catch (e) { break; }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function run2025Validation() {
  const klines5m = await fetchKlines(SYMBOL, '5m', START_TIME, END_TIME);
  const klines1h = await fetchKlines(SYMBOL, '1h', START_TIME, END_TIME);
  const klines1d = await fetchKlines(SYMBOL, '1d', START_TIME, END_TIME);
  const klines1m = await fetchKlines(SYMBOL, '1m', ACTUAL_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d.map(k => k.close))) };

  const targetConfigs = [
    { tp: 0.05, sl: 0.15, hist: 300, stoch: false },
    { tp: 0.05, sl: 0.20, hist: 300, stoch: false },
    { tp: 0.04, sl: 0.15, hist: 300, stoch: false },
    { tp: 0.03, sl: 0.10, hist: 300, stoch: true },
    { tp: 0.05, sl: 0.15, hist: 150, stoch: false },
    { tp: 0.04, sl: 0.15, hist: 150, stoch: false },
    { tp: 0.03, sl: 0.15, hist: 300, stoch: true },
    { tp: 0.05, sl: 0.20, hist: 150, stoch: false },
    { tp: 0.03, sl: 0.10, hist: 150, stoch: true },
    { tp: 0.02, sl: 0.10, hist: 0, stoch: true }
  ];

  console.log("Validating Top 10 configs for Full Year 2025...");
  const results = [];

  for (let config of targetConfigs) {
    let balance = INITIAL_BALANCE;
    let wins = 0; let losses = 0;
    let m1Idx = 0;
    let prevSignal = 'hold';

    const totalFeesOnMargin = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
    const grossTP = config.tp + totalFeesOnMargin;
    const grossSL = config.sl + totalFeesOnMargin;

    for (let i = 1; i < klines5m.length; i++) {
        const k5m = klines5m[i];
        if (k5m.time < ACTUAL_START_TIME) continue;

        const m5 = indicators5m.macd.macdLine[i-1];
        const s5 = indicators5m.macd.signalLine[i-1];
        const k5 = indicators5m.stoch.kLine[i-1];
        const d5 = indicators5m.stoch.dLine[i-1];

        const idx1h = klines1h.findIndex(k => k.time > k5m.time - 3600000) - 1;
        const r1h = idx1h < 0 ? klines1h.length - 1 : idx1h;
        const m1h = indicators1h.macd.macdLine[r1h];
        const s1h = indicators1h.macd.signalLine[r1h];
        const k1h = indicators1h.stoch.kLine[r1h];
        const d1h = indicators1h.stoch.dLine[r1h];

        const idx1d = klines1d.findIndex(k => k.time > k5m.time - 86400000) - 1;
        const r1d = idx1d < 0 ? klines1d.length - 1 : idx1d;
        const m1d = indicators1d.macd.macdLine[r1d];
        const s1d = indicators1d.macd.signalLine[r1d];
        const k1d = indicators1d.stoch.kLine[r1d];
        const d1d = indicators1d.stoch.dLine[r1d];

        let isL = (m5 > s5) && (m1h > s1h) && (m1d > s1d);
        let isS = (m5 < s5) && (m1h < s1h) && (m1d < s1d);

        if (config.stoch) {
          isL = isL && (k5 > d5) && (k1h > d1h) && (k1d > d1d);
          isS = isS && (k5 < d5) && (k1h < d1h) && (k1d < d1d);
        }
        if (config.hist > 0) {
          if (Math.abs(m1d - s1d) <= config.hist) { isL = false; isS = false; }
        }

        let global = isL ? 'long' : (isS ? 'short' : 'hold');

        if (global !== prevSignal && global !== 'hold') {
          const entryPrice = k5m.close;
          const tpPrice = global === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
          const slPrice = global === 'long' ? entryPrice * (1 - config.sl/LEVERAGE) : entryPrice * (1 + config.sl/LEVERAGE);

          while (m1Idx < klines1m.length && klines1m[m1Idx].time < k5m.time) m1Idx++;
          
          let foundExit = false;
          let exitTime = 0;
          for (let j = m1Idx; j < klines1m.length; j++) {
            const k1m = klines1m[j];
            const dObj = new Date(k1m.time);
            if (dObj.getUTCMinutes() === 0 && [0, 8, 16].includes(dObj.getUTCHours())) {
               balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
            }

            if (global === 'long') {
              if (k1m.high >= tpPrice) { balance *= (1 + config.tp); wins++; foundExit = true; exitTime = k1m.time; break; }
              if (k1m.low <= slPrice) { balance *= (1 - grossSL); losses++; foundExit = true; exitTime = k1m.time; break; }
            } else {
              if (k1m.low <= tpPrice) { balance *= (1 + config.tp); wins++; foundExit = true; exitTime = k1m.time; break; }
              if (k1m.high >= slPrice) { balance *= (1 - grossSL); losses++; foundExit = true; exitTime = k1m.time; break; }
            }
          }
          if (foundExit) {
            while (i < klines5m.length && klines5m[i].time <= exitTime) i++;
            i--;
            prevSignal = 'hold';
          }
        } else {
          prevSignal = global;
        }
    }
    results.push({ ...config, balance, winRate: (wins/(wins+losses)) || 0, trades: (wins+losses) });
  }

  console.log("2025 FULL YEAR VALIDATION RESULTS:");
  results.forEach((r, idx) => {
    console.log(`${idx+1}. TP: ${(r.tp*100).toFixed(0)}%, SL: ${(r.sl*100).toFixed(0)}%, Hist: ${r.hist}, Stoch: ${r.stoch?'ON':'OFF'}, WR: ${(r.winRate*100).toFixed(1)}%, TR: ${r.trades}, Final: $${r.balance.toFixed(2)}`);
  });
}

run2025Validation();
