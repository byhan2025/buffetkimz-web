/**
 * 심평원 고지 정리기 — 파일 읽기 (브라우저 로컬)
 *
 * xlsx·xls·csv 는 SheetJS(동적 import), pdf 는 pdfjs-dist(동적 import)로 읽는다.
 * 두 라이브러리 모두 이 사이트 번들에 들어 있고, 파일은 어디로도 전송되지 않는다.
 * 읽은 결과는 `{ name, rows: string[][] }[]` 표 목록이며 엔진이 이 모양만 알면 된다.
 */

import { pdfWordsToRows } from "./engine.js";

const XLSX_EXT = /\.(xlsx|xlsm|xls|csv)$/i;

function cellsFromSheet(rows) {
  return rows.map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : []));
}

async function pdfTables(file: File, onStatus?: (msg: string) => void) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const tables: { name: string; rows: string[][] }[] = [];
  const pages = Math.min(doc.numPages, 120);
  for (let p = 1; p <= pages; p++) {
    onStatus?.(`PDF ${p}/${pages}쪽 읽는 중`);
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as unknown as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>).filter(
      (raw) => raw.transform && (raw.str || "").trim(),
    );
    /* 세로 방향 판별 — 심평원이 만든 PDF는 글자 좌표가 위에서 아래로(화면 좌표) 오고,
       브라우저가 인쇄한 PDF는 아래에서 위로(PDF 좌표) 온다. 첫 글자가 위쪽이면 화면 좌표로 본다. */
    const ys = items.map((raw) => raw.transform![5]).sort((a, b) => a - b);
    const firstY = items.length ? items[0].transform![5] : 0;
    const topDown = ys.length > 0 && firstY <= ys[ys.length >> 1];
    const words: { x0: number; x1: number; y0: number; y1: number; cy: number; h: number; t: string }[] = [];
    for (const raw of items) {
      const s = (raw.str || "").trim();
      if (!s || !raw.transform) continue;
      const h = Math.hypot(raw.transform[2], raw.transform[3]) || raw.height || 10;
      const x0 = raw.transform[4];
      const cy = topDown ? raw.transform[5] - h / 2 : vp.height - raw.transform[5] - h / 2;
      words.push({ x0, x1: x0 + (raw.width || s.length * h * 0.6), y0: cy - h / 2, y1: cy + h / 2, cy, h, t: s });
    }
    const rows = pdfWordsToRows(words) as string[][];
    if (rows.length < 2) {
      tables.push({ name: `${file.name} ${p}쪽(글자 없음)`, rows: [] });
      continue;
    }
    tables.push({ name: `${file.name} ${p}쪽`, rows });
  }
  try {
    await doc.destroy();
  } catch {
    /* 정리 실패는 결과에 영향 없음 */
  }
  return tables;
}

async function sheetTables(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellText: true });
  const out = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: false });
    out.push({ name: wb.SheetNames.length > 1 ? `${file.name} — ${name}` : file.name, rows: cellsFromSheet(rows as unknown[][]) });
  }
  return out;
}

async function textTables(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const delim = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.split(",").length > 4) ? "," : null;
  const rows = lines
    .filter((l) => l.trim())
    .map((l) => (delim ? l.split(delim).map((c) => c.replace(/^"|"$/g, "").trim()) : [l]));
  return [{ name: file.name, rows }];
}

export type ReadResult = {
  tables: { name: string; rows: string[][] }[];
  skipped: string[];
  error: string;
};

export async function readSimpyeongFiles(files: File[], onStatus?: (msg: string) => void): Promise<ReadResult> {
  const tables: { name: string; rows: string[][] }[] = [];
  const skipped: string[] = [];
  let error = "";
  for (const file of files) {
    try {
      if (XLSX_EXT.test(file.name)) tables.push(...(await sheetTables(file)));
      else if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") tables.push(...(await pdfTables(file, onStatus)));
      else if (/\.(txt|tsv)$/i.test(file.name) || /^text\//.test(file.type)) tables.push(...(await textTables(file)));
      else skipped.push(file.name);
    } catch (e) {
      error = `${file.name}: ${(e as Error).message || "파일을 읽지 못했습니다."}`;
    }
  }
  return { tables, skipped, error };
}
