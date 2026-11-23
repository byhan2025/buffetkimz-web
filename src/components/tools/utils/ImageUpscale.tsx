import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { UtilShell } from "./UtilShell";

/**
 * 이미지 해상도 업스케일.
 *
 * 올린 사진을 2·3·4배로 키운다. 한 번에 확대하면 경계가 뭉개지므로, 목표 크기까지
 * 두 배씩 나눠 그린다(다단계 보간). 마지막에 언샤프 마스크로 경계만 세운다.
 *
 * 하고 있는 일을 정확히 말하면 — 픽셀을 늘리고 경계를 세우는 것까지다. 사진 복원 AI처럼
 * 없던 디테일을 만들어 내지는 않는다. 그래서 화면에도 그렇게 적는다.
 *
 * 메모리 보호: 아이폰 사파리는 캔버스 한 장의 면적을 약 1,678만 픽셀로 제한한다.
 * 그 위로는 그리지 않고, 배율을 낮추거나 작은 사진을 쓰라고 알려 준다(조용히 실패하지 않게).
 */

/** 아이폰 사파리 캔버스 면적 한도(16,777,216px) — 넘으면 캔버스가 비어 버린다 */
const MAX_OUT_PIXELS = 16_777_216;
/** 캔버스 한 변 한도 — 브라우저 공통으로 안전한 값 */
const MAX_SIDE = 8192;
/** 이보다 큰 결과는 선명화(픽셀 9회 참조)를 건너뛴다 — 폰에서 몇 초씩 멈추는 것을 막는다 */
const SHARPEN_PIXEL_LIMIT = 5_000_000;

type Scale = 2 | 3 | 4;

type Loaded = {
  file: File;
  bitmap: ImageBitmap;
  w: number;
  h: number;
};

type Result = {
  w: number;
  h: number;
  scale: number;
  blob: Blob | null;
  sharpened: boolean;
  ms: number;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");
const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1) + "MB"
    : Math.max(1, Math.round(bytes / 1024)) + "KB";

/** 두 배씩 나눠 목표 크기까지 그린다 — 마지막 한 번만 정확한 배율로 맞춘다 */
function drawStepwise(
  src: ImageBitmap,
  targetW: number,
  targetH: number,
  onStep?: (w: number, h: number) => void
): HTMLCanvasElement {
  let curW = src.width;
  let curH = src.height;
  let cur: HTMLCanvasElement | ImageBitmap = src;

  let guard = 0;
  while (curW < targetW - 1 && guard++ < 8) {
    const nextW = Math.min(targetW, curW * 2);
    const nextH = Math.max(1, Math.round((curH * nextW) / curW));
    const c = document.createElement("canvas");
    c.width = nextW;
    c.height = nextH;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 캔버스를 쓸 수 없습니다.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur as CanvasImageSource, 0, 0, curW, curH, 0, 0, nextW, nextH);
    cur = c;
    curW = nextW;
    curH = nextH;
    onStep?.(curW, curH);
  }

  /* 마지막 보정 — 두 배로 딱 떨어지지 않은 배율(3배 등)에서 남는 차이를 맞춘다 */
  if (curW !== targetW || curH !== targetH) {
    const c = document.createElement("canvas");
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 캔버스를 쓸 수 없습니다.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur as CanvasImageSource, 0, 0, curW, curH, 0, 0, targetW, targetH);
    cur = c;
    onStep?.(targetW, targetH);
  }

  return cur as HTMLCanvasElement;
}

/**
 * 언샤프 마스크 — 흐린 사본과 원본의 차이를 원본에 더해 경계를 세운다.
 *
 * 흐린 사본은 상자 평균(박스 블러)을 가로·세로로 한 번씩, 누적합으로 만든다(반경이 커도 픽셀당
 * 계산량이 같다). 반경은 배율을 따라간다 — 두 배로 키운 그림은 흐려진 폭도 두 배가 되어
 * 3×3 커널로는 거의 닿지 않기 때문이다.
 */
function unsharpMask(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, radius: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const r = Math.max(1, Math.min(6, Math.round(radius)));
  const win = r * 2 + 1;
  const px = w * h;
  /* 합계는 255×win 까지 올라가 8비트로는 넘친다 — 16비트에 담고, 평균은 8비트로 */
  const tmp = new Uint16Array(px * 3);
  const blur = new Uint8ClampedArray(px * 3);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let k = -r; k <= r; k++) {
      const i = (row + Math.min(w - 1, Math.max(0, k))) * 4;
      sr += src[i];
      sg += src[i + 1];
      sb += src[i + 2];
    }
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 3;
      tmp[o] = sr;
      tmp[o + 1] = sg;
      tmp[o + 2] = sb;
      const outI = (row + Math.min(w - 1, Math.max(0, x - r))) * 4;
      const inI = (row + Math.min(w - 1, Math.max(0, x + r + 1))) * 4;
      sr += src[inI] - src[outI];
      sg += src[inI + 1] - src[outI + 1];
      sb += src[inI + 2] - src[outI + 2];
    }
  }

  for (let x = 0; x < w; x++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let k = -r; k <= r; k++) {
      const o = (Math.min(h - 1, Math.max(0, k)) * w + x) * 3;
      sr += tmp[o];
      sg += tmp[o + 1];
      sb += tmp[o + 2];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 3;
      /* 가로 단계에서 이미 win으로 나누지 않은 합을 담았으므로 둘을 곱해 나눈다 */
      blur[o] = sr / (win * win);
      blur[o + 1] = sg / (win * win);
      blur[o + 2] = sb / (win * win);
      const outO = (Math.min(h - 1, Math.max(0, y - r)) * w + x) * 3;
      const inO = (Math.min(h - 1, Math.max(0, y + r + 1)) * w + x) * 3;
      sr += tmp[inO] - tmp[outO];
      sg += tmp[inO + 1] - tmp[outO + 1];
      sb += tmp[inO + 2] - tmp[outO + 2];
    }
  }

  const out = new Uint8ClampedArray(src.length);
  for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
    out[i] = src[i] + amount * (src[i] - blur[j]);
    out[i + 1] = src[i + 1] + amount * (src[i + 1] - blur[j + 1]);
    out[i + 2] = src[i + 2] + amount * (src[i + 2] - blur[j + 2]);
    out[i + 3] = src[i + 3];
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

/** 비교용으로 가운데에서 잘라 낼 영역 — 너무 크면 확대 효과가 사라진다 */
const CROP = 120;
const cropRect = (w: number, h: number) => {
  const cw = Math.min(CROP, w);
  const ch = Math.min(CROP, h);
  return { cw, ch, cx: Math.floor((w - cw) / 2), cy: Math.floor((h - ch) / 2) };
};

/** 같은 영역을 같은 확대율로 잘라 그린다 — 원본 1픽셀과 결과 1픽셀이 같은 크기로 보이게 */
function drawZoom(
  target: HTMLCanvasElement | null,
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): void {
  if (!target) return;
  target.width = 240;
  target.height = 240;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 240, 240);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 240, 240);
}

/** 화면이 한 번 그려질 틈을 준다 — 무거운 작업 중에도 진행 문구가 보이게 */
const breathe = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export default function ImageUpscale({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `image-compress`의 '해상도 확대' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [scale, setScale] = useState<Scale>(2);
  const [sharpen, setSharpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const origCanvas = useRef<HTMLCanvasElement | null>(null);
  const outCanvas = useRef<HTMLCanvasElement | null>(null);
  const zoomA = useRef<HTMLCanvasElement | null>(null);
  const zoomB = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  /** 지금 배율로 만들 결과 크기 — 미리 보여 주고 한도를 넘으면 미리 막는다 */
  const plan = (() => {
    if (!loaded) return null;
    const w = Math.round(loaded.w * scale);
    const h = Math.round(loaded.h * scale);
    const pixels = w * h;
    const tooBig = pixels > MAX_OUT_PIXELS || w > MAX_SIDE || h > MAX_SIDE;
    return { w, h, pixels, tooBig };
  })();

  const reset = useCallback(() => {
    if (bitmapRef.current) bitmapRef.current.close();
    bitmapRef.current = null;
    setLoaded(null);
    setResult(null);
    setError("");
    setStage("");
  }, []);

  useEffect(
    () => () => {
      if (bitmapRef.current) bitmapRef.current.close();
    },
    []
  );

  const readFile = useCallback(
    async (file: File) => {
      setError("");
      setResult(null);
      setSaved(false);
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일(PNG·JPG·WEBP)만 읽을 수 있습니다.");
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        setError("30MB 이하 사진을 올려 주세요.");
        return;
      }
      setBusy(true);
      setStage("사진을 읽는 중…");
      try {
        if (bitmapRef.current) bitmapRef.current.close();
        /* 휴대폰 사진의 회전 정보(EXIF)를 반영해서 읽는다 */
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        bitmapRef.current = bitmap;
        setLoaded({ file, bitmap, w: bitmap.width, h: bitmap.height });
        setStage("");
      } catch {
        setError("사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.");
        setStage("");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  /* 원본 미리보기 — 파일이 바뀔 때만 그린다 */
  useEffect(() => {
    const c = origCanvas.current;
    if (!c || !loaded) return;
    c.width = loaded.w;
    c.height = loaded.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, loaded.w, loaded.h);
    ctx.drawImage(loaded.bitmap, 0, 0);
  }, [loaded]);

  /*
   * 결과 캔버스는 다음 결과를 그릴 때까지 이전 그림을 들고 있다. 사진이나 배율을 바꾸면
   * 이전 결과가 그대로 남아 마치 지금 배율의 결과처럼 보이므로, 결과가 없을 때는 비운다.
   */
  useEffect(() => {
    const c = outCanvas.current;
    if (!c || result) return;
    const w = plan?.w ?? loaded?.w ?? 0;
    const h = plan?.h ?? loaded?.h ?? 0;
    if (w <= 0 || h <= 0) return;
    /* 빈 자리는 결과와 같은 비율로만 잡는다 — 배율만 골라도 수십 MB 캔버스를 잡아 두지 않게 */
    const k = Math.min(1, 720 / Math.max(w, h));
    const bw = Math.max(1, Math.round(w * k));
    const bh = Math.max(1, Math.round(h * k));
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    c.getContext("2d")?.clearRect(0, 0, bw, bh);
  }, [result, plan?.w, plan?.h, loaded]);

  /*
   * 비교 캔버스는 결과와 함께 처음 화면에 붙는다. 처리 중에 그리면 아직 DOM에 없어서
   * 아무것도 그려지지 않으므로(300×150 빈 캔버스), 붙은 뒤에 그린다.
   */
  useEffect(() => {
    if (!result || !loaded) return;
    const out = outCanvas.current;
    if (!out) return;
    const { cw, ch, cx, cy } = cropRect(loaded.w, loaded.h);
    drawZoom(zoomA.current, loaded.bitmap, cx, cy, cw, ch);
    drawZoom(zoomB.current, out, cx * result.scale, cy * result.scale, cw * result.scale, ch * result.scale);
  }, [result, loaded]);

  const run = useCallback(async () => {
    if (!loaded || !plan) return;
    if (plan.tooBig) {
      setError(
        `이 배율이면 ${fmt(plan.w)}×${fmt(plan.h)}(${fmt(plan.pixels)}픽셀)입니다. 아이폰 사파리 캔버스 한도(약 1,678만 픽셀)를 넘어 흰 화면이 될 수 있어 만들지 않았습니다. 2배로 낮추거나 작은 사진을 올려 주세요.`
      );
      return;
    }
    setError("");
    setResult(null);
    setSaved(false);
    setBusy(true);
    const started = performance.now();
    try {
      setStage("1단계 · 두 배씩 키우는 중…");
      await breathe();
      const canvas = drawStepwise(loaded.bitmap, plan.w, plan.h, (w, h) =>
        setStage(`1단계 · ${fmt(w)}×${fmt(h)}까지 키움`)
      );
      await breathe();

      let sharpened = false;
      if (sharpen) {
        if (plan.pixels <= SHARPEN_PIXEL_LIMIT) {
          setStage("2단계 · 경계를 세우는 중(언샤프 마스크)…");
          await breathe();
          const ctx = canvas.getContext("2d");
          if (ctx) {
            unsharpMask(ctx, plan.w, plan.h, 0.8, scale);
            sharpened = true;
          }
        } else {
          setStage("2단계 · 사진이 커서 선명화는 건너뜀");
          await breathe();
        }
      }

      setStage("3단계 · PNG로 묶는 중…");
      await breathe();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("PNG를 만들지 못했습니다.");

      /* 결과 미리보기 — 화면에는 줄여 그리고, 내려받는 파일은 원래 크기다 */
      const out = outCanvas.current;
      if (out) {
        out.width = plan.w;
        out.height = plan.h;
        out.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      setResult({
        w: plan.w,
        h: plan.h,
        scale,
        blob,
        sharpened,
        ms: Math.round(performance.now() - started),
      });
      setStage("");
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `처리 중 멈췄습니다: ${e.message}`
          : "처리 중 멈췄습니다. 배율을 낮춰 다시 시도해 주세요."
      );
      setStage("");
    } finally {
      setBusy(false);
    }
  }, [loaded, plan, scale, sharpen]);

  const download = () => {
    if (!result?.blob || !loaded) return;
    const base = loaded.file.name.replace(/\.[^.]+$/, "").replace(/[^\w가-힣-]+/g, "-").slice(0, 40) || "image";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(result.blob);
    a.download = `buffetkimz-upscale-${base}-${result.scale}x.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    setSaved(true);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
  };

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">이미지 해상도 업스케일</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">2·3·4배로 키우고 경계를 세워 PNG로 저장합니다.</p>
        </div>
      )}
      <div className="space-y-4">
        {/* 파일 넣기 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          data-dropzone
          className={
            "cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors " +
            (dragging ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/45")
          }
        >
          <p className="text-[13.5px] font-semibold text-ink">
            {loaded ? "다른 사진으로 바꾸려면 누르세요" : "사진을 끌어 놓거나 눌러서 고르세요"}
          </p>
          <p className="mt-1 text-[12px] text-ink-faint">PNG · JPG · WEBP · 30MB 이하</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.currentTarget.value = "";
            }}
          />
        </div>

        {error && (
          <p data-upscale-error className="rounded-xl border border-clay/40 bg-[#fbf3ef] px-3 py-2.5 text-[12.5px] leading-relaxed text-clay">
            {error}
          </p>
        )}

        {loaded && (
          <>
            {/* 원본 정보 + 배율 */}
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div data-upscale-source className="rounded-xl border border-line bg-white px-3.5 py-3">
                <p className="truncate text-[12px] font-semibold text-ink-faint">{loaded.file.name}</p>
                <p className="mt-1 text-[18px] font-extrabold tabular-nums tracking-[-0.02em] text-ink">
                  {fmt(loaded.w)} × {fmt(loaded.h)}
                  <span className="ml-2 text-[12px] font-semibold text-ink-faint">
                    {fmt(loaded.w * loaded.h)}픽셀 · {sizeLabel(loaded.file.size)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([2, 3, 4] as Scale[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-scale={s}
                    aria-pressed={scale === s}
                    onClick={() => {
                      setScale(s);
                      setResult(null);
                      setSaved(false);
                    }}
                    className={
                      "min-h-[40px] min-w-[64px] rounded-lg px-3 text-[13px] font-semibold transition-colors " +
                      (scale === s
                        ? "bg-brand text-white"
                        : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                    }
                  >
                    {s}배
                  </button>
                ))}
              </div>
            </div>

            {/* 결과 예정 크기 */}
            {plan && (
              <div
                data-upscale-plan
                className={
                  "rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed " +
                  (plan.tooBig ? "border-clay/40 bg-[#fbf3ef] text-clay" : "border-line bg-white text-ink-muted")
                }
              >
                결과 <strong className="font-semibold tabular-nums text-ink">{fmt(plan.w)} × {fmt(plan.h)}</strong>
                {" · "}
                {fmt(plan.pixels)}픽셀 (원본의 {scale * scale}배)
                {plan.tooBig ? " · 캔버스 한도 초과 — 배율을 낮춰 주세요" : ""}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || !plan || plan.tooBig}
                data-upscale-run
                className="min-h-[44px] rounded-xl bg-brand px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
              >
                {busy ? "처리 중…" : `${scale}배로 키우기`}
              </button>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-soft">
                <input
                  type="checkbox"
                  checked={sharpen}
                  onChange={(e) => {
                    setSharpen(e.target.checked);
                    setResult(null);
                  }}
                  className="h-4 w-4 accent-[#1a4ffd]"
                />
                경계 선명화
              </label>
              <button
                type="button"
                onClick={reset}
                className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
              >
                다른 사진
              </button>
            </div>

            {(busy || stage) && (
              <p data-upscale-stage className="text-[12.5px] font-semibold text-brand">
                {stage || "처리 중…"}
              </p>
            )}

            {/* 원본 · 결과 나란히 */}
            <div className="grid gap-3 md:grid-cols-2">
              <figure className="rounded-xl border border-line bg-white p-2.5">
                <figcaption className="mb-2 flex items-center justify-between text-[12px] font-semibold text-ink-faint">
                  <span>원본</span>
                  <span className="tabular-nums">{fmt(loaded.w)}×{fmt(loaded.h)}</span>
                </figcaption>
                <canvas ref={origCanvas} data-upscale-orig className="h-auto w-full rounded-lg bg-[#f2f0e8]" />
              </figure>
              <figure className="rounded-xl border border-line bg-white p-2.5">
                <figcaption className="mb-2 flex items-center justify-between text-[12px] font-semibold text-ink-faint">
                  <span>업스케일</span>
                  <span className="tabular-nums">
                    {result ? `${fmt(result.w)}×${fmt(result.h)}` : plan ? `${fmt(plan.w)}×${fmt(plan.h)}` : "—"}
                  </span>
                </figcaption>
                <div className="relative">
                  <canvas ref={outCanvas} data-upscale-canvas className="h-auto w-full rounded-lg bg-[#f2f0e8]" />
                  {!result && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] font-semibold text-ink-faint">
                      {busy ? "만드는 중…" : `${scale}배로 키우면 여기에 결과가 나옵니다`}
                    </p>
                  )}
                </div>
              </figure>
            </div>

            {/* 같은 영역 확대 비교 */}
            {result && (
              <div data-upscale-zoom className="rounded-xl border border-line bg-white p-3">
                <p className="text-[12px] font-semibold text-ink-faint">
                  가운데 {cropRect(loaded.w, loaded.h).cw}×{cropRect(loaded.w, loaded.h).ch}px을 같은 크기로 잘라 비교
                  (약 {(240 / cropRect(loaded.w, loaded.h).cw).toFixed(1)}배 확대)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <canvas ref={zoomA} className="aspect-square w-full rounded-lg border border-line-soft bg-[#f2f0e8]" />
                    <p className="mt-1 text-center text-[11.5px] text-ink-faint">원본</p>
                  </div>
                  <div>
                    <canvas ref={zoomB} className="aspect-square w-full rounded-lg border border-line-soft bg-[#f2f0e8]" />
                    <p className="mt-1 text-center text-[11.5px] text-ink-faint">업스케일</p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={download}
                  data-upscale-download
                  className="min-h-[44px] rounded-xl bg-jade px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[#186551]"
                >
                  PNG 내려받기
                </button>
                {result.blob && (
                  <span className="text-[12px] text-ink-muted">
                    {fmt(result.w)}×{fmt(result.h)} · {sizeLabel(result.blob.size)} · {result.ms}ms
                    {result.sharpened ? " · 선명화 적용" : " · 선명화 생략"}
                  </span>
                )}
                {saved && (
                  <span data-upscale-saved className="text-[12px] font-semibold text-jade">
                    저장을 시작했습니다. 내려받기 폴더를 보세요.
                  </span>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          {MAX_OUT_PIXELS.toLocaleString("ko-KR")}픽셀(아이폰 사파리 캔버스 한도)을 넘으면 만들지 않습니다. 원본이 4,000×4,000을
          넘으면 2배도 한도를 넘을 수 있습니다.
        </p>
      </div>
    </>
  );

  if (embedded) return <div data-util="image-upscale">{content}</div>;

  return (
    <UtilShell
      id="image-upscale"
      title="이미지 해상도 업스케일"
      subtitle="2·3·4배로 키우고 경계를 세워 PNG로 저장"
      note={
        <>
          사진은 <strong className="font-semibold text-ink">이 브라우저 안에서만</strong> 처리되고 업로드되지 않습니다.
          업스케일은 픽셀을 늘리고 경계를 세우는 처리로, <strong className="font-semibold text-ink">없던 디테일을 복원하는 AI는 아닙니다</strong>.
        </>
      }
    >
      {content}
    </UtilShell>
  );
}
