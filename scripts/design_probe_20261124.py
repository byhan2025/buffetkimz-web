#!/usr/bin/env python3
"""디자인 시스템 실측 — 여백·타이포·카드 정렬·색 사용을 페이지 넘어 비교한다(2026-11-24 감사).

재는 것
  A. 섹션 세로 여백(py) 값 분포 — 페이지마다 같은 리듬인지
  B. h1·h2·h3·본문 글자 크기와 행간 — 위계가 규칙적인지
  C. 카드 그리드 — 같은 줄 카드의 높이 차(px), 카드 안 텍스트 넘침
  D. 본문 한 줄 길이(한글 글자 수) — 읽기 좋은 35~45자 범위인지
  E. 색 — 화면에 실제로 쓰인 글자·배경색 가짓수(난잡도)
사용: python3 scripts/design_probe_20261124.py [--live]
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import threading
from collections import Counter

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/audit-20261124/design-probe.json")
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "--live" in os.sys.argv
PORT = 8231


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, p):
        q = p.split("?")[0].split("#")[0]
        if q.startswith("/buffetkimz-web/"):
            q = q[len("/buffetkimz-web"):]
        elif q == "/buffetkimz-web":
            q = "/"
        return super().translate_path(q)

    def log_message(self, *a):
        pass


if LIVE:
    BASE = "https://byhan2025.github.io/buffetkimz-web"
else:
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

PAGES = [
    ("home", "/"),
    ("posts", "/posts/"),
    ("post", "/posts/insurance-ltc-premium-worth/"),
    ("apps", "/apps/"),
    ("app", "/apps/pension-tax/"),
    ("calendar", "/calendar/"),
    ("gallery", "/gallery/"),
    ("academy", "/academy/"),
    ("lesson", "/academy/step2-pension-tax-limit/"),
    ("about", "/about/"),
    ("board", "/board/"),
]

PROBE = r"""
() => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const out = {sections: [], headings: [], body: null, cards: [], colors: {}, lines: []};

  // A. 섹션 세로 여백
  document.querySelectorAll('section, main > div').forEach((s) => {
    const cs = getComputedStyle(s);
    if (s.tagName === 'SECTION') out.sections.push([px(cs.paddingTop), px(cs.paddingBottom)]);
  });

  // B. 제목 위계
  ['h1','h2','h3','p'].forEach((tag) => {
    const el = document.querySelector(tag === 'p' ? '.lede, main p' : tag);
    if (!el) return;
    const cs = getComputedStyle(el);
    out.headings.push({tag, size: Math.round(parseFloat(cs.fontSize)), lh: Math.round(parseFloat(cs.lineHeight)), weight: cs.fontWeight, ls: cs.letterSpacing});
  });

  // C. 카드 그리드 — 같은 부모 안 카드 높이 차
  const grids = new Map();
  document.querySelectorAll('li.card, .card, article.card').forEach((c) => {
    const parent = c.parentElement;
    if (!parent) return;
    if (!grids.has(parent)) grids.set(parent, []);
    grids.get(parent).push(Math.round(c.getBoundingClientRect().height));
  });
  for (const [parent, hs] of grids) {
    if (hs.length > 1 && (parent.children.length === hs.length)) {
      out.cards.push({n: hs.length, min: Math.min(...hs), max: Math.max(...hs), diff: Math.max(...hs) - Math.min(...hs)});
    }
  }

  // D. 본문 한 줄 길이 — 문단의 실제 줄 수와 글자 수
  const paras = [...document.querySelectorAll('article p, main p')].filter(p => p.innerText.trim().length > 80).slice(0, 6);
  for (const p of paras) {
    const cs = getComputedStyle(p);
    const w = p.getBoundingClientRect().width;
    const size = parseFloat(cs.fontSize);
    // 대략: 한글 한 글자 폭 ≈ fontSize, 줄당 글자 수 = 폭 / 글자폭
    out.lines.push({chars: Math.round(w / size), size: Math.round(size), width: Math.round(w)});
  }

  // E. 색 — 텍스트·배경에 실제로 쓰인 색 가짓수
  const colors = new Set(), bgs = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (el.innerText && el.innerText.trim()) colors.add(cs.color);
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs.add(cs.backgroundColor);
  });
  out.colors = {text: [...colors], bg: [...bgs]};

  out.docHeight = document.body.scrollHeight;
  return out;
}
"""


def main() -> int:
    report = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for w, h in ((1440, 900), (390, 844)):
            ctx = b.new_context(viewport={"width": w, "height": h})
            pg = ctx.new_page()
            for name, path in PAGES:
                pg.goto(BASE + path, wait_until="load")
                pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                pg.wait_for_timeout(500)
                pg.evaluate("window.scrollTo(0, 0)")
                pg.wait_for_timeout(200)
                data = pg.evaluate(PROBE)
                report[f"{w}-{name}"] = data
                sec_variants = Counter(tuple(s) for s in data["sections"])
                print(
                    f"{w:4d} {name:9s} h={data['docHeight']:5d} "
                    f"섹션여백 {dict(sec_variants)} 카드줄 {[c['diff'] for c in data['cards']][:6]} "
                    f"줄길이 {[c['chars'] for c in data['lines']][:4]} 색 {len(data['colors']['text'])}/{len(data['colors']['bg'])}"
                )
            ctx.close()
        b.close()
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("saved", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
