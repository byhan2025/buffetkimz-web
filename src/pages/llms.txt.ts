import type { APIRoute } from "astro";
import { absolute, site } from "@/config/site";
import { ACADEMY, ACADEMY_LESSONS, ACADEMY_STEPS, openLessonCount } from "@/data/academy";
import { apps } from "@/data/apps";
import { categories, categoryName } from "@/data/categories";
import { galleryItems } from "@/data/gallery";
import { existsInPublic } from "@/lib/card-assets";
import { allPosts, postPath } from "@/lib/posts";
import { pageUrl } from "@/lib/schema";

/**
 * /llms.txt — AI 에이전트에게 이 사이트를 한 파일로 설명하는 지도 (2026-11-25 신설).
 *
 * 형식: llms.txt 표준 v2(https://llmstxt.org, AnswerDotAI/llms-txt).
 *   H1(이름) → blockquote(한 줄 요약) → 설명 문단 → H2별 링크 목록 → `## Optional`.
 *   링크는 모두 **절대 URL**이고, 각 줄은 `[이름](주소): 설명` 꼴이다.
 *   표준은 "파일은 문맥에 들어갈 만큼 작게, 자세한 내용은 링크 뒤에"를 요구한다.
 *   그래서 본문은 옮기지 않고 제목·한 줄 설명·기준일만 적는다.
 *
 * 왜 데이터에서 만드나
 *   글·계산기·카드·강의 개수를 손으로 적으면 새 글이 들어온 날 숫자가 어긋난다.
 *   이 파일은 빌드할 때 컬렉션과 데이터 파일을 그대로 읽어 센다(사람이 고칠 숫자 0).
 *
 * 색인 대상이 아닌 것(/run·/search·/topics·검색 인덱스 JSON·비밀번호 잠금 도구실)은
 * 여기에도 싣지 않는다 — llms.txt는 "인용해도 되는 공개 지면"의 목록이어야 한다.
 */

/** 한 줄 설명을 문맥에 맞는 길이로 자른다(문장 중간에서 끊기면 말줄임표) */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

const dots = (iso: string): string => iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1. $2. $3.");

export const GET: APIRoute = async () => {
  const posts = await allPosts();
  const visibleApps = apps.filter((app) => !app.archived);
  const cards = galleryItems
    .map((item) => ({ item, slides: item.slides.filter((s) => existsInPublic(s.src)) }))
    .filter(({ slides }) => slides.length > 0);
  const lessons = ACADEMY_LESSONS;

  const link = (name: string, path: string, note?: string) =>
    `- [${name}](${pageUrl(path)})${note ? `: ${note}` : ""}`;

  const lines: string[] = [];

  /* ── 머리 ─────────────────────────────────────────────────────────── */
  lines.push(`# ${site.brand} — ${site.domain}`);
  lines.push("");
  lines.push(`> ${site.description}`);
  lines.push("");
  lines.push(
    `운영: buffetkimz(개인 금융 콘텐츠 기록). 편집 원칙: ① 금융위·금감원·국세청·공단·법령 원문을 먼저 확인하고 기준일을 남깁니다. ② 자동화 초안은 사람이 다시 읽습니다. ③ 계산은 방문자 브라우저 안에서만 하고 입력값을 서버로 보내지 않습니다. ④ 특정 상품·운용사를 권하지 않습니다.`,
  );
  lines.push("");
  lines.push(
    `이 파일은 llms.txt 표준(llmstxt.org) 형식입니다. 링크는 모두 절대 URL이고, 사이트 기준일은 ${dots(site.baseDate)}입니다. 글 ${posts.length}편 · 계산기 ${visibleApps.length}종 · 카드뉴스 ${cards.length}세트 · 강의 ${lessons.length}강(계획 ${ACADEMY.counts.lessons}강)이 공개되어 있습니다.`,
  );
  lines.push("");
  lines.push(
    `인용하실 때: 숫자와 조건에는 그 글의 기준일을 함께 밝혀 주세요. 제도·약관·금리는 기준일 이후 바뀔 수 있어, 기준일 없는 인용은 독자에게 오해를 만듭니다. 1차 출처 URL은 각 글 하단 "기준과 출처"에 있습니다.`,
  );
  lines.push("");

  /* ── 핵심 구역 ────────────────────────────────────────────────────── */
  lines.push("## 핵심 구역");
  lines.push("");
  lines.push(link("자산리포트", "/posts", `기준일·1차 출처를 붙인 글 ${posts.length}편, ${categories.length}개 분야`));
  lines.push(link("앱스토어", "/apps", `가입 없이 쓰는 계산기 ${visibleApps.length}종`));
  lines.push(link("자료앨범", "/gallery", `카드뉴스·인포그래픽 ${cards.length}세트`));
  lines.push(
    link("금융생활학교(아카데미)", "/academy", `6 STEP ${ACADEMY.counts.lessons}강 중 ${openLessonCount}강 공개 · 초등·청소년·첫 월급·가계·자산형성·은퇴 6트랙`),
  );
  lines.push(link("골든타임", "/calendar", "1~12월 보험·연금·건강보험·절세 기한"));
  lines.push(link("13월의 월급 지도", "/year-end-tax", "2026년 귀속 연말정산 3단계 · 내 조건 체크리스트"));
  lines.push(link("데일리 브리프", "/board", "매일 세 차례 모이는 시황·제도·AI 메모"));
  lines.push(link("소식지", "/letters", "확인한 기록을 한 장에 묶은 아카이브"));
  lines.push("");

  /* ── 분야 ─────────────────────────────────────────────────────────── */
  lines.push("## 자산리포트 — 분야");
  lines.push("");
  for (const c of categories) {
    const count = posts.filter((p) => p.data.category === c.slug).length;
    lines.push(link(c.name, `/posts/${c.slug}`, `${c.lead} (${count}편)`));
  }
  lines.push("");

  /* ── 글 ───────────────────────────────────────────────────────────── */
  lines.push("## 자산리포트 — 글 (최신순)");
  lines.push("");
  for (const p of posts) {
    const basis = (p.data.baseDate ?? p.data.publishedAt).toISOString().slice(0, 10);
    const note = clip(p.data.description, 60);
    lines.push(link(p.data.title, postPath(p), `${categoryName(p.data.category)} · 기준일 ${dots(basis)} · ${note}`));
  }
  lines.push("");

  /* ── 계산기 ───────────────────────────────────────────────────────── */
  lines.push("## 앱스토어 — 계산기 (전부 무료·가입 없이 실행)");
  lines.push("");
  for (const app of visibleApps) {
    lines.push(link(app.name, `/apps/${app.slug}`, `${app.kind} · ${clip(app.summary, 60)}`));
  }
  lines.push("");

  /* ── 카드뉴스 ─────────────────────────────────────────────────────── */
  lines.push("## 자료앨범 — 카드뉴스·인포그래픽");
  lines.push("");
  for (const { item, slides } of cards) {
    lines.push(link(item.title, `/gallery/${item.id}`, `${slides.length}장 · 기준일 ${dots(item.createdAt)} · ${clip(item.tagline, 40)}`));
  }
  lines.push("");

  /* ── 아카데미 ─────────────────────────────────────────────────────── */
  lines.push(`## 금융생활학교 — 공개 강의 ${lessons.length}강`);
  lines.push("");
  lines.push(
    `프로그램은 STEP 1~${ACADEMY_STEPS.length} · ${ACADEMY.counts.lessons}강(약 11시간 40분)이고, 지금은 아래 강의만 공개되어 있습니다. 강의 1개는 5분 읽기 → 계산기 실습 → 카드 6장 → 1차 출처 → 운영표 1칸으로 끝납니다.`,
  );
  lines.push("");
  for (const lesson of lessons) {
    lines.push(link(`${lesson.label} ${lesson.shortTitle}`, `/academy/${lesson.slug}`, clip(lesson.question, 50)));
  }
  lines.push("");

  /* ── 원칙·정책 ────────────────────────────────────────────────────── */
  lines.push("## 원칙·정책");
  lines.push("");
  lines.push(link("편집 원칙", "/principles", "1차 자료·사람 검수·비저장 계산"));
  lines.push(link("소개", "/about", "왜 이 기록을 남기는지"));
  lines.push(link("이용약관", "/terms"));
  lines.push(link("개인정보처리방침", "/privacy", "무쿠키 통계·입력값 미전송"));
  lines.push("");

  /* ── Optional ─────────────────────────────────────────────────────── */
  lines.push("## Optional");
  lines.push("");
  lines.push(`- [RSS](${absolute("/rss.xml")}): 최근 글 30편 피드`);
  lines.push(`- [사이트맵](${absolute("/sitemap-index.xml")}): 색인 대상 전체 목록`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
