import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * 블로그 글 컬렉션.
 * src/content/posts/ 에 .{md,mdx} 파일을 하나 추가하면
 * 피드·카테고리·검색 인덱스·RSS·사이트맵이 빌드할 때 자동으로 갱신된다.
 */
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    category: z.enum([
      "finance",
      "invest",
      "economy",
      "insurance",
      "retire",
      "pension",
      "ai",
      "philosophy",
    ]),
    description: z.string(),
    /** 카드·상세·OG에 함께 쓰는 대표이미지 (public 기준 경로, 예: "/thumbs/ai-work-order.webp") */
    thumb: z.string().optional(),
    /** 썸네일 대체 설명 — 비워 두면 카테고리 기반 문장을 쓴다 */
    thumbAlt: z.string().optional(),
    /** 카드에 먼저 보여 주는 질문 한 줄 — 이 글이 답하는 것 */
    question: z.string().optional(),
    publishedAt: z.coerce.date(),
    /** 이 글을 확인한 기준일 — 없으면 발행일을 쓴다(발행 파이프라인이 검증) */
    baseDate: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    readingMinutes: z.number(),
    /** 이 글과 이어지는 앱 (src/data/apps.ts 의 slug) */
    app: z.string().optional(),
    /** 카드에서 앱 대신 다른 도구로 이어 줄 때 (예: "/calendar") */
    toolHref: z.string().optional(),
    /** 그 도구 버튼 문구 */
    toolTitle: z.string().optional(),
    tags: z.array(z.string()).default([]),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url().optional(),
        })
      )
      .default([]),
    featured: z.boolean().default(false),
  }),
});

const letters = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./letters" }),
  schema: z.object({
    kind: z.literal("newsletter"),
    issue: z.number(),
    date: z.coerce.date(),
    baseDate: z.coerce.date().optional(),
    posts: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url().optional(),
        })
      )
      .default([]),
  }),
});

export const collections = { posts, letters };
