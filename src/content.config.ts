import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * 자산리포트 시리즈 4종 — v5.9.
 *
 * 글을 '분야(category)'로만 나누면 목록이 납짝해진다. 시리즈는 같은 질문으로 묶는 층이다.
 * 메뉴를 늘리지 않고 깊이를 만드는 장치이므로, 새 시리즈는 이 네 이름 안에서 고른다.
 *   내 돈 체크 — 금리·환율·제도가 내 통장에 닿는 지점
 *   연금 지도   — 넣는 시점과 받는 시점의 시간표
 *   약관 해독   — 약관·중권을 읽는 기준(보험은 리스크 관리로만)
 *   도구 노트   — 직접 만든 도구·AI를 써 보고 남긴 기록
 */
export const SERIES_NAMES = [
  "내 돈 체크",
  "연금 지도",
  "약관 해독",
  "도구 노트",
  /**
   * v7.0 — 연금·퇴직 마스터 가이드.
   * 43쪽 분량의 「사계정원 연금노트」를 5~6편으로 나눠 편입할 때 쓰는 섹터 이름이다.
   * 지금은 뼈대만 열어 두었고, 글이 들어오면 `series: { name: "연금·퇴직 마스터 가이드", no }`만 적으면
   * 카드·상세 머리·시리즈 목록에 자동으로 붙는다(src/data/library.ts의 같은 시리즈와 짝).
   */
  "연금·퇴직 마스터 가이드",
] as const;
export type SeriesName = (typeof SERIES_NAMES)[number];

/**
 * 자산리포트 글 컬렉션.
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
    /**
     * 상단 '결론' 앵커의 2문장 (선택). 없으면 description을 쓴다.
     * ① 핵심 팩트를 두괄식으로 ② 독자가 자기 계약·재무와 대조할 지점.
     */
    summary: z.string().optional(),
    /** 카드·상세·OG에 함께 쓰는 대표이미지 (public 기준 경로, 예: "/thumbs/ai-work-order.webp") */
    thumb: z.string().optional(),
    /** 썸네일 대체 설명 — 비워 두면 카테고리 기반 문장을 쓴다 */
    thumbAlt: z.string().optional(),
    /** 카드에 먼저 보여 주는 질문 한 줄 — 이 글이 답하는 것 */
    question: z.string().optional(),
    /**
     * v7.7 — '많이 찾는 핵심 글' 카드의 서브훅 한 줄.
     * 독자가 자기 숫자를 대입해 볼 수 있는 구체적 손익·질문으로 쓴다(제목 반복 금지).
     */
    hook: z.string().optional(),
    publishedAt: z.coerce.date(),
    /** 이 글을 확인한 기준일 — 없으면 발행일을 쓴다(발행 파이프라인이 검증) */
    baseDate: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    readingMinutes: z.number(),
    /** 이 글과 이어지는 앱 (src/data/apps.ts 의 slug) */
    app: z.string().optional(),
    /** 카드에서 앱 대신 다른 도구로 이어 줄 때 (예: "/calendar") */
    toolHref: z.string().optional(),
    /** 그 도구 버튼 문구 — '무엇을 할 수 있는지'로 쓴다 */
    toolTitle: z.string().optional(),
    /** 그 도구가 무엇을 확인·계산하는지 한 줄 (앱이 아닌 도구에 붙인다) */
    toolWhat: z.string().optional(),
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
    /**
     * 제휴·광고 링크가 포함된 글 — 글 상단에 '광고·제휴 링크 포함'을 먼저 밝힌다.
     * 기본 false. 파이프라인은 이 값을 쓰지 않아도 되고, 해당 글만 true 로 적으면 된다.
     */
    /**
     * 시리즈 라벨 — {name, no}. 카드·상세 머리에 '내 돈 체크 ③'처럼 회차를 붙인다.
     * 시리즈를 붙이지 않은 글은 라벨 없이 나온다(억지로 채우지 않는다).
     */
    series: z
      .object({
        name: z.enum(SERIES_NAMES),
        /** 시리즈 안에서의 회차 (1부터) */
        no: z.number().int().positive(),
      })
      .optional(),
    /**
     * A vs B 2칸 비교 카드 — 두 조건을 나란히만 놓는다(우열 판정 문구는 쓰지 않는다).
     * 상세 페이지의 이미지 아래에 그려진다.
     */
    compare: z
      .object({
        title: z.string(),
        /** 이 비교의 기준 — '금융위 보도자료(2026. 11. 19.) · 시행 11. 23.' */
        asOfLabel: z.string(),
        a: z.object({ label: z.string(), points: z.array(z.string()).max(3) }),
        b: z.object({ label: z.string(), points: z.array(z.string()).max(3) }),
        /** 어느 쪽이 유리한지는 무엇에 따라 갈리는지 — 판정 대신 조건 */
        note: z.string(),
        toolHref: z.string().optional(),
        toolLabel: z.string().optional(),
        sources: z
          .array(z.object({ label: z.string(), url: z.string().url().optional() }))
          .default([]),
      })
      .optional(),
    affiliate: z.boolean().default(false),
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
