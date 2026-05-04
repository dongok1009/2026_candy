const strategy = require('./strategies/Logic.v7.0.3.cjs');
const axios = require('axios');
const fs = require('fs');

async function fetchOHLCV(interval) {
    const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&limit=500`);
    return res.data.map(d => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
    }));
}

async function test() {
    const m5 = await fetchOHLCV('5m');
    const h1 = await fetchOHLCV('1h');
    const d1 = await fetchOHLCV('1d');
    
    const indicators = strategy.indicators_logic({ m5, h1, d1 });
    const idx5m = m5.length - 2;
    const r1h = h1.length - 2;
    const r1d = d1.length - 2;

    const liveRules = JSON.parse(fs.readFileSync('live_rules.json', 'utf8'));
    
    console.log("=== 1H DATA ===");
    console.log(`MACD: ${indicators.h1.macd.m[r1h].toFixed(2)} | Signal: ${indicators.h1.macd.s[r1h].toFixed(2)}`);
    console.log(`Stoch K: ${indicators.h1.stoch.k[r1h].toFixed(2)} | D: ${indicators.h1.stoch.d[r1h].toFixed(2)}`);
    console.log("=== 1D DATA ===");
    console.log(`MACD: ${indicators.d1.macd.m[r1d].toFixed(2)} | Signal: ${indicators.d1.macd.s[r1d].toFixed(2)}`);
    
    const sig = strategy.signal_logic(indicators, {idx5m, r1h, r1d}, liveRules);
    console.log("Global Signal:", sig);
}
test();
