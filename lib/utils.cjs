const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = 'c:/dev/2026_candy'; // User already has cache files in root

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

// API로부터 특정 구간의 Klines를 전송받는 내부 헬퍼 함수
async function fetchRangeFromAPI(symbol, interval, start, end) {
  let allKlines = [];
  let currentStart = start;
  console.log(`📡 [API FETCH] Fetching missing range: ${toKSTString(start)} ~ ${toKSTString(end)}`);
  
  while (allKlines.length < 10000000 && currentStart < end) { 
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { 
        params: { symbol, interval, startTime: currentStart, limit: 1500 },
        timeout: 15000 
      });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { 
      console.error(`❌ [API ERROR] Failed to fetch missing range:`, e.message);
      break; 
    }
  }
  
  return allKlines.map(d => ({ 
      time: d[0], 
      open: parseFloat(d[1]), 
      high: parseFloat(d[2]), 
      low: parseFloat(d[3]), 
      close: parseFloat(d[4]), 
      volume: parseFloat(d[5])
  }));
}

async function fetchKlines(symbol, interval, startTime, endTime, useCache = true) {
  const startYear = new Date(startTime).getFullYear();
  const endYear = new Date(endTime).getFullYear();
  let finalKlines = [];
  
  for (let y = startYear; y <= endYear; y++) {
      const cacheFile = path.join(CACHE_DIR, `backtest_cache_${symbol.toUpperCase()}_${y}.json`);
      
      // 해당 연도 y 내에서의 타겟 구간 clamping
      const yearStart = new Date(`${y}-01-01T00:00:00+09:00`).getTime();
      const yearEnd = new Date(`${y}-12-31T23:59:59+09:00`).getTime();
      const reqStart = Math.max(startTime, yearStart);
      const reqEnd = Math.min(endTime, yearEnd);
      
      if (reqStart > reqEnd) continue; // 해당 연도는 요청 기간에 포함되지 않음

      let yearData = [];
      let cacheLoaded = false;

      if (useCache && fs.existsSync(cacheFile)) {
          try {
              console.log(`📂 [CACHE LOAD] Loading cache for ${y} from ${cacheFile}...`);
              const fileContent = fs.readFileSync(cacheFile, 'utf8');
              const parsed = JSON.parse(fileContent);
              if (Array.isArray(parsed)) {
                  yearData = parsed;
                  cacheLoaded = true;
                  console.log(`📂 [CACHE LOAD] Successfully loaded ${yearData.length} klines for ${y}`);
              }
          } catch (err) {
              console.error(`⚠️ [CACHE WARN] Failed to parse cache file for ${y}:`, err.message);
          }
      }

      // 증분 수집 및 결합 판정
      if (!cacheLoaded || yearData.length === 0) {
          // 케이스 A: 캐시가 아예 없음 -> 해당 연도 요청 구간 통째로 API 조회
          console.log(`📡 [CACHE MISS] No cache found for ${y}. Fetching full requested range...`);
          yearData = await fetchRangeFromAPI(symbol, interval, reqStart, reqEnd);
          
          if (yearData.length > 0) {
              fs.writeFileSync(cacheFile, JSON.stringify(yearData, null, 2));
              console.log(`💾 [CACHE SAVE] Created new cache for ${y} with ${yearData.length} klines.`);
          }
      } else {
          // 케이스 B: 캐시가 있음 -> 누락된 과거/최신 데이터 증분 수집
          const minCached = yearData[0].time;
          const maxCached = yearData[yearData.length - 1].time;
          let updated = false;

          // 1. 과거 누락 구간 추가 수집 (reqStart < minCached)
          if (reqStart < minCached) {
              const gapEnd = minCached - 60000; // 1분 전까지
              console.log(`📡 [INCREMENTAL FETCH] Past gap detected for ${y}: reqStart(${toKSTString(reqStart)}) < cachedMin(${toKSTString(minCached)})`);
              const pastGapData = await fetchRangeFromAPI(symbol, interval, reqStart, gapEnd);
              if (pastGapData.length > 0) {
                  yearData = yearData.concat(pastGapData);
                  updated = true;
                  console.log(`➕ [MERGE] Added ${pastGapData.length} past klines to year ${y}`);
              }
          }

          // 2. 미래(최신) 누락 구간 추가 수집 (reqEnd > maxCached)
          if (reqEnd > maxCached) {
              const gapStart = maxCached + 60000; // 1분 후부터
              console.log(`📡 [INCREMENTAL FETCH] Future gap detected for ${y}: reqEnd(${toKSTString(reqEnd)}) > cachedMax(${toKSTString(maxCached)})`);
              const futureGapData = await fetchRangeFromAPI(symbol, interval, gapStart, reqEnd);
              if (futureGapData.length > 0) {
                  yearData = yearData.concat(futureGapData);
                  updated = true;
                  console.log(`➕ [MERGE] Added ${futureGapData.length} future klines to year ${y}`);
              }
          }

          // 중복 제거 및 시간 정렬 후 디스크 저장
          if (updated) {
              const mergedMap = new Map();
              yearData.forEach(k => mergedMap.set(k.time, k));
              yearData = Array.from(mergedMap.values()).sort((a, b) => a.time - b.time);
              
              // 임시 파일에 먼저 쓴 뒤 rename으로 교체한다. 쓰기가 중간에 실패해도
              // 기존 캐시가 손상되지 않는다. (Windows에서 이 파일 쓰기가 간헐적으로
              // UNKNOWN 오류를 내는 사례가 있어 원자성이 필요하다 — 원인은 미규명)
              // 캐시 저장은 성능 최적화일 뿐이므로 실패해도 백테스트를 중단시키지 않는다.
              const tmpFile = `${cacheFile}.tmp`;
              try {
                  fs.writeFileSync(tmpFile, JSON.stringify(yearData, null, 2));
                  fs.renameSync(tmpFile, cacheFile);
                  console.log(`💾 [CACHE UPDATE] Saved merged cache for ${y} containing ${yearData.length} klines.`);
              } catch (err) {
                  try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* 정리 실패는 무시 */ }
                  console.warn(`⚠️ [CACHE UPDATE] Failed to save cache for ${y} (${err.code}): ${err.message}`);
                  console.warn(`⚠️ [CACHE UPDATE] 기존 캐시는 그대로 유지됩니다. 이번 실행은 메모리 데이터로 계속 진행합니다.`);
              }
          }
      }

      // 최종적으로 이 연도 데이터 중 요청된 범위 [reqStart, reqEnd]만 필터링하여 결합
      const filtered = yearData.filter(k => k.time >= reqStart && k.time <= reqEnd);
      finalKlines = finalKlines.concat(filtered);
  }

  return finalKlines;
}

module.exports = {
  toKSTString,
  fetchKlines
};
