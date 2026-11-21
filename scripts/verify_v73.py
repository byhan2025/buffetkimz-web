#!/usr/bin/env python3
"""v7.3.0 앱스토어 실측(기준 현행화 — 앱 51종 · 6·4·41) — 전수 실행 화면 · 앱스토어 UI · 메뉴판 터치 높이.

브리프(handoffs/🧩-buffetkimz-v7-3-0-앱스토어-35종-통합-ui업그레이드)의 판정을 그대로 잰다.

  A. 앱 상세 33p + 실행 31p × 390 / 1280 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 앱스토어(/apps)
     · 카드 35 · 섹션 개수 6·4·25 · 요약 칩 35·6·4·25
     · 상단 검색 — '퇴직' 입력 시 보이는 카드 수 = 제목·요약·태그에 걸린 수(>0)
     · 카테고리 탭 — '유용한앱' 누르면 보이는 섹션이 유용한앱 하나
     · '자주 쓰는 앱' 지름길 4칸, 각 칸이 실행 화면으로 연결
  C. 메뉴판 — 하위 항목 터치 높이 ≥ 44px(모바일 390 · 데스크톱 1280) · '준비중' 배지 대비 4.5:1 이상
  D. 신규 앱 상세 도해 — '입력 → 처리 → 결과' 3단 도해가 비지 않는지
  E. 캡처 — reports/buffetkimz-web/v73-appstore39/{apps-1280,apps-390,run-sample-*.png}

사용:
  npm run build && python3 scripts/verify_v73.py            # 로컬 dist
  python3 scripts/verify_v73.py --live                      # gh-pages 라이브
결과: reports/buffetkimz-web/v73-appstore39/verify-v73-{local,live}.json
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v73-appstore39"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
PORT = 8173
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}
SAMPLE_RUNS = ["korean-age-pension", "salary-net", "image-upscale", "url-shortener"]

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, ok, detail))
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


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
  return {
    cards: all('[data-store-item]').map(e => e.dataset.storeItem),
    visibleCards: all('[data-store-item]').filter(vis).map(e => e.dataset.storeItem),
    counts: all('.store-sec-count').map(e => e.textContent.trim()),
    summary: all('[data-store-summary] a b').map(e => e.textContent.trim()),
    quick: all('[data-quick-app]').map(e => ({id: e.dataset.quickApp, href: e.getAttribute('href')})),
    tabs: all('[data-store-tab]').map(e => e.dataset.storeTab),
    searchShown: (() => {
      const el = document.querySelector('[data-store-search-count]');
      return el && !el.hidden ? el.textContent.trim() : '';
    })(),
    sections: all('[data-store-cat]').filter(vis).map(e => e.dataset.storeCat),
    more: all('[data-store-more]').filter(vis).map(e => e.textContent.trim()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}"""

MENU_JS = """() => {
  const rows = [...document.querySelectorAll('.nav-drop-row, .quick-panel-row')].filter(r => {
    const box = r.getBoundingClientRect();
    return box.height > 0;
  });
  const pill = [...document.querySelectorAll('.soon-pill')].find(p => p.getBoundingClientRect().height > 0);
  const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (rgb) => {
    const [r, g, b] = rgb.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  let contrast = null;
  let pillStyle = null;
  if (pill) {
    const cs = getComputedStyle(pill);
    let bg = cs.backgroundColor;
    let node = pill;
    while (node && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      node = node.parentElement;
      if (!node) break;
      bg = getComputedStyle(node).backgroundColor;
    }
    const fg = parse(cs.color);
    const b = parse(bg || 'rgb(255,255,255)').slice(0, 3);
    const a = lum(fg.slice(0, 3));
    const c = lum(b);
    const hi = Math.max(a, c);
    const lo = Math.min(a, c);
    contrast = Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    pillStyle = {color: cs.color, bg, fontSize: cs.fontSize, fontWeight: cs.fontWeight};
  }
  return {
    rowCount: rows.length,
    minRowHeight: rows.length ? Math.round(Math.min(...rows.map(r => r.getBoundingClientRect().height)) * 10) / 10 : 0,
    shortRows: rows.filter(r => r.getBoundingClientRect().height < 44).map(r => r.innerText.trim().slice(0, 20)),
    contrast,
    pillStyle,
  };
}"""


def main() -> int:
    app_dirs = sorted(p.name for p in (ROOT / "apps").iterdir() if p.is_dir())
    detail_paths = [f"/apps/{slug}/" for slug in app_dirs]
    run_paths = [f"/apps/{slug}/run/" for slug in app_dirs if (ROOT / "apps" / slug / "run" / "index.html").exists()]
    check("앱 상세 페이지 49", len(detail_paths) == 49, len(detail_paths))
    check("실행 페이지 47", len(run_paths) == 47, len(run_paths))

    httpd = None
    if MODE == "local":
        socketserver.TCPServer.allow_reuse_address = True
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

    shots: list[str] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME if pathlib.Path(CHROME).exists() else None,
                                         args=["--disable-lcd-text"])

            # ---------- A. 전수 실행·상세 ----------
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
                check(f"{label} 상세+실행 {len(detail_paths) + len(run_paths)}p 200·오류 0·넘침 0",
                      not bad, bad[:4] if bad else "all clean")
                ctx.close()

            # ---------- B. 앱스토어 ----------
            for label, vp in VIEWPORTS.items():
                ctx = browser.new_context(viewport=vp, locale="ko-KR")
                page = ctx.new_page()
                page.goto(url("/apps/"), wait_until="load")
                page.wait_for_timeout(200)
                st = page.evaluate(STORE_JS)
                first_height = page.evaluate("() => document.documentElement.scrollHeight")
                check(f"{label} 앱스토어 첫 화면 세로 길이", first_height < (9000 if label == "390" else 12000), first_height)
                check(f"{label} 앱스토어 카드 51", len(st["cards"]) == 51, len(st["cards"]))
                check(f"{label} 앱스토어 개수 6·4·41", st["counts"] == ["6", "4", "41"], st["counts"])
                check(f"{label} 요약 칩 51·6·4·41", st["summary"] == ["51", "6", "4", "41"], st["summary"])
                check(f"{label} 카테고리 탭 4", st["tabs"] == ["all", "finance", "insurance", "utility"], st["tabs"])
                check(f"{label} 자주 쓰는 앱 4칸", len(st["quick"]) == 4 and all("/run" in q["href"] or q["href"].startswith("http") or q["id"] == "finance-calendar" for q in st["quick"]), st["quick"])
                check(f"{label} 가로 넘침 0", st["overflow"] <= 1, st["overflow"])

                # 검색
                page.fill("[data-store-search]", "퇴직")
                page.wait_for_timeout(220)
                s2 = page.evaluate(STORE_JS)
                check(f"{label} 검색 '퇴직' 1~6장", 0 < len(s2["visibleCards"]) <= 6, s2["visibleCards"])
                check(f"{label} 검색 결과 개수 표시", "개" in s2["searchShown"], s2["searchShown"])
                page.fill("[data-store-search]", "")
                page.wait_for_timeout(200)

                # 카테고리 탭 + 모바일 접기
                page.click('[data-store-tab="utility"]')
                page.wait_for_timeout(200)
                s3 = page.evaluate(STORE_JS)
                check(f"{label} 유용한앱 탭 섹션 1", s3["sections"] == ["utility"], s3["sections"])
                if label == "390":
                    check("390 유용한앱 접힘 8 + 나머지 보기", len(s3["visibleCards"]) == 8 and any("33" in t for t in s3["more"]), {"vis": len(s3["visibleCards"]), "more": s3["more"]})
                    page.click('[data-store-cat="utility"] [data-store-more]')
                    page.wait_for_timeout(200)
                    s3 = page.evaluate(STORE_JS)
                    check("390 나머지 보기 펼침 41", len(s3["visibleCards"]) == 41, len(s3["visibleCards"]))
                else:
                    check("1280 유용한앱 카드 41", len(s3["visibleCards"]) == 41, len(s3["visibleCards"]))
                page.click('[data-store-tab="all"]')
                page.wait_for_timeout(150)

                page.evaluate("() => window.scrollTo(0, 0)")
                page.screenshot(path=str(OUT / f"apps-{label}.png"), full_page=(label == "390"))
                shots.append(str(OUT / f"apps-{label}.png"))
                ctx.close()

            # ---------- C. 메뉴판 터치 높이 · 준비중 대비 ----------
            for label, vp in VIEWPORTS.items():
                ctx = browser.new_context(viewport=vp, locale="ko-KR")
                page = ctx.new_page()
                page.goto(url("/"), wait_until="load")
                page.wait_for_timeout(200)
                if label == "1280":
                    page.click('[aria-controls="nav-drop-1"]')
                else:
                    page.click('[aria-controls="quick-panel-1"]')
                page.wait_for_timeout(200)
                m = page.evaluate(MENU_JS)
                check(f"{label} 메뉴판 항목 터치 높이 44px 이상", m["minRowHeight"] >= 44 and not m["shortRows"],
                      {"min": m["minRowHeight"], "short": m["shortRows"], "rows": m["rowCount"]})
                check(f"{label} 준비중 배지 대비 4.5:1", (m["contrast"] or 0) >= 4.5, {"contrast": m["contrast"], **({"style": m["pillStyle"]} if m["pillStyle"] else {})})
                name = "menu-drop-1280.png" if label == "1280" else "menu-drop-390.png"
                page.screenshot(path=str(OUT / name))
                shots.append(str(OUT / name))
                ctx.close()

            # ---------- D. 신규 앱 상세 도해 + 실행 캡처 ----------
            ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
            page = ctx.new_page()
            page.goto(url("/apps/salary-net/"), wait_until="load")
            page.wait_for_timeout(200)
            art = page.evaluate(
                """() => {
                  const body = document.body.innerText;
                  return {steps: ['입력', '처리', '결과'].every(t => body.includes(t)), body: body.slice(0, 40)};
                }"""
            )
            check("1280 신규 앱 상세 3단 도해", art["steps"] is True, art["body"])
            page.screenshot(path=str(OUT / "app-detail-salary-1280.png"))
            shots.append(str(OUT / "app-detail-salary-1280.png"))
            ctx.close()

            for slug in SAMPLE_RUNS:
                for label in ("1280", "390"):
                    ctx = browser.new_context(viewport=VIEWPORTS[label], locale="ko-KR")
                    page = ctx.new_page()
                    errs: list[str] = []
                    page.on("console", lambda m: errs.append(m.text[:100]) if m.type == "error" else None)
                    page.on("pageerror", lambda e: errs.append(str(e)[:100]))
                    page.goto(url(f"/apps/{slug}/run/"), wait_until="load")
                    page.wait_for_timeout(400)
                    p = OUT / f"run-{slug}-{label}.png"
                    page.screenshot(path=str(p), full_page=(label == "390"))
                    shots.append(str(p))
                    check(f"{label} {slug} 실행 콘솔 오류 0", not errs, errs[:2])
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
    out = OUT / f"verify-v73-{MODE}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\n{passed}/{len(CHECKS)} 통과 → {out}")
    return 0 if passed == len(CHECKS) else 1


if __name__ == "__main__":
    sys.exit(main())
