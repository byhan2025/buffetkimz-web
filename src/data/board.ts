/**
 * 데일리 브리프 게시판 — `/board/` 데이터 (v9.2.0, 2026-11-24 신설).
 *
 * 왜 이 파일이 있나
 *  · 사이트는 하루 세 번(06:00 · 13:00 · 19:00) 자료를 확인한다. 그중 정식 칼럼으로 키우기엔
 *    짧고, '오늘 확인 허브'(data/today.ts)에 자리를 내주기엔 아까운 메모가 매일 남는다.
 *  · 그 메모를 버리지 않고 회차·분류·출처와 함께 쌓아 두는 곳이 이 게시판이다.
 *    글(자산리포트)은 한 편씩 깊게, 허브는 오늘 쓸 것만, 게시판은 **확인한 것 전부의 색인**을 맡는다.
 *
 * 지키는 것 (today.ts와 같은 규칙)
 *  · '실시간'·'속보'·'긴급'을 쓰지 않는다 — 확인한 시각과 출처를 적는다. 아래 `validateBoard()`가
 *    제목·요약·불릿에 이 세 단어가 들어오면 **빌드를 세운다**(손으로 슬쩍 들어오지 못하게).
 *  · 한 건 = 한 주장 + 근거(출처 링크) + 확인 시점(날짜·회차). 출처 없는 건은 싣지 않는다.
 *  · 영업성 문구·상담 CTA를 넣지 않는다. 게시판은 읽는 곳이지 권하는 곳이 아니다.
 *  · 내부 호출명(봇·회의실 이름)은 독자에게 내보내지 않는다. 정리 주체는 `curator`에 독자용 표기로 적는다.
 *
 * 새 회차를 넣는 방법
 *  · 배열 맨 앞이 아니라 아무 곳에나 한 건 추가하면 된다 — 화면은 `boardSorted()`가 날짜·회차 역순으로 정렬한다.
 *  · `id`는 `YYYYMMDD-slot-슬러그` 꼴로 두어 나중에 링크(`/board/#id`)로 집을 수 있게 한다.
 *  · 요약은 2~3문장, 불릿은 2~3줄. 숫자에는 분모(무엇 대비)와 기준 시점을 함께 적는다.
 */

export const BOARD_CATEGORIES = ["시황", "제도·보험", "AI·실무", "트렌드"] as const;
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

/** 금지어 — 확인한 시점을 적는 대신 긴장을 파는 말은 쓰지 않는다 */
export const BOARD_BANNED_WORDS = ["실시간", "속보", "긴급"] as const;

/** 정리 주체 표기 — 내부 조직명 대신 독자가 읽을 이름 하나 */
const CURATOR = "데일리 리서치";

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

  if (problems.length) {
    throw new Error(`데일리 브리프 게시판 데이터 검사 실패 (${problems.length}건)\n- ${problems.join("\n- ")}`);
  }
}
