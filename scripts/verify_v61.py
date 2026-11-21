#!/usr/bin/env python3
"""v6.1 방문자 동선 가이드 — 로컬 실측 (1280 · 390).

브리프의 실측 항목을 그대로 잰다.
  · 홈 첫 방문 투어: 자동 시작 → 3스텝 → `건너뛰기` → localStorage(bk_tour_done_v1) → 재방문 시 안 뜸
  · `? 가이드` 재호출: 투어/여정 바가 다시 켜지는가
  · 글 읽기 여정 바: '다음 추천' 글·도구, `필요 없어요` 접기 · localStorage 기억 · 다시 켜기
  · 도구 여정 바: '이 다음으로 많이 쓰는 도구', `건너뛰기`, 모바일에서 sticky 결과 바와 겹치지 않는가
  · 전 화면 공통: 콘솔 오류 0 · 가로 넘침 0 · 44px 터치 높이

결과: reports/buffetkimz-web/v61-guide/capture-notes.json (+ PNG)
사용:  npm run build && LD_LIBRARY_PATH=... python3 scripts/verify_v61.py
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v61-guide"
PORT = 8123
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
BASE = f"http://127.0.0.1:{PORT}"
# 서브패스 빌드로 배포한 dist도 같은 주소 모양으로 재현한다
PREFIX = "/buffetkimz-web"

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        # 서브패스 빌드(dist가 /buffetkimz-web/… 를 가려도) 그대로 서빙 — 배포본 검증용(v6.3)
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
      let e = el.parentElement, clip = null;
      while (e && e !== document.documentElement) {
        const ox = getComputedStyle(e).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { clip = e.className; break; }
        e = e.parentElement;
      }
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), over: Math.round(r.right - vw), clip });
    }
  }
  return {
    docScroll: document.documentElement.scrollWidth,
    vw,
    overflow: Math.max(0, document.documentElement.scrollWidth - vw),
    wide: wide.slice(0, 6),
  };
}"""

BAR_JS = """() => {
  const bar = document.querySelector('[data-journey-bar]');
  const btn = document.querySelector('[data-guide-open]');
  const sticky = document.querySelector('[data-sticky-summary]');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return {top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width)}; };
  const visible = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  const stickyVisible = !!sticky && getComputedStyle(sticky).display !== 'none';
  const barBox = r(bar), btnBox = r(btn), stickyBox = stickyVisible ? r(sticky) : null;
  return {
    barPresent: !!bar,
    barVisible: visible(bar),
    barText: bar ? bar.innerText.replace(/\\s+/g, ' ').trim() : null,
    barHref: bar ? bar.querySelector('a')?.getAttribute('href') : null,
    skipLabel: bar ? bar.querySelector('[data-journey-skip]')?.innerText.trim() : null,
    skipH: bar ? Math.round(bar.querySelector('[data-journey-skip]').getBoundingClientRect().height) : null,
    btn: btnBox,
    btnVisible: visible(btn),
    bar: barBox,
    sticky: stickyBox,
    overlapSticky: !!(barBox && stickyBox && barBox.bottom > stickyBox.top + 1 && barBox.top < stickyBox.bottom),
    overlapBtn: !!(btnBox && stickyBox && btnBox.bottom > stickyBox.top + 1 && btnBox.top < stickyBox.bottom),
    btnInViewport: !!btnBox && btnBox.bottom <= window.innerHeight + 1 && btnBox.top >= 0,
    btnH: btnBox ? btnBox.h : null,
  };
}"""


def new_page(browser, vp):
    ctx = browser.new_context(viewport=vp, device_scale_factor=1)
    page = ctx.new_page()
    errors: list = []
    page.on("console", lambda m: errors.append({"type": m.type, "text": m.text}) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)}))
    return ctx, page, errors


def settle(page, ms=600):
    page.wait_for_timeout(ms)
    page.evaluate(
        """async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            await Promise.race([document.fonts.ready, wait(1500)]);
            return true;
        }"""
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    notes: dict = {"base": BASE, "checks": {}, "shots": []}
    httpd = serve()
    ok = True

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ---------- ① 홈 첫 방문 투어 · 건너뛰기 · 재방문 ----------
        for label, vp in VIEWPORTS.items():
            key = f"home-tour-{label}"
            ctx, page, errors = new_page(browser, vp)
            page.goto(f"{BASE}/", wait_until="load")
            settle(page, 400)
            tour_shown = True
            try:
                page.wait_for_selector(".driver-popover", timeout=22000, state="visible")
            except Exception:
                tour_shown = False
            progress = page.eval_on_selector(".driver-popover-progress-text", "el => el.innerText.trim()") if tour_shown else None
            title = page.eval_on_selector(".driver-popover-title", "el => el.innerText.trim()") if tour_shown else None
            skip_present = page.locator(".bk-tour-skip").count() > 0
            close_present = page.locator(".driver-popover-close-btn").count() > 0
            shot = OUT / f"tour-{label}.png"
            if tour_shown:
                page.screenshot(path=str(shot))
                notes["shots"].append(str(shot))
            steps_seen = []
            if tour_shown:
                for i in range(3):
                    page.wait_for_timeout(1400)  # 부드러운 스크롤이 끝난 뒤에 찍는다
                    steps_seen.append(page.eval_on_selector(".driver-popover-title", "el => el.innerText.trim()"))
                    notes.setdefault("tour_scroll", {})[f"{label}-step{i + 1}"] = page.evaluate("() => Math.round(window.scrollY)")
                    page.screenshot(path=str(OUT / f"tour-step{i + 1}-{label}.png"))
                    if i < 2:
                        page.click(".driver-popover-next-btn")
                        page.wait_for_timeout(900)
                page.click(".bk-tour-skip")
                page.wait_for_timeout(500)
                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(200)
            shown_after_skip = page.locator(".driver-popover").count() > 0
            stored = page.evaluate("() => localStorage.getItem('bk_tour_done_v1')")
            page.goto(f"{BASE}/", wait_until="load")
            page.wait_for_timeout(13600)
            again = page.locator(".driver-popover").count() > 0
            page.click("[data-guide-open]")
            page.wait_for_timeout(600)
            reopened = page.locator(".driver-popover").count() > 0
            reopened_title = (
                page.eval_on_selector(".driver-popover-title", "el => el.innerText.trim()") if reopened else None
            )
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            overflow = page.evaluate(OVERFLOW_JS)
            js_errors = [e for e in errors if e["type"] == "pageerror"]
            notes["checks"][key] = {
                "tour_shown": tour_shown,
                "progress": progress,
                "title": title,
                "skip_button": skip_present,
                "close_button": close_present,
                "step_titles": steps_seen,
                "popover_after_skip": shown_after_skip,
                "storage": stored,
                "popover_on_revisit": again,
                "reopened_by_guide_button": reopened,
                "reopened_title": reopened_title,
                "overflow": overflow,
                "console_errors": errors,
                "js_errors": js_errors,
            }
            for cond, name in [
                (tour_shown, "tour 자동 시작"),
                (progress == "1 / 3", "진행 표기 1 / 3"),
                (skip_present, "건너뛰기 버튼"),
                (close_present, "닫기 × 버튼"),
                (not shown_after_skip, "건너뛰기 후 즉시 닫힘"),
                (stored == "done", "localStorage bk_tour_done_v1"),
                (not again, "재방문 시 자동으로 뜨지 않음"),
                (reopened, "? 가이드로 다시 켜기"),
                (overflow["overflow"] == 0, "가로 넘침 0"),
                (len(js_errors) == 0, "JS 오류 0"),
            ]:
                if not cond:
                    ok = False
                    notes["checks"][key].setdefault("failed", []).append(name)
            ctx.close()

        # ---------- ② 글 읽기 여정 바 ----------
        post_routes = {
            "pension-tax-order": "/posts/pension-tax-order/",
            "retire-fixed-cost": "/posts/retire-fixed-cost/",
            "philosophy-numbers-are-questions": "/posts/philosophy-numbers-are-questions/",
        }
        for label, vp in VIEWPORTS.items():
            for slug, route in post_routes.items():
                if label == "1280" and slug != "pension-tax-order":
                    continue
                key = f"post-{slug}-{label}"
                ctx, page, errors = new_page(browser, vp)
                page.goto(f"{BASE}{route}", wait_until="load")
                settle(page)
                before = page.evaluate(BAR_JS)
                shot = OUT / f"post-guide-{label}-{slug}.png"
                page.screenshot(path=str(shot))
                notes["shots"].append(str(shot))
                page.click("[data-journey-skip]")
                page.wait_for_timeout(300)
                after_skip = page.evaluate(BAR_JS)
                stored = page.evaluate("() => localStorage.getItem('bk_read_guide_v1')")
                page.reload(wait_until="load")
                settle(page, 400)
                after_reload = page.evaluate(BAR_JS)
                page.click("[data-guide-open]")
                page.wait_for_timeout(600)
                reopened_popover = page.locator(".driver-popover").count() > 0
                after_reopen = page.evaluate(BAR_JS)
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
                overflow = page.evaluate(OVERFLOW_JS)
                js_errors = [e for e in errors if e["type"] == "pageerror"]
                notes["checks"][key] = {
                    "before": before,
                    "after_skip": after_skip,
                    "storage": stored,
                    "after_reload": after_reload,
                    "guide_popover": reopened_popover,
                    "after_reopen": after_reopen,
                    "overflow": overflow,
                    "console_errors": errors,
                    "js_errors": js_errors,
                }
                for cond, name in [
                    (before["barVisible"], "여정 바 노출"),
                    ("다음 추천" in (before["barText"] or ""), "다음 추천 문구"),
                    (before["skipLabel"] == "필요 없어요", "필요 없어요 버튼"),
                    (after_skip["barVisible"] is False, "접기 동작"),
                    (stored == "off", "localStorage 기억"),
                    (after_reload["barVisible"] is False, "재방문 시 접힌 상태"),
                    (reopened_popover, "? 가이드 한 단계 안내"),
                    (after_reopen["barVisible"], "? 가이드로 바 다시 켜기"),
                    (overflow["overflow"] == 0, "가로 넘침 0"),
                    (len(js_errors) == 0, "JS 오류 0"),
                ]:
                    if not cond:
                        ok = False
                        notes["checks"][key].setdefault("failed", []).append(name)
                if slug == "retire-fixed-cost" and not (before["barText"] or "").find("시뮬레이터") >= 0:
                    ok = False
                    notes["checks"][key].setdefault("failed", []).append("트랙 끝 → 실전 도구")
                ctx.close()

        # ---------- ③ 도구 여정 바 ----------
        for label, vp in VIEWPORTS.items():
            for slug in ["pension-tax", "silson-compare"]:
                if label == "1280" and slug != "pension-tax":
                    continue
                key = f"tool-{slug}-{label}"
                ctx, page, errors = new_page(browser, vp)
                page.goto(f"{BASE}/apps/{slug}/", wait_until="load")
                settle(page)
                before = page.evaluate(BAR_JS)
                shot = OUT / f"tool-guide-{label}-{slug}.png"
                page.screenshot(path=str(shot))
                notes["shots"].append(str(shot))
                page.click("[data-journey-skip]")
                page.wait_for_timeout(300)
                after_skip = page.evaluate(BAR_JS)
                stored = page.evaluate("() => localStorage.getItem('bk_tool_guide_v1')")
                page.reload(wait_until="load")
                settle(page, 400)
                after_reload = page.evaluate(BAR_JS)
                page.click("[data-guide-open]")
                page.wait_for_timeout(600)
                reopened_popover = page.locator(".driver-popover").count() > 0
                after_reopen = page.evaluate(BAR_JS)
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
                overflow = page.evaluate(OVERFLOW_JS)
                js_errors = [e for e in errors if e["type"] == "pageerror"]
                notes["checks"][key] = {
                    "before": before,
                    "after_skip": after_skip,
                    "storage": stored,
                    "after_reload": after_reload,
                    "guide_popover": reopened_popover,
                    "after_reopen": after_reopen,
                    "overflow": overflow,
                    "console_errors": errors,
                    "js_errors": js_errors,
                }
                failed = []
                for cond, name in [
                    (before["barVisible"], "도구 여정 바 노출"),
                    ("이 다음으로 많이 쓰는 도구" in (before["barText"] or ""), "다음 도구 문구"),
                    (before["skipLabel"] == "건너뛰기", "건너뛰기 버튼"),
                    (after_skip["barVisible"] is False, "접기 동작"),
                    (stored == "off", "localStorage 기억"),
                    (after_reload["barVisible"] is False, "재방문 시 접힌 상태"),
                    (reopened_popover, "? 가이드 한 단계 안내"),
                    (after_reopen["barVisible"], "? 가이드로 바 다시 켜기"),
                    (overflow["overflow"] == 0, "가로 넘침 0"),
                    (len(js_errors) == 0, "JS 오류 0"),
                    (not before["overlapSticky"], "sticky 결과 바와 겹치지 않음"),
                    (not before["overlapBtn"], "? 버튼과 sticky 결과 바 겹치지 않음"),
                    (before["btnInViewport"], "? 버튼 화면 안"),
                    ((before["btnH"] or 0) >= 44, "? 버튼 44px"),
                    ((before["skipH"] or 0) >= 44, "건너뛰기 44px"),
                ]:
                    if not cond:
                        ok = False
                        failed.append(name)
                if slug == "pension-tax" and "연금 인출" not in (before["barText"] or ""):
                    ok = False
                    failed.append("세액공제 → 연금 인출 연결")
                if failed:
                    notes["checks"][key]["failed"] = failed
                ctx.close()

        # ---------- ④ 연금 인출 도구 — v6.0.0 사용성 3건 ----------
        for label, vp in VIEWPORTS.items():
            key = f"pension-ux-{label}"
            ctx, page, errors = new_page(browser, vp)
            page.goto(f"{BASE}/apps/pension-draw/run/", wait_until="load")
            settle(page)
            ux = page.evaluate(
                """() => {
                  const d = document.querySelector('[data-pdraw-balance]');
                  const chip = document.querySelector('[data-pdraw-basis]');
                  const guide = document.querySelector('[data-pdraw-guide]');
                  const visible = (el) => !!el && (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : el.getBoundingClientRect().height > 0);
                  const ranges = [...document.querySelectorAll('[data-pdraw] input[type=range]')];
                  return {
                    details: !!d,
                    open: d ? d.open : null,
                    summary: d ? d.querySelector('summary').innerText.replace(/\\s+/g, ' ').trim() : null,
                    chip: chip ? chip.innerText.trim() : null,
                    guide: guide ? guide.innerText.trim() : null,
                    visibleRanges: ranges.filter(visible).length,
                    totalRanges: ranges.length,
                  };
                }"""
            )
            # 슬라이더를 한 칸 올리면 '내 조건 기준'
            page.locator("[data-pdraw] input[type=range]").first.focus()
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(400)
            chip_after = page.eval_on_selector("[data-pdraw-basis]", "el => el.innerText.trim()")
            page.screenshot(path=str(OUT / f"pension-ux-{label}.png"))
            page.click("[data-pdraw-balance] summary")
            page.wait_for_timeout(400)
            opened = page.evaluate(
                """() => {
                  const d = document.querySelector('[data-pdraw-balance]');
                  const visible = (el) => !!el && (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : el.getBoundingClientRect().height > 0);
                  const ranges = [...document.querySelectorAll('[data-pdraw] input[type=range]')];
                  return { open: d.open, visibleRanges: ranges.filter(visible).length };
                }"""
            )
            # 재방문 — 예시 값으로 되돌아가고 칩은 '예시 값 기준'
            page.reload(wait_until="load")
            settle(page, 400)
            chip_reload = page.eval_on_selector("[data-pdraw-basis]", "el => el.innerText.trim()")
            overflow = page.evaluate(OVERFLOW_JS)
            js_errors = [e for e in errors if e["type"] == "pageerror"]
            notes["checks"][key] = {
                **ux,
                "chip_after_input": chip_after,
                "opened": opened,
                "chip_after_reload": chip_reload,
                "overflow": overflow,
                "console_errors": errors,
                "js_errors": js_errors,
            }
            failed = []
            for cond, name in [
                (ux["details"], "연금 잔액 <details> 카드"),
                (ux["open"] is False, "첫 화면엔 접혀 있음"),
                ((ux["summary"] or "").startswith("더 정확히 보기 — 연금 잔액 넣기"), "접힘 카드 문구"),
                (ux["visibleRanges"] == 3, "첫 화면 입력 3슬라이더(잔액 제외)"),
                (ux["chip"] == "예시 값 기준", "초기 칩 예시 값 기준"),
                (chip_after == "내 조건 기준", "값 수정 후 내 조건 기준"),
                (opened["open"] is True and opened["visibleRanges"] == 4, "펼치면 잔액 입력"),
                (chip_reload == "예시 값 기준", "새로고침 시 예시 복귀"),
                (
                    ux["guide"]
                    == "기본 예시 값입니다. 내 값으로 바꿔 보세요 — 움직이는 즉시 계산됩니다(저장 안 됨).",
                    "입력 안내 문구",
                ),
                (overflow["overflow"] == 0, "가로 넘침 0"),
                (len(js_errors) == 0, "JS 오류 0"),
            ]:
                if not cond:
                    ok = False
                    failed.append(name)
            if failed:
                notes["checks"][key]["failed"] = failed
            ctx.close()

        browser.close()

    httpd.shutdown()
    notes["ok"] = ok
    (OUT / "capture-notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")

    failed = {k: v.get("failed") for k, v in notes["checks"].items() if v.get("failed")}
    print(json.dumps({"ok": ok, "failed": failed, "shots": notes["shots"]}, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
