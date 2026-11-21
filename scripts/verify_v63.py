#!/usr/bin/env python3
"""v6.3 마감 실측 — 전 주요 페이지 1280 · 390 + 도구자료실 앱 분리.

브리프(v6.3.0)의 판정을 그대로 잰다.
  · 9개 주요 페이지(`/`·`/about/`·`/posts/`·`/apps/`·`/apps/pension-draw/`·`/calendar/`·
    `/principles/`·`/search/`·`/404.html`) × 1280/390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  · `/apps/`: 내부 계산 도구 8종(메인 5 + 리스크 3)은 그대로, 외부 앱은
    '외부 웹앱 · 새 창 열기' 배지로 구분. 일반 독자용(한국형 타임머신)과
    실무자용(5대 담보 기준 가이드)이 섞이지 않고, 실무자용 칸이 아래에 따로 있는가
  · 타임머신 카드에 비투자권유 고지 유지 · 외부 링크는 새 창 + rel=noopener
  · `/apps/trade-timemachine/`·`/apps/bojang-counsel-guide/` 상세에도 같은 배지

사용:
  npm run build && python3 scripts/verify_v63.py            # 로컬 dist
  python3 scripts/verify_v63.py --live                      # gh-pages 라이브
결과: reports/buffetkimz-web/v63-final/verify-v63-{local,live}.json (+ PNG)
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import re
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v63-final"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8163
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "/buffetkimz-web"

ROUTES = [
    ("home", "/"),
    ("about", "/about/"),
    ("posts", "/posts/"),
    ("apps", "/apps/"),
    ("pension-draw", "/apps/pension-draw/"),
    ("calendar", "/calendar/"),
    ("principles", "/principles/"),
    ("search", "/search/"),
    ("notfound", "/404.html"),
]

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}


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


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 48), over: Math.round(r.right - vw) });
    }
  }
  return {
    docScroll: document.documentElement.scrollWidth,
    vw,
    overflow: Math.max(0, document.documentElement.scrollWidth - vw),
    wide: wide.slice(0, 5),
  };
}"""

APPS_JS = """() => {
  const q = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  const block = (sel) => { const el = q(sel); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : null; };
  return {
    tabs: all('[data-store-tab]').map(t => ({ id: t.dataset.storeTab, text: t.innerText.replace(/\\s+/g,' ').trim() })),
    cats: all('[data-store-cat]').map(e => e.dataset.storeCat),
    items: all('[data-store-item]').map(e => e.dataset.storeItem),
    counts: all('.store-sec-count').map(e => e.textContent.trim()),
    badges: all('[data-external-badge]').map(e => e.textContent.trim()),
    practitioner: all('[data-practitioner-badge]').length,
    summary: block('[data-store-summary]'),
    protect: block('.store-protect'),
    externalLinks: all('a[target="_blank"]').map(a => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel'), text: a.innerText.replace(/\\s+/g, ' ').trim().slice(0, 30) })),
  };
}
"""


def main() -> int:
    httpd = None if MODE == "live" else serve()
    checks: dict[str, dict] = {}
    errors: list[str] = []

    def add(name: str, ok: bool, detail="") -> None:
        checks[name] = {"ok": bool(ok), "detail": detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)}
        if not ok:
            errors.append(name)

    shots: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        for label, vp in VIEWPORTS.items():
            for key, route in ROUTES:
                page = browser.new_page(viewport=vp, locale="ko-KR")
                console: list[str] = []
                page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
                resp = page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(900)
                status = resp.status if resp else None
                ok_status = status == 200 or (key == "notfound" and status == 404)
                # GitHub Pages는 되감기(history scrollRestoration) 때문에 reload 시 스크롤이 남을 수 있다
                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(150)
                add(f"{label} {route} HTTP", ok_status, str(status))
                add(f"{label} {route} 콘솔 오류 0", not console, console[:2])
                over = page.evaluate(OVERFLOW_JS)
                add(f"{label} {route} 가로 넘침 0", over["overflow"] == 0, over)
                if key in ("apps", "home"):
                    shot = OUT / f"{MODE}-{key}-{label}.png"
                    page.screenshot(path=str(shot))
                    shots.append(str(shot))

                if key == "apps":
                    a = page.evaluate(APPS_JS)
                    add(f"{label} 앱스토어 탭 4(전체+3)", [t["id"] for t in a["tabs"]] == ["all", "finance", "insurance", "utility"], a["tabs"])
                    add(f"{label} 앱스토어 섹션 3 · 카드 10", a["cats"] == ["finance", "insurance", "utility"] and len(a["items"]) == 10, {"cats": a["cats"], "n": len(a["items"])})
                    add(f"{label} 카테고리 개수 5·4·1", a["counts"] == ["5", "4", "1"], a["counts"])
                    add(f"{label} 외부 웹앱 배지 2", len(a["badges"]) == 2 and all(b == "외부 웹앱" for b in a["badges"]), a["badges"])
                    add(f"{label} 실무자용 배지 1", a["practitioner"] == 1, a["practitioner"])
                    tm_links = [l for l in a["externalLinks"] if l["href"] and "trade-timemachine" in l["href"]]
                    add(
                        f"{label} 타임머신 링크 새 창 + noopener",
                        len(tm_links) >= 1 and all("noopener" in (l["rel"] or "") for l in tm_links),
                        tm_links,
                    )
                    add(f"{label} 앱스토어 요약(카테고리 개수 칩)", "금융투자앱" in (a["summary"] or "") and "보험앱" in (a["summary"] or ""), a["summary"])
                    add(f"{label} 이용자 보호 고지 1줄", "참고용" in (a["protect"] or ""), a["protect"])

                if key == "home":
                    # v7.0 — 크레딧의 앱스토어 숫자: 카테고리 3개 합 = 총합
                    credit = page.evaluate(
                        """() => [...document.querySelectorAll('.film-credit')].map(a => ({
                          label: (a.querySelector('.film-credit-label')?.childNodes[0]?.textContent ?? '').trim(),
                          note: (a.querySelector('.film-credit-note')?.textContent ?? '').trim(),
                          count: (a.querySelector('.film-credit-count')?.textContent ?? '').trim(),
                        }))"""
                    )
                    app_credit = next((c for c in credit if c["label"] == "앱스토어"), {})
                    nums = [int(x) for x in re.findall(r"\d+", app_credit.get("note") or "")]
                    total = int("".join(ch for ch in (app_credit.get("count") or "") if ch.isdigit()) or 0)
                    add(
                        f"{label} 홈 앱스토어 크레딧 분해 합 = 총합",
                        len(nums) == 3 and sum(nums) == total and total == 10,
                        {"note": app_credit.get("note"), "count": app_credit.get("count"), "sum": sum(nums)},
                    )

                if key == "notfound":
                    body = page.evaluate("() => document.body.innerText")
                    add(f"{label} 404 안내 문구", "이 칸은 비어 있습니다" in body and "홈으로" in body, body[:80])

                page.close()

        # 상세 페이지 — 외부 앱 배지·고지·실무자용 표기
        for label, vp in VIEWPORTS.items():
            for slug, must in (
                ("trade-timemachine", "투자 권유"),
                ("bojang-counsel-guide", "실무자용"),
            ):
                page = browser.new_page(viewport=vp, locale="ko-KR")
                console: list[str] = []
                page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
                resp = page.goto(f"{BASE}/apps/{slug}/", wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(700)
                add(f"{label} /apps/{slug}/ HTTP", resp is not None and resp.status == 200, str(resp.status if resp else None))
                add(f"{label} /apps/{slug}/ 콘솔 오류 0", not console, console[:2])
                over = page.evaluate(OVERFLOW_JS)
                add(f"{label} /apps/{slug}/ 가로 넘침 0", over["overflow"] == 0, over)
                badge = page.evaluate("() => document.querySelector('[data-external-badge]')?.textContent.trim() ?? null")
                add(f"{label} /apps/{slug}/ 외부 웹앱 표기", bool(badge) and "외부 웹앱" in badge, badge)
                body = page.evaluate("() => document.body.innerText")
                add(f"{label} /apps/{slug}/ 고지·표기", must in body, must)
                page.close()

        # 버전 표기 — package.json(v6.3.0)이 빌드에 반영됐는지(사이트맵 lastmod·구조화 데이터 아님)
        pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
        add("package.json 버전 7.0.0", pkg.get("version") == "7.0.0", str(pkg.get("version")))
        manifest = (APP / "dist" / "search-index.json")
        add("검색 인덱스에 실무자용 구분", "실무자용" in manifest.read_text(encoding="utf-8"), "")

        browser.close()
    if httpd:
        httpd.shutdown()

    result = {
        "mode": MODE,
        "base": BASE,
        "ok": not errors,
        "passed": sum(1 for c in checks.values() if c["ok"]),
        "total": len(checks),
        "failed": {k: v for k, v in checks.items() if not v["ok"]},
        "checks": checks,
        "shots": shots,
    }
    (OUT / f"verify-v63-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{MODE}] {result['passed']}/{result['total']} checks passed")
    for k, v in result["failed"].items():
        print(f"FAIL  {k} — {v['detail']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
