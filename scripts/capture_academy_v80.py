#!/usr/bin/env python3
"""v8.4 「버핏킴즈 금융생활학교」 STEP 4~6·자산형성·은퇴 확장 — 실물 캡처·검증.

무엇을 재는가
  A. 허브 + 강의 17개(성인 10 + 학교 7) × 1280·390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 헤더 — 1280·1024 에서 메뉴 가로 넘침 0 · '아카데미' 항목이 실제로 보이는가
  C. 390 모바일 — 퀵 탭 6칸 유지 · 하위 드로어에 아카데미 진입
  D. 허브 — 지금 열린 강의 17개 · 6 STEP 로드맵(성인 10강·STEP 4~6 공개) · 52주 52칸·7트랙 탭 전환 · 진단 3문항
  E. 강의 — 카드뉴스 인라인 뷰어 · 5분 읽기 1,200~1,500자 · 운영표 1칸(저장 0건) · 주소 불변
  E5. 학교 트랙 — 한 화면 한 질문(1개만 보임 → 선택 → 다음), 본문 16px 이상, 버튼 44px 이상
  F. 캡처 — 1280·390 전체 화면 + 주요 구획

사용: npm run build && python3 scripts/capture_academy_v80.py
결과: /workspace/reports/buffetkimz-web/academy-v840/
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import re
import socketserver
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/academy-v840")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
PORT = int(os.environ.get("ACADEMY_PORT", "8190"))
BASE = f"http://127.0.0.1:{PORT}"

CHECKS: list[dict] = []

LESSONS = [
    ("1-1", "/academy/step1-three-buckets/"),
    ("1-2", "/academy/step1-emergency-fund/"),
    ("2-1", "/academy/step2-account-order/"),
    ("2-2", "/academy/step2-isa-numbers/"),
    ("2-3", "/academy/step2-pension-tax-limit/"),
    ("3-1", "/academy/step3-drawdown-recovery/"),
    ("3-2", "/academy/step3-etf-six-numbers/"),
    ("4-1", "/academy/step4-retire-drawdown-order/"),
    ("5-1", "/academy/step5-silson-generation-switch/"),
    ("6-1", "/academy/step6-rebalance-cash/"),
    ("초등1", "/academy/school-elementary-allowance/"),
    ("청소년1", "/academy/school-teen-payments/"),
    ("첫월급1", "/academy/school-firstpay-stub/"),
    ("가계1", "/academy/school-household-cashflow/"),
    ("가계2", "/academy/school-household-coverage/"),
    ("자산형성1", "/academy/school-asset-split-weights/"),
    ("은퇴1", "/academy/school-retire-3tier-order/"),
]

SCHOOL = {"초등1", "청소년1", "첫월급1", "가계1", "가계2", "자산형성1", "은퇴1"}


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        """`npm run build:pages`(BASE=/buffetkimz-web) 산출물도 서비스한다.
        페이지는 /academy/ 로 열고, HTML이 가리키는 /buffetkimz-web/_astro/… 은 접두를 떼어 준다.
        """
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == "/buffetkimz-web":
            p = "/"
        elif p.startswith("/buffetkimz-web/"):
            p = p[len("/buffetkimz-web") :]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

PAGES = [("academy-hub", "/academy/")] + [(f"academy-{slug}", path) for slug, path in LESSONS]
VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

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
    bad, console_errors, overflow = [], [], []
    for width in ("1280", "390"):
        for name, path in PAGES:
            ctx, pg, errors = page_at(width)
            resp = pg.goto(BASE + path, wait_until="networkidle")
            pg.wait_for_timeout(500)
            if resp is None or resp.status >= 400:
                bad.append(f"{width} {path} {getattr(resp, 'status', 'none')}")
            if errors:
                console_errors.append(f"{width} {path}: {errors[0][:140]}")
                errors.clear()
            size = pg.evaluate(
                "() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
            )
            if size["sw"] > size["cw"] + 1:
                overflow.append(f"{width} {path} {size['sw']}>{size['cw']}")
            pg.screenshot(path=str(OUT / f"{name}-{width}-full.png"), full_page=True)
            pg.screenshot(path=str(OUT / f"{name}-{width}-fold.png"))
            ctx.close()
    check("A1 허브·강의 17개 × 1280/390 HTTP 200", not bad, ", ".join(bad))
    check("A2 콘솔 오류 0", not console_errors, " | ".join(console_errors[:3]))
    check("A3 가로 넘침 0", not overflow, ", ".join(overflow[:4]))

    # ---------------------------------------------------------------- B 헤더
    nav_report = {}
    for width in (1280, 1024):
        ctx, pg, _ = page_at("1280")
        pg.set_viewport_size({"width": width, "height": 900})
        pg.goto(BASE + "/", wait_until="networkidle")
        pg.wait_for_timeout(400)
        info = pg.evaluate(
            """() => {
              const header = document.querySelector('.site-header-row');
              const nav = document.querySelector('.site-nav');
              const link = [...document.querySelectorAll('.site-nav .nav-link')].find(a => a.textContent.trim() === '아카데미');
              const r = link?.getBoundingClientRect();
              return {
                headerRight: header ? Math.round(header.getBoundingClientRect().right) : null,
                navRight: nav ? Math.round(nav.getBoundingClientRect().right) : null,
                academyVisible: !!link && r.width > 0 && r.left >= 0 && r.right <= innerWidth,
                academyRight: r ? Math.round(r.right) : null,
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth,
              };
            }"""
        )
        nav_report[width] = info
        check(
            f"B 데스크톱 {width}px — '아카데미' 메뉴 보임 · 가로 넘침 0",
            info["academyVisible"] and info["scrollW"] <= info["clientW"] + 1,
            f"right {info['academyRight']} / nav right {info['navRight']} / {info['scrollW']}<={info['clientW']}",
        )
        pg.screenshot(path=str(OUT / f"header-nav-{width}.png"), clip={"x": 0, "y": 0, "width": width, "height": 96})
        ctx.close()

    # ---------------------------------------------------------------- C 모바일
    ctx, pg, _ = page_at("390")
    pg.goto(BASE + "/academy/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    quick = pg.evaluate(
        """() => ({
          tabs: [...document.querySelectorAll('.site-quick-link')].map(a => a.textContent.trim()),
          overflow: [...document.querySelectorAll('.site-quick-link')].some(a => a.scrollWidth > a.clientWidth + 1),
        })"""
    )
    check(
        "C1 390 퀵 탭 6칸 유지 · 글자 잘림 0",
        len(quick["tabs"]) == 6 and not quick["overflow"],
        f"{quick['tabs']}",
    )
    drawer = pg.evaluate(
        """() => {
          const btn = document.querySelector('[data-menu-toggle]');
          btn?.click();
          const panel = document.querySelector('[data-menu-panel]');
          const labels = [...(panel?.querySelectorAll('a') ?? [])].map(a => a.textContent.trim());
          return { open: panel ? !panel.classList.contains('hidden') : false, labels };
        }"""
    )
    check("C2 390 ≡ 드로어에 '아카데미'", drawer["open"] and "아카데미" in drawer["labels"], ", ".join(drawer["labels"][:8]))
    pg.screenshot(path=str(OUT / "mobile-drawer-390.png"))
    ctx.close()

    # ---------------------------------------------------------------- D 허브
    ctx, pg, errors = page_at("1280")
    pg.goto(BASE + "/academy/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    hub = pg.evaluate(
        """() => {
          const cards = [...document.querySelectorAll('.academy-lesson')];
          const links = cards.map(c => c.querySelector('a')?.getAttribute('href') ?? '');
          const steps = [...document.querySelectorAll('.academy-step')].map(s => ({
            no: s.id,
            open: s.dataset.open,
            status: s.querySelector('.academy-status')?.textContent.trim(),
            lessons: [...s.querySelectorAll('.academy-step-lessons a')].map(a => a.getAttribute('href')),
          }));
          return {
            count: cards.length,
            links,
            steps,
            heroCta: document.querySelector('.btn-primary')?.getAttribute('href'),
            firstTitle: cards[0]?.querySelector('.academy-lesson-title')?.textContent.trim(),
          };
        }"""
    )
    check(
        "D1 허브 — 지금 열린 강의 17개 카드 · 각 강의 주소 연결",
        hub["count"] == 17
        and len([l for l in hub["links"] if l and "/academy/" in l]) == 17
        and hub["heroCta"] and "#open" in hub["heroCta"],
        f"{hub['count']} · {hub['links']} · cta {hub['heroCta']}",
    )
    check(
        "D2 로드맵 — STEP 1~6 모두 공개(2·3·2·1·1·1강) · 공개/계획 강수 병기 · 강의 링크 10개",
        [s["status"] for s in hub["steps"]]
        == [
            "공개 2강 / 계획 6강",
            "공개 3강 / 계획 7강",
            "공개 2강 / 계획 8강",
            "공개 1강 / 계획 8강",
            "공개 1강 / 계획 6강",
            "공개 1강 / 계획 6강",
        ]
        and [len(s["lessons"]) for s in hub["steps"]] == [2, 3, 2, 1, 1, 1],
        f"{[(s['no'], s['status'], len(s['lessons'])) for s in hub['steps']]}",
    )

    diag = pg.evaluate(
        """() => {
          const box = document.querySelector('[data-diagnosis]');
          const checks = [...box.querySelectorAll('[data-diagnosis-check]')];
          const shown = () => [...box.querySelectorAll('[data-diagnosis-answer]')].filter(e => !e.hidden).map(e => e.dataset.diagnosisAnswer);
          const out = { steps: [] };
          out.steps.push(shown());
          checks[0].click(); out.steps.push(shown());
          checks[1].click(); out.steps.push(shown());
          checks[2].click(); out.steps.push(shown());
          out.count = box.querySelector('[data-diagnosis-count]')?.textContent.trim();
          return out;
        }"""
    )
    check(
        "D3 진단 3문항 → 경로 전환(0·1·2·3개)",
        diag["steps"] == [["none"], ["starter"], ["builder"], ["all"]] and diag["count"] == "3개 체크",
        f"{diag['steps']} / {diag['count']}",
    )

    # 52주 연재 로드맵 — 52칸·7트랙 탭
    roadmap = pg.evaluate(
        """() => {
          const weeks = [...document.querySelectorAll('[data-week]')];
          const blocks = [...document.querySelectorAll('[data-track-block]')];
          const tabs = [...document.querySelectorAll('[data-track-tab]')];
          const tab = tabs.find(t => t.dataset.trackTab === 'teen');
          tab?.click();
          const vis = (el) => el.offsetParent !== null;
          const teen = { weeks: weeks.filter(vis).length, blocks: blocks.filter(vis).length,
                         note: document.querySelector('[data-track-note]')?.textContent.trim() ?? '',
                         pressed: tabs.filter(t => t.getAttribute('aria-pressed') === 'true').map(t => t.dataset.trackTab) };
          const all = tabs.find(t => t.dataset.trackTab === 'all');
          all?.click();
          return { weeks: weeks.length, blocks: blocks.length, tabs: tabs.length,
                   open: document.querySelectorAll('.school-week-open').length,
                   teen, back: weeks.filter(vis).length };
        }"""
    )
    check(
        "D4 52주 로드맵 — 52칸·7트랙·지금 열린 12주 · 탭 필터(청소년 8주)",
        roadmap["weeks"] == 52
        and roadmap["blocks"] == 7
        and roadmap["tabs"] == 8
        and roadmap["open"] == 12
        and roadmap["teen"]["weeks"] == 8
        and roadmap["teen"]["blocks"] == 1
        and "청소년" in roadmap["teen"]["note"]
        and roadmap["teen"]["pressed"] == ["teen"]
        and roadmap["back"] == 52,
        f"{roadmap}",
    )
    ctx.close()

    # ---------------------------------------------------------------- E 강의 5개
    viewer_report, chars_report, sheet_report = [], [], []
    for slug, path in LESSONS:
        for width in ("1280", "390"):
            ctx, pg, errors = page_at(width)
            pg.goto(BASE + path, wait_until="networkidle")
            pg.wait_for_timeout(400)

            # 카드뉴스 인라인 뷰어
            viewer = pg.evaluate(
                """() => {
                  const root = document.querySelector('#cardnews [data-cardnews]');
                  if (!root) return { found: false };
                  const thumbs = [...root.querySelectorAll('[data-cn-thumb]')];
                  const counter = () => root.querySelector('[data-cn-counter]')?.textContent.trim();
                  const src = () => root.querySelector('[data-cn-img]')?.getAttribute('src');
                  const empty = !!root.querySelector('.cn-empty');
                  const out = { found: true, empty, thumbs: thumbs.length, c0: counter(), s0: src() };
                  if (empty) return out;
                  root.querySelector('[data-cn-next]')?.click();
                  out.c1 = counter();
                  out.s1 = src();
                  thumbs[thumbs.length - 1]?.click();
                  out.cLast = counter();
                  thumbs[0]?.click();
                  out.cBack = counter();
                  root.querySelector('[data-cn-open]')?.click();
                  const dlg = root.querySelector('[data-cn-dialog]');
                  out.dialog = !!dlg?.open;
                  root.querySelector('[data-cn-dialog-next]')?.click();
                  out.dialogCount = root.querySelector('[data-cn-dialog-count]')?.textContent.trim();
                  dlg?.close();
                  out.closed = !dlg?.open;
                  out.galleryLink = root.querySelector('.cn-gallery-link')?.getAttribute('href');
                  return out;
                }"""
            )
            if width == "1280":
                viewer_report.append((slug, viewer))
                if viewer.get("empty"):
                    check(
                        f"E1 {slug} 카드뉴스 뷰어 — 이미지 준비 전 빈 상태(안내 + 캡션 목록)",
                        viewer["thumbs"] == 0,
                        "카드 PNG 없음 → 제작 안내 표시",
                    )
                else:
                    total = viewer["thumbs"]
                    start = int(str(viewer["c0"]).split("/")[0].strip())
                    ok = (
                        viewer["found"]
                        and total >= 1
                        and viewer["c1"] == f"{start % total + 1} / {total}"
                        and viewer["s1"] != viewer["s0"]
                        and viewer["cLast"] == f"{total} / {total}"
                        and viewer["cBack"] == f"1 / {total}"
                        and viewer["dialog"]
                        and viewer["dialogCount"] == f"2 / {total}"
                        and viewer["closed"]
                        and "/gallery/" in (viewer["galleryLink"] or "")
                    )
                    check(
                        f"E1 {slug} 카드뉴스 뷰어 — 넘기기·썸네일·크게 보기·자료앨범 링크",
                        ok,
                        f"{viewer}",
                    )

            # 5분 읽기 글자수
            text = pg.inner_text("body")
            m = re.search(r"([\d,]{3,5})자 \(공백 제외\)", text)
            chars = int(m.group(1).replace(",", "")) if m else -1
            if width == "1280":
                chars_report.append((slug, chars))

            # 운영표 1칸 — 각 fieldset에서 마지막 선택지를 고르고 '칸 채우기'
            sheet = pg.evaluate(
                """() => {
                  const root = document.querySelector('[data-sheet]');
                  if (!root) return { found: false };
                  const before = root.querySelector('[data-sheet-progress]')?.textContent.trim();
                  [...root.querySelectorAll('fieldset')].forEach(fs => {
                    const inputs = [...fs.querySelectorAll('input')];
                    const last = inputs[inputs.length - 1];
                    if (last && !last.checked) { last.checked = true; last.dispatchEvent(new Event('change', { bubbles: true })); }
                  });
                  root.querySelector('[data-sheet-commit]')?.click();
                  return {
                    found: true,
                    variant: root.dataset.variant,
                    before,
                    after: root.querySelector('[data-sheet-progress]')?.textContent.trim(),
                    filled: !root.querySelector('[data-sheet-filled]')?.hidden,
                    empty: root.querySelector('[data-sheet-empty]')?.hidden,
                    rows: [...root.querySelectorAll('.sheet-filled-list dd')].map(d => d.textContent.trim()),
                    stored: Object.keys(localStorage).length,
                  };
                }"""
            )
            if width == "1280":
                sheet_report.append((slug, sheet))
                check(
                    f"E2 {slug} 운영표 1칸 — 채우면 완성({sheet.get('variant')}) · 저장 0건",
                    sheet.get("found")
                    and sheet.get("filled")
                    and sheet.get("empty")
                    and str(sheet.get("after", "")).startswith(
                        (
                            "STEP 1 · 1",
                            "STEP 2 · 1",
                            "STEP 3 · 1",
                            "STEP 4 · 1",
                            "STEP 5 · 1",
                            "STEP 6 · 1",
                            "분산 점검표 · 1",
                            "연금 지도 · 1",
                            "용돈 세 칸 · 1",
                            "구독 정리표 · 1",
                            "실수령 확인표 · 1",
                            "가계 자금 일정표 · 1",
                            "약관 읽기표 · 1",
                        )
                    )
                    and sheet.get("stored") == 0
                    and pg.url == BASE + path,
                    f"{sheet.get('before')} → {sheet.get('after')} · {sheet.get('rows')}",
                )
                el = pg.query_selector("#sheet")
                if el:
                    el.scroll_into_view_if_needed()
                    pg.wait_for_timeout(250)
                    pg.screenshot(path=str(OUT / f"lesson-{slug}-sheet-filled-{width}.png"))

                # 학교 트랙 — 한 화면 한 질문 · 16px/44px
                if slug in SCHOOL:
                    a11y = pg.evaluate(
                        """() => {
                          const root = document.querySelector('[data-school-lesson]');
                          if (!root) return { found: false };
                          const visible = (el) => el.offsetParent !== null && el.getClientRects().length > 0;
                          const leaf = [...root.querySelectorAll('p,li,span,dt,dd,em,strong,a,h1,h2,h3,legend,button')]
                            .filter(el => visible(el) && el.children.length === 0)
                            .filter(el => (el.textContent || '').trim().length > 0)
                            .filter(el => !el.closest('svg'))
                            .filter(el => !el.closest('[data-home-pill]'));
                          const small = leaf
                            .filter(el => parseFloat(getComputedStyle(el).fontSize) < 15.9)
                            .slice(0, 6)
                            .map(el => `${el.tagName.toLowerCase()} ${getComputedStyle(el).fontSize} · ${(el.textContent || '').trim().slice(0, 18)}`);
                          const buttons = [...root.querySelectorAll('button, .btn')]
                            .filter(visible)
                            .map(el => ({ h: Math.round(el.getBoundingClientRect().height), t: (el.textContent || '').trim().slice(0, 14) }))
                            .filter(b => b.h < 44);
                          const items = [...root.querySelectorAll('[data-quiz-item]')];
                          const visItems = () => items.filter(i => !i.hidden).length;
                          const before = visItems();
                          const first = root.querySelector('[data-quiz-opt]');
                          first?.click();
                          const fb = items[0].querySelector('[data-quiz-fb]');
                          const fbText = fb?.textContent?.trim() ?? '';
                          const fbIcon = items[0].querySelector('[data-quiz-icon]')?.textContent?.trim() ?? '';
                          const next = items[0].querySelector('[data-quiz-next]');
                          next?.click();
                          const second = visItems();
                          const count = root.querySelector('[data-quiz-count]')?.textContent?.trim() ?? '';
                          return { found: true, small, buttons, before, second, fbVisible: !!fb && !fb.hidden,
                                   fbText, fbIcon, count };
                        }"""
                    )
                    check(
                        f"E5 {slug} 학교 트랙 — 한 화면 한 질문·16px·버튼 44px·정답 글자+아이콘",
                        a11y.get("found")
                        and a11y.get("before") == 1
                        and a11y.get("second") == 1
                        and a11y.get("fbVisible")
                        and ("맞아요" in a11y.get("fbText", "") or "다시 보기" in a11y.get("fbText", ""))
                        and a11y.get("fbIcon") in {"✓", "↺"}
                        and a11y.get("count", "").startswith("2 / 3")
                        and not a11y.get("small")
                        and not a11y.get("buttons"),
                        f"small={a11y.get('small')} buttons={a11y.get('buttons')} fb={a11y.get('fbText')} {a11y.get('count')}",
                    )
            ctx.close()

    check(
        "E3 5분 읽기 글자수 — 전 강의 1,200~1,500자(공백 제외)",
        all(1200 <= c <= 1500 for _, c in chars_report),
        ", ".join(f"{s}:{c}" for s, c in chars_report),
    )

    # 2-3강 운영표 숫자(파일럿 회귀) — 기본값 148만 5,000원
    ctx, pg, _ = page_at("1280")
    pg.goto(BASE + "/academy/step2-pension-tax-limit/", wait_until="networkidle")
    pg.wait_for_timeout(300)
    pilot = pg.evaluate(
        """() => {
          const root = document.querySelector('[data-sheet]');
          const pick = (name, value) => {
            const el = [...root.querySelectorAll(`input[name="${name}"]`)].find(i => i.value === String(value));
            if (!el) return;
            el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          const credit0 = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-irp', 200);
          const credit200 = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-irp', 300);
          pick('sheet-bracket', 'high');
          const creditHigh = root.querySelector('[data-sheet-credit]')?.textContent.trim();
          pick('sheet-bracket', 'low');
          pick('sheet-irp', 300);
          return { credit0, credit200, creditHigh };
        }"""
    )
    check(
        "E4 2-3강 운영표 계산 148만 5,000 / 132만 / 118만 8,000 (v8.0 회귀)",
        pilot["credit0"] == "148만 5,000원"
        and pilot["credit200"] == "132만원"
        and pilot["creditHigh"] == "118만 8,000원",
        f"{pilot['credit0']} · {pilot['credit200']} · {pilot['creditHigh']}",
    )
    ctx.close()

    # ---------------------------------------------------------------- F 구획 캡처
    for width in (1280, 390):
        ctx, pg, _ = page_at(str(width))
        pg.goto(BASE + "/academy/", wait_until="networkidle")
        pg.wait_for_timeout(300)
        for sel, name in (("#open", "hub-open"), ("#roadmap", "hub-roadmap"), ("#paths", "hub-paths")):
            el = pg.query_selector(sel)
            if el:
                el.scroll_into_view_if_needed()
                pg.wait_for_timeout(250)
                pg.screenshot(path=str(OUT / f"{name}-{width}.png"))

        for slug, path in LESSONS:
            pg.goto(BASE + path, wait_until="networkidle")
            pg.wait_for_timeout(300)
            for sel, name in (
                ("#cardnews", f"lesson-{slug}-cardnews"),
                ("[data-hook]", f"lesson-{slug}-hook"),
                ("#calc", f"lesson-{slug}-calc"),
                ("#sources", f"lesson-{slug}-sources"),
            ):
                el = pg.query_selector(sel)
                if el:
                    el.scroll_into_view_if_needed()
                    pg.wait_for_timeout(200)
                    pg.screenshot(path=str(OUT / f"{name}-{width}.png"))
        ctx.close()

    browser.close()

httpd.shutdown()

failed = [c for c in CHECKS if not c["ok"]]
result = {
    "version": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"],
    "total": len(CHECKS),
    "passed": len(CHECKS) - len(failed),
    "failed": len(failed),
    "nav": {str(k): v for k, v in nav_report.items()},
    "shared": {"viewer": viewer_report, "chars": chars_report, "sheet": sheet_report},
    "checks": CHECKS,
}
(OUT / "verify-academy-v840.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / 'verify-academy-v840.json'}")
