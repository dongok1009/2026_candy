const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const RECORDS_FILE = path.join(__dirname, 'records.json');
const HISTORY_MD = path.join(__dirname, 'BACKTEST_HISTORY.md');
const LIVE_STATE_FILE = path.join(__dirname, 'live_state.json');
const LIVE_RULES_FILE = path.join(__dirname, 'live_rules.json');

// --- 실전 매매 (Live Trading) API ---
app.get('/api/live-status', (req, res) => {
    try {
        if (!fs.existsSync(LIVE_STATE_FILE)) return res.json({ status: 'OFFLINE' });
        const data = JSON.parse(fs.readFileSync(LIVE_STATE_FILE, 'utf8'));
        res.json(data);
    } catch (err) {
        res.json({ status: 'ERROR', message: err.message });
    }
});

app.post('/api/live-settings', (req, res) => {
    const { rules } = req.body;
    fs.writeFileSync(LIVE_RULES_FILE, JSON.stringify(rules, null, 2));
    res.json({ success: true });
});

app.get('/api/live-rules', (req, res) => {
    if (!fs.existsSync(LIVE_RULES_FILE)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(LIVE_RULES_FILE, 'utf8')));
});
// ----------------------------------

// 기록 불러오기 API
app.get('/api/list-history', (req, res) => {
    try {
        if (!fs.existsSync(RECORDS_FILE)) return res.json([]);
        const data = fs.readFileSync(RECORDS_FILE, 'utf8');
        res.json(JSON.parse(data || '[]'));
    } catch (err) {
        console.error("[LIST-HISTORY ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 백테스트 실행 API
app.post('/api/backtest', (req, res) => {
    try {
        const { version, symbol, startDate, endDate, leverage, initialBalance, overrideRules, exitWaitLimit, exitWaitMin, entryWaitLimit, entryWaitMin, targetRoi, slRoi } = req.body;
        
        // 필수 필드 체크
        if (!version || !symbol || !startDate || !endDate) {
            return res.status(400).json({ success: false, error: "필수 입력값(버전, 심볼, 시작/종료일)이 누락되었습니다." });
        }

        // UI 우선순위: exitWaitLimit > exitWaitMin > 0
        const finalExitWait = exitWaitLimit || exitWaitMin || 0;
        const finalEntryWait = entryWaitLimit || entryWaitMin || 60;
        const startStr = startDate.split('T')[0];
        const endStr = endDate.split('T')[0];

        // [New] 윈도우 따옴표 이슈 방지: 규칙을 임시 JSON 파일로 저장
        let rulesFileArg = '';
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const tempRulesPath = path.join(tempDir, `temp_rules_${Date.now()}.json`);

        if (overrideRules) {
            fs.writeFileSync(tempRulesPath, JSON.stringify(overrideRules, null, 2));
            rulesFileArg = `--rulesFile="${tempRulesPath}"`;
        }

        const targetRoiArg = targetRoi !== undefined ? `--targetRoi=${targetRoi}` : '';
        const slRoiArg = slRoi !== undefined ? `--slRoi=${slRoi}` : '';

        const cmd = `node run_backtest.cjs ${version} --symbol=${symbol} --start=${startStr} --end=${endStr} --leverage=${leverage} --balance=${initialBalance} --exitWaitMin=${finalExitWait} --entryWaitMin=${finalEntryWait} ${targetRoiArg} ${slRoiArg} ${rulesFileArg}`;

        console.log(`[API] Executing: ${cmd}`);

        exec(cmd, { cwd: __dirname, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            const output = stdout.toString();

            // 임시 파일 삭제
            if (fs.existsSync(tempRulesPath)) fs.unlinkSync(tempRulesPath);

            if (error) {
                console.error("[SERVER ERROR]", stderr);
                return res.status(500).json({ success: false, error: error.message, output });
            }

            const jsonMatch = output.match(/###JSON_RESULT###(.*?)###JSON_RESULT###/s);

            if (jsonMatch) {
                try {
                    const rawRes = JSON.parse(jsonMatch[1].trim());
                    res.json({ ...rawRes, detailFile: rawRes.resultFilePath, trades: rawRes.trades || [] });
                } catch (pErr) {
                    res.status(500).json({ success: false, error: "파이널 결과 파싱 실패", output });
                }
            } else {
                res.status(500).json({ success: false, error: "파싱할 JSON 블록을 찾지 못함", output });
            }
        });
    } catch (err) {
        console.error("[CRITICAL API ERROR]", err);
        res.status(500).json({ success: false, error: "서버 내부 오류: " + err.message });
    }
});

// 결과 기록 (JSON + MD 동시 저장)
app.post('/api/save-history', (req, res) => {
    try {
        const { baseVersion, config, rules, result } = req.body;

        if (!baseVersion || !result) {
            return res.status(400).json({ success: false, error: "필수 데이터(baseVersion, result)가 누락되었습니다." });
        }

        let records = [];
        if (fs.existsSync(RECORDS_FILE)) {
            const fileData = fs.readFileSync(RECORDS_FILE, 'utf8');
            if (fileData) records = JSON.parse(fileData);
        }

        // 버전 증량 로직: v7_0_0 또는 v7.0.0 모두 대응
        // baseVersion: Logic.v7.0.0 -> "Logic.7.0.0"
        const cleanBase = baseVersion.replace('Logic.', '').replace('v', '');

        const existingSameBase = records.filter(r => r.baseVersion === baseVersion);
        const nextZ = existingSameBase.length + 1;
        const newVersion = `Record.${cleanBase}.${nextZ}`;

        const newRecord = {
            version: newVersion,
            baseVersion,
            timestamp: new Date().toLocaleString(),
            config,
            rules,
            stats: {
                roi: `${result.roi}%`,
                winRate: `${((result.wins / (result.wins + result.losses || 1)) * 100).toFixed(1)}%`,
                trades: result.wins + result.losses,
                wins: result.wins,
                losses: result.losses,
                period: `${config.startDate.replace('T', ' ')} ~ ${config.endDate.replace('T', ' ')}`,
                initialBalance: config.initialBalance,
                finalBalance: result.finalBalance
            },
            tradesLog: result.trades || [],
            detailFile: result.detailFile
        };

        records.push(newRecord);
        fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));

        // Markdown 추가 기록
        const logEntry = `\n### 📊 Official Record: ${newVersion}\n- ROI: ${result.roi}% | ${result.wins}W/${result.losses}L\n- Params: ${config.symbol} ${config.leverage}x | ${config.initialBalance} -> ${result.finalBalance}\n---\n`;
        fs.appendFileSync(HISTORY_MD, logEntry);

        res.json({ success: true, newVersion, record: newRecord });
    } catch (err) {
        console.error("[SAVE-HISTORY ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 기록 삭제 API (POST로 변경하여 호환성 극대화)
app.post('/api/delete-history', (req, res) => {
    try {
        const { version } = req.body; // POST이므로 body에서 추출
        console.log(`[API] Delete Request for version: "${version}"`);

        if (!fs.existsSync(RECORDS_FILE)) {
            return res.status(404).json({ success: false, error: "기록 파일(records.json)이 없습니다." });
        }

        const fileContent = fs.readFileSync(RECORDS_FILE, 'utf8');
        let records = JSON.parse(fileContent || '[]');
        const initialCount = records.length;

        // 해당 버전 찾기
        const targetRecord = records.find(r => r.version === version);
        if (!targetRecord) {
            console.warn(`[API] Version not found in records: ${version}`);
            return res.status(404).json({ success: false, error: "해당 기록을 찾을 수 없습니다." });
        }

        // 목록에서 제거
        records = records.filter(r => r.version !== version);

        // 파일 업데이트
        fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
        console.log(`[API] Successfully deleted "${version}" from records.json`);

        res.json({ success: true });
    } catch (err) {
        console.error("[API DELETE ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 상세 파일 다운로드 API (CSV 등)
app.get('/api/download', (req, res) => {
    let filePath = req.query.file;
    if (!filePath) return res.status(400).send("파일 경로가 없습니다.");

    // 파일 경로가 백슬래시 등으로 꼬여있을 수 있어 정규화
    filePath = path.normalize(filePath);

    if (fs.existsSync(filePath)) {
        res.download(filePath, path.basename(filePath), (err) => {
            if (err) {
                console.error("[DOWNLOAD ERROR]", err);
                if (!res.headersSent) res.status(500).send("다운로드 중 오류 발생");
            }
        });
    } else {
        console.error(`[404] File not found: ${filePath}`);
        res.status(404).send("파일을 찾을 수 없습니다.");
    }
});

app.post('/api/verify', (req, res) => {
    console.log('[API] Running logic verification...');
    exec('node scripts/verify_logic.cjs', (error, stdout, stderr) => {
        const output = stdout + (stderr ? '\n' + stderr : '');
        res.json({ success: !error, output });
    });
});

app.listen(PORT, () => console.log(`🚀 Enhanced Backtest Server at http://localhost:${PORT}`));
