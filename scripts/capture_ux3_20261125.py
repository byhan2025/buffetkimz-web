#!/usr/bin/env python3
"""깃밥 벤치마킹 UX 3종 — 실측 캡처·검증 (2026-11-25).

무엇을 재는가
  A. 홈 1440×900 · 390×844 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 첫 화면 — 필름+정의 띠(.hero-film)의 아래 끝이 뷰포트 안에 들어오는가, --hero-def-h 실측값
  C. 상황별 맞춤 — 기본값(직장인·가장) · 라디오 전환 · localStorage 저장/복원 · 자바스크립트 없이도 전환
  D. 사용법 5탭 — 클릭 전환 · 키보드(→) · 자동 넘김 · 멈춤 버튼
  E. 읽기 깊이 — 홈 글 카드 3 · 도구 카드 4에 표시가 붙는가
  F. 캡처 — 1440·390 히어로/상황별/사용법/도구 + /posts 카드

사용:
  npm run build   # 또는 bash scripts/build_with_lock.sh build-pages
  python3 scripts/capture_ux3_20261125.py            # 로컬 dist
  python3 scripts/capture_ux3_20261125.py --live     # 라이브(gh-pages)
결과: /workspace/reports/buffetkimz-web/ux3-20261125/ (shots/*.png, check.json)
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

APP = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = "--live" in sys.argv
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/ux3-20261125") / ("live" if LIVE else "local")
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("UX3_PORT", "8341"))

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

    def log_message(self, *a):
        pass


if LIVE:
    BASE = "https://byhan2025.github.io/buffetkimz-web"
else:
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), _Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

OVERFLOW_JS = """() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  docW: document.documentElement.scrollWidth,
})"""

report: dict = {"base": BASE, "checks": [], "shots": []}


def check(name: str, ok: bool, detail=None):
    report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
    print(("✓ " if ok else "✗ ") + name + (f" — {detail}" if detail not in (None, "") else ""))


def shot(page, name: str, **kw):
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path), **kw)
    report["shots"].append(str(path))
    return str(path)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    for label, width, height in (("desk", 1440, 900), ("mobile", 390, 844)):
        ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
        page = ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        resp = page.goto(f"{BASE}/?v=ux3", wait_until="networkidle")
        check(f"{label} 홈 HTTP 200", resp is not None and resp.status == 200, resp.status if resp else "no response")
        page.wait_for_timeout(1200)

        over = page.evaluate(OVERFLOW_JS)
        check(f"{label} 가로 넘침 0", over["overflow"] <= 0, over)

        hero = page.evaluate(
            """() => {
              const film = document.querySelector('.hero-film');
              const def = document.querySelector('.hero-def');
              const stage = document.querySelector('.film-stage');
              const credits = document.querySelector('.film-credits');
              const cs = getComputedStyle(film);
              return {
                filmBottom: film ? Math.round(film.getBoundingClientRect().bottom) : null,
                viewport: window.innerHeight,
                defH: def ? Math.round(def.getBoundingClientRect().height) : null,
                creditsH: credits ? Math.round(credits.getBoundingClientRect().height) : null,
                stageH: stage ? Math.round(stage.getBoundingClientRect().height) : null,
                defVar: cs.getPropertyValue('--hero-def-h').trim(),
                h1: document.querySelector('.hero-def-line')?.getBoundingClientRect().height ?? null,
              };
            }"""
        )
        check(
            f"{label} 첫 화면 안에 히어로가 끝남",
            hero["filmBottom"] is not None and hero["filmBottom"] <= hero["viewport"],
            hero,
        )
        report.setdefault("hero", {})[label] = hero

        shot(page, f"{label}-01-hero")
        page.locator("#start").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        shot(page, f"{label}-02-audience")
        shot(page, f"{label}-02-audience-el", clip=page.locator("#start").bounding_box())

        page.locator("#how").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        shot(page, f"{label}-03-guide")
        page.locator("#tools").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        shot(page, f"{label}-04-tools")

        # ── C. 상황별 맞춤 ────────────────────────────────────────────
        page.goto(f"{BASE}/?v=ux3", wait_until="networkidle")
        page.wait_for_timeout(400)
        state = page.evaluate(
            """() => ({
              checked: document.querySelector('input[name=audience]:checked')?.value ?? null,
              visible: [...document.querySelectorAll('.aud-panel')]
                .filter((p) => getComputedStyle(p).display !== 'none')
                .map((p) => p.dataset.aud),
            })"""
        )
        check(f"{label} 상황별 기본값", state["checked"] == "worker" and state["visible"] == ["worker"], state)

        page.locator('label[for="aud-starter"]').click()
        page.wait_for_timeout(250)
        state = page.evaluate(
            """() => ({
              checked: document.querySelector('input[name=audience]:checked')?.value ?? null,
              visible: [...document.querySelectorAll('.aud-panel')]
                .filter((p) => getComputedStyle(p).display !== 'none')
                .map((p) => p.dataset.aud),
              saved: (() => { try { return localStorage.getItem('bk-audience'); } catch { return 'blocked'; } })(),
              starterTools: [...document.querySelectorAll('.aud-panel[data-aud=starter] .aud-tool')].length,
              starterPosts: [...document.querySelectorAll('.aud-panel[data-aud=starter] .aud-post')].length,
            })"""
        )
        check(
            f"{label} 한 번 눌러 상황 전환 + 저장",
            state["checked"] == "starter" and state["visible"] == ["starter"] and state["saved"] == "starter",
            state,
        )
        check(f"{label} 사회초년생 추천 3+3", state["starterTools"] == 3 and state["starterPosts"] == 3, state)

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(400)
        restored = page.evaluate(
            "() => document.querySelector('input[name=audience]:checked')?.value ?? null"
        )
        check(f"{label} 다시 열어도 고른 상황 유지", restored == "starter", restored)

        # ── D. 사용법 5탭 ─────────────────────────────────────────────
        tabs = page.evaluate(
            "() => document.querySelectorAll('[data-how-tab]').length"
        )
        check(f"{label} 사용법 탭 5개", tabs == 5, tabs)

        page.locator('[data-how-tab="gallery"]').click()
        page.wait_for_timeout(250)
        g = page.evaluate(
            """() => ({
              selected: document.querySelector('[data-how-tab][aria-selected=true]')?.dataset.howTab ?? null,
              visible: [...document.querySelectorAll('[data-how-panel]')]
                .filter((p) => !p.hidden)
                .map((p) => p.dataset.howPanel),
              progress: document.querySelector('[data-how-progress]')?.textContent?.trim() ?? null,
            })"""
        )
        check(f"{label} 탭 클릭 전환", g["selected"] == "gallery" and g["visible"] == ["gallery"], g)
        shot(page, f"{label}-05-guide-gallery", clip=page.locator("#how").bounding_box())

        page.locator('[data-how-tab="gallery"]').focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(200)
        k = page.evaluate("() => document.querySelector('[data-how-tab][aria-selected=true]')?.dataset.howTab ?? null")
        check(f"{label} 키보드로 탭 이동", k == "academy", k)

        # 자동 넘김 — 8초 기다리면 다음 탭으로 넘어가야 한다
        page.locator('[data-how-tab="market"]').click()
        page.mouse.move(5, 5)
        page.evaluate("() => document.activeElement.blur()")
        page.wait_for_timeout(7800)
        auto = page.evaluate("() => document.querySelector('[data-how-tab][aria-selected=true]')?.dataset.howTab ?? null")
        check(f"{label} 자동 넘김 동작", auto == "tools", auto)

        page.locator("[data-how-pause]").click()
        page.wait_for_timeout(7600)
        paused = page.evaluate(
            """() => ({
              tab: document.querySelector('[data-how-tab][aria-selected=true]')?.dataset.howTab ?? null,
              pressed: document.querySelector('[data-how-pause]')?.getAttribute('aria-pressed'),
            })"""
        )
        check(f"{label} 멈춤 버튼이 자동 넘김을 멈춤", paused["tab"] == "tools" and paused["pressed"] == "true", paused)

        # ── E. 읽기 깊이 ──────────────────────────────────────────────
        depth = page.evaluate(
            """() => ({
              posts: document.querySelectorAll('.picks-posts .depth').length,
              tools: document.querySelectorAll('[data-main-tools] .depth').length,
              labels: [...new Set([...document.querySelectorAll('.depth-label')].map((e) => e.textContent.trim()))],
            })"""
        )
        check(f"{label} 글 카드 깊이 3 · 도구 카드 깊이 4", depth["posts"] == 3 and depth["tools"] == 4, depth)

        check(f"{label} 콘솔 오류 0", len(errors) == 0, errors[:5])
        ctx.close()

    # ── 자바스크립트 없이도 상황 전환이 되는가 ──────────────────────
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, java_script_enabled=False)
    page = ctx.new_page()
    page.goto(f"{BASE}/?v=ux3", wait_until="load")
    page.locator('label[for="aud-retiree"]').click()
    page.wait_for_timeout(300)
    nojs = page.evaluate(
        """() => ({
          checked: document.querySelector('input[name=audience]:checked')?.value ?? null,
          visible: [...document.querySelectorAll('.aud-panel')]
            .filter((p) => getComputedStyle(p).display !== 'none')
            .map((p) => p.dataset.aud),
          firstPanelVisible: (() => {
            const p = document.querySelector('[data-how-panel]');
            return p ? !p.hidden : null;
          })(),
        })"""
    )
    check("자바스크립트 없이도 상황 전환(CSS)", nojs["checked"] == "retiree" and nojs["visible"] == ["retiree"], nojs)
    check("자바스크립트 없이 사용법 첫 패널 보임", nojs["firstPanelVisible"] is True, nojs)
    ctx.close()

    # ── /posts 카드 캡처 (깊이 표시가 목록 카드에도 붙는지) ────────────
    for tag, width, height in (("desk", 1440, 900), ("mobile", 390, 844)):
        ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f"{BASE}/posts/?v=ux3", wait_until="networkidle")
        page.wait_for_timeout(600)
        page.locator("[data-post-cards]").first.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        shot(page, f"{tag}-06-posts-cards")
        over = page.evaluate(OVERFLOW_JS)
        check(f"{tag} /posts 가로 넘침 0", over["overflow"] <= 0, over)
        ctx.close()

    browser.close()

failed = [c for c in report["checks"] if not c["ok"]]
report["failed"] = len(failed)
(OUT / "check.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(f"\n{len(report['checks']) - len(failed)}/{len(report['checks'])} 통과 · 실패 {len(failed)}")
for c in failed:
    print(" ✗", c["name"], c["detail"])
sys.exit(0 if not failed else 1)
