#!/usr/bin/env python3
"""영수증 PDF 두 가지 만들기 — PDF 경로 E2E 시험용 (2026-11-27)

  python3 scripts/make_receipt_pdf.py

만드는 것 (reports/buffetkimz-web/receipt-ocr-20261127/fixtures/)
  · receipt-clinic.pdf        글자가 들어 있는 PDF (브라우저 인쇄로 만든 실제 병원 앱 PDF와 같은 모양)
                              → PDF.js 글자 추출 경로를 시험한다
  · receipt-inpatient-scan.pdf 그림만 있는 PDF (사진을 PDF로 저장한 것)
                              → 페이지를 그림으로 그려 OCR 하는 경로를 시험한다
"""
from __future__ import annotations

import pathlib
import sys

from PIL import Image

APP = pathlib.Path(__file__).resolve().parent.parent
FIX = APP / "reports" / "buffetkimz-web" / "receipt-ocr-20261127" / "fixtures"
FIX.mkdir(parents=True, exist_ok=True)

HTML = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Noto Sans CJK KR", "Malgun Gothic", sans-serif; color: #111; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { font-size: 12px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #ccc; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  .foot { margin-top: 16px; font-size: 11px; color: #444; }
</style></head><body>
<h1>한빛내과의원</h1>
<div class="sub">진료비 계산서·영수증</div>
<table>
  <tr><th>환자 성명</th><td>김○○</td><th>등록번호</th><td>2026-1187</td></tr>
  <tr><th>진료기간</th><td>2026-11-18</td><th>진료구분</th><td>외래</td></tr>
</table>
<table>
  <tr><th>구분</th><th class="r">급여</th><th class="r">비급여</th></tr>
  <tr><td>본인부담금</td><td class="r">12,000</td><td class="r">0</td></tr>
  <tr><td>공단부담금</td><td class="r">45,000</td><td class="r">0</td></tr>
</table>
<table>
  <tr><td>진찰료</td><td class="r">12,000</td></tr>
  <tr><td>처방조제비(약국)</td><td class="r">4,500</td></tr>
</table>
<table>
  <tr><th>환자부담총액</th><td class="r">16,500</td></tr>
</table>
<div class="foot">본 영수증은 계산기 시험용으로 만든 가상 자료입니다.</div>
</body></html>"""


def main() -> int:
    sys.path.insert(0, str(APP / "scripts"))
    from browser_env import ensure_browser_libs  # noqa: E402

    ensure_browser_libs()
    from playwright.sync_api import sync_playwright  # noqa: E402

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome", args=["--no-sandbox"])
        page = b.new_page()
        page.set_content(HTML, wait_until="load")
        page.pdf(path=str(FIX / "receipt-clinic.pdf"), format="A4", print_background=True)
        b.close()
    print("wrote", FIX / "receipt-clinic.pdf")

    img = Image.open(FIX / "receipt-inpatient.png").convert("RGB")
    img.save(FIX / "receipt-inpatient-scan.pdf", "PDF", resolution=150.0)
    print("wrote", FIX / "receipt-inpatient-scan.pdf")
    return 0


if __name__ == "__main__":
    sys.exit(main())
