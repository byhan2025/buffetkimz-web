import { getCollection, type CollectionEntry } from "astro:content";

export type Letter = CollectionEntry<"letters">;

/** 소식지 목록 — 최근 호가 먼저 */
export async function allLetters(): Promise<Letter[]> {
  const list = await getCollection("letters");
  return list.sort((a, b) => {
    const diff = b.data.date.getTime() - a.data.date.getTime();
    if (diff !== 0) return diff;
    return b.data.issue - a.data.issue;
  });
}

export function letterPath(letter: Letter): string {
  return `/letters/${letter.id}`;
}

/** 호수 표기 — 제1호 */
export function issueLabel(issue: number): string {
  return `제${issue}호`;
}

/** 연도별 묶음 — 접힘 아카이브 단위 */
export function groupByYear(list: Letter[]): { year: number; items: Letter[] }[] {
  const map = new Map<number, Letter[]>();
  for (const letter of list) {
    const year = letter.data.date.getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(letter);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}
