/**
 * 유용한앱 7종 공통 부품 — 파일 투입·미리보기·내려받기.
 *
 * 원칙: 업로드한 파일은 이 브라우저 메모리 안에서만 읽는다. fetch·XHR·FormData로
 * 어디에도 보내지 않는다. 결과 파일도 Blob URL로만 만들어 내려받는다.
 */
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { site } from "@/config/site";

/* ---------------------------------------------------------------- 숫자·용량 */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  if (i === 0) return `${Math.round(v)} B`;
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** 2.4MB → 310KB 처럼 한 줄로 — 압축 화면의 전/후 표기에 쓴다. */
export function sizePair(before: number, after: number): string {
  return `${formatBytes(before)} → ${formatBytes(after)}`;
}

export function savedPct(before: number, after: number): number {
  if (!before) return 0;
  return Math.round((1 - after / before) * 100);
}

/* ---------------------------------------------------------------- 파일 입출력 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했습니다"))),
      type,
      quality,
    );
  });
}

/** 파일 → 이미지. 디코딩이 끝나면 Blob URL은 곧 반납한다(픽셀은 이미 메모리에 있다). */
export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이미지를 읽지 못했습니다. JPG·PNG·WebP 파일인지 확인해 주세요."));
      img.src = url;
    });
    return img;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/* ---------------------------------------------------------------- 화면 부품 */

/** 실행 화면 바깥 틀 — 도구마다 같은 머리·같은 '서버 미전송' 표시를 쓴다. */
export function UtilityShell({
  title,
  subtitle,
  steps,
  children,
}: {
  title: string;
  subtitle: string;
  /** 한 줄 사용 순서 (2~3단계) */
  steps?: string[];
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-[#fbfbf8] p-4 md:p-7" data-runner data-useful-app>
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.01em] text-ink-faint">브라우저 도구</p>
          <h3 className="mt-1 text-[16.5px] font-bold tracking-[-0.03em] text-ink">{title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{subtitle}</p>
        </div>
        <span className="chip !min-h-[26px] shrink-0 !border-transparent !bg-jade-soft !px-2.5 !text-[12px] !text-jade">
          서버 미전송
        </span>
      </div>

      {steps && steps.length > 0 && (
        <ol className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line-soft py-2.5 text-[12px] leading-relaxed text-ink-muted">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="mono flex h-4 w-4 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-deep">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">{children}</div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white p-4 ${className}`}>{children}</div>;
}

export function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2.5">
      <p className="text-[12.5px] font-semibold text-ink">{children}</p>
      {right}
    </div>
  );
}

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
        {children}
      </label>
      {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  inputMode,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  inputMode?: "text" | "url" | "tel" | "numeric";
  ariaLabel?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={
        "w-full rounded-xl border border-line bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand/60 focus:outline-none " +
        (mono ? "mono py-2.5 text-[12.5px]" : "py-2.5")
      }
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  id,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
      className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 text-[13px] font-medium text-ink focus:border-brand/60 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 강도·투명도 같은 값 — tools/ui.tsx의 슬라이더와 같은 모양을 쓴다. */
export function RangeRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-ink">
          {label}
        </label>
        <output htmlFor={id} className="mono text-[12.5px] font-bold tabular-nums text-brand">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range mt-1"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Btn({
  children,
  onClick,
  tone = "primary",
  disabled,
  full,
  small,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "secondary" | "ghost" | "tiny";
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const size = small
    ? "min-h-[36px] px-3 text-[12px]"
    : tone === "tiny"
      ? "min-h-[32px] px-2.5 text-[11.5px]"
      : "min-h-[44px] px-4 text-[13px]";
  const skin =
    tone === "primary"
      ? "bg-brand text-white hover:bg-brand-deep"
      : tone === "secondary"
        ? "border border-line bg-white text-ink-soft hover:border-brand/45 hover:text-brand"
        : "text-ink-muted hover:text-brand";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${size} ${skin} ${full ? "w-full" : ""}`}>
      {children}
    </button>
  );
}

/** 드래그&드롭 + 파일 선택. 테스트에서는 안쪽 input[type=file]에 파일을 넣는다. */
export function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title,
  hint,
  compact = false,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
    [multiple, onFiles],
  );

  return (
    <div
      className={
        "rounded-xl border-2 border-dashed transition-colors " +
        (over ? "border-brand bg-brand-soft/60" : "border-line bg-[#fcfcfa] hover:border-brand/40")
      }
      data-dropzone
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer?.files ?? null);
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={"flex w-full flex-col items-center justify-center gap-1.5 text-center " + (compact ? "px-3 py-4" : "px-4 py-7")}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-deep" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V5m0 0L8.2 8.8M12 5l3.8 3.8" />
            <path d="M4.5 15.5v2.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.2" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {hint && <span className="text-[11.5px] leading-relaxed text-ink-faint">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        aria-label={title}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function EmptyPreview({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-[#fcfcfa] px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-line-soft text-ink-faint" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <path d="m3.5 15.5 4.6-4.4 3.4 3.2 2.7-2.5 6.3 5.7" />
          <circle cx="9" cy="9.4" r="1.2" />
        </svg>
      </span>
      <p className="max-w-[30ch] text-[12px] leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

/** 결과 한 줄 — 값과 단위를 오른쪽에 붙인다. */
export function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "brand" | "clay" | "jade";
}) {
  const color =
    tone === "brand" ? "text-brand" : tone === "clay" ? "text-clay" : tone === "jade" ? "text-jade" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3">
      <p className="text-[11.5px] font-semibold text-ink-faint">{label}</p>
      <p className={`mono mt-1 text-[16px] font-extrabold tracking-[-0.02em] tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{sub}</p>}
    </div>
  );
}

/** 복사 — 클립보드가 막힌 브라우저(http·구형)에서는 임시 textarea로 대신한다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 대체 경로로 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 내려받기 안내 — 결과 옆에 기준일과 함께 붙인다. */
export function LocalNote({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-brand/50 bg-paper-deep px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
      {children ?? (
        <>
          파일은 이 기기 안에서만 처리되고 서버로 전송되지 않습니다. 결과 파일은 내려받아 보관해 주세요. 기준일{" "}
          {site.baseDateLabel}.
        </>
      )}
    </p>
  );
}
