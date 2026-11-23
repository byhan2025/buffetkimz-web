import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarItem, CalendarTag } from "../data/calendar";
import { withBase } from "@/config/site";
import { tagStyle } from "../data/calendar";
import { ddayOf, isUpcoming } from "../lib/dday";

const TAGS: CalendarTag[] = ["보험", "연금", "건보", "절세"];

type Props = {
  items: CalendarItem[];
  initialMonth: number;
  note: string;
  /** 사이트 기준일 (YYYY-MM-DD) — D-Day는 이 날짜로 계산한다 */
  todayIso?: string;
};

/** 뱃지 색 — D-3~D-6 주황, D-2 이하·오늘은 빨강 대신 진한 회색 */
const ddayClass: Record<string, string> = {
  later: "dday dday--later",
  soon: "dday dday--soon",
  near: "dday dday--near",
  today: "dday dday--near",
  past: "dday dday--later",
};

export default function CalendarBoard({ items, initialMonth, note, todayIso }: Props) {
  const today = useMemo(() => (todayIso ? new Date(`${todayIso}T09:00:00+09:00`) : new Date()), [todayIso]);
  /** 화면 표기 — 사이트 전체와 같은 점 표기 (2026. 11. 21.) */
  const todayLabel = useMemo(
    () => (todayIso ? todayIso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1. $2. $3.") : "오늘"),
    [todayIso]
  );
  /** 다가오는 기한 — 기한일이 있는 항목만, 가까운 순서로 3건 */
  const upcoming = useMemo(
    () =>
      items
        .filter((i) => i.dueDate && isUpcoming(i.dueDate, today))
        .map((i) => ({ item: i, dday: ddayOf(i.dueDate as string, today) }))
        .sort((a, b) => a.dday.days - b.dday.days)
        .slice(0, 3),
    [items, today]
  );
  const [month, setMonth] = useState(initialMonth);
  const [tag, setTag] = useState<CalendarTag | "전체">("전체");
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /* /calendar#m11 로 들어오면 그 달을 연다. */
  useEffect(() => {
    const hash = window.location.hash.match(/^#m(\d{1,2})$/);
    if (hash) {
      const m = Number(hash[1]);
      if (m >= 1 && m <= 12) setMonth(m);
    }
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [month]);

  const monthItems = useMemo(
    () => items.filter((i) => i.month === month && (tag === "전체" || i.tag === tag)),
    [items, month, tag]
  );

  /**
   * v8.9.0 '이번 달' 맥락(감사 S7) — 51건이 12개월에 고르게 펼쳐져 있어 지금 할 일이 보이지 않았다.
   *  · 상단에 이번 달 건수와 남은/지난 수를 고정으로 두고,
   *  · 이번 달 목록에서 기한이 지난 항목은 흐리게, 남은 항목은 그대로 읽힌다.
   */
  const currentMonth = today.getMonth() + 1;
  const thisMonthItems = useMemo(() => items.filter((i) => i.month === currentMonth), [items, currentMonth]);
  const thisMonthPast = thisMonthItems.filter((i) => i.dueDate && ddayOf(i.dueDate, today).tone === "past").length;
  const thisMonthLeft = thisMonthItems.length - thisMonthPast;
  const nextDue = upcoming[0];
  const monthTotal = items.filter((i) => i.month === month).length;

  const pick = (m: number) => {
    setMonth(m);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#m${m}`);
    }
  };

  return (
    <div>
      {/* 이번 달 — 지금 할 일이 먼저 보이게 */}
      <div className="mb-3 rounded-xl border border-line bg-white px-3 py-3" data-this-month>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold tracking-[0.16em] text-brand-deep">이번 달 일정</p>
          <p className="mono text-[11.5px] text-ink-faint">
            {currentMonth}월 · {thisMonthItems.length}건
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[13px] font-semibold text-ink">남은 {thisMonthLeft}건</span>
          {thisMonthPast > 0 && (
            <span className="text-[12px] text-ink-faint">지난 {thisMonthPast}건은 흐리게 표시</span>
          )}
          {nextDue && (
            <span className="text-[12px] text-ink-muted">
              가장 가까운 기한 · <b className="font-semibold text-ink">{nextDue.item.title}</b>{" "}
              <span className="mono text-[11.5px] text-ink-faint">{nextDue.dday.label}</span>
            </span>
          )}
          {month !== currentMonth && (
            <button
              type="button"
              onClick={() => pick(currentMonth)}
              className="ml-auto inline-flex min-h-[36px] items-center text-[12.5px] font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4"
            >
              이번 달({currentMonth}월) 보기 →
            </button>
          )}
        </div>
      </div>

      {/* 다가오는 기한 — 허브와 같은 D-Day 함수를 쓴다 */}
      {upcoming.length > 0 && (
        <div className="mb-5 rounded-xl border border-line bg-white/60 px-3 py-2.5" data-upcoming>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold tracking-[0.16em] text-ink-faint">다가오는 기한</span>
            <span className="mono text-[11.5px] text-ink-faint">기준 {todayLabel}</span>
          </div>
          <ul className="mt-2 divide-y divide-line-soft">
            {upcoming.map(({ item, dday }) => (
              <li key={`up-${item.month}-${item.title}`}>
                <button
                  type="button"
                  onClick={() => pick(item.month)}
                  className="flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left"
                >
                  <span className={ddayClass[dday.tone]} aria-label={dday.aria}>
                    {dday.label}
                  </span>
                  <span className="mono shrink-0 text-[11.5px] text-ink-faint">{dday.dateLabel}</span>
                  <span className="clamp-1 min-w-0 text-[13px] font-semibold text-ink">{item.title}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-ink-faint">{item.month}월 →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 월 선택 */}
      <div className="relative border-y border-line">
        <div className="no-scrollbar overflow-x-auto">
          <div ref={stripRef} role="tablist" aria-label="월 선택" className="flex min-w-max">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const active = m === month;
              const count = items.filter((it) => it.month === m).length;
              /* 지난 달은 흐리게, 이번 달은 위쪽에 표시선을 둔다 (v8.9.0 · 감사 S7) */
              const pastMonth = m < currentMonth;
              const thisMonth = m === currentMonth;
              return (
                <button
                  key={m}
                  ref={active ? activeRef : undefined}
                  role="tab"
                  aria-selected={active}
                  aria-current={thisMonth ? "date" : undefined}
                  aria-controls="calendar-panel"
                  onClick={() => pick(m)}
                  className={`relative flex min-h-[52px] w-[62px] flex-col items-center justify-center border-r border-line-soft pt-1 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-ink text-paper"
                      : pastMonth
                        ? "text-ink-faint hover:bg-paper-deep hover:text-ink-muted"
                        : "text-ink-muted hover:bg-paper-deep hover:text-ink"
                  } ${thisMonth && !active ? "shadow-[inset_0_2px_0_0_var(--color-brand)]" : ""}`}
                >
                  <span className="serif text-[16px] leading-none">{m}</span>
                  <span className={`mt-1 text-[12px] tabular-nums ${active ? "text-paper/70" : "text-ink-faint"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 분류 */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          {(["전체", ...TAGS] as const).map((t) => {
            const active = t === tag;
            const count = t === "전체" ? monthTotal : items.filter((i) => i.month === month && i.tag === t).length;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setTag(t as CalendarTag | "전체")}
                className={`inline-flex min-h-[44px] items-center gap-1.5 text-[13px] transition-colors ${
                  active ? "font-bold text-ink underline underline-offset-4" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t}
                <span className="text-[12px] tabular-nums text-ink-faint">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-ink-faint">
          {month}월 {monthItems.length}건
        </p>
      </div>

      {/* 목록 */}
      <div id="calendar-panel" role="tabpanel" className="mt-3">
        {monthItems.length === 0 ? (
          <p className="border-t border-line py-12 text-center text-[13px] leading-[1.7] text-ink-faint">
            이 달에는 선택한 분류의 일정이 없습니다.
            <br />
            분류를 <strong className="font-semibold text-ink-soft">전체</strong>로 바꾸거나 다른 달을 골라 보세요.
          </p>
        ) : (
          <ul className="border-t border-ink">
            {monthItems.map((item, i) => {
              const s = tagStyle[item.tag];
              const past = Boolean(item.dueDate && ddayOf(item.dueDate, today).tone === "past");
              return (
                <li
                  key={`${item.month}-${i}`}
                  className={`grid gap-2 border-b border-line py-4 sm:grid-cols-[96px_1fr] sm:gap-6 ${
                    past ? "opacity-55" : ""
                  }`}
                  data-past={past ? "true" : undefined}
                >
                  <div>
                    <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-clay">
                      {item.key && <span className="inline-block h-1.5 w-1.5 shrink-0 bg-clay" aria-hidden="true" />}
                      {item.when}
                    </p>
                    {item.dueDate && isUpcoming(item.dueDate, today) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5" data-dday>
                        <span className={ddayClass[ddayOf(item.dueDate, today).tone]} aria-label={ddayOf(item.dueDate, today).aria}>
                          {ddayOf(item.dueDate, today).label}
                        </span>
                        <span className="mono text-[11px] text-ink-faint">{ddayOf(item.dueDate, today).dateLabel}</span>
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot ?? "bg-ink-faint"}`} aria-hidden="true" />
                      {item.tag} · {item.kind}
                      {past && <span className="ml-1 rounded-full bg-paper-deep px-1.5 py-0.5 text-[10.5px]">지난 일정</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-[1.72] text-ink-muted">{item.body}</p>
                    <p className="mt-2 flex gap-2 text-[12.5px] leading-[1.7] text-ink-soft">
                      <span className="shrink-0 text-[12px] font-semibold text-jade">할 일</span>
                      {item.action}
                    </p>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex min-h-[44px] items-center text-[12px] text-ink-faint underline decoration-line underline-offset-2 hover:text-brand-deep"
                      >
                        출처: {item.source.length > 34 ? item.source.slice(0, 34) + "…" : item.source}
                      </a>
                    ) : (
                      <p className="mt-1.5 text-[12px] text-ink-faint">출처: {item.source}</p>
                    )}
                    {item.toolHref && (
                      <a
                        href={withBase(item.toolHref)}
                        className="mt-1 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4"
                        data-calendar-tool={item.toolHref}
                      >
                        {item.toolLabel ?? "관련 도구 열기"} →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-5 border-t border-line pt-3 text-[12px] leading-[1.75] text-ink-muted">{note}</p>
    </div>
  );
}
