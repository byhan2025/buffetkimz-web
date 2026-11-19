"""
OG 공유 이미지(1200×630) 생성 — scripts/og.html을 실제 브라우저로 그려 public/og.png로 저장한다.

    python3 scripts/make_og.py

- 텍스트 워드마크(buffetkimz, Instrument Serif)만 쓴다. 붓글씨 로고 이미지는 넣지 않는다.
- 웹폰트(Pretendard·Instrument Serif)를 기다린 뒤 찍는다. 실패해도 시스템 글꼴로 읽힌다.
"""
import os
import pathlib

os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "og.html"
OUT = ROOT / "public" / "og.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.goto(SRC.as_uri(), wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT), clip={"x": 0, "y": 0, "width": 1200, "height": 630})
    browser.close()

print("saved", OUT, OUT.stat().st_size, "bytes")
