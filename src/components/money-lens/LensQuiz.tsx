import { useState } from "react";
import { LENS_QUIZ } from "@/data/money-lens";
import { withBase } from "@/config/site";

/**
 * 착시 퀴즈 3문항 (spec §5-2) — 2026-11-26 대시보드 개편에 맞춰 밀도를 올렸다.
 *
 * 바뀐 것: 보기를 세로 버튼 3개(각 44px)에서 한 줄 칩으로 접고, 카드 여백을 줄였다.
 * 390px에서 3문항이 1,100px → 600px 안쪽으로 들어온다(같은 내용, 같은 해설).
 * 정답을 고르면 계산 과정이 그 자리에서 펼쳐지고 관련 도구로 가는 링크가 붙는다.
 * 점수·벌점은 없다(교육용). 틀려도 해설은 같은 자리에서 보여 준다.
 *
 * 2026-11-26 — 퀴즈의 `exit.href`는 데이터의 논리 경로("/apps/…")다. GitHub Pages
 * 서브패스(/buffetkimz-web/)에서 404가 나지 않도록 그릴 때 `withBase()`를 쓴다.
 */
export default function LensQuiz() {
  const [picked, setPicked] = useState<Record<string, number>>({});

  return (
    <div className="grid gap-2.5 md:grid-cols-3" data-lens-quiz>
      {LENS_QUIZ.map((q, qi) => {
        const chosen = picked[q.id];
        const solved = chosen !== undefined;
        const right = chosen === q.answer;
        return (
          <article key={q.id} className="flex flex-col rounded-2xl border border-line bg-surface p-3">
            <p className="text-[11px] font-semibold text-ink-faint">문제 {qi + 1}</p>
            <h3 className="mt-0.5 text-[13px] font-bold leading-[1.55] tracking-[-0.01em] text-ink">
              {q.question}
            </h3>

            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={`문제 ${qi + 1} 보기`}>
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
                      "flex min-h-[36px] items-center rounded-full border px-2.5 text-[12px] leading-snug transition-colors motion-reduce:transition-none " +
                      (isAnswer
                        ? "border-jade/50 bg-jade-soft font-semibold text-ink"
                        : active
                          ? "border-clay/40 bg-paper-deep text-ink"
                          : "border-line bg-white text-ink-soft hover:border-brand/40")
                    }
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div aria-live="polite" className="flex-1">
              {solved && (
                <div className="mt-2 rounded-xl bg-paper-deep px-2.5 py-2">
                  <p className="text-[11.5px] font-semibold text-jade">
                    {right ? "맞았습니다" : `정답은 ${q.answer + 1}번입니다`}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{q.solution}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{q.extra}</p>
                </div>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-3 border-t border-line-soft pt-0.5 text-[11.5px]">
              {q.exits.map((exit) => (
                <a key={exit.href} href={withBase(exit.href)} className="link inline-flex min-h-[36px] items-center text-brand-deep">
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
