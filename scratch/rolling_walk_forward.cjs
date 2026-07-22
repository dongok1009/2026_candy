// 동일 길이(8주) 학습/검증 창을 굴리는 롤링 Walk-Forward로 과최적화를 기간 편향 없이 판정한다.
const { runBacktest } = require('../lib/engine.cjs');
const path = require('path');
const fs = require('fs');

const STRATEGY_FILE = 'Logic.v8.2.5.cjs'; // 실전 봇과 동일 버전
const SYMBOL = 'BTCUSDT';
const LEVERAGE = 5;
const BALANCE = 1000;

const WEEK = 7 * 24 * 60 * 60 * 1000;
const TRAIN_WEEKS = 8;
const TEST_WEEKS = 8;
const STEP_WEEKS = 8;               // 검증창 비중첩
const DATA_START = '2025-01-01';
const DATA_END = '2026-07-15';      // 끝단 버퍼

// 실전 규칙(신호 필터·비용) 로드
const baseRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_rules.json'), 'utf8'));
const g = baseRules.global || {};

// 축소 그리드(관련 근방). 실행시간 관리 + 과적합 보수적 추정
const targetRois = [0.04, 0.05, 0.06];
const slRois = [0.10, 0.12, 0.14];

function ymd(ms) {
    const d = new Date(ms);
    return d.toISOString().slice(0, 10);
}

async function runWindow(startMs, endMs, targetRoi, slRoi) {
    const p = require.resolve('../strategies/' + STRATEGY_FILE);
    delete require.cache[p];
    const s = require(p);
    const c = s.config;
    c.SYMBOL = SYMBOL;
    c.ACTUAL_START_TIME = startMs;
    c.FETCH_START_TIME = startMs - (180 * 24 * 60 * 60 * 1000);
    c.END_TIME = endMs;
    c.LEVERAGE = LEVERAGE;
    c.INITIAL_BALANCE = BALANCE;
    // 실전과 동일 고정
    c.EXIT_WAIT_MIN = g.exitWaitMin !== undefined ? g.exitWaitMin : c.EXIT_WAIT_MIN;
    c.ENTRY_WAIT_MIN = g.entryWaitMin !== undefined ? g.entryWaitMin : c.ENTRY_WAIT_MIN;
    c.reduceTpWaitMin = g.reduceTpWaitMin !== undefined ? g.reduceTpWaitMin : 0;
    c.reducedTargetRoi = g.reducedTargetRoi !== undefined ? g.reducedTargetRoi : 0.02;
    c.ENTRY_MODE = g.entryMode || 'HYBRID_5M';
    c.PENETRATION_RATE = g.penetrationRate !== undefined ? g.penetrationRate : 0;
    c.EXIT_SLIPPAGE_RATE = 0.0005; // 신규 반영된 실전 근사 비용
    c.useTrailingStop = g.useTrailingStop === true;
    c.trailStopPct = g.trailStopPct !== undefined ? g.trailStopPct : 0.01;
    c.TARGET_NET_ROI = targetRoi;
    c.SL_ROI = slRoi;
    c.overrideRules = baseRules;

    const res = await runBacktest(s);
    const trades = res.trades ? res.trades.length : 0;
    const factor = 1 + parseFloat(res.roi) / 100;
    const weeks = (endMs - startMs) / WEEK;
    // 주당 기하수익률(정규화). 파산(factor<=0)은 -100%로 클램프
    const weekly = factor > 0 ? (Math.pow(factor, 1 / weeks) - 1) * 100 : -100;
    return { roi: parseFloat(res.roi), weekly, mdd: parseFloat(res.mdd), wins: res.wins, losses: res.losses, trades };
}

async function optimize(startMs, endMs) {
    let best = null;
    for (const tr of targetRois) {
        for (const sl of slRois) {
            const r = await runWindow(startMs, endMs, tr, sl);
            if (!best || r.roi > best.r.roi) best = { tr, sl, r };
        }
    }
    return best;
}

async function main() {
    const dataStartMs = new Date(`${DATA_START}T00:00:00+09:00`).getTime();
    const dataEndMs = new Date(`${DATA_END}T23:59:59+09:00`).getTime();
    const liveTr = g.targetRoi !== undefined ? g.targetRoi : 0.05;
    const liveSl = g.slRoi !== undefined ? g.slRoi : 0.14;

    console.log(`\n============ 롤링 Walk-Forward (${STRATEGY_FILE}) ============`);
    console.log(`창: 학습 ${TRAIN_WEEKS}주 → 검증 ${TEST_WEEKS}주 (동일 길이) | 슬리피지 0.05% 반영`);
    console.log(`기준선(고정): ${liveTr}/${liveSl} | 모든 수치는 주당 기하수익률로 정규화\n`);
    console.log(`Fold |   학습창        →   검증창       | 최적 | IS주당 | OOS주당 | 고정OOS주당 | OOS건수`);
    console.log(`-----|-----------------------------------|------|--------|---------|-------------|--------`);

    const folds = [];
    let t = dataStartMs;
    let k = 0;
    while (t + (TRAIN_WEEKS + TEST_WEEKS) * WEEK <= dataEndMs) {
        const trainStart = t;
        const trainEnd = t + TRAIN_WEEKS * WEEK;
        const testStart = trainEnd;
        const testEnd = trainEnd + TEST_WEEKS * WEEK;
        k++;

        const best = await optimize(trainStart, trainEnd);
        const oosOpt = await runWindow(testStart, testEnd, best.tr, best.sl);
        const oosFixed = await runWindow(testStart, testEnd, liveTr, liveSl);

        folds.push({ k, best, oosOpt, oosFixed });
        console.log(
            `  ${String(k).padStart(2)} | ${ymd(trainStart)}~${ymd(trainEnd)} → ${ymd(testStart)}~${ymd(testEnd)} |` +
            ` ${best.tr}/${best.sl} | ${best.r.weekly.toFixed(2).padStart(6)}% | ${oosOpt.weekly.toFixed(2).padStart(6)}% |` +
            ` ${oosFixed.weekly.toFixed(2).padStart(9)}% | ${oosOpt.trades}건`
        );

        t += STEP_WEEKS * WEEK;
    }

    // 집계
    const n = folds.length;
    const mean = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    const meanIS = mean(folds.map(f => f.best.r.weekly));
    const meanOOSopt = mean(folds.map(f => f.oosOpt.weekly));
    const meanOOSfixed = mean(folds.map(f => f.oosFixed.weekly));
    const degraded = folds.filter(f => f.oosOpt.weekly < f.best.r.weekly).length;   // 최적이 OOS에서 하락
    const optWorseThanFixed = folds.filter(f => f.oosOpt.weekly < f.oosFixed.weekly).length; // 최적 < 고정

    console.log(`\n============ 집계 (${n} folds) ============`);
    console.log(`평균 IS 주당(최적 파라미터):      ${meanIS.toFixed(2)}%`);
    console.log(`평균 OOS 주당(같은 최적 파라미터): ${meanOOSopt.toFixed(2)}%   ← 실전 기대치`);
    console.log(`평균 OOS 주당(고정 ${liveTr}/${liveSl}):   ${meanOOSfixed.toFixed(2)}%`);
    console.log(`\n· 최적→OOS 하락 fold: ${degraded}/${n}  (많을수록 과최적화)`);
    console.log(`· 매fold 최적이 고정보다 못한 fold: ${optWorseThanFixed}/${n}  (많으면 최적화가 무의미)`);
    console.log(`\n판정 기준.`);
    console.log(`- IS주당 ≫ OOS주당 이 반복 → 과최적화(파라미터 일반화 실패).`);
    console.log(`- OOS(최적) ≤ OOS(고정) → 매fold 최적화가 고정 파라미터만도 못함.`);
    console.log(`- 정규화·다중 fold이므로 '기간 짧음/운' 반론은 성립하지 않음.`);
}

main().catch(e => { console.error('오류:', e); process.exit(1); });
