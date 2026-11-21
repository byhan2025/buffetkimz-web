import { useMemo, useState } from "react";
import { CopyButton, OutputBox, Tabs, TextArea, UtilShell } from "./UtilShell";

/**
 * JSON 정리 + CSV ↔ 마크다운 표.
 *
 * 서버·라이브러리 없이 브라우저에서만 처리한다. JSON은 JSON.parse로 검증하고
 * (파싱 실패 위치를 줄·칸으로 환산해 알려 준다), CSV는 따옴표 규칙(RFC 4180)을 지켜 읽는다.
 */

type Mode = "json" | "csv";
type CsvDir = "toMarkdown" | "toCsv";
type Delim = "," | "\t" | ";";

const JSON_SAMPLE = `{
  "portfolio": [
    { "name": "국내 배당주 ETF", "weight": 0.35, "fee": 0.0025 },
    { "name": "미국 S&P500 ETF", "weight": 0.45, "fee": 0.0007 },
    { "name": "단기 국채", "weight": 0.2, "fee": 0.001 }
  ],
  "rebalance": { "cycle": "분기", "band": 0.05 },
  "checkedOn": "2026-11-21",
  "note": null
}`;

const CSV_SAMPLE = `계좌,세율,한도,비고
연금저축,16.5%,연 600만원,"소득 5,500만원 이하 기준"
IRP,16.5%,연 300만원,"연금저축과 합산 900만원"
ISA,9.9%,연 200만원 비과세,"초과분 분리과세, 의무 3년"`;

const MD_SAMPLE = `| 계좌 | 세율 | 한도 |
| --- | --- | --- |
| 연금저축 | 16.5% | 연 600만원 |
| IRP | 16.5% | 연 300만원 |
| ISA | 9.9% | 연 200만원 비과세 |`;

const DELIMS: { value: Delim; label: string }[] = [
  { value: ",", label: "쉼표 ," },
  { value: "\t", label: "탭" },
  { value: ";", label: "세미콜론 ;" },
];

/** RFC 4180 — 따옴표로 감싼 칸 안의 구분자·줄바꿈·"" 이스케이프를 지킨다 */
export function parseCsv(input: string, delim: Delim): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  /* 마지막 빈 줄과 전부 빈 칸인 줄은 버린다 */
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const escapeMd = (cell: string) => cell.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

export function csvToMarkdown(rows: string[][], align: "none" | "right"): string {
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")];
  const head = pad(rows[0]).map(escapeMd);
  const sep = Array(width).fill(align === "right" ? "---:" : "---");
  const body = rows.slice(1).map((r) => pad(r).map(escapeMd));
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(sep), ...body.map(line)].join("\n");
}

/** 표 한 줄을 칸으로 — \| 는 칸 구분자가 아니라 글자로 읽는다(정규식 lookbehind 없이) */
function splitMdRow(line: string): string[] {
  const body = line.replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") {
      cur += "|";
      i += 1;
    } else if (ch === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export function markdownToCsv(md: string, delim: Delim): string {
  const rows = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .map(splitMdRow)
    .filter((cells) => !cells.every((c) => /^:?-{3,}:?$/.test(c)));
  const needQuote = (c: string) => c.includes(delim) || c.includes('"') || c.includes("\n");
  return rows
    .map((cells) => cells.map((c) => (needQuote(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(delim))
    .join("\n");
}

function jsonError(err: unknown, text: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const pos = msg.match(/position (\d+)/i);
  if (!pos) return msg;
  const at = Number(pos[1]);
  const before = text.slice(0, at);
  const line = before.split("\n").length;
  const col = at - before.lastIndexOf("\n");
  const near = text.slice(Math.max(0, at - 24), at + 24).replace(/\n/g, "⏎");
  return `${line}번째 줄 ${col}번째 칸 근처에서 문법이 맞지 않습니다. (${near})`;
}

function jsonStats(value: unknown) {
  let keys = 0;
  let depth = 0;
  const walk = (v: unknown, d: number) => {
    depth = Math.max(depth, d);
    if (Array.isArray(v)) v.forEach((x) => walk(x, d + 1));
    else if (v && typeof v === "object") {
      for (const [, x] of Object.entries(v as Record<string, unknown>)) {
        keys += 1;
        walk(x, d + 1);
      }
    }
  };
  walk(value, 1);
  return { keys, depth };
}

export default function DataFormatter() {
  const [mode, setMode] = useState<Mode>("json");
  const [jsonIn, setJsonIn] = useState(JSON_SAMPLE);
  const [minify, setMinify] = useState(false);
  const [csvDir, setCsvDir] = useState<CsvDir>("toMarkdown");
  const [delim, setDelim] = useState<Delim>(",");
  const [align, setAlign] = useState<"none" | "right">("none");
  const [csvIn, setCsvIn] = useState(CSV_SAMPLE);
  const [mdIn, setMdIn] = useState(MD_SAMPLE);

  const jsonOut = useMemo(() => {
    if (!jsonIn.trim()) return { text: "", error: "", keys: 0, depth: 0, bytes: 0 };
    try {
      const value = JSON.parse(jsonIn);
      const text = minify ? JSON.stringify(value) : JSON.stringify(value, null, 2);
      const stat = jsonStats(value);
      return {
        text,
        error: "",
        keys: stat.keys,
        depth: stat.depth,
        bytes: new TextEncoder().encode(text).length,
      };
    } catch (err) {
      return { text: "", error: jsonError(err, jsonIn), keys: 0, depth: 0, bytes: 0 };
    }
  }, [jsonIn, minify]);

  const csvRows = useMemo(() => (csvDir === "toMarkdown" ? parseCsv(csvIn, delim) : []), [csvDir, csvIn, delim]);
  const markdown = useMemo(() => csvToMarkdown(csvRows, align), [csvRows, align]);
  const backToCsv = useMemo(() => markdownToCsv(mdIn, delim), [mdIn, delim]);

  return (
    <UtilShell
      id="json-csv-formatter"
      title="JSON 정리 · CSV ↔ 표 변환"
      subtitle="JSON을 예쁘게 펴거나 한 줄로 줄이고, CSV와 마크다운 표를 서로 바꿉니다."
      note={
        <>
          붙여넣은 데이터는 <strong className="font-semibold text-ink">브라우저 안에서만</strong> 처리됩니다. 저장도
          전송도 하지 않고, 새로 고치면 예시로 돌아갑니다.
        </>
      }
    >
      <Tabs
        label="변환 종류"
        value={mode}
        onChange={setMode}
        options={[
          { value: "json", label: "JSON 정리" },
          { value: "csv", label: "CSV ↔ 마크다운 표" },
        ]}
      />

      {mode === "json" ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:gap-5" data-json-pane>
          <div>
            <TextArea
              label="JSON 입력"
              value={jsonIn}
              onChange={setJsonIn}
              rows={14}
              mono
              placeholder='{"key": "value"}'
              hint="빈 값이면 결과도 비웁니다."
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMinify(false)}
                aria-pressed={!minify}
                className={
                  "min-h-[40px] rounded-full px-3.5 text-[12.5px] font-semibold " +
                  (!minify ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
                }
              >
                펴기 (들여쓰기 2칸)
              </button>
              <button
                type="button"
                onClick={() => setMinify(true)}
                aria-pressed={minify}
                className={
                  "min-h-[40px] rounded-full px-3.5 text-[12.5px] font-semibold " +
                  (minify ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
                }
              >
                한 줄로 압축
              </button>
              <button
                type="button"
                onClick={() => setJsonIn(JSON_SAMPLE)}
                className="min-h-[40px] rounded-full border border-line bg-white px-3.5 text-[12.5px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
              >
                예시
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-2">
              <p className="field-label">결과</p>
              <CopyButton label="결과 복사" text={jsonOut.text} disabled={!jsonOut.text} />
            </div>
            <div className="mt-1.5">
              <OutputBox
                text={jsonOut.text}
                maxHeight={330}
                empty={jsonOut.error ? "문법 오류를 고치면 결과가 나옵니다." : "JSON을 입력하세요."}
              />
            </div>

            {jsonOut.error ? (
              <div
                className="mt-2.5 rounded-xl border border-[#e8d3c6] bg-[#fbf3ef] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#8a4a2e]"
                data-json-error
              >
                <p className="font-bold">JSON 문법 오류</p>
                <p className="mt-1">{jsonOut.error}</p>
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-3 gap-2" data-json-stats>
                <div className="rounded-lg border border-line bg-white px-3 py-2">
                  <p className="text-[12px] text-ink-faint">키 개수</p>
                  <p className="mono mt-0.5 text-[14px] font-bold text-ink">{jsonOut.keys}</p>
                </div>
                <div className="rounded-lg border border-line bg-white px-3 py-2">
                  <p className="text-[12px] text-ink-faint">깊이</p>
                  <p className="mono mt-0.5 text-[14px] font-bold text-ink">{jsonOut.depth}단</p>
                </div>
                <div className="rounded-lg border border-line bg-white px-3 py-2">
                  <p className="text-[12px] text-ink-faint">UTF-8</p>
                  <p className="mono mt-0.5 text-[14px] font-bold text-ink">{jsonOut.bytes.toLocaleString("ko-KR")}B</p>
                </div>
              </div>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              JSON.parse로 검증합니다. 주석(//)·작은따옴표·마지막 쉼표는 JSON 표준이 아니므로 오류로 표시됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3" data-csv-pane>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex overflow-hidden rounded-full border border-line bg-white">
              {(
                [
                  { value: "toMarkdown", label: "CSV → 마크다운 표" },
                  { value: "toCsv", label: "마크다운 표 → CSV" },
                ] as { value: CsvDir; label: string }[]
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={csvDir === o.value}
                  onClick={() => setCsvDir(o.value)}
                  className={
                    "min-h-[40px] px-3.5 text-[12.5px] font-semibold transition-colors " +
                    (csvDir === o.value ? "bg-brand text-white" : "text-ink-soft hover:text-brand")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="text-[12px] font-semibold text-ink-faint">구분자</span>
            {DELIMS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={delim === d.value}
                onClick={() => setDelim(d.value)}
                className={
                  "min-h-[36px] rounded-full px-2.5 text-[12px] font-semibold " +
                  (delim === d.value
                    ? "border border-brand/45 bg-brand-soft text-brand-deep"
                    : "border border-line bg-white text-ink-soft")
                }
              >
                {d.label}
              </button>
            ))}
            {csvDir === "toMarkdown" && (
              <button
                type="button"
                aria-pressed={align === "right"}
                onClick={() => setAlign(align === "right" ? "none" : "right")}
                className={
                  "min-h-[36px] rounded-full px-2.5 text-[12px] font-semibold " +
                  (align === "right"
                    ? "border border-brand/45 bg-brand-soft text-brand-deep"
                    : "border border-line bg-white text-ink-soft")
                }
              >
                숫자 오른쪽 정렬
              </button>
            )}
          </div>

          {csvDir === "toMarkdown" ? (
            <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:gap-5">
              <TextArea
                label="CSV 입력"
                value={csvIn}
                onChange={setCsvIn}
                rows={11}
                mono
                hint={`${csvRows.length}행 · 첫 줄을 표 머리로 씁니다.`}
              />
              <div>
                <div className="flex items-end justify-between gap-2">
                  <p className="field-label">마크다운 표</p>
                  <CopyButton label="마크다운 복사" text={markdown} disabled={!markdown} />
                </div>
                <div className="mt-1.5">
                  <OutputBox text={markdown} maxHeight={200} empty="CSV를 입력하면 표 문법이 나옵니다." />
                </div>
                <p className="mt-3 text-[12px] font-semibold text-ink-faint">붙여넣었을 때 모습</p>
                <div className="mt-1 overflow-auto rounded-xl border border-line bg-white" data-md-preview>
                  {csvRows.length > 0 ? (
                    <table className="w-full min-w-[420px] border-collapse text-left text-[12.5px]">
                      <thead>
                        <tr>
                          {csvRows[0].map((cell, i) => (
                            <th key={i} className="border-b border-line bg-[#f7f8f6] px-2.5 py-2 font-bold text-ink">
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(1).map((r, ri) => (
                          <tr key={ri}>
                            {csvRows[0].map((_, ci) => (
                              <td key={ci} className="border-b border-line-soft px-2.5 py-2 text-ink-soft">
                                {r[ci] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-3 py-3 text-[12.5px] text-ink-faint">표로 만들 행이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:gap-5">
              <TextArea
                label="마크다운 표 입력"
                value={mdIn}
                onChange={setMdIn}
                rows={11}
                mono
                hint="| 로 시작하는 줄만 읽고, --- 구분 줄은 건너뜁니다."
              />
              <div>
                <div className="flex items-end justify-between gap-2">
                  <p className="field-label">CSV 결과</p>
                  <CopyButton label="CSV 복사" text={backToCsv} disabled={!backToCsv} />
                </div>
                <div className="mt-1.5">
                  <OutputBox text={backToCsv} maxHeight={330} empty="표를 붙여넣으면 CSV가 나옵니다." />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                  칸 안에 구분자·따옴표·줄바꿈이 있으면 따옴표로 감싸고, 따옴표는 두 번 써서 이스케이프합니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </UtilShell>
  );
}
