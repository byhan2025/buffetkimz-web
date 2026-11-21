#!/usr/bin/env python3
"""유용한앱 4탄(4종) 실제 동작 검수 — Playwright.

빌드된 `dist/`를 로컬로 띄우고 `/utils-d-preview/`에서 네 도구를 실제로 조작한다.

  · 이미지 업스케일: 업로드 → 배율 → 처리 → 캔버스 픽셀 크기·색 → PNG 내려받기 크기
  · URL 단축기: UTM 제거 → 실제 spoo.me 호출(CORS 확인) → 짧은 주소·QR·복사
  · PDF: 병합(순서·쪽수) → 내려받은 PDF 쪽수(pypdf로 확인), 페이지 추출 → 쪽수
  · 세계시계: 다섯 거래소 시각을 파이썬 zoneinfo와 대조, 1초 흐름, 여름·겨울 오프셋(DST)

사용:
  PATH=/workspace/.tools/node-v22.23.4-linux-x64/bin:$PATH npm run build
  python3 scripts/test_utils_d.py
결과: reports/utils-d/test-report.json + 스크린샷 PNG
"""
from __future__ import annotations

import datetime as dt
import http.server
import json
import pathlib
import re
import socketserver
import struct
import threading
import time
from zoneinfo import ZoneInfo

from pypdf import PdfReader, PdfWriter
from playwright.sync_api import sync_playwright

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP / "reports" / "utils-d"
PORT = 8143
CHROME = "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
URL = f"http://127.0.0.1:{PORT}/utils-d-preview/"

results: list[dict] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("  ✓ " if ok else "  ✗ ") + name + (f" — {detail}" if detail != "" else ""))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# ── 시험용 파일 만들기 ────────────────────────────────────────────────
def make_images(out: pathlib.Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (240, 180), "#ffffff")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 119, 89], fill="#e02020")
    d.rectangle([120, 0, 239, 89], fill="#1f7a62")
    d.rectangle([0, 90, 119, 179], fill="#2c7be0")
    d.rectangle([120, 90, 239, 179], fill="#f2c14e")
    # 경계·글자 모양의 선 — 선명화가 하는 일을 눈으로 보려고 넣는다
    d.line([0, 60, 239, 60], fill="#111111", width=2)
    try:
        font = ImageFont.load_default()
        d.text((10, 100), "BUFFETKIMZ 2026", fill="#0b1b29", font=font)
    except Exception:  # noqa: BLE001
        pass
    img.save(out / "sample-small.png")

    # 4배에서만 캔버스 한도를 넘고(3,456만 픽셀) 2배에서는 넘지 않는 크기(864만 픽셀)
    big = Image.new("RGB", (1800, 1200), "#dfe7ef")
    bd = ImageDraw.Draw(big)
    for x in range(0, 1800, 150):
        bd.rectangle([x, 0, x + 50, 1200], fill="#2c7be0")
    big.save(out / "sample-big.png")


def make_pdfs(out: pathlib.Path) -> None:
    for name, pages in [("a-2p.pdf", 2), ("b-3p.pdf", 3), ("c-4p.pdf", 4)]:
        w = PdfWriter()
        for _ in range(pages):
            w.add_blank_page(width=595, height=842)
        with open(out / name, "wb") as f:
            w.write(f)
    (out / "broken.pdf").write_text("이건 PDF가 아니다", encoding="utf-8")


def png_size(path: pathlib.Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "PNG 시그니처 아님"
    return struct.unpack(">II", data[16:24])



ENERGY_JS = """(canvas) => {
  const orig = document.querySelector('[data-upscale-orig]');
  const W = canvas.width, H = canvas.height;
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bc = base.getContext('2d'); bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
  bc.drawImage(orig, 0, 0, orig.width, orig.height, 0, 0, W, H);
  const energy = (ctx) => {
    const d = ctx.getImageData(0, 0, W, H).data;
    let s = 0, n = 0;
    for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
      const i = (y * W + x) * 4;
      s += Math.abs(4 * d[i] - d[(y * W + x - 1) * 4] - d[(y * W + x + 1) * 4] - d[((y - 1) * W + x) * 4] - d[((y + 1) * W + x) * 4]) / 4;
      n++;
    }
    return s / n;
  };
  return { base: +energy(bc).toFixed(3), ours: +energy(canvas.getContext('2d')).toFixed(3) };
}"""

LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
    "--single-process",
    "--no-zygote",
    "--disable-gpu",
    "--disable-features=VizDisplayCompositor",
]


def launch_with_retry(p, tries: int = 6):
    last = None
    for i in range(tries):
        try:
            return p.chromium.launch(executable_path=CHROME, args=LAUNCH_ARGS)
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(f"  · 브라우저 기동 재시도 {i + 1}/{tries}")
            time.sleep(4)
    raise SystemExit(f"브라우저를 띄우지 못했습니다: {last}")


# ── 세계시계 기대값(파이썬 zoneinfo) ──────────────────────────────────
SESSIONS = {
    "krx": ("Asia／Seoul".replace("／", "/"), [(540, 930)]),
    "us": ("America/New_York", [(240, 570), (570, 960), (960, 1200)]),
    "jp": ("Asia/Tokyo", [(540, 690), (750, 930)]),
    "lse": ("Europe/London", [(480, 990)]),
    "eu": ("Europe/Paris", [(540, 1050)]),
}


def expected_local(key: str, when: dt.datetime) -> tuple[str, str, int]:
    tz, sessions = SESSIONS[key]
    local = when.astimezone(ZoneInfo(tz))
    hhmmss = local.strftime("%H:%M:%S")
    minutes = local.hour * 60 + local.minute + local.second / 60
    if local.weekday() >= 5:
        status = "weekend"
    elif any(a <= minutes < b for a, b in sessions):
        status = "open"
    elif minutes < sessions[0][0]:
        status = "pre"
    elif minutes >= sessions[-1][1]:
        status = "after"
    else:
        status = "lunch"
    offset = int(local.utcoffset().total_seconds() // 60)
    return hhmmss, status, offset


def seconds_to_boundary(key: str, when: dt.datetime) -> float:
    """지금이 경계(개장·마감)에 얼마나 가까운지 — 상태 비교의 허용 오차에 쓴다"""
    tz, sessions = SESSIONS[key]
    local = when.astimezone(ZoneInfo(tz))
    minutes = local.hour * 60 + local.minute + local.second / 60
    edges = [x for pair in sessions for x in pair]
    return min(abs(minutes - e) for e in edges) * 60


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    make_images(OUT)
    make_pdfs(OUT)
    httpd = serve()

    with sync_playwright() as p:
        browser = launch_with_retry(p)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=f"http://127.0.0.1:{PORT}")
        page = ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector('[data-util="image-upscale"]')
        page.wait_for_timeout(700)

        tools = {
            k: page.locator(f'[data-util="{k}"]')
            for k in ["image-upscale", "url-shortener", "pdf-merge-split", "market-world-clock"]
        }
        for k, loc in tools.items():
            check(f"{k} 렌더", loc.count() == 1)
        for k in ["image-upscale", "pdf-merge-split", "market-world-clock"]:
            check(f"{k} 서버 미전송 배지", "서버 미전송" in tools[k].inner_text())
        check(
            "url-shortener 단축 서버 전송 배지(사실대로)",
            "단축 서버 전송" in tools["url-shortener"].inner_text()
            and "서버 미전송" not in tools["url-shortener"].locator("[data-util-badge]").inner_text(),
            tools["url-shortener"].locator("[data-util-badge]").inner_text(),
        )

        # ── 1. 이미지 업스케일 ─────────────────────────────────────────
        iu = tools["image-upscale"]
        iu.locator('input[type="file"]').set_input_files(str(OUT / "sample-small.png"))
        iu.locator("[data-upscale-plan]").wait_for(timeout=20000)
        page.wait_for_timeout(300)
        check("업스케일: 원본 해상도 표시", "240 × 180" in iu.locator("[data-upscale-source]").inner_text(),
              iu.locator("[data-upscale-source]").inner_text().replace("\n", " | "))
        check("업스케일: 기본 2배 계획", "480 × 360" in iu.locator("[data-upscale-plan]").inner_text(),
              iu.locator("[data-upscale-plan]").inner_text())

        iu.locator('[data-scale="4"]').click()
        page.wait_for_timeout(150)
        plan_text = iu.locator("[data-upscale-plan]").inner_text()
        check("업스케일: 4배 계획 960×720", "960 × 720" in plan_text, plan_text)
        check("업스케일: 픽셀 16배 표기", "16배" in plan_text, plan_text)
        check("업스케일: 4배 버튼 눌림 표시", iu.locator('[data-scale="4"]').get_attribute("aria-pressed") == "true")

        iu.locator("[data-upscale-run]").click()
        iu.locator("[data-upscale-download]").wait_for(timeout=60000)
        page.wait_for_timeout(300)
        canvas_info = iu.locator("[data-upscale-canvas]").evaluate(
            """(c) => {
                const ctx = c.getContext('2d');
                const red = ctx.getImageData(10, 10, 1, 1).data;
                const green = ctx.getImageData(950, 10, 1, 1).data;
                const blue = ctx.getImageData(10, 700, 1, 1).data;
                return { w: c.width, h: c.height, red: [...red].slice(0,3), green: [...green].slice(0,3), blue: [...blue].slice(0,3) };
            }"""
        )
        check("업스케일: 캔버스 960×720", (canvas_info["w"], canvas_info["h"]) == (960, 720),
              f"{canvas_info['w']}×{canvas_info['h']}")
        check("업스케일: 왼쪽 위 빨강 유지", canvas_info["red"][0] > 180 and canvas_info["red"][1] < 90, canvas_info["red"])
        check("업스케일: 오른쪽 위 초록 유지", canvas_info["green"][1] > 90 and canvas_info["green"][0] < 90, canvas_info["green"])
        check("업스케일: 왼쪽 아래 파랑 유지", canvas_info["blue"][2] > 150 and canvas_info["blue"][0] < 110, canvas_info["blue"])

        zoom = iu.locator("[data-upscale-zoom] canvas")
        check("업스케일: 1:1 비교 캔버스 2개", zoom.count() == 2, str(zoom.count()))
        if zoom.count() == 2:
            zoom_sizes = [zoom.nth(i).evaluate("(c) => [c.width, c.height]") for i in range(2)]
            check("업스케일: 비교 캔버스 240×240", all(s == [240, 240] for s in zoom_sizes), zoom_sizes)
            zoom_has_ink = zoom.nth(1).evaluate(
                """(c) => {
                    const d = c.getContext('2d').getImageData(0, 0, 240, 240).data;
                    let n = 0;
                    for (let i = 0; i < d.length; i += 4) if (d[i+3] > 0) n++;
                    return n;
                }"""
            )
            check("업스케일: 비교 캔버스에 내용 있음", zoom_has_ink > 240 * 240 * 0.9, f"{zoom_has_ink}px")

        energy = iu.locator("[data-upscale-canvas]").evaluate(ENERGY_JS)
        check(
            "업스케일: 한 번에 키운 것보다 경계가 섬(라플라시안 에너지)",
            energy["ours"] > energy["base"] * 1.15,
            f"기준선 {energy['base']} vs 우리 {energy['ours']}",
        )

        stats = iu.inner_text()
        check("업스케일: 선명화 적용 표기", "선명화 적용" in stats, [l for l in stats.split("\n") if "선명화" in l][:2])

        with page.expect_download(timeout=30000) as dl:
            iu.locator("[data-upscale-download]").click()
        down = dl.value
        png_path = OUT / "upscale-download.png"
        down.save_as(str(png_path))
        w, h = png_size(png_path)
        check("업스케일: PNG 내려받기 960×720", (w, h) == (960, 720), f"{down.suggested_filename} {w}×{h}")
        check("업스케일: 파일 이름 규칙", down.suggested_filename.startswith("buffetkimz-upscale-sample-small-4x"),
              down.suggested_filename)
        check("업스케일: 저장 안내", iu.locator("[data-upscale-saved]").count() == 1)

        # 3배(두 배씩 늘린 뒤 보정하는 경로)
        iu.locator('[data-scale="3"]').click()
        page.wait_for_timeout(150)
        check("업스케일: 3배 계획 720×540", "720 × 540" in iu.locator("[data-upscale-plan]").inner_text(),
              iu.locator("[data-upscale-plan]").inner_text())
        iu.locator("[data-upscale-run]").click()
        iu.locator("[data-upscale-download]").wait_for(timeout=60000)
        page.wait_for_timeout(200)
        dims3 = iu.locator("[data-upscale-canvas]").evaluate("(c) => [c.width, c.height]")
        check("업스케일: 3배 결과 720×540", dims3 == [720, 540], dims3)

        # 선명화가 실제로 픽셀을 바꾸는지 — 같은 사진을 켜고/끄고 두 번 처리해 서명을 비교
        iu.locator('input[type="file"]').set_input_files(str(OUT / "sample-small.png"))
        page.wait_for_timeout(800)
        iu.locator('[data-scale="2"]').click()
        page.wait_for_timeout(150)

        def signature():
            return tuple(
                iu.locator("[data-upscale-canvas]").evaluate(
                    """(c) => {
                        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                        let sum = 0, n = 0;
                        for (let i = 0; i < d.length; i += 4) { sum += d[i] + d[i+1] + d[i+2]; n += 1; }
                        return [sum, n];
                    }"""
                )
            )

        iu.locator("[data-upscale-run]").click()
        iu.locator("[data-upscale-download]").wait_for(timeout=60000)
        page.wait_for_timeout(250)
        sig_on = signature()
        check("업스케일: 선명화 켬 결과 표기", "선명화 적용" in iu.inner_text())

        iu.locator('input[type="checkbox"]').uncheck()
        page.wait_for_timeout(150)
        iu.locator("[data-upscale-run]").click()
        page.wait_for_timeout(400)
        iu.locator("[data-upscale-download]").wait_for(timeout=60000)
        page.wait_for_timeout(250)
        sig_off = signature()
        check("업스케일: 선명화 끔 결과 표기", "선명화 생략" in iu.inner_text())
        check("업스케일: 선명화가 픽셀을 실제로 바꿈", sig_on != sig_off, f"켬 {sig_on} vs 끔 {sig_off}")
        iu.locator('input[type="checkbox"]').check()
        page.wait_for_timeout(150)

        # 캔버스 한도 초과 — 만들기 전에 막는지
        iu.locator('input[type="file"]').set_input_files(str(OUT / "sample-big.png"))
        page.wait_for_timeout(1200)
        blank = iu.locator("[data-upscale-canvas]").evaluate(
            """(c) => {
                const d = c.getContext('2d').getImageData(0, 0, Math.min(60, c.width), Math.min(60, c.height)).data;
                let n = 0;
                for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
                return { w: c.width, h: c.height, ink: n };
            }"""
        )
        check("업스케일: 사진을 바꾸면 이전 결과 지움", blank["ink"] == 0, blank)
        check("업스케일: 빈 자리는 결과 비율(1800:1200)", abs(blank["w"] / blank["h"] - 1.5) < 0.02, blank)
        iu.locator('[data-scale="4"]').click()
        page.wait_for_timeout(200)
        plan_big = iu.locator("[data-upscale-plan]").inner_text()
        check("업스케일: 큰 사진 4배는 한도 초과 안내", "캔버스 한도 초과" in plan_big, plan_big)
        check("업스케일: 한도 초과면 버튼 잠김", iu.locator("[data-upscale-run]").is_disabled())
        iu.locator('[data-scale="2"]').click()
        page.wait_for_timeout(150)
        check("업스케일: 2배로 낮추면 다시 열림", not iu.locator("[data-upscale-run]").is_disabled())

        # ── 2. URL 단축기 ─────────────────────────────────────────────
        us = tools["url-shortener"]
        page.wait_for_timeout(200)
        clean_text = us.locator("[data-short-clean]").inner_text()
        check(
            "단축: UTM·fbclid 제거",
            "utm_source=" not in clean_text and "utm_medium=" not in clean_text and "fbclid=" not in clean_text,
            clean_text[-90:],
        )
        check("단축: 남은 질의 유지", "page=2" in clean_text)
        check("단축: 추적 3개 제거 표기", "추적 3개 제거" in clean_text, clean_text.split("\n")[0])

        us.locator("[data-short-input]").fill("그냥 문장")
        page.wait_for_timeout(150)
        check("단축: 잘못된 주소 안내", us.locator("[data-short-error]").count() >= 1,
              us.locator("[data-short-error]").first.inner_text())
        check("단축: 잘못된 주소면 버튼 잠김", us.locator("[data-short-run]").is_disabled())

        us.locator("[data-short-input]").fill("https://www.example.com/2026-financial-plan?utm_source=threads&page=2")
        page.wait_for_timeout(200)
        check("단축: 정리된 주소 확인", "page=2" in us.locator("[data-short-clean]").inner_text())

        with page.expect_response(re.compile(r"spoo\.me")) as resp_info:
            us.locator("[data-short-run]").click()
            us.locator("[data-short-result]").wait_for(timeout=45000)
        resp = resp_info.value
        check("단축: spoo.me 응답", resp.status == 200, resp.status)
        short_text = us.locator("[data-short-result]").inner_text()
        short_url = re.search(r"https://spoo\.me/\w+", short_text)
        check("단축: 짧은 주소 생성", bool(short_url), short_url.group(0) if short_url else short_text[:80])
        qr_src = us.locator("[data-short-qr-img]").get_attribute("src") or ""
        check("단축: QR 이미지 생성", qr_src.startswith("data:image/"), qr_src[:30])
        check("단축: 만들어진 주소 길이 비교", "자 →" in short_text, [l for l in short_text.split("\n") if "자 →" in l])

        us.locator("[data-short-result] button[data-copy-state]").click()
        page.wait_for_timeout(250)
        clip = page.evaluate("navigator.clipboard.readText()")
        check("단축: 짧은 주소 복사", bool(short_url) and clip.strip() == short_url.group(0), clip)
        check("단축: 만든 목록 1건", us.locator("[data-short-history] li").count() == 1)

        # ── 3. PDF 합치기·추출 ────────────────────────────────────────
        pdf = tools["pdf-merge-split"]
        pdf.locator('[data-pdf-merge-drop] input[type="file"]').set_input_files(
            [str(OUT / "a-2p.pdf"), str(OUT / "b-3p.pdf")]
        )
        pdf.locator("[data-pdf-merge-list] li").first.wait_for(timeout=20000)
        page.wait_for_timeout(500)
        check("PDF: 두 파일 등록", pdf.locator("[data-pdf-merge-list] li").count() == 2)
        check("PDF: 합계 5쪽", "2개 파일 · 합계 5쪽" in pdf.locator("[data-pdf-merge-count]").inner_text(),
              pdf.locator("[data-pdf-merge-count]").inner_text())

        names_before = pdf.locator("[data-pdf-merge-list] li p.font-semibold").all_inner_texts()
        pdf.locator('[data-pdf-merge-list] li').nth(1).locator("button").first.click()
        page.wait_for_timeout(200)
        names_after = pdf.locator("[data-pdf-merge-list] li p.font-semibold").all_inner_texts()
        check("PDF: 순서 바꾸기", names_before != names_after and names_after[0].startswith("b-3p"),
              f"{names_before} → {names_after}")

        with page.expect_download(timeout=30000) as dl2:
            pdf.locator("[data-pdf-merge-run]").click()
        merged = dl2.value
        merged_path = OUT / "merged.pdf"
        merged.save_as(str(merged_path))
        merged_pages = len(PdfReader(str(merged_path)).pages)
        check("PDF: 병합 파일 5쪽", merged_pages == 5, f"{merged.suggested_filename} {merged_pages}쪽")
        check("PDF: 병합 파일 이름", merged.suggested_filename.startswith("buffetkimz-merged-2files-5p"),
              merged.suggested_filename)
        check("PDF: 저장 안내", pdf.locator("[data-pdf-saved]").count() == 1)

        # 암호·손상 파일은 이유를 밝히고 멈춘다
        pdf.locator('[data-pdf-merge-drop] input[type="file"]').set_input_files(str(OUT / "broken.pdf"))
        page.wait_for_timeout(700)
        check("PDF: 손상 파일 안내", pdf.locator("[data-pdf-error]").count() >= 1,
              pdf.locator("[data-pdf-error]").first.inner_text()[:70])
        check("PDF: 손상 파일은 목록에 안 들어감", pdf.locator("[data-pdf-merge-list] li").count() == 2)

        # 추출
        pdf.locator('[role="tab"]', has_text="페이지 추출").click()
        pdf.locator("[data-pdf-split-drop]").wait_for()
        pdf.locator('[data-pdf-split-drop] input[type="file"]').set_input_files(str(OUT / "c-4p.pdf"))
        pdf.locator("[data-pdf-split-source]").wait_for(timeout=20000)
        page.wait_for_timeout(300)
        check("PDF: 추출 원본 4쪽", "4쪽" in pdf.locator("[data-pdf-split-source]").inner_text(),
              pdf.locator("[data-pdf-split-source]").inner_text())

        pdf.locator("[data-pdf-split-spec]").fill("1-3, 9")
        page.wait_for_timeout(200)
        check("PDF: 범위 초과 안내", pdf.locator("[data-pdf-spec-error]").count() == 1,
              pdf.locator("[data-pdf-spec-error]").inner_text())
        check("PDF: 범위 오류면 버튼 잠김", pdf.locator("[data-pdf-split-run]").is_disabled())

        pdf.locator("[data-pdf-split-spec]").fill("1-2, 4")
        page.wait_for_timeout(200)
        check("PDF: 추출 3쪽 예정", "3쪽 추출 예정" in pdf.locator("[data-pdf-spec-ok]").inner_text(),
              pdf.locator("[data-pdf-spec-ok]").inner_text())

        with page.expect_download(timeout=30000) as dl3:
            pdf.locator("[data-pdf-split-run]").click()
        split = dl3.value
        split_path = OUT / "split.pdf"
        split.save_as(str(split_path))
        split_pages = len(PdfReader(str(split_path)).pages)
        check("PDF: 추출 파일 3쪽", split_pages == 3, f"{split.suggested_filename} {split_pages}쪽")
        check("PDF: 추출 파일 이름에 페이지", "p1-2_4" in split.suggested_filename, split.suggested_filename)

        # ── 4. 세계시계 ──────────────────────────────────────────────
        wc = tools["market-world-clock"]
        check("시계: 다섯 거래소", wc.locator("[data-market-row]").count() == 5,
              str(wc.locator("[data-market-row]").count()))

        now_real = dt.datetime.now(dt.timezone.utc)
        for key in ["krx", "us", "jp", "lse", "eu"]:
            row = wc.locator(f'[data-market-row="{key}"]')
            shown_time = row.locator("[data-market-time]").inner_text().strip()
            exp_time, exp_status, exp_offset = expected_local(key, now_real)
            # 초 단위로 읽는 사이 흐를 수 있어 |차이| 3초까지 허용
            def to_sec(t: str) -> int:
                h, m, s = (int(x) for x in t.split(":"))
                return h * 3600 + m * 60 + s

            diff = abs(to_sec(shown_time) - to_sec(exp_time))
            diff = min(diff, 86400 - diff)
            check(f"시계 {key}: 현지 시각 일치({exp_time[0:5]})", diff <= 3, f"{shown_time} vs {exp_time}")

            status_text = row.locator("[data-market-status]").inner_text()
            near = seconds_to_boundary(key, now_real) < 90
            expect_map = {"open": "진행 중", "weekend": "주말", "pre": "개장 전", "after": "마감", "lunch": "휴장"}
            ok_status = expect_map[exp_status] in status_text
            check(f"시계 {key}: 상태({expect_map[exp_status]})", ok_status or near, f"{status_text} 기대 {exp_status}")

            cd = row.locator("[data-market-countdown]").inner_text().strip()
            check(f"시계 {key}: 카운트다운 형식", bool(re.search(r"(\d+일|\d+시간|\d+분|\d+초)", cd)), cd)

        t1 = wc.locator('[data-market-row="krx"] [data-market-time]').inner_text()
        page.wait_for_timeout(1500)
        t2 = wc.locator('[data-market-row="krx"] [data-market-time]').inner_text()
        check("시계: 1초마다 흐름", t1 != t2, f"{t1} → {t2}")

        winter_text = wc.inner_text()
        check("시계: 11월에는 서머타임 아님", "서머타임 중" not in winter_text)

        seoul = wc.locator("[data-clock-seoul]").inner_text()
        check("시계: 한국 시간 표시", re.search(r"\d{2}:\d{2}:\d{2}", seoul) is not None, seoul)

        page.screenshot(path=str(OUT / "preview-desktop.png"), full_page=True)
        for k, loc in tools.items():
            loc.screenshot(path=str(OUT / f"tool-{k}.png"))

        # 모바일 폭 — 가로 넘침 없이 접히는지
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(600)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check("모바일 390: 가로 넘침 없음", overflow <= 1, f"{overflow}px")
        for k, loc in tools.items():
            o = loc.evaluate("(el) => el.scrollWidth - el.clientWidth")
            check(f"모바일 390: {k} 내부 넘침 없음", o <= 1, f"{o}px")
        wc.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / "preview-mobile.png"), full_page=False)

        # ── 여름 날짜(서머타임)로 같은 화면 확인 ─────────────────────
        # 이 환경은 --single-process라 두 번째 컨텍스트가 죽는다 — 같은 페이지에 시계를 심고 다시 연다.
        page.set_viewport_size({"width": 1280, "height": 900})
        summer = dt.datetime(2026, 7, 15, 12, 0, 0, tzinfo=dt.timezone.utc)
        page.clock.install(time=summer)
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector('[data-market-row="us"] [data-market-time]')
        page.wait_for_timeout(400)
        for key, tz, expect_off in [
            ("us", "America/New_York", -240),
            ("lse", "Europe/London", 60),
            ("eu", "Europe/Paris", 120),
        ]:
            shown = page.locator(f'[data-market-row="{key}"] [data-market-time]').inner_text().strip()
            exp = summer.astimezone(ZoneInfo(tz)).strftime("%H:%M:%S")
            off = int(summer.astimezone(ZoneInfo(tz)).utcoffset().total_seconds() // 60)
            check(
                f"서머타임 {key}: {exp[0:5]} (UTC{expect_off // 60:+d})",
                shown[0:5] == exp[0:5] and off == expect_off,
                f"{shown} vs {exp} (offset {off})",
            )
        summer_text = page.locator('[data-util="market-world-clock"]').inner_text()
        check(
            "서머타임 표기: 여름에는 세 곳 모두 '서머타임 중'",
            summer_text.count("서머타임 중") >= 3,
            summer_text.count("서머타임 중"),
        )

        # 콘솔 오류 0
        check("콘솔 오류 0건", len(errors) == 0, " / ".join(errors[:3]))
        if errors:
            print("   콘솔:", errors[:5])

        browser.close()

    httpd.shutdown()
    report = {
        "when": dt.datetime.now().isoformat(timespec="seconds"),
        "total": len(results),
        "passed": sum(1 for r in results if r["ok"]),
        "failed": [r for r in results if not r["ok"]],
        "results": results,
    }
    (OUT / "test-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{report['passed']}/{report['total']} 통과 — reports/utils-d/test-report.json")
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
