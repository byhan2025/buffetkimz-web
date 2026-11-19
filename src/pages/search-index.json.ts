import type { APIRoute } from "astro";
import { allPosts, postPath, stripMarkdown } from "@/lib/posts";
import { categoryName } from "@/data/categories";
import { apps } from "@/data/apps";
import { calendar } from "@/data/calendar";
import type { SearchDoc } from "@/lib/search";

/**
 * 빌드 시 한 번 만들어지는 통합 검색 인덱스.
 * 글·앱·제도달력이 여기에 모이고, 브라우저가 이 파일 하나만 받아 검색한다.
 */
export const GET: APIRoute = async () => {
  const posts = await allPosts();

  const postDocs: SearchDoc[] = posts.map((p) => ({
    id: `post-${p.id}`,
    type: "post",
    title: p.data.title,
    description: p.data.description,
    body: stripMarkdown(p.body ?? ""),
    url: postPath(p),
    group: categoryName(p.data.category),
    tags: p.data.tags,
    date: p.data.publishedAt.toISOString().slice(0, 10),
    readingMinutes: p.data.readingMinutes,
  }));

  const appDocs: SearchDoc[] = apps.map((a) => ({
    id: `app-${a.slug}`,
    type: "app",
    title: a.name,
    description: a.summary,
    body: [
      a.subtitle,
      a.question,
      a.oneLine,
      a.audience,
      ...a.why,
      ...a.features.map((f) => `${f.title} ${f.body}`),
      ...(a.basis ?? []),
    ].join(" "),
    url: `/apps/${a.slug}`,
    group: a.kind,
    tags: a.tags,
    date: "2026-11-01",
    // 앱은 날짜를 표시하지 않는다(정렬용 값만 둔다)
  }));

  const calendarDocs: SearchDoc[] = calendar.map((c, i) => ({
    id: `calendar-${c.month}-${i}`,
    type: "calendar",
    title: c.title,
    description: c.body,
    body: `${c.when} ${c.action} ${c.tag} ${c.kind} ${c.source}`,
    url: `/calendar#m${c.month}`,
    group: c.tag,
    tags: [c.tag, c.kind, `${c.month}월`],
    date: `2026-${String(c.month).padStart(2, "0")}-01`,
  }));

  const docs = [...postDocs, ...appDocs, ...calendarDocs];

  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), count: docs.length, docs }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
};
