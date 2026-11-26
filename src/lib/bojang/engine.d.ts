/**
 * 보장분석 엔진 타입 — 화면 컴포넌트가 읽는 만큼만 적는다.
 */

export type GroupId =
  | "silson"
  | "cancer"
  | "brain"
  | "surgery"
  | "hospital"
  | "driver"
  | "liability"
  | "death"
  | "etc";

export type PayKind = "lump" | "daily" | "limit" | "rate";

export type Coverage = {
  id: string;
  name: string;
  group: GroupId;
  kind: PayKind;
  tags: string[];
  amount: number | null;
  rate: string;
  premium: number | null;
  insurer: string;
  product: string;
  startDate: string;
  term: string;
  note: string;
  raw: string;
  confidence: "high" | "mid" | "low";
  rule: string | null;
};

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
  daily: Coverage[];
  limits: Coverage[];
  rates: Coverage[];
  target: number | null;
  ratio: number | null;
  level: "has" | "none" | "ok" | "low" | "vlow";
  has: boolean;
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
export const SAMPLES: { before: string; after: string };

export function parseAmount(input: unknown, opts?: { unit?: "원" | "만원" }): number | null;
export function formatMan(won: number | null): string;
export function classify(name: string): { group: GroupId; kind: PayKind; tags: string[]; rule: string | null };
export function silsonGeneration(dateStr: string): { id: string; label: string } | null;
export function splitCells(line: string): string[];
export function parseText(text: string): {
  rows: { name: string; amount: number | null; rate: string; premium: number | null; term: string; raw: string; unit: string }[];
  premiumSum: number;
  sawPremiumLabel: boolean;
};
export function normalizeRows(rows: Record<string, unknown>[], opts?: { keepGroup?: boolean }): Coverage[];
export function parseJSON(data: unknown): Coverage[];
export function readDocument(
  text: string,
  opts?: { premium?: number | null },
): { coverages: Coverage[]; premium: number | null; premiumSource: string | null; rowCount: number };
export function summarize(
  coverages: Coverage[],
  opts?: { label?: string; premium?: number | null; contracts?: number; targets?: Record<string, number> | null; targetsAreManwon?: boolean; at?: string },
): Summary;
export function compare(before: Coverage[], after: Coverage[]): Comparison;
export function compareLines(cmp: Comparison): string[];
export function buildMessage(summary: Summary, opts?: { name?: string }): string;
