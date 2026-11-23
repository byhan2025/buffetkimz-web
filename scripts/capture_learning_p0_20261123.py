#!/usr/bin/env python3
"""새 글 2편(경제-C·노후-B) 라이브 390 캡처 — 2026-11-23 P0 빈틈 채움 확인용.

사용:
  python3 scripts/capture_learning_p0_20261123.py          # 라이브(기본)
  python3 scripts/capture_learning_p0_20261123.py --local  # dist 로컬 서버
결과: reports/buffetkimz-web/learning-loop/shots/*.png
"""
from __future__ import annotations

import http.server
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

DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "learning-loop" / "shots"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("P0_SHOT_PORT", "8341"))
LOCAL = "--local" in sys.argv
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web" if LOCAL else LIVE

POSTS = {
    "economy-fixed-cost-check": "economy-fixed-cost-check",
    "retire-pension-timing": "retire-pension-timing",
}


class Server(socketserver.TCPServer):
    allow_reuse_address = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIST), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        prefix = "/buffetkimz-web"
        if p == prefix:
            p = "/"
        elif p.startswith(prefix + "/"):
            p = p[len(prefix):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


if LOCAL:
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

saved: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for width in (390, 1280):
        ctx = browser.new_context(viewport={"width": width, "height": 844 if width == 390 else 900},
                                  locale="ko-KR", device_scale_factor=2)
        pg = ctx.new_page()
        for slug in POSTS:
            url = f"{BASE}/posts/{slug}/"
            resp = pg.goto(url, wait_until="load")
            pg.wait_for_timeout(900)
            if width == 390:
                path = OUT / f"post-{slug}-390.png"
                pg.screenshot(path=str(path), full_page=True)
                saved.append(str(path))
            else:
                path = OUT / f"post-{slug}-1280.png"
                pg.screenshot(path=str(path), full_page=False)
                saved.append(str(path))
            print(f"  {getattr(resp, 'status', None)} {width}px {url} → {path.name}")
        ctx.close()
    browser.close()

print("\n".join(saved))
