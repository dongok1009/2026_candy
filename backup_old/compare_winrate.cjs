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

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${symbol} ${interval} klines...`);
  while (allKlines.length < 5000000 && currentStart < endTime) { 
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

function simulate(strategyName, k1m, k5m_all, ind5, indH, indD, k1h_all, k1d_all, isRefined) {
  let balance = INITIAL_BALANCE;
  let wins = 0, losses = 0, cancels = 0;
  let currentPosSignal = 'hold';
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  let m5Idx = 0;

  for (let i = 1; i < k1m.length; i++) {
    const k1 = k1m[i];
    while (m5Idx < k5m_all.length && k5m_all[m5Idx].time < k1.time) m5Idx++;
    const idx5m = m5Idx - 1;
    const r1h = k1h_all.findIndex(k => k.time > k1.time - 3600000) - 1;
    const r1d = k1d_all.findIndex(k => k.time > k1.time - 86400000) - 1;

    if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

    const k5 = ind5.stoch.k[idx5m], d5 = ind5.stoch.d[idx5m];
    const m1h = indH.macd.m[r1h], s1h = indH.macd.s[r1h], kh = indH.stoch.k[r1h], dh = indH.stoch.d[r1h];
    const m1d = indD.macd.m[r1d], s1d = indD.macd.s[r1d], kd = indD.stoch.k[r1d], dd = indD.stoch.d[r1d];

    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');
    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') sig = 'short';

    if (sig !== 'hold' && sig !== currentPosSignal) {
      const prevLow = k5m_all[idx5m].low;
      const prevHigh = k5m_all[idx5m].high;
      const signalPrice = k1.open; 
      
      let entryPrice = sig === 'long' ? prevLow : prevHigh;
      if (isRefined) {
          entryPrice = sig === 'long' ? Math.min(signalPrice, prevLow) : Math.max(signalPrice, prevHigh);
      }

      let executed = false;
      let exitIdx = i;

      for (let j = i; j < k1m.length; j++) {
        const ex = k1m[j];
        if (sig === 'long' && ex.low <= entryPrice) { executed = true; exitIdx = j; break; }
        if (sig === 'short' && ex.high >= entryPrice) { executed = true; exitIdx = j; break; }
        if (j - i > 60) break;
      }

      if (executed) {
        const tpPrice = sig === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
        const slPrice = sig === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);

        for (let j = exitIdx; j < k1m.length; j++) {
          const ex = k1m[j];
          if (new Date(ex.time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(ex.time).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
          if (sig === 'long') {
            if (ex.high >= tpPrice) { balance *= (1+TARGET_NET_ROI); wins++; i = j; break; }
            if (ex.low <= slPrice) { balance *= (1-(SL_ROI + (MAKER_FEE_RATE+TAKER_FEE_RATE)*LEVERAGE)); losses++; i = j; break; }
          } else {
            if (ex.low <= tpPrice) { balance *= (1+TARGET_NET_ROI); wins++; i = j; break; }
            if (ex.high >= slPrice) { balance *= (1-(SL_ROI + (MAKER_FEE_RATE+TAKER_FEE_RATE)*LEVERAGE)); losses++; i = j; break; }
          }
        }
        currentPosSignal = sig;
      } else cancels++;
    } else currentPosSignal = sig;
  }
  return { balance, wins, losses, cancels };
}

async function runComparison() {
  const k1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const k5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const k1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const k1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const ind5 = { macd: calculateMACD(k5m_all.map(k=>k.close)), stoch: calculateStochRSI(calculateRSI(k5m_all.map(k=>k.close))) };
  const indH = { macd: calculateMACD(k1h_all.map(k=>k.close)), stoch: calculateStochRSI(calculateRSI(k1h_all.map(k=>k.close))) };
  const indD = { macd: calculateMACD(k1d_all.map(k=>k.close)), stoch: calculateStochRSI(calculateRSI(k1d_all.map(k=>k.close))) };

  const k1m = k1m_all.filter(k => k.time >= ACTUAL_START_TIME);

  const resA = simulate("v3.4.2 Original", k1m, k5m_all, ind5, indH, indD, k1h_all, k1d_all, false);
  const resB = simulate("v5.1.0 Improved", k1m, k5m_all, ind5, indH, indD, k1h_all, k1d_all, true);

  console.log(`\n--- [정밀 비교 결과] ---`);
  console.log(`기존 v3.4.2 (Limit) : $${resA.balance.toFixed(2)} | 승:${resA.wins} 패:${resA.losses} 취소:${resA.cancels} | 승률:${(resA.wins/(resA.wins+resA.losses)*100).toFixed(1)}%`);
  console.log(`개선 v5.1.0 (Best) : $${resB.balance.toFixed(2)} | 승:${resB.wins} 패:${resB.losses} 취소:${resB.cancels} | 승률:${(resB.wins/(resB.wins+resB.losses)*100).toFixed(1)}%`);
}

runComparison();
