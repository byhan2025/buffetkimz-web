import { getCollection, type CollectionEntry } from "astro:content";
import { categories, categoryName, type CategorySlug } from "@/data/categories";
import { appBySlug } from "@/data/apps";

export type Post = CollectionEntry<"posts">;

export async function allPosts(): Promise<Post[]> {
  const list = await getCollection("posts");
  return list.sort((a, b) => {
    const diff = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id, "ko");
  });
}

export async function postsByCategory(category: CategorySlug): Promise<Post[]> {
  const list = await allPosts();
  return list.filter((p) => p.data.category === category);
}

export async function categoryCounts(): Promise<Record<string, number>> {
  const list = await allPosts();
  const counts: Record<string, number> = {};
  for (const c of categories) counts[c.slug] = 0;
  for (const p of list) counts[p.data.category] = (counts[p.data.category] ?? 0) + 1;
  return counts;
}

export function postPath(post: Post): string {
  return `/posts/${post.id}`;
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}.`;
}

export function formatDateShort(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}.`;
}

export function koreanDate(date: Date): string {
  const week = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${week}요일`;
}

export function categoryLabel(post: Post): string {
  return categoryName(post.data.category);
}

export function relatedApp(post: Post) {
  return post.data.app ? appBySlug(post.data.app) : undefined;
}

/** 마크다운에서 검색·스니펫용 평문을 만든다. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 목록 카드에 쓸 글 앞부분 (마크다운 제거) */
export function previewText(post: Post, length = 120): string {
  const text = stripMarkdown(post.body ?? "");
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "…";
}

/**
 * 카드의 질문 줄을 보여 줄지 판단한다.
 * 질문이 제목과 거의 같은 문장이면(한쪽이 다른 쪽을 포함하거나, 글자 2-gram이 절반 이상 겹치면)
 * 같은 말을 두 번 읽게 되므로 질문 줄을 숨긴다.
 */
export function shouldShowQuestion(question?: string, title?: string): boolean {
  if (!question || !question.trim()) return false;
  if (!title) return true;
  const norm = (s: string) => s.replace(/[\s.,·"'`~!?()[\]{}<>:/\\|—–-]/g, "").toLowerCase();
  const q = norm(question);
  const t = norm(title);
  if (!q) return false;
  if (t.includes(q) || q.includes(t)) return false;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const a = bigrams(q);
  const b = bigrams(t);
  let shared = 0;
  a.forEach((g) => {
    if (b.has(g)) shared += 1;
  });
  const union = a.size + b.size - shared;
  return union === 0 ? true : shared / union < 0.5;
}

/**
 * 1차 출처 라벨에서 기관명만 짧게 뽑는다 — 카드에 "출처 2건" 대신 "한국은행·통계청"으로 보여 주기 위해.
 * 라벨은 "기관 — 설명", "기관(설명)", "기관 보도자료 (날짜)" 형태를 쓴다.
 */
function shortOrgName(label: string): string {
  let t = label.split(/[—–(]/)[0].trim();
  if (t.startsWith("작성자")) return "작성자 기록";
  t = t.replace(/\s+제\d+조.*$/, "").trim();
  t = t.replace(/\s*(보도자료|공시|안내|고시|자료|개요|통계)$/, "").trim();
  t = t.split(/\s+및\s+/)[0].trim();
  // 기관명은 보통 한 토큰이다 — 뒤에 붙은 설명("기준금리 운용 관련…")은 버린다.
  return t.split(/\s+/)[0];
}

/** 카드에 쓰는 출처 기관 줄임 표기 — 중복을 지우고 최대 max곳까지 "·"로 잇는다. */
export function sourceOrgLine(sources: { label: string }[], max = 3): string {
  const names: string[] = [];
  for (const s of sources) {
    const name = shortOrgName(s.label);
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= max) break;
  }
  return names.join("·");
}
