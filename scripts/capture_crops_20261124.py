#!/usr/bin/env python3
"""특정 위치 뷰포트 캡처 — 육안 검토용(작게 줄어든 전면 캡처 대신 읽히는 크기로).

사용: python3 scripts/capture_crops_20261124.py
결과: reports/buffetkimz-web/audit-20261124/crops/{w}-{name}-{y}.png
"""
from __future__ import annotations

import http.server
import os
import pathlib
import socketserver
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/audit-20261124/crops")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = 8232

SHOTS = [
    # (이름, 경로, 1440 스크롤, 390 스크롤)
    ("posts-grid", "/posts/", 1500, 1400),
    ("post-body", "/posts/insurance-ltc-premium-worth/", 1500, 1200),
    ("apps-grid", "/apps/", 1200, 900),
    ("app-detail", "/apps/pension-tax/", 700, 700),
    ("board", "/board/", 1200, 1000),
    ("gallery", "/gallery/", 900, 800),
    ("academy-hero", "/academy/", 700, 600),
    ("letters", "/letters/", 0, 0),
    ("calendar", "/calendar/", 800, 700),
]


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, p):
        q = p.split("?")[0].split("#")[0]
        if q.startswith("/buffetkimz-web/"):
            q = q[len("/buffetkimz-web"):]
        elif q == "/buffetkimz-web":
            q = "/"
        return super().translate_path(q)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for w, h in ((1440, 900), (390, 844)):
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg = ctx.new_page()
        for name, path, y1440, y390 in SHOTS:
            y = y1440 if w == 1440 else y390
            pg.goto(BASE + path, wait_until="load")
            pg.wait_for_timeout(600)
            pg.evaluate(f"window.scrollTo(0, {y})")
            pg.wait_for_timeout(700)
            pg.screenshot(path=str(OUT / f"{w}-{name}.png"))
            print("crop", w, name)
        ctx.close()
    b.close()
