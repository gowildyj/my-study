import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const root = fileURLToPath(new URL('../', import.meta.url));
const raw = join(root, 'private');
const vault = join(root, 'vault');
const tmp = join(root, `vault.tmp-${process.pid}`);
const lockDir = join(root, 'vault.tmp-lock');
const iterations = 600000;
const args = process.argv.slice(2);
const rotate = args.includes('--rotate');
const prune = args.includes('--prune');

async function prompt(label) {
  if (!process.stdin.isTTY) throw new Error('터미널에서 실행하거나 MY_STUDY_PASSWORD 환경변수를 사용하세요.');
  process.stdout.write(label);
  const muted = new Writable({write(_chunk, _enc, cb) { cb(); }});
  const r = createInterface({input:process.stdin,output:muted,terminal:true});
  try { return await r.question(''); }
  finally { r.close(); process.stdout.write('\n'); }
}

async function walk(dir, prefix, encrypted = false, optional = false) {
  let entries;
  try { entries = await readdir(dir, {withFileTypes:true}); }
  catch (error) { if (optional && error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && /^[a-z0-9_-]+$/i.test(entry.name)) {
      result.push(...await walk(join(dir,entry.name),`${prefix}/${entry.name}`,encrypted));
    } else if (entry.isFile()) {
      const name = encrypted && entry.name.endsWith('.enc') ? entry.name.slice(0,-4) : entry.name;
      const path = `${prefix}/${name}`;
      if (!/^(data\/[a-z0-9_/-]+\.json|audio\/[a-z0-9_/-]+\.mp3)$/i.test(path) || (encrypted && !entry.name.endsWith('.enc'))) {
        throw new Error(`지원하지 않는 파일: ${prefix}/${entry.name}`);
      }
      result.push(path);
    } else throw new Error(`지원하지 않는 경로: ${prefix}/${entry.name}`);
  }
  return result.sort();
}

function decrypt(bytes, key, path) {
  if (bytes.length < 28) throw new Error('암호문 길이 오류');
  const decoder = createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  decoder.setAAD(Buffer.from(`my-study:v1:${path}`));
  decoder.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decoder.update(bytes.subarray(12,-16)),decoder.final()]);
}
function encrypt(plain, key, path, usedNonces) {
  let iv;
  do { iv = randomBytes(12); } while (usedNonces.has(iv.toString('hex')));
  usedNonces.add(iv.toString('hex'));
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(`my-study:v1:${path}`));
  const body = Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([iv,body,cipher.getAuthTag()]);
}
async function oldManifest() {
  let bytes;
  try { bytes = await readFile(join(vault,'manifest.json')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await readdir(vault); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    throw new Error('기존 vault에 manifest.json이 없습니다. 원본을 백업하고 확인하세요.');
  }
  const meta = JSON.parse(bytes.toString('utf8'));
  const salt = Buffer.from(meta.salt ?? '', 'base64');
  if (meta.version !== 1 || meta.kdf !== 'PBKDF2-SHA256' || meta.iterations !== iterations || salt.length !== 16) {
    throw new Error('기존 암호화 형식을 지원하지 않습니다.');
  }
  return {bytes, salt};
}

async function main() {
  if (args.some(arg => !['--rotate','--prune'].includes(arg))) throw new Error('사용법: npm run encrypt [-- --rotate] [-- --prune]');
  let password = process.env.MY_STUDY_PASSWORD;
  if (password === undefined) {
    password = await prompt(rotate ? '새 입장 코드 (16자 이상): ' : '입장 코드 (16자 이상): ');
    if (password !== await prompt('입장 코드 확인: ')) throw new Error('입장 코드가 일치하지 않습니다.');
  }
  if (password.length < 16) throw new Error('16자 이상의 강력한 입장 코드를 사용하세요.');
  const subjects = JSON.parse(await readFile(join(raw,'data/subjects.json'),'utf8'));
  if (!Array.isArray(subjects) || !subjects.length) throw new Error('subjects.json이 비어 있습니다.');
  const paths = [...await walk(join(raw,'data'),'data'), ...await walk(join(raw,'audio'),'audio',false,true)].sort();
  try { await mkdir(lockDir); } catch (e) { if(e.code === 'EEXIST') throw new Error('암호화 작업이 이미 진행 중이거나 이전 잠금이 남아 있습니다. 다른 작업이 없는지 확인하세요.'); throw e; }
  let key;
  try {
    const previous = await oldManifest();
    const existing = new Set(previous ? [...await walk(join(vault,'data'),'data',true,true), ...await walk(join(vault,'audio'),'audio',true,true)] : []);
    const sourceSet = new Set(paths);
    const removed = [...existing].filter(path => !sourceSet.has(path));
    if (removed.length && !prune) throw new Error(`원본이 없는 기존 자료 ${removed.length}개가 있습니다. 원본을 복구하거나 의도적 삭제라면 --prune 옵션을 사용하세요.`);
    const reuse = previous && !rotate;
    const salt = reuse ? previous.salt : randomBytes(16);
    key = pbkdf2Sync(password,salt,iterations,32,'sha256');
    password = '';
    if (reuse) {
      try { const catalog = JSON.parse(decrypt(await readFile(join(vault,'data/subjects.json.enc')),key,'data/subjects.json').toString('utf8')); if (!Array.isArray(catalog)) throw new Error('과목 목록 오류'); }
      catch { throw new Error('기존 입장 코드가 다르거나 과목 목록이 손상되었습니다. 기존 코드를 사용하세요. 의도적인 비밀번호 변경은 --rotate 옵션을 사용하세요.'); }
    }
    const usedNonces = new Set();
    if (reuse) {
      // Include old ciphertext nonces, even for replaced or removed files.
      // Never deliberately reuse a nonce with the same key.
      for (const path of existing) {
        const bytes = await readFile(join(vault,`${path}.enc`));
        if (bytes.length < 28) throw new Error(`손상된 암호문: ${path}`);
        const nonce = bytes.subarray(0,12).toString('hex');
        if (usedNonces.has(nonce)) throw new Error('기존 암호문에서 중복 nonce 발견. 원본 확인 후 --rotate가 필요합니다.');
        usedNonces.add(nonce);
      }
    }
    await mkdir(tmp);
    let unchanged = 0, changed = 0, added = 0;
    for (const path of paths) {
      const plain = await readFile(join(raw,path));
      if (path.endsWith('.json')) JSON.parse(plain.toString('utf8'));
      let bytes;
      if (reuse && existing.has(path)) {
        const old = await readFile(join(vault,`${path}.enc`));
        let decoded;
        try { decoded = decrypt(old,key,path); }
        catch { throw new Error(`기존 암호문 검증 실패: ${path}. 기존 vault는 변경하지 않았습니다.`); }
        if (decoded.equals(plain)) { bytes = old; unchanged++; }
      }
      if (!bytes) {
        bytes = encrypt(plain,key,path,usedNonces);
        if (existing.has(path)) changed++; else added++;
      }
      if (!decrypt(bytes,key,path).equals(plain)) throw new Error(`검증 실패: ${path}`);
      const out = join(tmp,`${path}.enc`);
      await mkdir(dirname(out),{recursive:true});
      await writeFile(out,bytes);
    }
    if (reuse && !changed && !added && !removed.length) {
      console.log(`변경 없음: ${unchanged}개 재사용. 기존 vault를 그대로 유지합니다.`);
      return;
    }
    const manifest = reuse ? previous.bytes : JSON.stringify({version:1,kdf:'PBKDF2-SHA256',iterations,salt:salt.toString('base64')})+'\n';
    await writeFile(join(tmp,'manifest.json'),manifest);
    const backup = join(root,`vault.tmp-backup-${process.pid}`);
    let moved = false;
    try { await rename(vault,backup); moved=true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await rename(tmp,vault); }
    catch (e) { if (moved) await rename(backup,vault); throw e; }
    if (moved) await rm(backup,{recursive:true,force:true});
    console.log(`검증 완료: 재사용 ${unchanged}개 · 변경 ${changed}개 · 신규 ${added}개 · 삭제 ${removed.length}개. vault/만 배포합니다.`);
  } finally {
    key?.fill(0);
    await rm(tmp,{recursive:true,force:true});
    await rm(lockDir,{recursive:true,force:true});
  }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
