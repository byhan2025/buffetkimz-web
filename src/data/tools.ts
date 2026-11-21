import { calendar } from "./calendar";

/**
 * 홈·/apps 도구 허브가 보여 주는 여덟 가지.
 *
 * v4.0 — 금융·투자·연금 도구 3종과 금융캘린더을 '메인'에 두고,
 * 보험 3종은 '리스크 관리 참고 도구'로 내려 비중을 줄였다.
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
  /** main: 금융·투자·연금·금융 일정 / risk: 리스크 관리(보험) 참고 */
  group: "main" | "risk";
};

export const hubTools: HubTool[] = [
  {
    key: "pension",
    name: "연금저축·IRP 세액공제 계산기",
    what: "총급여 구간과 올해 납입액으로 예상 세액공제액과 12월 31일 전에 채울 금액을 계산합니다.",
    short: "올해 세액공제액과 12월 전 채울 금액을 계산합니다.",
    meta: "소득세법 제59조의3 기준",
    href: "/apps/pension-tax",
    runHref: "/apps/pension-tax/run",
    group: "main",
  },
  {
    key: "retirement-flow",
    name: "은퇴 월 현금흐름 시뮬레이터",
    what: "국민·퇴직·개인연금을 합쳐 은퇴 시점의 월 수령액을 명목과 오늘 가치로 나눠 계산합니다.",
    short: "은퇴 후 매달 쓸 수 있는 돈을 오늘 가치로 계산합니다.",
    meta: "단순 시뮬레이션 · 물가·수익률 가정",
    href: "/apps/retirement-flow",
    runHref: "/apps/retirement-flow/run",
    group: "main",
  },
  {
    key: "compound-return",
    name: "투자 복리·세후 수익률 계산기",
    what: "초기 투자금과 매달 적립액이 투자 기간 뒤 세전·세후 얼마가 되는지 계산합니다.",
    short: "적립식 투자의 세전·세후 평가액을 계산합니다.",
    meta: "월 복리 가정 · 과세 방식 3종",
    href: "/apps/compound-return",
    runHref: "/apps/compound-return/run",
    group: "main",
  },
  {
    key: "pension-draw",
    name: "연금 인출·세금 시뮬레이터",
    what: "연간 사적연금 수령액과 나이로 1,500만원 기준, 종합과세와 15% 분리과세 중 유리한 쪽을 계산합니다.",
    short: "받을 때 세금이 어떻게 갈리는지 계산합니다.",
    meta: "소득세법 제14조③9호·제64조의4 기준",
    href: "/apps/pension-draw",
    runHref: "/apps/pension-draw/run",
    group: "main",
  },
  {
    key: "calendar",
    name: "금융캘린더",
    what: "연말정산·연금 납입 마감·건보료 정산처럼 날짜를 놓치면 손해가 생기는 절차를 1~12월로 봅니다.",
    short: "놓치면 손해인 기한과 절차를 1~12월로 확인합니다.",
    meta: `일정 ${calendar.length}건 · 월별 분류`,
    href: "/calendar",
    group: "main",
  },
  {
    key: "coverage",
    name: "보장 점검 시뮬레이터",
    what: "가진 5대 담보 금액을 연령대 기준점과 나란히 놓고, 먼저 확인할 항목을 세 개까지 정리합니다.",
    short: "5대 담보 금액을 기준점과 비교해 먼저 볼 항목을 정리합니다.",
    meta: "예시 입력값 · 브라우저에서만 계산",
    href: "/apps/coverage-check",
    runHref: "/apps/coverage-check/run",
    group: "risk",
  },
  {
    key: "disclosure",
    name: "고지 항목 자가체크",
    what: "최근 3개월·2년·5년 이력을 기간별 질문에 대입해, 확인해 볼 고지 유형과 준비 서류를 정리합니다.",
    short: "3개월·2년·5년 질문에 내 이력이 걸리는지 정리합니다.",
    meta: "판정하지 않음 · 확인 항목만",
    href: "/apps/disclosure-check",
    runHref: "/apps/disclosure-check/run",
    group: "risk",
  },
  {
    key: "silson",
    name: "실손 세대별 비교기",
    what: "같은 병원비를 4세대와 5세대에 각각 넣어, 내가 내는 돈과 돌려받는 돈이 어떻게 갈리는지 봅니다.",
    short: "같은 병원비로 4세대와 5세대 환급액을 비교합니다.",
    meta: "급여·비급여 구간별 계산",
    href: "/apps/silson-compare",
    runHref: "/apps/silson-compare/run",
    group: "risk",
  },
];

/** 메인 — 금융·투자·연금 계산 4종 + 금융캘린더 1종 */
export const mainTools = hubTools.filter((t) => t.group === "main");
/** 서브 — 리스크 관리(보험) 참고 도구 3종 */
export const riskTools = hubTools.filter((t) => t.group === "risk");

/**
 * 홈 메인 도구 상단 4칸 (요청된 순서: 세액공제 → 은퇴 현금흐름 → 복리 → 달력).
 * v6.0 연금 인출 시뮬레이터는 앱스토어·링크로 먼저 열고, 홈 4칸은 기존 구성을 유지한다
 * (설계서 §10.2 — 홈에 넣으려면 5번째 칸이 필요하다).
 */
export const homeMainTools = mainTools.filter((t) => t.key !== "pension-draw");
