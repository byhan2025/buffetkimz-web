#!/usr/bin/env python3
"""세율·한도 단일 출처 검증 — v7.7.0 빌드 가드.

무엇을 재는가
  A. `src/data/tax-rules.ts`의 상수가 견본표(TAX_EXPECTED)와 같은가
  B. 계산기·데이터 소스에 세율이 다시 하드코딩되지 않았는가(단일 출처 위반)
  C. `src/lib/pension-engine.mjs`(원 단위 엔진)의 LAW 값이 tax-rules와 같은가
  D. 빌드된 dist의 문구가 상충하지 않는가 — 같은 세율을 다르게 말하는 페이지 0
  E. 홈·계산기 화면의 대표 숫자(148.5만원 / 148만 5,000원)가 같은 곱에서 나왔는가

사용:
  npm run build && python3 scripts/verify_tax_consistency.py
결과: reports/buffetkimz-web/v77-quality95/verify-tax-consistency.json
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request

LIVE = "--live" in sys.argv
LIVE_BASE = "https://byhan2025.github.io/buffetkimz-web"
APP = pathlib.Path(__file__).resolve().parent.parent
SRC = APP / "src"
DIST = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v77-quality95"
OUT.mkdir(parents=True, exist_ok=True)

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# A. tax-rules.ts — 견본표와 상수
# ---------------------------------------------------------------------------
rules_text = read(SRC / "data" / "tax-rules.ts")


def num(pattern: str, text: str = rules_text) -> float | None:
    m = re.search(pattern, text)
    return float(m.group(1).replace(",", "").replace("_", "")) if m else None


EXPECTED = {
    "savingsLimit": 600,
    "combinedLimit": 900,
    "creditRateLowPct": 16.5,
    "creditRateHighPct": 13.2,
    "otherIncomePct": 16.5,
    "privateThreshold": 1500,
    "isaExempt": 200,
    "isaExemptSeomin": 400,
    "isaTransferMax": 300,
    "isaTransferPct": 10,
    "standardCredit": 13,
    "healthRatePct": 7.19,
    "longTermCareRatioPct": 13.14,
    "dividendPct": 15.4,
}

ACTUAL = {
    "savingsLimit": num(r"savingsLimit:\s*([\d_.,]+)"),
    "combinedLimit": num(r"combinedLimit:\s*([\d_.,]+)"),
    "creditRateLowPct": (lambda v: None if v is None else round(v * 100, 4))(num(r"creditRateLow:\s*([\d.]+)")),
    "creditRateHighPct": (lambda v: None if v is None else round(v * 100, 4))(num(r"creditRateHigh:\s*([\d.]+)")),
    "otherIncomePct": (lambda v: None if v is None else round(v * 100, 4))(num(r"otherIncomeWithLocal:\s*([\d.]+)")),
    "privateThreshold": num(r"annualThreshold:\s*([\d_.,]+)"),
    "isaExempt": num(r"exemptGeneral:\s*([\d_.,]+)"),
    "isaExemptSeomin": num(r"exemptSeomin:\s*([\d_.,]+)"),
    "isaTransferMax": num(r"isaTransferMax:\s*([\d_.,]+)"),
    "isaTransferPct": (lambda v: None if v is None else round(v * 100, 4))(num(r"isaTransferRate:\s*([\d.]+)")),
    "standardCredit": num(r"standardCredit:\s*([\d_.,]+)"),
    "healthRatePct": (lambda v: None if v is None else round(v * 100, 4))(num(r"\brate:\s*([\d.]+)", rules_text)),
    "longTermCareRatioPct": (lambda v: None if v is None else round(v * 100, 4))(num(r"longTermCareRatio:\s*([\d.]+)")),
    "dividendPct": (lambda v: None if v is None else round(v * 100, 4))(num(r"dividendWithLocal:\s*([\d.]+)")),
}

mismatch = [
    f"{k}: 기대 {EXPECTED[k]} ≠ 실제 {ACTUAL[k]}"
    for k in EXPECTED
    if ACTUAL[k] is None or round(abs(ACTUAL[k] - EXPECTED[k]), 4) > 1e-6
]
check("A1 tax-rules.ts 상수 = 견본표(14종)", not mismatch, " · ".join(mismatch))

# TAX_EXPECTED 표도 같은 값인가
expect_block = rules_text[rules_text.find("export const TAX_EXPECTED") :]
check(
    "A2 TAX_EXPECTED 표도 상수와 같은 값을 적고 있음",
    all(
        re.search(rf"{k}:\s*{re.escape(str(v))}\b", expect_block)
        for k, v in EXPECTED.items()
    ),
    "TAX_EXPECTED가 상수와 어긋나면 이 검사가 실패",
)

# 표기 문자열이 상수에서 만들어지는가
check(
    "A3 화면 표기(TAX_TEXT)가 상수에서 파생됨",
    "export const TAX_TEXT" in rules_text
    and "pct(PENSION_ACCOUNT.creditRateLow)" in rules_text
    and "pct(INCOME_TAX.otherIncomeWithLocal)" in rules_text,
    "",
)

# ---------------------------------------------------------------------------
# B. 계산기 소스의 하드코딩
# ---------------------------------------------------------------------------
# 세율로만 읽히는 값 — 0.055 같은 짧은 소수는 색 임계값 등과 겹쳐 오탐이 나므로 넣지 않는다.
FORBIDDEN = [
    r"\b0\.165\b",
    r"\b0\.132\b",
    r"\b0\.154\b",
    r"\b0\.099\b",
    r"\b0\.0719\b",
    r"\b0\.1314\b",
]
SCAN_DIRS = [SRC / "components" / "tools", SRC / "lib"]
ALLOW = {
    SRC / "data" / "tax-rules.ts",
    SRC / "lib" / "pension-engine.mjs",  # 원 단위 엔진 — C에서 따로 대조한다
}
hits: list[str] = []
for d in SCAN_DIRS:
    for f in sorted(d.rglob("*")):
        if f.suffix not in {".ts", ".tsx", ".mjs"} or f in ALLOW:
            continue
        text = read(f)
        for pat in FORBIDDEN:
            for m in re.finditer(pat, text):
                line = text[: m.start()].count("\n") + 1
                hits.append(f"{f.relative_to(APP)}:{line} {m.group(0)}")
check("B1 계산기 코드에 세율 하드코딩 없음", not hits, ", ".join(hits[:8]))

# 데이터(설명 문구)는 숫자를 문장으로 갖는다 — 대신 상충 문구만 D에서 잰다.
data_files = list((SRC / "data").glob("*.ts"))
check("B2 계산 로직은 tax-rules를 참조", "from \"@/data/tax-rules\"" in read(SRC / "lib" / "finance.ts"), "")

# ---------------------------------------------------------------------------
# C. pension-engine.mjs — 원 단위 LAW
# ---------------------------------------------------------------------------
engine = read(SRC / "lib" / "pension-engine.mjs")
engine_expected = {
    "separateThreshold": ("separateThreshold:\\s*([\\d_]+)", 15_000_000),
    "separateRate15": ("separateRate15:\\s*([\\d.]+)", 0.15),
    "localTaxRate": ("localTaxRate:\\s*([\\d.]+)", 0.1),
    "standardTaxCredit": ("standardTaxCredit:\\s*([\\d_]+)", 130_000),
    "dependentIncomeLimit": ("dependentIncomeLimit:\\s*([\\d_]+)", 20_000_000),
    "pensionLimit": ("pensionLimit:\\s*([\\d_]+)", 6_000_000),
    "totalLimit": ("totalLimit:\\s*([\\d_]+)", 9_000_000),
    "isaExtraCap": ("isaExtraCap:\\s*([\\d_]+)", 3_000_000),
}
engine_bad = []
for key, (pat, want) in engine_expected.items():
    m = re.search(pat, engine)
    got = float(m.group(1).replace("_", "")) if m else None
    if got is None or abs(got - want) > 1e-9:
        engine_bad.append(f"{key}: 기대 {want} ≠ 실제 {got}")
check("C1 pension-engine LAW = tax-rules", not engine_bad, " · ".join(engine_bad))

withholding = re.findall(r"underAge:\s*(?:\d+|Infinity),\s*rate:\s*([\d.]+)", engine)
check(
    "C2 원천징수 5%·4%·3% (지방세 포함 5.5·4.4·3.3)",
    withholding[:3] == ["0.05", "0.04", "0.03"],
    str(withholding[:3]),
)

# ---------------------------------------------------------------------------
# D. dist 문구 일관성
# ---------------------------------------------------------------------------
if LIVE:
    live_paths = [
        "/", "/apps/", "/about/", "/posts/", "/posts/pension/",
        "/apps/pension-tax/", "/apps/pension-tax/run/", "/apps/account-tax-compare/run/",
        "/apps/health-insurance-compare/", "/apps/health-insurance-compare/run/",
        "/apps/salary-net/", "/apps/salary-net/run/", "/apps/loan-repay/run/",
        "/apps/pension-draw/run/",
        "/search/", "/calendar/",
    ] + [f"/posts/pension-master-0{i}-{slug}/" for i, slug in enumerate(
        ["four-accounts", "tax-compare", "yearend-900", "asset-etf", "draw-1500", "healthcheck"], start=1)]
    pages = {}
    for path in live_paths:
        try:
            with urllib.request.urlopen(LIVE_BASE + path, timeout=30) as r:
                pages[path] = r.read().decode("utf-8", "replace")
        except Exception as exc:  # 라이브가 아직 아니면 그 페이지만 빠진다
            print(f"  (live fetch 실패 {path}: {exc})")
    check("D0 라이브 HTML 수집", bool(pages), f"{len(pages)}/{len(live_paths)}p")
else:
    pages = {str(p.relative_to(DIST)): read(p) for p in DIST.rglob("*.html")}
    check("D0 dist HTML 존재", bool(pages), f"{len(pages)}개")


def variants(pattern: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p, html in pages.items():
        for m in re.finditer(pattern, html):
            key = m.group(1).replace(",", "")
            out.setdefault(key, []).append(p)
    return out


def summarize(v: dict[str, list[str]], limit: int = 4) -> str:
    return " · ".join(f"{k}%({len(paths)}p)" for k, paths in sorted(v.items(), key=lambda kv: -len(kv[1]))[:limit])


# D1 기타소득세 — 16.5%만
v = variants(r"기타소득세\s*([\d.]+)\s*%")
check("D1 기타소득세 표기 = 16.5%", bool(v) and set(v) == {"16.5"}, summarize(v))

# D2 16.5%를 종합과세 세율로 부르지 않는다
bad = []
for p, html in pages.items():
    for m in re.finditer(r"종합과세[^<>{}]{0,10}16\.5%[^<>{}]{0,36}", html):
        tail = m.group(0)
        # '종합과세와 16.5% 분리과세 중 선택'은 올바른 문장 — 분리과세가 뒤따르면 통과
        # 카드에서 잘린 문장(…으로 끝남)은 판단하지 않는다
        if "분리" not in tail and not tail.rstrip().endswith("…"):
            bad.append(f"{p}: {tail[:44]}")
check("D2 '16.5%'를 종합과세 세율로 쓰지 않음", not bad, "; ".join(bad[:4]))

# D3 연금저축 단독 한도 — 600만원 (큰 금액은 계산 결과라 제외)
v = variants(r"연금저축\s*(?:단독|만으로는)?\s*(?:연\s*)?([\d,]{3,6})만원까지")
bad_keys = {k for k in v if k not in {"600", "900"}}
check("D3 연금저축 한도 표기(600·900만원)", not bad_keys, summarize({k: v[k] for k in bad_keys}))

# D4 표준세액공제 13만원
v = variants(r"표준세액공제\s*([\d,]+)\s*만원")
check("D4 표준세액공제 = 13만원", bool(v) and set(v) == {"13"}, summarize(v))

# D5 사적연금 1,500만원 기준
v = variants(r"(?:사적연금|연금소득)[^<>{}%]{0,14}연\s*([\d,]{4,6})\s*만원")
check("D5 사적연금 기준 = 연 1,500만원", "1500" in v and set(v) <= {"1500", "1800", "2000"}, summarize(v))

# D6 ISA 비과세 200·400만원
v = variants(r"ISA[^<>{}]{0,14}비과세\s*([\d,]{3,4})\s*만원")
check("D6 ISA 비과세 = 200·400만원", set(v) <= {"200", "400"} and bool(v), summarize(v))

# D7 ISA 전환 10% · 최대 300만원
v = variants(r"10%[^<>{}%]{0,6}최대\s*([\d,]{3,4})\s*만원")
check("D7 ISA 전환 추가 한도 = 이전액 10%·최대 300만원", bool(v) and set(v) <= {"300"}, summarize(v))

# D8 건강보험료율 7.19% · 장기요양 13.14%
v = variants(r"건강보험료율\s*([\d.]+)\s*%")
check("D8 건강보험료율 = 7.19%", bool(v) and set(v) == {"7.19"}, summarize(v))
v2 = variants(r"장기요양[^<>{}%]{0,16}?([\d]{1,2}\.[\d]{1,4})\s*%")
check("D9 장기요양 = 13.14%(보험료 대비)", "13.14" in v2 and set(v2) <= {"13.14", "0.9448", "7.19"}, summarize(v2))

# D10 이자·배당 15.4%
v = variants(r"배당소득[^<>{}]{0,12}(1[45]\.[\d])\s*%")
check("D10 이자·배당 = 15.4%", bool(v) and set(v) == {"15.4"}, summarize(v))

# D11 세액공제율 16.5%·13.2%가 실제로 화면에 있다
low = sum(html.count("16.5%") for html in pages.values())
high = sum(html.count("13.2%") for html in pages.values())
check("D11 화면에 16.5%·13.2%가 함께 있음", low > 0 and high > 0, f"16.5%×{low} · 13.2%×{high}")

# D12 폐기된 표기가 없다
stale = []
for p, html in pages.items():
    for pat in ("16.0%", "13.0%", "14.0%", "7.09%", "9.0% 분리과세"):
        if pat in html:
            stale.append(f"{p}:{pat}")
check("D12 폐기 표기(16.0%·13.0% 등) 0건", not stale, "; ".join(stale[:5]))

# ---------------------------------------------------------------------------
# E. 대표 숫자 — 같은 곱에서 나왔는가
# ---------------------------------------------------------------------------
home = pages.get("/") or read(DIST / "index.html")
about = pages.get("/about/") or read(DIST / "about" / "index.html")
pension_detail = pages.get("/apps/pension-tax/") or read(DIST / "apps" / "pension-tax" / "index.html")
credit_man = EXPECTED["combinedLimit"] * EXPECTED["creditRateLowPct"] / 100  # 148.5
credit_won = int(EXPECTED["combinedLimit"] * 10000 * EXPECTED["creditRateLowPct"] / 100)  # 1485000
won_label = f"{credit_won // 10000}만 {credit_won % 10000:,}원"
check(
    "E1 홈 미리보기 '148.5만원' = 900만 × 16.5%",
    f"{credit_man:.1f}만원" in home,
    f"찾는 값 {credit_man:.1f}만원",
)
check(
    "E2 소개·상세의 최대 공제 '148만 5,000원' = 같은 곱",
    won_label in about or won_label in pension_detail,
    won_label,
)

# ---------------------------------------------------------------------------
failed = [c for c in CHECKS if not c["ok"]]
result = {
    "total": len(CHECKS),
    "passed": len(CHECKS) - len(failed),
    "failed": len(failed),
    "checks": CHECKS,
}
(OUT / f"verify-tax-consistency{'-live' if LIVE else ''}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{result['passed']}/{result['total']} 통과 → {OUT / ('verify-tax-consistency-live.json' if LIVE else 'verify-tax-consistency.json')}")
sys.exit(0 if not failed else 1)
