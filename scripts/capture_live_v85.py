#!/usr/bin/env python3
"""v8.5.0 자산리포트 신규 10편 — 실물 캡처·검증.

무엇을 재는가
  A. 8주소(블로그 허브 · 신규 상세 3편 · 분야 2 · 홈 · 연결 도구 실행) × 1280·390
     — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0 · 저장소 0건
  B. 블로그 허브 — 글 30편 · 신규 10편 제목 전부 노출 · 최신 글이 대표 카드
  C. 신규 상세 3편 — 대표이미지(그 글 webp) 로드 · 비교 카드 렌더 · 기준·태그·도구 링크 · 본문 1,400자 이상
  D. 홈 — 최신 기록에 신규 글 · 분야 페이지(/posts/finance·invest)에 신규 글
  E. 썸네일 10장 — HTTP 200 · image/webp · og:image가 그 글 썸네일

사용: npm run build && python3 scripts/capture_live_v85.py [--local]
결과: /workspace/reports/buffetkimz-web/v85-live/
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
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v85-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
LOCAL = "--local" in sys.argv
BASE = "http://127.0.0.1:8186" if LOCAL else LIVE
SUFFIX = "?v=850"
PORT = 8186

if LOCAL:
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

    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(("127.0.0.1", PORT), _Handler)
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()

NEW_POSTS = [
    ("finance-financial-income-2000", "이자·배당이 2,000만 원을 넘을 때 — 전액이 아니라 초과분부터 세율이 오른다"),
    ("finance-health-dependent", "부모님 건보료 피부양자, 11월에 바뀌는 이유와 지역가입자 계산"),
    ("retire-severance-db-dc", "퇴직금 1억, 근속 20년이면 세금 123만 원 — DB·DC·IRP가 가르는 것"),
    ("invest-bond-duration", "금리 1%p 오르면 채권 가격은 얼마나 빠지나 — 듀레이션 5년이면 5%"),
    ("invest-fx-hedge-cost", "환헤지 ETF의 연 2%p 비용 — 20년이면 최종 금액이 30% 줄어든다"),
    ("economy-subscription-25", "청약통장에 25만 원씩 — 넣는 돈과 인정되는 돈이 다르다"),
    ("pension-early-withdrawal-165", "연금저축 중도해지, 16.5% vs 3.3~5.5% — 갈리는 여섯 가지 사유"),
    ("finance-gift-10year-limit", "부모님이 준 5,000만 원, 10년 공제는 부모 합쳐 한 번이다"),
    ("finance-jeonse-buttimok", "버팀목 전세대출 연 2.5~3.5%, 한도 1억 2,000만 원의 조건"),
    ("invest-overseas-stock-tax", "해외주식 250만 원 공제, 12월 31일에 팔면 다음 해로 넘어간다"),
]
DETAIL = ["finance-financial-income-2000", "invest-bond-duration", "retire-severance-db-dc"]
PAGES = (
    [("hub", "/posts/")]
    + [(f"post-{s}", f"/posts/{s}/") for s in DETAIL]
    + [("cat-finance", "/posts/finance/"), ("cat-invest", "/posts/invest/"),
       ("home", "/"), ("tool-run", "/apps/overseas-stock-tax/run")]
)
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page_at(width: str):
        ctx = browser.new_context(viewport=VIEWPORTS[width], locale="ko-KR", device_scale_factor=1)
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    # ---------------------------------------------------------------- A
    bad, console_errors, overflow, stored = [], [], [], []
    for width in ("1280", "390"):
        for name, path in PAGES:
            ctx, pg, errors = page_at(width)
            resp = pg.goto(BASE + path + SUFFIX, wait_until="networkidle")
            pg.wait_for_timeout(600)
            if resp is None or resp.status >= 400:
                bad.append(f"{width} {path} {getattr(resp, 'status', 'none')}")
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:120]}")
                errors.clear()
            size = pg.evaluate(
                "() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
            )
            if size["sw"] > size["cw"] + 1:
                overflow.append(f"{width} {path} {size['sw']}>{size['cw']}")
            n = pg.evaluate("() => Object.keys(localStorage).length + Object.keys(sessionStorage).length")
            if n:
                stored.append(f"{width} {path} {n}")
            pg.evaluate("window.scrollTo(0,0)")
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(OUT / f"{name}-{width}-fold.png"))
            pg.screenshot(path=str(OUT / f"{name}-{width}-full.png"), full_page=True)
            ctx.close()
    check(f"A1 {'로컬 dist' if LOCAL else '라이브'} {len(PAGES)}주소 × 1280/390 HTTP 200 (?v=850)", not bad, ", ".join(bad))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))
    check("A4 저장소 0건", not stored, ", ".join(stored[:4]))

    # ---------------------------------------------------------------- B 허브
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/posts/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(600)
    hub = pg.evaluate(
        """() => {
          const items = [...document.querySelectorAll('[data-post-item]')];
          const titles = items.map(i => i.dataset.title);
          const text = document.body.innerText;
          const count = document.querySelector('[data-post-count]')?.textContent.trim() ?? '';
          const feature = document.querySelector('.post-card h2, h2')?.textContent.trim() ?? '';
          return { total: items.length, titles, count, feature,
                   has30: text.includes('자산리포트 30편'),
                   head: text.split('\\n').slice(0, 10).join(' | ') };
        }"""
    )
    missing = [t for _, t in NEW_POSTS if t not in hub["titles"] and t != hub["feature"]]
    check(
        "B1 허브 = 글 30편(대표 1 + 카드 29) · 신규 10편 제목 전부 노출",
        hub["total"] == 29 and not missing and hub["has30"],
        f"cards={hub['total']}+feature missing={len(missing)} {missing[:2]}",
    )
    check(
        "B2 허브 대표 카드 = 가장 최근 글",
        hub["feature"] in [t for _, t in NEW_POSTS],
        hub["feature"][:40],
    )
    ctx.close()

    # ---------------------------------------------------------------- C 상세
    for slug in DETAIL:
        ctx, pg, errors = page_at("1280")
        pg.goto(BASE + f"/posts/{slug}/" + SUFFIX, wait_until="networkidle")
        pg.wait_for_timeout(700)
        info = pg.evaluate(
            """() => {
              const hero = document.querySelector('.post-thumb img');
              const cmp = document.querySelector('[data-compare]');
              const body = document.querySelector('[data-post-body], article')?.innerText ?? '';
              const chars = body.replace(/\\s/g, '').length;
              return {
                hero: hero ? { w: hero.naturalWidth, src: hero.getAttribute('src') } : null,
                h1: document.querySelector('h1')?.textContent.trim() ?? '',
                cmp: cmp ? { title: cmp.querySelector('.cmp-title')?.textContent.trim(),
                             sides: cmp.querySelectorAll('[data-compare-side]').length } : null,
                basis: document.querySelector('[data-post-basis]')?.textContent.trim().slice(0, 60) ?? '',
                tags: [...document.querySelectorAll('[data-post-tags] a')].map(a => a.textContent.trim()),
                tool: document.querySelector('[data-post-tool] a')?.getAttribute('href') ?? '',
                og: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
                chars,
                mins: /(\\d+)분/.exec(document.body.innerText.slice(0, 1200))?.[1] ?? '',
              };
            }"""
        )
        ok_hero = bool(info["hero"] and info["hero"]["w"] > 1000 and slug in (info["hero"]["src"] or ""))
        ok_cmp = bool(info["cmp"] and info["cmp"]["sides"] == 2 and info["cmp"]["title"])
        check(
            f"C {slug} — 대표이미지·비교카드·기준·태그·도구·og",
            ok_hero and ok_cmp and bool(info["basis"]) and len(info["tags"]) >= 3
            and info["tool"] != "" and slug in info["og"] and info["chars"] >= 1400,
            f"hero={info['hero'] and info['hero']['w']} cmp={info['cmp'] and info['cmp']['title']} "
            f"tags={len(info['tags'])} chars={info['chars']} mins={info['mins']}",
        )
        check(f"C {slug} 콘솔 오류 0", not errors, errors[0][:100] if errors else "")
        if info["cmp"]:
            el = pg.query_selector("[data-compare]")
            if el:
                el.screenshot(path=str(OUT / f"compare-{slug}-1280.png"))
        ctx.close()

    # ---------------------------------------------------------------- D 홈·분야
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/" + SUFFIX, wait_until="networkidle")
    pg.wait_for_timeout(600)
    home = pg.evaluate(
        "() => [...document.querySelectorAll('a[href*=\"/posts/\"]')].map(a => a.textContent.trim())"
    )
    hits = [t for _, t in NEW_POSTS if any(t[:14] in h for h in home if h)]
    check("D1 홈 최근 기록에 신규 글 노출", len(hits) >= 2, f"{len(hits)}편")

    for cat, expect in (("finance", ["finance-financial-income-2000", "finance-health-dependent",
                                     "finance-gift-10year-limit", "finance-jeonse-buttimok"]),
                        ("invest", ["invest-bond-duration", "invest-fx-hedge-cost",
                                    "invest-overseas-stock-tax"])):
        pg.goto(BASE + f"/posts/{cat}/" + SUFFIX, wait_until="networkidle")
        pg.wait_for_timeout(500)
        d = pg.evaluate(
            """() => ({ titles: [...document.querySelectorAll('[data-post-item]')].map(i => i.dataset.title),
                        hrefs: [...document.querySelectorAll('a[href*="/posts/"]')].map(a => a.getAttribute('href')) })"""
        )
        joined = " ".join(d["hrefs"])
        ok = all(s in joined for s in expect) and len(d["titles"]) >= len(expect)
        check(f"D2 /posts/{cat}/ — 신규 {len(expect)}편 포함({len(d['titles'])}편 표시)", ok,
              f"titles={len(d['titles'])}")
    ctx.close()

    # ---------------------------------------------------------------- E 썸네일
    ctx = browser.new_context(viewport=VIEWPORTS["1280"], locale="ko-KR")
    pg = ctx.new_page()
    pg.goto(BASE + "/posts/" + SUFFIX, wait_until="networkidle")
    miss, wrong = [], []
    for slug, _ in NEW_POSTS:
        r = ctx.request.get(f"{BASE}/thumbs/{slug}.webp")
        if r.status != 200:
            miss.append(f"{slug} {r.status}")
        elif "image/webp" not in (r.headers.get("content-type") or ""):
            wrong.append(f"{slug} {r.headers.get('content-type')}")
    check(f"E1 신규 썸네일 10장 = HTTP 200{' · image/webp' if not LOCAL else ''}", not miss and not wrong,
          ", ".join(miss + wrong) or "10/10")
    ctx.close()
    browser.close()

passed = sum(1 for c in CHECKS if c["ok"])
report = {"version": "8.5.0", "base": BASE, "mode": "local" if LOCAL else "live",
          "passed": passed, "total": len(CHECKS), "checks": CHECKS}
(OUT / ("verify-v85-local.json" if LOCAL else "verify-v85.json")).write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n{passed}/{len(CHECKS)} 통과 → {OUT}")
sys.exit(0 if passed == len(CHECKS) else 1)
