#!/usr/bin/env python3
"""보장분석 요약기 — 총납입 추정 실시간 재계산 확인 (2026-11-27)

  python3 scripts/verify_bojang_paidtotal_20261127.py local   # dist를 로컬 서버로 띄워 확인
  python3 scripts/verify_bojang_paidtotal_20261127.py live    # 배포 뒤 실제 주소로 확인

확인하는 것 (브리프 §2)
  · 390×844 화면에서 첫 담보에 월 3,000원 · 20년납을 넣으면 행 문구가
    '총납입 추정 72만원'으로 바뀐다(예전에는 '보험료·납입기간을 넣으면…'으로 남았다)
  · ③ 요약 영역의 월 보험료 카드에도 총납입 추정 합계가 함께 보인다
  · 320·390·1280 폭에서 가로 넘침 0(요약 카드 sub가 한 줄 늘어난 뒤에도)
  · 콘솔 오류 0
캡처: reports/buffetkimz-web/bojang-paidtotal-20261127/
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys
import threading

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP.parent.parent
OUT = ROOT / "reports" / "buffetkimz-web" / "bojang-paidtotal-20261127"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
PORT = 8794
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def log_message(self, *a):
        pass


def start_local():
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

base = f"http://127.0.0.1:{PORT}" if MODE == "local" else LIVE
httpd = start_local() if MODE == "local" else None
failures: list[str] = []
facts: dict[str, object] = {}
ROW1 = 'input[aria-label="담보 1 이름"]'

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )

        # ── 가로 넘침 — 폭 3종(요약 카드 sub가 길어져도 깨지지 않는지) ──
        for width, height in ((320, 900), (1280, 1000)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
            page = ctx.new_page()
            page.goto(f"{base}/apps/bojang-summary/run/", wait_until="networkidle")
            page.wait_for_timeout(900)
            ov = page.evaluate(
                "() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })"
            )
            facts[f"{width}_overflow"] = ov
            if ov["sw"] > ov["cw"] + 1:
                failures.append(f"{width}px 가로 넘침 {ov}")
            ctx.close()

        # ── 본 검사 — 390×844 ──
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", device_scale_factor=2)
        page = ctx.new_page()
        errs: list[str] = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(f"{base}/apps/bojang-summary/run/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        ov = page.evaluate(
            "() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })"
        )
        facts["390_overflow"] = ov
        if ov["sw"] > ov["cw"] + 1:
            failures.append(f"390px 가로 넘침 {ov}")

        body0 = page.inner_text("body")
        if "담보 11건" not in body0:
            failures.append("예시 자료(담보 11건)가 첫 화면에 없음")
        if "보험료·납입기간을 넣으면 총납입을 추정합니다" not in body0:
            failures.append("입력 전 안내 문구가 없음(검사 전제 확인)")

        row = page.locator(ROW1).locator("xpath=../..")
        prem = row.locator('input[placeholder="예: 3만원"]')
        pay = row.locator('input[placeholder="예: 20년납"]')

        # ① 월 보험료 3,000원
        prem.click()
        prem.fill("3,000")
        page.keyboard.press("Tab")
        page.wait_for_timeout(350)
        row1_after_premium = row.inner_text()
        facts["row_after_premium"] = row1_after_premium.replace("\n", " | ")[:220]
        if "총납입" in row1_after_premium and "72만원" in row1_after_premium:
            failures.append("보험료만 넣었는데 총납입이 계산됨(납입기간 없이 계산되면 안 됨)")

        # ② 납입기간 20년납 — 이 순간 총납입 72만원이 나와야 한다
        pay.click()
        pay.fill("20년납")
        page.keyboard.press("Tab")
        page.wait_for_timeout(450)
        row1 = row.inner_text()
        facts["row_after_payterm"] = row1.replace("\n", " | ")[:260]
        if "총납입 추정 72만원" not in row1:
            failures.append(f"행 문구에 '총납입 추정 72만원' 없음 → {facts['row_after_payterm']}")

        # ③ 요약 카드 — 월 보험료 카드 sub
        body1 = page.inner_text("body")
        cards = page.locator("div.rounded-xl.border.bg-white.p-4")
        prem_card = None
        for i in range(cards.count()):
            t = cards.nth(i).inner_text()
            if t.startswith("월 보험료"):
                prem_card = cards.nth(i)
                facts["premium_card"] = t.replace("\n", " | ")
                break
        if prem_card is None:
            failures.append("③ 요약의 '월 보험료' 카드를 찾지 못함")
        elif "총납입 추정 72만원" not in facts.get("premium_card", ""):
            failures.append(f"월 보험료 카드에 총납입 추정 없음 → {facts.get('premium_card')}")

        # 값 검산 — 행 11건 중 총납입이 잡힌 것은 1건뿐이므로 합계도 72만원
        if "총납입 추정 720,000" in body1 or "총납입 추정 7,200,000" in body1:
            failures.append("총납입 합계 표기가 만원 단위가 아님")

        ov = page.evaluate(
            "() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })"
        )
        facts["390_overflow_after"] = ov
        if ov["sw"] > ov["cw"] + 1:
            failures.append(f"입력 뒤 390px 가로 넘침 {ov}")

        # 캡처 — 전체 1장(브리프 지정) + 행·카드 확대
        row.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        row.screenshot(path=str(OUT / f"bojang-paidtotal-{MODE}-row-390.png"))
        if prem_card is not None:
            prem_card.scroll_into_view_if_needed()
            page.wait_for_timeout(250)
            prem_card.screenshot(path=str(OUT / f"bojang-paidtotal-{MODE}-card-390.png"))
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / f"bojang-paidtotal-{MODE}-390.png"), full_page=True)
        # 화면(뷰포트 390×844) 그대로 1장 — 브리프의 390×844 조건
        row.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / f"bojang-paidtotal-{MODE}-390x844.png"))

        mine = [e for e in errs if "favicon" not in e]
        facts["console_errors"] = mine[:5]
        if mine:
            failures.append(f"콘솔 오류 {mine[:3]}")
        ctx.close()
        browser.close()
finally:
    if httpd:
        httpd.shutdown()

facts["mode"] = MODE
facts["url"] = f"{base}/apps/bojang-summary/run/"
facts["failures"] = failures
(OUT / f"check-{MODE}.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(facts, ensure_ascii=False, indent=2))
print("FAIL" if failures else "PASS")
sys.exit(1 if failures else 0)
