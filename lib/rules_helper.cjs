const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const EXAMPLE_PATH = path.join(__dirname, '..', '.env.example');

/**
 * .env 파일 내용을 파싱하여 맵 객체로 반환합니다.
 */
function parseEnvFile() {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const env = {};
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            env[key] = val;
        }
    }
    return env;
}

/**
 * .env 파일에서 지표 및 글로벌 전략 값들을 파싱하여 live_rules.json 호환 객체로 반환합니다.
 */
function buildRulesFromEnv() {
    if (!fs.existsSync(ENV_PATH)) return null;

    try {
        const env = parseEnvFile();

        const toBool = (val) => val === 'true' || val === '1' || val === 'on';
        const toNum = (val, fallback) => {
            if (val === undefined || val === '') return fallback;
            const num = parseFloat(val);
            return isNaN(num) ? fallback : num;
        };

        const getEnvValue = (side, timeframe, suffix, fallbackKey) => {
            const prefix = `${timeframe.toUpperCase()}_${side.toUpperCase()}`; // e.g. 5M_LONG
            const key = `${prefix}_${suffix}`; // e.g. 5M_LONG_USE_ADX
            if (env[key] !== undefined) return env[key];
            
            // Fallback to legacy
            const legacyPrefix = `${timeframe.toUpperCase()}`; // e.g. 5M
            const legacyKey = `${legacyPrefix}_${suffix}`; // e.g. 5M_USE_ADX
            if (env[legacyKey] !== undefined) return env[legacyKey];

            if (fallbackKey) {
                const legacyKey2 = `${legacyPrefix}_${fallbackKey}`;
                if (env[legacyKey2] !== undefined) return env[legacyKey2];
            }
            return undefined;
        };

        const buildIntervalRules = (side, timeframe) => {
            const useAdxVal = getEnvValue(side, timeframe, 'USE_ADX');
            const adxLowVal = getEnvValue(side, timeframe, 'ADX_LOW', 'ADX_THRESHOLD');
            const adxHighVal = getEnvValue(side, timeframe, 'ADX_HIGH');
            const useMacdCrossVal = getEnvValue(side, timeframe, 'USE_MACD_CROSS');
            const useStochCrossVal = getEnvValue(side, timeframe, 'USE_STOCH_CROSS');
            const useStochLimitVal = getEnvValue(side, timeframe, 'USE_STOCH_LIMIT', 'USE_STOCHK_LIMIT');
            const stochKThresholdVal = getEnvValue(side, timeframe, 'STOCH_LIMIT_THRESHOLD', 'STOCHK_THRESHOLD');
            const stochKLowVal = getEnvValue(side, timeframe, 'STOCH_LOW');
            const stochKHighVal = getEnvValue(side, timeframe, 'STOCH_HIGH');
            const useRsiVal = getEnvValue(side, timeframe, 'USE_RSI');
            const rsiLowVal = getEnvValue(side, timeframe, 'RSI_LOW');
            const rsiHighVal = getEnvValue(side, timeframe, 'RSI_HIGH');
            const useMacdValueVal = getEnvValue(side, timeframe, 'USE_MACD_VALUE', 'USE_MACD_VAL');
            const macdValueThresholdVal = getEnvValue(side, timeframe, 'MACD_VALUE_THRESHOLD', 'MACD_VAL');

            return {
                adxEnabled: toBool(useAdxVal),
                adxLow: toNum(adxLowVal, timeframe === '1d' ? 15 : 30),
                adxHigh: toNum(adxHighVal, 99),
                macdCrossEnabled: toBool(useMacdCrossVal),
                stochCrossEnabled: toBool(useStochCrossVal),
                stochLimitEnabled: toBool(useStochLimitVal),
                stochKThreshold: toNum(stochKThresholdVal, 80),
                stochKLow: toNum(stochKLowVal, 0),
                stochKHigh: toNum(stochKHighVal, stochKThresholdVal !== undefined ? parseFloat(stochKThresholdVal) : 99),
                rsiEnabled: toBool(useRsiVal),
                rsiLow: toNum(rsiLowVal, 5),
                rsiHigh: toNum(rsiHighVal, 95),
                macdValueEnabled: toBool(useMacdValueVal),
                macdValue: toNum(macdValueThresholdVal, 0)
            };
        };

        return {
            "long": {
                "5m": buildIntervalRules('long', '5m'),
                "1h": buildIntervalRules('long', '1h'),
                "1d": buildIntervalRules('long', '1d')
            },
            "short": {
                "5m": buildIntervalRules('short', '5m'),
                "1h": buildIntervalRules('short', '1h'),
                "1d": buildIntervalRules('short', '1d')
            },
            "global": {
                "leverage": env.LEVERAGE !== undefined ? toNum(env.LEVERAGE, 5) : undefined,
                "entryWaitMin": env.ENTRY_WAIT_MIN !== undefined ? toNum(env.ENTRY_WAIT_MIN, 180) : undefined,
                "exitWaitMin": env.EXIT_WAIT_MIN !== undefined ? toNum(env.EXIT_WAIT_MIN, 2000) : undefined,
                "targetRoi": env.TARGET_NET_ROI !== undefined ? toNum(env.TARGET_NET_ROI, 0.03) : undefined,
                "slRoi": env.SL_ROI !== undefined ? toNum(env.SL_ROI, 0.15) : undefined,
                "reduceTpWaitMin": env.REDUCE_TP_WAIT_MIN !== undefined ? toNum(env.REDUCE_TP_WAIT_MIN, 60) : undefined,
                "reducedTargetRoi": env.REDUCED_TARGET_ROI !== undefined ? toNum(env.REDUCED_TARGET_ROI, 0.01) : undefined,
                "orderAmount": env.ORDER_AMOUNT !== undefined ? toNum(env.ORDER_AMOUNT, 100) : undefined,
                "penetrationRate": env.PENETRATION_RATE !== undefined ? toNum(env.PENETRATION_RATE, 0.001) : undefined,
                "entryMode": env.ENTRY_MODE !== undefined ? env.ENTRY_MODE : undefined
            }
        };
    } catch (err) {
        console.error("❌ [RulesHelper] Error parsing .env rules:", err.message);
        return null;
    }
}

/**
 * 봇 가동 시 .env가 존재할 경우, 지표 관련 설정이 없으면 .env.example 또는 디폴트 템플릿으로 복원/주입합니다.
 */
function ensureEnvTemplate() {
    if (!fs.existsSync(ENV_PATH)) {
        console.log(`ℹ️ [RulesHelper] .env file not found. Skipping auto-injection.`);
        return;
    }

    try {
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');
        if (envContent.includes('5M_USE_ADX')) {
            return; // 이미 템플릿 존재함
        }

        console.log(`📝 [RulesHelper] .env is missing indicators/strategy config. Injecting templates...`);
        let appendText = '';

        if (fs.existsSync(EXAMPLE_PATH)) {
            const exampleLines = fs.readFileSync(EXAMPLE_PATH, 'utf8').split(/\r?\n/);
            const startIndex = exampleLines.findIndex(l => l.includes('📊') || l.includes('오라클 버전') || l.includes('ENTRY_WAIT_MIN') || l.includes('5M_USE_ADX'));
            if (startIndex !== -1) {
                appendText = '\n' + exampleLines.slice(startIndex).join('\n');
            }
        }

        if (!appendText) {
            // fallback template
            appendText = `
# ----------------------------------------------------
# 📊 [오라클 버전] 실시간 거래 전략 및 청산 매개변수
# ----------------------------------------------------
ENTRY_WAIT_MIN=180
EXIT_WAIT_MIN=1500
TARGET_NET_ROI=0.04
SL_ROI=0.15
REDUCE_TP_WAIT_MIN=0
REDUCED_TARGET_ROI=0.02
LEVERAGE=5
ORDER_AMOUNT=100
PENETRATION_RATE=0.001
ENTRY_MODE=HYBRID_BETTER

# --- 5m 지표 설정 ---
5M_USE_ADX=true
5M_ADX_LOW=30
5M_ADX_HIGH=99
5M_USE_MACD_CROSS=false
5M_USE_STOCH_CROSS=true
5M_USE_STOCH_LIMIT=true
5M_STOCH_LIMIT_THRESHOLD=99
5M_USE_RSI=false
5M_RSI_LOW=5
5M_RSI_HIGH=95
5M_USE_MACD_VALUE=false
5M_MACD_VALUE_THRESHOLD=0

# --- 1h 지표 설정 ---
1H_USE_ADX=false
1H_ADX_LOW=30
1H_ADX_HIGH=99
1H_USE_MACD_CROSS=true
1H_USE_STOCH_CROSS=true
1H_USE_STOCH_LIMIT=false
1H_STOCH_LIMIT_THRESHOLD=98
1H_USE_RSI=false
1H_RSI_LOW=5
1H_RSI_HIGH=95
1H_USE_MACD_VALUE=false
1H_MACD_VALUE_THRESHOLD=0

# --- 1d 지표 설정 ---
1D_USE_ADX=false
1D_ADX_LOW=15
1D_ADX_HIGH=99
1D_USE_MACD_CROSS=true
1D_USE_STOCH_CROSS=false
1D_USE_STOCH_LIMIT=true
1D_STOCH_LIMIT_THRESHOLD=98
1D_USE_RSI=false
1D_RSI_LOW=5
1D_RSI_HIGH=95
1D_USE_MACD_VALUE=false
1D_MACD_VALUE_THRESHOLD=0
`;
        }

        fs.appendFileSync(ENV_PATH, appendText);
        console.log(`✅ [RulesHelper] Successfully appended template configuration to .env!`);
    } catch (err) {
        console.error("❌ [RulesHelper] Error during ensureEnvTemplate:", err.message);
    }
}

/**
 * UI로부터 넘어온 rules 데이터를 .env 파일에 실시간 덮어쓰기 업데이트합니다.
 */
function syncRulesToEnv(rules) {
    if (!fs.existsSync(ENV_PATH)) return false;

    try {
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');

        const updates = {};

        // global 맵핑
        if (rules.global) {
            const g = rules.global;
            if (g.leverage !== undefined) updates['LEVERAGE'] = g.leverage;
            if (g.orderAmount !== undefined) updates['ORDER_AMOUNT'] = g.orderAmount;
            if (g.entryWaitMin !== undefined) updates['ENTRY_WAIT_MIN'] = g.entryWaitMin;
            if (g.exitWaitMin !== undefined) updates['EXIT_WAIT_MIN'] = g.exitWaitMin;
            if (g.targetRoi !== undefined) updates['TARGET_NET_ROI'] = g.targetRoi;
            if (g.slRoi !== undefined) updates['SL_ROI'] = g.slRoi;
            if (g.reduceTpWaitMin !== undefined) updates['REDUCE_TP_WAIT_MIN'] = g.reduceTpWaitMin;
            if (g.reducedTargetRoi !== undefined) updates['REDUCED_TARGET_ROI'] = g.reducedTargetRoi;
            if (g.penetrationRate !== undefined) updates['PENETRATION_RATE'] = g.penetrationRate;
            if (g.entryMode !== undefined) updates['ENTRY_MODE'] = g.entryMode;
        }

        // 지표 맵핑 (long/short 분리)
        const timeframes = ['5m', '1h', '1d'];
        const sides = ['long', 'short'];

        // 레거시 지표 변수 정규식으로 제거 (롱/숏 분리 동기화 시 혼선 방지)
        for (const tf of timeframes) {
            const prefix = `${tf.toUpperCase()}`;
            const legacyKeys = [
                `USE_ADX`, `ADX_LOW`, `ADX_HIGH`, `ADX_THRESHOLD`,
                `USE_MACD_CROSS`, `USE_STOCH_CROSS`, `USE_STOCH_LIMIT`, `USE_STOCHK_LIMIT`, `STOCH_LIMIT_THRESHOLD`, `STOCHK_THRESHOLD`,
                `USE_RSI`, `RSI_LOW`, `RSI_HIGH`,
                `USE_MACD_VALUE`, `USE_MACD_VAL`, `MACD_VALUE_THRESHOLD`, `MACD_VAL`
            ];
            for (const key of legacyKeys) {
                const reg = new RegExp(`^${prefix}_${key}\\s*=.*$\\r?\\n?`, 'gm');
                envContent = envContent.replace(reg, '');
            }
        }

        for (const side of sides) {
            for (const tf of timeframes) {
                const prefix = `${tf.toUpperCase()}_${side.toUpperCase()}`; // e.g. 5M_LONG, 5M_SHORT
                const sideRules = rules[side];
                if (!sideRules) continue;
                const r = sideRules[tf];
                if (!r) continue;

                if (r.adxEnabled !== undefined) updates[`${prefix}_USE_ADX`] = r.adxEnabled;
                if (r.adxLow !== undefined) updates[`${prefix}_ADX_LOW`] = r.adxLow;
                if (r.adxHigh !== undefined) updates[`${prefix}_ADX_HIGH`] = r.adxHigh;
                
                if (r.macdCrossEnabled !== undefined) updates[`${prefix}_USE_MACD_CROSS`] = r.macdCrossEnabled;
                if (r.stochCrossEnabled !== undefined) updates[`${prefix}_USE_STOCH_CROSS`] = r.stochCrossEnabled;
                
                if (r.stochLimitEnabled !== undefined) updates[`${prefix}_USE_STOCH_LIMIT`] = r.stochLimitEnabled;
                if (r.stochKThreshold !== undefined) updates[`${prefix}_STOCH_LIMIT_THRESHOLD`] = r.stochKThreshold;
                if (r.stochKLow !== undefined) updates[`${prefix}_STOCH_LOW`] = r.stochKLow;
                if (r.stochKHigh !== undefined) updates[`${prefix}_STOCH_HIGH`] = r.stochKHigh;

                if (r.rsiEnabled !== undefined) updates[`${prefix}_USE_RSI`] = r.rsiEnabled;
                if (r.rsiLow !== undefined) updates[`${prefix}_RSI_LOW`] = r.rsiLow;
                if (r.rsiHigh !== undefined) updates[`${prefix}_RSI_HIGH`] = r.rsiHigh;
                
                if (r.macdValueEnabled !== undefined) updates[`${prefix}_USE_MACD_VALUE`] = r.macdValueEnabled;
                if (r.macdValue !== undefined) updates[`${prefix}_MACD_VALUE_THRESHOLD`] = r.macdValue;
            }
        }

        // env 파일 업데이트 실행
        for (const [key, val] of Object.entries(updates)) {
            const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${val}`);
            } else {
                envContent += `\n${key}=${val}`;
            }
        }

        fs.writeFileSync(ENV_PATH, envContent, 'utf8');
        return true;
    } catch (err) {
        console.error("❌ [RulesHelper] Error syncing rules to .env:", err.message);
        return false;
    }
}

module.exports = {
    buildRulesFromEnv,
    ensureEnvTemplate,
    syncRulesToEnv
};
