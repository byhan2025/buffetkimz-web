#!/usr/bin/env python3
"""디자인·구성 육안 검토용 캡처 — 2026-11-24 전수 감사(김대표 지시 4관점).

로컬 dist 를 1440·390 두 폭으로 열어 페이지별 전면(스크롤 전체) 캡처를 남긴다.
결과: /workspace/reports/buffetkimz-web/audit-20261124/design/{w}-{name}.png
"""
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/audit-20261124/design")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "--live" in sys.argv
PORT = 8230


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


if LIVE:
    BASE = "https://byhan2025.github.io/buffetkimz-web"
else:
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

PAGES = [
    ("home", "/"),
    ("posts", "/posts/"),
    ("post", "/posts/insurance-ltc-premium-worth/"),
    ("apps", "/apps/"),
    ("app", "/apps/pension-tax/"),
    ("calendar", "/calendar/"),
    ("gallery", "/gallery/"),
    ("gallery-set", "/gallery/pension-accounts/"),
    ("academy", "/academy/"),
    ("lesson", "/academy/step2-pension-tax-limit/"),
    ("about", "/about/"),
    ("board", "/board/"),
    ("letters", "/letters/"),
    ("principles", "/principles/"),
]


def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for w, h in ((1440, 900), (390, 844)):
            ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg = ctx.new_page()
            for name, path in PAGES:
                pg.goto(BASE + path, wait_until="load")
                pg.wait_for_timeout(900)
                # 화면 밖 등장 애니메이션을 끝내려고 끝까지 내렸다 올린다
                pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                pg.wait_for_timeout(700)
                pg.evaluate("window.scrollTo(0, 0)")
                pg.wait_for_timeout(300)
                pg.screenshot(path=str(OUT / f"{w}-{name}.png"), full_page=True)
                print("captured", w, name)
            ctx.close()
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
