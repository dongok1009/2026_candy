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

// v3.2.0 Settings (Break-even Test)
const TARGET_NET_ROI = 0.03; 
const SL_ROI = 0.15; 
const BE_ROI_TRIGGER = 0.015; // 1.5% Reach Trigger
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
      const lastTime = res.data[res.data.length - 1][0];
      currentStart = lastTime + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { 
      if (e.response && e.response.status === 429) { console.log(`Rate limit (429). Waiting 30s...`); await new Promise(r => setTimeout(r, 30000)); continue; }
      console.log(`Error: ${e.message}`); break; 
    }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function runV320BreakEven() {
  console.log(`--- [v3.2.0] 백테스트: 본절가 손절(Break-even) 로직 테스트 ---`);
  console.log(`수익 ${BE_ROI_TRIGGER*100}% 도달 시 손절가를 진입가로 변경`);

  const main1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_all.map(k => k.close))) };

  const klines1m = main1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  let balance = INITIAL_BALANCE;
  let wins = 0; let losses = 0; let breakEvens = 0;
  let currentSignal = 'hold';
  const totalFeesOnMargin = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  
  const output = ["Time(KST),Type,Entry,Exit,Result,ROI%,Final Balance"];
  let m5Idx = 0;

  for (let i = 0; i < klines1m.length; i++) {
    const k1m = klines1m[i];
    const time = k1m.time;

    // Confirms
    while (m5Idx < klines5m_all.length && klines5m_all[m5Idx].time < time) m5Idx++;
    const idx5m = m5Idx - 1;
    const idx1h = klines1h_all.findIndex(k => k.time > time - 3600000) - 1;
    const r1h = idx1h < 0 ? klines1h_all.length - 1 : idx1h;
    const idx1d = klines1d_all.findIndex(k => k.time > time - 86400000) - 1;
    const r1d = idx1d < 0 ? klines1d_all.length - 1 : idx1d;

    if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

    const k5 = indicators5m.stoch.k[idx5m], d5 = indicators5m.stoch.d[idx5m];
    const m1h = indicators1h.macd.m[r1h], s1h = indicators1h.macd.s[r1h], kh = indicators1h.stoch.k[r1h], dh = indicators1h.stoch.d[r1h];
    const m1d = indicators1d.macd.m[r1d], s1d = indicators1d.macd.s[r1d], kd = indicators1d.stoch.k[r1d], dd = indicators1d.stoch.d[r1d];
    const hd = m1d - s1d;

    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long' && hd > HIST_THRESHOLD) sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short' && hd < -HIST_THRESHOLD) sig = 'short';

    if (sig !== currentSignal && sig !== 'hold') {
      const entryPrice = k1m.close;
      const tpPrice = sig === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
      let slPrice = sig === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);
      let isBreakEvenTriggered = false;

      let foundExit = false; let exitTime = 0; let resType = ""; let roiStr = "";

      for (let j = i; j < klines1m.length; j++) {
        const ex = klines1m[j];
        if (new Date(ex.time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(ex.time).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));

        if (sig === 'long') {
          // Check Break-even Trigger
          if (!isBreakEvenTriggered && ex.high >= entryPrice * (1 + (BE_ROI_TRIGGER + totalFeesOnMargin)/LEVERAGE)) {
            isBreakEvenTriggered = true; slPrice = entryPrice; 
          }
          if (ex.high >= tpPrice) { balance *= (1 + TARGET_NET_ROI); wins++; resType = "WIN"; foundExit = true; exitTime = ex.time; roiStr = "3.00%"; break; }
          if (ex.low <= slPrice) { 
            if (isBreakEvenTriggered) { balance *= (1 - totalFeesOnMargin); breakEvens++; resType = "BE"; roiStr = "0.00%"; }
            else { balance *= (1 - (SL_ROI + totalFeesOnMargin)); losses++; resType = "LOSS"; roiStr = `-${((SL_ROI + totalFeesOnMargin)*100).toFixed(2)}%`; }
            foundExit = true; exitTime = ex.time; break; 
          }
        } else {
          // Short Break-even Trigger
          if (!isBreakEvenTriggered && ex.low <= entryPrice * (1 - (BE_ROI_TRIGGER + totalFeesOnMargin)/LEVERAGE)) {
            isBreakEvenTriggered = true; slPrice = entryPrice; 
          }
          if (ex.low <= tpPrice) { balance *= (1 + TARGET_NET_ROI); wins++; resType = "WIN"; foundExit = true; exitTime = ex.time; roiStr = "3.00%"; break; }
          if (ex.high >= slPrice) { 
            if (isBreakEvenTriggered) { balance *= (1 - totalFeesOnMargin); breakEvens++; resType = "BE"; roiStr = "0.00%"; }
            else { balance *= (1 - (SL_ROI + totalFeesOnMargin)); losses++; resType = "LOSS"; roiStr = `-${((SL_ROI + totalFeesOnMargin)*100).toFixed(2)}%`; }
            foundExit = true; exitTime = ex.time; break; 
          }
        }
      }

      if (foundExit) {
        output.push(`${toKSTString(time)},${sig.toUpperCase()},${entryPrice},${toKSTString(exitTime)},${resType},${roiStr},${balance.toFixed(2)}`);
        while (i < klines1m.length && klines1m[i].time <= exitTime) i++;
        i--; currentSignal = sig;
      }
    } else currentSignal = sig;
  }

  console.log(`\n--- v3.2.0 결과 ---`);
  console.log(`잔고: $${balance.toFixed(2)} (${((balance/INITIAL_BALANCE - 1)*100).toFixed(1)}%)`);
  console.log(`거래: ${wins + losses + breakEvens} (승: ${wins}, 패: ${losses}, 본절: ${breakEvens})`);
  console.log(`승률: ${((wins/(wins+losses+breakEvens))*100).toFixed(1)}%`);
  fs.writeFileSync('C:/dev/2026_candy/backtest_v320_results.csv', output.join('\n'));
}

runV320BreakEven();
