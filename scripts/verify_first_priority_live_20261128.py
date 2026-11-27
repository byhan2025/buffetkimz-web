#!/usr/bin/env python3
"""1순위 패치 라이브 실측 (2026-11-28) — GitHub Pages 서브패스 배포본을 390·1280에서 확인한다."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "https://byhan2025.github.io/buffetkimz-web"
OUT = Path(__file__).resolve().parents[1] / "reports/buffetkimz-web/first-priority-20261128"
checks: list[dict] = []


def add(name: str, ok: bool, detail=None):
    checks.append({"check": name, "ok": bool(ok), "detail": detail})


def fetch(path: str) -> str:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def main() -> int:
    (OUT / "shots").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1280, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))

            # 자료앨범 필터
            page.goto(f"{BASE}/gallery/", wait_until="networkidle")
            page.click('[data-gallery-tag="ISA"]')
            page.wait_for_timeout(200)
            isa = page.inner_text("[data-gallery-count]")
            visible = page.eval_on_selector_all("[data-gallery-item]", "els => els.filter(e=>!e.hidden).length")
            if width == 1280:
                add("라이브 자료앨범 ISA = 3세트", isa == "3" and visible == 3, {"count": isa, "visible": visible})
            page.screenshot(path=str(OUT / "shots" / f"live-gallery-isa-{width}.png"))

            # 글 목록 리스트 보기
            page.goto(f"{BASE}/posts/", wait_until="networkidle")
            page.click('button[data-view="text"]')
            page.wait_for_timeout(200)
            summaries = page.eval_on_selector_all(
                "[data-card-summary]", "els => els.filter(e => e.offsetHeight > 0).length"
            )
            if width == 1280:
                add("라이브 리스트 보기 요약문", summaries > 0, summaries)

            # 게시판 필터 건수
            page.goto(f"{BASE}/board/", wait_until="networkidle")
            page.click('[data-board-tab="제도·보험"]')
            page.wait_for_timeout(200)
            pairs = page.eval_on_selector_all(
                "[data-board-day]",
                "els => els.filter(e=>!e.hidden).map(e => e.querySelector('[data-board-day-count]').textContent + '/' + "
                "Array.from(e.querySelectorAll('[data-board-entry]')).filter(x=>!x.hidden).length)",
            )
            if width == 1280:
                add("라이브 게시판 날짜 머리 = 보이는 건수", bool(pairs) and all(a.split("/")[0] == a.split("/")[1] for a in pairs), pairs[:5])
            page.screenshot(path=str(OUT / "shots" / f"live-board-{width}.png"))

            # 글 안 내부 링크 404 — 실제로 눌러 본다
            page.goto(f"{BASE}/posts/credit-card-revolving-fee-calculation/", wait_until="networkidle")
            link = page.query_selector('article a[href*="economy-fixed-cost-check"]')
            href = link.get_attribute("href") if link else None
            status = None
            if href:
                target = f"https://byhan2025.github.io{href}" if href.startswith("/buffetkimz-web") else href
                page.goto(target, wait_until="networkidle")
                status = page.evaluate("() => document.title")
            if width == 1280:
                add(
                    "라이브 리볼빙 글 내부 링크 404 아님",
                    bool(href) and href.startswith("/buffetkimz-web/") and page.title() and "찾을 수 없습니다" not in (status or ""),
                    {"href": href, "title": status},
                )

            # 소식지 글 링크
            page.goto(f"{BASE}/letters/2026-11-21/", wait_until="networkidle")
            letter_href = page.get_attribute('a[href*="/posts/silson-switch-2026"]', "href")
            if width == 1280:
                add("라이브 소식지 글 링크가 배포 경로", bool(letter_href) and letter_href.startswith("/buffetkimz-web/posts/"), letter_href)

            # 실손 문장
            page.goto(f"{BASE}/apps/silson-compare/run/", wait_until="networkidle")
            page.wait_for_timeout(800)
            body = page.inner_text("body")
            if width == 1280:
                add("라이브 '4세대이' 없음", "4세대이" not in body, re.findall(r"[1-5]세대[이가] [^.]{0,30}돌려받습니다", body)[:3])
            page.screenshot(path=str(OUT / "shots" / f"live-silson-{width}.png"))

            # 홈 기준일
            page.goto(f"{BASE}/", wait_until="networkidle")
            chips = page.eval_on_selector_all(".mod-chip", "els => els.map(e => e.textContent.trim())")
            if width == 1280:
                add("라이브 홈 모듈 기준일 최신", all("11. 21." not in c for c in chips), chips)

            add(f"라이브 모든 화면 {width} 콘솔 오류 0", not errors, errors[:3])
            ctx.close()

        # 404 canonical · sitemap
        html = fetch("/404.html")
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        add(
            "라이브 404 canonical = 배포 루트",
            bool(canonical) and canonical.group(1).rstrip("/") == BASE,
            canonical.group(1) if canonical else None,
        )
        xml = fetch("/sitemap-0.xml")
        mods = sorted(set(re.findall(r"<lastmod>([^<]+)</lastmod>", xml)))
        add("라이브 사이트맵 lastmod 페이지별", len(mods) >= 4, {"distinct": len(mods), "sample": mods[:4]})
        browser.close()

    report = {"base": BASE, "checks": checks, "ok": all(c["ok"] for c in checks), "failed": [c for c in checks if not c["ok"]]}
    (OUT / "verify-live.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "checks": len(checks), "failed": report["failed"]}, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
