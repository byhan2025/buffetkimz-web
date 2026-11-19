import { calendar } from "./calendar";

/**
 * 홈 도구 허브가 보여 주는 다섯 가지.
 * 네 개는 사이트 안에서 바로 계산하는 도구, 하나는 1~12월 제도 일정을 보는 달력 보드다.
 * 문구는 '무엇을 확인·계산하는가'만 쓴다(추천·가입 유도 문구 없음).
 */
export type HubTool = {
  key: string;
  name: string;
  what: string;
  /** 홈 탐색 카드용 짧은 한 줄 */
  short: string;
  meta: string;
  href: string;
  runHref?: string;
};

export const hubTools: HubTool[] = [
  {
    key: "coverage",
    name: "보장 점검 시뮬레이터",
    what: "가진 5대 담보 금액을 연령대 기준점과 나란히 놓고, 먼저 확인할 항목을 세 개까지 정리합니다.",
    short: "5대 담보 금액을 기준점과 비교해 먼저 볼 항목을 정리합니다.",
    meta: "예시 입력값 · 브라우저에서만 계산",
    href: "/apps/coverage-check",
    runHref: "/apps/coverage-check/run",
  },
  {
    key: "disclosure",
    name: "고지 항목 자가체크",
    what: "최근 3개월·2년·5년 이력을 기간별 질문에 대입해, 확인해 볼 고지 유형과 준비 서류를 정리합니다.",
    short: "3개월·2년·5년 질문에 내 이력이 걸리는지 정리합니다.",
    meta: "판정하지 않음 · 확인 항목만",
    href: "/apps/disclosure-check",
    runHref: "/apps/disclosure-check/run",
  },
  {
    key: "silson",
    name: "실손 세대별 비교기",
    what: "같은 병원비를 4세대와 5세대에 각각 넣어, 내가 내는 돈과 돌려받는 돈이 어떻게 갈리는지 봅니다.",
    short: "같은 병원비로 4세대와 5세대 환급액을 비교합니다.",
    meta: "급여·비급여 구간별 계산",
    href: "/apps/silson-compare",
    runHref: "/apps/silson-compare/run",
  },
  {
    key: "pension",
    name: "연금저축·IRP 세액공제 계산기",
    what: "총급여 구간과 올해 납입액으로 예상 세액공제액과 12월 31일 전에 채울 금액을 계산합니다.",
    short: "올해 세액공제액과 12월 전 채울 금액을 계산합니다.",
    meta: "소득세법 제59조의3 기준",
    href: "/apps/pension-tax",
    runHref: "/apps/pension-tax/run",
  },
  {
    key: "calendar",
    name: "제도 일정 달력",
    what: "연말정산·연금 납입 마감·건보료 정산처럼 날짜를 놓치면 손해가 생기는 절차를 1~12월로 봅니다.",
    short: "놓치면 손해인 기한과 절차를 1~12월로 확인합니다.",
    meta: `일정 ${calendar.length}건 · 월별 분류`,
    href: "/calendar",
  },
];
