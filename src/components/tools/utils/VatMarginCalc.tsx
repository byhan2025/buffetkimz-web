import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, Line, num } from "./fields-c";

/**
 * 부가세·마진·할인 계산기 — 업무용 3탭.
 *  ① 공급가액 ↔ 합계(부가세 10% 분리)
 *  ② 매입가·판매가 마진율과 순이익
 *  ③ 정가·할인율(중복 할인) 계산
 * 부가가치세법 제29조(세율 10%) 기준. 모든 계산은 브라우저에서만 이뤄진다.
 */

type Tab = "vat" | "margin" | "discount";

const VAT_RATE = 0.1;
const supplyOf = (total: number) => Math.round(total / (1 + VAT_RATE));
const vatOf = (supply: number) => Math.round(supply * VAT_RATE);

export default function VatMarginCalc({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<Tab>("vat");

  // ① 부가세
  const [vatMode, setVatMode] = useState<"supply" | "total">("supply");
  const [vatAmount, setVatAmount] = useState(1000000);

  // ② 마진
  const [buy, setBuy] = useState(70000);
  const [sell, setSell] = useState(100000);
  const [vatIncluded, setVatIncluded] = useState<"included" | "excluded">("included");

  // ③ 할인
  const [listPrice, setListPrice] = useState(50000);
  const [first, setFirst] = useState(10);
  const [second, setSecond] = useState(5);

  const vat = useMemo(() => {
    if (vatMode === "supply") {
      const supply = vatAmount;
      const tax = vatOf(supply);
      return { supply, tax, total: supply + tax };
    }
    const total = vatAmount;
    const supply = supplyOf(total);
    return { supply, tax: total - supply, total };
  }, [vatAmount, vatMode]);

  const margin = useMemo(() => {
    const buySupply = vatIncluded === "included" ? supplyOf(buy) : buy;
    const sellSupply = vatIncluded === "included" ? supplyOf(sell) : sell;
    const buyTax = vatIncluded === "included" ? buy - buySupply : vatOf(buy);
    const sellTax = vatIncluded === "included" ? sell - sellSupply : vatOf(sell);
    const profit = sellSupply - buySupply;
    const vatPayable = sellTax - buyTax;
    return {
      buySupply,
      sellSupply,
      buyTax,
      sellTax,
      profit,
      vatPayable,
      rateOnCost: buySupply > 0 ? (profit / buySupply) * 100 : 0,
      rateOnSales: sellSupply > 0 ? (profit / sellSupply) * 100 : 0,
      totalReceived: sellSupply + sellTax,
    };
  }, [buy, sell, vatIncluded]);

  const discount = useMemo(() => {
    const a = Math.min(100, Math.max(0, first)) / 100;
    const b = Math.min(100, Math.max(0, second)) / 100;
    const afterFirst = Math.round(listPrice * (1 - a));
    const finalPrice = Math.round(listPrice * (1 - a) * (1 - b));
    const saved = listPrice - finalPrice;
    const totalRate = listPrice > 0 ? (saved / listPrice) * 100 : 0;
    return { afterFirst, finalPrice, saved, totalRate };
  }, [listPrice, first, second]);

  const sticky =
    tab === "vat"
      ? [
          { label: "공급가액", value: formatKrw(vat.supply) },
          { label: "부가세", value: formatKrw(vat.tax) },
          { label: "합계", value: formatKrw(vat.total) },
        ]
      : tab === "margin"
        ? [
            { label: "마진", value: formatKrw(margin.profit) },
            { label: "마진율", value: `${margin.rateOnCost.toFixed(1)}%` },
            { label: "낼 부가세", value: formatKrw(margin.vatPayable) },
          ]
        : [
            { label: "최종 판매가", value: formatKrw(discount.finalPrice) },
            { label: "총 할인율", value: `${discount.totalRate.toFixed(2)}%` },
          ];

  return (
    <RunnerShell
      title="부가세·마진·할인 계산"
      subtitle="세금계산서 금액 분리, 판매 마진율, 중복 할인가를 한 화면에서 계산합니다."
      example="탭을 바꿔 ①공급가액 100만원 ②매입 7만·판매 10만원(부가세 포함) ③정가 5만원·10%+5% 중복할인으로 시작합니다."
    >
      <Segmented
        label="계산 종류"
        value={tab}
        onChange={setTab}
        options={[
          { value: "vat", label: "① 부가세 분리" },
          { value: "margin", label: "② 마진·순이익" },
          { value: "discount", label: "③ 할인가" },
        ]}
      />

      {tab === "vat" && (
        <>
          <Segmented
            label="무엇을 알고 있나요"
            value={vatMode}
            onChange={setVatMode}
            options={[
              { value: "supply", label: "공급가액을 안다" },
              { value: "total", label: "합계금액을 안다" },
            ]}
            hint="합계금액에서 거꾸로 계산할 때는 합계 ÷ 1.1로 공급가액을 구합니다."
          />
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
            <AmountField
              label={vatMode === "supply" ? "공급가액" : "합계금액 (부가세 포함)"}
              value={vatAmount}
              onChange={setVatAmount}
              min={0}
              max={1000000000}
              step={10000}
              unit="원"
              noSlider
              hint="숫자만 입력하면 천 단위로 끊어 보여 줍니다."
            />
            <div className="py-3">
              <p className="text-[13.5px] font-semibold text-ink">세율</p>
              <p className="mt-2 rounded-lg border border-line bg-paper-deep px-3 py-2 text-[14px] font-bold tabular-nums text-ink">
                10% (부가가치세법 제29조)
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                일반과세자의 부가세율은 10%입니다. 간이과세자·면세 품목은 다릅니다.
              </p>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div data-testid="vat-supply">
              <ResultStat label="공급가액" value={formatKrw(vat.supply)} tone="brand" sub="세금계산서 작성 기준" />
            </div>
            <div data-testid="vat-tax">
              <ResultStat label="부가세" value={formatKrw(vat.tax)} sub="공급가액의 10%" />
            </div>
            <div data-testid="vat-total">
              <ResultStat
                label="합계금액"
                value={formatKrw(vat.total)}
                tone="jade"
                sub={`공급가액 + 부가세 = ${num(vat.total)}원`}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">세금계산서에 적는 값</p>
              <div className="mt-2">
                <Line label="공급가액" value={formatKrw(vat.supply)} />
                <Line label="세액" value={formatKrw(vat.tax)} />
                <Line label="합계금액" value={formatKrw(vat.total)} strong tone="brand" />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                공급가액은 원 단위로 반올림했고, 합계에서 거꾸로 계산할 때는 부가세를 합계 − 공급가액으로
                두어 1원 차이가 나지 않게 했습니다.
              </p>
            </div>
            <CaveatBox
              items={[
                "부가세 신고는 매출세액 − 매입세액으로 계산합니다. 이 화면은 금액 한 건을 분리하는 계산입니다.",
                "간이과세자, 면세 사업자(교육·의료 등), 수출 영세율은 세율이 다릅니다.",
                "세금계산서는 공급일이 속한 달의 다음 달 10일까지 발급하는 것이 원칙입니다.",
              ]}
            />
          </div>
        </>
      )}

      {tab === "margin" && (
        <>
          <Segmented
            label="입력한 가격의 성격"
            value={vatIncluded}
            onChange={setVatIncluded}
            options={[
              { value: "included", label: "부가세 포함가" },
              { value: "excluded", label: "부가세 별도가" },
            ]}
            hint="부동산·중고거래처럼 부가세가 붙지 않는 거래에는 마진 계산을 참고용으로만 쓰세요."
          />
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
            <AmountField
              label="매입가"
              value={buy}
              onChange={setBuy}
              min={0}
              max={100000000}
              step={1000}
              unit="원"
              noSlider
            />
            <AmountField
              label="판매가"
              value={sell}
              onChange={setSell}
              min={0}
              max={100000000}
              step={1000}
              unit="원"
              noSlider
            />
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div data-testid="margin-profit">
              <ResultStat
                label="마진 (공급가 기준)"
                value={formatKrw(margin.profit)}
                tone="brand"
                sub={`매출 공급가 ${formatKrw(margin.sellSupply)} − 매입 공급가 ${formatKrw(margin.buySupply)}`}
              />
            </div>
            <div data-testid="margin-rate">
              <ResultStat
                label="마진율 (매입가 대비)"
                value={`${margin.rateOnCost.toFixed(2)}%`}
                sub={`판매가 대비 ${margin.rateOnSales.toFixed(2)}%`}
              />
            </div>
            <div data-testid="margin-vat">
              <ResultStat
                label="낼 부가세 (매출 − 매입)"
                value={formatKrw(margin.vatPayable)}
                tone={margin.vatPayable >= 0 ? "jade" : "default"}
                sub={margin.vatPayable >= 0 ? "매출세액이 더 큼" : "환급 대상 (매입세액이 더 큼)"}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">금액 흐름</p>
              <div className="mt-2">
                <Line label="매입가" value={formatKrw(buy)} />
                <Line label="매입 공급가액" value={formatKrw(margin.buySupply)} />
                <Line label="매입세액" value={formatKrw(margin.buyTax)} />
                <Line label="판매가" value={formatKrw(sell)} />
                <Line label="매출 공급가액" value={formatKrw(margin.sellSupply)} />
                <Line label="매출세액" value={formatKrw(margin.sellTax)} />
                <Line label="마진(순이익)" value={formatKrw(margin.profit)} strong tone="brand" />
                <Line label="부가세 납부액" value={formatKrw(margin.vatPayable)} sub="매출세액 − 매입세액" />
              </div>
            </div>
            <CaveatBox
              title="마진율을 볼 때"
              items={[
                "마진율은 무엇을 분모로 두느냐에 따라 달라집니다. 원가 대비(마크업)와 판매가 대비(마진)를 함께 표시했습니다.",
                "부가세는 받은 세금을 대신 내는 돈이라 순이익에 더하지 않습니다. 마진은 부가세를 뺀 공급가액끼리 비교해야 맞습니다.",
                "배송비·수수료·카드 수수료·광고비는 반영하지 않은 상품 마진입니다. 실제 남는 돈은 이보다 적습니다.",
                "매입세액 공제는 적격증빙(세금계산서·현금영수증 등)이 있어야 받을 수 있습니다.",
              ]}
            />
          </div>
        </>
      )}

      {tab === "discount" && (
        <>
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
            <AmountField
              label="정가"
              value={listPrice}
              onChange={setListPrice}
              min={0}
              max={100000000}
              step={1000}
              unit="원"
              noSlider
            />
            <AmountField
              label="1차 할인율"
              value={first}
              onChange={setFirst}
              min={0}
              max={90}
              step={1}
              unit="%"
              decimals={1}
              edgeFormat={(v) => `${v}%`}
            />
            <AmountField
              label="2차 할인율 (중복)"
              value={second}
              onChange={setSecond}
              min={0}
              max={90}
              step={1}
              unit="%"
              decimals={1}
              edgeFormat={(v) => `${v}%`}
            />
            <div className="py-3">
              <p className="text-[13.5px] font-semibold text-ink">중복 할인 계산 방식</p>
              <p className="mt-2 rounded-lg border border-line bg-paper-deep px-3 py-2 text-[13px] font-semibold text-ink">
                정가 × (1 − 1차) × (1 − 2차)
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                할인율을 더하지 않습니다. 10% + 5%는 15%가 아니라 14.5%입니다.
              </p>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div data-testid="final-price">
              <ResultStat
                label="최종 판매가"
                value={formatKrw(discount.finalPrice)}
                tone="brand"
                sub={`정가 ${formatKrw(listPrice)}에서 ${formatKrw(discount.saved)} 할인`}
              />
            </div>
            <div data-testid="total-discount">
              <ResultStat
                label="총 할인율"
                value={`${discount.totalRate.toFixed(2)}%`}
                sub={`1차 ${first}% + 2차 ${second}% 중복`}
              />
            </div>
            <div data-testid="after-first">
              <ResultStat
                label="1차 할인 후 가격"
                value={formatKrw(discount.afterFirst)}
                tone="jade"
                sub={`여기서 ${second}% 한 번 더`}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">같은 결과를 만드는 한 번 할인</p>
              <div className="mt-2">
                <Line label="정가" value={formatKrw(listPrice)} />
                <Line label="1차 할인" value={`− ${formatKrw(listPrice - discount.afterFirst)}`} />
                <Line label={`2차 할인 (${second}%)`} value={`− ${formatKrw(discount.afterFirst - discount.finalPrice)}`} />
                <Line label="최종 판매가" value={formatKrw(discount.finalPrice)} strong tone="brand" />
                <Line label="한 번에 같은 할인율" value={`${discount.totalRate.toFixed(2)}%`} />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                쿠폰·멤버십 할인처럼 두 번에 나눠 적용하는 경우, 안내문에 총 할인율을 적을 때는 이 값을
                쓰면 됩니다.
              </p>
            </div>
            <CaveatBox
              items={[
                "할인은 원 단위로 반올림해 계산합니다. 실제 POS·쇼핑몰은 단계마다 버림·반올림을 달리할 수 있습니다.",
                "부가세 포함가에서 할인해도 부가세는 할인 후 금액 기준으로 계산합니다.",
                "최저가 표시·할인율 광고는 표시광고법의 부당표시 규제를 받습니다. 실제 판매가와 기준을 함께 적어야 합니다.",
              ]}
            />
          </div>
        </>
      )}

      <StickySummary items={sticky} note={`부가세 10% · 확인 기준일 ${site.baseDateLabel}`} />

      <Note>
        기준일 {site.baseDateLabel}. 부가세율은 부가가치세법 제29조의 10%를 적용했습니다. 이 화면은 금액
        한 건을 다루는 참고용 모의계산이며, 신고·증빙 요건과 간이과세·면세 여부는 거래 형태에 따라 다릅니다.
      </Note>
    </RunnerShell>
  );
}
