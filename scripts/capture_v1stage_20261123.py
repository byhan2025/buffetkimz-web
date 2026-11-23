#!/usr/bin/env python3
"""v8.7.0 1단계(삭제·검증 결함 교정) 실측 캡처 — 로컬 dist 또는 라이브.

무엇을 재는가
  A. 핵심 8주소 × 1280·390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 홈 다이어트 — 지표 큰 카드 4 · 접힌 지표 6 · 크레딧 1줄(편·세트·종·건) · 소개/아카이브/학교 밴드 없음
  C. 메뉴 — '준비중' 칩 0(자리표시자 8개 제거) · 캐러셀 항목 0
  D. 앱스토어 — 제목·머리의 도구 수가 store.ts와 같고, '51종' 표기 0
  E. 자료앨범 — 탭 3(카드뉴스·인포그래픽·체크리스트) · 캐러셀 탭 0 · 삭제 세트 0
  F. 아카데미 — 52주 목록에 '연재 예정' 주 0(열린 주만) · STEP 6 · '공개 N강 / 계획 M강' 한 칸
  G. 금융캘린더 — 43건 · 삭제한 중복 항목 0
  H. 캡처 — 390/1280 핵심 화면을 v1stage-live/에 저장

사용:
  npm run build && python3 scripts/capture_v1stage_20261123.py --local
  python3 scripts/capture_v1stage_20261123.py            # gh-pages 라이브
"""
from __future__ import annotations

import http.server
import json
import mimetypes
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v1stage-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
LOCAL = "--local" in sys.argv
MODE = "local" if LOCAL else "live"
PORT = 8193
SUFFIX = "?v=1stage"

if LOCAL:
    mimetypes.add_type("image/webp", ".webp")

    class _Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(APP / "dist"), **kw)

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(("127.0.0.1", PORT), _Handler)
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()
    BASE = f"http://127.0.0.1:{PORT}"
else:
    BASE = LIVE

PAGES = [
    ("home", "/"),
    ("apps", "/apps/"),
    ("academy", "/academy/"),
    ("gallery", "/gallery/"),
    ("calendar", "/calendar/"),
    ("posts", "/posts/"),
    ("about", "/about/"),
    ("tool-pension", "/apps/pension-tax/"),
]

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:400]})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ── A. 8주소 × 1280·390
        for w, h in ((1280, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w == 390 else 1)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            for name, path in PAGES:
                resp = page.goto(BASE + path + SUFFIX, wait_until="load")
                page.wait_for_timeout(700)
                over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                status = resp.status if resp else None
                check(
                    f"A {w} {name} — 200 · 넘침 0 · 콘솔 0",
                    status == 200 and over <= 0 and not errors,
                    f"http {status} · hOverflow {over} · err {errors[:2]}",
                )
                if w == 390:
                    page.screenshot(path=str(OUT / f"390-{name}.png"), full_page=(name in ("home", "apps", "academy", "gallery")))
                else:
                    page.screenshot(path=str(OUT / f"1280-{name}.png"), full_page=(name == "home"))
                errors.clear()
            ctx.close()

        # ── B. 홈
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = ctx.new_page()
        page.goto(BASE + "/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        big = page.eval_on_selector_all("[data-indicator-card]", "e => e.length")
        folded = page.eval_on_selector_all("[data-indicator]", "e => e.length")
        credit = page.inner_text(".film-credit-line")
        body = page.inner_text("body")
        check("B1 홈 지표 큰 카드 4", big == 4, str(big))
        check("B2 홈 접힌 지표 6", folded == 6, str(folded))
        check(
            "B3 크레딧 1줄 — 편·세트·종·건",
            all(k in credit for k in ("편", "세트", "종", "건")),
            credit.replace("\n", " ")[:80],
        )
        check("B4 소개 블록(1,053자)·아카이브 36링크 없음", "data-intro-identities" not in page.content() and "data-topic-grid" not in page.content(), "")
        cites = page.eval_on_selector_all("[data-hub-calendar-cite]", "e => e.length")
        check("B5 기한 인용 3건(달력 1줄)", cites == 3, str(cites))
        page.screenshot(path=str(OUT / "390-home-top.png"))

        # 메뉴 — 모바일 드로어
        page.click("[data-menu-toggle]")
        page.wait_for_timeout(500)
        drawer = page.inner_text("#mobile-menu") if page.query_selector("#mobile-menu") else ""
        check("C1 메뉴에 '준비중' 0", "준비중" not in drawer, drawer.count("준비중"))
        check("C2 메뉴에 '캐러셀' 0", "캐러셀" not in drawer, "")
        channels_text = page.inner_text("#channels")
        check(
            "C3 채널 영역에 SNS 이름 나열 없음(스레드·인스타·유튜브·당근)",
            not any(k in channels_text for k in ("스레드", "인스타그램", "유튜브", "당근")),
            channels_text.replace("\n", " ")[:70],
        )
        page.screenshot(path=str(OUT / "390-menu-open.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # ── D. 앱스토어
        page.goto(BASE + "/apps/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(800)
        apps_body = page.inner_text("body")
        check("D1 앱스토어 '51종' 표기 0", "51종" not in apps_body, "")
        check("D2 앱스토어 머리에 '도구 47종'", "도구 47종" in apps_body, "")
        removed = [k for k in ("물타기", "비밀번호 만들기") if k in apps_body]
        check("D3 삭제 도구 2종 없음(물타기·비밀번호)", not removed, ",".join(removed))
        page.screenshot(path=str(OUT / "390-apps-top.png"))

        # ── E. 자료앨범
        page.goto(BASE + "/gallery/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        tabs = page.eval_on_selector_all("[data-gallery-tab]", "e => e.map(t => t.dataset.galleryTab)")
        gal = page.inner_text("body")
        check("E1 자료앨범 탭 = 전체·카드뉴스·인포그래픽·체크리스트", tabs == ["all", "cardnews", "infographic", "checklist"], str(tabs))
        check("E2 '21세트 · 114장'", "21세트" in gal and "114장" in gal, "")
        check("E3 삭제 세트(연말정산 148만·12월의 세 숫자) 없음", "148만 원" not in gal and "12월의 세 숫자" not in gal, "")
        page.screenshot(path=str(OUT / "390-gallery-top.png"))

        # ── F. 아카데미
        page.goto(BASE + "/academy/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        aca = page.inner_text("body")
        soon_weeks = page.eval_on_selector_all(".school-week-soon", "e => e.length")
        weeks = page.eval_on_selector_all("[data-week]", "e => e.length")
        steps = page.eval_on_selector_all(".academy-step", "e => e.length")
        check("F1 52주 목록에 '연재 예정' 주 0", soon_weeks == 0, f"soon={soon_weeks} weeks={weeks}")
        note = page.inner_text("[data-track-note]")
        want = re.search(r"지금 열린 (\d+)주", note)
        check("F2 열린 주만 표시(주 수 = 머리 안내)", want is not None and weeks == int(want.group(1)), f"weeks={weeks} note={note[:40]}")
        check("F3 STEP 6 · 공개/계획 한 칸", steps == 6 and re.search(r"공개 \d+강 / 계획 \d+강", aca) is not None, f"steps={steps}")
        check("F4 카드 세트 죽은 상수 문구 없음", "카드 세트" not in aca, "")
        page.screenshot(path=str(OUT / "390-academy-top.png"))

        # ── G. 캘린더
        page.goto(BASE + "/calendar/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(700)
        cal = page.inner_text("body")
        check("G1 캘린더 43건", "43건" in cal, "")
        dup = [k for k in ("IRP 추가 납입 여력", "5세대 실손보험 판매 개시", "실손 선택형 할인·계약전환 할인 준비") if k in cal]
        check("G2 중복 사건 항목 없음", not dup, ",".join(dup))
        page.screenshot(path=str(OUT / "390-calendar-top.png"))

        browser.close()

    failed = [r for r in results if not r["ok"]]
    path = OUT / f"capture-{MODE}.json"
    path.write_text(json.dumps({"mode": MODE, "total": len(results), "failed": len(failed), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(results) - len(failed)}/{len(results)} 통과 → {path}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
