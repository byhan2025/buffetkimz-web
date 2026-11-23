#!/usr/bin/env python3
"""학습순환 P2 라이브/로컬 캡처 — v9.1.0 (트랙 화면 · 하단 독 · 도구 출구 · 카드 역링크)

왜 이 스크립트인가
  · `check_dock_collision.py`는 겹침·터치 타깃을 **수치로** 재고, `check_mobile_320.py`는 넘침을 잰다.
    하지만 새 화면이 '어떻게 보이는지'는 재는 값이 아니다 — 3단계 페이지의 위계, 하단 독의 세 칸,
    도구 출구의 세 줄이 실제로 읽히는지 눈으로 한 번 본다.
  · 결과는 `reports/buffetkimz-web/learning-loop/shots/`에 남긴다.

사용:
  npm run build && python3 scripts/capture_loop_p2.py           # 로컬 dist
  python3 scripts/capture_loop_p2.py --live                      # gh-pages 라이브
결과: learning-loop/shots/{390,1280}-p2-<이름>-<mode>.png
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
PORT = int(os.environ.get("P2_SHOT_PORT", "8323"))
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"


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


def pad_clip(box: dict | None, vw: int, vh: int, pad: int = 14) -> dict | None:
    if not box:
        return None
    x = max(box["x"] - pad, 0)
    y = max(box["y"] - pad, 0)
    w = min(box["width"] + pad * 2, vw - x)
    h = min(box["height"] + pad * 2, vh - y)
    return {"x": x, "y": y, "width": w, "height": h}


if MODE == "local":
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

written: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=Chrome, args=["--no-sandbox"])

    # ── 390px ──────────────────────────────────────────────────────────
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR",
                              device_scale_factor=2, has_touch=True)
    pg = ctx.new_page()

    # ① 트랙 단계 페이지 — 첫 화면(단계 이름·질문·배지)
    pg.goto(f"{BASE}{PREFIX}/academy/track/pension-tax/2/", wait_until="load")
    pg.wait_for_timeout(500)
    out = OUT / f"390-p2-track-stage-2-top-{MODE}.png"
    pg.screenshot(path=str(out))
    written.append(str(out))

    # ② 트랙 단계 페이지 — 화면 아래(손실 질문 + 하단 독)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(600)
    out = OUT / f"390-p2-track-stage-2-bottom-{MODE}.png"
    pg.screenshot(path=str(out))
    written.append(str(out))

    # ③ 글 하단 독 — 트랙에 속한 글(2단계)
    pg.goto(f"{BASE}{PREFIX}/posts/pension-master-02-tax-compare/", wait_until="load")
    pg.wait_for_timeout(500)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(600)
    out = OUT / f"390-p2-post-dock-{MODE}.png"
    pg.screenshot(path=str(out))
    written.append(str(out))

    # ④ 도구 실행 화면 출구 — 패널만
    pg.goto(f"{BASE}{PREFIX}/apps/pension-draw/run/", wait_until="load")
    pg.wait_for_timeout(700)
    el = pg.locator("[data-run-exit]").first
    el.scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    out = OUT / f"390-p2-run-exit-{MODE}.png"
    pg.screenshot(path=str(out), clip=pad_clip(el.bounding_box(), 390, 844))
    written.append(str(out))

    # ⑤ 카드 → 글/단계 역링크 1줄
    pg.goto(f"{BASE}{PREFIX}/gallery/three-buckets-3d/", wait_until="load")
    pg.wait_for_timeout(700)
    el = pg.locator("[data-card-track-link]").first
    el.scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    out = OUT / f"390-p2-gallery-reverse-{MODE}.png"
    pg.screenshot(path=str(out), clip=pad_clip(el.bounding_box(), 390, 844))
    written.append(str(out))

    # ⑥ 아카데미 허브의 트랙 진입 밴드
    pg.goto(f"{BASE}{PREFIX}/academy/", wait_until="load")
    pg.wait_for_timeout(600)
    el = pg.locator("#tracks-3step").first
    el.scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    out = OUT / f"390-p2-academy-trackband-{MODE}.png"
    pg.screenshot(path=str(out), clip=pad_clip(el.bounding_box(), 390, 844))
    written.append(str(out))
    ctx.close()

    # ── 1280px ─────────────────────────────────────────────────────────
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
    pg = ctx.new_page()
    pg.goto(f"{BASE}{PREFIX}/academy/track/pension-tax/2/", wait_until="load")
    pg.wait_for_timeout(500)
    out = OUT / f"1280-p2-track-stage-2-{MODE}.png"
    pg.screenshot(path=str(out))
    written.append(str(out))
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(500)
    out = OUT / f"1280-p2-track-stage-2-bottom-{MODE}.png"
    pg.screenshot(path=str(out))
    written.append(str(out))

    # 도구 출구 패널 전체 — 390px에서는 세로로 길어 잘리므로 데스크톱에서 한 장.
    # 고정 바(요약 바·가이드)는 캡처 동안만 감춘다(패널이 길어 스크롤 중 바가 패널 위에 그려진다).
    pg.goto(f"{BASE}{PREFIX}/apps/pension-draw/run/", wait_until="load")
    pg.wait_for_timeout(900)
    pg.add_style_tag(content="[data-sticky-summary],[data-guide-dock]{display:none!important}")
    el = pg.locator("[data-run-exit]").first
    el.scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    out = OUT / f"1280-p2-run-exit-{MODE}.png"
    el.screenshot(path=str(out))
    written.append(str(out))
    ctx.close()
    browser.close()

for path in written:
    print("  ", pathlib.Path(path).name)
print(f"{len(written)}장 저장 · {OUT}")
