#!/usr/bin/env python3
"""
buffetkimz.com 3단계 — 로컬 실측(스크린샷 · CLS · 광고 자리 · 링크) (v1)

정적 빌드 두 벌을 로컬 HTTP 로 띄워 잰다.
  · 도메인 루트 빌드(기본): dist-domain-root/
  · 광고 자리 프리뷰 빌드: dist-adpreview/  (AD_PREVIEW=1 로 빌드)
  · GitHub Pages 서브패스 빌드(회귀): dist-subpath/ + VERIFY_BASE=/buffetkimz-web

사용:
  SITE_URL=https://buffetkimz.com BASE_PATH=/ npm run build && cp -a dist dist-domain-root
  AD_PREVIEW=1 SITE_URL=https://buffetkimz.com BASE_PATH=/ npm run build && cp -a dist dist-adpreview
  python3 scripts/verify_v3_domain.py

결과: reports/buffetkimz-web/domain-seo-v3/verify-domain-v3.json + shots/*.png
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/domain-seo-v3")
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)

PORT = 4403
PORT_ADS = 4404

DESKTOP = {"width": 1280, "height": 800}
MOBILE = {"width": 390, "height": 844}

# 대표 페이지 — 브리프의 점검 대상(/, /about, /posts, /posts/[slug], /letters, /tools(→/apps), /calendar, /search)
PAGES = [
    ("home", "/"),
    ("about", "/about/"),
    ("posts", "/posts/"),
    ("post", "/posts/isa-pension-300/"),
    ("letters", "/letters/"),
    ("letter", "/letters/2026-11-21/"),
    ("apps", "/apps/"),
    ("app", "/apps/pension-tax/"),
    ("calendar", "/calendar/"),
    ("search", "/search/"),
]

AD_PAGES = [
    ("posts", "/posts/"),
    ("post", "/posts/isa-pension-300/"),
    ("apps", "/apps/"),
    ("calendar", "/calendar/"),
]

report = {"pages": [], "shots": [], "checks": {}, "failures": [], "console_errors": [], "http_errors": []}


def check(name, ok, detail=None):
    report["checks"][name] = {"pass": bool(ok), "detail": detail}
    if not ok:
        report["failures"].append({"check": name, "detail": detail})
    return ok


def serve(directory: pathlib.Path, port: int):
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(directory)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


CLS_JS = """
() => {
  window.__cls = 0;
  window.__shifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__cls += e.value;
        window.__shifts.push({v: e.value, t: e.startTime});
      }
    }).observe({type: 'layout-shift', buffered: true});
  } catch (_) {}
}
"""


def measure(page, url, wait=1600):
    page.goto(url, wait_until="networkidle", timeout=45000)
    page.evaluate(CLS_JS)
    page.wait_for_timeout(wait)
    return page.evaluate("() => ({cls: window.__cls, shifts: (window.__shifts||[]).slice(0,5)})")


def main() -> int:
    domain = ROOT / "dist-domain-root"
    ads = ROOT / "dist-adpreview"
    if not domain.is_dir():
        print("dist-domain-root 가 없습니다. 도메인 루트 빌드를 복사해 두세요.", file=sys.stderr)
        return 2
    if not ads.is_dir():
        print("dist-adpreview 가 없습니다. AD_PREVIEW=1 빌드를 복사해 두세요.", file=sys.stderr)
        return 2

    srv = serve(domain, PORT)
    srv_ads = serve(ads, PORT_ADS)
    base = f"http://127.0.0.1:{PORT}"
    base_ads = f"http://127.0.0.1:{PORT_ADS}"
    try:
        time.sleep(1.0)
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

            # ── 1. 대표 페이지: 스크린샷 · CLS · 콘솔 · 넘침 ─────────────
            for label, vp in (("d", DESKTOP), ("m", MOBILE)):
                ctx = browser.new_context(viewport=vp, device_scale_factor=1, locale="ko-KR")
                page = ctx.new_page()
                page.on(
                    "console",
                    lambda msg, l=label: report["console_errors"].append({"view": l, "type": msg.type, "text": msg.text})
                    if msg.type == "error"
                    else None,
                )
                page.on("pageerror", lambda err, l=label: report["console_errors"].append({"view": l, "type": "pageerror", "text": str(err)}))
                for name, path in PAGES:
                    url = base + path
                    resp = page.goto(url, wait_until="networkidle", timeout=45000)
                    page.evaluate(CLS_JS)
                    page.wait_for_timeout(1400)
                    cls = page.evaluate("() => window.__cls")
                    overflow = page.evaluate(
                        "() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)"
                    )
                    slots = page.evaluate("() => document.querySelectorAll('[data-ad-slot]').length")
                    title = page.title()
                    canonical = page.evaluate(
                        "() => (document.querySelector('link[rel=canonical]')||{}).href || ''"
                    )
                    report["pages"].append(
                        {
                            "view": label,
                            "name": name,
                            "path": path,
                            "status": resp.status if resp else None,
                            "title": title,
                            "canonical": canonical,
                            "cls": round(cls, 5),
                            "overflow": overflow,
                            "ad_slots": slots,
                        }
                    )
                    if resp and resp.status >= 400:
                        report["http_errors"].append({"view": label, "path": path, "status": resp.status})
                    shot = SHOTS / f"{label}-{name}.png"
                    page.screenshot(path=str(shot), full_page=False)
                    report["shots"].append(str(shot))
                    shot_full = SHOTS / f"{label}-{name}-full.png"
                    page.screenshot(path=str(shot_full), full_page=True)
                    report["shots"].append(str(shot_full))
                ctx.close()

            # ── 2. 광고 자리 프리뷰: 예약 높이 · CLS ────────────────────
            ad_report = []
            for label, vp in (("d", DESKTOP), ("m", MOBILE)):
                ctx = browser.new_context(viewport=vp, device_scale_factor=1, locale="ko-KR")
                page = ctx.new_page()
                for name, path in AD_PAGES:
                    page.goto(base_ads + path, wait_until="networkidle", timeout=45000)
                    page.evaluate(CLS_JS)
                    page.wait_for_timeout(1400)
                    cls = page.evaluate("() => window.__cls")
                    boxes = page.evaluate(
                        """() => [...document.querySelectorAll('[data-ad-slot]')].map(el => {
                            const f = el.querySelector('[data-ad-frame]');
                            const r = f ? f.getBoundingClientRect() : null;
                            return {id: el.dataset.adSlot, size: el.dataset.adSize, state: el.dataset.adState,
                                    h: r ? Math.round(r.height) : null, w: r ? Math.round(r.width) : null,
                                    reserved: [Number(el.dataset.adMinHMobile), Number(el.dataset.adMinHDesktop)]};
                        })"""
                    )
                    regions = page.evaluate(
                        """() => {
                            const out = {header: 0, tool_input: 0, first_screen: 0, mid_after_paragraphs: null,
                                         bottom_gap_from_disclaimer: null, disclaimer_before_bottom: null,
                                         count: document.querySelectorAll('[data-ad-slot]').length};
                            out.header = document.querySelectorAll('header [data-ad-slot]').length;
                            out.tool_input = document.querySelectorAll('[data-tool-input-area] [data-ad-slot]').length;
                            const vh = window.innerHeight;
                            out.first_screen = [...document.querySelectorAll('[data-ad-slot]')]
                                .filter(el => el.getBoundingClientRect().top < vh).length;
                            const prose = document.querySelector('.prose-article');
                            const mid = document.querySelector('[data-ad-region="article-mid"]');
                            if (prose && mid) out.mid_after_paragraphs = [...prose.children].indexOf(mid);
                            const disc = document.querySelector('[data-post-disclaimer]');
                            const bottom = document.querySelector('[data-ad-region="article-bottom"]');
                            if (disc && bottom) {
                                out.bottom_gap_from_disclaimer = Math.round(bottom.getBoundingClientRect().top - disc.getBoundingClientRect().bottom);
                                out.disclaimer_before_bottom = !!(disc.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING);
                            }
                            return out;
                        }"""
                    )
                    ad_report.append({"view": label, "name": name, "cls": round(cls, 5), "slots": boxes, "regions": regions})
                    for i, b in enumerate(boxes):
                        el = page.query_selector(f'[data-ad-slot="{b["id"]}"]')
                        if el:
                            shot = SHOTS / f"{label}-ad-{name}-{i}.png"
                            el.screenshot(path=str(shot))
                            report["shots"].append(str(shot))
                    page.screenshot(path=str(SHOTS / f"{label}-ad-{name}-full.png"), full_page=True)
                ctx.close()
            report["ad_preview"] = ad_report

            # ── 3. 실제 배포본에서는 광고 DOM 0 ───────────────────────
            page = browser.new_page(viewport=DESKTOP)
            page.goto(base + "/posts/", wait_until="networkidle")
            live_slots = page.evaluate("() => document.querySelectorAll('[data-ad-slot], .ad-slot').length")
            check("ads.none_in_default_build", live_slots == 0, {"slots": live_slots})

            # ── 4. robots · sitemap · rss · 404 ─────────────────────────
            for path in ("/robots.txt", "/sitemap-index.xml", "/sitemap-0.xml", "/rss.xml", "/search-index.json"):
                r = page.request.get(base + path)
                check(f"http{path}", r.status == 200, {"status": r.status})
            robots = page.request.get(base + "/robots.txt").text()
            check("robots.sitemap_absolute", "Sitemap: https://buffetkimz.com/sitemap-index.xml" in robots, robots.strip()[:160])
            notfound = page.goto(base + "/no-such-page-xyz/", wait_until="domcontentloaded")
            check("404.page", notfound is not None and notfound.status == 404, {"status": notfound.status if notfound else None})

            # ── 5. 내부 링크 크롤(대표 페이지의 링크만, 1단계) ─────────
            broken = []
            seen = set()
            for name, path in PAGES:
                page.goto(base + path, wait_until="domcontentloaded")
                hrefs = page.evaluate("() => [...document.querySelectorAll('a[href]')].map(a => a.href)")
                for href in hrefs:
                    if not href.startswith(base):
                        continue
                    clean = href.split("#")[0]
                    if clean in seen:
                        continue
                    seen.add(clean)
                    r = page.request.get(clean)
                    if r.status >= 400:
                        broken.append({"from": path, "url": clean, "status": r.status})
            check("links.crawl_no_404", not broken, {"broken": broken[:10], "checked": len(seen)})
            browser.close()
    finally:
        srv.terminate()
        srv_ads.terminate()

    # ── 집계 ───────────────────────────────────────────────────────────
    cls_vals = [p["cls"] for p in report["pages"]]
    # 회의실 기준: CLS < 0.1 (광고 자리가 원인인 밀림은 0 이어야 한다)
    check("cls.under_0_1", all(v < 0.1 for v in cls_vals), {"max": max(cls_vals) if cls_vals else None, "by_page": {f"{p['view']}-{p['name']}": p["cls"] for p in report["pages"]}})
    over = [p for p in report["pages"] if p["overflow"] > 0]
    check("layout.no_horizontal_overflow", not over, {"pages": over[:5]})
    check("console.no_errors", not report["console_errors"], {"errors": report["console_errors"][:5]})
    check("pages.no_http_errors", not report["http_errors"], {"errors": report["http_errors"][:5]})

    ad_h = []
    for entry in report.get("ad_preview", []):
        for s in entry["slots"]:
            want = s["reserved"][0] if entry["view"] == "m" else s["reserved"][1]
            ad_h.append({"view": entry["view"], "id": s["id"], "h": s["h"], "want": want, "ok": s["h"] == want})
    check(
        "ads.reserved_height_exact",
        bool(ad_h) and all(a["ok"] for a in ad_h),
        {"mismatch": [a for a in ad_h if not a["ok"]][:6], "measured": len(ad_h)},
    )
    ad_cls = [e["cls"] for e in report.get("ad_preview", [])]
    check("ads.preview_cls_zero", all(v < 0.01 for v in ad_cls), {"max": max(ad_cls) if ad_cls else None})

    # 금지 구역·허용 위치 규칙 (기준안: 헤더·입력폼·본문 첫 화면 금지, 면책 블록과 24px 이상)
    reg = [e for e in report.get("ad_preview", [])]
    bad_header = [e for e in reg if e["regions"]["header"]]
    bad_input = [e for e in reg if e["regions"]["tool_input"]]
    bad_first = [e for e in reg if e["regions"]["first_screen"]]
    check("ads.not_in_header", not bad_header, {"pages": [e["name"] for e in bad_header]})
    check("ads.not_in_tool_input", not bad_input, {"pages": [e["name"] for e in bad_input]})
    check("ads.below_first_screen", not bad_first, {"pages": [e["name"] for e in bad_first]})
    post_regs = [e["regions"] for e in reg if e["name"] == "post"]
    mids = [r["mid_after_paragraphs"] for r in post_regs if r.get("mid_after_paragraphs") is not None]
    check("ads.mid_after_3_blocks", all(m >= 3 for m in mids), {"positions": mids})
    gaps = [r["bottom_gap_from_disclaimer"] for r in post_regs if r.get("bottom_gap_from_disclaimer") is not None]
    check("ads.bottom_gap_24px", bool(gaps) and all(g >= 24 for g in gaps), {"gaps": gaps})
    check("ads.disclaimer_before_ad", all(r.get("disclaimer_before_bottom") for r in post_regs), {"pages": post_regs})
    per_page = []
    for e in reg:
        if e["name"] == "post" and e["view"] == "d":
            per_page.append({"page": e["name"], "slots": e["regions"]["count"]})
    check("ads.max_2_per_article_desktop", all(x["slots"] <= 2 for x in per_page), {"pages": per_page})

    report["summary"] = {
        "pages_measured": len(report["pages"]),
        "shots": len(report["shots"]),
        "checks": len(report["checks"]),
        "pass": sum(1 for c in report["checks"].values() if c["pass"]),
        "fail": len(report["failures"]),
        "result": "PASS" if not report["failures"] else "FAIL",
        "max_cls": max(cls_vals) if cls_vals else None,
    }
    (OUT / "verify-domain-v3.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{report['summary']['result']}] pages {len(report['pages'])} · shots {len(report['shots'])} · checks {report['summary']['pass']}/{len(report['checks'])}")
    for f in report["failures"]:
        print("  ✗", f["check"], json.dumps(f["detail"], ensure_ascii=False)[:200])
    return 0 if not report["failures"] else 1


if __name__ == "__main__":
    sys.exit(main())
