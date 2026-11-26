#!/usr/bin/env python3
"""2026-11-26 06:15 회차 — 예금자보호 글 로컬/라이브 캡처 (390·1280).

재는 것: HTTP 200 · 콘솔 오류 0 · 가로 넘침 0 · 표 4행 · 비교 카드 · 출처 링크 수 · 썸네일 로드
사용:  python3 scripts/capture_post_20261125_1915.py [--live]
결과:  /workspace/reports/buffetkimz-web/board/{local|live}-20261127-0615-post-*.png
"""
from __future__ import annotations

import http.server
import json
import mimetypes
import os
import pathlib
import socketserver
import sys
import threading

APP = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = "--live" in sys.argv
SLUG = "pension-after-60-continue-breakeven"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/board")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PREFIX = "/buffetkimz-web"
PORT = int(os.environ.get("POST_PORT", "8377"))
LOCAL_BASE = f"http://127.0.0.1:{PORT}{PREFIX}"
LIVE_BASE = "https://byhan2025.github.io/buffetkimz-web"

mimetypes.add_type("image/webp", ".webp")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, path):
        q = path.split("?", 1)[0].split("#", 1)[0]
        if q == PREFIX:
            q = "/"
        elif q.startswith(PREFIX + "/"):
            q = q[len(PREFIX):]
        return super().translate_path(q)

    def log_message(self, *a):
        pass


class Server(socketserver.TCPServer):
    allow_reuse_address = True


BASE = LIVE_BASE
if not LIVE:
    threading.Thread(target=Server(("127.0.0.1", PORT), Handler).serve_forever, daemon=True).start()
    BASE = LOCAL_BASE

tag = "live" if LIVE else "local"
URL = f"{BASE}/posts/{SLUG}/"
report: dict = {"url": URL, "viewports": {}}

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    for width, height in ((390, 844), (1280, 900)):
        page = browser.new_page(viewport={"width": width, "height": height})
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        resp = page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1600)
        overflow = page.evaluate(
            "() => document.documentElement.scrollWidth - window.innerWidth"
        )
        rows = page.evaluate(
            "() => Array.from(document.querySelectorAll('table tr')).length"
        )
        compare = page.evaluate(
            "() => !!document.querySelector('[class*=compare], [data-compare], .cmp')"
        )
        sources = page.evaluate(
            "() => Array.from(document.querySelectorAll('a[href^=http]')).filter(a => !a.href.includes('byhan2025') && !a.href.includes('buffetkimz.com')).length"
        )
        thumb_ok = page.evaluate(
            "() => Array.from(document.images).some(i => i.currentSrc.includes('pension-after-60-continue-breakeven') && i.naturalWidth > 0)"
        )
        h1 = page.evaluate("() => document.querySelector('h1')?.innerText?.trim() || ''")
        banned = page.evaluate(
            "() => ['실시간','속보','긴급'].filter(w => document.body.innerText.includes(w))"
        )
        page.screenshot(path=str(OUT / f"{tag}-20261127-0615-post-{width}.png"), full_page=False)
        report["viewports"][str(width)] = {
            "status": resp.status if resp else None,
            "consoleErrors": errors,
            "overflow": overflow,
            "tableRows": rows,
            "compareCard": compare,
            "externalSources": sources,
            "thumbLoaded": thumb_ok,
            "h1": h1,
            "banned": banned,
        }
        page.close()
    browser.close()

ok = all(
    v["status"] == 200 and not v["consoleErrors"] and v["overflow"] <= 0 and v["tableRows"] >= 4
    and v["compareCard"] and v["externalSources"] >= 3 and v["thumbLoaded"] and not v["banned"]
    for v in report["viewports"].values()
)
report["pass"] = ok
path = OUT / f"{tag}-20261127-0615-post.json"
path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
print(("✓ 통과" if ok else "✗ 실패") + f" — {path}")
sys.exit(0 if ok else 1)
