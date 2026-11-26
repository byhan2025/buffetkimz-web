#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""「돈의 나이테」 계기판 시계열 생성 — 2016. 11. ~ 2026. 10. (120개월).

이 스크립트가 `src/data/money-lens-tracks.ts`를 만든다. 손으로 숫자를 적지 않는다.

원자료 (같은 폴더 JSON은 2026-11-26에 실제로 내려받아 계산한 결과다)
  · apt_seoul_rebased.json — R-ONE 「전국주택가격동향조사 시계열(신)_테이블.xlsx」
      (https://www.reb.or.kr/r-one/portal/bbs/rpt/selectBulletinPage.do?bbCd=RPT&seq=3267,
       2026-11-16 게시, 2026. 10.까지). `매매전세월세` 시트에서
       시도=11.서울 · 주택구분=01.아파트 · 통계량=매매지수 행의 월별 값을 꺼내
       2026. 06. = 100으로 다시 매긴 값(원자료 기준시점도 2026. 06. = 100).
  · fx_monthly_avg.json — FRED DEXKOUS(미 연준 H.10) 일별 값의 월평균.
      https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS
  · gold_monthly_usd.json — World Bank Pink Sheet 「Monthly Prices」 Gold($/troy oz).
      https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx
      (2026-11-03 갱신본)

계산
  · 원화 금가격(g) = 국제 금 월평균($/oz) × 같은 달 월평균 환율 ÷ 31.1034768
  · 예금은 여기서 만들지 않는다 — 12개월 창 평균금리(ECOS)는 `src/data/money-lens.ts`의
    `LENS_META.deposit.windows`에 있고, 화면 코드가 그 값으로 월 복리 배수를 굴린다.

사용
  python3 reports/buffetkimz-web/lens-tracks/build_tracks.py          # 생성 + 통계 출력
  python3 reports/buffetkimz-web/lens-tracks/build_tracks.py --check  # 파일이 같은지만 확인
"""
from __future__ import annotations

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


def app_root() -> pathlib.Path:
    """`src/data/money-lens-tracks.ts`가 있는 앱 루트를 위로 거슬러 찾는다.

    이 스크립트는 웹앱 안(reports/buffetkimz-web/lens-tracks)에도, 작업공간
    reports 쪽에도 같은 내용으로 놓일 수 있어 상대 깊이를 고정하지 않는다.
    """
    for base in [HERE, *HERE.parents]:
        if (base / "src" / "data" / "money-lens-tracks.ts").exists():
            return base
        if (base / "apps" / "buffetkimz-web" / "src" / "data" / "money-lens-tracks.ts").exists():
            return base / "apps" / "buffetkimz-web"
    raise SystemExit("앱 루트를 찾지 못했습니다 — src/data/money-lens-tracks.ts 기준")


APP = app_root()
TARGET = APP / "src" / "data" / "money-lens-tracks.ts"

MONTHS = [f"{y}-{m:02d}" for y in range(2016, 2027) for m in range(1, 13)]
MONTHS = [m for m in MONTHS if "2016-11" <= m <= "2026-10"]


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def series() -> tuple[list[float], list[float], list[float]]:
    apt = load("apt_seoul_rebased.json")
    fx = load("fx_monthly_avg.json")
    gold = load("gold_monthly_usd.json")
    a = [round(apt[m], 3) for m in MONTHS]
    f = [round(fx[m], 2) for m in MONTHS]
    g = [round(gold[m[:4] + "M" + m[5:]] * fx[m] / 31.1034768, 1) for m in MONTHS]
    return a, f, g


def fmt(name: str, arr: list[float], per: int = 12) -> str:
    lines = [f"export const {name}: readonly number[] = ["]
    for i in range(0, len(arr), per):
        lines.append("  " + ", ".join(str(x) for x in arr[i : i + per]) + ",")
    lines.append("];")
    return "\n".join(lines)


HEAD = '''/**
 * 「돈의 나이테」 계기판의 실측 시계열 — 2016. 11. ~ 2026. 10. (120개월).
 *
 * 이 파일은 손으로 쓰지 않는다. `reports/buffetkimz-web/lens-tracks/build_tracks.py`가
 * 원자료에서 다시 계산해 만든다. 값의 출처와 계산식은 같은 폴더 README.md에 있다.
 *
 *  · LENS_TRACK_APT — 한국부동산원 R-ONE 전국주택가격동향조사 「아파트 매매가격지수(서울)」.
 *    2026. 06. = 100으로 다시 매긴 값(원자료도 같은 기준). 2026. 10. = 103.644.
 *  · LENS_TRACK_FX  — FRED DEXKOUS(미 연준 H.10) 일별 값의 월평균, 원/달러.
 *  · LENS_TRACK_GOLD — World Bank Pink Sheet 국제 금 월평균($/oz) × 같은 달 월평균 환율 ÷ 31.1034768.
 *    국내 소매가(부가세·수수료 포함)가 아니라 원화 환산 계산값이다.
 *
 * 게이지의 최소·최대는 이 배열에서만 나온다(화면에서 새 숫자를 만들지 않는다).
 */
export const LENS_TRACK_START = "2016-11";
export const LENS_TRACK_END = "2026-10";
export const LENS_TRACK_COUNT = 120;

'''


def main() -> int:
    apt, fx, gold = series()
    assert len(apt) == len(fx) == len(gold) == 120, (len(apt), len(fx), len(gold))
    body = HEAD + fmt("LENS_TRACK_APT", apt) + "\n\n" + fmt("LENS_TRACK_FX", fx) + "\n\n" + fmt("LENS_TRACK_GOLD", gold) + "\n"

    if "--check" in sys.argv:
        same = TARGET.exists() and TARGET.read_text(encoding="utf-8") == body
        print("같음" if same else "다름 — 다시 만들어야 합니다")
        return 0 if same else 1

    TARGET.write_text(body, encoding="utf-8")
    print(f"wrote {TARGET} ({len(body)} bytes)")

    for name, arr in (("아파트", apt), ("환율", fx), ("금 원/g", gold)):
        lo = min(arr)
        hi = max(arr)
        print(f"{name}: 최저 {lo:,.3f} ({MONTHS[arr.index(lo)]}) · 최고 {hi:,.3f} ({MONTHS[arr.index(hi)]}) · 현재 {arr[-1]:,.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
