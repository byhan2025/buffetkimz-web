import type { APIRoute } from "astro";
import { absolute, withBase } from "@/config/site";

/**
 * robots.txt — 배포 접두(서브패스)에 맞춰 경로를 만든다.
 * 색인에서 빼는 화면(/search, /apps/*\/run)은 여기서 막지 않는다.
 * robots.txt로 크롤을 막으면 검색봇이 페이지의 noindex 태그를 읽지 못해
 * 오히려 색인될 수 있기 때문이다. 제외는 각 페이지의 meta robots(noindex)로 한다.
 */
export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Disallow: ${withBase("/search-index.json")}`,
    "",
    `Sitemap: ${absolute("/sitemap-index.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
