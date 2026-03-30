const axios = require('axios');
const fs = require('fs');

// [복제된 수식 - 순수 검증용]
const calculateEMA = (data, period) => {
  const ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema[period-1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) ema[i] = (data[i] - ema[i-1]) * k + ema[i-1];
  return ema;
};
const calculateSMA = (data, p) => {
  const sma = new Array(data.length).fill(null);
  for (let i = p-1; i < data.length; i++) {
    let s = 0; for (let j=0; j<p; j++) s += data[i-j];
    sma[i] = s / p;
  }
  return sma;
};
const calculateMACD = (closes) => {
  const f = calculateEMA(closes, 12);
  const s = calculateEMA(closes, 26);
  const m = f.map((fv, i) => (fv && s[i]) ? fv - s[i] : null);
  const sig = calculateEMA(m.filter(mv => mv !== null), 9);
  const sigLine = new Array(m.length).fill(null);
  let sIdx = 0;
  for (let i=0; i<m.length; i++) if (m[i] !== null && sIdx < sig.length) sigLine[i] = sig[sIdx++];
  return { m, s: sigLine };
};
const calculateStochRSI = (closes) => {
  // Simple RSI simulation for verification
  const period = 14;
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return { k: rsi, d: rsi };
  let g = 0, l = 0;
  for (let i=1; i<=period; i++) {
    const d = closes[i] - closes[i-1];
    if (d >= 0) g += d; else l -= d;
  }
  g /= period; l /= period;
  rsi[period] = 100 - 100 / (1 + g/l);
  for (let i=period+1; i<closes.length; i++) {
    const d = closes[i] - closes[i-1];
    g = (g*13 + (d>0?d:0))/14; l = (l*13 + (d<0?-d:0))/14;
    rsi[i] = 100 - 100 / (1 + g/l);
  }
  const stoch = new Array(rsi.length).fill(null);
  for (let i=period; i<rsi.length; i++) {
    const win = rsi.slice(i-13, i+1).filter(v => v !== null);
    if (win.length < 14) continue;
    const min = Math.min(...win), max = Math.max(...win);
    stoch[i] = max === min ? 100 : ((rsi[i]-min)/(max-min))*100;
  }
  const kLine = calculateSMA(stoch.filter(s => s !== null), 3);
  const k = new Array(stoch.length).fill(null);
  let kIdx = 0;
  for (let i=0; i<stoch.length; i++) if (stoch[i] !== null && kIdx < kLine.length) k[i] = kLine[kIdx++];
  const dLine = calculateSMA(k.filter(kv => kv !== null), 3);
  const d = new Array(k.length).fill(null);
  let dIdx = 0;
  for (let i=0; i<k.length; i++) if (k[i] !== null && dIdx < dLine.length) d[i] = dLine[dIdx++];
  return { k, d };
};

async function verifyTrade(timestampISO, type) {
  const targetTime = new Date(timestampISO).getTime();
  const startTime = targetTime - 300 * 3600 * 1000; // Warmup
  
  const intervals = ['5m', '1h', '1d'];
  const results = {};
  
  for (const interval of intervals) {
    const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&startTime=${startTime}&limit=1000`);
    const data = res.data.map(d => ({ time: d[0], close: parseFloat(d[4]) }));
    const closes = data.map(d => d.close);
    const { m, s } = calculateMACD(closes);
    const { k, d } = calculateStochRSI(closes);
    
    const intervalMs = (interval === '5m' ? 300000 : (interval === '1h' ? 3600000 : 86400000));
    const confirmedBoundary = targetTime - intervalMs;
    const idx = data.findIndex(dVal => dVal.time > confirmedBoundary) - 1;
    const finalIdx = idx < 0 ? data.length - 1 : idx;
    
    results[interval] = {
      m: m[finalIdx], s: s[finalIdx], k: k[finalIdx], d: d[finalIdx]
    };
  }

  console.log(`\n[🔍 Verification for Entry: ${timestampISO}]`);
  console.log(`Type: ${type}`);
  let allPass = true;
  for (const tf of intervals) {
    const r = results[tf];
    const isOk = type === 'LONG' ? (r.m > r.s && r.k > r.d) : (r.m < r.s && r.k < r.d);
    console.log(`${tf}: MACD(${r.m.toFixed(2)} vs ${r.s.toFixed(2)}), Stoch(${r.k.toFixed(2)} vs ${r.d.toFixed(2)}) -> ${isOk ? '✅ PASS' : '❌ FAIL'}`);
    if (!isOk) allPass = false;
  }
  console.log(`Summary: ${allPass ? '🏆 PERFECT MATCH' : '⚠️ DISCREPANCY FOUND'}`);
}

async function audit() {
  // Sample 1: 433rd trade from CSV (User mentioned)
  await verifyTrade('2026-03-22T00:00:00Z', 'SHORT'); 
  // Sample 2: Earlier trade around 2025 Start
  await verifyTrade('2025-01-11T16:05:00Z', 'LONG');
  // Sample 3: Recent volatile point
  await verifyTrade('2026-03-23T06:00:00Z', 'SHORT');
}

audit();
