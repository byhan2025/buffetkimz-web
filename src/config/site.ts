/**
 * 배포 경로 — GitHub Pages 서브패스(https://byhan2025.github.io/buffetkimz-web/)에서도
 * CSS·JS·링크·검색 인덱스가 깨지지 않도록 BASE_URL을 한 곳에서만 읽는다.
 * 커스텀 도메인(buffetkimz.com)으로 옮길 때는 BASE_PATH 없이 빌드하면 "/"로 돌아온다.
 */
const rawBase = import.meta.env.BASE_URL ?? "/";
export const basePath = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
const basePrefix = basePath.replace(/\/$/, "");

/** 사이트 안의 논리 경로("/posts/x")에 배포 접두를 붙인다. 외부·상대 주소는 그대로 둔다. */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${basePrefix}${path}`;
}

/**
 * 현재 주소에서 배포 접두(/buffetkimz-web)를 떼어 낸 논리 경로.
 * GitHub Pages 서브패스로 올라가도 메뉴 활성 표시가 맞도록 Header가 이 값을 쓴다.
 */
export function stripBase(pathname: string): string {
  let p = pathname;
  if (basePrefix && (p === basePrefix || p.startsWith(`${basePrefix}/`))) {
    p = p.slice(basePrefix.length) || "/";
  }
  return p.replace(/\/$/, "") || "/";
}

const origin = (import.meta.env.SITE ?? "https://buffetkimz.com").replace(/\/+$/, "");

/** canonical·OG·RSS·JSON-LD에 쓰는 절대 주소 (배포 접두 포함) */
export function absolute(path: string): string {
  return `${origin}${withBase(path)}`;
}

/**
 * 사이트 전역 설정 — 값이 바뀌면 여기 한 곳만 고치면 됩니다.
 */
export const site = {
  brand: "buffetkimz",
  domain: "buffetkimz.com",
  /** 배포 주소(접두 포함) — 페이지 경로를 붙여 쓸 때의 기준 */
  url: `${origin}${basePrefix}`,
  /** 도메인 루트 (canonical 계산용) */
  origin,
  tagline: "금융·투자·연금·재무를 하나의 기준으로 읽는 금융 포털",
  description:
    "금융·투자·연금·노후·재무를 하나의 기준으로 읽는 금융 포털. 시장 지표와 오늘의 브리핑, 직접 계산해 보는 금융 도구, 앱스토어, 투자백서를 한곳에 모았습니다. 모든 글과 도구에 기준일과 출처를 붙입니다.",
  /** 사이트가 지향하는 한 줄 — 상품이 아니라 구조와 기준을 설명한다 */
  noSalesNotice: "금융·투자·연금·재무의 숫자를 원문과 계산으로 확인해 정리합니다.",
  /** 기준일 — 모든 콘텐츠·도구의 확인 시점 */
  baseDate: "2026-11-21",
  baseDateLabel: "2026. 11. 21.",
  /** 빌드 시점의 '오늘' (기준일과 같은 날로 고정) */
  today: new Date("2026-11-21T09:00:00+09:00"),
  /**
   * 1:1 상담문의 — 이 값 하나로 홈·푸터·소개의 링크가 함께 살아난다.
   * http://pf.kakao.com/_UxkVxnn/chat 은 HTTPS로 308 리다이렉트되므로 https 주소를 쓴다(2026-11-19 확인).
   * v4.1부터 화면 표기는 '카카오톡 채널'이 아니라 '1:1 상담문의'로 통일한다.
   * 무엇을 함께 보는 자리인지 한 줄로 밝힌다.
   * v5.8에서 걷어냈다가 v5.8.2(2026-11-21)에서 사용자 선택으로 원래대로 복원 — 홈 채널 밴드·푸터·소개.
   * `/principles`(편집 원칙) 링크는 그대로 두고 나란히 공존시킨다.
   */
  kakaoChannelUrl: "https://pf.kakao.com/_UxkVxnn/chat",
  contact: {
    label: "1:1 상담문의",
    url: "https://pf.kakao.com/_UxkVxnn/chat",
    note: "금융·연금·재무 상담",
    /* 상담 창구를 부정형으로 변호하지 않는다 — 무엇을 함께 보는지로 적는다. */
    disclaimer: "숫자와 조건을 함께 놓고 확인하는 상담 창구입니다.",
  },
  author: {
    name: "buffetkimz",
    bio: "확인한 것과 계산한 것을 매일 글로 남깁니다. 설명이 막히는 지점을 도구로 옮기는 일도 함께 합니다.",
  },
  principles: [
    {
      id: "primary-source",
      title: "1차 자료를 먼저 봅니다",
      body: "금융위·금감원·국세청·공단의 원문을 먼저 확인하고, 모든 글과 도구에 기준일을 남깁니다.",
    },
    {
      id: "human-review",
      title: "사람이 다시 읽습니다",
      body: "자동화로 만든 초안은 그대로 내보내지 않습니다. 숫자와 문장을 사람이 다시 확인합니다.",
    },
    {
      id: "no-store",
      title: "계산은 브라우저 안에서",
      body: "도구에 입력한 값은 그 탭의 메모리에서만 계산되어 결과가 즉시 바뀝니다.",
    },
  ],
} as const;

export type NavChild = {
  label: string;
  /** 실제 이동 주소 — `soon`(준비중) 항목은 없다(링크를 만들지 않는다) */
  href?: string;
  note?: string;
  /** 아직 열지 않은 카테고리 — 누를 수 없는 <span aria-disabled>로 그리고 '준비중' 배지를 붙인다 */
  soon?: boolean;
  /** 사이트 밖 주소(예: 1:1 상담문의) — 새 창으로 연다 */
  external?: boolean;
};
export type NavItem = {
  href: string;
  label: string;
  /** 메뉴판 머리에 붙는 한 줄 — 이 메뉴가 무엇을 담는지 */
  desc: string;
  match: string;
  children?: NavChild[];
};

/**
 * 메뉴 이름 — v7.0 전면 개편, v7.2 자료앨범 + 하위 메뉴(드롭다운).
 *   /posts    자산리포트 → **자산리포트**(금융·투자·보험·절세를 모두 포괄. 라우트는 링크 보존을 위해 /posts 유지)
 *   /apps     앱스토어 → **앱스토어**(주제별 카테고리 구조)
 *   /calendar 골든타임 → **골든타임**(한눈에 와닿는 이름)
 *   /gallery  자료앨범 → **자료앨범**(카드뉴스·체크리스트 내려받기) — 골든타임 다음, 소개 앞
 *
 * v7.2 — 메뉴를 누르면(또는 ▾) 하위 카테고리가 세로로 펼쳐진다. 하위 메뉴는 이 배열 하나에서 나오므로
 * 데스크톱 드롭다운·모바일 퀵 탭 패널이 같은 목록을 쓴다.
 *
 * v7.2.1 — 앞으로 열 카테고리도 자리를 미리 잡아 둔다(`soon: true`).
 * 링크를 만들지 않으므로 404가 생기지 않고, 방문자에게는 '여기 곧 열린다'는 지도가 된다.
 */
export const nav: NavItem[] = [
  {
    href: "/posts",
    label: "자산리포트",
    desc: "돈이 되는 기록 · 연금·투자·보험",
    match: "/posts",
    children: [
      { href: "/posts", label: "전체 리포트", note: "기준일·출처를 붙인 글 전체" },
      { href: "/posts/pension/", label: "연금", note: "마스터 6편 · 연금 지도 2편" },
      { href: "/posts/finance/", label: "금융", note: "금리·환율·제도" },
      { href: "/posts/invest/", label: "투자", note: "배분·복리·규칙" },
      { href: "/posts/economy/", label: "경제", note: "물가·소비·지표" },
      { href: "/posts/insurance/", label: "보험", note: "약관·청구·실손" },
      { href: "/posts/retire/", label: "노후준비", note: "고정비·건보료·간병" },
      { href: "/posts/ai/", label: "AI", note: "도구로 옮긴 기록" },
      { href: "/posts/philosophy/", label: "철학·에세이", note: "판단과 설명" },
      { label: "부동산·대출", note: "주담대·전세·청약", soon: true },
      { label: "사업자 절세", note: "경비·부가세·종소세", soon: true },
    ],
  },
  {
    href: "/apps",
    label: "앱스토어",
    desc: "직접 계산하는 머니랩",
    match: "/apps",
    children: [
      { href: "/apps", label: "전체 앱", note: "가입 없이 쓰는 도구 전체" },
      { href: "/apps/#cat-finance", label: "금융투자앱", note: "금리·세금·연금·수익률" },
      { href: "/apps/#cat-insurance", label: "보험앱", note: "담보·고지·실손" },
      { href: "/apps/#cat-utility", label: "유용한앱", note: "날짜·절차" },
      { label: "ETF·배당 스크리너", note: "조건으로 종목 걸러 보기", soon: true },
      { label: "건보료·종소세 판정", note: "내 소득으로 바로 계산", soon: true },
    ],
  },
  {
    href: "/calendar",
    label: "골든타임",
    desc: "놓치면 손해인 금융·세제 캘린더",
    match: "/calendar",
    children: [
      { href: "/calendar", label: "연간 금융·세제 캘린더", note: "1–12월 기한과 절차" },
      { href: "/calendar/#calendar", label: "이번 달 주요 일정", note: "이 달에 확인할 것만" },
      { label: "공모주·국채 청약", note: "청약 일정과 마감", soon: true },
      { label: "ETF 배당락 일정", note: "분배금 받는 날짜", soon: true },
    ],
  },
  {
    href: "/gallery",
    label: "자료앨범",
    desc: "한장브리프 · 카드뉴스·도표",
    match: "/gallery",
    children: [
      { href: "/gallery", label: "전체 자료", note: "미리보기·다운로드 전용" },
      { href: "/gallery/?cat=cardnews", label: "카드뉴스", note: "3–5장으로 끊어 읽기" },
      { href: "/gallery/?cat=carousel", label: "캐러셀", note: "넘기며 보는 연속 카드" },
      { href: "/gallery/?cat=infographic", label: "인포그래픽", note: "한 장에 담은 구조" },
      { href: "/gallery/?cat=checklist", label: "체크리스트", note: "확인할 항목 순서" },
      { label: "월간 시장 지표 팩", note: "한 달 지표를 한 장에", soon: true },
    ],
  },
  {
    href: "/about",
    label: "버핏킴즈",
    desc: "왜 버핏킴즈인가 · 1:1 문의",
    match: "/about",
    children: [
      { href: "/about", label: "왜 버핏킴즈인가", note: "어떤 기준으로 쓰는 사람인지" },
      { href: "/principles", label: "편집 원칙", note: "1차 자료·사람 검수·비저장" },
      { href: site.kakaoChannelUrl, label: "1:1 문의", note: "카카오톡 채널로 묻기", external: true },
      { label: "주간 버핏킴즈 레터", note: "확인한 것만 골라 한 통", soon: true },
    ],
  },
];

/** 메뉴 이름을 한 곳에서 읽는다 — 페이지 제목·브레드크럼·본문이 같은 이름을 쓰게. */
export const menuLabel = {
  posts: "자산리포트",
  postsSub: "투자백서 · 자산리포트 아카이브",
  apps: "앱스토어",
  calendar: "골든타임",
  gallery: "자료앨범",
  about: "버핏킴즈",
} as const;

/**
 * 모바일 2행 퀵 탭 — 홈·자산리포트·앱스토어·골든타임·자료앨범 다섯 칸.
 * v7.2에서 메뉴가 여섯 개가 되면서 좁은 폰에서 억지로 모든 메뉴를 가로에 구기지 않는다.
 * 가로 탭은 가장 자주 누르는 다섯 개만 두고, 전체 메뉴(소개 포함)는 ≡ 세로 드로어가 모두 받는다
 * — 메뉴가 7개·10개로 늘어도 드로어는 세로로만 길어지면 된다.
 *
 * `weight`는 360px 폭에서도 '골든타임' 다섯 글자가 줄바꿈·가로 넘침 없이 들어가도록
 * 글자 수에 비례해 나눈 그리드 비율이다(Header.astro의 모바일 그리드가 이 값을 쓴다).
 */
export type QuickTab = { href: string; label: string; match: string; weight: number; children?: NavChild[] };

/** 하위 메뉴는 `nav` 배열 하나에서 가져온다 — 같은 메뉴가 두 곳에서 다르게 보이지 않게. */
export const childrenOf = (match: string): NavChild[] | undefined =>
  nav.find((item) => item.match === match)?.children;

export const quickTabs: QuickTab[] = [
  { href: "/", label: "홈", match: "/", weight: 1 },
  { href: "/posts", label: "자산리포트", match: "/posts", weight: 5, children: childrenOf("/posts") },
  { href: "/apps", label: "앱스토어", match: "/apps", weight: 4, children: childrenOf("/apps") },
  { href: "/calendar", label: "골든타임", match: "/calendar", weight: 4, children: childrenOf("/calendar") },
  { href: "/gallery", label: "자료앨범", match: "/gallery", weight: 4, children: childrenOf("/gallery") },
  { href: "/about", label: "버핏킴즈", match: "/about", weight: 4, children: childrenOf("/about") },
];

/** 모바일 퀵 탭 그리드 비율 문자열 (`1fr 1.1fr …`) */
export const quickTabColumns = quickTabs.map((t) => `${t.weight}fr`).join(" ");
