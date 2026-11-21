#!/usr/bin/env python3
"""v6.2 /about/ 캡처 — 라이브(배포 전/후) 1280·390 실측.

사용:
  python3 scripts/capture_about_v62.py before   # 라이브 현재 상태 진단
  python3 scripts/capture_about_v62.py after    # 라이브 v6.2.0 확인
  python3 scripts/capture_about_v62.py local    # dist/about 로컬 확인
"""
from __future__ import annotations

import http.server
import json
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v62-about"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
LIVE = "https://byhan2025.github.io/buffetkimz-web/about/"
PORT = 8141

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}


class Handler(http.server.SimpleHTTPRequestHandler):
    """dist를 /buffetkimz-web/ 접두 아래에서 서빙한다(서브패스 빌드 그대로 확인)."""

    PREFIX = "/buffetkimz-web"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == self.PREFIX:
            p = "/"
        elif p.startswith(self.PREFIX + "/"):
            p = p[len(self.PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      let e = el.parentElement, clip = null;
      while (e && e !== document.documentElement) {
        const ox = getComputedStyle(e).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { clip = String(e.className).slice(0,40); break; }
        e = e.parentElement;
      }
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), over: Math.round(r.right - vw), clip });
    }
  }
  return {
    docScroll: document.documentElement.scrollWidth,
    vw,
    overflow: Math.max(0, document.documentElement.scrollWidth - vw),
    wide: wide.slice(0, 6),
  };
}"""

SHOT_JS = """() => {
  const q = (s) => document.querySelector(s);
  const h = document.documentElement;
  return {
    height: h.scrollHeight,
    sections: [...document.querySelectorAll('main section')].map(s => ({
      id: s.id || null,
      cls: String(s.className).slice(0, 60),
      h: Math.round(s.getBoundingClientRect().height),
    })),
    h1: q('h1') ? q('h1').textContent.trim() : null,
  };
}"""


def run(mode: str) -> int:
    url = LIVE
    httpd = None
    if mode == "local":
        httpd = serve()
        url = f"http://127.0.0.1:{PORT}/buffetkimz-web/about/"
    report = {"mode": mode, "url": url, "viewports": {}}
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for label, vp in VIEWPORTS.items():
            page = browser.new_page(viewport=vp, device_scale_factor=1)
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            resp = page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(900)
            # 끝까지 훑어 등장 모션·카운트업을 모두 마친 뒤 맨 위에서 찍는다(숫자가 중간값으로 찍히지 않게)
            for _ in range(10):
                page.mouse.wheel(0, 700)
                page.wait_for_timeout(220)
            page.wait_for_timeout(1500)
            page.evaluate("() => window.scrollTo(0,0)")
            page.wait_for_timeout(600)
            status = resp.status if resp else None
            over = page.evaluate(OVERFLOW_JS)
            info = page.evaluate(SHOT_JS)
            name = f"{'before' if mode == 'before' else 'live' if mode == 'after' else 'local'}-about-{label}.png"
            page.screenshot(path=str(OUT / name), full_page=False)
            page.screenshot(path=str(OUT / name.replace(".png", "-full.png")), full_page=True)
            rec = {
                "status": status,
                "console_errors": errors,
                "overflow": over,
                "height": info["height"],
                "h1": info["h1"],
                "sections": info["sections"],
                "shot": str(OUT / name),
            }
            report["viewports"][label] = rec
            if status != 200:
                failures.append(f"{label}: HTTP {status}")
            if errors:
                failures.append(f"{label}: console {errors[:2]}")
            if over["overflow"] > 0:
                failures.append(f"{label}: overflow {over['overflow']}px {over['wide'][:2]}")
            page.close()
        browser.close()
    if httpd:
        httpd.shutdown()
    report["failures"] = failures
    (OUT / f"capture-{mode}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else "before"))
