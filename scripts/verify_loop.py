#!/usr/bin/env python3
"""학습순환 P2 화면 검증 — v9.1.0 (트랙 3단계 · 하단 독 · 도구 출구 · 카드 역링크)

`verify_tracks.py`는 **소스 계약**(무엇을 가리키는가)을, `verify_metrics.py`는 **배지**를 잰다.
이 스크립트는 P2가 실제로 그린 **화면(dist)**을 잰다 — 계약은 맞는데 화면에서 빠지는 경우를 잡는다.

무엇을 재는가
  P1 단계 페이지 — 트랙의 단계마다 `/academy/track/{id}/{no}/`가 있고, 진행선·배지가 그려졌는가
  P2 하단 독 — 트랙에 속한 글·강의 페이지마다 `data-track-dock`이 있고, 트랙 밖 글에는 없는가
  P3 도구 출구 — 단계 도구의 `/run`에 `data-run-exit="track"`이 있고, 그 밖의 정예 도구 `/run`에는
                 출구(`data-run-exit`)가 하나라도 있는가(막다른 길 0)
  P4 실행 화면에 독이 없는가 — `.sticky-summary`와 같은 자리를 쓰므로
  P5 카드 역링크 — 단계 카드 세트의 `/gallery/{id}/`에 `data-card-track-link`가 있는가
  P6 아카데미 허브 — `#tracks-3step` 밴드와 트랙 화면 링크가 있는가
  P7 다음 단계 링크 — 1단계 페이지가 2단계로, 2단계가 3단계로 가는 링크를 실제로 들고 있는가

사용:
  npm run build && python3 scripts/verify_loop.py          # 로컬 dist
  python3 scripts/verify_loop.py --live                     # gh-pages 라이브
결과: reports/buffetkimz-web/learning-loop/verify-loop-{local,live}.json
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import urllib.request

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "learning-loop"
OUT.mkdir(parents=True, exist_ok=True)

NODE = shutil.which("node") or "/workspace/.tools/node-v22.23.4-linux-x64/bin/node"
MODE = "live" if "--live" in sys.argv else "local"
LIVE = "https://byhan2025.github.io/buffetkimz-web"
_CACHE: dict[str, str] = {}

DUMP = """
const [tracks, apps] = await Promise.all([
  import('./src/data/tracks.ts'),
  import('./src/data/apps.ts'),
]);
console.log(JSON.stringify({
  tracks: tracks.TRACKS.map(t => ({id: t.id, status: t.status,
    stages: t.stages.map(s => ({no: s.no, name: s.name, posts: s.posts, tool: s.tool, card: s.card, lesson: s.lesson ?? null,
      badges: s.badges}))})),
  apps: apps.apps.map(a => ({slug: a.slug, internal: !!a.internal, archived: !!a.archived})),
}));
"""

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def html_of(path: str) -> str:
    """로컬은 dist, `--live`는 gh-pages에서 읽는다(한 번 읽은 페이지는 다시 받지 않는다)."""
    if path in _CACHE:
        return _CACHE[path]
    if MODE == "live":
        try:
            with urllib.request.urlopen(f"{LIVE}{path}", timeout=30) as res:
                text = res.read().decode("utf-8", "ignore")
        except Exception:
            text = ""
    else:
        file = DIST / path.strip("/") / "index.html"
        text = file.read_text(encoding="utf-8", errors="ignore") if file.exists() else ""
    _CACHE[path] = text
    return text


def data():
    run = subprocess.run([NODE, "--experimental-strip-types", "--input-type=module", "-e", DUMP],
                         cwd=str(APP), capture_output=True, text=True)
    if run.returncode != 0:
        print("  ! 데이터를 읽지 못했습니다:", (run.stderr or "").strip()[:400], flush=True)
        return {}
    return json.loads(run.stdout.strip().splitlines()[-1])


def main() -> int:
    if MODE == "local" and not (DIST / "index.html").exists():
        check("P0 dist 준비", False, "dist/index.html이 없습니다 — npm run build 먼저")
        return finish()
    d = data()
    if not d:
        check("P0 dist 준비", False, "데이터 모듈 로드 실패")
        return finish()

    live = [t for t in d["tracks"] if t["status"] == "live"]
    check(f"P0 {MODE} 준비", bool(live), f"라이브 트랙 {len(live)}개")

    # ── P1 단계 페이지 ────────────────────────────────────────────────
    missing, no_dock, no_badge = [], [], []
    for track in live:
        for stage in track["stages"]:
            path = f"/academy/track/{track['id']}/{stage['no']}/"
            html = html_of(path)
            if not html:
                missing.append(path)
                continue
            if "data-track-dock" not in html:
                no_dock.append(path)
            if "data-metric-badges" not in html:
                no_badge.append(path)
        if not html_of(f"/academy/track/{track['id']}/"):
            missing.append(f"/academy/track/{track['id']}/")
    check("P1 단계 페이지 3개 + 트랙 화면", not missing, ", ".join(missing[:4]) or "모두 존재")
    check("P1b 단계 페이지에 하단 독", not no_dock, ", ".join(no_dock[:3]) or "3/3")
    check("P1c 단계 페이지에 숫자 배지", not no_badge, ", ".join(no_badge[:3]) or "3/3")

    # ── P2 하단 독 — 트랙 글·강의 ────────────────────────────────────
    post_miss, lesson_miss = [], []
    for track in live:
        for stage in track["stages"]:
            for slug in stage["posts"]:
                if "data-track-dock" not in html_of(f"/posts/{slug}/"):
                    post_miss.append(slug)
            if stage["lesson"] and "data-track-dock" not in html_of(f"/academy/{stage['lesson']}/"):
                lesson_miss.append(stage["lesson"])
    check("P2 트랙 글 11편에 하단 독", not post_miss, ", ".join(post_miss[:4]) or "전부 있음")
    check("P2b 트랙 강의 3개에 하단 독", not lesson_miss, ", ".join(lesson_miss[:3]) or "전부 있음")

    # 트랙 밖 글에는 없어야 한다(모든 글에 붙는 실수 방지) — 글 1편을 표본으로
    sample = "economy-fx-grocery"
    check("P2c 트랙 밖 글에는 독 없음", "data-track-dock" not in html_of(f"/posts/{sample}/"), sample)

    # ── P3 도구 출구 ────────────────────────────────────────────────
    run_miss, run_bad = [], []
    for track in live:
        for stage in track["stages"]:
            html = html_of(f"/apps/{stage['tool']}/run/")
            if 'data-run-exit="track"' not in html:
                run_miss.append(stage["tool"])
            if f"/academy/track/{track['id']}/{stage['no']}" not in html:
                run_bad.append(f"{stage['tool']} → {stage['no']}단계 링크 없음")
    check("P3 단계 도구 실행 화면에 RunExit", not run_miss, ", ".join(run_miss[:3]) or "3/3")
    check("P3b RunExit가 그 단계로 링크", not run_bad, ", ".join(run_bad[:3]) or "3/3")

    dead = [a["slug"] for a in d["apps"]
            if a["internal"] and not a["archived"] and "data-run-exit=" not in html_of(f"/apps/{a['slug']}/run/")]
    check("P3c 정예 도구 실행 화면 막다른 길 0", not dead, ", ".join(dead[:5]) or f"{sum(1 for a in d['apps'] if a['internal'] and not a['archived'])}종 전부 출구 있음")

    # ── P4 실행 화면에는 독이 없다 ────────────────────────────────────
    with_dock = [a["slug"] for a in d["apps"]
                 if a["internal"] and "data-track-dock" in html_of(f"/apps/{a['slug']}/run/")]
    check("P4 실행 화면에 하단 독 없음", not with_dock, ", ".join(with_dock[:3]) or "0건")

    # ── P5 카드 역링크 ──────────────────────────────────────────────
    card_miss = []
    for track in live:
        for stage in track["stages"]:
            if "data-card-track-link" not in html_of(f"/gallery/{stage['card']}/"):
                card_miss.append(stage["card"])
    check("P5 단계 카드에 카드→단계 역링크", not card_miss, ", ".join(card_miss[:3]) or "3/3")

    # ── P6 아카데미 허브 ────────────────────────────────────────────
    hub = html_of("/academy/")
    check("P6 아카데미 허브에 3단계 트랙 밴드",
          'id="tracks-3step"' in hub and any(f"/academy/track/{t['id']}" in hub for t in live),
          "밴드 + 트랙 링크")

    # ── P7 다음 단계 링크 ───────────────────────────────────────────
    chain = []
    for track in live:
        stages = track["stages"]
        for i, stage in enumerate(stages[:-1]):
            html = html_of(f"/academy/track/{track['id']}/{stage['no']}/")
            nxt = stages[i + 1]["no"]
            if f"/academy/track/{track['id']}/{nxt}" not in html:
                chain.append(f"{stage['no']}→{nxt}")
    check("P7 단계 페이지가 다음 단계로 이어짐", not chain, ", ".join(chain[:3]) or "1→2→3")

    return finish()


def finish() -> int:
    passed = sum(1 for c in CHECKS if c["ok"])
    (OUT / f"verify-loop-{MODE}.json").write_text(
        json.dumps({"mode": MODE, "checks": CHECKS, "passed": passed, "total": len(CHECKS)},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print()
    if passed != len(CHECKS):
        print(f"✗ {passed}/{len(CHECKS)} 통과 — 실패한 항목을 고치세요")
        return 1
    print(f"{passed}/{len(CHECKS)} 통과 — {OUT/f'verify-loop-{MODE}.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
