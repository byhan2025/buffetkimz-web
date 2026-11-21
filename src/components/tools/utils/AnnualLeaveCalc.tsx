import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, DateField, Line, TableScroll, num } from "./fields-c";

/**
 * 연차 일수·미사용 연차수당 계산기 — 근로기준법 제60조.
 *
 *  · 1년 미만: 1개월 개근마다 1일(최대 11일).
 *  · 1년 이상 80% 이상 출근: 15일. 3년 이상은 최초 1년을 초과하는 2년마다 1일 가산, 25일 한도.
 *  · 통상시급 = 월 통상임금 ÷ 209시간, 1일 통상임금 = 통상시급 × 8시간.
 *  · 단시간 근로자는 통상 근로자 연차 × (1주 소정근로시간 ÷ 40)로 비례 계산.
 */

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function monthsBetween(a: Date, b: Date) {
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

const YEARS_TABLE = [
  { years: "1~2년", days: 15 },
  { years: "3~4년", days: 16 },
  { years: "5~6년", days: 17 },
  { years: "7~8년", days: 18 },
  { years: "9~10년", days: 19 },
  { years: "11~12년", days: 20 },
  { years: "13~14년", days: 21 },
  { years: "15~16년", days: 22 },
  { years: "17~18년", days: 23 },
  { years: "19~20년", days: 24 },
  { years: "21년 이상", days: 25 },
];

export default function AnnualLeaveCalc({ compact = false }: { compact?: boolean }) {
  const [hire, setHire] = useState("2023-03-02");
  const [base, setBase] = useState("2026-11-21");
  const [wage, setWage] = useState(3000000);
  const [used, setUsed] = useState(8);
  const [weeklyHours, setWeeklyHours] = useState(40);

  const calc = useMemo(() => {
    const h = parseDate(hire);
    const b = parseDate(base);
    if (!h || !b || b < h) return null;
    const months = monthsBetween(h, b);
    const years = Math.floor(months / 12);
    const ratio = Math.min(1, Math.max(0, weeklyHours / 40));

    const baseDays = years < 1 ? Math.min(11, months) : Math.min(25, 15 + (years >= 3 ? Math.floor((years - 1) / 2) : 0));
    const days = Math.round(baseDays * ratio * 10) / 10;
    const monthHours = 209;
    const hourly = wage / monthHours;
    const dayHours = Math.min(8, weeklyHours / 5);
    const dailyWage = hourly * dayHours;
    const unused = Math.max(0, Math.round((days - used) * 10) / 10);
    const pay = unused * dailyWage;
    return { months, years, ratio, baseDays, days, hourly, dayHours, dailyWage, unused, pay };
  }, [hire, base, wage, used, weeklyHours]);

  return (
    <UtilShell
      id="annual-leave"
      title="연차 일수·수당 계산기"
      subtitle="근속연수별 발생 연차와 미사용 일수를 계산하고, 통상임금으로 연차수당을 냅니다."
      note={
        <>
          상시 5명 이상 사업장, 4주 평균 1주 소정근로시간 15시간 이상 근로자 기준입니다. 취업규칙에 정한 기준이
          있으면 그 기준이 우선합니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <DateField label="입사일" value={hire} onChange={setHire} />
        <DateField label="기준일" value={base} onChange={setBase} hint="오늘 또는 계산하려는 연차 발생일" />
        <AmountField
          label="월 통상임금"
          value={wage}
          onChange={setWage}
          min={0}
          max={20000000}
          step={100000}
          unit="원"
          noSlider
          hint="기본급 + 매달 고정 수당(상여·연장수당 제외)"
        />
        <AmountField label="사용한 연차" value={used} onChange={setUsed} min={0} max={30} step={0.5} decimals={1} unit="일" edgeFormat={(v) => `${num(v, 1)}일`} />
        <AmountField
          label="1주 소정근로시간"
          value={weeklyHours}
          onChange={setWeeklyHours}
          min={15}
          max={40}
          step={1}
          unit="시간"
          edgeFormat={(v) => `${v}시간`}
          hint="단시간 근로자는 비례로 줄어듭니다"
        />
      </div>

      {calc ? (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
              <p className="text-[12px] font-semibold text-ink-faint">발생 연차</p>
              <p className="mt-1 text-[22px] font-extrabold tabular-nums text-brand">{num(calc.days, 1)}일</p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">근속 {calc.years}년 {calc.months % 12}개월</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-3.5">
              <p className="text-[12px] font-semibold text-ink-faint">1일 통상임금</p>
              <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{won(calc.dailyWage)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">시급 {won(calc.hourly)} × {num(calc.dayHours, 1)}시간</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-3.5">
              <p className="text-[12px] font-semibold text-ink-faint">미사용 연차수당</p>
              <p className="mt-1 text-[19px] font-extrabold tabular-nums text-jade">{won(calc.pay)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">남은 {num(calc.unused, 1)}일 기준(세전)</p>
            </div>
          </div>

          <div className="mt-3">
            <Line label="근속" value={`${calc.years}년 ${calc.months % 12}개월`} />
            <Line
              label="산정 방식"
              value={calc.years < 1 ? "1개월 개근당 1일(최대 11일)" : "15일 + 2년마다 1일"}
              sub={calc.years < 1 ? `${calc.months}개월 개근 가정` : undefined}
            />
            <Line label="기본 일수" value={`${num(calc.baseDays, 1)}일`} />
            <Line label="단시간 비례" value={`× ${num(calc.ratio, 2)}`} sub={`1주 ${weeklyHours}시간 기준`} />
            <Line label="발생 연차" value={`${num(calc.days, 1)}일`} strong />
            <Line label="사용" value={`${num(used, 1)}일`} />
            <Line label="미사용" value={`${num(calc.unused, 1)}일`} />
            <Line label="연차수당" value={won(calc.pay)} strong tone="jade" />
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">근속연수별 연차 일수 (1주 40시간)</p>
            <TableScroll minWidth={320}>
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {YEARS_TABLE.map((row, i) => {
                    const now =
                      calc.years >= 1 &&
                      (i === 0 ? calc.years <= 2 : i === YEARS_TABLE.length - 1 ? calc.years >= 21 : calc.years >= i * 2 + 1 && calc.years <= i * 2 + 2);
                    return (
                      <tr
                        key={row.years}
                        className={
                          "border-b border-line-soft last:border-0 " +
                          (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                        }
                      >
                        <td className="py-1.5 pr-2">{row.years}</td>
                        <td className="py-1.5 text-right tabular-nums">{row.days}일</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-clay">기준일이 입사일보다 빠릅니다. 날짜를 확인해 주세요.</p>
      )}

      <div className="mt-4">
        <CaveatBox
          title="계산 전 확인"
          items={[
            "입사일 기준입니다. 회계연도(1월 1일) 기준으로 부여하는 회사는 첫해 비례 부여·퇴직 시 정산 차이가 생깁니다.",
            "출근율 80% 이상을 가정했습니다. 80% 미만이면 15일이 아니라 개근한 달 수만큼만 발생합니다.",
            "1년 기간제 계약은 1년을 채우지 못하면 15일이 발생하지 않아 최대 11일입니다(대법원 2021다227100).",
            "통상임금에 상여금·연장수당을 넣을지는 취업규칙과 판례에 따라 다릅니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
