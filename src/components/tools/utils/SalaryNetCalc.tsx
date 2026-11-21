import { HEALTH_INSURANCE, SOCIAL_INSURANCE } from "@/data/tax-rules";
import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Bar, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, Line, num, TableScroll } from "./fields-c";

/**
 * 세전 연봉·월급 → 월 실수령액 계산기 (2026년 기준).
 *
 * 요율 근거
 *  · 국민연금 9.5%(근로자 4.75%) — 2026년부터 2033년까지 매년 0.5%p 인상(국민연금법 제88조).
 *    기준소득월액 하한 41만원·상한 659만원 (2026. 7. ~ 2027. 6.).
 *  · 건강보험 7.19%(근로자 3.595%) — 2026년 건정심 의결·건강보험법 시행령 제44조.
 *  · 장기요양 0.9448%(근로자 0.4724%) — 건강보험료의 13.14%.
 *  · 고용보험 실업급여 1.8%(근로자 0.9%) — 고용산재보험료징수법 시행령 제12조.
 *  · 소득세: 소득세법 제47조·제55조·제59조의 근로소득공제·기본세율·근로소득세액공제를
 *    연 단위로 계산해 12로 나눈 근사값. 간이세액표를 그대로 옮긴 값은 아니다.
 */

const MAN = 10000;

/* 2026년 4대보험 요율은 `data/tax-rules.ts`에서 온다. */
const PENSION_RATE = SOCIAL_INSURANCE.nationalPension / 2;
const PENSION_MIN = 410000;
const PENSION_MAX = 6590000;
const HEALTH_RATE = HEALTH_INSURANCE.employeeShare;
const CARE_RATIO = HEALTH_INSURANCE.longTermCareRatio; // 장기요양보험료율 ÷ 건강보험료율
const EMPLOY_RATE = SOCIAL_INSURANCE.employment / 2;

const floor10 = (v: number) => Math.floor(v / 10) * 10;

/** 근로소득공제 (소득세법 제47조) — 한도 2,000만원 */
function earnedIncomeDeduction(gross: number): number {
  let d: number;
  if (gross <= 500 * MAN) d = gross * 0.7;
  else if (gross <= 1500 * MAN) d = 350 * MAN + (gross - 500 * MAN) * 0.4;
  else if (gross <= 4500 * MAN) d = 750 * MAN + (gross - 1500 * MAN) * 0.15;
  else if (gross <= 10000 * MAN) d = 1200 * MAN + (gross - 4500 * MAN) * 0.05;
  else d = 1475 * MAN + (gross - 10000 * MAN) * 0.02;
  return Math.min(d, 2000 * MAN);
}

/** 기본세율 (소득세법 제55조) — 2026년 과세표준 구간 */
function basicTax(base: number): number {
  if (base <= 1400 * MAN) return base * 0.06;
  if (base <= 5000 * MAN) return base * 0.15 - 126 * MAN;
  if (base <= 8800 * MAN) return base * 0.24 - 576 * MAN;
  if (base <= 15000 * MAN) return base * 0.35 - 1544 * MAN;
  if (base <= 30000 * MAN) return base * 0.38 - 1994 * MAN;
  if (base <= 50000 * MAN) return base * 0.4 - 2594 * MAN;
  if (base <= 100000 * MAN) return base * 0.42 - 3594 * MAN;
  return base * 0.45 - 6594 * MAN;
}

/** 근로소득세액공제 한도 (소득세법 제59조) — 총급여(만원) 기준 */
function creditLimit(grossMan: number): number {
  if (grossMan <= 3300) return 74 * MAN;
  if (grossMan <= 7000) return (74 - (grossMan - 3300) * 0.008) * MAN;
  if (grossMan <= 12000) return (66 - (grossMan - 7000) * 0.005) * MAN;
  return Math.max(20 * MAN, (50 - (grossMan - 12000) * 0.005) * MAN);
}

export default function SalaryNetCalc({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"annual" | "monthly">("annual");
  const [annual, setAnnual] = useState(4800); // 만원
  const [family, setFamily] = useState(1);
  const [meal, setMeal] = useState(20); // 만원

  const calc = useMemo(() => {
    const annualGross = annual * MAN;
    const monthlyGross = annualGross / 12;
    const mealMonthly = Math.min(Math.max(meal, 0), 20) * MAN;
    const taxableMonthly = Math.max(0, monthlyGross - mealMonthly);
    const taxableAnnual = Math.max(0, taxableMonthly * 12);

    const pensionBase = Math.min(PENSION_MAX, Math.max(PENSION_MIN, Math.floor(taxableMonthly / 1000) * 1000));
    const pension = floor10(pensionBase * PENSION_RATE);
    const health = floor10(taxableMonthly * HEALTH_RATE);
    const care = floor10(health * CARE_RATIO);
    const employ = floor10(taxableMonthly * EMPLOY_RATE);
    const insurance = pension + health + care + employ;

    const deduction = earnedIncomeDeduction(taxableAnnual);
    const earnedIncome = taxableAnnual - deduction;
    const personal = 150 * MAN * Math.max(1, family);
    const pensionDeduction = pension * 12;
    const taxBaseRaw = Math.max(0, earnedIncome - personal - pensionDeduction);
    const taxBase = Math.floor(taxBaseRaw / 1000) * 1000;

    const computed = Math.max(0, basicTax(taxBase));
    const rawCredit = computed <= 130 * MAN ? computed * 0.55 : 71.5 * MAN + (computed - 130 * MAN) * 0.3;
    const credit = Math.min(rawCredit, creditLimit(taxableAnnual / MAN));
    const standardCredit = 13 * MAN;
    const decided = Math.max(0, computed - credit - standardCredit);

    const incomeTax = floor10(decided / 12);
    const localTax = floor10(incomeTax * 0.1);
    const tax = incomeTax + localTax;
    const net = monthlyGross - insurance - tax;

    return {
      annualGross,
      monthlyGross,
      mealMonthly,
      taxableMonthly,
      pensionBase,
      pension,
      health,
      care,
      employ,
      insurance,
      deduction,
      earnedIncome,
      personal,
      pensionDeduction,
      taxBase,
      computed,
      credit,
      decided,
      incomeTax,
      localTax,
      tax,
      net,
      netAnnual: net * 12,
      deductionRatio: monthlyGross > 0 ? (insurance + tax) / monthlyGross : 0,
      insuranceRatio: monthlyGross > 0 ? insurance / monthlyGross : 0,
      employer:
        pension + health + care + employ + floor10(taxableMonthly * 0.0025), // 고용안정·직능 0.25%는 사업주 전액
    };
  }, [annual, family, meal]);

  return (
    <RunnerShell
      title="세전 연봉 → 월 실수령액"
      subtitle="2026년 4대보험 요율과 근로소득세를 연 단위로 계산해 월 실수령액을 냅니다."
      example="연봉과 부양가족 수, 비과세 식대를 바꿔 보세요. 요율은 2026년 1월 1일 시행 기준입니다."
    >
      <Segmented
        label="입력 기준"
        value={mode}
        onChange={setMode}
        options={[
          { value: "annual", label: "세전 연봉" },
          { value: "monthly", label: "세전 월급" },
        ]}
        hint="월급은 연봉의 1/12입니다. 상여·수당은 연봉에 포함해 입력하세요."
      />

      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        {mode === "annual" ? (
          <AmountField
            label="세전 연봉"
            value={annual}
            onChange={setAnnual}
            min={2000}
            max={12000}
            step={100}
            unit="만원"
            hint="비과세 포함"
          />
        ) : (
          <AmountField
            label="세전 월급"
            value={Math.round(annual / 12)}
            onChange={(v) => setAnnual(v * 12)}
            min={170}
            max={1000}
            step={10}
            unit="만원"
            hint="연봉 환산"
          />
        )}
        <AmountField
          label="부양가족 수 (본인 포함)"
          value={family}
          onChange={setFamily}
          min={1}
          max={6}
          step={1}
          unit="명"
          hint="1인당 150만원 공제"
          edgeFormat={(v) => `${v}명`}
        />
        <AmountField
          label="비과세 식대"
          value={meal}
          onChange={setMeal}
          min={0}
          max={30}
          step={5}
          unit="만원"
          hint="월 20만원까지 비과세"
        />
        <div className="py-3">
          <p className="text-[13.5px] font-semibold text-ink">과세 대상 월 보수</p>
          <p className="mt-2 rounded-lg border border-line bg-paper-deep px-3 py-2 text-[14px] font-bold tabular-nums text-ink">
            {formatKrw(calc.taxableMonthly)}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            월급 {formatKrw(calc.monthlyGross)} − 비과세 식대 {formatKrw(calc.mealMonthly)}. 4대보험과
            소득세는 이 금액을 기준으로 계산합니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div data-testid="net-pay">
          <ResultStat
            label="월 실수령액"
            value={formatKrw(calc.net)}
            tone="brand"
            sub={`세전 ${formatKrw(calc.monthlyGross)}의 ${(100 - calc.deductionRatio * 100).toFixed(1)}%`}
          />
        </div>
        <div data-testid="deduction-total">
          <ResultStat
            label="월 공제 합계"
            value={formatKrw(calc.insurance + calc.tax)}
            sub={`4대보험 ${formatKrw(calc.insurance)} + 세금 ${formatKrw(calc.tax)}`}
          />
        </div>
        <div data-testid="net-annual">
          <ResultStat
            label="연 실수령액 (×12)"
            value={formatKrw(calc.netAnnual)}
            tone="jade"
            sub={`공제율 ${(calc.deductionRatio * 100).toFixed(2)}%`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">월급 구성</p>
            <p className="text-[12px] tabular-nums text-ink-faint">세전 {formatKrw(calc.monthlyGross)}</p>
          </div>
          <div className="mt-3">
            <Bar ratio={1 - calc.deductionRatio} tone="jade" />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px]">
            <span className="font-semibold text-jade">실수령 {formatKrw(calc.net)}</span>
            <span className="text-ink-muted">공제 {formatKrw(calc.insurance + calc.tax)}</span>
          </div>

          <div className="mt-4 rounded-lg border border-line-soft bg-[#fbfbf8] px-3">
            <Line label="국민연금" sub="4.75%" value={formatKrw(calc.pension)} />
            <Line label="건강보험" sub="3.595%" value={formatKrw(calc.health)} />
            <Line label="장기요양보험" sub="건보료의 13.14%" value={formatKrw(calc.care)} />
            <Line label="고용보험" sub="0.9%" value={formatKrw(calc.employ)} />
            <Line label="소득세" sub="연 환산 ÷ 12" value={formatKrw(calc.incomeTax)} />
            <Line label="지방소득세" sub="소득세의 10%" value={formatKrw(calc.localTax)} />
            <Line
              label="공제 합계"
              value={formatKrw(calc.insurance + calc.tax)}
              strong
              tone="brand"
            />
            <Line
              label="회사가 함께 내는 보험료 (참고)"
              value={formatKrw(calc.employer)}
              tone="jade"
              sub="고용안정 0.25% 포함"
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            공제 합계는 근로자 부담 4대보험과 소득세·지방소득세를 더한 값입니다. 회사는 같은 보험료를 한 번 더
            부담하므로, 회사가 보는 인건비는 세전 월급에 이 금액을 더한 셈이 됩니다.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">세금 계산 과정 (연 환산)</p>
            <div className="mt-2">
              <Line label="총급여 (비과세 제외)" value={formatKrw(calc.taxableMonthly * 12)} />
              <Line label="근로소득공제" value={`− ${formatKrw(calc.deduction)}`} />
              <Line label="근로소득금액" value={formatKrw(calc.earnedIncome)} />
              <Line label={`인적공제 (${family}명 × 150만)`} value={`− ${formatKrw(calc.personal)}`} />
              <Line label="연금보험료공제" value={`− ${formatKrw(calc.pensionDeduction)}`} />
              <Line label="과세표준" value={formatKrw(calc.taxBase)} strong />
              <Line label="산출세액" value={formatKrw(calc.computed)} />
              <Line label="근로소득세액공제" value={`− ${formatKrw(calc.credit)}`} />
              <Line label="표준세액공제" value="− 130,000원" />
              <Line label="결정세액 (연)" value={formatKrw(calc.decided)} strong tone="brand" />
            </div>
          </div>

          <CaveatBox
            items={[
              "소득세는 연말정산을 연 단위로 미리 계산해 12로 나눈 근사값입니다. 실제 급여명세서의 간이세액은 회사가 신고한 부양가족·비과세 항목에 따라 다릅니다.",
              "자녀세액공제, 연금계좌·월세액·보험료 세액공제, 의료비·교육비 공제는 반영하지 않았습니다. 연말정산에서 돌려받는 금액이 생길 수 있습니다.",
              "국민연금 기준소득월액은 41만~659만원으로 잘립니다(2026. 7.~2027. 6.). 월급이 659만원을 넘어도 국민연금은 659만원 기준입니다.",
              "산재보험과 고용안정·직업능력개발 보험료는 사업주가 전액 부담하므로 근로자 공제에서 빠집니다.",
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white">
          <TableScroll><table className="w-full border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
              연봉별 월 실수령액 (부양가족 1명·식대 20만원 기준 근사)
            </caption>
            <thead>
              <tr className="border-b border-line bg-[#fbfbf8] text-left">
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">세전 연봉</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월 4대보험</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월 세금</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월 실수령</th>
              </tr>
            </thead>
            <tbody>
              {[3000, 4000, 4800, 6000, 8000, 10000].map((man) => {
                const g = man * MAN;
                const m = g / 12;
                const taxMonthly = Math.max(0, m - 20 * MAN);
                const p = floor10(
                  Math.min(PENSION_MAX, Math.max(PENSION_MIN, Math.floor(taxMonthly / 1000) * 1000)) * PENSION_RATE,
                );
                const h = floor10(taxMonthly * HEALTH_RATE);
                const c = floor10(h * CARE_RATIO);
                const e = floor10(taxMonthly * EMPLOY_RATE);
                const taxBaseV = Math.max(
                  0,
                  (g - 20 * MAN * 12) - earnedIncomeDeduction(g - 20 * MAN * 12) - 150 * MAN - p * 12,
                );
                const comp = Math.max(0, basicTax(Math.floor(taxBaseV / 1000) * 1000));
                const cr = Math.min(
                  comp <= 130 * MAN ? comp * 0.55 : 71.5 * MAN + (comp - 130 * MAN) * 0.3,
                  creditLimit((g - 20 * MAN * 12) / MAN),
                );
                const dec = Math.max(0, comp - cr - 13 * MAN);
                const it = floor10(dec / 12);
                const lt = floor10(it * 0.1);
                const netMan = (m - (p + h + c + e) - it - lt) / MAN;
                const active = man === annual;
                return (
                  <tr
                    key={man}
                    className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold text-ink">
                      {man.toLocaleString("ko-KR")}만원
                      {active && <span className="ml-1.5 text-[12px] font-normal text-brand">내 구간</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{num(p + h + c + e)}원</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{num(it + lt)}원</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand">
                      {formatKrw(netMan * MAN)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></TableScroll>
        </div>
      )}

      <StickySummary
        items={[
          { label: "월 실수령", value: formatKrw(calc.net) },
          { label: "공제 합계", value: formatKrw(calc.insurance + calc.tax) },
        ]}
        note={`2026년 요율 · 확인 기준일 ${site.baseDateLabel}`}
      />

      <Note>
        기준일 {site.baseDateLabel}. 2026년 요율(국민연금 9.5%·건강보험 7.19%·장기요양 0.9448%·고용보험
        1.8%)과 소득세법의 근로소득공제·기본세율·근로소득세액공제로 계산한 참고용 모의계산입니다. 회사가
        신고한 급여 항목과 연말정산 결과에 따라 실제 금액은 달라집니다.
      </Note>
    </RunnerShell>
  );
}
