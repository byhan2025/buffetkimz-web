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
import { HEALTH_INSURANCE, pct } from "./tax-rules";

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

/** D. 가계 현금흐름 3줄 — 가계 1강 (v8.3.0 신규 세트) */
const SET_HOUSEHOLD: LessonCardSet = {
  id: "household-budget-hand",
  title: "월 500만, 남는 돈은 어디서 줄까",
  meta: "손글씨 카드 6장 · 실수령 · 고정비 · 대출 원리금",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("household-budget", 1, "표지 — 들어오는 돈과 나가는 돈, 세 줄로", "크림 종이 위 세 줄짜리 장부와 동전, 장부를 가리키는 마스코트"),
    card("household-budget", 2, "오해 vs 팩트 — 소득이 크면 남는다 / 고정비·원리금이 먼저다", "왼쪽은 큰 동전 하나를 든 마스코트, 오른쪽은 여러 작은 통으로 동전이 빠져나가는 모습을 보는 마스코트"),
    card("household-budget", 3, "1줄 — 실수령 500만, 세전이 아닙니다", "배관 하나로 유리병에 동전이 차곡차곡 흘러드는 장면과 마스코트"),
    card("household-budget", 4, "2줄 — 고정비 160만, 날짜가 정해진 지출", "달력이 붙은 작은 통 네 개가 나란히 놓인 선반과 마스코트"),
    card("household-budget", 5, "3줄 — 대출 원리금 61만, 금리 오르면 이자가 는다", "지붕 위에 큰 동전을 올린 집 모형과 위로 향한 이자 화살표"),
    card("household-budget", 6, "점검 — 세 줄에 날짜 붙이기", "클립보드와 계산기를 든 마스코트, 세 줄 체크리스트"),
  ],
};

/** E. 보장 공백 5칸 — 가계 2강 */
const SET_COVERAGE: LessonCardSet = {
  id: "coverage-gaps-hand",
  title: "보장 공백 5칸 — 약관에서 갈리는 것",
  meta: "손글씨 카드 6장 · 면책 · 감액 · 지급 기준",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("coverage-gaps", 1, "표지 — 가입금액 전에 볼 약관 공백 5칸", "다섯 칸 빈 종이 위의 돋보기와 들여다보는 마스코트"),
    card("coverage-gaps", 2, "오해 vs 팩트 — 진단비 크기만 크면 든든 / 면책·감액·지급 기준", "왼쪽은 금 간 방패와 큰 동전을 든 마스코트, 오른쪽은 돋보기로 계약서를 보는 마스코트"),
    card("coverage-gaps", 3, "공백 ① ② — 실손 세대별 자기부담, 면책 90일·감액 1~2년", "서로 다른 색 종이 세 장과 청진기, 두 장을 비교하는 마스코트"),
    card("coverage-gaps", 4, "공백 ③ — 유사암·경계성종양은 일반암의 10~20%", "크기가 다른 세 원과 가장 작은 원을 돋보기로 보는 마스코트"),
    card("coverage-gaps", 5, "공백 ④ ⑤ — 수술비 종수와 공적연금 포함 소득 합계 2,000만 원(피부양자)", "병원과 저울, 서류 더미와 동전 주머니를 가리키는 마스코트"),
    card("coverage-gaps", 6, "점검 — 내 증권에서 확인할 3줄", "안경과 펜이 꽂힌 클립보드를 든 마스코트와 3줄 체크리스트"),
  ],
};

/** v8.4.0 — 자산형성 1강 · 은퇴 1강 카드 세트 (자료앨범의 같은 세트 6장) */
const SET_ASSET_SPLIT: LessonCardSet = {
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

const SET_RETIRE_3TIER: LessonCardSet = {
  id: "retirement-3tier-hand",
  title: "퇴직연금 DB·DC·IRP, 어디에 담을까",
  meta: "손글씨 카드 6장 · 임금상승률 vs 운용수익률",
  href: "/gallery/?cat=carousel",
  startIndex: 0,
  slides: [
    card("retirement-3tier", 1, "표지 — 퇴직연금 DB·DC·IRP 한눈 비교", "세 층으로 쌓은 블록과 동전, 맨 위층을 가리키는 마스코트"),
    card("retirement-3tier", 2, "오해 vs 팩트 — 퇴직금은 다 똑같다 / 임금상승률 vs 운용수익률", "왼쪽은 같은 동전 두 개를 든 갸우뚱한 마스코트, 오른쪽은 저울로 동전 더미를 비교하는 마스코트"),
    card("retirement-3tier", 3, "DB형 — 임금상승률이 높고 오래 다닐 때", "창문과 금고가 있는 회사 건물, 사다리를 오르는 마스코트"),
    card("retirement-3tier", 4, "DC형 — 직접 굴릴 때, 이직이 잦을 때", "동전을 돛으로 단 종이배를 조타하는 마스코트"),
    card("retirement-3tier", 5, "IRP — 퇴직금 받을 통장 + 세액공제 300만", "문과 동전 투입구가 있는 단지에 서류 가방을 넣는 마스코트"),
    card("retirement-3tier", 6, "수령 — 일시금 vs 연금, 퇴직소득세 30~50% 감면(1~10년 30%·11~20년 40%·21년~ 50%)", "모래시계에서 동전이 손으로 떨어지고 달력과 단지가 놓인 장면"),
  ],
};

export const schoolCardSetById = (id: string): LessonCardSet | undefined =>
  [SET_ALLOWANCE, SET_TEEN_PAY, SET_FIRSTPAY, SET_HOUSEHOLD, SET_COVERAGE, SET_ASSET_SPLIT, SET_RETIRE_3TIER].find(
    (s) => s.id === id,
  );

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
const PENSION_RATE = 0.0475; // 국민연금 2026년 9.5%의 절반(근로자 기여금 4.75%)
const EMPLOYMENT_RATE = 0.009; // 고용보험(실업급여) 근로자 부담
const PENSION_WON = Math.round(GROSS * PENSION_RATE); // 142,500
const HEALTH_WON = Math.round(GROSS * HEALTH_INSURANCE.employeeShare); // 107,850
const CARE_WON = Math.round((GROSS * HEALTH_INSURANCE.longTermCareRate) / 2); // 14,172
const EMPLOYMENT_WON = Math.round(GROSS * EMPLOYMENT_RATE); // 27,000
const INSURANCE_WON = PENSION_WON + HEALTH_WON + CARE_WON + EMPLOYMENT_WON; // 291,522
const DEDUCTION_WON = 330_000; // 가상 공제 합계(4대보험 + 소득세·지방소득세)
const TAX_WON = DEDUCTION_WON - INSURANCE_WON; // 38,478 (330,000 − 291,522)
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
      `국민연금은 2026년 보험료율 9.5%로, 근로자 몫은 그 절반인 4.75%입니다.`,
      `네 개를 더하면 ${N_PAY.insurance}입니다. 여기에 소득세와 지방소득세(소득세에 10%를 더 붙이는 지방세)가 더해집니다. 이 강의에서는 세금을 포함한 공제 합계를 ${N_PAY.deduction}(가상 예시)으로 두었고, 그중 세금 몫은 ${N_PAY.tax}입니다.`,
      `소득세는 부양가족 수, 비과세 항목, 회사의 정산 방식에 따라 달라집니다. 그래서 남의 명세서와 비교하지 말고, 내 명세서의 공제 합계를 직접 읽어야 합니다.`,
      `회사가 내는 몫은 명세서에 '사업주 부담'으로 따로 적히기도 합니다. 내 월급에서 빠지는 돈과 회사가 더 내는 돈은 다릅니다.`,
      `건강보험료는 명세서의 공제 항목에 들어갑니다. 실손보험은 회사가 자동으로 들어 주는 것이 아니라 내가 가입한 상품이므로, 보장 여부와 자기부담률을 약관에서 확인합니다.`,
    ],
  },
  {
    h: "실수령에서 다시 세 칸",
    ps: [
      `실수령 ${N_PAY.netWon}에서 고정비 ${N_PAY.fixed}, 변동비 ${N_PAY.variable}을 빼면 남는 돈은 ${N_PAY.spare}입니다. 첫 달부터 이 계산을 해 두면, 다음 달에 무엇이 모자라는지 금방 보입니다.`,
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
      `기준일 2026. 11. 22. · 2026년 법정 요율은 건강보험 7.19%, 장기요양 0.9448%, 국민연금 9.5%(근로자 4.75%), 고용보험 1.8%(근로자 0.9%)이고, 4대보험 합계는 이 요율로 계산한 ${N_PAY.insurance}입니다. 공제 합계 ${N_PAY.deduction}과 그중 세금 몫 ${N_PAY.tax}은 계산을 보여 주기 위한 가상 예시이므로, 실제 금액은 명세서와 국세청 안내에서 확인합니다.`,
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
    q: `세전 ${N_PAY.grossWon}, 공제 합계 ${N_PAY.deduction}(가상 예시)일 때 실수령은 얼마일까요?`,
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
   가계 1강 — 고정비·대출 원리금, 가계 현금흐름 3줄 점검 (v8.3.0)
   · 원리금은 원리금균등분할상환 공식으로 직접 계산한다(가상 금액).
   ------------------------------------------------------------------ */
const LOAN_PRINCIPAL = 10000; // 대출 원금(만원) — 1억 원
const LOAN_MONTHS = 240; // 20년
const loanPay = (annualRate: number) =>
  Math.round(
    ((LOAN_PRINCIPAL * 10000 * (annualRate / 12)) / (1 - Math.pow(1 + annualRate / 12, -LOAN_MONTHS))) / 1000,
  ) * 1000;
const MONTHLY = (won: number) => `${Math.round(won / 10000).toLocaleString("ko-KR")}만원`;

const PAY4 = loanPay(0.04); // 606,000원
const PAY6 = loanPay(0.06); // 716,000원
const H_INCOME = 500; // 실수령(만원)
const H_FIXED = 160; // 고정비(만원)
const H_VARIABLE = 140; // 변동비(만원)
const H_LOAN4 = Math.round(PAY4 / 10000); // 61만
const H_LOAN6 = Math.round(PAY6 / 10000); // 72만
const H_FIXEDLOAN4 = H_FIXED + H_LOAN4; // 221만
const H_FIXEDLOAN6 = H_FIXED + H_LOAN6; // 232만
const H_SPARE4 = H_INCOME - H_FIXEDLOAN4 - H_VARIABLE; // 139만
const H_SPARE6 = H_INCOME - H_FIXEDLOAN6 - H_VARIABLE; // 128만
const H_RATIO4 = H_FIXEDLOAN4 / H_INCOME;
const H_RATIO6 = H_FIXEDLOAN6 / H_INCOME;

const N_HOUSE = {
  income: MONTHLY(H_INCOME * 10000),
  fixed: MONTHLY(H_FIXED * 10000),
  variable: MONTHLY(H_VARIABLE * 10000),
  loan4: MONTHLY(PAY4),
  loan6: MONTHLY(PAY6),
  loanDiff: MONTHLY(PAY6 - PAY4),
  fixedLoan: MONTHLY(H_FIXEDLOAN4 * 10000),
  fixedLoan6: MONTHLY(H_FIXEDLOAN6 * 10000),
  spare: MONTHLY(H_SPARE4 * 10000),
  spare6: MONTHLY(H_SPARE6 * 10000),
  ratio: pct(H_RATIO4),
  ratio6: pct(H_RATIO6),
  interest4: MONTHLY((LOAN_PRINCIPAL * 10000 * 0.04) / 12),
  interest6: MONTHLY((LOAN_PRINCIPAL * 10000 * 0.06) / 12),
  principal: MONTHLY(LOAN_PRINCIPAL * 10000),
  years: `${LOAN_MONTHS / 12}년`,
};

const READING_HOUSE: ReadingSection[] = [
  {
    h: "세 줄이면 보입니다",
    ps: [
      `가계 현금흐름은 세 줄이면 보입니다. ① 들어오는 돈(실수령) ② 고정비와 대출 원리금 ③ 남는 돈입니다. 변동비는 ③을 계산할 때 함께 빼면 됩니다.`,
      `핵심은 ②에 대출 원리금을 넣는 것입니다. 원리금은 매달 같은 날 빠져나가고, 금리가 오르면 이자만 늘어납니다. 생활비처럼 그 달에 조절할 수 있는 돈이 아닙니다.`,
      `예로 ${N_HOUSE.principal}을 연 4%·${N_HOUSE.years} 원리금균등으로 빌리면 월 ${N_HOUSE.loan4}입니다. 연 6%가 되면 월 ${N_HOUSE.loan6}입니다. 같은 원금인데도 금리 2%p가 월 ${N_HOUSE.loanDiff}을 바꿉니다.`,
      `세 줄은 한 번 쓰고 끝나지 않습니다. 이사·출산·이직·금리 변동처럼 생활이 바뀔 때마다 다시 셈니다. 숫자를 고치지 않은 채 몇 년이 지나면, 남는 돈은 늘 모자란 상태가 됩니다. 세 줄을 갱신하는 날을 달력에 표시해 두면 그 일이 반복되지 않습니다.`,
    ],
  },
  {
    h: "내 숫자로 옮기면",
    ps: [
      `실수령 ${N_HOUSE.income}, 고정비 ${N_HOUSE.fixed}, 대출 원리금 ${N_HOUSE.loan4}, 변동비 ${N_HOUSE.variable}인 가계를 봅니다. ②는 ${N_HOUSE.fixedLoan}, ③은 ${N_HOUSE.spare}입니다.`,
      `함께 보는 비율이 (고정비+원리금)÷실수령입니다. ${N_HOUSE.fixedLoan}÷${N_HOUSE.income}은 ${N_HOUSE.ratio}입니다. 이 비율이 50%에 가까우면 소득이 조금만 줄어도 ③이 0에 붙습니다.`,
      `금리가 6%로 오르면 ②는 ${N_HOUSE.fixedLoan6}, ③은 ${N_HOUSE.spare6}입니다. ③이 줄면 가장 먼저 볼 곳은 변동비입니다. 원리금은 계약이라 그 달에 바꿀 수 없기 때문입니다.`,
      `③이 0원이거나 마이너스라면 세 줄을 다시 쓰는 것이 아니라, 순서를 바꿉니다. 변동비를 줄이고, 고정비 목록을 다시 만들고, 원리금의 금리·기간을 확인하는 순서입니다.`,
    ],
  },
  {
    h: "고정비를 다시 세면",
    ps: [
      `고정비는 '이번 달에 안 써도 다음 달에 또 나가는 돈'입니다. 월세·관리비·통신·보험료·학원비가 여기 들어갑니다. 반대로 식비·교통·여가는 변동비입니다.`,
      `고정비를 줄이는 방법은 두 가지입니다. 없애기(구독 해지)와 낮추기(요금제 변경·보험 점검)입니다. 작은 금액도 12개월로 환산하면 결정이 달라집니다.`,
      `대출은 금리와 기간을 함께 봅니다. 중도상환수수료가 남아 있으면 지금 갑는 것이 이득인지 먼저 계산합니다. 갈아타기는 월 납부액이 아니라 총비용으로 비교합니다.`,
      `보험료도 고정비입니다. 같은 보장을 유지하면서 보험료를 납부는 방법은 보장을 줄이는 것이 아니라 중복을 찾는 것입니다. 비슷한 담보가 두 개 겹쳐 있으면 하나를 정리하는 것으로 시작합니다.`,
    ],
  },
  {
    h: "평소에 미리 점검하기",
    ps: [
      `소득이 한 달 끊기거나 병원비가 나오면 ③은 바로 무더집니다. 그래서 ③의 절반은 비상금으로 따로 두는 것이 안전합니다. 비상금은 수익을 만드는 돈이 아니라, 이 세 줄을 지켜 주는 돈입니다.`,
      `점검은 세 줄에 날짜를 붙이는 일입니다. 매달 1일 실수령 확인, 5일 고정비·원리금 확인, 25일 남는 돈 확인. 날짜를 정해 두면 점검이 습관이 됩니다.`,
      `가계는 둘 이상이 함께 결정합니다. 공동비용과 개인비용을 나누고, 줄일 항목을 한 가지씩 정하면 다툼이 줄어듭니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 원리금은 원리금균등분할상환 공식으로 직접 계산한 가상 값입니다. 실제 금리·수수료는 금융감독원 파인에서 비교하고, 기준금리는 한국은행 자료를 봅니다. 50%라는 비율은 자체 기준입니다.`,
    ],
  },
];

const QUIZ_HOUSE: LessonQuizItem[] = [
  {
    q: `실수령 ${N_HOUSE.income}, 고정비 ${N_HOUSE.fixed}, 대출 원리금 ${N_HOUSE.loan4}일 때 (고정비+원리금)은 실수령의 몇 %일까요?`,
    hint: `고정비와 원리금을 더한 뒤 실수령으로 나눕니다.`,
    options: [
      { label: `${N_HOUSE.ratio}`, ok: true, why: `${N_HOUSE.fixedLoan} ÷ ${N_HOUSE.income} = ${N_HOUSE.ratio}입니다.` },
      { label: "33%", why: "고정비만 새면 나오는 숫자입니다. 원리금을 빼면 안 됩니다." },
      { label: "10%", why: "대출 이자만 새면 작아 보입니다. 원금 상환도 매달 나가는 돈입니다." },
    ],
    explain: "고정비와 원리금을 함께 새야 그 달에 조절할 수 없는 돈이 보입니다.",
  },
  {
    q: `금리가 4%에서 6%로 오르면 월 원리금은 어떻게 될까요?`,
    hint: `원금은 그대로이고 이자만 늘어납니다.`,
    options: [
      { label: `${N_HOUSE.loan4} → ${N_HOUSE.loan6}`, ok: true, why: `이자가 ${N_HOUSE.interest4}에서 ${N_HOUSE.interest6}으로 늘면서 월 ${N_HOUSE.loanDiff}이 늘어납니다.` },
      { label: "그대로다", why: "변동금리라면 금리가 오를 때 월 납부액도 함께 오릅니다." },
      { label: "절반으로 준다", why: "금리가 오르면 납부액은 줄지 않습니다." },
    ],
    explain: "같은 원금이라도 금리가 오르면 이자가 늘어 월 납부액이 올라갑니다.",
  },
  {
    q: "남는 돈이 줄었습니다. 가장 먼저 볼 곳은 어디일까요?",
    hint: "그 달에 바로 바꿀 수 있는 돈부터 봅니다.",
    options: [
      { label: "변동비에서 줄일 항목 찾기", ok: true, why: "식비·교통·여가는 이번 달에 바꿀 수 있습니다. 원리금은 계약이라 시간이 걸립니다." },
      { label: "원리금을 바로 줄이기", why: "원리금은 계약이라 즉시 줄이기 어렵습니다. 금리·기간을 다시 보는 절차가 필요합니다." },
      { label: "소득이 오르기를 기다리기", why: "기다리는 동안에도 고정비와 원리금은 나갑니다." },
    ],
    explain: "바로 바꿀 수 있는 돈부터 보면 점검이 실행으로 이어집니다.",
  },
];

/* ------------------------------------------------------------------
   가계 2강 — 보장 공백 5칸, 약관과 건보료에서 갈리는 것 (v8.3.0)
   ------------------------------------------------------------------ */
const DIAG = 3000; // 진단비 가상 금액(만원)
const UN_PAY = Math.round(DIAG * 0.2); // 유사암 20% → 600만
const BOUND_PAY = Math.round(DIAG * 0.1); // 경계성 10% → 300만
const UN_REDUCED = Math.round(UN_PAY * 0.5); // 감액 50% → 300만

const N_COVER = {
  diag: MONTHLY(DIAG * 10000),
  un: MONTHLY(UN_PAY * 10000),
  bound: MONTHLY(BOUND_PAY * 10000),
  reduced: MONTHLY(UN_REDUCED * 10000),
  unRate: pct(0.2, 0),
  boundRate: pct(0.1, 0),
  reduce: pct(0.5, 0),
  waiting: "90일",
  reducePeriod: "1~2년",
  silson4: pct(0.2, 0),
  silson5: pct(0.5, 0),
  pensionTax: MONTHLY(1500 * 10000),
  dependent: MONTHLY(2000 * 10000),
};

const READING_COVER: ReadingSection[] = [
  {
    h: "가입금액보다 조건",
    ps: [
      `보장은 가입금액이 아니라 지급 조건에서 갈립니다. 같은 ${N_COVER.diag}이라도 유사암은 일반암의 ${N_COVER.unRate}, 1년 안에 진단받으면 감액 ${N_COVER.reduce}가 붙어 ${N_COVER.reduced}이 될 수 있습니다.`,
      `그래서 증권을 볼 때 다섯 칸을 봅니다. ① 실손 세대별 자기부담 ② 면책·감액 기간 ③ 유사암·경계성종양 지급률 ④ 수술비 종수 ⑤ 사적연금과 건보료 경계입니다.`,
      `다섯 칸은 모두 약관과 공시에서 확인할 수 있습니다. 광고에는 잘 나오지 않습니다. 큰 숫자가 먼저 눈에 들어와도, 실제로 받는 돈은 이 다섯 칸에서 정해집니다.`,
    ],
  },
  {
    h: "실손과 면책·감액",
    ps: [
      `실손은 세대마다 자기부담이 다릅니다. 4세대는 급여 ${N_COVER.silson4} 수준, 5세대는 비중증 비급여 ${N_COVER.silson5}입니다. 같은 병원비라도 내가 내는 돈이 달라집니다.`,
      `면책기간은 그 기간에 생긴 질병을 보장하지 않는 기간이고, 감액기간은 보장금액을 깎아 지급하는 기간입니다. 암 보험은 면책 ${N_COVER.waiting}, 감액 ${N_COVER.reducePeriod}가 흔합니다.`,
      `가입한 날짜가 중요합니다. 같은 날 가입해도 면책이 끝나는 날짜가 다르면 보장이 시작되는 날이 다릅니다. 병원 기록을 확인할 때 이 날짜부터 봅니다.`,
    ],
  },
  {
    h: "유사암과 수술비",
    ps: [
      `유사암과 경계성종양은 일반암과 지급률이 다릅니다. 진단비 ${N_COVER.diag}의 ${N_COVER.unRate}면 ${N_COVER.un}, ${N_COVER.boundRate}면 ${N_COVER.bound}입니다. 이름이 비슷해도 약관의 정의가 다르면 다른 담보입니다.`,
      `수술비는 '몇 종'까지 보장하는지가 핵심입니다. 1종·2종·N종 기준이 상품마다 달라서, 같은 수술도 지급 여부가 갈립니다.`,
      `진단비가 커도 지급 조건이 좀으면 실제로 받는 돈은 작습니다. 반대로 조건이 넓으면 작은 진단비도 자주 쓰입니다.`,
    ],
  },
  {
    h: "연금과 건보료의 경계",
    ps: [
      `연금을 받을 때도 경계가 있습니다. 사적연금은 연 ${N_COVER.pensionTax}까지 3.3~5.5%로 원천징수되고, 연금소득을 포함한 소득 합계가 연 ${N_COVER.dependent}을 넘으면 건강보험 피부양자 자격을 잃을 수 있습니다.`,
      `사적연금 ${N_COVER.pensionTax}은 과세 기준, 소득 합계 ${N_COVER.dependent}은 피부양자 기준입니다. 두 숫자를 같은 것으로 기억하면 안 됩니다.`,
      `보장 공백을 줄이는 일은 보험료를 더 내는 일이 아니라, 이미 든 보장이 실제로 작동하는지 확인하는 일입니다. 확인하지 않은 보장은 없는 보장과 같습니다.`,
      `실손은 세대별 자기부담이 다르고, 진단비는 유사암·감액·면책에서 깎입니다. 세 가지를 모르면 같은 병원비에도 내가 내는 돈이 달라집니다.`,
      `연금도 같은 방식으로 봅니다. 사적연금은 연 ${N_COVER.pensionTax}까지 원천징수로 끝나지만, 소득 합계가 연 ${N_COVER.dependent}을 넘으면 건보료가 새로 붙을 수 있습니다.`,
      `약관은 어렵지만 다섯 단어만 찾으면 됩니다. 면책·감액·지급률·종수·경계, 이 다섯 단어를 증권에서 찾아 표시합니다.`,
      `표시한 뒤에는 가족과 한 번 나눕니다. 누가 어떤 보장을 갖고 있는지 서로 알고 있어야, 병원에 갈 때 증권을 찾는 일이 반복되지 않습니다. 보장은 서류가 아니라 그 순간에 작동하는 약속입니다.`,
      `증권이 오래되어 기억과 다르면 금융감독원 파인에서 가입 내역을 확인합니다. 상품 이름은 달라도 담보 이름과 지급 조건으로 비교하면 됩니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `기준일 2026. 11. 22. · 실손 자기부담은 금융위원회 보도자료, 피부양자 요건은 국민건강보험법 시행령, 지급률·종수는 보험약관과 금융감독원 공시에서 확인합니다. 지급률과 종수는 상품마다 달라 여기 숫자는 예시입니다.`,
    ],
  },
];

const QUIZ_COVER: LessonQuizItem[] = [
  {
    q: `진단비 ${N_COVER.diag}, 유사암 지급률 ${N_COVER.unRate}라면 유사암 진단 시 받는 금액은?`,
    hint: `진단비에 지급률을 곱합니다.`,
    options: [
      { label: `${N_COVER.un}`, ok: true, why: `${N_COVER.diag} × ${N_COVER.unRate} = ${N_COVER.un}입니다.` },
      { label: `${N_COVER.diag}`, why: "가입금액 전액이 아니라 지급률을 곱한 금액입니다." },
      { label: `${N_COVER.bound}`, why: `경계성종양 ${N_COVER.boundRate}를 적용한 금액입니다.` },
    ],
    explain: "유사암·경계성종양은 일반암과 지급률이 다릅니다.",
  },
  {
    q: `같은 ${N_COVER.diag}이라도 감액기간 1년 안에 진단받고 감액 ${N_COVER.reduce}가 붙으면 얼마를 받을까요?`,
    hint: `지급률을 적용한 금액에 감액률을 한 번 더 곱합니다.`,
    options: [
      { label: `${N_COVER.reduced}`, ok: true, why: `${N_COVER.un} × ${N_COVER.reduce} = ${N_COVER.reduced}입니다.` },
      { label: `${N_COVER.un}`, why: "감액이 붙으면 지급률을 적용한 금액에서 한 번 더 깎입니다." },
      { label: "0원", why: "감액은 지급을 막는 것이 아니라 금액을 줄이는 것입니다." },
    ],
    explain: "면책은 보장하지 않는 기간, 감액은 깎아 지급하는 기간입니다.",
  },
  {
    q: "건강보험 피부양자 자격이 흔들리는 기준으로 맞는 것은?",
    hint: "사적연금의 과세 기준과 피부양자 자격 기준은 다릅니다.",
    options: [
      {
        label: `연금소득을 포함한 소득 합계 연 ${N_COVER.dependent} 초과`,
        ok: true,
        why: "피부양자 요건은 소득 합계와 재산을 함께 봅니다.",
      },
      {
        label: `사적연금 연 ${N_COVER.pensionTax} 초과`,
        why: "1,500만 원은 사적연금의 과세 기준입니다. 피부양자는 소득 합계로 봅니다.",
      },
      { label: "나이 65세 초과", why: "나이만으로 자격이 정해지지 않습니다. 소득·재산 요건을 봅니다." },
    ],
    explain: "사적연금 1,500만 원은 과세 기준, 소득 합계 2,000만 원은 피부양자 기준입니다.",
  },
];

/* ------------------------------------------------------------------
   자산형성 1강 — 나눠 담기와 비중 (FL-36)
   · 가상 100만 원을 70:30으로 나누고, 70% 쪽이 −30% 빠졌을 때 전체 손실을 센다.
   ------------------------------------------------------------------ */
const AS_TOTAL = 100; // 가상 금액(만원)
const AS_A = 70; // A 자산(만원)
const AS_DROP = 0.3; // A 자산 하락률
const AS_LOSS = Math.round(AS_A * AS_DROP); // 21만
const AS_PORT = Math.round((AS_LOSS / AS_TOTAL) * 1000) / 10; // 21%

const N_ASSET = {
  total: manwon(AS_TOTAL),
  a: manwon(AS_A),
  b: manwon(AS_TOTAL - AS_A),
  dropA: pct(AS_DROP, 0),
  loss: manwon(AS_LOSS),
  portLoss: pct(AS_LOSS / AS_TOTAL, 0),
  fullLoss: manwon(Math.round(AS_TOTAL * AS_DROP)),
  overlap: pct(0.4, 0),
  targetA: pct(AS_A / AS_TOTAL, 0),
  targetB: pct((AS_TOTAL - AS_A) / AS_TOTAL, 0),
};

const READING_ASSET: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `${N_ASSET.total}을 두 곳에 ${N_ASSET.targetA}와 ${N_ASSET.targetB}로 나눠 담으면 ${N_ASSET.a}와 ${N_ASSET.b}가 됩니다. ${N_ASSET.a} 쪽이 ${N_ASSET.dropA} 빠지면 그쪽에서 ${N_ASSET.loss}가 줄고, 전체로는 ${N_ASSET.portLoss} 손실입니다.`,
      `한 곳에 다 담았다면 같은 하락에서 ${N_ASSET.fullLoss}가 줄어듭니다. 빠지는 비율은 같지만, 전체 손실은 ${N_ASSET.portLoss}와 ${N_ASSET.dropA}로 달라집니다.`,
      `나눠 담는 이유는 수익을 늘리기 위해서가 아니라, 한 곳이 흔들릴 때 전체가 같이 흔들리지 않게 하기 위해서입니다. 오늘 남길 것은 두 가지입니다. 나눠 담는 이유와, 나눴는지 확인하는 방법입니다.`,
    ],
  },
  {
    h: "왜 덜 흔들리나",
    ps: [
      `손실은 빠진 곳의 금액에만 붙습니다. ${N_ASSET.b}는 그대로 있으니 전체에서 줄어드는 몫은 작아집니다. 반대로 B가 오르면 전체는 조금 더해집니다.`,
      `오를 때도 같습니다. 한 곳만 오르면 전체는 조금 오르고, 한 곳만 빠지면 전체는 조금 빠집니다. 오르내림이 작아지는 대신 최고 수익도 작아집니다.`,
      `그래서 나눠 담기는 '덜 잃는 대신 덜 버는' 선택입니다. 얼마나 나눌지는 내가 감당할 수 있는 흔들림에서 정합니다.`,
      `빠진 뒤 돌아오는 길도 다릅니다. A가 ${N_ASSET.dropA} 빠지면 원래 금액으로 돌아오려면 그보다 큰 상승이 필요합니다. B는 그대로인데 A만 회복을 기다리는 셈입니다.`,
    ],
  },
  {
    h: "종목 수가 아니라 겹침",
    ps: [
      `이름이 다른 상품 열 개를 샀는데 같은 회사를 ${N_ASSET.overlap}씩 담고 있다면, 사실상 한 곳에 담은 것과 같습니다. 하나가 빠지면 열 개가 같이 빠집니다.`,
      `같은 업종도 마찬가지입니다. 업종이 같으면 뉴스 하나에 함께 움직입니다. 그래서 개수보다 '무엇이 겹치는지'를 먼저 봅니다. 업종 비중은 공시에서 퍼센트로 확인합니다.`,
      `구성을 확인하는 방법은 간단합니다. 상품의 상위 구성 종목과 업종 비중을 나란히 놓고, 겹치는 이름을 표시합니다. 이름이 달라도 겹친 이름이 많으면 같은 위험을 두 번 산 것입니다.`,
      `분산은 상품 개수를 세는 일이 아니라, 서로 다르게 움직이는 자산이 몇 개인지 세는 일입니다.`,
    ],
  },
  {
    h: "비중을 적어 두면",
    ps: [
      `목표 비중을 정하면 확인할 숫자가 하나로 줄어듭니다. 목표금액 = 총액 × 비중. ${N_ASSET.total}의 ${N_ASSET.targetA}는 ${N_ASSET.a}입니다. 비중은 퍼센트로 적고, 확인할 때는 금액으로 바꿉니다.`,
      `오르면 목표보다 커지고, 내리면 작아집니다. 1년에 한 번 날짜를 정해 두고 목표금액과 비교하면, 얼마를 옮겨야 하는지가 바로 나옵니다.`,
      `비중은 소수점까지 맞출 필요가 없습니다. 크게 어긋났을 때만 손대는 규칙이면 충분합니다.`,
      `처음 비중을 정할 때는 오래 묶어 둘 돈과 가까운 시일에 쓸 돈을 먼저 나눕니다. 가까운 시일에 쓸 돈은 흔들리지 않는 곳에 두고, 나머지로 비중을 정합니다.`,
    ],
  },
  {
    h: "자주 하는 실수 3가지",
    ps: [
      `첫째, 이름이 다른 상품을 여러 개 사면 분산이라고 생각합니다. 담긴 자산이 같으면 같이 움직입니다.`,
      `둘째, 비중을 정하지 않고 감으로 삽니다. 목표금액을 적어 두지 않으면 오를 때 더 사고 내릴 때 팔게 됩니다.`,
      `셋째, 한 번 정한 비중을 몇 년씩 확인하지 않습니다. 1년에 한 번 날짜를 정해 두면 이 셋은 한 번에 해결됩니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `금액은 모두 가상 예시입니다. 분산과 위험의 관계는 금융감독원 e-금융교육센터와 금융투자협회 공시 자료에서 확인합니다.`,
      `이 글은 특정 종목·상품을 권하지 않습니다. 기준일은 2026. 11. 22.입니다.`,
    ],
  },
];

const QUIZ_ASSET: LessonQuizItem[] = [
  {
    q: `${N_ASSET.a}을 A에, ${N_ASSET.b}를 B에 넣었어요. A가 ${N_ASSET.dropA} 빠지면 전체는 얼마나 줄어들까요?`,
    hint: `A에서만 손실이 납니다.`,
    options: [
      { label: `${N_ASSET.loss} (${N_ASSET.portLoss})`, ok: true, why: `${N_ASSET.a} × ${N_ASSET.dropA} = ${N_ASSET.loss}이고, 전체 ${N_ASSET.total}의 ${N_ASSET.portLoss}입니다.` },
      { label: `${N_ASSET.fullLoss} (${N_ASSET.dropA})`, why: "전부 A에 넣었을 때의 손실입니다." },
      { label: "0원", why: "A가 빠지면 A에 넣은 만큼은 줄어듭니다." },
    ],
    explain: "나눠 담으면 빠지는 곳의 금액만 손실이 됩니다.",
  },
  {
    q: "종목을 열 개로 늘렸어요. '분산됐다'고 말하려면 무엇을 먼저 볼까요?",
    hint: "개수보다 겹침을 봅니다.",
    options: [
      { label: "같은 회사·같은 업종이 겹치는지", ok: true, why: `이름이 달라도 같은 회사를 ${N_ASSET.overlap}씩 담았다면 함께 움직입니다.` },
      { label: "상품 이름이 모두 다른지", why: "이름이 달라도 담긴 자산이 같으면 같이 움직입니다." },
      { label: "수수료가 가장 싼지", why: "수수료는 비용이고, 겹침은 위험의 문제입니다." },
    ],
    explain: "분산은 개수가 아니라 서로 다르게 움직이는지의 문제입니다.",
  },
  {
    q: `목표 비중 ${N_ASSET.targetA}:${N_ASSET.targetB}를 적어 두면 무엇이 쉬워질까요?`,
    hint: `목표금액 = 총액 × 비중`,
    options: [
      { label: "지금 얼마를 옮겨야 하는지 계산", ok: true, why: `${N_ASSET.total}의 ${N_ASSET.targetA}가 ${N_ASSET.a}입니다. 지금 금액과 비교하면 차이가 나옵니다.` },
      { label: "내일 오를 종목을 맞히는 일", why: "비중은 오를 종목을 맞히는 도구가 아닙니다." },
      { label: "세금이 없어지는 일", why: "비중을 적는다고 세금이 사라지지는 않습니다." },
    ],
    explain: "비중을 적어 두면 판단이 계산으로 바뀝니다.",
  },
];

/* ------------------------------------------------------------------
   은퇴 1강 — 국민·퇴직·개인연금 3층 (FL-42)
   · 세 층의 월 수령액을 합쳐 연 사적연금과 소득 합계를 따로 센다.
   · 1,500만 원(세금)과 2,000만 원(건보료)은 다른 제도다.
   ------------------------------------------------------------------ */
const RT_NATIONAL = 170; // 국민연금 월(만원) — 공적연금만으로 건보 기준(2,000만)을 넘는 예시
const RT_RETIRE = 50; // 퇴직연금 월(만원)
const RT_PERSONAL = 30; // 개인연금 월(만원)
const RT_MONTH = RT_NATIONAL + RT_RETIRE + RT_PERSONAL; // 250만
const RT_PRIVATE_YEAR = (RT_RETIRE + RT_PERSONAL) * 12; // 960만
const RT_PUBLIC_YEAR = RT_NATIONAL * 12; // 2,040만 — 공단 운영상 건보 소득(사적연금 미부과)

const N_RETIRE = {
  national: manwon(RT_NATIONAL),
  retire: manwon(RT_RETIRE),
  personal: manwon(RT_PERSONAL),
  month: manwon(RT_MONTH),
  privateYear: manwon(RT_PRIVATE_YEAR),
  publicYear: manwon(RT_PUBLIC_YEAR),
  privateLimit: `연 ${manwon(1500)}`,
  healthLimit: `연 ${manwon(2000)}`,
  earlyCut: pct(0.06, 0),
  earlyMax: pct(0.3, 0),
  laterAdd: pct(0.072),
  openAge: "61~65세",
  irpAge: "55세",
  irpYears: "5년",
  taxLow: pct(0.055),
  tax70: pct(0.044),
  separate: pct(0.15, 0),
};

const READING_RETIRE: ReadingSection[] = [
  {
    h: "한 문장으로 답하면",
    ps: [
      `연금은 한 곳에서 나오지 않습니다. 나라가 운영하는 국민연금(공적), 회사를 통해 쌓는 퇴직연금, 내가 따로 넣는 개인연금까지 세 층입니다.`,
      `국민연금 ${N_RETIRE.national}, 퇴직연금 ${N_RETIRE.retire}, 개인연금 ${N_RETIRE.personal}을 받으면 한 달 ${N_RETIRE.month}입니다. 연으로 바꾸면 사적연금(퇴직·개인) ${N_RETIRE.privateYear}, 공적연금(국민) ${N_RETIRE.publicYear}입니다.`,
      `금액은 사람마다 다르지만, 세 층을 나눠 세는 방식은 같습니다. 세 층을 한 장에 그려 두면 어디가 비어 있는지 눈으로 보입니다.`,
    ],
  },
  {
    h: "세 층은 시작 시점이 다르다",
    ps: [
      `국민연금은 출생연도에 따라 ${N_RETIRE.openAge} 사이에서 열립니다. 일찍 받으면 1년마다 ${N_RETIRE.earlyCut}(월 0.5%)씩 최대 ${N_RETIRE.earlyMax}까지 줄고, 늦추면 1년마다 ${N_RETIRE.laterAdd}씩 늘어납니다.`,
      `퇴직연금과 개인연금은 ${N_RETIRE.irpAge}부터, 가입 기간 ${N_RETIRE.irpYears}을 채우면 연금으로 받을 수 있습니다. 회사를 그만두면 퇴직연금은 IRP로 이어받습니다.`,
      `퇴직연금은 회사가 굴리는 DB와 내가 굴리는 DC로 나뉩니다. 어느 쪽이든 받을 때는 IRP로 모아 연금으로 받는 방식이 일반적입니다.`,
      `그래서 퇴직 뒤 국민연금이 열리기 전까지 몇 년은 비는 구간이 생깁니다. 이 구간을 무엇으로 메울지가 첫 번째 질문입니다.`,
    ],
  },
  {
    h: "받는 순서와 세금",
    ps: [
      `비는 구간은 사적연금에서 먼저 꺼내 씁니다. 사적연금은 연 ${N_RETIRE.privateLimit}까지 연금소득세로 끝나고, 55~69세는 ${N_RETIRE.taxLow}, 70~79세는 ${N_RETIRE.tax70}입니다.`,
      `이 선을 넘으면 다음 해에 종합과세되거나 ${N_RETIRE.separate} 분리과세(다른 소득과 합치지 않고 정해진 세율로 끝내는 과세)를 고를 수 있습니다. 어느 쪽이 나은지는 다른 소득에 따라 달라집니다.`,
      `그래서 인출(연금계좌에서 생활비로 꺼내는 것) 금액을 해마다 같은 선에서 나눠 받는 방식이 많이 쓰입니다.`,
      `비는 구간이 길수록 사적연금을 꺼내는 속도가 빨라집니다. 그만큼 나중에 받을 돈이 줄어들므로, 구간 길이와 인출 속도를 함께 적어 두고 시작합니다.`,
    ],
  },
  {
    h: "두 개의 선을 섞지 않기",
    ps: [
      `사적연금 ${N_RETIRE.privateLimit}은 세금 기준이고, 소득 합계 ${N_RETIRE.healthLimit}은 건강보험 피부양자 자격 기준입니다. 두 제도는 목적도 계산도 다릅니다.`,
      `위 예시는 사적연금이 ${N_RETIRE.privateYear}이라 세금 기준 아래지만, 공적연금만으로도 ${N_RETIRE.publicYear}이라 건보 기준 위입니다. 공단은 2026년 11월 현재 사적연금에 보험료를 부과하지 않으므로, 사적연금을 넣든 빼든 소득 요건은 넘습니다.`,
      `다만 법령 문언(국민건강보험법 시행령 제41조①5호)은 연금소득 전체를 가리켜 사적연금도 포함됩니다. 판정은 공단에 내 소득 자료로 확인합니다.`,
      `자격은 소득뿐 아니라 재산도 함께 봅니다. 정확한 판단은 국민건강보험공단에 내 소득 자료로 확인합니다. 두 기준선은 해마다 같은 자리에서 다시 확인합니다.`,
    ],
  },
  {
    h: "내 숫자로 확인하는 순서",
    ps: [
      `첫째, 세 층의 예상 수령액을 조회합니다. 국민연금은 국민연금공단, 퇴직·개인연금은 금융감독원 통합연금포털에서 한 번에 볼 수 있습니다.`,
      `둘째, 국민연금이 열리기까지 비는 구간이 몇 년인지 계산합니다. 그 기간에 생활비가 얼마나 필요한지가 사적연금 인출 속도를 정합니다.`,
      `셋째, 두 기준선을 따로 적습니다. 사적연금 ${N_RETIRE.privateLimit}(세금)과 소득 합계 ${N_RETIRE.healthLimit}(건보료)입니다. 한 줄에 섞어 적으면 판단이 어긋납니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `사적연금 과세는 소득세법 제20조의3·제64조의4, 피부양자 요건은 국민건강보험법 시행규칙에서 확인합니다.`,
      `내 예상 수령액은 국민연금공단과 금융감독원 통합연금포털에서 조회합니다. 이 글은 특정 상품을 권하지 않고, 기준일은 2026. 11. 22.입니다.`,
    ],
  },
];

const QUIZ_RETIRE: LessonQuizItem[] = [
  {
    q: "세 층 가운데 나라가 운영하는 공적연금은 어느 것일까요?",
    hint: "공적은 나라, 사적은 회사와 개인입니다.",
    options: [
      { label: "국민연금", ok: true, why: "국민연금이 공적연금이고, 퇴직연금·개인연금은 사적연금입니다." },
      { label: "퇴직연금", why: "퇴직연금은 회사를 통해 쌓는 사적연금입니다." },
      { label: "개인연금", why: "개인연금은 내가 따로 넣는 사적연금입니다." },
    ],
    explain: "세금과 건보 기준을 볼 때 공적과 사적을 나눠 셉니다.",
  },
  {
    q: `사적연금이 ${N_RETIRE.privateLimit}을 넘으면 어떻게 될까요?`,
    hint: "선을 넘으면 과세 방식이 갈립니다.",
    options: [
      { label: "종합과세되거나 분리과세를 고를 수 있습니다", ok: true, why: `넘은 해에는 종합과세 또는 ${N_RETIRE.separate} 분리과세 중에서 고릅니다.` },
      { label: "연금을 더 이상 받을 수 없습니다", why: "못 받는 것이 아니라 세금 계산 방식이 바뀌는 것입니다." },
      { label: "건강보험료가 바로 두 배가 됩니다", why: "건보료는 소득 합계와 재산을 따로 봅니다." },
    ],
    explain: "1,500만 원은 세금 기준입니다. 건보 기준과 섞지 않습니다.",
  },
  {
    q: "국민연금을 1년 늦게 받으면 수령액은 어떻게 될까요?",
    hint: "늦출수록 늘어납니다.",
    options: [
      { label: `1년마다 ${N_RETIRE.laterAdd}씩 늘어납니다`, ok: true, why: "연기하면 매달 조금씩 더해져 1년에 7.2% 수준으로 늘어납니다." },
      { label: `1년마다 ${N_RETIRE.earlyCut}씩 줄어듭니다`, why: "줄어드는 것은 일찍 받는 조기 수령입니다." },
      { label: "금액이 그대로입니다", why: "조기·연기에는 가산과 감액이 붙습니다." },
    ],
    explain: "정확한 금액은 국민연금공단 모의수령액에서 확인합니다.",
  },
];
/* ------------------------------------------------------------------
   강의 7개 — 초등·청소년·첫 월급·가계(2)·자산형성·은퇴 (v8.4.0)
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
        url: "https://www.fss.or.kr/edu/main/main.do",
        host: "fss.or.kr",
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
        url: "https://www.fss.or.kr/s1332/",
        host: "fss.or.kr",
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
    thesis: `명세서는 ① 지급 합계(세전) ② 공제 합계 ③ 실수령 세 줄입니다. 세전 ${N_PAY.grossWon}에서 공제 ${N_PAY.deduction}(가상 예시)을 빼면 실수령 ${N_PAY.netWon}입니다.`,
    step: 0,
    no: 1,
    label: "첫 월급 1강",
    shortTitle: "첫 월급명세서 3줄",
    title: "첫 월급명세서, 세전 300만 원에서 왜 33만 원이 빠질까? (공제 합계는 가상 예시)",
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
      { label: "4대보험(법정 요율)", value: N_PAY.insurance },
      { label: "공제 합계(가상 예시)", value: N_PAY.deduction },
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
        settings: ["세전 300만원", "공제 33만원(가상 예시)", "실수령 267만원"],
        result: `실수령 ${N_PAY.netWon}`,
        expect: "명세서의 지급·공제·실수령을 같은 순서로 읽습니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "insurance",
        label: "4대보험",
        title: `4대보험 근로자 부담 ${N_PAY.insurance} (2026 법정 요율)`,
        settings: ["국민연금 4.75%", "건강보험 3.595% · 장기요양은 근로자 절반", "고용보험 0.9%"],
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
        label: "국민연금공단 — 사업장가입자의 연금보험료 납부",
        what: "연도별 보험료율 표 — 2026년 9.5%, 근로자 기여금 4.75%·사업주 부담금 4.75%",
        url: "https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0016M0.do",
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
      line: "세전·공제 합계(가상 예시)·고정비를 넣어 실수령과 세 칸 금액을 적습니다.",
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
  {
    slug: "school-household-cashflow",
    track: "household",
    thesis: `실수령 ${N_HOUSE.income}에서 고정비와 대출 원리금 ${N_HOUSE.fixedLoan}을 먼저 빼면 남는 돈은 ${N_HOUSE.spare}입니다. 남는 돈을 세는 것이 아니라, 그 달에 줄일 수 없는 돈을 먼저 빼는 순서입니다.`,
    step: 0,
    no: 1,
    label: "가계 1강",
    shortTitle: "가계 현금흐름 3줄",
    title: "고정비·대출 원리금, 가계 현금흐름 3줄 점검 — 남는 돈은 어디서 줄까?",
    question: "가계에서 먼저 볼 세 줄은 무엇일까",
    readingMinutes: 5,
    hook: `같은 실수령 ${N_HOUSE.income}이라도 대출 원리금 ${N_HOUSE.loan4}이 꺼 있는 가계와 그렇지 않은 가계는 남는 돈이 ${N_HOUSE.loan4}만큼 다릅니다.`,
    fork: {
      short: {
        tag: "고정비가 많다",
        head: "날짜가 정해진 돈부터",
        body: `월세·통신·보험료처럼 매달 같은 날 나가는 돈을 먼저 셀니다. 고정비 ${N_HOUSE.fixed}과 원리금 ${N_HOUSE.loan4}을 더하면 ${N_HOUSE.fixedLoan}입니다.`,
        verdict: "변동비를 줄이기 전에 고정비 목록을 먼저 만듭니다.",
      },
      long: {
        tag: "대출 원리금이 크다",
        head: "금리와 기간을 나눠 봅니다",
        body: `원리금 ${N_HOUSE.loan4} 중 이자는 ${N_HOUSE.interest4}입니다. 금리가 6%가 되면 원리금은 ${N_HOUSE.loan6}으로 늘어납니다.`,
        verdict: "이 글의 주제입니다. 아래에서 세 줄과 비율을 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "실수령", value: N_HOUSE.income },
      { label: "고정비+원리금", value: N_HOUSE.fixedLoan },
      { label: "남는 돈", value: N_HOUSE.spare },
    ],
    numbers: N_HOUSE,
    calculator: {
      name: "가계 현금흐름 3줄 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 실수령·고정비·원리금·변동비를 고르면 남는 돈과 고정비 비율이 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "three",
        label: "세 줄",
        title: `${N_HOUSE.income} − ${N_HOUSE.fixedLoan} − ${N_HOUSE.variable} = ${N_HOUSE.spare}`,
        settings: ["실수령 500만원", "고정비 160만원", "대출 원리금 61만원 · 변동비 140만원"],
        result: `남는 돈 ${N_HOUSE.spare}`,
        expect: "세 줄을 쓰면 남는 돈은 자동으로 정해집니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "rate",
        label: "금리 6%",
        title: `원리금 ${N_HOUSE.loan4} → ${N_HOUSE.loan6} · 남는 돈 ${N_HOUSE.spare6}`,
        settings: ["대출 1억원 · 20년", "금리 4% → 6%", "원리금균등분할상환"],
        result: `월 ${N_HOUSE.loanDiff} 증가`,
        expect: "원금은 그대로이고 이자만 늘어납니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "ratio",
        label: "비율",
        title: `(${N_HOUSE.fixed} + ${N_HOUSE.loan4}) ÷ ${N_HOUSE.income} = ${N_HOUSE.ratio}`,
        settings: ["고정비 160만원", "원리금 61만원", "실수령 500만원"],
        result: `${N_HOUSE.ratio}`,
        expect: "50%에 가까우면 소득이 줄 때 남는 돈이 먼저 사라집니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
    ],
    sources: [
      {
        label: "금융감독원 파인 — 대출 금리 비교",
        what: "금융회사별 대출 금리와 상환 조건을 상품명 없이 비교",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "한국은행 — 기준금리·통화정책",
        what: "금리 변동의 출발점이 되는 기준금리 공표",
        url: "https://www.bok.or.kr/",
        host: "bok.or.kr",
      },
      {
        label: "통계청 — 가계금융복지조사",
        what: "가구의 소득·지출·부채 분포를 보는 국가 통계",
        url: "https://kostat.go.kr/",
        host: "kostat.go.kr",
      },
    ],
    cardSet: SET_HOUSEHOLD,
    sheet: {
      variant: "household",
      slotNo: 1,
      slotTitle: "가계 자금 일정표",
      line: "실수령·고정비·원리금·변동비를 넣어 세 줄과 남는 돈을 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "가계 2강 · 보장 공백 5칸",
      body: "남는 돈을 지키는 다음 단계는 보장 점검입니다. 가입금액이 아니라 약관의 다섯 칸을 봅니다.",
      href: "/academy/school-household-coverage/",
      status: "공개",
    },
    quiz: { items: QUIZ_HOUSE },
    reading: READING_HOUSE,
  },
  {
    slug: "school-household-coverage",
    track: "household",
    thesis: `같은 ${N_COVER.diag}이라도 유사암 ${N_COVER.unRate}면 ${N_COVER.un}, 감액 ${N_COVER.reduce}가 붙으면 ${N_COVER.reduced}입니다. 가입금액보다 약관의 다섯 칸이 실제 수령액을 정합니다.`,
    step: 0,
    no: 2,
    label: "가계 2강",
    shortTitle: "보장 공백 5칸",
    title: `보장 공백 5칸 — 약관과 건보료에서 갈리는 것, 같은 ${N_COVER.diag}이 왜 다를까?`,
    question: "가입금액과 실제 수령액은 왜 다를까",
    readingMinutes: 5,
    hook: `진단비 ${N_COVER.diag}을 넣어도 유사암·감액·면책에서 막히면 손에 들어오는 돈은 ${N_COVER.reduced}입니다.`,
    fork: {
      short: {
        tag: "진단비 숫자만 본다",
        head: "큰 숫자보다 조건",
        body: `진단비 ${N_COVER.diag}이 같아도 유사암은 ${N_COVER.unRate}입니다. 이름이 다르면 담보도 지급률도 다릅니다.`,
        verdict: "증권에서 다섯 칸을 먼저 찾아 표시합니다.",
      },
      long: {
        tag: "약관을 뜯어본다",
        head: "다섯 칸만 찾으면 됩니다",
        body: `실손 자기부담 · 면책·감액 · 유사암 지급률 · 수술비 종수 · 연금과 건보료 경계. 이 다섯 칸이 실제 수령액을 정합니다.`,
        verdict: "이 글의 주제입니다. 아래에서 내 증권 숫자로 계산합니다.",
      },
    },
    keyNumbers: [
      { label: "진단비", value: N_COVER.diag },
      { label: "유사암", value: N_COVER.un },
      { label: "감액 후", value: N_COVER.reduced },
    ],
    numbers: N_COVER,
    calculator: {
      name: "보장 공백 5칸 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 진단비·암 구분·감액을 고르면 예상 수령액이 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "usual",
        label: "유사암",
        title: `${N_COVER.diag} × ${N_COVER.unRate} = ${N_COVER.un}`,
        settings: ["진단비 3,000만원", "유사암 지급률 20%", "면책 지난 뒤"],
        result: `${N_COVER.un}`,
        expect: "일반암과 같은 금액을 기대하면 안 됩니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "reduced",
        label: "감액 50%",
        title: `${N_COVER.un} × ${N_COVER.reduce} = ${N_COVER.reduced}`,
        settings: ["진단비 3,000만원", "유사암 20%", "감액기간 1년 안"],
        result: `${N_COVER.reduced}`,
        expect: "감액은 지급을 막지 않고 금액을 줄입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
      {
        id: "boundary",
        label: "경계성",
        title: `${N_COVER.diag} × ${N_COVER.boundRate} = ${N_COVER.bound}`,
        settings: ["진단비 3,000만원", "경계성종양 10%", "일반암과 다른 담보"],
        result: `${N_COVER.bound}`,
        expect: "이름이 비슷해도 약관 정의가 다르면 다른 담보입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 계산하기",
      },
    ],
    sources: [
      {
        label: "금융위원회 — 실손의료보험 제도 안내",
        what: "5세대 실손의 자기부담 구조와 시행 시기 보도자료",
        url: "https://www.fsc.go.kr/",
        host: "fsc.go.kr",
      },
      {
        label: "국민건강보험공단 — 피부양자 자격 안내",
        what: "피부양자 소득·재산 요건(공적연금 연 2,000만원 기준)",
        url: "https://www.nhis.or.kr/",
        host: "nhis.or.kr",
      },
      {
        label: "금융감독원 파인 — 보험상품 공시",
        what: "약관·보험료·지급 기준을 상품명 없이 확인",
        url: "https://fine.fss.or.kr/",
        host: "fine.fss.or.kr",
      },
      {
        label: "법제처 국가법령정보센터 — 보험업법",
        what: "약관 설명 의무와 보험 계약의 기본 규칙",
        url: "https://www.law.go.kr/",
        host: "law.go.kr",
      },
    ],
    cardSet: SET_COVERAGE,
    sheet: {
      variant: "coverage",
      slotNo: 1,
      slotTitle: "약관 읽기표",
      line: "진단비와 지급률·감액을 넣어 예상 수령액을 적고, 다섯 칸을 표시합니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-30 · 교육비와 노후의 동시 계획",
      body: "가까운 목표와 먼 목표를 나눠 월 배분을 정합니다. 다음 편에서 두 기한을 함께 놓고 계산합니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_COVER },
    reading: READING_COVER,
  },
  {
    slug: "school-asset-split-weights",
    track: "asset",
    thesis: `${N_ASSET.total}을 ${N_ASSET.targetA}:${N_ASSET.targetB}로 나누면 ${N_ASSET.a} 쪽이 ${N_ASSET.dropA} 빠져도 전체는 ${N_ASSET.portLoss}만 줄어듭니다. 한 곳에 다 담았다면 ${N_ASSET.fullLoss}입니다.`,
    step: 0,
    no: 1,
    label: "자산형성 1강",
    shortTitle: "나눠 담기와 비중",
    title: "같은 100만 원, 나눠 담으면 무엇이 달라질까?",
    question: "왜 나눠 담으면 덜 흔들릴까",
    readingMinutes: 5,
    hook: `같은 ${N_ASSET.dropA} 하락인데, 나눠 담으면 ${N_ASSET.loss}가 줄고 한 곳에 다 담으면 ${N_ASSET.fullLoss}가 줄어듭니다.`,
    fork: {
      short: {
        tag: "한 곳에 다 담는다",
        head: `${N_ASSET.dropA} 빠지면 전체가 ${N_ASSET.dropA}`,
        body: `${N_ASSET.total}을 모두 A에 넣으면 A가 ${N_ASSET.dropA} 빠질 때 ${N_ASSET.fullLoss}가 사라집니다.`,
        verdict: "수익은 크지만 흔들림도 그대로 커집니다.",
      },
      long: {
        tag: "두 곳에 나눠 담는다",
        head: `${N_ASSET.targetA}:${N_ASSET.targetB}면 전체는 ${N_ASSET.portLoss}`,
        body: `${N_ASSET.a}와 ${N_ASSET.b}로 나누면 빠진 쪽에서만 손실이 납니다. 전체로는 ${N_ASSET.portLoss}입니다.`,
        verdict: "이 글의 주제입니다. 아래 운영표에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "가상 금액", value: N_ASSET.total },
      { label: `${N_ASSET.targetA} 쪽 하락`, value: N_ASSET.dropA },
      { label: "전체 손실", value: N_ASSET.portLoss },
    ],
    numbers: N_ASSET,
    calculator: {
      name: "나눠 담기 계산기",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 총액과 비중, 한쪽 하락률을 고르면 전체 손실률이 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "split",
        label: "나눠 담기",
        title: `${N_ASSET.total} = ${N_ASSET.a} + ${N_ASSET.b} · A ${N_ASSET.dropA} → 전체 ${N_ASSET.portLoss}`,
        settings: ["가상 100만원", "A 70% · B 30%", "A가 −30%"],
        result: `전체 ${N_ASSET.portLoss} 손실`,
        expect: "손실은 빠진 A에서만 납니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "full",
        label: "한 곳에",
        title: `${N_ASSET.total} 전부 A · ${N_ASSET.dropA} → ${N_ASSET.fullLoss}`,
        settings: ["가상 100만원", "A 100%", "A가 −30%"],
        result: `${N_ASSET.fullLoss} 손실`,
        expect: "같은 하락인데 전체 손실이 커집니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "overlap",
        label: "겹침",
        title: `이름이 다른 두 상품이 같은 회사를 ${N_ASSET.overlap}씩`,
        settings: ["상품 2개", "상위 종목이 겹침", "함께 움직임"],
        result: "사실상 한 곳",
        expect: "개수를 늘려도 겹치면 분산이 아닙니다.",
      },
    ],
    sources: [
      {
        label: "금융감독원 e-금융교육센터",
        what: "분산과 위험의 관계를 예시로 설명한 공식 교육 자료",
        url: "https://www.fss.or.kr/edu/main/main.do",
        host: "fss.or.kr",
      },
      {
        label: "금융투자협회 전자공시 — 펀드·ETF 구성",
        what: "상품의 상위 구성 종목과 업종 비중을 보는 1차 공시",
        url: "https://dis.kofia.or.kr/",
        host: "dis.kofia.or.kr",
      },
      {
        label: "한국은행 — 경제교육",
        what: "위험과 수익의 관계를 쉽게 풀어 쓴 공식 자료",
        url: "https://www.bok.or.kr/",
        host: "bok.or.kr",
      },
    ],
    cardSet: SET_ASSET_SPLIT,
    sheet: {
      variant: "assetplan",
      slotNo: 1,
      slotTitle: "분산 점검표",
      line: "총액·두 자산 비중·하락률을 넣어 전체 손실률을 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-37 · ETF 구성과 비용 읽기",
      body: "무엇에 나눠 담았는지 알았으니, 그 안의 구성과 비용을 숫자로 확인합니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_ASSET },
    reading: READING_ASSET,
  },
  {
    slug: "school-retire-3tier-order",
    track: "retire",
    thesis: `국민연금 ${N_RETIRE.national}·퇴직연금 ${N_RETIRE.retire}·개인연금 ${N_RETIRE.personal}을 받으면 월 ${N_RETIRE.month}, 연 사적연금 ${N_RETIRE.privateYear}·공적연금 ${N_RETIRE.publicYear}입니다. ${N_RETIRE.privateLimit}(세금)과 ${N_RETIRE.healthLimit}(건보료) 두 선을 따로 봅니다.`,
    step: 0,
    no: 1,
    label: "은퇴 1강",
    shortTitle: "3층 연금과 두 개의 선",
    title: "국민·퇴직·개인연금, 세 층은 언제 열릴까?",
    question: "연금은 언제, 어떤 순서로 받을까",
    readingMinutes: 5,
    hook: `세 층을 합치면 월 ${N_RETIRE.month}이지만, 세금 기준(${N_RETIRE.privateLimit})과 건보 기준(${N_RETIRE.healthLimit})은 서로 다른 숫자로 갈립니다.`,
    fork: {
      short: {
        tag: "한 숫자로 본다",
        head: "1,500만과 2,000만을 섞습니다",
        body: `사적연금 ${N_RETIRE.privateLimit}은 세금 기준, 소득 합계 ${N_RETIRE.healthLimit}은 건보 기준입니다. 하나를 넘었다고 다른 하나도 넘은 것이 아닙니다.`,
        verdict: "두 선을 따로 적어야 판단이 맞습니다.",
      },
      long: {
        tag: "세 층을 나눠 센다",
        head: "공적·사적·비는 구간",
        body: `국민연금 ${N_RETIRE.national}, 퇴직연금 ${N_RETIRE.retire}, 개인연금 ${N_RETIRE.personal}. 국민연금이 열리기 전 비는 구간을 사적연금으로 메웁니다.`,
        verdict: "이 글의 주제입니다. 아래 연금 지도에서 내 숫자로 확인합니다.",
      },
    },
    keyNumbers: [
      { label: "월 합계", value: N_RETIRE.month },
      { label: "연 사적연금", value: N_RETIRE.privateYear },
      { label: "연 공적연금", value: N_RETIRE.publicYear },
    ],
    numbers: N_RETIRE,
    calculator: {
      name: "3층 연금 지도",
      href: "#sheet",
      note:
        "이 페이지 아래 운영표가 계산기입니다. 세 층의 월 수령액을 고르면 연 사적연금과 소득 합계, 두 기준선이 함께 나옵니다(입력값은 화면에만).",
    },
    scenarios: [
      {
        id: "sum",
        label: "세 층 합계",
        title: `${N_RETIRE.national} + ${N_RETIRE.retire} + ${N_RETIRE.personal} = 월 ${N_RETIRE.month}`,
        settings: ["국민연금 월 170만원", "퇴직연금 월 50만원", "개인연금 월 30만원"],
        result: `월 ${N_RETIRE.month}`,
        expect: "금액은 가상 예시입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "private",
        label: "세금 기준",
        title: `(${N_RETIRE.retire} + ${N_RETIRE.personal}) × 12개월 = ${N_RETIRE.privateYear}`,
        settings: ["퇴직연금 월 50만원", "개인연금 월 30만원", "연 1,500만원 기준"],
        result: `${N_RETIRE.privateLimit} 아래`,
        expect: "연금소득세로 끝나는 구간입니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
      {
        id: "health",
        label: "건보 기준",
        title: `${N_RETIRE.national} × 12개월 = ${N_RETIRE.publicYear}`,
        settings: ["국민연금 월 170만원", "공적연금만 건보 소득으로 봄(사적연금 미부과)", "소득 합계 연 2,000만원 기준"],
        result: `${N_RETIRE.healthLimit} 위`,
        expect: "세금이 끝나도 건보 자격은 따로 확인합니다.",
        href: "#sheet",
        cta: "운영표에서 이 값 채우기",
      },
    ],
    sources: [
      {
        label: "국민연금공단 — 내 연금 알아보기",
        what: "가입 이력·예상 수령액과 조기·연기 수령 조건",
        url: "https://www.nps.or.kr/",
        host: "nps.or.kr",
      },
      {
        label: "금융감독원 통합연금포털 — 내 연금 확인",
        what: "공적연금·퇴직연금·개인연금을 한 번에 조회",
        url: "https://100lifeplan.fss.or.kr/",
        host: "fss.or.kr",
      },
      {
        label: "소득세법 제20조의3·제64조의4 — 연금소득",
        what: "사적연금 연 1,500만 원 기준과 연금소득세율",
        url: "https://www.law.go.kr/법령/소득세법",
        host: "law.go.kr",
      },
      {
        label: "국민건강보험공단 — 피부양자 자격 안내",
        what: "소득 합계 연 2,000만 원 등 피부양자 요건과 확인 절차",
        url: "https://www.nhis.or.kr/",
        host: "nhis.or.kr",
      },
    ],
    cardSet: SET_RETIRE_3TIER,
    sheet: {
      variant: "pensionmap",
      slotNo: 1,
      slotTitle: "연금 지도",
      line: "세 층의 월 수령액을 넣어 연 사적연금과 소득 합계, 두 기준선을 적습니다.",
    },
    next: {
      label: "다음 편",
      title: "FL-43 · 연금 개시와 인출 일정",
      body: "비는 구간을 무엇으로 메울지, 언제 얼마씩 꺼낼지 달력에 적습니다.",
      href: "/academy/#school-weeks",
      status: "준비중",
    },
    quiz: { items: QUIZ_RETIRE },
    reading: READING_RETIRE,
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

export const schoolCardSets = [
  SET_ALLOWANCE,
  SET_TEEN_PAY,
  SET_FIRSTPAY,
  SET_HOUSEHOLD,
  SET_COVERAGE,
  SET_ASSET_SPLIT,
  SET_RETIRE_3TIER,
];
