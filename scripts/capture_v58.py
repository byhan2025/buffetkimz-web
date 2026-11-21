#!/usr/bin/env python3
"""v5.8 실브라우저 캡처 — dist를 로컬로 띄우고 1280·390 화면을 찍는다."""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path("/workspace/apps/buffetkimz-web/dist")
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
PORT = 8099
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


PREP = """
() => new Promise((resolve) => {
  const bar = document.querySelector('[data-post-toolbar]');
  const y = bar ? bar.getBoundingClientRect().top + window.scrollY - 80 : 0;
  window.scrollTo(0, Math.max(0, y));
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    setTimeout(resolve, 300);
  };
  setTimeout(finish, 2500);
  const imgs = [...document.images];
  Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => null) : Promise.resolve(null)))).then(finish);
})
"""


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    base = f"http://127.0.0.1:{PORT}"
    notes = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])

        # ── 1280 목록 ────────────────────────────────────────────────
        page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        page.goto(f"{base}/posts/", wait_until="networkidle")
        page.evaluate("localStorage.removeItem('bkz-post-list')")
        page.reload(wait_until="networkidle")
        page.evaluate(
            "() => { const h = document.getElementById('picks-heading'); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 150); }"
        )
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "01a-posts-picks-1280.png"))
        page.evaluate(PREP)
        page.screenshot(path=str(OUT / "01-posts-list-1280-card.png"))
        page.click('[data-view="text"]')
        page.wait_for_timeout(250)
        page.evaluate(PREP)
        page.screenshot(path=str(OUT / "02-posts-list-1280-text.png"))
        notes["imgsLoaded"] = page.evaluate(
            "() => [...document.querySelectorAll('[data-post-cards] img')].map(i => i.naturalWidth).filter(w => w > 0).length"
        )
        notes["list1280"] = page.evaluate(
            "() => ({view: document.querySelector('[data-post-cards]').dataset.viewMode, pressed: [...document.querySelectorAll('button[data-view]')].map(b=>[b.dataset.view,b.getAttribute('aria-pressed')]), sort: [...document.querySelectorAll('[data-sort]')].map(b=>[b.dataset.sort,b.getAttribute('aria-pressed')]), first: document.querySelector('[data-post-cards] li').dataset.title})"
        )
        # 정렬 동작 확인
        page.click('[data-sort="title"]')
        page.wait_for_timeout(150)
        notes["sortTitleFirst"] = page.evaluate("() => document.querySelector('[data-post-cards] li').dataset.title")
        page.close()

        # ── 홈 (상담 창구 → 편집 원칙 배너) ────────────────────────
        page = browser.new_page(viewport={"width": 1280, "height": 950}, device_scale_factor=1)
        page.goto(f"{base}/", wait_until="networkidle")
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight - 1400)")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "10-home-1280-bottom.png"))
        page.close()

        # ── 390 목록 ────────────────────────────────────────────────
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page.goto(f"{base}/posts/", wait_until="networkidle")
        page.evaluate("localStorage.removeItem('bkz-post-list')")
        page.reload(wait_until="networkidle")
        page.evaluate(PREP)
        page.screenshot(path=str(OUT / "03-posts-list-390-card.png"))
        page.click('[data-view="text"]')
        page.wait_for_timeout(250)
        page.evaluate(PREP)
        page.screenshot(path=str(OUT / "04-posts-list-390-text.png"))
        notes["overflow390"] = page.evaluate("() => ({sw: document.documentElement.scrollWidth, iw: innerWidth})")
        page.close()

        # ── 글 상세 (1280) ───────────────────────────────────────────
        page = browser.new_page(viewport={"width": 1280, "height": 1500}, device_scale_factor=1)
        page.goto(f"{base}/posts/silson-switch-2026/", wait_until="networkidle")
        page.screenshot(path=str(OUT / "05-post-detail-1280-top.png"))
        # 목차 앵커가 고정 헤더에 가리지 않는지 (스크롤이 끝난 뒤 측정)
        page.evaluate("() => document.querySelector('.toc-link').click()")
        page.wait_for_timeout(900)
        notes["tocAnchor"] = page.evaluate(
            """() => {
              const a = document.querySelector('.toc-link');
              const id = decodeURIComponent(a.getAttribute('href').slice(1));
              const h = document.getElementById(id);
              const hd = document.querySelector('header.site-header');
              const r = h.getBoundingClientRect();
              return { id, top: Math.round(r.top), headerH: hd ? Math.round(hd.getBoundingClientRect().height) : 0, hidden: r.top < (hd ? hd.getBoundingClientRect().height : 0) };
            }"""
        )
        page.screenshot(path=str(OUT / "05b-post-detail-1280-toc-jump.png"))
        page.close()

        # ── 글 상세 (390) ───────────────────────────────────────────
        page = browser.new_page(viewport={"width": 390, "height": 1200}, device_scale_factor=2)
        page.goto(f"{base}/posts/silson-switch-2026/", wait_until="networkidle")
        page.screenshot(path=str(OUT / "06-post-detail-390-top.png"))
        notes["detail390"] = page.evaluate(
            """() => {
              const toc = document.querySelector('details.toc');
              const tool = document.querySelector('[data-post-tool]');
              const disc = document.querySelector('[data-post-disclaimer]');
              const side = document.querySelector('[data-post-sidebar-mobile]');
              const r = (e) => e ? e.getBoundingClientRect() : null;
              return {
                overflow: { sw: document.documentElement.scrollWidth, iw: innerWidth },
                tocOpen: toc ? toc.open : null,
                tocSummary: toc ? toc.querySelector('summary').textContent.trim() : null,
                gapToolToDisc: tool && disc ? Math.round(r(disc).top - r(tool).bottom) : null,
                sideVisible: side ? getComputedStyle(side).display !== 'none' : null,
                sideTop: side ? Math.round(r(side).top + scrollY) : null,
                toolTop: tool ? Math.round(r(tool).top + scrollY) : null,
                discTop: disc ? Math.round(r(disc).top + scrollY) : null,
                docH: document.documentElement.scrollHeight,
              };
            }"""
        )
        notes["detail390"]["related"] = page.evaluate(
            """() => {
              const rel = document.querySelector('[data-post-related]');
              const tool = document.querySelector('[data-post-tool]');
              const disc = document.querySelector('[data-post-disclaimer]');
              const r = (e) => e.getBoundingClientRect();
              return {
                count: rel ? rel.querySelectorAll('li').length : 0,
                heading: rel ? rel.querySelector('h2').textContent.trim() : null,
                relTop: rel ? Math.round(r(rel).top + scrollY) : null,
                relBottom: rel ? Math.round(r(rel).bottom + scrollY) : null,
                gapRelatedToTool: rel && tool ? Math.round(r(tool).top - r(rel).bottom) : null,
              };
            }"""
        )
        # '함께 읽는 기록' → '이어지는 도구' → ※ 면책 구간 (07b)
        relbox = page.evaluate(
            """() => {
              const rel = document.querySelector('[data-post-related]');
              const disc = document.querySelector('[data-post-disclaimer]');
              const t = rel.getBoundingClientRect().top + scrollY;
              const b = disc.getBoundingClientRect().bottom + scrollY;
              return { x: 0, y: Math.max(0, t - 24), width: innerWidth, height: b - t + 48 };
            }"""
        )
        page.screenshot(
            path=str(OUT / "07b-post-detail-390-related.png"),
            full_page=True,
            clip={"x": relbox["x"], "y": relbox["y"], "width": relbox["width"], "height": relbox["height"]},
        )
        notes["relatedShot390"] = relbox

        # 도구 카드 ~ 모바일 사이드바 끝까지 한 장
        box = page.evaluate(
            """() => {
              const tool = document.querySelector('[data-post-tool]');
              const side = document.querySelector('[data-post-sidebar-mobile]');
              const t = tool.getBoundingClientRect().top + scrollY;
              const b = side.getBoundingClientRect().bottom + scrollY;
              return { x: 0, y: Math.max(0, t - 30), width: innerWidth, height: Math.min(innerHeight * 3, b - t + 60), full: true };
            }"""
        )
        page.screenshot(
            path=str(OUT / "07-post-detail-390-bottom.png"),
            full_page=True,
            clip={"x": box["x"], "y": box["y"], "width": box["width"], "height": box["height"]},
        )
        page.close()

        # ── 편집 원칙 ───────────────────────────────────────────────
        page = browser.new_page(viewport={"width": 1280, "height": 1500}, device_scale_factor=1)
        page.goto(f"{base}/principles/", wait_until="networkidle")
        page.screenshot(path=str(OUT / "08-principles-1280.png"), full_page=True)
        page.close()
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page.goto(f"{base}/principles/", wait_until="networkidle")
        page.screenshot(path=str(OUT / "09-principles-390.png"), full_page=True)
        notes["principles390"] = page.evaluate(
            "() => ({sw: document.documentElement.scrollWidth, iw: innerWidth, items: document.querySelectorAll('[data-principles] li').length})"
        )
        page.close()

        browser.close()
    httpd.shutdown()
    (OUT / "capture-notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(notes, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
