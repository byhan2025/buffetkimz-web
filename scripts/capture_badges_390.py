#!/usr/bin/env python3
"""숫자 배지 390px 캡처 — v9.0.0 P1 (LiveMetricBadge 첫 노출 육안 확인)

왜 이 스크립트인가
  · 배지는 '값 + 등락 + 기준 시각 + 출처'가 한 상자에 들어가는지가 전부다. 자동 검사(verify_metrics M2)는
    문자열이 있는지만 재므로, 390px에서 줄이 접히고 넘치지 않는 모양은 눈으로 한 번 더 본다.
  · `check_mobile_320.py`가 넘침·터치 타깃을 수치로 재고, 이 스크립트는 배지 블록만 잘라 그림으로 남긴다.

사용:
  npm run build && python3 scripts/capture_badges_390.py          # 로컬 dist
  python3 scripts/capture_badges_390.py --live                    # gh-pages 라이브
결과: reports/buffetkimz-web/learning-loop/shots/390-badge-<name>-<mode>.png
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

ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "learning-loop" / "shots"
OUT.mkdir(parents=True, exist_ok=True)
Chrome = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("BADGE_SHOT_PORT", "8321"))
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

# P1이 배지를 처음 붙인 화면 — 글 3편 중 2편 + 강의 1개 (같은 모양이 반복되므로 세 장이면 충분하다)
TARGETS = [
    ("post-02-tax-compare", "/posts/pension-master-02-tax-compare/"),
    ("post-05-draw-1500", "/posts/pension-master-05-draw-1500/"),
    ("lesson-2-3-pension-tax-limit", "/academy/step2-pension-tax-limit/"),
]


class Server(socketserver.TCPServer):
    allow_reuse_address = True


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


if MODE == "local":
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

written: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=Chrome, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR",
                              device_scale_factor=2, has_touch=True)
    pg = ctx.new_page()
    for name, path in TARGETS:
        pg.goto(f"{BASE}{PREFIX}{path}", wait_until="load")
        pg.wait_for_timeout(600)
        box_el = pg.locator("[data-metric-badges]").first
        box_el.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        box = box_el.bounding_box()
        pad = 16
        clip = {
            "x": max(box["x"] - pad, 0),
            "y": max(box["y"] - pad, 0),
            "width": min(box["width"] + pad * 2, 390 - max(box["x"] - pad, 0)),
            "height": box["height"] + pad * 2,
        }
        out = OUT / f"390-badge-{name}-{MODE}.png"
        pg.screenshot(path=str(out), clip=clip)
        written.append(str(out))
        print(f"  {path} → {out.name}  ({box['width']:.0f}×{box['height']:.0f})")
    browser.close()

print(f"{len(written)}장 저장 · {OUT}")
