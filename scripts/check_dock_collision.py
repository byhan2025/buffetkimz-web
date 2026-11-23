#!/usr/bin/env python3
"""하단 고정 요소 충돌 점검 — v9.1.0 P2 (TrackDock · 가이드 버튼 · 여정 바 · 도구 요약 바)

왜 이 스크립트인가
  · P2는 화면 아래에 **고정 바를 하나 더** 놓는다(학습 트랙 하단 순환 독). 이 사이트에는 이미
    같은 자리를 쓰는 것이 셋 있다 — `? 가이드` 미니 버튼(.guide-btn) · 읽기/도구 여정 바(.journey-bar) ·
    도구 실행 화면의 모바일 요약 바(.sticky-summary).
  · 겹침은 눈으로는 '조금 어긋난' 것으로 보이지만, 누를 수 없는 버튼이 생기면 그 화면의 출구가 사라진다.
    그래서 겹친 넓이를 px로 재고, 0.5px를 넘으면 실패로 센다.
  · 겹침 0과 함께 **터치 타깃 44px**과 **푸터 마지막 줄이 바에 가리지 않는지**도 함께 잰다.

사용:
  npm run build
  python3 scripts/check_dock_collision.py          # 로컬 dist
  python3 scripts/check_dock_collision.py --live   # gh-pages 라이브
결과: reports/buffetkimz-web/learning-loop/dock-collision.json
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import sys
import threading

APP = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "learning-loop"
OUT.mkdir(parents=True, exist_ok=True)
Chrome = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("DOCK_CHECK_PORT", "8322"))
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

# (이름, 경로, 독이 있어야 하는가, 가이드 버튼이 있어야 하는가)
ROUTES = [
    ("track-overview", "/academy/track/pension-tax/", False, False),
    ("track-stage-1", "/academy/track/pension-tax/1/", True, False),
    ("track-stage-2", "/academy/track/pension-tax/2/", True, False),
    ("track-stage-3", "/academy/track/pension-tax/3/", True, False),
    ("post-dock", "/posts/pension-master-02-tax-compare/", True, True),
    ("post-dock-2", "/posts/retire-severance-db-dc/", True, True),
    ("post-nodock", "/posts/economy-fx-grocery/", False, True),
    ("lesson-dock", "/academy/step2-account-order/", True, False),
    ("lesson-dock-2", "/academy/step4-retire-drawdown-order/", True, False),
    # 실행 화면에는 가이드 독이 없다(Guide는 글에만 붙는다) — 요약 바와만 겹치지 않으면 된다
    ("run-track-tool", "/apps/pension-draw/run/", False, False),
    ("run-other-tool", "/apps/compound-return/run/", False, False),
    ("gallery-reverse", "/gallery/three-buckets-3d/", False, False),
    ("academy-hub", "/academy/", False, False),
]

MEASURE_JS = """
() => {
  const box = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
            bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1)};
  };
  const dock = document.querySelector('[data-track-dock]');
  const guideBtn = document.querySelector('[data-guide-dock] .guide-btn');
  const journey = document.querySelector('[data-guide-dock] .journey-bar');
  const sticky = document.querySelector('[data-sticky-summary]');
  const footer = document.querySelector('footer');
  const taps = [];
  if (dock) {
    dock.querySelectorAll('a, button, summary').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      taps.push({text: (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
                 w: +r.width.toFixed(1), h: +r.height.toFixed(1)});
    });
  }
  const footerLast = footer ? footer.querySelector('p, li, a') : null;
  return {
    vw: window.innerWidth, vh: window.innerHeight,
    dock: box(dock), guideBtn: box(guideBtn), journey: box(journey), sticky: box(sticky),
    footer: box(footer), footerLast: box(footerLast),
    taps,
    journeyHidden: journey ? getComputedStyle(journey).display === 'none' : null,
    dockProgress: dock ? dock.querySelector('.td-progress > span')?.getBoundingClientRect().width ?? 0 : 0,
  };
}
"""


class Server(socketserver.TCPServer):
    allow_reuse_address = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def overlap(a: dict | None, b: dict | None) -> float:
    """두 사각형이 겹친 넓이(px²) — 0.5px 여유를 두고 잰다."""
    if not a or not b:
        return 0.0
    dx = min(a["right"], b["right"]) - max(a["x"], b["x"])
    dy = min(a["bottom"], b["bottom"]) - max(a["y"], b["y"])
    if dx <= 0.5 or dy <= 0.5:
        return 0.0
    return round(dx * dy, 1)


if MODE == "local":
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

report: dict = {"mode": MODE, "viewports": {}, "failures": []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=Chrome, args=["--no-sandbox"])
    for width in (320, 390):
        ctx = browser.new_context(viewport={"width": width, "height": 844}, locale="ko-KR",
                                  device_scale_factor=2, has_touch=True)
        pg = ctx.new_page()
        per = {}
        for name, path, want_dock, want_guide in ROUTES:
            pg.goto(f"{BASE}{PREFIX}{path}", wait_until="load")
            pg.wait_for_timeout(400)
            # 화면 아래로 내려 고정 바·푸터가 실제로 만나는 자리를 잰다
            pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            pg.wait_for_timeout(450)
            m = pg.evaluate(MEASURE_JS)
            dock, guide, journey, sticky = m["dock"], m["guideBtn"], m["journey"], m["sticky"]

            checks = {}
            checks["dock-present"] = (dock is not None) == want_dock
            checks["guide-present"] = (guide is not None) == want_guide
            checks["dock-vs-guide"] = overlap(dock, guide)
            checks["dock-vs-journey"] = overlap(dock, journey)
            checks["dock-vs-sticky"] = overlap(dock, sticky)
            checks["guide-vs-journey"] = overlap(guide, journey)
            checks["guide-vs-sticky"] = overlap(guide, sticky)
            # 독이 화면 맨 아래에 붙어 있는가(안전영역 포함) — 2px 여유
            checks["dock-at-bottom"] = bool(dock) and abs(dock["bottom"] - m["vh"]) <= 2 if dock else True
            # 독이 푸터 마지막 줄을 가리지 않는가
            checks["footer-covered"] = overlap(dock, m["footerLast"]) if dock else 0
            small = [t for t in m["taps"] if t["h"] < 44 or t["w"] < 44]
            checks["small-taps"] = small

            fails = []
            if not checks["dock-present"]:
                fails.append(f"{'독이 없음' if want_dock else '독이 있으면 안 됨'}")
            if not checks["guide-present"]:
                fails.append(f"{'가이드 버튼 없음' if want_guide else '가이드 버튼이 있으면 안 됨'}")
            for key in ("dock-vs-guide", "dock-vs-journey", "dock-vs-sticky", "guide-vs-journey",
                        "guide-vs-sticky", "footer-covered"):
                if checks[key] > 0:
                    fails.append(f"{key} 겹침 {checks[key]}px²")
            if not checks["dock-at-bottom"]:
                fails.append("독이 화면 아래에 붙어 있지 않음")
            if small:
                fails.append("44px 미만 " + ", ".join(f"{t['text'] or '?'}({t['w']}×{t['h']})" for t in small[:3]))
            if want_dock and m["journeyHidden"] is False:
                fails.append("독이 있는데 읽기 여정 바가 남아 있음")

            per[name] = {"path": path, "dock": dock, "guideBtn": guide, "journey": journey,
                         "sticky": sticky, "checks": checks, "fails": fails}
            if fails:
                report["failures"].append(f"{width} {path}: " + " · ".join(fails))
        report["viewports"][str(width)] = per
        ctx.close()
    browser.close()

(OUT / "dock-collision.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("■ 하단 고정 요소 충돌 점검 (독 · 가이드 버튼 · 여정 바 · 요약 바)")
for width, pages in report["viewports"].items():
    for name, r in pages.items():
        d = r["dock"]
        size = f"독 {d['w']:.0f}×{d['h']:.0f}" if d else "독 없음"
        flag = "✓" if not r["fails"] else "✗ " + " · ".join(r["fails"])
        print(f"  {width} {r['path']:38} {size:18} {flag}")
print()
if report["failures"]:
    print(f"✗ 실패 {len(report['failures'])}건")
    for f in report["failures"]:
        print("   -", f)
    raise SystemExit(1)
print("✓ 겹침 0px² · 독은 화면 아래 고정 · 터치 타깃 44px 이상")
print(f"저장: {OUT/'dock-collision.json'}")
