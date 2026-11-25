import type { APIRoute } from "astro";
import { absolute, withBase } from "@/config/site";

/**
 * robots.txt — 배포 접두(서브패스)에 맞춰 경로를 만든다.
 *
 * 2026-11-25 보강: 검색봇·AI 인용봇을 **이름으로 명시 허용**한다.
 *  · `User-agent: *` 하나만 두면 "허용"은 같지만, 운영자가 정책을 읽을 수 없고
 *    일부 크롤러 문서는 사이트별 명시 허용 여부를 안내한다.
 *  · 3분류로 적는다(검색·AI 인용 / 사용자 요청 시 가져오기 / 학습·수집).
 *    근거: 각 사 크롤러 문서(OpenAI·Anthropic·Google·Apple·Perplexity)와
 *    GEO 봇 3분류(Auriti-Labs/geo-optimizer-skill `models/config.py` AI_BOTS·BOT_TIERS, 2026-11 확인).
 *  · 네이버 `Yeti`·`Daum`을 검색 그룹 맨 앞에 둔다 — 국내 노출의 기본 경로다.
 *
 * 색인에서 빼는 화면(/search, /apps/*\/run 등)은 여기서 막지 않는다.
 * robots.txt로 크롤을 막으면 검색봇이 페이지의 noindex 태그를 읽지 못해
 * 오히려 색인될 수 있기 때문이다. 제외는 각 페이지의 meta robots(noindex)로 한다.
 * 여기서 막는 것은 검색 결과에 나올 이유가 없는 데이터 파일 하나뿐이다.
 */

/** 검색 색인 + AI 답변 인용 — 이 사이트가 가장 원하는 봇 */
const SEARCH_BOTS = [
  "Yeti", // 네이버 검색
  "Daum", // 다음 검색
  "Googlebot", // 구글 검색 + AI Overviews
  "Bingbot", // 빙 + Copilot
  "Applebot", // 애플 검색 + Siri
  "OAI-SearchBot", // ChatGPT 검색 인용
  "Claude-SearchBot", // Claude 검색 인용
  "PerplexityBot", // Perplexity 색인
  "xAI-Bot", // Grok 검색 인용
  "YouBot", // You.com
  "Amazonbot", // Alexa
  "DuckAssistBot", // DuckDuckGo AI
];

/** 사용자가 그 주소를 물었을 때 한 번 가져가는 봇 */
const USER_FETCH_BOTS = [
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  "Meta-ExternalFetcher",
];

/** 학습·수집 봇 — 공개 글을 학습에 쓰는 것을 막지 않는다(인용과 같은 공개 범위) */
const TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Google-CloudVertexBot",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "cohere-ai",
  "Bytespider",
  "AI2Bot",
  "AI2Bot-Dolma",
  "PetalBot",
];

export const GET: APIRoute = () => {
  const disallow = withBase("/search-index.json");

  /** 한 그룹 = 여러 User-agent 줄 + 공통 규칙. 빈 줄로 그룹을 끊는다. */
  const group = (bots: string[]) => [
    ...bots.map((bot) => `User-agent: ${bot}`),
    "Allow: /",
    `Disallow: ${disallow}`,
    "",
  ];

  const body = [
    "# 검색·AI 인용 봇 명시 허용 (2026-11-25)",
    "",
    ...group(SEARCH_BOTS),
    ...group(USER_FETCH_BOTS),
    ...group(TRAINING_BOTS),
    "# 그 밖의 크롤러 — 같은 규칙",
    "User-agent: *",
    "Allow: /",
    `Disallow: ${disallow}`,
    "",
    `Sitemap: ${absolute("/sitemap-index.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
