#!/usr/bin/env python3
"""S1 수집 실패율 판정기 — 수집기의 종료코드를 믿지 않기 위한 게이트.

리허설(reports/buffetkimz-web/automation-rehearsal-20261122.md §3) 실측:
  · `collect_sources_sample.py`는 부분 실패에도 exit 0을 낸다(성공 1건 이상이면 0).
    그래서 스케줄이 종료코드로 성공 판정을 하면 실패율 33%를 보지 못한다(조용히 누적).
  · `--limit 30`은 키 필요 API(ECOS·KOSIS·DART·FRED·EIA·SEC·KRX 등)를 끌어와
    실제로는 '키 없음'인 실패를 파싱 오류처럼 세어 30% 경보를 매일 띄운다.
    (원칙 ⑤: 키 없는 API는 따로 분리해 오탐 경보를 없앤다.)

그래서 이 스크립트는 최신 수집 JSON을 읽어
  1) 키 없음으로 보이는 소스를 `skipped_no_key`로 분리하고,
  2) 분리 후 실패율을 계산해
  3) 임계(기본 30%) 이상이면 exit 1로 파이프라인을 멈춘다.

사용법
  python3 scripts/check_collect_failure_rate.py                     # 최신 collected-*.json 자동 선택
  python3 scripts/check_collect_failure_rate.py --path automation/output/collected-20261123-0501.json
  python3 scripts/check_collect_failure_rate.py --threshold 0.3 --json
  python3 scripts/check_collect_failure_rate.py --quiet              # 판정만(성공 시 침묵)

종료 코드: 0 정상 · 1 실패율 초과 · 2 산출물 없음/형식 오류
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "automation" / "output"

# 키가 없어서 실패하는 소스의 이름·오류 신호. 카탈로그의 API 소스들이 여기에 걸린다.
KEY_SOURCE_HINTS = (
    "ECOS", "한국은행", "KOSIS", "통계청", "DART", "전자공시", "FRED", "EIA",
    "SEC", "KRX", "한국거래소", "국토부", "실거래가", "공공데이터", "data.go.kr",
)
KEY_ERROR_HINTS = ("401", "403", "key", "apikey", "api key", "인증", "unauthorized", "forbidden", "servicekey")


def looks_key_missing(source: dict) -> bool:
    name = str(source.get("source_name", ""))
    error = str(source.get("error", "")).lower()
    if any(hint.lower() in error for hint in KEY_ERROR_HINTS):
        return True
    return any(hint.lower() in name.lower() for hint in KEY_SOURCE_HINTS)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="S1 수집 실패율 판정(키 없음 분리)")
    ap.add_argument("--path", help="collected-*.json 경로(기본: automation/output의 최신 파일)")
    ap.add_argument("--threshold", type=float, default=0.30, help="실패율 경보선(기본 0.30)")
    ap.add_argument("--json", action="store_true", help="기계용 JSON 출력")
    ap.add_argument("--quiet", action="store_true", help="성공 시 아무것도 출력하지 않는다")
    args = ap.parse_args(argv)

    if args.path:
        path = Path(args.path)
        if not path.is_absolute():
            path = (Path.cwd() / path) if (Path.cwd() / path).exists() else (ROOT / path)
    else:
        found = sorted(glob.glob(str(OUT_DIR / "collected-*.json")))
        if not found:
            print(f"✗ 수집 산출물이 없습니다: {OUT_DIR}/collected-*.json", file=sys.stderr)
            return 2
        path = Path(found[-1])

    if not path.exists():
        print(f"✗ 수집 산출물이 없습니다: {path}", file=sys.stderr)
        return 2
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        print(f"✗ 수집 JSON을 읽지 못했습니다({path}): {exc}", file=sys.stderr)
        return 2

    sources = data.get("sources") or []
    failed = [s for s in sources if not s.get("ok")]
    no_key = [s for s in failed if looks_key_missing(s)]
    real_failed = [s for s in failed if not looks_key_missing(s)]
    selected = int(data.get("sources_selected", len(sources)))
    ok = int(data.get("sources_ok", selected - len(failed)))
    counted = max(1, selected - len(no_key))
    rate = len(real_failed) / counted
    verdict = "fail" if rate >= args.threshold else "pass"

    payload = {
        "path": str(path),
        "generated_at": data.get("generated_at"),
        "selected": selected,
        "ok": ok,
        "failed": len(failed),
        "skipped_no_key": [s.get("source_name") for s in no_key],
        "failed_real": [{"name": s.get("source_name"), "error": str(s.get("error", ""))[:120]} for s in real_failed],
        "counted_sources": counted,
        "failure_rate": round(rate, 4),
        "threshold": args.threshold,
        "fresh_items": data.get("items_fresh"),
        "items_total": data.get("items_total"),
        "verdict": verdict,
    }

    if not args.quiet or verdict == "fail":
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(f"■ S1 수집 판정 — {path}")
            print(f"   시도 {selected} · 성공 {ok} · 실패 {len(failed)}"
                  f"(키 없음 {len(no_key)} 제외) · 실패율 {rate:.1%} (경보선 {args.threshold:.0%})")
            print(f"   신선 항목 {data.get('items_fresh')}건 / 전체 {data.get('items_total')}건")
            for s in no_key:
                print(f"   · skipped_no_key: {s.get('source_name')}")
            for s in real_failed:
                print(f"   ✗ {s.get('source_name')} — {str(s.get('error', ''))[:100]}")
            print("   판정: " + ("통과 — S2로 넘긴다" if verdict == "pass" else "초과 — 4~5단계를 중단하고 notes.md에 사유를 남긴다"))

    return 0 if verdict == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
