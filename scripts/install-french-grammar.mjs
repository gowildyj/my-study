/** Install French grammar support without replacing the user's current app.js. */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const appPath = join(root, 'js/app.js');
const htmlPath = join(root, 'index.html');
const dryRun = process.argv.includes('--check');
let app = await readFile(appPath, 'utf8');
let html = await readFile(htmlPath, 'utf8');
const originalApp = app;
const originalHtml = html;

if (!/\brenderGrammar\b/.test(app)) {
  const afterReader = /import\s*\{\s*renderReader\s*\}\s*from\s*['"]\.\/reader\.js['"];?/;
  if (!afterReader.test(app)) throw new Error('app.js에서 reader.js import를 찾을 수 없습니다. 수동 확인이 필요합니다.');
  app = app.replace(afterReader, match => `${match}\nimport { renderGrammar } from './grammar.js';`);
} else if (!/from\s*['"]\.\/grammar\.js['"]/.test(app)) {
  throw new Error('renderGrammar 이름이 존재하지만 grammar.js import가 없습니다. 중단합니다.');
}

if (!/\bcase\s+['"]grammar['"]\s*:/.test(app) && !/subject\.type\s*===?\s*['"]grammar['"]/.test(app)) {
  // Newer app.js supplied in the previous development step uses this switch.
  const switchPattern = /switch\s*\(\s*subject\.type\s*\)\s*\{/;
  if (switchPattern.test(app)) {
    app = app.replace(switchPattern, m => `${m}\n    case 'grammar':\n      return renderGrammar;`);
  } else {
    // Older repository uses an inline const render = <ternary>.
    const renderPattern = /\bconst\s+render\s*=\s*([^;]*?renderReader\s*);/;
    const match = app.match(renderPattern);
    if (!match) throw new Error('app.js에서 과목 렌더러 선택 구문을 찾을 수 없습니다. 파일 변경을 중단합니다.');
    app = app.replace(renderPattern, (_, expression) =>
      `const render = subject.type === 'grammar' ? renderGrammar : (${expression.trim()});`);
  }
}
if (!html.includes('css/grammar.css')) {
  if (!html.includes('</head>')) throw new Error('index.html에 </head>가 없습니다.');
  html = html.replace('</head>', '    <link rel="stylesheet" href="./css/grammar.css?v=1" />\n  </head>');
}
// Increment the entry module query once so a deployed browser loads the new router.
if (html !== originalHtml) {
  html = html.replace(/(src=["']\.\/js\/app\.js)(?:\?v=(\d+))?(["'])/, (_m, prefix, current, quote) =>
    `${prefix}?v=${Number(current ?? 1) + 1}${quote}`);
}
if (!/from\s*['"]\.\/grammar\.js['"]/.test(app) || !/\b(case\s+['"]grammar['"]|subject\.type\s*===?\s*['"]grammar['"])/.test(app) || !html.includes('css/grammar.css')) {
  throw new Error('적용 검증 실패. 파일은 수정되지 않았습니다.');
}
const changed = app !== originalApp || html !== originalHtml;
if (dryRun) {
  console.log(`검사 완료: ${changed ? '변경 필요' : '이미 설치됨'}`);
} else if (changed) {
  // Use temp files and atomic rename per path. No user's source file is replaced by a generic template.
  const appTmp = `${appPath}.tmp-${process.pid}`;
  const htmlTmp = `${htmlPath}.tmp-${process.pid}`;
  await writeFile(appTmp, app);
  await writeFile(htmlTmp, html);
  await rename(appTmp, appPath);
  await rename(htmlTmp, htmlPath);
  console.log('문법 학습 렌더러 연결 완료: js/app.js, index.html');
} else {
  console.log('문법 학습 렌더러가 이미 연결되어 있습니다.');
}
