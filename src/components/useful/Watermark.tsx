/**
 * 워터마크 넣기 — 텍스트를 원본 해상도에 그대로 얹는다.
 * 미리보기는 같은 캔버스를 줄여 보여 주므로, 내려받는 파일과 위치·크기가 일치한다.
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

type Position = "center" | "tl" | "tr" | "bl" | "br" | "tile";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "center", label: "가운데" },
  { value: "tl", label: "왼쪽 위" },
  { value: "tr", label: "오른쪽 위" },
  { value: "bl", label: "왼쪽 아래" },
  { value: "br", label: "오른쪽 아래" },
  { value: "tile", label: "타일 반복" },
];

const SWATCHES = ["#ffffff", "#0b1b29", "#146c58", "#a85a3b", "#f2d98d"];

export default function Watermark({ compact = false }: { compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [text, setText] = useState("buffetkimz");
  const [sizePct, setSizePct] = useState(6);
  const [opacity, setOpacity] = useState(55);
  const [color, setColor] = useState("#ffffff");
  const [position, setPosition] = useState<Position>("center");
  const [weight, setWeight] = useState("700");
  const [shadow, setShadow] = useState(true);
  const [rotate, setRotate] = useState(-28);
  const [outType, setOutType] = useState("image/jpeg");
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!img) {
      canvas.width = 0;
      canvas.height = 0;
      setResult(null);
      return;
    }
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);

    const label = text.trim();
    if (!label) {
      setResult(null);
      return;
    }

    const fontPx = Math.max(10, Math.round((W * sizePct) / 100));
    const margin = Math.round(W * 0.035);
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${fontPx}px "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    if (shadow) {
      ctx.shadowColor = "rgba(11, 27, 41, 0.55)";
      ctx.shadowBlur = Math.round(fontPx * 0.22);
      ctx.shadowOffsetY = Math.round(fontPx * 0.04);
    }

    if (position === "tile") {
      ctx.translate(W / 2, H / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      const tw = ctx.measureText(label).width;
      const gapX = Math.max(tw * 0.45, fontPx * 1.2);
      const stepX = tw + gapX;
      const stepY = fontPx * 3.4;
      const diag = Math.hypot(W, H);
      for (let y = -diag / 2; y <= diag / 2; y += stepY) {
        for (let x = -diag / 2; x <= diag / 2; x += stepX) {
          ctx.fillText(label, x, y);
        }
      }
    } else {
      let x = W / 2;
      let y = H / 2;
      if (position === "tl" || position === "tr") y = margin + fontPx / 2;
      if (position === "bl" || position === "br") y = H - margin - fontPx / 2;
      if (position === "tl" || position === "bl") {
        x = margin;
        ctx.textAlign = "left";
      }
      if (position === "tr" || position === "br") {
        x = W - margin;
        ctx.textAlign = "right";
      }
      ctx.fillText(label, x, y);
    }
    ctx.restore();

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
  }, [img, text, sizePct, opacity, color, position, weight, shadow, rotate, outType, quality]);

  const download = () => {
    if (!result || !file) return;
    const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
    downloadBlob(result.blob, `${baseName(file.name)}-watermark.${ext}`);
  };

  return (
    <UtilityShell
      title="워터마크 넣기"
      subtitle="사진에 문구를 얹어 내 사진임을 남깁니다. 미리보기 그대로 저장됩니다."
      steps={["이미지 넣기", "문구·위치·투명도 조정", "내려받기"]}
    >
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
            <PanelTitle>문구</PanelTitle>
            <Label htmlFor="wm-text">워터마크 텍스트</Label>
            <input
              id="wm-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={40}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink focus:border-brand/60 focus:outline-none"
              placeholder="buffetkimz"
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="wm-pos">위치</Label>
                <Select id="wm-pos" value={position} onChange={setPosition} ariaLabel="워터마크 위치" options={POSITIONS} />
              </div>
              <div>
                <Label htmlFor="wm-weight">굵기</Label>
                <Select
                  id="wm-weight"
                  value={weight}
                  onChange={setWeight}
                  ariaLabel="글자 굵기"
                  options={[
                    { value: "400", label: "보통" },
                    { value: "600", label: "조금 굵게" },
                    { value: "700", label: "굵게" },
                    { value: "900", label: "아주 굵게" },
                  ]}
                />
              </div>
            </div>

            <RangeRow label="글자 크기" value={sizePct} onChange={setSizePct} min={2} max={20} format={(v) => `${v}%`} />
            <RangeRow label="투명도" value={opacity} onChange={setOpacity} min={8} max={100} format={(v) => `${v}%`} />
            {position === "tile" && (
              <RangeRow label="타일 기울기" value={rotate} onChange={setRotate} min={-60} max={60} format={(v) => `${v}°`} />
            )}

            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="wm-color">색</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="wm-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-white p-1"
                  />
                  <div className="flex flex-wrap gap-1">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`색 ${c}`}
                        onClick={() => setColor(c)}
                        className="h-6 w-6 rounded-full border border-line"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="wm-type">저장 형식</Label>
                <Select
                  id="wm-type"
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
            </div>

            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-soft">
              <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} className="h-4 w-4 accent-[#146c58]" />
              밝은 사진에서도 읽히게 그림자 넣기
            </label>

            {outType !== "image/png" && (
              <RangeRow label="JPG·WebP 품질" value={quality} onChange={setQuality} min={50} max={100} format={(v) => `${v}%`} />
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelTitle right={<span className="chip !min-h-[24px] !px-2 !text-[11px]">원본 해상도</span>}>미리보기</PanelTitle>
            {img ? (
              <div className="rounded-xl border border-line bg-[#f6f8f7] p-3">
                <canvas ref={canvasRef} className="h-auto w-full rounded-lg bg-white" data-watermark-canvas />
              </div>
            ) : (
              <EmptyPreview>이미지를 넣으면 문구가 얹힌 결과가 보입니다. 위치와 투명도는 바로 바뀝니다.</EmptyPreview>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="출력 크기" value={img ? `${img.naturalWidth}×${img.naturalHeight}` : "—"} />
              <Stat label="글자 크기" value={img ? `${Math.round((img.naturalWidth * sizePct) / 100)}px` : "—"} tone="brand" />
              <Stat label="파일 용량" value={result ? formatBytes(result.blob.size) : "—"} tone="jade" />
            </div>

            <Btn onClick={download} disabled={!result} full>
              워터마크 이미지 저장
            </Btn>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              글자 크기는 원본 가로 폭의 {sizePct}%입니다. 카드뉴스처럼 작게 줄여 쓰는 사진은 3~5%, 원본을
              크게 보여 줄 사진은 5~8%가 읽기 좋습니다.
            </p>
          </Panel>

          <Note>
            타일 반복은 사진을 캡처해 쓰는 것을 가장 확실히 막는 방식이지만 사진을 가립니다. 카드뉴스처럼
            배포용은 모서리 한 곳(오른쪽 아래)에 작게 넣는 편이 보기 좋습니다.
          </Note>
          <LocalNote />
        </div>
      </div>
    </UtilityShell>
  );
}
