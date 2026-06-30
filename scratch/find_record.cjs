const fs = require('fs');
const path = require('path');

const recordsPath = 'c:/dev/2026_candy/records.json';
if (!fs.existsSync(recordsPath)) {
    console.error("records.json not found!");
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    // Exact or loose search
    const record = data.find(r => r.version === 'Record.7.0.4.10' || r.version.includes('7.0.4.10'));
    if (record) {
        console.log("=== RECORD FOUND ===");
        console.log("Version:", record.version);
        console.log("Timestamp:", record.timestamp);
        console.log("Config:", JSON.stringify(record.config, null, 2));
        console.log("Rules:", JSON.stringify(record.rules, null, 2));
        console.log("Stats:", JSON.stringify(record.stats, null, 2));
    } else {
        console.log("Record NOT FOUND in records.json.");
        // Print some versions in the file to see the format
        console.log("Sample versions in file:");
        data.slice(0, 10).forEach(r => console.log("-", r.version));
    }
} catch (e) {
    console.error("Error reading/parsing:", e.message);
}
