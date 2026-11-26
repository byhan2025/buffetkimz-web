import { useMemo, useState } from "react";
import {
  LENS_META,
  LENS_ROWS,
  lensCross,
  lensKrw,
  lensWon,
  type LensPeriod,
  type LensRow,
} from "@/data/money-lens";
import { withBase } from "@/config/site";

/**
 * 1단계 — 3중 환산 시세판 (spec §4).
 *
 * 2026-11-26 UX 전면 개편 (대표님 피드백: "1단계 구성이 이해가 안 돼. 뭘 보라는 건지 모르겠어")
 *   ① 맨 위에 **오늘 1억의 세 가지 모습**을 고정으로 둔다 — 원화 1억 = 약 74,493달러 = 금 566.6g(약 151돈).
 *      탭을 누르지 않아도 "무엇을 비교하는 화면인지"가 첫 줄에서 보인다.
 *   ② 기본 탭은 `10년 전 1억` — 들어오자마자 원화 +42.9% / 금 −62.5%의 낙차가 보인다.
 *   ③ `오늘` 탭은 생지수 나열이 아니라 **오늘의 단가와 1억 기준 환산**을 보여 준다(103.64·120.73은 보조 설명).
 *   ④ 값이 계산되지 않는 지수 4종(코스피·삼성전자·S&P500·나스닥) 행은 보드에서 뺐다.
 *      그 숫자들은 보드 아래 「오늘의 주요 시장 시세」(LensMarket.astro, today.ts 연동)가 맡는다.
 *
 * 값은 전부 `src/data/money-lens.ts`에서 온다. 화면에서 새 숫자를 만들지 않는다.
 */

const TAB_LABEL: Record<LensPeriod, { short: string; long: string }> = {
  now: { short: "오늘", long: "오늘의 단가" },
  y5: { short: "5년 전 1억", long: "5년 전 1억이 지금" },
  y10: { short: "10년 전 1억", long: "10년 전 1억이 지금" },
};

/** 보드에 그리는 행 — 값이 실제로 계산되는 자산만. `linked`(지수 4종)는 시장 시세 섹션이 맡는다. */
const BOARD_ROWS = LENS_ROWS.filter((row) => row.license !== "linked");

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;

function won(amount: number): string {
  const rounded = Math.round(amount / 10000) * 10000;
  const eok = Math.floor(rounded / 100000000);
  const man = Math.round((rounded % 100000000) / 10000);
  if (eok > 0) return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만` : `${eok}억`;
  return `${man.toLocaleString("ko-KR")}만`;
}

const level = (row: LensRow, period: LensPeriod): string => {
  const value = row.value?.[period];
  if (value === undefined) return "—";
  if (row.unit === "원") return won(value).concat("원");
  if (row.unit === "원/g") return `${Math.round(value).toLocaleString("ko-KR")}원`;
  if (row.unit === "원/달러") return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
  return value.toFixed(row.decimals);
};

const toneClass = (v: number) => (v > 0.0005 ? "text-clay" : v < -0.0005 ? "text-sky-deep" : "text-ink-faint");

/** 오늘 1억이 달러·금으로 몇인지 — 데이터(META)에서만 계산한다. */
const ANCHOR = (() => {
  const usd = 100000000 / LENS_META.fx.now;
  const grams = 100000000 / LENS_META.goldKrwPerG.now;
  return {
    usd: Math.round(usd).toLocaleString("ko-KR"),
    grams: grams.toFixed(1),
    don: Math.round(grams / 3.75),
    fxLabel: `${LENS_META.fx.now.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`,
    goldPerGram: `${Math.round(LENS_META.goldKrwPerG.now).toLocaleString("ko-KR")}원`,
  };
})();

/**
 * `오늘` 탭의 세 번째 열 — 1억을 그 자산에 넣었을 때 오늘 무엇이 되는가.
 * 지수가 아닌 실제 값만 만들 수 있으므로, 만들 수 없는 칸은 이유를 적는다.
 */
function oneEok(row: LensRow): string {
  switch (row.id) {
    case "krw-deposit":
      return `1년 뒤 1억 ${Math.round((LENS_META.deposit.nowRate / 100) * 100000000 / 10000).toLocaleString("ko-KR")}만 원(세전)`;
    case "usd":
      return `약 ${ANCHOR.usd}달러`;
    case "gold":
      return `${ANCHOR.grams}g · 약 ${ANCHOR.don}돈`;
    case "cpi":
      return `2020년 1억이 오늘 ${won((100000000 * 100) / LENS_META.cpi.now)} 원어치`;
    default:
      return "지수라 1억 환산이 없습니다";
  }
}

export default function LensBoard() {
  const [period, setPeriod] = useState<LensPeriod>("y10");

  const rows = useMemo(
    () =>
      BOARD_ROWS.map((row) => ({
        row,
        cross: lensCross(row, period),
        krw: lensKrw(row, period),
      })),
    [period]
  );

  const timeMachine = useMemo(() => {
    if (period === "now") return [];
    return ["seoul-apt", "krw-deposit", "usd", "gold"]
      .map((id) => rows.find((r) => r.row.id === id))
      .filter((r): r is (typeof rows)[number] => Boolean(r) && r!.krw !== null)
      .map((r) => ({ name: r.row.name, amount: lensWon(r.krw as number) }));
  }, [rows, period]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6" data-lens-board>
      {/* ① 고정 스트립 — 오늘 1억의 세 가지 모습 */}
      <div data-lens-anchor>
        <p className="text-[12px] font-semibold text-ink-faint">오늘 1억 원의 세 가지 모습</p>
        <ul className="mt-1.5 grid gap-2 sm:grid-cols-3" aria-label="오늘 1억 원을 원화·달러·금으로 본 값">
          <li className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
            <p className="text-[12px] text-ink-muted">원화로</p>
            <p className="mt-0.5 text-[19px] font-bold tabular-nums tracking-[-0.02em] text-ink">1억 원</p>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">그대로 1억</p>
          </li>
          <li className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
            <p className="text-[12px] text-ink-muted">달러로</p>
            <p className="mt-0.5 text-[19px] font-bold tabular-nums tracking-[-0.02em] text-ink">
              약 {ANCHOR.usd}달러
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">{ANCHOR.fxLabel}/달러</p>
          </li>
          <li className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
            <p className="text-[12px] text-ink-muted">금으로</p>
            <p className="mt-0.5 text-[19px] font-bold tabular-nums tracking-[-0.02em] text-ink">
              {ANCHOR.grams}g
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">
              약 {ANCHOR.don}돈 · g당 {ANCHOR.goldPerGram}
            </p>
          </li>
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="기준 시점">
          {(Object.keys(TAB_LABEL) as LensPeriod[]).map((key) => {
            const active = key === period;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setPeriod(key)}
                className={
                  "min-h-[44px] rounded-full px-4 text-[13px] font-semibold transition-colors motion-reduce:transition-none " +
                  (active
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                }
              >
                {TAB_LABEL[key].short}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          지표 기준일 {LENS_META.asOfLabel} 값마다 기준일이 다릅니다
        </p>
      </div>

      {period !== "now" && timeMachine.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4" aria-label={`${TAB_LABEL[period].long}`}>
          {timeMachine.map((t) => (
            <li key={t.name} className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
              <p className="text-[12px] leading-snug text-ink-muted">{t.name}</p>
              <p className="mt-1 text-[17px] font-bold tabular-nums tracking-[-0.02em] text-ink">
                {won(t.amount)}
                <span className="ml-0.5 text-[12px] font-semibold text-ink-faint">원</span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">1억이 이만큼</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4" role="region" aria-label={`${TAB_LABEL[period].long} 표`} aria-live="polite">
        {period === "now" ? (
          <>
            <table className="table-stack w-full border-collapse text-[13px]">
              <caption className="sr-only">오늘의 단가 — 자산별 오늘 값과 1억 기준 환산, 기준일, 출처</caption>
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-faint">
                  <th scope="col" className="py-2 pr-2 font-semibold">자산</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">오늘 단가</th>
                  <th scope="col" className="py-2 pr-2 font-semibold">1억 기준</th>
                  <th scope="col" className="py-2 font-semibold">원문</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row }) => (
                  <tr key={row.id} className="border-b border-line-soft last:border-0">
                    <th scope="row" className="py-2.5 pr-2 text-left align-top">
                      <span className="block font-semibold text-ink">{row.name}</span>
                      <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-ink-faint">
                        {row.detail}
                      </span>
                    </th>
                    <td data-label="오늘 단가" className="py-2.5 pr-2 text-right align-top font-semibold tabular-nums text-ink">
                      {row.value ? level(row, "now") : "—"}
                    </td>
                    <td data-label="1억 기준" className="py-2.5 pr-2 align-top text-[12.5px] leading-relaxed text-ink-soft">
                      {oneEok(row)}
                    </td>
                    <td data-label="원문" className="py-2.5 align-top text-[12px]">
                      <a
                        href={withBase(row.basis.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex min-h-[44px] items-center text-brand-deep md:min-h-[24px]"
                      >
                        {row.basis.sourceLabel}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              서울 아파트 103.64와 소비자물가 120.73은 가격이 아니라 크기를 재는 지수입니다(아파트 2026. 06. =
              100, 물가 2020년 = 100). 단가를 세 기준으로 나눠 보려면 위 탭에서 5년·10년 전 1억을 고릅니다.
            </p>
          </>
        ) : (
          <table className="table-stack w-full border-collapse text-[13px]">
            <caption className="sr-only">
              {TAB_LABEL[period].long} — 자산별 원화·달러·금·물가 기준 수익률
            </caption>
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint">
                <th scope="col" className="py-2 pr-2 text-left font-semibold">자산</th>
                <th scope="col" className="py-2 pr-2 text-right font-semibold">원화</th>
                <th scope="col" className="py-2 pr-2 text-right font-semibold">달러</th>
                <th scope="col" className="py-2 pr-2 text-right font-semibold">금</th>
                <th scope="col" className="py-2 text-right font-semibold">실질(물가)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, cross }) => {
                if (!cross) {
                  return (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <th scope="row" className="py-3 pr-2 text-left align-top">
                        <span className="block font-semibold text-ink">{row.name}</span>
                        <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-ink-faint">
                          {row.detail}
                        </span>
                      </th>
                      <td data-label="원문" colSpan={4} className="py-3 align-top">
                        <a
                          href={withBase(row.link?.href ?? row.basis.sourceUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-paper px-3 text-[12.5px] font-semibold text-brand-deep"
                        >
                          {row.link?.label ?? "원본에서 보기"}
                          <span className="text-[11.5px] font-normal text-ink-faint">{row.link?.org}</span>
                        </a>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.id} className="border-b border-line-soft last:border-0">
                    <th scope="row" className="py-3 pr-2 text-left align-top">
                      <span className="block font-semibold text-ink">{row.name}</span>
                      <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-ink-faint">
                        {row.detail}
                      </span>
                    </th>
                    {(
                      [
                        ["원화", cross.krw],
                        ["달러", cross.usd],
                        ["금", cross.gold],
                        ["실질(물가)", cross.real],
                      ] as const
                    ).map(([label, value]) => {
                      /* 자기 자신이 기준인 칸(달러 행의 달러, 금 행의 금, 물가 행의 실질)은 0%가 아니라 '기준'이다. */
                      const own =
                        (row.id === "usd" && label === "달러") ||
                        (row.id === "gold" && label === "금") ||
                        (row.id === "cpi" && label === "실질(물가)");
                      return (
                        <td
                          key={label}
                          data-label={label}
                          className="py-3 pr-2 text-right align-top last:pr-0"
                        >
                          <span className="block">
                            <span className={`block font-bold tabular-nums ${toneClass(value)}`}>
                              {own ? "0.0%" : pct(value)}
                              {own && <span className="ml-0.5 text-[11.5px] font-semibold text-ink-faint">기준</span>}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] tabular-nums text-ink-faint">
                              {row.id === "cpi" ? `${(1 + value).toFixed(2)}배` : won(lensWon(value))}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 grid gap-2 border-t border-line-soft pt-3 text-[12px] leading-relaxed text-ink-muted md:grid-cols-2">
        <p>
          원화·달러·금은 서로 다른 질문에 대한 답이고, 어느 하나가 정답이 아닙니다. 달러·금 칸은 같은 기간
          원/달러와 원화 금값이 얼마나 움직였는지로 나눈 값입니다.
        </p>
        <p>
          금 가격은 국제 금 월평균을 그 달 평균 환율로 환산한 계산값입니다. 국내 판매가에는 부가세와 수수료가
          붙어 이 값보다 높습니다. 이 표는 계산과 확인까지만 합니다.
        </p>
      </div>
    </div>
  );
}
