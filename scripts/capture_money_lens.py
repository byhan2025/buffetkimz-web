"""「돈의 나이테」 캡처·동작 점검 — 2026-11-26.

  python3 scripts/capture_money_lens.py local   # dist를 로컬 서빙하며 점검
  python3 scripts/capture_money_lens.py live    # byhan2025.github.io 라이브 점검

찍는 것: /money-lens/ 1280·390, /apps/money-ring/run 1280·390 (라이브는 brief의 3장 이름으로도 저장)
함께 재는 것: 가로 넘침(px) · 콘솔 오류 · 탭 전환 · 퀴즈 해설 노출 · 0원 입력 시 '입력 부족'
"""
import os
import pathlib
import sys
import threading
import http.server
import socketserver

import sys as _sys
_sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web"
IMGS = OUT / "money-lens-shots"
IMGS.mkdir(parents=True, exist_ok=True)
PORT = 8199
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
failures = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
        args=["--no-sandbox"],
    )

    def shoot(path: str, width: int, name: str, full: bool):
        pg = browser.new_page(viewport={"width": width, "height": 844 if width < 700 else 1000}, locale="ko-KR")
        errs: list[str] = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base + path, wait_until="networkidle")
        pg.wait_for_timeout(900)
        overflow = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        pg.screenshot(path=str(IMGS / f"{name}-{width}.png"), full_page=full)
        if overflow > 0:
            failures.append(f"{name} {width}px 가로 넘침 {overflow}px")
        if errs:
            failures.append(f"{name} {width}px 콘솔 오류 {errs[:2]}")
        return pg

    # 1) 시세판 — 기본(10년 전 탭)
    pg = shoot("/money-lens/", 1280, "lens-1280", True)
    # 탭 전환: 5년 전 → 오늘
    for label in ("5년 전 1억", "오늘"):
        pg.get_by_role("button", name=label, exact=True).first.click()
        pg.wait_for_timeout(500)
    body = pg.inner_text("body")
    if "오늘 값" not in body:
        failures.append("money-lens: '오늘' 탭 표가 그려지지 않음")
    pg.get_by_role("button", name="10년 전 1억", exact=True).first.click()
    pg.wait_for_timeout(400)
    if "−62.5%" not in pg.inner_text("body"):
        failures.append("money-lens: 10년 전 탭에 금 기준 −62.5%가 없음")
    pg.close()

    shoot("/money-lens/", 390, "lens-390", False).close()

    # 2) 퀴즈 — 보기 클릭 시 해설 노출
    pg = shoot("/money-lens/", 1280, "quiz-1280", True)
    quiz = pg.locator("[data-lens-quiz]")
    quiz.scroll_into_view_if_needed()
    quiz.get_by_role("button", name="0.5% 줄었다").first.click()
    pg.wait_for_timeout(400)
    if "맞았습니다" not in quiz.inner_text():
        failures.append("퀴즈: 정답 클릭 뒤 해설이 열리지 않음")
    pg.close()

    # 3) 진단기 — 예시값 결과
    pg = shoot("/apps/money-ring/run", 1280, "ring-1280", True)
    txt = pg.inner_text("body")
    if "진단 유형" not in txt:
        failures.append("money-ring: 예시값 결과 카드가 없음")
    # 0원·문자 입력 → '입력 부족'
    pg.fill("#mr-monthly", "0")
    pg.fill("#mr-cash", "abc")
    pg.wait_for_timeout(400)
    if "입력 부족" not in pg.inner_text("[data-money-ring-result]"):
        failures.append("money-ring: 0원·문자 입력에서 '입력 부족' 상태가 아님")
    pg.close()

    shoot("/apps/money-ring/run", 390, "ring-390", False).close()

    browser.close()

if httpd:
    httpd.shutdown()

print("모드:", MODE)
if failures:
    print("실패", len(failures))
    for f in failures:
        print(" ✗", f)
    sys.exit(1)
print("통과 — 캡처", IMGS)
