import { useEffect, useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";

/**
 * 글로벌 증시 개장시간 · 세계시계.
 *
 * 각 거래소의 현지 시각과 지금이 어느 구간(프리·정규·애프터·휴장)인지, 다음 경계(개장·마감)까지
 * 남은 시간을 1초마다 다시 센다.
 *
 * 서머타임: 시간대 이름(IANA)만 쓰고 오프셋을 직접 더하지 않는다. 브라우저의 Intl이 그 시점의
 * 표준시·서머타임을 알고 있으므로, 미국·영국의 3월·11월 전환이 저절로 반영된다. 화면에는 지금이
 * 표준시인지 서머타임인지도 함께 적어, 숫자가 왜 바뀌었는지 확인할 수 있게 했다.
 *
 * 정직하게 적어 둘 것: 정규장 시간만 반영하고 휴장일(설·추석·추수감사절·크리스마스 등)은 반영하지
 * 않는다. 프리·애프터마켓 시간은 증권사마다 달라서 미국은 04:00·20:00(ET) 기준으로 적었다.
 */

type SessionKind = "pre" | "regular" | "post";

type Session = { label: string; kind: SessionKind; start: number; end: number };

type Market = {
  id: string;
  name: string;
  place: string;
  zone: string;
  zoneShort: string;
  /** 서머타임이 없을 때의 UTC 오프셋(분) — 지금 오프셋과 다르면 서머타임 중 */
  standardOffset: number;
  sessions: Session[];
  note: string;
  regularRange: string;
};

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const MARKETS: Market[] = [
  {
    id: "krx",
    name: "한국거래소",
    place: "KRX",
    zone: "Asia/Seoul",
    zoneShort: "KST",
    standardOffset: 540,
    sessions: [{ label: "정규장", kind: "regular", start: 9 * 60, end: 15 * 60 + 30 }],
    regularRange: "09:00–15:30",
    note: "정규장만 표시합니다. 시간외 단일가·장전 시간외는 넣지 않았습니다.",
  },
  {
    id: "us",
    name: "뉴욕증권거래소·나스닥",
    place: "NYSE · NASDAQ",
    zone: "America/New_York",
    zoneShort: "ET",
    standardOffset: -300,
    sessions: [
      { label: "프리마켓", kind: "pre", start: 4 * 60, end: 9 * 60 + 30 },
      { label: "정규장", kind: "regular", start: 9 * 60 + 30, end: 16 * 60 },
      { label: "애프터마켓", kind: "post", start: 16 * 60, end: 20 * 60 },
    ],
    regularRange: "09:30–16:00",
    note: "프리·애프터마켓은 증권사마다 시간이 다릅니다. 여기서는 04:00–20:00(ET) 기준입니다.",
  },
  {
    id: "jp",
    name: "도쿄증권거래소",
    place: "TSE",
    zone: "Asia/Tokyo",
    zoneShort: "JST",
    standardOffset: 540,
    sessions: [
      { label: "전장", kind: "regular", start: 9 * 60, end: 11 * 60 + 30 },
      { label: "후장", kind: "regular", start: 12 * 60 + 30, end: 15 * 60 + 30 },
    ],
    regularRange: "09:00–11:30 · 12:30–15:30",
    note: "2024년 11월부터 후장 마감이 15:30으로 늘었습니다. 11:30–12:30은 점심 휴장입니다.",
  },
  {
    id: "lse",
    name: "런던증권거래소",
    place: "LSE",
    zone: "Europe/London",
    zoneShort: "BST/GMT",
    standardOffset: 0,
    sessions: [{ label: "정규장", kind: "regular", start: 8 * 60, end: 16 * 60 + 30 }],
    regularRange: "08:00–16:30",
    note: "연속매매 기준입니다. 개장 전·마감 후 경매 구간은 넣지 않았습니다.",
  },
  {
    id: "eu",
    name: "유로넥스트 파리",
    place: "Euronext",
    zone: "Europe/Paris",
    zoneShort: "CET",
    standardOffset: 60,
    sessions: [{ label: "정규장", kind: "regular", start: 9 * 60, end: 17 * 60 + 30 }],
    regularRange: "09:00–17:30",
    note: "파리 현지 연속매매 기준입니다.",
  },
];

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** 시간대의 벽시계 값을 뽑는다 — DST가 걸린 시점의 값이 그대로 나온다 */
function zonedParts(ts: number, zone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const wd = get("weekday");
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")) % 24,
    mi: Number(get("minute")),
    s: Number(get("second")),
    dow: idx < 0 ? 0 : idx,
  };
}

/** 그 시점의 UTC 오프셋(분) — 벽시계를 UTC로 되돌려 차이를 잰다 */
function offsetMinutes(ts: number, zone: string): number {
  const p = zonedParts(ts, zone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - ts) / 60000);
}

/** 그 시간대의 '오늘 몇 분'을 실제 시각(epoch ms)으로 바꾼다. 서머타임 경계는 한 번 더 맞춘다 */
function wallToEpoch(day: { y: number; m: number; d: number }, minutes: number, zone: string): number {
  const base = Date.UTC(day.y, day.m - 1, day.d, 0, 0, 0) + minutes * 60000;
  let off = offsetMinutes(base, zone);
  let ts = base - off * 60000;
  const off2 = offsetMinutes(ts, zone);
  if (off2 !== off) {
    off = off2;
    ts = base - off * 60000;
  }
  return ts;
}

const addDays = (day: { y: number; m: number; d: number }, delta: number) => {
  const dt = new Date(Date.UTC(day.y, day.m - 1, day.d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

const kindLabel = (s: Session) => (s.kind === "pre" ? "프리마켓" : s.kind === "post" ? "애프터마켓" : s.label);
const isWeekend = (dow: number) => dow === 0 || dow === 6;

type State = {
  time: string;
  dateLine: string;
  offsetMin: number;
  dst: boolean;
  status: string;
  statusTone: "live" | "soft" | "idle";
  nextLabel: string;
  nextAt: number;
  nextIn: number;
};

function evaluate(market: Market, ts: number): State {
  const p = zonedParts(ts, market.zone);
  const minutesNow = p.h * 60 + p.mi + p.s / 60;
  const off = offsetMinutes(ts, market.zone);
  const dst = off !== market.standardOffset;
  const time = `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}:${String(p.s).padStart(2, "0")}`;
  const dateLine = `${p.m}/${p.d} (${WEEKDAY[p.dow]})`;

  const first = market.sessions[0];

  /* 주말 — 다음 월요일 첫 구간까지 */
  if (isWeekend(p.dow)) {
    let day = { y: p.y, m: p.m, d: p.d };
    let guard = 0;
    do {
      day = addDays(day, 1);
      guard += 1;
    } while (isWeekend(new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()) && guard < 8);
    const at = wallToEpoch(day, first.start, market.zone);
    return {
      time,
      dateLine,
      offsetMin: off,
      dst,
      status: "주말 휴장",
      statusTone: "idle",
      nextLabel: `다음 거래일 ${kindLabel(first)} 시작까지`,
      nextAt: at,
      nextIn: at - ts,
    };
  }

  const current = market.sessions.find((s) => minutesNow >= s.start && minutesNow < s.end);
  if (current) {
    const at = wallToEpoch(p, current.end, market.zone);
    return {
      time,
      dateLine,
      offsetMin: off,
      dst,
      status: `${kindLabel(current)} 진행 중`,
      statusTone: current.kind === "regular" ? "live" : "soft",
      nextLabel: `${kindLabel(current)} 마감까지`,
      nextAt: at,
      nextIn: at - ts,
    };
  }

  const upcoming = market.sessions.find((s) => s.start > minutesNow);
  if (upcoming) {
    const at = wallToEpoch(p, upcoming.start, market.zone);
    return {
      time,
      dateLine,
      offsetMin: off,
      dst,
      status: minutesNow < first.start ? "개장 전" : "장 사이 휴장",
      statusTone: "idle",
      nextLabel: `${kindLabel(upcoming)} 시작까지`,
      nextAt: at,
      nextIn: at - ts,
    };
  }

  /* 오늘 구간이 모두 끝났다 — 다음 거래일 첫 구간까지 */
  let day = { y: p.y, m: p.m, d: p.d };
  let guard = 0;
  do {
    day = addDays(day, 1);
    guard += 1;
  } while (isWeekend(new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()) && guard < 8);
  const at = wallToEpoch(day, first.start, market.zone);
  return {
    time,
    dateLine,
    offsetMin: off,
    dst,
    status: "마감",
    statusTone: "idle",
    nextLabel: `다음 거래일 ${kindLabel(first)} 시작까지`,
    nextAt: at,
    nextIn: at - ts,
  };
}

/** 남은 시간 — 하루가 넘으면 시·분·초까지는 읽지 않게 줄인다 */
function countdown(ms: number): string {
  if (ms <= 0) return "곧 시작";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}일 ${h}시간 ${m}분`;
  if (h > 0) return `${h}시간 ${m}분 ${String(s).padStart(2, "0")}초`;
  if (m > 0) return `${m}분 ${String(s).padStart(2, "0")}초`;
  return `${s}초`;
}

const seoulClock = (ts: number) => {
  const p = zonedParts(ts, "Asia/Seoul");
  return `${p.m}/${p.d} (${WEEKDAY[p.dow]}) ${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}:${String(p.s).padStart(2, "0")}`;
};

/** 한국 시간으로 다음 경계를 적는다 — 국내에서 보는 사람에게는 이쪽이 읽기 쉽다 */
const seoulAt = (ts: number) => {
  const p = zonedParts(ts, "Asia/Seoul");
  return `${WEEKDAY[p.dow]} ${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
};

export default function MarketWorldClock() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => (now === null ? [] : MARKETS.map((m) => ({ market: m, state: evaluate(m, now) }))), [now]);

  return (
    <UtilShell
      id="market-world-clock"
      title="글로벌 증시 개장시간 · 세계시계"
      subtitle="한국·미국·일본·영국·유럽의 지금 시각과 개장·마감까지"
      note={
        <>
          거래소 현지 시각을 브라우저에서 직접 계산합니다. 서버에 묻지 않으므로 <strong className="font-semibold text-ink">서머타임(미국 3월·11월, 영국 3월·10월)도 자동</strong>으로
          반영됩니다. 휴장일(설·추석·추수감사절·크리스마스 등)은 반영하지 않습니다.
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <p className="text-[12px] font-semibold text-ink-faint">지금 한국 시간</p>
          <p data-clock-seoul className="font-mono text-[13px] font-bold tabular-nums text-ink">
            {now === null ? "—" : seoulClock(now)}
          </p>
        </div>

        {now === null && (
          <p className="text-[12.5px] text-ink-faint">시계를 맞추는 중…</p>
        )}

        <div className="space-y-2">
          {rows.map(({ market, state }) => {
            const statusClass =
              state.statusTone === "live"
                ? "bg-jade-soft text-jade"
                : state.statusTone === "soft"
                  ? "bg-[#f7efdd] text-[#7a5312]"
                  : "bg-[#eef1f4] text-ink-muted";
            return (
              <div
                key={market.id}
                data-market-row={market.id}
                className="rounded-xl border border-line bg-white px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold tracking-[-0.02em] text-ink">
                      {market.name}
                      <span className="ml-1.5 text-[11.5px] font-semibold text-ink-faint">{market.place}</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-faint">
                      {market.zoneShort} · {state.dateLine}
                      {state.dst ? " · 서머타임 중" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p data-market-time className="font-mono text-[19px] font-extrabold tabular-nums leading-none tracking-[-0.02em] text-ink">
                      {state.time}
                    </p>
                    <span data-market-status className={"mt-1 inline-block rounded-full px-2 py-[3px] text-[11px] font-bold " + statusClass}>
                      {state.status}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-line-soft pt-2">
                  <div>
                    <p className="text-[11.5px] font-semibold text-ink-faint">{state.nextLabel}</p>
                    <p data-market-countdown className="text-[15px] font-extrabold tabular-nums tracking-[-0.01em] text-brand">
                      {countdown(state.nextIn)}
                    </p>
                  </div>
                  <p className="text-[11.5px] text-ink-faint">
                    한국 시간 {seoulAt(state.nextAt)}
                  </p>
                </div>

                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                  정규장 {market.regularRange} ({market.zoneShort}) · {market.note}
                </p>
              </div>
            );
          })}
        </div>

        {rows.length > 0 && (
          <div className="rounded-xl border border-line bg-[#fbfbf8] px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-muted">
            <p>
              시간은 모두 그 거래소의 <strong className="font-semibold text-ink">현지 시각</strong>입니다. 한국 시간은 각 줄
              아래 오른쪽에 적었습니다.
            </p>
            <p className="mt-1">
              계산 기준 — KRX {hm(9 * 60)}–{hm(15 * 60 + 30)} · NYSE/NASDAQ 프리 {hm(4 * 60)}–{hm(9 * 60 + 30)} / 정규{" "}
              {hm(9 * 60 + 30)}–{hm(16 * 60)} / 애프터 {hm(16 * 60)}–{hm(20 * 60)} · TSE {hm(9 * 60)}–{hm(11 * 60 + 30)},{" "}
              {hm(12 * 60 + 30)}–{hm(15 * 60 + 30)} · LSE {hm(8 * 60)}–{hm(16 * 60 + 30)} · Euronext {hm(9 * 60)}–
              {hm(17 * 60 + 30)}
            </p>
            <p className="mt-1">
              시장 휴장일과 임시 휴장은 반영하지 않습니다. 실제 주문 전에는 증권사 공지를 확인하세요.
            </p>
          </div>
        )}
      </div>
    </UtilShell>
  );
}
