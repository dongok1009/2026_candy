const axios = require('axios');
const fs = require('fs');

// --- Indicators Logic ---
const calculateEMA = (data, period) => {
  const ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
};

const calculateSMA = (data, period) => {
  const sma = new Array(data.length).fill(null);
  if (data.length < period) return sma;
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    sma[i] = sum / period;
  }
  return sma;
};

const calculateRSI = (closes, period = 14) => {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;
  let avgGain = 0; let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  if (avgLoss === 0) rsi[period] = 100; else rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    if (avgLoss === 0) rsi[i] = 100; else rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
};

const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);
  const macdLine = fastEMA.map((f, i) => (f !== null && slowEMA[i] !== null) ? f - slowEMA[i] : null);
  const nonNullMacd = macdLine.filter(m => m !== null);
  const signalEMA = calculateEMA(nonNullMacd, signal);
  const signalLine = new Array(macdLine.length).fill(null);
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && signalIdx < signalEMA.length) signalLine[i] = signalEMA[signalIdx++];
  }
  const histogram = macdLine.map((m, i) => (m !== null && signalLine[i] !== null) ? m - signalLine[i] : null);
  return { macdLine, signalLine, histogram };
};

const calculateStochRSI = (rsiValues, period = 14, k = 3, d = 3) => {
  const rawStoch = new Array(rsiValues.length).fill(null);
  for (let i = period; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - period + 1, i + 1).filter(v => v !== null);
    if (window.length < period) continue;
    const min = Math.min(...window); const max = Math.max(...window);
    if (max - min === 0) rawStoch[i] = 100; else rawStoch[i] = ((rsiValues[i] - min) / (max - min)) * 100;
  }
  const nonNullStoch = rawStoch.filter(s => s !== null);
  const kLineValues = calculateSMA(nonNullStoch, k);
  const kLine = new Array(rawStoch.length).fill(null);
  let kIdx = 0;
  for (let i = 0; i < rawStoch.length; i++) {
    if (rawStoch[i] !== null && kIdx < kLineValues.length) kLine[i] = kLineValues[kIdx++];
  }
  const nonNullK = kLine.filter(kVal => kVal !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  }
  return { kLine, dLine };
};

// --- Config ---
const SYMBOL = 'BTCUSDT';
const START_TIME = new Date('2023-09-01T00:00:00Z').getTime();
const ACTUAL_START_TIME = new Date('2025-01-01T00:00:00Z').getTime();
const END_TIME = Date.now();

const LEVERAGE = 5;
const TARGET_ROI = 0.03; // 3%
const TARGET_SL_ROI = 0.15; // 15%
const INITIAL_BALANCE = 1000;
const SLIPPAGE_RATE = 0; // Ideal entry (no delay)

const TP_PRICE_MOVE = TARGET_ROI / LEVERAGE;
const SL_PRICE_MOVE = TARGET_SL_ROI / LEVERAGE;

const RULES = {
  '5m': {
    long: { macdValueEnabled: false, macdValue: -10, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 10, macdCrossEnabled: true, stochCrossEnabled: true }
  },
  '1h': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true }
  },
  '1d': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true }
  }
};

function toKSTString(timestamp) {
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\..+/, '');
}

// --- Data Fetching ---
async function fetchKlines(symbol, interval, startTime, endTime) {
  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${interval} klines for ${symbol}...`);
  while (allKlines.length < 400000 && currentStart < endTime) { 
    try {
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
        params: { symbol, interval, startTime: currentStart, limit: 1500 }
      });
      if (response.data.length === 0) break;
      allKlines.push(...response.data);
      currentStart = response.data[response.data.length - 1][0] + 1;
      if (response.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 60)); 
    } catch (e) {
      console.error(`Error fetching ${interval}:`, e.message);
      break;
    }
  }
  return allKlines.map(d => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4])
  }));
}

function getSignalWithData(rule, m, s, k, d) {
  let isLong = true; let isShort = true;
  if (m === null || s === null) { isLong = false; isShort = false; }
  else {
    if (rule.long) {
      let activeLongCondCount = 0;
      if (rule.long.macdValueEnabled) { activeLongCondCount++; if (!(m < parseFloat(rule.long.macdValue))) isLong = false; }
      if (rule.long.macdCrossEnabled) { activeLongCondCount++; if (!(m > s)) isLong = false; }
      if (rule.long.stochCrossEnabled) { activeLongCondCount++; if (!(d !== null && k !== null && d < k)) isLong = false; }
      if (activeLongCondCount === 0) isLong = false;
    } else isLong = false;
    if (rule.short) {
      let activeShortCondCount = 0;
      if (rule.short.macdValueEnabled) { activeShortCondCount++; if (!(m > parseFloat(rule.short.macdValue))) isShort = false; }
      if (rule.short.macdCrossEnabled) { activeShortCondCount++; if (!(m < s)) isShort = false; }
      if (rule.short.stochCrossEnabled) { activeShortCondCount++; if (!(d !== null && k !== null && d > k)) isShort = false; }
      if (activeShortCondCount === 0) isShort = false;
    } else isShort = false;
  }
  return {
    signal: isLong ? 'long' : (isShort ? 'short' : 'hold'),
    data: { m, s, k, d }
  };
}

async function runBacktest() {
  const klines5m = await fetchKlines(SYMBOL, '5m', START_TIME, END_TIME);
  const klines1h = await fetchKlines(SYMBOL, '1h', START_TIME, END_TIME);
  const klines1d = await fetchKlines(SYMBOL, '1d', START_TIME, END_TIME);

  console.log(`Data fetched (${klines5m.length} 5m candles). Processing...`);

  const closes5m = klines5m.map(k => k.close);
  const indicators5m = { macd: calculateMACD(closes5m), stoch: calculateStochRSI(calculateRSI(closes5m)) };
  const indicators1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
  const indicators1d = { macd: calculateMACD(klines1d.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d.map(k => k.close))) };

  let balance = INITIAL_BALANCE;
  let inTrade = null; 
  const tradeHistory = [];
  let prevGlobalSignal = 'hold';

  for (let i = 0; i < klines5m.length; i++) {
    const k5m = klines5m[i];
    const time = k5m.time;

    if (inTrade) {
      let closed = false;
      let result = 0;
      if (inTrade.type === 'LONG') {
        if (k5m.high >= inTrade.tp) { result = TARGET_ROI; closed = true; }
        else if (k5m.low <= inTrade.sl) { result = -TARGET_SL_ROI; closed = true; }
      } else { 
        if (k5m.low <= inTrade.tp) { result = TARGET_ROI; closed = true; }
        else if (k5m.high >= inTrade.sl) { result = -TARGET_SL_ROI; closed = true; }
      }
      if (closed) {
        balance = balance * (1 + result);
        tradeHistory.push({
          ...inTrade,
          exitTimeKST: toKSTString(time),
          exitPrice: result > 0 ? inTrade.tp : inTrade.sl,
          result: result > 0 ? 'WIN' : 'LOSS',
          profit: result,
          balance: balance
        });
        inTrade = null;
      }
      continue;
    }

    if (time < ACTUAL_START_TIME) continue;

    const res5m = getSignalWithData(RULES['5m'], indicators5m.macd.macdLine[i], indicators5m.macd.signalLine[i], indicators5m.stoch.kLine[i], indicators5m.stoch.dLine[i]);
    
    const idx1h = klines1h.findIndex(k => k.time > time) - 1;
    const realIdx1h = idx1h < 0 ? klines1h.length - 1 : idx1h;
    const res1h = getSignalWithData(RULES['1h'], indicators1h.macd.macdLine[realIdx1h], indicators1h.macd.signalLine[realIdx1h], indicators1h.stoch.kLine[realIdx1h], indicators1h.stoch.dLine[realIdx1h]);
    
    const idx1d = klines1d.findIndex(k => k.time > time) - 1;
    const realIdx1d = idx1d < 0 ? klines1d.length - 1 : idx1d;
    const res1d = getSignalWithData(RULES['1d'], indicators1d.macd.macdLine[realIdx1d], indicators1d.macd.signalLine[realIdx1d], indicators1d.stoch.kLine[realIdx1d], indicators1d.stoch.dLine[realIdx1d]);

    const globalSignal = (res5m.signal === 'long' && res1h.signal === 'long' && res1d.signal === 'long') ? 'long' :
                         (res5m.signal === 'short' && res1h.signal === 'short' && res1d.signal === 'short') ? 'short' : 'hold';

    if (globalSignal !== prevGlobalSignal && globalSignal !== 'hold') {
      const rawPrice = k5m.close;
      // Apply 0.1% slippage for realistic 30s-delayed entry
      const entryPrice = globalSignal === 'long' ? rawPrice * (1 + SLIPPAGE_RATE) : rawPrice * (1 - SLIPPAGE_RATE);

      inTrade = {
        entryTimeKST: toKSTString(time),
        type: globalSignal.toUpperCase(),
        entryPrice: entryPrice,
        leverage: LEVERAGE,
        tp: globalSignal === 'long' ? entryPrice * (1 + TP_PRICE_MOVE) : entryPrice * (1 - TP_PRICE_MOVE),
        sl: globalSignal === 'long' ? entryPrice * (1 - SL_PRICE_MOVE) : entryPrice * (1 + SL_PRICE_MOVE),
        // Add detail logs
        details: {
          '5m': { ...res5m.data, cond: res5m.signal },
          '1h': { ...res1h.data, cond: res1h.signal },
          '1d': { ...res1d.data, cond: res1d.signal }
        }
      };
    }
    prevGlobalSignal = globalSignal;
  }

  console.log(`Simulation complete with details.`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);

  let header = 'EntryTime(KST),Type,Leverage,EntryPrice,ExitTime(KST),ExitPrice,Result,ROI% on Capital,Final Balance,';
  header += '5m_MACD,5m_Signal,5m_StochK,5m_StochD,5m_Cond,';
  header += '1h_MACD,1h_Signal,1h_StochK,1h_StochD,1h_Cond,';
  header += '1d_MACD,1d_Signal,1d_StochK,1d_StochD,1d_Cond\n';
  
  let csv = header;
  tradeHistory.forEach(t => {
    let line = `${t.entryTimeKST},${t.type},${t.leverage}x,${t.entryPrice},${t.exitTimeKST},${t.exitPrice},${t.result},${(t.profit*100).toFixed(2)}%,${t.balance.toFixed(2)},`;
    ['5m', '1h', '1d'].forEach(tf => {
      const d = t.details[tf];
      line += `${d.m?.toFixed(2)||''},${d.s?.toFixed(2)||''},${d.k?.toFixed(2)||''},${d.d?.toFixed(2)||''},${d.cond},`;
    });
    csv += line.slice(0, -1) + '\n';
  });
  
  fs.writeFileSync('C:/dev/2026_candy/backtest_trading_results_detailed_KST.csv', csv);
  console.log(`Detailed history saved to C:/dev/2026_candy/backtest_trading_results_detailed_KST.csv`);
}

runBacktest();
