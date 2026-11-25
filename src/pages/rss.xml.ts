import type { APIRoute } from "astro";
import { site } from "@/config/site";
import { allPosts, postPath } from "@/lib/posts";
import { categoryName } from "@/data/categories";

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async () => {
  const posts = await allPosts();

  const items = posts
    .slice(0, 30)
    .map((p) => {
      const url = `${site.url}${postPath(p)}/`;
      return `    <item>
      <title>${escape(p.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <category>${escape(categoryName(p.data.category))}</category>
      <pubDate>${p.data.publishedAt.toUTCString()}</pubDate>
      <description>${escape(p.data.description)}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(site.brand)} — 금융과 돈에 관한 기록</title>
    <link>${site.url}/</link>
    <description>${escape(site.description)}</description>
    <language>ko-KR</language>
    <copyright>${escape(site.brand)} · ${site.domain}</copyright>
    <managingEditor>${escape(site.author.name)}</managingEditor>
    <generator>buffetkimz-web (Astro)</generator>
    <ttl>60</ttl>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
