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
  const reader = q('[data-reader-apps]');
  const pract = q('[data-practitioner-apps]');
  return {
    mainTools: all('[data-main-tool]').length,
    riskTools: all('[data-risk-tool]').length,
    toolCount: block('[data-tool-count]'),
    appCount: block('[data-app-count]'),
    readerCards: reader ? reader.querySelectorAll('[data-app-card]').length : 0,
    readerSlugs: reader ? [...reader.querySelectorAll('[data-app-card]')].map(e => e.getAttribute('data-app-card')) : [],
    readerHasBojang: !!(reader && reader.querySelector('[data-app-card="bojang-counsel-guide"]')),
    practCards: pract ? pract.querySelectorAll('[data-practitioner-card]').length : 0,
    practSlugs: pract ? [...pract.querySelectorAll('[data-practitioner-card]')].map(e => e.getAttribute('data-practitioner-card')) : [],
    practAfterReader: !!(reader && pract && (reader.compareDocumentPosition(pract) & Node.DOCUMENT_POSITION_FOLLOWING)),
    badges: all('[data-external-badge]').map(e => e.textContent.trim()),
    externalLinks: all('a[target="_blank"]').map(a => ({
      href: a.getAttribute('href'),
      rel: a.getAttribute('rel'),
      text: a.innerText.replace(/\\s+/g, ' ').trim().slice(0, 30),
    })),
    timemachineText: block('[data-app-card="trade-timemachine"]'),
    bojangText: block('[data-practitioner-card="bojang-counsel-guide"]'),
  };
}"""


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
                    add(f"{label} 도구자료실 내부 계산 8종(5+3)", a["mainTools"] == 5 and a["riskTools"] == 3, a)
                    add(f"{label} 외부 앱 배지 = 앱 카드 수", len(a["badges"]) == 2 and all("외부 웹앱 · 새 창 열기" == b for b in a["badges"]), a["badges"])
                    add(f"{label} 독자용 앱 칸 = 타임머신 1", a["readerCards"] == 1 and a["readerSlugs"] == ["trade-timemachine"], a["readerSlugs"])
                    add(f"{label} 실무자용 칸 = 5대 담보 1 · 독자용과 분리", a["practCards"] == 1 and a["practSlugs"] == ["bojang-counsel-guide"] and not a["readerHasBojang"] and a["practAfterReader"], {"pract": a["practSlugs"], "readerHasBojang": a["readerHasBojang"], "after": a["practAfterReader"]})
                    add(f"{label} 타임머신 카드에 비투자권유 고지", "투자 권유" in (a["timemachineText"] or ""), (a["timemachineText"] or "")[:160])
                    tm_links = [l for l in a["externalLinks"] if l["href"] and "trade-timemachine" in l["href"]]
                    add(
                        f"{label} 타임머신 링크 새 창 + noopener",
                        len(tm_links) >= 1 and all("noopener" in (l["rel"] or "") for l in tm_links),
                        tm_links,
                    )
                    add(f"{label} 도구 8종 표기", "8" in (a["toolCount"] or ""), a["toolCount"])
                    add(f"{label} 직접 만든 앱 2종 표기(독자용 1+실무자용 1)", "2" in (a["appCount"] or "") and "독자용 1" in (a["appCount"] or ""), a["appCount"])

                if key == "home":
                    # v6.3 — 크레딧 줄의 분해 숫자 합이 바로 옆 총합과 같아야 한다(4+3=8 같은 표기 방지)
                    credit = page.evaluate(
                        """() => [...document.querySelectorAll('.film-credit')].map(a => ({
                          label: (a.querySelector('.film-credit-label')?.childNodes[0]?.textContent ?? '').trim(),
                          note: (a.querySelector('.film-credit-note')?.textContent ?? '').trim(),
                          count: (a.querySelector('.film-credit-count')?.textContent ?? '').trim(),
                        }))"""
                    )
                    tool = next((c for c in credit if c["label"] == "도구"), {})
                    nums = [int(x) for x in re.findall(r"\d+", tool.get("note") or "")]
                    total = int("".join(ch for ch in (tool.get("count") or "") if ch.isdigit()) or 0)
                    add(
                        f"{label} 홈 도구 크레딧 분해 합 = 총합",
                        len(nums) == 3 and sum(nums) == total and total == 8,
                        {"note": tool.get("note"), "count": tool.get("count"), "sum": sum(nums)},
                    )

                if key == "notfound":
                    body = page.evaluate("() => document.body.innerText")
                    add(f"{label} 404 안내 문구", "이 칸은 비어 있습니다" in body and "홈으로" in body, body[:80])

                page.close()

        # 상세 페이지 — 외부 앱 배지·고지·실무자용 표기
        for label, vp in VIEWPORTS.items():
            for slug, must in (
                ("trade-timemachine", "투자 권유·매매 신호가 아닙니다"),
                ("bojang-counsel-guide", "실무자용 앱입니다"),
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
                add(f"{label} /apps/{slug}/ 외부 웹앱 배지", badge == "외부 웹앱 · 새 창 열기", badge)
                body = page.evaluate("() => document.body.innerText")
                add(f"{label} /apps/{slug}/ 고지·표기", must in body, must)
                page.close()

        # 버전 표기 — package.json(v6.3.0)이 빌드에 반영됐는지(사이트맵 lastmod·구조화 데이터 아님)
        pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
        add("package.json 버전 6.3.0", pkg.get("version") == "6.3.0", str(pkg.get("version")))
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
