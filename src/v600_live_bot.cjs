const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SYMBOL = 'BTCUSDT';

const LEVERAGE = 5;
const TARGET_NET_ROI = 0.03;
const SL_ROI = 0.15;
const MAKER_FEE_RATE = 0.0002;
const EXIT_MAKER_FEE_RATE = 0.0002;

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

const calculateSMA = (data, p) => {
  const sma = new Array(data.length).fill(null);
  for (let i = p - 1; i < data.length; i++) {
    let sum = 0; for (let j = 0; j < p; j++) sum += data[i - j];
    sma[i] = sum / p;
  }
  return sma;
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

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) return console.log("⚠️ No Telegram Secrets.");
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, { chat_id: CHAT_ID, text: message, parse_mode: 'HTML' });
    console.log("✉️ Alert Sent!");
  } catch (e) { console.error('Telegram failed:', e.message); }
}

async function fetchPriceData(interval, limit = 200) {
  const urls = [
    `https://api.bytick.com/v5/market/kline?category=linear&symbol=${SYMBOL}&interval=${interval === '1h' ? '60' : (interval === '5m' ? '5' : 'D')}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&limit=${limit}`,
    `https://api.mexc.com/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&limit=${limit}`
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      if (url.includes('bytick') || url.includes('bybit')) {
        return res.data.result.list.reverse().map(d => ({ time: parseInt(d[0]), low: parseFloat(d[3]), high: parseFloat(d[2]), close: parseFloat(d[4]) }));
      }
      return res.data.map(d => ({ low: parseFloat(d[3]), high: parseFloat(d[2]), close: parseFloat(d[4]), time: d[0] }));
    } catch (e) {
      console.log(`⚠️ Skip ${new URL(url).hostname}: ${e.message}`);
    }
  }
  throw new Error("❌ API Blocked.");
}

let lastSignal = 'hold';
const START_TIME = Date.now();
const MAX_LIFE_MS = 5.8 * 60 * 60 * 1000; // 5.8 hours (GitHub limits to 6h)

async function runLiveCycle() {
  while (true) {
    if (Date.now() - START_TIME > MAX_LIFE_MS) {
      console.log("⏰ Max life reached. Graceful exit for restart.");
      process.exit(0);
    }

    try {
      console.log(`\n[v6.0.0 Persistent Monitor] (${new Date().toLocaleString()})`);
      console.log(`Last Notified: ${lastSignal.toUpperCase()}`);

      const klines5m = await fetchPriceData('5m');
      const klines1h = await fetchPriceData('1h');
      const klines1d = await fetchPriceData('1d');

      const ind5m = { stoch: calculateStochRSI(calculateRSI(klines5m.map(k => k.close))) };
      const ind1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
      const ind1d = { macd: calculateMACD(klines1d.map(k => k.close)) };

      const getSigAt = (i5, ih, id) => {
        const cond5m = (ind5m.stoch.k[i5] > ind5m.stoch.d[i5]) ? 'long' : (ind5m.stoch.k[i5] < ind5m.stoch.d[i5] ? 'short' : 'hold');
        const cond1h = (ind1h.macd.m[ih] > ind1h.macd.s[ih] && ind1h.stoch.k[ih] > ind1h.stoch.d[ih]) ? 'long' : (ind1h.macd.m[ih] < ind1h.macd.s[ih] && ind1h.stoch.k[ih] < ind1h.stoch.d[ih]) ? 'short' : 'hold';
        const cond1d = (ind1d.macd.m[id] > ind1d.macd.s[id]) ? 'long' : (ind1d.macd.m[id] < ind1d.macd.s[id] ? 'short' : 'hold');
        if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') return 'long';
        if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') return 'short';
        return 'hold';
      };

      const cur5 = ind5m.stoch.k.length - 1;
      const curH = ind1h.macd.m.length - 1;
      const curD = ind1d.macd.m.length - 1;

      const currentSig = getSigAt(cur5, curH, curD);
      console.log(`Current Signal: ${currentSig.toUpperCase()}`);

      // Persistent Signal Memory Logic (Alert Only on CHANGE)
      if (currentSig !== lastSignal) {
        if (currentSig !== 'hold') {
          const signalPrice = klines5m[klines5m.length - 1].close;
          const prevLow = klines5m[klines5m.length - 1].low;
          const prevHigh = klines5m[klines5m.length - 1].high;

          const entryPrice = currentSig === 'long' ? Math.min(signalPrice, prevLow) : Math.max(signalPrice, prevHigh);
          const feeOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
          const grossTP = TARGET_NET_ROI + feeOnMargin;
          const tpPrice = currentSig === 'long' ? entryPrice * (1 + grossTP / LEVERAGE) : entryPrice * (1 - grossTP / LEVERAGE);
          const slPrice = currentSig === 'long' ? entryPrice * (1 - SL_ROI / LEVERAGE) : entryPrice * (1 + SL_ROI / LEVERAGE);

          const message = `🚀 <b>[v6.0.0 Persistent LIVE]</b>\n\n` +
            `📌 <b>포지션</b>: ${currentSig.toUpperCase()} (1분 실외 감시 중)\n` +
            `💵 <b>진입 희망가</b>: $${entryPrice.toLocaleString()}\n` +
            `✅ <b>익절가(TP)</b>: $${tpPrice.toLocaleString()} (+3% Net)\n` +
            `❌ <b>손절가(SL)</b>: $${slPrice.toLocaleString()} (-15%)\n\n` +
            `📡 <b>v6.0.0 분석</b>: 트리플 컨플루언스 발생! (1분 주기로 정밀 추적 중)`;

          await sendTelegram(message);
        } else {
          await sendTelegram(`💤 <b>[v6.0.0 Global]</b>\n\n신호가 종료되었습니다. (현재 포지션: HOLD)`);
        }
        lastSignal = currentSig;
      }
    } catch (e) {
      console.error('v6.0.0 Loop Error:', e.message);
    }

    // Wait 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

runLiveCycle();

