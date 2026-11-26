/**
 * `engine.js` 의 타입 선언.
 *
 * 엔진은 두 앱(buffetkimz.com · InsureCRM)이 같은 파일을 쓰도록 순수 JS로 둔다.
 * 그래서 화면(TSX)이 읽는 모양만 여기에 적는다. 값은 전부 엔진이 만들고, 화면은 읽기만 한다.
 */

export type Visit = "outpatient" | "inpatient";
export type HospitalId = "clinic" | "hospital" | "general" | "tertiary";
export type CoveredKind = "partial" | "full";
export type Severity = "mild" | "severe";
export type Variant23 = "standard" | "selective";
export type ProfileId = "gen1d" | "gen1l" | "gen2" | "gen3" | "gen4" | "gen5" | "chronic";
export type NonKey = "general" | "physical" | "injection" | "mri";

export type Hospital = {
  id: HospitalId;
  label: string;
  fixed: number;
  fixed45: number;
  ghRate: number;
  upper: boolean;
};

export type Profile = {
  id: ProfileId;
  label: string;
  short: string;
  purchase: string;
  era: number;
  selfRate?: number;
  insurer?: string;
  standard?: number;
  selective?: number;
  selCovered?: number;
  selNon?: number;
  special?: number;
};

export type LineItem = {
  key: string;
  label: string;
  base: number;
  deductible: number;
  payout: number;
  reason: string;
};

export type ProfileResult = {
  id: ProfileId;
  label: string;
  short: string;
  purchase: string;
  items: LineItem[];
  notes: string[];
  base: number;
  payout: number;
  self: number;
  payoutRate: number;
  selfRate: number;
};

export type SilsonInput = {
  visit?: Visit;
  hospital?: HospitalId;
  coveredKind?: CoveredKind;
  severity?: Severity;
  variant23?: Variant23;
  coveredAmount?: number;
  non?: Partial<Record<NonKey, number>>;
  primary?: ProfileId;
};

export type ComparisonRow = {
  id: ProfileId;
  label: string;
  short: string;
  payout: number;
  self: number;
  payoutRate: number;
  primary: boolean;
  diff: number;
};

export type Comparison = {
  input: Required<Omit<SilsonInput, "non">> & { non: Record<NonKey, number> };
  hospital: Hospital;
  total: number;
  primary: ProfileResult;
  rows: ProfileResult[];
  diffs: { id: ProfileId; label: string; short: string; diff: number }[];
};

export const HOSPITALS: Record<HospitalId, Hospital>;
export const HOSPITAL_IDS: HospitalId[];
export const NON_KEYS: NonKey[];
export const NON_LABELS: Record<NonKey, string>;
export const PROFILES: Profile[];
export const PROFILE_IDS: ProfileId[];

export function generationFromDate(dateStr: string): { id: string; label: string; note: string } | null;
export function normalizeInput(input?: SilsonInput): Comparison["input"];
export function calculateProfile(profileId: ProfileId, input?: SilsonInput): ProfileResult;
export function compare(input?: SilsonInput): Comparison;
export function comparisonRows(result: Comparison): ComparisonRow[];
export function headline(result: Comparison): string;
export function summaryLines(result: Comparison): string[];
export function buildMessage(result: Comparison, opts?: { name?: string }): string;
export function comparisonSummary(result: Comparison): string;
export const FORMAT: { comma: (v: number) => string; pct: (r: number) => string };
