#!/usr/bin/env python3
"""1단계(AI 티·홈 첫 화면·아카데미 접기·숫자 정리) 화면 캡처 — 2026-11-24.

로컬 dist를 정적으로 서비스하고, 홈 첫 화면 1440/390 · 아카데미 1440/390 · 철학 목록 390을 찍는다.
`--live`면 gh-pages 라이브를 같은 조건으로 찍는다.

결과: reports/buffetkimz-web/phase1-20261124/*.png · capture.json
"""
from __future__ import annotations

import json
import os
import pathlib
import socketserver
import sys
import threading
import http.server

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "phase1-20261124"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"


# 서브패스 빌드(dist)는 /buffetkimz-web/ 아래에서만 CSS·JS를 찾는다.
# 그래서 dist의 부모에 같은 이름의 심볼릭 링크를 두고 그 부모를 서비스한다.
SERVE_ROOT = pathlib.Path("/tmp/bkz-phase1")
if SERVE_ROOT.exists():
    import shutil

    shutil.rmtree(SERVE_ROOT)
SERVE_ROOT.mkdir(parents=True)
(SERVE_ROOT / "buffetkimz-web").symlink_to(DIST)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(SERVE_ROOT), **kw)

    def log_message(self, *a):  # 조용히
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/buffetkimz-web"


def main() -> int:
    httpd, base = serve()
    report: dict = {"mode": MODE, "shots": [], "checks": {}}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        for name, w, h, path in [
            ("home-1440", 1440, 900, "/"),
            ("home-390", 390, 844, "/"),
            ("academy-1440", 1440, 900, "/academy/"),
            ("academy-390", 390, 844, "/academy/"),
            ("philosophy-390", 390, 844, "/posts/philosophy/"),
            ("posts-1440", 1440, 900, "/posts/"),
        ]:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto((LIVE if MODE == "live" else base) + path, wait_until="networkidle")
            page.wait_for_timeout(1200)
            file = OUT / f"{MODE}-{name}.png"
            page.screenshot(path=str(file))
            first = page.evaluate(
                """() => {
                  const q = (s) => document.querySelector(s);
                  const def = q('#hero-def');
                  const rect = def ? def.getBoundingClientRect() : null;
                  const cta = q('#hero-def a');
                  const ctaRect = cta ? cta.getBoundingClientRect() : null;
                  const h1 = q('h1');
                  return {
                    heroDefVisible: !!def && rect.top < window.innerHeight && rect.bottom > 0,
                    heroDefBottom: rect ? Math.round(rect.bottom) : null,
                    ctaHeight: ctaRect ? Math.round(ctaRect.height) : null,
                    viewportH: window.innerHeight,
                    hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    filmH: q('.film-stage') ? Math.round(q('.film-stage').getBoundingClientRect().height) : null,
                    academyPending: !!q('.academy-pending'),
                    pendingOpen: q('.academy-pending') ? q('.academy-pending').open : null,
                    prepText: (document.body.innerText.match(/준비 중/g) || []).length,
                    charMetric: (document.body.innerText.match(/[0-9],[0-9]{3}자/g) || []).length,
                  };
                }"""
            )
            report["shots"].append({"name": name, "file": str(file), "consoleErrors": errors, **first})
            ctx.close()
        browser.close()
    httpd.shutdown()
    (OUT / f"capture-{MODE}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2)[:4000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
