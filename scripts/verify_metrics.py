#!/usr/bin/env python3
"""학습순환 P0 배지·화면 검증 — v9.0.0 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §4-7).

`verify_tracks.py`가 **소스 계약**을 잰다면, 이 스크립트는 **빌드 결과물(dist)**을 잰다.
`npm run build` 뒤에 돌린다.

무엇을 재는가
  M1 dist HTML에 금지어 7단어가 새로 생기지 않았는가
     — 추적을 시작한 시점(2026-11-23)에 이미 있던 4곳은 LEGACY로 적어 두고, **그 밖의 새 위반만** 실패로 센다.
       (P0는 화면을 바꾸지 않는 단계라 기존 문구를 이 작업에서 고치지 않는다. 고칠 목록은 리포트에 남긴다.)
  M2 배지를 단 페이지마다 기준 시각(asOfLabel)이 HTML에 실제로 있는가
     — 값만 있고 기준이 없는 배지 0. P0에는 배지 UI가 없으므로 이 검사는 P1부터 의미를 가진다(지금은 0페이지 = 통과).
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
    ("apps/dividend-tax/run", "실시간"): "계산 결과가 입력에 따라 바뀐다는 뜻으로 쓴 '실시간으로 바뀝니다'",
    ("apps/qr-generator", "실시간"): "'실시간 미리보기' 칩",
    ("apps/qr-generator/run", "실시간"): "'실시간 미리보기' 칩",
    ("academy/school-teen-payments", "긴급"): "경찰 신고 번호 안내의 '긴급 상황'",
}

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
  rules: badges.METRIC_BADGES.map(b => ({id: b.id, value: b.value, yearLabel: b.yearLabel})),
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

    # ── M2 배지가 있는 페이지 = 기준 시각이 있는 페이지 ──────────────────
    # P1에서 LiveMetricBadge가 `data-badge`를 달면 이 검사가 실제로 페이지를 센다.
    badge_pages: list[str] = []
    no_stamp: list[str] = []
    label_by_id = {i["id"]: i["asOfLabel"] for i in data["indicators"]}
    for html in DIST.rglob("*.html"):
        text = html.read_text(encoding="utf-8", errors="ignore")
        ids = re.findall(r'data-badge="(?:market:)?([\w-]+)"', text)
        if not ids:
            continue
        badge_pages.append(page_path(html))
        for bid in ids:
            label = label_by_id.get(bid)
            if label and label not in text:
                no_stamp.append(f"{page_path(html)}: {bid} ({label} 없음)")
    check(
        "M2 배지 페이지마다 기준 시각 표기",
        not no_stamp,
        ", ".join(no_stamp[:3]) or f"배지 페이지 {len(badge_pages)}개 (P0는 배지 UI 이전)",
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
