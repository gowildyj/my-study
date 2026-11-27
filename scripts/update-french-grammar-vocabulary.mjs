/**
 * Restore EVERY row from the lecture's "주요 어휘 따라읽기" table for all 15 lessons.
 * Keep existing vocabulary, readings, guides, slides, exercises and audio untouched.
 * Plaintext is written only under git-ignored private/.
 */
import { readFile, writeFile, mkdir, copyFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataFile = join(root, 'private/french-grammar-vocabulary.json');
const dataDir = join(root, 'private/data/french-basic-grammar');
const payload = JSON.parse(await readFile(dataFile, 'utf8'));
const expected = [10, 14, 27, 15, 32, 34, 18, 18, 35, 21, 37, 27, 21, 27, 16];
if (payload.schemaVersion !== 1 || payload.subject !== 'french-basic-grammar') {
  throw new Error('원본 주요 어휘 데이터의 형식이 잘못되었습니다.');
}

const changes = [];
const summary = [];
for (let unitNo = 1; unitNo <= 15; unitNo++) {
  const key = String(unitNo).padStart(2, '0');
  const input = payload.units?.[key];
  if (!Array.isArray(input) || input.length !== expected[unitNo - 1]) {
    throw new Error(`${unitNo}강: 주요 어휘 수가 원본 검수 결과와 다릅니다.`);
  }
  const rows = input.map((row, idx) => {
    if (!row || !['fr', 'ko', 'partOfSpeech'].every(field => typeof row[field] === 'string' && row[field].trim()) ||
        !Number.isInteger(row.sourcePage) || row.sourcePage < 1 || row.sourcePage > 100) {
      throw new Error(`${unitNo}강 ${idx + 1}번째 어휘: 단어·품사·뜻·원본 페이지 누락`);
    }
    return {fr: row.fr, ko: row.ko, partOfSpeech: row.partOfSpeech, sourcePage: row.sourcePage};
  });
  const file = join(dataDir, `unit-${key}.json`);
  const unit = JSON.parse(await readFile(file, 'utf8'));
  if (Number(unit.unit) !== unitNo || !Array.isArray(unit.slides)) {
    throw new Error(`${unitNo}강: 학습 데이터 또는 원본 슬라이드가 올바르지 않습니다.`);
  }
  for (const row of rows) {
    if (row.sourcePage > unit.slides.length) {
      throw new Error(`${unitNo}강 ${row.fr}: 원본 페이지가 유효하지 않습니다.`);
    }
  }
  summary.push({unit:unitNo, count:rows.length, additional:unit.vocabulary?.length ?? 0});
  if (JSON.stringify(unit.vocabularyReading) !== JSON.stringify(rows)) {
    changes.push({file, updated:{...unit, vocabularyReading:rows}});
  }
}
if (summary.reduce((s,r)=>s+r.count,0) !== 352) throw new Error('원본 어휘 352개 검수 실패');
if (!changes.length) {
  console.log('이미 최신 상태입니다. 주요 어휘 따라읽기 352개 · 전체 15강.');
  process.exit(0);
}

const backupDir = join(root, 'private/backups', `french-grammar-before-full-vocabulary-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(backupDir, {recursive:true});
for (const {file} of changes) await copyFile(file, join(backupDir, file.split('/').at(-1)));
const written = [];
try {
  for (const {file, updated} of changes) {
    const tmp = `${file}.tmp-${process.pid}`;
    try {
      await writeFile(tmp, JSON.stringify(updated, null, 2)+'\n', {flag:'wx', mode:0o600});
      await rename(tmp, file);
      written.push(file);
    } catch (error) {
      await rm(tmp, {force:true});
      throw error;
    }
  }
} catch(error) {
  for (const file of written) await copyFile(join(backupDir, file.split('/').at(-1)), file);
  throw error;
}
console.table(summary);
console.log(`원본 어휘 352개 복구 완료 · 수정 ${changes.length}강`);
console.log('기존 vocabulary, expressionReading, guide, conjugations, slides, exercises는 그대로 유지했습니다.');
console.log('수정 전 원본 JSON 백업: private/backups/');
console.log('다음: npm run encrypt → npm run dev');
