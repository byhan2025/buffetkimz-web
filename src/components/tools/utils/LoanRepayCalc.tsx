import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw, formatMan } from "../ui";
import { AmountField, CaveatBox, Line, TableScroll } from "./fields-c";

/**
 * 대출 상환 계산기 — 원리금균등·원금균등·만기일시.
 * 거치기간에는 이자만 내고, 거치가 끝난 뒤 남은 기간으로 원금을 나눈다.
 */

type Method = "equal" | "principal" | "bullet";

const METHOD_LABEL: Record<Method, string> = {
  equal: "원리금균등",
  principal: "원금균등",
  bullet: "만기일시",
};

type Row = { month: number; payment: number; principal: number; interest: number; balance: number };

type Result = {
  rows: Row[];
  first: number;
  last: number;
  max: number;
  totalInterest: number;
  totalPayment: number;
};

function schedule(principal: number, annualRate: number, months: number, grace: number, method: Method): Result {
  const r = annualRate / 100 / 12;
  const rows: Row[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPayment = 0;

  const amortMonths = Math.max(1, months - grace);
  const equalPayment = r === 0 ? principal / amortMonths : (principal * r) / (1 - Math.pow(1 + r, -amortMonths));
  const principalPart = principal / amortMonths;

  for (let m = 1; m <= months; m += 1) {
    const interest = balance * r;
    let payPrincipal = 0;
    if (m <= grace) {
      payPrincipal = 0;
    } else if (method === "bullet") {
      payPrincipal = m === months ? balance : 0;
    } else if (method === "equal") {
      payPrincipal = equalPayment - interest;
      if (m === months) payPrincipal = balance;
    } else {
      payPrincipal = m === months ? balance : Math.min(principalPart, balance);
    }
    const payment = payPrincipal + interest;
    balance = Math.max(0, balance - payPrincipal);
    totalInterest += interest;
    totalPayment += payment;
    rows.push({ month: m, payment, principal: payPrincipal, interest, balance });
  }

  const payments = rows.map((row) => row.payment);
  return {
    rows,
    first: payments[0] ?? 0,
    last: payments[payments.length - 1] ?? 0,
    max: Math.max(...payments, 0),
    totalInterest,
    totalPayment,
  };
}

export default function LoanRepayCalc({ compact = false }: { compact?: boolean }) {
  const [principal, setPrincipal] = useState(30000); // 만원
  const [rate, setRate] = useState(4.5); // 연 %
  const [years, setYears] = useState(30);
  const [grace, setGrace] = useState(0);
  const [method, setMethod] = useState<Method>("equal");

  const P = principal * 10000;
  const months = years * 12;
  /* 거치기간은 만기보다 짧아야 한다 — 기간을 줄이면 거치도 함께 줄인다 */
  const graceYears = Math.min(grace, Math.max(0, years - 1));

  /* v7.7 — 거치기간은 '년' 입력이므로 월 단위로 환산해 넘긴다(2년 → 24개월).
     이 환산이 빠지면 2년 거치가 2개월로 계산돼 월 상환액·총이자가 모두 틀어진다. */
  const graceMonths = graceYears * 12;
  const results = useMemo(
    () => ({
      equal: schedule(P, rate, months, graceMonths, "equal"),
      principal: schedule(P, rate, months, graceMonths, "principal"),
      bullet: schedule(P, rate, months, graceMonths, "bullet"),
    }),
    [P, rate, months, graceMonths],
  );

  const current = results[method];

  const yearly = useMemo(() => {
    const out: { year: number; payment: number; interest: number; principal: number; balance: number }[] = [];
    current.rows.forEach((row, i) => {
      const year = Math.floor(i / 12) + 1;
      if (!out[year - 1]) out[year - 1] = { year, payment: 0, interest: 0, principal: 0, balance: row.balance };
      const slot = out[year - 1];
      slot.payment += row.payment;
      slot.interest += row.interest;
      slot.principal += row.principal;
      slot.balance = row.balance;
    });
    return out;
  }, [current]);

  const interestShare = P > 0 ? current.totalInterest / P : 0;
  /* 거치가 있으면 '거치 후 월 상환액'이 실제로 체감하는 숫자다 — 대표 값으로 보여 준다. */
  const postGracePayment = graceMonths > 0 ? current.rows[graceMonths]?.payment ?? current.first : current.first;

  return (
    <RunnerShell
      title="대출 원리금 상환 계산"
      subtitle="같은 조건에서 세 가지 상환 방식의 월 상환액과 총이자를 나란히 비교합니다."
      example="대출금 3억·금리 4.5%·30년으로 시작합니다. 금리와 기간을 바꾸면 세 방식이 함께 다시 계산됩니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <AmountField
          label="대출금"
          value={principal}
          onChange={setPrincipal}
          min={1000}
          max={100000}
          step={500}
          unit="만원"
          hint="1,000만 ~ 10억"
          edgeFormat={(v) => (v >= 10000 ? `${(v / 10000).toLocaleString("ko-KR")}억` : `${v.toLocaleString("ko-KR")}만`)}
        />
        <AmountField
          label="연 금리"
          value={rate}
          onChange={setRate}
          min={0}
          max={15}
          step={0.1}
          unit="%"
          decimals={2}
          hint="고정금리 기준"
          edgeFormat={(v) => `${v}%`}
        />
        <AmountField
          label="대출 기간"
          value={years}
          onChange={(v) => setYears(Math.round(v))}
          min={1}
          max={40}
          step={1}
          unit="년"
          edgeFormat={(v) => `${v}년`}
        />
        <AmountField
          label="거치 기간"
          value={grace}
          onChange={(v) => setGrace(Math.min(Math.round(v), years))}
          min={0}
          max={10}
          step={1}
          unit="년"
          hint="이자만 납부"
          edgeFormat={(v) => `${v}년`}
        />
      </div>

      <Segmented
        label="상환 방식"
        value={method}
        onChange={setMethod}
        options={[
          { value: "equal", label: "원리금균등" },
          { value: "principal", label: "원금균등" },
          { value: "bullet", label: "만기일시" },
        ]}
        hint="원리금균등은 매달 같은 금액, 원금균등은 원금을 같은 금액으로 나눠 이자가 줄어듭니다. 만기일시는 이자만 내다가 만기에 원금을 갚습니다."
      />

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div data-testid="monthly-payment">
          <ResultStat
            label={`${METHOD_LABEL[method]} ${graceMonths > 0 ? "거치 후 월 상환액" : "월 상환액"}`}
            value={formatKrw(postGracePayment)}
            tone="brand"
            sub={
              graceMonths > 0
                ? `거치 ${graceYears}년(이자만 ${formatKrw(current.first)}/월) 후 ${graceMonths + 1}개월 차부터`
                : method === "equal"
                  ? "매달 같은 금액"
                  : method === "principal"
                    ? `첫 달 최대 · 마지막 ${formatKrw(current.last)}`
                    : "매달 이자만 · 만기에 원금"
            }
          />
        </div>
        <div data-testid="total-interest">
          <ResultStat
            label="총 이자"
            value={formatKrw(current.totalInterest)}
            sub={`원금의 ${(interestShare * 100).toFixed(1)}%`}
          />
        </div>
        <div data-testid="total-payment">
          <ResultStat
            label="총 상환액"
            value={formatKrw(current.totalPayment)}
            tone="jade"
            sub={`원금 ${formatMan(P / 10000)} + 이자 ${formatMan(current.totalInterest / 10000)}`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="min-w-0 rounded-xl border border-line bg-white">
          <TableScroll><table className="w-full border-collapse text-[12.5px]">
            <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
              세 가지 상환 방식 비교 (거치 {graceYears}년 포함)
            </caption>
            <thead>
              <tr className="border-b border-line bg-[#fbfbf8] text-left">
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">방식</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">월 상환액</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">총 이자</th>
              </tr>
            </thead>
            <tbody>
              {(["equal", "principal", "bullet"] as Method[]).map((key) => {
                const res = results[key];
                const active = key === method;
                return (
                  <tr
                    key={key}
                    className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/40" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-ink">
                      {METHOD_LABEL[key]}
                      {active && <span className="ml-1.5 text-[12px] font-normal text-brand">선택</span>}
                      <span className="mt-0.5 block text-[12px] font-normal text-ink-faint">
                        {key === "equal"
                          ? "매달 같은 금액"
                          : key === "principal"
                            ? `첫 달 ${formatMan(res.first / 10000)} → 마지막 ${formatMan(res.last / 10000)}`
                            : `매달 이자 ${formatKrw(res.rows[0]?.interest ?? 0)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                      {key === "bullet" ? formatKrw(res.rows[0]?.interest ?? 0) : formatKrw(res.first)}
                      <span className="mt-0.5 block text-[12px] text-ink-faint">
                        {key === "principal" ? "첫 달 기준" : key === "bullet" ? "이자만" : "고정"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">
                      {formatMan(res.totalInterest / 10000)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></TableScroll>
          <div className="border-t border-line p-3">
            <Line
              label="가장 이자가 적은 방식"
              value={
                results.equal.totalInterest <= results.principal.totalInterest &&
                results.equal.totalInterest <= results.bullet.totalInterest
                  ? "원리금균등"
                  : results.principal.totalInterest <= results.bullet.totalInterest
                    ? "원금균등"
                    : "만기일시"
              }
              strong
              tone="brand"
            />
            <Line
              label="원리금균등 대비 원금균등 이자 차이"
              value={formatKrw(Math.abs(results.equal.totalInterest - results.principal.totalInterest))}
            />
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">연차별 상환 (선택한 방식)</p>
          <div className="mt-2 max-h-[264px] overflow-auto">
            <TableScroll><table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-1.5 font-semibold text-ink-soft">연차</th>
                  <th scope="col" className="py-1.5 text-right font-semibold text-ink-soft">연 상환액</th>
                  <th scope="col" className="py-1.5 text-right font-semibold text-ink-soft">이자</th>
                  <th scope="col" className="py-1.5 text-right font-semibold text-ink-soft">잔액</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((row) => (
                  <tr key={row.year} className="border-b border-line-soft last:border-0">
                    <td className="py-1.5 font-semibold text-ink">{row.year}년</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-muted">{formatMan(row.payment / 10000)}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-faint">{formatMan(row.interest / 10000)}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{formatMan(row.balance / 10000)}</td>
                  </tr>
                ))}
              </tbody>
            </table></TableScroll>
          </div>
          <CaveatBox
            items={[
              "금리가 변동되면 월 상환액과 총이자가 달라집니다. 이 계산은 입력한 금리가 만기까지 같다고 봅니다.",
              "중도상환수수료, 인지세, 근저당 설정비용, 보증료는 넣지 않았습니다.",
              "거치기간에는 이자만 내므로 원금이 줄지 않습니다. 거치가 길수록 총이자가 늘어납니다.",
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">첫 1년 월별 상환 내역</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3 md:grid-cols-4">
            {current.rows.slice(0, 12).map((row) => (
              <div key={row.month} className="border-b border-line-soft py-1.5">
                <span className="text-[12px] text-ink-faint">{row.month}개월</span>
                <span className="ml-2 text-[12.5px] font-semibold tabular-nums text-ink">
                  {formatKrw(row.payment)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            원금 {formatMan(principal)} · 연 {rate}% · {years}년 · 거치 {graceYears}년 · 월 이자율{" "}
            {(rate / 12).toFixed(4)}%
          </p>
        </div>
      )}

      <StickySummary
        items={[
          { label: graceMonths > 0 ? "거치 후 월 상환" : "월 상환", value: formatKrw(postGracePayment) },
          { label: "총 이자", value: formatKrw(current.totalInterest) },
        ]}
        note={`${METHOD_LABEL[method]} · 확인 기준일 ${site.baseDateLabel}`}
      />

      <Note>
        기준일 {site.baseDateLabel}. 원리금균등은 매달 원리금 합계가 같고, 원금균등은 원금을 기간으로 나눠
        갚아 이자가 매달 줄어듭니다. 만기일시는 만기에 원금을 한 번에 갚는 조건으로, 실제 은행에서는
        주로 신용대출·전세대출에 쓰입니다. 참고용 모의계산이며 실제 조건은 금융회사 상환계획과 대출약정을
        확인하세요.
      </Note>
    </RunnerShell>
  );
}
