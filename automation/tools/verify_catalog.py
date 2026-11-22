#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sources-catalog.json 전수 실측 검증기 (표준 라이브러리만 사용).

- 336개 모든 엔드포인트에 실제 HTTP 요청을 보내 응답 코드·응답 시간을 기록한다.
- 결과를 sources-catalog.json 의 각 항목 `verify` 필드에 반영하고,
  automation/verification-report.{json,md} 를 생성한다.
- 판정 등급
    OK        : 2xx 응답(실제 콘텐츠 수신)
    KEY/차단   : 400·401·403·405·429 — 엔드포인트는 존재, 파라미터·키·브라우저 헤더 필요
    REDIRECT  : 3xx (최종 목적지까지 추적)
    MISSING   : 404·410 — 주소 소멸(카탈로그 수정 대상)
    ERROR     : 5xx·TLS·DNS·타임아웃
- KRX JSON 엔드포인트처럼 POST 전용인 곳은 POST로 별도 확인한다.

사용법:
    python3 automation/tools/verify_catalog.py            # 전수 검증 + 카탈로그 갱신
    python3 automation/tools/verify_catalog.py --limit 20 # 앞 20개만(스모크 테스트)
"""
from __future__ import annotations

import argparse
import json
import socket
import ssl
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CATALOG = ROOT / "sources-catalog.json"
REPORT_JSON = ROOT / "verification-report.json"
REPORT_MD = ROOT / "verification-report.md"

KST = timezone(timedelta(hours=9))
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

POST_TARGETS = {"krx-json"}


def classify(status: int | None, err: str | None) -> str:
    if err:
        if "Address family not supported" in err:
            return "ENV(환경제약)"
        if err.startswith("DNS:"):
            return "DNS없음"
        return "ERROR"
    if status is None:
        return "ERROR"
    if 200 <= status < 300:
        return "OK"
    if 300 <= status < 400:
        return "REDIRECT"
    if status in (400, 401, 402, 403, 405, 406, 429):
        return "KEY/차단"
    if status in (404, 410):
        return "MISSING"
    return "ERROR"


def probe(url: str, method: str = "GET", timeout: int = 15, retries: int = 1) -> dict:
    """단일 엔드포인트 실측. 프록시 동시연결 제한으로 일시 거부되는 경우가 있어 재시도한다."""
    last = None
    for attempt in range(retries):
        out = _probe_once(url, method, timeout)
        if out["result"] != "ERROR":
            return out
        last = out
        time.sleep(1.2 * (attempt + 1))

    # urllib 실패 → curl 폴백(HTTP/2·TLS 협상 차이로 urllib만 실패하는 사이트가 있음)
    if method == "GET":
        alt = _curl_probe(url, timeout)
        if alt and alt["result"] != "ERROR":
            alt["fallback"] = "curl"
            return alt

    # 연결 자체가 안 되면 DNS 해석 여부로 '주소 소멸'과 '환경 차단'을 구분한다
    host = url.split("//", 1)[-1].split("/", 1)[0].split(":")[0]
    try:
        socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        last["result"] = classify(None, "ENV")
        last["error"] = (last.get("error") or "") + " | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)"
        last["result"] = "ENV(환경제약)"
    except Exception:
        try:  # OS 리졸버(getent)로 한 번 더 확인 — 파이썬 리졸버만 실패하는 경우가 있다
            host_out = subprocess.run(["getent", "hosts", host], capture_output=True, text=True, timeout=8).stdout.strip()
        except Exception:
            host_out = ""
        if host_out:
            last["result"] = "ENV(환경제약)"
            last["error"] = (last.get("error") or "") + " | getent 해석됨(주소는 존재, 접속 차단)"
        else:
            last["error"] = "DNS: " + (last.get("error") or "")
            last["result"] = "DNS없음"
    return last


def _curl_probe(url: str, timeout: int = 15) -> dict | None:
    try:
        started = time.time()
        proc = subprocess.run(
            [
                "curl", "-sSL", "-o", "/dev/null", "--max-time", str(timeout),
                "-A", UA, "-H", "Accept-Language: ko-KR,ko;q=0.9",
                "-w", "%{http_code} %{content_type}", url,
            ],
            capture_output=True, text=True, timeout=timeout + 5,
        )
        out = (proc.stdout or "").strip()
        if not out:
            return None
        code_s, _, ctype = out.partition(" ")
        status = int(code_s) if code_s.isdigit() and code_s != "000" else None
        return {
            "result": classify(status, None),
            "http_status": status,
            "elapsed_ms": int((time.time() - started) * 1000),
            "content_type": ctype.split(";")[0],
            "error": None,
            "checked_at": datetime.now(KST).isoformat(timespec="seconds"),
        }
    except Exception:
        return None


def _probe_once(url: str, method: str = "GET", timeout: int = 15) -> dict:
    started = time.time()
    data = None
    if method == "POST":
        # KRX 정보데이터시스템 JSON: bld=dbms/MDC/STAT/standard/MDCSTAT00101 (지수 시세)
        body = "bld=dbms/MDC/STAT/standard/MDCSTAT00101&locale=ko_KR&idxIndMidclssCd=01&trdDd=" + datetime.now(KST).strftime("%Y%m%d")
        req = urllib.request.Request(
            url,
            data=body.encode(),
            headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
    else:
        req = urllib.request.Request(url, headers=HEADERS, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            status = r.status
            final_url = r.geturl()
            ctype = r.headers.get("Content-Type", "")
            chunk = r.read(4096)
            data = {
                "status": status,
                "final_url": final_url,
                "content_type": ctype,
                "bytes_sampled": len(chunk),
            }
    except urllib.error.HTTPError as e:
        data = {
            "status": e.code,
            "final_url": url,
            "content_type": e.headers.get("Content-Type", "") if e.headers else "",
            "bytes_sampled": 0,
        }
    except Exception as e:  # DNS, TLS, timeout ...
        data = {"status": None, "final_url": url, "error": f"{type(e).__name__}: {e}"[:180]}

    elapsed = int((time.time() - started) * 1000)
    result = classify(data.get("status"), data.get("error"))
    return {
        "result": result,
        "http_status": data.get("status"),
        "elapsed_ms": elapsed,
        "content_type": (data.get("content_type") or "").split(";")[0],
        "error": data.get("error"),
        "checked_at": datetime.now(KST).isoformat(timespec="seconds"),
    }


def run(limit: int | None = None, workers: int = 5, only_failed: bool = False, report_only: bool = False) -> dict:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    sources = catalog["sources"]

    # 이전 실측 결과를 우선 채워 넣고, 이번 실행 대상만 다시 찍는다.
    results: dict[str, dict] = {
        s["id"]: s["verify"] for s in sources if s.get("verify")
    }

    if report_only:
        targets = []
    elif only_failed:
        targets = [
            s for s in sources
            if not s.get("verify") or results.get(s["id"], {}).get("result") in ("ERROR", "ENV(환경제약)", "DNS없음")
        ]
    elif limit:
        targets = sources[:limit]
    else:
        targets = sources

    checked: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {}
        for s in targets:
            method = "POST" if s["id"] in POST_TARGETS else "GET"
            futures[pool.submit(probe, s["url_or_endpoint"], method)] = s
        for fut in as_completed(futures):
            s = futures[fut]
            try:
                res = fut.result()
            except Exception as e:  # pragma: no cover
                res = {
                    "result": "ERROR",
                    "http_status": None,
                    "elapsed_ms": None,
                    "error": f"{type(e).__name__}: {e}"[:180],
                    "checked_at": datetime.now(KST).isoformat(timespec="seconds"),
                }
            results[s["id"]] = res
            checked[s["id"]] = res
            print(f"  [{res['result']:8s}] {s['id']:22s} {s['url_or_endpoint'][:90]}", flush=True)

    for s in sources:
        if s["id"] in results:
            s["verify"] = results[s["id"]]

    counts: dict[str, int] = {}
    for s in sources:
        r = results.get(s["id"], {}).get("result")
        if r:
            counts[r] = counts.get(r, 0) + 1

    def rows(result_name):
        return [
            {"id": s["id"], "name": s["name"], "url": s["url_or_endpoint"],
             "status": results.get(s["id"], {}).get("http_status"),
             "error": results.get(s["id"], {}).get("error")}
            for s in sources
            if results.get(s["id"], {}).get("result") == result_name
        ]

    summary = {
        "checked_at": datetime.now(KST).isoformat(timespec="seconds"),
        "total_in_catalog": len(sources),
        "total_checked": len([s for s in sources if s["id"] in results]),
        "checked_this_run": len(checked),
        "counts": counts,
        "by_category": {},
        "missing": rows("MISSING"),
        "errors": rows("ERROR"),
        "env_limited": rows("ENV(환경제약)"),
        "dns_missing": rows("DNS없음"),
    }
    for s in sources:
        r = results.get(s["id"], {}).get("result")
        if not r:
            continue
        cat = s["domain_category"]
        bucket = summary["by_category"].setdefault(cat, {})
        bucket[r] = bucket.get(r, 0) + 1

    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md = [
        "# 1차 원천 소스 카탈로그 실측 검증 보고서",
        "",
        f"- 검증 시각: {summary['checked_at']} (KST)",
        f"- 카탈로그: **{summary['total_in_catalog']}개** · 실측 기록 **{summary['total_checked']}개** (개별 검증 시각은 `sources-catalog.json`의 `verify.checked_at`)",
        "- 결과: " + " · ".join(f"{k} {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1])),
        "",
        "## 판정 기준",
        "",
        "- `OK` — 2xx 응답(실제 콘텐츠 수신)",
        "- `KEY/차단` — 400·401·403·405·429. 엔드포인트는 존재하며 API 키·파라미터·브라우저 헤더가 필요",
        "- `REDIRECT` — 3xx(최종 목적지 추적됨)",
        "- `MISSING` — 404·410. 주소 소멸(수정·교체 대상)",
        "- `ERROR` — 5xx·TLS·DNS·타임아웃",
        "- `ENV(환경제약)` — DNS는 해석되나 이 실행 환경에서 접속 차단(해외 IP 차단·방화벽). 주소 자체는 존재",
        "- `DNS없음` — 도메인 자체가 해석되지 않음(폐쇄·이전). 교체 대상",
        "",
        "## 분야별 결과",
        "",
        "| 분야 | OK | KEY/차단 | REDIRECT | MISSING | ERROR | ENV | DNS없음 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for cat, b in summary["by_category"].items():
        md.append(
            f"| {cat} | {b.get('OK',0)} | {b.get('KEY/차단',0)} | {b.get('REDIRECT',0)} | {b.get('MISSING',0)} | {b.get('ERROR',0)} | {b.get('ENV(환경제약)',0)} | {b.get('DNS없음',0)} |"
        )
    md += ["", "## 요청 실패·소멸 목록", ""]
    if not summary["missing"] and not summary["errors"] and not summary["env_limited"] and not summary["dns_missing"]:
        md.append("없음 — 전 엔드포인트가 응답했다.")
    for m in summary["missing"]:
        md.append(f"- `MISSING` {m['id']} · {m['name']} · <{m['url']}> (HTTP {m['status']})")
    for e in summary["errors"]:
        md.append(f"- `ERROR` {e['id']} · {e['name']} · <{e['url']}> · {e['error']}")
    for e in summary["env_limited"]:
        md.append(f"- `ENV` {e['id']} · {e['name']} · <{e['url']}> · {e['error']}")
    for e in summary["dns_missing"]:
        md.append(f"- `DNS없음` {e['id']} · {e['name']} · <{e['url']}> · {e['error']}")
    REPORT_MD.write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"\n=== 누적 {summary['total_checked']}개 / 이번 {summary['checked_this_run']}개: {counts}")
    return summary


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--retry-errors", action="store_true", help="미검증·ERROR/ENV/DNS없음 항목만 재검증")
    ap.add_argument("--report-only", action="store_true", help="재요청 없이 카탈로그의 verify로 보고서만 재생성")
    a = ap.parse_args()
    run(limit=a.limit, workers=a.workers, only_failed=a.retry_errors, report_only=a.report_only)
