/**
 * 4대 계좌(일반·ISA·연금저축·IRP) 세후 비교 — 계산만 담당하는 순수 함수.
 *
 * 화면(AccountTaxCompare.tsx)은 이 함수의 결과를 그리기만 한다.
 * 숫자의 근거는 아래 상수에 모아 두고, 화면의 '적용 세율' 칸도 같은 값을 읽는다.
 *
 * 기준 2026. 11. 21. (소득세법·조세특례제한법·근로자퇴직급여 보장법)
 */

export type AssetType = "domestic" | "global";
export type PayoutMode = "pension" | "lump";
export type IsaType = "general" | "seomin";
export type AgeBand = "55" | "70" | "80" | "lifetime";

/** 배당소득세(지방소득세 포함) */
export const DIVIDEND_TAX = 0.154;
/** ISA 비과세 초과분 분리과세(지방소득세 포함) */
export const ISA_TAX = 0.099;
/** 연금계좌 연금 외 수령 기타소득세(지방소득세 포함) */
export const PENSION_LUMP_TAX = 0.165;
/** 사적연금 연 1,500만원 기준 */
export const PENSION_ANNUAL_LIMIT = 1500;
/** ISA 비과세 한도(만원) */
export const ISA_EXEMPT: Record<IsaType, number> = { general: 200, seomin: 400 };
/** 세액공제: 연금저축 600만원, IRP 포함 900만원 */
export const CREDIT_LIMIT = { pension: 600, irp: 900 } as const;

export const AGE_RATE: Record<AgeBand, { rate: number; label: string }> = {
  "55": { rate: 0.055, label: "55~69세 5.5%" },
  "70": { rate: 0.044, label: "70~79세 4.4%" },
  "80": { rate: 0.033, label: "80세 이상 3.3%" },
  lifetime: { rate: 0.033, label: "종신형 3.3%" },
};

export const ASSET_LABEL: Record<AssetType, string> = {
  domestic: "국내주식형",
  global: "해외·배당·채권형",
};

export type AccountInput = {
  /** 원금(만원) */
  principal: number;
  /** 보유 기간(년) */
  years: number;
  /** 연 수익률(%) */
  ratePct: number;
  asset: AssetType;
  payout: PayoutMode;
  /** 연금 수령 시 나눠 받는 기간(년) */
  payoutYears: number;
  age: AgeBand;
  isaType: IsaType;
  /** 연 배당·분배금 수익률 가정(%) — 국내주식형 일반계좌 계산에만 쓴다 */
  distYieldPct: number;
  /** 세액공제 반영 여부 */
  creditOn: boolean;
  /** 공제율(%) — 16.5 또는 13.2 */
  creditRatePct: number;
};

export type AccountResult = {
  key: "general" | "isa" | "pension" | "irp";
  name: string;
  short: string;
  /** 세금이 붙는 시점 */
  when: string;
  /** 적용 세율 표기 — 근거와 함께 */
  rateLabel: string;
  rateDetail: string;
  tax: number;
  /** 납입 시 세액공제(참고) */
  credit: number;
  /** 세후 실수령 = 평가액 − 세금 + 세액공제 */
  net: number;
  /** 세금·세액공제를 빼기 전 평가액 */
  value: number;
  /** 적용 세율(0~1) — 막대·표기용 */
  rate: number;
};

export type AccountCompareResult = {
  value: number;
  principal: number;
  gain: number;
  annualPension: number;
  rows: AccountResult[];
  /** 세후 1위 계좌 키 */
  best: AccountResult["key"];
  /** 세금만 비교한 1위(세액공제 제외) */
  bestByTax: AccountResult["key"];
};

const won = (man: number) => man;
const fine = (v: number) => Math.round(v * 10) / 10;

export function compareAccounts(input: AccountInput): AccountCompareResult {
  const principal = Math.max(0, input.principal);
  const years = Math.max(1, input.years);
  const growth = Math.pow(1 + Math.max(0, input.ratePct) / 100, years);
  const value = principal * growth;
  const gain = Math.max(0, value - principal);

  /* 일반계좌 — 국내주식형은 매매차익 비과세, 분배금만 15.4% */
  const distYield = Math.max(0, input.distYieldPct) / 100;
  const dividends = Math.min(gain, principal * distYield * years);
  const generalTax =
    input.asset === "domestic" ? dividends * DIVIDEND_TAX : gain * DIVIDEND_TAX;

  /* ISA — 비과세 한도(계좌 전체 누적)를 뺀 순이익에 9.9% */
  const isaExempt = ISA_EXEMPT[input.isaType];
  const isaTax = Math.max(0, gain - isaExempt) * ISA_TAX;

  /* 연금계좌 — 인출 방식과 나이로 세율이 갈린다 */
  const annualPension = input.payout === "pension" ? value / Math.max(1, input.payoutYears) : 0;
  const overLimit = input.payout === "pension" && annualPension > PENSION_ANNUAL_LIMIT;
  const ageRate = overLimit ? PENSION_LUMP_TAX : AGE_RATE[input.age].rate;
  const pensionTax = input.payout === "lump" ? value * PENSION_LUMP_TAX : value * ageRate;

  /* 세액공제 — 계좌별 연 한도 × 납입 연수(원금을 연수로 나눠 낸 것으로 본다) */
  const creditOf = (key: "pension" | "irp") => {
    if (!input.creditOn) return 0;
    const perYear = Math.min(input.creditRatePct / 100, 0.165);
    const cap = CREDIT_LIMIT[key] * years;
    return Math.min(principal, cap) * perYear;
  };

  const rows: AccountResult[] = [
    {
      key: "general",
      name: "일반계좌",
      short: "일반",
      when: "수익이 날 때마다",
      rateLabel:
        input.asset === "domestic" ? "매매차익 비과세 · 분배금 15.4%" : "배당소득 15.4%",
      rateDetail:
        input.asset === "domestic"
          ? "국내주식형 ETF 매매차익은 비과세, 분배금은 배당소득으로 과세"
          : "해외·채권·배당형은 매매차익과 분배금 모두 배당소득 15.4%",
      tax: generalTax,
      credit: 0,
      net: value - generalTax,
      value,
      rate: input.asset === "domestic" ? (gain > 0 ? generalTax / gain : 0) : DIVIDEND_TAX,
    },
    {
      key: "isa",
      name: "중개형 ISA",
      short: "ISA",
      when: "만기·해지 정산 때",
      rateLabel: `${isaExempt.toLocaleString("ko-KR")}만원 비과세 + 초과분 9.9%`,
      rateDetail:
        input.isaType === "general"
          ? "일반형 순이익 200만원까지 비과세, 초과분 9.9% 분리과세"
          : "서민형·농어민형 순이익 400만원까지 비과세, 초과분 9.9% 분리과세",
      tax: isaTax,
      credit: 0,
      net: value - isaTax,
      value,
      rate: gain > 0 ? isaTax / gain : 0,
    },
    {
      key: "pension",
      name: "연금저축",
      short: "연금저축",
      when: input.payout === "lump" ? "꺼낼 때(연금 외)" : "꺼낼 때(연금)",
      rateLabel:
        input.payout === "lump"
          ? "기타소득 16.5%"
          : overLimit
            ? "1,500만원 초과 · 16.5% 분리과세 가정"
            : `연금소득세 ${AGE_RATE[input.age].label}`,
      rateDetail:
        input.payout === "lump"
          ? "세액공제 받은 납입금과 운용수익에 기타소득세 16.5%"
          : overLimit
            ? `연 ${Math.round(annualPension).toLocaleString("ko-KR")}만원 수령으로 1,500만원 기준 초과 — 종합과세와 16.5% 중 큰 쪽을 가정`
            : `연 ${Math.round(annualPension).toLocaleString("ko-KR")}만원 수령(1,500만원 이하) · ${AGE_RATE[input.age].label}`,
      tax: pensionTax,
      credit: creditOf("pension"),
      net: value - pensionTax + creditOf("pension"),
      value,
      rate: input.payout === "lump" ? PENSION_LUMP_TAX : ageRate,
    },
    {
      key: "irp",
      name: "IRP",
      short: "IRP",
      when: input.payout === "lump" ? "꺼낼 때(연금 외)" : "꺼낼 때(연금)",
      rateLabel:
        input.payout === "lump"
          ? "기타소득 16.5%"
          : overLimit
            ? "1,500만원 초과 · 16.5% 분리과세 가정"
            : `연금소득세 ${AGE_RATE[input.age].label}`,
      rateDetail:
        "위험자산 70% 한도 · 중도인출은 법정 사유에만 가능" +
        (input.creditOn ? " · 세액공제 900만원까지" : " · 세액공제 미반영"),
      tax: pensionTax,
      credit: creditOf("irp"),
      net: value - pensionTax + creditOf("irp"),
      value,
      rate: input.payout === "lump" ? PENSION_LUMP_TAX : ageRate,
    },
  ];

  const best = rows.reduce((a, b) => (b.net > a.net ? b : a)).key;
  const bestByTax = rows.reduce((a, b) => (b.tax < a.tax ? b : a)).key;

  return {
    value: won(value),
    principal,
    gain,
    annualPension: fine(annualPension),
    rows,
    best,
    bestByTax,
  };
}
