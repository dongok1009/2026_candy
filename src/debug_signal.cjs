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

async function check() {
  try {
    const resH = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=1h&limit=100`);
    const kH = resH.data.map(d => ({ close: parseFloat(d[4]), time:d[0]}));
    const resD = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=1d&limit=100`);
    const kD = resD.data.map(d => ({ close: parseFloat(d[4]), time:d[0]}));
    
    const iH_MACD = calculateMACD(kH.map(k=>k.close));
    const iH_Stoch = calculateStochRSI(calculateRSI(kH.map(k=>k.close)));
    const iD_MACD = calculateMACD(kD.map(k=>k.close));

    const curH = kH.length - 1;
    const curD = kD.length - 1;
    
    const m1h = iH_MACD.m[curH], s1h = iH_MACD.s[curH], kh = iH_Stoch.k[curH], dh = iH_Stoch.d[curH];
    const m1d = iD_MACD.m[curD], s1d = iD_MACD.s[curD];
    
    console.log(`\n=== Live Signal Debug [v6.0.0 Deployed Version] ===`);
    console.log(`Report Time: ${new Date().toLocaleString()}`);
    console.log(`1D MACD: ${m1d < s1d ? 'SHORT' : 'LONG'} (${m1d.toFixed(2)} vs ${s1d.toFixed(2)})`);
    console.log(`1H MACD: ${m1h < s1h ? 'SHORT' : 'LONG'} (${m1h.toFixed(2)} vs ${s1h.toFixed(2)})`);
    console.log(`1H Stoch: ${kh < dh ? 'SHORT' : 'LONG'} (${kh.toFixed(2)} vs ${dh.toFixed(2)})`);
    
    const isShortActive = (m1d < s1d && m1h < s1h && kh < dh);
    console.log(`\nFinal v6.0.0 SHORT SIGNAL Triggered? -> ${isShortActive ? '✅ YES' : '❌ NO (Filtered by 1D or Momentum)'}`);
    
    if(!isShortActive && (m1h < s1h && kh < dh)) {
      console.log(`\n🧐 [분석 결과]: 1H와 5M 지표는 숏이 맞으나, 1D(일봉) MACD가 아직 롱(Long) 방향이라 신호가 억제되었습니다.`);
    }
  } catch (err) { console.error(err.message); }
}
check();
