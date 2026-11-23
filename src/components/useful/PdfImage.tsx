/**
 * PDF ↔ 이미지 변환 — 두 방향을 한 화면에서 처리한다.
 *
 *  · 이미지 → PDF: pdf-lib를 그 자리에서 불러와 페이지를 만든다.
 *  · PDF → 이미지: pdfjs-dist로 각 페이지를 캔버스에 그려 PNG로 뽑는다.
 * 두 라이브러리 모두 이 사이트 번들에 들어 있어, 파일이 네트워크로 나가지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import {
  Btn,
  Dropzone,
  EmptyPreview,
  Label,
  LocalNote,
  Panel,
  PanelTitle,
  Select,
  Stat,
  UtilityShell,
  baseName,
  canvasToBlob,
  downloadBlob,
  formatBytes,
  loadImageFile,
  todayStamp,
} from "./kit";
import { Note } from "../tools/ui";
import { ModeTabs, useMode } from "../tools/ModeTabs";
import PdfMergeSplit from "../tools/utils/PdfMergeSplit";

type Tab = "toPdf" | "toImage";
type PageSize = "a4" | "a4-land" | "image";
type Margin = "0" | "10" | "20";

type ImgItem = { id: string; file: File; thumb: string; w: number; h: number };
type PdfPage = { index: number; blob: Blob; url: string; w: number; h: number };

const MM = 2.834645669; // 1mm = 2.8346pt

function PdfImagePane({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<Tab>("toPdf");

  return (
    <UtilityShell
      title="PDF ↔ 이미지 변환"
      subtitle="사진 여러 장을 PDF 한 권으로 묶거나, PDF 페이지를 PNG 이미지로 꺼냅니다."
      steps={["방향 선택", "파일 넣기", "결과 내려받기"]}
    >
      <div className="mb-4 flex gap-1 rounded-full border border-line bg-white p-1" role="tablist" aria-label="변환 방향">
        {(
          [
            { id: "toPdf", label: "이미지 → PDF" },
            { id: "toImage", label: "PDF → 이미지" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={
              "min-h-[40px] flex-1 rounded-full px-3 text-[12.5px] font-semibold transition-colors " +
              (tab === t.id ? "bg-brand text-white" : "text-ink-muted hover:text-brand")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "toPdf" ? <ImagesToPdf compact={compact} /> : <PdfToImages compact={compact} />}
    </UtilityShell>
  );
}

/* ------------------------------------------------------------------ 이미지 → PDF */

function ImagesToPdf({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<ImgItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState<Margin>("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<{ blob: Blob; pages: number } | null>(null);

  const add = async (files: File[]) => {
    setError(null);
    setOut(null);
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setError("이미지 파일만 넣을 수 있습니다.");
      return;
    }
    const next: ImgItem[] = [];
    for (const file of images) {
      try {
        const img = await loadImageFile(file);
        const scale = Math.min(1, 120 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        next.push({
          id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          thumb: c.toDataURL("image/jpeg", 0.7),
          w: img.naturalWidth,
          h: img.naturalHeight,
        });
      } catch {
        setError(`${file.name}을(를) 읽지 못했습니다.`);
      }
    }
    setItems((prev) => [...prev, ...next]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setOut(null);
  };

  const build = async () => {
    if (!items.length) return;
    setBusy(true);
    setError(null);
    setOut(null);
    try {
      const { PDFDocument, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.setProducer("buffetkimz");
      pdf.setCreator("buffetkimz.com — 브라우저에서 만든 PDF");
      const m = Number(margin) * MM;

      for (const it of items) {
        const img = await loadImageFile(it.file);
        // 캔버스를 거쳐 넣는다 — 휴대폰 사진의 회전 정보를 반영하고, EXIF도 함께 지운다.
        const isPng = it.file.type === "image/png";
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 4000 / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("이미지를 그리지 못했습니다");
        if (!isPng) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToBlob(canvas, isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.92);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

        let pw: number;
        let ph: number;
        if (pageSize === "a4") {
          pw = 595.28;
          ph = 841.89;
        } else if (pageSize === "a4-land") {
          pw = 841.89;
          ph = 595.28;
        } else {
          // 이미지 비율 그대로 — 96dpi 기준 픽셀을 pt로 바꾼다
          pw = (img.naturalWidth * 72) / 96 + m * 2;
          ph = (img.naturalHeight * 72) / 96 + m * 2;
        }

        const page = pdf.addPage([pw, ph]);
        const boxW = Math.max(1, pw - m * 2);
        const boxH = Math.max(1, ph - m * 2);
        const k = Math.min(boxW / embedded.width, boxH / embedded.height);
        const w = embedded.width * k;
        const h = embedded.height * k;
        page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgb(1, 1, 1) });
        page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      setOut({ blob, pages: items.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF를 만들지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!out) return;
    const first = items[0] ? baseName(items[0].file.name) : "images";
    downloadBlob(out.blob, `${first}${items.length > 1 ? `-외${items.length - 1}장` : ""}-${todayStamp()}.pdf`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-3">
        <Panel>
          <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">{items.length}장</span>}>
            이미지 넣기 · 순서
          </PanelTitle>
          <Dropzone
            accept="image/*"
            multiple
            onFiles={add}
            title="이미지를 여러 장 끌어다 놓기"
            hint="넣은 순서대로 한 장씩 페이지가 됩니다"
            compact={compact}
          />

          {items.length > 0 && (
            <ol className="mt-3 space-y-1.5" data-pdf-image-list>
              {items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-2 rounded-xl border border-line bg-[#fcfcfa] p-2" data-pdf-image-item>
                  <span className="mono w-5 shrink-0 text-center text-[11px] text-ink-faint">{i + 1}</span>
                  <img src={it.thumb} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{it.file.name}</p>
                    <p className="mono text-[10.5px] text-ink-faint">
                      {it.w}×{it.h} · {formatBytes(it.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconBtn label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </IconBtn>
                    <IconBtn label="아래로" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                      ↓
                    </IconBtn>
                    <IconBtn
                      label="빼기"
                      onClick={() => {
                        setItems((prev) => prev.filter((p) => p.id !== it.id));
                        setOut(null);
                      }}
                    >
                      ✕
                    </IconBtn>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel>
          <PanelTitle>페이지 설정</PanelTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="pp-page">용지</Label>
              <Select
                id="pp-page"
                value={pageSize}
                onChange={(v) => {
                  setPageSize(v as PageSize);
                  setOut(null);
                }}
                ariaLabel="용지 크기"
                options={[
                  { value: "a4", label: "A4 세로" },
                  { value: "a4-land", label: "A4 가로" },
                  { value: "image", label: "이미지 비율 그대로" },
                ]}
              />
            </div>
            <div>
              <Label htmlFor="pp-margin">여백</Label>
              <Select
                id="pp-margin"
                value={margin}
                onChange={(v) => {
                  setMargin(v as Margin);
                  setOut(null);
                }}
                ariaLabel="여백"
                options={[
                  { value: "0", label: "없음" },
                  { value: "10", label: "10mm" },
                  { value: "20", label: "20mm" },
                ]}
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            이미지는 비율을 지켜 페이지 안에 가운데로 들어갑니다. 잘리지 않습니다.
          </p>
        </Panel>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="페이지" value={`${items.length}장`} />
          <Stat label="용지" value={pageSize === "a4" ? "A4" : pageSize === "a4-land" ? "A4 가로" : "원본"} />
          <Stat label="파일 용량" value={out ? formatBytes(out.blob.size) : "—"} tone="brand" />
        </div>

        <Panel>
          <PanelTitle right={<span className="chip !min-h-[24px] !px-2 !text-[11px]">브라우저 생성</span>}>
            PDF 만들기
          </PanelTitle>
          {items.length === 0 ? (
            <EmptyPreview>이미지를 넣으면 순서대로 PDF 페이지가 만들어집니다.</EmptyPreview>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-line bg-[#f6f8f7] p-4">
              <div className="flex items-end gap-1.5">
                {items.slice(0, 6).map((it, i) => (
                  <div key={it.id} className="flex flex-col items-center gap-1">
                    <img
                      src={it.thumb}
                      alt=""
                      className="h-24 w-auto max-w-[70px] rounded border border-line bg-white object-contain shadow-[0_8px_20px_-18px_rgba(11,27,41,0.8)]"
                    />
                    <span className="mono text-[10px] text-ink-faint">{i + 1}</span>
                  </div>
                ))}
                {items.length > 6 && <span className="mono pb-5 text-[11px] text-ink-faint">+{items.length - 6}</span>}
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn onClick={build} disabled={!items.length || busy} full>
              {busy ? "만드는 중…" : "PDF 만들기"}
            </Btn>
            <Btn onClick={download} tone="secondary" disabled={!out} full>
              PDF 저장
            </Btn>
          </div>
          {error && <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] text-clay">{error}</p>}
          {out && (
            <p className="mono mt-2 text-[11px] text-jade">
              완성 · {out.pages}페이지 · {formatBytes(out.blob.size)}
            </p>
          )}
        </Panel>

        <Note>
          스캔한 서류를 보낼 때는 A4 세로·여백 10mm가 가장 무난합니다. 사진을 원본 비율로 모아 두려면
          ‘이미지 비율 그대로’를 고르세요.
        </Note>
        <LocalNote />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ PDF → 이미지 */

function PdfToImages({ compact = false }: { compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [dpi, setDpi] = useState("150");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const token = useRef(0);

  useEffect(() => {
    return () => {
      pages.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    setPages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setProgress(0);
    setPageCount(0);
  };

  const render = async (f: File, dpiValue: string) => {
    const my = ++token.current;
    setBusy(true);
    setError(null);
    clear();
    try {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;

      const data = new Uint8Array(await f.arrayBuffer());
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      const total = doc.numPages;
      setPageCount(total);
      const scale = Number(dpiValue) / 72;
      const limit = Math.min(total, 40);
      const out: PdfPage[] = [];

      for (let i = 1; i <= limit; i += 1) {
        if (token.current !== my) return;
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("캔버스를 만들지 못했습니다");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await canvasToBlob(canvas, "image/png");
        out.push({ index: i, blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height });
        setProgress(i);
        setPages([...out]);
        page.cleanup();
      }
      if (total > limit) setError(`앞 ${limit}페이지만 만들었습니다(전체 ${total}페이지).`);
    } catch (e) {
      setError(e instanceof Error ? `PDF를 읽지 못했습니다 — ${e.message}` : "PDF를 읽지 못했습니다");
    } finally {
      if (token.current === my) setBusy(false);
    }
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.type && f.type !== "application/pdf") {
      setError("PDF 파일만 넣을 수 있습니다.");
      return;
    }
    setFile(f);
    await render(f, dpi);
  };

  const saveOne = (p: PdfPage) => {
    if (!file) return;
    downloadBlob(p.blob, `${baseName(file.name)}-p${String(p.index).padStart(2, "0")}.png`);
  };

  const saveAll = async () => {
    for (const p of pages) {
      saveOne(p);
      await new Promise((r) => window.setTimeout(r, 350));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-3">
        <Panel>
          <PanelTitle right={file ? <span className="mono max-w-[45%] truncate text-[11px] text-ink-faint">{file.name}</span> : undefined}>
            PDF 넣기
          </PanelTitle>
          <Dropzone accept="application/pdf" onFiles={onFiles} title="PDF 끌어다 놓기" hint="한 파일씩 · 최대 40페이지" compact={compact} />
        </Panel>

        <Panel>
          <PanelTitle>해상도</PanelTitle>
          <Select
            value={dpi}
            onChange={(v) => {
              setDpi(v);
              if (file) void render(file, v);
            }}
            ariaLabel="이미지 해상도"
            options={[
              { value: "96", label: "96dpi · 화면용 (가볍게)" },
              { value: "150", label: "150dpi · 일반 (권장)" },
              { value: "216", label: "216dpi · 인쇄 근접" },
              { value: "300", label: "300dpi · 인쇄용 (무겁게)" },
            ]}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            A4 한 장은 150dpi에서 1240×1754px, 300dpi에서 2480×3508px이 됩니다.
          </p>
        </Panel>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="전체 페이지" value={pageCount ? `${pageCount}p` : "—"} />
          <Stat label="만든 페이지" value={`${pages.length}p`} tone="brand" />
          <Stat label="첫 장 용량" value={pages[0] ? formatBytes(pages[0].blob.size) : "—"} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={saveAll} disabled={!pages.length || busy} full>
            전체 PNG 저장
          </Btn>
          <Btn
            tone="secondary"
            full
            disabled={!pages.length || busy}
            onClick={() => {
              clear();
              setFile(null);
            }}
          >
            비우기
          </Btn>
        </div>
        {busy && (
          <p className="text-center text-[11.5px] text-ink-faint">
            페이지를 그리는 중… {progress}/{pageCount || "?"}
          </p>
        )}
        {error && <p className="rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] text-clay">{error}</p>}
        <LocalNote />
      </div>

      <Panel className="!p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="text-[12.5px] font-semibold text-ink">페이지 미리보기</p>
          <span className="mono text-[11.5px] text-ink-faint">PNG</span>
        </div>
        {pages.length === 0 ? (
          <div className="p-4">
            <EmptyPreview>PDF를 넣으면 페이지마다 PNG 결과가 여기에 나옵니다.</EmptyPreview>
          </div>
        ) : (
          <ul className="grid max-h-[560px] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3" data-pdf-pages>
            {pages.map((p) => (
              <li key={p.index} className="rounded-xl border border-line bg-white p-2">
                <img src={p.url} alt={`${p.index}페이지`} className="h-auto w-full rounded-md border border-line-soft bg-white" />
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className="mono text-[10.5px] text-ink-faint">
                    {p.index}p · {formatBytes(p.blob.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => saveOne(p)}
                    className="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted hover:border-brand/45 hover:text-brand"
                  >
                    저장
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-[12px] text-ink-muted transition-colors hover:border-brand/45 hover:text-brand disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ v8.8.0 통합
 * `pdf-merge-split`(PDF 합치기·페이지 추출)를 같은 화면의 두 번째 탭으로 흡수했다.
 * PDF를 다루는 일은 결국 '한 파일로 모으기'와 '쪽으로 꺼내기' 두 방향이라 한 도구로 두었다.
 */
const PDF_MODES = ["convert", "merge"] as const;
type PdfMode = (typeof PDF_MODES)[number];

export default function PdfImage({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useMode<PdfMode>("convert", PDF_MODES);
  return (
    <div data-merged-tool="pdf-image">
      <ModeTabs
        label="PDF 작업"
        value={mode}
        onChange={setMode}
        options={[
          { value: "convert", label: "PDF ↔ 이미지" },
          { value: "merge", label: "합치기·나누기" },
        ]}
        note="PDF는 브라우저 안에서만 열리고 만들어집니다 — 변환과 병합·추출을 한 화면에서 오갑니다."
      />
      {mode === "merge" ? <PdfMergeSplit compact={compact} embedded /> : <PdfImagePane compact={compact} />}
    </div>
  );
}
