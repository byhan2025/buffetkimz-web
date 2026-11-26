/**
 * 「돈의 나이테」 3층 진단의 유형 정의 — 2026-11-26 분리.
 *
 * 같은 문구·같은 판정 트리를 **두 곳**이 쓴다.
 *  · `/apps/money-ring/run` — 전체 진단기 (`components/tools/MoneyRing.tsx`)
 *  · `/money-lens/` — 페이지 안 즉석 진단 (`components/money-lens/LensDiagnose.tsx`)
 * 두 화면의 결과가 갈라지지 않도록 판정과 문구는 이 파일 하나만 고친다.
 *
 * 규칙
 *  · 점수·신호등을 만들지 않는다. 유형 이름 하나와 "확인할 것 1개"만 남긴다.
 *  · 링크는 논리 경로("/apps/…")로 두고, 그릴 때 `withBase()`를 쓴다.
 */

export type Kind = "thin" | "sleepy" | "krw-only" | "growth-only" | "house" | "balanced";

export type Ctx = {
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

export const KIND: Record<
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
    check: (c) =>
      `월 필수 지출 ${c.monthly.toLocaleString("ko-KR")}만 원 × ${c.buffer}개월 = ${Math.round(c.eMan).toLocaleString("ko-KR")}만 원이 어디에 있는지`,
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
      `자산의 ${Math.round(c.krwShare * 100)}%가 원화입니다. 원화로 보면 늘었는데 달러·금으로 보면 줄어드는 구간이 있었는지, 위 계기판에서 바로 확인할 수 있습니다.`,
    check: () => "지난 10년간 원화 자산의 달러 환산 수익률",
    action: "지난 10년 내 원화 자산의 달러 환산 수익률을 계기판에서 확인",
    tool: { label: "계기판 10년 보기", href: "/money-lens/" },
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

export type JudgeInput = {
  /** 소득이 끊겼을 때 버티는 개월 */
  runOut: number;
  /** 잠자는 돈(예금 − 비상금)이 몇 개월치인지 */
  sleepMonths: number;
  /** 진짜 돈 비중 */
  tShare: number;
  /** 원화 노출 비중(외화·금 제외) */
  krwShare: number;
  /** 일하는 돈 비중 */
  wShare: number;
  /** 거주 주택이 총자산에서 차지하는 비중 */
  houseShare: number;
};

/**
 * 판정 트리 — 위에서부터 먼저 맞는 하나. 여섯 유형 모두 도달 가능해야 한다
 * (`scripts/verify_lens.py` L6이 테스트 벡터 6개로 확인한다).
 */
export function moneyRingJudge(input: JudgeInput): Kind {
  const { runOut, sleepMonths, tShare, krwShare, wShare, houseShare } = input;
  if (runOut < 3) return "thin";
  if (sleepMonths >= 12) return "sleepy";
  if (tShare < 0.1 && krwShare >= 0.8) return "krw-only";
  if (wShare >= 0.8 && runOut < 6) return "growth-only";
  if (houseShare >= 0.7) return "house";
  return "balanced";
}
