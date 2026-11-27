import { useMemo, useState } from "react";
import { withBase } from "@/config/site";
import {
  ANSWER_NOTE,
  CHECKLIST,
  SALARY_BANDS,
  STEPS,
  filterChecklist,
  type Answers,
  type SalaryBand,
} from "@/data/year-end-tax";
import { Segmented } from "@/components/tools/ui";

/**
 * 13월의 월급 지도 — 진단 3문항 → 남는 체크리스트 → 3단계 탭.
 *
 * 지키는 것
 *  · 답은 화면 안 상태로만 둔다. localStorage도 쓰지 않고, 어떤 요청도 보내지 않는다.
 *  · 진단을 바꾸면 목록이 즉시 줄고 는다(남은 항목 수를 함께 보여 준다).
 *  · 항목·문구·근거는 `src/data/year-end-tax.ts` 한 곳에서 온다.
 */
export default function YearEndTaxMap() {
  const [salary, setSalary] = useState<SalaryBand>("b5500_7000");
  const [children, setChildren] = useState<string>("0");
  const [rent, setRent] = useState<string>("no");
  const [step, setStep] = useState<string>(STEPS[0].id);

  const answers: Answers = {
    salary,
    children: Number(children) as Answers["children"],
    rent: rent === "yes",
  };
  const items = useMemo(() => filterChecklist(answers), [salary, children, rent]);
  const active = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const currentBand = SALARY_BANDS.find((b) => b.value === salary);

  return (
    <div data-tax-map data-year="2026">
      {/* 진단 3문항 */}
      <div className="rounded-2xl border border-line bg-white p-5 md:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
          <div>
            <p className="text-[12px] font-bold tracking-[0.02em] text-ink-faint">3문항 진단</p>
            <h2 className="mt-1 text-[17px] font-bold tracking-[-0.03em] text-ink">
              지금 내 자리를 먼저 고릅니다
            </h2>
          </div>
          <span className="chip !min-h-[26px] !text-[12px]">2026년 귀속 (2027년 1~2월 정산)</span>
        </div>

        <div className="grid gap-1 md:grid-cols-3 md:gap-x-8">
          <Segmented
            label="① 총급여 구간"
            value={salary}
            onChange={setSalary}
            options={SALARY_BANDS.map((b) => ({ value: b.value, label: b.label }))}
            hint={currentBand?.note}
          />
          <Segmented
            label="② 기본공제 자녀등 수"
            value={children}
            onChange={setChildren}
            options={[
              { value: "0", label: "0명" },
              { value: "1", label: "1명" },
              { value: "2", label: "2명 이상" },
            ]}
            hint="카드 기본 한도와 자녀 관련 공제가 함께 바뀝니다."
          />
          <Segmented
            label="③ 무주택 월세 거주"
            value={rent}
            onChange={setRent}
            options={[
              { value: "yes", label: "월세 살고 있음" },
              { value: "no", label: "아니오" },
            ]}
            hint="월세 세액공제 대상인지 가릅니다(총급여 8,000만원 이하)."
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
          <p className="text-[12.5px] text-ink-muted" aria-live="polite">
            내 조건에 남은 항목 <b className="text-ink">{items.length}개</b> / 전체 {CHECKLIST.length}개
          </p>
          <button
            type="button"
            onClick={() => {
              setSalary("b5500_7000");
              setChildren("0");
              setRent("no");
            }}
            className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            진단 초기화
          </button>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{ANSWER_NOTE}</p>
      </div>

      {/* 남은 체크리스트 */}
      <ul className="mt-4 grid gap-3 md:grid-cols-2" data-checklist>
        {items.map((item) => (
          <li key={item.id} className="flex flex-col rounded-xl border border-line bg-white p-4">
            <h3 className="text-[14.5px] font-bold leading-snug tracking-[-0.02em] text-ink">{item.title}</h3>
            <p className="mt-1 text-[12.5px] font-semibold text-brand-deep">{item.amount}</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.7] text-ink-muted">{item.body}</p>
            <p className="mt-auto pt-2 text-[12px] text-ink-faint">근거 · {item.source}</p>
            {item.href && (
              <a
                href={withBase(item.href)}
                className="mt-1 inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4"
              >
                {item.hrefLabel ?? "자세히 보기"}
              </a>
            )}
          </li>
        ))}
      </ul>

      {/* 3단계 */}
      <div className="mt-8" data-tax-steps>
        <p className="text-[12px] font-bold tracking-[0.02em] text-ink-faint">3단계</p>
        <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="연말정산 단계">
          {STEPS.map((s) => {
            const on = s.id === step;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`step-${s.id}`}
                onClick={() => setStep(s.id)}
                className={
                  "min-h-[44px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors " +
                  (on
                    ? "bg-ink text-paper"
                    : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                }
              >
                {s.tab}
              </button>
            );
          })}
        </div>

        <div id={`step-${active.id}`} role="tabpanel" className="mt-3 rounded-2xl border border-line bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
            <h2 className="text-[17px] font-bold tracking-[-0.03em] text-ink">{active.title}</h2>
            <span className="mono text-[12px] text-ink-faint">{active.when}</span>
          </div>
          <ol className="mt-3 space-y-3">
            {active.items.map((item, i) => (
              <li key={item.title} className="grid gap-1 sm:grid-cols-[28px_1fr] sm:gap-3">
                <span className="serif text-[15px] tabular-nums text-ink-faint">{i + 1}</span>
                <div>
                  <p className="text-[13.5px] font-semibold leading-snug text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.72] text-ink-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
