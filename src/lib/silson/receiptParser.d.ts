/** `receiptParser.js` 의 타입 — 화면 코드가 안전하게 쓸 수 있게 */

export type ReceiptItem = {
  key: string;
  label: string;
  value: number;
  evidence: string;
  confidence: number;
  source: string;
  note?: string;
};

export type ReceiptWarning = { code: string; text: string };

export type ReceiptFields = {
  visit: "outpatient" | "inpatient";
  hospital: "clinic" | "hospital" | "general" | "tertiary";
  coveredPartial: number;
  coveredFull: number;
  prescription: number;
  coPayment: number;
  non: { general: number; physical: number; injection: number; mri: number };
  room: number;
  roomDays: number;
};

export type ReceiptParse = {
  ok: boolean;
  kind: "clinic" | "pharmacy";
  fields: ReceiptFields | null;
  items: ReceiptItem[];
  warnings: ReceiptWarning[];
  summary: string;
  meta: {
    computed?: number;
    patientTotal?: number | null;
    diff?: number;
    visitWhy?: string;
    hospitalWhy?: string;
    hospitalLabel?: string;
    version?: string;
  };
};

export type ReceiptSample = {
  id: string;
  name: string;
  note: string;
  visit: string;
  hospital: string;
  lines: string[];
};

export const RECEIPT_VERSION: string;
export const RECEIPT_SOURCE: string;
export const RECEIPT_SAMPLES: ReceiptSample[];
export const RECEIPT_FIELD_LABELS: Record<string, string>;

export function fixDigits(s: string): string;
export function detectKind(lines: string[]): "clinic" | "pharmacy";
export function detectVisit(lines: string[]): { visit: "outpatient" | "inpatient"; why: string };
export function detectHospital(lines: string[]): { hospital: ReceiptFields["hospital"]; why: string };
export function parseReceiptLines(input: string[] | string): ReceiptParse;
export function parseReceiptText(text: string): ReceiptParse;
export function toSilsonInput<T extends Record<string, unknown>>(parsed: ReceiptParse | null, base?: T): T & Partial<ReceiptFields>;
