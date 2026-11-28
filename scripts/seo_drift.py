#!/usr/bin/env python3
"""SEO 드리프트 — 배포 전 'SEO가 망가지지 않았는지' 비교 (2026-11-28).

배경
  `AgriciDaniel/claude-seo`(MIT, v2.6.3) `seo-drift`는 title·description·canonical·H1~H3·
  JSON-LD·OG·해시를 기준선(baseline)으로 저장하고, 다음 배포에서 달라진 것을 심각도로 나눈다.
  이 사이트는 SQLite를 쓰지 않고 **JSON 한 파일**로 같은 일을 한다(의존성 0, git에 남길 수 있음).

쓰는 법
  python3 scripts/seo_drift.py baseline                 # 지금 dist를 '정상' 기준선으로 저장
  python3 scripts/seo_drift.py compare                  # 최신 기준선과 지금 dist 비교 (치명이면 exit 1)
  python3 scripts/seo_drift.py compare --fail-on-warning # 경고까지 실패로
  python3 scripts/seo_drift.py baseline --dist dist --label "v9.9.0"

심각도
  CRITICAL — 페이지 사라짐 · title/canonical/H1 소실 · H1 개수 변화 · 색인되던 페이지가 noindex
  WARNING  — title·description·OG·JSON-LD·robots 변경(의도일 수 있음)
  INFO     — 새 페이지
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seo_audit import meta_content, parse, rel_path, visible_text  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "reports/buffetkimz-web/seo-drift"
DEFAULT = STORE / "baseline.json"


def norm_url(u: str) -> str:
    """절대 주소에서 출처(host)·배포 접두를 떼어 경로만 남긴다.

    같은 빌드라도 도메인 루트 빌드와 GitHub Pages 서브패스 빌드는 canonical·og:image의
    앞부분만 다르다. 그것까지 드리프트로 세면 배포할 때마다 600건이 경고로 뜬다.
    """
    if not u:
        return ""
    m = re.match(r"^https?://[^/]+", u)
    path = u[m.end():] if m else u
    if path.startswith("/buffetkimz-web"):
        path = path[len("/buffetkimz-web"):]
    return path or "/"


def norm_text(text: str) -> str:
    """JSON-LD·본문 안의 절대 주소도 경로만 남겨 해시한다(도메인 빌드와 서브패스 빌드가 같은 글이 되게)."""
    text = re.sub(r"https?://[^/\s\"']+", "", text)
    return text.replace("/buffetkimz-web", "")


def snapshot(dist: Path) -> dict:
    pages: dict[str, dict] = {}
    for file in sorted(dist.rglob("*.html")):
        html = file.read_text(encoding="utf-8", errors="replace")
        p = parse(html)
        keep = [p.title.strip(), meta_content(p, "description"), norm_url(p.canonical), meta_content(p, "robots"),
                norm_text(visible_text(p)), *[norm_text(j) for j in p.jsonld]]
        pages[rel_path(dist, file)] = {
            "title": norm_text(p.title.strip()),
            "description": norm_text(meta_content(p, "description")),
            "canonical": norm_url(p.canonical),
            "robots": meta_content(p, "robots"),
            "h1": p.h1,
            "h2_count": len(p.h2),
            "og_image": norm_url(p.og.get("og:image", "")),
            "jsonld": len(p.jsonld),
            "hash": hashlib.sha256("\u0000".join(keep).encode("utf-8")).hexdigest()[:16],
        }
    return pages


def compare(base: dict, cur: dict) -> list[dict]:
    out: list[dict] = []
    base_pages = base.get("pages", {})
    for path, old in base_pages.items():
        new = cur.get(path)
        if new is None:
            out.append({"severity": "CRITICAL", "path": path, "field": "page", "detail": "기준선에 있던 페이지가 사라졌습니다."})
            continue
        old_noindex = "noindex" in (old.get("robots") or "").lower()
        new_noindex = "noindex" in (new.get("robots") or "").lower()
        if not old_noindex and new_noindex:
            out.append({"severity": "CRITICAL", "path": path, "field": "robots", "detail": "색인되던 페이지가 noindex가 되었습니다."})
        if not new.get("title"):
            out.append({"severity": "CRITICAL", "path": path, "field": "title", "detail": "title이 사라졌습니다."})
        if not new.get("canonical"):
            out.append({"severity": "CRITICAL", "path": path, "field": "canonical", "detail": "canonical이 사라졌습니다."})
        if old.get("h1") and not new.get("h1"):
            out.append({"severity": "CRITICAL", "path": path, "field": "h1", "detail": "H1이 사라졌습니다."})
        if len(old.get("h1") or []) == 1 and len(new.get("h1") or []) != 1:
            out.append({"severity": "CRITICAL", "path": path, "field": "h1", "detail": f"H1 개수 {len(old['h1'])}→{len(new.get('h1') or [])}."})
        for field in ("title", "description", "canonical", "og_image"):
            if old.get(field) != new.get(field):
                out.append({"severity": "WARNING", "path": path, "field": field, "detail": f"{field} 변경"})
        if old.get("jsonld") != new.get("jsonld"):
            out.append({"severity": "WARNING", "path": path, "field": "jsonld", "detail": f"JSON-LD 블록 {old.get('jsonld')}→{new.get('jsonld')}"})
        if (old.get("robots") or "") != (new.get("robots") or "") and not (not old_noindex and new_noindex):
            out.append({"severity": "WARNING", "path": path, "field": "robots", "detail": "meta robots 변경"})
        if old.get("hash") != new.get("hash") and not any(o["path"] == path for o in out):
            out.append({"severity": "INFO", "path": path, "field": "body", "detail": "본문 텍스트 변경"})

    for path in cur:
        if path not in base_pages:
            out.append({"severity": "INFO", "path": path, "field": "page", "detail": "새 페이지"})
    return out


def cmd_baseline(args) -> int:
    dist = Path(args.dist)
    pages = snapshot(dist)
    stamp = datetime.now(timezone.utc).astimezone().strftime("%Y%m%d-%H%M")
    data = {"created_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
            "label": args.label or "", "dist": str(dist), "pages": pages}
    STORE.mkdir(parents=True, exist_ok=True)
    (STORE / f"baseline-{stamp}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"기준선 저장: {len(pages)}쪽 → {args.out}")
    return 0


def cmd_compare(args) -> int:
    base_file = Path(args.baseline)
    if not base_file.exists():
        print(f"기준선이 없습니다: {base_file} — 먼저 `baseline`을 실행하세요.", file=sys.stderr)
        return 2
    base = json.loads(base_file.read_text(encoding="utf-8"))
    cur = snapshot(Path(args.dist))
    diffs = compare(base, cur)
    counts = {s: sum(1 for d in diffs if d["severity"] == s) for s in ("CRITICAL", "WARNING", "INFO")}
    print(f"드리프트: 기준선 {len(base.get('pages', {}))}쪽 · 지금 {len(cur)}쪽 "
          f"· CRITICAL {counts['CRITICAL']} / WARNING {counts['WARNING']} / INFO {counts['INFO']}")
    shown = [d for d in diffs if d["severity"] != "INFO" or args.verbose]
    for d in shown[: args.limit]:
        print(f"  [{d['severity']}] {d['path']} · {d['field']} — {d['detail']}")
    if len(shown) > args.limit:
        print(f"  … 나머지 {len(shown) - args.limit}건")
    if counts["CRITICAL"] or (args.fail_on_warning and counts["WARNING"]):
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="SEO 드리프트(기준선·비교)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("baseline")
    b.add_argument("--dist", default=str(ROOT / "dist"))
    b.add_argument("--out", default=str(DEFAULT))
    b.add_argument("--label", default="")
    b.set_defaults(func=cmd_baseline)

    c = sub.add_parser("compare")
    c.add_argument("--dist", default=str(ROOT / "dist"))
    c.add_argument("--baseline", default=str(DEFAULT))
    c.add_argument("--fail-on-warning", action="store_true")
    c.add_argument("--verbose", action="store_true", help="INFO(본문 변경)까지 보여 줍니다")
    c.add_argument("--limit", type=int, default=40)
    c.set_defaults(func=cmd_compare)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
