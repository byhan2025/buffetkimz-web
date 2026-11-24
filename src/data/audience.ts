/**
 * 상황별 맞춤 추천 — 2026-11-25 깃밥 벤치마킹 1항.
 *
 * 홈 첫 화면 아래에서 방문자가 자기 상황을 한 번 누르면, 그 상황에 맞는 계산기와 글이 바뀐다.
 *  · 고르는 값은 셋뿐이다(사회초년생 · 직장인·가장 · 은퇴준비). 고른 값은 `localStorage`에 남는다.
 *  · 추천은 손으로 고른 목록이지만, **없는 글·없는 도구를 가리키면 빌드가 선다**
 *    (`AudiencePick.astro`가 `hubTools`·발행 글과 대조한다). 가는 곳 없는 칸을 만들지 않는다.
 *  · 문구는 '무엇을 확인하는지'만 쓴다. 가입·상품 권유 문장은 두지 않는다.
 */

export const AUDIENCE_IDS = ["starter", "worker", "retiree"] as const;
export type AudienceId = (typeof AUDIENCE_IDS)[number];

export type Audience = {
  id: AudienceId;
  /** 화면의 선택 칩 글자 */
  label: string;
  /** 이 상황에서 먼저 확인하는 것 — 한 문장 */
  summary: string;
  /** `data/tools.ts`의 key — 순서대로 최대 3개 */
  tools: string[];
  /** 발행된 글 slug — 순서대로 최대 3개 */
  posts: string[];
};

export const AUDIENCES: Audience[] = [
  {
    id: "starter",
    label: "사회초년생",
    summary: "첫 월급에서 계좌와 순서를 먼저 정합니다. 비상금, 연금계좌, 적립 규칙 순서로 확인합니다.",
    tools: ["pension", "compound-return", "silson"],
    posts: ["finance-emergency-fund-3-6", "pension-tax-order", "invest-dca-rule"],
  },
  {
    id: "worker",
    label: "직장인·가장",
    summary: "소득이 늘수록 세금과 보장, 노후의 순서가 중요해집니다. 올해 내 숫자부터 확인합니다.",
    tools: ["pension", "retirement-flow", "coverage"],
    posts: ["finance-financial-income-2000", "economy-fixed-cost-check", "insurance-coverage-conditions"],
  },
  {
    id: "retiree",
    label: "은퇴준비",
    summary: "받는 시점과 인출 순서가 결과를 가릅니다. 월 수령액과 받을 때의 세금을 먼저 계산합니다.",
    tools: ["retirement-flow", "pension-draw", "compound-return"],
    posts: ["retire-pension-timing", "pension-master-05-draw-1500", "retire-fixed-cost"],
  },
];

/** 처음 방문했을 때 서버가 그리는 상황 — 가장 많은 방문자에 맞춘다 */
export const DEFAULT_AUDIENCE: AudienceId = "worker";
