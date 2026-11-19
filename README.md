# buffetkimz-web

`buffetkimz.com` — 금융과 돈에 관한 기록(블로그) + 통합 검색 + 직접 만든 도구 7종 +
제도달력. v4.1에서 홈을 다섯 영역으로 나누고 버튼 위계를 3단계로 통일했으며, 1:1 상담문의 표기와
모바일 실행 화면 요약 바를 더했습니다. v4.0에서 첫 화면의 무게중심을 금융·투자·연금·노후로 옮기고
보험은 리스크 관리 참고 도구로 내렸습니다.
v3: 20개 대표 사이트 벤치마킹(보고서 `reports/buffetkimz-web/benchmark-20-sites-2026-11-19.md`)에 따라
디자인·정보구조를 전면 개편했습니다. 밝은 화이트·스카이블루 히어로, 잉크 네이비(`#0B1B29`)는
도구 미리보기 카드와 하단 강조 구간에만, 행동은 제이드(`#146C58`)로. 홈은 4장면 리듬
(화이트블루 → 크림 기록 → 화이트 도구 → 네이비 제도·채널 → 크림 푸터)입니다.

### v5.0 — 도입부 2페이지·아카이브·브랜드 록업

- **대표 로고·파비콘**: `downloads/logo-buffetkimz-1-light.png`에서 흰 배경을 투명으로 바꾸고 박혀 있던
  영문자를 덜어낸 `public/brand/logo-buffetkimz-240.png`를 헤더·푸터·검색 오버레이에 쓴다. 작은 크기에서
  뭉개지지 않도록 영문 워드마크는 이미지가 아니라 12px 모노 글자(`.brand-word`)로 둔다. 파비콘은 `버` 한 글자를
  기하 도형(ㅂ + ㅓ)으로 그린 단색 SVG(`public/favicon.svg`) + 32px·애플터치 PNG다. 글꼴에 의존하지 않아
  어느 브라우저에서나 같은 모양으로 보인다.
- **도입부 2페이지**: 히어로 바로 아래에 '이곳은 무엇을 하는 곳인가' 층을 두었다. 정체성 3줄(금융·투자·연금·
  노후준비 중심 / 보험은 리스크 관리로 서브 / 기록과 도구), 편집 원칙 4칸(공식 원문 확인·기준일 명시·가정과
  한계 공개·영업/과장 배제), `1차 공식 자료 → 7개 채널 기록 → 브라우저 계산 도구` 3단계 도식(`.flow-panel`).
- **아카이브**: 7대 주제 카드(+전체 기록), 12편을 묶은 6개 시리즈, '처음 읽을 글' 3편과 '자주 찾는 계산' 3종,
  최근 기록 한 줄. 편수·제목은 글 컬렉션에서 빌드 시점에 센다(`src/data/library.ts`).
- **신뢰 2단 스플릿**: 딥그린 강조 카드 1장 + 공식 출처 5곳·기준일·편집 원칙·쌓인 양(12편/7종/51건/저장 0건)
  데이터 카드 + 이번 달 제도 일정 3건. 마무리는 7개 채널 8칸 그리드(코드 보관소 포함)와 딥그린 상담문의 배너.
- **히어로 시뮬레이터**: 정적 캡처가 아니라 은퇴 나이(55~70세)·개인연금 월 납입(0~100만원) 슬라이더로 숫자가
  즉시 바뀌는 React 섬(`HeroSim.tsx`). 실행 화면과 같은 `lib/finance.ts` 계산을 쓴다.

### v4.1 — 다섯 영역·버튼 3단계·1:1 상담문의

- **5영역 구조**: 홈을 도입부 → 기록 → 도구 → 기준·일정 → 채널·상담문의로 나누고 배경을 교차했다
  (`scene-sky-soft` → `scene-cream` → `scene-mist` → `scene-white` → `scene-sky-band`).
  ① 둥근 프레임(`.hero-shell`) 히어로 안에 은퇴 월 현금흐름 시뮬레이터를 **브라우저 창 모양**(`.sim`)으로 넣고
  어두운 카드 대신 흰 창·스카이블루 막대로 바꿨다. ② ③ ⑤는 AIMAX식 2단 머리글(`.sec-head` = 작은 컬러 라벨 +
  두 줄 제목 / 두 줄 설명 + 보조 버튼)을 쓴다. ③은 미스트 배경 위 3열 카드 + `화면 예시` 미니 UI 미리보기
  (`ToolPreview.astro`, 4번째 달력은 가로 띠) + 리스크 관리 3종 1줄. ④는 페이지에서 유일한 단색 강조 카드
  (`.accent-card` — 입력값 브라우저 내 계산 · 서버 저장 0건 · 1차 출처 기준)와 흰 제도 일정 카드의 2단 스플릿.
- **버튼 3단계**: `.btn-primary`(솔리드, 도구 실행·열기) · `.btn-secondary`(테두리 필, 근거·전체 보기·카드 액션) ·
  `.btn-tertiary`/`.btn-tertiary-quiet`(보조 필, 검색·제도 일정·1:1 상담문의)만 쓴다. 기존 `.btn-solid`·`.btn-line`·
  `.btn-soft`는 같은 단계의 별칭으로 남겨 다른 페이지가 깨지지 않게 했다. 카드 안에 흩어져 있던 텍스트 링크
  (`계산해 보기 →`, `읽기`)는 `.btn-xs`(44px) 필로 통일했다.
- **1:1 상담문의**: `카카오톡 채널` 표기를 `1:1 상담문의`(https://pf.kakao.com/_UxkVxnn/chat)로 바꾸고,
  홈 마무리 배너·푸터·소개에 `1:1 상담문의는 특정 상품의 가입 권유·중개가 아닌 일반 안내·문의 채널입니다.`를
  함께 적었다. `site.contact`가 문구·주소·면책의 단일 출처다.
- **모바일 실행 화면 요약 바**: `StickySummary`가 768px 미만에서 화면 하단에 핵심 숫자를 고정한다
  (은퇴 `월 수령액(오늘 가치) 269만원 · 목표 대비 +19만원`, 복리 `세후/세전`, 세액공제 `공제액/남은 한도`,
  보장 점검 `충족 수/먼저 볼 항목`, 실손 `4·5세대 자기부담`). 슬라이더 눈금 라벨은 12px 이상이며 두 항목을
  실측한다(`*.run.*.sticky_summary`, `*.run.*.scale_labels_12px`).
- **v4.0.1 안전선 유지**: 계산 일치(441만/269만/+19만, 보수 0.30%/−3.30%), `sessionStorage` 0건, 360·390
  가로 넘침 0, 대비 4.5:1↑, 12px↑, 터치 44px↑, `prefers-reduced-motion` 정지 모두 그대로 통과한다.
  홈 높이 기준은 4장면(2,200~2,500)에서 5영역 예산(3,400~4,000, 실측 3,900)으로 다시 잡았다.

### v4.0.1 — 계산 일치·세법 문구·360px 표

- **계산 일치 검증**: 홈 히어로 카드·금융 스트립·실행 화면의 숫자를 `verify_v4.py`가 직접 대조한다
  (`consistency.retirement_home_vs_run`, `consistency.compound_strip_vs_run`). 기본 예시값은 은퇴 명목 441만원 /
  오늘 가치 269만원 / 차이 +19만원, 복리 세전 2억 2,138만원 · 세후 2억 731만원 · 보수 0.30%.
- **불일치의 원인**: v4.0 라이브의 실행 화면이 313만원 · +63만원, 보수 1.30% · -4.30%로 찍힌 것은 배포 전
  임시 빌드(수익률 5%·보수 1.3% 기본값)가 CDN에 남아 있던 것이었다. `gh-pages` 커밋 `8ad7b3a`의 번들은
  `main` 커밋 `451f6fe`의 소스로 만든 `dist`와 바이트 단위로 같고, 지금 라이브는 4.0 소스(4%·0.3%)를 내려준다.
  재발을 막으려고 화면 간 숫자 대조를 검증 항목으로 넣었다.
- **세법 문구**: 사적연금 연 1,500만원 초과 시 “종합소득세 신고 또는 15% 분리과세(지방소득세 포함 16.5%) 중
  선택”으로 정정했다(국세청 연금소득 안내, 소득세법 제20조의3·제64조의4). 16.5%는 종합과세 세율이 아니라
  선택 가능한 분리과세율이다. `PRIVATE_PENSION_TAX.combinedRate` → `overThresholdSeparateRate`(15%)·
  `overThresholdSeparateRateWithLocal`(16.5%)로 이름과 값의 뜻을 맞췄다.
- **보수·손실률 표기**: 화면 문구가 계산에 실제로 쓰인 값(`CompoundResult.netRate`·`feeRate`)에서 나오게 바꿔
  `3 + fee` 같은 손 계산을 없앴다. 홈 스트립의 `보수 0.30% 반영`·`월 50만·20년·5.0%`도 예시값에서 만든다.
- **360px 표**: 복리 계좌 비교·연차별 표, 은퇴 월 수령액 표, 보장 점검 표를 `table-fixed`와 모바일 3열
  (보조 열은 이름 아래 한 줄)로 바꿔 오른쪽 끝 숫자가 가로 스크롤에 잘리지 않게 했다. `verify_v4.py`가
  360·390에서 표 내부 넘침 0과 셀 잘림 0을 확인한다.
- **작은 보완**: 홈 통계 줄 항목별 `whitespace-nowrap`(`제도 일정 / 51건`처럼 끊기지 않게), 히어로 카드
  세액공제 줄에 `(총급여 5,500만 이하 · 지방소득세 포함)` 조건 표시, `retire-fixed-cost` 글의 연결 앱을
  `retirement-flow`('은퇴 계산 열기')로 변경.

### v4.0 — 금융·투자·연금 메인 비중 개편

- **첫 화면 비중 역전**: 히어로 증거 카드 `보장 점검` → `은퇴 월 현금흐름 · 연금 시뮬레이터(가상 예시)`.
  국민·퇴직·개인연금의 명목/오늘 가치 막대, 합계, 세액공제 요약, `참고용 내부 예시 기준`을 한 카드에 담았다.
- **가로 스트립 교체**: 5대 담보 스트립 → `금융·투자·연금 핵심 지표 5칸`(공제 한도·공제율·목표 현금흐름·
  예시 월 수령액·장기 복리). 숫자는 실행 화면과 같은 `lib/finance.ts`로 계산한다.
- **홈 기록 4칸**: 최신순 그대로가 아니라 카테고리 순환(투자 → 연금 → 노후 → 금융 …)으로 채워
  금융·투자·연금·노후 글이 3칸 이상이 되게 했고, 보험 색채가 강한 AI 글은 4칸에서 내렸다.
- **도구 위계**: 메인 4칸(세액공제 → 은퇴 현금흐름 → 복리 → 제도 달력) + `리스크 관리(보험) 도구`
  한 줄(보장 점검·고지 자가체크·실손 비교). `/apps`도 `메인 금융·투자·연금 3 + 달력 1` /
  `서브 리스크 관리 3` = **7종**으로 나눠 표기한다.
- **신규 도구 2종**: `RetirementFlow`(은퇴 월 현금흐름 시뮬레이터), `CompoundReturn`(투자 복리·세후 수익률
  계산기). 두 도구 모두 **1줄 결론 → 먼저 확인할 항목 3개 → 기본 입력 4개 → '가정 더 보기'(접기) →
  결과 카드 옆에 적용 가정 한 줄 상시 노출 → 표 대체 텍스트** 순서다. '부족/충분' 판정 대신 `예시 가정
  기준 점검 · 추가 확인 필요` 톤을 쓴다.
  - 은퇴: 물가·기대수익률·인출률(수령 기간 기준, 안전 인출률 아님)을 결과 옆에 명시하고 “확정 수령액 아닌
    가정 기반 추정치”임을 밝힌다. 사적연금 연 1,500만원(월 125만원) 이하 3.3~5.5% 분리과세 / 초과 시
    종합소득세 신고 또는 15% 분리과세(지방소득세 포함 16.5%) 중 선택, 공적연금 연 2,000만원 초과 시
    건강보험 피부양자 탈락 요인을 함께 안내한다.
  - 복리: 연 운용 보수 입력(기본 0.30%)과 세금을 **따로** 표시하고, 일반계좌 15.4% / ISA(일반형 비과세
    200만원, 서민형 400만원, 초과분 9.9%) / 연금저축 과세이연을 **3계좌 비교표**로 나란히 둔다.
    **세후 예상 구간**과 **원금 손실 가능 안내**는 같은 비중의 두 카드로 배치하고, 금융소득 2,000만원 초과
    종합과세·재투자 가정·기준일과 공식 출처(소득세법 제16·17조, 조세특례제한법(ISA), 소득세법 제59조의3)를
    결과마다 붙인다.
- **검색어 저장소 완전 제거**: `sessionStorage` 사용 0건. 첫 화면 검색 버튼·글의 태그는 같은 페이지의
  검색 오버레이를 열어 결과를 그 자리에서 보여 주고, `/search` 링크는 순수 이동(URL `?q=` 없음,
  저장소 없음, 네트워크 전송 없음). 개인정보처리방침 6장도 같은 문구로 정정.
- **390px 줄바꿈**: 히어로 신뢰 줄의 `모든 글에 기준일·1차 출처`를 `whitespace-nowrap`으로 묶어 `·1차 출처`
  앞에서 끊기지 않게 했다.

### v3.2 — 홈 압축·한눈에 보기

- **홈 세로 길이**: 데스크톱 1280 기준 4,411px → 약 2,250px (약 51%). 첫 화면(800px) 안에
  4대 축 인덱스(블로그 기록 · 계산·점검 도구 · 제도 일정 달력 · 연결 채널)가 모두 들어온다.
- **구성**: 히어로 + 4대 축 인덱스 → 최근 기록 4칸(2×2/4열) → 도구 5칸 타일 + 5대 담보 압축 스트립
  → 네이비 2단 밴드(다가오는 제도 일정 3건 | 7대 채널 + 카카오톡) → 슬림 1단 푸터.
- **카카오톡 채널**: `site.kakaoChannelUrl`(https://pf.kakao.com/_UxkVxnn/chat)을 홈·푸터·소개에 연결.
  기존 `http://` 주소는 HTTPS로 308 리다이렉트되어 https로 고정했다.
- **문구·표기**: `예시 기준 도달` 3상태 범례를 스트립 헤더에도 표기, 실행 화면 요약은 `기준 도달 담보 n / 6`,
  `보험 기준표` → `담보 확인 가이드`, 5대 담보 기준점은 “공식 기준표가 아님”을 명시.
- **글 손질**: `/posts/ai-coverage-tool/`에서 고객 작업·시간 단축 수치를 걷어내고 가상 예시 기준으로 서술,
  환율·금리 글의 연금계산기 연결을 관련 글로 교체.
- **개인정보처리방침**: 시행일 명시 + 외부 앱(기기 저장·계정 동기화)·외부 서비스 링크의 별도 정책 안내.
- **검수 반영(4호 봇·부이 대리)**: 제도 일정 7월 실손 문구를 금융위 기준대로 분리(특약2 보장 제외 / 그 밖의
  비중증 비급여 50%), 고지 자가체크에서 2년 이력을 5년 이내 입원·수술 질문에만 연결(10대 질병 질문과 분리,
  305는 약관 확인 안내),
  실손 비교기에 특약2 제외 항목 1줄 안내, 5대 담보 요약의 상태 개수를 행 라벨과 일치(보완 검토 별도 집계),
  광고 슬롯의 안내 문구 DOM 제거, 카카오톡 CTA는 홈 하단 한 곳에 중립 표기로만 둔다.

## 스택

- **Astro 7** (정적 출력, `output: 'static'`) — 글은 빌드 시 순수 HTML
- **React 19** — 검색·피드 필터·제도달력·계산기만 하이드레이션
- **Tailwind CSS v4** (`@tailwindcss/vite`) — 토큰은 `src/styles/global.css`의 `@theme`
- **@astrojs/sitemap** — `sitemap-index.xml` 자동 생성

본문·제목은 Pretendard Variable(jsDelivr, 동적 서브셋), 숫자·기준일은 모노,
워드마크는 Instrument Serif입니다. 웹폰트가 실패해도 시스템 글꼴 폴백으로 읽힙니다.
타입 스케일은 6단 — 디스플레이 `clamp(40px, 5.6vw, 72px)` / 섹션 34 / 서브 24 / 리드 20 / 본문 17 / 메타 13.
모바일(360·390)에서는 본문·라벨 12px 이상, 터치 영역 44px 이상을 지킵니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 정적 빌드
npm run preview  # 빌드 결과 미리보기
```

Node 22.12 이상.

## 배포 (GitHub Pages)

- 저장소: `byhan2025/buffetkimz-web` (공개). 사이트는 `gh-pages` 브랜치에서 배포한다.
- 라이브: <https://byhan2025.github.io/buffetkimz-web/> — GitHub Pages 서브패스(`/buffetkimz-web/`) 배포.
- 배포 명령 (로컬 빌드 → `gh-pages` 강제 푸시):

  ```bash
  npm run deploy:pages
  # 내부적으로 SITE_URL·BASE_PATH를 넣어 빌드하고 gh-pages 브랜치로 올린다
  ```

- 주소 분기는 `astro.config.mjs`에서 환경변수로만 처리한다.

  ```bash
  # 커스텀 도메인(buffetkimz.com) 루트 배포
  npm run build
  # GitHub Pages 서브패스 배포
  SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
  ```

- 내부 링크·자산·검색 인덱스는 `src/config/site.ts`의 `withBase()`/`absolute()`를 거친다.
  새 링크를 추가할 때 `href="/..."`를 그대로 쓰면 서브패스에서 깨지므로 `href={withBase("/...")}`를 쓴다.
  마크다운 본문의 내부 링크는 `astro.config.mjs`의 rehype 플러그인이 자동으로 접두를 붙인다.
- `robots.txt`는 정적 파일이 아니라 `src/pages/robots.txt.ts`가 배포 접두에 맞춰 만든다.
- 실측 검증: `python3 scripts/verify_v4.py`(로컬 dist, 91~92개 항목), `python3 scripts/verify_live.py`(라이브 URL).
  `verify_v4.py`는 홈 비중·기록 4칸 구성·/apps 7종 표기·신규 도구 실행 화면·검색 저장소 0건·
  대비 4.5:1·12px·터치 44px·reduced-motion·390px 줄바꿈을 실제 브라우저로 잰다.
- GitHub Actions로 옮길 때는 `deploy/github-actions-workflow.yml.txt`를 `.github/workflows/deploy.yml`로
  복사한다. (현재 GitHub 앱 연결에 `workflows` 권한이 없어 저장소에 워크플로 파일을 올릴 수 없어
  `gh-pages` 방식으로 배포했다. 권한이 생기면 Actions 방식으로 전환할 수 있다.)

## 구조

```text
src/
├── config/site.ts            # 브랜드·기준일·3원칙 (값이 바뀌면 여기만)
├── content/posts/*.md        # 블로그 글 (에이전트가 파일만 추가하면 자동 반영)
├── content.config.ts         # 글 스키마(카테고리·태그·출처·연결 앱)
├── data/
│   ├── categories.ts         # 8개 카테고리(이름·소개·색)
│   ├── apps.ts               # 앱 7종(만든 이유·기능·기준·가정·실행 경로)
│   ├── tools.ts              # 홈·도구 허브의 도구 7종(메인 4 + 리스크 관리 3)
│   ├── channels.ts           # 채널 허브 슬롯(주소 확정 시 url만 채우면 링크)
│   └── calendar.ts           # 1~12월 제도 일정
├── lib/
│   ├── posts.ts              # 컬렉션 조회·경로·날짜·마크다운 제거
│   ├── finance.ts            # 연금·은퇴·복리 공통 가정과 계산식(홈 카드·스트립·실행 화면 공유)
│   ├── coverage.ts           # 5대 담보 기준점(도구 실행 화면과 홈 미리보기가 공유)
│   └── search.ts             # 한국어 부분일치·다중 키워드·스니펫·하이라이트
├── components/
│   ├── Header / Footer / Seo / AdSlot / Redirect / AppArt / PostList
│   ├── RetirementHeroCard.astro # 히어로의 은퇴 현금흐름 카드(예시 입력값·가정·기준일)
│   ├── FinanceStrip.astro    # 홈의 금융·투자·연금 핵심 지표 5칸
│   ├── CoverageGauge.astro   # 5대 담보 5칸 게이지 도해(/apps 리스크 섹션)
│   ├── PostCards.astro       # 질문 → 글 → 도구 직결 3열 카드
│   ├── PostFeed.tsx          # 카테고리 탭 피드(현재 기록 목록은 PostCards 사용)
│   ├── SearchApp.tsx         # 검색 페이지·오버레이 공용(검색어는 컴포넌트 메모리에만)
│   ├── HeaderSearch.tsx      # 헤더 검색 버튼 + 첫 화면·태그에서 여는 오버레이
│   ├── CalendarBoard.tsx     # 월별 제도달력
│   └── tools/                # 계산기 6종 + 공통 UI
├── layouts/Base.astro
└── pages/
    ├── index.astro
    ├── posts/index.astro · posts/[category].astro · posts/[slug].astro
    ├── apps/index.astro · apps/[slug].astro · apps/[slug]/run.astro
    ├── search.astro · search-index.json.ts
    ├── calendar.astro · about.astro · privacy.astro · terms.astro · 404.astro
    ├── rss.xml.ts
    ├── tools/…               # 옛 주소 → /apps 로 이동(noindex)
    └── topics/…              # 옛 주소 → /posts 로 이동(noindex)
```

## 글 추가 (에이전트 자동 발행)

`src/content/posts/`에 `.md` 파일을 하나 추가하고 `npm run build`(또는 배포)하면
블로그 피드·카테고리 페이지·검색 인덱스·RSS·사이트맵이 함께 갱신됩니다.

```yaml
---
title: "제목"
category: "finance"        # finance | invest | economy | insurance | retire | pension | ai | philosophy
description: "검색 결과와 카드에 노출될 1~2문장"
publishedAt: 2026-11-20
readingMinutes: 7
app: "coverage-check"      # 이어지는 앱 slug (선택)
tags: ["실손", "자기부담률"]
sources:
  - label: "금융위원회 보도자료 (2026-05-06)"
    url: "https://fsc.go.kr/no010101/86831"
featured: false
---
```

슬러그는 파일명입니다. 예: `economy-fx-grocery.md` → `/posts/economy-fx-grocery`.

## 검색

`src/pages/search-index.json.ts`가 빌드 시 글·앱·제도달력 문서를 JSON으로 만듭니다.
브라우저는 이 파일 하나를 받아 `src/lib/search.ts`의 점수 계산으로 검색합니다.

- 한국어 부분 일치(‘실손’ → ‘실손보험’), 다중 키워드 AND, 제목·태그·본문 가중치
- 유형 필터(전체·블로그·앱·제도달력), 블로그 카테고리 필터, 검색어 하이라이트
- 헤더 버튼·`/`·`Ctrl/Cmd+K`로 오버레이, `/search` 전용 페이지(공유 가능한 `?q=`)

## 앱 추가

`src/data/apps.ts` 배열에 항목을 추가합니다.

- 외부 앱: `externalUrl`만 채우면 카드·소개·‘앱 열기’ 버튼이 자동으로 생깁니다.
- 사이트 안 실행 앱: `internal: true` + `runNote`·`sourceLine`을 넣고,
  `src/components/tools/{이름}.tsx`를 만들어 `ToolRunner.tsx`의 `MAP`에 등록합니다.
  실행 화면은 `/apps/{slug}/run`으로 자동 생성되며 `noindex` 처리됩니다.

## SEO · 색인

- 페이지별 `title`/`description`/`canonical`/OG, 글은 Article JSON-LD, 앱은 SoftwareApplication
- `/apps/*/run`, `/search` — **noindex**(meta) + 사이트맵 제외.
  `robots.txt`에서는 이 경로를 막지 않습니다(막으면 검색봇이 noindex 태그를 읽지 못함).
- 글·앱 상세 하단 `AdSlot`은 비노출 마커(`data-ad-state="reserved"`)로만 유지
- 사이트맵은 실제 콘텐츠 페이지만 포함(옛 주소 이동 페이지 제외)

## 채널 허브

`src/data/channels.ts`의 `url`이 비어 있으면 ‘주소 정리 중’으로 표시됩니다.
확정된 주소만 채우고, 없는 주소를 만들어 넣지 않습니다.

## 검증

```bash
npm run build
python3 scripts/verify_v3.py   # dist를 4321로 직접 띄우고 검사한다(서버를 따로 켤 필요 없음)
```

`reports/buffetkimz-web/v3/`에 데스크톱(1280×800)·모바일(390×844·360×800) 스크린샷과
`verify-report.json`을 남깁니다. 확인 항목: 콘솔·HTTP 오류 0건, 68개 HTML 전수 응답,
내부 링크 0건 깨짐, 한국어 검색, 질문형 글→도구 이동, 색인/비색인(canonical·robots·noindex),
모바일 오버플로·12px 미만 글자·44px 미만 터치 영역.
