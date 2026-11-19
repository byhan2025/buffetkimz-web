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
  tagline: "금융과 돈에 관한 기록, 그리고 직접 만든 도구",
  description:
    "금융·투자·경제·보험·노후준비·연금·AI·철학을 매일 기록하는 개인 아카이브이자, 직접 만든 계산 도구를 모아 둔 본진. 모든 글과 도구에 기준일과 출처를 붙입니다.",
  /** 기준일 — 모든 콘텐츠·도구의 확인 시점 */
  baseDate: "2026-11-19",
  baseDateLabel: "2026년 11월 19일",
  /** 빌드 시점의 '오늘' (기준일과 같은 날로 고정) */
  today: new Date("2026-11-19T09:00:00+09:00"),
  /**
   * 1:1 상담문의 — 이 값 하나로 홈·푸터·소개의 링크가 함께 살아난다.
   * http://pf.kakao.com/_UxkVxnn/chat 은 HTTPS로 308 리다이렉트되므로 https 주소를 쓴다(2026-11-19 확인).
   * v4.1부터 화면 표기는 '카카오톡 채널'이 아니라 '1:1 상담문의'로 통일한다.
   * 상품 가입 권유·중개가 아닌 일반 안내·문의 채널이라는 면책을 함께 붙인다.
   */
  kakaoChannelUrl: "https://pf.kakao.com/_UxkVxnn/chat",
  contact: {
    label: "1:1 상담문의",
    url: "https://pf.kakao.com/_UxkVxnn/chat",
    note: "1:1 대화로 문의",
    disclaimer: "1:1 상담문의는 특정 상품의 가입 권유·중개가 아닌 일반 안내·문의 채널입니다.",
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
      title: "입력값은 서버로 보내지 않습니다",
      body: "도구에 입력한 값은 브라우저 안에서만 계산됩니다. 서버로 전송하지 않고 저장하지 않습니다.",
    },
  ],
} as const;

export type NavItem = { href: string; label: string; match: string };

/**
 * 메뉴 이름 — '도구'는 자료실(계산 도구 + 앞으로 붙을 앱 쇼케이스)이라 '도구자료실'로 부른다.
 * 데스크톱 주 메뉴와 모바일 퀵 탭이 이 두 배열을 함께 읽으므로, 이름을 바꿀 때는 여기만 고친다.
 */
export const nav: NavItem[] = [
  { href: "/posts", label: "블로그", match: "/posts" },
  { href: "/apps", label: "도구자료실", match: "/apps" },
  { href: "/calendar", label: "제도달력", match: "/calendar" },
  { href: "/about", label: "소개", match: "/about" },
];

/**
 * 모바일 2행 퀵 탭 — 홈·소개·블로그·도구자료실·달력 다섯 칸.
 * `weight`는 360px 폭에서도 '도구자료실' 다섯 글자가 줄바꿈·가로 넘침 없이 들어가도록
 * 글자 수에 비례해 나눈 그리드 비율이다(Header.astro의 모바일 그리드가 이 값을 쓴다).
 */
export type QuickTab = { href: string; label: string; match: string; weight: number };

export const quickTabs: QuickTab[] = [
  { href: "/", label: "홈", match: "/", weight: 1 },
  { href: "/about", label: "소개", match: "/about", weight: 1.1 },
  { href: "/posts", label: "블로그", match: "/posts", weight: 1.35 },
  { href: "/apps", label: "도구자료실", match: "/apps", weight: 1.75 },
  { href: "/calendar", label: "달력", match: "/calendar", weight: 1.1 },
];

/** 모바일 퀵 탭 그리드 비율 문자열 (`1fr 1.1fr …`) */
export const quickTabColumns = quickTabs.map((t) => `${t.weight}fr`).join(" ");
