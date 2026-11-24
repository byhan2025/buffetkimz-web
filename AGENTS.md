# buffetkimz-web — 작업 규칙

통합 개인 브랜드 사이트(`buffetkimz.com`, GitHub Pages). Astro 기반. 2026-11-24 현재 `package.json` 버전 `9.2.0`(전용 도구실 — 비밀번호 잠금 방).

> 설치 시점: v8.6.0 작업이 끝나고 `main` 이 정리된 뒤에 이 파일을 `apps/buffetkimz-web/AGENTS.md` 로 넣는다. `scripts/apply-agents-md.sh --app buffetkimz-web --force`.

## 디자인 (새 페이지·카드 작업 전에 읽는다)

- **정본은 `apps/buffetkimz-web/DESIGN.md`** 다. 토큰(색·글꼴·간격·모션), 44px 터치, 카드·표 규칙, 문구 규칙(줄표 3개 이하·금지어·중점 메타·화살표 금지), 접근성 하한선이 한 장에 있다. 화면과 문서가 어긋나면 문서가 아니라 **화면을 고친다**. 문서 §7이 지금 어긋난 곳의 목록이다.
- **만들 때**: `frontend-design`(색·타이포·레이아웃 계획을 먼저 글자로) → `ui-ux-pro-max`(값·스택 지침 검색) → `hallmark`의 Floor와 `DESIGN.md`(우리 규격).
  · `read_file .agents/skills/frontend-design/SKILL.md`
  · `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<제품·주제 2~5단어>" --design-system` / `--domain ux|style|color|typography` / `--stack astro`
- **점검할 때**: `hallmark`의 `sloplint.mjs`(기계 판정, FAIL 0까지) → `web-design-guidelines`(접근성·포커스·폼·모션 체크리스트) → 1440·390 캡처로 눈 확인.
  · `node .agents/skills/hallmark/scripts/sloplint.mjs <파일|폴더> --genre editorial --render`
  · `read_file .agents/skills/web-design-guidelines/references/command.md`
  · 감사 절차는 `.agents/skills/hallmark/references/redesign.md`의 `audit` 항, 판단 게이트는 `references/gates.md`
- 새 페이지·카드가 `DESIGN.md`를 벗어나야 한다면, 먼저 `DESIGN.md`를 고치고 그 이유를 커밋 메시지에 남긴다(문서와 화면이 조용히 갈라지지 않게).

## 검증

```bash
scripts/dev-gate.sh --app buffetkimz-web --fast                  # astro check + verify:tax + verify:v77
scripts/dev-gate.sh --app buffetkimz-web --full --allow-build    # 빌드까지
npm run verify:vault                                            # 전용 도구실(잠금·복호화·평문 0) 1440·390 실측
```

- 라이브 확인은 `scripts/capture_live_v*.py` 계열 캡처로 남긴다. 캡처 경로를 보고에 적는다.
- 문구·숫자 일관성은 `verify:*` 스크립트가 본다. 새 불변식이 생기면 규칙을 글로 쓰기 전에 스크립트로 만든다.
- 계산기·도구(앱스토어 카드 51장)를 손대면 `.agents/skills/README.md` 색인에서 해당 스킬을 먼저 읽는다: 용어·요율→`domain-modeling`·`research`, 계산→`tdd-seam`, 시안→`prototype`, 등록 6곳 부담→`improve-codebase-architecture`.

## 경계

- **전용 도구실(`/apps/` 안 `🔒`)**: 내부·실무 도구 3종은 이 방에만 둔다.
  · 도감 목록 원문은 `apps/buffetkimz-web/.vault/tools.source.json`, 비밀번호는 `.vault/pass.txt`(둘 다 gitignore).
  · 고칠 때는 원문 수정 → `npm run vault:build`(PBKDF2 310,000회 + AES-256-GCM 암호문 재생성) → `npm run vault:check` → `npm run verify:vault`.
  · 도구 이름·주소가 `src/` 나 `dist/` 에 평문으로 나오면 그 자체가 사고다. 진열대·검색·사이트맵·글에는 절대 올리지 않는다(콘텐츠로 홍보하는 글도 만들지 않는다).
  · 옛 `/apps/bojang-counsel-guide` 등 옛 주소는 리다이렉트를 만들지 않고 404 로 둔다.
- `deploy_domain.sh`, `deploy_pages.sh` 는 도메인·DNS·라이브를 건드린다. 승인 없이 실행하지 않는다(단방향 문).
- 카드 이미지는 **WebP만 배포한다**(`public/gallery/*.webp` + `public/gallery/thumbs/`). 새 카드를 PNG로 렌더했다면
  `python3 scripts/make_gallery_webp.py`로 변환해야 화면에 나타난다(원본 PNG는 `assets/gallery-png/`로 이동).
- 글↔카드 짝은 `src/data/gallery.ts`의 `post`와 글 frontmatter `cards`가 짝을 이룬다. 한쪽만 고치면 빌드가 선다.
- 배포 뒤에는 라이브 URL 과 캡처로 확인한 것만 "완료"라고 보고한다.
- 비주얼 정본은 `guidelines/buffetkimz-fixed-visual-template.md`, 모션·전환 취향은 그 문서와 `boban-fixed-visual-template.md`.
- 브랜드 분리: 보반과 버핏킴즈는 별개 브랜드다. 한쪽 문구를 다른 쪽에 복사하지 않는다.
- 이 저장소에는 테스트 CI 가 없다(GitHub Actions 는 Pages 배포 하나뿐). `dev-gate.sh` 와 `verify:*` 가 게이트다.
