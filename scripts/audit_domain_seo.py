#!/usr/bin/env python3
"""
buffetkimz.com 3단계 — 실 도메인 전환·SEO·수익화 자리 자동 점검 (v3).

정적 빌드 산출물(dist)만 읽어서 검사한다. 네트워크를 타지 않는다(외부 링크 존재 확인 제외).

사용:
  # 도메인 루트 빌드 검사
  SITE_URL=https://buffetkimz.com BASE_PATH=/ npm run build
  python3 scripts/audit_domain_seo.py --dist dist

  # GitHub Pages 서브패스 회귀 검사
  SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
  python3 scripts/audit_domain_seo.py --dist dist --site https://byhan2025.github.io --base /buffetkimz-web

  # 광고 자리 프리뷰 빌드 검사 (AD_PREVIEW=1)
  AD_PREVIEW=1 npm run build && python3 scripts/audit_domain_seo.py --dist dist-adpreview --mode preview

산출: JSON 리포트(기본 reports/buffetkimz-web/domain-seo-v3/domain-seo-audit.json) + 사람이 읽는 요약(stdout)
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, unquote

from lxml import html as lxml_html

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_SITE = "https://buffetkimz.com"
DEFAULT_BASE = "/"
DEFAULT_OUT = "/workspace/reports/buffetkimz-web/domain-seo-v3/domain-seo-audit.json"

# ── 요구사항 표 ────────────────────────────────────────────────────────────
# 페이지 종류별로 반드시 있어야 하는 JSON-LD 타입
REQUIRED_TYPES = {
    "/": {"WebSite", "Person", "Organization"},
    "/about/": {"AboutPage", "Person"},
    "/posts/": {"CollectionPage"},
    "/apps/": {"ItemList"},
    "/calendar/": {"FAQPage"},
    "/letters/": {"CollectionPage"},
}
# noindex 여야 하는 경로 접두(색인되면 안 되는 화면)
MUST_NOINDEX = ("/search", "/404", "/topics/", "/tools/")
# 사이트맵에 들어가면 안 되는 경로 접두
SITEMAP_FORBIDDEN = ("/search", "/404", "/topics/", "/tools/")
# 광고 자리 최소 개수(본문 하단·목록·도구 하단)
MIN_AD_SLOTS = 3
# OG 기본 이미지 규격
OG_DEFAULT = (1200, 630)


def norm_base(base: str) -> str:
    b = "/" + (base or "/").strip().strip("/")
    return "/" if b == "/" else b


class Report:
    def __init__(self):
        self.checks: list[dict] = []
        self.issues: list[dict] = []
        self.pages: list[dict] = []

    def check(self, cid: str, ok: bool, detail=None, level: str = "error"):
        state = "pass" if ok else ("warn" if level == "warn" else "fail")
        self.checks.append({"id": cid, "state": state, "detail": detail})
        if not ok:
            self.issues.append({"id": cid, "level": level, "detail": detail})
        return ok

    @property
    def failures(self):
        return [c for c in self.checks if c["state"] == "fail"]

    @property
    def warnings(self):
        return [c for c in self.checks if c["state"] == "warn"]


def expected_url(rel: pathlib.Path, site: str, base: str) -> str:
    """dist 상대 경로 → 사이트 절대 주소(canonical 규칙: 디렉터리 index 는 끝 슬래시)."""
    prefix = "" if base == "/" else base
    p = rel.as_posix()
    if p == "index.html":
        path = "/"
    elif p.endswith("/index.html"):
        path = "/" + p[: -len("index.html")]
    elif p == "404.html":
        path = "/404/"  # Astro 는 404 를 /404/ 로 정규화한다
    else:
        path = "/" + p
    return f"{site}{prefix}{path}"


def resolve_internal(url: str, dist: pathlib.Path, prefix: str = "") -> bool | None:
    """내부 절대 경로가 dist 안에서 실제로 열리는지. 외부/앵커는 None."""
    if not url or url.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return None
    if url.startswith("//"):
        return None
    if re.match(r"^https?://", url):
        return None
    path = unquote(urlparse(url).path)
    if not path.startswith("/"):
        return None  # 상대 경로는 이 사이트에서 쓰지 않는다(별도 검사)
    rel = path.lstrip("/")
    # 서브패스 빌드(gh-pages) 는 dist 가 그 접두의 루트로 서빙된다
    if prefix and (rel == prefix.lstrip("/") or rel.startswith(prefix.lstrip("/") + "/")):
        rel = rel[len(prefix.lstrip("/")) :].lstrip("/")
    cand = [dist / rel, dist / rel / "index.html"]
    if rel and not rel.endswith("/"):
        cand.append(dist / f"{rel}.html")
    return any(c.is_file() for c in cand)


def meta_map(doc) -> tuple[dict, list]:
    metas, dupes = {}, []
    for m in doc.xpath("//head/meta[@name or @property]"):
        key = m.get("name") or m.get("property")
        val = (m.get("content") or "").strip()
        if key in metas and key not in ("og:image:width", "og:image:height"):
            dupes.append(key)
        if key in metas:
            continue
        metas[key] = val
    return metas, dupes


def jsonld_blocks(doc) -> tuple[list, list]:
    blocks, errors = [], []
    for s in doc.xpath('//script[@type="application/ld+json"]'):
        raw = s.text or ""
        try:
            blocks.append(json.loads(raw))
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
    return blocks, errors


def walk_types(node, out: set):
    if isinstance(node, dict):
        t = node.get("@type")
        if isinstance(t, str):
            out.add(t)
        elif isinstance(t, list):
            out.update(x for x in t if isinstance(x, str))
        for v in node.values():
            walk_types(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_types(v, out)
    return out


def collect_urls(node, out: set):
    """JSON-LD 안의 사이트 소유 주소(url·@id·item·image) 수집."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("url", "@id", "item", "image", "mainEntityOfPage", "sameAs") and isinstance(v, str):
                out.add(v)
            else:
                collect_urls(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_urls(v, out)
    return out


def png_size(path: pathlib.Path):
    try:
        with open(path, "rb") as fh:
            head = fh.read(33)
        if head[:8] != b"\x89PNG\r\n\x1a\n":
            return None
        w = int.from_bytes(head[16:20], "big")
        h = int.from_bytes(head[20:24], "big")
        return (w, h)
    except Exception:  # noqa: BLE001
        return None


def webp_size(path: pathlib.Path):
    """WebP 헤더에서 실제 픽셀 크기 — OG 선언 규격이 파일과 맞는지 확인한다."""
    try:
        data = path.read_bytes()[:64]
        if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            return None
        chunk = data[12:16]
        if chunk == b"VP8X":
            w = 1 + int.from_bytes(data[24:27], "little")
            h = 1 + int.from_bytes(data[27:30], "little")
            return (w, h)
        if chunk == b"VP8 ":
            w = int.from_bytes(data[26:28], "little") & 0x3FFF
            h = int.from_bytes(data[28:30], "little") & 0x3FFF
            return (w, h)
        if chunk == b"VP8L":
            b = int.from_bytes(data[21:25], "little")
            return ((b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1)
        return None
    except Exception:  # noqa: BLE001
        return None


def image_size(path: pathlib.Path):
    if path.suffix.lower() == ".png":
        return png_size(path)
    if path.suffix.lower() == ".webp":
        return webp_size(path)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default="dist")
    ap.add_argument("--site", default=os.environ.get("SITE_URL", DEFAULT_SITE))
    ap.add_argument("--base", default=os.environ.get("BASE_PATH", DEFAULT_BASE))
    ap.add_argument("--out", default=os.environ.get("AUDIT_OUT", DEFAULT_OUT))
    ap.add_argument("--mode", default="default", choices=["default", "preview"])
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    dist = (ROOT / args.dist).resolve() if not pathlib.Path(args.dist).is_absolute() else pathlib.Path(args.dist)
    site = args.site.rstrip("/")
    base = norm_base(args.base)
    prefix = "" if base == "/" else base
    rep = Report()

    if not dist.is_dir():
        print(f"dist 없음: {dist}", file=sys.stderr)
        return 2

    pages = sorted(dist.rglob("*.html"))
    rep.check("build.dist_exists", len(pages) > 0, {"html_files": len(pages)})

    canonical_set: set[str] = set()
    indexable: list[str] = []
    noindex_pages: list[str] = []
    redirect_pages: list[str] = []

    # ── 페이지 단위 검사 ──────────────────────────────────────────────────
    for f in pages:
        rel = f.relative_to(dist)
        url_expected = expected_url(rel, site, base)
        raw = f.read_text(encoding="utf-8", errors="replace")
        try:
            doc = lxml_html.fromstring(raw)
        except Exception as exc:  # noqa: BLE001
            rep.check(f"html.parse:{rel.as_posix()}", False, str(exc))
            continue

        metas, dupes = meta_map(doc)
        titles = doc.xpath("//head/title/text()")
        descs = doc.xpath('//head/meta[@name="description"]/@content')
        canon = doc.xpath('//head/link[@rel="canonical"]/@href')
        lds, ld_errors = jsonld_blocks(doc)
        robots = (metas.get("robots") or "").lower()
        is_noindex = "noindex" in robots
        is_redirect = bool(doc.xpath('//meta[@http-equiv="refresh"]'))
        types: set[str] = set()
        for b in lds:
            walk_types(b, types)

        page = {
            "file": rel.as_posix(),
            "url": url_expected,
            "indexable": not is_noindex,
            "redirect": is_redirect,
            "title": (titles[0].strip() if titles else ""),
            "title_count": len(titles),
            "description": (descs[0].strip() if descs else ""),
            "canonical_count": len(canon),
            "canonical": canon[0] if canon else "",
            "og_url": metas.get("og:url", ""),
            "og_image": metas.get("og:image", ""),
            "og_image_width": metas.get("og:image:width", ""),
            "og_image_height": metas.get("og:image:height", ""),
            "twitter_card": metas.get("twitter:card", ""),
            "jsonld_types": sorted(types),
            "jsonld_blocks": len(lds),
            "jsonld_errors": ld_errors,
            "meta_dupes": dupes,
            "noindex": is_noindex,
            "ad_slots": len(doc.xpath('//*[@data-ad-slot]')),
        }
        rep.pages.append(page)

        if is_noindex:
            noindex_pages.append(url_expected)
        if is_redirect:
            redirect_pages.append(url_expected)
        if canon:
            canonical_set.add(canon[0].rstrip("/") or "/")
            if not is_noindex:
                indexable.append(canon[0])

        # 중복·누락
        rep.check(f"meta.title_count:{rel}", len(titles) == 1, {"count": len(titles), "title": page["title"]})
        rep.check(f"meta.dupes:{rel}", not dupes, {"dupes": dupes})

        # 리다이렉트 페이지는 canonical/OG/설명을 요구하지 않는다(noindex·meta refresh 로 처리)
        if not is_redirect:
            rep.check(f"meta.description_count:{rel}", len(descs) == 1, {"count": len(descs)})
            rep.check(f"meta.description:{rel}", bool(page["description"]), {"description": page["description"][:40]})
            dlen = len(page["description"])
            rep.check(
                f"meta.description_len:{rel}",
                40 <= dlen <= 200,
                {"len": dlen},
                level="warn",
            )
            tlen = len(page["title"])
            rep.check(f"meta.title_len:{rel}", 7 <= tlen <= 80, {"len": tlen}, level="warn")
            rep.check(f"canonical.count:{rel}", len(canon) == 1, {"count": len(canon)})
            rep.check(
                f"canonical.value:{rel}",
                bool(canon) and canon[0] == url_expected,
                {"expected": url_expected, "actual": canon[0] if canon else None},
            )
            rep.check(
                f"og.url:{rel}",
                metas.get("og:url") == (canon[0] if canon else url_expected),
                {"og:url": metas.get("og:url"), "canonical": canon[0] if canon else None},
            )
            for key in ("og:type", "og:title", "og:description", "og:image", "og:site_name", "og:locale"):
                rep.check(f"og.required:{key}:{rel}", bool(metas.get(key)), {"value": metas.get(key, "")[:60]})
            for key in ("twitter:card", "twitter:title", "twitter:description", "twitter:image"):
                rep.check(f"twitter.required:{key}:{rel}", bool(metas.get(key)), None)
            rep.check(
                f"twitter.image_eq_og:{rel}",
                metas.get("twitter:image") == metas.get("og:image"),
                {"twitter": metas.get("twitter:image"), "og": metas.get("og:image")},
            )
            # og:image 는 절대 https 주소이고 dist 안 파일이어야 한다
            og_img = metas.get("og:image", "")
            ok_img = og_img.startswith("https://")
            if ok_img:
                img_rel = unquote(urlparse(og_img).path).lstrip("/")
                if prefix and img_rel.startswith(prefix.lstrip("/") + "/"):
                    img_rel = img_rel[len(prefix.lstrip("/")) + 1 :]
                ok_img = (dist / img_rel).is_file()
            rep.check(f"og.image_resolves:{rel}", ok_img, {"og:image": og_img})
            if page["og_image_width"] and page["og_image_height"]:
                img_rel = unquote(urlparse(og_img).path).lstrip("/")
                if prefix and img_rel.startswith(prefix.lstrip("/") + "/"):
                    img_rel = img_rel[len(prefix.lstrip("/")) + 1 :]
                size = image_size(dist / img_rel)
                declared = (int(page["og_image_width"]), int(page["og_image_height"]))
                if size:
                    rep.check(
                        f"og.image_dims:{rel}",
                        size == declared,
                        {"declared": declared, "actual": size},
                    )
            # hreflang 은 canonical 과 같아야 한다
            alts = doc.xpath('//head/link[@rel="alternate"][@hreflang]/@href')
            rep.check(
                f"hreflang.match:{rel}",
                (not alts) or (canon and alts[0] == canon[0]),
                {"hreflang": alts[:1], "canonical": canon[:1]},
            )

        # JSON-LD
        rep.check(f"jsonld.parse:{rel}", not ld_errors, {"errors": ld_errors})
        if not is_redirect and not is_noindex:
            for t in REQUIRED_TYPES.get(url_expected.replace(site + prefix, "") or "/", set()):
                rep.check(f"jsonld.type:{t}:{rel}", t in types, {"types": sorted(types)})

        # 내부 링크 해석
        for attr, tag in (("href", "a"), ("src", "img"), ("href", "link"), ("src", "script")):
            for val in doc.xpath(f"//{tag}/@{attr}"):
                r = resolve_internal(val, dist, prefix)
                if r is False:
                    rep.check(f"link.resolve:{rel}", False, {"url": val})
        reps = doc.xpath('//*[@style and contains(@style,"url(")]/@style')
        for style in reps:
            for m in re.finditer(r"url\((['\"]?)([^'\")]+)\1\)", style):
                r = resolve_internal(m.group(2), dist, prefix)
                if r is False:
                    rep.check(f"link.resolve_style:{rel}", False, {"url": m.group(2)})

    rep.check(
        "build.page_count",
        len(pages) >= 40,
        {"pages": len(pages), "indexable": len(indexable), "noindex": len(noindex_pages), "redirect": len(redirect_pages)},
    )

    # ── 하드코딩 검사 (dist) ─────────────────────────────────────────────
    bad_subpath = []
    other_origin = []
    for f in pages:
        rel = f.relative_to(dist).as_posix()
        raw = f.read_text(encoding="utf-8", errors="replace")
        if "/buffetkimz-web" in raw:
            bad_subpath.append(rel)
        for m in re.finditer(r"https://byhan2025\.github\.io[^\"'<\s]*", raw):
            other_origin.append({"file": rel, "url": m.group(0)})
    if base == "/":
        rep.check("dist.no_subpath_leftover", not bad_subpath, {"files": bad_subpath[:10]})
    rep.check(
        "dist.github_io_refs",
        True if not other_origin else False,
        {"count": len(other_origin), "sample": other_origin[:8]},
        level="warn",
    )

    # ── 소스 하드코딩 (런타임 코드만) ────────────────────────────────────
    src_hits = []
    for f in list((ROOT / "src").rglob("*")):
        if f.is_file() and f.suffix in {".ts", ".tsx", ".astro", ".mjs", ".js", ".json", ".css"}:
            txt = f.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r"byhan2025\.github\.io[^\"'`\s]*", txt):
                src_hits.append({"file": f.relative_to(ROOT).as_posix(), "url": m.group(0)})
    rep.check(
        "src.github_io_refs",
        True,
        {"count": len(src_hits), "refs": src_hits},
        level="warn",
    )

    # ── 사이트맵 ─────────────────────────────────────────────────────────
    sm_index = dist / "sitemap-index.xml"
    rep.check("sitemap.index_exists", sm_index.is_file(), {"path": str(sm_index)})
    sitemap_urls: list[str] = []
    if sm_index.is_file():
        try:
            tree = ET.parse(sm_index)
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            for loc in tree.getroot().findall(".//s:sitemap/s:loc", ns):
                child = loc.text.strip()
                rep.check("sitemap.index_absolute", child.startswith(site + prefix + "/"), {"loc": child})
                child_file = dist / unquote(urlparse(child).path).lstrip("/")
                if prefix and not child_file.is_file():
                    child_file = dist / unquote(urlparse(child).path).lstrip("/")[len(prefix.lstrip("/")) + 1 :]
                rep.check("sitemap.index_child_exists", child_file.is_file(), {"file": str(child_file)})
                if child_file.is_file():
                    try:
                        ctree = ET.parse(child_file)
                        for l in ctree.getroot().findall(".//s:url/s:loc", ns):
                            sitemap_urls.append(l.text.strip())
                    except ET.ParseError as exc:
                        rep.check("sitemap.child_parse", False, {"file": str(child_file), "error": str(exc)})
        except ET.ParseError as exc:
            rep.check("sitemap.index_parse", False, str(exc))

    loc_bad = [u for u in sitemap_urls if not u.startswith(site + prefix + "/")]
    rep.check("sitemap.all_absolute", not loc_bad, {"bad": loc_bad[:5]})
    rep.check("sitemap.not_empty", len(sitemap_urls) >= 20, {"count": len(sitemap_urls)})

    missing_files = []
    for u in sitemap_urls:
        rel = unquote(urlparse(u).path)
        if prefix:
            rel = rel[len(prefix) :] if rel.startswith(prefix) else rel
        rel = rel.lstrip("/")
        cand = [dist / rel, dist / rel / "index.html"]
        if not any(c.is_file() for c in cand):
            missing_files.append(u)
    rep.check("sitemap.targets_exist", not missing_files, {"missing": missing_files[:8]})

    sm_norm = {u.rstrip("/") or "/" for u in sitemap_urls}
    canon_norm = {u.rstrip("/") or "/" for u in indexable}
    not_in_sm = sorted(canon_norm - sm_norm)
    forbidden = [u for u in sitemap_urls if any(u.endswith(p) or p in u for p in SITEMAP_FORBIDDEN)]
    rep.check("sitemap.covers_indexable", not not_in_sm, {"missing": not_in_sm[:10]})
    rep.check("sitemap.excludes_noindex", not forbidden, {"forbidden": forbidden[:10]})
    rep.check(
        "sitemap.noindex_overlap",
        not ({u.rstrip("/") for u in noindex_pages} & sm_norm),
        {"overlap": sorted({u.rstrip("/") for u in noindex_pages} & sm_norm)[:10]},
    )

    # ── robots.txt ───────────────────────────────────────────────────────
    robots_file = dist / "robots.txt"
    rep.check("robots.exists", robots_file.is_file(), None)
    robots_txt = robots_file.read_text(encoding="utf-8") if robots_file.is_file() else ""
    rep.check("robots.allow_root", "Allow: /" in robots_txt, None)
    rep.check(
        "robots.sitemap_line",
        f"Sitemap: {site}{prefix}/sitemap-index.xml" in robots_txt,
        {"line": [l for l in robots_txt.splitlines() if l.lower().startswith("sitemap")]},
    )
    rep.check("robots.disallow_search_index", "Disallow: " + prefix + "/search-index.json" in robots_txt, None)

    # ── RSS ──────────────────────────────────────────────────────────────
    rss_file = dist / "rss.xml"
    rss_items = 0
    if rss_file.is_file():
        raw = rss_file.read_text(encoding="utf-8", errors="replace")
        try:
            rtree = ET.fromstring(raw)
            items = rtree.findall("./channel/item")
            rss_items = len(items)
            bad_links = []
            bad_guid = []
            for it in items:
                link = (it.findtext("link") or "").strip()
                guid = (it.findtext("guid") or "").strip()
                if not link.startswith(site + prefix + "/"):
                    bad_links.append(link)
                if guid != link:
                    bad_guid.append({"link": link, "guid": guid})
                if link.rstrip("/") not in canon_norm and link not in canon_norm:
                    bad_links.append(link)
            chan_link = (rtree.findtext("./channel/link") or "").strip()
            rep.check("rss.parse", True, {"items": rss_items})
            rep.check("rss.links_absolute", not bad_links, {"bad": bad_links[:5]})
            rep.check("rss.guid_equals_link", not bad_guid, {"bad": bad_guid[:5]})
            rep.check("rss.channel_link", chan_link.startswith(site + prefix), {"link": chan_link})
            rep.check("rss.items", rss_items >= 5, {"items": rss_items})
            # 서브패스 빌드는 접두가 남는 게 정상이다 — 도메인 루트 빌드에서만 검사한다
            rep.check("rss.no_subpath_leftover", (prefix != "") or ("/buffetkimz-web" not in raw), None)
        except ET.ParseError as exc:
            rep.check("rss.parse", False, str(exc))
    else:
        rep.check("rss.exists", False, None)

    # ── 색인 금지 화면 ───────────────────────────────────────────────────
    for u in noindex_pages:
        pass
    must_noindex_missing = []
    for pre in MUST_NOINDEX:
        hit = [p for p in noindex_pages if p.replace(site + prefix, "").startswith(pre)]
        if not hit and pre != "/404" and pre != "/topics/":
            must_noindex_missing.append(pre)
    rep.check("index.noindex_pages_present", not must_noindex_missing, {"missing": must_noindex_missing})

    # ── 광고 자리 ────────────────────────────────────────────────────────
    total_slots = sum(p["ad_slots"] for p in rep.pages)
    if args.mode == "default":
        rep.check("ads.off_by_default", total_slots == 0, {"slots": total_slots})
    else:
        rep.check("ads.preview_slots", total_slots >= MIN_AD_SLOTS, {"slots": total_slots,
                  "pages": {p["file"]: p["ad_slots"] for p in rep.pages if p["ad_slots"]}})

    # ── OG 기본 이미지 ───────────────────────────────────────────────────
    og = dist / "og.png"
    size = png_size(og) if og.is_file() else None
    rep.check("og.default_image", size == OG_DEFAULT, {"size": size})

    # ── JSON-LD 안의 자사 주소가 canonical 집합에 있는지 ──────────────────
    own_paths: set[str] = set()
    for u in canonical_set:
        pth = unquote(urlparse(u).path)
        if prefix and pth.startswith(prefix):
            pth = pth[len(prefix) :]
        own_paths.add(pth.rstrip("/") or "/")
    ld_url_bad = []
    for f in pages:
        rel = f.relative_to(dist)
        raw = f.read_text(encoding="utf-8", errors="replace")
        doc = lxml_html.fromstring(raw)
        lds, _ = jsonld_blocks(doc)
        for b in lds:
            urls: set[str] = set()
            collect_urls(b, urls)
            for u in urls:
                if not u.startswith(site + prefix + "/"):
                    continue
                tail = unquote(urlparse(u).path)
                if urlparse(u).fragment:
                    # `#website`·`#author` 같은 노드 식별자는 페이지가 아니다
                    continue
                key = tail.rstrip("/") or "/"
                if prefix:
                    key = key[len(prefix) :] if key.startswith(prefix) else key
                    key = key or "/"
                if key not in own_paths and u not in canonical_set:
                    # 이미지 파일은 페이지가 아니므로 예외
                    f_rel = key.lstrip("/")
                    if not (dist / f_rel).is_file():
                        ld_url_bad.append({"file": rel.as_posix(), "url": u})
    rep.check("jsonld.own_urls_known", not ld_url_bad, {"bad": ld_url_bad[:10]})

    # ── 결과 저장 ────────────────────────────────────────────────────────
    summary = {
        "mode": args.mode,
        "dist": str(dist),
        "site": site,
        "base": base,
        "pages_total": len(pages),
        "indexable": len(indexable),
        "noindex": len(noindex_pages),
        "redirect": len(redirect_pages),
        "sitemap_urls": len(sitemap_urls),
        "rss_items": rss_items,
        "ad_slots": total_slots,
        "checks_total": len(rep.checks),
        "checks_pass": sum(1 for c in rep.checks if c["state"] == "pass"),
        "checks_fail": len(rep.failures),
        "checks_warn": len(rep.warnings),
        "result": "PASS" if not rep.failures else "FAIL",
    }
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {"summary": summary, "failures": rep.failures, "warnings": rep.warnings,
             "checks": rep.checks, "pages": rep.pages},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if not args.quiet:
        print(f"[{summary['result']}] {args.mode} · {len(pages)} pages · {summary['checks_pass']}/{len(rep.checks)} pass")
        if rep.failures:
            seen = {}
            for c in rep.failures:
                key = c["id"].split(":")[0]
                seen.setdefault(key, []).append(c)
            for key, items in seen.items():
                print(f"  ✗ {key}: {len(items)}건 — {json.dumps(items[0]['detail'], ensure_ascii=False)[:180]}")
        if rep.warnings:
            print(f"  ! 경고 {len(rep.warnings)}건")
        print(f"  → {out}")
    return 0 if not rep.failures else 1


if __name__ == "__main__":
    sys.exit(main())
