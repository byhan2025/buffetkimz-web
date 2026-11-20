"""
buffetkimz 도구자료실 — '한국형 타임머신' 정식 연결 실측 (v5.4).

사용:
  SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
  VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v9.py
  LIVE=1 VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v9.py   # 라이브 확인

결과: reports/buffetkimz-web/final-timemachine/ 스크린샷 + verify-report.json
v5.4에서 새로 재는 것:
  · /apps 에 [data-app-card="trade-timemachine"] 카드 — 이름·외부 링크·새 창·noopener·터치 높이 44px
  · 카드·상세의 비영업 고지("투자 권유·매매 신호가 아닙니다")
  · /apps/trade-timemachine 상세 페이지 200·외부 실행 링크
  · 두 외부 앱 URL(bojang-counsel-guide·trade-timemachine) 실제 200
  · '직접 만든 앱 2종' 개수 표기
  · v5.3 계승: 1280/390/360 가로 넘침 0, 12px 미만 0, 44px 미만 컨트롤 0, 대비 AA, 링크 크롤, 콘솔 오류 0
"""
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright

LIVE = os.environ.get("LIVE") == "1"
PORT = 4342
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(
    os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/final-timemachine"
)
OUT.mkdir(parents=True, exist_ok=True)

if LIVE:
    ORIGIN = os.environ.get("LIVE_ORIGIN", "https://byhan2025.github.io")
    BASE = ORIGIN + "/" + SUBPATH if SUBPATH else ORIGIN
else:
    BASE = f"http://127.0.0.1:{PORT}" + PREFIX

TIMEMACHINE_URL = "https://byhan2025.github.io/trade-timemachine/"
BOJANG_URL = "https://byhan2025.github.io/bojang-counsel-guide/"

report = {
    "base": BASE,
    "live": LIVE,
    "pages": [],
    "viewport": {},
    "apps_card": {},
    "apps_detail": {},
    "external": {},
    "console_errors": [],
    "http_errors": [],
    "broken_links": [],
}
checks = {}
failures = []


def check(name, ok, detail=None):
    checks[name] = {"pass": bool(ok), "detail": detail}
    if not ok:
        failures.append({"check": name, "detail": detail})
    return ok


def attach(page, name):
    page.on(
        "console",
        lambda msg: report["console_errors"].append({"page": name, "type": msg.type, "text": msg.text})
        if msg.type == "error"
        else None,
    )
    page.on(
        "pageerror",
        lambda err: report["console_errors"].append(
            {"page": name, "type": "pageerror", "text": str(err)}
        ),
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
  const bad = []; const seen = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (el.closest('.sr-only') || el.closest('[aria-hidden=true]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const fs = parseFloat(cs.fontSize);
    const key = t.slice(0, 20) + '|' + fs + '|' + el.tagName;
    if (fs < 11.99 && !seen.has(key)) { seen.add(key); bad.push({ t: t.slice(0, 36), fs, tag: el.tagName }); }
  }
  return bad;
}
"""

TOUCH_JS = r"""
() => {
  const out = { controls: [], text: [] };
  document.querySelectorAll('a,button,summary,input,select,[role=button]').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (el.closest('.sr-only')) return;
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 28);
    const item = { tag: el.tagName, label, w: +r.width.toFixed(1), h: +r.height.toFixed(1), cls: String(el.className).slice(0, 70) };
    const isControl = el.matches('button,summary,input,select,[role=button]') || el.classList.contains('btn') ||
      el.classList.contains('tab') || el.closest('nav') || el.closest('header') ||
      el.classList.contains('film-btn') || el.classList.contains('film-tick') || el.classList.contains('film-cta') ||
      el.classList.contains('film-credit') || el.classList.contains('fs6-link');
    const iconOnly = !(el.innerText || '').trim() && !el.classList.contains('film-skip');
    if (isControl) {
      if (r.height < 43.5 || (iconOnly && r.width < 43.5)) out.controls.push(item);
    } else if (!el.closest('p') && r.height < 23.5) out.text.push(item);
  });
  return out;
}
"""

CONTRAST_JS = r"""
() => {
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v)); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
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
  const bad = []; const seen = new Set();
  document.querySelectorAll('main *, footer *').forEach((el) => {
    if (el.closest('[data-film]')) return;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!t) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (el.closest('.sr-only') || el.closest('[aria-hidden=true]')) return;
    const fg = parse(cs.color); if (!fg) return;
    const bg = bgOf(el); if (!bg) return;
    const fgc = fg[3] < 1 ? blend(fg, bg) : fg;
    const r = ratio(fgc, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (r < need - 0.02) {
      const key = t.slice(0, 30) + '|' + cs.color + '|' + size;
      if (seen.has(key)) return; seen.add(key);
      bad.push({ text: t.slice(0, 40), ratio: +r.toFixed(2), need, size });
    }
  });
  return bad;
}
"""

PAGE_JS = r"""
() => ({
  doc_w: document.documentElement.scrollWidth,
  vw: window.innerWidth,
  height: document.documentElement.scrollHeight,
})
"""

CARD_JS = r"""
() => {
  const card = document.querySelector('[data-app-card="trade-timemachine"]');
  if (!card) return { found: false };
  const a = card.querySelector('a[href]');
  const cs = a ? getComputedStyle(a) : null;
  const r = a ? a.getBoundingClientRect() : null;
  const notice = card.querySelector('p');
  return {
    found: true,
    name: (card.querySelector('h3')?.innerText || '').trim(),
    kind: (card.querySelector('span')?.innerText || '').trim(),
    href: a ? a.getAttribute('href') : null,
    abs_href: a ? a.href : null,
    target: a ? a.getAttribute('target') : null,
    rel: a ? a.getAttribute('rel') : null,
    link_h: r ? +r.height.toFixed(1) : null,
    link_w: r ? +r.width.toFixed(1) : null,
    display: cs ? cs.display : null,
    text: (card.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 260),
    img_lines: card.querySelectorAll('svg').length,
  };
}
"""

DETAIL_JS = r"""
() => {
  const notice = document.querySelector('[data-app-notice]');
  const cta = [...document.querySelectorAll('a.btn')].find((a) => (a.innerText || '').includes('앱 열기'));
  return {
    title: document.title,
    h1: (document.querySelector('h1')?.innerText || '').trim(),
    notice: notice ? notice.innerText.trim() : null,
    cta_href: cta ? cta.getAttribute('href') : null,
    cta_target: cta ? cta.getAttribute('target') : null,
    note: (document.querySelector('.note-box')?.innerText || '').replace(/\s+/g, ' ').trim(),
  };
}
"""


def scroll_all(page, step=700, pause=170):
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(120)
    y = 0
    for _ in range(90):
        h = page.evaluate("() => document.documentElement.scrollHeight")
        if y >= h:
            break
        y += step
        page.evaluate(f"() => window.scrollTo(0, {int(y)})")
        page.wait_for_timeout(pause)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(350)


def full_shot(page, path):
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = 'static'; }")
    page.wait_for_timeout(150)
    page.screenshot(path=str(path), full_page=True)
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = ''; }")
    page.wait_for_timeout(100)


def settle_header(page, selector, extra=-72):
    """고정 헤더가 요소를 가리지 않도록 헤더를 흐름 안으로 돌리고, 부드러운 스크롤을 건너뛰어 정확히 맞춘다."""
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = 'static'; }")
    page.evaluate(
        """(s) => {
          const el = document.querySelector(s);
          if (!el) return;
          const top = el.getBoundingClientRect().top + window.scrollY + %d;
          window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
        }"""
        % extra,
        selector,
    )
    page.wait_for_timeout(500)


def crawl_links(page):
    hrefs = page.evaluate(
        "() => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin))"
    )
    uniq = sorted(set(hrefs))
    bad = []
    for href in uniq:
        if href.startswith("mailto:") or "#" in href:
            continue
        try:
            req = urllib.request.Request(href, headers={"User-Agent": "buffetkimz-v9-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status >= 400:
                    bad.append({"url": href, "status": r.status})
        except Exception as e:  # noqa: BLE001
            bad.append({"url": href, "error": str(e)[:80]})
    return len(uniq), bad


def head_ok(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "buffetkimz-v9-check"})
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read(4000).decode("utf-8", "ignore")
            return {"url": url, "status": r.status, "bytes": len(body)}
    except Exception as e:  # noqa: BLE001
        return {"url": url, "error": str(e)[:120]}


def run_viewport(browser, label, width, height):
    ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
    page = ctx.new_page()
    attach(page, label)
    vp = {"width": width, "height": height, "pages": {}}

    # --- 홈 ---
    goto(page, f"{label}-home", "/", wait="load")
    try:
        page.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(900)
    vp["pages"]["home"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }
    if width >= 768:
        vp["contrast"] = page.evaluate(CONTRAST_JS)

    # --- 도구자료실 ---
    goto(page, f"{label}-apps", "/apps")
    vp["pages"]["apps"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
        "cards": page.evaluate("() => [...document.querySelectorAll('[data-app-card]')].map(e => e.dataset.appCard)"),
        "count_text": page.evaluate(
            "() => (document.querySelector('[data-app-count]')?.innerText || '').replace(/\\s+/g, ' ').trim()"
        ),
        "showcase_text": page.evaluate(
            "() => (document.querySelector('[data-app-showcase]')?.innerText || '').replace(/\\s+/g, ' ').trim()"
        ),
    }
    card = page.evaluate(CARD_JS)
    report["apps_card"][label] = card

    if width == 1280:
        full_shot(page, OUT / "desktop-apps-full.png")
    showcase = page.query_selector("[data-app-showcase]")
    if showcase:
        # 섹션이 뷰포트보다 길어 요소 캡처는 위가 잘린다 — 화면에 보이는 그대로(뷰포트)를 찍는다.
        settle_header(page, "[data-app-showcase]")
        page.screenshot(path=str(OUT / f"{label}-apps-showcase.png"))
    card_el = page.query_selector('[data-app-card="trade-timemachine"]')
    if card_el:
        settle_header(page, '[data-app-card="trade-timemachine"]', extra=-120)
        page.screenshot(path=str(OUT / f"{label}-app-card-timemachine.png"))
    else:
        page.screenshot(path=str(OUT / f"{label}-apps-nocard.png"))
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = ''; }")
    page.wait_for_timeout(150)

    # --- 타임머신 상세 ---
    goto(page, f"{label}-tm-detail", "/apps/trade-timemachine")
    detail = page.evaluate(DETAIL_JS)
    report["apps_detail"][label] = detail
    vp["pages"]["tm-detail"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }
    if width == 1280:
        full_shot(page, OUT / "desktop-timemachine-detail.png")
    else:
        page.screenshot(path=str(OUT / f"{label}-timemachine-detail-fold.png"))

    # --- 기존 페이지 회귀 ---
    goto(page, f"{label}-posts", "/posts")
    vp["pages"]["posts"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }

    goto(page, f"{label}-about", "/about")
    vp["pages"]["about"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
        "text": page.evaluate("() => (document.querySelector('main')||document.body).innerText"),
    }

    goto(page, f"{label}-calendar", "/calendar")
    vp["pages"]["calendar"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }

    goto(page, f"{label}-search", "/search")
    vp["pages"]["search"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }

    if width == 1280:
        n, bad = crawl_links(page)
        report["broken_links"] = bad
        check("links", len(bad) == 0, {"checked": n, "bad": bad[:6]})

    ctx.close()
    return vp


def main():
    serve_root = DIST
    if not LIVE:
        if SUBPATH:
            serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v9")
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
        time.sleep(1.4)
    else:
        srv = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
            report["viewport"]["desktop"] = run_viewport(browser, "desktop", 1280, 800)
            report["viewport"]["m390"] = run_viewport(browser, "m390", 390, 844)
            report["viewport"]["m360"] = run_viewport(browser, "m360", 360, 800)
            browser.close()
    finally:
        if srv:
            srv.terminate()

    # ---------- 판정 ----------
    def all_pages():
        return [
            (vp_name, pg_name, data)
            for vp_name, vp in report["viewport"].items()
            for pg_name, data in vp["pages"].items()
        ]

    over = [
        (v, pg, d["overflow"]["doc_w"] - d["overflow"]["vw"])
        for v, pg, d in all_pages()
        if d["overflow"]["doc_w"] > d["overflow"]["vw"] + 1
    ]
    check("overflow", not over, over[:6])

    fonts = [(v, pg, d["font"]) for v, pg, d in all_pages() if d["font"]]
    check("font_12", not fonts, fonts[:4])

    touches = [
        (v, pg, d["touch"]["controls"])
        for v, pg, d in all_pages()
        if d["touch"]["controls"] and report["viewport"][v]["width"] < 768
    ]
    check("touch_44", not touches, [(v, pg, c[:4]) for v, pg, c in touches][:6])

    contrast = report["viewport"]["desktop"].get("contrast") or []
    check("contrast_aa", not contrast, contrast[:6])

    # 카드 — 모든 뷰포트
    cards = report["apps_card"]
    ok_found = len(cards) == 3 and all(c.get("found") for c in cards.values())
    check("timemachine_card_present", ok_found, {k: c.get("found") for k, c in cards.items()})
    ok_name = all(c.get("name") == "한국형 타임머신" for c in cards.values() if c.get("found"))
    check("timemachine_card_name", ok_name, {k: c.get("name") for k, c in cards.items()})
    ok_href = all(
        (c.get("abs_href") or "").rstrip("/") == TIMEMACHINE_URL.rstrip("/")
        for c in cards.values()
        if c.get("found")
    )
    check("timemachine_card_href", ok_href, {k: c.get("abs_href") for k, c in cards.items()})
    ok_blank = all(c.get("target") == "_blank" and "noopener" in (c.get("rel") or "") for c in cards.values() if c.get("found"))
    check("timemachine_card_newtab", ok_blank, {k: (c.get("target"), c.get("rel")) for k, c in cards.items()})
    ok_touch = all((c.get("link_h") or 0) >= 44 for c in cards.values() if c.get("found"))
    check("timemachine_card_touch", ok_touch, {k: c.get("link_h") for k, c in cards.items()})
    ok_notice = all("투자 권유" in (c.get("text") or "") and "통계 시뮬레이터" in (c.get("text") or "") for c in cards.values() if c.get("found"))
    check("timemachine_card_notice", ok_notice, {k: (c.get("text") or "")[-90:] for k, c in cards.items()})
    ok_art = all((c.get("img_lines") or 0) >= 1 for c in cards.values() if c.get("found"))
    check("timemachine_card_art", ok_art, {k: c.get("img_lines") for k, c in cards.items()})

    apps_pages = report["viewport"]["desktop"]["pages"]["apps"]
    check("apps_cards_two", apps_pages["cards"] == ["bojang-counsel-guide", "trade-timemachine"], apps_pages["cards"])
    check(
        "apps_count_label",
        "직접 만든 앱" in apps_pages["count_text"] and "2" in apps_pages["count_text"],
        apps_pages["count_text"],
    )
    check(
        "apps_no_sales_copy",
        not any(k in apps_pages["showcase_text"] for k in ("추천드립니다", "가입하세요", "상담 신청", "수익 보장")),
        apps_pages["showcase_text"][:160],
    )

    # 상세 페이지 — 모든 뷰포트
    details = report["apps_detail"]
    ok_d = len(details) == 3 and all((d.get("h1") or "") == "한국형 타임머신" for d in details.values())
    check("tm_detail_h1", ok_d, {k: d.get("h1") for k, d in details.items()})
    ok_cta = all((d.get("cta_href") or "").rstrip("/") == TIMEMACHINE_URL.rstrip("/") and d.get("cta_target") == "_blank" for d in details.values())
    check("tm_detail_cta", ok_cta, {k: (d.get("cta_href"), d.get("cta_target")) for k, d in details.items()})
    ok_dn = all("투자 권유" in (d.get("notice") or "") for d in details.values())
    check("tm_detail_notice", ok_dn, {k: d.get("notice") for k, d in details.items()})
    ok_note = all("투자 수익" in (d.get("note") or "") for d in details.values())
    check("tm_detail_note_box", ok_note, {k: (d.get("note") or "")[:120] for k, d in details.items()})

    # 외부 앱 URL 실제 응답
    live_tm = head_ok(TIMEMACHINE_URL) if not LIVE else head_ok(TIMEMACHINE_URL)
    report["external"]["trade-timemachine"] = live_tm
    check("timemachine_url_200", live_tm.get("status") == 200, live_tm)
    if not LIVE:
        bj = head_ok(BOJANG_URL)
        report["external"]["bojang-counsel-guide"] = bj
        check("bojang_url_200", bj.get("status") == 200, bj)

    about = report["viewport"]["desktop"]["pages"]["about"]["text"]
    forbidden = ["현장에서", "보험과 금융을 현장", "커리어", "경력"]
    hit = [f for f in forbidden if f in about]
    check("about_copy", not hit and "살다 보면 같은 질문" in about, {"forbidden_hits": hit})

    check("no_http_errors", not report["http_errors"], report["http_errors"])
    errs = [e for e in report["console_errors"] if "favicon" not in e["text"].lower()]
    check("no_console_errors", not errs, errs[:6])

    report["checks"] = checks
    report["failures"] = failures
    report["summary"] = {
        "checks": len(checks),
        "passed": sum(1 for c in checks.values() if c["pass"]),
        "failed": len(failures),
        "pages": len(report["pages"]),
        "screenshots": len(list(OUT.glob("*.png"))),
    }
    (OUT / "verify-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], ensure_ascii=False))
    for f in failures:
        print("FAIL", f["check"], "→", str(f["detail"])[:400])
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
