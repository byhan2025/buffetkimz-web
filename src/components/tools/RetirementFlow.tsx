import { useMemo, useState } from "react";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, StickySummary, formatMan } from "./ui";
import {
  PRIVATE_PENSION_TAX,
  PUBLIC_PENSION_HEALTH_LIMIT,
  RETIREMENT_EXAMPLE,
  manLabel,
  pctLabel,
  retirementProjection,
  type RetirementResult,
} from "@/lib/finance";
import { withBase, site } from "@/config/site";

const ageFormat = (v: number) => `${v}세`;
const pctPoint = (v: number) => `${v.toFixed(1)}%`;

/** 예시값과 같은 기본값으로 시작한다 — 홈 카드·스트립과 숫자가 같아야 한다. */
export default function RetirementFlow({ compact = false }: { compact?: boolean }) {
  const [currentAge, setCurrentAge] = useState(RETIREMENT_EXAMPLE.currentAge);
  const [retireAge, setRetireAge] = useState(RETIREMENT_EXAMPLE.retireAge);
  const [lifeAge, setLifeAge] = useState(RETIREMENT_EXAMPLE.lifeAge);
  const [nps, setNps] = useState(RETIREMENT_EXAMPLE.npsMonthly);
  const [dc, setDc] = useState(RETIREMENT_EXAMPLE.dcBalance);
  const [personal, setPersonal] = useState(RETIREMENT_EXAMPLE.personalBalance);
  const [monthly, setMonthly] = useState(RETIREMENT_EXAMPLE.personalMonthly);
  const [target, setTarget] = useState(RETIREMENT_EXAMPLE.targetMonthly);
  const [inflation, setInflation] = useState(RETIREMENT_EXAMPLE.inflation * 100);
  const [rate, setRate] = useState(RETIREMENT_EXAMPLE.returnRate * 100);

  /* 은퇴 나이는 현재 나이 뒤, 기대 수명은 은퇴 나이 뒤로 자동으로 맞춘다. */
  const safeRetire = Math.max(retireAge, currentAge + 1);
  const safeLife = Math.max(lifeAge, safeRetire + 1);
  const adjusted = safeRetire !== retireAge || safeLife !== lifeAge;

  const result: RetirementResult = useMemo(
    () =>
      retirementProjection({
        currentAge,
        retireAge: safeRetire,
        lifeAge: safeLife,
        npsMonthly: nps,
        dcBalance: dc,
        personalBalance: personal,
        personalMonthly: monthly,
        inflation: inflation / 100,
        returnRate: rate / 100,
        targetMonthly: target,
      }),
    [currentAge, safeRetire, safeLife, nps, dc, personal, monthly, inflation, rate, target]
  );

  const { nominal, real, gap } = result;
  const maxBar = Math.max(nominal.nps, nominal.dc, nominal.personal, 1);
  const rows = [
    { key: "nps", name: "국민연금", nominal: nominal.nps, real: real.nps },
    { key: "dc", name: "퇴직연금", nominal: nominal.dc, real: real.dc },
    { key: "personal", name: "개인연금", nominal: nominal.personal, real: real.personal },
  ];

  /* 사적연금(퇴직·개인) 연 수령액 — 1,500만원 기준을 넘는지 */
  const privateAnnual = (nominal.dc + nominal.personal) * 12;
  const overPrivate = privateAnnual > PRIVATE_PENSION_TAX.annualThreshold;
  const publicAnnual = nominal.nps * 12;
  const overPublic = publicAnnual > PUBLIC_PENSION_HEALTH_LIMIT;

  /* 판정하지 않는다 — '예시 가정 기준 점검 · 추가 확인 필요' 톤으로만 적는다. */
  const verdict = `예시 가정 기준, ${safeLife}세까지 매달 ${manLabel(
    real.total
  )}(오늘 가치)으로 계산됩니다. 목표 ${manLabel(target)}과 ${manLabel(Math.abs(gap))} 차이 — 추가 확인 필요.`;

  const checks = [
    `국민연금 예상액(월 ${manLabel(nps)})은 입력값입니다. 국민연금공단 '내 연금 알아보기'의 확정 예상액과 대조하세요.`,
    `목표와의 차이 ${manLabel(Math.abs(gap))}는 가정에 따라 달라집니다. 물가 3.0%·수익률 2.0%처럼 불리한 조건도 넣어 보세요.`,
    `퇴직연금 ${manLabel(result.dcAtRetire)}은 ${result.payoutYears}년에 나눠 받는 것으로 계산했습니다. 일시금·연금 수령 방식과 운용 지시를 확인하세요.`,
  ];

  return (
    <RunnerShell
      title="은퇴 월 현금흐름 시뮬레이션"
      subtitle="은퇴 시점의 월 수령액을 명목과 오늘 가치로 나눠 계산합니다."
      example="현재 45세·은퇴 65세·국민연금 월 120만원·퇴직연금 8,000만원·개인연금 5,000만원(월 50만원 납입)으로 시작합니다."
    >
      {/* 1줄 결론 → 먼저 확인할 항목 → 기준일 */}
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold tracking-[0.02em] text-ink-faint">결론 한 줄 (가정 기반 추정)</p>
        <p
          className="mt-1.5 text-[15.5px] font-bold leading-[1.55] tracking-[-0.02em] text-ink"
          data-retirement-verdict
        >
          {verdict}
        </p>

        <p className="mt-3.5 text-[12px] font-semibold tracking-[0.02em] text-ink-faint">먼저 확인할 항목 3개</p>
        <ol className="mt-1.5 space-y-1.5" data-retirement-checks>
          {checks.map((c, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-[1.65] text-ink-soft">
              <span className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-deep">
                {i + 1}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>

        <p className="mt-3 border-t border-line-soft pt-2 text-[12px] leading-relaxed text-ink-faint">
          기준일 {site.baseDateLabel} · 가정: 국민연금 물가연동(공단 확정액 아님) · 퇴직·개인연금은 은퇴 시점 적립금을{" "}
          {result.payoutYears}년에 균등 분할 · 세금·건강보험료·수수료 미반영
        </p>
      </div>

      {/* 기본 입력 4개 — 나이·공적연금·납입액만. 나머지는 '가정 더 보기'로 접는다 */}
      <div className="mt-4 grid gap-1 md:grid-cols-2 md:gap-x-8">
        <MoneySlider label="현재 나이" value={currentAge} onChange={setCurrentAge} min={20} max={70} step={1} format={ageFormat} />
        <MoneySlider label="은퇴 희망 나이" value={retireAge} onChange={setRetireAge} min={40} max={80} step={1} format={ageFormat} />
        <MoneySlider label="예상 국민연금 (월)" value={nps} onChange={setNps} min={0} max={300} step={5} hint="오늘 가치" />
        <MoneySlider label="개인연금 월 납입액" value={monthly} onChange={setMonthly} min={0} max={200} step={5} hint="은퇴까지" />
      </div>

      <details className="mt-2 rounded-xl border border-line bg-white px-4 py-1" data-retirement-more>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-ink-soft">
          가정 더 보기 — 수령 기간·적립금·목표·물가·수익률
          <span className="text-[12px] font-normal text-ink-faint">
            수령 {result.payoutYears}년 · 목표 {manLabel(target)}
          </span>
        </summary>
        <div className="grid gap-1 border-t border-line-soft pb-2 md:grid-cols-2 md:gap-x-8">
          <MoneySlider
            label="기대 수명 (수령 기간)"
            value={lifeAge}
            onChange={setLifeAge}
            min={70}
            max={100}
            step={1}
            format={ageFormat}
            hint={adjusted ? `은퇴 ${safeRetire}세 · ${result.payoutYears}년 수령으로 맞춤` : `${result.payoutYears}년 수령`}
          />
          <MoneySlider label="목표 월 생활비" value={target} onChange={setTarget} min={100} max={600} step={10} hint="오늘 가치" />
          <MoneySlider label="퇴직연금 적립금" value={dc} onChange={setDc} min={0} max={30000} step={100} />
          <MoneySlider label="개인연금 적립금" value={personal} onChange={setPersonal} min={0} max={30000} step={100} hint="연금저축·IRP" />
          <MoneySlider label="연평균 물가상승률" value={inflation} onChange={setInflation} min={0} max={5} step={0.1} format={pctPoint} hint="기본 2.5%" />
          <MoneySlider label="기대 수익률" value={rate} onChange={setRate} min={0} max={8} step={0.1} format={pctPoint} hint="기본 4.0%" />
        </div>
      </details>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ResultStat
          label={`${safeRetire}세 은퇴 시 월 수령액(추정)`}
          value={formatMan(nominal.total)}
          tone="brand"
          sub={`국민 ${formatMan(nominal.nps)} + 퇴직 ${formatMan(nominal.dc)} + 개인 ${formatMan(nominal.personal)} · 가정 기반`}
        />
        <ResultStat
          label="오늘 가치(추정)"
          value={formatMan(real.total)}
          sub={`물가 ${pctPoint(inflation)} × ${result.years}년 반영 · 확정 금액 아님`}
        />
        <ResultStat
          label="목표 월 생활비와의 차이"
          value={`${gap >= 0 ? "+" : "−"}${formatMan(Math.abs(gap))}`}
          tone={gap >= 0 ? "jade" : "brand"}
          sub="예시 가정 기준 점검 · 추가 확인 필요"
        />
      </div>

      {/* 적용된 가정 한 줄 — 접혀 있어도 항상 보인다 */}
      <p
        className="mt-2 rounded-lg border border-line bg-paper-deep/70 px-3 py-2 text-[12px] leading-[1.6] text-ink-muted"
        data-retirement-assumptions
      >
        적용 가정: 물가상승률 {pctPoint(inflation)} · 기대 수익률 {pctPoint(rate)} · 인출률 연{" "}
        {(result.withdrawalRate * 100).toFixed(1)}% · 수령 {result.payoutYears}년 · 국민연금 물가연동 · 확정 수령액 아닌
        가정 · 기준일 {site.baseDateLabel}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">월 수령액 — 명목과 오늘 가치</p>
            <p className="flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand" />명목</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#7fb5a2]" />오늘 가치</span>
            </p>
          </div>

          <ul className="mt-3 space-y-3">
            {rows.map((r) => (
              <li key={r.key} data-retirement-row={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{r.name}</span>
                  <span className="mono tabular-nums text-ink-soft">
                    {formatMan(r.nominal)}
                    <span className="ml-1.5 text-ink-faint">/ {formatMan(r.real)}</span>
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  <Bar ratio={r.nominal / maxBar} tone="brand" />
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-[#7fb5a2]"
                      style={{ width: `${Math.max(2, Math.min(100, (r.real / maxBar) * 100))}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5 text-[12.5px]">
            <span className="font-bold text-ink">합계</span>
            <span className="mono font-bold tabular-nums text-ink">
              {formatMan(nominal.total)}
              <span className="ml-1.5 font-normal text-ink-faint">/ {formatMan(real.total)}</span>
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-[1.6] text-ink-faint">
            앞 숫자는 은퇴 시점의 명목 금액, 뒤 숫자는 같은 금액을 오늘 구매력으로 환산한 값입니다. 명목만 보면
            매달 쓸 수 있는 돈이 실제보다 크게 보입니다.
          </p>
        </div>

        {/* 세금·건강보험 기준 — 수령액을 읽기 전에 알아야 하는 두 가지 */}
        <div className="rounded-lg border border-line bg-paper-deep p-4" data-retirement-tax>
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">수령할 때 확인할 기준</p>
          <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-[#4a4636]">
            <li>
              · <strong className="font-semibold text-ink">사적연금 과세</strong> — 연금저축·IRP 수령액이 연{" "}
              {PRIVATE_PENSION_TAX.annualThreshold.toLocaleString("ko-KR")}만원(월{" "}
              {PRIVATE_PENSION_TAX.monthlyThreshold}만원) 이하면 {pctLabel(PRIVATE_PENSION_TAX.lowRate)}~
              {pctLabel(PRIVATE_PENSION_TAX.highRate)} 분리과세. 넘으면 종합소득세 신고 때 다른 소득과{" "}
              합산해 신고하거나 {pctLabel(PRIVATE_PENSION_TAX.overThresholdSeparateRate)} 분리과세(지방소득세 포함{" "}
              {pctLabel(PRIVATE_PENSION_TAX.overThresholdSeparateRateWithLocal)}) 중 선택합니다.
            </li>
            <li>
              · <strong className="font-semibold text-ink">퇴직연금(DC·IRP) 재원</strong> — 퇴직연금의 이연퇴직소득
              재원은 연금으로 받아도 사적연금 연{" "}
              {PRIVATE_PENSION_TAX.annualThreshold.toLocaleString("ko-KR")}만원 합산과 별도로 과세되는 경우가
              있습니다(국세청 기준). 합산 제외 여부는 가입 상품과 수령 방식에 따라 다르므로, 계약·상품 설명에서{" "}
              <strong className="font-semibold text-ink">퇴직급여 재원 제외 여부를 확인하세요</strong>.
            </li>
            <li>
              · <strong className="font-semibold text-ink">이 계산의 사적연금</strong> — 월{" "}
              {manLabel(nominal.dc + nominal.personal)}(연 {manLabel(privateAnnual)}). 위 구분 없이 퇴직·개인연금을
              그대로 더한 값이므로, 실제 합산 대상 금액은 위 기준을 확인한 뒤 달라질 수 있습니다.{" "}
              {overPrivate
                ? "이 값 기준으로는 종합소득세 신고 또는 15% 분리과세(지방소득세 포함 16.5%) 중 선택 대상입니다."
                : "이 값 기준으로는 기준 이하입니다."}
            </li>
            <li>
              · <strong className="font-semibold text-ink">건강보험 피부양자</strong> — 공적연금 소득이 연{" "}
              {PUBLIC_PENSION_HEALTH_LIMIT.toLocaleString("ko-KR")}만원을 넘으면 피부양자 자격을 잃을 수 있습니다(소득·
              재산 요건 함께 적용). 이 계산의 공적연금은 연 {manLabel(publicAnnual)}입니다.
              {overPublic ? " 기준을 넘습니다 — 지역가입자 전환을 확인하세요." : " 기준 이하입니다."}
            </li>
            <li>· 이 시뮬레이션은 위 세금·건강보험료를 반영하지 않았습니다.</li>
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] text-ink-muted">
              월 수령액 비교 — 명목 금액과 오늘 가치(표로 읽는 같은 값)
            </caption>
            <thead>
              <tr className="border-b border-line bg-paper-deep text-left">
                <th scope="col" className="px-2.5 py-2.5 font-semibold text-ink-soft sm:px-3">항목</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">
                  명목<span className="sm:hidden">(은퇴)</span><span className="hidden sm:inline">(은퇴 시점)</span>
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">오늘 가치</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold text-ink-soft sm:px-3">비중</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-line-soft">
                  <td className="px-2.5 py-2.5 font-semibold text-ink sm:px-3">{r.name}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(r.nominal)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(r.real)}</td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums text-ink-faint sm:px-3">
                    {nominal.total > 0 ? pctLabel(r.nominal / nominal.total, 0) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-paper-deep/60">
                <td className="px-2.5 py-2.5 font-bold text-ink sm:px-3">합계</td>
                <td className="px-2 py-2.5 text-right font-bold tabular-nums text-ink sm:px-3">{manLabel(nominal.total)}</td>
                <td className="px-2 py-2.5 text-right font-bold tabular-nums text-ink sm:px-3">{manLabel(real.total)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums text-ink-faint sm:px-3">100%</td>
              </tr>
              <tr>
                <td className="px-2.5 py-2.5 text-ink-muted sm:px-3">
                  목표<span className="sm:hidden"> 생활비</span>
                  <span className="hidden sm:inline"> 월 생활비(오늘 가치)</span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-faint sm:px-3">—</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{manLabel(target)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums text-ink-faint sm:px-3">
                  {gap >= 0 ? `+${manLabel(gap)}` : `−${manLabel(-gap)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        세액공제는{" "}
        <a href={withBase("/apps/pension-tax/run")} className="font-semibold text-brand-deep link">
          연금저축·IRP 세액공제 계산기
        </a>
        에서, 투자 수익의 세후 금액은{" "}
        <a href={withBase("/apps/compound-return/run")} className="font-semibold text-brand-deep link">
          투자 복리·세후 수익률 계산기
        </a>
        에서 이어서 계산할 수 있습니다.
      </p>

      <StickySummary
        items={[
          { label: "월 수령액(오늘 가치)", value: manLabel(real.total) },
          { label: "목표 대비", value: `${gap >= 0 ? "+" : "−"}${manLabel(Math.abs(gap))}` },
        ]}
      />

      <Note>
        참고용 단순 시뮬레이션(실제 수령액·세율과 다름). 세금, 건강보험료 피부양자 탈락, 연금 수수료, 중도
        인출은 반영하지 않았습니다. 국민연금 예상액은 공단 확정액이 아니라 입력값이며, 실제 수령액은 가입
        이력과 수령 시점에 따라 달라집니다. 기준일 {site.baseDateLabel}
      </Note>
    </RunnerShell>
  );
}
