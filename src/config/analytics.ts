/**
 * 무쿠키 익명 통계 자리 — Cloudflare Web Analytics (2026-11-22 대표님 승인)
 *
 * 왜 Cloudflare Web Analytics 인가
 *  · 쿠키를 하나도 심지 않고, 방문자를 개인 단위로 식별하지 않는다(개인정보 0건).
 *  · 페이지뷰·유입 경로·기기 비율 같은 **집계값만** 본다 — 강의로 넘어가는 흐름을 보는 데 충분하다.
 *  · Google Analytics 처럼 동의 배너(쿠키 동의)를 띄울 필요가 없다. 사이트의 '비저장' 원칙과 같은 결이다.
 *
 * 켜는 방법 (도메인 오픈 뒤, 한 줄)
 *   PUBLIC_CF_ANALYTICS_TOKEN=<Cloudflare 대시보드에서 받은 토큰> npm run build:domain
 *   → `src/layouts/Base.astro` 가 </body> 직전에 비콘 스크립트 1개를 출력한다.
 *
 * 기본값은 빈 문자열(OFF)이다. 토큰이 비면 비콘 태그를 **아예 그리지 않는다**(HTML 0건).
 * 미리보기 상태의 프라이버시·속도·CSP 에 전혀 영향이 없도록 하기 위해서다.
 */

const viteEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
const nodeEnv = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

/** 토큰은 대소문자를 섞은 문자열이라 소문자화하지 않는다(monetization.ts 의 read 와 다른 점). */
const readToken = (key: string): string => (viteEnv[`PUBLIC_${key}`] ?? nodeEnv[key] ?? "").trim();

export const analytics = {
  /** 지금은 Cloudflare Web Analytics 한 곳만. 다른 도구를 붙이면 이 값으로 분기한다. */
  provider: "cloudflare",
  /** 빌드 환경변수 `PUBLIC_CF_ANALYTICS_TOKEN` 하나로만 받는다(하드코딩 금지). */
  token: readToken("CF_ANALYTICS_TOKEN"),
} as const;

/** 토큰이 있을 때만 비콘을 출력한다 — 이 값 하나가 스크립트 유무를 가른다. */
export const analyticsEnabled = analytics.token.length > 0;
