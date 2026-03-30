const axios = require('axios');
const fs = require('fs');

// --- Indicators Logic ---
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
  const nonNullStoch = stoch.filter(s => s !== null);
  const kLineValues = calculateSMA(nonNullStoch, k);
  const kLine = new Array(stoch.length).fill(null);
  let kIdx = 0;
  for (let i = 0; i < stoch.length; i++) if (stoch[i] !== null && kIdx < kLineValues.length) kLine[i] = kLineValues[kIdx++];
  const nonNullK = kLine.filter(kVal => kVal !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  return { k: kLine, d: dLine };
};

// --- Config ---
const SYMBOL = 'BTCUSDT';
const FETCH_START_TIME = new Date('2024-12-01T00:00:00+09:00').getTime(); 
const ACTUAL_START_TIME = new Date('2025-01-01T00:00:00+09:00').getTime();
const END_TIME = Date.now();

const LEVERAGE = 5;
const INITIAL_BALANCE = 1000;
const MAKER_FEE_RATE = 0.0002; 
const TAKER_FEE_RATE = 0.0005; 
const EXIT_MAKER_FEE_RATE = 0.0002; 
const FUNDING_FEE_RATE = 0.0001;

const TARGET_NET_ROI = 0.03; 
const SL_ROI = 0.15; 
const HIST_THRESHOLD = 300; 

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${symbol} ${interval}...`);
  while (allKlines.length < 10000000 && currentStart < endTime) { 
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params: { symbol, interval, startTime: currentStart, limit: 1500 } });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { break; }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function runV340FastLogger() {
  const today = new Date().toISOString().split('T')[0];
  const logFile = `C:/dev/2026_candy/v3.4.0_Full_Indicators_${today}.csv`;
  const csvStream = fs.createWriteStream(logFile);

  const writeRow = (t, price, k5, d5, c5, m1h, s1h, kh, dh, ch, m1d, s1d, hd, kd, dd, cd, sig, limit, posT, entry, tp, sl, bal) => {
    const row = [
      toKSTString(t), price,
      k5 !== null ? k5.toFixed(2) : 'null', d5 !== null ? d5.toFixed(2) : 'null', c5,
      m1h !== null ? m1h.toFixed(2) : 'null', s1h !== null ? s1h.toFixed(2) : 'null', kh !== null ? kh.toFixed(2) : 'null', dh !== null ? dh.toFixed(2) : 'null', ch,
      m1d !== null ? m1d.toFixed(2) : 'null', s1d !== null ? s1d.toFixed(2) : 'null', hd !== null ? hd.toFixed(2) : 'null', kd !== null ? kd.toFixed(2) : 'null', dd !== null ? dd.toFixed(2) : 'null', cd,
      sig.toUpperCase(), limit ? limit.toFixed(2) : 0, posT.toUpperCase(), entry ? entry.toFixed(2) : 0, tp ? tp.toFixed(2) : 0, sl ? sl.toFixed(2) : 0, bal.toFixed(4)
    ].join(",");
    csvStream.write(row + "\n");
  };

  console.log(`--- [v3.4.0] 전지표 로깅 백테스트 (속도 최적화 버전) ---`);
  const klines1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_all.map(k => k.close))) };

  const klines1m = klines1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  let balance = INITIAL_BALANCE;
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  
  csvStream.write(["Time(KST)", "Price", "5m_K", "5m_D", "5m_Cond", "1h_MACD", "1h_Sig", "1h_K", "1h_D", "1h_Cond", "1d_MACD", "1d_Sig", "1d_Hist", "1d_K", "1d_D", "1d_Cond", "Logic_Signal", "Limit_Price", "Pos_Type", "Entry", "TP", "SL", "Balance"].join(",") + "\n");

  let idx5m = 0, idx1h = 0, idx1d = 0;
  let curSigTrack = 'hold', wins = 0, losses = 0, cancels = 0;
  let position = { type: 'hold', entry: 0, tp: 0, sl: 0 };
  let pendingLimit = { active: false, price: 0, type: 'hold', expiry: 0 };

  console.log(`로깅 진행 중... (${klines1m.length}분)`);

  for (let i = 0; i < klines1m.length; i++) {
    const k1 = klines1m[i], t = k1.time;

    // 포인터 기반 최적화 탐색
    while (idx5m < klines5m_all.length && klines5m_all[idx5m].time <= t - 300000) idx5m++;
    let r5m = idx5m - 1; if (r5m < 0) r5m = 0;
    
    while (idx1h < klines1h_all.length && klines1h_all[idx1h].time <= t - 3600000) idx1h++;
    let r1h = idx1h - 1; if (r1h < 0) r1h = 0;
    
    while (idx1d < klines1d_all.length && klines1d_all[idx1d].time <= t - 86400000) idx1d++;
    let r1d = idx1d - 1; if (r1d < 0) r1d = 0;

    const k5=indicators5m.stoch.k[r5m], d5=indicators5m.stoch.d[r5m], m1h=indicators1h.macd.m[r1h], s1h=indicators1h.macd.s[r1h], kh=indicators1h.stoch.k[r1h], dh=indicators1h.stoch.d[r1h], m1d=indicators1d.macd.m[r1d], s1d=indicators1d.macd.s[r1d], kd=indicators1d.stoch.k[r1d], dd=indicators1d.stoch.d[r1d];

    if (k5===null || d5===null || m1h===null || s1h===null || kh===null || dh===null || m1d===null || s1d===null || kd===null || dd===null) {
      writeRow(t, k1.close, k5, d5, 'hold', m1h, s1h, kh, dh, 'hold', m1d, s1d, 0, kd, dd, 'hold', 'HOLD', 0, position.type, position.entry, position.tp, position.sl, balance);
      continue;
    }

    const hd = m1d - s1d;
    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long' && hd > HIST_THRESHOLD) sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short' && hd < -HIST_THRESHOLD) sig = 'short';

    if (position.type === 'hold') {
      if (!pendingLimit.active) {
        if (sig !== 'hold' && sig !== curSigTrack) {
          pendingLimit = { active: true, price: sig === 'long' ? klines5m_all[r5m].low : klines5m_all[r5m].high, type: sig, expiry: t + 3600000 };
        }
      } else {
        let hit = (pendingLimit.type === 'long' && k1.low <= pendingLimit.price) || (pendingLimit.type === 'short' && k1.high >= pendingLimit.price);
        if (hit) {
          position = { type: pendingLimit.type, entry: pendingLimit.price, tp: pendingLimit.type === 'long' ? pendingLimit.price * (1 + grossTP/LEVERAGE) : pendingLimit.price * (1 - grossTP/LEVERAGE), sl: pendingLimit.type === 'long' ? pendingLimit.price * (1 - SL_ROI/LEVERAGE) : pendingLimit.price * (1 + SL_ROI/LEVERAGE) };
          curSigTrack = pendingLimit.type; pendingLimit.active = false;
        } else if (t >= pendingLimit.expiry) { pendingLimit.active = false; cancels++; }
      }
      if (sig !== 'hold') curSigTrack = sig;
    } else {
      if (new Date(t).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(t).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
      let isTP = (position.type === 'long' && k1.high >= position.tp) || (position.type === 'short' && k1.low <= position.tp);
      let isSL = (position.type === 'long' && k1.low <= position.sl) || (position.type === 'short' && k1.high >= position.sl);
      if (isTP) { balance *= (1 + TARGET_NET_ROI); wins++; position.type = 'hold'; }
      else if (isSL) { balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE)*LEVERAGE)); losses++; position.type = 'hold'; }
    }

    writeRow(t, k1.close, k5, d5, cond5m, m1h, s1h, kh, dh, cond1h, m1d, s1d, hd, kd, dd, cond1d, sig, pendingLimit.active ? pendingLimit.price : 0, position.type, position.entry, position.tp, position.sl, balance);
    if (i % 100000 === 0) console.log(`${((i/klines1m.length)*100).toFixed(0)}% 완료...`);
  }
  csvStream.end();
  console.log(`\n--- v3.4.0 통계 ---`);
  console.log(`최종 잔고: $${balance.toFixed(2)} | 승: ${wins}, 패: ${losses}, 취소: ${cancels} | 승률: ${((wins/(wins+losses))*100).toFixed(1)}%`);
}

runV340FastLogger();
