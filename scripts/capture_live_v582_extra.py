#!/usr/bin/env python3
"""v5.8.2 라이브 보조 캡처 — 1P 필름 씬5(캘리그라피)와 홈 하단 1:1 상담문의 밴드."""
from __future__ import annotations

import pathlib

from playwright.sync_api import sync_playwright

BASE = "https://byhan2025.github.io/buffetkimz-web"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(8600)  # 씬5(브랜드 서명) 구간
        page.screenshot(path=str(OUT / "live-v582-home-scene5.png"))
        info = page.evaluate(
            """() => {
              const imgs=[...document.querySelectorAll('[data-fs5-sign] img')];
              return imgs.map(i => [(i.currentSrc||i.src).split('/').pop(), i.naturalWidth, getComputedStyle(i).opacity]);
            }"""
        )
        print("scene5:", info)
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight - 1200)")
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / "live-v582-home-bottom.png"))
        band = page.evaluate(
            """() => {
              const a=[...document.querySelectorAll('a')].filter(x=>x.href.includes('pf.kakao.com/_UxkVxnn/chat'));
              return a.map(x => ({text:x.innerText.trim(), href:x.href}));
            }"""
        )
        print("contact links:", band)
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
