const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    }
});

// ==================== [사용자 설정 영역: 탐색 범위 정의] ====================
// 각 지표의 활성화 여부(true/false)와 임계값을 배열 형태로 넣으시면 조합을 에이전트가 자동 검증합니다.
let SEARCH_SPACE = {
    long: {
        m5_useADX: [true],
        m5_adxLow: [30],
        m5_adxHigh: [99],
        m5_useMacdBeyondSig: [false],
        m5_useStochCross: [true],
        m5_useStochKLimit: [true], 
        m5_stochKLow: [0],
        m5_stochKHigh: [75, 80],
        m5_useRSI: [false],
        m5_rsiLow: [5],
        m5_rsiHigh: [95],
        m5_useMacdVal: [false],
        m5_macdVal: [0],

        h1_useADX: [false],
        h1_adxLow: [30],
        h1_adxHigh: [99],
        h1_useMacdBeyondSig: [true],
        h1_useStochCross: [true],
        h1_useStochKLimit: [false], 
        h1_stochKLow: [0],
        h1_stochKHigh: [80],
        h1_useRSI: [false],
        h1_rsiLow: [5],
        h1_rsiHigh: [95],
        h1_useMacdVal: [false],
        h1_macdVal: [0],

        d1_useADX: [false],
        d1_adxLow: [15],
        d1_adxHigh: [99],
        d1_useMacdBeyondSig: [true],
        d1_useStochCross: [false],
        d1_useStochKLimit: [false, true],
        d1_stochKLow: [0],
        d1_stochKHigh: [80],
        d1_useRSI: [false],
        d1_rsiLow: [5],
        d1_rsiHigh: [95],
        d1_useMacdVal: [false],
        d1_macdVal: [0]
    },
    short: {
        m5_useADX: [true],
        m5_adxLow: [30],
        m5_adxHigh: [99],
        m5_useMacdBeyondSig: [false],
        m5_useStochCross: [true],
        m5_useStochKLimit: [true], 
        m5_stochKLow: [0],
        m5_stochKHigh: [75, 80],
        m5_useRSI: [false],
        m5_rsiLow: [5],
        m5_rsiHigh: [95],
        m5_useMacdVal: [false],
        m5_macdVal: [0],

        h1_useADX: [false],
        h1_adxLow: [30],
        h1_adxHigh: [99],
        h1_useMacdBeyondSig: [true],
        h1_useStochCross: [true],
        h1_useStochKLimit: [false], 
        h1_stochKLow: [0],
        h1_stochKHigh: [80],
        h1_useRSI: [false],
        h1_rsiLow: [5],
        h1_rsiHigh: [95],
        h1_useMacdVal: [false],
        h1_macdVal: [0],

        d1_useADX: [false],
        d1_adxLow: [15],
        d1_adxHigh: [99],
        d1_useMacdBeyondSig: [true],
        d1_useStochCross: [false],
        d1_useStochKLimit: [false, true],
        d1_stochKLow: [0],
        d1_stochKHigh: [80],
        d1_useRSI: [false],
        d1_rsiLow: [5],
        d1_rsiHigh: [95],
        d1_useMacdVal: [false],
        d1_macdVal: [0]
    },
    targetRoi: [0.03, 0.04],
    slRoi: [0.15]
};

// 공통 백테스트 환경 옵션
let GLOBAL_CONFIG = {
    version: 'Logic.v8.2.3', // 구동할 로직 버전 (v8.2.3)
    symbol: 'BTCUSDT',
    start: '2026-01-01',    // KST 백테스트 시작일
    end: '2026-03-01',      // KST 백테스트 종료일
    leverage: 5,
    balance: 1000,
    entryWaitMin: 180,
    exitWaitMin: 2000
};

// 플랫한 탐색 공간 생성 헬퍼
function flattenSearchSpace(space) {
    const flat = {};
    if (space.long) {
        Object.entries(space.long).forEach(([k, v]) => {
            flat[`long_${k}`] = v;
        });
    }
    if (space.short) {
        Object.entries(space.short).forEach(([k, v]) => {
            flat[`short_${k}`] = v;
        });
    }
    if (space.targetRoi) flat.targetRoi = space.targetRoi;
    if (space.slRoi) flat.slRoi = space.slRoi;
    return flat;
}

let FLAT_SEARCH_SPACE = flattenSearchSpace(SEARCH_SPACE);

// UI 통합 호출 지원: 외부 JSON 설정 파일 로드
if (params.configFile && fs.existsSync(params.configFile)) {
    try {
        const fileContent = JSON.parse(fs.readFileSync(params.configFile, 'utf8'));
        if (fileContent.searchSpace) {
            SEARCH_SPACE = fileContent.searchSpace;
            FLAT_SEARCH_SPACE = flattenSearchSpace(SEARCH_SPACE);
        }
        if (fileContent.globalConfig) GLOBAL_CONFIG = fileContent.globalConfig;
        console.log(`✅ [INFO] Optimization config loaded successfully from UI file: ${params.configFile}`);
    } catch (e) {
        console.error(`❌ [ERROR] Failed to load UI configFile:`, e.message);
    }
}
// =========================================================================

const BASELINE_RULES = {
    '5m': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: false, stochCrossEnabled: true, adxEnabled: true, adxLow: 30, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, rsiEnabled: false, rsiLow: 5, rsiHigh: 95 },
    '1h': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: true, adxEnabled: false, adxLow: 30, adxHigh: 99, stochKLimitEnabled: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95 },
    '1d': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: false, adxEnabled: false, adxLow: 15, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95 }
};

const OPT_DIR = path.join(__dirname, '../results/optimization');
const TEMP_DIR = path.join(__dirname, '../temp');
const SCRATCH_DIR = __dirname;

// 필요한 디렉토리들 확보
if (!fs.existsSync(OPT_DIR)) fs.mkdirSync(OPT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// 모든 경우의 수 조합 생성 함수 (Cartesian Product)
function generateCombinations(space) {
    const keys = Object.keys(space);
    let results = [{}];
    for (const key of keys) {
        const values = space[key];
        const nextResults = [];
        for (const res of results) {
            for (const val of values) {
                nextResults.push({ ...res, [key]: val });
            }
        }
        results = nextResults;
    }
    return results;
}

// 조건별 맞춤형 파일명 빌더 (오직 2개 이상 선택되어 탐색 대상이 되는 핵심 파라미터만 파일명에 축약 표기)
function buildParamFilename(comb, flatSpace) {
    const parts = [];
    const isOpt = (key) => flatSpace && flatSpace[key] && flatSpace[key].length > 1;

    const timeframes = ['5m', '1h', '1d'];
    const indicators = [
        'useADX', 'adxLow', 'adxHigh', 
        'useMacdBeyondSig', 
        'useStochCross', 
        'useStochKLimit', 'stochKThreshold', 'stochKLow', 'stochKHigh',
        'useRSI', 'rsiLow', 'rsiHigh', 
        'useMacdVal', 'macdVal'
    ];

    timeframes.forEach(tf => {
        const prefix = tf === '5m' ? 'm5_' : (tf === '1h' ? 'h1_' : 'd1_');
        indicators.forEach(ind => {
            ['long_', 'short_'].forEach(sidePrefix => {
                const fullKey = sidePrefix + prefix + ind;
                if (isOpt(fullKey)) {
                    let shortVal = comb[fullKey];
                    if (shortVal === true) shortVal = 'Y';
                    if (shortVal === false) shortVal = 'N';
                    
                    // 축약어 매핑
                    const shortInd = ind
                        .replace('use', '')
                        .replace('Threshold', '')
                        .replace('BeyondSig', 'Macd')
                        .replace('Cross', 'Cross')
                        .replace('Limit', 'Lmt')
                        .replace('Low', 'L')
                        .replace('High', 'H')
                        .replace('Val', 'Val');
                    
                    const sideShort = sidePrefix === 'long_' ? 'L' : 'S';
                    parts.push(`${sideShort}${tf}${shortInd}${shortVal}`);
                }
            });
        });
    });

    if (isOpt('targetRoi')) parts.push(`ROI${(comb.targetRoi * 100).toFixed(0)}`);
    if (isOpt('slRoi')) parts.push(`SL${(comb.slRoi * 100).toFixed(0)}`);

    if (parts.length === 0) {
        parts.push('fixed');
    }
    return `backtest_${parts.join('_')}.json`;
}

// 개별 백테스트 상세 CSV 파일 상단 주석 헤더 빌더
function getCSVCommentHeader(savedResult) {
    const config = savedResult.config;
    const formatValLocal = (v) => {
        if (v === true) return 'Y';
        if (v === false) return 'N';
        return v;
    };

    const getValLocal = (baseKey) => {
        const longVal = config[`long_${baseKey}`];
        const shortVal = config[`short_${baseKey}`];
        return {
            long: longVal !== undefined ? longVal : config[baseKey],
            short: shortVal !== undefined ? shortVal : config[baseKey]
        };
    };

    const formatTF = (tf, side) => {
        const prefix = tf === '5m' ? 'm5_' : (tf === '1h' ? 'h1_' : 'd1_');
        const conds = [];

        const useADX = getValLocal(`${prefix}useADX`)[side];
        if (useADX === true || useADX === 'Y') {
            const low = getValLocal(`${prefix}adxLow`)[side] || 0;
            const high = getValLocal(`${prefix}adxHigh`)[side] || 100;
            conds.push(`${low} < ADX < ${high}`);
        }

        const useMACD = getValLocal(`${prefix}useMacdBeyondSig`)[side];
        if (useMACD === true || useMACD === 'Y') {
            conds.push(side === 'long' ? `MACD > Signal` : `MACD < Signal`);
        }

        const useStochCross = getValLocal(`${prefix}useStochCross`)[side];
        if (useStochCross === true || useStochCross === 'Y') {
            conds.push(side === 'long' ? `Stoch 크로스 (K > D)` : `Stoch 크로스 (K < D)`);
        }

        const useStochLmt = getValLocal(`${prefix}useStochKLimit`)[side];
        if (useStochLmt === true || useStochLmt === 'Y') {
            const low = getValLocal(`${prefix}stochKLow`)[side] !== undefined ? getValLocal(`${prefix}stochKLow`)[side] : 0;
            const high = getValLocal(`${prefix}stochKHigh`)[side] !== undefined ? getValLocal(`${prefix}stochKHigh`)[side] : getValLocal(`${prefix}stochKThreshold`)[side];
            conds.push(`${low} < Stoch K < ${high}`);
        }

        const useRSI = getValLocal(`${prefix}useRSI`)[side];
        if (useRSI === true || useRSI === 'Y') {
            const low = getValLocal(`${prefix}rsiLow`)[side] || 0;
            const high = getValLocal(`${prefix}rsiHigh`)[side] || 100;
            conds.push(`${low} < RSI < ${high}`);
        }

        const useMacdVal = getValLocal(`${prefix}useMacdVal`)[side];
        if (useMacdVal === true || useMacdVal === 'Y') {
            const val = getValLocal(`${prefix}macdVal`)[side] || 0;
            conds.push(side === 'long' ? `MACD > ${val}` : `MACD < ${val}`);
        }

        if (conds.length === 0) return '#    - 설정 조건 없음';
        return '#    - ' + tf + ': ' + conds.join('\t\t');
    };

    const periodStr = `${config.start || '2026-01-01'} ~ ${config.end || '2026-03-01'}`;

    let block = `# === BACKTEST METADATA ===\n`;
    block += `# Version: ${config.version || 'Logic.v8.2.3'}\n`;
    block += `# Symbol: ${config.symbol || 'BTCUSDT'}\n`;
    block += `# Period: ${periodStr}\n`;
    block += `# Leverage: ${config.leverage || 5}x\n`;
    block += `# Initial Balance: ${config.balance || 1000}\n`;
    block += `# Target ROI: ${(config.targetRoi * 100).toFixed(2)}%\n`;
    block += `# Stop Loss: ${(config.slRoi * 100).toFixed(2)}%\n`;
    block += `# Entry Wait: ${config.entryWaitMin || 180} min\n`;
    block += `# Exit Wait: ${config.exitWaitMin || 1500} min\n`;
    block += `# Rules:\n`;
    block += `#\n`;
    block += `# - Long 조건:\n`;
    block += `${formatTF('5m', 'long')}\n`;
    block += `${formatTF('1h', 'long')}\n`;
    block += `${formatTF('1d', 'long')}\n`;
    block += `# - Short 조건:\n`;
    block += `${formatTF('5m', 'short')}\n`;
    block += `${formatTF('1h', 'short')}\n`;
    block += `${formatTF('1d', 'short')}\n`;
    block += `# ============================\n`;

    return block;
}

// 개별 백테스트 프로세스 실행
function executeSingleBacktest(comb, index, total) {
    return new Promise((resolve) => {
        // 규칙 객체 깊은 복사 및 롱/숏 분리 룰 조립
        const rules = {
            long: JSON.parse(JSON.stringify(BASELINE_RULES)),
            short: JSON.parse(JSON.stringify(BASELINE_RULES)),
            global: {
                targetRoi: comb.targetRoi !== undefined ? comb.targetRoi : 0.04,
                slRoi: comb.slRoi !== undefined ? comb.slRoi : 0.15
            }
        };
        
        const timeframes = ['5m', '1h', '1d'];
        const prefixMap = { '5m': 'm5_', '1h': 'h1_', '1d': 'd1_' };
        const fieldMap = {
            useADX: 'adxEnabled',
            adxLow: 'adxLow',
            adxHigh: 'adxHigh',
            useMacdBeyondSig: 'macdCrossEnabled',
            useStochCross: 'stochCrossEnabled',
            useStochKLimit: 'stochKLimitEnabled',
            stochKThreshold: 'stochKThreshold',
            stochKLow: 'stochKLow',
            stochKHigh: 'stochKHigh',
            useRSI: 'rsiEnabled',
            rsiLow: 'rsiLow',
            rsiHigh: 'rsiHigh',
            useMacdVal: 'macdValueEnabled',
            macdVal: 'macdValue'
        };

        // 롱 포지션 규칙 대입
        timeframes.forEach(tf => {
            const prefix = prefixMap[tf];
            Object.entries(fieldMap).forEach(([optKey, ruleKey]) => {
                const fullKey = `long_${prefix}${optKey}`;
                if (comb[fullKey] !== undefined) {
                    rules.long[tf][ruleKey] = comb[fullKey];
                }
            });
        });

        // 숏 포지션 규칙 대입
        timeframes.forEach(tf => {
            const prefix = prefixMap[tf];
            Object.entries(fieldMap).forEach(([optKey, ruleKey]) => {
                const fullKey = `short_${prefix}${optKey}`;
                if (comb[fullKey] !== undefined) {
                    rules.short[tf][ruleKey] = comb[fullKey];
                }
            });
        });

        const tempRulesPath = path.join(TEMP_DIR, `opt_rules_${Date.now()}_${index}.json`);
        fs.writeFileSync(tempRulesPath, JSON.stringify(rules, null, 2));

        // 백테스트 실행 로그 출력 시에는 인덱스 표기
        console.log(`\n======================================================`);
        console.log(`[${index}/${total}] Running Backtest Combination...`);
        console.log(`Params: ${JSON.stringify(comb)}`);
        console.log(`======================================================`);

        const slRoiVal = comb.slRoi !== undefined ? comb.slRoi : (GLOBAL_CONFIG.slRoi || 0.15);
        const slRoiArg = `--slRoi=${slRoiVal}`;

        const cmd = `node run_backtest.cjs ${GLOBAL_CONFIG.version} --symbol=${GLOBAL_CONFIG.symbol} --start=${GLOBAL_CONFIG.start} --end=${GLOBAL_CONFIG.end} --leverage=${GLOBAL_CONFIG.leverage} --balance=${GLOBAL_CONFIG.balance} --exitWaitMin=${GLOBAL_CONFIG.exitWaitMin} --entryWaitMin=${GLOBAL_CONFIG.entryWaitMin} --targetRoi=${comb.targetRoi} ${slRoiArg} --rulesFile="${tempRulesPath}"`;

        exec(cmd, { cwd: path.join(__dirname, '..'), maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            // 임시 규칙 파일 정리
            if (fs.existsSync(tempRulesPath)) fs.unlinkSync(tempRulesPath);

            const output = stdout.toString();
            const jsonMatch = output.match(/###JSON_RESULT###(.*?)###JSON_RESULT###/s);

            if (jsonMatch) {
                try {
                    const runRes = JSON.parse(jsonMatch[1].trim());
                    
                    // 파일명 규칙: [코인명]_[수익률]_[win rate]_[총거래횟수]_[mdd]_[인덱스].json
                    const winRateVal = runRes.wins + runRes.losses > 0 ? ((runRes.wins / (runRes.wins + runRes.losses)) * 100).toFixed(1) : '0';
                    const finalFileName = `${GLOBAL_CONFIG.symbol}_${parseFloat(runRes.roi).toFixed(2)}_${winRateVal}_${runRes.trades.length}_${parseFloat(runRes.mdd).toFixed(2)}_${index}.json`;

                    const savedResult = {
                        filename: finalFileName,
                        config: { ...GLOBAL_CONFIG, ...comb },
                        rules: rules,
                        stats: {
                            roi: runRes.roi,
                            winRate: runRes.wins + runRes.losses > 0 ? ((runRes.wins / (runRes.wins + runRes.losses)) * 100).toFixed(1) + '%' : '-',
                            mdd: runRes.mdd,
                            trades: runRes.trades.length,
                            wins: runRes.wins,
                            losses: runRes.losses,
                            finalBalance: runRes.finalBalance
                        },
                        detailFile: runRes.resultFilePath
                    };

                    // 개별 설정값 제목으로 파일 저장
                    const savePath = path.join(OPT_DIR, finalFileName);
                    fs.writeFileSync(savePath, JSON.stringify(savedResult, null, 2));
                    console.log(`✅ Saved individual result to: ${finalFileName}`);

                    // 상세 CSV 파일 복사 시 주석 삽입
                    const csvSrcPath = runRes.resultFilePath;
                    if (csvSrcPath && fs.existsSync(csvSrcPath)) {
                        const csvDestPath = path.join(OPT_DIR, finalFileName.replace('.json', '.csv'));
                        const metadataHeader = getCSVCommentHeader(savedResult);
                        const originalCsv = fs.readFileSync(csvSrcPath, 'utf8');
                        fs.writeFileSync(csvDestPath, metadataHeader + '\n' + originalCsv);
                        console.log(`💾 Copying detail CSV with metadata comment: ${path.basename(csvDestPath)}`);
                    }

                    resolve(savedResult);
                } catch (e) {
                    console.error(`❌ JSON Result parsing failed for Index ${index}`, e.message);
                    resolve(null);
                }
            } else {
                console.error(`❌ Could not find JSON block in output for Index ${index}`);
                resolve(null);
            }
        });
    });
}

// 비교 리포트 마크다운 파일 자동 갱신
function generateMarkdownReport(results) {
    const validResults = results.filter(r => r !== null);
    console.log(`🤖 Found ${validResults.length} valid optimization results.`);

    if (validResults.length === 0) {
        console.log("❌ No valid results to generate reports.");
        return;
    }
    
    // 1. 단순 ROI 기준 정렬
    const sortedByROI = [...validResults].sort((a, b) => parseFloat(b.stats.roi) - parseFloat(a.stats.roi));
    
    // 2. 위험대비수익률 (ROI / MDD) 기준 정렬
    const sortedByRisk = [...validResults].sort((a, b) => {
        const scoreA = parseFloat(a.stats.roi) / (parseFloat(a.stats.mdd) || 0.1);
        const scoreB = parseFloat(b.stats.roi) / (parseFloat(b.stats.mdd) || 0.1);
        return scoreB - scoreA;
    });

    // 글로벌 설정 요약은 첫번째 유효 결과에서 유추하거나 기본값 지정
    const firstRes = validResults[0];
    const version = firstRes.config?.version || 'Logic.v8.2.3';
    const symbol = firstRes.config?.symbol || 'ETHUSDT';
    const start = firstRes.config?.start || '2026-01-01';
    const end = firstRes.config?.end || '2026-03-01';
    const leverage = firstRes.config?.leverage || 5;
    const balance = firstRes.config?.balance || 1000;

    // 유효값 추출용 헬퍼 함수 (롱/숏 분리 대응)
    const getVal = (config, baseKey) => {
        const longVal = config[`long_${baseKey}`];
        const shortVal = config[`short_${baseKey}`];
        if (longVal !== undefined || shortVal !== undefined) {
            return {
                long: longVal !== undefined ? longVal : '-',
                short: shortVal !== undefined ? shortVal : '-'
            };
        }
        const val = config[baseKey];
        return {
            long: val !== undefined ? val : '-',
            short: val !== undefined ? val : '-'
        };
    };

    const formatVal = (v) => {
        if (v === true) return 'Y';
        if (v === false) return 'N';
        return v;
    };

    const formatLS = (config, baseKey) => {
        const obj = getVal(config, baseKey);
        return `${formatVal(obj.long)}/${formatVal(obj.short)}`;
    };

    // 사람이 바로 읽을 수 있는 조건 요약 문자열 빌더
    const getConditionSummary = (config) => {
        const parts = [];
        if (config.targetRoi !== undefined) {
            parts.push(`익절:${(config.targetRoi * 100).toFixed(0)}%`);
        }
        const stKObj = getVal(config, 'm5_stochKThreshold');
        const stKHighObj = getVal(config, 'm5_stochKHigh');
        const stKValL = stKObj.long !== '-' ? stKObj.long : stKHighObj.long;
        const stKValS = stKObj.short !== '-' ? stKObj.short : stKHighObj.short;
        parts.push(`5M StochK(L/S):${stKValL}/${stKValS}`);

        const d1StLmt = getVal(config, 'd1_useStochKLimit');
        parts.push(`1D StochLmt(L/S):${formatVal(d1StLmt.long)}/${formatVal(d1StLmt.short)}`);

        return parts.join(' | ');
    };

    let md = `# 📊 백테스트 다중 조합 최적화 분석 보고서 (Optimization Report)\n\n`;
    md += `본 보고서는 최적화 에이전트 시스템이 다차원 매개변수 조합을 전수 테스트하여 얻은 지표 성과 순위표입니다.\n\n`;
    
    md += `## ⚙️ 분석 환경 요약\n`;
    md += `- **백테스트 로직:** \`${version}\`\n`;
    md += `- **대상 종목:** \`${symbol}\`\n`;
    md += `- **분석 기간:** \`${start} ~ ${end}\`\n`;
    md += `- **레버리지:** \`${leverage}배\` | **초기 원금:** \`$${balance}\`\n`;
    md += `- **총 테스트 조합 수:** \`${validResults.length}개\`\n\n`;

    md += `## 🏆 1. 누적 수익률 (Total ROI) 순위표\n\n`;
    md += `| 순위 | 조건 요약 | 총 수익률 | 승률 | MDD | 거래수 | 최종 잔액 | 상세 링크 |\n`;
    md += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    sortedByROI.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
        const condSummary = getConditionSummary(r.config);
        md += `| ${medal} | ${condSummary} | **${r.stats.roi}%** | ${r.stats.winRate} | ${r.stats.mdd}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} | [보기](file:///${OPT_DIR.replace(/\\/g, '/')}/${r.filename}) |\n`;
    });

    md += `\n## 🛡️ 2. 위험 대비 수익 성능 (ROI / MDD 비율) 순위표\n`;
    md += `> MDD(최대 낙폭) 대비 수익 성능을 랭킹화하여 안전하면서 안정적인 파라미터를 추천합니다.\n\n`;
    md += `| 순위 | 조건 요약 | 위험조정 점수 | 총 수익률 | MDD | 거래수 | 최종 잔액 | 상세 링크 |\n`;
    md += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    sortedByRisk.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
        const score = (parseFloat(r.stats.roi) / (parseFloat(r.stats.mdd) || 0.1)).toFixed(2);
        const condSummary = getConditionSummary(r.config);
        md += `| ${medal} | ${condSummary} | **${score}** | ${r.stats.roi}% | ${r.stats.mdd}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} | [보기](file:///${OPT_DIR.replace(/\\/g, '/')}/${r.filename}) |\n`;
    });

    md += `\n---\n*보고서 생성 시간: ${new Date().toLocaleString('ko-KR')} (KST)*\n`;

    const reportPath = path.join(SCRATCH_DIR, 'optimization_report.md');
    fs.writeFileSync(reportPath, md);
    console.log(`🎉 Best Performance Report generated successfully at: ${reportPath}`);

    // results/optimization 폴더에 종합 조건표 요약 파일 (optimization_summary.md) 작성
    let summaryMd = `# 📊 최적화 파라미터 조합별 조건 및 성과 종합표 (Optimization Summary)\n\n`;
    summaryMd += `본 종합표는 다차원 격자 탐색으로 구동된 각 시뮬레이션 조합의 지표 설정값과 백테스트 성과 수치를 대조한 대조표입니다.\n\n`;
    summaryMd += `> L/S 표기는 **Long 진입 조건 / Short 진입 조건** 순서입니다.\n\n`;
    summaryMd += `| 순위 | 결과 파일명 | 5M ADX (L/S) | 5M MACD (L/S) | 5M Stoch Lmt (L/S) | 5M StochK Lmt값 (L/S) | 1H ADX (L/S) | 1H MACD (L/S) | 1H Stoch Lmt (L/S) | 1D ADX (L/S) | 1D MACD (L/S) | 1D Stoch Lmt (L/S) | 목표 익절률 | 총 수익률 | 승률 | MDD | 거래수 | 최종 잔액 |\n`;
    summaryMd += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    
    sortedByROI.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
        
        const m5Adx = formatLS(r.config, 'm5_useADX');
        const m5Macd = formatLS(r.config, 'm5_useMacdBeyondSig');
        const m5StLmt = formatLS(r.config, 'm5_useStochKLimit');
        
        const stKObj = getVal(r.config, 'm5_stochKThreshold');
        const stKHighObj = getVal(r.config, 'm5_stochKHigh');
        const stKValL = stKObj.long !== '-' ? stKObj.long : stKHighObj.long;
        const stKValS = stKObj.short !== '-' ? stKObj.short : stKHighObj.short;
        const m5StVal = `${stKValL}/${stKValS}`;

        const h1Adx = formatLS(r.config, 'h1_useADX');
        const h1Macd = formatLS(r.config, 'h1_useMacdBeyondSig');
        const h1StLmt = formatLS(r.config, 'h1_useStochKLimit');

        const d1Adx = formatLS(r.config, 'd1_useADX');
        const d1Macd = formatLS(r.config, 'd1_useMacdBeyondSig');
        const d1StLmt = formatLS(r.config, 'd1_useStochKLimit');

        const roiVal = r.config.targetRoi !== undefined ? `${(r.config.targetRoi * 100).toFixed(1)}%` : '-';
        
        summaryMd += `| ${medal} | ${r.filename} | ${m5Adx} | ${m5Macd} | ${m5StLmt} | ${m5StVal} | ${h1Adx} | ${h1Macd} | ${h1StLmt} | ${d1Adx} | ${d1Macd} | ${d1StLmt} | ${roiVal} | **${parseFloat(r.stats.roi).toFixed(2)}%** | ${(r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) : '0.00')}% | ${parseFloat(r.stats.mdd).toFixed(2)}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} |\n`;
    });
    
    const summaryMdPath = path.join(OPT_DIR, 'optimization_summary.md');
    fs.writeFileSync(summaryMdPath, summaryMd);
    console.log(`💾 [SUMMARY SAVE] Saved markdown summary to: ${summaryMdPath}`);

    // results/optimization 폴더에 종합 조건표 CSV 파일 (optimization_summary.csv) 작성
    const csvRows = [
        "\uFEFFRank,Filename,5M_ADX_L_S,5M_MACD_L_S,5M_StochLmt_L_S,5M_StochK_L_S,1H_ADX_L_S,1H_MACD_L_S,1H_StochLmt_L_S,1D_ADX_L_S,1D_MACD_L_S,1D_StochLmt_L_S,Target_ROI,Total_ROI,Win_Rate,MDD,Trades,Final_Balance"
    ];
    
    sortedByROI.forEach((r, idx) => {
        const m5Adx = formatLS(r.config, 'm5_useADX');
        const m5Macd = formatLS(r.config, 'm5_useMacdBeyondSig');
        const m5StLmt = formatLS(r.config, 'm5_useStochKLimit');
        
        const stKObj = getVal(r.config, 'm5_stochKThreshold');
        const stKHighObj = getVal(r.config, 'm5_stochKHigh');
        const stKValL = stKObj.long !== '-' ? stKObj.long : stKHighObj.long;
        const stKValS = stKObj.short !== '-' ? stKObj.short : stKHighObj.short;
        const m5StVal = `${stKValL}/${stKValS}`;

        const h1Adx = formatLS(r.config, 'h1_useADX');
        const h1Macd = formatLS(r.config, 'h1_useMacdBeyondSig');
        const h1StLmt = formatLS(r.config, 'h1_useStochKLimit');

        const d1Adx = formatLS(r.config, 'd1_useADX');
        const d1Macd = formatLS(r.config, 'd1_useMacdBeyondSig');
        const d1StLmt = formatLS(r.config, 'd1_useStochKLimit');

        const roiVal = r.config.targetRoi !== undefined ? parseFloat(r.config.targetRoi).toFixed(2) : '-';
        const roiPercent = parseFloat(r.stats.roi).toFixed(2) + '%';
        const winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        const mddPercent = parseFloat(r.stats.mdd).toFixed(2) + '%';
        
        csvRows.push([
            idx + 1,
            r.filename,
            m5Adx,
            m5Macd,
            m5StLmt,
            m5StVal,
            h1Adx,
            h1Macd,
            h1StLmt,
            d1Adx,
            d1Macd,
            d1StLmt,
            roiVal,
            roiPercent,
            winRatePercent,
            mddPercent,
            r.stats.trades,
            Math.floor(r.stats.finalBalance)
        ].join(','));
    });
    
    const summaryCsvPath = path.join(OPT_DIR, 'optimization_summary.csv');
    try {
        fs.writeFileSync(summaryCsvPath, csvRows.join('\n'));
        console.log(`💾 [SUMMARY SAVE] Saved CSV summary to: ${summaryCsvPath}`);
    } catch (csvErr) {
        console.error(`⚠️ [SUMMARY SAVE ERROR] Could not save CSV summary (Excel might lock it):`, csvErr.message);
        try {
            const fallbackPath = path.join(OPT_DIR, 'optimization_summary_temp.csv');
            fs.writeFileSync(fallbackPath, csvRows.join('\n'));
            console.log(`💾 [SUMMARY SAVE FALLBACK] Saved fallback CSV summary to: ${fallbackPath}`);
        } catch (fallbackErr) {
            console.error(`❌ [SUMMARY SAVE FALLBACK ERROR] Could not save fallback CSV:`, fallbackErr.message);
        }
    }

    // 상위 10위의 조건 메타데이터 텍스트 파일 생성
    const formatConditionText = (r, rank) => {
        const config = r.config;
        const formatValLocal = (v) => {
            if (v === true) return 'Y';
            if (v === false) return 'N';
            return v;
        };

        const getValLocal = (baseKey) => {
            const longVal = config[`long_${baseKey}`];
            const shortVal = config[`short_${baseKey}`];
            return {
                long: longVal !== undefined ? longVal : config[baseKey],
                short: shortVal !== undefined ? shortVal : config[baseKey]
            };
        };

        const formatTF = (tf, side) => {
            const prefix = tf === '5m' ? 'm5_' : (tf === '1h' ? 'h1_' : 'd1_');
            const conds = [];

            const useADX = getValLocal(`${prefix}useADX`)[side];
            if (useADX === true || useADX === 'Y') {
                const low = getValLocal(`${prefix}adxLow`)[side] || 0;
                const high = getValLocal(`${prefix}adxHigh`)[side] || 100;
                conds.push(`${low} < ADX < ${high}`);
            }

            const useMACD = getValLocal(`${prefix}useMacdBeyondSig`)[side];
            if (useMACD === true || useMACD === 'Y') {
                conds.push(side === 'long' ? `MACD > Signal` : `MACD < Signal`);
            }

            const useStochCross = getValLocal(`${prefix}useStochCross`)[side];
            if (useStochCross === true || useStochCross === 'Y') {
                conds.push(side === 'long' ? `Stoch 크로스 (K > D)` : `Stoch 크로스 (K < D)`);
            }

            const useStochLmt = getValLocal(`${prefix}useStochKLimit`)[side];
            if (useStochLmt === true || useStochLmt === 'Y') {
                const low = getValLocal(`${prefix}stochKLow`)[side] !== undefined ? getValLocal(`${prefix}stochKLow`)[side] : 0;
                const high = getValLocal(`${prefix}stochKHigh`)[side] !== undefined ? getValLocal(`${prefix}stochKHigh`)[side] : getValLocal(`${prefix}stochKThreshold`)[side];
                conds.push(`${low} < Stoch K < ${high}`);
            }

            const useRSI = getValLocal(`${prefix}useRSI`)[side];
            if (useRSI === true || useRSI === 'Y') {
                const low = getValLocal(`${prefix}rsiLow`)[side] || 0;
                const high = getValLocal(`${prefix}rsiHigh`)[side] || 100;
                conds.push(`${low} < RSI < ${high}`);
            }

            const useMacdVal = getValLocal(`${prefix}useMacdVal`)[side];
            if (useMacdVal === true || useMacdVal === 'Y') {
                const val = getValLocal(`${prefix}macdVal`)[side] || 0;
                conds.push(side === 'long' ? `MACD > ${val}` : `MACD < ${val}`);
            }

            if (conds.length === 0) return '  #    - 설정 조건 없음';
            return '  #    - ' + tf + ': ' + conds.join('   |   ');
        };

        const periodStr = `${config.start || '2026-01-01'} ~ ${config.end || '2026-03-01'}`;

        let block = `\n### 🏆 [${rank}위] - 수익률 ${parseFloat(r.stats.roi).toFixed(2)}% (MDD ${parseFloat(r.stats.mdd).toFixed(2)}%, 승률 ${(r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) : '0.00')}%, 거래수 ${r.stats.trades}회)\n\n`;
        block += `\`\`\`\n`;
        block += `# === BACKTEST METADATA ===\n`;
        block += `# Version: ${config.version || 'Logic.v8.2.3'}\n`;
        block += `# Symbol: ${config.symbol || 'BTCUSDT'}\n`;
        block += `# Period: ${periodStr}\n`;
        block += `# Leverage: ${config.leverage || 5}x\n`;
        block += `# Initial Balance: ${config.balance || 1000}\n`;
        block += `# Target ROI: ${(config.targetRoi * 100).toFixed(2)}%\n`;
        block += `# Stop Loss: ${(config.slRoi * 100).toFixed(2)}%\n`;
        block += `# Entry Wait: ${config.entryWaitMin || 180} min\n`;
        block += `# Exit Wait: ${config.exitWaitMin || 1500} min\n`;
        block += `# Rules:\n`;
        block += `#\n`;
        block += `#  - Long 조건:\n`;
        block += `${formatTF('5m', 'long')}\n`;
        block += `${formatTF('1h', 'long')}\n`;
        block += `${formatTF('1d', 'long')}\n`;
        block += `#  - Short 조건:\n`;
        block += `${formatTF('5m', 'short')}\n`;
        block += `${formatTF('1h', 'short')}\n`;
        block += `${formatTF('1d', 'short')}\n`;
        block += `# ============================\n`;
        block += `\`\`\`\n`;

        return block;
    };

    let top10Md = `# 📊 상위 10위 조건 상세 정리 보고서 (Top 10 Conditions Summary)\n\n`;
    top10Md += `본 보고서는 최적화 백테스트 결과 중 수익률 기준 상위 10위 조건들을 메타데이터와 진입 조건으로 해독한 조건표입니다.\n\n`;
    
    for (let i = 0; i < Math.min(10, sortedByROI.length); i++) {
        top10Md += formatConditionText(sortedByROI[i], i + 1);
    }
    
    const top10Path = path.join(SCRATCH_DIR, 'top10_conditions.md');
    fs.writeFileSync(top10Path, top10Md);
    console.log(`🎉 Top 10 Conditions report generated successfully at: ${top10Path}`);
}

// 메인 실행 제어기
async function main() {
    console.log(`\n🤖 [Antigravity Optimization Agent] Starting...`);
    const combinations = generateCombinations(FLAT_SEARCH_SPACE);
    console.log(`🤖 총 경우의 수 조합: ${combinations.length}개 탐색 예정.`);

    const results = [];
    for (let i = 0; i < combinations.length; i++) {
        const res = await executeSingleBacktest(combinations[i], i + 1, combinations.length);
        results.push(res);
    }

    generateMarkdownReport(results);
    console.log(`\n🤖 [Antigravity Optimization Agent] Task Completed!`);
}

main();
