/**
 * `engine.js` 의 타입 선언.
 *
 * 엔진은 두 앱(buffetkimz.com · InsureCRM)이 같은 파일을 쓰도록 순수 JS로 둔다.
 * 그래서 화면(TSX)이 읽는 모양만 여기에 적는다. 값은 전부 엔진이 만들고, 화면은 읽기만 한다.
 */

export type SimpyeongRecord = {
  source: "basic" | "detail" | "rx";
  date: string;
  hospital: string;
  dept: string;
  code: string;
  name: string;
  visit: string;
  visits: number;
  ingredient: string;
  inpatient: boolean;
  outpatient: boolean;
  inpatientDays: number;
  category: string;
  item: string;
  drug: string;
  supplyDays: number;
  isSurgery: boolean;
  isAnesthesia: boolean;
  amount: number;
  selfPay: number;
  isRx: boolean;
};

export type SimpyeongCard = {
  key: string;
  label: string;
  value: string | number;
  unit: string;
  sub: string;
  tone: "rose" | "amber" | "rown" | "jade" | string;
};

export type SimpyeongQuestion = {
  hit: boolean;
  count: number;
  rows: SimpyeongRecord[];
  unsure?: boolean;
};

export type SimpyeongResult = {
  baseDate: string;
  basicFile: boolean;
  basicUndated: boolean;
  hasDiseaseData: boolean;
  customer: string;
  birth: string;
  reviewType: string;
  surgeryThreshold: number;
  totalThreshold: number;
  files: { name: string; rows: number; failed: boolean }[];
  failedFiles: string[];
  records: SimpyeongRecord[];
  counts: Record<string, number>;
  cards: SimpyeongCard[];
  admissions: { rec: SimpyeongRecord; days: number }[];
  surgeries: SimpyeongRecord[];
  anesthesia: SimpyeongRecord[];
  noDetail: SimpyeongRecord[];
  suspected: SimpyeongRecord[];
  detailFile: boolean;
  recent3m: (SimpyeongRecord & { group: unknown; days: number; end: string })[];
  recent3mAll: SimpyeongRecord[];
  longCourses: { drug: string; group: unknown; start: string; end: string; days: number; recs: SimpyeongRecord[] }[];
  courses: { drug: string; group: unknown; start: string; end: string; days: number; recs: SimpyeongRecord[] }[];
  rxList: (SimpyeongRecord & { group: unknown; days: number; end: string })[];
  otherDrugs: { name: string; rows: SimpyeongRecord[] }[];
  groups: { bp: SimpyeongRecord[]; lipid: SimpyeongRecord[]; dm: SimpyeongRecord[] };
  diseaseMap: { rec: SimpyeongRecord; tags: { key: string; ten: boolean }[]; count: number }[];
  warnKeys: string[];
  tenHits: { key: string; rec: SimpyeongRecord }[];
  frequent: { key: string; name: string; code: string; count: number; dates: string[]; rec: SimpyeongRecord }[];
  questions: { q3m: SimpyeongQuestion; q1y: SimpyeongQuestion; q2y: SimpyeongQuestion; q5y: SimpyeongQuestion; q10: SimpyeongQuestion };
  questionHits: number;
  questionUnsure: number;
};

export type SimpyeongOptions = {
  baseDate?: string;
  customer?: string;
  birth?: string;
  reviewType?: string;
  surgeryThreshold?: number;
  totalThreshold?: number;
};

export type SimpyeongTable = { name: string; rows: unknown[][] };

export function analyze(tables: SimpyeongTable[], options?: SimpyeongOptions): SimpyeongResult;
export function buildSummary(result: SimpyeongResult, sections?: string[] | null): string;
export function buildCustomerMessage(result: SimpyeongResult, options?: { sender?: string }): string;
export function buildReportHTML(result: SimpyeongResult, options?: Record<string, unknown>): string;
export function EXAMPLE_TABLES(baseISO?: string): SimpyeongTable[];
export function parseTablesFromLines(name: string, lines: string[]): SimpyeongTable[];
export function pdfWordsToRows(words: { x0: number; x1: number; y0?: number; y1?: number; cy: number; h: number; t: string }[]): string[][];
export function todayISO(): string;
export function dotDate(iso: string): string;
export function isoAddDays(iso: string, n: number): string;
export function daysBetween(a: string, b: string): number;
export function ago(iso: string, baseISO: string): string;
export function normalizeDate(value: unknown): string;
export function drugGroup(name: string): { key: string; label: string; short: string } | null;
export const SECTIONS: { key: string; label: string }[];
