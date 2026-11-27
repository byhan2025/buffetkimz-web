/**
 * 보장분석 엔진 타입 — 화면 컴포넌트가 읽는 만큼만 적는다.
 */

export type GroupId =
  | "silson"
  | "cancer"
  | "brain"
  | "surgery"
  | "outpatient"
  | "hospital"
  | "driver"
  | "liability"
  | "death"
  | "etc";

export type PayKind = "lump" | "daily" | "limit" | "rate";

export type CoverageSub = "diagnosis" | "surgery" | "treatment" | "inpatient" | "outpatient" | "death" | "disability" | "";

export type Coverage = {
  id: string;
  name: string;
  group: GroupId;
  kind: PayKind;
  sub: CoverageSub;
  tags: string[];
  amount: number | null;
  rate: string;
  premium: number | null;
  insurer: string;
  product: string;
  startDate: string;
  term: string;
  payTerm: string;
  coverTerm: string;
  renew: "갱신" | "비갱신" | "";
  paidTotal: number | null;
  note: string;
  raw: string;
  confidence: "high" | "mid" | "low";
  rule: string | null;
};

export type Level = "has" | "none" | "ok" | "low" | "vlow" | "rich";

export type GroupSummary = {
  id: GroupId;
  label: string;
  short: string;
  tone: string;
  note: string;
  core: boolean;
  items: Coverage[];
  count: number;
  lump: number;
  surgery: number;
  treatment: number;
  surgeryItems: Coverage[];
  treatItems: Coverage[];
  generalCancer: number;
  similarCancer: number;
  deathDisease: number;
  deathAccident: number;
  disability: number;
  daily: Coverage[];
  limits: Coverage[];
  rates: Coverage[];
  target: number | null;
  ratio: number | null;
  level: Level;
  levelLabel: string;
  has: boolean;
  renewCount: number;
  nonRenewCount: number;
  renewPremium: number;
  paidTotal: number;
};

export type Check = {
  level: "check" | "info";
  code: string;
  group?: GroupId;
  text: string;
};

export type SilsonInfo = {
  found: boolean;
  generation: string | null;
  label: string | null;
  from: "담보명" | "계약일" | null;
  items: Coverage[];
};

export type Judge = { id: GroupId; label: string; value: number; target: number; ratio: number | null; level: Level; levelLabel: string };

export type Summary = {
  format: string;
  label: string;
  at: string;
  count: number;
  contracts: number | null;
  premium: number | null;
  premiumKnown: boolean;
  groups: GroupSummary[];
  silson: SilsonInfo;
  checks: Check[];
  judge: Judge[];
  renew: { count: number; nonRenewCount: number; unknown: number; premium: number };
  paidTotal: number;
  targetsNote: string;
  unknown: { name: string; amount: number | null }[];
  missingTargets: string[];
};

export type CompareRow = {
  name: string;
  group: GroupId;
  kind: PayKind;
  before: number | null;
  after: number | null;
  delta: number;
  status: "new" | "removed" | "up" | "down" | "same";
};

export type Comparison = {
  a: Summary;
  b: Summary;
  groups: {
    id: GroupId;
    label: string;
    short: string;
    tone: string;
    before: { count: number; lump: number; level: string };
    after: { count: number; lump: number; level: string };
    delta: number;
    status: "new" | "removed" | "up" | "down" | "same" | "none";
  }[];
  rows: CompareRow[];
  premium: { before: number | null; after: number | null; delta: number | null };
  changed: number;
};

export const FORMAT: string;
export const GROUPS: { id: GroupId; label: string; short: string; tone: string; kind: PayKind; core: boolean; note: string }[];
export const GROUP_IDS: GroupId[];
export const PAY_KINDS: Record<PayKind, string>;
export const LEVEL_LABELS: Record<Level, string>;
export const DEFAULT_TARGETS: Partial<Record<GroupId, number>>;
export const DEFAULT_TARGET_NOTE: string;
export const SAMPLES: { before: string; after: string };

export function parseAmount(input: unknown, opts?: { unit?: "원" | "만원" }): number | null;
export function formatMan(won: number | null): string;
export function isoDate(v: string | Date | null | undefined): string;
export function classify(name: string): { group: GroupId; kind: PayKind; tags: string[]; sub: CoverageSub; rule: string | null };
export function silsonGeneration(dateStr: string): { id: string; label: string } | null;
export function splitCells(line: string): string[];
export function parseText(text: string): {
  rows: {
    name: string;
    amount: number | null;
    rate: string;
    premium: number | null;
    payTerm: string;
    coverTerm: string;
    renew: "갱신" | "비갱신" | "";
    term: string;
    raw: string;
    unit: string;
  }[];
  premiumSum: number;
  sawPremiumLabel: boolean;
};
export function parsePayYears(payTerm: string): number | null;
export function estimatePaidTotal(premium: number | null, payTerm: string): number | null;
export function normalizeRows(rows: Record<string, unknown>[], opts?: { keepGroup?: boolean }): Coverage[];
export function parseJSON(data: unknown): Coverage[];
export function readDocument(
  text: string,
  opts?: { premium?: number | null },
): { coverages: Coverage[]; premium: number | null; premiumSource: string | null; rowCount: number };
export function summarize(
  coverages: Coverage[],
  opts?: {
    label?: string;
    premium?: number | null;
    contracts?: number;
    targets?: Partial<Record<GroupId, number>> | null;
    targetsAreManwon?: boolean;
    useDefaultTargets?: boolean;
    at?: string;
  },
): Summary;
export function compare(before: Coverage[], after: Coverage[]): Comparison;
export function compareLines(cmp: Comparison): string[];
export function buildMessage(summary: Summary, opts?: { name?: string }): string;
export function buildCSV(coverages: Coverage[], summary: Summary): string;
export function buildBookHTML(
  summary: Summary,
  opts?: {
    name?: string;
    at?: string;
    insurers?: { name: string; phone: string; kind?: string }[];
    compare?: Comparison | null;
    letter?: string;
  },
): string;
