const fs = require('fs');
const path = require('path');

const RECORDS_FILE = path.join(__dirname, 'records.json');

function verifyRecords() {
    if (!fs.existsSync(RECORDS_FILE)) {
        console.error("Error: records.json not found.");
        return;
    }

    const records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
    console.log(`\n=== Backtest Data Verification Audit (${new Date().toLocaleString()}) ===`);
    console.log(`Total records to verify: ${records.length}\n`);

    let totalPass = 0;
    let totalFail = 0;

    records.forEach((record, index) => {
        const { version, stats, config, tradesLog } = record;
        const initialBalance = config.initialBalance || 1000;
        
        let calculatedBalance = initialBalance;
        let calculatedWins = 0;
        let calculatedLosses = 0;

        tradesLog.forEach(trade => {
            const profit = parseFloat(trade.netProfit || 0);
            calculatedBalance += profit;
            if (profit > 0) calculatedWins++;
            else if (profit < 0) calculatedLosses++;
            // Note: 0 profit (breakeven) is often counted as a loss or neutral, 
            // but in my previous server logic: winRate: (wins / (wins + losses || 1))
            // Let's see how I define wins/losses in server.cjs
        });

        const finalBalanceDiff = Math.abs(calculatedBalance - stats.finalBalance);
        const winMismatch = calculatedWins !== stats.wins;
        const lossMismatch = calculatedLosses !== stats.losses;
        
        const isPass = finalBalanceDiff < 0.01 && !winMismatch && !lossMismatch;

        if (isPass) {
            totalPass++;
            console.log(`✅ [PASS] ${version.padEnd(20)} | Bal: ${calculatedBalance.toFixed(2).padStart(10)} | W/L: ${calculatedWins}/${calculatedLosses}`);
        } else {
            totalFail++;
            console.log(`❌ [FAIL] ${version.padEnd(20)}`);
            if (finalBalanceDiff >= 0.01) {
                console.log(`   - Balance Mismatch: Expected ${stats.finalBalance.toFixed(2)}, Calculated ${calculatedBalance.toFixed(2)} (Diff: ${finalBalanceDiff.toFixed(4)})`);
            }
            if (winMismatch) {
                console.log(`   - Wins Mismatch: Expected ${stats.wins}, Calculated ${calculatedWins}`);
            }
            if (lossMismatch) {
                console.log(`   - Losses Mismatch: Expected ${stats.losses}, Calculated ${calculatedLosses}`);
            }
        }
    });

    console.log(`\n=== Audit Summary ===`);
    console.log(`Total: ${records.length}`);
    console.log(`Pass : ${totalPass}`);
    console.log(`Fail : ${totalFail}`);
    
    if (totalFail === 0) {
        console.log(`\n✨ All records are mathematically consistent with their trade logs.`);
    } else {
        console.log(`\n⚠️ Warning: ${totalFail} records have mathematical inconsistencies.`);
    }
}

verifyRecords();
