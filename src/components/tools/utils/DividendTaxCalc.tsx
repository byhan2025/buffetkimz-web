import { INCOME_TAX } from "@/data/tax-rules";
import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Bar, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, Line, TableScroll } from "./fields-c";

/**
 * 이자·배당 소득 원천징수와 금융소득종합과세 기준 계산.
 *
 *  · 이자·배당 원천징수 15.4% = 소득세 14% + 지방소득세 1.4% (소득세법 제129조, 지방세법 제103조의3).
 *  · 금융소득종합과세 기준 2,000만원 — 이자·배당 합계(소득세법 제14조 제3항 제6호).
 *    2,000만원을 넘으면 금융소득 전액이 다른 소득과 합산되어 누진세율로 과세된다.
 *  · 해외 배당은 현지 원천징수 후 국내에서 종합과세 대상이 되며, 외국납부세액공제를 받을 수 있다.
 */
const MAN = 10000;
const THRESHOLD = 2000; // 만원
const RATE = INCOME_TAX.dividendWithLocal;
/** 지방소득세 10% — 초과분 추가 부담을 원천징수율(15.4%, 지방세 포함)과 같은 기준으로 맞출 때 곱한다 */
const LOCAL = 1.1;

export default function DividendTaxCalc({ compact = false }: { compact?: boolean }) {
  const [interest, setInterest] = useState(500); // 만원
  const [domestic, setDomestic] = useState(800);
  const [foreign, setForeign] = useState(300);
  const [foreignRate, setForeignRate] = useState(15);
  const [marginal, setMarginal] = useState<"15" | "24" | "35" | "38">("24");

  const calc = useMemo(() => {
    const total = interest + domestic + foreign;
    const domesticBase = interest + domestic;
    const domesticTax = Math.round(domesticBase * RATE * MAN);
    const foreignTax = Math.round(foreign * MAN * (foreignRate / 100));
    const withheld = domesticTax + foreignTax;
    const over = Math.max(0, total - THRESHOLD);
    const room = Math.max(0, THRESHOLD - total);
    const marginalRate = Number(marginal);
    /* 비교과세 ①(2,000만×14% + 초과분×한계세율) − ②(전액×14%) = 초과분×(한계세율−14%).
     * 원천징수율 15.4%는 지방소득세를 포함한 값이므로, 한계세율에도 1.1을 곱해 같은 기준으로 맞춘다.
     * 한계세율이 6%처럼 낮으면 ①이 ②보다 작아져 추가 부담은 0원이다. */
    const extraRate = Math.max(0, marginalRate * LOCAL - RATE * 100);
    const extraTax = Math.round(over * MAN * (extraRate / 100));
    const afterTax = total * MAN - withheld;
    const effectiveRate = total > 0 ? withheld / (total * MAN) : 0;
    return {
      total,
      domesticBase,
      domesticTax,
      foreignTax,
      withheld,
      over,
      room,
      marginalRate,
      extraRate,
      extraTax,
      afterTax,
      effectiveRate,
      ratio: total / THRESHOLD,
    };
  }, [interest, domestic, foreign, foreignRate, marginal]);

  return (
    <RunnerShell
      title="배당·이자 소득세 계산"
      subtitle="국내외 이자·배당을 넣으면 15.4% 원천징수액과 금융소득종합과세 기준(연 2,000만원) 여유분을 계산합니다."
      example="이자 500만·국내 배당 800만·해외 배당 300만원으로 시작합니다. 값을 바꾸면 2,000만원까지 남은 금액이 즉시 바뀝니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="연간 이자소득"
          value={interest}
          onChange={setInterest}
          min={0}
          max={5000}
          step={100}
          unit="만원"
          hint="예·적금, 채권 이자"
        />
        <AmountField
          label="연간 국내 배당소득"
          value={domestic}
          onChange={setDomestic}
          min={0}
          max={5000}
          step={100}
          unit="만원"
          hint="국내 주식·펀드"
        />
        <AmountField
          label="연간 해외 배당소득"
          value={foreign}
          onChange={setForeign}
          min={0}
          max={5000}
          step={100}
          unit="만원"
          hint="해외 주식·ETF"
        />
        <AmountField
          label="해외 현지 원천징수세율"
          value={foreignRate}
          onChange={setForeignRate}
          min={0}
          max={40}
          step={0.5}
          unit="%"
          decimals={1}
          hint="미국 배당 15%"
          edgeFormat={(v) => `${v}%`}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div data-testid="total-income">
          <ResultStat
            label="금융소득 합계"
            value={`${calc.total.toLocaleString("ko-KR")}만원`}
            tone="brand"
            sub={`종합과세 기준 2,000만원의 ${(calc.ratio * 100).toFixed(1)}%`}
          />
        </div>
        <div data-testid="withheld">
          <ResultStat
            label="원천징수 합계 (예상)"
            value={formatKrw(calc.withheld)}
            sub={`국내 15.4% ${formatKrw(calc.domesticTax)} + 해외 ${formatKrw(calc.foreignTax)}`}
          />
        </div>
        <div data-testid="threshold-room">
          <ResultStat
            label={calc.over > 0 ? "기준 초과액" : "2,000만원까지 여유"}
            value={calc.over > 0 ? `${calc.over.toLocaleString("ko-KR")}만원 초과` : `${calc.room.toLocaleString("ko-KR")}만원`}
            tone={calc.over > 0 ? "default" : "jade"}
            sub={calc.over > 0 ? "금융소득 전액이 종합과세 대상" : "이 금액을 넘으면 종합과세로 바뀝니다"}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">2,000만원 기준선</p>
            <p className="text-[12px] tabular-nums text-ink-faint">
              {calc.total.toLocaleString("ko-KR")} / 2,000만원
            </p>
          </div>
          <div className="mt-3">
            <Bar ratio={Math.min(1, calc.ratio)} tone={calc.over > 0 ? "rose" : "jade"} />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px]">
            <span className={calc.over > 0 ? "font-semibold text-clay" : "font-semibold text-jade"}>
              {calc.over > 0 ? `${(calc.ratio * 100).toFixed(1)}% · 기준 초과` : `${(calc.ratio * 100).toFixed(1)}% 사용`}
            </span>
            <span className="text-ink-muted">2,000만원</span>
          </div>

          <div className="mt-4 rounded-lg border border-line-soft bg-[#fbfbf8] px-3">
            <Line label="국내 이자·배당 (15.4%)" value={formatKrw(calc.domesticBase * MAN)} sub={`세금 ${formatKrw(calc.domesticTax)}`} />
            <Line
              label="해외 배당"
              value={formatKrw(foreign * MAN)}
              sub={`현지 ${foreignRate}% ${formatKrw(calc.foreignTax)}`}
            />
            <Line label="원천징수 합계" value={formatKrw(calc.withheld)} strong />
            <Line label="세후 수령액 (예상)" value={formatKrw(calc.afterTax)} strong tone="brand" />
            <Line label="실효세율" value={`${(calc.effectiveRate * 100).toFixed(2)}%`} />
            <Line
              label="국내 비중"
              value={calc.total > 0 ? `${((calc.domesticBase / calc.total) * 100).toFixed(1)}%` : "—"}
            />
            <Line label="해외 비중" value={calc.total > 0 ? `${((foreign / calc.total) * 100).toFixed(1)}%` : "—"} />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            해외 배당은 현지에서 먼저 세금을 떼고, 국내에서 종합과세될 때 외국납부세액공제로 이중과세를
            조정합니다. 여기서는 현지 원천징수만 반영했습니다.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">2,000만원을 넘으면</p>
            <Segmented
              label="내 다른 소득의 한계세율"
              value={marginal}
              onChange={setMarginal}
              options={[
                { value: "6", label: "6%" },
                { value: "15", label: "15%" },
                { value: "24", label: "24%" },
                { value: "35", label: "35%" },
                { value: "38", label: "38%" },
                { value: "42", label: "42%" },
              ]}
              hint="근로소득과 합산될 때 적용될 구간입니다. 모르면 24%로 두고 보세요."
            />
            <Line label="기준 초과액" value={`${calc.over.toLocaleString("ko-KR")}만원`} tone={calc.over > 0 ? "clay" : "default"} />
            <Line label="한계세율(지방세 포함) − 원천징수율" value={`${calc.extraRate.toFixed(1)}%p`} />
            <Line
              label="초과분 추가 부담 (간이)"
              value={formatKrw(calc.extraTax)}
              strong
              tone="brand"
            />
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              실제 종합과세는 금융소득 전액을 다른 소득과 합산해 누진세율로 계산하고, 이미 낸 15.4%를
              기납부세액으로 빼는 방식입니다. 위 금액은 초과분만 가지고 계산한 어림값이며, 한계세율에는
              지방소득세 10%를 곱해 원천징수율과 같은 기준으로 맞추었습니다(한계세율 24% → 26.4% − 15.4% =
              11.0%p, 초과분 1,000만원이면 110만원).
            </p>
          </div>

          <CaveatBox
            items={[
              "금융소득종합과세 기준은 이자·배당 합계 연 2,000만원입니다. 1원이라도 넘으면 금융소득 전액이 종합과세 대상이 됩니다.",
              "비영업대금 이자(사채 등)는 25% 원천징수되며 처음부터 종합과세 대상입니다. 이 계산의 15.4%와 다릅니다.",
              "ISA·연금저축 등 세제혜택 계좌에서 발생한 소득은 과세 방식이 다릅니다. 계좌별로 따로 확인해야 합니다.",
              "배당소득에는 금융소득 종합과세 외에 배당가산(Gross-up)과 배당세액공제가 적용될 수 있습니다. 이 화면은 단순 원천징수만 봅니다.",
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white">
          <TableScroll><table className="w-full border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
              금융소득 규모별 원천징수와 기준선 (이자·배당 합계)
            </caption>
            <thead>
              <tr className="border-b border-line bg-[#fbfbf8] text-left">
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">금융소득</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">15.4% 원천징수</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">기준선</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">종합과세</th>
              </tr>
            </thead>
            <tbody>
              {[1000, 1500, 2000, 2500, 3000, 5000].map((man) => {
                const active = Math.round(calc.total) === man;
                return (
                  <tr key={man} className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/40" : ""}`}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      {man.toLocaleString("ko-KR")}만원
                      {active && <span className="ml-1.5 text-[12px] font-normal text-brand">내 구간</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatKrw(man * MAN * RATE)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-faint">
                      {man <= THRESHOLD ? `여유 ${(THRESHOLD - man).toLocaleString("ko-KR")}만` : `${(man - THRESHOLD).toLocaleString("ko-KR")}만 초과`}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">
                      {man > THRESHOLD ? "대상" : "아님"}
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
          { label: "금융소득", value: `${calc.total.toLocaleString("ko-KR")}만` },
          { label: "원천징수", value: formatKrw(calc.withheld) },
          {
            label: calc.over > 0 ? "기준 초과" : "기준까지",
            value: calc.over > 0 ? `${calc.over.toLocaleString("ko-KR")}만` : `${calc.room.toLocaleString("ko-KR")}만`,
          },
        ]}
        note={`기준 2,000만원 · 확인 기준일 ${site.baseDateLabel}`}
      />

      <Note>
        기준일 {site.baseDateLabel}. 이자·배당 원천징수율 15.4%(소득세 14% + 지방소득세 1.4%)와 소득세법
        제14조의 금융소득종합과세 기준 2,000만원을 적용했습니다. 계좌 종류·금융상품·다른 소득에 따라 실제
        세 부담은 달라지므로 참고용 모의계산입니다.
      </Note>
    </RunnerShell>
  );
}

