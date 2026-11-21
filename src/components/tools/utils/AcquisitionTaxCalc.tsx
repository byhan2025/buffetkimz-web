import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, num } from "./fields-c";

/**
 * 주택 취득세·생애최초 감면 계산기 — 2026년 현행 지방세법·지방세특례제한법.
 *
 *  · 취득세율: 6억 이하 1%, 6억~9억 (취득가액 × 2/3억 − 3)%, 9억 초과 3%.
 *  · 다주택 중과: 조정 2주택 8%, 조정 3주택·비조정 3주택 8%, 4주택 이상 12%.
 *  · 지방교육세: 일반 취득세의 10%, 중과는 취득가액의 0.4%.
 *  · 농어촌특별세: 전용 85㎡ 초과만. 일반 0.2%, 8% 중과 0.6%, 12% 중과 1.0%.
 *  · 생애최초: 12억 이하 주택 취득세 200만원 한도 감면(지방세특례제한법 제36조의3).
 */

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const eok = (n: number) => (n * 10000).toLocaleString("ko-KR"); // 만원 → 원 표기 보조

export default function AcquisitionTaxCalc({ compact = false }: { compact?: boolean }) {
  const [price, setPrice] = useState(80000); // 만원
  const [houses, setHouses] = useState<1 | 2 | 3 | 4>(1);
  const [adjust, setAdjust] = useState<"yes" | "no">("yes");
  const [over85, setOver85] = useState<"no" | "yes">("no");
  const [first, setFirst] = useState<"no" | "yes">("no");

  const calc = useMemo(() => {
    const p = price * 10000;
    const baseRate = p <= 600000000 ? 0.01 : p <= 900000000 ? Math.round((((p / 100000000) * 2) / 3 - 3) * 10000) / 10000 / 100 : 0.03;
    let rate = baseRate;
    let label = "1주택 · 일반세율";
    const isAdjust = adjust === "yes";
    if (houses === 2 && isAdjust) {
      rate = 0.08;
      label = "조정대상지역 2주택 중과";
    } else if (houses === 3) {
      rate = isAdjust ? 0.12 : 0.08;
      label = isAdjust ? "조정대상지역 3주택 중과" : "비조정대상지역 3주택 중과";
    } else if (houses === 4) {
      rate = 0.12;
      label = "4주택 이상 중과";
    } else if (houses === 2) {
      label = "비조정대상지역 2주택 · 일반세율";
    }

    const heavy = rate >= 0.08;
    const acqTax = Math.floor(p * rate);
    const eduTax = heavy ? Math.floor(p * 0.004) : Math.floor(acqTax * 0.1);
    const farmRate = rate >= 0.12 ? 0.01 : rate >= 0.08 ? 0.006 : 0.002;
    const farmTax = over85 === "yes" ? Math.floor(p * farmRate) : 0;
    const eligible = first === "yes" && p <= 1200000000;
    const relief = eligible ? Math.min(2000000, acqTax) : 0;
    const total = acqTax - relief + eduTax + farmTax;
    return {
      p,
      rate,
      label,
      heavy,
      acqTax,
      eduTax,
      farmTax,
      relief,
      eligible,
      total,
      effective: p > 0 ? total / p : 0,
      baseRate,
    };
  }, [price, houses, adjust, over85, first]);

  return (
    <UtilShell
      id="acquisition-tax"
      title="주택 취득세 계산기"
      subtitle="매매가·주택 수·지역·면적으로 취득세와 지방교육세·농특세를 계산하고 생애최초 감면을 반영합니다."
      note={
        <>
          참고용 모의계산입니다. 실제 세액은 <strong className="font-semibold text-ink">시가인정액·주택 수 판정·감면 요건</strong>
          에 따라 달라지므로 신고 전 위택스나 관할 시·군·구에서 확인하세요.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="취득가액(매매가)"
          value={price}
          onChange={setPrice}
          min={5000}
          max={300000}
          step={1000}
          unit="만원"
          hint={`6억 이하 1% · 9억 초과 3% · 그 사이 비례`}
        />
        <QuickChoices
          label="취득 후 세대 주택 수"
          value={houses}
          onChange={(v) => setHouses(v)}
          options={[
            { value: 1, label: "1주택" },
            { value: 2, label: "2주택" },
            { value: 3, label: "3주택" },
            { value: 4, label: "4주택 이상" },
          ]}
        />
        <QuickChoices
          label="조정대상지역"
          value={adjust}
          onChange={setAdjust}
          options={[
            { value: "no", label: "아니오" },
            { value: "yes", label: "예(서울·경기 일부)" },
          ]}
        />
        <QuickChoices
          label="전용면적 85㎡ 초과"
          value={over85}
          onChange={setOver85}
          options={[
            { value: "no", label: "85㎡ 이하" },
            { value: "yes", label: "85㎡ 초과" },
          ]}
        />
        <QuickChoices
          label="생애최초 감면"
          value={first}
          onChange={setFirst}
          options={[
            { value: "no", label: "해당 없음" },
            { value: "yes", label: "본인·배우자 모두 무주택" },
          ]}
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold text-ink-faint">내야 할 세금 합계</p>
        <p className="mt-1 text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-brand">{won(calc.total)}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          취득세율 {num(calc.rate * 100, calc.rate * 1000 % 10 === 0 ? 1 : 2)}% · 실효부담률{" "}
          {num(calc.effective * 100, 2)}% · {calc.label}
        </p>
      </div>

      <div className="mt-3">
        <Line label="취득가액" value={won(calc.p)} sub={eok(price) === "" ? undefined : undefined} />
        <Line label="적용 취득세율" value={`${num(calc.rate * 100, calc.rate * 1000 % 10 === 0 ? 1 : 2)}%`} sub={calc.label} />
        <Line label="취득세" value={won(calc.acqTax)} />
        <Line label="지방교육세" value={won(calc.eduTax)} sub={calc.heavy ? "중과 · 취득가액의 0.4%" : "취득세의 10%"} />
        <Line
          label="농어촌특별세"
          value={calc.farmTax === 0 ? "없음(85㎡ 이하)" : won(calc.farmTax)}
          sub={calc.farmTax ? "전용 85㎡ 초과" : undefined}
        />
        <Line
          label="생애최초 감면"
          value={calc.relief === 0 ? "없음" : `−${won(calc.relief)}`}
          tone={calc.relief ? "jade" : "default"}
          sub={
            first === "yes" && !calc.eligible
              ? "취득가액 12억원 초과로 감면 대상이 아닙니다"
              : calc.relief
                ? "취득세에서 200만원 한도"
                : undefined
          }
        />
        <Line label="최종 납부액" value={won(calc.total)} strong tone="brand" />
      </div>

      <div className="mt-4">
        <CaveatBox
          title="놓치기 쉬운 것"
          items={[
            "6억~9억 구간은 계단이 아니라 비탈입니다. 7억원이면 1.6667%, 8억원이면 2.3333%입니다.",
            "2주택 8% 중과는 조정대상지역일 때만 적용됩니다. 일시적 2주택 특례(종전 집을 기한 안에 처분)는 반영하지 않았습니다.",
            "생애최초 감면은 취득일부터 3년 안에 팔거나 임대하면 감면액을 추징합니다.",
            "취득세는 취득일부터 60일 안에 신고·납부합니다(지방세법 제20조).",
          ]}
        />
      </div>
    </UtilShell>
  );
}
