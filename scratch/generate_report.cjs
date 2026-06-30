const fs = require('fs');
const path = require('path');

const OPT_DIR = path.join(__dirname, '../results/optimization');
const SCRATCH_DIR = __dirname;

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
        
        // 익절률
        if (config.targetRoi !== undefined) {
            parts.push(`익절:${(config.targetRoi * 100).toFixed(0)}%`);
        }
        
        // 5M StochK Threshold (또는 High)
        const stKObj = getVal(config, 'm5_stochKThreshold');
        const stKHighObj = getVal(config, 'm5_stochKHigh');
        const stKValL = stKObj.long !== '-' ? stKObj.long : stKHighObj.long;
        const stKValS = stKObj.short !== '-' ? stKObj.short : stKHighObj.short;
        parts.push(`5M StochK(L/S):${stKValL}/${stKValS}`);

        // 1D Stoch Lmt
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
        
        let winRatePercent = '0.00%';
        if (r.stats.wins !== undefined && r.stats.losses !== undefined) {
            winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        } else if (r.stats.winRate) {
            const numericWinRate = parseFloat(r.stats.winRate);
            winRatePercent = isNaN(numericWinRate) ? r.stats.winRate : numericWinRate.toFixed(2) + '%';
        }

        md += `| ${medal} | ${condSummary} | **${parseFloat(r.stats.roi).toFixed(2)}%** | ${winRatePercent} | ${parseFloat(r.stats.mdd).toFixed(2)}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} | [보기](file:///${OPT_DIR.replace(/\\/g, '/')}/${r.filename}) |\n`;
    });

    md += `\n## 🛡️ 2. 위험 대비 수익 성능 (ROI / MDD 비율) 순위표\n`;
    md += `> MDD(최대 낙폭) 대비 수익 성능을 랭킹화하여 안전하면서 안정적인 파라미터를 추천합니다.\n\n`;
    md += `| 순위 | 조건 요약 | 위험조정 점수 | 총 수익률 | MDD | 거래수 | 최종 잔액 | 상세 링크 |\n`;
    md += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    sortedByRisk.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
        const score = (parseFloat(r.stats.roi) / (parseFloat(r.stats.mdd) || 0.1)).toFixed(2);
        const condSummary = getConditionSummary(r.config);
        
        let winRatePercent = '0.00%';
        if (r.stats.wins !== undefined && r.stats.losses !== undefined) {
            winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        } else if (r.stats.winRate) {
            const numericWinRate = parseFloat(r.stats.winRate);
            winRatePercent = isNaN(numericWinRate) ? r.stats.winRate : numericWinRate.toFixed(2) + '%';
        }

        md += `| ${medal} | ${condSummary} | **${score}** | ${parseFloat(r.stats.roi).toFixed(2)}% | ${parseFloat(r.stats.mdd).toFixed(2)}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} | [보기](file:///${OPT_DIR.replace(/\\/g, '/')}/${r.filename}) |\n`;
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
        
        let winRatePercent = '0.00%';
        if (r.stats.wins !== undefined && r.stats.losses !== undefined) {
            winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        } else if (r.stats.winRate) {
            const numericWinRate = parseFloat(r.stats.winRate);
            winRatePercent = isNaN(numericWinRate) ? r.stats.winRate : numericWinRate.toFixed(2) + '%';
        }

        summaryMd += `| ${medal} | ${r.filename} | ${m5Adx} | ${m5Macd} | ${m5StLmt} | ${m5StVal} | ${h1Adx} | ${h1Macd} | ${h1StLmt} | ${d1Adx} | ${d1Macd} | ${d1StLmt} | ${roiVal} | **${parseFloat(r.stats.roi).toFixed(2)}%** | ${winRatePercent} | ${parseFloat(r.stats.mdd).toFixed(2)}% | ${r.stats.trades}회 | $${Math.floor(r.stats.finalBalance)} |\n`;
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
        
        let winRatePercent = '0.00%';
        if (r.stats.wins !== undefined && r.stats.losses !== undefined) {
            winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        } else if (r.stats.winRate) {
            const numericWinRate = parseFloat(r.stats.winRate);
            winRatePercent = isNaN(numericWinRate) ? r.stats.winRate : numericWinRate.toFixed(2) + '%';
        }
        
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

        let winRatePercent = '0.00%';
        if (r.stats.wins !== undefined && r.stats.losses !== undefined) {
            winRatePercent = r.stats.wins + r.stats.losses > 0 ? ((r.stats.wins / (r.stats.wins + r.stats.losses)) * 100).toFixed(2) + '%' : '0.00%';
        } else if (r.stats.winRate) {
            const numericWinRate = parseFloat(r.stats.winRate);
            winRatePercent = isNaN(numericWinRate) ? r.stats.winRate : numericWinRate.toFixed(2) + '%';
        }

        let block = `\n### 🏆 [${rank}위] - 수익률 ${parseFloat(r.stats.roi).toFixed(2)}% (MDD ${parseFloat(r.stats.mdd).toFixed(2)}%, 승률 ${winRatePercent}, 거래수 ${r.stats.trades}회)\n\n`;
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

function main() {
    console.log(`🤖 Reading files from: ${OPT_DIR}`);
    if (!fs.existsSync(OPT_DIR)) {
        console.error(`❌ Optimization directory does not exist: ${OPT_DIR}`);
        return;
    }

    const files = fs.readdirSync(OPT_DIR);
    const results = [];

    files.forEach(file => {
        if (file.endsWith('.json') && !file.includes('summary') && !file.includes('report')) {
            try {
                const filePath = path.join(OPT_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                results.push(data);
            } catch (err) {
                console.error(`❌ Failed to parse file: ${file}`, err.message);
            }
        }
    });

    console.log(`🤖 Collected ${results.length} results. Generating reports...`);
    generateMarkdownReport(results);
}

main();
