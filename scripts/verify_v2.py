"""
buffetkimz v2 실측 검증 — 빌드 결과를 preview 서버로 열어 확인한다.
사용: python3 scripts/verify_v2.py  (서버가 4321에서 떠 있어야 함)
결과: reports/buffetkimz-web/v2/ 아래 스크린샷과 verify-report.json
"""
import json
import os
import re
import pathlib
import time

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4321"
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v2")
OUT.mkdir(parents=True, exist_ok=True)

report = {"pages": [], "console_errors": [], "broken_links": [], "search": [], "layout": {}, "notes": []}


def attach(page, name):
    page.on("console", lambda msg: report["console_errors"].append({"page": name, "type": msg.type, "text": msg.text}) if msg.type == "error" else None)
    page.on("pageerror", lambda err: report["console_errors"].append({"page": name, "type": "pageerror", "text": str(err)}))


def goto(page, name, path, wait="networkidle"):
    resp = page.goto(BASE + path, wait_until=wait, timeout=30000)
    page.wait_for_timeout(400)
    report["pages"].append({"name": name, "path": path, "status": resp.status if resp else None})
    return resp


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- 데스크톱 ----------
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        attach(page, "desktop")

        goto(page, "home", "/")
        page.screenshot(path=str(OUT / "desktop-home.png"), full_page=True)
        page.screenshot(path=str(OUT / "desktop-home-fold.png"))
        # 히어로 실시간 검색
        page.fill("#hero-search", "실손")
        page.wait_for_timeout(500)
        report["layout"]["hero_suggestions"] = page.eval_on_selector_all("#hero-search-results li", "e => e.length")
        page.screenshot(path=str(OUT / "desktop-home-search-suggest.png"))
        page.keyboard.press("Escape")

        goto(page, "posts", "/posts")
        page.screenshot(path=str(OUT / "desktop-posts.png"), full_page=True)

        goto(page, "category", "/posts/insurance")
        page.screenshot(path=str(OUT / "desktop-category.png"), full_page=True)

        goto(page, "post", "/posts/insurance-silson-5th")
        page.screenshot(path=str(OUT / "desktop-post.png"), full_page=True)
        report["layout"]["post_adslot"] = page.eval_on_selector_all("[data-ad-slot]", "e => e.length")
        hero_text = page.locator("body > header").inner_text()
        report["layout"]["header_nav"] = hero_text.replace("\n", " ")

        goto(page, "home-check", "/")
        hero = page.locator("section").first.inner_text()
        report["layout"]["hero_has_sales_words"] = any(w in hero for w in ["상담", "설계사", "카카오"])

        # 검색 페이지 — 실제 입력
        goto(page, "search", "/search")
        page.screenshot(path=str(OUT / "desktop-search.png"), full_page=True)

        for q in ["연금", "실손", "AI", "실손 세대", "세액공제 900"]:
            page.fill("#search-input-page", "")
            t0 = time.time()
            page.fill("#search-input-page", q)
            page.wait_for_timeout(250)
            elapsed = (time.time() - t0) * 1000
            count = page.eval_on_selector_all("#search-results li", "els => els.length")
            first = page.evaluate("() => document.querySelector('#search-results li a')?.innerText?.slice(0,80) || ''")
            timing = page.evaluate("() => document.querySelector('#search-results')?.parentElement?.innerText?.match(/([0-9.]+ms|[0-9.]+초|[0-9]+건)/g)?.join(' ') || ''")
            report["search"].append({"query": q, "results": count, "first": first, "ui_timing": timing, "roundtrip_ms": round(elapsed)})

        page.fill("#search-input-page", "연금")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "desktop-search-results.png"), full_page=True)

        # 종류 필터
        page.get_by_role("tab", name="블로그").click()
        page.wait_for_timeout(250)
        report["search"].append({"filter": "블로그", "results": page.eval_on_selector_all("#search-results li", "e => e.length")})
        page.get_by_role("tab", name="앱", exact=True).click()
        page.wait_for_timeout(250)
        report["search"].append({"filter": "앱", "results": page.eval_on_selector_all("#search-results li", "e => e.length")})
        page.get_by_role("tab", name="제도달력").click()
        page.wait_for_timeout(250)
        report["search"].append({"filter": "제도달력", "results": page.eval_on_selector_all("#search-results li", "e => e.length")})
        # 카테고리 필터 (보험 글 안에서 '보험')
        page.fill("#search-input-page", "보험")
        page.wait_for_timeout(250)
        page.get_by_role("tab", name="블로그").click()
        page.wait_for_timeout(200)
        before = page.eval_on_selector_all("#search-results li", "e => e.length")
        page.get_by_role("button", name="보험", exact=True).click()
        page.wait_for_timeout(250)
        after = page.eval_on_selector_all("#search-results li", "e => e.length")
        report["search"].append({"filter": "블로그+보험", "before": before, "results": after})
        page.screenshot(path=str(OUT / "desktop-search-filter.png"))
        report["layout"]["search_noindex"] = "noindex" in (page.get_attribute("meta[name=robots]", "content") or "")
        report["layout"]["search_adslot"] = page.eval_on_selector_all("[data-ad-slot]", "e => e.length")

        # 앱
        goto(page, "apps", "/apps")
        page.screenshot(path=str(OUT / "desktop-apps.png"), full_page=True)

        goto(page, "app-guide", "/apps/bojang-counsel-guide")
        page.screenshot(path=str(OUT / "desktop-app-guide.png"), full_page=True)

        goto(page, "app-detail", "/apps/coverage-check")
        page.screenshot(path=str(OUT / "desktop-app-detail.png"), full_page=True)

        goto(page, "app-run", "/apps/coverage-check/run")
        page.screenshot(path=str(OUT / "desktop-app-run.png"), full_page=True)
        report["layout"]["run_example_label"] = page.locator("text=예시 입력값").count() > 0
        report["layout"]["run_rows"] = page.eval_on_selector_all("table tbody tr", "e => e.length")
        report["layout"]["run_noindex"] = "noindex" in (page.get_attribute("meta[name=robots]", "content") or "")
        report["layout"]["run_adslot"] = page.eval_on_selector_all("[data-ad-slot]", "e => e.length")

        # 제도달력
        goto(page, "calendar", "/calendar#m11")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "desktop-calendar.png"), full_page=True)
        report["layout"]["calendar_m11_items"] = page.eval_on_selector_all("#calendar-panel li", "e => e.length")

        goto(page, "about", "/about")
        page.screenshot(path=str(OUT / "desktop-about.png"), full_page=True)

        # ---------- 헤더 검색 오버레이 ----------
        goto(page, "home-overlay", "/")
        page.click('button[aria-label="사이트 검색 열기"]')
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "desktop-search-overlay.png"))
        page.fill("#search-input-overlay", "고지의무")
        page.wait_for_timeout(400)
        report["layout"]["overlay_results"] = page.eval_on_selector_all("#search-results li", "e => e.length")
        page.screenshot(path=str(OUT / "desktop-search-overlay-results.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        report["layout"]["overlay_closed"] = page.eval_on_selector_all('[role="dialog"]', "e => e.length") == 0
        ctx.close()

        # ---------- 모바일 390 ----------
        for w, h, tag in [(390, 844, "mobile"), (360, 800, "mobile360")]:
            ctxm = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
            m = ctxm.new_page()
            attach(m, tag)
            for name, path in [("home", "/"), ("posts", "/posts"), ("search", "/search?q=실손"), ("apps", "/apps"), ("app-run", "/apps/coverage-check/run")]:
                goto(m, f"{tag}-{name}", path)
                if name == "home":
                    m.screenshot(path=str(OUT / f"{tag}-home-fold.png"))
                else:
                    m.screenshot(path=str(OUT / f"{tag}-{name}.png"), full_page=True)

                overflow = m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                small = m.evaluate(
                    """() => Array.from(document.querySelectorAll('button, [role=tab], input, a.btn, .search-field'))
                        .filter(el => { const r = el.getBoundingClientRect();
                          return r.width > 0 && r.height > 0 && r.height < 44; })
                        .map(el => ({ label: (el.innerText || el.getAttribute('aria-label') || el.id || el.tagName).trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height) }))"""
                )
                key = f"{tag}-{name}"
                report["layout"].setdefault("overflow", {})[key] = overflow
                report["layout"].setdefault("small_targets", {})[key] = small

            # 모바일 메뉴/오버레이
            goto(m, f"{tag}-menu", "/")
            m.click('button[aria-label="메뉴 열기"]')
            m.wait_for_timeout(300)
            m.screenshot(path=str(OUT / f"{tag}-menu-open.png"))
            report["layout"].setdefault("mobile_menu_open", {})[tag] = m.locator("#mobile-menu a").count()
            ctxm.close()

        browser.close()

    # ---------- 깨진 링크 (dist 정적 검사) ----------
    def resolve(href: str):
        href = href.split("#")[0].split("?")[0]
        if not href.startswith("/"):
            return True
        if href == "/":
            return True
        rel = href.strip("/")
        candidates = [
            DIST / rel / "index.html",
            DIST / f"{rel}.html",
            DIST / rel,
        ]
        return any(c.exists() for c in candidates)

    broken = []
    for html_file in DIST.rglob("*.html"):
        text = html_file.read_text(encoding="utf-8", errors="ignore")
        for href in set(re.findall(r'href="(/[^"#]*)"', text)):
            if href.startswith("/_astro"):
                continue
            if not resolve(href):
                broken.append({"from": str(html_file.relative_to(DIST)), "href": href})
    report["broken_links"] = broken

    with open(OUT / "verify-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({
        "pages": len(report["pages"]),
        "non200": [p for p in report["pages"] if p["status"] != 200],
        "console_errors": report["console_errors"][:10],
        "console_error_count": len(report["console_errors"]),
        "broken_links": broken[:10],
        "broken_count": len(broken),
        "search": report["search"],
        "layout": report["layout"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
