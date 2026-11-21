import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, TableScroll, num } from "./fields-c";

/**
 * 건보료 직장 vs 지역 비교기 — 2026년 기준.
 *
 *  · 건강보험료율 7.19%(직장·지역 동일). 직장가입자는 가입자·사용자 각 50%(3.595%).
 *  · 장기요양보험료율 0.9448%(보수월액 대비) = 건강보험료의 13.14%.
 *  · 지역가입자 = 소득월액 × 7.19% + 재산보험료부과점수 × 211.5원.
 *  · 재산점수: 재산세 과세표준 − 1억원 → 시행령 별표 4의 60등급 점수.
 *  · 임의계속가입: 퇴직 전 18개월 중 1년 이상 직장가입자, 최대 36개월, 보험료 100% 본인 부담.
 */

/** 시행령 별표 4 — 공제 후 재산금액(만원) 상한과 점수 */
const PROPERTY_GRADES: [number, number][] = [
  [450, 22], [900, 44], [1350, 66], [1800, 97], [2250, 122], [2700, 146], [3150, 171], [3600, 195],
  [4050, 219], [4500, 244], [5020, 268], [5590, 294], [6220, 320], [6930, 344], [7710, 365], [8590, 386],
  [9570, 412], [10700, 439], [11900, 465], [13300, 490], [14800, 516], [16400, 535], [18300, 559], [20400, 586],
  [22700, 611], [25300, 637], [28100, 659], [31300, 681], [34900, 706], [38800, 731], [43200, 757], [48100, 785],
  [53600, 812], [59700, 841], [66500, 881], [74000, 921], [82400, 961], [91800, 1001], [103000, 1041], [114000, 1091],
  [127000, 1141], [142000, 1191], [158000, 1241], [176000, 1291], [196000, 1341], [218000, 1391], [242000, 1451],
  [270000, 1511], [300000, 1571], [330000, 1641], [363000, 1711], [399300, 1781], [439230, 1851], [483153, 1921],
  [531468, 1991], [584615, 2061], [643077, 2131], [707385, 2201], [778124, 2271], [Infinity, 2341],
];

const RATE = 0.0719;
const LTC_RATIO = 0.9448 / 7.19; // 13.14%
const POINT_WON = 211.5;

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

function propertyScore(baseWon: number) {
  const after = Math.max(0, baseWon - 100000000) / 10000; // 만원
  if (after <= 0) return { score: 0, grade: 0, after };
  const idx = PROPERTY_GRADES.findIndex(([max]) => after <= max);
  const g = idx < 0 ? PROPERTY_GRADES.length - 1 : idx;
  return { score: PROPERTY_GRADES[g][1], grade: g + 1, after };
}

export default function HealthPremiumCompare({ compact = false }: { compact?: boolean }) {
  const [salary, setSalary] = useState(5000000);
  const [retireIncome, setRetireIncome] = useState(3600); // 만원/년
  const [propertyBase, setPropertyBase] = useState(45000); // 만원

  const calc = useMemo(() => {
    // 직장
    const workHealth = salary * RATE;
    const workSelf = workHealth / 2;
    const workLtc = workSelf * LTC_RATIO;
    const workTotal = workSelf + workLtc;
    const companyTotal = workHealth / 2 + (workHealth / 2) * LTC_RATIO;

    // 지역
    const incomeMonth = (retireIncome * 10000) / 12;
    const incomePart = incomeMonth * RATE;
    const ps = propertyScore(propertyBase * 10000);
    const propertyPart = ps.score * POINT_WON;
    const regionHealth = incomePart + propertyPart;
    const regionLtc = regionHealth * LTC_RATIO;
    const regionTotal = regionHealth + regionLtc;

    const diff = regionTotal - workTotal;
    const optional = workHealth + workHealth * LTC_RATIO; // 임의계속가입 = 퇴직 전 보험료 100%

    return {
      workHealth,
      workSelf,
      workLtc,
      workTotal,
      companyTotal,
      incomeMonth,
      incomePart,
      ps,
      propertyPart,
      regionHealth,
      regionLtc,
      regionTotal,
      diff,
      optional,
    };
  }, [salary, retireIncome, propertyBase]);

  return (
    <UtilShell
      id="health-insurance-compare"
      title="건보료 직장 vs 지역 비교기"
      subtitle="2026년 보험료율 7.19%로 직장 본인 부담과 퇴사 후 지역가입자 보험료를 나란히 계산합니다."
      note={
        <>
          직장 보수월액과 퇴직 후 예상 소득·재산을 넣으면 두 보험료가{" "}
          <strong className="font-semibold text-ink">동시에</strong> 다시 계산됩니다. 실제 고지액은 공단 산정 내역이
          기준입니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="현재 월 급여(보수월액)"
          value={salary}
          onChange={setSalary}
          min={0}
          max={20000000}
          step={100000}
          unit="원"
          noSlider
          hint="비과세 소득을 뺀 보수월액"
        />
        <AmountField
          label="퇴직 후 예상 연 소득"
          value={retireIncome}
          onChange={setRetireIncome}
          min={0}
          max={30000}
          step={100}
          unit="만원"
          hint="사업·이자·배당 등 종합소득 합계"
        />
        <AmountField
          label="재산세 과세표준 합계"
          value={propertyBase}
          onChange={setPropertyBase}
          min={0}
          max={200000}
          step={1000}
          unit="만원"
          hint="주택·건물·토지 과표 합계(시세 아님)"
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">직장가입자 본인 부담</p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums text-ink">{won(calc.workTotal)}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
            건강 {won(calc.workSelf)} + 장기요양 {won(calc.workLtc)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">지역가입자 월 보험료</p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums text-brand">{won(calc.regionTotal)}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
            소득 {won(calc.incomePart)} + 재산 {won(calc.propertyPart)}
          </p>
        </div>
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">월 차이</p>
          <p className={"mt-1 text-[20px] font-extrabold tabular-nums " + (calc.diff >= 0 ? "text-clay" : "text-jade")}>
            {calc.diff >= 0 ? "+" : "−"}
            {won(Math.abs(calc.diff))}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {calc.diff >= 0 ? "지역 전환이 더 비쌉니다" : "지역 전환이 더 쌉니다"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Line label="직장 건강보험료(전체)" value={won(calc.workHealth)} sub="보수월액 × 7.19%" />
        <Line label="직장 본인 부담(50%)" value={won(calc.workSelf)} />
        <Line label="직장 장기요양(본인)" value={won(calc.workLtc)} sub="건강보험료 × 13.14%" />
        <Line label="회사 부담분" value={won(calc.companyTotal)} sub="본인과 같은 금액" />
        <Line label="지역 소득월액" value={won(calc.incomeMonth)} sub={`연 ${num(retireIncome)}만원 ÷ 12`} />
        <Line label="지역 재산등급" value={calc.ps.grade ? `${calc.ps.grade}등급 · ${num(calc.ps.score)}점` : "0점(공제 후 없음)"} sub={`공제 후 ${num(Math.round(calc.ps.after))}만원`} />
        <Line label="지역 재산보험료" value={won(calc.propertyPart)} sub={`${num(calc.ps.score)}점 × 211.5원`} />
        <Line label="지역 장기요양" value={won(calc.regionLtc)} />
        <Line label="지역 합계" value={won(calc.regionTotal)} strong tone="brand" />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-paper-deep p-4">
        <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">임의계속가입</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#4a4636]">
          퇴직 전 18개월 중 1년 이상 직장가입자였다면, 최대 36개월까지 직장가입자였을 때의 보험료를 이어 낼 수
          있습니다. 다만 보험료는 퇴직 전 보험료의 <b>100%(가입자+사용자분)</b>를 본인이 냅니다.
        </p>
        <p className="mt-1.5 text-[12.5px] font-bold text-[#4a4636]">
          이 경우 월 {won(calc.optional)} — 지역 전환({won(calc.regionTotal)})보다{" "}
          {calc.optional <= calc.regionTotal ? "쌉니다" : "비쌉니다"}
        </p>
      </div>

      <details className="mt-3 rounded-xl border border-line bg-white p-3">
        <summary className="cursor-pointer text-[12.5px] font-bold text-ink">
          재산보험료 부과점수표 (60등급) 보기
        </summary>
        <div className="mt-2">
          <TableScroll minWidth={420}>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className="py-1.5 pr-2 text-left font-semibold">등급</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">공제 후 재산(만원)</th>
                  <th className="py-1.5 text-right font-semibold">점수</th>
                </tr>
              </thead>
              <tbody>
                {PROPERTY_GRADES.map(([max, score], i) => {
                  const from = i === 0 ? 0 : PROPERTY_GRADES[i - 1][0];
                  const now = calc.ps.grade === i + 1;
                  return (
                    <tr
                      key={i}
                      className={
                        "border-b border-line-soft last:border-0 " +
                        (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                      }
                    >
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 text-right tabular-nums">
                        {from} ~ {max === Infinity ? "이상" : num(max)}
                      </td>
                      <td className="py-1 text-right tabular-nums">{num(score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </details>

      <div className="mt-4">
        <CaveatBox
          title="계산에 넣지 않은 것"
          items={[
            "주택금융부채 공제(최대 5천만원), 임차 보증금 평가액, 경감률은 반영하지 않았습니다.",
            "지역가입자 최저·상한 보험료와 피부양자 등록 가능성은 계산하지 않습니다.",
            "보수 외 소득(이자·배당) 2,000만원 초과에 따른 추가 보험료는 별도입니다.",
            "자동차 보험료는 2024년 2월분부터 폐지되어 재산 산정에 없습니다.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
