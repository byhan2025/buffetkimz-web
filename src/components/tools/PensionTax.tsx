import { useMemo, useState } from "react";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw, formatMan } from "./ui";

type Bracket = "low" | "high";

const RATE: Record<Bracket, number> = { low: 0.165, high: 0.132 };
const PENSION_LIMIT = 600; // 만원
const TOTAL_LIMIT = 900; // 만원
const ISA_EXTRA_LIMIT = 300; // 만원

export default function PensionTax({ compact = false }: { compact?: boolean }) {
  const [bracket, setBracket] = useState<Bracket>("low");
  const [pension, setPension] = useState(200);
  const [irp, setIrp] = useState(100);
  const [isa, setIsa] = useState(0);

  const rate = RATE[bracket];

  const calc = useMemo(() => {
    const pensionEligible = Math.min(pension, PENSION_LIMIT);
    const comboBeforeIsa = pension + irp;
    const baseEligible = Math.min(comboBeforeIsa, TOTAL_LIMIT);
    const isaExtra = Math.min(Math.floor(isa * 0.1), ISA_EXTRA_LIMIT);
    const eligible = Math.min(baseEligible + isaExtra, TOTAL_LIMIT + ISA_EXTRA_LIMIT);

    const credit = Math.round(eligible * 10000 * rate);
    const maxCredit = Math.round((TOTAL_LIMIT + ISA_EXTRA_LIMIT) * 10000 * rate);

    const pensionLeft = Math.max(PENSION_LIMIT - pensionEligible, 0);
    const comboLeft = Math.max(TOTAL_LIMIT - baseEligible, 0);
    const isaLeft = Math.max(ISA_EXTRA_LIMIT - isaExtra, 0);
    const remainingTotal = comboLeft + isaLeft;
    const extraCredit = Math.round(remainingTotal * 10000 * rate);

    return {
      eligible,
      credit,
      maxCredit,
      pensionLeft,
      comboLeft,
      isaLeft,
      remainingTotal,
      extraCredit,
      appliedRate: rate,
    };
  }, [pension, irp, isa, rate]);

  return (
    <RunnerShell
      title="연금저축·IRP 세액공제 계산"
      subtitle="올해 납입액으로 예상 세액공제액과 남은 한도를 계산합니다."
      example="총급여 구간과 납입액(연금저축 200만·IRP 100만)을 바꿔 보세요."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <Segmented
          label="소득 구간"
          value={bracket}
          onChange={setBracket}
          options={[
            { value: "low", label: "총급여 5,500만원 이하" },
            { value: "high", label: "5,500만원 초과" },
          ]}
          hint="공제율 16.5% 또는 13.2% (지방소득세 포함)."
        />
        <MoneySlider label="연금저축 납입액" value={pension} onChange={setPension} min={0} max={1800} step={20} />
        <MoneySlider label="IRP 납입액" value={irp} onChange={setIrp} min={0} max={1800} step={20} />
        <MoneySlider
          label="ISA 만기 이전액"
          value={isa}
          onChange={setIsa}
          min={0}
          max={3000}
          step={100}
          hint="10% · 최대 300만원 추가"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ResultStat
          label="예상 세액공제액"
          value={formatKrw(calc.credit)}
          tone="brand"
          sub={`공제 대상 ${formatMan(calc.eligible)} × ${(calc.appliedRate * 100).toFixed(1)}%`}
        />
        <ResultStat
          label="올해 채울 수 있는 한도"
          value={formatMan(TOTAL_LIMIT + ISA_EXTRA_LIMIT)}
          sub={`연금저축 600 + IRP 300 + ISA 300`}
        />
        <ResultStat
          label="한도까지 더 넣으면"
          value={formatKrw(calc.extraCredit)}
          tone="jade"
          sub={`남은 ${formatMan(calc.remainingTotal)} 기준`}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">계좌별 진행</p>
          <div className="mt-3 space-y-3.5">
            {[
              { label: "연금저축 (한도 600)", used: Math.min(pension, PENSION_LIMIT), limit: PENSION_LIMIT },
              { label: "연금저축+IRP (한도 900)", used: Math.min(pension + irp, TOTAL_LIMIT), limit: TOTAL_LIMIT },
              { label: "ISA 이전 추가 (한도 300)", used: Math.min(Math.floor(isa * 0.1), ISA_EXTRA_LIMIT), limit: ISA_EXTRA_LIMIT },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[12px]">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatMan(row.used)} / {formatMan(row.limit)}
                  </span>
                </div>
                <div className="mt-1">
                  <Bar ratio={row.limit ? row.used / row.limit : 0} tone={row.used >= row.limit ? "jade" : "brand"} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            12월 31일까지 입금된 금액만 올해 공제 대상입니다. 연금저축만으로는 600만원까지만 공제됩니다.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-paper-deep p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">계산 전 확인</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#4a4636]">
            <li>· 세액공제는 그해 산출세액을 넘을 수 없습니다.</li>
            <li>· 퇴직금 이전액·계좌 간 이전액·회사 부담금은 공제 대상이 아닙니다.</li>
            <li>· 연금저축 중도 해지 시 공제받은 금액에 기타소득세가 붙습니다.</li>
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">납입액별 예상 세액공제액</caption>
            <thead>
              <tr className="border-b border-line bg-paper-deep text-left">
                <th scope="col" className="px-3 py-2.5 font-semibold text-ink-soft">연 납입액</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">16.5%</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">13.2%</th>
              </tr>
            </thead>
            <tbody>
              {[300, 600, 900, 1200].map((man) => (
                <tr key={man} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-ink">
                    {formatMan(man)}
                    {man === 900 && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">표준 한도</span>}
                    {man === 1200 && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">ISA 이전 포함</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatKrw(man * 10000 * 0.165)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatKrw(man * 10000 * 0.132)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StickySummary
        items={[
          { label: "예상 세액공제", value: formatKrw(calc.credit) },
          { label: "남은 한도", value: formatMan(calc.remainingTotal) },
        ]}
      />

      <Note>
        소득세법 제59조의3 기준(기준일 2026. 11. 21.). 실제 환급액은 산출세액과 다른 공제에 따라 달라지며,
        한도를 넘는 납입액은 다음 해 이월 공제를 신청할 수 있습니다.
      </Note>
    </RunnerShell>
  );
}
