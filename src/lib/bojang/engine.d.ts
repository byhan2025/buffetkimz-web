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

export type PillarStatus = "met" | "short" | "none" | "check";

export type PillarItem = {
  id: string;
  label: string;
  short: string;
  group: GroupId;
  groupLabel: string;
  tone: string;
  measure: "sum" | "causeMax" | "max" | "daily" | "presence";
  cause: "disease" | "accident" | "";
  target: number;
  value: number | null;
  status: PillarStatus;
  statusLabel: string;
  ratio: number | null;
  count: number;
  names: string[];
  common: boolean;
  note: string;
};

export type Pillars = {
  at: string;
  total: number;
  met: number;
  short: number;
  none: number;
  check: number;
  ratio: number;
  summaryLine: string;
  items: PillarItem[];
  groups: { id: GroupId; label: string; short: string; tone: string; met: number; total: number }[];
  thin: PillarItem[];
  empty: PillarItem[];
  unconfirmed: PillarItem[];
  root: {
    label: string;
    short: string;
    note: string;
    status: "met" | "none";
    statusLabel: string;
    count: number;
    generation: string | null;
    generationLabel: string | null;
    from: "담보명" | "계약일" | null;
    names: string[];
  };
  note: string;
};

export type PillarCompareItem = {
  id: string;
  label: string;
  short: string;
  group: GroupId;
  groupLabel: string;
  tone: string;
  measure: PillarItem["measure"];
  target: number;
  before: { status: PillarStatus; value: number | null; count: number };
  after: { status: PillarStatus; value: number | null; count: number };
  delta: number | null;
  change: "new" | "filled" | "up" | "lost" | "dropped" | "raised" | "same" | "none";
};

export type PillarComparison = {
  before: Pillars;
  after: Pillars;
  items: PillarCompareItem[];
  built: PillarCompareItem[];
  filled: PillarCompareItem[];
  lost: PillarCompareItem[];
  empty: PillarCompareItem[];
  metDelta: number;
  summaryLine: string;
  changed: number;
};

export type ContractGroup = {
  key: string;
  insurer: string;
  product: string;
  startDate: string;
  payTerm: string;
  coverTerm: string;
  count: number;
  premium: number | null;
  premiumKnown: boolean;
  paidTotal: number | null;
  top: string[];
  kinds: { lump: number; daily: number; limit: number; rate: number };
  unnamed: boolean;
  items: Coverage[];
};

export type ContractTable = {
  groups: ContractGroup[];
  count: number;
  premium: number | null;
  paidTotal: number | null;
  unnamed: number;
  note: string;
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
  pillars: Pillars;
  contractTable: ContractTable;
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
  pillars: PillarComparison;
};

export const FORMAT: string;
export const GROUPS: { id: GroupId; label: string; short: string; tone: string; kind: PayKind; core: boolean; note: string }[];
export const GROUP_IDS: GroupId[];
export const PAY_KINDS: Record<PayKind, string>;
export const LEVEL_LABELS: Record<Level, string>;
export const DEFAULT_TARGETS: Partial<Record<GroupId, number>>;
export const DEFAULT_TARGET_NOTE: string;
export const PILLAR_ROOT: { label: string; short: string; note: string };
export const PILLAR_TOTAL: number;
export const PILLAR_STATUS_LABELS: Record<PillarStatus, string>;
export const PILLAR_NOTE: string;
export const PILLARS: {
  id: string;
  label: string;
  short: string;
  group: GroupId;
  measure: PillarItem["measure"];
  target: number;
  include: RegExp | null;
  exclude: RegExp | null;
  cause?: "disease" | "accident";
  note?: string;
}[];
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
    insurer: string;
    product: string;
    startDate: string;
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
    contractsMeta?: Record<string, unknown>[];
    targets?: Partial<Record<GroupId, number>> | null;
    targetsAreManwon?: boolean;
    useDefaultTargets?: boolean;
    at?: string;
  },
): Summary;
export function compare(before: Coverage[], after: Coverage[]): Comparison;
export function compareLines(cmp: Comparison): string[];
export function pillars(coverages: Coverage[], opts?: { at?: string }): Pillars;
export function pillarItems(pillar: string | (typeof PILLARS)[number], coverages: Coverage[]): Coverage[];
export function comparePillars(before: Coverage[], after: Coverage[]): PillarComparison;
export function pillarCompareLines(cmp: PillarComparison | null): string[];
export function causeOf(name: string): "disease" | "accident" | "both" | "common";
export function contractKeyOf(c: Partial<Coverage>): string;
export function groupContracts(
  coverages: Coverage[],
  opts?: { contracts?: Partial<ContractGroup>[] },
): ContractTable;
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
