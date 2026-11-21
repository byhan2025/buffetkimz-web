#!/usr/bin/env python3
"""v5.9 오늘 확인 허브 — 실브라우저 캡처 + 콘솔 오류·가로 넘침 실측.

dist 를 로컬로 띄우고 1280(데스크톱) · 390(모바일 에뮬레이션)으로 연다.
  · 콘솔 오류/페이지 오류 수집
  · scrollWidth vs innerWidth 로 가로 넘침 측정 (모든 캡처 페이지)
  · 지표 스트립이 1줄인지, 칩마다 기준 시각이 보이는지, 터치 높이 44px 이상인지 측정
결과는 reports/buffetkimz-web/v59-hub/capture-notes.json 에 남긴다.
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path("/workspace/apps/buffetkimz-web/dist")
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v59-hub")
PORT = 8119
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


def wait_ready(page, settle_ms=700):
    """이미지 디코드 + 웹폰트를 기다린다.

    외부 웹폰트(CDN)가 이 환경에서 끝나지 않을 수 있으므로 fonts.ready 는 **2.5초까지만** 기다린다.
    (그대로 await 하면 브라우저가 영원히 'loading'에 머물러 캡처가 멈춘다 — 2026-11-21 실측)
    """
    page.wait_for_timeout(400)
    page.evaluate(
        """async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            await Promise.race([document.fonts.ready, wait(2500)]);
            // lazy 이미지는 decode()가 영원히 안 끝난다 — 이미 받은 것만 디코드한다.
            const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth > 0);
            await Promise.race([
                Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => null) : null))),
                wait(2500),
            ]);
            return true;
        }"""
    )
    page.wait_for_timeout(settle_ms)


def metrics(page):
    return page.evaluate(
        """() => {
            const de = document.documentElement;
            const strip = document.querySelector('.ind-strip');
            const chips = [...document.querySelectorAll('.ind-chip')];
            const rects = chips.map((c) => {
              const r = c.getBoundingClientRect();
              const meta = c.querySelector('.ind-meta');
              return {
                id: c.dataset.indicator,
                w: Math.round(r.width),
                h: Math.round(r.height),
                metaVisible: meta ? meta.scrollWidth <= meta.clientWidth + 1 : null,
                metaText: meta ? meta.innerText.replace(/\\s+/g, ' ').trim() : null,
              };
            });
            const rows = strip ? new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size : null;
            const hub = document.querySelector('[data-hub]');
            const brief = document.querySelector('[data-hub-brief]');
            return {
              innerWidth: window.innerWidth,
              scrollWidth: de.scrollWidth,
              overflow: de.scrollWidth - window.innerWidth,
              stripRows: rows,
              stripScrolls: strip ? strip.scrollWidth > strip.clientWidth + 1 : null,
              chips: rects,
              hubTop: hub ? Math.round(hub.getBoundingClientRect().top + window.scrollY) : null,
              hubHeight: hub ? Math.round(hub.getBoundingClientRect().height) : null,
              briefTopInHub: hub && brief
                ? Math.round(brief.getBoundingClientRect().top - hub.getBoundingClientRect().top)
                : null,
              itemCount: document.querySelectorAll('[data-hub-item]').length,
              cmpCols: getComputedStyle(document.querySelector('.cmp-grid') || document.body).gridTemplateColumns,
            };
        }"""
    )


def log(msg):
    print(msg, flush=True)


HIDE_HEADER = """() => {
    const st = document.createElement('style');
    st.id = 'v59-capture';
    st.textContent = '.site-header{position:static !important; visibility:hidden !important; height:0 !important;}';
    document.head.appendChild(st);
    window.scrollTo(0, 0);
    window.scrollBy(0, 1);
}"""

SHOW_HEADER = """() => {
    const st = document.getElementById('v59-capture');
    if (st) st.remove();
}"""


def capture(page, name, selector=None, scroll_to=None, full=False, hide_header=False, header_px=64):
    if scroll_to:
        page.evaluate(
            """([sel, pad]) => {
                const el = document.querySelector(sel);
                if (!el) return;
                const y = el.getBoundingClientRect().top + window.scrollY - pad;
                window.scrollTo(0, Math.max(0, y));
            }""",
            [scroll_to, header_px + 16],
        )
        page.wait_for_timeout(450)
    log(f"  capture {name}")
    if hide_header:
        page.evaluate(HIDE_HEADER)
        page.wait_for_timeout(250)
    path = OUT / f"{name}.png"
    if selector:
        page.locator(selector).first.screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=full)
    if hide_header:
        page.evaluate(SHOW_HEADER)
    return str(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    notes = {"errors": [], "pages": {}, "captures": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
        )

        for label, viewport, mobile in (
            ("1280", {"width": 1280, "height": 1000}, False),
            ("390", {"width": 390, "height": 844}, True),
        ):
            ctx = browser.new_context(
                viewport=viewport,
                device_scale_factor=2,
                is_mobile=mobile,
                has_touch=mobile,
                locale="ko-KR",
                timezone_id="Asia/Seoul",
            )
            log(f"[{label}] new page")
            page = ctx.new_page()
            page.on(
                "console",
                lambda m, lbl=label: notes["errors"].append({"viewport": lbl, "type": m.type, "text": m.text})
                if m.type in ("error", "warning") and "favicon" not in m.text.lower()
                else None,
            )
            page.on(
                "pageerror",
                lambda e, lbl=label: notes["errors"].append({"viewport": lbl, "type": "pageerror", "text": str(e)}),
            )

            base = f"http://127.0.0.1:{PORT}"
            # ① 홈 — 필름 아래 허브
            log(f"[{label}] goto /")
            page.goto(f"{base}/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            page.wait_for_timeout(1200)
            log(f"[{label}] home ready -> metrics")
            notes["pages"][f"home-{label}"] = metrics(page)

            if label == "1280":
                notes["captures"].append(capture(page, "01-home-top-1280", full=False))
            else:
                notes["captures"].append(capture(page, "03-home-hub-top-390", scroll_to="[data-hub]", full=False, header_px=105))

            # ② 허브 전체(요소 캡처)
            notes["captures"].append(
                capture(page, f"0{2 if label == '1280' else 4}-home-hub-full-{label}", selector="[data-hub]", hide_header=True)
            )

            # ③ 블로그 목록 — 시리즈 라벨
            page.goto(f"{base}/posts/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            notes["pages"][f"posts-{label}"] = metrics(page)
            notes["pages"][f"posts-{label}"]["seriesChips"] = page.evaluate(
                "() => document.querySelectorAll('.series-chip').length"
            )
            if label == "1280":
                notes["captures"].append(capture(page, "05-posts-series-1280", scroll_to="[data-post-toolbar]", header_px=48))
            else:
                notes["captures"].append(capture(page, "06-posts-series-390", scroll_to="[data-post-toolbar]", header_px=120))

            # ④ 제도달력 — D-Day
            page.goto(f"{base}/calendar/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            page.wait_for_timeout(500)
            notes["pages"][f"calendar-{label}"] = metrics(page)
            notes["pages"][f"calendar-{label}"]["dday"] = page.evaluate(
                "() => [...document.querySelectorAll('.dday')].map((d) => d.textContent.trim())"
            )
            if label == "1280":
                notes["captures"].append(capture(page, "07-calendar-dday-1280", scroll_to="[data-upcoming]", header_px=64))
            else:
                notes["captures"].append(capture(page, "08-calendar-dday-390", scroll_to="[data-upcoming]", header_px=105))

            # ⑤ A vs B 비교 — 실손 글 상세
            page.goto(f"{base}/posts/silson-switch-2026/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            page.wait_for_timeout(400)
            notes["pages"][f"compare-{label}"] = metrics(page)
            if label == "1280":
                notes["captures"].append(capture(page, "09-post-compare-1280", selector="[data-compare]", hide_header=True))
            else:
                notes["captures"].append(
                    capture(page, "10-post-compare-390", selector="[data-compare]", hide_header=True)
                )

            # ⑥ ISA 글 비교 — 두 번째 적용 확인(캡처는 390만)
            page.goto(f"{base}/posts/isa-pension-300/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            notes["pages"][f"compare-isa-{label}"] = metrics(page)
            if label == "390":
                notes["captures"].append(
                    capture(page, "11-post-compare-isa-390", selector="[data-compare]", hide_header=True)
                )

            ctx.close()

        browser.close()

    httpd.shutdown()
    (OUT / "capture-notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=2))
    print(json.dumps(notes, ensure_ascii=False, indent=2)[:2500])


if __name__ == "__main__":
    main()
