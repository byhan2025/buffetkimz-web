/**
 * '오늘 확인 허브' 데이터 — v5.9.
 *
 * 홈 최상단 허브 블록이 읽는 **한 파일**. 파이프라인(06:00 · 08:20 · 19:00)이 이 파일의 값과
 * `asOf`·`status`를 갱신하고, 화면은 그 값만 그린다. 손으로 숫자를 고칠 때도 **출처와 기준 시각을
 * 함께** 고쳐야 한다(그래야 배지가 거짓말을 하지 않는다).
 *
 * 원칙 (reports/finance-hub-benchmark/00-hub-benchmark.md §6·§7)
 *  · '실시간'·'속보'·'긴급'을 쓰지 않는다. 지표는 전일 종가·최신 고시만 쓰고 **지표마다 기준 시각**을 붙인다.
 *  · 카드 하나 = 한 주장 + 한 근거 + 한 행동. 링크는 도구 1개 + 출처 1개까지.
 *  · 금액은 큰 값 한 번만 두 단위로 병기하고, 퍼센트는 분모를 함께 쓴다.
 *  · AI 요약은 **AI 라벨 · 기준 시각 · 원문 링크** 세 가지가 모두 있을 때만 그린다.
 *  · 이 블록 안에는 상담·가입 CTA를 두지 않는다(비영업 원칙).
 */

/** 지표 칩 하나 — 지표마다 기준 시각과 출처가 다르다는 사실을 지우지 않는다. */
export type Indicator = {
  id: string;
  /** 화면에 쓰는 이름 */
  name: string;
  /** 값 (이미 자릿수·단위를 넣은 문자열) */
  value: string;
  /** 전일 대비 — 부호 포함 */
  change: string;
  direction: "up" | "down" | "flat";
  /** 이 값의 기준 시각 (ISO) */
  asOf: string;
  /** 사람이 읽는 기준 표기 — '장 마감 11. 20.' / '마감 11. 21. 06:00' */
  asOfLabel: string;
  /** 출처 기관·매체 */
  source: string;
  sourceUrl: string;
  /** 계산 근거 한 줄 — 퍼센트의 분모 등 (선택) */
  basis?: string;
};

export type TodayKind = "확인" | "일정" | "지식";

export type TodayItem = {
  id: string;
  kind: TodayKind;
  /** 사실문 — 제목만 읽어도 무슨 일인지 알 수 있게 */
  title: string;
  /** 왜 내 돈과 관련 있나 — 1문장, 금액/분모 병기 */
  why: string;
  /** 무엇이 / 언제까지 / 누구에게 — 각 1줄, 최대 3개 */
  points: string[];
  /** 이 내용을 확인한 시각 (파이프라인이 실제 실행 시각을 적는다) */
  asOf: string;
  /** 다음 자동 확인 예정 시각 */
  nextCheckAt: string;
  /** 파이프라인 기록 — 실패한 회차면 failed + lastGoodAsOf */
  status: "ok" | "failed";
  lastGoodAsOf?: string;
  /** 1차 출처 */
  sourceLabel: string;
  sourceUrl: string;
  /** 기한이 있는 항목만 — 제도달력과 같은 D-Day 함수를 쓴다 */
  dueDate?: string;
  /** 도구 1개까지 */
  toolHref?: string;
  toolLabel?: string;
  /** 법령·기준일 (있으면 카드 아래에 붙는다) */
  basis?: string;
};

/** 30초 요약 3줄 — 각 줄에 기준 표기를 붙인다. */
export type Highlight = { text: string; meta: string };

/**
 * AI 요약 — label·asOf·sourceUrl이 모두 있어야 화면에 그린다.
 * 하나라도 비면 허브는 AI 요약 없이 나머지만 그린다(빈 칸을 만들지 않는다).
 */
export type AiSummary = {
  label: string;
  asOf: string;
  asOfLabel: string;
  sourceLabel: string;
  sourceUrl: string;
  lines: string[];
  note: string;
};

export type TodayData = {
  /** 허브 전체를 확인한 시각 */
  asOf: string;
  nextCheckAt: string;
  /** 갱신 주기 — 화면에 그대로 쓴다 */
  cadence: string;
  highlights: Highlight[];
  /** 등락률 분모 등, 스트립 아래 한 줄 */
  stripNote: string;
  indicators: Indicator[];
  items: TodayItem[];
  ai: AiSummary | null;
  /** 대표 도구 — 홈 허브에서 도구로 가는 유일한 큰 버튼 */
  tool: { label: string; cta: string; href: string; note: string };
  /** 허브 아래 고지 — 하루 3회 갱신을 사이트가 직접 말한다 */
  notice: string;
};

const AS_OF = "2026-11-21T14:00:00+09:00";
const NEXT_CHECK = "2026-11-21T19:00:00+09:00";

/** 등락률 계산 기준 — 퍼센트마다 분모를 다시 쓰지 않고 여기서 한 번 밝힌다. */
const CHANGE_BASIS = "전일 종가 대비";

export const today: TodayData = {
  asOf: AS_OF,
  nextCheckAt: NEXT_CHECK,
  cadence: "하루 3회(06:00·08:20·19:00) 갱신",
  stripNote: `등락률은 ${CHANGE_BASIS}입니다. 지표마다 마지막 기준 시각이 다르고, 지표는 참고용이며 투자 권유가 아닙니다.`,

  highlights: [
    { text: "코스피 4,869.96(−5.21%), 코스닥 645.68(−5.71%)로 마감", meta: "장 마감 11. 20." },
    { text: "미국 나스닥 −5.28%, 필라델피아 반도체 −10.73%", meta: "마감 11. 21. 06:00" },
    { text: "11월 23일부터 1·2세대 실손 전환·선택형 할인 신청 시작", meta: "D-2 · 금융위" },
  ],

  indicators: [
    {
      id: "kospi",
      name: "코스피",
      value: "4,869.96",
      change: "−5.21%",
      direction: "down",
      asOf: "2026-11-20T15:30:00+09:00",
      asOfLabel: "장 마감 11. 20.",
      source: "한국거래소",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261120137600008",
      basis: "267.93포인트 내림",
    },
    {
      id: "kosdaq",
      name: "코스닥",
      value: "645.68",
      change: "−5.71%",
      direction: "down",
      asOf: "2026-11-20T15:30:00+09:00",
      asOfLabel: "장 마감 11. 20.",
      source: "한국거래소",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261120137600008",
      basis: "39.13포인트 내림",
    },
    {
      id: "usdkrw",
      name: "원/달러",
      value: "1,346.50",
      change: "+0.82%",
      direction: "up",
      asOf: "2026-11-21T06:28:00+09:00",
      asOfLabel: "11. 21. 06:28 고시",
      source: "하나은행 고시(매매기준율)",
      sourceUrl: "https://finance.naver.com/marketindex/",
      basis: "직전 고시 1,335.50원 대비 11.00원",
    },
    {
      id: "sp500",
      name: "S&P500",
      value: "6,910.39",
      change: "−3.70%",
      direction: "down",
      asOf: "2026-11-21T06:00:00+09:00",
      asOfLabel: "마감 11. 21. 06:00",
      source: "CNBC",
      sourceUrl: "https://www.cnbc.com/2026/11/19/stock-market-today-live-updates.html",
      basis: "265.44포인트 내림",
    },
    {
      id: "nasdaq",
      name: "나스닥",
      value: "22,617.73",
      change: "−5.28%",
      direction: "down",
      asOf: "2026-11-21T06:00:00+09:00",
      asOfLabel: "마감 11. 21. 06:00",
      source: "CNBC",
      sourceUrl: "https://www.cnbc.com/2026/11/19/stock-market-today-live-updates.html",
      basis: "1,261.47포인트 내림",
    },
    {
      id: "sox",
      name: "필라델피아 반도체",
      value: "8,408.59",
      change: "−10.73%",
      direction: "down",
      asOf: "2026-11-21T06:00:00+09:00",
      asOfLabel: "마감 11. 21. 06:00",
      source: "연합뉴스",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261121009252072",
      basis: "1,011.13포인트 내림",
    },
  ],

  items: [
    {
      id: "silson-switch-2026",
      kind: "일정",
      title: "11월 23일부터 1·2세대 실손 전환·선택형 할인 신청이 시작됩니다",
      why: "1세대 계약자는 전환하면 월 17만 6,982원이 2만 1,620원이 됩니다(연 212만 4,000원 → 25만 9,000원, 60대 여성·6개 손보사 예시).",
      points: [
        "무엇이 — 5세대로 바꾸면 3년간 5세대 보험료의 50% 할인, 계약을 그대로 두면 고른 항목만 빼고 최대 37% 할인",
        "언제까지 — 신청은 2027년 5월 22일까지, 전환 후 6개월 안에는 철회할 수 있습니다",
        "누구에게 — 2013년 3월 이전 가입·재가입 조건이 없는 실손 계약",
      ],
      asOf: AS_OF,
      nextCheckAt: NEXT_CHECK,
      status: "ok",
      sourceLabel: "금융위원회 보도자료 (2026. 11. 19.)",
      sourceUrl: "https://www.fsc.go.kr/no010101/88173",
      dueDate: "2026-11-23",
      toolHref: "/apps/silson-compare/run",
      toolLabel: "내 실손 세대 비교 열기",
      basis: "보장·할인율은 보험사와 선택 조건에 따라 다릅니다",
    },
    {
      id: "mid-tax-2026",
      kind: "일정",
      title: "11월 30일까지 종합소득세 중간예납을 냅니다",
      why: "고지서가 나온 사람은 상반기(1~6월) 소득에 대한 세액을 11월 30일까지 내야 하고, 넘기면 납부지연 가산세가 붙습니다.",
      points: [
        "무엇이 — 지난해 중간예납·확정신고 납부액을 기준으로 계산한 세액을 미리 냅니다",
        "누구에게 — 사업소득이 있는 개인. 보험 모집수당만 있는 경우는 제외 대상입니다",
        "확인 — 홈택스·손택스에서 고지 여부와 금액을 조회하고, 1천만원이 넘으면 분납을 고릅니다",
      ],
      asOf: AS_OF,
      nextCheckAt: NEXT_CHECK,
      status: "ok",
      sourceLabel: "국세청 — 중간예납 안내 (납부기한 2026. 11. 30.)",
      sourceUrl: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7674&mi=2237",
      dueDate: "2026-11-30",
      toolHref: "/calendar#m11",
      toolLabel: "제도달력 11월 보기",
      basis: "납부기한이 평일이라 공휴일 연장이 없습니다",
    },
    {
      id: "pension-limit-2026",
      kind: "일정",
      title: "12월 31일까지 넣은 연금저축·IRP만 올해 세액공제를 받습니다",
      why: "900만원을 채우면 최대 148만 5,000원(공제율 16.5%, 지방소득세 포함)을 돌려받습니다. 1,000만원을 넣어도 공제는 900만원까지입니다.",
      points: [
        "무엇이 — 연금저축 600만원, IRP를 합쳐 900만원까지 공제 대상입니다",
        "누구에게 — 총급여에 따라 공제율이 16.5%와 13.2%로 갈립니다",
        "확인 — 금융사 마감 시각을 피해 12월 29~30일에 이체를 마칩니다",
      ],
      asOf: AS_OF,
      nextCheckAt: NEXT_CHECK,
      status: "ok",
      sourceLabel: "소득세법 제59조의3 (연금계좌세액공제)",
      sourceUrl: "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1032880515",
      dueDate: "2026-12-31",
      basis: "세액공제는 산출세액에서 빼는 방식이라, 세액이 적은 해에는 한도만큼 돌려받지 못합니다",
    },
  ],

  ai: {
    label: "AI 정리",
    asOf: "2026-11-21T07:22:00+09:00",
    asOfLabel: "기준 11. 21. 07:22",
    sourceLabel: "연합뉴스 — 나스닥 5.28% 하락, 다우·S&P500 조정 진입 (2026. 11. 21. 07:22)",
    sourceUrl: "https://www.yna.co.kr/view/AKR20261121009252072",
    lines: [
      "미국 증권거래위원회(SEC)가 엔비디아의 회계 처리를 살펴보고 있다는 보도로 엔비디아가 14.01% 내렸습니다.",
      "AI 투자 수익성 우려가 반도체주로 번지며 필라델피아 반도체 지수가 10.73% 하락했습니다.",
      "다우와 S&P500은 고점 대비 10% 넘게 밀려 조정 국면에 들어섰고, VIX는 35.89로 마감했습니다.",
    ],
    note: "AI가 정리한 요약이며 원문과 다를 수 있습니다. 판단의 근거는 원문 출처로 확인하세요. 매수·매도 권유가 아닙니다.",
  },

  tool: {
    label: "연금·IRP 세액공제 계산기",
    cta: "올해 세액공제액 계산하기",
    href: "/apps/pension-tax/run",
    note: "남은 한도와 예상 환급액을 브라우저에서 계산합니다 · 소득세법 제59조의3 기준",
  },

  notice: `이 사이트의 금융 정보는 ${"하루 3번(06:00 · 08:20 · 19:00)"} 확인해 갱신합니다. 카드마다 마지막 확인 시각을 함께 표시합니다.`,
};

/** 화면 상단 한 줄 — '2026. 11. 21. 14:00 기준 · 하루 3회(06:00·08:20·19:00) 갱신' */
export function hubBasisLine(data: TodayData = today): string {
  const d = new Date(data.asOf);
  const ymd = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .format(d)
    .replace(/\s/g, " ")
    .replace(/\.$/, "");
  const hhmm = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/^24/, "00");
  return `${ymd}. ${hhmm} 기준 · ${data.cadence}`;
}
