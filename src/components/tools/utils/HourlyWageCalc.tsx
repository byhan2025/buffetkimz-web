import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Bar, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, Line, num, TableScroll } from "./fields-c";

/**
 * 시급 → 월 예상 급여 (주휴수당 포함).
 *
 *  · 2026년 최저임금 시간급 10,320원 (고용노동부 고시 제2025-47호, 2026. 1. 1. 시행).
 *    월 환산액 2,156,880원 = 209시간(주 40시간 + 유급주휴 8시간) × 10,320원.
 *  · 주휴수당: 1주 소정근로시간이 15시간 이상이고 소정근로일을 개근하면,
 *    (1주 소정근로시간 ÷ 40) × 8시간 × 시급 (근로기준법 제55조, 시행령 제30조).
 *  · 월 환산은 1년 365일 ÷ 7일 ÷ 12개월 = 4.345주를 쓴다.
 */

const MIN_WAGE_2026 = 10320;
const WEEKS_PER_MONTH = 4.345;

export default function HourlyWageCalc({ compact = false }: { compact?: boolean }) {
  const [wage, setWage] = useState(MIN_WAGE_2026);
  const [hours, setHours] = useState(8);
  const [days, setDays] = useState(5);
  const [attendance, setAttendance] = useState<"full" | "miss">("full");

  const calc = useMemo(() => {
    const weekHours = hours * days;
    const eligible = weekHours >= 15 && attendance === "full";
    const holidayHours = eligible ? Math.min(8, (weekHours / 40) * 8) : 0;
    const weekTotal = weekHours + holidayHours;
    const monthHours = Math.round(weekTotal * WEEKS_PER_MONTH);
    const baseHours = Math.round(weekHours * WEEKS_PER_MONTH);
    const holidayMonthHours = Math.max(0, monthHours - baseHours);
    const monthlyBase = baseHours * wage;
    const monthlyHoliday = holidayMonthHours * wage;
    const monthly = monthHours * wage;
    const annual = monthly * 12;
    const daily = hours * wage;
    const effectiveHourly = monthHours > 0 ? monthly / monthHours : 0;
    const belowMinimum = wage < MIN_WAGE_2026;
    const minimumGap = (MIN_WAGE_2026 - wage) * monthHours;
    const overtimeEligible = weekHours > 40;
    return {
      weekHours,
      eligible,
      holidayHours,
      weekTotal,
      monthHours,
      baseHours,
      holidayMonthHours,
      monthlyBase,
      monthlyHoliday,
      monthly,
      annual,
      daily,
      effectiveHourly,
      belowMinimum,
      minimumGap,
      overtimeEligible,
      holidayShare: monthly > 0 ? monthlyHoliday / monthly : 0,
    };
  }, [wage, hours, days, attendance]);

  return (
    <RunnerShell
      title="시급 → 월급 (주휴수당 포함)"
      subtitle="2026년 최저임금을 기본값으로, 근무시간과 근무일수에 따른 주휴수당과 월 예상 급여를 계산합니다."
      example="시급 10,320원(2026 최저임금)·하루 8시간·주 5일로 시작합니다. 시간을 바꾸면 주휴수당이 자동으로 붙습니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="시급"
          value={wage}
          onChange={setWage}
          min={8000}
          max={50000}
          step={10}
          unit="원"
          noSlider
          hint={`2026년 최저임금 ${num(MIN_WAGE_2026)}원`}
        />
        <div className="flex flex-wrap items-end gap-1.5 pb-3">
          {[
            { label: "2026 최저임금 10,320", v: MIN_WAGE_2026 },
            { label: "11,000", v: 11000 },
            { label: "12,000", v: 12000 },
            { label: "15,000", v: 15000 },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={wage === o.v}
              onClick={() => setWage(o.v)}
              className={
                "min-h-[44px] rounded-full px-3 text-[12.5px] font-semibold transition-colors " +
                (wage === o.v
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <AmountField
          label="하루 근무시간"
          value={hours}
          onChange={setHours}
          min={1}
          max={12}
          step={0.5}
          unit="시간"
          decimals={1}
          edgeFormat={(v) => `${v}시간`}
        />
        <AmountField
          label="주 근무일수"
          value={days}
          onChange={(v) => setDays(Math.round(v))}
          min={1}
          max={7}
          step={1}
          unit="일"
          edgeFormat={(v) => `${v}일`}
        />
      </div>

      <Segmented
        label="주휴수당 요건 (주 15시간 이상 + 개근)"
        value={attendance}
        onChange={setAttendance}
        options={[
          { value: "full", label: "개근했다" },
          { value: "miss", label: "결근이 있었다" },
        ]}
        hint="주 15시간 미만은 주휴수당이 없습니다. 지각·조퇴는 개근 판단에서 회사 규정을 따릅니다."
      />

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div data-testid="monthly-pay">
          <ResultStat
            label="월 예상 급여"
            value={formatKrw(calc.monthly)}
            tone="brand"
            sub={`${calc.monthHours}시간 기준 · 기본급 ${formatKrw(calc.monthlyBase)}`}
          />
        </div>
        <div data-testid="holiday-pay">
          <ResultStat
            label="월 주휴수당"
            value={formatKrw(calc.monthlyHoliday)}
            sub={
              calc.eligible
                ? `주 ${calc.holidayHours.toFixed(1)}시간 × ${WEEKS_PER_MONTH}주`
                : calc.weekHours < 15
                  ? `주 ${calc.weekHours}시간 — 15시간 미만`
                  : "결근으로 미발생"
            }
          />
        </div>
        <div data-testid="annual-pay">
          <ResultStat
            label="연 예상 급여 (×12)"
            value={formatKrw(calc.annual)}
            tone="jade"
            sub={`하루 ${formatKrw(calc.daily)} · 주 ${calc.weekTotal.toFixed(1)}시간`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">월급 구성</p>
            <p className="text-[12px] tabular-nums text-ink-faint">{formatKrw(calc.monthly)}</p>
          </div>
          <div className="mt-3">
            <Bar ratio={1 - calc.holidayShare} tone="brand" />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px]">
            <span className="font-semibold text-brand">기본급 {formatKrw(calc.monthlyBase)}</span>
            <span className="text-jade">주휴 {formatKrw(calc.monthlyHoliday)}</span>
          </div>

          <div className="mt-4 rounded-lg border border-line-soft bg-[#fbfbf8] px-3">
            <Line label="주 소정근로시간" value={`${calc.weekHours}시간`} sub={`${hours} × ${days}`} />
            <Line
              label="주휴시간"
              value={`${calc.holidayHours.toFixed(2)}시간`}
              sub={calc.eligible ? "주 소정 ÷ 40 × 8" : "요건 미충족"}
            />
            <Line label="주 근로+주휴" value={`${calc.weekTotal.toFixed(2)}시간`} />
            <Line label="월 환산시간" value={`${calc.monthHours}시간`} sub="× 4.345주" />
            <Line label="기본급 (월)" value={formatKrw(calc.monthlyBase)} />
            <Line label="주휴수당 (월)" value={formatKrw(calc.monthlyHoliday)} />
            <Line label="월 예상 급여" value={formatKrw(calc.monthly)} strong tone="brand" />
            <Line label="실효 시급" value={`${num(calc.effectiveHourly)}원`} sub="주휴 포함" />
          </div>
        </div>

        <div className="space-y-3">
          {calc.belowMinimum && (
            <div className="rounded-xl border border-[#e2c9c9] bg-[#fbf3f1] p-4" data-testid="min-wage-warning">
              <p className="text-[12px] font-bold text-[#7a3b3b]">2026년 최저임금 미달</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#7a3b3b]">
                입력한 시급 {num(wage)}원은 2026년 최저임금 {num(MIN_WAGE_2026)}원보다{" "}
                {num(MIN_WAGE_2026 - wage)}원 낮습니다. 월 {num(calc.monthHours)}시간 기준으로{" "}
                {formatKrw(calc.minimumGap)}이 부족합니다.
              </p>
            </div>
          )}
          <CaveatBox
            items={[
              "2026년 최저임금은 시간급 10,320원, 월 환산 2,156,880원(209시간)입니다. 수습 3개월 이내는 10% 감액이 가능하지만 단순노무직은 감액할 수 없습니다.",
              "연장·야간·휴일 근로 가산수당(5인 이상 사업장), 연차수당, 식대·교통비는 반영하지 않았습니다.",
              "주 15시간 미만 근로자는 주휴수당이 없고, 4대보험 가입 기준도 다를 수 있습니다.",
              "소득세·4대보험료를 뺀 실수령액은 '세전 연봉 → 월 실수령액' 계산기에서 확인하세요.",
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white">
          <TableScroll><table className="w-full border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
              근무일수별 월 급여 (하루 {hours}시간·시급 {num(wage)}원·개근 기준)
            </caption>
            <thead>
              <tr className="border-b border-line bg-[#fbfbf8] text-left">
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">주 근무일수</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">주 시간</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">주휴시간</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월 급여</th>
              </tr>
            </thead>
            <tbody>
              {[2, 3, 4, 5, 6].map((d) => {
                const wHours = hours * d;
                const hHours = wHours >= 15 ? Math.min(8, (wHours / 40) * 8) : 0;
                const mHours = Math.round((wHours + hHours) * WEEKS_PER_MONTH);
                const active = d === days;
                return (
                  <tr key={d} className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/40" : ""}`}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      주 {d}일
                      {active && <span className="ml-1.5 text-[12px] font-normal text-brand">내 조건</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{wHours}시간</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-faint">{hHours.toFixed(1)}시간</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand">{formatKrw(mHours * wage)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></TableScroll>
        </div>
      )}

      <StickySummary
        items={[
          { label: "월 예상 급여", value: formatKrw(calc.monthly) },
          { label: "주휴수당", value: formatKrw(calc.monthlyHoliday) },
          { label: "월 시간", value: `${calc.monthHours}시간` },
        ]}
        note={`2026 최저임금 ${num(MIN_WAGE_2026)}원 · 확인 기준일 ${site.baseDateLabel}`}
      />

      <Note>
        기준일 {site.baseDateLabel}. 2026년 적용 최저임금 고시(고용노동부고시 제2025-47호)와 근로기준법
        제55조·시행령 제30조의 주휴수당 규정으로 계산했습니다. 월 환산은 4.345주를 곱해 반올림한 참고용 모의계산이며,
        회사의 급여 계산 방식(월 209시간 고정 등)에 따라 1~2천원 차이가 날 수 있습니다.
      </Note>
    </RunnerShell>
  );
}
