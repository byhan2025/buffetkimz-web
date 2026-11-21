#!/usr/bin/env python3
"""v5.8.2 1:1 상담문의 복원 실측 캡처 — dist를 로컬로 띄우고 화면을 찍는다.

- 10-home-1280-bottom.png : 홈 하단 채널 밴드(1:1 상담문의 + 편집 원칙) + 푸터
- 11-about-1280-restored.png : /about 채널 목록의 복원된 1:1 상담문의 행
- 12-home-390-band.png : 모바일에서 배너가 넘치지 않는지 확인용
- 08-principles-1280.png / 09-principles-390.png : 03번 항목 문구 다듬은 최신 편집 원칙
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path("/workspace/apps/buffetkimz-web/dist")
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
PORT = 8096
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


def stitch(paths, out_path, gap=0, bg=(255, 255, 255)):
    """여러 세로 이미지를 이어 붙인다."""
    from PIL import Image

    imgs = [Image.open(p).convert("RGB") for p in paths]
    width = max(i.width for i in imgs)
    height = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
    canvas = Image.new("RGB", (width, height), bg)
    y = 0
    for i in imgs:
        canvas.paste(i, (0, y))
        y += i.height + gap
    canvas.save(out_path)
    print("stitched", out_path, canvas.size, flush=True)


def open_page(browser, base, path, width, height):
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
    page.goto(f"{base}{path}", wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)
    return page


def shot_region(page, path, top_y, height, width, pad_top=0, pad_bottom=0):
    """문서 좌표 top_y에서 height만큼 — 뷰포트를 그 높이로 키워 스크롤 뒤 찍는다."""
    vh = min(int(height + pad_top + pad_bottom), 4000)
    page.set_viewport_size({"width": width, "height": vh})
    page.wait_for_timeout(300)
    page.evaluate(f"() => window.scrollTo(0, {max(0, int(top_y - pad_top))})")
    page.wait_for_timeout(600)
    page.screenshot(path=str(path))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    base = f"http://127.0.0.1:{PORT}"
    notes = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        print("launched", flush=True)

        # ── 홈 하단 (채널 밴드 + 푸터) ─────────────────────────────
        page = open_page(browser, base, "/", 1280, 950)
        band = page.evaluate(
            """() => {
              const b = document.querySelector('[data-contact-banner]');
              const f = document.querySelector('footer');
              const top = b.getBoundingClientRect().top + scrollY;
              const bottom = f.getBoundingClientRect().bottom + scrollY;
              return { top, bottom, height: bottom - top, bandH: Math.round(b.getBoundingClientRect().height), footH: Math.round(f.getBoundingClientRect().height) };
            }"""
        )
        print("home box", band, flush=True)
        page.locator("#channels").screenshot(path="/tmp/_home_section.png")
        page.locator("footer").screenshot(path="/tmp/_home_footer.png")
        stitch(["/tmp/_home_section.png", "/tmp/_home_footer.png"], OUT / "10-home-1280-bottom.png")
        notes["home1280"] = page.evaluate(
            """() => {
              const b = document.querySelector('[data-contact-banner]');
              const t = (e) => e ? e.textContent.replace(/\\s+/g, ' ').trim() : null;
              const ka = b.querySelector('a[href*="pf.kakao.com"]');
              const pr = b.querySelector('a[href*="/principles"]');
              const foot = document.querySelector('footer');
              const r = (e) => { const x = e.getBoundingClientRect(); return { w: Math.round(x.width), h: Math.round(x.height) }; };
              return {
                bandText: t(b),
                bandBg: getComputedStyle(b).backgroundColor,
                kakao: ka ? { text: t(ka), href: ka.getAttribute('href'), target: ka.getAttribute('target'), rel: ka.getAttribute('rel'), ...r(ka) } : null,
                principlesInBand: pr ? { text: t(pr), href: pr.getAttribute('href'), ...r(pr) } : null,
                footerKakao: [...foot.querySelectorAll('a[href*="pf.kakao.com"]')].map(a => ({ text: t(a), ...r(a) })),
                footerPrinciples: [...foot.querySelectorAll('a[href*="/principles"]')].map(a => t(a)),
                footerDisclaimer: ([...foot.querySelectorAll('p')].map(t).find(x => x && x.includes('buffetkimz는')) || null),
                overflow: { sw: document.documentElement.scrollWidth, iw: innerWidth },
              };
            }"""
        )
        page.close()
        print("home shot", flush=True)

        # ── /about 복원 화면 ────────────────────────────────────────
        page = open_page(browser, base, "/about/", 1280, 1000)
        box = page.evaluate(
            """() => {
              const sec = document.querySelector('#channels');
              const h = sec.querySelector('h2');
              const last = sec.querySelector('p.mt-4:last-of-type');
              const top = h.getBoundingClientRect().top + scrollY;
              const bottom = (last || sec.querySelector('ul')).getBoundingClientRect().bottom + scrollY;
              return { top, bottom, height: bottom - top };
            }"""
        )
        print("about box", box, flush=True)
        page.locator("#channels").screenshot(path=str(OUT / "11-about-1280-restored.png"))
        notes["about1280"] = page.evaluate(
            """() => {
              const sec = document.querySelector('#channels');
              const t = (e) => e ? e.textContent.replace(/\\s+/g, ' ').trim() : null;
              const ka = sec.querySelector('a[href*="pf.kakao.com"]');
              return {
                rows: [...sec.querySelectorAll('ul li')].map(li => t(li)),
                kakaoRow: ka ? { text: t(ka.closest('li')), href: ka.getAttribute('href'), cls: ka.className, target: ka.getAttribute('target') } : null,
                note: t(sec.querySelector('p.mt-4')),
                principles: [...sec.querySelectorAll('a[href*="/principles"]')].map(a => t(a)),
              };
            }"""
        )
        page.close()
        print("about shot", flush=True)

        # ── 모바일 390 — 배너 넘침 확인 ────────────────────────────
        page = open_page(browser, base, "/", 390, 844)
        page.locator('[data-contact-banner]').scroll_into_view_if_needed()
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / "12-home-390-band.png"))
        notes["home390"] = page.evaluate(
            """() => {
              const b = document.querySelector('[data-contact-banner]');
              const ka = b.querySelector('a[href*="pf.kakao.com"]');
              const pr = b.querySelector('a[href*="/principles"]');
              const r = (e) => { const x = e.getBoundingClientRect(); return { w: Math.round(x.width), h: Math.round(x.height), l: Math.round(x.left), r: Math.round(x.right) }; };
              return { overflow: { sw: document.documentElement.scrollWidth, iw: innerWidth }, kakao: r(ka), principlesLink: r(pr) };
            }"""
        )
        page.close()
        print("390 shot", flush=True)

        # ── 편집 원칙 (03번 문구 최신) ─────────────────────────────
        page = open_page(browser, base, "/principles/", 1280, 1500)
        doc_h = page.evaluate("() => document.documentElement.scrollHeight")
        page.set_viewport_size({"width": 1280, "height": min(doc_h, 4000)})
        page.wait_for_timeout(500)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "08-principles-1280.png"))
        notes["principles1280"] = page.evaluate(
            """() => {
              const t = (e) => e ? e.textContent.replace(/\\s+/g, ' ').trim() : null;
              const items = [...document.querySelectorAll('[data-principles] li')];
              const third = items.find(li => li.querySelector('.mono') && li.querySelector('.mono').textContent.trim() === '03');
              return { docH: document.documentElement.scrollHeight, count: items.length, third: t(third), overflow: { sw: document.documentElement.scrollWidth, iw: innerWidth } };
            }"""
        )
        page.close()

        page = open_page(browser, base, "/principles/", 390, 844)
        doc_h = page.evaluate("() => document.documentElement.scrollHeight")
        page.set_viewport_size({"width": 390, "height": min(doc_h, 4000)})
        page.wait_for_timeout(500)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "09-principles-390.png"))
        notes["principles390"] = page.evaluate(
            "() => ({ docH: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, items: document.querySelectorAll('[data-principles] li').length })"
        )
        page.close()
        print("principles shots", flush=True)

        browser.close()
    httpd.shutdown()
    (OUT / "capture-restore-notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(notes, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
