/**
 * 통합 검색 — 빌드 시 만든 search-index.json 을 브라우저에서 검색한다.
 * 한국어 부분 일치, 다중 키워드(AND), 유형·카테고리 필터를 지원한다.
 */

export type SearchDoc = {
  id: string;
  type: "post" | "app" | "calendar" | "today";
  title: string;
  description: string;
  body: string;
  url: string;
  /** 카테고리 이름 (글) 또는 분류 (앱·일정) */
  group?: string;
  tags: string[];
  date?: string;
  readingMinutes?: number;
};

export type SearchHit = {
  doc: SearchDoc;
  score: number;
  snippet: string;
  terms: string[];
};

export type SearchOptions = {
  type?: "all" | "post" | "app" | "calendar";
  group?: string;
};

const norm = (s: string) => s.normalize("NFC").toLowerCase();

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
    if (count > 40) break;
  }
  return count;
}

export function queryTerms(query: string): string[] {
  return norm(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 6);
}

/** 검색어 주변을 잘라 스니펫을 만든다. */
export function makeSnippet(doc: SearchDoc, terms: string[], width = 96): string {
  const body = doc.body || doc.description;
  if (!body) return "";
  const lower = norm(body);
  let at = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (at === -1 || idx < at)) at = idx;
  }
  if (at === -1) {
    return body.length > width ? body.slice(0, width).trimEnd() + "…" : body;
  }
  let start = Math.max(0, at - Math.floor(width / 3));
  // 어절 경계로 살짝 밀기
  if (start > 0) {
    const space = body.indexOf(" ", start);
    if (space !== -1 && space - start < 12) start = space + 1;
  }
  let end = Math.min(body.length, start + width);
  if (end < body.length) {
    const space = body.lastIndexOf(" ", end);
    if (space !== -1 && space > start + width * 0.6) end = space;
  }
  const text = body.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${text}${end < body.length ? "…" : ""}`;
}

export function searchDocs(docs: SearchDoc[], query: string, options: SearchOptions = {}): SearchHit[] {
  const terms = queryTerms(query);

  const pool = docs.filter((d) => {
    if (options.type && options.type !== "all" && d.type !== options.type) return false;
    if (options.group && options.group !== "all" && d.group !== options.group) return false;
    return true;
  });

  if (terms.length === 0) {
    return pool
      .slice()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 8)
      .map((doc) => ({ doc, score: 0, snippet: doc.description || doc.body.slice(0, 96), terms }));
  }

  const hits: SearchHit[] = [];

  for (const doc of pool) {
    const title = norm(doc.title);
    const desc = norm(doc.description);
    const body = norm(doc.body);
    const tags = norm(doc.tags.join(" "));
    const group = norm(doc.group ?? "");

    let score = 0;
    let all = true;

    for (const term of terms) {
      let local = 0;
      if (title.includes(term)) local += title.startsWith(term) ? 22 : 14;
      if (tags.includes(term)) local += 9;
      if (group.includes(term)) local += 6;
      if (desc.includes(term)) local += 5;
      const bodyHits = countOccurrences(body, term);
      if (bodyHits > 0) local += Math.min(bodyHits, 4);
      if (local === 0) {
        all = false;
        break;
      }
      score += local;
    }

    if (!all) continue;
    // 짧은 문서가 같은 점수일 때 위로 (설명이 정확한 쪽)
    score += Math.max(0, 4 - Math.floor((doc.body.length || 1) / 400));
    hits.push({ doc, score, snippet: makeSnippet(doc, terms), terms });
  }

  const rank: Record<SearchDoc["type"], number> = { post: 0, app: 1, calendar: 2, today: 1 };
  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 점수가 같으면 글 → 앱 → 금융캘린더 순 (이 사이트의 본체는 글)
    if (a.doc.type !== b.doc.type) return rank[a.doc.type] - rank[b.doc.type];
    return (b.doc.date ?? "").localeCompare(a.doc.date ?? "");
  });
}

/** 검색어를 <mark> 로 감싸기 위한 분할 (렌더링은 컴포넌트가 한다) */
export function splitHighlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  if (!terms.length) return [{ text, hit: false }];
  const lower = norm(text);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    while (true) {
      const idx = lower.indexOf(term, from);
      if (idx === -1) break;
      ranges.push([idx, idx + term.length]);
      from = idx + term.length;
    }
  }
  if (!ranges.length) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

/*
 * 검색어는 주소창·브라우저 기록·서버 요청 어디에도, 브라우저 저장소에도 남기지 않는다.
 * 검색은 그 화면(오버레이)의 컴포넌트 메모리 안에서만 처리되고, 화면을 닫으면 사라진다.
 */

export const popularQueries = ["연금", "실손", "5세대", "세액공제", "고지의무", "금리", "환율", "간병비"];

export const typeLabels: Record<SearchDoc["type"], string> = {
  post: "금융지식",
  app: "앱",
  calendar: "금융캘린더",
  today: "오늘 확인",
};
