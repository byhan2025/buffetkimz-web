/**
 * SNS 비율 리사이즈 — 프리셋 비율로 크롭하거나 여백을 채워 규격에 맞춘다.
 * 결과는 캔버스에서 바로 만들고 미리보기와 같은 픽셀을 내려받는다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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

type Fit = "crop" | "pad";
type Focus = "top" | "center" | "bottom";

type Preset = { id: string; label: string; w: number; h: number; note: string };

const PRESETS: Preset[] = [
  { id: "insta-45", label: "인스타 4:5", w: 1080, h: 1350, note: "피드 세로 · 1080×1350" },
  { id: "square", label: "정사각 1:1", w: 1080, h: 1080, note: "피드 정사각 · 1080×1080" },
  { id: "story", label: "스토리·릴스 9:16", w: 1080, h: 1920, note: "스토리·릴스 · 1080×1920" },
  { id: "youtube", label: "유튜브 16:9", w: 1280, h: 720, note: "썸네일 · 1280×720" },
  { id: "blog", label: "블로그 1.91:1", w: 1200, h: 630, note: "공유 카드 · 1200×630" },
  { id: "profile", label: "프로필 1:1", w: 800, h: 800, note: "프로필 사진 · 800×800" },
];

export default function ImageResize({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `image-compress`의 '리사이즈' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [presetId, setPresetId] = useState("insta-45");
  const [fit, setFit] = useState<Fit>("crop");
  const [focus, setFocus] = useState<Focus>("center");
  const [padColor, setPadColor] = useState("#ffffff");
  const [quality, setQuality] = useState(90);
  const [outType, setOutType] = useState("image/jpeg");
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId) ?? PRESETS[0], [presetId]);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    try {
      const image = await loadImageFile(f);
      setFile(f);
      setImg(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 읽지 못했습니다");
    }
  };

  /** 캔버스에 그리는 계산 — 크롭은 꽉 채우고, 여백은 비율을 지켜 가운데 놓는다. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!img) {
      canvas.width = 0;
      canvas.height = 0;
      setResult(null);
      return;
    }
    const W = preset.w;
    const H = preset.h;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";

    if (fit === "crop") {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const sw = W / scale;
      const sh = H / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = focus === "top" ? 0 : focus === "bottom" ? img.naturalHeight - sh : (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      ctx.fillStyle = padColor;
      ctx.fillRect(0, 0, W, H);
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    let cancelled = false;
    canvasToBlob(canvas, outType, outType === "image/png" ? undefined : quality / 100)
      .then((blob) => {
        if (cancelled) return;
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch(() => setError("결과 이미지를 만들지 못했습니다"));
    return () => {
      cancelled = true;
    };
  }, [img, preset, fit, focus, padColor, quality, outType]);

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    if (!result || !file) return;
    const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
    downloadBlob(result.blob, `${baseName(file.name)}-${preset.w}x${preset.h}.${ext}`);
  };

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">SNS 비율 리사이즈</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">채널 규격을 고르면 크롭 또는 여백으로 맞춘 파일을 만듭니다.</p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <Panel>
            <PanelTitle right={file ? <span className="mono max-w-[45%] truncate text-[11px] text-ink-faint">{file.name}</span> : undefined}>
              이미지
            </PanelTitle>
            <Dropzone accept="image/*" onFiles={onFiles} title="이미지 한 장 넣기" hint="JPG · PNG · WebP" compact />
            {img && (
              <p className="mono mt-2 text-[11px] text-ink-faint">
                원본 {img.naturalWidth}×{img.naturalHeight}px · {formatBytes(file?.size ?? 0)}
              </p>
            )}
            {error && <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] text-clay">{error}</p>}
          </Panel>

          <Panel>
            <PanelTitle>규격</PanelTitle>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === presetId}
                  data-preset={p.id}
                  onClick={() => setPresetId(p.id)}
                  className={
                    "rounded-xl border px-2 py-2 text-left transition-colors " +
                    (p.id === presetId
                      ? "border-brand bg-brand-soft/70 text-brand-deep"
                      : "border-line bg-white text-ink-soft hover:border-brand/40")
                  }
                >
                  <span className="block text-[12px] font-semibold leading-snug">{p.label}</span>
                  <span className="mono mt-0.5 block text-[10px] leading-snug text-ink-faint">{p.note}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="ir-fit">맞춤 방식</Label>
                <Select
                  id="ir-fit"
                  value={fit}
                  onChange={(v) => setFit(v as Fit)}
                  ariaLabel="맞춤 방식"
                  options={[
                    { value: "crop", label: "크롭 (꽉 채우기)" },
                    { value: "pad", label: "여백 (전체 담기)" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="ir-focus">크롭 기준점</Label>
                <Select
                  id="ir-focus"
                  value={focus}
                  onChange={(v) => setFocus(v as Focus)}
                  ariaLabel="크롭 기준점"
                  options={[
                    { value: "center", label: "가운데" },
                    { value: "top", label: "위쪽" },
                    { value: "bottom", label: "아래쪽" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="ir-type">저장 형식</Label>
                <Select
                  id="ir-type"
                  value={outType}
                  onChange={setOutType}
                  ariaLabel="저장 형식"
                  options={[
                    { value: "image/jpeg", label: "JPG" },
                    { value: "image/png", label: "PNG" },
                    { value: "image/webp", label: "WebP" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="ir-pad">여백 색</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="ir-pad"
                    type="color"
                    value={padColor}
                    onChange={(e) => setPadColor(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-white p-1"
                  />
                  <span className="text-[11px] text-ink-faint">여백 방식에서만 쓰입니다</span>
                </div>
              </div>
            </div>

            <RangeRow label="JPG·WebP 품질" value={quality} onChange={setQuality} min={40} max={100} format={(v) => `${v}%`} />
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">{preset.w}×{preset.h}</span>}>
              미리보기
            </PanelTitle>

            {img ? (
              <div className="rounded-xl border border-line bg-[#f6f8f7] p-3">
                <div className="mx-auto" style={{ maxWidth: preset.w >= preset.h ? "100%" : `${Math.round((preset.w / preset.h) * 100)}%` }}>
                  <canvas ref={canvasRef} className="h-auto w-full rounded-lg bg-white shadow-[0_12px_30px_-26px_rgba(11,27,41,0.8)]" data-resize-canvas />
                </div>
              </div>
            ) : (
              <EmptyPreview>이미지를 넣으면 선택한 규격으로 잘린 결과가 바로 보입니다.</EmptyPreview>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="결과 크기" value={`${preset.w}×${preset.h}`} />
              <Stat label="파일 용량" value={result ? formatBytes(result.blob.size) : "—"} tone="brand" />
              <Stat label="비율" value={`${(preset.w / preset.h).toFixed(2)}:1`} tone="jade" />
            </div>

            <Btn onClick={download} disabled={!result} full>
              {preset.label} 파일 저장
            </Btn>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              원본 비율이 규격과 다르면 크롭은 잘라내고, 여백은 빈 곳을 색으로 채웁니다. 미리보기와 내려받는
              이미지는 같은 픽셀입니다.
            </p>
          </Panel>

          <Note>
            인스타그램 4:5는 세로 피드에서 가장 크게 보이는 비율이고, 9:16은 스토리·릴스 전용입니다. 같은
            사진을 두 규격에 함께 올릴 때는 4:5를 먼저 만든 뒤 9:16은 여백 방식으로 만드는 편이 잘리지
            않습니다.
          </Note>
          <LocalNote />
        </div>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <UtilityShell
      title="SNS 비율 리사이즈"
      subtitle="채널 규격을 고르면 크롭 또는 여백으로 맞춘 파일을 바로 만듭니다."
      steps={["이미지 넣기", "규격·맞춤 방식 고르기", "내려받기"]}
    >
      {content}
    </UtilityShell>
  );
}
