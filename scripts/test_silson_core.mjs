#!/usr/bin/env node
/**
 * 실손 세대별 계산 엔진 단위 테스트.
 *
 *   node scripts/test_silson_core.mjs
 *
 * v2.9.4(2026-11-27) — 약관 원문 재대조(reports/2026-11-27-silson-calculator-verification.md) 뒤
 *  기대값을 약관 기준으로 다시 계산했다. 이전 테스트가 잡아 두던 360,000(4세대)·480,000(1세대 생보)은
 *  3대 비급여를 한 덩어리로 묶고 1세대에 표준화 이후 상한을 적용한 값이라 함께 고쳤다.
 *
 * 검사 항목
 *  1. 세대 판별(가입일 → 세대) 경계일
 *  2. 세대별 대표값 — 약관 수식으로 손으로 계산한 값
 *  3. 검증 보고서의 P0 반례 11건(틀렸던 계산이 약관 값으로 돌아왔는지)
 *  4. 한도 삭감(capped)과 공제(deductible)의 분리 — 본인부담률 50% 오해 방지
 *  5. 5세대 중증/비중증, 500만원 상한, 건보 본인부담률 입력
 *  6. 상급병실료 차액·처방조제·전액본인부담
 *  7. 약국 처방조제만 넣은 건(외래 0원)과 입원 전환 시 처방조제비 제거 — 2026-11-27 회의실 교차검증
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateProfile,
  capNotice,
  compare,
  generationFromDate,
  buildMessage,
  comparisonRows,
} from "../src/lib/silson/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../reports/buffetkimz-web/v294-silson");
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
test("4세대 보험금 430,000원 (급여 16만 + 일반 20만 + 도수 7만)", () => assert.equal(r4.payout, 430000));
test("4세대 공제 160,000원 · 한도 삭감 10,000원", () => {
  assert.equal(r4.deductible, 160000);
  assert.equal(r4.capped, 10000);
});
test("4세대 일반 비급여는 회당 20만원 한도, 삭감액을 따로 표시", () => {
  const non = r4.items.find((i) => i.key === "nonGeneral");
  assert.equal(non.base, 300000);
  assert.equal(non.payout, 200000);
  assert.equal(non.capped, 10000);
  assert.match(non.reason, /20만원|한도/);
});
const r5 = calculateProfile("gen5", base);
test("5세대 보험금 250,000원", () => assert.equal(r5.payout, 250000));
test("5세대 급여 통원은 건보 본인부담률 50%가 가장 큼", () => {
  const cov = r5.items.find((i) => i.key === "covered");
  assert.equal(cov.deductible, 100000);
});
test("5세대 도수치료는 비중증 특약2에서 보장 제외", () => {
  const ph = r5.items.find((i) => i.key === "physical");
  assert.equal(ph.payout, 0);
  assert.match(ph.reason, /보상하지 않습니다/);
});
const r3 = calculateProfile("gen3", base);
test("3세대 보험금 370,000원 (급여+일반 30만 한도 + 도수 7만)", () => assert.equal(r3.payout, 370000));
test("3세대 통원 30만원 한도 적용 — 공제 13만·삭감 10만", () => {
  const cov = r3.items.find((i) => i.key === "covered");
  assert.equal(cov.payout, 300000);
  assert.equal(cov.capped, 100000);
});
const r2 = calculateProfile("gen2", base);
test("2세대 보험금 300,000원 (합산 20% + 통원 30만 한도)", () => assert.equal(r2.payout, 300000));
test("2세대 본인부담 50%는 착시 — 공제 12만 + 한도 삭감 18만으로 분리", () => {
  assert.equal(r2.deductible, 120000);
  assert.equal(r2.capped, 180000);
  assert.equal(r2.self, 300000);
  const n = capNotice(compare({ ...base, primary: "gen2" }));
  assert.ok(n);
  assert.match(n.text, /한도/);
});
const r1d = calculateProfile("gen1d", base);
test("1세대 손보 보험금 300,000원 (자기부담 0%, 통원 회당 한도)", () => assert.equal(r1d.payout, 300000));
const r1l = calculateProfile("gen1l", base);
test("1세대 생보 보험금 300,000원 (20%, 회당 한도 30만)", () => assert.equal(r1l.payout, 300000));
const rc = calculateProfile("chronic", base);
test("유병력자 보험금 200,000원 (통원 회당 20만 한도)", () => assert.equal(rc.payout, 200000));
test("유병력자 도수치료 보장 제외", () => assert.equal(rc.items.find((i) => i.key === "physical").payout, 0));

test("4세대 의원 통원 1만5천원 → 5,000원 (최소 공제 1만원)", () => {
  const r = calculateProfile("gen4", { ...base, hospital: "clinic", coveredAmount: 15000, non: {} });
  assert.equal(r.payout, 5000);
});
test("3세대 의원 통원 1만5천원 → 5,000원", () => {
  const r = calculateProfile("gen3", { ...base, hospital: "clinic", coveredAmount: 15000, non: {} });
  assert.equal(r.payout, 5000);
});

console.log("\n[3] 입원 1,000만 + 일반 비급여 300만 (상급종합)");
const inp = { ...base, visit: "inpatient", hospital: "tertiary", coveredAmount: 10000000, non: { general: 3000000 } };
test("4세대 보험금 10,100,000원 (급여 20% + 비급여 30%)", () => {
  assert.equal(calculateProfile("gen4", inp).payout, 10100000);
});
test("4세대 급여 입원 자기부담 연 200만원 상한", () => {
  const r = calculateProfile("gen4", { ...inp, coveredAmount: 15000000, non: {} });
  assert.equal(r.items[0].payout, 13000000);
  assert.match(r.items[0].reason, /연 2,000,000원/);
});
test("5세대(비중증) 보험금 9,500,000원 (비급여 50%)", () => {
  assert.equal(calculateProfile("gen5", inp).payout, 9500000);
});
test("5세대(중증) 보험금 10,100,000원 (비급여 30%)", () => {
  assert.equal(calculateProfile("gen5", { ...inp, severity: "severe" }).payout, 10100000);
});
test("5세대 중증 비급여 상급종합 입원 500만원 자기부담 상한", () => {
  const r = calculateProfile("gen5", { ...inp, severity: "severe", coveredAmount: 0, non: { general: 20000000 } });
  assert.equal(r.payout, 15000000);
  assert.match(r.items[0].reason, /5,000,000원/);
});
test("유병력자 입원 최소 자기부담 10만원", () => {
  const r = calculateProfile("chronic", { ...base, visit: "inpatient", coveredAmount: 300000, non: {} });
  assert.equal(r.payout, 200000);
});

console.log("\n[4] 검증 보고서 P0 반례 11건 — 약관 값으로 돌아왔는지");
test("A-1 4세대 3대 비급여 분리: 360,000 → 430,000", () => {
  assert.equal(calculateProfile("gen4", base).payout, 430000);
});
test("A-1b 4세대 입원 도수 700만 → 연 한도 350만", () => {
  const r = calculateProfile("gen4", { ...base, visit: "inpatient", coveredAmount: 0, non: { physical: 7000000 } });
  const ph = r.items.find((i) => i.key === "physical");
  assert.equal(ph.payout, 3500000);
  assert.equal(ph.capped, 1400000);
});
test("A-2 5세대 비중증 MRI는 통원 20만 한도 밖: 의원 일반 20만+MRI 50만 → 350,000", () => {
  const r = calculateProfile("gen5", { ...base, hospital: "clinic", coveredAmount: 0, non: { general: 200000, mri: 500000 } });
  assert.equal(r.payout, 350000);
});
test("A-3 5세대 공단부담금 입력 → 실측 건보율(40%)", () => {
  const r = calculateProfile("gen5", { ...base, hospital: "hospital", coveredAmount: 200000, coPayment: 300000, non: {} });
  const cov = r.items.find((i) => i.key === "covered");
  assert.equal(cov.deductible, 80000);
  assert.equal(cov.payout, 120000);
});
test("A-3b 5세대 중증 비급여라도 산정특례 미체크면 병원 등급 건보율(종합 50%)", () => {
  const r = calculateProfile("gen5", { ...base, severity: "severe", coveredAmount: 200000, non: {} });
  assert.equal(r.items.find((i) => i.key === "covered").deductible, 100000);
});
test("A-3c 5세대 산정특례 체크 → 20% 하한(40,000원)", () => {
  const r = calculateProfile("gen5", { ...base, severity: "severe", special: true, coveredAmount: 200000, non: {} });
  assert.equal(r.items.find((i) => i.key === "covered").deductible, 40000);
});
test("A-3d 산정특례는 비급여 중증 공제율(30%)을 바꾸지 않는다", () => {
  const off = calculateProfile("gen5", { ...base, severity: "severe", coveredAmount: 0, non: { general: 1000000 } }).payout;
  const on = calculateProfile("gen5", { ...base, severity: "severe", special: true, coveredAmount: 0, non: { general: 1000000 } }).payout;
  assert.equal(off, on);
});
test("A-4 5세대 500만 상한 모수 = 일반+MRI (도수·주사 제외): 2,100만 → 1,920만", () => {
  const r = calculateProfile("gen5", {
    ...base,
    visit: "inpatient",
    hospital: "tertiary",
    severity: "severe",
    coveredAmount: 0,
    non: { general: 20000000, physical: 3500000, injection: 2500000, mri: 0 },
  });
  assert.equal(r.payout, 19200000);
});
test("A-5 3세대 3대 비급여 입원에도 2만원 공제: 도수 5만 → 30,000", () => {
  const r = calculateProfile("gen3", { ...base, visit: "inpatient", coveredAmount: 0, non: { physical: 50000 } });
  assert.equal(r.payout, 30000);
});
test("A-6 2세대 선택형Ⅱ는 급여 10%·비급여 20%", () => {
  const r = calculateProfile("gen2", { ...base, coveredAmount: 100000, non: { general: 100000 }, variant23: "sel2" });
  assert.equal(r.payout, 160000); // 공제 20,000(최소공제)+20,000(비급여 20%)
  const sel1 = calculateProfile("gen2", { ...base, coveredAmount: 100000, non: { general: 100000 }, variant23: "selective" });
  assert.equal(sel1.payout, 170000);
});
test("A-7 1세대 입원 연 200만원 초과분 환급 없음: 생보 1,500만 → 1,200만", () => {
  const r = calculateProfile("gen1l", { ...base, visit: "inpatient", coveredAmount: 15000000, non: {} });
  assert.equal(r.payout, 12000000);
});
test("A-8 1세대 통원 정액 5천~1만원·회당 한도: 손보 급여 100만 → 300,000", () => {
  const r = calculateProfile("gen1d", { ...base, visit: "outpatient", coveredAmount: 1000000, non: {} });
  assert.equal(r.payout, 300000);
});
test("A-9 유병력자 입원 자기부담 연 200만원 상한: 1,000만 → 800만", () => {
  const r = calculateProfile("chronic", { ...base, visit: "inpatient", coveredAmount: 10000000, non: {} });
  assert.equal(r.payout, 8000000);
});
test("A-10 5세대 중증 3대 비급여도 3만원 공제: 일반 10만 → 70,000", () => {
  const r = calculateProfile("gen5", { ...base, visit: "inpatient", hospital: "general", severity: "severe", coveredAmount: 0, non: { general: 100000 } });
  assert.equal(r.payout, 70000);
});
test("A-11 상급병실료 차액 50%·1일 10만원 한도: 30만·1일 → 50,000", () => {
  const r = calculateProfile("gen4", { ...base, visit: "inpatient", coveredAmount: 0, non: {}, room: 300000, roomDays: 1 });
  assert.equal(r.payout, 50000);
  const r3d = calculateProfile("gen4", { ...base, visit: "inpatient", coveredAmount: 0, non: {}, room: 300000, roomDays: 3 });
  assert.equal(r3d.payout, 150000);
});

console.log("\n[5] 전액본인부담·처방조제·선택형");
test("4세대 통원 전액본인부담은 보상 제외", () => {
  const r = calculateProfile("gen4", { ...base, coveredKind: "full", non: {} });
  assert.equal(r.payout, 0);
  assert.match(r.notes.join(" "), /전액본인부담/);
});
test("3세대 통원 전액본인부담은 보상 대상", () => {
  const r = calculateProfile("gen3", { ...base, coveredKind: "full", non: {} });
  assert.equal(r.payout, 160000);
});
test("4세대 입원 전액본인부담은 보상 대상", () => {
  const r = calculateProfile("gen4", { ...base, visit: "inpatient", coveredKind: "full", coveredAmount: 1000000, non: {} });
  assert.equal(r.payout, 800000);
});
test("2세대 처방조제는 8천원 정액 공제", () => {
  const r = calculateProfile("gen2", { ...base, coveredAmount: 100000, prescription: 20000, non: {} });
  assert.equal(r.payout, 92000); // 공제 max(2만, 2만)+8천 = 2.8만
});
test("유병력자는 처방조제비를 보장하지 않는다", () => {
  const r = calculateProfile("chronic", { ...base, coveredAmount: 100000, prescription: 20000, non: {} });
  assert.equal(r.items.find((i) => i.key === "prescription").payout, 0);
});
test("2세대 선택형(10%)은 표준형(20%)보다 보험금이 많다", () => {
  const small = { ...base, coveredAmount: 300000, non: {} };
  const std = calculateProfile("gen2", small);
  const sel = calculateProfile("gen2", { ...small, variant23: "selective" });
  assert.equal(std.payout, 240000);
  assert.equal(sel.payout, 270000);
});
test("3세대 선택형Ⅱ는 급여 10%로 계산", () => {
  const small = { ...base, coveredAmount: 300000, non: {} };
  const std = calculateProfile("gen3", small);
  const sel = calculateProfile("gen3", { ...small, variant23: "sel2" });
  assert.equal(std.payout, 240000);
  assert.equal(sel.payout, 270000);
});
test("2세대 2013.1 이전 판은 정액 공제만(20% 비교 없음)", () => {
  const r = calculateProfile("gen2", { ...base, coveredAmount: 300000, non: {}, gen2Early: true });
  assert.equal(r.payout, 280000); // 공제 2만원
});
test("5세대 비중증은 일반 비급여와 MRI를 따로 센다(합계 40만)", () => {
  const r = calculateProfile("gen5", { ...base, coveredAmount: 0, non: { general: 300000, mri: 500000 } });
  assert.equal(r.payout, 400000);
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
  assert.match(m, /430,000원/);
});
test("병원비가 0원이면 보험금도 0원", () => {
  const r = calculateProfile("gen4", { ...base, coveredAmount: 0, non: {} });
  assert.equal(r.payout, 0);
  assert.equal(r.self, 0);
});
test("세대가 뒤로 갈수록 같은 병원비에서 보험금이 줄어든다(4→5세대, 비중증)", () => {
  assert.ok(calculateProfile("gen4", base).payout > calculateProfile("gen5", base).payout);
});
test("병원비 합계에 상급병실료 차액이 들어간다", () => {
  const r = compare({ ...base, room: 200000, roomDays: 2 });
  assert.equal(r.total, 800000);
});

console.log("\n[7] 처방조제만 넣은 통원 · 입원 전환 (2026-11-27 교차검증)");
/* 약국 10,000원만 입력 — 외래 병원비 0원. 외래 공제는 min(외래비, max(정액, 비율)) = 0,
   처방조제는 min(10,000, 8,000) = 8,000 만 빼서 2,000원이 남아야 한다. */
const pharmOnly = { ...base, coveredKind: "partial", coveredAmount: 0, non: {}, prescription: 10000 };
test("2세대 표준형: 약국 10,000원만 → 2,000원", () => {
  const r = compare(pharmOnly);
  const g2 = r.rows.find((x) => x.id === "gen2");
  assert.equal(g2.payout, 2000);
  assert.equal(g2.deductible, 8000);
  assert.equal(r.total, 10000);
});
test("2세대 선택형Ⅰ: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen2", { ...pharmOnly, variant23: "selective" }).payout, 2000));
test("2세대 선택형Ⅱ: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen2", { ...pharmOnly, variant23: "sel2" }).payout, 2000));
test("2세대 2013.1 이전 판: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen2", { ...pharmOnly, gen2Early: true }).payout, 2000));
test("3세대 표준형: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen3", pharmOnly).payout, 2000));
test("3세대 선택형Ⅰ: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen3", { ...pharmOnly, variant23: "selective" }).payout, 2000));
test("3세대 선택형Ⅱ: 약국 10,000원만 → 2,000원", () => assert.equal(calculateProfile("gen3", { ...pharmOnly, variant23: "sel2" }).payout, 2000));
test("2·3세대 상세 설명에 '외래 공제 미적용'을 적는다", () => {
  assert.match(calculateProfile("gen2", pharmOnly).items[0].reason, /외래 병원비가 0원/);
  assert.match(calculateProfile("gen3", pharmOnly).items[0].reason, /외래 병원비가 0원/);
});
test("외래 정액은 비급여에 붙지 않는다 — 2세대 일반 비급여 10만만 → 80,000원", () => {
  const r = calculateProfile("gen2", { ...base, coveredAmount: 0, non: { general: 100000 } });
  assert.equal(r.deductible, 20000);
  assert.equal(r.payout, 80000);
});
test("외래 정액은 비급여에 붙지 않는다 — 3세대 일반 비급여 10만만 → 80,000원", () => {
  const r = calculateProfile("gen3", { ...base, coveredAmount: 0, non: { general: 100000 } });
  assert.equal(r.deductible, 20000);
  assert.equal(r.payout, 80000);
});
/* 나머지 세대도 외래 0·처방만일 때 모순(0원 지급·음수·이중 공제)이 없는지 */
test("4세대: 약국 10,000원만 → 0원 (최소 공제 1만원, 약관대로)", () => {
  const r = calculateProfile("gen4", pharmOnly);
  assert.equal(r.deductible, 10000);
  assert.equal(r.payout, 0);
});
test("5세대: 약국 10,000원만 → 0원 (최소 공제 1만원, 약관대로)", () => assert.equal(calculateProfile("gen5", pharmOnly).payout, 0));
test("유병력자: 처방조제비는 보장 제외 → 0원", () => assert.equal(calculateProfile("chronic", pharmOnly).payout, 0));
test("1세대: 약국 10,000원만 → 약국 정액 8,000원을 빼고 2,000원", () => {
  const r = compare(pharmOnly);
  for (const id of ["gen1d", "gen1l"]) {
    const row = r.rows.find((x) => x.id === id);
    assert.equal(row.deductible, 8000, `${id}: 공제`);
    assert.equal(row.payout, 2000, `${id}: 보험금`);
  }
});
/* 입원으로 바꾸면 통원에서 넣어 둔 처방조제비가 합계·상세에 남지 않는다 */
test("입원 전환 — 처방조제비 0으로 정규화, 병원비 합계에 안 들어감", () => {
  const r = compare({ ...base, visit: "inpatient", coveredAmount: 10000000, prescription: 8000, non: {} });
  assert.equal(r.input.prescription, 0);
  assert.equal(r.total, 10000000);
});
test("입원 전환 — 7개 세대 모두 처방조제 항목이 사라진다", () => {
  for (const id of ["gen1d", "gen1l", "gen2", "gen3", "gen4", "gen5", "chronic"]) {
    const r = calculateProfile(id, { ...base, visit: "inpatient", coveredAmount: 10000000, prescription: 8000, non: {} });
    assert.ok(!r.items.some((i) => i.key === "prescription"), `${id}: 처방조제 항목이 남았습니다`);
    assert.equal(r.base, 10000000, `${id}: 보장대상 합계에 처방조제비가 섞였습니다`);
  }
});
test("입원 → 통원으로 되돌리면 처방조제비가 다시 계산된다", () => {
  const out = calculateProfile("gen2", pharmOnly);
  const inp = compare({ ...pharmOnly, visit: "inpatient" });
  assert.equal(out.payout, 2000);
  assert.equal(inp.rows.find((x) => x.id === "gen2").payout, 0);
  assert.equal(inp.input.prescription, 0);
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
