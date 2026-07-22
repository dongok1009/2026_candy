// 슬리피지 OFF/ON 대조로 엔진 반영을 검증한다.
const { runBacktest } = require('../lib/engine.cjs');
const path = require('path');
const fs = require('fs');

const baseRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_rules.json'), 'utf8'));

async function run(slippage, period) {
    const p = require.resolve('../strategies/Logic.v8.2.5.cjs');
    delete require.cache[p];
    const s = require(p);
    const c = s.config;
    c.SYMBOL = 'BTCUSDT';
    c.ACTUAL_START_TIME = new Date(`${period.start}T00:00:00+09:00`).getTime();
    c.FETCH_START_TIME = c.ACTUAL_START_TIME - (180 * 24 * 60 * 60 * 1000);
    c.END_TIME = new Date(`${period.end}T23:59:59+09:00`).getTime();
    c.LEVERAGE = 5;
    c.INITIAL_BALANCE = 1000;
    c.TARGET_NET_ROI = 0.05;
    c.SL_ROI = 0.14;
    c.EXIT_SLIPPAGE_RATE = slippage; // 명시적으로 덮어써서 OFF/ON 대조
    c.overrideRules = baseRules;
    const res = await runBacktest(s);
    const t = res.trades ? res.trades.length : 0;
    return { roi: parseFloat(res.roi), mdd: parseFloat(res.mdd), wins: res.wins, losses: res.losses, trades: t };
}

(async () => {
    const IS = { start: '2026-01-01', end: '2026-06-30' };
    const OOS = { start: '2026-07-01', end: '2026-07-22' };
    for (const [label, period] of [['상반기', IS], ['하반기(실전구간)', OOS]]) {
        const off = await run(0, period);
        const on05 = await run(0.0005, period);
        const on10 = await run(0.001, period);
        console.log(`\n=== ${label} (${period.start}~${period.end}) ===`);
        console.log(`슬리피지 0.00% : ROI ${off.roi.toFixed(2)}% | MDD ${off.mdd.toFixed(2)}% | ${off.wins}승 ${off.losses}패 (${off.trades}건)`);
        console.log(`슬리피지 0.05% : ROI ${on05.roi.toFixed(2)}% | MDD ${on05.mdd.toFixed(2)}% | ${on05.wins}승 ${on05.losses}패 (${on05.trades}건)`);
        console.log(`슬리피지 0.10% : ROI ${on10.roi.toFixed(2)}% | MDD ${on10.mdd.toFixed(2)}% | ${on10.wins}승 ${on10.losses}패 (${on10.trades}건)`);
    }
})().catch(e => { console.error(e); process.exit(1); });
