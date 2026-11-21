import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, num } from "./fields-c";

/**
 * 주식 물타기 평단가·본전가 계산기.
 *
 *  · 새 평단가 = (기존 수량×평단가 + 추가 수량×단가) ÷ 총 수량(이동평균법).
 *  · 본전가는 새 평단가와 같다(수수료·세금 제외).
 *  · 하락률과 회복률은 대칭이 아니다 — 필요 상승률로 보여 준다.
 */

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export default function StockAveragingCalc({ compact = false }: { compact?: boolean }) {
  const [qty, setQty] = useState(100);
  const [avg, setAvg] = useState(50000);
  const [addQty, setAddQty] = useState(200);
  const [addPrice, setAddPrice] = useState(30000);
  const [current, setCurrent] = useState(30000);

  const calc = useMemo(() => {
    const prevCost = qty * avg;
    const addCost = addQty * addPrice;
    const totalQty = qty + addQty;
    const totalCost = prevCost + addCost;
    const newAvg = totalQty > 0 ? totalCost / totalQty : 0;
    const change = avg > 0 ? newAvg / avg - 1 : 0;
    const needRise = current > 0 && newAvg > 0 ? newAvg / current - 1 : 0;
    const targets = [0.1, 0.2, 0.3].map((r) => ({ rate: r, price: newAvg * (1 + r) }));
    const extra = addCost;
    const valueNow = totalQty * current;
    const pnl = valueNow - totalCost;
    return { prevCost, addCost, totalQty, totalCost, newAvg, change, needRise, targets, extra, valueNow, pnl };
  }, [qty, avg, addQty, addPrice, current]);

  return (
    <UtilShell
      id="stock-averaging"
      title="주식 물타기 평단가 계산기"
      subtitle="추가 매수 후 새 평단가·총 투자금·본전가와 목표 수익률별 주가를 계산합니다."
      note={
        <>
          물타기를 권하는 도구가 아닙니다. 수수료·세금 없이{" "}
          <strong className="font-semibold text-ink">숫자만</strong> 정확히 보여 줍니다. 투자 판단은 본인의 몫입니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField label="보유 수량" value={qty} onChange={(v) => setQty(Math.max(0, Math.round(v)))} min={0} max={100000} step={1} unit="주" edgeFormat={(v) => `${num(v)}주`} />
        <AmountField label="보유 평단가" value={avg} onChange={setAvg} min={0} max={1000000} step={100} unit="원" noSlider hint="매수 평균 단가" />
        <AmountField label="추가 매수 수량" value={addQty} onChange={(v) => setAddQty(Math.max(0, Math.round(v)))} min={0} max={100000} step={1} unit="주" edgeFormat={(v) => `${num(v)}주`} />
        <AmountField label="추가 매수 단가" value={addPrice} onChange={setAddPrice} min={0} max={1000000} step={100} unit="원" noSlider />
        <AmountField label="현재가" value={current} onChange={setCurrent} min={0} max={1000000} step={100} unit="원" noSlider hint="본전까지 필요한 상승률 계산에 씁니다" />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">새 평단가</p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-brand">{won(calc.newAvg)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {calc.change <= 0 ? "−" : "+"}
            {num(Math.abs(calc.change) * 100, 2)}% ({won(calc.newAvg - avg)})
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">총 투자금</p>
          <p className="mt-1 text-[19px] font-extrabold tabular-nums text-ink">{won(calc.totalCost)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">추가 {won(calc.addCost)} · {num(calc.totalQty)}주</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">본전까지</p>
          <p className={"mt-1 text-[19px] font-extrabold tabular-nums " + (calc.needRise > 0 ? "text-clay" : "text-jade")}>
            {calc.needRise >= 0 ? "+" : "−"}
            {num(Math.abs(calc.needRise) * 100, 2)}%
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">본전가 {won(calc.newAvg)}</p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="기존 투자금" value={won(calc.prevCost)} sub={`${num(qty)}주 × ${won(avg)}`} />
        <Line label="추가 투자금" value={won(calc.addCost)} sub={`${num(addQty)}주 × ${won(addPrice)}`} />
        <Line label="총 보유 수량" value={`${num(calc.totalQty)}주`} />
        <Line label="총 투자금" value={won(calc.totalCost)} strong />
        <Line label="새 평단가" value={won(calc.newAvg)} strong tone="brand" />
        <Line label="현재가 평가액" value={won(calc.valueNow)} sub={`평가손익 ${won(calc.pnl)}`} />
        <Line
          label="본전 필요 상승률"
          value={`${calc.needRise >= 0 ? "+" : "−"}${num(Math.abs(calc.needRise) * 100, 2)}%`}
          tone={calc.needRise > 0 ? "clay" : "jade"}
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-3.5">
        <p className="text-[12px] font-bold text-ink">새 평단가 기준 목표가</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {calc.targets.map((t) => (
            <div key={t.rate} className="rounded-lg border border-line bg-paper-deep/60 px-2 py-2">
              <p className="text-[11.5px] font-semibold text-ink-faint">+{Math.round(t.rate * 100)}%</p>
              <p className="mt-0.5 text-[14px] font-extrabold tabular-nums text-ink">{won(t.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <CaveatBox
          title="숫자 뒤에 있는 것"
          items={[
            "하락률과 회복률은 대칭이 아닙니다. 50% 떨어진 종목이 본전이 되려면 100% 올라야 합니다.",
            "평단가가 내려간 만큼 총 투자금과 손실 위험도 함께 커집니다. 추가 매수 전에 금액을 먼저 확인하세요.",
            "매수·매도 수수료와 세금을 반영하지 않아 실제 본전가는 조금 더 높습니다.",
            "액면분할·병합, 배당 재투자는 반영하지 않았습니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
