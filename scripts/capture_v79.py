#!/usr/bin/env python3
"""v7.9.0 라이브/로컬 확인용 캡처 — 확정 공식 로고·파비콘·OG·다크 섹션.

  · 홈 1280 · 390 (상단·전체)
  · 헤더 로고 확대 컷(1280·390) · 푸터 로고 컷
  · /about/ 1280 (국문 다크 로고 히어로 · 시그니처 패널)
  · /gallery/ 1280
  · 브랜드 필름 씬5(8.6s) · 검색 오버레이
  · 로고 이미지 실제 로드(naturalWidth) — 빈 파일·404 잡기

사용: python3 scripts/capture_v79.py [--live]
결과: reports/buffetkimz-web/v79-official-logo/
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v79-official-logo")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = (
    os.environ.get("PW_CHROME")
    or "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("V79_PORT", "8179"))
PREFIX = "/buffetkimz-web"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"

CHECK_JS = """() => {
  const imgs = [...document.querySelectorAll('img')];
  const logos = imgs.filter(i => (i.currentSrc || i.src || '').includes('/brand/logo-'));
  const out = {
    logo_count: logos.length,
    logos: logos.map(i => ({
      file: (i.currentSrc || i.src).split('/').pop(),
      w: i.naturalWidth, h: i.naturalHeight,
      css_h: Math.round(i.getBoundingClientRect().height * 10) / 10,
      css_w: Math.round(i.getBoundingClientRect().width * 10) / 10,
    })),
    old_mark_svg: document.querySelectorAll('svg.brand-lockup__symbol').length,
    calligraphy: imgs.filter(i => (i.currentSrc || i.src || '').includes('calligraphy')).length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title,
  };
  const h = document.querySelector('.site-header');
  if (h) out.header = {h: Math.round(h.getBoundingClientRect().height)};
  return out;
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

    report: dict = {"mode": MODE, "shots": [], "checks": {}, "console_errors": []}

    def shot(page, name: str, el=None, full=False):
        path = OUT / f"{name}-{MODE}.png"
        if el is not None:
            el.screenshot(path=str(path))
        else:
            page.screenshot(path=str(path), full_page=full)
        report["shots"].append(str(path))
        return path

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        for label, w, h in (("1280", 1280, 900), ("390", 390, 844)):
            page = browser.new_page(viewport={"width": w, "height": h}, locale="ko-KR")
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1200)
            report["checks"][f"home-{label}"] = page.evaluate(CHECK_JS)
            shot(page, f"home-{label}-top")
            shot(page, f"home-{label}-full", full=True)
            # 헤더(로고 + 메뉴) 확대 컷
            header = page.locator(".site-header")
            if header.count():
                shot(page, f"header-{label}", el=header.first)
            # 푸터 로고 컷
            foot = page.locator("footer")
            if foot.count():
                foot.first.scroll_into_view_if_needed()
                page.wait_for_timeout(250)
                shot(page, f"footer-{label}", el=foot.first)
            report["console_errors"] += [f"home-{label}: {e}" for e in errors]
            page.close()

        # /about/ — 국문 다크 로고 히어로 + 시그니처 패널
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page.goto(f"{BASE}/about/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1000)
        report["checks"]["about-1280"] = page.evaluate(CHECK_JS)
        shot(page, "about-1280-top")
        panel = page.locator(".ab-sign-panel")
        if panel.count():
            shot(page, "about-1280-sign", el=panel.first)
        page.close()

        # /gallery/ 1280
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page.goto(f"{BASE}/gallery/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        report["checks"]["gallery-1280"] = page.evaluate(CHECK_JS)
        shot(page, "gallery-1280-top")
        page.close()

        # 브랜드 필름 씬5(브랜드 록업) · 검색 오버레이
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1500)
        try:
            page.evaluate("() => window.__bkFilm && window.__bkFilm.seek(8.8)")
        except Exception as exc:  # noqa: BLE001
            report["console_errors"].append(f"film seek: {exc}")
        page.wait_for_timeout(900)
        shot(page, "film-scene5-1280")
        btn = page.locator('button[aria-label="사이트 검색 열기"]')
        if btn.count():
            btn.first.click()
            page.wait_for_timeout(700)
            shot(page, "search-overlay-1280")
            report["checks"]["search"] = page.evaluate(CHECK_JS)
        page.close()

        browser.close()

    if httpd:
        httpd.shutdown()

    (OUT / f"checks-{MODE}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        k: {
            "logos": v.get("logos"),
            "old_mark_svg": v.get("old_mark_svg"),
            "calligraphy": v.get("calligraphy"),
            "overflow": v.get("overflow"),
        }
        for k, v in report["checks"].items()
    }
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print("console_errors:", report["console_errors"])
    print("\n".join(report["shots"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
