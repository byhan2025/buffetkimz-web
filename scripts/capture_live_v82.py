#!/usr/bin/env python3
"""v8.2.0 라이브 실측 — 금융생활학교 허브·학교 3강·자료앨범 (캐시 우회 ?v=820).

  A. 다섯 주소 × 1280/390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 허브 — 52칸·7트랙 탭(청소년 8주) · 지금 열린 8강 · 열린 7주
  C. 학교 3강 — 카드 6장 로드(1080px) · 한 화면 한 질문 · 16px/44px · 저장 0건
  D. 자료앨범 — 20세트 105장 · 새 3세트 18장 로드
  E. 캡처 — 1280·390 첫 화면 + 전체

사용:
  python3 scripts/capture_live_v82.py --live
결과: /workspace/reports/buffetkimz-web/v82-live/
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v82-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE
SUFFIX = "?v=820"

PAGES = [
    ("hub", "/academy/", "버핏킴즈 금융생활학교"),
    ("elementary", "/academy/school-elementary-allowance/", "세 칸으로 나누면"),
    ("teen", "/academy/school-teen-payments/", "1년이면"),
    ("firstpay", "/academy/school-firstpay-stub/", "명세서"),
    ("gallery", "/gallery/", "자료앨범"),
]
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}
NEW_PREFIXES = ("3d-allowance", "3d-teen-pay", "3d-firstpay")

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page_at(width: str):
        ctx = browser.new_context(viewport=VIEWPORTS[width], locale="ko-KR", device_scale_factor=1)
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    # A
    bad, console_errors, overflow = [], [], []
    for width in ("1280", "390"):
        for name, path, _ in PAGES:
            ctx, pg, errors = page_at(width)
            resp = pg.goto(BASE + path + SUFFIX, wait_until="networkidle")
            pg.wait_for_timeout(600)
            if resp is None or resp.status >= 400:
                bad.append(f"{width} {path} {getattr(resp, 'status', 'none')}")
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:120]}")
                errors.clear()
            size = pg.evaluate(
                "() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
            )
            if size["sw"] > size["cw"] + 1:
                overflow.append(f"{width} {path} {size['sw']}>{size['cw']}")
            pg.evaluate("window.scrollTo(0,0)")
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(OUT / f"{name}-{width}-fold.png"))
            pg.screenshot(path=str(OUT / f"{name}-{width}-full.png"), full_page=True)
            ctx.close()
    check("A1 라이브 5주소 × 1280/390 HTTP 200 (?v=820)", not bad, ", ".join(bad))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # B 허브
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/academy/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(500)
    hub = pg.evaluate(
        """() => {
          const weeks = [...document.querySelectorAll('[data-week]')];
          const tabs = [...document.querySelectorAll('[data-track-tab]')];
          tabs.find(t => t.dataset.trackTab === 'teen')?.click();
          const vis = [...document.querySelectorAll('[data-week]')].filter(w => w.offsetParent !== null).length;
          const note = document.querySelector('[data-track-note]')?.textContent.trim() ?? '';
          tabs.find(t => t.dataset.trackTab === 'all')?.click();
          return { name: document.querySelector('h1')?.textContent.trim(),
                   weeks: weeks.length, blocks: document.querySelectorAll('[data-track-block]').length,
                   tabs: tabs.length, open: document.querySelectorAll('.school-week-open').length,
                   vis, note, lessons: document.querySelectorAll('.academy-lesson').length };
        }"""
    )
    check(
        "B1 허브 = 금융생활학교 · 52칸·7트랙·8강·열린 7주 · 탭 필터",
        hub["name"] == "버핏킴즈 금융생활학교"
        and hub["weeks"] == 52
        and hub["blocks"] == 7
        and hub["tabs"] == 8
        and hub["open"] == 7
        and hub["lessons"] == 8
        and hub["vis"] == 8
        and "청소년" in hub["note"],
        str(hub),
    )
    ctx.close()

    # C 학교 3강
    for name, path, _ in PAGES[1:4]:
        ctx, pg, errors = page_at("1280")
        pg.goto(BASE + path + SUFFIX, wait_until="networkidle")
        pg.wait_for_timeout(700)
        info = pg.evaluate(
            """() => {
              const root = document.querySelector('[data-school-lesson]');
              const imgs = [...document.querySelectorAll('#cardnews img[data-cn-img], #cardnews .cn-thumb img')]
                .map(i => ({ w: i.naturalWidth, src: i.getAttribute('src') }));
              const big = imgs.filter(i => i.w >= 1000).length;
              const items = [...document.querySelectorAll('[data-quiz-item]')];
              const sheet = document.querySelector('[data-sheet]');
              [...(sheet?.querySelectorAll('fieldset') ?? [])].forEach(fs => {
                const ins = [...fs.querySelectorAll('input')];
                const last = ins[ins.length - 1];
                if (last) { last.checked = true; last.dispatchEvent(new Event('change', { bubbles: true })); }
              });
              sheet?.querySelector('[data-sheet-commit]')?.click();
              return { found: !!root, cards: big, total: imgs.length, quiz: items.length,
                       quizVisible: items.filter(i => !i.hidden).length,
                       filled: !!document.querySelector('[data-sheet-filled]:not([hidden])'),
                       stored: Object.keys(localStorage).length };
            }"""
        )
        check(
            f"C {name} — 카드 6장 로드(1080px) · 한 화면 한 질문 · 운영표 채움 · 저장 0건",
            info["found"] and info["cards"] >= 6 and info["quiz"] == 3 and info["quizVisible"] == 1
            and info["filled"] and info["stored"] == 0,
            str(info),
        )
        pg.screenshot(path=str(OUT / f"{name}-sheet-1280.png"))
        ctx.close()

    # D 자료앨범
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/gallery/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(1200)
    gal = pg.evaluate(
        """() => {
          const status = document.querySelector('[data-gallery-status]')?.textContent.trim() ?? '';
          const cards = [...document.querySelectorAll('.gallery-card')];
          const imgs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
          return { sets: cards.length, status,
                   newImgs: imgs.filter(s => /3d-(allowance|teen-pay|firstpay)-/.test(s)).length };
        }"""
    )
    check(
        "D 자료앨범 — 20세트 105장 · 새 3세트 18장",
        gal["sets"] == 20 and "20세트" in gal["status"] and "105장" in gal["status"] and gal["newImgs"] >= 18,
        str(gal),
    )
    pg.screenshot(path=str(OUT / "gallery-1280-fold.png"))
    ctx.close()

    browser.close()

failed = [c for c in CHECKS if not c["ok"]]
result = {
    "version": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"],
    "base": BASE,
    "total": len(CHECKS),
    "passed": len(CHECKS) - len(failed),
    "failed": len(failed),
    "checks": CHECKS,
}
(OUT / "verify-live-v820.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / 'verify-live-v820.json'}")
