/**
 * EXIF 제거 · 모자이크 — 사진에 남은 촬영 정보를 확인하고, 지울 곳은 직접 칠한다.
 *
 * ① 올린 파일에서 EXIF를 읽어 표로 보여 준다(읽기만 한다).
 * ② 캔버스에 다시 그려 저장하므로 GPS·기기 정보는 결과 파일에 남지 않는다.
 * ③ 드래그한 영역을 모자이크/블러로 덮는다 — 좌표는 비율로 기억해 원본 해상도에 그대로 적용한다.
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
  RangeRow,
  Select,
  Stat,
  UtilityShell,
  baseName,
  canvasToBlob,
  downloadBlob,
  formatBytes,
  loadImageFile,
} from "./kit";
import { Note } from "../tools/ui";

type Mode = "mosaic" | "blur";
type Region = { x: number; y: number; w: number; h: number; size: number; mode: Mode };
type Draft = { x: number; y: number; w: number; h: number };
type MetaRow = { label: string; value: string };

const PREVIEW_MAX = 1500;

const LABELS: Record<string, string> = {
  Make: "제조사",
  Model: "기종",
  LensMake: "렌즈 제조사",
  LensModel: "렌즈",
  DateTimeOriginal: "촬영 시각",
  CreateDate: "파일 생성",
  ModifyDate: "수정 시각",
  ExposureTime: "셔터 속도",
  FNumber: "조리개",
  ISO: "ISO",
  ISOSpeedRatings: "ISO",
  FocalLength: "초점 거리",
  FocalLengthIn35mmFormat: "35mm 환산",
  ExposureProgram: "노출 모드",
  Flash: "플래시",
  WhiteBalance: "화이트밸런스",
  Orientation: "방향",
  Software: "편집 프로그램",
  Artist: "작성자",
  Copyright: "저작권",
  GPSLatitude: "GPS 위도",
  GPSLongitude: "GPS 경도",
  GPSAltitude: "GPS 고도",
  GPSDateStamp: "GPS 시각",
};

const ORDER = [
  "Make",
  "Model",
  "LensModel",
  "DateTimeOriginal",
  "CreateDate",
  "ExposureTime",
  "FNumber",
  "ISO",
  "ISOSpeedRatings",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "Orientation",
  "Software",
  "Artist",
  "Copyright",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "GPSDateStamp",
];

function fmtValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}. ${p(v.getMonth() + 1)}. ${p(v.getDate())}. ${p(v.getHours())}:${p(v.getMinutes())}`;
  }
  if (Array.isArray(v)) return v.map((x) => fmtValue(x)).join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
  return String(v);
}

/** 캔버스 위 한 영역을 덮는다. 좌표는 캔버스 픽셀. */
function applyRegion(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, r: Region) {
  const W = canvas.width;
  const x = Math.round(r.x * W);
  const y = Math.round(r.y * canvas.height);
  const w = Math.round(r.w * W);
  const h = Math.round(r.h * canvas.height);
  if (w < 2 || h < 2) return;

  if (r.mode === "mosaic") {
    const block = Math.max(3, Math.round((r.size / 100) * W));
    const tw = Math.max(1, Math.round(w / block));
    const th = Math.max(1, Math.round(h / block));
    const tmp = document.createElement("canvas");
    tmp.width = tw;
    tmp.height = th;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(canvas, x, y, w, h, 0, 0, tw, th);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
    ctx.restore();
  } else {
    const radius = Math.max(1, (r.size / 100) * W);
    const pad = Math.ceil(radius * 2);
    const tmp = document.createElement("canvas");
    tmp.width = w + pad * 2;
    tmp.height = h + pad * 2;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.filter = `blur(${radius}px)`;
    // 가장자리가 투명해지지 않도록 영역 바깥까지 함께 그린다.
    tctx.drawImage(canvas, -(x - pad), -(y - pad));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(tmp, x - pad, y - pad);
    ctx.restore();
  }
}

export default function ExifMosaic({ compact = false }: { compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [meta, setMeta] = useState<MetaRow[] | null>(null);
  const [metaCount, setMetaCount] = useState(0);
  const [hasGps, setHasGps] = useState(false);
  const [mode, setMode] = useState<Mode>("mosaic");
  const [size, setSize] = useState(6);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [outType, setOutType] = useState("image/jpeg");
  const [quality, setQuality] = useState(92);
  const [error, setError] = useState<string | null>(null);
  const [outInfo, setOutInfo] = useState<{ size: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setMeta(null);
    setMetaCount(0);
    setHasGps(false);
    setRegions([]);
    setOutInfo(null);
    try {
      const image = await loadImageFile(f);
      setFile(f);
      setImg(image);

      // exifr은 필요할 때만 불러온다(첫 화면 번들을 가볍게).
      const mod = await import("exifr");
      const exifr = (mod.default ?? mod) as { parse: (input: Blob, opts?: Record<string, unknown>) => Promise<Record<string, unknown> | undefined> };
      let tags: Record<string, unknown> | undefined;
      try {
        tags = await exifr.parse(f, { tiff: true, exif: true, gps: true, ifd0: true, reviveValues: true });
      } catch {
        tags = undefined;
      }
      if (!tags) {
        setMeta([]);
        return;
      }
      const keys = Object.keys(tags);
      setMetaCount(keys.length);
      // exifr은 좌표를 숫자나 도·분·초 배열로 준다 — 어느 쪽이든 '있음'으로 본다.
      const lat = tags.GPSLatitude;
      const lon = tags.GPSLongitude;
      setHasGps(lat != null && lat !== "" && lon != null && lon !== "");

      const rows: MetaRow[] = [];
      for (const key of ORDER) {
        const v = tags[key];
        if (v == null || v === "") continue;
        if (rows.some((r) => r.label === (LABELS[key] ?? key))) continue;
        rows.push({ label: LABELS[key] ?? key, value: fmtValue(v) });
      }
      setMeta(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 읽지 못했습니다");
    }
  };

  /* 미리보기 — 원본을 최대 1500px로 줄여 그리고, 같은 방식으로 영역을 덮는다. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!img) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    const scale = Math.min(1, PREVIEW_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const r of regions) applyRegion(ctx, canvas, r);
    if (draft) {
      ctx.save();
      ctx.strokeStyle = "#146c58";
      ctx.lineWidth = Math.max(1.5, canvas.width / 500);
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(draft.x * canvas.width, draft.y * canvas.height, draft.w * canvas.width, draft.h * canvas.height);
      ctx.restore();
    }
  }, [img, regions, draft]);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointOf(e);
    dragStart.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const p = pointOf(e);
    setDraft({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = () => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || !draft) {
      setDraft(null);
      return;
    }
    if (draft.w > 0.012 && draft.h > 0.012) {
      setRegions((prev) => [...prev, { ...draft, size, mode }]);
      setOutInfo(null);
    }
    setDraft(null);
  };

  const exportImage = async (): Promise<{ blob: Blob; w: number; h: number } | null> => {
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    for (const r of regions) applyRegion(ctx, canvas, r);
    const blob = await canvasToBlob(canvas, outType, outType === "image/png" ? undefined : quality / 100);
    return { blob, w: canvas.width, h: canvas.height };
  };

  const download = async () => {
    const out = await exportImage();
    if (!out || !file) return;
    setOutInfo({ size: out.blob.size, w: out.w, h: out.h });
    const ext = outType === "image/png" ? "png" : "jpg";
    downloadBlob(out.blob, `${baseName(file.name)}-clean.${ext}`);
  };

  const gpsLine = meta?.find((m) => m.label === "GPS 위도");
  const gpsLine2 = meta?.find((m) => m.label === "GPS 경도");

  return (
    <UtilityShell
      title="EXIF 제거 · 모자이크"
      subtitle="사진에 남은 촬영 정보를 확인하고, 가릴 곳은 끌어서 칠한 뒤 깨끗한 파일로 저장합니다."
      steps={["이미지 넣기", "가릴 곳 드래그", "저장 (EXIF 제거)"]}
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <Panel>
            <PanelTitle
              right={
                file ? <span className="mono max-w-[50%] truncate text-[11px] text-ink-faint">{file.name}</span> : undefined
              }
            >
              이미지 · 가릴 곳 칠하기
            </PanelTitle>
            {!img ? (
              <Dropzone
                accept="image/*"
                onFiles={onFiles}
                title="이미지를 끌어다 놓거나 눌러서 고르기"
                hint="JPG · PNG · WebP · HEIC는 브라우저에 따라 열리지 않을 수 있습니다"
                compact={compact}
              />
            ) : (
              <>
                <div className="rounded-xl border border-line bg-[#f6f8f7] p-2">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    style={{ touchAction: "none", cursor: "crosshair" }}
                    className="mx-auto h-auto max-w-full rounded-lg bg-white"
                    data-exif-canvas
                    aria-label="모자이크할 영역을 드래그해 선택하는 미리보기"
                  />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
                  사진 위를 마우스나 손가락으로 끌면 그 영역이 {mode === "mosaic" ? "모자이크" : "블러"}로 덮입니다.
                  지금까지 <b className="text-ink">{regions.length}곳</b>을 덮었습니다.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <SegMini
                    options={[
                      { value: "mosaic", label: "모자이크" },
                      { value: "blur", label: "블러" },
                    ]}
                    value={mode}
                    onChange={(v) => setMode(v as Mode)}
                  />
                  <Btn tone="secondary" small onClick={() => setRegions((prev) => prev.slice(0, -1))} disabled={!regions.length}>
                    마지막 지우기
                  </Btn>
                  <Btn tone="secondary" small onClick={() => setRegions([])} disabled={!regions.length}>
                    모두 지우기
                  </Btn>
                  <label className="ml-auto cursor-pointer rounded-lg border border-line px-2 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:border-brand/45 hover:text-brand">
                    다른 이미지
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) void onFiles(files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <RangeRow
                  label={mode === "mosaic" ? "모자이크 강도" : "블러 강도"}
                  value={size}
                  onChange={setSize}
                  min={1}
                  max={20}
                  format={(v) => `${v}%`}
                />
              </>
            )}
            {error && <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] text-clay">{error}</p>}
          </Panel>

          <Panel>
            <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">{outType === "image/png" ? "PNG · 무손실" : `JPG · 품질 ${quality}%`}</span>}>
              저장
            </PanelTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="em-type">저장 형식</Label>
                <Select
                  id="em-type"
                  value={outType}
                  onChange={setOutType}
                  ariaLabel="저장 형식"
                  options={[
                    { value: "image/jpeg", label: "JPG (작게)" },
                    { value: "image/png", label: "PNG (무손실)" },
                  ]}
                />
              </div>
              <div className="flex items-end">
                <Btn onClick={download} disabled={!img} full>
                  EXIF 지운 이미지 저장
                </Btn>
              </div>
            </div>
            {outType !== "image/png" && (
              <RangeRow label="JPG 품질" value={quality} onChange={setQuality} min={50} max={100} format={(v) => `${v}%`} />
            )}
            <p className="text-[11px] leading-relaxed text-ink-faint">
              저장할 때 캔버스에 다시 그려 새 파일로 만듭니다. 촬영 기기·시각·GPS·편집 프로그램 정보는 결과
              파일에 남지 않습니다(사진 픽셀만 남습니다).
            </p>
            {outInfo && (
              <p className="mono mt-1 text-[11px] text-jade">
                방금 저장 · {outInfo.w}×{outInfo.h}px · {formatBytes(outInfo.size)}
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="메타데이터" value={meta ? `${metaCount}개` : "—"} />
            <Stat label="GPS" value={meta === null ? "—" : hasGps ? "있음" : "없음"} tone={hasGps ? "clay" : "jade"} />
            <Stat label="가린 곳" value={`${regions.length}곳`} tone="brand" />
          </div>

          <Panel className="!p-0">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">사진에 남은 촬영 정보</p>
              {hasGps && (
                <span className="rounded-full bg-[#fbeee8] px-2 py-[2px] text-[10.5px] font-bold text-clay">
                  위치 포함
                </span>
              )}
            </div>

            {meta === null ? (
              <p className="px-4 py-8 text-center text-[12px] leading-relaxed text-ink-faint">
                이미지를 넣으면 이 사진에 남은 촬영 정보가 여기 표로 나옵니다.
              </p>
            ) : meta.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] leading-relaxed text-ink-muted">
                이 파일에는 읽을 수 있는 EXIF 메타데이터가 없습니다.
                <br />
                <span className="text-ink-faint">
                  {file?.type === "image/png" ? "PNG는 대개 촬영 정보를 담지 않습니다." : "이미 한 번 정리된 사진일 수 있습니다."}
                </span>
              </p>
            ) : (
              <dl className="max-h-[430px] divide-y divide-line-soft overflow-y-auto" data-exif-table>
                {meta.map((m) => (
                  <div key={m.label} className="flex items-start gap-3 px-4 py-2">
                    <dt className="w-[86px] shrink-0 text-[11.5px] font-semibold text-ink-faint">{m.label}</dt>
                    <dd className="mono min-w-0 flex-1 break-all text-[11.5px] leading-[1.6] text-ink">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          {hasGps && gpsLine && gpsLine2 && (
            <div className="rounded-xl border border-clay/30 bg-[#fdf4f0] px-3.5 py-3">
              <p className="text-[12px] font-semibold text-clay">이 사진에는 촬영 위치가 남아 있습니다</p>
              <p className="mono mt-1 break-all text-[11.5px] leading-relaxed text-ink-soft">
                {gpsLine.value}, {gpsLine2.value}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
                이 화면에서 저장하면 좌표가 사라집니다. 원본 파일을 그대로 올리면 위치가 함께 공개될 수 있습니다.
              </p>
            </div>
          )}

          <Note>
            모자이크는 픽셀을 뭉개는 방식이라 아주 작은 영역(차량 번호판 한 줄)은 남길 수 있습니다. 이름·번호판은
            영역을 조금 넉넉히 잡고 강도를 8% 이상으로 두는 편이 안전합니다.
          </Note>
          <LocalNote>사진과 촬영 정보는 브라우저 안에서만 읽고, 어디로도 전송하지 않습니다.</LocalNote>
        </div>
      </div>
    </UtilityShell>
  );
}

/** 두 개짜리 작은 선택 버튼 — 실행 화면 안에서만 쓰는 최소 단위. */
function SegMini({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={
            "min-h-[30px] rounded-full px-2.5 text-[11.5px] font-semibold transition-colors " +
            (o.value === value ? "bg-brand text-white" : "text-ink-muted hover:text-brand")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
