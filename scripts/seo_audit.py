#!/usr/bin/env python3
"""빌드 산출물(dist) SEO·GEO 감사 — 2026-11-28.

무엇을 하나
  `AgriciDaniel/claude-seo`(MIT, v2.6.3)의 `seo-audit`·`seo-geo`·`seo-agentic` 체크리스트에서
  **정적으로 잴 수 있는 항목만** 가져와 dist 전체를 훑고, 100점 만점의 건강 점수와 함께
  고칠 순서(심각도)를 낸다. 외부 API·DataForSEO·Lighthouse는 쓰지 않는다(네트워크 없이 돈다).

가져온 기준
  · 점수 가중치(seo-audit): 기술 22 · 콘텐츠 23 · 온페이지 20 · 스키마 10 · AI 대응 10 · 이미지 5.
    성능(CWV, 10)은 Lighthouse가 있어야 재는 값이라 여기서는 **측정하지 않는다**(점수에서 빼고 나머지를 다시 정규화).
  · 봇 구분(seo-geo): 검색 인용(OAI-SearchBot·Claude-SearchBot·PerplexityBot·Googlebot·Yeti·
    Bingbot·Applebot)과 학습(GPTBot·ClaudeBot·Google-Extended·CCBot…)을 **섞지 않는다**.
  · 서버 렌더(seo-agentic P0): JS 없이 본문이 HTML에 있는지 — text 길이 0이면 실패.
  · 드리프트(seo-drift): 여기서는 '지금 상태'만 잰다. 기준선 비교는 `seo_drift.py`가 맡는다.

쓰는 법
  python3 scripts/seo_audit.py                       # 사람이 읽는 요약 + 리포트 파일
  python3 scripts/seo_audit.py --fail-on-critical    # 치명 결함이 있으면 exit 1 (배포 게이트)
  python3 scripts/seo_audit.py --json out.json --md out.md --quiet
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SEVERITY_WEIGHT = {"critical": 25, "high": 10, "medium": 4, "low": 1}

# claude-seo seo-audit 가중치 (성능 10은 측정하지 않는다)
CATEGORY_WEIGHT = {
    "technical": 22,
    "content": 23,
    "onpage": 20,
    "schema": 10,
    "ai": 10,
    "images": 5,
}

SEARCH_BOTS = ["Googlebot", "Yeti", "Bingbot", "Applebot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]
TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"]
KEY_PATHS = ["/posts", "/apps", "/calendar", "/year-end-tax", "/board", "/about"]


class PageParser(HTMLParser):
    """페이지 하나에서 감사에 필요한 것만 모은다."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.metas: list[dict[str, str]] = []
        self.canonical = ""
        self.h1: list[str] = []
        self.h2: list[str] = []
        self.h3: list[str] = []
        self.jsonld: list[str] = []
        self.og: dict[str, str] = {}
        self.links: list[str] = []
        self.imgs: list[dict[str, str]] = []
        self.lang = ""
        self.text_parts: list[str] = []
        self._in_title = False
        self._in_script = False
        self._script_type = ""
        self._script_buf: list[str] = []
        self._heading: str | None = None
        self._heading_buf: list[str] = []
        self._skip_depth = 0

    # -- helpers
    def _close_heading(self) -> None:
        if not self._heading:
            return
        text = re.sub(r"\s+", " ", "".join(self._heading_buf)).strip()
        {"h1": self.h1, "h2": self.h2, "h3": self.h3}[self._heading].append(text)
        self._heading = None
        self._heading_buf = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            self.metas.append(a)
            if a.get("property", "").startswith("og:"):
                self.og[a["property"]] = a.get("content", "")
        elif tag == "link" and "canonical" in a.get("rel", ""):
            self.canonical = a.get("href", "")
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "img":
            self.imgs.append(a)
        elif tag in ("h1", "h2", "h3"):
            self._heading = tag
            self._heading_buf = []
        elif tag == "script":
            self._in_script = True
            self._script_type = a.get("type", "")
            self._script_buf = []
        elif tag in ("style", "noscript") and self._in_script is False:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag in ("h1", "h2", "h3"):
            self._close_heading()
        elif tag == "script":
            if self._in_script and self._script_type == "application/ld+json":
                self.jsonld.append("".join(self._script_buf))
            self._in_script = False
            self._script_type = ""
            self._script_buf = []
        elif tag in ("style", "noscript") and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._in_script:
            self._script_buf.append(data)
        else:
            if self._heading:
                self._heading_buf.append(data)
            if self._skip_depth == 0:
                self.text_parts.append(data)


def parse(html: str) -> PageParser:
    p = PageParser()
    p.feed(html)
    p.close()
    p._close_heading()
    return p


def visible_text(p: PageParser) -> str:
    return re.sub(r"\s+", " ", " ".join(p.text_parts)).strip()


def rel_path(dist: Path, file: Path) -> str:
    rel = file.relative_to(dist).as_posix()
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return "/" + rel


def meta_content(p: PageParser, name: str) -> str:
    for m in p.metas:
        if m.get("name", "").lower() == name.lower():
            return m.get("content", "")
    return ""


def jsonld_types(raw: list[str]) -> list[str]:
    types: list[str] = []
    for block in raw:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            types.append("INVALID")
            continue
        stack = [data]
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                t = cur.get("@type")
                if isinstance(t, str):
                    types.append(t)
                elif isinstance(t, list):
                    types.extend(str(x) for x in t)
                stack.extend(v for v in cur.values() if isinstance(v, (dict, list)))
            elif isinstance(cur, list):
                stack.extend(cur)
    return types


def audit(dist: Path) -> dict:
    findings: list[dict] = []
    pages: dict[str, dict] = {}

    def add(sev: str, cat: str, code: str, path: str, detail: str) -> None:
        findings.append({"severity": sev, "category": cat, "code": code, "path": path, "detail": detail})

    files = sorted(dist.rglob("*.html"))
    if not files:
        raise SystemExit(f"중단: {dist}에 HTML이 없습니다. 먼저 빌드하세요.")

    titles: dict[str, list[str]] = defaultdict(list)
    indexable = 0

    for file in files:
        html = file.read_text(encoding="utf-8", errors="replace")
        p = parse(html)
        path = rel_path(dist, file)
        robots = meta_content(p, "robots").lower()
        noindex = "noindex" in robots
        text = visible_text(p)
        title = re.sub(r"\s+", " ", p.title).strip()
        desc = meta_content(p, "description").strip()
        ld_types = jsonld_types(p.jsonld)

        pages[path] = {
            "noindex": noindex,
            "title": title,
            "title_len": len(title),
            "description_len": len(desc),
            "h1": len(p.h1),
            "h2": len(p.h2),
            "jsonld": ld_types,
            "text_len": len(text),
            "images": len(p.imgs),
            "img_no_alt": sum(1 for i in p.imgs if "alt" not in i),
            "internal_links": sum(1 for h in p.links if h.startswith("/") or h.startswith("./") or h.startswith("../")),
            "canonical": bool(p.canonical),
            "og_image": bool(p.og.get("og:image")),
        }

        if noindex:
            continue
        indexable += 1

        # ---- 온페이지
        if not title:
            add("critical", "onpage", "title-missing", path, "title 태그가 없습니다.")
        else:
            titles[title].append(path)
            if len(title) > 85:
                add("medium", "onpage", "title-long", path, f"title {len(title)}자 — 85자 이내로(잘림 방지).")
        if not desc:
            add("high", "onpage", "description-missing", path, "meta description이 없습니다.")
        elif not (50 <= len(desc) <= 170):
            add("low", "onpage", "description-length", path, f"description {len(desc)}자 — 50~160자를 권장.")
        if len(p.h1) != 1:
            add("critical", "onpage", "h1-count", path, f"h1 {len(p.h1)}개 — 페이지마다 정확히 1개.")
        elif not p.h1[0].strip():
            add("high", "onpage", "h1-empty", path, "h1이 비어 있습니다.")
        if not p.og.get("og:image"):
            add("high", "onpage", "og-image", path, "og:image가 없습니다(공유 카드).")

        # ---- 기술
        if not p.canonical:
            add("critical", "technical", "canonical-missing", path, "canonical 링크가 없습니다.")
        if not p.lang:
            add("high", "technical", "html-lang", path, "html lang 속성이 없습니다.")
        if not robots:
            add("medium", "technical", "robots-meta", path, "meta robots가 없습니다(index 기본값).")

        # ---- 스키마
        if not p.jsonld:
            add("high", "schema", "jsonld-missing", path, "JSON-LD 구조화 데이터가 없습니다.")
        elif "INVALID" in ld_types:
            add("critical", "schema", "jsonld-invalid", path, "JSON-LD가 JSON으로 파싱되지 않습니다.")

        # ---- 콘텐츠 (얇은 글)
        if len(text) < 400:
            add("medium", "content", "thin", path, f"본문 텍스트 {len(text)}자 — 얇은 페이지(색인 품질).")
        if pages[path]["internal_links"] < 3:
            add("medium", "content", "internal-links", path, f"내부 링크 {pages[path]['internal_links']}개 — 고립 페이지.")

        # ---- 이미지
        no_alt = pages[path]["img_no_alt"]
        if no_alt:
            add("medium", "images", "img-alt", path, f"alt 없는 이미지 {no_alt}개 / 전체 {len(p.imgs)}개.")

        # ---- AI/에이전트 (JS 없이 본문)
        if len(text) < 200:
            add("critical", "ai", "server-rendered", path, "JS 없이 읽히는 본문이 거의 없습니다(서버 렌더 실패).")

    # ---- 사이트 수준
    site = audit_site(dist, add)

    # 같은 제목이 여러 페이지 — 검색 결과에서 어느 쪽인지 갈리지 않는다
    for title, paths in titles.items():
        if len(paths) > 1:
            add("critical", "content", "title-duplicate", paths[0], f"같은 title {len(paths)}곳: {', '.join(paths[:4])}")

    # ---- 점수
    penalty: dict[str, int] = defaultdict(int)
    for f in findings:
        penalty[f["category"]] += SEVERITY_WEIGHT.get(f["severity"], 1)
    raw_score = {cat: max(0, 100 - penalty[cat]) for cat in CATEGORY_WEIGHT}
    total_weight = sum(CATEGORY_WEIGHT.values())
    health = round(sum(raw_score[c] * w for c, w in CATEGORY_WEIGHT.items()) / total_weight, 1)

    by_sev = Counter(f["severity"] for f in findings)
    return {
        "generated_at": None,
        "dist": str(dist),
        "pages_total": len(files),
        "pages_indexable": indexable,
        "health_score": health,
        "categories": raw_score,
        "weights": CATEGORY_WEIGHT,
        "severity_counts": {s: by_sev.get(s, 0) for s in ("critical", "high", "medium", "low")},
        "site": site,
        "findings": sorted(findings, key=lambda f: (["critical", "high", "medium", "low"].index(f["severity"]), f["category"])),
        "pages": pages,
    }


def audit_site(dist: Path, add) -> dict:
    out: dict = {}

    robots_file = dist / "robots.txt"
    robots = robots_file.read_text(encoding="utf-8", errors="replace") if robots_file.exists() else ""
    out["robots"] = {
        "present": bool(robots),
        "sitemap": "Sitemap:" in robots,
        "search_bots": {b: (f"User-agent: {b}" in robots) for b in SEARCH_BOTS},
        "training_bots": {b: (f"User-agent: {b}" in robots) for b in TRAINING_BOTS},
    }
    if not robots:
        add("critical", "ai", "robots-missing", "/robots.txt", "robots.txt가 없습니다.")
    else:
        if not out["robots"]["sitemap"]:
            add("high", "technical", "robots-sitemap", "/robots.txt", "robots.txt에 Sitemap 줄이 없습니다.")
        for bot in SEARCH_BOTS:
            if not out["robots"]["search_bots"][bot]:
                add("medium", "ai", "robots-search-bot", "/robots.txt", f"{bot} 명시 허용이 없습니다(검색 인용).")

    llms_file = dist / "llms.txt"
    llms = llms_file.read_text(encoding="utf-8", errors="replace") if llms_file.exists() else ""
    link_count = len(re.findall(r"^- \[[^\]]+\]\(https?://", llms, re.M))
    missing = [p for p in KEY_PATHS if p not in llms]
    out["llms"] = {
        "present": bool(llms),
        "bytes": len(llms.encode("utf-8")),
        "links": link_count,
        "has_h1": llms.lstrip().startswith("# "),
        "has_summary": "\n> " in llms,
        "missing_key_paths": missing,
    }
    if not llms:
        add("medium", "ai", "llms-missing", "/llms.txt", "llms.txt가 없습니다(AI 에이전트용 지도).")
    else:
        if not out["llms"]["has_h1"] or not out["llms"]["has_summary"]:
            add("medium", "ai", "llms-format", "/llms.txt", "llms.txt 표준 형식(H1 + blockquote)이 아닙니다.")
        if link_count < 20:
            add("medium", "ai", "llms-thin", "/llms.txt", f"llms.txt 링크 {link_count}개 — 사이트 지도로 얇습니다.")
        if missing:
            add("medium", "ai", "llms-stale", "/llms.txt", f"핵심 구역 누락: {', '.join(missing)}")

    out["sitemap_index"] = (dist / "sitemap-index.xml").exists()
    out["not_found"] = (dist / "404.html").exists()
    if not out["sitemap_index"]:
        add("high", "technical", "sitemap-missing", "/sitemap-index.xml", "sitemap-index.xml이 없습니다.")
    if not out["not_found"]:
        add("medium", "technical", "404-missing", "/404.html", "404.html이 없습니다(없는 주소가 빈 화면).")
    return out


def to_markdown(rep: dict) -> str:
    lines: list[str] = []
    lines.append("# SEO·GEO 감사 — buffetkimz-web")
    lines.append("")
    lines.append(f"- 감사 대상: `{rep['dist']}` · HTML {rep['pages_total']}쪽(색인 {rep['pages_indexable']})")
    lines.append(f"- **건강 점수 {rep['health_score']}/100** (성능 항목은 Lighthouse 필요 — 이 감사에서 제외)")
    lines.append("")
    lines.append("| 분야 | 점수 | 가중치 |")
    lines.append("|---|---:|---:|")
    names = {
        "technical": "기술 SEO",
        "content": "콘텐츠 품질",
        "onpage": "온페이지",
        "schema": "스키마",
        "ai": "AI 대응",
        "images": "이미지",
    }
    for cat, score in rep["categories"].items():
        lines.append(f"| {names.get(cat, cat)} | {score} | {rep['weights'][cat]}% |")
    lines.append("")
    sev = rep["severity_counts"]
    lines.append(f"치명 {sev['critical']} · 높음 {sev['high']} · 보통 {sev['medium']} · 낮음 {sev['low']}")
    lines.append("")

    r = rep["site"]["robots"]
    if r.get("present"):
        ok = [b for b, v in r["search_bots"].items() if v]
        lines.append(f"- robots.txt: 있음 · 검색 인용 봇 {len(ok)}/{len(SEARCH_BOTS)} 명시 · Sitemap {'있음' if r['sitemap'] else '없음'}")
    l = rep["site"]["llms"]
    if l.get("present"):
        lines.append(f"- llms.txt: {l['bytes']:,}B · 링크 {l['links']}개 · 누락 구역 {l['missing_key_paths'] or '없음'}")
    lines.append(f"- sitemap-index: {'있음' if rep['site']['sitemap_index'] else '없음'} · 404: {'있음' if rep['site']['not_found'] else '없음'}")
    lines.append("")

    lines.append("## 고칠 것 (심각도 순)")
    lines.append("")
    if not rep["findings"]:
        lines.append("없음 — 치명·높음·보통·낮음 모두 0.")
    else:
        lines.append("| 심각도 | 분야 | 코드 | 경로 | 내용 |")
        lines.append("|---|---|---|---|---|")
        for f in rep["findings"][:80]:
            lines.append(f"| {f['severity']} | {f['category']} | `{f['code']}` | `{f['path']}` | {f['detail']} |")
        if len(rep["findings"]) > 80:
            lines.append(f"| … | | | | 나머지 {len(rep['findings']) - 80}건은 JSON 참조 |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="dist SEO·GEO 감사 (claude-seo 기준)")
    ap.add_argument("--dist", default=str(ROOT / "dist"))
    ap.add_argument("--json", default=str(ROOT / "reports/buffetkimz-web/seo-audit.json"))
    ap.add_argument("--md", default=str(ROOT / "reports/buffetkimz-web/seo-audit.md"))
    ap.add_argument("--fail-on-critical", action="store_true", help="치명 결함이 있으면 exit 1")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    dist = Path(args.dist)
    rep = audit(dist)
    md = to_markdown(rep)

    jp = Path(args.json)
    mp = Path(args.md)
    jp.parent.mkdir(parents=True, exist_ok=True)
    mp.parent.mkdir(parents=True, exist_ok=True)
    jp.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    mp.write_text(md, encoding="utf-8")

    if not args.quiet:
        sev = rep["severity_counts"]
        print(
            f"SEO 감사: 점수 {rep['health_score']}/100 · HTML {rep['pages_total']}쪽"
            f" · 치명 {sev['critical']} / 높음 {sev['high']} / 보통 {sev['medium']} / 낮음 {sev['low']}"
        )
        for f in rep["findings"]:
            if f["severity"] in ("critical", "high"):
                print(f"  [{f['severity']}] {f['code']} {f['path']} — {f['detail']}")
        print(f"  리포트: {mp.relative_to(ROOT) if mp.is_relative_to(ROOT) else mp}")

    if args.fail_on_critical and rep["severity_counts"]["critical"]:
        print("✗ 치명 결함이 있어 배포 게이트를 통과하지 못했습니다.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
