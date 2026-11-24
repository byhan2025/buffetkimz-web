#!/usr/bin/env node
/**
 * 사이트 기준일 자동 승계 — `src/config/site-basis.generated.ts`를 만든다.
 *
 * 왜 필요한가 (전수 감사 2026-11-24 §4-3 W10)
 *   `site.baseDate`를 사람이 손으로 올리던 시절, 11-24에 발행한 글과 카드가 들어온 뒤에도 값이 11-22에
 *   멈춰 있어 홈 한 화면에 '기준일 11. 22.'와 '지표 확인 11. 24.'가 나란히 보였다.
 *   사이트 기준일은 **가장 최근에 확인한 콘텐츠 날짜**다 — 글·게시판·허브가 들어오면 함께 올라가야 한다.
 *
 * 무엇을 세는가 (가장 늦은 날짜 하나)
 *   · `src/content/posts/*.md` frontmatter의 `baseDate`(없으면 `publishedAt`)
 *   · `src/data/board.ts` 게시판 항목의 `date`
 *   · `src/data/today.ts` 허브의 `asOf`
 *
 * 어떻게 도는가
 *   · `npm run build`의 `prebuild`에서 자동 실행된다(빌드 전 보정). 손으로 실행해도 된다:
 *       node scripts/gen_site_basis.mjs
 *   · 만들어진 파일은 커밋한다 — `deploy`는 다시 빌드하지 않으므로 저장소에 값이 있어야 한다.
 *   · 파싱에 실패하면 **조용히 넘어가지 않고 exit 1**로 빌드를 세운다(기준일이 조용히 뒤처지는 것을 막는다).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const found = [];

function record(date, where) {
  if (!ISO.test(date)) {
    throw new Error(`기준일 형식이 YYYY-MM-DD가 아닙니다: ${where} → ${JSON.stringify(date)}`);
  }
  found.push({ date, where });
}

/* ① 글 — frontmatter의 baseDate(확인 기준일) 또는 publishedAt(발행일) */
const postsDir = join(ROOT, "src/content/posts");
for (const name of readdirSync(postsDir)) {
  if (!name.endsWith(".md")) continue;
  const raw = readFileSync(join(postsDir, name), "utf8");
  const pick = (key) => {
    const m = raw.match(new RegExp(`^${key}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, "m"));
    return m ? m[1] : undefined;
  };
  const date = pick("baseDate") ?? pick("publishedAt");
  if (!date) throw new Error(`src/content/posts/${name}: baseDate·publishedAt이 없습니다`);
  record(date, `post ${name}`);
}

/* ② 게시판 — date: "YYYY-MM-DD" */
const board = readFileSync(join(ROOT, "src/data/board.ts"), "utf8");
const boardDates = [...board.matchAll(/^\s*date:\s*"(\d{4}-\d{2}-\d{2})"/gm)].map((m) => m[1]);
if (boardDates.length === 0) throw new Error("src/data/board.ts에서 게시판 날짜를 하나도 찾지 못했습니다");
boardDates.forEach((d) => record(d, "board"));

/* ③ 오늘 허브 — asOf: "2026-11-24T15:30:00+09:00" */
const today = readFileSync(join(ROOT, "src/data/today.ts"), "utf8");
const asOf = today.match(/asOf:\s*"(\d{4}-\d{2}-\d{2})T/);
if (!asOf) throw new Error("src/data/today.ts에서 허브 asOf를 찾지 못했습니다");
record(asOf[1], "today.asOf");

/* 가장 늦은 날짜 — 같은 날짜가 여럿이면 그중 첫 번째 출처를 함께 적는다 */
const latest = found.reduce((a, b) => (b.date > a.date ? b : a));
const sameDay = found.filter((f) => f.date === latest.date).length;

const out = `/**
 * 자동 생성 파일 — 손으로 고치지 않습니다.
 *   생성: node scripts/gen_site_basis.mjs (npm run build의 prebuild에서 자동 실행)
 *   읽는 곳: src/config/site.ts — site.baseDate가 이 값보다 뒤처지지 않게 한다.
 *
 * 가장 최근 콘텐츠 날짜: ${latest.date} (${latest.where}${sameDay > 1 ? ` 외 ${sameDay - 1}건` : ""})
 */

/** 가장 최근에 확인한 글·게시판·허브 날짜 (YYYY-MM-DD) */
export const latestContentDate = "${latest.date}";

/** 그 날짜가 어디서 왔는지 — 빌드 로그·검수에서 근거로 쓴다 */
export const latestContentWhere = ${JSON.stringify(latest.where)};
`;

const target = join(ROOT, "src/config/site-basis.generated.ts");
const before = (() => {
  try {
    return readFileSync(target, "utf8");
  } catch {
    return "";
  }
})();
if (before !== out) writeFileSync(target, out, "utf8");

const count = (date) => found.filter((f) => f.date === date).length;
console.log(
  `✓ site-basis: 최신 콘텐츠 날짜 ${latest.date} (${latest.where}) · 글 ${readdirSync(postsDir).filter((n) => n.endsWith(".md")).length}편 · 게시판 ${boardDates.length}건 중 그날 ${count(latest.date)}건${before === out ? " · 변경 없음" : " · 파일 갱신"}`,
);
