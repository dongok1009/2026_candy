// 오라클 서버용 환경 변수 동기화 헬퍼 스크립트
const { syncRulesToEnv } = require('../lib/rules_helper.cjs');
const fs = require('fs');
const rules = JSON.parse(fs.readFileSync('live_rules.json', 'utf8'));
const success = syncRulesToEnv(rules);
console.log('Sync result:', success);
