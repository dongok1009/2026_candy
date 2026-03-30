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
const TAKER_FEE_RATE = 0.0005;
const MAKER_FEE_RATE = 0.0002;
const FUNDING_FEE_RATE = 0.0001;

// v3.1.0 Settings
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
  console.log(`Fetching ${interval} klines...`);
  while (allKlines.length < 5000000 && currentStart < endTime) { 
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params: { symbol, interval, startTime: currentStart, limit: 1500 } });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { 
      if (e.response && e.response.status === 429) { await new Promise(r => setTimeout(r, 30000)); continue; }
      break; 
    }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function runV310FullLogger() {
  console.log(`--- [v3.1.0] 전지표 1분 단위 로깅 전용 백테스트 ---`);
  
  const main1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_all.map(k => k.close))) };

  const klines1m = main1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  const totalFeesOnMargin = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;

  // File Stream Setup
  const logFile = 'C:/dev/2026_candy/v310_comparison_full_log_1m.csv';
  const csvStream = fs.createWriteStream(logFile);
  csvStream.write("Time(KST),Price,5m_MACD,5m_Sig,5m_Hist,5m_StochK,5m_StochD,5m_Cond,1h_MACD,1h_Sig,1h_Hist,1h_StochK,1h_StochD,1h_Cond,1d_MACD,1d_Sig,1d_Hist,1d_StochK,1d_StochD,1d_Cond,Logic_Signal,WithRe_Pos,WithRe_Bal,NoRe_Pos,NoRe_Bal\n");

  let balWithRe = INITIAL_BALANCE; let balNoRe = INITIAL_BALANCE;
  let posWithRe = { type: 'hold', entry: 0, tp: 0, sl: 0 };
  let posNoRe = { type: 'hold', entry: 0, tp: 0, sl: 0 };
  
  let curSignalWithRe = 'hold'; let curSignalNoRe = 'hold';
  let m5Idx = 0;

  console.log(`Logging ${klines1m.length} minutes to CSV...`);

  for (let i = 0; i < klines1m.length; i++) {
    const k = klines1m[i];
    const t = k.time;

    // Previous confirmed candles
    while (m5Idx < klines5m_all.length && klines5m_all[m5Idx].time < t) m5Idx++;
    const idx5m = m5Idx - 1;
    const idx1h = klines1h_all.findIndex(k_all => k_all.time > t - 3600000) - 1;
    const r1h = idx1h < 0 ? klines1h_all.length - 1 : idx1h;
    const idx1d = klines1d_all.findIndex(k_all => k_all.time > t - 86400000) - 1;
    const r1d = idx1d < 0 ? klines1d_all.length - 1 : idx1d;

    if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

    const m5 = indicators5m.macd.m[idx5m], s5 = indicators5m.macd.s[idx5m], k5 = indicators5m.stoch.k[idx5m], d5 = indicators5m.stoch.d[idx5m];
    const m1h = indicators1h.macd.m[r1h], s1h = indicators1h.macd.s[r1h], kh = indicators1h.stoch.k[r1h], dh = indicators1h.stoch.d[r1h];
    const m1d = indicators1d.macd.m[r1d], s1d = indicators1d.macd.s[r1d], kd = indicators1d.stoch.k[r1d], dd = indicators1d.stoch.d[r1d];

    const h5 = m5-s5, hh = m1h-s1h, hd = m1d-s1d;
    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long' && hd > HIST_THRESHOLD) sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short' && hd < -HIST_THRESHOLD) sig = 'short';

    // --- Strategy 1: With Re-entry ---
    if (posWithRe.type === 'hold') {
      if (sig !== curSignalWithRe && sig !== 'hold') {
        posWithRe = { type: sig, entry: k.close, tp: sig === 'long' ? k.close * (1 + grossTP/LEVERAGE) : k.close * (1 - grossTP/LEVERAGE), sl: sig === 'long' ? k.close * (1 - SL_ROI/LEVERAGE) : k.close * (1 + SL_ROI/LEVERAGE) };
      }
      curSignalWithRe = sig;
    } else {
      // Apply Funding for Strategy 1
      if (new Date(t).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(t).getUTCHours())) balWithRe *= (1 - (FUNDING_FEE_RATE * LEVERAGE));

      if (posWithRe.type === 'long') {
        if (k.high >= posWithRe.tp) { balWithRe *= (1 + TARGET_NET_ROI); posWithRe.type = 'hold'; curSignalWithRe = 'hold'; }
        else if (k.low <= posWithRe.sl) { balWithRe *= (1 - (SL_ROI + totalFeesOnMargin)); posWithRe.type = 'hold'; curSignalWithRe = 'hold'; }
      } else {
        if (k.low <= posWithRe.tp) { balWithRe *= (1 + TARGET_NET_ROI); posWithRe.type = 'hold'; curSignalWithRe = 'hold'; }
        else if (k.high >= posWithRe.sl) { balWithRe *= (1 - (SL_ROI + totalFeesOnMargin)); posWithRe.type = 'hold'; curSignalWithRe = 'hold'; }
      }
    }

    // --- Strategy 2: No Re-entry ---
    if (posNoRe.type === 'hold') {
      if (sig !== curSignalNoRe && sig !== 'hold') {
        posNoRe = { type: sig, entry: k.close, tp: sig === 'long' ? k.close * (1 + grossTP/LEVERAGE) : k.close * (1 - grossTP/LEVERAGE), sl: sig === 'long' ? k.close * (1 - SL_ROI/LEVERAGE) : k.close * (1 + SL_ROI/LEVERAGE) };
      }
      curSignalNoRe = sig;
    } else {
      // Apply Funding for Strategy 2
      if (new Date(t).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(t).getUTCHours())) balNoRe *= (1 - (FUNDING_FEE_RATE * LEVERAGE));

      if (posNoRe.type === 'long') {
        if (k.high >= posNoRe.tp) { balNoRe *= (1 + TARGET_NET_ROI); posNoRe.type = 'hold'; curSignalNoRe = 'long'; }
        else if (k.low <= posNoRe.sl) { balNoRe *= (1 - (SL_ROI + totalFeesOnMargin)); posNoRe.type = 'hold'; curSignalNoRe = 'long'; }
      } else {
        if (k.low <= posNoRe.tp) { balNoRe *= (1 + TARGET_NET_ROI); posNoRe.type = 'hold'; curSignalNoRe = 'short'; }
        else if (k.high >= posNoRe.sl) { balNoRe *= (1 - (SL_ROI + totalFeesOnMargin)); posNoRe.type = 'hold'; curSignalNoRe = 'short'; }
      }
    }

    const row = [
        toKSTString(t), k.close,
        m5 !== null ? m5.toFixed(2) : 'null', s5 !== null ? s5.toFixed(2) : 'null', h5 !== null ? h5.toFixed(2) : 'null', k5 !== null ? k5.toFixed(2) : 'null', d5 !== null ? d5.toFixed(2) : 'null', cond5m,
        m1h !== null ? m1h.toFixed(2) : 'null', s1h !== null ? s1h.toFixed(2) : 'null', hh !== null ? hh.toFixed(2) : 'null', kh !== null ? kh.toFixed(2) : 'null', dh !== null ? dh.toFixed(2) : 'null', cond1h,
        m1d !== null ? m1d.toFixed(2) : 'null', s1d !== null ? s1d.toFixed(2) : 'null', hd !== null ? hd.toFixed(2) : 'null', kd !== null ? kd.toFixed(2) : 'null', dd !== null ? dd.toFixed(2) : 'null', cond1d,
        sig.toUpperCase(),
        posWithRe.type.toUpperCase(), posWithRe.entry.toFixed(2), balWithRe.toFixed(4),
        posNoRe.type.toUpperCase(), posNoRe.entry.toFixed(2), balNoRe.toFixed(4)
    ].join(",");
    csvStream.write(row + "\n");

    if (i % 50000 === 0) console.log(`Progress: ${((i/klines1m.length)*100).toFixed(1)}%`);
  }

  csvStream.end();
  console.log(`\n--- 로깅 완료 ---`);
  console.log(`결과 파일: ${logFile}`);
  console.log(`With Re-entry 최종 잔고: $${balWithRe.toFixed(2)}`);
  console.log(`No Re-entry 최종 잔고: $${balNoRe.toFixed(2)}`);
}

runV310FullLogger();
