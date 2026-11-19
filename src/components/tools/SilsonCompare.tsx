import { useMemo, useState } from "react";
import { Bar, MoneySlider, Note, ResultStat, RunnerShell, Segmented, formatMan } from "./ui";

type Hospital = "clinic" | "hospital" | "general" | "tertiary";

const HOSPITAL: Record<Hospital, { label: string; rate: number; minOutpatient: number }> = {
  clinic: { label: "의원", rate: 0.3, minOutpatient: 10000 },
  hospital: { label: "병원", rate: 0.4, minOutpatient: 10000 },
  general: { label: "종합병원", rate: 0.5, minOutpatient: 20000 },
  tertiary: { label: "상급종합병원", rate: 0.6, minOutpatient: 20000 },
};

/** 4세대: 급여 입원 20%, 급여 통원 max(20%, 최소 1·2만원), 비급여 30% */
function gen4(input: {
  inpatientCovered: number;
  outpatientCovered: number;
  severeNon: number;
  mildNon: number;
  minOut: number;
}) {
  const inpatient = input.inpatientCovered * 0.2;
  const outpatient = Math.max(input.outpatientCovered * 0.2, input.minOut);
  const nonSevere = input.severeNon * 0.3;
  const nonMild = input.mildNon * 0.3;
  const covered = Math.max(input.severeNon - nonSevere, 0) + Math.max(input.mildNon - nonMild, 0);
  return {
    selfPay: inpatient + outpatient + nonSevere + nonMild,
    payout: Math.max(input.inpatientCovered * 0.8, 0) + Math.max(input.outpatientCovered - outpatient, 0) + covered,
    detail: [
      { label: "급여 입원", self: inpatient },
      { label: "급여 통원", self: outpatient },
      { label: "중증 비급여", self: nonSevere },
      { label: "비중증 비급여", self: nonMild },
    ],
  };
}

/** 5세대: 급여 입원 20%, 급여 통원 max(건보 본인부담률, 20%, 최소 1·2만원),
 *  중증 비급여 30%(상급·종합 입원 연 500만원 자기부담 상한), 비중증 비급여 50% */
function gen5(input: {
  inpatientCovered: number;
  outpatientCovered: number;
  severeNon: number;
  mildNon: number;
  minOut: number;
  hospitalRate: number;
  hasSevereCap: boolean;
}) {
  const inpatient = input.inpatientCovered * 0.2;
  const outpatient = Math.max(input.outpatientCovered * input.hospitalRate, input.outpatientCovered * 0.2, input.minOut);
  let severeSelf = input.severeNon * 0.3;
  if (input.hasSevereCap) severeSelf = Math.min(severeSelf, 5000000);
  const mildSelf = input.mildNon * 0.5;
  const severePayout = Math.max(input.severeNon - severeSelf, 0);
  const mildPayout = Math.max(input.mildNon - mildSelf, 0);
  return {
    selfPay: inpatient + outpatient + severeSelf + mildSelf,
    payout: Math.max(input.inpatientCovered * 0.8, 0) + Math.max(input.outpatientCovered - outpatient, 0) + severePayout + mildPayout,
    detail: [
      { label: "급여 입원", self: inpatient },
      { label: "급여 통원", self: outpatient },
      { label: "중증 비급여", self: severeSelf },
      { label: "비중증 비급여", self: mildSelf },
    ],
  };
}

export default function SilsonCompare({ compact = false }: { compact?: boolean }) {
  const [hospital, setHospital] = useState<Hospital>("hospital");
  const [inpatient, setInpatient] = useState(300);
  const [outpatient, setOutpatient] = useState(50);
  const [severe, setSevere] = useState(200);
  const [mild, setMild] = useState(100);

  const h = HOSPITAL[hospital];
  const toWon = (man: number) => man * 10000;

  const input = {
    inpatientCovered: toWon(inpatient),
    outpatientCovered: toWon(outpatient),
    severeNon: toWon(severe),
    mildNon: toWon(mild),
    minOut: h.minOutpatient,
  };

  const g4 = useMemo(() => gen4(input), [inpatient, outpatient, severe, mild, hospital]);
  const g5 = useMemo(
    () =>
      gen5({
        ...input,
        hospitalRate: h.rate,
        hasSevereCap: hospital === "general" || hospital === "tertiary",
      }),
    [inpatient, outpatient, severe, mild, hospital]
  );

  const total = toWon(inpatient + outpatient + severe + mild);
  const diff = g4.selfPay - g5.selfPay;

  return (
    <RunnerShell
      title="실손 세대별 비교 (4세대 · 5세대)"
      example="병원비를 급여·중증·비중증으로 나눠 바꿔 보세요."
      subtitle="같은 병원비를 4세대와 5세대에 넣어 자기부담금과 환급액을 비교합니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <Segmented
          label="진료한 의료기관"
          value={hospital}
          onChange={setHospital}
          options={[
            { value: "clinic", label: "의원" },
            { value: "hospital", label: "병원" },
            { value: "general", label: "종합병원" },
            { value: "tertiary", label: "상급종합" },
          ]}
          hint="5세대 급여 통원은 건강보험 본인부담률과 연동됩니다."
        />
        <MoneySlider label="급여 입원 의료비(본인부담 총액)" value={inpatient} onChange={setInpatient} min={0} max={3000} step={10} />
        <MoneySlider label="급여 통원 의료비" value={outpatient} onChange={setOutpatient} min={0} max={300} step={5} />
        <MoneySlider label="중증 비급여 (암·뇌·심장 등)" value={severe} onChange={setSevere} min={0} max={3000} step={10} />
        <MoneySlider label="비중증 비급여 (도수·주사 등)" value={mild} onChange={setMild} min={0} max={1000} step={5} />
        <p className="text-[12px] leading-relaxed text-ink-muted md:col-span-2">
          도수치료·체외충격파·비급여주사 등 특약2 보장 제외 항목은 별도(약관 확인)
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ResultStat label="병원비 합계(가정)" value={formatMan(total / 10000)} sub="입력값 기준" />
        <ResultStat label="4세대 자기부담" value={formatMan(g4.selfPay / 10000)} sub={`환급 ${formatMan(g4.payout / 10000)}`} />
        <ResultStat
          label="5세대 자기부담"
          value={formatMan(g5.selfPay / 10000)}
          tone="brand"
          sub={`환급 ${formatMan(g5.payout / 10000)}`}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">세대별 자기부담금 비교</caption>
          <thead>
            <tr className="border-b border-line bg-paper-deep text-left">
              <th scope="col" className="px-3 py-2.5 font-semibold text-ink-soft">구간</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">4세대</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">5세대</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-soft">차이</th>
            </tr>
          </thead>
          <tbody>
            {g4.detail.map((d, i) => {
              const m = g5.detail[i].self;
              const delta = m - d.self;
              return (
                <tr key={d.label} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-ink">{d.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatMan(d.self / 10000)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ink">{formatMan(m / 10000)}</td>
                  <td
                    className={
                      "px-3 py-2.5 text-right tabular-nums font-semibold " +
                      (delta > 0 ? "text-[#a8455c]" : delta < 0 ? "text-jade" : "text-ink-faint")
                    }
                  >
                    {delta === 0 ? "—" : (delta > 0 ? "+" : "−") + formatMan(Math.abs(delta) / 10000)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">자기부담 비율</p>
          <div className="mt-3 space-y-3">
            {[
              { label: "4세대", ratio: total ? g4.selfPay / total : 0, tone: "brand" as const },
              { label: "5세대", ratio: total ? g5.selfPay / total : 0, tone: "jade" as const },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-[12px] text-ink-muted">
                  <span>{r.label}</span>
                  <span className="font-semibold tabular-nums">{(r.ratio * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1">
                  <Bar ratio={r.ratio} tone={r.tone} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">이 병원비에서는</p>
          <p className="mt-2 text-[13.5px] font-semibold leading-relaxed text-ink">
            {diff > 0
              ? `5세대가 ${formatMan(diff / 10000)} 유리합니다.`
              : diff < 0
                ? `4세대가 ${formatMan(-diff / 10000)} 유리합니다.`
                : "두 세대의 자기부담이 같습니다."}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            보험료 차이는 별도입니다. 5세대 보험료는 4세대 대비 약 30% 낮은 것으로 발표됐습니다(금융위원회
            2026-05-06).
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">전환 전 확인할 조건</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
            <li>· 5세대 전환은 별도 심사 없이 가능하지만, 보장 확대·재전환은 심사 대상입니다.</li>
            <li>· 보험금 수령이 없으면 6개월 이내 전환 철회가 가능합니다(3개월 이후는 보험사고 없을 때).</li>
            <li>· 계약전환 할인은 2026년 11월부터 6개월간 시행 후 연장 여부를 검토합니다.</li>
          </ul>
        </div>
      )}

      <Note>
        모든 비급여를 입원 치료로 가정하고, 연간 한도(중증 5천만원·비중증 1천만원)는 넘지 않는다고 보고
        계산했습니다. 1·2세대는 가입 시기와 약관에 따라 구조가 달라 단일 기준으로 계산하지 않습니다.
      </Note>
    </RunnerShell>
  );
}
