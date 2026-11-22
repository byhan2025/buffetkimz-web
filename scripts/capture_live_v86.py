#!/usr/bin/env python3
"""v8.6.0 — 99점 마감 패치 실측 캡처·검증.

무엇을 재는가
  A. 8주소 × 1280·390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. P0/P1 문구 — 조기수령 6%·은퇴 예시 2,040만·퇴직금 세금 재원·청약 5년 기산·비교과세 110만·10년 분산
  C. 계산기 재현 — 연봉 실수령(보험료 공제)·배당 초과분(지방세 포함)·건보 50%·연금소득공제·전세 입력 검증
  D. 390 퀵탭 — '홈' 44×44 이상 · 알약 잘림 없음
  E. 아카데미 17강 og:image — 강의별 카드 01 표지
  F. 자료앨범 라이트박스 — 빈 src=""·href="" 없음 · 열면 이미지가 붙는다
  G. sitemap — 글 30편·아카데미 17강 포함 · lastmod 2026-11-22

사용: npm run build && python3 scripts/capture_live_v86.py [--local]
결과: /workspace/reports/buffetkimz-web/v86-live/
"""
from __future__ import annotations

import http.server
import json
import mimetypes
import os
import pathlib
import re
import socket
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v86-live")
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PW_CHROME") or (
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)
LIVE = "https://byhan2025.github.io/buffetkimz-web"
LOCAL = "--local" in sys.argv
BASE = "" if LOCAL else LIVE
PORT = 8187
SUFFIX = "?v=860"

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
    BASE = f"http://127.0.0.1:{PORT}/buffetkimz-web"

PAGES = [
    ("home", "/"),
    ("academy", "/academy/"),
    ("lesson-retire1", "/academy/school-retire-3tier-order/"),
    ("lesson-41", "/academy/step4-retire-drawdown-order/"),
    ("gallery", "/gallery/"),
    ("posts", "/posts/"),
    ("apps", "/apps/"),
    ("tool-account-tax", "/apps/account-tax-compare/run"),
]

POSTS = [
    "posts/ai-coverage-tool", "posts/ai-work-order", "posts/economy-fx-grocery",
    "posts/economy-service-prices", "posts/economy-subscription-25",
    "posts/finance-financial-income-2000", "posts/finance-gift-10year-limit",
    "posts/finance-health-dependent", "posts/finance-jeonse-buttimok",
    "posts/finance-rate-gap", "posts/finance-silson-generations",
    "posts/invest-bond-duration", "posts/invest-dca-rule",
    "posts/invest-dividend-total-return", "posts/invest-etf-six-numbers",
    "posts/invest-fx-hedge-cost", "posts/invest-overseas-stock-tax",
    "posts/pension-early-withdrawal-165", "posts/pension-master-01-four-accounts",
    "posts/pension-master-02-tax-compare", "posts/pension-master-03-yearend-900",
    "posts/pension-master-04-asset-etf", "posts/pension-master-05-draw-1500",
    "posts/pension-master-06-healthcheck", "posts/retire-fixed-cost",
    "posts/retire-severance-db-dc", "posts/philosophy-numbers-are-questions",
]
LESSONS = [
    "step1-three-buckets", "step1-emergency-fund", "step2-account-order",
    "step2-isa-numbers", "step2-pension-tax-limit", "step3-drawdown-recovery",
    "step3-etf-six-numbers", "step4-retire-drawdown-order",
    "step5-silson-generation-switch", "step6-rebalance-cash",
    "school-elementary-allowance", "school-teen-payments", "school-firstpay-stub",
    "school-household-cashflow", "school-household-coverage",
    "school-asset-split-weights", "school-retire-3tier-order",
]

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:400]})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ── A. 8주소 × 1280·390 ──────────────────────────────────────────
        for w, h in ((1280, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w == 390 else 1)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            for name, path in PAGES:
                resp = page.goto(BASE + path + SUFFIX, wait_until="load")
                page.wait_for_timeout(600)
                over = page.evaluate(
                    "() => document.documentElement.scrollWidth - window.innerWidth"
                )
                status = resp.status if resp else None
                check(f"A {w} {name} — 200 · 넘침 0 · 콘솔 0", status == 200 and over <= 0 and not errors,
                      f"http {status} · hOverflow {over} · err {errors[:2]}")
                if w == 390:
                    page.screenshot(path=str(OUT / f"390-{name}.png"))
                else:
                    page.screenshot(path=str(OUT / f"1280-{name}.png"))
                errors.clear()
            ctx.close()

        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = ctx.new_page()

        # ── D. 390 퀵탭 ─────────────────────────────────────────────────
        page.goto(BASE + "/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(500)
        quick = page.evaluate(
            """() => [...document.querySelectorAll('.site-quick-link')].map(a => {
                 const r = a.getBoundingClientRect();
                 return {t: a.textContent.trim(), x: Math.round(r.left), w: Math.round(r.width),
                         h: Math.round(r.height), r: Math.round(r.right)};
               })"""
        )
        home = quick[0] if quick else {"w": 0, "h": 0, "x": 0, "r": 0}
        check("D 390 퀵탭 '홈' 44×44 이상 · 화면 안", home["w"] >= 44 and home["h"] >= 44 and home["x"] >= 0 and home["r"] <= 390,
              f"{home} · 전체 {[(q['t'], q['w']) for q in quick]}")
        page.screenshot(path=str(OUT / "390-quicktabs.png"), clip={"x": 0, "y": 60, "width": 390, "height": 120})

        # ── E. 아카데미 17강 og:image ───────────────────────────────────
        og_bad = []
        for slug in LESSONS:
            page.goto(BASE + f"/academy/{slug}/" + SUFFIX, wait_until="domcontentloaded")
            og = page.evaluate("() => document.querySelector('meta[property=\"og:image\"]')?.content || ''")
            if not re.search(r"/gallery/3d-[a-z0-9-]+-\d\d\.png$", og):
                og_bad.append((slug, og))
        check("E 아카데미 17강 og:image = 강의 카드 01", not og_bad, f"미적용 {len(og_bad)}건 {og_bad[:2]}")

        # ── F. 자료앨범 라이트박스 ──────────────────────────────────────
        page.goto(BASE + "/gallery/" + SUFFIX, wait_until="load")
        page.wait_for_timeout(600)
        html = page.content()
        empty = html.count('src=""') + len(re.findall(r'<a href=""', html))
        page.click("[data-gallery-open]")
        page.wait_for_timeout(500)
        lb = page.evaluate(
            """() => {
                 const d = document.querySelector('[data-gallery-lightbox]');
                 const i = document.querySelector('[data-lb-img]');
                 const a = document.querySelector('[data-lb-download]');
                 return {open: !!d?.open, src: i?.getAttribute('src') || '', hidden: i?.hidden,
                         href: a?.getAttribute('href') || ''};
               }"""
        )
        check("F 라이트박스 — 빈 src·href 0 · 열면 이미지·내려받기 연결",
              empty == 0 and lb["open"] and lb["src"].endswith(".png") and lb["href"].endswith(".png") and not lb["hidden"],
              f"빈속성 {empty} · {lb}")
        page.screenshot(path=str(OUT / "390-gallery-lightbox.png"))
        tabs = page.evaluate(
            "() => [...document.querySelectorAll('[data-gallery-tab]')].map(t => [t.dataset.galleryTab, t.dataset.count])"
        )
        cards = page.evaluate("() => document.querySelectorAll('[data-gallery-item]').length")
        check("F 필터 탭이 카드 분류를 모두 덮음", sum(int(c) for _, c in tabs) == cards * 2 if tabs else False,
              f"tabs {tabs} · cards {cards}")
        ctx.close()

        # ── B. 문구 ─────────────────────────────────────────────────────
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        texts = {}
        for key, path in [
            ("retire1", "/academy/school-retire-3tier-order/"),
            ("l41", "/academy/step4-retire-drawdown-order/"),
            ("l51", "/academy/step5-silson-generation-switch/"),
            ("severance", "/posts/retire-severance-db-dc/"),
            ("subscription", "/posts/economy-subscription-25/"),
            ("fin2000", "/posts/finance-financial-income-2000/"),
            ("pm02", "/posts/pension-master-02-tax-compare/"),
            ("pm06", "/posts/pension-master-06-healthcheck/"),
            ("hub", "/academy/"),
            ("gallery", "/gallery/"),
        ]:
            page.goto(BASE + path + SUFFIX, wait_until="load")
            texts[key] = page.inner_text("body")

        check("B 은퇴1강 — 조기수령 1년 6%·최대 30%", "1년마다 6%" in texts["retire1"] and "20,000" not in texts["retire1"],
              "6% 표기")
        check("B 은퇴1강 — 예시 공적연금 2,040만 · 2,160만 없음",
              "2,040만원" in texts["retire1"] and "2,160" not in texts["retire1"], "")
        check("B 은퇴1강 — 사적연금 미부과 단서", "사적연금에 보험료를 부과하지 않" in texts["retire1"], "")
        check("B 은퇴1강 — 분리과세·인출 풀이", "분리과세(다른 소득과 합치지 않고" in texts["retire1"]
              and "인출(연금계좌에서" in texts["retire1"], "")
        check("B 4-1강 — 인출·분리과세 풀이", "인출(연금계좌에서" in texts["l41"] and "분리과세는 다른 소득과" in texts["l41"], "")
        check("B 5-1강 — 실손 풀이", "실손(실손의료보험" in texts["l51"], "")
        check("B 퇴직금 — 퇴직소득세 70%·60%·50%", "퇴직소득세의 70%(수령 10년 초과 60%, 20년 초과 50%)" in texts["severance"], "")
        check("B 청약 — 가입일부터 5년", "가입일부터 5년 이내" in texts["subscription"] and "공제를 받은 뒤 5년" not in texts["subscription"], "")
        check("B 금융소득 — 초과분 110만·지방세 포함", "110만 원" in texts["fin2000"] and "15.4%" in texts["fin2000"], "")
        check("B 연금 2편 — 10년 분산 조건", "10년 분산" in texts["pm02"], "")
        check("B 피부양자 — 유보 문구", "부과하지 않습니다" in texts["pm06"], "")
        check("B 허브 — 용어 한 줄 풀이", all(w in texts["hub"] for w in ["IRP", "ISA", "리밸런싱", "실손", "원천징수"]), "")
        check("B 허브 — 공개/계획 강수", "공개 2강 / 계획 6강" in texts["hub"], "")
        # 카드 각주는 활성 장만 화면에 그린다 — JSON 페이로드에서 전 장을 확인한다
        gdata = page.evaluate("() => document.getElementById('gallery-data')?.textContent || ''")
        check("B 자료앨범 — 카드 각주 정합(공적연금 포함·30~50%)",
              "공적연금 포함 소득 합계" in gdata and "30~50%" in gdata, "")
        ctx.close()

        # ── C. 계산기 재현 ──────────────────────────────────────────────
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})

        # C1 연봉 실수령 — 건강·장기요양·고용보험료 공제 반영
        page = ctx.new_page()
        page.goto(BASE + "/apps/salary-net/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        net = page.inner_text("[data-testid='net-pay']")
        check("C1 연봉 4,800·1인·식대 20 — 월 실수령 3,436,740원(보험료 공제 반영)", "3,436,740" in net, net.replace("\n", " "))

        # C2 배당 초과분 — 3,000만·한계 24% → 110만 원
        page.goto(BASE + "/apps/dividend-tax/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        page.get_by_role("textbox", name="연간 이자소득").fill("0")
        page.get_by_role("textbox", name="연간 국내 배당소득").fill("3000")
        page.get_by_role("textbox", name="연간 해외 배당소득").fill("0")
        page.wait_for_timeout(500)
        body = page.inner_text("body")
        check("C2 배당 3,000만·24% — 초과분 추가 부담 1,100,000원", "1,100,000" in body, "초과분 11.0%p")

        # C3 건보 비교 — 연금·근로 1,200만은 50% 반영(소득월액 60만)
        page.goto(BASE + "/apps/health-insurance-compare/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        body = page.inner_text("body")
        check("C3 건보 — 연금소득 50% 반영(소득분 251,650원 = 350만 × 7.19%)",
              "251,650" in body and "× 50%" in body, "")

        # C4 연금 인출 — 원천징수에 연금소득공제 반영(1,200만 → 335,500원)
        page.goto(BASE + "/apps/pension-draw/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(1000)
        page.get_by_role("textbox", name=re.compile("연간 사적연금")).fill("1200")
        page.get_by_role("textbox", name=re.compile("국민연금 등 공적연금")).fill("0")
        page.wait_for_timeout(600)
        body = page.inner_text("body")
        check("C4 연금 인출 — 사적연금 1,200만 원천징수 335,500원(연금소득공제 반영)", "335,500" in body, "")

        # C5 4대 계좌 — 평가액 전액이 아니라 연금소득공제 반영
        page.goto(BASE + "/apps/account-tax-compare/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(1000)
        body = page.inner_text("body")
        check("C5 4대 계좌 — 연금소득공제 문구 노출", "연금소득공제" in body, "")

        # C6 전세 — 보증금이 전세보다 크면 안내
        page.goto(BASE + "/apps/rent-jeonse/run" + SUFFIX, wait_until="load")
        page.wait_for_timeout(900)
        page.get_by_role("textbox", name="월세보증금").fill("40000")
        page.wait_for_timeout(400)
        warn = page.evaluate("() => !!document.querySelector('[data-rent-invalid]')")
        check("C6 전세 — 보증금>전세 입력 검증", warn, "")
        ctx.close()

        browser.close()

    # ── G. sitemap ─────────────────────────────────────────────────────
    if LOCAL:
        xml = (APP / "dist" / "sitemap-0.xml").read_text()
    else:
        import urllib.request

        xml = urllib.request.urlopen(LIVE + "/sitemap-0.xml", timeout=30).read().decode()
    locs = re.findall(r"<loc>(.*?)</loc>", xml)
    lastmod = set(re.findall(r"<lastmod>([^<]+)</lastmod>", xml))
    posts_in = sum(1 for u in locs if "/posts/" in u and u.rstrip("/").count("/") >= 5)
    lessons_in = sum(1 for u in locs if "/academy/" in u and u.rstrip("/").count("/") >= 5)
    check("G sitemap — 글 30편·아카데미 17강 포함", posts_in >= 30 and lessons_in >= 17, f"글 {posts_in} · 강의 {lessons_in} · 전체 {len(locs)}")
    check("G sitemap lastmod 2026-11-22", any(d.startswith("2026-11-22") for d in lastmod), str(sorted(lastmod)[:2]))

    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    (OUT / f"verify-v86{'-local' if LOCAL else ''}.json").write_text(
        json.dumps({"passed": passed, "total": total, "results": results}, ensure_ascii=False, indent=1)
    )
    print(f"\n{passed}/{total} 통과 → {OUT}/verify-v86{'-local' if LOCAL else ''}.json")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
