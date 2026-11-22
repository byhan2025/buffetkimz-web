#!/usr/bin/env python3
"""2-Key 100점 리뷰 리포트 생성·검증기 — `.publish-reviews/<slug>.review.json`

왜 필요한가 — 리허설(reports/buffetkimz-web/automation-rehearsal-20261122.md §4-3) 실측:
  · `publish_pipeline.py ingest`의 v6.0 리뷰 게이트는 `.publish-reviews/<slug>.review.json`이 없으면
    `review-missing` 오류로 무인 적재를 100% 막는다. 그런데 이 파일을 만드는 주체가 저장소에 없었다.
  · 리뷰는 파일이 아니라 **초안 원문 해시**(`reviewedDraftHash`, sha256)에 결속된다
    (`require_hash_binding: true`). 초안을 한 글자만 고쳐도 리뷰는 무효가 된다.
  · 그래서 "점수를 손으로 적어 PASS를 만드는 길"을 막고, 보반과장(1-Key)·뮤즈대리(2-Key)가
    각자 낸 채점표를 **초안 해시에 묶어** 한 파일로 합치는 일만 이 스크립트가 한다.

원칙
  1. 두 키가 모두 있어야 한다. 한 키만 오면 리뷰를 쓰지 않는다(2-Key 교차검증이 아니다).
  2. 두 키는 서로 다른 검수자여야 한다(같은 사람이 두 번 채점하면 게이트는 장식이 된다).
  3. 범주별 점수는 **두 키 중 낮은 값**을 채택한다(보수적 병합). 한쪽이 높게 준 점수는 통과에 쓰이지 않는다.
  4. 루브릭 상한(내용30·근거25·검색20·AI15·기술10)을 넘는 점수는 오류다.
  5. P0 1건, 90점 미만, 어느 한 키의 `blocking: true`면 **발행 부적격**이다.
     부적격 리뷰는 기본적으로 쓰지 않고(파일 없음 = 게이트 차단), `--record-blocking`을 주면
     `blocking: true`로 기록만 남긴다(그래도 ingest는 막는다).

사용법
  # 1) 채점표 형식 확인(서브에이전트에게 그대로 넘기면 된다)
  python3 scripts/generate_review_json.py --print-schema

  # 2) 2-Key 채점표 → 리뷰 리포트 생성
  python3 scripts/generate_review_json.py drafts/2026-11-22-<slug>.md \
      --slug <slug> --key1 /tmp/key1-boban.json --key2 /tmp/key2-muse.json

  # 3) 만들어진 리뷰가 지금 초안과 맞는지 검증(해시·합계·P0·상한)
  python3 scripts/generate_review_json.py drafts/2026-11-22-<slug>.md --slug <slug> --check

  # 검증만 하고 파일을 쓰지 않기 / 부적격 리뷰 기록 남기기
  python3 scripts/generate_review_json.py ... --dry-run
  python3 scripts/generate_review_json.py ... --record-blocking

  # 테스트: 실제 publish_pipeline의 draft_digest와 해시가 일치하는지 자체 점검
  python3 scripts/generate_review_json.py drafts/<draft>.md --self-test

종료 코드
  0 = 리뷰가 게이트를 통과해 (dry-run이면 통과할 상태로) 기록됨 / --check 통과
  1 = 게이트 부적격(점수 미달·P0·키 누락) — 리뷰를 쓰지 않았거나 blocking으로만 기록
  2 = 입력·사용법 오류(초안 없음, JSON 형식 오류, 루브릭 위반 등)
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPTS_DIR.parent
KST = timezone(timedelta(hours=9))

RUBRIC_ORDER = ("content", "evidence", "search", "ai", "tech")
RUBRIC_NAME = {
    "content": "내용",
    "evidence": "근거·E-E-A-T",
    "search": "검색·구조",
    "ai": "AI 인용",
    "tech": "기술·모바일",
}
# 지침서 S5의 6항목 95점 루브릭 — 코드 게이트(5범주 90점)와 별도로 반드시 함께 통과해야 한다.
GATE95_ITEMS = (
    ("numbers", "수치 정확성", 25),
    ("law", "법령·시행일", 20),
    ("sources", "1차 출처", 15),
    ("osmu", "4연동 일치", 15),
    ("style", "문체·금지어", 15),
    ("mobile", "모바일·접근성", 10),
)
GATE95_MIN = 95
DEFAULT_REVIEWERS = ("보반과장", "뮤즈대리")
DEFAULT_MIN_TOTAL = 90


# ───────────────────────── 공용 유틸 ─────────────────────────


def load_pipeline():
    """publish_pipeline 모듈을 불러온다 — 상수·정규화·해시 규칙을 복제하지 않기 위해서."""
    path = SCRIPTS_DIR / "publish_pipeline.py"
    spec = importlib.util.spec_from_file_location("_bk_publish_pipeline", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"publish_pipeline.py를 불러오지 못했습니다: {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def norm(text: str) -> str:
    return unicodedata.normalize("NFC", text or "")


def draft_hash(path: Path, pipe=None) -> str:
    """초안 원문 해시 — publish_pipeline.draft_digest와 같은 규칙(NFC·CRLF→LF·sha256)."""
    raw = path.read_text(encoding="utf-8")
    normalizer = getattr(pipe, "norm", norm) if pipe is not None else norm
    text = normalizer(raw).replace("\r\n", "\n")
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def slugify_stem(stem: str) -> str:
    s = unicodedata.normalize("NFKD", stem).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-{2,}", "-", s) or "post"


def now_kst() -> str:
    return datetime.now(KST).isoformat(timespec="seconds")


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"파일이 없습니다: {path}")
    except ValueError as exc:
        raise SystemExit(f"JSON을 읽지 못했습니다({path}): {exc}")


def pct(n: int, d: int) -> str:
    return f"{(n / d * 100):.0f}%" if d else "0%"


# ───────────────────────── 채점표 형식 ─────────────────────────

SCHEMA_EXAMPLE = {
    "reviewer": "보반과장",
    "key": 1,
    "role": "수치·법령·1차 출처·빌드 (1-Key)",
    "scope": ["수치 원문 대조", "법령 시행일", "1차 출처 URL", "verify:tax·빌드"],
    "scores": {"content": 27, "evidence": 23, "search": 18, "ai": 13, "tech": 9},
    "p0": [],
    "blocking": False,
    "notes": ["금리 3.5%는 한국은행 기준금리 원문과 일치", "시행일 2027-01-01은 '예정' 라벨 확인"],
    "reviewedAt": "2026-11-22T06:12:00+09:00",
}

SCHEMA_TEXT = """2-Key 채점표(JSON) 형식 — 키마다 파일 하나씩 제출한다.

{{
  "reviewer": "<검수자 이름>",          // 필수. 두 키는 서로 달라야 한다(기본: 보반과장 · 뮤즈대리)
  "key": 1,                            // 선택. 1 또는 2
  "role": "<이 키가 맡은 검증 영역>",   // 선택. 예: 수치·법령·빌드 / 시각·390px·실물 UX
  "scope": ["<실제로 확인한 항목>", ...],// 권장. 비면 경고로 기록된다
  "scores": {{                            // 필수. 5범주 전부, 정수, 상한 초과 금지
    "content": 0,                      // 내용       0~30
    "evidence": 0,                     // 근거·E-E-A-T 0~25
    "search": 0,                       // 검색·구조  0~20
    "ai": 0,                           // AI 인용    0~15
    "tech": 0                          // 기술·모바일 0~10
  }},
  "p0": ["<P0 코드>", ...],             // 없으면 []. 1건이라도 있으면 발행 불가
  "blocking": false,                   // 이 키가 "지금은 못 내보낸다"고 판단하면 true
  "notes": ["<근거 있는 한 줄>", ...],  // 권장. 실제 검수 흔적
  "reviewedAt": "<ISO8601>"
}}

리뷰 파일은 두 채점표의 **범주별 최솟값**으로 합쳐진다(한쪽이 후하게 준 점수는 쓰이지 않는다).
합계 90점 미만 · P0 1건 이상 · 어느 한 키의 blocking=true 이면 발행 부적격이다.

--gate95 로 넘기는 S5 채점표(지침서 6항목·95점 합격선, 2인 확인) — 주면 함께 검사해 리뷰에 기록한다.
{{
  "reviewers": ["보반과장", "뮤즈대리"],        // 2인 이상(서로 달라야 함)
  "scores": {{
    "numbers": 0,   // 수치 정확성   0~25 (0점이면 즉시 반려)
    "law": 0,       // 법령·시행일   0~20
    "sources": 0,   // 1차 출처      0~15
    "osmu": 0,      // 4연동 일치    0~15
    "style": 0,     // 문체·금지어   0~15
    "mobile": 0     // 모바일·접근성 0~10
  }},
  "notes": ["<근거 한 줄>", ...],
  "reviewedAt": "<ISO8601>"
}}
95점 미만이거나 0점 항목이 하나라도 있으면 발행 부적격이다.
""".format()


# ───────────────────────── 채점표 검증 ─────────────────────────


class Issues:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    @property
    def ok(self) -> bool:
        return not self.errors


def validate_scorecard(data, label: str, rubric: dict, p0_codes: set[str], issues: Issues) -> dict:
    if not isinstance(data, dict):
        issues.error(f"{label}: 채점표가 JSON 객체가 아닙니다.")
        return {}
    reviewer = str(data.get("reviewer", "")).strip()
    if not reviewer:
        issues.error(f"{label}: `reviewer`(검수자 이름)가 없습니다 — 누가 채점했는지 없는 리뷰는 쓰지 않습니다.")

    scores = data.get("scores")
    if not isinstance(scores, dict):
        issues.error(f"{label}: `scores`가 없습니다.")
        scores = {}

    clean: dict[str, int] = {}
    for key in RUBRIC_ORDER:
        cap = int(rubric.get(key, 0))
        value = scores.get(key, None)
        if value is None:
            issues.error(f"{label}: `scores.{key}`({RUBRIC_NAME[key]})가 없습니다 — 5범주를 모두 채점해야 합니다.")
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            issues.error(f"{label}: `scores.{key}`가 숫자가 아닙니다({value!r}).")
            continue
        if float(value) != int(value):
            issues.error(f"{label}: `scores.{key}`는 정수여야 합니다({value}).")
            continue
        iv = int(value)
        if iv < 0 or iv > cap:
            issues.error(f"{label}: `scores.{key}` {iv}점 — 상한 {cap}점을 넘었습니다.")
            continue
        clean[key] = iv

    extra = set(scores) - set(RUBRIC_ORDER)
    if extra:
        issues.warn(f"{label}: 루브릭에 없는 범주는 무시했습니다: {', '.join(sorted(extra))}")

    total = sum(clean.values())
    declared = data.get("total")
    if declared is not None and not isinstance(declared, bool):
        try:
            if int(declared) != total:
                issues.warn(f"{label}: `total` {declared} ≠ 범주 합 {total} — 범주 합을 채택합니다.")
        except (TypeError, ValueError):
            issues.warn(f"{label}: `total`이 숫자가 아닙니다({declared!r}) — 무시했습니다.")

    p0 = data.get("p0") or []
    if isinstance(p0, str):
        p0 = [p0]
    if not isinstance(p0, list):
        issues.error(f"{label}: `p0`는 목록이어야 합니다.")
        p0 = []
    p0_clean = [str(x).strip() for x in p0 if str(x).strip()]
    for code in p0_clean:
        if p0_codes and code not in p0_codes:
            issues.warn(f"{label}: P0 코드 `{code}`는 루브릭 목록에 없습니다(그래도 차단 사유로 기록).")

    notes = data.get("notes") or []
    if isinstance(notes, str):
        notes = [notes]
    notes = [str(n).strip() for n in notes if str(n).strip()] if isinstance(notes, list) else []
    if not notes:
        issues.warn(f"{label}: `notes`가 비었습니다 — 검수 흔적 없는 점수는 신뢰도가 떨어집니다.")

    scope = data.get("scope") or []
    if isinstance(scope, str):
        scope = [scope]
    scope = [str(s).strip() for s in scope if str(s).strip()] if isinstance(scope, list) else []
    if not scope:
        issues.warn(f"{label}: `scope`(무엇을 확인했는지)가 비었습니다.")

    return {
        "reviewer": reviewer,
        "key": data.get("key"),
        "role": str(data.get("role", "") or "").strip(),
        "scope": scope,
        "scores": clean,
        "total": total,
        "p0": p0_clean,
        "blocking": bool(data.get("blocking")),
        "notes": notes,
        "reviewedAt": str(data.get("reviewedAt", "") or "").strip() or now_kst(),
    }


def merge_keys(keys: list[dict]) -> dict:
    merged: dict[str, int] = {}
    for key in RUBRIC_ORDER:
        values = [k["scores"][key] for k in keys if key in k.get("scores", {})]
        if values:
            merged[key] = min(values)
    return merged


def validate_gate95(data, issues: Issues) -> dict:
    """S5 지침서 6항목 95점 루브릭 채점표 — 2인이 확인한 한 장으로 받는다."""
    if not isinstance(data, dict):
        issues.error("gate95: 채점표가 JSON 객체가 아닙니다.")
        return {}
    reviewers = data.get("reviewers") or []
    if isinstance(reviewers, str):
        reviewers = [reviewers]
    reviewers = [str(r).strip() for r in reviewers if str(r).strip()] if isinstance(reviewers, list) else []
    if len(set(reviewers)) < 2:
        issues.error("gate95: `reviewers`가 2인 미만입니다 — 95점 게이트도 2-Key 확인이 필요합니다.")

    scores = data.get("scores")
    if not isinstance(scores, dict):
        issues.error("gate95: `scores`가 없습니다.")
        scores = {}
    clean: dict[str, int] = {}
    for code, name, cap in GATE95_ITEMS:
        value = scores.get(code)
        if value is None:
            issues.error(f"gate95: `scores.{code}`({name})가 없습니다.")
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            issues.error(f"gate95: `scores.{code}`가 숫자가 아닙니다({value!r}).")
            continue
        iv = int(value)
        if iv < 0 or iv > cap:
            issues.error(f"gate95: `scores.{code}` {iv}점 — 상한 {cap}점을 넘었습니다.")
            continue
        clean[code] = iv

    total = sum(clean.values())
    zero = [name for code, name, _cap in GATE95_ITEMS if clean.get(code, None) == 0]
    if zero:
        issues.error(f"gate95: 0점 항목이 있습니다({', '.join(zero)}) — 항목 하나라도 0점이면 반려입니다.")
    if total < GATE95_MIN:
        issues.error(f"gate95: 합계 {total}점 — 지침서 S5 합격선 {GATE95_MIN}점 미만입니다.")

    notes = data.get("notes") or []
    if isinstance(notes, str):
        notes = [notes]
    notes = [str(n).strip() for n in notes if str(n).strip()] if isinstance(notes, list) else []

    return {
        "reviewers": reviewers,
        "scores": clean,
        "total": total,
        "zeroItems": zero,
        "minTotal": GATE95_MIN,
        "notes": notes,
        "reviewedAt": str(data.get("reviewedAt", "") or "").strip() or now_kst(),
    }


# ───────────────────────── 초안 읽기 ─────────────────────────


def draft_slug(path: Path, explicit: str | None, fm: dict) -> str:
    slug = (explicit or "").strip() or str(fm.get("slug", "") or "").strip() or slugify_stem(path.stem)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,60}", slug):
        raise SystemExit(f"슬러그 `{slug}` — 영문 소문자·숫자·하이픈 3~61자가 필요합니다(`--slug`).")
    return slug


def read_draft(path: Path, pipe) -> tuple[dict, str]:
    if not path.exists():
        raise SystemExit(f"초안이 없습니다: {path}")
    raw = path.read_text(encoding="utf-8")
    if pipe is not None:
        fm, body = pipe.parse_markdown(raw)
    else:  # 폴백 — frontmatter만 최소 파싱
        fm, body = None, raw
        m = re.match(r"^---\n(.*?)\n---\n?(.*)$", raw, re.S)
        if m:
            try:
                import yaml

                fm = yaml.safe_load(m.group(1)) or {}
            except Exception:
                fm = {}
            body = m.group(2)
    if not fm:
        raise SystemExit(f"초안에 frontmatter(---)가 없습니다: {path}")
    return fm, body


# ───────────────────────── 리뷰 쓰기/검증 ─────────────────────────


def build_review(
    draft: Path,
    slug: str,
    fm: dict,
    keys: list[dict],
    cfg: dict,
    issues: Issues,
    reruns: int,
    hash_value: str,
    gate95: dict | None = None,
) -> dict:
    rubric = cfg.get("rubric") or {}
    gate = ((cfg.get("gates") or {}).get("review") or {})
    min_total = int(gate.get("min_total", rubric.get("block_below", DEFAULT_MIN_TOTAL)))
    merged = merge_keys(keys)
    total = sum(merged.values())
    p0: list[str] = []
    for k in keys:
        for code in k.get("p0", []):
            if code not in p0:
                p0.append(code)
    blocking = (
        not issues.ok
        or total < min_total
        or bool(p0)
        or any(k.get("blocking") for k in keys)
    )

    return {
        "slug": slug,
        "reviewedDraftHash": hash_value,
        "hashAlgo": "sha256",
        "hashSource": "draft-file",
        "draftPath": str(draft),
        "scores": {k: merged.get(k, 0) for k in RUBRIC_ORDER},
        "total": total,
        "p0": p0,
        "blocking": blocking,
        "reviewer": " + ".join(k["reviewer"] for k in keys if k["reviewer"]) or "2-Key 미확인",
        "reviewedAt": now_kst(),
        "rubric": {k: int(rubric.get(k, 0)) for k in RUBRIC_ORDER},
        "minTotal": min_total,
        "merge": "per-category-min",
        "keys": keys,
        "keyTotals": {k["reviewer"] or f"key{idx + 1}": k["total"] for idx, k in enumerate(keys)},
        "gate95": gate95 or {},
        "reruns": reruns,
        "maxReruns": int(gate.get("max_reruns", 3)),
        "gate": {"minTotal": min_total, "requireHashBinding": bool(gate.get("require_hash_binding", True))},
        "generator": "scripts/generate_review_json.py",
        "generatedAt": now_kst(),
        "warnings": list(issues.warnings),
        "draft": {
            "title": str(fm.get("title", "")),
            "category": str(fm.get("category", "")),
            "publishedAt": str(fm.get("publishedAt", "")),
            "baseDate": str(fm.get("baseDate", "")),
        },
    }


def check_review_file(draft: Path, slug: str, review_path: Path, cfg: dict, pipe) -> int:
    issues = Issues()
    if not review_path.exists():
        print(f"✗ 리뷰 리포트가 없습니다: {review_path}")
        return 1
    data = read_json(review_path)
    if not isinstance(data, dict):
        print("✗ 리뷰 리포트가 JSON 객체가 아닙니다.")
        return 1
    rubric = cfg.get("rubric") or {}
    gate = ((cfg.get("gates") or {}).get("review") or {})
    min_total = int(gate.get("min_total", rubric.get("block_below", DEFAULT_MIN_TOTAL)))

    want = draft_hash(draft, pipe)
    got = str(data.get("reviewedDraftHash", ""))
    if got != want:
        issues.error(f"`reviewedDraftHash`가 현재 초안과 다릅니다 — 리뷰가 무효입니다.\n   파일: {got}\n   초안: {want}")

    scores = data.get("scores")
    if not isinstance(scores, dict) or not scores:
        issues.error("`scores`가 없습니다.")
        scores = {}
    for key in RUBRIC_ORDER:
        cap = int(rubric.get(key, 0))
        v = scores.get(key)
        if v is None:
            issues.error(f"`scores.{key}`({RUBRIC_NAME[key]})가 없습니다.")
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            if int(v) > cap or int(v) < 0:
                issues.error(f"`scores.{key}` {v}점 — 0~{cap}점 범위를 벗어났습니다.")
        else:
            issues.error(f"`scores.{key}`가 숫자가 아닙니다.")

    total_field = data.get("total")
    summed = sum(int(v) for v in scores.values() if isinstance(v, (int, float)) and not isinstance(v, bool))
    if total_field is not None and int(total_field) != summed:
        issues.error(f"`total` {total_field} ≠ 범주 합 {summed} — 게이트가 이 리뷰를 거부합니다.")

    if summed < min_total:
        issues.error(f"합계 {summed}점 — 차단선 {min_total}점 미만입니다.")

    p0 = data.get("p0") or []
    if p0:
        issues.error(f"P0 {len(p0)}건이 남아 있습니다: {', '.join(str(x) for x in p0[:5])}")

    if data.get("blocking"):
        issues.error("리뷰가 `blocking: true`입니다 — 이 초안은 내보낼 수 없습니다.")

    keys = data.get("keys") or []
    if not isinstance(keys, list) or len(keys) < 2:
        issues.error("`keys`가 2건 미만입니다 — 2-Key 교차검증 기록이 없습니다.")
    else:
        names = [str(k.get("reviewer", "")).strip() for k in keys if isinstance(k, dict)]
        if len(set(names)) < 2:
            issues.error(f"두 키의 검수자가 같습니다({', '.join(names)}) — 교차검증이 아닙니다.")

    g95 = data.get("gate95") or {}
    if isinstance(g95, dict) and g95:
        gscores = g95.get("scores") if isinstance(g95.get("scores"), dict) else {}
        gtotal = sum(int(v) for v in gscores.values() if isinstance(v, (int, float)) and not isinstance(v, bool))
        if int(g95.get("total", gtotal)) != gtotal:
            issues.error(f"gate95 `total` {g95.get('total')} ≠ 6항목 합 {gtotal}.")
        if gtotal < GATE95_MIN:
            issues.error(f"gate95 합계 {gtotal}점 — 지침서 S5 합격선 {GATE95_MIN}점 미만입니다.")
        zero = [name for code, name, _cap in GATE95_ITEMS if gscores.get(code, None) == 0]
        if zero:
            issues.error(f"gate95 0점 항목: {', '.join(zero)}")
        if len(set(g95.get("reviewers") or [])) < 2:
            issues.error("gate95 `reviewers`가 2인 미만입니다.")
        print(f"   S5 95점: {gtotal}/100 (합격선 {GATE95_MIN})")
    else:
        issues.warn("`gate95`(S5 6항목 95점 루브릭)이 없습니다 — 코드 게이트만 검사됩니다.")

    print(f"■ 리뷰 검증: {review_path}")
    print(f"   초안 해시: {want}")
    print(f"   합계 {summed}/{sum(int(rubric.get(k, 0)) for k in RUBRIC_ORDER)}점 · 차단선 {min_total}점 · P0 {len(p0)}건")
    for key in RUBRIC_ORDER:
        print(f"   · {RUBRIC_NAME[key]:<12} {scores.get(key, '—')}/{rubric.get(key)}")
    for w in issues.warnings:
        print(f"   [경고] {w}")
    if issues.errors:
        for e in issues.errors:
            print(f"   [오류] {e}")
        print("결과: 리뷰 무효 — 발행 게이트를 통과하지 못합니다.")
        return 1
    print("결과: 리뷰 유효 — ingest 리뷰 게이트를 통과합니다.")
    return 0


# ───────────────────────── main ─────────────────────────


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="2-Key 100점 리뷰 리포트(.publish-reviews/<slug>.review.json) 생성·검증",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=SCHEMA_TEXT,
    )
    ap.add_argument("draft", nargs="?", help="초안 마크다운 경로")
    ap.add_argument("--slug", help="글 주소(기본: frontmatter slug 또는 파일명)")
    ap.add_argument("--key1", help="1-Key 채점표 JSON(보반과장: 수치·법령·출처·빌드)")
    ap.add_argument("--key2", help="2-Key 채점표 JSON(뮤즈대리: 시각·390px·실물 UX)")
    ap.add_argument("--reviewers", default=",".join(DEFAULT_REVIEWERS),
                    help=f"두 키의 검수자(쉼표 구분, 기본 {','.join(DEFAULT_REVIEWERS)})")
    ap.add_argument("--reviews-dir", default=str(APP_DIR / ".publish-reviews"),
                    help="리뷰 폴더(기본 .publish-reviews)")
    ap.add_argument("--gate95", help="S5 지침서 6항목 95점 루브릭 채점표 JSON(주면 95점 합격선까지 함께 검사)")
    ap.add_argument("--reruns", type=int, default=0, help="이 초안의 재검수 횟수(기록용)")
    ap.add_argument("--dry-run", action="store_true", help="검증만 하고 파일을 쓰지 않는다")
    ap.add_argument("--check", action="store_true", help="이미 있는 리뷰가 현재 초안과 맞는지 검증")
    ap.add_argument("--record-blocking", action="store_true",
                    help="부적격 리뷰를 blocking:true로 기록만 남긴다(발행은 계속 차단)")
    ap.add_argument("--print-schema", action="store_true", help="채점표 JSON 형식 출력")
    ap.add_argument("--self-test", action="store_true", help="publish_pipeline.draft_digest와 해시 일치 확인")
    ap.add_argument("--json", action="store_true", help="기계용 JSON 출력")
    args = ap.parse_args(argv)

    if args.print_schema:
        print(SCHEMA_TEXT)
        print("예시(1-Key):")
        print(json.dumps(SCHEMA_EXAMPLE, ensure_ascii=False, indent=2))
        ex2 = dict(SCHEMA_EXAMPLE)
        ex2.update({
            "reviewer": "뮤즈대리",
            "key": 2,
            "role": "시각·카드·390px 실물 UX (2-Key)",
            "scope": ["390px 가로 넘침", "표·카드 렌더", "이미지 alt", "본문 호흡"],
            "notes": ["390px에서 표 3열이 카드로 접힘 확인", "이미지 alt 2/2 존재"],
        })
        print("예시(2-Key):")
        print(json.dumps(ex2, ensure_ascii=False, indent=2))
        return 0

    if not args.draft:
        ap.print_help()
        return 2
    draft = Path(args.draft)
    if not draft.is_absolute():
        ref = Path.cwd() / draft
        draft = ref if ref.exists() else APP_DIR / draft

    pipe = load_pipeline()
    cfg = pipe.load_rules()
    rubric = cfg.get("rubric") or {}
    p0_codes = set(rubric.get("p0") or [])
    fm, _body = read_draft(draft, pipe)
    slug = draft_slug(draft, args.slug, fm)
    reviews_dir = Path(args.reviews_dir)
    review_path = reviews_dir / f"{slug}.review.json"

    if args.self_test:
        mine = draft_hash(draft, pipe)
        official = pipe.draft_digest(pipe.Post(slug=slug, path=draft, fm=fm, body=_body))
        print(f"초안: {draft}")
        print(f"이 스크립트: {mine}")
        print(f"publish_pipeline: {official}")
        if mine != official:
            print("✗ 불일치 — 리뷰가 게이트에서 review-stale로 거부됩니다.")
            return 1
        print("✓ 일치 — 이 해시로 만든 리뷰는 ingest 게이트를 통과합니다.")
        return 0

    if args.check:
        return check_review_file(draft, slug, review_path, cfg, pipe)

    expected = [r.strip() for r in args.reviewers.split(",") if r.strip()]
    if not args.key1 or not args.key2:
        print("✗ 2-Key 채점표가 필요합니다: --key1 <json> --key2 <json>", file=sys.stderr)
        print("   한 키만으로는 리뷰를 쓰지 않습니다(교차검증 아님). 형식은 --print-schema로 확인하세요.", file=sys.stderr)
        return 1

    issues = Issues()
    keys: list[dict] = []
    for idx, (label, path_str) in enumerate((("1-Key", args.key1), ("2-Key", args.key2)), start=1):
        data = read_json(Path(path_str))
        card = validate_scorecard(data, label, rubric, p0_codes, issues)
        if card:
            keys.append(card)
        if len(expected) >= idx and expected[idx - 1] and card.get("reviewer") != expected[idx - 1]:
            issues.warn(f"{label}: 검수자 `{card.get('reviewer', '')}` — 기대값 `{expected[idx - 1]}`와 다릅니다.")

    if len(keys) == 2 and keys[0]["reviewer"] and keys[0]["reviewer"] == keys[1]["reviewer"]:
        issues.error(f"두 키의 검수자가 같습니다({keys[0]['reviewer']}) — 서로 다른 검수자여야 합니다.")

    if args.reruns > int((((cfg.get("gates") or {}).get("review") or {}).get("max_reruns", 3))):
        issues.warn(f"재검수 {args.reruns}회 — 상한 {((cfg.get('gates') or {}).get('review') or {}).get('max_reruns', 3)}회를 넘었습니다.")

    gate95 = None
    if args.gate95:
        gate95 = validate_gate95(read_json(Path(args.gate95)), issues)

    hash_value = draft_hash(draft, pipe)
    review = build_review(draft, slug, fm, keys, cfg, issues, args.reruns, hash_value, gate95)

    if not issues.ok:
        print("■ 2-Key 리뷰 병합 — 입력 오류로 중단", file=sys.stderr)
        for e in issues.errors:
            print(f"   [오류] {e}", file=sys.stderr)
        for w in issues.warnings:
            print(f"   [경고] {w}", file=sys.stderr)
        return 2

    rubric_total = sum(int(rubric.get(k, 0)) for k in RUBRIC_ORDER)
    print(f"■ 2-Key 리뷰 — {slug}")
    print(f"   초안 해시: {hash_value}")
    for k in keys:
        q = {key: k["scores"].get(key, 0) for key in RUBRIC_ORDER}
        print(f"   · {k['reviewer'] or '(이름 없음)'} 합계 {k['total']}/{rubric_total} · P0 {len(k['p0'])}건"
              f"{' · BLOCKING' if k['blocking'] else ''}")
    print(f"   병합(범주별 최솟값): " + " · ".join(
        f"{RUBRIC_NAME[key]} {review['scores'][key]}/{rubric.get(key)}" for key in RUBRIC_ORDER))
    print(f"   총점 {review['total']}/{rubric_total} · 차단선 {review['minTotal']}점 · P0 {len(review['p0'])}건")
    for w in issues.warnings:
        print(f"   [경고] {w}")

    if gate95:
        print("   S5 95점 루브릭: {} /100 · 합격선 {}점 · 검수 {}".format(
            gate95.get("total", 0), GATE95_MIN, ", ".join(gate95.get("reviewers") or []) or "(없음)"))

    if review["blocking"]:
        if args.record_blocking and not args.dry_run:
            reviews_dir.mkdir(parents=True, exist_ok=True)
            review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"   기록: {review_path} (blocking:true — ingest는 계속 차단합니다)")
        else:
            print("결과: 발행 부적격 — 리뷰를 쓰지 않았습니다(리뷰 없음 = 게이트 차단).")
            print("      S4로 반려해 초안을 고친 뒤 2-Key 재검수를 받으세요.")
        if args.json:
            print(json.dumps({**review, "written": bool(args.record_blocking and not args.dry_run)},
                             ensure_ascii=False, indent=2))
        return 1

    if args.dry_run:
        print("결과: 게이트 통과 예상 — dry-run이라 파일을 쓰지 않았습니다.")
        if args.json:
            print(json.dumps({**review, "written": False}, ensure_ascii=False, indent=2))
        return 0

    reviews_dir.mkdir(parents=True, exist_ok=True)
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"결과: 리뷰 기록 완료 — {review_path}")
    print(f"다음: python3 scripts/publish_pipeline.py ingest {draft} --slug {slug} --dry-run")
    if args.json:
        print(json.dumps({**review, "written": True}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
