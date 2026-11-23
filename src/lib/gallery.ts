/**
 * 글 ↔ 카드 짝(pair) — v8.9.0, 감사 보고 R2·S1.
 *
 * 카드는 이제 글의 부속품이 아니라 **독립 발행 단위**다(/gallery/<id>/ 전용 페이지·자체 OG·Article 스키마).
 * 그래서 글과 카드를 잇는 방법은 본문 이미지 삽입이 아니라 **링크 1줄**뿐이다.
 *   · 글 하단   — `이 글의 카드 N장 보기 → /gallery/<id>/`
 *   · 카드 하단 — `이 카드의 글 읽기 → /posts/<slug>/`
 *
 * 짝은 한 곳(gallery.ts의 `post`)에서 정하고, 글 frontmatter `cards`는 그 선언을 그대로 받아 적는다.
 * 둘이 어긋나면 빌드가 서고, 목록에 없는 id를 적어도 빌드가 선다 — 화면에 '없는 카드' 링크가 생기지 않게.
 */
import { galleryItems, type GalleryItem } from "@/data/gallery";

export const galleryById = (id: string): GalleryItem | undefined =>
  galleryItems.find((item) => item.id === id);

/** 한 글에 붙은 카드 세트 — 선언 순서를 지킨다(대표 세트가 먼저) */
export function cardSetsOfPost(postId: string): GalleryItem[] {
  return galleryItems.filter((item) => item.post === postId);
}

/** 카드 세트의 장수 — 파일이 실제로 있는 장만 센다(카드 페이지·글 링크 문구 공통) */
export const slidesLabel = (n: number) => (n === 1 ? "1장" : `${n}장`);

type PostLike = { id: string; data: { cards?: string[] } };

/**
 * 글 frontmatter `cards` ↔ 카드 `post` 교차 검사.
 * 한쪽만 적힌 상태(링크가 한 방향으로만 생기는 상태)를 빌드에서 막는다.
 */
export function validatePairs(posts: PostLike[]): void {
  const declared = new Map(posts.map((p) => [p.id, new Set(p.data.cards ?? [])]));
  const errors: string[] = [];

  for (const item of galleryItems) {
    if (!item.post) continue;
    const set = declared.get(item.post);
    if (!set) {
      errors.push(`카드 ${item.id} → 글 ${item.post}: ${item.post} 글이 없습니다`);
      continue;
    }
    if (!set.has(item.id)) errors.push(`글 ${item.post} frontmatter cards 에 "${item.id}" 가 없습니다`);
  }

  for (const post of posts) {
    for (const id of post.data.cards ?? []) {
      const item = galleryById(id);
      if (!item) errors.push(`글 ${post.id} cards: "${id}" 세트가 gallery.ts에 없습니다`);
      else if (item.post !== post.id) errors.push(`카드 ${id} 의 post(${item.post ?? "없음"}) ≠ 글 ${post.id}`);
    }
  }

  if (errors.length) throw new Error(`글↔카드 pair 불일치 ${errors.length}건:\n- ${errors.join("\n- ")}`);
}
