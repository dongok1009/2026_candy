const fs = require('fs');
const path = require('path');

const recordsPath = 'c:/dev/2026_candy/records.json';
// Find the exact CSV file created by task-107 in c:/dev/2026_candy/results/
const resultsDir = 'c:/dev/2026_candy/results';
const csvFiles = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('result_Logic.v7.0.4') && f.endsWith('.csv'))
    .map(f => ({ name: f, time: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

if (csvFiles.length === 0) {
    console.error("No CSV files found in results!");
    process.exit(1);
}

const latestCsvPath = path.join(resultsDir, csvFiles[0].name);
console.log("Comparing against latest CSV:", latestCsvPath);

try {
    const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    const oldRecord = records.find(r => r.version === 'Record.7.0.4.10');
    if (!oldRecord) {
        console.error("Record.7.0.4.10 not found in records.json!");
        process.exit(1);
    }
    const oldTrades = oldRecord.tradesLog;

    // Read CSV
    const csvContent = fs.readFileSync(latestCsvPath, 'utf8');
    const csvRows = csvContent.split('\n').filter(r => r.trim().length > 0);
    // Remove header row
    const header = csvRows[0];
    const csvTrades = [];
    
    // Parse CSV rows (header: entryTime,exitTime,balance,cumRoi,side,entryBasis,entryPrice,exitPrice,netProfit,roe...)
    for (let i = 1; i < csvRows.length; i++) {
        const cols = csvRows[i].split(',');
        csvTrades.push({
            entryTime: cols[0],
            exitTime: cols[1],
            balance: parseFloat(cols[2]),
            side: cols[4],
            entryPrice: parseFloat(cols[6]),
            exitPrice: parseFloat(cols[7]),
            netProfit: parseFloat(cols[8]),
            exitReason: cols[9] // wait, columns index may shift, let's map carefully
        });
    }

    console.log(`Old Trades Count: ${oldTrades.length}`);
    console.log(`New Trades Count: ${csvTrades.length}`);

    console.log("\n--- Comparison of First 15 Trades ---");
    for (let i = 0; i < Math.min(oldTrades.length, csvTrades.length, 15); i++) {
        const ot = oldTrades[i];
        const nt = csvTrades[i];
        console.log(`Trade #${i+1}:`);
        console.log(`  Old: ${ot.entryTime} ~ ${ot.exitTime} | Side: ${ot.side} | Entry: ${ot.entryPrice} | Exit: ${ot.exitPrice} | NetProfit: ${ot.netProfit} | Bal: ${ot.balance}`);
        console.log(`  New: ${nt.entryTime} ~ ${nt.exitTime} | Side: ${nt.side} | Entry: ${nt.entryPrice} | Exit: ${nt.exitPrice} | NetProfit: ${nt.netProfit} | Bal: ${nt.balance}`);
        if (ot.entryTime !== nt.entryTime || ot.exitTime !== nt.exitTime) {
            console.log(`  ❌ DIVERGED HERE!`);
        }
    }

    console.log("\nSearching for first mismatch...");
    let divergedIndex = -1;
    for (let i = 0; i < Math.min(oldTrades.length, csvTrades.length); i++) {
        const ot = oldTrades[i];
        const nt = csvTrades[i];
        if (ot.entryTime !== nt.entryTime || ot.exitTime !== nt.exitTime || parseFloat(ot.entryPrice) !== parseFloat(nt.entryPrice)) {
            divergedIndex = i;
            break;
        }
    }

    if (divergedIndex !== -1) {
        console.log(`\n❌ First divergence at Trade #${divergedIndex+1}:`);
        const ot = oldTrades[divergedIndex];
        const nt = csvTrades[divergedIndex];
        console.log(`  Old: ${ot.entryTime} ~ ${ot.exitTime} | ${ot.side} | Entry: ${ot.entryPrice} | Exit: ${ot.exitPrice} | NetProfit: ${ot.netProfit} | Balance: ${ot.balance}`);
        console.log(`  New: ${nt.entryTime} ~ ${nt.exitTime} | ${nt.side} | Entry: ${nt.entryPrice} | Exit: ${nt.exitPrice} | NetProfit: ${nt.netProfit} | Balance: ${nt.balance}`);
        
        // Let's also check if there is an off-by-one missing trade
        console.log("\nAdjacent Old Trades around divergence:");
        for(let j=Math.max(0, divergedIndex-1); j<Math.min(oldTrades.length, divergedIndex+3); j++){
            const t = oldTrades[j];
            console.log(`  Old Trade #${j+1}: ${t.entryTime} ~ ${t.exitTime} | ${t.side} | Entry: ${t.entryPrice}`);
        }
        console.log("Adjacent New Trades around divergence:");
        for(let j=Math.max(0, divergedIndex-1); j<Math.min(csvTrades.length, divergedIndex+3); j++){
            const t = csvTrades[j];
            console.log(`  New Trade #${j+1}: ${t.entryTime} ~ ${t.exitTime} | ${t.side} | Entry: ${t.entryPrice}`);
        }
    } else {
        console.log("No mismatch found in matched lengths!");
    }

} catch (e) {
    console.error("Comparison Error:", e.message);
    console.error(e.stack);
}
