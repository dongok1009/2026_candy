const calculateEMA = (data, p) => {
  const ema = new Array(data.length).fill(null);
  if (data.length === 0) return ema;
  
  // 데이터가 p보다 적으면 전체 평균이라도 사용 (null 전파 방지)
  const actualP = Math.min(p, data.length);
  let sum = data.slice(0, actualP).reduce((a, b) => a + b, 0);
  ema[actualP - 1] = sum / actualP;
  
  const k = 2 / (p + 1);
  for (let i = actualP; i < data.length; i++) {
    ema[i] = (data[i] - (ema[i - 1] || data[i])) * k + (ema[i - 1] || data[i]);
  }
  return ema;
};

const calculateSMA = (data, p) => {
  const sma = new Array(data.length).fill(null);
  if (data.length === 0) return sma;
  const actualP = Math.min(p, data.length);
  for (let i = actualP - 1; i < data.length; i++) {
    let sum = 0; for (let j = 0; j < actualP; j++) sum += (data[i - j] || data[i]);
    sma[i] = sum / actualP;
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
  // mFiltered가 p보다 작아도 최소한의 값을 내도록 calculateEMA 수정본 적용
  const sig = calculateEMA(mFiltered, signal);
  
  const sigLine = new Array(m.length).fill(null);
  let sIdx = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i] !== null) {
      if (sIdx < sig.length) {
        sigLine[i] = sig[sIdx++];
      }
    }
  }
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
  for (let i = 0; i < stoch.length; i++) {
    if (stoch[i] !== null && kIdx < kLineValues.length) kLine[i] = kLineValues[kIdx++];
  }
  
  const nonNullK = kLine.filter(kv => kv !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] !== null && dIdx < dLineValues.length) dLine[i] = dLineValues[dIdx++];
  }
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

const calculateBBW = (closes, p = 20, k = 2) => {
  const bbw = new Array(closes.length).fill(null);
  if (closes.length < p) return bbw;
  
  const sma = calculateSMA(closes, p);
  
  for (let i = p - 1; i < closes.length; i++) {
    const mean = sma[i];
    if (mean === null || mean === 0) continue;
    
    let sumSqDiff = 0;
    for (let j = 0; j < p; j++) {
      const diff = (closes[i - j] || closes[i]) - mean;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / p);
    const upper = mean + k * stdDev;
    const lower = mean - k * stdDev;
    bbw[i] = (upper - lower) / mean;
  }
  return bbw;
};

const calculateBBWP = (bbw, lookback = 252) => {
  const bbwp = new Array(bbw.length).fill(null);
  for (let i = 0; i < bbw.length; i++) {
    if (bbw[i] === null) continue;
    
    let validCount = 0;
    let lessCount = 0;
    const startIdx = Math.max(0, i - lookback + 1);
    
    for (let j = startIdx; j <= i; j++) {
      if (bbw[j] !== null) {
        validCount++;
        if (bbw[j] < bbw[i]) {
          lessCount++;
        }
      }
    }
    
    if (validCount > 0) {
      bbwp[i] = (lessCount / validCount) * 100;
    }
  }
  return bbwp;
};

const calculateROC = (data, p = 9) => {
  const roc = new Array(data.length).fill(null);
  for (let i = p; i < data.length; i++) {
    const val = data[i];
    const prevVal = data[i - p];
    if (val === null || prevVal === null || prevVal === 0) continue;
    roc[i] = ((val - prevVal) / prevVal) * 100;
  }
  return roc;
};

module.exports = {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateStochRSI,
  calculateADX,
  calculateBBW,
  calculateBBWP,
  calculateROC
};



