#!/usr/bin/env python3
"""v8.0 「한스푼 아카데미」 파일럿 — 실물 캡처·검증.

무엇을 재는가
  A. /academy/ · /academy/step2-pension-tax-limit/ — 1280·390 HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 헤더 — 1280·1024·390 에서 메뉴 가로 넘침 0 · '아카데미' 항목이 실제로 보이는가
  C. 390 모바일 — 퀵 탭 6칸 유지 · 하위 드로어에 아카데미 진입
  D. 강의 상호작용 — 진단 3문항 → 경로 전환 / 운영표 1칸 채우기 → 칸 완성 · 주소 불변
  E. 캡처 — 1280·390 전체 화면 + 주요 구획

사용: npm run build && python3 scripts/capture_academy_v80.py
결과: /workspace/reports/buffetkimz-web/academy-pilot/
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/academy-pilot")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("ACADEMY_PORT", "8190"))
BASE = f"http://127.0.0.1:{PORT}"

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

PAGES = [
    ("academy-hub", "/academy/"),
    ("academy-lesson", "/academy/step2-pension-tax-limit/"),
]
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page_at(width: str):
        ctx = browser.new_context(viewport=VIEWPORTS[width], locale="ko-KR", device_scale_factor=1)
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    # ---------------------------------------------------------------- A
    bad, console_errors, overflow = [], [], []
    for width in ("1280", "390"):
        for name, path in PAGES:
            ctx, pg, errors = page_at(width)
            resp = pg.goto(BASE + path, wait_until="networkidle")
            pg.wait_for_timeout(500)
            if resp is None or resp.status >= 400:
                bad.append(f"{width} {path} {getattr(resp, 'status', 'none')}")
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:140]}")
                errors.clear()
            size = pg.evaluate(
                "() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
            )
            if size["sw"] > size["cw"] + 1:
                overflow.append(f"{width} {path} {size['sw']}>{size['cw']}")
            pg.screenshot(path=str(OUT / f"{name}-{width}-full.png"), full_page=True)
            pg.screenshot(path=str(OUT / f"{name}-{width}-fold.png"))
            ctx.close()
    check("A1 두 페이지 × 1280/390 HTTP 200", not bad, ", ".join(bad))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # ---------------------------------------------------------------- B 헤더
    nav_report = {}
    for width in (1280, 1024):
        ctx, pg, _ = page_at("1280")
        pg.set_viewport_size({"width": width, "height": 900})
        pg.goto(BASE + "/", wait_until="networkidle")
        pg.wait_for_timeout(400)
        info = pg.evaluate(
            """() => {
              const header = document.querySelector('.site-header-row');
              const nav = document.querySelector('.site-nav');
              const link = [...document.querySelectorAll('.site-nav .nav-link')].find(a => a.textContent.trim() === '아카데미');
              const r = link?.getBoundingClientRect();
              return {
                headerRight: header ? Math.round(header.getBoundingClientRect().right) : null,
                navRight: nav ? Math.round(nav.getBoundingClientRect().right) : null,
                academyVisible: !!link && r.width > 0 && r.left >= 0 && r.right <= innerWidth,
                academyRight: r ? Math.round(r.right) : null,
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth,
                labels: [...document.querySelectorAll('.site-nav .nav-link')].map(a => a.textContent.trim()),
              };
            }"""
        )
        nav_report[width] = info
        check(
            f"B 데스크톱 {width}px — '아카데미' 메뉴 보임 · 가로 넘침 0",
            info["academyVisible"] and info["scrollW"] <= info["clientW"] + 1,
            f"right {info['academyRight']} / nav right {info['navRight']} / {info['scrollW']}<={info['clientW']}",
        )
        pg.screenshot(path=str(OUT / f"header-nav-{width}.png"), clip={"x": 0, "y": 0, "width": width, "height": 96})
        ctx.close()

    # ---------------------------------------------------------------- C 모바일
    ctx, pg, _ = page_at("390")
    pg.goto(BASE + "/academy/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    quick = pg.evaluate(
        """() => ({
          tabs: [...document.querySelectorAll('.site-quick-link')].map(a => a.textContent.trim()),
          overflow: [...document.querySelectorAll('.site-quick-link')].some(a => a.scrollWidth > a.clientWidth + 1),
          heights: [...document.querySelectorAll('.site-quick-link')].map(a => Math.round(a.getBoundingClientRect().height)),
        })"""
    )
    check(
        "C1 390 퀵 탭 6칸 유지 · 글자 잘림 0",
        len(quick["tabs"]) == 6 and not quick["overflow"],
        f"{quick['tabs']}",
    )
    drawer = pg.evaluate(
        """() => {
          const btn = document.querySelector('[data-menu-toggle]');
          btn?.click();
          const panel = document.querySelector('[data-menu-panel]');
          const labels = [...(panel?.querySelectorAll('a') ?? [])].map(a => a.textContent.trim());
          return { open: panel ? !panel.classList.contains('hidden') : false, labels };
        }"""
    )
    check("C2 390 ≡ 드로어에 '아카데미'", drawer["open"] and "아카데미" in drawer["labels"], ", ".join(drawer["labels"]))
    pg.screenshot(path=str(OUT / "mobile-drawer-390.png"))
    ctx.close()

    # ---------------------------------------------------------------- D 상호작용
    ctx, pg, errors = page_at("1280")
    pg.goto(BASE + "/academy/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    diag = pg.evaluate(
        """() => {
          const box = document.querySelector('[data-diagnosis]');
          const checks = [...box.querySelectorAll('[data-diagnosis-check]')];
          const shown = () => [...box.querySelectorAll('[data-diagnosis-answer]')].filter(e => !e.hidden).map(e => e.dataset.diagnosisAnswer);
          const out = { steps: [] };
          out.steps.push(shown());
          checks[0].click(); out.steps.push(shown());
          checks[1].click(); out.steps.push(shown());
          checks[2].click(); out.steps.push(shown());
          out.count = box.querySelector('[data-diagnosis-count]')?.textContent.trim();
          return out;
        }"""
    )
    check(
        "D1 진단 3문항 → 경로 전환(0·1·2·3개)",
        diag["steps"] == [["none"], ["starter"], ["builder"], ["all"]] and diag["count"] == "3개 체크",
        f"{diag['steps']} / {diag['count']}",
    )

    pg.goto(BASE + "/academy/step2-pension-tax-limit/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    before_url = pg.url
    sheet = pg.evaluate(
        """() => {
          const root = document.querySelector('[data-sheet]');
          const pick = (name, value) => {
            const el = [...root.querySelectorAll(`input[name="${name}"]`)].find(i => i.value === String(value));
            el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          const credit0 = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-irp', 200);
          const credit200 = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-irp', 300);
          pick('sheet-bracket', 'high');
          const creditHigh = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-bracket', 'low');
          root.querySelector('[data-sheet-commit]')?.click();
          return {
            credit0, credit200, creditHigh,
            filled: !root.querySelector('[data-sheet-filled]')?.hidden,
            empty: root.querySelector('[data-sheet-empty]')?.hidden,
            out: [...root.querySelectorAll('.sheet-filled-list dd')].map(d => d.textContent.trim()),
            progress: root.querySelector('[data-sheet-progress]')?.textContent.trim(),
            stored: Object.keys(localStorage).length,
          };
        }"""
    )
    check(
        "D2 운영표 계산 148만 5,000 / 132만 / 118만 8,000",
        sheet["credit0"] == "148만 5,000원"
        and sheet["credit200"] == "132만원"
        and sheet["creditHigh"] == "118만 8,000원",
        f"{sheet['credit0']} · {sheet['credit200']} · {sheet['creditHigh']}",
    )
    check(
        "D3 '이 칸 채우기' → 칸 완성(계좌 배치표 첫 줄)",
        sheet["filled"] and sheet["empty"] and sheet["progress"] == "STEP 2 · 1 / 7칸",
        f"{sheet['out']} / {sheet['progress']}",
    )
    check("D4 입력값 저장 0건(localStorage 비어 있음) · 주소 불변", sheet["stored"] == 0 and pg.url == before_url, pg.url)
    pg.screenshot(path=str(OUT / "lesson-sheet-filled-1280.png"), clip={"x": 0, "y": 0, "width": 1280, "height": 900})
    sheet_el = pg.query_selector("#sheet")
    if sheet_el:
        sheet_el.scroll_into_view_if_needed()
        pg.wait_for_timeout(250)
        pg.screenshot(path=str(OUT / "lesson-sheet-filled-1280.png"))
    ctx.close()

    ctx, pg, _ = page_at("390")
    pg.goto(BASE + "/academy/step2-pension-tax-limit/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    pg.evaluate(
        """() => {
          const root = document.querySelector('[data-sheet]');
          root.querySelector('[data-sheet-commit]')?.click();
        }"""
    )
    sheet_el = pg.query_selector("#sheet")
    if sheet_el:
        sheet_el.scroll_into_view_if_needed()
        pg.wait_for_timeout(250)
        pg.screenshot(path=str(OUT / "lesson-sheet-filled-390.png"))
    pg.goto(BASE + "/academy/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    pg.evaluate("() => document.querySelector('#roadmap')?.scrollIntoView()")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "hub-roadmap-390.png"))
    ctx.close()

    # ---------------------------------------------------------------- E 구획 캡처
    for width in (1280, 390):
        ctx, pg, _ = page_at(str(width))
        pg.goto(BASE + "/academy/", wait_until="networkidle")
        pg.wait_for_timeout(300)
        for sel, name in (("#roadmap", "hub-roadmap"), ("#paths", "hub-paths"), ("#pilot", "hub-pilot")):
            el = pg.query_selector(sel)
            if el:
                el.scroll_into_view_if_needed()
                pg.wait_for_timeout(200)
                pg.screenshot(path=str(OUT / f"{name}-{width}.png"))
        pg.goto(BASE + "/academy/step2-pension-tax-limit/", wait_until="networkidle")
        pg.wait_for_timeout(300)
        for sel, name in (("[data-hook]", "lesson-hook"), ("#calc", "lesson-calc"), ("#cards", "lesson-cards")):
            el = pg.query_selector(sel)
            if el:
                el.scroll_into_view_if_needed()
                pg.wait_for_timeout(200)
                pg.screenshot(path=str(OUT / f"{name}-{width}.png"))
        ctx.close()

    browser.close()

httpd.shutdown()

failed = [c for c in CHECKS if not c["ok"]]
result = {
    "version": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"],
    "total": len(CHECKS),
    "passed": len(CHECKS) - len(failed),
    "failed": len(failed),
    "nav": {str(k): v for k, v in nav_report.items()},
    "checks": CHECKS,
}
(OUT / "verify-academy-v80.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / 'verify-academy-v80.json'}")
