/**
 * 데일리 브리프 게시판 — `/board/` 데이터 (v9.3.0, 2026-11-24 3코너 개편).
 *
 * 왜 이 파일이 있나
 *  · 사이트는 하루 세 번(06:00 · 13:00 · 19:00) 자료를 확인한다. 그중 정식 칼럼으로 키우기엔
 *    짧고, '오늘 확인 허브'(data/today.ts)에 자리를 내주기엔 아까운 메모가 매일 남는다.
 *  · 그 메모를 버리지 않고 회차·분류·출처와 함께 쌓아 두는 곳이 이 게시판이다.
 *    글(자산리포트)은 한 편씩 깊게, 허브는 오늘 쓸 것만, 게시판은 **확인한 것 전부의 색인**을 맡는다.
 *
 * 세 코너 (2026-11-24 오전 개편)
 *  · 📊 금융·시장 브리프 — 시장 숫자·제도·보험 실무, 그리고 일에 쓰는 AI 메모.
 *  · 📖 오늘의 스토리·썰 — X에서 반응이 큰 1인칭 이야기를 줄거리만 짧게. 사실 확인된 사건이 아니다.
 *  · 🔥 SNS 인기 콘텐츠 — 인스타그램·스레드·X에서 그날 반응이 몰린 화제를 원문 링크와 함께.
 *
 * 지키는 것 (today.ts와 같은 규칙)
 *  · '실시간'·'속보'·'긴급'을 쓰지 않는다 — 확인한 시각과 출처를 적는다. 아래 `validateBoard()`가
 *    제목·요약·불릿에 이 세 단어가 들어오면 **빌드를 세운다**(손으로 슬쩍 들어오지 못하게).
 *  · 한 건 = 한 주장 + 근거(출처 링크) + 확인 시점(날짜·회차). 출처 없는 건은 싣지 않는다.
 *  · 영업성 문구·상담 CTA를 넣지 않는다. 게시판은 읽는 곳이지 권하는 곳이 아니다.
 *  · 내부 호출명(봇·회의실 이름)은 독자에게 내보내지 않는다. 정리 주체는 `curator`에 독자용 표기로 적는다.
 *  · 스토리 코너는 남의 글을 그대로 옮겨 적지 않는다 — 줄거리를 우리 문장으로 줄이고 원문으로 보낸다.
 *    선정적인 장면·비속어는 덜어 내고, 인물·사실은 확인된 것으로 쓰지 않는다.
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
  /** 출처 기관·매체 (사람이 읽는 표기) */
  source: string;
  /** 원문 링크 (1차 또는 검증 출처) */
  sourceUrl: string;
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
      "X에서 그날 많이 읽힌 1인칭 이야기를 줄거리만 짧게 옮깁니다. 확인된 사건이 아니라 누군가 쓴 이야기이며, 원문 링크에서 이어 읽습니다.",
    categories: ["스토리·썰"],
    tone: "story",
  },
  {
    key: "sns",
    emoji: "🔥",
    title: "SNS 인기 콘텐츠",
    tagline: "인스타·스레드·X에서 가장 많이 본 화제",
    blurb:
      "지난 하루 반응이 몰린 릴스·스레드·X 화제를 골라, 확인한 숫자와 원문·보도 링크를 함께 남깁니다.",
    categories: ["SNS 화제"],
    tone: "sns",
  },
];

/** 금지어 — 확인한 시점을 적는 대신 긴장을 파는 말은 쓰지 않는다 */
export const BOARD_BANNED_WORDS = ["실시간", "속보", "긴급"] as const;

/** 정리 주체 표기 — 내부 조직명 대신 독자가 읽을 이름 하나 */
const CURATOR = "데일리 리서치";
const CURATOR_STORY = "스토리 큐레이션";
const CURATOR_SNS = "SNS 화제 큐레이션";

const SEED: BoardEntry[] = [
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
    title: "엄마가 준 만원으로 산 로또가 2등 — 9,000회 넘게 읽힌 아침 이야기",
    summary:
      "X 계정 「새벽」(@LoveYou3am)이 11월 24일 오전 5시 56분에 올린 1인칭 연재 글입니다. 반찬가게를 하는 어머니가 '맛있는 거 사 먹으라'며 준 만원으로 자동 5천원을 샀고, 다음 날 아침 그 복권이 2등(세전 5천만원대)에 당첨됐다는 내용입니다. 어머니는 축하 대신 사기 문자를 받은 건 아닌지부터 확인했고, 화자는 당첨금으로 가게 대출부터 갚자고 말합니다.",
    bullets: [
      "확인 시점(11. 24. 08:50 무렵) X 화면 표시값 — 조회 9,211 · 좋아요 10 · 재게시 4 · 답글 6, 조회수는 계속 오릅니다",
      "1인칭 창작·실화 형식의 글이라 당첨 사실과 인물은 확인되지 않습니다 — 게시판은 줄거리만 옮깁니다",
      "후반부는 다음 화로 이어집니다 — 전문은 카드 하단 원문 링크에서 읽습니다",
    ],
    source: "X 「새벽」(@LoveYou3am) 2026. 11. 24. 05:56 게시 · 조회수는 확인 시점 화면 표시",
    sourceUrl: "https://x.com/LoveYou3am/status/2124970332843024484",
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-0600-story-riceball",
    date: "2026-11-24",
    slot: "06:00",
    category: "스토리·썰",
    title: "새벽 5시 반 편의점, 배송기사가 사준 삼각김밥 두 개",
    summary:
      "같은 계정이 11월 24일 오전 5시 26분에 올린 글입니다. 취업 준비와 편의점 야간 아르바이트를 함께 하던 화자가 최종 탈락 연락을 받은 날, 매일 새벽 5시 반에 들르던 배송기사가 삼각김밥과 우유를 사주며 '나도 젊을 때 남한테 밥 많이 얻어먹었다'고 말했다는 내용입니다. 화자는 그 말에 목이 막혔다고 적었습니다.",
    bullets: [
      "확인 시점(11. 24. 08:50 무렵) X 화면 표시값 — 조회 663 · 좋아요 3 · 답글 2 (이어지는 답글은 별도 194회)",
      "1인칭 창작·실화 형식이며 등장인물과 사실은 확인되지 않습니다",
      "짧게 읽고 넘어가는 코너라 줄거리와 원문 링크만 둡니다 — 전문은 원문에서",
    ],
    source: "X 「새벽」(@LoveYou3am) 2026. 11. 24. 05:26 게시 · 조회수는 확인 시점 화면 표시",
    sourceUrl: "https://x.com/LoveYou3am/status/2124962837592498212",
    curator: CURATOR_STORY,
  },
  {
    id: "20261124-0600-sns-csat-appeals",
    date: "2026-11-24",
    slot: "06:00",
    category: "SNS 화제",
    title: "수능 이의신청 189건, 세계사 2번 '진시황' 문항에 23건 몰려",
    summary:
      "한국교육과정평가원은 11월 23일 2027학년도 수능 이의신청이 모두 189건 접수됐다고 밝혔습니다. 사회탐구 83건으로 가장 많았고, 단일 문항으로는 세계사 2번에 23건이 몰렸습니다. 평가원 정답은 수나라 문제(양견)의 업적인 ④번 '9품중정제를 폐지하였다'이고, 제시문의 '광통거 착공'이 단서라는 설명입니다.",
    bullets: [
      "지난해 675건보다 486건 줄었고, 영어 56건 가운데 26건은 동일인이 쓴 것으로 추정됩니다",
      "스레드에서는 '진시황 ②번을 골랐다'는 수험생들의 복수정답 요구가 이어졌습니다 — 같은 문항이 인스타그램·X에서도 화제가 됐습니다",
      "이의신청 건수는 문항 오류를 뜻하지 않습니다 — 최종 정답과 심사 결과는 12월 1일 오후 5시에 발표됩니다",
    ],
    source: "한국교육과정평가원 집계(11. 23.) · 뉴시스·중앙일보 보도 · 스레드 @insight.co.kr",
    sourceUrl: "https://www.newsis.com/view/NISX20261123_0003879953",
    curator: CURATOR_SNS,
  },
  {
    id: "20261124-0600-sns-doomsday-trailer",
    date: "2026-11-24",
    slot: "06:00",
    category: "SNS 화제",
    title: "'어벤져스: 둠스데이' 메인 예고편 공개 — 국내는 12월 16일 개봉",
    summary:
      "마블 스튜디오가 11월 23일 '어벤져스: 둠스데이' 메인 예고편과 포스터를 공개했습니다. 엔드게임 이후 가정을 꾸린 스티브 로저스 곁에 판타스틱4가 찾아오고, 엑스맨까지 모여 닥터 둠에 맞서는 장면이 담겼습니다. 마블 공식 발표 기준 미국 개봉은 12월 18일이고, 국내는 12월 16일 전 세계 최초 개봉입니다.",
    bullets: [
      "개봉일이 나라마다 다릅니다 — 마블 공식은 12월 18일, 국내 배급사 안내는 12월 16일",
      "예고편은 마블 공식 유튜브에 3분 24초 분량으로 올라왔습니다(인벤 보도) — 마블코리아 채널에도 같은 날 공개됐습니다",
      "12월 16일 같은 날 '듄: 파트3'도 국내에서 세계 최초 개봉해 두 작품이 맞붙습니다",
    ],
    source: "Marvel.com 공식 발표(2026. 11. 23.) · 인벤·OSEN 보도",
    sourceUrl: "https://www.marvel.com/articles/movies/avengers-doomsday-final-trailer",
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
 *  · id 중복·형식, 날짜 형식, 회차·분류 값, 필수 문장·불릿 개수, 출처 링크, 금지어.
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

    if (!e.source.trim()) problems.push(`${at}: 출처 표기가 없습니다`);
    if (!/^https:\/\//.test(e.sourceUrl)) problems.push(`${at}: sourceUrl은 https 원문 링크여야 합니다`);
    if (!e.curator.trim()) problems.push(`${at}: curator가 비었습니다`);
    if (BOARD_BANNED_WORDS.some((w) => e.curator.includes(w))) problems.push(`${at}: curator에 금지어가 있습니다`);

    const text = [e.title, e.summary, ...e.bullets].join(" ");
    for (const word of BOARD_BANNED_WORDS) {
      if (text.includes(word)) problems.push(`${at}: '${word}'는 쓰지 않습니다 — 확인한 시각과 출처로 적어 주세요`);
    }
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
