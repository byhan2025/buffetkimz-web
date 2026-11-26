import { useMemo, useState } from "react";
import {
  LENS_GAUGES,
  LENS_META,
  LENS_ROWS,
  type LensGauge,
  type LensGaugeSet,
  type LensPeriod,
  type LensUnit,
} from "@/data/money-lens";
import { withBase } from "@/config/site";

/**
 * 「돈의 나이테」 위치 계기판 — 2026-11-26 전면 개편 (대표님 지시).
 *
 * 읽는 순서를 네 단계 교과서에서 **한 장의 계기판**으로 바꿨다.
 *   ① 탭을 누르지 않아도 첫 카드에서 "서울 아파트는 원화로는 고점, 금으로는 저점"이 보인다.
 *   ② 카드마다 세 줄(원화·달러·금)이 있고, 줄마다 그 기간 최저~최고 사이 현재 위치를 막대로 그린다.
 *   ③ 막대 오른쪽에 단계 이름(고점권·중상단·중간·중하단·저점권)과 그 단위의 수익률이 붙는다.
 *   ④ 기본 탭은 `10년` — 들어오자마자 10년 범위의 위치가 보인다. `5년`은 창만 60개월로 줄인다.
 *
 * 값은 전부 `src/data/money-lens.ts`(+ `money-lens-tracks.ts`)에서 온다.
 * 화면에서 새 숫자를 만들지 않는다. 게이지의 최소·최대는 120개월 실측값에서만 나온다.
 */

const TAB_LABEL: Record<LensPeriod, string> = {
  y10: "10년",
  y5: "5년",
  now: "오늘",
};

const UNIT_LABEL: Record<LensUnit, string> = { krw: "원화", usd: "달러", gold: "금" };
const UNITS: LensUnit[] = ["krw", "usd", "gold"];

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;

function won(amount: number): string {
  const rounded = Math.round(amount / 10000) * 10000;
  const eok = Math.floor(rounded / 100000000);
  const man = Math.round((rounded % 100000000) / 10000);
  if (eok > 0) return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만` : `${eok}억`;
  return `${man.toLocaleString("ko-KR")}만`;
}

const level = (id: string, value: number): string => {
  if (id === "krw-deposit") return `${won(value)}원`;
  if (id === "gold") return `${Math.round(value).toLocaleString("ko-KR")}원`;
  if (id === "usd") return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
  return value.toFixed(2);
};

/** 오늘 1억이 달러·금으로 몇인지 — 데이터(META)에서만 계산한다. */
const ANCHOR = (() => {
  const usd = 100000000 / LENS_META.fx.now;
  const grams = 100000000 / LENS_META.goldKrwPerG.now;
  return {
    usd: Math.round(usd).toLocaleString("ko-KR"),
    grams: grams.toFixed(1),
    don: Math.round(grams / 3.75),
  };
})();

/** `오늘` 탭 — 1억을 그 자산에 넣었을 때 오늘 무엇이 되는가 */
function oneEok(id: string): string {
  switch (id) {
    case "krw-deposit":
      return `1년 뒤 1억 ${Math.round(((LENS_META.deposit.nowRate / 100) * 100000000) / 10000).toLocaleString("ko-KR")}만 원(세전)`;
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

/** 막대 하나 — 왼쪽 끝이 기간 최저, 오른쪽 끝이 최고, 세로선이 현재 */
function GaugeBar({ gauge }: { gauge: LensGauge }) {
  const pos = Math.max(0, Math.min(100, gauge.position));
  /* 자기 자신이 기준인 줄(달러 자산의 달러, 금 자산의 금)은 잴 것이 없다 — 점선 한 줄로 둔다. */
  if (gauge.self) {
    return (
      <span
        className="block h-[9px] rounded-full border-t border-dashed border-line"
        role="img"
        aria-label={`${UNIT_LABEL[gauge.unit]} 기준 그대로`}
      />
    );
  }
  return (
    <span
      className="relative block h-[9px] rounded-full"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--color-jade) 18%, var(--color-paper-deep)) 0%, var(--color-paper-deep) 48%, var(--color-paper-deep) 52%, color-mix(in srgb, var(--color-amber) 20%, var(--color-paper-deep)) 100%)",
      }}
      role="img"
      aria-label={`${UNIT_LABEL[gauge.unit]} 기준 최저~최고 사이 ${Math.round(pos)}% 지점, ${gauge.band}`}
    >
      <span
        className={
          "absolute top-1/2 h-[13px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
        }
        style={{ left: `${pos}%` }}
      />
    </span>
  );
}

function GaugeCard({ set }: { set: LensGaugeSet }) {
  return (
    <article
      className="rounded-2xl border border-line bg-surface p-3"
      data-lens-gauge-card={set.id}
      data-lens-spark={set.id}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h3 className="text-[14px] font-bold tracking-[-0.02em] text-ink">{set.name}</h3>
        <span className="text-[11px] tabular-nums text-ink-faint">{set.unitLabel}</span>
      </header>

      <ul className="mt-2 grid gap-1">
        {UNITS.map((unit) => {
          const g = set.units[unit];
          return (
            <li
              key={unit}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-1.5"
              data-lens-gauge={unit}
            >
              <span className="text-[11px] font-semibold text-ink-muted">{UNIT_LABEL[unit]}</span>
              <GaugeBar gauge={g} />
              <span className="min-w-[88px] text-right text-[11px] tabular-nums leading-tight">
                <span className="font-bold text-ink">{g.band}</span>
                {!g.self && <span className="ml-1 text-ink-muted">{pct(g.ret)}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-1.5 border-t border-line-soft pt-1 text-[10.5px] leading-snug text-ink-faint">
        {set.attribution}
      </p>
    </article>
  );
}

export default function LensBoard() {
  const [period, setPeriod] = useState<LensPeriod>("y10");
  const sets = useMemo(() => (period === "y5" ? LENS_GAUGES.y5 : LENS_GAUGES.y10), [period]);
  const head = sets[0];
  const rows = useMemo(() => LENS_ROWS.filter((r) => r.license !== "linked"), []);

  return (
    <div className="rounded-2xl border border-line bg-paper/60 p-3 md:p-5" data-lens-board>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16.5px] font-bold tracking-[-0.03em] text-ink md:text-[24px]">
          원화 자산 위치 계기판
        </h2>

        <div className="flex shrink-0 gap-1" role="group" aria-label="기간">
          {(Object.keys(TAB_LABEL) as LensPeriod[]).map((key) => {
            const active = key === period;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setPeriod(key)}
                className={
                  "min-h-[40px] rounded-full px-3 text-[12px] font-semibold transition-colors motion-reduce:transition-none " +
                  (active
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                }
              >
                {TAB_LABEL[key]}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">
        {period === "now"
          ? "오늘의 단가와 1억 기준 환산입니다."
          : `${head?.from ?? ""}~${head?.to ?? ""} ${head?.months ?? 120}개월 범위에서 지금 어디에 있는지. 막대 왼쪽 끝이 최저, 오른쪽 끝이 최고입니다.`}
      </p>

      {period === "now" ? (
        <ul className="mt-3 grid gap-2 md:grid-cols-2" data-lens-now-list>
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-line bg-surface px-3 py-2.5"
              data-lens-now={row.id}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold text-ink">{row.name}</span>
                <span className="text-[13px] font-bold tabular-nums text-ink">
                  {row.value ? level(row.id, row.value.now) : "—"}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">{oneEok(row.id)}</p>
              <p className="mt-1 text-[11px] leading-snug text-ink-faint">
                {row.detail} ·{" "}
                <a
                  href={withBase(row.basis.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link text-brand-deep"
                >
                  {row.basis.sourceLabel}
                </a>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-3 grid gap-2 md:grid-cols-2" aria-label="자산별 위치 계기판">
            {sets.map((set) => (
              <li key={set.id}>
                <GaugeCard set={set} />
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[10.5px] leading-snug text-ink-faint" data-lens-gauge-note>
            막대는 월별 값의 최저~최고를 0~100으로 편 것입니다(환율·금 월평균, 아파트 매매지수 2026. 06. =
            100, 예금 12개월 평균금리 월 복리). 지수(103.64)는 가격이 아니라 크기라 1억 환산은 `오늘` 탭에
            있습니다.
          </p>
        </>
      )}

      <p className="mt-1.5 border-t border-line-soft pt-1.5 text-[10.5px] leading-snug text-ink-muted">
        원화·달러·금은 서로 다른 질문의 답입니다. 한 자산이 원화로는 고점, 금으로는 저점일 수 있습니다. 금값은
        국제 금 월평균 × 그 달 평균 환율(부가세·수수료 제외)입니다. 지표 확인 {LENS_META.asOfLabel}
      </p>
    </div>
  );
}
