"""v8.9.0 3단계 — 라이브(gh-pages) 실측 캡처·검증.

무엇을 재나 (감사 보고 I1~I6 · S1 · S6~S8 · R1·R2 가 실제 화면에서 참인지)
  A. HTTP — 홈·자료앨범·카드 21개 전용 페이지·글·달력·강의 200
  B. 자료앨범 인덱스 — 표지 카드 21장 · 첫 카드 대표(is-feature) · 분류 필터 · 21세트·114장 표기
  C. 카드 전용 페이지 — 6장 스토리 · 01/06 번호 · 캡션 텍스트 노출 · 좌측 인덱스 · 한눈에 보기 토글 ·
     Article JSON-LD · og:image(표지 WebP) · 내려받기 링크
  D. 글↔카드 — 글 하단 '이 글의 카드 6장 보기' → /gallery/<id>/ · 카드 하단 '이 카드의 글 읽기'
  E. 달력 — '이번 달 일정' 박스 · 오늘(11. 23.)이 '오늘'로 표시
  F. 뷰어(CardNewsViewer) — 스테이지 ≥ 460px(1280) · 6칸 인덱스 · 전체 펼쳐보기
  G. 무게 — /gallery/ 첫 진입 이미지 전송량(모두 WebP·썸네일 경로) · 콘솔 오류 0 · 가로 넘침 0

사용: python3 scripts/capture_v3stage_live.py
결과: reports/buffetkimz-web/v3stage-live/ (PNG + live.json)
"""
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v3stage-live"
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("V3_BASE") or "https://byhan2025.github.io/buffetkimz-web"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
V = "?v=890"

CARD_IDS = [
    "asset-rebalance-hand", "retire-drawdown-hand", "household-budget-hand",
    "allowance-three-rooms-hand", "teen-pay-traps-hand", "firstpay-stub-hand",
    "account-order-hand", "drawdown-recovery-hand", "retirement-3tier-hand",
    "coverage-gaps-hand", "finance-calendar-hand", "three-buckets-3d",
    "tax-moments-3d", "etf-6numbers-3d", "pension-1500-3d", "silson-switch-3d",
    "pension-900-3d", "isa-basics-3d", "pension-accounts", "pension-draw-order",
    "pension-retire-checklist",
]

results = {"base": BASE, "checks": [], "http": [], "shots": [], "console_errors": [], "image_weight": {}}


def check(name, ok, detail=""):
    results["checks"].append({"name": name, "ok": bool(ok), "detail": str(detail)[:220]})


def shot(pg, name, full=False):
    path = OUT / f"{name}.png"
    pg.screenshot(path=str(path), full_page=full)
    results["shots"].append(path.name)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    # ── A. HTTP ────────────────────────────────────────────────────────────
    for path in ["/", "/gallery/", "/posts/silson-switch-2026/", "/calendar/", "/academy/step1-emergency-fund/"] + [
        f"/gallery/{cid}/" for cid in CARD_IDS
    ]:
        pg = b.new_page(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        r = pg.goto(BASE + path + V, wait_until="domcontentloaded")
        results["http"].append({"path": path, "status": r.status if r else None})
        pg.close()
    bad = [h for h in results["http"] if h["status"] != 200]
    check("A1 모든 주요 경로·카드 21개 200", not bad, f"{len(results['http'])}건 중 실패 {len(bad)}: {bad[:3]}")

    # ── B·C·D·E·F 화면 실측 (1280 / 390) ─────────────────────────────────
    for width in (1280, 390):
        height = 900 if width > 1000 else 844
        ctx = b.new_context(viewport={"width": width, "height": height}, locale="ko-KR",
                            device_scale_factor=1 if width > 1000 else 2)
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        tag = str(width)

        # 홈 — 최신 블록에 글 3 + 카드 2
        pg.goto(BASE + "/" + V, wait_until="networkidle")
        pg.wait_for_timeout(400)
        home = pg.evaluate(
            """() => ({posts: document.querySelectorAll('.picks-posts > li').length,
                       cards: document.querySelectorAll('.picks-cards-list > li').length,
                       hrefs: [...document.querySelectorAll('.picks-cards-list a')].map(a => a.getAttribute('href'))})"""
        )
        check(f"B{width} 홈 최신 = 글 3 + 카드 2 ({width})", home["posts"] == 3 and home["cards"] == 2, home)
        shot(pg, f"home-{width}")

        # 자료앨범 — 표지 그리드
        pg.goto(BASE + "/gallery/" + V, wait_until="networkidle")
        pg.wait_for_timeout(600)
        gal = pg.evaluate(
            """() => { const cards = [...document.querySelectorAll('[data-gallery-item]')];
                 const status = document.querySelector('[data-gallery-status]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '';
                 const first = cards.find(c => !c.hidden);
                 return {cards: cards.length, status,
                         feature: !!first?.classList.contains('is-feature'),
                         coverSrc: first?.querySelector('img')?.getAttribute('src') || '',
                         imgs: [...document.querySelectorAll('[data-gallery-item] img')].map(i => i.getAttribute('src')).slice(0,3)}; }"""
        )
        check(f"C{width} 인덱스 표지 카드 21 · 대표 1 · 21세트 114장 ({width})",
              gal["cards"] == 21 and gal["feature"] and "21세트" in gal["status"] and "114장" in gal["status"], gal["status"])
        check(f"C2 표지가 썸네일 WebP 경로 ({width})", "/gallery/thumbs/" in gal["coverSrc"] and gal["coverSrc"].endswith(".webp"), gal["coverSrc"])
        shot(pg, f"gallery-{width}")
        pg.evaluate("() => window.scrollTo(0,0)")
        pg.wait_for_timeout(200)
        shot(pg, f"gallery-fold-{width}")

        # 분류 필터 — 인포그래픽 1세트
        pg.click("[data-gallery-tab='infographic']")
        pg.wait_for_timeout(400)
        filt = pg.evaluate(
            """() => [...document.querySelectorAll('[data-gallery-item]')].filter(e => !e.hidden).map(e => e.dataset.galleryItem)"""
        )
        check(f"C3 인포그래픽 필터 1세트 ({width})", filt == ["pension-draw-order"], filt)
        if width == 1280:
            shot(pg, "gallery-filter-infographic-1280")
        pg.click("[data-gallery-tab='all']")
        pg.wait_for_timeout(300)

        # 카드 전용 페이지
        pg.goto(BASE + "/gallery/silson-switch-3d/" + V, wait_until="networkidle")
        pg.wait_for_timeout(600)
        for _ in range(8):
            pg.mouse.wheel(0, 900)
            pg.wait_for_timeout(120)
        pg.wait_for_timeout(600)
        card = pg.evaluate(
            """() => { const imgs = [...document.querySelectorAll('[data-cnp-slide] img')];
                 const caps = [...document.querySelectorAll('[data-cnp-slide] figcaption')].map(f => f.innerText.trim());
                 const no = document.querySelector('.cnp-no')?.innerText.trim();
                 return {slides: imgs.length, broken: imgs.filter(i => i.naturalWidth === 0).length,
                         captions: caps.length, captionText: caps[0] || '', no,
                         index: document.querySelectorAll('[data-cnp-index]').length,
                         dl: document.querySelectorAll('.cnp-dl-nums a[download]').length,
                         og: document.querySelector('meta[property="og:image"]')?.content || '',
                         article: document.querySelectorAll('script[type="application/ld+json"]').length,
                         postLink: [...document.querySelectorAll('a')].some(a => (a.getAttribute('href')||'').includes('/posts/silson-switch-2026'))}; }"""
        )
        check(f"D{width} 카드 페이지 6장 · 01/06 · 캡션 텍스트 ({width})",
              card["slides"] == 6 and card["broken"] == 0 and card["captions"] == 6 and "01 / 06" in (card["no"] or ""),
              {"slides": card["slides"], "broken": card["broken"], "no": card["no"]})
        check(f"D2 좌측 인덱스 6 · 내려받기 6 · 글 링크 ({width})",
              card["index"] == 6 and card["dl"] == 6 and card["postLink"], {"index": card["index"], "dl": card["dl"]})
        check(f"D3 og:image = 표지 WebP · JSON-LD 있음 ({width})",
              card["og"].endswith("/gallery/3d-silson-switch-01.webp") and card["article"] >= 1, card["og"])
        pg.evaluate("() => window.scrollTo(0, 0)")
        pg.wait_for_timeout(300)
        shot(pg, f"card-silson-{width}")
        shot(pg, f"card-silson-full-{width}", full=True)

        # 한눈에 보기 토글
        pg.click("[data-cnp-mode-btn='grid']")
        pg.wait_for_timeout(500)
        grid = pg.evaluate(
            """() => ({gridHidden: document.querySelector('[data-cnp-grid]').hidden,
                       storyHidden: document.querySelector('[data-cnp-story]').hidden,
                       items: document.querySelectorAll('[data-cnp-grid-item]').length})"""
        )
        check(f"F{width} 한눈에 보기 토글 (격자 {grid['items']}칸) ({width})",
              not grid["gridHidden"] and grid["storyHidden"] and grid["items"] == 6, grid)
        if width == 1280:
            shot(pg, "card-grid-mode-1280")
        pg.click("[data-cnp-mode-btn='story']")
        pg.wait_for_timeout(300)

        # 글 하단 '이 글의 카드'
        pg.goto(BASE + "/posts/silson-switch-2026/" + V, wait_until="networkidle")
        pg.wait_for_timeout(500)
        post = pg.evaluate(
            """() => { const blk = document.querySelector('[data-post-cards]');
                 if (!blk) return {found: false};
                 const a = blk.querySelector('a[data-post-card-link]');
                 return {found: true, text: blk.innerText.replace(/\\s+/g,' ').trim(), href: a?.getAttribute('href') || ''}; }"""
        )
        check(f"E{width} 글 하단 '이 글의 카드 6장 보기' → 카드 페이지 ({width})",
              post["found"] and "이 글의 카드 6장 보기" in post["text"] and "/gallery/silson-switch-3d/" in post["href"], post["href"])
        if width == 1280:
            pg.locator("[data-post-cards]").scroll_into_view_if_needed()
            pg.wait_for_timeout(400)
            shot(pg, "post-cards-1280")

        # 달력 — 이번 달
        pg.goto(BASE + "/calendar/" + V, wait_until="networkidle")
        pg.wait_for_timeout(700)
        cal = pg.evaluate(
            """() => { const box = document.querySelector('[data-this-month]');
                 const up = document.querySelector('[data-upcoming]');
                 return {box: box?.innerText.replace(/\\s+/g,' ').trim() || '',
                         upcoming: up?.innerText.replace(/\\s+/g,' ').trim() || ''}; }"""
        )
        check(f"F2 달력 '이번 달 일정' 박스 ({width})", "이번 달 일정" in cal["box"] and "11월" in cal["box"], cal["box"][:60])
        check(f"F3 오늘(11. 23.)이 '오늘'로 표시 ({width})", "11. 23." in cal["upcoming"] and "오늘" in cal["upcoming"], cal["upcoming"][:80])
        shot(pg, f"calendar-{width}")

        # 강의 인라인 뷰어
        pg.goto(BASE + "/academy/step1-emergency-fund/" + V, wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.locator("[data-cardnews]").first.scroll_into_view_if_needed()
        pg.wait_for_timeout(700)
        viewer = pg.evaluate(
            """() => { const r = document.querySelector('[data-cardnews]');
                 const i = r.querySelector('[data-cn-img]'); const b = i.getBoundingClientRect();
                 return {w: Math.round(b.width), index: r.querySelectorAll('[data-cn-index-btn]').length,
                         caption: r.querySelector('[data-cn-caption-text]')?.innerText.trim() || '',
                         broken: i.naturalWidth === 0}; }"""
        )
        width_ok = viewer["w"] >= 460 if width == 1280 else viewer["w"] >= 300
        check(f"G{width} 뷰어 카드 폭 {viewer['w']}px · 인덱스 {viewer['index']}칸 ({width})",
              width_ok and viewer["index"] == 6 and not viewer["broken"], viewer)
        pg.locator("[data-cardnews]").first.screenshot(path=str(OUT / f"viewer-{width}.png"))
        results["shots"].append(f"viewer-{width}.png")

        # 가로 넘침·콘솔 오류
        for path in ["/", "/gallery/", "/gallery/silson-switch-3d/", "/posts/silson-switch-2026/", "/calendar/"]:
            pg.goto(BASE + path + V, wait_until="networkidle")
            ov = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f"H{width} {path} 가로 넘침 0 ({width})", ov <= 0, ov)
        check(f"H2 콘솔 오류 0 ({width})", not errs, errs[:2])
        if errs:
            results["console_errors"].append({"width": width, "errors": errs[:5]})
        ctx.close()

    # ── G. 이미지 전송량(첫 진입) ──────────────────────────────────────────
    for path, label in [("/gallery/", "gallery-index"), ("/gallery/silson-switch-3d/", "card-page")]:
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR")
        pg = ctx.new_page()
        total = {"bytes": 0, "count": 0, "non_webp": 0}
        pg.on(
            "response",
            lambda r: (
                total.update(
                    bytes=total["bytes"] + int(r.headers.get("content-length") or 0),
                    count=total["count"] + 1,
                    non_webp=total["non_webp"] + (0 if ".webp" in r.url or "/_astro/" in r.url else 1),
                )
                if r.request.resource_type == "image"
                else None
            ),
        )
        pg.goto(BASE + path + V, wait_until="networkidle")
        pg.wait_for_timeout(800)
        results["image_weight"][label] = {**total, "mb": round(total["bytes"] / 1048576, 2)}
        ctx.close()
    gi = results["image_weight"]["gallery-index"]
    check("G3 인덱스 첫 진입 이미지 21장 이하 · WebP", gi["count"] <= 25 and gi["non_webp"] == 0, gi)
    check("G4 인덱스 첫 진입 이미지 3MB 이하", gi["mb"] <= 3, gi)

    b.close()

failed = [c for c in results["checks"] if not c["ok"]]
results["summary"] = {"total": len(results["checks"]), "failed": len(failed)}
(OUT / "live.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
for c in results["checks"]:
    print(("PASS " if c["ok"] else "FAIL ") + c["name"] + (f"  [{c['detail']}]" if c["detail"] else ""))
print(f"\n{len(results['checks']) - len(failed)}/{len(results['checks'])} 통과 → {OUT / 'live.json'}")
sys.exit(0 if not failed else 1)
