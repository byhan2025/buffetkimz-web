#!/usr/bin/env python3
"""데일리 브리프 게시판(/board/) 실측 캡처·검증 (2026-11-24 신설, v9.2.0).

무엇을 재는가 (v9.4.0 — 스토리·썰 '원문 글맛 + 출처 SNS 커뮤니티' 원칙 반영)
  A. `/board/` 390 · 1280 캡처 2장 (전체 높이) + 코너 카드 3장 캡처(board-corners-390.png)
     + 스토리·썰 카드 캡처(card-story-raw-390.png · card-story-raw-<id>-390.png)
  B. 320 · 390 · 1280 가로 넘침 0px · 콘솔 오류 0
  C. 코너 3개가 화면에 있고(각 44px 이상), 코너를 누르면 그 코너 글만 남고 날짜 묶음이 접히며,
     다시 누르면 전체 건수로 돌아온다
  D. 분류 필터 — 분류 하나를 누르면 그 분류 카드만 남고, '전체'로 원래 건수로 돌아온다
  E. 홈(`/`)에 '데일리 브리프 게시판 보기' 진입 링크가 실제로 있다
  F. 카드 계약 — 금융 코너(시황·제도·보험·AI·실무)는 출처 표기 + `원문 보기` 링크가 1개씩,
     스토리·썰 코너는 외부 링크 0개 + 출처가 `SNS 커뮤니티` 한 줄,
     SNS 화제 코너는 링크·출처 행 0개.
     스토리·SNS 코너 모두 계정(@)·x.com·원문·조회·'사실 확인' 흔적이 없어야 한다
  G. 금지어(실시간·속보·긴급)가 화면에 없다

사용: npm run build && python3 scripts/capture_board.py
결과: /workspace/reports/buffetkimz-web/board/ — 390·1280 png + board-corners-390.png
      + card-story-raw-390.png + check.json
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/board")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("BOARD_PORT", "8331"))
PREFIX = "/buffetkimz-web"
BANNED = ("실시간", "속보", "긴급")
# 카드 계약 — 금융 코너는 1차 출처·원문 링크, 스토리·썰은 '출처 SNS 커뮤니티' 한 줄, SNS 화제는 출처·링크 0
SOURCED_CATS = {"시황", "제도·보험", "AI·실무"}
STORY_CATS = {"스토리·썰"}
SNS_CATS = {"SNS 화제"}
STORY_SOURCE = "SNS 커뮤니티"
ORIGIN_TRACES = ("@", "x.com", "twitter", "원문", "조회", "좋아요", "리포스트", "사실 확인")

mimetypes.add_type("image/webp", ".webp")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


class Server(socketserver.TCPServer):
    allow_reuse_address = True


threading.Thread(target=Server(("127.0.0.1", PORT), Handler).serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}{PREFIX}"

OVERFLOW_JS = """
() => ({overflow: document.documentElement.scrollWidth - window.innerWidth,
        docW: document.documentElement.scrollWidth, winW: window.innerWidth})
"""


def check_card_contract(tag: str, cards: list[dict]) -> list[str]:
    """카드 한 장씩 — 금융은 출처·링크, 스토리·썰은 'SNS 커뮤니티' 한 줄, SNS 화제는 흔적 0."""
    out: list[str] = []
    for i, c in enumerate(cards, 1):
        where = f"{tag}: {i}번 카드({c['cat']})"
        if c["cat"] in SOURCED_CATS:
            if c["link"] != 1:
                out.append(f"{where} — 금융 코너인데 '원문 보기' 링크 {c['link']}개(1개여야 함)")
            if not c["hasSource"]:
                out.append(f"{where} — 금융 코너인데 출처 표기가 없습니다")
        elif c["cat"] in STORY_CATS:
            if c["link"]:
                out.append(f"{where} — 스토리·썰 코너인데 외부 링크가 남았습니다(0개여야 함)")
            if not c["hasSource"]:
                out.append(f"{where} — 스토리·썰 코너인데 '출처' 행이 없습니다")
            elif c["sourceName"] != STORY_SOURCE:
                out.append(f"{where} — 스토리·썰 코너 출처가 '{c['sourceName']}'입니다('{STORY_SOURCE}'여야 함)")
            if not c["curator"]:
                out.append(f"{where} — 정리 주체 표기가 비었습니다")
            hits = [t for t in ORIGIN_TRACES if t in c["text"]]
            if hits:
                out.append(f"{where} — 원본 흔적 노출 {hits}")
        elif c["cat"] in SNS_CATS:
            if c["link"]:
                out.append(f"{where} — SNS 화제 코너인데 외부 링크가 남았습니다")
            if c["hasSource"]:
                out.append(f"{where} — SNS 화제 코너인데 '출처' 행이 남았습니다")
            if not c["curator"]:
                out.append(f"{where} — 정리 주체 표기가 비었습니다")
            hits = [t for t in ORIGIN_TRACES if t in c["text"]]
            if hits:
                out.append(f"{where} — 원본 흔적 노출 {hits}")
        else:
            out.append(f"{where} — 계약에 없는 분류입니다")
    return out


report: dict = {"base": BASE, "checks": {}, "failures": []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    for width, height, tag in ((390, 844, "390"), (1280, 900, "1280")):
        ctx = browser.new_context(
            viewport={"width": width, "height": height}, locale="ko-KR", device_scale_factor=2
        )
        page = ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        resp = page.goto(f"{BASE}/board/", wait_until="load")
        page.wait_for_timeout(900)
        ov = page.evaluate(OVERFLOW_JS)
        metrics = page.evaluate(
            """() => {
              const tabs = [...document.querySelectorAll('[data-board-tab]')]
                .map(b => ({label: b.dataset.boardTab, h: +b.getBoundingClientRect().height.toFixed(1)}));
              const corners = [...document.querySelectorAll('[data-board-corner]')]
                .map(b => ({label: b.dataset.boardCorner, h: +b.getBoundingClientRect().height.toFixed(1)}));
              const cards = [...document.querySelectorAll('[data-board-entry]')].map(c => ({
                cat: c.dataset.category || '',
                link: c.querySelectorAll('.br-link').length,
                hasSource: !!c.querySelector('.br-source'),
                sourceName: (c.querySelector('.br-source-name')?.innerText || '').trim(),
                curator: (c.querySelector('.br-curator')?.innerText || '').trim(),
                text: c.innerText,
              }));
              const slots = [...document.querySelectorAll('.br-slot')].map(s => s.innerText.trim());
              const allTab = document.querySelector('[data-board-tab="all"]');
              const total = parseInt((allTab?.innerText || '').replace(/[^0-9]/g, ''), 10);
              return {cards, total, tabs, corners, slots,
                      sourceLinks: cards.reduce((n, c) => n + c.link, 0),
                      cardText: cards.map(c => c.text).join(" / ")};
            }"""
        )
        shot = OUT / f"board-{tag}.png"
        page.screenshot(path=str(shot), full_page=True)

        # 코너 카드 3장 캡처 · 스토리·썰 카드 캡처 (390 화면에서 한 번만 — 화면을 닫기 전에 찍는다)
        if tag == "390":
            section = page.query_selector("section[aria-labelledby='board-corners-title']")
            if section:
                section.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                section.screenshot(path=str(OUT / "board-corners-390.png"))
                report["checks"]["corners-shot"] = str(OUT / "board-corners-390.png")
            else:
                report["failures"].append("390: 코너 안내 섹션을 찾지 못했습니다")

            # 스토리·썰 코너만 남긴 뒤 그 카드들을 한 장씩 찍는다 (원문 글맛이 화면에 그대로 실렸는지 육안 확인용)
            # 긴 카드는 화면 높이보다 커서 요소 캡처가 잘린다 — 이 단계만 세로로 넉넉한 뷰포트로 찍는다
            page.set_viewport_size({"width": width, "height": 2400})
            page.wait_for_timeout(200)
            story_items = page.query_selector_all('[data-board-entry][data-category="스토리·썰"]')
            if not story_items:
                report["failures"].append("390: 스토리·썰 카드를 찾지 못했습니다")
            story_shots: list[str] = []
            for idx, item in enumerate(story_items):
                item.scroll_into_view_if_needed()
                page.wait_for_timeout(150)
                if idx == 0:
                    path = OUT / "card-story-raw-390.png"
                else:
                    entry_id = (item.get_attribute("id") or f"story{idx + 1}").split("-")[-1]
                    path = OUT / f"card-story-raw-{entry_id}-390.png"
                item.screenshot(path=str(path))
                story_shots.append(str(path))
            report["checks"]["story-shots"] = story_shots
        ctx.close()

        report["checks"][tag] = {
            "status": getattr(resp, "status", None),
            "overflow": ov,
            "cards": len(metrics["cards"]),
            "total": metrics["total"],
            "tabs": metrics["tabs"],
            "corners": metrics["corners"],
            "sourceLinks": metrics["sourceLinks"],
            "storySources": [c["sourceName"] for c in metrics["cards"] if c["cat"] == "스토리·썰"],
            "curators": [c["curator"] for c in metrics["cards"]],
            "slots": metrics["slots"],
            "consoleErrors": errors,
            "shot": str(shot),
        }
        if ov["overflow"] > 0:
            report["failures"].append(f"{tag}: 가로 넘침 {ov['overflow']}px")
        if errors:
            report["failures"].append(f"{tag}: 콘솔 오류 {len(errors)}건 {errors[:2]}")
        if len(metrics["cards"]) < 8:
            report["failures"].append(f"{tag}: 카드 {len(metrics['cards'])}건 (3코너 시드 8건 미만)")
        if metrics["total"] != len(metrics["cards"]):
            report["failures"].append(f"{tag}: '전체' 탭 숫자 {metrics['total']} ≠ 카드 {len(metrics['cards'])}")
        # 카드 계약 — 금융 4건은 출처·링크, 스토리 2건은 'SNS 커뮤니티' 한 줄, SNS 2건은 출처·링크 0
        report["failures"] += check_card_contract(tag, metrics["cards"])
        small = [t for t in metrics["tabs"] if t["h"] < 44]
        if small:
            report["failures"].append(f"{tag}: 필터 버튼 44px 미만 {small}")
        if len(metrics["corners"]) != 3:
            report["failures"].append(f"{tag}: 코너 카드 {len(metrics['corners'])}장 (기대 3장)")
        small_corner = [c for c in metrics["corners"] if c["h"] < 44]
        if small_corner:
            report["failures"].append(f"{tag}: 코너 버튼 44px 미만 {small_corner}")
        hits = [w for w in BANNED if w in metrics["cardText"]]
        if hits:
            report["failures"].append(f"{tag}: 금지어 노출 {hits}")

    # 320 — 넘침만 (좁은 폰)
    ctx = browser.new_context(viewport={"width": 320, "height": 780}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/board/", wait_until="load")
    page.wait_for_timeout(600)
    ov320 = page.evaluate(OVERFLOW_JS)
    ctx.close()
    report["checks"]["320"] = {"overflow": ov320}
    if ov320["overflow"] > 0:
        report["failures"].append(f"320: 가로 넘침 {ov320['overflow']}px")

    # 필터 동작 — 390 화면에서 코너(story) → 분류(AI·실무) → 전체
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/board/", wait_until="load")
    page.wait_for_timeout(500)

    def visible_cards() -> int:
        return page.evaluate(
            "() => [...document.querySelectorAll('[data-board-entry]')].filter(c => !c.hidden).length"
        )

    # 코너별 기대 건수는 화면의 data-board-corner 버튼과 카드 data-category로 센다
    expected = page.evaluate(
        """() => {
          const map = JSON.parse(document.getElementById('board-corner-map').textContent);
          const cards = [...document.querySelectorAll('[data-board-entry]')];
          const out = {corners: {}, categories: {}, all: cards.length};
          for (const [k, cats] of Object.entries(map))
            out.corners[k] = cards.filter(c => cats.includes(c.dataset.category)).length;
          for (const c of cards) out.categories[c.dataset.category] = (out.categories[c.dataset.category] || 0) + 1;
          return out;
        }"""
    )

    page.click('[data-board-corner="story"]')
    page.wait_for_timeout(250)
    visible_story = visible_cards()
    days_story = page.evaluate("() => [...document.querySelectorAll('[data-board-day]')].filter(d => !d.hidden).length")
    pressed = page.evaluate(
        "() => document.querySelector('[data-board-corner=\"story\"]').getAttribute('aria-pressed')"
    )
    page.screenshot(path=str(OUT / "board-390-filter-story.png"), full_page=True)

    page.click('[data-board-corner="story"]')
    page.wait_for_timeout(250)
    visible_after_toggle = visible_cards()

    page.click('[data-board-tab="AI·실무"]')
    page.wait_for_timeout(250)
    visible_ai = visible_cards()
    page.screenshot(path=str(OUT / "board-390-filter-ai.png"), full_page=True)

    page.click('[data-board-tab="all"]')
    page.wait_for_timeout(250)
    visible_all = visible_cards()
    ctx.close()
    report["checks"]["filter"] = {
        "expected": expected,
        "story": visible_story,
        "storyDays": days_story,
        "storyPressed": pressed,
        "afterToggle": visible_after_toggle,
        "ai": visible_ai,
        "all": visible_all,
    }
    if visible_story != expected["corners"]["story"]:
        report["failures"].append(
            f"코너 필터 이상: story {visible_story}건(기대 {expected['corners']['story']})"
        )
    if pressed != "true":
        report["failures"].append("코너 필터: aria-pressed가 true로 바뀌지 않았습니다")
    if visible_after_toggle != expected["all"]:
        report["failures"].append(
            f"코너 재클릭: {visible_after_toggle}건(기대 {expected['all']} — 전체로 복귀해야 함)"
        )
    if visible_ai != expected["categories"].get("AI·실무", 0):
        report["failures"].append(
            f"분류 필터 이상: AI·실무 {visible_ai}건(기대 {expected['categories'].get('AI·실무', 0)})"
        )
    if visible_all != expected["all"]:
        report["failures"].append(f"전체 복귀 이상: {visible_all}건(기대 {expected['all']})")

    # 홈 진입 링크
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="load")
    page.wait_for_timeout(1200)
    home = page.evaluate(
        """() => {
          const a = [...document.querySelectorAll('a')].find(a => a.textContent.includes('데일리 브리프 게시판 보기'));
          if (!a) return {found: false};
          const r = a.getBoundingClientRect();
          return {found: true, href: a.getAttribute('href'), h: +r.height.toFixed(1)};
        }"""
    )
    page.screenshot(path=str(OUT / "home-board-entry-390.png"), full_page=False)
    ctx.close()
    report["checks"]["home-link"] = home
    if not home.get("found"):
        report["failures"].append("홈: '데일리 브리프 게시판 보기' 링크 없음")
    elif home.get("h", 0) < 44:
        report["failures"].append(f"홈: 진입 링크 높이 {home.get('h')}px (44px 미만)")

    browser.close()

(OUT / "check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("■ /board/ 실측")
for tag in ("320", "390", "1280"):
    c = report["checks"].get(tag, {})
    ov = c.get("overflow", {})
    print(
        f"  {tag:>4}px 넘침 {ov.get('overflow')}px · 카드 {c.get('cards', '-')}건 · 코너 {len(c.get('corners', []))}장 · 출처 링크 {c.get('sourceLinks', '-')}"
    )
f = report["checks"]["filter"]
print(
    f"  필터: story {f['story']}건 · 토글후 {f['afterToggle']}건 · AI {f['ai']}건 · 전체 {f['all']}건"
)
print(f"  코너 기대값: {f['expected']['corners']}")
print(f"  스토리 출처 표기: {report['checks']['390'].get('storySources')}")
print(f"  홈 진입 링크: {report['checks']['home-link']}")
print()
if report["failures"]:
    print(f"✗ 실패 {len(report['failures'])}건")
    for f in report["failures"]:
        print("  -", f)
    sys.exit(1)
print("✓ 전부 통과 — reports/buffetkimz-web/board/")
