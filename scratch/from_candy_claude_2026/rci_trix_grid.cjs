// RCI/TRIX 필터 조합 백테스트 그리드 러너 (탐색용 임시 스크립트)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live_rules.json'), 'utf8'));
const STRATEGY = 'CC.v0.2.0';

// 변형 정의: [이름, 적용함수]
const VARIANTS = [
    ['BASE (필터 없음)', () => {}],
    ['RCI @5m', r => { ['long', 'short'].forEach(s => { r[s]['5m'].useRciCross = true; }); }],
    ['RCI @1h', r => { ['long', 'short'].forEach(s => { r[s]['1h'].useRciCross = true; }); }],
    ['RCI @1d', r => { ['long', 'short'].forEach(s => { r[s]['1d'].useRciCross = true; }); }],
    ['TRIX @5m sig9', r => { ['long', 'short'].forEach(s => { r[s]['5m'].useTrixCross = true; r[s]['5m'].trixSignalPeriod = 9; }); }],
    ['TRIX @1h sig9', r => { ['long', 'short'].forEach(s => { r[s]['1h'].useTrixCross = true; r[s]['1h'].trixSignalPeriod = 9; }); }],
    ['TRIX @1d sig9', r => { ['long', 'short'].forEach(s => { r[s]['1d'].useTrixCross = true; r[s]['1d'].trixSignalPeriod = 9; }); }],
    ['TRIX @1h sig5', r => { ['long', 'short'].forEach(s => { r[s]['1h'].useTrixCross = true; r[s]['1h'].trixSignalPeriod = 5; }); }],
    ['TRIX @1h sig14', r => { ['long', 'short'].forEach(s => { r[s]['1h'].useTrixCross = true; r[s]['1h'].trixSignalPeriod = 14; }); }],
    ['RCI @1h + TRIX @1h sig9', r => { ['long', 'short'].forEach(s => { r[s]['1h'].useRciCross = true; r[s]['1h'].useTrixCross = true; r[s]['1h'].trixSignalPeriod = 9; }); }],
    ['RCI @5m + TRIX @1h sig9', r => { ['long', 'short'].forEach(s => { r[s]['5m'].useRciCross = true; r[s]['1h'].useTrixCross = true; r[s]['1h'].trixSignalPeriod = 9; }); }],
];

const start = process.argv[2];
const end = process.argv[3];
if (!start || !end) {
    console.error('사용법: node rci_trix_grid.cjs <start:YYYY-MM-DD> <end:YYYY-MM-DD>');
    process.exit(1);
}

const results = [];
for (const [name, apply] of VARIANTS) {
    const rules = JSON.parse(JSON.stringify(BASE_RULES));
    apply(rules);
    const tmp = path.join(__dirname, `grid_rules_tmp.json`);
    fs.writeFileSync(tmp, JSON.stringify(rules));

    process.stderr.write(`▶ ${name} 실행 중...\n`);
    let out = '';
    try {
        out = execFileSync('node', [path.join(__dirname, '..', 'run_backtest.cjs'), STRATEGY,
            `--start=${start}`, `--end=${end}`, `--rulesFile=${tmp}`],
            { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200, cwd: path.join(__dirname, '..') });
    } catch (e) {
        process.stderr.write(`  ✗ 실패: ${e.message}\n`);
        results.push({ name, error: true });
        continue;
    }
    const parts = out.split('###JSON_RESULT###');
    if (parts.length < 2) { results.push({ name, error: true }); continue; }
    const r = JSON.parse(parts[1].trim());
    const total = r.wins + r.losses;
    results.push({
        name,
        roi: parseFloat(r.roi),
        wins: r.wins,
        losses: r.losses,
        trades: total,
        winRate: total ? (r.wins / total * 100) : 0,
        mdd: parseFloat(r.mdd)
    });
}

console.log(`\n=== RCI/TRIX 필터 그리드 결과 (${STRATEGY}, ${start} ~ ${end}) ===`);
console.log('조합'.padEnd(26) + 'ROI'.padStart(10) + '승률'.padStart(9) + '거래'.padStart(7) + 'MDD'.padStart(9));
console.log('-'.repeat(62));
for (const r of results) {
    if (r.error) { console.log(r.name.padEnd(26) + '  (실행 실패)'); continue; }
    console.log(
        r.name.padEnd(26) +
        (r.roi.toFixed(2) + '%').padStart(10) +
        (r.winRate.toFixed(1) + '%').padStart(9) +
        String(r.trades).padStart(7) +
        (r.mdd.toFixed(2) + '%').padStart(9)
    );
}
fs.writeFileSync(path.join(__dirname, `grid_result_${start}_${end}.json`), JSON.stringify(results, null, 2));
