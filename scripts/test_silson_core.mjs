#!/usr/bin/env node
/**
 * 실손 세대별 계산 엔진 단위 테스트.
 *
 *   node scripts/test_silson_core.mjs
 *
 * 검사하는 것
 *  1. 세대 판별(가입일 → 세대) 경계일
 *  2. 세대별 자기부담·보험금 대표값(금융위 보도자료의 산식 그대로 손으로 계산한 값)
 *  3. 5세대 중증/비중증 분기, 보장 제외 항목, 500만원 자기부담 상한
 *  4. 유병력자 최소 자기부담(입원 10만·통원 2만)
 *  5. 전액본인부담 통원(4·5세대 제외 / 1~3세대 포함)
 *  6. 한도(통원 회당 20만·30만)와 연 200만원 초과분 보상
 *  7. 두 앱이 같은 값을 내는지(silson-core.js 가 원본과 같은지)는 build_silson_core.mjs --check 가 본다.
 *
 * 결과는 reports/buffetkimz-web/v292-silson/engine-tests.json 에도 남긴다.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateProfile,
  compare,
  generationFromDate,
  buildMessage,
  comparisonRows,
} from "../src/lib/silson/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../reports/buffetkimz-web/v292-silson");
fs.mkdirSync(OUT, { recursive: true });

const cases = [];
function test(name, fn) {
  try {
    fn();
    cases.push({ name, ok: true });
    console.log(`  PASS ${name}`);
  } catch (e) {
    cases.push({ name, ok: false, error: String(e.message || e) });
    console.log(`  FAIL ${name}\n       ${String(e.message || e).split("\n")[0]}`);
  }
}
const base = {
  visit: "outpatient",
  hospital: "general",
  coveredKind: "partial",
  severity: "mild",
  variant23: "standard",
  coveredAmount: 200000,
  non: { general: 300000, physical: 100000, injection: 0, mri: 0 },
  primary: "gen4",
};

console.log("\n[1] 세대 판별");
test("2009-09-30 → 1세대", () => assert.equal(generationFromDate("2009-09-30").id, "gen1"));
test("2009-10-01 → 2세대", () => assert.equal(generationFromDate("2009-10-01").id, "gen2"));
test("2017-03-31 → 2세대", () => assert.equal(generationFromDate("2017-03-31").id, "gen2"));
test("2017-04-01 → 3세대", () => assert.equal(generationFromDate("2017-04-01").id, "gen3"));
test("2021-06-30 → 3세대", () => assert.equal(generationFromDate("2021-06-30").id, "gen3"));
test("2021-07-01 → 4세대", () => assert.equal(generationFromDate("2021-07-01").id, "gen4"));
test("2026-05-05 → 4세대", () => assert.equal(generationFromDate("2026-05-05").id, "gen4"));
test("2026-05-06 → 5세대", () => assert.equal(generationFromDate("2026-05-06").id, "gen5"));
test("날짜가 아니면 null", () => assert.equal(generationFromDate(""), null));

console.log("\n[2] 통원 20만 + 일반 비급여 30만 + 도수 10만 (종합병원, 비중증)");
const r4 = calculateProfile("gen4", base);
test("4세대 보험금 360,000원", () => assert.equal(r4.payout, 360000));
test("4세대 본인부담 240,000원", () => assert.equal(r4.self, 240000));
test("4세대 비급여 통원 20만원 한도 적용", () => {
  const non = r4.items.find((i) => i.key === "nonAll");
  assert.equal(non.base, 400000);
  assert.equal(non.payout, 200000);
  assert.match(non.reason, /한도 20만원/);
});
const r5 = calculateProfile("gen5", base);
test("5세대 보험금 250,000원", () => assert.equal(r5.payout, 250000));
test("5세대 본인부담 350,000원", () => assert.equal(r5.self, 350000));
test("5세대 급여 통원은 건보 본인부담률 50%가 가장 큼", () => {
  const cov = r5.items.find((i) => i.key === "covered");
  assert.equal(cov.deductible, 100000);
});
test("5세대 도수치료는 비중증 특약2에서 보장 제외", () => {
  const ph = r5.items.find((i) => i.key === "physical");
  assert.equal(ph.payout, 0);
  assert.match(ph.reason, /보장하지 않습니다/);
});
const r3 = calculateProfile("gen3", base);
test("3세대 보험금 370,000원 (급여+일반 30만 한도 + 도수 7만)", () => assert.equal(r3.payout, 370000));
test("3세대 통원 30만원 한도 적용", () => {
  const cov = r3.items.find((i) => i.key === "covered");
  assert.equal(cov.payout, 300000);
});
const r2 = calculateProfile("gen2", base);
test("2세대 보험금 300,000원 (합산 20% + 통원 30만 한도)", () => assert.equal(r2.payout, 300000));
const r1d = calculateProfile("gen1d", base);
test("1세대 손보 보험금 580,000원 (자기부담 0%, 통원 공제 2만)", () => assert.equal(r1d.payout, 580000));
const r1l = calculateProfile("gen1l", base);
test("1세대 생보 보험금 480,000원 (20%, 공제 2만)", () => assert.equal(r1l.payout, 480000));
const rc = calculateProfile("chronic", base);
test("유병력자 보험금 200,000원 (통원 회당 20만 한도)", () => assert.equal(rc.payout, 200000));
test("유병력자 도수치료 보장 제외", () => assert.equal(rc.items.find((i) => i.key === "physical").payout, 0));

console.log("\n[3] 입원 1,000만 + 일반 비급여 300만 (상급종합)");
const inp = { ...base, visit: "inpatient", hospital: "tertiary", coveredAmount: 10000000, non: { general: 3000000 } };
test("4세대 보험금 10,100,000원 (급여 20% + 비급여 30%)", () => {
  const r = calculateProfile("gen4", inp);
  assert.equal(r.payout, 10100000);
});
test("4세대 급여 입원 자기부담 연 200만원 상한", () => {
  const r = calculateProfile("gen4", { ...inp, coveredAmount: 15000000, non: {} });
  assert.equal(r.items[0].payout, 13000000);
  assert.match(r.items[0].reason, /연 200만원/);
});
test("5세대(비중증) 보험금 9,500,000원 (비급여 50%)", () => {
  assert.equal(calculateProfile("gen5", inp).payout, 9500000);
});
test("5세대(중증) 보험금 10,100,000원 (비급여 30%)", () => {
  assert.equal(calculateProfile("gen5", { ...inp, severity: "severe" }).payout, 10100000);
});
test("5세대 중증 비급여 상급종합 입원 500만원 자기부담 상한", () => {
  const r = calculateProfile("gen5", {
    ...inp,
    severity: "severe",
    coveredAmount: 0,
    non: { general: 20000000 },
  });
  assert.equal(r.payout, 15000000);
  assert.match(r.items[0].reason, /500만원/);
});
test("유병력자 입원 최소 자기부담 10만원", () => {
  const r = calculateProfile("chronic", { ...base, visit: "inpatient", coveredAmount: 300000, non: {} });
  assert.equal(r.payout, 200000);
});

console.log("\n[4] 전액본인부담");
test("4세대 통원 전액본인부담은 보상 제외", () => {
  const r = calculateProfile("gen4", { ...base, coveredKind: "full", non: {} });
  assert.equal(r.payout, 0);
  assert.match(r.notes.join(" "), /전액본인부담/);
});
test("3세대 통원 전액본인부담은 보상 대상", () => {
  const r = calculateProfile("gen3", { ...base, coveredKind: "full", non: {} });
  assert.ok(r.payout > 0);
});
test("4세대 입원 전액본인부담은 보상 대상", () => {
  const r = calculateProfile("gen4", { ...base, visit: "inpatient", coveredKind: "full", coveredAmount: 1000000, non: {} });
  assert.equal(r.payout, 800000);
});

console.log("\n[5] 2·3세대 선택형");
const small = { ...base, coveredAmount: 300000, non: {} };
test("2세대 선택형(10%)은 표준형(20%)보다 보험금이 많다", () => {
  const std = calculateProfile("gen2", small).payout;
  const sel = calculateProfile("gen2", { ...small, variant23: "selective" }).payout;
  assert.equal(std, 240000);
  assert.equal(sel, 270000);
});
test("3세대 선택형은 급여 10%로 계산", () => {
  const std = calculateProfile("gen3", small).payout;
  const sel = calculateProfile("gen3", { ...small, variant23: "selective" }).payout;
  assert.equal(std, 240000);
  assert.equal(sel, 270000);
});
test("5세대 통원은 특약 합계 20만원 한도", () => {
  const r = calculateProfile("gen5", {
    ...base,
    coveredAmount: 0,
    non: { general: 300000, mri: 500000 },
  });
  assert.equal(r.payout, 200000);
});

console.log("\n[6] 비교·문구");
const cmp = compare(base);
test("비교는 7개 프로필을 낸다", () => assert.equal(cmp.rows.length, 7));
test("내 세대가 표시된다", () => assert.equal(cmp.primary.id, "gen4"));
test("비교 표 행에 차이(diff)가 있다", () => {
  const rows = comparisonRows(cmp);
  assert.equal(rows.find((x) => x.id === "gen4").diff, 0);
});
test("카톡 문구에 세대·보험금이 들어간다", () => {
  const m = buildMessage(cmp, { name: "테스트" });
  assert.match(m, /테스트님/);
  assert.match(m, /4세대/);
  assert.match(m, /360,000원/);
});
test("병원비가 0원이면 보험금도 0원", () => {
  const r = calculateProfile("gen4", { ...base, coveredAmount: 0, non: {} });
  assert.equal(r.payout, 0);
  assert.equal(r.self, 0);
});
test("세대가 뒤로 갈수록 같은 병원비에서 보험금이 줄어든다(4→5세대, 비중증)", () => {
  assert.ok(calculateProfile("gen4", base).payout > calculateProfile("gen5", base).payout);
});

const failed = cases.filter((c) => !c.ok);
const summary = {
  at: new Date().toISOString(),
  total: cases.length,
  passed: cases.length - failed.length,
  failed: failed.length,
  cases,
};
fs.writeFileSync(path.join(OUT, "engine-tests.json"), JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed}/${summary.total} 통과 → ${path.join(OUT, "engine-tests.json")}`);
console.log(failed.length ? "FAIL" : "PASS");
process.exit(failed.length ? 1 : 0);
