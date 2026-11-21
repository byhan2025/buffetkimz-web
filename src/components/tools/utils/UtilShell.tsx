import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * 유용한앱(텍스트·문서·디자인 유틸리티) 공통 껍데기.
 *
 * 시뮬레이터(RunnerShell)와 같은 면·선·글자 토큰을 쓰되, 계산 도구가 아니라
 * "내 텍스트를 다루는 도구"라서 문구를 바꿨다. 입력은 브라우저 안에서만 처리되고
 * 어디에도 저장·전송되지 않는다는 점을 머리와 아래 한 줄에 함께 밝힌다.
 */

/** 클립보드 복사 — https가 아닌 환경(로컬 미리보기)에서도 되도록 예비 경로를 둔다. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 권한 거부·비보안 컨텍스트 — 아래 예비 경로로 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = "복사",
  small = false,
  disabled = false,
  className = "",
}: {
  text: string;
  label?: string;
  small?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const onClick = async () => {
    const ok = await copyToClipboard(text);
    setState(ok ? "done" : "failed");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  };

  const tone =
    state === "done"
      ? "border-jade/50 bg-jade-soft text-jade"
      : state === "failed"
        ? "border-clay/40 bg-[#fbf3ef] text-clay"
        : "border-line bg-white text-ink-soft hover:border-brand/45 hover:text-brand";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !text}
      data-copy-state={state}
      className={
        `inline-flex shrink-0 items-center justify-center gap-1 rounded-full border font-semibold transition-colors disabled:opacity-40 ` +
        (small ? "min-h-[32px] px-2.5 text-[12px] " : "min-h-[40px] px-3.5 text-[12.5px] ") +
        tone +
        " " +
        className
      }
    >
      <svg viewBox="0 0 24 24" width={small ? 13 : 15} height={small ? 13 : 15} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === "done" ? (
          <path d="M4.8 12.6l4.6 4.6L19.4 7.2" />
        ) : (
          <>
            <rect x="8.6" y="8.6" width="11" height="11" rx="2" />
            <path d="M15.4 8.6V6.4a2 2 0 0 0-1.9-2H6.4a2 2 0 0 0-2 2v7.1a2 2 0 0 0 1.9 1.9h2.3" />
          </>
        )}
      </svg>
      {state === "done" ? "복사됨" : state === "failed" ? "직접 선택" : label}
    </button>
  );
}

export function UtilShell({
  id,
  title,
  subtitle,
  note,
  badge,
  children,
}: {
  /** 화면 식별자 — 실행 화면·검수에서 이 도구를 집어내는 값 */
  id: string;
  title: string;
  subtitle: string;
  /** 도구별 한 줄 안내 (없으면 기본 문장) */
  note?: ReactNode;
  /**
   * 오른쪽 위 표식. 기본은 '서버 미전송'.
   * 외부 서비스로 값이 나가는 도구(URL 단축처럼)는 여기에 사실대로 적는다.
   */
  badge?: { label: string; tone?: "jade" | "amber" };
  children: ReactNode;
}) {
  const badgeTone = badge?.tone ?? "jade";
  return (
    <div className="rounded-2xl border border-line bg-[#fbfbf8] p-4 md:p-7" data-util={id}>
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.01em] text-ink-faint">무료 유틸리티</p>
          <h3 className="mt-1 text-[16.5px] font-bold tracking-[-0.03em] text-ink">{title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{subtitle}</p>
        </div>
        <span
          className={
            "chip !min-h-[26px] !border-transparent !px-2.5 !text-[12px] " +
            (badgeTone === "amber"
              ? "!bg-[#f7efdd] !text-[#7a5312]"
              : "!bg-jade-soft !text-jade")
          }
          data-util-badge={badgeTone}
        >
          {badge?.label ?? "서버 미전송"}
        </span>
      </div>
      <p className="border-b border-line-soft py-2.5 text-[12px] leading-relaxed text-ink-muted">
        {note ?? (
          <>
            입력한 내용은 <strong className="font-semibold text-ink">이 브라우저 안에서만</strong> 처리됩니다. 서버로
            보내지 않고 저장하지도 않으며, 새로 고치면 처음 예시로 돌아갑니다.
          </>
        )}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({
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
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5 border-b border-line pb-2.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={
              "min-h-[40px] rounded-lg px-3 text-[13px] font-semibold transition-colors " +
              (active
                ? "bg-brand text-white"
                : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] leading-[1.7] text-ink outline-none transition-colors placeholder:text-ink-faint/80 focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 9,
  mono = false,
  hint,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  hint?: ReactNode;
  right?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {right}
      </div>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={fieldBase + (mono ? " mt-1.5 font-mono text-[12.5px]" : " mt-1.5")}
      />
      {hint && <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "date" | "number" | "url";
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={fieldBase + (mono ? " mt-1.5 font-mono text-[12.5px]" : " mt-1.5")}
      />
    </div>
  );
}

/** 결과 숫자 한 칸 — 글자수가 많아지지 않게 라벨/값/보조 세 줄로 고정 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "brand" | "jade";
}) {
  const cls = tone === "brand" ? "text-brand" : tone === "jade" ? "text-jade" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3">
      <p className="text-[12px] font-semibold text-ink-faint">{label}</p>
      <p className={`mt-1 text-[19px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{sub}</p>}
    </div>
  );
}

/** 결과 본문 상자 — 고정폭 글씨와 줄바꿈을 그대로 보여 준다 */
export function OutputBox({
  text,
  empty = "결과가 여기에 나옵니다.",
  mono = true,
  maxHeight = 320,
}: {
  text: string;
  empty?: string;
  mono?: boolean;
  maxHeight?: number;
}) {
  return (
    <div
      className="overflow-auto rounded-xl border border-line bg-white px-3 py-2.5 text-[12.5px] leading-[1.75] text-ink"
      style={{ maxHeight }}
      data-output-box
    >
      {text ? (
        <pre className={"whitespace-pre-wrap break-words " + (mono ? "font-mono" : "")}>{text}</pre>
      ) : (
        <p className="text-ink-faint">{empty}</p>
      )}
    </div>
  );
}
