import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { AmountField, CaveatBox, Line, QuickChoices, TableScroll, num } from "./fields-c";

/**
 * 청약 가점 계산기 — 주택공급에 관한 규칙 별표 1(가점제 적용기준).
 *
 *  · 무주택기간 32점: 1년 미만 2점에서 1년마다 2점, 15년 이상 32점.
 *  · 부양가족 35점: 0명 5점, 1명마다 5점, 6명 이상 35점.
 *  · 통장 가입기간 17점: 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 1점, 15년 이상 17점.
 *  · 배우자 통장은 가입기간의 50%를 최대 3점 가산(본인+배우자 합산 17점 한도).
 */

const noHouseTable = Array.from({ length: 16 }, (_, i) => ({
  label: i === 0 ? "1년 미만" : i === 15 ? "15년 이상" : `${i}년 이상 ~ ${i + 1}년 미만`,
  score: 2 + i * 2,
  min: i, // 구간 하한(년)
}));

const accountTable = Array.from({ length: 17 }, (_, i) => {
  if (i === 0) return { label: "6개월 미만", score: 1, min: 0 };
  if (i === 1) return { label: "6개월 이상 ~ 1년 미만", score: 2, min: 0.5 };
  if (i === 16) return { label: "15년 이상", score: 17, min: 15 };
  return { label: `${i - 1}년 이상 ~ ${i}년 미만`, score: i + 1, min: i - 1 };
});

const dependScore = (n: number) => Math.min(35, 5 + n * 5);

export default function SubscriptionScoreCalc({ compact = false }: { compact?: boolean }) {
  const [noHouse, setNoHouse] = useState(6);
  const [owned, setOwned] = useState<"no" | "yes">("no");
  const [dependents, setDependents] = useState(2);
  const [account, setAccount] = useState(8);
  const [spouse, setSpouse] = useState(0);

  const calc = useMemo(() => {
    const noHouseScore =
      owned === "yes" ? 0 : noHouse < 1 ? 2 : Math.min(32, 2 * (Math.floor(noHouse) + 1));
    const depScore = dependScore(dependents);
    const ownAccount = account < 0.5 ? 1 : Math.min(17, 2 + Math.floor(account));
    const spouseAdd = spouse <= 0 ? 0 : Math.min(3, spouse < 1 ? 1 : spouse < 2 ? 2 : 3);
    const accountScore = Math.min(17, ownAccount + spouseAdd);
    const total = noHouseScore + depScore + accountScore;
    return { noHouseScore, depScore, ownAccount, spouseAdd, accountScore, total };
  }, [noHouse, owned, dependents, account, spouse]);

  const grade = calc.total >= 70 ? "상위권" : calc.total >= 55 ? "중상위권" : calc.total >= 40 ? "중위권" : "하위권";

  return (
    <UtilShell
      id="subscription-score"
      title="청약 가점 계산기"
      subtitle="무주택기간·부양가족·통장가입기간으로 84점 만점 가점을 계산하고 항목별 점수표를 함께 보여 줍니다."
      note={
        <>
          주택공급에 관한 규칙 별표 1 기준입니다. 모든 기간은{" "}
          <strong className="font-semibold text-ink">입주자모집공고일</strong>에 맞춰 세어야 합니다.
        </>
      }
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <QuickChoices
          label="세대 주택 소유"
          value={owned}
          onChange={setOwned}
          options={[
            { value: "no", label: "무주택" },
            { value: "yes", label: "주택 있음(0점)" },
          ]}
        />
        <AmountField
          label="무주택기간"
          value={noHouse}
          onChange={setNoHouse}
          min={0}
          max={25}
          step={0.5}
          decimals={1}
          unit="년"
          edgeFormat={(v) => `${num(v, 1)}년`}
          hint="만 30세가 되는 날(30세 전 혼인 시 혼인신고일)부터"
        />
        <AmountField
          label="부양가족 수 (본인 제외)"
          value={dependents}
          onChange={(v) => setDependents(Math.round(v))}
          min={0}
          max={8}
          step={1}
          unit="명"
          edgeFormat={(v) => `${v}명`}
        />
        <AmountField
          label="청약통장 가입기간"
          value={account}
          onChange={setAccount}
          min={0}
          max={25}
          step={0.5}
          decimals={1}
          unit="년"
          edgeFormat={(v) => `${num(v, 1)}년`}
          hint="최초 가입일 기준 · 미성년 기간은 최대 5년만 인정"
        />
        <AmountField
          label="배우자 통장 가입기간"
          value={spouse}
          onChange={setSpouse}
          min={0}
          max={25}
          step={0.5}
          decimals={1}
          unit="년"
          edgeFormat={(v) => `${num(v, 1)}년`}
          hint="50% 인정 · 최대 3점"
        />
      </div>

      <div className="mt-4 rounded-xl border border-brand/25 bg-brand-soft/40 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-faint">청약가점</p>
            <p className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-brand">
              {calc.total}
              <span className="ml-1 text-[15px] font-bold text-ink-muted">/ 84점</span>
            </p>
          </div>
          <span className="chip">{grade}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "무주택기간", value: calc.noHouseScore, max: 32 },
            { label: "부양가족", value: calc.depScore, max: 35 },
            { label: "통장기간", value: calc.accountScore, max: 17 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-white px-2 py-2">
              <p className="text-[11.5px] font-semibold text-ink-faint">{s.label}</p>
              <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-ink">
                {s.value}
                <span className="ml-0.5 text-[11px] font-semibold text-ink-faint">/{s.max}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <Line label="무주택기간 점수" value={`${calc.noHouseScore}점`} sub={owned === "yes" ? "주택 소유 세대는 0점" : undefined} />
        <Line label="부양가족 점수" value={`${calc.depScore}점`} sub={`${dependents}명 · 5점 + 5점×인원`} />
        <Line label="본인 통장 점수" value={`${calc.ownAccount}점`} />
        <Line label="배우자 가산" value={calc.spouseAdd ? `+${calc.spouseAdd}점` : "없음"} />
        <Line label="통장 합산" value={`${calc.accountScore}점`} sub="본인+배우자 17점 한도" strong />
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">무주택기간 점수표</p>
          <TableScroll minWidth={380}>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {noHouseTable.map((row) => {
                  const now =
                    owned === "no" &&
                    (row.min === 0 ? noHouse < 1 : noHouse >= row.min && (row.min === 15 || noHouse < row.min + 1));
                  return (
                    <tr
                      key={row.label}
                      className={
                        "border-b border-line-soft last:border-0 " +
                        (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                      }
                    >
                      <td className="py-1.5 pr-2">{row.label}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.score}점</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">통장 가입기간 점수표</p>
          <TableScroll minWidth={380}>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {accountTable.map((row, i) => {
                  const now = calc.ownAccount === row.score;
                  return (
                    <tr
                      key={row.label}
                      className={
                        "border-b border-line-soft last:border-0 " +
                        (now ? "bg-brand-soft/60 font-bold text-brand" : "text-ink-muted")
                      }
                    >
                      <td className="py-1.5 pr-2">
                        {i === 0 ? "6개월 미만" : row.label}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{row.score}점</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <div className="mt-4">
        <CaveatBox
          title="점수를 세기 전에"
          items={[
            "부양가족은 요건을 갖춘 사람만 셉니다. 직계존속은 3년 이상 같은 등본, 미혼 자녀는 같은 등본(30세 이상은 1년 이상)이어야 합니다.",
            "부모 중 한 명이라도 주택을 소유하면 두 분 모두 부양가족에서 빠집니다.",
            "가점 커트라인은 단지·평형·공급 유형마다 달라 이 도구가 판단하지 않습니다.",
            "실제 점수는 청약홈 가점계산기와 입주자모집공고일 기준으로 확인하세요.",
          ]}
        />
      </div>
    </UtilShell>
  );
}
