#!/usr/bin/env python3
"""v5.9.2 결과물 묶음 — 리뷰어가 압축을 풀어 **검증을 그대로 다시 돌릴 수 있는** zip 을 만든다.

포함
  apps/buffetkimz-web/dist                     빌드 산출물(검증 대상)
  apps/buffetkimz-web/src                      소스(today.ts · fresh.ts · hub-fresh-dom.ts · 컴포넌트)
  apps/buffetkimz-web/scripts                  verify_v59.py · audit_dist_links.py · update_today_hub.py · 테스트 · 캡처
  apps/buffetkimz-web/package.json · README.md
  reports/buffetkimz-web/v592-hub              보고서 · 캡처 · 계측 JSON
  reports/buffetkimz-web/v59-hub/00-v59-report.md  (v5.9.0 보고서, 정정 반영분)
  README-재현.md                               압축 푼 뒤 실행 순서

제외: node_modules · .git · dist-adpreview/dist-domain-root/dist-subpath(다른 배포판) · public(이미지 원본)
결과: reports/buffetkimz-web/v592-hub/buffetkimz-v592-bundle.zip (15MB 이하)
"""
from __future__ import annotations

import pathlib
import zipfile

APP = pathlib.Path(__file__).resolve().parent.parent
REPO = APP.parent.parent
OUT = REPO / "reports" / "buffetkimz-web" / "v592-hub"
NAME = "buffetkimz-v592-bundle.zip"
ROOT_IN_ZIP = "buffetkimz-v592"

READ_ME = """# buffetkimz v5.9.2 — 압축을 푼 뒤 검증 다시 돌리기

이 폴더는 v5.9.2 마감 패치의 **빌드 산출물과 검증 스크립트**를 같은 구조로 담았습니다.
압축을 풀면 아래 구조가 나옵니다.

```
buffetkimz-v592/
  apps/buffetkimz-web/{dist, src, scripts, package.json, README.md}
  reports/buffetkimz-web/v592-hub/{00-v592-report.md, 캡처, capture-notes.json, verify-v59.json}
  reports/buffetkimz-web/v59-hub/00-v59-report.md
```

## 1) 전수 검증 (88항목)

```bash
cd buffetkimz-v592
python3 apps/buffetkimz-web/scripts/verify_v59.py
```

- 경로는 모두 스크립트 위치 기준 상대경로입니다(`APP = scripts/의 부모의 부모`).
- `node` 가 PATH 에 있으면 신선도·D-Day 단위 검증까지 실행합니다(없으면 그 항목만 실패로 표시).
- 결과는 `reports/buffetkimz-web/v592-hub/verify-v59.json` 에 덮어씁니다.
- 캡처 계측(`capture-notes.json`)이 함께 들어 있어 런타임 전환·390 포커스·잘림·**스와이프 페이드** 검사도 재실행됩니다.
- `reports/buffetkimz-web/v592-hub/usd-krw-evidence.txt` · `usd-krw-raw.json` — 원/달러 1,346.50원·06:28 고시의 네이버 금융 원문 근거입니다(화면 값과 대조).

## 2) 파이프라인 초안 테스트 (29건)

```bash
python3 apps/buffetkimz-web/scripts/test_update_today_hub.py
```

## 3) 화면을 다시 찍고 싶을 때 (선택)

```bash
cd apps/buffetkimz-web
npm ci            # 처음 한 번 (node 22 이상)
npm run build     # dist 재생성 (84페이지)
python3 scripts/capture_v592.py   # Playwright 필요 (1280·390 · 런타임 전환 · 포커스)
```

## 참고

- 이 묶음에는 **라이브 배포본이 아닙니다**. `gh-pages` 푸시는 하지 않았습니다(지시대로).
- 캡처는 1280·390 두 폭, 지표 칩 포커스(390, Tab), 오른쪽 24px 스와이프 페이드, 모킹된 미래 시각의 '확인 지연' 상태를 포함합니다.
- 화면은 아직 **수동 확인 모드**입니다(`scheduleConnected: false`). `scripts/update_today_hub.py`가 한 번이라도 실제로 돌면 true로 바뀌고 '자동 확인' 문구가 켜집니다(테스트 5건으로 검증).
"""


def add_tree(zf: zipfile.ZipFile, src: pathlib.Path, dest: str, skip: set[pathlib.Path] | None = None) -> int:
    skip = skip or set()
    n = 0
    for path in sorted(src.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(src)
        if any(part in {".git", "node_modules", "__pycache__"} for part in rel.parts):
            continue
        if path.resolve() in skip:
            continue
        zf.write(path, f"{dest}/{rel.as_posix()}")
        n += 1
    return n


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / NAME
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        count = 0
        count += add_tree(zf, APP / "dist", f"{ROOT_IN_ZIP}/apps/buffetkimz-web/dist")
        count += add_tree(zf, APP / "src", f"{ROOT_IN_ZIP}/apps/buffetkimz-web/src")
        count += add_tree(zf, APP / "scripts", f"{ROOT_IN_ZIP}/apps/buffetkimz-web/scripts")
        for name in ("package.json", "package-lock.json", "astro.config.mjs", "tsconfig.json", "README.md"):
            path = APP / name
            if path.exists():
                zf.write(path, f"{ROOT_IN_ZIP}/apps/buffetkimz-web/{name}")
                count += 1
        count += add_tree(
            zf, OUT, f"{ROOT_IN_ZIP}/reports/buffetkimz-web/v592-hub", skip={target.resolve()}
        )
        v59 = REPO / "reports" / "buffetkimz-web" / "v59-hub" / "00-v59-report.md"
        if v59.exists():
            zf.write(v59, f"{ROOT_IN_ZIP}/reports/buffetkimz-web/v59-hub/00-v59-report.md")
            count += 1
        zf.writestr(f"{ROOT_IN_ZIP}/README-재현.md", READ_ME)
        count += 1
    size = target.stat().st_size
    print(f"{target} — {count} files, {size/1024/1024:.2f} MB")
    return 0 if size <= 15 * 1024 * 1024 else 1


if __name__ == "__main__":
    raise SystemExit(main())
