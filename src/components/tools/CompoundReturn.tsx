import { useMemo, useState } from "react";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatMan } from "./ui";
import {
  COMPOUND_DOWNSIDE_RATE,
  COMPOUND_EXAMPLE,
  TAX_MODE,
  compoundProjection,
  manLabel,
  pctLabel,
  type CompoundResult,
  type TaxMode,
} from "@/lib/finance";
import { site } from "@/config/site";

const pctPoint = (v: number) => `${v.toFixed(1)}%`;
const pctFine = (v: number) => `${v.toFixed(2)}%`;

export default function CompoundReturn({ compact = false }: { compact?: boolean }) {
  const [initial, setInitial] = useState(COMPOUND_EXAMPLE.initial);
  const [monthly, setMonthly] = useState(COMPOUND_EXAMPLE.monthly);
  const [years, setYears] = useState(COMPOUND_EXAMPLE.years);
  const [rate, setRate] = useState(COMPOUND_EXAMPLE.rate * 100);
  const [fee, setFee] = useState((COMPOUND_EXAMPLE.fee ?? 0) * 100);
  const [mode, setMode] = useState<TaxMode>(COMPOUND_EXAMPLE.mode);

  const result: CompoundResult = useMemo(
    () => compoundProjection({ initial, monthly, years, rate: rate / 100, fee: fee / 100, mode }),
    [initial, monthly, years, rate, fee, mode]
  );

  /** 같은 조건에서 과세 방식만 바꾼 세후 금액 — 세 계좌를 나란히 비교한다 */
  const compare = (Object.keys(TAX_MODE) as TaxMode[]).map((m) => ({
    mode: m,
    ...TAX_MODE[m],
    projection: compoundProjection({ initial, monthly, years, rate: rate / 100, fee: fee / 100, mode: m }),
  }));

  const maxBar = Math.max(result.gross, result.principal, 1);
  const principalShare = result.gross > 0 ? result.principal / result.gross : 0;

  /* 같은 조건에서 수익률만 -3%였을 때 — 원금 손실이 얼마인지 보여 주기 위한 계산 */
  const downside = compoundProjection({
    initial,
    monthly,
    years,
    rate: COMPOUND_DOWNSIDE_RATE,
    fee: fee / 100,
    mode,
  });
  const downsideLoss = Math.max(0, result.principal - downside.net);
  /* 손실 가상의 실제 적용 수익률(보수 차감 후) — 표기와 계산이 같은 값에서 나오게 한다 */
  const downsideRatePct = (COMPOUND_DOWNSIDE_RATE * 100).toFixed(1);
  const downsideNetPct = Math.abs(downside.netRate * 100).toFixed(2);
  const appliedFeePct = pctFine(result.feeRate * 100);

  const verdict = `${years}년 뒤 원금 ${manLabel(result.principal)}은 보수 ${appliedFeePct}와 세금을 빼면 ${manLabel(
    result.net
  )}으로 추정됩니다(연 ${rate.toFixed(1)}% 가정·보장 아님).`;

  const checks = [
    `수익률 ${rate.toFixed(1)}%는 기대값이지 보장이 아닙니다. 같은 기간 연 ${downsideRatePct}%였다면(보수 차감 후 -${downsideNetPct}%) 세후 평가액은 ${manLabel(
      downside.net
    )}으로 원금보다 ${manLabel(downsideLoss)} 적습니다.`,
    `빠지는 돈은 두 가지입니다. 보수 ${appliedFeePct}(누적 ${manLabel(result.feeCost)})와 세금 ${pctLabel(
      result.taxRate
    )}(평가손익에만 부과, ${manLabel(result.tax)}). 둘을 뺀 뒤가 세후 평가액입니다.`,
    mode === "pension"
      ? "연금저축은 55세 이후·5년 이상 납입 같은 요건을 채워야 과세이연이 유지됩니다. 중도 해지하면 기타소득세가 붙습니다."
      : mode === "isa"
        ? "ISA 일반형은 이익 200만원까지 비과세, 초과분만 9.9% 분리과세입니다(서민형·농어민형 400만원). 의무 가입 3년을 채워야 혜택이 유지됩니다."
        : "이자·배당소득이 연 2,000만원을 넘으면 금융소득 종합과세 대상이 되어 세율이 달라집니다.",
  ];

  return (
    <RunnerShell
      title="투자 복리·세후 수익률 계산"
      subtitle="보수와 세금을 뺀 뒤 계좌에 남는 금액을 추정합니다."
      example={`초기 ${manLabel(COMPOUND_EXAMPLE.initial)}·월 ${manLabel(COMPOUND_EXAMPLE.monthly)}·${
        COMPOUND_EXAMPLE.years
      }년·연 ${(COMPOUND_EXAMPLE.rate * 100).toFixed(1)}%·연 보수 ${pctFine(
        (COMPOUND_EXAMPLE.fee ?? 0) * 100
      )}·${TAX_MODE[COMPOUND_EXAMPLE.mode].label}로 시작합니다.`}
    >
      {/* 1줄 결론 → 먼저 확인할 항목 → 기준일·출처·한계 */}
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold tracking-[0.02em] text-ink-faint">결론 한 줄 (가정 기반 추정)</p>
        <p className="mt-1.5 text-[15.5px] font-bold leading-[1.55] tracking-[-0.02em] text-ink" data-compound-verdict>
          {verdict}
        </p>

        <p className="mt-3.5 text-[12px] font-semibold tracking-[0.02em] text-ink-faint">먼저 확인할 항목 3개</p>
        <ol className="mt-1.5 space-y-1.5" data-compound-checks>
          {checks.map((c, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-[1.65] text-ink-soft">
              <span className="mt-[2px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-deep">
                {i + 1}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>

        <p className="mt-3 border-t border-line-soft pt-2 text-[12px] leading-relaxed text-ink-faint">
          기준일 {site.baseDate} · 출처: 소득세법 제16조·제17조(이자·배당소득), 조세특례제한법(ISA),
          소득세법 제59조의3(연금계좌) · 한계: 월 복리·매년 같은 수익률·분배금 전액 재투자 가정, 물가상승 미반영
        </p>
      </div>

      {/* 기본 입력 4개 — 나머지 가정은 아래 '가정 더 보기'로 접는다 */}
      <div className="mt-4 grid gap-1 md:grid-cols-2 md:gap-x-8">
        <MoneySlider label="초기 투자금" value={initial} onChange={setInitial} min={0} max={10000} step={100} />
        <MoneySlider label="월 적립액" value={monthly} onChange={setMonthly} min={0} max={200} step={5} />
        <MoneySlider
          label="투자 기간"
          value={years}
          onChange={setYears}
          min={1}
          max={40}
          step={1}
          format={(v) => `${v}년`}
          hint={`${result.months}개월`}
        />
        <MoneySlider label="연 기대 수익률" value={rate} onChange={setRate} min={0} max={12} step={0.5} format={pctPoint} />
      </div>

      <details className="mt-2 rounded-xl border border-line bg-white px-4 py-1" data-compound-more>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-ink-soft">
          가정 더 보기 — 과세 방식·운용 보수
          <span className="text-[12px] font-normal text-ink-faint">
            {TAX_MODE[mode].short} · 보수 {appliedFeePct}
          </span>
        </summary>
        <div className="grid gap-1 border-t border-line-soft pb-2 md:grid-cols-2 md:gap-x-8">
          <MoneySlider
            label="연 운용 보수·수수료"
            value={fee}
            onChange={setFee}
            min={0}
            max={2}
            step={0.05}
            format={pctFine}
            hint="ETF·펀드 총보수 등"
          />
          <div className="md:col-span-2">
            <Segmented
              label="과세 방식"
              value={mode}
              onChange={setMode}
              options={(Object.keys(TAX_MODE) as TaxMode[]).map((k) => ({ value: k, label: TAX_MODE[k].label }))}
              hint={`세율 ${pctLabel(result.taxRate)} · ${TAX_MODE[mode].note}`}
            />
          </div>
        </div>
      </details>

      {/* 결과 — 원금·세전, 그리고 세후 예상 구간과 원금 손실 안내를 같은 비중으로 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ResultStat
          label="총 납입 원금"
          value={formatMan(result.principal)}
          sub={`초기 ${formatMan(initial)} + 월 ${formatMan(monthly)} × ${result.months}개월`}
        />
        <ResultStat
          label="세전 평가액 (보수 차감 후)"
          value={formatMan(result.gross)}
          tone="brand"
          sub={`평가손익 ${formatMan(result.gain)} · 원금 대비 ${pctLabel(result.grossReturn)} · 가정 기반`}
        />
      </div>

      {/* 계산 결과 바로 옆에 세율의 기준을 붙인다 — 15.4%가 '이자·배당소득' 기준임을 분명히 */}
      <p
        className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px] leading-[1.65] text-ink-muted"
        data-tax-basis
      >
        <strong className="font-semibold text-ink">세율 기준</strong>{" "}
        {mode === "general" ? (
          <>
            일반계좌 15.4%는 이자·배당소득세(소득세 14% + 지방소득세 1.4%)를 단순 적용한 예시입니다. 주식
            매매차익 과세와는 구분되며, 금융소득이 연 2,000만원을 넘으면 종합과세 대상이 되어 세율이 달라집니다.
          </>
        ) : mode === "isa" ? (
          <>ISA 9.9%는 이익 200만원을 넘는 부분에 적용하는 분리과세율입니다(서민형·농어민형 400만원).</>
        ) : (
          <>연금저축은 운용 중 과세이연, 인출 시 연금소득세 3.3~5.5%를 가정했습니다(55세·5년 이상 납입 요건).</>
        )}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2" data-compound-range-risk>
        <div className="rounded-xl border border-line bg-white p-4" data-compound-range>
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">세후 예상 구간</p>
          <p className="mt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-ink">
            {manLabel(downside.net)} ~ {manLabel(result.net)}
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.65] text-ink-muted">
            수익률 {downsideRatePct}% ~ +{rate.toFixed(1)}% 가정 범위입니다. 확정 금액이 아니며, 기준 가정에서는{" "}
            <strong className="font-semibold text-ink">{manLabel(result.net)}</strong>입니다.
          </p>
          <p className="mt-1 text-[12px] text-ink-faint">
            가정: 기대 수익률 {pctPoint(rate)} · 연 보수 {appliedFeePct} · {TAX_MODE[mode].short}{" "}
            {pctLabel(result.taxRate)} · 보수·세금 차감 후
          </p>
        </div>

        <div className="rounded-xl border border-[#d9b8a9] bg-[#fbf3ef] p-4" data-compound-risk>
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#8a4a2e]">원금 손실 가능 안내</p>
          <p className="mt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-[#8a4a2e]">
            −{manLabel(downsideLoss)}
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.65] text-[#4a4636]">
            같은 기간 연 {downsideRatePct}%(보수 차감 후 -{downsideNetPct}%)라면 세후 평가액은{" "}
            <strong className="font-semibold text-ink">{manLabel(downside.net)}</strong>으로 원금보다 적습니다. 원금
            손실은 세금으로 되돌려 받지 못하며, 손실 이월 공제도 이 계산에 넣지 않았습니다.
          </p>
          <p className="mt-1 text-[12px] text-[#6b5a45]">
            수익률은 보장된 값이 아닙니다 · 원금 손실 가능 · 이자·배당소득 연 2,000만원 초과 시 종합과세
          </p>
        </div>
      </div>

      {/* 적용된 가정 한 줄 — 접혀 있어도 항상 보인다 */}
      <p
        className="mt-2 rounded-lg border border-line bg-paper-deep/70 px-3 py-2 text-[12px] leading-[1.6] text-ink-muted"
        data-compound-assumptions
      >
        적용 가정: 기대 수익률 {pctPoint(rate)} · 연 보수 {appliedFeePct} · {TAX_MODE[mode].short}{" "}
        {pctLabel(result.taxRate)} · 분배금 전액 재투자 · 월 복리 · 물가상승 미반영 · 기준일 {site.baseDate}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">원금 · 평가액 · 빠지는 돈</p>
          <ul className="mt-3 space-y-3.5">
            {[
              { label: "총 납입 원금", value: result.principal, tone: "brand" as const, note: "내가 넣은 돈" },
              { label: "세전 평가액", value: result.gross, tone: "brand" as const, note: `+${manLabel(result.gain)}` },
              { label: "세후 평가액", value: result.net, tone: "jade" as const, note: `−${manLabel(result.tax)}` },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatMan(row.value)}</span>
                </div>
                <div className="mt-1">
                  <Bar ratio={row.value / maxBar} tone={row.tone} />
                </div>
                <p className="mt-0.5 text-[12px] text-ink-faint">{row.note}</p>
              </div>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-2 text-[12px] leading-[1.6] text-ink-faint">
            세전 평가액 가운데 원금이 차지하는 비중은 {pctLabel(principalShare, 0)}입니다. 나머지는 수익이며,
            수익에는 보수와 세금이 함께 붙습니다.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-white p-4" data-compound-costs>
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">수수료와 세금은 따로</p>
          <dl className="mt-2.5 space-y-2 text-[12.5px]">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">보수로 줄어든 금액 (복리 영향 포함)</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">{manLabel(result.feeCost)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">
                세금 (평가손익{result.exempt > 0 ? ` − 비과세 ${manLabel(result.exempt)}` : ""} × {pctLabel(result.taxRate)})
              </dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">{manLabel(result.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-line pt-2">
              <dt className="font-semibold text-ink">남는 수익(세전 평가액 − 원금)</dt>
              <dd className="whitespace-nowrap font-bold tabular-nums text-brand-deep">{manLabel(result.gain)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[12px] leading-[1.6] text-ink-faint">
            보수는 매년 수익률에서 빠지는 비용이라, 20년을 두면 낸 보수의 몇 배가 평가액에서 사라집니다.
            실제 보수는 상품·판매사에 따라 다르니 투자설명서로 확인하세요.
          </p>
        </div>
      </div>

      {/* 계좌 종류별 비교 — 같은 조건에서 세후 금액만 다르다 */}
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white" data-compound-compare>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">계좌 종류별 세후 비교</p>
          <p className="text-[12px] text-ink-faint">같은 납입·수익률·보수, 세금만 다르게</p>
        </div>
        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <caption className="sr-only">일반계좌·ISA·연금저축의 세후 평가액 비교</caption>
          <thead>
            <tr className="border-b border-line bg-paper-deep text-left">
              <th scope="col" className="px-2.5 py-2 font-semibold text-ink-soft sm:px-3">계좌</th>
              <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-ink-soft sm:table-cell">세율</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold text-ink-soft sm:px-3">세금</th>
              <th scope="col" className="px-2.5 py-2 text-right font-semibold text-ink-soft sm:px-3">
                세후<span className="sm:hidden"> 평가액</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {compare.map((c) => (
              <tr
                key={c.mode}
                className={`border-b border-line-soft last:border-0 ${c.mode === mode ? "bg-brand-soft/40" : ""}`}
              >
                <td className="px-2.5 py-2 font-semibold text-ink sm:px-3">
                  {c.short}
                  {c.mode === mode && <span className="ml-1.5 text-[11.5px] font-normal text-brand-deep">선택</span>}
                  <span className="mt-0.5 block text-[12px] font-normal tabular-nums text-ink-muted sm:hidden">
                    <span className="whitespace-nowrap">{pctLabel(c.rate)}</span>
                    {c.exempt > 0 && <span className="block whitespace-nowrap">비과세 {c.exempt}만</span>}
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-ink-muted sm:table-cell">
                  {pctLabel(c.rate)}
                  {c.exempt > 0 && <span className="ml-1 text-[11.5px] text-ink-faint">비과세 {c.exempt}만</span>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(c.projection.tax)}</td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums text-ink sm:px-3">
                  {manLabel(c.projection.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line-soft bg-paper-deep/50 px-3 py-2 text-[12px] leading-[1.6] text-ink-muted">
          ISA는 일반형 기준(비과세 200만원, 서민형·농어민형 400만원)이고, 연금저축은 운용 중 과세이연 후 인출 시
          연금소득세를 적용했습니다. 일반계좌는 이자·배당소득이 연 2,000만원을 넘으면 종합과세로 세율이 올라갑니다.
          세 계좌 모두 나이·소득·가입 기간 요건이 따로 있습니다.
        </p>
      </div>

      {!compact && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] text-ink-muted">
              연차별 원금·세전·세후 평가액(표로 읽는 같은 값 · 모두 추정치)
            </caption>
            <thead>
              <tr className="border-b border-line bg-paper-deep text-left">
                <th scope="col" className="px-2.5 py-2.5 font-semibold text-ink-soft sm:px-3">기간</th>
                <th scope="col" className="hidden px-3 py-2.5 text-right font-semibold text-ink-soft sm:table-cell">
                  납입 원금
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">
                  세전<span className="sm:hidden"> 평가액</span>
                </th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold text-ink-soft sm:px-3">
                  세후<span className="sm:hidden"> 평가액</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set([1, 5, 10, 20, 30, years].filter((y) => y <= years))).map((y) => {
                const row = compoundProjection({
                  initial,
                  monthly,
                  years: y,
                  rate: rate / 100,
                  fee: fee / 100,
                  mode,
                });
                return (
                  <tr key={y} className="border-b border-line-soft last:border-0">
                    <td className="px-2.5 py-2.5 font-semibold text-ink sm:px-3">
                      {y}년{y === years && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">내 입력</span>}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-muted sm:table-cell">
                      {manLabel(row.principal)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(row.gross)}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(row.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StickySummary
        items={[
          { label: "세후 평가액", value: manLabel(result.net) },
          { label: "세전 평가액", value: manLabel(result.gross) },
        ]}
      />

      <Note>
        참고용 단순 복리 계산(원금 손실 가능·실제 세법 요건 별도 확인). 수익률은 보장된 값이 아니며, 같은
        기간에 손실이 났다면 결과는 원금보다 작아집니다. 세율과 과세 방식은 이해를 돕기 위한 가정이고, 실제
        과세는 계좌 종류와 소득 구간, 금융소득 종합과세 여부에 따라 달라집니다. 배당·분배금은 전액 재투자한
        것으로 보았고, 물가상승은 반영하지 않았습니다. 기준일 {site.baseDate}.
      </Note>
    </RunnerShell>
  );
}
