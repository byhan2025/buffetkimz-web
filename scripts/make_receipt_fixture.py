#!/usr/bin/env python3
"""진료비 영수증 합성 이미지 만들기 — 실제 OCR 파이프라인 E2E 시험용 (2026-11-27)

  python3 scripts/make_receipt_fixture.py

만드는 것 (reports/buffetkimz-web/receipt-ocr-20261127/fixtures/)
  · receipt-clinic.png     의원 외래 + 처방조제  (급여 12,000 · 공단 45,000 · 처방 4,500 · 총 16,500)
  · receipt-inpatient.png  상급종합 입원 + MRI   (급여 850,000 · MRI 700,000 · 상급병실 500,000(2일) · 총 2,100,000)

실제 서류처럼 표를 그리되, 인쇄 상태의 깨끗한 영수증을 흉내 낸다(사진 노이즈는 넣지 않는다).
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path(__file__).resolve().parent.parent / "reports" / "buffetkimz-web" / "receipt-ocr-20261127" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]
FONT = next((p for p in FONT_CANDIDATES if pathlib.Path(p).exists()), None)
if not FONT:
    raise SystemExit("한글 글꼴을 찾지 못했습니다")


def make(path: pathlib.Path, title: str, sub: str, head: list[str], rows: list[tuple[str, str, str]], foot: list[tuple[str, str]]) -> None:
    W, H = 1000, 1400
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_title = ImageFont.truetype(FONT, 46)
    f_sub = ImageFont.truetype(FONT, 28)
    f_body = ImageFont.truetype(FONT, 30)
    f_small = ImageFont.truetype(FONT, 24)

    d.text((60, 50), title, font=f_title, fill="black")
    d.text((60, 115), sub, font=f_sub, fill="black")
    d.line((60, 165, W - 60, 165), fill="black", width=3)

    y = 200
    for line in head:
        d.text((60, y), line, font=f_body, fill="black")
        y += 46

    y += 20
    # 표 머리글
    d.text((60, y), "구분", font=f_body, fill="black")
    d.text((420, y), "급여", font=f_body, fill="black")
    d.text((700, y), "비급여", font=f_body, fill="black")
    y += 44
    d.line((60, y, W - 60, y), fill="black", width=2)
    y += 14
    for a, b, c in rows:
        d.text((60, y), a, font=f_body, fill="black")
        if b:
            d.text((420, y), b, font=f_body, fill="black")
        if c:
            d.text((700, y), c, font=f_body, fill="black")
        y += 46

    y += 24
    d.line((60, y, W - 60, y), fill="black", width=2)
    y += 26
    for label, value in foot:
        d.text((60, y), label, font=f_body, fill="black")
        tw = d.textlength(value, font=f_body)
        d.text((W - 60 - tw, y), value, font=f_body, fill="black")
        y += 50

    d.text((60, H - 70), "본 영수증은 계산기 시험용으로 만든 가상 자료입니다.", font=f_small, fill="black")
    img.save(path)
    print("wrote", path)


make(
    OUT / "receipt-clinic.png",
    "한빛내과의원",
    "진료비 계산서·영수증",
    ["환자 성명: 김○○      등록번호: 2026-1187", "진료기간: 2026-11-18 ~ 2026-11-18", "진료구분: 외래      진찰과: 내과"],
    [("본인부담금", "12,000", "0"), ("공단부담금", "45,000", "0")],
    [("진찰료", "12,000"), ("처방조제비(약국)", "4,500"), ("환자부담총액", "16,500")],
)

make(
    OUT / "receipt-inpatient.png",
    "서울중앙대학교병원 (상급종합병원)",
    "진료비 계산서·영수증",
    ["진료구분: 입원      입원일수: 3일", "퇴원일: 2026-11-20"],
    [("본인부담금", "850,000", "1,250,000"), ("공단부담금", "2,400,000", "0")],
    [
        ("MRI·MRA (요추)", "700,000"),
        ("상급병실료 차액 (1인실, 2일)", "500,000"),
        ("기타 비급여", "50,000"),
        ("환자부담총액", "2,100,000"),
    ],
)
