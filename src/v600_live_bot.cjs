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
  
  // 시스템 기동 즉시 알림 (API 대기 전)
  await sendTelegram(`✅ <b>[v7.0.2 Persistent LIVE] System Online</b>\n\n📡 <b>상태</b>: 시장 감시 시작 (1분 주기)\n⚙️ <b>심볼</b>: ${SYMBOL}`);

  let isFirstScan = true;
  let errorSent = false;

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
      errorSent = false; // 성공 시 에러 상태 초기화

      // 신호가 바뀌었을 때만 알림 발송 (첫 스캔은 이미 Online 알림 보냄)
      const isSignalChanged = (!isFirstScan && currentSig !== lastSignal);

      if (isSignalChanged || (isFirstScan && currentSig !== 'hold')) {
        const lastM5 = m5[m5.length - 1];
        const currentPrice = lastM5.close; // 실시간 현재가
        const entryPrice = currentSig === 'long' ? lastM5.low : (currentSig === 'short' ? lastM5.high : lastM5.close);
        const checkTime = new Date().toLocaleString('ko-KR', { hour12: true }); // 현재 시간

        const tpPrice = entryPrice * (currentSig === 'long' ? 1.03 : 0.97);
        const slPrice = entryPrice * (currentSig === 'long' ? 0.85 : 1.15);

        let message = '';
        if (currentSig !== 'hold') {
          // 진입 신호 발생 시
          message = `🚀 <b>[v7.0.2 Persistent LIVE] 신호 발생!</b>\n\n` +
            `⌚ <b>체크 시간</b>: ${checkTime}\n` +
            `💰 <b>현재 가격</b>: $${currentPrice.toLocaleString()}\n\n` +
            `📌 <b>포지션</b>: ${currentSig.toUpperCase()}\n` +
            `💵 <b>진입 희망가</b>: $${entryPrice.toLocaleString()}\n` +
            `✅ <b>익절가(TP)</b>: $${tpPrice.toLocaleString()} (+3%)\n` +
            `❌ <b>손절가(SL)</b>: $${slPrice.toLocaleString()} (-15%)\n\n` +
            `📡 1분 주기로 정밀 추적 중입니다.`;
        } else if (lastSignal !== 'hold') {
          // 기존 포지션이 종료되어 HOLD로 바뀐 경우
          message = `💤 <b>[v7.0.2 Persistent LIVE]</b>\n\n신호가 종료되었습니다. (현재 포지션: HOLD)\n⌚ <b>체크 시간</b>: ${checkTime}\n💰 <b>마지막 가격</b>: $${currentPrice.toLocaleString()}`;
        }

        if (message) {
          await sendTelegram(message);
        }
        
        lastSignal = currentSig;
        lastNotifiedPrice = entryPrice;
      }
      
      isFirstScan = false;
    } catch (e) {
      console.error('v7.0.2 Loop Error:', e.message);
      if (!errorSent) {
        await sendTelegram(`⚠️ <b>[v7.0.2 LIVE Error]</b>\n시장 데이터 수집 실패: ${e.message}\n(IP 차단 또는 네트워크 문제를 확인하세요)`);
        errorSent = true; // 스팸 방지
      }
    }

    // 1분 대기
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

runLiveCycle();

