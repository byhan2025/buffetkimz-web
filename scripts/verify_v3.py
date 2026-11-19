"""
buffetkimz v3 실측 검증 — dist를 로컬 서버로 열어 실제 브라우저로 확인한다.

사용: python3 scripts/verify_v3.py
결과: reports/buffetkimz-web/v3/ 스크린샷 + verify-report.json
확인: 콘솔·HTTP 오류 0건, 내부 링크 전수, 한국어 검색, 글→도구 직결, 모바일 가독성,
      색인/비색인 설정, 금지 문구 0건
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright

PORT = 4321
# GitHub Pages 서브패스 빌드를 검증할 때는 VERIFY_BASE=/buffetkimz-web 로 넘긴다.
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
BASE = f"http://127.0.0.1:{PORT}" + PREFIX
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/v3")
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "pages": [],
    "console_errors": [],
    "http_errors": [],
    "broken_links": [],
    "seo": {},
    "search": [],
    "interactions": {},
    "mobile": {},
    "copy_scan": {},
    "contrast": {},
    "touch": {},
    "motion": {},
    "labels": {},
    "notes": [],
}


def attach(page, name):
    page.on(
        "console",
        lambda msg: report["console_errors"].append({"page": name, "type": msg.type, "text": msg.text})
        if msg.type == "error"
        else None,
    )
    page.on("pageerror", lambda err: report["console_errors"].append({"page": name, "type": "pageerror", "text": str(err)}))


def goto(page, name, path, wait="networkidle"):
    resp = page.goto(BASE + path, wait_until=wait, timeout=30000)
    page.wait_for_timeout(350)
    report["pages"].append({"name": name, "path": path, "status": resp.status if resp else None})
    if resp and resp.status >= 400:
        report["http_errors"].append({"name": name, "path": path, "status": resp.status})
    return resp


CONTRAST_JS = """
() => {
  const parse = (c) => {
    const m = c && c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map((v) => parseFloat(v));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const KNOWN = { "card-night": [16, 40, 60], "scene-night": [11, 27, 41], night: [11, 27, 41] };
  const bgOf = (el) => {
    let e = el;
    while (e) {
      const cls = (e.className || "").toString();
      for (const k of Object.keys(KNOWN)) {
        if (cls.split(/\\s+/).includes(k)) return KNOWN[k];
      }
      if (cls.includes("btn-solid")) return [20, 108, 88];
      if (cls.includes("btn-night")) return [11, 27, 41];
      const bg = parse(getComputedStyle(e).backgroundColor);
      if (bg && bg[3] > 0.9) return bg;
      e = e.parentElement;
    }
    return [250, 249, 246];
  };
  const out = [];
  document.querySelectorAll("main p, main span, main a, main li, main div, footer p, footer a").forEach((el) => {
    if (!el.textContent.trim()) return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (fs > 13.5) return;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const fg = parse(cs.color);
    if (!fg || fg[3] < 0.5) return;
    const bg = bgOf(el);
    out.push({
      text: el.textContent.trim().slice(0, 26),
      px: Math.round(fs * 10) / 10,
      fg: cs.color,
      bg: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
    });
  });
  out.sort((a, b) => a.ratio - b.ratio);
  return {
    sampled: out.length,
    min_ratio: out.length ? out[0].ratio : null,
    fails_below_4_5: out.filter((o) => o.ratio < 4.5).length,
    worst: out.slice(0, 10),
  };
}
"""

TOUCH_JS = """
() => {
  const controls = [];
  const inline = [];
  document.querySelectorAll("a, button, input, select, textarea, [role=tab], [role=button]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if ((el.className || "").toString().includes("sr-only")) return;
    const label = (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24);
    const item = { label, w: Math.round(r.width), h: Math.round(r.height) };
    const isControl =
      el.tagName === "BUTTON" ||
      el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      (el.getAttribute("role") || "").match(/tab|button/) ||
      /btn|tab|chip/.test((el.className || "").toString());
    if (isControl) controls.push(item);
    else inline.push(item);
  });
  return {
    controls: controls.length,
    controls_under_44: controls.filter((c) => c.h < 44),
    inline_text_links: inline.length,
    inline_under_44: inline.filter((c) => c.h < 44).length,
    inline_under_24_count: inline.filter((c) => c.h < 24).length,
    inline_under_24: inline.filter((c) => c.h < 24).slice(0, 12),
    inline_sample_under_44: inline.filter((c) => c.h < 44).slice(0, 12),
  };
}
"""

MOTION_JS = """
() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      selector: sel,
      animation: cs.animationName,
      animationDuration: cs.animationDuration,
      transitionDuration: cs.transitionDuration,
    };
  };
  return [pick(".hero-title"), pick(".hero-soft"), pick(".hero-card"), pick(".card-lift"), pick(".gauge > span")].filter(Boolean);
}
"""


def main():
    # 서브패스 빌드는 dist를 <루트>/buffetkimz-web/ 아래에 두고 서빙한다
    serve_root = DIST
    if SUBPATH:
        serve_root = pathlib.Path("/workspace/tool-results/verify-serve")
        link = serve_root / SUBPATH
        serve_root.mkdir(parents=True, exist_ok=True)
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(DIST, target_is_directory=True)

    srv = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(serve_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ---------------- 데스크톱 1280×800 ----------------
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
            page = ctx.new_page()
            attach(page, "desktop")

            goto(page, "home", "/")
            page.screenshot(path=str(OUT / "desktop-home.png"))

            # 카드 하단 '기준일·출처'까지 잘리지 않게 섹션 전체를 요소 캡처한다
            cards_section = page.locator("main section").nth(1)
            cards_section.scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            cards_section.screenshot(path=str(OUT / "desktop-home-mid.png"))
            report["interactions"]["home_cards_capture"] = {
                "width": round(cards_section.bounding_box()["width"]),
                "height": round(cards_section.bounding_box()["height"]),
                "meta_lines": page.locator("[data-card-meta]").count(),
            }
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(250)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / "desktop-home-low.png"))
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / "desktop-home-full.png"), full_page=True)

            home_html = page.content()
            home_text = page.locator("main").inner_text()
            report["interactions"]["home_height_px"] = page.evaluate("document.documentElement.scrollHeight")
            report["interactions"]["h1_font_px"] = page.evaluate(
                "() => getComputedStyle(document.querySelector('main h1')).fontSize"
            )
            report["interactions"]["hero_bg"] = page.evaluate(
                "() => getComputedStyle(document.querySelector('main section')).backgroundImage.slice(0, 90)"
            )
            report["interactions"]["section_heading_px"] = page.evaluate(
                "() => getComputedStyle(document.querySelectorAll('main h2')[0]).fontSize"
            )
            report["interactions"]["body_font"] = page.evaluate(
                "() => getComputedStyle(document.body).fontFamily"
            )
            report["interactions"]["trust_line"] = next(
                (ln for ln in home_text.split("\n") if "기록 12편" in ln or "기록 12" in ln), ""
            )
            report["copy_scan"]["home_forbidden"] = [
                w for w in ["상담", "1ms", "만족도", "후기", "누적", "최고", "100%", "보장 확정", "추천", "best"]
                if w in home_text
            ]
            report["interactions"]["home_questions"] = page.locator("[data-post-cards] p.clamp-2").count()
            report["interactions"]["hero_tool_card"] = page.locator("text=실행 화면").count()

            # --- 대비(WCAG) · DOM 터치 크기 실측 ---
            report["contrast"]["home"] = page.evaluate(CONTRAST_JS)
            report["touch"]["home_desktop"] = page.evaluate(TOUCH_JS)

            # --- 3상태 라벨 통일 확인 ---
            home_text = page.locator("main").inner_text()
            report["labels"]["home"] = {
                "예시 기준 도달": home_text.count("예시 기준 도달"),
                "보완 검토": home_text.count("보완 검토"),
                "추가 확인 필요": home_text.count("추가 확인 필요"),
                "충족(금지)": home_text.count("충족"),
                "단순 비교 고지": "보장 충분성 판정 아님" in home_text,
            }
            report["interactions"]["card_meta_texts"] = page.locator("[data-card-meta]").all_inner_texts()

            # 글 카드 → 도구 실행 직결
            first_tool = page.locator("[data-post-cards] a.btn").first
            href = first_tool.get_attribute("href")
            first_tool.click()
            page.wait_for_timeout(700)
            report["interactions"]["post_card_tool"] = {
                "href": href,
                "url_after_click": page.url.replace(BASE, ""),
                "h1": page.locator("main h1").first.inner_text() if page.locator("main h1").count() else "",
            }
            goto(page, "home2", "/")

            # 헤더 검색 오버레이 + 한국어 검색
            page.click('button[aria-label="사이트 검색 열기"]')
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / "desktop-search-overlay.png"))
            page.fill("#search-input-overlay", "실손")
            page.wait_for_timeout(450)
            report["search"].append(
                {
                    "query": "실손",
                    "results": page.eval_on_selector_all("#search-results li", "e => e.length"),
                    "first": page.evaluate(
                        "() => document.querySelector('#search-results li a')?.innerText?.slice(0,60) || ''"
                    ),
                    "overlay_has_ms": "ms" in page.locator('[role="dialog"]').inner_text(),
                }
            )
            page.screenshot(path=str(OUT / "desktop-search-overlay-results.png"))
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            report["interactions"]["overlay_closed"] = page.locator('[role="dialog"]').count() == 0

            # "/" 단축키
            page.keyboard.press("/")
            page.wait_for_timeout(400)
            report["interactions"]["slash_opens_search"] = page.locator('[role="dialog"]').count() > 0
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)

            # 검색 페이지 (색인 제외)
            goto(page, "search", "/search?q=연금")
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / "desktop-search.png"), full_page=True)
            report["search"].append(
                {
                    "query": "연금",
                    "results": page.eval_on_selector_all("#search-results li", "e => e.length"),
                    "timing_text_present": bool(re.search(r"\dms|1ms", page.locator("main").inner_text())),
                }
            )

            # 기록 / 앱 / 달력 / 소개 / 글 / 실행
            goto(page, "posts", "/posts")
            page.screenshot(path=str(OUT / "desktop-posts.png"), full_page=True)
            report["interactions"]["posts_cards"] = page.locator("[data-post-cards] li").count()

            goto(page, "category", "/posts/insurance")
            page.screenshot(path=str(OUT / "desktop-category.png"), full_page=True)

            goto(page, "post", "/posts/insurance-silson-5th")
            page.screenshot(path=str(OUT / "desktop-post.png"), full_page=True)

            goto(page, "tools", "/apps")
            page.screenshot(path=str(OUT / "desktop-tools.png"), full_page=True)
            report["interactions"]["apps_cards"] = page.locator("main ul > li.card").count()
            apps_text = page.locator("main").inner_text()
            report["labels"]["apps"] = {
                "예시 기준 도달": apps_text.count("예시 기준 도달"),
                "보완 검토": apps_text.count("보완 검토"),
                "추가 확인 필요": apps_text.count("추가 확인 필요"),
                "충족(금지)": apps_text.count("충족"),
                "보험 기준표": apps_text.count("보험 기준표"),
                "보림(오타, 금지)": apps_text.count("보림"),
            }
            report["contrast"]["apps"] = page.evaluate(CONTRAST_JS)
            report["touch"]["apps_desktop"] = page.evaluate(TOUCH_JS)

            goto(page, "app-detail", "/apps/coverage-check")
            page.screenshot(path=str(OUT / "desktop-app-detail.png"), full_page=True)

            goto(page, "tool-run", "/apps/coverage-check/run")
            page.screenshot(path=str(OUT / "desktop-tool-run.png"), full_page=True)
            report["interactions"]["run_example_label"] = page.locator("text=예시 입력값(가상)").count() > 0
            report["interactions"]["run_assumptions"] = page.locator("text=가정").count() > 0
            report["interactions"]["run_rows"] = page.eval_on_selector_all("table tbody tr", "e => e.length")
            run_text = page.locator("main").inner_text()
            report["labels"]["run"] = {
                "예시 기준 도달": run_text.count("예시 기준 도달"),
                "보완 검토": run_text.count("보완 검토"),
                "추가 확인 필요": run_text.count("추가 확인 필요"),
                "충족(금지)": run_text.count("충족"),
                "단순 비교 고지": "보장 충분성 판정 아님" in run_text,
                "table_last_col": page.locator("table thead th").last.inner_text(),
            }
            report["contrast"]["run"] = page.evaluate(CONTRAST_JS)
            report["touch"]["run_desktop"] = page.evaluate(TOUCH_JS)
            # 슬라이더를 움직여 결과가 바뀌는지
            before = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
            page.evaluate(
                """() => { const r = document.querySelector('input[type=range]');
                   const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                   setter.call(r, '0'); r.dispatchEvent(new Event('input', {bubbles:true})); }"""
            )
            page.wait_for_timeout(700)
            after = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
            report["interactions"]["run_reactive"] = {"before": before, "after": after, "changed": before != after}

            # 연령대 세그먼트 전환
            age_buttons = page.locator('[data-tool-input-area] button[aria-pressed]')
            report["interactions"]["run_segments"] = age_buttons.count()
            if age_buttons.count() > 0:
                age_buttons.nth(0).click()
                page.wait_for_timeout(400)
                report["interactions"]["run_segment_switch"] = age_buttons.nth(0).get_attribute("aria-pressed")

            goto(page, "calendar", "/calendar")
            page.screenshot(path=str(OUT / "desktop-calendar.png"), full_page=True)
            # 탭 전환 인터랙션 (11월 → 12월)
            before_items = page.eval_on_selector_all("#calendar-panel li", "e => e.length")
            month_tabs = page.locator('[role="tablist"][aria-label="월 선택"] [role="tab"]')
            report["interactions"]["calendar_tabs"] = month_tabs.count()
            month_tabs.nth(11).click()
            page.wait_for_timeout(500)
            after_items = page.eval_on_selector_all("#calendar-panel li", "e => e.length")
            report["interactions"]["calendar_tab_switch"] = {
                "before": before_items,
                "after": after_items,
                "selected": month_tabs.nth(11).get_attribute("aria-selected"),
                "changed": before_items != after_items,
            }
            page.screenshot(path=str(OUT / "desktop-calendar-m12.png"), full_page=True)

            goto(page, "about", "/about")
            page.screenshot(path=str(OUT / "desktop-about.png"), full_page=True)

            # ---------------- SEO / 색인 ----------------
            goto(page, "seo-home", "/")
            report["seo"]["home_canonical"] = page.get_attribute("link[rel=canonical]", "href")
            report["seo"]["home_robots"] = page.get_attribute("meta[name=robots]", "content")

            goto(page, "seo-posts", "/posts")
            report["seo"]["posts_canonical"] = page.get_attribute("link[rel=canonical]", "href")
            report["seo"]["posts_robots"] = page.get_attribute("meta[name=robots]", "content")

            goto(page, "seo-category", "/posts/insurance")
            report["seo"]["category_canonical"] = page.get_attribute("link[rel=canonical]", "href")
            report["seo"]["category_robots"] = page.get_attribute("meta[name=robots]", "content")

            goto(page, "seo-post", "/posts/insurance-coverage-conditions")
            report["seo"]["post_canonical"] = page.get_attribute("link[rel=canonical]", "href")
            report["seo"]["post_robots"] = page.get_attribute("meta[name=robots]", "content")

            goto(page, "seo-search", "/search?q=보험")
            report["seo"]["search_robots"] = page.get_attribute("meta[name=robots]", "content")
            report["seo"]["search_canonical"] = page.get_attribute("link[rel=canonical]", "href")

            goto(page, "seo-run", "/apps/pension-tax/run")
            report["seo"]["run_robots"] = page.get_attribute("meta[name=robots]", "content")

            robots = (DIST / "robots.txt").read_text(encoding="utf-8")
            report["seo"]["robots_txt"] = robots
            report["seo"]["robots_blocks_noindex_paths"] = [
                line.strip() for line in robots.splitlines()
                if line.strip().lower().startswith("disallow")
                and ("/search" in line or "/run" in line)
            ]
            sitemap = "".join(f.read_text(encoding="utf-8") for f in DIST.glob("sitemap*.xml"))
            locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
            report["seo"]["sitemap_urls"] = len(locs)
            report["seo"]["sitemap_has_run_or_search"] = [u for u in locs if "/run" in u or "/search" in u]
            # robots.txt가 noindex 경로(/search, /apps/*/run)를 동시에 막고 있지 않은지
            report["seo"]["robots_conflicts_noindex"] = [
                line.strip() for line in robots.splitlines()
                if line.strip().lower().startswith("disallow")
                and ("/search" in line or "/run" in line)
            ]
            report["seo"]["sitemap_excludes_run_search"] = not [u for u in locs if "/run" in u or "/search" in u]
            report["seo"]["sitemap_uses_prefix"] = (
                all(u.startswith(f"https://byhan2025.github.io{PREFIX}") for u in locs) if PREFIX else True
            )
            report["seo"]["canonical_has_prefix"] = (
                report["seo"].get("home_canonical", "").startswith(f"https://byhan2025.github.io{PREFIX}") if PREFIX else True
            )
            report["seo"]["sitemap_has_posts_and_hubs"] = {
                "posts": any(u.rstrip("/").endswith("/posts") for u in locs),
                "category": any("/posts/insurance" in u for u in locs),
                "article": any("/posts/insurance-silson-5th" in u for u in locs),
            }

            # ---------------- 내부 링크 전수 (HTTP) ----------------
            dist_urls = []
            for f in DIST.rglob("*.html"):
                rel = f.relative_to(DIST).as_posix()
                if rel.endswith("index.html"):
                    path = "/" + rel[: -len("index.html")]
                else:
                    path = "/" + rel
                dist_urls.append(path)
            http_fail = []
            for path in sorted(dist_urls):
                try:
                    with urllib.request.urlopen(BASE + path, timeout=10) as r:
                        if r.status >= 400:
                            http_fail.append({"path": path, "status": r.status})
                except Exception as e:  # noqa: BLE001
                    http_fail.append({"path": path, "error": str(e)})
            report["http_errors"].extend(http_fail)
            report["pages_checked_http"] = len(dist_urls)
            ctx.close()

            # ---------------- 모바일 390 / 360 ----------------
            for w, h, tag in [(390, 844, "mobile390"), (360, 800, "mobile360")]:
                mctx = browser.new_context(
                    viewport={"width": w, "height": h},
                    device_scale_factor=2,
                    is_mobile=True,
                    has_touch=True,
                    locale="ko-KR",
                )
                m = mctx.new_page()
                attach(m, tag)
                goto(m, f"{tag}-home", "/")
                m.wait_for_timeout(400)
                m.screenshot(path=str(OUT / f"{tag}-home-fold.png"))
                m.screenshot(path=str(OUT / f"{tag}-home-full.png"), full_page=True)

                overflow = m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                small_text = m.evaluate(
                    """() => {
                      const out = [];
                      document.querySelectorAll('main p, main span, main a, main h2, main h3, main li').forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 || r.height === 0) return;
                        const fs = parseFloat(getComputedStyle(el).fontSize);
                        const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
                        if (own && fs < 12) out.push({t: el.textContent.trim().slice(0, 30), fs});
                      });
                      return out.slice(0, 20);
                    }"""
                )
                small_targets = m.evaluate(
                    """() => Array.from(document.querySelectorAll('button, [role=tab], input, .btn, header a, nav a'))
                        .filter(el => { const r = el.getBoundingClientRect();
                          return r.width > 0 && r.height > 0 && r.height < 44; })
                        .map(el => ({ label: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24),
                                      h: Math.round(el.getBoundingClientRect().height) }))
                        .slice(0, 20)"""
                )
                # 콘텐츠 폭이 화면을 넘는 요소
                wide = m.evaluate(
                    """() => Array.from(document.querySelectorAll('main *')).filter(el => {
                         const r = el.getBoundingClientRect();
                         return r.width > window.innerWidth + 1;
                       }).map(el => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50),
                                       w: Math.round(el.getBoundingClientRect().width) })).slice(0, 10)"""
                )
                report["contrast"][tag] = m.evaluate(CONTRAST_JS)
                report["touch"][tag] = m.evaluate(TOUCH_JS)
                report["mobile"][tag] = {
                    "overflow_px": overflow,
                    "small_text": small_text,
                    "small_targets": small_targets,
                    "too_wide": wide,
                }

                goto(m, f"{tag}-posts", "/posts")
                m.screenshot(path=str(OUT / f"{tag}-posts.png"), full_page=True)
                goto(m, f"{tag}-tools", "/apps")
                m.screenshot(path=str(OUT / f"{tag}-tools.png"), full_page=True)
                goto(m, f"{tag}-run", "/apps/coverage-check/run")
                m.screenshot(path=str(OUT / f"{tag}-run.png"), full_page=True)

                goto(m, f"{tag}-menu", "/")
                m.click('button[aria-label="메뉴 열기"]')
                m.wait_for_timeout(300)
                report["mobile"][tag]["menu_links"] = m.locator("#mobile-menu a").count()
                mctx.close()

            # ---------------- 모션 줄이기 (prefers-reduced-motion) ----------------
            rmctx = browser.new_context(
                viewport={"width": 1280, "height": 800}, locale="ko-KR", reduced_motion="reduce"
            )
            rm = rmctx.new_page()
            attach(rm, "reduced-motion")
            goto(rm, "rm-home", "/")
            rm.wait_for_timeout(500)
            report["motion"]["reduced_home"] = rm.evaluate(MOTION_JS)
            report["motion"]["reduced_matches"] = rm.evaluate(
                "() => window.matchMedia('(prefers-reduced-motion: reduce)').matches"
            )
            report["motion"]["reduced_hero_opacity"] = rm.evaluate(
                "() => { const el = document.querySelector('.hero-title'); return el ? getComputedStyle(el).opacity : null; }"
            )
            report["motion"]["reduced_card_hover_transition"] = rm.evaluate(
                "() => { const el = document.querySelector('.card-lift'); return el ? getComputedStyle(el).transitionDuration : null; }"
            )
            rm.screenshot(path=str(OUT / "desktop-home-reduced-motion.png"))
            goto(rm, "rm-run", "/apps/coverage-check/run")
            rm.wait_for_timeout(400)
            report["motion"]["reduced_run"] = rm.evaluate(MOTION_JS)
            report["motion"]["reduced_run_transitions"] = rm.evaluate(
                "() => Array.from(document.querySelectorAll('table td, .btn, button, [class*=bar]')).slice(0, 6).map(el => getComputedStyle(el).transitionDuration)"
            )
            report["motion"]["reduced_run_bar_width"] = rm.evaluate(
                "() => { const b = document.querySelector('.btn'); return b ? getComputedStyle(b).transitionDuration : null; }"
            )
            rmctx.close()

            browser.close()
    finally:
        srv.terminate()

    # ---------------- 정적 링크 해석 ----------------
    def resolve(href: str):
        href = href.split("#")[0].split("?")[0]
        if not href.startswith("/"):
            return True
        if PREFIX:
            if href == PREFIX:
                href = "/"
            elif href.startswith(PREFIX + "/"):
                href = href[len(PREFIX):]
            else:
                return False
        if href == "/":
            return True
        rel = href.strip("/")
        return any(
            c.exists() for c in [DIST / rel / "index.html", DIST / f"{rel}.html", DIST / rel]
        )

    broken = []
    for html_file in DIST.rglob("*.html"):
        text = html_file.read_text(encoding="utf-8", errors="ignore")
        for href in set(re.findall(r'href="(/[^"#]*)"', text)):
            if href.startswith("/_astro"):
                continue
            if not resolve(href):
                broken.append({"from": html_file.relative_to(DIST).as_posix(), "href": href})
    report["broken_links"] = broken

    with open(OUT / "verify-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(
        json.dumps(
            {
                "pages": len(report["pages"]),
                "http_errors": report["http_errors"][:8],
                "http_error_count": len(report["http_errors"]),
                "console_errors": report["console_errors"][:8],
                "console_error_count": len(report["console_errors"]),
                "broken_count": len(broken),
                "broken": broken[:8],
                "search": report["search"],
                "interactions": report["interactions"],
                "seo": {k: v for k, v in report["seo"].items() if k != "robots_txt"},
                "labels": report["labels"],
                "contrast": report["contrast"],
                "touch": report["touch"],
                "motion": report["motion"],
                "mobile": report["mobile"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
