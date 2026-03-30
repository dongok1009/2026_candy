const axios = require('axios');

// [백테스트 코드의 수식을 그대로 복사]
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
const calculateMACD = (closes) => {
  const f = calculateEMA(closes, 12);
  const s = calculateEMA(closes, 26);
  const m = f.map((fv, i) => (fv && s[i]) ? fv - s[i] : null);
  const mFiltered = m.filter(mv => mv !== null);
  const sig = calculateEMA(mFiltered, 9);
  const sigLine = new Array(m.length).fill(null);
  let sIdx = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== null && sIdx < sig.length) sigLine[i] = sig[sIdx++];
  return { m, s: sigLine };
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
  rsi[p] = 100 - 100 / (1 + g / (l || 1e-9));
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * 13 + (d > 0 ? d : 0)) / 14; l = (l * 13 + (d < 0 ? -d : 0)) / 14;
    rsi[i] = 100 - 100 / (1 + g / (l || 1e-9));
  }
  return rsi;
};

async function checkAt(timestampISO, type) {
  const targetTime = new Date(timestampISO).getTime();
  const startTime = targetTime - 500 * 3600 * 1000; // 500시간 전 데이터부터 (MACD 예열)
  
  console.log(`\n[🔍 검증 분석: ${timestampISO} ${type}]`);
  
  const intervals = ['5m', '1h', '1d'];
  for (const inv of intervals) {
    const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${inv}&startTime=${startTime}&limit=1000`);
    const data = res.data.map(d => ({ time: d[0], close: parseFloat(d[4]) }));
    const closes = data.map(d => d.close);
    
    const { m, s } = calculateMACD(closes);
    // Stoch calculation omitted for brevity, checking MACD first as major trigger
    
    // Find exact candle covering targetTime
    const intervalMs = (inv === '5m' ? 300000 : (inv === '1h' ? 3600000 : 86400000));
    const confirmedBoundary = targetTime - intervalMs;
    let idx = data.findIndex(d => d.time > confirmedBoundary) - 1;
    if (idx < 0) idx = data.length - 1;
    
    const curM = m[idx]; const curS = s[idx];
    const isOk = type === 'SHORT' ? (curM < curS) : (curM > curS);
    console.log(`${inv}: MACD=${curM?.toFixed(2)}, Signal=${curS?.toFixed(2)} -> ${isOk ? '✅ 만족' : '❌ 미흡'}`);
  }
}

async function startAudit() {
  await checkAt('2026-03-22T00:00:00Z', 'SHORT'); // 09:00 KST
  await checkAt('2025-01-11T16:05:00Z', 'LONG');  // Earlier sample
}

startAudit();
