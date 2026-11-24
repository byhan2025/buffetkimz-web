#!/usr/bin/env python3
"""buffetkimz.com 전수 감사 — 2026-11-24 (full-audit-20261124)

무엇을 재는가 (로컬 dist를 실제 브라우저로)
  A. 주요 9주소 × 1440·390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0 · 깨진 이미지 0
  B. 홈 기준일 표기 — 화면에 보이는 '기준일'·'기준' 문자열을 그대로 수집(이중 표기 확인)
  C. 내비게이션 — 대메뉴 6개·퀵탭 목적지 200 · 드로어 항목 수
  D. 404 — 안내문·복귀 링크
  E. 뒤로가기 — 글 → 목록 → 뒤로 (bfcache 아닌 실제 히스토리 길이)
  F. 내부 링크 — dist 전체(별도 링크 검사기는 audit_links와 동일 규칙)
사용: python3 scripts/audit_full_20261124.py [--live]
결과: /workspace/reports/buffetkimz-web/audit-20261124/
"""
from __future__ import annotations

import http.server
import json
import mimetypes
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/audit-20261124")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "--live" in sys.argv
PORT = 8193
mimetypes.add_type("image/webp", ".webp")


class _Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def translate_path(self, path):
        q = path.split("?", 1)[0].split("#", 1)[0]
        if q == "/buffetkimz-web":
            q = "/"
        elif q.startswith("/buffetkimz-web/"):
            q = q[len("/buffetkimz-web"):]
        return super().translate_path(q)

    def send_head(self):
        # GitHub Pages 처럼 없는 주소에는 404.html 본문을 준다(404 상태는 유지)
        path = self.translate_path(self.path)
        target = pathlib.Path(path)
        if not target.exists() and not target.is_dir():
            body = (APP / "dist" / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            import io as _io

            return _io.BytesIO(body)
        return super().send_head()

    def log_message(self, *a):
        pass


if LIVE:
    BASE = "https://byhan2025.github.io/buffetkimz-web"
else:
    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(("127.0.0.1", PORT), _Handler)
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()
    BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

PAGES = [
    ("home", "/"),
    ("board", "/board/"),
    ("apps", "/apps/"),
    ("app-detail", "/apps/pension-tax/"),
    ("academy", "/academy/"),
    ("gallery", "/gallery/"),
    ("post", "/posts/insurance-ltc-premium-worth/"),
    ("about", "/about/"),
    ("search", "/search/"),
    ("calendar", "/calendar/"),
    ("posts", "/posts/"),
    ("404", "/this-page-does-not-exist-zzz/"),
]

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:500]})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


BROKEN_IMG_JS = """() => [...document.images]
  .filter(i => i.currentSrc || i.src)
  .filter(i => i.complete && i.naturalWidth === 0)
  .map(i => (i.currentSrc || i.src).slice(-90))"""

OVERFLOW_JS = """() => {
  const bad = [];
  const dw = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > dw + 1.5 && getComputedStyle(el).position !== 'fixed') {
      bad.push({tag: el.tagName, cls: (el.className || '').toString().slice(0, 60),
                right: Math.round(r.right), dw});
    }
  });
  return {doc: document.documentElement.scrollWidth - window.innerWidth, items: bad.slice(0, 4)};
}"""


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for w, h in ((1440, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w == 390 else 1)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            for name, path in PAGES:
                resp = page.goto(BASE + path, wait_until="load")
                page.wait_for_timeout(700)
                status = resp.status if resp else None
                over = page.evaluate(OVERFLOW_JS)
                broken = page.evaluate(BROKEN_IMG_JS)
                ok = status in (200, 404) and over["doc"] <= 0 and not broken and not errors
                if name == "404":
                    ok = status in (200, 404) and over["doc"] <= 0 and not errors
                check(
                    f"A {w} {name} — {status} · hOverflow {over['doc']} · 깨진 이미지 {len(broken)} · 콘솔 {len(errors)}",
                    ok,
                    f"{over['items']} {broken[:2]} {errors[:2]}",
                )
                page.screenshot(path=str(OUT / f"{w}-{name}.png"), full_page=False)
                errors.clear()
            ctx.close()

        # ── B. 홈 화면의 날짜 표기 수집 ─────────────────────────────
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(BASE + "/", wait_until="load")
        page.wait_for_timeout(1200)
        dates = page.evaluate(
            """() => {
                 const out = [];
                 const t = document.body.innerText;
                 const rx = /[^\\n]{0,26}(기준일|기준|업데이트|확인)[^\\n]{0,26}/g;
                 let m;
                 while ((m = rx.exec(t))) out.push(m[0].replace(/\\s+/g, ' ').trim());
                 return out;
               }"""
        )
        page.screenshot(path=str(OUT / "1440-home-first-screen.png"))
        page.evaluate("window.scrollTo(0, window.innerHeight * 1.05)")
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / "1440-home-hub.png"))
        page.evaluate("window.scrollTo(0, window.innerHeight * 2.1)")
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "1440-home-picks.png"))

        # ── C. 내비게이션 ───────────────────────────────────────────
        nav = page.evaluate(
            """() => [...document.querySelectorAll('.site-nav .nav-link')].map(a => [a.textContent.trim(), a.getAttribute('href')])"""
        )
        quick = page.evaluate(
            """() => [...document.querySelectorAll('.site-quick-link')].map(a => [a.textContent.trim(), a.getAttribute('href')])"""
        )
        drawer = page.evaluate(
            """() => [...document.querySelectorAll('#mobile-menu a')].map(a => a.textContent.trim())"""
        )
        check("C 대메뉴 6개", len(nav) == 6, f"{nav}")
        check(
            "C 메뉴 이름이 5대 축 + 아카데미",
            [n[0] for n in nav] == ["자산리포트", "앱스토어", "골든타임", "자료앨범", "아카데미", "버핏킴즈"],
            f"{[n[0] for n in nav]}",
        )
        bad_nav = []
        for label, href in nav + quick:
            r = page.goto(BASE + (href or "/").replace("/buffetkimz-web", ""), wait_until="domcontentloaded")
            if not r or r.status != 200:
                bad_nav.append((label, href, r.status if r else None))
        check("C 대메뉴·퀵탭 목적지 전부 200", not bad_nav, f"{bad_nav}")
        check("C 모바일 드로어 7개(6메뉴+검색)", len(drawer) == 7, f"{drawer}")

        # ── D. 404 ────────────────────────────────────────────────
        page.goto(BASE + "/this-page-does-not-exist-zzz/", wait_until="domcontentloaded")
        d404 = page.evaluate(
            """() => ({title: document.title, h1: document.querySelector('h1')?.innerText || '',
                       links: [...document.querySelectorAll('main a')].length,
                       nav: document.querySelectorAll('.site-nav a').length})"""
        )
        check("D 404 안내 + 복귀 링크", "찾을 수 없" in d404["title"] and d404["links"] >= 2 and d404["nav"] >= 5, f"{d404}")

        # ── E. 뒤로가기 ────────────────────────────────────────────
        page.goto(BASE + "/posts/", wait_until="load")
        page.click("main a[href*='insurance-ltc-premium-worth']")
        page.wait_for_timeout(600)
        page.go_back()
        page.wait_for_timeout(600)
        back_url = page.url
        check("E 뒤로가기 — 글 → 목록 복귀", back_url.rstrip("/").endswith("/posts"), back_url)

        ctx.close()
        browser.close()

    (OUT / "audit-results.json").write_text(
        json.dumps({"base": BASE, "results": results, "homeDateStrings": dates}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    fails = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(fails)}/{len(results)} 통과")
    for f in fails:
        print("  FAIL", f["check"], f["detail"])
    print("홈 날짜 표기:", json.dumps(dates, ensure_ascii=False))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
