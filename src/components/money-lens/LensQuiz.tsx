import { useState } from "react";
import { LENS_QUIZ } from "@/data/money-lens";

/**
 * 3단계 — 착시 퀴즈 3문항 (spec §5-2).
 *
 * 정답을 고르면 계산 과정이 바로 펼쳐지고 관련 도구로 가는 버튼이 붙는다.
 * 점수·벌점은 없다(교육용). 틀려도 해설은 같은 자리에서 보여 준다.
 */
export default function LensQuiz() {
  const [picked, setPicked] = useState<Record<string, number>>({});

  return (
    <div className="grid gap-3 md:grid-cols-3" data-lens-quiz>
      {LENS_QUIZ.map((q, qi) => {
        const chosen = picked[q.id];
        const solved = chosen !== undefined;
        const right = chosen === q.answer;
        return (
          <article key={q.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <p className="text-[12px] font-semibold text-ink-faint">문제 {qi + 1}</p>
            <h3 className="mt-1.5 text-[14.5px] font-bold leading-[1.6] tracking-[-0.02em] text-ink">
              {q.question}
            </h3>

            <div className="mt-3 space-y-1.5" role="group" aria-label={`문제 ${qi + 1} 보기`}>
              {q.options.map((option, oi) => {
                const active = chosen === oi;
                const isAnswer = solved && oi === q.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPicked((prev) => ({ ...prev, [q.id]: oi }))}
                    className={
                      "flex w-full min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] leading-snug transition-colors motion-reduce:transition-none " +
                      (isAnswer
                        ? "border-jade/50 bg-jade-soft font-semibold text-ink"
                        : active
                          ? "border-clay/40 bg-paper-deep text-ink"
                          : "border-line bg-white text-ink-soft hover:border-brand/40")
                    }
                  >
                    <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full border border-line text-[11.5px] font-semibold text-ink-faint">
                      {oi + 1}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            <div aria-live="polite" className="mt-3 flex-1">
              {solved && (
                <div className="rounded-xl bg-paper-deep px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-jade">
                    {right ? "맞았습니다" : `정답은 ${q.answer + 1}번입니다`}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{q.solution}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{q.extra}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft pt-2.5 text-[12px]">
              {q.exits.map((exit) => (
                <a key={exit.href} href={exit.href} className="link inline-flex min-h-[44px] items-center text-brand-deep">
                  {exit.label}
                </a>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
