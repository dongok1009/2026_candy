
const fetch = require('node-fetch');

async function testBacktest() {
    const config = {
        symbol: 'BTCUSDT',
        startDate: '2026-01-01T00:00',
        endDate: '2026-03-01T00:00',
        leverage: 5,
        initialBalance: 1000,
        version: 'Logic.v7.0.2',
        entryWaitMin: 180,
        exitWaitMin: 2000
    };
    const rules = {}; // placeholder

    try {
        console.log("Sending backtest request...");
        const response = await fetch('http://localhost:3001/api/backtest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...config, overrideRules: rules })
        });
        const result = await response.json();
        console.log("Result:", JSON.stringify(result, null, 2).substring(0, 500) + "...");
    } catch (error) {
        console.error("Fetch Error:", error.message);
    }
}

testBacktest();
