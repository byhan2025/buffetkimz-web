#!/usr/bin/env python3
"""v8.0.0 라이브 실측 — 아카데미·강의·자료앨범 (캐시 우회 ?v=800).

  A. 세 주소 × 1280/390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 자료앨범 — 세트 12 · 57장(DOM·상태줄) · 새 4세트(A·B·D·F) 카드 존재
  C. 카드 이미지 — 3D 새 24장이 실제로 로드(naturalWidth 1080)
  D. 강의 — 카드 세트 링크가 Set B(`tax-moments-3d`) 제목을 가리키는가
  E. 캡처 — 1280·390 전체 + 첫 화면

사용:
  python3 scripts/capture_live_v80.py            # dist 로컬(http://127.0.0.1)
  npm run deploy:pages && python3 scripts/capture_live_v80.py --live
결과: /workspace/reports/buffetkimz-web/v80-live/
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v80-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("V80_PORT", "8180"))
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
SUFFIX = "?v=800"

PAGES = [
    ("academy", "/academy/", "한스푼 아카데미"),
    ("lesson", "/academy/step2-pension-tax-limit/", "2-3강"),
    ("gallery", "/gallery/", "자료앨범"),
]
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}
NEW_PREFIXES = ("3d-three-buckets", "3d-tax-moments", "3d-etf-6numbers", "3d-pension-1500")

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


if MODE == "local":
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(ROOT), **kw)

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

IMG_JS = """(prefixes) => {
  const imgs = [...document.querySelectorAll('img')]
    .filter(i => prefixes.some(p => (i.currentSrc || i.src || '').includes(p)));
  return {
    n: imgs.length,
    loaded: imgs.filter(i => i.naturalWidth > 0).length,
    bad: imgs.filter(i => i.naturalWidth === 0).map(i => (i.currentSrc || i.src).split('/').pop()),
    widths: [...new Set(imgs.map(i => i.naturalWidth))],
  };
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page_at(size: dict):
        ctx = browser.new_context(viewport=size, locale="ko-KR", device_scale_factor=1)
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    status: dict[str, dict] = {}
    overflow: list[str] = []
    console_errors: list[str] = []

    # ---------------------------------------------------------------- A
    for width, size in VIEWPORTS.items():
        for name, path, must in PAGES:
            ctx, pg, errors = page_at(size)
            resp = pg.goto(BASE + path + SUFFIX, wait_until="networkidle")
            pg.wait_for_timeout(600)
            pg.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
            pg.wait_for_timeout(800)
            pg.evaluate("() => window.scrollTo(0, 0)")
            pg.wait_for_timeout(300)
            code = getattr(resp, "status", None)
            status[f"{name}-{width}"] = {"status": code, "url": pg.url, "title": pg.title()}
            if code != 200:
                check(f"A {name} {width} HTTP 200", False, str(code))
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:140]}")
                errors.clear()
            sw, cw = pg.evaluate(
                "() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]"
            )
            if sw > cw + 1:
                overflow.append(f"{width} {path} {sw}>{cw}")
            body = pg.inner_text("body")
            check(
                f"A {name} {width} — HTTP 200 · '{must}' 보임",
                code == 200 and must in body,
                f"{code} · {len(body)}자",
            )
            pg.screenshot(path=str(OUT / f"{name}-{width}-full.png"), full_page=True)
            pg.screenshot(path=str(OUT / f"{name}-{width}-fold.png"))
            ctx.close()

    check("A 콘솔 오류 0 (6회 로드)", not console_errors, " | ".join(console_errors[:3]))
    check("A 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # ---------------------------------------------------------------- B·C 자료앨범
    ctx, pg, _ = page_at(VIEWPORTS["1280"])
    pg.goto(BASE + "/gallery/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(1500)
    gal = pg.evaluate(
        """() => {
          const cards = [...document.querySelectorAll('.gallery-card')];
          return {
            cards: cards.length,
            ids: cards.map(c => c.dataset.galleryItem),
            status: document.querySelector('[data-gallery-status]')?.innerText.replace(/\\s+/g, ' ').trim(),
            chip: [...document.querySelectorAll('.chip')].map(c => c.innerText.trim()).filter(t => t.includes('3D')),
          };
        }"""
    )
    imgs = pg.evaluate(IMG_JS, list(NEW_PREFIXES))
    check(
        "B 자료앨범 12세트 · 57장",
        gal["cards"] == 12 and "12세트" in (gal["status"] or "") and "57장" in (gal["status"] or ""),
        f"{gal['cards']} · {gal['status']}",
    )
    want_ids = {"three-buckets-3d", "tax-moments-3d", "etf-6numbers-3d", "pension-1500-3d"}
    check(
        "B 새 4세트(A·B·D·F) 카드 존재",
        want_ids.issubset(set(gal["ids"])),
        ", ".join(sorted(want_ids - set(gal["ids"]))) or f"{len(gal['ids'])}세트",
    )
    check(
        "B '3D 스토리 8세트 · 48장' 칩",
        any("8세트" in c and "48장" in c for c in gal["chip"]),
        " / ".join(gal["chip"][:3]),
    )
    check(
        "C 새 3D 카드 이미지 로드(naturalWidth 1080)",
        imgs["n"] >= 24 and imgs["loaded"] == imgs["n"] and imgs["widths"] == [1080],
        f"{imgs['loaded']}/{imgs['n']} · widths {imgs['widths']} · 실패 {imgs['bad'][:3]}",
    )
    pg.screenshot(path=str(OUT / "gallery-1280-new-sets.png"), clip={"x": 0, "y": 0, "width": 1280, "height": 900})
    ctx.close()

    # ---------------------------------------------------------------- D 강의 카드 세트 링크
    ctx, pg, _ = page_at(VIEWPORTS["1280"])
    pg.goto(BASE + "/academy/step2-pension-tax-limit/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(400)
    link = pg.evaluate(
        """() => {
          const a = document.querySelector('#cards a.card-set');
          if (!a) return null;
          return {href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ').trim()};
        }"""
    )
    check(
        "D 강의 → 자료앨범 Set B 링크",
        bool(link) and "16.5%" in (link or {}).get("text", "") and "/gallery/" in (link or {}).get("href", ""),
        f"{(link or {}).get('href')} · {(link or {}).get('text', '')[:60]}",
    )
    cards_el = pg.query_selector("#cards")
    if cards_el:
        cards_el.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / "lesson-1280-cards.png"))
    ctx.close()

    browser.close()

if MODE == "local":
    httpd.shutdown()

failed = [c for c in CHECKS if not c["ok"]]
result = {
    "mode": MODE,
    "base": BASE,
    "version": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"],
    "total": len(CHECKS),
    "passed": len(CHECKS) - len(failed),
    "failed": len(failed),
    "pages": status,
    "checks": CHECKS,
}
(OUT / f"verify-live-v80-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 ({MODE}) → {OUT / f'verify-live-v80-{MODE}.json'}")
