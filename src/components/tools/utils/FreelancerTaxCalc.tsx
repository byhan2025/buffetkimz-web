import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, TableScroll, num } from "./fields-c";

/**
 * 프리랜서 3.3% 역산·실수령 계산기.
 *
 *  · 사업소득 원천징수 3%(소득세법 제129조) + 지방소득세 0.3%(소득세액의 10%).
 *  · 소액부징수: 원천징수 소득세가 1,000원 미만이면 징수하지 않는다(소득세법 제86조).
 *  · 세전→세후와 세후→세전을 양방향으로 계산하고, 역산은 원 단위 오차가 남지 않게 맞춘다.
 */

const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;

function fromGross(gross: number) {
  let incomeTax = Math.floor(gross * 0.03);
  if (incomeTax < 1000) incomeTax = 0; // 소액부징수
  const localTax = Math.floor(incomeTax * 0.1);
  return { gross, incomeTax, localTax, net: gross - incomeTax - localTax };
}

function toGross(net: number) {
  /* 0.967로 나눈 근사값에서 시작해 원 단위로 맞춘다 */
  let g = Math.max(0, Math.round(net / 0.967));
  let guard = 0;
  while (fromGross(g).net < net && guard < 40) {
    g += 1;
    guard += 1;
  }
  while (fromGross(g - 1).net >= net && g > 0 && guard < 80) {
    g -= 1;
    guard += 1;
  }
  return fromGross(g);
}

export default function FreelancerTaxCalc({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [amount, setAmount] = useState(3000000);
  const [count, setCount] = useState(12);

  const calc = useMemo(() => (mode === "gross" ? fromGross(amount) : toGross(amount)), [mode, amount]);

  const yearly = {
    gross: calc.gross * count,
    incomeTax: calc.incomeTax * count,
    localTax: calc.localTax * count,
    net: calc.net * count,
  };
  const effective = calc.gross > 0 ? (calc.incomeTax + calc.localTax) / calc.gross : 0;

  return (
    <UtilShell
      id="freelancer-tax"
      title="프리랜서 3.3% 계산기"
      subtitle="세전과 세후를 양방향으로 계산하고, 소득세 3%·지방소득세 0.3% 내역을 보여 줍니다."
      note={
        <>
          3.3%는 최종 세금이 아니라 <strong className="font-semibold text-ink">선납</strong>입니다. 다음 해 5월
          종합소득세 신고에서 경비율·노란우산·연금저축으로 일부 돌려받을 수 있습니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <QuickChoices
          label="계산 방향"
          value={mode}
          onChange={setMode}
          options={[
            { value: "gross", label: "세전 → 세후" },
            { value: "net", label: "세후 → 세전" },
          ]}
        />
        <AmountField
          label={mode === "gross" ? "계약금액(세전)" : "실수령액(세후)"}
          value={amount}
          onChange={setAmount}
          min={0}
          max={100000000}
          step={100000}
          unit="원"
          noSlider
          hint={mode === "gross" ? "계약서에 적힌 금액" : "통장에 들어온 금액"}
        />
        <AmountField
          label="연간 계약 건수(참고)"
          value={count}
          onChange={setCount}
          min={1}
          max={60}
          step={1}
          unit="건"
          edgeFormat={(v) => `${v}건`}
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">세전 금액</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{won(calc.gross)}</p>
        </div>
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">실수령액</p>
          <p className="mt-1 text-[21px] font-extrabold tabular-nums text-brand">{won(calc.net)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">원천징수 {won(calc.incomeTax + calc.localTax)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">실효 원천징수율</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{num(effective * 100, 2)}%</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {calc.incomeTax === 0 ? "소액부징수(소득세 1,000원 미만)" : "3.3% 기준"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="세전 금액" value={won(calc.gross)} />
        <Line label="소득세 3%" value={`−${won(calc.incomeTax)}`} />
        <Line label="지방소득세 0.3%" value={`−${won(calc.localTax)}`} sub="소득세액의 10%" />
        <Line label="실수령액" value={won(calc.net)} strong tone="brand" />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-paper-deep p-4">
        <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">{num(count)}건 기준 연간</p>
        <div className="mt-2">
          <Line label="세전 합계" value={won(yearly.gross)} />
          <Line label="원천징수 합계" value={won(yearly.incomeTax + yearly.localTax)} />
          <Line label="실수령 합계" value={won(yearly.net)} strong />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">세전 → 세후 빠른 표</p>
        <TableScroll minWidth={380}>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="py-1.5 pr-2 text-left font-semibold">세전</th>
                <th className="py-1.5 pr-2 text-right font-semibold">원천징수</th>
                <th className="py-1.5 text-right font-semibold">실수령</th>
              </tr>
            </thead>
            <tbody>
              {[1000000, 2000000, 3000000, 5000000, 10000000, 20000000].map((g) => {
                const r = fromGross(g);
                const now = calc.gross === g;
                return (
                  <tr
                    key={g}
                    className={
                      "border-b border-line-soft last:border-0 " +
                      (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                    }
                  >
                    <td className="py-1.5 pr-2 tabular-nums">{num(g / 10000)}만원</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{num((r.incomeTax + r.localTax) / 10000, 1)}만원</td>
                    <td className="py-1.5 text-right tabular-nums">{num(r.net / 10000, 1)}만원</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="mt-4">
        <CaveatBox
          title="함께 확인할 것"
          items={[
            "부가세는 3.3%와 별도입니다. 일반과세 사업자라면 계약금액에 부가세를 더해 청구하고 신고합니다.",
            "3.3%는 필요경비를 인정하지 않는 선납입니다. 5월 신고에서 경비율을 적용하면 환급될 수 있습니다.",
            "노란우산공제·연금저축·IRP 납입액은 소득공제·세액공제 대상이지만 별도 요건이 있습니다.",
            "원 단위 미만은 버려서 계산했습니다. 지급명세서와 1원 차이가 날 수 있습니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
