const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 프로젝트 루트의 indicators 및 strategies 로드
const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');
const strategyV820 = require('../strategies/Logic.v8.2.0.cjs');
const strategyV703 = require('../strategies/Logic.v7.0.3.cjs');

const SYMBOL = 'BTCUSDT';
// 6월 1일 00:10 KST = 2026-06-01 00:10:00+09:00 (1780282200000ms 또는 밀리초)
const TARGET_TIME = new Date('2026-06-01T00:10:00+09:00').getTime();

async function fetchOHLCV(interval, limit = 1000) {
  const symbol = SYMBOL.toUpperCase();
  const bybitInterval = interval === '1h' ? '60' : (interval === '5m' ? '5' : 'D');
  
  const urls = [
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 7000 });
      if (url.includes('bybit')) {
        return res.data.result.list.map(d => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        })).reverse();
      }
      return res.data.map(d => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
      }));
    } catch (e) {
      continue;
    }
  }
  throw new Error("모든 데이터 조회 실패");
}

async function debug() {
  console.log(`\n🔍 [DEBUG] 6월 1일 00:10 KST 시점의 지표 정밀 디버깅 시작...`);
  
  try {
    const [m5, h1, d1] = await Promise.all([
      fetchOHLCV('5m', 1000),
      fetchOHLCV('1h', 1000),
      fetchOHLCV('1d', 500)
    ]);

    console.log(`📊 수집 완료: 5m(${m5.length}개), 1h(${h1.length}개), 1d(${d1.length}개)`);

    // 타겟 시간의 정확한 인덱스 찾기
    const findIndex = (klines, targetTime) => {
      let bestIdx = -1;
      let minDiff = Infinity;
      for (let i = 0; i < klines.length; i++) {
        const diff = targetTime - klines[i].time;
        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const targetIdx5m = findIndex(m5, TARGET_TIME); // 12:10:00 봉
    const r1h = findIndex(h1, TARGET_TIME);        // 12:00:00 봉
    const r1d = findIndex(d1, TARGET_TIME);        // 05-31 09:00:00 봉

    if (targetIdx5m === -1 || r1h === -1 || r1d === -1) {
      console.log("❌ 해당 시간의 캔들 데이터를 찾지 못했습니다.");
      return;
    }

    // 💡 실제 봇이 판정한 완성봉은 12:05:00 봉이므로 idx5m = targetIdx5m - 1 로 설정!
    const idx5m = targetIdx5m - 1;

    console.log(`📍 봇 판정 타겟 완성봉 시각 매칭 인덱스:`);
    console.log(`- 5m (12:05 완성봉): [${idx5m}] ${new Date(m5[idx5m].time).toLocaleString('ko-KR')} | 종가: $${m5[idx5m].close}`);
    console.log(`- 1h (12:00 완성봉): [${r1h}] ${new Date(h1[r1h].time).toLocaleString('ko-KR')} | 종가: $${h1[r1h].close}`);
    console.log(`- 1d (05-31 완성봉): [${r1d}] ${new Date(d1[r1d].time).toLocaleString('ko-KR')} | 종가: $${d1[r1d].close}`);

    // 지표 연산
    const indicatorsV820 = strategyV820.indicators_logic({ m5, h1, d1 });
    const indicatorsV703 = strategyV703.indicators_logic({ m5, h1, d1 });

    // 사용자의 실제 live_rules.json (StochK 99/98, RSI 비활성, 목표 0.04)을 시뮬레이션
    const mockRules = {
      "5m": {
        "adxEnabled": true, "adxThreshold": 30, "macdCrossEnabled": false,
        "stochCrossEnabled": true, "stochLimitEnabled": true, "stochKThreshold": 99,
        "rsiEnabled": false, "rsiLow": 5, "rsiHigh": 95, "macdValueEnabled": false, "macdValue": 0
      },
      "1h": {
        "adxEnabled": false, "adxThreshold": 30, "macdCrossEnabled": true,
        "stochCrossEnabled": true, "stochLimitEnabled": false, "stochKThreshold": 98,
        "rsiEnabled": false, "rsiLow": 5, "rsiHigh": 95
      },
      "1d": {
        "adxEnabled": false, "adxThreshold": 30, "macdCrossEnabled": true,
        "stochCrossEnabled": false, "stochLimitEnabled": true, "stochKThreshold": 98,
        "rsiEnabled": false, "rsiLow": 5, "rsiHigh": 95, "macdSigDiffEnabled": false, "macdSigDiffThreshold": 0
      },
      "global": { "leverage": 5, "targetRoi": 0.04, "slRoi": 0.15, "reduceTpWaitMin": 0 }
    };

    console.log(`\n📐 [지표 수치 분석 - 12:05 완성봉 기준]`);
    console.log(`--------------------------------------------------`);
    console.log(`[5m 지표 (12:05 봉)]`);
    console.log(`- ADX: ${indicatorsV820.m5.adx[idx5m]?.toFixed(2)} (기준: >= 30)`);
    console.log(`- Stoch K: ${indicatorsV820.m5.stoch.k[idx5m]?.toFixed(2)} (기준 Limit: < 99)`);
    console.log(`- Stoch D: ${indicatorsV820.m5.stoch.d[idx5m]?.toFixed(2)}`);
    console.log(`- Stoch Cross (SHORT): K: ${indicatorsV820.m5.stoch.k[idx5m]?.toFixed(1)} < D: ${indicatorsV820.m5.stoch.d[idx5m]?.toFixed(1)}`);

    console.log(`\n[1h 지표 (12:00 봉)]`);
    console.log(`- MACD Line: ${indicatorsV820.h1.macd.m[r1h]?.toFixed(4)}`);
    console.log(`- MACD Signal: ${indicatorsV820.h1.macd.s[r1h]?.toFixed(4)}`);
    console.log(`- Stoch K: ${indicatorsV820.h1.stoch.k[r1h]?.toFixed(2)}`);
    console.log(`- Stoch D: ${indicatorsV820.h1.stoch.d[r1h]?.toFixed(2)}`);
    console.log(`- Stoch Cross (SHORT): K: ${indicatorsV820.h1.stoch.k[r1h]?.toFixed(1)} < D: ${indicatorsV820.h1.stoch.d[r1h]?.toFixed(1)}`);

    console.log(`\n[1d 지표 (05-31 봉)]`);
    console.log(`- MACD Line: ${indicatorsV820.d1.macd.m[r1d]?.toFixed(4)}`);
    console.log(`- MACD Signal: ${indicatorsV820.d1.macd.s[r1d]?.toFixed(4)}`);
    console.log(`- Stoch K: ${indicatorsV820.d1.stoch.k[r1d]?.toFixed(2)} (기준 Limit: < 98)`);
    console.log(`--------------------------------------------------`);

    // 1. v7.0.3 판정 구동
    const signalV703 = strategyV703.signal_logic(indicatorsV703, { idx5m, r1h, r1d }, mockRules);
    console.log(`\n🎯 [v7.0.3 전략 판정 최종 신호]: ${signalV703.toUpperCase()}`);

    // 2. v8.2.0 판정 구동 및 상세 디버그 로깅
    const originalLog = console.log;
    let logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    const signalV820 = strategyV820.signal_logic(indicatorsV820, { idx5m, r1h, r1d }, mockRules);
    console.log = originalLog;

    console.log(`🎯 [v8.2.0 전략 판정 최종 신호]: ${signalV820.toUpperCase()}`);
    console.log(`\n📋 [v8.2.0] 디버그 추적 로그:\n${logs.join('\n')}`);

  } catch (err) {
    console.error("오류 발생:", err.message);
  }
}

debug();
