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

const LEVERAGE = 10;
const INITIAL_BALANCE = 1000;
const MAKER_FEE_RATE = 0.0002; 
const TAKER_FEE_RATE = 0.0005; 
const EXIT_MAKER_FEE_RATE = 0.0002; 
const FUNDING_FEE_RATE = 0.0001;

const TARGET_NET_ROI = 0.06; 
const SL_ROI = 0.30; 
const HIST_THRESHOLD = 300; 

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

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

async function runV341FullLog() {
  console.log(`--- [v3.4.1] 백테스트 및 전체 로그 생성을 시작합니다 (지표 포함) ---`);

  const klines1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_all.map(k => k.close))) };

  const klines1m = klines1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  let balance = INITIAL_BALANCE;
  let currentPosSignal = 'hold'; 
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  
  const logFilePath = `C:/dev/2026_candy/v3.4.1_Full_Indicators_${new Date().toISOString().split('T')[0]}.csv`;
  const stream = fs.createWriteStream(logFilePath);
  
  // Header
  stream.write("Time,Close,Indicator_5m_K,Indicator_5m_D,MACD_1h,MACD_Sig_1h,Stoch_K_1h,Stoch_D_1h,MACD_1d,MACD_Sig_1d,Stoch_K_1d,Stoch_D_1d,Energy_1d,Signal,TradeEvent,Balance\n");

  let m5Idx = 0;
  let inTrade = false;
  let position = null; // { type, entryPrice, tpPrice, slPrice }

  for (let i = 0; i < klines1m.length; i++) {
    const k1m = klines1m[i];
    const time = k1m.time;

    // Funding fee (8h)
    if (inTrade && new Date(time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(time).getUTCHours())) {
        balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));
    }

    // Link higher timeframe indicators
    while (m5Idx < klines5m_all.length && klines5m_all[m5Idx].time < time) m5Idx++;
    const idx5m = m5Idx > 0 ? m5Idx - 1 : 0;
    
    // Find matching 1h and 1d candles
    const idx1h = klines1h_all.findIndex(k => k.time > time - 3600000) - 1;
    const idx1d = klines1d_all.findIndex(k => k.time > time - 86400000) - 1;

    const k5 = indicators5m.stoch.k[idx5m], d5 = indicators5m.stoch.d[idx5m];
    const m1h = indicators1h.macd.m[idx1h], s1h = indicators1h.macd.s[idx1h], kh = indicators1h.stoch.k[idx1h], dh = indicators1h.stoch.d[idx1h];
    const m1d = indicators1d.macd.m[idx1d], s1d = indicators1d.macd.s[idx1d], kd = indicators1d.stoch.k[idx1d], dd = indicators1d.stoch.d[idx1d];
    const hd = (m1d !== null && s1d !== null) ? m1d - s1d : 0;

    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long' && hd > HIST_THRESHOLD) sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short' && hd < -HIST_THRESHOLD) sig = 'short';

    let event = "";

    if (inTrade) {
        if (position.type === 'long') {
            if (k1m.high >= position.tpPrice) {
                balance *= (1 + TARGET_NET_ROI);
                event = "EXIT_WIN (LONG)";
                inTrade = false;
                position = null;
            } else if (k1m.low <= position.slPrice) {
                balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE));
                event = "EXIT_LOSS (LONG)";
                inTrade = false;
                position = null;
            }
        } else { // short
            if (k1m.low <= position.tpPrice) {
                balance *= (1 + TARGET_NET_ROI);
                event = "EXIT_WIN (SHORT)";
                inTrade = false;
                position = null;
            } else if (k1m.high >= position.slPrice) {
                balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE));
                event = "EXIT_LOSS (SHORT)";
                inTrade = false;
                position = null;
            }
        }
    }

    if (!inTrade && sig !== 'hold' && sig !== currentPosSignal) {
        // v3.4.0 Limit Entry logic simplified for logging
        // For the sake of logging every minute, if signal occurs we assume entry attempt
        // To be precise with v3.4.1 logic, we need to check if price hits the limit.
        const limitPrice = sig === 'long' ? klines5m_all[idx5m].low : klines5m_all[idx5m].high;
        
        if (sig === 'long' && k1m.low <= limitPrice) {
            inTrade = true;
            position = {
                type: 'long',
                entryPrice: limitPrice,
                tpPrice: limitPrice * (1 + grossTP/LEVERAGE),
                slPrice: limitPrice * (1 - SL_ROI/LEVERAGE)
            };
            event = "ENTRY (LONG)";
            currentPosSignal = sig;
        } else if (sig === 'short' && k1m.high >= limitPrice) {
            inTrade = true;
            position = {
                type: 'short',
                entryPrice: limitPrice,
                tpPrice: limitPrice * (1 - grossTP/LEVERAGE),
                slPrice: limitPrice * (1 + SL_ROI/LEVERAGE)
            };
            event = "ENTRY (SHORT)";
            currentPosSignal = sig;
        }
    } else {
        if (sig !== 'hold') currentPosSignal = sig;
    }

    // Write row
    const row = [
        toKSTString(time),
        k1m.close,
        k5 || "",
        d5 || "",
        m1h || "",
        s1h || "",
        kh || "",
        dh || "",
        m1d || "",
        s1d || "",
        kd || "",
        dd || "",
        hd,
        sig,
        event,
        balance.toFixed(2)
    ].join(",");
    stream.write(row + "\n");

    if (i % 50000 === 0) console.log(`Processing... ${((i/klines1m.length)*100).toFixed(1)}%`);
  }

  stream.end();
  console.log(`\n전체 로그 생성이 완료되었습니다: ${logFilePath}`);
}

runV341FullLog();
