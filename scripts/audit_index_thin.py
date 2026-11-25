#!/usr/bin/env python3
"""
색인 허용 페이지의 얇은 콘텐츠 전수 점검 (2026-11-25 신설).

왜 필요한가
  애드센스 심사에서 가장 흔한 반려 사유가 "가치가 낮은 콘텐츠"(thin content)다.
  이 사이트는 글 1편이 3,000자 이상이지만, 목록·카드·빈 분야 페이지는 짧을 수 있다.
  사람이 눈으로 세지 않고 **빌드 산출물(dist) 전체**를 세서, index 로 나가는 페이지 중
  본문이 짧은 것을 매번 같은 기준으로 드러낸다.

무엇을 보나
  · <meta name="robots"> 가 index 인 페이지의 <main> 본문 글자수(공백 제외)
  · noindex 여야 하는 경로(/search · /404 · /topics · /tools · */run)가 실제로 noindex 인지
  · 사이트맵에 noindex 페이지가 섞였는지

사용
  python3 scripts/audit_index_thin.py                 # 보고 only (항상 exit 0)
  python3 scripts/audit_index_thin.py --strict        # 기준 미만이면 exit 1 (게이트로 쓸 때)
  python3 scripts/audit_index_thin.py --min 800       # 기준 글자수 변경(기본 600)

산출
  stdout 요약 + reports/buffetkimz-web/thin-content-audit.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_OUT = pathlib.Path("/workspace/reports/buffetkimz-web/thin-content-audit.json")

TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")
# 색인이 금지된 화면 — robots.txt가 아니라 각 페이지의 meta robots가 책임진다
MUST_NOINDEX = ("/search", "/404", "/topics/", "/tools/")


def text_len(html: str) -> int:
    html = re.sub(r"<(script|style|noscript)\b[\s\S]*?</\1>", " ", html, flags=re.I)
    main = re.search(r"<main\b[\s\S]*?</main>", html)
    body = main.group(0) if main else html
    return len(re.sub(r"\s", "", WS.sub(" ", TAG.sub(" ", body))))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default=str(ROOT / "dist"))
    ap.add_argument("--min", type=int, default=600, help="index 페이지 최소 본문 글자수")
    ap.add_argument("--strict", action="store_true", help="기준 미만이면 exit 1")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    dist = pathlib.Path(args.dist)
    if not (dist / "index.html").is_file():
        print(f"✗ dist를 찾지 못했습니다: {dist} — 먼저 빌드하세요.", file=sys.stderr)
        return 2

    pages = []
    for f in sorted(dist.rglob("*.html")):
        html = f.read_text(encoding="utf-8", errors="ignore")
        rel = "/" + str(f.relative_to(dist)).replace("index.html", "").replace("\\", "/")
        rel = rel.replace("//", "/")
        robots = re.search(r'<meta name="robots" content="([^"]*)"', html)
        robots = robots.group(1) if robots else "(none)"
        noindex = "noindex" in robots
        pages.append({"path": rel, "chars": text_len(html), "robots": robots, "noindex": noindex})

    indexable = [p for p in pages if not p["noindex"]]
    thin = sorted([p for p in indexable if p["chars"] < args.min], key=lambda p: p["chars"])

    problems: list[str] = []
    for prefix in MUST_NOINDEX:
        for p in pages:
            if (p["path"] == prefix or p["path"].startswith(prefix + "/") or prefix in p["path"]) and not p["noindex"]:
                problems.append(f"noindex 누락: {p['path']} ({p['robots']})")

    # 사이트맵에 noindex 페이지가 섞였는지
    sm_noindex = []
    sm_index = dist / "sitemap-index.xml"
    sitemap_urls: list[str] = []
    if sm_index.is_file():
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        try:
            tree = ET.parse(sm_index)
            for loc in tree.getroot().findall(".//s:sitemap/s:loc", ns):
                child = dist / loc.text.strip().rstrip("/").split("/")[-1]
                if child.is_file():
                    for u in ET.parse(child).getroot().findall(".//s:url/s:loc", ns):
                        sitemap_urls.append(u.text.strip())
        except ET.ParseError as exc:
            problems.append(f"사이트맵 파싱 실패: {exc}")
        noindex_paths = sorted({p["path"].rstrip("/") or "/" for p in pages if p["noindex"]})
        for u in sitemap_urls:
            pathname = urllib.parse.urlparse(u).path.rstrip("/") or "/"
            for np in noindex_paths:
                if pathname.endswith(np):
                    sm_noindex.append(u)
                    break
        if sm_noindex:
            problems.append(f"사이트맵에 noindex {len(sm_noindex)}건: {sm_noindex[:3]}")

    print(f"HTML {len(pages)}개 · index 허용 {len(indexable)}개 · noindex {len(pages) - len(indexable)}개")
    print(f"index 허용 중 본문 {args.min}자 미만: {len(thin)}개")
    for p in thin[:20]:
        print(f"  {p['chars']:>5}자  {p['path']}")
    if problems:
        print("\n문제:")
        for p in problems:
            print("  ✗", p)
    else:
        print("\n문제 없음: 색인 금지 화면은 모두 noindex, 사이트맵에 noindex 페이지 없음")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"min": args.min, "pages": pages, "thin": thin, "problems": problems}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"\n저장: {out}")

    if args.strict and (thin or problems):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
