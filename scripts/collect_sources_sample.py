#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""buffetkimz.com 1차 소스 수집기 — 프로토타입(표준 라이브러리만 사용).

automation/sources-catalog.json 의 RSS·공개 API 엔드포인트 중 실제로 응답하는
15개 피드에서 '오늘 기준 신선한' 아이템(제목·발표일·URL·요약)을 모아 JSON으로 저장한다.

- 뉴스 요약 재탕이 아니라, 중앙은행·통계기관·공시·연구 논문·오픈소스 원문을 직접 읽는다.
- API 키가 필요한 곳(ECOS·KOSIS·DART·FRED·EIA 등)은 이 프로토타입에서 제외한다.
  (파이프라인 1단계 정식 운영 시 환경변수로 키를 주입한다.)
- 실패한 피드는 건너뛰고, 성공/실패를 모두 기록한다(폴백 규칙: 부분 실패해도 나머지로 진행).

사용법:
    python3 scripts/collect_sources_sample.py                # 기본 3일 창
    python3 scripts/collect_sources_sample.py --days 1 --limit 15
    python3 scripts/collect_sources_sample.py --out automation/output/sample.json
"""
from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # apps/buffetkimz-web
CATALOG = ROOT / "automation" / "sources-catalog.json"
OUT_DIR = ROOT / "automation" / "output"

KST = timezone(timedelta(hours=9))
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "application/rss+xml, application/atom+xml, application/json, text/html;q=0.8, */*;q=0.5",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# 프로토타입에서 실제로 읽을 피드(카탈로그 name 기준). 키 불필요·공개 엔드포인트만.
SAMPLE_NAMES = [
    "미국 연준 보도자료 RSS",
    "CNBC 최신뉴스 RSS",
    "MarketWatch Top Stories RSS",
    "TechCrunch AI RSS",
    "Google AI 블로그 RSS",
    "Microsoft Research 블로그 RSS",
    "Hugging Face 블로그 RSS",
    "OpenAI 뉴스 RSS",
    "Cloudflare 블로그 RSS",
    "연합뉴스 RSS",
    "매일경제 RSS",
    "지식인사이드 RSS",
    "박종훈의 지식한방 RSS",
    "박곰희TV RSS",
    "arXiv API(cs.AI)",
    "Hacker News API",
    "Hugging Face 모델 API",
    "GitHub 저장소 검색 API",
    # 참고: BLS RSS(bls.gov)와 한국경제 RSS는 해외 IP/Cloudflare 차단으로 이 환경에서 실패한다.
    #       파이프라인 1단계는 실패 시 다음 소스로 넘어가는 폴백 규칙으로 처리한다.
]

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean(text: str | None, limit: int = 320) -> str:
    if not text:
        return ""
    text = html.unescape(TAG_RE.sub(" ", text))
    text = WS_RE.sub(" ", text).strip()
    return text[:limit]


def fetch(url: str, timeout: int = 20, retries: int = 2) -> bytes:
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.0 * (attempt + 1))
    # urllib이 403 등으로 막히는 피드는 curl로 한 번 더 시도(한국경제 등)
    try:
        proc = subprocess.run(
            ["curl", "-sSL", "--max-time", str(timeout), "-A", UA, "-H", "Accept-Language: ko-KR,ko;q=0.9", url],
            capture_output=True, timeout=timeout + 5,
        )
        body = proc.stdout or b""
        if proc.returncode == 0 and body[:200].lstrip().startswith((b"<?xml", b"<rss", b"{")):
            return body
    except Exception:
        pass
    raise last  # type: ignore[misc]


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    try:  # RFC 822 (RSS pubDate)
        dt = parsedate_to_datetime(value)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    try:  # 2026-11-21 (yyyy-mm-dd)
        dt = datetime.strptime(value[:10], "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def parse_xml_lenient(raw: bytes) -> ET.Element:
    """XML 선언 인코딩(euc-kr 등)과 이스케이프 안 된 & 를 보정해 파싱한다."""
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        pass
    enc = "utf-8"
    m = re.search(rb'encoding=["\']([A-Za-z0-9_-]+)["\']', raw[:200])
    if m:
        enc = m.group(1).decode("ascii", "ignore").lower()
    if enc in ("euc-kr", "cp949", "ks_c_5601-1987"):
        enc = "cp949"
    try:
        text = raw.decode(enc, "replace")
    except LookupError:
        text = raw.decode("utf-8", "replace")
    text = re.sub(r"&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)", "&amp;", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return ET.fromstring(text.encode("utf-8"))


def parse_feed(raw: bytes, method: str) -> list[dict]:
    """RSS 2.0 / Atom 을 모두 처리한다."""
    root = parse_xml_lenient(raw)
    items: list[dict] = []

    def text_of(el, *names):
        for n in names:
            found = el.find(n)
            if found is not None and (found.text or "").strip():
                return found.text.strip()
        return None

    # RSS
    for item in root.iter("item"):
        link = text_of(item, "link") or text_of(item, "guid")
        items.append(
            {
                "title": clean(text_of(item, "title")),
                "url": (link or "").strip(),
                "published": text_of(item, "pubDate", "date"),
                "summary": clean(text_of(item, "description") or text_of(item, "{http://purl.org/rss/1.0/modules/content/}encoded")),
            }
        )
    # Atom
    if not items:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall("a:entry", ns):
            link_el = entry.find("a:link", ns)
            href = link_el.get("href") if link_el is not None else ""
            items.append(
                {
                    "title": clean(entry.findtext("a:title", default="", namespaces=ns)),
                    "url": href,
                    "published": entry.findtext("a:published", default="", namespaces=ns)
                    or entry.findtext("a:updated", default="", namespaces=ns),
                    "summary": clean(entry.findtext("a:summary", default="", namespaces=ns)),
                }
            )
    return [i for i in items if i["title"] and i["url"]]


def handle_json_api(name: str) -> list[dict]:
    """키 없이 쓰는 공개 JSON API 3종."""
    out: list[dict] = []
    if name == "Hacker News API":
        ids = json.loads(fetch("https://hacker-news.firebaseio.com/v0/topstories.json"))[:10]
        for i in ids[:8]:
            d = json.loads(fetch(f"https://hacker-news.firebaseio.com/v0/item/{i}.json"))
            if not d or d.get("type") != "story":
                continue
            out.append(
                {
                    "title": clean(d.get("title")),
                    "url": d.get("url") or f"https://news.ycombinator.com/item?id={i}",
                    "published": datetime.fromtimestamp(d.get("time", 0), timezone.utc).isoformat(),
                    "summary": clean(f"score {d.get('score')} · comments {d.get('descendants')}"),
                }
            )
    elif name == "Hugging Face 모델 API":
        models = json.loads(fetch("https://huggingface.co/api/models?sort=trendingScore&limit=12"))
        for m in models[:8]:
            out.append(
                {
                    "title": clean(m.get("id")),
                    "url": f"https://huggingface.co/{m.get('id')}",
                    "published": m.get("createdAt"),
                    "summary": clean(f"downloads {m.get('downloads')} · likes {m.get('likes')} · pipeline {m.get('pipeline_tag')}"),
                }
            )
    elif name == "GitHub 저장소 검색 API":
        since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        data = json.loads(
            fetch(f"https://api.github.com/search/repositories?q=stars:%3E500+pushed:%3E{since}&sort=updated&per_page=10")
        )
        for r in data.get("items", [])[:8]:
            out.append(
                {
                    "title": clean(f"{r.get('full_name')} ★{r.get('stargazers_count')}"),
                    "url": r.get("html_url"),
                    "published": r.get("pushed_at"),
                    "summary": clean(r.get("description")),
                }
            )
    return out


def collect_one(source: dict, days: int) -> dict:
    name = source["name"]
    url = source["url_or_endpoint"]
    started = time.time()
    try:
        if name in ("Hacker News API", "Hugging Face 모델 API", "GitHub 저장소 검색 API"):
            raw_items = handle_json_api(name)
        else:
            raw_items = parse_feed(fetch(url), source["fetch_method"])

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        fresh, undated = [], []
        for it in raw_items:
            dt = parse_date(it.get("published"))
            it["published_iso"] = dt.isoformat() if dt else None
            it["source_id"] = source["id"]
            it["source_name"] = name
            it["domain_category"] = source["domain_category"]
            if dt is None:
                undated.append(it)
            elif dt >= cutoff:
                fresh.append(it)

        # 신선한 항목이 없으면 최신 1건을 '지연' 표시로 남긴다(발표 주기가 긴 기관 피드 대응)
        picked = fresh[:6]
        stale_latest = None
        if not picked:
            dated = [it for it in raw_items if it.get("published_iso")]
            if dated:
                dated.sort(key=lambda x: x["published_iso"], reverse=True)
                stale_latest = dated[0]
                stale_latest["stale"] = True

        return {
            "source_id": source["id"],
            "source_name": name,
            "category": source["domain_category"],
            "method": source["fetch_method"],
            "url": url,
            "ok": True,
            "elapsed_ms": int((time.time() - started) * 1000),
            "total_items": len(raw_items),
            "fresh_items": len(fresh),
            "items": picked + ([stale_latest] if stale_latest else []),
        }
    except Exception as e:  # noqa: BLE001
        return {
            "source_id": source["id"],
            "source_name": name,
            "category": source["domain_category"],
            "method": source["fetch_method"],
            "url": url,
            "ok": False,
            "elapsed_ms": int((time.time() - started) * 1000),
            "error": f"{type(e).__name__}: {e}"[:200],
            "items": [],
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3, help="신선도 창(일). 기본 3")
    ap.add_argument("--limit", type=int, default=15, help="시도할 피드 수 상한. 기본 15")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_name = {s["name"]: s for s in catalog["sources"]}

    selected = []
    for n in SAMPLE_NAMES:
        if n in by_name and len(selected) < args.limit:
            selected.append(by_name[n])
    if len(selected) < args.limit:  # 카탈로그 이름이 바뀌어도 RSS 후보로 채운다
        for s in catalog["sources"]:
            if len(selected) >= args.limit:
                break
            if s["fetch_method"] in ("RSS", "API") and s not in selected:
                v = (s.get("verify") or {}).get("result")
                if v in ("OK", "KEY/차단"):
                    selected.append(s)

    print(f"[1단계 수집] 카탈로그 {len(catalog['sources'])}개 중 {len(selected)}개 피드 시도 (신선도 {args.days}일)\n")

    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(collect_one, s, args.days): s for s in selected}
        for fut in as_completed(futures):
            r = fut.result()
            results.append(r)
            if r["ok"]:
                print(f"  OK   {r['source_name'][:28]:30s} {r['fresh_items']:2d}건 신선 / {r['total_items']:3d}건 수집 ({r['elapsed_ms']}ms)")
            else:
                print(f"  FAIL {r['source_name'][:28]:30s} {r['error']}")

    results.sort(key=lambda r: (not r["ok"], r["source_id"]))
    all_items = []
    for r in results:
        all_items.extend(r["items"])

    now = datetime.now(KST)
    payload = {
        "generated_at": now.isoformat(timespec="seconds"),
        "generator": "scripts/collect_sources_sample.py",
        "catalog": str(CATALOG.relative_to(ROOT)),
        "freshness_window_days": args.days,
        "sources_selected": len(selected),
        "sources_ok": sum(1 for r in results if r["ok"]),
        "sources_failed": sum(1 for r in results if not r["ok"]),
        "items_total": len(all_items),
        "items_fresh": sum(1 for i in all_items if not i.get("stale")),
        "sources": results,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else OUT_DIR / f"collected-{now.strftime('%Y%m%d-%H%M')}.json"
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 사람이 읽는 요약(파이프라인 2단계 필터 입력용)
    md_path = out_path.with_suffix(".md")
    md = [f"# 1차 소스 수집 결과 — {now.strftime('%Y-%m-%d %H:%M KST')}", ""]
    md.append(f"- 시도 {payload['sources_selected']}개 · 성공 {payload['sources_ok']}개 · 실패 {payload['sources_failed']}개")
    md.append(f"- 신선 항목 {payload['items_fresh']}건 / 전체 {payload['items_total']}건 (창 {args.days}일)")
    md.append("")
    for r in results:
        if not r["ok"]:
            md.append(f"## ✗ {r['source_name']} — 실패: {r['error']}")
            continue
        md.append(f"## ✓ {r['source_name']} ({r['fresh_items']}건 신선 / {r['total_items']}건)")
        for it in r["items"]:
            flag = " (지연)" if it.get("stale") else ""
            date = (it.get("published_iso") or "")[:10]
            md.append(f"- `{date}`{flag} [{clean(it['title'], 120)}]({it['url']}) — {it.get('summary','')[:160]}")
        md.append("")
    md_path.write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"\n[결과] 성공 {payload['sources_ok']}/{payload['sources_selected']} · 신선 {payload['items_fresh']}건 / 전체 {payload['items_total']}건")

    def shown(p: Path) -> str:
        """저장소 밖 절대경로(--out /tmp/...)일 때 relative_to가 ValueError를 내지 않게 한다."""
        try:
            return str(p.relative_to(ROOT))
        except ValueError:
            return str(p)

    print(f"  -> {shown(out_path)}")
    print(f"  -> {shown(md_path)}")
    return 0 if payload["sources_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
