import { INCOME_TAX, ISA } from "@/data/tax-rules";
import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, TableScroll, num } from "./fields-c";

/**
 * 예금·적금 세후 만기 수령액 비교기.
 *
 *  · 일반과세 15.4%(소득세 14% + 지방소득세 1.4%), 세금우대 9.9%(9% + 0.9%), 비과세 0%.
 *  · 예금 단리 = 원금 × 금리 × 기간, 월복리 = 원금 × ((1+i)^n − 1).
 *  · 적금(월초 납입) 단리 = 월납입 × i × n(n+1)/2, 월복리 = 월납입 × ((1+i)^n − 1)/i × (1+i) − 월납입×n.
 */

type Kind = "deposit" | "savings";
type TaxType = "general" | "preferred" | "exempt";

/* 이자·배당 원천징수(15.4%)와 세금우대(9.9%) — 값은 `data/tax-rules.ts`에서 온다. */
const TAX_RATE: Record<TaxType, number> = {
  general: INCOME_TAX.dividendWithLocal,
  preferred: ISA.taxRate,
  exempt: 0,
};
const TAX_LABEL: Record<TaxType, string> = {
  general: "일반과세 15.4%",
  preferred: "세금우대 9.9%",
  exempt: "비과세 0%",
};

const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;

export default function DepositSavingsCalc({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `compound-return`의 '예금·적금' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState(1000); // 만원 (예금 원금 또는 월납입)
  const [months, setMonths] = useState(12);
  const [rate, setRate] = useState(3.2); // 연 %
  const [compound, setCompound] = useState<"simple" | "monthly">("simple");
  const [tax, setTax] = useState<TaxType>("general");

  const calc = useMemo(() => {
    const n = Math.max(0, Math.round(months));
    const principal = amount * 10000;
    const i = rate / 100 / 12;
    const totalPrincipal = kind === "deposit" ? principal : principal * n;

    let interest = 0;
    if (n > 0) {
      if (kind === "deposit") {
        interest =
          compound === "simple"
            ? principal * (rate / 100) * (n / 12)
            : principal * (Math.pow(1 + i, n) - 1);
      } else {
        interest =
          compound === "simple"
            ? principal * i * ((n * (n + 1)) / 2)
            : Math.pow(1 + i, n) > 1 && i > 0
              ? principal * (((Math.pow(1 + i, n) - 1) / i) * (1 + i) - n)
              : 0;
      }
    }
    const taxAmount = interest * TAX_RATE[tax];
    const netInterest = interest - taxAmount;
    const netTotal = totalPrincipal + netInterest;
    const effectiveAnnual =
      totalPrincipal > 0 && n > 0 ? (netInterest / totalPrincipal) * (12 / n) : 0;

    const compare = (["general", "preferred", "exempt"] as TaxType[]).map((t) => {
      const tAmt = interest * TAX_RATE[t];
      return { type: t, tax: tAmt, net: interest - tAmt, total: totalPrincipal + interest - tAmt };
    });

    return { n, principal, totalPrincipal, interest, taxAmount, netInterest, netTotal, effectiveAnnual, compare };
  }, [kind, amount, months, rate, compound, tax]);

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">예금·적금 세후 비교기</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">단리·월복리와 과세유형별로 만기 실수령액을 나란히 비교합니다.</p>
        </div>
      )}
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <QuickChoices
          label="상품 종류"
          value={kind}
          onChange={setKind}
          options={[
            { value: "deposit", label: "예금(거치식)" },
            { value: "savings", label: "적금(월납입)" },
          ]}
        />
        <AmountField
          label={kind === "deposit" ? "예치금" : "월 납입액"}
          value={amount}
          onChange={setAmount}
          min={10}
          max={100000}
          step={10}
          unit="만원"
        />
        <AmountField label="가입 기간" value={months} onChange={(v) => setMonths(Math.round(v))} min={1} max={120} step={1} unit="개월" edgeFormat={(v) => `${v}개월`} />
        <AmountField label="연이율(세전)" value={rate} onChange={setRate} min={0} max={15} step={0.05} decimals={2} unit="%" edgeFormat={(v) => `${num(v, 2)}%`} />
        <QuickChoices
          label="이자 방식"
          value={compound}
          onChange={setCompound}
          options={[
            { value: "simple", label: "단리" },
            { value: "monthly", label: "월복리" },
          ]}
        />
        <QuickChoices
          label="과세유형"
          value={tax}
          onChange={setTax}
          options={[
            { value: "general", label: "일반 15.4%" },
            { value: "preferred", label: "세금우대 9.9%" },
            { value: "exempt", label: "비과세" },
          ]}
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">납입 원금 합계</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{won(calc.totalPrincipal)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{num(calc.n)}개월</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">세후 이자</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-jade">{won(calc.netInterest)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">세전 {won(calc.interest)} · 세금 {won(calc.taxAmount)}</p>
        </div>
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">만기 수령액</p>
          <p className="mt-1 text-[21px] font-extrabold tabular-nums text-brand">{won(calc.netTotal)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">세후 연 {num(calc.effectiveAnnual * 100, 2)}%</p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="세전 이자" value={won(calc.interest)} sub={compound === "simple" ? "단리" : "월복리"} />
        <Line label={`세금(${TAX_LABEL[tax]})`} value={`−${won(calc.taxAmount)}`} />
        <Line label="세후 이자" value={won(calc.netInterest)} />
        <Line label="원금 + 세후 이자" value={won(calc.netTotal)} strong tone="brand" />
        <Line label="세후 연 실효수익률" value={`${num(calc.effectiveAnnual * 100, 2)}%`} sub="세전 금리와 비교해 보세요" />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">과세유형별 만기 수령액</p>
        <TableScroll minWidth={420}>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="py-1.5 pr-2 text-left font-semibold">과세유형</th>
                <th className="py-1.5 pr-2 text-right font-semibold">세금</th>
                <th className="py-1.5 text-right font-semibold">만기 수령액</th>
              </tr>
            </thead>
            <tbody>
              {calc.compare.map((c) => (
                <tr
                  key={c.type}
                  className={
                    "border-b border-line-soft last:border-0 " +
                    (c.type === tax ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                  }
                >
                  <td className="py-1.5 pr-2">{TAX_LABEL[c.type]}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{won(c.tax)}</td>
                  <td className="py-1.5 text-right tabular-nums">{won(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="mt-4">
        <CaveatBox
          title="계산 전 확인"
          items={[
            "적금은 매월 초 납입을 가정했습니다. 월말 납입이면 이자가 조금 줄어듭니다.",
            "우대금리, 중도해지 이율, 만기 후 이자, 수수료는 반영하지 않습니다.",
            "이자소득이 연 2,000만원을 넘으면 금융소득종합과세로 누진세율이 적용됩니다. 이 화면은 분리과세만 계산합니다.",
            "비과세 종합저축은 만 65세 이상·장애인 등 요건과 1인 5,000만원 한도가 있습니다.",
          ]}
        />
      </div>
    </>
  );

  if (embedded) return <div data-util="deposit-savings">{content}</div>;

  return (
    <UtilShell
      id="deposit-savings"
      title="예금·적금 세후 비교기"
      subtitle="단리·월복리와 과세유형별로 만기 실수령액을 나란히 비교합니다."
      note={
        <>
          광고 금리는 세전입니다. 이자에 세금이 붙은 뒤{" "}
          <strong className="font-semibold text-ink">실제로 남는 금액</strong>을 확인하세요.
        </>
      }
    >
      {content}
    </UtilShell>
  );
}
