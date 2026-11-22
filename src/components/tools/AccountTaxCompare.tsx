import { useMemo, useState } from "react";
import {
  ASSET_LABEL,
  CREDIT_LIMIT,
  ISA_EXEMPT,
  compareAccounts,
  type AgeBand,
  type AssetType,
  type IsaType,
  type PayoutMode,
} from "@/lib/account-tax";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, Segmented, StickySummary, Toggle, formatMan } from "./ui";
import { site } from "@/config/site";

const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

export default function AccountTaxCompare({ compact = false }: { compact?: boolean }) {
  const [principal, setPrincipal] = useState(5000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(5);
  const [asset, setAsset] = useState<AssetType>("global");
  const [payout, setPayout] = useState<PayoutMode>("pension");
  const [payoutYears, setPayoutYears] = useState(10);
  const [age, setAge] = useState<AgeBand>("55");
  const [isaType, setIsaType] = useState<IsaType>("general");
  const [distYield, setDistYield] = useState(2);
  const [creditOn, setCreditOn] = useState(true);
  const [creditRate, setCreditRate] = useState<"16.5" | "13.2">("16.5");

  const result = useMemo(
    () =>
      compareAccounts({
        principal,
        years,
        ratePct: rate,
        asset,
        payout,
        payoutYears,
        age,
        isaType,
        distYieldPct: distYield,
        creditOn,
        creditRatePct: Number(creditRate),
      }),
    [principal, years, rate, asset, payout, payoutYears, age, isaType, distYield, creditOn, creditRate]
  );

  const best = result.rows.find((r) => r.key === result.best)!;
  const general = result.rows.find((r) => r.key === "general")!;
  const isa = result.rows.find((r) => r.key === "isa")!;
  const pension = result.rows.find((r) => r.key === "pension")!;
  const irp = result.rows.find((r) => r.key === "irp")!;
  const maxNet = Math.max(...result.rows.map((r) => r.net), 1);
  const totalTax = result.rows.reduce((n, r) => n + r.tax, 0);

  const payoutLabel = payout === "pension" ? `연금 수령(${payoutYears}년 분할)` : "연금 외 일시 수령";

  const verdict = `${years}년 뒤 평가액 ${formatMan(result.value)} — 세금과 세액공제를 반영한 뒤 가장 많이 남는 계좌는 ${best.name} ${formatMan(
    best.net
  )}입니다. ${ASSET_LABEL[asset]} · ${payoutLabel} 기준입니다.`;

  const checks = [
    `적용 세율은 자산 유형과 인출 방식에서 갈립니다. 일반계좌 ${general.rateLabel}, ISA ${isa.rateLabel}, 연금계좌 ${pension.rateLabel}입니다.`,
    payout === "pension"
      ? `연금계좌는 연 ${Math.round(result.annualPension).toLocaleString("ko-KR")}만원씩 받는 것으로 계산했고, 연금소득공제 ${Math.round(result.annualDeduction).toLocaleString("ko-KR")}만원을 뺀 ${Math.round(result.annualTaxable).toLocaleString("ko-KR")}만원에 세율을 적용했습니다. 연 1,500만원을 넘으면 그 금액 전체가 종합과세 또는 16.5% 분리과세로 갑니다.`
      : "연금계좌를 연금 외로 꺼내면 세액공제 받은 납입금과 운용수익에 기타소득세 16.5%가 붙습니다. 세액공제를 받지 않은 원금은 과세되지 않습니다.",
    creditOn
      ? `세액공제는 연금저축 연 ${CREDIT_LIMIT.pension}만원, IRP 연 ${CREDIT_LIMIT.irp}만원 한도로 ${creditRate}%를 반영했습니다. 실제 환급액은 결정세액을 넘을 수 없습니다.`
      : "세액공제를 반영하지 않은 비교입니다. 실제로는 납입 시 공제가 붙어 연금계좌의 차이가 더 벌어질 수 있습니다.",
  ];

  return (
    <RunnerShell
      title="4대 계좌 세후 비교"
      subtitle="같은 원금·수익률·기간으로 일반계좌·ISA·연금저축·IRP의 세금과 실수령액을 나란히 봅니다."
      example={`원금 ${formatMan(principal)} · ${years}년 · 연 ${pct(rate)} · ${ASSET_LABEL[asset]} · ${payoutLabel}로 시작합니다. 여기 숫자는 초기 원금 기준이며, 연금 가이드 2편의 '수익 5,000만 원' 예시와는 출발 기준이 다릅니다.`}
    >
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold tracking-[0.02em] text-ink-faint">결론 한 줄 (가정 기반 추정)</p>
        <p className="mt-1.5 text-[15.5px] font-bold leading-[1.55] tracking-[-0.02em] text-ink" data-acc-verdict>
          {verdict}
        </p>

        <p className="mt-3.5 text-[12px] font-semibold tracking-[0.02em] text-ink-faint">먼저 확인할 항목 3개</p>
        <ol className="mt-1.5 space-y-1.5" data-acc-checks>
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
          기준일 {site.baseDateLabel} · 출처: 소득세법 제17조·제20조의3·제59조의3·제129조, 조세특례제한법 제91조의18,
          근로자퇴직급여 보장법 시행령 제18조 · 한계: 연 수익률 고정·분배금 재투자 가정, 수수료·물가상승 미반영
        </p>
      </div>

      {/* 기본 입력 — 원금·기간·수익률·자산 유형·인출 방식 */}
      <div className="mt-4 grid gap-1 md:grid-cols-2 md:gap-x-8">
        <MoneySlider label="원금" value={principal} onChange={setPrincipal} min={100} max={20000} step={100} />
        <MoneySlider
          label="보유 기간"
          value={years}
          onChange={setYears}
          min={1}
          max={30}
          step={1}
          format={(v) => `${v}년`}
        />
        <MoneySlider label="연 수익률" value={rate} onChange={setRate} min={0} max={10} step={0.5} format={(v) => pct(v)} />
        <div className="py-1">
          <Segmented
            label="자산 유형"
            value={asset}
            onChange={setAsset}
            options={[
              { value: "domestic", label: "국내주식형" },
              { value: "global", label: "해외·배당·채권형" },
            ]}
            hint={
              asset === "domestic"
                ? "매매차익 비과세, 분배금은 배당소득 15.4%로 계산합니다."
                : "매매차익·분배금 모두 배당소득 15.4%로 계산합니다."
            }
          />
        </div>
        <div className="py-1 md:col-span-2">
          <Segmented
            label="인출 방식"
            value={payout}
            onChange={setPayout}
            options={[
              { value: "pension", label: "연금 수령" },
              { value: "lump", label: "연금 외 일시 수령" },
            ]}
            hint={
              payout === "pension"
                ? "55세 이후·5년 요건을 채워 연금으로 나눠 받는 경우입니다. 계좌별 나이·수령액 조건이 다릅니다."
                : "중도 해지·한도 초과처럼 연금 외 방식으로 꺼내는 경우입니다."
            }
          />
        </div>
      </div>

      <details className="mt-2 rounded-xl border border-line bg-white px-4 py-1" data-acc-more>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-ink-soft">
          가정 더 보기 — 나이·ISA 유형·분배금·세액공제
          <span className="text-[12px] font-normal text-ink-faint">
            {age === "lifetime" ? "종신형" : `${age}세대`} · ISA {ISA_EXEMPT[isaType]}만원 비과세
          </span>
        </summary>
        <div className="grid gap-1 border-t border-line-soft pb-2 md:grid-cols-2 md:gap-x-8">
          <div className="py-1">
            <Segmented
              label="연금 수령 나이"
              value={age}
              onChange={setAge}
              options={[
                { value: "55", label: "55~69세" },
                { value: "70", label: "70~79세" },
                { value: "80", label: "80세 이상" },
                { value: "lifetime", label: "종신형" },
              ]}
              hint="연금소득세율 5.5% · 4.4% · 3.3% · 종신형 3.3%"
            />
          </div>
          <div className="py-1">
            <Segmented
              label="ISA 유형"
              value={isaType}
              onChange={setIsaType}
              options={[
                { value: "general", label: "일반형 200만원" },
                { value: "seomin", label: "서민형 400만원" },
              ]}
              hint="순이익이 비과세 한도를 넘으면 초과분에 9.9%"
            />
          </div>
          <MoneySlider
            label="연금 수령 기간"
            value={payoutYears}
            onChange={setPayoutYears}
            min={5}
            max={30}
            step={1}
            format={(v) => `${v}년`}
            hint={`연 ${Math.round(result.annualPension).toLocaleString("ko-KR")}만원`}
          />
          <MoneySlider
            label="연 배당·분배금 가정"
            value={distYield}
            onChange={setDistYield}
            min={0}
            max={4}
            step={0.5}
            format={(v) => pct(v)}
            hint="국내주식형 일반계좌의 분배금 과세에만 사용"
          />
          <div className="py-1 md:col-span-2">
            <Toggle
              label="납입 시 세액공제 반영"
              description="연금저축 연 600만원, IRP 연 900만원까지 납입액의 공제율만큼 환급이 발생한다고 봅니다(결정세액 한도는 별도)."
              checked={creditOn}
              onChange={setCreditOn}
            />
          </div>
          {creditOn && (
            <div className="py-1 md:col-span-2">
              <Segmented
                label="세액공제율"
                value={creditRate}
                onChange={setCreditRate}
                options={[
                  { value: "16.5", label: "16.5% (총급여 5,500만원 이하)" },
                  { value: "13.2", label: "13.2% (5,500만원 초과)" },
                ]}
                hint="지방소득세를 포함한 체감 공제율입니다."
              />
            </div>
          )}
        </div>
      </details>

      {/* 결과 — 네 계좌 카드 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2" data-acc-cards>
        {result.rows.map((r) => (
          <div
            key={r.key}
            data-acc-card={r.key}
            data-acc-tax={Math.round(r.tax)}
            data-acc-net={Math.round(r.net)}
            className={`rounded-xl border bg-white p-4 ${
              r.key === result.best ? "border-brand/50 shadow-[0_10px_28px_-24px_rgba(15,53,80,0.9)]" : "border-line"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold text-ink">{r.name}</p>
              {r.key === result.best && (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand-deep">
                  세후 최다
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">{r.when}</p>
            <p className="mt-2.5 text-[21px] font-extrabold tracking-[-0.03em] tabular-nums text-ink">
              {formatMan(r.net)}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              세금 {formatMan(r.tax)}
              {r.credit > 0 && ` · 공제 +${formatMan(r.credit)}`}
            </p>
            {r.credit > 0 && (
              <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
                세후 실수령은 평가액 − 세금 + 납입 시 세액공제(가정)입니다.
              </p>
            )}
            <p className="mt-2 rounded-md bg-paper-deep/70 px-2 py-1.5 text-[11.5px] leading-[1.55] text-ink-soft">
              <strong className="font-semibold text-ink">적용</strong> {r.rateLabel}
            </p>
            <p className="mt-1 text-[11.5px] leading-[1.55] text-ink-faint">{r.rateDetail}</p>
            <div className="mt-2">
              <Bar ratio={r.net / maxNet} tone={r.key === result.best ? "jade" : "brand"} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ResultStat label="세전 평가액" value={formatMan(result.value)} sub={`원금 ${formatMan(result.principal)} + 수익 ${formatMan(result.gain)}`} tone="brand" />
        <ResultStat label="세금만 비교한 1위" value={result.rows.find((r) => r.key === result.bestByTax)!.name} sub="세액공제를 빼고 인출세만 본 순위" />
        <ResultStat label="네 계좌 세금 합계" value={formatMan(totalTax)} sub="같은 조건을 네 계좌에 각각 넣었을 때의 합" />
      </div>

      {/* 표 — 같은 값을 계좌별로 */}
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white" data-acc-table>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">계좌별 세금·실수령</p>
          <p className="text-[12px] text-ink-faint">같은 원금·수익률·기간, 세금만 다르게</p>
        </div>
        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <caption className="sr-only">일반계좌·ISA·연금저축·IRP의 세금과 세후 실수령액 비교</caption>
          <thead>
            <tr className="border-b border-line bg-paper-deep text-left">
              <th scope="col" className="px-2.5 py-2 font-semibold text-ink-soft sm:px-3">계좌</th>
              <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-ink-soft sm:table-cell">세액공제</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold text-ink-soft sm:px-3">세금</th>
              <th scope="col" className="px-2.5 py-2 text-right font-semibold text-ink-soft sm:px-3">세후</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.key} className={`border-b border-line-soft last:border-0 ${r.key === result.best ? "bg-brand-soft/40" : ""}`}>
                <td className="px-2.5 py-2 sm:px-3">
                  <span className="font-semibold text-ink">{r.short}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{r.rateLabel}</span>
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-ink-muted sm:table-cell">
                  {r.credit > 0 ? `+${formatMan(r.credit)}` : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-muted sm:px-3">
                  {formatMan(r.tax)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums text-ink sm:px-3">
                  {formatMan(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line-soft bg-paper-deep/50 px-3 py-2 text-[11.5px] leading-[1.6] text-ink-muted">
          ISA는 계좌 전체 누적 비과세 한도({ISA_EXEMPT[isaType]}만원)를 한 번만 적용했습니다. 연금저축·IRP의 세액공제는 두
          계좌를 동시에 채우면 합산 900만원 한도를 나눠 쓰므로, 이 표의 각 줄은 계좌를 하나씩 골랐을 때의 값입니다.
        </p>
      </div>

      <p className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px] leading-[1.65] text-ink-muted" data-acc-basis>
        <strong className="font-semibold text-ink">세율 기준</strong> 배당소득 15.4%(소득세 14% + 지방소득세),
        ISA 초과분 9.9%, 연금 외 수령 16.5%(15% + 지방소득세), 연금소득세 5.5%·4.4%·3.3%입니다. 해외 상장 ETF를
        직접 사는 경우는 양도소득세(연 250만원 기본공제 후 22%)로 계산이 달라지며, 이 도구는 국내상장 ETF를 기준으로 합니다.
      </p>

      <p className="mt-2 rounded-lg border border-line bg-paper-deep/70 px-3 py-2 text-[12px] leading-[1.6] text-ink-muted" data-acc-assumptions>
        적용 가정: 연 {pct(rate)} 고정 수익률 · 연 {pct(distYield)} 배당·분배금 · {ASSET_LABEL[asset]} · {payoutLabel} ·
        연금계좌는 세액공제 받은 납입금·운용수익 전액이 과세대상이라 보고 연금소득공제만 반영 ·
        수수료·세금 이외 비용 미반영 · 물가상승 미반영 · 기준일 {site.baseDateLabel}
      </p>

      {!compact && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] text-ink-muted">
              보유 기간별 세후 실수령(표로 읽는 같은 값 · 모두 추정치)
            </caption>
            <thead>
              <tr className="border-b border-line bg-paper-deep text-left">
                <th scope="col" className="px-2.5 py-2.5 font-semibold text-ink-soft sm:px-3">기간</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">일반</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold text-ink-soft sm:px-3">ISA</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold text-ink-soft sm:px-3">연금저축</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set([3, 5, 10, 20, years].filter((y) => y <= 30))).map((y) => {
                const r = compareAccounts({
                  principal,
                  years: y,
                  ratePct: rate,
                  asset,
                  payout,
                  payoutYears,
                  age,
                  isaType,
                  distYieldPct: distYield,
                  creditOn,
                  creditRatePct: Number(creditRate),
                });
                const g = r.rows.find((x) => x.key === "general")!;
                const i = r.rows.find((x) => x.key === "isa")!;
                const p = r.rows.find((x) => x.key === "pension")!;
                return (
                  <tr key={y} className="border-b border-line-soft last:border-0">
                    <td className="px-2.5 py-2.5 font-semibold text-ink sm:px-3">
                      {Math.min(y, years)}년{y === years && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">내 입력</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{formatMan(g.net)}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{formatMan(i.net)}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{formatMan(p.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StickySummary
        items={[
          { label: "세후 최다", value: `${best.short} ${formatMan(best.net)}` },
          { label: "세전 평가액", value: formatMan(result.value) },
        ]}
      />

      <Note>
        참고용 모의계산입니다. 수익률은 보장된 값이 아니며, 실제 세금은 소득 구간·금융소득종합과세·건강보험료·계좌별 요건에
        따라 달라집니다. 연금계좌는 55세·5년 요건과 연금수령한도, IRP는 중도인출 사유와 위험자산 70% 한도를 함께 확인해야
        합니다. ISA는 3년 의무가입과 만기 후 60일 이내 연금계좌 전환(전환액의 10%·최대 300만원 추가 공제대상)이 별도로
        적용됩니다. 기준일 {site.baseDateLabel}
      </Note>
    </RunnerShell>
  );
}
