"""
GitHub Pages 라이브 실측 — https://byhan2025.github.io/buffetkimz-web/

사용: python3 scripts/verify_live.py
결과: reports/buffetkimz-web/v3/live-home.png, live-home-mid.png, live-mobile360.png, live-report.json
확인: HTTP 200, CSS/JS 로드, 서브패스 링크 정합, 내부 링크 전수 200, 검색·도구 동작, 콘솔 오류 0
"""
import json
import os
import pathlib
import re
import urllib.request

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright

ORIGIN = "https://byhan2025.github.io"
PREFIX = "/buffetkimz-web"
BASE = ORIGIN + PREFIX
OUT = pathlib.Path(os.environ.get("LIVE_OUT") or "/workspace/reports/buffetkimz-web/v3")
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "base": BASE,
    "status": None,
    "console_errors": [],
    "failed_requests": [],
    "resources": {"css": [], "js": []},
    "links": {"unprefixed": [], "checked": 0, "failed": []},
    "search": {},
    "tool": {},
    "rendered": {},
    "screenshots": [],
}


def http_status(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "buffetkimz-live-check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:  # noqa: BLE001
        return f"ERR {e}"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
        page = ctx.new_page()
        page.on(
            "console",
            lambda m: report["console_errors"].append({"type": m.type, "text": m.text})
            if m.type == "error"
            else None,
        )
        page.on("pageerror", lambda e: report["console_errors"].append({"type": "pageerror", "text": str(e)}))
        page.on(
            "response",
            lambda r: report["failed_requests"].append({"status": r.status, "url": r.url})
            if r.status >= 400
            else None,
        )
        page.on("requestfinished", lambda r: r.url.endswith(".css") and report["resources"]["css"].append(r.url))
        page.on("requestfinished", lambda r: r.url.endswith(".js") and report["resources"]["js"].append(r.url))

        resp = page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        report["status"] = resp.status if resp else None
        page.wait_for_timeout(1200)

        # 렌더 확인: 글꼴·배경·제목
        report["rendered"] = page.evaluate(
            """() => ({
              title: document.title,
              h1: document.querySelector('main h1')?.innerText?.replace(/\\s+/g, ' ').trim(),
              body_bg: getComputedStyle(document.body).backgroundColor,
              font: getComputedStyle(document.body).fontFamily.slice(0, 40),
              css_sheets: document.styleSheets.length,
              card_meta: Array.from(document.querySelectorAll('[data-card-meta]')).map((e) => e.innerText.trim()),
            })"""
        )
        page.screenshot(path=str(OUT / "live-home.png"))
        report["screenshots"].append(str(OUT / "live-home.png"))
        page.screenshot(path=str(OUT / "live-home-full.png"), full_page=True)
        report["screenshots"].append(str(OUT / "live-home-full.png"))

        # v3.2 — 압축 레이아웃·4대 축 인덱스·카카오톡 채널 링크 확인
        report["home"] = page.evaluate(
            """() => {
              const kakao = document.querySelector('a[href*="pf.kakao.com"]');
              const axes = [...document.querySelectorAll('main a.card')].slice(0, 4).map((a) => a.innerText.replace(/\\n/g, ' | ').trim());
              return {
                height_px: document.documentElement.scrollHeight,
                axes,
                kakao_href: kakao ? kakao.getAttribute('href') : null,
                kakao_text: kakao ? kakao.innerText.replace(/\\n/g, ' ').trim() : null,
                record_cards: document.querySelectorAll('[data-post-cards] li').length,
                tool_tiles: document.querySelectorAll('main section:nth-of-type(3) li.card').length,
              };
            }"""
        )

        cards = page.locator("main section").nth(1)
        cards.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        cards.screenshot(path=str(OUT / "live-home-mid.png"))
        report["screenshots"].append(str(OUT / "live-home-mid.png"))
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)

        # 서브패스 정합: 모든 내부 링크가 /buffetkimz-web 으로 시작하는지
        hrefs = page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))")
        internal = [h for h in hrefs if h and h.startswith("/")]
        report["links"]["unprefixed"] = [h for h in internal if not h.startswith(PREFIX)]

        # 검색(헤더 오버레이) 동작
        page.click('button[aria-label="사이트 검색 열기"]')
        page.wait_for_timeout(600)
        page.fill("#search-input-overlay", "실손")
        page.wait_for_timeout(700)
        report["search"] = {
            "results": page.eval_on_selector_all("#search-results li", "e => e.length"),
            "first": page.evaluate(
                "() => document.querySelector('#search-results li a')?.innerText?.slice(0, 60) || ''"
            ),
        }
        page.screenshot(path=str(OUT / "live-search.png"))
        report["screenshots"].append(str(OUT / "live-search.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 도구 실행 화면 동작(슬라이더 → 결과 변화)
        page.goto(BASE + "/apps/coverage-check/run/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        before = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
        page.evaluate(
            """() => { const r = document.querySelector('input[type=range]');
               const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
               setter.call(r, '0'); r.dispatchEvent(new Event('input', {bubbles:true})); }"""
        )
        page.wait_for_timeout(600)
        after = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
        report["tool"] = {
            "url": page.url,
            "rows": page.eval_on_selector_all("table tbody tr", "e => e.length"),
            "before": before,
            "after": after,
            "changed": before != after,
            "labels": page.locator("main").inner_text().count("추가 확인 필요"),
        }
        page.screenshot(path=str(OUT / "live-run.png"), full_page=False)
        report["screenshots"].append(str(OUT / "live-run.png"))

        # 내부 링크 전수 (홈 + 주요 허브에서 모은 경로)
        paths = {"/", "/posts/", "/posts/insurance/", "/apps/", "/calendar/", "/about/", "/search/",
                 "/posts/insurance-silson-5th/", "/apps/coverage-check/", "/privacy/", "/terms/"}
        for href in internal:
            path = href.split("#")[0].split("?")[0]
            if path.startswith(PREFIX):
                paths.add(path[len(PREFIX):] or "/")
        report["links"]["checked"] = len(paths)
        for path in sorted(paths):
            code = http_status(ORIGIN + PREFIX + path)
            if code != 200:
                report["links"]["failed"].append({"path": path, "status": code})

        # 모바일 360 첫 화면
        mctx = browser.new_context(
            viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR"
        )
        m = mctx.new_page()
        m.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        m.wait_for_timeout(800)
        m.screenshot(path=str(OUT / "live-mobile360.png"))
        report["screenshots"].append(str(OUT / "live-mobile360.png"))
        report["mobile360"] = {
            "overflow_px": m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"),
            "h1": m.evaluate("() => document.querySelector('main h1')?.innerText?.replace(/\\s+/g,' ').trim()"),
        }
        mctx.close()
        browser.close()

    with open(OUT / "live-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2)[:6000])


if __name__ == "__main__":
    main()
