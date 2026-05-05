const fs = require('fs');

const SYMBOL = 'BTCUSDT';
const LEVERAGE = 5;
const TARGET_NET_ROI = 0.03;
const SL_ROI = 0.15; // FIXED SL 15%
const MAKER_FEE = 0.0002;
const RETRACE_P = 0.015; // 1.5%
const TIMEOUT_MINS = 180; // 3 Hours
const ADX_THRESHOLD = 30; // ADX 30 이상 진입 허용

const calculateEMA = (d, p) => {
  const ema = new Array(d.length).fill(null);
  if (d.length < p) return ema;
  let s = d.slice(0, p).reduce((a, b) => a + b, 0);
  ema[p - 1] = s / p;
  const k = 2 / (p + 1);
  for (let i = p; i < d.length; i++) ema[i] = (d[i] - ema[i - 1]) * k + ema[i - 1];
  return ema;
};
const calculateMACD = (c) => {
  const f = calculateEMA(c, 12), s = calculateEMA(c, 26);
  const m = f.map((v, i) => (v !== null && s[i] !== null) ? v - s[i] : null);
  const mF = m.filter(v => v !== null);
  const sig = calculateEMA(mF, 9);
  const sl = new Array(m.length).fill(null);
  let siIdx = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== null && siIdx < sig.length) sl[i] = sig[siIdx++];
  return { m, s: sl };
};
const calculateSMA = (d, p) => {
  const sma = new Array(d.length).fill(null);
  for (let i = p - 1; i < d.length; i++) {
    let sum = 0; for (let j = 0; j < p; j++) sum += d[i - j];
    sma[i] = sum / p;
  }
  return sma;
};
const calculateRSI = (c, p = 14) => {
  const rsi = new Array(c.length).fill(null);
  if(c.length <= p) return rsi;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  g /= p; l /= p;
  rsi[p] = 100 - 100 / (1 + g / l);
  for (let i = p+1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p;
    l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
    rsi[i] = 100 - 100 / (1 + g / l);
  }
  return rsi;
};
const calculateStochRSI = (r, p = 14) => {
  const stoch = new Array(r.length).fill(null);
  for (let i = p - 1; i < r.length; i++) {
    const w = r.slice(i - p + 1, i + 1).filter(v => v !== null);
    if (w.length < p) continue;
    const min = Math.min(...w), max = Math.max(...w);
    stoch[i] = (max - min === 0) ? 100 : ((r[i] - min) / (max - min)) * 100;
  }
  const k = calculateSMA(stoch.filter(v => v !== null), 3);
  const kl = new Array(stoch.length).fill(null);
  let ki = 0;
  for (let i = 0; i < stoch.length; i++) if (stoch[i] !== null && ki < k.length) kl[i] = k[ki++];
  const d = calculateSMA(kl.filter(v => v !== null), 3);
  const dl = new Array(kl.length).fill(null);
  let di = 0;
  for (let i = 0; i < kl.length; i++) if (kl[i] !== null && di < d.length) dl[i] = d[di++];
  return { k: kl, d: dl };
};

const calculateADX = (klines, p = 14) => {
  const adxArr = new Array(klines.length).fill(null);
  if (klines.length < p * 2) return adxArr;

  const trArr = new Array(klines.length).fill(0);
  const plusDM = new Array(klines.length).fill(0);
  const minusDM = new Array(klines.length).fill(0);

  for (let i = 1; i < klines.length; i++) {
    const k = klines[i], pk = klines[i - 1];
    trArr[i] = Math.max(k.high - k.low, Math.abs(k.high - pk.close), Math.abs(k.low - pk.close));
    const upMove = k.high - pk.high;
    const downMove = pk.low - k.low;
    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  const smoothTR = new Array(klines.length).fill(null);
  const smoothPlusDM = new Array(klines.length).fill(null);
  const smoothMinusDM = new Array(klines.length).fill(null);

  let sumTR = 0, sumPM = 0, sumMM = 0;
  for (let i = 1; i <= p; i++) {
    sumTR += trArr[i];
    sumPM += plusDM[i];
    sumMM += minusDM[i];
  }
  smoothTR[p] = sumTR;
  smoothPlusDM[p] = sumPM;
  smoothMinusDM[p] = sumMM;

  for (let i = p + 1; i < klines.length; i++) {
    smoothTR[i] = smoothTR[i - 1] - (smoothTR[i - 1] / p) + trArr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - (smoothPlusDM[i - 1] / p) + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - (smoothMinusDM[i - 1] / p) + minusDM[i];
  }

  const dxArr = new Array(klines.length).fill(null);
  for (let i = p; i < klines.length; i++) {
    const diPlus = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const diMinus = (smoothMinusDM[i] / smoothTR[i]) * 100;
    dxArr[i] = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  }

  let sumDX = 0;
  for (let i = p; i < p * 2; i++) sumDX += dxArr[i];
  adxArr[p * 2 - 1] = sumDX / p;

  for (let i = p * 2; i < klines.length; i++) {
    adxArr[i] = (adxArr[i - 1] * (p - 1) + dxArr[i]) / p;
  }
  return adxArr;
};

async function run() {
  console.log(`🚀 [v7.0.0 ADX Condition] Strategy Execution: 2025 Full Season`);
  const cacheFile = 'backtest_cache_2025.json';
  if (!fs.existsSync(cacheFile)) {
    console.error(`❌ Cache file ${cacheFile} not found!`);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const k5m = raw.k5m;
  const k1h = raw.k1h;
  const k1d = raw.k1d;

  console.log(`Calculating Indicators...`);
  const i5m = { 
    stoch: calculateStochRSI(calculateRSI(k5m.map(d=>d.close))),
    adx: calculateADX(k5m)
  };
  const i1h = { 
    macd: calculateMACD(k1h.map(d=>d.close)), 
    stoch: calculateStochRSI(calculateRSI(k1h.map(d=>d.close))),
    adx: calculateADX(k1h)
  };
  const i1d = { macd: calculateMACD(k1d.map(d=>d.close)) };

  let balance = 1000;
  let trades = [];
  const FEE_TOTAL = (MAKER_FEE * 2) * LEVERAGE;
  const TARGET_GROSS_ROI = TARGET_NET_ROI + FEE_TOTAL;

  const startDate = new Date('2025-01-01').getTime();
  const endDate = new Date('2025-12-31T23:59:59').getTime();

  for(let i = 100; i < k5m.length; i++) {
    const curTime = k5m[i].time;
    if (curTime < startDate || curTime > endDate) continue;

    let hIdx = -1; for(let j=0; j<k1h.length; j++) { if(k1h[j].time <= curTime) hIdx = j; }
    let dIdx = -1; for(let j=0; j<k1d.length; j++) { if(k1d[j].time <= curTime) dIdx = j; }

    const getSigAt = (idx5, idxH, idxD) => {
      // 5m conditions
      const c5 = i5m.stoch.k[idx5] > i5m.stoch.d[idx5] ? 'long' : (i5m.stoch.k[idx5] < i5m.stoch.d[idx5] ? 'short' : 'hold');
      const adx5 = i5m.adx[idx5];
      
      // 1h conditions
      const ch = (i1h.macd.m[idxH] > i1h.macd.s[idxH] && i1h.stoch.k[idxH] > i1h.stoch.d[idxH]) ? 'long' : (i1h.macd.m[idxH] < i1h.macd.s[idxH] && i1h.stoch.k[idxH] < i1h.stoch.d[idxH] ? 'short' : 'hold');
      const adxH = i1h.adx[idxH];

      // 1d conditions
      const cd = i1d.macd.m[idxD] > i1d.macd.s[idxD] ? 'long' : (i1d.macd.m[idxD] < i1d.macd.s[idxD] ? 'short' : 'hold');
      
      // ADX Condition: 1h ADX >= 30 AND 5m ADX >= 30
      const adxCond = (adx5 !== null && adx5 >= ADX_THRESHOLD && adxH !== null && adxH >= ADX_THRESHOLD);

      if(c5==='long' && ch==='long' && cd==='long' && adxCond) return 'long';
      if(c5==='short' && ch==='short' && cd==='short' && adxCond) return 'short';
      return 'hold';
    };

    const sig = getSigAt(i, hIdx, dIdx);
    const prevSig = getSigAt(i - 1, hIdx, dIdx);

    if (sig !== 'hold' && prevSig === 'hold') {
      const signalPrice = k5m[i].close;
      const targetEntry = sig === 'long' ? signalPrice * (1 - RETRACE_P) : signalPrice * (1 + RETRACE_P);
      const tpPrice = sig === 'long' ? targetEntry * (1 + TARGET_GROSS_ROI / LEVERAGE) : targetEntry * (1 - TARGET_GROSS_ROI / LEVERAGE);
      const slPrice = sig === 'long' ? targetEntry * (1 - SL_ROI / LEVERAGE) : targetEntry * (1 + SL_ROI / LEVERAGE);

      let found = false;
      for (let k = i + 1; k < i + 36; k++) {
        if (!k5m[k]) break;
        const low = k5m[k].low, high = k5m[k].high;
        const reached = sig === 'long' ? low <= targetEntry : high >= targetEntry;
        if (reached) {
          let entryIdx = k;
          for (let m = entryIdx + 1; m < k5m.length; m++) {
            const ml = k5m[m].low, mh = k5m[m].high;
            const hitTP = sig === 'long' ? mh >= tpPrice : ml <= tpPrice;
            const hitSL = sig === 'long' ? ml <= slPrice : mh >= slPrice;
            if (hitTP || hitSL) {
              const profit = hitTP ? (TARGET_NET_ROI * balance) : (-SL_ROI * balance);
              balance += profit;
              trades.push({
                time: new Date(curTime).toLocaleString(),
                type: sig.toUpperCase(),
                signal: signalPrice.toFixed(2),
                entry: targetEntry.toFixed(2),
                exit: (hitTP ? tpPrice : slPrice).toFixed(2),
                result: hitTP ? 'WIN' : 'LOSS',
                profit: profit.toFixed(2),
                balance: balance.toFixed(2),
                adx5: i5m.adx[i]?.toFixed(2),
                adxH: i1h.adx[hIdx]?.toFixed(2)
              });
              i = m;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    }
  }

  const resFile = 'backtest_v700_results.csv';
  const header = "Time,Type,SignalPrice,EntryPrice,ExitPrice,Result,Profit,Balance,ADX_5m,ADX_1h\n";
  const rows = trades.map(t => `${t.time},${t.type},${t.signal},${t.entry},${t.exit},${t.result},${t.profit},${t.balance},${t.adx5},${t.adxH}`).join("\n");
  fs.writeFileSync(resFile, header + rows);
  
  console.log(`\n✅ [v7.0.0] Backtest Success! (ADX Filter Applied)`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);
  console.log(`Total Trades: ${trades.length}`);
  console.log(`Results saved to: ${resFile}`);
}
run();
