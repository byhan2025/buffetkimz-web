#!/usr/bin/env python3
"""v7.1 실측 검증 — 소개 정리 · 연금 마스터 6편 · 4대 계좌 비교기 · 자료앨범.

브리프(handoffs/✨-buffetkimz-com-v7-1-소개-정리-연금-마스터-6편-4계)의 판정을 그대로 잰다.

  A. 주요 페이지 × 1280 / 390 — HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  B. 소개 — '서표 하나, 손글씨 두 장' 섹션 삭제 · '본진' 0 · 커뮤니티 섹션 문구
  C. 홈 — '본진' 0 · 시리즈 7묶음 · 영문 필름 라벨(FIVE WORDS·FINANCE) 0 · 씬5 대비 보강
  D. 연금 마스터 6편 — 시리즈 번호·목차·결론 앵커·비교 카드·썸네일 로드·허브 시리즈 블록
  E. 앱스토어 — 카드 12(앱 11 + 금융캘린더 + 자료앨범), 개수 6·4·2, 4대 계좌 앱 상세·실행
  F. 자료앨범 — 탭 5 · 카드 4 · 캐러셀 넘김 · 검색 · 라이트박스 · 다운로드 · 세트 다운로드 · 업로드 입력 0
  G. 캡처 — reports/buffetkimz-web/v71-pension/{about-1280,posts-series-1280,account-compare-1280,
     account-compare-390,apps-1280,gallery-1280,gallery-390,gallery-lightbox-1280}.png

사용:
  npm run build && python3 scripts/verify_v71.py            # 로컬 dist
  python3 scripts/verify_v71.py --live                      # gh-pages 라이브
결과: reports/buffetkimz-web/v71-pension/verify-v71-{local,live}.json
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import sys
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v71-pension"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8171
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in sys.argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"
PREFIX = "/buffetkimz-web"

ROUTES = [
    ("home", "/"),
    ("about", "/about/"),
    ("pension-hub", "/posts/pension/"),
    ("post-1", "/posts/pension-master-01-four-accounts/"),
    ("post-5", "/posts/pension-master-05-draw-1500/"),
    ("apps", "/apps/"),
    ("account-app", "/apps/account-tax-compare/"),
    ("account-run", "/apps/account-tax-compare/run/"),
    ("gallery", "/gallery/"),
    ("calendar", "/calendar/"),
    ("principles", "/principles/"),
    ("search", "/search/"),
]

VIEWPORTS = {"1280": {"width": 1280, "height": 900}, "390": {"width": 390, "height": 844}}

# v7.0부터 쓰는 방어적 표현 금지 목록 — v7.1도 같은 기준
FORBIDDEN = ["비영업", "권하지 않습니다", "저장 0건", "중개 아님", "중개가 아닌", "가입 권유"]
# v7.1에서 걷어낸 내부 기획어
BANNED_TERMS = ["서표 하나", "손글씨 두 장", "본진"]

OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 48), over: Math.round(r.right - vw) });
  }
  return { docScroll: document.documentElement.scrollWidth, vw, overflow: Math.max(0, document.documentElement.scrollWidth - vw), wide: wide.slice(0, 4) };
}"""

FILM_JS = """() => {
  const s2 = document.querySelector('[data-scene="2"]');
  const s5 = document.querySelector('[data-scene="5"]');
  const kick = s5?.querySelector('.fs5-kicker');
  const tag = s5?.querySelector('.fs5-tags > li');
  const cs = kick ? getComputedStyle(kick) : null;
  const ts = tag ? getComputedStyle(tag) : null;
  return {
    scene2: s2 ? (s2.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    scene5: s5 ? (s5.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    kickerBg: cs ? cs.backgroundColor : '',
    kickerWeight: cs ? cs.fontWeight : '',
    tagBg: ts ? ts.backgroundColor : '',
    tagWeight: ts ? ts.fontWeight : '',
  };
}"""

SERIES_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  return {
    items: all('[data-master-series] ol li').length,
    nums: all('[data-master-series] ol li .mono').map(e => e.textContent.trim()),
    titles: all('[data-master-series] ol li .block').map(e => e.textContent.trim()),
    flag: !!document.querySelector('[data-master-series]'),
  };
}"""

POST_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => document.querySelector(s)?.innerText.replace(/\\s+/g, ' ').trim() ?? '';
  const thumb = document.querySelector('.post-thumb img, [data-post-hero] img, article img');
  return {
    h1: txt('h1'),
    conclusion: !!document.querySelector('[aria-label="결론"]'),
    toc: all('[data-toc]').length,
    compare: !!document.querySelector('[data-compare]'),
    series: txt('[data-series]') || all('.series-chip').map(e => e.innerText.trim()).join(' '),
    thumbOk: thumb ? thumb.naturalWidth > 0 : false,
    body: document.body.innerText,
  };
}"""

APP_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  return {
    cards: all('[data-store-item]').map(e => e.dataset.storeItem),
    counts: all('.store-sec-count').map(e => e.textContent.trim()),
    summary: all('[data-store-summary] a b').map(e => e.textContent.trim()),
  };
}"""

ACC_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const val = (k) => document.querySelector(`[data-acc-card="${k}"]`)?.dataset.accNet ?? '';
  const tax = (k) => document.querySelector(`[data-acc-card="${k}"]`)?.dataset.accTax ?? '';
  return {
    cards: all('[data-acc-card]').map(e => e.dataset.accCard),
    net: { general: val('general'), isa: val('isa'), pension: val('pension'), irp: val('irp') },
    tax: { general: tax('general'), isa: tax('isa'), pension: tax('pension'), irp: tax('irp') },
    verdict: document.querySelector('[data-acc-verdict]')?.innerText ?? '',
    slider: all('[data-runner] input[type=range]').length,
    basis: document.querySelector('[data-acc-basis]')?.innerText ?? '',
  };
}"""

GALLERY_JS = """() => {
  const all = (s) => [...document.querySelectorAll(s)];
  return {
    items: all('[data-gallery-item]').length,
    tabs: all('[data-gallery-tab]').map(e => ({ id: e.dataset.galleryTab, label: e.innerText.replace(/\\s+/g,' ').trim() })),
    slides: all('[data-gallery-stage]').map(i => ({ w: i.naturalWidth, h: i.naturalHeight })),
    thumbs: all('[data-gallery-thumb]').length,
    downloads: all('[data-gallery-download-current]').map(a => ({ href: a.getAttribute('href'), download: a.getAttribute('download') })),
    setDownloads: all('[data-gallery-set-download]').length,
    lb: !!document.querySelector('[data-gallery-lightbox]'),
    fileInputs: all('input[type=file]').length,
    forms: all('form').length,
    policy: document.querySelector('[data-gallery-policy]')?.innerText.replace(/\\s+/g,' ').trim() ?? '',
  };
}"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main() -> int:
    httpd = None if MODE == "live" else serve()
    checks: dict[str, dict] = {}
    errors: list[str] = []

    def add(name: str, ok: bool, detail="") -> None:
        checks[name] = {"ok": bool(ok), "detail": detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)}
        if not ok:
            errors.append(name)

    shots: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        for label, vp in VIEWPORTS.items():
            for key, route in ROUTES:
                page = browser.new_page(viewport=vp, locale="ko-KR")
                console: list[str] = []
                page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
                resp = page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(600)
                status = resp.status if resp else None
                add(f"{label} {route} HTTP 200", status == 200, str(status))
                add(f"{label} {route} 콘솔 오류 0", not console, console[:2])
                over = page.evaluate(OVERFLOW_JS)
                add(f"{label} {route} 가로 넘침 0", over["overflow"] == 0, over)

                body = page.evaluate("() => document.body.innerText")
                hits = [w for w in FORBIDDEN if w in body]
                add(f"{label} {route} 방어적 표현 0", not hits, ", ".join(hits))
                banned = [w for w in BANNED_TERMS if w in body]
                add(f"{label} {route} 내부 기획어 0", not banned, ",".join(banned))

                def preload():
                    """full-page 캡처 전에 지연 로드 이미지를 강제로 불러오고, 로드가 끝날 때까지 기다린다.
                    (loading='lazy'는 화면 밖에서 시작하지 않으므로 src를 다시 걸어 준다.)"""
                    page.evaluate(
                        """() => Promise.all([...document.images].map(i => new Promise(r => {
                          if (i.complete && i.naturalWidth > 0) return r();
                          i.loading = 'eager';
                          const s = i.getAttribute('src');
                          i.onload = r; i.onerror = r;
                          i.setAttribute('src', s + (s.includes('?') ? '&' : '?') + 'shot=1');
                        })))"""
                    )
                    page.wait_for_timeout(900)

                def full_shot(name: str, width: int) -> None:
                    """full_page 캡처는 화면 밖 이미지를 비워 두는 경우가 있어,
                    페이지 높이만큼 뷰포트를 늘려 전부 화면 안에서 그린 뒤 찍는다."""
                    h = min(page.evaluate("() => document.documentElement.scrollHeight"), 12000)
                    page.set_viewport_size({"width": width, "height": h})
                    page.evaluate("() => document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; })")
                    page.wait_for_timeout(1400)
                    page.screenshot(path=str(OUT / name))
                    page.set_viewport_size(vp)
                    page.evaluate("() => window.scrollTo(0, 0)")
                    page.wait_for_timeout(200)
                    shots.append(str(OUT / name))

                if key == "about":
                    about_txt = page.evaluate("() => document.body.innerText")
                    add(f"{label} 소개 보증 표현 낮신 문구", "1인 금융·연금 아카이브" in about_txt and "1:1 문의로" in about_txt, about_txt[:80])
                    low = [w for w in ["1인 금융 컨설팅", "1:1 자문", "맞춤 컨설팅"] if w in about_txt]
                    add(f"{label} 소개 자문·컨설팅 단정 0", not low, ",".join(low))

                if key == "about" and label == "1280":
                    preload()
                    full_shot("about-1280.png", 1280)
                if key == "pension-hub" and label == "1280":
                    preload()
                    full_shot("posts-series-1280.png", 1280)
                if key == "apps" and label == "1280":
                    preload()
                    full_shot("apps-1280.png", 1280)
                if key == "gallery":
                    for i in range(page.evaluate("() => document.querySelectorAll('[data-gallery-item]').length")):
                        page.evaluate("(i) => document.querySelectorAll('[data-gallery-item]')[i]?.scrollIntoView({block:'center'})", i)
                        page.wait_for_timeout(220)
                    page.evaluate("() => window.scrollTo(0, 0)")
                    page.wait_for_timeout(350)
                    full_shot(f"gallery-{label}.png", int(label))

                if key == "home":
                    film = page.evaluate(FILM_JS)
                    add(f"{label} 필름 씬2 한글 라벨", "다섯 개의 축" in film["scene2"], film["scene2"][:80])
                    add(f"{label} 필름 영문 라벨 0", not any(x in film["scene2"] + film["scene5"] for x in ["FIVE WORDS", "FINANCE", "INVEST", "PENSION", "INSURANCE", "TIME · COMPOUND", "NEXT ·"]), film["scene2"] + " / " + film["scene5"][:80])
                    add(f"{label} 씬5 소제목 배경 띠", "rgba(0, 0, 0, 0)" not in film["kickerBg"] and "transparent" not in film["kickerBg"], film["kickerBg"])
                    add(f"{label} 씬5 소제목 굵기", int(film["kickerWeight"]) >= 700, film["kickerWeight"])
                    add(f"{label} 씬5 태그 배경·굵기", "rgba(0, 0, 0, 0)" not in film["tagBg"] and int(film["tagWeight"]) >= 600, {"bg": film["tagBg"], "w": film["tagWeight"]})
                    series_n = page.evaluate("() => document.querySelectorAll('[data-series-grid] > li').length")
                    add(f"{label} 홈 시리즈 7묶음", series_n == 7, series_n)
                    gallery_link = page.evaluate("() => [...document.querySelectorAll('a')].some(a => a.getAttribute('href')?.includes('/gallery'))")
                    add(f"{label} 홈 자료앨범 링크", gallery_link, gallery_link)
                    if label == "1280":
                        page.evaluate("() => window.__bkFilm && window.__bkFilm.seek(2.3)")
                        page.wait_for_timeout(600)
                        page.screenshot(path=str(OUT / "film-scene2-1280.png"))
                        shots.append(str(OUT / "film-scene2-1280.png"))
                        page.evaluate("() => window.__bkFilm && window.__bkFilm.seek(9.35)")
                        page.wait_for_timeout(600)
                        page.screenshot(path=str(OUT / "film-scene5-1280.png"))
                        shots.append(str(OUT / "film-scene5-1280.png"))

                if key == "pension-hub":
                    s = page.evaluate(SERIES_JS)
                    add(f"{label} 연금 허브 시리즈 블록", s["flag"] and s["items"] == 6, s)
                    add(f"{label} 연금 허브 6편 번호", s["nums"] == ["01", "02", "03", "04", "05", "06"], s["nums"])

                if key in ("post-1", "post-5"):
                    pj = page.evaluate(POST_JS)
                    add(f"{label} {key} 결론 앵커", pj["conclusion"] is True, pj["conclusion"])
                    add(f"{label} {key} 목차", pj["toc"] >= 1, pj["toc"])
                    add(f"{label} {key} 시리즈 라벨", "연금·퇴직 마스터 가이드" in pj["series"], pj["series"])
                    add(f"{label} {key} 썸네일 로드", pj["thumbOk"] is True, pj["thumbOk"])
                    if key == "post-5":
                        add(f"{label} {key} 퇴직소득세 납부율", "퇴직소득세의 70%" in pj["body"] and "30~50%만 냅니다" not in pj["body"], "70% 납부(30~50% 감면)")
                        add(f"{label} {key} 비교 카드", pj["compare"] is True, pj["compare"])

                if key == "apps":
                    a = page.evaluate(APP_JS)
                    add(f"{label} 앱스토어 카드 12", len(a["cards"]) == 12, a["cards"])
                    add(f"{label} 앱스토어 개수 6·4·2", a["counts"] == ["6", "4", "2"], a["counts"])
                    add(f"{label} 자료앨범 카드", "gallery" in a["cards"], a["cards"])
                    add(f"{label} 4대 계좌 앱 카드", "account-tax-compare" in a["cards"], a["cards"])

                if key == "account-app":
                    txt = page.evaluate("() => document.body.innerText")
                    add(f"{label} 4대 계좌 앱 상세", "4대 계좌 세후 비교" in txt and "적용 세율" not in "", txt[:60])

                if key == "account-run":
                    html = page.content()
                    run_txt = page.evaluate("() => document.body.innerText")
                    add(f"{label} 원금 기준 명시", "초기 원금 기준" in run_txt and "수익 5,000만 원" in run_txt, run_txt[:80])
                    add(f"{label} 시뮬레이터 배지 문구", "예시 입력값 기준" in html and "예시 입력값 · 가상" not in html, "예시 입력값 기준")
                    flat = page.evaluate("() => document.body.innerText").replace(" ", "")
                    stale = [w for w in ["가상브라우저", "2026년11월19일", "2026.11.19"] if w in flat]
                    add(f"{label} 시뮬레이터 내부 표현·구날짜 0", not stale, ",".join(stale))
                    r = page.evaluate(ACC_JS)
                    add(f"{label} 4대 계좌 카드 4", r["cards"] == ["general", "isa", "pension", "irp"], r["cards"])
                    add(f"{label} 계좌별 세후 서로 다름", len(set(r["net"].values())) >= 3, r["net"])
                    add(f"{label} 계좌별 세금 계산", all(float(v) >= 0 for v in r["tax"].values()), r["tax"])
                    add(f"{label} 결론 문장", len(r["verdict"]) > 20, r["verdict"][:80])
                    add(f"{label} 슬라이더 5개 이상", r["slider"] >= 5, r["slider"])
                    add(f"{label} 세율 기준 표기", "15.4%" in r["basis"] and "16.5%" in r["basis"], r["basis"][:100])
                    if label == "1280":
                        # 배당형 → 국내주식형으로 바꾸면 일반계좌 세금이 줄어야 한다(비과세 매매차익)
                        before = r["tax"]["general"]
                        page.get_by_role("button", name="국내주식형").first.click()
                        page.wait_for_timeout(350)
                        after = page.evaluate("() => document.querySelector('[data-acc-card=\"general\"]')?.dataset.accTax")
                        add("1280 자산 유형 전환 반영", float(after or 0) < float(before), {"before": before, "after": after})
                    page.evaluate("() => window.scrollTo(0, 0)")
                    page.wait_for_timeout(120)
                    if label == "390":
                        full_shot(f"account-compare-{label}.png", 390)
                    else:
                        page.screenshot(path=str(OUT / f"account-compare-{label}.png"))
                        shots.append(str(OUT / f"account-compare-{label}.png"))

                if key == "gallery":
                    # 지연 로드 이미지까지 확인 — 카드를 차례로 화면에 넣는다
                    for i in range(page.evaluate("() => document.querySelectorAll('[data-gallery-item]').length")):
                        page.evaluate("(i) => document.querySelectorAll('[data-gallery-item]')[i]?.scrollIntoView({block:'center'})", i)
                        page.wait_for_timeout(260)
                    page.evaluate("() => window.scrollTo(0, 0)")
                    page.wait_for_timeout(200)
                    g = page.evaluate(GALLERY_JS)
                    add(f"{label} 앨범 카드 4", g["items"] == 4, g["items"])
                    add(f"{label} 앨범 탭 5", len(g["tabs"]) == 5 and [t["id"] for t in g["tabs"]] == ["all", "cardnews", "carousel", "infographic", "checklist"], g["tabs"])
                    add(f"{label} 앨범 카드 이미지 로드", all(s["w"] > 0 for s in g["slides"]), g["slides"])
                    add(f"{label} 앨범 4:5 이미지", all(s["w"] == 1080 and s["h"] == 1350 for s in g["slides"]), g["slides"][:2])
                    add(f"{label} 앨범 썸네일 7(세트 2개)", g["thumbs"] == 7, g["thumbs"])
                    add(f"{label} 현재 장 다운로드 4", len(g["downloads"]) == 4 and all(d["download"] for d in g["downloads"]), g["downloads"][:2])
                    add(f"{label} 세트 전체 다운로드 2", g["setDownloads"] == 2, g["setDownloads"])
                    add(f"{label} 라이트박스 존재", g["lb"] is True, g["lb"])
                    add(f"{label} 업로드 입력 0", g["fileInputs"] == 0 and g["forms"] == 0, {"files": g["fileInputs"], "forms": g["forms"]})
                    add(f"{label} 앨범 방문자 안내 1줄", "관리자" in g["policy"] and "내려받" in g["policy"], g["policy"][:120])
                    add(f"{label} 앨범 제작용 경로 0", not any(x in g["policy"] for x in ["public/gallery", "src/data/gallery", "ts"]), g["policy"][:120])

                    if label == "1280":
                        # 캐러셀 넘김 — 첫 카드의 2번째 장으로
                        first = page.locator('[data-gallery-item="pension-accounts"]')
                        src_before = first.locator("[data-gallery-stage]").get_attribute("src")
                        first.locator("[data-gallery-next]").click()
                        page.wait_for_timeout(300)
                        src_after = first.locator("[data-gallery-stage]").get_attribute("src")
                        counter = first.locator("[data-gallery-counter]").inner_text()
                        add("1280 캐러셀 넘김", src_before != src_after and "2 / 4" in counter, {"before": src_before, "after": src_after, "counter": counter})
                        dl = first.locator("[data-gallery-download-current]").get_attribute("href")
                        add("1280 현재 장 다운로드 갱신", dl == src_after, {"dl": dl, "src": src_after})

                        # 검색
                        page.fill("[data-gallery-search]", "ISA")
                        page.wait_for_timeout(300)
                        visible = page.evaluate("() => [...document.querySelectorAll('[data-gallery-item]')].filter(c => !c.hidden).map(c => c.dataset.galleryItem)")
                        add("1280 앨범 검색 ISA", visible and all("pension" in v for v in visible) and len(visible) <= 2, visible)
                        page.fill("[data-gallery-search]", "")
                        page.wait_for_timeout(200)

                        # 카테고리 탭 — 캐러셀 1건
                        page.click('[data-gallery-tab="infographic"]')
                        page.wait_for_timeout(250)
                        vis_cat = page.evaluate("() => [...document.querySelectorAll('[data-gallery-item]')].filter(c => !c.hidden).map(c => c.dataset.galleryItem)")
                        add("1280 앨범 탭 인포그래픽 1건", vis_cat == ["pension-draw-order"], vis_cat)
                        page.click('[data-gallery-tab="all"]')
                        page.wait_for_timeout(200)

                        # 라이트박스
                        page.click('[data-gallery-item="pension-accounts"] [data-gallery-open]')
                        page.wait_for_timeout(500)
                        lb_open = page.evaluate("() => document.querySelector('[data-gallery-lightbox]')?.open === true")
                        lb_img = page.evaluate("() => { const i = document.querySelector('[data-lb-img]'); return i ? { src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight } : null; }")
                        add("1280 라이트박스 열림", lb_open is True, lb_open)
                        add("1280 라이트박스 이미지 4:5", bool(lb_img) and lb_img["w"] == 1080 and lb_img["h"] == 1350, lb_img)
                        page.screenshot(path=str(OUT / "gallery-lightbox-1280.png"))
                        shots.append(str(OUT / "gallery-lightbox-1280.png"))
                        page.click("[data-lb-next]")
                        page.wait_for_timeout(250)
                        lb_counter = page.evaluate("() => document.querySelector('[data-lb-count]')?.innerText ?? ''")
                        add("1280 라이트박스 넘김", "3 / 4" in lb_counter, lb_counter)
                        page.click("[data-lb-close]")
                        page.wait_for_timeout(200)
                        add("1280 라이트박스 닫힘", page.evaluate("() => document.querySelector('[data-gallery-lightbox]')?.open === false"), "")

                        # 다운로드 링크가 실제 파일을 가리키는지(HTTP 200)
                        href = page.locator('[data-gallery-item="pension-accounts"] [data-gallery-download-current]').get_attribute("href") or ""
                        dl_url = page.evaluate("(h) => new URL(h, location.href).href", href)
                        dresp = page.request.get(dl_url)
                        add("1280 다운로드 URL 200", dresp.status == 200, dresp.status)

                page.close()

        # 대표 캡처 — about / posts / apps 는 full_page 로 이미 저장, 390 갤러리도 위에서 저장
        pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
        add("package.json 버전 7.1.1", pkg.get("version") == "7.1.1", str(pkg.get("version")))

        browser.close()
    if httpd:
        httpd.shutdown()

    result = {
        "mode": MODE,
        "base": BASE,
        "ok": not errors,
        "passed": sum(1 for c in checks.values() if c["ok"]),
        "total": len(checks),
        "failed": {k: v for k, v in checks.items() if not v["ok"]},
        "checks": checks,
        "shots": shots,
    }
    (OUT / f"verify-v71-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{MODE}] {result['passed']}/{result['total']} checks passed")
    for k, v in result["failed"].items():
        print(f"FAIL  {k} — {v['detail']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
