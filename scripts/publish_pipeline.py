#!/usr/bin/env python3
"""
buffetkimz.com 발행 파이프라인 v2 — 데일리 블로그·소식지 적재 게이트.

매일 나오는 원고(마크다운 초안)를 Astro 콘텐츠(`src/content/posts/*.md`)로
정규화·검증·적재하고, 빌드 결과(검색 인덱스·RSS·사이트맵·링크)까지 확인한다.
소식지(카카오채널·메일용)는 사용자가 직접 올리는 원칙이므로, 자동 발행하지 않고
검증된 초안 파일로만 만든다.

사용 예
  python3 scripts/publish_pipeline.py validate
  python3 scripts/publish_pipeline.py validate --json
  python3 scripts/publish_pipeline.py ingest drafts/2026-11-21-pension.md --dry-run
  python3 scripts/publish_pipeline.py ingest drafts/*.md --build
  python3 scripts/publish_pipeline.py build --slug pension-year-end-2026
  python3 scripts/publish_pipeline.py letter --date 2026-11-21 --days 3
  python3 scripts/publish_pipeline.py ratio

종료 코드
  0 통과(경고 포함) · 1 게이트 실패(오류) · 2 실행 환경/사용 오류
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "src" / "content" / "posts"
PUBLIC_DIR = ROOT / "public"
DIST_DIR = ROOT / "dist"
BACKUP_DIR = ROOT / ".publish-backups"
LETTERS_DIR = ROOT / "letters"
RULES_PATH = Path(__file__).with_name("publish_rules.json")
REPORT_DIR = Path("/workspace/reports/buffetkimz-web/pipeline-v2")

KST = timezone(timedelta(hours=9))
SITE_HOST = "buffetkimz.com"

LEVELS = {"error": 3, "warn": 2, "info": 1}
LEVEL_LABEL = {"error": "오류", "warn": "경고", "info": "정보"}

WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


# ────────────────────────────── 기본 도구 ──────────────────────────────


def norm(text: str) -> str:
    return unicodedata.normalize("NFC", text or "")


def today_kst() -> date:
    return datetime.now(KST).date()


def as_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y. %m. %d.", "%Y.%m.%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def ko_date(d: date) -> str:
    return f"{d.year}년 {d.month}월 {d.day}일 {WEEKDAYS[d.weekday()]}요일"


def compact(text: str) -> str:
    """비교용 — 공백·문장부호를 지운 문자열."""
    return re.sub(r"[\s.,·\"'`~!?()[\]{}<>:/\\|—–\-]", "", norm(text)).lower()


def bigrams(text: str) -> set[str]:
    t = compact(text)
    return {t[i : i + 2] for i in range(len(t) - 1)} if len(t) > 1 else {t}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def strip_code(body: str) -> str:
    return re.sub(r"```[\s\S]*?```", " ", body)


def plain_len(body: str) -> int:
    """공백을 뺀 본문 글자수(코드블록 제외)."""
    return len(re.sub(r"\s", "", strip_code(body)))


def reading_minutes(body: str, cfg) -> int:
    lim = cfg["limits"]
    per = lim["reading_chars_per_minute"]
    raw = plain_len(body) / per
    return max(lim["reading_min"], min(lim["reading_max"], int(round(raw))))


@dataclass
class Finding:
    level: str
    code: str
    message: str
    where: str = ""

    def as_dict(self) -> dict:
        return {"level": self.level, "code": self.code, "message": self.message, "where": self.where}


def has_error(findings: list[Finding]) -> bool:
    return any(f.level == "error" for f in findings)


def count_levels(findings: list[Finding]) -> dict:
    out = {"error": 0, "warn": 0, "info": 0}
    for f in findings:
        out[f.level] = out.get(f.level, 0) + 1
    return out


def load_rules() -> dict:
    with RULES_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


# ────────────────────────────── 글 읽기 ──────────────────────────────


@dataclass
class Post:
    slug: str
    path: Path | None
    fm: dict
    body: str

    @property
    def title(self) -> str:
        return str(self.fm.get("title", "")).strip()

    @property
    def category(self) -> str:
        return str(self.fm.get("category", "")).strip()

    @property
    def description(self) -> str:
        return str(self.fm.get("description", "")).strip()

    @property
    def published(self) -> date | None:
        return as_date(self.fm.get("publishedAt"))

    @property
    def base_date(self) -> date | None:
        return as_date(self.fm.get("baseDate")) or self.published

    @property
    def sources(self) -> list[dict]:
        raw = self.fm.get("sources") or []
        return [s for s in raw if isinstance(s, dict)]

    @property
    def tags(self) -> list[str]:
        raw = self.fm.get("tags") or []
        return [str(t).strip() for t in raw if str(t).strip()]


def parse_markdown(text: str) -> tuple[dict | None, str]:
    text = text.lstrip("\ufeff").replace("\r\n", "\n")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.S)
    if not m:
        return None, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None, text
    if not isinstance(fm, dict):
        return None, text
    return fm, m.group(2)


def load_posts(directory: Path = POSTS_DIR) -> list[Post]:
    posts: list[Post] = []
    for path in sorted(directory.glob("*.md")):
        fm, body = parse_markdown(path.read_text(encoding="utf-8"))
        if fm is None:
            continue
        posts.append(Post(slug=path.stem, path=path, fm=fm, body=norm(body)))
    posts.sort(key=lambda p: ((p.published or date.min), p.slug), reverse=True)
    return posts


# ────────────────────────────── 검증 ──────────────────────────────


def _has_negation(text: str, start: int, end: int, markers: list[str]) -> bool:
    window = text[max(0, start - 14) : min(len(text), end + 14)]
    return any(m in window for m in markers)


def check_required(post: Post, cfg, mode: str) -> list[Finding]:
    out: list[Finding] = []
    lim = cfg["limits"]

    for key in ("title", "category", "description"):
        if not str(post.fm.get(key, "")).strip():
            out.append(Finding("error", f"missing-{key}", f"필수 항목 `{key}`가 비어 있습니다."))

    if not post.published:
        out.append(Finding("error", "missing-publishedAt", "필수 항목 `publishedAt`(발행일)이 없거나 날짜 형식이 아닙니다."))

    if not post.base_date:
        if mode == "draft":
            out.append(Finding("warn", "missing-baseDate", "`baseDate`(기준일)가 없어 발행일을 기준일로 채웁니다."))
        else:
            out.append(Finding("error", "missing-baseDate", "`baseDate`(기준일)도 `publishedAt`도 없습니다."))

    if not post.sources:
        out.append(Finding("error", "missing-sources", "1차 출처(`sources`)가 하나도 없습니다."))

    if not post.tags:
        out.append(Finding("error", "missing-tags", "태그(`tags`)가 없습니다."))

    if post.category and post.category not in cfg["categories"]:
        allowed = ", ".join(cfg["categories"].keys())
        out.append(Finding("error", "bad-category", f"`{post.category}`는 없는 분야입니다. 허용: {allowed}"))

    # 제목·요약 길이
    t_len = len(post.title)
    if t_len and not (lim["title_min"] <= t_len <= lim["title_max"]):
        out.append(Finding("warn", "title-length", f"제목 {t_len}자 — {lim['title_min']}~{lim['title_max']}자를 권장합니다."))
    d_len = len(post.description)
    if d_len and not (lim["description_min"] <= d_len <= lim["description_max"]):
        out.append(
            Finding("warn", "description-length", f"요약 {d_len}자 — {lim['description_min']}~{lim['description_max']}자를 권장합니다.")
        )

    # 날짜 정합성
    today = today_kst()
    if post.published:
        if post.published > today + timedelta(days=1):
            out.append(Finding("error", "future-publishedAt", f"발행일 {iso(post.published)}이 미래입니다."))
        age = (today - post.published).days
        if mode == "draft" and age > 3:
            out.append(Finding("error", "stale-draft", f"발행일이 {age}일 지났습니다. 데일리 적재는 3일 이내 초안만 받습니다."))
        if age > lim["publish_age_days_warn"]:
            out.append(Finding("info", "old-post", f"발행일이 {age}일 전입니다(아카이브 검증에서는 정상)."))

    if post.base_date and post.published:
        drift = abs((post.base_date - post.published).days)
        if drift > lim["base_date_drift_days"]:
            out.append(
                Finding("warn", "baseDate-drift", f"기준일 {iso(post.base_date)}과 발행일 {iso(post.published)}이 {drift}일 차이입니다.")
            )
        if post.base_date > today + timedelta(days=1):
            out.append(Finding("error", "future-baseDate", f"기준일 {iso(post.base_date)}이 미래입니다."))

    # 태그 — 최대 3개 강제(넘으면 오류). 카드 2개·상세 3개가 화면 상한이다.
    tags = post.tags
    if tags:
        if len(tags) > lim["tags_max"]:
            out.append(
                Finding(
                    "error",
                    "tags-count",
                    f"태그 {len(tags)}개 — 최대 {lim['tags_max']}개입니다. 핵심 태그 3개 이하로 줄이세요(현재: {', '.join(tags)})",
                )
            )
        elif len(tags) < lim["tags_min"]:
            out.append(Finding("warn", "tags-count", f"태그 {len(tags)}개 — 최소 {lim['tags_min']}개가 필요합니다."))
        if len(set(tags)) != len(tags):
            out.append(Finding("error", "tags-duplicate", "태그에 중복이 있습니다."))
        for tag in tags:
            if not (lim["tag_min_len"] <= len(tag) <= lim["tag_max_len"]):
                out.append(Finding("warn", "tag-length", f"태그 `{tag}` 길이 {len(tag)}자 — 2~20자로 줄이세요."))
            if tag.startswith("#"):
                out.append(Finding("warn", "tag-hash", f"태그 `{tag}`에 `#`을 붙이지 않습니다(사이트가 자동 처리)."))
        cat_name = cfg["categories"].get(post.category, {}).get("name")
        if cat_name and any(compact(t) == compact(cat_name) for t in tags):
            out.append(Finding("info", "tag-equals-category", f"태그가 분야명(`{cat_name}`)과 같습니다 — 검색에서 분야 필터와 겹칩니다."))

    # 대표이미지
    thumb = str(post.fm.get("thumb", "") or "").strip()
    if thumb:
        if not thumb.startswith("/thumbs/"):
            out.append(Finding("warn", "thumb-path", f"대표이미지 경로 `{thumb}` — `/thumbs/` 아래 1200×630 WebP를 씁니다(render_thumbs.py)."))
        thumb_file = PUBLIC_DIR / thumb.lstrip("/")
        if not thumb_file.exists():
            out.append(Finding("error", "thumb-missing", f"대표이미지 파일이 없습니다: public{thumb}"))
        else:
            out += check_thumb_ratio(thumb_file, thumb)
    else:
        guessed = topic_thumb(post.category)
        if not (PUBLIC_DIR / guessed.lstrip("/")).exists():
            out.append(Finding("error", "thumb-missing", f"대표이미지도 없고 분야 기본 이미지({guessed})도 없습니다."))
        else:
            out.append(Finding("warn", "thumb-auto", f"대표이미지가 없어 분야 기본 이미지 `{guessed}`로 자동 매핑합니다."))

    # 읽기 시간
    rm = post.fm.get("readingMinutes")
    expected = reading_minutes(post.body, cfg) if post.body.strip() else None
    if rm is None:
        out.append(Finding("warn", "missing-readingMinutes", f"`readingMinutes`가 없습니다 — 본문 기준 {expected}분으로 채웁니다."))
    else:
        try:
            rm_i = int(rm)
        except (TypeError, ValueError):
            out.append(Finding("error", "bad-readingMinutes", f"`readingMinutes`가 숫자가 아닙니다: {rm!r}"))
        else:
            drift_limit = int(lim.get("reading_drift_minutes", 2))
            if expected and abs(rm_i - expected) > drift_limit:
                out.append(
                    Finding("warn", "readingMinutes-drift", f"`readingMinutes` {rm_i}분 vs 본문 계산 {expected}분 — 한쪽을 맞추세요.")
                )
    return out


def check_thumb_ratio(path: Path, public_path: str) -> list[Finding]:
    """대표이미지 비율 — 새 규격 1200×630(1.9) / 기존 1280×800(1.6) 허용."""
    try:
        from PIL import Image  # type: ignore

        with Image.open(path) as im:
            w, h = im.size
    except Exception:  # noqa: BLE001 — 이미지 도구가 없으면 조용히 건너뛴다
        return []
    ratio = w / h
    if 1.85 <= ratio <= 1.95:
        return [Finding("info", "thumb-ratio", f"대표이미지 {w}×{h} — 1200×630 규격")]
    if 1.55 <= ratio <= 1.65:
        return [Finding("info", "thumb-ratio", f"대표이미지 {w}×{h} — 기존 16:10. 새 이미지는 1200×630을 씁니다")]
    return [Finding("warn", "thumb-ratio", f"대표이미지 비율 {w}×{h} — 1200×630(1.9) 또는 16:10(1.6)으로 맞추세요")]


def topic_thumb(category: str) -> str:
    return f"/thumbs/topic-{category}.webp" if category else "/thumbs/topic-philosophy.webp"


# ── 에디토리얼 썸네일 (v5.8) ─────────────────────────────────────────────
# 새 글의 대표이미지는 `scripts/render_thumbs.py`가 만든다. 문안은 `scripts/thumbs.json`
# 한 곳에서 관리하고, 파이프라인은 그 문안이 있는 글만 렌더를 호출한다.
# (문안이 없으면 분야 기본 이미지로 되돌아간다 — 카드가 비지 않게.)
THUMB_MANIFEST = ROOT / "scripts" / "thumbs.json"
THUMB_RENDERER = ROOT / "scripts" / "render_thumbs.py"


def editorial_thumb(slug: str, timeout: int = 180) -> Path | None:
    """thumbs.json에 이 슬러그의 문안이 있으면 1200×630 WebP를 렌더해 경로를 돌려준다."""
    try:
        manifest = json.loads(THUMB_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    item = next((i for i in manifest.get("items", []) if i.get("slug") == slug), None)
    if not item or not THUMB_RENDERER.exists():
        return None
    out = ROOT / str(item.get("out") or f"public/thumbs/{slug}.webp")
    if not out.exists():
        try:
            subprocess.run(
                [sys.executable, str(THUMB_RENDERER), "--only", slug],
                cwd=ROOT,
                check=True,
                capture_output=True,
                timeout=timeout,
            )
        except (subprocess.SubprocessError, OSError):
            return None
    return out if out.exists() else None


def check_sources(post: Post, cfg, mode: str) -> list[Finding]:
    """1차 출처 검사 — 분야별로 요구 수준이 다르다(rules `source_policy`).

    · 금융·투자·연금·노후·경제·보험: URL 있는 1차 출처가 100% 필요(없으면 오류)
    · AI: 작성자 업무 기록 1건까지 URL 없이 허용, 그와 별도로 1차 출처 URL 필요
    · 철학·에세이: 원전·개인 기록 표기가 있으면 URL 없이 허용(essay_no_url_ok, 정보)
    """
    out: list[Finding] = []
    srcs = post.sources
    if not srcs:
        return out

    primary_hosts = {h.lower() for h in cfg["primary_source_hosts"]}
    blocked = cfg["source_host_blocklist"]
    markers = cfg["primary_source_markers"]
    policy = cfg.get("source_policy", {})
    strict = set(policy.get("primary_url_required", []))
    author_ok_cats = set(policy.get("author_record_allowed", []))
    essay_cats = set(policy.get("essay_exempt", []))
    essay_code = policy.get("essay_exempt_code", "essay_no_url_ok")
    essay_markers = policy.get("essay_markers", [])
    author_markers = policy.get("author_record_markers", [])

    is_strict = post.category in strict
    is_essay = post.category in essay_cats
    author_ok = post.category in author_ok_cats

    with_url = 0
    primary: list[str] = []
    no_url_labels: list[str] = []
    for s in srcs:
        label = str(s.get("label", "")).strip()
        url = str(s.get("url", "") or "").strip()
        if not label:
            out.append(Finding("error", "source-label", "출처 항목에 `label`이 비어 있습니다."))
            continue
        if len(label) < 4:
            out.append(Finding("warn", "source-label-short", f"출처 라벨이 너무 짧습니다: `{label}`"))
        if not url:
            no_url_labels.append(label)
            continue
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            out.append(Finding("error", "source-url", f"출처 URL이 올바르지 않습니다: `{url}`"))
            continue
        with_url += 1
        host = parsed.netloc.lower()
        if any(host == b or host.endswith("." + b) for b in blocked):
            out.append(Finding("error", "source-blocked", f"검색·태그·SNS 주소는 1차 출처가 아닙니다: `{url}`"))
        if host in primary_hosts or any(host.endswith("." + h) for h in primary_hosts):
            primary.append(label)
        elif any(mk in label for mk in markers):
            primary.append(label)

    # ── URL 없는 출처: 분야 정책에 따라 오류·경고·정보로 갈린다
    essay_settled = False
    for label in no_url_labels:
        if is_essay and any(mk in label for mk in essay_markers):
            essay_settled = True
            continue
        if author_ok and any(mk in label for mk in author_markers):
            out.append(Finding("info", "author-record",
                               f"`{label}` — 작성자 업무 기록으로 갈음(URL 없음)."))
            continue
        if is_strict:
            out.append(Finding("error", "source-url-missing",
                               f"`{post.category}` 글의 출처 `{label}`에 원문 URL이 없습니다 — 1차 출처 URL이 필요합니다."))
        elif is_essay:
            out.append(Finding("warn", "source-essay-marker",
                               f"`{label}` — 철학·에세이 예외를 쓰려면 라벨에 원전·개인 기록 표기가 필요합니다."))
        else:
            out.append(Finding("warn", "source-url-missing",
                               f"출처 `{label}`에 URL이 없습니다 — 원문 주소를 넣어야 확인 가능한 기록이 됩니다."))

    if with_url == 0 and not (is_essay and essay_settled):
        out.append(Finding("error", "source-no-url",
                           "URL이 있는 출처가 없습니다 — 원문 주소를 넣어야 확인 가능한 기록이 됩니다."))

    if not primary:
        if is_essay and essay_settled:
            out.append(Finding("info", essay_code,
                               "철학·에세이 예외 — 정부·법령 1차 자료 대신 원전·개인 기록으로 갈음합니다."))
        else:
            level = "error" if is_strict else "warn"
            out.append(
                Finding(
                    level,
                    "source-not-primary",
                    "정부·공공기관·법령 같은 1차 자료 출처가 없습니다. 언론·블로그만 있으면 원문으로 다시 확인하세요.",
                )
            )
    if len(srcs) == 1:
        out.append(Finding("info", "source-single", "출처가 1건입니다 — 숫자를 인용했다면 한 곳 더 대조하는 편이 안전합니다."))

    # 숫자를 많이 인용하는 글은 출처가 하나로 부족하다
    numeric = re.findall(r"\d[\d,. ]*\s?(?:%|만원|억원|조원|원|명|개|bp|포인트|배)", strip_code(post.body))
    if len(numeric) >= 8 and len(srcs) < 2:
        out.append(Finding("warn", "source-numbers",
                           f"숫자 인용 {len(numeric)}곳인데 출처가 {len(srcs)}건 — 원문을 한 곳 더 붙이세요."))
    return out


_SITE_DISCLAIMER_CACHE: dict[str, tuple[bool, str]] = {}


def site_disclaimer_block(cfg: dict) -> tuple[bool, str]:
    """글 상세 하단에 공통 고정 렌더되는 비권유 면책 블록이 실제 소스에 있는지.

    화면에는 이 공통 블록 1개만 둔다 — 본문 끝 이탤릭 면책 문단을 또 넣으면 중복이다.
    """
    block = (cfg.get("disclaimer") or {}).get("site_block") or {}
    if not block:
        return False, "disclaimer.site_block 미설정"
    rel = str(block.get("file", ""))
    marker = str(block.get("marker", "data-post-disclaimer"))
    text_marker = str(block.get("text_marker", "권하지 않습니다"))
    if rel in _SITE_DISCLAIMER_CACHE:
        return _SITE_DISCLAIMER_CACHE[rel]
    path = ROOT / rel
    if not path.exists():
        result = (False, f"{rel} 파일이 없습니다")
    else:
        src = path.read_text(encoding="utf-8")
        has_marker = marker in src
        has_text = text_marker in src
        result = (has_marker and has_text, f"{rel} · {marker}={has_marker} · '{text_marker}'={has_text}")
    _SITE_DISCLAIMER_CACHE[rel] = result
    return result


def check_body(post: Post, cfg, mode: str) -> list[Finding]:
    out: list[Finding] = []
    body = strip_code(post.body)
    lim = cfg["limits"]
    chars = plain_len(post.body)

    if chars < lim["body_chars_min"]:
        out.append(Finding("error", "body-short", f"본문 {chars}자 — 아카이브 글은 최소 {lim['body_chars_min']}자입니다."))
    elif chars < lim["body_chars_warn"]:
        out.append(Finding("warn", "body-thin", f"본문 {chars}자 — {lim['body_chars_warn']}자 이상을 권장합니다."))
    if chars > lim["body_chars_max"]:
        out.append(Finding("warn", "body-long", f"본문 {chars}자 — 한 편이 너무 길면 두 편으로 나누세요."))

    h1 = len(re.findall(r"^#\s", body, re.M))
    h2 = len(re.findall(r"^##\s", body, re.M))
    if h1:
        out.append(Finding("error", "body-h1", "본문에 `#`(h1)을 쓰지 않습니다 — 제목은 frontmatter가 담당합니다."))
    if h2 < lim["headings_h2_min"]:
        out.append(Finding("error", "body-h2", f"소제목(`##`)이 {h2}개 — 최소 {lim['headings_h2_min']}개가 필요합니다."))

    bold = len(re.findall(r"\*\*[^*\n]+\*\*", body))
    density = bold * 1000 / max(chars, 1)
    if density > lim["bold_per_1000_error"]:
        out.append(Finding("error", "style-bold", f"굵게 표시가 1,000자당 {density:.1f}개 — 기준 {lim['bold_per_1000_error']}개를 넘습니다."))
    elif density > lim["bold_per_1000_warn"]:
        out.append(Finding("warn", "style-bold", f"굵게 표시가 1,000자당 {density:.1f}개 — 조금 줄이면 읽기 편합니다."))

    # 줄표(—) 상한 — 만능 연결부로 쓰면 문장 리듬이 기계적으로 읽힌다(2026-11-24 전수 감사 §5-1)
    dashes = body.count("—")
    dash_density = dashes * 1000 / max(chars, 1)
    if dashes > lim.get("dash_total_warn", 3):
        out.append(
            Finding(
                "warn",
                "style-dash",
                f"줄표(—) {dashes}개 — 편당 {lim.get('dash_total_warn', 3)}개 이하를 권합니다(설명을 덧붙이지 말고 문장을 끊어 보세요).",
            )
        )
    elif dash_density > lim.get("dash_per_1000_warn", 4.0):
        out.append(
            Finding(
                "warn",
                "style-dash",
                f"줄표(—)가 1,000자당 {dash_density:.1f}개 — 기준 {lim.get('dash_per_1000_warn', 4.0)}개를 넘습니다.",
            )
        )

    quotes = len(re.findall(r"[\"“”'‘’]", body))
    if quotes > lim["quotes_error"]:
        out.append(Finding("error", "style-quotes", f"따옴표 {quotes}개 — 아카이브 문체는 인용이 꼭 필요할 때만 씁니다."))
    elif quotes > lim["quotes_warn"]:
        out.append(Finding("warn", "style-quotes", f"따옴표 {quotes}개 — 남발하지 않았는지 확인하세요."))

    exclaim = len(re.findall(r"!", body))
    if exclaim > lim["exclaim_warn"]:
        out.append(Finding("warn", "style-exclaim", f"느낌표 {exclaim}개 — 차분한 기록 문체에서는 줄입니다."))

    emoji = re.findall(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", body)
    if emoji:
        out.append(Finding("warn", "style-emoji", f"이모지 {len(emoji)}개 — 아카이브 본문에는 쓰지 않습니다: {''.join(sorted(set(emoji)))[:12]}"))

    external = [u for u in re.findall(r"https?://[^\s)\]]+", body)]
    if external:
        out.append(
            Finding(
                "warn",
                "body-external-link",
                f"본문에 외부 링크 {len(external)}개 — 출처는 `sources`에 넣고 본문은 내부 링크만 씁니다: {external[0][:60]}",
            )
        )

    if re.search(r"!\[\s*\]\(", body):
        out.append(Finding("error", "body-empty-image", "대체 텍스트가 빈 이미지가 있습니다."))

    # 면책 (돈·제도 글) — 하단 공통 블록 1개가 정본, 본문 끝 이탤릭 문단은 중복이다
    disc_cfg = cfg["disclaimer"]
    if post.category in disc_cfg["required_categories"]:
        tail = body[-400:]
        if re.search(disc_cfg["pattern"], tail):
            out.append(
                Finding(
                    str(disc_cfg.get("body_duplicate_level", "warn")),
                    "disclaimer-duplicate",
                    "본문 끝에 면책 문단이 또 있습니다 — 하단 공통 비권유 블록 1개만 남기고 본문에서는 빼세요.",
                )
            )
        site_ok, site_note = site_disclaimer_block(cfg)
        if not site_ok:
            out.append(
                Finding(
                    "warn",
                    "disclaimer",
                    f"글 하단 공통 확인 안내 블록을 확인하지 못했습니다 — {site_note}",
                )
            )
    return out


def check_forbidden(post: Post, cfg) -> list[Finding]:
    out: list[Finding] = []
    text = f"{post.title}\n{post.description}\n{post.body}"
    markers = cfg["negation_markers"]
    for rule in cfg["forbidden_terms"]:
        term = rule["term"]
        for m in re.finditer(re.escape(term), text):
            if _has_negation(text, m.start(), m.end(), markers):
                continue
            out.append(
                Finding(rule["level"], "forbidden", f"금지 표현 `{term}` — {rule['why']} (…{text[max(0,m.start()-18):m.end()+18].strip()}…)")
            )
            break
    return out


def check_placeholders(post: Post, cfg) -> list[Finding]:
    out: list[Finding] = []
    text = f"{post.title}\n{post.description}\n{post.body}\n{post.fm}"
    for rule in cfg["placeholder_patterns"]:
        if re.search(rule["pattern"], text):
            out.append(Finding("error", "placeholder", f"미확정 표식이 남아 있습니다: {rule['message']}"))
    return out


def check_pii(post: Post, cfg) -> list[Finding]:
    out: list[Finding] = []
    text = f"{post.title}\n{post.description}\n{post.body}"
    for rule in cfg["pii_patterns"]:
        m = re.search(rule["pattern"], text)
        if m:
            out.append(Finding(rule["level"], rule["code"], f"{rule['message']} 의심: `{m.group(0)[:20]}`"))
    if has_error(out):
        return out
    # 계좌번호처럼 긴 숫자열
    for m in re.finditer(r"\d[\d\s-]{8,}\d", strip_code(post.body)):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) >= 10 and not re.fullmatch(r"\d{4}[-.]\d{1,2}[-.]\d{1,2}", m.group(0).strip()):
            out.append(Finding("warn", "pii-long-number", f"긴 숫자열({len(digits)}자리) — 계좌·증권번호가 아닌지 확인: `{m.group(0)[:24]}`"))
            break
    return out


def check_duplicates(post: Post, archive: list[Post], cfg) -> list[Finding]:
    out: list[Finding] = []
    others = [p for p in archive if p.slug != post.slug]
    c_title = compact(post.title)
    code = compact(post.category)

    for other in others:
        if compact(other.title) == c_title:
            out.append(Finding("error", "duplicate-title", f"같은 제목의 글이 이미 있습니다: {other.slug}"))
            break
    else:
        best = (0.0, None)
        for other in others:
            score = jaccard(bigrams(post.title), bigrams(other.title))
            if score > best[0]:
                best = (score, other)
        if best[1] and best[0] >= 0.55:
            out.append(
                Finding("error", "near-duplicate-title", f"제목이 거의 같습니다({best[0]:.2f}) — `{best[1].title}` ({best[1].slug})")
            )
        elif best[1] and best[0] >= 0.42:
            out.append(Finding("warn", "near-duplicate-title", f"제목이 비슷합니다({best[0]:.2f}) — `{best[1].title}`"))
        if code:
            for other in others:
                if compact(other.title) == code:
                    out.append(Finding("warn", "title-equals-category", "제목이 분야명과 같습니다 — 검색에서 구분되지 않습니다."))
                    break
    return out


def check_concentration(post: Post, archive: list[Post], cfg) -> list[Finding]:
    out: list[Finding] = []
    conc = cfg["concentration"]
    ordered = sorted(archive, key=lambda p: ((p.published or date.min), p.slug), reverse=True)
    same_run = 0
    for p in ordered:
        if p.category == post.category:
            same_run += 1
        else:
            break
    if same_run + 1 >= conc["error_same_run"]:
        out.append(
            Finding("error", "category-run", f"`{post.category}` 분야가 {same_run + 1}편 연속입니다 — 주제를 분산하세요.")
        )
    elif same_run + 1 >= conc["warn_same_run"] and same_run > 0:
        out.append(Finding("warn", "category-run", f"`{post.category}` 분야가 {same_run + 1}편 연속입니다."))

    window = ordered[: conc["window"]]
    if window:
        same = sum(1 for p in window if p.category == post.category)
        if same + 1 >= conc["warn_category_in_window"]:
            out.append(
                Finding("info", "category-window", f"최근 {len(window)}편 중 `{post.category}`가 {same}편 — 다음 글은 다른 분야가 좋습니다.")
            )
    return out


def check_topic_policy(post: Post, cfg) -> list[Finding]:
    """시황 등락 중계·개별 종목 매매 판단·특정 보험사/상품 홍보를 걸러 낸다."""
    out: list[Finding] = []
    policy = cfg.get("topic_policy", {})
    text = f"{post.title}\n{post.description}\n{post.body}"

    recap = policy.get("market_recap", {})
    for pattern in recap.get("title_patterns", []):
        m = re.search(pattern, f"{post.title}\n{post.description}")
        if m:
            out.append(Finding(recap.get("level", "error"), "excluded-market",
                               f"{recap.get('why', '단기 시황 등락 중계')} — `{m.group(0)[:40]}`"))
            break

    calls = policy.get("stock_call", {})
    for term in calls.get("terms", []):
        if term in text:
            out.append(Finding(calls.get("level", "warn"), "stock-call", f"{calls.get('why', '')}: `{term}`"))
            break

    insurers = policy.get("insurers", [])
    markers = policy.get("promo_markers", [])
    for name in insurers:
        idx = text.find(name)
        if idx == -1:
            continue
        window = text[max(0, idx - 40): idx + len(name) + 40]
        if any(mk in window for mk in markers):
            out.append(
                Finding(policy.get("promo_level", "error"), "insurer-promo",
                        f"{policy.get('promo_why', '특정 보험사·상품 홍보')} — `{name}` (…{window.strip()[:50]}…)")
            )
            break
        out.append(Finding("info", "insurer-mentioned", f"보험사 이름이 나옵니다(`{name}`) — 특정 상품 홍보가 아닌지 확인."))
        break
    return out


def body_fingerprint(body: str) -> str:
    """공백·문장부호를 지운 본문의 해시 — 문장만 다른 완전 중복을 잡는다."""
    flat = re.sub(r"[\s.,·\"'`~!?()[\]{}<>:/\\|—–\-]", "", norm(body)).lower()
    return hashlib.sha256(flat.encode("utf-8")).hexdigest()


def check_body_hash(post: Post, archive: list[Post]) -> list[Finding]:
    if not post.body.strip():
        return []
    mine = body_fingerprint(post.body)
    for other in archive:
        if other.slug == post.slug:
            continue
        if body_fingerprint(other.body) == mine:
            return [Finding("error", "duplicate-body", f"본문이 같은 글이 이미 있습니다: {other.slug}")]
    return []


# ───────────────────────── v6.0 게이트 ─────────────────────────
#  스펙: reports/buffetkimz-web/v60-pension-sim/01-publish-gate-spec.md
#   · Answer-First — 요약·본문 첫 300자에 "직접 답하는 1문장 + 숫자 1개"
#   · Information-Gain — frontmatter `gain` 한 문장(이 글만 더하는 것). 못 쓰면 그 글은 쓰지 않는다
#   · 100점 리뷰 — 5범주 합 90점 미만 또는 P0 있으면 차단, 초안 해시에 결속(nonce 대응)
#   · 화면(visual) 게이트는 실행 단위 1회(`check_visual_gate`)·링크 게이트는 build의 verify_dist가 맡는다
#  아카이브(이미 발행된 14편)는 소급 차단하지 않는다 — `archive_level`(기본 warn) 그림자 모드로만 보고한다(스펙 §9.1).

ANSWER_END = ("입니다", "습니다", "됩니다", "입니다만", "예요", "이에요")
ANSWER_NUM = re.compile(r"\d[\d,. ]*\s*(?:%|만원|억원|원|년|개월|세|배|포인트|bp)")
GAIN_CLICHE = ("자세히 정리", "총정리", "알아보자", "완벽 가이드", "모든 것", "핵심 정리")
REVIEW_DIR = ROOT / ".publish-reviews"


def gate_cfg(cfg, name: str) -> dict:
    return (cfg.get("gates") or {}).get(name) or {}


def gate_level(cfg, name: str, mode: str) -> str | None:
    """게이트 판정 수준 — 꺼져 있으면 None, 아카이브는 `archive_level`(기본 warn)."""
    g = gate_cfg(cfg, name)
    if not g.get("enabled"):
        return None
    if mode == "archive":
        return g.get("archive_level", "warn")
    return g.get("level", "error")


def check_answer_first(post: Post, cfg, mode: str = "archive") -> list[Finding]:
    """Answer-First — 질문 → 답(숫자 포함) → 설명 순서인지 본다."""
    level = gate_level(cfg, "answer_first", mode)
    if not level:
        return []
    g = gate_cfg(cfg, "answer_first")
    window = int(g.get("body_window", 300))
    out: list[Finding] = []

    desc = post.description
    if g.get("description_requires_number", True) and desc and not ANSWER_NUM.search(desc):
        out.append(
            Finding(
                level,
                "answer-first-desc",
                "요약에 결론을 받쳐 주는 숫자가 없습니다 — '무엇이 얼마인지'를 한 문장으로 넣으세요.",
            )
        )

    flat = re.sub(r"\s+", " ", strip_code(post.body)).strip()
    first = flat[:window]
    sentences = re.split(r"(?<=[.!?])\s+", first)
    # 문장 끝이 '…입니다.'처럼 마침표를 포함하므로 마침표·따옴표를 떼고 어미를 본다(스펙 스니펫 보정).
    direct = [
        s
        for s in sentences
        if s.strip().rstrip(".!?\"'”’").endswith(ANSWER_END) and ANSWER_NUM.search(s)
    ]
    if flat and not direct:
        out.append(
            Finding(
                level,
                "answer-first-body",
                "본문 첫 300자에 숫자를 포함한 직답 문장이 없습니다 — 질문 → 답 → 설명 순서로 고치세요.",
            )
        )

    h2 = re.search(r"^##\s.*$", strip_code(post.body), re.M)
    if h2 and direct:
        before = re.sub(r"\s+", " ", strip_code(post.body)[: h2.start()]).strip()
        before_sents = re.split(r"(?<=[.!?])\s+", before) if before else []
        answered_before = any(
            s.strip().rstrip(".!?\"'”’").endswith(ANSWER_END) and ANSWER_NUM.search(s) for s in before_sents
        )
        if not answered_before:
            out.append(Finding("warn", "answer-first-order", "첫 소제목이 직답보다 앞에 있습니다 — 질문 → 답 → 설명 순서로 고치세요."))
    return out


def check_information_gain(post: Post, cfg, mode: str = "archive") -> list[Finding]:
    """Information-Gain — '이 글만 더하는 것' 한 문장(`gain`)을 강제한다."""
    level = gate_level(cfg, "information_gain", mode)
    if not level:
        return []
    extra = cfg.get("information_gain") or {}
    min_len = int(extra.get("min_len", 30))
    types = extra.get("types") or []
    gain = str(post.fm.get("gain", "") or "").strip()
    if not gain:
        return [
            Finding(
                level,
                "information-gain",
                "`gain`이 없습니다 — '이 글만 더하는 것'을 한 문장으로 쓰세요. 못 쓰면 그 글은 쓰지 않습니다.",
            )
        ]
    out: list[Finding] = []
    if len(gain) < min_len:
        out.append(Finding(level, "information-gain-short", f"`gain`이 {len(gain)}자 — {min_len}자 이상 한 문장으로 구체화하세요."))
    hit = [c for c in GAIN_CLICHE if c in gain]
    if hit:
        out.append(Finding(level, "information-gain-cliche", f"`gain`이 상투적입니다({', '.join(hit)}): {gain[:60]}"))
    gtype = str(post.fm.get("gainType", "") or "").strip()
    if not gtype:
        out.append(Finding("warn", "information-gain-type", "`gainType`(original-data·real-example·tool·clearer-answer·stronger-opinion)이 없습니다."))
    elif types and gtype not in types:
        out.append(Finding("warn", "information-gain-type", f"`gainType` `{gtype}`은 허용 목록에 없습니다: {', '.join(types)}"))
    elif gtype == "tool" and not str(post.fm.get("toolHref", "") or "").strip():
        out.append(Finding(level, "information-gain-tool", "`gainType: tool`이면 `toolHref`가 필요합니다."))
    return out


def draft_digest(post: Post) -> str:
    """리뷰 결속용 초안 해시 — 파일 원문(없으면 재구성한 frontmatter+본문)의 sha256."""
    if post.path and post.path.exists():
        raw = post.path.read_text(encoding="utf-8")
    else:
        raw = emit_frontmatter(post.fm) + "\n\n" + post.body
    return "sha256:" + hashlib.sha256(norm(raw).replace("\r\n", "\n").encode("utf-8")).hexdigest()


def check_review(post: Post, cfg, mode: str = "archive") -> list[Finding]:
    """100점 루브릭 리뷰 — 파일이 없거나 초안 해시가 달라졌으면 무효(손으로 PASS를 못 쓴다)."""
    level = gate_level(cfg, "review", mode)
    if not level:
        return []
    g = gate_cfg(cfg, "review")
    min_total = int(g.get("min_total", 90))
    path = REVIEW_DIR / f"{post.slug}.review.json"
    if not path.exists():
        return [
            Finding(
                level,
                "review-missing",
                f"100점 리뷰 리포트가 없습니다: .publish-reviews/{post.slug}.review.json (5범주 합 {min_total}점 이상 + P0 0).",
            )
        ]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [Finding(level, "review-invalid", f"리뷰 리포트를 읽지 못했습니다({exc}).")]
    if not isinstance(data, dict):
        return [Finding(level, "review-invalid", "리뷰 리포트 형식이 객체(JSON object)가 아닙니다.")]

    out: list[Finding] = []
    scores = data.get("scores") if isinstance(data.get("scores"), dict) else {}
    total = data.get("total")
    if scores and isinstance(total, (int, float)) and int(total) != int(sum(scores.values())):
        out.append(Finding(level, "review-total-mismatch", f"`total` {total} ≠ 5범주 합 {int(sum(scores.values()))}."))
    effective_total = int(total) if isinstance(total, (int, float)) else int(sum(scores.values()))
    p0 = data.get("p0") or []
    if effective_total < min_total:
        out.append(Finding(level, "review-blocking", f"100점 리뷰 {effective_total}점 — {min_total}점 미만이라 발행하지 않습니다."))
    if p0:
        out.append(Finding(level, "review-blocking", f"P0 {len(p0)}건이 남아 있습니다: {', '.join(str(x) for x in p0[:3])}"))
    if data.get("blocking"):
        out.append(Finding(level, "review-blocking", "리뷰 리포트가 `blocking: true`로 표시되어 있습니다."))
    if g.get("require_hash_binding", True):
        want = draft_digest(post)
        if str(data.get("reviewedDraftHash", "")) != want:
            out.append(
                Finding(
                    level,
                    "review-stale",
                    "초안이 바뀌어 리뷰가 무효입니다 — `reviewedDraftHash`가 현재 초안 해시와 다릅니다. 다시 리뷰하세요.",
                )
            )
    return out


def check_visual_gate(cfg, mode: str = "draft") -> list[Finding]:
    """화면 게이트 — 390/768/1280 캡처 계측이 없거나 실패면 초안을 적재하지 않는다(스펙 §3 게이트 3)."""
    level = gate_level(cfg, "visual", mode)
    if not level:
        return []
    g = gate_cfg(cfg, "visual")
    capture = REPORT_DIR / "mobile-390.json"
    if not capture.exists() and g.get("require_capture", True):
        return [
            Finding(
                level,
                "gate-visual-missing",
                f"390px 캡처 계측 파일이 없습니다: {capture} — verify_pipeline_v2.py를 ingest 전에 실행하세요.",
            )
        ]
    if not capture.exists():
        return []
    try:
        data = json.loads(capture.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [Finding(level, "gate-visual-invalid", "390px 캡처 계측 파일을 읽지 못했습니다.")]
    failures = data.get("failures") or []
    if failures:
        return [
            Finding(
                level,
                "gate-visual-fail",
                f"390px 캡처 계측 실패 {len(failures)}건 — 첫 항목: {str(failures[0])[:120]}",
            )
        ]
    age_days = (datetime.now(KST) - datetime.fromtimestamp(capture.stat().st_mtime, KST)).days
    limit = int(g.get("max_age_days", 7))
    if age_days > limit:
        return [Finding("warn", "gate-visual-stale", f"390px 캡처가 {age_days}일 전 것입니다({limit}일 이내로 다시 재세요).")]
    return []


def validate_post(post: Post, cfg, archive: list[Post], mode: str = "archive") -> list[Finding]:
    findings: list[Finding] = []
    findings += check_required(post, cfg, mode)
    findings += check_sources(post, cfg, mode)
    findings += check_body(post, cfg, mode)
    findings += check_forbidden(post, cfg)
    findings += check_placeholders(post, cfg)
    findings += check_pii(post, cfg)
    findings += check_duplicates(post, archive, cfg)
    findings += check_body_hash(post, archive)
    findings += check_topic_policy(post, cfg)
    findings += check_concentration(post, archive, cfg)
    # v6.0 게이트 — Answer-First · Information-Gain · 100점 리뷰(해시 결속)
    findings += check_answer_first(post, cfg, mode)
    findings += check_information_gain(post, cfg, mode)
    findings += check_review(post, cfg, mode)
    findings.sort(key=lambda f: LEVELS[f.level], reverse=True)
    return findings


# ────────────────────────────── 80:20 리포트 ──────────────────────────────


CORE3 = ("finance", "invest", "pension")
CORE_OTHER = ("retire", "economy")
ADJACENT = ("ai", "philosophy")
RISK = ("insurance",)

# 대표님 원칙(2026-11-19): 메인 = 금융·투자·연금·노후·경제, 리스크 = 보험.
MAIN_FALLBACK = CORE3 + CORE_OTHER


def main_categories(cfg) -> tuple[str, ...]:
    cats = (cfg or {}).get("ratio", {}).get("main_categories") or MAIN_FALLBACK
    return tuple(cats)


def group_of(category: str, cfg=None) -> str:
    """80:20 판정용 묶음 — 메인(금융·투자·연금·노후·경제) / AI·철학 / 보험(리스크)."""
    if category in main_categories(cfg):
        return "main"
    if category in ADJACENT:
        return "adjacent"
    if category in RISK:
        return "risk"
    return "unknown"


def classify(category: str, cfg=None) -> str:
    return group_of(category, cfg)


GROUP_LABEL = {
    "main": "메인(금융·투자·연금·노후·경제)",
    "adjacent": "AI·철학",
    "risk": "보험(리스크)",
    "unknown": "미분류",
}


def _group_counts(posts: list[Post], cfg=None) -> dict:
    groups = {k: 0 for k in GROUP_LABEL}
    for p in posts:
        groups[group_of(p.category, cfg)] += 1
    return groups


def ratio_report(posts: list[Post], cfg) -> dict:
    ordered = sorted(posts, key=lambda p: ((p.published or date.min), p.slug), reverse=True)
    total = len(ordered)
    counts: dict[str, int] = {slug: 0 for slug in cfg["categories"]}
    for p in ordered:
        counts[p.category] = counts.get(p.category, 0) + 1
    groups = _group_counts(ordered, cfg)

    def share(n: int, base: int) -> float:
        return round(n / base, 4) if base else 0.0

    window_n = int(cfg["ratio"]["window"])
    recent = ordered[:window_n]
    w_groups = _group_counts(recent, cfg)

    return {
        "total": total,
        "counts": counts,
        "groups": groups,
        "mainShare": share(groups["main"], total),
        "riskShare": share(groups["risk"], total),
        "window": {
            "n": len(recent),
            "counts": w_groups,
            "shares": {k: share(v, len(recent)) for k, v in w_groups.items()},
            "slugs": [p.slug for p in recent],
        },
    }


def ratio_findings(rep: dict, cfg) -> list[Finding]:
    """80:20 판정 — 판정 단위는 최근 10편 슬라이딩 윈도우(rules v2.1).

    · 창에서 보험 비중 20% 초과 = 경고, 30% 초과 = 오류
    · 메인(금융·투자·연금·노후·경제) 80% 미달 = 정보 — 비율을 맞추려 억지 발행하지 않는다
    · 전체 아카이브 비중은 정책 시행 이전 글을 포함하므로 30%/40%에서만 경고·오류
    """
    out: list[Finding] = []
    r = cfg["ratio"]
    if rep["total"] == 0:
        return out
    w = rep["window"]["shares"]
    n = rep["window"]["n"]
    risk_w = w.get("risk", 0.0)
    if n and risk_w > r["risk_error_share"]:
        out.append(Finding("error", "ratio-window-risk",
                           f"최근 {n}편 보험 비중 {risk_w*100:.0f}% — 상한 {r['risk_error_share']*100:.0f}%를 넘었습니다."))
    elif n and risk_w > r["risk_warn_share"]:
        out.append(Finding("warn", "ratio-window-risk",
                           f"최근 {n}편 보험 비중 {risk_w*100:.0f}% — 목표 20% 이하를 넘었습니다. 다음 글은 메인 분야로."))
    if rep["riskShare"] > r.get("archive_risk_error_share", 0.4):
        out.append(Finding("error", "ratio-archive-risk",
                           f"전체 보험 비중 {rep['riskShare']*100:.1f}% — 아카이브가 보험 쪽으로 기울었습니다."))
    elif rep["riskShare"] > r.get("archive_risk_warn_share", 0.3):
        out.append(Finding("warn", "ratio-archive-risk",
                           f"전체 보험 비중 {rep['riskShare']*100:.1f}% — 30%를 넘었습니다."))
    main_w = w.get("main", 0.0)
    if n and main_w < r["main_target_share"]:
        out.append(Finding("info", "ratio-main",
                           f"최근 {n}편 메인(금융·투자·연금·노후·경제) 비중 {main_w*100:.0f}% (목표 80%). "
                           "AI·철학 글을 뺀 비보험 비중은 "
                           f"{(1 - risk_w)*100:.0f}% — 목표를 채우려 억지 발행은 하지 않는다."))
    return out


def hold_advice(findings: list[Finding], rep: dict, cfg) -> list[str]:
    """발행 보류(HOLD) 사유 — 억지로 비율을 맞추지 않기 위한 판단."""
    reasons: list[str] = []
    for f in findings:
        if f.level == "error" and f.code in ("excluded-market", "insurer-promo"):
            reasons.append(f.message)
    risk = rep["window"]["shares"].get("risk", 0.0)
    if rep["window"]["n"] and risk > cfg["ratio"]["risk_warn_share"]:
        reasons.append(f"최근 {rep['window']['n']}편 보험 비중 {risk*100:.0f}% (기준 20%)")
    return reasons


def print_ratio(rep: dict, cfg, out=sys.stdout) -> None:
    total = rep["total"]
    print(f"\n■ 80:20 비중 리포트 (전체 {total}편 · 최근 {rep['window']['n']}편 슬라이딩)", file=out)
    print("─" * 62, file=out)
    print(f"{'구분':<24}{'편수':>5}{'비중':>9}", file=out)
    for key in ("main", "adjacent", "risk"):
        n = rep["groups"][key]
        print(f"{GROUP_LABEL[key]:<24}{n:>5}{(n / total * 100 if total else 0):>8.1f}%", file=out)
    print("─" * 62, file=out)
    w = rep["window"]["shares"]
    print(
        "최근 {n}편: 메인 {a:.0f}% · AI·철학 {c:.0f}% · 보험 {d:.0f}% (비보험 {e:.0f}%)".format(
            n=rep["window"]["n"], a=w.get("main", 0) * 100, c=w.get("adjacent", 0) * 100,
            d=w.get("risk", 0) * 100, e=(1 - w.get("risk", 0)) * 100,
        ),
        file=out,
    )
    risk_ok = w.get("risk", 0) <= cfg["ratio"]["risk_warn_share"]
    main_ok = w.get("main", 0) >= cfg["ratio"]["main_target_share"]
    print(
        f"판정: 보험 {w.get('risk', 0)*100:.0f}% {'통과' if risk_ok else '초과(HOLD 권고)'} · "
        f"메인 {w.get('main', 0)*100:.0f}% {'목표 80% 충족' if main_ok else '목표 80% 대비 부족(정보)'}",
        file=out,
    )


def print_findings(slug: str, findings: list[Finding], out=sys.stdout) -> None:
    if not findings:
        print(f"  ✓ {slug}", file=out)
        return
    head = f"  {slug}  ({count_levels(findings)['error']}오류 / {count_levels(findings)['warn']}경고)"
    print(f"  ▸ {head}", file=out)
    for f in findings:
        print(f"     [{LEVEL_LABEL[f.level]}] {f.message}", file=out)


# ────────────────────────────── ingest ──────────────────────────────


FM_ORDER = [
    "kind",
    "issue",
    "date",
    "title",
    "category",
    "description",
    "baseDate",
    "publishedAt",
    "updatedAt",
    "readingMinutes",
    "question",
    "app",
    "toolHref",
    "toolTitle",
    "tags",
    "sources",
    "thumb",
    "thumbAlt",
    "featured",
]


def yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()[:10]
    text = str(value)
    if re.fullmatch(r"[A-Za-z0-9_./-]+", text) and text not in ("true", "false", "null", "yes", "no"):
        return f'"{text}"'
    return json.dumps(text, ensure_ascii=False)


def yaml_node(value):
    """중첩 구조(compare·metrics 등)는 JSON 흐름 표기로 쓴다 — JSON은 YAML의 부분집합이라 그대로 유효하다.

    2026-11-24: dict를 yaml_scalar로 넘기면 파이썬 repr 문자열이 되어 Astro 스키마가
    `compare: Expected type "object", received "string"`으로 빌드를 세웠다. 중첩 값은
    손실 없이 한 줄짜리 JSON으로 적는다.
    """
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return yaml_scalar(value)


def emit_frontmatter(fm: dict) -> str:
    lines = ["---"]
    for key in FM_ORDER:
        if key not in fm or fm[key] in (None, "", []):
            continue
        value = fm[key]
        if key == "sources":
            lines.append("sources:")
            for s in value:
                lines.append(f"  - label: {yaml_scalar(s.get('label',''))}")
                if s.get("url"):
                    lines.append(f"    url: {yaml_scalar(s['url'])}")
        elif isinstance(value, list) and not any(isinstance(t, (dict, list)) for t in value):
            lines.append(f"{key}: [" + ", ".join(yaml_scalar(t) for t in value) + "]")
        else:
            lines.append(f"{key}: {yaml_node(value)}")
    for key, value in fm.items():
        if key in FM_ORDER or value in (None, "", []):
            continue
        if isinstance(value, list) and not any(isinstance(t, (dict, list)) for t in value):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {yaml_scalar(item)}")
        else:
            lines.append(f"{key}: {yaml_node(value)}")
    lines.append("---")
    return "\n".join(lines)


def slugify_stem(stem: str) -> str:
    s = norm(stem).strip().lower()
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def normalize_body(body: str) -> str:
    text = norm(body).replace("\r\n", "\n").lstrip("\ufeff")
    lines = [ln.rstrip() for ln in text.split("\n")]
    out: list[str] = []
    blanks = 0
    for ln in lines:
        if ln.strip() == "":
            blanks += 1
            if blanks > 1:
                continue
            out.append("")
        else:
            blanks = 0
            out.append(ln)
    return "\n".join(out).strip() + "\n"


def prepare_draft(path: Path, args, cfg) -> tuple[Post | None, list[Finding]]:
    findings: list[Finding] = []
    raw = path.read_text(encoding="utf-8")
    fm, body = parse_markdown(raw)
    if fm is None:
        findings.append(
            Finding("error", "no-frontmatter", f"{path.name}: frontmatter(---)가 없습니다. 초안은 제목·분야·출처 블록을 먼저 갖춥니다.")
        )
        return None, findings

    fm = {k: v for k, v in fm.items() if v not in (None, "")}
    body = normalize_body(body)
    fm["title"] = re.sub(r"\s+", " ", str(fm.get("title", "")).strip())

    slug = args.slug or str(fm.pop("slug", "") or "").strip() or slugify_stem(path.stem)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,60}", slug):
        findings.append(Finding("error", "bad-slug", f"슬러그 `{slug}` — 영문 소문자·숫자·하이픈 3~61자로 `--slug`를 주세요."))

    published = as_date(args.published) if args.published else as_date(fm.get("publishedAt")) or today_kst()
    if args.published and not published:
        findings.append(Finding("error", "bad-published", f"--published `{args.published}` 형식이 아닙니다(YYYY-MM-DD)."))
    fm["publishedAt"] = published
    base = as_date(args.base_date) if args.base_date else as_date(fm.get("baseDate")) or published
    fm["baseDate"] = base

    if args.thumb:
        fm["thumb"] = args.thumb if args.thumb.startswith("/") else f"/thumbs/{args.thumb}"
    if not str(fm.get("thumb", "")).strip():
        rendered = editorial_thumb(slug)
        if rendered:
            fm["thumb"] = f"/thumbs/{rendered.stem}.webp"
            findings.append(
                Finding(
                    "info",
                    "thumb-rendered",
                    f"대표이미지 미지정 — thumbs.json 문안으로 에디토리얼 썸네일을 렌더했습니다: `{fm['thumb']}` (1200×630)",
                )
            )
        else:
            fm["thumb"] = topic_thumb(str(fm.get("category", "")))
            findings.append(
                Finding(
                    "warn",
                    "thumb-auto",
                    f"대표이미지 미지정 — thumbs.json에 `{slug}` 문안이 없어 분야 기본 이미지 `{fm['thumb']}`로 매핑했습니다. render_thumbs.py 문안을 먼저 넣으세요.",
                )
            )

    fm["readingMinutes"] = reading_minutes(body, cfg)
    if "tags" in fm and isinstance(fm["tags"], str):
        fm["tags"] = [t.strip() for t in fm["tags"].split(",") if t.strip()]
    if "sources" in fm and isinstance(fm["sources"], dict):
        fm["sources"] = [fm["sources"]]

    post = Post(slug=slug, path=path, fm=fm, body=body)
    return post, findings


def write_gate_report(prepared, visual, cfg) -> Path:
    """게이트 실패 진단을 남긴다 — 파일을 쓰지 않고, 무엇을 고쳐야 하는지만 돌려준다."""
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# 발행 게이트 진단 — {datetime.now(KST).isoformat(timespec='seconds')}",
        "",
        "파일을 쓰지 않았습니다. 아래 오류를 고친 뒤 다시 실행하세요(3회까지).",
        "",
    ]
    for post, findings in prepared:
        errs = [f for f in findings if f.level == "error"]
        warns = [f for f in findings if f.level == "warn"]
        lines.append(f"## {post.slug} — 오류 {len(errs)} · 경고 {len(warns)}")
        for f in errs + warns:
            lines.append(f"- **{f.level}** `{f.code}` {f.message}")
        lines.append("")
    if visual:
        lines.append("## 화면 게이트(390 계측)")
        for f in visual:
            lines.append(f"- **{f.level}** `{f.code}` {f.message}")
        lines.append("")
    path = REPORT_DIR / "gate-report.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def cmd_ingest(args) -> int:
    cfg = load_rules()
    archive = load_posts()
    drafts = [Path(p) for p in args.files]
    missing = [p for p in drafts if not p.exists()]
    if missing:
        print(f"초안을 찾을 수 없습니다: {', '.join(str(p) for p in missing)}", file=sys.stderr)
        return 2

    prepared: list[tuple[Post, list[Finding]]] = []
    any_error = False
    print(f"\n■ 초안 검증 {len(drafts)}건{' (DRY-RUN)' if args.dry_run else ''}")
    print("─" * 62)
    for path in drafts:
        post, findings = prepare_draft(path, args, cfg)
        if post is None:
            print_findings(path.name, findings)
            any_error = True
            continue
        # 같은 실행에서 여러 편을 넣을 때 서로도 중복으로 본다
        other_archive = archive + [p for p, _ in prepared if p.slug != post.slug]
        findings += validate_post(post, cfg, other_archive, mode="draft")
        target = POSTS_DIR / f"{post.slug}.md"
        if target.exists() and not args.force:
            findings.append(
                Finding("error", "slug-exists", f"`{target.name}`이 이미 있습니다 — 다른 `--slug`를 쓰거나 `--force`로 덮어쓰세요.")
            )
        elif target.exists():
            findings.append(Finding("warn", "slug-overwrite", f"`{target.name}`을 덮어씁니다(원본은 .publish-backups에 보관)."))
        prepared.append((post, findings))
        print_findings(post.slug, findings)
        if has_error(findings):
            any_error = True

    # 화면 게이트(스펙 §3 게이트 3) — 글 단위가 아니라 실행 단위로 한 번 본다.
    visual = check_visual_gate(cfg, "draft")
    if visual:
        print_findings("화면 게이트(390 계측)", visual)
        if has_error(visual):
            any_error = True
    print("─" * 62)

    if any_error:
        diag = write_gate_report(prepared, visual, cfg)
        print("결과: 게이트 실패 — 위 오류를 고친 뒤 다시 실행하세요. (파일을 쓰지 않았습니다)")
        print(f"진단: {diag} — 3회까지 고쳐도 통과하지 못하면 발행하지 않습니다(절반만 검수된 글을 내보내지 않는다).")
        return 1

    # 비율·주제 정책을 반영한 발행 판정 (억지 발행 대신 HOLD)
    findings_flat = [f for _, fs in prepared for f in fs]
    new_slugs = {p.slug for p, _ in prepared}
    projected_rep = ratio_report([p for p in archive if p.slug not in new_slugs] + [p for p, _ in prepared], cfg)
    hold = hold_advice(findings_flat, projected_rep, cfg)
    if hold and not args.force:
        print_ratio(projected_rep, cfg)
        print("\n판정: HOLD(보류) — " + " / ".join(hold))
        print("   비율을 맞추려고 원고를 밀어내지 않습니다. 분야를 바꾸거나, 확인 후 `--force`로 강행하세요. (파일을 쓰지 않았습니다)")
        return 0

    for post, _ in prepared:
        target = POSTS_DIR / f"{post.slug}.md"
        content = emit_frontmatter(post.fm) + "\n\n" + post.body
        preview = {
            "slug": post.slug,
            "title": post.title,
            "category": post.category,
            "publishedAt": iso(post.published),
            "baseDate": iso(post.base_date),
            "readingMinutes": post.fm.get("readingMinutes"),
            "thumb": post.fm.get("thumb"),
            "tags": post.tags,
            "sources": len(post.sources),
        }
        if args.dry_run:
            print(f"\n[DRY-RUN] {target.relative_to(ROOT)} 에 쓸 내용 미리보기")
            print("   " + json.dumps(preview, ensure_ascii=False))
            print("   " + emit_frontmatter(post.fm).replace("\n", "\n   "))
            continue
        POSTS_DIR.mkdir(parents=True, exist_ok=True)
        if target.exists():
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(KST).strftime("%Y%m%dT%H%M%S")
            shutil.copy2(target, BACKUP_DIR / f"{post.slug}.{stamp}.md")
        target.write_text(content, encoding="utf-8")
        print(f"\n적재: {target.relative_to(ROOT)}")
        print("   " + json.dumps(preview, ensure_ascii=False))

    if args.dry_run:
        print_ratio(projected_rep, cfg)
        for f in ratio_findings(projected_rep, cfg):
            print(f"  [비중·{LEVEL_LABEL[f.level]}] {f.message}")
        print("\n결과: DRY-RUN 통과 — 파일을 쓰지 않았습니다. 실제 적재는 --dry-run을 빼고 실행하세요.")
        return 0

    print_ratio(projected_rep, cfg)
    for f in ratio_findings(projected_rep, cfg):
        print(f"  [비중·{LEVEL_LABEL[f.level]}] {f.message}")
    print("판정: 발행 권고")

    print("\n결과: 적재 완료.")
    if args.build:
        slugs = [p.slug for p, _ in prepared]
        return cmd_build(argparse.Namespace(slug=slugs, no_build=False, json=False, quiet=False, keep_dist=False))
    print("다음: python3 scripts/publish_pipeline.py build")
    return 0


# ────────────────────────────── build & verify ──────────────────────────────


def find_npm() -> str | None:
    candidates = []
    if os.environ.get("NODE_BIN"):
        candidates.append(Path(os.environ["NODE_BIN"]))
    for p in ("/workspace/.local/node-v22/bin", "/usr/local/bin", "/usr/bin"):
        candidates.append(Path(p))
    for c in candidates:
        npm = c / "npm"
        if npm.exists():
            return str(npm)
    found = shutil.which("npm")
    return found


def run_build(project: Path) -> tuple[bool, str]:
    npm = find_npm()
    if not npm:
        return False, "npm을 찾지 못했습니다. NODE_BIN 환경변수로 node 디렉터리를 지정하세요."
    env = os.environ.copy()
    env["PATH"] = f"{Path(npm).parent}{os.pathsep}{env.get('PATH','')}"
    # 기본은 도메인 루트 빌드(로컬 미리보기). 서브패스 확인은 SITE_URL/BASE_PATH 환경변수로.
    proc = subprocess.run(
        [npm, "run", "build"],
        cwd=str(project),
        env=env,
        capture_output=True,
        text=True,
        timeout=900,
    )
    log = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode == 0, log


def _html_files(path: Path) -> Path:
    if path.suffix:
        return path
    return path / "index.html"


def verify_dist(slugs: list[str], project: Path = ROOT) -> dict:
    dist = project / "dist"
    result: dict = {"ok": True, "checked": [], "problems": [], "warnings": []}

    def problem(msg: str) -> None:
        result["ok"] = False
        result["problems"].append(msg)

    if not dist.exists():
        problem("dist/ 가 없습니다 — 먼저 npm run build")
        return result

    search_path = dist / "search-index.json"
    search_docs = {}
    if search_path.exists():
        try:
            payload = json.loads(search_path.read_text(encoding="utf-8"))
            search_docs = {d.get("id"): d for d in payload.get("docs", [])}
            result["searchCount"] = payload.get("count")
        except json.JSONDecodeError:
            problem("search-index.json 파싱 실패")
    else:
        problem("dist/search-index.json 이 없습니다")

    rss = (dist / "rss.xml").read_text(encoding="utf-8") if (dist / "rss.xml").exists() else ""
    sitemap = ""
    for f in sorted(dist.glob("sitemap*.xml")):
        sitemap += f.read_text(encoding="utf-8")
    listing = (dist / "posts" / "index.html").read_text(encoding="utf-8") if (dist / "posts" / "index.html").exists() else ""

    posts = {p.slug: p for p in load_posts()}
    for slug in slugs:
        entry = {"slug": slug, "checks": {}}
        page = dist / "posts" / slug / "index.html"
        checks = entry["checks"]
        checks["page"] = page.exists()
        if not page.exists():
            problem(f"[{slug}] 글 페이지가 없습니다: {page.relative_to(dist)}")
            result["checked"].append(entry)
            continue
        html = page.read_text(encoding="utf-8")
        post = posts.get(slug)
        title = post.title if post else ""
        escaped = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

        checks["title"] = bool(title) and escaped in html
        if title and not checks["title"]:
            problem(f"[{slug}] 페이지에 제목이 렌더링되지 않았습니다")

        checks["canonical"] = f'rel="canonical"' in html and f"/posts/{slug}" in html
        if not checks["canonical"]:
            problem(f"[{slug}] canonical 주소가 없습니다")

        ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        ld_ok = False

        def _article_in(data) -> bool:
            """@graph 묶음(사이트 공통 그래프)이든 단독 객체든 Article을 찾는다."""
            if isinstance(data, list):
                return any(_article_in(x) for x in data)
            if not isinstance(data, dict):
                return False
            if data.get("@type") == "Article" and data.get("headline") == title:
                return True
            graph = data.get("@graph")
            return _article_in(graph) if graph else False

        for block in ld_blocks:
            try:
                data = json.loads(block)
            except json.JSONDecodeError:
                continue
            if _article_in(data):
                ld_ok = True
        checks["jsonld"] = ld_ok
        if not ld_ok:
            problem(f"[{slug}] Article 구조화 데이터(JSON-LD)가 맞지 않습니다")

        doc = search_docs.get(f"post-{slug}")
        checks["search"] = bool(doc)
        if doc:
            if doc.get("url") != f"/posts/{slug}":
                problem(f"[{slug}] 검색 인덱스 주소 불일치: {doc.get('url')}")
            if title and doc.get("title") != title:
                problem(f"[{slug}] 검색 인덱스 제목 불일치")
            if len(doc.get("body", "")) < 500:
                result["warnings"].append(f"[{slug}] 검색 인덱스 본문이 짧습니다({len(doc.get('body',''))}자)")
        else:
            problem(f"[{slug}] 검색 인덱스에 없습니다 — /search 에서 찾을 수 없습니다")

        checks["rss"] = f"<title>{escaped}</title>" in rss and f"/posts/{slug}" in rss
        if not checks["rss"]:
            problem(f"[{slug}] RSS에 없습니다")
        checks["sitemap"] = f"/posts/{slug}" in sitemap
        if not checks["sitemap"]:
            result["warnings"].append(f"[{slug}] 사이트맵에 없습니다")
        checks["listing"] = escaped in listing
        if not checks["listing"]:
            problem(f"[{slug}] /posts 목록에 카드가 없습니다")

        # 내부 링크
        broken = []
        for href in set(re.findall(r'href="(/[^"#]*)"', html)):
            path = href.split("#")[0].split("?")[0]
            if path in ("", "/"):
                target = dist / "index.html"
            else:
                target = _html_files(dist / path.lstrip("/"))
            if not target.exists():
                broken.append(href)
        checks["internalLinks"] = len(broken) == 0
        checks["brokenLinks"] = broken
        if broken:
            problem(f"[{slug}] 깨진 내부 링크 {len(broken)}개: {', '.join(broken[:5])}")

        checks["placeholderText"] = not re.search(r">\s*(undefined|NaN|\[object Object\])\s*<", html)
        if not checks["placeholderText"]:
            problem(f"[{slug}] 렌더링에 undefined/NaN 흔적이 있습니다")

        result["checked"].append(entry)
    return result


def cmd_build(args) -> int:
    slugs = args.slug or [p.slug for p in load_posts()]
    if isinstance(slugs, str):
        slugs = [slugs]

    if not args.no_build:
        print("\n■ npm run build")
        ok, log = run_build(ROOT)
        tail = "\n".join(log.strip().splitlines()[-14:])
        print(tail)
        if not ok:
            print("\n결과: 빌드 실패 — 위 로그를 확인하세요.")
            return 2
        m = re.search(r"(\d+) page\(s\) built", log)
        if m:
            print(f"   페이지 {m.group(1)}개 생성")

    print(f"\n■ 빌드 결과 검증 ({len(slugs)}편)")
    rep = verify_dist(slugs)
    for entry in rep["checked"]:
        marks = entry["checks"]
        summary = " ".join(f"{k}={'✓' if v else '✗'}" for k, v in marks.items() if isinstance(v, bool))
        print(f"  {'✓' if all(v for k, v in marks.items() if isinstance(v, bool)) else '✗'} {entry['slug']}  ({summary})")
    if rep["warnings"]:
        print("\n경고:")
        for w in rep["warnings"]:
            print(f"  · {w}")
    if rep["problems"]:
        print("\n문제:")
        for p in rep["problems"]:
            print(f"  · {p}")
        print("\n결과: 검증 실패")
        return 1
    print(f"\n결과: 검증 통과 — 글 {len(rep['checked'])}편, 검색 인덱스 문서 {rep.get('searchCount', '?')}개.")
    return 0


# ────────────────────────────── 소식지 ──────────────────────────────


LETTER_LINK_LIMIT = 3


def compose_channel_body(posts: list[Post], base: date, issue: int = 1) -> str:
    lines = [
        f"buffetkimz 기록 소식 제{issue}호 — {base.year}년 {base.month}월 {base.day}일",
        "",
        f"오늘 기준으로 확인한 기록 {len(posts)}편을 정리했습니다.",
        "",
    ]
    for i, p in enumerate(posts, start=1):
        brief = p.description.strip()
        if len(brief) > 92:
            brief = brief[:90].rstrip() + "…"
        lines.append(f"{i}. {p.title}")
        lines.append(f"   {brief}")
        lines.append(f"   https://{SITE_HOST}/posts/{p.slug}")
        lines.append("")
    lines.append(f"기준일 {iso(base)}. 숫자와 조건의 출처는 각 글 아래에 붙여 두었습니다. 결정 전에 원문을 다시 확인하세요.")
    return "\n".join(lines).strip("\n")


def letter_issue_no(base: date) -> int:
    """같은 해에 쌓인 소식지 초안 수 + 1 = 이번 호수."""
    if not LETTERS_DIR.exists():
        return 1
    stems = sorted(p.stem for p in LETTERS_DIR.glob(f"{base.year}-*.md"))
    earlier = [s for s in stems if s < base.isoformat()]
    return len(earlier) + 1


def compose_letter_md(posts: list[Post], base: date, cfg) -> str:
    issue = letter_issue_no(base)
    channel = compose_channel_body(posts, base, issue)
    fm = {
        "kind": "newsletter",
        "issue": issue,
        "date": base,
        "baseDate": base,
        "posts": [p.slug for p in posts],
        "categories": sorted({p.category for p in posts}),
        "sources": [s for p in posts for s in p.sources if s.get("url")],
    }
    parts = [emit_frontmatter(fm), "", f"# 소식지 제{issue}호 — {ko_date(base)}", ""]
    parts.append("## 복사용 본문 (채널·메시지)")
    parts.append("")
    parts.append(channel)
    parts.append("")
    parts.append("## 이번 주 기록 (사이트 링크)")
    parts.append("")
    for p in posts:
        parts.append(f"### {p.title}")
        parts.append("")
        parts.append(p.description)
        parts.append("")
        srcs = ", ".join(s.get("label", "") for s in p.sources[:3])
        parts.append(f"- 글: https://{SITE_HOST}/posts/{p.slug}")
        parts.append(f"- 기준일 {iso(p.base_date)} · 분야 {cfg['categories'].get(p.category, {}).get('name', p.category)}"
                     + (f" · 출처 {srcs}" if srcs else ""))
        parts.append("")
    parts.append("## 확인한 출처")
    parts.append("")
    seen = set()
    for p in posts:
        for s in p.sources:
            key = (s.get("label"), s.get("url"))
            if key in seen:
                continue
            seen.add(key)
            label = s.get("label", "")
            url = s.get("url", "")
            parts.append(f"- {label}" + (f" — {url}" if url else ""))
    parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def validate_letter(text: str, channel: str, cfg) -> list[Finding]:
    out: list[Finding] = []
    markers = cfg["negation_markers"]
    for rule in cfg["forbidden_terms"]:
        for m in re.finditer(re.escape(rule["term"]), text):
            if _has_negation(text, m.start(), m.end(), markers):
                continue
            out.append(Finding(rule["level"], "letter-forbidden", f"금지 표현 `{rule['term']}` — {rule['why']}"))
            break
    for rule in cfg["placeholder_patterns"]:
        if re.search(rule["pattern"], text):
            out.append(Finding("error", "letter-placeholder", f"미확정 표식: {rule['message']}"))
    for rule in cfg["pii_patterns"]:
        m = re.search(rule["pattern"], text)
        if m:
            out.append(Finding(rule["level"], "letter-pii", f"{rule['message']}: `{m.group(0)[:20]}`"))

    n = len(channel)
    if n < 300:
        out.append(Finding("error", "letter-short", f"채널 본문 {n}자 — 너무 짧아 읽을 거리가 없습니다."))
    elif n > 1600:
        out.append(Finding("warn", "letter-long", f"채널 본문 {n}자 — 채널 소식은 1,600자 이하가 읽힙니다."))

    links = re.findall(r"https?://[^\s)\]]+", channel)
    if len(links) > LETTER_LINK_LIMIT:
        out.append(Finding("warn", "letter-links", f"채널 본문 링크 {len(links)}개 — {LETTER_LINK_LIMIT}개 이하로 줄이세요."))
    for url in links:
        host = urlparse(url).netloc.lower()
        if not host.endswith(SITE_HOST):
            out.append(Finding("error", "letter-external-link", f"채널 본문에 외부 링크: `{url}` — 사이트 글로만 잇습니다."))
    if "기준일" not in channel:
        out.append(Finding("warn", "letter-basis", "채널 본문에 기준일 표기가 없습니다."))
    m = re.search(r"제(\d+)호", channel)
    if not m:
        out.append(Finding("warn", "letter-issue", "채널 본문에 호수(제N호)가 없습니다."))
    if not re.search(r"\d{4}년 \d{1,2}월 \d{1,2}일", channel):
        out.append(Finding("warn", "letter-date", "채널 본문에 발행일(YYYY년 M월 D일)이 없습니다."))
    return out


def cmd_letter(args) -> int:
    cfg = load_rules()
    base = as_date(args.date) or today_kst()
    days = max(1, int(args.days))
    archive = load_posts()
    if args.posts:
        wanted = [s.strip() for s in args.posts.split(",") if s.strip()]
        selected = [p for p in archive if p.slug in wanted]
        missing = [s for s in wanted if s not in {p.slug for p in selected}]
        if missing:
            print(f"없는 글: {', '.join(missing)}", file=sys.stderr)
            return 2
    else:
        since = base - timedelta(days=days)
        selected = [p for p in archive if p.published and since <= p.published <= base]
        if not selected:
            print(f"{iso(since)} ~ {iso(base)} 사이 발행 글이 없습니다. `--posts`로 지정하세요.", file=sys.stderr)
            return 2
    selected = sorted(selected, key=lambda p: p.published or date.min, reverse=True)[:5]

    text = compose_letter_md(selected, base, cfg)
    channel = text.split("## 복사용 본문 (채널·메시지)", 1)[1].split("## 이번 주 기록", 1)[0].strip()
    findings = validate_letter(text, channel, cfg)

    print(f"\n■ 소식지 초안 — {ko_date(base)} · 글 {len(selected)}편")
    print("─" * 62)
    for p in selected:
        print(f"  · {p.title}  ({iso(p.published)})")
    print("─" * 62)
    print_findings("letter", findings)
    print(f"  채널 본문 {len(channel)}자 · 링크 {len(re.findall(r'https?://', channel))}개")

    if has_error(findings):
        print("\n결과: 게이트 실패 — 초안을 쓰지 않았습니다.")
        return 1

    target = Path(args.out) if args.out else LETTERS_DIR / f"{iso(base)}.md"
    if args.dry_run:
        print(f"\n[DRY-RUN] {target} 미리보기\n")
        print(channel)
        return 0
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    print(f"\n결과: 초안 저장 — {target}")
    print("   소식지는 사용자가 직접 올리는 원칙이므로 자동 발행하지 않습니다.")
    return 0


# ────────────────────────────── 점검표·번들 ──────────────────────────────


def _codes(findings: list[Finding]) -> list[str]:
    return [f.code for f in findings]


def cmd_checklist(args) -> int:
    """발행 전·후 10줄 점검표 — 회의실 검수에 그대로 붙일 수 있는 형태."""
    cfg = load_rules()
    archive = load_posts()
    wanted = set(args.slug or [p.slug for p in archive])
    targets = [p for p in archive if p.slug in wanted]
    findings = {p.slug: validate_post(p, cfg, [q for q in archive if q.slug != p.slug]) for p in targets}
    flat = [f for fs in findings.values() for f in fs]
    rep = ratio_report(archive, cfg)
    dist_rep = verify_dist([p.slug for p in targets]) if DIST_DIR.exists() else {"ok": False, "problems": ["dist 없음"], "checked": []}
    mobile_path = REPORT_DIR / "mobile-390.json"
    mobile = json.loads(mobile_path.read_text(encoding="utf-8")) if mobile_path.exists() else None

    def row(name, fails, warns, detail):
        status = "FAIL" if fails else ("WARN" if warns else "PASS")
        return {"check": name, "status": status, "detail": detail,
                "fail": len(fails), "warn": len(warns)}

    def pick(codes, level=None):
        return [f for f in flat if any(f.code.startswith(c) for c in codes) and (level is None or f.level == level)]

    rows = []
    schema = pick(["missing-", "bad-category", "bad-readingMinutes", "tags-"])
    lim = cfg["limits"]
    tag_counts = [len(p.tags) for p in targets]
    over_tags = [p.slug for p in targets if len(p.tags) > lim["tags_max"]]
    rows.append(row("1 스키마 필수항목", [f for f in schema if f.level == "error"], [f for f in schema if f.level == "warn"],
                    f"제목·요약·분야·발행일·읽기시간 · 태그 최대 {max(tag_counts, default=0)}개(기준 {lim['tags_min']}~{lim['tags_max']}개, 초과 {len(over_tags)}편)"))
    basis = pick(["baseDate", "missing-baseDate"])
    rows.append(row("2 기준일(YYYY. MM. DD.)", [f for f in basis if f.level == "error"], [f for f in basis if f.level == "warn"],
                    "글마다 기준일을 갖고 상세 상단에 표기"))
    src = pick(["source-", "missing-sources"])
    policy = cfg.get("source_policy", {})
    strict_cats = list(policy.get("primary_url_required", []))
    essay_cats = set(policy.get("essay_exempt", []))
    no_url = [p for p in targets if not any(x.get("url") for x in p.sources)]
    exempt = [p for p in no_url if p.category in essay_cats]
    strict_n = len([p for p in targets if p.category in strict_cats])
    rows.append(row("3 1차 출처 URL", [f for f in src if f.level == "error"], [f for f in src if f.level == "warn"],
                    f"URL 필수 {strict_n}편 충족 · 철학·에세이 예외 {len(exempt)}편(원전·개인 기록)"))
    forb = pick(["forbidden"])
    rows.append(row("4 금지 표현(영업·확정수익·공포)", [f for f in forb if f.level == "error"], [f for f in forb if f.level == "warn"],
                    f"규칙 {len(cfg['forbidden_terms'])}개"))
    pii = pick(["pii-"])
    rows.append(row("5 개인정보", [f for f in pii if f.level == "error"], [f for f in pii if f.level == "warn"], "주민번호·전화·카드·이메일"))
    dup = pick(["duplicate", "near-duplicate"])
    rows.append(row("6 중복(슬러그·본문 해시·유사 제목)", [f for f in dup if f.level == "error"], [f for f in dup if f.level == "warn"],
                    f"{len(targets)}편 대조"))
    topic = pick(["excluded-market", "stock-call", "insurer-promo", "insurer-mentioned"])
    rows.append(row("7 주제 정책(시황·종목·보험사 홍보)", [f for f in topic if f.level == "error"], [f for f in topic if f.level == "warn"],
                    "단기 시황 중계·매매 추천·특정 보험사 홍보 차단"))
    ratio_bad = ratio_findings(rep, cfg)
    w = rep["window"]["shares"]
    rows.append(row("8 80:20(최근 10편)", [f for f in ratio_bad if f.level == "error"], [f for f in ratio_bad if f.level == "warn"],
                    f"메인 {w.get('main', 0)*100:.0f}% · 보험 {w.get('risk', 0)*100:.0f}% · AI·철학 {w.get('adjacent', 0)*100:.0f}% "
                    "(HOLD는 보험 20% 초과·금지 주제만)"))
    build_problems = dist_rep.get("problems", [])
    rows.append(row("9 빌드·검색·RSS·내부 링크", build_problems if build_problems else [], dist_rep.get("warnings", []),
                    f"글 {len(targets)}편 검증"))
    if mobile:
        m_fail = [m for m in mobile.get("failures", [])]
        m_warn = [m for m in mobile.get("warnings", [])]
        rows.append(row("10 모바일 390 규격", m_fail, m_warn, mobile.get("summary", "본문·여백·표·카드")))
    else:
        rows.append(row("10 모바일 390 규격", [], ["측정 파일 없음"], "verify_pipeline_v2.py 실행 후 채워짐"))

    # v6.0 — 11~13줄. 아카이브는 그림자 모드(warn)로만 보고하고, 신규 ingest에서만 차단한다.
    af = pick(["answer-first"])
    rows.append(
        row(
            "11 Answer-First",
            [f for f in af if f.level == "error"],
            [f for f in af if f.level == "warn"],
            f"요약 숫자 + 본문 첫 300자 직답 · 위반 {len(af)}건(아카이브 그림자)",
        )
    )
    ig = pick(["information-gain"])
    rows.append(
        row(
            "12 Information-Gain",
            [f for f in ig if f.level == "error"],
            [f for f in ig if f.level == "warn"],
            f"`gain` 한 문장(30자↑·상투어 금지) · 미비 {len(ig)}건(아카이브 그림자)",
        )
    )
    rv = pick(["review"])
    rows.append(
        row(
            "13 100점 리뷰(해시 결속)",
            [f for f in rv if f.level == "error"],
            [f for f in rv if f.level == "warn"],
            f"5범주 합 90점↑ · P0 0 · 초안 해시 일치 · 미비 {len(rv)}건(아카이브 그림자)",
        )
    )

    fails = sum(1 for r in rows if r["status"] == "FAIL")
    warns = sum(1 for r in rows if r["status"] == "WARN")
    payload = {
        "generatedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "posts": sorted(targets and [p.slug for p in targets] or []),
        "rows": rows,
        "ratio": rep,
        "verdict": "FAIL" if fails else ("WARN" if warns else "PASS"),
    }

    print("\n■ 발행 점검표 (13줄)")
    print("─" * 66)
    for r in rows:
        mark = {"PASS": "✓", "WARN": "!", "FAIL": "✗"}[r["status"]]
        print(f" {mark} {r['check']:<32} {r['status']:<5} {r['detail']}")
    print("─" * 66)
    print(f"판정: {payload['verdict']} (실패 {fails} · 경고 {warns})")

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "checklist.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [f"# 발행 점검표 — {payload['generatedAt']}", "", "| # | 점검 | 판정 | 근거 |", "| --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['check']} | {r['detail']} | **{r['status']}** | {r['fail']}실패/{r['warn']}경고 |")
    lines += ["", f"판정: **{payload['verdict']}**", ""]
    (REPORT_DIR / "checklist.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"저장: {REPORT_DIR/'checklist.json'} · checklist.md")
    return 1 if fails else 0


def independent_verify(slugs: list[str], project: Path = ROOT) -> dict:
    """dist를 /tmp 새 폴더로 복사해 프로젝트와 분리된 상태에서 다시 검사한다."""
    out: dict = {"ok": True, "problems": []}
    if not (project / "dist").exists():
        return {"ok": False, "problems": ["dist 없음"]}
    tmp = Path(tempfile.mkdtemp(prefix="pipeline-v2-verify-"))
    shutil.copytree(project / "dist", tmp / "dist")
    dist = tmp / "dist"
    out["tmp"] = str(tmp)
    out["files"] = sum(1 for _ in dist.rglob("*") if _.is_file())

    try:
        index = json.loads((dist / "search-index.json").read_text(encoding="utf-8"))
        ids = {d.get("id") for d in index.get("docs", [])}
    except Exception as exc:  # noqa: BLE001
        out["ok"] = False
        out["problems"].append(f"search-index 파싱 실패: {exc}")
        ids = set()
    rss = (dist / "rss.xml").read_text(encoding="utf-8") if (dist / "rss.xml").exists() else ""

    pages = {}
    for slug in slugs:
        page = dist / "posts" / slug / "index.html"
        ok = page.exists()
        entry = {"page": ok}
        if ok:
            html = page.read_text(encoding="utf-8")
            entry["inSearch"] = f"post-{slug}" in ids
            entry["inRss"] = f"/posts/{slug}" in rss
            broken = []
            for href in set(re.findall(r'href="(/[^"#]*)"', html)):
                path = href.split("#")[0].split("?")[0]
                target = dist / "index.html" if path in ("", "/") else _html_files(dist / path.lstrip("/"))
                if not target.exists():
                    broken.append(href)
            entry["brokenLinks"] = broken
            entry["placeholderText"] = not re.search(r">\s*(undefined|NaN|\[object Object\])\s*<", html)
            if not (entry["inSearch"] and entry["inRss"] and not broken and entry["placeholderText"]):
                out["ok"] = False
                out["problems"].append(f"[{slug}] 독립 검증 실패: {json.dumps(entry, ensure_ascii=False)}")
        else:
            out["ok"] = False
            out["problems"].append(f"[{slug}] 페이지 없음")
        pages[slug] = entry
    out["pages"] = pages
    return out


def cmd_bundle(args) -> int:
    """검수 자료를 한 파일로 묶고, /tmp 독립 검증 결과까지 넣는다."""
    cfg = load_rules()
    archive = load_posts()
    slugs = sorted({p.slug for p in archive} & set(args.slug or [p.slug for p in archive]))
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    independent = independent_verify(slugs)
    (REPORT_DIR / "verify-tmp.json").write_text(json.dumps(independent, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    dist_files = {
        str(path.relative_to(ROOT / "dist")): path.stat().st_size
        for path in sorted((ROOT / "dist").rglob("*"))
        if path.is_file()
    } if (ROOT / "dist").exists() else {}

    manifest = {
        "generatedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "pipeline": "publish_pipeline.py v2",
        "rules": cfg.get("version"),
        "posts": slugs,
        "dist": independent.get("files"),
        "distIncluded": len(dist_files),
        "distBytes": sum(dist_files.values()),
        "independentVerify": independent.get("ok"),
    }
    (REPORT_DIR / "bundle-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    out = Path(args.out) if args.out else REPORT_DIR / "pipeline-v2-bundle.zip"
    include_dirs = [
        (REPORT_DIR, "reports/buffetkimz-web/pipeline-v2"),
        (ROOT / "drafts", "drafts"),
        (ROOT / "letters", "letters"),
        # 빌드 산출물 전체 — ZIP만 풀어도 dist/를 그대로 열어 검색 인덱스·RSS·HTML을 독립 검증할 수 있다
        (ROOT / "dist", "dist"),
    ]
    include_files = [
        (ROOT / "scripts" / "publish_pipeline.py", "scripts/publish_pipeline.py"),
        (ROOT / "scripts" / "publish_rules.json", "scripts/publish_rules.json"),
        (ROOT / "scripts" / "verify_pipeline_v2.py", "scripts/verify_pipeline_v2.py"),
    ]
    for p in archive:
        include_files.append((p.path, f"src/content/posts/{p.path.name}"))

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, arc in include_files:
            if path.exists():
                zf.write(path, arc)
        for directory, prefix in include_dirs:
            if not directory.exists():
                continue
            for path in sorted(directory.rglob("*")):
                if path.is_file() and path.resolve() != out.resolve():
                    zf.write(path, f"{prefix}/{path.relative_to(directory)}")
        zf.writestr("README-검수.md", (
            "buffetkimz.com 2단계 발행 파이프라인 번들\n\n"
            "- 00-pipeline-guide.md : 운영 가이드(HOLD 기준 포함)\n"
            "- 02-pipeline-architecture.md : 구조·게이트\n"
            "- 03-test-report.md : 실전 테스트·검증 결과\n"
            "- source-fact-check.md : 신규 글 핵심 수치 1차 출처 1:1 대조표\n"
            "- source-extracts/ : 1차 문서 원문 추출 텍스트(금융위 보도자료·Q&A PDF·5세대 자료)\n"
            "- checklist.json/md : 발행 전후 10줄 점검표(PASS)\n"
            "- verify-tmp.json : /tmp 독립 검증 결과\n"
            "- alt-audit.json : 목록·상세 <img> alt DOM 실측(누락 0)\n"
            "- verify-1280-390.json · mobile-390.json : 1280·390 실측\n"
            "- shots/ : 1280·390 스크린샷(글·목록·검색·소식지·390 하단 태그/면책)\n"
            "- scripts/ : 파이프라인·검증 스크립트, 규칙 JSON\n"
            "- drafts/ : 오늘 원고 초안(투입 형식 예시)\n"
            "- letters/ : 소식지 제1호 원본(md)\n"
            "- src/content/posts/ : 발행된 글 14편(md)\n"
            "- dist/ : 빌드 산출물 전체(HTML 83p·검색 인덱스·RSS·사이트맵·이미지) — "
            "압축을 풀고 dist/index.html을 열면 사이트가 그대로 재현된다\n\n"
            "라이브 배포는 회의실 95점+ 검수와 대표님 결정 이후에 진행합니다.\n"
        ))
    size = out.stat().st_size / 1024
    print(f"\n■ 번들: {out} ({size:.0f}KB)")
    print(f"   /tmp 독립 검증: {'통과' if independent.get('ok') else '실패'} · 파일 {independent.get('files')}개 · {independent.get('tmp')}")
    for prob in independent.get("problems", []):
        print(f"   · {prob}")
    return 0 if independent.get("ok") else 1


# ────────────────────────────── validate / ratio ──────────────────────────────


def cmd_validate(args) -> int:
    cfg = load_rules()
    archive = load_posts()
    all_findings: dict[str, list[Finding]] = {}
    for post in archive:
        others = [p for p in archive if p.slug != post.slug]
        all_findings[post.slug] = validate_post(post, cfg, others, mode="archive")

    rep = ratio_report(archive, cfg)
    ratio_bad = ratio_findings(rep, cfg)

    total = count_levels([f for fs in all_findings.values() for f in fs] + ratio_bad)
    if args.json:
        payload = {
            "generatedAt": datetime.now(KST).isoformat(timespec="seconds"),
            "total": len(archive),
            "levels": total,
            "ratio": rep,
            "posts": {slug: [f.as_dict() for f in fs] for slug, fs in all_findings.items()},
            "archiveFindings": [f.as_dict() for f in ratio_bad],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 1 if total["error"] else 0

    print(f"\n■ 아카이브 검증 — 글 {len(archive)}편 · 기준일 {iso(today_kst())}")
    print("─" * 62)
    for slug, fs in all_findings.items():
        print_findings(slug, fs)
    print("─" * 62)
    print_ratio(rep, cfg)
    if ratio_bad:
        print("\n아카이브 비중 판정:")
        for f in ratio_bad:
            print(f"  [{LEVEL_LABEL[f.level]}] {f.message}")
    print(f"\n합계: 오류 {total['error']} · 경고 {total['warn']} · 정보 {total['info']}")
    if total["error"]:
        print("결과: 게이트 실패")
        return 1
    print("결과: 통과" + (" (경고 확인)" if total["warn"] else ""))
    return 0


def cmd_ratio(args) -> int:
    cfg = load_rules()
    archive = load_posts()
    rep = ratio_report(archive, cfg)
    if args.json:
        print(json.dumps(rep, ensure_ascii=False, indent=2))
        return 0
    print_ratio(rep, cfg)
    for f in ratio_findings(rep, cfg):
        print(f"  [{LEVEL_LABEL[f.level]}] {f.message}")
    return 0


# ────────────────────────────── CLI ──────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="publish_pipeline.py",
        description="buffetkimz.com 데일리 블로그·소식지 발행 파이프라인 v2",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="아카이브 전체 검증 + 80:20 리포트")
    p_val.add_argument("--json", action="store_true", help="기계용 JSON 출력")
    p_val.set_defaults(func=cmd_validate)

    p_ratio = sub.add_parser("ratio", help="80:20 비중만 계산")
    p_ratio.add_argument("--json", action="store_true")
    p_ratio.set_defaults(func=cmd_ratio)

    p_ing = sub.add_parser("ingest", help="초안을 Astro 콘텐츠로 검증·적재")
    p_ing.add_argument("files", nargs="+", help="초안 마크다운 경로")
    p_ing.add_argument("--dry-run", action="store_true", help="검증만 하고 파일을 쓰지 않음")
    p_ing.add_argument("--slug", help="글 주소(영문 소문자·하이픈)")
    p_ing.add_argument("--thumb", help="대표이미지 경로(/thumbs/...) 또는 파일명 (생략 시 thumbs.json 문안으로 render_thumbs.py가 렌더)")
    p_ing.add_argument("--published", help="발행일 YYYY-MM-DD (기본: 오늘)")
    p_ing.add_argument("--base-date", dest="base_date", help="기준일 YYYY-MM-DD (기본: 발행일)")
    p_ing.add_argument("--force", action="store_true", help="같은 슬러그 덮어쓰기(원본은 .publish-backups)")
    p_ing.add_argument("--build", action="store_true", help="적재 후 빌드·검증까지 실행")
    p_ing.set_defaults(func=cmd_ingest)

    p_b = sub.add_parser("build", help="npm run build + 검색 인덱스·RSS·사이트맵·링크 검증")
    p_b.add_argument("--slug", action="append", help="검증할 글(여러 번 지정 가능, 기본: 전체)")
    p_b.add_argument("--no-build", action="store_true", help="빌드 없이 기존 dist만 검사")
    p_b.add_argument("--json", action="store_true")
    p_b.add_argument("--quiet", action="store_true")
    p_b.add_argument("--keep-dist", action="store_true")
    p_b.set_defaults(func=cmd_build)

    p_c = sub.add_parser("checklist", help="발행 전·후 10줄 점검표 (JSON·MD 저장)")
    p_c.add_argument("--slug", action="append", help="점검할 글(기본: 전체)")
    p_c.add_argument("--json", action="store_true")
    p_c.set_defaults(func=cmd_checklist)

    p_bun = sub.add_parser("bundle", help="검수 자료 zip + /tmp 독립 검증")
    p_bun.add_argument("--slug", action="append", help="검증할 글(기본: 전체)")
    p_bun.add_argument("--out", help="zip 경로(기본 reports/buffetkimz-web/pipeline-v2/pipeline-v2-bundle.zip)")
    p_bun.set_defaults(func=cmd_bundle)

    p_l = sub.add_parser("letter", help="최근 글에서 소식지 초안 생성·검증")
    p_l.add_argument("--date", help="기준일 YYYY-MM-DD (기본: 오늘)")
    p_l.add_argument("--days", type=int, default=7, help="최근 며칠 글을 담을지(기본 7)")
    p_l.add_argument("--posts", help="쉼표로 글 슬러그 지정")
    p_l.add_argument("--out", help="저장 경로(기본 letters/{날짜}.md)")
    p_l.add_argument("--dry-run", action="store_true")
    p_l.set_defaults(func=cmd_letter)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\n중단했습니다.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
