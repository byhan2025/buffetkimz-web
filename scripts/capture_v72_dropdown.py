#!/usr/bin/env python3
"""v7.2 드롭다운 확인 캡처 — 데스크톱 1280 / 모바일 390 (열린 상태)."""
from __future__ import annotations

import http.server
import os
import pathlib
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v72-gallery")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8177
PREFIX = "/buffetkimz-web"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def main() -> int:
    httpd = None
    if MODE != "live":
        socketserver.TCPServer.allow_reuse_address = True
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # 데스크톱 — 각 메뉴 드롭다운
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        for i, name in enumerate(["posts", "apps", "calendar", "gallery", "about"]):
            page.evaluate(
                "(i) => document.querySelectorAll('[data-nav-toggle]')[i]?.click()",
                i,
            )
            page.wait_for_timeout(320)
            page.screenshot(path=str(OUT / f"{MODE}-drop-{name}-1280.png"))
            page.evaluate("() => document.querySelectorAll('[data-nav-toggle]')[0]?.click()")
            page.wait_for_timeout(200)
        # 호버로 열리는지
        page.hover("[data-nav-group]:nth-child(1) .nav-link")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / f"{MODE}-drop-hover-1280.png"))
        page.mouse.move(640, 700)
        page.wait_for_timeout(300)
        page.close()

        # 모바일 — 퀵 탭 패널
        page = browser.new_page(viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True)
        page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        for i, name in zip([1, 2, 3, 4], ["posts", "apps", "calendar", "gallery"]):
            page.click(f"[data-quick-tabs] li:nth-child({i+1}) a")
            page.wait_for_timeout(320)
            page.screenshot(path=str(OUT / f"{MODE}-m-drop-{name}-390.png"))
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
        page.close()
        browser.close()
    if httpd:
        httpd.shutdown()
    print("saved", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
