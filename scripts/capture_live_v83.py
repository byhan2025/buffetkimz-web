#!/usr/bin/env python3
"""v8.3.0 라이브 실측 — 금융생활학교 STEP 3·가계 2강·자료앨범 (캐시 우회 ?v=830).

  A. 여섯 주소 × 1280/390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 허브 — 52칸·7트랙 탭 · 지금 열린 12강 · 열린 10주
  C. STEP 3 두 강 — 카드 6장 로드 · 운영표(투자정책서) 채움 · 저장 0건 · 5분 읽기 1,200~1,500자
  D. 가계 두 강 — 한 화면 한 질문 · 카드 6장 · 운영표 채움 · 저장 0건
  E. 자료앨범 — 21세트 111장 · 새 6장 로드
  F. 캡처 — 1280·390 첫 화면 + 전체

사용:
  python3 scripts/capture_live_v83.py --live
결과: /workspace/reports/buffetkimz-web/v83-live/
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import sys

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v83-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
LOCAL = "--local" in sys.argv  # 배포 전 dist로 같은 검사를 먼저 돌려 본다
BASE = "http://127.0.0.1:8183" if LOCAL else LIVE
SUFFIX = "?v=830"

if LOCAL:
    import http.server
    import socketserver
    import threading

    class _Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(APP / "dist"), **kw)

        def translate_path(self, path):
            q = path.split("?", 1)[0].split("#", 1)[0]
            if q == "/buffetkimz-web":
                q = "/"
            elif q.startswith("/buffetkimz-web/"):
                q = q[len("/buffetkimz-web") :]
            return super().translate_path(q)

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(("127.0.0.1", 8183), _Handler)
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()

PAGES = [
    ("hub", "/academy/"),
    ("step31", "/academy/step3-drawdown-recovery/"),
    ("step32", "/academy/step3-etf-six-numbers/"),
    ("household1", "/academy/school-household-cashflow/"),
    ("household2", "/academy/school-household-coverage/"),
    ("gallery", "/gallery/"),
]
SCHOOL = {"household1", "household2"}
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

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

    # ---------------------------------------------------------------- A
    bad, console_errors, overflow = [], [], []
    for width in ("1280", "390"):
        for name, path in PAGES:
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
    check("A1 라이브 6주소 × 1280/390 HTTP 200 (?v=830)", not bad, ", ".join(bad))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # ---------------------------------------------------------------- B 허브
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/academy/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(500)
    hub = pg.evaluate(
        """() => {
          const weeks = [...document.querySelectorAll('[data-week]')];
          const tabs = [...document.querySelectorAll('[data-track-tab]')];
          tabs.find(t => t.dataset.trackTab === 'teen')?.click();
          const vis = [...document.querySelectorAll('[data-week]')].filter(w => w.offsetParent !== null).length;
          tabs.find(t => t.dataset.trackTab === 'household')?.click();
          const visHome = [...document.querySelectorAll('[data-week]')].filter(w => w.offsetParent !== null).length;
          const note = document.querySelector('[data-track-note]')?.textContent.trim() ?? '';
          tabs.find(t => t.dataset.trackTab === 'all')?.click();
          return { name: document.querySelector('h1')?.textContent.trim(),
                   weeks: weeks.length, blocks: document.querySelectorAll('[data-track-block]').length,
                   tabs: tabs.length, open: document.querySelectorAll('.school-week-open').length,
                   vis, visHome, note, lessons: document.querySelectorAll('.academy-lesson').length,
                   tracks: document.querySelectorAll('#tracks ul > li').length,
                   step3: [...document.querySelectorAll('.academy-step')].map(s => s.querySelector('.academy-status')?.textContent.trim()) };
        }"""
    )
    check(
        "B1 허브 = 금융생활학교 · 52칸·7트랙·12강·열린 10주 · 트랙 카드 5 · STEP 3 '공개 2강'",
        hub["name"] == "버핏킴즈 금융생활학교"
        and hub["weeks"] == 52
        and hub["blocks"] == 7
        and hub["tabs"] == 8
        and hub["open"] == 10
        and hub["lessons"] == 12
        and hub["tracks"] == 5
        and hub["vis"] == 8
        and hub["visHome"] == 8
        and hub["step3"][2] == "공개 2강"
        and "가계" in hub["note"],
        str(hub),
    )
    ctx.close()

    # ---------------------------------------------------------------- C·D 강의
    for name, path in PAGES[1:5]:
        ctx, pg, errors = page_at("1280")
        pg.goto(BASE + path + SUFFIX, wait_until="networkidle")
        pg.wait_for_timeout(700)
        info = pg.evaluate(
            """() => {
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
              return { cards: big, total: imgs.length, quiz: items.length,
                       quizVisible: items.filter(i => !i.hidden).length,
                       filled: !!document.querySelector('[data-sheet-filled]:not([hidden])'),
                       variant: sheet?.dataset.variant,
                       stored: Object.keys(localStorage).length,
                       text: document.body.innerText };
            }"""
        )
        m = re.search(r"([\d,]{3,5})자 \(공백 제외\)", info["text"])
        chars = int(m.group(1).replace(",", "")) if m else -1
        if name in SCHOOL:
            check(
                f"{name} — 카드 6장 로드(1080px) · 한 화면 한 질문 · 운영표({info['variant']}) · 저장 0건 · {chars}자",
                info["cards"] >= 6
                and info["quiz"] == 3
                and info["quizVisible"] == 1
                and info["filled"]
                and info["stored"] == 0
                and 1200 <= chars <= 1500
                and not errors,
                f"cards {info['cards']}/{info['total']} · quiz {info['quiz']}/{info['quizVisible']} · {chars}자 · {errors[:1]}",
            )
        else:
            check(
                f"{name} — 카드 6장 로드(1080px) · 운영표({info['variant']}) 채움 · 저장 0건 · {chars}자",
                info["cards"] >= 6
                and info["filled"]
                and info["stored"] == 0
                and 1200 <= chars <= 1500
                and not errors,
                f"cards {info['cards']}/{info['total']} · {chars}자 · {errors[:1]}",
            )
        pg.screenshot(path=str(OUT / f"{name}-sheet-1280.png"))
        ctx.close()

    # ---------------------------------------------------------------- E 자료앨범
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/gallery/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(1200)
    gal = pg.evaluate(
        """() => {
          const status = document.querySelector('[data-gallery-status]')?.textContent.trim() ?? '';
          const cards = [...document.querySelectorAll('.gallery-card')];
          const imgs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
          return { sets: cards.length, status,
                   newImgs: imgs.filter(s => /3d-household-budget-/.test(s)).length };
        }"""
    )
    check(
        "E 자료앨범 — 21세트 111장 · 새 6장 로드",
        gal["sets"] == 21 and "21세트" in gal["status"] and "111장" in gal["status"] and gal["newImgs"] >= 6,
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
(OUT / "verify-live-v830.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / 'verify-live-v830.json'}")
sys.exit(0 if not failed else 1)
