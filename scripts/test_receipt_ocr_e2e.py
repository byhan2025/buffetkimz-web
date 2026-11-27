#!/usr/bin/env python3
"""진료비 영수증 OCR 자동 입력 — 실제 브라우저 E2E (2026-11-27)

  python3 scripts/test_receipt_ocr_e2e.py local   # dist 를 로컬 서버로 띄워 검사
  python3 scripts/test_receipt_ocr_e2e.py live    # 배포 뒤 실제 GitHub Pages 주소로 검사

확인하는 것
  · 390×844 · 1280×800 에서 가로 넘침 0 · 콘솔 오류 0
  · '영수증 사진·PDF 올려서 자동 채우기' 드롭존과 버튼이 터치 가능한 크기로 보이는지
  · 가상 영수증 3종 → 입력칸 자동 채움 · 인식 요약 배너 · 원문 근거
  · 합성 영수증 PNG 2장을 실제로 올려 OCR → 파서 → 자동 채움까지(진짜 파이프라인)
  · 캡처: reports/buffetkimz-web/receipt-ocr-20261127/
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys
import threading
import time

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP.parent.parent
OUT = APP / "reports" / "buffetkimz-web" / "receipt-ocr-20261127"
FIX = OUT / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web/apps/silson-compare/run/"
PORT = 8793
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"
ONLY = sys.argv[2] if len(sys.argv) > 2 else ""   # "390x844" | "1280x800" — 한 번에 한 폭만 돌릴 때
URL = f"http://127.0.0.1:{PORT}/apps/silson-compare/run/" if MODE == "local" else LIVE


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def log_message(self, *a):
        pass


def start_local():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

failures: list[str] = []
facts: dict[str, object] = {}
httpd = start_local() if MODE == "local" else None

DROP = "영수증 사진·PDF 올려서 자동 채우기"
MARK = {"n": 0}          # 영수증을 읽기 시작한 시점의 요청 수(그 뒤 요청만 개인정보 관점에서 본다)
BANNER = "인식한 내용으로 칸을 채웠습니다"


def sel_value(page, css: str) -> str:
    """없는 칸(예: 입원이면 처방조제비 칸이 사라진다)은 빈 문자열"""
    return page.evaluate("css => { const el = document.querySelector(css); return el ? el.value : ''; }", css)


def check_overflow(page, where: str) -> None:
    m = page.evaluate("() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })")
    facts[f"overflow_{where}"] = m
    if m["sw"] > m["cw"] + 1:
        failures.append(f"{where}: 가로 넘침 {m['sw']} > {m['cw']}")


def filled(page) -> dict[str, str]:
    return {
        "급여일부": sel_value(page, 'input[id*="일부-본인부담금"]'),
        "급여전액": sel_value(page, 'input[id*="전액-본인부담금"]'),
        "처방조제": sel_value(page, 'input[id*="처방조제비"]'),
        "일반비급여": sel_value(page, 'input[id*="일반-비급여"]'),
        "도수": sel_value(page, 'input[id*="도수"]'),
        "주사": sel_value(page, 'input[id*="비급여-주사"]'),
        "MRI": sel_value(page, 'input[id*="MRI"]'),
        "병실": sel_value(page, 'input[id*="상급병실료-차액"]'),
        "공단부담": sel_value(page, 'input[id*="공단부담금"]'),
    }


def total_text(page) -> str:
    """결과 카드의 '병원비 합계' 값"""
    return page.eval_on_selector_all(
        ".rounded-xl.border p, .rounded-xl.border div",
        """els => {
            for (const el of els) {
              if (el.textContent && el.textContent.trim() === '병원비 합계') {
                const card = el.closest('div');
                return card ? card.textContent : '';
              }
            }
            return '';
        }""",
    )


def run_viewport(page, label: str) -> None:
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(f"text={DROP}", timeout=45000)
    check_overflow(page, label)

    # 드롭존·버튼 크기
    box = page.locator(f"text={DROP}").first.bounding_box()
    facts[f"dropzone_visible_{label}"] = bool(box)
    pick = page.get_by_role("button", name="사진 · PDF 고르기")
    pbox = pick.bounding_box()
    facts[f"pick_button_{label}"] = {"w": round(pbox["width"]), "h": round(pbox["height"])}
    if pbox["height"] < 44:
        failures.append(f"{label}: '사진·PDF 고르기' 버튼 높이 {pbox['height']}px < 44px")
    page.locator('[data-receipt-ocr="drop"]').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{MODE}-{label}-01-empty.png"), full_page=False)

    # ① 가상 영수증 — 의원 외래
    page.get_by_role("button", name="가상 영수증 체험").click()
    page.wait_for_selector(f"text={BANNER}", timeout=20000)
    v = filled(page)
    facts[f"sample_clinic_{label}"] = v
    if v["급여일부"] != "12,000" or v["처방조제"] != "4,500":
        failures.append(f"{label}: 가상① 채움값 다름 {v}")
    page.screenshot(path=str(OUT / f"{MODE}-{label}-02-sample-clinic.png"), full_page=False)

    # ② 가상 영수증 — 상급종합 입원+MRI (칩)
    page.get_by_role("button", name="상급종합 입원 + MRI").click()
    page.wait_for_timeout(500)
    v2 = filled(page)
    facts[f"sample_inpatient_{label}"] = v2
    for k, want in (("급여일부", "850,000"), ("MRI", "700,000"), ("병실", "500,000"), ("일반비급여", "50,000")):
        if v2[k] != want:
            failures.append(f"{label}: 가상② {k}={v2[k]!r} (기대 {want})")

    # ③ 진짜 OCR — 합성 영수증 이미지 업로드
    MARK["n"] = len(reqs)     # 영수증을 읽는 동안 나가는 요청만 따로 본다
    page.set_input_files('input[type="file"]', str(FIX / "receipt-clinic.png"))
    t0 = time.time()
    page.wait_for_selector('[data-receipt-ocr="result"], [data-receipt-ocr="error"]', timeout=240000)
    facts[f"ocr_seconds_{label}"] = round(time.time() - t0, 1)
    err = page.evaluate("() => { const el = document.querySelector('[data-receipt-ocr=\"error\"]'); return el ? el.textContent.trim() : ''; }")
    if err:
        failures.append(f"{label}: OCR 오류 — {err[:160]}")
    v3 = filled(page)
    facts[f"ocr_clinic_{label}"] = v3
    if v3["급여일부"] != "12,000" or v3["처방조제"] != "4,500":
        failures.append(f"{label}: OCR(의원) 채움값 다름 {v3}")
    page.screenshot(path=str(OUT / f"{MODE}-{label}-03-ocr-clinic.png"), full_page=False)

    # 원문 근거 펼치기
    page.get_by_text("원문 근거 보기").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{MODE}-{label}-04-evidence.png"), full_page=False)

    # ④ 진짜 OCR — 상급종합 입원+MRI 이미지
    if label == "390x844":
        page.set_input_files('input[type="file"]', str(FIX / "receipt-inpatient.png"))
        t0 = time.time()
        page.wait_for_function(
            """() => {
                const el = [...document.querySelectorAll('input')].find(i => i.id.includes('MRI'));
                return el && el.value.replace(/[^0-9]/g, '') === '700000';
            }""",
            timeout=200000,
        )
        facts[f"ocr_inpatient_seconds_{label}"] = round(time.time() - t0, 1)
        v4 = filled(page)
        facts[f"ocr_inpatient_{label}"] = v4
        for k, want in (("급여일부", "850,000"), ("MRI", "700,000"), ("병실", "500,000")):
            if v4[k] != want:
                failures.append(f"{label}: OCR(입원) {k}={v4[k]!r} (기대 {want})")
        page.screenshot(path=str(OUT / f"{MODE}-{label}-05-ocr-inpatient.png"), full_page=False)

    # ⑤ PDF 두 갈래 — 글자가 든 PDF(글자 추출) / 그림만 있는 PDF(스캔 → OCR)
    if label == "390x844":
        page.set_input_files('input[type="file"]', str(FIX / "receipt-clinic.pdf"))
        t0 = time.time()
        page.wait_for_function(
            """() => {
                const el = document.querySelector('input[id*="일부-본인부담금"]');
                return el && el.value.replace(/[^0-9]/g, '') === '12000';
            }""",
            timeout=180000,
        )
        facts["pdf_text_seconds"] = round(time.time() - t0, 1)
        v5 = filled(page)
        facts["pdf_text"] = v5
        if v5["급여일부"] != "12,000" or v5["처방조제"] != "4,500":
            failures.append(f"PDF(글자): 채움값 다름 {v5}")
        page.screenshot(path=str(OUT / f"{MODE}-{label}-06-pdf-text.png"), full_page=False)

        page.set_input_files('input[type="file"]', str(FIX / "receipt-inpatient-scan.pdf"))
        t0 = time.time()
        page.wait_for_function(
            """() => {
                const el = [...document.querySelectorAll('input')].find(i => i.id.includes('MRI'));
                return el && el.value.replace(/[^0-9]/g, '') === '700000';
            }""",
            timeout=240000,
        )
        facts["pdf_scan_seconds"] = round(time.time() - t0, 1)
        v6 = filled(page)
        facts["pdf_scan"] = v6
        if v6["급여일부"] != "850,000" or v6["병실"] != "500,000":
            failures.append(f"PDF(스캔): 채움값 다름 {v6}")
        page.screenshot(path=str(OUT / f"{MODE}-{label}-07-pdf-scan.png"), full_page=False)

    check_overflow(page, f"{label}-after")


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )
        views = [("390x844", {"width": 390, "height": 844}), ("1280x800", {"width": 1280, "height": 800})]
        if ONLY:
            views = [v for v in views if v[0] == ONLY]
        for label, vp in views:
            ctx = browser.new_context(viewport=vp, device_scale_factor=2 if label == "390x844" else 1, locale="ko-KR")
            page = ctx.new_page()
            errors: list[str] = []
            reqs: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("request", lambda r: reqs.append(r.url))
            page.on("pageerror", lambda e: errors.append(str(e)))
            try:
                run_viewport(page, label)
            except Exception as e:  # noqa: BLE001
                failures.append(f"{label}: 예외 {e}")
            # 개인정보 약속 확인 — 영수증을 읽는 동안 사이트 밖으로 나가는 요청이 없어야 한다.
            # (페이지 글꼴은 사이트 공통 디자인이 CDN에서 받는다 — 영수증 파일과는 무관하므로 뺀다)
            FONT_HOSTS = ("https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://fonts.gstatic.com")
            outside = [
                u for u in reqs[MARK["n"]:]
                if not u.startswith("http://127.0.0.1")
                and not u.startswith("https://byhan2025.github.io")
                and not u.startswith(FONT_HOSTS)
                and not u.startswith(("data:", "blob:"))
            ]
            facts[f"outside_requests_{label}"] = outside[:10]
            if outside:
                failures.append(f"{label}: 사이트 밖 요청 {len(outside)}건 {outside[:3]}")
            real = [e for e in errors if "favicon" not in e.lower()]
            facts[f"console_errors_{label}"] = real
            if real:
                failures.append(f"{label}: 콘솔 오류 {len(real)}건 {real[:3]}")
            ctx.close()
        browser.close()
finally:
    if httpd:
        httpd.shutdown()

facts["mode"] = MODE
facts["url"] = URL
facts["failures"] = failures
(OUT / f"e2e-{MODE}{'-' + ONLY if ONLY else ''}.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps(facts, ensure_ascii=False, indent=2))
if failures:
    print(f"\nFAIL — {len(failures)}건")
    for f in failures:
        print("  ·", f)
    sys.exit(1)
print("\nPASS — 영수증 자동 입력 E2E 전부 통과")
