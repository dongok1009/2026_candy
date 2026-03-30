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

function groupKlines(klines, newIntervalMinutes) {
  const result = [];
  const intervalMs = newIntervalMinutes * 60 * 1000;
  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const periodStart = Math.floor(k.time / intervalMs) * intervalMs;
    if (result.length === 0 || result[result.length - 1].time !== periodStart) {
      result.push({ time: periodStart, open: k.open, high: k.high, low: k.low, close: k.close });
    } else {
      const last = result[result.length - 1];
      last.high = Math.max(last.high, k.high); last.low = Math.min(last.low, k.low); last.close = k.close;
    }
  }
  return result;
}

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

const TARGET_NET_ROI = 0.04; // 4% Net
const SL_ROI = 0.15; // 15%
const HIST_THRESHOLD = 300; 

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${interval} klines...`);
  while (currentStart < endTime) { 
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params: { symbol, interval, startTime: currentStart, limit: 1500 } });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      const lastTime = res.data[res.data.length - 1][0];
      if (allKlines.length % 75000 === 0) console.log(`  Fetched ${allKlines.length} ${interval} klines... (Up to ${toKSTString(lastTime)})`);
      currentStart = lastTime + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { 
      if (e.response && e.response.status === 429) { console.log(`Rate limit hit (429). Waiting 30s...`); await new Promise(r => setTimeout(r, 30000)); continue; }
      console.log(`Error fetching ${interval}: ${e.message}`); break; 
    }
  }
  return allKlines.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
}

async function runBacktest() {
  console.log(`--- [최종] 백테스트: 2025-01-01 ~ 오늘 ---`);
  console.log(`조건: 1m, 10m(Grouped), 1d | TP 4%(Net), SL 15% | 레버리지 5x | MACD Threshold ${HIST_THRESHOLD}`);

  const main1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_data = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1d_data = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const klines10m_data = groupKlines(klines5m_data, 10);
  
  const indicators1m = { macd: calculateMACD(main1m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(main1m_all.map(k => k.close))) };
  const indicators10m = { macd: calculateMACD(klines10m_data.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines10m_data.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_data.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_data.map(k => k.close))) };
  
  const klines1m = main1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  let balance = INITIAL_BALANCE;
  let wins = 0; let losses = 0;
  let currentSignal = 'hold';
  const totalFeesOnMargin = (TAKER_FEE_RATE + MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;

  const output = ["Time(KST),Type,Entry,Exit,Result,Balance,WinRate"];
  let m10Idx = 0;
  let m1Idx = 0;

  console.log(`시뮬레이션 시작... (${klines1m.length} candles)`);

  for (let i = 0; i < klines1m.length; i++) {
    const k1m = klines1m[i];
    const time = k1m.time;

    while (m1Idx < main1m_all.length && main1m_all[m1Idx].time < time) m1Idx++;
    const idx1m = m1Idx - 1;
    while (m10Idx < klines10m_data.length && klines10m_data[m10Idx].time < time) m10Idx++;
    const idx10m = m10Idx - 1;
    const idx1d = klines1d_data.findIndex(k => k.time > time - 86400000) - 1;
    const r1d = idx1d < 0 ? klines1d_data.length - 1 : idx1d;

    if (idx1m < 0 || idx10m < 0 || r1d < 0) continue;

    const cond1m = (indicators1m.macd.m[idx1m] > indicators1m.macd.s[idx1m] && indicators1m.stoch.k[idx1m] > indicators1m.stoch.d[idx1m]) ? 'L' : (indicators1m.macd.m[idx1m] < indicators1m.macd.s[idx1m] && indicators1m.stoch.k[idx1m] < indicators1m.stoch.d[idx1m] ? 'S' : 'H');
    const cond10m = (indicators10m.macd.m[idx10m] > indicators10m.macd.s[idx10m] && indicators10m.stoch.k[idx10m] > indicators10m.stoch.d[idx10m]) ? 'L' : (indicators10m.macd.m[idx10m] < indicators10m.macd.s[idx10m] && indicators10m.stoch.k[idx10m] < indicators10m.stoch.d[idx10m] ? 'S' : 'H');
    const cond1d = (indicators1d.macd.m[r1d] > indicators1d.macd.s[r1d] && indicators1d.stoch.k[r1d] > indicators1d.stoch.d[r1d]) ? 'L' : (indicators1d.macd.m[r1d] < indicators1d.macd.s[r1d] && indicators1d.stoch.k[r1d] < indicators1d.stoch.d[r1d] ? 'S' : 'H');

    let isL = (cond1m === 'L' && cond10m === 'L' && cond1d === 'L');
    let isS = (cond1m === 'S' && cond10m === 'S' && cond1d === 'S');

    if (HIST_THRESHOLD > 0 && Math.abs(indicators1d.macd.m[r1d] - indicators1d.macd.s[r1d]) <= HIST_THRESHOLD) { isL = false; isS = false; }

    let signal = isL ? 'long' : (isS ? 'short' : 'hold');

    if (signal !== currentSignal && signal !== 'hold') {
      const entryPrice = k1m.close;
      const tpPrice = signal === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
      const slPrice = signal === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);

      let foundExit = false;
      let exitTime = 0; let resType = "";

      for (let j = i; j < klines1m.length; j++) {
        const ex = klines1m[j];
        if (new Date(ex.time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(ex.time).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));

        if (signal === 'long') {
          if (ex.high >= tpPrice) { balance *= (1 + TARGET_NET_ROI); wins++; resType = "WIN"; foundExit = true; exitTime = ex.time; break; }
          if (ex.low <= slPrice) { balance *= (1 - (SL_ROI + totalFeesOnMargin)); losses++; resType = "LOSS"; foundExit = true; exitTime = ex.time; break; }
        } else {
          if (ex.low <= tpPrice) { balance *= (1 + TARGET_NET_ROI); wins++; resType = "WIN"; foundExit = true; exitTime = ex.time; break; }
          if (ex.high >= slPrice) { balance *= (1 - (SL_ROI + totalFeesOnMargin)); losses++; resType = "LOSS"; foundExit = true; exitTime = ex.time; break; }
        }
      }

      if (foundExit) {
        output.push(`${toKSTString(exitTime)},${signal.toUpperCase()},${entryPrice},${klines1m[i].close},${resType},${balance.toFixed(2)},${((wins/(wins+losses))*100).toFixed(1)}%`);
        while (i < klines1m.length && klines1m[i].time <= exitTime) i++;
        i--; currentSignal = 'hold';
      }
    } else currentSignal = signal;
  }

  console.log(`\n--- 최종 결과 ---`);
  console.log(`최종 잔고: $${balance.toFixed(2)} (${((balance/INITIAL_BALANCE - 1)*100).toFixed(1)}%)`);
  console.log(`총 거래: ${wins + losses} (승: ${wins}, 패: ${losses})`);
  console.log(`승률: ${((wins/(wins+losses))*100).toFixed(1)}%`);
  fs.writeFileSync('C:/dev/2026_candy/backtest_2025_final_results.csv', output.join('\n'));
}

runBacktest();
