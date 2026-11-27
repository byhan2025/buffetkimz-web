#!/usr/bin/env python3
"""1순위 전수 점검 패치 검증 (2026-11-28) — dist를 로컬 서버로 띄워 실브라우저로 확인한다.

확인 항목 (사용자 전수 점검 리포트의 1순위·사소한 결함)
  ① 자료앨범 태그 필터 — 'ISA' 3세트(정확히 3), 다른 태그로 바뀌고, '전체'가 되돌린다
  ② 게시판 날짜 머리 건수 — 분류 필터를 고르면 23건 고정이 아니라 보이는 수로 바뀐다
  ③ 글 목록 리스트 보기 — 요약문이 사라지지 않는다
  ④ 실손 계산기 비교 문장 — '4세대이'가 아니라 '4세대가'
  ⑤ 소식지 — 사이트 자기 주소 링크가 배포 경로로 바뀌고, 국세청 링크 쿼리가 잘리지 않는다
  ⑥ 홈 모듈 기준일 — 11.21 고정이 아니라 생성된 사이트 기준일
  ⑦ 404 — canonical이 /404/가 아니라 사이트 첫 화면
  ⑧ 사이트맵 — lastmod가 한 날짜로 고정되지 않는다
  ⑨ 1280·390 콘솔 오류 0 · 가로 넘침 0 (수정 지점 화면)

사용:
  bash scripts/build_with_lock.sh build      # 도메인 루트 dist
  python3 scripts/verify_first_priority_20261128.py
결과: reports/buffetkimz-web/first-priority-20261128/verify.json · shots/*.png
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "reports/buffetkimz-web/first-priority-20261128"
PORT = 4361
BASE = f"http://127.0.0.1:{PORT}"
checks: list[dict] = []


def add(name: str, ok: bool, detail=None):
    checks.append({"check": name, "ok": bool(ok), "detail": detail})


def serve():
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(DIST)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def overflow(page) -> int:
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "shots").mkdir(exist_ok=True)
    server = serve()
    report: dict = {"base": BASE, "checks": checks}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for width, height in ((1280, 900), (390, 844)):
                ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ko-KR")
                page = ctx.new_page()
                errors: list[str] = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))

                # ① 자료앨범 태그
                page.goto(f"{BASE}/gallery/", wait_until="networkidle")
                total = page.inner_text("[data-gallery-count]")
                page.click('[data-gallery-tag="ISA"]')
                page.wait_for_timeout(150)
                isa = page.inner_text("[data-gallery-count]")
                isa_slides = page.inner_text("[data-gallery-count-slides]")
                visible = page.eval_on_selector_all(
                    "[data-gallery-item]", "els => els.filter(e => !e.hidden).length"
                )
                if width == 1280:
                    add("① ISA 태그 = 3세트", isa == "3" and visible == 3, {"count": isa, "visible": visible, "slides": isa_slides})
                # 다른 태그를 누르면 그 태그 하나로 바뀐다(칩에 적힌 수와 같아야 한다)
                chip_3d = page.inner_text('[data-gallery-tag="3D 카드"]')
                page.click('[data-gallery-tag="3D 카드"]')
                page.wait_for_timeout(120)
                other = page.inner_text("[data-gallery-count]")
                visible3d = page.eval_on_selector_all("[data-gallery-item]", "els => els.filter(e => !e.hidden).length")
                chip_num = re.findall(r"(\d+)$", chip_3d.strip())
                if width == 1280:
                    add(
                        "① 태그 단일 교체 = 칩의 수",
                        other == str(visible3d) and (not chip_num or other == chip_num[-1]),
                        {"chip": chip_3d.strip(), "shown": other, "visible": visible3d},
                    )
                page.click('[data-gallery-tag=""]')
                page.wait_for_timeout(120)
                back = page.inner_text("[data-gallery-count]")
                if width == 1280:
                    add("① 전체 버튼이 되돌린다", back == total, {"before": total, "after": back})
                page.screenshot(path=str(OUT / "shots" / f"gallery-{width}.png"), full_page=False)
                add(f"⑨ 자료앨범 {width} 콘솔 오류 0", not errors, errors[:3])
                add(f"⑨ 자료앨범 {width} 가로 넘침 0", overflow(page) <= 0, overflow(page))
                errors.clear()

                # ② 게시판 날짜 머리 건수
                page.goto(f"{BASE}/board/", wait_until="networkidle")
                before = page.eval_on_selector_all(
                    "[data-board-day]", "els => els.map(e => e.querySelector('[data-board-day-count]').textContent)"
                )
                page.click('[data-board-tab="제도·보험"]')
                page.wait_for_timeout(150)
                after = page.eval_on_selector_all(
                    "[data-board-day]", "els => els.filter(e => !e.hidden).map(e => { "
                    "const c = e.querySelector('[data-board-day-count]').textContent;"
                    "const v = Array.from(e.querySelectorAll('[data-board-entry]')).filter(x => !x.hidden).length;"
                    "return c + '/' + v; })"
                )
                if width == 1280:
                    add(
                        "② 날짜 머리 건수 = 보이는 건수",
                        bool(after) and all(a.split("/")[0] == a.split("/")[1] for a in after),
                        {"before": before[:3], "after": after[:5]},
                    )
                add(f"⑨ 게시판 {width} 콘솔 오류 0", not errors, errors[:3])
                errors.clear()

                # ③ 글 목록 리스트 보기 요약문
                page.goto(f"{BASE}/posts/", wait_until="networkidle")
                page.click('button[data-view="text"]')
                page.wait_for_timeout(150)
                shown = page.eval_on_selector_all(
                    "[data-card-summary]", "els => els.filter(e => e.offsetHeight > 0 && e.textContent.trim().length > 0).length"
                )
                if width == 1280:
                    add("③ 리스트 보기에서 요약문이 보인다", shown > 0, {"visibleSummaries": shown})
                add(f"⑨ 자산리포트 {width} 콘솔 오류 0", not errors, errors[:3])
                add(f"⑨ 자산리포트 {width} 가로 넘침 0", overflow(page) <= 0, overflow(page))
                errors.clear()

                # ④ 실손 비교 문장
                page.goto(f"{BASE}/apps/silson-compare/run/", wait_until="networkidle")
                page.wait_for_timeout(600)
                body = page.inner_text("body")
                if width == 1280:
                    hit = re.findall(r"[1-5]세대[이가] (?:가장 많이|[0-9,]+원 더) 돌려받습니다", body)
                    add("④ '4세대이' 없음", "4세대이" not in body, hit[:4])
                add(f"⑨ 실손 {width} 콘솔 오류 0", not errors, errors[:3])
                add(f"⑨ 실손 {width} 가로 넘침 0", overflow(page) <= 0, overflow(page))
                errors.clear()

                # ⑤ 소식지 링크
                page.goto(f"{BASE}/letters/2026-11-21/", wait_until="networkidle")
                hrefs = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
                if width == 1280:
                    own = [h for h in hrefs if "/posts/silson-switch-2026" in h]
                    nts = [h for h in hrefs if "nts.go.kr" in h and "cntntsId=7875" in h]
                    add(
                        "⑤ 소식지 글 링크가 현재 사이트로 연결",
                        bool(own) and all(h.startswith(BASE) or h.startswith("https://buffetkimz.com/") for h in own),
                        own[:2],
                    )
                    add("⑤ 국세청 링크 쿼리 유지", bool(nts) and all("mi=2304" in h for h in nts), nts[:2])
                    add("⑤ '발행 파이프라인' 문구 없음", "발행 파이프라인" not in page.inner_text("body"))
                add(f"⑨ 소식지 {width} 콘솔 오류 0", not errors, errors[:3])
                errors.clear()

                # ⑥ 홈 기준일
                page.goto(f"{BASE}/", wait_until="networkidle")
                chips = page.eval_on_selector_all(".mod-chip", "els => els.map(e => e.textContent.trim())")
                if width == 1280:
                    add("⑥ 홈 모듈 기준일이 11.21 고정이 아님", all("11. 21." not in c for c in chips), chips)
                add(f"⑨ 홈 {width} 콘솔 오류 0", not errors, errors[:4])
                add(f"⑨ 홈 {width} 가로 넘침 0", overflow(page) <= 0, overflow(page))
                errors.clear()
                ctx.close()

            # ⑦ 404 canonical
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            page = ctx.new_page()
            page.goto(f"{BASE}/404.html", wait_until="domcontentloaded")
            canonical = page.get_attribute('link[rel="canonical"]', "href")
            add(
                "⑦ 404 canonical이 사이트 첫 화면",
                bool(canonical) and canonical.rstrip("/") in (BASE.rstrip("/"), "https://buffetkimz.com"),
                canonical,
            )
            ctx.close()

            # ⑧ 사이트맵 lastmod
            xml = (DIST / "sitemap-0.xml").read_text(encoding="utf-8")
            mods = sorted(set(re.findall(r"<lastmod>([^<]+)</lastmod>", xml)))
            add("⑧ 사이트맵 lastmod가 페이지별로 다르다", len(mods) >= 4, {"distinct": len(mods), "sample": mods[:4]})
            browser.close()
    finally:
        server.terminate()

    report["ok"] = all(c["ok"] for c in checks)
    report["failed"] = [c for c in checks if not c["ok"]]
    (OUT / "verify.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "checks": len(checks), "failed": report["failed"]}, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(run())
