/**
 * 수익화 자리 설정 (3단계 · 2026-11-21)
 *
 * 대표님의 비영업 신뢰 원칙 위에서 만든 스위치다.
 *  · 기본값은 전부 OFF. OFF 일 때는 광고 스크립트·아이프레임·플레이스홀더·빈 여백을
 *    하나도 그리지 않는다(HTML 주석 한 줄만 남는다). 레이아웃 밀림(CLS)은 구조적으로 0이다.
 *  · 켰을 때는 슬롯마다 높이를 미리 예약한다(min-height). 광고가 늦게 로드되거나
 *    차단되어 비어 있어도 아래 내용이 밀리지 않는다 → CLS 0 유지.
 *  · 본문 중간 팝업·전면 배너·자동 재생은 넣지 않는다. 글을 읽다 방해받지 않는 자리만 쓴다.
 *  · 실제 광고 코드(애드센스 스크립트)는 이 파일에 직접 넣지 않는다. 켜는 절차·검토 항목은
 *    reports/buffetkimz-web/domain-seo-v3/02-monetization-slots.md 에 있다.
 *
 * 켜는 방법(빌드 시)
 *   ADS_ENABLED=1 npm run build            → 실제 광고 자리(빈 프레임) 노출
 *   AD_PREVIEW=1 npm run build             → 로컬 확인용 점선 플레이스홀더(배포 금지)
 * 둘 다 없으면 완전 비활성이다.
 */

const viteEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
const nodeEnv = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

const read = (key: string): string =>
  (viteEnv[`PUBLIC_${key}`] ?? nodeEnv[key] ?? "").trim().toLowerCase();

const on = (value: string): boolean => ["1", "true", "on", "yes"].includes(value);

/** 실제 광고·협찬 코드를 붙일 준비가 됐는가 (기본 false) */
export const adsEnabled = on(read("ADS_ENABLED"));

/** 로컬 시뮬레이션 — 점선 자리만 그린다. 배포 빌드에서는 절대 켜지 않는다. */
export const adPreview = on(read("AD_PREVIEW"));

/** 슬롯이 화면에 그려지는가 (실제 또는 미리보기) */
export const adSlotsVisible = adsEnabled || adPreview;

export type AdSize = "leaderboard" | "rectangle" | "in-article" | "native-list";

/**
 * 슬롯 규격 — 높이를 미리 예약해 CLS 를 0 으로 둔다.
 * mobile: 390px 기준 / desktop: 1280px 기준. 값은 실제 예약 픽셀.
 */
export const adSizes: Record<AdSize, { label: string; mobile: number; desktop: number; maxWidth: number }> = {
  leaderboard: { label: "가로 배너", mobile: 100, desktop: 90, maxWidth: 970 },
  rectangle: { label: "사각 배너", mobile: 250, desktop: 250, maxWidth: 336 },
  "in-article": { label: "본문 아래", mobile: 250, desktop: 280, maxWidth: 728 },
  "native-list": { label: "목록 사이", mobile: 120, desktop: 120, maxWidth: 970 },
};

/** 광고임을 밝히는 표기 — 표시광고법·추천보증 심사지침에 따라 항상 같은 자리에 고정한다. */
export const adDisclosure = "광고";

/** 제휴·협찬이 섞인 글은 글 상단에 이 문장을 먼저 밝힌다(문서 하단에 숨기지 않는다). */
export const affiliateDisclosure = "이 글에는 광고·제휴 링크가 포함되어 있습니다.";

/**
 * 배치 규칙 (2026-11-21 회의실 기준안)
 * · 절대 금지: 1P 모션·2P 소개·헤더·계산기 입력폼 내부와 결과 수치 바로 위·
 *   기준일/1차 출처 블록·표 위아래·본문 첫 화면(제목 + 2~3단락 이내)
 * · 허용: ① 본문 중반(2~3단락 또는 50% 이후) 최대 1곳
 *         ② 본문 하단(비권유 면책 블록과 24px 이상 간격) 1곳
 *         ③ 앱스토어 결과 확인 후 최하단
 * · 글당 데스크톱 최대 2곳 / 모바일은 본문 첫 화면 이후 1~2곳
 * · 자리 사이 최소 간격 24px, 광고가 비어도 높이 유지(min-height) → CLS < 0.1
 */
export const adPolicy = {
  maxPerArticleDesktop: 2,
  maxPerArticleMobile: 2,
  minGapPx: 24,
  /** 본문 첫 화면을 피하는 기준 — 앞에서부터 이만큼의 단락은 건드리지 않는다 */
  firstScreenParagraphs: 3,
  /** 본문 중반으로 인정하는 위치(전체 글자 기준) */
  midArticleAtLeast: 0.5,
  forbiddenRegions: ["home-brand-film", "home-intro", "header", "tool-input", "tool-result-top", "source-block", "table", "first-screen"],
  allowedRegions: ["article-mid", "article-bottom", "tools-bottom"],
};

/**
 * 광고 카테고리 차단 — 광고를 켜기 전에 광고 네트워크 콘솔에서 먼저 막아 둘 목록.
 * (문서 02-monetization-slots.md 의 차단 체크리스트와 같은 내용)
 */
export const adBlockedCategories = [
  "보험 상품 판매·모집(보험사·설계사 직접 광고)",
  "대출·대부업·사채(금융감독원 등록 여부 무관하게 차단)",
  "주식·코인 리딩방·종목 추천·선물/FX 고위험 투자",
  "도박·복권·가상자산 투자 유도",
  "의료·치료 효능을 주장하는 건강기능식품",
];

/** 지금은 후원·제휴 안내만. 광고주·제휴처가 정해지면 여기에 한 곳만 추가한다. */
export const sponsorNote = "이 자리는 앞으로 광고·협찬이 들어갈 수 있는 자리입니다. 글의 내용과 판단은 광고와 무관합니다.";
