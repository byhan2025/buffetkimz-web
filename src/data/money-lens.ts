/**
 * 「돈의 나이테」 3중 환산 시세판 데이터 — 2026-11-26 신설.
 *
 * reports/buffetkimz-web/money-illusion-system-spec.md §4·§8-1의 데이터 계약.
 *
 * 규칙 (기존 `today.ts`와 같다)
 *  · 값을 손으로 바꾸면 **반드시 출처·기준일을 함께** 바꾼다. 둘 중 하나만 바뀌면 `verify:lens`가 선다.
 *  · `license`가 "ok"·"licensed"가 아닌 행에는 `value`를 두지 않는다(값 없이 원본 링크 카드).
 *  · 숫자는 공표 기관의 **실제 발표값**만 넣는다. 추정·가상 값 금지.
 *
 * 2026-11-26 실제 조회한 값 (P0)
 *  · 서울 아파트 매매가격지수 — 한국부동산원 R-ONE 「(월) 매매가격지수_아파트」 통계표 XLS,
 *    2026. 10. = 103.64 (2026. 06. = 100). 2021. 11. = 92.18, 2016. 11. = 72.52.
 *  · 1년 정기예금(예금은행 신규취급액) — 한국은행 ECOS 1.3.3.1.1 월별(2016.01~2026.10),
 *    항목 「정기예금(1~2년 미만)」. 2026. 10. = 3.77%(2026년 10월 금융기관 가중평균금리 PDF).
 *    1억을 매년 그 해 12개월 평균금리로 재예치했다고 보고 누적배수를 계산했다(아래 DEPOSIT_BASIS).
 *  · 원/달러 — FRED DEXKOUS(미 연준 H.10, 뉴욕 정오 매매율). 2026-11-20 = 1,342.41.
 *    2021-11-19 = 1,184.93, 2016-11-18 = 1,177.71.
 *  · 금 — World Bank Commodity Price Data(Pink Sheet) 월평균, 2026-11-03 갱신본.
 *    2026. 10. = 4,105달러/oz, 2021. 11. = 1,822, 2016. 11. = 1,238. CC BY 4.0.
 *  · 소비자물가지수 — 국가데이터처 KOSIS DT_1J22003(2020=100). 2026. 10. = 120.73,
 *    2021. 11. = 103.87, 2016. 11. = 96.237.
 *  · 미 10년물 — 미 재무부 Daily Treasury Par Yield Curve, 2026-11-25 = 4.85%.
 *  · 기준금리 — 한국은행, 2026. 8. 27. 3.00%(이후 동결).
 *
 * 지수 4종(코스피·삼성전자·S&P500·나스닥)은 약관상 재배포가 막혀 있어 **값을 싣지 않는다**
 * (spec §6-2). 계약이 끝나면 `license: "licensed"`와 `value`만 채우면 화면은 그대로 값을 그린다.
 *
 * 2026-11-26 링크 교정 — 네 행의 `link.href`는 값이 한 화면에 뜨는 TradingView 심볼 페이지로 보낸다.
 *   spglobal.com/spdji 원문은 403 Forbidden(직접 GET), krx.co.kr은 지수를 첫 화면에 보여 주지 않는다.
 *   지수 자체는 `/money-lens/`의 TradingView 위젯(`LensIndexWidget.astro`)이 우회로로 보여 준다.
 */

import {
  LENS_TRACK_APT,
  LENS_TRACK_COUNT,
  LENS_TRACK_END,
  LENS_TRACK_FX,
  LENS_TRACK_GOLD,
  LENS_TRACK_START,
} from "@/data/money-lens-tracks";

export type License = "ok" | "approval" | "licensed" | "linked";
export type LensPeriod = "now" | "y5" | "y10";
export type LensId =
  | "seoul-apt"
  | "krw-deposit"
  | "usd"
  | "gold"
  | "cpi"
  | "kospi"
  | "samsung"
  | "sp500"
  | "nasdaq";

export type LensBasis = {
  /** 값의 기준 시각 (ISO). 사람이 읽는 표기와 **둘 다** 있어야 화면에 그린다. */
  asOf: string;
  asOfLabel: string;
  sourceLabel: string;
  sourceUrl: string;
  /** 화면에 그대로 찍는 출처 문장 — 기관명 + 날짜가 함께 있어야 한다(verify:lens L3) */
  attribution: string;
};

export type LensRow = {
  id: LensId;
  name: string;
  /** 값 아래 한 줄 — 무엇을 잰 값인지 */
  detail: string;
  unit: "지수" | "원" | "원/g" | "원/달러";
  license: License;
  /** 소수 자릿수 */
  decimals: number;
  /** license가 ok·licensed일 때만. y5·y10은 **같은 단위의 그 시점 값**이다. */
  value?: Record<LensPeriod, number>;
  basis: LensBasis;
  /** 각주(부가세 제외·CMT 등) */
  note?: string;
  /** 값 없이 원본으로 보내는 카드 */
  link?: { label: string; org: string; href: string };
};

/**
 * 5·10년 전 비교 기준값의 **갱신 시각** — 값 자체의 기준일(refAsOf)과 다르다.
 * 반기 1회(4월·10월) 공식 출처에서 다시 받아 채우고 이 날짜를 올린다(spec §4-3).
 * 210일이 지나면 verify:lens가 경고, 365일이면 실패(L9).
 */
export const LENS_VINTAGE = {
  refreshedAt: "2026-11-26T09:40:00+09:00",
  refY5: "2021-11",
  refY10: "2016-11",
  nextCheckAt: "2027-04-05",
} as const;

/** 표·환산에 함께 쓰는 기준 시계열 — 행과 같은 시점의 값이어야 한다. */
export const LENS_META = {
  /** 표를 마지막으로 확인한 시각 */
  asOf: "2026-11-26T09:40:00+09:00",
  asOfLabel: "2026. 11. 26.",
  staleAfterDays: 30,
  /** 원/달러 (연준 H.10) */
  fx: {
    now: 1342.41,
    y5: 1184.93,
    y10: 1177.71,
    asOfLabel: "2026. 11. 20. 주간(뉴욕 정오)",
    basisNote: "미 연준 H.10 주간 고시 · 한국은행 매매기준율이 아닙니다",
  },
  /** 원화 금가격(g) = 국제 금 월평균($/oz) × 해당 월 평균 환율 ÷ 31.1034768 */
  goldKrwPerG: {
    now: 176503.2,
    y5: 69360.6,
    y10: 46278.9,
    asOfLabel: "2026. 10. 월평균",
    basisNote: "부가세·수수료·국내 소매 프리미엄 제외",
  },
  /** 소비자물가지수 (2020=100) */
  cpi: {
    now: 120.73,
    y5: 103.87,
    y10: 96.237,
    asOfLabel: "2026. 10.",
    basisNote: "국가데이터처 KOSIS · 2020년=100",
  },
  /** 1년 정기예금 연평균 금리(예금은행 신규취급액) — 12개월 창 평균 */
  deposit: {
    nowRate: 3.77,
    asOfLabel: "2026. 10.",
    windows: [
      { from: "2016.11", to: "2017.10", rate: 1.617 },
      { from: "2017.11", to: "2018.10", rate: 1.992 },
      { from: "2018.11", to: "2019.10", rate: 1.928 },
      { from: "2019.11", to: "2020.10", rate: 1.275 },
      { from: "2020.11", to: "2021.10", rate: 1.072 },
      { from: "2021.11", to: "2022.10", rate: 2.617 },
      { from: "2022.11", to: "2023.10", rate: 3.972 },
      { from: "2023.11", to: "2024.10", rate: 3.606 },
      { from: "2024.11", to: "2025.10", rate: 2.804 },
      { from: "2025.11", to: "2026.10", rate: 3.179 },
    ],
  },
  /**
   * 1억을 그 시점에 넣었을 때의 누적 배수 — 12개월 창 평균금리 복리.
   *   y5  = 2021. 11. → 2026. 10. (5개 창)  = 1.172519
   *   y10 = 2016. 11. → 2026. 10. (10개 창) = 1.267884
   * (2016. 11. → 2021. 11. 구간 배수 1.081334는 두 값의 비로 나온다: 1.267884 ÷ 1.172519.)
   */
  depositGrowth: { y5: 1.172519, y10: 1.267884 },
} as const;

const SRC = {
  reb: {
    sourceLabel: "한국부동산원 R-ONE",
    sourceUrl: "https://www.reb.or.kr/r-one/portal/stat/easyStatPage.do",
  },
  ecos: {
    sourceLabel: "한국은행 ECOS(예금은행 가중평균금리)",
    sourceUrl: "https://ecos.bok.or.kr/#/SearchStat",
  },
  fred: {
    sourceLabel: "FRED DEXKOUS(미 연준 H.10)",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXKOUS",
  },
  wb: {
    sourceLabel: "World Bank Commodity Price Data(Pink Sheet)",
    sourceUrl: "https://www.worldbank.org/en/research/commodity-markets",
  },
  kosis: {
    sourceLabel: "국가데이터처 KOSIS(소비자물가지수)",
    sourceUrl: "https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1J22003",
  },
} as const;

export const LENS_ROWS: LensRow[] = [
  {
    id: "seoul-apt",
    name: "서울 아파트",
    detail: "매매가격지수 · 2026. 06. = 100",
    unit: "지수",
    license: "ok",
    decimals: 2,
    value: { now: 103.64, y5: 92.18, y10: 72.52 },
    basis: {
      asOf: "2026-10-31T00:00:00+09:00",
      asOfLabel: "2026. 10. 기준",
      sourceLabel: SRC.reb.sourceLabel,
      sourceUrl: SRC.reb.sourceUrl,
      attribution: "출처: 한국부동산원 R-ONE, 2026. 10.",
    },
    note: "지수는 2026. 06. = 100으로 다시 매긴 값입니다. 시세가 아니라 가격의 변화를 재는 지수입니다.",
  },
  {
    id: "krw-deposit",
    name: "원화 예금 1억",
    detail: "1년 정기예금 평균금리로 매년 재예치",
    unit: "원",
    license: "ok",
    decimals: 0,
    /* 현재 1억을 100으로 두고, 같은 금액을 그 시점에 넣었을 때의 값으로 되돌린다.
       now ÷ y5 = 1.172519(5년 누적), now ÷ y10 = 1.267884(10년 누적)이 되도록 맞춘 값이다. */
    value: {
      now: 100000000,
      y5: 100000000 / LENS_META.depositGrowth.y5,
      y10: 100000000 / LENS_META.depositGrowth.y10,
    },
    basis: {
      asOf: "2026-10-31T00:00:00+09:00",
      asOfLabel: "2026. 10. 금리 기준",
      sourceLabel: SRC.ecos.sourceLabel,
      sourceUrl: SRC.ecos.sourceUrl,
      attribution: "출처: 한국은행 ECOS · 금융기관 가중평균금리, 2026. 10.",
    },
    note: "10년 전 1억을 그때부터 매년 그 해 평균금리로 재예치한 평가액입니다(세전). 이자소득세 15.4%는 빼지 않았습니다.",
  },
  {
    id: "usd",
    name: "달러 1억어치",
    detail: "원/달러 환율에 그대로 둔 돈",
    unit: "원/달러",
    license: "ok",
    decimals: 2,
    value: { now: LENS_META.fx.now, y5: LENS_META.fx.y5, y10: LENS_META.fx.y10 },
    basis: {
      asOf: "2026-11-20T12:00:00-05:00",
      asOfLabel: "2026. 11. 20. 주간",
      sourceLabel: SRC.fred.sourceLabel,
      sourceUrl: SRC.fred.sourceUrl,
      attribution: "Source: U.S. Federal Reserve H.10 (FRED DEXKOUS), 2026. 11. 20.",
    },
    note: "뉴욕 정오 고시라 한국은행 매매기준율과 하루·수십 원 차이가 날 수 있습니다.",
  },
  {
    id: "gold",
    name: "금 1억어치",
    detail: "국제 금 월평균을 원화 g으로 환산",
    unit: "원/g",
    license: "ok",
    decimals: 1,
    value: {
      now: LENS_META.goldKrwPerG.now,
      y5: LENS_META.goldKrwPerG.y5,
      y10: LENS_META.goldKrwPerG.y10,
    },
    basis: {
      asOf: "2026-10-31T00:00:00+09:00",
      asOfLabel: "2026. 10. 월평균",
      sourceLabel: SRC.wb.sourceLabel,
      sourceUrl: SRC.wb.sourceUrl,
      attribution: "Source: World Bank Commodity Price Data (Pink Sheet), CC BY 4.0, 2026. 10.",
    },
    note: "국제 금 월평균에 그 달 평균 환율을 곱해 31.1034768g으로 나눈 계산값입니다. 국내 판매가에는 부가세와 수수료가 붙어 이 값보다 높습니다.",
  },
  {
    id: "cpi",
    name: "소비자물가",
    detail: "같은 돈으로 살 수 있는 양의 기준",
    unit: "지수",
    license: "ok",
    decimals: 2,
    value: { now: LENS_META.cpi.now, y5: LENS_META.cpi.y5, y10: LENS_META.cpi.y10 },
    basis: {
      asOf: "2026-10-31T00:00:00+09:00",
      asOfLabel: "2026. 10. 기준(11. 3. 공표)",
      sourceLabel: SRC.kosis.sourceLabel,
      sourceUrl: SRC.kosis.sourceUrl,
      attribution: "출처: 국가데이터처 KOSIS(소비자물가지수), 2026. 11. 3.",
    },
    note: "2020년 = 100. 2026년 12월 18일부터 2025년 기준(2025=100)으로 개편될 예정입니다.",
  },
  {
    id: "kospi",
    name: "코스피",
    detail: "한국거래소 지수 — 원본에서 확인",
    unit: "지수",
    license: "linked",
    decimals: 2,
    basis: {
      asOf: "2026-11-26T00:00:00+09:00",
      asOfLabel: "2026. 11. 26.",
      sourceLabel: "한국거래소",
      /* 2026-11-26 — http://www.krx.co.kr는 https로 넘어가고 지수 값이 첫 화면에 없다.
         값이 바로 보이는 TradingView 심볼 화면으로 보낸다(직접 GET 200 확인). */
      sourceUrl: "https://www.tradingview.com/symbols/KRX-KOSPI/",
      attribution: "출처: 한국거래소, 2026. 11. 26.",
    },
    link: { label: "코스피 시세 보기", org: "TradingView", href: "https://www.tradingview.com/symbols/KRX-KOSPI/" },
  },
  {
    id: "samsung",
    name: "삼성전자",
    detail: "개별 종목 시세 — 원본에서 확인",
    unit: "원",
    license: "linked",
    decimals: 0,
    basis: {
      asOf: "2026-11-26T00:00:00+09:00",
      asOfLabel: "2026. 11. 26.",
      sourceLabel: "한국거래소",
      sourceUrl: "https://www.tradingview.com/symbols/KRX-005930/",
      attribution: "출처: 한국거래소, 2026. 11. 26.",
    },
    link: { label: "삼성전자 시세 보기", org: "TradingView", href: "https://www.tradingview.com/symbols/KRX-005930/" },
  },
  {
    id: "sp500",
    name: "S&P500",
    detail: "S&P 다우존스 지수 — 원본에서 확인",
    unit: "지수",
    license: "linked",
    decimals: 2,
    basis: {
      asOf: "2026-11-26T00:00:00+09:00",
      asOfLabel: "2026. 11. 26.",
      sourceLabel: "S&P Dow Jones Indices",
      /* 2026-11-26 — spglobal.com/spdji 원문은 403 Forbidden(직접 GET 확인)이라 링크가 죽었다.
         값과 차트가 그대로 열리는 TradingView SPX 화면으로 바꾼다(GET 200 확인). */
      sourceUrl: "https://www.tradingview.com/symbols/SPX/",
      attribution: "Source: S&P Dow Jones Indices (TradingView 표시), 2026. 11. 26.",
    },
    link: {
      label: "S&P500 시세 보기",
      org: "TradingView",
      href: "https://www.tradingview.com/symbols/SPX/",
    },
  },
  {
    id: "nasdaq",
    name: "나스닥 종합",
    detail: "나스닥 지수 — 원본에서 확인",
    unit: "지수",
    license: "linked",
    decimals: 2,
    basis: {
      asOf: "2026-11-26T00:00:00+09:00",
      asOfLabel: "2026. 11. 26.",
      sourceLabel: "Nasdaq",
      /* 네이버·나스닥 원문은 응답이 들쭉날쭉해(2026-11-26 GET 200 확인) 값이 한 화면에 있는
         TradingView 심볼 화면을 대표 링크로 쓴다. 출처 표기는 원자료(Nasdaq)를 그대로 남긴다. */
      sourceUrl: "https://www.tradingview.com/symbols/IXIC/",
      attribution: "Source: Nasdaq (TradingView 표시), 2026. 11. 26.",
    },
    link: {
      label: "나스닥 종합 시세 보기",
      org: "TradingView",
      href: "https://www.tradingview.com/symbols/IXIC/",
    },
  },
];

/** 거시 스트립 4칸 — 값과 기준일이 각각 다르다. */
export const LENS_MACROS = [
  {
    id: "us10y",
    name: "미 국채 10년",
    value: "4.85%",
    asOfLabel: "2026. 11. 25. 고시",
    note: "CMT par yield",
    sourceLabel: "미 재무부",
    sourceUrl:
      "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202611",
    attribution: "Source: U.S. Department of the Treasury, 2026. 11. 25.",
  },
  {
    id: "ktb10y",
    name: "국고채 10년",
    value: "3.761%",
    asOfLabel: "2026. 11. 25. 마감",
    note: "금융투자협회 승인 전 — 원문 연결",
    sourceLabel: "금융투자협회·연합인포맥스",
    sourceUrl: "https://www.yna.co.kr/view/AKR20261125149151008",
    attribution: "출처: 금융투자협회(연합인포맥스 집계), 2026. 11. 25.",
  },
  {
    id: "cpi-yoy",
    name: "소비자물가 상승률",
    value: "2.8%",
    asOfLabel: "2026. 10. 전년동월비",
    note: "2026년 10월 소비자물가동향",
    sourceLabel: "국가데이터처",
    sourceUrl: "https://www.mods.go.kr/board.es?bid=213&mid=b70203010000",
    attribution: "출처: 국가데이터처(2026년 10월 소비자물가동향), 2026. 11. 3.",
  },
  {
    id: "base-rate",
    name: "기준금리",
    value: "3.00%",
    asOfLabel: "2026. 8. 27. 인상 이후",
    note: "10. 22. 금통위 동결",
    sourceLabel: "한국은행",
    sourceUrl: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643",
    attribution: "출처: 한국은행 기준금리, 2026. 8. 27.",
  },
] as const;

const PERIOD_KEY: Record<Exclude<LensPeriod, "now">, "y5" | "y10"> = { y5: "y5", y10: "y10" };

/** 행의 원화 수익률 — 값이 없으면 null */
export function lensKrw(row: LensRow, period: LensPeriod): number | null {
  if (!row.value) return null;
  if (period === "now") return 0;
  const past = row.value[PERIOD_KEY[period]];
  if (!past) return null;
  return row.value.now / past - 1;
}

export type LensCross = { krw: number; usd: number; gold: number; real: number };

/**
 * 3중 환산 — 같은 자산을 원화·달러·금·물가 네 기준으로 다시 읽는다.
 * r_usd = (1+r_krw)/(1+r_fx) − 1  (spec §4-4)
 */
export function lensCross(row: LensRow, period: LensPeriod): LensCross | null {
  const krw = lensKrw(row, period);
  if (krw === null) return null;
  if (period === "now") return { krw: 0, usd: 0, gold: 0, real: 0 };
  const fx = LENS_META.fx;
  const gold = LENS_META.goldKrwPerG;
  const cpi = LENS_META.cpi;
  const rFx = fx.now / fx[PERIOD_KEY[period]] - 1;
  const rGold = gold.now / gold[PERIOD_KEY[period]] - 1;
  const rCpi = cpi.now / cpi[PERIOD_KEY[period]] - 1;
  return {
    krw,
    usd: (1 + krw) / (1 + rFx) - 1,
    gold: (1 + krw) / (1 + rGold) - 1,
    real: (1 + krw) / (1 + rCpi) - 1,
  };
}

/** 1억을 넣었을 때의 평가액(원) */
export function lensWon(krw: number): number {
  return 100000000 * (1 + krw);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 위치 계기판 — 2016. 11. ~ 2026. 10. 월별 실측값에서 최소·최대·현재 위치를 센다.
 *
 * 왜 월별 값인가: 5년·10년 두 점만으로는 "지금이 그 사이 어디인가"를 말할 수 없다.
 * 원자료(R-ONE 아파트 매매지수·FRED 환율·World Bank 금값)를 120개월로 펼쳐 두고,
 * 그 안에서 최소·최대를 잡는다. 새 숫자를 만들지 않는다 — 전부 이 파일과
 * `money-lens-tracks.ts`의 배열에서만 나온다.
 * ──────────────────────────────────────────────────────────────────────────── */

export type LensUnit = "krw" | "usd" | "gold";

/** 저점~고점 사이 어디인지 — 여섯 칸 */
export type LensBand = "고점권" | "중상단" | "중간" | "중하단" | "저점권" | "기준";

export type LensGauge = {
  unit: LensUnit;
  /** 0~100 */
  position: number;
  band: LensBand;
  min: number;
  max: number;
  now: number;
  /** 같은 기간 그 단위로 본 수익률. 자기 단위(달러 자산의 달러)면 0. */
  ret: number;
  /** 자기 자신이 기준인 단위 — 게이지 대신 '기준'으로 그린다. */
  self: boolean;
};

export type LensGaugeSet = {
  id: LensId;
  name: string;
  detail: string;
  attribution: string;
  from: string;
  to: string;
  months: number;
  unitLabel: string;
  krw: number;
  units: Record<LensUnit, LensGauge>;
};

/** 게이지에 올리는 핵심 4개 — 서울 아파트 · 원화 예금 1억 · 달러 1억 · 금 1억 */
export const LENS_GAUGE_IDS: LensId[] = ["seoul-apt", "krw-deposit", "usd", "gold"];

const TRACK_START_Y = 2016;
const TRACK_START_M = 11;

/** i번째 달의 'YYYY. M.' 표기 — 각주·툴팁용 */
export function lensTrackMonth(i: number): string {
  const t = TRACK_START_Y * 12 + (TRACK_START_M - 1) + i;
  return `${Math.floor(t / 12)}. ${(t % 12) + 1}.`;
}

/** 그 달에 적용되는 12개월 창 평균금리(연, %) */
function depositRateOf(i: number): number {
  const t = TRACK_START_Y * 12 + (TRACK_START_M - 1) + i;
  const y = Math.floor(t / 12);
  const m = (t % 12) + 1;
  const key = y * 100 + m;
  const hit = LENS_META.deposit.windows.find((w) => {
    const [fy, fm] = w.from.split(".").map(Number);
    const [ty, tm] = w.to.split(".").map(Number);
    return key >= fy * 100 + fm && key <= ty * 100 + tm;
  });
  return hit ? hit.rate : LENS_META.deposit.nowRate;
}

/**
 * 1억을 2016. 11.에 넣었을 때의 누적 배수 — 예금만 해당.
 * 첫 달은 1.0(넣은 달), 그다음 달부터 그 달의 창 평균금리를 월 복리로 굴린다.
 * 10년 뒤 값이 `LENS_META.depositGrowth.y10`(1.267884)과 맞도록 반올림 오차만 남긴다.
 */
const DEPOSIT_TRACK: readonly number[] = (() => {
  const out: number[] = [];
  let mult = 1;
  for (let i = 0; i < LENS_TRACK_COUNT; i += 1) {
    if (i > 0) mult *= Math.pow(1 + depositRateOf(i) / 100, 1 / 12);
    out.push(mult);
  }
  return out;
})();

/** 자산별 '원화 1억 배수' 시계열 — 지수는 지수대로, 금액은 금액대로 1억 기준으로 맞춘다. */
function krwTrack(id: LensId): readonly number[] {
  switch (id) {
    case "seoul-apt":
      return LENS_TRACK_APT.map((v) => v / LENS_TRACK_APT[0]);
    case "krw-deposit":
      return DEPOSIT_TRACK;
    case "usd":
      return LENS_TRACK_FX.map((v) => v / LENS_TRACK_FX[0]);
    case "gold":
      return LENS_TRACK_GOLD.map((v) => v / LENS_TRACK_GOLD[0]);
    default:
      return [];
  }
}

/**
 * 지금(2026. 10. 값)의 1억 배수 — **시계열과 같은 기준(2016. 11. 월평균)** 으로 나눈다.
 * fx.y10(2016-11-18 주간 고시)로 나누면 시계열의 출발점(2016. 11. 월평균)과 1.3% 어긋나
 * 위치가 3%p쯤 밀린다. 게이지의 세로선은 시계열 위에 있어야 하므로 기준을 하나로 맞춘다.
 */
function nowMultiplier(id: LensId): number {
  switch (id) {
    case "seoul-apt":
      return 103.644 / LENS_TRACK_APT[0];
    case "krw-deposit":
      return LENS_META.depositGrowth.y10;
    case "usd":
      return LENS_META.fx.now / LENS_TRACK_FX[0];
    case "gold":
      return LENS_META.goldKrwPerG.now / LENS_TRACK_GOLD[0];
    default:
      return 1;
  }
}

const UNIT_PRICE_NOW: Record<Exclude<LensUnit, "krw">, number> = {
  usd: LENS_META.fx.now,
  gold: LENS_META.goldKrwPerG.now,
};

function bandOf(position: number): LensBand {
  if (position >= 85) return "고점권";
  if (position >= 60) return "중상단";
  if (position >= 40) return "중간";
  if (position >= 15) return "중하단";
  return "저점권";
}

/**
 * 자산 하나를 세 단위(원화·달러·금)로 본 위치 게이지.
 * `period`는 창의 길이만 바꾼다(10년 = 120개월, 5년 = 60개월). 수익률은 lensCross와 같은 점값 계산이다.
 */
export function lensGauges(id: LensId, period: Exclude<LensPeriod, "now">): LensGaugeSet | null {
  const row = LENS_ROWS.find((r) => r.id === id);
  if (!row || !row.value) return null;
  const krwSeries = krwTrack(id);
  if (krwSeries.length !== LENS_TRACK_COUNT) return null;

  const months = period === "y10" ? 120 : 60;
  const startIndex = LENS_TRACK_COUNT - months;
  const cross = lensCross(row, period);
  const nowKrw = nowMultiplier(id);

  const make = (unit: LensUnit): LensGauge => {
    const prices = unit === "krw" ? null : unit === "usd" ? LENS_TRACK_FX : LENS_TRACK_GOLD;
    const series = prices ? krwSeries.map((k, i) => k / prices[i]) : krwSeries;
    const now = prices ? nowKrw / UNIT_PRICE_NOW[unit] : nowKrw;
    const window = series.slice(startIndex);
    const min = Math.min(...window);
    const max = Math.max(...window);
    const raw = max > min ? ((now - min) / (max - min)) * 100 : 100;
    const position = Math.max(0, Math.min(100, raw));
    const self = (id === "usd" && unit === "usd") || (id === "gold" && unit === "gold");
    return {
      unit,
      position: self ? 100 : position,
      band: self ? "기준" : bandOf(position),
      min,
      max,
      now,
      ret: self || !cross ? 0 : unit === "usd" ? cross.usd : unit === "gold" ? cross.gold : cross.krw,
      self,
    };
  };

  const unitLabel =
    id === "seoul-apt"
      ? `지수 ${row.value.now.toFixed(row.decimals)} (2026. 06. = 100)`
      : id === "krw-deposit"
        ? `1억 → ${lensWon(lensKrw(row, period) ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`
        : id === "usd"
          ? `${LENS_META.fx.now.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원/달러`
          : `g당 ${Math.round(LENS_META.goldKrwPerG.now).toLocaleString("ko-KR")}원`;

  const startIdx = period === "y10" ? 0 : startIndex;
  return {
    id,
    name: row.name,
    detail: row.detail,
    attribution: row.basis.attribution,
    from: lensTrackMonth(startIdx),
    to: lensTrackMonth(LENS_TRACK_COUNT - 1),
    months,
    unitLabel,
    krw: lensKrw(row, period) ?? 0,
    units: { krw: make("krw"), usd: make("usd"), gold: make("gold") },
  };
}

/** 화면·검증이 함께 쓰는 계기판 묶음 */
export const LENS_GAUGES = {
  y10: LENS_GAUGE_IDS.map((id) => lensGauges(id, "y10")).filter((g): g is LensGaugeSet => Boolean(g)),
  y5: LENS_GAUGE_IDS.map((id) => lensGauges(id, "y5")).filter((g): g is LensGaugeSet => Boolean(g)),
} as const;

export const LENS_TRACK_RANGE = { start: LENS_TRACK_START, end: LENS_TRACK_END, count: LENS_TRACK_COUNT } as const;

/**
 * 착시 퀴즈 3문항 (spec §5-2) — 정답·해설·출구 링크를 데이터에서 읽는다.
 * 계산값은 이 파일의 실데이터로 다시 센다(문서 예시값을 그대로 옮겨 적지 않는다).
 */
export const LENS_QUIZ = [
  {
    id: "q1",
    question: "예금 이자 3.0%, 물가 상승 3.5%. 1년 뒤 내 돈은?",
    options: ["0.5% 늘었다", "0.5% 줄었다", "그대로다"],
    answer: 1,
    solution: "(1.03 ÷ 1.035) − 1 = −0.48%. 1억이면 실질 9,952만 원입니다.",
    extra: "이자에 붙는 세금 15.4%까지 넣으면 3% × 0.846 = 2.54%라 실질 −0.93%가 됩니다.",
    exits: [
      { label: "예금·적금 계산기", href: "/apps/compound-return/run" },
      { label: "예금자보호 한도 1억 확인", href: "/posts/deposit-protection-limit-100-million-check" },
    ],
  },
  {
    id: "q2",
    question:
      "10년 전 1억으로 산 서울 아파트가 오늘 1억 4,291만 원이 됐습니다. 같은 기간 원/달러는 1,177.71 → 1,342.41, 원화 금값은 3.81배, 소비자물가는 1.255배. 가장 많이 오른 기준은?",
    options: ["원화", "달러", "금", "물가"],
    answer: 0,
    solution: "원화 +42.9% / 달러 +25.4% / 물가 +13.9% / 금 −62.5%.",
    extra:
      "같은 집이 기준을 바꾸면 +42.9%에서 −62.5%까지 갑니다. 파는 사람과 사는 사람이 같은 집을 두고 다른 말을 하는 이유입니다.",
    exits: [
      { label: "계기판 10년 탭 열기", href: "/money-lens/" },
      { label: "환율이 오르면 장바구니", href: "/posts/economy-fx-grocery" },
    ],
  },
  {
    id: "q3",
    question:
      "10년 전 가입한 암 진단비 3,000만 원. 소비자물가가 1.255배가 됐다면 오늘 이 보장의 실질 가치는?",
    options: ["3,000만 원", "약 2,390만 원", "약 3,840만 원"],
    answer: 1,
    solution: "3,000 ÷ 1.255 = 2,390만 원. 줄어든 610만 원은 보험료가 아니라 시간이 가져갔습니다.",
    extra:
      "보장 금액을 올릴지 말지는 갱신·재가입 조건과 건강 고지에 달려 있습니다. 금액만 보고 정하지 않습니다.",
    exits: [
      { label: "보장 점검 시뮬레이터", href: "/apps/coverage-check/run" },
      { label: "보장은 지급 조건으로 확인", href: "/posts/insurance-coverage-conditions" },
    ],
  },
] as const;

/** 3단계 하단 '더 읽기' — 같은 '기준 바꾸기' 훈련으로 이어지는 글 3편 */
export const LENS_POSTS = [
  { id: "economy-fx-grocery", title: "환율이 오르면 장바구니에서 무엇이 먼저 오르나", why: "환율이 생활물가로 넘어가는 경로" },
  {
    id: "invest-dividend-total-return",
    title: "배당은 수익이 아니다 — 총수익으로 다시 계산하기",
    why: "같은 숫자를 다른 기준으로 다시 세는 연습",
  },
  { id: "philosophy-numbers-are-questions", title: "숫자는 결론이 아니라 질문이다", why: "이 모델이 숫자를 대하는 태도" },
] as const;
