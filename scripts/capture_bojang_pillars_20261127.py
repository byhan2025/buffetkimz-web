#!/usr/bin/env python3
"""보장분석 요약기 — 25개 기둥·계약 단위 표·기존 vs 제안 비교 화면 검사 (2026-11-27)

  python3 scripts/capture_bojang_pillars_20261127.py local   # dist를 로컬 서버로 띄워 검사
  python3 scripts/capture_bojang_pillars_20261127.py live    # 배포 뒤 실제 주소로 검사

하는 일
  · 390×844 · 1280×800 에서 콘솔 오류 0, 가로 넘침 0
  · '보장 기둥 25 체크리스트'와 'N / 25' 배지, 25개 기둥 칸이 그려지는지
  · [계약별] 탭 — 보험사·상품명·계약일·납입·만기·월 보험료·담보 수가 보이는지
  · [가상 비교 예시] — 새로 세워지는 기둥·제안 후 비어 있는 기둥·월 보험료 변화
  · A4 인쇄 창과 증권북형 HTML·CSV 에도 기둥과 계약 표가 들어가는지
  · 캡처는 apps/buffetkimz-web/reports/buffetkimz-web/bojang-pillars-20261127/ 에 남긴다
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys
import threading

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP.parent.parent
OUT = APP / "reports" / "buffetkimz-web" / "bojang-pillars-20261127"
OUT.mkdir(parents=True, exist_ok=True)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
PORT = 8795
MODE = sys.argv[1] if len(sys.argv) > 1 else "local"
WIDTHS = ((390, 844), (1280, 800))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def log_message(self, *a):
        pass


def start_local():
    """로컬 dist 서버 — 같은 포트가 잡혀 있으면 다음 포트로 넘어간다(이전 시험의 잔여 서버 대비)"""
    global PORT
    socketserver.TCPServer.allow_reuse_address = True
    last = None
    for port in range(PORT, PORT + 12):
        try:
            httpd = socketserver.TCPServer(("127.0.0.1", port), H)
        except OSError as exc:  # 주소 사용 중
            last = exc
            continue
        PORT = port
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        return httpd
    raise SystemExit(f"로컬 서버를 띄우지 못했습니다: {last}")


sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

httpd = start_local() if MODE == "local" else None
base = f"http://127.0.0.1:{PORT}" if MODE == "local" else LIVE
failures: list[str] = []
facts: dict[str, object] = {}

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--no-sandbox"],
        )
        for width, height in WIDTHS:
            ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR", accept_downloads=True)
            page = ctx.new_page()
            errs: list[str] = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.goto(f"{base}/apps/bojang-summary/run/", wait_until="networkidle")
            page.wait_for_timeout(1200)
            ov = page.evaluate("() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth })")
            facts[f"{width}_overflow"] = ov
            if ov["sw"] > ov["cw"] + 1:
                failures.append(f"{width}px 가로 넘침 {ov}")

            runner = page.locator("[data-runner]").inner_text()
            for label in ("보장분석 요약기", "보장 기둥 25 체크리스트", "뿌리 실손"):
                if label not in runner:
                    failures.append(f"{width}px '{label}' 없음")
            # '보장 기둥 N / 25' 배지 — 진행 막대의 aria-label 로 확인한다(글자가 칸으로 나뉘어 있다)
            if not page.get_by_label("보장 기둥 2 / 25").count():
                failures.append(f"{width}px '보장 기둥 2 / 25' 배지 없음")
            pills = page.locator("[data-runner] [title]").count()
            facts[f"{width}_tip_elements"] = pills

            # 기둥 25칸 — 화면에 그려진 기둥 카드 수(부족·미보유 포함)
            cards = page.evaluate(
                """() => {
                  const txt = ['일반암 진단비','유사암·소액암 진단비','암 수술비','항암 치료비','암 입원일당',
                    '뇌혈관질환 진단비','허혈성심장질환 진단비','뇌·심장 수술비','뇌·심장 주요치료비',
                    '질병 수술비','상해 수술비','질병 입원일당','상해 입원일당','간병인 사용 일당','중증 치매 진단비',
                    '통원·처방비','질병 사망보험금','재해 사망보험금','질병 후유장해','상해 후유장해',
                    '골절 진단비','화상 진단비','교통사고처리지원금','변호사선임·벌금','일상생활배상책임'];
                  return { want: txt.length, hits: txt.filter(t => document.body.innerText.includes(t)).length };
                }"""
            )
            facts[f"{width}_pillars"] = cards
            if cards["hits"] != cards["want"]:
                failures.append(f"{width}px 기둥 {cards['hits']}/{cards['want']} 만 보임")

            if width == 390:
                page.screenshot(path=str(OUT / f"bojang-pillars-{MODE}-390-top.png"), full_page=False)
                page.locator("text=보장 기둥 25 체크리스트").scroll_into_view_if_needed()
                page.wait_for_timeout(400)
                page.screenshot(path=str(OUT / f"bojang-pillars-{MODE}-390.png"), full_page=True)

                # ② 계약별 표
                page.get_by_role("tab", name="계약별").click()
                page.wait_for_timeout(500)
                runner = page.locator("[data-runner]").inner_text()
                for label in ("계약 4건", "한결생명", "무배당 한결 종신보험", "2014-03-12", "20년납", "주요 담보"):
                    if label not in runner:
                        failures.append(f"계약별 보기에서 '{label}' 없음")
                if "월 보험료 49,100원" not in runner:
                    failures.append("계약별 보기 월 보험료 합계 49,100원 없음")
                page.screenshot(path=str(OUT / f"bojang-contracts-{MODE}-390.png"), full_page=True)
                page.get_by_role("tab", name="담보별").click()
                page.wait_for_timeout(300)

                # ③ 가상 비교 예시 — 보유·제안 두 벌
                page.get_by_role("button", name="가상 비교 예시").click()
                page.wait_for_timeout(900)
                runner = page.locator("[data-runner]").inner_text()
                for label in ("기존 · 제안 비교", "새로 세워지는 기둥", "간병인 사용 일당", "제안 후에도 비어 있는 기둥", "42,700원"):
                    if label not in runner:
                        failures.append(f"비교에서 '{label}' 없음")
                facts["compare"] = {"delta": "42,700"}
                page.locator("text=새로 세워지는 기둥").first.scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                page.screenshot(path=str(OUT / f"bojang-compare-{MODE}-390.png"), full_page=True)

                # ④ A4 인쇄 창 — 기둥·계약 표 반영
                with page.expect_popup(timeout=25000) as pop_info:
                    page.get_by_role("button", name="A4 요약 인쇄 · PDF").click()
                pop = pop_info.value
                pop.wait_for_load_state("domcontentloaded")
                pop.set_viewport_size({"width": 900, "height": 1400})
                pop.wait_for_timeout(700)
                sheet = pop.inner_text("body")
                for label in ("보장 기둥", "계약(상품) 단위", "기존 · 제안 비교", "새로 세워지는 기둥"):
                    if label not in sheet:
                        failures.append(f"A4 인쇄에 '{label}' 없음")
                facts["sheet_chars"] = len(sheet)
                pop.screenshot(path=str(OUT / "bojang-pillars-a4.png"), full_page=True)
                pop.close()

                # ⑤ 증권북형 HTML — 기둥·계약 단위 표
                with page.expect_download(timeout=25000) as dl:
                    page.get_by_role("button", name="증권북형 HTML 저장").click()
                book = pathlib.Path(dl.value.path()).read_text(encoding="utf-8", errors="replace")
                for label in ("보장 기둥", "계약(상품) 단위", "기둥 이동", "새로 세워지는 기둥"):
                    if label not in book:
                        failures.append(f"증권북 HTML 에 '{label}' 없음")
                (OUT / "bojang-book.html").write_text(book, encoding="utf-8")
                facts["book_chars"] = len(book)

                # ⑥ CSV — 기둥·계약 행
                with page.expect_download(timeout=25000) as dl2:
                    page.get_by_role("button", name="엑셀(CSV) 내보내기").click()
                csv = pathlib.Path(dl2.value.path()).read_text(encoding="utf-8", errors="replace")
                for label in ("계약,보험사,상품명", "보장 기둥", "기둥,보장 그룹,상태"):
                    if label not in csv:
                        failures.append(f"CSV 에 '{label}' 없음")
                (OUT / "bojang-pillars.csv").write_text(csv, encoding="utf-8")
                facts["csv_chars"] = len(csv)

            page.screenshot(path=str(OUT / f"bojang-pillars-{MODE}-{width}.png"), full_page=True)
            mine = [e for e in errs if "favicon" not in e]
            if mine:
                failures.append(f"{width}px 콘솔 오류 {mine[:3]}")
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
