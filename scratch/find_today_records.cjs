const fs = require('fs');

const recordsPath = 'c:/dev/2026_candy/records.json';
if (!fs.existsSync(recordsPath)) {
    console.error("records.json not found!");
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    console.log("Total records in records.json:", data.length);
    
    // 2026년 6월 5일 오후 10시 이후 (10시 = 22:00)
    // timestamp 형식이 "2026. 6. 5. PM 10:09:39" 와 같은 형식인지 검사
    const targetDate = "2026. 6. 5.";
    
    const matched = [];
    data.forEach((r, idx) => {
        if (r.timestamp && r.timestamp.includes(targetDate)) {
            // "PM 10:" 또는 "PM 11:" 등으로 시작하는 것 필터링
            // timestamp 예시: "2026. 6. 5. PM 10:09:39"
            const timePart = r.timestamp.split(' ').pop(); // "PM 10:09:39"
            if (r.timestamp.includes('PM 10:') || r.timestamp.includes('PM 11:') || r.timestamp.includes('22:') || r.timestamp.includes('23:')) {
                matched.push({
                    index: idx,
                    version: r.version,
                    timestamp: r.timestamp
                });
            }
        }
    });

    console.log("=== MATCHED RECORDS (After 10:00 PM today) ===");
    if (matched.length === 0) {
        console.log("No records found.");
        // 샘플로 최근 5개 타임스탬프 출력해서 포맷 확인
        console.log("Last 5 records timestamps:");
        data.slice(-5).forEach(r => console.log(`- Version: ${r.version}, Timestamp: ${r.timestamp}`));
    } else {
        matched.forEach(m => {
            console.log(`- Index: ${m.index}, Version: ${m.version}, Timestamp: ${m.timestamp}`);
        });
    }

} catch (e) {
    console.error("Error reading/parsing:", e.message);
}
