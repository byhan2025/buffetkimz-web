/**
 * `pension-engine.mjs`(연금 인출·세금 계산 엔진)의 타입 선언.
 *
 * 엔진 파일은 보고서(`reports/buffetkimz-web/v60-pension-sim/pension_engine.mjs`)와
 * **해시가 같은 원본**이다(복사 후 수정 금지). 타입은 이 선언 파일에만 둔다.
 */
declare module "@/lib/pension-engine.mjs" {
  export const LAW_VERSION: string;
  export const LAW: Record<string, unknown>;
  export const ELIGIBLE_SCOPE: {
    included: { key: string; label: string; basis: string }[];
    excluded: { key: string; label: string; why: string }[];
    note: string;
  };
  export const TAX_CONFIG: {
    id: string;
    effectiveFrom: string;
    checkedOn: string;
    source: string;
    values: Record<string, unknown>;
    effectiveNotes: { item: string; value: string; effectiveFrom: string; note?: string }[];
  };

  export type RouteOption = {
    key: string;
    label: string;
    tax: number;
    basis: string;
    detail?: Record<string, number | string>;
  };

  export type SimulateResult = {
    law: string;
    config: { id: string; effectiveFrom: string; checkedOn: string };
    inputs: {
      startAge: number;
      privatePension: number;
      publicPension: number;
      otherIncome: number;
      retirementPension: number;
      totalBalance: number;
      lifelong: boolean;
    };
    assumptions: { key: string; label: string; value: string }[];
    routes: {
      privatePension: number;
      threshold: { amount: number; status: "below" | "above" };
      options: RouteOption[];
      winner: string;
      winnerLabel: string;
      difference: number;
      withheld: number;
      rate: number;
      rateLabel: string;
      comprehensiveDelta: number;
    };
    cliff: {
      belowTax: number;
      aboveTax: number;
      delta: number;
      jump: number;
      aboveOption: RouteOption;
      note: string;
    };
    crossover: { otherIncomeAtBreakEven: number | null; note: string } | null;
    optimal: {
      feasible: boolean;
      minYears: number;
      years: number;
      perYearLimit: number;
      schedule: { year: number; age: number; amount: number; tax: number; route: string; routeLabel: string }[];
      spread: { years: number; tax: number; effectiveRate: number };
      concentrated: { years: number; tax: number; route: string; routeLabel: string; rate: number };
      saving: number;
      note: string;
      totalBalance?: number;
    } | null;
    health: {
      publicPension: number;
      limit: number;
      over: boolean;
      remaining: number;
      note: string;
      privatePensionNote: string;
    };
    headline: string;
    disclosures: string[];
    memo: { lines: string[]; text: string };
  };

  export function simulate(input: {
    startAge?: number;
    privatePension?: number;
    publicPension?: number;
    otherIncome?: number;
    retirementPension?: number;
    totalBalance?: number;
    lifelong?: boolean;
  }): SimulateResult;

  export function manLabel(n: number): string;
  export function compareRoutes(args: Record<string, unknown>): Record<string, unknown>;
  export function thresholdCliff(args?: Record<string, unknown>): Record<string, unknown>;
  export function calcOptimalWithdrawalYears(args: Record<string, unknown>): Record<string, unknown>;
  export function healthInsuranceExposure(args?: { publicPension?: number }): Record<string, unknown>;
  export function withholdingRate(age: number, opts?: { lifelong?: boolean }): Record<string, unknown>;
}
