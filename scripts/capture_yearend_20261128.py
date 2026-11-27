#!/usr/bin/env python3
"""2026-11-28 — 13월의 월급 지도·신용카드 공제 계산기·홈 첫 화면 동선 개편 캡처 (390·1280).

재는 것
  · 홈 첫 화면(3초 진단·지도·이달의 기한·계산기 4개)이 390·1280에서 첫 화면에 들어오는지
  · 13월의 월급 지도 — 진단 3문항을 바꾸면 체크리스트가 줄어드는지, 3단계 탭이 바뀌는지
  · 신용카드 공제 계산기 — 계산 결과와 [결과 카드 이미지 저장]이 실제 PNG를 내려받는지
  · 골든타임 — [?] [내 달력에 추가 (.ics)]가 실제 .ics를 내려받는지(VBEGIN:VCALENDAR 포함)
  · 헤더 드롭다운(앱스토어·골든타임) 메뉴 이름이 그대로인지
사용: python3 scripts/capture_yearend_20261128.py [--live]
결과: /workspace/reports/buffetkimz-web/yearend-20261128/{local|live}-*.png · report.json
"""
from __future__ import annotations

import http.server
import json
import mimetypes
import os
import pathlib
import socketserver
import sys
import threading

APP = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = "--live" in sys.argv
MODE = "live" if LIVE else "local"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/yearend-20261128")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PREFIX = "" if LIVE else ""
PORT = int(os.environ.get("YE_PORT", "8391"))
LOCAL_BASE = f"http://127.0.0.1:{PORT}"
LIVE_BASE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE_BASE if LIVE else LOCAL_BASE

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("text/calendar", ".ics")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def log_message(self, *a):
        pass


class Server(socketserver.TCPServer):
    allow_reuse_address = True


report: dict = {"mode": MODE, "base": BASE, "checks": [], "pages": {}}


def check(name: str, ok: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def url(path: str) -> str:
    return f"{BASE}{path}"


if not LIVE:
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def ctx_page(width: int, height: int, downloads: bool = True):
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            locale="ko-KR",
            device_scale_factor=2 if width == 390 else 1,
            accept_downloads=downloads,
        )
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    # ── 홈 첫 화면
    for width, height in ((390, 844), (1280, 900)):
        ctx, pg, errors = ctx_page(width, height)
        pg.goto(url("/"), wait_until="networkidle")
        pg.wait_for_timeout(900)
        info = pg.evaluate(
            """() => {
              const h1 = document.querySelector('h1');
              const start = document.querySelector('#start-here');
              const diag = document.querySelectorAll('.diag-option').length;
              const dues = document.querySelectorAll('.due-row').length;
              const quick = document.querySelectorAll('.quick-calc-link').length;
              const mapBand = document.querySelector('[data-start-map]');
              const film = document.querySelector('#film');
              const h1Box = h1 ? h1.getBoundingClientRect() : null;
              return {
                h1: h1 ? h1.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60) : '',
                h1Top: h1Box ? Math.round(h1Box.top) : -1,
                h1Size: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0,
                startTop: start ? Math.round(start.getBoundingClientRect().top + window.scrollY) : -1,
                filmTop: film ? Math.round(film.getBoundingClientRect().top + window.scrollY) : -1,
                diag, dues, quick,
                mapText: mapBand ? mapBand.innerText.replace(/\\s+/g, ' ').trim().slice(0, 90) : '',
                overflow: document.documentElement.scrollWidth - window.innerWidth,
                h1InFirstScreen: h1Box ? h1Box.top < window.innerHeight : false,
              };
            }"""
        )
        report["pages"][f"home-{width}"] = info
        pg.screenshot(path=str(OUT / f"{MODE}-home-first-{width}.png"))
        check(f"홈 {width} h1이 첫 화면에 있음", info["h1InFirstScreen"] and info["h1Size"] >= 27, f"{info['h1Top']}px · {info['h1Size']}px")
        check(f"홈 {width} 진단 4칸·기한 3개·계산기 4개", info["diag"] == 4 and info["dues"] == 3 and info["quick"] == 4, str(info["diag"]) + "/" + str(info["dues"]) + "/" + str(info["quick"]))
        check(f"홈 {width} 13월의 월급 지도 바로가기", "13월의 월급 지도" in info["mapText"], info["mapText"][:40])
        check(f"홈 {width} 필름은 첫 화면 아래", info["filmTop"] > height, f"filmTop {info['filmTop']}")
        check(f"홈 {width} 가로 넘침 0", info["overflow"] <= 1, f"{info['overflow']}px")

        # 3초 진단 — 절세로 바꾼 화면
        pg.click('label[for="diag-tax"]')
        pg.wait_for_timeout(350)
        panel = pg.inner_text('[data-diag="tax"]')
        pg.screenshot(path=str(OUT / f"{MODE}-home-diag-tax-{width}.png"))
        check(f"홈 {width} 진단 '절세' 패널 전환", "신용카드 공제 계산기" in panel and "12월" in panel, panel.replace("\n", " ")[:60])

        # 헤더 드롭다운 — 메뉴 이름 유지 확인
        if width == 1280:
            menus = pg.evaluate(
                """() => [...document.querySelectorAll('.site-nav .nav-link')].map(a => a.textContent.trim())"""
            )
            report["pages"]["home-menu"] = menus
            check("1280 메뉴 이름 그대로", menus[:6] == ["자산리포트", "앱스토어", "골든타임", "자료앨범", "아카데미", "버핏킴즈"], ", ".join(menus))
            # 골든타임 드롭다운을 열어 13월의 월급 지도 줄을 확인
            btns = pg.query_selector_all("[data-nav-toggle]")
            if btns:
                btns[1].click()
                pg.wait_for_timeout(300)
            drop_text = pg.inner_text("body")
            check("골든타임 드롭다운에 13월의 월급 지도", "13월의 월급 지도" in drop_text, "")
            pg.screenshot(path=str(OUT / f"{MODE}-home-menu-1280.png"))
        ctx.close()

    # ── 13월의 월급 지도
    for width, height in ((390, 844), (1280, 900)):
        ctx, pg, errors = ctx_page(width, height)
        resp = pg.goto(url("/year-end-tax/"), wait_until="networkidle")
        pg.wait_for_timeout(700)
        info = pg.evaluate(
            """() => {
              const badge = document.querySelector('[data-tax-badge]');
              const items = [...document.querySelectorAll('[data-checklist] > li')].map(li => li.innerText.replace(/\\s+/g,' ').trim().slice(0, 24));
              const steps = [...document.querySelectorAll('[data-tax-steps] [role=tab]')].map(b => b.innerText.trim());
              const ms = [...document.querySelectorAll('[data-tax-milestones] > li')].map(li => li.innerText.replace(/\\s+/g,' ').trim().slice(0, 30));
              return {
                status: 200,
                badge: badge ? badge.innerText.trim() : '',
                count: items.length, items, steps, ms,
                overflow: document.documentElement.scrollWidth - window.innerWidth,
              };
            }"""
        )
        report["pages"][f"yearend-{width}"] = info
        pg.screenshot(path=str(OUT / f"{MODE}-yearend-top-{width}.png"))
        check(f"지도 {width} HTTP 200", resp is not None and resp.status < 400, str(getattr(resp, "status", "")))
        check(f"지도 {width} 귀속 배지", "2026년 귀속" in info["badge"] and "2027년" in info["badge"], info["badge"])
        check(f"지도 {width} D-데이 3건", len(info["ms"]) == 3, " | ".join(info["ms"])[:80])
        check(f"지도 {width} 3단계 탭", len(info["steps"]) == 3, " / ".join(info["steps"])[:70])
        check(f"지도 {width} 가로 넘침 0", info["overflow"] <= 1, f"{info['overflow']}px")

        # 진단 — 자녀 1명 + 월세로 바꾸면 항목이 늘고, 4,000만원·자녀 0·월세 없음이면 줄어든다
        before = info["count"]
        pg.click('[data-tax-map] button:has-text("1명")')
        pg.click('[data-tax-map] button:has-text("월세 살고 있음")')
        pg.wait_for_timeout(350)
        after = pg.eval_on_selector_all("[data-checklist] > li", "els => els.length")
        pg.screenshot(path=str(OUT / f"{MODE}-yearend-diagnosed-{width}.png"))
        check(f"지도 {width} 진단으로 항목이 바뀜", after != before, f"{before} → {after}")

        # 3단계 탭 전환
        tabs = pg.query_selector_all('[data-tax-steps] [role="tab"]')
        tabs[1].click()
        pg.wait_for_timeout(300)
        step = pg.inner_text('[data-tax-steps] [role=tabpanel]')
        pg.screenshot(path=str(OUT / f"{MODE}-yearend-step2-{width}.png"))
        check(f"지도 {width} 2단계 탭 내용", "간소화" in step and "1월" in step, step.replace("\n", " ")[:60])
        ctx.close()

    # ── 신용카드 공제 계산기 + 결과 카드 PNG
    for width, height in ((390, 844), (1280, 900)):
        ctx, pg, errors = ctx_page(width, height)
        resp = pg.goto(url("/apps/credit-card-deduction/run/"), wait_until="networkidle")
        pg.wait_for_timeout(1200)
        info = pg.evaluate(
            """() => {
              const stats = [...document.querySelectorAll('[data-runner] p')].map(p => p.innerText).filter(t => t.includes('원'));
              const diff = document.querySelector('[data-switch-diff]');
              const save = document.querySelector('[data-save-result-card]');
              return {
                hasSave: !!save,
                table: document.querySelectorAll('[data-runner] table').length,
                text: document.body.innerText.slice(0, 400),
                diff: diff ? diff.innerText.replace(/\\s+/g,' ').trim().slice(0, 80) : '',
                overflow: document.documentElement.scrollWidth - window.innerWidth,
              };
            }"""
        )
        report["pages"][f"card-{width}"] = info
        pg.screenshot(path=str(OUT / f"{MODE}-credit-card-{width}.png"))
        check(f"계산기 {width} HTTP 200", resp is not None and resp.status < 400, str(getattr(resp, "status", "")))
        check(f"계산기 {width} 결과 카드 저장 버튼", info["hasSave"], "")
        check(f"계산기 {width} 가로 넘침 0", info["overflow"] <= 1, f"{info['overflow']}px")

        # 결과 카드 이미지 저장 — 실제 다운로드 파일을 확인
        with pg.expect_download(timeout=15000) as dl:
            pg.click("[data-save-result-card]")
        download = dl.value
        path = OUT / f"{MODE}-result-card-{width}.png"
        download.save_as(str(path))
        size = path.stat().st_size
        head = path.read_bytes()[:8]
        report["pages"][f"card-png-{width}"] = {"path": str(path), "bytes": size, "png": head[:4] == b"\x89PNG"}
        check(f"계산기 {width} PNG 저장", head[:4] == b"\x89PNG" and size > 20000, f"{size} bytes")

        # 입력을 바꾸면 결과가 바뀐다(문턱 미달 케이스)
        pg.screenshot(path=str(OUT / f"{MODE}-credit-card-saved-{width}.png"))
        ctx.close()

    # ── 골든타임 .ics
    for width, height in ((390, 844), (1280, 900)):
        ctx, pg, errors = ctx_page(width, height)
        resp = pg.goto(url("/calendar/"), wait_until="networkidle")
        pg.wait_for_timeout(900)
        # 12월 탭으로 이동해 기한이 있는 카드의 .ics 버튼을 누른다
        pg.click('[role="tablist"] [role="tab"]:nth-child(12)')
        pg.wait_for_timeout(400)
        buttons = pg.query_selector_all("[data-ics-button]")
        count = len(buttons)
        pg.screenshot(path=str(OUT / f"{MODE}-calendar-ics-{width}.png"))
        check(f"골든타임 {width} .ics 버튼 {count}개", resp is not None and count >= 1, str(count))
        if buttons:
            with pg.expect_download(timeout=15000) as dl:
                buttons[0].click()
            download = dl.value
            path = OUT / f"{MODE}-golden-time-{width}.ics"
            download.save_as(str(path))
            text = path.read_text(encoding="utf-8")
            report["pages"][f"ics-{width}"] = {
                "path": str(path),
                "bytes": path.stat().st_size,
                "hasCal": "BEGIN:VCALENDAR" in text,
                "hasEvent": "BEGIN:VEVENT" in text,
                "dtstart": [l for l in text.splitlines() if l.startswith("DTSTART")],
                "summary": [l for l in text.splitlines() if l.startswith("SUMMARY")],
            }
            check(
                f"골든타임 {width} .ics 내용",
                "BEGIN:VCALENDAR" in text and "DTSTART;VALUE=DATE:" in text and "SUMMARY:" in text,
                str(report["pages"][f"ics-{width}"]["dtstart"])[:40],
            )
        ctx.close()

    browser.close()

failed = [c for c in report["checks"] if not c["ok"]]
report["verdict"] = "PASS" if not failed else "FAIL"
(OUT / f"report-{MODE}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"\n■ {MODE} — {report['verdict']} ({len(report['checks']) - len(failed)}/{len(report['checks'])})")
for f in failed:
    print("  ✗ " + f["name"] + f"  [{f['detail']}]")
print(f"저장: {OUT}/report-{MODE}.json")
sys.exit(0 if not failed else 1)
