"""
buffetkimz v4.0 실측 검증 — dist를 로컬 서버로 열어 실제 브라우저로 확인한다.

사용: python3 scripts/verify_v4.py            (루트 배포 빌드 dist)
      VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v4.py   (GitHub Pages 서브패스 빌드)

결과: reports/buffetkimz-web/v4/ 스크린샷 + verify-report.json
확인:
  · 홈 비중 역전(은퇴 현금흐름 히어로 · 금융 연금 스트립 · 메인 도구 4 · 리스크 도구 한 줄)
  · 기록 4칸의 카테고리 구성(보험글이 1번에 오지 않고, 3칸 이상 금융·투자·경제·연금·노후·AI)
  · /apps 메인 4(금융·연금 3 + 달력 1) + 서브 리스크 3 = 7종 표기
  · 신규 도구 2종 실행 화면(1280·390·360): 결론 1줄·확인 항목 3·가정·출처·표 대체 텍스트·반응성
  · 검색어 저장소 0개(sessionStorage·localStorage), 주소창·네트워크 무전송
  · 대비 4.5:1↑, 최소 12px↑, 터치 44px↑, prefers-reduced-motion, 390px 줄바꿈
  · 콘솔·HTTP 오류 0, 내부 링크 전수, 색인/비색인
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

PORT = 4327
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
BASE = f"http://127.0.0.1:{PORT}" + PREFIX
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/v4")
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "pages": [],
    "console_errors": [],
    "http_errors": [],
    "broken_links": [],
    "home": {},
    "apps": {},
    "run": {},
    "search": {},
    "seo": {},
    "contrast": {},
    "touch": {},
    "mobile": {},
    "motion": {},
    "copy_scan": {},
}
checks = {}
failures = []


def man_tokens(text):
    """'441만원', '2억 731만원' 같은 표기를 만원 단위 정수 목록으로 바꾼다(화면 간 숫자 비교용)."""
    out = []
    for m in re.finditer(r"(?:(\d+)억\s*)?([\d,]+)\s*만원", text or ""):
        eok = int(m.group(1) or 0)
        man = int(m.group(2).replace(",", ""))
        out.append(eok * 10000 + man)
    return out


def won_from(text):
    """문장 안의 첫 금액을 만원 단위 정수로 — 없으면 None."""
    vals = man_tokens(text)
    return vals[0] if vals else None


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


def goto(page, name, path, wait="networkidle"):
    resp = page.goto(BASE + path, wait_until=wait, timeout=30000)
    page.wait_for_timeout(400)
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
    meets_aa_12px: out.filter((o) => o.px >= 12 && o.ratio < 4.5).length === 0,
    under_12px: out.filter((o) => o.px < 12).length,
    fails_below_4_5: out.filter((o) => o.ratio < 4.5).length,
    worst: out.filter((o) => o.ratio < 4.5).slice(0, 6),
  };
}
"""

TOUCH_JS = """
() => {
  const controls = [];
  document.querySelectorAll("a, button, input, select, textarea, [role=tab], [role=button]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if ((el.className || "").toString().includes("sr-only")) return;
    const isControl =
      el.tagName === "BUTTON" ||
      el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      (el.getAttribute("role") || "").match(/tab|button/) ||
      /btn|tab|chip|range/.test((el.className || "").toString());
    if (!isControl) return;
    const label = (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24);
    controls.push({ label, w: Math.round(r.width), h: Math.round(r.height) });
  });
  return {
    controls: controls.length,
    under_44: controls.filter((c) => c.h < 44),
  };
}
"""

STORAGE_JS = """
() => ({
  session_keys: Object.keys(sessionStorage),
  local_keys: Object.keys(localStorage),
  search: location.search,
  hash: location.hash,
})
"""

SMALL_TEXT_JS = """
() => {
  const out = [];
  document.querySelectorAll("main p, main span, main a, main h2, main h3, main li, main label, main output, main td, main th").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (own && fs < 12) out.push({ t: el.textContent.trim().slice(0, 30), fs });
  });
  return out.slice(0, 20);
}
"""


def main():
    serve_root = DIST
    if SUBPATH:
        serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v4")
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
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
            page = ctx.new_page()
            attach(page, "desktop")

            # ---------------- 홈 (1280) ----------------
            goto(page, "home", "/")
            page.screenshot(path=str(OUT / "desktop-home-fold.png"))
            page.screenshot(path=str(OUT / "desktop-home-full.png"), full_page=True)

            home = page.evaluate(
                """() => {
                  const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
                  const heroSection = document.querySelector('main section');
                  const cards = [...document.querySelectorAll('[data-post-cards] li')].map((li) => ({
                    category: txt(li.querySelector('span')),
                    title: txt(li.querySelector('h3')),
                  }));
                  const strip = document.querySelector('[data-finance-strip]');
                  const mainTools = [...document.querySelectorAll('[data-main-tools] li h3')].map(txt);
                  const riskTools = [...document.querySelectorAll('[data-risk-tools] li a')].map(txt);
                  const toolCount = document.querySelector('[data-tool-count]');
                  const trust = document.querySelector('[data-trust-line] span.whitespace-nowrap');
                  const trustRect = trust ? trust.getBoundingClientRect() : null;
                  return {
                    height: document.documentElement.scrollHeight,
                    hero_has_retirement_card: !!document.querySelector('[data-hero-row]'),
                    hero_rows: document.querySelectorAll('[data-hero-row]').length,
                    hero_text: txt(heroSection),
                    hero_has_coverage_card: txt(heroSection).includes('보장 점검'),
                    strip_tiles: strip ? strip.querySelectorAll('li').length : 0,
                    strip_text: txt(strip),
                    hero_verdict: txt(document.querySelector('[data-hero-verdict]')),
                    hero_insurance_terms: ['보험', '보장', '담보', '실손', '보험료'].filter((w) => txt(heroSection).includes(w)),
                    main_tools: mainTools,
                    risk_tools: riskTools,
                    tool_count: toolCount ? toolCount.getAttribute('data-tool-count') : null,
                    tool_count_text: txt(toolCount),
                    cards,
                    trust_text: trust ? trust.textContent : null,
                    trust_height: trustRect ? Math.round(trustRect.height) : null,
                    risk_line_text: txt(document.querySelector('[data-risk-tools]')),
                  };
                }"""
            )
            report["home"] = home
            check("home.height_2200_2500", 2200 <= home["height"] <= 2500, home["height"])
            check("home.hero_retirement_card", home["hero_has_retirement_card"] and home["hero_rows"] == 3, home["hero_rows"])
            check("home.hero_no_coverage_card", not home["hero_has_coverage_card"], home["hero_text"][:80])
            check("home.hero_verdict_line", bool(home["hero_verdict"]) and "추가 확인 필요" in home["hero_verdict"], home["hero_verdict"])
            check("home.hero_no_insurance_terms", len(home["hero_insurance_terms"]) == 0, home["hero_insurance_terms"])
            check(
                "home.tool_count_phrase_matches",
                "금융·연금 3 + 달력 1 + 리스크 관리 3" in (home["tool_count_text"] or ""),
                home["tool_count_text"],
            )
            check("home.finance_strip_5", home["strip_tiles"] == 5, home["strip_tiles"])
            check(
                "home.main_tools_4_order",
                home["main_tools"]
                == ["연금저축·IRP 세액공제 계산기", "은퇴 월 현금흐름 시뮬레이터", "투자 복리·세후 수익률 계산기", "제도 일정 달력"],
                home["main_tools"],
            )
            check("home.risk_tools_3", len(home["risk_tools"]) == 3, home["risk_tools"])
            check("home.tool_count_7", str(home["tool_count"]) == "7", home["tool_count_text"])
            cats = [c["category"] for c in home["cards"]]
            finance_cats = {"금융", "투자", "경제", "연금", "노후준비", "AI"}
            check("home.cards_4", len(home["cards"]) == 4, cats)
            check("home.cards_insurance_not_first", bool(cats) and cats[0] != "보험", cats)
            check(
                "home.cards_3plus_finance",
                sum(1 for c in cats if c in finance_cats) >= 3,
                cats,
            )
            check(
                "home.cards_no_ai_coverage_post",
                all("보장분석 도구를" not in c["title"] for c in home["cards"]),
                [c["title"] for c in home["cards"]],
            )
            report["contrast"]["home"] = page.evaluate(CONTRAST_JS)
            report["touch"]["home"] = page.evaluate(TOUCH_JS)
            check("home.contrast_4_5", report["contrast"]["home"]["fails_below_4_5"] == 0, report["contrast"]["home"]["worst"])
            check("home.text_12px", report["contrast"]["home"]["under_12px"] == 0, report["contrast"]["home"]["under_12px"])
            check("home.touch_44", len(report["touch"]["home"]["under_44"]) == 0, report["touch"]["home"]["under_44"][:4])

            home_text = page.locator("main").inner_text()
            report["copy_scan"]["home_forbidden"] = [
                w for w in ["상담", "만족도", "후기", "누적", "최고", "100%", "보장 확정", "추천", "best"]
                if w in home_text
            ]
            check("home.copy_forbidden_none", len(report["copy_scan"]["home_forbidden"]) == 0, report["copy_scan"]["home_forbidden"])

            # ---------------- /apps ----------------
            goto(page, "apps", "/apps")
            page.screenshot(path=str(OUT / "desktop-apps.png"), full_page=True)
            apps = page.evaluate(
                """() => {
                  const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
                  const mainGrid = document.querySelector('[data-tool-grid="main"]');
                  const riskGrid = document.querySelector('[data-tool-grid="risk"]');
                  const toolCount = document.querySelector('[data-tool-count]');
                  return {
                    title: document.title,
                    h1: txt(document.querySelector('main h1')),
                    main_tools: [...document.querySelectorAll('[data-main-tool]')].map((el) => el.getAttribute('data-main-tool')),
                    main_names: [...document.querySelectorAll('[data-main-tool] h3')].map(txt),
                    risk_tools: [...document.querySelectorAll('[data-risk-tool]')].map((el) => el.getAttribute('data-risk-tool')),
                    risk_names: [...document.querySelectorAll('[data-risk-tool] h3')].map(txt),
                    main_before_risk: !!(mainGrid && riskGrid && (mainGrid.compareDocumentPosition(riskGrid) & Node.DOCUMENT_POSITION_FOLLOWING)),
                    tool_count_text: txt(toolCount),
                    count_text: txt(document.querySelector('[data-tool-count]')),
                    has_five_wording: txt(document.querySelector('main')).includes('다섯 가지'),
                    body_lede: txt(document.querySelector('main p.lede')),
                  };
                }"""
            )
            report["apps"] = apps
            check("apps.main_tools_4", apps["main_tools"] == ["pension", "retirement-flow", "compound-return", "calendar"], apps["main_tools"])
            check("apps.risk_tools_3", apps["risk_tools"] == ["coverage", "disclosure", "silson"], apps["risk_tools"])
            check("apps.main_before_risk", apps["main_before_risk"], apps["main_before_risk"])
            check("apps.count_7_with_split", "7종" in (apps["count_text"] or "") and "금융·연금 3 + 달력 1 + 리스크 관리 3" in (apps["count_text"] or ""), apps["count_text"])
            check("apps.no_five_wording", not apps["has_five_wording"], apps["has_five_wording"])
            report["contrast"]["apps"] = page.evaluate(CONTRAST_JS)
            report["touch"]["apps"] = page.evaluate(TOUCH_JS)
            check("apps.contrast_4_5", report["contrast"]["apps"]["fails_below_4_5"] == 0, report["contrast"]["apps"]["worst"])
            check("apps.touch_44", len(report["touch"]["apps"]["under_44"]) == 0, report["touch"]["apps"]["under_44"][:4])

            # ---------------- 앱 소개 + 실행 화면 ----------------
            for slug in ["retirement-flow", "compound-return"]:
                goto(page, f"detail-{slug}", f"/apps/{slug}")
                page.screenshot(path=str(OUT / f"desktop-app-{slug}.png"), full_page=True)
                detail = page.evaluate(
                    """() => ({
                      h1: document.querySelector('main h1')?.innerText.trim(),
                      art: !!document.querySelector('[aria-hidden="true"] .serif, [aria-hidden="true"] ul'),
                      run_link: !!document.querySelector('a[href*="/run"]'),
                      basis: document.querySelector('main')?.innerText.includes('기준과 출처'),
                      source_line: document.querySelector('.source-note')?.innerText.trim() || '',
                    })"""
                )
                check(f"detail.{slug}.h1", bool(detail["h1"]), detail)
                check(f"detail.{slug}.basis", detail["basis"], detail["basis"])
                check(f"detail.{slug}.run_link", detail["run_link"], detail["run_link"])

            goto(page, "run-retirement", "/apps/retirement-flow/run")
            page.screenshot(path=str(OUT / "desktop-run-retirement-flow.png"), full_page=True)
            retire = page.evaluate(
                """() => {
                  const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
                  const body = txt(document.querySelector('main'));
                  return {
                    verdict: txt(document.querySelector('[data-retirement-verdict]')),
                    checks: [...document.querySelectorAll('[data-retirement-checks] li')].length,
                    assumptions: txt(document.querySelector('[data-retirement-assumptions]')),
                    rows: document.querySelectorAll('[data-retirement-row]').length,
                    has_table_caption: !!document.querySelector('table caption'),
                    has_source: body.includes('기준일 2026-11-19'),
                    has_disclaimer: body.includes('참고용 단순 시뮬레이션'),
                    has_confirmed_wording: body.includes('확정 수령액 아님'),
                    range_count: document.querySelectorAll('input[type=range]').length,
                    visible_ranges: [...document.querySelectorAll('input[type=range]')].filter((el) => !el.closest('details')).length,
                    more_open: !!document.querySelector('[data-retirement-more]')?.open,
                    tax_text: txt(document.querySelector('[data-retirement-tax]')),
                    has_judgement: /부족|충분/.test(body),
                    has_1500: body.includes('1,500만원'),
                    has_125: body.includes('125만원'),
                    has_2000: body.includes('2,000만원'),
                    has_separate_choice: body.includes('15% 분리과세') && body.includes('16.5%'),
                    has_old_tax_error: body.includes('최대 16.5%') || body.includes('16.5% 수준의 종합과세'),
                    stats: [...document.querySelectorAll('main p')]
                      .filter((el) => ['은퇴 시 월 수령액', '오늘 가치(추정)', '목표 월 생활비와의 차이'].some((k) => el.textContent.includes(k)))
                      .map((el) => ({
                        label: el.textContent.trim(),
                        value: el.nextElementSibling ? el.nextElementSibling.textContent.trim() : '',
                      })),
                  };
                }"""
            )
            report["run"]["retirement"] = retire
            check("run.retirement.verdict", ("추정" in retire["verdict"] or "계산됩니다" in retire["verdict"]) and "예시 가정 기준" in retire["verdict"], retire["verdict"])
            check("run.retirement.checks_3", retire["checks"] == 3, retire["checks"])
            check("run.retirement.assumptions", all(k in retire["assumptions"] for k in ["물가상승률", "기대 수익률", "인출률", "기준일"]), retire["assumptions"])
            check("run.retirement.assumption_not_guarantee", "확정 수령액 아닌" in retire["assumptions"], retire["assumptions"])
            check("run.retirement.rows_3", retire["rows"] == 3, retire["rows"])
            check("run.retirement.table_caption", retire["has_table_caption"], retire["has_table_caption"])
            check("run.retirement.source_line", retire["has_source"], retire["has_source"])
            check("run.retirement.disclaimer", retire["has_disclaimer"], retire["has_disclaimer"])
            check("run.retirement.controls", retire["range_count"] >= 8, retire["range_count"])
            check("run.retirement.primary_inputs_4", retire["visible_ranges"] == 4 and not retire["more_open"], {"visible": retire["visible_ranges"], "open": retire["more_open"]})
            check("run.retirement.tax_notes", retire["has_1500"] and retire["has_125"] and retire["has_2000"], retire["tax_text"][:120])
            check("run.retirement.no_judgement_words", not retire["has_judgement"], retire["has_judgement"])
            report["contrast"]["run_retirement"] = page.evaluate(CONTRAST_JS)
            report["touch"]["run_retirement"] = page.evaluate(TOUCH_JS)
            check("run.retirement.contrast_4_5", report["contrast"]["run_retirement"]["fails_below_4_5"] == 0, report["contrast"]["run_retirement"]["worst"])
            check("run.retirement.touch_44", len(report["touch"]["run_retirement"]["under_44"]) == 0, report["touch"]["run_retirement"]["under_44"][:4])

            before_verdict = retire["verdict"]
            page.evaluate(
                """() => { const r = document.querySelectorAll('input[type=range]')[2];
                   const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                   setter.call(r, '0'); r.dispatchEvent(new Event('input', {bubbles:true})); }"""
            )
            page.wait_for_timeout(600)
            after_verdict = page.locator("[data-retirement-verdict]").inner_text().replace(r"\s+", " ").strip()
            report["run"]["retirement_reactive"] = {"before": before_verdict, "after": after_verdict, "changed": before_verdict != after_verdict}
            check("run.retirement.reactive", before_verdict != after_verdict, report["run"]["retirement_reactive"])

            goto(page, "run-compound", "/apps/compound-return/run")
            page.screenshot(path=str(OUT / "desktop-run-compound-return.png"), full_page=True)
            comp = page.evaluate(
                """() => {
                  const txt = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
                  const body = txt(document.querySelector('main'));
                  return {
                    verdict: txt(document.querySelector('[data-compound-verdict]')),
                    checks: [...document.querySelectorAll('[data-compound-checks] li')].length,
                    assumptions: txt(document.querySelector('[data-compound-assumptions]')),
                    costs: txt(document.querySelector('[data-compound-costs]')),
                    risk: txt(document.querySelector('[data-compound-risk]')),
                    has_table_caption: !!document.querySelector('table caption'),
                    has_source: body.includes('기준일 2026-11-19'),
                    has_official_source: ['조세특례제한법', '제16조', '제17조'].every((s) => body.includes(s)),
                    has_limit: body.includes('한계'),
                    has_fee_input: body.includes('연 운용 보수·수수료'),
                    has_reinvest: body.includes('재투자'),
                    has_loss: body.includes('원금 손실'),
                    has_negation: body.includes('보장 아님') && body.includes('보장된 값이 아니'),
                    has_affirmative_guarantee: /(보장됩니다|보장합니다|확정 수익입니다|수익을 보장)/.test(body),
                    visible_ranges: [...document.querySelectorAll('input[type=range]')].filter((el) => !el.closest('details')).length,
                    more_open: !!document.querySelector('[data-compound-more]')?.open,
                    compare_rows: document.querySelectorAll('[data-compound-compare] tbody tr').length,
                    compare_text: txt(document.querySelector('[data-compound-compare]')),
                    range_height: Math.round(document.querySelector('[data-compound-range]').getBoundingClientRect().height),
                    risk_height: Math.round(document.querySelector('[data-compound-risk]').getBoundingClientRect().height),
                    has_judgement: /부족|충분/.test(body),
                    range_text: txt(document.querySelector('[data-compound-range]')),
                    has_fee_030: body.includes('0.30%'),
                    has_down_330: body.includes('-3.30%'),
                    has_fee_130: body.includes('1.30%'),
                    has_down_430: body.includes('-4.30%'),
                    stats: [...document.querySelectorAll('main p')]
                      .filter((el) => el.textContent.trim() === '총 납입 원금' || el.textContent.includes('세전 평가액 (보수 차감 후)'))
                      .map((el) => ({
                        label: el.textContent.trim(),
                        value: el.nextElementSibling ? el.nextElementSibling.textContent.trim() : '',
                      })),
                  };
                }"""
            )
            report["run"]["compound"] = comp
            check("run.compound.verdict_estimate", "추정" in comp["verdict"] and "보장 아님" in comp["verdict"], comp["verdict"])
            check("run.compound.checks_3", comp["checks"] == 3, comp["checks"])
            check("run.compound.fee_input", comp["has_fee_input"], comp["has_fee_input"])
            check("run.compound.costs_split", all(k in comp["costs"] for k in ["보수로 줄어든 금액", "세금"]), comp["costs"])
            check("run.compound.risk_separate", "원금 손실 가능" in comp["risk"] and "같은 기간" in comp["risk"], comp["risk"][:90])
            check("run.compound.assumptions", all(k in comp["assumptions"] for k in ["기대 수익률", "연 보수", "재투자", "기준일"]), comp["assumptions"])
            check("run.compound.official_source", comp["has_official_source"], comp["has_official_source"])
            check("run.compound.limit", comp["has_limit"], comp["has_limit"])
            check("run.compound.reinvest", comp["has_reinvest"], comp["has_reinvest"])
            check("run.compound.table_caption", comp["has_table_caption"], comp["has_table_caption"])
            check("run.compound.primary_inputs_4", comp["visible_ranges"] == 4 and not comp["more_open"], {"visible": comp["visible_ranges"], "open": comp["more_open"]})
            check("run.compound.tax_compare_3", comp["compare_rows"] == 3 and "ISA" in comp["compare_text"] and "연금저축" in comp["compare_text"], comp["compare_text"][:120])
            check("run.compound.range_and_risk_equal", abs(comp["range_height"] - comp["risk_height"]) <= 60, {"range": comp["range_height"], "risk": comp["risk_height"]})
            check("run.compound.no_judgement_words", not comp["has_judgement"], comp["has_judgement"])
            check(
                "run.compound.no_guarantee_wording",
                comp["has_negation"] and not comp["has_affirmative_guarantee"],
                {"negation": comp["has_negation"], "affirmative": comp["has_affirmative_guarantee"]},
            )
            report["contrast"]["run_compound"] = page.evaluate(CONTRAST_JS)
            report["touch"]["run_compound"] = page.evaluate(TOUCH_JS)
            check("run.compound.contrast_4_5", report["contrast"]["run_compound"]["fails_below_4_5"] == 0, report["contrast"]["run_compound"]["worst"])
            check("run.compound.touch_44", len(report["touch"]["run_compound"]["under_44"]) == 0, report["touch"]["run_compound"]["under_44"][:4])

            before = comp["verdict"]
            # 과세 방식은 '가정 더 보기' 안에 있다 — 펼친 뒤 바꿔 본다
            page.click("[data-compound-more] summary")
            page.wait_for_timeout(300)
            more_open_after = page.evaluate("() => !!document.querySelector('[data-compound-more]').open")
            check("run.compound.more_toggle", more_open_after, more_open_after)
            page.click('button[aria-pressed="false"]:has-text("ISA")')
            page.wait_for_timeout(500)
            after = page.locator("[data-compound-verdict]").inner_text().replace(r"\s+", " ").strip()
            report["run"]["compound_reactive"] = {"before": before, "after": after, "changed": before != after}
            check("run.compound.reactive", before != after, report["run"]["compound_reactive"])
            page.screenshot(path=str(OUT / "desktop-run-compound-return-open.png"), full_page=True)

            # ---------------- 계산 일치: 홈 · 스트립 · 실행 화면이 같은 수 ----------------
            def stat_value(stats, needle):
                for item in stats or []:
                    if needle in item["label"]:
                        return item["value"]
                return None

            home_ret = man_tokens(home["hero_verdict"])
            run_nominal = won_from(stat_value(retire["stats"], "은퇴 시 월 수령액"))
            run_real = won_from(stat_value(retire["stats"], "오늘 가치"))
            run_gap = won_from(stat_value(retire["stats"], "목표 월 생활비와의 차이"))
            run_verdict_amounts = man_tokens(retire["verdict"])
            consistency = {
                "home_hero_amounts": home_ret,
                "run_nominal": run_nominal,
                "run_real": run_real,
                "run_gap": run_gap,
                "run_verdict_amounts": run_verdict_amounts,
                "strip_nominal": f"{home_ret[0]:,}만원" in home["strip_text"] if home_ret else False,
                "strip_real": f"{home_ret[1]:,}만원" in home["strip_text"] if len(home_ret) > 1 else False,
            }
            report["run"]["consistency"] = consistency
            check(
                "consistency.retirement_home_vs_run",
                bool(home_ret) and run_nominal == home_ret[0] and run_real == home_ret[1] and run_gap == home_ret[3],
                consistency,
            )
            check(
                "consistency.retirement_run_verdict_same",
                run_real in run_verdict_amounts and run_gap in run_verdict_amounts and home_ret[2] in run_verdict_amounts,
                {"verdict": run_verdict_amounts, "real": run_real, "gap": run_gap, "target": home_ret[2]},
            )
            check(
                "consistency.retirement_strip_same",
                consistency["strip_nominal"] and consistency["strip_real"],
                {"nominal": consistency["strip_nominal"], "real": consistency["strip_real"], "hero": home_ret},
            )

            comp_principal = won_from(stat_value(comp["stats"], "총 납입 원금"))
            comp_gross = won_from(stat_value(comp["stats"], "세전 평가액"))
            comp_net = man_tokens(comp["range_text"])[-1] if man_tokens(comp["range_text"]) else None
            strip_amounts = man_tokens(home["strip_text"])
            comp_consistency = {
                "run_principal": comp_principal,
                "run_gross": comp_gross,
                "run_net": comp_net,
                "strip_has_gross": comp_gross in strip_amounts,
                "strip_has_net": comp_net in strip_amounts,
                "strip_fee_030": "0.30%" in home["strip_text"],
            }
            report["run"]["compound_consistency"] = comp_consistency
            check(
                "consistency.compound_strip_vs_run",
                comp_consistency["strip_has_gross"] and comp_consistency["strip_has_net"] and comp_consistency["strip_fee_030"],
                comp_consistency,
            )
            check(
                "consistency.compound_fee_030_down_330",
                comp["has_fee_030"] and comp["has_down_330"] and not comp["has_fee_130"] and not comp["has_down_430"],
                {"fee": comp["has_fee_030"], "down": comp["has_down_330"], "old_fee": comp["has_fee_130"], "old_down": comp["has_down_430"]},
            )
            check(
                "run.retirement.tax_separate_wording",
                retire["has_separate_choice"] and not retire["has_old_tax_error"],
                {"choice": retire["has_separate_choice"], "old_error": retire["has_old_tax_error"]},
            )

            # 기존 도구도 그대로 동작하는지
            goto(page, "run-coverage", "/apps/coverage-check/run")
            page.screenshot(path=str(OUT / "desktop-run-coverage.png"), full_page=True)
            before = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
            page.evaluate(
                """() => { const r = document.querySelector('input[type=range]');
                   const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                   setter.call(r, '0'); r.dispatchEvent(new Event('input', {bubbles:true})); }"""
            )
            page.wait_for_timeout(500)
            after = page.evaluate("() => document.querySelector('table tbody tr:nth-child(1) td:last-child')?.innerText")
            check("run.coverage.reactive", before != after, {"before": before, "after": after})

            # ---------------- 검색: 저장소 0 · 주소 0 · 네트워크 무전송 ----------------
            goto(page, "home-search", "/")
            requests = []
            page.on("request", lambda r: requests.append(r.url))

            # ① 헤더 검색 오버레이에서 입력
            page.click('button[aria-label="사이트 검색 열기"]')
            page.wait_for_timeout(500)
            page.fill("#search-input-overlay", "연금")
            page.wait_for_timeout(600)
            report["search"]["overlay_results"] = page.eval_on_selector_all("#search-results li", "e => e.length")
            page.screenshot(path=str(OUT / "desktop-search-overlay.png"))
            storage_after_overlay = page.evaluate(STORAGE_JS)
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # ② 첫 화면 검색 버튼 → 오버레이가 열리고 그 자리에서 결과
            hero_search = page.locator("[data-search-query]").first
            hero_search.click()
            page.wait_for_timeout(600)
            overlay_open = page.locator('[role="dialog"]').count() > 0
            report["search"]["hero_button_opens_overlay"] = overlay_open
            page.fill("#search-input-overlay", "실손")
            page.wait_for_timeout(500)
            report["search"]["hero_overlay_results"] = page.eval_on_selector_all("#search-results li", "e => e.length")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # ③ 글의 태그 → 오버레이가 그 검색어로 열린다(저장소·주소 없이)
            goto(page, "post-tag", "/posts/insurance-silson-5th")
            tag = page.locator("[data-search-query]").first
            tag_value = tag.get_attribute("data-search-query")
            tag_href = tag.get_attribute("href") or ""
            tag.click()
            page.wait_for_timeout(700)
            tag_overlay = page.locator('[role="dialog"]').count() > 0
            tag_input = page.input_value("#search-input-overlay") if tag_overlay else None
            tag_results = page.eval_on_selector_all("#search-results li", "e => e.length") if tag_overlay else 0
            report["search"]["tag_flow"] = {
                "tag": tag_value,
                "href": tag_href,
                "overlay": tag_overlay,
                "input": tag_input,
                "results": tag_results,
            }
            check("search.tag_opens_overlay_with_query", tag_overlay and tag_input == tag_value and tag_results > 0, report["search"]["tag_flow"])
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # ④ /search 페이지는 순수 이동(주소에 검색어 없음)
            goto(page, "search-page", "/search")
            page.fill("#search-input-page", "고지의무")
            page.wait_for_timeout(500)
            report["search"]["page_results"] = page.eval_on_selector_all("#search-results li", "e => e.length")
            report["search"]["page_url"] = page.url.replace(BASE, "")
            storage_final = page.evaluate(STORAGE_JS)

            report["search"]["storage"] = {"after_overlay": storage_after_overlay, "final": storage_final}
            check(
                "search.no_storage_keys",
                not storage_after_overlay["session_keys"] and not storage_final["session_keys"] and not storage_final["local_keys"],
                report["search"]["storage"],
            )
            check("search.no_query_in_url", "?" not in report["search"]["page_url"] and "q=" not in report["search"]["page_url"], report["search"]["page_url"])
            leaked = [u for u in requests if "연금" in u or "실손" in u or "고지의무" in u or "q=" in u]
            report["search"]["leaked_requests"] = leaked
            check("search.no_query_in_network", len(leaked) == 0, leaked)
            check("search.hero_button", report["search"]["hero_button_opens_overlay"], report["search"]["hero_button_opens_overlay"])

            # ⑤ 개인정보처리방침 6장 문구
            goto(page, "privacy", "/privacy")
            page.screenshot(path=str(OUT / "desktop-privacy.png"), full_page=True)
            p6 = page.locator("#p6").evaluate("el => el.parentElement.innerText.replace(/\\s+/g,' ').trim()")
            report["search"]["privacy_p6"] = p6
            check(
                "privacy.search_wording",
                "검색어는 브라우저 메모리에서만 처리되며 저장소(sessionStorage 등)나 주소창, 서버 어디에도 남기지 않습니다" in p6,
                p6[:160],
            )

            # ---------------- SEO / 색인 ----------------
            goto(page, "seo-home", "/")
            report["seo"]["home_robots"] = page.get_attribute("meta[name=robots]", "content")
            report["seo"]["home_canonical"] = page.get_attribute("link[rel=canonical]", "href")
            report["seo"]["home_title"] = page.title()
            report["seo"]["home_description"] = page.get_attribute("meta[name=description]", "content")
            check("seo.home_title_has_finance", "금융" in (report["seo"]["home_title"] or ""), report["seo"]["home_title"])

            goto(page, "seo-run", "/apps/retirement-flow/run")
            report["seo"]["run_robots"] = page.get_attribute("meta[name=robots]", "content")
            check("seo.run_noindex", "noindex" in (report["seo"]["run_robots"] or ""), report["seo"]["run_robots"])

            goto(page, "seo-search", "/search")
            report["seo"]["search_robots"] = page.get_attribute("meta[name=robots]", "content")
            check("seo.search_noindex", "noindex" in (report["seo"]["search_robots"] or ""), report["seo"]["search_robots"])

            robots = (DIST / "robots.txt").read_text(encoding="utf-8")
            report["seo"]["robots_txt"] = robots
            sitemap = "".join(f.read_text(encoding="utf-8") for f in DIST.glob("sitemap*.xml"))
            locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
            report["seo"]["sitemap_urls"] = len(locs)
            report["seo"]["sitemap_excludes_run_search"] = not [u for u in locs if "/run" in u or "/search" in u]
            report["seo"]["sitemap_has_new_apps"] = {
                "retirement": any("/apps/retirement-flow" in u for u in locs),
                "compound": any("/apps/compound-return" in u for u in locs),
                "apps": any(u.rstrip("/").endswith("/apps") for u in locs),
            }
            check("seo.sitemap_excludes_run_search", report["seo"]["sitemap_excludes_run_search"], report["seo"]["sitemap_excludes_run_search"])
            check("seo.sitemap_has_new_apps", all(report["seo"]["sitemap_has_new_apps"].values()), report["seo"]["sitemap_has_new_apps"])
            if PREFIX:
                report["seo"]["sitemap_uses_prefix"] = all(u.startswith(f"https://byhan2025.github.io{PREFIX}") for u in locs)
                check("seo.sitemap_prefix", report["seo"]["sitemap_uses_prefix"], report["seo"]["sitemap_uses_prefix"])

            # ---------------- 내부 링크 전수 (HTTP) ----------------
            dist_urls = []
            for f in DIST.rglob("*.html"):
                rel = f.relative_to(DIST).as_posix()
                path = "/" + rel[: -len("index.html")] if rel.endswith("index.html") else "/" + rel
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
            check("http.all_pages_200", len(http_fail) == 0, http_fail[:6])
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
                m.screenshot(path=str(OUT / f"{tag}-home-fold.png"))
                m.screenshot(path=str(OUT / f"{tag}-home-full.png"), full_page=True)
                overflow = m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                small_text = m.evaluate(SMALL_TEXT_JS)
                trust = m.evaluate(
                    """() => {
                      const span = document.querySelector('[data-trust-line] span.whitespace-nowrap');
                      if (!span) return null;
                      const r = span.getBoundingClientRect();
                      return { text: span.textContent.trim(), height: Math.round(r.height), width: Math.round(r.width) };
                    }"""
                )
                report["mobile"][tag] = {
                    "overflow_px": overflow,
                    "small_text": small_text,
                    "trust_line": trust,
                }
                check(f"{tag}.overflow_0", overflow == 0, overflow)
                check(f"{tag}.text_12px", len(small_text) == 0, small_text[:4])
                check(f"{tag}.trust_line_one_line", bool(trust) and trust["height"] < 22, trust)

                for slug in ["retirement-flow", "compound-return", "coverage-check"]:
                    goto(m, f"{tag}-run-{slug}", f"/apps/{slug}/run")
                    m.screenshot(path=str(OUT / f"{tag}-run-{slug}.png"), full_page=True)
                    o = m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                    touch = m.evaluate(TOUCH_JS)
                    report["mobile"].setdefault(tag, {})[f"run_{slug}"] = {
                        "overflow_px": o,
                        "under_44": touch["under_44"][:4],
                    }
                    tables = m.evaluate(
                        """() => [...document.querySelectorAll('table')].map((t) => ({
                          inner: t.scrollWidth - t.clientWidth,
                          wrap: t.parentElement.scrollWidth - t.parentElement.clientWidth,
                          clipped: [...t.querySelectorAll('td,th')].filter((c) => c.scrollWidth - c.clientWidth > 1).length,
                          caption: t.caption ? t.caption.innerText.trim().slice(0, 24) : '',
                        }))"""
                    )
                    report["mobile"][tag][f"run_{slug}"]["tables"] = tables
                    check(f"{tag}.run.{slug}.overflow_0", o == 0, o)
                    check(f"{tag}.run.{slug}.table_fit", all(t["inner"] == 0 and t["wrap"] == 0 and t["clipped"] == 0 for t in tables), tables)
                    check(f"{tag}.run.{slug}.touch_44", len(touch["under_44"]) == 0, touch["under_44"][:4])

                goto(m, f"{tag}-apps", "/apps")
                m.screenshot(path=str(OUT / f"{tag}-apps.png"), full_page=True)
                o = m.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                report["mobile"][tag]["apps_overflow_px"] = o
                check(f"{tag}.apps.overflow_0", o == 0, o)

                goto(m, f"{tag}-menu", "/")
                m.click('button[aria-label="메뉴 열기"]')
                m.wait_for_timeout(300)
                report["mobile"][tag]["menu_links"] = m.locator("#mobile-menu a").count()
                mctx.close()

            # ---------------- 모션 줄이기 ----------------
            rmctx = browser.new_context(
                viewport={"width": 1280, "height": 800}, locale="ko-KR", reduced_motion="reduce"
            )
            rm = rmctx.new_page()
            attach(rm, "reduced-motion")
            goto(rm, "rm-home", "/")
            rm.wait_for_timeout(500)
            report["motion"]["reduced_home"] = rm.evaluate(
                """() => {
                  const pick = (sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const cs = getComputedStyle(el);
                    return { selector: sel, animation: cs.animationName, duration: cs.animationDuration, opacity: cs.opacity };
                  };
                  return {
                    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                    items: [pick('.hero-title'), pick('.hero-soft'), pick('.hero-card'), pick('.card-lift')].filter(Boolean),
                    reveal_all_in: [...document.querySelectorAll('.reveal')].every((el) => el.classList.contains('is-in')),
                  };
                }"""
            )
            motion_items = report["motion"]["reduced_home"]["items"]

            def effective_off(item):
                dur = item.get("duration", "")
                try:
                    seconds = float(dur.replace("s", ""))
                except ValueError:
                    seconds = 1
                return item["animation"] in ("none", "") or seconds <= 0.01

            check(
                "motion.reduced_no_animation",
                all(effective_off(i) for i in motion_items)
                and all(float(i["opacity"]) >= 0.99 for i in motion_items),
                motion_items,
            )
            rm.screenshot(path=str(OUT / "desktop-home-reduced-motion.png"))
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
        return any(c.exists() for c in [DIST / rel / "index.html", DIST / f"{rel}.html", DIST / rel])

    broken = []
    for html_file in DIST.rglob("*.html"):
        text = html_file.read_text(encoding="utf-8", errors="ignore")
        for href in set(re.findall(r'href="(/[^"#]*)"', text)):
            if href.startswith("/_astro"):
                continue
            if not resolve(href):
                broken.append({"from": html_file.relative_to(DIST).as_posix(), "href": href})
    report["broken_links"] = broken
    check("links.no_broken", len(broken) == 0, broken[:8])

    # ---------------- 저장소 흔적(빌드 산출물) ----------------
    js_text = "".join(f.read_text(encoding="utf-8", errors="ignore") for f in DIST.rglob("*.js"))
    report["search"]["dist_js_session_storage_refs"] = js_text.count("sessionStorage")
    check("search.dist_js_no_session_storage", js_text.count("sessionStorage") == 0, js_text.count("sessionStorage"))

    # ---------------- 세법 문구·계산 표기의 정적 검사(빌드 산출물 전체) ----------------
    html_text = "".join(f.read_text(encoding="utf-8", errors="ignore") for f in DIST.rglob("*.html"))
    page_text = html_text + js_text
    copy_scan = {
        "old_combined_tax_wording": page_text.count("16.5% 수준의 종합과세") + page_text.count("최대 16.5% 수준"),
        "separate_choice_wording": "15% 분리과세" in page_text and "지방소득세 포함 16.5%" in page_text,
        "fee_030": "0.30%" in page_text,
        "fee_130_bad": "1.30%" in page_text,
        "down_430_bad": "4.30%" in page_text,
        "retirement_441": "441만원" in html_text,
        "retirement_269": "269만원" in html_text,
    }
    report["copy_scan"] = copy_scan
    check("copy.no_combined_tax_mixup", copy_scan["old_combined_tax_wording"] == 0, copy_scan["old_combined_tax_wording"])
    check("copy.separate_tax_choice", copy_scan["separate_choice_wording"], copy_scan["separate_choice_wording"])
    check("copy.fee_default_030", copy_scan["fee_030"] and not copy_scan["fee_130_bad"] and not copy_scan["down_430_bad"], copy_scan)

    check("console.no_errors", len(report["console_errors"]) == 0, report["console_errors"][:6])

    report["checks"] = checks
    report["failures"] = failures
    with open(OUT / "verify-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(
        json.dumps(
            {
                "failed_checks": len(failures),
                "failures": failures,
                "console_errors": report["console_errors"][:5],
                "http_errors": report["http_errors"][:5],
                "home": {k: v for k, v in report["home"].items() if k not in ("hero_text", "strip_text")},
                "apps": {k: v for k, v in report["apps"].items() if k != "body_lede"},
                "search": {k: v for k, v in report["search"].items()},
                "seo": {k: v for k, v in report["seo"].items() if k != "robots_txt"},
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
