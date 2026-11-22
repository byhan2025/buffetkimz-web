/**
 * 「한스푼 아카데미」 강의 데이터 — v8.1.0 확장(STEP 1·2 개설).
 *
 * 왜 이 파일인가
 *  · v8.0 파일럿은 2-3강 하나를 `academy.ts` 안에 하드코딩했다. STEP 1·2로 강의가 다섯 개가 되면서
 *    강의 1개 = 같은 4요소(① 손익 반전 훅 ② 5분 읽기 ③ 계산기 ④ 3D 카드+1차 출처 ⑤ 운영표 1칸)를
 *    가진 데이터로 바꿨다. 허브(목록·개수)와 강의 페이지(본문)가 같은 배열을 읽는다.
 *  · 금액·세율은 `data/tax-rules.ts`에서만 만든다. 이 파일은 금액을 손으로 적지 않고
 *    한도 × 공제율로 계산해, 세율이 바뀌면 글·카드·계산기가 같이 따라오게 한다.
 *
 * 원칙
 *  · 특정 상품·운용사를 권하지 않는다. 상품 이름 없이 '어떤 성질의 자리인지'만 말한다.
 *  · 외부 채널·영상·시리즈 이름은 쓰지 않는다. 회차 표기는 `STEP-강`(예: 2-3강) 하나만 쓴다.
 *  · 확인하지 못한 조문·숫자는 단정하지 않고 '요건은 원문에서 확인'으로 남긴다.
 */
import {
  PENSION_ACCOUNT,
  PRIVATE_PENSION_TAX,
  PUBLIC_PENSION_HEALTH_LIMIT,
  ISA,
  INCOME_TAX,
  wonLabel,
  manLabel,
  pct,
} from "./tax-rules";

/** 만원 단위 금액 × 비율 → 원 단위 금액 */
export const creditWon = (man: number, rate: number) => Math.round(man * 10000 * rate);

/* ------------------------------------------------------------------
   타입
   ------------------------------------------------------------------ */
export type ReadingSection = { h: string; ps: string[] };

export type LessonForkSide = { tag: string; head: string; body: string; verdict: string };

export type LessonCardSlide = {
  /** public 기준 경로 — `/gallery/3d-…-01.png` */
  src: string;
  alt: string;
  caption: string;
};

export type LessonCardSet = {
  /** 자료앨범 세트 id (`gallery.ts`와 같은 값) */
  id: string;
  /** 자료앨범 세트 이름 */
  title: string;
  meta: string;
  /** 자료앨범 전체보기 주소 */
  href: string;
  /** 인라인 뷰어가 처음 보여 줄 장 (0부터) */
  startIndex: number;
  slides: LessonCardSlide[];
};

export type LessonScenario = {
  id: string;
  label: string;
  title: string;
  settings: string[];
  result: string;
  expect: string;
  /** 이 시나리오를 직접 확인할 곳 — 없으면 강의의 계산기 */
  href?: string;
  /** 버튼 문구 — 없으면 `계산기 이름 열기` */
  cta?: string;
};

export type LessonSource = { label: string; what: string; url: string; host: string };

export type SheetVariant =
  | "pension"
  | "cashflow"
  | "emergency"
  | "order"
  | "isa"
  /** v8.2.0 학교 트랙 — 초등 용돈 세 칸 */
  | "allowance"
  /** v8.2.0 학교 트랙 — 청소년 구독·BNPL */
  | "teenplan"
  /** v8.2.0 학교 트랙 — 첫 월급 실수령 */
  | "firstpay"
  /** v8.3.0 STEP 3 — 투자정책서(3층 비율·손실 한도) */
  | "policy"
  /** v8.3.0 STEP 3 — ETF 기간 비용 점검 */
  | "etfcheck"
  /** v8.3.0 학교 트랙 가계 — 현금흐름 3줄 */
  | "household"
  /** v8.3.0 학교 트랙 가계 — 보장 공백 5칸 */
  | "coverage"
  /** v8.4.0 STEP 4 — 인출 순서표(3억·연 1,500만·순서) */
  | "draworder"
  /** v8.4.0 STEP 5 — 보장 빈칸표(실손 세대·보험료·선택) */
  | "silson"
  /** v8.4.0 STEP 6 — 12개월 달력(목표 비중·밴드·현금) */
  | "rebalance"
  /** v8.4.0 학교 자산형성 — 나눠 담기와 비중 */
  | "assetplan"
  /** v8.4.0 학교 은퇴 — 3층 연금 지도와 두 기준선 */
  | "pensionmap";

/** 강의가 속한 트랙 — 성인 실전 6 STEP과 학교 4트랙을 가른다 */
export type LessonTrack =
  | "adult"
  | "elementary"
  | "teen"
  | "firstpay"
  | "household"
  /** v8.4.0 — 52주 자산형성 트랙 */
  | "asset"
  /** v8.4.0 — 52주 은퇴 트랙 */
  | "retire";

/** 한 화면 한 질문 퀴즈의 선택지 — 정답은 색이 아니라 글자·아이콘으로 알린다 */
export type LessonQuizOption = {
  label: string;
  /** 정답 여부 — 화면에는 '맞아요'/'다시 보기' 글자와 아이콘으로 함께 나간다 */
  ok?: boolean;
  /** 고른 뒤 보여 주는 한 줄 — 왜 그런지 */
  why: string;
};

export type LessonQuizItem = {
  q: string;
  /** 질문 아래 작은 힌트 */
  hint?: string;
  options: LessonQuizOption[];
  /** 한 문항을 마친 뒤 남기는 한 줄 */
  explain: string;
};

export type LessonSheet = {
  variant: SheetVariant;
  /** 내 돈 운영표에서 이 강의가 채우는 칸 번호(1~6) */
  slotNo: number;
  slotTitle: string;
  /** 이 강의에서 적는 한 줄 */
  line: string;
};

export type AcademyLesson = {
  slug: string;
  /** 없으면 성인 실전(`adult`) — 학교 트랙만 값을 갖는다 */
  track?: LessonTrack;
  /** 학교 트랙의 한 화면 한 질문 퀴즈 — 없으면 퀴즈 구획을 그리지 않는다 */
  quiz?: { items: LessonQuizItem[] };
  /** 성인 STEP은 1~6, 학교 트랙은 0 */
  step: number;
  no: number;
  /** `1-1강` */
  label: string;
  /** 목록·카드에 쓰는 짧은 제목 */
  shortTitle: string;
  /** 강의 페이지 h1 — 조건이 붙은 질문 */
  title: string;
  /** 5분 읽기가 답하는 한 줄 질문 */
  question: string;
  /** 결론 상자 — 숫자가 들어간 한 문장(읽기 전에 답을 먼저 준다) */
  thesis: string;
  readingMinutes: number;
  /** ① 손익 반전 훅 */
  hook: string;
  fork: { short: LessonForkSide; long: LessonForkSide };
  /** 허브 카드에 보이는 대표 숫자 3개 */
  keyNumbers: { label: string; value: string }[];
  /** 본문이 읽는 표기 문자열 — 금액을 문장에 직접 적지 않는다 */
  numbers: Record<string, string>;
  /** ③ 계산기 실습 */
  calculator: { name: string; href: string; note: string };
  scenarios: LessonScenario[];
  sources: LessonSource[];
  cardSet: LessonCardSet;
  /** ⑤ 내 돈 운영표 1칸 */
  sheet: LessonSheet;
  next: { label: string; title: string; body: string; href?: string; status?: string };
  /** ② 5분 읽기 원고 */
  reading: ReadingSection[];
};

/** 공백 제외 글자 수 — 1,200~1,500자 규격 검사에 쓴다. */
export const readingChars = (reading: ReadingSection[]) =>
  reading.reduce(
    (n, s) => n + s.h.replace(/\s/g, "").length + s.ps.join("").replace(/\s/g, "").length,
    0,
  );

/* ------------------------------------------------------------------
   자료앨범 3D 세트 — 인라인 카드뉴스 뷰어가 읽는 6장
   · 파일: public/gallery/3d-{prefix}-01..06.png
   · 캡션은 자료앨범(gallery.ts)의 같은 세트와 어긋나지 않게 그대로 옮겨 적는다.
   ------------------------------------------------------------------ */
const CARD = { w: 1080, h: 1350 } as const;

const card = (prefix: string, no: number, caption: string, alt: string): LessonCardSlide => ({
  src: `/gallery/3d-${prefix}-${String(no).padStart(2, "0")}.png`,
  alt,
  caption,
});

/** A. 세 칸의 지도 — STEP 1 (1-1강 · 1-2강이 함께 봄) */
const SET_THREE_BUCKETS: LessonCardSet = {
  id: "three-buckets-3d",
  title: "월급이 들어오면, 3개의 통",
  meta: "3D 스토리 카드 6장 · 비상금 · 단기목표 · 장기투자",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("three-buckets", 1, "표지 — 월급이 들어오면 나뉘는 3개의 통", "세 칸으로 나뉜 나무 쟁반에 금화·작은 집·새싹이 담겨 있고, 양팔을 벌린 캐릭터"),
    card("three-buckets", 2, "오해 vs 팩트 — 남는 돈 모으기 / 먼저 나누고 쓰기", "왼쪽은 거의 빈 단지 옆에 선 캐릭터, 오른쪽은 동전을 세 갈래로 나눠 담는 캐릭터"),
    card("three-buckets", 3, "통 ① — 생활비 3~6개월, 바로 꺼낼 수 있게", "금화와 지폐가 든 유리병에 동전을 넣는 캐릭터와 작은 우산·방패"),
    card("three-buckets", 4, "통 ② — 1~3년 안에 쓸 돈은 예·적금으로", "자물쇠와 깃발이 달린 저금함에 봉투를 넣는 캐릭터와 세 개의 달력 블록"),
    card("three-buckets", 5, "통 ③ — 5년 이상 묶을 돈은 절세계좌에", "금화가 열매로 달린 작은 나무 화분에 물을 주는 캐릭터"),
    card("three-buckets", 6, "오늘 할 일 — 자동이체 3줄 세팅", "세 개의 빈 체크 동그라미가 있는 클립보드를 든 캐릭터"),
  ],
};

/** B. 세 순간 — STEP 2 (2-3강) */
const SET_TAX_MOMENTS: LessonCardSet = {
  id: "tax-moments-3d",
  title: "모르면 16.5% 떼이는 세금 세 순간",
  meta: "3D 스토리 카드 6장 · 이자·중도해지·연금수령",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("tax-moments", 1, "표지 — 모르면 16.5% 떼이는 세 순간", "나무 선반 위 세 개의 작은 알람시계와 걱정스러운 표정의 캐릭터"),
    card("tax-moments", 2, "오해 vs 팩트 — 공제받았으니 이득 / 해지하면 16.5%", "환급 봉투를 안고 웃는 캐릭터와 밑이 깨진 금고에서 동전이 새는 장면"),
    card("tax-moments", 3, "순간 1 — 이자·배당 15.4%, 이미 떼고 받습니다", "은행 모형으로 이어지는 동전 레일에서 집게가 동전을 집어 가는 장면"),
    card("tax-moments", 4, "순간 2 — 중도해지 16.5% 기타소득세", "거대한 가위가 금고의 자물쇠를 자르고 경보 종이 울리는 장면"),
    card("tax-moments", 5, "순간 3 — 연금으로 받으면 5.5%~3.3%", "수도꼭지에서 동전이 한 방울씩 떨어져 모래시계를 거쳐 쟁반으로 흐르는 장면"),
    card("tax-moments", 6, "요약 — 꺼낼 돈과 묶을 돈, 먼저 나눠 두기", "열린 접시와 자물쇠가 달린 작은 궤짝 사이에 선 캐릭터"),
  ],
};

/** C. 계좌 배치표 — STEP 2 (2-1강). v8.1.0에서 손글씨 6장이 들어와 실제 카드와 캡션을 맞췄다. */
const SET_ACCOUNT_ORDER: LessonCardSet = {
  id: "account-order-hand",
  title: "연봉 5,500만, 계좌 넣는 순서",
  meta: "손글씨 카드 6장 · 연금저축 · IRP · ISA",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("account-order", 1, "표지 — 연봉 5,500만 원 기준 계좌 3순위 배치표", "세 단 계단 위 동전 단지를 오르는 마스코트와 '남는 돈, 어디부터 넣어야 할까'"),
    card("account-order", 2, "오해 vs 팩트 — 아무 계좌나 넣기 / 세액공제율·유동성 순서대로 채우기", "왼쪽은 빈 단지 옆에 앉은 시무룩한 마스코트, 오른쪽은 세 단지에 동전을 나눠 담는 마스코트"),
    card("account-order", 3, "1순위 — 비상금 다음은 연금저축 600만 (16.5%·13.2%)", "우산과 동전 단지, 저금통, 동전을 넣는 마스코트"),
    card("account-order", 4, "2순위 — IRP 300만 추가, 합산 900만 원 한도", "나란한 두 단지를 잇는 작은 다리와 클립보드를 든 마스코트"),
    card("account-order", 5, "3순위 — 3년 안 쓸 돈은 ISA (서민형 400만·일반형 200만)", "열린 보물상자와 기대어 놓은 달력, 동전을 든 마스코트"),
    card("account-order", 6, "요약 — 내 상황이면 이 순서", "클립보드 체크리스트를 든 마스코트와 3줄 배치표"),
  ],
};

/** D. ISA 5분 정리 — STEP 2 (2-2강) */
const SET_ISA_BASICS: LessonCardSet = {
  id: "isa-basics-3d",
  title: "ISA 5분 정리, 핵심 네 가지",
  meta: "3D 스토리 카드 6장 · 비과세·손익통산·한도·전환",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("isa-basics", 1, "표지 — 이자 15.4%, 그냥 내시나요", "한 입 베인 동전 더미를 보는 캐릭터"),
    card("isa-basics", 2, "핵심 1 — 비과세 400만·200만", "200과 400이 적힌 두 개의 상자를 나란히 든 캐릭터"),
    card("isa-basics", 3, "핵심 2 — 손익통산", "이익과 손실이 적힌 두 저울이 하나의 접시로 합쳐지는 장면"),
    card("isa-basics", 4, "핵심 3 — 연 2,000만·최대 1억", "큰 자와 작은 자로 금액을 재는 캐릭터"),
    card("isa-basics", 5, "핵심 4 — 3년 후 연금 전환", "만기 표지판에서 연금 저금통으로 이어지는 다리"),
    card("isa-basics", 6, "클로징 — 일반 계좌 전에 ISA", "두 갈래 길 앞에 선 캐릭터와 ISA 표지판"),
  ],
};

/** E. 반 토막이면 두 배 — STEP 3 (3-1강). v8.3.0에서 손글씨 6장과 캡션을 맞췄다. */
const SET_DRAWDOWN: LessonCardSet = {
  id: "drawdown-recovery-hand",
  title: "반 토막이면 두 배 — 낙폭과 회복",
  meta: "손글씨 카드 6장 · 낙폭 · 회복률 · 변동성",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("drawdown-recovery", 1, "표지 — 낙폭과 회복의 비대칭", "V자 골짜기 아래에 선 마스코트와 반대편 언덕 위의 작은 깃발"),
    card("drawdown-recovery", 2, "오해 vs 팩트 — +50%면 본전? / 반 토막 뒤엔 +100%", "왼쪽은 금 간 동전을 든 걱정스러운 마스코트, 오른쪽은 깃발이 있는 긴 사다리를 오르는 마스코트"),
    card("drawdown-recovery", 3, "구간별 회복률 — −10%→+11.1%, −20%→+25%, −30%→+42.9%, −50%→+100%", "동전이 담긴 네 개의 단지와 자, 네 줄 비교표"),
    card("drawdown-recovery", 4, "함정 — 변동성 끌림, 오를수록 덜 오릅니다", "울퉁불퉁한 길에서 동전을 떨어뜨리는 수레와 옆의 평평한 길"),
    card("drawdown-recovery", 5, "낙폭을 줄이는 두 장치 — 분산과 현금 비중", "우산 두 개와 달걀 바구니, 동전 주머니를 든 마스코트"),
    card("drawdown-recovery", 6, "원칙 — 크게 잃지 않는 포트폴리오 규칙", "방패와 클립보드를 든 마스코트와 3줄 체크리스트"),
  ],
};

/** D. ETF 6개 숫자 — STEP 3 (3-2강) */
const SET_ETF_NUMBERS: LessonCardSet = {
  id: "etf-6numbers-3d",
  title: "수익률 전에 볼 ETF 6개 숫자",
  meta: "3D 스토리 카드 6장 · 비용 · 유동성 · 추적",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("etf-6numbers", 1, "표지 — 수익률 전에 볼 6개 숫자", "여섯 개의 빈 계기판 다이얼이 달린 콘솔, 확대경으로 다이얼을 들여다보는 캐릭터와 '수익률 전에 볼 ETF 6개 숫자'"),
    card("etf-6numbers", 2, "오해 vs 팩트 — 보수만 싸면 제일 싼 ETF? / 총비용으로 비교", "왼쪽은 아주 작은 가격표가 달린 택배 상자를 든 캐릭터, 오른쪽은 저울 아래 숨은 추 때문에 기운 상자"),
    card("etf-6numbers", 3, "숫자 ① ② — 순자산과 거래량, 클수록 유동성", "동전이 수북한 큰 좌판과 줄을 선 미니어처 군중, 위에서 깔때기로 동전이 쏟아지는 시장"),
    card("etf-6numbers", 4, "숫자 ③ ④ — 총보수+기타비용이 실제 비용", "물 위로 드러난 작은 빙산 끝과 물속의 거대한 얼음 덩어리, 옆 작은 배에 탄 캐릭터"),
    card("etf-6numbers", 5, "숫자 ⑤ ⑥ — 추적오차·괴리율, 지수를 얼마나 따라가나", "트랙에서 줄무늬 주자가 앞서 달리고, 캐릭터가 눈금 없는 긴 줄자를 들고 뒤쫓는 장면"),
    card("etf-6numbers", 6, "매수 전 10초 — 체크 3가지", "빈 문자판의 큰 회중시계와 세 개의 빈 타일, 손가락을 들어 알려 주는 캐릭터"),
  ],
};

/** F. 리밸런싱과 현금 비중 — STEP 6 6-1강 · 학교 자산형성 1강 (v8.4.0) */
const SET_REBALANCE: LessonCardSet = {
  id: "asset-rebalance-hand",
  title: "오를 때 덜고 내릴 때 채우기 — 리밸런싱과 현금 비중",
  meta: "손글씨 카드 6장 · 목표 비중 · 점검 주기 · 현금 비중",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("asset-rebalance", 1, "표지 — 리밸런싱은 오를 때 덜고 내릴 때 채우는 일", "저울 위 두 단지 사이에서 동전을 옮겨 담는 마스코트와 '오를 때 덜고 내릴 때 채웁니다'"),
    card("asset-rebalance", 2, "오해 vs 팩트 — 그냥 두기 / 목표금액 = 총자산 × 목표비중, 넘으면 덜기", "왼쪽은 무너질 듯 높이 쌓은 동전 탑을 붙든 마스코트, 오른쪽은 크기가 고른 세 단지를 나란히 둔 마스코트"),
    card("asset-rebalance", 3, "① 목표 비중 — 총자산 1,000만이면 주식 700만, 지금 820만이면 120만 덜기", "둘로 나눈 파이 옆에서 자와 연필을 든 마스코트, '총자산 1,000만이면 주식 700만'"),
    card("asset-rebalance", 4, "② 점검 — 정기 연 1회 + 임계 ±5%p, 점검 날짜를 달력에 먼저 적기", "달력의 한 칸에 동그라미를 치는 마스코트와 작은 종, '1년에 한 번, 5%p 넘으면 그때도'"),
    card("asset-rebalance", 5, "③ 현금 비중 — 생활비 3~6개월 + 3년 안에 쓸 돈은 투자 밖에", "울타리 친 동전 나무와, 바구니·우산을 올려둔 나무 선반을 가리키는 마스코트"),
    card("asset-rebalance", 6, "요약 — 내 리밸런싱 3줄 규칙", "체크박스 세 칸이 있는 클립보드를 든 마스코트와 3줄 규칙"),
  ],
};

/** G. 실손 세대 전환·약관 공백 — STEP 5 5-1강 (v8.4.0) */
const SET_SILSON: LessonCardSet = {
  id: "silson-switch-3d",
  title: "실손 50% 할인, 갈아타기 전 3가지",
  meta: "3D 스토리 카드 6장 · 11. 23. 시행 계약전환",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("silson-switch", 1, "표지 — 내일부터 시작되는 50% 할인", "보험 증권 두 권을 양손에 들고 번갈아 보는 너구리 캐릭터와 '내일부터 시작되는 실손 50% 할인'"),
    card("silson-switch", 2, "대상 — 2013년 3월 이전 계약", "낡은 증권 한 권을 두 손으로 든 캐릭터와 '2013년 3월 이전 1·2세대 실손'"),
    card("silson-switch", 3, "함정 1 — 병원 이용이 많다면 자기부담률", "병원 모형과 저금통을 저울에 올려 견주는 캐릭터와 '병원 자주 간다면 먼저 따져야 해요'"),
    card("silson-switch", 4, "함정 2 — 철회·해지는 1회", "잠긴 유리함 앞에서 황금 티켓 한 장을 든 캐릭터와 '선택형 할인은 철회·해지 1회'"),
    card("silson-switch", 5, "함정 3 — 기존 계약을 해지하면 할인 종료", "가위를 든 캐릭터와 '전환 전 6개월 기존 계약 해지하면'"),
    card("silson-switch", 6, "클로징 — 가입일과 병원 이용 빈도부터", "증권을 돋보기로 들여다보는 캐릭터와 '숫자보다 증권을 먼저 펼쳐 보세요'"),
  ],
};

/** H. 은퇴 첫 5년 순서 위험 — STEP 4 4-1강 (v8.4.0) */
const SET_RETIRE_DRAW: LessonCardSet = {
  id: "retire-drawdown-hand",
  title: "은퇴 첫 5년의 순서 위험 — 같은 수익률, 인출 순서가 만든 차이",
  meta: "손글씨 카드 6장 · 3억 · 연 1,500만 · 순서 비교",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("retire-drawdown", 1, "표지 — 은퇴 첫 5년, 같은 수익률도 순서가 결과를 가른다", "회색 두 개와 노란 세 개로 놓인 징검다리를 동전 바구니를 들고 건너는 마스코트, '같은 수익률도 순서가 갈립니다'"),
    card("retire-drawdown", 2, "오해 vs 팩트 — 평균이 같으면 같다? / 인출이 있으면 순서가 결과를 바꾼다", "왼쪽은 같은 동전 더미 둘을 비교하며 갸우뚱하는 마스코트, 오른쪽은 내려갔다 오르는 선을 그린 종이를 든 마스코트"),
    card("retire-drawdown", 3, "① 3억·연 1,500만 인출 — 5개 수익률을 순서만 바꾸면 4,547만 원 차이", "막대 두 개와 달력, 지갑을 든 마스코트, '하락 먼저 1억 6,760만 / 상승 먼저 2억 1,307만' 비교표"),
    card("retire-drawdown", 4, "② 현금 버퍼 — 생활비 2년치는 현금으로, 하락장에도 투자를 팔지 않기", "골짜기 위 다리에 늘어놓은 자루와 우산, 자루를 들고 다리를 건너는 마스코트"),
    card("retire-drawdown", 5, "③ 사적연금 1,500만(세금)과 소득 합계 2,000만(건보료)은 다른 제도", "높이가 다른 두 팻말 사이에서 연필을 든 마스코트, '사적연금 1,500만 / 소득 합계 2,000만' 구분표"),
    card("retire-drawdown", 6, "요약 — 은퇴 첫 5년 3줄 점검", "클립보드와 안락의자에 앉은 마스코트, 은퇴 첫 5년 3줄 점검"),
  ],
};

export const cardSetById = (id: string): LessonCardSet | undefined =>
  [
    SET_THREE_BUCKETS,
    SET_TAX_MOMENTS,
    SET_ACCOUNT_ORDER,
    SET_ISA_BASICS,
    SET_DRAWDOWN,
    SET_ETF_NUMBERS,
    SET_REBALANCE,
    SET_SILSON,
    SET_RETIRE_DRAW,
  ].find(
    (s) => s.id === id,
  );

/* ------------------------------------------------------------------
   1-1강 — 월급이 들어오면 가장 먼저 나눌 3개의 통장
   ------------------------------------------------------------------ */
const SPARE = 150; // 월 남는 돈(만원)
const LIVING = 250; // 월 생활비(만원)
const E3 = LIVING * 3; // 750
const E6 = LIVING * 6; // 1500
const BUCKET_A = Math.round(SPARE * 0.5); // 75
const BUCKET_B = Math.round(SPARE * 0.2); // 30
const BUCKET_C = SPARE - BUCKET_A - BUCKET_B; // 45

const N11 = {
  income: manLabel(400),
  fixed: manLabel(160),
  variable: manLabel(90),
  living: manLabel(LIVING),
  spare: manLabel(SPARE),
  emergency3: manLabel(E3),
  emergency6: manLabel(E6),
  bucketA: manLabel(BUCKET_A),
  bucketB: manLabel(BUCKET_B),
  bucketC: manLabel(BUCKET_C),
  months3: `${Math.ceil(E3 / BUCKET_A)}개월`,
  months6: `${Math.ceil(E6 / BUCKET_A)}개월`,
  yearlyC: manLabel(BUCKET_C * 12),
  tenYearC: manLabel(BUCKET_C * 120),
};

const READING_11: ReadingSection[] = [
  {
    h: "월급날, 무엇부터 하나",
    ps: [
      `월급이 들어오면 무엇부터 해야 할까요? 결론은 '통장을 세 칸으로 나누고 그날 바로 옮긴다'입니다. 남는 돈을 세어 나누는 것이 아니라, 먼저 나눠 두고 남은 돈으로 사는 순서입니다. 순서가 바뀌면 같은 월급에서 남는 돈이 0원이 됩니다.`,
      `세 칸은 이렇게 나뉩니다. ① 비상금은 일이 끊겨도 생활비 몇 달을 버티는 돈, ② 단기목표는 1~3년 안에 쓸 돈, ③ 장기투자는 5년 넘게 묶어 둘 돈입니다. ①이 비어 있으면 ③에 넣은 돈을 급할 때 깨게 되고, 그때는 세금과 손실이 함께 옵니다.`,
      `통을 나누는 이유는 의지가 아니라 구조 때문입니다. 한 통에 다 들어 있으면 남는 돈은 마음에 따라 달라지지만, 통이 나뉘어 있으면 남는 돈은 이미 정해져 있습니다. 쓰는 사람의 결심이 아니라 계좌가 순서를 지켜 주는 쪽이 오래갑니다.`,
    ],
  },
  {
    h: "내 숫자로 계산하면",
    ps: [
      `월 소득 ${N11.income}, 고정비 ${N11.fixed}, 변동비 ${N11.variable}인 사람을 예로 듭니다. 생활비는 둘을 더한 ${N11.living}, 남는 돈은 ${N11.spare}입니다. 이 돈을 50%·20%·30%로 나누면 비상금 ${N11.bucketA}, 단기목표 ${N11.bucketB}, 장기투자 ${N11.bucketC}입니다.`,
      `비상금 목표는 생활비의 3개월 ${N11.emergency3}, 6개월 ${N11.emergency6}입니다. 매달 ${N11.bucketA}씩 넣으면 3개월분은 ${N11.months3}, 6개월분은 ${N11.months6}이 걸립니다. 오래 걸린다고 실패가 아닙니다. 채울 때까지 ③을 0원으로 두는 것도 같은 계산 안의 선택입니다.`,
    ],
  },
  {
    h: "3~6개월은 법이 아니라 기준입니다",
    ps: [
      `3~6개월은 법으로 정해진 숫자가 아니라 통상 기준입니다. 소득이 한 곳이고 부양가족이 있으면 6개월, 맞벌이처럼 소득이 두 갈래면 3개월로 잡습니다. 어느 쪽이든 '내 숫자로 정해 두는 것'이 핵심입니다. 목표가 없으면 비상금은 영원히 모자랍니다.`,
      `생활비에 무엇을 넣을지도 정해야 합니다. 월세·관리비·통신·보험료 같은 고정비와 식비·교통비 같은 변동비를 더한 값이 이 글의 ${N11.living}입니다. 카드 대금과 학원비처럼 달마다 달라지는 항목은 최근 3개월 평균으로 넣습니다. 넉넉하게 잡으면 비상금 목표가 커져 시작을 미루게 되고, 빡빡하게 잡으면 막상 급할 때 모자랍니다.`,
      `자동이체를 세 줄로 걸어 두면 이 구조는 매달 반복됩니다. 월급날 다음 날 ① ${N11.bucketA}, ② ${N11.bucketB}, ③ ${N11.bucketC}이 각각 나가고, 통장에 남는 돈은 생활비와 여윳돈뿐입니다. 남는 돈을 세는 일이 사라집니다.`,
    ],
  },
  {
    h: "예외 — 순서가 뒤집히는 두 경우",
    ps: [
      `금리가 높은 빚이 남아 있다면 순서가 바뀝니다. 신용대출·카드 할부는 비상금보다 먼저 갚는 편이 낫습니다. 비상금을 쌓는 동안 빚에 붙는 이자가 더 크기 때문입니다. 반대로 전세자금처럼 날짜가 정해진 큰돈이 2년 안에 필요하면 ②를 ①보다 두껍게 잡아야 합니다.`,
      `또 하나, ③에 넣는 돈은 5년 넘게 기다릴 수 있는 돈이어야 합니다. 1년 안에 쓸 돈을 ③에 넣으면 그 해 하락에서 손실을 확정하게 됩니다. ${N11.bucketC}을 1년 모으면 ${N11.yearlyC}, 10년이면 원금만 ${N11.tenYearC}입니다. 수익률은 넣지 않았습니다. 원금만 세어도 구조는 보입니다.`,
      `마지막으로, 세 칸은 한 번 정하고 끝나지 않습니다. 이사·출산·이직처럼 생활비가 바뀌면 ①의 목표액부터 다시 계산합니다. 숫자를 고치지 않은 채 몇 년이 지나면, 비상금은 늘 모자라고 ③은 늘 부족한 상태가 됩니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `3~6개월이라는 기준은 자체 정리이고, 소득·지출 구조는 통계청 가계금융복지조사에서 확인할 수 있습니다. 숫자의 기준일은 2026. 11. 22.이며, 제도나 생활비가 바뀌면 이 글의 금액도 함께 달라집니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   1-2강 — 비상금 3~6개월, 얼마를 어디에 둘까?
   ------------------------------------------------------------------ */
const DEPOSIT_RATE = 0.03; // 설명용 예시 금리
const INTEREST = Math.round(E6 * 10000 * DEPOSIT_RATE); // 450,000
const INTEREST_TAX = Math.round(INTEREST * INCOME_TAX.dividendWithLocal); // 69,300
const INTEREST_AFTER = INTEREST - INTEREST_TAX;

const N12 = {
  living: manLabel(LIVING),
  emergency3: manLabel(E3),
  emergency6: manLabel(E6),
  monthly: manLabel(BUCKET_A),
  months3: `${Math.ceil(E3 / BUCKET_A)}개월`,
  months6: `${Math.ceil(E6 / BUCKET_A)}개월`,
  depositRate: pct(DEPOSIT_RATE, 0),
  interest: wonLabel(INTEREST),
  interestTax: wonLabel(INTEREST_TAX),
  interestAfter: wonLabel(INTEREST_AFTER),
  dividend: pct(INCOME_TAX.dividendWithLocal),
  financialThreshold: manLabel(INCOME_TAX.financialIncomeThreshold),
};

const READING_12: ReadingSection[] = [
  {
    h: "몇 개월치를, 어디에 두나",
    ps: [
      `비상금은 몇 개월치를 어디에 두어야 할까요? 결론은 '생활비 3~6개월을, 하루 안에 꺼낼 수 있는 곳에'입니다. 비상금은 수익을 만드는 돈이 아니라, 수익을 계속 만들 수 있게 해 주는 돈입니다. 그래서 수익률보다 꺼내는 속도가 먼저입니다.`,
      `생활비 ${N12.living}이면 3개월 ${N12.emergency3}, 6개월 ${N12.emergency6}입니다. 매달 ${N12.monthly}씩 모으면 각각 ${N12.months3}과 ${N12.months6}이 걸립니다. 여기서 흔한 실수가 금리가 조금 더 높은 상품을 찾아 1년 만기 상품에 넣는 것입니다. 만기 전에 꺼내면 약속한 이자를 받지 못합니다.`,
    ],
  },
  {
    h: "세금까지 계산하면",
    ps: [
      `${N12.emergency6}을 연 ${N12.depositRate} 예금에 1년 두면 이자는 ${N12.interest}입니다. 이자에는 ${N12.dividend}(소득세 14%와 지방소득세 1.4%)가 원천징수되어 ${N12.interestTax}이 빠지고, 손에 남는 것은 ${N12.interestAfter}입니다. ${N12.depositRate}는 설명을 위한 예시 금리이고, 실제 금리는 금융감독원 파인에서 확인해야 합니다.`,
      `이자 ${N12.interest}은 금융소득 종합과세 기준(연 ${N12.financialThreshold})에 한참 못 미치므로 원천징수로 끝납니다. 비상금 규모에서는 세금이 결론을 바꾸지 않습니다. 세금을 줄이려고 만기를 늘리는 쪽이 오히려 손해입니다.`,
      `금리를 비교할 때는 숫자 세 개를 같이 봅니다. 기본금리, 우대조건을 채웠을 때의 최고금리, 그리고 만기 전에 꺼낼 때 적용되는 중도해지이율입니다. 세 번째 숫자가 낮은 상품에 비상금을 넣으면, 급한 달에 이자를 거의 받지 못합니다.`,
    ],
  },
  {
    h: "한 통에 다 넣지 않습니다",
    ps: [
      `비상금은 세 층으로 나눠 두면 편합니다. ① 한 달치는 하루 안에 꺼낼 수 있는 통, ② 두 달치는 3개월 만기 상품, ③ 나머지는 6개월 만기 상품입니다. 급할 때 ①만 쓰고 ②③은 만기까지 두는 구조입니다. 상품 이름을 적지 않는 이유는 금리가 매달 바뀌고, 이름보다 '꺼내는 데 걸리는 날'이 중요하기 때문입니다.`,
      `예금은 예금자보호 대상인지, 한도가 얼마인지도 함께 봅니다. 같은 금융회사에 몰아두면 한도에 걸릴 수 있으므로, 한도는 예금보험공사 안내에서 직접 확인합니다. 이 글은 특정 금융회사를 권하지 않습니다.`,
      `나눠 두면 관리도 단순해집니다. 매달 자동이체로 ①에 정한 금액만 넣고, ①이 한 달치를 넘으면 초과분을 ②로 옮깁니다. ②가 가득 차면 ③으로 넘깁니다. 어느 칸이 가득 찼는지 세는 일만 남습니다.`,
    ],
  },
  {
    h: "예외 — 3개월로 줄여도 되는 경우",
    ps: [
      `소득이 두 갈래이고(맞벌이), 부양가족이 없고, 신용대출이 없다면 3개월이면 충분합니다. 줄인 ${manLabel(E6 - E3)}은 단기목표 칸으로 옮깁니다. 반대로 소득이 한 곳이거나 아이가 어리면 6개월을 권합니다. 병원비·이사·실직이 겹치는 시기를 버티는 힘이 비상금입니다.`,
      `비상금을 다 채운 뒤에는 늘리지 않습니다. 6개월치를 넘겨 쌓아 두면 그 돈은 ③ 장기투자 칸에서 일할 수 있었던 돈입니다. 채우면 멈추고, 다음 칸으로 넘어가는 것이 이 구조의 규칙입니다.`,
      `비상금을 쓴 달에는 다음 달에 다시 채우는 순서를 정해 둡니다. ①부터 채우고, ①이 차면 ②로 갑니다. 이 순서를 적어 두지 않으면 한 번 쓴 비상금은 몇 년째 비어 있게 됩니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 이자 원천징수는 소득세법 제129조, 예금자보호는 예금보험공사 안내를 확인했습니다. 3~6개월이라는 개월 수는 자체 기준입니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   2-1강 — 연봉 5,500만 원 기준, 계좌 채우는 1·2·3순위
   ------------------------------------------------------------------ */
const CREDIT_LOW = creditWon(PENSION_ACCOUNT.combinedLimit, PENSION_ACCOUNT.creditRateLow); // 1,485,000
const CREDIT_HIGH = creditWon(PENSION_ACCOUNT.combinedLimit, PENSION_ACCOUNT.creditRateHigh); // 1,188,000
const SAV = PENSION_ACCOUNT.savingsLimit;
const COMBO = PENSION_ACCOUNT.combinedLimit;
const IRP_EXTRA = COMBO - SAV; // 300

const N21 = {
  salary: manLabel(PENSION_ACCOUNT.salaryThreshold),
  savingsLimit: manLabel(SAV),
  irpLimit: manLabel(IRP_EXTRA),
  combinedLimit: manLabel(COMBO),
  credit: wonLabel(CREDIT_LOW),
  creditHigh: wonLabel(CREDIT_HIGH),
  creditGap: wonLabel(CREDIT_LOW - CREDIT_HIGH),
  rateLow: pct(PENSION_ACCOUNT.creditRateLow),
  rateHigh: pct(PENSION_ACCOUNT.creditRateHigh),
  monthly: manLabel(Math.round(COMBO / 12)),
  monthlySavings: manLabel(Math.round(SAV / 12)),
  monthlyIrp: manLabel(Math.round(IRP_EXTRA / 12)),
  isaExempt: manLabel(ISA.exemptGeneral),
  isaExemptSeomin: manLabel(ISA.exemptSeomin),
  isaRate: pct(ISA.taxRate),
  isaYears: `${ISA.minYears}년`,
  dividend: pct(INCOME_TAX.dividendWithLocal),
};

const READING_21: ReadingSection[] = [
  {
    h: "무엇부터 채우나",
    ps: [
      `연봉 ${N21.salary}, 계좌는 여러 개인데 무엇부터 채워야 할까요? 결론은 '비상금을 채운 뒤 연금저축 ${N21.savingsLimit} → IRP ${N21.irpLimit} → ISA → 일반계좌' 순서입니다. 앞의 두 계좌를 합쳐 ${N21.combinedLimit}을 넣으면 세금에서 ${N21.credit}이 돌아옵니다.`,
      `순서의 근거는 '넣을 때 돌려받는 비율'입니다. 연금계좌는 총급여 ${N21.salary} 이하에서 ${N21.rateLow}를 돌려받습니다. ISA는 비과세 ${N21.isaExempt}(서민형 ${N21.isaExemptSeomin})을 넘는 수익에 ${N21.isaRate}만 냅니다. 일반계좌는 이자·배당에 ${N21.dividend}를 냅니다. 같은 돈이라도 이 순서대로 효율이 떨어집니다.`,
      `두 이름은 이렇게 풀어 둡니다. IRP(개인형 퇴직연금 — 퇴직금과 따로 넣은 돈을 모아 연금으로 받는 계좌)와 ISA(개인종합자산관리계좌 — 3년 만기로 묶는 대신 비과세·분리과세 혜택을 주는 계좌)입니다.`,
    ],
  },
  {
    h: "1순위 — 연금저축, 월 50만 원",
    ps: [
      `${N21.combinedLimit}을 12개월로 나누면 매달 ${N21.monthly}입니다. 연금저축 ${N21.monthlySavings}, IRP ${N21.monthlyIrp}입니다. 연금저축은 직장이 없어도 만들 수 있고, IRP는 퇴직금을 받는 그릇이기도 합니다. 두 계좌를 합쳐 ${N21.combinedLimit}까지 공제되므로 한쪽만 채우면 한도가 남습니다.`,
      `이 순서 전에 비상금이 있습니다. 생활비 3~6개월이 비어 있으면 연금계좌에 넣은 돈을 급할 때 깨게 되고, 그때는 돌려받은 ${N21.credit}을 그대로 다시 냅니다. 그래서 비상금이 0순위, 연금저축이 1순위입니다.`,
      `두 계좌의 인출 제약도 다릅니다. IRP는 법에서 정한 사유가 아니면 중간에 꺼낼 수 없고, 연금저축은 55세 전 인출에 세금이 붙지만 길이 열려 있습니다. 비슷해 보이는 두 계좌 중 제약이 큰 쪽을 나중에 두는 편이 안전합니다.`,
    ],
  },
  {
    h: "2·3순위 — IRP 다음 ISA, 그다음 일반계좌",
    ps: [
      `${N21.combinedLimit}을 채운 다음 돈이 ISA로 갑니다. ISA는 ${N21.isaYears} 동안 묶는 대신 비과세 ${N21.isaExempt}과 ${N21.isaRate} 분리과세를 줍니다. ${N21.isaYears}을 못 채우면 혜택이 줄어들므로, 2년 뒤 전세자금처럼 곧 쓸 돈은 ISA보다 예·적금이 낫습니다.`,
      `마지막이 일반계좌입니다. 언제든 꺼낼 수 있지만 세금은 ${N21.dividend}로 가장 높습니다. 순서를 지키면 같은 1,000만원이라도 세금이 적게 떼이는 자리에 앉게 됩니다. 반대로 순서를 무시하면 세금을 한 번 더 내고, 한도를 놓친 해는 되돌릴 수 없습니다.`,
    ],
  },
  {
    h: "예외 — 순서가 흔들리는 세 경우",
    ps: [
      `총급여가 ${N21.salary}을 넘으면 공제율이 ${N21.rateHigh}로 내려가 ${N21.combinedLimit}을 채워도 ${N21.creditHigh}입니다. 차이는 ${N21.creditGap}이지만 0원보다는 크므로 순서는 그대로입니다. 2년 안에 큰돈이 필요하면 연금계좌는 1순위가 아닙니다. 세액공제는 낼 세금이 있어야 효과가 있습니다. 소득이 적은 해에는 돌려받는 금액도 작아집니다.`,
      `그래서 계좌 순서는 '올해 내 소득'과 '이 돈을 언제 쓸 수 있는지' 두 가지로 정합니다. 순서를 외우는 것보다 이 두 질문에 답하는 편이 오래갑니다.`,
      `마감도 함께 봅니다. 세액공제는 12월 31일까지 입금된 금액으로 계산하므로, 11월에 순서를 정해 두면 12월에 몰아 넣는 일이 줄어듭니다. 자동이체로 매달 ${N21.monthly}씩 나가면 마감일을 잊을 일도 없습니다. 한 해를 놓치면 그해 한도는 사라집니다. 다음 해에 자동이체 금액을 올려 채우는 편이 낫습니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 연금계좌 세액공제는 소득세법 제${"59"}조의3, ISA는 조세특례제한법 제91조의18입니다. 한도와 세율이 바뀌면 이 글의 금액도 다시 계산합니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   2-2강 — ISA 일반형·서민형, 3년 만기 전 꼭 볼 숫자
   ------------------------------------------------------------------ */
const ISA_SAVE_GENERAL = creditWon(ISA.exemptGeneral, INCOME_TAX.dividendWithLocal); // 308,000
const ISA_SAVE_SEOMIN = creditWon(ISA.exemptSeomin, INCOME_TAX.dividendWithLocal); // 616,000
const ISA_TRANSFER_CREDIT = creditWon(PENSION_ACCOUNT.isaTransferMax, PENSION_ACCOUNT.creditRateLow); // 495,000

const N22 = {
  exemptGeneral: manLabel(ISA.exemptGeneral),
  exemptSeomin: manLabel(ISA.exemptSeomin),
  isaRate: pct(ISA.taxRate),
  dividend: pct(INCOME_TAX.dividendWithLocal),
  years: `${ISA.minYears}년`,
  saveGeneral: wonLabel(ISA_SAVE_GENERAL),
  saveSeomin: wonLabel(ISA_SAVE_SEOMIN),
  transferMax: manLabel(PENSION_ACCOUNT.isaTransferMax),
  transferRate: pct(PENSION_ACCOUNT.isaTransferRate, 0),
  transferCredit: wonLabel(ISA_TRANSFER_CREDIT),
  combined: wonLabel(ISA_SAVE_GENERAL + ISA_TRANSFER_CREDIT),
  creditRate: pct(PENSION_ACCOUNT.creditRateLow),
  savingsLimit: manLabel(SAV),
};

const READING_22: ReadingSection[] = [
  {
    h: "ISA에서 봐야 할 세 숫자",
    ps: [
      `ISA는 무엇이 좋고, ${N22.years}을 못 채우면 무엇을 잃을까요? 결론은 '비과세 ${N22.exemptGeneral}(서민형 ${N22.exemptSeomin}), ${N22.isaRate} 분리과세, 만기 전 연금계좌 전환 ${N22.transferMax}' 세 가지입니다. 이 셋을 다 쓰면 같은 수익이라도 세금이 크게 줄어듭니다.`,
      `일반계좌에서 ${N22.exemptGeneral} 수익이 나면 ${N22.dividend}인 ${N22.saveGeneral}을 냅니다. ISA 일반형은 이 금액이 비과세라 0원입니다. 서민형은 ${N22.exemptSeomin}까지 비과세이므로 ${N22.saveSeomin}이 남습니다. 넘는 수익에는 ${N22.isaRate}만 붙습니다.`,
    ],
  },
  {
    h: "손익통산이 막는 것",
    ps: [
      `ISA 안에서는 이익과 손실을 합쳐 순이익에만 과세합니다. 한 종목에서 300만원 벌고 다른 종목에서 200만원 잃었다면, 과세 대상은 500만원이 아니라 100만원입니다. 일반계좌라면 번 돈에만 세금이 붙고, 잃은 돈은 세금을 줄여 주지 않습니다. 손실이 난 해에 세금이 아프지 않은 이유입니다.`,
      `수익이 비과세 한도 안에만 있으면 세금은 0원입니다. 한도를 넘길 때 이 장치가 실제로 돈을 지킵니다. 이익과 손실이 같은 해에 겹치는 사람에게 손익통산은 세금을 줄여 주는 유일한 장치입니다.`,
      `납입한도도 함께 봅니다. ISA는 해마다 넣을 수 있는 금액과 계좌 전체에서 넣을 수 있는 금액이 따로 있습니다. 올해 남은 한도를 넘겨 넣으면 그 초과분은 혜택을 받지 못하므로, 연말에 한 번 확인합니다.`,
    ],
  },
  {
    h: "3년을 못 채우면",
    ps: [
      `의무가입 기간은 ${N22.years}입니다. 채우지 못하고 해지하면 비과세·분리과세 혜택이 사라지고, 그동안의 수익이 일반과세(${N22.dividend})로 돌아갑니다. 원금이 사라지는 것은 아니지만 받았어야 할 혜택을 반납하는 셈입니다. 그래서 2~3년 안에 쓸 돈은 ISA에 넣지 않습니다.`,
      `서민형은 소득 요건을 함께 봅니다. 직전 과세기간 총급여가 5,000만원 이하이거나 종합소득금액이 3,800만원 이하이면 대상이 됩니다. 요건은 조문과 국세청 안내에서 확인해야 하고, 요건을 못 채우면 일반형 ${N22.exemptGeneral}으로 적용됩니다.`,
    ],
  },
  {
    h: "만기 60일, 연금계좌로 옮기면",
    ps: [
      `ISA 만기 자금을 60일 안에 연금저축으로 옮기면, 옮긴 금액의 ${N22.transferRate}·최대 ${N22.transferMax}을 그해 공제 대상 납입액에 더할 수 있습니다. ${N22.transferMax}을 더하면 ${N22.creditRate} 기준 ${N22.transferCredit}을 한 번 더 돌려받습니다. 비과세 ${N22.saveGeneral}과 합치면 ${N22.combined}입니다.`,
      `이 전환은 한도가 아니라 '추가 한도'입니다. 연금저축 단독 한도 ${N22.savingsLimit}은 그대로 있고, 그 위에 만기 자금을 옮긴 만큼 더해집니다. 만기일을 모르고 지나가면 이 ${N22.transferCredit}은 사라집니다.`,
      `ISA는 한 사람에 계좌 하나입니다. 이미 갖고 있다면 새로 만드는 것이 아니라 기존 계좌를 이어 가거나 옮기는 절차를 따릅니다. 갈아타기를 새 가입처럼 생각하면 의무가입 기간이 다시 시작될 수 있으니, 금융회사에 기간이 이어지는지 먼저 확인합니다.`,
      `정리하면 ISA에서 볼 숫자는 비과세 한도, 초과분 세율, 의무가입 기간, 만기 뒤 60일입니다. 네 숫자가 내 소득과 내 일정에 맞을 때만 이 계좌가 이깁니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · ISA는 조세특례제한법 제91조의18, 연금계좌 전환은 소득세법 시행령 제118조의2입니다. 서민형 요건과 납입한도는 개정 논의가 있는 항목이므로 해마다 원문을 다시 확인합니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   2-3강 — 연금저축 600·IRP 900 (v8.0 파일럿을 그대로 옮겨 온 강의)
   ------------------------------------------------------------------ */
const N23 = {
  maxCredit: creditWon(COMBO, PENSION_ACCOUNT.creditRateLow),
  maxCreditLabel: wonLabel(creditWon(COMBO, PENSION_ACCOUNT.creditRateLow)),
  highCredit: creditWon(COMBO, PENSION_ACCOUNT.creditRateHigh),
  highCreditLabel: wonLabel(creditWon(COMBO, PENSION_ACCOUNT.creditRateHigh)),
  savingsOnly: creditWon(SAV, PENSION_ACCOUNT.creditRateLow),
  savingsOnlyLabel: wonLabel(creditWon(SAV, PENSION_ACCOUNT.creditRateLow)),
  irp200: creditWon(800, PENSION_ACCOUNT.creditRateLow),
  irp200Label: wonLabel(creditWon(800, PENSION_ACCOUNT.creditRateLow)),
  monthly30: creditWon(660, PENSION_ACCOUNT.creditRateLow),
  monthly30Label: wonLabel(creditWon(660, PENSION_ACCOUNT.creditRateLow)),
  clawbackLabel: wonLabel(creditWon(COMBO, PENSION_ACCOUNT.earlyWithdrawRateWithLocal)),
  bracketGapLabel: wonLabel(
    creditWon(COMBO, PENSION_ACCOUNT.creditRateLow) - creditWon(COMBO, PENSION_ACCOUNT.creditRateHigh),
  ),
  rateLow: pct(PENSION_ACCOUNT.creditRateLow),
  rateHigh: pct(PENSION_ACCOUNT.creditRateHigh),
  rateDrawUnder70: pct(PRIVATE_PENSION_TAX.rateUnder70),
  rateDraw80: pct(PRIVATE_PENSION_TAX.rate80),
  earlyRate: pct(PENSION_ACCOUNT.earlyWithdrawRateWithLocal),
  savingsLimit: manLabel(SAV),
  combinedLimit: manLabel(COMBO),
};

const READING_23: ReadingSection[] = [
  {
    h: "세 문이 있는 방",
    ps: [
      `연금저축 한 계좌만으로는 ${N23.savingsLimit}까지 공제 대상입니다. 여기에 IRP를 더하면 두 계좌 합계로 ${N23.combinedLimit}까지 늘어납니다. '세액공제'는 낸 세금에서 정해진 비율을 빼 주는 제도입니다. 통장에 현금이 들어오는 것이 아니라, 다음 연말정산에서 낼 세금이 그만큼 줄어듭니다.`,
      `연금계좌는 문이 세 개인 방과 같습니다. 넣을 때는 공제를 받고, 굴릴 때는 세금을 미루고, 꺼낼 때 연금소득세를 냅니다. 넣을 때 받는 공제율은 ${N23.rateLow}, 70세 전에 연금으로 받을 때 내는 세율은 ${N23.rateDrawUnder70}입니다. 두 숫자가 다르다는 점이 이 구조의 핵심입니다.`,
      `두 계좌의 쓰임도 다릅니다. 연금저축은 직장 없이도 만들 수 있고, IRP는 퇴직금을 받는 그릇이기도 합니다. 그래서 한도가 둘로 나뉘어 있습니다.`,
    ],
  },
  {
    h: "공제율은 소득에 따라 둘로 갈립니다",
    ps: [
      `공제율은 총급여 5,500만원을 경계로 갈립니다. 이하이면 ${N23.rateLow}, 넘으면 ${N23.rateHigh}입니다. 둘 다 지방소득세(소득세에 10%를 더 붙이는 지방세)를 포함한 숫자입니다. 그래서 같은 ${N23.combinedLimit}이라도 낮은 구간은 ${N23.maxCreditLabel}, 높은 구간은 ${N23.highCreditLabel}이 됩니다. 차이는 ${N23.bracketGapLabel}입니다.`,
      `그래서 15%와 12%에 각각 1.5%포인트와 1.2%포인트가 붙은 것이 ${N23.rateLow}와 ${N23.rateHigh}입니다.`,
      `공제액은 납입액에 비례합니다. 연금저축만 ${N23.savingsLimit}이면 ${N23.savingsOnlyLabel}, IRP 200만원을 더해 800만원이면 ${N23.irp200Label}입니다.`,
    ],
  },
  {
    h: "내 숫자로 바꾸면",
    ps: [
      `예를 들어 총급여 4,800만원인 사람이 연금저축 600만원, IRP 300만원을 넣으면 공제액은 ${N23.maxCreditLabel}입니다. 여기서 IRP를 200만원으로 줄이면 ${N23.irp200Label}으로 내려갑니다. 100만원을 덜 넣어 16만 5,000원을 포기하는 셈입니다.`,
      `월 30만원을 연금저축에 넣으면 1년에 360만원입니다. 여기에 IRP 300만원을 더한 660만원이면 공제액은 ${N23.monthly30Label}입니다. 한도를 다 채우지 않아도 돌아오는 돈은 비례해서 늘어납니다.`,
    ],
  },
  {
    h: "받을 때는 세율이 내려갑니다",
    ps: [
      `55세 이후 연금으로 받으면 연금소득세는 70세 전 ${N23.rateDrawUnder70}, 80세 이상 ${N23.rateDraw80}입니다. 오래 들고 갈수록 세율이 낮아집니다. 연금으로 인정받으려면 55세 이후여야 하고, 연금저축은 가입 기간 5년도 채워야 합니다. 그래서 이 계좌는 세금을 안 내는 계좌가 아니라, 세금을 나중에 더 낮게 내는 계좌입니다.`,
    ],
  },
  {
    h: "예외 — 중간에 깨면 계산이 뒤집힙니다",
    ps: [
      `55세 전에 해지해 연금이 아닌 방식으로 찾으면, 공제받은 ${N23.combinedLimit}에 기타소득세 ${N23.earlyRate}가 다시 붙습니다. 돌려받은 ${N23.maxCreditLabel}을 그대로 다시 내는 셈입니다. 2년 뒤 전세 자금처럼 곧 쓸 돈은 연금계좌가 아니라 다른 계좌에 두어야 합니다.`,
      `또 하나, 세액공제는 결정세액(한 해 낼 세금을 공제까지 반영해 최종 확정한 금액)을 넘을 수 없습니다. 소득이 적어 낼 세금이 작으면 돌려받는 금액도 그만큼 작아집니다. 한도는 목표가 아니라 상한입니다.`,
      `한도를 넘겨 넣은 금액은 그해 공제되지 않습니다. 다음 해로 넘겨 공제받는 절차가 따로 있습니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `근거는 소득세법 제59조의3입니다. 숫자의 기준일은 2026. 11. 22.이고, 제도가 바뀌면 이 글의 금액도 함께 달라집니다. 아래 1차 출처에서 직접 확인해 보세요.`,
    ],
  },
];

/* ------------------------------------------------------------------
   3-1강 — 반 토막이면 두 배, 낙폭과 회복 (v8.3.0)
   · 회복률 = 1 ÷ (1 − 낙폭) − 1. 전망이 아니라 산술 조건이다.
   ------------------------------------------------------------------ */
const BASE_INVEST = 1000; // 설명용 투자금(만원)
const recoveryRate = (dd: number) => 1 / (1 - dd) - 1;
const DD10 = recoveryRate(0.1);
const DD20 = recoveryRate(0.2);
const DD30 = recoveryRate(0.3);
const DD50 = recoveryRate(0.5);
const afterLoss = (dd: number) => Math.round(BASE_INVEST * (1 - dd));
const roundTrip = 1.5 * 0.5 - 1; // +50% 뒤 −50%
const twiceHalf = 0.5 * 0.5; // −50%가 두 번

const N31 = {
  base: manLabel(BASE_INVEST),
  d10: pct(0.1, 0),
  d20: pct(0.2, 0),
  d30: pct(0.3, 0),
  d50: pct(0.5, 0),
  rec10: pct(DD10),
  rec20: pct(DD20),
  rec30: pct(DD30),
  rec50: pct(DD50),
  left20: manLabel(afterLoss(0.2)),
  left30: manLabel(afterLoss(0.3)),
  left50: manLabel(afterLoss(0.5)),
  halfBack: manLabel(Math.round(afterLoss(0.5) * 1.5)),
  roundTrip: pct(roundTrip),
  twiceHalf: pct(twiceHalf, 0),
  loss75: pct(1 - twiceHalf, 0),
  rec300: pct(1 / twiceHalf - 1, 0),
  loss20after20: pct(0.8 * 1.2 - 1),
  years: "7년",
};

const READING_31: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `반 토막이 나면 본전까지 두 배가 필요합니다. ${N31.base}이 ${N31.d50} 빠져 ${N31.left50}이 되고, 그 ${N31.left50}이 다시 ${N31.base}이 되려면 ${N31.rec50}가 있어야 합니다. 낙폭과 회복은 같은 크기의 반대말이 아닙니다.`,
      `계산은 한 줄입니다. 회복에 필요한 상승률은 1 ÷ (1 − 낙폭) − 1입니다. ${N31.d10}이면 ${N31.rec10}, ${N31.d20}이면 ${N31.rec20}, ${N31.d30}이면 ${N31.rec30}, ${N31.d50}이면 ${N31.rec50}입니다. 낙폭이 커질수록 필요한 상승률은 가파르게 커집니다.`,
      `그래서 손실을 줄이는 일이 수익률을 조금 더 올리는 일보다 먼저입니다. ${N31.rec30}의 상승을 기다리는 대신 그 하락을 피하면, 같은 돈으로 더 짧은 시간에 본전에 돌아옵니다. 낙폭을 줄이는 결정은 수익률을 고르는 일보다 단순하고, 효과는 더 오래갑니다.`,
      `이 글의 숫자는 모두 같은 투자금 ${N31.base}에서 출발했습니다. 금액이 달라도 비율은 같으므로, 내 통장 숫자에 대입해 같은 방식으로 계산할 수 있습니다.`,
    ],
  },
  {
    h: "기준이 작아지기 때문입니다",
    ps: [
      `왜 이런 차이가 생길까요. 수익률은 늘 '지금 있는 돈'을 기준으로 계산하기 때문입니다. ${N31.base}에서 ${N31.d50}를 잃으면 기준이 ${N31.left50}으로 바뀌고, 그 ${N31.left50}에 ${N31.d50}를 더해도 ${N31.halfBack}입니다. 원래 금액의 75%입니다.`,
      `흔한 착각이 '50% 빠졌으니 50% 오르면 본전'입니다. 빠질 때의 기준과 오를 때의 기준이 다르므로 두 비율은 서로 상쇄되지 않습니다. ${N31.d20} 뒤 ${N31.d20} 상승은 0.8 × 1.2 = 0.96, 즉 ${N31.loss20after20} 손실입니다.`,
      `같은 이유로 ${N31.d50}가 두 번 오면 0.5 × 0.5 = ${N31.twiceHalf}, ${N31.loss75}가 사라집니다. 이때 본전까지는 ${N31.rec300}가 필요합니다. 손실이 반복될수록 회복은 산술적으로 더 멀어집니다.`,
    ],
  },
  {
    h: "내 숫자로 옮기면",
    ps: [
      `${N31.base}을 굴린다고 해 봅니다. ${N31.d20} 하락이면 ${N31.left20}, 본전까지 ${N31.rec20}입니다. ${N31.d30}이면 ${N31.left30}, ${N31.rec30}입니다. ${N31.d50}이면 ${N31.left50}, ${N31.rec50}입니다. 같은 ${N31.base}인데 필요한 상승률이 ${N31.rec20}에서 ${N31.rec50}로 벌어집니다.`,
      `손실을 만회하는 동안에도 시간은 흐릅니다. ${N31.rec50}를 만드는 데 ${N31.years}이 걸리면 그 기간은 수익이 아니라 회복에 쓴 시간입니다. 기회비용까지 더하면 반 토막의 실제 비용은 숫자보다 큽니다.`,
      `그래서 '얼마를 벌 것인가'보다 '얼마까지 잃을 것인가'를 먼저 정합니다. 손실 한도를 ${N31.d20}로 정해 두면 그 지점에서 비중을 줄이는 규칙을 미리 세울 수 있습니다.`,
    ],
  },
  {
    h: "변동성 끌림과 두 장치",
    ps: [
      `오르내림이 반복되면 산술평균보다 실제 결과가 낮아집니다. +50%와 ${N31.d50}를 한 번씩 겪으면 1.5 × 0.5 = 0.75, ${N31.roundTrip}입니다. 두 해의 평균 수익률은 0%인데 통장은 줄어 있습니다. 이것을 변동성 끌림이라고 부릅니다.`,
      `그래서 수익률이 같은 두 상품도 오르내림이 크면 결과가 다릅니다. 광고에 적힌 평균 수익률만 보면 이 차이를 알 수 없습니다. 최근 몇 해의 최대 낙폭을 함께 봐야 합니다.`,
      `낙폭을 줄이는 장치는 두 가지입니다. 자산을 나눠 담는 분산과, 급할 때 꺼낼 현금 비중입니다. 현금은 수익이 0에 가깝지만, 하락장에서 강제 매도를 막아 회복할 시간을 벌어 줍니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `회복률 공식은 자체 정리이고 수익률 전망이 아니라 산술 조건입니다. 펀드·ETF의 기준가와 수익률은 금융투자협회 전자공시에서, 위험 등급과 투자설명서는 금융감독원 파인에서 확인합니다. 숫자의 기준일은 2026. 11. 22.입니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   3-2강 — 지수 ETF, 이름 말고 6개 숫자부터 (v8.3.0)
   · 10년 비용은 단순 합계다(복리 미반영). 비용률은 화면과 글에서 같은 상수로 만든다.
   ------------------------------------------------------------------ */
const ETF_FEE = { low: 0.0005, mid: 0.0015, high: 0.0045, other: 0.0002 } as const;
const ETF_BASE = 1000; // 10년 둘 금액(만원)
const etfCost = (fee: number) => Math.round(ETF_BASE * (fee + ETF_FEE.other) * 10);

const N32 = {
  base: manLabel(ETF_BASE),
  feeLow: pct(ETF_FEE.low, 2),
  feeMid: pct(ETF_FEE.mid, 2),
  feeHigh: pct(ETF_FEE.high, 2),
  other: pct(ETF_FEE.other, 2),
  costLow: manLabel(etfCost(ETF_FEE.low)),
  costMid: manLabel(etfCost(ETF_FEE.mid)),
  costHigh: manLabel(etfCost(ETF_FEE.high)),
  gap: manLabel(etfCost(ETF_FEE.high) - etfCost(ETF_FEE.low)),
  years: "10년",
  tracking: pct(0.0025, 2),
  premium: pct(0.005, 1),
  hedgeCost: pct(0.001, 1),
};

const READING_32: ReadingSection[] = [
  {
    h: "이름보다 여섯 숫자",
    ps: [
      `지수 ETF를 고를 때 이름과 브랜드보다 먼저 볼 것은 여섯 숫자입니다. 총보수, 기타비용, 추적오차, 괴리율, 분배금, 그리고 거래량과 순자산입니다. 환헤지 여부는 그다음에 붙입니다.`,
      `결론부터 말하면 실제로 내는 비용은 총보수에 기타비용을 더한 값입니다. 총보수만 보면 싸 보이는 상품도 기타비용을 더하면 순서가 바뀝니다. 두 숫자는 같은 문서에 나란히 적혀 있습니다.`,
      `여섯 숫자는 모두 운용보고서·투자설명서·거래소 공시에서 확인할 수 있습니다. 반면 광고 문구에는 이 숫자가 빠져 있는 경우가 많습니다.`,
    ],
  },
  {
    h: "10년이면 얼마가 나가나",
    ps: [
      `${N32.base}을 ${N32.years} 둔다고 해 봅니다. 총보수 ${N32.feeLow}에 기타비용 ${N32.other}를 더하면 연 ${pct(ETF_FEE.low + ETF_FEE.other, 2)}이고, ${N32.years} 단순 합계로 ${N32.costLow}입니다. 총보수 ${N32.feeHigh}인 상품은 ${N32.costHigh}입니다.`,
      `차이는 ${N32.gap}입니다. 수익률이 같다면 이 차이는 그대로 남습니다. 비용은 정해진 만큼 나가고 수익은 정해져 있지 않기 때문에, 비용은 비교적 확실한 기준입니다. 같은 지수 안에서 고민된다면 비용부터 비교해 두는 편이 낫습니다.`,
      `총보수는 운용사가 받는 몫이고 기타비용은 지수 사용료·감사·결제 같은 부대비용입니다. 매매중개수수료는 운용 방식에 따라 달라 별도로 봅니다. 위 계산은 단순 합계이고 복리는 넣지 않았습니다.`,
      `비용률은 소수점 둘째 자리에서 갈리는 경우가 많습니다. ${N32.feeLow}와 ${N32.feeMid}의 차이는 작아 보이지만, 금액이 커지고 기간이 길어지면 같은 비율로 커집니다.`,
    ],
  },
  {
    h: "추적오차와 괴리율",
    ps: [
      `추적오차는 ETF가 기초지수를 얼마나 잘 따라가는지를 나타냅니다. 작을수록 지수와 가깝습니다. 여기서는 ${N32.tracking} 수준을 예로 듭니다. 값은 운용보고서에 적힌 기간 기준으로 비교해야 하고, 기간이 다르면 나란히 놓을 수 없습니다.`,
      `괴리율은 시장가격과 순자산가치의 차이입니다. 거래가 한산하면 괴리율이 ${N32.premium} 넘게 벌어지기도 합니다. 그 시간대에 사면 같은 상품을 더 비싸게 사는 셈입니다.`,
      `장 시작 직후와 마감 직전은 호가가 벌어지기 쉽습니다. 급하지 않다면 주문 시간을 나눠 보고, 매수 전에 호가와 괴리율을 함께 확인합니다.`,
    ],
  },
  {
    h: "분배금과 유동성",
    ps: [
      `분배금은 ETF가 보유 자산에서 얻은 이자·배당을 투자자에게 나눠 주는 돈입니다. 받으면 수익이 더해지는 것이 아니라 그만큼 기준가격이 내려갑니다. 재투자하지 않으면 복리 효과는 그 자리에서 끊깁니다.`,
      `거래량과 순자산은 유동성의 지표입니다. 거래량이 적으면 사고팔 때 가격이 불리하게 정해질 수 있고, 순자산이 작으면 상장폐지 가능성도 함께 봐야 합니다.`,
      `분배금 지급 주기와 재투자 방식은 상품마다 다릅니다. 같은 지수를 따라가도 내 통장에 남는 금액이 달라지는 이유입니다. 분배금이 많다고 더 좋은 상품이 아니라, 그 돈을 다시 넣었는지가 결과를 가릅니다.`,
      `유동성은 숫자 두 개로만 봐도 충분합니다. 하루 거래대금과 순자산입니다. 둘 다 작은 상품은 급할 때 불리한 가격을 받아들일 수 있습니다.`,
    ],
  },
  {
    h: "환헤지와 출처",
    ps: [
      `같은 지수를 따라가도 환헤지 여부에 따라 결과가 달라집니다. 환헤지 상품은 환율 변동을 줄이는 대신 비용이 ${N32.hedgeCost} 수준 붙고, 비헤지 상품은 환율이 수익률을 흔듭니다. 어느 쪽이 낫다기보다 내가 감당할 수 있는 변동인지의 문제입니다.`,
      `숫자의 기준일은 2026. 11. 22.이고, 총보수·기타비용은 금융투자협회 펀드공시, 거래량·괴리율은 거래소 안내에서 확인했습니다. 이 강의는 특정 종목·운용사를 권하지 않습니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   4-1강 — 은퇴 첫 5년 순서 위험 (v8.4.0)
   · 3억에서 매년 초 1,500만을 빼고, 5개 수익률(평균 0%)을 순서만 바꿔 돌린다.
   · 수익률 전망이 아니라 같은 수익률에서 순서만 바꾼 산술 비교다.
   ------------------------------------------------------------------ */
const DD_START = 30000; // 시작 자산(만원) — 3억
const DD_DRAW = 1500; // 연 인출액(만원)
const DD_SEQ = [-0.3, -0.2, 0.05, 0.2, 0.25] as const;
/** 해마다 초에 인출하고, 남은 돈에 그해 수익률을 곱한다 */
const drawdownRun = (rates: readonly number[]) =>
  Math.round(rates.reduce((v, r) => (v - DD_DRAW) * (1 + r), DD_START));
const RUN_BAD = drawdownRun(DD_SEQ); // 16,760만
const RUN_GOOD = drawdownRun([...DD_SEQ].reverse()); // 21,307만
const RUN_GAP = RUN_GOOD - RUN_BAD; // 4,547만
const RUN_LOW2 = drawdownRun(DD_SEQ.slice(0, 2)); // 13,260만

/** 16,760 → "1억 6,760만원" — 억·만을 함께 쓰는 금액 표기 */
const wonMix = (man: number) => {
  const eok = Math.floor(man / 10000);
  const rest = man % 10000;
  if (!eok) return `${rest.toLocaleString("ko-KR")}만원`;
  return rest ? `${eok}억 ${rest.toLocaleString("ko-KR")}만원` : `${eok}억원`;
};

const N41 = {
  start: wonMix(DD_START),
  draw: manLabel(DD_DRAW),
  seq: "−30% · −20% · +5% · +20% · +25%",
  avg: pct(0, 0),
  bad: wonMix(RUN_BAD),
  good: wonMix(RUN_GOOD),
  gap: wonMix(RUN_GAP),
  low2: wonMix(RUN_LOW2),
  dropFirst: "−30% · −20%",
  riseFirst: "+25% · +20% · +5%",
  years: "5년",
  cash2: wonMix(DD_DRAW * 2),
  privateLimit: `연 ${manLabel(PRIVATE_PENSION_TAX.annualThreshold)}`,
  healthLimit: `연 ${manLabel(PUBLIC_PENSION_HEALTH_LIMIT)}`,
};

const READING_41: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `은퇴 첫 5년에는 같은 수익률도 어떤 순서로 오느냐가 결과를 바꿉니다. ${N41.start}을 두고 해마다 ${N41.draw}을 빼면서 5년 수익률 ${N41.seq}(평균 ${N41.avg})을 순서만 바꿔 돌려 보면, 하락이 먼저 온 쪽은 ${N41.bad}, 상승이 먼저 온 쪽은 ${N41.good}으로 ${N41.gap} 벌어집니다.`,
      `계산은 단순합니다. 해마다 초에 ${N41.draw}을 빼고 남은 돈에 그해 수익률을 곱합니다. 다섯 해를 같은 방식으로 반복하면 위 두 숫자가 나옵니다. 수익률은 같고 순서만 다릅니다.`,
      `이 글의 숫자는 전망이 아니라 산술 조건입니다. 금액이 달라도 원리는 같으므로, 내 통장 숫자에 같은 순서를 대입해 볼 수 있습니다.`,
    ],
  },
  {
    h: "평균이 같으면 같을까",
    ps: [
      `인출(연금계좌에서 생활비로 꺼내는 것)이 없으면 순서는 결과를 바꾸지 않습니다. 곱셈은 순서를 바꿔도 값이 같기 때문입니다. 문제는 중간에 돈을 빼는 순간 생깁니다.`,
      `하락한 해에 같은 금액을 빼려면 더 큰 값을 치릅니다. ${N41.start}이 ${N41.dropFirst}를 지나 ${N41.low2}까지 내려간 뒤에도 ${N41.draw}을 빼야 하므로, 회복할 원금이 그만큼 줄어듭니다.`,
      `반대로 상승이 먼저 오면 원금이 커진 상태에서 하락을 맞습니다. 빼는 금액은 같지만 남는 돈이 달라집니다. 이것을 인출 순서 위험이라고 부릅니다.`,
    ],
  },
  {
    h: "내 숫자로 옮기면",
    ps: [
      `${N41.start}·${N41.draw}·${N41.years}이면 하락 먼저 ${N41.bad}, 상승 먼저 ${N41.good}입니다. 차이 ${N41.gap}은 같은 수익률을 받고도 생긴 금액입니다.`,
      `첫 두 해가 ${N41.dropFirst}이면 잔액은 ${N41.low2}까지 내려갑니다. 그 상태에서 남은 세 해에 ${N41.riseFirst}를 다 받아도 ${N41.bad}에 그칩니다. 반대로 ${N41.riseFirst}가 먼저 오면 같은 하락을 뒤에서 맞고도 ${N41.good}이 남습니다.`,
      `그래서 은퇴 직전에 정할 것은 수익률 목표보다 '하락이 먼저 왔을 때 몇 년을 버틸 수 있는가'입니다. 버틸 수 있는 기간이 길면 수익률을 조금 낮춰도 됩니다.`,
    ],
  },
  {
    h: "현금 버퍼와 두 개의 선",
    ps: [
      `첫 5년을 버티는 장치는 현금입니다. 생활비 2년치인 ${N41.cash2}을 투자 밖에 두면, 하락한 해에 투자를 팔지 않고 그 돈으로 생활합니다. 현금은 수익이 0에 가깝지만 강제 매도를 막아 회복할 시간을 벌어 줍니다.`,
      `버퍼가 줄면 다음 해에 채우고, 늘면 투자로 옮깁니다. 인출액과 생활비가 같다면 버퍼는 '몇 년 치'로만 관리하면 됩니다.`,
      `숫자를 볼 때 두 선을 섞지 않습니다. 사적연금은 ${N41.privateLimit}을 넘으면 과세 방식이 갈리고(소득세법 제20조의3·제64조의4), 건강보험 피부양자 요건은 소득 합계 ${N41.healthLimit}입니다(국민건강보험법 시행규칙). 분리과세는 다른 소득과 합치지 않고 정해진 세율로 끝내는 과세방식입니다. 기준도 목적도 다른 제도입니다.`,
      `사적연금 ${N41.privateLimit}은 연금소득의 과세 기준이고, 소득 합계 ${N41.healthLimit}은 건보료를 내는지 피부양자로 남는지를 가르는 요건입니다. 하나를 넘었다고 다른 하나도 넘은 것이 아닙니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `사적연금 과세 기준은 소득세법 제20조의3·제64조의4, 건강보험 피부양자 소득 요건은 국민건강보험법 시행규칙 별표 1의2에서 확인합니다. 내 연금 예상액은 금융감독원 통합연금포털과 국민연금공단에서 조회할 수 있습니다.`,
      `이 글의 시뮬레이션은 자체 계산이며 수익률 전망이 아닙니다. 요건과 세율은 원문에서 확인하고, 기준일은 2026. 11. 22.입니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   5-1강 — 실손 세대 전환·약관 공백 (v8.4.0)
   · 보험료 예시는 금융위원회 보도자료(2026. 11. 19.)의 손해보험사 6곳 평균(60대 여성) 값이다.
   · 특정 보험사·상품을 권하지 않는다. 할인율·보장은 보험사와 선택 조건에 따라 다르다.
   ------------------------------------------------------------------ */
const SIL_BASE1 = 176982; // 1세대 월 보험료 예시
const SIL_BASE2 = 126773; // 2세대 월 보험료 예시
const SIL_CONV = 21620; // 전환 후 3년간 월 보험료(5세대 보험료의 50%)
const SIL_AFTER3 = 43241; // 3년 뒤 월 보험료
const SIL_SEL1 = 111499; // 선택형 3옵션 모두 — 1세대
const SIL_SEL2 = 92544; // 선택형 3옵션 모두 — 2세대

const N51 = {
  since: "2026년 11월 23일",
  period: "2027년 5월 22일",
  people: "1,630만 명",
  base1: wonLabel(SIL_BASE1),
  base2: wonLabel(SIL_BASE2),
  conv: wonLabel(SIL_CONV),
  after3: wonLabel(SIL_AFTER3),
  gapMonth: wonLabel(SIL_AFTER3 - SIL_CONV),
  save3: wonLabel((SIL_AFTER3 - SIL_CONV) * 36),
  sel1: wonLabel(SIL_SEL1),
  sel2: wonLabel(SIL_SEL2),
  sel1Rate: pct(1 - SIL_SEL1 / SIL_BASE1),
  sel2Rate: pct(1 - SIL_SEL2 / SIL_BASE2),
  halfRate: pct(0.5, 0),
  diskYears: "3년",
  nonSevereLimit: manLabel(1000),
  selfRate: pct(0.5, 0),
  cancelFree: "3개월",
  cancelLimit: "6개월",
  keepMonths: "6개월",
};

const READING_51: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `${N51.since}부터 1·2세대 실손(실손의료보험 — 병원비를 실제로 낸 만큼 돌려받는 보험)을 5세대로 바꾸는 계약전환이 열립니다. 전환하면 ${N51.diskYears} 동안 새로 산출된 5세대 보험료의 ${N51.halfRate}를 깎습니다. 1세대 ${N51.base1} 예시라면 ${N51.diskYears} 동안 ${N51.conv}을 내고, ${N51.diskYears} 뒤부터 ${N51.after3}입니다.`,
      `가장 많이 틀리는 것이 ${N51.halfRate}의 기준입니다. 지금 내는 1·2세대 보험료의 절반이 아니라, 전환 뒤 새로 계산된 5세대 보험료의 절반입니다.`,
      `대상은 2013년 3월 이전에 가입해 재가입 조건이 붙지 않은 계약으로, 금융위원회 기준 약 ${N51.people}입니다. 신청은 ${N51.period}까지입니다.`,
    ],
  },
  {
    h: "3년이 지나면",
    ps: [
      `할인은 ${N51.diskYears}입니다. 비교는 ${N51.diskYears} 뒤 보험료로 다시 해야 합니다. 같은 예시에서 ${N51.diskYears} 뒤 ${N51.after3}은 지금 ${N51.base1}보다 여전히 낮습니다. 5세대 보험료 자체가 4세대보다 낮게 설계되어 있어, 할인이 겹치면 체감 인하 폭이 커집니다.`,
      `${N51.diskYears} 동안 아끼는 금액은 월 차액 ${N51.gapMonth} × 36개월 = ${N51.save3}입니다. 할인이 끝난 뒤의 보험료까지 함께 적어 두어야 판단이 흔들리지 않습니다.`,
      `전환하지 않고 기존 계약을 두고 특약으로 깎는 선택형도 있습니다. 세 옵션을 모두 고르면 1세대 ${N51.sel1}(${N51.sel1Rate} 인하), 2세대 ${N51.sel2}(${N51.sel2Rate} 인하)입니다.`,
    ],
  },
  {
    h: "보장이 바뀌는 지점",
    ps: [
      `전환은 보험료만 바꾸지 않습니다. 보장이 5세대 구조로 바뀌어 비중증 비급여는 연 ${N51.nonSevereLimit} 한도에 자기부담 ${N51.selfRate}가 됩니다. 대신 암·뇌혈관·심장 같은 중증 구간은 유지되거나 두터워집니다.`,
      `그래서 병원을 얼마나 다니는지가 판단을 가릅니다. 도수치료나 비급여 주사를 꾸준히 받아 왔다면, 전환 뒤 같은 치료에 내는 돈이 달라집니다.`,
      `선택형은 반대로 지금 보장을 남기고 고른 항목만 포기합니다. 내가 포기하는 항목의 할인율이 곧 그 항목에 쓰던 돈입니다.`,
    ],
  },
  {
    h: "되돌릴 수 없는 부분",
    ps: [
      `결정 전에 세 가지를 확인합니다. 첫째 청약철회 기간입니다. 전환 뒤 ${N51.cancelFree} 안에는 조건 없이 철회할 수 있고, ${N51.cancelFree}이 지나 ${N51.cancelLimit} 안에는 보험사고가 없을 때만 됩니다.`,
      `둘째는 되돌림의 비용입니다. 철회하면 할인은 다시 받을 수 없고, 할인 없이 다시 전환하려면 심사를 거쳐야 합니다. 선택형 특약은 철회와 해지가 1회뿐입니다.`,
      `셋째는 같은 증권의 다른 담보입니다. 전환 신청 전 ${N51.keepMonths} 안에, 또는 할인 기간 중에 실손 외 담보를 해지하거나 감액하면 할인이 붙지 않거나 끝납니다. 모집인이 먼저 전화해 권하는 아웃바운드 영업도 금지되어 있습니다.`,
      `이 글은 특정 보험사나 상품의 전환을 권하지 않습니다(비권유). 가입 시기별 약관과 부담보(면책) 예외 — 가입 전 진단·치료 이력으로 특정 질병을 보장하지 않는 조건 — 는 내 증권 원문에서 확인해야 합니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `할인율·대상·철회 조건은 금융위원회 보도자료와 제도 Q&A에서 확인했습니다. 시행은 ${N51.since}, 기준일은 2026. 11. 22.입니다.`,
      `보험료 예시는 손해보험사 평균을 든 금융위 자료이며, 실제 금액은 보험사와 선택 조건에 따라 다릅니다. 약관의 지급 기준과 부담보 예외는 내 증권 원문에서 확인합니다.`,
      `확인할 숫자는 네 개입니다 — 내 세대, 비중이 큰 청구 항목, ${N51.diskYears} 뒤 보험료, 철회할 수 있는 기간.`,
    ],
  },
];

/* ------------------------------------------------------------------
   6-1강 — 리밸런싱과 현금 비중 (v8.4.0)
   · 목표금액 = 총자산 × 목표비중. 밴드는 ±5%p, 점검은 연 1회.
   ------------------------------------------------------------------ */
const RB_TOTAL = 1000; // 총자산(만원)
const RB_TARGET = 0.7; // 목표 주식 비중
const RB_BAND = 0.05; // 임계 밴드(±5%p)
const RB_HIGH = 820; // 지금 주식 금액(만원) — 오른 경우
const RB_LOW = 620; // 지금 주식 금액(만원) — 내린 경우
const RB_CASH3 = 250 * 3; // 생활비 3개월
const RB_CASH6 = 250 * 6; // 생활비 6개월
const RB_NEAR = 1200; // 3년 안에 쓸 돈

const N61 = {
  total: manLabel(RB_TOTAL),
  target: pct(RB_TARGET, 0),
  targetAmount: manLabel(Math.round(RB_TOTAL * RB_TARGET)),
  high: manLabel(RB_HIGH),
  trim: manLabel(RB_HIGH - Math.round(RB_TOTAL * RB_TARGET)),
  low: manLabel(RB_LOW),
  fill: manLabel(Math.round(RB_TOTAL * RB_TARGET) - RB_LOW),
  band: `±${pct(RB_BAND, 0)}p`,
  lowBand: pct(RB_TARGET - RB_BAND, 0),
  highBand: pct(RB_TARGET + RB_BAND, 0),
  cash3: manLabel(RB_CASH3),
  cash6: manLabel(RB_CASH6),
  near: manLabel(RB_NEAR),
  once: "연 1회",
  months: "3~6개월",
  years: "3년",
};

const READING_61: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `리밸런싱은 오를 때 덜고 내릴 때 채우는 일입니다. 기준은 감이 아니라 한 줄입니다. 목표금액 = 총자산 × 목표비중. ${N61.total}에서 주식 ${N61.target}를 목표로 두면 목표금액은 ${N61.targetAmount}입니다.`,
      `지금 주식이 ${N61.high}이면 ${N61.trim}을 덜고, ${N61.low}이면 ${N61.fill}을 채웁니다. 오른 자산을 줄이고 덜 오른 자산을 늘리는 것뿐인데, 결과는 한 자산에 쏠린 위험을 줄이는 일입니다.`,
      `수익을 포기하는 것이 아니라 정해 둔 비율로 되돌리는 규칙입니다. 되돌리는 날과 기준을 미리 적어 두면 그날의 기분이 개입할 자리가 줄어듭니다. 규칙은 목표 비중·밴드·점검일 세 줄이면 충분합니다.`,
    ],
  },
  {
    h: "왜 규칙이 필요한가",
    ps: [
      `오르는 자산은 가만히 두어도 비중이 커집니다. 같은 ${N61.total}에서 주식이 오르면 총자산에서 차지하는 몫이 목표보다 커지고, 다음 하락에서 흔들리는 폭도 함께 커집니다.`,
      `오해는 '그냥 두면 알아서 맞춰진다'입니다. 인출과 하락이 겹치면 비중은 반대 방향으로 어긋납니다. 그래서 확인하지 않으면 오차가 쌓입니다.`,
      `목표 비중은 오르내림이 큰 자산일수록 낮게 잡습니다. 감당할 수 있는 하락 폭을 먼저 정하고, 그 폭에서 역산해 비중을 정하는 순서가 안전합니다.`,
      `규칙이 있으면 판단할 것이 줄어듭니다. 오늘 오르내림을 보고 정하는 대신, 정해 둔 날에 숫자만 확인하면 됩니다.`,
    ],
  },
  {
    h: "언제 손대나",
    ps: [
      `점검은 정기와 임계 두 가지로 둡니다. 정기는 ${N61.once}, 임계는 목표에서 ${N61.band} 벗어났을 때입니다. 목표 ${N61.target}라면 ${N61.lowBand}~${N61.highBand}를 밴드로 적습니다.`,
      `점검 날짜를 달력에 먼저 적습니다. 생일이나 연말정산처럼 잊지 않는 날에 붙여 두면 그해 점검은 자동으로 남습니다. 그 사이에는 오르내림이 보여도 손대지 않습니다. 자주 손대면 거래 비용과 세금이 쌓이고, 규칙이 감정으로 바뀝니다.`,
      `맞추는 방법은 세 가지입니다. 오른 자산을 팔아 다른 자산을 사는 매매, 새로 들어온 돈을 덜 채워진 쪽에 넣기, 모아 둔 현금으로 채우기입니다. 매매가 적은 순서대로 비용과 세금도 적습니다.`,
      `새 돈이 들어오면 파는 대신 덜 채워진 쪽에 넣는 방법도 있습니다. 매도 없이 비중을 맞추는 방식이라 비용이 적습니다.`,
    ],
  },
  {
    h: "현금 비중",
    ps: [
      `현금은 수익이 0에 가깝지만 규칙의 일부입니다. 생활비 ${N61.months}치인 ${N61.cash3}에서 ${N61.cash6}를 바로 꺼낼 수 있는 곳에 두고, ${N61.years} 안에 쓸 돈(${N61.near})은 투자 밖에 둡니다.`,
      `하락장에서 현금이 있으면 투자를 팔지 않고 버틸 수 있습니다. 반대로 현금이 바닥이면 가장 싼 값에 파는 일이 생깁니다.`,
      `현금도 비중입니다. 목표 비중에 현금을 넣어 두면, 하락해 주식 비중이 줄었을 때 현금으로 채우는 규칙이 자연스럽게 생깁니다. 현금을 몇 개월 치로 둘지는 소득이 끊겨도 버틸 수 있는 기간에서 정합니다.`,
      `계좌에 따라 비용이 다릅니다. 연금계좌 안에서 비중을 바꾸면 차익에 바로 과세되지 않고 수령할 때 과세되지만, 일반계좌는 매매마다 세금과 수수료가 붙습니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `목표 비중·밴드·현금 ${N61.months}는 자체 정리한 운영 규칙이고, 금액은 가상 예시입니다. 비용은 금융투자협회 펀드공시에서, 지수 등락은 거래소 통계에서 확인합니다.`,
      `이 글은 특정 종목·상품을 권하지 않습니다. 기준일은 2026. 11. 22.입니다.`,
    ],
  },
];

/* ------------------------------------------------------------------
   강의 목록 — 화면 순서가 곧 학습 순서다.
   ------------------------------------------------------------------ */
export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    slug: "step1-three-buckets",
    thesis: `남는 돈 ${N11.spare}을 ① 비상금·② 단기목표·③ 장기투자 세 칸으로 먼저 나누면, 남는 돈을 세는 일 없이 매달 같은 구조가 반복됩니다.`,
    step: 1,
    no: 1,
    label: "1-1강",
    shortTitle: "월급날, 3개의 통",
    title: "월급이 들어오면 가장 먼저 나눌 3개의 통장, 무엇부터 채울까?",
    question: "남는 돈은 어디서 만들어질까",
    readingMinutes: 5,
    hook: `월 소득 ${N11.income}이 같아도, 비상금이 0원인 사람과 6개월치가 있는 사람은 같은 ${N11.bucketC}을 완전히 다르게 씁니다.`,
    fork: {
      short: {
        tag: "비상금이 0원이다",
        head: "오늘은 ① 비상금부터",
        body: `생활비 ${N11.living}이면 3개월 ${N11.emergency3}이 먼저입니다. 비어 있는 채로 ③에 넣으면 급할 때 깨게 되고, 그때는 이자와 손실을 함께 냅니다.`,
        verdict: "1년 동안은 ③을 0원으로 두어도 됩니다.",
      },
      long: {
        tag: "비상금 6개월치가 있다",
        head: "이제 ②③을 채울 차례",
        body: `①이 ${N11.emergency6}을 넘으면 늘리지 않습니다. 넘긴 돈은 ② 단기목표와 ③ 장기투자로 옮겨야 그 돈이 일합니다.`,
        verdict: "이 글의 주제입니다. 아래에서 내 숫자로 나눠 봅니다.",
      },
    },
    keyNumbers: [
      { label: "월 남는 돈", value: N11.spare },
      { label: "비상금 3개월", value: N11.emergency3 },
      { label: "통 ③ 매달", value: N11.bucketC },
    ],
    numbers: N11,
    calculator: {
      name: "투자 복리·세후 수익률 계산기",
      href: "/apps/compound-return/run",
      note: "통 ③에 넣는 돈이 10년 뒤 원금만 얼마인지 확인합니다(수익률은 넣지 않습니다).",
    },
    scenarios: [
      {
        id: "split",
        label: "3통 나누기",
        title: `남는 돈 ${N11.spare}을 50:20:30으로`,
        settings: ["월 소득 400만원", "고정비 160만원 · 변동비 90만원", "남는 돈 150만원"],
        result: `비상금 ${N11.bucketA} · 단기 ${N11.bucketB} · 장기 ${N11.bucketC}`,
        expect: "자동이체 세 줄로 바꾸면 매달 반복됩니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "long",
        label: "통 ③ 10년",
        title: `${N11.bucketC} × 12개월 × 10년 = 원금 ${N11.tenYearC}`,
        settings: ["매달 45만원", "10년 납입", "수익률은 넣지 않음"],
        result: `원금 ${N11.tenYearC}`,
        expect: "계산기에서 수익률을 0%로 두면 원금만 남습니다. 수익률은 내가 넣는 가정입니다.",
      },
      {
        id: "goal6",
        label: "6개월 목표",
        title: `생활비 ${N11.living} × 6 = ${N11.emergency6}`,
        settings: ["생활비 250만원", "매달 비상금 75만원", "목표 1,500만원"],
        result: `${N11.months6}에 도달`,
        expect: "이 기간에는 ③을 0원으로 두는 선택이 계산에 맞습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
    ],
    sources: [
      {
        label: "통계청 — 가계금융복지조사",
        what: "가구의 소득·지출·자산·부채 분포를 보는 국가 통계(생활비 기준을 잡을 때)",
        url: "https://kostat.go.kr/",
        host: "kostat.go.kr",
      },
      {
        label: "금융감독원 파인 — 예금·적금 금리 비교",
        what: "비상금을 둘 자리의 금리를 상품명 없이 비교",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "소득세법 제59조의3 — 연금계좌 세액공제",
        what: "통 ③(5년 이상 묶는 돈)이 절세계좌로 가는 근거",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
    ],
    cardSet: SET_THREE_BUCKETS,
    sheet: {
      variant: "cashflow",
      slotNo: 1,
      slotTitle: "현금흐름표",
      line: "소득·고정비·변동비를 넣어 남는 돈과 비상금 목표를 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "1-2강 · 비상금 3~6개월, 얼마를 어디에 둘까?",
      body: "금액을 정했으니, 이제 그 돈을 둘 자리를 정합니다. 꺼내는 데 걸리는 날과 세후 이자까지 함께 봅니다.",
      href: "/academy/step1-emergency-fund/",
      status: "공개",
    },
    reading: READING_11,
  },
  {
    slug: "step1-emergency-fund",
    thesis: `비상금은 생활비 3개월 ${N12.emergency3}부터 6개월 ${N12.emergency6}까지를, 하루 안에 꺼낼 수 있는 곳에 나눠 두는 것이 기준입니다.`,
    step: 1,
    no: 2,
    label: "1-2강",
    shortTitle: "비상금 3~6개월",
    title: "비상금 3~6개월, 얼마를 어디에 둘까?",
    question: "비상금은 몇 개월치를 어디에 둘까",
    readingMinutes: 5,
    hook: `같은 ${N12.emergency6}이라도 1년 만기 상품에 넣은 사람과 하루 안에 꺼낼 수 있는 곳에 나눠 둔 사람은, 급한 달에 꺼내는 금액이 다릅니다.`,
    fork: {
      short: {
        tag: "소득이 한 곳이다",
        head: "6개월치를 목표로",
        body: `외벌이이거나 부양가족이 있으면 생활비 6개월 ${N12.emergency6}을 기준으로 잡습니다. 실직·병원비가 겹치는 시기를 버티는 힘이 이 돈입니다.`,
        verdict: "6개월 중 1개월은 하루 안에 꺼낼 수 있게 둡니다.",
      },
      long: {
        tag: "맞벌이 · 소득이 두 갈래",
        head: "3개월치로 줄여도 됩니다",
        body: `소득이 두 곳이면 한쪽이 끊겨도 생활이 이어집니다. 3개월 ${N12.emergency3}으로 잡고, 줄어든 ${manLabel(E6 - E3)}은 단기목표 칸으로 옮깁니다.`,
        verdict: "이 글의 주제입니다. 아래에서 세후 이자까지 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "비상금 6개월", value: N12.emergency6 },
      { label: "연 3% 이자", value: N12.interest },
      { label: "세후 이자", value: N12.interestAfter },
    ],
    numbers: N12,
    calculator: {
      name: "비상금 목표 계산기",
      href: "#sheet",
      note: "이 페이지 아래 운영표가 계산기입니다. 생활비·적립액·목표 개월을 넣으면 목표액과 도달 개월, 세후 이자가 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "six",
        label: "6개월",
        title: `생활비 ${N12.living} × 6 = ${N12.emergency6}`,
        settings: ["생활비 250만원", "소득이 한 곳", "매달 75만원 적립"],
        result: `${N12.months6}에 도달`,
        expect: "1개월치는 하루 안에 꺼낼 수 있는 자리에 둡니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "three",
        label: "3개월",
        title: `생활비 ${N12.living} × 3 = ${N12.emergency3}`,
        settings: ["생활비 250만원", "맞벌이", "매달 75만원 적립"],
        result: `${N12.months3}에 도달`,
        expect: "줄인 750만원은 단기목표 칸으로 옮깁니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "tax",
        label: "세후 이자",
        title: `${N12.emergency6} · 연 ${N12.depositRate} · 1년`,
        settings: ["예치 1,500만원", "예시 금리 3%", "이자소득세 15.4%"],
        result: `이자 ${N12.interest} → 세후 ${N12.interestAfter}`,
        expect: `빠지는 세금은 ${N12.interestTax}입니다.`,
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
    ],
    sources: [
      {
        label: "예금보험공사 — 예금자보호 안내",
        what: "예금자보호 대상과 보호 한도(같은 금융회사에 몰아둘 때 걸리는 한도)",
        url: "https://www.kdic.or.kr/",
        host: "kdic.or.kr",
      },
      {
        label: "금융감독원 파인 — 예금·적금 금리 비교",
        what: "만기별 금리를 상품명 없이 비교",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "소득세법 제129조 — 이자소득 원천징수",
        what: "이자·배당 15.4%(소득세 14% + 지방소득세 1.4%)",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
      {
        label: "통계청 — 소비자물가지수",
        what: "비상금의 실질 가치가 물가로 얼마나 줄어드는지",
        url: "https://kostat.go.kr/",
        host: "kostat.go.kr",
      },
    ],
    cardSet: { ...SET_THREE_BUCKETS, startIndex: 2 },
    sheet: {
      variant: "emergency",
      slotNo: 1,
      slotTitle: "현금흐름표",
      line: "생활비와 적립액을 넣어 비상금 목표액과 도달 개월을 적습니다.",
    },
    next: {
      label: "다음 STEP",
      title: "STEP 2 · 2-1강 계좌 채우는 1·2·3순위",
      body: "비상금이 준비되면, 남는 돈은 세금이 가장 적게 떼이는 계좌 순서로 채웁니다.",
      href: "/academy/step2-account-order/",
      status: "공개",
    },
    reading: READING_12,
  },
  {
    slug: "step2-account-order",
    thesis: `비상금을 채운 뒤 연금저축 ${N21.savingsLimit} → IRP ${N21.irpLimit} 순서로 합산 ${N21.combinedLimit}을 넣으면, 세금에서 ${N21.credit}이 돌아옵니다.`,
    step: 2,
    no: 1,
    label: "2-1강",
    shortTitle: "계좌 채우는 1·2·3순위",
    title: "연봉 5,500만 원 기준, 계좌 채우는 1·2·3순위",
    question: "남는 돈은 어느 계좌부터 채울까",
    readingMinutes: 5,
    hook: `2년 뒤 전세 자금이 필요한 사람과 5년 넘게 묶어 둘 수 있는 사람은, 같은 ${N21.monthly}을 완전히 다른 계좌에 넣습니다.`,
    fork: {
      short: {
        tag: "2년 안에 쓸 돈이다",
        head: "연금계좌가 1순위가 아닙니다",
        body: `연금저축·IRP에 넣은 돈을 55세 전에 연금이 아닌 방식으로 찾으면, 돌려받은 공제액에 기타소득세 ${pct(
          PENSION_ACCOUNT.earlyWithdrawRateWithLocal,
        )}가 다시 붙습니다.`,
        verdict: "이 경우는 비상금 다음이 예·적금, 그다음 ISA입니다.",
      },
      long: {
        tag: "5년 넘게 묶어 둘 수 있다",
        head: "연금저축 → IRP → ISA 순서",
        body: `연금저축 ${N21.savingsLimit}과 IRP ${N21.irpLimit}을 합쳐 ${N21.combinedLimit}까지 넣으면 ${N21.credit}이 돌아옵니다. 그다음 돈이 ISA로 갑니다.`,
        verdict: "이 글의 주제입니다. 아래에서 내 소득으로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "합산 한도", value: N21.combinedLimit },
      { label: "최대 세액공제", value: N21.credit },
      { label: "매달 채우는 금액", value: N21.monthly },
    ],
    numbers: N21,
    calculator: {
      name: "연금저축·IRP 세액공제 계산기",
      href: "/apps/pension-tax/run",
      note: "총급여 구간과 두 계좌 납입액을 넣어 1·2순위에서 돌려받는 금액을 확인합니다. 네 계좌를 나란히 비교하려면 아래 '4대 계좌 세후 비교'를 함께 보세요.",
    },
    scenarios: [
      {
        id: "order1",
        label: "1순위",
        title: `연금저축 ${N21.savingsLimit} · 총급여 ${N21.salary} 이하`,
        settings: ["총급여 5,500만원", "연금저축 600만원", "공제율 16.5%"],
        result: `세액공제 ${wonLabel(creditWon(SAV, PENSION_ACCOUNT.creditRateLow))}`,
        expect: "직장이 없어도 만들 수 있는 계좌입니다.",
      },
      {
        id: "order2",
        label: "2순위",
        title: `IRP ${N21.irpLimit} 추가 → 합산 ${N21.combinedLimit}`,
        settings: ["연금저축 600만원", "IRP 300만원", "합산 한도 900만원"],
        result: `세액공제 ${N21.credit}`,
        expect: "두 계좌를 합쳐야 한도가 꽉 찹니다.",
      },
      {
        id: "boundary",
        label: "구간 경계",
        title: `총급여 ${N21.salary} 초과 · 합산 ${N21.combinedLimit}`,
        settings: ["총급여 5,500만원 초과", "공제율 13.2%", "연금저축 600 + IRP 300"],
        result: `세액공제 ${N21.creditHigh}`,
        expect: `같은 900만원인데 ${N21.creditGap} 차이가 납니다.`,
      },
    ],
    sources: [
      {
        label: "소득세법 제59조의3 — 연금계좌세액공제",
        what: "연금저축 600만원·합산 900만원, 공제율 15%·12%(지방소득세 포함 16.5%·13.2%)",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
      {
        label: "조세특례제한법 제91조의18 — 개인종합자산관리계좌(ISA)",
        what: "비과세 200만원·400만원, 초과분 9.9%, 의무가입 3년",
        url: "https://www.law.go.kr/법령/조세특례제한법",
        host: "law.go.kr",
      },
      {
        label: "소득세법 시행령 제118조의2 — 연금계좌 납입한도와 ISA 전환",
        what: "한도 초과 납입액의 다음 연도 전환, ISA 만기 자금 10%·최대 300만원 추가",
        url: "https://www.law.go.kr/법령/소득세법시행령",
        host: "law.go.kr",
      },
      {
        label: "국세청 — 연말정산 안내: 연금계좌 세액공제",
        what: "12월 31일 입금분까지 그해 공제 대상, 공제율 적용 방식",
        url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=2304",
        host: "nts.go.kr",
      },
    ],
    cardSet: SET_ACCOUNT_ORDER,
    sheet: {
      variant: "order",
      slotNo: 2,
      slotTitle: "계좌 배치표",
      line: "월 여유자금을 넣어 1·2·3순위로 얼마씩 가는지 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "2-2강 · ISA 일반형·서민형, 3년 만기 전 꼭 볼 숫자",
      body: "3순위로 넘어간 ISA에서 3년을 못 채우면 무엇을 잃는지, 만기 60일에 무엇을 해야 하는지 정리합니다.",
      href: "/academy/step2-isa-numbers/",
      status: "공개",
    },
    reading: READING_21,
  },
  {
    slug: "step2-isa-numbers",
    thesis: `ISA는 비과세 ${N22.exemptGeneral}(서민형 ${N22.exemptSeomin})과 ${N22.isaRate} 분리과세, 만기 60일 연금계좌 전환 ${N22.transferMax} — 세 장치를 함께 볼 때 이깁니다.`,
    step: 2,
    no: 2,
    label: "2-2강",
    shortTitle: "ISA 3년 만기 전 숫자",
    title: "ISA 일반형·서민형, 3년 만기 전 꼭 볼 숫자",
    question: "ISA의 세 장치는 각각 무엇을 막을까",
    readingMinutes: 5,
    hook: `같은 ${N22.exemptGeneral} 수익이라도 일반계좌는 ${N22.saveGeneral}을 내고, ISA 일반형은 0원입니다. 3년을 못 채우면 그 차이가 다시 돌아옵니다.`,
    fork: {
      short: {
        tag: "3년을 못 채울 것 같다",
        head: "ISA보다 예·적금이 먼저",
        body: `${N22.years}을 채우지 못하고 해지하면 비과세·분리과세 혜택이 사라지고 수익에 ${N22.dividend}가 붙습니다. 2년 안에 쓸 돈은 넣지 않습니다.`,
        verdict: "만기가 정해진 자리에 두는 편이 계산에 맞습니다.",
      },
      long: {
        tag: "3년 넘게 둘 수 있다",
        head: "비과세 + 전환 300만 원",
        body: `비과세 ${N22.exemptGeneral}(서민형 ${N22.exemptSeomin})과 ${N22.isaRate} 분리과세에, 만기 60일 안에 연금계좌로 옮기면 ${N22.transferMax} 추가 공제까지 붙습니다.`,
        verdict: "이 글의 주제입니다. 아래에서 세 숫자를 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "비과세(일반형)", value: N22.exemptGeneral },
      { label: "초과분 세율", value: N22.isaRate },
      { label: "전환 추가 공제", value: N22.transferCredit },
    ],
    numbers: N22,
    calculator: {
      name: "4대 계좌 세후 비교",
      href: "/apps/account-tax-compare/run",
      note: "같은 수익을 일반계좌와 ISA에 넣었을 때 세후 차이를 확인합니다.",
    },
    scenarios: [
      {
        id: "general",
        label: "일반형",
        title: `비과세 ${N22.exemptGeneral} · 일반형`,
        settings: ["연 수익 200만원", "일반계좌 15.4%", "ISA 일반형 비과세"],
        result: `절세 ${N22.saveGeneral}`,
        expect: "한도 안의 수익이면 ISA는 0원입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "seomin",
        label: "서민형",
        title: `비과세 ${N22.exemptSeomin} · 서민형`,
        settings: ["연 수익 400만원", "소득 요건 충족 시", "초과분 9.9%"],
        result: `절세 ${N22.saveSeomin}`,
        expect: "요건은 조문과 국세청 안내에서 확인합니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "transfer",
        label: "만기 전환",
        title: `만기 60일 · ${N22.transferMax} 전환`,
        settings: ["이전액의 10%", "최대 300만원", "공제율 16.5%"],
        result: `추가 공제 ${N22.transferCredit}`,
        expect: `비과세 ${N22.saveGeneral}과 합치면 ${N22.combined}입니다.`,
        href: "#sheet",
        cta: "운영표에서 이 값 확인하기",
      },
    ],
    sources: [
      {
        label: "조세특례제한법 제91조의18 — 개인종합자산관리계좌",
        what: "비과세 200만원(서민형·농어민형 400만원), 초과분 9.9% 분리과세, 의무가입 3년, 1인 1계좌",
        url: "https://www.law.go.kr/법령/조세특례제한법",
        host: "law.go.kr",
      },
      {
        label: "소득세법 시행령 제118조의2 — ISA 만기 자금의 연금계좌 전환",
        what: "전환액의 10%·최대 300만원을 공제 대상 납입액에 추가",
        url: "https://www.law.go.kr/법령/소득세법시행령",
        host: "law.go.kr",
      },
      {
        label: "국세청 — ISA 안내",
        what: "서민형 요건(직전 과세기간 총급여·종합소득), 가입·전환 절차",
        url: "https://www.nts.go.kr/",
        host: "nts.go.kr",
      },
    ],
    cardSet: SET_ISA_BASICS,
    sheet: {
      variant: "isa",
      slotNo: 2,
      slotTitle: "계좌 배치표",
      line: "연 수익을 넣어 일반형·서민형의 절세액과 전환 효과를 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "2-3강 · 연금저축 600·IRP 900",
      body: "ISA에서 넘어온 돈까지 합쳐, 연금계좌의 세 순간(넣기·굴리기·꺼내기)을 숫자로 확인합니다.",
      href: "/academy/step2-pension-tax-limit/",
      status: "공개",
    },
    reading: READING_22,
  },
  {
    slug: "step2-pension-tax-limit",
    thesis: `두 계좌를 합쳐 ${N23.combinedLimit}까지 넣으면, 총급여 5,500만원 이하인 사람은 세금에서 최대 ${N23.maxCreditLabel}이 줄어듭니다.`,
    step: 2,
    no: 3,
    label: "2-3강",
    shortTitle: "연금저축 600 · IRP 900",
    title: `연금저축 ${manLabel(SAV)}·IRP ${manLabel(COMBO)}, 내 소득에서 얼마나 돌려받을까?`,
    question: "세액공제는 어디서 얼마나 줄어드는 걸까",
    readingMinutes: 5,
    hook: `여윳돈 월 30만 원이 같아도, 2년 뒤 전세 자금이 필요한 사람과 아닌 사람은 계좌 배치가 완전히 다릅니다.`,
    fork: {
      short: {
        tag: "2년 안에 쓸 돈",
        head: "2년 뒤 전세 자금이 필요하다",
        body: `연금계좌에 넣은 돈을 55세 전에 연금이 아닌 방식으로 찾으면, 공제받은 납입액에 기타소득세 ${N23.earlyRate}가 다시 붙습니다. 돌려받은 ${N23.maxCreditLabel}을 그대로 다시 내는 셈입니다.`,
        verdict: "연금계좌 대신, 만기가 짧은 다른 계좌가 먼저입니다.",
      },
      long: {
        tag: "5년 넘게 묶어 둘 돈",
        head: "5년 넘게 묶어 둘 수 있다",
        body: `연금저축 ${N23.savingsLimit}에 IRP ${manLabel(COMBO - SAV)}을 더하면 합산 ${N23.combinedLimit}이 공제 대상이 됩니다. 연말정산에서 ${N23.maxCreditLabel}이 줄어듭니다.`,
        verdict: "이 글의 주제입니다. 아래 계산기에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "합산 한도", value: N23.combinedLimit },
      { label: "최대 세액공제", value: N23.maxCreditLabel },
      { label: "중도해지 시", value: N23.earlyRate },
    ],
    numbers: N23,
    calculator: {
      name: "연금저축·IRP 세액공제 계산기",
      href: "/apps/pension-tax/run",
      note: "총급여 구간과 두 계좌 납입액을 넣어 공제액이 계단으로 오르는 것을 확인합니다.",
    },
    scenarios: [
      {
        id: "base",
        label: "기본",
        title: "총급여 4,800만 원 · 연금저축 600 · IRP 300",
        settings: ["소득 구간: 총급여 5,500만원 이하", "연금저축 납입액: 600만원", "IRP 납입액: 300만원"],
        result: `예상 세액공제 ${N23.maxCreditLabel}`,
        expect: "합산 한도 900만 원을 꽉 채운 경우입니다.",
      },
      {
        id: "step",
        label: "계단",
        title: "IRP를 0 → 100 → 200 → 300으로",
        settings: ["소득 구간: 총급여 5,500만원 이하", "연금저축 납입액: 600만원", "IRP 납입액: 0 · 100 · 200 · 300만원"],
        result: `${N23.savingsOnlyLabel} → ${wonLabel(creditWon(700, PENSION_ACCOUNT.creditRateLow))} → ${N23.irp200Label} → ${N23.maxCreditLabel}`,
        expect: "IRP 100만 원마다 16만 5,000원씩 계단처럼 오릅니다.",
      },
      {
        id: "high",
        label: "구간 경계",
        title: "총급여 5,500만 원 초과 · 연금저축 600 · IRP 300",
        settings: ["소득 구간: 5,500만원 초과", "연금저축 납입액: 600만원", "IRP 납입액: 300만원"],
        result: `예상 세액공제 ${N23.highCreditLabel}`,
        expect: `같은 900만 원인데 공제율이 ${N23.rateHigh}로 내려가 ${N23.bracketGapLabel} 차이가 납니다.`,
      },
    ],
    sources: [
      {
        label: "소득세법 제59조의3 — 연금계좌세액공제",
        what: "연금저축 600만 원, 연금저축·퇴직연금 합산 900만 원, 공제율 15%·12%(지방소득세 포함 16.5%·13.2%)",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
      {
        label: "소득세법 시행령 제118조의2 — 연금계좌 납입한도와 ISA 전환",
        what: "한도 초과 납입액의 다음 연도 전환, ISA 만기 자금의 10%·최대 300만 원 추가",
        url: "https://www.law.go.kr/법령/소득세법시행령",
        host: "law.go.kr",
      },
      {
        label: "국세청 — 연말정산 안내: 연금계좌 세액공제",
        what: "12월 31일 입금분까지 그해 공제 대상, 공제율 적용 방식",
        url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=2304",
        host: "nts.go.kr",
      },
      {
        label: "금융감독원 통합연금포털 — 내 연금 확인",
        what: "공적연금·퇴직연금·개인연금 가입 내역을 한 번에 조회",
        url: "https://100lifeplan.fss.or.kr/",
        host: "fss.or.kr",
      },
    ],
    cardSet: SET_TAX_MOMENTS,
    sheet: {
      variant: "pension",
      slotNo: 2,
      slotTitle: "계좌 배치표",
      line: "연금저축·IRP에 얼마를 넣고 얼마를 돌려받는지 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "2-4강 · ISA의 세 가지 장치",
      body: "손익통산·비과세 200/400·3년 의무가입이 각각 무엇을 막는지, 연금계좌와 어떻게 이어지는지 정리합니다.",
      status: "준비중",
    },
    reading: READING_23,
  },
  {
    slug: "step3-drawdown-recovery",
    thesis: `${N31.d50}에서 본전이 되려면 ${N31.rec50}가 필요합니다. 낙폭과 회복은 같은 크기가 아니라, 잃은 뒤의 기준이 작아져 회복이 더 큰 상승을 요구하는 비대칭입니다.`,
    step: 3,
    no: 1,
    label: "3-1강",
    shortTitle: "반 토막이면 두 배",
    title: `반 토막이면 두 배 — 낙폭과 회복, 왜 회복이 더 클까?`,
    question: `${N31.d50}를 회복하려면 왜 ${N31.rec50}가 필요할까`,
    readingMinutes: 5,
    hook: `같은 ${N31.base}이라도 ${N31.d20}에서 멈춘 사람은 ${N31.rec20}, ${N31.d50}까지 간 사람은 ${N31.rec50}를 기다립니다.`,
    fork: {
      short: {
        tag: `${N31.d20}에서 멈췄다`,
        head: `본전까지 ${N31.rec20}`,
        body: `${N31.base}이 ${N31.left20}이 되었고, ${N31.left20}에 ${N31.rec20}를 더하면 다시 ${N31.base}입니다. 손실 한도를 정해 둔 사람의 자리입니다.`,
        verdict: `여기서 멈추면 회복은 한 번의 상승으로 끝납니다.`,
      },
      long: {
        tag: `${N31.d50}까지 갔다`,
        head: `본전까지 ${N31.rec50}`,
        body: `${N31.base}이 ${N31.left50}이 되었습니다. ${N31.left50}이 ${N31.base}이 되려면 ${N31.rec50}가 필요하고, 그동안의 시간은 수익이 아니라 회복에 쓰입니다.`,
        verdict: "이 글의 주제입니다. 아래에서 구간별 회복률을 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "낙폭", value: N31.d50 },
      { label: "회복에 필요한 상승", value: N31.rec50 },
      { label: "남는 돈", value: N31.left50 },
    ],
    numbers: N31,
    calculator: {
      name: "투자 복리·세후 수익률 계산기",
      href: "/apps/compound-return/run",
      note: "해마다 다른 수익률을 넣어, 손실이 난 해 뒤에 원금으로 돌아오는 데 몇 년이 걸리는지 확인합니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "step20",
        label: "구간별",
        title: `${N31.base} · ${N31.d20} 하락 → ${N31.rec20}`,
        settings: ["투자금 1,000만원", "낙폭 20%", "남은 돈 800만원"],
        result: `본전까지 ${N31.rec20}`,
        expect: "800만원의 25%가 200만원입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "half",
        label: "반 토막",
        title: `${N31.base} · ${N31.d50} 하락 → ${N31.rec50}`,
        settings: ["투자금 1,000만원", "낙폭 50%", "남은 돈 500만원"],
        result: `본전까지 ${N31.rec50}`,
        expect: "500만원이 두 배가 되어야 1,000만원입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "vol",
        label: "변동성 끌림",
        title: `+50% 뒤 ${N31.d50} = ${N31.roundTrip}`,
        settings: ["1년 +50%", "2년 -50%", "두 해 평균 0%"],
        result: `${N31.roundTrip} 손실`,
        expect: "평균 수익률이 같아도 오르내림이 크면 결과가 낮아집니다.",
      },
    ],
    sources: [
      {
        label: "금융투자협회 전자공시 — 펀드 기준가·수익률",
        what: "펀드·ETF의 기준가와 기간 수익률을 원문에서 확인(최대 낙폭 비교의 기준)",
        url: "https://dis.kofia.or.kr/",
        host: "dis.kofia.or.kr",
      },
      {
        label: "금융감독원 파인 — 투자설명서·위험등급",
        what: "상품의 위험등급과 투자설명서 원문(손실 가능 범위)",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "한국거래소 — 지수 통계",
        what: "지수의 기간별 등락과 낙폭을 보는 1차 자료",
        url: "https://www.krx.co.kr/",
        host: "krx.co.kr",
      },
    ],
    cardSet: SET_DRAWDOWN,
    sheet: {
      variant: "policy",
      slotNo: 3,
      slotTitle: "투자정책서",
      line: "투자금·3층 비율·손실 한도를 넣어, 하락 때 무엇을 할지 규칙으로 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "3-2강 · 지수 ETF, 이름 말고 6개 숫자부터",
      body: "손실을 줄이는 구조를 정했으니, 이제 그 안에 담을 ETF의 비용과 추적을 숫자로 비교합니다.",
      href: "/academy/step3-etf-six-numbers/",
      status: "공개",
    },
    reading: READING_31,
  },
  {
    slug: "step3-etf-six-numbers",
    thesis: `같은 지수를 따라가도 ${N32.base}을 ${N32.years} 두면 비용은 ${N32.costLow}과 ${N32.costHigh}로 갈립니다. 이름보다 총보수+기타비용·추적오차·괴리율·분배금·거래량 여섯 숫자를 먼저 봅니다.`,
    step: 3,
    no: 2,
    label: "3-2강",
    shortTitle: "지수 ETF 6개 숫자",
    title: `지수 ETF, 이름 말고 6개 숫자부터 — 무엇을 먼저 볼까?`,
    question: `같은 지수를 따라가는 ETF는 무엇으로 갈릴까`,
    readingMinutes: 5,
    hook: `총보수 ${N32.feeLow}인 상품과 ${N32.feeHigh}인 상품은 ${N32.base}을 ${N32.years} 두면 ${N32.gap} 차이가 납니다.`,
    fork: {
      short: {
        tag: "이름과 브랜드만 본다",
        head: "같은 지수면 같다고 생각합니다",
        body: `총보수만 비교하면 기타비용이 빠집니다. 총보수 ${N32.feeLow}에 기타비용 ${N32.other}를 더한 연 ${pct(ETF_FEE.low + ETF_FEE.other, 2)}가 실제로 나가는 비율입니다.`,
        verdict: `비용은 두 숫자를 더해야 보입니다.`,
      },
      long: {
        tag: "여섯 숫자로 본다",
        head: "총비용·추적·유동성 순서",
        body: `총보수+기타비용 → 추적오차 → 괴리율 → 분배금 → 거래량·순자산 순서로 봅니다. 이 순서면 같은 지수 안에서도 내 돈이 덜 새는 쪽을 고를 수 있습니다.`,
        verdict: "이 글의 주제입니다. 아래에서 비용과 추적을 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "연 총비용", value: pct(ETF_FEE.low + ETF_FEE.other, 2) },
      { label: `${N32.years} 비용`, value: N32.costHigh },
      { label: "비용 차이", value: N32.gap },
    ],
    numbers: N32,
    calculator: {
      name: "ETF 6개 숫자 점검표",
      href: "#sheet",
      note: "이 페이지 아래 운영표가 계산기입니다. 총보수·기타비용과 보유 기간을 넣으면 기간 비용이 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "low",
        label: "낮은 비용",
        title: `총보수 ${N32.feeLow} + 기타 ${N32.other} = ${N32.years} ${N32.costLow}`,
        settings: ["보유 금액 1,000만원", "총보수 0.05%", "기타비용 0.02%"],
        result: `${N32.years} ${N32.costLow}`,
        expect: "연 0.07%를 단순 합계로 계산했습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "high",
        label: "높은 비용",
        title: `총보수 ${N32.feeHigh} + 기타 ${N32.other} = ${N32.years} ${N32.costHigh}`,
        settings: ["보유 금액 1,000만원", "총보수 0.45%", "기타비용 0.02%"],
        result: `${N32.years} ${N32.costHigh}`,
        expect: "같은 지수여도 운용사·상품에 따라 다릅니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "gap",
        label: "차이",
        title: `${N32.costHigh} − ${N32.costLow} = ${N32.gap}`,
        settings: ["같은 지수·같은 수익률 가정", "10년 보유", "복리 미반영"],
        result: `${N32.gap} 차이`,
        expect: "수익률이 같다면 이 차이는 그대로 남습니다.",
      },
    ],
    sources: [
      {
        label: "금융투자협회 펀드공시 — 총보수·기타비용",
        what: "ETF의 총보수와 기타비용, 매매중개수수료를 상품별로 공시",
        url: "https://dis.kofia.or.kr/",
        host: "dis.kofia.or.kr",
      },
      {
        label: "한국거래소 — ETF 시장 안내",
        what: "거래량·순자산·괴리율 등 거래 정보",
        url: "https://www.krx.co.kr/",
        host: "krx.co.kr",
      },
      {
        label: "금융감독원 파인 — ETF 투자설명서",
        what: "추적오차·분배금·환헤지 여부가 적힌 투자설명서 원문",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
    ],
    cardSet: SET_ETF_NUMBERS,
    sheet: {
      variant: "etfcheck",
      slotNo: 3,
      slotTitle: "투자정책서",
      line: "총보수·기타비용·보유 기간을 넣어, 고른 ETF의 기간 비용을 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "3-3강 · 지수 vs 액티브",
      body: "비용과 초과수익 중 무엇을 먼저 볼지, 같은 기간 수익률로 비교하는 순서를 정리합니다.",
      status: "준비중",
    },
    reading: READING_32,
  },
  {
    slug: "step4-retire-drawdown-order",
    thesis: `${N41.start}에서 해마다 ${N41.draw}을 빼면서 5년 수익률 ${N41.seq}, 평균 ${N41.avg}인 다섯 해의 순서만 바꾸면, 하락이 먼저 온 쪽은 ${N41.bad}, 상승이 먼저 온 쪽은 ${N41.good}으로 갈라져 ${N41.gap} 차이가 납니다. 인출이 있는 한 순서가 결과를 바꿉니다.`,
    step: 4,
    no: 1,
    label: "4-1강",
    shortTitle: "은퇴 첫 5년 인출 순서",
    title: "은퇴 첫 5년 순서 위험 — 같은 수익률, 인출 순서가 만든 차이",
    question: "수익률이 같아도 받는 순서가 왜 결과를 바꿀까",
    readingMinutes: 5,
    hook: `평균 수익률이 ${N41.avg}으로 같은 5년이라도, 첫 두 해에 ${N41.dropFirst}가 오면 잔액이 ${N41.low2}까지 내려가고 그 뒤는 회복에 쓰입니다.`,
    fork: {
      short: {
        tag: "평균 수익률만 본다",
        head: "평균이 같으면 같다고 봅니다",
        body: `수익률을 더해 평균을 내면 두 경우가 같습니다. 하지만 중간에 ${N41.draw}을 빼면, 빼는 시점의 잔액이 결과를 정합니다.`,
        verdict: "인출이 있으면 평균만으로는 판단할 수 없습니다.",
      },
      long: {
        tag: "순서와 현금을 함께 본다",
        head: "하락이 먼저면 현금이 먼저",
        body: `생활비 2년치인 ${N41.cash2}을 투자 밖에 두면, 하락한 해에 투자를 팔지 않고 그 돈으로 생활합니다.`,
        verdict: "이 글의 주제입니다. 아래 인출 순서표에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "시작 자산", value: N41.start },
      { label: "하락 먼저", value: N41.bad },
      { label: "상승 먼저", value: N41.good },
    ],
    numbers: N41,
    calculator: {
      name: "연금 인출·세금 시뮬레이터",
      href: "/apps/pension-draw/run",
      note: "인출액과 수익률 순서를 넣어 잔액이 어떻게 달라지는지 확인합니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "bad",
        label: "하락 먼저",
        title: `${N41.start} · ${N41.draw} 인출 · ${N41.dropFirst} 먼저`,
        settings: ["시작 자산 3억원", "연 인출 1,500만원", "수익률 −30%·−20%·+5%·+20%·+25%"],
        result: `5년 뒤 ${N41.bad}`,
        expect: "해마다 초에 인출하고, 남은 돈에 그해 수익률을 곱했습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "good",
        label: "상승 먼저",
        title: `${N41.start} · ${N41.draw} 인출 · ${N41.riseFirst} 먼저`,
        settings: ["시작 자산 3억원", "연 인출 1,500만원", "같은 수익률 5개, 순서만 반대"],
        result: `5년 뒤 ${N41.good}`,
        expect: `순서만 바꿨는데 ${N41.gap} 차이입니다.`,
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "gap",
        label: "차이",
        title: `${N41.good} − ${N41.bad} = ${N41.gap}`,
        settings: ["같은 수익률 5개(평균 0%)", "같은 인출액", "순서만 반대"],
        result: `${N41.gap} 차이`,
        expect: "평균 수익률은 두 경우 모두 0%입니다.",
      },
    ],
    sources: [
      {
        label: "소득세법 제20조의3·제64조의4 — 연금소득과 연금소득세",
        what: "사적연금 연 1,500만 원 기준과 초과 시 과세 방식(종합과세 또는 15% 분리과세 선택)",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
      {
        label: "국민건강보험법 시행규칙 별표 1의2 — 피부양자 자격",
        what: "소득 합계 연 2,000만 원 등 피부양자 요건(세금 기준과 다른 제도)",
        url: "https://www.law.go.kr/법령/국민건강보험법시행규칙",
        host: "law.go.kr",
      },
      {
        label: "금융감독원 통합연금포털 — 내 연금 확인",
        what: "공적연금·퇴직연금·개인연금 예상 수령액을 한 번에 조회",
        url: "https://100lifeplan.fss.or.kr/",
        host: "fss.or.kr",
      },
      {
        label: "국민연금공단 — 내 연금 알아보기",
        what: "가입 이력과 예상 수령액, 조기·연기 수령 조건",
        url: "https://www.nps.or.kr/",
        host: "nps.or.kr",
      },
      {
        label: "국세청 — 연금소득 원천징수 방법",
        what: "연금소득공제를 반영한 원천징수 세율과 신고 절차(1,500만 원 기준)",
        url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7888",
        host: "nts.go.kr",
      },
      {
        label: "국민건강보험공단 — 피부양자 자격 안내",
        what: "소득 합계 2,000만 원 요건과 재산 기준, 자격 확인 절차",
        url: "https://www.nhis.or.kr/",
        host: "nhis.or.kr",
      },
    ],
    cardSet: SET_RETIRE_DRAW,
    sheet: {
      variant: "draworder",
      slotNo: 4,
      slotTitle: "인출 순서표",
      line: "시작 자산·연 인출액·순서를 넣어 5년 뒤 잔액과 두 기준선을 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "4-2강 · 연금 1,500만 원 경계와 개시 시점",
      body: "받을 금액을 정했으니, 언제 열고 어떤 순서로 받을지 정합니다.",
      status: "준비중",
    },
    reading: READING_41,
  },
  {
    slug: "step5-silson-generation-switch",
    thesis: `1·2세대 실손(실손의료보험)을 5세대로 바꾸면 ${N51.diskYears} 동안 새 5세대 보험료의 ${N51.halfRate}를 깎습니다. 1세대 ${N51.base1} 예시라면 ${N51.diskYears} 동안 ${N51.conv}, ${N51.diskYears} 뒤 ${N51.after3}입니다. 다만 ${N51.halfRate}는 지금 내는 보험료의 절반이 아닙니다.`,
    step: 5,
    no: 1,
    label: "5-1강",
    shortTitle: "실손 세대 전환 3가지",
    title: `실손 세대 전환·약관 공백 — 보험료 ${N51.halfRate} 전에 볼 3가지`,
    question: "할인은 어디에 붙고, 무엇을 포기하는 걸까",
    readingMinutes: 5,
    hook: `${N51.base1}을 내던 1세대가 5세대로 바꾸면 ${N51.diskYears} 동안 ${N51.conv}, ${N51.diskYears} 뒤 ${N51.after3}입니다. 그런데 ${N51.halfRate}는 내 보험료의 절반이 아닙니다.`,
    fork: {
      short: {
        tag: "50%만 보고 바꾼다",
        head: "내 보험료의 절반으로 봅니다",
        body: `${N51.base1}의 ${N51.halfRate}면 ${N51.conv}보다 훨씬 낮아야 하지만, 할인은 새로 산출된 5세대 보험료에 붙습니다.`,
        verdict: "숫자의 기준을 먼저 확인해야 합니다.",
      },
      long: {
        tag: "증권과 청구 내역을 먼저 편다",
        head: "가입일·병원 이용·3년 뒤 보험료",
        body: `대상은 2013년 3월 이전 계약 약 ${N51.people}입니다. 지난 1~2년 청구 내역에서 비중이 큰 항목과 ${N51.diskYears} 뒤 보험료 ${N51.after3}을 함께 봅니다.`,
        verdict: "이 글의 주제입니다. 아래 보장 빈칸표에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "1세대 월 보험료", value: N51.base1 },
      { label: `전환 후 월(${N51.diskYears})`, value: N51.conv },
      { label: `${N51.diskYears} 뒤 월`, value: N51.after3 },
    ],
    numbers: N51,
    calculator: {
      name: "내 실손 세대 비교",
      href: "/apps/silson-compare/run",
      note: "내 세대와 보험료를 넣어 전환·선택형의 보험료를 나란히 비교합니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "conv",
        label: "계약전환",
        title: `${N51.base1} → ${N51.conv} → ${N51.diskYears} 뒤 ${N51.after3}`,
        settings: ["1세대 월 17만 6,982원(금융위 예시)", "5세대 전환", "3년 50% 할인"],
        result: `${N51.diskYears} 동안 월 ${N51.conv}`,
        expect: `할인 기간에 아끼는 금액은 ${N51.save3}입니다.`,
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "sel",
        label: "선택형",
        title: `1세대 ${N51.sel1}(${N51.sel1Rate} 인하) · 2세대 ${N51.sel2}(${N51.sel2Rate} 인하)`,
        settings: ["기존 계약 유지", "도수·비급여 MRI·자기부담 20% 세 옵션", "철회·해지 1회"],
        result: `1세대 ${N51.sel1}`,
        expect: "포기하는 항목의 할인율이 곧 그 항목에 쓰던 돈입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "coverage",
        label: "보장 변화",
        title: `비중증 비급여 연 ${N51.nonSevereLimit} · 자기부담 ${N51.selfRate}`,
        settings: ["5세대 구조로 전환", "중증 구간은 유지", "병원 이용 많으면 불리"],
        result: `자기부담 ${N51.selfRate}`,
        expect: "보험료만 보고 정하면 3년 뒤에 같은 자리로 돌아옵니다.",
      },
    ],
    sources: [
      {
        label: "금융위원회 — 실손보험 점검회의 보도자료(2026-11-19)",
        what: "계약전환 ${N51.halfRate} 할인·선택형 할인특약의 시행일과 대상",
        url: "https://www.fsc.go.kr/no010101/88173",
        host: "fsc.go.kr",
      },
      {
        label: "금융위원회·금융감독원 — 제도 관련 Q&A(2026-11)",
        what: "청약철회 기간, 기존 계약 해지 시 할인 종료, 아웃바운드 권유 금지",
        url: "https://www.fsc.go.kr/comm/getFile?fileNo=9&fileTy=ATTACH&srvcId=BBSTY1&upperNo=88173",
        host: "fsc.go.kr",
      },
      {
        label: "금융감독원 파인 — 보험상품 공시",
        what: "세대별 실손 보험료와 보장 구조를 상품명 없이 확인",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "법제처 국가법령정보센터 — 보험업법",
        what: "약관 설명 의무와 부당승환(갈아타기) 금지 규정",
        url: "https://www.law.go.kr/법령/보험업법",
        host: "law.go.kr",
      },
    ],
    cardSet: SET_SILSON,
    sheet: {
      variant: "silson",
      slotNo: 5,
      slotTitle: "보장 빈칸표",
      line: "세대와 보험료, 선택을 넣어 3년 비용과 3년 뒤 보험료를 적습니다.",
    },
    next: {
      label: "다음 강",
      title: "5-2강 · 약관에서 갈리는 5칸",
      body: "보험료를 정했으니, 실제 수령액을 정하는 면책·감액·지급 기준을 봅니다.",
      status: "준비중",
    },
    reading: READING_51,
  },
  {
    slug: "step6-rebalance-cash",
    thesis: `목표금액은 총자산 × 목표비중 한 줄로 정해집니다. ${N61.total}에서 주식 ${N61.target}면 목표는 ${N61.targetAmount}이고, 지금 ${N61.high}이면 ${N61.trim}을 덜고 ${N61.low}이면 ${N61.fill}을 채웁니다. 점검은 ${N61.once}와 ${N61.band} 두 가지로 둡니다.`,
    step: 6,
    no: 1,
    label: "6-1강",
    shortTitle: "리밸런싱과 현금 비중",
    title: "리밸런싱과 현금 비중 — 오를 때 덜고 내릴 때 채우기",
    question: "가만히 두면 왜 쏠리고, 언제 손대야 할까",
    readingMinutes: 5,
    hook: `${N61.total}에서 주식 ${N61.target}를 목표로 두면 ${N61.targetAmount}입니다. 지금 ${N61.high}이면 ${N61.trim}을 덜고, ${N61.low}이면 ${N61.fill}을 채웁니다.`,
    fork: {
      short: {
        tag: "그냥 둔다",
        head: "오른 자산을 그대로 둡니다",
        body: `주식이 오르면 총자산에서 차지하는 몫이 목표 ${N61.target}를 넘습니다. 다음 하락에서 흔들리는 폭도 함께 커집니다.`,
        verdict: "확인하지 않으면 오차는 쌓입니다.",
      },
      long: {
        tag: "날짜와 밴드를 정한다",
        head: "1년에 한 번, 5%p 넘으면 그때도",
        body: `점검일을 달력에 적고, ${N61.lowBand}~${N61.highBand} 밴드를 벗어났을 때만 손댑니다. 생활비 ${N61.months}치 현금은 투자 밖에 둡니다.`,
        verdict: "이 글의 주제입니다. 아래 리밸런싱 계산기에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "목표금액", value: N61.targetAmount },
      { label: "오르면 덜기", value: N61.trim },
      { label: "내리면 채우기", value: N61.fill },
    ],
    numbers: N61,
    calculator: {
      name: "리밸런싱·현금 비중 계산기",
      href: "#sheet",
      note: "이 페이지 아래 운영표가 계산기입니다. 총자산·목표 비중·현재 금액을 고르면 덜기/채우기 금액과 밴드가 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "trim",
        label: "오르면 덜기",
        title: `${N61.total} × ${N61.target} = ${N61.targetAmount} · 지금 ${N61.high}`,
        settings: ["총자산 1,000만원", "목표 주식 70%", "지금 주식 820만원"],
        result: `${N61.trim} 덜기`,
        expect: "오른 만큼만 덜고, 남은 돈은 다른 자산에 넣습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "fill",
        label: "내리면 채우기",
        title: `${N61.targetAmount} − ${N61.low} = ${N61.fill}`,
        settings: ["총자산 1,000만원", "목표 주식 70%", "지금 주식 620만원"],
        result: `${N61.fill} 채우기`,
        expect: "새 돈이 들어오면 매도 없이 그쪽에 넣어도 됩니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "cash",
        label: "현금 비중",
        title: `생활비 ${N61.months} = ${N61.cash3} ~ ${N61.cash6} · 3년 안 쓸 돈 ${N61.near}`,
        settings: ["월 생활비 250만원", "3개월 750만원 / 6개월 1,500만원", "3년 안에 쓸 돈 1,200만원"],
        result: `${N61.cash3} ~ ${N61.cash6}`,
        expect: "현금은 수익이 0에 가깝지만 강제 매도를 막습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
    ],
    sources: [
      {
        label: "금융투자협회 펀드공시 — 총보수·기타비용",
        what: "리밸런싱 때 사고파는 상품의 비용을 확인하는 1차 공시",
        url: "https://dis.kofia.or.kr/",
        host: "dis.kofia.or.kr",
      },
      {
        label: "한국거래소 — 지수 통계",
        what: "자산별 기간 등락과 낙폭을 보는 1차 자료",
        url: "https://www.krx.co.kr/",
        host: "krx.co.kr",
      },
      {
        label: "금융감독원 파인 — 투자설명서·위험등급",
        what: "상품의 위험등급과 손실 가능 범위",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
    ],
    cardSet: SET_REBALANCE,
    sheet: {
      variant: "rebalance",
      slotNo: 6,
      slotTitle: "12개월 달력",
      line: "총자산·목표 비중·현재 금액을 넣어 덜기/채우기 금액과 밴드를 적고 점검일을 정합니다.",
    },
    next: {
      label: "다음 강",
      title: "6-2강 · 12개월 금융 달력",
      body: "한 해에 열리는 제도 일정과 점검일을 달력 한 장에 모읍니다.",
      status: "준비중",
    },
    reading: READING_61,
  },
];

export const lessonBySlug = (slug: string) => ACADEMY_LESSONS.find((l) => l.slug === slug);
export const lessonsOfStep = (step: number) => ACADEMY_LESSONS.filter((l) => l.step === step);
export const firstLessonOfStep = (step: number) => lessonsOfStep(step)[0];

/** 강의 페이지가 주소를 만들 때 쓰는 경로 */
export const lessonHref = (lesson: AcademyLesson) => `/academy/${lesson.slug}/`;

/** 원고 분량(공백 제외) — 규격 검사 결과를 강의별로 돌려준다. */
export const LESSON_CHARS: Record<string, number> = Object.fromEntries(
  ACADEMY_LESSONS.map((l) => [l.slug, readingChars(l.reading)]),
);

/** 강의 1개의 표준 4요소 규격 */
export const LESSON_SPEC = { minChars: 1200, maxChars: 1500, cards: 6, minutes: 15 } as const;

export type { ReadingSection as AcademyReadingSection };
export { CARD };
