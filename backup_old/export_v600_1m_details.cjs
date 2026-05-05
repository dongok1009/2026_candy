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

// --- Config ---
const SYMBOL = 'BTCUSDT';
const START_TIME = new Date('2025-01-01T00:00:00+09:00').getTime();
const END_TIME = new Date('2025-03-01T00:00:00+09:00').getTime();
const FETCH_START_TIME = new Date('2024-10-01T00:00:00+09:00').getTime(); // Extra warm up

const LEVERAGE = 5;
const INITIAL_BALANCE = 1000;
const MAKER_FEE_RATE = 0.0002;
const TAKER_FEE_RATE = 0.0005;
const EXIT_MAKER_FEE_RATE = 0.0002;
const FUNDING_FEE_RATE = 0.0001;
const TARGET_NET_ROI = 0.03;
const SL_ROI = 0.15;

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${symbol} ${interval} ...`);
  while (currentStart < endTime) {
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params: { symbol, interval, startTime: currentStart, limit: 1500 } });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600));
    } catch (e) { break; }
  }
  return allKlines.filter(d => d[0] <= endTime).map(d => ({
    time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
  }));
}

async function exportMinuteDetail() {
  const klines1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const ind5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const ind1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const ind1d = { macd: calculateMACD(klines1d_all.map(k => k.close)) };

  let balance = INITIAL_BALANCE;
  let currentPos = null; // { side, entryPrice, tpPrice, slPrice, entryTime }
  let currentPosSignal = 'hold';
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;

  const header = "Time_KST,1m_Open,1m_High,1m_Low,1m_Close,5m_K,5m_D,1h_MACD,1h_Sig,1h_K,1h_D,1d_MACD,1d_Sig,GlobalSignal,PositionSide,EntryPrice,ExitPrice,Current_ROI,Balance";
  const output = [header];
  let m5Idx = 0;

  console.log("Processing minute by minute...");
  const klines1m = klines1m_all.filter(k => k.time >= START_TIME);

  for (let i = 0; i < klines1m.length; i++) {
    const k1 = klines1m[i];
    const time = k1.time;

    while (m5Idx < klines5m_all.length && klines5m_all[m5Idx].time < time) m5Idx++;
    const idx5m = m5Idx - 1;
    const r1h = klines1h_all.findIndex(k => k.time > time - 3600000) - 1;
    const r1d = klines1d_all.findIndex(k => k.time > time - 86400000) - 1;

    if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

    const k5 = ind5m.stoch.k[idx5m], d5 = ind5m.stoch.d[idx5m];
    const m1h = ind1h.macd.m[r1h], s1h = ind1h.macd.s[r1h], kh = ind1h.stoch.k[r1h], dh = ind1h.stoch.d[r1h];
    const m1d = ind1d.macd.m[r1d], s1d = ind1d.macd.s[r1d];

    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d) ? 'long' : (m1d < s1d ? 'short' : 'hold');

    let gSig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') gSig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') gSig = 'short';

    let row_exitPrice = "", row_roi = "";

    // 1. Position Logic
    if (currentPos) {
      if (new Date(k1.time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(k1.time).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
      
      let closed = false;
      if (currentPos.side === 'long') {
        const curROI = ((k1.close - currentPos.entryPrice) / currentPos.entryPrice) * LEVERAGE;
        if (k1.high >= currentPos.tpPrice) {
          balance *= (1 + TARGET_NET_ROI); closed = true; row_exitPrice = currentPos.tpPrice; row_roi = "3.00%";
        } else if (k1.low <= currentPos.slPrice) {
          balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE)); closed = true; row_exitPrice = currentPos.slPrice; row_roi = "-15.00%";
        }
      } else {
        const curROI = ((currentPos.entryPrice - k1.close) / currentPos.entryPrice) * LEVERAGE;
        if (k1.low <= currentPos.tpPrice) {
          balance *= (1 + TARGET_NET_ROI); closed = true; row_exitPrice = currentPos.tpPrice; row_roi = "3.00%";
        } else if (k1.high >= currentPos.slPrice) {
          balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE)); closed = true; row_exitPrice = currentPos.slPrice; row_roi = "-15.00%";
        }
      }
      if (closed) currentPos = null;
    }

    // 2. Entry Logic (Only if no position)
    if (!currentPos && gSig !== 'hold' && gSig !== currentPosSignal) {
        // Simple Market-Better Entry for Detail Log
        const entryPrice = gSig === 'long' ? Math.min(k1.close, klines5m_all[idx5m].low) : Math.max(k1.close, klines5m_all[idx5m].high);
        const tpPrice = gSig === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
        const slPrice = gSig === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);
        currentPos = { side: gSig, entryPrice, tpPrice, slPrice, entryTime: k1.time };
    }
    currentPosSignal = gSig;

    output.push(`${toKSTString(k1.time)},${k1.open},${k1.high},${k1.low},${k1.close},${k5.toFixed(2)},${d5.toFixed(2)},${m1h.toFixed(2)},${s1h.toFixed(2)},${kh.toFixed(2)},${dh.toFixed(2)},${m1d.toFixed(2)},${s1d.toFixed(2)},${gSig.toUpperCase()},${currentPos ? currentPos.side.toUpperCase() : ""},${currentPos ? currentPos.entryPrice.toFixed(2) : ""},${row_exitPrice},${row_roi},${balance.toFixed(2)}`);
  }

  fs.writeFileSync('C:/dev/2026_candy/v600_1m_detail_250101_250301.csv', output.join('\n'));
  console.log("Export complete: v600_1m_detail_250101_250301.csv");
}
exportMinuteDetail();
