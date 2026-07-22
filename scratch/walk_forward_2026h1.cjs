// 2026 상반기로 파라미터를 최적화하고, 못 본 하반기(실전 구간)에 그대로 적용해 과최적화 격차를 측정한다.
const { runBacktest } = require('../lib/engine.cjs');
const path = require('path');
const fs = require('fs');

// 실전 봇과 동일한 전략 버전(.env STRATEGY_VERSION=Logic.v8.2.5.cjs)
const STRATEGY_FILE = 'Logic.v8.2.5.cjs';
const SYMBOL = 'BTCUSDT';
const LEVERAGE = 5;
const BALANCE = 1000;

// 학습(In-Sample)과 검증(Out-of-Sample) 구간. 오늘(2026-07-22) 기준 하반기가 곧 실전 구간이다.
const IS  = { start: '2026-01-01', end: '2026-06-30', label: '2026 상반기 (학습/IS)' };
const OOS = { start: '2026-07-01', end: '2026-07-22', label: '2026 하반기 (검증/OOS·실전구간)' };

// 실전 규칙 전체를 로드(whatIfFilters·maSlopeAlign 등 신호 필터를 실전과 동일하게 유지)
const baseRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_rules.json'), 'utf8'));
const g = baseRules.global || {};

// 탐색 그리드 (기존 grid_search_optimization.cjs와 동일 범위)
const targetRois = [0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
const slRois = [0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16];

async function runOne(period, targetRoi, slRoi) {
    const p = require.resolve('../strategies/' + STRATEGY_FILE);
    delete require.cache[p];
    const s = require(p);
    const c = s.config;

    c.SYMBOL = SYMBOL;
    c.ACTUAL_START_TIME = new Date(`${period.start}T00:00:00+09:00`).getTime();
    c.FETCH_START_TIME = c.ACTUAL_START_TIME - (180 * 24 * 60 * 60 * 1000); // 지표 숙성용 180일 워밍업
    c.END_TIME = new Date(`${period.end}T23:59:59+09:00`).getTime();
    c.LEVERAGE = LEVERAGE;
    c.INITIAL_BALANCE = BALANCE;

    // 실전 파라미터와 동일하게 맞춤 (targetRoi·slRoi만 최적화 대상으로 분리)
    c.EXIT_WAIT_MIN = g.exitWaitMin !== undefined ? g.exitWaitMin : c.EXIT_WAIT_MIN;
    c.ENTRY_WAIT_MIN = g.entryWaitMin !== undefined ? g.entryWaitMin : c.ENTRY_WAIT_MIN;
    c.reduceTpWaitMin = g.reduceTpWaitMin !== undefined ? g.reduceTpWaitMin : 0;
    c.reducedTargetRoi = g.reducedTargetRoi !== undefined ? g.reducedTargetRoi : 0.02;
    c.ENTRY_MODE = g.entryMode || 'HYBRID_5M';
    c.PENETRATION_RATE = g.penetrationRate !== undefined ? g.penetrationRate : 0;
    c.useTrailingStop = g.useTrailingStop === true;
    c.trailStopPct = g.trailStopPct !== undefined ? g.trailStopPct : 0.01;

    c.TARGET_NET_ROI = targetRoi;
    c.SL_ROI = slRoi;
    c.overrideRules = baseRules;

    const res = await runBacktest(s);
    const trades = res.trades ? res.trades.length : 0;
    const winRate = trades > 0 ? (res.wins / trades * 100) : 0;
    return { roi: parseFloat(res.roi), mdd: parseFloat(res.mdd), wins: res.wins, losses: res.losses, trades, winRate };
}

function fmt(r) {
    return `ROI ${r.roi.toFixed(2)}% | MDD ${r.mdd.toFixed(2)}% | ${r.wins}승 ${r.losses}패 (${r.trades}건, 승률 ${r.winRate.toFixed(1)}%)`;
}

async function main() {
    console.log(`\n================ Walk-Forward 검증 ================`);
    console.log(`전략 ${STRATEGY_FILE} | ${SYMBOL} | 레버리지 ${LEVERAGE}배 | 초기자본 ${BALANCE}`);
    console.log(`학습: ${IS.start} ~ ${IS.end}  /  검증: ${OOS.start} ~ ${OOS.end}\n`);

    // [1] 상반기(IS)에서 최적 파라미터 탐색
    console.log(`[1] ${IS.label} 최적화 — targetRoi×slRoi ${targetRois.length * slRois.length}조합 탐색 중...`);
    let best = null;
    for (const tr of targetRois) {
        for (const sl of slRois) {
            const r = await runOne(IS, tr, sl);
            if (!best || r.roi > best.r.roi) best = { tr, sl, r };
        }
    }
    console.log(`  ▶ IS 최적 파라미터: targetRoi=${best.tr}, slRoi=${best.sl}`);
    console.log(`     ${fmt(best.r)}\n`);

    // [2] IS 최적 파라미터를 '고정'하여 못 본 하반기(OOS)에 적용
    console.log(`[2] 위 파라미터(${best.tr}/${best.sl})를 고정 → ${OOS.label}에 그대로 적용`);
    const oos = await runOne(OOS, best.tr, best.sl);
    console.log(`     ${fmt(oos)}\n`);

    // [3] 현재 실전 파라미터 기준선
    const liveTr = g.targetRoi !== undefined ? g.targetRoi : 0.05;
    const liveSl = g.slRoi !== undefined ? g.slRoi : 0.14;
    console.log(`[3] 현재 실전 파라미터(${liveTr}/${liveSl}) 기준선`);
    const liveIS = await runOne(IS, liveTr, liveSl);
    const liveOOS = await runOne(OOS, liveTr, liveSl);
    console.log(`   - 상반기(IS):  ${fmt(liveIS)}`);
    console.log(`   - 하반기(OOS): ${fmt(liveOOS)}\n`);

    // [4] 요약
    console.log(`================ 요약 ================`);
    console.log(`IS 최적 파라미터: 상반기 ${best.r.roi.toFixed(2)}%  →  하반기 ${oos.roi.toFixed(2)}%  (격차 ${(best.r.roi - oos.roi).toFixed(2)}%p)`);
    console.log(`실전 파라미터:    상반기 ${liveIS.roi.toFixed(2)}%  →  하반기 ${liveOOS.roi.toFixed(2)}%  (격차 ${(liveIS.roi - liveOOS.roi).toFixed(2)}%p)`);
    console.log(`\n· 하반기(OOS)가 여러분이 실전에서 기대할 수 있는 현실적 수치입니다.`);
    console.log(`· 상반기 대비 하반기 성적이 크게 낮으면 과최적화가 확정됩니다.`);
    console.log(`· 단, 하반기는 약 3주로 표본이 작아 거래 건수를 함께 보고 판단하십시오.`);
}

main().catch(e => { console.error('오류:', e); process.exit(1); });
