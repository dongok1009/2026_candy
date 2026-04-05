const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const RECORDS_FILE = path.join(__dirname, 'records.json');
const HISTORY_MD = path.join(__dirname, 'BACKTEST_HISTORY.md');

// 기록 불러오기 API
app.get('/api/list-history', (req, res) => {
    if (!fs.existsSync(RECORDS_FILE)) return res.json([]);
    const data = fs.readFileSync(RECORDS_FILE, 'utf8');
    res.json(JSON.parse(data));
});

// 백테스트 실행 API
app.post('/api/backtest', (req, res) => {
    const { version, symbol, startDate, endDate, leverage, initialBalance, overrideRules, exitWaitMin, entryWaitMin } = req.body;
    const startStr = startDate.split('T')[0];
    const endStr = endDate.split('T')[0];

    // [New] 윈도우 따옴표 이슈 방지: 규칙을 임시 JSON 파일로 저장
    let rulesFileArg = '';
    const tempRulesPath = path.join(__dirname, `temp_rules_${Date.now()}.json`);
    
    if (overrideRules) {
        fs.writeFileSync(tempRulesPath, JSON.stringify(overrideRules, null, 2));
        rulesFileArg = `--rulesFile="${tempRulesPath}"`;
    }

    const cmd = `node run_backtest.cjs ${version} --symbol=${symbol} --start=${startStr} --end=${endStr} --leverage=${leverage} --balance=${initialBalance} --exitWaitMin=${exitWaitMin || 0} --entryWaitMin=${entryWaitMin || 60} ${rulesFileArg}`;
    
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
});

// 결과 기록 (JSON + MD 동시 저장)
app.post('/api/save-history', (req, res) => {
    const { baseVersion, config, rules, result } = req.body;
    
    let records = [];
    if (fs.existsSync(RECORDS_FILE)) {
        records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
    }

    // 버전 증량 로직: v7_0_0 또는 v7.0.0 모두 대응
    const cleanVersion = baseVersion.replace('v', '');
    const baseParts = cleanVersion.includes('_') ? cleanVersion.split('_') : cleanVersion.split('.');
    const major = isNaN(Number(baseParts[0])) ? 7 : Number(baseParts[0]);
    const minor = isNaN(Number(baseParts[1])) ? 0 : Number(baseParts[1]);
    
    const existingSameBase = records.filter(r => r.baseVersion === baseVersion);
    const nextZ = existingSameBase.length + 1;
    const cleanBase = baseVersion.replace('Logic.', '');
    const newVersion = `Record.${cleanBase}.${nextZ}`;
    
    const newRecord = {
        version: newVersion,
        baseVersion,
        timestamp: new Date().toISOString(),
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
});

// 기록 삭제 API
app.delete('/api/delete-history', (req, res) => {
    const { version } = req.query;
    if (!fs.existsSync(RECORDS_FILE)) return res.status(404).json({ success: false, error: "기록 파일이 없습니다." });
    
    let records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
    const initialCount = records.length;
    records = records.filter(r => r.version !== version);
    
    if (records.length === initialCount) {
        return res.status(404).json({ success: false, error: "해당 버전을 찾을 수 없습니다." });
    }
    
    console.log(`[API] Deleting version: ${version}`);
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
    res.json({ success: true });
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

app.listen(PORT, () => console.log(`🚀 Enhanced Backtest Server at http://localhost:${PORT}`));
