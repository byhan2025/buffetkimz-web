import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, num } from "./fields-c";

/**
 * 해외주식 양도소득세·손익통산 계산기 — 2026년 현행 소득세법.
 *
 *  · 양도소득금액 = 이익 − 손실(같은 해 국내 과세 대상 주식과 통산, 2020.1.1. 이후 양도분).
 *  · 양도소득 기본공제 250만원(국내·해외 합산 1회), 세율 20% + 지방소득세 2%.
 *  · 양도차손은 다음 해로 이월되지 않는다.
 */

const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;

function taxOf(taxableWon: number) {
  const income = Math.floor(taxableWon * 0.2);
  const local = Math.floor(income * 0.1);
  return { income, local, total: income + local };
}

export default function OverseasStockTaxCalc({ compact = false }: { compact?: boolean }) {
  const [gain, setGain] = useState(1200); // 만원
  const [loss, setLoss] = useState(300);
  const [domestic, setDomestic] = useState(0);

  const calc = useMemo(() => {
    const gainWon = gain * 10000;
    const lossWon = loss * 10000;
    const domesticWon = domestic * 10000;
    const net = gainWon - lossWon + domesticWon;
    const deductionUsed = Math.min(2500000, Math.max(0, net));
    const taxable = Math.max(0, net - 2500000);
    const tax = taxOf(taxable);

    // 손실을 통산하지 않았을 때
    const netNoLoss = gainWon + domesticWon;
    const taxableNoLoss = Math.max(0, netNoLoss - 2500000);
    const taxNoLoss = taxOf(taxableNoLoss);
    const saving = taxNoLoss.total - tax.total;

    const remainingDeduction = Math.max(0, 2500000 - deductionUsed);
    return { net, deductionUsed, taxable, tax, taxNoLoss, saving, remainingDeduction };
  }, [gain, loss, domestic]);

  return (
    <UtilShell
      id="overseas-stock-tax"
      title="해외주식 양도세 절세 계산기"
      subtitle="연간 실현 이익·손실로 250만원 공제 후 22% 세금과 손실 통산 절감액을 계산합니다."
      note={
        <>
          해외주식은 예정신고 없이 <strong className="font-semibold text-ink">다음 해 5월 확정신고</strong> 한 번으로
          끝납니다(2026년 거래분은 2027년 5월). 투자 권유가 아닙니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="연간 실현 이익 합계"
          value={gain}
          onChange={setGain}
          min={0}
          max={100000}
          step={50}
          unit="만원"
          hint="올해 판 종목의 차익 합계"
        />
        <AmountField
          label="연간 실현 손실 합계"
          value={loss}
          onChange={setLoss}
          min={0}
          max={100000}
          step={50}
          unit="만원"
          hint="같은 해에 실현해야 통산됩니다"
        />
        <AmountField
          label="국내 과세 대상 주식 손익"
          value={domestic}
          onChange={setDomestic}
          min={-100000}
          max={100000}
          step={50}
          unit="만원"
          hint="대주주·비상장 등 과세 대상만 · 없으면 0"
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">양도소득금액</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{won(calc.net)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">이익 − 손실 + 국내 손익</p>
        </div>
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">낼 양도소득세</p>
          <p className="mt-1 text-[21px] font-extrabold tabular-nums text-brand">{won(calc.tax.total)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            과세표준 {num(calc.taxable / 10000)}만원 × 22%
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">손실 통산 절감</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-jade">{won(calc.saving)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">통산 전 {won(calc.taxNoLoss.total)}</p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="손익통산 후 금액" value={won(calc.net)} />
        <Line label="기본공제 사용" value={won(calc.deductionUsed)} sub="250만원 한도 · 국내·해외 합산 1회" />
        <Line label="남은 공제" value={won(calc.remainingDeduction)} />
        <Line label="과세표준" value={won(calc.taxable)} />
        <Line label="소득세 20%" value={won(calc.tax.income)} />
        <Line label="지방소득세 2%" value={won(calc.tax.local)} />
        <Line label="합계" value={won(calc.tax.total)} strong tone="brand" />
        <Line
          label="손실을 통산하지 않았다면"
          value={won(calc.taxNoLoss.total)}
          sub={`차이 ${won(calc.saving)}`}
        />
      </div>

      <div className="mt-4">
        <CaveatBox
          title="연말에 놓치기 쉬운 것"
          items={[
            "양도 시점은 체결일이 아니라 결제일입니다. 12월 31일(현지) 체결분은 결제가 다음 해로 넘어가 다음 해 소득이 될 수 있습니다.",
            "손실은 그해 안에서만 쓸 수 있고 다음 해로 넘어가지 않습니다. 250만원 공제도 쓰지 않으면 사라집니다.",
            "국내 일반 소액주주의 상장주식 매매는 양도세 대상이 아니라 통산할 손익도 없습니다.",
            "부동산 비중 50% 이상 법인 주식은 통산 대상이 아니고 누진세율이 적용될 수 있습니다.",
            "신고 기한을 넘기면 무신고 가산세 20%와 납부지연 가산세가 붙습니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
