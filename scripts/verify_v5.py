"""
buffetkimz v5.0 실측 검증 — dist를 로컬 서버로 열어 실제 브라우저로 확인한다.

사용:
  python3 scripts/verify_v5.py                        # 로컬 빌드(dist)
  LIVE=1 python3 scripts/verify_v5.py                # 라이브(GitHub Pages)
  VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v5.py   # 서브패스 빌드

결과: reports/buffetkimz-web/v5/ 스크린샷 + verify-report.json
확인:
  · 6영역과 배경 리듬, 도입부 2페이지(원칙 4·자료→기록→도구 3단계)
  · 7대 주제·6개 시리즈·처음 읽을 글·자주 찾는 계산, 최근 기록
  · 브랜드 로고(헤더)와 '버' 파비콘 로드, 헤더 록업 선명도
  · 히어로 시뮬레이터 실제 조작(슬라이더 → 숫자 변화)
  · 신뢰 2단 스플릿(딥그린 카드 1장 + 출처·기준일 데이터), 이번 달 일정
  · 7개 채널 + 딥그린 상담문의 배너(3순위), 면책 문구
  · 모바일 390/360 가로 넘침 0, 최소 글자 12px, 터치 44px, 하단 요약 바 가림 0
  · prefers-reduced-motion, 콘솔·HTTP 오류 0, 내부 링크 전수
  · 세법 문구(15.4% 이자·배당 기준), 개인정보(외부 글꼴 CDN)
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

LIVE = os.environ.get("LIVE") == "1"
PORT = 4337
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/v5")
OUT.mkdir(parents=True, exist_ok=True)

if LIVE:
    ORIGIN = os.environ.get("LIVE_ORIGIN", "https://byhan2025.github.io")
    BASE = ORIGIN + "/" + SUBPATH if SUBPATH else ORIGIN
else:
    BASE = f"http://127.0.0.1:{PORT}" + PREFIX

report = {
    "base": BASE,
    "live": LIVE,
    "pages": [],
    "console_errors": [],
    "http_errors": [],
    "failed_requests": [],
    "broken_links": [],
    "home": {},
    "intro": {},
    "archive": {},
    "trust": {},
    "channels": {},
    "mobile": {},
    "sticky": {},
    "contrast": {},
    "touch": {},
    "copy": {},
    "seo": {},
}
checks = {}
failures = []


def check(name, ok, detail=None):
    checks[name] = {"pass": bool(ok), "detail": detail}
    if not ok:
        failures.append({"check": name, "detail": detail})


def attach(page, name):
    page.on(
        "console",
        lambda msg: report["console_errors"].append({"page": name, "type": msg.type, "text": msg.text})
        if msg.type == "error"
        else None,
    )
    page.on(
        "pageerror",
        lambda err: report["console_errors"].append({"page": name, "type": "pageerror", "text": str(err)}),
    )
    page.on(
        "requestfailed",
        lambda req: report["failed_requests"].append({"page": name, "url": req.url, "error": req.failure}),
    )


def goto(page, name, path, wait="networkidle"):
    resp = page.goto(BASE + path, wait_until=wait, timeout=45000)
    page.wait_for_timeout(500)
    report["pages"].append({"name": name, "path": path, "status": resp.status if resp else None})
    if resp and resp.status >= 400:
        report["http_errors"].append({"name": name, "path": path, "status": resp.status})
    return resp


FONT_JS = r"""
() => {
  const bad = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 11.99) bad.push({ t: t.slice(0, 36), fs: +fs.toFixed(2), tag: el.tagName, cls: String(el.className).slice(0, 50) });
  }
  return bad;
}
"""

TOUCH_JS = r"""
() => {
  const out = {controls: [], text: []};
  document.querySelectorAll('a,button,summary,input,select,[role=button]').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (el.closest('.sr-only')) return;
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 28);
    const item = { tag: el.tagName, label, h: +r.height.toFixed(1), cls: String(el.className).slice(0, 60) };
    const isControl = el.matches('button,summary,input,select,[role=button]') || el.classList.contains('btn') || el.classList.contains('tab') || el.closest('nav') || el.closest('header');
    if (isControl) { if (r.height < 43.5) out.controls.push(item); }
    else if (!el.closest('p') && r.height < 23.5) out.text.push(item);
  });
  return out;
}
"""

CONTRAST_JS = r"""
() => {
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const blend = (fg, bg) => { const a = fg[3]; return [fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a), 1]; };
  const bgOf = (el) => {
    let node = el, stack = [];
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0.01) { stack.push(c); if (c[3] >= 0.99) break; }
      node = node.parentElement;
    }
    let bg = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) bg = blend(stack[i], bg);
    return bg;
  };
  const bad = [];
  const seen = new Set();
  document.querySelectorAll('main *, footer *').forEach((el) => {
    if (el.children.length > 0 && [...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) return;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!t) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (el.closest('.sr-only') || el.closest('[aria-hidden=true]')) return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    if (!bg) return;
    const fgc = fg[3] < 1 ? blend(fg, bg) : fg;
    const r = ratio(fgc, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (r < need - 0.02) {
      const key = t.slice(0, 30) + '|' + cs.color + '|' + size;
      if (seen.has(key)) return;
      seen.add(key);
      bad.push({ text: t.slice(0, 40), ratio: +r.toFixed(2), need, size, color: cs.color, cls: String(el.className).slice(0, 50) });
    }
  });
  return bad;
}
"""


def full_shot(page, path):
    """전체 페이지 캡처 — sticky 헤더가 중간에 찍히지 않도록 캡처 동안만 static으로 둔다."""
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = 'static'; }")
    page.wait_for_timeout(150)
    page.screenshot(path=path, full_page=True)
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = ''; }")
    page.wait_for_timeout(100)


def crawl_links(page):
    hrefs = page.evaluate(
        """() => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin))"""
    )
    uniq = sorted(set(hrefs))
    bad = []
    for href in uniq:
        if href.startswith("mailto:") or "#" in href:
            continue
        try:
            req = urllib.request.Request(href, headers={"User-Agent": "buffetkimz-v5-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status >= 400:
                    bad.append({"url": href, "status": r.status})
        except Exception as e:  # noqa: BLE001
            bad.append({"url": href, "error": str(e)[:80]})
    return len(uniq), bad


def main():
    serve_root = DIST
    if not LIVE:
        if SUBPATH:
            serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v5")
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
    else:
        srv = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
            page = ctx.new_page()
            attach(page, "desktop")

            # ---------------- 홈 1280 ----------------
            goto(page, "home", "/")
            page.screenshot(path=str(OUT / "desktop-home-fold.png"))
            full_shot(page, str(OUT / ("live-home-full.png" if LIVE else "desktop-home-full.png")))

            home = page.evaluate(
                r"""
                () => {
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  const secs = [...document.querySelectorAll('main > section')];
                  const logo = document.querySelector('header img.brand-mark');
                  const fav = document.querySelector('link[rel="icon"]');
                  const sim = document.querySelector('[data-hero-sim]');
                  const ranges = sim ? [...sim.querySelectorAll('input[type=range]')] : [];
                  return {
                    height: document.documentElement.scrollHeight,
                    areas: secs.map(s => ({ area: s.getAttribute('data-area'), bg: getComputedStyle(s).backgroundColor, h: Math.round(s.getBoundingClientRect().height) })),
                    h1: txt(document.querySelector('h1')),
                    h1_size: document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontSize : null,
                    logo: logo ? { src: logo.getAttribute('src'), nw: logo.naturalWidth, w: Math.round(logo.getBoundingClientRect().width), h: Math.round(logo.getBoundingClientRect().height), complete: logo.complete } : null,
                    favicon: fav ? fav.getAttribute('href') : null,
                    apple: document.querySelector('link[rel="apple-touch-icon"]') ? document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href') : null,
                    sim: !!sim,
                    ranges: ranges.length,
                    hero_verdict: txt(document.querySelector('[data-hero-verdict]')),
                    hero_rows: document.querySelectorAll('[data-hero-row]').length,
                    btn_tiers: {
                      primary: document.querySelectorAll('main .btn-primary').length,
                      secondary: document.querySelectorAll('main .btn-secondary').length,
                      tertiary: document.querySelectorAll('main .btn-tertiary, main .btn-tertiary-quiet').length,
                    },
                    contact: (() => { const a = document.querySelector('[data-contact-banner] a[href*="pf.kakao.com"]'); return a ? { cls: a.className, text: txt(a), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) } : null; })(),
                    contact_disclaimer: txt(document.querySelector('[data-contact-banner]')).includes('가입 권유·중개가 아닌 일반 안내'),
                    accent_cards: document.querySelectorAll('.accent-card').length,
                    sec_heads: document.querySelectorAll('.sec-head').length,
                    min_btn_h: Math.min(...[...document.querySelectorAll('main .btn')].map(b => b.getBoundingClientRect().height)),
                  };
                }
                """
            )
            report["home"] = home
            check("home.http_ok", all(p["status"] == 200 for p in report["pages"]), report["pages"])
            check("home.areas_6", [a["area"] for a in home["areas"]] == ["1", "2", "3", "4", "5", "6"], home["areas"])
            bgs = [a["bg"] for a in home["areas"]]
            check("home.areas_distinct_bg", len(set(bgs)) >= 5 and all(bgs[i] != bgs[i + 1] for i in range(len(bgs) - 1)), bgs)
            check("home.height_budget", 4600 <= home["height"] <= 6800, home["height"])
            check("home.h1_present", "숫자를 확인하고" in home["h1"], home["h1"])
            check("home.logo_loaded", bool(home["logo"] and home["logo"]["complete"] and home["logo"]["nw"] > 0), home["logo"])
            check("home.logo_header_height", bool(home["logo"] and 29 <= home["logo"]["h"] <= 40), home["logo"])
            check("home.favicon_svg", bool(home["favicon"] and "favicon.svg" in home["favicon"]), home["favicon"])
            check("home.apple_icon", bool(home["apple"] and "apple-touch-icon" in home["apple"]), home["apple"])
            check("home.hero_sim", home["sim"] and home["ranges"] == 2 and home["hero_rows"] == 3, {"sim": home["sim"], "ranges": home["ranges"], "rows": home["hero_rows"]})
            check("home.btn_hierarchy", home["btn_tiers"]["primary"] <= 3 and home["btn_tiers"]["secondary"] >= 3 and home["btn_tiers"]["tertiary"] >= 3, home["btn_tiers"])
            check("home.contact_tertiary", bool(home["contact"] and "btn" in home["contact"]["cls"] and "btn-primary" not in home["contact"]["cls"] and "btn-secondary" not in home["contact"]["cls"]), home["contact"])
            check("home.contact_url", bool(home["contact"] and home["contact"]["href"] == "https://pf.kakao.com/_UxkVxnn/chat"), home["contact"])
            check("home.contact_disclaimer", home["contact_disclaimer"], home["contact_disclaimer"])
            check("home.accent_card_one", home["accent_cards"] == 1, home["accent_cards"])
            check("home.btn_min_44", home["min_btn_h"] >= 43.5, home["min_btn_h"])

            # 히어로 시뮬레이터 실제 조작 — End 키로 은퇴 나이 최대(70세)
            sim = page.locator('[data-hero-sim]')
            before = sim.locator('[data-hero-verdict]').inner_text()
            age = sim.locator('input[aria-label="은퇴 나이"]')
            age.focus()
            age.press("End")
            page.wait_for_timeout(400)
            after = sim.locator('[data-hero-verdict]').inner_text()
            report["home"]["sim_before"] = before
            report["home"]["sim_after"] = after
            check("home.sim_interactive", before != after, {"before": before, "after": after})
            age.press("Home")
            page.wait_for_timeout(300)

            # ---------------- 도입부 2페이지 ----------------
            intro = page.evaluate(
                r"""
                () => {
                  const sec = document.querySelector('[data-area="2"]');
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  return {
                    text: txt(sec),
                    principles: sec ? sec.querySelectorAll('[data-intro-principles] > li').length : 0,
                    steps: sec ? sec.querySelectorAll('[data-intro-flow] .flow-step').length : 0,
                    identity: sec ? sec.querySelectorAll('[data-intro-identity] > li').length : 0,
                    has_three: txt(sec).includes('1차 공식 자료') && txt(sec).includes('채널') && txt(sec).includes('브라우저 계산 도구'),
                    height: sec ? Math.round(sec.getBoundingClientRect().height) : 0,
                  };
                }
                """
            )
            report["intro"] = intro
            check("intro.principles_4", intro["principles"] == 4, intro)
            check("intro.steps_3", intro["steps"] == 3 and intro["has_three"], intro)
            check("intro.identity_3", intro["identity"] == 3, intro)

            # ---------------- 아카이브 ----------------
            archive = page.evaluate(
                r"""
                () => {
                  const sec = document.querySelector('[data-area="3"]');
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  return {
                    topics: [...document.querySelectorAll('[data-topic-grid] > li')].map(li => txt(li.querySelector('span:nth-child(2)')).slice(0, 20)),
                    topic_count: document.querySelectorAll('[data-topic-grid] > li').length,
                    series: document.querySelectorAll('[data-series-grid] > li').length,
                    series_titles: [...document.querySelectorAll('[data-series-grid] h4')].map(txt),
                    first_reads: document.querySelectorAll('[data-first-reads] > li').length,
                    quick_calcs: document.querySelectorAll('[data-quick-calcs] > li').length,
                    recent: document.querySelectorAll('[data-recent-strip] li').length,
                    all_topic_link: !!document.querySelector('[data-topic-grid] a[href$="/posts"]'),
                    text_has_7: txt(sec).includes('7대 주제'),
                    height: Math.round(sec.getBoundingClientRect().height),
                  };
                }
                """
            )
            report["archive"] = archive
            check("archive.topics_7plus_all", archive["topic_count"] == 8, archive)
            check("archive.series_6", archive["series"] == 6, archive["series_titles"])
            check("archive.first_reads_3", archive["first_reads"] == 3, archive["first_reads"])
            check("archive.quick_calcs_3", archive["quick_calcs"] == 3, archive["quick_calcs"])
            check("archive.recent_3", archive["recent"] == 3, archive["recent"])

            # ---------------- 신뢰 ----------------
            trust = page.evaluate(
                r"""
                () => {
                  const sec = document.querySelector('[data-area="5"]');
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  const stats = [...document.querySelectorAll('[data-trust-stats] .trust-stat')].map(s => txt(s));
                  return {
                    sources: document.querySelectorAll('[data-source-list] > li').length,
                    stats,
                    calendar: document.querySelectorAll('[data-calendar-strip] li').length,
                    has_date: txt(sec).includes('2026-11-19'),
                    text: txt(sec).slice(0, 300),
                  };
                }
                """
            )
            report["trust"] = trust
            check("trust.sources_5", trust["sources"] == 5, trust["sources"])
            check("trust.stats_4", len(trust["stats"]) == 4, trust["stats"])
            check("trust.calendar_3", trust["calendar"] == 3, trust["calendar"])
            check("trust.base_date", trust["has_date"], trust["text"])

            # ---------------- 채널 ----------------
            channels = page.evaluate(
                r"""
                () => {
                  const list = [...document.querySelectorAll('[data-channel-list] > li[data-channel]')];
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  return { count: list.length, names: list.map(li => txt(li.querySelector('span span'))), cta_bg: getComputedStyle(document.querySelector('[data-contact-banner]')).backgroundColor };
                }
                """
            )
            report["channels"] = channels
            check("channels.7", channels["count"] == 7, channels)
            check("channels.grid_balanced", page.evaluate("() => document.querySelectorAll('[data-channel-list] > li').length") == 8, None)

            # ---------------- 글자·터치·대비 (1280) ----------------
            small = page.evaluate(FONT_JS)
            report["home"]["small_text"] = small
            check("type.min_12px_desktop", len(small) == 0, small[:8])

            touch = page.evaluate(TOUCH_JS)
            report["touch"]["desktop"] = touch
            check("touch.controls_32_desktop", all(c["h"] >= 31.5 for c in touch["controls"]), touch["controls"][:6])
            check("touch.text_24_desktop", len(touch["text"]) == 0, touch["text"][:6])

            contrast = page.evaluate(CONTRAST_JS)
            report["contrast"]["desktop"] = contrast
            check("contrast.aa_desktop", len(contrast) == 0, contrast[:8])

            # ---------------- 내부 링크 ----------------
            n_links, bad_links = crawl_links(page)
            report["links"] = {"checked": n_links, "failed": bad_links}
            check("links.all_200", len(bad_links) == 0, bad_links[:6])

            # ---------------- 문구 검사 ----------------
            body_text = page.evaluate("() => document.body.innerText")
            banned = ["세금 0원", "수익 보장", "원금 보장", "확정 수익", "100% 보장", "무조건", "최고 수익", "가입하세요", "지금 가입"]
            hits = {w: body_text.count(w) for w in banned if w in body_text}
            report["copy"]["banned_hits"] = hits
            # '무조건'은 편집 원칙에서 '쓰지 않는다'는 예시로만 등장해야 한다.
            check("copy.no_marketing_claims", all(k == "무조건" for k in hits) and hits.get("무조건", 0) <= 1, hits)
            fam = [w for w in ["아내", "딸", "아들", "자녀", "3인가족"] if re.search(r"(?<![가-힣])" + w + r"(?![가-힣])", body_text)]
            check("copy.no_family_detail", not fam, fam)

            # ---------------- 개인정보 ----------------
            goto(page, "privacy", "/privacy")
            priv = page.evaluate("() => document.querySelector('.prose-article').innerText")
            report["privacy"] = {"has_jsdelivr": "jsDelivr" in priv, "has_gfonts": "Google Fonts" in priv, "has_ip": "IP 주소" in priv, "has_local": "브라우저 안에서만" in priv, "toc": page.evaluate("() => document.querySelectorAll('aside nav a').length")}
            check("privacy.font_cdn_disclosure", report["privacy"]["has_jsdelivr"] and report["privacy"]["has_gfonts"] and report["privacy"]["has_ip"], report["privacy"])
            check("privacy.local_processing", report["privacy"]["has_local"], report["privacy"])
            check("privacy.toc_9", report["privacy"]["toc"] == 9, report["privacy"]["toc"])
            full_shot(page, str(OUT / "desktop-privacy.png"))

            # 목차 링크 → 해당 절로 이동
            page.locator('aside nav a', has_text="외부 글꼴").first.click()
            page.wait_for_timeout(500)
            toc = page.evaluate("() => ({hash: location.hash, y: window.scrollY, top: Math.round(document.querySelector('#p3').getBoundingClientRect().top)})")
            report["privacy"]["toc_jump"] = toc
            check("privacy.toc_jump", toc["hash"] == "#p3" and toc["y"] > 100 and 60 <= toc["top"] <= 220, toc)

            # ---------------- 검색 오버레이 ----------------
            goto(page, "home-search", "/")
            page.locator('button[aria-label="사이트 검색 열기"]').first.click()
            page.wait_for_selector('[role="dialog"][aria-label="사이트 검색"]', timeout=5000)
            field = page.locator('[role="dialog"] input').first
            field.fill("연금")
            page.wait_for_timeout(700)
            search = page.evaluate(
                """() => {
                  const d = document.querySelector('[role="dialog"]');
                  return { url: location.href, hasQ: location.search.includes('q='),
                    results: d ? d.querySelectorAll('a[href*="/posts/"], a[href*="/apps/"]').length : 0,
                    text: d ? d.innerText.slice(0, 200) : '' };
                }"""
            )
            report["search"] = search
            check("search.results", search["results"] >= 1, search)
            check("search.no_query_in_url", not search["hasQ"], search)
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            check("search.closes", page.locator('[role="dialog"][aria-label="사이트 검색"]').count() == 0, None)

            # ---------------- 도구·달력 수치 정합 ----------------
            goto(page, "apps", "/apps")
            apps_count = page.evaluate("() => document.querySelectorAll('[data-main-tool], [data-risk-tool]').length")
            goto(page, "calendar", "/calendar")
            cal_count = page.evaluate("() => document.querySelectorAll('[data-calendar-item]').length")
            report["counts"] = {"apps": apps_count, "calendar": cal_count}
            check("counts.tools_7", apps_count >= 7, apps_count)

            # ---------------- 복리 도구: 15.4% 기준 문구 ----------------
            goto(page, "compound", "/apps/compound-return/run")
            tax = page.evaluate(
                """() => { const el = document.querySelector('[data-tax-basis]'); return el ? el.innerText.replace(/\\s+/g,' ').trim() : ''; }"""
            )
            report["compound_tax_note"] = tax
            check("compound.tax_basis_154", "15.4%" in tax and "이자·배당소득세" in tax, tax)
            full_shot(page, str(OUT / ("live-run-compound-return.png" if LIVE else "desktop-run-compound-return.png")))

            # ---------------- 모바일 390 ----------------
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True)
            m = mctx.new_page()
            attach(m, "mobile390")
            goto(m, "home-m390", "/")
            m.screenshot(path=str(OUT / ("mobile390-home-fold.png" if not LIVE else "live-mobile390-home-fold.png")))
            full_shot(m, str(OUT / "mobile390-home-full.png"))
            mhome = m.evaluate(
                r"""
                () => ({
                  hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                  height: document.documentElement.scrollHeight,
                  h1: getComputedStyle(document.querySelector('h1')).fontSize,
                  sim_top: Math.round(document.querySelector('[data-hero-sim]').getBoundingClientRect().top),
                  buttons: [...document.querySelectorAll('.hero-actions .btn')].map(b => Math.round(b.getBoundingClientRect().height)),
                })
                """
            )
            report["mobile"]["m390"] = mhome
            check("mobile390.no_hscroll", mhome["hscroll"] <= 1, mhome)
            small = m.evaluate(FONT_JS)
            report["mobile"]["m390_small"] = small
            check("mobile390.min_12px", len(small) == 0, small[:8])
            touch = m.evaluate(TOUCH_JS)
            report["touch"]["m390"] = touch
            check("mobile390.controls_44", len(touch["controls"]) == 0, touch["controls"][:8])
            contrast = m.evaluate(CONTRAST_JS)
            report["contrast"]["m390"] = contrast
            check("mobile390.contrast_aa", len(contrast) == 0, contrast[:8])

            # 도입부 2페이지·CTA 캡처
            m.locator('[data-area="2"]').screenshot(path=str(OUT / "mobile390-intro2.png"))
            m.locator('#channels').screenshot(path=str(OUT / "mobile390-channels.png"))

            # ---------------- 실행 화면 하단 요약 바 ----------------
            goto(m, "run-retirement-m390", "/apps/retirement-flow/run")
            full_shot(m, str(OUT / "mobile390-run-retirement-flow.png"))
            m.evaluate("() => document.querySelector('.sticky-summary') ? window.scrollTo(0, document.documentElement.scrollHeight) : null")
            m.wait_for_timeout(500)
            m.screenshot(path=str(OUT / "mobile390-run-bottom.png"))
            sticky = m.evaluate(
                r"""
                () => {
                  const bar = document.querySelector('[data-sticky-summary]');
                  const note = document.querySelector('[data-sticky-note]');
                  const footer = document.querySelector('footer');
                  const wrap = document.querySelector('main section:last-of-type .wrap');
                  const lastNote = document.querySelector('.note-box:last-of-type') || document.querySelector('main p:last-of-type');
                  const lastRect = lastNote ? lastNote.getBoundingClientRect() : null;
                  return {
                    bar_h: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
                    bar_top: bar ? Math.round(bar.getBoundingClientRect().top) : null,
                    note: note ? note.textContent.trim() : null,
                    footer_pad: footer ? getComputedStyle(footer).paddingBottom : null,
                    wrap_pad: wrap ? getComputedStyle(wrap).paddingBottom : null,
                    last_bottom: lastRect ? Math.round(lastRect.bottom) : null,
                    viewport: window.innerHeight,
                    scroll_y: window.scrollY,
                  };
                }
                """
            )
            # 마지막 본문 줄이 바 위에 있는지: 바 위쪽 경계보다 본문 끝이 위에 있어야 한다.
            report["sticky"] = sticky
            check("sticky.summary_present", sticky["bar_h"] >= 60, sticky)
            check("sticky.note_line", bool(sticky["note"] and "예시 가정" in sticky["note"] and "기준일" in sticky["note"]), sticky)
            check("sticky.bottom_padding", int(str(sticky["wrap_pad"]).replace("px", "")) >= 100, sticky)

            # 본문 마지막 요소가 바에 가리는지: 그 요소를 화면 하단으로 스크롤한 뒤 비교
            m.locator(".note-box").last.scroll_into_view_if_needed()
            m.wait_for_timeout(400)
            overlap = m.evaluate(
                r"""
                () => {
                  const bar = document.querySelector('[data-sticky-summary]');
                  const notes = [...document.querySelectorAll('.note-box')];
                  const el = notes[notes.length - 1];
                  if (!bar || !el) return null;
                  const b = bar.getBoundingClientRect(), r = el.getBoundingClientRect();
                  return { noteBottom: Math.round(r.bottom), barTop: Math.round(b.top), overlap: Math.round(r.bottom - b.top) };
                }
                """
            )
            report["sticky"]["overlap"] = overlap
            check("sticky.no_overlap", bool(overlap and overlap["overlap"] <= 0), overlap)

            # ---------------- 모바일 360 ----------------
            sctx = browser.new_context(viewport={"width": 360, "height": 780}, locale="ko-KR", is_mobile=True, has_touch=True)
            s = sctx.new_page()
            attach(s, "mobile360")
            goto(s, "home-m360", "/")
            s.screenshot(path=str(OUT / "mobile360-home-fold.png"))
            full_shot(s, str(OUT / "mobile360-home-full.png"))
            shome = s.evaluate(
                """() => ({hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, height: document.documentElement.scrollHeight, hero_actions_w: Math.round(document.querySelector('.hero-actions').getBoundingClientRect().width), btn_rows: [...document.querySelectorAll('.hero-actions .btn')].map(b=>Math.round(b.getBoundingClientRect().top))})"""
            )
            report["mobile"]["m360"] = shome
            check("mobile360.no_hscroll", shome["hscroll"] <= 1, shome)
            small = s.evaluate(FONT_JS)
            check("mobile360.min_12px", len(small) == 0, small[:6])
            goto(s, "run-retirement-m360", "/apps/retirement-flow/run")
            full_shot(s, str(OUT / "mobile360-run-retirement-flow.png"))

            # ---------------- reduced motion ----------------
            rctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR", reduced_motion="reduce")
            r = rctx.new_page()
            attach(r, "reduced")
            goto(r, "home-reduced", "/")
            rm = r.evaluate(
                """() => ({anim: getComputedStyle(document.querySelector('h1')).animationDuration, op: getComputedStyle(document.querySelector('h1')).opacity, sec: getComputedStyle(document.querySelector('[data-hero-verdict]')).opacity, mobility: matchMedia('(prefers-reduced-motion: reduce)').matches})"""
            )
            report["motion"] = rm
            check("motion.reduced_respected", rm["mobility"] and float(rm["anim"].replace("s", "")) < 0.01 and rm["op"] == "1", rm)

            # ---------------- 콘솔·요청 오류 ----------------
            report["console_errors"] = [e for e in report["console_errors"] if "favicon" not in e.get("text", "")]
            check("console.zero", len(report["console_errors"]) == 0, report["console_errors"][:5])
            check("requests.zero_failed", len(report["failed_requests"]) == 0, report["failed_requests"][:5])
            check("http.zero_errors", len(report["http_errors"]) == 0, report["http_errors"])

            # ---------------- 필수 산출 스크린샷 ----------------
            page.screenshot(path=str(OUT / "live-home.png")) if LIVE else None
            page.evaluate("window.scrollTo(0,0)")
            goto(page, "home-final", "/")
            page.screenshot(path=str(OUT / "live-home.png") if LIVE else str(OUT / "desktop-home-fold.png"))
            page.locator('[data-area="2"]').screenshot(path=str(OUT / "live-intro2.png") if LIVE else str(OUT / "desktop-intro2.png"))
            full_shot(page, str(OUT / ("live-home-full.png" if LIVE else "desktop-home-full.png")))

            browser.close()
    finally:
        if srv:
            srv.terminate()

    report["checks"] = checks
    report["failures"] = failures
    report["summary"] = {"total": len(checks), "passed": sum(1 for c in checks.values() if c["pass"]), "failed": len(failures)}
    (OUT / ("live-report.json" if LIVE else "verify-report.json")).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    for f in failures:
        print("FAIL", f["check"], "→", str(f["detail"])[:300])


if __name__ == "__main__":
    main()
