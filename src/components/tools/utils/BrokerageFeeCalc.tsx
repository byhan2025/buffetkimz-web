import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, TableScroll, num } from "./fields-c";

/**
 * 부동산 중개보수(복비) 계산기 — 2026년 공인중개사법 시행규칙 별표 1·2 기준.
 *
 *  · 주택 매매·교환: 0.6 / 0.5(한도 80만) / 0.4 / 0.5 / 0.6 / 0.7%
 *  · 주택 임대차: 0.5(한도 20만) / 0.4(한도 30만) / 0.3 / 0.4 / 0.5 / 0.6%
 *  · 5천만원 미만 구간에만 한도액이 있고, 5천만~2억 구간은 매매 0.5%에 한도 80만원이 붙는다.
 *  · 월세 거래금액 = 보증금 + 월세×100, 그 합이 5천만원 미만이면 보증금 + 월세×70.
 *  · 부가세는 요율표 금액에 별도. 일반과세 10%, 간이과세는 부가율 40%×10%로 매출의 4% 수준.
 */

type Deal = "sale" | "lease";
type Target = "house" | "officetel" | "other";
type Vat = "none" | "general" | "simple";

/** 만원 단위 상한과 요율·한도(원) */
const HOUSE_SALE: { max: number; rate: number; cap?: number }[] = [
  { max: 5000, rate: 0.006, cap: 250000 },
  { max: 20000, rate: 0.005, cap: 800000 },
  { max: 90000, rate: 0.004 },
  { max: 120000, rate: 0.005 },
  { max: 150000, rate: 0.006 },
  { max: Infinity, rate: 0.007 },
];
const HOUSE_LEASE: { max: number; rate: number; cap?: number }[] = [
  { max: 5000, rate: 0.005, cap: 200000 },
  { max: 10000, rate: 0.004, cap: 300000 },
  { max: 60000, rate: 0.003 },
  { max: 120000, rate: 0.004 },
  { max: 150000, rate: 0.005 },
  { max: Infinity, rate: 0.006 },
];

const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;
const manLabel = (man: number) => (man === Infinity ? "15억 이상" : `${num(man)}만원`);

export default function BrokerageFeeCalc({ compact = false }: { compact?: boolean }) {
  const [deal, setDeal] = useState<Deal>("sale");
  const [target, setTarget] = useState<Target>("house");
  const [price, setPrice] = useState(50000); // 만원
  const [deposit, setDeposit] = useState(10000); // 만원
  const [monthly, setMonthly] = useState(60); // 만원
  const [vat, setVat] = useState<Vat>("general");

  const calc = useMemo(() => {
    // 거래금액(원)
    let baseWon = 0;
    let converted = "";
    if (deal === "sale") {
      baseWon = price * 10000;
    } else {
      const first = deposit * 10000 + monthly * 10000 * 100;
      if (first < 50000000) {
        baseWon = deposit * 10000 + monthly * 10000 * 70;
        converted = "보증금 + 월세×70 (합이 5천만원 미만)";
      } else {
        baseWon = first;
        converted = "보증금 + 월세×100";
      }
    }

    let rate = 0;
    let cap: number | undefined;
    let band = "";
    if (target === "house") {
      const table = deal === "sale" ? HOUSE_SALE : HOUSE_LEASE;
      const man = baseWon / 10000;
      const row = table.find((r) => man < r.max) ?? table[table.length - 1];
      rate = row.rate;
      cap = row.cap;
      const idx = table.indexOf(row);
      const from = idx === 0 ? 0 : table[idx - 1].max;
      band = `${from === 0 ? "5천만원 미만" : `${num(from)}만원 이상`} ~ ${row.max === Infinity ? "15억원 이상" : `${num(row.max)}만원 미만`}`;
    } else if (target === "officetel") {
      rate = deal === "sale" ? 0.005 : 0.004;
      band = "주거용 오피스텔(전용 85㎡ 이하)";
    } else {
      rate = 0.009;
      band = "그 밖의 오피스텔·상가·토지 (0.9% 이내 협의)";
    }

    const raw = baseWon * rate;
    const fee = Math.floor(cap ? Math.min(raw, cap) : raw);
    const capApplied = Boolean(cap && raw > cap);
    const vatAmount = vat === "general" ? Math.floor(fee * 0.1) : vat === "simple" ? Math.floor(fee * 0.04) : 0;
    const total = fee + vatAmount;
    return { baseWon, converted, rate, cap, band, fee, capApplied, vatAmount, total, raw };
  }, [deal, target, price, deposit, monthly, vat]);

  const vatLabel = vat === "general" ? "부가세 10%(일반과세)" : vat === "simple" ? "간이과세 실효 4%" : "부가세 없음";

  return (
    <UtilShell
      id="brokerage-fee"
      title="부동산 중개보수(복비) 계산기"
      subtitle="2026년 상한요율로 매매·전세·월세 중개보수 최대액을 계산합니다. 월세는 환산보증금으로 바꿉니다."
      note={
        <>
          금액은 <strong className="font-semibold text-ink">법정 상한</strong>입니다. 실제 중개보수는 이 안에서
          중개의뢰인과 중개사가 협의해 정하고, 매도인·매수인(임대인·임차인)이 각각 냅니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <QuickChoices
          label="거래 종류"
          value={deal}
          onChange={setDeal}
          options={[
            { value: "sale", label: "매매·교환" },
            { value: "lease", label: "전세·월세" },
          ]}
        />
        <QuickChoices
          label="대상"
          value={target}
          onChange={setTarget}
          options={[
            { value: "house", label: "주택" },
            { value: "officetel", label: "주거용 오피스텔" },
            { value: "other", label: "상가·토지 등" },
          ]}
        />
        {deal === "sale" ? (
          <AmountField
            label="매매가"
            value={price}
            onChange={setPrice}
            min={1000}
            max={300000}
            step={500}
            unit="만원"
            hint="교환은 두 물건 중 큰 쪽 금액"
          />
        ) : (
          <>
            <AmountField
              label="보증금"
              value={deposit}
              onChange={setDeposit}
              min={0}
              max={200000}
              step={100}
              unit="만원"
            />
            <AmountField label="월세" value={monthly} onChange={setMonthly} min={0} max={2000} step={5} unit="만원" />
          </>
        )}
        <QuickChoices
          label="부가세"
          value={vat}
          onChange={setVat}
          options={[
            { value: "none", label: "없음(포함)" },
            { value: "general", label: "10% 일반과세" },
            { value: "simple", label: "4% 간이과세" },
          ]}
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold text-ink-faint">상한 중개보수</p>
        <p className="mt-1 text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-brand">
          {won(calc.fee)}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          {vat === "none" ? "부가세 별도 아님(포함으로 계산)" : `${vatLabel} ${won(calc.vatAmount)} 포함 합계 ${won(calc.total)}`}
        </p>
      </div>

      <div className="mt-3">
        <Line label="거래금액" value={won(calc.baseWon)} sub={calc.converted || undefined} />
        <Line label="적용 상한요율" value={`${num(calc.rate * 100, calc.rate * 1000 % 10 === 0 ? 1 : 2)}%`} />
        <Line label="구간" value={calc.band} />
        <Line label="한도액" value={calc.cap ? won(calc.cap) : "없음"} />
        <Line
          label="요율 계산값"
          value={won(calc.raw)}
          sub={calc.capApplied ? "한도액이 적용되었습니다" : undefined}
        />
        <Line label="부가세" value={vat === "none" ? "없음" : won(calc.vatAmount)} />
        <Line label="합계" value={won(calc.total)} strong tone="brand" />
      </div>

      {target === "house" && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">주택 상한요율표 — 지금 구간 강조</p>
          <TableScroll minWidth={480}>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className="py-1.5 pr-2 text-left font-semibold">거래금액</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">매매</th>
                  <th className="py-1.5 text-right font-semibold">임대차</th>
                </tr>
              </thead>
              <tbody>
                {HOUSE_SALE.map((row, i) => {
                  const from = i === 0 ? 0 : HOUSE_SALE[i - 1].max;
                  const isNow = deal === "sale" && calc.band.startsWith(from === 0 ? "5천만원 미만" : `${num(from)}만원 이상`);
                  return (
                    <tr
                      key={`s${i}`}
                      className={
                        "border-b border-line-soft last:border-0 " + (isNow ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                      }
                    >
                      <td className="py-1.5 pr-2">{from === 0 ? "5천만원 미만" : `${num(from)}만원~${manLabel(row.max)}`}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {num(row.rate * 100, 1)}%{row.cap ? ` (${num(row.cap / 10000)}만)` : ""}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {num(HOUSE_LEASE[i].rate * 100, 1)}%{HOUSE_LEASE[i].cap ? ` (${num((HOUSE_LEASE[i].cap ?? 0) / 10000)}만)` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}

      <div className="mt-4">
        <CaveatBox
          title="계산 전 확인"
          items={[
            "표시한 금액은 한쪽이 낼 수 있는 상한입니다. 매매는 매도·매수, 임대차는 임대·임차가 각각 냅니다.",
            "시·도 조례가 요율·한도를 정하고, 중개사무소 소재지 조례가 적용됩니다(시행규칙 제20조 제3항).",
            "관리비는 월세 환산에 넣지 않았습니다. 계약 전에 거래금액을 어떻게 잡을지 중개사와 맞춰 두세요.",
            "부가세 포함 여부를 견적서에 적어 두면 잔금 때 다툼이 줄어듭니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
