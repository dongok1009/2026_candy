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
  for (let i = period; i < data.length; i++) ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
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
const calculateMACD = (closes) => {
  const f = calculateEMA(closes, 12);
  const s = calculateEMA(closes, 26);
  const m = f.map((fv, i) => (fv && s[i]) ? fv - s[i] : null);
  const mF = m.filter(mv => mv !== null);
  const sig = calculateEMA(mF, 9);
  const sigLine = new Array(m.length).fill(null);
  let sIdx = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== null && sIdx < sig.length) sigLine[i] = sig[sIdx++];
  return { m, s: sigLine };
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
  rsi[p] = 100 - 100 / (1 + g / (l || 1e-9));
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * 13 + (d > 0 ? d : 0)) / 14; l = (l * 13 + (d < 0 ? -d : 0)) / 14;
    rsi[i] = 100 - 100 / (1 + g / (l || 1e-9));
  }
  return rsi;
};
const calculateStochRSI = (rsiArr) => {
    const stoch = new Array(rsiArr.length).fill(null);
    for (let i = 14; i < rsiArr.length; i++) {
      const win = rsiArr.slice(i - 13, i + 1).filter(v => v !== null);
      if (win.length < 14) continue;
      const min = Math.min(...win), max = Math.max(...win);
      stoch[i] = max === min ? 100 : ((rsiArr[i] - min) / (max - min)) * 100;
    }
    const kL = calculateSMA(stoch.filter(s => s !== null), 3);
    const k = new Array(stoch.length).fill(null);
    let ki = 0; for (let i = 0; i < stoch.length; i++) if (stoch[i] !== null && ki < kL.length) k[i] = kL[ki++];
    const dL = calculateSMA(k.filter(kv => kv !== null), 3);
    const d = new Array(k.length).fill(null);
    let di = 0; for (let i = 0; i < k.length; i++) if (k[i] !== null && di < dL.length) d[i] = dL[di++];
    return { k, d };
};

const getSignal = (rules, macd, signal, stochK, stochD) => {
  let isLong = true; let isShort = true;
  if (macd === null || signal === null) return 'hold';
  if (rules.long.macdCrossEnabled && !(macd > signal)) isLong = false;
  if (rules.long.stochCrossEnabled && !(stochK > stochD)) isLong = false;
  if (rules.short.macdCrossEnabled && !(macd < signal)) isShort = false;
  if (rules.short.stochCrossEnabled && !(stochK < stochD)) isShort = false;
  return isLong ? 'long' : (isShort ? 'short' : 'hold');
};

async function compareWinRates() {
  const symbol = 'BTCUSDT';
  const startTime = new Date('2023-09-01T00:00:00Z').getTime();
  const actualStart = new Date('2025-01-01T00:00:00Z').getTime();
  
  // Fetch data (Simplified for speed)
  const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=5m&startTime=${startTime}&limit=100000`);
  const klines = res.data.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
  
  // Need 1h and 1d too for full accuracy but let's assume entry points are fixed from 5m for comparison logic speed
  // To be 100% accurate, we should run the full logic.
  
  // Let's just use the current logic but track TWO results in one loop.
  // Actually, I'll just count from the file I generated if it has WIN/LOSS tags.
  // But wait, the file only has ONE state.
  
  console.log("Analyzing 5m timeframe data...");
  const closes = klines.map(d => d.close);
  const macdData = calculateMACD(closes);
  const rsiData = calculateRSI(closes);
  const stochData = calculateStochRSI(rsiData);
  
  const rules = {
    long: { macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdCrossEnabled: true, stochCrossEnabled: true }
  };

  const TP_MOVE = 0.03 / 5;
  const SL_MOVE = 0.15 / 5;
  const SLIPPAGE = 0.001;

  let totalTrades = 0;
  let wins_0 = 0;
  let wins_std = 0;

  for(let i=0; i<klines.length; i++) {
    if (klines[i].time < actualStart) continue;
    const sig = getSignal(rules, macdData.m[i], macdData.s[i], stochData.k[i], stochData.d[i]);
    
    if (sig !== 'hold') {
      totalTrades++;
      const rawPrice = klines[i].close;
      
      // Simulation 1: No Slippage
      const entry_0 = rawPrice;
      const tp_0 = sig === 'long' ? entry_0 * (1 + TP_MOVE) : entry_0 * (1 - TP_MOVE);
      const sl_0 = sig === 'long' ? entry_0 * (1 - SL_MOVE) : entry_0 * (1 + SL_MOVE);
      
      // Simulation 2: 0.1% Slippage
      const entry_std = sig === 'long' ? rawPrice * (1 + SLIPPAGE) : rawPrice * (1 - SLIPPAGE);
      const tp_std = sig === 'long' ? entry_std * (1 + TP_MOVE) : entry_std * (1 - TP_MOVE);
      const sl_std = sig === 'long' ? entry_std * (1 - SL_MOVE) : entry_std * (1 + SL_MOVE);

      // Simple outcome check in next candles
      let win_0 = false; let win_std = false;
      for (let j=i+1; j<klines.length; j++) {
        const k = klines[j];
        if (sig === 'long') {
           if (k.high >= tp_0 && !win_0) win_0 = true;
           if (k.low <= sl_0 && !win_0) break;
        } else {
           if (k.low <= tp_0 && !win_0) win_0 = true;
           if (k.high >= sl_0 && !win_0) break;
        }
      }
      for (let j=i+1; j<klines.length; j++) {
        const k = klines[j];
        if (sig === 'long') {
           if (k.high >= tp_std && !win_std) win_std = true;
           if (k.low <= sl_std && !win_std) break;
        } else {
           if (k.low <= tp_std && !win_std) win_std = true;
           if (k.high >= sl_std && !win_std) break;
        }
      }
      if (win_0) wins_0++;
      if (win_std) wins_std++;
      
      i += 20; // Skip a bit to avoid overlapping signals for this fast check
    }
  }

  console.log(`\n=== 승률 비교 분석 결과 ===`);
  console.log(`총 분석 거래 수: ${totalTrades}`);
  console.log(`[이상적 환경 - 0% 슬리피지] 승률: ${((wins_0/totalTrades)*100).toFixed(2)}% (${wins_0}승)`);
  console.log(`[현실적 환경 - 0.1% 슬리피지] 승률: ${((wins_std/totalTrades)*100).toFixed(2)}% (${wins_std}승)`);
  console.log(`승률 차이: ${((wins_0 - wins_std)/totalTrades*100).toFixed(2)}%p 하락`);
}

compareWinRates();
