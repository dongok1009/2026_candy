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

        const buildIntervalRules = (timeframe, sideUpper) => {
            const prefix = `${sideUpper}_${timeframe.toUpperCase()}`;
            return {
                adxEnabled: toBool(env[`${prefix}_USE_ADX`]),
                adxThreshold: toNum(env[`${prefix}_ADX_THRESHOLD`], 30),
                macdCrossEnabled: toBool(env[`${prefix}_USE_MACD_CROSS`]),
                stochCrossEnabled: toBool(env[`${prefix}_USE_STOCH_CROSS`]),
                stochLimitEnabled: toBool(env[`${prefix}_USE_STOCH_LIMIT`]),
                stochKThreshold: toNum(env[`${prefix}_STOCH_LIMIT_THRESHOLD`], 80),
                rsiEnabled: toBool(env[`${prefix}_USE_RSI`]),
                rsiLow: toNum(env[`${prefix}_RSI_LOW`], 5),
                rsiHigh: toNum(env[`${prefix}_RSI_HIGH`], 95),
                macdValueEnabled: toBool(env[`${prefix}_USE_MACD_VALUE`]),
                macdValue: toNum(env[`${prefix}_MACD_VALUE_THRESHOLD`], sideUpper === 'LONG' ? -10 : 10),
                macdSigDiffEnabled: toBool(env[`${prefix}_USE_MACD_SIG_DIFF`]),
                macdSigDiffThreshold: toNum(env[`${prefix}_MACD_SIG_DIFF_THRESHOLD`], 0)
            };
        };

        return {
            "5m": {
                "long": buildIntervalRules('5m', 'LONG'),
                "short": buildIntervalRules('5m', 'SHORT')
            },
            "1h": {
                "long": buildIntervalRules('1h', 'LONG'),
                "short": buildIntervalRules('1h', 'SHORT')
            },
            "1d": {
                "long": buildIntervalRules('1d', 'LONG'),
                "short": buildIntervalRules('1d', 'SHORT')
            },
            "global": {
                "leverage": env.LEVERAGE !== undefined ? toNum(env.LEVERAGE, 5) : undefined,
                "entryWaitMin": env.ENTRY_WAIT_MIN !== undefined ? toNum(env.ENTRY_WAIT_MIN, 180) : undefined,
                "exitWaitMin": env.EXIT_WAIT_MIN !== undefined ? toNum(env.EXIT_WAIT_MIN, 2000) : undefined,
                "targetRoi": env.TARGET_NET_ROI !== undefined ? toNum(env.TARGET_NET_ROI, 0.03) : undefined,
                "slRoi": env.SL_ROI !== undefined ? toNum(env.SL_ROI, 0.15) : undefined,
                "reduceTpWaitMin": env.REDUCE_TP_WAIT_MIN !== undefined ? toNum(env.REDUCE_TP_WAIT_MIN, 60) : undefined,
                "reducedTargetRoi": env.REDUCED_TARGET_ROI !== undefined ? toNum(env.REDUCED_TARGET_ROI, 0.01) : undefined,
                "orderAmount": env.ORDER_AMOUNT !== undefined ? toNum(env.ORDER_AMOUNT, 100) : undefined
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
        if (envContent.includes('LONG_5M_USE_ADX')) {
            return; // 이미 템플릿 존재함
        }

        console.log(`📝 [RulesHelper] .env is missing indicators/strategy config. Injecting templates...`);
        let appendText = '';

        if (fs.existsSync(EXAMPLE_PATH)) {
            const exampleLines = fs.readFileSync(EXAMPLE_PATH, 'utf8').split(/\r?\n/);
            const startIndex = exampleLines.findIndex(l => l.includes('📊') || l.includes('오라클 버전') || l.includes('ENTRY_WAIT_MIN'));
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

# --- 5m LONG / SHORT 지표 설정 ---
LONG_5M_USE_ADX=true
LONG_5M_ADX_THRESHOLD=30
LONG_5M_USE_MACD_CROSS=false
LONG_5M_USE_STOCH_CROSS=true
LONG_5M_USE_STOCH_LIMIT=true
LONG_5M_STOCH_LIMIT_THRESHOLD=99
LONG_5M_USE_RSI=false
LONG_5M_RSI_LOW=5
LONG_5M_RSI_HIGH=95
LONG_5M_USE_MACD_VALUE=false
LONG_5M_MACD_VALUE_THRESHOLD=0

SHORT_5M_USE_ADX=true
SHORT_5M_ADX_THRESHOLD=30
SHORT_5M_USE_MACD_CROSS=false
SHORT_5M_USE_STOCH_CROSS=true
SHORT_5M_USE_STOCH_LIMIT=true
SHORT_5M_STOCH_LIMIT_THRESHOLD=99
SHORT_5M_USE_RSI=false
SHORT_5M_RSI_LOW=5
SHORT_5M_RSI_HIGH=95
SHORT_5M_USE_MACD_VALUE=false
SHORT_5M_MACD_VALUE_THRESHOLD=0

# --- 1h LONG / SHORT 지표 설정 ---
LONG_1H_USE_ADX=false
LONG_1H_ADX_THRESHOLD=30
LONG_1H_USE_MACD_CROSS=true
LONG_1H_USE_STOCH_CROSS=true
LONG_1H_USE_STOCH_LIMIT=false
LONG_1H_STOCH_LIMIT_THRESHOLD=98
LONG_1H_USE_RSI=false
LONG_1H_RSI_LOW=5
LONG_1H_RSI_HIGH=95

SHORT_1H_USE_ADX=false
SHORT_1H_ADX_THRESHOLD=30
SHORT_1H_USE_MACD_CROSS=true
SHORT_1H_USE_STOCH_CROSS=true
SHORT_1H_USE_STOCH_LIMIT=false
SHORT_1H_STOCH_LIMIT_THRESHOLD=98
SHORT_1H_USE_RSI=false
SHORT_1H_RSI_LOW=5
SHORT_1H_RSI_HIGH=95

# --- 1d LONG / SHORT 지표 설정 ---
LONG_1D_USE_ADX=false
LONG_1D_ADX_THRESHOLD=15
LONG_1D_USE_MACD_CROSS=true
LONG_1D_USE_STOCH_CROSS=false
LONG_1D_USE_STOCH_LIMIT=true
LONG_1D_STOCH_LIMIT_THRESHOLD=98
LONG_1D_USE_RSI=false
LONG_1D_RSI_LOW=5
LONG_1D_RSI_HIGH=95
LONG_1D_USE_MACD_SIG_DIFF=false
LONG_1D_MACD_SIG_DIFF_THRESHOLD=0

SHORT_1D_USE_ADX=false
SHORT_1D_ADX_THRESHOLD=15
SHORT_1D_USE_MACD_CROSS=true
SHORT_1D_USE_STOCH_CROSS=false
SHORT_1D_USE_STOCH_LIMIT=true
SHORT_1D_STOCH_LIMIT_THRESHOLD=98
SHORT_1D_USE_RSI=false
SHORT_1D_RSI_LOW=5
SHORT_1D_RSI_HIGH=95
SHORT_1D_USE_MACD_SIG_DIFF=false
SHORT_1D_MACD_SIG_DIFF_THRESHOLD=0
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
        }

        // 지표 맵핑
        const timeframes = ['5m', '1h', '1d'];
        const sides = ['long', 'short'];

        for (const tf of timeframes) {
            for (const side of sides) {
                const prefix = `${side.toUpperCase()}_${tf.toUpperCase()}`;
                const r = rules[tf]?.[side];
                if (!r) continue;

                if (r.adxEnabled !== undefined) updates[`${prefix}_USE_ADX`] = r.adxEnabled;
                if (r.adxThreshold !== undefined) updates[`${prefix}_ADX_THRESHOLD`] = r.adxThreshold;
                
                if (r.macdCrossEnabled !== undefined) updates[`${prefix}_USE_MACD_CROSS`] = r.macdCrossEnabled;
                if (r.stochCrossEnabled !== undefined) updates[`${prefix}_USE_STOCH_CROSS`] = r.stochCrossEnabled;
                
                if (r.stochLimitEnabled !== undefined) updates[`${prefix}_USE_STOCH_LIMIT`] = r.stochLimitEnabled;
                if (r.stochKThreshold !== undefined) updates[`${prefix}_STOCH_LIMIT_THRESHOLD`] = r.stochKThreshold;

                if (r.rsiEnabled !== undefined) updates[`${prefix}_USE_RSI`] = r.rsiEnabled;
                if (r.rsiLow !== undefined) updates[`${prefix}_RSI_LOW`] = r.rsiLow;
                if (r.rsiHigh !== undefined) updates[`${prefix}_RSI_HIGH`] = r.rsiHigh;
                
                if (r.macdValueEnabled !== undefined) updates[`${prefix}_USE_MACD_VALUE`] = r.macdValueEnabled;
                if (r.macdValue !== undefined) updates[`${prefix}_MACD_VALUE_THRESHOLD`] = r.macdValue;

                if (r.macdSigDiffEnabled !== undefined) updates[`${prefix}_USE_MACD_SIG_DIFF`] = r.macdSigDiffEnabled;
                if (r.macdSigDiffThreshold !== undefined) updates[`${prefix}_MACD_SIG_DIFF_THRESHOLD`] = r.macdSigDiffThreshold;
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
