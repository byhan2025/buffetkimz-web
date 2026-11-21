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

/**
 * 상단 '결론' 앵커에 쓰는 두 문장.
 * 글에 summary(① 핵심 팩트 ② 내 계약·재무와 대조할 지점)가 있으면 그것, 없으면 description.
 */
export function summaryOf(post: Post): string {
  return (post.data.summary ?? post.data.description).trim();
}

/**
 * 글 → 도구 연결 **한 곳**.
 *
 * 1) 글에 앱이 붙어 있으면 그 앱 (실행 화면이 있으면 /run)
 * 2) 앱은 없고 toolHref가 도구·달력이면 그것 (다른 글로 가는 /posts/ 링크는 도구가 아니므로 건너뛴다)
 * 3) 둘 다 없으면 분야 기본 도구 — 도구가 없는 글에서도 '무엇을 할 수 있는지'가 남는다
 *
 * CTA는 '자세히 보기' 같은 빈 문구 대신 무엇을 하는지 쓴다.
 */
export type PostTool = {
  name: string;
  href: string;
  /** 이 도구가 무엇을 확인·계산하는지 한 줄 */
  what: string;
  cta: string;
  kind: "app" | "tool";
};

/** 앱별 실행 문구 — 앱 이름을 그대로 버튼에 쓰지 않고 '무엇을 하는지'를 쓴다 */
const appCta: Record<string, string> = {
  "pension-tax": "올해 세액공제액 계산해 보기",
  "retirement-flow": "은퇴 후 월 현금흐름 계산해 보기",
  "compound-return": "세후 수익률 계산해 보기",
  "coverage-check": "내 담보 공백 점검해 보기",
  "disclosure-check": "고지 항목 자가점검 해 보기",
  "silson-compare": "내 실손 세대 비교해 보기",
  "trade-timemachine": "시뮬레이터 열어 보기",
  "bojang-counsel-guide": "담보 확인 순서 열어 보기",
};

/** 앱도 toolHref도 없는 글에 붙는 분야 기본 도구 — 실제로 있는 도구만 가리킨다. */
const categoryTool: Record<string, PostTool> = {
  finance: {
    name: "투자 복리·세후 수익률 계산기",
    href: "/apps/compound-return",
    what: "금리와 세금을 넣어 손에 남는 수익이 얼마인지 계산합니다.",
    cta: "세후 수익률 계산해 보기",
    kind: "tool",
  },
  invest: {
    name: "투자 복리·세후 수익률 계산기",
    href: "/apps/compound-return",
    what: "기간과 수익률, 세금을 넣어 복리 결과를 비교합니다.",
    cta: "세후 수익률 계산해 보기",
    kind: "tool",
  },
  economy: {
    name: "골든타임",
    href: "/calendar",
    what: "올해 남은 마감·변경 일정을 날짜와 출처로 확인합니다.",
    cta: "골든타임 열어 보기",
    kind: "tool",
  },
  insurance: {
    name: "보장 점검 시뮬레이터",
    href: "/apps/coverage-check",
    what: "가진 담보 금액을 기준점과 나란히 놓고 빈 칸을 정리합니다.",
    cta: "내 담보 공백 점검해 보기",
    kind: "tool",
  },
  retire: {
    name: "은퇴 월 현금흐름 시뮬레이터",
    href: "/apps/retirement-flow",
    what: "은퇴 후 매달 들어오고 나가는 돈을 계산합니다.",
    cta: "은퇴 후 월 현금흐름 계산해 보기",
    kind: "tool",
  },
  pension: {
    name: "연금저축·IRP 세액공제 계산기",
    href: "/apps/pension-tax",
    what: "납입액과 소득으로 돌려받을 세액공제액을 계산합니다.",
    cta: "올해 세액공제액 계산해 보기",
    kind: "tool",
  },
  ai: {
    name: "앱스토어",
    href: "/apps",
    what: "직접 만든 계산·점검 도구를 한자리에서 열어 봅니다.",
    cta: "앱스토어 둘러보기",
    kind: "tool",
  },
  philosophy: {
    name: "편집 원칙",
    href: "/principles",
    what: "이 사이트가 글을 쓰고 숫자를 확인하는 기준을 읽습니다.",
    cta: "편집 원칙 읽어 보기",
    kind: "tool",
  },
};

export function toolOf(post: Post): PostTool {
  const app = relatedApp(post);
  if (app) {
    return {
      name: app.name,
      href: app.internal ? `/apps/${app.slug}/run` : `/apps/${app.slug}`,
      what: app.oneLine ?? app.summary,
      cta: appCta[app.slug] ?? "도구 열어 보기",
      kind: "app",
    };
  }
  const href = post.data.toolHref;
  if (href && !href.startsWith("/posts/") && !href.startsWith("http")) {
    return {
      name: post.data.toolTitle ?? "이어지는 도구",
      href,
      what: post.data.toolWhat ?? "",
      cta: post.data.toolTitle ?? "도구 열어 보기",
      kind: "tool",
    };
  }
  return categoryTool[post.data.category] ?? categoryTool.philosophy;
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
function orgNames(label: string): string[] {
  let t = label.split(/[—–(]/)[0].trim();
  if (t.startsWith("작성자")) return ["작성자 기록"];
  t = t.replace(/\s+제\d+조.*$/, "").trim();
  t = t.replace(/\s*(보도자료|공시|안내|고시|자료|개요|통계)$/, "").trim();
  // "금융위원회·금융감독원"처럼 한 라벨에 기관이 둘 이상이면 각각 나눠 넣는다.
  return t
    .split("·")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** 카드에 쓰는 출처 기관 줄임 표기 — 중복을 지우고 최대 max곳까지 "·"로 잇는다. */
export function sourceOrgLine(sources: { label: string }[], max = 3): string {
  const names: string[] = [];
  for (const s of sources) {
    for (const name of orgNames(s.label)) {
      if (name && !names.includes(name)) names.push(name);
      if (names.length >= max) return names.join("·");
    }
  }
  return names.join("·");
}
