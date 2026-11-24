/**
 * 데일리 브리프 게시판 — `/board/` 데이터 (v9.3.1, 2026-11-24 3코너 개편 + '우리 글' 원칙).
 *
 * 왜 이 파일이 있나
 *  · 사이트는 하루 세 번(06:00 · 13:00 · 19:00) 자료를 확인한다. 그중 정식 칼럼으로 키우기엔
 *    짧고, '오늘 확인 허브'(data/today.ts)에 자리를 내주기엔 아까운 메모가 매일 남는다.
 *  · 그 메모를 버리지 않고 회차·분류·출처와 함께 쌓아 두는 곳이 이 게시판이다.
 *    글(자산리포트)은 한 편씩 깊게, 허브는 오늘 쓸 것만, 게시판은 **확인한 것 전부의 색인**을 맡는다.
 *
 * 세 코너 (2026-11-24 오전 개편 · 같은 날 '원문 글맛' 원칙으로 재정비)
 *  · 📊 금융·시장 브리프 — 시장 숫자·제도·보험 실무, 그리고 일에 쓰는 AI 메모. 1차 출처 링크를 붙인다.
 *  · 📖 오늘의 스토리·썰 — 온라인에 올라온 사람 이야기의 줄거리·대사·감정선을 말투만 다듬어 그대로 전한다.
 *    출처는 계정도 링크도 아닌 `SNS 커뮤니티` 한 줄이다.
 *  · 🔥 SNS 인기 콘텐츠 — 사회·문화에서 화제가 된 장면을 우리 말로 정리한 생활·문화 메모.
 *
 * 지키는 것 (today.ts와 같은 규칙)
 *  · '실시간'·'속보'·'긴급'을 쓰지 않는다 — 확인한 시각과 출처를 적는다. 아래 `validateBoard()`가
 *    제목·요약·불릿에 이 세 단어가 들어오면 **빌드를 세운다**(손으로 슬쩍 들어오지 못하게).
 *  · 금융 코너(시황·제도·보험·AI·실무)는 한 건 = 한 주장 + 1차 출처 링크 + 확인 시점(날짜·회차).
 *    스토리·썰 코너는 온라인에 돌던 사람 이야기를 **줄거리·대사·감정선 그대로** 옮기되 비속어·과한
 *    은어만 걷어 내고, 금융 교훈으로 각색하지 않는다. 출처는 `SNS 커뮤니티`로만 적는다.
 *    SNS 화제 코너는 소재만 참고해 우리 문장으로 다시 쓴다.
 *    어느 쪽이든 외부 계정·원문 링크·조회수·'사실 확인 안 됨' 같은 표기는 두지 않는다
 *    (아래 `BOARD_ORIGIN_TRACES`가 빌드에서 막는다).
 *  · 영업성 문구·상담 CTA를 넣지 않는다. 게시판은 읽는 곳이지 권하는 곳이 아니다.
 *  · 내부 호출명(봇·회의실 이름)은 독자에게 내보내지 않는다. 정리 주체는 `curator`에 독자용 표기로 적는다.
 *  · 스토리·썰 코너는 원문을 옮겨 적는 코너이므로, 사실 여부를 우리가 단정하지 않는다 — 카드에는
 *    이야기만 두고 '확인된 사실'이라는 말을 붙이지 않는다. 선정적인 장면·비속어는 덜어 낸다.
 *
 * 새 회차를 넣는 방법
 *  · 배열 맨 앞이 아니라 아무 곳에나 한 건 추가하면 된다 — 화면은 `boardSorted()`가 날짜·회차 역순으로 정렬한다.
 *  · `id`는 `YYYYMMDD-slot-슬러그` 꼴로 두어 나중에 링크(`/board/#id`)로 집을 수 있게 한다.
 *  · 요약은 2~3문장, 불릿은 2~3줄. 숫자에는 분모(무엇 대비)와 기준 시점을 함께 적는다.
 */

export const BOARD_CATEGORIES = ["시황", "제도·보험", "AI·실무", "스토리·썰", "SNS 화제"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];

export const BOARD_SLOTS = ["06:00", "13:00", "19:00"] as const;
export type BoardSlot = (typeof BOARD_SLOTS)[number];

export type BoardEntry = {
  /** `YYYYMMDD-slot-슬러그` — 화면 앵커로 쓴다 */
  id: string;
  /** 확인한 날짜 (KST) */
  date: string; // YYYY-MM-DD
  /** 확인 회차 */
  slot: BoardSlot;
  category: BoardCategory;
  /** 사실문 제목 — 읽고 나서 무슨 일인지 남게 */
  title: string;
  /** 2~3문장 핵심 요약 */
  summary: string;
  /** 핵심 포인트 2~3줄 */
  bullets: string[];
  /**
   * 출처 표기 (사람이 읽는 표기).
   *  · 금융 코너: 기관·매체 이름 (필수)
   *  · 스토리·썰: `SNS 커뮤니티` 고정 — 계정도 링크도 아닌 한 줄
   *  · SNS 화제: 쓰지 않는다
   */
  source?: string;
  /** 원문 링크 (1차 또는 검증 출처). 금융 코너만 채운다 — 스토리·SNS는 비운다 */
  sourceUrl?: string;
  /** 정리 주체 — 독자용 표기. 내부 호출명은 쓰지 않는다 */
  curator: string;
};

/** 코너 — 화면 상단 3장의 안내 카드이자 필터 단위 */
export type BoardCorner = {
  key: "market" | "story" | "sns";
  emoji: string;
  title: string;
  /** 한 줄 색깔 — 코너가 무엇을 맡는지 */
  tagline: string;
  /** 두 줄 설명 */
  blurb: string;
  /** 이 코너에 묶이는 분류 */
  categories: BoardCategory[];
  /** 화면 색 계열 (data-tone) */
  tone: "market" | "story" | "sns";
};

export const BOARD_CORNERS: BoardCorner[] = [
  {
    key: "market",
    emoji: "📊",
    title: "금융·시장 브리프",
    tagline: "숫자와 제도로 보는 오늘의 돈 흐름",
    blurb:
      "지수·금리·환율, 바뀐 제도, 보험 실무 숫자를 확인한 그대로 적습니다. 일에 바로 쓰는 AI·도구 메모도 이 코너에 함께 둡니다.",
    categories: ["시황", "제도·보험", "AI·실무"],
    tone: "market",
  },
  {
    key: "story",
    emoji: "📖",
    title: "오늘의 스토리·썰",
    tagline: "숫자 사이에서 잠깐 쉬어가는 사람 이야기",
    blurb:
      "온라인에서 화제가 된 사람 이야기를 말투만 다듬어 그대로 전합니다. 줄거리도 대사도 감정선도 원문 그대로, 출처는 SNS 커뮤니티로 적습니다.",
    categories: ["스토리·썰"],
    tone: "story",
  },
  {
    key: "sns",
    emoji: "🔥",
    title: "SNS 인기 콘텐츠",
    tagline: "요즘 사람들이 이야기하는 장면과 흐름",
    blurb:
      "사회·문화에서 화제가 된 장면을 우리 시선으로 정리한 생활·문화 메모입니다. 숫자와 맥락을 우리 말로 다시 놓습니다.",
    categories: ["SNS 화제"],
    tone: "sns",
  },
];

/** 금지어 — 확인한 시점을 적는 대신 긴장을 파는 말은 쓰지 않는다 */
export const BOARD_BANNED_WORDS = ["실시간", "속보", "긴급"] as const;

/**
 * 출처 링크가 반드시 붙는 분류 — 숫자·제도·실무를 다루는 금융 코너다.
 * 이 코너는 카드마다 1차 출처와 `https://` 원문 링크를 함께 둔다(대조할 수 있어야 한다).
 */
export const BOARD_SOURCED_CATEGORIES = ["시황", "제도·보험", "AI·실무"] as const;

/**
 * 출처 링크를 두지 않는 분류 — 스토리·썰과 SNS 화제.
 * 두 코너 모두 외부 계정·원문 링크·조회수를 두지 않고, 출처 표기는 경우에 따라 다르다(아래 참고).
 */
export const BOARD_ORIGINAL_CATEGORIES = ["스토리·썰", "SNS 화제"] as const;

/**
 * 스토리·썰 코너에 붙는 고정 출처 표기.
 * 원문을 그대로 살리되 계정·링크는 남기지 않는다 — 독자에게는 'SNS에서 돈 이야기' 한 줄이면 충분하다.
 */
export const BOARD_STORY_SOURCE = "SNS 커뮤니티";

/**
 * 원본 흔적 — 스토리·SNS 코너의 제목·요약·불릿·출처 표기에 남으면 빌드를 세운다.
 *  · 계정(@)·플랫폼 주소(x.com)·플랫폼 이름     → 어느 계정에서 왔는지 노출
 *  · 원문·링크·조회·좋아요·리포스트·팔로워   → 원문으로 보내거나 반응을 파는 표시
 *  · 보도·사실 확인·확인되지 않             → 방어/원본 표기
 * 스토리·썰은 원문의 글맛을 살리되, **출처는 `SNS 커뮤니티` 한 줄**로만 남긴다. 계정·링크·조회수가
 * 붙는 순간 남의 글을 그대로 옮겨 온 페이지가 되고, 그 글을 쓴 사람에게도 우리에게도 손해다.
 */
export const BOARD_ORIGIN_TRACES = [
  "@",
  "x.com",
  "twitter",
  "인스타그램",
  "인스타",
  "스레드",
  "유튜브",
  "원문",
  "리포스트",
  "재게시",
  "팔로워",
  "좋아요",
  "조회",
  "사실 확인",
] as const;

/** 정리 주체 표기 — 내부 조직명 대신 독자가 읽을 이름 하나 */
const CURATOR = "데일리 리서치";
const CURATOR_STORY = "버핏킴즈 스토리 노트";
const CURATOR_SNS = "버핏킴즈 트렌드 노트";

const SEED: BoardEntry[] = [
  {
    id: "20261124-1300-kospi-five-thousand",
    date: "2026-11-24",
    slot: "13:00",
    category: "시황",
    title: "코스피 5,042.09로 5,000선을 되찾았습니다 — 전일 종가보다 7.08% 올림",
    summary:
      "24일 코스피는 전일 종가 4,708.54보다 333.55포인트(7.08%) 오른 5,042.09를 13시 16분에 기록했습니다. 개장은 4,880.16(3.64% 올림)이었고 2분 만에 5,003.29까지 오르며 5,000선을 다시 넘었습니다. 전일 3.31% 내리며 4,700선에 머문 지 하루 만의 반등입니다.",
    bullets: [
      "삼성전자 19만 2,300원(8.34% 올림) · SK하이닉스 118만 5,000원(9.22% 올림) — 13시 17분 기준으로 두 종목이 지수를 끌어올렸습니다",
      "코스닥도 665.69(4.76% 올림)로 함께 올랐습니다 — 11시 26분 코스피는 5,020.90(6.63% 올림)이었고, 같은 날 오전 보도에서는 두산 14% · LG전자 16% · 현대차 9%대 상승도 함께 전해졌습니다",
      "반등 재료는 23일(현지) 뉴욕에서 나왔습니다 — 젠슨 황 엔비디아 CEO 복귀로 나스닥이 6.51% 올랐고 그 온도가 국내 반도체로 옮겨 붙었습니다. 하루 만에 되돌린 폭이 커서 종가까지 유지되는지가 다음 확인 지점입니다",
    ],
    source: "한국거래소(Naver 금융) 11. 24. 13:16 · 뉴스1 11. 24. 11:45",
    sourceUrl: "https://www.news1.kr/finance/market-exr/6364090",
    curator: CURATOR,
  },
  {
    id: "20261124-1300-economic-policy-direction",
    date: "2026-11-24",
    slot: "13:00",
    category: "제도·보험",
    title: "내년 경제 청사진 이름이 '경제정책방향'으로 돌아옵니다 — 민생·성장·양극화를 함께",
    summary:
      "정부가 매년 내던 경제정책 청사진 명칭을 '경제성장전략'에서 '경제정책방향'으로 다시 바꿉니다. 이형일 부총리 겸 재정경제부 장관은 24일 국무회의에서 '2027년 경제정책방향 주요 골자'를 보고하며 민생 안정·성장동력 확충·글로벌 경쟁력 강화를 3대 방향으로 제시했습니다. 금융·외환·부동산 시장 리스크 관리와 양극화 완화, 잠재성장률 제고 대책이 함께 담깁니다.",
    bullets: [
      "발표 주기는 연 2회에서 1회로 줄고, 대신 성장률 등 경제 전망 횟수를 3차례로 늘립니다",
      "주거·일자리·서민금융 3대 민생 프로젝트를 다음 달 중 따로 발표합니다 — 세제와 지원 제도가 붙는 대목이라 내년 살림 계획과 바로 이어집니다",
      "부총리는 수출·투자 증가세가 내수로 파급되며 양호한 성장 흐름이 이어질 것으로 봤지만, 미국 AI 데이터센터 규제와 글로벌 금리 상승, 지정학 불안은 대외 위험으로 남겨 두었습니다",
    ],
    source: "연합인포맥스 2026. 11. 24. 11:52",
    sourceUrl: "https://news.einfomax.co.kr/news/articleView.html?idxno=4446248",
    curator: CURATOR,
  },
  {
    id: "20261124-1300-bok-survey-54",
    date: "2026-11-24",
    slot: "13:00",
    category: "시황",
    title: "채권시장 전문가 54%가 26일 금통위 인상을 봅니다 — 체감지표는 78.7",
    summary:
      "금융투자협회의 12월 채권시장지표 조사에서 응답자 54%가 26일 금융통화위원회에서 기준금리를 올릴 것으로 봤고 46%는 동결을 예상했습니다. 조사는 11월 13일부터 18일까지 54개 기관 100명이 답했습니다. 12월 종합 채권시장 체감지표(BMSI)는 78.7로 전월 99.1보다 20.4포인트 내렸습니다.",
    bullets: [
      "BMSI는 100을 넘으면 채권가격 상승(금리 하락) 기대가 크다는 뜻입니다 — 78.7은 그 반대로 금리 상승 쪽으로 심리가 기울었다는 표시입니다",
      "금리전망 BMSI는 72.0으로 전월 123.0에서 51.0포인트 급락했습니다 — 시장금리 상승을 예상한 응답자가 17%에서 39%로 늘었습니다",
      "현재 기준금리는 3.00%(10월 22일 동결)이고, 26일 인상이 결정되면 예·적금과 변동금리 대출 금리가 함께 움직입니다",
    ],
    source: "금융투자협회 12월 채권시장지표 · 이투데이 2026. 11. 24. 11:03",
    sourceUrl: "https://www.etoday.co.kr/news/view/2652153",
    curator: CURATOR,
  },
  {
    id: "20261124-1300-jeonse-monthly-rent",
    date: "2026-11-24",
    slot: "13:00",
    category: "제도·보험",
    title: "지난해 4가구 중 1가구는 월세 — 전세 비중은 13.3%까지 내려갔습니다",
    summary:
      "국가데이터처가 24일 발표한 인구주택총조사에 따르면 지난해 전체 2,249만 5,000가구 가운데 월세가 26%, 전세가 13.3%였습니다. 2020년 조사와 견주면 전세는 25만 4,000가구(7.8%) 줄고 보증금 있는 월세는 103만 9,000가구(23.7%) 늘었습니다. 2015년부터 월세가 전세를 앞선 흐름이 지난해까지 이어졌습니다.",
    bullets: [
      "보증금 있는 월세 24.1%(542만 6,000가구), 보증금 없는 월세 1.9%(42만 3,000가구) — 보증금 없는 월세는 2020년보다 9만 5,000가구 줄었습니다",
      "자가 비중은 57%(1,281만 6,000가구)이고, 서울은 자가 42% · 전세 21.7% · 월세 33.7%로 다른 시도보다 임차 비중이 높습니다",
      "전세 감소 배경으로는 보증금 부담과 전세보증금 사기 같은 문제가 지목됐습니다 — 보증금을 빼서 월세로 옮기면 목돈은 줄지만 매달 나가는 현금이 생깁니다",
    ],
    source: "국가데이터처 인구주택총조사 · 파이낸셜뉴스 2026. 11. 24. 12:00",
    sourceUrl: "https://www.fnnews.com/news/202611241134010300",
    curator: CURATOR,
  },
  {
    id: "20261124-1300-story-dutch-pay",
    date: "2026-11-24",
    slot: "13:00",
    category: "스토리·썰",
    title: "생일 챙기자고 먼저 말한 친구가, 자기 회비는 다음 달에 내겠다고 했습니다",
    summary:
      "대학 때부터 친하게 지내는 여섯 명이 오랜만에 모여 친구 생일을 겸해 술자리를 했어요. 예약을 맡은 제가 먼저 카드로 25만원을 계산하고 다음 날 단톡방에 6명이니 한 사람당 4만 1,667원인데 그냥 4만원씩만 달라고 올렸지요. 그런데 한 친구가 '생일인 애한테까지 돈 받는 건 좀 그렇지 않냐'고 했고, 저는 그 말이 맞다 싶어 생일인 친구를 빼고 다섯이 5만원씩 나누기로 했습니다.",
    bullets: [
      "그런데 생일인 친구가 '나도 돈 낼게' 하자 그 친구가 바로 '넌 가만히 있어, 생일인데 우리가 사줘야지' 하더라고요. 다들 멋있다고 장난을 치고 그렇게 정산이 끝나는 줄 알았습니다.",
      "저녁에 확인해 보니 네 명만 돈을 보냈고, 안 보낸 사람은 그 말을 먼저 꺼낸 그 친구였어요. 개인톡으로 알렸더니 '이번 달 카드값이 너무 많이 나와서 다음 달 월급날에 보내도 되냐'고 했습니다. 나중에 안 사실인데 그 친구는 술자리에서 생일인 친구에게 '오늘은 우리가 쏘는 거니까 신경 쓰지 마'라고 몇 번이나 말하고 다녔다고 해요.",
      "며칠 뒤 그가 또 모이자고 글을 올리기에 '지난번 밥값부터 내고 모이자' 하고 웃어 넘겼더니, 그제야 미안하다며 5만원을 보내왔습니다. 다 같이 내는 돈이었는데 혼자 멋있는 사람이 되고 싶었던 걸까요. 생일인 친구가 나중에 커피를 사면서 '나 때문에 너네 돈 더 쓴 거 아니야?' 하길래 '돈은 다 똑같이 냈어, 한 놈이 좀 늦게 내긴 했지만' 하고 웃었습니다.",
    ],
    source: BOARD_STORY_SOURCE,
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-1300-story-play-ticket",
    date: "2026-11-24",
    slot: "13:00",
    category: "스토리·썰",
    title: "열아홉 살 인쇄소 사장님이 주신 연극표 두 장, 20년이 지나도 남아 있습니다",
    summary:
      "집안 형편 때문에 고등학교를 졸업하자마자 동네 인쇄소에 취직했어요. 사장님과 직원 두 분, 저까지 네 명이 일하는 작은 곳이었는데 사장님은 말수가 적은 대신 밥은 꼭 챙겨 주셨고 제가 실수하면 화부터 내지 않고 다시 알려 주셨지요. 어느 금요일 퇴근 무렵 사장님이 '내일 저녁에 약속 있냐'고 물으시더니 봉투 하나를 건네셨는데, 사모님과 보려고 예매한 대학로 연극표 두 장이 들어 있었습니다.",
    bullets: [
      "'갑자기 집안일이 생겨 못 가게 됐으니 친구 데리고 다녀오라'고 하셨어요. 연극을 한 번도 본 적 없다고 사양했더니 '안 가 봤으면 이번에 한번 가 봐, 표 그냥 버리면 아깝잖아' 하시더라고요. 고등학교 친구와 처음 간 공연장에서 배우들이 눈앞에서 연기하는 걸 보고, 마지막에 주인공이 꿈을 포기하려다 다시 도전하는 장면에서 괜히 눈물이 났습니다.",
      "월요일에 나가니 사장님이 '연극은 재밌었냐'고 물으셨고, 제가 신나서 한참 얘기하자 '너 이제 겨우 열아홉이잖아, 앞으로 볼 게 얼마나 많은데' 하시며 '돈 버는 것도 중요하지. 근데 쉬는 날에는 네가 좋아하는 것도 좀 하면서 살아' 하셨어요. 그날 이후로 쉬는 날에 도서관도 가고 영화도 보고, 월급에서 조금씩 모아 공연을 보러 다녔습니다. 집에 보태는 돈은 그대로였고 제 몫으로 쓰는 돈을 따로 모으기 시작한 것뿐이었어요.",
      "3년쯤 뒤 다른 일을 배워 보고 싶어 그만둔다고 했더니 '가서 잘해라, 밥 거르지 말고' 하시며 마지막까지 밥을 사 주셨습니다. 마흔다섯이 되어 고향에 갔다가 그 인쇄소 간판이 그대로인 걸 보고 들어갔더니 사장님은 이미 은퇴하셨고, 새 사장님이 연락을 이어 주셔서 며칠 뒤 전화가 왔어요. '연극표 주셨던 거 기억하세요?' 하고 물으니 '내가 그런 것도 줬었냐' 하시더라고요. 20년 넘게 기억한 일을 사장님은 기억하지 못하셨는데 그게 오히려 더 고맙더라고요. 요즘은 아이가 공연 보러 가자고 하면 시간을 내서 같이 갑니다.",
    ],
    source: BOARD_STORY_SOURCE,
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-1300-story-sign-language-speech",
    date: "2026-11-24",
    slot: "13:00",
    category: "스토리·썰",
    title: "신부를 울린 축사 — 남동생은 수어로, 신랑은 소리로 같은 말을 전했습니다",
    summary:
      "대학 때 주말마다 예식장에서 아르바이트를 했는데 몇 년이 지난 지금도 잊히지 않는 결혼식이 하나 있어요. 식 시작 40분 전쯤 신랑이 스물두 살쯤 된 남자와 함께 와서 진행 담당자와 이야기를 나눴는데 신부의 남동생이었습니다. 청각장애가 있어 평소 수어와 문자로 대화하는 분이었는데, 신부 몰래 축사를 준비했고 원래 축사를 하기로 한 신랑 친구 대신 순서를 바꿔 달라고 미리 부탁해 둔 거였어요.",
    bullets: [
      "동생이 직접 쓴 원고를 신랑이 옆에서 읽고 동생은 같은 내용을 수어로 전하기로 했으며, 긴장해서 순서가 꼬일까 봐 둘이 여러 번 연습했다고 했습니다. 축사 순서가 되자 사회자가 '신부님을 위해 특별히 축사를 준비한 분이 계십니다'라고 했고, 뒤를 돌아본 신부는 동생이 앞으로 나오자 깜짝 놀랐어요.",
      "동생은 '누나 이제 내 걱정은 조금 덜 해도 돼'로 시작해, 학교에서 친구들이 자기 말을 못 알아들을 때도 누나가 먼저 무슨 일이냐고 물어봐 줬다는 이야기를 꺼냈습니다. '누나도 어린애였는데 맨날 나부터 챙겼잖아', '이제 누나도 누나 하고 싶은 거 많이 하면서 살았으면 좋겠어'라는 말이 이어지자 신부가 얼굴을 가리고 울기 시작했어요.",
      "동생은 매형에게도 고마움을 전했습니다. '처음 만났을 때부터 내 말을 직접 알아듣고 싶다고 수어를 배우셨잖아요'라는 대목에서 신랑도 목이 메었고, 마지막 문장 '매형 우리 누나 잘 부탁드립니다'에 하객석에서도 훌쩍이는 소리가 났어요. 나중에 들으니 신랑은 결혼식 몇 달 전부터 동생과 따로 만나 축사를 준비하며 수어를 배우고 있었습니다.",
    ],
    source: BOARD_STORY_SOURCE,
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-0600-nvidia-return-yields",
    date: "2026-11-24",
    slot: "06:00",
    category: "시황",
    title: "엔비디아 CEO 복귀에 뉴욕은 급등, 국채 금리는 반대로 올랐습니다",
    summary:
      "23일(현지) 뉴욕증시는 젠슨 황 엔비디아 CEO 복귀로 7거래일 하락을 끊었습니다. 나스닥 24,089.56(전일 종가 대비 6.51% 올림), S&P500 7,237.17(4.73% 올림)로 지난해 4월 이후 가장 큰 하루 상승이었고 엔비디아는 31.5% 올랐습니다. 반면 미 10년물 금리는 4.94~4.96%로 2bp 넘게 올라, 같은 재료에 주가와 금리가 반대로 움직였습니다.",
    bullets: [
      "나스닥 +6.51% · S&P500 +4.73% · 다우 +3.01% · 필라델피아 반도체 14%대 — 위험자산으로 자금이 되돌아왔습니다",
      "미 10년물 4.94%(Reuters 집계)~4.96%(WSJ 유럽장), 2년물 4.69% — 연준 인상 베팅이 살아 있어 장기금리는 되레 올랐습니다",
      "복귀 배경(외국 정보기관 표적 의혹 독립조사)과 12월 1일 미 상원 비공개 청문회는 남아 있어, 이 상승이 추세인지 되돌림인지는 아직 확인되지 않았습니다",
    ],
    source: "연합뉴스(11. 24. 07:57 송고) · Reuters·WSJ 금리 집계",
    sourceUrl: "https://www.yna.co.kr/view/AKR20261124009452072",
    curator: CURATOR,
  },
  {
    id: "20261124-0600-silson-switch-rate",
    date: "2026-11-24",
    slot: "06:00",
    category: "제도·보험",
    title: "5세대 실손 46만 건 중 1·2세대 전환은 8.7% — 할인 이틀째의 출발점",
    summary:
      "지난달 말까지 9개 손해보험사 5세대 실손 누적 가입은 46만 1,308건이고, 그중 1·2세대에서 넘어온 계약은 4만 323건(8.7%)입니다. 신규 가입 29만 1,563건과 4세대 재가입 10만 4,583건이 85.9%를 차지했습니다. 23일부터 계약전환 50% 할인과 선택형 할인특약이 시작돼, 미뤄 둔 전환이 움직이는지가 앞으로의 관전 포인트입니다.",
    bullets: [
      "1세대 1만 5,662건 · 2세대 2만 4,661건 = 4만 323건 — 5세대 전체 가입의 8.7%",
      "대상은 2013년 3월 이전 가입·재가입 조건이 없는 계약(보도 기준 약 1,630만 건), 신청은 2027년 5월 22일까지",
      "50% 할인은 3년 한정이고 전환하면 도수치료 등 비중증 비급여 보장이 줄어듭니다 — 보험료만 보고 정할 일이 아닙니다",
    ],
    source: "뉴스1(11. 23.) · 금융위원회 보도자료(11. 19.)",
    sourceUrl: "https://www.fnnews.com/news/202611230707013134",
    curator: CURATOR,
  },
  {
    id: "20261124-0600-buyback-limit",
    date: "2026-11-24",
    slot: "06:00",
    category: "제도·보험",
    title: "상장사 자사주 1일 매수한도, 11월 24일부터 3개월간 풀립니다",
    summary:
      "금융위원회는 23일 제20차 정례회의에서 상장기업의 1일 자기주식 매수주문 수량 한도를 24일부터 2027년 2월 23일까지 완화하기로 의결했습니다. 직접 취득은 취득신고 주식수 전체를, 신탁 취득은 신탁재산 총액 범위에서 하루에 주문할 수 있습니다. 다만 배당가능이익 한도 안에서만 살 수 있다는 상법상 제한은 그대로입니다.",
    bullets: [
      "직접 취득: 신고 주식수의 10%와 직전 1개월 일평균거래량의 25% 중 큰 수량(발행주식 총수 1% 한도) → 취득신고 주식수 전체",
      "신탁 취득: 발행주식 총수의 1% 이내 → 신탁재산 총액 범위",
      "증안펀드 즉시 가동 준비와 함께 나온 조치입니다 — 외국인 순매도로 생긴 수급 공백을 메우는지가 이번 주 확인할 지점입니다",
    ],
    source: "금융위원회 보도참고(2026. 11. 23.)",
    sourceUrl: "https://www.fsc.go.kr/no010101/88190",
    curator: CURATOR,
  },
  {
    id: "20261124-0600-gemini-file-slicing",
    date: "2026-11-24",
    slot: "06:00",
    category: "AI·실무",
    title: "Gemini API 파일 슬라이싱 — 긴 PDF·시트에서 필요한 페이지만 읽힙니다",
    summary:
      "구글이 11월 23일 Gemini API에 파일 슬라이싱을 넣었습니다. 업로드한 PDF의 페이지 범위, 스프레드시트의 탭·셀 범위, 영상·음성의 구간을 지정하면 서버에서 잘라 읽고, 모델이 실제로 본 부분만 토큰으로 계산됩니다. 긴 문서를 통째로 넣던 방식과 비용 구조가 달라집니다.",
    bullets: [
      "문서는 start_page·end_page와 해상도(low·medium·high), page_text·page_image 레이어를 고릅니다 — medium 기준 페이지당 약 560토큰",
      "먼저 page_text로 훑고 도표·차트가 있는 페이지만 high로 다시 여는 두 단계가 절약의 핵심입니다",
      "구글이 인용한 절감폭(문서 67% 등)은 협력사 단일 업무 기준 수치라 일반화할 수 없습니다 — 파일 구조와 고른 범위에 따라 달라집니다",
    ],
    source: "Google Developers Blog(2026. 11. 23.) · Gemini API 문서",
    sourceUrl: "https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/",
    curator: CURATOR,
  },
  {
    id: "20261124-0600-story-lotto-second",
    date: "2026-11-24",
    slot: "06:00",
    category: "스토리·썰",
    title: "로또 2등 당첨됐다고 말했더니, 엄마는 축하 대신 화부터 내셨습니다",
    summary:
      "작년에 다니던 회사 계약이 끝나고 몇 달째 취업 준비 중이었어요. 생활비를 아끼려고 엄마랑 같이 살았는데, 동네에서 작은 반찬가게를 하시는 엄마는 몇 년 전 가게를 옮기면서 받은 대출이 아직 남아 있었고 밤마다 장부를 정리하며 한숨을 쉬셨지요. 어느 토요일 가게 일을 도와드리고 집에 가려는데 엄마가 만원짜리 한 장을 쥐여주시며 '오늘 고생했으니까 맛있는 거 사 먹어' 하셨고, 서른이라며 웃는 저에게 '서른이면 뭐 어때 아직 내 아들인데' 하셨어요. 그 만원으로 자동 5천원어치를 사고 남은 5천원으로 김밥 한 줄을 먹었는데, 다음 날 아침 그 종이가 2등이 되어 있었습니다.",
    bullets: [
      "번호를 확인하는데 숫자가 하나씩 맞기 시작했어요. 다섯 개가 맞길래 3등인가 했더니 보너스 번호까지 맞아서 손이 덜덜 떨렸고, 당첨금은 세전 5천만원이 조금 넘었습니다",
      "거실로 뛰어나가 '엄마 나 로또 당첨됐어!' 했더니 엄마는 TV를 보시다가 '얼마나 됐는데?' 하고 물으시고는 표정이 굳으셨어요 — '너 이상한 문자 받은 거 아니야? 요즘 당첨됐다고 돈 보내라는 사기 많다는데'",
      "복권과 공식 당첨 번호를 같이 보여드리고 '어제 엄마가 준 만원으로 산 거야' 했더니, 엄마가 한참 복권을 보시다가 조용히 '우리 아들 이제 취업 안 됐다고 너무 기죽어 있지 않아도 되겠네' 하셨어요. 신나 있던 제가 그 말에 울컥했고, 남은 가게 대출 1,800만원은 제가 갚았습니다 — 은행 앞에서 엄마가 제 팔을 잡고 '아들 고맙다' 하실 때는 목이 메더라고요",
    ],
    source: BOARD_STORY_SOURCE,
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-0600-story-riceball",
    date: "2026-11-24",
    slot: "06:00",
    category: "스토리·썰",
    title: "새벽 5시 반 편의점, 모르는 아저씨가 사준 삼각김밥 때문에 울었습니다",
    summary:
      "취업 준비할 때 생활비를 벌려고 밤 11시부터 아침 7시까지 편의점 야간 알바를 했어요. 낮에는 자소서를 쓰고 면접을 다니느라 잠도 모자랐는데, 새벽 5시 반쯤이면 꼭 오시는 배송기사 아저씨가 '학생은 맨날 밤에 일하네' 하며 몇 달째 캔커피 하나와 삼각김밥을 사 가셨지요. 면접 분위기가 좋아 기대했던 회사에서 최종 탈락 연락을 받은 날, 그 아저씨가 '오늘은 왜 이렇게 기운이 없어' 하고는 삼각김밥 두 개와 우유를 계산해 제 쪽으로 밀어주셨어요.",
    bullets: [
      "그날은 입맛이 없어 새벽에 아무것도 못 먹은 상태였어요. '조금 있다 먹으려고요' 했더니 아저씨가 진열대로 다시 가서 삼각김밥 두 개랑 우유를 더 가져와 계산하고 '이건 학생 먹어' 하시더라고요",
      "'나도 젊을 때 남한테 밥 많이 얻어먹었어, 부담 갖지 말고 먹어' 하시고 나가시기 전에 '혹시 취업 때문에 무슨 일 있었어?' 물으셔서 면접 떨어졌다는 연락을 받았다고 했더니, '아이고 많이 속상했겠다, 그동안 열심히 준비했을 텐데' 하시는데 목이 꽉 막혔어요",
      "그동안 주변에서는 '다음엔 붙을 거야' '더 열심히 하면 돼'라고 했는데, 아저씨는 힘내라는 말도 조언도 없이 '많이 속상했겠다' 한마디만 하셨어요. 두 달 뒤 취업해서 마지막 근무 날 늘 드시던 캔커피를 사드렸고, 몇 달 뒤 회사에서 야근하는 신입에게 '일단 밥부터 먹어요' 하고 김밥을 사 준 것도 그 아저씨 덕분입니다",
    ],
    source: BOARD_STORY_SOURCE,
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-0600-sns-csat-appeals",
    date: "2026-11-24",
    slot: "06:00",
    category: "SNS 화제",
    title: "세계사 2번이 남긴 숙제 — 진시황으로 읽으면 틀리는 문항",
    summary:
      "2027학년도 수능 사회탐구 세계사 2번은 시험장 밖에서도 오래 이야기됐습니다. 제시문 앞부분의 화폐·도량형 통일과 장성 축조는 진시황을 떠올리게 하지만, 중간의 '광통거 착공' 한 구절이 인물을 수나라 문제(양견)로 바꿉니다. 정답은 9품중정제를 폐지했다는 선지이고, 익숙한 키워드로 답을 고르면 정확히 함정에 걸리는 구조입니다.",
    bullets: [
      "다섯 선지가 모두 실제 황제의 업적으로 채워져 있어, 키워드 하나만 잡고 넘어가면 틀립니다",
      "기출을 외우는 공부와 제시문을 끝까지 읽는 공부의 차이가 드러난 문항 — 변별력은 난이도가 아니라 읽는 순서에서 갈립니다",
      "시험이 끝난 뒤의 이의신청은 실력을 다투는 일이 아니라 절차를 다투는 일입니다 — 최종 정답 발표 전까지는 확정된 답이 아닙니다",
    ],
    curator: CURATOR_SNS,
  },
  {
    id: "20261124-0600-sns-doomsday-trailer",
    date: "2026-11-24",
    slot: "06:00",
    category: "SNS 화제",
    title: "12월 16일, 두 대작이 같은 날 문을 엽니다 — 연말 극장가의 셈법",
    summary:
      "'어벤져스: 둠스데이'와 '듄: 파트 3'가 12월 16일 국내에서 나란히 개봉합니다. 두 편 모두 북미보다 이틀 앞선 날짜이고, '듄: 파트 3'는 전 세계 최초 개봉입니다. 관객에게는 한 주에 두 번 지갑을 열어야 하는 달이 되고, 극장가에는 한정된 좌석을 두고 두 배급사가 나눠 갖는 달이 됩니다.",
    bullets: [
      "IMAX·특별관 좌석은 개봉 첫 주에 몰립니다 — 두 편을 모두 보려면 예매일을 미리 나눠 두는 편이 낫습니다",
      "영화 관람은 대표적인 경험 소비입니다 — 값이 오르면 사람은 물건보다 경험을 먼저 줄이기도, 그 경험에 남는 돈을 더 쓰기도 합니다",
      "12월은 카드·통신사 제휴 할인이 몰리는 달입니다 — 같은 영화도 예매 경로에 따라 실제 결제액이 달라집니다",
    ],
    curator: CURATOR_SNS,
  },
];

const SLOT_ORDER = new Map<string, number>(BOARD_SLOTS.map((s, i) => [s, i]));

/** 최신 회차가 위로 — 날짜 내림차순, 같은 날은 회차 늦은 순 */
export function boardSorted(entries: BoardEntry[] = SEED): BoardEntry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || (SLOT_ORDER.get(b.slot) ?? 0) - (SLOT_ORDER.get(a.slot) ?? 0)
  );
}

export const boardEntries: BoardEntry[] = boardSorted();

/** 분류별 건수 — 필터 탭의 숫자. 배열 순서는 BOARD_CATEGORIES 그대로 */
export function boardCountByCategory(entries: BoardEntry[] = boardEntries): Map<BoardCategory, number> {
  const counts = new Map<BoardCategory, number>(BOARD_CATEGORIES.map((c) => [c, 0]));
  for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return counts;
}

/** 한 분류가 어느 코너에 속하는가 — 카드 색과 코너 필터가 같은 값을 쓴다 */
export function boardCornerOf(category: BoardCategory): BoardCorner {
  return BOARD_CORNERS.find((c) => c.categories.includes(category)) ?? BOARD_CORNERS[0];
}

/** 코너별 건수와 최근 회차 — 코너 카드의 숫자 */
export function boardCornerStats(entries: BoardEntry[] = boardEntries) {
  return BOARD_CORNERS.map((corner) => {
    const items = entries.filter((e) => corner.categories.includes(e.category));
    return {
      corner,
      count: items.length,
      latest: items[0] ? `${boardDateLabel(items[0].date)} ${items[0].slot}` : null,
    };
  });
}

/** 날짜별 묶음 — 게시판은 '그날 몇 시에 무엇을 확인했나'로 읽는다 */
export function boardByDate(entries: BoardEntry[] = boardEntries): { date: string; items: BoardEntry[] }[] {
  const groups: { date: string; items: BoardEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  return groups;
}

/** '2026. 11. 24. (화)' — 요일까지 붙여 날짜를 다시 세지 않게 한다 */
export function boardDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(d);
  return `${date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1. $2. $3.")} (${weekday})`;
}

/**
 * 계약 검사 — 손으로 넣은 데이터가 화면 규칙을 깨면 빌드를 세운다.
 *  · id 중복·형식, 날짜 형식, 회차·분류 값, 필수 문장·불릿 개수, 금지어.
 *  · 금융 코너는 출처 표기 + https 원문 링크를 요구한다.
 *  · 스토리·썰 코너는 출처가 `SNS 커뮤니티` 한 줄이어야 하고 sourceUrl은 비우며, 원본 흔적('@'·x.com·원문·조회…)이
 *    없어야 통과한다. SNS 화제 코너는 출처 표기·링크 없이 원본 흔적만 없으면 된다.
 *  · 실패 메시지에 어느 항목인지 적어, 다음 회차에 추가하는 사람이 바로 고칠 수 있게 한다.
 */
export function validateBoard(entries: BoardEntry[] = boardEntries): void {
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const e of entries) {
    const at = `board.ts ${e.id || "(id 없음)"}`;
    if (!e.id) problems.push(`${at}: id가 비었습니다`);
    if (seen.has(e.id)) problems.push(`${at}: id가 중복입니다`);
    seen.add(e.id);

    if (!/^\d{8}-(0600|1300|1900)-[a-z0-9-]+$/.test(e.id))
      problems.push(`${at}: id는 'YYYYMMDD-회차(0600·1300·1900)-슬러그' 꼴이어야 합니다(예: 20261124-0600-gemini-file-slicing)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) problems.push(`${at}: date는 YYYY-MM-DD여야 합니다`);
    if (!BOARD_SLOTS.includes(e.slot)) problems.push(`${at}: slot은 06:00·13:00·19:00 중 하나여야 합니다`);
    if (!BOARD_CATEGORIES.includes(e.category)) problems.push(`${at}: category가 목록에 없습니다`);

    if (e.title.trim().length < 10) problems.push(`${at}: 제목이 너무 짧습니다`);
    if (e.summary.trim().length < 60) problems.push(`${at}: 요약은 2~3문장으로 적어 주세요`);
    if (e.bullets.length < 2 || e.bullets.length > 3) problems.push(`${at}: 핵심 포인트는 2~3줄입니다`);
    if (e.bullets.some((b) => b.trim().length < 10)) problems.push(`${at}: 빈 불릿이 있습니다`);

    if (!e.curator.trim()) problems.push(`${at}: curator가 비었습니다`);
    if (BOARD_BANNED_WORDS.some((w) => e.curator.includes(w))) problems.push(`${at}: curator에 금지어가 있습니다`);

    const text = [e.title, e.summary, ...e.bullets].join(" ");
    /** 출처 표기·정리 주체까지 합친 문장 — 스토리·SNS 코너에서 원본 흔적을 찾는 범위다 */
    const whole = [text, e.source ?? "", e.curator].join(" ");
    const sourced = (BOARD_SOURCED_CATEGORIES as readonly string[]).includes(e.category);
    const story = e.category === "스토리·썰";

    if (sourced) {
      // 금융 코너 — 숫자·제도를 쓰니 1차 출처와 원문 링크가 있어야 대조할 수 있다
      if (!e.source?.trim()) problems.push(`${at}: 금융 코너는 출처 표기가 필요합니다`);
      if (!/^https:\/\//.test(e.sourceUrl ?? ""))
        problems.push(`${at}: 금융 코너의 sourceUrl은 https 원문 링크여야 합니다`);
    } else if (story) {
      // 스토리·썰 코너 — 원문의 글맛을 살리되 출처는 'SNS 커뮤니티' 한 줄, 링크는 없다
      if ((e.source ?? "").trim() !== BOARD_STORY_SOURCE)
        problems.push(`${at}: 스토리·썰 코너의 출처는 '${BOARD_STORY_SOURCE}'로 고정합니다`);
      if (e.sourceUrl?.trim())
        problems.push(
          `${at}: 스토리·썰 코너는 sourceUrl을 비웁니다 — 계정·원문 링크 대신 '${BOARD_STORY_SOURCE}' 한 줄만 남깁니다`
        );
      for (const trace of BOARD_ORIGIN_TRACES) {
        if (whole.includes(trace))
          problems.push(`${at}: '${trace}'는 스토리·썰 코너에 남기지 않습니다 — 계정·원문·조회수 대신 이야기만 씁니다`);
      }
    } else {
      // SNS 화제 코너 — 우리 문장으로 다시 쓴다. 출처 표기도 원문 링크도 두지 않는다
      if (e.source?.trim()) problems.push(`${at}: SNS 화제 코너는 출처 표기를 두지 않습니다`);
      if (e.sourceUrl?.trim())
        problems.push(`${at}: SNS 화제 코너는 sourceUrl을 비웁니다 — 원문으로 보내지 않고 우리 글이 됩니다`);
      for (const trace of BOARD_ORIGIN_TRACES) {
        if (whole.includes(trace))
          problems.push(`${at}: '${trace}'는 SNS 화제 코너에 남기지 않습니다 — 계정·원문·조회수 대신 우리 문장으로 씁니다`);
      }
    }

    for (const word of BOARD_BANNED_WORDS) {
      if (text.includes(word)) problems.push(`${at}: '${word}'는 쓰지 않습니다 — 확인한 시각과 출처로 적어 주세요`);
    }
  }

  // 분류 계약 — 모든 분류는 '출처 코너'와 '우리 글 코너' 중 정확히 한 곳에 속한다
  for (const c of BOARD_CATEGORIES) {
    const isSourced = (BOARD_SOURCED_CATEGORIES as readonly string[]).includes(c);
    const isOriginal = (BOARD_ORIGINAL_CATEGORIES as readonly string[]).includes(c);
    if (isSourced === isOriginal)
      problems.push(`board.ts 계약: '${c}'는 출처 코너와 우리 글 코너 중 정확히 한 곳에 속해야 합니다`);
  }

  // 코너 계약 — 분류는 반드시 코너 하나에 속하고, 코너는 빈 채로 두지 않는다
  for (const c of BOARD_CATEGORIES) {
    const owners = BOARD_CORNERS.filter((corner) => corner.categories.includes(c));
    if (owners.length !== 1) problems.push(`board.ts 코너: '${c}'가 코너 ${owners.length}곳에 묶여 있습니다(1곳이어야 합니다)`);
  }
  for (const corner of BOARD_CORNERS) {
    if (!entries.some((e) => corner.categories.includes(e.category)))
      problems.push(`board.ts 코너 '${corner.title}': 글이 0건입니다 — 코너를 열었으면 첫 글을 함께 넣습니다`);
  }

  if (problems.length) {
    throw new Error(`데일리 브리프 게시판 데이터 검사 실패 (${problems.length}건)\n- ${problems.join("\n- ")}`);
  }
}
