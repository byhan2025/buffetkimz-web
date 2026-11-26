"""「돈의 나이테」 대시보드 캡처·동작 점검 — 2026-11-26 개편 검수용.

  python3 scripts/capture_lens_dashboard.py local   # dist를 로컬 서빙(기본)
  python3 scripts/capture_lens_dashboard.py live    # 배포 뒤 라이브 확인

찍는 것
  · reports/buffetkimz-web/money-lens-hero-1280.png / money-lens-hero-390.png
    — **첫 화면 뷰포트 그대로**(스크롤 없이 원화의 달러·금 위치가 보이는지 눈으로 보려고)
  · reports/buffetkimz-web/money-lens-shots/dash-full-1280.png / dash-full-390.png — 전체 길이
  · 탭(5년·오늘) 화면, 프리셋 진단 결과

재는 것
  · 첫 화면(스크롤 0) 안에 '서울 아파트' 카드의 원화·달러·금 세 줄이 들어오는가
  · 390px 가로 넘침 0 · 콘솔 오류 0 · 모바일 전체 높이(px)
  · 프리셋 클릭 → 순자산 달러 환산이 결과에 뜨는가 · 탭 전환 결과가 바뀌는가
"""
from __future__ import annotations

import http.server
import pathlib
import socketserver
import sys
import threading

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web"
SHOTS = OUT / "money-lens-shots"
PORT = 8231
PREFIX = "/buffetkimz-web"
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(DIST), **k)

    def translate_path(self, path):  # noqa: N802
        path = path.split("?", 1)[0].split("#", 1)[0]
        if path == PREFIX:
            path = "/"
        elif path.startswith(PREFIX + "/"):
            path = path[len(PREFIX):]
        return super().translate_path(path)

    def log_message(self, *a):
        pass


def start_local():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


base = f"http://127.0.0.1:{PORT}{PREFIX}" if MODE == "local" else LIVE
httpd = start_local() if MODE == "local" else None
OUT.mkdir(parents=True, exist_ok=True)
SHOTS.mkdir(parents=True, exist_ok=True)
failures: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
        args=["--no-sandbox"],
    )

    def page_at(width: int, height: int):
        pg = browser.new_page(viewport={"width": width, "height": height}, locale="ko-KR")
        errs: list[str] = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base + "/money-lens/", wait_until="domcontentloaded")
        pg.wait_for_timeout(3500)
        mine = [e for e in errs if "tradingview" not in e.lower()]
        if mine:
            failures.append(f"{width}px 콘솔 오류 {mine[:2]}")
        overflow = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        if overflow > 0:
            failures.append(f"{width}px 가로 넘침 {overflow}px")
        return pg

    # ── 1280 첫 화면
    pg = page_at(1280, 900)
    pg.screenshot(path=str(OUT / "money-lens-hero-1280.png"), full_page=False)
    visible = pg.evaluate(
        """() => {
          const card = document.querySelector('[data-lens-gauge-card="seoul-apt"]');
          if (!card) return null;
          const r = card.getBoundingClientRect();
          const vh = window.innerHeight;
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh };
        }"""
    )
    if not visible:
        failures.append("1280: 첫 카드(서울 아파트)를 찾지 못함")
    elif visible["bottom"] > visible["vh"]:
        failures.append(f"1280: 첫 카드가 첫 화면 밖 (bottom {visible['bottom']} > vh {visible['vh']})")
    hero_text = pg.inner_text("section")
    if "74,493" not in pg.content() or "566.6" not in pg.content():
        failures.append("1280: 첫 화면에 74,493달러·566.6g가 없음")

    # 탭 전환 — 5년 / 오늘
    pg.get_by_role("button", name="5년", exact=True).first.click()
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(SHOTS / "dash-1280-y5.png"), full_page=False)
    y5 = pg.inner_text('[data-lens-gauge-card="seoul-apt"]')
    pg.get_by_role("button", name="오늘", exact=True).first.click()
    pg.wait_for_timeout(400)
    now_txt = pg.inner_text("[data-lens-board]")
    if "566.6" not in now_txt or "74,493" not in now_txt:
        failures.append("'오늘' 탭에 1억 기준 환산이 없음")
    pg.get_by_role("button", name="10년", exact=True).first.click()
    pg.wait_for_timeout(300)
    y10 = pg.inner_text('[data-lens-gauge-card="seoul-apt"]')
    if y5 == y10:
        failures.append("10년/5년 탭 결과가 같음(탭이 동작하지 않음)")
    pg.screenshot(path=str(SHOTS / "dash-full-1280.png"), full_page=True)
    h1280 = pg.evaluate("() => document.documentElement.scrollHeight")
    pg.close()

    # ── 390 첫 화면
    pg = page_at(390, 844)
    pg.screenshot(path=str(OUT / "money-lens-hero-390.png"), full_page=False)
    vis = pg.evaluate(
        """() => {
          const card = document.querySelector('[data-lens-gauge-card="seoul-apt"]');
          if (!card) return null;
          const r = card.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
        }"""
    )
    if not vis:
        failures.append("390: 첫 카드를 찾지 못함")
    elif vis["top"] > vis["vh"]:
        failures.append(f"390: 첫 카드가 첫 화면 아래에서 시작 (top {vis['top']})")

    # 프리셋 진단
    diag = pg.locator("[data-lens-diagnose]")
    diag.scroll_into_view_if_needed()
    pg.wait_for_timeout(1200)
    pg.get_by_role("button", name="예금 1억", exact=True).first.click()
    pg.wait_for_timeout(600)
    res = pg.inner_text("[data-lens-diagnose-result]")
    if "내 순자산" not in res or "달러" not in res:
        failures.append(f"프리셋 '예금 1억' 결과에 순자산·달러 환산이 없음: {res[:80]}")
    if "자는 돈이 두꺼운 나무" not in res:
        failures.append(f"예금 1억 프리셋 유형이 '자는 돈이 두꺼운 나무'가 아님: {res[:120]}")
    pg.get_by_role("button", name="서울 집 7억 + 대출 3억", exact=True).first.click()
    pg.wait_for_timeout(600)
    res2 = pg.inner_text("[data-lens-diagnose-result]")
    if "집 한 그루" not in res2:
        failures.append(f"집 프리셋 유형이 '집 한 그루'가 아님: {res2[:120]}")
    pg.get_by_role("button", name="직장인 3억 분산", exact=True).first.click()
    pg.wait_for_timeout(600)
    res3 = pg.inner_text("[data-lens-diagnose-result]")
    if "고른 나이테" not in res3:
        failures.append(f"분산 프리셋 유형이 '고른 나이테'가 아님: {res3[:120]}")
    pg.screenshot(path=str(SHOTS / "dash-390-diagnose.png"), full_page=False)
    pg.screenshot(path=str(SHOTS / "dash-full-390.png"), full_page=True)
    h390 = pg.evaluate("() => document.documentElement.scrollHeight")
    pg.close()

    browser.close()

if httpd:
    httpd.shutdown()

print(f"모드 {MODE} · 1280 높이 {h1280}px · 390 높이 {h390}px (목표 5,000px 전후)")
print("첫 화면 캡처:", OUT / "money-lens-hero-1280.png", OUT / "money-lens-hero-390.png")
if failures:
    print("실패", len(failures))
    for f in failures:
        print(" ✗", f)
    sys.exit(1)
print("통과")
