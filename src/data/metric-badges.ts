/**
 * 제도(R) 배지 카탈로그 — v9.0.0 P0 신설 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §4-3).
 *
 * 왜 시장 배지와 따로 두는가
 *  · `today.ts`의 지표(코스피·환율·기준금리)는 하루 네 번 값이 바뀐다. 반면 이 파일의 숫자는 **법·요율**이라
 *    연 단위로만 움직인다. 둘을 같은 배지로 그리면 "법 조문이 하루 네 번 바뀌는 것처럼" 보인다.
 *  · 그래서 이 파일은 `tax-rules.ts`의 상수만 읽어 표기 문자열을 만들고, 숫자는 **한 개도 손으로 적지 않는다.**
 *    `pct()`·`manLabel()`을 쓰지 않고 `0.165` 같은 리터럴을 적으면 `scripts/verify_tax_consistency.py` B1이
 *    빌드를 세운다(단일 출처 원칙).
 *  · 값이 바뀌는 날은 법이 바뀌는 날뿐이다. 그때는 `tax-rules.ts`를 먼저 고치고 이 파일은 그대로 둔다.
 *
 * 지금 단계(P0)에서 이 파일은 **데이터 계약만**이다. 화면에 그리는 컴포넌트는 P1(`LiveMetricBadge.astro`)이다.
 */
import {
  TAX_YEAR,
  PENSION_ACCOUNT,
  PRIVATE_PENSION_TAX,
  PUBLIC_PENSION_HEALTH_LIMIT,
  ISA,
  INCOME_TAX,
  HEALTH_INSURANCE,
  pct,
  manLabel,
} from "./tax-rules.ts";

/** 배지가 가리키는 법령 원문 — 조문 표기와 링크를 한 곳에서 만든다. */
const LAW = {
  incomeTax: { law: "소득세법", url: "https://www.law.go.kr/법령/소득세법" },
  specialTax: { law: "조세특례제한법", url: "https://www.law.go.kr/법령/조세특례제한법" },
  healthRule: { law: "국민건강보험법 시행규칙", url: "https://www.law.go.kr/법령/국민건강보험법시행규칙" },
  healthDecree: { law: "국민건강보험법 시행령", url: "https://www.law.go.kr/법령/국민건강보험법시행령" },
} as const;

/** `2026년 기준` — 연도 표기도 `tax-rules.ts`의 TAX_YEAR에서만 나온다. */
export const RULE_BADGE_YEAR_LABEL = `${TAX_YEAR}년 기준`;

/**
 * 배지 id — 글 frontmatter `metrics.rules`·트랙 `stage.badges.rules`가 참조하는 **닫힌 목록**.
 * 없는 id를 참조하면 `scripts/verify_tracks.py`가 빌드를 세운다(빈 배지를 그리지 않는다).
 */
export const METRIC_BADGE_IDS = [
  "pension-combined-limit",
  "pension-credit-rate",
  "pension-private-threshold",
  "annuity-tax-rate",
  "early-withdraw-rate",
  "isa-exempt",
  "isa-rate",
  "dividend-rate",
  "financial-income-threshold",
  "public-pension-health-limit",
  "health-rate",
] as const;

export type MetricBadgeId = (typeof METRIC_BADGE_IDS)[number];

export type MetricBadge = {
  id: MetricBadgeId;
  /** 배지 이름 — 값 앞에 붙는 말 */
  name: string;
  /** 값 — `pct()`·`manLabel()`으로만 만든 문자열 */
  value: string;
  /** 왜 이 숫자인가 — 요건·구간을 한 줄로 (panel 변형에서만 그린다) */
  basis: string;
  /** 조문 표기 — '소득세법 제59조의3' */
  law: string;
  /** 법령 원문 링크 */
  lawUrl: string;
  /** 기준 연도 표기 — '2026년 기준' */
  yearLabel: string;
};

/** IRP 한도 = 합산 한도 − 연금저축 한도 (300만원) — 두 숫자를 따로 적지 않는다. */
const IRP_LIMIT = PENSION_ACCOUNT.combinedLimit - PENSION_ACCOUNT.savingsLimit;

export const METRIC_BADGES: MetricBadge[] = [
  {
    id: "pension-combined-limit",
    name: "연금계좌 합산 한도",
    value: `${manLabel(PENSION_ACCOUNT.combinedLimit)} (연금저축 ${manLabel(PENSION_ACCOUNT.savingsLimit)} + IRP ${manLabel(IRP_LIMIT)})`,
    basis: "연금저축과 IRP에 넣은 금액을 합쳐 이 한도까지 세액공제 대상입니다.",
    law: "소득세법 제59조의3",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "pension-credit-rate",
    name: "세액공제율",
    value: `${pct(PENSION_ACCOUNT.creditRateLow)} (총급여 ${manLabel(PENSION_ACCOUNT.salaryThreshold)} 이하) / ${pct(PENSION_ACCOUNT.creditRateHigh)} (초과)`,
    basis: "총급여가 경계를 넘으면 같은 납입액의 환급액이 줄어듭니다. 지방소득세를 포함한 비율입니다.",
    law: "소득세법 제59조의3",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "pension-private-threshold",
    name: "사적연금 분리과세 기준",
    value: `연 ${manLabel(PRIVATE_PENSION_TAX.annualThreshold)}`,
    basis: "이 금액까지는 연금소득세로 분리과세되고, 넘으면 과세 방법을 고르게 됩니다.",
    law: "소득세법 제20조의3·제64조의4",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "annuity-tax-rate",
    name: "연금소득세",
    value: `${pct(PRIVATE_PENSION_TAX.rateUnder70)} · ${pct(PRIVATE_PENSION_TAX.rate70)} · ${pct(PRIVATE_PENSION_TAX.rate80)} (55~69·70~79·80세 이상)`,
    basis: "나이가 많을수록 낮아집니다. 지방소득세를 포함한 비율입니다.",
    law: "소득세법 제64조의4",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "early-withdraw-rate",
    name: "중도해지 기타소득세",
    value: pct(INCOME_TAX.otherIncomeWithLocal),
    basis: "연금계좌 요건을 못 채우고 중도해지하면 세액공제 받은 금액에 이 세율이 붙습니다.",
    law: "소득세법 제129조",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "isa-exempt",
    name: "ISA 비과세 한도",
    value: `${manLabel(ISA.exemptGeneral)} / 서민형 ${manLabel(ISA.exemptSeomin)}`,
    basis: "만기까지 유지한 계좌의 순이익 중 이 금액까지 비과세입니다.",
    law: "조세특례제한법 제91조의18",
    lawUrl: LAW.specialTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "isa-rate",
    name: "ISA 초과분 분리과세",
    value: pct(ISA.taxRate),
    basis: "비과세 한도를 넘는 수익에 붙는 세율입니다. 지방소득세를 포함합니다.",
    law: "조세특례제한법 제91조의18",
    lawUrl: LAW.specialTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "dividend-rate",
    name: "이자·배당 원천징수",
    value: pct(INCOME_TAX.dividendWithLocal),
    basis: "일반 계좌에서 이자·배당을 받을 때 미리 떼는 세율입니다. 지방소득세를 포함합니다.",
    law: "소득세법 제129조",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "financial-income-threshold",
    name: "금융소득 종합과세 기준",
    value: manLabel(INCOME_TAX.financialIncomeThreshold),
    basis: "이 금액을 넘으면 이자·배당이 다른 소득과 합쳐져 종합과세됩니다.",
    law: "소득세법 제14조·제62조",
    lawUrl: LAW.incomeTax.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "public-pension-health-limit",
    name: "건강보험 피부양자 소득 기준",
    value: manLabel(PUBLIC_PENSION_HEALTH_LIMIT),
    basis: "공적연금 소득이 이 금액을 넘으면 피부양자 자격을 잃을 수 있습니다. 사적연금 분리과세 기준과는 다른 제도입니다.",
    law: "국민건강보험법 시행규칙 별표 1의2",
    lawUrl: LAW.healthRule.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
  {
    id: "health-rate",
    name: "건강보험료율",
    value: pct(HEALTH_INSURANCE.rate, 2),
    basis: "직장가입자와 지역가입자에 같은 요율이 적용됩니다.",
    law: "국민건강보험법 시행령 제44조",
    lawUrl: LAW.healthDecree.url,
    yearLabel: RULE_BADGE_YEAR_LABEL,
  },
];

const BY_ID = new Map<string, MetricBadge>(METRIC_BADGES.map((badge) => [badge.id, badge]));

/** 파일에 없는 id는 undefined — 화면은 그 배지를 그리지 않는다(빈 칸을 만들지 않는다). */
export const metricBadgeById = (id: string): MetricBadge | undefined => BY_ID.get(id);
