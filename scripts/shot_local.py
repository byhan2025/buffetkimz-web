"""임시 캡처 도구 (v7.0 작업용) — dist를 로컬에서 서빙하며 지정 경로를 찍는다.

사용: python3 scripts/shot_local.py "/,/apps/,/about/" [widths]
"""
import os
import sys
import http.server
import socketserver
import threading
import pathlib

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v70-portal"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8196
PREFIX = "/buffetkimz-web"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def translate_path(self, p):
        p = p.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

routes = (sys.argv[1] if len(sys.argv) > 1 else "/").split(",")
widths = (sys.argv[2] if len(sys.argv) > 2 else "1280,390").split(",")

with sync_playwright() as p:
    b = p.chromium.launch(
        executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
        args=["--no-sandbox"],
    )
    for r in routes:
        for w in widths:
            w = int(w)
            h = 1000 if w >= 1000 else 844
            pg = b.new_page(viewport={"width": w, "height": h}, locale="ko-KR")
            errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}{r}", wait_until="networkidle")
            pg.wait_for_timeout(1200)
            pg.evaluate("() => window.scrollTo(0, 0)")
            name = r.strip("/").replace("/", "-") or "home"
            pg.screenshot(path=str(OUT / f"v-{name}-{w}.png"), full_page=(w >= 1000))
            ov = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            print(r, w, "overflow", ov, "errors", errs[:2])
            pg.close()
    b.close()
httpd.shutdown()
