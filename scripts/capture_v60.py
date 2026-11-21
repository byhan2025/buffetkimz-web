#!/usr/bin/env python3
"""v6.0 실측 캡처 — v5.9.2 캡처 하네스(`capture_v592.py`)를 이 빌드에 다시 돌리고,
v6.0에서 새로 생긴 것(390 지표 2열×3행 격자·3줄 복사 버튼·연금 인출 도구·본문 표)을 더 잰다.

결과: reports/buffetkimz-web/v60-live/capture-notes.json (+ PNG)
  · 기존 계측: 페이지 가로 넘침 · 지표 칩 · 키보드 포커스 · 390 잘림 · 런타임 신선도
  · v6.0 추가: 격자(행×열)·한 화면 표시·[3줄 복사] 동작·연금 인출 390/1280(최소 글자·탭 높이·즉시 반영·저장 0)
    · 본문 표 헤더 줄 수(390에서 1줄)·가로 스크롤 표 목록·수치 셀 표시

사용:
  npm run build
  LD_LIBRARY_PATH=/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu python3 scripts/capture_v60.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import capture_v592 as base  # noqa: E402

APP = base.APP
REPO = APP.parent.parent
OUT = REPO / "reports" / "buffetkimz-web" / "v60-live"
BASE = f"http://127.0.0.1:{base.PORT}"

# 본문 표가 있는 글 — 390/1280에서 헤더가 몇 줄로 꺾이는지, 표가 넘치는지
TABLE_POSTS = [
    "isa-pension-300",
    "retire-fixed-cost",
    "silson-switch-2026",
    "insurance-silson-5th",
    "finance-rate-gap",
    "pension-tax-order",
    "economy-service-prices",
]

GRID_JS = """() => {
  const chips = [...document.querySelectorAll('.ind-chip')];
  const strip = document.querySelector('.ind-strip');
  const hub = document.querySelector('[data-hub]');
  const header = document.querySelector('.site-header');
  const vh = window.innerHeight;
  const headBottom = header ? header.getBoundingClientRect().bottom : 0;
  const tops = [...new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top)))];
  const lefts = [...new Set(chips.map((c) => Math.round(c.getBoundingClientRect().left)))];
  return {
    rows: tops.length,
    cols: lefts.length,
    scrolls: strip ? strip.scrollWidth > strip.clientWidth + 1 : null,
    stripOverflowX: strip ? getComputedStyle(strip).overflowX : null,
    fadeWidth: getComputedStyle(document.querySelector('[data-strip-wrap]'), '::after').width,
    hubTop: hub ? Math.round(hub.getBoundingClientRect().top) : null,
    allInViewport: chips.every((c) => {
      const r = c.getBoundingClientRect();
      return r.top >= headBottom - 0.5 && r.bottom <= vh + 0.5;
    }),
    chips: chips.map((c) => {
      const r = c.getBoundingClientRect();
      const meta = c.querySelector('.ind-meta');
      return {
        id: c.dataset.indicator,
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        metaVisible: meta ? meta.scrollWidth <= meta.clientWidth + 1 : null,
      };
    }),
  };
}"""

PDRAW_JS = """() => {
  const root = document.querySelector('[data-pdraw]');
  if (!root) return null;
  let minFont = 99;
  const walk = (el) => {
    if (el.nodeType !== 1) return;
    const cs = getComputedStyle(el);
    if (el.children.length === 0 && (el.textContent || '').trim()) {
      const fs = parseFloat(cs.fontSize);
      if (fs > 0) minFont = Math.min(minFont, fs);
    }
    for (const c of el.children) walk(c);
  };
  walk(root);
  const taps = [...root.querySelectorAll('button, a, input')]
    .filter((el) => el.offsetParent !== null && !(el.tagName === 'INPUT' && el.type === 'checkbox'))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), h: Math.round(r.height), w: Math.round(r.width), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 18) };
    });
  const checklistRows = [...root.querySelectorAll('label')].filter((l) => l.querySelector('input[type=checkbox]')).map((l) => Math.round(l.getBoundingClientRect().height));
  const card = [...root.querySelectorAll('div')].find((d) => d.className.includes('bg-brand') && d.textContent.includes('결론'));
  const sticky = document.querySelector('[data-sticky-summary]');
  const nextLink = [...root.querySelectorAll('a')].find((a) => a.getAttribute('href') && a.getAttribute('href').includes('/apps/pension-tax/run'));
  const inputs = [...root.querySelectorAll('input[type=range]')].map((i) => ({ min: i.min, max: i.max, value: i.value }));
  return {
    minFont,
    minTap: taps.length ? Math.min(...taps.map((t) => t.h)) : null,
    taps,
    checklistMin: checklistRows.length ? Math.min(...checklistRows) : null,
    verdict: card ? card.innerText.replace(/\\s+/g, ' ').trim() : null,
    options: [...root.querySelectorAll('[data-pdraw] .rounded-\\\\[14px\\\\]')].length,
    stickyVisible: sticky ? getComputedStyle(sticky).display !== 'none' : false,
    stickyText: sticky ? sticky.innerText.replace(/\\s+/g, ' ').trim() : null,
    nextLink: nextLink ? { href: nextLink.getAttribute('href'), text: nextLink.textContent.trim(), h: Math.round(nextLink.getBoundingClientRect().height) } : null,
    copyButton: (() => {
      const b = [...root.querySelectorAll('button')].find((x) => x.textContent.includes('5줄 복사'));
      return b ? { text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) } : null;
    })(),
    memoSnippet: (() => {
      const pre = root.querySelector('pre');
      return pre ? pre.textContent.split('\\n').length : null;
    })(),
    sliders: inputs,
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
}"""

TABLE_JS = """() => {
  const wraps = [...document.querySelectorAll('.prose-article .table-wrap')];
  return {
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    tables: wraps.map((w) => {
      const t = w.querySelector('table');
      const cs = getComputedStyle(t);
      const lh = parseFloat(cs.lineHeight) || 20;
      return {
        wrapWidth: Math.round(w.getBoundingClientRect().width),
        tableWidth: Math.round(t.getBoundingClientRect().width),
        scrolls: w.scrollWidth > w.clientWidth + 1,
        cols: t.querySelectorAll('thead th').length,
        numCells: t.querySelectorAll('.is-num').length,
        headers: [...t.querySelectorAll('thead th')].map((x) => {
          const hs = getComputedStyle(x);
          const r = x.getBoundingClientRect();
          return {
            text: x.textContent.trim().slice(0, 24),
            width: Math.round(r.width),
            lines: Math.max(1, Math.round((r.height - parseFloat(hs.paddingTop) - parseFloat(hs.paddingBottom)) / lh)),
            nowrap: hs.whiteSpace,
          };
        }),
      };
    }),
  };
}"""


def v60_probes(browser) -> dict:
    out: dict = {"grid390": None, "grid1280": None, "copy": None, "pensionDraw": {}, "tables": {}, "captures": []}

    def new_ctx(width, height, mobile):
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
            is_mobile=mobile,
            has_touch=mobile,
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            permissions=["clipboard-read", "clipboard-write"],
        )
        return ctx

    # ① 390 지표 격자 — 허브를 화면 위로 올린 뒤 6개가 한 화면에 다 보이는지
    ctx = new_ctx(390, 844, True)
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    base.wait_ready(page)
    page.evaluate(
        """() => {
            const hub = document.querySelector('[data-hub]');
            const head = document.querySelector('.site-header');
            const h = head ? head.getBoundingClientRect().height : 0;
            window.scrollTo(0, hub.getBoundingClientRect().top + window.scrollY - h - 16);
        }"""
    )
    page.wait_for_timeout(500)
    out["grid390"] = page.evaluate(GRID_JS)
    out["captures"].append(base.capture(page, "20-home-grid-390", selector="[data-indicator-strip]", hide_header=True))

    # ② 3줄 복사 — 실제 클립보드에 3줄이 들어가는지
    page.evaluate("() => window.scrollTo(0, document.querySelector('[data-hub]').getBoundingClientRect().top + window.scrollY - 120)")
    page.wait_for_timeout(300)
    before = page.inner_text("[data-hub-copy]").strip()
    page.click("[data-hub-copy]")
    page.wait_for_timeout(400)
    after = page.inner_text("[data-hub-copy]").strip()
    try:
        clip = page.evaluate("() => navigator.clipboard.readText()")
    except Exception as exc:  # noqa: BLE001
        clip = f"<read failed: {exc}>"
    out["copy"] = {"labelBefore": before, "labelAfter": after, "clipboard": clip, "lines": len(clip.splitlines()) if isinstance(clip, str) else None}
    out["captures"].append(base.capture(page, "21-home-brief-copy-390", selector="[data-hub-brief]", hide_header=True))
    ctx.close()

    # ③ 1280 — 6열 1줄 유지
    ctx = new_ctx(1280, 900, False)
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    base.wait_ready(page)
    page.evaluate(
        """() => {
            const hub = document.querySelector('[data-hub]');
            const head = document.querySelector('.site-header');
            const h = head ? head.getBoundingClientRect().height : 0;
            window.scrollTo(0, hub.getBoundingClientRect().top + window.scrollY - h - 16);
        }"""
    )
    page.wait_for_timeout(400)
    out["grid1280"] = page.evaluate(GRID_JS)
    out["captures"].append(base.capture(page, "22-home-grid-1280", selector="[data-indicator-strip]", hide_header=True))
    ctx.close()

    # ④ 연금 인출·세금 시뮬레이터 — 390/1280
    for label, w, h, mobile in (("390", 390, 844, True), ("1280", 1280, 900, False)):
        ctx = new_ctx(w, h, mobile)
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda exc, e=errors: e.append(str(exc)))
        page.goto(f"{BASE}/apps/pension-draw/run/", wait_until="networkidle")
        page.wait_for_timeout(900)
        m = page.evaluate(PDRAW_JS)
        m["consoleErrors"] = errors
        m["storage"] = page.evaluate(
            """() => ({
                local: Object.keys(localStorage).length,
                session: Object.keys(sessionStorage).length,
                cookies: document.cookie.split(';').filter(Boolean).length,
            })"""
        )
        # 즉시 반영 — 계산 버튼 없이 슬라이더를 움직이면 결론이 바뀌는지
        head_before = page.inner_text("[data-pdraw] [aria-live]").strip()
        page.evaluate(
            """() => {
                const r = document.querySelectorAll('[data-pdraw] input[type=range]')[1];
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(r, '3000');
                r.dispatchEvent(new Event('input', { bubbles: true }));
            }"""
        )
        page.wait_for_timeout(500)
        head_after = page.inner_text("[data-pdraw] [aria-live]").strip()
        m["liveUpdate"] = {"before": head_before, "after": head_after, "changed": head_before != head_after}
        m["calcButton"] = page.evaluate(
            "() => [...document.querySelectorAll('[data-pdraw] button')].some((b) => /^(계산|계산하기|결과 보기)$/.test(b.textContent.trim()))"
        )
        # 5줄 메모 복사
        page.click("text=내 결과 5줄 복사")
        page.wait_for_timeout(500)
        m["memo"] = {
            "buttonLabel": page.inner_text("[data-pdraw] button:has-text('복사')").strip(),
            "lines": page.evaluate("() => { const p = document.querySelector('[data-pdraw] pre'); return p ? p.textContent.split('\\n').length : null; }"),
            "text": page.evaluate("() => { const p = document.querySelector('[data-pdraw] pre'); return p ? p.textContent : null; }"),
        }
        out["pensionDraw"][label] = m
        page.screenshot(path=str(OUT / f"pension-draw-{label}.png"), full_page=True)
        page.evaluate("() => window.scrollTo(0, document.querySelector('[data-pdraw]').getBoundingClientRect().top + window.scrollY - 80)")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / f"pension-draw-{label}-top.png"))
        out["captures"].append(str(OUT / f"pension-draw-{label}.png"))
        ctx.close()

    # ⑤ 본문 표 — 글마다 390/1280 헤더 줄 수·넘침
    for label, w, h, mobile in (("390", 390, 844, True), ("1280", 1280, 900, False)):
        ctx = new_ctx(w, h, mobile)
        page = ctx.new_page()
        for slug in TABLE_POSTS:
            page.goto(f"{BASE}/posts/{slug}/", wait_until="networkidle")
            page.wait_for_timeout(350)
            out["tables"][f"{slug}-{label}"] = page.evaluate(TABLE_JS)
            if label == "390":
                for i, el in enumerate(page.query_selector_all(".prose-article .table-wrap")):
                    path = OUT / f"table-{slug}-390-{i}.png"
                    el.screenshot(path=str(path))
                    out["captures"].append(str(path))
        ctx.close()

    # ⑥ 대표 글 전체 캡처 (1280/390) — 표가 들어간 자리까지
    for label, w, h, mobile in (("390", 390, 844, True), ("1280", 1280, 900, False)):
        ctx = new_ctx(w, h, mobile)
        page = ctx.new_page()
        page.goto(f"{BASE}/posts/isa-pension-300/", wait_until="networkidle")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / f"post-isa-{label}.png"), full_page=True)
        out["captures"].append(str(OUT / f"post-isa-{label}.png"))
        ctx.close()
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    base.OUT = OUT
    base.main()

    notes_path = OUT / "capture-notes.json"
    notes = json.loads(notes_path.read_text(encoding="utf-8"))
    notes["version"] = "6.0.0"
    notes["based_on"] = "capture_v592.py (v5.9.2 하네스 재실행) + v6.0 격자·복사·연금 인출·표 계측"

    os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
    from playwright.sync_api import sync_playwright  # noqa: E402

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=base.CHROME,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
        )
        httpd = base.serve()  # base.main()이 자기 서버를 내렸으므로 다시 띄운다
        try:
            notes["v60"] = v60_probes(browser)
        finally:
            httpd.shutdown()
        browser.close()

    notes_path.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    v60 = notes["v60"]
    print(json.dumps({
        "grid390": {k: v60["grid390"][k] for k in ("rows", "cols", "scrolls", "allInViewport")},
        "grid1280": {k: v60["grid1280"][k] for k in ("rows", "cols", "scrolls")},
        "copy": v60["copy"],
        "pdraw390": {k: v60["pensionDraw"]["390"][k] for k in ("minFont", "minTap", "liveUpdate", "storage")},
        "tables": {k: [(t["cols"], max(h["lines"] for h in t["headers"]), t["scrolls"]) for t in v["tables"]] for k, v in v60["tables"].items()},
    }, ensure_ascii=False, indent=2))
    print(f"saved {notes_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
