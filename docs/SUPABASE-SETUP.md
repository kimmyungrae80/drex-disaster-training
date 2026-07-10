# Supabase 테이블 설정 가이드

## 1. 테이블 생성

Supabase 콘솔 SQL Editor에서 다음을 실행하세요:

```sql
-- 안전한국훈련 컨설팅보고서 메타데이터 테이블
CREATE TABLE IF NOT EXISTS training_consulting_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  extension TEXT,
  doc_type TEXT,
  institution TEXT,
  year INT,
  size_kb NUMERIC,
  modified_date DATE,
  is_duplicate BOOLEAN DEFAULT false,
  source_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_institution ON training_consulting_reports(institution);
CREATE INDEX IF NOT EXISTS idx_doc_type ON training_consulting_reports(doc_type);
CREATE INDEX IF NOT EXISTS idx_year ON training_consulting_reports(year);

-- Row Level Security
ALTER TABLE training_consulting_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_training_reports
  ON training_consulting_reports FOR ALL USING (true) WITH CHECK (true);
```

## 2. 데이터 업로드

다음 명령어를 실행하세요:

```bash
cd ~/safekorea-downloader
node << 'EOF'
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const iconv = require('iconv-lite');

const SUPABASE_URL = "https://jouasqnsbxbikvjrrfnd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdWFzcW5zYnhiaWt2anJyZm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwNTUwOSwiZXhwIjoyMDkyMjgxNTA5fQ.rBFL_cLnmJGFfhBQIlu4mSEWTx6cHN_DDrMoZKjYM2w";
const CSV_PATH = path.join(process.env.HOME, 'safe_korea_training_file_inventory.csv');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function readCSV() {
  const buffer = fs.readFileSync(CSV_PATH);
  const text = iconv.decode(buffer, 'euc-kr');
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const record = {};
    let values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"' && (j === 0 || lines[i][j-1] !== '\\')) inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
      else current += char;
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    headers.forEach((h, idx) => { record[h] = values[idx] || ''; });
    results.push(record);
  }
  return results;
}

function normalizeData(records) {
  return records.map(record => ({
    filename: record['filename'] || '',
    extension: record['extension'] || '',
    doc_type: record['doc_type'] || '',
    institution: record['institution_guess'] || '',
    year: record['year'] ? parseInt(record['year']) : null,
    size_kb: record['size_kb'] ? parseFloat(record['size_kb']) : 0,
    modified_date: record['modified_date'] || null,
    is_duplicate: record['duplicate_candidate'] === 'Y',
    source_path: record['relative_path'] || '',
  })).filter(r => r.filename);
}

async function main() {
  console.log('📖 CSV 읽는 중...');
  const rawData = readCSV();
  const data = normalizeData(rawData);
  console.log(`✅ ${data.length}건 준비됨\n`);

  console.log('📤 Supabase 업로드 중...');
  const chunkSize = 50;
  let uploaded = 0;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const { error } = await supabase.from('training_consulting_reports').insert(chunk);
    if (error) {
      console.error(`❌ 청크 ${i} 실패:`, error.message);
      break;
    }
    uploaded += chunk.length;
    process.stdout.write(`\r  진행: ${uploaded}/${data.length}`);
  }
  console.log(`\n✅ 완료: ${uploaded}건`);
}

main();
EOF
```

## 3. 확인

Supabase 콘솔에서 다음을 실행하여 데이터 확인:

```sql
SELECT COUNT(*) as total, COUNT(DISTINCT institution) as institutions 
FROM training_consulting_reports;
```
