#!/usr/bin/env python3
"""심평원 고지 정리기 — 동작 점검·캡처 (2026-11-26)

  python3 scripts/capture_simpyeong.py local    # dist 로컬 서빙
  python3 scripts/capture_simpyeong.py live     # GitHub Pages 라이브

재는 것
  · 예시 데이터 → 요약 카드 11칸 · 고지 문항 5개 · 근거 줄이 실제로 그려지는가
  · 심사용 요약문 복사 · 레포트 HTML 내려받기(앵커 id 존재)
  · '이력 자가체크' 탭으로 오갔다 와도 화면이 살아 있는가
  · 390·1280 가로 넘침 0 · 콘솔 오류 0

남기는 것
  reports/buffetkimz-web/simpyeong-390.png · simpyeong-1280.png
  reports/buffetkimz-web/simpyeong-report.html (내려받은 레포트 사본)
  reports/buffetkimz-web/simpyeong-check.json
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys
import threading

_sys_path = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_sys_path))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8191
PREFIX = "/buffetkimz-web"
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(DIST), **k)

    def translate_path(self, p):
        p = p.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def start_local():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


base = f"http://127.0.0.1:{PORT}{PREFIX}" if MODE == "local" else LIVE
httpd = start_local() if MODE == "local" else None
failures: list[str] = []
facts: dict[str, object] = {"mode": MODE, "url": base + "/apps/simpyeong-disclosure/run/"}

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 1000},
        locale="ko-KR",
        permissions=["clipboard-read", "clipboard-write"],
        accept_downloads=True,
    )
    page = ctx.new_page()
    errs: list[str] = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))

    page.goto(base + "/apps/simpyeong-disclosure/run/", wait_until="domcontentloaded")
    page.wait_for_selector("[data-merged-tool='simpyeong-disclosure']", timeout=30000)
    page.wait_for_timeout(1500)

    # 0) 실제 엑셀·CSV 파일 경로 — 표 머리글을 찾아 읽는가
    xlsx = APP / "tmp" / "files" / "hira-sample.xlsx"
    if xlsx.exists():
        page.set_input_files("input[type=file]", str(xlsx))
        page.wait_for_timeout(5000)
        body = page.inner_text("body")
        facts["xlsx_upload"] = {
            "status": "표를 읽었습니다" in body,
            "admissions": "2건" in body,
            "surgery": "5건" in body,
            "summary_head": page.locator("textarea[aria-label='심사용 요약문']").input_value()[:60]
            if page.locator("textarea[aria-label='심사용 요약문']").count()
            else "",
            "summary": page.locator("textarea[aria-label='심사용 요약문']").input_value()
            if page.locator("textarea[aria-label='심사용 요약문']").count()
            else "",
        }
        if "표를 읽었습니다" not in body:
            failures.append("엑셀 파일을 읽지 못함")
        if "[수술]" not in (facts["xlsx_upload"]["summary"] or ""):
            failures.append("엑셀에서 수술 절이 만들어지지 않음")
        page.get_by_role("button", name="초기화").click()
        page.wait_for_timeout(600)

    csv = APP / "tmp" / "files" / "hira-rx.csv"
    if csv.exists():
        page.set_input_files("input[type=file]", str(csv))
        page.wait_for_timeout(3500)
        body = page.inner_text("body")
        facts["csv_upload"] = "표를 읽었습니다" in body
        if "표를 읽었습니다" not in body:
            failures.append("CSV 파일을 읽지 못함")
        page.get_by_role("button", name="초기화").click()
        page.wait_for_timeout(600)

    pdf = APP / "tmp" / "files" / "hira-sample.pdf"
    if pdf.exists():
        page.set_input_files("input[type=file]", str(pdf))
        page.wait_for_timeout(9000)
        body = page.inner_text("body")
        summary = (
            page.locator("textarea[aria-label='심사용 요약문']").input_value()
            if page.locator("textarea[aria-label='심사용 요약문']").count()
            else ""
        )
        facts["pdf_upload"] = {"status": "표를 읽었습니다" in body, "summary_head": summary[:60], "has_surgery": "[수술]" in summary}
        if "표를 읽었습니다" not in body:
            failures.append("PDF 파일을 읽지 못함")
        if "[수술]" not in summary:
            failures.append("PDF에서 수술 절이 만들어지지 않음")
        page.get_by_role("button", name="초기화").click()
        page.wait_for_timeout(600)

    # 1) 예시 데이터
    page.get_by_role("button", name="예시 데이터로 체험하기").click()
    page.wait_for_timeout(1200)

    body = page.inner_text("body")
    for label in ["입원", "수술 확인", "마취 있음", "세부진료 없음", "30일 이상 연속 투약", "주의 병명", "고지 문항"]:
        if label not in body:
            failures.append(f"요약 카드에 '{label}' 없음")
    facts["cards"] = page.locator("a[href^='#sp-']").count()
    facts["question_blocks"] = page.locator("details[id^='sp-q']").count()

    # 2) 요약문 복사
    page.get_by_role("button", name="요약문 복사").click()
    page.wait_for_timeout(600)
    try:
        copy = page.evaluate("() => navigator.clipboard.readText()")
        facts["summary_chars"] = len(copy)
        facts["summary_head"] = copy[:120]
        if "[입원]" not in copy and "[투약]" not in copy:
            failures.append("복사한 요약문에 [입원]·[투약] 절이 없음")
    except Exception as e:  # noqa: BLE001
        failures.append(f"클립보드 읽기 실패: {type(e).__name__}")

    # 3) 레포트 내려받기
    with page.expect_download(timeout=20000) as dl:
        page.get_by_role("button", name="레포트 HTML 저장").click()
    path = dl.value.path()
    html = pathlib.Path(path).read_text(encoding="utf-8")
    (OUT / "simpyeong-report.html").write_text(html, encoding="utf-8")
    facts["report_bytes"] = len(html.encode("utf-8"))
    facts["report_name"] = dl.value.suggested_filename
    for anchor in ["s-questions", "s-inpatient", "s-surgery", "s-meds", "s-notable"]:
        if f'id="{anchor}"' not in html:
            failures.append(f"레포트에 앵커 {anchor} 없음")
    if "최종 고지 판단은 고객 본인 확인" not in html:
        failures.append("레포트에 면책 문구 없음")

    # 4) 카드 → 근거 줄 이동
    page.locator("a[href='#sp-inpatient']").first.click()
    page.wait_for_timeout(500)

    # 5) 탭 오가기
    page.get_by_role("tab", name="이력 자가체크").click()
    page.wait_for_timeout(700)
    if "고지 항목 자가체크" not in page.inner_text("body"):
        failures.append("자가체크 탭이 열리지 않음")
    page.get_by_role("tab", name="심평원 자료로 정리").click()
    page.wait_for_timeout(900)
    # 탭을 오갔다 와도 올린 자료가 남아 있는가(화면을 숨기기만 하고 버리지 않는다)
    back = page.inner_text("body")
    if "예시 데이터" not in back and "표를 읽었습니다" not in back:
        failures.append("탭을 오간 뒤 올린 자료가 사라짐")

    # 6) 390 캡처
    page.set_viewport_size({"width": 390, "height": 900})
    page.wait_for_timeout(600)
    over390 = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    page.screenshot(path=str(OUT / "simpyeong-390.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 1000})
    page.wait_for_timeout(400)
    over1280 = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    page.screenshot(path=str(OUT / "simpyeong-1280.png"), full_page=True)
    facts["overflow"] = {"390": over390, "1280": over1280}
    if over390 > 0:
        failures.append(f"390px 가로 넘침 {over390}px")

    if errs:
        failures.append(f"콘솔 오류 {errs[:3]}")
    browser.close()

if httpd:
    httpd.shutdown()

facts["failures"] = failures
(OUT / "simpyeong-check.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(facts, ensure_ascii=False, indent=2))
print("FAIL" if failures else "PASS")
sys.exit(1 if failures else 0)
