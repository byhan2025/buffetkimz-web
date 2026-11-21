#!/usr/bin/env python3
"""v7.3 유용한앱 7종 실측 — 실행 페이지가 뜨는지, 실제로 동작하는지.

확인 항목
  1) /apps/<slug>/run/ 7종 × 390px·1280px — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  2) 도구별 실제 입력: URL 정리, QR 생성(생성한 PNG를 OpenCV로 다시 읽어 값 대조),
     EXIF 확인·모자이크·EXIF 제거 확인(PIL), 이미지 압축 용량 감소, 규격 리사이즈 픽셀,
     워터마크 픽셀 변화, 이미지→PDF(pypdf 페이지 수), PDF→PNG(해상도)
  3) 도구가 부르는 fetch/XHR 중 localhost 밖으로 나가는 요청이 0건인지

사용: python3 scripts/verify_utils7.py [--keep]
결과 캡처: /workspace/reports/buffetkimz-web/utils7/
"""
from __future__ import annotations

import http.server
import os
import pathlib
import socketserver
import sys
import threading
import time

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from pypdf import PdfReader  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/utils7")
FIX = pathlib.Path("/workspace/tmp/fixtures")
DL = OUT / "downloads"
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = 8188
PREFIX = "/buffetkimz-web"
BASE = f"http://127.0.0.1:{PORT}"

SLUGS = [
    "exif-mosaic",
    "url-cleaner",
    "pdf-image",
    "image-compress",
    "qr-generator",
    "image-resize",
    "watermark",
]

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, ok, detail))
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def save_download(scope, page, action, filename: str) -> pathlib.Path:
    """버튼 클릭 → 내려받기 1건을 파일로 저장."""
    with page.expect_download(timeout=30000) as info:
        action()
    path = DL / filename
    info.value.save_as(str(path))
    return path


def exif_tag_count(path: pathlib.Path) -> tuple[int, bool]:
    im = Image.open(path)
    exif = im.getexif()
    gps = exif.get_ifd(0x8825) if exif else {}
    return len(exif), bool(gps)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    DL.mkdir(parents=True, exist_ok=True)

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    failures_before = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=2"])

        # ---------------------------------------------------------- 1) 7종 × 2 화면
        print("\n[1] 실행 페이지 7종 × 390 / 1280", flush=True)
        # 페이지·스레드를 아껴 한 화면당 페이지 하나로 7종을 넘겨 본다
        for width, height, mobile in ((390, 844, True), (1280, 900, False)):
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                locale="ko-KR",
                is_mobile=mobile,
                has_touch=mobile,
                accept_downloads=True,
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m, e=errors: e.append(f"{m.type}:{m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda err, e=errors: e.append(f"pageerror:{err}"))
            for slug in SLUGS:
                errors.clear()
                resp = page.goto(f"{BASE}{PREFIX}/apps/{slug}/run/", wait_until="networkidle", timeout=60000)
                status = resp.status if resp else 0
                page.wait_for_timeout(500)
                has_root = page.locator("[data-useful-app]").count() == 1
                overflow = page.evaluate(
                    "() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)"
                    " - document.documentElement.clientWidth"
                )
                check(f"{slug} {width}px · HTTP 200", status == 200, str(status))
                check(f"{slug} {width}px · 도구 렌더", has_root)
                check(f"{slug} {width}px · 가로 넘침 없음", overflow <= 1, f"{overflow}px")
                check(f"{slug} {width}px · 콘솔 오류 0", not errors, "; ".join(errors[:2]))
                page.screenshot(path=str(OUT / f"run-{slug}-{width}.png"), full_page=False)
                if width == 1280:
                    page.screenshot(path=str(OUT / f"run-{slug}-1280-full.png"), full_page=True)
            page.close()
            ctx.close()

        # 소개(상세) 페이지 — 새 도해(AppArt)와 문구가 깨지지 않는지
        print("\n[1-2] 소개 페이지 7종", flush=True)
        for width, height, mobile in ((390, 844, True), (1280, 900, False)):
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                locale="ko-KR",
                is_mobile=mobile,
                has_touch=mobile,
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m, e=errors: e.append(f"{m.type}:{m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda err, e=errors: e.append(f"pageerror:{err}"))
            for slug in SLUGS:
                errors.clear()
                resp = page.goto(f"{BASE}{PREFIX}/apps/{slug}/", wait_until="networkidle", timeout=60000)
                status = resp.status if resp else 0
                page.wait_for_timeout(300)
                overflow = page.evaluate(
                    "() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)"
                    " - document.documentElement.clientWidth"
                )
                check(f"소개 {slug} {width}px · HTTP 200", status == 200, str(status))
                check(f"소개 {slug} {width}px · 가로 넘침 없음", overflow <= 1, f"{overflow}px")
                check(f"소개 {slug} {width}px · 콘솔 오류 0", not errors, "; ".join(errors[:2]))
                if width == 1280:
                    page.screenshot(path=str(OUT / f"intro-{slug}-1280.png"), full_page=False)
            page.close()
            ctx.close()

        # 앱스토어에 7종이 '유용한앱'으로 들어갔는지
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        page = ctx.new_page()
        page.goto(f"{BASE}{PREFIX}/apps/", wait_until="networkidle", timeout=60000)
        util_cards = page.locator('#cat-utility li.store-card[data-store-item]').count()
        coming = page.locator('[data-store-coming="utility"]').count()
        check("앱스토어 유용한앱 카드 29칸(앱 27종+캘린더+자료앨범)", util_cards == 29, str(util_cards))
        check("앱스토어 '준비 중' 자리 없음", coming == 0, str(coming))
        page.screenshot(path=str(OUT / "apps-utility-1280.png"), full_page=False)
        ctx.close()

        # ---------------------------------------------------------- 2) 기능 실측
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 1000},
            locale="ko-KR",
            accept_downloads=True,
            permissions=["clipboard-read", "clipboard-write"],
        )
        page = ctx.new_page()
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(f"{m.type}:{m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(f"pageerror:{err}"))
        outside: list[str] = []
        page.on(
            "request",
            lambda r: outside.append(f"{r.method} {r.url}")
            if r.resource_type in ("xhr", "fetch") and "127.0.0.1" not in r.url
            else None,
        )

        # --- URL 추적제거
        print("\n[2-1] URL 추적제거", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/url-cleaner/run/", wait_until="networkidle", timeout=60000)
        page.fill(
            "textarea",
            "https://example.com/a?utm_source=ig&fbclid=XYZ&page=2&si=share1\n"
            "https://example.com/b?id=7&gclid=abc&srsltid=def\n"
            "https://example.com/c?q=hello&empty=&utm_medium=social",
        )
        page.wait_for_timeout(400)
        cleaned = page.locator("[data-clean-url]").all_inner_texts()
        check("URL 3줄 정리", cleaned == [
            "https://example.com/a?page=2",
            "https://example.com/b?id=7",
            "https://example.com/c?q=hello",
        ], " | ".join(cleaned))
        removed = " ".join(page.locator("[data-removed-param]").all_inner_texts())
        check("추적 파라미터 표시", "utm_source" in removed and "gclid" in removed and "빈 값" in removed, removed[:80])
        page.get_by_role("button", name="전체 복사").click()
        page.wait_for_timeout(300)
        clip = page.evaluate("navigator.clipboard.readText()")
        check("전체 복사 = 정리된 주소만", "utm_" not in clip and "fbclid" not in clip and clip.count("\n") == 2, clip[:60].replace("\n", "⏎"))
        page.screenshot(path=str(OUT / "test-url-cleaner.png"))

        # --- QR 생성기
        print("\n[2-2] QR 코드 생성기", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/qr-generator/run/", wait_until="networkidle", timeout=60000)
        target = "https://buffetkimz.com/apps/qr-test"
        page.fill("#qr-value", target)
        page.wait_for_timeout(400)
        d = page.get_attribute("[data-qr-preview] path", "d")
        check("QR path 생성", bool(d) and len(d) > 200, f"{len(d or '')}자")
        png = save_download(None, page, lambda: page.get_by_role("button", name="PNG 저장").click(), "qr.png")
        decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(png)))
        check("PNG 저장 + 다시 읽어 값 일치", decoded == target, f"{png.stat().st_size}B / {decoded!r}")
        svg = save_download(None, page, lambda: page.get_by_role("button", name="SVG 저장").click(), "qr.svg")
        svg_text = svg.read_text(encoding="utf-8")
        check("SVG 저장", svg_text.startswith("<svg") and "<path" in svg_text, f"{len(svg_text)}자")
        page.get_by_role("button", name="전화번호").click()
        page.wait_for_timeout(300)
        check("전화번호형 tel: 반영", "tel:01049084175" in page.locator("text=QR에 들어가는 값").inner_text())
        page.screenshot(path=str(OUT / "test-qr-generator.png"))

        # --- EXIF 제거·모자이크
        print("\n[2-3] EXIF 제거·모자이크", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/exif-mosaic/run/", wait_until="networkidle", timeout=60000)
        page.set_input_files("[data-dropzone] input[type=file]", str(FIX / "exif-gps.jpg"))
        page.wait_for_selector("[data-exif-table]", timeout=20000)
        table = page.locator("[data-exif-table]").inner_text()
        check("EXIF 표시(기종·GPS)", "iPhone 15 Pro" in table and "GPS 위도" in table, table[:60].replace("\n", " "))
        check("GPS 경고 표시", page.locator("text=촬영 위치가 남아 있습니다").count() == 1)
        canvas = page.locator("[data-exif-canvas]")
        canvas.scroll_into_view_if_needed()
        box = canvas.bounding_box()
        page.mouse.move(box["x"] + box["width"] * 0.06, box["y"] + box["height"] * 0.06)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] * 0.40, box["y"] + box["height"] * 0.30, steps=12)
        page.mouse.up()
        page.wait_for_timeout(400)
        check("드래그로 모자이크 1곳", "1곳" in page.locator("text=지금까지").inner_text())
        page.screenshot(path=str(OUT / "test-exif-mosaic.png"))
        clean = save_download(None, page, lambda: page.get_by_role("button", name="EXIF 지운 이미지 저장").click(), "exif-clean.jpg")
        tags, gps = exif_tag_count(clean)
        check("저장 파일 EXIF 0개", tags == 0, f"태그 {tags}개")
        check("저장 파일 GPS 없음", gps is False)
        src = np.asarray(Image.open(FIX / "exif-gps.jpg").convert("RGB").resize((600, 400)))
        dst = np.asarray(Image.open(clean).convert("RGB").resize((600, 400)))
        region = np.abs(src[24:120, 42:240].astype(int) - dst[24:120, 42:240].astype(int)).mean()
        untouched = np.abs(src[300:380, 400:560].astype(int) - dst[300:380, 400:560].astype(int)).mean()
        check("고른 영역만 바뀜", region > 6 and untouched < 4, f"영역 {region:.1f} / 바깥 {untouched:.1f}")

        # --- 이미지 압축
        print("\n[2-4] 이미지 압축", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/image-compress/run/", wait_until="networkidle", timeout=60000)
        page.set_input_files("[data-dropzone] input[type=file]", [str(FIX / "photo-large.jpg"), str(FIX / "photo-800x600.jpg")])
        page.wait_for_selector("[data-compress-item]", timeout=20000)
        deadline = time.time() + 40
        sizes = ""
        while time.time() < deadline:
            sizes = " ".join(page.locator("[data-compress-sizes]").all_inner_texts())
            if "계산 중" not in sizes and sizes.count("→") >= 2:
                break
            page.wait_for_timeout(500)
        check("두 장 압축 결과 표시", sizes.count("→") == 2 and "계산 중" not in sizes, sizes[:80])
        page.screenshot(path=str(OUT / "test-image-compress.png"))
        comp = save_download(None, page, lambda: page.locator("[data-compress-item]").first.get_by_role("button", name="저장").click(), "compressed.jpg")
        before = (FIX / "photo-large.jpg").stat().st_size
        after = comp.stat().st_size
        check("압축 파일이 원본보다 작음", after < before * 0.6, f"{before/1e6:.2f}MB → {after/1024:.0f}KB")
        with Image.open(comp) as im:
            check("압축 결과 크기 유지(2400×1600)", im.size == (2400, 1600), str(im.size))

        # --- SNS 비율 리사이즈
        print("\n[2-5] SNS 비율 리사이즈", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/image-resize/run/", wait_until="networkidle", timeout=60000)
        page.set_input_files("[data-dropzone] input[type=file]", str(FIX / "photo-800x600.jpg"))
        page.wait_for_selector("[data-resize-canvas]", timeout=15000)
        page.locator('[data-preset="insta-45"]').click()
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "test-image-resize.png"))
        resized = save_download(None, page, lambda: page.get_by_role("button", name="인스타 4:5 파일 저장").click(), "insta-45.jpg")
        with Image.open(resized) as im:
            check("4:5 규격 1080×1350", im.size == (1080, 1350), str(im.size))
        page.locator('[data-preset="story"]').click()
        page.wait_for_timeout(600)
        story = save_download(None, page, lambda: page.get_by_role("button", name="스토리·릴스 9:16 파일 저장").click(), "story-916.jpg")
        with Image.open(story) as im:
            check("9:16 규격 1080×1920", im.size == (1080, 1920), str(im.size))

        # --- 워터마크
        print("\n[2-6] 워터마크", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/watermark/run/", wait_until="networkidle", timeout=60000)
        page.set_input_files("[data-dropzone] input[type=file]", str(FIX / "photo-800x600.jpg"))
        page.wait_for_selector("[data-watermark-canvas]", timeout=15000)
        page.select_option("#wm-pos", "tile")
        page.fill("#wm-text", "buffetkimz")
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "test-watermark.png"))
        wm = save_download(None, page, lambda: page.get_by_role("button", name="워터마크 이미지 저장").click(), "watermark.jpg")
        with Image.open(wm) as im:
            check("원본 해상도 유지(800×600)", im.size == (800, 600), str(im.size))
        a = np.asarray(Image.open(FIX / "photo-800x600.jpg").convert("RGB")).astype(int)
        b = np.asarray(Image.open(wm).convert("RGB").resize((800, 600))).astype(int)
        diff = np.abs(a - b).mean()
        check("문구가 픽셀에 반영됨", diff > 1.5, f"평균 차이 {diff:.2f}")

        # --- PDF ↔ 이미지
        print("\n[2-7] PDF ↔ 이미지", flush=True)
        page.goto(f"{BASE}{PREFIX}/apps/pdf-image/run/", wait_until="networkidle", timeout=60000)
        page.set_input_files("[data-dropzone] input[type=file]", [str(FIX / "photo-800x600.jpg"), str(FIX / "doc-page.jpg")])
        page.wait_for_selector("[data-pdf-image-item]", timeout=15000)
        check("이미지 2장 목록", page.locator("[data-pdf-image-item]").count() == 2)
        page.get_by_role("button", name="PDF 만들기").click()
        page.wait_for_selector("text=완성", timeout=None)
        page.wait_for_timeout(300)
        pdf_path = save_download(None, page, lambda: page.get_by_role("button", name="PDF 저장", exact=True).click(), "images.pdf")
        reader = PdfReader(str(pdf_path))
        check("PDF 페이지 수 2", len(reader.pages) == 2, f"{len(reader.pages)}p / {pdf_path.stat().st_size}B")
        check("PDF 용지 A4", abs(float(reader.pages[0].mediabox.width) - 595.28) < 1, str(reader.pages[0].mediabox))
        page.screenshot(path=str(OUT / "test-pdf-to-pdf.png"))

        page.get_by_role("tab", name="PDF → 이미지").click()
        page.wait_for_timeout(300)
        page.set_input_files("[data-dropzone] input[type=file]", str(pdf_path))
        page.wait_for_selector("[data-pdf-pages] li", timeout=90000)
        deadline = time.time() + 90
        while time.time() < deadline and page.locator("[data-pdf-pages] li").count() < 2:
            page.wait_for_timeout(700)
        check("페이지 2장 PNG 생성", page.locator("[data-pdf-pages] li").count() == 2, str(page.locator("[data-pdf-pages] li").count()))
        page.screenshot(path=str(OUT / "test-pdf-to-image.png"))
        page1 = save_download(None, page, lambda: page.locator("[data-pdf-pages] li").first.get_by_role("button", name="저장").click(), "page1.png")
        with Image.open(page1) as im:
            check("150dpi A4 ≈ 1240×1754", abs(im.size[0] - 1240) <= 2 and abs(im.size[1] - 1754) <= 2, str(im.size))

        check("도구 fetch/XHR 외부 전송 0건", not outside, "; ".join(outside[:3]))
        check("기능 테스트 중 콘솔 오류 0", not console_errors, "; ".join(console_errors[:2]))

        browser.close()

    httpd.shutdown()

    ok = sum(1 for _, v, _ in CHECKS if v)
    bad = [c for c in CHECKS if not c[1]]
    print(f"\n{'='*60}\n검사 {len(CHECKS)}건 · 통과 {ok} · 실패 {len(bad)}", flush=True)
    for name, _, detail in bad:
        print(f"  실패: {name} [{detail}]", flush=True)
    print(f"캡처: {OUT}", flush=True)
    return 0 if not bad else 1


def _run() -> int:
    try:
        return main()
    except Exception as exc:  # 실행 중 예외도 '실패'로 남기고 요약을 출력한다
        import traceback

        traceback.print_exc()
        check("검사 실행 중 예외", False, repr(exc)[:160])
        bad = [c for c in CHECKS if not c[1]]
        print(f"\n검사 {len(CHECKS)}건 · 실패 {len(bad)}", flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(_run())
