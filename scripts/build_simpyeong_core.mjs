#!/usr/bin/env node
/**
 * simpyeong-core.js 생성기 — buffetkimz.com 의 엔진을 InsureCRM 의 클래식 스크립트로 옮긴다.
 *
 * 왜: 두 앱이 같은 판정을 내야 한다. 엔진은 한 벌만 두고(웹은 ES 모듈로 직접 import),
 *     InsureCRM(app.html)은 클래식 스크립트라 `window.Simpyeong` 으로 받는다.
 *
 * 사용:
 *   node scripts/build_simpyeong_core.mjs          # 다시 만들기
 *   node scripts/build_simpyeong_core.mjs --check  # 지금 파일이 원본과 같은지(다르면 exit 1)
 *
 * 엔진을 고치면 이 스크립트를 다시 돌리고, 바뀐 `apps/insure-crm/simpyeong-core.js` 도 함께 커밋한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const SRC = path.join(APP, "src/lib/simpyeong/engine.js");
const OUT = path.resolve(APP, "../insure-crm/simpyeong-core.js");

const src = fs.readFileSync(SRC, "utf8");
const body = src.replace(/^export\s+/gm, "    ");

const banner = `/*
 * 심평원 고지 정리기 — 분류·판정 엔진 (자동 생성 파일 · 직접 고치지 않는다)
 *
 * 원본: apps/buffetkimz-web/src/lib/simpyeong/engine.js
 * 생성: apps/buffetkimz-web/scripts/build_simpyeong_core.mjs
 * 쓰는 곳: InsureCRM app.html — window.Simpyeong 으로 접근한다.
 *
 * 파일은 브라우저 안에서만 읽는다. 이 파일에는 통신 코드가 없다.
 */
`;

const out = `${banner}(function () {
  "use strict";

${body}

  window.Simpyeong = {
    analyze,
    buildSummary,
    buildCustomerMessage,
    buildReportHTML,
    EXAMPLE_TABLES,
    parseTablesFromLines,
    pdfWordsToRows,
    tableToRecords,
    todayISO,
    dotDate,
    isoAddDays,
    daysBetween,
    ago,
    normalizeDate,
    drugGroup,
    SECTIONS,
  };
})();
`;

if (process.argv.includes("--check")) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (now !== out) {
    console.error("simpyeong-core.js 가 원본과 다릅니다 — node scripts/build_simpyeong_core.mjs 로 다시 만드세요.");
    process.exit(1);
  }
  console.log("simpyeong-core.js 최신");
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${out.length.toLocaleString()} bytes)`);
