#!/usr/bin/env python3
"""v5.9.1 오늘 확인 허브 — 실브라우저 캡처 + 390px 키보드 포커스 실측.

v5.9.0(`capture_v59.py`)에 **390px 지표 칩 키보드 포커스 검증**을 더한 판.
경로는 이 파일 위치 기준 상대경로라, 압축을 풀어 옮긴 폴더에서도 그대로 돈다.

  · 콘솔 오류·가로 넘침·스트립 1줄·칩 터치 높이(v5.9.0과 동일 계측)
  · 390px에서 Tab 키로 지표 칩에 들어가 뒤쪽 칩(원/달러·S&P500·나스닥·반도체)까지 이동하며
    선택된 칩과 그 안의 기준 시각·출처(메타)가 **화면 안에 전부 보이는지** 좌표로 판정
  · 포커스 링(outline)이 실제로 그려지는지 계산값으로 확인
결과: reports/buffetkimz-web/v591-hub/capture-notes.json (+ 12-hub-focus-390.png)
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v591-hub"
PORT = 8121
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
    """이미지 디코드 + 웹폰트를 기다린다(외부 웹폰트는 2.5초까지만)."""
    page.wait_for_timeout(400)
    page.evaluate(
        """async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            await Promise.race([document.fonts.ready, wait(2500)]);
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
            const header = document.querySelector('.site-header');
            return {
              innerWidth: window.innerWidth,
              scrollWidth: de.scrollWidth,
              overflow: de.scrollWidth - window.innerWidth,
              stripRows: rows,
              stripScrolls: strip ? strip.scrollWidth > strip.clientWidth + 1 : null,
              chips: rects,
              headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
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


# 지표 칩이 실제로 화면 안에 들어왔는지 — 칩 + 메타 전체 + sticky 헤더에 가리지 않음
FOCUS_PROBE = """() => {
    const el = document.activeElement;
    if (!el || !el.classList || !el.classList.contains('ind-chip')) return null;
    const r = el.getBoundingClientRect();
    const strip = document.querySelector('.ind-strip');
    const sr = strip.getBoundingClientRect();
    const header = document.querySelector('.site-header');
    const hr = header ? header.getBoundingClientRect() : null;
    const headerSticky = header ? ['sticky', 'fixed'].includes(getComputedStyle(header).position) : false;
    const meta = el.querySelector('.ind-meta');
    const mr = meta ? meta.getBoundingClientRect() : null;
    const cs = getComputedStyle(el);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      id: el.dataset.indicator,
      rect: { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) },
      strip: { left: Math.round(sr.left), right: Math.round(sr.right), scrollLeft: Math.round(strip.scrollLeft) },
      meta: meta
        ? {
            text: meta.innerText.replace(/\\s+/g, ' ').trim(),
            left: Math.round(mr.left),
            right: Math.round(mr.right),
            clippedInside: meta.scrollWidth > meta.clientWidth + 1,
          }
        : null,
      header: hr ? { bottom: Math.round(hr.bottom), sticky: headerSticky } : null,
      outline: { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor },
      viewport: { w: vw, h: vh },
      inViewport:
        r.left >= -0.5 && r.right <= vw + 0.5 && r.top >= -0.5 && r.bottom <= vh + 0.5,
      inStrip:
        r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5,
      underHeader:
        !!hr && headerSticky && r.top < hr.bottom - 0.5,
      metaInViewport:
        !!mr && mr.left >= -0.5 && mr.right <= vw + 0.5 && mr.top >= (hr && headerSticky ? hr.bottom - 0.5 : -0.5),
      focusRingVisible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    };
}"""


def focus_walk(page, max_tabs=160):
    """Tab 키로 지표 칩까지 걸어가며, 칩마다 화면 안 표시 여부를 판정한다."""
    walk = []
    seen = []
    for tab_no in range(1, max_tabs + 1):
        page.keyboard.press("Tab")
        page.wait_for_timeout(450)  # 스크롤·포커스 링이 자리를 잡을 때까지(부드러운 스크롤)
        probe = page.evaluate(FOCUS_PROBE)
        if not probe:
            continue
        probe["tab"] = tab_no
        seen.append(probe["id"])
        walk.append(probe)
        if len(walk) >= 6:
            break
    return {"steps": walk, "order": seen, "max_tabs": max_tabs}


def log(msg):
    print(msg, flush=True)


# 390px 잘림 검사 — 화면 밖으로 나간 요소 / 의도적이지 않은 글자 잘림을 찾는다.
CLIP_PROBE = """(sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const vw = window.innerWidth;
  const outOfViewport = [];
  const textClipped = [];
  const isInScroller = (el) => {
    for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
      if (n.classList && (n.classList.contains('ind-strip') || n.classList.contains('no-scrollbar'))) return true;
    }
    return false;
  };
  for (const el of root.querySelectorAll('*')) {
    if (isInScroller(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.left < -0.5 || r.right > vw + 0.5) {
      outOfViewport.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
    const deliberate = /(^|\s)(clamp-\d|truncate|line-clamp)/.test((el.className || '').toString());
    if (!deliberate && el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(cs.overflowX)) {
      textClipped.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
    }
  }
  return {
    root: sel,
    elements: root.querySelectorAll('*').length,
    outOfViewportCount: outOfViewport.length,
    outOfViewport: outOfViewport.slice(0, 8),
    textClippedCount: textClipped.length,
    textClipped: textClipped.slice(0, 8),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: vw,
  };
}"""


def clipping_areas(page):
    return {
        "hub": page.evaluate(CLIP_PROBE, "[data-hub]"),
        "calendar": page.evaluate(CLIP_PROBE, "main"),
        "compare-silson": page.evaluate(CLIP_PROBE, "[data-compare]"),
    }


def record_clip(notes, page, key):
    """390 화면에서 그 영역이 화면 밖으로 나가거나 글자가 잘리지 않았는지 기록."""
    area = page.evaluate(CLIP_PROBE, "[data-hub]" if key == "hub" else "main" if key == "calendar" else "[data-compare]")
    notes.setdefault("clip390", {})[key] = area
    return area


def fresh_state(page):
    return page.evaluate(
        """() => {
            const sec = document.querySelector('[data-hub]');
            const badge = sec.querySelector(':scope [data-fresh-badge]');
            const next = sec.querySelector(':scope [data-hub-next]');
            const items = [...document.querySelectorAll('[data-hub-item]')].map((li) => ({
              id: li.dataset.hubItem,
              state: li.dataset.fresh,
              badgeHidden: li.querySelector('[data-fresh-badge]').hidden,
              label: li.querySelector('.hub-fresh-label').textContent.trim(),
            }));
            return {
              state: sec.dataset.fresh,
              checkedAt: sec.dataset.freshCheckedAt || null,
              badgeHidden: badge.hidden,
              badgeLabel: badge.querySelector('.hub-fresh-label').textContent.trim(),
              badgeDetail: badge.querySelector('.hub-fresh-detail').textContent.trim(),
              nextHidden: next.hidden,
              nextText: next.textContent.trim(),
              items,
            };
        }"""
    )


def runtime_scenarios(browser, base):
    """미래 시각을 모킹해 '확인 지연'으로 바뀌는지, 1분 간격 재계산이 도는지 실측한다.

    clock.install() 은 페이지 스크립트보다 먼저 걸어야 하므로 navigation 전에 호출한다.
    """
    out = {}

    def scenario(name, start, ff=None, shot=None):
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="ko-KR",
            timezone_id="Asia/Seoul",
        )
        page = ctx.new_page()
        page.clock.install(time=start)
        page.goto(f"{base}/", wait_until="domcontentloaded", timeout=20000)
        wait_ready(page)
        page.wait_for_timeout(600)
        before = fresh_state(page)
        after = None
        if ff:
            page.clock.fast_forward(ff)
            page.wait_for_timeout(250)
            after = fresh_state(page)
        if shot:
            page.evaluate(
                """() => {
                    const el = document.querySelector('[data-hub]');
                    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 106);
                }"""
            )
            page.wait_for_timeout(400)
            capture(page, shot)
        out[name] = {"start": start, "fastForward": ff, "atLoad": before, "afterFastForward": after}
        ctx.close()

    scenario("ok-before-next-check", "2026-11-21T18:30:00+09:00")
    scenario("delayed-at-load", "2026-11-21T19:30:00+09:00", shot="13-hub-stale-runtime")
    scenario("interval-flips", "2026-11-21T18:59:00+09:00", ff="01:30")
    scenario("stale-after-3days", "2026-11-25T10:00:00+09:00")
    return out


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
    notes = {"version": "5.9.1", "errors": [], "pages": {}, "captures": [], "focus": {}}

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
            if label == "390":
                record_clip(notes, page, "hub")

            if label == "1280":
                notes["captures"].append(capture(page, "01-home-top-1280", full=False))
            else:
                notes["captures"].append(capture(page, "03-home-hub-top-390", scroll_to="[data-hub]", full=False, header_px=105))

            # ② 허브 전체(요소 캡처)
            notes["captures"].append(
                capture(page, f"0{2 if label == '1280' else 4}-home-hub-full-{label}", selector="[data-hub]", hide_header=True)
            )

            # ②-b 390 키보드 포커스 — 뒤쪽 칩까지 Tab으로 이동
            if label == "390":
                page.goto(f"{base}/", wait_until="domcontentloaded", timeout=20000)
                wait_ready(page)
                page.wait_for_timeout(600)
                log("[390] focus walk (Tab)")
                walk = focus_walk(page)
                notes["focus"] = walk
                # 원/달러·나스닥 포커스 순간을 각각 캡처
                for chip_id, shot in (("usdkrw", "12-home-focus-usdkrw-390"), ("nasdaq", "12b-home-focus-nasdaq-390")):
                    page.goto(f"{base}/", wait_until="domcontentloaded", timeout=20000)
                    wait_ready(page)
                    page.wait_for_timeout(400)
                    step = next((s for s in walk["steps"] if s["id"] == chip_id), None)
                    if step is None:
                        continue
                    for _ in range(step["tab"]):
                        page.keyboard.press("Tab")
                    page.wait_for_timeout(700)
                    notes["focus"].setdefault("captures", {}).setdefault(chip_id, {})
                    notes["focus"]["captures"][chip_id] = {"shot": capture(page, shot), "probe": page.evaluate(FOCUS_PROBE)}

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
            if label == "390":
                record_clip(notes, page, "calendar")
            if label == "1280":
                notes["captures"].append(capture(page, "07-calendar-dday-1280", scroll_to="[data-upcoming]", header_px=64))
            else:
                notes["captures"].append(capture(page, "08-calendar-dday-390", scroll_to="[data-upcoming]", header_px=105))

            # ⑤ A vs B 비교 — 실손 글 상세
            page.goto(f"{base}/posts/silson-switch-2026/", wait_until="domcontentloaded", timeout=20000)
            wait_ready(page)
            page.wait_for_timeout(400)
            notes["pages"][f"compare-{label}"] = metrics(page)
            if label == "390":
                record_clip(notes, page, "compare-silson")
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

        # ⑦ 런타임 신선도 — 미래 시각 모킹(확인 지연·지난 정보·1분 경과)
        log("[runtime] clock mock scenarios")
        notes["runtime"] = runtime_scenarios(browser, f"http://127.0.0.1:{PORT}")
        notes["captures"].append(str(OUT / "13-hub-stale-runtime.png"))

        browser.close()

    httpd.shutdown()
    (OUT / "capture-notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=2))
    focus = notes.get("focus") or {}
    log(json.dumps({k: focus.get(k) for k in ("order",)}, ensure_ascii=False))
    for step in focus.get("steps", []):
        log(
            f"  {step['id']:9s} inViewport={step['inViewport']} inStrip={step['inStrip']} "
            f"underHeader={step['underHeader']} metaInViewport={step['metaInViewport']} ring={step['focusRingVisible']} "
            f"rect={step['rect']} strip={step['strip']}"
        )
    log(json.dumps(notes.get("clip390", {}), ensure_ascii=False)[:1200])
    log(json.dumps({k: {"atLoad": v["atLoad"]["state"], "after": (v["afterFastForward"] or {}).get("state")} for k, v in notes.get("runtime", {}).items()}, ensure_ascii=False))
    log(f"saved {OUT / 'capture-notes.json'}")


if __name__ == "__main__":
    main()
