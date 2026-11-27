/**
 * Restore missing private source files from a previously encrypted My Study vault.
 * Place this script at my-study/scripts/restore-my-study-private.mjs and run with Node 20+.
 * Never overwrites an existing private file. Never modifies vault or the repository.
 */
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const root = fileURLToPath(new URL('../', import.meta.url));
const vault = join(root, 'vault');
const privateDir = join(root, 'private');
const validPath = /^(?:data\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.json|audio\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.mp3)$/i;

function decrypt(ciphertext, key, path) {
  if (ciphertext.length < 28) throw new Error(`암호문 손상: ${path}`);
  const decipher = createDecipheriv('aes-256-gcm', key, ciphertext.subarray(0, 12));
  decipher.setAAD(Buffer.from(`my-study:v1:${path}`));
  decipher.setAuthTag(ciphertext.subarray(-16));
  return Buffer.concat([
    decipher.update(ciphertext.subarray(12, -16)),
    decipher.final()
  ]);
}

async function* encryptedPaths(path) {
  const folder = join(vault, path);
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    // Ignore Finder metadata in downloaded/unzipped folders.
    // Match scripts/encrypt.mjs, which also ignores dotfiles.
    if (entry.name.startsWith('.') || entry.name === '__MACOSX') continue;
    if (entry.isDirectory()) {
      if (!/^[a-z0-9_-]+$/i.test(entry.name)) throw new Error('잘못된 vault 경로');
      yield* encryptedPaths(`${path}/${entry.name}`);
    } else if (entry.isFile() && entry.name.endsWith('.enc')) {
      const decryptedPath = `${path}/${entry.name.slice(0, -4)}`;
      if (!validPath.test(decryptedPath)) throw new Error(`지원하지 않는 경로: ${decryptedPath}`);
      yield decryptedPath;
    } else {
      throw new Error(`지원하지 않는 vault 항목: ${entry.name}`);
    }
  }
}

async function main() {
  if (!process.stdin.isTTY) throw new Error('일반 Mac 터미널에서 직접 실행하세요.');
  const manifest = JSON.parse(await readFile(join(vault, 'manifest.json'), 'utf8'));
  const salt = Buffer.from(manifest.salt ?? '', 'base64');
  if (manifest.version !== 1 || manifest.kdf !== 'PBKDF2-SHA256' ||
      manifest.iterations !== 600000 || salt.length !== 16) {
    throw new Error('기존 My Study 암호화 형식을 지원하지 않습니다.');
  }

  process.stdout.write('기존 My Study 입장 코드 입력 (화면에 표시되지 않음): ');
  const hidden = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const reader = createInterface({ input: process.stdin, output: hidden, terminal: true });
  let password;
  try { password = await reader.question(''); }
  finally { reader.close(); process.stdout.write('\n'); }

  const key = pbkdf2Sync(password, salt, 600000, 32, 'sha256');
  password = '';
  try {
    // Authenticate before creating a single file.
    const catalog = decrypt(
      await readFile(join(vault, 'data/subjects.json.enc')),
      key,
      'data/subjects.json'
    );
    if (!Array.isArray(JSON.parse(catalog.toString('utf8')))) {
      throw new Error('기존 과목 목록이 올바르지 않습니다.');
    }

    let recovered = 0, skipped = 0;
    for (const category of ['data', 'audio']) {
      for await (const path of encryptedPaths(category)) {
        const out = join(privateDir, path);
        try { await access(out); skipped++; continue; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const plain = decrypt(await readFile(join(vault, `${path}.enc`)), key, path);
        if (path.endsWith('.json')) JSON.parse(plain.toString('utf8'));
        await mkdir(dirname(out), { recursive: true, mode: 0o700 });
        try {
          await writeFile(out, plain, { flag: 'wx', mode: 0o600 });
          recovered++;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          skipped++;
        }
      }
    }
    console.log(`원본 복구 완료: 신규 ${recovered}개, 이미 있던 파일 유지 ${skipped}개`);
    console.log('기존 vault/는 변경하지 않았습니다.');
  } finally { key.fill(0); }
}

main().catch(error => {
  console.error('복구 실패:', error.message.includes('Unsupported state') ?
    '입장 코드가 틀리거나 기존 vault가 손상되었습니다.' : error.message);
  process.exitCode = 1;
});
