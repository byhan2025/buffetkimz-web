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

export type NavItem = { href: string; label: string; match: string };

/**
 * 메뉴 이름 — v7.0 전면 개편.
 *   /posts    금융지식 → **금융지식**(금융·투자·보험·절세를 모두 포괄. 라우트는 링크 보존을 위해 /posts 유지)
 *   /apps     앱스토어 → **앱스토어**(주제별 카테고리 구조)
 *   /calendar 금융캘린더 → **금융캘린더**(한눈에 와닿는 이름)
 * 데스크톱 주 메뉴와 모바일 퀵 탭이 이 두 배열을 함께 읽으므로, 이름을 바꿀 때는 여기만 고친다.
 */
export const nav: NavItem[] = [
  { href: "/posts", label: "금융지식", match: "/posts" },
  { href: "/apps", label: "앱스토어", match: "/apps" },
  { href: "/calendar", label: "금융캘린더", match: "/calendar" },
  { href: "/about", label: "소개", match: "/about" },
];

/** 메뉴 이름을 한 곳에서 읽는다 — 페이지 제목·브레드크럼·본문이 같은 이름을 쓰게. */
export const menuLabel = {
  posts: "금융지식",
  postsSub: "투자백서 · 금융지식 아카이브",
  apps: "앱스토어",
  calendar: "금융캘린더",
  about: "소개",
} as const;

/**
 * 모바일 2행 퀵 탭 — 홈·소개·금융지식·앱스토어·금융캘린더 다섯 칸.
 * `weight`는 360px 폭에서도 '금융캘린더' 다섯 글자가 줄바꿈·가로 넘침 없이 들어가도록
 * 글자 수에 비례해 나눈 그리드 비율이다(Header.astro의 모바일 그리드가 이 값을 쓴다).
 */
export type QuickTab = { href: string; label: string; match: string; weight: number };

export const quickTabs: QuickTab[] = [
  { href: "/", label: "홈", match: "/", weight: 0.95 },
  { href: "/about", label: "소개", match: "/about", weight: 1.05 },
  { href: "/posts", label: "금융지식", match: "/posts", weight: 1.5 },
  { href: "/apps", label: "앱스토어", match: "/apps", weight: 1.5 },
  { href: "/calendar", label: "금융캘린더", match: "/calendar", weight: 1.7 },
];

/** 모바일 퀵 탭 그리드 비율 문자열 (`1fr 1.1fr …`) */
export const quickTabColumns = quickTabs.map((t) => `${t.weight}fr`).join(" ");
