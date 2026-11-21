import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Note, ResultStat, RunnerShell, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, DateField, Line, num } from "./fields-c";

/**
 * 퇴직금 계산기 (세전).
 *
 *  · 퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365) — 근로기준법 제34조, 시행령 제2조.
 *  · 평균임금 = 퇴직일 이전 3개월 임금총액 ÷ 그 기간의 총일수.
 *    상여금·연차수당은 3개월분(연간액 × 3/12)을 임금총액에 넣는다(시행령 제2조 제1항).
 *  · 평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 본다(시행령 제2조 제2항).
 *  · 계속 근로 1년 미만은 퇴직금이 발생하지 않는다.
 */

const DAY = 86400000;
const MAN = 10000;

type YMD = { y: number; m: number; d: number };

function parseYmd(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

const time = (d: YMD) => Date.UTC(d.y, d.m - 1, d.d);
const daysBetween = (a: YMD, b: YMD) => Math.round((time(b) - time(a)) / DAY);

function addMonths(d: YMD, n: number): YMD {
  const total = d.y * 12 + (d.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: Math.min(d.d, last) };
}

const label = (d: YMD) => `${d.y}. ${d.m}. ${d.d}.`;

export default function SeverancePayCalc({ compact = false }: { compact?: boolean }) {
  const [joinText, setJoinText] = useState("2021-01-01");
  const [leaveText, setLeaveText] = useState<string>(site.baseDate);
  const [monthly, setMonthly] = useState(400); // 만원
  const [bonus, setBonus] = useState(800); // 연간 상여금(만원)
  const [annualLeave, setAnnualLeave] = useState(0); // 연간 연차수당(만원)

  const calc = useMemo(() => {
    const join = parseYmd(joinText);
    const leave = parseYmd(leaveText);
    if (!join || !leave) return { error: "입사일과 퇴사일을 날짜로 입력해 주세요." as const };
    const serviceDays = daysBetween(join, leave) + 1;
    if (serviceDays <= 0) return { error: "퇴사일이 입사일보다 빠릅니다. 날짜를 확인해 주세요." as const };

    const from = addMonths(leave, -3);
    const periodStart: YMD = { y: from.y, m: from.m, d: from.d + 1 };
    const periodDays = daysBetween(periodStart, leave) + 1;

    const basePay = monthly * MAN;
    const bonusShare = (bonus * MAN) / 4; // 연간 상여금 × 3/12
    const leaveShare = (annualLeave * MAN) / 4;
    const wageTotal = basePay * 3 + bonusShare + leaveShare;
    const averageDaily = wageTotal / periodDays;

    // 통상임금 일액 = 월 통상임금 ÷ 209시간 × 1일 8시간
    const ordinaryDaily = (basePay / 209) * 8;
    const appliedDaily = Math.max(averageDaily, ordinaryDaily);
    const appliedBasis = averageDaily >= ordinaryDaily ? "평균임금" : "통상임금";

    const eligible = serviceDays >= 365;
    const severance = eligible ? appliedDaily * 30 * (serviceDays / 365) : 0;
    const serviceYears = serviceDays / 365;

    return {
      error: null,
      join,
      leave,
      serviceDays,
      serviceYears,
      periodStart,
      periodDays,
      wageTotal,
      bonusShare,
      leaveShare,
      averageDaily,
      ordinaryDaily,
      appliedDaily,
      appliedBasis,
      eligible,
      severance,
    };
  }, [joinText, leaveText, monthly, bonus, annualLeave]);

  return (
    <RunnerShell
      title="퇴직금 계산 (세전)"
      subtitle="입사일·퇴사일과 최근 3개월 임금으로 재직일수와 예상 퇴직금을 계산합니다."
      example="2021년 1월 1일 입사·2026년 11월 21일 퇴사, 월급 400만원·연 상여 800만원으로 시작합니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <DateField label="입사일" value={joinText} onChange={setJoinText} min="1970-01-01" max="2026-12-31" />
        <DateField label="퇴사일 (마지막 근무일)" value={leaveText} onChange={setLeaveText} min="1970-01-01" max="2030-12-31" />
        <AmountField
          label="최근 3개월 월급 (기본급)"
          value={monthly}
          onChange={setMonthly}
          min={100}
          max={2000}
          step={10}
          unit="만원"
          hint="세전 · 고정급"
        />
        <AmountField
          label="연간 상여금"
          value={bonus}
          onChange={setBonus}
          min={0}
          max={5000}
          step={100}
          unit="만원"
          hint="3개월분만 반영"
        />
        <AmountField
          label="연간 연차수당"
          value={annualLeave}
          onChange={setAnnualLeave}
          min={0}
          max={1000}
          step={10}
          unit="만원"
          hint="없으면 0"
        />
        <div className="py-3">
          <p className="text-[13.5px] font-semibold text-ink">산정 기준</p>
          <p className="mt-2 rounded-lg border border-line bg-paper-deep px-3 py-2 text-[12.5px] leading-relaxed text-ink">
            퇴직일 이전 3개월({calc.error ? "—" : `${label(calc.periodStart)} ~ ${label(calc.leave)} · ${calc.periodDays}일`})
            의 임금총액으로 1일 평균임금을 냅니다.
          </p>
        </div>
      </div>

      {calc.error ? (
        <p className="mt-4 rounded-xl border border-[#e2c9c9] bg-[#fbf3f1] px-4 py-3 text-[13px] text-[#7a3b3b]">
          {calc.error}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div data-testid="severance-total">
              <ResultStat
                label="예상 퇴직금 (세전)"
                value={formatKrw(calc.severance)}
                tone="brand"
                sub={
                  calc.eligible
                    ? `1일 ${calc.appliedBasis} ${formatKrw(calc.appliedDaily)} × 30일 × ${calc.serviceYears.toFixed(2)}년`
                    : "계속 근로 1년 미만 — 퇴직금 없음"
                }
              />
            </div>
            <div data-testid="service-days">
              <ResultStat
                label="재직일수"
                value={`${num(calc.serviceDays)}일`}
                sub={`${calc.serviceYears.toFixed(2)}년 · ${label(calc.join)} ~ ${label(calc.leave)}`}
              />
            </div>
            <div data-testid="avg-daily">
              <ResultStat
                label={`1일 ${calc.appliedBasis}`}
                value={formatKrw(calc.appliedDaily)}
                tone="jade"
                sub={`3개월 임금총액 ${formatKrw(calc.wageTotal)} ÷ ${calc.periodDays}일`}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">평균임금 산정 내역</p>
              <div className="mt-2">
                <Line label="최근 3개월 기본급" value={formatKrw(monthly * MAN * 3)} sub={`${monthly}만 × 3`} />
                <Line label="상여금 3개월분" value={formatKrw(calc.bonusShare)} sub={`연 ${bonus}만 × 3/12`} />
                <Line label="연차수당 3개월분" value={formatKrw(calc.leaveShare)} sub={`연 ${annualLeave}만 × 3/12`} />
                <Line label="3개월 임금총액" value={formatKrw(calc.wageTotal)} strong />
                <Line label="기간 총일수" value={`${calc.periodDays}일`} />
                <Line label="1일 평균임금" value={formatKrw(calc.averageDaily)} strong />
                <Line label="1일 통상임금" value={formatKrw(calc.ordinaryDaily)} sub="월 기본급 ÷ 209 × 8" />
                <Line
                  label="적용 기준"
                  value={calc.appliedBasis}
                  tone="brand"
                  sub={calc.appliedBasis === "통상임금" ? "평균임금이 더 낮아 통상임금으로 계산" : "평균임금이 더 높음"}
                />
                <Line label="퇴직금 (세전)" value={formatKrw(calc.severance)} strong tone="brand" />
              </div>
            </div>

            <div className="space-y-3">
              <CaveatBox
                items={[
                  "퇴직금은 계속 근로 1년 이상인 근로자에게 발생합니다. 1년 미만이면 0원입니다.",
                  "여기서는 기본급·상여금·연차수당만 넣었습니다. 실제 평균임금에는 식대·직책수당·고정 연장수당 등 임금성이 있는 항목이 포함될 수 있습니다.",
                  "평균임금 계산 기간에 휴직·병가 등으로 임금이 줄었다면, 그 기간을 빼고 계산할 수 있습니다(시행령 제2조 제1항 단서).",
                  "표시한 금액은 세전입니다. 퇴직소득세는 퇴직금과 근속연수에 따라 따로 계산되어 차감됩니다.",
                ]}
              />
              <div className="rounded-xl border border-line bg-white p-4">
                <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">근속연수별로 보면</p>
                <div className="mt-2">
                  {[1, 3, 5, 10].map((y) => (
                    <Line
                      key={y}
                      label={`${y}년 근속 시`}
                      value={formatKrw(calc.appliedDaily * 30 * y)}
                      sub={calc.serviceYears >= y ? "지난 구간" : "예상"}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                  같은 임금이 계속된다고 보고 근속연수만 바꿔 본 값입니다.
                </p>
              </div>
            </div>
          </div>

          {!compact && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
              <table className="w-full border-collapse text-[12.5px]">
                <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
                  내 조건 요약
                </caption>
                <tbody>
                  {[
                    ["입사일", label(calc.join)],
                    ["퇴사일", label(calc.leave)],
                    ["재직일수", `${num(calc.serviceDays)}일 (${calc.serviceYears.toFixed(2)}년)`],
                    ["3개월 임금총액", formatKrw(calc.wageTotal)],
                    ["1일 평균임금", formatKrw(calc.averageDaily)],
                    ["적용 1일 임금", `${formatKrw(calc.appliedDaily)} (${calc.appliedBasis})`],
                    ["예상 퇴직금 (세전)", formatKrw(calc.severance)],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-line-soft last:border-0">
                      <th scope="row" className="w-[42%] px-3 py-2 text-left font-semibold text-ink-soft">
                        {k}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <StickySummary
            items={[
              { label: "예상 퇴직금", value: formatKrw(calc.severance) },
              { label: "재직일수", value: `${num(calc.serviceDays)}일` },
            ]}
            note={`세전 · 1일 ${calc.appliedBasis} 기준 · 확인 기준일 ${site.baseDateLabel}`}
          />

          <Note>
            기준일 {site.baseDateLabel}. 근로기준법 제34조와 같은 법 시행령 제2조의 평균임금·통상임금 규정으로
            계산한 참고용 모의계산입니다. 실제 퇴직금은 회사의 임금 구성과 퇴직소득세에 따라 달라지므로,
            퇴직 전 회사·노무사와 한 번 더 확인하세요.
          </Note>
        </>
      )}
    </RunnerShell>
  );
}
