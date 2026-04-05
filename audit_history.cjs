const axios = require('axios');

const SYMBOL = 'BTCUSDT';
const calculateEMA = (d, p) => {
  const ema = new Array(d.length).fill(null);
  if (d.length < p) return ema;
  let s = d.slice(0, p).reduce((a, b) => a + b, 0);
  ema[p - 1] = s / p;
  const k = 2 / (p + 1);
  for (let i = p; i < d.length; i++) ema[i] = (d[i] - ema[i - 1]) * k + ema[i - 1];
  return ema;
};
const calculateMACD = (c) => {
  const f = calculateEMA(c, 12), s = calculateEMA(c, 26);
  const m = f.map((v, i) => (v !== null && s[i] !== null) ? v - s[i] : null);
  const mF = m.filter(v => v !== null);
  const sig = calculateEMA(mF, 9);
  const sl = new Array(m.length).fill(null);
  let siIdx = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== null && siIdx < sig.length) sl[i] = sig[siIdx++];
  return { m, s: sl };
};
const calculateSMA = (d, p) => {
  const sma = new Array(d.length).fill(null);
  for (let i = p - 1; i < d.length; i++) {
    let sum = 0; for (let j = 0; j < p; j++) sum += d[i - j];
    sma[i] = sum / p;
  }
  return sma;
};
const calculateRSI = (c, p = 14) => {
  const rsi = new Array(c.length).fill(null);
  if(c.length <= p) return rsi;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  g /= p; l /= p;
  rsi[p] = 100 - 100 / (1 + g / l);
  for (let i = p+1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p;
    l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
    rsi[i] = 100 - 100 / (1 + g / l);
  }
  return rsi;
};
const calculateStochRSI = (r, p = 14) => {
  const stoch = new Array(r.length).fill(null);
  for (let i = p - 1; i < r.length; i++) {
    const w = r.slice(i - p + 1, i + 1).filter(v => v !== null);
    if (w.length < p) continue;
    const min = Math.min(...w), max = Math.max(...w);
    stoch[i] = (max - min === 0) ? 100 : ((r[i] - min) / (max - min)) * 100;
  }
  const k = calculateSMA(stoch.filter(v => v !== null), 3);
  const kl = new Array(stoch.length).fill(null);
  let ki = 0;
  for (let i = 0; i < stoch.length; i++) if (stoch[i] !== null && ki < k.length) kl[i] = k[ki++];
  const d = calculateSMA(kl.filter(v => v !== null), 3);
  const dl = new Array(kl.length).fill(null);
  let di = 0;
  for (let i = 0; i < kl.length; i++) if (kl[i] !== null && di < d.length) dl[i] = d[di++];
  return { k: kl, d: dl };
};

async function audit() {
  const k5m = (await axios.get(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=5m&limit=200`)).data;
  const k1h = (await axios.get(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=1h&limit=200`)).data;
  const k1d = (await axios.get(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=1d&limit=100`)).data;

  const i5m = { stoch: calculateStochRSI(calculateRSI(k5m.map(d=>parseFloat(d[4])))) };
  const i1h = { macd: calculateMACD(k1h.map(d=>parseFloat(d[4]))), stoch: calculateStochRSI(calculateRSI(k1h.map(d=>parseFloat(d[4])))) };
  const i1d = { macd: calculateMACD(k1d.map(d=>parseFloat(d[4]))) };

  console.log(`\n=== 📊 v6.0.0 Signal Timeline Audit (Today) ===`);
  console.log(`(Checking transitions from HOLD to SHORT)`);

  let lastSig = 'hold';
  for(let i = 100; i < k5m.length; i++) {
    const time = new Date(parseInt(k5m[i][0])).toLocaleString();
    const curTime = parseInt(k5m[i][0]);
    
    // Find matching 1h and 1d indices
    let hIdx = -1; for(let j=0; j<k1h.length; j++) { if(parseInt(k1h[j][0]) <= curTime) hIdx = j; }
    let dIdx = -1; for(let j=0; j<k1d.length; j++) { if(parseInt(k1d[j][0]) <= curTime) dIdx = j; }

    const c5 = i5m.stoch.k[i] > i5m.stoch.d[i] ? 'long' : (i5m.stoch.k[i] < i5m.stoch.d[i] ? 'short' : 'hold');
    const ch = (i1h.macd.m[hIdx] > i1h.macd.s[hIdx] && i1h.stoch.k[hIdx] > i1h.stoch.d[hIdx]) ? 'long' : (i1h.macd.m[hIdx] < i1h.macd.s[hIdx] && i1h.stoch.k[hIdx] < i1h.stoch.d[hIdx] ? 'short' : 'hold');
    const cd = i1d.macd.m[dIdx] > i1d.macd.s[dIdx] ? 'long' : (i1d.macd.m[dIdx] < i1d.macd.s[dIdx] ? 'short' : 'hold');

    let currentSig = (c5==='short' && ch==='short' && cd==='short') ? 'short' : ((c5==='long' && ch==='long' && cd==='long') ? 'long' : 'hold');

    if (currentSig !== lastSig) {
      if (currentSig === 'short') {
        console.log(`🚀 [${time}] TRIGGER: HOLD -> SHORT! (Alert should have sent!)`);
      } else {
        console.log(`💤 [${time}] EXIT: SHORT -> ${currentSig.toUpperCase()}`);
      }
    }
    lastSig = currentSig;
  }
}
audit();
