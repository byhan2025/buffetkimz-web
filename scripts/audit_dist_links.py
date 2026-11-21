#!/usr/bin/env python3
"""dist 전수 내부 링크·이미지 검사 (v5.8.1).

- dist 아래 모든 .html 을 읽어 href/src 를 모은다
- 내부 경로(/ 로 시작)는 실제 파일 존재 여부로 판정
- 외부(http)·앵커(#)·메일(mailto:)은 건너뛴다
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"
# Pages 서브패스(/buffetkimz-web) 빌드도 그대로 검사할 수 있게 접두를 떼고 본다.
BASE_PREFIX = "/buffetkimz-web"
ATTR = re.compile(r'(?:href|src)="([^"]+)"')

links: set[str] = set()
imgs: set[str] = set()
bad_links: dict[str, list[str]] = {}
bad_imgs: dict[str, list[str]] = {}
all_imgs: set[str] = set()
pages = sorted(ROOT.rglob("*.html"))


imports_total = 0
for page in pages:
    html = page.read_text(encoding="utf-8", errors="ignore")
    page_url = "/" + str(page.relative_to(ROOT))
    for raw in ATTR.findall(html):
        val = raw.strip()
        if not val or val.startswith(("#", "http://", "https://", "mailto:", "tel:", "data:", "//", "javascript:")):
            continue
        path = unquote(urlsplit(val).path)
        if path.startswith(BASE_PREFIX):
            path = path[len(BASE_PREFIX):] or "/"
        if not path.startswith("/"):
            continue
        imports_total += 1
        is_img = val in html and re.search(rf'<img[^>]+src="{re.escape(raw)}"', html) is not None
        (imgs if is_img else links).add(path)
        if is_img:
            all_imgs.add(path)

    # 페이지 단위로 바로 존재 검사 (어느 페이지에서 깨졌는지 남기기 위해)
    for raw in ATTR.findall(html):
        val = raw.strip()
        if not val or val.startswith(("#", "http://", "https://", "mailto:", "tel:", "data:", "//", "javascript:")):
            continue
        path = unquote(urlsplit(val).path)
        if path.startswith(BASE_PREFIX):
            path = path[len(BASE_PREFIX):] or "/"
        if not path.startswith("/"):
            continue
        target = ROOT / path.lstrip("/")
        ok = target.exists()
        if not ok:
            if path.endswith("/"):
                ok = (target / "index.html").exists()
            elif not target.suffix:
                ok = (target / "index.html").exists() or (ROOT / (path.lstrip("/") + ".html")).exists()
            else:
                ok = (ROOT / (path.lstrip("/") + ".html")).exists()
        if not ok:
            bucket = bad_imgs if re.search(rf'<img[^>]+src="{re.escape(raw)}"', html) else bad_links
            bucket.setdefault(path, []).append(page_url)

out = {
    "pages": len(pages),
    "checked_refs": imports_total,
    "unique_internal_paths": len(links | imgs),
    "unique_images": len(all_imgs),
    "bad_links": len(bad_links),
    "bad_imgs": len(bad_imgs),
    "bad_link_detail": {k: v[:3] for k, v in list(bad_links.items())[:20]},
    "bad_img_detail": {k: v[:3] for k, v in list(bad_imgs.items())[:20]},
}
print(json.dumps(out, ensure_ascii=False, indent=2))
sys.exit(0 if not bad_links and not bad_imgs else 1)
