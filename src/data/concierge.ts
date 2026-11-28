/**
 * 홈 첫 화면 질문형 컨시어지 — 2단계 질문의 데이터 (2026-11-28).
 *
 * 왜 데이터로 두나
 *  · 1단계(생활 고민 네 갈래)와 2단계(그 갈래의 구체 상황)는 **문구만 바뀌는 목록**이다.
 *    화면 코드에 문장을 박으면 계산기·글이 바뀔 때 문구가 따라오지 않는다.
 *  · 그래서 여기에는 **가리키는 대상(앱 slug·글 id)** 만 적고, 이름·요약·출처는 빌드 때
 *    `data/apps.ts`·글 컬렉션에서 읽는다. 없는 대상을 가리키면 `StartHere.astro`가 빌드를 세운다.
 *
 * 지키는 것
 *  · 새 계산기·글을 만들지 않는다. 이미 사이트에 있는 것과 **1:1로만** 잇는다(회의실 인스팅대리 조건).
 *  · 결과는 '추천·처방'이 아니라 **'지금 확인할 것'**이다 — 카드 제목도 그렇게 쓴다.
 *  · 모든 갈래의 마지막 선택지는 **'잘 모르겠어요 — 전체 보기'** 다. 대표 계산기 하나와
 *    분야 글 목록·일정으로 가는 안전한 기본 경로를 두어, 고르지 못한 방문자도 빈손으로 돌려보내지 않는다.
 *  · 갈래마다 '다가오는 일정' 후보를 정해 두고, 지난 뒤에는 달력의 다음 달 항목으로 물러난다
 *    (기한이 지났는데 D-를 계속 보여 주지 않는다).
 */
import { calendar, type CalendarItem } from "./calendar.ts";
import { MILESTONES } from "./year-end-tax.ts";
import { ddayOf, isUpcoming } from "../lib/dday.ts";

export type DueSlotKey = "insurance-premium" | "pension-payment" | "yearend-preview" | "spend-close";

/**
 * 갈래별 '다가오는 일정' 후보 — 모두 실제 기한이 있는 항목이다.
 *  · dated  : 연말정산 지도(MILESTONES)나 달력의 dueDate
 *  · 달력 항목은 id가 없으므로 month + title로 찾는다.
 */
export const DUE_SLOTS: Record<DueSlotKey, { milestoneId?: string; calendarMonth?: number; calendarTitle?: string }> = {
  "insurance-premium": { calendarMonth: 12, calendarTitle: "보장성보험료 공제 한도 마감" },
  "pension-payment": { calendarMonth: 12, calendarTitle: "연금저축·IRP 세액공제 납입 마감" },
  "yearend-preview": { milestoneId: "preview-close" },
  "spend-close": { milestoneId: "spend-close" },
};

export type ConciergeSituation = {
  id: string;
  /** 2단계 선택지 문구 — 생활 언어 한 줄 */
  label: string;
  /** 결과 카드 첫 줄 — 이 선택이 확인하는 질문 */
  question: string;
  /** 앱 slug (실행 화면이 있는 도구만) */
  calc: string;
  /** 계산기 아래 한 줄 */
  calcLine: string;
  /** 가리키는 글 id — 컬렉션에 없으면 빌드가 선다 */
  postId: string;
  kind: "situation";
};

export type ConciergeHub = {
  id: string;
  label: string;
  question: string;
  /** 대표 계산기 하나 + 분야 글 목록 — 고르지 못한 방문자의 기본 경로 */
  hub: { calc: string; calcLine: string; postsHref: string; postsNote: string };
  kind: "hub";
};

export type ConciergeChoice = ConciergeSituation | ConciergeHub;

export type ConciergeBranch = {
  id: string;
  /** 1단계 문구 — 전문용어 대신 생활 고민 */
  label: string;
  /** 1단계 아래 보조 한 줄 (넓은 화면에서만) */
  hint: string;
  /** 4갈래 주요 이동 링크 — 갈래의 분야 페이지(분야별 글 목록)로 바로 간다 */
  href: string;
  due: DueSlotKey;
  /** 다가오는 일정에 붙는 한 줄 (이 갈래에서 그 기한이 왜 중요한지) */
  dueNote: string;
  choices: ConciergeChoice[];
};

export const BRANCHES: ConciergeBranch[] = [
  {
    id: "insurance",
    label: "보험·실손",
    hint: "병원비와 보장이 걸린 일",
    href: "/posts/insurance",
    due: "insurance-premium",
    dueNote: "보장성보험료 공제 한도",
    choices: [
      {
        id: "ins-silson",
        label: "실손, 세대 바꿀까",
        question: "내 실손이 몇 세대이고, 바꾸면 보장과 보험료가 어떻게 달라지나",
        calc: "silson-compare",
        calcLine: "1~5세대 보장과 보험료를 같은 표로",
        postId: "silson-switch-2026",
        kind: "situation",
      },
      {
        id: "ins-cover",
        label: "보장, 청구될까",
        question: "가입금액이 아니라 지급 조건에서 갈리는 지점은 무엇인가",
        calc: "coverage-check",
        calcLine: "담보별 지급 조건으로 내 보장 점검",
        postId: "insurance-coverage-conditions",
        kind: "situation",
      },
      {
        id: "ins-disclose",
        label: "병력·검진 고지",
        question: "계약 전 알릴 의무에서 무엇을 어디까지 적어야 하나",
        calc: "disclosure-check",
        calcLine: "청약서 질문표로 고지할 항목 자가체크",
        postId: "insurance-colon-polyp-pathology",
        kind: "situation",
      },
      {
        id: "ins-hub",
        label: "잘 모르겠어요 — 전체",
        question: "보험·실손에서 먼저 볼 대표 계산기와 글 목록",
        hub: {
          calc: "coverage-check",
          calcLine: "보장 점검 시뮬레이터로 시작",
          postsHref: "/posts/insurance",
          postsNote: "보험 글 전체",
        },
        kind: "hub",
      },
    ],
  },
  {
    id: "pension-tax",
    label: "연금·세금",
    hint: "연말정산과 노후가 걸린 일",
    href: "/posts/pension",
    due: "pension-payment",
    dueNote: "연금저축·IRP 납입 마감",
    choices: [
      {
        id: "pen-credit",
        label: "연금저축 더 넣기",
        question: "올해 납입액으로 받을 세액공제와 12월 31일 전에 채울 금액",
        calc: "pension-tax",
        calcLine: "900만 원 한도와 남은 금액, 예상 공제액",
        postId: "finance-pension-900-credit-check",
        kind: "situation",
      },
      {
        id: "pen-draw",
        label: "연금 받을 때 세금",
        question: "사적연금 1,500만 원 기준에서 종합과세와 분리과세 중 어느 쪽인가",
        calc: "pension-draw",
        calcLine: "수령액·나이로 인출 세금 비교",
        postId: "pension-master-05-draw-1500",
        kind: "situation",
      },
      {
        id: "pen-card",
        label: "카드 12월 전환",
        question: "총급여 25% 문턱을 넘겼을 때 결제수단을 바꾸면 공제가 늘어나나",
        calc: "credit-card-deduction",
        calcLine: "25% 문턱·한도·결제수단 전환 효과",
        postId: "year-end-credit-card-deduction-2026",
        kind: "situation",
      },
      {
        id: "pen-hub",
        label: "잘 모르겠어요 — 전체",
        question: "연금·세금에서 먼저 볼 대표 계산기와 글 목록",
        hub: {
          calc: "pension-tax",
          calcLine: "900만 원 한도와 남은 금액",
          postsHref: "/posts/pension",
          postsNote: "연금 글 전체",
        },
        kind: "hub",
      },
    ],
  },
  {
    id: "salary",
    label: "월급·지출",
    hint: "월급과 고정비가 걸린 일",
    href: "/posts/economy",
    due: "spend-close",
    dueNote: "올해 지출·납입 마감",
    choices: [
      {
        id: "sal-emergency",
        label: "비상금 얼마",
        question: "월 실수령액에서 3~6개월치를 계산하면 얼마인가",
        calc: "salary-net",
        calcLine: "세전 연봉으로 월 실수령액 계산",
        postId: "finance-emergency-fund-3-6",
        kind: "situation",
      },
      {
        id: "sal-health",
        label: "건보료 얼마",
        question: "직장가입자와 지역가입자, 피부양자에서 보험료가 어떻게 갈리나",
        calc: "health-insurance-compare",
        calcLine: "직장 vs 지역 건보료 비교",
        postId: "finance-health-dependent",
        kind: "situation",
      },
      {
        id: "sal-severance",
        label: "퇴직금 세금",
        question: "근속·평균임금으로 계산한 퇴직금과 퇴직소득세는 얼마인가",
        calc: "severance-pay",
        calcLine: "근로기준법 기준 퇴직금 계산",
        postId: "retire-severance-db-dc",
        kind: "situation",
      },
      {
        id: "sal-hub",
        label: "잘 모르겠어요 — 전체",
        question: "월급·지출에서 먼저 볼 대표 계산기와 글 목록",
        hub: {
          calc: "salary-net",
          calcLine: "4대보험·세금 떼고 통장에 남는 돈",
          postsHref: "/posts/economy",
          postsNote: "경제 글 전체",
        },
        kind: "hub",
      },
    ],
  },
  {
    id: "loan",
    label: "대출·청약",
    hint: "빌린 돈과 집이 걸린 일",
    href: "/posts/finance",
    due: "yearend-preview",
    dueNote: "주택·전세자금대출 이자 공제 확인",
    choices: [
      {
        id: "loan-switch",
        label: "갈아타기 수수료",
        question: "중도상환수수료와 남은 이자를 합치면 갈아타는 게 유리한가",
        calc: "loan-repay",
        calcLine: "원리금균등·원금균등으로 상환액 비교",
        postId: "finance-loan-prepayment-fee-2026",
        kind: "situation",
      },
      {
        id: "loan-jeonse",
        label: "전세 vs 월세",
        question: "전세대출 이자와 월세를 같은 기간으로 놓으면 어느 쪽이 남나",
        calc: "rent-jeonse",
        calcLine: "전환율로 전세·월세 주거비 비교",
        postId: "finance-buy-vs-jeonse-breakeven",
        kind: "situation",
      },
      {
        id: "loan-subscription",
        label: "청약 가점",
        question: "무주택 기간·부양가족·통장 기간으로 계산한 가점은 몇 점인가",
        calc: "subscription-score",
        calcLine: "청약홈 기준 가점 계산",
        postId: "economy-subscription-25",
        kind: "situation",
      },
      {
        id: "loan-hub",
        label: "잘 모르겠어요 — 전체",
        question: "대출·청약에서 먼저 볼 대표 계산기와 글 목록",
        hub: {
          calc: "rent-jeonse",
          calcLine: "전환율로 전세·월세를 같은 기간에",
          postsHref: "/posts/finance",
          postsNote: "재무 글 전체",
        },
        kind: "hub",
      },
    ],
  },
];

/** 첫 화면이 처음 열릴 때 선택되어 있는 갈래·상황 (라디오 checked) */
export const DEFAULT_BRANCH = BRANCHES[0].id;
export const DEFAULT_CHOICE = "ins-silson";

export type ResolvedDue =
  | {
      kind: "dated";
      /** 'D-33' 같은 뱃지 */
      dday: ReturnType<typeof ddayOf>;
      date: string;
      title: string;
      href: string;
      note: string;
    }
  | {
      /** 기한이 모두 지난 뒤 — 달력의 다음 달 항목으로 물러난다(날짜를 지어내지 않는다) */
      kind: "month";
      when: string;
      title: string;
      href: string;
      note: string;
    }
  | { kind: "all"; title: string; href: string; note: string };

/**
 * 갈래의 '다가오는 일정' 하나를 고른다.
 *  ① 후보의 기한이 오늘 이후면 그 항목(D-Day 포함)
 *  ② 지났으면 달력에서 이번 달 이후 첫 항목(없으면 1월로 돌아감) — when만 쓰고 D-Day는 붙이지 않는다
 *  ③ 그것도 없으면 일정 전체 링크
 */
export function resolveDue(slot: DueSlotKey, note: string, today: Date = new Date()): ResolvedDue {
  const spec = DUE_SLOTS[slot];

  if (spec.milestoneId) {
    const m = MILESTONES.find((x) => x.id === spec.milestoneId);
    if (m?.dueDate && isUpcoming(m.dueDate, today)) {
      return {
        kind: "dated",
        dday: ddayOf(m.dueDate, today),
        date: m.dueDate,
        title: m.title,
        href: "/year-end-tax",
        note,
      };
    }
  }

  if (spec.calendarMonth !== undefined && spec.calendarTitle) {
    const item = calendar.find((c: CalendarItem) => c.month === spec.calendarMonth && c.title === spec.calendarTitle);
    if (item?.dueDate && isUpcoming(item.dueDate, today)) {
      return {
        kind: "dated",
        dday: ddayOf(item.dueDate, today),
        date: item.dueDate,
        title: item.title,
        href: item.toolHref ?? `/calendar#m${item.month}`,
        note,
      };
    }
  }

  /* ② 다음 달 항목 — 달력은 1~12월 순서라 이번 달 이후 첫 항목이 곧 '다음에 올 기한'이다 */
  const todayMonth = today.getMonth() + 1;
  const ordered = [...calendar].sort((a, b) => a.month - b.month);
  const later = ordered.filter((c) => c.month >= todayMonth);
  const pick = later.find((c) => c.key) ?? later[0] ?? ordered.find((c) => c.key) ?? ordered[0];
  if (pick) {
    return {
      kind: "month",
      when: pick.when,
      title: pick.title,
      href: `/calendar#m${pick.month}`,
      note,
    };
  }

  return { kind: "all", title: "금융 일정 전체 보기", href: "/calendar", note };
}
