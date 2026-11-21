import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, TableScroll, num } from "./fields-c";

/**
 * 실업급여(구직급여) 예상액 계산기 — 2026년 이직자 기준.
 *
 *  · 구직급여일액 = 기초일액(평균임금, 상한 113,500원) × 60%.
 *  · 2026년 1일 상한 68,100원, 하한 66,048원(최저임금 10,320원 × 8시간 × 80%).
 *  · 소정급여일수: 50세 미만 120~240일, 50세 이상·장애인 120~270일.
 */

const MIN_WAGE = 10320;
const UPPER = 68100;
const BASE_CAP = 113500;
const LOWER_8H = Math.floor(MIN_WAGE * 8 * 0.8); // 66,048

const DAYS_TABLE: { label: string; under50: number; over50: number; min: number }[] = [
  { label: "1년 미만", under50: 120, over50: 120, min: 0 },
  { label: "1년 이상 ~ 3년 미만", under50: 150, over50: 180, min: 1 },
  { label: "3년 이상 ~ 5년 미만", under50: 180, over50: 210, min: 3 },
  { label: "5년 이상 ~ 10년 미만", under50: 210, over50: 240, min: 5 },
  { label: "10년 이상", under50: 240, over50: 270, min: 10 },
];

const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;

export default function UnemploymentCalc({ compact = false }: { compact?: boolean }) {
  const [wage, setWage] = useState(3000000);
  const [age, setAge] = useState(35);
  const [years, setYears] = useState(4);
  const [hours, setHours] = useState(8);
  const [disabled, setDisabled] = useState<"no" | "yes">("no");

  const calc = useMemo(() => {
    const avgDaily = (wage * 3) / 91;
    const baseDay = Math.min(avgDaily, BASE_CAP);
    const sixty = baseDay * 0.6;
    const lower = Math.floor(MIN_WAGE * hours * 0.8);
    const upper = Math.floor(UPPER * (hours / 8));
    const applied = Math.min(Math.max(sixty, lower), upper);
    const daily = Math.floor(applied);
    const isUpper = sixty > upper;
    const isLower = sixty < lower;

    const over50 = age >= 50 || disabled === "yes";
    const row =
      DAYS_TABLE.slice()
        .reverse()
        .find((r) => years >= r.min) ?? DAYS_TABLE[0];
    const days = over50 ? row.over50 : row.under50;
    const total = daily * days;
    return { avgDaily, baseDay, sixty, lower, upper, daily, isUpper, isLower, row, over50, days, total, month28: daily * 28 };
  }, [wage, age, years, hours, disabled]);

  return (
    <UtilShell
      id="unemployment-benefit"
      title="실업급여(구직급여) 계산기"
      subtitle="2026년 상한 68,100원·하한 66,048원 기준으로 1일 급여와 소정급여일수, 총액을 계산합니다."
      note={
        <>
          수급 자격(18개월 중 피보험단위기간 180일·비자발적 이직)은{" "}
          <strong className="font-semibold text-ink">고용센터가 따로 심사</strong>합니다. 이 화면은 금액만 계산합니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="퇴직 전 3개월 월평균 급여"
          value={wage}
          onChange={setWage}
          min={0}
          max={20000000}
          step={100000}
          unit="원"
          noSlider
          hint="세전 기준 · 상여·성과급 포함 여부는 회사 규정에 따름"
        />
        <AmountField label="만 나이" value={age} onChange={setAge} min={19} max={70} step={1} unit="세" edgeFormat={(v) => `만 ${v}세`} />
        <AmountField label="고용보험 가입기간" value={years} onChange={setYears} min={0} max={40} step={0.5} decimals={1} unit="년" edgeFormat={(v) => `${num(v, 1)}년`} />
        <AmountField label="1일 소정근로시간" value={hours} onChange={setHours} min={1} max={8} step={0.5} decimals={1} unit="시간" edgeFormat={(v) => `${num(v, 1)}시간`} />
        <QuickChoices
          label="장애인"
          value={disabled}
          onChange={setDisabled}
          options={[
            { value: "no", label: "아니오" },
            { value: "yes", label: "예(50세 이상과 같은 일수)" },
          ]}
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">1일 구직급여</p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-brand">{won(calc.daily)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {calc.isUpper ? "상한액 적용" : calc.isLower ? "하한액 적용" : "평균임금의 60%"}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">소정급여일수</p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-ink">{calc.days}일</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{calc.over50 ? "50세 이상·장애인" : "50세 미만"} 기준</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">총 예상 수령액</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-jade">{won(calc.total)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">28일 기준 {won(calc.month28)}</p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="1일 평균임금" value={won(calc.avgDaily)} sub="3개월 임금 총액 ÷ 91일" />
        <Line label="기초일액" value={won(calc.baseDay)} sub={`상한 113,500원 · ${calc.baseDay >= BASE_CAP ? "상한 적용" : "그대로"}`} />
        <Line label="60% 계산값" value={won(calc.sixty)} />
        <Line label="하한액" value={won(calc.lower)} sub={`${num(MIN_WAGE)}원 × ${num(hours, 1)}시간 × 80%`} />
        <Line label="상한액" value={won(calc.upper)} sub={hours === 8 ? "2026년 1일 68,100원" : "8시간 기준을 시간 비례로"} />
        <Line label="1일 구직급여" value={won(calc.daily)} strong />
        <Line label="소정급여일수" value={`${calc.days}일`} strong />
        <Line label="총액" value={won(calc.total)} strong tone="brand" />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">소정급여일수 표 — 지금 칸 강조</p>
        <TableScroll minWidth={420}>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="py-1.5 pr-2 text-left font-semibold">가입기간</th>
                <th className="py-1.5 pr-2 text-right font-semibold">50세 미만</th>
                <th className="py-1.5 text-right font-semibold">50세 이상·장애인</th>
              </tr>
            </thead>
            <tbody>
              {DAYS_TABLE.map((r) => {
                const now = r.label === calc.row.label;
                return (
                  <tr
                    key={r.label}
                    className={
                      "border-b border-line-soft last:border-0 " +
                      (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                    }
                  >
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.under50}일</td>
                    <td className="py-1.5 text-right tabular-nums">{r.over50}일</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="mt-4">
        <CaveatBox
          title="계산 전 확인"
          items={[
            "1일 평균임금은 3개월을 91일로 나눠 계산했습니다. 실제 3개월 일수는 89~92일이라 금액이 조금 달라질 수 있습니다.",
            "상한 68,100원은 8시간 기준입니다. 그보다 짧게 일했다면 시간에 비례해 낮춰 적용했습니다(고용센터 확인 권장).",
            "수급기간은 소정급여일수와 다릅니다. 이직일 다음 날부터 원칙적으로 12개월입니다.",
            "실업인정 주기, 재취업에 따른 조기 지급 중단, 조기재취업수당은 반영하지 않습니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
