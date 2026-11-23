# buffetkimz-web — 작업 규칙

통합 개인 브랜드 사이트(`buffetkimz.com`, GitHub Pages). Astro 기반. 2026-11-23 현재 `package.json` 버전 `9.0.0`(학습순환 P1 — 숫자 배지 첫 노출).

> 설치 시점: v8.6.0 작업이 끝나고 `main` 이 정리된 뒤에 이 파일을 `apps/buffetkimz-web/AGENTS.md` 로 넣는다. `scripts/apply-agents-md.sh --app buffetkimz-web --force`.

## 검증

```bash
scripts/dev-gate.sh --app buffetkimz-web --fast                  # astro check + verify:tax + verify:v77
scripts/dev-gate.sh --app buffetkimz-web --full --allow-build    # 빌드까지
```

- 라이브 확인은 `scripts/capture_live_v*.py` 계열 캡처로 남긴다. 캡처 경로를 보고에 적는다.
- 문구·숫자 일관성은 `verify:*` 스크립트가 본다. 새 불변식이 생기면 규칙을 글로 쓰기 전에 스크립트로 만든다.
- 계산기·도구(앱스토어 카드 51장)를 손대면 `.agents/skills/README.md` 색인에서 해당 스킬을 먼저 읽는다: 용어·요율→`domain-modeling`·`research`, 계산→`tdd-seam`, 시안→`prototype`, 등록 6곳 부담→`improve-codebase-architecture`.

## 경계

- `deploy_domain.sh`, `deploy_pages.sh` 는 도메인·DNS·라이브를 건드린다. 승인 없이 실행하지 않는다(단방향 문).
- 카드 이미지는 **WebP만 배포한다**(`public/gallery/*.webp` + `public/gallery/thumbs/`). 새 카드를 PNG로 렌더했다면
  `python3 scripts/make_gallery_webp.py`로 변환해야 화면에 나타난다(원본 PNG는 `assets/gallery-png/`로 이동).
- 글↔카드 짝은 `src/data/gallery.ts`의 `post`와 글 frontmatter `cards`가 짝을 이룬다. 한쪽만 고치면 빌드가 선다.
- 배포 뒤에는 라이브 URL 과 캡처로 확인한 것만 "완료"라고 보고한다.
- 비주얼 정본은 `guidelines/buffetkimz-fixed-visual-template.md`, 모션·전환 취향은 그 문서와 `boban-fixed-visual-template.md`.
- 브랜드 분리: 보반과 버핏킴즈는 별개 브랜드다. 한쪽 문구를 다른 쪽에 복사하지 않는다.
- 이 저장소에는 테스트 CI 가 없다(GitHub Actions 는 Pages 배포 하나뿐). `dev-gate.sh` 와 `verify:*` 가 게이트다.
