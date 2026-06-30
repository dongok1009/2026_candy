const fs = require('fs');
const path = require('path');

const recordsPath = 'c:/dev/2026_candy/records.json';
if (!fs.existsSync(recordsPath)) {
    console.error("records.json not found!");
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    const r = data.find(item => item.version === 'Record.8.2.3.26');
    if (!r) {
        console.log("Record.8.2.3.26 not found.");
        // Print the last 10 versions instead
        console.log("Recent versions:", data.slice(-10).map(x => x.version));
        process.exit(0);
    }
    
    console.log("=== Record.8.2.3.26 Rules ===");
    console.log(JSON.stringify(r.rules, null, 2));
    console.log("=== Record.8.2.3.26 Config ===");
    console.log(JSON.stringify(r.config, null, 2));
} catch (e) {
    console.error("Error reading/parsing:", e.message);
}

