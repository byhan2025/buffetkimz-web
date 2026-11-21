import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { CopyButton, UtilShell, copyToClipboard } from "./UtilShell";

/**
 * 이미지 대표색 추출.
 *
 * 업로드한 이미지를 작은 캔버스(긴 변 260px)에 줄여 그린 뒤 픽셀을 읽어 색을 센다.
 * 색은 채널당 5비트(32단계)로 묶어 세고, 많은 순서로 보면서 이미 뽑힌 색과 충분히 다른 것만
 * 6개까지 남긴다. 이미지는 브라우저 밖으로 나가지 않는다(파일을 읽지도, 올리지도 않는다).
 */

type Swatch = { hex: string; r: number; g: number; b: number; share: number; count: number };

const toHex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
const hexOf = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const contrast = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

/** 비중이 1% 아래면 0%로 보이지 않게 '<1%' */
const shareLabel = (share: number) => (share > 0 && share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`);

/** 보이는 픽셀에서 대표색 6개 — 밝기·투명 픽셀은 건너뛴다 */
export function extractPalette(data: Uint8ClampedArray, maxColors = 6): Swatch[] {
  const bins = new Map<number, { r: number; g: number; b: number; count: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    total += 1;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cur = bins.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.count += 1;
    } else {
      bins.set(key, { r, g, b, count: 1 });
    }
  }
  if (total === 0) return [];
  const sorted = [...bins.values()]
    .map((v) => ({
      r: Math.round(v.r / v.count),
      g: Math.round(v.g / v.count),
      b: Math.round(v.b / v.count),
      count: v.count,
    }))
    .sort((x, y) => y.count - x.count);

  const picked: Swatch[] = [];
  const dist = (p: { r: number; g: number; b: number }, c: { r: number; g: number; b: number }) => {
    const dr = p.r - c.r;
    const dg = p.g - c.g;
    const db = p.b - c.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  /* 고른 색과 가까운 묶음은 그 색의 면적으로 합친다 — 그래야 비중이 실제 화면 비율에 가까워진다 */
  for (const c of sorted) {
    const near = picked.findIndex((p) => dist(p, c) < 34);
    if (near >= 0) {
      picked[near].count += c.count;
      continue;
    }
    if (picked.length < maxColors) {
      picked.push({ r: c.r, g: c.g, b: c.b, hex: hexOf(c.r, c.g, c.b), count: c.count, share: 0 });
      continue;
    }
    let best = 0;
    let bestD = Infinity;
    picked.forEach((p, i) => {
      const d = dist(p, c);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    picked[best].count += c.count;
  }

  return picked
    .map((p) => ({ ...p, share: total > 0 ? p.count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export default function ColorExtractor() {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [colors, setColors] = useState<Swatch[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const readImage = useCallback((file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일(PNG·JPG·WEBP)만 읽을 수 있습니다.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("15MB 이하 이미지를 올려 주세요.");
      return;
    }
    setBusy(true);
    setName(file.name);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const next = URL.createObjectURL(file);
    objectUrl.current = next;
    setUrl(next);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setBusy(false);
        return;
      }
      const scale = Math.min(1, 260 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError("이 브라우저에서는 캔버스를 쓸 수 없습니다.");
        setBusy(false);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const data = ctx.getImageData(0, 0, w, h).data;
        setColors(extractPalette(data));
        setSize({ w: img.width, h: img.height });
      } catch {
        setError("이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요.");
      }
      setBusy(false);
    };
    img.onerror = () => {
      setError("이미지를 열지 못했습니다. 파일이 손상되었는지 확인해 주세요.");
      setBusy(false);
    };
    img.src = next;
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readImage(file);
  };

  const allHex = colors.map((c) => c.hex).join(", ");
  const cssVars = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n");
  const top = colors[0];
  const topLum = top ? luminance(top.r, top.g, top.b) : 0;
  const onWhite = contrast(topLum, 1);
  const onBlack = contrast(topLum, 0);

  return (
    <UtilShell
      id="color-extractor"
      title="이미지 대표색 추출"
      subtitle="사진·썸네일에서 대표색 6개를 뽑아 HEX·RGB로 보여 줍니다. 눌러서 복사하세요."
      note={
        <>
          고른 이미지는 <strong className="font-semibold text-ink">브라우저 안에서만</strong> 열립니다. 서버로 올리지
          않고 저장하지도 않으며, 창을 닫으면 사라집니다.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.05fr_1fr] md:gap-5">
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={
              "relative flex min-h-[230px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition-colors " +
              (dragging ? "border-brand bg-brand-soft" : "border-line bg-white")
            }
            data-color-drop
          >
            {url ? (
              <img src={url} alt="고른 이미지 미리보기" className="max-h-[300px] w-full object-contain" />
            ) : (
              <div className="px-5 py-8">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-ink-faint" aria-hidden="true">
                  <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" />
                  <path d="M3.4 15.4l4.6-4.4 3.4 3.2 2.8-2.6 6.4 5.8M8.8 9.2h.1" />
                </svg>
                <p className="mt-2 text-[13px] font-semibold text-ink">이미지를 끌어 놓거나 골라 주세요</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">PNG · JPG · WEBP · 15MB 이하</p>
              </div>
            )}
            {busy && <p className="absolute inset-0 grid place-items-center bg-white/70 text-[13px] font-semibold text-brand">색을 세는 중…</p>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center rounded-full bg-brand px-4 text-[12.5px] font-semibold text-white hover:bg-brand-deep"
            >
              이미지 고르기
            </button>
            {url && (
              <button
                type="button"
                onClick={() => {
                  setUrl(null);
                  setColors([]);
                  setName("");
                  setSize(null);
                  setError("");
                  if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
                  objectUrl.current = null;
                }}
                className="inline-flex min-h-[40px] items-center rounded-full border border-line bg-white px-3.5 text-[12.5px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
              >
                지우기
              </button>
            )}
            {name && (
              <span className="mono min-w-0 truncate text-[12px] text-ink-faint" data-color-name>
                {name}
                {size ? ` · ${size.w}×${size.h}` : ""}
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readImage(f);
              e.target.value = "";
            }}
          />
          {error && (
            <p className="mt-2 rounded-lg border border-[#e8d3c6] bg-[#fbf3ef] px-3 py-2 text-[12px] font-semibold text-[#8a4a2e]">
              {error}
            </p>
          )}
          <canvas ref={canvasRef} className="hidden" width="1" height="1" aria-hidden="true" />
        </div>

        <div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="field-label">대표색 {colors.length}개</p>
              <p className="mt-0.5 text-[12px] text-ink-muted">색을 누르면 HEX가 복사됩니다.</p>
            </div>
            <CopyButton label="HEX 모두 복사" text={allHex} disabled={colors.length === 0} />
          </div>

          {colors.length === 0 ? (
            <div className="mt-1.5 rounded-xl border border-line bg-white px-3.5 py-8 text-center text-[12.5px] text-ink-faint">
              이미지를 고르면 여기에 색이 나옵니다.
            </div>
          ) : (
            <ul className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3" data-color-swatches>
              {colors.map((c, i) => {
                const lum = luminance(c.r, c.g, c.b);
                const ink = contrast(lum, 0) > contrast(lum, 1) ? "#0b1b29" : "#ffffff";
                return (
                  <li key={c.hex + i}>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(c.hex);
                        if (ok) {
                          setCopied(c.hex);
                          window.setTimeout(() => setCopied((v) => (v === c.hex ? "" : v)), 1600);
                        }
                      }}
                      className="group w-full overflow-hidden rounded-xl border border-line bg-white text-left transition-shadow hover:shadow-[0_10px_24px_-18px_rgba(11,27,41,0.7)]"
                      data-color-hex={c.hex}
                      title={`${c.hex} 복사`}
                    >
                      <span
                        className="flex h-[76px] items-end justify-between px-2 pb-1.5"
                        style={{ backgroundColor: c.hex, color: ink }}
                      >
                        <span className="mono text-[11px] font-bold">{copied === c.hex ? "복사됨" : c.hex}</span>
                        <span className="text-[10px] font-semibold opacity-80">{shareLabel(c.share)}</span>
                      </span>
                      <span className="block px-2 py-1.5">
                        <span className="mono block text-[11px] leading-[1.5] text-ink-soft">
                          {c.r}, {c.g}, {c.b}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {top && (
            <div className="mt-3 rounded-xl border border-line bg-white p-3" data-color-info>
              <p className="text-[12px] font-semibold text-ink-faint">가장 많은 색</p>
              <p className="mt-1 flex items-center gap-2 text-[15px] font-bold text-ink">
                <span className="inline-block h-4 w-4 rounded border border-line" style={{ backgroundColor: top.hex }} />
                <span className="mono">{top.hex}</span>
                <span className="text-[12px] font-semibold text-ink-muted">{shareLabel(top.share)}</span>
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                이 색 위에 흰 글씨를 얹으면 대비 {contrast(topLum, 1).toFixed(1)}:1, 검은 글씨는{" "}
                {contrast(topLum, 0).toFixed(1)}:1입니다. 본문 기준 4.5:1을 넘는 쪽을 고르세요.
              </p>
              {(onWhite < 3 || onBlack < 3) && (
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  두 대비 모두 낮은 색이라, 글씨를 얹기보다 배경·구분선에 쓰는 편이 낫습니다.
                </p>
              )}
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-3">
              <div className="flex items-end justify-between gap-2">
                <p className="field-label">CSS 변수로 쓰기</p>
                <CopyButton small label="변수 복사" text={`:root {\n${cssVars}\n}`} />
              </div>
              <pre className="mono mt-1.5 overflow-auto rounded-xl border border-line bg-white px-3 py-2.5 text-[11.5px] leading-[1.7] text-ink-soft">
{`:root {
${cssVars}
}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </UtilShell>
  );
}
