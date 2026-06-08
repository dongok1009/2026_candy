const { runBacktest } = require('./lib/engine.cjs');
const path = require('path');
const fs = require('fs');

// Basic argument parser
const args = process.argv.slice(2);
const params = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        let [key, value] = arg.split('=');
        if (value && (value.startsWith('"') || value.startsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        params[key.replace('--', '')] = value;
    } else if (!params.version) {
        params.version = arg; // Positional version support
    }
});

const version = params.version;

if (!version) {
    console.error("Usage: node run_backtest.cjs <version> --symbol=... --start=... --end=... --leverage=... --balance=...");
    console.error("Example: node run_backtest.cjs v7_0_0 --symbol=BTCUSDT --start=2025-01-01 --end=2025-03-01");
    process.exit(1);
}

try {
    let strategyPath = path.join(__dirname, 'strategies', `${version}.cjs`);
    
    // [New] 만약 파일이 없으면 Logic. 접미사를 붙여서 재시도 (구 버전 호환성)
    if (!fs.existsSync(strategyPath)) {
        let normalized = version;
        if (!version.startsWith('Logic.')) {
            normalized = `Logic.${version.replace(/_/g, '.')}`;
        }
        const altPath = path.join(__dirname, 'strategies', `${normalized}.cjs`);
        if (fs.existsSync(altPath)) {
            strategyPath = altPath;
        }
    }

    const strategy = require(strategyPath);

    // Override config if params provided
    if (params.symbol) strategy.config.SYMBOL = params.symbol;
    if (params.start) {
        strategy.config.ACTUAL_START_TIME = new Date(`${params.start}T00:00:00+09:00`).getTime();
        // [MAX WARMUP] 180일 전부터 데이터 수집 (1D/1H 지표 완벽 숙성)
        strategy.config.FETCH_START_TIME = strategy.config.ACTUAL_START_TIME - (180 * 24 * 60 * 60 * 1000); 
    }
    if (params.end) strategy.config.END_TIME = new Date(`${params.end}T23:59:59+09:00`).getTime();
    if (params.leverage) strategy.config.LEVERAGE = parseFloat(params.leverage);
    if (params.balance) strategy.config.INITIAL_BALANCE = parseFloat(params.balance);
    if (params.exitWaitMin) strategy.config.EXIT_WAIT_MIN = parseInt(params.exitWaitMin);
    if (params.entryWaitMin) strategy.config.ENTRY_WAIT_MIN = parseInt(params.entryWaitMin);
    if (params.targetRoi) strategy.config.TARGET_NET_ROI = parseFloat(params.targetRoi);
    if (params.slRoi) strategy.config.SL_ROI = parseFloat(params.slRoi);
    if (params.reduceTpWaitMin) strategy.config.reduceTpWaitMin = parseInt(params.reduceTpWaitMin);
    if (params.reducedTargetRoi) strategy.config.reducedTargetRoi = parseFloat(params.reducedTargetRoi);
    if (params.entryMode) strategy.config.ENTRY_MODE = params.entryMode;
    if (params.penetrationRate) strategy.config.PENETRATION_RATE = parseFloat(params.penetrationRate);

    // [New] UI에서 전달된 Override Rules 적용 (임시 파일 방식)
    if (params.rulesFile && fs.existsSync(params.rulesFile)) {
        try {
            const overrides = JSON.parse(fs.readFileSync(params.rulesFile, 'utf8'));
            // [FIX] 엔진이 읽을 수 있도록 strategy.config.overrideRules에 직접 주입
            // v7.0.1 이후 버전은 이 위치의 데이터를 가장 우선적으로 참조합니다.
            strategy.config.overrideRules = overrides;
            console.log(`✅ [INFO] Strategy Rules Overridden & Injected to Engine!`);
        } catch (rErr) {
            console.error(`❌ [ERROR] Failed to load override rules file:`, rErr.message);
        }
    }

    console.log(`\n🚀 [VERSION ${version}] Backtest Start!`);
    console.log(`Config: ${strategy.config.SYMBOL} | ${params.start || 'Default Start'} ~ ${params.end || 'Default End'} | Lev: ${strategy.config.LEVERAGE}x`);
    
    runBacktest(strategy).then(res => {
        // AI가 파싱하기 편하도록 JSON 한 줄을 마지막에 출력
        console.log(`\n###JSON_RESULT###${JSON.stringify({
            success: true,
            wins: res.wins,
            losses: res.losses,
            roi: res.roi,
            finalBalance: res.finalBalance,
            mdd: res.mdd,
            trades: res.trades,
            resultFilePath: res.detailFile,
            validationFile: res.validationFile
        })}###JSON_RESULT###`);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
    
} catch (error) {
    console.error(`Error: Could not load or run strategy version '${version}'`);
    console.error(error.stack || error.message);
    process.exit(1);
}
