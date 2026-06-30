const fs = require('fs');
const path = require('path');

const srcDir = 'c:/dev/2026_candy';
const destDir = 'c:/dev/2026_candy/live_release';

// 대상 디렉토리 생성
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// 복사할 폴더 목록
const dirsToCopy = ['src', 'public', 'lib', 'strategies'];

// 복사할 파일 목록
const filesToCopy = [
    'bybit_trader.cjs',
    'server.cjs',
    'package.json',
    'package-lock.json',
    'vite.config.js',
    'eslint.config.js',
    'index.html',
    'live_rules.json',
    '.env',
    '.env.example',
    '.gitignore',
    'CHANGELOG.md',
    'HISTORY.md',
    'BACKTEST_HISTORY.md',
    'README.md',
    'STRATEGY_RULES.md',
    'VERIFICATION_GUIDE.md',
    'VERSION_GUIDE.md'
];

// 재귀 폴더 복사 함수
function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 폴더 복사 실행
for (let dir of dirsToCopy) {
    const srcPath = path.join(srcDir, dir);
    const destPath = path.join(destDir, dir);
    if (fs.existsSync(srcPath)) {
        console.log(`Copying directory: ${dir}`);
        copyDirSync(srcPath, destPath);
    }
}

// 파일 복사 실행
for (let file of filesToCopy) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (fs.existsSync(srcPath)) {
        console.log(`Copying file: ${file}`);
        fs.copyFileSync(srcPath, destPath);
    }
}

console.log('Copy completed successfully.');
