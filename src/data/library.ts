import type { CategorySlug } from "./categories.ts";

/**
 * 홈 아카이브 — 7대 주제·시리즈·처음 읽을 글.
 *
 * 글은 계속 늘어나므로 여기에는 '묶는 규칙'만 둔다.
 * 편수·제목·기준일은 빌드할 때 글 컬렉션에서 그대로 세어 붙인다(손으로 적은 숫자를 두지 않는다).
 */

export type LibraryTopic = {
  slug: CategorySlug;
  name: string;
  /** 카드에서 이 주제가 답하는 것 한 줄 */
  line: string;
  /** 목록 머리에 붙는 짧은 표기 */
  tag: string;
  /** 리스크 관리(보험)처럼 한 단계 뒤에 두는 주제 */
  sub?: boolean;
};

/** 화면에 세우는 7대 주제 — 금융·투자·연금·노후·경제·AI·보험 */
export const libraryTopics: LibraryTopic[] = [
  {
    slug: "finance",
    name: "금융",
    line: "금리·대출·환율이 내 통장에 닿는 경로",
    tag: "RATE",
  },
  {
    slug: "invest",
    name: "투자",
    line: "수익률보다 먼저, 버틸 수 있는 구조",
    tag: "INVEST",
  },
  {
    slug: "pension",
    name: "연금",
    line: "넣는 시점과 받는 시점의 시간표",
    tag: "PENSION",
  },
  {
    slug: "retire",
    name: "노후",
    line: "은퇴 후 매달 나가는 돈의 구조",
    tag: "RETIRE",
  },
  {
    slug: "economy",
    name: "경제",
    line: "지표 하나가 살림에 닿기까지",
    tag: "ECONOMY",
  },
  {
    slug: "ai",
    name: "AI",
    line: "써 보고 남은 기록만 올립니다",
    tag: "AI",
  },
  {
    slug: "insurance",
    name: "보험",
    line: "약관과 증권을 읽는 기준 — 리스크 관리",
    tag: "RISK",
    sub: true,
  },
];

export type LibrarySeries = {
  id: string;
  /** 시리즈 번호 표기 */
  no: string;
  title: string;
  line: string;
  /** 글 파일 이름(id) — 빌드 시 제목·기준일을 붙인다 */
  postIds: string[];
  /**
   * v7.0 — 아직 글이 없는 '예정 시리즈'의 뼈대.
   * `postIds`가 비어 있으면 화면에는 나오지 않는다(빈 카드를 만들지 않는다).
   * 연금·퇴직 마스터 가이드는 43쪽 연금노트를 5~6편으로 나눠 넣을 자리다.
   */
  planned?: { no: number; title: string }[];
  /** 편입 예정 편수 — 내부 문서·검증에서 쓴다 */
  plannedCount?: number;
};

/** 12편을 같은 질문끼리 묶은 6개 시리즈 — 순서대로 읽으면 한 주제가 끝난다. */
export const librarySeries: LibrarySeries[] = [
  {
    id: "pension-retire",
    no: "01",
    title: "연금·노후 설계",
    line: "넣을 때와 받을 때를 따로 계산합니다.",
    postIds: ["pension-tax-order", "retire-fixed-cost"],
  },
  {
    id: "invest-tax",
    no: "02",
    title: "투자·절세",
    line: "수익률 앞에 규칙과 세금을 먼저 둡니다.",
    postIds: ["invest-dca-rule", "invest-dividend-total-return", "finance-rate-gap"],
  },
  {
    id: "insurance-check",
    no: "03",
    title: "보험·제도 확인",
    line: "지급되는 조건과 지급되지 않는 조건을 함께 읽습니다.",
    postIds: ["insurance-silson-5th", "insurance-coverage-conditions"],
  },
  {
    id: "economy-life",
    no: "04",
    title: "경제·생활",
    line: "지표와 장바구니 사이의 시차를 따라갑니다.",
    postIds: ["economy-fx-grocery", "economy-service-prices"],
  },
  {
    id: "ai-tools",
    no: "05",
    title: "AI·도구 만들기",
    line: "맡기기 전에 정할 것과, 남는 판단.",
    postIds: ["ai-work-order", "ai-coverage-tool"],
  },
  {
    id: "questions",
    no: "06",
    title: "계산 뒤의 질문",
    line: "숫자를 받아들이는 태도에 대한 짧은 글.",
    postIds: ["philosophy-numbers-are-questions"],
  },
];

/**
 * v7.0 — 연금·퇴직 마스터 가이드 (편입 예정).
 *
 * 43쪽 분량의 「사계정원 연금노트」를 6편으로 나눠 이 섹터에 넣는다.
 * 글 파일을 `src/content/posts/`에 추가하고 frontmatter에
 *   series: { name: "연금·퇴직 마스터 가이드", no: 1 }
 * 을 적은 뒤, 아래 postIds에 파일 이름을 넣으면 홈 아카이브·목록에 자동으로 붙는다.
 * (postIds가 비어 있는 동안에는 화면에 나오지 않는다.)
 */
export const pensionMasterSeries: LibrarySeries = {
  id: "pension-master",
  no: "07",
  title: "연금·퇴직 마스터 가이드",
  line: "넣는 시점부터 받는 시점까지, 연금의 전 과정을 한 섹터로.",
  postIds: [],
  plannedCount: 6,
  planned: [
    { no: 1, title: "연금의 구조 — 국민·퇴직·개인의 3층" },
    { no: 2, title: "넣는 해 — 세액공제 한도와 공제율" },
    { no: 3, title: "운용하는 해 — 수익률보다 배분" },
    { no: 4, title: "받는 해 — 1,500만 원 경계와 과세 방식" },
    { no: 5, title: "퇴직연금 — DB·DC·IRP의 선택" },
    { no: 6, title: "건강보험·상속 — 연금 밖의 변수" },
  ],
};

/**
 * 처음 온 사람에게 먼저 권하는 세 편 — '왜 이 글부터인지'를 함께 적는다.
 * 글 제목은 컬렉션에서 가져오고, 여기에는 이유만 둔다.
 */
export const firstReads: { id: string; reason: string }[] = [
  {
    id: "pension-tax-order",
    reason: "12월 31일 전에 확인할 순서 — 연금 글이 많아도 이 한 편이면 시작점이 잡힙니다.",
  },
  {
    id: "retire-fixed-cost",
    reason: "은퇴 후 목돈보다 매달 나가는 돈을 먼저 세는 이유.",
  },
  {
    id: "insurance-silson-5th",
    reason: "보험료가 낮아진 대신 무엇이 올라갔는지, 같은 병원비로 비교합니다.",
  },
];

/**
 * 자주 찾는 계산 — 도구 이름·링크는 tools.ts의 것을 그대로 쓰고, 이유만 여기서 정한다.
 */
export const frequentCalculations: { key: string; reason: string }[] = [
  { key: "pension", reason: "올해 채울 금액과 예상 세액공제액" },
  { key: "retirement-flow", reason: "은퇴 후 월 수령액을 오늘 가치로" },
  { key: "compound-return", reason: "보수·세금을 뺀 세후 평가액" },
];
