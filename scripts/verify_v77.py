#!/usr/bin/env python3
"""v7.7.0 통합 회귀 검증 — 95점 재채점 기준을 화면에서 그대로 잰다.

이 한 스크립트가 v7.1·v7.3·v7.4의 판정을 현재 기준(앱 51종 · 자료앨범 세트 수는 gallery.ts에서 셈 · 메뉴 8분류)으로
다시 잰다. 옛 스크립트는 그때의 숫자를 들고 있어 최신 빌드에서 실패하는 것이 정상이다.

  A. 주요 페이지 × 1280/390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 앱스토어(/apps)
     · 카드 51 · 섹션 6·4·41 · 검색창 → 카테고리 칩 → 자주 쓰는 앱 → 전체 목록 순서
     · 카드 배지 1~2개(무료 배지 0) · 영문 섹션 라벨(APP STORE·FINANCE 등) 0
     · 검색 '퇴직' 걸림 · 390 접힘 8 + 나머지 보기
  C. 4열 이상 표 — 390에서 카드로 펼쳐짐(가로 스크롤 0 · data-label 있음) / 1280은 표 그대로
  D. 홈·소개 장식 번호(01~05) 0 · 홈 모듈 격자 문구
  E. 연금 마스터 6편 — 카드·상세 `[n/6]` · 글 하단 '다음 편 이어 읽기' + 짝꿍 계산기
  F. 홈 미리보기 — '예상 공제액 148.5만원' · 한글 줄은 고정폭 글꼴이 아님
  G. '많이 찾는 핵심 글' 카드 서브훅 3/3
  H. 세율 일관성 스크립트 결과(JSON) 100%
  I. 캡처 — reports/buffetkimz-web/v77-quality95/ (390·1280 핵심 4장 이상)

사용:
  npm run build && python3 scripts/verify_v77.py
  python3 scripts/verify_v77.py --live     # gh-pages 라이브
결과: reports/buffetkimz-web/v77-quality95/verify-v77-{local,live}.json
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import re
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v77-quality95"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("V77_PORT", "8177"))
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "" if MODE == "live" else "/buffetkimz-web"

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


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


def url(path: str) -> str:
    return f"{BASE}{PREFIX}{path}"


ROUTES = [
    ("home", "/"),
    ("about", "/about/"),
    ("apps", "/apps/"),
    ("posts", "/posts/"),
    ("pension-cat", "/posts/pension/"),
    ("post-01", "/posts/pension-master-01-four-accounts/"),
    ("post-03", "/posts/pension-master-03-yearend-900/"),
    ("post-06", "/posts/pension-master-06-healthcheck/"),
    ("run-pension", "/apps/pension-tax/run/"),
    ("run-account", "/apps/account-tax-compare/run/"),
    ("run-retire", "/apps/retirement-flow/run/"),
    ("gallery", "/gallery/"),
    ("calendar", "/calendar/"),
    ("search", "/search/"),
    ("principles", "/principles/"),
]

if MODE == "local":
    httpd = Server(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    def page_at(width: int, key: int):
        ctx = browser.new_context(viewport=VIEWPORTS[str(width)], locale="ko-KR", device_scale_factor=1)
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg, errors

    # ---------------------------------------------------------------- A
    bad_http, console_errors, overflow = [], [], []
    for width in (1280, 390):
        ctx, pg, errors = page_at(width, 0)
        for name, path in ROUTES:
            resp = pg.goto(url(path), wait_until="networkidle")
            pg.wait_for_timeout(450)
            if resp is None or resp.status >= 400:
                bad_http.append(f"{width} {path} {getattr(resp, 'status', 'none')}")
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:120]}")
                errors.clear()
            w = pg.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})")
            if w["sw"] > w["cw"] + 1:
                overflow.append(f"{width} {path} {w['sw']}>{w['cw']}")
        ctx.close()
    check("A1 주요 15p × 1280/390 HTTP 200", not bad_http, ", ".join(bad_http[:4]))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # ---------------------------------------------------------------- B 앱스토어
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/apps/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    cards = pg.eval_on_selector_all("[data-store-item]", "els => els.length")
    per_section = pg.eval_on_selector_all(
        "[data-store-cat]", "els => els.map(e => e.querySelectorAll('[data-store-item]').length)"
    )
    check("B1 앱스토어 카드 51종", cards == 51, str(cards))
    check("B2 섹션 6·4·41", per_section == [6, 4, 41], str(per_section))

    order = pg.evaluate(
        """() => [...document.querySelectorAll('.store-hero, .store-search-row, .store-tabs, .store-quick, .store-body')]
             .map(e => e.className.split(' ')[0])"""
    )
    check(
        "B3 순서 = 검색창 → 카테고리 칩 → 자주 쓰는 앱 → 전체 목록",
        order[:5] == ["store-hero", "store-search-row", "store-tabs", "store-quick", "store-body"],
        str(order),
    )

    badges = pg.eval_on_selector_all(
        "[data-store-item]", "els => els.map(e => e.querySelectorAll('.store-badge').length)"
    )
    check(
        "B4 카드 배지 1~2개 · '무료' 배지 0",
        all(1 <= n <= 2 for n in badges) and pg.eval_on_selector_all(".store-badge--free", "e => e.length") == 0,
        f"min {min(badges)} max {max(badges)}",
    )

    body_text = pg.inner_text("body")
    en_labels = [s for s in ("APP STORE", "FINANCE · INVEST", "HOW IT WORKS", "PENSION · RETIRE") if s in body_text]
    check("B5 영문 섹션 라벨 0", not en_labels, ", ".join(en_labels))

    quick = pg.eval_on_selector_all("[data-quick-app]", "els => els.length")
    check("B6 자주 쓰는 앱 4칸", quick == 4, str(quick))

    # 검색
    pg.fill("[data-store-search]", "퇴직")
    pg.wait_for_timeout(500)
    shown = pg.eval_on_selector_all(
        "[data-store-item]:not([hidden])", "els => els.map(e => e.dataset.storeItem)"
    )
    check("B7 검색 '퇴직' 동작", 1 <= len(shown) <= 6, ", ".join(shown[:6]))
    pg.fill("[data-store-search]", "")
    pg.wait_for_timeout(300)
    ctx.close()

    # 390 — 접힘
    ctx, pg, errors = page_at(390, 0)
    pg.goto(url("/apps/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    fold = pg.evaluate(
        """() => { const sec = [...document.querySelectorAll('[data-store-cat]')].find(s => s.dataset.storeCat === 'utility');
                   const items = [...sec.querySelectorAll('[data-store-item]')];
                   const btn = sec.querySelector('[data-store-more]');
                   return {vis: items.filter(i => !i.hidden).length, more: btn && !btn.hidden, label: btn?.textContent}; }"""
    )
    check("B8 390 유용한앱 접힘 8 + 나머지 보기", fold["vis"] == 8 and bool(fold["more"]), str(fold))
    # 캡처
    pg.screenshot(path=str(OUT / "apps-390.png"), full_page=False)
    pg.evaluate("() => window.scrollTo(0, 0)")
    ctx.close()

    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/apps/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / "apps-1280.png"), full_page=False)
    ctx.close()

    # ---------------------------------------------------------------- C 넓은 표
    table_pages = [("/posts/pension-master-03-yearend-900/", "post-03"), ("/apps/account-tax-compare/run/", "run-account")]
    stack_fail, no_labels = [], []
    for width in (390, 1280):
        ctx, pg, errors = page_at(width, 0)
        for path, tag in table_pages:
            pg.goto(url(path), wait_until="networkidle")
            pg.wait_for_timeout(1400)
            info = pg.evaluate(
                """() => [...document.querySelectorAll('table')].map(t => ({
                     cols: t.querySelectorAll('thead th').length,
                     stack: t.classList.contains('table-stack'),
                     visibleHead: t.querySelector('thead') ? getComputedStyle(t.querySelector('thead')).position !== 'absolute' : false,
                     labels: [...t.querySelectorAll('tbody tr')].slice(0, 2).map(tr => [...tr.children].slice(1).map(td => td.getAttribute('data-label'))),
                     sw: t.scrollWidth, cw: t.clientWidth,
                   }))"""
            )
            wide = [t for t in info if t["cols"] >= 4]
            for t in wide:
                if width == 390:
                    if not t["stack"] or t["visibleHead"] or t["sw"] > t["cw"] + 1:
                        stack_fail.append(f"{tag} {t['cols']}열 stack={t['stack']} head={t['visibleHead']} {t['sw']}>{t['cw']}")
                    flat = [lab for row in t["labels"] for lab in row if lab]
                    if len(flat) < t["cols"] - 1:
                        no_labels.append(f"{tag} {flat}")
                elif t["stack"] and not t["visibleHead"]:
                    stack_fail.append(f"1280 {tag} 표가 카드로 바뀜")
            if width == 390 and wide:
                pg.evaluate("() => document.querySelector('table.table-stack')?.scrollIntoView({block:'center'})")
                pg.wait_for_timeout(250)
                pg.screenshot(path=str(OUT / f"table-stack-{tag}-390.png"))
                el = pg.query_selector("table.table-stack")
                if el:
                    el.screenshot(path=str(OUT / f"table-stack-el-{tag}-390.png"))
        ctx.close()
    check("C1 390 넓은 표 = 카드(가로 스크롤 0 · 머리글 숨김)", not stack_fail, "; ".join(stack_fail[:4]))
    check("C2 카드 셀에 머리글 data-label", not no_labels, "; ".join(no_labels[:3]))

    # ---------------------------------------------------------------- D 장식 번호
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/"), wait_until="networkidle")
    pg.wait_for_timeout(600)
    hub_nos = pg.eval_on_selector_all(".hub-modgrid-no", "e => e.length")
    pg.goto(url("/about/"), wait_until="networkidle")
    pg.wait_for_timeout(600)
    phil_nos = pg.eval_on_selector_all(".ab-phil-no, .ab-act-no", "e => e.length")
    about_text = pg.inner_text("body")
    check("D1 홈 모듈 격자 장식 번호 0", hub_nos == 0, str(hub_nos))
    check("D2 소개 철학·막 장식 번호 0", phil_nos == 0, str(phil_nos))
    check("D3 소개 영문 병기(ACT · FINANCE) 0", not re.search(r"\b(ACT [IV]+|PHILOSOPHY|FINANCE · INVEST)\b", about_text), "")
    ctx.close()

    # ---------------------------------------------------------------- E 시리즈
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/posts/pension/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    badges6 = pg.eval_on_selector_all(
        "[data-master-series] [data-series-no]", "els => els.map(e => e.textContent.trim())"
    )
    has_slash = [b for b in badges6 if re.search(r"\[\d/6\]", b)]
    check("E1 시리즈 목록에 [n/6] 표기", len(has_slash) >= 6, f"{len(has_slash)}/{len(badges6)}")

    detail_ok, footer_ok = [], []
    for i in range(1, 7):
        pg.goto(url(f"/posts/pension-master-0{i}-{'four-accounts' if i == 1 else 'tax-compare' if i == 2 else 'yearend-900' if i == 3 else 'asset-etf' if i == 4 else 'draw-1500' if i == 5 else 'healthcheck'}/"), wait_until="networkidle")
        pg.wait_for_timeout(400)
        chip = pg.inner_text(".series-chip")
        detail_ok.append(f"[{i}/6]" in chip)
        foot = pg.evaluate(
            """() => { const s = document.querySelector('[data-series-next]');
                       return s ? {next: !!s.querySelector('[data-series-next-link]'), tool: !!s.querySelector('[data-series-tool]')} : null; }"""
        )
        footer_ok.append(bool(foot and foot["next"] and foot["tool"]))
    check("E2 상세 머리 [n/6] 6/6", all(detail_ok), str(detail_ok))
    check("E3 글 하단 '다음 편 + 짝꿍 계산기' 6/6", all(footer_ok), str(footer_ok))
    # 캡처 — 1편 상세 하단
    pg.goto(url("/posts/pension-master-01-four-accounts/"), wait_until="networkidle")
    pg.wait_for_timeout(500)
    el = pg.query_selector("[data-series-next]")
    if el:
        el.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        el.screenshot(path=str(OUT / "series-next-1280.png"))
    ctx.close()

    # 마지막 편은 '1편부터 다시' 링크
    ctx, pg, errors = page_at(390, 0)
    pg.goto(url("/posts/pension-master-06-healthcheck/"), wait_until="networkidle")
    pg.wait_for_timeout(600)
    last = pg.inner_text("[data-series-next]")
    check("E4 마지막 편 = 1편부터 다시 읽기", "1편부터" in last, last.split("\n")[0])
    el = pg.query_selector("[data-series-next]")
    if el:
        el.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        el.screenshot(path=str(OUT / "series-next-390.png"))
    ctx.close()

    # ---------------------------------------------------------------- E5 대출 거치 단위
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/apps/loan-repay/run/"), wait_until="networkidle")
    pg.wait_for_timeout(1200)
    pg.get_by_label("거치 기간", exact=True).fill("2")
    pg.wait_for_timeout(500)
    loan = pg.evaluate(
        """() => ({pay: document.querySelector('[data-testid="monthly-payment"]')?.innerText ?? '',
                   interest: document.querySelector('[data-testid="total-interest"]')?.innerText ?? ''})"""
    )
    check(
        "E5 거치 2년 = 24개월 환산(3억·4.5%·30년)",
        "1,571,939원" in loan["pay"] and "255,171,432원" in loan["interest"] and "거치 2년" in loan["pay"],
        loan["pay"].replace("\n", " / ")[:70],
    )
    pg.screenshot(path=str(OUT / "loan-grace2-1280.png"))
    ctx.close()

    # ---------------------------------------------------------------- F 홈 미리보기
    ctx, pg, errors = page_at(390, 0)
    pg.goto(url("/"), wait_until="networkidle")
    pg.wait_for_timeout(900)
    mini = pg.evaluate(
        """() => { const p = document.querySelector('[data-main-tools] .mini-out');
                   if (!p) return null;
                   const s = getComputedStyle(p);
                   return {text: p.textContent.replace(/\\s+/g, ' ').trim(), ff: s.fontFamily, gap: /  /.test(p.textContent)}; }"""
    )
    check("F1 미리보기 '예상 공제액 148.5만원'", bool(mini) and "예상 공제액 148.5만원" in mini["text"], (mini or {}).get("text", ""))
    check(
        "F2 한글 줄은 고정폭 글꼴이 아님(공 자 깨짐 원인 제거)",
        bool(mini) and not mini["ff"].lower().startswith(("ui-monospace", "sfmono")),
        (mini or {}).get("ff", "")[:60],
    )
    check("F3 이중 공백 없음", bool(mini) and not mini["gap"], str((mini or {}).get("gap")))
    mini_el = pg.query_selector("[data-main-tools] .mini")
    if mini_el:
        mini_el.screenshot(path=str(OUT / "home-mini-390.png"))
    pg.screenshot(path=str(OUT / "home-390.png"))
    ctx.close()

    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/"), wait_until="networkidle")
    pg.wait_for_timeout(1800)
    pg.screenshot(path=str(OUT / "home-1280.png"))
    ctx.close()

    # ---------------------------------------------------------------- G 서브훅
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/posts/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    hooks = pg.eval_on_selector_all("[data-pick-hook]", "els => els.map(e => e.textContent.trim())")
    check("G1 '많이 찾는 핵심 글' 서브훅 3/3", len(hooks) == 3 and all(len(h) > 12 for h in hooks), f"{len(hooks)}개")
    pg.screenshot(path=str(OUT / "posts-picks-1280.png"))
    ctx.close()

    # ---------------------------------------------------------------- J 메뉴·자료앨범·글 메타
    ctx, pg, errors = page_at(1280, 0)
    pg.goto(url("/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    menu = pg.evaluate(
        """() => { const g = document.querySelector('[data-nav-group] [data-nav-toggle]'); g?.click();
                   const drop = document.querySelector('[data-nav-drop]');
                   const head = drop?.querySelector('.nav-drop-head-note');
                   const rows = [...(drop?.querySelectorAll('.nav-drop-label') ?? [])].map(e => e.textContent.trim());
                   return {note: head?.textContent.trim() ?? '', rows}; }"""
    )
    check("J1 자산리포트 하위 = 8개 분류", menu["note"] == "8개 분류", menu["note"])
    check("J2 8분류 항목 노출(노후준비·철학 포함)", len(menu["rows"]) >= 8 and "노후준비" in menu["rows"], ", ".join(menu["rows"][:9]))

    # 기대값은 손으로 적지 않고 `src/data/gallery.ts`에서 센다 — 세트를 추가해도 검사가 따라온다.
    gallery_src = (APP / "src" / "data" / "gallery.ts").read_text(encoding="utf-8")
    want_sets = len(re.findall(r'^    id: "[a-z0-9-]+",$', gallery_src, re.M))
    want_slides = len(re.findall(r'src: "/gallery/', gallery_src))

    pg.goto(url("/gallery/"), wait_until="networkidle")
    pg.wait_for_timeout(700)
    sets = pg.eval_on_selector_all(".gallery-card", "e => e.length")
    status = pg.inner_text("[data-gallery-status]")
    check(
        f"J3 자료앨범 {want_sets}세트·{want_slides}장 (gallery.ts와 일치)",
        sets == want_sets and f"{want_sets}세트" in status and f"{want_slides}장" in status,
        f"{sets} · {status.splitlines()[0][:40]}",
    )

    pg.goto(url("/search/"), wait_until="networkidle")
    pg.wait_for_timeout(600)
    check("J4 검색이 앱 51종으로 안내", "51종" in pg.inner_text("body"), "")

    posts_dir = APP / "src" / "content" / "posts"
    missing = []
    for f in sorted(posts_dir.glob("*.md")):
        fm = f.read_text(encoding="utf-8").split("---\n", 2)[1]
        for key in ("summary:", "thumbAlt:", "baseDate:", "compare:"):
            if key not in fm:
                missing.append(f"{f.name}:{key}")
    check("J5 글 20편 메타 100%", not missing, ", ".join(missing[:4]))
    ctx.close()

    browser.close()

# ---------------------------------------------------------------- H 세율
tax_path = OUT / "verify-tax-consistency.json"
if tax_path.exists():
    tax = json.loads(tax_path.read_text(encoding="utf-8"))
    check("H1 세율 일관성 100%", tax["failed"] == 0, f"{tax['passed']}/{tax['total']}")
else:
    check("H1 세율 일관성 100%", False, "verify_tax_consistency.json 없음 — 먼저 실행")

# ---------------------------------------------------------------- I 캡처
shots = sorted(p.name for p in OUT.glob("*.png"))
check("I1 캡처 4장 이상(390·1280)", len(shots) >= 4 and any("390" in s for s in shots) and any("1280" in s for s in shots), f"{len(shots)}장")

failed = [c for c in CHECKS if not c["ok"]]
result = {"version": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"], "mode": MODE, "total": len(CHECKS), "passed": len(CHECKS) - len(failed), "failed": len(failed), "checks": CHECKS}
(OUT / f"verify-v77-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / f'verify-v77-{MODE}.json'}")
sys.exit(0 if not failed else 1)
