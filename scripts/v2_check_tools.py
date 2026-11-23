"""v8.8.0 2단계 — 로컬 dist에서 통합 도구·리다이렉트·보관함을 실제 브라우저로 확인한다.

사용: python3 scripts/v2_check_tools.py
결과: reports/buffetkimz-web/v2stage-tools/check.json + 화면 캡처
"""
import json
import os
import pathlib
import re
import socketserver
import http.server
import sys
import threading

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v2stage-tools"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8199


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

BASE = f"http://127.0.0.1:{PORT}"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

# (이름, 경로, 반드시 보여야 하는 글자들, 상단 탭에서 눌러 볼 값)
CASES = [
    ("pension-draw-age", "/apps/pension-draw/run?mode=age", ["만 나이", "국민연금 노령연금 개시"], "tax"),
    ("pension-draw-tax", "/apps/pension-draw/run", ["연금 인출", "내 조건"], "age"),
    ("compound-deposit", "/apps/compound-return/run?mode=deposit", ["예금·적금 세후 비교기"], "compound"),
    ("salary-hourly", "/apps/salary-net/run?mode=hourly", ["시급 → 월급", "주휴수당"], "salary"),
    ("vat-freelance", "/apps/vat-margin/run?mode=freelance", ["프리랜서 3.3%"], "vat"),
    ("image-resize", "/apps/image-compress/run?mode=resize", ["SNS 비율 리사이즈"], "compress"),
    ("image-upscale", "/apps/image-compress/run?mode=upscale", ["이미지 해상도 업스케일"], "compress"),
    ("image-watermark", "/apps/image-compress/run?mode=watermark", ["워터마크"], "compress"),
    ("image-exif", "/apps/image-compress/run?mode=exif", ["EXIF"], "compress"),
    ("pdf-merge", "/apps/pdf-image/run?mode=merge", ["PDF 합치기"], "convert"),
    ("date-moving", "/apps/unit-date-calc/run?mode=moving", ["전입", "잔금일"], "date"),
    ("coverage-guide", "/apps/coverage-check/run", ["5대 담보 기준 가이드"], None),
    ("archived-url-cleaner", "/apps/url-cleaner/run", ["URL 추적제거"], None),
    ("archived-text-to-card", "/apps/text-to-card/run", ["카드"], None),
]

REDIRECTS = [
    ("/apps/korean-age-pension/", "mode=age"),
    ("/apps/deposit-savings/run", "mode=deposit"),
    ("/apps/moving-dday/", "mode=moving"),
    ("/apps/exif-mosaic/", "mode=exif"),
    ("/apps/bojang-counsel-guide/", "/apps/coverage-check"),
    ("/tools/pdf-merge-split", "mode=merge"),
]

results = {"cases": [], "redirects": [], "store": {}, "console_errors": []}


def text_of(page):
    return page.inner_text("body")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    for name, path, wants, other_tab in CASES:
        for width in (1280, 390):
            pg = b.new_page(viewport={"width": width, "height": 900 if width > 1000 else 844}, locale="ko-KR")
            errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE + path, wait_until="networkidle")
            body = text_of(pg)
            missing = [w for w in wants if w not in body]
            tabs = pg.locator("[data-mode-tab]").count()
            entry = {
                "name": name,
                "path": path,
                "width": width,
                "missing": missing,
                "tabs": tabs,
                "errors": errs[:4],
                "url": pg.url,
            }
            pg.screenshot(path=str(OUT / f"{name}-{width}.png"), full_page=False)
            if other_tab and tabs:
                pg.locator(f'[data-mode-tab="{other_tab}"]').click()
                pg.wait_for_timeout(700)
                entry["after_click_url"] = pg.url
                entry["after_click_has_mode"] = f"mode={other_tab}" in pg.url
                entry["after_click_text"] = text_of(pg)[:4000]
                pg.screenshot(path=str(OUT / f"{name}-{width}-tab.png"), full_page=False)
            results["cases"].append(entry)
            if errs:
                results["console_errors"].append({"name": name, "width": width, "errors": errs[:4]})
            pg.close()

    # 리다이렉트 — 실제로 이동하는지
    for path, token in REDIRECTS:
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        pg.goto(BASE + path, wait_until="load")
        pg.wait_for_timeout(900)
        results["redirects"].append({"from": path, "to": pg.url, "token": token, "ok": token in pg.url})
        pg.close()

    # 앱스토어 — 노출 개수와 보관함 비노출
    pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
    pg.goto(BASE + "/apps/", wait_until="networkidle")
    ids = pg.eval_on_selector_all("[data-store-item]", "els => els.map(e => e.dataset.storeItem)")
    hero = text_of(pg)
    results["store"] = {
        "items": len(ids),
        "has_archived": [i for i in ids if i in {
            "json-csv-formatter", "diff-checker", "color-extractor", "text-to-card",
            "svg-logo-maker", "url-shortener", "url-cleaner", "market-world-clock"}],
        "says_도구28": "도구 28종" in hero or "28종" in hero,
        "order": ids,
    }
    pg.screenshot(path=str(OUT / "apps-1280.png"), full_page=False)
    pg.close()

    # 홈·소개·검색의 도구 수 표기
    for path in ("/", "/about/", "/search/"):
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        pg.goto(BASE + path, wait_until="networkidle")
        s = text_of(pg)
        results.setdefault("counts", {})[path] = {
            "28": s.count("28종"),
            "51": s.count("51종"),
            "49": s.count("49종"),
            "47": s.count("47종"),
            "36": s.count("36종"),
        }
        pg.close()

    b.close()

httpd.shutdown()
(OUT / "check.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({k: v for k, v in results.items() if k != "cases"}, ensure_ascii=False, indent=2)[:4000])
for c in results["cases"]:
    flag = "OK " if not c["missing"] and not c["errors"] else "BAD"
    print(flag, c["name"], c["width"], "tabs", c["tabs"], "missing", c["missing"], "err", c["errors"][:1])
