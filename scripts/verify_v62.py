#!/usr/bin/env python3
"""v6.2 소개(/about) 실측 → **v7.0 전면 재창조 기준으로 정합화**.

v6.2의 측정 대상(옛 소개 구조)은 v7.0에서 사라졌다. 이 파일은 같은 목적 —
'소개 페이지가 브랜드 광고로서 임팩트·흥미·정합성을 갖췄는가' — 를 새 구조로 다시 잰다.

  · HTTP 200 · 콘솔 오류 0 · 가로 넘침 0 (1280 / 390)
  · 히어로: 한 문장 선언 + 한글 캘리그라피 + 확인 숫자 3 + 기준일
  · 숫자는 홈 크레딧(금융지식 편수 · 앱스토어 종수 · 금융캘린더 건수)과 일치
  · 고민 칩 4(연금·투자·절세·보험) → 클릭 시 맞춤 컨설팅 + 앱 2 + 글 1
  · 전문 영역 탭 3 · 서사 3막 · 철학 3장 · 브랜드 쇼케이스 2장 · CTA
  · 방어적 표현 0 · 모바일 고정 바 없음 · 터치 44px

사용: npm run build && python3 scripts/verify_v62.py
결과: reports/buffetkimz-web/v62-about/verify-v62.json (+ PNG)
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v62-about"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8152
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "/buffetkimz-web"
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

ABOUT_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => document.querySelector(s)?.innerText.replace(/\\s+/g,' ').trim() ?? '';
  const stats = all('[data-about-stats] dd b').map(e => e.textContent.trim());
  const heroBtns = all('.ab-hero-actions a').map(a => Math.round(a.getBoundingClientRect().height));
  return {
    h1: txt('h1'),
    ko: !!document.querySelector('.ab-sign-ko'),
    stats,
    chips: all('.fcheck-chip').map(e => e.innerText.replace(/\\s+/g,' ').trim()),
    areas: all('[data-ab-tab]').map(e => e.dataset.abTab),
    panels: all('[data-ab-panel]').length,
    acts: all('.ab-act').length,
    phil: all('.ab-phil-card').length,
    brandImgs: all('.ab-brand-art img').length,
    cta: txt('.ab-cta'),
    heroBtns,
    fixedBar: all('body *').filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().bottom > innerHeight - 4 && e.getBoundingClientRect().height > 40 && e.getBoundingClientRect().width > 300).length,
    signWidth: Math.round(document.querySelector('.ab-sign-ko')?.getBoundingClientRect().width ?? 0),
    vw: innerWidth,
    text: document.body.innerText,
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


FORBIDDEN = ["비영업", "권하지 않습니다", "저장 0건", "가입 권유", "중개 아님", "중개가 아닌"]


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

        # 홈 크레딧 — 소개 숫자와 같은 값을 쓰는지
        home = browser.new_page(viewport={"width": 1280, "height": 900})
        home.goto(f"{BASE}/", wait_until="networkidle")
        credits = home.evaluate(
            """() => [...document.querySelectorAll('.film-credit-count')].map(e => e.textContent.replace(/[^0-9]/g,''))"""
        )
        home.close()
        add("홈 크레딧 4축 읽기", len(credits) == 4, credits)

        for label, vp in VIEWPORTS.items():
            page = browser.new_page(viewport=vp, locale="ko-KR")
            console: list[str] = []
            page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console.append(str(e)))
            resp = page.goto(f"{BASE}/about/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(700)
            add(f"{label} /about/ HTTP 200", resp is not None and resp.status == 200, str(resp.status if resp else None))
            add(f"{label} 콘솔 오류 0", not console, console[:2])
            over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            add(f"{label} 가로 넘침 0", over == 0, over)

            a = page.evaluate(ABOUT_JS)
            add(f"{label} 히어로 한 문장", "숫자로 설계합니다" in a["h1"], a["h1"])
            add(f"{label} 한글 캘리그라피", a["ko"] is True, a["ko"])
            add(
                f"{label} 확인 숫자 3 + 홈 크레딧 일치",
                len(a["stats"]) == 3 and a["stats"] == credits[:3],
                {"about": a["stats"], "home": credits[:3]},
            )
            add(f"{label} 고민 칩 4개", len(a["chips"]) == 4, a["chips"])
            add(f"{label} 전문 영역 탭 3", a["areas"] == ["finance", "pension", "risk"] and a["panels"] == 3, a["areas"])
            add(f"{label} 서사 3막", a["acts"] == 3, a["acts"])
            add(f"{label} 철학 3장", a["phil"] == 3, a["phil"])
            add(f"{label} 브랜드 쇼케이스 2장", a["brandImgs"] == 2, a["brandImgs"])
            add(f"{label} CTA에 1:1 문의", "1:1 상담문의" in a["cta"], a["cta"][:80])
            hits = [w for w in FORBIDDEN if w in a["text"]]
            add(f"{label} 방어적 표현 0", not hits, ", ".join(hits))
            add(f"{label} 히어로 버튼 44px 이상", all(h >= 44 for h in a["heroBtns"]), a["heroBtns"])
            add(f"{label} 모바일 고정 하단 바 없음", a["fixedBar"] == 0, a["fixedBar"])
            add(f"{label} 캘리그라피가 화면 폭 안", a["signWidth"] <= a["vw"], {"sign": a["signWidth"], "vw": a["vw"]})

            if label == "1280":
                page.click(".fcheck-chip")
                page.wait_for_timeout(400)
                res = page.evaluate(
                    """() => ({
                      text: document.querySelector('.fcheck-result')?.innerText.replace(/\\s+/g,' ').trim() ?? '',
                      apps: document.querySelectorAll('.fcheck-app').length,
                      post: !!document.querySelector('.fcheck-post'),
                    })"""
                )
                add("1280 고민 칩 클릭 → 맞춤 컨설팅", "맞춤 컨설팅" in res["text"], res["text"][:100])
                add("1280 추천 앱 2 + 글 1", res["apps"] == 2 and res["post"], res)

                page.click("[data-ab-tab='risk']")
                page.wait_for_timeout(300)
                vis = page.evaluate("() => [...document.querySelectorAll('[data-ab-panel]')].filter(p => !p.hidden).map(p => p.dataset.abPanel)")
                add("1280 전문 영역 탭 전환", vis == ["risk"], vis)

            shot = OUT / f"{MODE}-about-{label}.png"
            page.screenshot(path=str(shot), full_page=(label == "1280"))
            shots.append(str(shot))
            page.close()

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
    (OUT / "verify-v62.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{MODE}] {result['passed']}/{result['total']} checks passed")
    for k, v in result["failed"].items():
        print(f"FAIL  {k} — {v['detail']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
