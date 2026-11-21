#!/usr/bin/env python3
"""v7.8.0 라이브 확인용 캡처 — 자료앨범에 새로 올린 3D 스토리 캐러셀 2세트.

라이브(gh-pages) /gallery/ 를 1280·390으로 열어
  · 페이지 전체(카드 8세트)
  · 새 세트 두 장(실손 계약전환 · 연말 900만 원) 카드 단위
를 저장하고, 새 이미지 12장이 실제로 로드됐는지(naturalWidth)와
390 가로 넘침 0을 함께 확인한다.

사용: python3 scripts/capture_v78_gallery.py [--live]
결과: reports/buffetkimz-web/v78-gallery/
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v78-gallery")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = (
    os.environ.get("PW_CHROME")
    or "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = 8178
PREFIX = "/buffetkimz-web"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"

NEW_SETS = ("silson-switch-3d", "pension-900-3d")

CHECK_JS = """() => {
  const cards = [...document.querySelectorAll('[data-gallery-item]')];
  const stages = [...document.querySelectorAll('[data-gallery-stage]')];
  return {
    cards: cards.length,
    ids: cards.map(c => c.dataset.galleryItem),
    thumbs: document.querySelectorAll('[data-gallery-thumb]').length,
    status: document.querySelector('[data-gallery-status]')?.innerText.replace(/\\s+/g,' ').trim() ?? '',
    stage_images: stages.map(i => ({src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight})),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}"""


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

    report: dict = {"mode": MODE, "shots": [], "checks": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        for label, w, h in (("1280", 1280, 900), ("390", 390, 844)):
            page = browser.new_page(viewport={"width": w, "height": h}, locale="ko-KR")
            page.goto(f"{BASE}/gallery/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(900)

            # 지연 로드 썸네일까지 모두 화면에 넣는다.
            for i in range(page.evaluate("() => document.querySelectorAll('[data-gallery-item]').length")):
                page.evaluate(
                    "(i) => document.querySelectorAll('[data-gallery-item]')[i]?.scrollIntoView({block:'center'})",
                    i,
                )
                page.wait_for_timeout(220)
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(400)

            data = page.evaluate(CHECK_JS)
            report["checks"][label] = data

            full = OUT / f"gallery-{label}-full.png"
            page.screenshot(path=str(full), full_page=True)
            report["shots"].append(str(full))

            top = OUT / f"gallery-{label}-top.png"
            page.screenshot(path=str(top))
            report["shots"].append(str(top))

            for set_id in NEW_SETS:
                el = page.locator(f'[data-gallery-item="{set_id}"]')
                if el.count():
                    path = OUT / f"{set_id}-{label}.png"
                    el.first.scroll_into_view_if_needed()
                    page.wait_for_timeout(250)
                    el.first.screenshot(path=str(path))
                    report["shots"].append(str(path))

            page.close()

        browser.close()
    if httpd:
        httpd.shutdown()

    (OUT / f"checks-{MODE}.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk in ("cards", "thumbs", "status", "overflow")} for k, v in report["checks"].items()}, ensure_ascii=False, indent=2))
    print("\n".join(report["shots"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
