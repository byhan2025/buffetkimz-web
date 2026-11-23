#!/usr/bin/env python3
"""학습순환 P0 배지·화면 검증 — v9.0.0 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §4-7).

`verify_tracks.py`가 **소스 계약**을 잰다면, 이 스크립트는 **빌드 결과물(dist)**을 잰다.
`npm run build` 뒤에 돌린다.

무엇을 재는가
  M1 dist HTML에 금지어 7단어가 새로 생기지 않았는가
     — 추적을 시작한 시점(2026-11-23)에 있던 문구는 LEGACY로 적어 두고 **그 밖의 새 위반만** 실패로 센다.
       P1에서 화면 문구 3곳(세금 계산기·QR 생성기 2곳)을 고쳐 LEGACY에서 지웠다. 남은 1곳은 학교 강의의
       경찰 신고 '긴급 상황'으로, 맥락상 정당해 유지한다.
  M2 배지를 단 페이지마다 그 배지의 기준 표기가 HTML에 실제로 있는가
     — 시장(M) 배지는 `asOfLabel`(값의 기준 시각), 제도(R) 배지는 `yearLabel`+`law`(기준 연도·조문).
       값만 있고 기준이 없는 배지 0.
  M2b P1이 처음 붙인 배지 페이지(글 3편 · 강의 2개)에 배지가 실제로 살아 있는가
     — 데이터만 남고 화면에서 빠지면 이 자리에서 잡는다.
  M3 허브 신선도 — today.asOf가 검증 시점(한국 날짜)에서 1일을 넘기지 않았는가
     — 파이프라인이 허브 갱신을 건너뛰면 빌드는 서지만 '오늘'이 늙는다. 배포 직전에 이 자리에서 잡는다.
     (`site.today`가 today.asOf에서 파생되므로 site.today의 나이 = 허브의 나이다.)

사용:
  npm run build && python3 scripts/verify_metrics.py
결과: reports/buffetkimz-web/learning-loop/verify-metrics.json
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import shutil
import subprocess
import sys

APP = pathlib.Path(__file__).resolve().parent.parent
SRC = APP / "src"
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "learning-loop"
OUT.mkdir(parents=True, exist_ok=True)

BANNED = ("실시간", "속보", "초비상", "지금 당장", "폭탄", "역대급", "긴급")
KST = dt.timezone(dt.timedelta(hours=9))

# 2026-11-23 P0 착수 시점에 이미 dist에 있던 금지어 — P0는 화면을 바꾸지 않으므로 여기 적어 두고,
# 이 목록에 없는 새 등장만 실패로 센다. (P1에서 문구를 고치면 이 표에서 한 줄씩 지운다.)
LEGACY = {
    ("academy/school-teen-payments", "긴급"): "경찰 신고 번호 안내의 '긴급 상황' — 맥락상 정당해 유지",
}

# P1(2026-11-23)이 배지를 처음 붙인 화면 — 글 3편(연금·절세 트랙 1·2·3단계) + 아카데미 강의 2개.
# 배지가 데이터에만 남고 화면에서 빠지면 M2b가 잡는다.
P1_BADGE_PAGES = (
    "posts/pension-master-01-four-accounts",
    "posts/pension-master-02-tax-compare",
    "posts/pension-master-05-draw-1500",
    "academy/step2-pension-tax-limit",
    "academy/step4-retire-drawdown-order",
)

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


NODE = shutil.which("node") or "/workspace/.tools/node-v22.23.4-linux-x64/bin/node"
DUMP = """
const [today, badges] = await Promise.all([import('./src/data/today.ts'), import('./src/data/metric-badges.ts')]);
console.log(JSON.stringify({
  asOf: today.today.asOf,
  status: today.today.status ?? 'ok',
  indicators: today.today.indicators.map(i => ({id: i.id, asOfLabel: i.asOfLabel})),
  rules: badges.METRIC_BADGES.map(b => ({id: b.id, value: b.value, yearLabel: b.yearLabel, law: b.law})),
}));
"""


def dump() -> dict:
    run = subprocess.run([NODE, "--experimental-strip-types", "--input-type=module", "-e", DUMP],
                         cwd=str(APP), capture_output=True, text=True)
    if run.returncode != 0:
        print("  ! today.ts를 읽지 못했습니다:", (run.stderr or "").strip()[:400], flush=True)
        return {}
    return json.loads(run.stdout.strip().splitlines()[-1])


def page_path(html: pathlib.Path) -> str:
    rel = html.relative_to(DIST).as_posix()
    return rel[: -len("/index.html")] if rel.endswith("/index.html") else rel[: -len(".html")]


def main() -> int:
    if not DIST.exists() or not (DIST / "index.html").exists():
        check("M0 dist 준비", False, "dist/index.html이 없습니다 — npm run build 먼저")
        return finish()

    data = dump()
    if not data:
        check("M0 dist 준비", True, "dist 있음")
        check("M0b today.ts 로드", False, "node가 today.ts를 읽지 못했습니다")
        return finish()
    check("M0 dist 준비", True, f"HTML {len(list(DIST.rglob('*.html')))}개")

    # ── M1 금지어 — 기존 4곳은 LEGACY, 새 등장만 실패 ─────────────────────
    new_hits: list[str] = []
    legacy_seen: set[tuple[str, str]] = set()
    for html in DIST.rglob("*.html"):
        text = html.read_text(encoding="utf-8", errors="ignore")
        page = page_path(html)
        for word in BANNED:
            if word not in text:
                continue
            key = (page, word)
            if key in LEGACY:
                legacy_seen.add(key)
            else:
                new_hits.append(f"{page}: '{word}'")
    check("M1 dist 금지어 — 새 등장 0", not new_hits, ", ".join(new_hits[:5]) or f"기존 {len(legacy_seen)}곳만 남음")
    stale_legacy = sorted(f"{p}:'{w}'" for p, w in set(LEGACY) - legacy_seen)
    print(f"  INFO 기존 문구(다음 정리 대상) {len(legacy_seen)}곳 · 이미 사라진 항목 {stale_legacy or '없음'}", flush=True)

    # ── M2 배지가 있는 페이지 = 기준 표기가 있는 페이지 ──────────────────
    # `LiveMetricBadge`는 배지마다 `data-badge="market:<id>"` / `data-badge="rule:<id>"`를 단다.
    # 시장 배지는 값의 기준 시각(asOfLabel), 제도 배지는 기준 연도·조문이 같은 HTML에 있어야 한다.
    badge_pages: list[str] = []
    badge_count: dict[str, int] = {}
    no_stamp: list[str] = []
    label_by_id = {i["id"]: i["asOfLabel"] for i in data["indicators"]}
    law_by_id = {b["id"]: (b["yearLabel"], b["law"]) for b in data["rules"]}
    for html in DIST.rglob("*.html"):
        text = html.read_text(encoding="utf-8", errors="ignore")
        found = re.findall(r'data-badge="(?:(market|rule):)?([\w-]+)"', text)
        if not found:
            continue
        page = page_path(html)
        badge_pages.append(page)
        badge_count[page] = len(found)
        for kind, bid in found:
            if kind == "rule":
                stamp, law = law_by_id.get(bid, ("", ""))
                if not stamp or stamp not in text:
                    no_stamp.append(f"{page}: rule {bid} ({stamp or '연도'} 없음)")
                elif not law or law not in text:
                    no_stamp.append(f"{page}: rule {bid} ({law or '조문'} 없음)")
            else:
                label = label_by_id.get(bid)
                if label and label not in text:
                    no_stamp.append(f"{page}: market {bid} ({label} 없음)")
    check(
        "M2 배지 페이지마다 기준 시각·조문 표기",
        not no_stamp,
        ", ".join(no_stamp[:3]) or f"배지 페이지 {len(badge_pages)}개 · 배지 {sum(badge_count.values())}개",
    )

    # ── M2b P1 첫 노출 페이지에 배지가 살아 있는가 ────────────────────────
    missing_pages = [p for p in P1_BADGE_PAGES if p not in badge_count]
    check(
        "M2b P1 배지 페이지 5곳(글 3·강의 2)에 배지 존재",
        not missing_pages,
        ", ".join(missing_pages[:5])
        or " · ".join(f"{p.split('/')[-1]} {badge_count[p]}개" for p in P1_BADGE_PAGES),
    )

    # ── M3 허브 신선도 — 배포 직전 게이트 ─────────────────────────────────
    as_of = dt.datetime.fromisoformat(data["asOf"]).astimezone(KST)
    age_days = (dt.datetime.now(KST) - as_of).total_seconds() / 86400
    check(
        "M3 today.asOf가 1일 이내 (허브 갱신 살아 있음)",
        age_days <= 1,
        f"asOf {as_of:%Y-%m-%d %H:%M} · {age_days:.2f}일 전 · status {data['status']}",
    )
    return finish()


def finish() -> int:
    passed = sum(1 for c in CHECKS if c["ok"])
    total = len(CHECKS)
    payload = {
        "checkedAt": dt.datetime.now(KST).isoformat(timespec="seconds"),
        "passed": passed,
        "total": total,
        "checks": CHECKS,
        "legacyBanned": [{"page": p, "word": w, "why": why} for (p, w), why in LEGACY.items()],
    }
    (OUT / "verify-metrics.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed}/{total} 통과 — reports/buffetkimz-web/learning-loop/verify-metrics.json", flush=True)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
