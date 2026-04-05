const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = 'c:/dev/2026_candy'; // User already has cache files in root

function toKSTString(timestamp) {
  const d = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

async function fetchKlines(symbol, interval, startTime, endTime, useCache = true) {
  const startYear = new Date(startTime).getFullYear();
  const endYear = new Date(endTime).getFullYear();
  let cachedData = [];
  
  if (useCache) {
      for (let y = startYear; y <= endYear; y++) {
          const cacheFile = path.join(CACHE_DIR, `backtest_cache_${y}.json`);
          if (fs.existsSync(cacheFile)) {
              console.log(`Loading cache for ${y} from ${cacheFile}...`);
              const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
              if (Array.isArray(data)) {
                  cachedData.push(...data.filter(k => k.time >= startTime && k.time <= endTime));
              }
          }
      }
      if (cachedData.length > 0) return cachedData;
  }

  let allKlines = [];
  let currentStart = startTime;
  console.log(`Fetching ${symbol} ${interval} klines from API...`);
  while (allKlines.length < 5000000 && currentStart < endTime) { 
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { 
        params: { symbol, interval, startTime: currentStart, limit: 1500 } 
      });
      if (!res.data || res.data.length === 0) break;
      allKlines.push(...res.data);
      currentStart = res.data[res.data.length - 1][0] + 1;
      if (res.data.length < 1500) break;
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) { break; }
  }
  
  const mapped = allKlines.map(d => ({ 
      time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
  }));

  return mapped;
}

module.exports = {
  toKSTString,
  fetchKlines
};
