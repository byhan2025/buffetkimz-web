#!/usr/bin/env python3
"""v6.0 라이브 실측 — https://byhan2025.github.io/buffetkimz-web/

브리프(v6.0 라이브 배포)의 마지막 단계를 그대로 잰다.
  · /, /apps/pension-draw/, /apps/, /calendar/ 네 주소의 HTTP 상태
  · 1280px·390px에서 콘솔 오류 0 · 가로 넘침 0
  · 라이브 확인: 연금 인출 도구가 열리는가, 홈 지표가 390에서 2열×3행인가, [3줄 복사]가 있는가, 본문 표가 .table-wrap 안에 있는가
  · 캡처: reports/buffetkimz-web/v60-live/live-home-390.png · live-pension-draw-390.png · live-pension-draw-1280.png
  · 결과: reports/buffetkimz-web/v60-live/live-report.json

사용: python3 scripts/verify_live_v60.py   (배포 후 30~90초 기다렸다가)
"""
from __future__ import annotations

import json
import os
import pathlib

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

ORIGIN = "https://byhan2025.github.io"
PREFIX = "/buffetkimz-web"
BASE = ORIGIN + PREFIX
OUT = pathlib.Path(os.environ.get("LIVE_OUT") or "/workspace/reports/buffetkimz-web/v60-live")
OUT.mkdir(parents=True, exist_ok=True)

ROUTES = ["/", "/apps/pension-draw/", "/apps/", "/calendar/"]
VIEWPORTS = [("1280", {"width": 1280, "height": 900}), ("390", {"width": 390, "height": 844})]

MEASURE_JS = r"""() => {
  const doc = document.documentElement;
  const vw = window.innerWidth;
  const wide = [];
  const clipped = [];
  const clipperOf = (el) => {
    let e = el.parentElement;
    while (e && e !== doc) {
      const ox = getComputedStyle(e).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
        return (e.tagName.toLowerCase() + '.' + String(e.className || '').slice(0, 40)).trim();
      }
      e = e.parentElement;
    }
    return null;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      const clip = clipperOf(el);
      const item = {
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || null,
        right: Math.round(r.right),
        over: Math.round(r.right - vw),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        clipper: clip,
      };
      if (clip) { clipped.push(item); } else { wide.push(item); }
    }
  }
  wide.sort((a, b) => b.right - a.right);
  const chips = [...document.querySelectorAll('.ind-chip')];
  const strip = document.querySelector('.ind-strip');
  const grid = chips.length
    ? {
        rows: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
        cols: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().left))).size,
        scrolls: strip ? strip.scrollWidth > strip.clientWidth + 1 : null,
      }
    : null;
  return {
    title: document.title,
    url: location.href,
    viewport_width: vw,
    doc_scroll_width: doc.scrollWidth,
    overflow_px: Math.max(0, doc.scrollWidth - vw),
    overflow_elements: wide.slice(0, 5),
    overflow_element_count: wide.length,
    clipped_element_count: clipped.length,
    clipped_by: [...new Set(clipped.map((c) => c.clipper))],
    grid,
    hasCopyButton: !!document.querySelector('[data-hub-copy]'),
    hasPensionDraw: !!document.querySelector('[data-pdraw]'),
    hasTableWrap: document.querySelectorAll('.prose-article .table-wrap').length,
    pensionDrawTitle: (() => {
      const h = document.querySelector('[data-pdraw]');
      if (!h) return null;
      const t = [...h.querySelectorAll('h3')].map((x) => x.textContent.trim());
      return t.slice(0, 3);
    })(),
    height: doc.scrollHeight,
  };
}"""


def main() -> int:
    report: dict = {"base": BASE, "viewports": {}, "checks": {}, "screenshots": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for label, vp in VIEWPORTS:
            ctx = browser.new_context(
                viewport=vp, device_scale_factor=2, locale="ko-KR", timezone_id="Asia/Seoul"
            )
            routes: dict = {}
            for route in ROUTES:
                page = ctx.new_page()
                errors: list = []
                failed: list = []
                page.on(
                    "console",
                    lambda m, errors=errors: errors.append({"type": m.type, "text": m.text})
                    if m.type == "error"
                    else None,
                )
                page.on("pageerror", lambda e, errors=errors: errors.append({"type": "pageerror", "text": str(e)}))
                page.on(
                    "response",
                    lambda r, failed=failed: failed.append({"status": r.status, "url": r.url})
                    if r.status >= 400
                    else None,
                )
                resp = page.goto(BASE + route, wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(1200)
                m = page.evaluate(MEASURE_JS)
                m.update(
                    {
                        "http_status": resp.status if resp else None,
                        "resolved_url": page.url,
                        "console_errors": errors,
                        "console_error_count": len(errors),
                        "failed_requests": failed,
                        "route": route,
                    }
                )

                if route == "/":
                    page.evaluate(
                        """() => {
                          const hub = document.querySelector('[data-hub]');
                          if (!hub) return;
                          const head = document.querySelector('.site-header');
                          const h = head ? head.getBoundingClientRect().height : 0;
                          window.scrollTo({top: hub.getBoundingClientRect().top + window.scrollY - h - 16, behavior: 'instant'});
                        }"""
                    )
                    page.wait_for_timeout(900)
                    path = OUT / f"live-home-{label}.png"
                    page.screenshot(path=str(path))
                    report["screenshots"].append(str(path))
                if route == "/apps/pension-draw/":
                    page.evaluate(
                        """() => {
                          const el = document.querySelector('[data-pdraw]') || document.querySelector('h1');
                          if (el) window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'instant'});
                        }"""
                    )
                    page.wait_for_timeout(700)
                    path = OUT / f"live-pension-draw-{label}.png"
                    page.screenshot(path=str(path))
                    report["screenshots"].append(str(path))
                routes[route] = m
                page.close()
            report["viewports"][label] = routes
            ctx.close()
        browser.close()

    checks = {}
    for label in report["viewports"]:
        routes = report["viewports"][label]
        checks[label] = {
            "http_status": {k: v["http_status"] for k, v in routes.items()},
            "http_200_all": all(v["http_status"] == 200 for v in routes.values()),
            "console_errors_total": sum(v["console_error_count"] for v in routes.values()),
            "console_error_detail": {k: v["console_errors"] for k, v in routes.items() if v["console_errors"]},
            "page_overflow_px": {k: v["overflow_px"] for k, v in routes.items()},
            "unclipped_overflow_elements": {k: v["overflow_element_count"] for k, v in routes.items()},
            "overflow_zero_all": all(v["overflow_px"] <= 0 and v["overflow_element_count"] == 0 for v in routes.values()),
            "failed_requests": {k: v["failed_requests"] for k, v in routes.items() if v["failed_requests"]},
            "home_grid": routes["/"]["grid"],
            "home_copy_button": routes["/"]["hasCopyButton"],
            "pension_draw_live": routes["/apps/pension-draw/"]["hasPensionDraw"],
            "pension_draw_headings": routes["/apps/pension-draw/"]["pensionDrawTitle"],
            "titles": {k: v["title"] for k, v in routes.items()},
        }
    checks["all_pass"] = all(
        checks[label]["http_200_all"]
        and checks[label]["console_errors_total"] == 0
        and checks[label]["overflow_zero_all"]
        and checks[label]["home_copy_button"]
        and checks[label]["pension_draw_live"]
        for label in report["viewports"]
    ) and checks["390"]["home_grid"]["rows"] == 3 and checks["390"]["home_grid"]["cols"] == 2 and checks["1280"]["home_grid"]["cols"] == 6
    report["checks"] = checks
    path = OUT / "live-report.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(checks, ensure_ascii=False, indent=2))
    print(f"saved {path}")
    return 0 if checks["all_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
