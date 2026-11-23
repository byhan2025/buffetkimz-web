/**
 * 트랙 화면 해석 — v9.1.0 P2 신설 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §3·§5-4).
 *
 * `data/tracks.ts`는 링크의 주인(무엇을 가리키는가)이고, 이 파일은 그 링크를 **화면에 그릴 수 있는 값**으로 바꾼다.
 *  · 단계 페이지·하단 독·도구 출구(`RunExit`)가 같은 함수를 쓴다 — 제목·주소·회차를 화면마다 손으로 적지 않는다.
 *  · 글 제목은 빌드할 때 글 컬렉션에서, 도구 이름은 `apps.ts`에서, 카드 이름은 `gallery.ts`에서 온다.
 *    제목을 손으로 적으면 글 제목을 고칠 때 트랙 화면만 옛 제목으로 남는다.
 *  · 트랙 계약(글·도구·카드가 실제로 있는지)은 `lib/tracks.ts`의 `validateTracks()`가 이미 빌드에서 잰다.
 *    그래서 여기서는 '없으면 undefined'로 조용히 비우고, 없는 값으로 가짜 링크를 만들지 않는다.
 */
import type { Track, TrackStage } from "@/data/tracks";
import { apps } from "@/data/apps";
import { galleryItems } from "@/data/gallery";
import { ACADEMY_LESSONS } from "@/data/academy-lessons";
import { allPosts, postPath, formatDate, categoryLabel, type Post } from "./posts";

/** 화면에 그리는 글 한 줄 */
export type StagePostRef = {
  id: string;
  href: string;
  title: string;
  meta: string;
};

export type StageToolRef = {
  slug: string;
  name: string;
  oneLine: string;
  href: string;
  runHref: string;
};

export type StageCardRef = {
  id: string;
  title: string;
  tagline: string;
  count: number;
  href: string;
};

export type StageLessonRef = {
  slug: string;
  label: string;
  title: string;
  href: string;
};

export type StageView = {
  track: Track;
  stage: TrackStage;
  /** 0부터 — 진행선·이전/다음 계산에 쓴다 */
  index: number;
  total: number;
  prev?: TrackStage;
  next?: TrackStage;
  /** 이 단계 화면의 주소(끝 슬래시 없음) */
  href: string;
  posts: StagePostRef[];
  /** 아직 발행되지 않은 이 단계의 글 — 화면에는 '준비 중'으로만 적는다 */
  planned: { slug: string; title: string }[];
  tool?: StageToolRef;
  card?: StageCardRef;
  lesson?: StageLessonRef;
  /** 트랙 전체의 모든 글 수(단계 목록·헤더 칩용) */
  trackPostCount: number;
};

/** 트랙 주소 — 단계를 주면 그 단계, 없으면 트랙 첫 화면 */
export const trackHref = (track: Track, stage?: TrackStage): string =>
  stage ? `/academy/track/${track.id}/${stage.no}` : `/academy/track/${track.id}`;

/** 도구 실행 화면 주소 — `apps.ts`의 slug로만 만든다 */
export const toolRunHref = (slug: string): string => `/apps/${slug}/run`;

const postRef = (post: Post): StagePostRef => ({
  id: post.id,
  href: postPath(post),
  title: post.data.title,
  meta: `${categoryLabel(post)} · ${formatDate(post.data.publishedAt)} · ${post.data.readingMinutes}분`,
});

/**
 * 단계 하나를 화면 값으로 해석한다.
 * `posts`를 넘기면 다시 읽지 않는다(한 페이지에서 여러 번 불러도 컬렉션 조회는 한 번).
 */
export async function stageView(track: Track, stage: TrackStage, posts?: Post[]): Promise<StageView> {
  const all = posts ?? (await allPosts());
  const byId = new Map(all.map((post) => [post.id, post]));
  const index = track.stages.findIndex((item) => item.no === stage.no);
  const app = apps.find((item) => item.slug === stage.tool);
  const card = galleryItems.find((item) => item.id === stage.card);
  const lesson = stage.lesson ? ACADEMY_LESSONS.find((item) => item.slug === stage.lesson) : undefined;

  return {
    track,
    stage,
    index,
    total: track.stages.length,
    prev: index > 0 ? track.stages[index - 1] : undefined,
    next: index >= 0 && index < track.stages.length - 1 ? track.stages[index + 1] : undefined,
    href: trackHref(track, stage),
    posts: stage.posts
      .map((id) => byId.get(id))
      .filter((post): post is Post => Boolean(post))
      .map(postRef),
    planned: stage.planned ?? [],
    tool: app
      ? {
          slug: app.slug,
          name: app.name,
          oneLine: app.oneLine,
          href: `/apps/${app.slug}`,
          runHref: toolRunHref(app.slug),
        }
      : undefined,
    card: card
      ? {
          id: card.id,
          title: card.title,
          tagline: card.tagline,
          count: card.slides.length,
          href: `/gallery/${card.id}`,
        }
      : undefined,
    lesson: lesson
      ? {
          slug: lesson.slug,
          label: lesson.label,
          title: lesson.shortTitle,
          href: `/academy/${lesson.slug}`,
        }
      : undefined,
    trackPostCount: new Set(track.stages.flatMap((item) => item.posts)).size,
  };
}

/** 트랙 전체 — 단계 목록 화면이 쓴다 */
export async function trackView(track: Track): Promise<StageView[]> {
  const posts = await allPosts();
  return Promise.all(track.stages.map((stage) => stageView(track, stage, posts)));
}
