# 이론 과목 데이터와 검수

이론형 과목은 과목 목록의 `type: "theory"`로 선택한다. 기존 reader와
conversation 과목은 기존 렌더러를 유지한다. 기본 JSON 경로와 복호화는
기존 `readJson` 및 AES-256-GCM을 그대로 사용한다.

## 데이터

- 과목 선언: `private/computer-architecture-subject.json`
- 강의: `private/data/computer-architecture/unit-01.json` ~ `unit-15.json`
- 실제 시험지: `private/data/computer-architecture/question-bank.json`
- 원본 페이지: `private/data/computer-architecture/pages/unit-NN/page-NNN.json`
- 실제 시험지 페이지: `private/data/computer-architecture/exams/…/page-NNN.json`
- 강의별 검수 보고서: `private/analysis/computer-architecture/review-report.md`

강의 JSON의 `summary`, `concepts`, `formulas`, `supplements`, `practice`는
각각 학습 메뉴의 데이터다. 설명의 `origin`은 `source` 또는 `ai`이며,
`sourcePages`는 1부터 시작하는 PDF의 물리적 페이지 번호다.
`sections`의 `startPage`가 목차를 구성한다. `pages`에는 원본 순서대로
제목·검색 텍스트·페이지 데이터 경로를 기록한다. 페이지 데이터는
`image`(로컬 JPEG data URI), `text`, `width`, `height`를 가진다.
이미지를 JSON 내부에 두므로 기존 암호화기의 허용 파일 형식을 확장하지
않고도 이미지가 복호화된 후에만 표시된다. 외부 이미지 URL은 사용하지 않는다.

`detailedTheory`에는 검수된 전사·상세 설명을 원본 순서로 추가할 수 있다.
각 항목은 `title`, `origin`, `sourcePages`, `paragraphs`, 선택적 `steps`를
가지며, `table`의 `headers`·`rows`는 모바일에서 가로 스크롤되는 표로
표시한다. `expression`은 스크롤 가능한 수식 블록이다. 미전사 범위를
완료로 표시하지 않고 원본 페이지와 검수 보고서에 연결한다.

문제의 `sourceKind: "ai"`는 제작 연습 문제이며 실제 기출과 구분한다.
선택지는 정확히 4개, `answer`는 0부터 시작하는 정답 인덱스다.
`optionExplanations`에는 각 선택지에 대한 설명을 기록한다.
실제 시험지 정답표의 `officialAnswers`는 원본과 같은 1~4 번호를 사용한다.
원본 시험지 이미지를 보존했다는 사실은 개별 문항 전사·해설 검수가
완료되었다는 의미가 아니다. 범위·검수 한계는 private 보고서를 참조한다.

## 확인

```sh
cd /workspace/my-study
npm run build
node scripts/validate-theory.mjs
npm run dev
```

검증기는 private 자료가 있는 작업 환경에서만 실행한다. 개인정보·학습
자료를 출력하지 않고 스키마, 전체 페이지 수, 참조 경로, JPEG 형식,
객관식 구조 및 공개 빌드에 private 경로가 없는지를 확인한다.
내용의 학술적 정확성·누락 및 작은 도표 판독은 별도 수동 검수 대상이다.

현재 컴퓨터구조 자료는 검수 중인 초안이며 기존 과목 목록에는 등록하지
않았다. 원본 보존만으로 완성된 학습 콘텐츠라고 판정하거나 공개하지 않는다.
사용자가 등록과 암호화를 재개할 때에는 기존 private 원본·과목 목록을
보존한 상태에서 과목 등록 스크립트를 사용한다. 암호화 작업은 사용자가
터미널에서 직접 입장 코드를 입력하고, 코드 값을 로그·채팅·스크립트에
저장하지 않는다. 기존 원본이 누락된 상태에서 `--prune`을 사용하지 않는다.

평문 데이터와 원본은 `private/`에만 보관한다. Git에는 공통 렌더러와
검증기만 포함한다. 미암호화된 자료를 `vault/`나 `dist/`로 복사하지 않는다.
