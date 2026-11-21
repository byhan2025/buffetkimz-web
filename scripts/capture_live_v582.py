#!/usr/bin/env python3
"""v5.8.2 라이브 캡처 보정 — 목록은 카드 그리드까지 스크롤해 찍는다(썸네일 확인용)."""
from __future__ import annotations

import pathlib

from playwright.sync_api import sync_playwright

BASE = "https://byhan2025.github.io/buffetkimz-web"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

PREP = """
() => new Promise((resolve) => {
  const bar = document.querySelector('[data-post-toolbar]');
  const y = bar ? bar.getBoundingClientRect().top + window.scrollY - 80 : 0;
  window.scrollTo(0, Math.max(0, y));
  let done = false;
  const finish = () => { if (done) return; done = true; setTimeout(resolve, 400); };
  setTimeout(finish, 3000);
  const imgs = [...document.images];
  Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => null) : Promise.resolve(null)))).then(finish);
})
"""


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for name, path, w, h in [("posts", "/posts/", 1280, 1000), ("posts390", "/posts/", 390, 844)]:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(BASE + path, wait_until="networkidle", timeout=60000)
            page.evaluate(PREP)
            page.wait_for_timeout(800)
            page.screenshot(path=str(OUT / f"live-v582-{name}.png"), full_page=False)
            loaded = page.evaluate(
                """() => [...document.images].filter(i => (i.currentSrc||i.src).includes('/thumbs/'))
                     .map(i => [ (i.currentSrc||i.src).split('/').pop(), i.naturalWidth ])"""
            )
            print(name, "thumbs:", loaded)
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
