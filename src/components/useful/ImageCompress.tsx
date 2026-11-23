/**
 * 이미지 압축 — 여러 장을 한 번에 다시 인코딩하고 전/후 용량을 나란히 보여 준다.
 * 원본 파일은 건드리지 않고, 결과 Blob만 새로 만든다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  Dropzone,
  Label,
  LocalNote,
  Panel,
  PanelTitle,
  RangeRow,
  Select,
  Stat,
  UtilityShell,
  baseName,
  canvasToBlob,
  downloadBlob,
  formatBytes,
  loadImageFile,
  savedPct,
} from "./kit";
import { Note } from "../tools/ui";
import { ModeTabs, useMode } from "../tools/ModeTabs";
import ImageResize from "./ImageResize";
import Watermark from "./Watermark";
import ExifMosaic from "./ExifMosaic";
import ImageUpscale from "../tools/utils/ImageUpscale";

type OutFormat = "auto" | "jpeg" | "webp" | "png";

type Item = {
  id: string;
  file: File;
  before: number;
  thumb: string;
};

type Result = {
  blob: Blob;
  width: number;
  height: number;
  type: string;
};

const MAX_ITEMS = 12;

function resolveType(file: File, format: OutFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  if (format === "png") return "image/png";
  // auto — PNG의 투명도는 PNG로, 나머지는 JPEG로(사진에서 가장 작다)
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}

async function encode(file: File, format: OutFormat, quality: number, maxDim: number): Promise<Result> {
  const img = await loadImageFile(file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (maxDim > 0 && Math.max(w, h) > maxDim) {
    const s = maxDim / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다");
  const type = resolveType(file, format);
  ctx.imageSmoothingQuality = "high";
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, type, type === "image/png" ? undefined : quality / 100);
  return { blob, width: w, height: h, type };
}

const TYPE_LABEL: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/png": "PNG",
};

function ImageCompressPane({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutFormat>("auto");
  const [quality, setQuality] = useState(72);
  const [maxDim, setMaxDim] = useState("0");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setError("이미지 파일(JPG·PNG·WebP)만 넣을 수 있습니다.");
      return;
    }
    setItems((prev) => {
      const room = MAX_ITEMS - prev.length;
      const next = images.slice(0, Math.max(0, room)).map((file, i) => ({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        before: file.size,
        thumb: "",
      }));
      return [...prev, ...next];
    });
  }, []);

  /** 썸네일 — 목록에서 무거운 원본을 다시 그리지 않도록 작은 data URL로 만든다. */
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const it of items) {
        if (it.thumb) continue;
        try {
          const img = await loadImageFile(it.file);
          const scale = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL("image/jpeg", 0.7);
          if (!alive) return;
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, thumb: url } : p)));
        } catch {
          /* 썸네일 실패는 무시 — 압축은 따로 시도한다 */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [items]);

  /** 설정이 바뀌면 결과를 다시 만든다(250ms 묶어서). */
  useEffect(() => {
    if (!items.length) {
      setResults({});
      return;
    }
    const my = ++token.current;
    setWorking(true);
    const timer = window.setTimeout(async () => {
      const out: Record<string, Result> = {};
      let firstError: string | null = null;
      for (const it of items) {
        try {
          out[it.id] = await encode(it.file, format, quality, Number(maxDim));
        } catch (e) {
          firstError = e instanceof Error ? e.message : "압축하지 못했습니다";
        }
        if (token.current !== my) return;
      }
      if (token.current !== my) return;
      setResults(out);
      setError(firstError);
      setWorking(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [items, format, quality, maxDim]);

  const totalBefore = useMemo(() => items.reduce((n, i) => n + i.before, 0), [items]);
  const totalAfter = useMemo(
    () => items.reduce((n, i) => n + (results[i.id]?.blob.size ?? 0), 0),
    [items, results],
  );
  const ready = items.length > 0 && Object.keys(results).length === items.length;

  const downloadOne = (it: Item) => {
    const r = results[it.id];
    if (!r) return;
    const ext = r.type === "image/webp" ? "webp" : r.type === "image/png" ? "png" : "jpg";
    downloadBlob(r.blob, `${baseName(it.file.name)}-compressed.${ext}`);
  };

  const downloadAll = async () => {
    for (const it of items) {
      downloadOne(it);
      await new Promise((r) => window.setTimeout(r, 350));
    }
  };

  return (
    <UtilityShell
      title="이미지 압축"
      subtitle="여러 장을 한 번에 다시 인코딩하고, 압축 전/후 용량을 나란히 비교합니다."
      steps={["이미지 넣기", "품질·형식 고르기", "결과 내려받기"]}
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <Panel>
            <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">최대 {MAX_ITEMS}장</span>}>
              이미지 넣기
            </PanelTitle>
            <Dropzone
              accept="image/*"
              multiple
              onFiles={addFiles}
              title="이미지를 끌어다 놓거나 눌러서 고르기"
              hint="JPG · PNG · WebP · 여러 장 동시 선택"
              compact={compact}
            />
            {error && <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] text-clay">{error}</p>}
          </Panel>

          <Panel>
            <PanelTitle>압축 설정</PanelTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="ic-format">저장 형식</Label>
                <Select
                  id="ic-format"
                  value={format}
                  onChange={setFormat}
                  ariaLabel="저장 형식"
                  options={[
                    { value: "auto", label: "자동 (사진은 JPG)" },
                    { value: "jpeg", label: "JPG" },
                    { value: "webp", label: "WebP (더 작게)" },
                    { value: "png", label: "PNG (투명도 유지)" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="ic-max">긴 변 최대 크기</Label>
                <Select
                  id="ic-max"
                  value={maxDim}
                  onChange={setMaxDim}
                  ariaLabel="긴 변 최대 크기"
                  options={[
                    { value: "0", label: "원본 크기 유지" },
                    { value: "2560", label: "2560px" },
                    { value: "1920", label: "1920px" },
                    { value: "1280", label: "1280px" },
                    { value: "800", label: "800px" },
                  ]}
                />
              </div>
            </div>
            <RangeRow
              label="품질"
              value={quality}
              onChange={setQuality}
              min={10}
              max={95}
              step={1}
              format={(v) => `${v}%`}
            />
            <p className="text-[11px] leading-relaxed text-ink-faint">
              품질 70~80%가 눈으로 구분되지 않으면서 용량이 크게 줄어드는 구간입니다. PNG는 품질 대신 크기로만
              줄어듭니다(무손실).
            </p>
          </Panel>

          <div className="rounded-xl border border-line bg-white p-3.5">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="원본 합계" value={formatBytes(totalBefore)} />
              <Stat label="압축 후" value={ready ? formatBytes(totalAfter) : "—"} tone="brand" />
              <Stat
                label="절감"
                value={ready ? `${savedPct(totalBefore, totalAfter)}%` : "—"}
                tone="jade"
                sub={ready ? `${formatBytes(Math.max(0, totalBefore - totalAfter))} 감소` : undefined}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn onClick={downloadAll} disabled={!ready || working} full>
                모두 저장
              </Btn>
              <Btn tone="secondary" onClick={() => setItems([])} disabled={!items.length} full>
                목록 비우기
              </Btn>
            </div>
            {working && <p className="mt-2 text-center text-[11px] text-ink-faint">다시 인코딩하는 중…</p>}
          </div>
        </div>

        <div className="space-y-3">
          <Panel className="!p-0">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">결과 목록</p>
              <span className="mono text-[11.5px] text-ink-faint">{items.length}장</span>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12px] leading-relaxed text-ink-faint">
                이미지를 넣으면 장마다 압축 결과가 여기에 쌓입니다.
                <br />
                파일은 이 브라우저 안에서만 다시 인코딩됩니다.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft" data-compress-list>
                {items.map((it) => {
                  const r = results[it.id];
                  const pct = r ? savedPct(it.before, r.blob.size) : 0;
                  return (
                    <li key={it.id} className="flex items-start gap-3 px-4 py-3" data-compress-item>
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-[#f2f4f3]">
                        {it.thumb ? (
                          <img src={it.thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="block h-full w-full animate-pulse bg-line-soft" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-ink">{it.file.name}</p>
                        <p className="mono mt-0.5 text-[11px] text-ink-faint" data-compress-sizes>
                          {formatBytes(it.before)} → {r ? formatBytes(r.blob.size) : "계산 중"}
                          {r && (
                            <span className={pct >= 0 ? "text-jade" : "text-clay"}>
                              {" "}
                              · {pct >= 0 ? `-${pct}%` : `+${Math.abs(pct)}%`}
                            </span>
                          )}
                        </p>
                        {r && (
                          <p className="mono mt-0.5 text-[10.5px] text-ink-faint">
                            {r.width}×{r.height} · {TYPE_LABEL[r.type] ?? r.type}
                          </p>
                        )}
                        {r && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
                              <div
                                className="h-full rounded-full bg-[#2f8f6f]"
                                style={{ width: `${Math.max(2, Math.min(100, Math.max(0, pct)))}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-ink-faint">줄어든 만큼</span>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Btn tone="tiny" onClick={() => downloadOne(it)} disabled={!r}>
                          저장
                        </Btn>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                          className="min-h-[28px] rounded-lg px-2 text-[11px] text-ink-faint hover:text-clay"
                          aria-label={`${it.file.name} 목록에서 빼기`}
                        >
                          빼기
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Note>
            압축은 화면에 보이는 크기 그대로 다시 그린 뒤 새 파일로 저장하는 방식입니다. 원본 파일은 그대로
            두고, 내려받은 파일만 바뀝니다. 사진의 촬영 정보(EXIF)도 이 과정에서 함께 사라집니다.
          </Note>
          <LocalNote />
        </div>
      </div>
    </UtilityShell>
  );
}

/* ------------------------------------------------------------------ v8.8.0 통합
 * 사진 도구 네 가지(리사이즈·업스케일·워터마크·EXIF 모자이크)를 '이미지 정리함' 한 화면으로 모았다.
 * 다섯 탭은 모두 브라우저 안에서만 처리되고(서버 미전송), 파일을 올리지 않는다는 원칙도 같다.
 */
const IMAGE_MODES = ["compress", "resize", "upscale", "watermark", "exif"] as const;
type ImageMode = (typeof IMAGE_MODES)[number];

export default function ImageCompress({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useMode<ImageMode>("compress", IMAGE_MODES);
  return (
    <div data-merged-tool="image-compress">
      <ModeTabs
        label="이미지 정리 작업"
        value={mode}
        onChange={setMode}
        options={[
          { value: "compress", label: "압축" },
          { value: "resize", label: "리사이즈" },
          { value: "upscale", label: "확대" },
          { value: "watermark", label: "워터마크" },
          { value: "exif", label: "EXIF·모자이크" },
        ]}
        note="사진을 올리면 브라우저 안에서만 처리됩니다 — 압축·리사이즈·확대·워터마크·촬영정보 제거를 한 화면에서 오갑니다."
      />
      {mode === "resize" ? (
        <ImageResize compact={compact} embedded />
      ) : mode === "upscale" ? (
        <ImageUpscale compact={compact} embedded />
      ) : mode === "watermark" ? (
        <Watermark compact={compact} embedded />
      ) : mode === "exif" ? (
        <ExifMosaic compact={compact} embedded />
      ) : (
        <ImageCompressPane compact={compact} />
      )}
    </div>
  );
}
