#!/usr/bin/env python3
"""v7.6.0 콘텐츠 퀄리티 교정 실측 — 감사 보고서 P0·P1 항목이 화면에서 참인지 잰다.

  A. SalaryNetCalc — 연봉 4,800만·부양 1명·식대 20만의 근로소득공제·결정세액·월 실수령 재계산
  B. 약관·방침 — 주소 단축기(spoo.me) 전송 예외 명시
  C. 세율 표기 — 기타소득세 16.5%, 연금수령한도 2년차 6,667만원, ISA 10%·300만 한도
  D. 홈 — 30초 요약 3줄의 1차 출처 링크·부처명, '다가오는 돈의 일정', 제목 오탈자, 스파크라인 방향
  E. 메뉴·검색 — 8개 분류(전체 제외), 노후준비·철학 노출, 앱 51종
  F. 3초 진단 추천 글 제목 = 실제 글 제목 / 앱 표기 — 중개보수 15억원
  G. 글 20편 전수 — summary·thumbAlt·baseDate·compare 채움

사용:
  npm run build && python3 scripts/verify_v76.py
결과: reports/buffetkimz-web/v76-content-audit/verify-v76-local.json
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import re
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v76-content-audit"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("V76_PORT", "8176"))
BASE = f"http://127.0.0.1:{PORT}"
PREFIX = "/buffetkimz-web"

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


class Server(socketserver.TCPServer):
    allow_reuse_address = True


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


def url(path: str) -> str:
    return f"{BASE}{PREFIX}{path}"


def text_of(page, path: str) -> str:
    page.goto(url(path), wait_until="domcontentloaded")
    return page.inner_text("body")


def main() -> int:
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": 1280, "height": 900})

            # ── A. 급여 계산기 실측 (연봉 4,800만 · 부양 1명 · 식대 20만 = 기본값) ──
            page.goto(url("/apps/salary-net/run"), wait_until="domcontentloaded")
            page.wait_for_selector("[data-testid=net-pay]", timeout=15000)
            page.wait_for_timeout(2200)  # CountUp 애니메이션이 끝난 뒤 값
            net_val = page.locator("[data-testid=net-pay]").inner_text().replace("\n", " | ")
            calc_text = page.inner_text("body")
            deduction = re.search(r"근로소득공제\s*[−-]\s*([\d,]+)원", calc_text)
            decided = re.search(r"결정세액 \(연\)\s*([\d,]+)원", calc_text)
            d_val = int(deduction.group(1).replace(",", "")) if deduction else -1
            dec_val = int(decided.group(1).replace(",", "")) if decided else -1
            check("SalaryNetCalc 근로소득공제 12,030,000원", d_val == 12030000, f"{d_val:,}")
            check("SalaryNetCalc 결정세액 2,456,400원", dec_val == 2456400, f"{dec_val:,}")
            check("SalaryNetCalc 월 실수령 3,405,570원", "3,405,570" in net_val, net_val)

            # ── B. 약관·방침 ──
            privacy = text_of(page, "/privacy/")
            check("privacy spoo.me 예외 명시", "spoo.me" in privacy and "짧은 주소" in privacy)
            check("privacy 단정 문구 한정", "판매·제공하지 않습니다" in privacy and "예외입니다" in privacy)
            terms = text_of(page, "/terms/")
            check("terms spoo.me 예외 명시", "spoo.me" in terms and "짧은 주소" in terms)

            # ── C. 세율·산식 ──
            tax_order = text_of(page, "/posts/pension-tax-order/")
            check("pension-tax-order 기타소득세 16.5%", "기타소득세 16.5%" in tax_order)
            check("pension-tax-order 옛 표기 0", "기타소득세 15%" not in tax_order)
            pm5 = text_of(page, "/posts/pension-master-05-draw-1500/")
            check("pension-master-05 2년차 6,667만원", "6,667만원" in pm5)
            check("pension-master-05 옛 6,040만원 0", "6,040만원" not in pm5)
            page.goto(url("/"), wait_until="domcontentloaded")
            page.locator("[data-pulse-tab='tax']").click()
            page.wait_for_timeout(300)
            tax_panel = page.inner_text("#pulse-panel-tax")
            check("홈 브리핑 ISA 10%·300만 한도", "10%(최대 300만 원)" in tax_panel)
            check("홈 브리핑 '돌려받습니다' 0", "돌려받습니다" not in tax_panel)
            check("홈 브리핑 148만 5,000원은 '세금이 줄어듭니다'", "세금이 줄어듭니다" in tax_panel)

            # ── D. 홈 허브 ──
            hub = page.locator("[data-hub]")
            brief_no = hub.locator("[data-brief-line]").count()
            check("30초 요약 3줄", brief_no == 3, str(brief_no))
            third = hub.locator("[data-brief-line='3']")
            check("3번째 줄 1차 출처 링크", third.locator("a[href^='https://']").count() == 1)
            check("3번째 줄 한 주장(수출 1조 달러)", "수출 1조 달러" in third.inner_text())
            check("부처명 표기 정합(산업통상부 보도자료)", "산업통상부 2026. 11. 19." in third.inner_text())
            wmoney = page.locator("[data-week-money]")
            check("'다가오는 돈의 일정' 제목", "다가오는 돈의 일정" in wmoney.inner_text())
            check("WeekMoney 손으로 적은 14:00 없음", "14:00" not in wmoney.inner_text())
            check("WeekMoney 기준 시각이 데이터(19:00)", "기준 11. 21. 19:00" in wmoney.inner_text())
            picks = page.locator("[data-area='picks'] h2")
            check("PortalPicks 제목 오탈자 0", "자산리포트과" not in picks.inner_text(), picks.inner_text().replace("\n", " "))
            modgrid = page.locator(".hub-modgrid").inner_text().replace("\n", " ")
            dday_note = [c for c in re.findall(r"D-\d+|오늘", modgrid)]
            check("모듈 격자 D-Day가 데이터에서 계산", len(dday_note) >= 3, str(dday_note))
            cards = page.locator("[data-indicator-card]").count()
            minis = page.locator("[data-indicator]").count()
            check("지표 카드 6 + 그 밖의 지표 4", cards == 6 and minis == 4, f"{cards}+{minis}")
            for rid in ("usdkrw", "kospi", "nasdaq", "us10y", "vix"):
                has_spark = page.locator(f"[data-indicator-card='{rid}'] path.mboard-spark-line").count() == 1
                check(f"스파크라인 렌더 {rid}", has_spark)

            # ── E. 메뉴·검색 ──
            menu = page.evaluate(
                """() => {
                  const head = document.querySelector('.nav-drop-head-note');
                  const rows = [...document.querySelectorAll('.nav-drop-label')].map((e) => e.textContent.trim());
                  return { note: head ? head.textContent.trim() : '', rows };
                }"""
            )
            check("자산리포트 하위 = 8개 분류", menu["note"] == "8개 분류", menu["note"])
            check("노후준비 메뉴 있음", "노후준비" in menu["rows"], str(menu["rows"]))
            check("철학·에세이 메뉴 있음", "철학·에세이" in menu["rows"], str(menu["rows"]))
            check("연금 메뉴 라벨 정리", "연금" in menu["rows"] and "연금·퇴직 마스터" not in menu["rows"])
            search = text_of(page, "/search/")
            check("검색 '앱 51종'", "51종" in search)
            check("검색 51 = 49 + 달력 + 자료앨범", "계산·도구 49종" in search)

            # ── F. 3초 진단 제목 / 중개보수 표기 ──
            page.goto(url("/about/"), wait_until="domcontentloaded")
            page.wait_for_selector("[data-finance-check]", timeout=15000)
            page.locator(".fcheck-chip, button", has_text="연금").first.click()
            page.wait_for_timeout(600)
            picked = page.inner_text(".fcheck-post-title") if page.locator(".fcheck-post-title").count() else ""
            check("3초 진단 제목이 실제 글 제목", "인출 순서 4단계" in picked, picked)
            brokerage = text_of(page, "/apps/brokerage-fee/run")
            check("중개보수 표 15억원 표기", "150,000만원" not in brokerage and "15억원" in brokerage)

            # ── F2. 스파크라인 마지막 구간 = 카드 등락률(데이터 수준) ──
            today_src = (APP / "src" / "data" / "today.ts").read_text(encoding="utf-8")
            series = dict(
                (m.group(1), [float(x) for x in m.group(2).split(",")])
                for m in re.finditer(r"id: \"([a-z0-9-]+)\"[\s\S]*?series: \[([^\]]+)\]", today_src)
            )
            mismatched = []
            for ind_id, sign in (("kospi", -1), ("kosdaq", -1), ("nasdaq", -1), ("sp500", -1), ("vix", 1), ("us10y", -1), ("ktb3y", -1), ("ktb10y", -1)):
                s_ = series.get(ind_id)
                if not s_:
                    mismatched.append(f"{ind_id}:none")
                    continue
                step = s_[-1] - s_[-2]
                if (step > 0) != (sign > 0):
                    mismatched.append(f"{ind_id}:{s_[-2]}→{s_[-1]}")
            check("스파크라인 마지막 구간 방향 = 등락 방향", not mismatched, ", ".join(mismatched))

            # ── G. 글 20편 메타 채움 ──
            missing = []
            posts_dir = APP / "src" / "content" / "posts"
            for f in sorted(posts_dir.glob("*.md")):
                fm = f.read_text(encoding="utf-8").split("---\n", 2)[1]
                for key in ("summary:", "thumbAlt:", "baseDate:", "compare:"):
                    if key not in fm:
                        missing.append(f"{f.name}:{key}")
            check("글 20편 summary·thumbAlt·baseDate·compare 100%", not missing, ", ".join(missing))
            # 결론 앵커가 description 폴백이 아닌지 — 상세 상단 라벨
            detail = text_of(page, "/posts/invest-dca-rule/")
            check("결론 앵커에 summary 노출", "실수 횟수" in detail.split("목차")[0])

            browser.close()
        httpd.shutdown()

    passed = sum(1 for _, ok, _ in CHECKS if ok)
    payload = {
        "mode": "local",
        "passed": passed,
        "total": len(CHECKS),
        "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in CHECKS],
    }
    (OUT / "verify-v76-local.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed}/{len(CHECKS)} 통과 → {OUT / 'verify-v76-local.json'}")
    return 0 if passed == len(CHECKS) else 1


if __name__ == "__main__":
    sys.exit(main())
