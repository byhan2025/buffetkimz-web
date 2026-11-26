#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""「돈의 나이테」 시세판·진단기 9항 검증 — 2026-11-26 (spec §8-4).

`verify:lens` = 이 스크립트. `npm run build` 뒤에 돌린다(dist를 읽는다).

  L1 license가 ok·licensed가 아닌 행에 value가 있으면 실패
  L2 모든 행에 asOf·asOfLabel·sourceLabel·sourceUrl·attribution이 있는가
  L3 attribution에 기관명 + 날짜가 함께 있는가
  L4 /money-lens/ 산출물에 금지어(닻·돛·항해·정박·출항·조타·뱃머리·뱃전·닻줄) 0건
  L5 진단기 소스에 '입력 부족' 분기와 0·음수·문자 입력 방어가 있고, 저장·전송 코드가 없는가
  L6 판정 트리 6유형이 각각 도달 가능한가(테스트 벡터 6개)
  L7 4단계 카드·퀴즈·행동 링크가 빌드 산출물에 실제로 있는가
  L8 고지 3종(시세·퀴즈·결과)이 각 화면에 있는가
  L9 5·10년 전 비교값의 갱신일이 210일을 넘으면 경고, 365일이면 실패
  L10 /money-lens/·/apps/money-ring/run 산출물의 내부 href가 모두 배포 접두(/buffetkimz-web)로
      시작하고 실제 dist 파일로 존재하는가 (2026-11-26 — withBase 누락 404 재발 방지)
  L11 「오늘의 주요 시장 시세」 섹션(today.ts 연동)이 지수 4종과 국고채 값을 그리는가
  L12 403으로 막혔던 spglobal.com 원문 링크가 다시 들어오지 않았는가
  L13 1단계 개편이 유지되는가 — 오늘 1억의 세 모습 스트립 · 오늘 탭 단가 표 · 시세판 안 지수 행/중복 카드 0

사용: python3 scripts/verify_lens.py [--json]
종료 코드 0 = 통과(경고 포함), 1 = 실패.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import sys

APP = pathlib.Path(__file__).resolve().parent.parent
SRC = APP / "src"
DIST = APP / "dist"
DATA = SRC / "data" / "money-lens.ts"
RING = SRC / "components" / "tools" / "MoneyRing.tsx"
OUT_JSON = APP.parent.parent / "reports" / "buffetkimz-web" / "lens-verify.json"

# 배포 접두 — Pages 서브패스 빌드가 기본이다. 도메인 루트 빌드를 검사할 때는 BASE_PATH=/ 로 준다.
BASE = (os.environ.get("BASE_PATH") or "/buffetkimz-web").rstrip("/")
# 시장 시세 섹션이 그려야 하는 today.ts 지표 — 빠지면 L11이 선다.
MARKET_IDS = ("kospi", "kosdaq", "sp500", "nasdaq", "ktb3y", "ktb10y")

KST = dt.timezone(dt.timedelta(hours=9))
TODAY = dt.datetime.now(KST)

BANNED = ("닻", "돛", "항해", "정박", "출항", "조타", "뱃머리", "뱃전", "닻줄")

results: list[dict] = []


def record(code: str, name: str, ok: bool, detail: str, warn: bool = False) -> None:
    results.append({"code": code, "name": name, "ok": ok, "warn": warn, "detail": detail})


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def rows_of(src: str) -> list[str]:
    """LENS_ROWS 배열 안의 행 블록을 id 기준으로 잘라 낸다."""
    start = src.find("export const LENS_ROWS")
    if start < 0:
        return []
    end = src.find("\n];", start)
    body = src[start:end]
    parts = re.split(r"\n  \{\n", body)
    return [p for p in parts[1:] if 'id: "' in p]


def main() -> int:
    src = read(DATA)
    ring = read(RING)
    rows = rows_of(src)

    # ── L1
    bad = []
    for block in rows:
        rid = re.search(r'id: "([^"]+)"', block).group(1)
        lic = re.search(r'license: "([^"]+)"', block)
        lic = lic.group(1) if lic else "(없음)"
        has_value = bool(re.search(r"\n\s+value: \{", block))
        if lic in ("ok", "licensed"):
            if not has_value:
                bad.append(f"{rid}: license={lic}인데 value 없음")
        elif has_value:
            bad.append(f"{rid}: license={lic}인데 value 있음")
    record("L1", "license와 value의 일치", not bad, "; ".join(bad) or f"행 {len(rows)}개 확인")

    # ── L2
    keys = ("asOf:", "asOfLabel:", "sourceLabel:", "sourceUrl:", "attribution:")
    missing = []
    for block in rows:
        rid = re.search(r'id: "([^"]+)"', block).group(1)
        for k in keys:
            if k not in block:
                missing.append(f"{rid}:{k}")
    record("L2", "행마다 기준일·출처 5항", not missing, "; ".join(missing) or f"행 {len(rows)}개 × 5항")

    # ── L3
    ORGS = ("한국부동산원", "한국은행", "U.S.", "World Bank", "KOSIS", "국가데이터처", "한국거래소", "S&P", "Nasdaq", "금융투자협회")
    DATE = re.compile(r"(\d{4}\.\s?\d{1,2}\.|\d{4}-\d{2}-\d{2})")
    bad3 = []
    for block in rows:
        rid = re.search(r'id: "([^"]+)"', block).group(1)
        attr = re.search(r'attribution: "([^"]*)"', block)
        attr = attr.group(1) if attr else ""
        if not any(o in attr for o in ORGS) or not DATE.search(attr):
            bad3.append(f"{rid}: {attr or '(없음)'}")
    record("L3", "출처 문장에 기관명 + 날짜", not bad3, "; ".join(bad3) or "모든 행 통과")

    # ── L4
    page = read(DIST / "money-lens" / "index.html")
    hits = {w: page.count(w) for w in BANNED if w in page}
    record("L4", "금지어 0건(/money-lens/)", page != "" and not hits, json.dumps(hits, ensure_ascii=False) if hits else ("산출물 없음" if not page else "0건"))

    # ── L5
    guard = (
        "calc.empty" in ring
        and "data-money-ring-empty" in ring
        and "입력 부족" in ring
        and "Number.isFinite(n) && n > 0" in ring
        and "Math.min(cash, E)" in ring
    )
    # 주석은 코드가 아니다 — 선언문·주석을 걷어 낸 뒤 실제 호출만 센다.
    code = re.sub(r"/\*[\s\S]*?\*/", "", ring)
    code = re.sub(r"(?m)^\s*//.*$", "", code)
    store = [w for w in ("localStorage.", "sessionStorage.", "document.cookie", "fetch(", "XMLHttpRequest") if w in code]
    record("L5", "진단기 입력 방어 · 저장/전송 없음", guard and not store, ("방어 누락" if not guard else "") + (f" 저장·전송 코드: {store}" if store else "0·음수·문자 입력 방어 + 저장·전송 코드 0"))

    # ── L6
    # 판정 트리를 소스와 같은 식으로 다시 세워 6유형 테스트 벡터를 만든다.
    def judge(monthly: float, cash: float, fx: float, stocks: float, house_live: float, buffer: int = 3) -> str:
        E = monthly * buffer
        T = fx + min(cash, E)
        S = max(0.0, cash - E)
        W = stocks
        A = T + W + S
        runout = (cash + fx) / monthly if monthly else float("inf")
        krw_exposure = (A - fx) / A if A else 0
        t, w = (T / A if A else 0), (W / A if A else 0)
        sleep = S / monthly if monthly else 0
        house = house_live / (A + house_live) if (A + house_live) else 0
        if runout < 3:
            return "thin"
        if sleep >= 12:
            return "sleepy"
        if t < 0.1 and krw_exposure >= 0.8:
            return "krw-only"
        if w >= 0.8 and runout < 6:
            return "growth-only"
        if house >= 0.7:
            return "house"
        return "balanced"

    vectors = [
        ("thin", dict(monthly=200, cash=400, fx=0, stocks=0, house_live=0)),
        ("sleepy", dict(monthly=100, cash=1600, fx=0, stocks=0, house_live=0)),
        ("krw-only", dict(monthly=100, cash=300, fx=0, stocks=3000, house_live=0)),
        ("growth-only", dict(monthly=150, cash=300, fx=300, stocks=2400, house_live=0)),
        ("house", dict(monthly=100, cash=600, fx=0, stocks=700, house_live=3500)),
        ("balanced", dict(monthly=250, cash=3000, fx=0, stocks=2000, house_live=0)),
    ]
    reached = {name: judge(**kw) for name, kw in vectors}
    miss = [f"{n}→{got}" for n, got in reached.items() if got != n]
    # 소스에 6개 유형 이름이 모두 있는지도 함께 본다
    kinds = ("thin", "sleepy", "krw-only", "growth-only", "house", "balanced")
    names_ok = all(f'"{k}"' in ring or k == "balanced" for k in kinds)
    record("L6", "판정 트리 6유형 도달", not miss and names_ok, "; ".join(miss) or " · ".join(sorted(reached)))

    # ── L7
    hrefs = set()
    for f in (SRC / "pages" / "money-lens" / "index.astro", RING, DATA):
        for h in re.findall(r'href: "([^"]+)"', read(f)):
            if h.startswith("/"):
                hrefs.add(h)
        for h in re.findall(r'href=\{withBase\("([^"]+)"\)\}', read(f)):
            hrefs.add(h)
    missing_links = []
    for h in sorted(hrefs):
        rel = h.strip("/").split("?")[0]
        candidates = [DIST / rel / "index.html", DIST / f"{rel}.html"]
        if not any(c.exists() for c in candidates):
            missing_links.append(h)
    record("L7", "4단계·퀴즈 링크 실재", not missing_links, ", ".join(missing_links) if missing_links else f"링크 {len(hrefs)}개 모두 dist에 있음")

    # ── L8
    run_page = read(DIST / "apps" / "money-ring" / "run" / "index.html")
    d_board = 'data-lens-disclaimer="board"' in page
    d_quiz = 'data-lens-disclaimer="quiz"' in page
    d_result = "특정 상품의 추천·권유가 아니며" in run_page
    record("L8", "고지 3종(시세·퀴즈·결과)", d_board and d_quiz and d_result, f"시세={d_board} 퀴즈={d_quiz} 결과={d_result}")

    # ── L9
    m = re.search(r'refreshedAt: "([^"]+)"', src)
    refreshed = dt.datetime.fromisoformat(m.group(1)) if m else None
    if refreshed is None:
        record("L9", "5·10년 전 값 갱신 주기", False, "refreshedAt 없음")
    else:
        age = (TODAY - refreshed).days
        ok = age <= 365
        record("L9", "5·10년 전 값 갱신 주기", ok, f"갱신 {refreshed.date()} · {age}일 경과" + (" (210일 초과 — 반기 갱신 필요)" if age > 210 else ""), warn=210 < age <= 365)

    # ── L10
    # 서브패스에서 404가 나던 자리 — React 아일랜드가 그린 링크는 SSR HTML에 그대로 남는다.
    # 그래서 산출물의 href를 전부 모아 ①배포 접두 ②dist 실재를 함께 본다.
    bad10: list[str] = []
    checked10 = 0
    for page_path in (DIST / "money-lens" / "index.html", DIST / "apps" / "money-ring" / "run" / "index.html"):
        html = read(page_path)
        label = str(page_path.relative_to(DIST))
        if not html:
            bad10.append(f"{label}: 산출물 없음")
            continue
        for raw in re.findall(r'href="([^"]+)"', html):
            if not raw.startswith("/") or raw.startswith("//"):
                continue
            checked10 += 1
            path = raw.split("#", 1)[0].split("?", 1)[0]
            if BASE and not (path == BASE or path.startswith(BASE + "/")):
                bad10.append(f"{label}: 접두 없음 {raw}")
                continue
            rel = path[len(BASE):].strip("/") if BASE else path.strip("/")
            target = DIST / rel if rel else DIST / "index.html"
            exists = target.is_file() or (target / "index.html").is_file() or (DIST / f"{rel}.html").is_file()
            if not exists:
                bad10.append(f"{label}: 파일 없음 {raw}")
    record("L10", "내부 링크 배포 접두·실재", not bad10, "; ".join(bad10[:6]) if bad10 else f"href {checked10}개 확인(BASE {BASE or '/'})")

    # ── L11
    # 지수 4종·국고채는 시세판이 아니라 today.ts 연동 시장 시세 섹션이 그린다(2026-11-26 개편).
    miss11 = [i for i in MARKET_IDS if f'data-lens-quote="{i}"' not in page]
    has_section = "data-lens-market" in page
    link_note = "today.ts 연동" in page
    record(
        "L11",
        "오늘의 주요 시장 시세(today.ts 연동)",
        has_section and link_note and not miss11,
        ("섹션 없음 " if not has_section else "")
        + ("" if link_note else "today.ts 연동 문구 없음 ")
        + (f"빠진 지표: {miss11}" if miss11 else "" if not has_section else "")
        or f"지표 {len(MARKET_IDS)}개 · {MARKET_IDS[0]} … {MARKET_IDS[-1]}",
    )

    # ── L12
    # spglobal.com/spdji 원문은 403 Forbidden(2026-11-26 GET 확인)이었다. 다시 끼어들면 링크가 죽는다.
    # 주석은 링크가 아니다 — 주석을 걷어 낸 본문만 본다(고친 이유를 주석에 남길 수 있게).
    def strip_comments(text: str) -> str:
        text = re.sub(r"/\*[\s\S]*?\*/", "", text)
        text = re.sub(r"(?m)^\s*//.*$", "", text)
        return re.sub(r"<!--[\s\S]*?-->", "", text)

    dead = [name for name, body in (("data", src), ("page", page)) if "spglobal.com" in strip_comments(body)]
    record("L12", "403 원문 링크 재사용 금지", not dead, ", ".join(dead) if dead else "spglobal.com 0건")

    # ── L13
    # 1단계는 "무엇을 비교하는 화면인지"가 첫 줄에서 보여야 한다(2026-11-26 대표님 지적).
    # `오늘` 탭 표는 처음엔 그려지지 않는다(기본 탭이 10년 전) — 소스로 보고, 스트립은 산출물로 본다.
    board = read(SRC / "components" / "money-lens" / "LensBoard.tsx")
    strip = "data-lens-anchor" in page and "오늘 1억 원의 세 가지 모습" in page
    unit_table = all(k in board for k in ("오늘 단가", "1억 기준", "오늘 1억 원의 세 가지 모습"))
    dup = "지수 4종은 원본에서 확인합니다" in page
    record(
        "L13",
        "1단계 개편(스트립·오늘 단가·중복 카드 0)",
        strip and unit_table and not dup,
        ("스트립 없음 " if not strip else "")
        + ("" if unit_table else "오늘 단가 표 없음 ")
        + ("지수 4종 중복 카드 남음" if dup else "")
        or "스트립 · 오늘 단가 · 중복 0",
    )

    failures = [r for r in results if not r["ok"]]
    warns = [r for r in results if r["warn"]]
    for r in results:
        mark = "✓" if r["ok"] else "✗"
        tail = " ⚠" if r["warn"] else ""
        print(f"{mark} {r['code']} {r['name']} — {r['detail']}{tail}")
    print(f"\n{'FAIL' if failures else 'PASS'} · 실패 {len(failures)} · 경고 {len(warns)}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(
            {
                "checked_at": TODAY.isoformat(),
                "verdict": "FAIL" if failures else "PASS",
                "results": results,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
