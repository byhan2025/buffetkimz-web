#!/usr/bin/env python3
"""데일리 브리프 게시판(/board/) 실측 캡처·검증 (2026-11-24 신설, v9.2.0).

무엇을 재는가
  A. `/board/` 390 · 1280 캡처 2장 (전체 높이)
  B. 320 · 390 · 1280 가로 넘침 0px · 콘솔 오류 0
  C. 분류 필터 — 'AI·실무'를 누르면 그 분류 카드만 남고 날짜 묶음이 함께 접힌다,
     다시 '전체'를 누르면 원래 건수로 돌아온다 (버튼은 44px 이상)
  D. 홈(`/`)에 '데일리 브리프 게시판 보기' 진입 링크가 실제로 있다
  E. 카드마다 확인 날짜·회차·출처 링크가 붙어 있고, 금지어(실시간·속보·긴급)가 화면에 없다

사용: npm run build && python3 scripts/capture_board.py
결과: /workspace/reports/buffetkimz-web/board/ — 390·1280 png + check.json
"""
from __future__ import annotations

import http.server
import json
import mimetypes
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/board")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("BOARD_PORT", "8331"))
PREFIX = "/buffetkimz-web"
BANNED = ("실시간", "속보", "긴급")

mimetypes.add_type("image/webp", ".webp")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


class Server(socketserver.TCPServer):
    allow_reuse_address = True


threading.Thread(target=Server(("127.0.0.1", PORT), Handler).serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}{PREFIX}"

OVERFLOW_JS = """
() => ({overflow: document.documentElement.scrollWidth - window.innerWidth,
        docW: document.documentElement.scrollWidth, winW: window.innerWidth})
"""

report: dict = {"base": BASE, "checks": {}, "failures": []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    for width, height, tag in ((390, 844, "390"), (1280, 900, "1280")):
        ctx = browser.new_context(
            viewport={"width": width, "height": height}, locale="ko-KR", device_scale_factor=2
        )
        page = ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        resp = page.goto(f"{BASE}/board/", wait_until="load")
        page.wait_for_timeout(900)
        ov = page.evaluate(OVERFLOW_JS)
        metrics = page.evaluate(
            """() => {
              const cards = [...document.querySelectorAll('[data-board-entry]')];
              const tabs = [...document.querySelectorAll('[data-board-tab]')]
                .map(b => ({label: b.dataset.boardTab, h: +b.getBoundingClientRect().height.toFixed(1)}));
              const links = [...document.querySelectorAll('.br-link')].map(a => a.href);
              const slots = [...document.querySelectorAll('.br-slot')].map(s => s.innerText.trim());
              return {cards: cards.length, tabs, sourceLinks: links.length, slots,
                      cardText: cards.map(c => c.innerText).join(" / ")};
            }"""
        )
        shot = OUT / f"board-{tag}.png"
        page.screenshot(path=str(shot), full_page=True)
        ctx.close()

        report["checks"][tag] = {
            "status": getattr(resp, "status", None),
            "overflow": ov,
            "cards": metrics["cards"],
            "tabs": metrics["tabs"],
            "sourceLinks": metrics["sourceLinks"],
            "slots": metrics["slots"],
            "consoleErrors": errors,
            "shot": str(shot),
        }
        if ov["overflow"] > 0:
            report["failures"].append(f"{tag}: 가로 넘침 {ov['overflow']}px")
        if errors:
            report["failures"].append(f"{tag}: 콘솔 오류 {len(errors)}건 {errors[:2]}")
        if metrics["cards"] < 4:
            report["failures"].append(f"{tag}: 카드 {metrics['cards']}건 (시드 4건 미만)")
        if metrics["sourceLinks"] != metrics["cards"]:
            report["failures"].append(f"{tag}: 출처 링크 {metrics['sourceLinks']} ≠ 카드 {metrics['cards']}")
        small = [t for t in metrics["tabs"] if t["h"] < 44]
        if small:
            report["failures"].append(f"{tag}: 필터 버튼 44px 미만 {small}")
        hits = [w for w in BANNED if w in metrics["cardText"]]
        if hits:
            report["failures"].append(f"{tag}: 금지어 노출 {hits}")

    # 320 — 넘침만 (좁은 폰)
    ctx = browser.new_context(viewport={"width": 320, "height": 780}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/board/", wait_until="load")
    page.wait_for_timeout(600)
    ov320 = page.evaluate(OVERFLOW_JS)
    ctx.close()
    report["checks"]["320"] = {"overflow": ov320}
    if ov320["overflow"] > 0:
        report["failures"].append(f"320: 가로 넘침 {ov320['overflow']}px")

    # 필터 동작 — 390 화면에서 'AI·실무' → '전체'
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/board/", wait_until="load")
    page.wait_for_timeout(500)
    page.get_by_role("button", name="AI·실무").click()
    page.wait_for_timeout(250)
    visible_ai = page.evaluate(
        "() => [...document.querySelectorAll('[data-board-entry]')].filter(c => !c.hidden).length"
    )
    days_ai = page.evaluate("() => [...document.querySelectorAll('[data-board-day]')].filter(d => !d.hidden).length")
    page.screenshot(path=str(OUT / "board-390-filter-ai.png"), full_page=True)
    page.get_by_role("button", name="전체").click()
    page.wait_for_timeout(250)
    visible_all = page.evaluate(
        "() => [...document.querySelectorAll('[data-board-entry]')].filter(c => !c.hidden).length"
    )
    ctx.close()
    report["checks"]["filter"] = {"ai": visible_ai, "aiDays": days_ai, "all": visible_all}
    if visible_ai != 1 or visible_all != 4:
        report["failures"].append(f"필터 동작 이상: AI {visible_ai}건(기대 1) · 전체 {visible_all}건(기대 4)")

    # 홈 진입 링크
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="load")
    page.wait_for_timeout(1200)
    home = page.evaluate(
        """() => {
          const a = [...document.querySelectorAll('a')].find(a => a.textContent.includes('데일리 브리프 게시판 보기'));
          if (!a) return {found: false};
          const r = a.getBoundingClientRect();
          return {found: true, href: a.getAttribute('href'), h: +r.height.toFixed(1)};
        }"""
    )
    page.screenshot(path=str(OUT / "home-board-entry-390.png"), full_page=False)
    ctx.close()
    report["checks"]["home-link"] = home
    if not home.get("found"):
        report["failures"].append("홈: '데일리 브리프 게시판 보기' 링크 없음")
    elif home.get("h", 0) < 44:
        report["failures"].append(f"홈: 진입 링크 높이 {home.get('h')}px (44px 미만)")

    browser.close()

(OUT / "check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("■ /board/ 실측")
for tag in ("320", "390", "1280"):
    c = report["checks"].get(tag, {})
    ov = c.get("overflow", {})
    print(f"  {tag:>4}px 넘침 {ov.get('overflow')}px · 카드 {c.get('cards', '-')}건 · 출처 링크 {c.get('sourceLinks', '-')}")
print(f"  필터: AI {report['checks']['filter']['ai']}건 / 전체 {report['checks']['filter']['all']}건")
print(f"  홈 진입 링크: {report['checks']['home-link']}")
print()
if report["failures"]:
    print(f"✗ 실패 {len(report['failures'])}건")
    for f in report["failures"]:
        print("  -", f)
    sys.exit(1)
print("✓ 전부 통과 — reports/buffetkimz-web/board/")
