"""v8.8.0 2단계 — 라이브(gh-pages) 실측 캡처.

사용: python3 scripts/capture_v2stage_live.py
결과: reports/buffetkimz-web/v2stage-live/ (390·1280 PNG + live.json)
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v2stage-live"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://byhan2025.github.io/buffetkimz-web"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

SHOTS = [
    ("home", "/?v=880", None),
    ("apps", "/apps/?v=880", None),
    ("pension-draw-age", "/apps/pension-draw/run?v=880&mode=age", None),
    ("image-resize", "/apps/image-compress/run?v=880&mode=resize", None),
    ("coverage-guide", "/apps/coverage-check/run?v=880", "[data-coverage-guide]"),
    ("app-detail-pension", "/apps/pension-tax/?v=880", None),
]

results = {"base": BASE, "shots": [], "redirects": [], "http": [], "console_errors": []}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for name, path, scroll_to in SHOTS:
        for width in (1280, 390):
            pg = b.new_page(viewport={"width": width, "height": 900 if width > 1000 else 844}, locale="ko-KR")
            errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            resp = pg.goto(BASE + path, wait_until="networkidle")
            if scroll_to and pg.locator(scroll_to).count():
                pg.locator(scroll_to).scroll_into_view_if_needed()
                pg.wait_for_timeout(500)
            pg.screenshot(path=str(OUT / f"{name}-{width}.png"))
            results["shots"].append({"name": name, "width": width, "status": resp.status if resp else None, "errors": errs[:3]})
            if errs:
                results["console_errors"].append({"name": name, "width": width, "errors": errs[:3]})
            pg.close()

    # 옛 주소 → 통합 도구로 실제 이동하는지 (라이브)
    for path, token in [
        ("/apps/korean-age-pension/?v=880", "mode=age"),
        ("/apps/moving-dday/?v=880", "mode=moving"),
        ("/apps/watermark/run?v=880", "mode=watermark"),
        ("/tools/image-upscale?v=880", "mode=upscale"),
    ]:
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        pg.goto(BASE + path, wait_until="load")
        pg.wait_for_timeout(1500)
        results["redirects"].append({"from": path, "landed": pg.url, "ok": token in pg.url})
        pg.close()

    # 주요 페이지 HTTP 상태
    for path in ["/", "/apps/", "/apps/pension-draw/", "/apps/image-compress/", "/apps/pdf-image/",
                 "/apps/unit-date-calc/", "/apps/salary-net/", "/apps/vat-margin/", "/apps/compound-return/",
                 "/apps/coverage-check/", "/apps/url-cleaner/", "/gallery/", "/posts/"]:
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        r = pg.goto(BASE + path + "?v=880", wait_until="domcontentloaded")
        results["http"].append({"path": path, "status": r.status if r else None})
        pg.close()

    b.close()

(OUT / "live.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
