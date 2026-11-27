/**
 * Merge the lecture's "표현 따라읽기" into local encrypted-source units.
 * Run from the My Study project; plaintext stays under ignored private/.
 * Existing grammar guides, slides, audio, exercises and other subjects are untouched.
 */
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'private/french-grammar-readings.json');
const targetDir = join(root, 'private/data/french-basic-grammar');
const data = JSON.parse(await readFile(source, 'utf8'));
if (data.schemaVersion !== 1 || data.subject !== 'french-basic-grammar') {
  throw new Error('표현 따라읽기 데이터의 형식이 올바르지 않습니다.');
}

const changes = [];
let groupCount = 0;
let sentenceCount = 0;
for (let i = 1; i <= 15; i++) {
  const key = String(i).padStart(2, '0');
  const file = join(targetDir, `unit-${key}.json`);
  const rows = data.units?.[key];
  if (!Array.isArray(rows) || rows.length !== 10) throw new Error(`${i}강: 표현 10묶음이 아닙니다.`);
  for (let n = 0; n < rows.length; n++) {
    const row = rows[n];
    if (row.number !== n + 1 || !Number.isInteger(row.sourcePage) || !Array.isArray(row.lines) || !row.lines.length) {
      throw new Error(`${i}강 ${n + 1}번: 순서 또는 문장 목록 오류`);
    }
    for (const line of row.lines) {
      if (typeof line.fr !== 'string' || !line.fr.trim() || typeof line.ko !== 'string' || !line.ko.trim()) {
        throw new Error(`${i}강 ${n + 1}번: 프랑스어 또는 번역 누락`);
      }
      sentenceCount++;
    }
    groupCount++;
  }
  const unit = JSON.parse(await readFile(file, 'utf8'));
  if (Number(unit.unit) !== i) throw new Error(`${file}: 강의 번호 불일치`);
  if (JSON.stringify(unit.expressionReading) === JSON.stringify(rows)) continue;
  changes.push({file, unit: {...unit, expressionReading: rows}});
}

if (!changes.length) {
  console.log(`이미 최신 상태입니다: ${groupCount}묶음 · ${sentenceCount}문장. 기존 파일은 변경하지 않았습니다.`);
  process.exit(0);
}

const backupDir = join(root, 'private/backups', `french-grammar-before-readings-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(backupDir, {recursive: true});
for (const {file} of changes) await copyFile(file, join(backupDir, file.split('/').at(-1)));

const written = [];
try {
  for (const {file, unit} of changes) {
    const tmp = `${file}.tmp-${process.pid}`;
    try {
      await writeFile(tmp, JSON.stringify(unit, null, 2) + '\n', {flag:'wx', mode:0o600});
      await rename(tmp, file);
      written.push(file);
    } catch (error) {
      await import('node:fs/promises').then(fs => fs.rm(tmp, {force:true}));
      throw error;
    }
  }
} catch (error) {
  for (const file of written) {
    await copyFile(join(backupDir, file.split('/').at(-1)), file);
  }
  throw error;
}
console.log(`표현 따라읽기 적용 완료: ${groupCount}묶음 · ${sentenceCount}문장 · 수정된 강의 ${changes.length}개`);
console.log('원본 JSON 백업 위치: private/backups/ (Git 업로드 제외)');
console.log('다음: npm run encrypt → npm run dev (기존 입장 코드 사용)');
