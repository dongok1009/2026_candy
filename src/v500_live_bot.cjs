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
        await axios.post(url, { chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' });
        console.log("✉️ Alert Sent!");
    } catch (e) { console.error('Telegram failed:', e.message); }
}

async function fetchBybitKlines(interval, limit = 200) {
    const bybitMap = { '5m': '5', '1h': '60', '1d': 'D' };
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${SYMBOL}&interval=${bybitMap[interval] || interval}&limit=${limit}`;
    const res = await axios.get(url, { timeout: 5000 });
    // Bybit list is [newest...oldest], reverse to [oldest...newest]
    return res.data.result.list.reverse().map(d => ({
        time: parseInt(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
    }));
}

async function runLiveCheck() {
  try {
    console.log(`[v5.0.0 Bybit Check] (${new Date().toLocaleString()})`);
    
    const klines5m = await fetchBybitKlines('5m');
    const klines1h = await fetchBybitKlines('1h');
    const klines1d = await fetchBybitKlines('1d');

    const ind5m = { stoch: calculateStochRSI(calculateRSI(klines5m.map(k => k.close))) };
    const ind1h = { macd: calculateMACD(klines1h.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1h.map(k => k.close))) };
    const ind1d = { macd: calculateMACD(klines1d.map(k => k.close)), stoch: calculateStochRSI(calculateRSI(klines1d.map(k => k.close))) };

    const getSigAt = (i5, ih, id) => {
        const cond5m = (ind5m.stoch.k[i5] > ind5m.stoch.d[i5]) ? 'long' : (ind5m.stoch.k[i5] < ind5m.stoch.d[i5] ? 'short' : 'hold');
        const cond1h = (ind1h.macd.m[ih] > ind1h.macd.s[ih] && ind1h.stoch.k[ih] > ind1h.stoch.d[ih]) ? 'long' : (ind1h.macd.m[ih] < ind1h.macd.s[ih] && ind1h.stoch.k[ih] < ind1h.stoch.d[ih] ? 'short' : 'hold');
        const cond1d = (ind1d.macd.m[id] > ind1d.macd.s[id] && ind1d.stoch.k[id] > ind1d.stoch.d[id]) ? 'long' : (ind1d.macd.m[id] < ind1d.macd.s[id] && ind1d.stoch.k[id] < ind1d.stoch.d[id] ? 'short' : 'hold');
        if (cond5m === 'long' && cond1h === 'long' && cond1d === 'long') return 'long';
        if (cond5m === 'short' && cond1h === 'short' && cond1d === 'short') return 'short';
        return 'hold';
    };

    const cur5 = ind5m.stoch.k.length - 1;
    const curH = ind1h.stoch.k.length - 1;
    const curD = ind1d.stoch.k.length - 1;

    const currentSig = getSigAt(cur5, curH, curD);
    const prevSig = getSigAt(cur5 - 1, curH, curD);

    console.log(`Current: ${currentSig}, Prev: ${prevSig}`);

    if (currentSig !== 'hold' && prevSig === 'hold') {
      const entryPrice = currentSig === 'long' ? klines5m[klines5m.length - 1].low : klines5m[klines5m.length - 1].high;
      const totalFeesOnMargin = (MAKER_FEE_RATE + EXIT_MAKER_FEE_RATE) * LEVERAGE;
      const grossTP = TARGET_NET_ROI + totalFeesOnMargin;
      const tpPrice = currentSig === 'long' ? entryPrice * (1 + grossTP/LEVERAGE) : entryPrice * (1 - grossTP/LEVERAGE);
      const slPrice = currentSig === 'long' ? entryPrice * (1 - SL_ROI/LEVERAGE) : entryPrice * (1 + SL_ROI/LEVERAGE);

      const message = `🚀 *[v5.0.0 Bybit LIVE 알림]*\n\n` +
                      `📌 *포지션*: ${currentSig.toUpperCase()} (바이빗 가격 기준)\n` +
                      `💵 *진입 희망가*: $${entryPrice.toLocaleString()}\n` +
                      `✅ *목표가(TP)*: $${tpPrice.toLocaleString()} (+3%)\n` +
                      `❌ *손절가(SL)*: $${slPrice.toLocaleString()} (-15%)\n\n` +
                      `🛡️ *우회 상태*: 깃허브 서버(IP 차단) 우회 성공!`;
      
      await sendTelegram(message);
    } else {
      console.log("💤 No NEW signal on Bybit.");
      // 수동 실행 시 "정상 우회 연결 확인" 메시지 전송
      if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
          await sendTelegram("✅ *[v5.0.0 Bybit 우회 성공]*\n\n바이빗 API를 통해 깃허브 서버 차단을 완벽하게 우회하였습니다! 🎉\n\n이제 정상적으로 매매 신호를 실시간 전송합니다.");
      }
    }
  } catch (e) {
    console.error('Bybit API Error:', e.message);
  }
}

runLiveCheck();
