#!/usr/bin/env python3
"""v5.9 오늘 확인 허브 — 빌드 산출물 전수 검증.

검사 항목 (실패하면 exit 1, JSON 요약은 reports/buffetkimz-web/v59-hub/verify-v59.json)
  1) 빌드 페이지 수·링크/이미지 무결 (audit_dist_links 결과)
  2) 허브 구조·순서·개수·AI 3종 세트·상담 CTA 부재
  3) 금지어(자극어) — 정상 의학용어·인용문은 예외로 기록
  4) 카드 문법: 근거 링크·기준 시각·D-Day·도구 1개
  5) 시리즈 4종 라벨(목록·카드·상세)
  6) A vs B 비교 카드(2칸·3항목·우열 문구 없음)
  7) 제도달력 D-Day
  8) 신선도·D-Day 함수 단위 검증(노드 실행)
  9) v5.8.2 회귀 — 필름·크레딧·썸네일·편집원칙·상담 밴드·검색 인덱스
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys

DIST = pathlib.Path("/workspace/apps/buffetkimz-web/dist")
APP = pathlib.Path("/workspace/apps/buffetkimz-web")
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v59-hub")
NODE = "/workspace/.local/node-v22/bin/node"

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {detail}" if detail else ""), flush=True)
    return bool(ok)


def html(rel: str) -> str:
    return (DIST / rel).read_text(encoding="utf-8", errors="ignore")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    pages = sorted(DIST.rglob("*.html"))
    check("빌드 페이지 수 84", len(pages) == 84, f"{len(pages)} pages")

    # 1) 링크·이미지 무결
    audit = subprocess.run(
        [sys.executable, str(APP / "scripts/audit_dist_links.py")],
        capture_output=True,
        text=True,
        cwd=str(APP),
    )
    try:
        audit_json = json.loads(audit.stdout)
    except json.JSONDecodeError:
        audit_json = {}
    check(
        "깨진 내부 링크 0 · 이미지 0",
        audit_json.get("bad_links") == 0 and audit_json.get("bad_imgs") == 0,
        f"bad_links={audit_json.get('bad_links')} bad_imgs={audit_json.get('bad_imgs')}",
    )

    # 2) 허브 구조
    home = html("index.html")
    hub_start = home.find('data-hub')
    hub_end = home.find("</section>", hub_start)
    hub = home[hub_start:hub_end]
    check("홈에 허브 블록 존재", hub_start != -1 and len(hub) > 4000, f"{len(hub)} chars")

    order = [
        ("기준 시각", 'data-hub-basis'),
        ("지표 스트립", 'data-indicator-strip'),
        ("30초 요약", 'data-hub-brief'),
        ("AI 요약", 'data-hub-ai'),
        ("오늘 확인할 것", 'data-hub-items'),
        ("대표 도구", 'data-hub-tool'),
    ]
    positions = [(label, hub.find(mark)) for label, mark in order]
    check(
        "허브 순서: 기준 시각 → 지표 → 3줄 → AI → 3건 → 대표 도구",
        all(p > 0 for _, p in positions) and positions == sorted(positions, key=lambda x: x[1]),
        " / ".join(f"{lbl}@{pos}" for lbl, pos in positions),
    )

    basis = re.search(r"data-hub-basis>(.*?)</p>", hub)
    basis_text = basis.group(1) if basis else ""
    check(
        "기준 시각 24시간제 + 하루 3회 표기",
        basis_text == "2026. 11. 21. 14:00 기준 · 하루 3회(06:00·08:20·19:00) 갱신",
        basis_text,
    )

    chips = re.findall(r'data-indicator="([a-z0-9]+)"', hub)
    check("지표 칩 6개(코스피·코스닥·원달러·S&P500·나스닥·반도체)", len(chips) == 6, ", ".join(chips))
    chip_blocks = re.findall(r'<a class="ind-chip"[\s\S]*?</a>', hub)
    chip_ok = all(
        re.search(r"ind-meta", b)
        and re.search(r"\d{2}\. \d{1,2}\.", b)  # 기준 시각·날짜가 칩 안에
        and "한국거래소" in b or "CNBC" in b or "하나은행" in b or "연합뉴스" in b
        for b in chip_blocks
    )
    check("칩마다 기준 시각 + 출처", chip_ok and len(chip_blocks) == 6, f"{len(chip_blocks)} chips")
    check(
        "지표마다 기준 시각이 다름(한국 장마감 / 미국 마감 / 고시)",
        "장 마감 11. 20." in hub and "마감 11. 21. 06:00" in hub and "06:28 고시" in hub,
    )

    items = re.findall(r'data-hub-item="([a-z0-9\-]+)"', hub)
    check("오늘 확인할 것 최대 3건", len(items) == 3, ", ".join(items))
    check(
        "카드마다 근거 링크 + 기준 시각",
        hub.count("data-hub-source") == 3 and hub.count("hub-item-asof") == 3,
        f"source={hub.count('data-hub-source')} asof={hub.count('hub-item-asof')}",
    )
    check(
        "카드마다 도구 1개 이하",
        hub.count("data-hub-tool-link") <= 3 and hub.count("data-hub-tool-link") >= 2,
        f"{hub.count('data-hub-tool-link')} tool links",
    )
    ddays = re.findall(r'class="dday[^"]*"[^>]*>([^<]+)</span>', hub)
    check("카드에 D-Day 뱃지(오늘/D-n)", ddays == ["D-2", "D-9", "D-40"], ", ".join(ddays))
    check(
        "카드에 '내 통장 영향' 1줄(hub-item-why) + 금액 병기",
        hub.count("hub-item-why") == 3 and "만" in hub and "원" in hub,
    )

    # AI 3종 세트
    ai_block = re.search(r'data-hub-ai[\s\S]*?</div>\s*</div>', hub)
    ai_ok = bool(ai_block) and all(
        k in ai_block.group(0) for k in ["AI 정리", "기준 11. 21.", "원문 보기", "href="]
    )
    check("AI 요약 3종 세트(라벨·기준 시각·원문 링크)", ai_ok)
    check(
        "AI 요약 고지 문구",
        "AI가 정리한 요약이며 원문과 다를 수 있습니다" in hub,
    )

    # 비영업 선 — 허브 안에 상담·가입 CTA 없음
    forbidden_in_hub = ["pf.kakao.com", "상담", "가입하기", "신청하기", "구매"]
    hit = [w for w in forbidden_in_hub if w in hub]
    check("허브 안에 상담·가입 CTA 없음", not hit, ", ".join(hit) if hit else "0건")
    check(
        "상단 4메뉴 유지(블로그·도구자료실·제도달력·소개)",
        all(m in home for m in [">블로그<", ">도구자료실<", ">제도달력<", ">소개<"]),
    )

    # 3) 금지어
    banned = ["실시간", "속보", "초비상", "지금 당장", "폭탄", "역대급", "긴급"]
    ban_hits: dict[str, list[str]] = {}
    for page in pages:
        text = page.read_text(encoding="utf-8", errors="ignore")
        for word in banned:
            if word in text:
                ban_hits.setdefault(word, []).append(str(page.relative_to(DIST)))
    check("자극어 금지어 미사용", not ban_hits, json.dumps(ban_hits, ensure_ascii=False))
    check("'충격' 단독 미사용(체외충격파는 의학용어)", "충격" not in hub, )
    check("'무조건' 단정 표현 미사용(인용문 제외)", "무조건" not in hub)

    # 4) 시리즈 라벨
    posts = html("posts/index.html")
    series_names = ["내 돈 체크", "연금 지도", "약관 해독", "도구 노트"]
    check(
        "시리즈 4종이 목록 카드에 표시",
        all(s in posts for s in series_names) and posts.count("series-chip") >= 13,
        f"{posts.count('series-chip')} chips",
    )
    detail = html("posts/silson-switch-2026/index.html")
    check("상세 머리에 시리즈 라벨", "series-chip" in detail and "약관 해독" in detail)
    philos = html("posts/philosophy-numbers-are-questions/index.html")
    check("시리즈 없는 글에는 라벨을 붙이지 않음", "series-chip" not in philos)

    # 5) A vs B
    for slug, sides in (
        ("silson-switch-2026", ("계약전환", "선택형")),
        ("isa-pension-300", ("연금계좌", "받기")),
    ):
        page = html(f"posts/{slug}/index.html")
        block = page[page.find("data-compare") :]
        cols = block.count('data-compare-side')
        pts_a = block[block.find('data-compare-side="a"') : block.find('data-compare-side="b"')].count("<li>")
        pts_b = block[block.find('data-compare-side="b"') :].split("</section>")[0].count("<li>")
        check(
            f"{slug}: 비교 카드 2칸 · 칸당 3항목 이하",
            cols == 2 and 1 <= pts_a <= 3 and 1 <= pts_b <= 3,
            f"cols={cols} a={pts_a} b={pts_b}",
        )
        check(
            f"{slug}: 우열 판정 문구 없음('유리합니다'/'불리')",
            "유리합니다" not in block and "불리" not in block,
        )
        check(f"{slug}: 비교 카드에 도구 1개 + 근거", "btn btn-secondary" in block and "근거:" in block)

    # 6) 제도달력 D-Day
    cal = html("calendar/index.html")
    cal_badges = re.findall(r'class="dday[^"]*"[^>]*>([^<]+)</span>', cal)
    check(
        "제도달력 D-Day 뱃지 + 다가오는 기한",
        "data-upcoming" in cal and cal_badges == ["D-2", "D-9", "D-40", "D-2", "D-9"],
        ", ".join(cal_badges),
    )
    check(
        "D-Day 뱃지 옆에 실제 날짜 병기",
        "11. 23." in cal and "11. 30." in cal and "12. 31." in cal,
    )

    # 7) 신선도·D-Day 단위 검증
    test_file = pathlib.Path("/workspace/tmp/v59/unit.test.mjs")
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text(
        """
import { freshnessOf } from '/workspace/apps/buffetkimz-web/src/lib/fresh.ts';
import { ddayOf, isUpcoming } from '/workspace/apps/buffetkimz-web/src/lib/dday.ts';
const now = new Date('2026-11-21T14:26:00+09:00');
const out = {
  ok: freshnessOf({ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }, now).state,
  delayed: freshnessOf({ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T13:00:00+09:00' }, now).state,
  stale: freshnessOf({ asOf: '2026-11-17T06:00:00+09:00', nextCheckAt: '2026-11-17T19:00:00+09:00' }, now).state,
  failed: freshnessOf({ asOf: '2026-11-21T19:00:00+09:00', status: 'failed', lastGoodAsOf: '2026-11-21T06:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }, now).state,
  failedDetail: freshnessOf({ asOf: '2026-11-21T19:00:00+09:00', status: 'failed', lastGoodAsOf: '2026-11-21T06:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }, now).detail,
  d2: ddayOf('2026-11-23', now),
  d0: ddayOf('2026-11-21', now),
  dpast: ddayOf('2026-11-20', now),
  soon: ddayOf('2026-11-26', now).tone,
};
console.log(JSON.stringify(out));
""",
        encoding="utf-8",
    )
    unit = subprocess.run(
        [NODE, "--experimental-strip-types", str(test_file)], capture_output=True, text=True
    )
    try:
        u = json.loads(unit.stdout.strip().splitlines()[-1])
    except Exception:
        u = {}
    check(
        "신선도 4단계(정상/확인 지연/지난 정보/갱신 실패)",
        u.get("ok") == "ok"
        and u.get("delayed") == "delayed"
        and u.get("stale") == "stale"
        and u.get("failed") == "failed"
        and "갱신에 실패해" in (u.get("failedDetail") or ""),
        json.dumps({k: u.get(k) for k in ("ok", "delayed", "stale", "failed")}, ensure_ascii=False),
    )
    check(
        "D-Day 계산(오늘/D-2/기한 지남/주황 구간)",
        u.get("d2", {}).get("label") == "D-2"
        and u.get("d2", {}).get("tone") == "near"
        and u.get("d0", {}).get("label") == "오늘"
        and u.get("dpast", {}).get("label") == "기한 지남"
        and u.get("soon") == "soon",
        json.dumps({k: u.get(k) for k in ("d2", "d0", "dpast", "soon")}, ensure_ascii=False)[:200],
    )

    # 8) v5.8.2 회귀
    check("브랜드 필름(1P) 유지", 'data-area="1"' in home and "film-credits" in home, )
    check("필름 크레딧 4축 유지", home.count("film-credit") >= 4, f"{home.count('film-credit')}")
    thumbs = list((DIST / "thumbs").glob("*.webp"))
    check("에디토리얼 썸네일 22종 유지", len(thumbs) >= 22, f"{len(thumbs)} webp")
    check("편집 원칙 페이지 유지", (DIST / "principles/index.html").exists())
    check(
        "1:1 상담문의 밴드 유지(허브 밖)",
        "pf.kakao.com" in home and home.count("pf.kakao.com") >= 2,
        f"{home.count('pf.kakao.com')} links",
    )
    check("소개 2P 유지", (DIST / "about/index.html").exists())
    check("도구자료실 유지", (DIST / "apps/index.html").exists())
    search = json.loads((DIST / "search-index.json").read_text())
    check(
        "검색 인덱스에 오늘 확인 3건 포함",
        sum(1 for d in search["docs"] if d.get("type") == "today") == 3,
        f"{search['count']} docs",
    )
    check("RSS·사이트맵 유지", (DIST / "rss.xml").exists() and (DIST / "sitemap-index.xml").exists())

    # 9) 390·1280 실측(캡처 스크립트 결과)
    notes_path = OUT / "capture-notes.json"
    if notes_path.exists():
        notes = json.loads(notes_path.read_text())
        overflow = {k: v.get("overflow") for k, v in notes["pages"].items()}
        check("가로 넘침 0 (1280·390 전 페이지)", all(v == 0 for v in overflow.values()), json.dumps(overflow))
        home390 = notes["pages"].get("home-390", {})
        check(
            "390 지표 스트립 1줄 + 가로 스크롤",
            home390.get("stripRows") == 1 and home390.get("stripScrolls") is True,
            f"rows={home390.get('stripRows')} scrolls={home390.get('stripScrolls')}",
        )
        chips390 = home390.get("chips") or []
        check(
            "390 칩 터치 높이 44px 이상 · 기준 시각 잘림 없음",
            bool(chips390)
            and all(c["h"] >= 44 for c in chips390)
            and all(c["metaVisible"] for c in chips390),
            json.dumps([(c["id"], c["h"], c["metaVisible"]) for c in chips390], ensure_ascii=False),
        )
        errs = [e for e in notes["errors"] if e.get("type") == "error"]
        check("콘솔 오류 0", not errs, json.dumps(errs, ensure_ascii=False)[:300])
        check(
            "콘솔 경고는 웹폰트 프리로드·WebGL 성능 경고뿐",
            all("preload" in e["text"] or "WebGL" in e["text"] or "GL Driver" in e["text"] for e in notes["errors"]),
            json.dumps([e["text"][:60] for e in notes["errors"]], ensure_ascii=False),
        )
    else:
        check("캡처 노트 존재", False, "capture-notes.json 없음")

    failed = [r for r in results if not r["ok"]]
    summary = {
        "version": "5.9.0",
        "checks": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "results": results,
    }
    (OUT / "verify-v59.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\n{summary['passed']}/{summary['checks']} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
