/**
 * 금융·연금 계산의 공통 가정과 계산식.
 *
 * 홈 히어로 카드·홈 스트립·실행 화면이 같은 숫자를 말하도록 한 곳에서 계산한다.
 * 금액 단위는 모두 '만원'이다(화면 표기와 같은 단위로 두어 반올림이 겹치지 않게).
 *
 * 계산은 단순화한 가정 위에서만 한다. 결과는 확정액이 아니라 '확인할 항목'을 만들기 위한 값이다.
 */

import {
  INCOME_TAX,
  ISA,
  PENSION_ACCOUNT,
  PENSION_MAX_CREDIT_WON,
  PRIVATE_PENSION_TAX as PRIVATE_PENSION_TAX_SOURCE,
  PUBLIC_PENSION_HEALTH_LIMIT,
} from "@/data/tax-rules";

export { PUBLIC_PENSION_HEALTH_LIMIT };

/**
 * 연금저축·IRP 한도와 공제율 — 값은 `data/tax-rules.ts` 한 곳에만 있다.
 * 이 객체는 기존 화면·계산기가 쓰던 이름(totalLimit·rateLow)을 그대로 유지하기 위한 얇은 별칭이다.
 */
export const PENSION_RULE = {
  /** 연금저축 단독 한도 */
  selfLimit: PENSION_ACCOUNT.savingsLimit,
  /** 연금저축 + IRP 합산 한도 */
  totalLimit: PENSION_ACCOUNT.combinedLimit,
  /** ISA 만기 이전 시 추가 한도(이전액의 10%, 최대 300만원) */
  isaLimit: PENSION_ACCOUNT.isaTransferMax,
  /** 총급여 5,500만원 이하 공제율 (지방소득세 포함) */
  rateLow: PENSION_ACCOUNT.creditRateLow,
  /** 총급여 5,500만원 초과 공제율 (지방소득세 포함) */
  rateHigh: PENSION_ACCOUNT.creditRateHigh,
} as const;

/** 세액공제 최대액(합산 900만 × 16.5%) — 원 단위 */
export const PENSION_MAX_CREDIT = PENSION_MAX_CREDIT_WON;

/** 은퇴 시뮬레이터·복리 계산기의 기본 가정 */
export const FINANCE_DEFAULTS = {
  inflation: 0.025,
  returnRate: 0.04,
} as const;

/**
 * 연 수익률을 월 단위로 바꾼다.
 * 명목 연율을 12제곱근으로 나눈 값 — 12로 단순히 나누는 방식보다 1년 뒤 값이 정확히 맞는다.
 */
export function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** 적립식 미래가치 — 매달 같은 금액을 넣을 때의 기말 적립 합계 */
export function futureValueOfDeposits(monthly: number, annual: number, months: number): number {
  if (months <= 0 || monthly === 0) return 0;
  const r = monthlyRate(annual);
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

/** 거치식 미래가치 */
export function futureValue(present: number, annual: number, years: number): number {
  return present * Math.pow(1 + annual, years);
}

/**
 * 적립금을 정해진 기간에 나눠 받을 때의 월 수령액(원리금 균등).
 * 은퇴 시점 적립금을 '수령 기간 동안 같은 금액으로' 받는다고 볼 때 쓴다.
 */
export function annuityMonthly(present: number, annual: number, months: number): number {
  if (present <= 0 || months <= 0) return 0;
  const r = monthlyRate(annual);
  if (r === 0) return present / months;
  return (present * r) / (1 - Math.pow(1 + r, -months));
}

export type RetirementInput = {
  /** 현재 나이(세) */
  currentAge: number;
  /** 은퇴 희망 나이(세) */
  retireAge: number;
  /** 기대 수명(세) — 은퇴부터 이 나이까지 받는다고 본다 */
  lifeAge: number;
  /** 예상 국민연금 월 수령액(만원, 오늘 가치) */
  npsMonthly: number;
  /** 퇴직연금 적립금(만원) */
  dcBalance: number;
  /** 개인연금(연금저축·IRP) 적립금(만원) */
  personalBalance: number;
  /** 개인연금 월 납입액(만원) */
  personalMonthly: number;
  /** 연평균 물가상승률(0.025 = 2.5%) */
  inflation: number;
  /** 연 기대 수익률(0.04 = 4.0%) */
  returnRate: number;
  /** 은퇴 후 목표 월 생활비(만원, 오늘 가치) */
  targetMonthly: number;
};

export type RetirementResult = {
  /** 은퇴까지 남은 햇수 */
  years: number;
  /** 수령 기간(년) */
  payoutYears: number;
  /** 은퇴 시점 개인연금 적립금(만원) */
  personalAtRetire: number;
  /** 은퇴 시점 퇴직연금 적립금(만원) */
  dcAtRetire: number;
  /** 은퇴 시점의 물가 배수 — 오늘 1원이 이 배수가 된다 */
  inflationFactor: number;
  /** 은퇴 시점 월 수령액(만원, 명목) */
  nominal: { nps: number; dc: number; personal: number; total: number };
  /** 같은 금액을 오늘 가치로 환산한 값(만원) */
  real: { nps: number; dc: number; personal: number; total: number };
  /** 목표 월 생활비(오늘 가치, 만원) */
  targetMonthly: number;
  /** 목표 대비 차이(오늘 가치, 만원) — 음수면 부족 */
  gap: number;
  /** 목표 대비 비율(1 = 목표와 같음) */
  ratio: number;
  /** 적립금 대비 연 인출률(연 수령액 ÷ 은퇴 시점 적립금) */
  withdrawalRate: number;
};

export function retirementProjection(input: RetirementInput): RetirementResult {
  const years = Math.max(0, input.retireAge - input.currentAge);
  const payoutYears = Math.max(1, input.lifeAge - input.retireAge);
  const months = Math.round(payoutYears * 12);
  const savedMonths = Math.round(years * 12);

  const personalAtRetire =
    futureValue(input.personalBalance, input.returnRate, years) +
    futureValueOfDeposits(input.personalMonthly, input.returnRate, savedMonths);
  const dcAtRetire = futureValue(input.dcBalance, input.returnRate, years);

  const personalMonthly = annuityMonthly(personalAtRetire, input.returnRate, months);
  const dcMonthly = annuityMonthly(dcAtRetire, input.returnRate, months);

  const inflationFactor = Math.pow(1 + input.inflation, years);
  /* 국민연금은 물가에 따라 조정된다고 보아, 은퇴 시점 명목액은 오늘 가치 × 물가 배수로 둔다. */
  const npsNominal = input.npsMonthly * inflationFactor;

  const nominalTotal = npsNominal + dcMonthly + personalMonthly;
  const realTotal = inflationFactor > 0 ? nominalTotal / inflationFactor : nominalTotal;
  const annuityAssets = dcAtRetire + personalAtRetire;
  const annuityAnnual = (dcMonthly + personalMonthly) * 12;

  return {
    years,
    payoutYears,
    personalAtRetire,
    dcAtRetire,
    inflationFactor,
    nominal: {
      nps: npsNominal,
      dc: dcMonthly,
      personal: personalMonthly,
      total: nominalTotal,
    },
    real: {
      nps: npsNominal / inflationFactor,
      dc: dcMonthly / inflationFactor,
      personal: personalMonthly / inflationFactor,
      total: realTotal,
    },
    targetMonthly: input.targetMonthly,
    gap: realTotal - input.targetMonthly,
    ratio: input.targetMonthly > 0 ? realTotal / input.targetMonthly : 0,
    withdrawalRate: annuityAssets > 0 ? annuityAnnual / annuityAssets : 0,
  };
}

export type TaxMode = "general" | "isa" | "pension";

export const TAX_MODE: Record<
  TaxMode,
  { label: string; short: string; rate: number; exempt: number; note: string }
> = {
  general: {
    label: `일반과세 ${(INCOME_TAX.dividendWithLocal * 100).toFixed(1)}%`,
    short: "일반계좌",
    rate: INCOME_TAX.dividendWithLocal,
    exempt: 0,
    note: `이자·배당소득세 ${(INCOME_TAX.dividendWithLocal * 100).toFixed(1)}%(소득세 14% + 지방소득세 1.4%). 금융소득 연 ${INCOME_TAX.financialIncomeThreshold.toLocaleString("ko-KR")}만원 초과 시 종합과세`,
  },
  isa: {
    label: `ISA ${(ISA.taxRate * 100).toFixed(1)}%`,
    short: "ISA",
    rate: ISA.taxRate,
    exempt: ISA.exemptGeneral,
    note: `일반형: 이익 ${ISA.exemptGeneral}만원까지 비과세, 초과분 ${(ISA.taxRate * 100).toFixed(1)}% 분리과세(서민형·농어민형은 ${ISA.exemptSeomin}만원). 의무 가입 ${ISA.minYears}년`,
  },
  pension: {
    label: "연금저축 과세이연",
    short: "연금저축",
    rate: PRIVATE_PENSION_TAX_SOURCE.rateUnder70,
    exempt: 0,
    note: "운용 중 과세이연, 인출 시 연금소득세 3.3~5.5% 가정. 55세·5년 이상 납입 요건",
  },
};

/**
 * 사적연금(연금저축·IRP) 수령액의 과세 기준 — 연 1,500만원(월 125만원).
 *
 * 국세청 안내(연금소득 과세표준 확정신고): 사적연금 합계액이 연 1,500만원을 넘으면
 * ① 다른 소득과 합산해 종합소득세로 신고하거나 ② 15% 분리과세(지방소득세 포함 16.5%) 중
 * 하나를 고를 수 있다. 16.5%는 '종합과세 세율'이 아니라 이때 고를 수 있는 분리과세율이다.
 * 값은 `data/tax-rules.ts`에서 온다.
 */
export const PRIVATE_PENSION_TAX = {
  annualThreshold: PRIVATE_PENSION_TAX_SOURCE.annualThreshold,
  monthlyThreshold: PRIVATE_PENSION_TAX_SOURCE.monthlyThreshold,
  lowRate: PRIVATE_PENSION_TAX_SOURCE.rate80,
  highRate: PRIVATE_PENSION_TAX_SOURCE.rateUnder70,
  /** 초과 시 선택 가능한 분리과세율 15%(소득세법 제64조의4) */
  overThresholdSeparateRate: PRIVATE_PENSION_TAX_SOURCE.separateRate,
  /** 위 15%에 지방소득세 10%를 더한 16.5% */
  overThresholdSeparateRateWithLocal: PRIVATE_PENSION_TAX_SOURCE.separateRateWithLocal,
} as const;

export type CompoundInput = {
  /** 초기 투자금(만원) */
  initial: number;
  /** 월 적립액(만원) */
  monthly: number;
  /** 투자 기간(년) */
  years: number;
  /** 연 기대 수익률(0.05 = 5%) */
  rate: number;
  /** 연 운용 보수·수수료율(0.003 = 0.3%) — 수익률에서 차감한다 */
  fee?: number;
  /** 과세 방식 */
  mode: TaxMode;
};

export type CompoundResult = {
  /** 총 납입 원금(만원) */
  principal: number;
  /** 운용수익 (수수료 차감 후·세전, 만원) */
  gross: number;
  /** 평가손익(만원) */
  gain: number;
  /** 누적 보수·수수료가 줄인 금액(복리 영향 포함, 만원) */
  feeCost: number;
  /** 적용한 연 보수율 */
  feeRate: number;
  /** 예상 세금(만원) */
  tax: number;
  /** 세후 평가액(만원) */
  net: number;
  /** 적용 세율 */
  taxRate: number;
  /** 보수 차감 후 실제로 적용한 연 수익률(화면 표기가 계산과 어긋나지 않도록 함께 돌려준다) */
  netRate: number;
  /** 비과세로 뺀 금액(ISA 일반형 200만원 등) */
  exempt: number;
  /** 원금 대비 세후 수익률 */
  netReturn: number;
  /** 원금 대비 세전 수익률 */
  grossReturn: number;
  /** 월 납입 개월 수 */
  months: number;
};

/** 수수료·세금을 반영하지 않은 계산 (비교용) */
function grossWithoutFee(input: CompoundInput): number {
  return (
    futureValue(input.initial, input.rate, input.years) +
    futureValueOfDeposits(input.monthly, input.rate, Math.round(input.years * 12))
  );
}

export function compoundProjection(input: CompoundInput): CompoundResult {
  const months = Math.round(input.years * 12);
  const feeRate = Math.max(0, input.fee ?? 0);
  /** 보수는 수익률에서 빠지는 비용이다 — 수익률이 보수보다 작으면 그만큼 손실이 된다. */
  const netRate = Math.max(input.rate - feeRate, -0.99);
  const principal = input.initial + input.monthly * months;
  const gross =
    futureValue(input.initial, netRate, input.years) + futureValueOfDeposits(input.monthly, netRate, months);
  const gain = Math.max(0, gross - principal);
  const feeCost = Math.max(0, grossWithoutFee(input) - gross);
  const taxRate = TAX_MODE[input.mode].rate;
  const exempt = TAX_MODE[input.mode].exempt;
  const tax = Math.max(0, gain - exempt) * taxRate;
  const net = gross - tax;
  return {
    principal,
    gross,
    gain,
    feeCost,
    feeRate,
    tax,
    net,
    taxRate,
    exempt,
    netRate,
    netReturn: principal > 0 ? net / principal - 1 : 0,
    grossReturn: principal > 0 ? gross / principal - 1 : 0,
    months,
  };
}

/* ------------------------------------------------------------------
   홈 히어로 카드·스트립이 쓰는 예시 입력값.
   실행 화면의 기본값과 같은 값을 쓴다 — 두 화면의 숫자가 어긋나지 않게.
   ------------------------------------------------------------------ */
export const RETIREMENT_EXAMPLE: RetirementInput = {
  currentAge: 45,
  retireAge: 65,
  lifeAge: 90,
  npsMonthly: 120,
  dcBalance: 8000,
  personalBalance: 5000,
  personalMonthly: 50,
  inflation: FINANCE_DEFAULTS.inflation,
  returnRate: FINANCE_DEFAULTS.returnRate,
  targetMonthly: 250,
};

/** 복리 계산기의 손실 가정 — 기대 수익률과 분리해 '같은 기간 연 -3.0%'를 보여 준다 */
export const COMPOUND_DOWNSIDE_RATE = -0.03;

export const COMPOUND_EXAMPLE: CompoundInput = {
  initial: 1000,
  monthly: 50,
  years: 20,
  rate: 0.05,
  fee: 0.003,
  mode: "general",
};

/** 예: 442만 3,000원 → "442만원" (만원 단위 반올림, 큰 값은 억 단위) */
export function manLabel(value: number, digits = 0): string {
  const v = Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);
  if (Math.abs(v) >= 10000) {
    const eok = Math.floor(v / 10000);
    const man = Math.round(v % 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만원` : `${eok}억원`;
  }
  return `${v.toLocaleString("ko-KR")}만원`;
}

/** 예: 0.123 → "12.3%" */
export function pctLabel(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}
