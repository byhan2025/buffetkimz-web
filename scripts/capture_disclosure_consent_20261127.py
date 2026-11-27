#!/usr/bin/env python3
"""진료자료 활용 동의서 — 화면·서명·확인증 검사 (2026-11-27)

  python3 scripts/capture_disclosure_consent_20261127.py local   # dist를 로컬로 띄워 검사
  python3 scripts/capture_disclosure_consent_20261127.py live    # 배포 뒤 실제 주소로 검사

하는 일
  · 390×844(모바일) · 1280×800(데스크톱)에서 가로 넘침 0 · 콘솔 오류 0 · 404 0
  · 다섯 약속·필수 동의·전자서명 패드가 보이는지, 빈 제출이 막히는지
  · [가상 예시] → [지우기] → 마우스로 서명 → 완료 → 동의번호·일시·확인증
  · 확인증 PNG(크기·해상도)와 A4 PDF(1장·A4 크기) 내려받기 확인
  · 요약·안내 문구 복사 내용 확인
  · 데이터가 나가는 외부 요청 0 (사이트 자체 + 글꼴 CDN만 허용)
  · 캡처는 reports/buffetkimz-web/disclosure-consent-20261127/ 에 남긴다
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import struct
import sys
import threading
import urllib.parse

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP.parent.parent
OUT = APP / "reports" / "buffetkimz-web" / "disclosure-consent-20261127"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
PORT = 8817
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"
ALLOW_FONT_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"}
STATIC_TYPES = {"font", "stylesheet", "script", "image"}


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

base = f"http://127.0.0.1:{PORT}" if MODE == "local" else LIVE
site_host = urllib.parse.urlparse(base).netloc
httpd = start_local() if MODE == "local" else None
failures: list[str] = []
facts: dict[str, object] = {}


def note(name: str, ok: bool, detail: object = "") -> None:
    if not ok:
        failures.append(f"{name}{(' — ' + str(detail)) if detail else ''}")


def png_size(path: pathlib.Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("PNG 시그니처 아님")
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def pdf_info(path: pathlib.Path) -> dict:
    from pypdf import PdfReader

    r = PdfReader(str(path))
    box = r.pages[0].mediabox
    return {
        "pages": len(r.pages),
        "width_pt": round(float(box.width), 2),
        "height_pt": round(float(box.height), 2),
        "bytes": path.stat().st_size,
    }


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )
        for width, height in ((390, 844), (1280, 800)):
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                locale="ko-KR",
                accept_downloads=True,
                permissions=["clipboard-read", "clipboard-write"],
            )
            page = ctx.new_page()
            errs: list[str] = []
            missing: list[str] = []
            external: list[str] = []
            after_fill: list[dict] = []
            phase = {"filled": False}

            def on_request(r):
                host = urllib.parse.urlparse(r.url).netloc
                if r.url.startswith(("data:", "blob:")):
                    return
                if phase["filled"] and host != site_host:
                    after_fill.append({"url": r.url, "method": r.method})
                if host != site_host:
                    external.append({"url": r.url, "host": host, "method": r.method, "type": r.resource_type})

            page.on("request", on_request)
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on(
                "response",
                lambda r: missing.append(r.url) if r.status >= 400 and "favicon" not in r.url else None,
            )
            page.goto(f"{base}/apps/disclosure-consent/run/", wait_until="networkidle")
            page.wait_for_timeout(1200)

            overflow = page.evaluate("() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })")
            note(f"{width}px 가로 넘침", overflow["sw"] <= overflow["cw"] + 1, overflow)
            facts[f"{width}_overflow"] = overflow

            body = page.inner_text("body")
            for label in (
                "심평원 진료자료 안전 확인 5대 약속",
                "진료자료는 고객이 직접 발급합니다",
                "인증서·비밀번호는 절대 받지 않습니다",
                "활용 동의서를 먼저 받습니다",
                "병력·고지 확인에만 사용합니다",
                "확인 후 30일 안에 파기합니다",
                "개인정보 수집·이용 동의",
                "민감정보(건강·질병 정보) 처리 동의",
                "상담 안내·후속 연락 수신 동의",
                "전자서명",
                "동의서 작성 완료",
            ):
                note(f"{width}px '{label}' 없음", label in body)
            note(f"{width}px 서명 캔버스 없음", page.locator("canvas[aria-label=서명란]").count() == 1)

            if width == 390:
                # 빈 제출 → 오류 안내
                page.get_by_role("button", name="동의서 작성 완료").click()
                page.wait_for_timeout(500)
                body = page.inner_text("body")
                for msg in ("성명을 두 글자 이상", "연락처를 입력해 주세요", "생년월일을 입력해 주세요", "필수 동의 항목", "서명란에 손가락"):
                    note(f"빈 제출 안내 '{msg}' 없음", msg in body)

                # 가상 예시 → 확인증이 '가상 예시'로 표시되는지
                page.get_by_role("button", name="가상 예시 채우기").click()
                page.wait_for_timeout(500)
                body = page.inner_text("body")
                note("가상 예시 표식 없음", "가상 예시로 채웠습니다" in body)
                facts["example_name"] = page.locator("input[autocomplete=name]").input_value()
                facts["example_phone"] = page.locator("input[autocomplete=tel]").input_value()
                facts["example_birth"] = page.locator("input[placeholder*='1981']").input_value()
                page.screenshot(path=str(OUT / f"consent-{MODE}-390-form.png"), full_page=True)

                # 지우기 → 실제 마우스로 서명
                page.get_by_role("button", name="지우기").click()
                page.wait_for_timeout(300)
                box = page.locator("canvas[aria-label=서명란]").bounding_box()
                note("서명 캔버스 크기 0", bool(box and box["width"] > 200 and box["height"] > 60), box)
                if box:
                    page.mouse.move(box["x"] + box["width"] * 0.18, box["y"] + box["height"] * 0.62)
                    page.mouse.down()
                    for fx, fy in ((0.28, 0.34), (0.38, 0.55), (0.47, 0.32), (0.56, 0.58), (0.68, 0.36), (0.8, 0.5)):
                        page.mouse.move(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy, steps=6)
                    page.mouse.up()
                    page.wait_for_timeout(300)
                facts["signature_ink"] = page.evaluate(
                    "() => { const c = document.querySelector('canvas[aria-label=서명란]'); const x = c.getContext('2d');"
                    " const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;"
                    " for (let i = 0; i < d.length; i += 4) if (d[i+3] > 20 && d[i] < 120 && d[i+1] < 120) n++; return n; }"
                )
                note("서명 픽셀이 없음", int(facts["signature_ink"] or 0) > 400, facts["signature_ink"])
                note("서명 캔버스가 초기화되지 않음", page.evaluate("() => document.querySelector('canvas[aria-label=서명란]').width") >= 780)

                page.get_by_role("button", name="동의서 작성 완료").click()
                phase["filled"] = True
                page.wait_for_timeout(800)
                body = page.inner_text("body")
                for label in ("작성 완료", "동의번호", "가상 예시 · 효력 없음", "A4 PDF 저장", "확인증 이미지(PNG) 저장"):
                    note(f"완료 화면 '{label}' 없음", label in body)
                consent_no = page.locator("#consent-done dd").first.inner_text() if page.locator("#consent-done dd").count() else ""
                facts["consent_no"] = consent_no
                note("동의번호 형식", bool(__import__("re").match(r"^DC-\d{8}-[0-9A-Z]{4}$", consent_no)), consent_no)
                page.screenshot(path=str(OUT / f"consent-{MODE}-390-done.png"), full_page=True)

                # PNG
                with page.expect_download(timeout=30000) as dl:
                    page.get_by_role("button", name="확인증 이미지(PNG) 저장").click()
                png = pathlib.Path(dl.value.path())
                saved_png = OUT / f"consent-{MODE}-390-confirmation.png"
                saved_png.write_bytes(png.read_bytes())
                w, h = png_size(saved_png)
                facts["png"] = {"bytes": saved_png.stat().st_size, "width": w, "height": h}
                note("PNG 너무 작음", saved_png.stat().st_size > 30000, facts["png"])
                note("PNG 해상도", w == 1080 and abs(h / w - 297 / 210) < 0.02, facts["png"])

                # A4 PDF
                with page.expect_download(timeout=30000) as dl:
                    page.get_by_role("button", name="A4 PDF 저장").click()
                pdf = pathlib.Path(dl.value.path())
                saved_pdf = OUT / f"consent-{MODE}-390-confirmation.pdf"
                saved_pdf.write_bytes(pdf.read_bytes())
                info = pdf_info(saved_pdf)
                facts["pdf"] = info
                note("PDF 1장 아님", info["pages"] == 1, info)
                note("PDF A4 크기 아님", abs(info["width_pt"] - 595.28) < 1 and abs(info["height_pt"] - 841.89) < 1, info)

                # PDF를 그림으로 풀어 한글·서명이 실제로 그려졌는지 본다.
                import pymupdf

                doc = pymupdf.open(str(saved_pdf))
                pix = doc[0].get_pixmap(dpi=110)
                pix.save(str(OUT / f"consent-{MODE}-390-pdf-page.png"))
                facts["pdf_render"] = {"width": pix.width, "height": pix.height}

                # 복사
                page.get_by_role("button", name="설계사 기록용 요약 복사").click()
                page.wait_for_timeout(600)
                clip = page.evaluate("() => navigator.clipboard.readText()")
                facts["summary_chars"] = len(clip)
                for t in ("[진료자료 활용 동의서]", consent_no, "홍길동", "30일", "가상 예시"):
                    note(f"요약 복사에 '{t}' 없음", t in clip)
                page.get_by_role("button", name="고객에게 보낼 안내 문구 복사").click()
                page.wait_for_timeout(600)
                guide = page.evaluate("() => navigator.clipboard.readText()")
                facts["guide_chars"] = len(guide)
                for t in ("/apps/disclosure-consent/run/", "인증서·비밀번호", "30일", "거부"):
                    note(f"안내 문구에 '{t}' 없음", t in guide)

                # '새로 작성'이 서명까지 비우는지
                page.get_by_role("button", name="새로 작성").click()
                page.wait_for_timeout(500)
                note("새로 작성 뒤 서명 남음", page.evaluate(
                    "() => { const c = document.querySelector('canvas[aria-label=서명란]'); const x = c.getContext('2d');"
                    " const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;"
                    " for (let i = 0; i < d.length; i += 4) if (d[i+3] > 20 && d[i] < 120 && d[i+1] < 120) n++; return n; }"
                ) == 0)

            else:
                # 데스크톱 — 예시 채우고 완료 화면까지 한 번 더
                page.get_by_role("button", name="가상 예시 채우기").click()
                page.wait_for_timeout(400)
                page.get_by_role("button", name="동의서 작성 완료").click()
                page.wait_for_timeout(700)
                note("1280px 완료 화면 없음", "작성 완료" in page.inner_text("body"))
                page.screenshot(path=str(OUT / f"consent-{MODE}-1280-done.png"), full_page=True)

            mine = [e for e in errs if "favicon" not in e]
            note(f"{width}px 콘솔 오류", not mine, mine[:3])
            note(f"{width}px 404", not missing, sorted(set(missing))[:3])
            unknown = [r for r in external if r["host"] not in ALLOW_FONT_HOSTS]
            note(f"{width}px 외부 요청", not unknown, unknown[:3])
            not_static = [r for r in external if r["method"] != "GET" or r["type"] not in STATIC_TYPES]
            note(f"{width}px 정적 자원이 아닌 외부 요청", not not_static, not_static[:3])
            note(f"{width}px 입력 뒤 외부 전송", not after_fill, after_fill[:3])
            facts[f"{width}_external_hosts"] = sorted({r["host"] for r in external})
            facts[f"{width}_after_fill_external"] = after_fill
            ctx.close()

        # 소개 페이지 + 심평원 고지 정리기의 동의서 안내
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR")
        page = ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.goto(f"{base}/apps/disclosure-consent/", wait_until="networkidle")
        page.wait_for_timeout(800)
        intro = page.inner_text("body")
        note("소개 페이지 제목 없음", "진료자료 활용 동의서" in intro)
        page.screenshot(path=str(OUT / f"consent-{MODE}-intro-390.png"), full_page=True)

        page.goto(f"{base}/apps/simpyeong-disclosure/run/", wait_until="networkidle")
        page.wait_for_timeout(900)
        gate = page.locator("[data-consent-gate]")
        note("심평원 화면에 동의서 안내 없음", gate.count() == 1)
        if gate.count():
            href = gate.locator("a").get_attribute("href") or ""
            note("동의서 링크 주소", "disclosure-consent/run" in href, href)
            page.screenshot(path=str(OUT / f"consent-{MODE}-simpyeong-gate-390.png"), full_page=True)
        note("소개/심평원 콘솔 오류", not [e for e in errs if "favicon" not in e], errs[:2])
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
