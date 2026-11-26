#!/usr/bin/env python3
"""W13·W1 보험 칼럼 캡처 — 라이브, 320·390·768·1440.

재는 것: HTTP 200 · 콘솔 오류 0 · 가로 넘침 0 · 표 행 수 · 390에서 표가 카드로 펼쳐짐
          · 비교 카드 · 외부 출처 링크 수 · 썸네일 로드 · 금지어 0
사용:  python3 scripts/capture_w13_w1_20261126.py [--live]
결과:  /workspace/reports/buffetkimz-web/board/{local|live}-w13w1-*.png / .json
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

APP = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = "--live" in sys.argv
SLUGS = ["insurance-breast-screening-biopsy", "insurance-atherosclerosis-plaque"]
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/board")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
BASE = "https://byhan2025.github.io/buffetkimz-web"

tag = "live" if LIVE else "live"
report: dict = {"base": BASE, "pages": {}}

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    for slug in SLUGS:
        url = f"{BASE}/posts/{slug}/"
        page_report = {"url": url, "viewports": {}}
        for width, height in ((320, 800), (390, 844), (768, 900), (1440, 960)):
            page = browser.new_page(viewport={"width": width, "height": height})
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            resp = page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(700)
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            rows = page.evaluate("() => Array.from(document.querySelectorAll('table tr')).length")
            stacked = page.evaluate(
                "() => { const t = document.querySelector('table'); if (!t) return null;"
                " return { cls: t.className, labels: document.querySelectorAll('table td[data-label]').length,"
                " display: getComputedStyle(t).display }; }"
            )
            compare = page.evaluate("() => !!document.querySelector('[class*=compare], [data-compare], .cmp')")
            sources = page.evaluate(
                "() => Array.from(document.querySelectorAll('a[href^=http]'))"
                ".filter(a => !a.href.includes('byhan2025') && !a.href.includes('buffetkimz.com')).length"
            )
            thumb_ok = page.evaluate(
                "(slug) => Array.from(document.images).some(i => i.currentSrc.includes(slug) && i.naturalWidth > 0)",
                slug,
            )
            h1 = page.evaluate("() => document.querySelector('h1')?.innerText?.trim() || ''")
            banned = page.evaluate(
                "() => ['실시간','속보','긴급','보반','보험에반하다','52주','W13'].filter(w => document.body.innerText.includes(w))"
            )
            page.screenshot(path=str(OUT / f"{tag}-{slug}-{width}.png"), full_page=False)
            if width == 390:
                table = page.query_selector("table")
                if table:
                    table.screenshot(path=str(OUT / f"{tag}-{slug}-390-table.png"))
            page_report["viewports"][str(width)] = {
                "status": resp.status if resp else None,
                "consoleErrors": errors,
                "overflow": overflow,
                "tableRows": rows,
                "table": stacked,
                "compareCard": compare,
                "externalSources": sources,
                "thumbLoaded": thumb_ok,
                "h1": h1,
                "banned": banned,
            }
            page.close()
        report["pages"][slug] = page_report
    browser.close()

ok = True
for slug, pr in report["pages"].items():
    for w, v in pr["viewports"].items():
        if not (
            v["status"] == 200
            and not v["consoleErrors"]
            and v["overflow"] <= 0
            and v["tableRows"] >= 4
            and v["compareCard"]
            and v["externalSources"] >= 5
            and v["thumbLoaded"]
            and not v["banned"]
        ):
            ok = False
path = OUT / "live-w13w1.json"
path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
print(("✓ 통과" if ok else "✗ 실패") + f" — {path}")
sys.exit(0 if ok else 1)
