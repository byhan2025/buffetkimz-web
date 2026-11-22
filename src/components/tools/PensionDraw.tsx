import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { TAX_CONFIG, manLabel, simulate } from "@/lib/pension-engine.mjs";
import { withBase } from "@/config/site";
import { RunnerShell, StickySummary, formatKrw } from "./ui";

/**
 * 연금 인출·세금 시뮬레이터 (v6.0)
 *
 * 설계서: reports/buffetkimz-web/v60-pension-sim/00-spec-and-design.md
 *   · 입력 4개(나이·사적연금·공적연금·그 밖의 소득) + 선택 1개(잔액) — 계산 버튼 없이 즉시 반영
 *   · 390px 결과 카드 6원칙(결론 한 줄 → 두 방법 세로 2장 → 핵심 숫자 20px+ → 카드 3줄 → 가정 칩 1줄 → 면책 1줄)
 *   · 최적 분산 인출 연수 역산 + 내 결과 5줄 메모 원터치 복사 + 하단 3줄 체크리스트
 *   · 상담·가입 버튼 0개, 다른 도구로 가는 링크 1개(세액공제 계산기)
 *
 * 계산은 `@/lib/pension-engine.mjs` 하나만 쓴다(보고서 원본과 해시 동일). 화면은 상수를 직접 쓰지 않고
 * 엔진이 돌려준 값만 그린다. 입력값은 state에만 있고 저장·전송하지 않는다.
 */

const WON = 10_000; // 화면 입력은 만원 단위, 엔진은 원 단위

type FieldProps = {
  label: string;
  sub?: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** 숫자 입력 오른쪽 단위 표기 */
  guess?: { value: number; label: string };
  formatValue?: (v: number) => string;
};

function Field({ label, sub, unit, value, onChange, min, max, step, guess, formatValue }: FieldProps) {
  const id = useId();
  const [text, setText] = useState(() => value.toLocaleString("ko-KR"));
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;

  /* 슬라이더·다른 버튼으로 값이 바뀌면 숫자 칸도 따라간다 */
  useEffect(() => {
    setText(value.toLocaleString("ko-KR"));
  }, [value]);

  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    const n = digits ? Math.min(Math.max(Number(digits), min), max) : min;
    setText(digits ? Number(digits).toLocaleString("ko-KR") : "");
    onChange(n);
  };

  return (
    <div className="border-t border-line-soft py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {label}
          </label>
          {sub && <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-faint">{sub}</p>}
        </div>
        <output htmlFor={id} className="shrink-0 text-[20px] font-bold tabular-nums tracking-[-0.02em] text-brand">
          {formatValue ? formatValue(value) : `${value.toLocaleString("ko-KR")}${unit}`}
        </output>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range min-w-0 flex-1"
          style={{ "--pct": `${pct}%` } as CSSProperties}
        />
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${label} 직접 입력`}
          value={text}
          onChange={(e) => commit(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-[92px] shrink-0 rounded-[10px] border border-line bg-white px-2.5 text-right text-[16px] tabular-nums text-ink"
        />
        <span className="shrink-0 text-[14px] text-ink-faint">{unit}</span>
      </div>

      {guess && (
        <button
          type="button"
          onClick={() => onChange(guess.value)}
          className="mt-1 min-h-[44px] rounded-[10px] border border-dashed border-line bg-white px-3 text-[14px] text-ink-soft"
        >
          {guess.label}
        </button>
      )}
    </div>
  );
}

function Card({
  title,
  num,
  line,
  sub,
  tone = "plain",
}: {
  title: string;
  num: string;
  line: string;
  sub?: string;
  tone?: "plain" | "amber";
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (tone === "amber" ? "border-[#f0dfc1] bg-[#fbf3e4]" : "border-line bg-white")
      }
    >
      <h3 className="text-[17px] font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <p
        className={
          "mt-1 text-[22px] font-extrabold tracking-[-0.03em] tabular-nums " +
          (tone === "amber" ? "text-[#8a5a12]" : "text-ink")
        }
      >
        {num}
      </p>
      <p className="mt-1 text-[16px] leading-[1.6] text-ink-soft">{line}</p>
      {sub && <p className="mt-1 text-[14px] leading-[1.55] text-ink-faint">{sub}</p>}
    </div>
  );
}

export default function PensionDraw({ compact = false }: { compact?: boolean }) {
  const [age, setAge] = useState(65);
  const [priv, setPriv] = useState(1800); // 만원
  const [pub, setPub] = useState(720); // 만원
  const [hasOther, setHasOther] = useState(false);
  const [other, setOther] = useState(3000); // 만원
  const [balance, setBalance] = useState(15000); // 만원, 0이면 분산 카드 숨김
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  /** 예시 값 그대로인지 — 결론 카드의 '예시 값 기준 / 내 조건 기준' 칩 */
  const [touched, setTouched] = useState(false);

  /** 값을 한 번이라도 만지면 '내 조건'으로 바꾼다 */
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      setTouched(true);
      set(v);
    };

  const out = useMemo(
    () =>
      simulate({
        startAge: Math.min(90, Math.max(55, age)),
        privatePension: priv * WON,
        publicPension: pub * WON,
        otherIncome: hasOther ? other * WON : 0,
        totalBalance: balance * WON,
      }),
    [age, priv, pub, hasOther, other, balance]
  );

  const winner = out.routes.options.find((o) => o.key === out.routes.winner) ?? out.routes.options[0];
  const runnerUp = out.routes.options.find((o) => o.key !== out.routes.winner) ?? out.routes.options[1];
  const spread = out.optimal;
  const chipLine = [
    `기준일 ${TAX_CONFIG.checkedOn}`,
    "법령 2026. 7. 1. 시행",
    "공적연금은 기준 제외",
    "지방소득세 포함",
    "본인 1인 기준",
  ];

  async function copyMemo() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(out.memo.text);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2600);
  }

  return (
    <RunnerShell
      title="연금 인출·세금 계산"
      subtitle="사적연금을 한 해 얼마씩 받으면 세금이 어떻게 갈리는지 계산합니다."
      example="나이 65세 · 사적연금 연 1,800만원 · 국민연금 연 720만원으로 시작합니다. 값을 움직이면 결과가 바로 바뀝니다."
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-5" data-pdraw>
        {/* ── 입력 ─────────────────────────────────────────────── */}
        <div>
          <div className="rounded-xl border border-line bg-white p-4">
            <h3 className="text-[17px] font-bold tracking-[-0.02em] text-ink">내 조건</h3>
            <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-faint" data-pdraw-guide>
              기본 예시 값입니다. 내 값으로 바꿔 보세요 — 움직이는 즉시 계산됩니다(저장 안 됨).
            </p>

            <div className="mt-3">
              <Field
                label="① 수령 시작 나이"
                sub="만 55세 이후부터 받을 수 있습니다"
                unit="세"
                value={age}
                onChange={edit(setAge)}
                min={55}
                max={90}
                step={1}
                formatValue={(v) => `${v}세`}
              />
              <Field
                label="② 연간 사적연금"
                sub="연금저축·IRP에서 받는 연금(퇴직금 재원 제외)"
                unit="만원"
                value={priv}
                onChange={edit(setPriv)}
                min={0}
                max={6000}
                step={50}
                guess={{ value: 1000, label: "잘 모르겠어요 — 연 1,000만원으로 보기" }}
              />
              <Field
                label="③ 국민연금 등 공적연금"
                sub="1,500만원 기준에는 들어가지 않습니다"
                unit="만원"
                value={pub}
                onChange={edit(setPub)}
                min={0}
                max={3600}
                step={20}
                guess={{ value: 720, label: "잘 모르겠어요 — 연 720만원(월 60만)으로 보기" }}
              />

              <fieldset className="border-t border-line-soft py-3">
                <legend className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  ④ 그 밖의 종합소득
                </legend>
                <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-faint">근로·사업·임대 등</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { key: false, label: "없음" },
                    { key: true, label: "있음" },
                  ].map((o) => {
                    const active = o.key === hasOther;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setTouched(true);
                          setHasOther(o.key);
                        }}
                        className={
                          "min-h-[44px] rounded-full px-4 text-[14px] font-semibold transition-colors " +
                          (active
                            ? "bg-brand text-white"
                            : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                        }
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {hasOther && (
                  <div className="mt-1">
                    <Field
                      label="연간 그 밖의 소득"
                      unit="만원"
                      value={other}
                      onChange={edit(setOther)}
                      min={0}
                      max={20000}
                      step={100}
                      guess={{ value: 3000, label: "잘 모르겠어요 — 연 3,000만원으로 보기" }}
                    />
                  </div>
                )}
              </fieldset>
            </div>
          </div>

          {/* 연금 잔액 — 선택. 기본은 접어 두고, 필요한 사람만 펼쳐 5번째 값을 넣는다 */}
          <details className="group mt-3 rounded-xl border border-line bg-white" data-pdraw-balance>
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink-soft">
                더 정확히 보기 — 연금 잔액 넣기{" "}
                <span className="text-[14px] font-medium text-ink-faint">(선택)</span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[13px] text-ink-faint transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="border-t border-line-soft px-4 pb-4 pt-3">
              <p className="text-[14px] leading-[1.5] text-ink-faint">
                넣으면 연 1,500만원을 넘지 않는 분산 인출 연수를 계산합니다.
              </p>
              <div className="mt-2">
                <Field
                  label="적격 사적연금 잔액"
                  unit="만원"
                  value={balance}
                  onChange={edit(setBalance)}
                  min={0}
                  max={100000}
                  step={500}
                  guess={{ value: 0, label: "잔액 비우기 — 분산 계산 끄기" }}
                />
              </div>
              <p className="mt-1 text-[14px] leading-[1.5] text-ink-faint">
                잔액 <strong className="font-semibold text-brand">{manLabel(balance * WON)}원</strong> · 운용수익은
                반영하지 않습니다.
              </p>
            </div>
          </details>
        </div>

        {/* ── 결과 ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* ① 결론 한 줄 */}
          <div className="rounded-2xl bg-brand p-4 text-white">
            <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-white/80">
              결론
              <span
                className="rounded-full bg-white/15 px-2 py-0.5 text-[12px] font-bold leading-[1.4] text-white"
                data-pdraw-basis
                aria-live="polite"
              >
                {touched ? "내 조건 기준" : "예시 값 기준"}
              </span>
            </p>
            <p className="mt-1 text-[19px] font-bold leading-[1.5] tracking-[-0.02em]" aria-live="polite">
              {out.headline}
            </p>
          </div>

          {/* ② 두 가지 방법 — 세로 2장 스택 */}
          <div className="rounded-xl border border-line bg-mist/60 p-4">
            <h3 className="text-[17px] font-bold tracking-[-0.02em] text-ink">두 가지 방법</h3>
            <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-faint">
              {out.routes.threshold.status === "below"
                ? "연 1,500만원 이하 — 원천징수로 끝내거나, 종합소득에 합산"
                : "연 1,500만원 초과 — 종합과세와 16.5% 분리과세 중 선택"}
            </p>
            <div className="mt-3 space-y-2">
              {[winner, runnerUp].filter(Boolean).map((o, i) => {
                const best = o.key === out.routes.winner;
                return (
                  <div key={o.key}>
                    {i > 0 && (
                      <p className="py-1 text-center text-[14px] text-ink-faint" aria-hidden="true">
                        vs
                      </p>
                    )}
                    <div
                      className={
                        "rounded-[14px] border bg-white p-3.5 " +
                        (best ? "border-brand ring-1 ring-brand" : "border-line")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] font-semibold text-ink-soft">{o.label}</p>
                        {best && (
                          <span className="shrink-0 rounded-full bg-jade-soft px-2.5 py-1 text-[14px] font-bold text-brand">
                            유리
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">
                        {formatKrw(o.tax)}
                      </p>
                      <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-faint">{o.basis}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ③ 1,500만원 경계 */}
          <Card
            title="1,500만원을 넘으면"
            num={out.cliff.delta > 0 ? `+${manLabel(out.cliff.delta)}원` : "0원"}
            line={out.cliff.note}
          />

          {/* ④ 나눠 받으면 — 잔액이 있을 때만 */}
          {spread && balance > 0 && (
            <Card
              title="나눠 받으면"
              num={
                spread.feasible
                  ? `최소 ${spread.minYears}년 · ${manLabel(spread.spread.tax)}원`
                  : "40년으로도 기준 초과"
              }
              line={
                spread.feasible
                  ? `연 ${manLabel(spread.perYearLimit)}원씩 나누면 세금 합계 ${manLabel(spread.spread.tax)}원입니다.`
                  : spread.note
              }
              sub={
                spread.feasible
                  ? `한 해에 받으면 ${manLabel(spread.concentrated.tax)}원(${spread.concentrated.routeLabel}) — ${manLabel(spread.saving)}원 차이`
                  : "수령 개시를 늦추거나 연금 외 재원을 함께 봐야 합니다."
              }
            />
          )}

          {/* ⑤ 건강보험 — 계산하지 않고 '확인'만 */}
          <Card
            title="건강보험"
            num={out.health.over ? "2,000만원 초과" : `여유 ${manLabel(out.health.remaining)}원`}
            line={out.health.note}
            sub={out.health.privatePensionNote}
            tone="amber"
          />

          {/* ⑥ 메모 복사 + 다른 도구 1개 */}
          <div className="rounded-xl border border-line bg-white p-4">
            <button
              type="button"
              onClick={copyMemo}
              className="min-h-[48px] w-full rounded-xl border border-brand bg-white text-[16px] font-bold text-brand"
            >
              {copyState === "done"
                ? "복사했습니다"
                : copyState === "failed"
                  ? "아래 5줄을 길게 눌러 복사하세요"
                  : "내 결과 5줄 복사"}
            </button>

            {copyState !== "idle" && (
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-mist p-3 text-[14px] leading-[1.6] text-ink-soft">
                {out.memo.text}
              </pre>
            )}

            <p className="mt-3">
              <a
                href={withBase("/apps/pension-tax/run")}
                className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-brand underline decoration-brand/35 underline-offset-4"
              >
                세액공제 계산기로 이어가기 →
              </a>
            </p>
          </div>

          {/* ⑤ 가정 칩 1줄 */}
          <ul className="flex flex-wrap gap-1.5" aria-label="계산 기준과 가정">
            {chipLine.map((t) => (
              <li
                key={t}
                className="rounded-full border border-line bg-mist px-2.5 py-1.5 text-[14px] leading-[1.4] text-ink-soft"
              >
                {t}
              </li>
            ))}
          </ul>

          {/* ⑥ 면책 1줄 */}
          <p className="text-[14px] leading-[1.6] text-ink-faint">참고용 추정이며 세무 상담이 아닙니다.</p>

          {!compact && (
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-[17px] font-bold tracking-[-0.02em] text-ink">결과를 읽기 전에 확인 3줄</h3>
              <ul className="mt-2 space-y-1.5">
                {[
                  "사적연금 수령액에 퇴직금 재원이 섞여 있지 않은가요? 그 몫은 1,500만원 계산에서 빠집니다.",
                  "연금수령한도(평가액 ÷ (11 − 연금수령연차) × 120%) 안에서 받고 있나요?",
                  "연 1,500만원을 넘을 때는 그 밖의 소득 금액을 넣어야 비교가 맞습니다.",
                ].map((q) => (
                  <li key={q}>
                    <label className="flex min-h-[44px] cursor-pointer items-start gap-2 py-1.5 text-[15px] leading-[1.55] text-ink-soft">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#1a4ffd]" />
                      <span>{q}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <StickySummary
        items={[
          { label: "유리한 쪽", value: `${winner.label.replace("로 종결", "")} ${manLabel(winner.tax)}원` },
          { label: "비교", value: `${runnerUp.label.replace("로 종결", "")} ${manLabel(runnerUp.tax)}원` },
        ]}
        note={`${TAX_CONFIG.checkedOn} 기준 · 참고용 추정`}
      />
    </RunnerShell>
  );
}
