/**
 * 학습 트랙 데이터 계약 — v9.0.0 P0 신설 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §5-2·§5-3).
 *
 * 왜 이 파일 하나인가
 *  · 글·아카데미·도구·카드가 서로를 가리키는 링크의 **주인을 한 곳으로** 모은다. 글 frontmatter에는
 *    `track: "pension-tax"` 한 줄(소속)만 적고, 순서·단계 도구·보조 카드·배지는 이 파일이 정한다.
 *    같은 사실을 두 곳에 적지 않으므로 '한쪽만 고쳐 화면이 어긋나는' 일이 생기지 않는다.
 *  · 화면은 아직 없다(P0는 데이터 계약만). `src/lib/tracks.ts`의 역인덱스와 `validateTracks()`가 먼저 서고,
 *    P1에서 배지, P2에서 `/academy/track/{id}`·`TrackDock`이 이 데이터를 읽는다.
 *
 * 지켜야 하는 규칙 (위반하면 `npm run verify:tracks`와 빌드가 선다)
 *  ① `posts`의 slug는 **이미 발행된 글**이어야 한다(`src/content/posts/`).
 *  ② 아직 없는 '빈틈 글'은 `planned`에만 적는다. 그 slug가 발행되면 `posts`로 옮긴다(검사가 알려 준다).
 *  ③ `tool`은 `apps.ts`에 있고 `internal: true`(실행 화면이 있음)이며 보관함(`archived`)이 아니어야 한다.
 *  ④ `card`는 `gallery.ts`의 세트여야 하고, 그 세트의 `post`가 비었거나 이 단계의 글 중 하나여야 한다(1:1 규칙).
 *  ⑤ 한 글은 한 트랙의 한 단계에만 속한다.
 *  ⑥ 한 트랙의 세 단계 도구는 서로 달라야 한다.
 *  ⑦ `badges.market`은 `today.ts` 지표 id, `badges.rules`는 `metric-badges.ts` id 안에서만 고른다.
 *
 * 숫자 원칙
 *  · `nextQuestion`(손실 질문)의 금액·비율도 손으로 적지 않는다. `tax-rules.ts`의 상수에서 계산해 문장을 만든다.
 *    그래야 법이 바뀔 때 글·배지·트랙의 말이 함께 움직인다.
 */
import {
  PENSION_ACCOUNT,
  PENSION_MAX_CREDIT_WON,
  PRIVATE_PENSION_TAX,
  PUBLIC_PENSION_HEALTH_LIMIT,
  pct,
  manLabel,
  wonLabel,
} from "./tax-rules.ts";

/** 트랙 id — 이 사이트가 세울 수 있는 6개 트랙의 **닫힌 목록**. 지금 구현된 것은 `pension-tax` 하나다. */
export const TRACK_IDS = [
  "pension-tax",
  "insurance-cover",
  "finance-rate",
  "invest-tax",
  "economy-price",
  "retire-income",
] as const;

export type TrackId = (typeof TRACK_IDS)[number];

/** 아직 발행되지 않은 '빈틈 글' — 제목만 계약으로 남긴다. */
export type PlannedPost = {
  slug: string;
  title: string;
};

export type TrackStage = {
  /** 1·2·3 — 단계 순서. 화면의 진행선(1/3)이 이 값을 센다. */
  no: 1 | 2 | 3;
  /** 단계 이름 — 하단 독 중앙에 1줄로 그린다 */
  name: string;
  /** 이 단계가 답하는 한 문장 */
  question: string;
  /** 이 단계의 기존 글 — 발행된 slug만 */
  posts: string[];
  /** 이 단계를 채우려고 아직 쓰지 않은 글 — 발행되면 `posts`로 옮긴다 */
  planned?: PlannedPost[];
  /** 이 단계의 아카데미 강의 — `academy-lessons.ts`의 slug (없으면 생략) */
  lesson?: string;
  /** 단계당 정확히 1개 — `apps.ts` slug (실행 화면이 있는 도구) */
  tool: string;
  /** 단계당 정확히 1개 — `gallery.ts` 세트 id */
  card: string;
  /** 이 단계 머리에 붙는 배지 — market은 today.ts, rules는 metric-badges.ts */
  badges: { market: string[]; rules: string[] };
  /** 다음 단계로 넘기는 '손실 질문' — 이 트랙의 재방문 고리 */
  nextQuestion: string;
};

export type Track = {
  id: TrackId;
  name: string;
  /** 이 트랙이 걸치는 분야 — 자산리포트 카테고리와 같은 이름 */
  fields: ("finance" | "invest" | "economy" | "insurance" | "retire" | "pension")[];
  /** 완주 후 남는 것 1장(운영표 칸) */
  promise: string;
  /** live: 3단계 화면이 열린 트랙 · planned: 데이터만 있고 화면이 없는 트랙 */
  status: "live" | "planned";
  stages: [TrackStage, TrackStage, TrackStage];
};

/** 900만원을 13.2% 구간에서 채웠을 때의 환급액 — 낮은 구간(16.5%)은 `PENSION_MAX_CREDIT_WON` 하나를 쓴다. */
const MAX_CREDIT_WON_HIGH = Math.round(
  PENSION_ACCOUNT.combinedLimit * 10000 * PENSION_ACCOUNT.creditRateHigh,
);

/**
 * 시범 트랙 — 연금·절세 3단계 (설계 §2-2·§3).
 *
 * 선정 근거: 연금 관련 글 11편·도구 5종·카드 9세트·아카데미 4강으로 재료가 가장 두껍고,
 * 진단·비교·방어 세 단계에 각각 글이 2편 이상 있다(보험은 3편·1강이라 3단계 코스가 서지 않는다).
 */
export const TRACKS: Track[] = [
  {
    id: "pension-tax",
    name: "연금·절세",
    fields: ["pension", "retire"],
    promise: "내 연금 3개 숫자(넣은 금액·남은 한도·받기 시작할 나이)와 인출 순서표 1장",
    status: "live",
    stages: [
      {
        no: 1,
        name: "내 칸 진단",
        question: "내 연금·절세 칸은 몇 개이고, 올해 얼마를 더 넣을 수 있나",
        posts: ["pension-master-01-four-accounts", "pension-tax-order"],
        planned: [
          {
            slug: "pension-three-numbers-lookup",
            title: "내 연금 3개 숫자 조회 — 납입액·한도·수령 개시일을 어디서 보나",
          },
        ],
        lesson: "step1-three-buckets",
        tool: "pension-tax",
        card: "three-buckets-3d",
        badges: {
          market: ["base-rate"],
          rules: ["pension-combined-limit", "pension-credit-rate"],
        },
        nextQuestion:
          `올해 ${manLabel(PENSION_ACCOUNT.combinedLimit)}을 다 못 채우면, ${pct(PENSION_ACCOUNT.creditRateLow)} 구간에서 ` +
          `최대 ${wonLabel(PENSION_MAX_CREDIT_WON)}을 돌려받지 못합니다. 그런데 채워도 안심은 이릅니다. ` +
          `총급여가 ${manLabel(PENSION_ACCOUNT.salaryThreshold)}을 넘으면 공제율이 ${pct(PENSION_ACCOUNT.creditRateHigh)}로 내려가 ` +
          `같은 ${manLabel(PENSION_ACCOUNT.combinedLimit)}의 환급이 ${wonLabel(MAX_CREDIT_WON_HIGH)}이 됩니다. ` +
          `2단계에서 내 급여가 어느 쪽인지, 그 돈을 연금저축 ${manLabel(PENSION_ACCOUNT.savingsLimit)}과 IRP ${manLabel(PENSION_ACCOUNT.combinedLimit - PENSION_ACCOUNT.savingsLimit)}으로 어떻게 나눌지를 나란히 놓습니다.`,
      },
      {
        no: 2,
        name: "손익 갈림길",
        question: "같은 돈을 어느 계좌에 넣어야 세후로 더 남나",
        posts: [
          "pension-master-02-tax-compare",
          "pension-master-03-yearend-900",
          "pension-master-04-asset-etf",
          "isa-pension-300",
        ],
        planned: [
          {
            slug: "pension-credit-rate-boundary-5500",
            title: `총급여 ${manLabel(PENSION_ACCOUNT.salaryThreshold)} 경계 — 공제율 ${pct(PENSION_ACCOUNT.creditRateLow)}와 ${pct(PENSION_ACCOUNT.creditRateHigh)}를 가르는 지점`,
          },
        ],
        lesson: "step2-account-order",
        tool: "account-tax-compare",
        card: "pension-accounts",
        badges: {
          market: ["base-rate", "ktb3y"],
          rules: ["pension-credit-rate", "isa-exempt"],
        },
        nextQuestion:
          "세후 1위를 골랐다고 끝이 아닙니다. 연금계좌에서 55세·5년 요건을 못 채우고 중도해지하면 " +
          `${pct(PENSION_ACCOUNT.earlyWithdrawRateWithLocal)}를 떼고, 요건을 채워 연 ${manLabel(PRIVATE_PENSION_TAX.annualThreshold)} 안에서 받으면 ` +
          `${pct(PRIVATE_PENSION_TAX.rateUnder70)}~${pct(PRIVATE_PENSION_TAX.rate80)}로 끝납니다. ${manLabel(PENSION_ACCOUNT.combinedLimit)}을 넣어 ` +
          `${wonLabel(PENSION_MAX_CREDIT_WON)}을 아낀 사람이, 3년 뒤 급하게 꺼내며 그 몇 배를 토해내는 경우가 여기서 나옵니다. ` +
          "3단계에서 인출 순서표를 만듭니다.",
      },
      {
        no: 3,
        name: "세금·약관 방어",
        question: "받을 때·급할 때 덜 잃으려면 무엇을 먼저 확인하나",
        posts: [
          "pension-master-05-draw-1500",
          "pension-master-06-healthcheck",
          "pension-early-withdrawal-165",
          "retire-fixed-cost",
          "retire-severance-db-dc",
        ],
        planned: [
          {
            slug: "pension-1500-vs-health-2000",
            title: "연 1,500만과 2,000만 — 두 기준선이 다른 이유",
          },
        ],
        lesson: "step4-retire-drawdown-order",
        tool: "pension-draw",
        card: "pension-1500-3d",
        badges: {
          market: ["base-rate"],
          rules: ["pension-private-threshold", "public-pension-health-limit", "health-rate"],
        },
        nextQuestion:
          `인출 순서는 한 번 정해 끝나지 않습니다. ${manLabel(PRIVATE_PENSION_TAX.annualThreshold)}(분리과세)과 ${manLabel(PUBLIC_PENSION_HEALTH_LIMIT)}(건보료) 두 선이 매년 함께 움직이고, ` +
          "12월 31일이 지나면 그해 세액공제 한도는 사라집니다. 순서표를 만든 뒤 다음 확인 날짜를 골든타임에 걸어 두세요. " +
          "그날 아침 허브의 기준금리·환율이 바뀐 것을 보고 다시 돌아오게 됩니다.",
      },
    ],
  },
];

export const trackById = (id: string): Track | undefined => TRACKS.find((t) => t.id === id);
