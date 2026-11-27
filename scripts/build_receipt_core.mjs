#!/usr/bin/env node
/**
 * receipt-core.js 생성기 — buffetkimz.com 의 진료비 영수증 파서를 InsureCRM 의 클래식 스크립트로 옮긴다.
 *
 * 왜: 두 앱이 같은 영수증에서 같은 금액을 읽어야 한다. 파서는 한 벌만 두고
 *     (웹은 ES 모듈로 직접 import), InsureCRM(app.html)은 클래식 스크립트라 `window.SilsonReceipt` 로 받는다.
 *
 * 사용:
 *   node scripts/build_receipt_core.mjs          # 다시 만들기
 *   node scripts/build_receipt_core.mjs --check  # 지금 파일이 원본과 같은지(다르면 exit 1)
 *
 * 파서를 고치면 이 스크립트를 다시 돌리고, 바뀐 `apps/insure-crm/receipt-core.js` 도 함께 커밋한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const SRC = path.join(APP, "src/lib/silson/receiptParser.js");
const OUT = path.resolve(APP, "../insure-crm/receipt-core.js");

const src = fs.readFileSync(SRC, "utf8");
const body = src.replace(/^export\s+/gm, "    ");

const banner = `/*
 * 진료비 영수증 파서 (자동 생성 파일 · 직접 고치지 않는다)
 *
 * 원본: apps/buffetkimz-web/src/lib/silson/receiptParser.js
 * 생성: apps/buffetkimz-web/scripts/build_receipt_core.mjs
 * 쓰는 곳: InsureCRM app.html — window.SilsonReceipt 로 접근한다.
 *
 * 영수증 글자 줄만 받아 항목을 찾는다. 통신 코드가 없고, 파일은 이 PC·기기 밖으로 나가지 않는다.
 */
`;

const out = `${banner}(function () {
  "use strict";

${body}

  window.SilsonReceipt = {
    RECEIPT_VERSION,
    RECEIPT_SOURCE,
    RECEIPT_SAMPLES,
    RECEIPT_FIELD_LABELS,
    fixDigits,
    detectKind,
    detectVisit,
    detectHospital,
    parseReceiptLines,
    parseReceiptText,
    toSilsonInput,
  };
})();
`;

if (process.argv.includes("--check")) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (now !== out) {
    console.error("receipt-core.js 가 원본과 다릅니다 — node scripts/build_receipt_core.mjs 로 다시 만드세요.");
    process.exit(1);
  }
  console.log("receipt-core.js 최신");
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${out.length} bytes)`);
