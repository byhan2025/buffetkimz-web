#!/usr/bin/env python3
"""1순위 패치 화면 캡처 (2026-11-28) — 수정 지점을 390·1280으로 남긴다."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "reports/buffetkimz-web/first-priority-20261128/shots"
PORT = 4362
BASE = f"http://127.0.0.1:{PORT}"

TARGETS = [
    ("home", "/", None),
    ("gallery-isa", "/gallery/", '[data-gallery-tag="ISA"]'),
    ("posts-list", "/posts/", 'button[data-view="text"]'),
    ("board-filter", "/board/", '[data-board-tab="제도·보험"]'),
    ("letters", "/letters/2026-11-21/", None),
    ("silson", "/apps/silson-compare/run/", None),
    ("about", "/about/", None),
]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(DIST)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for width, height in ((1280, 980), (390, 844)):
                ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
                page = ctx.new_page()
                for name, path, click in TARGETS:
                    page.goto(f"{BASE}{path}", wait_until="networkidle")
                    page.wait_for_timeout(500)
                    if click:
                        page.click(click)
                        page.wait_for_timeout(250)
                    page.screenshot(path=str(OUT / f"{name}-{width}.png"), full_page=False)
                ctx.close()
            browser.close()
    finally:
        server.terminate()
    print("saved", len(list(OUT.glob("*.png"))), "shots")
    return 0


if __name__ == "__main__":
    sys.exit(main())
