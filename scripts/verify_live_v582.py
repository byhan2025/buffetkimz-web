#!/usr/bin/env python3
"""v5.8.2 라이브 실측 — 실제 GitHub Pages 주소를 열어 콘솔 오류·4xx·핵심 요소를 확인하고 캡처한다.

사용: python3 scripts/verify_live_v582.py
"""
from __future__ import annotations

import json
import pathlib

from playwright.sync_api import sync_playwright

BASE = "https://byhan2025.github.io/buffetkimz-web"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

PAGES = [
    ("home", "/", 1280, 900),
    ("posts", "/posts/", 1280, 1000),
    ("detail", "/posts/silson-switch-2026/", 1280, 1000),
    ("principles", "/principles/", 1280, 900),
    ("about", "/about/", 1280, 900),
    ("posts390", "/posts/", 390, 844),
    ("detail390", "/posts/silson-switch-2026/", 390, 844),
]


def probe(page) -> dict:
    return page.evaluate(
        """() => {
      const q = (s) => document.querySelector(s);
      const imgs = [...document.images];
      return {
        title: document.title,
        h1: (q('h1') || {}).innerText || null,
        imgCount: imgs.length,
        brokenImgs: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src),
        thumbsLoaded: imgs.filter(i => (i.currentSrc || i.src).includes('/thumbs/') && i.naturalWidth > 0).length,
        calligraphyLoaded: imgs.filter(i => (i.currentSrc || i.src).includes('calligraphy') && i.naturalWidth > 0).length,
        contactLinks: [...document.querySelectorAll('a')].filter(a => a.href.includes('pf.kakao.com/_UxkVxnn/chat')).length,
        principlesLinks: [...document.querySelectorAll('a')].filter(a => a.getAttribute('href') && a.getAttribute('href').includes('/principles')).length,
        baseDates: [...document.querySelectorAll('time')].map(t => t.getAttribute('datetime') + '|' + t.innerText).slice(0, 6),
        conclusion: !!q('[data-post-conclusion]'),
        toc: !!q('[data-article-toc], nav[aria-label*="목차"], [data-toc]'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        resources4xx: performance.getEntriesByType('resource')
          .filter(r => r.responseStatus && r.responseStatus >= 400)
          .map(r => r.name + ' ' + r.responseStatus),
      };
    }"""
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for name, path, w, h in PAGES:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            console_errors.clear()
            page_errors.clear()
            failed.clear()
            page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.on("requestfailed", lambda r: failed.append(f"{r.url} {r.failure}"))
            resp = page.goto(BASE + path, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1200)
            data = probe(page)
            data["status"] = resp.status if resp else None
            data["url"] = page.url
            data["consoleErrors"] = list(console_errors)
            data["pageErrors"] = list(page_errors)
            data["requestFailed"] = list(failed)
            report[name] = data

            if name == "posts":
                page.screenshot(path=str(OUT / "live-v582-posts.png"), full_page=False)
            if name == "detail":
                page.screenshot(path=str(OUT / "live-v582-detail.png"), full_page=False)
            if name in ("principles", "about", "home", "posts390", "detail390"):
                page.screenshot(path=str(OUT / f"live-v582-{name}.png"), full_page=False)
            ctx.close()
        browser.close()

    (OUT / "live-v582-verify.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for k, v in report.items():
        print(
            f"{k:11s} {v['status']} imgs={v['imgCount']} thumbs={v['thumbsLoaded']} "
            f"calli={v['calligraphyLoaded']} contact={v['contactLinks']} principles={v['principlesLinks']} "
            f"concl={v['conclusion']} toc={v['toc']} overflow={v['overflow']} "
            f"broken={len(v['brokenImgs'])} 4xx={len(v['resources4xx'])} "
            f"console={len(v['consoleErrors'])} pageerr={len(v['pageErrors'])} reqfail={len(v['requestFailed'])}"
        )
    print("baseDates(home):", report["home"]["baseDates"])
    print("h1(posts):", report["posts"]["h1"], "| h1(detail):", report["detail"]["h1"])


if __name__ == "__main__":
    main()
