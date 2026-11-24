import type { APIRoute } from "astro";
import { allPosts, postPath, stripMarkdown } from "@/lib/posts";
import { categoryName } from "@/data/categories";
import { apps } from "@/data/apps";
import { calendar } from "@/data/calendar";
import { today as hub } from "@/data/today";
import { ACADEMY_LESSONS, TRACK_LABEL, academyLessonHref, stepByNo } from "@/data/academy";
import { galleryItems, GALLERY_CATEGORIES } from "@/data/gallery";
import { boardEntries } from "@/data/board";
import type { SearchDoc } from "@/lib/search";

/**
 * 빌드 시 한 번 만들어지는 통합 검색 인덱스.
 * 글·앱·골든타임·오늘 확인에 더해 v9.4.0(2026-11-24 전수 감사)에서 **아카데미 강의·자료앨범 세트·데일리 브리프**를 넣었다.
 * 그전에는 메뉴 6개 중 3개(아카데미·자료앨범·게시판)가 검색에 아예 없어서, 강의 이름으로 찾으면 0건이 나왔다.
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

  /* v8.8.0 — 보관함 도구는 검색에서도 빠진다(직접 주소로만 연다). */
  const appDocs: SearchDoc[] = apps.filter((a) => !a.archived).map((a) => ({
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
    // v6.3 — 실무자용 앱은 검색 결과에서도 '실무자용'으로 구분해 일반 도구와 섞이지 않게 한다
    group: a.scope === "practitioner" ? "실무자용" : a.kind,
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

  /** 오늘 확인 허브 — 제목 + 내 통장 영향 1줄만 (v5.9) */
  const todayDocs: SearchDoc[] = hub.items.map((item) => ({
    id: `today-${item.id}`,
    type: "today",
    title: item.title,
    description: item.why,
    body: [item.kind, ...item.points, item.sourceLabel].join(" "),
    url: "/#today",
    group: "오늘 확인",
    tags: [item.kind],
    date: hub.asOf.slice(0, 10),
  }));

  /*
   * v9.4.0 — 아카데미 강의 17개. 본문 전문은 넣지 않고 화면에 보이는 제목·질문·결론·대표 숫자만 넣는다.
   * (인덱스는 첫 검색에 통째로 내려받으므로 본문을 넣으면 수백 KB가 된다. 검색 1차 목적은 '어느 강의인지 찾기'다.)
   */
  const academyDocs: SearchDoc[] = ACADEMY_LESSONS.map((lesson) => {
    const step = lesson.track ? null : stepByNo(lesson.step);
    return {
      id: `academy-${lesson.slug}`,
      type: "academy",
      title: `${lesson.label} ${lesson.title}`,
      description: lesson.question,
      body: [
        lesson.shortTitle,
        lesson.question,
        lesson.thesis,
        lesson.hook,
        ...lesson.keyNumbers.map((k) => `${k.label} ${k.value}`),
        lesson.calculator?.name ?? "",
      ].join(" "),
      url: academyLessonHref(lesson),
      group: lesson.track ? TRACK_LABEL[lesson.track] : step ? `STEP ${step.no} ${step.name}` : "성인 실전",
      tags: [lesson.label, lesson.shortTitle, "아카데미"],
      readingMinutes: lesson.readingMinutes,
    };
  });

  /* 자료앨범 세트 22개 — 제목·한 줄·요약·기준만(카드 본문은 이미지다) */
  const galleryCategoryName = (id: string) =>
    GALLERY_CATEGORIES.find((c) => c.id === id)?.label ?? "자료앨범";
  const galleryDocs: SearchDoc[] = galleryItems.map((item) => ({
    id: `gallery-${item.id}`,
    type: "gallery",
    title: item.title,
    description: item.tagline,
    body: [item.tagline, item.summary, item.basis, ...item.tags, `${item.slides.length}장`].join(" "),
    url: `/gallery/${item.id}`,
    group: galleryCategoryName(item.category),
    tags: item.tags,
    date: item.createdAt,
  }));

  /* 데일리 브리프 게시판 15건 — 회차·분류·제목·요약·불릿 */
  const boardDocs: SearchDoc[] = boardEntries.map((e) => ({
    id: `board-${e.id}`,
    type: "board",
    title: e.title,
    description: e.summary,
    body: [...e.bullets, e.category, e.slot, e.source ?? ""].join(" "),
    url: `/board#${e.id}`,
    group: e.category,
    tags: [e.category, `${e.slot} 회차`],
    date: e.date,
  }));

  const docs = [
    ...postDocs,
    ...academyDocs,
    ...galleryDocs,
    ...boardDocs,
    ...appDocs,
    ...calendarDocs,
    ...todayDocs,
  ];

  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), count: docs.length, docs }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
};
