#!/usr/bin/env python3
"""v7.4.0 앱스토어 51종 실측 — 전수 200·콘솔 0·넘침 0 + 신규 12종 실입력 동작.

  A. 앱 상세 49p + 실행 47p × 390 / 1280 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 앱스토어(/apps) — 카드 51 · 섹션 6·4·41 · 요약 칩 51·6·4·41 · 모바일 접힘 8 + 나머지 33
      · 모바일(390)에서 히어로 요약 칩이 숨겨져 필터 탭과 겹치지 않는가
  C. 메뉴판 터치 높이 44px · '준비중' 배지 대비 · 드롭다운이 열리면 `? 가이드` 버튼이 숨는가
  D. 신규 12종 실입력 — 예시값 기대 결과 + 입력을 바꾸면 결과가 따라오는가
  E. 캡처 — reports/buffetkimz-web/v74-appstore51/
      · apps-1280.png · apps-390.png · apps-first-390x844.png(뷰포트 그대로)
      · run-<slug>-{1280,390}.png(신규 12종) · menu-drop-*.png · app-detail-svg-logo-maker-1280.png

사용:
  npm run build && python3 scripts/verify_v74.py            # 로컬 dist
  python3 scripts/verify_v74.py --live                      # gh-pages 라이브
결과: reports/buffetkimz-web/v74-appstore51/verify-v74-{local,live}.json
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v74-appstore51"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
PORT = 8174
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

VIEWPORTS = {
    "1280": {"width": 1280, "height": 900},
    "390": {"width": 390, "height": 844},
}

NEW_SLUGS = [
    "svg-logo-maker",
    "brokerage-fee",
    "acquisition-tax",
    "subscription-score",
    "moving-dday",
    "health-insurance-compare",
    "annual-leave",
    "unemployment-benefit",
    "freelancer-tax",
    "overseas-stock-tax",
    "deposit-savings",
    "stock-averaging",
]

# 신규 12종 — 예시값 그대로일 때 화면에 있어야 하는 문자열
EXPECT = {
    "svg-logo-maker": ["default", "light", "dark", "mono", "버핏킴즈"],
    "brokerage-fee": ["2,000,000원"],
    "acquisition-tax": ["20,533,040원"],
    "subscription-score": ["39", "/ 84점"],
    "moving-dday": ["D-", "전입신고 기한"],
    "health-insurance-compare": ["203,", "지역가입자 월 보험료"],
    "annual-leave": ["16.0일", "미사용 연차수당"],
    "unemployment-benefit": ["66,048원", "180일"],
    "freelancer-tax": ["2,901,000원"],
    "overseas-stock-tax": ["1,430,000원"],
    "deposit-savings": ["10,270,720원"],
    "stock-averaging": ["36,667원"],
}

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    CHECKS.append((name, ok, str(detail)))
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail != "" else ""), flush=True)


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


def url(path: str) -> str:
    return f"{BASE}{PREFIX}{path}"


STORE_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const chips = document.querySelector('[data-store-summary]');
  const chipBox = chips ? chips.getBoundingClientRect() : null;
  const cs = chips ? getComputedStyle(chips) : null;
  return {
    cards: all('[data-store-item]').map(e => e.dataset.storeItem),
    visibleCards: all('[data-store-item]').filter(vis).map(e => e.dataset.storeItem),
    counts: all('.store-sec-count').map(e => e.textContent.trim()),
    summary: all('[data-store-summary] a b').map(e => e.textContent.trim()),
    chipsVisible: !!(chips && chipBox && chipBox.height > 1 && cs && cs.display !== 'none' && cs.visibility !== 'hidden'),
    quick: all('[data-quick-app]').map(e => ({id: e.dataset.quickApp, href: e.getAttribute('href')})),
    tabs: all('[data-store-tab]').map(e => e.dataset.storeTab),
    sections: all('[data-store-cat]').filter(vis).map(e => e.dataset.storeCat),
    more: all('[data-store-more]').filter(vis).map(e => e.textContent.trim()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}"""

MENU_JS = """() => {
  const rows = [...document.querySelectorAll('.nav-drop-row, .quick-panel-row')].filter(r => r.getBoundingClientRect().height > 0);
  const pill = [...document.querySelectorAll('.soon-pill')].find(p => p.getBoundingClientRect().height > 0);
  const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (rgb) => {
    const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  let contrast = null;
  if (pill) {
    const cs = getComputedStyle(pill);
    let bg = cs.backgroundColor; let node = pill;
    while (node && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      node = node.parentElement; if (!node) break; bg = getComputedStyle(node).backgroundColor;
    }
    const a = lum(parse(cs.color).slice(0, 3));
    const c = lum(parse(bg || 'rgb(255,255,255)').slice(0, 3));
    contrast = Math.round(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)) * 100) / 100;
  }
  const dock = document.querySelector('.guide-dock');
  const dcs = dock ? getComputedStyle(dock) : null;
  return {
    rowCount: rows.length,
    minRowHeight: rows.length ? Math.round(Math.min(...rows.map(r => r.getBoundingClientRect().height)) * 10) / 10 : 0,
    shortRows: rows.filter(r => r.getBoundingClientRect().height < 44).map(r => r.innerText.trim().slice(0, 20)),
    contrast,
    guideHidden: !!(dcs && (dcs.visibility === 'hidden' || Number(dcs.opacity) === 0)),
    navOpen: document.documentElement.dataset.navOpen || '',
  };
}"""


def run_root(page):
    return page.evaluate(
        """() => {
          const el = document.querySelector('[data-util]') || document.querySelector('[data-runner]');
          return { text: el ? el.innerText : '', svgs: document.querySelectorAll('[data-util] svg[role="img"]').length };
        }"""
    )


def main() -> int:
    app_dirs = sorted(p.name for p in (ROOT / "apps").iterdir() if p.is_dir())
    detail_paths = [f"/apps/{slug}/" for slug in app_dirs]
    run_paths = [f"/apps/{slug}/run/" for slug in app_dirs if (ROOT / "apps" / slug / "run" / "index.html").exists()]
    check("앱 상세 페이지 49", len(detail_paths) == 49, len(detail_paths))
    check("실행 페이지 47", len(run_paths) == 47, len(run_paths))
    for slug in NEW_SLUGS:
        check(f"신규 실행 화면 존재 {slug}", (ROOT / "apps" / slug / "run" / "index.html").exists())

    httpd = None
    if MODE == "local":
        socketserver.TCPServer.allow_reuse_address = True
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

    shots: list[str] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                executable_path=CHROME if pathlib.Path(CHROME).exists() else None, args=["--disable-lcd-text"]
            )

            # ---------- A. 전수 상세·실행 ----------
            for label, vp in VIEWPORTS.items():
                ctx = browser.new_context(viewport=vp, locale="ko-KR")
                page = ctx.new_page()
                errors: list[str] = []
                page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:120]}") if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:120]}"))
                bad: list[dict] = []
                for p in detail_paths + run_paths:
                    errors.clear()
                    resp = page.goto(url(p), wait_until="load")
                    page.wait_for_timeout(120)
                    ov = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    status = resp.status if resp else 0
                    if status != 200 or ov > 1 or errors:
                        bad.append({"path": p, "status": status, "overflow": ov, "errors": errors[:3]})
                check(
                    f"{label} 상세+실행 {len(detail_paths) + len(run_paths)}p 200·오류 0·넘침 0",
                    not bad,
                    bad[:4] if bad else "all clean",
                )
                ctx.close()

            # ---------- B. 앱스토어 ----------
            for label, vp in VIEWPORTS.items():
                ctx = browser.new_context(viewport=vp, locale="ko-KR")
                page = ctx.new_page()
                page.goto(url("/apps/"), wait_until="load")
                page.wait_for_timeout(250)
                st = page.evaluate(STORE_JS)
                check(f"{label} 앱스토어 카드 51", len(st["cards"]) == 51, len(st["cards"]))
                check(f"{label} 앱스토어 개수 6·4·41", st["counts"] == ["6", "4", "41"], st["counts"])
                check(f"{label} 요약 칩 51·6·4·41", st["summary"] == ["51", "6", "4", "41"], st["summary"])
                check(f"{label} 카테고리 탭 4", st["tabs"] == ["all", "finance", "insurance", "utility"], st["tabs"])
                check(f"{label} 가로 넘침 0", st["overflow"] <= 1, st["overflow"])
                if label == "390":
                    check("390 히어로 요약 칩 숨김(필터 탭과 겹치지 않음)", st["chipsVisible"] is False, st["chipsVisible"])
                else:
                    check("1280 히어로 요약 칩 보임", st["chipsVisible"] is True, st["chipsVisible"])

                page.fill("[data-store-search]", "중개보수")
                page.wait_for_timeout(250)
                s2 = page.evaluate(STORE_JS)
                check(f"{label} 검색 '중개보수' 1~4장", 0 < len(s2["visibleCards"]) <= 4, s2["visibleCards"])
                page.fill("[data-store-search]", "")
                page.wait_for_timeout(200)

                page.click('[data-store-tab="utility"]')
                page.wait_for_timeout(220)
                s3 = page.evaluate(STORE_JS)
                check(f"{label} 유용한앱 탭 섹션 1", s3["sections"] == ["utility"], s3["sections"])
                if label == "390":
                    check(
                        "390 유용한앱 접힘 8 + 나머지 보기",
                        len(s3["visibleCards"]) == 8 and any("33" in t for t in s3["more"]),
                        {"vis": len(s3["visibleCards"]), "more": s3["more"]},
                    )
                    page.click('[data-store-cat="utility"] [data-store-more]')
                    page.wait_for_timeout(220)
                    s3 = page.evaluate(STORE_JS)
                    check("390 나머지 보기 펼침 41", len(s3["visibleCards"]) == 41, len(s3["visibleCards"]))
                else:
                    check("1280 유용한앱 카드 41", len(s3["visibleCards"]) == 41, len(s3["visibleCards"]))
                page.click('[data-store-tab="all"]')
                page.wait_for_timeout(160)
                page.evaluate("() => window.scrollTo(0, 0)")
                p = OUT / f"apps-{label}.png"
                page.screenshot(path=str(p), full_page=(label == "390"))
                shots.append(str(p))
                ctx.close()

            # 390×844 첫 화면(뷰포트 그대로) 1장 — 브리프 추가 요청
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR")
            page = ctx.new_page()
            page.goto(url("/apps/"), wait_until="load")
            page.wait_for_timeout(300)
            page.evaluate("() => window.scrollTo(0, 0)")
            p = OUT / "apps-first-390x844.png"
            page.screenshot(path=str(p))
            shots.append(str(p))
            vh = page.evaluate("() => ({h: window.innerHeight, w: window.innerWidth})")
            check("390 앱스토어 첫 화면 캡처(390×844)", vh == {"h": 844, "w": 390}, vh)
            ctx.close()

            # ---------- C. 메뉴판 + 가이드 버튼 ----------
            for label, vp in VIEWPORTS.items():
                ctx = browser.new_context(viewport=vp, locale="ko-KR")
                page = ctx.new_page()
                page.goto(url("/"), wait_until="load")
                page.wait_for_timeout(220)
                sel = '[aria-controls="nav-drop-1"]' if label == "1280" else '[aria-controls="quick-panel-1"]'
                page.click(sel)
                page.wait_for_timeout(250)
                m = page.evaluate(MENU_JS)
                check(f"{label} 메뉴판 터치 높이 44px 이상", m["minRowHeight"] >= 44 and not m["shortRows"], {"min": m["minRowHeight"], "short": m["shortRows"], "rows": m["rowCount"]})
                check(f"{label} '준비중' 배지 대비 4.5:1", (m["contrast"] or 0) >= 4.5, m["contrast"])
                check(f"{label} 메뉴 열림 시 ? 가이드 버튼 숨김", m["guideHidden"] is True, {"navOpen": m["navOpen"], "hidden": m["guideHidden"]})
                name = "menu-drop-1280.png" if label == "1280" else "menu-drop-390.png"
                page.screenshot(path=str(OUT / name))
                shots.append(str(OUT / name))
                page.keyboard.press("Escape")
                page.wait_for_timeout(250)
                m2 = page.evaluate(MENU_JS)
                check(f"{label} 메뉴 닫으면 ? 가이드 버튼 복귀", m2["guideHidden"] is False, {"navOpen": m2["navOpen"]})
                ctx.close()

            # ---------- D. 신규 12종 실입력 ----------
            for label in ("1280", "390"):
                ctx = browser.new_context(viewport=VIEWPORTS[label], locale="ko-KR")
                page = ctx.new_page()
                errs: list[str] = []
                page.on("console", lambda m: errs.append(m.text[:100]) if m.type == "error" else None)
                page.on("pageerror", lambda e: errs.append(str(e)[:100]))
                for slug in NEW_SLUGS:
                    errs.clear()
                    page.goto(url(f"/apps/{slug}/run/"), wait_until="load")
                    page.wait_for_timeout(500)
                    root = run_root(page)
                    missing = [t for t in EXPECT[slug] if t not in root["text"]]
                    check(f"{label} {slug} 예시값 결과", not missing, missing or "ok")

                    if label == "1280" or slug in ("svg-logo-maker", "acquisition-tax", "health-insurance-compare"):
                        p = OUT / f"run-{slug}-{label}.png"
                        page.screenshot(path=str(p), full_page=True)
                        shots.append(str(p))

                    changed = False
                    if slug == "svg-logo-maker":
                        page.fill("input[type=text]", "테스트로고")
                        page.wait_for_timeout(250)
                        changed = "테스트로고" in page.evaluate("() => document.querySelector('[data-util]').innerHTML")
                    elif slug == "moving-dday":
                        page.fill("input[type=date]", "2027-03-02")
                        page.wait_for_timeout(250)
                        after = run_root(page)["text"]
                        changed = after != root["text"] and "2027. 03." in after
                    else:
                        first = page.locator("[data-util] input[type=text], [data-runner] input[type=text]").first
                        first.fill("12345")
                        page.wait_for_timeout(300)
                        after = run_root(page)
                        changed = after["text"] != root["text"]
                    check(f"{label} {slug} 입력 변경 반응", changed)

                    check(f"{label} {slug} 실행 콘솔 오류 0", not errs, errs[:2])
                ctx.close()

            # ---------- E. 신규 상세 도해 ----------
            ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
            page = ctx.new_page()
            page.goto(url("/apps/svg-logo-maker/"), wait_until="load")
            page.wait_for_timeout(250)
            art = page.evaluate(
                """() => {
                  const body = document.body.innerText;
                  return {steps: ['입력', '처리', '결과'].every(t => body.includes(t)), body: body.slice(0, 40)};
                }"""
            )
            check("1280 신규 앱 상세 3단 도해", art["steps"] is True, art["body"])
            p = OUT / "app-detail-svg-logo-maker-1280.png"
            page.screenshot(path=str(p), full_page=True)
            shots.append(str(p))
            ctx.close()

            browser.close()
    finally:
        if httpd:
            httpd.shutdown()

    passed = sum(1 for _, ok, _ in CHECKS if ok)
    result = {
        "mode": MODE,
        "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in CHECKS],
        "passed": passed,
        "total": len(CHECKS),
        "shots": shots,
    }
    out = OUT / f"verify-v74-{MODE}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\n{passed}/{len(CHECKS)} 통과 → {out}")
    return 0 if passed == len(CHECKS) else 1


if __name__ == "__main__":
    sys.exit(main())
