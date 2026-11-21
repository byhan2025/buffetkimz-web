#!/usr/bin/env python3
"""유용한앱 2탄(8종) 실제 동작 검수 — Playwright.

빌드된 `dist/`를 로컬로 띄우고 `/utils-b-preview`에서 8개 도구를 실제로 조작한다.
입력 → 결과 숫자/문자 → 복사(클립보드) → 이미지 다운로드(PNG 크기·픽셀)까지 확인한다.

사용:
  PATH=/workspace/.tools/node-v22.23.4-linux-x64/bin:$PATH npm run build
  python3 scripts/test_utils_b.py
결과: reports/utils-b/test-report.json + 스크린샷 PNG
"""
from __future__ import annotations

import http.server
import json
import pathlib
import re
import socketserver
import struct
import threading

from playwright.sync_api import sync_playwright

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP / "reports" / "utils-b"
PORT = 8141
CHROME = "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
URL = f"http://127.0.0.1:{PORT}/utils-b-preview/"

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


def make_test_image(path: pathlib.Path) -> None:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (240, 180), "#ffffff")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 119, 89], fill="#e02020")
    d.rectangle([120, 0, 239, 89], fill="#1f7a62")
    d.rectangle([0, 90, 119, 179], fill="#2c7be0")
    d.rectangle([120, 90, 239, 179], fill="#f2c14e")
    d.rectangle([0, 150, 239, 179], fill="#333333")
    img.save(path)

    grad = Image.new("RGB", (300, 300))
    px = grad.load()
    for y in range(300):
        for x in range(300):
            px[x, y] = (int(255 * x / 299), int(255 * y / 299), int(255 * (1 - x / 299)))
    grad.save(path.with_name("sample-gradient.png"))


def png_size(path: pathlib.Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "PNG 시그니처 아님"
    w, h = struct.unpack(">II", data[16:24])
    return w, h


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
    """이 환경은 동시 실행이 많으면 스레드를 못 만들어 브라우저가 죽는다 — 몇 번 다시 띄운다."""
    import time

    last = None
    for i in range(tries):
        try:
            return p.chromium.launch(executable_path=CHROME, args=LAUNCH_ARGS)
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(f"  · 브라우저 기동 재시도 {i + 1}/{tries}")
            time.sleep(4)
    raise SystemExit(f"브라우저를 띄우지 못했습니다: {last}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    make_test_image(OUT / "sample-4colors.png")
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
        page.wait_for_selector('[data-util="text-counter"] textarea')
        page.wait_for_timeout(700)

        tools = {
            k: page.locator(f'[data-util="{k}"]')
            for k in [
                "text-counter",
                "privacy-masker",
                "json-csv-formatter",
                "password-generator",
                "diff-checker",
                "color-extractor",
                "text-to-card",
                "unit-date-calc",
            ]
        }
        for k, loc in tools.items():
            check(f"{k} 렌더", loc.count() == 1)
            check(f"{k} 서버 미전송 배지", "서버 미전송" in loc.inner_text())

        # ── 1. 글자수·스레드 분할 ───────────────────────────────────────
        tc = tools["text-counter"]
        ta = tc.locator("textarea").first
        ta.fill("가나다라마")
        page.wait_for_timeout(120)
        stats_text = tc.locator("[data-counter-stats]").inner_text()
        check("글자수: 공백 포함 5자", "공백 포함\n5자" in stats_text or "5자" in stats_text, stats_text.replace("\n", " | "))
        check("글자수: 원고지 1매", "1매" in stats_text)

        long_text = " ".join(["보험은 가입할 때보다 청구할 때 어렵습니다." for _ in range(60)])
        ta.fill(long_text)
        page.wait_for_timeout(200)
        items = tc.locator("[data-thread-item]")
        n_chunks = items.count()
        check("스레드 분할: 2편 이상", n_chunks >= 2, f"{n_chunks}편")
        first_len = len(items.first.locator("p").first.inner_text())
        check("스레드 분할: 편 길이 500자 이하", first_len <= 500, f"{first_len}자")
        joined = "".join(items.locator("p").all_inner_texts())
        check(
            "스레드 분할: 전체 글자 보존(공백 정규화)",
            re.sub(r"\s+", "", joined) == re.sub(r"\s+", "", long_text),
            f"{len(joined)}자 / 원문 {len(long_text)}자",
        )

        items.first.locator("button[data-copy-state]").click()
        page.wait_for_timeout(200)
        clip = page.evaluate("navigator.clipboard.readText()")
        check("스레드: 첫 편 복사", clip.strip() == items.first.locator("p").first.inner_text().strip())

        # ── 2. 개인정보 가리기 ─────────────────────────────────────────
        pm = tools["privacy-masker"]
        masked = pm.locator("[data-output-box]").inner_text()
        for expect in ["010-****-5678", "900101-1******", "1234-****-****-3456", "110-***-***789", "02-***-6789"]:
            check(f"마스킹: {expect}", expect in masked, "")
        check("마스킹: 이메일 아이디 가림", re.search(r"mi\*+@gmail\.com", masked) is not None, masked)
        total = pm.locator("[data-mask-total]").inner_text()
        check("마스킹: 6건 탐지(휴대폰·사무실)", total.strip().endswith("6건"), total.strip())
        kind_chips = pm.locator("[data-mask-kind]").count()
        check("마스킹: 유형 5종 표시", kind_chips == 5, str(kind_chips))
        pm.locator("button[data-copy-state]").first.click()
        page.wait_for_timeout(200)
        check("마스킹: 복사본 클립보드", page.evaluate("navigator.clipboard.readText()").startswith("[상담 접수]"))

        pm.screenshot(path=str(OUT / "tool-privacy-masker-filled.png"))
        pm.locator("button", has_text="지우기").click()
        page.wait_for_timeout(150)
        check("마스킹: 빈 입력이면 0건", "0건" in pm.locator("[data-mask-total]").inner_text())

        # ── 3. JSON·CSV ───────────────────────────────────────────────
        df = tools["json-csv-formatter"]
        df.locator("button", has_text="예시").first.click()
        page.wait_for_timeout(150)
        out = df.locator("[data-output-box]").first.inner_text()
        check("JSON: 들여쓰기 결과", '"portfolio": [' in out and "\n  " in out, out[:40].replace("\n", "⏎"))
        check("JSON: 문법 오류 없음", df.locator("[data-json-error]").count() == 0)

        df.locator("button", has_text="한 줄로 압축").click()
        page.wait_for_timeout(150)
        mini = df.locator("[data-output-box]").first.inner_text()
        check("JSON: 한 줄 압축", "\n" not in mini.strip() and len(mini) > 40, f"{len(mini)}자")

        df.locator("textarea").first.fill('{"a": 1,, }')
        page.wait_for_timeout(150)
        check("JSON: 문법 오류 안내", df.locator("[data-json-error]").count() == 1, df.locator("[data-json-error]").inner_text()[:60])

        df.locator("textarea").first.fill('{"a": 1}')
        df.locator('[role="tab"]', has_text="CSV ↔ 마크다운 표").click()
        page.wait_for_timeout(200)
        md = df.locator("[data-output-box]").first.inner_text()
        check("CSV→표: 머리행 문법", "| 계좌 | 세율 | 한도 | 비고 |" in md, md.split("\n")[0] if md else "")
        check("CSV→표: 정렬 줄", "| --- |" in md)
        rows = df.locator("[data-md-preview] tbody tr").count()
        check("CSV→표: 미리보기 3행", rows == 3, f"{rows}행")
        check("CSV→표: 칸 안 쉼표 보존", "소득 5,500만원 이하 기준" in md)

        df.locator("button", has_text="마크다운 표 → CSV").click()
        page.wait_for_timeout(200)
        df.locator("textarea").first.fill("| 이름 | 금액 | 비고 |\n| --- | --- | --- |\n| 연금저축 | 600만원 | 소득 5,500만원 이하 |")
        page.wait_for_timeout(200)
        back = df.locator("[data-output-box]").first.inner_text()
        check("표→CSV: 결과", back.split("\n")[0] == "이름,금액,비고", back.split("\n")[0] if back else "")
        check("표→CSV: 쉼표 칸 따옴표", '"소득 5,500만원 이하"' in back, back)

        # ── 4. 비밀번호 ───────────────────────────────────────────────
        pg = tools["password-generator"]
        pw1 = pg.locator("[data-pw-value]").inner_text().strip()
        check("비밀번호: 16자", len(pw1) == 16, pw1)
        check("비밀번호: 네 종류 포함", bool(re.search(r"[A-Z]", pw1)) and bool(re.search(r"[a-z]", pw1)) and bool(re.search(r"\d", pw1)) and bool(re.search(r"[^A-Za-z0-9]", pw1)), pw1)
        pg.locator("[data-pw-regenerate]").click()
        page.wait_for_timeout(150)
        pw2 = pg.locator("[data-pw-value]").inner_text().strip()
        check("비밀번호: 다시 만들기", pw1 != pw2 and len(pw2) == 16, pw2)
        listed = [t.strip() for t in pg.locator("[data-pw-item]").all_inner_texts()]
        check("비밀번호: 5개 목록", pg.locator("[data-pw-list] li").count() == 5, str(pg.locator("[data-pw-list] li").count()))
        check("비밀번호: 목록도 16자", len(listed) == 5 and all(len(t) == 16 for t in listed), str([(t, len(t)) for t in listed]))
        level = pg.locator("[data-pw-level]").inner_text()
        check("비밀번호: 강도 표시", "비트" in level and ("강함" in level or "보통" in level), level)

        slider = pg.locator('input[type="range"]').first
        slider.fill("32")
        page.wait_for_timeout(150)
        check("비밀번호: 길이 32자", len(pg.locator("[data-pw-value]").inner_text().strip()) == 32, pg.locator("[data-pw-value]").inner_text().strip())
        slider.fill("16")

        # ── 5. 두 글 비교 ─────────────────────────────────────────────
        dc = tools["diff-checker"]
        page.wait_for_timeout(200)
        stats = dc.locator("[data-diff-stats]").inner_text().replace("\n", " ")
        check("비교: 삭제·추가 요약", "삭제·변경" in stats and "추가·변경" in stats, stats)
        marks = dc.locator("[data-diff-table] span[class*='bg-[#f4c9d3]']").count()
        adds = dc.locator("[data-diff-table] span[class*='bg-[#c6e6d5]']").count()
        check("비교: 삭제 단어 강조", marks >= 1, f"{marks}개")
        check("비교: 추가 단어 강조", adds >= 1, f"{adds}개")
        before_rows = dc.locator("[data-diff-table] > div > div").count()
        dc.locator("button", has_text="바뀐 줄만 보기").click()
        page.wait_for_timeout(150)
        after_rows = dc.locator("[data-diff-table] > div > div").count()
        check("비교: 바뀐 줄만 보기", after_rows < before_rows, f"{before_rows}→{after_rows}")
        dc.locator("button", has_text="바뀐 줄만 보기").click()

        a_text = dc.locator("textarea").nth(0)
        b_text = dc.locator("textarea").nth(1)
        same = a_text.input_value()
        b_text.fill(same)
        page.wait_for_timeout(150)
        check("비교: 같으면 안내", "두 글이 같습니다" in dc.inner_text())
        dc.locator("button", has_text="예시").click()
        page.wait_for_timeout(150)

        # ── 6. 이미지 대표색 ─────────────────────────────────────────
        ce = tools["color-extractor"]
        ce.locator('input[type="file"]').set_input_files(str(OUT / "sample-4colors.png"))
        ce.locator("[data-color-swatches] li").first.wait_for(timeout=20000)
        page.wait_for_timeout(400)
        swatches = ce.locator("[data-color-swatches] li").count()
        check("대표색: 최대 6개", 5 <= swatches <= 6, f"{swatches}개")
        hexes = [ce.locator("[data-color-swatches] li").nth(i).locator("button").get_attribute("data-color-hex") for i in range(swatches)]
        hexes = [h for h in hexes if h]
        image_hex = " ".join(hexes)
        check("대표색: 빨강 계열 포함", any(h.startswith("#E") or h.startswith("#D") for h in hexes), image_hex)
        check("대표색: 초록 계열 포함", any(h.startswith("#1F") or h.startswith("#20") or h.startswith("#21") for h in hexes), image_hex)
        check("대표색: 파랑 계열 포함", any(h.startswith("#2C") or h.startswith("#2D") or h.startswith("#2B") for h in hexes), image_hex)
        check("대표색: 파일명·크기 표시", "240×180" in ce.locator("[data-color-name]").inner_text(), ce.locator("[data-color-name]").inner_text())
        ce.locator("[data-color-swatches] li").first.locator("button").click()
        page.wait_for_timeout(200)
        clip = page.evaluate("navigator.clipboard.readText()")
        check("대표색: 눌러서 HEX 복사", clip.startswith("#") and len(clip) == 7, clip)

        ce.locator('input[type="file"]').set_input_files(str(OUT / "sample-gradient.png"))
        page.wait_for_timeout(800)
        grad_count = ce.locator("[data-color-swatches] li").count()
        check("대표색: 그라데이션에서 6개", grad_count == 6, f"{grad_count}개")
        labels = re.findall(r"(\d+)%", " ".join(ce.locator("[data-color-swatches]").all_inner_texts()))
        ratios = [int(v) for v in labels]
        check("대표색: 비중 합 100%", 85 <= sum(ratios) <= 100, f"{ratios} 합 {sum(ratios)}")
        check("대표색: 0% 표시 없음", all(v > 0 for v in ratios), str(ratios))

        # ── 7. 텍스트 → 카드 ────────────────────────────────────────
        tl = tools["text-to-card"]
        page.wait_for_timeout(500)
        canvas_info = tl.locator("[data-card-canvas]").evaluate(
            """(c) => {
                const ctx = c.getContext('2d');
                const p = ctx.getImageData(5, 5, 1, 1).data;
                const mid = ctx.getImageData(400, 500, 1, 1).data;
                return { w: c.width, h: c.height, bg: [p[0], p[1], p[2]], mid: [mid[0], mid[1], mid[2]], len: c.toDataURL().length };
            }"""
        )
        check("카드: 1080×1350", canvas_info["w"] == 1080 and canvas_info["h"] == 1350, f"{canvas_info['w']}×{canvas_info['h']}")
        check("카드: 배경이 다크", canvas_info["bg"] == [11, 27, 41], canvas_info["bg"])
        check("카드: 캔버스에 내용 있음", canvas_info["len"] > 20000, f"dataURL {canvas_info['len']}자")

        with page.expect_download(timeout=15000) as dl:
            tl.locator("[data-card-download]").click()
        download = dl.value
        png_path = OUT / "card-download.png"
        download.save_as(str(png_path))
        w, h = png_size(png_path)
        check("카드: PNG 내려받기", download.suggested_filename.startswith("buffetkimz-card-dark-") and (w, h) == (1080, 1350), f"{download.suggested_filename} {w}×{h}")
        check("카드: 저장 안내 표시", tl.locator("[data-card-saved]").count() == 1)

        tl.locator("button", has_text="크림").click()
        page.wait_for_timeout(400)
        cream_bg = tl.locator("[data-card-canvas]").evaluate(
            "(c) => Array.from(c.getContext('2d').getImageData(5, 5, 1, 1).data).slice(0, 3)"
        )
        check("카드: 테마 바뀌면 배경도 바뀜", cream_bg == [250, 247, 239], cream_bg)

        # ── 8. 날짜·단위 ────────────────────────────────────────────
        ud = tools["unit-date-calc"]
        page.wait_for_timeout(200)
        dday = ud.locator("[data-dday]").inner_text().strip()
        check("날짜: D-100 기본", dday.startswith("D-100"), dday)
        days = ud.locator("[data-days]").inner_text().strip()
        check("날짜: 두 날짜 사이 100일", days == "100일", days)
        import datetime as dt

        start = dt.date(2026, 11, 21)
        end = dt.date(2027, 3, 1)
        biz = sum(1 for i in range((end - start).days + 1) if (start + dt.timedelta(days=i)).weekday() < 5)
        shown_biz = ud.locator("[data-business]").inner_text().strip()
        check("날짜: 영업일 계산", shown_biz == f"{biz:,}일", f"{shown_biz} (기대 {biz})")

        ud.locator('input[type="date"]').nth(1).fill("2026-11-30")
        page.wait_for_timeout(150)
        check("날짜: 종료일 바꾸면 즉시 반영", ud.locator("[data-days]").inner_text().strip() == "9일", ud.locator("[data-days]").inner_text().strip())
        ud.locator('input[type="date"]').nth(1).fill("2027-03-01")

        ud.locator('[role="tab"]', has_text="단위 변환").click()
        page.wait_for_timeout(200)
        pyeong = ud.locator('[data-unit="pyeong"] input').nth(0)
        pyeong.fill("34")
        page.wait_for_timeout(120)
        m2 = ud.locator('[data-unit="pyeong"] input').nth(1).input_value()
        check("단위: 34평→㎡", abs(float(m2.replace(",", "")) - 34 * 400 / 121) < 0.001, m2)
        inch_row = ud.locator('[data-unit="inch"] input')
        inch_row.nth(0).fill("10")
        page.wait_for_timeout(100)
        check("단위: 10in→cm", inch_row.nth(1).input_value().startswith("25.4"), inch_row.nth(1).input_value())
        inch_row.nth(1).fill("100")
        page.wait_for_timeout(100)
        check("단위: 100cm→in", inch_row.nth(0).input_value().startswith("39.37"), inch_row.nth(0).input_value())
        data_row = ud.locator('[data-unit="data"] input')
        data_row.nth(0).fill("1024")
        page.wait_for_timeout(100)
        check("단위: 1024MB→GB", data_row.nth(1).input_value() in ("1", "1.0"), data_row.nth(1).input_value())

        # ── 화면 캡처 + 콘솔 오류 ──────────────────────────────────
        page.screenshot(path=str(OUT / "preview-desktop.png"), full_page=True)
        for k, loc in tools.items():
            loc.screenshot(path=str(OUT / f"tool-{k}.png"))

        # 모바일 폭 — 가로 넘침 없이 2열이 1열로 접히는지
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(500)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check("모바일 390: 가로 넘침 없음", overflow <= 1, f"{overflow}px")
        page.screenshot(path=str(OUT / "preview-mobile.png"), full_page=False)
        for k in ["text-counter", "privacy-masker", "diff-checker"]:
            tools[k].screenshot(path=str(OUT / f"tool-{k}-390.png"))

        real_errors = [e for e in errors if "favicon" not in e.lower()]
        check("콘솔 오류 없음", len(real_errors) == 0, "; ".join(real_errors[:3]))

        browser.close()
    httpd.shutdown()

    passed = sum(1 for r in results if r["ok"])
    (OUT / "test-report.json").write_text(
        json.dumps({"total": len(results), "passed": passed, "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n{passed}/{len(results)} 통과 — {OUT / 'test-report.json'}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
