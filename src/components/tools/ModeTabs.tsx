import { useEffect, useState } from "react";

/**
 * 통합 도구의 화면 탭 (v8.8.0).
 *
 * v8.8.0에서 도구 11종을 8개 화면으로 흡수했다. 흡수된 도구의 기능은 없애지 않고
 * 이 탭 안으로 옮겼다 — `image-compress`의 '리사이즈', `pension-draw`의 '개시일'처럼.
 *
 * · `?mode=<값>` — 옛 도구 주소(`/apps/image-resize/`)가 리다이렉트로 넘기는 값이다.
 *   첫 화면에서 읽어 그 탭을 열고, 탭을 바꾸면 주소의 `mode`도 같이 바꾼다(북마크·공유 유지).
 * · 값을 모르면 첫 탭으로 연다(주소가 깨져도 화면은 열린다).
 */

export type ModeOption<T extends string> = { value: T; label: string };

export function useMode<T extends string>(
  fallback: T,
  allowed: readonly T[],
): readonly [T, (v: T) => void] {
  const [mode, setMode] = useState<T>(fallback);

  useEffect(() => {
    try {
      const wanted = new URLSearchParams(window.location.search).get("mode");
      if (wanted && (allowed as readonly string[]).includes(wanted)) setMode(wanted as T);
    } catch {
      /* 주소를 읽지 못하면 첫 탭 그대로 */
    }
    // 첫 진입에서만 주소를 읽는다 — 탭을 바꿀 때마다 되돌리지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (v: T) => {
    setMode(v);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", v);
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* 주소 갱신 실패는 화면 동작과 무관하다 */
    }
  };

  return [mode, update] as const;
}

export function ModeTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  note,
}: {
  label: string;
  value: T;
  options: ModeOption<T>[];
  onChange: (v: T) => void;
  note?: string;
}) {
  return (
    <div className="mb-3" data-tool-modes>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-white p-1.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-mode-tab={o.value}
              data-on={active ? "1" : "0"}
              onClick={() => onChange(o.value)}
              className={
                "min-h-[44px] flex-1 basis-[calc(50%-0.375rem)] rounded-lg px-3 text-[13px] font-semibold transition-colors sm:basis-0 " +
                (active
                  ? "bg-brand text-white shadow-[0_6px_16px_-12px_rgba(15,53,80,0.9)]"
                  : "text-ink-soft hover:bg-paper-deep hover:text-brand")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {note && <p className="mt-1.5 px-1 text-[12px] leading-relaxed text-ink-faint">{note}</p>}
    </div>
  );
}
