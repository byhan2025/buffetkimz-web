#!/usr/bin/env python3
"""v7.7 작업용 임시 캡처 — 셀렉터 하나를 390/1280으로 찍는다.

사용: python3 scripts/shot_el.py "/" "[data-main-tools]" 390,1280 out-name
"""
import os, sys, http.server, socketserver, threading, pathlib
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v77-quality95"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8198
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

route = sys.argv[1] if len(sys.argv) > 1 else "/"
sel = sys.argv[2] if len(sys.argv) > 2 else "body"
widths = (sys.argv[3] if len(sys.argv) > 3 else "390,1280").split(",")
name = sys.argv[4] if len(sys.argv) > 4 else "shot"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell", args=["--no-sandbox"])
    for w in widths:
        w = int(w)
        pg = b.new_page(viewport={"width": w, "height": 1000 if w >= 1000 else 844}, locale="ko-KR", device_scale_factor=2)
        pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}{route}", wait_until="networkidle")
        pg.wait_for_timeout(1200)
        el = pg.query_selector(sel)
        path = OUT / f"{name}-{w}.png"
        if el:
            el.scroll_into_view_if_needed()
            pg.wait_for_timeout(300)
            el.screenshot(path=str(path))
            box = el.bounding_box()
            print("shot", path, "box", {k: round(v) for k, v in (box or {}).items()})
        else:
            pg.screenshot(path=str(path), full_page=True)
            print("shot(full)", path, "selector not found:", sel)
        # 넘침 진단
        info = pg.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})")
        print("  width", info)
        pg.close()
    b.close()
