import assert from 'node:assert/strict';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const privateRoot = await realpath(resolve(root, 'private'));
const base = resolve(privateRoot, 'data/computer-architecture');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const expectedPages = [39,44,53,28,27,30,29,38,39,37,39,33,30,32,51];
let pages = 0, practice = 0, concepts = 0, formulas = 0;
async function pageFile(meta) {
  assert.match(meta.path, /^data\/computer-architecture\/[a-z0-9_/-]+\.json$/);
  const path = await realpath(resolve(privateRoot, meta.path));
  assert.ok(path.startsWith(privateRoot + sep), 'Page must remain private');
  const data = await json(path);
  assert.equal(typeof data.text, 'string');
  assert.ok(data.width > 0 && data.height > 0);
  assert.match(data.image, /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);
  const bytes = Buffer.from(data.image.split(',')[1], 'base64');
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, 'JPEG end marker');
}
for (let n = 1; n <= 15; n++) {
  const u = await json(resolve(base, `unit-${String(n).padStart(2, '0')}.json`));
  assert.equal(u.schemaVersion, 1); assert.equal(u.type, 'theory'); assert.equal(u.number, n);
  assert.equal(u.source.pageCount, expectedPages[n - 1]);
  assert.match(u.source.sha256, /^[a-f0-9]{64}$/);
  assert.ok(!/[\/\\]/.test(u.source.file), 'Source name must be a filename');
  const source = await readFile(resolve(privateRoot, 'sources/computer-architecture', u.source.file));
  assert.equal(createHash('sha256').update(source).digest('hex'), u.source.sha256, 'Original PDF checksum');
  assert.equal(u.pages.length, u.source.pageCount);
  assert.ok(u.reviewNotice);
  const refs = item => {
    assert.ok(item.sourcePages?.length);
    for (const p of item.sourcePages) assert.ok(Number.isInteger(p) && p > 0 && p <= u.source.pageCount, `Unit ${n}: bad reference ${p}`);
  };
  for (const [i, p] of u.pages.entries()) {
    assert.equal(p.page, i + 1); assert.equal(typeof p.searchText, 'string');
    await pageFile(p);
    const stored = await json(resolve(privateRoot, p.path));
    assert.equal(stored.text, p.searchText, 'Page mapping and searchable text must match');
    pages++;
  }
  for (const section of u.sections) assert.ok(section.startPage > 0 && section.startPage <= u.source.pageCount);
  for (const c of u.concepts) {
    for (const k of ['ko','en','definition','difference']) assert.ok(typeof c[k] === 'string' && c[k].length);
    refs(c); concepts++;
  }
  for (const f of [...u.formulas, ...u.supplements, ...u.summary, ...(u.detailedTheory ?? [])]) {
    refs(f);
    if (f.table) {
      assert.ok(f.table.headers.length > 0);
      for (const row of f.table.rows) assert.equal(row.length, f.table.headers.length);
    }
  }
  formulas += u.formulas.length;
  const ids = new Set();
  for (const q of u.practice) {
    assert.ok(!ids.has(q.id)); ids.add(q.id);
    assert.equal(q.sourceKind, 'ai'); assert.equal(q.type, 'choice');
    assert.ok(q.prompt && q.explanation);
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.every(x => typeof x === 'string' && x.length));
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    assert.equal(q.optionExplanations.length, 4); assert.ok(q.optionExplanations.every(Boolean));
    refs(q); practice++;
  }
}
const bank = await json(resolve(base, 'question-bank.json'));
assert.equal(bank.exams.length, 6);
for (const exam of bank.exams) {
  assert.equal(exam.semester, 2); assert.ok([2017,2018,2019].includes(exam.year));
  assert.equal(exam.officialAnswers.length, exam.type === '기말시험' ? 35 : 15);
  assert.ok(exam.officialAnswers.every(a => [1,2,3,4].includes(a)));
  for (const p of exam.pages) await pageFile(p);
}
const subject = await json(resolve(privateRoot, 'computer-architecture-subject.json'));
assert.equal(subject.type, 'theory'); assert.equal(subject.unitCount, 15);
assert.deepEqual(subject.availableUnits, Array.from({length:15}, (_,i) => i + 1));
// Build output must never contain the plaintext inputs or original PDFs.
for (const path of ['private', 'data', 'sources']) {
  await stat(resolve(root, 'dist', path)).then(() => assert.fail(`Private output exists: ${path}`), error => { if (error.code !== 'ENOENT') throw error; });
}
console.log(`PASS: 15 units, ${pages} source pages, ${concepts} concepts, ${formulas} formula notes, ${practice} practice questions, 6 original exams.`);
console.log('Schema and reference checks passed. This does not certify complete academic or visual review.');
