/**
 * '오늘 확인 허브' 데이터 — v5.9.
 *
 * 홈 최상단 허브 블록이 읽는 **한 파일**. 파이프라인(06:00 · 08:20 · 13:30 · 19:00)이 이 파일의 값과
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
  /** 묶음 — 마켓보드의 세 줄(국내 · 해외 · 금리·원자재)을 정한다 (v7.0) */
  group?: "kr" | "global" | "rates";
  /** 최근 흐름 — 스파크라인용 숫자 12개(오래된 순). 없으면 막대 없이 값만 그린다 */
  series?: number[];
};

export type TodayKind = "확인" | "일정" | "지식";

/**
 * 신뢰 메타데이터 — 허브의 모든 카드가 이 네 시각을 가진다.
 *   publishedAt  원문(1차 출처)이 나온 날
 *   fetchedAt    파이프라인이 실제로 수집한 시각 (= 화면의 '기준')
 *   updatedAt    데이터 파일을 마지막으로 갱신한 시각 (허브 전체)
 *   staleAfter   며칠이 지나면 '지난 정보'로 볼지
 */
export type TodayItem = {
  id: string;
  kind: TodayKind;
  /** 사실문 — 제목만 읽어도 무슨 일인지 알 수 있게 */
  title: string;
  /** 왜 내 돈과 관련 있나 — 1문장, 금액/분모 병기 */
  why: string;
  /** 무엇이 / 언제까지 / 누구에게 — 각 1줄, 최대 3개 */
  points: string[];
  /** 원문(1차 출처) 발행일 — YYYY-MM-DD. 상시 안내 페이지처럼 발행일이 없는 자료는 비운다 */
  publishedAt?: string;
  /** 이 내용을 수집·확인한 시각 (파이프라인이 실제 실행 시각을 적는다) = data_as_of */
  asOf: string;
  /** asOf와 같은 값 — 이름을 풀어 쓴 필드 (수집 시각) */
  fetchedAt: string;
  /** 다음 자동 확인 예정 시각 */
  nextCheckAt: string;
  /** 파이프라인 기록 — 실패한 회차면 failed + lastGoodAsOf */
  status: "ok" | "failed";
  lastGoodAsOf?: string;
  /** 1차 출처 */
  sourceLabel: string;
  sourceUrl: string;
  /** 기한이 있는 항목만 — 골든타임과 같은 D-Day 함수를 쓴다 */
  dueDate?: string;
  /** 도구 1개까지 */
  toolHref?: string;
  toolLabel?: string;
  /** 법령·기준일 (있으면 카드 아래에 붙는다) */
  basis?: string;
};

/** 30초 요약 3줄 — 각 줄에 기준 표기를 붙이고, 1차 출처가 있으면 링크를 함께 둔다. */
export type Highlight = { text: string; meta: string; sourceUrl?: string };

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
  /** 데이터 파일을 마지막으로 갱신한 시각 (= asOf) */
  updatedAt: string;
  /** 화면에 쓰는 갱신 표기 — '11/23 08:25' (그 값을 만든 확인 회차의 실제 실행 시각) */
  updatedAtLabel?: string;
  nextCheckAt: string;
  /** 허브 전체의 파이프라인 기록 — 실패한 회차면 'failed' (카드별 상태는 item.status) */
  status?: "ok" | "failed";
  /** 허브 전체가 실패했을 때 마지막으로 성공한 기준 시각 */
  lastGoodAsOf?: string;
  /** 이 일수를 넘기면 '지난 정보' 라벨 (3일) */
  staleAfterDays: number;
  /**
   * 정기 자동 갱신 파이프라인 연결 여부 (v5.9.2).
   *
   * false면 화면은 '수동 확인'이라고만 말한다 — 아직 06:00·08:20·13:30·19:00 자동 갱신이 붙지 않았는데
   * '하루 네 번 갱신'을 약속하면 그 순간 거짓말이 된다. `scripts/update_today_hub.py`가 실제 실행되면
   * 이 값을 true로 바꾸고, 그때부터 '자동 확인' 문구가 켜진다.
   */
  scheduleConnected: boolean;
  /** 갱신 주기 — 자동 갱신이 연결됐을 때만 화면에 쓴다 */
  cadence: string;
  highlights: Highlight[];
  /** 등락률 분모 등, 스트립 아래 한 줄 */
  stripNote: string;
  indicators: Indicator[];
  items: TodayItem[];
  ai: AiSummary | null;
  /** 대표 도구 — 홈 허브에서 도구로 가는 유일한 큰 버튼 */
  tool: { label: string; cta: string; href: string; note: string };
};

const AS_OF = "2026-11-26T06:12:00+09:00";
const NEXT_CHECK = "2026-11-26T08:20:00+09:00";

/** 등락률 계산 기준 — 퍼센트마다 분모를 다시 쓰지 않고 여기서 한 번 밝힌다. */
const CHANGE_BASIS = "전일 종가 대비";

export const today: TodayData = {
  asOf: AS_OF,
  updatedAt: AS_OF,
  nextCheckAt: NEXT_CHECK,
  status: "ok",
  staleAfterDays: 3,
  scheduleConnected: true,
  updatedAtLabel: "11/26 06:12",
  cadence: "하루 네 번(06:00 · 08:20 · 13:30 · 19:00) 자동 확인",
  stripNote: `등락률은 ${CHANGE_BASIS}입니다. 지표마다 마지막 확인 시각이 다르고, 값은 참고용입니다.`,

  highlights: [
    { text: "밤사이 뉴욕은 장중 급락을 거의 되돌렸습니다. S&P500 7,182.73(0.25% 내림)·나스닥 23,580.63(0.64% 내림)으로 마쳤지만 다우는 50,173.90(0.31% 올림)으로 5만 선을 지켰습니다. 장중에는 다우 48,913.74·S&P500 6,970.11·나스닥 22,632.40까지 밀렸습니다.", meta: "마감 11. 25. (한국시간 11. 26. 06:00) · 테마노우·Yahoo 집계" },
    { text: "오늘 오전 10시 한국은행 금통위가 올해 마지막 회의를 엽니다. 기준금리를 3.00%에서 3.25%로 올릴 것이 유력하고(경제 전문가 6명 전원 인상 전망), 점도표 중간값은 3.25%에서 3.50%로 올라갈 전망입니다. 총재 기자간담회는 11시 10분께 시작합니다.", meta: "한국은행 11. 26. 금통위 · 연합뉴스 11. 26. 05:45" },
    { text: "미 무역대표부가 한국·중국·일본·EU 등 14개 경제주체에 과잉생산 관세를 제시했습니다. 한국은 한미 합의대로 15% 상한이 유지되고 7월 강제노동 관세 12.5%와 겹쳐 붙지 않습니다. 내년 1월 25일 청문회를 거쳐 시행 여부가 정해지고, 다음 변수는 디지털 규제 301조 조사입니다.", meta: "USTR 11. 25. 제안 · 연합뉴스·매일경제" },
  ],

  indicators: [
    {
      id: "kospi",
      name: "코스피",
      value: "4,697.51",
      change: "−6.16%",
      direction: "down",
      asOf: "2026-11-25T15:30:00+09:00",
      asOfLabel: "장 마감 11. 25.",
      source: "한국거래소(연합뉴스·서울경제)",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261125133251008",
      basis: "전일 종가 5,006.03 대비 308.52포인트 내림 · 4,809.00(3.94% 내림)에 출발해 개장 8분 만에 매도 사이드카가 걸렸고 장중 4,672.55(6.66% 내림)까지 밀린 뒤 장 막판 개인 매수로 4,690선 후반에서 마감했습니다. 외국인 1조8,994억·기관 8억 원 순매도, 개인 1조4,232억 원 순매수(넥스트레이드 포함 외국인 순매도 2조2,817억 원)",
      group: "kr",
      series: [5240, 5196, 5150, 5172, 5104, 5060, 5012, 5010, 5137.49, 4869.96, 4708.54, 5038.07],
    },
    {
      id: "kosdaq",
      name: "코스닥",
      value: "650.64",
      change: "−2.29%",
      direction: "down",
      asOf: "2026-11-25T15:30:00+09:00",
      asOfLabel: "장 마감 11. 25.",
      source: "한국거래소(연합뉴스·서울경제)",
      sourceUrl: "https://signalm.sedaily.com/article/20118883",
      basis: "전일 종가 665.88 대비 15.24포인트 내림 · 654.21(1.75% 내림)에 출발해 장중 641.08(3.72% 내림)까지 밀렸고, 기계·장비 6.0%·비금속 5.8%·전기·전자 5.5%가 내렸습니다. 외국인 13억·기관 268억 원 순매수, 개인 347억 원 순매도",
      group: "kr",
      series: [712, 705, 698, 690, 684, 676, 668, 670, 684.79, 645.68, 635.45, 666.46],
    },
    {
      id: "usdkrw",
      name: "원/달러",
      value: "1,343.20",
      change: "+0.8원",
      direction: "up",
      asOf: "2026-11-25T15:30:00+09:00",
      asOfLabel: "11. 25. 15:30 주간거래 마감",
      source: "서울 외환시장(연합뉴스)",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261125137900002",
      basis: "전일 서울 종가 1,342.40원 대비 0.8원 올림(원화 약세) · 1,340.0원에 출발해 오전 9시 29분 1,349.0원까지 올랐다가 1,340원대로 내려 마감했습니다. 달러지수 104.054(0.230 올림), 원/엔 재정환율 100엔당 842.77원",
      group: "kr",
      series: [1330, 1336, 1339, 1334, 1338, 1341, 1339, 1330.0, 1336.2, 1345.63, 1345.9, 1343.8],
    },
    {
      id: "sp500",
      name: "S&P500",
      value: "7,182.73",
      change: "−0.25%",
      direction: "down",
      asOf: "2026-11-26T06:00:00+09:00",
      asOfLabel: "마감 11. 25.",
      source: "뉴욕증시 마감(테마노우·인베스팅 집계)",
      sourceUrl: "https://themeknow.com/global-index.php?index=SP500",
      basis: "전일 종가 7,201.09 대비 18.36포인트 내림 · 7,060.33에 출발해 장중 6,970.11(3.21% 내림)까지 밀린 뒤 7,199.31까지 되올라 마감했습니다(Yahoo 집계 7,182.89·장중 저가 6,970.11 동일). 미 10월 PCE 3.8%와 신규 관세 제안이 겹친 하루였습니다",
      group: "global",
      series: [7420, 7455, 7480, 7440, 7398, 7412, 7350, 7280, 7200, 7280, 7175.9, 6910.39],
    },
    {
      id: "nasdaq",
      name: "나스닥",
      value: "23,580.63",
      change: "−0.64%",
      direction: "down",
      asOf: "2026-11-26T06:00:00+09:00",
      asOfLabel: "마감 11. 25.",
      source: "나스닥 종합(테마노우·인베스팅 집계)",
      sourceUrl: "https://themeknow.com/global-index.php?index=NASDAQ",
      basis: "전일 종가 23,733.54 대비 152.91포인트 내림 · 22,948.48에 출발해 장중 22,632.40(4.64% 내림)까지 밀렸다가 낙폭을 거의 되돌렸습니다(Yahoo 집계 23,585.80). 엔비디아 3.81%·마이크론 4.07% 하락이 지수를 눌렀습니다",
      group: "global",
      series: [24150, 24300, 24420, 24260, 24080, 23900, 23550, 23180, 22900, 23250, 23878.6, 22617.73],
    },
    {
      id: "vix",
      name: "VIX",
      value: "28.60",
      change: "+8.50%",
      direction: "up",
      asOf: "2026-11-26T06:00:00+09:00",
      asOfLabel: "마감 11. 25.",
      source: "CBOE(Yahoo Finance 종가)",
      sourceUrl: "https://uk.finance.yahoo.com/quote/%5EVIX/history/",
      basis: "전일 26.36 대비 2.24포인트 올림 · 장중 34.95까지 올랐다가 28선으로 내려 마감했고 집계처에 따라 28.37~28.60으로 갈립니다",
      group: "global",
      series: [18.2, 18.8, 19.4, 20.1, 21.6, 23.0, 24.4, 26.8, 29.5, 30.2, 28.44, 35.89],
    },
    {
      id: "us10y",
      name: "미 국채 10년",
      value: "4.850%",
      change: "−0.052%p",
      direction: "down",
      asOf: "2026-11-26T05:29:00+09:00",
      asOfLabel: "11. 25. 마감(05:29 고시)",
      source: "미 국채 10년물(주달·인베스팅 집계)",
      sourceUrl: "https://www.judal.co.kr/usMarket/12/bond",
      basis: "전일 4.902% 대비 5.2bp 내림(직전 회차 기록은 집계처에 따라 4.904%) · 물가와 성장 지표가 함께 뜨거웠는데도 금리는 내렸고, 52주 범위는 3.962~5.311%입니다",
      group: "rates",
      series: [5.22, 5.18, 5.2, 5.16, 5.12, 5.14, 5.1, 5.08, 5.05, 5.03, 5.049, 4.909],
    },
    {
      id: "ktb3y",
      name: "국고채 3년",
      value: "3.583%",
      change: "−5.7bp",
      direction: "down",
      asOf: "2026-11-25T16:40:00+09:00",
      asOfLabel: "11. 25. 최종 마감",
      source: "금융투자협회·연합인포맥스(연합뉴스)",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261125149151008",
      basis: "전일 3.640% 대비 5.7bp 내림 · 5월 8일(3.569%) 이후 가장 낮은 수준이고 2년 3.630%(-2.7bp)·5년 3.648%(-6.0bp)도 함께 내렸습니다. 외국인은 3년 국채선물을 9,454계약 순매수",
      group: "rates",
      series: [3.85, 3.82, 3.8, 3.78, 3.76, 3.77, 3.74, 3.73, 3.716, 3.642, 3.623, 3.629],
    },
    {
      id: "ktb10y",
      name: "국고채 10년",
      value: "3.761%",
      change: "−5.8bp",
      direction: "down",
      asOf: "2026-11-25T16:40:00+09:00",
      asOfLabel: "11. 25. 최종 마감",
      source: "금융투자협회·연합인포맥스(연합뉴스)",
      sourceUrl: "https://www.yna.co.kr/view/AKR20261125149151008",
      basis: "전일 3.819% 대비 5.8bp 내림 · 4월 22일(3.697%) 이후 가장 낮은 수준이고 20년 3.962%(-4.4bp)·30년 3.936%(-3.9bp)·50년 3.916%(-3.9bp)로 장기물이 고르게 내렸습니다. 외국인은 10년 국채선물을 7,476계약 순매수",
      group: "rates",
      series: [4.05, 4.02, 4.0, 3.98, 3.96, 3.97, 3.94, 3.955, 3.942, 3.857, 3.827, 3.809],
    },
    {
      id: "base-rate",
      name: "기준금리",
      value: "3.00%",
      change: "동결",
      direction: "flat",
      asOf: "2026-10-22T10:00:00+09:00",
      asOfLabel: "10. 22. 금통위",
      source: "한국은행",
      sourceUrl: "https://www.bok.or.kr/portal/singl/baseRate/list.do?menuNo=200643",
      basis: "7월·8월 각 0.25%p 인상 후 10. 22. 동결 · 11. 26. 금통위를 하루 앞두고 시장은 3.25% 인상에 무게를 두지만 골드만삭스 등 일부 기관은 동결을 봅니다(통안채 3개월 3.323%·CD 3.390%)",
      group: "rates",
      series: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.75, 3.0, 3.0, 3.0, 3.0, 3.0],
    },
  ],

  items: [
    {
      id: "silson-switch-2026",
      kind: "일정",
      title: "11월 23일부터 1·2세대 실손 전환·선택형 할인 신청이 시작됐습니다",
      why: "1세대 계약자는 전환하면 월 17만 6,982원이 2만 1,620원이 됩니다(연 212만 4,000원 → 25만 9,000원, 60대 여성·6개 손보사 예시).",
      points: [
        "무엇이 — 5세대로 바꾸면 3년간 5세대 보험료의 50% 할인, 계약을 그대로 두면 고른 항목만 빼고 최대 37% 할인",
        "언제까지 — 계약전환 할인 신청은 2027년 5월 22일까지, 선택형 할인 특약은 기한 없음. 청약철회는 전환 후 3개월은 조건 없이, 3~6개월은 보험사고가 없을 때만 할 수 있습니다",
        "누구에게 — 2013년 3월 이전 가입·재가입 조건이 없는 실손 계약",
      ],
      publishedAt: "2026-11-19",
      asOf: "2026-11-26T06:12:00+09:00",
      fetchedAt: "2026-11-26T06:12:00+09:00",
      nextCheckAt: "2026-11-26T08:20:00+09:00",
      status: "ok",
      sourceLabel: "금융위원회 보도자료 (2026. 11. 19.)",
      sourceUrl: "https://www.fsc.go.kr/no010101/88173",
      dueDate: "2026-11-23",
      toolHref: "/apps/silson-compare/run",
      toolLabel: "내 실손 세대 비교 열기",
      basis: "철회하면 50% 할인은 다시 받을 수 없고, 재전환은 심사 대상입니다. 보장·할인율은 보험사와 선택 조건에 따라 다릅니다",
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
      asOf: "2026-11-26T06:12:00+09:00",
      fetchedAt: "2026-11-26T06:12:00+09:00",
      nextCheckAt: "2026-11-26T08:20:00+09:00",
      status: "ok",
      sourceLabel: "국세청 — 중간예납 안내 (납부기한 2026. 11. 30.)",
      sourceUrl: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7674&mi=2237",
      dueDate: "2026-11-30",
      toolHref: "/calendar#m11",
      toolLabel: "골든타임 11월 보기",
      basis: "납부기한이 평일이라 공휴일 연장이 없습니다",
    },
    {
      id: "pension-limit-2026",
      kind: "일정",
      title: "12월 31일까지 넣은 연금저축·IRP만 올해 세액공제를 받습니다",
      why: "900만원을 채우면 최대 148만 5,000원(공제율 16.5%, 지방소득세 포함)만큼 세금이 줄어듭니다. 1,000만원을 넣어도 공제는 900만원까지입니다.",
      points: [
        "무엇이 — 연금저축 600만원, IRP를 합쳐 900만원까지 공제 대상입니다",
        "누구에게 — 총급여에 따라 공제율이 16.5%와 13.2%로 갈립니다",
        "확인 — 금융사 마감 시각을 피해 12월 29~30일에 이체를 마칩니다",
      ],
      publishedAt: "2026-07-01",
      asOf: "2026-11-26T06:12:00+09:00",
      fetchedAt: "2026-11-26T06:12:00+09:00",
      nextCheckAt: "2026-11-26T08:20:00+09:00",
      status: "ok",
      sourceLabel: "소득세법 제59조의3 (연금계좌세액공제)",
      sourceUrl: "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1032880515",
      dueDate: "2026-12-31",
      basis: "세액공제는 산출세액에서 빼는 방식이라, 세액이 적은 해에는 한도만큼 세금이 줄지 않습니다",
    },
    {
      id: "week-ahead-1123",
      kind: "일정",
      title: "이번 주는 25일 밤 미 물가, 26일 한은 금통위, 26일 미 휴장으로 이어집니다",
      why: "26일 금통위가 기준금리를 3.00%에서 3.25%로 올리면 예·적금과 변동금리 대출 금리가 함께 움직입니다(전문가 6명·증권사 9곳 모두 인상 전망).",
      points: [
        "무엇이 — 25일 밤 10시 30분 미국 10월 PCE와 3분기 GDP 잠정치, 26일 한은 금통위와 수정 경제전망",
        "26일 밤 — 미국은 추수감사절로 정규장이 없고, 27일 밤 정규장은 한국시간 28일 새벽 3시에 끝납니다",
        "확인 — 26일 결정문의 금통위원 점도표와 총재 기자회견에서 다음 인상 시점을 봅니다",
      ],
      publishedAt: "2026-11-22",
      asOf: "2026-11-26T06:12:00+09:00",
      fetchedAt: "2026-11-26T06:12:00+09:00",
      nextCheckAt: "2026-11-26T08:20:00+09:00",
      status: "ok",
      sourceLabel: "한국은행 · 미국 BEA · 나스닥 트레이더 알림 (2026. 11. 23. 확인)",
      sourceUrl: "https://www.bok.or.kr/portal/singl/baseRate/list.do?menuNo=200643",
      dueDate: "2026-11-26",
      toolHref: "/calendar#m11",
      toolLabel: "골든타임 11월 보기",
      basis: "미국 동부와 한국 시차는 이 기간 14시간이라, 25일 밤 10시 30분 발표가 국장 마감 뒤에 옵니다",
    },
  ],

  ai: {
    label: "AI 정리",
    asOf: "2026-11-26T06:12:00+09:00",
    asOfLabel: "기준 11. 26. 06:12",
    sourceLabel: "테마노우 · 주달 · 미 상무부 BEA · 한국은행 (11. 26. 06:00 확인)",
    sourceUrl: "https://themeknow.com/global-index.php?index=SP500",
    lines: [
      "뉴욕 3대 지수는 장중 급락을 대부분 되돌렸습니다. S&P500 7,182.73(0.25% 내림)·나스닥 23,580.63(0.64% 내림)·다우 50,173.90(0.31% 올림)으로 마쳤고, 필라델피아 반도체는 8,776.06(0.64% 내림)입니다. 장중 낙폭은 다우 2.21%·S&P500 3.21%·나스닥 4.64%까지 갔고 VIX는 장중 34.95까지 올랐다가 28.60(8.50% 올림)으로 내려왔습니다.",
      "미 10월 PCE는 전년 대비 3.8%, 근원 3.3%로 2023년 이후 가장 높았고, 3분기 GDP 잠정치는 연율 4.3%로 직전 추정 3.4%에서 크게 올라섰습니다. 12월 8~9일 FOMC에서 올린다는 전망이 더 굳었는데도 미 10년물은 4.850%(5.2bp 내림)로 내렸습니다. 원/달러는 11. 25. 서울 종가 1,343.20원(0.8원 올림), 국고채는 3년 3.583%·10년 3.761%입니다.",
      "오늘 오전 10시 금통위가 3.00%를 3.25%로 올리면 변동금리 대출과 예·적금 약정 금리가 다음 주기부터 함께 움직입니다. 올해 세액공제를 받으려면 12월 31일까지 연금저축·IRP 900만 원을 채우고, 1·2세대 실손 전환 할인은 2027년 5월 22일까지 신청할 수 있습니다. 오늘 밤 미국은 추수감사절로 휴장하고, 27일 정규장은 한국시간 28일 새벽 3시에 끝납니다.",
    ],
    note: "AI가 정리한 요약이며 원문과 다를 수 있습니다. 판단의 근거는 원문 출처로 확인하세요.",
  },

  tool: {
    label: "연금·IRP 세액공제 계산기",
    cta: "올해 세액공제액 계산하기",
    href: "/apps/pension-tax/run",
    note: "남은 한도와 예상 환급액을 브라우저에서 계산합니다 · 소득세법 제59조의3 기준",
  },
};

/** '2026. 11. 21. 14:00' — 화면에 쓰는 기준 시각 표기 (24시간제) */
export function hubStamp(value: string | Date = today.asOf): string {
  const d = value instanceof Date ? value : new Date(value);
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
  return `${ymd}. ${hhmm}`;
}

/**
 * 허브 아래 고지 — 자동 갱신이 연결됐는지에 따라 말이 달라진다 (v5.9.2).
 *
 * 연결 전에는 '수동 확인'임을 숨기지 않는다. 연결 뒤에는 등록된 네 회차(06:00·08:20·13:30·19:00)를 그대로 말한다.
 */
export function hubNotice(data: Pick<TodayData, "asOf" | "scheduleConnected"> = today): string {
  if (!data.scheduleConnected) {
    return `이 사이트의 금융 정보는 아직 정기 자동 갱신에 연결되지 않았습니다. ${hubStamp(
      data.asOf
    )} 수동 확인 값이고, 정기 자동 갱신 연결 준비 중입니다. 카드마다 마지막 확인 시각을 함께 표시합니다.`;
  }
  return "이 사이트의 금융 정보는 하루 네 번(06:00 · 08:20 · 13:30 · 19:00) 자동으로 확인해 갱신합니다. 카드마다 마지막 확인 시각을 함께 표시합니다.";
}

/**
 * 화면 상단 한 줄 (v5.9.2 · v9.4.0 문구 분리)
 *   연결 전 — '2026. 11. 21. 14:00 수동 확인'
 *   연결 뒤 — '지표 확인 2026. 11. 21. 14:00 · 하루 네 번(06:00 · 08:20 · 13:30 · 19:00) 자동 확인'
 *
 * v9.4.0(2026-11-24 전수 감사 W10) — 이 시각은 **지표를 확인한 시각**이지 콘텐츠 기준일이 아니다.
 *   같은 화면의 '기준일 2026. 11. 24.'(글·도구 기준일)와 나란히 놓이면 기준일이 두 개로 갈라져 보인다.
 *   그래서 여기서만 '기준'을 쓰지 않고 '지표 확인'으로 밝힌다 — '기준일'은 글·도구의 확인 날짜 전용.
 */
export function hubBasisLine(data: TodayData = today): string {
  const stamp = hubStamp(data.asOf);
  if (!data.scheduleConnected) return `${stamp} 수동 확인`;
  return `지표 확인 ${stamp} · ${data.cadence}`;
}
