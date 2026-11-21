#!/usr/bin/env python3
"""v7.2 확인용 캡처 — 헤더·드로어·크레딧·허브 CTA."""
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
PORT = 8176
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

    tag = MODE
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # 데스크톱 — 헤더 + 필름 아래 크레딧 + 허브 상단
        for w, h in ((1280, 900), (768, 900)):
            page = browser.new_page(viewport={"width": w, "height": h}, locale="ko-KR")
            page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"{tag}-home-top-{w}.png"))
            page.evaluate("() => document.querySelector('#film-credits')?.scrollIntoView({block:'start'})")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{tag}-home-credits-{w}.png"))
            page.evaluate("() => document.querySelector('#today')?.scrollIntoView({block:'start'})")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{tag}-home-hub-{w}.png"))
            page.close()

        # 모바일 — 헤더, 드로어 열림, 크레딧, 허브
        for w, h in ((390, 844), (360, 780)):
            page = browser.new_page(viewport={"width": w, "height": h}, locale="ko-KR", is_mobile=True, has_touch=True)
            page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"{tag}-home-top-{w}.png"))
            page.evaluate("() => document.querySelector('#film-credits')?.scrollIntoView({block:'start'})")
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / f"{tag}-home-credits-{w}.png"))
            page.evaluate("() => document.querySelector('#today')?.scrollIntoView({block:'start'})")
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / f"{tag}-home-hub-{w}.png"))
            page.evaluate("() => window.scrollTo(0,0)")
            page.wait_for_timeout(250)
            page.click("[data-menu-toggle]")
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / f"{tag}-drawer-{w}.png"))
            page.close()

        # /gallery 상단
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page.goto(f"{BASE}/gallery/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / f"{tag}-gallery-top-1280.png"))
        page.close()

        browser.close()
    if httpd:
        httpd.shutdown()
    print("saved to", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
