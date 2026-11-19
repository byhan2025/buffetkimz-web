"""
buffetkimz v5.2 실측 검증 — dist를 로컬 서버로 열어 실제 브라우저로 확인한다.

사용:
  python3 scripts/verify_v7.py                          # 로컬 빌드(dist)
  LIVE=1 python3 scripts/verify_v7.py                    # 라이브(GitHub Pages)
  VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v7.py

결과: reports/buffetkimz-web/v5.2/ 스크린샷 + verify-report.json
확인(v5.2 추가):
  · 모바일 2행 헤더 — 1행 로고·검색·전체메뉴 / 2행 홈·소개·블로그·도구자료실·달력 퀵 탭
    (390·360에서 가로 넘침 0, 각 44px·12.5px, 현재 페이지 활성)
  · 2행 헤더를 합쳐도 1P 첫 화면 CTA [소개 보기][도구 둘러보기]가 스크롤 없이 보임
  · 모든 하위 페이지 상단·하단 '← 홈으로'(44px), 실행 화면은 상단만(하단 요약 바와 안 겹침)
  · 블로그 썸네일 16:10 — 홈 아카이브·/posts·글 상세에서 naturalWidth>0, og:image 연결
  · 11.5px 이하 0건, 44px 미만 컨트롤 0건, 가로 넘침 0px, 대비 AA
확인(v5.1 계승):
  · 1페이지 브랜드 필름 — 웹GL 캔버스, 6장면·12초 타임라인, t=0.5/2.5/5.0/8.5 네 컷의 픽셀 차이
  · prefers-reduced-motion — 정지 1컷 + 정적 록업(자동재생 없음)
  · 2페이지 순수 소개 — 정체성 4·철학 5·편집 원칙 4, 도구·계산기·시뮬레이터 0회
  · 실행 화면 — 퇴직연금 재원 별도과세 안내, 복리 15.4% 단순 예시 문구, 요약 바 문구 전환
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
PORT = 4339
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(os.environ.get("VERIFY_OUT") or "/workspace/reports/buffetkimz-web/v5.2")
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
    "film": {},
    "intro": {},
    "archive": {},
    "trust": {},
    "channels": {},
    "mobile": {},
    "sticky": {},
    "contrast": {},
    "touch": {},
    "copy": {},
    "v52": {},
    "tools": {},
    "console_errors": [],
    "http_errors": [],
    "failed_requests": [],
    "broken_links": [],
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
    page.wait_for_timeout(400)
    report["pages"].append({"name": name, "path": path, "status": resp.status if resp else None})
    if resp and resp.status >= 400:
        report["http_errors"].append({"name": name, "path": path, "status": resp.status})
    return resp


FONT_JS = r"""
() => {
  const bad = [];
  const seen = new Set();
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
    const key = t.slice(0, 20) + '|' + fs + '|' + el.tagName;
    if (fs < 11.99 && !seen.has(key)) {
      seen.add(key);
      bad.push({ t: t.slice(0, 36), fs: +fs.toFixed(2), tag: el.tagName, cls: String(el.className).slice(0, 60) });
    }
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
    const item = { tag: el.tagName, label, h: +r.height.toFixed(1), cls: String(el.className).slice(0, 60) };
    const isControl = el.matches('button,summary,input,select,[role=button]') || el.classList.contains('btn') ||
      el.classList.contains('tab') || el.closest('nav') || el.closest('header') ||
      el.classList.contains('film-btn') || el.classList.contains('film-tick') || el.classList.contains('film-cta') ||
      el.classList.contains('film-credit') || el.classList.contains('fs6-link');
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

# 필름은 배경이 그라디언트+캔버스라 일반 계산에서 빠진다. 상영관 바탕색(#04101a)과 직접 대조한다.
FILM_CONTRAST_JS = r"""
() => {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const stage = parse('rgb(4, 16, 26)');
  const over = (fg, bg) => { const a = fg[3]; return [fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a)]; };
  const out = [];
  const sel = ['.film-hud-line', '.film-hud-brand .serif', '.film-hud-scene .film-mono', '.film-hud-label',
               '.film-btn-text', '.film-timer', '.film-tick-label', '.film-ticks', '.film-cta', '.fs6-link',
               '.fs3-note', '.fs3-foot', '.fs2-line', '.fs5-sub', '.fs5-kicker'];
  const seen = new Set();
  sel.forEach((s) => {
    document.querySelectorAll(s).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.35) return;
      const fg = parse(cs.color);
      if (!fg) return;
      const own = parse(cs.backgroundColor);
      const bg = own && own[3] > 0.01 ? over(own, stage) : stage;
      const r = +ratio([fg[0], fg[1], fg[2]], bg).toFixed(2);
      const label = (el.textContent || '').trim().slice(0, 24);
      const key = s + '|' + label;
      if (seen.has(key)) return;
      seen.add(key);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (r < need - 0.02) out.push({ sel: s, text: label, ratio: r, need, size, color: cs.color, bg: cs.backgroundColor });
    });
  });
  return out;
}
"""

QUICK_JS = r"""
() => {
  const q = (s) => document.querySelector(s);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const inView = (el) => {
    const b = r(el);
    return !!b && b.top >= -1 && b.bottom <= window.innerHeight + 1 && b.width > 0 && b.height > 0;
  };
  const header = q('header');
  const row = q('.site-header-row');
  const quick = q('[data-quick-tabs]');
  const links = [...document.querySelectorAll('.site-quick-link')];
  const lines = (a) => {
    const range = document.createRange();
    range.selectNodeContents(a);
    return range.getClientRects().length;
  };
  return {
    header_h: +r(header).height.toFixed(1),
    header_var: getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim(),
    row_bottom: +r(row).bottom.toFixed(1),
    quick_top: +r(quick).top.toFixed(1),
    quick_border: getComputedStyle(quick).borderTopWidth,
    list_scroll: [quick.scrollWidth, quick.clientWidth],
    tabs: links.map((a) => ({
      text: a.textContent.trim(),
      w: +r(a).width.toFixed(1),
      h: +r(a).height.toFixed(1),
      fs: parseFloat(getComputedStyle(a).fontSize),
      sw: a.scrollWidth,
      cw: a.clientWidth,
      active: a.dataset.active,
      current: a.getAttribute('aria-current'),
      text_lines: lines(a),
    })),
    active_count: links.filter((a) => a.dataset.active === 'true').length,
    active_label: (links.find((a) => a.dataset.active === 'true') || {}).textContent || '',
    doc_w: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    nav_labels: [...document.querySelectorAll('header nav[aria-label="주 메뉴"] a')].map((a) => a.textContent.trim()),
    slogan: (q('.film-hud-line') || {}).textContent || '',
    slogan_visible: inView(q('.film-hud-line')),
    ctas: [...document.querySelectorAll('.film-cta')].map((a) => ({
      text: a.textContent.trim(),
      h: +r(a).height.toFixed(1),
      visible: inView(a),
    })),
  };
}
"""

PILL_JS = r"""
() => {
  const pills = [...document.querySelectorAll('[data-home-pill]')];
  return {
    count: pills.length,
    items: pills.map((p) => {
      const a = p.querySelector('a');
      const b = a.getBoundingClientRect();
      return {
        pos: p.dataset.homePill,
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        h: +b.height.toFixed(1),
        w: +b.width.toFixed(1),
        top: +b.top.toFixed(1),
        bottom: +b.bottom.toFixed(1),
      };
    }),
    sticky_top: (() => {
      const bar = document.querySelector('[data-sticky-summary]');
      return bar ? +bar.getBoundingClientRect().top.toFixed(1) : null;
    })(),
  };
}
"""

THUMB_JS = r"""
() => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => (i.getAttribute('src') || '').includes('/thumbs/'));
  const boxes = imgs.map((i) => {
    const b = i.getBoundingClientRect();
    return { src: i.getAttribute('src'), nw: i.naturalWidth, w: +b.width.toFixed(1), h: +b.height.toFixed(1), alt: i.alt.slice(0, 40) };
  });
  return {
    count: imgs.length,
    loaded: boxes.filter((b) => b.nw > 0).length,
    unloaded: boxes.filter((b) => b.nw === 0).map((b) => b.src),
    ratios: boxes.filter((b) => b.nw > 0 && b.h > 0).map((b) => +(b.w / b.h).toFixed(2)),
    srcs: [...new Set(boxes.map((b) => b.src))],
    og: (document.querySelector('meta[property="og:image"]') || {}).content || '',
  };
}
"""


def png_diff(a: pathlib.Path, b: pathlib.Path):
    """두 PNG의 평균 절대 차이(0~255)와 다른 픽셀 비율 — 장면이 실제로 바뀌었는지."""
    try:
        from PIL import Image, ImageChops
    except Exception:  # noqa: BLE001
        return None
    ia = Image.open(a).convert("RGB")
    ib = Image.open(b).convert("RGB")
    if ia.size != ib.size:
        return {"error": "size-mismatch"}
    diff = ImageChops.difference(ia, ib)
    g = diff.convert("L")
    hist = g.histogram()
    total = ia.size[0] * ia.size[1]
    changed = sum(hist[8:])
    mean = sum(i * h for i, h in enumerate(hist)) / total
    return {"mean_abs": round(mean, 2), "changed_ratio": round(changed / total, 4)}


def element_shot(page, selector, path):
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.visibility = 'hidden'; }")
    page.wait_for_timeout(120)
    page.locator(selector).screenshot(path=path)
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.visibility = ''; }")
    page.wait_for_timeout(80)


def full_shot(page, path):
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = 'static'; }")
    page.wait_for_timeout(150)
    page.screenshot(path=path, full_page=True)
    page.evaluate("() => { const h = document.querySelector('header'); if (h) h.style.position = ''; }")
    page.wait_for_timeout(100)


def scroll_all(page, step=700, pause=170):
    """느린 이미지(lazy)를 끝까지 내려 모두 읽게 한 뒤 맨 위로 돕니다."""
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(120)
    y = 0
    for _ in range(80):
        h = page.evaluate("() => document.documentElement.scrollHeight")
        if y >= h:
            break
        y += step
        page.evaluate(f"() => window.scrollTo(0, {y})")
        page.wait_for_timeout(pause)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(350)


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
            req = urllib.request.Request(href, headers={"User-Agent": "buffetkimz-v6-check"})
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
            serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v6")
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
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
            page = ctx.new_page()
            attach(page, "desktop")

            # ---------------- 홈 · 필름 ----------------
            goto(page, "home", "/", wait="load")
            page.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            page.wait_for_timeout(600)

            page.screenshot(path=str(OUT / ("live-film-fold.png" if LIVE else "film-fold.png")))

            film = page.evaluate(
                r"""
                () => {
                  const root = document.querySelector('[data-film]');
                  const stage = document.querySelector('[data-film-stage]');
                  const canvas = document.querySelector('.film-canvas');
                  const gl = canvas ? (canvas.getContext('webgl2') || canvas.getContext('webgl')) : null;
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  const inView = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 0 && r.height > 0;
                  };
                  const cta = [...document.querySelectorAll('.film-cta')];
                  return {
                    present: !!root,
                    state: root ? root.dataset.filmState : null,
                    scene: root ? root.dataset.sceneActive : null,
                    total: window.__bkFilm ? window.__bkFilm.total : null,
                    scenes: window.__bkFilm ? window.__bkFilm.scenes.length : 0,
                    stage_h: stage ? Math.round(stage.getBoundingClientRect().height) : 0,
                    viewport_h: window.innerHeight,
                    canvas: !!canvas,
                    gl: !!gl,
                    glVersion: gl ? gl.getParameter(gl.VERSION) : null,
                    ticks: document.querySelectorAll('[data-film-jump]').length,
                    hud_line: txt(document.querySelector('.film-hud-line')),
                    hud_line_visible: inView(document.querySelector('.film-hud-line')),
                    brand_visible: inView(document.querySelector('.film-hud-brand .serif')),
                    ctas: cta.map((a) => ({ text: txt(a), href: a.getAttribute('href'), visible: inView(a), h: Math.round(a.getBoundingClientRect().height) })),
                    static_hidden: getComputedStyle(document.querySelector('[data-film-static]')).visibility,
                    h1: document.querySelector('h1') ? document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim() : '',
                    h1_sr: !!document.querySelector('h1.sr-only'),
                    timer: txt(document.querySelector('[data-film-timer]')),
                    toggle: document.querySelector('[data-film-toggle]') ? document.querySelector('[data-film-toggle]').getAttribute('aria-label') : null,
                    skip_href: document.querySelector('.film-skip') ? document.querySelector('.film-skip').getAttribute('href') : null,
                    stage_top: stage ? Math.round(stage.getBoundingClientRect().top) : null,
                    scroll_y: window.scrollY,
                  };
                }
                """
            )
            report["film"] = film
            check("film.present", film["present"] and film["scenes"] == 6 and film["total"] == 12, film)
            check("film.autoplay", film["state"] == "playing", film["state"])
            check("film.canvas_webgl", film["canvas"] and film["gl"], {"canvas": film["canvas"], "gl": film["glVersion"]})
            check("film.full_viewport", film["stage_h"] >= film["viewport_h"] - 90, film["stage_h"])
            check("film.ticks_6", film["ticks"] == 6, film["ticks"])
            check("film.static_hidden", film["static_hidden"] == "hidden", film["static_hidden"])
            check("film.hud_brand_line_visible", film["hud_line_visible"] and "숫자를 확인하고" in film["hud_line"], film["hud_line"])
            check(
                "film.first_screen_ctas",
                len(film["ctas"]) == 2 and all(c["visible"] and c["h"] >= 43.5 for c in film["ctas"]),
                film["ctas"],
            )
            check("film.h1", "숫자 너머의 기준" in film["h1"] and "buffetkimz" in film["h1"] and film["h1_sr"], film["h1"])
            check("film.skip_to_about", film["skip_href"] == "#about", film["skip_href"])

            # 장면 4컷 — 다른 시간대를 실제로 찍고 픽셀 차이를 잰다
            shots = {}
            expect = {0.5: (1, ""), 2.5: (2, ""), 5.0: (3, "시간이 만드는 차이"), 8.5: (5, "숫자 너머의 기준")}
            for t in (0.5, 2.5, 5.0, 8.5):
                page.evaluate(f"() => window.__bkFilm.seek({t})")
                page.wait_for_timeout(320)
                path = OUT / f"film-t{t}.png"
                page.screenshot(path=str(path))
                shots[t] = path
                st = page.evaluate(
                    r"""
                    () => {
                      const root = document.querySelector('[data-film]');
                      const sec = document.querySelector(`[data-scene="${root.dataset.sceneActive}"]`);
                      const vis = [...document.querySelectorAll('.film-scene')].filter((s) => {
                        const cs = getComputedStyle(s);
                        return cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.2;
                      }).map((s) => s.dataset.scene);
                      return {
                        scene: root.dataset.sceneActive,
                        state: root.dataset.filmState,
                        head: document.querySelector('.film-hud-scene .film-mono').textContent.trim(),
                        visible: vis,
                        text: sec ? sec.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
                        timer: document.querySelector('[data-film-timer]').textContent.trim(),
                        progress: document.querySelector('[data-film-progress]').style.transform,
                      };
                    }
                    """
                )
                report["film"][f"t{t}"] = st
                want_scene, want_text = expect[t]
                ok = st["scene"] == str(want_scene) and st["timer"].startswith(f"00:0{int(t)}.{int(round((t % 1) * 10))}")
                if want_text:
                    ok = ok and want_text in st["text"]
                check(f"film.t{t}_scene", ok, st)

            diffs = {}
            pairs = [(0.5, 2.5), (2.5, 5.0), (5.0, 8.5)]
            for a, b in pairs:
                d = png_diff(shots[a], shots[b])
                diffs[f"{a}->{b}"] = d
            report["film"]["frame_diffs"] = diffs
            check(
                "film.frames_differ",
                bool(diffs) and all(d and d.get("mean_abs", 0) > 6 and d.get("changed_ratio", 0) > 0.06 for d in diffs.values()),
                diffs,
            )

            # seek 직후는 정지 — 시간이 멈춘다 / 재생 → 다시 흐른다 / 다시 누르면 정지
            page.evaluate("() => window.__bkFilm.seek(2.0)")
            page.wait_for_timeout(200)
            t1 = page.evaluate("() => document.querySelector('[data-film-timer]').textContent.trim()")
            page.wait_for_timeout(700)
            t2 = page.evaluate("() => document.querySelector('[data-film-timer]').textContent.trim()")
            paused_state = page.evaluate("() => document.querySelector('[data-film]').dataset.filmState")
            check("film.seek_freezes", paused_state == "paused" and t1 == t2, {"state": paused_state, "t1": t1, "t2": t2})

            page.click("[data-film-toggle]")
            page.wait_for_timeout(900)
            t3 = page.evaluate("() => document.querySelector('[data-film-timer]').textContent.trim()")
            playing_state = page.evaluate("() => document.querySelector('[data-film]').dataset.filmState")
            check("film.play_resumes", playing_state == "playing" and t3 != t2, {"state": playing_state, "before": t2, "after": t3})

            page.click("[data-film-toggle]")
            page.wait_for_timeout(150)
            t4 = page.evaluate("() => document.querySelector('[data-film-timer]').textContent.trim()")
            page.wait_for_timeout(600)
            t5 = page.evaluate("() => document.querySelector('[data-film-timer]').textContent.trim()")
            frozen_state = page.evaluate("() => document.querySelector('[data-film]').dataset.filmState")
            check("film.pause_button_freezes", frozen_state == "paused" and t4 == t5, {"state": frozen_state, "t4": t4, "t5": t5})

            # 장면 인디케이터 → 6초(4번째 장면)로 이동
            page.click('[data-film-jump="4"]')
            page.wait_for_timeout(300)
            jump = page.evaluate(
                "() => ({ scene: document.querySelector('[data-film]').dataset.sceneActive, timer: document.querySelector('[data-film-timer]').textContent.trim() })"
            )
            check("film.tick_jump", jump["scene"] == "4" and jump["timer"].startswith("00:06.0"), jump)

            # 텍스트 충돌·플래시 상한
            flash = page.evaluate(
                r"""
                () => {
                  const el = document.querySelector('[data-fs5-flash]');
                  window.__bkFilm.seek(7.9);
                  const mid = getComputedStyle(el).opacity;
                  return { peak: parseFloat(mid), bg: getComputedStyle(el).backgroundImage.slice(0, 60) };
                }
                """
            )
            report["film"]["flash"] = flash
            check("film.no_fullscreen_flash", flash["peak"] <= 0.55, flash)

            film_contrast = page.evaluate(FILM_CONTRAST_JS)
            report["contrast"]["film"] = film_contrast
            check("contrast.film_aa", len(film_contrast) == 0, film_contrast[:6])

            # 프레임 레이트(소프트웨어 렌더 환경 기준) · 타임라인 실시간 진행
            fps = page.evaluate(
                r"""
                () => new Promise((resolve) => {
                  window.__bkFilm.play();
                  let frames = 0;
                  const start = performance.now();
                  const step = () => {
                    frames++;
                    if (performance.now() - start < 1200) requestAnimationFrame(step);
                    else resolve({ fps: Math.round((frames / (performance.now() - start)) * 1000) });
                  };
                  requestAnimationFrame(step);
                })
                """
            )
            report["film"]["fps"] = fps
            check("film.fps_headless", fps["fps"] >= 30, fps)

            page.evaluate("() => window.__bkFilm.pause()")
            page.wait_for_timeout(200)

            # ---------------- 첫 화면 전체(스크롤 없음) ----------------
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(200)
            page.screenshot(path=str(OUT / "desktop-home-fold.png"))
            full_shot(page, str(OUT / ("live-home-full.png" if LIVE else "desktop-home-full.png")))

            home = page.evaluate(
                r"""
                () => {
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  const secs = [...document.querySelectorAll('main > section')];
                  const fav = document.querySelector('link[rel="icon"]');
                  return {
                    height: document.documentElement.scrollHeight,
                    areas: secs.map((s) => ({ area: s.getAttribute('data-area'), bg: getComputedStyle(s).backgroundColor, h: Math.round(s.getBoundingClientRect().height) })),
                    favicon: fav ? fav.getAttribute('href') : null,
                    credits: document.querySelectorAll('.film-credit').length,
                    contact: (() => { const a = document.querySelector('[data-contact-banner] a[href*="pf.kakao.com"]'); return a ? { cls: a.className, href: a.getAttribute('href') } : null; })(),
                    contact_disclaimer: txt(document.querySelector('[data-contact-banner]')).includes('가입 권유·중개가 아닌 일반 안내'),
                    accent_cards: document.querySelectorAll('.accent-card').length,
                  };
                }
                """
            )
            report["home"] = home
            check("home.http_ok", all(p["status"] == 200 for p in report["pages"]), report["pages"])
            check("home.areas_6", [a["area"] for a in home["areas"]] == ["1", "2", "3", "4", "5", "6"], home["areas"])
            check("home.credits_4", home["credits"] == 4, home["credits"])
            check("home.favicon_svg", bool(home["favicon"] and "favicon.svg" in home["favicon"]), home["favicon"])
            check("home.contact_link", bool(home["contact"] and home["contact"]["href"] == "https://pf.kakao.com/_UxkVxnn/chat"), home["contact"])
            check("home.contact_disclaimer", home["contact_disclaimer"], home["contact_disclaimer"])
            check("home.accent_card_one", home["accent_cards"] == 1, home["accent_cards"])

            # ---------------- 2페이지 순수 소개 ----------------
            intro = page.evaluate(
                r"""
                () => {
                  const sec = document.querySelector('[data-area="2"]');
                  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
                  const text = txt(sec);
                  const count = (w) => (text.match(new RegExp(w, 'g')) || []).length;
                  return {
                    identities: sec.querySelectorAll('[data-intro-identities] > li').length,
                    beliefs: sec.querySelectorAll('[data-intro-beliefs] > li').length,
                    principles: sec.querySelectorAll('[data-intro-principles] > li').length,
                    why: !!sec.querySelector('[data-intro-why]'),
                    h2: txt(sec.querySelector('h2')),
                    fields: [...sec.querySelectorAll('[data-intro-beliefs] > li')].map((li) => txt(li.querySelector('span'))),
                    tool_words: { 도구: count('도구'), 계산기: count('계산기'), 시뮬레이터: count('시뮬레이터'), 앱: count('앱') },
                    height: Math.round(sec.getBoundingClientRect().height),
                    text_len: text.length,
                  };
                }
                """
            )
            report["intro"] = intro
            check("intro.identities_4", intro["identities"] == 4, intro["identities"])
            check("intro.beliefs_5", intro["beliefs"] == 5, intro["fields"])
            check("intro.principles_4", intro["principles"] == 4, intro["principles"])
            check("intro.why_space", intro["why"], intro["why"])
            check("intro.no_tool_mention", all(v == 0 for v in intro["tool_words"].values()), intro["tool_words"])
            check("intro.h2_identity", "숫자를 먼저 확인하고" in intro["h2"], intro["h2"])

            # ---------------- 아카이브 ----------------
            archive = page.evaluate(
                r"""
                () => {
                  const sec = document.querySelector('[data-area="3"]');
                  return {
                    topics: document.querySelectorAll('[data-topic-grid] > li').length,
                    series: document.querySelectorAll('[data-series-grid] > li').length,
                    first_reads: document.querySelectorAll('[data-first-reads] > li').length,
                    quick_calcs: document.querySelectorAll('[data-quick-calcs] > li').length,
                    recent: document.querySelectorAll('[data-recent-strip] li').length,
                    height: sec ? Math.round(sec.getBoundingClientRect().height) : 0,
                  };
                }
                """
            )
            report["archive"] = archive
            check("archive.topics", archive["topics"] >= 7, archive["topics"])
            check("archive.series_6", archive["series"] == 6, archive["series"])
            check("archive.first_reads_3", archive["first_reads"] == 3, archive["first_reads"])
            check("archive.quick_calcs_3", archive["quick_calcs"] == 3, archive["quick_calcs"])

            # ---------------- 신뢰·채널 ----------------
            trust = page.evaluate(
                r"""
                () => ({
                  sources: document.querySelectorAll('[data-source-list] > li').length,
                  stats: document.querySelectorAll('[data-trust-stats] .trust-stat').length,
                  calendar: document.querySelectorAll('[data-calendar-strip] li').length,
                })
                """
            )
            report["trust"] = trust
            check("trust.sources_5", trust["sources"] == 5, trust["sources"])
            check("trust.stats_4", trust["stats"] == 4, trust["stats"])
            check("trust.calendar_3", trust["calendar"] == 3, trust["calendar"])

            channels = page.evaluate(
                r"""
                () => ({
                  count: document.querySelectorAll('[data-channel-list] > li[data-channel]').length,
                  grid: document.querySelectorAll('[data-channel-list] > li').length,
                })
                """
            )
            report["channels"] = channels
            check("channels.7", channels["count"] == 7, channels)

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

            n_links, bad_links = crawl_links(page)
            report["links"] = {"checked": n_links, "failed": bad_links}
            check("links.all_200", len(bad_links) == 0, bad_links[:6])

            body_text = page.evaluate("() => document.body.innerText")
            banned = ["세금 0원", "수익 보장", "원금 보장", "확정 수익", "100% 보장", "무조건", "최고 수익", "가입하세요", "지금 가입"]
            hits = {w: body_text.count(w) for w in banned if w in body_text}
            report["copy"]["banned_hits"] = hits
            check("copy.no_marketing_claims", all(k == "무조건" for k in hits) and hits.get("무조건", 0) <= 1, hits)
            fam = [w for w in ["아내", "딸", "아들", "자녀", "3인가족"] if re.search(r"(?<![가-힣])" + w + r"(?![가-힣])", body_text)]
            check("copy.no_family_detail", not fam, fam)

            # ---------------- 실행 화면 문구 ----------------
            goto(page, "run-retirement", "/apps/retirement-flow/run")
            ret = page.evaluate(
                r"""
                () => {
                  const el = document.querySelector('[data-retirement-tax]');
                  const note = document.querySelector('[data-sticky-note]');
                  return {
                    tax: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
                    sticky: note ? note.textContent.trim() : null,
                  };
                }
                """
            )
            report["tools"]["retirement"] = ret
            check("retirement.dc_source_note", "퇴직급여 재원 제외 여부를 확인" in ret["tax"], ret["tax"][:400])
            check("sticky.default_example", bool(ret["sticky"] and "예시 가정" in ret["sticky"]), ret["sticky"])

            # 슬라이더를 움직이면 문구가 '현재 입력 기준'으로 바뀐다
            age = page.locator('input[type="range"]').first
            age.focus()
            age.press("End")
            page.wait_for_timeout(500)
            sticky_after = page.evaluate("() => document.querySelector('[data-sticky-note]').textContent.trim()")
            report["tools"]["retirement_sticky_after"] = sticky_after
            check(
                "sticky.current_input_note",
                "현재 입력 기준" in sticky_after and "2026-11-19" in sticky_after,
                sticky_after,
            )

            goto(page, "run-compound", "/apps/compound-return/run")
            tax = page.evaluate(
                "() => { const el = document.querySelector('[data-tax-basis]'); return el ? el.innerText.replace(/\\s+/g,' ').trim() : ''; }"
            )
            report["tools"]["compound_tax"] = tax
            check(
                "compound.tax_simple_example",
                "15.4%" in tax and "이자·배당소득" in tax and "단순 적용한 예시" in tax and "매매차익" in tax,
                tax,
            )
            full_shot(page, str(OUT / ("live-run-compound-return.png" if LIVE else "desktop-run-compound-return.png")))

            # ---------------- 모바일 390 ----------------
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True)
            m = mctx.new_page()
            attach(m, "mobile390")
            goto(m, "home-m390", "/", wait="load")
            m.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            m.wait_for_timeout(500)
            m.evaluate("() => window.__bkFilm.seek(2.5)")
            m.wait_for_timeout(400)
            m.screenshot(path=str(OUT / ("live-mobile390-film.png" if LIVE else "mobile390-film.png")))
            mhome = m.evaluate(
                r"""
                () => {
                  const inView = (el) => {
                    if (!el) return false;
                    const r = el.getBoundingClientRect();
                    return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 0;
                  };
                  const cta = [...document.querySelectorAll('.film-cta')];
                  return {
                    hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    height: document.documentElement.scrollHeight,
                    stage_h: Math.round(document.querySelector('[data-film-stage]').getBoundingClientRect().height),
                    canvas_2d: (() => {
                      const c = document.querySelector('.film-canvas');
                      if (!c) return false;
                      const ctx = c.getContext('2d');
                      if (!ctx) return false;
                      const x = Math.round(c.width * 0.25);
                      const y = Math.round(c.height * 0.25);
                      const d = ctx.getImageData(x, y, Math.round(c.width * 0.5), Math.round(c.height * 0.5)).data;
                      let on = 0;
                      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) on++;
                      return { painted: on > 200, lit: on, size: [c.width, c.height] };
                    })(),
                    ctas_visible: cta.filter(inView).length,
                    cta_heights: cta.map((a) => Math.round(a.getBoundingClientRect().height)),
                    hud_line: document.querySelector('.film-hud-line') ? inView(document.querySelector('.film-hud-line')) : false,
                    tick_label_hidden: [...document.querySelectorAll('.film-tick-label')].every((el) => getComputedStyle(el).display === 'none'),
                  };
                }
                """
            )
            report["mobile"]["m390"] = mhome
            check("mobile390.no_hscroll", mhome["hscroll"] <= 1, mhome)
            check("mobile390.ctas_visible", mhome["ctas_visible"] == 2 and min(mhome["cta_heights"]) >= 44, mhome["cta_heights"])
            check("mobile390.hud_line", mhome["hud_line"], mhome["hud_line"])
            check("mobile390.canvas2d_painted", bool(mhome["canvas_2d"] and mhome["canvas_2d"]["painted"]), mhome["canvas_2d"])
            small = m.evaluate(FONT_JS)
            report["mobile"]["m390_small"] = small
            check("mobile390.min_12px", len(small) == 0, small[:8])
            touch = m.evaluate(TOUCH_JS)
            report["touch"]["m390"] = touch
            check("mobile390.controls_44", len(touch["controls"]) == 0, touch["controls"][:8])
            contrast = m.evaluate(CONTRAST_JS)
            report["contrast"]["m390"] = contrast
            check("mobile390.contrast_aa", len(contrast) == 0, contrast[:8])

            m.evaluate("() => window.scrollTo(0, document.querySelector('#about').offsetTop - 70)")
            m.wait_for_timeout(400)
            m.screenshot(path=str(OUT / "mobile390-intro.png"))
            full_shot(m, str(OUT / "mobile390-home-full.png"))

            # 모바일 실행 화면 요약 바
            goto(m, "run-retirement-m390", "/apps/retirement-flow/run")
            sticky = m.evaluate(
                r"""
                () => {
                  const bar = document.querySelector('[data-sticky-summary]');
                  const note = document.querySelector('[data-sticky-note]');
                  return {
                    bar_h: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
                    note: note ? note.textContent.trim() : null,
                  };
                }
                """
            )
            report["sticky"]["m390"] = sticky
            check("sticky.present_m390", sticky["bar_h"] >= 60, sticky)
            check("sticky.note_example_m390", bool(sticky["note"] and "예시 가정" in sticky["note"]), sticky)

            # ---------------- 모바일 360 ----------------
            sctx = browser.new_context(viewport={"width": 360, "height": 780}, locale="ko-KR", is_mobile=True, has_touch=True)
            s = sctx.new_page()
            attach(s, "mobile360")
            goto(s, "home-m360", "/", wait="load")
            s.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            s.wait_for_timeout(500)
            s.evaluate("() => window.__bkFilm.seek(8.5)")
            s.wait_for_timeout(400)
            s.screenshot(path=str(OUT / "mobile360-film.png"))
            shome = s.evaluate(
                "() => ({ hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, height: document.documentElement.scrollHeight })"
            )
            report["mobile"]["m360"] = shome
            check("mobile360.no_hscroll", shome["hscroll"] <= 1, shome)
            small = s.evaluate(FONT_JS)
            check("mobile360.min_12px", len(small) == 0, small[:6])
            contrast = s.evaluate(CONTRAST_JS)
            check("mobile360.contrast_aa", len(contrast) == 0, contrast[:6])
            full_shot(s, str(OUT / "mobile360-home-full.png"))

            # ---------------- v5.2 — 모바일 2행 헤더 · 퀵 탭 · 첫 화면 CTA ----------------
            def quick_probe(pg, path, name):
                goto(pg, name, path, wait="load")
                pg.wait_for_timeout(1100)
                return pg.evaluate(QUICK_JS)

            vctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True)
            v = vctx.new_page()
            attach(v, "v52-390")
            quick390 = quick_probe(v, "/", "v52-home-390")
            report["v52"]["quick390"] = quick390
            check(
                "v52.header_two_rows_390",
                100 <= quick390["header_h"] <= 112 and quick390["quick_top"] >= quick390["row_bottom"] - 0.5,
                {"h": quick390["header_h"], "row_bottom": quick390["row_bottom"], "quick_top": quick390["quick_top"]},
            )
            labels = [x["text"] for x in quick390["tabs"]]
            check("v52.quick_tabs_labels", labels == ["홈", "소개", "블로그", "도구자료실", "달력"], labels)
            check(
                "v52.quick_tabs_no_scroll_390",
                quick390["list_scroll"][0] <= quick390["list_scroll"][1] + 1
                and all(x["sw"] <= x["cw"] + 1 for x in quick390["tabs"]),
                {"list": quick390["list_scroll"], "tabs": [(x["text"], x["sw"], x["cw"]) for x in quick390["tabs"]]},
            )
            check("v52.quick_tabs_single_line", all(x["text_lines"] == 1 for x in quick390["tabs"]), [(x["text"], x["text_lines"]) for x in quick390["tabs"]])
            check("v52.quick_tabs_size", all(x["h"] >= 43.5 and x["fs"] >= 12 for x in quick390["tabs"]), [(x["text"], x["h"], x["fs"]) for x in quick390["tabs"]])
            check("v52.quick_tabs_active_390", quick390["active_count"] == 1 and quick390["active_label"] == "홈", {"n": quick390["active_count"], "label": quick390["active_label"]})
            check("v52.no_hscroll_390", quick390["doc_w"] - quick390["vw"] <= 1, quick390["doc_w"] - quick390["vw"])
            check("v52.first_screen_cta_390", len(quick390["ctas"]) == 2 and all(c["visible"] and c["h"] >= 43.5 for c in quick390["ctas"]), quick390["ctas"])
            check("v52.slogan_390", "숫자를 확인하고, 기록으로 남깁니다" in quick390["slogan"] and quick390["slogan_visible"], quick390["slogan"])
            v.screenshot(path=str(OUT / "v52-m390-home-fold.png"))

            for path, expect, name in [("/posts/", "블로그", "v52-posts-390"), ("/apps/", "도구자료실", "v52-apps-390")]:
                g = quick_probe(v, path, name)
                report["v52"][f"active_{expect}"] = {"label": g["active_label"], "count": g["active_count"]}
                check(f"v52.quick_active_{expect}", g["active_count"] == 1 and g["active_label"] == expect, {"label": g["active_label"], "count": g["active_count"]})

            tctx = browser.new_context(viewport={"width": 360, "height": 640}, locale="ko-KR", is_mobile=True, has_touch=True)
            t = tctx.new_page()
            attach(t, "v52-360")
            quick360 = quick_probe(t, "/", "v52-home-360")
            report["v52"]["quick360"] = quick360
            check(
                "v52.quick_tabs_no_scroll_360",
                quick360["list_scroll"][0] <= quick360["list_scroll"][1] + 1
                and all(x["sw"] <= x["cw"] + 1 and x["text_lines"] == 1 for x in quick360["tabs"]),
                [(x["text"], x["sw"], x["cw"], x["text_lines"]) for x in quick360["tabs"]],
            )
            check("v52.quick_tabs_size_360", all(x["h"] >= 43.5 and x["fs"] >= 12 for x in quick360["tabs"]), [(x["text"], x["h"], x["fs"]) for x in quick360["tabs"]])
            check("v52.no_hscroll_360", quick360["doc_w"] - quick360["vw"] <= 1, quick360["doc_w"] - quick360["vw"])
            check("v52.first_screen_cta_360", len(quick360["ctas"]) == 2 and all(c["visible"] and c["h"] >= 43.5 for c in quick360["ctas"]), quick360["ctas"])
            check("v52.slogan_360", "숫자를 확인하고" in quick360["slogan"], quick360["slogan"])
            t.screenshot(path=str(OUT / "v52-m360-home-fold.png"))

            subs = [
                ("/posts/", True),
                ("/posts/pension-tax-order/", True),
                ("/apps/", True),
                ("/apps/coverage-check/", True),
                ("/calendar/", True),
                ("/about/", True),
                ("/search/", True),
                ("/privacy/", True),
                ("/terms/", True),
            ]
            pill_rows = []
            for path, need_bottom in subs:
                goto(v, "pill" + path, path, wait="load")
                v.wait_for_timeout(300)
                info = v.evaluate(PILL_JS)
                tops = [i for i in info["items"] if i["pos"] == "top"]
                bots = [i for i in info["items"] if i["pos"] == "bottom"]
                pill_rows.append({"path": path, "top": tops[:1], "bottom": bots[:1], "count": info["count"]})
                ok = (
                    len(tops) == 1
                    and tops[0]["h"] >= 43.5
                    and tops[0]["text"].endswith("홈으로")
                    and tops[0]["href"].startswith(PREFIX + "/")
                    and tops[0]["top"] <= 340
                )
                ok = ok and (not need_bottom or (len(bots) == 1 and bots[0]["h"] >= 43.5))
                check(f"v52.home_pill{path}", ok, {"top": tops[:1], "bottom": bots[:1], "count": info["count"]})
            report["v52"]["pills"] = pill_rows

            goto(v, "v52-run", "/apps/retirement-flow/run", wait="load")
            v.wait_for_timeout(900)
            runp = v.evaluate(PILL_JS)
            report["v52"]["run"] = runp
            check("v52.run_pill_top_only", runp["count"] == 1 and runp["items"][0]["pos"] == "top" and runp["items"][0]["h"] >= 43.5, runp)
            check(
                "v52.run_pill_no_sticky_overlap",
                runp["sticky_top"] is None or runp["items"][0]["bottom"] < runp["sticky_top"],
                {"pill_bottom": runp["items"][0]["bottom"], "sticky_top": runp["sticky_top"]},
            )
            small_run = v.evaluate(FONT_JS)
            check("v52.run_min_12px", len(small_run) == 0, small_run[:5])
            v.screenshot(path=str(OUT / "v52-m390-run-top.png"))

            goto(v, "v52-posts", "/posts/", wait="load")
            scroll_all(v)
            thumbs_posts = v.evaluate(THUMB_JS)
            report["v52"]["thumb_posts"] = {k: thumbs_posts[k] for k in ("count", "loaded", "unloaded", "ratios")}
            check("v52.thumbs_posts_count", thumbs_posts["count"] >= 12, thumbs_posts["count"])
            check("v52.thumbs_posts_loaded", thumbs_posts["loaded"] == thumbs_posts["count"] and not thumbs_posts["unloaded"], thumbs_posts["unloaded"][:5])
            check("v52.thumbs_posts_ratio", all(1.55 <= x <= 1.65 for x in thumbs_posts["ratios"]), thumbs_posts["ratios"][:6])
            v.screenshot(path=str(OUT / "v52-m390-posts-cards.png"))
            small_posts = v.evaluate(FONT_JS)
            check("v52.posts_min_12px", len(small_posts) == 0, small_posts[:5])

            goto(v, "v52-home-thumbs", "/", wait="load")
            v.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            scroll_all(v)
            thumbs_home = v.evaluate(THUMB_JS)
            report["v52"]["thumb_home"] = {k: thumbs_home[k] for k in ("count", "loaded", "unloaded", "ratios")}
            check(
                "v52.thumbs_home",
                thumbs_home["count"] >= 6
                and thumbs_home["loaded"] == thumbs_home["count"]
                and all(1.55 <= x <= 1.65 for x in thumbs_home["ratios"]),
                {"count": thumbs_home["count"], "loaded": thumbs_home["loaded"], "ratios": thumbs_home["ratios"][:8]},
            )

            # 분야 페이지 — 7대 주제 대표이미지
            goto(v, "v52-category", "/posts/insurance/", wait="load")
            v.wait_for_timeout(600)
            cat_thumb = v.evaluate(THUMB_JS)
            report["v52"]["category"] = {k: cat_thumb[k] for k in ("count", "loaded", "ratios", "srcs")}
            check(
                "v52.category_thumb",
                cat_thumb["count"] >= 1
                and cat_thumb["loaded"] == cat_thumb["count"]
                and "/thumbs/topic-" in (cat_thumb["srcs"][0] if cat_thumb["srcs"] else "")
                and all(1.55 <= x <= 1.65 for x in cat_thumb["ratios"]),
                {"count": cat_thumb["count"], "srcs": cat_thumb["srcs"], "ratios": cat_thumb["ratios"]},
            )
            v.screenshot(path=str(OUT / "v52-m390-category.png"))

            goto(v, "v52-post-detail", "/posts/insurance-silson-5th/", wait="load")
            thumbs_post = v.evaluate(THUMB_JS)
            report["v52"]["thumb_post"] = {k: thumbs_post[k] for k in ("count", "loaded", "ratios")}
            check("v52.thumb_post_hero", thumbs_post["count"] >= 1 and thumbs_post["loaded"] >= 1 and all(1.55 <= x <= 1.65 for x in thumbs_post["ratios"]), {"count": thumbs_post["count"], "ratios": thumbs_post["ratios"]})
            check("v52.post_og_image", "/thumbs/" in thumbs_post["og"] and thumbs_post["og"].startswith("http"), thumbs_post["og"])
            v.screenshot(path=str(OUT / "v52-m390-post-hero.png"))

            goto(v, "v52-legend", "/", wait="load")
            v.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            v.evaluate("() => window.__bkFilm.seek(5.0)")
            v.wait_for_timeout(500)
            legend = v.evaluate(
                """() => ({
                  items: [...document.querySelectorAll('.fs3-legend-item')].map((el) => ({ t: el.textContent.trim(), visible: (() => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && parseFloat(getComputedStyle(el.closest('.fs3-legend')).opacity) > 0.3; })() })),
                  foot: (document.querySelector('.fs3-foot') || {}).innerText || '',
                })"""
            )
            report["v52"]["legend"] = legend
            check("v52.scene3_legend", [x["t"] for x in legend["items"]] == ["가정 기반 예시", "단순 비례 비교선"] and all(x["visible"] for x in legend["items"]), legend["items"])
            check("v52.scene3_rule_labels", "가정 기반 예시" in legend["foot"] and "단순 비례 비교선" in legend["foot"], legend["foot"])
            v.screenshot(path=str(OUT / "v52-m390-scene3.png"))

            dctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR")
            d = dctx.new_page()
            attach(d, "v52-1280")
            goto(d, "v52-desktop", "/", wait="load")
            d.wait_for_timeout(700)
            dnav = d.evaluate(QUICK_JS)
            report["v52"]["desktop"] = {"nav": dnav["nav_labels"], "header_h": dnav["header_h"]}
            check("v52.desktop_nav_labels", dnav["nav_labels"] == ["블로그", "도구자료실", "제도달력", "소개"], dnav["nav_labels"])
            check("v52.desktop_header_one_row", 63 <= dnav["header_h"] <= 66, dnav["header_h"])
            check("v52.desktop_quick_tabs_hidden", d.evaluate("() => getComputedStyle(document.querySelector('.site-quick')).display") == "none", "hidden")
            d.screenshot(path=str(OUT / "v52-desktop-header.png"))
            scroll_all(d)
            thumbs_d = d.evaluate(THUMB_JS)
            check("v52.thumbs_desktop_loaded", thumbs_d["loaded"] == thumbs_d["count"] and thumbs_d["count"] >= 6, {"count": thumbs_d["count"], "loaded": thumbs_d["loaded"]})
            dctx.close()
            vctx.close()
            tctx.close()

            # ---------------- 모션 축소 ----------------
            rctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR", reduced_motion="reduce")
            r = rctx.new_page()
            attach(r, "reduced")
            goto(r, "home-reduced", "/", wait="load")
            r.wait_for_timeout(1200)
            rm = r.evaluate(
                r"""
                () => {
                  const root = document.querySelector('[data-film]');
                  const st = document.querySelector('[data-film-static]');
                  const title = document.querySelector('.film-static-title');
                  const cs = st ? getComputedStyle(st) : null;
                  return {
                    mobility: matchMedia('(prefers-reduced-motion: reduce)').matches,
                    state: root ? root.dataset.filmState : null,
                    static_visible: cs ? cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.9 : false,
                    title: title ? title.innerText.replace(/\s+/g, ' ').trim() : '',
                    static_text: st ? st.innerText.replace(/\s+/g, ' ').trim() : '',
                    scenes_hidden: [...document.querySelectorAll('.film-scene')].every((el) => getComputedStyle(el).display === 'none'),
                    controls_hidden: getComputedStyle(document.querySelector('.film-rail')).display === 'none',
                    cta_visible: !!document.querySelector('.film-static-actions a'),
                  };
                }
                """
            )
            report["motion"] = rm
            check("motion.reduced_static", rm["mobility"] and rm["state"] == "static" and rm["scenes_hidden"], rm)
            check("motion.static_lockup", rm["static_visible"] and "숫자를 확인하고, 기록으로 남깁니다" in rm["static_text"], rm)
            check("motion.no_autoplay", rm["state"] == "static", rm["state"])
            check("motion.static_cta", rm["cta_visible"], rm)
            r.screenshot(path=str(OUT / "reduced-film.png"))

            # ---------------- 콘솔·요청 ----------------
            report["console_errors"] = [e for e in report["console_errors"] if "favicon" not in e.get("text", "")]
            check("console.zero", len(report["console_errors"]) == 0, report["console_errors"][:5])
            check("requests.zero_failed", len(report["failed_requests"]) == 0, report["failed_requests"][:5])
            check("http.zero_errors", len(report["http_errors"]) == 0, report["http_errors"])

            # ---------------- 2페이지·아카이브 캡처 ----------------
            goto(page, "home-final", "/", wait="load")
            page.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'loading'", timeout=20000)
            page.wait_for_timeout(600)
            page.evaluate("() => window.__bkFilm.pause()")
            page.evaluate("() => window.scrollTo(0, document.querySelector('#about').offsetTop - 70)")
            page.wait_for_timeout(400)
            element_shot(page, '[data-area="2"]', str(OUT / ("live-intro2.png" if LIVE else "desktop-intro2.png")))
            page.evaluate("() => window.scrollTo(0, document.querySelector('[data-area=\"3\"]').offsetTop - 70)")
            page.wait_for_timeout(400)
            element_shot(page, '[data-area="3"]', str(OUT / "desktop-archive.png"))

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
