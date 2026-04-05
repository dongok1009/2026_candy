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

// --- Config (v5.0.0 Fixed Invest 2026) ---
const SYMBOL = 'BTCUSDT';
const FETCH_START_TIME = new Date('2025-11-01T00:00:00+09:00').getTime();
const ACTUAL_START_TIME = new Date('2026-01-01T00:00:00+09:00').getTime();
const ACTUAL_END_TIME = new Date('2026-03-16T00:00:00+09:00').getTime();

const LEVERAGE = 5;
const INITIAL_BALANCE = 1000;
const FIXED_TRADE_AMOUNT = 100; // 고정 100불 투자
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
  console.log(`Fetching ${symbol} ${interval} klines...`);
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
  return allKlines.filter(d => d[0] < endTime).map(d => ({ 
      time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
  }));
}

async function runV500FixedBacktest() {
  console.log(`--- [v5.0.0 고정 투자금] 2026년 백테스트 (01.01 ~ 03.15) ---`);

  const k1m_all = await fetchKlines(SYMBOL, '1m', FETCH_START_TIME, ACTUAL_END_TIME);
  const k5m_all = await fetchKlines(SYMBOL, '5m', FETCH_START_TIME, ACTUAL_END_TIME);
  const k1h_all = await fetchKlines(SYMBOL, '1h', FETCH_START_TIME, ACTUAL_END_TIME);
  const k1d_all = await fetchKlines(SYMBOL, '1d', FETCH_START_TIME, ACTUAL_END_TIME);

  const ind5m = { stoch: calculateStochRSI(calculateRSI(k5m_all.map(k => k.close))) };
  const ind1h = { macd: calculateMACD(k1h_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(k1h_all.map(k => k.close))) };
  const ind1d = { macd: calculateMACD(k1d_all.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(k1d_all.map(k => k.close))) };

  const startIdx = k1m_all.findIndex(k => k.time >= ACTUAL_START_TIME);
  const klines1m = k1m_all.slice(startIdx);

  let walletBalance = INITIAL_BALANCE;
  let totalProfit = 0;
  let wins = 0, losses = 0;
  let currentPos = null; // { type, entryPrice, entryTime, tpPrice, slPrice }
  
  const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
  const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
  
  // CSV Header: Time, Price, 5m_K, 5m_D, 1h_MACD, 1h_Sig, 1h_K, 1h_D, 1d_MACD, 1d_Sig, 1d_K, 1d_D, Signal, Action, PnL, Wallet
  const output = ["Time_KST,Price,5m_K,5m_D,1h_MACD,1h_Sig,1h_K,1h_D,1d_MACD,1d_Sig,1d_K,1d_D,Signal,Action,TradePnL,WalletBalance"];
  
  let m5Idx = 0;
  for (let i = 0; i < klines1m.length; i++) {
    const k1 = klines1m[i];
    const time = k1.time;

    // Find indicators for previous confirmed candles
    while (m5Idx < k5m_all.length && k5m_all[m5Idx].time < time) m5Idx++;
    const idx5 = m5Idx - 1;
    const idxH = k1h_all.findIndex(k => k.time > time - 3600000) - 1;
    const idxD = k1d_all.findIndex(k => k.time > time - 86400000) - 1;

    if (idx5 < 0 || idxH < 0 || idxD < 0) continue;

    const k5 = ind5m.stoch.k[idx5], d5 = ind5m.stoch.d[idx5];
    const mH = ind1h.macd.m[idxH], sH = ind1h.macd.s[idxH], kh = ind1h.stoch.k[idxH], dh = ind1h.stoch.d[idxH];
    const mD = ind1d.macd.m[idxD], sD = ind1d.macd.s[idxD], kd = ind1d.stoch.k[idxD], dd = ind1d.stoch.d[idxD];

    const cond5m = (k5 > d5) ? 'long' : (k5 < d5 ? 'short' : 'hold');
    const cond1h = (mH > sH && kh > dh) ? 'long' : (mH < sH && kh < dh ? 'short' : 'hold');
    const cond1d = (mD > sD && kd > dd) ? 'long' : (mD < sD && kd < dd ? 'short' : 'hold'); // v5.0.0 Signal Logic

    let signal = 'hold';
    if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') signal = 'long';
    if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') signal = 'short';

    let action = "";
    let tradePnL = 0;

    // Manage Position
    if (currentPos) {
      if (new Date(time).getUTCMinutes() === 0 && [0, 8, 16].includes(new Date(time).getUTCHours())) {
         const fundingFee = FIXED_TRADE_AMOUNT * FUNDING_FEE_RATE * LEVERAGE;
         walletBalance -= fundingFee;
      }

      const { type, entryPrice, tpPrice, slPrice } = currentPos;
      let exitTriggered = false;
      let exitPrice = 0;
      let pnl = 0;

      if (type === 'long') {
        if (k1.high >= tpPrice) { exitPrice = tpPrice; pnl = FIXED_TRADE_AMOUNT * TARGET_NET_ROI; exitTriggered = true; wins++; }
        else if (k1.low <= slPrice) { exitPrice = slPrice; pnl = -FIXED_TRADE_AMOUNT * (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE); exitTriggered = true; losses++; }
      } else {
        if (k1.low <= tpPrice) { exitPrice = tpPrice; pnl = FIXED_TRADE_AMOUNT * TARGET_NET_ROI; exitTriggered = true; wins++; }
        else if (k1.high >= slPrice) { exitPrice = slPrice; pnl = -FIXED_TRADE_AMOUNT * (SL_ROI + (MAKER_FEE_RATE + TAKER_FEE_RATE) * LEVERAGE); exitTriggered = true; losses++; }
      }

      if (exitTriggered) {
        walletBalance += pnl;
        totalProfit += pnl;
        tradePnL = pnl;
        action = `EXIT_${type.toUpperCase()}`;
        currentPos = null;
      }
    } else {
      // Entry Check
      if (signal !== 'hold') {
        const marketPrice = k1.open; // Zero look-ahead (Open of the candle after signal confirm)
        const targetPrice = signal === 'long' ? k5m_all[idx5].low : k5m_all[idx5].high;
        
        let entryPrice = 0;
        let executed = false;
        
        if (signal === 'long' && marketPrice <= targetPrice) { entryPrice = marketPrice; executed = true; }
        else if (signal === 'short' && marketPrice >= targetPrice) { entryPrice = marketPrice; executed = true; }
        else {
           // Limit Order check in current 1m candle (Simplification: check if target is hit)
           if (signal === 'long' && k1.low <= targetPrice) { entryPrice = targetPrice; executed = true; }
           else if (signal === 'short' && k1.high >= targetPrice) { entryPrice = targetPrice; executed = true; }
        }

        if (executed) {
           action = `ENTRY_${signal.toUpperCase()}`;
           const tpPrice = signal === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
           const slPrice = signal === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);
           currentPos = { type: signal, entryPrice, tpPrice, slPrice };
        }
      }
    }

    // Record 1-minute data
    output.push(`${toKSTString(time)},${k1.close},${k5.toFixed(2)},${d5.toFixed(2)},${mH.toFixed(2)},${sH.toFixed(2)},${kh.toFixed(2)},${dh.toFixed(2)},${mD.toFixed(2)},${sD.toFixed(2)},${kd.toFixed(2)},${dd.toFixed(2)},${signal},${action},${tradePnL.toFixed(2)},${walletBalance.toFixed(2)}`);
  }

  fs.writeFileSync('C:/dev/2026_candy/backtest_v500_fixed_20260101_20260315.csv', output.join('\n'));
  console.log(`\n--- [v5.0.0 Fixed Invest Result] ---`);
  console.log(`Initial Balance: $${INITIAL_BALANCE}`);
  console.log(`Final Balance: $${walletBalance.toFixed(2)}`);
  console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
  console.log(`Win Rate: ${((wins/(wins+losses))*100).toFixed(1)}% (W:${wins}/L:${losses})`);
}

runV500FixedBacktest();
