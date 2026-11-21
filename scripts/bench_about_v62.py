#!/usr/bin/env python3
"""v6.2 벤치마킹 실물 캡처 — 소개 페이지 4곳 (1280 · 390).

텍스트 요약이 아니라 브라우저 실물 화면으로 비교한다(사용자 기준).
사용: python3 scripts/bench_about_v62.py
결과: reports/buffetkimz-web/v62-about/bench-<slug>-<w>.png
"""
from __future__ import annotations

import json
import os
import pathlib

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v62-about"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

SITES = [
    ("toss-team", "https://toss.im/team"),
    ("toss-intro", "https://toss.im/intro"),
    ("collabfund", "https://collabfund.com/about/"),
    ("linear", "https://linear.app/about"),
    ("stripe", "https://stripe.com/about"),
    ("uppity", "https://uppity.co.kr/"),
    ("newneek", "https://newneek.co/"),
]

EXTRACT = """() => {
  const pick = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: String(el.className || '').slice(0, 60),
    text: (el.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 120),
    h: Math.round(el.getBoundingClientRect().height),
  });
  const secs = [...document.querySelectorAll('main section, main > div, body > div > section')].slice(0, 14).map(pick);
  return {
    title: document.title,
    h1: document.querySelector('h1')?.innerText?.replace(/\\s+/g,' ').trim() || null,
    height: document.documentElement.scrollHeight,
    headings: [...document.querySelectorAll('h1,h2')].slice(0, 12).map(e => e.innerText.replace(/\\s+/g,' ').trim().slice(0, 80)),
    sections: secs,
    images: document.querySelectorAll('img').length,
    svgs: document.querySelectorAll('svg').length,
    bg: getComputedStyle(document.body).backgroundColor,
  };
}"""


def main() -> int:
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for slug, url in SITES:
            entry = {"url": url}
            for width, height in ((1280, 900), (390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height}, locale="ko-KR")
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)[:80]))
                try:
                    resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(2200)
                    # lazy 이미지·스크롤 유도
                    page.mouse.wheel(0, 1200)
                    page.wait_for_timeout(700)
                    page.mouse.wheel(0, -1200)
                    page.wait_for_timeout(400)
                    data = page.evaluate(EXTRACT)
                    status = resp.status if resp else None
                except Exception as exc:  # noqa: BLE001
                    data, status = {"error": str(exc)[:160]}, None
                path = OUT / f"bench-{slug}-{width}.png"
                try:
                    page.screenshot(path=str(path), full_page=False)
                except Exception:  # noqa: BLE001
                    pass
                entry[str(width)] = {"status": status, "errors": errors[:2], "data": data, "shot": str(path)}
                page.close()
            results[slug] = entry
            print(slug, entry["1280"]["status"], (entry["1280"]["data"] or {}).get("h1"))
        browser.close()
    (OUT / "bench-notes.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
