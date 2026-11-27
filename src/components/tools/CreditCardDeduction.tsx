import { useMemo, useState } from "react";
import { withBase } from "@/config/site";
import {
  CREDIT_CARD,
  MARGINAL_RATES,
  TAX_TEXT,
  creditCardDeduction,
  creditCardExtraLimit,
} from "@/data/tax-rules";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, SaveResultCard, Segmented, StickySummary, formatKrw, formatMan } from "./ui";

/**
 * 신용카드 등 사용금액 소득공제 계산기 (2026년 귀속).
 *
 * 산식은 `creditCardDeduction()` 하나 — 조세특례제한법 제126조의2 제2항 그대로다.
 *  · 최저사용금액(총급여 25%)을 낮은 공제율부터 채운다: 신용카드 → 직불등 → 문화체육 → 전통시장/대중교통
 *  · 기본 한도(자녀등 0·1·2명 이상)를 넘는 공제액에만 추가 한도(전통시장·대중교통)가 붙는다
 * 여기서는 상수·산식을 새로 적지 않고 불러 쓰기만 한다(단일 출처 원칙).
 */

type Children = "0" | "1" | "2";

const childLabel: Record<Children, string> = {
  "0": "없음",
  "1": "1명",
  "2": "2명 이상",
};

export default function CreditCardDeduction({ compact = false }: { compact?: boolean }) {
  /* 예시 입력값 — 총급여 6,000만원·자녀 없음·신용카드 1,600만원·체크 400만원(가상) */
  const [salary, setSalary] = useState(6000);
  const [children, setChildren] = useState<Children>("0");
  const [card, setCard] = useState(1600);
  const [debit, setDebit] = useState(400);
  const [market, setMarket] = useState(0);
  const [transport, setTransport] = useState(0);
  const [culture, setCulture] = useState(0);
  const [rest, setRest] = useState(100);
  const [marginal, setMarginal] = useState<string>(`${MARGINAL_RATES[1].withLocal}`);

  const childCount = Number(children);
  const inputs = { salaryMan: salary, children: childCount, card, debit, culture, market, transport };

  const calc = useMemo(() => creditCardDeduction(inputs), [salary, children, card, debit, market, transport, culture]);

  /* 남은 기간 같은 지출을 신용카드로 쓸 때와 체크카드로 쓸 때를 나란히 계산한다. */
  const switchCase = useMemo(() => {
    const asCard = creditCardDeduction({ ...inputs, card: card + rest });
    const asDebit = creditCardDeduction({ ...inputs, debit: debit + rest });
    const diffMan = Math.round((asDebit.total - asCard.total) * 10) / 10;
    const rate = Number(marginal);
    return {
      asCard,
      asDebit,
      diffMan,
      diffWon: Math.round(diffMan * 10000 * rate),
    };
  }, [salary, children, card, debit, market, transport, culture, rest, marginal]);

  const rate = Number(marginal);
  const rateLabel = `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const thresholdLeft = Math.max(0, Math.round((calc.threshold - calc.used) * 10) / 10);
  const baseRatio = calc.baseLimit ? Math.min(1, calc.baseDeduction / calc.baseLimit) : 0;

  const resultRows = [
    { label: "예상 소득공제", value: formatMan(calc.total), sub: `기본 ${formatMan(calc.baseDeduction)} + 추가 ${formatMan(calc.extraDeduction)}` },
    { label: "줄어드는 세금(추정)", value: formatKrw(calc.total * 10000 * rate), sub: `과세표준 구간 세율 ${rateLabel} 적용` },
    { label: "최저사용금액(총급여 25%)", value: formatMan(calc.threshold) },
    {
      label: "12월 체크카드 전환",
      value: switchCase.diffMan > 0 ? `+${formatMan(switchCase.diffMan)}` : "0원",
      sub: `예상 절세 ${formatKrw(switchCase.diffWon)}`,
    },
  ];

  return (
    <RunnerShell
      title="신용카드 공제 계산"
      subtitle="2026년 귀속 · 2027년 1~2월 정산 기준으로 문턱·한도·전환 효과를 계산합니다."
      example="총급여 6,000만원, 신용카드 1,600만원, 체크·현금영수증 400만원(가상)으로 시작합니다."
    >
      <span className="sr-only">2026년 귀속 (2027년 1~2월 정산)</span>
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <MoneySlider label="총급여" value={salary} onChange={setSalary} min={2000} max={12000} step={100} />
        <Segmented
          label="기본공제 자녀등 수"
          value={children}
          onChange={(v) => setChildren(v as Children)}
          options={[
            { value: "0", label: "없음" },
            { value: "1", label: "1명" },
            { value: "2", label: "2명 이상" },
          ]}
          hint={`기본 한도 ${formatMan(calc.baseLimit)} · 자녀등은 20세 이하이면서 소득요건을 채운 직계비속입니다.`}
        />
        <MoneySlider label="신용카드 사용액" value={card} onChange={setCard} min={0} max={6000} step={50} />
        <MoneySlider label="체크·직불·현금영수증" value={debit} onChange={setDebit} min={0} max={4000} step={50} />
        <MoneySlider label="전통시장 사용액" value={market} onChange={setMarket} min={0} max={1500} step={50} />
        <MoneySlider label="대중교통 이용액" value={transport} onChange={setTransport} min={0} max={600} step={10} />
        <MoneySlider
          label="문화·체육 사용액"
          value={culture}
          onChange={setCulture}
          min={0}
          max={500}
          step={10}
          hint={calc.cultureCounted ? `${TAX_TEXT.creditCardDebit} 칸` : "총급여 7,000만원 초과 — 별도 칸 없음"}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ResultStat
          label="예상 소득공제"
          value={formatMan(calc.total)}
          tone="brand"
          sub={`공제 대상 ${formatMan(calc.overThreshold)} × 수단별 공제율`}
        />
        <ResultStat
          label="최저사용금액"
          value={formatMan(calc.threshold)}
          sub={`총급여 ${formatMan(salary)}의 25%`}
        />
        <ResultStat
          label={thresholdLeft > 0 ? "문턱까지 남은 금액" : "문턱 넘은 금액"}
          value={thresholdLeft > 0 ? formatMan(thresholdLeft) : formatMan(calc.overThreshold)}
          tone={thresholdLeft > 0 ? "default" : "jade"}
          sub={
            thresholdLeft > 0
              ? "이 금액까지는 공제가 0원입니다"
              : "이 금액부터 공제가 시작됩니다"
          }
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">한도 진행</p>
          <div className="mt-3 space-y-3.5">
            <div>
              <div className="flex justify-between text-[12px]">
                <span className="text-ink-muted">기본 한도 (자녀등 {childLabel[children]})</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatMan(calc.baseDeduction)} / {formatMan(calc.baseLimit)}
                </span>
              </div>
              <div className="mt-1">
                <Bar ratio={baseRatio} tone={calc.baseHit ? "jade" : "brand"} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[12px]">
                <span className="text-ink-muted">추가 한도 (전통시장·대중교통)</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatMan(calc.extraDeduction)} / {formatMan(creditCardExtraLimit(salary))}
                </span>
              </div>
              <div className="mt-1">
                <Bar
                  ratio={creditCardExtraLimit(salary) ? calc.extraDeduction / creditCardExtraLimit(salary) : 0}
                  tone={calc.extraHit ? "jade" : "brand"}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            {calc.baseHit
              ? "기본 한도에 닿았습니다. 남은 기간 결제수단을 바꿔도 기본 공제는 늘지 않습니다."
              : `기본 한도까지 ${formatMan(Math.round((calc.baseLimit - calc.baseDeduction) * 10) / 10)} 여유가 있습니다.`}{" "}
            추가 한도는 기본 한도를 넘는 공제액에만 붙습니다.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-paper-deep p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">계산 전 확인</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#4a4636]">
            <li>· 최저사용금액은 신용카드 사용분부터 채워집니다.</li>
            <li>· 보험료·공과금·아파트 관리비·수업료는 어느 카드로 써도 빠집니다.</li>
            <li>· 가족카드는 카드 명의자 사용액으로 봅니다(소득요건 충족 시 합산).</li>
            <li>· 근로를 제공한 기간에 쓴 금액만 대상입니다.</li>
          </ul>
        </div>
      </div>

      {/* 남은 기간 결제수단 전환 — 12월의 실제 판단 */}
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-bold text-ink">남은 기간, 체크카드로 바꾸면</p>
          <span className="text-[12px] text-ink-faint">2026. 12. 31. 입금·결제분까지</span>
        </div>
        <div className="mt-2 grid gap-1 md:grid-cols-2 md:gap-x-8">
          <MoneySlider label="남은 기간 예상 지출" value={rest} onChange={setRest} min={0} max={500} step={10} />
          <Segmented
            label="내 과세표준 구간"
            value={marginal}
            onChange={setMarginal}
            options={MARGINAL_RATES.map((m) => ({ value: String(m.withLocal), label: m.label }))}
            hint={`줄어드는 세금은 공제액 × ${rateLabel} (기본세율 + 지방소득세 10%)로 계산합니다.`}
          />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-[12px] text-ink-muted">전부 신용카드로 결제</p>
            <p className="mt-1 text-[17px] font-bold tabular-nums text-ink">{formatMan(switchCase.asCard.total)}</p>
            <p className="text-[12px] text-ink-faint">소득공제 합계</p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-[12px] text-ink-muted">전부 체크카드로 결제</p>
            <p className="mt-1 text-[17px] font-bold tabular-nums text-jade">{formatMan(switchCase.asDebit.total)}</p>
            <p className="text-[12px] text-ink-faint">소득공제 합계</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-[1.7] text-ink-soft" data-switch-diff>
          {switchCase.diffMan === 0 ? (
            <>
              바꿔도 공제액이 늘지 않습니다.{" "}
              {thresholdLeft > 0
                ? "아직 최저사용금액에 못 미쳐, 바꾼 금액이 문턱을 채우는 데 쓰입니다."
                : calc.baseHit
                  ? "이미 한도에 닿아 있어 결제수단과 관계없이 늘지 않습니다."
                  : "남은 지출이 없거나, 바꾼 금액이 문턱·한도 안에서 움직이지 않습니다."}
            </>
          ) : (
            <>
              공제가 <b className="text-ink">{formatMan(switchCase.diffMan)}</b> 늘고, 세금은 약{" "}
              <b className="text-ink">{formatKrw(switchCase.diffWon)}</b> 줄어듭니다. 10만원을 체크카드로 더 쓰면
              공제 3만원, 세금 4,950원 수준입니다.
            </>
          )}
        </p>
      </div>

      <SaveResultCard
        title="신용카드 소득공제 계산"
        subtitle={`총급여 ${formatMan(salary)} · 자녀등 ${childLabel[children]} · 2026년 귀속`}
        rows={resultRows}
        notes={[
          "조세특례제한법 제126조의2 기준. 실제 환급액은 산출세액과 다른 공제에 따라 달라집니다.",
          "보험료·공과금·관리비·수업료는 공제 대상에서 빠집니다.",
        ]}
        fileBase="buffetkimz-신용카드공제"
      />

      {!compact && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">총급여별 최저사용금액과 기본 한도</caption>
            <thead>
              <tr className="border-b border-line bg-paper-deep text-left">
                <th scope="col" className="px-3 py-2.5 font-semibold text-ink-soft">총급여</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">최저사용금액(25%)</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">기본 한도(자녀 없음)</th>
              </tr>
            </thead>
            <tbody>
              {[4000, 5500, 6000, 7000, 8000].map((man) => (
                <tr key={man} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-ink">{formatMan(man)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">
                    {formatMan(Math.round(man * CREDIT_CARD.thresholdRate))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">
                    {formatMan(creditCardDeduction({ salaryMan: man, children: 0, card: 0, debit: 0, culture: 0, market: 0, transport: 0 }).baseLimit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StickySummary
        items={[
          { label: "예상 소득공제", value: formatMan(calc.total) },
          { label: "문턱", value: formatMan(calc.threshold) },
        ]}
      />

      <p className="mt-4">
        <a
          href={withBase("/apps/salary-net/run")}
          className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4"
        >
          총급여와 실수령액이 궁금하면 — 연봉 실수령 계산기
        </a>
      </p>

      <Note>
        조세특례제한법 제126조의2(시행 2026. 9. 18.)·시행령 제121조의2와 국세청 신용카드 등 사용액 안내 기준입니다. 공제액은
        과세표준을 낮추는 금액이며, 실제로 줄어드는 세금은 본인의 과세표준 구간 세율에 따라 달라집니다.
      </Note>
    </RunnerShell>
  );
}
