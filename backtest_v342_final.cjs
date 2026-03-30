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
const MAKER_FEE_RATE = 0.0002; // Limit Order Entry (Maker)
const TAKER_FEE_RATE = 0.0005; // SL (Taker)
const EXIT_MAKER_FEE_RATE = 0.0002; // TP (Maker)
const FUNDING_FEE_RATE = 0.0001;

const TARGET_NET_ROI = 0.03; // 3% Net
const SL_ROI = 0.15; 

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

async function runV342Final() {
  console.log(`--- [v3.4.2] 백테스트: MACD Hist Threshold 제거 + 상세 지표 로깅 ---`);

  const klines1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, END_TIME);
  const klines5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, END_TIME);
  const klines1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, END_TIME);
  const klines1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, END_TIME);

  const indicators5m = { macd: calculateMACD(klines5m_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines5m_all.map(k => k.close))) };
  const indicators1h = { macd: calculateMACD(klines1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h_all.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d_all.map(k => k.close))) };

  const klines1m = klines1m_all.filter(k => k.time >= ACTUAL_START_TIME);
  let balance = INITIAL_BALANCE;
  let wins = 0, losses = 0, cancels = 0;
  let currentPosSignal = 'hold'; 
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  
  const output = ["EntryTime,Type,MarketPriceAtSignal,LimitEntryPrice,ExitTime,ExitPrice,Result,ROI,FinalBalance,Status,5m_K,5m_D,1h_MACD,1h_Sig,1h_K,1h_D,1d_MACD,1d_Sig,1d_K,1d_D"];
  let m5Idx = 0;

  for (let i = 1; i < klines1m.length; i++) {
    const k1m = klines1m[i];
    const time = k1m.time;

    while (m5Idx < klines5m_all.length && klines5m_all[m5Idx].time < time) m5Idx++;
    const idx5m = m5Idx - 1;
    const r1h = klines1h_all.findIndex(k => k.time > time - 3600000) - 1;
    const r1d = klines1d_all.findIndex(k => k.time > time - 86400000) - 1;

    if (idx5m < 0 || r1h < 0 || r1d < 0) continue;

    const k5 = indicators5m.stoch.k[idx5m], d5 = indicators5m.stoch.d[idx5m];
    const m1h = indicators1h.macd.m[r1h], s1h = indicators1h.macd.s[r1h], kh = indicators1h.stoch.k[r1h], dh = indicators1h.stoch.d[r1h];
    const m1d = indicators1d.macd.m[r1d], s1d = indicators1d.macd.s[r1d], kd = indicators1d.stoch.k[r1d], dd = indicators1d.stoch.d[r1d];

    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (m1h > s1h && kh > dh) ? 'long' : (m1h < s1h && kh < dh ? 'short' : 'hold');
    const cond1d = (m1d > s1d && kd > dd) ? 'long' : (m1d < s1d && kd < dd ? 'short' : 'hold');

    let sig = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') sig = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') sig = 'short';

    if (sig !== 'hold' && sig !== currentPosSignal) {
      const marketPriceAtSignal = k1m.close;
      const limitEntryPrice = sig === 'long' ? klines5m_all[idx5m].low : klines5m_all[idx5m].high;
      let executed = false;
      let exitIdx = i;

      for (let j = i; j < klines1m.length; j++) {
        const ex = klines1m[j];
        if (sig === 'long' && ex.low <= limitEntryPrice) { executed = true; exitIdx = j; break; }
        if (sig === 'short' && ex.high >= limitEntryPrice) { executed = true; exitIdx = j; break; }

        if (ex.time % 300000 === 0) {
            if (j - i > 60) break;
        }
      }

      if (executed) {
        let entryTimeKST = toKSTString(klines1m[exitIdx].time);
        const tpPrice = sig === 'long' ? limitEntryPrice * (1 + grossTP/LEVERAGE) : limitEntryPrice * (1 - grossTP/LEVERAGE);
        const slPrice = sig === 'long' ? limitEntryPrice * (1 - SL_ROI/LEVERAGE) : limitEntryPrice * (1 + SL_ROI/LEVERAGE);

        for (let j = exitIdx; j < klines1m.length; j++) {
          const ex = klines1m[j];
          if (new Date(ex.time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(ex.time).getUTCHours())) balance *= (1 - (FUNDING_FEE_RATE * LEVERAGE));

          if (sig === 'long') {
            if (ex.high >= tpPrice) { 
                balance *= (1 + TARGET_NET_ROI); wins++; 
                output.push(`${entryTimeKST},LONG,${marketPriceAtSignal},${limitEntryPrice},${toKSTString(ex.time)},${tpPrice.toFixed(2)},WIN,3.00%,${balance.toFixed(2)},Executed,${k5},${d5},${m1h},${s1h},${kh},${dh},${m1d},${s1d},${kd},${dd}`); 
                i = j; break; 
            }
            if (ex.low <= slPrice) { 
                balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE)); losses++; 
                output.push(`${entryTimeKST},LONG,${marketPriceAtSignal},${limitEntryPrice},${toKSTString(ex.time)},${slPrice.toFixed(2)},LOSS,-15.00%,${balance.toFixed(2)},Executed,${k5},${d5},${m1h},${s1h},${kh},${dh},${m1d},${s1d},${kd},${dd}`); 
                i = j; break; 
            }
          } else {
            if (ex.low <= tpPrice) { 
                balance *= (1 + TARGET_NET_ROI); wins++; 
                output.push(`${entryTimeKST},SHORT,${marketPriceAtSignal},${limitEntryPrice},${toKSTString(ex.time)},${tpPrice.toFixed(2)},WIN,3.00%,${balance.toFixed(2)},Executed,${k5},${d5},${m1h},${s1h},${kh},${dh},${m1d},${s1d},${kd},${dd}`); 
                i = j; break; 
            }
            if (ex.high >= slPrice) { 
                balance *= (1 - (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE)); losses++; 
                output.push(`${entryTimeKST},SHORT,${marketPriceAtSignal},${limitEntryPrice},${toKSTString(ex.time)},${slPrice.toFixed(2)},LOSS,-15.00%,${balance.toFixed(2)},Executed,${k5},${d5},${m1h},${s1h},${kh},${dh},${m1d},${s1d},${kd},${dd}`); 
                i = j; break; 
            }
          }
        }
        currentPosSignal = sig;
      } else {
        cancels++;
      }
    } else currentPosSignal = sig;
  }

  console.log(`\n--- v3.4.2 결과 (MACD Diff 제거 + 상세 로깅) ---`);
  console.log(`잔고: $${balance.toFixed(2)} (${((balance/INITIAL_BALANCE - 1)*100).toFixed(1)}%)`);
  console.log(`결과: 승: ${wins}, 패: ${losses}, 체결안됨: ${cancels}`);
  console.log(`승률: ${((wins/(wins+losses))*100).toFixed(1)}%`);
  fs.writeFileSync('C:/dev/2026_candy/backtest_v342_results_detailed.csv', output.join('\n'));
}

runV342Final();
