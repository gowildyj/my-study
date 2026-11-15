# My Study

개인 학습용 정적 웹앱. Node.js 20+ (22 권장). npm 설치 패키지나 서버 계정 불필요.

## 처음 실행

1. 이 ZIP은 원본 학습 자료를 담은 **로컬용** 프로젝트입니다. ZIP 자체를 공개 업로드하거나 private/을 커밋하지 마세요.
2. 프로젝트 폴더(my-study)에서 `npm run encrypt`를 실행합니다. 입장 코드를 두 번 입력합니다(16자 이상, 길고 무작위인 암호 또는 충분히 긴 무작위 단어 조합 권장). 입력은 화면에 표시하지 않습니다. 실제 암호를 파일이나 명령줄에 기록하지 마세요.
3. `npm run dev` 실행 후 http://127.0.0.1:4173 접속. 서버 중지는 Ctrl+C. 이 명령은 dist/만 로컬 제공하므로 private/은 직접 접근 불가.
4. 입장 코드 → 나의 학습 → 대학영어 → Unit 선택. 잠금/새로고침 시 재입력. 암호/키를 브라우저 저장소에 지속 저장하지 않습니다.

## 새 GitHub 저장소와 Pages

기존 공개 knou-study는 과거 평문 자료가 Git 이력에 남습니다. 먼저 Pages 게시를 중단하고 기존 저장소를 Private으로 바꾸는 것을 권장합니다. 이미 받은 사본까지 회수할 수는 없습니다. 새 이름 my-study의 빈 공개 저장소를 생성하십시오(README 자동 생성하지 않음).

로컬 my-study 폴더에서 `npm run encrypt` 완료 후:

```sh
git init -b main
git add .gitignore .nojekyll .github package.json README.md index.html css js tools assets scripts vault
git status
git commit -m "feat: launch encrypted My Study library"
git remote add origin https://github.com/gowildyj/my-study.git
git push -u origin main
```

GitHub 저장소 Settings → Pages → Source → GitHub Actions 선택. Actions 탭에서 Deploy My Study 실행(첫 push에서 실행되지 않았다면 Run workflow). 예상 주소: https://gowildyj.github.io/my-study/ (배포 완료 후 확인).

## 학습 자료 추가

`private/data/subjects.json`에 새 항목 추가 (id: 영문 소문자/숫자/하이픈, 중복 금지):

```json
{"id":"french","name":"프랑스어 회화","category":"외국어","type":"language","description":"회화와 단어","unitCount":10,"unitLabel":"Lesson"}
```

`private/data/french/unit-01.json`, 필요시 `unit-01-extra.json`, `private/audio/french/unit-01.mp3` 등 저장. 기존 대학영어 스키마를 재사용. 최대 99개 단원. 편집기에서 subject id와 단원 변경 후 JSON 다운로드; 해당 private/data/<id>/ 폴더에 수동 저장. 일반 도서/전공 과목 전용 요약·기출 등 별도 UI는 미구현.

자료 변경 후 `npm run encrypt`, `npm run dev`로 확인, `git add vault` 후 커밋/푸시. 모든 암호화 파일은 새 salt/nonce로 재생성됩니다. 입장 코드를 변경할 때도 같은 절차. Git 이력의 이전 암호문은 이전 암호로 열 수 있습니다. 비밀번호 분실 시 private/ 원본으로 새 암호 설정. 원본 별도 백업 권장.

## 보안 한계

AES-256-GCM, 파일별 무작위 96비트 nonce, PBKDF2-SHA256 600,000 iterations. 파일 경로를 AAD에 포함하고 암호화 후 원본과 비교. 공개 GitHub Pages는 서버 인증이 아닌 클라이언트 복호화입니다. 암호문 다운로드/오프라인 추측 자체는 막지 못합니다. 비밀번호가 약하면 위험합니다. 로그인한 사람이 복호화한 내용을 복사하는 것도 막을 수 없습니다. 공개 HTML/JS/CSS 및 데이터 없는 편집기 도구는 직접 접근 가능하며 학습 원문과 오디오만 암호화됩니다. MP3는 전체 파일 다운로드 후 재생하므로 지연이 생길 수 있고 모바일에서 재생 버튼을 다시 눌러야 할 수 있습니다. 사이트 수정 권한을 가진 사람의 악성 JS 변경, 공개 저장소 과거 평문 사본, 배포 권리 문제는 해결하지 못합니다.
