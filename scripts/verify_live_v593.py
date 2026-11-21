#!/usr/bin/env python3
"""v5.9.3 라이브 실측 — https://byhan2025.github.io/buffetkimz-web/

브리프(v5.9.3 즉시 gh-pages 라이브 배포)의 3단계를 그대로 잰다.
  · /, /posts, /tools, /calendar 네 주소의 HTTP 상태
  · 1280px·390px 두 뷰포트에서 콘솔 오류 수 · 가로 넘침 · '오늘 확인 허브' 노출
  · 캡처 reports/buffetkimz-web/v593-hub/live-1280.png · live-390.png
  · 결과 reports/buffetkimz-web/v593-hub/live-report.json

`/tools` 는 `/apps` 로 옮겨간 주소라 301 이 아니라 200 + JS 리다이렉트 페이지다.
그래서 실제 착지 주소(resolved_url)와 /apps 화면까지 함께 잰다.

가로 넘침 판정은 두 가지를 함께 본다.
  · doc_scroll_width <= viewport_width — 페이지 자체가 옆으로 스크롤되지 않는가(본 판정)
  · 뷰포트를 넘는 요소 중 조상에 overflow-x(auto/scroll/hidden) 클리핑 컨테이너가 없는 것
    (지표 스트립·칩 캐러셀은 설계상 스와이프 영역이라 여기서 제외된다)

사용: python3 scripts/verify_live_v593.py
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
OUT = pathlib.Path(os.environ.get("LIVE_OUT") or "/workspace/reports/buffetkimz-web/v593-hub")
OUT.mkdir(parents=True, exist_ok=True)

ROUTES = ["/", "/posts/", "/tools/", "/calendar/", "/apps/"]
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
  const hub = document.querySelector('[data-hub]') ||
    [...document.querySelectorAll('h1, h2, h3, p, span, div')]
      .find((el) => el.textContent.trim() === '오늘 확인 허브') || null;
  let hubVisible = false;
  let hubText = null;
  if (hub) {
    const r = hub.getBoundingClientRect();
    const cs = getComputedStyle(hub);
    hubVisible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    hubText = (hub.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  return {
    title: document.title,
    url: location.href,
    viewport_width: vw,
    doc_scroll_width: doc.scrollWidth,
    overflow_px: Math.max(0, doc.scrollWidth - vw),
    overflow_elements: wide.slice(0, 6),
    overflow_element_count: wide.length,
    clipped_elements: clipped.slice(0, 4),
    clipped_element_count: clipped.length,
    clipped_by: [...new Set(clipped.map((c) => c.clipper))],
    hub_present: !!hub,
    hub_visible: hubVisible,
    hub_text: hubText,
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
                page.on(
                    "pageerror",
                    lambda e, errors=errors: errors.append({"type": "pageerror", "text": str(e)}),
                )
                page.on(
                    "response",
                    lambda r, failed=failed: failed.append({"status": r.status, "url": r.url})
                    if r.status >= 400
                    else None,
                )
                resp = page.goto(BASE + route, wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(1500)
                m = page.evaluate(MEASURE_JS)
                m["http_status"] = resp.status if resp else None
                m["resolved_url"] = page.url
                m["console_errors"] = errors
                m["console_error_count"] = len(errors)
                m["failed_requests"] = failed
                m["route"] = route
                if route == "/":
                    # 첫 화면은 6컷 브랜드 필름(①)이라 허브가 접혀 있다. 방문자가 필름 뒤에서
                    # 보는 실제 홈을 담기 위해 허브를 화면에 올린 뒤 찍는다(캡처 전용 스크롤).
                    page.evaluate(
                        """() => {
                          const hub = document.querySelector('[data-hub]');
                          if (!hub) return;
                          hub.scrollIntoView({behavior: 'instant', block: 'start'});
                          // 상단 고정 헤더가 허브 Eyebrow를 덮지 않도록 그 높이만큼 되돌린다.
                          const head = document.querySelector('header');
                          const h = head ? head.getBoundingClientRect().height : 0;
                          window.scrollBy({top: -(h + 24), behavior: 'instant'});
                        }"""
                    )
                    page.wait_for_timeout(1200)
                    m["hub_in_viewport"] = page.evaluate(
                        """() => {
                          const hub = document.querySelector('[data-hub]');
                          if (!hub) return false;
                          const r = hub.getBoundingClientRect();
                          return r.top < window.innerHeight && r.bottom > 0;
                        }"""
                    )
                    path = OUT / f"live-{label}.png"
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
            "http_200_all": all(r["http_status"] == 200 for r in routes.values()),
            "http_status": {k: v["http_status"] for k, v in routes.items()},
            "console_errors_total": sum(r["console_error_count"] for r in routes.values()),
            "console_error_detail": {
                k: v["console_errors"] for k, v in routes.items() if v["console_errors"]
            },
            "page_overflow_px": {k: v["overflow_px"] for k, v in routes.items()},
            "unclipped_overflow_elements": {k: v["overflow_element_count"] for k, v in routes.items()},
            "overflow_zero_all": all(
                r["overflow_px"] <= 0 and r["overflow_element_count"] == 0 for r in routes.values()
            ),
            "swipe_containers": {k: v["clipped_by"] for k, v in routes.items() if v["clipped_by"]},
            "hub_visible_home": routes["/"]["hub_present"] and routes["/"]["hub_visible"],
            "hub_capture_in_viewport": routes["/"].get("hub_in_viewport"),
            "hub_text": routes["/"]["hub_text"],
            "failed_requests": {
                k: v["failed_requests"] for k, v in routes.items() if v["failed_requests"]
            },
            "tools_resolved": routes["/tools/"]["resolved_url"],
            "titles": {k: v["title"] for k, v in routes.items()},
        }
    checks["all_pass"] = all(
        checks[l]["http_200_all"]
        and checks[l]["console_errors_total"] == 0
        and checks[l]["overflow_zero_all"]
        and checks[l]["hub_visible_home"]
        for l in report["viewports"]
    )
    report["checks"] = checks
    path = OUT / "live-report.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(checks, ensure_ascii=False, indent=2))
    print(f"saved {path}")
    return 0 if checks["all_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
