/**
 * 「한스푼 아카데미」 프로그램 데이터 — v8.1.0 (STEP 1·2 개설).
 *
 * 왜 데이터 파일인가
 *  · 6 STEP·41강·9세트와 수강 경로, 그리고 '지금 열린 강의'의 개수는 허브·홈 밴드·강의 페이지가 함께 읽는다.
 *    허브에서 '공개 N강'이라 적은 숫자와 실제로 열린 강의 수가 어긋나지 않게 한 곳에서 센다.
 *  · 강의 하나의 내용(원고·계산기·카드·출처)은 `data/academy-lessons.ts`에 있다. 이 파일은 프로그램의 뼈대다.
 *  · 금액·세율은 `data/tax-rules.ts`에서만 가져온다.
 *
 * 원칙
 *  · 특정 상품·운용사를 권하지 않는다. 보험은 재무설계의 도구로만 다룬다.
 *  · 외부 채널·영상·시리즈 이름은 쓰지 않는다. 회차 표기는 `STEP-강`(예: 2-3강) 하나만 쓴다.
 */
import { ACADEMY_LESSONS as ADULT_LESSONS, lessonBySlug, lessonsOfStep, type AcademyLesson } from "./academy-lessons";
import { SCHOOL_LESSONS } from "./academy-school-lessons";

export const ACADEMY = {
  name: "버핏킴즈 금융생활학교",
  /** 히어로 아래 한 줄 */
  tagline: "용돈부터 은퇴까지, 내 돈을 결정하는 연습",
  /** 프로그램 목적 한 문장 */
  promise:
    "초등 고학년·청소년·첫 월급·가계·자산형성·은퇴 6트랙 52주와, 성인 실전 6 STEP 41강을 한곳에 모았습니다. 강의마다 5분 읽기·카드 6장·내 숫자 계산기·1차 출처로 끝납니다.",
  /** 강의 1개의 표준 구성 */
  standard: "5분 읽기 → 10분 계산기 → 카드 6장 확인 → 출처 1개 직접 열어보기 → 다음 강 1문장",
  counts: { steps: 6, lessons: 41, cardSets: 9, cards: 54, hours: "약 11시간 40분" },
} as const;

/** 강의 1개의 4종 세트 — 허브에서 설명하는 네 칸 */
export const ACADEMY_SET = [
  {
    no: "①",
    title: "5분 읽기",
    minutes: "5분",
    body: "개념·기준·예외를 한 번에 끝내는 1,200~1,500자 글. 한 문장에 한 뜻만 담고, 어려운 말은 처음 나올 때 풀어 씁니다.",
  },
  {
    no: "②",
    title: "카드뉴스 6장",
    minutes: "3분",
    body: "1080×1350 카드 한 세트를 강의 안에서 바로 넘겨 봅니다. 카드 하단에 그 숫자의 조문과 기준일을 함께 적었습니다.",
  },
  {
    no: "③",
    title: "내 숫자 계산기",
    minutes: "10분",
    body: "사이트의 계산기에 내 숫자를 넣어 결론을 봅니다. 입력값은 주소에도 서버에도 남기지 않고 그 화면 안에서만 계산합니다.",
  },
  {
    no: "④",
    title: "1차 출처와 운영표",
    minutes: "2분",
    body: "법령 조문과 기관 안내 원문을 남기고, 내 돈 운영표 한 칸을 채웁니다. 41강을 마치면 문서 6장이 남습니다.",
  },
] as const;

export type AcademyStep = {
  /** 1~6 */
  no: number;
  /** 주소 조각 — /academy/step2-… */
  slug: string;
  name: string;
  /** 이 STEP이 답하는 질문 */
  question: string;
  lessons: number;
  /** 자료앨범 카드 세트 */
  cards: string;
  time: string;
  /** 수료 기준 — STEP 끝에 남기는 산출물 1장 */
  deliverable: string;
  /** open: 이번에 강의가 열린 STEP */
  status: "open" | "soon";
  /** 지금 열린 강의 수 — `academy-lessons.ts`에서 센다 */
  opened: number;
};

const stepBase = [
  {
    no: 1,
    slug: "step1-money-basics",
    name: "돈의 기초 체력",
    question: "내 돈은 어디서 들어와 어디로 나가나",
    lessons: 6,
    cards: "A. 세 칸의 지도",
    time: "1시간 40분",
    deliverable: "세 칸을 채운 내 현금흐름표 1장",
  },
  {
    no: 2,
    slug: "step2-account-placement",
    name: "계좌 배치",
    question: "세금은 언제, 어느 계좌에서 떼이나",
    lessons: 7,
    cards: "B. 세 순간 · C. 계좌 배치표",
    time: "2시간",
    deliverable: "세액공제액·ISA(비과세 절세 계좌) 납입액·건보료 경계를 적은 배치표 1장",
  },
  {
    no: 3,
    slug: "step3-asset-structure",
    name: "굴리는 구조",
    question: "무엇을, 얼마씩, 어떻게 들고 갈까",
    lessons: 8,
    cards: "D. ETF 6개 숫자 · E. 낙폭과 회복",
    time: "2시간 20분",
    deliverable: "목표·3층 비율·리밸런싱(목표 비중 되돌리기) 밴드를 적은 투자정책서 1장",
  },
  {
    no: 4,
    slug: "step4-retirement-draw",
    name: "받는 설계",
    question: "언제부터, 얼마를, 어떤 순서로 받나",
    lessons: 8,
    cards: "F. 1,500만 원 경계선 · G. 퇴직연금 3층",
    time: "2시간 20분",
    deliverable: "은퇴 후 월 수령액과 인출 순서표 1장",
  },
  {
    no: 5,
    slug: "step5-risk-cover",
    name: "잃지 않는 장치",
    question: "무엇이 나를 무너뜨릴 수 있나",
    lessons: 6,
    cards: "H. 보장 공백 5칸",
    time: "1시간 40분",
    deliverable: "5대 담보 빈칸 표 1장",
  },
  {
    no: 6,
    slug: "step6-year-sheet",
    name: "1년 운영표",
    question: "12개월을 어떤 순서로 돌리나",
    lessons: 6,
    cards: "I. 12개월 금융 달력",
    time: "1시간 40분",
    deliverable: "12개월 달력 1장과 결산 3숫자",
  },
] as const;

/** 6단계 41강 — 순서가 화면 순서다. 열린 강의 수는 강의 데이터에서 센다. */
export const ACADEMY_STEPS: AcademyStep[] = stepBase.map((s) => {
  const opened = lessonsOfStep(s.no).length;
  return { ...s, status: opened > 0 ? "open" : "soon", opened };
});

export const stepByNo = (no: number) => ACADEMY_STEPS.find((s) => s.no === no);

/** 지금 열린 강의 — 성인 10강 + 학교 트랙 7강, 학습 순서대로 */
export const ACADEMY_LESSONS: AcademyLesson[] = [...ADULT_LESSONS, ...SCHOOL_LESSONS];
export const OPEN_LESSONS: AcademyLesson[] = ACADEMY_LESSONS;
export const openLessonCount = OPEN_LESSONS.length;
export const openStepCount = ACADEMY_STEPS.filter((s) => s.status === "open").length;

/** 학교 트랙(초등·청소년·첫 월급·가계·자산형성·은퇴)만 — 허브의 트랙 카드가 읽는다 */
export const SCHOOL_OPEN_LESSONS = OPEN_LESSONS.filter((l) => (l.track ?? "adult") !== "adult");

/** 트랙 이름 — 화면 라벨을 한 곳에서 만든다 */
export const TRACK_LABEL: Record<NonNullable<AcademyLesson["track"]>, string> = {
  adult: "성인 실전",
  elementary: "초등 고학년",
  teen: "청소년",
  firstpay: "첫 월급",
  household: "가계",
  asset: "자산형성",
  retire: "은퇴",
};

/** 수강 경로 3가지 — 진단 3문항의 답 개수로 갈린다. */
export const ACADEMY_PATHS = [
  {
    id: "starter",
    name: "입문",
    steps: [1, 2],
    stepsText: "STEP 1 → 2",
    lessons: 13,
    who: "계좌가 2개 이하이고, 투자 경험이 1년 미만",
    goal: "내 숫자 3개와 계좌 배치 한 장을 먼저 만듭니다.",
  },
  {
    id: "builder",
    name: "자산가",
    steps: [1, 2, 3, 6],
    stepsText: "STEP 1 → 2 → 3 → 6",
    lessons: 27,
    who: "월 투자금은 있지만, 어느 계좌에 얼마를 둘지 기준이 없음",
    goal: "배치 기준과 3층 비율, 12개월 운영표까지 한 번에 세웁니다.",
  },
  {
    id: "retiree",
    name: "은퇴",
    steps: [1, 2, 4, 6],
    stepsText: "STEP 1 → 2 → 4 → 6",
    lessons: 27,
    who: "50세 이상이거나 퇴직·연금 수령이 10년 안",
    goal: "받는 순서와 세금 경계를 먼저 정하고, 운영표로 마무리합니다.",
  },
] as const;

/** 진단 3문항 — 0~1개 입문 / 2개 자산가·은퇴 / 3개 6단계 전체 */
export const ACADEMY_DIAGNOSIS = [
  "지금 내 계좌를 3개 이상 말할 수 있다.",
  "지난 1년간 내 투자 수익률을 숫자로 안다.",
  "은퇴 후 월 생활비를 숫자로 적어본 적이 있다.",
] as const;

/** 내 돈 운영표 6칸 — STEP 하나에 한 칸 */
export const SHEET_SLOTS = [
  { no: 1, name: "현금흐름표", step: "STEP 1" },
  { no: 2, name: "계좌 배치표", step: "STEP 2" },
  { no: 3, name: "투자정책서", step: "STEP 3" },
  { no: 4, name: "인출 순서표", step: "STEP 4" },
  { no: 5, name: "보장 빈칸표", step: "STEP 5" },
  { no: 6, name: "12개월 달력", step: "STEP 6" },
] as const;

/**
 * v8.0 파일럿(2-3강)을 가리키던 이름 — 홈 밴드 등 기존 호출부가 그대로 읽는다.
 * 새 코드는 `OPEN_LESSONS`에서 첫 강의를 고르거나 `lessonBySlug`를 쓴다.
 */
export const PILOT = lessonBySlug("step2-pension-tax-limit")!;

/** 강의 페이지가 주소를 만들 때 쓰는 경로 */
export const academyLessonHref = (lesson: AcademyLesson) => `/academy/${lesson.slug}/`;

/** 허브 목록에서 한 STEP의 강의를 링크로 편다. */
export const openLessonsOfStep = (no: number) => lessonsOfStep(no);
