#!/usr/bin/env python3
"""세대별 실손 계산기 — 화면 검사·캡처 (2026-11-26)

  python3 scripts/capture_silson_20261126.py local   # dist를 로컬 서버로 띄워 검사
  python3 scripts/capture_silson_20261126.py live    # 배포 뒤 실제 주소로 검사

하는 일
  · 320·390·1280 폭에서 가로 넘침 0, 콘솔 오류 0 확인
  · 입력을 바꿔 결과가 따라 바뀌는지(4세대 → 5세대) 확인
  · A4 요약 인쇄 창의 내용 확인 + 인쇄 미리보기 캡처
  · 요약 카드 PNG 내려받기 확인
  · 캡처는 reports/buffetkimz-web/v292-silson/ 에 남긴다
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
OUT = ROOT / "reports" / "buffetkimz-web" / "v292-silson"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
PORT = 8791
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

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )
        for width, height in ((320, 900), (390, 900), (1280, 1000)):
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                locale="ko-KR",
                accept_downloads=True,
            )
            page = ctx.new_page()
            errs: list[str] = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.goto(f"{base}/apps/silson-compare/run/", wait_until="networkidle")
            page.wait_for_timeout(1200)
            overflow = page.evaluate(
                "() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })"
            )
            if overflow["sw"] > overflow["cw"] + 1:
                failures.append(f"{width}px 가로 넘침 {overflow}")
            body = page.inner_text("body")
            for label in ("세대별 실손 계산기", "내 실손 세대", "왜 이 금액인가", "A4 요약 인쇄"):
                if label not in body:
                    failures.append(f"{width}px '{label}' 없음")
            facts[f"{width}_overflow"] = overflow

            if width == 390:
                # 기본 계산(4세대, 통원, 종합병원) — 예상 보험금이 화면에 있는지
                card = page.locator("[data-runner]").inner_text()
                facts["primary_payout_text"] = [ln for ln in card.splitlines() if "예상 보험금" in ln][:2]
                if "360,000원" not in card:
                    failures.append("기본 예시의 4세대 보험금 360,000원이 화면에 없음")
                # 5세대로 바꾸면 보험금이 줄어든다
                page.get_by_role("button", name="5세대", exact=True).first.click()
                page.wait_for_timeout(500)
                card5 = page.locator("[data-runner]").inner_text()
                if "250,000원" not in card5:
                    failures.append("5세대 전환 뒤 250,000원이 없음")
                if "도수·체외충격파·증식 (보장 제외)" not in card5:
                    failures.append("5세대 보장 제외 항목이 표시되지 않음")
                page.screenshot(path=str(OUT / f"silson-local-{width}.png"), full_page=True)

                # A4 인쇄 창 — 새 창 내용 확인
                with page.expect_popup(timeout=15000) as pop_info:
                    page.get_by_role("button", name="A4 요약 인쇄").click()
                pop = pop_info.value
                pop.wait_for_load_state("domcontentloaded")
                pop.set_viewport_size({"width": 900, "height": 1200})
                pop.wait_for_timeout(600)
                sheet = pop.inner_text("body")
                for label in ("세대별 실손 계산 요약", "세대별 비교", "기준일"):
                    if label not in sheet:
                        failures.append(f"A4 요약에 '{label}' 없음")
                facts["sheet_chars"] = len(sheet)
                pop.screenshot(path=str(OUT / "silson-a4-sheet.png"), full_page=True)
                pop.close()

                # 요약 카드 PNG
                with page.expect_download(timeout=20000) as dl:
                    page.get_by_role("button", name="요약 카드 저장(PNG)").click()
                png = pathlib.Path(dl.value.path())
                facts["card_png_bytes"] = png.stat().st_size
                if png.stat().st_size < 20000:
                    failures.append(f"카드 PNG가 너무 작음 {png.stat().st_size}B")
                (OUT / "silson-card-390.png").write_bytes(png.read_bytes())

            page.screenshot(path=str(OUT / f"silson-{MODE}-{width}.png"), full_page=True)
            mine = [e for e in errs if "favicon" not in e]
            if mine:
                failures.append(f"{width}px 콘솔 오류 {mine[:3]}")
            ctx.close()
        browser.close()
finally:
    if httpd:
        httpd.shutdown()

facts["mode"] = MODE
facts["failures"] = failures
(OUT / f"check-{MODE}.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(facts, ensure_ascii=False, indent=2))
print("FAIL" if failures else "PASS")
sys.exit(1 if failures else 0)
