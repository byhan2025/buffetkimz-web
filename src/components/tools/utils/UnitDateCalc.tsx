import { useEffect, useMemo, useState } from "react";
import { site } from "@/config/site";
import { Tabs, TextInput, UtilShell } from "./UtilShell";
import { useMode } from "../ModeTabs";
import MovingDday from "./MovingDday";

/**
 * 날짜 계산 + 단위 변환.
 *
 * 날짜는 시간대 영향을 받지 않도록 UTC 자정 기준으로 계산한다(입력은 'YYYY-MM-DD' 날짜만).
 * 영업일은 토·일만 빼고 센다 — 공휴일·임시공휴일은 넣지 않았으므로 실제 영업일과 다를 수 있다.
 */

type Mode = "date" | "unit" | "moving";

/** v8.8.0 — 옛 `/apps/moving-dday/` 주소가 `?mode=moving`으로 이 탭을 연다. */
const DATE_MODES = ["date", "unit", "moving"] as const;

const DAY = 86400000;

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const label = (d: Date) => `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

function countWeekend(start: Date, end: Date): number {
  if (end < start) return 0;
  const total = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  /* 7일 주기로 한 번에 세고, 남는 날만 훑는다 — 100년 범위도 순식간 */
  const weeks = Math.floor(total / 7);
  let weekend = weeks * 2;
  const rest = total % 7;
  for (let i = 0; i < rest; i++) {
    const day = (start.getUTCDay() + weeks * 7 + i) % 7;
    if (day === 0 || day === 6) weekend += 1;
  }
  return weekend;
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return Number(v.toFixed(digits)).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

const parseNumber = (s: string): number | null => {
  const clean = s.replace(/,/g, "").replace(/\s/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

type RowDef = { key: string; title: string; a: { label: string; unit: string }; b: { label: string; unit: string; factor: number } };

const UNITS: RowDef[] = [
  {
    key: "pyeong",
    title: "넓이 — 평 ↔ ㎡",
    a: { label: "평", unit: "평" },
    b: { label: "제곱미터", unit: "㎡", factor: 400 / 121 },
  },
  {
    key: "inch",
    title: "길이 — 인치 ↔ cm",
    a: { label: "인치", unit: "in" },
    b: { label: "센티미터", unit: "cm", factor: 2.54 },
  },
  {
    key: "data",
    title: "용량 — MB ↔ GB",
    a: { label: "메가바이트", unit: "MB" },
    b: { label: "기가바이트", unit: "GB", factor: 1 / 1024 },
  },
];

function UnitRow({ def }: { def: RowDef }) {
  const [a, setA] = useState("24");
  const [b, setB] = useState(() => formatNumber(24 * def.b.factor));

  const onA = (v: string) => {
    setA(v);
    const n = parseNumber(v);
    setB(n === null ? "" : formatNumber(n * def.b.factor));
  };
  const onB = (v: string) => {
    setB(v);
    const n = parseNumber(v);
    setA(n === null ? "" : formatNumber(n / def.b.factor));
  };

  return (
    <div className="rounded-xl border border-line bg-white p-3.5" data-unit={def.key}>
      <p className="text-[13px] font-bold text-ink">{def.title}</p>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <label className="text-[11.5px] font-semibold text-ink-faint" htmlFor={`u-${def.key}-a`}>
            {def.a.label} ({def.a.unit})
          </label>
          <input
            id={`u-${def.key}-a`}
            value={a}
            onChange={(e) => onA(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-right text-[15px] font-bold tabular-nums text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <span className="mt-5 text-[15px] font-bold text-ink-faint">=</span>
        <div>
          <label className="text-[11.5px] font-semibold text-ink-faint" htmlFor={`u-${def.key}-b`}>
            {def.b.label} ({def.b.unit})
          </label>
          <input
            id={`u-${def.key}-b`}
            value={b}
            onChange={(e) => onB(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-brand/30 bg-[#f6fbf9] px-2.5 py-2 text-right text-[15px] font-bold tabular-nums text-brand-deep outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
          />
        </div>
      </div>
    </div>
  );
}

export default function UnitDateCalc() {
  const [mode, setMode] = useMode<Mode>("date", DATE_MODES);
  const [today, setToday] = useState<Date>(() => new Date(site.today));
  const [start, setStart] = useState(iso(new Date(site.today)));
  const [end, setEnd] = useState(() => iso(addDays(new Date(site.today), 100)));

  useEffect(() => {
    const now = new Date();
    setToday(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }, []);

  const calc = useMemo(() => {
    const s = parseDate(start);
    const e = parseDate(end);
    if (!s || !e) return null;
    const from = s <= e ? s : e;
    const to = s <= e ? e : s;
    const inclusive = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
    const weekend = countWeekend(from, to);
    const diff = Math.round((e.getTime() - s.getTime()) / DAY);
    const toToday = Math.round((e.getTime() - today.getTime()) / DAY);
    return {
      s,
      e,
      swapped: s > e,
      diff,
      inclusive,
      weekend,
      weekday: inclusive - weekend,
      toToday,
      dday: toToday === 0 ? "D-DAY" : toToday > 0 ? `D-${toToday.toLocaleString("ko-KR")}` : `D+${Math.abs(toToday).toLocaleString("ko-KR")}`,
    };
  }, [start, end, today]);

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  return (
    <UtilShell
      id="unit-date-calc"
      title="날짜 계산 · 단위 변환"
      subtitle="두 날짜 사이 일수와 영업일, 이사 D-Day 일정을 세고, 평·인치·용량을 바로 바꿉니다."
      note={
        <>
          날짜와 숫자는 <strong className="font-semibold text-ink">이 브라우저에서만</strong> 계산됩니다. 저장하지
          않습니다.
        </>
      }
    >
      <Tabs
        label="계산 종류"
        value={mode}
        onChange={setMode}
        options={[
          { value: "date", label: "날짜 계산" },
          { value: "unit", label: "단위 변환" },
          { value: "moving", label: "이사 D-Day" },
        ]}
      />

      {mode === "moving" ? (
        <div className="mt-3" data-moving-pane>
          <MovingDday embedded />
        </div>
      ) : mode === "date" ? (
        <div className="mt-3" data-date-pane>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="시작일" type="date" value={start} onChange={setStart} />
            <TextInput label="종료일" type="date" value={end} onChange={setEnd} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "30일 뒤", n: 30 },
              { label: "100일 뒤", n: 100 },
              { label: "1년 뒤", n: 365 },
              { label: "오늘", n: 0 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setStart(iso(today));
                  setEnd(iso(addDays(today, p.n)));
                }}
                className="min-h-[36px] rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
              >
                오늘부터 {p.label}
              </button>
            ))}
          </div>

          {!calc ? (
            <p className="mt-3 rounded-xl border border-[#e8d3c6] bg-[#fbf3ef] px-3.5 py-3 text-[12.5px] font-semibold text-[#8a4a2e]">
              두 날짜를 모두 골라 주세요.
            </p>
          ) : (
            <>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3" data-date-stats>
                <div className="rounded-xl border border-brand/25 bg-[#f4f8fb] px-3.5 py-3">
                  <p className="text-[12px] font-semibold text-ink-faint">D-Day (종료일까지)</p>
                  <p className="mono mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-brand" data-dday>
                    {calc.dday}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    오늘 {label(today)} 기준 {calc.toToday === 0 ? "· 바로 오늘" : calc.toToday > 0 ? "" : "· 지난 날짜"}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white px-3.5 py-3">
                  <p className="text-[12px] font-semibold text-ink-faint">두 날짜 사이</p>
                  <p className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink" data-days>
                    {calc.diff.toLocaleString("ko-KR")}일
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    시작일과 종료일을 모두 세면 {calc.inclusive.toLocaleString("ko-KR")}일
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white px-3.5 py-3">
                  <p className="text-[12px] font-semibold text-ink-faint">주말 제외 영업일</p>
                  <p className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink" data-business>
                    {calc.weekday.toLocaleString("ko-KR")}일
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    주말 {calc.weekend.toLocaleString("ko-KR")}일 제외 · 공휴일 미반영
                  </p>
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-line bg-white px-3.5 py-3 text-[12.5px] leading-[1.8] text-ink-soft">
                <p className="text-[12px] font-semibold text-ink-faint">날짜 확인</p>
                <p className="mt-1">
                  시작 <strong className="font-semibold text-ink">{label(calc.s)}</strong> · 종료{" "}
                  <strong className="font-semibold text-ink">{label(calc.e)}</strong>
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {startDate && endDate && calc.swapped
                    ? "종료일이 시작일보다 앞이라, 두 날짜를 바꿔서 셌습니다. 순서대로 입력하면 D-Day 부호도 뒤집힙니다."
                    : "일수는 시각을 빼고 날짜만 셉니다. 시작일 0시부터 종료일 0시까지의 날짜 차이입니다."}
                </p>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-muted">
                  <p className="font-semibold text-ink">주말 계산 방식</p>
                  <p className="mt-1">
                    토·일을 빼고 셉니다. 설·추석 연휴, 임시공휴일, 근로자의 날처럼 달력에 표시되는 쉬는 날은 넣지
                    않았으니, 계약·제출 기한처럼 정확해야 하는 날은 공휴일을 따로 확인하세요.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-muted">
                  <p className="font-semibold text-ink">D-Day 표기</p>
                  <p className="mt-1">
                    종료일이 오늘보다 뒤면 <span className="mono">D-100</span>, 앞이면 <span className="mono">D+5</span>,
                    같은 날이면 <span className="mono">D-DAY</span>입니다. 오늘 날짜는 이 기기의 날짜를 씁니다.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5" data-unit-pane>
          {UNITS.map((def) => (
            <UnitRow key={def.key} def={def} />
          ))}
          <div className="rounded-xl border border-line bg-white px-3.5 py-3 text-[12px] leading-[1.8] text-ink-muted">
            <p className="font-semibold text-ink">기준</p>
            <p className="mt-1">
              1평 = 400/121㎡ ≈ 3.3058㎡ · 1인치 = 2.54cm · 1GB = 1,024MB. 저장장치 제조사는 1GB를 1,000MB로 표기하기도
              해서, 같은 500GB 디스크가 컴퓨터에서는 465GB로 보입니다.
            </p>
            <p className="mt-1 text-ink-faint">
              참고: 10평 ≈ 33.06㎡ · 18평 ≈ 59.5㎡ · 24평 ≈ 79.34㎡ · 34평 ≈ 112.4㎡
            </p>
          </div>
        </div>
      )}
    </UtilShell>
  );
}
