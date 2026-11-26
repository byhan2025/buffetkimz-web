import { useMemo, useState } from "react";
import { LENS_META } from "@/data/money-lens";
import { RunnerShell } from "./ui";

/**
 * 2단계 — 「돈의 나이테」 진단기 (spec §5-1).
 *
 * 3층 모델: 진짜 돈 / 일하는 돈 / 잠자는 돈. 거주 주택은 어느 층에도 넣지 않고 따로 센다.
 * 점수·신호등을 만들지 않는다. 지표 4개와 "확인할 것 1개"만 남긴다.
 *
 * 입력값은 이 브라우저 탭 안에서만 계산한다 — 저장(localStorage·쿠키)·전송 없음.
 * 금액 단위는 만 원.
 */

type Kind = "thin" | "sleepy" | "krw-only" | "growth-only" | "house" | "balanced";

type Ctx = {
  monthly: number;
  buffer: number;
  months: number;
  krwShare: number;
  tShare: number;
  wShare: number;
  sShare: number;
  sMan: number;
  eMan: number;
  houseShare: number;
};

const KIND: Record<
  Kind,
  {
    title: string;
    lead: (c: Ctx) => string;
    check: (c: Ctx) => string;
    action: string;
    tool: { label: string; href: string };
    post: { label: string; href: string };
  }
> = {
  thin: {
    title: "버팀이 얇은 나무",
    lead: (c) =>
      `지금 소득이 끊기면 ${Math.floor(c.months)}개월에서 멈춥니다. 자산이 적어서가 아니라, 3개월치가 현금으로 남아 있지 않아서입니다. 이 상태에서는 값이 싼 순간에 팔아야 하는 일이 생깁니다.`,
    check: (c) => `월 필수 지출 ${c.monthly.toLocaleString("ko-KR")}만 원 × ${c.buffer}개월 = ${Math.round(c.eMan).toLocaleString("ko-KR")}만 원이 어디에 있는지`,
    action: "비상금 3개월치를 '지금 꺼낼 수 있는 통장'으로 모으면 얼마인지 계산",
    tool: { label: "실업급여로 받는 돈 확인", href: "/apps/unemployment-benefit/run" },
    post: { label: "비상금 3개월·6개월 기준", href: "/posts/finance-emergency-fund-3-6" },
  },
  sleepy: {
    title: "자는 돈이 두꺼운 나무",
    lead: (c) =>
      `원화 예금·현금 중 ${Math.round(c.sMan).toLocaleString("ko-KR")}만 원이 비상금(${Math.round(c.eMan).toLocaleString("ko-KR")}만 원)을 넘습니다. 이 돈은 10년 뒤에도 숫자가 같지만, 그때 살 수 있는 것은 지금보다 적습니다. 물가가 연 2.8%면 10년에 약 24%가 조용히 빠집니다.`,
    check: (c) => `이 돈이 몇 년째 같은 통장에 있는지 (${Math.round(c.sMan).toLocaleString("ko-KR")}만 원)`,
    action: "잠자는 예금 1,000만 원을 12개월 예금에 넣으면 세후 이자가 얼마인지",
    tool: { label: "예금·적금 계산기", href: "/apps/compound-return/run" },
    post: { label: "예금자보호 한도 1억 확인", href: "/posts/deposit-protection-limit-100-million-check" },
  },
  "krw-only": {
    title: "한 통화로 자란 나무",
    lead: (c) =>
      `자산의 ${Math.round(c.krwShare * 100)}%가 원화입니다. 원화로 보면 늘었는데 달러·금으로 보면 줄어드는 구간이 있었는지, 위 시세판에서 바로 확인할 수 있습니다.`,
    check: () => "지난 10년간 원화 자산의 달러 환산 수익률",
    action: "지난 10년 내 원화 자산의 달러 환산 수익률을 시세판에서 확인",
    tool: { label: "시세판 10년 전 탭", href: "/money-lens/" },
    post: { label: "환율이 오르면 장바구니", href: "/posts/economy-fx-grocery" },
  },
  "growth-only": {
    title: "성장만 하는 나무",
    lead: (c) =>
      `일하는 돈이 ${Math.round(c.wShare * 100)}%인데 버팀은 ${Math.floor(c.months)}개월입니다. 오르는 동안은 문제가 없지만, 내려갈 때 생활비를 위해 팔면 회복 전에 팔게 됩니다.`,
    check: () => "하락장 6개월을 현금으로 버틸 수 있는 금액",
    action: "하락장 6개월을 현금으로 버티는 금액과, 그 돈이 없을 때 팔아야 하는 자산",
    tool: { label: "생활비 대출 총이자 비교", href: "/apps/loan-repay/run" },
    post: { label: "비상금 3개월·6개월 기준", href: "/posts/finance-emergency-fund-3-6" },
  },
  house: {
    title: "집 한 그루",
    lead: (c) =>
      `총자산의 ${Math.round(c.houseShare * 100)}%가 거주 주택입니다. 살고 있는 집은 값이 올라도 생활비를 만들어 주지 않습니다.`,
    check: () => "집을 팔지 않고 쓸 수 있는 돈의 비중",
    action: "집을 팔지 않고 쓸 수 있는 돈의 비중 계산",
    tool: { label: "전세·월세 기회비용", href: "/apps/rent-jeonse/run" },
    post: { label: "매수·전세 손익분기", href: "/posts/finance-buy-vs-jeonse-breakeven" },
  },
  balanced: {
    title: "고른 나이테",
    lead: (c) =>
      `세 층이 ${Math.round(c.tShare * 100)} : ${Math.round(c.wShare * 100)} : ${Math.round(c.sShare * 100)}로 나뉘고, 버팀은 ${Math.floor(c.months)}개월입니다. 지금 구조에서 확인할 것은 비중이 아니라 순서입니다 — 세금·수수료가 붙는 자리에서 먼저 꺼내는지.`,
    check: () => "인출 순서(연금 → ISA → 일반계좌)",
    action: "인출 순서(연금 → ISA → 일반계좌)에서 세금이 가장 적은 순서 확인",
    tool: { label: "연금 인출 계산기", href: "/apps/pension-draw/run" },
    post: { label: "연금 4계좌 구조", href: "/posts/pension-master-01-four-accounts" },
  },
};

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

    let kind: Kind;
    if (runOut < 3) kind = "thin";
    else if (sleepMonths >= 12) kind = "sleepy";
    else if (tShare < 0.1 && krwShare >= 0.8) kind = "krw-only";
    else if (wShare >= 0.8 && runOut < 6) kind = "growth-only";
    else if (houseShare >= 0.7) kind = "house";
    else kind = "balanced";

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
                  <a href={card.tool.href} className="link inline-flex min-h-[44px] items-center font-semibold text-brand-deep">
                    {card.tool.label}
                  </a>
                  <a href={card.post.href} className="link inline-flex min-h-[44px] items-center text-ink-muted">
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
          <a href="/apps/coverage-check/run" className="link text-brand-deep">
            보장 점검
          </a>{" "}
          <a href="/posts/insurance-coverage-conditions" className="link text-brand-deep">
            보장은 지급 조건으로 확인
          </a>
        </p>
      </div>
    </details>
  );
}
