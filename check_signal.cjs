const axios = require('axios');

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
  const fEMA = calculateEMA(closes, fast);
  const sEMA = calculateEMA(closes, slow);
  const macdLine = fEMA.map((f, i) => (f !== null && sEMA[i] !== null) ? f - sEMA[i] : null);
  const nonNullMacd = macdLine.filter(m => m !== null);
  const signalEMA = calculateEMA(nonNullMacd, signal);
  const signalLine = new Array(macdLine.length).fill(null);
  let sIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && sIdx < signalEMA.length) signalLine[i] = signalEMA[sIdx++];
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
  const nonNullK = kLine.filter(kv => kv !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  }
  return { kLine, dLine };
};

async function checkDate() {
  const SYMBOL = 'BTCUSDT';
  // 2026-03-22 09:00 KST = 2026-03-22 00:00 UTC
  const targetTime = new Date('2026-03-22T00:00:00Z').getTime();
  const startTime = targetTime - 200 * 3600 * 1000; // 200 hours back
  
  try {
    const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${SYMBOL}&interval=1h&startTime=${startTime}&limit=500`);
    const data = res.data.map(d => ({ time: d[0], close: parseFloat(d[4]) }));
    const closes = data.map(d => d.close);
    
    const { macdLine, signalLine } = calculateMACD(closes);
    const { kLine, dLine } = calculateStochRSI(calculateRSI(closes));
    
    console.log('--- 1h Indicators Verification (KST) ---');
    for (let i = 0; i < data.length; i++) {
      if (data[i].time >= targetTime - 6 * 3600 * 1000 && data[i].time <= targetTime) {
        const kstTime = new Date(data[i].time + 9 * 3600 * 1000).toISOString().replace('T', ' ').replace(/\..+/, '');
        const m = macdLine[i];
        const s = signalLine[i];
        const k = kLine[i];
        const d = dLine[i];
        const isShort = (m < s) && (k < d);
        console.log(`[${kstTime}] MACD: ${m.toFixed(2)}, Signal: ${s.toFixed(2)} | StochK: ${k.toFixed(2)}, StochD: ${d.toFixed(2)} | 1h_SHORT_COND: ${isShort ? 'O' : 'X'}`);
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}

checkDate();
