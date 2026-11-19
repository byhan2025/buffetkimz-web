# buffetkimz-web

`buffetkimz.com` — 금융과 돈에 관한 기록(블로그) + 통합 검색 + 직접 만든 도구 5종 + 제도달력.
v3: 20개 대표 사이트 벤치마킹(보고서 `reports/buffetkimz-web/benchmark-20-sites-2026-11-19.md`)에 따라
디자인·정보구조를 전면 개편했습니다. 밝은 화이트·스카이블루 히어로, 잉크 네이비(`#0B1B29`)는
도구 미리보기 카드와 하단 강조 구간에만, 행동은 제이드(`#146C58`)로. 홈은 4장면 리듬
(화이트블루 → 크림 기록 → 화이트 도구 → 네이비 제도·채널 → 크림 푸터)입니다.

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
  비중증 비급여 50%), 고지 자가체크에서 2년 이력을 5년 기준에도 포함(305·355 판정 역전 제거),
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
- 실측 검증: `python3 scripts/verify_v3.py`(로컬 dist), `python3 scripts/verify_live.py`(라이브 URL).
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
│   ├── apps.ts               # 앱 5종(만든 이유·기능·기준·가정·실행 경로)
│   ├── tools.ts              # 홈·도구 허브의 도구 5종(무엇을 확인·계산하는가)
│   ├── channels.ts           # 채널 허브 슬롯(주소 확정 시 url만 채우면 링크)
│   └── calendar.ts           # 1~12월 제도 일정
├── lib/
│   ├── posts.ts              # 컬렉션 조회·경로·날짜·마크다운 제거
│   ├── coverage.ts           # 5대 담보 기준점(도구 실행 화면과 홈 미리보기가 공유)
│   └── search.ts             # 한국어 부분일치·다중 키워드·스니펫·하이라이트
├── components/
│   ├── Header / Footer / Seo / AdSlot / Redirect / AppArt / PostList
│   ├── HeroToolCard.astro    # 히어로의 도구 실화면 미리보기(예시 입력값·출처·기준일)
│   ├── CoverageGauge.astro   # 5대 담보 5칸 게이지 도해
│   ├── PostCards.astro       # 질문 → 글 → 도구 직결 3열 카드
│   ├── PostFeed.tsx          # 카테고리 탭 피드(현재 기록 목록은 PostCards 사용)
│   ├── SearchInline.tsx      # 인라인 검색(현재 홈에서는 미사용, 검색은 헤더 오버레이)
│   ├── SearchApp.tsx         # 검색 페이지·오버레이 공용
│   ├── HeaderSearch.tsx      # 헤더 검색 버튼 + 전체 화면 오버레이
│   ├── CalendarBoard.tsx     # 월별 제도달력
│   └── tools/                # 계산기 4종 + 공통 UI
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
