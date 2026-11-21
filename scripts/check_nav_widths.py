#!/usr/bin/env python3
"""v7.2 임시 실측 — 상단 메뉴(데스크톱)와 퀵 탭(모바일) 가로 폭 점검.

  · 데스크톱: 768 / 820 / 1024 / 1280 에서 nav 5칸이 한 줄에 들어가고 넘치지 않는가
  · 모바일: 320 / 360 / 390 에서 퀵 탭 6칸이 줄바꿈 없이(각 칸 한 줄) 들어가는가
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8175
PREFIX = "/buffetkimz-web"


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


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


NAV_JS = """() => {
  const nav = document.querySelector('nav[aria-label="주 메뉴"]');
  if (!nav) return null;
  const items = [...nav.querySelectorAll('a')];
  const r = nav.getBoundingClientRect();
  return {
    labels: items.map(a => a.innerText.trim()),
    navW: Math.round(r.width), navRight: Math.round(r.right),
    itemW: items.map(a => Math.round(a.getBoundingClientRect().width)),
    navH: Math.round(r.height),
    rowH: Math.round(document.querySelector('.site-header-row').getBoundingClientRect().height),
    rows: items.map(a => Math.round(a.getBoundingClientRect().top)),
    wrapW: Math.round(document.querySelector('.site-header-row').getBoundingClientRect().width),
    docOver: document.documentElement.scrollWidth - window.innerWidth,
  };
}"""

QUICK_JS = """() => {
  const list = document.querySelector('[data-quick-tabs]');
  if (!list) return null;
  const items = [...list.querySelectorAll('a')];
  const lines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
  };
  return {
    labels: items.map(a => a.innerText.trim()),
    cells: items.map(a => Math.round(a.parentElement.getBoundingClientRect().width)),
    textW: items.map(a => Math.round(a.firstChild ? (() => { const rg=document.createRange(); rg.selectNodeContents(a); return Math.max(...[...rg.getClientRects()].map(r=>r.width)); })() : 0)),
    textLines: items.map(lines),
    docOver: document.documentElement.scrollWidth - window.innerWidth,
    vw: window.innerWidth,
    listOverflow: Math.round(list.scrollWidth - list.clientWidth),
  };
}"""


def main() -> int:
    httpd = serve()
    out = {"desktop": {}, "mobile": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for w in (768, 820, 1024, 1280):
            page = browser.new_page(viewport={"width": w, "height": 900})
            page.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
            page.wait_for_timeout(300)
            out["desktop"][w] = page.evaluate(NAV_JS)
            page.close()
        for w in (320, 360, 390):
            page = browser.new_page(viewport={"width": w, "height": 780})
            page.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
            page.wait_for_timeout(300)
            out["mobile"][w] = page.evaluate(QUICK_JS)
            page.close()
        browser.close()
    httpd.shutdown()
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
