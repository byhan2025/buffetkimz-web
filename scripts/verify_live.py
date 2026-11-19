"""
GitHub Pages 라이브 실측 — https://byhan2025.github.io/buffetkimz-web/ (v4.1)

사용: python3 scripts/verify_live.py
결과: reports/buffetkimz-web/v4.1/ 아래
      live-home.png · live-home-full.png · live-apps.png · live-run-retirement-flow.png
      mobile360-home-fold.png · mobile390-home-fold.png · mobile390-run-retirement-flow-adjusted.png · live-report.json
확인: HTTP 200, CSS/JS 로드, 서브패스 링크 정합, 내부 링크 전수 200, 검색·도구 동작, 콘솔 오류 0,
      v4.1 5영역·버튼 3단계·1:1 상담문의 표기, 모바일 /run 하단 요약 바와 눈금 12px
"""
import json
import os
import pathlib
import re
import urllib.request

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright

ORIGIN = "https://byhan2025.github.io"
PREFIX = "/buffetkimz-web"
BASE = ORIGIN + PREFIX
OUT = pathlib.Path(os.environ.get("LIVE_OUT") or "/workspace/reports/buffetkimz-web/v4.1")
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "base": BASE,
    "status": None,
    "console_errors": [],
    "failed_requests": [],
    "resources": {"css": [], "js": []},
    "links": {"unprefixed": [], "checked": 0, "failed": []},
    "search": {},
    "tool": {},
    "rendered": {},
    "screenshots": [],
}


def http_status(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "buffetkimz-live-check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:  # noqa: BLE001
        return f"ERR {e}"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
        page = ctx.new_page()
        page.on(
            "console",
            lambda m: report["console_errors"].append({"type": m.type, "text": m.text})
            if m.type == "error"
            else None,
        )
        page.on("pageerror", lambda e: report["console_errors"].append({"type": "pageerror", "text": str(e)}))
        page.on(
            "response",
            lambda r: report["failed_requests"].append({"status": r.status, "url": r.url})
            if r.status >= 400
            else None,
        )
        page.on("requestfinished", lambda r: r.url.endswith(".css") and report["resources"]["css"].append(r.url))
        page.on("requestfinished", lambda r: r.url.endswith(".js") and report["resources"]["js"].append(r.url))

        resp = page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        report["status"] = resp.status if resp else None
        page.wait_for_timeout(1200)

        # 렌더 확인: 글꼴·배경·제목
        report["rendered"] = page.evaluate(
            """() => ({
              title: document.title,
              h1: document.querySelector('main h1')?.innerText?.replace(/\\s+/g, ' ').trim(),
              body_bg: getComputedStyle(document.body).backgroundColor,
              font: getComputedStyle(document.body).fontFamily.slice(0, 40),
              css_sheets: document.styleSheets.length,
              card_meta: Array.from(document.querySelectorAll('[data-card-meta]')).map((e) => e.innerText.trim()),
            })"""
        )
        page.screenshot(path=str(OUT / "live-home.png"))
        report["screenshots"].append(str(OUT / "live-home.png"))
        page.screenshot(path=str(OUT / "live-home-full.png"), full_page=True)
        report["screenshots"].append(str(OUT / "live-home-full.png"))

        # v4.1 — 5영역·프레임드 히어로·버튼 3단계·1:1 상담문의 표기
        report["home_v41"] = page.evaluate(
            """() => {
              const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
              const areas = [...document.querySelectorAll('main > section')].map((sec) => ({
                area: sec.getAttribute('data-area'),
                bg: getComputedStyle(sec).backgroundColor,
              }));
              const contact = document.querySelector('main a[href*="pf.kakao.com"]');
              return {
                areas,
                framed_hero: !!document.querySelector('.hero-shell'),
                sim: !!document.querySelector('.hero-shell .sim'),
                sec_heads: document.querySelectorAll('.sec-head').length,
                accent_cards: document.querySelectorAll('.accent-card').length,
                mini: [...document.querySelectorAll('[data-main-tools] .mini')].map((m) => txt(m).slice(0, 12)),
                tiers: {
                  primary: document.querySelectorAll('.btn-primary').length,
                  secondary: document.querySelectorAll('.btn-secondary').length,
                  tertiary: document.querySelectorAll('.btn-tertiary, .btn-tertiary-quiet').length,
                },
                contact_text: contact ? txt(contact) : null,
                contact_href: contact ? contact.getAttribute('href') : null,
                contact_disclaimer:
                  txt(document.querySelector('main')).includes('가입 권유·중개가 아닌 일반 안내·문의 채널') &&
                  txt(document.querySelector('footer')).includes('가입 권유·중개가 아닌 일반 안내·문의 채널'),
                height: document.documentElement.scrollHeight,
              };
            }"""
        )
        v41 = report["home_v41"]
        checks_v41 = {
            "areas_5": [a["area"] for a in v41["areas"]] == ["1", "2", "3", "4", "5"],
            "areas_distinct_bg": len({a["bg"] for a in v41["areas"]}) == 5,
            "framed_hero": v41["framed_hero"] and v41["sim"],
            "sec_heads": v41["sec_heads"] >= 3,
            "single_accent": v41["accent_cards"] == 1,
            "mini_previews": len(v41["mini"]) == 4 and all("화면 예시" in m for m in v41["mini"]),
            "btn_tiers": all(v41["tiers"][k] > 0 for k in ("primary", "secondary", "tertiary")),
            "contact_1to1": "1:1 상담문의" in (v41["contact_text"] or ""),
            "contact_href": "pf.kakao.com/_UxkVxnn/chat" in (v41["contact_href"] or ""),
            "contact_disclaimer": v41["contact_disclaimer"],
            "height_budget": 3400 <= v41["height"] <= 4000,
        }
        report["checks_v41"] = checks_v41

        # /apps 라이브 화면
        page.goto(f"{BASE}/apps/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "live-apps.png"), full_page=True)
        report["screenshots"].append(str(OUT / "live-apps.png"))
        page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(800)

        # v3.2 — 압축 레이아웃·4대 축 인덱스·카카오톡 채널 링크 확인
        report["home"] = page.evaluate(
            """() => {
              const kakao = document.querySelector('a[href*="pf.kakao.com"]');
              const axes = [...document.querySelectorAll('main a.card')].slice(0, 4).map((a) => a.innerText.replace(/\\n/g, ' | ').trim());
              const toolCount = document.querySelector('[data-tool-count]');
              const legendBox = document.querySelector('[data-coverage-legend]');
              const legend = legendBox ? [...legendBox.querySelectorAll('[data-legend-state]')].map((e) => e.getAttribute('data-legend-state')) : [];
              const rowStates = [...new Set([...document.querySelectorAll('main [data-row-state]')].map((e) => e.getAttribute('data-row-state')))];
              const cv = document.getElementById('channels');
              const ft = document.querySelector('footer');
              const parse = (c) => { const m = c && c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
                const p = m[1].split(',').map((v) => parseFloat(v)); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
              const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
              const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
              const ratio = (a, b) => { const la = lum(a), lb = lum(b);
                return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
              const small = [];
              for (const [zone, root, fallback] of [['band', cv, [11, 27, 41]], ['footer', ft, [250, 247, 239]]]) {
                if (!root) continue;
                root.querySelectorAll('p, span, a, li, div, strong, time').forEach((el) => {
                  const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
                  if (!own) return;
                  const r = el.getBoundingClientRect();
                  if (r.width === 0 || r.height === 0) return;
                  const cs = getComputedStyle(el);
                  const fg = parse(cs.color);
                  if (!fg || fg[3] < 0.5) return;
                  let bg = null, e = el;
                  while (e) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b[3] > 0.9) { bg = b; break; } e = e.parentElement; }
                  if (!bg) bg = fallback;
                  small.push({ zone, text: el.textContent.trim().slice(0, 20), px: Math.round(parseFloat(cs.fontSize) * 10) / 10,
                               ratio: Math.round(ratio(fg, bg) * 100) / 100 });
                });
              }
              small.sort((a, b) => a.ratio - b.ratio);
              return {
                height_px: document.documentElement.scrollHeight,
                axes,
                kakao_href: kakao ? kakao.getAttribute('href') : null,
                kakao_text: kakao ? kakao.innerText.replace(/\\n/g, ' ').trim() : null,
                kakao_escaped: kakao ? kakao.getAttribute('href').includes('%5F') : null,
                record_cards: document.querySelectorAll('[data-post-cards] li').length,
                tool_tiles: document.querySelectorAll('main section:nth-of-type(3) li.card').length,
                tool_count: toolCount ? toolCount.getAttribute('data-tool-count') : null,
                tool_count_text: toolCount ? toolCount.innerText.replace(/\\s+/g, ' ').trim() : null,
                legend,
                row_states: rowStates,
                legend_match: legend.length === rowStates.length && legend.every((v) => rowStates.includes(v)),
                band_footer_sampled: small.length,
                band_footer_min_ratio: small.length ? small[0].ratio : null,
                band_footer_min_px: small.length ? Math.min(...small.map((o) => o.px)) : null,
                band_footer_under_12: small.filter((o) => o.px < 12).length,
                band_footer_fails: small.filter((o) => o.ratio < 4.5).length,
                band_footer_worst: small.slice(0, 4),
              };
            }"""
        )

        cards = page.locator("main section").nth(1)
        cards.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        cards.screenshot(path=str(OUT / "live-home-mid.png"))
        report["screenshots"].append(str(OUT / "live-home-mid.png"))
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)

        # v4.0 — 홈 비중 역전(은퇴 현금흐름 히어로 · 금융 스트립 · 메인 4 · 리스크 한 줄)
        report["home_v4"] = page.evaluate(
            """() => {
              const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
              const hero = document.querySelector('main section');
              const cards = [...document.querySelectorAll('[data-post-cards] li')].map((li) => txt(li.querySelector('span')));
              const strip = document.querySelector('[data-finance-strip]');
              return {
                hero_rows: document.querySelectorAll('[data-hero-row]').length,
                hero_has_coverage: txt(hero).includes('보장 점검'),
                strip_tiles: strip ? strip.querySelectorAll('li').length : 0,
                main_tools: [...document.querySelectorAll('[data-main-tools] li h3')].map(txt),
                risk_tools: [...document.querySelectorAll('[data-risk-tools] li a')].map(txt),
                card_categories: cards,
                tool_count: txt(document.querySelector('[data-tool-count]')),
                trust: txt(document.querySelector('[data-trust-line]')),
                hero_verdict: txt(document.querySelector('[data-hero-verdict]')),
                strip_text: txt(strip),
              };
            }"""
        )

        # 서브패스 정합: 모든 내부 링크가 /buffetkimz-web 으로 시작하는지
        hrefs = page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))")
        internal = [h for h in hrefs if h and h.startswith("/")]
        report["links"]["unprefixed"] = [h for h in internal if not h.startswith(PREFIX)]

        # 검색(헤더 오버레이) 동작
        page.click('button[aria-label="사이트 검색 열기"]')
        page.wait_for_timeout(600)
        page.fill("#search-input-overlay", "실손")
        page.wait_for_timeout(700)
        report["search"] = {
            "results": page.eval_on_selector_all("#search-results li", "e => e.length"),
            "first": page.evaluate(
                "() => document.querySelector('#search-results li a')?.innerText?.slice(0, 60) || ''"
            ),
        }
        page.screenshot(path=str(OUT / "live-search.png"))
        report["screenshots"].append(str(OUT / "live-search.png"))
        report["search"]["storage"] = page.evaluate(
            "() => ({ session: Object.keys(sessionStorage), local: Object.keys(localStorage), query: location.search })"
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # v4.0 신규 도구 2종 — 라이브 실행 화면
        report["new_tools"] = {}
        for slug, verdict_sel in [
            ("retirement-flow", "[data-retirement-verdict]"),
            ("compound-return", "[data-compound-verdict]"),
        ]:
            page.goto(f"{BASE}/apps/{slug}/run/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(900)
            before = page.locator(verdict_sel).inner_text()
            page.screenshot(path=str(OUT / f"live-run-{slug}.png"), full_page=True)
            report["screenshots"].append(str(OUT / f"live-run-{slug}.png"))
            snapshot = page.evaluate(
                """() => {
                  const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
                  return {
                    stats: [...document.querySelectorAll('main p')]
                      .filter((el) => ['은퇴 시 월 수령액', '오늘 가치(추정)', '목표 월 생활비와의 차이', '총 납입 원금', '세전 평가액 (보수 차감 후)']
                        .some((k) => el.textContent.includes(k)))
                      .map((el) => ({ label: el.textContent.trim(), value: el.nextElementSibling ? el.nextElementSibling.textContent.trim() : '' })),
                    checks: txt(document.querySelector('[data-compound-checks], [data-retirement-checks]')),
                    tax: txt(document.querySelector('[data-retirement-tax]')),
                  };
                }"""
            )
            page.evaluate(
                """() => { const r = document.querySelectorAll('input[type=range]');
                   const target = r[r.length - 1];
                   const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                   setter.call(target, String(Number(target.value) + 1));
                   target.dispatchEvent(new Event('input', {bubbles:true})); }"""
            )
            page.wait_for_timeout(500)
            after = page.locator(verdict_sel).inner_text()
            report["new_tools"][slug] = {
                "status": page.evaluate("() => performance.getEntriesByType('navigation')[0]?.responseStatus || 200"),
                "verdict": before[:110],
                "verdict_full": before,
                "stats": snapshot["stats"],
                "checks_text": snapshot["checks"],
                "tax_text": snapshot["tax"],
                "reactive": before != after,
                "checks": page.locator("[data-retirement-checks] li, [data-compound-checks] li").count(),
                "assumptions": page.locator("[data-retirement-assumptions], [data-compound-assumptions]").count(),
                "source_line": "기준일 2026-11-19" in page.locator("main").inner_text(),
            }
            # 기본값 상태 화면을 남긴다(슬라이더 조작 전)

        # 라이브 수치 일치: 홈 히어로·스트립 ↔ 실행 화면
        def man_tokens(text):
            out = []
            for m in re.finditer(r"(?:(\d+)억\s*)?([\d,]+)\s*만원", text or ""):
                out.append(int(m.group(1) or 0) * 10000 + int(m.group(2).replace(",", "")))
            return out

        def stat_amount(stats, needle):
            for item in stats or []:
                if needle in item["label"]:
                    return (man_tokens(item["value"]) or [None])[0]
            return None

        home_amounts = man_tokens((report.get("home_v4") or {}).get("hero_verdict", ""))
        strip_amounts = man_tokens((report.get("home_v4") or {}).get("strip_text", ""))
        ret = report["new_tools"].get("retirement-flow") or {}
        cmp_ = report["new_tools"].get("compound-return") or {}
        live_consistency = {
            "home_hero": home_amounts,
            "ret_nominal": stat_amount(ret.get("stats"), "은퇴 시 월 수령액"),
            "ret_real": stat_amount(ret.get("stats"), "오늘 가치"),
            "ret_gap": stat_amount(ret.get("stats"), "목표 월 생활비와의 차이"),
            "cmp_principal": stat_amount(cmp_.get("stats"), "총 납입 원금"),
            "cmp_gross": stat_amount(cmp_.get("stats"), "세전 평가액"),
            "verdict_amounts": man_tokens(ret.get("verdict_full", "")),
            "cmp_verdict_amounts": man_tokens(cmp_.get("verdict_full", "")),
            "strip_has_nominal": bool(home_amounts) and home_amounts[0] in strip_amounts,
            "strip_has_real": len(home_amounts) > 1 and home_amounts[1] in strip_amounts,
            "ret_matches_home": bool(home_amounts)
            and stat_amount(ret.get("stats"), "은퇴 시 월 수령액") == home_amounts[0]
            and stat_amount(ret.get("stats"), "오늘 가치") == home_amounts[1],
            "cmp_fee_030": "0.30%" in (cmp_.get("verdict_full", "") + cmp_.get("checks_text", "")),
            "cmp_down_330": "-3.30%" in (cmp_.get("checks_text") or ""),
            "cmp_no_old_numbers": "1.30%" not in (cmp_.get("verdict_full", "") + cmp_.get("checks_text", ""))
            and "-4.30%" not in (cmp_.get("verdict_full", "") + cmp_.get("checks_text", "")),
            "ret_tax_wording": "15% 분리과세" in (ret.get("tax_text") or "")
            and "16.5%" in (ret.get("tax_text") or "")
            and "16.5% 수준의 종합과세" not in (ret.get("tax_text") or ""),
        }
        live_consistency["ok"] = (
            live_consistency["ret_matches_home"]
            and live_consistency["strip_has_nominal"]
            and live_consistency["strip_has_real"]
            and live_consistency["cmp_fee_030"]
            and live_consistency["cmp_down_330"]
            and live_consistency["cmp_no_old_numbers"]
            and live_consistency["ret_tax_wording"]
        )
        report["consistency"] = live_consistency

        # 모바일 360 — 복리 실행 화면 표(오른쪽 끝 숫자 잘림 확인용 산출물)
        mtctx = browser.new_context(
            viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR"
        )
        mt = mtctx.new_page()
        mt.goto(f"{BASE}/apps/compound-return/run/", wait_until="networkidle", timeout=60000)
        mt.wait_for_timeout(1200)
        mt.screenshot(path=str(OUT / "mobile360-run-compound-return.png"), full_page=True)
        report["screenshots"].append(str(OUT / "mobile360-run-compound-return.png"))
        report["mobile360_compound"] = {
            "overflow_px": mt.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"),
            "tables": mt.evaluate(
                """() => [...document.querySelectorAll('table')].map((t) => ({
                     inner: t.scrollWidth - t.clientWidth,
                     wrap: t.parentElement.scrollWidth - t.parentElement.clientWidth,
                     clipped: [...t.querySelectorAll('td,th')].filter((c) => c.scrollWidth - c.clientWidth > 1).length,
                   }))"""
            ),
        }
        mtctx.close()

        # 도구 실행 화면 동작(슬라이더 → 결과 변화)
        page.goto(BASE + "/apps/coverage-check/run/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        before = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
        page.evaluate(
            """() => { const r = document.querySelector('input[type=range]');
               const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
               setter.call(r, '0'); r.dispatchEvent(new Event('input', {bubbles:true})); }"""
        )
        page.wait_for_timeout(600)
        after = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
        report["tool"] = {
            "url": page.url,
            "rows": page.eval_on_selector_all("table tbody tr", "e => e.length"),
            "before": before,
            "after": after,
            "changed": before != after,
            "labels": page.locator("main").inner_text().count("추가 확인 필요"),
        }
        page.screenshot(path=str(OUT / "live-run.png"), full_page=False)
        report["screenshots"].append(str(OUT / "live-run.png"))

        # 내부 링크 전수 (홈 + 주요 허브에서 모은 경로)
        paths = {"/", "/posts/", "/posts/insurance/", "/apps/", "/calendar/", "/about/", "/search/",
                 "/posts/insurance-silson-5th/", "/apps/coverage-check/", "/privacy/", "/terms/"}
        for href in internal:
            path = href.split("#")[0].split("?")[0]
            if path.startswith(PREFIX):
                paths.add(path[len(PREFIX):] or "/")
        report["links"]["checked"] = len(paths)
        for path in sorted(paths):
            code = http_status(ORIGIN + PREFIX + path)
            if code != 200:
                report["links"]["failed"].append({"path": path, "status": code})

        # 카카오톡 채널 링크가 실제로 열리는지 (HTTP)
        kakao_href = (report.get("home") or {}).get("kakao_href") or "https://pf.kakao.com/_UxkVxnn/chat"
        report["kakao_link"] = {"url": kakao_href, "status": http_status(kakao_href)}

        # 모바일 390 · 360 첫 화면
        m390ctx = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR"
        )
        m390 = m390ctx.new_page()
        m390.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        m390.wait_for_timeout(800)
        m390.screenshot(path=str(OUT / "mobile390-home-fold.png"))
        report["screenshots"].append(str(OUT / "mobile390-home-fold.png"))
        report["mobile390"] = {
            "overflow_px": m390.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"),
            "h1": m390.evaluate("() => document.querySelector('main h1')?.innerText?.replace(/\\s+/g,' ').trim()"),
        }

        # v4.1 — 390px 실행 화면: 슬라이더를 움직이는 동안 하단 요약 바가 숫자를 비추는지
        m390.goto(f"{BASE}/apps/retirement-flow/run/", wait_until="networkidle", timeout=60000)
        m390.wait_for_timeout(900)
        bar_before = m390.evaluate("() => document.querySelector('[data-sticky-summary]')?.innerText || ''")
        m390.evaluate(
            """() => { const r = document.querySelectorAll('input[type=range]')[3];
               const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
               setter.call(r, '150'); r.dispatchEvent(new Event('input', {bubbles: true})); }"""
        )
        m390.wait_for_timeout(600)
        bar_after = m390.evaluate("() => document.querySelector('[data-sticky-summary]')?.innerText || ''")
        scales = m390.evaluate(
            """() => [...document.querySelectorAll('input[type=range]')].map((r) => {
                 const box = r.nextElementSibling;
                 const spans = box ? [...box.querySelectorAll('span')] : [];
                 return spans.length ? Math.min(...spans.map((el) => parseFloat(getComputedStyle(el).fontSize))) : null;
               }).filter((v) => v !== null)"""
        )
        m390.screenshot(path=str(OUT / "mobile390-run-retirement-flow-adjusted.png"))
        report["screenshots"].append(str(OUT / "mobile390-run-retirement-flow-adjusted.png"))
        report["run_sticky"] = {
            "visible": m390.evaluate("() => { const b = document.querySelector('[data-sticky-summary]'); const r = b && b.getBoundingClientRect(); return !!r && r.height > 0 && r.bottom <= window.innerHeight + 1; }"),
            "before": bar_before.replace(/\\s+/g, " ").strip(),
            "after": bar_after.replace(/\\s+/g, " ").strip(),
            "changed": bar_before != bar_after,
            "scale_min_px": min(scales) if scales else None,
        }
        m390ctx.close()

        # 모바일 360 첫 화면
        mctx = browser.new_context(
            viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR"
        )
        m = mctx.new_page()
        m.goto(BASE + "/", wait_until="networkidle", timeout=60000)
        m.wait_for_timeout(800)
        m.screenshot(path=str(OUT / "mobile360-home-fold.png"))
        report["screenshots"].append(str(OUT / "mobile360-home-fold.png"))
        m.screenshot(path=str(OUT / "live-mobile360.png"))
        report["screenshots"].append(str(OUT / "live-mobile360.png"))
        report["mobile360"] = {
            "overflow_px": m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"),
            "h1": m.evaluate("() => document.querySelector('main h1')?.innerText?.replace(/\\s+/g,' ').trim()"),
        }
        mctx.close()
        browser.close()

    with open(OUT / "live-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2)[:6000])
    print("CONSISTENCY:", json.dumps(report.get("consistency"), ensure_ascii=False))
    table_ok = all(
        t["inner"] == 0 and t["wrap"] == 0 and t["clipped"] == 0
        for t in (report.get("mobile360_compound") or {}).get("tables", [])
    )
    print("MOBILE360_TABLES_OK:", table_ok)
    print("CHECKS_V41:", json.dumps(report.get("checks_v41"), ensure_ascii=False))
    sticky = report.get("run_sticky") or {}
    sticky_ok = (
        sticky.get("visible") is True
        and sticky.get("changed") is True
        and (sticky.get("scale_min_px") or 0) >= 12
    )
    print("RUN_STICKY_OK:", sticky_ok, json.dumps(sticky, ensure_ascii=False))
    v41_ok = all((report.get("checks_v41") or {}).values()) and bool(report.get("checks_v41"))
    if not (report.get("consistency") or {}).get("ok") or not table_ok or not v41_ok or not sticky_ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
