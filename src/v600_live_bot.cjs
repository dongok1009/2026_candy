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

// 환경 변수 로드 및 개선된 토큰 검증
const getRawEnv = (key) => (process.env[key] || "").trim();
const isPlaceholder = (val) => !val || val.includes("your_") || val.length < 5;

let TELEGRAM_TOKEN = getRawEnv('TELEGRAM_TOKEN');
let CHAT_ID = getRawEnv('TELEGRAM_CHAT_ID') || getRawEnv('CHAT_ID');

// 시스템 환경 변수(GitHub Secrets 등)가 플레이스홀더를 덮어쓰도록 보정
if (isPlaceholder(TELEGRAM_TOKEN)) TELEGRAM_TOKEN = getRawEnv('TELEGRAM_TOKEN'); 
if (isPlaceholder(CHAT_ID)) CHAT_ID = getRawEnv('CHAT_ID') || getRawEnv('TELEGRAM_CHAT_ID');

const SYMBOL = (process.env.SYMBOL || 'BTCUSDT').toUpperCase();
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'; // 수동 실행 여부 확인

const RULES_FILE = path.join(_dirname, 'live_rules.json');
let liveRules = {};

async function sendTelegram(message) {
  if (isPlaceholder(TELEGRAM_TOKEN) || isPlaceholder(CHAT_ID)) {
    return console.log(`⚠️ Telegram Secrets Missing or Invalid (Placeholder detected)`);
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, { 
      chat_id: CHAT_ID, 
      text: message, 
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    console.log("✉️ Telegram Alert Sent!");
  } catch (e) { 
    const errorMsg = e.response ? JSON.stringify(e.response.data) : e.message;
    console.error('❌ Telegram Send Failed:', errorMsg); 
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
      const res = await axios.get(url, { 
        timeout: 7000, 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
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
  throw new Error("❌ 모든 데이터 서버가 차단되었습니다. (네트워크 지연 또는 IP 차단 가능성)");
}

let lastSignal = 'hold';
let lastNotifiedPrice = 0;

async function runLiveCycle() {
  console.log(`[v7.0.2 Persistent Monitor] Starting...`);
  
  // 기동 시 짧은 생존 알림 (매시간 기동되는 깃허브 특성상 생존 확인이 필요함)


  let isFirstScan = true;
  let errorSent = false;
  let nextHeartbeat = Date.now() + (12 * 60 * 60 * 1000); // 상세 하트비트는 12시간마다

  while (true) {
    try {
      console.log(`\n--- SCANNING MARKET (${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}) ---`);
      
      const [m5, h1, d1] = await Promise.all([
        fetchOHLCV('5m'),
        fetchOHLCV('1h'),
        fetchOHLCV('1d')
      ]);

      // 최신 규칙 로드
      if (fs.existsSync(RULES_FILE)) {
        liveRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      }

      const indicators = strategy.indicators_logic({ m5, h1, d1 });
      const indices = { idx5m: m5.length - 1, r1h: h1.length - 1, r1d: d1.length - 1 };
      const currentSig = strategy.signal_logic(indicators, indices, liveRules);

      console.log(`Current Signal: ${currentSig.toUpperCase()}`);
      errorSent = false;

      const lastM5 = m5[m5.length - 1];
      const currentPrice = lastM5.close;
      const checkTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: true });

      // [신규] 첫 스캔 성공 시 감시 시작 알림 (현재가/시간 포함)
      if (isFirstScan) {
        await sendTelegram(`📡 <b>[v7.0.2] 감시 시작</b>\n⌚ 시간: ${checkTime}\n💰 현재가: $${currentPrice.toLocaleString()}`);
      }

      // 1. 신호 변화 알림 (진입/종료)
      const isSignalChanged = (!isFirstScan && currentSig !== lastSignal);
      if (isSignalChanged || (isFirstScan && currentSig !== 'hold')) {
        const entryPrice = currentSig === 'long' ? lastM5.low : (currentSig === 'short' ? lastM5.high : lastM5.close);
        const tpPrice = entryPrice * (currentSig === 'long' ? 1.03 : 0.97);
        const slPrice = entryPrice * (currentSig === 'long' ? 0.85 : 1.15);

        let message = '';
        if (currentSig !== 'hold') {
          message = `🚀 <b>[v7.0.2 Persistent LIVE] 신호 발생!</b>\n\n` +
            `⌚ <b>체크 시간</b>: ${checkTime}\n` +
            `💰 <b>현재 가격</b>: $${currentPrice.toLocaleString()}\n\n` +
            `📌 <b>포지션</b>: ${currentSig.toUpperCase()}\n` +
            `💵 <b>진입 희망가</b>: $${entryPrice.toLocaleString()}\n` +
            `✅ <b>익절가(TP)</b>: $${tpPrice.toLocaleString()} (+3%)\n` +
            `❌ <b>손절가(SL)</b>: $${slPrice.toLocaleString()} (-15%)\n\n` +
            `📡 실시간 추적 중입니다.`;
        } else if (lastSignal !== 'hold') {
          message = `💤 <b>[v7.0.2 Persistent LIVE]</b>\n\n신호가 종료되었습니다. (포지션: HOLD)\n⌚ <b>시간</b>: ${checkTime}\n💰 <b>가격</b>: $${currentPrice.toLocaleString()}`;
        }

        if (message) await sendTelegram(message);
        lastSignal = currentSig;
      }

      // 2. 12시간 상세 하트비트 (길게 실행될 경우 대비)
      if (Date.now() > nextHeartbeat) {
        await sendTelegram(`📡 <b>[v7.0.2 Summary]</b>\n시스템 정상 감시 중\n• 현재가: $${currentPrice.toLocaleString()}\n• 신호: ${currentSig.toUpperCase()}`);
        nextHeartbeat = Date.now() + (12 * 60 * 60 * 1000);
      }
      
      isFirstScan = false;
    } catch (e) {
      console.error('v7.0.2 Loop Error:', e.message);
      if (!errorSent) {
        await sendTelegram(`⚠️ <b>[v7.0.2 LIVE Error]</b>\n오류 발생: ${e.message}`);
        errorSent = true;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

runLiveCycle();
