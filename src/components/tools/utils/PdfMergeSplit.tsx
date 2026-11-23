import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { PDFDocument } from "pdf-lib";
import { Tabs, UtilShell } from "./UtilShell";

/**
 * PDF 합치기 · 페이지 추출.
 *
 * pdf-lib로 브라우저 안에서만 처리한다 — 파일이 서버로 가지 않는다. 계약서·증권처럼
 * 밖으로 내보내면 안 되는 서류를 다루는 도구라 이 점이 가장 중요하다.
 *
 *  · 병합: 여러 PDF를 올린 순서대로 한 파일로 묶는다(순서 바꾸기·빼기 가능).
 *  · 추출: 한 PDF에서 `1-3, 5`처럼 골라 낸 페이지만 새 파일로 만든다.
 *
 * 암호가 걸린 PDF는 pdf-lib가 열지 못한다. 조용히 빈 파일을 만들지 않고 이유를 적는다.
 */

const MAX_FILE_BYTES = 60 * 1024 * 1024;
const MAX_TOTAL_PAGES = 800;

type MergeItem = {
  id: string;
  name: string;
  size: number;
  pages: number;
  bytes: Uint8Array;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");
const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + "MB" : Math.max(1, Math.round(bytes / 1024)) + "KB";

/** `1-3, 5, 8-` 같은 표기를 페이지 번호 배열로 — 잘못된 표기는 이유를 돌려준다 */
export function parsePageSpec(spec: string, pageCount: number): { pages: number[]; error: string } {
  const text = spec.trim();
  if (!text) return { pages: [], error: "뽑을 페이지를 적어 주세요. 예: 1-3, 5" };
  const picked = new Set<number>();
  for (const tokenRaw of text.split(/[,\s]+/)) {
    const token = tokenRaw.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/);
    if (!m) return { pages: [], error: `'${token}'을(를) 알아볼 수 없습니다. 숫자와 하이픈만 씁니다.` };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1) return { pages: [], error: "페이지 번호는 1부터 시작합니다." };
    if (a > pageCount || b > pageCount) {
      return { pages: [], error: `이 PDF는 ${pageCount}쪽입니다. ${Math.max(a, b)}쪽은 없습니다.` };
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo > 400) return { pages: [], error: "한 번에 400쪽까지만 뽑을 수 있습니다." };
    for (let p = lo; p <= hi; p++) picked.add(p);
  }
  const pages = [...picked].sort((x, y) => x - y);
  if (pages.length === 0) return { pages: [], error: "뽑을 페이지가 없습니다." };
  return { pages, error: "" };
}

/** 짧은 범위 표기로 되돌린다 — `1-3, 5, 8-9` */
export function formatRanges(pages: number[]): string {
  if (pages.length === 0) return "";
  const out: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const cur = pages[i];
    if (cur !== undefined && cur === prev + 1) {
      prev = cur;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return out.join(", ");
}

const loadPdf = async (bytes: Uint8Array) => {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/encrypt|password/i.test(msg)) throw new Error("암호가 걸린 PDF입니다. 암호를 푼 파일로 다시 시도해 주세요.");
    if (/header|parse|trailer|Invalid/i.test(msg)) throw new Error("PDF 구조를 읽지 못했습니다. 손상되었거나 PDF가 아닌 파일일 수 있습니다.");
    throw new Error("PDF를 읽지 못했습니다. 다른 파일로 시도해 주세요.");
  }
};

export default function PdfMergeSplit({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `pdf-image`의 '합치기·나누기' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<"merge" | "split">("merge");

  /* ── 병합 ────────────────────────────────────────────── */
  const [items, setItems] = useState<MergeItem[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [mergeSaved, setMergeSaved] = useState("");
  const [dragging, setDragging] = useState(false);
  const mergeInput = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setMergeError("");
    setMergeSaved("");
    setMergeBusy(true);
    const added: MergeItem[] = [];
    for (const file of list) {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        setMergeError(`'${file.name}'은(는) PDF가 아닙니다.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setMergeError(`'${file.name}'이(가) ${sizeLabel(file.size)}입니다. 60MB 이하 파일만 다룹니다.`);
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await loadPdf(bytes);
        added.push({
          id: `f${seq.current++}`,
          name: file.name,
          size: file.size,
          pages: doc.getPageCount(),
          bytes,
        });
      } catch (e) {
        setMergeError(e instanceof Error ? e.message : "PDF를 읽지 못했습니다.");
      }
    }
    if (added.length > 0) setItems((prev) => [...prev, ...added]);
    setMergeBusy(false);
  }, []);

  const totalPages = useMemo(() => items.reduce((s, i) => s + i.pages, 0), [items]);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setMergeSaved("");
  };

  const removeAt = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setMergeSaved("");
  };

  const merge = async () => {
    if (items.length < 2) {
      setMergeError("PDF를 두 개 이상 올려 주세요.");
      return;
    }
    if (totalPages > MAX_TOTAL_PAGES) {
      setMergeError(`합친 쪽수가 ${fmt(totalPages)}쪽입니다. ${MAX_TOTAL_PAGES}쪽까지만 한 번에 묶습니다. 나눠서 묶어 주세요.`);
      return;
    }
    setMergeError("");
    setMergeBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const item of items) {
        const src = await loadPdf(item.bytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      out.setTitle("buffetkimz 병합 PDF");
      out.setProducer("buffetkimz.com");
      const bytes = await out.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const name = `buffetkimz-merged-${items.length}files-${out.getPageCount()}p.pdf`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setMergeSaved(`${name} · ${sizeLabel(blob.size)} · ${fmt(out.getPageCount())}쪽`);
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "병합하지 못했습니다. 파일을 확인해 주세요.");
    } finally {
      setMergeBusy(false);
    }
  };

  /* ── 추출 ────────────────────────────────────────────── */
  const [splitFile, setSplitFile] = useState<{ name: string; size: number; pages: number; bytes: Uint8Array } | null>(null);
  const [splitSpec, setSplitSpec] = useState("1-3, 5");
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitError, setSplitError] = useState("");
  const [splitSaved, setSplitSaved] = useState("");
  const splitInput = useRef<HTMLInputElement | null>(null);

  const parsedSpec = splitFile ? parsePageSpec(splitSpec, splitFile.pages) : { pages: [], error: "" };

  const readSplit = useCallback(async (file: File) => {
    setSplitError("");
    setSplitSaved("");
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setSplitError("PDF 파일을 올려 주세요.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSplitError(`이 파일은 ${sizeLabel(file.size)}입니다. 60MB 이하 파일만 다룹니다.`);
      return;
    }
    setSplitBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await loadPdf(bytes);
      const pages = doc.getPageCount();
      setSplitFile({ name: file.name, size: file.size, pages, bytes });
      setSplitSpec(pages >= 5 ? `1-3, 5` : pages >= 3 ? `1-2` : `1`);
    } catch (e) {
      setSplitFile(null);
      setSplitError(e instanceof Error ? e.message : "PDF를 읽지 못했습니다.");
    } finally {
      setSplitBusy(false);
    }
  }, []);

  const extract = async () => {
    if (!splitFile) {
      setSplitError("PDF를 먼저 올려 주세요.");
      return;
    }
    if (parsedSpec.error) {
      setSplitError(parsedSpec.error);
      return;
    }
    setSplitError("");
    setSplitBusy(true);
    try {
      const src = await loadPdf(splitFile.bytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(
        src,
        parsedSpec.pages.map((p) => p - 1)
      );
      copied.forEach((p) => out.addPage(p));
      out.setTitle("buffetkimz 추출 PDF");
      out.setProducer("buffetkimz.com");
      const bytes = await out.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const base = splitFile.name.replace(/\.pdf$/i, "").replace(/[^\w가-힣-]+/g, "-").slice(0, 40) || "document";
      const name = `${base}-p${formatRanges(parsedSpec.pages).replace(/[,\s]+/g, "_")}.pdf`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setSplitSaved(`${name} · ${sizeLabel(blob.size)} · ${parsedSpec.pages.length}쪽`);
    } catch (e) {
      setSplitError(e instanceof Error ? e.message : "페이지를 뽑지 못했습니다.");
    } finally {
      setSplitBusy(false);
    }
  };

  const onDropMerge = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">PDF 합치기 · 페이지 추출</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">여러 PDF를 한 파일로, 필요한 페이지만 새 파일로.</p>
        </div>
      )}
      <div className="space-y-3.5">
        <Tabs
          label="PDF 작업"
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: "merge", label: "합치기" },
            { value: "split", label: "페이지 추출" },
          ]}
        />

        {tab === "merge" && (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDropMerge}
              onClick={() => mergeInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") mergeInput.current?.click();
              }}
              data-pdf-merge-drop
              className={
                "cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors " +
                (dragging ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/45")
              }
            >
              <p className="text-[13.5px] font-semibold text-ink">PDF를 끌어 놓거나 눌러서 고르세요 (여러 개 가능)</p>
              <p className="mt-1 text-[12px] text-ink-faint">파일 하나 60MB 이하 · 한 번에 800쪽까지</p>
              <input
                ref={mergeInput}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {items.length > 0 && (
              <>
                <div className="flex items-center justify-between text-[12px] font-semibold text-ink-faint">
                  <span data-pdf-merge-count>
                    {items.length}개 파일 · 합계 {fmt(totalPages)}쪽
                  </span>
                  <span>위에서부터 차례로 묶습니다</span>
                </div>
                <ol data-pdf-merge-list className="space-y-1.5">
                  {items.map((item, i) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2"
                    >
                      <span className="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-brand">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-ink">{item.name}</p>
                        <p className="text-[11.5px] text-ink-faint">
                          {fmt(item.pages)}쪽 · {sizeLabel(item.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`${item.name} 위로`}
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="min-h-[34px] min-w-[34px] rounded-lg border border-line bg-white text-[12px] font-bold text-ink-soft disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.name} 아래로`}
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        className="min-h-[34px] min-w-[34px] rounded-lg border border-line bg-white text-[12px] font-bold text-ink-soft disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.name} 빼기`}
                        onClick={() => removeAt(i)}
                        className="min-h-[34px] min-w-[34px] rounded-lg border border-line bg-white text-[12px] font-bold text-clay"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-pdf-merge-run
                onClick={() => void merge()}
                disabled={mergeBusy || items.length < 2}
                className="min-h-[44px] rounded-xl bg-brand px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
              >
                {mergeBusy ? "묶는 중…" : "한 파일로 묶어 내려받기"}
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setMergeSaved("");
                    setMergeError("");
                  }}
                  className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
                >
                  목록 비우기
                </button>
              )}
            </div>

            {mergeError && (
              <p data-pdf-error className="rounded-xl border border-clay/40 bg-[#fbf3ef] px-3 py-2.5 text-[12.5px] leading-relaxed text-clay">
                {mergeError}
              </p>
            )}
            {mergeSaved && (
              <p data-pdf-saved className="rounded-xl border border-jade/40 bg-jade-soft/50 px-3 py-2.5 text-[12.5px] font-semibold text-jade">
                저장을 시작했습니다 — {mergeSaved}
              </p>
            )}
          </div>
        )}

        {tab === "split" && (
          <div className="space-y-3">
            <div
              onClick={() => splitInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") splitInput.current?.click();
              }}
              data-pdf-split-drop
              className="cursor-pointer rounded-xl border-2 border-dashed border-line bg-white px-4 py-6 text-center transition-colors hover:border-brand/45"
            >
              <p className="text-[13.5px] font-semibold text-ink">
                {splitFile ? "다른 PDF로 바꾸려면 누르세요" : "PDF를 눌러서 고르세요"}
              </p>
              <p className="mt-1 text-[12px] text-ink-faint">파일 하나 60MB 이하</p>
              <input
                ref={splitInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readSplit(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {splitFile && (
              <>
                <div data-pdf-split-source className="rounded-xl border border-line bg-white px-3.5 py-3">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{splitFile.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    전체 <strong className="font-semibold tabular-nums text-ink">{fmt(splitFile.pages)}쪽</strong> ·{" "}
                    {sizeLabel(splitFile.size)}
                  </p>
                </div>

                <div>
                  <label htmlFor="pdf-split-spec" className="field-label">
                    뽑을 페이지
                  </label>
                  <input
                    id="pdf-split-spec"
                    data-pdf-split-spec
                    value={splitSpec}
                    onChange={(e) => {
                      setSplitSpec(e.target.value);
                      setSplitSaved("");
                    }}
                    spellCheck={false}
                    placeholder="예: 1-3, 5"
                    className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 font-mono text-[13px] text-ink outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                  />
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                    쉼표로 나누고 범위는 하이픈으로 씁니다. 뽑은 페이지는 원래 순서대로 새 파일에 들어갑니다.
                  </p>
                </div>

                {parsedSpec.error ? (
                  <p data-pdf-spec-error className="text-[12px] font-semibold text-clay">
                    {parsedSpec.error}
                  </p>
                ) : (
                  <p data-pdf-spec-ok className="text-[12px] font-semibold text-brand">
                    {parsedSpec.pages.length}쪽 추출 예정 — {formatRanges(parsedSpec.pages)}
                  </p>
                )}

                <button
                  type="button"
                  data-pdf-split-run
                  onClick={() => void extract()}
                  disabled={splitBusy || Boolean(parsedSpec.error)}
                  className="min-h-[44px] rounded-xl bg-brand px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
                >
                  {splitBusy ? "뽑는 중…" : "고른 페이지만 내려받기"}
                </button>
              </>
            )}

            {splitError && (
              <p data-pdf-error className="rounded-xl border border-clay/40 bg-[#fbf3ef] px-3 py-2.5 text-[12.5px] leading-relaxed text-clay">
                {splitError}
              </p>
            )}
            {splitSaved && (
              <p data-pdf-saved className="rounded-xl border border-jade/40 bg-jade-soft/50 px-3 py-2.5 text-[12.5px] font-semibold text-jade">
                저장을 시작했습니다 — {splitSaved}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return <div data-util="pdf-merge-split">{content}</div>;

  return (
    <UtilShell
      id="pdf-merge-split"
      title="PDF 합치기 · 페이지 추출"
      subtitle="여러 PDF를 한 파일로, 필요한 페이지만 새 파일로"
      note={
        <>
          PDF는 <strong className="font-semibold text-ink">이 브라우저 안에서만</strong> 열리고 합쳐집니다. 서버로
          올리지 않고, 만든 파일도 기기에 바로 저장됩니다. 암호가 걸린 PDF는 열 수 없습니다.
        </>
      }
    >
      {content}
    </UtilShell>
  );
}
