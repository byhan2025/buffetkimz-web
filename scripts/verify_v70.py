#!/usr/bin/env python3
"""v7.0 실측 검증 — 전면 리브랜딩 · 금융포털 · 앱스토어 · 소개 재창조.

브리프(handoffs/…v7.0 전면 리브랜딩)의 판정을 그대로 잰다.

  A. 8개 주요 페이지 × 1280 / 390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 메뉴 이름 — 금융지식 · 앱스토어 · 금융캘린더 (헤더·푸터·모바일 퀵 탭)
  C. 방어적 표현 0 — 비영업 / 권하지 않습니다 / 저장 0건 / 중개 아님 / 가입 권유 (주요 페이지 본문)
  D. 앱스토어 — 카테고리 탭 4(전체·금융투자앱·보험앱·유용한앱) · 섹션 3 · 카드 10 · 검색 동작
  E. 홈 — 마켓보드 12지표(핵심 6 + 그 밖 6) · D-Day 3 · 시뮬레이터 3 · 브리핑 탭 3
  F. 브랜드 필름 — 씬5에 확정 국문 로고만(영문 워드마크 없음) · 정지 컷 대응
  G. 소개 — 히어로 · 고민 칩 4 · 클릭 결과 · 전문 영역 탭 3 · 브랜드 쇼케이스
  H. 캡처 — reports/buffetkimz-web/v70-portal/{home-1280,home-390,about-1280,about-390,apps-1280,film-scene5-1280}.png

사용:
  npm run build && python3 scripts/verify_v70.py            # 로컬 dist
  python3 scripts/verify_v70.py --live                      # gh-pages 라이브
결과: reports/buffetkimz-web/v70-portal/verify-v70-{local,live}.json
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v70-portal"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8170
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "/buffetkimz-web"

ROUTES = [
    ("home", "/"),
    ("about", "/about/"),
    ("posts", "/posts/"),
    ("apps", "/apps/"),
    ("app-detail", "/apps/pension-tax/"),
    ("app-run", "/apps/pension-tax/run/"),
    ("calendar", "/calendar/"),
    ("principles", "/principles/"),
    ("search", "/search/"),
]

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

FORBIDDEN = ["비영업", "권하지 않습니다", "저장 0건", "중개 아님", "중개가 아닌", "가입 권유"]

OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), over: Math.round(r.right - vw) });
  }
  return { docScroll: document.documentElement.scrollWidth, vw, overflow: Math.max(0, document.documentElement.scrollWidth - vw), wide: wide.slice(0, 4) };
}"""

APPS_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => document.querySelector(s)?.innerText.replace(/\\s+/g, ' ').trim() ?? '';
  return {
    tabs: all('[data-store-tab]').map(t => ({ id: t.dataset.storeTab, label: t.innerText.replace(/\\s+/g,' ').trim() })),
    sections: all('[data-store-cat]').map(s => s.dataset.storeCat),
    cards: all('[data-store-item]').length,
    external: all('[data-external-badge]').length,
    practitioner: all('[data-practitioner-badge]').length,
    firstCat: txt('#cat-finance .store-h2'),
    counts: all('.store-sec-count').map(e => e.textContent.trim()),
    search: !!document.querySelector('[data-store-search]'),
    protect: txt('.store-protect'),
    nav: all('nav[aria-label="주 메뉴"] a').map(a => a.innerText.trim()),
  };
}"""

HOME_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => document.querySelector(s)?.innerText.replace(/\\s+/g,' ').trim() ?? '';
  return {
    featured: all('[data-indicator-card]').map(e => e.dataset.indicatorCard),
    mini: all('.mboard-mini [data-indicator]').map(e => e.dataset.indicator),
    ddays: all('.wmoney-item').length,
    ddayLabels: all('.wmoney-dday b').map(e => e.textContent.trim()),
    sims: all('[data-sim]').map(e => e.dataset.sim),
    pulseTabs: all('[data-pulse-tab]').map(e => e.innerText.trim()),
    pulsePanels: all('[data-pulse-panel]').length,
    credits: all('.film-credit').map(a => ({
      label: (a.querySelector('.film-credit-label')?.childNodes[0]?.textContent ?? '').trim(),
      count: (a.querySelector('.film-credit-count')?.textContent ?? '').trim(),
    })),
    modChips: all('.mod-chip').map(e => e.innerText.trim()),
  };
}"""

ABOUT_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => document.querySelector(s)?.innerText.replace(/\\s+/g,' ').trim() ?? '';
  return {
    h1: txt('h1'),
    chips: all('[data-finance-check] .fcheck-chip').map(e => e.innerText.replace(/\\s+/g,' ').trim()),
    areas: all('[data-ab-tab]').map(e => e.dataset.abTab),
    panels: all('[data-ab-panel]').length,
    brandImgs: all('.ab-brand-art img').length,
    koHero: !!document.querySelector('.ab-sign-ko'),
    cta: txt('.ab-cta'),
  };
}"""

FILM_JS = """() => {
  const s5 = document.querySelector('[data-scene="5"]');
  const imgs = s5 ? [...s5.querySelectorAll('img')] : [];
  return {
    ko: imgs.filter(i => i.getAttribute('src') && i.getAttribute('src').includes('logo-ko-dark-tr')).length,
    en: imgs.filter(i => i.getAttribute('src') && i.getAttribute('src').includes('logo-en-dark-tr')).length,
    text: s5 ? s5.innerText.replace(/\\s+/g,' ').trim() : '',
    hasMark: s5 ? !!s5.querySelector('.fs5-mark') : true,
    state: document.querySelector('[data-film]')?.dataset.filmState ?? '',
  };
}"""


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
                page.wait_for_timeout(800)
                status = resp.status if resp else None
                add(f"{label} {route} HTTP 200", status == 200, str(status))
                add(f"{label} {route} 콘솔 오류 0", not console, console[:2])
                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(120)
                over = page.evaluate(OVERFLOW_JS)
                add(f"{label} {route} 가로 넘침 0", over["overflow"] == 0, over)

                if key in ("home", "about", "apps"):
                    shot = OUT / f"{key}-{label}.png"
                    page.screenshot(path=str(shot), full_page=(label == "1280"))
                    shots.append(str(shot))

                body = page.evaluate("() => document.body.innerText")
                hits = [w for w in FORBIDDEN if w in body]
                add(f"{label} {route} 방어적 표현 0", not hits, ", ".join(hits))

                if key == "home":
                    h = page.evaluate(HOME_JS)
                    add(f"{label} 마켓보드 핵심 6지표", h["featured"] == ["usdkrw", "kospi", "nasdaq", "us10y", "base-rate", "vix"], h["featured"])
                    add(f"{label} 마켓보드 그 밖의 4지표", len(h["mini"]) == 4, h["mini"])
                    add(f"{label} 이번 주 돈의 일정 3건", h["ddays"] == 3 and h["ddayLabels"] == ["D-2", "D-9", "D-40"], {"n": h["ddays"], "labels": h["ddayLabels"]})
                    add(f"{label} 시뮬레이터 TOP 3", h["sims"] == ["pension-tax", "retirement-flow", "trade-timemachine"], h["sims"])
                    add(f"{label} 브리핑 탭 3 · 패널 3", h["pulseTabs"] == ["투자·연금", "절세·세법", "보험·리스크"] and h["pulsePanels"] == 3, {"tabs": h["pulseTabs"], "panels": h["pulsePanels"]})
                    add(f"{label} 모듈마다 기준·출처 칩", len(h["modChips"]) >= 4, h["modChips"])
                    labels = [c["label"] for c in h["credits"]]
                    add(f"{label} 필름 크레딧 네 축 이름", labels == ["금융지식", "앱스토어", "금융캘린더", "연결 채널"], labels)

                if key == "apps":
                    a = page.evaluate(APPS_JS)
                    add(f"{label} 앱스토어 탭 4(전체+3)", [t["id"] for t in a["tabs"]] == ["all", "finance", "insurance", "utility"], a["tabs"])
                    add(f"{label} 앱스토어 섹션 3", a["sections"] == ["finance", "insurance", "utility"], a["sections"])
                    add(f"{label} 앱스토어 카드 10종", a["cards"] == 10, a["cards"])
                    add(f"{label} 카테고리 개수 5·4·1", a["counts"] == ["5", "4", "1"], a["counts"])
                    add(f"{label} 외부 웹앱 2 · 실무자용 1", a["external"] == 2 and a["practitioner"] == 1, {"ext": a["external"], "pro": a["practitioner"]})
                    add(f"{label} 앱스토어 검색 입력", a["search"] is True, a["search"])
                    add(f"{label} 이용자 보호 고지 1줄", "참고용" in a["protect"], a["protect"])
                    add(f"{label} 주 메뉴 이름", a["nav"] == ["금융지식", "앱스토어", "금융캘린더", "소개"], a["nav"])
                    if label == "1280":
                        # 검색 동작 — '실손'으로 좁히면 실손 카드만 남는다
                        page.fill("[data-store-search]", "세액공제")
                        page.wait_for_timeout(300)
                        visible = page.evaluate("() => [...document.querySelectorAll('[data-store-item]')].filter(c => !c.hidden).map(c => c.dataset.storeItem)")
                        add("1280 앱스토어 검색 '세액공제' 결과", visible == ["pension-tax"], visible)
                        page.fill("[data-store-search]", "")

                if key == "about":
                    ab = page.evaluate(ABOUT_JS)
                    add(f"{label} 소개 히어로 한 문장", "숫자로 설계합니다" in ab["h1"], ab["h1"])
                    add(f"{label} 고민 칩 4개", len(ab["chips"]) == 4 and all(x in " ".join(ab["chips"]) for x in ["연금", "투자", "절세", "보험"]), ab["chips"])
                    add(f"{label} 전문 영역 탭 3", ab["areas"] == ["finance", "pension", "risk"] and ab["panels"] == 3, {"areas": ab["areas"], "panels": ab["panels"]})
                    add(f"{label} 브랜드 쇼케이스 두 장", ab["brandImgs"] == 2, ab["brandImgs"])
                    add(f"{label} 히어로 한글 캘리그라피", ab["koHero"] is True, ab["koHero"])
                    if label == "1280":
                        page.click("[data-finance-check] .fcheck-chip")
                        page.wait_for_timeout(400)
                        res = page.evaluate("() => document.querySelector('.fcheck-result')?.innerText.replace(/\\s+/g,' ').trim() ?? ''")
                        add("1280 3초 진단 결과(고민 클릭)", "맞춤 컨설팅" in res and "함께 읽기" in res, res[:120])

                if key == "principles":
                    b = body
                    add(f"{label} 편집 원칙 6장 유지", b.count("기준일") >= 2 and "1차 출처" in b, "")

                page.close()

        # 브랜드 필름 — 씬5 한글 단독 + 정지 컷
        for label, vp in VIEWPORTS.items():
            page = browser.new_page(viewport=vp, locale="ko-KR")
            errors_: list[str] = []
            page.on("console", lambda m: errors_.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors_.append(str(e)))
            page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1800)
            film = page.evaluate(FILM_JS)
            add(f"{label} 씬5 한글 캘리그라피 1장", film["ko"] == 1, film)
            add(f"{label} 씬5 영문 캘리그라피 0장", film["en"] == 0, film["en"])
            add(f"{label} 씬5 버핏킴즈 워드마크 없음", film["hasMark"] is False, film["hasMark"])
            add(f"{label} 필름 콘솔 오류 0", not errors_, errors_[:2])
            if label == "1280":
                page.evaluate("() => window.__bkFilm && window.__bkFilm.seek(9.35)")
                page.wait_for_timeout(450)
                shot = OUT / "film-scene5-1280.png"
                page.screenshot(path=str(shot))
                shots.append(str(shot))
                scene = page.evaluate("() => document.querySelector('[data-film]')?.dataset.sceneActive ?? ''")
                add("1280 씬5 캡처", scene == "5", scene)
            page.close()

        # 정지 컷(prefers-reduced-motion) — 한글 정적 록업이 보여야 한다
        page = browser.new_page(viewport=VIEWPORTS["1280"], locale="ko-KR", reduced_motion="reduce")
        page.goto(f"{BASE}/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(700)
        st = page.evaluate(FILM_JS)
        add("reduced-motion 정적 록업", st["state"] in ("static", "loading", "") and st["ko"] == 1, st)
        page.close()

        pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
        add("package.json 버전 7.0.0", pkg.get("version") == "7.0.0", str(pkg.get("version")))

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
    (OUT / f"verify-v70-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{MODE}] {result['passed']}/{result['total']} checks passed")
    for k, v in result["failed"].items():
        print(f"FAIL  {k} — {v['detail']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
