#!/usr/bin/env node
/**
 * bojang-core.js 생성기 — buffetkimz.com 의 보장분석 엔진을 InsureCRM 의 클래식 스크립트로 옮긴다.
 *
 * 왜: 두 앱이 같은 증권에 같은 요약을 내야 한다. 엔진은 한 벌만 두고(웹은 ES 모듈로 직접 import),
 *     InsureCRM(app.html)은 클래식 스크립트라 `window.Bojang` 으로 받는다.
 *
 * 사용:
 *   node scripts/build_bojang_core.mjs          # 다시 만들기
 *   node scripts/build_bojang_core.mjs --check  # 지금 파일이 원본과 같은지(다르면 exit 1)
 *
 * 엔진·보험사 표를 고치면 이 스크립트를 다시 돌리고, 바뀐 `apps/insure-crm/bojang-core.js` 도 함께 커밋한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const SRC = path.join(APP, "src/lib/bojang/engine.js");
const INS = path.join(APP, "src/lib/bojang/insurers.js");
const OUT = path.resolve(APP, "../insure-crm/bojang-core.js");

const strip = (file) => fs.readFileSync(file, "utf8").replace(/^export\s+/gm, "    ");

/* 엔진과 보험사 표를 한 스크립트로 합친다. 둘 다 import 가 없는 순수 모듈이라 그대로 이어 붙일 수 있다. */
const body = `${strip(SRC)}\n\n${strip(INS)}`;

const banner = `/*
 * 보장분석 요약 엔진 (자동 생성 파일 · 직접 고치지 않는다)
 *
 * 원본: apps/buffetkimz-web/src/lib/bojang/engine.js
 *       apps/buffetkimz-web/src/lib/bojang/insurers.js
 * 생성: apps/buffetkimz-web/scripts/build_bojang_core.mjs
 * 쓰는 곳: InsureCRM app.html — window.Bojang 으로 접근한다.
 *
 * 입력값은 이 PC·기기 안에서만 정리된다. 이 파일에는 통신 코드가 없다.
 */
`;

const out = `${banner}(function () {
  "use strict";

${body}

  window.Bojang = {
    FORMAT,
    GROUPS,
    GROUP_IDS,
    GROUP_BY_ID,
    PAY_KINDS,
    INSURERS,
    INSURER_NOTE,
    INSURER_CHECKED_AT,
    SAMPLES,
    parseAmount,
    formatMan,
    isoDate,
    classify,
    silsonGeneration,
    splitCells,
    parseText,
    normalizeRows,
    parsePayYears,
    estimatePaidTotal,
    parseJSON,
    readDocument,
    summarize,
    compare,
    compareLines,
    buildMessage,
  };
})();
`;

if (process.argv.includes("--check")) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (now !== out) {
    console.error("bojang-core.js 가 원본과 다릅니다 — node scripts/build_bojang_core.mjs 로 다시 만드세요.");
    process.exit(1);
  }
  console.log("bojang-core.js 최신");
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${out.length.toLocaleString()} bytes)`);
