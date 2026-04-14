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

const TELEGRAM_TOKEN = (process.env.TELEGRAM_TOKEN || "").trim();
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || "").trim();
const SYMBOL = (process.env.SYMBOL || 'BTCUSDT').toUpperCase();

const RULES_FILE = path.join(_dirname, 'live_rules.json');
let liveRules = {};

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) {
    return console.log(`⚠️ Secrets Missing: Token(${TELEGRAM_TOKEN.length}), ID(${CHAT_ID.length})`);
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, { 
      chat_id: CHAT_ID, 
      text: message, 
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    console.log("✉️ Alert Sent successfully!");
  } catch (e) { 
    console.error('Telegram failed:', e.response ? JSON.stringify(e.response.data) : e.message); 
  }
}

async function fetchOHLCV(interval, limit = 500) {
  const symbol = SYMBOL.toUpperCase();
  const bybitInterval = interval === '1h' ? '60' : (interval === '5m' ? '5' : 'D');
  
  const urls = [
    // 1순위: 바이낸스 공식 (지연 최소)
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    // 2순위: 바이낸스 비전 (규제 우회용)
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    // 3순위: 바이비트 (바이낸스 차단 시 강력한 대안)
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`,
    // 4순위: MEXC (백업용)
    `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 4000 });
      if (url.includes('bybit')) {
        return res.data.result.list.map(d => ({
          time: parseInt(d[0]), low: parseFloat(d[3]), high: parseFloat(d[2]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        })).reverse();
      }
      return res.data.map(d => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
      }));
    } catch (e) {
      console.log(`⚠️ URL 실패 (${new URL(url).hostname}): ${e.message}`);
      continue; // 다음 주소로 시도
    }
  }
  throw new Error("❌ 모든 API 통로가 차단되었습니다.");
}

let lastSignal = 'hold';
let lastNotifiedPrice = 0;

async function runLiveCycle() {
  console.log(`[v7.0.2 Persistent Monitor] Starting...`);
  let isFirstScan = true;

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

      // 신호가 바뀌었거나, 첫 스캔인데 진입 신호(LONG/SHORT)인 경우에만 발송
      const isNewTradeSignal = (isFirstScan && currentSig !== 'hold');
      const isSignalChanged = (!isFirstScan && currentSig !== lastSignal);

      if (isNewTradeSignal || isSignalChanged) {
        const lastM5 = m5[m5.length - 1];
        const entryPrice = currentSig === 'long' ? lastM5.low : (currentSig === 'short' ? lastM5.high : lastM5.close);
        const tpPrice = entryPrice * (currentSig === 'long' ? 1.03 : 0.97);
        const slPrice = entryPrice * (currentSig === 'long' ? 0.85 : 1.15);

        let message = '';
        if (currentSig !== 'hold') {
          // 진입 시 상세 리포트
          message = `🚀 <b>[v7.0.2 Persistent LIVE]</b>\n\n` +
            `📌 <b>포지션</b>: ${currentSig.toUpperCase()} (1분 실외 감시 중)\n` +
            `💵 <b>진입 희망가</b>: $${entryPrice.toLocaleString()}\n` +
            `✅ <b>익절가(TP)</b>: $${tpPrice.toLocaleString()} (+3% Net)\n` +
            `❌ <b>손절가(SL)</b>: $${slPrice.toLocaleString()} (-15%)\n\n` +
            `📡 <b>v7.0.2 분석</b>: 트리플 컨플루언스 발생! (1분 주기로 정밀 추적 중)`;
        } else if (!isFirstScan) {
          // 기존 포지션이 종료되어 HOLD로 바뀐 경우에만 알림
          message = `💤 <b>[v7.0.2 Global]</b>\n\n신호가 종료되었습니다. (현재 포지션: HOLD)`;
        }

        if (message) {
          await sendTelegram(message);
        }
        
        lastSignal = currentSig;
        lastNotifiedPrice = entryPrice;
      }
      
      isFirstScan = false; // 첫 스캔 상태 해제
    } catch (e) {
      console.error('v7.0.2 Loop Error:', e.message);
    }

    // 1분 대기
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

runLiveCycle();

