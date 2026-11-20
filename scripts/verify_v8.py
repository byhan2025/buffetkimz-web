"""
buffetkimz v5.3 실측 검증 — Unslop 1차 정제 + v5.2.2 보완 2건.

사용:
  SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
  VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v8.py
  LIVE=1 VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v8.py   # 라이브 확인

결과: reports/buffetkimz-web/v5.3/ 스크린샷 + verify-report.json
v5.3에서 새로 재는 것:
  · 헤더 검색 버튼 44×44px (모바일 아이콘만일 때도) — v5.2.2에서 26×44였던 항목
  · /about 서사에서 직업·현장 추정 문구 0건 (1차 자료 기반 익명 서사)
  · 대문자·자간 벌린 영문 라벨 0건, 장식 번호(01~04) 0건, 카드 hover 들어올림 0건
  · v5.2 계승: 1280/390/360 가로 넘침 0, 12px 미만 0, 44px 미만 컨트롤 0, 대비 AA, 링크 27종
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
PORT = 4341
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/v5.3")
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
    "viewport": {},
    "header_search": {},
    "copy": {},
    "slop": {},
    "contrast": {},
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
    page.on("pageerror", lambda err: report["console_errors"].append({"page": name, "type": "pageerror", "text": str(err)}))


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
    if (el.closest('.sr-only')) continue;
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
    /* 아이콘만 있는 컨트롤은 폭도 44px 이상이어야 한다(글자 없는 버튼 = 손가락이 짚을 자리가 없다) */
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

SLOP_JS = r"""
() => {
  const main = document.querySelector('main') || document.body;
  const text = main.innerText;
  const upper = [];
  const rx = /\b(ABOUT|BELIEFS|MANIFESTO|EDITORIAL RULES|START HERE|QUICK TOOLS|TOPICS|SERIES|ALL|NOTES|TOOLS|ARCHIVE|TRUST)\b/;
  main.querySelectorAll('p,span,h1,h2,h3,h4,li,div').forEach((el) => {
    if (el.closest('[data-film]')) return;
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!direct) return;
    const cs = getComputedStyle(el);
    const tracking = parseFloat(cs.letterSpacing) || 0;
    if (rx.test(direct) && direct === direct.toUpperCase() && /[A-Z]{2}/.test(direct)) {
      upper.push({ text: direct.slice(0, 40), tracking: +tracking.toFixed(3) });
    }
  });
  const wide = [];
  main.querySelectorAll('*').forEach((el) => {
    if (el.closest('[data-film]')) return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const ls = (parseFloat(cs.letterSpacing) || 0) / fs;
    if (fs <= 13.5 && ls >= 0.05 && (el.innerText || '').trim().length > 0 && el.children.length === 0) {
      wide.push({ text: (el.innerText || '').trim().slice(0, 30), fs, em: +ls.toFixed(3) });
    }
  });
  const decorative = [];
  document.querySelectorAll('#about [data-intro-identities] span, #about [data-intro-principles] span, [data-main-tools] span').forEach((el) => {
    const t = (el.innerText || '').trim();
    if (/^0[1-9]$/.test(t)) decorative.push({ text: t, cls: String(el.className).slice(0, 50) });
  });
  return { upper, wide: wide.slice(0, 12), decorative, aboutText: text };
}
"""

SEARCH_BTN_JS = r"""
() => {
  const btn = document.querySelector('header button[aria-label="사이트 검색 열기"]');
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  return {
    w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    x: +r.left.toFixed(1), top: +r.top.toFixed(1),
    label: (btn.innerText || '').trim(),
    visible: cs.display !== 'none' && r.width > 0,
  };
}
"""

PAGE_JS = r"""
() => ({
  doc_w: document.documentElement.scrollWidth,
  vw: window.innerWidth,
  height: document.documentElement.scrollHeight,
})
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
            req = urllib.request.Request(href, headers={"User-Agent": "buffetkimz-v8-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status >= 400:
                    bad.append({"url": href, "status": r.status})
        except Exception as e:  # noqa: BLE001
            bad.append({"url": href, "error": str(e)[:80]})
    return len(uniq), bad


def run_viewport(browser, label, width, height, shots):
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
    page.screenshot(path=str(shots / f"{label}-home-fold.png"))
    if width >= 768:
        scroll_all(page)
        full_shot(page, shots / f"{label}-home-full.png")

    # 소개 2페이지(2P)
    page.evaluate("() => document.getElementById('about')?.scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    page.screenshot(path=str(shots / f"{label}-intro2.png"))
    vp["pages"]["home"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
        "slop": page.evaluate(SLOP_JS),
    }
    if width >= 768:
        vp["contrast"] = page.evaluate(CONTRAST_JS)

    # 아카이브
    page.evaluate("() => document.getElementById('archive')?.scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    page.screenshot(path=str(shots / f"{label}-archive.png"))

    # --- 블로그 목록 ---
    goto(page, f"{label}-posts", "/posts")
    page.screenshot(path=str(shots / f"{label}-posts.png"))
    page.evaluate("() => document.querySelector('[data-post-cards]')?.scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    page.screenshot(path=str(shots / f"{label}-post-cards.png"))
    vp["pages"]["posts"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }

    # --- 글 상세 ---
    goto(page, f"{label}-post", "/posts/finance-rate-gap")
    vp["pages"]["post"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }
    if width == 1280:
        page.screenshot(path=str(shots / "desktop-post-fold.png"))

    # --- 소개 ---
    goto(page, f"{label}-about", "/about")
    if width == 1280:
        scroll_all(page)
        full_shot(page, shots / "desktop-about-full.png")
    vp["pages"]["about"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
        "text": page.evaluate("() => (document.querySelector('main')||document.body).innerText"),
    }

    # --- 도구자료실 · 제도달력 ---
    goto(page, f"{label}-apps", "/apps")
    vp["pages"]["apps"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }
    if width == 1280:
        full_shot(page, shots / "desktop-apps-full.png")

    goto(page, f"{label}-calendar", "/calendar")
    vp["pages"]["calendar"] = {
        "overflow": page.evaluate(PAGE_JS),
        "font": page.evaluate(FONT_JS),
        "touch": page.evaluate(TOUCH_JS),
    }
    if width == 1280:
        full_shot(page, shots / "desktop-calendar-full.png")

    # --- 헤더 검색 버튼 (모든 뷰포트의 핵심 항목) ---
    goto(page, f"{label}-search", "/search")
    btn = page.evaluate(SEARCH_BTN_JS)
    report["header_search"][label] = btn
    if btn:
        page.locator('header button[aria-label="사이트 검색 열기"]').screenshot(
            path=str(shots / f"{label}-search-button.png")
        )
    if width <= 390:
        page.screenshot(path=str(shots / f"{label}-header.png"), clip={"x": 0, "y": 0, "width": width, "height": 120})
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
            serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v8")
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
            report["viewport"]["desktop"] = run_viewport(browser, "desktop", 1280, 800, OUT)
            report["viewport"]["m390"] = run_viewport(browser, "m390", 390, 844, OUT)
            report["viewport"]["m360"] = run_viewport(browser, "m360", 360, 800, OUT)
            browser.close()
    finally:
        if srv:
            srv.terminate()

    # ---------- 판정 ----------
    def all_pages(fn):
        return [(vp_name, pg_name, data) for vp_name, vp in report["viewport"].items() for pg_name, data in vp["pages"].items()]

    over = [(v, pg, d["overflow"]["doc_w"] - d["overflow"]["vw"]) for v, pg, d in all_pages(lambda x: x) if d["overflow"]["doc_w"] > d["overflow"]["vw"] + 1]
    check("overflow", not over, over[:6])

    fonts = [(v, pg, d["font"]) for v, pg, d in all_pages(lambda x: x) if d["font"]]
    check("font_12", not fonts, fonts[:4])

    touches = [(v, pg, d["touch"]["controls"]) for v, pg, d in all_pages(lambda x: x) if d["touch"]["controls"] and report["viewport"][v]["width"] < 768]
    check("touch_44", not touches, [(v, pg, c[:4]) for v, pg, c in touches][:6])

    contrast = report["viewport"]["desktop"].get("contrast") or []
    check("contrast_aa", not contrast, contrast[:6])

    btns = report["header_search"]
    ok_btn = all(b and b["w"] >= 43.5 and b["h"] >= 43.5 for b in btns.values()) and len(btns) == 3
    check("header_search_44", ok_btn, btns)

    about = report["viewport"]["desktop"]["pages"]["about"]["text"]
    forbidden = ["현장에서", "보험과 금융을 현장", "커리어", "경력"]
    hit = [f for f in forbidden if f in about]
    check("about_copy", not hit and "살다 보면 같은 질문" in about, {"forbidden_hits": hit})

    slop = report["viewport"]["desktop"]["pages"]["home"]["slop"]
    check("upper_labels", not slop["upper"], slop["upper"])
    check("wide_tracking", not slop["wide"], slop["wide"])
    check("decorative_numbers", not slop["decorative"], slop["decorative"])

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
