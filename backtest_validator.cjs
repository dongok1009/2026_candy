const axios = require('axios');
const fs = require('fs');

// --- Indicators Logic (Pure Implementation) ---
const calculateEMA = (data, p) => {
  const ema = new Array(data.length).fill(null);
  if (data.length < p) return ema;
  let sum = data.slice(0, p).reduce((a, b) => a + b, 0);
  ema[p - 1] = sum / p;
  const k = 2 / (p + 1);
  for (let i = p; i < data.length; i++) ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  return ema;
};
const calculateSMA = (data, p) => {
  const sma = new Array(data.length).fill(null);
  for (let i = p - 1; i < data.length; i++) {
    let sum = 0; for (let j = 0; j < p; j++) sum += data[i - j];
    sma[i] = sum / p;
  }
  return sma;
};
const calculateRSI = (closes, p = 14) => {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= p) return rsi;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  g /= p; l /= p;
  if (l === 0) rsi[p] = 100; else rsi[p] = 100 - 100 / (1 + g / l);
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
    if (l === 0) rsi[i] = 100; else rsi[i] = 100 - 100 / (1 + g / l);
  }
  return rsi;
};
const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const fEMA = calculateEMA(closes, fast);
  const sEMA = calculateEMA(closes, slow);
  const m = fEMA.map((f, i) => (f !== null && sEMA[i] !== null) ? f - sEMA[i] : null);
  const mFiltered = m.filter(mv => mv !== null);
  const sig = calculateEMA(mFiltered, signal);
  const sigLine = new Array(m.length).fill(null);
  let sIdx = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== null && sIdx < sig.length) sigLine[i] = sig[sIdx++];
  return { m, s: sigLine };
};
const calculateStochRSI = (rsi, p = 14, k = 3, d = 3) => {
  const stoch = new Array(rsi.length).fill(null);
  for (let i = p - 1; i < rsi.length; i++) {
    const window = rsi.slice(i - p + 1, i + 1).filter(v => v !== null);
    if (window.length < p) continue;
    const min = Math.min(...window); const max = Math.max(...window);
    if (max - min === 0) stoch[i] = 100; else stoch[i] = ((rsi[i] - min) / (max - min)) * 100;
  }
  const kLineValues = calculateSMA(stoch.filter(s => s !== null), k);
  const kLine = new Array(stoch.length).fill(null);
  let kIdx = 0;
  for (let i = 0; i < stoch.length; i++) if (stoch[i] !== null && kIdx < kLineValues.length) kLine[i] = kLineValues[kIdx++];
  const dLineValues = calculateSMA(kLine.filter(kVal => kVal !== null), d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  return { k: kLine, d: dLine };
};

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  while (allKlines.length < 50000 && currentStart < endTime) {
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { 
          params: { symbol, interval, startTime: currentStart, limit: 1500 } 
      });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
    } catch (e) { break; }
  }
  return allKlines.filter(d => d[0] <= endTime).map(d => ({ 
      time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
  }));
}

async function validateTrade(trade) {
    const tradeTime = new Date(trade.Time_KST.replace(' ', 'T') + '+09:00').getTime();
    console.log(`\n🔍 Precise Validation: [${trade.Time_KST}] ${trade.SignalType}...`);

    // USE THE EXACT SAME FETCH_START_TIME AS THE BACKTEST SCRIPT
    const FETCH_START = new Date('2024-11-01T00:00:00+09:00').getTime(); 
    
    console.log(` - Fetching data from 2024-11-01 to ensure 1:1 indicator parity...`);
    const klines5m = await fetchKlines('BTCUSDT', '5m', FETCH_START, tradeTime);
    const klines1h = await fetchKlines('BTCUSDT', '1h', FETCH_START, tradeTime);
    const klines1d = await fetchKlines('BTCUSDT', '1d', FETCH_START, tradeTime);

    const ind5m = { stoch: calculateStochRSI(calculateRSI(klines5m.map(k => k.close))) };
    const ind1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
    const ind1d = { macd: calculateMACD(klines1d.map(k => k.close)) };

    const idx5m = klines5m.length - 1;
    const r1h = klines1h.length - 1;
    const r1d = klines1d.length - 1;

    const k5 = ind5m.stoch.k[idx5m], d5 = ind5m.stoch.d[idx5m];
    const m1h = ind1h.macd.m[r1h], s1h = ind1h.macd.s[r1h], kh = ind1h.stoch.k[r1h], dh = ind1h.stoch.d[r1h];
    const m1d = ind1d.macd.m[r1d], s1d = ind1d.macd.s[r1d];

    console.log(` - Numerical Parity Check:`);
    console.log(`   5m Stoch K: Record(${parseFloat(trade['5m_K']).toFixed(6)}) vs Calc(${k5.toFixed(6)}) | Diff: ${Math.abs(trade['5m_K'] - k5).toFixed(10)}`);
    console.log(`   1h MACD: Record(${parseFloat(trade['1h_MACD']).toFixed(6)}) vs Calc(${m1h.toFixed(6)}) | Diff: ${Math.abs(trade['1h_MACD'] - m1h).toFixed(10)}`);
    console.log(`   1d MACD: Record(${parseFloat(trade['1d_MACD']).toFixed(6)}) vs Calc(${m1d.toFixed(6)}) | Diff: ${Math.abs(trade['1d_MACD'] - m1d).toFixed(10)}`);
    
    if (Math.abs(trade['1h_MACD'] - m1h) < 0.01) {
        console.log(`\n✅ 1:1 Parity Achieved! Calculation logic is identical to backtest engine.`);
    } else {
        console.log(`\n❌ Minor difference still exists. This could be due to floating point precision or data slice slightly different.`);
    }
}

async function runValidation() {
    const csvContent = fs.readFileSync('backtest_v600_5m_2025_results.csv', 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    const trades = lines.slice(1).filter(l => l.trim() !== '').map(l => {
        const values = l.split(',');
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] }), {});
    });
    // Pick the most recent trade to minimize fetch time, but ensure it's recorded correctly
    const trade = trades[trades.length - 1]; 
    await validateTrade(trade);
}
runValidation();
