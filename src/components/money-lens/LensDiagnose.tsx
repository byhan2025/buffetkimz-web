import { useMemo, useState } from "react";
import { LENS_META } from "@/data/money-lens";
import { KIND, moneyRingJudge, type Ctx, type Kind } from "@/data/money-ring-kinds";
import { withBase } from "@/config/site";

/**
 * 「돈의 나이테」 즉석 진단 — 2026-11-26 신설 (대표님 지시).
 *
 * 왜: 예전에는 `/apps/money-ring/run`으로 **화면을 옮겨야** 진단이 됐다. 지금은 `/money-lens/`
 * 안에서 프리셋 한 번(또는 여섯 칸)으로 1초 안에 결과가 나온다.
 *   · 순자산의 원화 / 달러 / 금(g·돈) 즉석 환산
 *   · 진짜 돈 · 일하는 돈 · 잠자는 돈 3층 비율과 유형
 *   · 유형에 맞는 오늘 할 행동 1가지 + 계산기·칼럼 링크(withBase)
 *
 * 판정·문구는 `@/data/money-ring-kinds` 하나를 전체 진단기와 함께 쓴다(결과가 갈라지지 않게).
 * 입력값은 이 브라우저 탭 안에서만 계산한다 — 저장(localStorage·쿠키)·전송 없음.
 * 금액 단위는 만 원.
 */

type Inputs = {
  monthly: number;
  cash: number;
  fxGold: number;
  stocks: number;
  houseLive: number;
  debt: number;
};

const INIT: Inputs = { monthly: 250, cash: 3000, fxGold: 4000, stocks: 23000, houseLive: 0, debt: 0 };

const PRESETS: { id: string; label: string; hint: string; value: Inputs }[] = [
  {
    id: "deposit",
    label: "예금 1억",
    hint: "월 250만 원 지출 · 원화 예금 1억 원",
    value: { monthly: 250, cash: 10000, fxGold: 0, stocks: 0, houseLive: 0, debt: 0 },
  },
  {
    id: "house",
    label: "서울 집 7억 + 대출 3억",
    hint: "월 300만 원 지출 · 예금 1,000만 원",
    value: { monthly: 300, cash: 1000, fxGold: 0, stocks: 0, houseLive: 70000, debt: 30000 },
  },
  {
    id: "office",
    label: "직장인 3억 분산",
    hint: "예금 3,000만 원 · 달러·금 4,000만 원 · 주식·연금 2억 3,000만 원",
    value: { monthly: 250, cash: 3000, fxGold: 4000, stocks: 23000, houseLive: 0, debt: 0 },
  },
];

const manLabel = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}만 원`;

/** 만 원 단위 금액을 억/만으로 읽히게 — 30,000 → '3억 원' */
function wonLabel(man: number): string {
  const won = Math.round(man) * 10000;
  const eok = Math.floor(won / 100000000);
  const rest = Math.round((won % 100000000) / 10000);
  if (eok > 0) return rest > 0 ? `${eok}억 ${rest.toLocaleString("ko-KR")}만 원` : `${eok}억 원`;
  return `${rest.toLocaleString("ko-KR")}만 원`;
}
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function parseMan(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[11.5px] font-semibold text-ink-muted">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value === 0 ? "" : value.toLocaleString("ko-KR")}
          placeholder="0"
          onChange={(e) => onChange(parseMan(e.target.value))}
          className="min-h-[42px] w-full rounded-lg border border-line bg-white px-2.5 text-right text-[14px] font-semibold tabular-nums text-ink"
        />
        <span className="shrink-0 text-[11.5px] text-ink-faint">만</span>
      </span>
    </label>
  );
}

export default function LensDiagnose() {
  const [inp, setInp] = useState<Inputs>(INIT);
  const [picked, setPicked] = useState<string>("office");
  const set = (key: keyof Inputs) => (v: number) => {
    setPicked("");
    setInp((prev) => ({ ...prev, [key]: v }));
  };

  const calc = useMemo(() => {
    const M = inp.monthly;
    const buffer = 3;
    const E = M * buffer;
    /* 대출은 거주 주택에서 먼저 빼고, 남는 금액을 원화 예금에서 뺀다. */
    const houseNet = Math.max(0, inp.houseLive - Math.min(inp.debt, inp.houseLive));
    const cashAdj = Math.max(0, inp.cash - Math.max(0, inp.debt - Math.min(inp.debt, inp.houseLive)));

    const T = inp.fxGold + Math.min(cashAdj, E);
    const S = Math.max(0, cashAdj - E);
    const W = inp.stocks;
    const A = T + W + S;
    const net = A + houseNet;

    const runOut = M > 0 ? (cashAdj + inp.fxGold) / M : Infinity;
    const krwShare = A > 0 ? (A - inp.fxGold) / A : 0;
    const tShare = A > 0 ? T / A : 0;
    const wShare = A > 0 ? W / A : 0;
    const sShare = A > 0 ? S / A : 0;
    const sleepMonths = M > 0 ? S / M : 0;
    const houseShare = net > 0 ? houseNet / net : 0;

    const kind: Kind = moneyRingJudge({ runOut, sleepMonths, tShare, krwShare, wShare, houseShare });

    return {
      M,
      buffer,
      E,
      T,
      S,
      W,
      A,
      net,
      runOut,
      krwShare,
      tShare,
      wShare,
      sShare,
      sleepMonths,
      houseShare,
      kind,
      empty: net <= 0,
      /* 입력 단위는 만 원 — 원으로 환산한 뒤 나눈다. */
      usd: (net * 10000) / LENS_META.fx.now,
      grams: (net * 10000) / LENS_META.goldKrwPerG.now,
    };
  }, [inp]);

  const ctx: Ctx = {
    monthly: calc.M,
    buffer: calc.buffer,
    months: calc.runOut,
    krwShare: calc.krwShare,
    tShare: calc.tShare,
    wShare: calc.wShare,
    sShare: calc.sShare,
    sMan: calc.S,
    eMan: calc.E,
    houseShare: calc.houseShare,
  };
  const card = KIND[calc.kind];

  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 md:p-5" data-lens-diagnose>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="예시로 시작하기">
        {PRESETS.map((preset) => {
          const active = picked === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              title={preset.hint}
              onClick={() => {
                setInp(preset.value);
                setPicked(preset.id);
              }}
              className={
                "min-h-[40px] rounded-full px-3 text-[12px] font-semibold transition-colors motion-reduce:transition-none " +
                (active
                  ? "bg-ink text-paper"
                  : "border border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
              }
            >
              {preset.label}
            </button>
          );
        })}
        <span className="self-center text-[11px] text-ink-faint">누르면 바로 계산됩니다</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
        <NumberField id="ld-monthly" label="월 필수 지출" value={inp.monthly} onChange={set("monthly")} />
        <NumberField id="ld-cash" label="원화 예금·현금" value={inp.cash} onChange={set("cash")} />
        <NumberField id="ld-fx" label="달러·외화·금" value={inp.fxGold} onChange={set("fxGold")} />
        <NumberField id="ld-stocks" label="주식·ETF·연금" value={inp.stocks} onChange={set("stocks")} />
        <NumberField id="ld-house" label="거주 주택(시세)" value={inp.houseLive} onChange={set("houseLive")} />
        <NumberField id="ld-debt" label="대출 잔액" value={inp.debt} onChange={set("debt")} />
      </div>

      <div className="mt-3 rounded-xl border border-line bg-paper px-3 py-3" aria-live="polite" data-lens-diagnose-result>
        {calc.empty ? (
          <p className="text-[13px] font-semibold leading-relaxed text-ink">
            금액을 한 칸이라도 채우면 순자산 환산과 세 층 비율이 바로 나옵니다. 비워 둔 칸은 감점이 아닙니다.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <div>
                <p className="text-[11.5px] font-semibold text-ink-faint">내 순자산</p>
                <p className="text-[21px] font-extrabold leading-tight tabular-nums tracking-[-0.03em] text-ink">
                  {wonLabel(calc.net)}
                </p>
              </div>
              <p className="text-[12.5px] leading-relaxed tabular-nums text-ink-soft">
                <b className="text-ink">약 {Math.round(calc.usd).toLocaleString("ko-KR")}달러</b> · 금{" "}
                <b className="text-ink">
                  {calc.grams.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}g
                </b> (약 {Math.round(calc.grams / 3.75)}돈)
              </p>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
              1달러 {LENS_META.fx.now.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원 · g당{" "}
              {Math.round(LENS_META.goldKrwPerG.now).toLocaleString("ko-KR")}원 기준
              {inp.debt > 0 ? " · 대출은 거주 주택에서 먼저 뺐습니다" : ""}
            </p>

            {/* 3층 비율 바 */}
            <div className="mt-2.5" data-lens-layer>
              <div className="flex h-[14px] overflow-hidden rounded-full border border-line-soft bg-white">
                <span className="block bg-jade" style={{ width: `${calc.tShare * 100}%` }} title="진짜 돈" />
                <span
                  className="block"
                  style={{
                    width: `${calc.wShare * 100}%`,
                    background: "color-mix(in srgb, var(--color-amber) 74%, #fff)",
                  }}
                  title="일하는 돈"
                />
                <span className="block bg-ink/25" style={{ width: `${calc.sShare * 100}%` }} title="잠자는 돈" />
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums text-ink-muted">
                <li>
                  <span className="mr-1 inline-block h-[8px] w-[8px] rounded-full bg-jade" aria-hidden="true" />
                  진짜 돈 <b className="text-ink">{pct1(calc.tShare)}</b>
                </li>
                <li>
                  <span
                    className="mr-1 inline-block h-[8px] w-[8px] rounded-full align-middle"
                    style={{ background: "color-mix(in srgb, var(--color-amber) 74%, #fff)" }}
                    aria-hidden="true"
                  />
                  일하는 돈 <b className="text-ink">{pct1(calc.wShare)}</b>
                </li>
                <li>
                  <span className="mr-1 inline-block h-[8px] w-[8px] rounded-full bg-ink/25" aria-hidden="true" />
                  잠자는 돈 <b className="text-ink">{pct1(calc.sShare)}</b>
                </li>
                <li className="text-ink-faint">버팀 {Number.isFinite(calc.runOut) ? calc.runOut.toFixed(1) : "—"}개월</li>
              </ul>
            </div>

            <div className="mt-2.5 rounded-xl bg-paper-deep px-3 py-2.5">
              <p className="text-[11.5px] font-semibold text-ink-faint">내 유형</p>
              <h3 className="mt-0.5 text-[16px] font-bold tracking-[-0.02em] text-ink">{card.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{card.lead(ctx)}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                <b className="text-ink">오늘 할 행동</b> · {card.action}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0">
                <a
                  href={withBase(card.tool.href)}
                  className="link inline-flex min-h-[44px] items-center text-[12px] font-semibold text-brand-deep"
                >
                  {card.tool.label}
                </a>
                <a
                  href={withBase(card.post.href)}
                  className="link inline-flex min-h-[44px] items-center text-[12px] text-ink-muted"
                >
                  {card.post.label}
                </a>
              </div>
            </div>
          </>
        )}

        <p className="mt-2 border-t border-line-soft pt-2 text-[11px] leading-relaxed text-ink-faint">
          입력한 값은 이 브라우저 탭 안에서만 계산되고 저장·전송되지 않습니다. 거주 주택은 세 층에 넣지 않고
          따로 셉니다(팔지 않으면 쓸 수 없어 비중이 왜곡됩니다). ·
          <a href={withBase("/apps/money-ring/run")} className="link ml-1 text-brand-deep">
            심화 진단·보험금 번역기
          </a>
        </p>
      </div>
    </div>
  );
}
