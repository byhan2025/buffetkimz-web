# buffetkimz 깃밥 벤치마킹 UX 3종 — 구현·실측 (2026-11-25)

`gitbap.com`의 세 가지 UX를 `DESIGN.md` 규격(단색 SVG, 화살표·영문 대문자 눈썹 금지, 딥 네이비·블루·크림)에 맞춰 옮겼다. 커밋 `37c5456`(기능) · `86ece3a`(캡처 스크립트) · 배포 gh-pages `5e32328`.

## 1. 상황별 맞춤 (`src/components/home/AudiencePick.astro`, `src/data/audience.ts`)

- 홈 필름 바로 아래(`#start`, 크림 장면). 알약 3개: 사회초년생 · 직장인·가장 · 은퇴준비.
- 라디오 + CSS `:checked`로 전환 — **자바스크립트 없이도 동작**. JS는 고른 값을 `localStorage(bk-audience)`에만 남기고 복원한다.
- 상황마다 계산기 3종과 글 3편. 추천이 없는 글·도구를 가리키면 빌드가 선다(발행 글·`hubTools`와 대조).
- 기본값은 직장인·가장.

## 2. 사용법 5탭 (`src/components/home/UsageGuide.astro`, `#how`)

- 오늘의 시장 · 계산기 도구 · 데일리 브리프 · 자료앨범 · 아카데미.
- 왼쪽: 두 문장 설명 + 바로가기. 오른쪽: '화면 예시' 미니 모형(지표·게시판·자료앨범 표지·아카데미 단계는 실제 데이터에서 읽는다).
- 7초 자동 순환 · 멈춤 버튼(`aria-pressed`) · ←/→·Home/End 키 · `prefers-reduced-motion`이면 자동 넘김 시작 안 함.

## 3. 일간 머리글 + 읽기 깊이

- 필름 아래 크레딧 띠 맨 위에 `기준일 2026. 11. 25. 수요일 / 한 줄 소개 / 확인 06:04`. 날짜는 `site.baseDate`, 확인 시각은 `today.asOf`.
- `DepthMark`(`src/components/DepthMark.astro`, 스타일은 `global.css`): 점 3개 + `입문`·`실무`·`심화`. 값의 정본은 `src/data/depth.ts`.
  - 글: 6분 이하 입문, 7~9분 실무, 10분 이상 심화(예외 5편).
  - 도구: 세액공제·복리·골든타임 입문 / 은퇴·인출·보장·실손 실무 / 고지 심화.
  - 붙는 곳: 홈 글 카드 3 · 도구 카드 4 · `/posts` 목록 카드 전체.

## 실측 (로컬·라이브 동일)

| 항목 | 값 |
|---|---|
| 첫 화면(필름+머리글+정의 띠) | 1440×900 = 899/900 · 390×844 = 843/844 (`--hero-def-h` 211 · 247) |
| 가로 넘침 | 1440·390 = 0px (홈·/posts) |
| 콘솔 오류 | 0 |
| 상황 전환·저장·복원 | 통과(js / no-js 양쪽) |
| 5탭 클릭·키보드·자동 넘김·멈춤 | 통과 |
| 깊이 표시 | 홈 글 3 · 도구 4, `/posts` 카드 전부 |
| check_mobile_320 | 넘침 0 · 44px 미만 0 (320·390, 19개 경로) |
| verify:tax / verify:vault | 22/22 · 65/65 |

- 캡처: `reports/buffetkimz-web/ux3-20261125/local/shots/`, `.../live/shots/` (1440×900 · 390×844 · 768×1024).
- 검사 결과 JSON: 각 폴더의 `check.json` (로컬 32/32, 라이브 32/32).
- 실행: `python3 scripts/capture_ux3_20261125.py [--live]`

## sloplint

| 파일 | 이전 FAIL | 지금 FAIL |
|---|---|---|
| `src/pages/index.astro` | 6 | 6 |
| `src/components/home/PortalPicks.astro` | 1 | 1 |
| `src/components/PostCards.astro` | 3 | 3 |
| `AudiencePick` · `UsageGuide` · `DepthMark` | — | 0 |

`--render` 티어는 이 작업 환경에 puppeteer-core가 없어 실행되지 않았다(`render tier not run`). 같은 확인을 Playwright 캡처·콘솔 수집으로 대신했다.

## 남긴 것

- 768 높이(1024×768)처럼 필름 `min-height: 540px`가 먼저 걸리는 화면은 이번 변경 전부터 첫 화면을 넘는다(기존 동작). `--hero-def-h`와 무관.
- 이 작업 환경에서 `buffetkimz.com` DNS가 풀리지 않아 라이브 검증은 `byhan2025.github.io/buffetkimz-web`(같은 빌드)에서 했다.
- `DESIGN.md` §3에 세 컴포넌트, §5에 5탭 안내 예외, §7에 이번 기록을 남겼다.
