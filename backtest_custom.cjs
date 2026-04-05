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
    smoothTR[i] = (smoothTR[i - 1] !== null) ? smoothTR[i - 1] - (smoothTR[i - 1] / p) + trArr[i] : null;
    smoothPlusDM[i] = (smoothPlusDM[i - 1] !== null) ? smoothPlusDM[i - 1] - (smoothPlusDM[i - 1] / p) + plusDM[i] : null;
    smoothMinusDM[i] = (smoothMinusDM[i - 1] !== null) ? smoothMinusDM[i - 1] - (smoothMinusDM[i - 1] / p) + minusDM[i] : null;
  }

  const dxArr = new Array(klines.length).fill(null);
  for (let i = p; i < klines.length; i++) {
    if (smoothTR[i] === 0 || smoothTR[i] === null) continue;
    const diPlus = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const diMinus = (smoothMinusDM[i] / smoothTR[i]) * 100;
    if (diPlus + diMinus === 0) dxArr[i] = 0;
    else dxArr[i] = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  }

  let sumDX = 0;
  let countDX = 0;
  for (let i = p; i < klines.length; i++) {
      if (dxArr[i] !== null) {
          sumDX += dxArr[i];
          countDX++;
          if (countDX === p) {
              adxArr[i] = sumDX / p;
              for (let j = i + 1; j < klines.length; j++) {
                  if (dxArr[j] !== null) {
                      adxArr[j] = (adxArr[j - 1] * (p - 1) + dxArr[j]) / p;
                  }
              }
              break;
          }
      }
  }
  return adxArr;
};

// --- Main execution ---
const args = process.argv.slice(2);
const configArg = args.find(a => a.startsWith('--config='));
if (!configArg) {
    console.error("Missing --config argument");
    process.exit(1);
}

const config = JSON.parse(configArg.split('=')[1]);
const { symbol, startDate, endDate, leverage, initialBalance, makerFee, takerFee, exitMakerFee, fundingFee, targetRoi, slRoi, rules, macdFast, macdSlow, macdSignal, stochP, stochK, stochD, adxPeriod, entryType } = config;

async function fetchKlines(symbol, interval, start, end) {
    let allKlines = [];
    let currentStart = new Date(start).getTime();
    const finalEnd = new Date(end).getTime();
    // Cache check
    const cacheFile = `backtest_cache_${new Date(start).getFullYear()}.json`;
    if (fs.existsSync(cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (interval === '5m') return cache.k5m;
        if (interval === '1h') return cache.k1h;
        if (interval === '1d') return cache.k1d;
    }

    console.log(`Fetching ${symbol} ${interval} from ${start} to ${end}...`);
    while (currentStart < finalEnd) {
        try {
            const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { 
                params: { symbol, interval, startTime: currentStart, limit: 1500 } 
            });
            if (!res.data || res.data.length === 0) break;
            allKlines.push(...res.data);
            currentStart = res.data[res.data.length - 1][0] + 1;
            if (res.data.length < 1500) break;
            await new Promise(r => setTimeout(r, 500));
        } catch (e) { console.error(e.message); break; }
    }
    return allKlines.map(d => ({ 
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
    }));
}

function checkIntervalCond(side, interval, idx, indicators) {
    const rule = rules[side][interval];
    const ind = indicators[interval];
    if (!rule || !ind) return true;

    let res = true;
    if (rule.useMacdVal) {
        if (side === 'long') res = res && (ind.macd.m[idx] < rule.macdVal);
        else res = res && (ind.macd.m[idx] > rule.macdVal);
    }
    if (rule.useMacdBeyondSig) {
        if (side === 'long') res = res && (ind.macd.m[idx] > ind.macd.s[idx]);
        else res = res && (ind.macd.m[idx] < ind.macd.s[idx]);
    }
    if (rule.useStochCross) {
        if (side === 'long') res = res && (ind.stoch.k[idx] > ind.stoch.d[idx]);
        else res = res && (ind.stoch.k[idx] < ind.stoch.d[idx]);
    }
    if (rule.useMacdSigDiff && rule.macdSigDiff !== undefined) {
        res = res && (Math.abs(ind.macd.m[idx] - ind.macd.s[idx]) > rule.macdSigDiff);
    }
    if (rule.useAdx) {
        res = res && (ind.adx[idx] !== null && ind.adx[idx] >= rule.adxThreshold);
    }
    return res;
}

async function run() {
    // We need some buffer for indicators
    const fetchStart = new Date(new Date(startDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const k1m_all = await fetchKlines(symbol, '1m', startDate, endDate);
    const k5m_all = await fetchKlines(symbol, '5m', fetchStart, endDate);
    const k1h_all = await fetchKlines(symbol, '1h', fetchStart, endDate);
    const k1d_all = await fetchKlines(symbol, '1d', fetchStart, endDate);

    const ind5m = { 
        macd: calculateMACD(k5m_all.map(k=>k.close), macdFast, macdSlow, macdSignal),
        stoch: calculateStochRSI(calculateRSI(k5m_all.map(k=>k.close), stochP), stochP, stochK, stochD),
        adx: calculateADX(k5m_all, adxPeriod)
    };
    const ind1h = { 
        macd: calculateMACD(k1h_all.map(k=>k.close), macdFast, macdSlow, macdSignal),
        stoch: calculateStochRSI(calculateRSI(k1h_all.map(k=>k.close), stochP), stochP, stochK, stochD),
        adx: calculateADX(k1h_all, adxPeriod)
    };
    const ind1d = { 
        macd: calculateMACD(k1d_all.map(k=>k.close), macdFast, macdSlow, macdSignal),
        stoch: calculateStochRSI(calculateRSI(k1d_all.map(k=>k.close), stochP), stochP, stochK, stochD),
        adx: calculateADX(k1d_all, adxPeriod)
    };

    const indicators = { '5m': ind5m, '1h': ind1h, '1d': ind1d };
    const klines_all = { '5m': k5m_all, '1h': k1h_all, '1d': k1d_all };

    let balance = initialBalance;
    let trades = [];
    const ACTUAL_START = new Date(startDate).getTime();
    const grossTP = targetRoi + (makerFee + exitMakerFee) * leverage;
    
    let m5Idx = 0;
    for (let i = 1; i < k1m_all.length; i++) {
        const k1m = k1m_all[i];
        const time = k1m.time;
        if (time < ACTUAL_START) continue;

        while (m5Idx < k5m_all.length && k5m_all[m5Idx].time < time) m5Idx++;
        const idx5m = m5Idx - 1;
        
        let idx1h = -1;
        for(let j=0; j<k1h_all.length; j++) { if(k1h_all[j].time <= time) idx1h = j; else break; }
        let idx1d = -1;
        for(let j=0; j<k1d_all.length; j++) { if(k1d_all[j].time <= time) idx1d = j; else break; }

        if (idx5m < 0 || idx1h < 0 || idx1d < 0) continue;

        const isLong = checkIntervalCond('long', '5m', idx5m, indicators) && 
                       checkIntervalCond('long', '1h', idx1h, indicators) && 
                       checkIntervalCond('long', '1d', idx1d, indicators);
        
        const isShort = checkIntervalCond('short', '5m', idx5m, indicators) && 
                        checkIntervalCond('short', '1h', idx1h, indicators) && 
                        checkIntervalCond('short', '1d', idx1d, indicators);

        let sig = isLong ? 'long' : (isShort ? 'short' : 'hold');
        
        if (sig !== 'hold') {
            const signalPrice = k1m.close;
            const limitTarget = sig === 'long' ? k5m_all[idx5m].low : k5m_all[idx5m].high;
            
            let entryPrice = 0;
            let executed = false;
            let entryTimeIdx = i;

            if (entryType === 'market' || (entryType === 'hybrid' && (sig === 'long' ? signalPrice <= limitTarget : signalPrice >= limitTarget))) {
                entryPrice = signalPrice; executed = true;
            } else {
                for (let j = i; j < k1m_all.length && j < i + 60; j++) {
                    const ex = k1m_all[j];
                    if (sig === 'long' && ex.low <= limitTarget) { entryPrice = limitTarget; executed = true; entryTimeIdx = j; break; }
                    if (sig === 'short' && ex.high >= limitTarget) { entryPrice = limitTarget; executed = true; entryTimeIdx = j; break; }
                }
            }

            if (executed) {
                const tpPrice = sig === 'long' ? entryPrice * (1 + grossTP/leverage) : entryPrice * (1 - grossTP/leverage);
                const slPrice = sig === 'long' ? entryPrice * (1 - slRoi/leverage) : entryPrice * (1 + slRoi/leverage);

                for (let j = entryTimeIdx; j < k1m_all.length; j++) {
                    const ex = k1m_all[j];
                    if (sig === 'long') {
                        if (ex.high >= tpPrice) {
                            balance *= (1 + targetRoi);
                            trades.push({ time: new Date(ex.time + 9*3600000).toISOString(), type: 'LONG', entry: entryPrice, exit: tpPrice, result: 'WIN', balance });
                            i = j; break;
                        }
                        if (ex.low <= slPrice) {
                            balance *= (1 - (slRoi + (makerFee + takerFee) * leverage));
                            trades.push({ time: new Date(ex.time + 9*3600000).toISOString(), type: 'LONG', entry: entryPrice, exit: slPrice, result: 'LOSS', balance });
                            i = j; break;
                        }
                    } else {
                        if (ex.low <= tpPrice) {
                            balance *= (1 + targetRoi);
                            trades.push({ time: new Date(ex.time + 9*3600000).toISOString(), type: 'SHORT', entry: entryPrice, exit: tpPrice, result: 'WIN', balance });
                            i = j; break;
                        }
                        if (ex.high >= slPrice) {
                            balance *= (1 - (slRoi + (makerFee + takerFee) * leverage));
                            trades.push({ time: new Date(ex.time + 9*3600000).toISOString(), type: 'SHORT', entry: entryPrice, exit: slPrice, result: 'LOSS', balance });
                            i = j; break;
                        }
                    }
                }
            }
        }
    }

    console.log(`\n--- Backtest Result ---`);
    console.log(`Final Balance: $${balance.toFixed(2)}`);
    console.log(`Total Trades: ${trades.length}`);
    const winRate = (trades.filter(t => t.result === 'WIN').length / trades.length * 100).toFixed(2);
    console.log(`Win Rate: ${winRate}%`);
    
    fs.writeFileSync('backtest_custom_results.csv', "Time,Type,Entry,Exit,Result,Balance\n" + trades.map(t => `${t.time},${t.type},${t.entry.toFixed(2)},${t.exit.toFixed(2)},${t.result},${t.balance.toFixed(2)}`).join('\n'));
    console.log(`Saved to backtest_custom_results.csv`);
}

run();
