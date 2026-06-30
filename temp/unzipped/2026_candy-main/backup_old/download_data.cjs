const axios = require('axios');
const fs = require('fs');

async function fetchKlines(symbol, interval, startTime, endTime) {
  let all = []; let cur = startTime;
  console.log(`Downloading ${interval} for ${symbol}...`);
  while(cur < endTime){
    try{
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params:{symbol,interval,startTime:cur,limit:1500}});
      if(!res.data||res.data.length===0)break;
      all.push(...res.data); cur = res.data[res.data.length-1][0]+1;
      process.stdout.write(`.`);
      await new Promise(r=>setTimeout(r,350));
    }catch(e){
      console.log('\nRate limit or error, waiting 5s...');
      await new Promise(r=>setTimeout(r,5000));
    }
  }
  console.log(`\n${interval} Downloaded: ${all.length} bars.`);
  return all.filter(d=>d[0]<=endTime).map(d=>({time:d[0],open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4])}));
}

async function downloadYear(year) {
  const TARGET_START = new Date(`${year}-01-01T00:00:00+09:00`).getTime();
  const TARGET_END = new Date(`${year}-12-31T23:59:59+09:00`).getTime();
  const FETCH_START = TARGET_START - (86400000 * 180); // 6개월 웜업

  console.log(`\n=== YEARLY HARVEST: ${year} ===`);
  console.log(`Target: ${year}-01-01 ~ ${year}-12-31 (+ 6 Month Warmup)`);

  const data = {
    k1m: await fetchKlines('BTCUSDT','1m',TARGET_START,TARGET_END),
    k5m: await fetchKlines('BTCUSDT','5m',FETCH_START,TARGET_END),
    k1h: await fetchKlines('BTCUSDT','1h',FETCH_START,TARGET_END),
    k1d: await fetchKlines('BTCUSDT','1d',FETCH_START,TARGET_END),
    year: year
  };

  const fileName = `backtest_cache_${year}.json`;
  fs.writeFileSync(fileName, JSON.stringify(data));
  console.log(`✅ ${year} Data saved to ${fileName}\n`);
}

const targetYear = parseInt(process.argv[2]);
if(!targetYear) {
  console.log('Please specify year (e.g., node download_data.cjs 2024)');
} else {
  downloadYear(targetYear);
}
