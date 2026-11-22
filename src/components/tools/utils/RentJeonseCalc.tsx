import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Bar, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatMan } from "../ui";
import { AmountField, CaveatBox, Line, TableScroll } from "./fields-c";

/**
 * 전세 ↔ 월세 전환·주거비 비교.
 *
 * 전월세 전환율 = (월세 × 12) ÷ (전세보증금 − 월세보증금) × 100.
 * 주택임대차보호법 시행령 제9조는 계약갱신요구 등에서 전환율 상한을
 * '한국은행 기준금리 + 2%p(연 10% 한도)'로 정한다. 기준금리는 변동되므로 직접 입력받는다.
 * 대출이자·예금이자 기회비용은 단리로 계산하고, 취득세·이사비·중개수수료는 넣지 않는다.
 */

export default function RentJeonseCalc({ compact = false }: { compact?: boolean }) {
  const [jeonse, setJeonse] = useState(30000); // 만원
  const [deposit, setDeposit] = useState(3000);
  const [rent, setRent] = useState(60);
  const [loanRate, setLoanRate] = useState(3.5);
  const [loanRatio, setLoanRatio] = useState(80);
  const [marketRate, setMarketRate] = useState(5.0);
  const [depositRate, setDepositRate] = useState(3.0);
  const [includeOpportunity, setIncludeOpportunity] = useState<"include" | "exclude">("include");
  const [baseRate, setBaseRate] = useState(2.5);

  const calc = useMemo(() => {
    const invalid = deposit > jeonse; // 월세보증금이 전세보증금보다 큰 비현실 입력
    const gap = Math.max(0, jeonse - deposit); // 만원
    const conversion = gap > 0 ? ((rent * 12) / gap) * 100 : 0;
    const equivalentJeonse = marketRate > 0 ? deposit + (rent * 12) / (marketRate / 100) : jeonse;

    const loanAmount = (jeonse * loanRatio) / 100;
    const equity = jeonse - loanAmount;
    const loanInterest = (loanAmount * loanRate) / 100; // 만원/년
    const opportunityJeonse = includeOpportunity === "include" ? (equity * depositRate) / 100 : 0;
    const jeonseCost = loanInterest + opportunityJeonse;

    const rentOpportunity = includeOpportunity === "include" ? (deposit * depositRate) / 100 : 0;
    const rentCost = rent * 12 + rentOpportunity;

    const diff = rentCost - jeonseCost; // +면 월세가 비쌈
    const breakEvenRent = (jeonseCost - rentOpportunity) / 12;
    const legalCap = Math.min(10, baseRate + 2);
    const monthlyPer1000 = conversion > 0 ? (1000 * (conversion / 100)) / 12 : 0;

    return {
      gap,
      invalid,
      conversion,
      equivalentJeonse,
      loanAmount,
      equity,
      loanInterest,
      opportunityJeonse,
      jeonseCost,
      rentOpportunity,
      rentCost,
      diff,
      breakEvenRent,
      legalCap,
      monthlyPer1000,
      cheaper: diff > 0 ? "전세" : diff < 0 ? "월세" : "같음",
      conversionGap: conversion - legalCap,
    };
  }, [jeonse, deposit, rent, loanRate, loanRatio, marketRate, depositRate, includeOpportunity, baseRate]);

  const maxCost = Math.max(calc.jeonseCost, calc.rentCost, 1);

  return (
    <RunnerShell
      title="전세 ↔ 월세 · 주거비 비교"
      subtitle="전월세 전환율을 계산하고, 대출이자와 예금이자 기회비용까지 넣어 연간 주거비를 비교합니다."
      example="전세 3억·월세보증금 3,000만·월세 60만원으로 시작합니다. 보증금과 월세를 바꾸면 전환율이 즉시 바뀝니다."
    >
      {calc.invalid && (
        <p
          className="mt-2 rounded-lg border border-clay/40 bg-[#fdf3ee] px-3 py-2 text-[12.5px] leading-[1.65] text-clay"
          data-rent-invalid
        >
          월세보증금({formatMan(deposit)})이 전세보증금({formatMan(jeonse)})보다 큽니다. 전환율은 보증금 차액으로
          계산하므로 차액을 0으로 두었습니다 — 두 보증금을 서로 바꿔 입력하세요.
        </p>
      )}
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="전세보증금"
          value={jeonse}
          onChange={setJeonse}
          min={1000}
          max={200000}
          step={500}
          unit="만원"
          hint="비교 기준 전세"
          edgeFormat={(v) => (v >= 10000 ? `${(v / 10000).toLocaleString("ko-KR")}억` : `${v.toLocaleString("ko-KR")}만`)}
        />
        <AmountField
          label="월세보증금"
          value={deposit}
          onChange={setDeposit}
          min={0}
          max={100000}
          step={100}
          unit="만원"
        />
        <AmountField
          label="월세"
          value={rent}
          onChange={setRent}
          min={0}
          max={500}
          step={5}
          unit="만원"
          edgeFormat={(v) => `${v}만`}
        />
        <AmountField
          label="전세대출 금리"
          value={loanRate}
          onChange={setLoanRate}
          min={0}
          max={10}
          step={0.1}
          unit="%"
          decimals={2}
          edgeFormat={(v) => `${v}%`}
        />
        <AmountField
          label="전세대출 비율"
          value={loanRatio}
          onChange={setLoanRatio}
          min={0}
          max={100}
          step={5}
          unit="%"
          hint="전세보증금 대비"
          edgeFormat={(v) => `${v}%`}
        />
        <AmountField
          label="시장 전환율 (전세 환산용)"
          value={marketRate}
          onChange={setMarketRate}
          min={1}
          max={10}
          step={0.1}
          unit="%"
          decimals={2}
          hint="주변 시세 기준"
          edgeFormat={(v) => `${v}%`}
        />
        <AmountField
          label="예금 금리 (기회비용)"
          value={depositRate}
          onChange={setDepositRate}
          min={0}
          max={10}
          step={0.1}
          unit="%"
          decimals={2}
          edgeFormat={(v) => `${v}%`}
        />
        <AmountField
          label="한국은행 기준금리"
          value={baseRate}
          onChange={setBaseRate}
          min={0}
          max={10}
          step={0.25}
          unit="%"
          decimals={2}
          hint="법정 상한 계산용 · 최신 값 확인"
          edgeFormat={(v) => `${v}%`}
        />
      </div>

      <Segmented
        label="자기자금 기회비용"
        value={includeOpportunity}
        onChange={setIncludeOpportunity}
        options={[
          { value: "include", label: "포함" },
          { value: "exclude", label: "제외" },
        ]}
        hint="전세는 목돈이 묶이고 월세는 보증금이 묶입니다. 같은 돈을 예금에 두었을 때의 이자까지 비용으로 보면 비교가 공정해집니다."
      />

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div data-testid="conversion-rate">
          <ResultStat
            label="전월세 전환율"
            value={`${calc.conversion.toFixed(2)}%`}
            tone="brand"
            sub={`월세 ${rent}만 × 12 ÷ 보증금 차액 ${formatMan(calc.gap)}`}
          />
        </div>
        <div data-testid="annual-diff">
          <ResultStat
            label="연간 주거비 차이"
            value={formatMan(Math.abs(calc.diff))}
            sub={
              Math.abs(calc.diff) < 1
                ? "두 조건의 연간 주거비가 같습니다"
                : `${calc.cheaper}가 연 ${formatMan(Math.abs(calc.diff))} 적게 듭니다`
            }
          />
        </div>
        <div data-testid="equivalent-jeonse">
          <ResultStat
            label="월세를 전세로 환산하면"
            value={formatMan(calc.equivalentJeonse)}
            tone="jade"
            sub={`시장 전환율 ${marketRate}% 기준`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">연간 주거비 (만원)</p>
          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-semibold text-ink">전세 유지</span>
                <span className="font-bold tabular-nums text-brand">{formatMan(calc.jeonseCost)}</span>
              </div>
              <div className="mt-1">
                <Bar ratio={calc.jeonseCost / maxCost} tone="brand" />
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">
                대출이자 {formatMan(calc.loanInterest)} + 기회비용 {formatMan(calc.opportunityJeonse)}
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-semibold text-ink">월세 유지</span>
                <span className="font-bold tabular-nums text-jade">{formatMan(calc.rentCost)}</span>
              </div>
              <div className="mt-1">
                <Bar ratio={calc.rentCost / maxCost} tone="jade" />
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">
                월세 {formatMan(rent * 12)} + 기회비용 {formatMan(calc.rentOpportunity)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-line-soft bg-[#fbfbf8] px-3">
            <Line label="전세대출" value={formatMan(calc.loanAmount)} sub={`${loanRatio}%`} />
            <Line label="전세 자기자금" value={formatMan(calc.equity)} />
            <Line label="대출이자 (연)" value={formatMan(calc.loanInterest)} />
            <Line label="손익분기 월세" value={`${formatMan(calc.breakEvenRent)} / 월`} strong tone="brand" />
            <Line
              label="법정 상한 대비"
              value={`${calc.conversionGap >= 0 ? "+" : ""}${calc.conversionGap.toFixed(2)}%p`}
              tone={calc.conversionGap > 0 ? "clay" : "default"}
              sub={`상한 ${calc.legalCap.toFixed(2)}% · 내 전환율 ${calc.conversion.toFixed(2)}%`}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">전환율 읽는 법</p>
            <Line label={`보증금 1,000만원당 월세`} value={`${calc.monthlyPer1000.toFixed(1)}만원`} />
            <Line label="시장 전환율" value={`${marketRate.toFixed(2)}%`} />
            <Line
              label="전환율 차이"
              value={`${(calc.conversion - marketRate).toFixed(2)}%p`}
              tone={calc.conversion > marketRate ? "clay" : "jade"}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              계산된 전환율이 시장 전환율보다 높으면 보증금을 줄이고 월세로 바꾸는 조건이 시세보다
              불리합니다. 낮으면 반대로 월세 조건이 유리합니다.
            </p>
          </div>

          <CaveatBox
            items={[
              `법정 전환율 상한은 '한국은행 기준금리 + 2%p'(연 10% 한도)입니다. 입력한 기준금리 ${baseRate}%로는 ${calc.legalCap.toFixed(2)}%입니다. 기준금리는 변동되므로 계약 전 최신 값을 확인하세요.`,
              "전세대출은 보증기관 보증료·인지세·중개수수료가 따로 붙습니다. 이 계산에는 들어 있지 않습니다.",
              "월세보증금에 대한 대출이 있다면 월세 쪽 비용이 더 커집니다. 필요한 경우 보증금 대출이자를 직접 더해 보세요.",
              "주거비는 세금·관리비·이사비를 뺀 순수 임대료 기준입니다.",
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white">
          <TableScroll><table className="w-full border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
              조건별 연간 주거비 비교 (단위: 만원)
            </caption>
            <thead>
              <tr className="border-b border-line bg-[#fbfbf8] text-left">
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">전세대출 비율</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">전세 연 비용</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월세 연 비용</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">유리한 쪽</th>
              </tr>
            </thead>
            <tbody>
              {[0, 40, 60, 80, 100].map((ratio) => {
                const loan = (jeonse * ratio) / 100;
                const equity = jeonse - loan;
                const jCost = (loan * loanRate) / 100 + (includeOpportunity === "include" ? (equity * depositRate) / 100 : 0);
                const rCost = rent * 12 + calc.rentOpportunity;
                const active = ratio === loanRatio;
                return (
                  <tr
                    key={ratio}
                    className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold text-ink">
                      {ratio}%
                      {active && <span className="ml-1.5 text-[12px] font-normal text-brand">내 조건</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatMan(jCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatMan(rCost)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">
                      {Math.abs(jCost - rCost) < 1 ? "같음" : jCost < rCost ? "전세" : "월세"}
                      <span className="ml-1 text-[12px] font-normal text-ink-faint">
                        {Math.abs(jCost - rCost) < 1 ? "" : ` ${formatMan(Math.abs(jCost - rCost))} 차이`}
                      </span>
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
          { label: "전환율", value: `${calc.conversion.toFixed(2)}%` },
          { label: "유리한 쪽", value: calc.cheaper },
          { label: "연 차이", value: formatMan(Math.abs(calc.diff)) },
        ]}
        note={`단리·기회비용 ${includeOpportunity === "include" ? "포함" : "제외"} · 확인 기준일 ${site.baseDateLabel}`}
      />

      <Note>
        기준일 {site.baseDateLabel}. 전환율은 (월세 × 12) ÷ (전세보증금 − 월세보증금) × 100으로 계산했습니다.
        법정 전환율 상한은 주택임대차보호법 시행령 제9조의 '기준금리 + 2%p'이며, 이 화면은 입력한 기준금리로만
        계산합니다. 참고용 모의계산이므로 실제 계약 조건과 대출 금리는 계약서·금융회사 안내로 확인하세요.
      </Note>
    </RunnerShell>
  );
}
