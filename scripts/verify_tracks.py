#!/usr/bin/env python3
"""학습순환 P0 데이터 계약 검증 — v9.0.0 빌드 가드.

무엇을 재는가 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §4-7·§5-3·§4-8)
  T. 트랙 계약 — `src/data/tracks.ts`가 실제 글·도구·카드·강의·배지 id만 가리키는가
     ① posts[] 의 모든 slug가 `src/content/posts/`에 존재
     ② planned[](아직 없는 빈틈 글)는 존재하지 않고, 중복도 없음
     ③ tool 이 apps.ts에 있고 internal:true · archived 아님
     ④ card 가 gallery.ts에 있고, 세트의 post가 비었거나 이 단계 글 중 하나(1:1 규칙)
     ⑤ 한 글은 한 트랙 한 단계에만 소속(중복 0) · 한 트랙의 세 단계 도구가 서로 다름
     ⑥ badges.market ⊆ today.ts 지표 id · badges.rules ⊆ metric-badges.ts id
     ⑦ lesson 이 academy-lessons.ts에 존재
  B. 배지 카탈로그 — `metric-badges.ts` id 11종·중복 0 · 값이 tax-rules에서 계산됨(리터럴 0)
  S. `site.today` — today.ts `asOf`의 한국 날짜에서 파생 · 날짜 차 ≤ 1일 · 손으로 박은 상수 0
  W. 금지어(실시간·속보·긴급 …) — 새 데이터 파일(tracks·metric-badges·metrics)에 0건

DIST(빌드 결과물) 검사는 `scripts/verify_metrics.py`가 따로 한다 — 이 스크립트는 **소스만** 읽어
`npm run build` 없이도 돌 수 있게 두었다(빠른 가드).

사용:
  npm run verify:tracks            (또는 python3 scripts/verify_tracks.py)
결과: reports/buffetkimz-web/learning-loop/verify-tracks.json
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

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


NODE = shutil.which("node") or "/workspace/.tools/node-v22.23.4-linux-x64/bin/node"

DUMP_CODE = """
const mods = await Promise.all([
  import('./src/data/tracks.ts'),
  import('./src/data/gallery.ts'),
  import('./src/data/apps.ts'),
  import('./src/data/today.ts'),
  import('./src/data/metric-badges.ts'),
  import('./src/config/site.ts'),
]);
const [tracks, gallery, apps, today, badges, site] = mods;
console.log(JSON.stringify({
  tracks: tracks.TRACKS, trackIds: tracks.TRACK_IDS,
  gallery: gallery.galleryItems.map(i => ({id: i.id, post: i.post ?? null, slides: i.slides.length})),
  apps: apps.apps.map(a => ({slug: a.slug, internal: !!a.internal, archived: !!a.archived})),
  indicators: today.today.indicators.map(i => ({id: i.id, asOf: i.asOf, asOfLabel: i.asOfLabel, source: i.source, sourceUrl: i.sourceUrl})),
  todayAsOf: today.today.asOf, todayStatus: today.today.status ?? 'ok',
  badges: badges.METRIC_BADGES.map(b => ({id: b.id, name: b.name, value: b.value, law: b.law, lawUrl: b.lawUrl, yearLabel: b.yearLabel})),
  badgeIds: badges.METRIC_BADGE_IDS,
  siteToday: site.site.today.toISOString(),
}));
"""


def dump_data() -> dict:
    """tracks.ts·gallery.ts·apps.ts·today.ts·metric-badges.ts·site.ts를 node로 실행해 실제 값을 읽는다.

    손으로 적은 기대표가 아니라 **실제 모듈이 내놓는 값**을 재기 위해서다(계산된 배지 문자열 포함).
    """
    run = subprocess.run(
        [NODE, "--experimental-strip-types", "--input-type=module", "-e", DUMP_CODE],
        cwd=str(APP),
        capture_output=True,
        text=True,
    )
    if run.returncode != 0:
        print("  ! 데이터 모듈을 읽지 못했습니다:", (run.stderr or "").strip()[:600], flush=True)
        return {}
    return json.loads(run.stdout.strip().splitlines()[-1])


def post_slugs() -> set[str]:
    return {p.stem for p in (SRC / "content" / "posts").glob("*.md")}


def post_tracks() -> dict[str, str]:
    """frontmatter `track:` — 지금은 0건이어도 검사한다(파이프라인이 채우기 시작하면 바로 잡힌다)."""
    found: dict[str, str] = {}
    for p in sorted((SRC / "content" / "posts").glob("*.md")):
        m = re.search(r"^track:\s*\"?([\w-]+)\"?\s*$", read(p), re.M)
        if m:
            found[p.stem] = m.group(1)
    return found


def strip_comments(text: str) -> str:
    """주석을 지운 뒤 금지어를 센다 — '실시간을 쓰지 않는다'는 규칙 문장 자체를 위반으로 세지 않기 위해서다.
    화면에 나가는 것은 주석이 아니라 문자열이므로, 남은 텍스트에 금지어가 있으면 그것이 진짜 위반이다."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def lesson_slugs() -> set[str]:
    """academy-lessons.ts는 확장자 없는 상대 import라 node로 못 읽는다 — slug만 정규식으로 센다."""
    slugs: set[str] = set()
    for name in ("academy-lessons.ts", "academy-school-lessons.ts"):
        f = SRC / "data" / name
        if f.exists():
            slugs |= set(re.findall(r'^\s*slug:\s*"([^"]+)"', read(f), re.M))
    return slugs


def main() -> int:
    data = dump_data()
    if not data:
        check("D0 데이터 모듈 로드", False, "node가 src/data/*.ts를 읽지 못했습니다")
        return finish()

    posts = post_slugs()
    fm_tracks = post_tracks()
    lessons = lesson_slugs()
    apps = {a["slug"]: a for a in data["apps"]}
    gallery = {g["id"]: g for g in data["gallery"]}
    ind_ids = {i["id"] for i in data["indicators"]}
    badge_ids = [b["id"] for b in data["badges"]]
    badge_set = set(badge_ids)
    tracks = data["tracks"]

    check("D0 데이터 모듈 로드", True, f"글 {len(posts)}편 · 도구 {len(apps)}종 · 카드 {len(gallery)}세트 · 지표 {len(ind_ids)}개 · 배지 {len(badge_set)}종")

    # ── T. 트랙 계약 ────────────────────────────────────────────────────────
    errors: list[str] = []
    for track in tracks:
        tid = track["id"]
        if tid not in data["trackIds"]:
            errors.append(f"{tid}: TRACK_IDS 밖의 id")
        nos = [s["no"] for s in track["stages"]]
        if nos != [1, 2, 3]:
            errors.append(f"{tid}: 단계 번호 {nos}")
        tools = [s["tool"] for s in track["stages"]]
        if len(set(tools)) != 3:
            errors.append(f"{tid}: 단계 도구 중복 {tools}")
    check("T1 트랙 id·3단계 구성", not errors, " · ".join(errors[:4]))

    miss_posts: list[str] = []
    for track in tracks:
        for stage in track["stages"]:
            for slug in stage["posts"]:
                if slug not in posts:
                    miss_posts.append(f"{track['id']} {stage['no']}단계 {slug}")
    check("T2 단계 글 = 실제 발행 글", not miss_posts, ", ".join(miss_posts[:4]) or f"{len(posts)}편 대조")

    planned_all = [(t["id"], s, p) for t in tracks for s in t["stages"] for p in (s.get("planned") or [])]
    published_planned = [f"{p['slug']}({tid})" for tid, s, p in planned_all if p["slug"] in posts]
    dup_planned = len({p["slug"] for _, _, p in planned_all}) != len(planned_all)
    check(
        "T3 빈틈 글(planned)은 아직 미발행",
        not published_planned and not dup_planned,
        ", ".join(published_planned[:4]) or f"{len(planned_all)}편 미발행 확인",
    )

    bad_tools: list[str] = []
    for track in tracks:
        for stage in track["stages"]:
            app = apps.get(stage["tool"])
            if not app:
                bad_tools.append(f"{stage['tool']}: 없음")
            elif not app["internal"]:
                bad_tools.append(f"{stage['tool']}: 실행 화면 없음")
            elif app["archived"]:
                bad_tools.append(f"{stage['tool']}: 보관함")
    check("T4 단계 도구 = 실행 화면이 있는 정예 도구", not bad_tools, ", ".join(bad_tools[:4]))

    bad_cards: list[str] = []
    for track in tracks:
        for stage in track["stages"]:
            item = gallery.get(stage["card"])
            if not item:
                bad_cards.append(f"{stage['card']}: 없음")
            elif item["post"] and item["post"] not in stage["posts"]:
                bad_cards.append(f"{stage['card']}: 짝 글 {item['post']} ≠ 이 단계")
    check("T5 단계 카드 = gallery 세트 · 1:1 짝 유지", not bad_cards, ", ".join(bad_cards[:4]))

    owner: dict[str, str] = {}
    dup_owner: list[str] = []
    for track in tracks:
        for stage in track["stages"]:
            for slug in stage["posts"]:
                if slug in owner:
                    dup_owner.append(f"{slug}: {owner[slug]} + {track['id']} {stage['no']}")
                owner[slug] = f"{track['id']} {stage['no']}"
    check("T6 한 글 = 한 트랙 한 단계", not dup_owner, ", ".join(dup_owner[:4]) or f"소속 글 {len(owner)}편")

    bad_badges: list[str] = []
    for track in tracks:
        for stage in track["stages"]:
            for bid in stage["badges"]["market"]:
                if bid not in ind_ids:
                    bad_badges.append(f"market {bid}")
            for bid in stage["badges"]["rules"]:
                if bid not in badge_set:
                    bad_badges.append(f"rules {bid}")
    check("T7 단계 배지 id = today·metric-badges", not bad_badges, ", ".join(bad_badges[:4]))

    bad_lessons = [f"{s['lesson']}" for t in tracks for s in t["stages"] if s.get("lesson") and s["lesson"] not in lessons]
    check("T8 단계 강의 = academy-lessons", not bad_lessons, ", ".join(bad_lessons[:4]))

    fm_bad = [f"{pid}: {tid}" for pid, tid in fm_tracks.items() if tid not in {t["id"] for t in tracks} or pid not in owner]
    check("T9 글 frontmatter track ← tracks.ts posts", not fm_bad, ", ".join(fm_bad[:4]) or f"{len(fm_tracks)}편 선언")

    # ── B. 배지 카탈로그 ────────────────────────────────────────────────────
    check("B1 배지 id 11종 · 중복 0", len(badge_ids) == 11 and len(set(badge_ids)) == 11, f"{len(badge_ids)}종")
    empty = [b["id"] for b in data["badges"] if not (b["value"] and b["name"] and b["law"] and b["lawUrl"])]
    check("B2 배지 값·이름·조문·원문 링크 4종 채움", not empty, ", ".join(empty[:4]))
    mb = read(SRC / "data" / "metric-badges.ts")
    literal = re.findall(r"\d+\.\d+\s*%", mb)
    check("B3 배지 문자열에 손으로 적은 세율 0", not literal, ", ".join(literal[:4]))
    check(
        "B4 배지 값이 tax-rules에서 계산됨",
        "pct(" in mb and "manLabel(" in mb and 'from "./tax-rules.ts"' in mb,
        "pct()·manLabel() 경유",
    )

    # ── S. site.today 파생 ─────────────────────────────────────────────────
    site_src = read(SRC / "config" / "site.ts")
    hardcoded = re.findall(r'today:\s*new Date\("', site_src)
    check("S1 site.today에 손으로 박은 날짜 0", not hardcoded, "파생식만")
    check(
        "S2 site.today가 today.ts asOf에서 파생",
        "kstDate(todayHub.asOf)" in site_src and 'from "../data/today.ts"' in site_src,
        "kstDate(todayHub.asOf)",
    )
    as_of = dt.datetime.fromisoformat(data["todayAsOf"])
    site_today = dt.datetime.fromisoformat(data["siteToday"].replace("Z", "+00:00"))
    kst_date = as_of.astimezone(KST).date()
    site_date = dt.date(site_today.year, site_today.month, site_today.day)
    diff = abs((site_date - kst_date).days)
    check(
        "S3 site.today 날짜 = today.asOf 한국 날짜 (차 ≤ 1일)",
        diff <= 1,
        f"site.today {site_date} · asOf {kst_date} · 차 {diff}일",
    )
    # 배지가 말하는 기준 시각이 전부 있는가 — 없는 지표는 화면이 그리지 않는다
    no_stamp = [i["id"] for i in data["indicators"] if not (i["asOfLabel"] and i["source"] and i["sourceUrl"])]
    check("S4 지표마다 기준 시각·출처 존재", not no_stamp, ", ".join(no_stamp[:4]) or f"{len(ind_ids)}개")

    # ── W. 금지어 ──────────────────────────────────────────────────────────
    banned_hits: list[str] = []
    for rel in ("data/tracks.ts", "data/metric-badges.ts", "lib/metrics.ts", "lib/tracks.ts"):
        f = SRC / rel
        if not f.exists():
            banned_hits.append(f"{rel}: 파일 없음")
            continue
        text = strip_comments(read(f))
        for word in BANNED:
            if word in text:
                banned_hits.append(f"{rel}: '{word}'")
    check("W1 새 데이터 파일에 금지어 0", not banned_hits, ", ".join(banned_hits[:5]) or "7단어 0건")

    # ── 참고: 트랙 커버리지(실패 아님) — P3 발행 목표 ──────────────────────
    for track in tracks:
        total_posts = len({s for st in track["stages"] for s in st["posts"]})
        total_planned = len([1 for st in track["stages"] for _ in (st.get("planned") or [])])
        print(
            f"  INFO 트랙 {track['id']}({track['name']}): 글 {total_posts}편 + 빈틈 {total_planned}편 · "
            f"도구 {len({st['tool'] for st in track['stages']})}종 · 카드 {len({st['card'] for st in track['stages']})}세트",
            flush=True,
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
    }
    (OUT / "verify-tracks.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed}/{total} 통과 — reports/buffetkimz-web/learning-loop/verify-tracks.json", flush=True)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
