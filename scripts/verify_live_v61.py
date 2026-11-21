#!/usr/bin/env python3
"""v6.1 라이브 실측 — https://byhan2025.github.io/buffetkimz-web/

배포 뒤 gh-pages가 실제로 새 빌드(v6.1.0)를 서빙하는지 확인하고, 브리프의 라이브 항목을 잰다.
  · HTTP: /, /posts/pension-tax-order/, /apps/pension-tax/, /apps/pension-draw/run/ 200
  · 1280·390: 콘솔 오류 0 · 가로 넘침 0
  · 홈 첫 방문 투어: 자동 시작 → 3스텝 → 건너뛰기 → bk_tour_done_v1 → 재방문 무표시 → ? 가이드 재호출
  · 글 여정 바(390): 다음 추천 · 필요 없어요 접기 · 기억
  · 도구 여정 바(1280): 이 다음으로 많이 쓰는 도구 · 건너뛰기 · sticky 결과 바 비겹침(390)
  · 연금 인출 사용성 3건(잠금 잠액 details · 예시/내 조건 칩 · 안내 문구)

캡처: reports/buffetkimz-web/v61-guide/live-tour-390.png · live-post-guide-390.png · live-tool-guide-1280.png
결과: reports/buffetkimz-web/v61-guide/live-report.json

사용: python3 scripts/verify_live_v61.py   (배포 후 60~120초 기다렸다가)
"""
from __future__ import annotations

import json
import os
import pathlib
import time

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
import urllib.request  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ORIGIN = "https://byhan2025.github.io"
PREFIX = "/buffetkimz-web"
BASE = ORIGIN + PREFIX
OUT = pathlib.Path(
    os.environ.get("LIVE_OUT") or "/workspace/reports/buffetkimz-web/v61-guide"
)
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

ROUTES = ["/", "/posts/pension-tax-order/", "/apps/pension-tax/", "/apps/pension-draw/run/"]
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  let max = 0;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    max = Math.max(max, r.right - vw);
  }
  return { overflow: Math.max(0, document.documentElement.scrollWidth - vw), maxElOver: Math.round(Math.max(0, max)) };
}"""

BAR_JS = """() => {
  const bar = document.querySelector('[data-journey-bar]');
  const btn = document.querySelector('[data-guide-open]');
  const sticky = document.querySelector('[data-sticky-summary]');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return {top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height)}; };
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const stickyVisible = !!sticky && getComputedStyle(sticky).display !== 'none';
  const barBox = r(bar), btnBox = r(btn), stickyBox = stickyVisible ? r(sticky) : null;
  return {
    barVisible: vis(bar),
    barText: bar ? bar.innerText.replace(/\\s+/g, ' ').trim() : null,
    skipLabel: bar ? bar.querySelector('[data-journey-skip]').innerText.trim() : null,
    btn: btnBox, btnVisible: vis(btn),
    sticky: stickyBox,
    overlapSticky: !!(barBox && stickyBox && barBox.bottom > stickyBox.top + 1 && barBox.top < stickyBox.bottom),
    btnOverlapSticky: !!(btnBox && stickyBox && btnBox.bottom > stickyBox.top + 1 && btnBox.top < stickyBox.bottom),
  };
}"""


def wait_for_deploy(timeout=240):
    """gh-pages CDN이 v6.1 마크업(guide-dock)을 서빙할 때까지 기다린다."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{BASE}/?cachebust={int(time.time())}", timeout=20) as r:
                html = r.read().decode("utf-8", "ignore")
            if "data-guide-dock" in html and "v6.1" not in html[:0]:
                return True, int(time.time() - start)
        except Exception:
            pass
        time.sleep(10)
    return False, int(time.time() - start)


def new_page(browser, vp):
    ctx = browser.new_context(viewport=vp, device_scale_factor=1)
    page = ctx.new_page()
    errors: list = []
    page.on("console", lambda m: errors.append({"type": m.type, "text": m.text}) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)}))
    return ctx, page, errors


def main() -> int:
    report: dict = {"base": BASE, "checks": {}, "shots": []}
    ok = True

    statuses = {}
    for route in ROUTES:
        try:
            with urllib.request.urlopen(f"{BASE}{route}", timeout=25) as r:
                statuses[route] = r.status
        except Exception as exc:  # noqa: BLE001
            statuses[route] = f"error: {exc}"
    report["http"] = statuses
    if any(v != 200 for v in statuses.values()):
        ok = False
        report.setdefault("failed", []).append("HTTP 200")

    deployed, waited = wait_for_deploy()
    report["deployed_v61"] = {"served": deployed, "waited_s": waited}
    if not deployed:
        ok = False
        report.setdefault("failed", []).append("gh-pages v6.1 마크업")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ① 홈 — 첫 방문 투어(390 캡처) · 건너뛰기 · 재방문 · ? 가이드
        ctx, page, errors = new_page(browser, VIEWPORTS["390"])
        page.goto(f"{BASE}/", wait_until="load", timeout=60000)
        page.wait_for_timeout(600)
        tour_ok = True
        try:
            page.wait_for_selector(".driver-popover", timeout=25000, state="visible")
        except Exception:
            tour_ok = False
        page.wait_for_timeout(1400)
        shot = OUT / "live-tour-390.png"
        if tour_ok:
            page.screenshot(path=str(shot))
            report["shots"].append(str(shot))
        titles = []
        if tour_ok:
            for i in range(3):
                titles.append(page.eval_on_selector(".driver-popover-title", "el => el.innerText.trim()"))
                if i < 2:
                    page.click(".driver-popover-next-btn")
                    page.wait_for_timeout(1200)
            page.click(".bk-tour-skip")
            page.wait_for_timeout(500)
        stored = page.evaluate("() => localStorage.getItem('bk_tour_done_v1')")
        page.goto(f"{BASE}/", wait_until="load", timeout=60000)
        page.wait_for_timeout(14000)
        revisit = page.locator(".driver-popover").count() > 0
        page.click("[data-guide-open]")
        page.wait_for_timeout(900)
        reopened = page.locator(".driver-popover").count() > 0
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["home-tour-390"] = {
            "tour": tour_ok,
            "steps": titles,
            "storage": stored,
            "revisit_popover": revisit,
            "guide_reopen": reopened,
            "overflow": overflow,
            "console_errors": errors,
        }
        for cond, name in [
            (tour_ok, "라이브 홈 투어 자동 시작"),
            (titles[:1] == ["① 오늘 확인할 것"], "투어 첫 스텝"),
            (stored == "done", "건너뛰기 기억"),
            (not revisit, "재방문 무표시"),
            (reopened, "? 가이드 재호출"),
            (overflow["overflow"] == 0, "390 가로 넘침 0"),
            (len([e for e in errors if e["type"] == "pageerror"]) == 0, "JS 오류 0"),
        ]:
            if not cond:
                ok = False
                report.setdefault("failed", []).append(f"home-tour-390: {name}")
        ctx.close()

        # ①-b 홈 1280 — 넘침·콘솔만
        ctx, page, errors = new_page(browser, VIEWPORTS["1280"])
        page.goto(f"{BASE}/", wait_until="load", timeout=60000)
        page.wait_for_timeout(1500)
        page.keyboard.press("Escape")
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["home-1280"] = {"overflow": overflow, "console_errors": errors}
        if overflow["overflow"] != 0 or [e for e in errors if e["type"] == "pageerror"]:
            ok = False
            report.setdefault("failed", []).append("home-1280 넘침/오류")
        ctx.close()

        # ② 글 — 읽기 여정 바(390 캡처) · 접기 · 기억 · ? 가이드
        ctx, page, errors = new_page(browser, VIEWPORTS["390"])
        page.goto(f"{BASE}/posts/pension-tax-order/", wait_until="load", timeout=60000)
        page.wait_for_timeout(900)
        before = page.evaluate(BAR_JS)
        page.screenshot(path=str(OUT / "live-post-guide-390.png"))
        report["shots"].append(str(OUT / "live-post-guide-390.png"))
        page.click("[data-journey-skip]")
        page.wait_for_timeout(400)
        after_skip = page.evaluate(BAR_JS)
        stored = page.evaluate("() => localStorage.getItem('bk_read_guide_v1')")
        page.reload(wait_until="load")
        page.wait_for_timeout(800)
        after_reload = page.evaluate(BAR_JS)
        page.click("[data-guide-open]")
        page.wait_for_timeout(900)
        reopened = page.locator(".driver-popover").count() > 0
        after_reopen = page.evaluate(BAR_JS)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["post-390"] = {
            "before": before,
            "after_skip": after_skip,
            "storage": stored,
            "after_reload": after_reload,
            "guide_popover": reopened,
            "after_reopen": after_reopen,
            "overflow": overflow,
            "console_errors": errors,
        }
        for cond, name in [
            (before["barVisible"], "글 여정 바 노출"),
            ("다음 추천" in (before["barText"] or ""), "다음 추천 문구"),
            (before["skipLabel"] == "필요 없어요", "필요 없어요"),
            (not after_skip["barVisible"], "접기"),
            (stored == "off", "접힘 기억"),
            (not after_reload["barVisible"], "재방문 접힘"),
            (reopened and after_reopen["barVisible"], "? 가이드로 다시 켜기"),
            (overflow["overflow"] == 0, "390 가로 넘침 0"),
            (len([e for e in errors if e["type"] == "pageerror"]) == 0, "JS 오류 0"),
        ]:
            if not cond:
                ok = False
                report.setdefault("failed", []).append(f"post-390: {name}")
        ctx.close()

        # ③ 도구 — 도구 여정 바(1280 캡처) + 390 sticky 비겹침
        ctx, page, errors = new_page(browser, VIEWPORTS["1280"])
        page.goto(f"{BASE}/apps/pension-tax/", wait_until="load", timeout=60000)
        page.wait_for_timeout(1200)
        before = page.evaluate(BAR_JS)
        page.screenshot(path=str(OUT / "live-tool-guide-1280.png"))
        report["shots"].append(str(OUT / "live-tool-guide-1280.png"))
        page.click("[data-journey-skip]")
        page.wait_for_timeout(300)
        after_skip = page.evaluate(BAR_JS)
        stored = page.evaluate("() => localStorage.getItem('bk_tool_guide_v1')")
        page.reload(wait_until="load")
        page.wait_for_timeout(700)
        after_reload = page.evaluate(BAR_JS)
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["tool-1280"] = {
            "before": before,
            "after_skip": after_skip,
            "storage": stored,
            "after_reload": after_reload,
            "overflow": overflow,
            "console_errors": errors,
        }
        for cond, name in [
            (before["barVisible"], "도구 여정 바 노출"),
            ("이 다음으로 많이 쓰는 도구" in (before["barText"] or ""), "다음 도구 문구"),
            ("연금 인출" in (before["barText"] or ""), "세액공제 → 연금 인출"),
            (before["skipLabel"] == "건너뛰기", "건너뛰기"),
            (not after_skip["barVisible"] and stored == "off", "접기·기억"),
            (not after_reload["barVisible"], "재방문 접힘"),
            (overflow["overflow"] == 0, "1280 가로 넘침 0"),
            (len([e for e in errors if e["type"] == "pageerror"]) == 0, "JS 오류 0"),
        ]:
            if not cond:
                ok = False
                report.setdefault("failed", []).append(f"tool-1280: {name}")
        ctx.close()

        ctx, page, errors = new_page(browser, VIEWPORTS["390"])
        page.goto(f"{BASE}/apps/pension-tax/", wait_until="load", timeout=60000)
        page.wait_for_timeout(1200)
        bar390 = page.evaluate(BAR_JS)
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["tool-390"] = {
            "bar": bar390,
            "overflow": overflow,
            "console_errors": errors,
        }
        for cond, name in [
            (bar390["barVisible"], "390 도구 바 노출"),
            (not bar390["overlapSticky"], "sticky 결과 바 비겹침"),
            (not bar390["btnOverlapSticky"], "? 버튼과 결과 바 비겹침"),
            (overflow["overflow"] == 0, "390 가로 넘침 0"),
        ]:
            if not cond:
                ok = False
                report.setdefault("failed", []).append(f"tool-390: {name}")
        ctx.close()

        # ④ 연금 인출 사용성 3건 (라이브)
        ctx, page, errors = new_page(browser, VIEWPORTS["390"])
        page.goto(f"{BASE}/apps/pension-draw/run/", wait_until="load", timeout=60000)
        page.wait_for_timeout(1500)
        ux = page.evaluate(
            """() => {
              const d = document.querySelector('[data-pdraw-balance]');
              const chip = document.querySelector('[data-pdraw-basis]');
              const guide = document.querySelector('[data-pdraw-guide]');
              const vis = (el) => !!el && (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : el.getBoundingClientRect().height > 0);
              const ranges = [...document.querySelectorAll('[data-pdraw] input[type=range]')];
              return {
                details: !!d, open: d ? d.open : null,
                summary: d ? d.querySelector('summary').innerText.replace(/\\s+/g, ' ').trim() : null,
                chip: chip ? chip.innerText.trim() : null,
                guide: guide ? guide.innerText.trim() : null,
                visibleRanges: ranges.filter(vis).length,
              };
            }"""
        )
        page.locator("[data-pdraw] input[type=range]").first.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(400)
        chip_after = page.eval_on_selector("[data-pdraw-basis]", "el => el.innerText.trim()")
        page.click("[data-pdraw-balance] summary")
        page.wait_for_timeout(400)
        opened = page.evaluate(
            """() => {
              const d = document.querySelector('[data-pdraw-balance]');
              const vis = (el) => !!el && (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : el.getBoundingClientRect().height > 0);
              const ranges = [...document.querySelectorAll('[data-pdraw] input[type=range]')];
              return { open: d.open, visibleRanges: ranges.filter(vis).length };
            }"""
        )
        page.screenshot(path=str(OUT / "live-pension-ux-390.png"))
        report["shots"].append(str(OUT / "live-pension-ux-390.png"))
        overflow = page.evaluate(OVERFLOW_JS)
        report["checks"]["pension-ux-390"] = {
            **ux,
            "chip_after_input": chip_after,
            "opened": opened,
            "overflow": overflow,
            "console_errors": errors,
        }
        for cond, name in [
            (ux["details"] and ux["open"] is False, "잔액 details 접힘"),
            ((ux["summary"] or "").startswith("더 정확히 보기 — 연금 잔액 넣기"), "접힘 카드 문구"),
            (ux["visibleRanges"] == 3, "첫 화면 입력 3슬라이더"),
            (ux["chip"] == "예시 값 기준" and chip_after == "내 조건 기준", "예시/내 조건 칩 전환"),
            (
                ux["guide"] == "기본 예시 값입니다. 내 값으로 바꿔 보세요 — 움직이는 즉시 계산됩니다(저장 안 됨).",
                "입력 안내 문구",
            ),
            (opened["open"] is True and opened["visibleRanges"] == 4, "펼치면 잔액 입력"),
            (overflow["overflow"] == 0, "390 가로 넘침 0"),
        ]:
            if not cond:
                ok = False
                report.setdefault("failed", []).append(f"pension-ux-390: {name}")
        ctx.close()

        browser.close()

    report["ok"] = ok
    (OUT / "live-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": ok, "failed": report.get("failed", []), "deployed": report["deployed_v61"], "shots": report["shots"]}, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
