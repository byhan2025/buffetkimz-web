/**
 * 「버핏킴즈 금융생활학교」 초등·청소년·첫 월급 3강 — v8.2.0.
 *
 * 왜 별도 파일인가
 *  · 성인 실전 6 STEP 41강(`academy-lessons.ts`)은 STEP 번호(1~6)로 목록을 만든다.
 *    학교 트랙은 STEP 대신 **트랙(초등·청소년·첫 월급)** 과 52주 편성(`academy-school.ts`)을 쓴다.
 *    두 뼈대를 한 배열에 섞으면 `lessonsOfStep()`이 학교 강의를 STEP 강의로 착각한다.
 *  · 타입은 성인 강의와 같은 `AcademyLesson`을 그대로 쓰고, `track`만 다르게 둔다.
 *    그래서 허브·자료앨범·카드뉴스 뷰어·면책 문구가 두 트랙에서 같은 코드로 돈다.
 *
 * 지키는 것 (셋톡 교차검증 기준)
 *  · 부이대리 — 본문 16px 이상, 버튼 44px 이상, 한 화면 한 질문, 정답을 색만으로 알리지 않는다.
 *  · 한대리 — 청소년 소액결제·BNPL·금융사기(112·1332), 첫 월급 4대보험·실수령.
 *  · 인스팅대리 — 기준일 2026. 11. 22. 과 1차 출처(금융감독원·교육부·국세청·한국은행 등)를 강의마다 남긴다.
 *  · 대표님 — 가상 금액만 쓰고, 입력값을 주소·저장소·서버에 남기지 않는다.
 */
import type {
  AcademyLesson,
  LessonCardSet,
  LessonQuizItem,
  ReadingSection,
} from "./academy-lessons";
import { HEALTH_INSURANCE } from "./tax-rules";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const manwon = (n: number) => `${n.toLocaleString("ko-KR")}만원`;

/* ------------------------------------------------------------------
   카드 세트 — public/gallery/3d-*.png 6장
   ------------------------------------------------------------------ */
const card = (prefix: string, no: number, caption: string, alt: string) => ({
  src: `/gallery/3d-${prefix}-${String(no).padStart(2, "0")}.png`,
  alt,
  caption,
});

/** A. 용돈 세 칸 — 초등 1강 */
const SET_ALLOWANCE: LessonCardSet = {
  id: "allowance-three-rooms-hand",
  title: "용돈 7,000원, 세 칸으로 나누기",
  meta: "손글씨 카드 6장 · 쓸 돈 · 모을 돈 · 남길 돈",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("allowance", 1, "표지 — 용돈 7,000원을 세 칸으로 나눠 볼까?", "나무 책상 위 봉투 세 개와 동전, 첫 봉투에 동전을 넣는 마스코트"),
    card("allowance", 2, "오해 vs 팩트 — 남으면 모은다 / 먼저 나누고 쓴다", "왼쪽은 빈 지갑을 든 시무룩한 마스코트, 오른쪽은 동전을 세 봉투에 나눠 담는 마스코트"),
    card("allowance", 3, "칸 ① — 이번 주에 쓸 돈 3,000원", "동전 하나와 간식·연필이 든 장바구니를 든 마스코트"),
    card("allowance", 4, "칸 ② — 목표 30,000원, 매주 3,000원", "유리병에 동전을 넣는 마스코트와 병에 기댄 작은 사다리, 병 위의 자전거 그림"),
    card("allowance", 5, "칸 ③ — 급할 때 쓰는 돈 1,000원", "뚜껑 있는 작은 통에 동전을 넣는 마스코트와 옆에 세운 우산"),
    card("allowance", 6, "오늘 할 일 — 봉투 3개에 이름 붙이기", "봉투 세 개에 연필로 이름을 쓰는 마스코트와 옆의 동전 더미"),
  ],
};

/** B. 소액결제와 사기 방어 — 청소년 1강 */
const SET_TEEN_PAY: LessonCardSet = {
  id: "teen-pay-traps-hand",
  title: "월 5,000원이 1년이면 60,000원",
  meta: "손글씨 카드 6장 · 구독 · BNPL · 사기 신호",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("teen-pay", 1, "표지 — 월 5,000원이 1년이면 60,000원", "화면에서 동전이 흘러나와 유리병에 담기는 휴대폰과 놀란 마스코트"),
    card("teen-pay", 2, "오해 vs 팩트 — 한 달 5천 원이라 괜찮다 / 12개월로 바꿔 보면 6만 원", "왼쪽은 동전 하나를 든 편안한 마스코트, 오른쪽은 달력 12칸에 동전이 쌓인 모습을 보는 마스코트"),
    card("teen-pay", 3, "반복 결제 — 한 달 30,000원이면 1년 360,000원", "달력 12칸마다 동전 하나씩, 그 옆을 가리키는 마스코트"),
    card("teen-pay", 4, "BNPL — 200,000원 3개월, 수수료 10,000원", "가게에서 작은 상자를 받는 마스코트와 위에 떠 있는 시계·수수료 동전"),
    card("teen-pay", 5, "사기 신호 — 송금 요청은 멈추고 확인", "휴대폰에서 물음표 봉투가 나오고 한 손을 든 채 뒤로 물러서는 마스코트, 경찰 호루라기와 방패"),
    card("teen-pay", 6, "오늘 할 일 — 결제 내역 3개 확인", "세 칸 체크리스트를 든 마스코트와 휴대폰·호루라기"),
  ],
};

/** C. 첫 월급명세서 3줄 — 첫 월급 1강 */
const SET_FIRSTPAY: LessonCardSet = {
  id: "firstpay-stub-hand",
  title: "세전 300만, 통장엔 267만",
  meta: "손글씨 카드 6장 · 지급 · 공제 · 실수령",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("firstpay", 1, "표지 — 세전 300만, 통장엔 267만", "세 줄이 그어진 긴 명세서를 두 손으로 든 마스코트와 지갑"),
    card("firstpay", 2, "오해 vs 팩트 — 세전을 다 받는다 / 공제를 빼고 받는다", "왼쪽은 큰 동전 자루를 안고 빈 지갑을 본 마스코트, 오른쪽은 작은 자루를 들고 통에 동전을 나눠 주는 마스코트"),
    card("firstpay", 3, "1줄 지급 — 기본급·수당을 더한 세전", "책상 위 빈 카드 세 장과 동전, 첫 장을 가리키는 마스코트"),
    card("firstpay", 4, "2줄 공제 — 4대보험과 세금, 가상 33만 원", "작은 통 네 개에 동전이 쏟아지는 모습을 살피는 마스코트"),
    card("firstpay", 5, "3줄 실수령 — 267만 원을 세 칸으로", "동전을 세 유리병에 나누는 마스코트, 우산·달력·새싹이 각 병 옆에"),
    card("firstpay", 6, "오늘 할 일 — 세 숫자에 동그라미", "긴 명세서의 세 줄을 빨간 연필로 동그라미하는 마스코트"),
  ],
};

export const schoolCardSetById = (id: string): LessonCardSet | undefined =>
  [SET_ALLOWANCE, SET_TEEN_PAY, SET_FIRSTPAY].find((s) => s.id === id);

/* ------------------------------------------------------------------
   초등 1강 — 용돈 7,000원, 세 칸
   ------------------------------------------------------------------ */
const ALLOWANCE = 7000;
const A_SPEND = 3000;
const A_SAVE = 3000;
const A_KEEP = ALLOWANCE - A_SPEND - A_SAVE; // 1,000
const A_GOAL = 30000;
const A_HAVE = 6000;
const A_NEED = A_GOAL - A_HAVE; // 24,000
const A_WEEKS = 8;
const A_PER_WEEK = A_NEED / A_WEEKS; // 3,000
const A_SHORT_WEEKS = 6;
const A_PER_WEEK_SHORT = A_NEED / A_SHORT_WEEKS; // 4,000

const N_ELEM = {
  allowance: won(ALLOWANCE),
  spend: won(A_SPEND),
  save: won(A_SAVE),
  keep: won(A_KEEP),
  goal: won(A_GOAL),
  have: won(A_HAVE),
  need: won(A_NEED),
  perWeek: won(A_PER_WEEK),
  weeks: `${A_WEEKS}주`,
  perWeekShort: won(A_PER_WEEK_SHORT),
  shortWeeks: `${A_SHORT_WEEKS}주`,
};

const READING_ELEM: ReadingSection[] = [
  {
    h: "용돈을 받은 날, 무엇부터 하나",
    ps: [
      `용돈 ${N_ELEM.allowance}을 받으면 무엇부터 해야 할까요? 결론은 '쓰기 전에 세 칸으로 먼저 나눈다'입니다. 남은 돈을 모으는 것이 아니라, 모을 돈을 먼저 떼어 두고 남은 돈으로 사는 순서입니다.`,
      `세 칸은 이렇게 나눕니다. ① 지금 쓸 돈은 이번 주에 쓸 간식·문구 값, ② 모을 돈은 갖고 싶은 것에 쓰는 돈, ③ 남길 돈은 갑자기 필요할 때 쓰는 돈입니다. 세 칸을 더하면 용돈 전부가 되어야 합니다.`,
      `봉투 세 개에 이름을 쓰고 나눠 넣으면 준비가 끝납니다. 통장이 없어도 되고, 앱을 새로 만들 필요도 없습니다. 눈에 보이는 봉투가 정한 금액을 지켜 줍니다.`,
    ],
  },
  {
    h: "7,000원을 세 칸으로 나누면",
    ps: [
      `이번 주 용돈이 ${N_ELEM.allowance}이라면 ① 지금 쓸 돈 ${N_ELEM.spend}, ② 모을 돈 ${N_ELEM.save}, ③ 남길 돈 ${N_ELEM.keep}으로 나눕니다. ①은 이번 주 안에 다 써도 됩니다. 정해 둔 만큼만 쓰는 연습입니다.`,
      `②는 목표가 있어야 힘이 납니다. 갖고 싶은 것의 가격을 먼저 적어 보세요. 여기서는 ${N_ELEM.goal}짜리 자전거를 목표로 두겠습니다. 이미 모아 둔 ${N_ELEM.have}이 있으면 더 필요한 돈은 ${N_ELEM.need}입니다.`,
      `③은 작아도 꼭 필요합니다. 친구 생일이나 준비물처럼 갑자기 드는 돈은 ①에서 나오지 않습니다. ③이 없으면 ②에서 꺼내게 되고, 목표는 그만큼 늦어집니다.`,
      `세 칸을 종이에 적어 눈에 보이는 곳에 붙여 두면 가족과 이야기하기도 쉬워집니다. 이번 주에 얼마를 모으기로 했는지 서로 알고 있으면, 갑자기 드는 지출도 ③에서 꺼내 쓸 수 있습니다.`,
    ],
  },
  {
    h: "목표까지 몇 주가 걸릴까",
    ps: [
      `더 필요한 ${N_ELEM.need}을 ②로 매주 ${N_ELEM.perWeek}씩 넣으면 ${N_ELEM.weeks}이 걸립니다. ${N_ELEM.weeks} × ${N_ELEM.perWeek} = ${N_ELEM.need}이기 때문입니다. 여기에 이미 모은 ${N_ELEM.have}을 더하면 목표 ${N_ELEM.goal}이 됩니다.`,
      `중간에 2주를 쉬면 계산이 달라집니다. 남은 ${N_ELEM.shortWeeks} 동안 ${N_ELEM.need}을 모아야 하므로 매주 ${N_ELEM.perWeekShort}이 됩니다. 쉰 만큼 다음 주에 더 넣거나, 목표 날짜를 미루는 것 중 하나를 고르면 됩니다.`,
      `이미 목표만큼 모았다면 ②는 새 목표로 바꿉니다. 0주 동안 나눌 수는 없기 때문입니다. 목표가 없을 때는 ②를 ③으로 옮겨 급할 때 쓰는 돈을 두껍게 만듭니다.`,
    ],
  },
  {
    h: "물가가 오르면 같은 돈으로 덜 사요",
    ps: [
      `물가는 물건 값이 오르는 것입니다. 같은 ${won(1000)}으로 살 수 있는 과자 수가 줄어들면, 용돈은 그대로인데 살 수 있는 양만 줄어듭니다. 그래서 목표 가격은 한 번 정하고 끝내지 않고, 사기 전에 다시 확인합니다.`,
      `가게에서 같은 물건의 단위 가격을 비교하면 이 차이를 볼 수 있습니다. 100g에 ${won(1000)}인 것과 200g에 ${won(1500)}인 것 중, 필요한 양이 100g이라면 앞의 것이 낫습니다. 싸 보이는 쪽이 항상 이기는 것은 아닙니다.`,
      `용돈은 오르지 않아도 목표 가격은 오를 수 있습니다. 그래서 ②의 목표 금액을 적을 때 '지금 가격'과 '산 날 가격'을 함께 적어 두면, 모으는 동안 얼마나 더 필요한지 알 수 있습니다.`,
      `목표 가격이 오르면 ②의 금액을 올리거나 기간을 늘립니다. 둘 중 하나만 바꾸면 되고, 둘 다 그대로 두면 목표는 뒤로 밀립니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 세 칸 비율과 목표 주수는 이 강의의 예시이고, 법으로 정해진 값이 아닙니다. 물가 통계는 통계청 소비자물가지수에서 확인할 수 있습니다.`,
    ],
  },
];

const QUIZ_ELEM: LessonQuizItem[] = [
  {
    q: `용돈 ${N_ELEM.allowance}을 세 칸으로 나눌 때, 세 칸을 더하면 얼마가 되어야 할까요?`,
    hint: "세 칸은 용돈을 쪼개는 것이지, 늘리는 것이 아닙니다.",
    options: [
      { label: `${N_ELEM.allowance} — 용돈 전부`, ok: true, why: `맞아요. ${N_ELEM.spend} + ${N_ELEM.save} + ${N_ELEM.keep} = ${N_ELEM.allowance}입니다.` },
      { label: `${N_ELEM.goal} — 목표 금액`, why: "목표는 모을 돈의 도착점입니다. 세 칸의 합과는 다릅니다." },
      { label: "정해진 답이 없다", why: "합이 용돈보다 크면 어딘가에서 돈이 더 나와야 합니다. 합은 용돈과 같아야 합니다." },
    ],
    explain: "세 칸의 합은 언제나 받은 용돈과 같습니다. 남는 돈이 생기는 구조가 아니라, 먼저 나누는 구조입니다.",
  },
  {
    q: `목표 ${N_ELEM.goal}, 이미 모은 돈 ${N_ELEM.have}. 8주 안에 모으려면 매주 얼마를 넣어야 할까요?`,
    hint: `더 필요한 돈은 ${N_ELEM.need}입니다.`,
    options: [
      { label: `${N_ELEM.perWeek}`, ok: true, why: `${N_ELEM.need} ÷ 8주 = ${N_ELEM.perWeek}입니다.` },
      { label: `${N_ELEM.save}`, why: "이번 주 ②로 정한 금액입니다. 목표와 남은 기간으로 다시 계산해야 합니다." },
      { label: `${N_ELEM.goal}`, why: "목표 전액을 매주 넣는 것이 아니라, 남은 금액을 나눕니다." },
    ],
    explain: "목표에서 이미 모은 돈을 빼고, 남은 기간으로 나눕니다.",
  },
  {
    q: "2주를 쉬어서 남은 기간이 6주가 되었습니다. 같은 목표를 맞추려면 어떻게 해야 할까요?",
    hint: "필요한 총액은 그대로입니다.",
    options: [
      { label: `매주 ${N_ELEM.perWeekShort}로 올리거나, 목표 날짜를 미룬다`, ok: true, why: `남은 6주에 ${N_ELEM.need}을 나누면 ${N_ELEM.perWeekShort}입니다.` },
      { label: "그대로 매주 3,000원만 넣는다", why: "그러면 8주가 아니라 더 오래 걸립니다. 목표 날짜를 함께 고쳐야 합니다." },
      { label: "목표를 포기한다", why: "포기하지 않아도 됩니다. 금액이나 기간 중 하나만 바꾸면 됩니다." },
    ],
    explain: "쉰 주만큼 매주 금액을 올리거나, 기간을 늘리는 두 가지 선택이 있습니다.",
  },
];

/* ------------------------------------------------------------------
   청소년 1강 — 소액결제와 먼저 받는 돈
   ------------------------------------------------------------------ */
const SUB_MONTH = 5000;
const SUB_YEAR = SUB_MONTH * 12; // 60,000
const MICRO_MONTH = 30000;
const MICRO_YEAR = MICRO_MONTH * 12; // 360,000
const BNPL_PRICE = 200000;
const BNPL_RATE = 0.05;
const BNPL_FEE = BNPL_PRICE * BNPL_RATE; // 10,000
const BNPL_TOTAL = BNPL_PRICE + BNPL_FEE;

const N_TEEN = {
  subMonth: won(SUB_MONTH),
  subYear: won(SUB_YEAR),
  microMonth: won(MICRO_MONTH),
  microYear: won(MICRO_YEAR),
  bnplPrice: won(BNPL_PRICE),
  bnplRate: `${BNPL_RATE * 100}%`,
  bnplFee: won(BNPL_FEE),
  bnplTotal: won(BNPL_TOTAL),
  bnplMonths: "3개월",
  perMonth: won(Math.round(BNPL_TOTAL / 3)),
};

const READING_TEEN: ReadingSection[] = [
  {
    h: "작은 결제가 1년이면 얼마가 되나",
    ps: [
      `월 ${N_TEEN.subMonth}짜리 구독은 1년이면 ${N_TEEN.subYear}입니다. 한 달만 보면 작지만, 12번이 쌓이면 커집니다. 결제를 줄이기 전에 먼저 할 일은 '1년으로 바꿔 보는 것'입니다.`,
      `계산은 간단합니다. 월 결제액 × 12개월입니다. 월 ${N_TEEN.microMonth}을 게임 아이템과 소액결제에 쓴다면 1년에 ${N_TEEN.microYear}입니다. 이 돈이면 목표로 정한 물건을 살 수 있는지 견줘 보세요.`,
      `구독은 쓰지 않는 달에도 빠져나갑니다. 결제 내역에서 '매달 같은 날 같은 금액'이 빠지는 항목을 찾으면 구독입니다. 3개월 넘게 쓰지 않은 구독은 정리 목록에 올립니다.`,
      `정리할 때는 해지 버튼부터 찾지 말고 결제일을 먼저 확인합니다. 결제일 하루 전에 해지하면 그 달 금액을 아끼고, 이미 결제된 달은 다음 결제일부터 멈춥니다.`,
    ],
  },
  {
    h: "먼저 받는 결제, 총액으로 보기",
    ps: [
      `먼저 사고 나중에 갚는 결제를 BNPL(Buy Now, Pay Later — 먼저 받고 나중에 갚는 결제)이라고 합니다. ${N_TEEN.bnplPrice}을 ${N_TEEN.bnplMonths}로 나눠 갚을 때 수수료가 ${N_TEEN.bnplRate}라면 ${N_TEEN.bnplFee}이 붙어, 갚을 총액은 ${N_TEEN.bnplTotal}입니다.`,
      `광고는 '월 ${N_TEEN.perMonth}'처럼 한 달 금액을 크게 보여 줍니다. 내가 갚을 총액은 월 납부액 × 개월 수입니다. 여기에 수수료(결제를 나눠 갈 때 붙는 값)와 연체료가 붙으면 더 커집니다.`,
      `갚을 돈이 다음 달 용돈에 이미 들어 있는지 확인합니다. 다음 달에 다른 결제가 예정되어 있다면, 그 달에 갚을 돈이 겹칩니다. 겹치는 달이 있으면 개월 수를 늘리기 전에 사는 것을 미룹니다.`,
    ],
  },
  {
    h: "연체는 다음 결제를 막습니다",
    ps: [
      `갚는 날을 넘기면 연체가 됩니다. 연체료가 붙고, 심하면 다음에 같은 결제를 쓰지 못합니다. 한 번의 연체가 다음 달 계획까지 바꾸기 때문에, 갚는 날은 달력에 먼저 적어 둡니다.`,
      `결제 앱의 알림을 켜 두면 갚는 날을 놓치지 않습니다. 알림이 오면 그날 바로 갚는 것이 원칙입니다. 미루는 습관이 들면 금액이 작아도 다음 결제가 어려워집니다.`,
      `이미 연체가 생겼다면 숨기지 말고 어른에게 말합니다. 혼자 해결하려다 다른 곳에서 또 빌리면 총액이 눈덩이처럼 커집니다.`,
      `연체가 생기면 결제 앱의 알림을 켜고, 갚는 날을 가족 달력에도 함께 적습니다. 혼자 기억하지 않아도 되게 만드는 것이 가장 확실합니다.`,
    ],
  },
  {
    h: "송금 요청이 오면 멈춥니다",
    ps: [
      `모르는 사람이 '지금 송금하면 경품을 준다', '대신 받아서 넘겨 달라'고 하면 사기일 수 있습니다. 급하게 재촉하고, 다른 곳으로 옮기라고 하면 더 조심합니다.`,
      `순서는 셋입니다. ① 멈추고 ② 가족이나 보호자에게 알리고 ③ 공식 번호로 확인합니다. 경찰은 112, 금융감독원 불법금융 신고는 1332입니다. 메시지에 적힌 번호는 쓰지 않습니다.`,
      `사기 메시지는 대개 급하게 재촉하고, 다른 사람에게 말하지 말라고 합니다. 이 두 가지가 보이면 내용을 읽기 전에 멈춥니다.`,
      `내 계좌로 돈이 들어왔다고 남의 돈을 대신 보내 달라는 요청도 거절합니다. 내 통장이 범죄에 쓰이면 계좌가 멈출 수 있습니다. 받은 돈은 건드리지 말고 은행과 경찰에 알립니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 구독·소액결제·BNPL 금액은 계산을 보여 주기 위한 가상 값입니다. 신고 경로는 경찰청(112)과 금융감독원 불법금융신고센터(1332) 안내를 확인했습니다.`,
    ],
  },
];

const QUIZ_TEEN: LessonQuizItem[] = [
  {
    q: `월 ${N_TEEN.subMonth} 구독 하나를 1년 동안 쓰면 모두 얼마일까요?`,
    hint: "12개월을 곱해 보세요.",
    options: [
      { label: N_TEEN.subYear, ok: true, why: `${N_TEEN.subMonth} × 12개월 = ${N_TEEN.subYear}입니다.` },
      { label: won(SUB_MONTH * 6), why: "6개월치입니다. 1년은 12개월입니다." },
      { label: N_TEEN.subMonth, why: "한 달 금액입니다. 1년으로 바꿔 보는 것이 이 강의의 핵심입니다." },
    ],
    explain: "작은 월 결제도 12개월로 바꾸면 크기가 보입니다.",
  },
  {
    q: `${N_TEEN.bnplPrice}을 3개월로 나눠 갚고 수수료가 ${N_TEEN.bnplRate}라면, 갚을 총액은 얼마일까요?`,
    hint: `수수료 ${N_TEEN.bnplFee}을 더합니다.`,
    options: [
      { label: N_TEEN.bnplTotal, ok: true, why: `${N_TEEN.bnplPrice} + ${N_TEEN.bnplFee} = ${N_TEEN.bnplTotal}입니다.` },
      { label: N_TEEN.bnplPrice, why: "물건 값만 본 금액입니다. 수수료를 빼면 실제로 갚을 돈이 아닙니다." },
      { label: N_TEEN.perMonth, why: "한 달에 갚는 금액입니다. 총액은 개월 수를 곱해야 합니다." },
    ],
    explain: "먼저 받는 결제는 월 납부액이 아니라 갚을 총액으로 비교합니다.",
  },
  {
    q: "모르는 사람이 '지금 송금하면 경품을 준다'고 합니다. 가장 먼저 할 일은?",
    hint: "돈을 보내기 전에 할 일입니다.",
    options: [
      { label: "멈추고 가족에게 알린 뒤 112·1332로 확인한다", ok: true, why: "송금 전에 멈추고, 별도 공식 번호로 확인하는 순서가 맞습니다." },
      { label: "메시지에 적힌 번호로 전화해 확인한다", why: "사기범이 적어 둔 번호일 수 있습니다. 공식 번호로 걸어야 합니다." },
      { label: "경품이 크면 먼저 송금한다", why: "금액이 클수록 손실도 큽니다. 먼저 보내면 되돌리기 어렵습니다." },
    ],
    explain: "멈춤 → 가족에게 알림 → 공식 번호(112·1332) 확인, 이 순서를 기억합니다.",
  },
];

/* ------------------------------------------------------------------
   첫 월급 1강 — 명세서 3줄
   ------------------------------------------------------------------ */
const GROSS = 3_000_000;
const PENSION_RATE = 0.045; // 국민연금 근로자 부담 9%의 절반
const EMPLOYMENT_RATE = 0.009; // 고용보험(실업급여) 근로자 부담
const PENSION_WON = Math.round(GROSS * PENSION_RATE); // 135,000
const HEALTH_WON = Math.round(GROSS * HEALTH_INSURANCE.employeeShare); // 107,850
const CARE_WON = Math.round((GROSS * HEALTH_INSURANCE.longTermCareRate) / 2); // 14,172
const EMPLOYMENT_WON = Math.round(GROSS * EMPLOYMENT_RATE); // 27,000
const INSURANCE_WON = PENSION_WON + HEALTH_WON + CARE_WON + EMPLOYMENT_WON; // 284,022
const DEDUCTION_WON = 330_000; // 가상 공제 합계(4대보험 + 소득세·지방소득세)
const TAX_WON = DEDUCTION_WON - INSURANCE_WON; // 45,978
const NET = GROSS - DEDUCTION_WON; // 2,670,000
const FIXED = 1_200_000;
const VARIABLE = 600_000;
const SPARE = NET - FIXED - VARIABLE; // 870,000
const BUCKET_A = Math.round(SPARE * 0.5); // 435,000
const BUCKET_B = Math.round(SPARE * 0.2); // 174,000
const BUCKET_C = SPARE - BUCKET_A - BUCKET_B; // 261,000

const N_PAY = {
  gross: manwon(GROSS / 10000),
  grossWon: won(GROSS),
  net: manwon(NET / 10000),
  netWon: won(NET),
  deduction: manwon(DEDUCTION_WON / 10000),
  insurance: won(INSURANCE_WON),
  tax: won(TAX_WON),
  pension: won(PENSION_WON),
  health: won(HEALTH_WON),
  care: won(CARE_WON),
  employment: won(EMPLOYMENT_WON),
  fixed: manwon(FIXED / 10000),
  variable: manwon(VARIABLE / 10000),
  spare: manwon(SPARE / 10000),
  bucketA: manwon(BUCKET_A / 10000),
  bucketB: manwon(BUCKET_B / 10000),
  bucketC: manwon(BUCKET_C / 10000),
};

const READING_PAY: ReadingSection[] = [
  {
    h: "세전과 실수령은 다릅니다",
    ps: [
      `첫 월급명세서에서 세전 ${N_PAY.gross}, 통장에 들어온 돈 ${N_PAY.net}. 왜 ${N_PAY.deduction}이 빠졌을까요? 결론부터 말하면 명세서는 세 줄입니다. ① 지급 합계(세전) ② 공제 합계 ③ 실수령입니다.`,
      `지급 합계는 기본급과 수당을 더한 금액입니다. 계약서에 적힌 월급과 같은 경우가 많지만, 식대·차량비처럼 일부 수당이 빠져 있을 수 있습니다. 두 숫자가 다르면 명세서의 지급 항목을 먼저 봅니다.`,
      `공제 합계는 회사가 대신 내고 나중에 내 월급에서 빼는 돈입니다. 여기에는 4대보험료와 소득세·지방소득세가 들어갑니다. 실수령은 세전에서 공제를 뺀 금액입니다.`,
    ],
  },
  {
    h: "4대보험은 이름이 네 개입니다",
    ps: [
      `4대보험은 국민연금, 건강보험, 장기요양보험, 고용보험입니다. 근로자는 회사와 나눠 냅니다. ${N_PAY.grossWon}을 기준으로 2026년 근로자 부담은 국민연금 ${N_PAY.pension}, 건강보험 ${N_PAY.health}, 장기요양 ${N_PAY.care}, 고용보험 ${N_PAY.employment}입니다.`,
      `네 개를 더하면 ${N_PAY.insurance}입니다. 여기에 소득세와 지방소득세(소득세에 10%를 더 붙이는 지방세)가 더해집니다. 이 강의에서는 세금을 포함한 공제 합계를 ${N_PAY.deduction}(가상)으로 두었고, 그중 세금 몫은 ${N_PAY.tax}입니다.`,
      `소득세는 부양가족 수, 비과세 항목, 회사의 정산 방식에 따라 달라집니다. 그래서 남의 명세서와 비교하지 말고, 내 명세서의 공제 합계를 직접 읽어야 합니다.`,
      `회사가 내는 몫은 명세서에 '사업주 부담'으로 따로 적히기도 합니다. 내 월급에서 빠지는 돈과 회사가 더 내는 돈은 다릅니다.`,
      `건강보험료는 명세서의 공제 항목에 들어갑니다. 실손보험은 회사가 자동으로 들어 주는 것이 아니라 내가 가입한 상품이므로, 보장 여부와 자기부담률을 약관에서 확인합니다.`,
    ],
  },
  {
    h: "실수령에서 다시 세 칸",
    ps: [
      `실수령 ${N_PAY.netWon}에서 고정비 ${N_PAY.fixed}, 변동비 ${N_PAY.variable}를 빼면 남는 돈은 ${N_PAY.spare}입니다. 첫 달부터 이 계산을 해 두면, 다음 달에 무엇이 모자라는지 금방 보입니다.`,
      `남는 돈은 세 칸으로 나눕니다. ① 비상금 ${N_PAY.bucketA}, ② 단기목표 ${N_PAY.bucketB}, ③ 장기 ${N_PAY.bucketC}입니다. 비상금은 생활비 몇 달을 버티는 돈이라 가장 먼저 채웁니다.`,
      `첫 달에는 금액이 작아도 괜찮습니다. 중요한 것은 '세전 → 공제 → 실수령'을 내 숫자로 한 번 계산해 보는 것입니다. 두 번째 달부터는 명세서를 보는 속도가 달라집니다.`,
    ],
  },
  {
    h: "명세서에서 꼭 확인할 세 가지",
    ps: [
      `첫째, 지급 합계가 계약한 월급과 같은지 봅니다. 둘째, 공제 항목 이름이 4대보험과 세금으로 나뉘어 있는지 봅니다. 셋째, 실수령이 통장에 들어온 금액과 같은지 봅니다.`,
      `모르는 공제가 있으면 그 자리에서 물어봅니다. '이 공제는 무슨 항목인가요'라고 묻는 것은 실례가 아닙니다. 내 돈이 어디로 갔는지 아는 것이 첫 월급의 시작입니다.`,
      `명세서는 버리지 말고 모아 둡니다. 연말정산과 이직할 때 지난 달 명세서가 필요합니다. 종이를 받았다면 사진으로 남겨 두고, 급여명세 시스템이 있으면 내려받기 기능을 확인합니다. 사진을 남길 때는 이름·주민번호 같은 개인정보가 함께 찍히지 않았는지도 봅니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 건강보험료율·장기요양보험료율은 2026년 기준(건강보험 7.19%, 장기요양 0.9448%)이며, 국민연금 4.5%·고용보험 0.9%는 근로자 부담 몫입니다. 공제 합계 ${N_PAY.deduction}과 세금 몫은 계산을 보여 주기 위한 가상 값이므로, 실제 금액은 명세서와 국세청 안내에서 확인합니다.`,
    ],
  },
];

const QUIZ_PAY: LessonQuizItem[] = [
  {
    q: `월급명세서에서 '세전'은 무엇을 말할까요?`,
    hint: "공제 전인지 후인지 생각해 보세요.",
    options: [
      { label: "공제를 빼기 전, 지급 항목의 합계", ok: true, why: "기본급과 수당을 더한 금액입니다. 여기서 공제를 빼면 실수령이 됩니다." },
      { label: "공제를 빼고 통장에 들어온 금액", why: "그것은 실수령입니다." },
      { label: "회사가 대신 내는 4대보험료", why: "그것은 공제 항목이고, 회사 부담분은 따로 표시됩니다." },
    ],
    explain: "세전 → 공제 → 실수령, 세 줄의 순서를 먼저 익힙니다.",
  },
  {
    q: `세전 ${N_PAY.grossWon}, 공제 합계 ${N_PAY.deduction}(가상)일 때 실수령은 얼마일까요?`,
    hint: "세전에서 공제를 뺍니다.",
    options: [
      { label: N_PAY.netWon, ok: true, why: `${N_PAY.grossWon} − ${N_PAY.deduction} = ${N_PAY.netWon}입니다.` },
      { label: N_PAY.grossWon, why: "공제를 빼지 않은 금액입니다." },
      { label: N_PAY.deduction, why: "공제 합계 자체입니다." },
    ],
    explain: "실수령 = 세전 − 공제 합계입니다.",
  },
  {
    q: "명세서에 모르는 공제 항목이 있습니다. 어떻게 할까요?",
    hint: "내 돈이 어디로 갔는지 아는 것이 먼저입니다.",
    options: [
      { label: "회사 담당자에게 항목 이름과 계산 방법을 묻는다", ok: true, why: "물어보는 것이 맞습니다. 다음 달부터 명세서를 읽을 수 있습니다." },
      { label: "금액이 작으면 그냥 넘어간다", why: "작아도 매달 빠지는 돈입니다. 1년이면 커집니다." },
      { label: "비슷한 또래의 명세서와 비교한다", why: "부양가족·비과세·회사 정산이 달라 숫자가 다를 수 있습니다." },
    ],
    explain: "내 명세서의 항목을 직접 확인하고 묻는 것이 가장 정확합니다.",
  },
];

/* ------------------------------------------------------------------
   강의 3개
   ------------------------------------------------------------------ */
export const SCHOOL_LESSONS: AcademyLesson[] = [
  {
    slug: "school-elementary-allowance",
    track: "elementary",
    thesis: `용돈 ${N_ELEM.allowance}을 ① 지금 쓸 돈 ${N_ELEM.spend}, ② 모을 돈 ${N_ELEM.save}, ③ 남길 돈 ${N_ELEM.keep}으로 먼저 나누면, 목표 ${N_ELEM.goal}을 ${N_ELEM.weeks}에 모을 수 있습니다.`,
    step: 0,
    no: 1,
    label: "초등 1강",
    shortTitle: "용돈 7,000원, 세 칸",
    title: "용돈 7,000원, 세 칸으로 나누면 무엇이 달라질까?",
    question: "용돈은 어디에 먼저 넣을까",
    readingMinutes: 5,
    hook: `같은 ${N_ELEM.allowance}이라도 다 쓰는 사람과 세 칸으로 나누는 사람은 ${N_ELEM.weeks} 뒤 가진 돈이 다릅니다.`,
    fork: {
      short: {
        tag: "받으면 바로 쓴다",
        head: "먼저 쓸 돈부터 정해요",
        body: `이번 주에 쓸 돈을 ${N_ELEM.spend}으로 정하고, 나머지는 봉투에 넣습니다. 지갑에는 쓸 돈만 둡니다.`,
        verdict: "쓸 돈을 정해 두면 충동구매가 줄어듭니다.",
      },
      long: {
        tag: "갖고 싶은 것이 있다",
        head: "모을 돈부터 계산해요",
        body: `목표 ${N_ELEM.goal}에 이미 ${N_ELEM.have}이 있으면 ${N_ELEM.need}이 더 필요합니다. ${N_ELEM.weeks}로 나누면 매주 ${N_ELEM.perWeek}입니다.`,
        verdict: "이 글의 주제입니다. 아래에서 내 숫자로 나눠 봅니다.",
      },
    },
    keyNumbers: [
      { label: "용돈", value: N_ELEM.allowance },
      { label: "모을 돈", value: `매주 ${N_ELEM.perWeek}` },
      { label: "목표", value: `${N_ELEM.weeks} · ${N_ELEM.goal}` },
    ],
    numbers: N_ELEM,
    calculator: {
      name: "용돈 세 칸 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 용돈과 두 칸을 고르면 세 번째 칸과 목표까지 걸리는 주가 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "split",
        label: "세 칸 나누기",
        title: `${N_ELEM.allowance} = ${N_ELEM.spend} + ${N_ELEM.save} + ${N_ELEM.keep}`,
        settings: ["이번 주 용돈 7,000원", "쓸 돈 3,000원", "모을 돈 3,000원"],
        result: `남길 돈 ${N_ELEM.keep}`,
        expect: "세 칸을 더하면 용돈 전부가 됩니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "goal8",
        label: "목표 8주",
        title: `${N_ELEM.goal} − ${N_ELEM.have} = ${N_ELEM.need} → 8주`,
        settings: ["목표 30,000원", "이미 모은 6,000원", "매주 3,000원"],
        result: `${N_ELEM.weeks}에 도달`,
        expect: "8주 × 3,000원 = 24,000원입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "skip2",
        label: "2주 쉬면",
        title: `남은 6주에 ${N_ELEM.need} → 매주 ${N_ELEM.perWeekShort}`,
        settings: ["2주를 쉼", "남은 기간 6주", "같은 목표 30,000원"],
        result: `매주 ${N_ELEM.perWeekShort}`,
        expect: "금액을 올리거나 목표 날짜를 미룹니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
    ],
    sources: [
      {
        label: "금융감독원 e-금융교육센터",
        what: "초등·청소년 금융교육 자료(용돈 관리·저축의 기본)",
        url: "https://edu.fss.or.kr/",
        host: "edu.fss.or.kr",
      },
      {
        label: "통계청 — 소비자물가지수",
        what: "물가가 오르면 같은 돈으로 살 수 있는 양이 어떻게 달라지는지 보는 통계",
        url: "https://kostat.go.kr/",
        host: "kostat.go.kr",
      },
      {
        label: "한국은행 — 경제교육",
        what: "물가와 화폐의 역할을 어린이 눈높이로 설명한 공식 자료",
        url: "https://www.bok.or.kr/",
        host: "bok.or.kr",
      },
    ],
    cardSet: SET_ALLOWANCE,
    sheet: {
      variant: "allowance",
      slotNo: 1,
      slotTitle: "용돈 약속 카드",
      line: "용돈을 세 칸으로 나눈 금액과 목표까지 걸리는 주를 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-03 · 목표 가격과 모을 기간",
      body: "목표 가격이 바뀌면 필요한 주 수도 바뀝니다. 다음 편에서 가격과 기간을 함께 계산합니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_ELEM },
    reading: READING_ELEM,
  },
  {
    slug: "school-teen-payments",
    track: "teen",
    thesis: `월 ${N_TEEN.subMonth} 구독은 1년 ${N_TEEN.subYear}, 월 ${N_TEEN.microMonth} 소액결제는 1년 ${N_TEEN.microYear}입니다. 먼저 받는 결제는 수수료를 더한 갚을 총액으로 비교합니다.`,
    step: 0,
    no: 1,
    label: "청소년 1강",
    shortTitle: "소액결제·먼저 받는 돈",
    title: "소액결제와 먼저 받는 돈, 12개월 뒤 얼마가 되나?",
    question: "작은 결제가 1년이면 얼마가 될까",
    readingMinutes: 5,
    hook: `월 ${N_TEEN.subMonth}은 작아 보이지만 1년이면 ${N_TEEN.subYear}입니다. 12번이 쌓이면 목표로 정한 물건 값을 넘기도 합니다.`,
    fork: {
      short: {
        tag: "한 달 금액만 본다",
        head: "12개월로 바꿔 보세요",
        body: `월 ${N_TEEN.microMonth}을 12개월로 바꾸면 ${N_TEEN.microYear}입니다. 결제 내역에서 매달 빠지는 금액을 먼저 찾습니다.`,
        verdict: "한 달 금액과 1년 금액을 같이 적어 두면 판단이 달라집니다.",
      },
      long: {
        tag: "먼저 받는 결제를 쓴다",
        head: "갚을 총액을 계산해요",
        body: `${N_TEEN.bnplPrice}을 3개월로 나눠도 수수료 ${N_TEEN.bnplFee}이 붙으면 ${N_TEEN.bnplTotal}을 갚습니다. 연체하면 더 늘어납니다.`,
        verdict: "이 글의 주제입니다. 아래에서 총액과 신고 경로를 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "월 5,000원 구독", value: `1년 ${N_TEEN.subYear}` },
      { label: "월 3만원 결제", value: `1년 ${N_TEEN.microYear}` },
      { label: "BNPL 총액", value: N_TEEN.bnplTotal },
    ],
    numbers: N_TEEN,
    calculator: {
      name: "구독·BNPL 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 월 결제액과 BNPL 조건을 고르면 1년 반복 결제와 갚을 총액이 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "sub",
        label: "구독 1년",
        title: `${N_TEEN.subMonth} × 12개월 = ${N_TEEN.subYear}`,
        settings: ["월 구독 5,000원", "12개월", "가상 금액"],
        result: `1년 ${N_TEEN.subYear}`,
        expect: "쓰지 않는 달에도 빠져나가는 돈입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "micro",
        label: "소액결제 1년",
        title: `${N_TEEN.microMonth} × 12개월 = ${N_TEEN.microYear}`,
        settings: ["월 30,000원", "게임·아이템·소액결제", "12개월"],
        result: `1년 ${N_TEEN.microYear}`,
        expect: "결제 내역에서 매달 같은 금액을 찾아 합칩니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "bnpl",
        label: "BNPL 총액",
        title: `${N_TEEN.bnplPrice} + 수수료 ${N_TEEN.bnplFee} = ${N_TEEN.bnplTotal}`,
        settings: ["200,000원", "3개월", "수수료 5% 가정"],
        result: `갚을 총액 ${N_TEEN.bnplTotal}`,
        expect: "월 납부액이 아니라 갚을 총액으로 비교합니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
    ],
    sources: [
      {
        label: "금융감독원 불법금융신고센터 — 1332",
        what: "보이스피싱·불법 대출·송금 요청을 신고하는 공식 창구",
        url: "https://1332.fss.or.kr/",
        host: "1332.fss.or.kr",
      },
      {
        label: "경찰청 — 112",
        what: "사기·협박 등 긴급 상황에서 경찰에 알리는 번호",
        url: "https://www.police.go.kr/",
        host: "police.go.kr",
      },
      {
        label: "금융감독원 파인 — 금융상품 비교",
        what: "수수료와 조건을 상품명 없이 비교하는 공식 공시",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
    ],
    cardSet: SET_TEEN_PAY,
    sheet: {
      variant: "teenplan",
      slotNo: 1,
      slotTitle: "구독 정리표",
      line: "월 반복 결제와 BNPL 조건을 넣어 1년 비용과 갚을 총액을 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-16 · 첫 월간예산 다시 짜기",
      body: "결제가 늘어난 달의 예산을 다시 짜 봅니다. 줄일 항목과 남길 항목을 직접 고릅니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_TEEN },
    reading: READING_TEEN,
  },
  {
    slug: "school-firstpay-stub",
    track: "firstpay",
    thesis: `명세서는 ① 지급 합계(세전) ② 공제 합계 ③ 실수령 세 줄입니다. 세전 ${N_PAY.grossWon}에서 공제 ${N_PAY.deduction}(가상)을 빼면 실수령 ${N_PAY.netWon}입니다.`,
    step: 0,
    no: 1,
    label: "첫 월급 1강",
    shortTitle: "첫 월급명세서 3줄",
    title: "첫 월급명세서, 세전 300만 원에서 왜 33만 원이 빠질까?",
    question: "통장에 들어온 돈은 왜 세전보다 적을까",
    readingMinutes: 5,
    hook: `세전 ${N_PAY.gross}과 실수령 ${N_PAY.net}의 차이 ${N_PAY.deduction}. 이 돈의 이름을 알면 다음 달 명세서가 달라집니다.`,
    fork: {
      short: {
        tag: "세전이 곧 월급이다",
        head: "통장에 들어온 돈이 실수령",
        body: `세전 ${N_PAY.gross}에서 4대보험과 세금 ${N_PAY.deduction}을 빼고 ${N_PAY.net}이 들어옵니다. 차이의 이름을 먼저 확인합니다.`,
        verdict: "명세서 세 줄을 읽으면 차이가 설명됩니다.",
      },
      long: {
        tag: "공제 항목이 궁금하다",
        head: "4대보험부터 확인해요",
        body: `국민연금 ${N_PAY.pension}, 건강보험 ${N_PAY.health}, 장기요양 ${N_PAY.care}, 고용보험 ${N_PAY.employment}을 더하면 ${N_PAY.insurance}입니다.`,
        verdict: "이 글의 주제입니다. 아래에서 세전→공제→실수령을 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "세전", value: N_PAY.gross },
      { label: "공제(가상)", value: N_PAY.deduction },
      { label: "실수령", value: N_PAY.net },
    ],
    numbers: N_PAY,
    calculator: {
      name: "첫 월급 세 칸 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 세전·공제·고정비를 고르면 실수령과 세 칸 금액이 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "stub",
        label: "세 줄",
        title: `${N_PAY.grossWon} − ${N_PAY.deduction} = ${N_PAY.netWon}`,
        settings: ["세전 300만원", "공제 33만원(가상)", "실수령 267만원"],
        result: `실수령 ${N_PAY.netWon}`,
        expect: "명세서의 지급·공제·실수령을 같은 순서로 읽습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "insurance",
        label: "4대보험",
        title: `4대보험 근로자 부담 ${N_PAY.insurance}`,
        settings: ["국민연금 4.5%", "건강보험 3.595% · 장기요양은 근로자 절반", "고용보험 0.9%"],
        result: `${N_PAY.insurance}`,
        expect: "소득세는 부양가족·비과세에 따라 달라집니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "split",
        label: "실수령 세 칸",
        title: `남는 돈 ${N_PAY.spare} → ① ${N_PAY.bucketA} · ② ${N_PAY.bucketB} · ③ ${N_PAY.bucketC}`,
        settings: ["고정비 120만원", "변동비 60만원", "남는 돈 87만원"],
        result: `비상금 ${N_PAY.bucketA}부터`,
        expect: "비상금을 먼저 채우고 단기·장기로 넘어갑니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
    ],
    sources: [
      {
        label: "국민연금공단 — 보험료율 안내",
        what: "국민연금 보험료 9%와 근로자·사업주 부담 비율",
        url: "https://www.nps.or.kr/",
        host: "nps.or.kr",
      },
      {
        label: "국민건강보험공단 — 보험료율 안내",
        what: "건강보험료율과 장기요양보험료율(2026년 기준)",
        url: "https://www.nhis.or.kr/",
        host: "nhis.or.kr",
      },
      {
        label: "근로복지공단 — 고용·산재보험",
        what: "고용보험료율과 근로자 부담 몫",
        url: "https://www.comwel.or.kr/",
        host: "comwel.or.kr",
      },
      {
        label: "국세청 — 근로소득 간이세액표",
        what: "소득세와 지방소득세를 계산하는 기준",
        url: "https://www.nts.go.kr/",
        host: "nts.go.kr",
      },
    ],
    cardSet: SET_FIRSTPAY,
    sheet: {
      variant: "firstpay",
      slotNo: 1,
      slotTitle: "실수령 확인표",
      line: "세전·공제 합계·고정비를 넣어 실수령과 세 칸 금액을 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-18 · 고정비·변동비·돌발지출",
      body: "실수령을 알았으니, 이제 한 달 지출을 성격별로 나눕니다. 다음 편에서 지출 태그를 붙여 봅니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_PAY },
    reading: READING_PAY,
  },
];

/** 강의별 원고 글자 수 — 빌드 가드와 화면 표기가 함께 읽는다 */
export const schoolReadingChars = (reading: ReadingSection[]) =>
  reading.reduce(
    (n, s) => n + s.h.replace(/\s/g, "").length + s.ps.join("").replace(/\s/g, "").length,
    0,
  );

export const SCHOOL_LESSON_CHARS: Record<string, number> = Object.fromEntries(
  SCHOOL_LESSONS.map((l) => [l.slug, schoolReadingChars(l.reading)]),
);

export const schoolLessonBySlug = (slug: string) => SCHOOL_LESSONS.find((l) => l.slug === slug);

export const schoolCardSets = [SET_ALLOWANCE, SET_TEEN_PAY, SET_FIRSTPAY];
