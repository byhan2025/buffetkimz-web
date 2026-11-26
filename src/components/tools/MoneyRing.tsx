import { useMemo, useState } from "react";
import { LENS_META } from "@/data/money-lens";
import { withBase } from "@/config/site";
import { RunnerShell } from "./ui";
import { KIND, moneyRingJudge, type Ctx, type Kind } from "@/data/money-ring-kinds";

/**
 * 2단계 — 「돈의 나이테」 진단기 (spec §5-1).
 *
 * 3층 모델: 진짜 돈 / 일하는 돈 / 잠자는 돈. 거주 주택은 어느 층에도 넣지 않고 따로 센다.
 * 점수·신호등을 만들지 않는다. 지표 4개와 "확인할 것 1개"만 남긴다.
 *
 * 입력값은 이 브라우저 탭 안에서만 계산한다 — 저장(localStorage·쿠키)·전송 없음.
 * 금액 단위는 만 원.
 *
 * 2026-11-26 — 유형 카드의 도구·글 링크와 번역기 링크는 논리 경로("/apps/…")다.
 * GitHub Pages 서브패스(/buffetkimz-web/)에서 404가 나지 않도록 그릴 때 `withBase()`를 씨운다.
 */

type Inputs = {
  monthly: number;
  krwCash: number;
  fxGold: number;
  stocksPension: number;
  houseLive: number;
  houseInvest: number;
  surrender: number;
  bigSpend: number;
};

const INIT: Inputs = {
  monthly: 250,
  krwCash: 3000,
  fxGold: 0,
  stocksPension: 2000,
  houseLive: 0,
  houseInvest: 0,
  surrender: 0,
  bigSpend: 0,
};

const manLabel = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}만원`;
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function parseMan(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="block py-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value === 0 ? "" : value.toLocaleString("ko-KR")}
          placeholder="0"
          onChange={(e) => onChange(parseMan(e.target.value))}
          className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 text-right text-[15px] font-semibold tabular-nums text-ink"
        />
        <span className="shrink-0 text-[12.5px] text-ink-muted">만원</span>
      </span>
    </label>
  );
}

export default function MoneyRing() {
  const [inp, setInp] = useState<Inputs>(INIT);
  const [buffer, setBuffer] = useState(3);
  const [openOptional, setOpenOptional] = useState(false);

  const set = (key: keyof Inputs) => (v: number) => setInp((prev) => ({ ...prev, [key]: v }));

  const calc = useMemo(() => {
    const M = inp.monthly;
    const E = M * buffer;
    const cash = inp.krwCash;
    const cushion = Math.min(cash, E);
    const T = inp.fxGold + cushion;
    const S = Math.max(0, cash - E) + inp.surrender;
    const W = inp.stocksPension + inp.houseInvest;
    const A = T + W + S;
    const runOut = M > 0 ? (cash + inp.fxGold) / M : Infinity;
    /* 원화 노출 = 외화·금을 뺀 나머지가 총자산에서 차지하는 비중.
       현금만 세면 진짜 돈 조건과 부딪혀 이 유형에 닿을 수 없다(verify:lens L6 벡터로 확인). */
    const krwShare = A > 0 ? (A - inp.fxGold) / A : 0;
    const tShare = A > 0 ? T / A : 0;
    const wShare = A > 0 ? W / A : 0;
    const sShare = A > 0 ? S / A : 0;
    const sleepMonths = M > 0 ? S / M : 0;
    const houseShare = A + inp.houseLive > 0 ? inp.houseLive / (A + inp.houseLive) : 0;

    /* 판정 트리는 `@/data/money-ring-kinds` 하나뿐이다 — /money-lens/ 즉석 진단과 같은 식을 쓴다. */
    const kind: Kind = moneyRingJudge({ runOut, sleepMonths, tShare, krwShare, wShare, houseShare });

    return {
      M,
      E,
      T,
      S,
      W,
      A,
      runOut,
      krwShare,
      tShare,
      wShare,
      sShare,
      sleepMonths,
      houseShare,
      kind,
      empty: A <= 0 || M <= 0,
    };
  }, [inp, buffer]);

  const ctx: Ctx = {
    monthly: calc.M,
    buffer,
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
    <RunnerShell
      title="돈의 나이테 진단"
      subtitle="진짜 돈 · 일하는 돈 · 잠자는 돈 — 다섯 칸이면 결과가 나옵니다."
      example="예시값(월 지출 250만 원 · 예금 3,000만 원 · 주식·연금 2,000만 원)으로 시작합니다. 입력한 값은 이 탭 안에서만 계산되고 저장되지 않습니다."
    >
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <NumberField id="mr-monthly" label="월 필수 지출" hint="생활비·주거비 포함" value={inp.monthly} onChange={set("monthly")} />
        <NumberField id="mr-cash" label="원화 예금·현금" value={inp.krwCash} onChange={set("krwCash")} />
        <NumberField id="mr-fx" label="달러·외화·금" value={inp.fxGold} onChange={set("fxGold")} />
        <NumberField id="mr-stock" label="주식·ETF·연금계좌" value={inp.stocksPension} onChange={set("stocksPension")} />
        <NumberField id="mr-house-live" label="부동산 — 거주용" hint="세 층에 넣지 않습니다" value={inp.houseLive} onChange={set("houseLive")} />
        <NumberField id="mr-house-invest" label="부동산 — 투자용" value={inp.houseInvest} onChange={set("houseInvest")} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-ink">비상금 기준</span>
        {[3, 6].map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={buffer === m}
            onClick={() => setBuffer(m)}
            className={
              "min-h-[44px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors " +
              (buffer === m ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
            }
          >
            {m}개월
          </button>
        ))}
        <button
          type="button"
          aria-expanded={openOptional}
          onClick={() => setOpenOptional((v) => !v)}
          className="link ml-auto inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-brand-deep"
        >
          {openOptional ? "선택 입력 접기" : "선택 입력 2칸 열기"}
        </button>
      </div>

      {openOptional && (
        <div className="grid gap-1 rounded-xl bg-white/60 px-3 md:grid-cols-2 md:gap-x-8">
          <NumberField id="mr-surrender" label="보유 보험의 해약환급금" hint="선택" value={inp.surrender} onChange={set("surrender")} />
          <NumberField id="mr-bigspend" label="3개월 안에 쓸 큰돈" hint="선택" value={inp.bigSpend} onChange={set("bigSpend")} />
        </div>
      )}

      <div className="mt-5 rounded-xl border border-line bg-white p-4" aria-live="polite" data-money-ring-result>
        {calc.empty ? (
          <div data-money-ring-empty>
            <p className="text-[12px] font-semibold text-ink-faint">입력 부족</p>
            <p className="mt-1.5 text-[14px] font-bold leading-relaxed text-ink">
              월 필수 지출과 원화 예금·현금을 채우면 네 지표가 계산됩니다.
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
              비워 둔 칸은 감점이 아닙니다. 모르는 항목은 비워 두고 나머지로만 봅니다.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-ink-faint">
              진단 유형 · 세 층 합계 {manLabel(calc.A)}
            </p>
            <h4 className="mt-1 text-[19px] font-bold tracking-[-0.03em] text-ink">{card.title}</h4>
            <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-soft">{card.lead(ctx)}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
                <p className="text-[11.5px] text-ink-faint">버팀 개월수</p>
                <p className="mt-0.5 text-[19px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">
                  {Number.isFinite(calc.runOut) ? calc.runOut.toFixed(1) : "—"}
                </p>
                <p className="text-[11.5px] text-ink-faint">개월</p>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
                <p className="text-[11.5px] text-ink-faint">진짜 돈 비중</p>
                <p className="mt-0.5 text-[19px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">{pct1(calc.tShare)}</p>
                <p className="text-[11.5px] text-ink-faint">100만 원 중 {Math.round(calc.tShare * 100)}만 원</p>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
                <p className="text-[11.5px] text-ink-faint">일하는 돈 비중</p>
                <p className="mt-0.5 text-[19px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">{pct1(calc.wShare)}</p>
                <p className="text-[11.5px] text-ink-faint">{manLabel(calc.W)}이 일합니다</p>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper px-3 py-2.5">
                <p className="text-[11.5px] text-ink-faint">잠자는 돈</p>
                <p className="mt-0.5 text-[19px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">
                  {calc.sleepMonths.toFixed(1)}
                </p>
                <p className="text-[11.5px] text-ink-faint">개월치 · {manLabel(calc.S)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <div className="rounded-xl bg-paper-deep px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">확인할 것 1개</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{card.check(ctx)}</p>
              </div>
              <div className="rounded-xl border border-line px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">오늘 할 행동 (10분)</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{card.action}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  <a href={withBase(card.tool.href)} className="link inline-flex min-h-[44px] items-center font-semibold text-brand-deep">
                    {card.tool.label}
                  </a>
                  <a href={withBase(card.post.href)} className="link inline-flex min-h-[44px] items-center text-ink-muted">
                    {card.post.label}
                  </a>
                </div>
              </div>
            </div>

            {inp.houseLive > 0 && (
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                거주 주택 {manLabel(inp.houseLive)}은 세 층에 넣지 않았습니다. 팔지 않으면 쓸 수 없는데
                총자산에 넣으면 비중이 왜곡됩니다. 집까지 더한 비중은 {pct1(calc.houseShare)}입니다.
              </p>
            )}
          </>
        )}

        <p className="mt-3 border-t border-line-soft pt-2.5 text-[12px] leading-relaxed text-ink-faint" data-lens-disclaimer="result">
          이 화면은 금융 이해를 돕는 교육·계산 도구입니다. 특정 상품의 추천·권유가 아니며 수익이나 보장을
          약속하지 않습니다. 비중과 순서는 본인의 판단입니다.
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
          상품을 권하지 않습니다. 계산과 확인까지만 합니다.
        </p>
      </div>

      <Translator />
    </RunnerShell>
  );
}

/**
 * 보험금·적금 실질가치 번역기 (spec §5-1-6).
 * 금액은 그대로인데 구매력만 줄어드는 것을 숫자 하나로 보여 준다.
 */
function Translator() {
  const [amount, setAmount] = useState(3000);
  const [years, setYears] = useState<5 | 10>(10);

  const key = years === 5 ? "y5" : "y10";
  const cpi = LENS_META.cpi.now / LENS_META.cpi[key];
  const fx = LENS_META.fx.now / LENS_META.fx[key];
  const gold = LENS_META.goldKrwPerG.now / LENS_META.goldKrwPerG[key];
  const real = amount / cpi;
  const lostPct = (1 - real / amount) * 100;

  return (
    <details className="mt-4 rounded-xl border border-line bg-white open:pb-3">
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center gap-2 px-3 text-[13px] font-semibold text-ink">
        보험금·적금 실질가치 번역기
        <span className="text-[12px] font-normal text-ink-faint">금액은 그대로인데 살 수 있는 것은 줄어듭니다</span>
      </summary>
      <div className="px-3">
        <div className="grid gap-1 md:grid-cols-2 md:gap-x-6">
          <NumberField id="tr-amount" label="금액" value={amount} onChange={setAmount} />
          <div className="py-2">
            <span className="text-[13.5px] font-semibold text-ink">가입 시기</span>
            <div className="mt-1.5 flex gap-1.5">
              {([5, 10] as const).map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={years === y}
                  onClick={() => setYears(y)}
                  className={
                    "min-h-[44px] rounded-full px-3.5 text-[12.5px] font-semibold " +
                    (years === y ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
                  }
                >
                  {y}년 전
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul className="mt-1 space-y-1 rounded-xl bg-paper-deep px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <li>
            {manLabel(amount)} (금액은 그대로) → 오늘 물가로 <b className="text-ink">{manLabel(real)}</b> (
            {lostPct.toFixed(1)}% 하락)
          </li>
          <li>
            오늘 달러로{" "}
            <b className="text-ink">
              {Math.round((amount * 10000) / LENS_META.fx.now).toLocaleString("ko-KR")}달러
            </b>{" "}
            · 가입 당시의 {((1 / fx) * 100).toFixed(1)}%
          </li>
          <li>
            오늘 금으로 가입 당시 살 수 있던 금의 <b className="text-ink">{((1 / gold) * 100).toFixed(1)}%</b>
          </li>
        </ul>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          보장 내용은 약관의 지급 조건으로 확인합니다. 이 계산은 금액의 구매력만 봅니다. ·{" "}
          <a href={withBase("/apps/coverage-check/run")} className="link text-brand-deep">
            보장 점검
          </a>{" "}
          <a href={withBase("/posts/insurance-coverage-conditions")} className="link text-brand-deep">
            보장은 지급 조건으로 확인
          </a>
        </p>
      </div>
    </details>
  );
}
