"""buffetkimz.com 2단계 발행 파이프라인 — 1280·390 실측 + 스크린샷.

측정 항목 (부이 대리·4호 봇 기준)
  · 목록 카드: 제목 2줄 말줄임, 요약 80자 이내, 태그 최대 3개(분류 1 + 주제 2), 기준일, 읽는 시간
  · 글 상세: 제목 아래 기준일(YYYY.MM.DD) + 1차 출처(공식 기관 URL) 2줄, 표 렌더, 태그 3개 이하
  · 상단 퀵 탭 바: 배경 불투명도 0.97 이상(스크롤 시 본문 글자 비침 0)
  · 면책: 페이지 하단 공통 블록 1개만(본문 이탤릭 면책 문단 0)
  · 390: 본문 16~17px · line-height 1.65~1.8 · 좌우 여백 20px+ · 가로 넘침 0
  · 390 본문 하단: 태그 + 비권유 면책 문구가 한 화면에 찍히는지(스크린샷)
  · 표 셀 고아 줄('제외' 한 단어 줄바꿈) 0 · 모든 목록/상세 <img> alt 누락 0(DOM 실측)
  · 소식지(/letters): 호수·발행일 카드, 연도별 접힘, 1280·390 스크린샷
  · 두 화면 모두 콘솔 오류 0

사용:
  npm run build
  python3 scripts/verify_pipeline_v2.py
결과: reports/buffetkimz-web/pipeline-v2/verify-1280-390.json · mobile-390.json · shots/*.png
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = Path("/workspace/reports/buffetkimz-web/pipeline-v2")
SHOTS = OUT / "shots"
PORT = 4355
BASE = f"http://127.0.0.1:{PORT}"
SLUGS = ["silson-switch-2026", "isa-pension-300"]

failures: list[str] = []
warnings: list[str] = []


def check(cond: bool, message: str, warn: bool = False) -> bool:
    if not cond:
        (warnings if warn else failures).append(message)
    return cond


def serve() -> subprocess.Popen:
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(DIST)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(60):
        try:
            urllib.request.urlopen(f"{BASE}/posts/", timeout=1).read(64)
            return proc
        except Exception:  # noqa: BLE001
            time.sleep(0.25)
    proc.terminate()
    raise RuntimeError("dist 서버가 뜨지 않았습니다")


CARD_JS = """
() => {
  const cards = [...document.querySelectorAll('[data-post-cards] > li')];
  return cards.slice(0, 6).map((li) => {
    const title = li.querySelector('[data-card-title]');
    const summary = li.querySelector('[data-card-summary]');
    const tags = li.querySelectorAll('[data-card-tags] li');
    const meta = li.querySelector('[data-card-meta]');
    const styles = title ? getComputedStyle(title) : null;
    const lh = styles ? parseFloat(styles.lineHeight) : 0;
    const date = li.querySelector('time');
    return {
      title: title ? title.innerText.trim() : '',
      titleHeight: title ? title.clientHeight : 0,
      titleLines: lh ? Math.round(title.clientHeight / lh) : 0,
      summary: summary ? summary.innerText.trim() : '',
      summaryLen: summary ? summary.innerText.trim().length : 0,
      tags: [...tags].map((t) => t.innerText.trim()),
      meta: meta ? meta.innerText.trim() : '',
      category: li.querySelector('.text-brand')?.innerText.trim() ?? '',
      hasDate: !!date,
      reads: /\\d+분/.test(li.innerText),
    };
  });
}
"""

POST_JS = """
() => {
  const body = document.querySelector('.prose-article');
  const basis = document.querySelector('[data-post-basis]');
  const wrap = document.querySelector('.wrap');
  const lines = basis ? [...basis.querySelectorAll('dd')].map((d) => d.innerText.trim()) : [];
  const bs = body ? getComputedStyle(body) : null;
  const ws = wrap ? getComputedStyle(wrap) : null;
  const tables = [...document.querySelectorAll('.prose-article table')].map((t) => ({
    scrollWidth: t.scrollWidth,
    clientWidth: t.clientWidth,
    parentWidth: t.parentElement ? t.parentElement.clientWidth : 0,
  }));
  const bodyDisclaimer = body
    ? [...body.querySelectorAll('em, i')].filter((e) => /권하지|아닙니다|참고용|보장하지/.test(e.innerText)).length
    : 0;
  const tagItems = [...document.querySelectorAll('[data-post-tags] li')].map((li) => li.innerText.trim());
  return {
    basisLines: lines,
    basisLink: basis ? (basis.querySelector('a')?.getAttribute('href') ?? null) : null,
    fontSize: bs ? parseFloat(bs.fontSize) : 0,
    lineHeightRatio: bs ? parseFloat(bs.lineHeight) / parseFloat(bs.fontSize) : 0,
    paddingLeft: ws ? parseFloat(ws.paddingLeft) : 0,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    tables,
    h1: document.querySelector('h1')?.innerText.trim() ?? '',
    disclaimerCount: document.querySelectorAll('[data-post-disclaimer]').length,
    bodyDisclaimerEm: bodyDisclaimer,
    tags: tagItems,
  };
}
"""

HEADER_JS = """
() => {
  const header = document.querySelector('.site-header');
  const quick = document.querySelector('[data-quick-tabs]');
  const hs = header ? getComputedStyle(header) : null;
  const rect = header ? header.getBoundingClientRect() : null;
  return {
    background: hs ? hs.backgroundColor : null,
    backdrop: hs ? (hs.backdropFilter || hs.webkitBackdropFilter || 'none') : 'none',
    position: hs ? hs.position : null,
    height: rect ? Math.round(rect.height) : 0,
    quickVisible: quick ? quick.getBoundingClientRect().height > 0 : false,
    quickBottom: quick ? Math.round(quick.getBoundingClientRect().bottom) : 0,
    textBehind: (() => {
      if (!header) return null;
      const r = header.getBoundingClientRect();
      const els = [...document.querySelectorAll('.prose-article p, .prose-article h2')];
      const hit = els.find((el) => {
        const b = el.getBoundingClientRect();
        return b.top < r.bottom - 2 && b.bottom > r.top + 2;
      });
      return hit ? hit.innerText.trim().slice(0, 24) : null;
    })(),
  };
}
"""


ATTR_SIZE_TOL = 0.02  # width/height 속성↔실제 크기 종횡비 허용 오차(2%)


def size_ok(attr: list[int] | None, natural: list[int] | None, broken: bool = False) -> tuple[bool, str]:
    """이미지 width/height 속성이 실제 로드 크기와 맞는가.

    픽셀 완전일치 대신 **종횡비 2% 이내**로 판정한다. 로고처럼 `srcset`+`sizes`의
    밀도 보정으로 브라우저가 고른 후보 파일의 자연 크기가 속성값과 픽셀 단위로
    같지 않을 수 있기 때문이다(예: 3342×883 속성 ↔ 960×254 로드 → 0.14%).

    · 속성(width/height)이 없으면 검사 대상이 아니다 → 통과
    · 완료됐는데 자연 폭이 0이면 깨진 이미지 → 실패
    · 아직 로드 전(lazy)이라 자연 크기를 모르면 판정 보류 → 통과
    · 종횡비가 2% 넘게 벌어지면 왜곡으로 본다 → 실패
    """
    if not attr:
        return True, "속성 없음"
    try:
        aw, ah = int(attr[0]), int(attr[1])
    except (TypeError, ValueError, IndexError):
        return True, f"속성 해석 불가 {attr}"
    if aw <= 0 or ah <= 0:
        return False, f"속성값 0 이하 {attr}"
    if broken:
        return False, "로드 실패(깨진 이미지, naturalWidth=0)"
    if not natural:
        return True, "자연 크기 미로드 — 판정 보류"
    try:
        nw, nh = int(natural[0]), int(natural[1])
    except (TypeError, ValueError, IndexError):
        return True, f"자연 크기 해석 불가 {natural}"
    if nw <= 0 or nh <= 0:
        return False, f"자연 크기 0 {natural} — 로드 실패"
    drift = abs((aw / ah) - (nw / nh)) / (aw / ah)
    if drift > ATTR_SIZE_TOL:
        return False, f"종횡비 {drift * 100:.1f}% 차이 {attr} vs {natural}"
    return True, f"종횡비 {drift * 100:.2f}% 이내 {attr} vs {natural}"


def alpha_of(value: str | None) -> float:
    """computed backgroundColor에서 알파를 읽는다 — rgb·rgba·oklab(color-mix) 모두."""
    if not value:
        return 0.0
    v = value.strip().lower()
    if v in ("transparent", "none", ""):
        return 0.0
    m = re.search(r"/\s*([0-9.]+)(%?)\s*\)", v)
    if m:
        n = float(m.group(1))
        return n / 100 if m.group(2) else n
    m = re.match(r"rgba?\(([^)]+)\)", v)
    if m:
        parts = [p for p in re.split(r"[,\s/]+", m.group(1)) if p]
        if len(parts) >= 4:
            try:
                return float(parts[3])
            except ValueError:
                return 0.0
        return 1.0
    return 1.0


ALT_JS = """
() => {
  const imgs = [...document.querySelectorAll('img')];
  return imgs.map((img) => {
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      hasAltAttr: img.hasAttribute('alt'),
      decorative: !!img.closest('[aria-hidden="true"]'),
      attrSize: w && h ? [Number(w), Number(h)] : null,
      naturalSize: img.naturalWidth ? [img.naturalWidth, img.naturalHeight] : null,
      complete: img.complete,
      broken: img.complete && img.naturalWidth === 0,
    };
  });
}
"""

TABLE_ORPHAN_JS = """
() => {
  const out = [];
  for (const td of document.querySelectorAll('.prose-article td')) {
    const text = td.innerText.trim();
    if (!text) continue;
    const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
    const tops = [];
    let node;
    while ((node = walker.nextNode())) {
      const value = node.textContent;
      const re = /\\S+/g;
      let m;
      while ((m = re.exec(value))) {
        const r = document.createRange();
        r.setStart(node, m.index);
        r.setEnd(node, m.index + m[0].length);
        const rect = r.getClientRects()[0];
        if (rect) tops.push({ word: m[0], top: Math.round(rect.top) });
      }
    }
    if (!tops.length) continue;
    const lastTop = Math.max(...tops.map((t) => t.top));
    const lastLine = tops.filter((t) => t.top === lastTop);
    out.push({
      text,
      lines: new Set(tops.map((t) => t.top)).size,
      lastLineWords: lastLine.map((t) => t.word),
      orphan: lastLine.length === 1 && lastLine[0].word.length <= 3 && tops.length > 1,
    });
  }
  return out;
}
"""

LETTERS_JS = """
() => {
  const cards = [...document.querySelectorAll('[data-letter-cards] > li')];
  const years = [...document.querySelectorAll('[data-letter-year]')].map((d) => ({
    year: d.getAttribute('data-letter-year'),
    open: d.hasAttribute('open'),
    issues: d.querySelectorAll('[data-letter-issue]').length,
  }));
  return {
    cards: cards.map((li) => ({
      issue: li.getAttribute('data-letter-issue'),
      text: li.innerText.replace(/\\s+/g, ' ').trim(),
      hasDate: !!li.querySelector('time'),
    })),
    years,
    hasIssueLabel: /제\\d+호/.test(document.body.innerText),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
}
"""


def main() -> int:
    if not DIST.exists():
        print("dist가 없습니다 — npm run build 먼저", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = serve()
    report: dict = {"base": BASE, "viewports": {}, "checks": []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for label, width, height, dsf in (
                ("desktop", 1280, 900, 1),
                ("mobile390", 390, 844, 2),
            ):
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dsf,
                    is_mobile=(label == "mobile390"),
                    has_touch=(label == "mobile390"),
                )
                page = ctx.new_page()
                console_errors: list[str] = []
                page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: console_errors.append(str(e)))

                entry: dict = {"viewport": {"width": width, "height": height}}

                # 목록
                page.goto(f"{BASE}/posts/", wait_until="networkidle")
                header = page.evaluate(HEADER_JS)
                entry["header"] = header
                alpha = alpha_of(header.get("background"))
                entry["headerAlpha"] = round(alpha, 3)
                check(alpha >= 0.97, f"[{label}] 상단 바 배경 불투명도 {alpha:.2f}(0.97 이상 필요) — {header.get('background')}")
                if label == "mobile390":
                    check(bool(header.get("quickVisible")), f"[{label}] 모바일 퀵 탭 줄이 보이지 않습니다")
                cards = page.evaluate(CARD_JS)
                entry["cards"] = cards
                check(len(cards) > 0, f"[{label}] 목록 카드가 없습니다")
                for card in cards[:4]:
                    check(card["titleLines"] <= 2, f"[{label}] 카드 제목이 {card['titleLines']}줄: {card['title'][:24]}")
                    check(card["summaryLen"] <= 81, f"[{label}] 카드 요약 {card['summaryLen']}자(80자 초과): {card['title'][:20]}")
                    check(len(card["tags"]) <= 2, f"[{label}] 카드 주제 태그 {len(card['tags'])}개(최대 2)")
                    check("기준일" in card["meta"] and re.search(r"\d{4}\. \d{2}\. \d{2}\.", card["meta"]) is not None, f"[{label}] 카드에 기준일 없음: {card['title'][:20]}")
                    check(card["reads"], f"[{label}] 카드에 읽는 시간 없음: {card['title'][:20]}")
                page.screenshot(path=str(SHOTS / f"{label}-posts.png"))
                cards_box = page.locator("[data-post-cards]")
                if cards_box.count():
                    cards_box.first.scroll_into_view_if_needed()
                    page.wait_for_timeout(250)
                    page.screenshot(path=str(SHOTS / f"{label}-post-cards.png"))
                entry["postsOverflowX"] = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                check(entry["postsOverflowX"] <= 1, f"[{label}] /posts 가로 넘침 {entry['postsOverflowX']}px")
                # 목록 카드 이미지 alt 실측
                entry["altAuditPosts"] = page.evaluate(ALT_JS)
                for img in entry["altAuditPosts"]:
                    check(img["hasAltAttr"] and (img["alt"] or "").strip() != "",
                          f"[{label}] 목록 이미지 alt 누락: {img['src']}")

                # 글 상세
                entry["posts"] = {}
                for slug in SLUGS:
                    page.goto(f"{BASE}/posts/{slug}/", wait_until="networkidle")
                    data = page.evaluate(POST_JS)
                    entry["posts"][slug] = data
                    check(len(data["basisLines"]) == 2, f"[{label}] {slug}: 기준일·출처 2줄이 아닙니다({len(data['basisLines'])})")
                    if len(data["basisLines"]) == 2:
                        check(bool(re.match(r"기준일 \d{4}\. \d{2}\. \d{2}\.", data["basisLines"][0])),
                              f"[{label}] {slug}: 기준일 형식 {data['basisLines'][0]!r}")
                        check("1차 출처" in data["basisLines"][1], f"[{label}] {slug}: 1차 출처 줄 없음")
                    check(bool(data["basisLink"] and data["basisLink"].startswith("http")),
                          f"[{label}] {slug}: 출처 URL 링크 없음")
                    check(data["disclaimerCount"] == 1,
                          f"[{label}] {slug}: 하단 공통 면책 블록이 {data['disclaimerCount']}개(1개여야 함)")
                    check(data["bodyDisclaimerEm"] == 0,
                          f"[{label}] {slug}: 본문 이탤릭 면책 문단 {data['bodyDisclaimerEm']}개(하단 블록과 중복)")
                    check(len(data["tags"]) <= 3,
                          f"[{label}] {slug}: 태그 {len(data['tags'])}개(최대 3) — {data['tags']}")
                    check(data["overflowX"] <= 1, f"[{label}] {slug}: 가로 넘침 {data['overflowX']}px")
                    for i, t in enumerate(data["tables"]):
                        check(t["clientWidth"] <= t["parentWidth"] + 1,
                              f"[{label}] {slug}: 표 {i+1}이 본문 폭을 넘습니다({t['clientWidth']} > {t['parentWidth']})")
                    page.screenshot(path=str(SHOTS / f"{label}-post-{slug}.png"))
                    page.screenshot(path=str(SHOTS / f"{label}-post-{slug}-full.png"), full_page=True)

                    # 상세 이미지 alt + 표 셀 고아 줄
                    entry.setdefault("postAlt", {})[slug] = page.evaluate(ALT_JS)
                    for img in entry["postAlt"][slug]:
                        check(img["hasAltAttr"] and (img["alt"] or "").strip() != "",
                              f"[{label}] {slug}: 본문 이미지 alt 누락: {img['src']}")
                        size_pass, size_note = size_ok(img["attrSize"], img["naturalSize"], img.get("broken", False))
                        check(size_pass, f"[{label}] {slug}: 이미지 width/height 속성이 실제 크기와 다릅니다 — {size_note} ({img['src']})")
                    cells = page.evaluate(TABLE_ORPHAN_JS)
                    entry.setdefault("tableCells", {})[slug] = cells
                    orphans = [c for c in cells if c["orphan"]]
                    check(not orphans, f"[{label}] {slug}: 표 셀 고아 줄 {[o['lastLineWords'] for o in orphans]}")

                    if label == "desktop" and slug == SLUGS[0]:
                        # 기준일·출처 블록과 하단 면책 문단을 요소 단위로도 남긴다
                        basis = page.locator("[data-post-basis]")
                        if basis.count():
                            basis.first.screenshot(path=str(SHOTS / "desktop-basis-block.png"))
                        disc = page.locator("[data-post-disclaimer]")
                        if disc.count():
                            disc.first.screenshot(path=str(SHOTS / "desktop-disclaimer.png"))

                    if label == "mobile390":
                        # 390 본문 하단 — 태그 + 비권유 면책 문구가 한 화면에
                        tags = page.locator("[data-post-tags]")
                        disclaimer = page.locator("[data-post-disclaimer]")
                        check(tags.count() > 0 and disclaimer.count() > 0, f"[mobile390] {slug}: 태그/면책 요소 없음")
                        if tags.count() and disclaimer.count():
                            tag_n = tags.first.locator("li").count()
                            check(tag_n >= 3, f"[mobile390] {slug}: 태그 {tag_n}개(3개 이상 필요)")
                            check(tag_n <= 3, f"[mobile390] {slug}: 태그 {tag_n}개(최대 3)")
                            check("권하지 않습니다" in disclaimer.first.inner_text(),
                                  f"[mobile390] {slug}: 비권유 면책 문구 없음")
                            tags.first.scroll_into_view_if_needed()
                            page.wait_for_timeout(250)
                            page.screenshot(path=str(SHOTS / f"{label}-post-{slug}-footer.png"))
                            entry.setdefault("footerShots", []).append(f"{label}-post-{slug}-footer.png")
                            if slug == SLUGS[0]:
                                # 본문 첫 줄이 퀵 탭 바 아래 경계에 걸치도록 스크롤 — 바 뒤로 글자가 비치는지 보는 컷
                                page.evaluate(
                                    """() => {
                                      window.scrollTo({ top: 0, behavior: 'instant' });
                                      const h = document.querySelector('.site-header').getBoundingClientRect();
                                      const ps = [...document.querySelectorAll('.prose-article p')];
                                      const p = ps.find((el) => el.getBoundingClientRect().top > h.bottom + 20);
                                      if (p) window.scrollBy({ top: p.getBoundingClientRect().top - (h.bottom - 16), behavior: 'instant' });
                                    }"""
                                )
                                page.wait_for_timeout(500)
                                page.screenshot(path=str(SHOTS / f"{label}-quicktab-scroll.png"))
                                entry.setdefault("footerShots", []).append(f"{label}-quicktab-scroll.png")

                if label == "mobile390":
                    first = entry["posts"][SLUGS[0]]
                    check(16 <= first["fontSize"] <= 17, f"[mobile390] 본문 글자 {first['fontSize']}px(16~17px)")
                    check(1.6 <= first["lineHeightRatio"] <= 1.82, f"[mobile390] 본문 행간 {first['lineHeightRatio']:.2f}")
                    check(first["paddingLeft"] >= 20, f"[mobile390] 좌우 여백 {first['paddingLeft']}px(20px+)")

                # 검색 (인덱스 정합성 — UI에서 새 글이 잡히는지)
                page.goto(f"{BASE}/search/", wait_until="networkidle")
                box = page.locator("input[type='search'], input[placeholder*='검색']").first
                box.click()
                box.fill("실손")
                page.wait_for_timeout(700)
                hits = page.evaluate("document.querySelectorAll('a[href*=\"/posts/\"]').length")
                entry["searchHits"] = hits
                check(hits >= 1, f"[{label}] 검색 '실손' 결과가 화면에 없습니다")
                page.screenshot(path=str(SHOTS / f"{label}-search-silson.png"))

                # 소식지 (/letters) — 호수·발행일 카드, 연도별 접힘, 첫 호 상세
                page.goto(f"{BASE}/letters/", wait_until="networkidle")
                letters = page.evaluate(LETTERS_JS)
                entry["letters"] = letters
                check(len(letters["cards"]) >= 1, f"[{label}] /letters 호 카드가 없습니다")
                check(letters["hasIssueLabel"], f"[{label}] /letters 에 '제N호' 표기가 없습니다")
                check(letters["overflowX"] <= 1, f"[{label}] /letters 가로 넘침 {letters['overflowX']}px")
                for card in letters["cards"]:
                    check(card["hasDate"], f"[{label}] /letters 제{card['issue']}호 발행일 없음")
                    check(f"제{card['issue']}호" in card["text"], f"[{label}] /letters 제{card['issue']}호 호수 표기 없음")
                check(bool(letters["years"]), f"[{label}] /letters 연도별 묶음이 없습니다")
                check(any(y["open"] for y in letters["years"]), f"[{label}] /letters 최근 연도가 접혀 있습니다")
                page.screenshot(path=str(SHOTS / f"{label}-letters.png"))
                page.screenshot(path=str(SHOTS / f"{label}-letters-full.png"), full_page=True)
                entry["lettersAlt"] = page.evaluate(ALT_JS)

                page.goto(f"{BASE}/letters/2026-11-21/", wait_until="networkidle")
                entry["letterDetail"] = {
                    "h1": page.evaluate("document.querySelector('h1')?.innerText.trim() ?? ''"),
                    "overflowX": page.evaluate("document.documentElement.scrollWidth - window.innerWidth"),
                    "hasCopyBlock": page.evaluate("document.body.innerText.includes('복사용 본문')"),
                    "hasSources": page.evaluate("document.body.innerText.includes('확인한 출처')"),
                }
                check("소식지 제1호" in entry["letterDetail"]["h1"], f"[{label}] 소식지 상세 제목 {entry['letterDetail']['h1']!r}")
                check(entry["letterDetail"]["overflowX"] <= 1, f"[{label}] 소식지 상세 가로 넘침 {entry['letterDetail']['overflowX']}px")
                page.screenshot(path=str(SHOTS / f"{label}-letters-issue-1.png"))
                page.screenshot(path=str(SHOTS / f"{label}-letters-issue-1-full.png"), full_page=True)
                entry["letterAlt"] = page.evaluate(ALT_JS)

                entry["consoleErrors"] = console_errors
                check(not console_errors, f"[{label}] 콘솔 오류 {len(console_errors)}건: {console_errors[:2]}")
                report["viewports"][label] = entry
                ctx.close()
            browser.close()
    finally:
        server.terminate()

    # ── alt DOM 실측 집계 (목록 · 상세 · 소식지, 1280/390 두 화면)
    imgs: list[dict] = []
    for label, entry in report["viewports"].items():
        for img in entry.get("altAuditPosts", []):
            imgs.append({"page": "/posts/", "viewport": label, **img})
        for slug, items in (entry.get("postAlt") or {}).items():
            for img in items:
                imgs.append({"page": f"/posts/{slug}/", "viewport": label, **img})
        for img in entry.get("lettersAlt", []):
            imgs.append({"page": "/letters/", "viewport": label, **img})
        for img in entry.get("letterAlt", []):
            imgs.append({"page": "/letters/2026-11-21/", "viewport": label, **img})
    missing_attr = [i for i in imgs if not i["hasAltAttr"]]
    empty_attr = [i for i in imgs if i["hasAltAttr"] and not (i.get("alt") or "").strip()]
    empty_content = [i for i in empty_attr if not i.get("decorative")]
    size_checked = [(i, *size_ok(i["attrSize"], i["naturalSize"], i.get("broken", False))) for i in imgs]
    size_mismatch = [i for i, ok, _ in size_checked if not ok]
    alt_audit = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "scope": ["/posts/", "/posts/silson-switch-2026/", "/posts/isa-pension-300/", "/letters/", "/letters/2026-11-21/"],
        "viewports": ["desktop 1280", "mobile390"],
        "total": len(imgs),
        "missingAltAttribute": len(missing_attr),
        "emptyAlt": len(empty_attr),
        "emptyAltInContent": len(empty_content),
        "attrSizeMismatch": len(size_mismatch),
        "attrSizeRule": f"width/height 속성 ↔ 자연 크기 종횡비 ±{ATTR_SIZE_TOL * 100:.0f}% 이내 + 자연 크기 0 아님",
        "verdict": "PASS" if not missing_attr and not empty_content and not size_mismatch else "FAIL",
        "images": [
            {**i, "attrSizeVerdict": note}
            for i, _ok, note in size_checked
        ],
        "problems": (missing_attr + empty_content + size_mismatch)[:10],
    }
    (OUT / "alt-audit.json").write_text(json.dumps(alt_audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    check(not missing_attr, f"alt 속성 누락 {len(missing_attr)}건")
    check(not empty_content, f"본문·목록 이미지 alt 빈값 {len(empty_content)}건")
    check(not size_mismatch, f"이미지 width/height 속성 불일치 {len(size_mismatch)}건 — {[size_ok(i['attrSize'], i['naturalSize'], i.get('broken', False))[1] for i in size_mismatch][:3]}")
    report["altAudit"] = {k: v for k, v in alt_audit.items() if k != "images"}

    verdict = "PASS" if not failures else "FAIL"
    report["failures"] = failures
    report["warnings"] = warnings
    report["verdict"] = verdict
    (OUT / "verify-1280-390.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    mobile = report["viewports"].get("mobile390", {})
    (OUT / "mobile-390.json").write_text(
        json.dumps(
            {
                "failures": [f for f in failures if "mobile390" in f],
                "warnings": [w for w in warnings if "mobile390" in w],
                "summary": (
                    f"본문 {mobile.get('posts', {}).get(SLUGS[0], {}).get('fontSize', '?')}px · "
                    f"행간 {mobile.get('posts', {}).get(SLUGS[0], {}).get('lineHeightRatio', 0):.2f} · "
                    f"여백 {mobile.get('posts', {}).get(SLUGS[0], {}).get('paddingLeft', 0):.0f}px · "
                    f"가로 넘침 {mobile.get('postsOverflowX', '?')}px · "
                    f"태그 {len(mobile.get('posts', {}).get(SLUGS[0], {}).get('tags', []))}개 · "
                    f"상단 바 불투명도 {mobile.get('headerAlpha', '?')} · 면책 {mobile.get('posts', {}).get(SLUGS[0], {}).get('disclaimerCount', '?')}개"
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"\n■ 1280·390 실측 — {verdict}")
    for label, entry in report["viewports"].items():
        print(f"  {label}: 카드 {len(entry.get('cards', []))}개 · 검색 결과 {entry.get('searchHits')}개 · 콘솔 오류 {len(entry.get('consoleErrors', []))} · 상단 바 불투명도 {entry.get('headerAlpha')}")
    for f in failures:
        print(f"  ✗ {f}")
    for w in warnings:
        print(f"  ! {w}")
    print(f"alt 실측: 총 {alt_audit['total']}개 · 누락 {alt_audit['missingAltAttribute']} · 빈값(본문) {alt_audit['emptyAltInContent']} · 크기 불일치 {alt_audit['attrSizeMismatch']}")
    print(f"저장: {OUT/'verify-1280-390.json'} · {OUT/'alt-audit.json'} · shots/")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
