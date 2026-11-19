import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { site } from "@/config/site";

export function formatWon(value: number): string {
  if (!Number.isFinite(value)) return "0원";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 100000000) {
    const eok = Math.floor(rounded / 100000000);
    const man = Math.round((rounded % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만원` : `${eok}억원`;
  }
  if (Math.abs(rounded) >= 10000) {
    return `${Math.round(rounded / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${rounded.toLocaleString("ko-KR")}원`;
}

export function formatMan(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}만원`;
}

/** 원 단위 정확 표기 (세액·보험금처럼 반올림하면 의미가 달라지는 값) */
export function formatKrw(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

type SliderProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  format?: (v: number) => string;
};

export function MoneySlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 10,
  hint,
  format = formatMan,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-ink">
          {label}
        </label>
        <output htmlFor={id} className="text-[14px] font-bold tabular-nums text-brand">
          {format(value)}
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
        style={{ "--pct": `${pct}%` } as CSSProperties}
      />
      <div className="mt-1 flex justify-between text-[12px] text-ink-faint">
        <span>{format(min)}</span>
        {hint ? <span>{hint}</span> : <span />}
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
};

export function Segmented<T extends string>({ label, value, options, onChange, hint }: SegmentedProps<T>) {
  return (
    <fieldset className="py-3">
      <legend className="text-[13.5px] font-semibold text-ink">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={
                "min-h-[44px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors " +
                (active
                  ? "bg-brand text-white shadow-[0_6px_16px_-12px_rgba(15,53,80,0.9)]"
                  : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{hint}</p>}
    </fieldset>
  );
}

type ToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors " +
        (checked ? "border-brand/45 bg-[#f4f8fb]" : "border-line bg-white hover:border-line/80")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#23483a]"
      />
      <span>
        <span className="block text-[13px] font-semibold leading-snug text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">{description}</span>
        )}
      </span>
    </label>
  );
}

/**
 * 결과 숫자 카운트업 — 500ms, 한 번만. 모션을 줄이기로 한 설정에서는 그대로 보여 준다.
 * 문자열 앞부분의 첫 숫자만 움직이고, 단위와 나머지 글자는 그대로 둔다.
 */
function CountUp({ text }: { text: string }) {
  const match = text.match(/^(\D*)(\d[\d,]*)([\s\S]*)$/);
  const target = match ? Number(match[2].replace(/,/g, "")) : 0;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(target);
  const started = useRef(false);

  useEffect(() => {
    if (!match || reduce || started.current) return;
    started.current = true;
    const duration = 500;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);

  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]}
      {shown.toLocaleString("ko-KR")}
      {match[3]}
    </>
  );
}

export function ResultStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "brand" | "jade";
}) {
  const toneCls =
    tone === "brand"
      ? "text-brand"
      : tone === "jade"
        ? "text-jade"
        : "text-ink";
  const animated = typeof value === "string" ? <CountUp text={value} /> : value;
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-[12px] font-semibold tracking-[0.02em] text-ink-faint">{label}</p>
      <p className={`mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] tabular-nums ${toneCls}`}>{animated}</p>
      {sub && <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{sub}</p>}
    </div>
  );
}

/**
 * 모바일 실행 화면 하단 요약 바 — 슬라이더를 움직이는 동안 핵심 숫자가 화면에 머문다.
 * 결과 카드와 같은 값을 그대로 비춰 주기만 한다(새로 계산하지 않는다).
 * 화면 낭독기에는 결과 카드의 숫자가 이미 있으므로 aria-hidden으로 중복 낭독을 막는다.
 */
export function StickySummary({
  items,
  note,
}: {
  items: { label: string; value: string }[];
  /** 하단 바 맨 아래 한 줄 — 계산의 성격과 기준일을 바 안에서 밝힌다 */
  note?: string;
}) {
  return (
    <div className="sticky-summary" data-sticky-summary aria-hidden="true">
      <div className="wrap !px-4">
        <div className="flex items-center gap-3">
          {items.map((it) => (
            <div key={it.label} className="min-w-0 flex-1">
              <span className="block text-[12px] leading-none text-ink-faint">{it.label}</span>
              <span className="mt-1 block truncate text-[14px] font-bold tabular-nums text-ink">
                {it.value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1 truncate text-[12px] leading-[1.4] text-ink-faint" data-sticky-note>
          {note ?? `예시 가정 · 확인 기준일 ${site.baseDate}`}
        </p>
      </div>
    </div>
  );
}

export function RunnerShell({
  title,
  subtitle,
  example,
  children,
}: {
  title: string;
  subtitle: string;
  /** 예시 입력값 안내 — 없으면 기본 문구를 쓴다 */
  example?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-[#fbfbf8] p-5 md:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint">작동 확인용</p>
          <h3 className="mt-1 text-[16.5px] font-bold tracking-[-0.03em] text-ink">{title}</h3>
          <p className="mt-1 text-[12px] text-ink-muted">{subtitle}</p>
        </div>
        <span className="chip !min-h-[26px] !border-transparent !bg-jade-soft !px-2.5 !text-[12px] !text-jade">
          서버 미전송
        </span>
      </div>
      <p className="border-b border-line-soft py-2.5 text-[12px] leading-relaxed text-ink-muted">
        <strong className="font-semibold text-ink">예시 입력값(가상)</strong>으로 시작합니다.{" "}
        {example ?? "숫자를 바꾸면 결과가 즉시 달라지고, 새로 고치면 예시로 돌아갑니다."}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function Bar({ ratio, tone = "brand" }: { ratio: number; tone?: "brand" | "jade" | "rose" }) {
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  const bg = tone === "jade" ? "bg-[#2f8f6f]" : tone === "rose" ? "bg-[#b1637a]" : "bg-brand";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
      <div className={`h-full rounded-full ${bg} transition-[width] duration-500`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-ink bg-paper-deep px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}
