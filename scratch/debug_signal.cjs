const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { buildRulesFromEnv } = require('../lib/rules_helper.cjs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const strategyVersion = 'Logic.v8.2.4.cjs'; // 깃버전 최신 전략으로 변경!
const strategy = require('../strategies/' + strategyVersion);
const SYMBOL = (process.env.SYMBOL || 'BTCUSDT').toUpperCase();

async function fetchOHLCV(interval, limit = 1000) {
  const symbol = SYMBOL.toUpperCase();
  const bybitInterval = interval === '1h' ? '60' : (interval === '5m' ? '5' : 'D');
  
  const urls = [
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`,
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 7000 });
      if (url.includes('bybit')) {
        return res.data.result.list.map(d => ({
          time: parseInt(d[0]), low: parseFloat(d[3]), high: parseFloat(d[2]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        })).reverse();
      }
      return res.data.map(d => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
      }));
    } catch (e) {
      continue;
    }
  }
  throw new Error("❌ 모든 데이터 서버 실패");
}

function toKSTString(timestamp) {
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
}

function findLastClosed1hIndex(h1, targetISO) {
  const targetTime = new Date(targetISO).getTime();
  if (isNaN(targetTime)) {
    console.error("Invalid target time:", targetISO);
    return -1;
  }
  return h1.findLastIndex(k => k.time + 3600000 <= targetTime);
}

async function debug() {
  try {
    const [m5, h1, d1] = await Promise.all([
      fetchOHLCV('5m'),
      fetchOHLCV('1h'),
      fetchOHLCV('1d')
    ]);

    const envRules = buildRulesFromEnv();
    console.log('--- 깃버전 .env 룰 파싱 결과 (1h short) ---');
    console.log(JSON.stringify(envRules.short['1h'], null, 2));

    const indicators = strategy.indicators_logic({ m5, h1, d1 });

    const testCases = [
      { label: "Case 1: 6월 11일 오전 9:30:30", targetTime: "2026-06-11T09:30:30+09:00" },
      { label: "Case 2: 6월 12일 오후 3:10:17", targetTime: "2026-06-12T15:10:17+09:00" },
      { label: "Case 3: 6월 13일 오전 12:20:30", targetTime: "2026-06-13T00:20:30+09:00" }
    ];

    testCases.forEach(tc => {
      console.log(`\n========================================`);
      console.log(`🔎 깃버전 검증 대상: ${tc.label}`);
      console.log(`========================================`);

      const idx = findLastClosed1hIndex(h1, tc.targetTime);
      if (idx === -1) {
        console.log("❌ 해당 시간의 캔들을 찾을 수 없습니다.");
        return;
      }

      console.log(`직전 마감 1h 봉 시간 (KST): ${toKSTString(h1[idx].time)} ~ ${toKSTString(h1[idx].time + 3600000)}`);
      console.log(`직전 마감 1h 종가: $${h1[idx].close}`);

      const macd_m = indicators.h1.macd.m[idx];
      const macd_s = indicators.h1.macd.s[idx];
      const stoch_k = indicators.h1.stoch.k[idx];
      const stoch_d = indicators.h1.stoch.d[idx];

      const macdCrossMatch = macd_m < macd_s;
      const stochCrossMatch = stoch_k < stoch_d;
      
      // 깃버전 절대값 MACD Value 비교식 모사
      const macdValMatch = Math.abs(macd_m) < envRules.short['1h'].macdValue; 

      console.log(`- H1 MACD: ${macd_m?.toFixed(2)} | Signal: ${macd_s?.toFixed(2)}`);
      console.log(`  ➡️ MACD < Signal (Short Cross): ${macdCrossMatch ? '✅ 충족 (TRUE)' : '❌ 불충족 (FALSE)'}`);
      
      console.log(`- H1 Stoch K: ${stoch_k?.toFixed(2)} | D: ${stoch_d?.toFixed(2)}`);
      console.log(`  ➡️ Stoch K < D (Short Cross): ${stochCrossMatch ? '✅ 충족 (TRUE)' : '❌ 불충족 (FALSE)'}`);

      console.log(`- H1 MACD Abs Value (|MACD| < ${envRules.short['1h'].macdValue}): ${Math.abs(macd_m)?.toFixed(2)} < ${envRules.short['1h'].macdValue}`);
      console.log(`  ➡️ MACD Value Filter: ${macdValMatch ? '✅ 통과 (TRUE)' : '❌ 필터링 차단 (FALSE)'}`);

      const final1hShort = macdCrossMatch && stochCrossMatch && macdValMatch;
      console.log(`\n결론: 깃버전 1h 숏 조건 판정 결과 ➡️ ${final1hShort ? '🔥 숏 진입 가능 (매매알림 발생함)' : '💤 진입 차단 (매매알림 없음)'}`);
    });

  } catch (err) {
    console.error("Error:", err);
  }
}

debug();
