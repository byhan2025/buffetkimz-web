/**
 * 한국형 연금 인출·세금 시뮬레이터 — 계산 엔진 (v6.0 초안, 2026-11-21)
 * =============================================================================
 * buffetkimz.com 의 신규 도구 `연금 인출·세금 시뮬레이터`가 쓰는 순수 계산 모듈.
 *
 * 원칙
 *  · 의존성 0, 브라우저·Node 양쪽에서 그대로 실행된다(서버·로그인·저장 없음).
 *  · 금액 단위는 '원'(정수). 화면 표시(만원)는 UI가 바꾼다.
 *  · 모든 세율·한도는 아래 LAW 객체 한 곳에 모으고, 각 값에 법령 근거를 붙인다.
 *  · 계산에 쓴 가정은 반드시 `assumptions[]`로 돌려준다(화면의 '가정 칩' 1줄).
 *  · 투자·상품 권유가 아니라 '제도 계산'만 한다(disclosures 참조).
 *
 * 법령 기준: 소득세법 [시행 2026. 7. 1.] [법률 제21221호, 2025. 12. 23. 일부개정]
 *  · 제20조의3 (연금소득)                  — 연금계좌 연금수령분의 소득 구분
 *  · 제14조③9호 (분리과세연금소득)          — 사적연금 연 1,500만원 이하
 *  · 제47조의2 (연금소득공제)               — 350/700/1,400만원 구간, 900만원 한도
 *  · 제55조① (기본세율)                    — 6~45% 8구간
 *  · 제64조의4 (연금소득 세액계산 특례)      — 종합소득 결정세액 vs 15% 분리과세
 *  · 제129조①5호의2 (원천징수세율)          — 70세 미만 5% / 70~79세 4% / 80세 이상 3% (+지방소득세 10%)
 *  · 제59조의3 (연금계좌세액공제)            — 600/900만원, ISA 전환 10%·최대 300만원
 *  · 시행령 제40조의2 (연금수령 요건·한도)    — 55세+5년, 연금수령한도 = 평가액/(11-연차)×120%
 *  · 시행령 제40조의3 (연금계좌 인출순서)     — 과세제외 → 이연퇴직소득 → 세액공제분·운용수익
 *  · 국민건강보험법 시행령 제41조·시행규칙 별표 1의2 — 피부양자 소득요건 연 2,000만원
 */

export const LAW_VERSION = "소득세법 [시행 2026. 7. 1.] [법률 제21221호]";
export const LAW = Object.freeze({
  version: LAW_VERSION,
  /** 사적연금 분리과세 기준 — 제14조③9호다목 (2024.1.1. 이후 수령분 1,500만원) */
  separateThreshold: 15_000_000,
  /** 1,500만원 초과 시 선택하는 15% 분리과세율 — 제64조의4 제2호가목 */
  separateRate15: 0.15,
  /** 지방소득세 — 소득세액의 10% (지방세법 제103조의3 준용 구조) */
  localTaxRate: 0.1,
  /** 사적연금 연금소득 원천징수세율 — 제129조①5호의2 (소득세 기준) */
  withholdingByAge: [
    { underAge: 70, rate: 0.05 },
    { underAge: 80, rate: 0.04 },
    { underAge: Infinity, rate: 0.03 },
  ],
  /** 사망 때까지 받는 종신계약 — 2026.1.1. 이후 수령분 3% (제129조①5호의2) */
  lifelongContractRate: 0.03,
  /** 연금수령 요건 */
  receipt: { minStartAge: 55, minYearsSinceJoin: 5, limitFormula: "평가액 / (11 - 연금수령연차) × 120%" },
  /** 연금소득공제 — 제47조의2 (한도 900만원). base = 그 구간 직전까지의 공제액, lower = 직전 구간 상한 */
  pensionDeductionTiers: [
    { upTo: 3_500_000, lower: 0, base: 0, rate: 1 },
    { upTo: 7_000_000, lower: 3_500_000, base: 3_500_000, rate: 0.4 },
    { upTo: 14_000_000, lower: 7_000_000, base: 4_900_000, rate: 0.2 },
    { upTo: Infinity, lower: 14_000_000, base: 6_300_000, rate: 0.1 },
  ],
  pensionDeductionCap: 9_000_000,
  /** 종합소득공제 — 제51조 기본공제(본인 1명), 경로우대(70세 이상) */
  basicDeduction: 1_500_000,
  seniorDeduction: 1_000_000,
  seniorAge: 70,
  /** 표준세액공제 — 제59조의4⑨2호나목 (연 7만원, 다른 세액공제 없을 때) */
  standardTaxCredit: 70_000,
  /** 기본세율 — 제55조① */
  brackets: [
    { upTo: 14_000_000, base: 0, rate: 0.06 },
    { upTo: 50_000_000, base: 840_000, rate: 0.15 },
    { upTo: 88_000_000, base: 6_240_000, rate: 0.24 },
    { upTo: 150_000_000, base: 15_360_000, rate: 0.35 },
    { upTo: 300_000_000, base: 37_060_000, rate: 0.38 },
    { upTo: 500_000_000, base: 94_060_000, rate: 0.4 },
    { upTo: 1_000_000_000, base: 174_060_000, rate: 0.42 },
    { upTo: Infinity, base: 384_060_000, rate: 0.45 },
  ],
  /** 연금외수령 — 기타소득 15% (지방소득세 포함 16.5%) */
  earlyWithdrawalRate: 0.15,
  /** 이연퇴직소득 연금수령 세율 — 원 퇴직소득세의 70% (10년 초과 60%, 20년 초과 50%, 2026.1.1. 이후) */
  deferredRetirementRate: { default: 0.7, over10y: 0.6, over20y: 0.5 },
  /** 연금계좌세액공제 — 제59조의3 (화면 안내용) */
  contributionCredit: { pensionLimit: 6_000_000, totalLimit: 9_000_000, isaExtraRate: 0.1, isaExtraCap: 3_000_000 },
  /** 건강보험 피부양자 소득요건 — 시행규칙 별표 1의2 */
  dependentIncomeLimit: 20_000_000,
});

/**
 * 적격 사적연금의 범위 — 소득세법 제14조③9호·제20조의3①2호.
 * 1,500만원 기준과 연령별 원천징수율은 '적격 연금계좌 소득'에만 적용된다.
 */
export const ELIGIBLE_SCOPE = Object.freeze({
  included: [
    { key: "taxCredited", label: "세액공제 받은 납입액", basis: "제20조의3①2호나목" },
    { key: "earnings", label: "연금계좌 운용수익", basis: "제20조의3①2호다목" },
  ],
  excluded: [
    { key: "publicPension", label: "공적연금(국민·공무원·사학·군인연금 등)", why: "제20조의3①1호 — 종합소득에 합산, 1,500만원 기준에 미포함" },
    { key: "deferredRetirement", label: "퇴직소득 유래 연금(이연퇴직소득)", why: "제14조③9호가목 — 금액과 무관하게 분리과세(퇴직소득세의 70%), 1,500만원 기준에 미포함" },
    { key: "untaxed", label: "세액공제 받지 않은 납입 원금", why: "과세제외금액 — 연금소득이 아님" },
  ],
  note: "'사적연금 수령액'은 퇴직금 재원을 뺀 적격 연금계좌 소득으로 입력해야 1,500만원 판정이 맞습니다.",
});

/**
 * 세법 상수 단일 config — 값·발효일·근거를 한 곳에 모은다.
 * 도구 화면은 이 객체만 읽는다(상수 하드코딩 금지).
 */
export const TAX_CONFIG = Object.freeze({
  id: "kr-pension-tax-2026.7.1",
  effectiveFrom: "2026-07-01",
  checkedOn: "2026-11-21",
  source: LAW_VERSION,
  values: LAW,
  scope: ELIGIBLE_SCOPE,
  effectiveNotes: [
    { item: "종신계약 연금 원천징수", value: "3%", effectiveFrom: "2026-01-01", note: "종전 4%" },
    { item: "이연퇴직소득 연금수령 과세", value: "70% / 10년 초과 60% / 20년 초과 50%", effectiveFrom: "2026-01-01" },
    { item: "사적연금 분리과세 기준", value: "연 1,500만원", effectiveFrom: "2024-01-01", note: "종전 1,200만원" },
    { item: "15% 분리과세 선택", value: "종합과세 또는 15% 선택", effectiveFrom: "2023-01-01" },
  ],
});

/** 반올림: 원 단위(10원 미만 절사는 금융사 관행이 달라 반올림으로 통일) */
const won = (n) => Math.round(n);

/** 0 이상 보정 */
const atLeastZero = (n) => (n > 0 ? n : 0);

/**
 * 연령별 사적연금 연금소득세율(지방소득세 포함).
 * @param {number} age
 * @param {{lifelong?: boolean}} [opts] lifelong: 사망 때까지 받는 종신계약 여부
 * @returns {{incomeTaxRate:number, totalRate:number, label:string}}
 */
export function withholdingRate(age, opts = {}) {
  if (!Number.isFinite(age) || age < 0) throw new Error("age는 0 이상의 숫자여야 합니다.");
  const base = opts.lifelong
    ? LAW.lifelongContractRate
    : (LAW.withholdingByAge.find((t) => age < t.underAge) ?? LAW.withholdingByAge.at(-1)).rate;
  const total = base * (1 + LAW.localTaxRate);
  const label = opts.lifelong
    ? "종신계약 3%"
    : age < 70
      ? "70세 미만 5%"
      : age < 80
        ? "70~79세 4%"
        : "80세 이상 3%";
  return { incomeTaxRate: base, totalRate: Math.round(total * 10000) / 10000, label };
}

/**
 * 연금소득공제 — 소득세법 제47조의2.
 * 350만 이하 전액 / 700만 이하 350만+40% / 1,400만 이하 490만+20% / 초과 630만+10%, 한도 900만원.
 * @param {number} totalPension 총연금액(공적+사적, 과세대상)
 */
export function pensionIncomeDeduction(totalPension) {
  const total = atLeastZero(totalPension);
  if (total === 0) return 0;
  const tier = LAW.pensionDeductionTiers.find((t) => total <= t.upTo) ?? LAW.pensionDeductionTiers.at(-1);
  const deduction = tier.base + (total - tier.lower) * tier.rate;
  return won(Math.min(deduction, LAW.pensionDeductionCap));
}

/**
 * 종합소득 산출세액 — 소득세법 제55조①.
 * @param {number} taxBase 종합소득 과세표준
 */
export function progressiveIncomeTax(taxBase) {
  const base = atLeastZero(taxBase);
  if (base === 0) return 0;
  const b = LAW.brackets.find((x) => base <= x.upTo) ?? LAW.brackets.at(-1);
  const lower = previousCap(b);
  return won(b.base + (base - lower) * b.rate);
}

/** 구간 하한(직전 구간 상한). 내부용. */
function previousCap(bracket) {
  const i = LAW.brackets.indexOf(bracket);
  return i <= 0 ? 0 : LAW.brackets[i - 1].upTo;
}

/**
 * 종합소득 결정세액(지방소득세 포함) — 연금소득 + 공적연금 + 그 밖의 종합소득.
 *
 * @param {object} p
 * @param {number} p.taxablePrivate 연금계좌에서 받은 과세대상 사적연금(세액공제분+운용수익)
 * @param {number} [p.publicPension] 공적연금(국민연금 등) 과세대상 수령액
 * @param {number} [p.otherIncome] 그 밖의 종합소득(근로·사업·이자·배당·기타)
 * @param {number} [p.age] 수령 나이(경로우대공제 판단)
 * @param {boolean} [p.applyBasicDeduction] 기본공제 150만원 적용(기본 true)
 * @param {boolean} [p.applyStandardCredit] 표준세액공제 7만원 적용(기본 true)
 */
export function comprehensivePensionTax({
  taxablePrivate = 0,
  publicPension = 0,
  otherIncome = 0,
  age = 65,
  applyBasicDeduction = true,
  applyStandardCredit = true,
} = {}) {
  const totalPension = atLeastZero(taxablePrivate) + atLeastZero(publicPension);
  const deduction = pensionIncomeDeduction(totalPension);
  const pensionIncome = atLeastZero(totalPension - deduction);
  const totalIncome = pensionIncome + atLeastZero(otherIncome);

  const personalDeduction = applyBasicDeduction ? LAW.basicDeduction : 0;
  const senior = applyBasicDeduction && age >= LAW.seniorAge ? LAW.seniorDeduction : 0;
  const taxBase = atLeastZero(totalIncome - personalDeduction - senior);

  const calculated = progressiveIncomeTax(taxBase);
  const credit = applyStandardCredit ? Math.min(LAW.standardTaxCredit, calculated) : 0;
  const decided = atLeastZero(calculated - credit);

  return {
    totalPension,
    pensionDeduction: deduction,
    pensionIncome,
    totalIncome,
    deduction: personalDeduction + senior,
    taxBase,
    calculated,
    credit,
    decided,
    localTax: won(decided * LAW.localTaxRate),
    totalTax: won(decided * (1 + LAW.localTaxRate)),
  };
}

/**
 * 사적연금 인출 한 해의 세 부담 비교 — 소득세법 제14조③9호·제64조의4.
 *
 *  · 연 1,500만원 이하: ① 원천징수(3~5.5%)로 종결 vs ② 종합소득에 합산
 *  · 연 1,500만원 초과: ① 종합과세 vs ② 15%(+지방 1.5%) 분리과세
 *
 * 비교는 '사적연금 때문에 늘어나는 세금'만 본다(공적연금·기타소득의 세금은 양쪽에 같게 들어가므로 상쇄).
 *  - 종합과세 쪽 증분 = T(전체) − T(사적연금 제외)
 *  - 15% 분리과세 쪽 = 사적연금 × 16.5%
 *
 * @param {object} p
 * @param {number} p.privatePension 연간 사적연금 수령액(과세대상 기준)
 * @param {number} [p.publicPension] 연간 공적연금(국민연금 등)
 * @param {number} [p.otherIncome] 그 밖의 종합소득
 * @param {number} [p.age] 수령 나이
 * @param {boolean} [p.lifelong] 종신계약 여부
 */
export function compareRoutes({
  privatePension,
  publicPension = 0,
  otherIncome = 0,
  age = 65,
  lifelong = false,
} = {}) {
  if (!Number.isFinite(privatePension) || privatePension < 0) throw new Error("privatePension은 0 이상이어야 합니다.");
  const P = privatePension;
  const rate = withholdingRate(age, { lifelong });

  const withPrivate = comprehensivePensionTax({ taxablePrivate: P, publicPension, otherIncome, age });
  const withoutPrivate = comprehensivePensionTax({ taxablePrivate: 0, publicPension, otherIncome, age });
  const comprehensiveDelta = atLeastZero(withPrivate.totalTax - withoutPrivate.totalTax);

  const belowThreshold = P <= LAW.separateThreshold;

  const options = [];
  if (belowThreshold) {
    const w = won(P * rate.totalRate);
    options.push({
      key: "withholding",
      label: `연금소득세 ${(rate.totalRate * 100).toFixed(1)}%로 종결`,
      tax: w,
      basis: "제129조①5호의2 원천징수 — 다른 소득과 합산하지 않음",
      detail: { rate: rate.totalRate, rateLabel: rate.label },
    });
    options.push({
      key: "comprehensive",
      label: "종합소득에 합산 신고",
      tax: comprehensiveDelta,
      basis: "제14조③9호 단서 — 1,500만원 이하도 합산 선택 가능",
      detail: {
        mergedTaxBase: withPrivate.taxBase,
        mergedDecided: withPrivate.decided,
        splitPensionDeduction: withPrivate.pensionDeduction,
      },
    });
  } else {
    const s = won(P * LAW.separateRate15 * (1 + LAW.localTaxRate));
    options.push({
      key: "comprehensive",
      label: "종합과세",
      tax: comprehensiveDelta,
      basis: "제64조의4 제1호 — 다른 소득과 합쳐 6~45% 누진",
      detail: {
        mergedTaxBase: withPrivate.taxBase,
        mergedDecided: withPrivate.decided,
        pensionDeduction: withPrivate.pensionDeduction,
        marginalRate: marginalRateOnPrivate(withPrivate, withoutPrivate, P),
      },
    });
    options.push({
      key: "separate15",
      label: "15% 분리과세",
      tax: s,
      basis: "제64조의4 제2호가목 — 15% + 지방소득세(공제 없음)",
      detail: { rate: LAW.separateRate15 * (1 + LAW.localTaxRate) },
    });
  }

  const sorted = [...options].sort((a, b) => a.tax - b.tax);
  const winner = sorted[0];
  const loser = sorted.at(-1);

  return {
    privatePension: P,
    threshold: { amount: LAW.separateThreshold, status: belowThreshold ? "below" : "above" },
    options,
    winner: winner.key,
    winnerLabel: winner.label,
    difference: loser.tax - winner.tax,
    /** 원천징수로 이미 낸 세금(1,500만원 이하 구간의 기준선) */
    withheld: won(P * rate.totalRate),
    rate: rate.totalRate,
    rateLabel: rate.label,
    comprehensiveDelta,
    merged: withPrivate,
    mergedWithout: withoutPrivate,
  };
}

/** 사적연금 몫에 실제로 붙는 평균 세율(증분/사적연금) */
function marginalRateOnPrivate(withPrivate, withoutPrivate, P) {
  if (P <= 0) return 0;
  return Math.round(((withPrivate.totalTax - withoutPrivate.totalTax) / P) * 10000) / 10000;
}

/**
 * 1,500만원 경계의 '세금 절벽'.
 * 기준을 1원이라도 넘으면 사적연금 전액이 분리과세에서 빠져 두 갈래(종합/15%)를 다시 고른다.
 * @returns {{belowTax:number, aboveTax:number, jump:number, aboveOption:string, note:string}}
 */
export function thresholdCliff({ age = 65, publicPension = 0, otherIncome = 0, lifelong = false } = {}) {
  const below = compareRoutes({
    privatePension: LAW.separateThreshold,
    publicPension,
    otherIncome,
    age,
    lifelong,
  });
  const above = compareRoutes({
    privatePension: LAW.separateThreshold + 1,
    publicPension,
    otherIncome,
    age,
    lifelong,
  });
  const belowTax = below.options.find((o) => o.key === "withholding").tax;
  const aboveOption = above.options.find((o) => o.key === above.winner);
  const aboveTax = aboveOption.tax;
  return {
    belowTax,
    aboveTax,
    delta: aboveTax - belowTax,
    jump: atLeastZero(aboveTax - belowTax),
    aboveOption,
    note:
      aboveOption.key === "comprehensive"
        ? "1,500만원을 넘으면 사적연금 전액이 분리과세에서 빠져 두 갈래를 다시 고릅니다. 이 조건에서는 종합과세가 더 적어, 기준을 넘어도 세금이 늘지 않습니다."
        : "1,500만원을 넘으면 사적연금 전액이 분리과세에서 빠지고 15%가 적용됩니다. 기준 직전보다 세금이 크게 늘 수 있습니다.",
  };
}

/**
 * '그 밖의 소득'이 얼마를 넘으면 15% 분리과세가 유리해지는가(역전점).
 * 그 밖의 소득을 100만원 단위로 올려 가며 종합과세 증분이 16.5%를 넘는 첫 지점을 찾는다.
 * @returns {{otherIncomeAtBreakEven:number|null, note:string, curve:Array<{otherIncome:number,comprehensive:number,separate15:number}>}}
 */
export function crossoverOtherIncome({ age = 65, privatePension, publicPension = 0, maxOtherIncome = 300_000_000, step = 1_000_000 } = {}) {
  if (!Number.isFinite(privatePension) || privatePension <= 0) throw new Error("privatePension이 필요합니다.");
  const curve = [];
  let found = null;
  for (let o = 0; o <= maxOtherIncome; o += step) {
    const r = compareRoutes({ privatePension, publicPension, otherIncome: o, age });
    const comp = r.options.find((x) => x.key === "comprehensive").tax;
    const sep = r.options.find((x) => x.key === "separate15").tax;
    curve.push({ otherIncome: o, comprehensive: comp, separate15: sep });
    if (found === null && sep < comp) found = o;
  }
  return {
    otherIncomeAtBreakEven: found,
    note:
      found === null
        ? "그 밖의 소득이 3억원까지 늘어도 종합과세가 계속 유리한 조건입니다(연금소득공제·기본공제 효과가 커서)."
        : `그 밖의 종합소득이 연 ${Math.round(found / 10_000).toLocaleString()}만원을 넘으면 15% 분리과세가 유리해집니다.`,
    curve,
  };
}

/**
 * 연금수령한도 — 소득세법 시행령 제40조의2③3호.
 * 평가액 / (11 - 연금수령연차) × 120%, 연차 11년 이상이면 한도 없음.
 * @param {{balance:number, yearIndex:number}} p yearIndex는 1부터(첫 수령 연차 = 1)
 */
export function pensionReceiptLimit({ balance, yearIndex }) {
  if (yearIndex >= 11) return { limit: Infinity, formula: "11년 이상 — 한도 없음" };
  const limit = won((atLeastZero(balance) / (11 - yearIndex)) * 1.2);
  return { limit, formula: `평가액 / (11 - ${yearIndex}) × 120%` };
}

/**
 * 인출 순서 시뮬레이션 — 소득세법 시행령 제40조의3.
 *  ① 과세제외금액(비과세 원금) → ② 이연퇴직소득 → ③ 세액공제 받은 납입액·운용수익(비례)
 * 한도를 넘는 인출분은 연금외수령으로 보아 15%(+지방 1.5%) 기타소득세를 적용한다.
 *
 * @param {object} p
 * @param {number} p.annualWithdrawal 연간 인출액(원)
 * @param {{untaxed?:number, deferredRetirement?:number, taxCredited?:number, earnings?:number}} p.balances
 * @param {number} [p.startAge=65] 첫 수령 나이
 * @param {number} [p.years=20] 시뮬레이션 연수
 * @param {number} [p.growthRate=0.03] 잔액 연 운용수익률(가정)
 * @param {boolean} [p.lifelong=false] 종신계약 여부
 * @param {(yearIndex:number, age:number)=>number} [p.withdrawalByYear] 연도별 인출액 함수(있으면 annualWithdrawal 무시)
 */
export function simulateWithdrawalOrder({
  annualWithdrawal = 0,
  balances = {},
  startAge = 65,
  years = 20,
  growthRate = 0.03,
  lifelong = false,
  withdrawalByYear,
} = {}) {
  if (startAge < LAW.receipt.minStartAge) {
    throw new Error(`연금수령은 만 ${LAW.receipt.minStartAge}세 이후에 시작할 수 있습니다(시행령 제40조의2③1호).`);
  }
  const b = {
    untaxed: atLeastZero(balances.untaxed ?? 0),
    deferredRetirement: atLeastZero(balances.deferredRetirement ?? 0),
    taxCredited: atLeastZero(balances.taxCredited ?? 0),
    earnings: atLeastZero(balances.earnings ?? 0),
  };

  const rows = [];
  let totalTaxable = 0;
  let totalTax = 0;
  let totalUntaxed = 0;
  let totalDeferred = 0;
  let totalEarly = 0;
  let totalEarlyTax = 0;

  for (let i = 1; i <= years; i += 1) {
    const age = startAge + (i - 1);
    const balanceBefore = b.untaxed + b.deferredRetirement + b.taxCredited + b.earnings;
    if (balanceBefore <= 0) break;

    const requested = withdrawalByYear ? withdrawalByYear(i, age) : annualWithdrawal;
    const { limit } = pensionReceiptLimit({ balance: balanceBefore, yearIndex: i });
    const withinLimit = Math.min(requested, limit, balanceBefore);
    const excess = atLeastZero(Math.min(requested - withinLimit, balanceBefore - withinLimit));

    const rate = withholdingRate(age, { lifelong });

    // ① 과세제외금액
    let left = withinLimit;
    const fromUntaxed = Math.min(left, b.untaxed);
    b.untaxed -= fromUntaxed;
    left -= fromUntaxed;

    // ② 이연퇴직소득
    const fromDeferred = Math.min(left, b.deferredRetirement);
    b.deferredRetirement -= fromDeferred;
    left -= fromDeferred;

    // ③ 세액공제분·운용수익 — 법령에 내부 순서가 없어 잔액 비례로 나눈다(두 재원의 세율이 같아 총세액은 동일)
    let fromTaxCredited = 0;
    let fromEarnings = 0;
    if (left > 0) {
      const pool = b.taxCredited + b.earnings;
      if (pool > 0) {
        fromTaxCredited = Math.min(b.taxCredited, (left * b.taxCredited) / pool);
        fromEarnings = Math.min(b.earnings, left - fromTaxCredited);
        const rest = left - fromTaxCredited - fromEarnings;
        if (rest > 0) {
          // 반올림 잔여분은 남아 있는 쪽에서 채운다
          if (b.taxCredited - fromTaxCredited > 0) fromTaxCredited += Math.min(rest, b.taxCredited - fromTaxCredited);
          else fromEarnings += Math.min(rest, b.earnings - fromEarnings);
        }
        b.taxCredited = atLeastZero(b.taxCredited - fromTaxCredited);
        b.earnings = atLeastZero(b.earnings - fromEarnings);
      }
    }

    const taxable = won(fromTaxCredited + fromEarnings);
    const pensionTax = won(taxable * rate.totalRate);
    const deferredTax = won(fromDeferred * (i > 20 ? LAW.deferredRetirementRate.over20y : i > 10 ? LAW.deferredRetirementRate.over10y : LAW.deferredRetirementRate.default));

    // 한도 초과분 = 연금외수령 → 기타소득 15% (+지방 1.5%). 과세제외·퇴직소득 몫은 별도 처리.
    let earlyTax = 0;
    if (excess > 0) {
      const taxableRatio = (b.taxCredited + b.earnings) / Math.max(b.untaxed + b.deferredRetirement + b.taxCredited + b.earnings, 1);
      const earlyTaxable = won(excess * taxableRatio);
      earlyTax = won(earlyTaxable * LAW.earlyWithdrawalRate * (1 + LAW.localTaxRate));
      b.taxCredited = atLeastZero(b.taxCredited - earlyTaxable * (b.taxCredited / Math.max(b.taxCredited + b.earnings, 1)));
      b.earnings = atLeastZero(b.earnings - (earlyTaxable - earlyTaxable * (b.taxCredited / Math.max(b.taxCredited + b.earnings, 1))));
    }

    // 잔액 운용수익 반영 — 원금(과세제외·세액공제분)·이연퇴직소득은 명목액 그대로 두고,
    // 불어난 금액은 전부 '운용수익'(과세 대상) 재원으로 옮긴다.
    const growth = growthRate;
    const grown = won((b.untaxed + b.deferredRetirement + b.taxCredited + b.earnings) * growth);
    b.earnings += grown;
    const balanceAfter = b.untaxed + b.deferredRetirement + b.taxCredited + b.earnings;

    rows.push({
      yearIndex: i,
      age,
      requested: won(requested),
      limit: Number.isFinite(limit) ? won(limit) : null,
      withdrawn: won(withinLimit + excess),
      fromUntaxed: won(fromUntaxed),
      fromDeferredRetirement: won(fromDeferred),
      fromTaxCredited: won(fromTaxCredited),
      fromEarnings: won(fromEarnings),
      taxable,
      rate: rate.totalRate,
      pensionTax,
      deferredTax,
      excess: won(excess),
      earlyTax,
      tax: won(pensionTax + deferredTax + earlyTax),
      balanceAfter: won(balanceAfter),
    });

    totalTaxable += taxable;
    totalTax += pensionTax + deferredTax + earlyTax;
    totalUntaxed += fromUntaxed;
    totalDeferred += fromDeferred;
    totalEarly += excess;
    totalEarlyTax += earlyTax;
  }

  return {
    rows,
    totals: {
      years: rows.length,
      withdrawn: won(rows.reduce((s, r) => s + r.withdrawn, 0)),
      taxable: won(totalTaxable),
      untaxed: won(totalUntaxed),
      deferredRetirement: won(totalDeferred),
      tax: won(totalTax),
      earlyWithdrawal: won(totalEarly),
      earlyTax: won(totalEarlyTax),
      effectiveRate: rows.length ? Math.round((totalTax / Math.max(rows.reduce((s, r) => s + r.withdrawn, 0), 1)) * 10000) / 10000 : 0,
    },
    remaining: {
      untaxed: won(b.untaxed),
      deferredRetirement: won(b.deferredRetirement),
      taxCredited: won(b.taxCredited),
      earnings: won(b.earnings),
    },
  };
}

/**
 * 최적 분산 인출 기간 역산 — 연 1,500만원 경계를 넘지 않는 '최소 연수'와 절세 추정액.
 *
 * 전제(화면에 가정 칩으로 표시):
 *  · 잔액은 고정(운용수익·물가 미반영), 매년 같은 금액을 인출
 *  · 공적연금·그 밖의 소득은 매년 동일
 *  · 매년 두 갈래(원천징수·종합과세) 중 적은 쪽을 고른다고 가정
 *
 * @param {object} p
 * @param {number} p.totalBalance 과세대상 사적연금 잔액(원)
 * @param {number} [p.startAge=65]
 * @param {number} [p.publicPension=0]
 * @param {number} [p.otherIncome=0]
 * @param {number} [p.capYears=40] 계산 상한(노후 기간)
 */
export function calcOptimalWithdrawalYears({
  totalBalance,
  startAge = 65,
  publicPension = 0,
  otherIncome = 0,
  capYears = 40,
  lifelong = false,
} = {}) {
  const balance = atLeastZero(totalBalance);
  const perYearLimit = LAW.separateThreshold;
  if (startAge < LAW.receipt.minStartAge) {
    throw new Error(`수령 시작 나이는 만 ${LAW.receipt.minStartAge}세 이상이어야 합니다.`);
  }
  if (balance === 0) {
    return {
      feasible: true,
      minYears: 0,
      perYearLimit,
      schedule: [],
      spread: { years: 0, tax: 0 },
      concentrated: { years: 1, tax: 0, route: null },
      saving: 0,
      note: "잔액을 입력하면 분산 인출 연수를 계산합니다.",
    };
  }

  const minYears = Math.max(1, Math.ceil(balance / perYearLimit));
  const feasible = minYears <= capYears;
  const years = Math.min(minYears, capYears);

  const schedule = [];
  let rest = balance;
  let spreadTax = 0;
  for (let i = 1; i <= years; i += 1) {
    const amount = Math.min(perYearLimit, rest);
    const r = compareRoutes({ privatePension: amount, publicPension, otherIncome, age: startAge + i - 1, lifelong });
    const best = r.options.find((o) => o.key === r.winner);
    schedule.push({ year: i, age: startAge + i - 1, amount: won(amount), tax: best.tax, route: r.winner, routeLabel: best.label });
    spreadTax += best.tax;
    rest -= amount;
  }

  const conc = compareRoutes({ privatePension: balance, publicPension, otherIncome, age: startAge, lifelong });
  const concBest = conc.options.find((o) => o.key === conc.winner);
  const saving = atLeastZero(concBest.tax - spreadTax);

  return {
    feasible,
    minYears,
    years,
    perYearLimit,
    schedule,
    spread: { years, tax: won(spreadTax), effectiveRate: balance ? Math.round((spreadTax / balance) * 10000) / 10000 : 0 },
    concentrated: { years: 1, tax: concBest.tax, route: conc.winner, routeLabel: concBest.label, rate: Math.round((concBest.tax / balance) * 10000) / 10000 },
    saving: won(saving),
    note: feasible
      ? `연 1,500만원 이하로 나누면 최소 ${minYears}년입니다. 한 해에 받는 경우(${concBest.label})보다 ${Math.round(saving / 10_000).toLocaleString("ko-KR")}만원 적습니다.`
      : `${capYears}년으로 나눠도 연 1,500만원을 넘습니다. 수령 개시를 늦추거나 연금 외 재원을 함께 검토해야 합니다.`,
  };
}

/** 만원/억 단위 한국어 표기 */
export function manLabel(n) {
  const won_ = Math.round(Number(n) || 0);
  const eok = Math.floor(Math.abs(won_) / 100_000_000);
  const man = Math.round((Math.abs(won_) % 100_000_000) / 10_000);
  const sign = won_ < 0 ? "-" : "";
  if (eok && man) return `${sign}${eok}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok) return `${sign}${eok}억`;
  return `${sign}${man.toLocaleString("ko-KR")}만`;
}

/**
 * '내 결과 5줄 메모' — 원터치 복사문. 화면 문장이 아니라 그대로 붙여넣는 기록용 텍스트.
 */
export function buildResultMemo5(out, { date = TAX_CONFIG.checkedOn, optimal = null } = {}) {
  const i = out.inputs;
  const winner = out.routes.options.find((o) => o.key === out.routes.winner);
  const other = out.routes.options.find((o) => o.key !== out.routes.winner);
  const cliffLine =
    out.cliff.delta > 0
      ? `1,500만원 경계: 넘으면 전액이 분리과세에서 빠져 ${manLabel(out.cliff.delta)} 늘어남 — 연 1,500만 ${manLabel(out.cliff.belowTax)}(원천징수) → 넘긴 해 ${manLabel(out.cliff.aboveTax)}(${out.cliff.aboveOption.label})`
      : `1,500만원 경계: 넘으면 전액이 분리과세에서 빠져 다시 계산 — 연 1,500만 ${manLabel(out.cliff.belowTax)}(원천징수) → 넘긴 해 ${manLabel(out.cliff.aboveTax)}(${out.cliff.aboveOption.label})`;
  const lines = [
    `[연금 인출] ${date} 기준 · ${i.startAge}세 · 사적연금 연 ${manLabel(i.privatePension)} · 국민연금 연 ${manLabel(i.publicPension)} · 다른 소득 ${i.otherIncome ? `연 ${manLabel(i.otherIncome)}` : "없음"}`,
    `결론: 연 ${winner.label} ${manLabel(winner.tax)} < 연 ${other.label} ${manLabel(other.tax)} (차 ${manLabel(out.routes.difference)})`,
    cliffLine,
    optimal
      ? `분산: 잔액 ${manLabel(optimal.totalBalance ?? 0)} → 연 ${manLabel(optimal.perYearLimit)}씩 최소 ${optimal.minYears}년 · 세금 합계 ${manLabel(optimal.spread.tax)}(일시 ${manLabel(optimal.concentrated.tax)} 대비 ${manLabel(optimal.saving)} 적음)`
      : "분산: 잔액을 넣으면 연 1,500만원 이하 최소 인출 연수를 계산합니다",
    `※ 참고용 추정이며 세무 상담이 아닙니다 · ${LAW_VERSION}`,
  ];
  return { lines, text: lines.join("\n") };
}

/**
 * 건강보험 피부양자 소득요건 경고.
 *  · 공적연금은 받은 금액 전액이 합산된다(시행령 제41조①5호 단서).
 *  · 사적연금 포함 여부는 1차 자료가 엇갈린다 — 공단 웹진·해설은 '미포함', 시행령 문언은 제20조의3 전체를 가리킨다.
 *    → 도구는 '확인 필요'로만 표시하고 계산하지 않는다.
 */
export function healthInsuranceExposure({ publicPension = 0 } = {}) {
  const total = atLeastZero(publicPension);
  const over = total > LAW.dependentIncomeLimit;
  return {
    publicPension: total,
    limit: LAW.dependentIncomeLimit,
    over,
    remaining: atLeastZero(LAW.dependentIncomeLimit - total),
    note: over
      ? `공적연금만으로 연 ${Math.round(total / 10_000).toLocaleString()}만원 — 피부양자 소득요건(2,000만원)을 넘습니다. 재산요건과 함께 공단 확인이 필요합니다.`
      : `공적연금 연 ${Math.round(total / 10_000).toLocaleString()}만원 — 2,000만원까지 ${Math.round((LAW.dependentIncomeLimit - total) / 10_000).toLocaleString()}만원 여유가 있습니다.`,
    privatePensionNote:
      "사적연금(연금저축·IRP)을 피부양자 소득에 넣는지는 자료가 엇갈립니다. 이 도구는 계산에 넣지 않았습니다.",
  };
}

/**
 * 화면(4개 입력)이 호출하는 단일 진입점.
 *
 * @param {object} input
 * @param {number} input.startAge 수령 시작 나이
 * @param {number} input.privatePension 연간 사적연금 수령액(원)
 * @param {number} input.publicPension 연간 공적연금(원)
 * @param {number} input.otherIncome 그 밖의 종합소득(원) — 화면은 '있음/없음'으로만 묻고, 있음이면 금액을 받는다
 * @param {boolean} [input.lifelong] 종신계약 여부
 */
export function simulate(input) {
  const startAge = Number(input?.startAge ?? 65);
  const privatePension = atLeastZero(Number(input?.privatePension ?? 0));
  const publicPension = atLeastZero(Number(input?.publicPension ?? 0));
  const otherIncome = atLeastZero(Number(input?.otherIncome ?? 0));
  const retirementPension = atLeastZero(Number(input?.retirementPension ?? 0));
  const totalBalance = atLeastZero(Number(input?.totalBalance ?? 0));
  const lifelong = Boolean(input?.lifelong);

  if (startAge < LAW.receipt.minStartAge) {
    throw new Error(`수령 시작 나이는 만 ${LAW.receipt.minStartAge}세 이상이어야 합니다(시행령 제40조의2③1호).`);
  }

  const routes = compareRoutes({ privatePension, publicPension, otherIncome, age: startAge, lifelong });
  const cliff = thresholdCliff({ age: startAge, publicPension, otherIncome, lifelong });
  const health = healthInsuranceExposure({ publicPension });
  const crossover =
    routes.threshold.status === "above" ? crossoverOtherIncome({ age: startAge, privatePension, publicPension }) : null;
  const optimal =
    totalBalance > 0 ? { totalBalance, ...calcOptimalWithdrawalYears({ totalBalance, startAge, publicPension, otherIncome, lifelong }) } : null;

  const assumptions = [];
  assumptions.push({ key: "law", label: "법령 기준", value: LAW_VERSION });
  assumptions.push({ key: "age", label: "수령 시작 나이", value: `${startAge}세` });
  if (lifelong) assumptions.push({ key: "lifelong", label: "종신계약", value: "사망 때까지 수령(3%)" });
  assumptions.push({ key: "deduction", label: "공제 가정", value: "기본공제 150만원 · 표준세액공제 7만원 · 경로우대 100만원(70세 이상)" });
  assumptions.push({ key: "taxable", label: "과세 대상", value: "적격 사적연금(세액공제분·운용수익)만 — 비과세 원금·퇴직소득 유래는 제외" });
  if (otherIncome > 0) {
    assumptions.push({ key: "otherIncome", label: "그 밖의 소득", value: `연 ${Math.round(otherIncome / 10_000).toLocaleString()}만원 가정` });
  }
  if (retirementPension > 0) {
    assumptions.push({
      key: "retirementPension",
      label: "퇴직소득 유래 연금",
      value: `연 ${Math.round(retirementPension / 10_000).toLocaleString()}만원 — 1,500만원 계산에서 제외`,
    });
  }
  if (optimal) {
    assumptions.push({ key: "balance", label: "분산 계산", value: "잔액 고정·운용수익 미반영" });
  }
  assumptions.push({ key: "local", label: "지방소득세", value: "소득세의 10% 포함" });

  const result = {
    law: LAW_VERSION,
    config: { id: TAX_CONFIG.id, effectiveFrom: TAX_CONFIG.effectiveFrom, checkedOn: TAX_CONFIG.checkedOn },
    scope: ELIGIBLE_SCOPE,
    inputs: { startAge, privatePension, publicPension, otherIncome, retirementPension, totalBalance, lifelong },
    assumptions,
    routes,
    cliff,
    crossover,
    optimal,
    health,
    headline:
      privatePension === 0
        ? "연간 사적연금 수령액을 넣으면 두 과세 방법을 비교합니다."
        : buildHeadline(routes, startAge),
    disclosures: [
      "참고용 추정이며 세무 상담이 아닙니다.",
      "실제 세액은 다른 소득·공제·연금계좌 구성에 따라 달라집니다. 국세청(126) 또는 세무 전문가와 확인하세요.",
      "퇴직소득 유래 연금은 1,500만원 계산에서 빠지고 퇴직소득세의 70%로 따로 과세됩니다. 이 도구는 그 금액을 계산하지 않습니다.",
      "상품 가입·투자를 권하지 않습니다. 입력값은 브라우저에서만 계산되고 저장·전송되지 않습니다.",
    ],
  };
  result.memo = buildResultMemo5(result, { optimal: optimal ? { ...optimal, totalBalance } : null });
  return result;
}

/** 결론 한 줄 — 결과 카드 맨 위 */
function buildHeadline(routes, age) {
  const w = routes.options.find((o) => o.key === routes.winner);
  const l = routes.options.find((o) => o.key !== routes.winner);
  const diff = Math.round((l.tax - w.tax) / 1000) * 1000;
  const fmt = (n) => `${Math.round(n / 10_000).toLocaleString()}만원`;
  if (routes.threshold.status === "below") {
    if (routes.winner === "withholding") {
      return `연 ${fmt(routes.privatePension)}은 연금소득세 ${(routes.rate * 100).toFixed(1)}%(${fmt(w.tax)})로 끝납니다. 합산 신고보다 ${fmt(diff)} 적습니다.`;
    }
    return `연 ${fmt(routes.privatePension)}은 종합소득에 합산하는 편이 ${fmt(diff)} 적습니다(원천징수 ${fmt(l.tax)} → ${fmt(w.tax)}).`;
  }
  if (routes.winner === "comprehensive") {
    return `연 ${fmt(routes.privatePension)}은 종합과세가 ${fmt(diff)} 적습니다. 1,500만원을 넘어도 다른 소득이 적으면 합산이 유리합니다.`;
  }
  return `연 ${fmt(routes.privatePension)}은 15% 분리과세가 ${fmt(diff)} 적습니다. 다른 소득이 많아 누진세율이 16.5%를 넘습니다.`;
}

export default {
  LAW,
  LAW_VERSION,
  TAX_CONFIG,
  ELIGIBLE_SCOPE,
  withholdingRate,
  pensionIncomeDeduction,
  progressiveIncomeTax,
  comprehensivePensionTax,
  compareRoutes,
  thresholdCliff,
  crossoverOtherIncome,
  calcOptimalWithdrawalYears,
  manLabel,
  buildResultMemo5,
  pensionReceiptLimit,
  simulateWithdrawalOrder,
  healthInsuranceExposure,
  simulate,
};
