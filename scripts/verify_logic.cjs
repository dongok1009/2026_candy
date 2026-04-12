const fs = require('fs');
const path = require('path');

/**
 * [자동 검증 스크립트 v2.0] 
 * STRATEGY_RULES.md에 정의된 '절대 원칙' 준수 여부를 최우선으로 검증합니다.
 */

console.log("\n⚖️  Verifying Against [STRATEGY_RULES.md] Absolute Principles...\n");

const rules = [
    {
        ruleId: "Rule 1-1",
        name: "Data isolation & Strict Indexing",
        desc: "확정봉 데이터만 사용하며 타임스탬프 기반 인덱스 탐색(findLastIndex)을 수행하는가?",
        file: "lib/engine.cjs",
        test: (content) => content.includes('findLastIndex') && content.includes('referenceTime'),
        error: "Engine이 단순 Index-1 방식을 사용 중입니다. findLastIndex 기반의 절대적 인텍스 탐색이 필요합니다."
    },
    {
        ruleId: "Rule 1-2",
        name: "UI Rule Sync & Dynamic Override",
        desc: "대시보드의 체크박스 설정(overrideRules)이 엔진에서 전략으로 전달되어 반영되는가?",
        file: "lib/engine.cjs",
        test: (content) => content.includes('config.overrideRules'),
        extraFile: "strategies/Logic.v7.0.1.cjs",
        extraTest: (content) => content.includes('overrideRules[side]') || content.includes('overrideRules.long'),
        error: "UI에서 설정한 filter(overrideRules)가 무시되고 하드코딩된 로직이 작동 중일 가능성이 있습니다."
    },
    {
        ruleId: "Rule 1-3",
        name: "Immediate T-Entry Timing",
        desc: "시그널 발생 즉시(T 시점) 진입을 위해 루프가 currentIndex부터 시작하는가?",
        file: "strategies/Logic.v7.0.1.cjs",
        test: (content) => content.includes('let j = currentIndex;'),
        error: "진입 시점이 T+1로 지연되어 있거나 잘못되었습니다. (currentIndex부터 시작해야 함)"
    },
    {
        ruleId: "Rule 2-1",
        name: "Indicator Warm-up Period",
        desc: "1일봉 MACD 등의 계산을 위해 FETCH_START_TIME이 충분한 여유(최소 35일)를 확보하고 있는가?",
        file: "strategies/Logic.v7.0.1.cjs",
        test: (content) => {
            const fetchMatch = content.match(/FETCH_START_TIME: new Date\('(.+?)'\)/);
            const actualMatch = content.match(/ACTUAL_START_TIME: new Date\('(.+?)'\)/);
            if (fetchMatch && actualMatch) {
                const diffDays = (new Date(actualMatch[1]) - new Date(fetchMatch[1])) / (1000 * 60 * 60 * 24);
                return diffDays >= 35;
            }
            return false;
        },
        error: "과거 데이터 확보 기간(Padding)이 부족하여 1일봉 MACD 등에서 null 값이 발생할 위험이 있습니다. (최소 35일 필요)"
    }
];

let allPassed = true;

rules.forEach(item => {
    process.stdout.write(`🔍 Checking [${item.ruleId}] ${item.name}... `);
    
    try {
        const fullPath = path.join(process.cwd(), item.file);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        let passed = item.test(content);
        
        if (passed && item.extraFile) {
            const extraPath = path.join(process.cwd(), item.extraFile);
            const extraContent = fs.readFileSync(extraPath, 'utf8');
            passed = item.extraTest(extraContent);
        }

        if (passed) {
            console.log("✅ PASS");
        } else {
            console.log("❌ FAIL");
            console.error(`   👉 Reason: ${item.error}`);
            allPassed = false;
        }
    } catch (err) {
        console.log("💥 ERROR");
        console.error(`   👉 File missing or unreadable: ${err.message}`);
        allPassed = false;
    }
});

if (allPassed) {
    console.log("\n🏆 [FINAL RESULT] All STRATEGY_RULES are successfully enforced.");
    process.exit(0);
} else {
    console.error("\n🚫 [FINAL RESULT] Critical Rule Violation! Please fix based on STRATEGY_RULES.md.");
    process.exit(1);
}
