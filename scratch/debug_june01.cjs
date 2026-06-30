const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 프로젝트 루트의 indicators 및 strategies 로드
const { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateStochRSI, calculateADX } = require('../lib/indicators.cjs');
const strategyV820 = require('../strategies/Logic.v8.2.0.cjs');

const SYMBOL = 'BTCUSDT';
// 6월 1일 PM 8:55 KST = 2026-06-01 20:55:00+09:00
const TARGET_TIME = new Date('2026-06-01T20:55:00+09:00').getTime();

async function fetchBinanceOHLCV(interval, limit = 1000) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${SYMBOL}&interval=${interval}&limit=${limit}`;
  try {
    const res = await axios.get(url, { timeout: 7000 });
    return res.data.map(d => ({
      time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
    }));
  } catch (e) {
    console.error("Binance Fetch Error:", e.message);
    throw e;
  }
}

async function fetchBybitOHLCV(interval, limit = 1000) {
  const bybitInterval = interval === '1h' ? '60' : (interval === '5m' ? '5' : 'D');
  const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${SYMBOL}&interval=${bybitInterval}&limit=${limit}`;
  try {
    const res = await axios.get(url, { timeout: 7000 });
    return res.data.result.list.map(d => ({
      time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
    })).reverse();
  } catch (e) {
    console.error("Bybit Fetch Error:", e.message);
    throw e;
  }
}

async function runCompare() {
  console.log(`🔍 [COMPARE] 6월 1일 PM 8:15 KST 시점의 거래소별 지표 비교 검증 시작...\n`);
  
  try {
    // 1. Binance 데이터 수집 및 연산
    const [b_m5, b_h1, b_d1] = await Promise.all([
      fetchBinanceOHLCV('5m', 1000),
      fetchBinanceOHLCV('1h', 1000),
      fetchBinanceOHLCV('1d', 500)
    ]);
    
    // 2. Bybit 데이터 수집 및 연산
    const [y_m5, y_h1, y_d1] = await Promise.all([
      fetchBybitOHLCV('5m', 1000),
      fetchBybitOHLCV('1h', 1000),
      fetchBybitOHLCV('1d', 500)
    ]);

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

    const b_targetIdx5m = findIndex(b_m5, TARGET_TIME);
    const b_r1h = findIndex(b_h1, TARGET_TIME);
    const b_r1d = findIndex(b_d1, TARGET_TIME);
    const b_idx5m = b_targetIdx5m - 1; // 완료봉

    const y_targetIdx5m = findIndex(y_m5, TARGET_TIME);
    const y_r1h = findIndex(y_h1, TARGET_TIME);
    const y_r1d = findIndex(y_d1, TARGET_TIME);
    const y_idx5m = y_targetIdx5m - 1; // 완료봉

    // 룰 설정 정의
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
        "adxEnabled": false, "adxThreshold": 15, "macdCrossEnabled": true,
        "stochCrossEnabled": false, "stochLimitEnabled": true, "stochKThreshold": 98,
        "rsiEnabled": false, "rsiLow": 5, "rsiHigh": 95, "macdSigDiffEnabled": false, "macdSigDiffThreshold": 0
      },
      "global": { "leverage": 5, "targetRoi": 0.04, "slRoi": 0.15, "reduceTpWaitMin": 0 }
    };

    // 지표 연산
    const b_ind = strategyV820.indicators_logic({ m5: b_m5, h1: b_h1, d1: b_d1 });
    const y_ind = strategyV820.indicators_logic({ m5: y_m5, h1: y_h1, d1: y_d1 });

    console.log(`========================================================================`);
    console.log(`[5m 캔들 비교 (20:10 KST 완료봉)]`);
    console.log(`- Binance: Close=$${b_m5[b_idx5m].close} | High=$${b_m5[b_idx5m].high} | Low=$${b_m5[b_idx5m].low}`);
    console.log(`- Bybit:   Close=$${y_m5[y_idx5m].close} | High=$${y_m5[y_idx5m].high} | Low=$${y_m5[y_idx5m].low}`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`[5m 지표 수치 비교]`);
    console.log(`- Binance: ADX=${b_ind.m5.adx[b_idx5m].toFixed(3)} | Stoch K=${b_ind.m5.stoch.k[b_idx5m].toFixed(3)} | Stoch D=${b_ind.m5.stoch.d[b_idx5m].toFixed(3)}`);
    console.log(`- Bybit:   ADX=${y_ind.m5.adx[y_idx5m].toFixed(3)} | Stoch K=${y_ind.m5.stoch.k[y_idx5m].toFixed(3)} | Stoch D=${y_ind.m5.stoch.d[y_idx5m].toFixed(3)}`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`[1h 지표 수치 비교 (20:00 KST 완료봉)]`);
    console.log(`- Binance: MACD Diff=${(b_ind.h1.macd.m[b_r1h] - b_ind.h1.macd.s[b_r1h]).toFixed(5)} | Stoch K=${b_ind.h1.stoch.k[b_r1h].toFixed(3)} | Stoch D=${b_ind.h1.stoch.d[b_r1h].toFixed(3)}`);
    console.log(`- Bybit:   MACD Diff=${(y_ind.h1.macd.m[y_r1h] - y_ind.h1.macd.s[y_r1h]).toFixed(5)} | Stoch K=${y_ind.h1.stoch.k[y_r1h].toFixed(3)} | Stoch D=${y_ind.h1.stoch.d[y_r1h].toFixed(3)}`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`[1d 지표 수치 비교 (05-31 봉 완료)]`);
    console.log(`- Binance: MACD Diff=${(b_ind.d1.macd.m[b_r1d] - b_ind.d1.macd.s[b_r1d]).toFixed(5)} | Stoch K=${b_ind.d1.stoch.k[b_r1d].toFixed(3)}`);
    console.log(`- Bybit:   MACD Diff=${(y_ind.d1.macd.m[y_r1d] - y_ind.d1.macd.s[y_r1d]).toFixed(5)} | Stoch K=${y_ind.d1.stoch.k[y_r1d].toFixed(3)}`);
    console.log(`========================================================================`);

    // 최종 판정 실행
    const b_sig = strategyV820.signal_logic(b_ind, { idx5m: b_idx5m, r1h: b_r1h, r1d: b_r1d }, mockRules);
    const y_sig = strategyV820.signal_logic(y_ind, { idx5m: y_idx5m, r1h: y_r1h, r1d: y_r1d }, mockRules);

    console.log(`\n🎯 [Binance 최종 판정 신호]: ${b_sig.toUpperCase()}`);
    console.log(`🎯 [Bybit 최종 판정 신호]:   ${y_sig.toUpperCase()}`);

  } catch (err) {
    console.error("검증 실행 중 에러:", err.stack);
  }
}

runCompare();
