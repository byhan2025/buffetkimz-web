/**
 * 2026년 세율·한도 단일 출처(single source of truth) — v7.7.0.
 *
 * 왜 한 파일인가
 *  · 같은 숫자가 홈 미리보기·계산기 코드·앱 설명·글 본문에 흩어져 있으면 한 곳만 고쳐도
 *    다른 화면이 옛 숫자를 말한다. 실제로 v7.5까지 '16.5%'와 '16.0%', '900만'과 '1,000만',
 *    '13만'과 '15만'이 화면마다 어긋난 적이 있다.
 *  · 그래서 **계산에 쓰는 상수와 화면에 쓰는 표기 문자열을 모두 이 파일에서 만든다.**
 *    계산기·데이터·설명 문구는 여기서 가져다 쓴다.
 *  · 빌드 뒤 `scripts/verify_tax_consistency.py`가 dist의 문구와 소스의 상수를 대조해
 *    상충 표기가 다시 생기면 실패한다.
 *
 * 단위 규칙
 *  · 금액은 '만원' 단위 숫자로 둔다(화면 표기와 같은 단위 — 반올림이 겹치지 않게).
 *  · 세율은 소수(0.165 = 16.5%)로 둔다. 지방소득세 10%를 포함한 값은 이름에 `WithLocal`을 붙인다.
 *
 * 근거
 *  · 소득세법 제59조의3(연금계좌 세액공제)·제20조의3·제64조의4(연금소득)·제47조의2(연금소득공제)
 *  · 조세특례제한법 제91조의18(ISA)  · 소득세법 제129조(원천징수) · 제59조의4(표준세액공제)
 *  · 국민건강보험법 시행령 제44조(2026년 보험료율 7.19%) · 노인장기요양보험법 시행령 제4조
 *  · 기준일 2026. 11. 21.
 */

/** 이 파일이 말하는 기준 연도 — 화면의 '기준일'과 어긋나지 않게 함께 내보낸다. */
export const TAX_YEAR = 2026;

/* ------------------------------------------------------------------
   ① 연금계좌(연금저축·IRP) 세액공제 — 소득세법 제59조의3
   ------------------------------------------------------------------ */
export const PENSION_ACCOUNT = {
  /** 연금저축 단독 한도(만원) */
  savingsLimit: 600,
  /** 연금저축 + IRP 합산 한도(만원) */
  combinedLimit: 900,
  /** 총급여 5,500만원 이하 공제율 — 소득세 15% + 지방소득세 1.5% */
  creditRateLow: 0.165,
  /** 총급여 5,500만원 초과 공제율 — 소득세 12% + 지방소득세 1.2% */
  creditRateHigh: 0.132,
  /** 공제율이 갈리는 총급여 경계(만원) */
  salaryThreshold: 5500,
  /** ISA 만기 이전 시 추가 한도 — 이전액의 10%, 최대 300만원 */
  isaTransferRate: 0.1,
  isaTransferMax: 300,
  /** 해지 시 추징되는 기타소득세율(지방소득세 포함) */
  earlyWithdrawRateWithLocal: 0.165,
} as const;

/** 합산 한도(900만) × 낮은 구간 공제율(16.5%) = 최대 148만 5,000원 */
export const PENSION_MAX_CREDIT_WON = Math.round(
  PENSION_ACCOUNT.combinedLimit * 10000 * PENSION_ACCOUNT.creditRateLow,
);

/* ------------------------------------------------------------------
   ② 사적연금 수령 과세 — 소득세법 제20조의3·제64조의4
   ------------------------------------------------------------------ */
export const PRIVATE_PENSION_TAX = {
  /** 연 1,500만원 — 이 기준을 넘으면 과세 방법이 갈린다 */
  annualThreshold: 1500,
  /** 월 125만원 = 1,500만원 ÷ 12 */
  monthlyThreshold: 125,
  /** 55~69세 연금소득세(지방소득세 포함) */
  rateUnder70: 0.055,
  /** 70~79세 */
  rate70: 0.044,
  /** 80세 이상 */
  rate80: 0.033,
  /** 1,500만원 초과 시 고를 수 있는 분리과세 15% */
  separateRate: 0.15,
  /** 위 15% + 지방소득세 10% = 16.5% — '종합과세 세율'이 아니라 선택 가능한 분리과세율 */
  separateRateWithLocal: 0.165,
} as const;

/** 공적연금 소득이 이 금액(만원)을 넘으면 건강보험 피부양자 자격을 잃을 수 있다 */
export const PUBLIC_PENSION_HEALTH_LIMIT = 2000;

/* ------------------------------------------------------------------
   ③ ISA — 조세특례제한법 제91조의18
   ------------------------------------------------------------------ */
export const ISA = {
  /** 일반형 비과세 한도(만원) */
  exemptGeneral: 200,
  /** 서민형·농어민형 비과세 한도(만원) */
  exemptSeomin: 400,
  /** 비과세 초과분 분리과세(지방소득세 포함) */
  taxRate: 0.099,
  /** 의무 가입 기간(년) */
  minYears: 3,
} as const;

/* ------------------------------------------------------------------
   ④ 이자·배당·기타소득 — 원천징수
   ------------------------------------------------------------------ */
export const INCOME_TAX = {
  /** 이자·배당소득세 15.4% = 소득세 14% + 지방소득세 1.4% */
  dividendWithLocal: 0.154,
  /** 금융소득 종합과세 기준(만원) */
  financialIncomeThreshold: 2000,
  /** 기타소득세 16.5% = 소득세 15% + 지방소득세 1.5% (연금 외 수령 등) */
  otherIncomeWithLocal: 0.165,
  /** 표준세액공제(만원) — 소득세법 제59조의4 */
  standardCredit: 13,
} as const;

/* ------------------------------------------------------------------
   ⑤ 건강보험·장기요양 — 2026년
   ------------------------------------------------------------------ */
export const HEALTH_INSURANCE = {
  /** 2026년 건강보험료율 7.19% (직장·지역 동일) */
  rate: 0.0719,
  /** 직장가입자 본인 부담 = 절반 */
  employeeShare: 0.03595,
  /** 장기요양보험료율 0.9448% (보수월액 대비) */
  longTermCareRate: 0.009448,
  /** 건강보험료 대비 장기요양 비율 13.14% */
  longTermCareRatio: 0.1314,
  /** 지역가입자 재산부과점수당 금액(원) */
  propertyPointWon: 211.5,
} as const;

/* ------------------------------------------------------------------
   ⑥ 4대보험 요율 — 실수령액 계산(2026년)
   ------------------------------------------------------------------ */
export const SOCIAL_INSURANCE = {
  /** 국민연금 9.5% (2026년 인상) — 근로자 절반 4.75% */
  nationalPension: 0.095,
  /** 고용보험 1.8% — 근로자 0.9% */
  employment: 0.018,
  /** 근로자 부담분 합계 — 국민연금 4.75% + 건보 3.595% + 장기요양(건보료의 13.14%) + 고용 0.9% */
  employeeShare:
    0.0475 + HEALTH_INSURANCE.employeeShare * (1 + HEALTH_INSURANCE.longTermCareRatio) + 0.009,
} as const;

/* ------------------------------------------------------------------
   화면 표기 — '16.5%' 같은 문자열도 여기서만 만든다.
   ------------------------------------------------------------------ */
/** 0.165 → "16.5%" (소수 1자리, .0은 떼어 낸다) */
export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

/** 1485 → "148만 5,000원" — 원 단위 금액 표기 */
export function wonLabel(won: number): string {
  const man = Math.floor(won / 10000);
  const rest = won % 10000;
  if (rest === 0) return `${man.toLocaleString("ko-KR")}만원`;
  return `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원`;
}

/** 900 → "900만원" */
export function manLabel(value: number): string {
  return `${value.toLocaleString("ko-KR")}만원`;
}

/** 화면 문구가 그대로 읽는 표기 묶음 — 계산기·데이터가 공유한다. */
export const TAX_TEXT = {
  /** '16.5%' */
  creditLow: pct(PENSION_ACCOUNT.creditRateLow),
  /** '13.2%' */
  creditHigh: pct(PENSION_ACCOUNT.creditRateHigh),
  /** '연금저축 600만원' */
  savingsLimit: `연금저축 ${manLabel(PENSION_ACCOUNT.savingsLimit)}`,
  /** '합산 900만원' */
  combinedLimit: `합산 ${manLabel(PENSION_ACCOUNT.combinedLimit)}`,
  /** '최대 148만 5,000원' */
  maxCredit: `최대 ${wonLabel(PENSION_MAX_CREDIT_WON)}`,
  /** '연 1,500만원' */
  privateThreshold: `연 ${manLabel(PRIVATE_PENSION_TAX.annualThreshold)}`,
  /** '16.5%' — 연금 외 수령 기타소득세 */
  otherIncome: pct(INCOME_TAX.otherIncomeWithLocal),
  /** '15.4%' — 이자·배당 */
  dividend: pct(INCOME_TAX.dividendWithLocal),
  /** '9.9%' — ISA 초과분 */
  isa: pct(ISA.taxRate),
  /** '200만원' */
  isaExempt: manLabel(ISA.exemptGeneral),
  /** '400만원' */
  isaExemptSeomin: manLabel(ISA.exemptSeomin),
  /** '10% · 최대 300만원' */
  isaTransfer: `${pct(PENSION_ACCOUNT.isaTransferRate, 0)} · 최대 ${manLabel(PENSION_ACCOUNT.isaTransferMax)}`,
  /** '13만원' */
  standardCredit: manLabel(INCOME_TAX.standardCredit),
  /** '7.19%' */
  healthRate: pct(HEALTH_INSURANCE.rate, 2),
  /** '13.14%' */
  longTermCareRatio: pct(HEALTH_INSURANCE.longTermCareRatio, 2),
} as const;

/** 검증 스크립트가 읽는 기대값 — 이 표와 실제 상수가 다르면 빌드 가드가 실패한다. */
export const TAX_EXPECTED = {
  savingsLimit: 600,
  combinedLimit: 900,
  creditRateLowPct: 16.5,
  creditRateHighPct: 13.2,
  otherIncomePct: 16.5,
  privateThreshold: 1500,
  isaExempt: 200,
  isaExemptSeomin: 400,
  isaTransferMax: 300,
  isaTransferPct: 10,
  standardCredit: 13,
  healthRatePct: 7.19,
  longTermCareRatioPct: 13.14,
  dividendPct: 15.4,
} as const;
