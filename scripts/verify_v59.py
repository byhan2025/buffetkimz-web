#!/usr/bin/env python3
"""v5.9 오늘 확인 허브 — 빌드 산출물 전수 검증 (v5.9.3 판).

경로는 이 파일 위치 기준 상대경로다 — 압축을 풀어 다른 폴더에 놓아도 그대로 재실행된다.
  APP  = <repo>/apps/buffetkimz-web        (이 파일의 부모의 부모)
  DIST = APP/dist                          (npm run build 결과)
  OUT  = <repo>/reports/buffetkimz-web/v593-hub

검사 항목 (실패하면 exit 1, JSON 요약은 OUT/verify-v59.json)
  1) 빌드 페이지 수·링크/이미지 무결 (audit_dist_links 결과)
  2) 허브 구조·순서·개수·AI 3종 세트·상담 CTA 부재
  3) 금지어(자극어) — 정상 의학용어·인용문은 예외로 기록
  4) 카드 문법: 근거 링크·기준 시각·D-Day·도구 1개
  5) 시리즈 4종 라벨(목록·카드·상세)
  6) A vs B 비교 카드(2칸·3항목·우열 문구 없음)
  7) 제도달력 D-Day
  8) 신선도·D-Day 함수 단위 검증(노드 실행)
  9) v5.8.2 회귀 — 필름·크레딧·썸네일·편집원칙·상담 밴드·검색 인덱스
 10) 실측(캡처 노트) — 1280·390 넘침, 칩 높이
 11) v5.9.1 — data-* 속성·클라이언트 재계산 스크립트·런타임 전환·390 키보드 포커스·잘림 0
     · 실손 청약철회 3단계 조건 · 원/달러 라벨=링크 · '초기 실손' 용어 정리 · 제도달력 1차 출처
 12) v5.9.2 — 실손 옛 문구('6개월간 시행'·'연장 여부') 0건 + 공식 기준 문장 반영,
     '수동 확인' 모드(자동 갱신 약속 없음) · 390 스와이프 힌트 24px 페이드 · 원/달러 근거 스냅샷 동봉
 13) v5.9.3 — scheduleConnected 엄격 분리(수동·실패 false / 성공 + --schedule-connected 만 true),
     package.json 버전 6.0.0 이상(6.x 라인), 리포트·번들 존재
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
REPO = APP.parent.parent
OUT = REPO / "reports" / "buffetkimz-web" / "v60-live"  # v6.0 실측(capture_v60.py)
LEGACY = REPO / "reports" / "buffetkimz-web" / "v593-hub"  # v5.9.3 증빙(리포트·플립·원문 스냅샷)
REPORT_DIR = OUT
SRC = APP / "src"
NODE = shutil.which("node") or "/workspace/.local/node-v22/bin/node"

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
    check("빌드 페이지 수 88 (v6.0 연금 인출 4페이지 추가)", len(pages) == 88, f"{len(pages)} pages")

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
    # v5.9.2 — 자동 갱신이 아직 붙지 않았으므로 '하루 3회 갱신'이 아니라 '수동 확인'만 말한다
    check(
        "기준 시각 24시간제 + '수동 확인' 표기",
        basis_text == "2026. 11. 21. 14:00 수동 확인",
        basis_text,
    )
    check(
        "수동 확인 모드 — '하루 3회'·'다음 확인 19:00' 자동 갱신 약속 없음",
        "하루 3회" not in hub and "다음 확인" not in hub,
        f"하루3회={hub.count('하루 3회')} 다음확인={hub.count('다음 확인')}",
    )
    check(
        "수동 확인 모드 — 헤더에 '정기 자동 갱신 연결 준비 중'",
        'data-hub-schedule-note' in hub and hub.count("정기 자동 갱신 연결 준비 중") >= 1,
    )
    notice_m = re.search(r"data-hub-notice>([^<]*)</p>", hub)
    notice_text = notice_m.group(1).strip() if notice_m else ""
    check(
        "수동 확인 모드 — 하단 고지도 '수동 확인 값'임을 밝탐",
        "2026. 11. 21. 14:00 수동 확인 값이고, 정기 자동 갱신 연결 준비 중입니다" in notice_text
        and "아직 정기 자동 갱신에 연결되지 않았습니다" in notice_text,
        notice_text[:160],
    )
    check(
        "수동 확인 모드 — 허브 섹션 data-schedule-connected=false",
        'data-schedule-connected="false"' in hub,
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
    check(
        "카드마다 발행일·수집 시각 메타(title) 부착",
        hub.count("수집 2026. 11. 21. 14:00") >= 2 and "발행 2026-11-19" in hub,
        f"title={hub.count('수집 2026. 11. 21. 14:00')}",
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
    holder = pathlib.Path(tempfile.mkdtemp(prefix="v591-unit-"))
    test_file = holder / "unit.test.mjs"
    test_file.write_text(
        f"""
import {{ freshnessOf }} from '{(APP / 'src/lib/fresh.ts').as_uri()}';
import {{ ddayOf, isUpcoming }} from '{(APP / 'src/lib/dday.ts').as_uri()}';
const now = new Date('2026-11-21T14:26:00+09:00');
const out = {{
  ok: freshnessOf({{ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }}, now).state,
  delayed: freshnessOf({{ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T13:00:00+09:00' }}, now).state,
  delayedDetail: freshnessOf({{ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T13:00:00+09:00' }}, now).detail,
  delayedManualDetail: freshnessOf({{ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T13:00:00+09:00', scheduleConnected: false }}, now).detail,
  delayedAutoLabel: freshnessOf({{ asOf: '2026-11-21T14:00:00+09:00', nextCheckAt: '2026-11-21T13:00:00+09:00', scheduleConnected: true }}, now).detail,
  stale: freshnessOf({{ asOf: '2026-11-17T06:00:00+09:00', nextCheckAt: '2026-11-17T19:00:00+09:00' }}, now).state,
  failed: freshnessOf({{ asOf: '2026-11-21T19:00:00+09:00', status: 'failed', lastGoodAsOf: '2026-11-21T06:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }}, now).state,
  failedDetail: freshnessOf({{ asOf: '2026-11-21T19:00:00+09:00', status: 'failed', lastGoodAsOf: '2026-11-21T06:00:00+09:00', nextCheckAt: '2026-11-21T19:00:00+09:00' }}, now).detail,
  d2: ddayOf('2026-11-23', now),
  d0: ddayOf('2026-11-21', now),
  dpast: ddayOf('2026-11-20', now),
  soon: ddayOf('2026-11-26', now).tone,
  customStale: freshnessOf({{ asOf: '2026-11-20T06:00:00+09:00', nextCheckAt: '2026-11-20T19:00:00+09:00', staleAfterDays: 1 }}, now).state,
}};
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
        and "갱신에 실패해" in (u.get("failedDetail") or "")
        and "마지막 확인" in (u.get("delayedDetail") or "")
        and "정기 자동 갱신이 아직 연결되지 않았습니다" in (u.get("delayedManualDetail") or "")
        and "다음 확인이 지연되고 있습니다" in (u.get("delayedAutoLabel") or "")
        and u.get("customStale") == "stale",
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
        grid = (notes.get("v60") or {}).get("grid390") or {}
        check(
            "390 지표 6개가 2열×3행 격자(스와이프 없이 한 화면)",
            home390.get("stripRows") == 3
            and grid.get("cols") == 2
            and home390.get("stripScrolls") is False
            and grid.get("allInViewport") is True,
            f"rows={home390.get('stripRows')} cols={grid.get('cols')} scroll={home390.get('stripScrolls')} allInView={grid.get('allInViewport')}",
        )
        check(
            "390 지표 격자 — 가로 넘침 0 · 페이드 힌트 제거",
            grid.get("stripOverflowX") == "visible" and grid.get("fadeWidth") in ("auto", "0px"),
            f"overflowX={grid.get('stripOverflowX')} fade={grid.get('fadeWidth')}",
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

    # 10) v5.9.1 — 런타임 신선도 재계산 (브라우저 스크립트)
    sec = re.search(r'<section[^>]*data-hub[^>]*>', home).group(0)
    check(
        "허브 섹션에 신선도 data-* 5종",
        all(re.search(rf'\b{a}(=|\s|>)', sec) for a in ("data-as-of", "data-next-check-at", "data-stale-days", "data-status", "data-last-good-as-of")),
        sec[:220],
    )
    item_blocks = re.findall(r'<li class="hub-item"[^>]*>', hub)
    check(
        "카드마다 신선도 data-* 부착",
        len(item_blocks) == 3
        and all("data-as-of=" in b and "data-status=" in b and "data-stale-days=" in b for b in item_blocks),
        f"{len(item_blocks)} li",
    )
    inline_scripts = re.findall(r'<script type="module">(.*?)</script>', home, re.S)
    runtime_script = next(
        (s for s in inline_scripts if "data-fresh-badge" in s or "hub-fresh" in s), ""
    )
    check(
        "클라이언트 재계산 스크립트 포함(1분 간격)",
        bool(runtime_script) and re.search(r"6e4|60000", runtime_script) is not None and "setInterval" in runtime_script,
        f"{len(runtime_script)} chars",
    )
    check(
        "브라우저 스크립트가 fresh.ts 규칙을 그대로 씀",
        "지연되고 있습니다" in runtime_script and "864e5" in runtime_script and "freshCheckedAt" in runtime_script,
        "freshnessOf 번들 확인",
    )
    check(
        "수동 확인 모드 — '다음 확인' 대신 준비 중 한 줄 + 숨은 배지",
        "data-hub-next" not in hub and "data-fresh-badge" in hub and "hidden" in hub,
    )

    # 11) v5.9.1 — 실측(런타임 전환·390 포커스·잘림)
    if notes_path.exists():
        notes = json.loads(notes_path.read_text())
        runtime = notes.get("runtime", {})
        states = {k: ((v.get("atLoad") or {}).get("state"), ((v.get("afterFastForward") or {}).get("state"))) for k, v in runtime.items()}
        check(
            "런타임: 18:30 정상 · 19:30 확인 지연",
            states.get("ok-before-next-check") == ("ok", None) and states.get("delayed-at-load") == ("delayed", None),
            json.dumps(states, ensure_ascii=False),
        )
        delayed = (runtime.get("delayed-at-load") or {}).get("atLoad") or {}
        check(
            "확인 지연 배지 문구가 실제로 바뀜(마지막 확인 11. 21. 14:00)",
            delayed.get("badgeHidden") is False
            and delayed.get("badgeLabel") == "확인 지연"
            and "마지막 확인 11. 21. 14:00" in (delayed.get("badgeDetail") or "")
            and "정기 자동 갱신이 아직 연결되지 않았습니다" in (delayed.get("badgeDetail") or "")
            and delayed.get("nextHidden") in (None, True)
            and delayed.get("basisText") == "2026. 11. 21. 14:00 수동 확인"
            and delayed.get("scheduleNote") == "정기 자동 갱신 연결 준비 중",
            json.dumps(delayed, ensure_ascii=False)[:300],
        )
        check(
            "1분 경과 후 자동 재계산(18:59 → 19:00:30 확인 지연)",
            states.get("interval-flips") == ("ok", "delayed"),
            json.dumps(states.get("interval-flips"), ensure_ascii=False),
        )
        check(
            "3일 경과 시 지난 정보",
            states.get("stale-after-3days") == ("stale", None),
            json.dumps(states.get("stale-after-3days"), ensure_ascii=False),
        )
        check(
            "확인 지연 캡처 13-hub-stale-runtime.png 저장",
            (OUT / "13-hub-stale-runtime.png").exists(),
            f"{(OUT / '13-hub-stale-runtime.png').stat().st_size if (OUT / '13-hub-stale-runtime.png').exists() else 0} bytes",
        )

        focus = notes.get("focus") or {}
        steps = focus.get("steps") or []
        check(
            "390 Tab으로 지표 칩 6개 순서대로 포커스",
            [s["id"] for s in steps] == ["kospi", "kosdaq", "usdkrw", "sp500", "nasdaq", "sox"],
            ", ".join(s["id"] for s in steps),
        )
        check(
            "포커스된 칩이 화면·스트립 안에 전부 표시(잘림 0)",
            len(steps) == 6 and all(s["inViewport"] and s["inStrip"] and s["metaInViewport"] for s in steps),
            json.dumps([(s["id"], s["inViewport"], s["inStrip"], s["metaInViewport"]) for s in steps], ensure_ascii=False),
        )
        check(
            "포커스 링 실제 표시(outline 2px 이상)",
            all(s["focusRingVisible"] for s in steps),
            json.dumps([(s["id"], s["outline"]["width"]) for s in steps], ensure_ascii=False),
        )
        check(
            "격자에서는 스트립 가로 스크롤 0(포커스가 칩을 옆으로 밀지 않음)",
            bool(steps) and all((s["strip"]["scrollLeft"] or 0) == 0 for s in steps),
            json.dumps([(s["id"], s["strip"]["scrollLeft"]) for s in steps], ensure_ascii=False),
        )
        check(
            "칩 포커스 캡처 12·12b 저장",
            (OUT / "12-home-focus-usdkrw-390.png").exists() and (OUT / "12b-home-focus-nasdaq-390.png").exists(),
        )
        check(
            "sticky 헤더에 포커스된 칩이 가리지 않음",
            all(not s["underHeader"] for s in steps),
        )

        clip = notes.get("clip390") or {}
        check(
            "390 잘림 0 — 허브·제도달력·비교 카드",
            bool(clip)
            and all(
                (clip.get(k) or {}).get("outOfViewportCount") == 0 and (clip.get(k) or {}).get("textClippedCount") == 0
                for k in ("hub", "calendar", "compare-silson")
            ),
            json.dumps({k: [(v or {}).get("outOfViewportCount"), (v or {}).get("textClippedCount")] for k, v in clip.items()}, ensure_ascii=False),
        )

    # 12) v5.9.1 — 4호 봇 지적 4건(문구·출처)이 화면에 반영됐는지
    silson_detail = html("posts/silson-switch-2026/index.html")
    check(
        "실손 철회 조건 3단계가 글에 있음(3개월 무조건·3~6개월 사고 없음·재전환 불가)",
        "3개월 안에는 조건 없이" in silson_detail
        and "3개월이 지나 6개월" in silson_detail
        and "50% 할인은 다시 받을 수 없" in silson_detail,
    )
    check(
        "실손 철회 조건이 달력·허브 카드에도 있음",
        "3개월은 조건 없이" in cal and "3~6개월은 보험사고가 없을 때만" in hub,
    )
    check(
        "원/달러 라벨과 링크가 일치(네이버 금융 시장지표)",
        'data-indicator="usdkrw"' in hub
        and 'href="https://finance.naver.com/marketindex/"' in hub
        and "네이버 금융 시장지표" in hub,
    )
    check(
        "'초기 실손' 표현이 남아 있지 않음(1·2세대 실손으로 통일)",
        not any("초기 실손" in p.read_text(encoding="utf-8", errors="ignore") for p in pages),
    )
    check(
        "제도달력 갱신 보험료 항목의 출처가 1차 근거(보험개발원·보험다모아)",
        "보험개발원 참조순보험료율" in cal and "e-insmarket.or.kr" in cal and "보험업계 발표" not in cal,
    )

    # 13) v5.9.2 — 실손 신청 기간 문구 교정 (옛 표현 전수 0건)
    OLD_PHRASES = ("6개월간 시행", "연장 여부", "6개월 뒤 연장", "6개월이 지난 뒤 연장")
    stale_src: dict[str, list[str]] = {w: [] for w in OLD_PHRASES}
    for f in SRC.rglob("*"):
        if f.suffix not in {".md", ".ts", ".tsx", ".astro", ".css", ".json"} or not f.is_file():
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        for w in OLD_PHRASES:
            if w in t:
                stale_src[w].append(str(f.relative_to(APP)))
    check(
        "실손 옛 문구 src 0건('6개월간 시행'·'연장 여부')",
        not any(stale_src.values()),
        json.dumps({k: v for k, v in stale_src.items() if v}, ensure_ascii=False),
    )

    stale_build: dict[str, list[str]] = {}
    for f in pages + list((DIST / "_astro").glob("*.js")):
        t = f.read_text(encoding="utf-8", errors="ignore")
        for w in OLD_PHRASES:
            if w in t:
                stale_build.setdefault(w, []).append(f.name)
    check("빌드 산출물(HTML·JS)에도 옛 문구 0건", not stale_build, json.dumps(stale_build, ensure_ascii=False))

    silson_post = html("posts/insurance-silson-5th/index.html")
    check(
        "실손 5세대 글 — 공식 신청 기간·3년 50% 할인으로 교정",
        "2026년 11월 23일부터 2027년 5월 22일까지 6개월간 받으며" in silson_post
        and "새로 산출된 5세대 보험료를 3년간 50% 할인합니다" in silson_post,
    )
    check(
        "실손 전환 글 — 원문에 없는 '연장 검토' 삭제, 신청 기간·할인 3년 명시",
        "2026년 11월 23일부터 2027년 5월 22일까지 6개월간 받습니다" in silson_detail
        and "5세대 보험료를 3년간 50% 할인합니다" in silson_detail,
    )
    tool_text = " ".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in [DIST / "apps" / "silson-compare" / "run" / "index.html"] + list((DIST / "_astro").glob("*.js"))
    )
    check(
        "실손 비교 도구 — 전환 신청 기간·3년 50% 문구",
        "6개월간(2027년 5월 22일까지) 받으며" in tool_text and "3년간 50% 할인합니다" in tool_text,
    )

    # 14) v6.0 — 390 2열×3행 · [3줄 복사] · 1280 6열 (v5.9.2 스와이프 페이드는 격자 전환으로 폐기)
    notes = json.loads(notes_path.read_text()) if notes_path.exists() else {}
    v60 = notes.get("v60") or {}
    grid390 = v60.get("grid390") or {}
    grid1280 = v60.get("grid1280") or {}
    copy = v60.get("copy") or {}
    check(
        "390 홈 계측 — 수동 확인 문구(기준 줄·준비 중)·'다음 확인' 없음",
        (notes.get("pages", {}).get("home-390", {}).get("scheduleConnected") == "false")
        and (notes.get("pages", {}).get("home-390", {}).get("hubBasis") == "2026. 11. 21. 14:00 수동 확인")
        and (notes.get("pages", {}).get("home-390", {}).get("scheduleNote") == "정기 자동 갱신 연결 준비 중")
        and (notes.get("pages", {}).get("home-390", {}).get("nextCheck") is None),
    )
    check(
        "1280 지표 스트립 6열 1줄 유지 · 가로 스크롤 0",
        grid1280.get("cols") == 6 and grid1280.get("rows") == 1 and grid1280.get("scrolls") is False,
        f"rows={grid1280.get('rows')} cols={grid1280.get('cols')} scroll={grid1280.get('scrolls')}",
    )
    check(
        "1280에서는 스와이프 페이드 없음(모바일 전용)",
        (grid1280.get("fadeWidth") or "auto") != "24px",
        f"fade={grid1280.get('fadeWidth')}",
    )
    check(
        "[3줄 복사] 버튼 — 누르면 클립보드에 정확히 3줄",
        copy.get("labelBefore") == "3줄 복사"
        and copy.get("labelAfter") == "복사했습니다"
        and copy.get("lines") == 3
        and isinstance(copy.get("clipboard"), str)
        and copy["clipboard"].startswith("1. "),
        json.dumps({k: copy.get(k) for k in ("labelBefore", "labelAfter", "lines")}, ensure_ascii=False),
    )
    check("3줄 복사 캡처 21 저장", (OUT / "21-home-brief-copy-390.png").exists())
    check("390 지표 격자 캡처 20·1280 캡처 22 저장", (OUT / "20-home-grid-390.png").exists() and (OUT / "22-home-grid-1280.png").exists())

    # 15) v5.9.2 — 원/달러 네이버 금융 원문 근거
    ev = LEGACY / "usd-krw-evidence.txt"
    ev_text = ev.read_text(encoding="utf-8", errors="ignore") if ev.exists() else ""
    check(
        "원/달러 근거 스냅샷 동봉(1,346.50 · 06:28 · 네이버 원문 URL)",
        ev.exists() and "1,346.50" in ev_text and "06:28" in ev_text and "api.stock.naver.com" in ev_text,
        f"{ev.stat().st_size} bytes" if ev.exists() else "missing",
    )
    check(
        "원/달러 칩 값·기준 시각·직전 고시가 근거와 일치",
        "1,346.50" in hub and "06:28 고시" in hub and "1,335.50" in hub,
    )

    # 16) v5.9.3 — scheduleConnected 엄격 분리 (수동·실패 false / 성공 + 플래그만 true)
    sys.path.insert(0, str(APP / "scripts"))
    import update_today_hub as hub_check  # noqa: E402

    today_text = hub_check.DEFAULT_FILE.read_text(encoding="utf-8")
    payload_ok = {
        "asOf": "2026-11-21T19:00:41+09:00",
        "nextCheckAt": "2026-11-22T06:00:00+09:00",
        "indicators": [],
    }
    manual_ok, plan_manual = hub_check.update_text(today_text, payload_ok)
    manual_fail, plan_fail = hub_check.update_text(today_text, {"status": "failed"})
    flagged_ok, plan_flagged = hub_check.update_text(today_text, payload_ok, schedule_connected=True)
    flagged_fail, plan_flagged_fail = hub_check.update_text(
        today_text, {"status": "failed"}, schedule_connected=True
    )
    check(
        "수동 실행(성공·실패)은 scheduleConnected false 유지",
        plan_manual["scheduleConnected"] is False
        and plan_fail["scheduleConnected"] is False
        and manual_ok.count("scheduleConnected: false") == 1
        and "scheduleConnected: true" not in manual_ok
        and manual_fail.count("scheduleConnected: false") == 1
        and "scheduleConnected: true" not in manual_fail,
        f"manual_ok={plan_manual['scheduleConnected']} manual_fail={plan_fail['scheduleConnected']}",
    )
    check(
        "성공 + --schedule-connected 일 때만 true",
        plan_flagged["scheduleConnected"] is True and flagged_ok.count("scheduleConnected: true") == 1,
        f"flagged_ok={plan_flagged['scheduleConnected']}",
    )
    check(
        "--fail + --schedule-connected 는 false 유지",
        plan_flagged_fail["scheduleConnected"] is False
        and "scheduleConnected: true" not in flagged_fail
        and flagged_fail.count("scheduleConnected: false") == 1,
        f"flagged_fail={plan_flagged_fail['scheduleConnected']}",
    )
    pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
    pkg_version = str(pkg.get("version", "0"))

    def _ver(v: str) -> tuple[int, ...]:
        """'6.3.0' → (6, 3, 0). 숫자가 아니면 (0,)로 두어 실패시킨다."""
        try:
            return tuple(int(x) for x in v.split(".")[:3])
        except ValueError:
            return (0,)

    # v6.3 — 버전을 6.0.0으로 고정하지 않고 6.x 라인 이상인지만 본다(마이너 업마다 검증기를 고치지 않게)
    check(
        "package.json 버전 6.0.0 이상(6.x 라인)",
        _ver(pkg_version) >= (6, 0, 0),
        pkg_version,
    )

    report = (LEGACY / "00-v593-report.md")
    report_text = report.read_text(encoding="utf-8", errors="ignore") if report.exists() else ""
    check(
        "리포트에 범위 명시 — Pages 정보허브 패치 / 도메인 컷오버는 3단계 범위",
        "byhan2025.github.io/buffetkimz-web/` 기준 정보허브 패치이며 `buffetkimz.com` DNS·CNAME은 별도 3단계 도메인 컷오버 범위임"
        in report_text,
        f"{len(report_text)} chars",
    )
    check(
        "리포트에 원/달러 기준일(11. 20.)·고시시각(11. 21. 06:28) 구분",
        "기준일 11. 20." in report_text and "06:28" in report_text and "localTradedAt \"2026-11-20\"" in report_text,
    )
    flip = LEGACY / "auto-mode-flip.json"
    flip_json = json.loads(flip.read_text(encoding="utf-8")) if flip.exists() else {}
    flip_auto = (flip_json.get("auto") or {}).get("1280") or {}
    check(
        "자동 모드 실측·원상 복구 기록(auto-mode-flip.json)",
        flip.exists()
        and flip_json.get("file_after") == "scheduleConnected: true"
        and flip_auto.get("scheduleConnected") == "true"
        and "자동 확인" in (flip_auto.get("hubBasis") or "")
        and all((flip_json.get("restored") or {}).values()),
        json.dumps(flip_json.get("restored"), ensure_ascii=False),
    )

    # 17) v6.0 — 연금 인출·세금 시뮬레이터 통합 (설계서 §6.2 삽입 지점 8곳)
    import hashlib as _hash

    src_engine = APP / "src" / "lib" / "pension-engine.mjs"
    rep_engine = REPO / "reports" / "buffetkimz-web" / "v60-pension-sim" / "pension_engine.mjs"
    check(
        "엔진 사본이 보고서 원본과 해시 동일(복사 후 수정 금지)",
        src_engine.exists()
        and rep_engine.exists()
        and _hash.sha256(src_engine.read_bytes()).hexdigest() == _hash.sha256(rep_engine.read_bytes()).hexdigest(),
        _hash.sha256(src_engine.read_bytes()).hexdigest()[:16] if src_engine.exists() else "missing",
    )
    check("① ToolRunner에 pension-draw 연결", '"pension-draw": PensionDraw' in (SRC / "components/tools/ToolRunner.tsx").read_text(encoding="utf-8"))
    tools_src = (SRC / "data/tools.ts").read_text(encoding="utf-8")
    check("② tools.ts 메인 도구에 pension-draw", 'key: "pension-draw"' in tools_src and 'group: "main"' in tools_src)
    check("④ apps.ts 항목 + art 유니온", 'slug: "pension-draw"' in (SRC / "data/apps.ts").read_text(encoding="utf-8"))
    check("⑤ AppArt 분기", 'art === "pension-draw"' in (SRC / "components/AppArt.astro").read_text(encoding="utf-8"))
    check("⑧ 홈 shortToolLabel", '"pension-draw": "인출 세금 계산 열기"' in (SRC / "pages/index.astro").read_text(encoding="utf-8"))
    cal_src = (SRC / "data/calendar.ts").read_text(encoding="utf-8")
    check(
        "⑥ 12월 31일 납입 마감 카드 → 시뮬레이터 연결",
        'dueDate: "2026-12-31"' in cal_src and 'toolHref: "/apps/pension-draw/run"' in cal_src,
    )

    pdraw_detail = html("apps/pension-draw/index.html")
    pdraw_run = html("apps/pension-draw/run/index.html")
    check("연금 인출 소개·실행 페이지 존재(HTTP 200 상당)", bool(pdraw_detail) and bool(pdraw_run))
    check(
        "상호 링크 — 인출→세액공제 / 세액공제→인출 (각 1개)",
        "세액공제 계산기로 이어가기" in pdraw_run
        and "인출·세금 시뮬레이터" in html("apps/pension-tax/run/index.html")
        and html("apps/pension-tax/run/index.html").count("pension-draw/run") == 1
        and pdraw_run.count("pension-tax/run") == 1,
    )
    pd = (v60.get("pensionDraw") or {})
    pd390 = pd.get("390") or {}
    pd1280 = pd.get("1280") or {}
    check(
        "390 결과 — 최소 글자 14px · 탭 대상 44px · 페이지 가로 넘침 0",
        pd390.get("minFont") == 14
        and (pd390.get("minTap") or 0) >= 44
        and (pd390.get("checklistMin") or 0) >= 44
        and pd390.get("docScrollWidth") == pd390.get("innerWidth") == 390,
        f"font={pd390.get('minFont')} tap={pd390.get('minTap')} checklist={pd390.get('checklistMin')}",
    )
    check(
        "슬라이더를 움직이면 계산 버튼 없이 결과가 즉시 바뀜",
        pd390.get("liveUpdate", {}).get("changed") is True and pd390.get("calcButton") is False,
        json.dumps({"changed": pd390.get("liveUpdate", {}).get("changed"), "calcButton": pd390.get("calcButton")}, ensure_ascii=False),
    )
    check(
        "입력값 저장·전송 0 (localStorage·sessionStorage·쿠키)",
        (pd390.get("storage") or {}).get("local") == 0
        and (pd390.get("storage") or {}).get("session") == 0
        and (pd390.get("storage") or {}).get("cookies") == 0,
        json.dumps(pd390.get("storage"), ensure_ascii=False),
    )
    check(
        "내 결과 5줄 메모 — 버튼 한 번에 5줄",
        (pd390.get("memo") or {}).get("lines") == 5 and "참고용 추정이며 세무 상담이 아닙니다" in ((pd390.get("memo") or {}).get("text") or ""),
        f"lines={(pd390.get('memo') or {}).get('lines')}",
    )
    check(
        "하단 sticky 요약 바 — 390 표시 / 1280 숨김",
        pd390.get("stickyVisible") is True and pd1280.get("stickyVisible") is False,
        f"390={pd390.get('stickyVisible')} 1280={pd1280.get('stickyVisible')}",
    )
    check("연금 인출 콘솔 오류 0 (390·1280)", not (pd390.get("consoleErrors") or []) and not (pd1280.get("consoleErrors") or []))
    check("연금 인출 캡처 저장(390·1280)", (OUT / "pension-draw-390.png").exists() and (OUT / "pension-draw-1280.png").exists())
    main_block = home[home.find("data-main-tools") : home.find("data-risk-tools")]
    check(
        "홈 대표 도구 4칸 유지(연금 인출은 도구자료실에서) · 도구자료실 메인 5칸",
        main_block.count("<li") == 4
        and "연금 인출·세금 시뮬레이터" not in main_block
        and html("apps/index.html").count("data-main-tool=") == 5,
        f"home={main_block.count('<li')} apps={html('apps/index.html').count('data-main-tool=')}",
    )

    # 18) v6.0 — 본문 표 읽기 (헤더 한 줄·수치 셀·넘칠 때만 스크롤)
    table_posts = [p for p in pages if "/posts/" in str(p) and p.parent.parent.name == "posts"]
    table_bad = []
    for page in table_posts:
        t = page.read_text(encoding="utf-8", errors="ignore")
        if t.count("<table") != t.count('class="table-wrap"'):
            table_bad.append(str(page.relative_to(DIST)))
    check("모든 본문 표가 .table-wrap 안에 있음", not table_bad, ", ".join(table_bad[:3]))
    t390 = {k: v for k, v in (v60.get("tables") or {}).items() if k.endswith("-390")}
    worst = max((max(h["lines"] for h in tbl["headers"]) for v in t390.values() for tbl in v["tables"]), default=0)
    check(
        "390 표 헤더가 3줄로 꺾이지 않음(최대 1줄)",
        worst <= 1,
        json.dumps({k: [max(h["lines"] for h in tbl["headers"]) for tbl in v["tables"]] for k, v in t390.items()}, ensure_ascii=False)[:300],
    )
    check(
        "390 표 — 페이지 가로 넘침 0 · 정말 넓은 표만 래퍼 안에서 스크롤",
        all(v["docScrollWidth"] == 390 for v in t390.values())
        and all(tbl["scrolls"] is False or tbl["cols"] >= 4 for v in t390.values() for tbl in v["tables"]),
        json.dumps({k: [(tbl["cols"], tbl["scrolls"]) for tbl in v["tables"]] for k, v in t390.items()}, ensure_ascii=False)[:300],
    )
    check(
        "수치 셀(.is-num) tabular-nums + 줄바꿈 금지",
        "is-num" in html("posts/isa-pension-300/index.html")
        and re.search(r"\.prose-article td\.is-num[^{]*\{[^}]*white-space:\s*nowrap", (SRC / "styles/global.css").read_text(encoding="utf-8")) is not None,
    )
    check(
        "표 캡처 저장 — ISA 글 390/1280 · 대표 표 7장",
        (OUT / "table-isa-pension-300-390-0.png").exists()
        and (OUT / "post-isa-390.png").exists()
        and (OUT / "post-isa-1280.png").exists(),
    )

    # 19) v6.0 — 발행 게이트 (Answer-First · Information-Gain · 100점 리뷰)
    rules = json.loads((APP / "scripts/publish_rules.json").read_text(encoding="utf-8"))
    check(
        "publish_rules.json gates·rubric·information_gain",
        all(k in rules.get("gates", {}) for k in ("answer_first", "information_gain", "review", "visual", "links"))
        and rules.get("rubric", {}).get("block_below") == 90
        and rules.get("information_gain", {}).get("min_len") == 30,
        f"version={rules.get('version')}",
    )
    pipeline_src = (APP / "scripts/publish_pipeline.py").read_text(encoding="utf-8")
    check(
        "파이프라인에 게이트 함수·점검표 13줄 연결",
        all(fn in pipeline_src for fn in ("def check_answer_first", "def check_information_gain", "def check_review", "def check_visual_gate"))
        and "13줄" in pipeline_src
        and "review-stale" in pipeline_src,
    )
    check("게이트 단위 테스트 파일 존재", (APP / "scripts/test_publish_gates.py").exists())
    check("게이트 진단 리포트(그림자 모드 실행 흔적)", (REPO / "reports/buffetkimz-web/pipeline-v2/checklist.json").exists())

    failed = [r for r in results if not r["ok"]]
    summary = {
        "version": pkg_version,
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
