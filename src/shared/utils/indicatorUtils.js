/**
 * Technical Indicators Calculation Utility
 * Includes RSI, EMA, MACD, Stochastic RSI, and Bollinger Bands
 */

// 1. EMA (Exponential Moving Average)
export const calculateEMA = (data, period) => {
  const ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;

  // Starting with simple average for first point
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
};

// 2. SMA (Simple Moving Average)
export const calculateSMA = (data, period) => {
  const sma = new Array(data.length).fill(null);
  if (data.length < period) return sma;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    sma[i] = sum / period;
  }
  return sma;
};

// 3. RSI (Relative Strength Index)
export const calculateRSI = (closes, period = 14) => {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) rsi[period] = 100;
  else rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    
    if (avgLoss === 0) rsi[i] = 100;
    else rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
};

// 4. MACD (Moving Average Convergence Divergence)
export const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);
  
  const macdLine = fastEMA.map((f, i) => (f !== null && slowEMA[i] !== null) ? f - slowEMA[i] : null);
  
  // Only calculate signal line for valid MACD values
  const nonNullMacd = macdLine.filter(m => m !== null);
  const signalEMA = calculateEMA(nonNullMacd, signal);
  
  // Align signal line back to original data length
  const signalLine = new Array(macdLine.length).fill(null);
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      if (signalIdx < signalEMA.length) {
        signalLine[i] = signalEMA[signalIdx++];
      }
    }
  }
  
  const histogram = macdLine.map((m, i) => (m !== null && signalLine[i] !== null) ? m - signalLine[i] : null);
  
  return { macdLine, signalLine, histogram };
};

// 5. Stochastic RSI
export const calculateStochRSI = (rsiValues, period = 14, k = 3, d = 3) => {
  const rawStoch = new Array(rsiValues.length).fill(null);
  
  for (let i = period; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - period + 1, i + 1).filter(v => v !== null);
    if (window.length < period) continue;
    
    const min = Math.min(...window);
    const max = Math.max(...window);
    
    if (max - min === 0) rawStoch[i] = 100;
    else rawStoch[i] = ((rsiValues[i] - min) / (max - min)) * 100;
  }
  
  // Smothen with SMA (commonly K and D are SMA of rawStoch)
  const nonNullStoch = rawStoch.filter(s => s !== null);
  const kLineValues = calculateSMA(nonNullStoch, k);
  
  const kLine = new Array(rawStoch.length).fill(null);
  let kIdx = 0;
  for (let i = 0; i < rawStoch.length; i++) {
    if (rawStoch[i] !== null) {
      if (kIdx < kLineValues.length) {
        kLine[i] = kLineValues[kIdx++];
      }
    }
  }
  
  const nonNullK = kLine.filter(kVal => kVal !== null);
  const dLineValues = calculateSMA(nonNullK, d);
  
  const dLine = new Array(kLine.length).fill(null);
  let dIdx = 0;
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] !== null) {
      if (dIdx < dLineValues.length) {
        dLine[i] = dLineValues[dIdx++];
      }
    }
  }
  
  return { kLine, dLine };
};

// 6. Bollinger Bands
export const calculateBollingerBands = (closes, period = 20, multiplier = 2) => {
  const middle = calculateSMA(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    if (mean === null) continue;

    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    upper[i] = mean + multiplier * stdDev;
    lower[i] = mean - multiplier * stdDev;
  }
  return { middle, upper, lower };
};
// 7. ADX (Average Directional Index)
export const calculateADX = (data, period = 14) => {
  const adx = new Array(data.length).fill(null);
  if (data.length < period * 2) return adx;

  const tr = new Array(data.length).fill(0);
  const plusDM = new Array(data.length).fill(0);
  const minusDM = new Array(data.length).fill(0);

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const closePrev = data[i - 1].close;
    const highPrev = data[i - 1].high;
    const lowPrev = data[i - 1].low;

    tr[i] = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
    
    const upMove = high - highPrev;
    const downMove = lowPrev - low;

    if (upMove > downMove && upMove > 0) plusDM[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDM[i] = downMove;
  }

  const smoothTR = new Array(data.length).fill(0);
  const smoothPlusDM = new Array(data.length).fill(0);
  const smoothMinusDM = new Array(data.length).fill(0);

  let initialTR = 0;
  let initialPlusDM = 0;
  let initialMinusDM = 0;

  for (let i = 1; i <= period; i++) {
    initialTR += tr[i];
    initialPlusDM += plusDM[i];
    initialMinusDM += minusDM[i];
  }

  smoothTR[period] = initialTR;
  smoothPlusDM[period] = initialPlusDM;
  smoothMinusDM[period] = initialMinusDM;

  for (let i = period + 1; i < data.length; i++) {
    smoothTR[i] = smoothTR[i - 1] - smoothTR[i - 1] / period + tr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - smoothPlusDM[i - 1] / period + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - smoothMinusDM[i - 1] / period + minusDM[i];
  }

  const plusDI = smoothPlusDM.map((val, i) => (smoothTR[i] === 0 ? 0 : (val / smoothTR[i]) * 100));
  const minusDI = smoothMinusDM.map((val, i) => (smoothTR[i] === 0 ? 0 : (val / smoothTR[i]) * 100));


  const dx = new Array(data.length).fill(0);
  for (let i = period; i < data.length; i++) {
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
  }

  let initialADX = 0;
  for (let i = period; i < period * 2; i++) {
    initialADX += dx[i];
  }
  adx[period * 2 - 1] = initialADX / period;

  for (let i = period * 2; i < data.length; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }

  return adx;
};
