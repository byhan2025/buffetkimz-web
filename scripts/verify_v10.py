"""
v5.6 캘리그라피 시그니처 배너 실측 — 1P 필름 씬5 · 정적 록업 · 소개 페이지.

사용:
  SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
  VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v10.py
  LIVE=1 VERIFY_BASE=/buffetkimz-web python3 scripts/verify_v10.py

재는 것:
  · /brand/ 배너 4종 모두 200 · naturalWidth > 0 (알파 WebP 실제 해독)
  · 1P 필름 씬5 — 영문(t=8.9)/한글(t=9.6) 배너가 실제로 보이고 시안 A 록업과 겹치지 않음
  · 모션 축소(정적 록업)에서도 같은 배너가 보임
  · /about 브랜드 시그니처 구역 — img 전부 alt·width·height, 1280/390 가로 넘침 0
  · 콘솔 오류 0 · 4xx/5xx 0
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
PORT = 4350
SUBPATH = (os.environ.get("VERIFY_BASE") or "").strip().strip("/")
PREFIX = f"/{SUBPATH}" if SUBPATH else ""
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = pathlib.Path(
    os.environ.get("VERIFY_OUT")
    or "/workspace/reports/buffetkimz-web/brand-assets/live-check"
)
OUT.mkdir(parents=True, exist_ok=True)

if LIVE:
    ORIGIN = os.environ.get("LIVE_ORIGIN", "https://byhan2025.github.io")
    BASE = ORIGIN + "/" + SUBPATH if SUBPATH else ORIGIN
else:
    BASE = f"http://127.0.0.1:{PORT}" + PREFIX

report = {"base": BASE, "live": LIVE, "pages": [], "films": {}, "about": {}, "console_errors": [], "http_errors": [], "images": []}
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
        lambda err: report["console_errors"].append({"page": name, "type": "pageerror", "text": str(err)}),
    )


def goto(page, name, path, wait="networkidle"):
    resp = page.goto(BASE + path, wait_until=wait, timeout=45000)
    page.wait_for_timeout(400)
    report["pages"].append({"name": name, "path": path, "status": resp.status if resp else None})
    if resp and resp.status >= 400:
        report["http_errors"].append({"name": name, "path": path, "status": resp.status})
    return resp


OVERFLOW_JS = """
() => {
  const vw = window.innerWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (cs.position === 'fixed') return;
    if (r.right > vw + 1.5 || r.left < -1.5) {
      bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 60),
                 left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1) });
    }
  });
  return { doc_w: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 25) };
}
"""

SIGN_JS = """
(t) => {
  const out = {};
  const f = window.__bkFilm;
  if (f && typeof t === 'number') f.seek(t);
  const q = (s) => document.querySelector(s);
  const box = q('[data-fs5-sign]');
  const en = q('[data-fs5-sign-en]');
  const ko = q('[data-fs5-sign-ko]');
  const mark = q('[data-fs5-mark]');
  const sub = q('[data-fs5-sub]');
  const vis = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { opacity: +cs.opacity, visibility: cs.visibility, w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
             naturalW: el.naturalWidth || 0, naturalH: el.naturalHeight || 0, complete: el.complete };
  };
  out.scene = document.querySelector('[data-film]')?.dataset.sceneActive;
  out.state = window.__bkFilm ? window.__bkFilm.state() : null;
  out.box = vis(box);
  out.en = vis(en);
  out.ko = vis(ko);
  out.mark = vis(mark);
  out.sub = vis(sub);
  if (box && mark) {
    const a = box.getBoundingClientRect(), b = mark.getBoundingClientRect();
    out.gap_mark_sign = +(a.top - b.bottom).toFixed(1);
    out.overlap_mark_sign = !(a.top >= b.bottom - 1 || b.top >= a.bottom - 1);
  }
  if (box && sub) {
    const a = box.getBoundingClientRect(), b = sub.getBoundingClientRect();
    out.gap_sign_sub = +(b.top - a.bottom).toFixed(1);
  }
  return out;
}
"""

ABOUT_JS = """
() => {
  const sec = document.querySelector('.brand-sign');
  const imgs = [...document.querySelectorAll('.brand-sign img')].map((im) => {
    const r = im.getBoundingClientRect();
    return { src: im.getAttribute('src'), srcset: !!im.getAttribute('srcset'), sizes: im.getAttribute('sizes'),
             alt: im.getAttribute('alt'), w: im.getAttribute('width'), h: im.getAttribute('height'),
             naturalW: im.naturalWidth, naturalH: im.naturalHeight, cssW: +r.width.toFixed(1), cssH: +r.height.toFixed(1),
             loading: im.getAttribute('loading') };
  });
  const r = sec ? sec.getBoundingClientRect() : null;
  return { found: !!sec, height: r ? +r.height.toFixed(1) : 0, imgs,
           allImgsMissingDims: [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('width') || !i.getAttribute('height') || i.getAttribute('alt') === null).length };
}
"""


def serve():
    serve_root = DIST
    if SUBPATH:
        serve_root = pathlib.Path("/workspace/tool-results/verify-serve-v10")
        serve_root.mkdir(parents=True, exist_ok=True)
        link = serve_root / SUBPATH
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(DIST, target_is_directory=True)
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(serve_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1)
            return proc
        except Exception:
            time.sleep(0.2)
    return proc


proc = None if LIVE else serve()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--force-color-profile=srgb"])

        # ── 1) 데스크톱 1280 ────────────────────────────────────────
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        page = ctx.new_page()
        attach(page, "home-1280")
        goto(page, "home-1280", "/")

        page.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'idle'", timeout=20000)
        page.wait_for_timeout(900)
        page.evaluate("() => window.__bkFilm.seek(8.9)")
        page.wait_for_timeout(450)
        en_state = page.evaluate(SIGN_JS, 8.9)
        report["films"]["desktop_en"] = en_state
        page.screenshot(path=str(OUT / "film-1280.png"))

        page.evaluate("() => window.__bkFilm.seek(9.65)")
        page.wait_for_timeout(450)
        ko_state = page.evaluate(SIGN_JS, 9.65)
        report["films"]["desktop_ko"] = ko_state
        page.screenshot(path=str(OUT / "film-1280-ko.png"))

        ov = page.evaluate(OVERFLOW_JS)
        report["films"]["desktop_overflow"] = ov
        ctx.close()

        # ── 2) 모바일 390 ──────────────────────────────────────────
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        attach(page, "home-390")
        goto(page, "home-390", "/")
        page.wait_for_function("() => window.__bkFilm && window.__bkFilm.state() !== 'idle'", timeout=20000)
        page.wait_for_timeout(900)
        page.evaluate("() => window.__bkFilm.seek(9.65)")
        page.wait_for_timeout(450)
        m_state = page.evaluate(SIGN_JS, 9.65)
        report["films"]["mobile_ko"] = m_state
        page.screenshot(path=str(OUT / "film-390.png"))
        ov = page.evaluate(OVERFLOW_JS)
        report["films"]["mobile_overflow"] = ov
        ctx.close()

        # ── 3) 모션 축소 — 정적 록업 ───────────────────────────────
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce", device_scale_factor=1)
        page = ctx.new_page()
        attach(page, "home-static")
        goto(page, "home-static", "/")
        page.wait_for_timeout(700)
        static = page.evaluate(
            """() => {
                const im = document.querySelector('.film-static-sign img');
                const s = document.querySelector('.film-static');
                const r = im ? im.getBoundingClientRect() : null;
                const sr = s ? s.getBoundingClientRect() : null;
                return { found: !!im, w: r ? +r.width.toFixed(1) : 0, h: r ? +r.height.toFixed(1) : 0,
                         naturalW: im ? im.naturalWidth : 0, state: document.querySelector('[data-film]').dataset.filmState,
                         staticTop: sr ? +sr.top.toFixed(1) : 0, staticBottom: sr ? +sr.bottom.toFixed(1) : 0,
                         staticScrollH: s ? s.scrollHeight : 0, staticClientH: s ? s.clientHeight : 0 };
            }"""
        )
        report["films"]["static"] = static
        page.screenshot(path=str(OUT / "film-static-1280.png"))
        ctx.close()

        # ── 4) /about ─────────────────────────────────────────────
        for vw, vh, dsf, name in [(1280, 900, 1, "about-1280"), (390, 844, 2, "about-390")]:
            ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf, is_mobile=vw < 600, has_touch=vw < 600)
            page = ctx.new_page()
            attach(page, name)
            goto(page, name, "/about")
            info = page.evaluate(ABOUT_JS)
            ov = page.evaluate(OVERFLOW_JS)
            report["about"][name] = {"info": info, "overflow": ov}
            # 구역 전체가 한 장에 담기게
            page.evaluate("() => document.querySelector('.brand-sign').scrollIntoView({block:'start'})")
            page.wait_for_timeout(700)
            page.evaluate("() => window.scrollBy(0, -70)")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}.png"))
            ctx.close()

        # ── 5) 이미지 자산 직접 확인 ────────────────────────────────
        ctx = browser.new_context(viewport={"width": 800, "height": 600})
        page = ctx.new_page()
        for f in [
            "buffetkimz-calligraphy-en-1400.webp",
            "buffetkimz-calligraphy-en-700.webp",
            "buffetkimz-calligraphy-ko-720.webp",
            "buffetkimz-calligraphy-ko-360.webp",
        ]:
            r = page.request.get(f"{BASE}/brand/{f}")
            body = r.body()
            report["images"].append({"file": f, "status": r.status, "bytes": len(body), "type": r.headers.get("content-type")})
        ctx.close()
        browser.close()
finally:
    if proc:
        proc.terminate()

# ── 판정 ─────────────────────────────────────────────────────────
for img in report["images"]:
    check(f"asset:{img['file']}", img["status"] == 200 and img["bytes"] > 5000, img)

d = report["films"]["desktop_en"]
check("film:en-visible", d["en"]["opacity"] > 0.85 and d["en"]["visibility"] == "visible" and d["en"]["naturalW"] > 0, d["en"])
check("film:en-size", 250 <= d["en"]["w"] <= 420 and 70 <= d["en"]["h"] <= 160, {"w": d["en"]["w"], "h": d["en"]["h"]})
check("film:ko-hidden-at-8.9", d["ko"]["opacity"] < 0.1, d["ko"])
check("film:no-overlap-mark", d["overlap_mark_sign"] is False and d["gap_mark_sign"] >= 0, {"gap": d["gap_mark_sign"], "overlap": d["overlap_mark_sign"]})

k = report["films"]["desktop_ko"]
check("film:ko-visible", k["ko"]["opacity"] > 0.85 and k["ko"]["naturalW"] > 0, k["ko"])
check("film:en-faded-at-9.65", k["en"]["opacity"] < 0.1, k["en"])
check("film:ko-no-overlap-mark", k["overlap_mark_sign"] is False, {"gap": k["gap_mark_sign"]})

for key in ("desktop_overflow", "mobile_overflow"):
    ov = report["films"][key]
    check(f"film:{key}", ov["doc_w"] <= ov["vw"] and not ov["bad"], ov["bad"] or {"doc_w": ov["doc_w"], "vw": ov["vw"]})

m = report["films"]["mobile_ko"]
check("film:mobile-sign-fits", m["box"]["w"] <= 300 and m["box"]["w"] >= 190 and not m["overlap_mark_sign"], m["box"])

st = report["films"]["static"]
check("film:static-banner", st["found"] and st["naturalW"] > 0 and 190 <= st["w"] <= 330, st)
check("film:static-no-scroll", st["staticScrollH"] <= st["staticClientH"] + 2, {"scrollH": st["staticScrollH"], "clientH": st["staticClientH"]})

for name, data in report["about"].items():
    info = data["info"]
    ov = data["overflow"]
    check(f"about:{name}:section", info["found"] and info["height"] > 320, {"height": info["height"]})
    check(f"about:{name}:imgs", len(info["imgs"]) == 2 and all(
        i["alt"] and i["w"] and i["h"] and i["naturalW"] > 0 and i["cssW"] > 120 for i in info["imgs"]
    ), info["imgs"])
    check(f"about:{name}:all-imgs-dims", info["allImgsMissingDims"] == 0, info["allImgsMissingDims"])
    check(f"about:{name}:overflow", ov["doc_w"] <= ov["vw"] and not ov["bad"], ov["bad"] or {"doc_w": ov["doc_w"], "vw": ov["vw"]})

check("console:0", len(report["console_errors"]) == 0, report["console_errors"][:6])
check("http:0", len(report["http_errors"]) == 0, report["http_errors"][:6])

report["checks"] = checks
report["failures"] = failures
report["passed"] = len(checks) - len(failures)
report["total"] = len(checks)
(OUT / "verify-v10-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"\n{'='*66}\nverify_v10 — {report['passed']}/{report['total']} 통과  ({BASE})\n{'='*66}")
for name, c in checks.items():
    print(("  ✓ " if c["pass"] else "  ✗ ") + name + ("" if c["pass"] else f"  → {json.dumps(c['detail'], ensure_ascii=False)[:300]}"))
print(f"\n스크린샷 · 보고서: {OUT}")
sys.exit(0 if not failures else 1)
