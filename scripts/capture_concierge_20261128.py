#!/usr/bin/env python3
"""질문형 컨시어지·소개 영상 개편 실물 캡처 (2026-11-28).

dist를 로컬로 띄워 390×844 · 1280×800에서 첫 화면을 찍고, 눈으로 볼 수 없는 값(높이·h1 개수·
정적 링크 수·가로 넘침)을 함께 잰다. 마지막에 같은 화면을 라이브 주소로 다시 찍는다.

사용: python3 scripts/capture_concierge_20261128.py [--local|--live]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "reports/buffetkimz-web/concierge-20261128"
PORT = 4371
LOCAL = f"http://127.0.0.1:{PORT}"
LIVE = "https://byhan2025.github.io/buffetkimz-web"

PROBE = """() => {
  const hero = document.querySelector('#start-here');
  const hub = document.querySelector('#today');
  const h1s = [...document.querySelectorAll('h1')];
  const heroLinks = hero ? [...hero.querySelectorAll('a')] : [];
  const cards = hero ? [...hero.querySelectorAll('.cq-card')] : [];
  const visibleCard = cards.find((c) => c.getClientRects().length > 0);
  const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : -1; };
  const heroBox = hero ? hero.getBoundingClientRect() : null;
  const hubBox = hub ? hub.getBoundingClientRect() : null;
  const filmBox = document.querySelector('#film');
  return {
    h1Count: h1s.length,
    h1Text: h1s[0] ? h1s[0].innerText.replace(/\\s+/g, ' ').trim().slice(0, 70) : '',
    h1Size: h1s[0] ? parseFloat(getComputedStyle(h1s[0]).fontSize) : 0,
    heroHeight: heroBox ? Math.round(heroBox.height) : -1,
    heroBottom: heroBox ? Math.round(heroBox.bottom) : -1,
    hubTopVisible: hubBox ? Math.round(hubBox.top) : -1,
    hubPeek: hubBox ? Math.round(window.innerHeight - hubBox.top) : -1,
    heroLinks: heroLinks.length,
    heroAnchors: heroLinks.slice(0, 12).map((a) => a.getAttribute('href')),
    cards: cards.length,
    visibleCardText: visibleCard ? visibleCard.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140) : '',
    filmTop: filmBox ? Math.round(filmBox.getBoundingClientRect().top + window.scrollY) : -1,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    viewport: [window.innerWidth, window.innerHeight],
    parts: {
      top: h('.cq-top'),
      title: h('.cq-title'),
      q1: h('#cq-q1'),
      branches: h('.cq-branches'),
      panels: h('.cq-panels'),
      card: visibleCard ? Math.round(visibleCard.getBoundingClientRect().height) : -1,
      links: h('.cq-links'),
    },
  };
}"""


def capture(base: str, mode: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((390, 844), (1280, 800)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))

            page.goto(f"{base}/", wait_until="networkidle")
            page.wait_for_timeout(600)
            print(f"[{mode}] home {width}:", page.evaluate(PROBE))
            page.screenshot(path=str(OUT / f"{mode}-home-first-{width}.png"))

            # 2단계 전환 — 연금·세금 → '카드·결제수단' 선택
            page.click('label[for="cq-b-pension-tax"]')
            page.wait_for_timeout(200)
            page.click('label[for="cq-s-pen-card"]')
            page.wait_for_timeout(200)
            print(f"[{mode}] home {width} pen-card:", page.evaluate(PROBE)["visibleCardText"])
            page.screenshot(path=str(OUT / f"{mode}-home-pencard-{width}.png"))

            # '잘 모르겠어요' 기본 경로
            page.click('label[for="cq-s-pen-hub"]')
            page.wait_for_timeout(200)
            print(f"[{mode}] home {width} pen-hub:", page.evaluate(PROBE)["visibleCardText"])

            # 필름 입구 클릭 → #film 이동
            page.goto(f"{base}/", wait_until="networkidle")
            page.click(".cq-film")
            page.wait_for_timeout(700)
            print(f"[{mode}] home {width} film hash:", page.evaluate("location.hash"))

            page.goto(f"{base}/about/", wait_until="networkidle")
            page.wait_for_timeout(800)
            about = page.evaluate(
                """() => {
                  const film = document.querySelector('#film');
                  const stage = document.querySelector('#film .film-stage');
                  const h1 = document.querySelector('h1');
                  return {
                    h1Count: document.querySelectorAll('h1').length,
                    h1: h1 ? h1.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60) : '',
                    filmTop: film ? Math.round(film.getBoundingClientRect().top + window.scrollY) : -1,
                    stageH: stage ? Math.round(stage.getBoundingClientRect().height) : -1,
                    overflow: document.documentElement.scrollWidth - window.innerWidth,
                  };
                }"""
            )
            print(f"[{mode}] about {width}:", about)
            page.screenshot(path=str(OUT / f"{mode}-about-first-{width}.png"))
            page.evaluate("document.querySelector('#film').scrollIntoView({block:'center'})")
            page.wait_for_timeout(1400)
            page.screenshot(path=str(OUT / f"{mode}-about-film-{width}.png"))

            if errors:
                print(f"[{mode}] {width} console errors:", errors[:5])
            ctx.close()
        browser.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["local", "live", "both"], default="both")
    args = ap.parse_args()

    if args.mode in ("local", "both"):
        server = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(DIST)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            capture(LOCAL, "local")
        finally:
            server.terminate()
    if args.mode in ("live", "both"):
        capture(LIVE, "live")
    print("saved to", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
