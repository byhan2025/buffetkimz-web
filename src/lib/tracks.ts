/**
 * 트랙 검증·역인덱스 — v9.0.0 P0 신설 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §5-2·§5-3).
 *
 * `data/tracks.ts`가 링크의 주인이라면, 이 파일은 그 링크가 **실제로 가리키는 것이 있는지**를 빌드에서 잰다.
 * 글↔카드 짝(`validatePairs`)과 같은 자리에서 부른다 — 없는 글·없는 도구·없는 카드·없는 배지로
 * 링크를 만들면 화면에 '가는 곳 없는 칸'이 생기기 때문이다.
 *
 * 역인덱스(trackOfPost·stageOfTool …)는 화면이 계산하지 않고 여기서 한 번만 만든다.
 * P1의 배지·P2의 단계 페이지·`RunExit`가 모두 이 함수를 쓴다.
 */
import { TRACKS, TRACK_IDS, type TrackId, type Track, type TrackStage } from "@/data/tracks";
import { apps } from "@/data/apps";
import { galleryItems } from "@/data/gallery";
import { today } from "@/data/today";
import { METRIC_BADGE_IDS } from "@/data/metric-badges";
import { ACADEMY_LESSONS } from "@/data/academy-lessons";

const indicatorIds = new Set(today.indicators.map((ind) => ind.id));
const badgeRuleIds = new Set<string>(METRIC_BADGE_IDS);
const lessonSlugs = new Set(ACADEMY_LESSONS.map((lesson) => lesson.slug));
const appBySlugLoose = new Map(apps.map((app) => [app.slug, app]));

/** 단계가 붙은 트랙 — 화면·역인덱스가 함께 쓰는 단위 */
export type TrackStageRef = { track: Track; stage: TrackStage };

const stageRefs: TrackStageRef[] = TRACKS.flatMap((track) =>
  track.stages.map((stage) => ({ track, stage })),
);

/** 이 글이 어느 트랙의 어느 단계인가 — 없으면 undefined */
export const stageOfPost = (postId: string): TrackStageRef | undefined =>
  stageRefs.find((ref) => ref.stage.posts.includes(postId));

/** 이 도구가 어느 트랙의 어느 단계 도구인가 — 없으면 undefined */
export const stageOfTool = (slug: string): TrackStageRef | undefined =>
  stageRefs.find((ref) => ref.stage.tool === slug);

/** 이 카드 세트가 어느 단계의 보조 카드인가 — 없으면 undefined */
export const stageOfCard = (setId: string): TrackStageRef | undefined =>
  stageRefs.find((ref) => ref.stage.card === setId);

/** 이 강의가 어느 단계의 강의인가 — 없으면 undefined */
export const stageOfLesson = (slug: string): TrackStageRef | undefined =>
  stageRefs.find((ref) => ref.stage.lesson === slug);

export const trackOfPost = (postId: string): Track | undefined => stageOfPost(postId)?.track;
export const trackOfTool = (slug: string): Track | undefined => stageOfTool(slug)?.track;
export const trackOfCard = (setId: string): Track | undefined => stageOfCard(setId)?.track;

/** 살아 있는(3단계 화면이 열린) 트랙만 — P2의 목록·홈 밴드가 이 값을 쓴다 */
export const liveTracks = TRACKS.filter((track) => track.status === "live");

type PostLike = { id: string; data: { track?: string } };

/**
 * 트랙 계약 검사 — 하나라도 어긋나면 빌드가 선다.
 * 검사 항목(설계 §5-3): ① 글 존재 ② 도구 존재·실행 화면 ③ 카드 존재·1:1 짝 ④ 중복 소속 0
 * ⑤ 단계 도구 서로 다름 ⑥ (P3 발행 목표 — 여기서는 '빈틈 글'이 아직 없음을 확인) ⑦ 배지 id 존재
 */
export function validateTracks(posts: PostLike[]): void {
  const errors: string[] = [];
  const postIds = new Set(posts.map((post) => post.id));

  // ① 트랙 id — 닫힌 목록 안, 중복 없음
  const seenTrackIds = new Set<string>();
  for (const track of TRACKS) {
    if (!TRACK_IDS.includes(track.id as TrackId)) {
      errors.push(`트랙 ${track.id}: TRACK_IDS에 없는 id입니다`);
    }
    if (seenTrackIds.has(track.id)) errors.push(`트랙 ${track.id}: 두 번 선언되었습니다`);
    seenTrackIds.add(track.id);

    // ⑤ 단계 구성 — 1·2·3 순서, 이름 중복 없음
    const nos = track.stages.map((stage) => stage.no).join(",");
    if (nos !== "1,2,3") errors.push(`트랙 ${track.id}: 단계 번호가 1,2,3 순서가 아닙니다(${nos})`);
    if (new Set(track.stages.map((s) => s.name)).size !== track.stages.length) {
      errors.push(`트랙 ${track.id}: 단계 이름이 중복됩니다`);
    }
    // ⑥ 단계 도구가 서로 달라야 한다
    const tools = track.stages.map((stage) => stage.tool);
    if (new Set(tools).size !== tools.length) errors.push(`트랙 ${track.id}: 단계 도구가 중복됩니다(${tools.join(", ")})`);

    for (const stage of track.stages) {
      const where = `${track.id} ${stage.no}단계`;

      // ① 글 — 이미 발행된 slug만
      for (const slug of stage.posts) {
        if (!postIds.has(slug)) errors.push(`${where}: 글 "${slug}"이 src/content/posts에 없습니다`);
      }

      // '빈틈 글' — 아직 없어야 한다(발행되면 posts로 옮긴다)
      for (const planned of stage.planned ?? []) {
        if (postIds.has(planned.slug)) {
          errors.push(`${where}: 빈틈 글 "${planned.slug}"이 이미 발행되었습니다 — posts로 옮기세요`);
        }
      }

      // ② 도구 — apps.ts에 있고, 실행 화면이 있고, 보관함이 아님
      const app = appBySlugLoose.get(stage.tool);
      if (!app) errors.push(`${where}: 도구 "${stage.tool}"이 apps.ts에 없습니다`);
      else if (!app.internal) errors.push(`${where}: 도구 "${stage.tool}"에 실행 화면이 없습니다(internal 아님)`);
      else if (app.archived) errors.push(`${where}: 도구 "${stage.tool}"은 보관함 도구입니다`);

      // ③ 카드 — gallery.ts에 있고, 짝(post)이 비었거나 이 단계 글 중 하나
      const card = galleryItems.find((item) => item.id === stage.card);
      if (!card) errors.push(`${where}: 카드 세트 "${stage.card}"가 gallery.ts에 없습니다`);
      else if (card.post && !stage.posts.includes(card.post)) {
        errors.push(`${where}: 카드 "${stage.card}"의 짝 글(${card.post})이 이 단계 글이 아닙니다(1:1 규칙)`);
      }

      // ⑦ 배지 — market은 today.ts, rules는 metric-badges.ts
      for (const id of stage.badges.market) {
        if (!indicatorIds.has(id)) errors.push(`${where}: 배지 "${id}"가 today.ts 지표에 없습니다`);
      }
      for (const id of stage.badges.rules) {
        if (!badgeRuleIds.has(id)) errors.push(`${where}: 배지 "${id}"가 metric-badges.ts에 없습니다`);
      }

      // 강의 — academy-lessons.ts에 있는 slug
      if (stage.lesson && !lessonSlugs.has(stage.lesson)) {
        errors.push(`${where}: 강의 "${stage.lesson}"이 academy-lessons.ts에 없습니다`);
      }
    }
  }

  // ④ 한 글은 한 트랙의 한 단계에만
  const owner = new Map<string, string>();
  for (const { track, stage } of stageRefs) {
    for (const slug of stage.posts) {
      const prev = owner.get(slug);
      if (prev) errors.push(`글 "${slug}"이 ${prev}와 ${track.id} ${stage.no}단계에 중복 소속됩니다`);
      else owner.set(slug, `${track.id} ${stage.no}단계`);
    }
  }

  // 빈틈 글 slug 중복
  const plannedSlugs = new Set<string>();
  for (const { stage, track } of stageRefs) {
    for (const planned of stage.planned ?? []) {
      if (plannedSlugs.has(planned.slug)) errors.push(`빈틈 글 "${planned.slug}"이 두 단계에 적혔습니다`);
      plannedSlugs.add(planned.slug);
      if (postIds.has(planned.slug)) errors.push(`빈틈 글 "${planned.slug}"(${track.id})이 이미 발행되었습니다`);
    }
  }

  // 글 frontmatter `track` — 적혀 있으면 그 트랙의 posts에 있어야 한다
  for (const post of posts) {
    const declared = post.data.track;
    if (!declared) continue;
    const track = TRACKS.find((t) => t.id === declared);
    if (!track) {
      errors.push(`글 ${post.id}: frontmatter track "${declared}"가 없습니다`);
      continue;
    }
    if (!track.stages.some((stage) => stage.posts.includes(post.id))) {
      errors.push(`글 ${post.id}: track "${declared}"를 달았지만 tracks.ts의 posts에 없습니다`);
    }
  }

  if (errors.length) throw new Error(`트랙 계약 불일치 ${errors.length}건:\n- ${errors.join("\n- ")}`);
}

/** 지금 트랙이 걸치는 도구·카드·글 수 — 진단용(화면은 세지 않는다) */
export const trackCounts = (track: Track) => ({
  posts: new Set(track.stages.flatMap((stage) => stage.posts)).size,
  planned: track.stages.flatMap((stage) => stage.planned ?? []).length,
  cards: new Set(track.stages.map((stage) => stage.card)).size,
  tools: new Set(track.stages.map((stage) => stage.tool)).size,
});
