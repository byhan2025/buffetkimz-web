#!/usr/bin/env python3
"""보장분석 요약기 — 화면 검사·캡처 (2026-11-27)

  python3 scripts/capture_bojang_20261127.py local   # dist를 로컬 서버로 띄워 검사
  python3 scripts/capture_bojang_20261127.py live    # 배포 뒤 실제 주소로 검사

하는 일
  · 320·390·1280 폭에서 가로 넘침 0, 콘솔 오류 0 확인
  · 예시 자료를 넣어 담보 표·그룹 요약·확인할 점이 나오는지
  · 제안 자료를 넣어 기존·제안 비교(보험료 증감)가 나오는지
  · A4 인쇄 창 내용 확인 + PNG 카드 내려받기 확인
  · 캡처는 reports/buffetkimz-web/v293-bojang/ 에 남긴다
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
OUT = ROOT / "reports" / "buffetkimz-web" / "v293-bojang"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
PORT = 8793
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
BAD_WORDS = ("실시간", "속보", "긴급", "무조건")

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )
        for width, height in ((320, 900), (390, 900), (1280, 1000)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR", accept_downloads=True)
            page = ctx.new_page()
            errs: list[str] = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.goto(f"{base}/apps/bojang-summary/run/", wait_until="networkidle")
            page.wait_for_timeout(1200)
            overflow = page.evaluate("() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })")
            if overflow["sw"] > overflow["cw"] + 1:
                failures.append(f"{width}px 가로 넘침 {overflow}")
            facts[f"{width}_overflow"] = overflow
            body = page.inner_text("body")
            for label in ("보장분석 요약기", "담보 정리하기"):
                if label not in body:
                    failures.append(f"{width}px '{label}' 없음")
            for w in BAD_WORDS:
                if w in body:
                    failures.append(f"{width}px 금지어 '{w}' 발견")

            if width == 390:
                page.get_by_role("button", name="예시 넣기").click()
                page.wait_for_timeout(900)
                runner = page.locator("[data-runner]").inner_text()
                for label in ("담보 11건", "49,100원", "4세대", "그룹별 현황", "확인할 점", "담보 추가"):
                    if label not in runner:
                        failures.append(f"예시 정리 뒤 '{label}' 없음")
                if "2,500만" not in runner:
                    failures.append("암 진단비 합계 2,500만이 없음")
                facts["before_rows"] = 11
                page.screenshot(path=str(OUT / f"bojang-{MODE}-390-before.png"), full_page=True)

                # 제안 자료 → 비교
                page.get_by_role("button", name="제안(설계)").click()
                page.wait_for_timeout(400)
                page.get_by_role("button", name="예시 넣기").click()
                page.wait_for_timeout(900)
                runner = page.locator("[data-runner]").inner_text()
                for label in ("기존 · 제안 비교", "+42,700원", "변호사선임비용"):
                    if label not in runner:
                        failures.append(f"비교에서 '{label}' 없음")
                facts["premium_delta"] = "42,700"

                # 인쇄 창
                with page.expect_popup(timeout=20000) as pop_info:
                    page.get_by_role("button", name="A4 요약 인쇄 · PDF").click()
                pop = pop_info.value
                pop.wait_for_load_state("domcontentloaded")
                pop.set_viewport_size({"width": 900, "height": 1200})
                pop.wait_for_timeout(700)
                sheet = pop.inner_text("body")
                for label in ("보장 정리 요약", "보장 그룹 요약", "기존 · 제안 비교", "담보 상세", "확인할 점"):
                    if label not in sheet:
                        failures.append(f"A4 요약에 '{label}' 없음")
                facts["sheet_chars"] = len(sheet)
                pop.screenshot(path=str(OUT / "bojang-a4-sheet.png"), full_page=True)
                pop.close()

                # 카드 PNG
                with page.expect_download(timeout=20000) as dl:
                    page.get_by_role("button", name="요약 카드 PNG").click()
                png = pathlib.Path(dl.value.path())
                facts["card_png_bytes"] = png.stat().st_size
                if png.stat().st_size < 20000:
                    failures.append(f"카드 PNG가 너무 작음 {png.stat().st_size}B")
                (OUT / "bojang-card-390.png").write_bytes(png.read_bytes())

                # 요약 문구 복사(클립보드 권한이 없으면 건너뜀)
                try:
                    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
                    page.get_by_role("button", name="요약 문구 복사").click()
                    page.wait_for_timeout(500)
                    clip = page.evaluate("() => navigator.clipboard.readText()")
                    facts["msg_chars"] = len(clip)
                    if "보장 정리 요약" not in clip:
                        failures.append("복사한 문구에 제목이 없음")
                except Exception as exc:  # noqa: BLE001
                    facts["copy_skipped"] = str(exc)[:120]

                page.screenshot(path=str(OUT / f"bojang-{MODE}-390.png"), full_page=True)

            page.screenshot(path=str(OUT / f"bojang-{MODE}-{width}.png"), full_page=True)
            mine = [e for e in errs if "favicon" not in e]
            if mine:
                failures.append(f"{width}px 콘솔 오류 {mine[:3]}")
            ctx.close()

        # 소개 페이지도 한 번
        ctx = browser.new_context(viewport={"width": 390, "height": 900}, locale="ko-KR")
        page = ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.goto(f"{base}/apps/bojang-summary/", wait_until="networkidle")
        page.wait_for_timeout(800)
        body = page.inner_text("body")
        if "보장분석 요약기" not in body:
            failures.append("소개 페이지 제목 없음")
        page.screenshot(path=str(OUT / f"bojang-{MODE}-intro-390.png"), full_page=True)
        if [e for e in errs if "favicon" not in e]:
            failures.append(f"소개 페이지 콘솔 오류 {errs[:2]}")
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
