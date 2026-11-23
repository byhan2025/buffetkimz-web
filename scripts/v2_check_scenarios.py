"""v8.8.0 — 통합 도구의 계산이 실제로 도는지(시나리오) 로컬 dist에서 확인한다.

탭으로 옮긴 계산기(연금 개시일·예금·시급·3.3%·이사 D-day)에 값을 넣어 결과가 바뀌는지 본다.
사용: python3 scripts/v2_check_scenarios.py   (먼저 `bash scripts/build_with_lock.sh build` — 루트 빌드)
"""
import json
import pathlib
import socketserver
import http.server
import sys
import threading

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v2stage-tools"
PORT = 8205


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"

out = {}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page(path):
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        pg.goto(BASE + path, wait_until="networkidle")
        pg.wait_for_timeout(500)
        return pg

    # ① 연금 개시일 — 생년월일을 바꾸면 만 나이가 바뀐다
    pg = page("/apps/pension-draw/run?mode=age")
    before = pg.inner_text('[data-testid="age-now"]')
    pg.fill('input[type="date"]', "1990-01-01")
    pg.wait_for_timeout(500)
    after = pg.inner_text('[data-testid="age-now"]')
    out["pension-draw-age"] = {
        "before": before.replace("\n", " / ")[:60],
        "after": after.replace("\n", " / ")[:60],
        "changed": before != after,
    }
    pg.close()

    # ② 예금·적금 — 예치금을 바꾸면 만기 수령액이 바뀐다
    pg = page("/apps/compound-return/run?mode=deposit")
    pane = "[data-util='deposit-savings']"
    before = pg.inner_text(pane)
    pg.locator(pane + " input[type='text']").first.fill("5000")
    pg.wait_for_timeout(500)
    after = pg.inner_text(pane)
    out["compound-deposit"] = {
        "changed": before != after,
        "before_has": "1,000만원" in before or "1,000" in before,
        "after_has_5000": "5,000" in after,
    }
    pg.close()

    # ③ 시급 — 시급을 바꾸면 월 예상 급여가 바뀐다
    pg = page("/apps/salary-net/run?mode=hourly")
    before = pg.inner_text('[data-testid="monthly-pay"]')
    pg.locator("input[type='text']").first.fill("15000")
    pg.wait_for_timeout(500)
    after = pg.inner_text('[data-testid="monthly-pay"]')
    out["salary-hourly"] = {
        "before": before.replace("\n", " / ")[:60],
        "after": after.replace("\n", " / ")[:60],
        "changed": before != after,
    }
    pg.close()

    # ④ 3.3% — 계약금액을 바꾸면 실수령액이 바뀐다
    pg = page("/apps/vat-margin/run?mode=freelance")
    pane = "[data-util='freelancer-tax']"
    before = pg.inner_text(pane)
    pg.locator(pane + " input[type='text']").first.fill("5000000")
    pg.wait_for_timeout(500)
    after = pg.inner_text(pane)
    out["vat-freelance"] = {"changed": before != after, "after_has_5m": "5,000,000" in after}
    pg.close()

    # ⑤ 이사 D-Day — 잔금일을 바꾸면 일정이 바뀐다
    pg = page("/apps/unit-date-calc/run?mode=moving")
    before = pg.inner_text("[data-moving-pane]")
    pg.fill("[data-moving-pane] input[type='date']", "2027-03-02")
    pg.wait_for_timeout(500)
    after = pg.inner_text("[data-moving-pane]")
    out["unit-date-moving"] = {"changed": before != after, "has_2027": "2027" in after}
    pg.close()

    b.close()

httpd.shutdown()
(OUT / "scenarios.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(out, ensure_ascii=False, indent=2))
