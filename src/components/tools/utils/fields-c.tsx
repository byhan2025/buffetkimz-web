import { useId, useState, type CSSProperties, type ReactNode } from "react";

/**
 * 유용한앱 3탄(금융·생활 계산 8종) 공용 입력·출력 부품.
 *
 * ui.tsx의 슬라이더·결과 카드와 같은 토큰을 쓰되, 날짜·정확한 원 단위·소수점 요율처럼
 * 슬라이더만으로는 다루기 어려운 값을 위해 숫자 입력을 슬라이더와 나란히 둔다.
 * 입력값은 전부 브라우저 메모리에만 있고 서버로 보내지 않는다.
 */

const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

type AmountFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** 입력 상자 오른쪽 단위 — "만원" · "원" · "%" · "년" · "시간" 등 */
  unit?: string;
  hint?: string;
  /** 소수 자릿수 (요율 등) */
  decimals?: number;
  /** 슬라이더를 숨기고 숫자 입력만 쓴다 */
  noSlider?: boolean;
  /** 슬라이더 양 끝에 표시할 값 (기본: min·max를 unit과 함께) */
  edgeFormat?: (v: number) => string;
};

export function AmountField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "만원",
  hint,
  decimals = 0,
  noSlider = false,
  edgeFormat,
}: AmountFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const edge = edgeFormat ?? ((v: number) => `${fmt(v, decimals)}${unit}`);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^\d.-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  };

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-ink">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft ?? fmt(value, decimals)}
            onChange={(e) => {
              setDraft(e.target.value);
              commit(e.target.value);
            }}
            onFocus={() => setDraft(fmt(value, decimals))}
            onBlur={() => {
              const next = Math.min(max, Math.max(min, value));
              setDraft(null);
              if (next !== value) onChange(next);
            }}
            className="w-[104px] rounded-lg border border-line bg-white px-2 py-1.5 text-right text-[13.5px] font-bold tabular-nums text-brand focus:border-brand focus:outline-none"
          />
          <span className="w-8 text-[12px] text-ink-faint">{unit}</span>
        </div>
      </div>
      {!noSlider && (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={`${label} 슬라이더`}
            onChange={(e) => onChange(Number(e.target.value))}
            className="range mt-1"
            style={{ "--pct": `${pct}%` } as CSSProperties}
          />
          <div className="mt-1 flex justify-between text-[12px] text-ink-faint">
            <span>{edge(min)}</span>
            <span>{hint ?? ""}</span>
            <span>{edge(max)}</span>
          </div>
        </>
      )}
      {noSlider && hint && <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="py-3">
      <label htmlFor={id} className="text-[13.5px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] font-semibold tabular-nums text-ink focus:border-brand focus:outline-none"
      />
      {hint && <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

/** 작은 선택 버튼 묶음 — '2026 최저임금' 같은 빠른 선택 */
export function QuickChoices<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <p className="text-[13.5px] font-semibold text-ink">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={
                "min-h-[44px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors " +
                (active
                  ? "bg-brand text-white shadow-[0_6px_16px_-14px_rgba(15,53,80,0.9)]"
                  : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 결과 표의 한 줄 — 라벨과 값, 강조 여부 */
export function Line({
  label,
  value,
  strong = false,
  tone = "default",
  sub,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: "default" | "brand" | "jade" | "clay";
  sub?: string;
}) {
  const color =
    tone === "brand" ? "text-brand" : tone === "jade" ? "text-jade" : tone === "clay" ? "text-clay" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-0">
      <span className="text-[12.5px] leading-relaxed text-ink-muted">
        {label}
        {sub && <span className="ml-1 text-[12px] text-ink-faint">{sub}</span>}
      </span>
      <span
        className={`shrink-0 text-right tabular-nums ${color} ${
          strong ? "text-[15px] font-extrabold" : "text-[13px] font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * 넓은 표를 모바일에서 가로 스크롤로 넘긴다.
 * 좁은 화면에서 숫자가 한 글자씩 줄바꿈되어 읽기 어려워지는 것을 막는다.
 */
export function TableScroll({ children, minWidth = 520 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="w-full max-w-full">
      <p className="mb-1 text-[11.5px] leading-relaxed text-ink-faint md:hidden" aria-hidden="true">
        표를 옆으로 밀면 모든 열이 보입니다.
      </p>
      <div className="w-full max-w-full overflow-x-auto rounded-xl [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}

/** 계산 전 확인 목록 — 기존 도구의 노란 상자와 같은 결 */
export function CaveatBox({ title = "계산 전 확인", items }: { title?: string; items: ReactNode[] }) {
  return (
    <div className="rounded-lg border border-line bg-paper-deep p-4">
      <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">{title}</p>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#4a4636]">
        {items.map((item, i) => (
          <li key={i}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

export const num = (n: number, decimals = 0) => fmt(n, decimals);
