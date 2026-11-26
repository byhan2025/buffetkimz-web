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
  L13 대시보드 개편이 유지되는가 — 핵심 4자산 카드 · 카드마다 원화/달러/금 세 게이지 · 10년 기본 탭 · 옛 1~4단계 표기 0
  L14 게이지가 실측값에서만 나오는가 — 120개월 시계열로 최소·최대·현재 위치를 다시 세어 산출물의 aria-label과 대조
  L15 페이지 안 즉석 진단 — 프리셋 3종 · 순자산 달러/금 환산 · 3층 비율 · withBase 링크
  L16 첫 화면 요약 — 오늘 1억의 원화·달러·금이 계기판보다 먼저 나오는가

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
KINDS = SRC / "data" / "money-ring-kinds.ts"
DIAG = SRC / "components" / "money-lens" / "LensDiagnose.tsx"
TRACKS = SRC / "data" / "money-lens-tracks.ts"
BOARD = SRC / "components" / "money-lens" / "LensBoard.tsx"
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
    diag_src = read(DIAG)
    diag_code = re.sub(r"/\*[\s\S]*?\*/", "", diag_src)
    diag_code = re.sub(r"(?m)^\s*//.*$", "", diag_code)
    store += [f"{w}(진단)" for w in ("localStorage.", "sessionStorage.", "document.cookie", "fetch(", "XMLHttpRequest") if w in diag_code]
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
    kinds_src = read(KINDS)
    names_ok = all((f'"{k}"' in kinds_src) or (f'"{k}"' in ring) or k == "balanced" for k in kinds)
    record("L6", "판정 트리 6유형 도달", not miss and names_ok, "; ".join(miss) or " · ".join(sorted(reached)))

    # ── L7
    hrefs = set()
    for f in (SRC / "pages" / "money-lens" / "index.astro", RING, DATA, KINDS, DIAG):
        for h in re.findall(r'href: "([^"]+)"', read(f)):
            if h.startswith("/"):
                hrefs.add(h)
        for h in re.findall(r'href=\{withBase\((?:`|")([^"`]+)(?:`|")\)\}', read(f)):
            hrefs.add(h)
    missing_links = []
    for h in sorted(hrefs):
        if "${" in h:  # 템플릿 리터럴(/posts/${p.id})은 빌드 산출물 검사(L10)가 맡는다
            continue
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
    # 2026-11-26 대시보드 개편 — 핵심 4자산 카드가 원화·달러·금 세 게이지를 각각 그리고,
    # 첫 화면 기본 탭이 `10년`이며, 옛 1~4단계 교과서 표기가 남아 있지 않아야 한다.
    gauge_cards = re.findall(r'data-lens-gauge-card="([^"]+)"', page)
    units13 = page.count('data-lens-gauge="')
    legacy = [w for w in ("1단계. 같은 1억", "2단계. 내 돈은", "3단계. 같은 숫자", "4단계. 오늘 할 행동") if w in page]
    tabs13 = all(f">{t}</button>" in page for t in ("10년", "5년", "오늘"))
    expect_cards = ["seoul-apt", "krw-deposit", "usd", "gold"]
    record(
        "L13",
        "대시보드 4자산 × 3게이지 · 기본 10년 탭",
        gauge_cards[:4] == expect_cards and units13 == 12 and tabs13 and not legacy,
        (f"카드 {gauge_cards[:6]}" if gauge_cards[:4] != expect_cards else "")
        + (f" 게이지 {units13}개" if units13 != 12 else "")
        + ("" if tabs13 else " 탭 없음")
        + (f" 옛 단계 표기: {legacy}" if legacy else "")
        or "카드 4 · 게이지 12 · 탭 3 · 옛 단계 표기 0",
    )

    # ── L14
    # 게이지가 실측 시계열에서만 나오는지 — 파이썬이 같은 식으로 120개월을 다시 세워
    # 산출물의 aria-label(위치 %)과 대조한다. 화면에서 만든 숫자가 있으면 여기서 걸린다.
    tracks_src = read(TRACKS)

    def track_nums(name: str) -> list[float]:
        m14 = re.search(rf"export const {name}: readonly number\[\] = \[(.*?)\];", tracks_src, re.S)
        return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", m14.group(1))] if m14 else []

    apt14 = track_nums("LENS_TRACK_APT")
    fx14 = track_nums("LENS_TRACK_FX")
    gold14 = track_nums("LENS_TRACK_GOLD")

    def meta3(key: str) -> tuple[float, float, float]:
        m14 = re.search(rf"{key}: \{{\s*now: ([\d.]+),\s*y5: ([\d.]+),\s*y10: ([\d.]+)", src)
        return tuple(float(x) for x in m14.groups()) if m14 else (0.0, 0.0, 0.0)

    fx_now, _, fx_y10 = meta3("fx")
    gold_now, _, gold_y10 = meta3("goldKrwPerG")
    m14d = re.search(r"depositGrowth: \{ y5: ([\d.]+), y10: ([\d.]+) \}", src)
    dep_y10 = float(m14d.group(2)) if m14d else 0.0
    win14 = [
        (a, b, float(r))
        for a, b, r in re.findall(r'\{ from: "(\d{4}\.\d{2})", to: "(\d{4}\.\d{2})", rate: ([\d.]+) \}', src)
    ]

    def month_key(y: int, m: int) -> int:
        return y * 100 + m

    def deposit_track() -> list[float]:
        out14: list[float] = []
        mult14 = 1.0
        for i14 in range(len(apt14)):
            if i14 > 0:
                t14 = 2016 * 12 + 10 + i14
                key14 = month_key(t14 // 12, t14 % 12 + 1)
                rate14 = next(
                    (
                        r
                        for a, b, r in win14
                        if month_key(int(a[:4]), int(a[5:])) <= key14 <= month_key(int(b[:4]), int(b[5:]))
                    ),
                    None,
                )
                if rate14 is None:
                    return []
                mult14 *= (1 + rate14 / 100) ** (1 / 12)
            out14.append(mult14)
        return out14

    krw14 = {
        "seoul-apt": [v / apt14[0] for v in apt14] if apt14 else [],
        "krw-deposit": deposit_track(),
        "usd": [v / fx14[0] for v in fx14] if fx14 else [],
        "gold": [v / gold14[0] for v in gold14] if gold14 else [],
    }
    now14 = {
        "seoul-apt": 103.644 / apt14[0] if apt14 else 0,
        "krw-deposit": dep_y10,
        "usd": fx_now / fx14[0] if fx14 else 0,
        "gold": gold_now / gold14[0] if gold14 else 0,
    }
    prices14 = {"krw": None, "usd": fx14, "gold": gold14}
    unit_now14 = {"krw": 1.0, "usd": fx_now, "gold": gold_now}
    month_count14 = len(apt14)
    problems14: list[str] = []
    if not (month_count14 == len(fx14) == len(gold14) == len(krw14["krw-deposit"]) == 120):
        problems14.append(f"시계열 길이 {month_count14}/{len(fx14)}/{len(gold14)}/{len(krw14['krw-deposit'])}")
    if abs(now14["krw-deposit"] - 1.267884) > 0.002:
        problems14.append(f"예금 10년 배수 {now14['krw-deposit']:.4f}")

    # 산출물에서 카드별 게이지 aria-label을 순서대로 뽑는다
    rendered = []
    for card_id in expect_cards:
        pos14 = page.find(f'data-lens-gauge-card="{card_id}"')
        nxt = page.find("</article>", pos14)
        chunk = page[pos14 : nxt if nxt > 0 else len(page)]
        for lbl in re.findall(r'aria-label="([^"]+)"', chunk):
            m14p = re.search(r"사이 (\d+)% 지점, (.+)$", lbl)
            rendered.append((m14p.group(1), m14p.group(2)) if m14p else ("self", lbl))
    if len(rendered) != 12:
        problems14.append(f"산출물 게이지 aria-label {len(rendered)}개")
    else:
        idx14 = 0
        for card_id in expect_cards:
            for unit in ("krw", "usd", "gold"):
                self_unit = (card_id == "usd" and unit == "usd") or (card_id == "gold" and unit == "gold")
                prices = prices14[unit]
                series = [k / p for k, p in zip(krw14[card_id], prices)] if prices else krw14[card_id]
                now_v = now14[card_id] / unit_now14[unit] if prices else now14[card_id]
                window = series[:]
                lo, hi = min(window), max(window)
                pos_expected = 100.0 if hi <= lo else max(0.0, min(100.0, (now_v - lo) / (hi - lo) * 100))
                got, band = rendered[idx14]
                idx14 += 1
                if self_unit:
                    if got != "self":
                        problems14.append(f"{card_id}/{unit}: 자기 단위인데 게이지로 그려짐")
                    continue
                if got != "self" and abs(int(got) - pos_expected) > 1.5:
                    problems14.append(f"{card_id}/{unit}: 화면 {got}% vs 실측 {pos_expected:.1f}%")
                if not band.strip():
                    problems14.append(f"{card_id}/{unit}: 단계 이름 없음")
    record(
        "L14",
        "게이지 실측(120개월 min/max/현재)",
        not problems14,
        "; ".join(problems14[:5]) if problems14 else f"시계열 {month_count14}개월 × 4자산 × 3단위 = 12개 게이지 일치",
    )

    # ── L15
    # 페이지 안 즉석 진단 — 프리셋 3종과 결과 문구가 산출물에 있어야 한다(이동 없이 진단).
    presets = ("예금 1억", "서울 집 7억 + 대출 3억", "직장인 3억 분산")
    diag_ok = (
        'data-lens-diagnose' in page
        and all(p15 in page for p15 in presets)
        and "내 순자산" in page
        and all(w in page for w in ("진짜 돈", "일하는 돈", "잠자는 돈"))
    )
    base15 = f"{BASE}/apps/money-ring/run" if BASE else "/apps/money-ring/run"
    link15 = base15 in page
    record(
        "L15",
        "페이지 안 즉석 진단(프리셋·환산·3층)",
        diag_ok and link15,
        ("" if diag_ok else "진단 위젯·프리셋·3층 문구 누락 ")
        + ("" if link15 else f"심화 진단 링크 없음({base15})")
        or f"프리셋 {len(presets)}종 · 순자산 환산 · 3층 비율",
    )

    # ── L16
    # 첫 화면 요약 — 계기판보다 먼저 '오늘 1억'의 세 모습이 나와야 한다.
    anchor_at = page.find("data-lens-anchor")
    gauge_at = page.find("data-lens-gauge-card")
    hero_ok = 0 <= anchor_at < gauge_at and "74,493" in page and "566.6" in page
    record(
        "L16",
        "첫 화면 요약(원화·달러·금) 선행",
        hero_ok,
        "위치 순서 OK · 74,493달러 · 566.6g" if hero_ok else f"anchor={anchor_at} gauge={gauge_at}",
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
