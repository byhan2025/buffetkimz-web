#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sources-catalog.json / SOURCES-CATALOG.md 빌더 (의존성 없음).

사용법:
    python3 automation/tools/build_catalog.py            # 카탈로그 생성
    python3 automation/tools/build_catalog.py --check     # 중복 URL·필드 누락 검사만
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # apps/buffetkimz-web/automation
DATA = HERE / "catalog_data"
OUT_JSON = ROOT / "sources-catalog.json"
OUT_MD = ROOT / "SOURCES-CATALOG.md"

sys.path.insert(0, str(DATA))

MODULES = [
    "cat1_macro",
    "cat2_kr_market",
    "cat3_global_market",
    "cat4_tax_pension",
    "cat5_insurance_health",
    "cat6_real_estate",
    "cat7_ai_tech",
    "cat8_content_hook",
]

SECTION_ORDER = ["자산리포트", "골든타임", "앱스토어", "자료앨범"]
SECTION_LABEL = {
    "자산리포트": "자산리포트(장문 글)",
    "골든타임": "골든타임(일정·타임라인)",
    "앱스토어": "앱스토어(계산기·도구)",
    "자료앨범": "자료앨범(3D 카드·갤러리)",
}


def load_sources():
    out = []
    for mod_name in MODULES:
        mod = __import__(mod_name)
        cat = mod.CATEGORY
        for i, (name, url, method, cycle, sections, owner, note) in enumerate(cat["sources"], 1):
            out.append(
                {
                    "id": f"{cat['code']}-{i:03d}",
                    "domain_category": cat["name"],
                    "name": name,
                    "url_or_endpoint": url,
                    "fetch_method": method,
                    "update_cycle": cycle,
                    "target_site_section": sections,
                    "owner_role": owner,
                    "note": note,
                }
            )
    return out


def validate(sources):
    problems = []
    for s in sources:
        for key in ("id", "domain_category", "name", "url_or_endpoint", "fetch_method", "update_cycle", "target_site_section", "owner_role"):
            if not s.get(key):
                problems.append(f"필드 누락: {s.get('id', '?')} {key}")
        bad = [x for x in s["target_site_section"] if x not in SECTION_ORDER]
        if bad:
            problems.append(f"섹션 오류: {s['id']} {bad}")
        if not s["url_or_endpoint"].startswith("http"):
            problems.append(f"URL 형식: {s['id']} {s['url_or_endpoint']}")
    ids = Counter(s["id"] for s in sources)
    problems += [f"중복 id: {k}" for k, v in ids.items() if v > 1]
    urls = Counter(s["url_or_endpoint"] for s in sources)
    return problems, urls


def previous_verify():
    """재빌드 시 verify_catalog.py 실측 결과를 잃지 않도록 기존 JSON에서 옮긴다."""
    if not OUT_JSON.exists():
        return {}
    try:
        old = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {s["url_or_endpoint"]: s["verify"] for s in old.get("sources", []) if s.get("verify")}


def build():
    sources = load_sources()
    known = previous_verify()
    for s in sources:
        if s["url_or_endpoint"] in known:
            s["verify"] = known[s["url_or_endpoint"]]
    problems, urls = validate(sources)

    dupes = {u: c for u, c in urls.items() if c > 1}
    if dupes:
        print("[중복 URL]", json.dumps(dupes, ensure_ascii=False, indent=1))

    catalog = {
        "meta": {
            "title": "buffetkimz.com 콘텐츠 자동화 1차 원천 소스 마스터 카탈로그",
            "version": "1.0.0",
            "built_for": "buffetkimz.com (apps/buffetkimz-web/)",
            "generated_by": "automation/tools/build_catalog.py",
            "total_sources": len(sources),
            "categories": len(MODULES),
            "schema": {
                "id": "카테고리코드-3자리 일련번호",
                "domain_category": "①~⑧ 분야",
                "name": "소스 공식 명칭",
                "url_or_endpoint": "실존 URL/RSS/공공 API 엔드포인트",
                "fetch_method": "RSS | API | HTML | CSV",
                "update_cycle": "실시간 | 일간 | 주간 | 월간 | 발표일 | 수시",
                "target_site_section": "연동 섹션 배열(첫 항목이 주 섹션) — 자산리포트/골든타임/앱스토어/자료앨범",
                "owner_role": "담당 구성원",
                "note": "활용 메모(키 필요 여부·1차 근거 성격)",
                "verify": "verify_catalog.py가 기록하는 실측 결과(http_status, result, checked_at)",
            },
            "rules": [
                "모든 항목은 실제로 응답하는 URL만 수록한다(verify_catalog.py 통과).",
                "수치는 원문 발표일 기준으로만 인용하고, 추정 복원하지 않는다.",
                "원본 제목을 그대로 노출하지 않고, 우리 문장으로 재작성한다.",
            ],
        },
        "sources": sources,
    }
    OUT_JSON.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # ---- Markdown ----
    lines = []
    lines.append("# buffetkimz.com 1차 원천 소스 마스터 카탈로그")
    lines.append("")
    lines.append(f"- 총 **{len(sources)}개** 소스 · **{len(MODULES)}개** 분야")
    lines.append("- 기계 판독용 원본: `automation/sources-catalog.json` (이 문서는 같은 데이터의 사람용 뷰)")
    lines.append("- 검증: `python3 automation/tools/verify_catalog.py` 실측 결과를 각 표의 `검증` 열에 반영")
    lines.append("- 필드: `id` / `name` / `url_or_endpoint` / `fetch_method` / `update_cycle` / `target_site_section` / `owner_role` / `note`")
    lines.append("")
    lines.append("## 연동 섹션 정의")
    lines.append("")
    for sec in SECTION_ORDER:
        lines.append(f"- **{SECTION_LABEL[sec]}**")
    lines.append("")

    by_cat = {}
    for s in sources:
        by_cat.setdefault(s["domain_category"], []).append(s)

    lines.append("## 분야별 소스 수")
    lines.append("")
    lines.append("| 분야 | 소스 수 | 주 담당 |")
    lines.append("|---|---:|---|")
    for cat_name, items in by_cat.items():
        owners = Counter(x["owner_role"] for x in items).most_common(2)
        owner_txt = ", ".join(f"{o}({c})" for o, c in owners)
        lines.append(f"| {cat_name} | {len(items)} | {owner_txt} |")
    lines.append(f"| **합계** | **{len(sources)}** | |")
    lines.append("")

    for cat_name, items in by_cat.items():
        lines.append(f"## {cat_name}")
        lines.append("")
        lines.append("| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for s in items:
            secs = " · ".join(s["target_site_section"])
            name = s["name"].replace("|", "\\|")
            url = s["url_or_endpoint"].replace("|", "\\|")
            note = s["note"].replace("|", "\\|")
            v = s.get("verify") or {}
            vtxt = f"{v.get('result','미검증')}" + (f" {v['http_status']}" if v.get("http_status") else "")
            lines.append(
                f"| `{s['id']}` | {name} | <{url}> | {s['fetch_method']} | {s['update_cycle']} | {secs} | {s['owner_role']} | {vtxt} | {note} |"
            )
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"OK  sources={len(sources)}  categories={len(by_cat)}")
    print(f"  -> {OUT_JSON.relative_to(ROOT.parent.parent)}")
    print(f"  -> {OUT_MD.relative_to(ROOT.parent.parent)}")
    if problems:
        print("[문제]", *problems, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        src = load_sources()
        probs, urls = validate(src)
        dupes = {u: c for u, c in urls.items() if c > 1}
        print(f"sources={len(src)} problems={len(probs)} duplicate_urls={len(dupes)}")
        for p in probs:
            print(" -", p)
        for u, c in dupes.items():
            print(" dup", c, u)
        sys.exit(0 if not probs else 1)
    raise SystemExit(build())
