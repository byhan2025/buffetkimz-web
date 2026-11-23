#!/usr/bin/env python3
"""320px 모바일 점검 — 가로 넘침 0 · 터치 타깃 44px (2026-11-23 신설)

왜 만들었나 — 16:00 모바일 점검에서 `/posts/` 320px 가로 넘침과 44px 미만 터치 타깃
(`근거` 19×19, `글 읽기 →` 36×17 등)이 지적됐다. 고친 뒤 같은 자로 다시 재고,
다음에 같은 문제가 생기면 이 스크립트가 먼저 잡게 한다.

잰 것
  A. 320·390 두 폭 × 주요 화면 — `document.documentElement.scrollWidth - innerWidth` ≤ 0
     (문서가 뷰포트보다 넓으면 실패. 넘친 요소를 함께 적는다)
  B. 같은 화면의 a·button·input[checkbox/radio]·label — 높이 44px 미만이면 목록에 남긴다
     (`.sr-only` 화면 낭독용 링크와 문장 속 인라인 링크는 제외)

사용:
  npm run build   # 또는 bash scripts/build_with_lock.sh build-pages
  python3 scripts/check_mobile_320.py            # 로컬 dist
  python3 scripts/check_mobile_320.py --live     # gh-pages 라이브
결과: reports/buffetkimz-web/mobile-320/check.json · shots/*.png
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
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "mobile-320"
OUT.mkdir(parents=True, exist_ok=True)
Chrome = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("MOBILE320_PORT", "8320"))
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

ROUTES = [
    ("home", "/"),
    ("posts", "/posts/"),
    ("posts-finance", "/posts/finance/"),
    ("post-detail", "/posts/pension-master-01-four-accounts/"),
    ("academy", "/academy/"),
    ("academy-elementary", "/academy/school-elementary-allowance/"),
    ("apps", "/apps/"),
    ("calendar", "/calendar/"),
    ("gallery", "/gallery/"),
    ("about", "/about/"),
    # v9.0.0 P1 — 숫자 배지가 처음 붙은 화면(배지 2열 그리드·44px 배지 상자)
    ("post-badge", "/posts/pension-master-02-tax-compare/"),
    ("post-badge-3", "/posts/pension-master-05-draw-1500/"),
    ("lesson-badge", "/academy/step2-pension-tax-limit/"),
]

# 문장 속 인라인 링크는 WCAG 2.5.8(최소 24px) 예외다 — 목록에는 남기되 실패로 세지 않는다.
INLINE_EXEMPT = ("link", "underline")

OVERFLOW_JS = """
(w) => {
  const offenders = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return;
    if (r.right <= w + 0.5 && r.left >= -0.5) return;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/hidden|auto|scroll|clip/.test(getComputedStyle(p).overflowX)) return; // 스크롤 컨테이너가 자른다
    }
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 80),
      left: +r.left.toFixed(1), right: +r.right.toFixed(1), width: +r.width.toFixed(1),
    });
  });
  return {overflow: document.documentElement.scrollWidth - w,
          docW: document.documentElement.scrollWidth, offenders: offenders.slice(0, 20)};
}
"""

TAP_JS = """
() => {
  const out = [];
  document.querySelectorAll('a, button, input[type="checkbox"], input[type="radio"], select, [role="button"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (el.closest('.sr-only')) return;
    if (r.height >= 44) return;
    const label = el.closest('label');
    out.push({
      tag: el.tagName.toLowerCase(),
      text: (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
      cls: (el.className || '').toString().slice(0, 70),
      display: getComputedStyle(el).display,
      labelH: label ? +label.getBoundingClientRect().height.toFixed(1) : 0,
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    });
  });
  return out;
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


def is_exempt(t: dict) -> bool:
    """WCAG 2.5.8이 허용하는 예외 — 라벨이 큰 체크박스·라디오, 화면에서 감춘 입력, 문장 속 인라인 링크."""
    if t["tag"] in ("input", "select"):
        return t["labelH"] >= 44 or (t["w"] <= 4 and t["h"] <= 4)
    return t["tag"] == "a" and t["display"] == "inline"


if MODE == "local":
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

report = {"mode": MODE, "viewports": {}, "failures": [], "notes": []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=Chrome, args=["--no-sandbox"])
    shots = OUT / "shots"
    shots.mkdir(exist_ok=True)
    for width in (320, 390):
        ctx = browser.new_context(viewport={"width": width, "height": 844}, locale="ko-KR",
                                  device_scale_factor=2, has_touch=True)
        pg = ctx.new_page()
        per_width = {}
        for name, path in ROUTES:
            resp = pg.goto(f"{BASE}{PREFIX}{path}", wait_until="load")
            pg.wait_for_timeout(700)
            ov = pg.evaluate(OVERFLOW_JS, width)
            taps = pg.evaluate(TAP_JS)
            strict = [t for t in taps if not is_exempt(t)]
            per_width[name] = {"path": path, "status": getattr(resp, "status", None),
                               "overflow": ov["overflow"], "docW": ov["docW"],
                               "offenders": ov["offenders"], "smallTaps": taps,
                               "smallTapsStrict": strict}
            if ov["overflow"] > 0:
                report["failures"].append(f"{width} {path} 가로 넘침 {ov['overflow']}px")
            if strict:
                report["failures"].append(
                    f"{width} {path} 터치 타깃 44px 미만 {len(strict)}개: "
                    + ", ".join(f"{t['text'] or t['tag']}({t['w']}×{t['h']})" for t in strict[:4])
                )
        report["viewports"][str(width)] = per_width
        ctx.close()
    browser.close()

(OUT / "check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("■ 320·390 모바일 점검")
for width, pages in report["viewports"].items():
    for name, r in pages.items():
        strict = r["smallTapsStrict"]
        print(f"  {width} {r['path']:42} 넘침 {r['overflow']:>3}px · 44px 미만 {len(strict)}개"
              + (" → " + ", ".join(f"{t['text']}({t['w']}×{t['h']})" for t in strict[:3]) if strict else ""))
print()
if report["failures"]:
    print(f"✗ 실패 {len(report['failures'])}건")
    for f in report["failures"]:
        print("   -", f)
    raise SystemExit(1)
print("✓ 넘침 0 · 터치 타깃 44px 이상 (인라인 링크 제외)")
print(f"저장: {OUT/'check.json'}")
