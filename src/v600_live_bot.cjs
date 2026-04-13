const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

// v7.0.2 전략 모듈 로드
const strategy = require('../strategies/Logic.v7.0.2.cjs');

dotenv.config();

// __dirname 대응 (ESM/CJS 혼용 시)
const _dirname = path.resolve();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID;
const SYMBOL = process.env.SYMBOL || 'BTCUSDT';

const RULES_FILE = path.join(_dirname, 'live_rules.json');
let liveRules = {};

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) return console.log("⚠️ No Telegram Secrets in .env");
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, { chat_id: CHAT_ID, text: message, parse_mode: 'HTML' });
    console.log("✉️ Alert Sent!");
  } catch (e) { console.error('Telegram failed:', e.message); }
}

async function fetchOHLCV(interval, limit = 500) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${SYMBOL}&interval=${interval}&limit=${limit}`;
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data.map(d => ({ 
      time: d[0], 
      open: parseFloat(d[1]), 
      high: parseFloat(d[2]), 
      low: parseFloat(d[3]), 
      close: parseFloat(d[4]), 
      volume: parseFloat(d[5]) 
    }));
  } catch (e) {
    console.error(`❌ API Blocked for ${interval}: ${e.message}`);
    throw e;
  }
}

let lastSignal = 'hold';
let lastNotifiedPrice = 0;

async function runLiveCycle() {
  console.log(`[v7.0.2 Persistent Monitor] Starting...`);
  await sendTelegram(`🤖 <b>[Antigravity v7.0.2]</b>\n24시간 무인 감시 시스템이 기동되었습니다.\n• 대상: ${SYMBOL}\n• 방식: 브라우저 외 백그라운드 상시 감시`);

  while (true) {
    try {
      console.log(`\n--- SCANNING MARKET (${new Date().toLocaleString()}) ---`);
      
      const [m5, h1, d1] = await Promise.all([
        fetchOHLCV('5m'),
        fetchOHLCV('1h'),
        fetchOHLCV('1d')
      ]);

      // 최신 규칙 로드
      if (fs.existsSync(RULES_FILE)) {
        liveRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      }

      // 지표 계산 및 신호 판단 (v7.0.2 로직 사용)
      const indicators = strategy.indicators_logic({ m5, h1, d1 });
      const indices = { idx5m: m5.length - 2, r1h: h1.length - 2, r1d: d1.length - 2 };
      const currentSig = strategy.signal_logic(indicators, indices, liveRules);

      console.log(`Current Signal: ${currentSig.toUpperCase()}`);

      if (currentSig !== lastSignal) {
        if (currentSig !== 'hold') {
          const lastM5 = m5[m5.length - 1];
          const entryPrice = currentSig === 'long' ? lastM5.low : lastM5.high;
          
          if (currentSig === lastSignal && entryPrice === lastNotifiedPrice) {
            console.log(`♻️ Skipping duplicate price/signal alert.`);
          } else {
            const tpPrice = entryPrice * (currentSig === 'long' ? 1.03 : 0.97);
            const slPrice = entryPrice * (currentSig === 'long' ? 0.85 : 1.15);

            const message = `🚀 <b>[v7.0.2 Persistent LIVE]</b>\n\n` +
              `📌 <b>포지션</b>: ${currentSig.toUpperCase()} (1분 실외 감시 중)\n` +
              `💵 <b>진입 희망가</b>: $${entryPrice.toLocaleString()}\n` +
              `✅ <b>익절가(TP)</b>: $${tpPrice.toLocaleString()} (+3% Net)\n` +
              `❌ <b>손절가(SL)</b>: $${slPrice.toLocaleString()} (-15%)\n\n` +
              `📡 <b>v7.0.2 분석</b>: 트리플 컨플루언스 발생! (1분 주기로 정밀 추적 중)`;

            await sendTelegram(message);
            lastNotifiedPrice = entryPrice;
          }
        } else {
          await sendTelegram(`💤 <b>[v7.0.2 Global]</b>\n\n신호가 종료되었습니다. (현재 포지션: HOLD)`);
          lastNotifiedPrice = 0;
        }
        lastSignal = currentSig;
      }
    } catch (e) {
      console.error('v7.0.2 Loop Error:', e.message);
    }

    // 1분 대기
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

runLiveCycle();

