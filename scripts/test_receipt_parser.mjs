#!/usr/bin/env node
/**
 * 진료비 영수증 파서 단위 테스트.
 *
 *   node scripts/test_receipt_parser.mjs
 *
 * 검사 항목
 *  1. 표준 진료비 계산서·영수증(의원 외래 · 상급종합 입원 · 도수/주사 통원)
 *  2. 약국 약제비 영수증 — 본인부담금이 곧 처방조제비
 *  3. OCR 오인식(0→O, 1→l, 료→로) · 탭으로 나뉜 PDF 줄
 *  4. 병원 등급 4종 · 입원/통원 판별
 *  5. 비급여 합계에서 세부 항목(도수·주사·MRI·상급병실) 빼기
 *  6. 합계 검산 경고(불일치·총액 없음·금액 없음)
 *  7. 파싱 결과 → 계산 엔진 입력 변환(실제 계산까지 이어지는지)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReceiptLines, parseReceiptText, toSilsonInput, RECEIPT_SAMPLES } from "../src/lib/silson/receiptParser.js";
import { compare } from "../src/lib/silson/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../reports/buffetkimz-web/receipt-ocr-20261127");
fs.mkdirSync(OUT, { recursive: true });

const cases = [];
function test(name, fn) {
  try {
    fn();
    cases.push({ name, ok: true });
  } catch (e) {
    cases.push({ name, ok: false, error: e.message });
  }
}
const won = (n) => Number(n || 0);

const sample = (id) => RECEIPT_SAMPLES.find((s) => s.id === id);

/* ── 1. 표준 3종 ─────────────────────────────────────────────── */
test("가상① 의원 외래+처방 — 급여 12,000·처방조제 4,500·합계 16,500", () => {
  const r = parseReceiptLines(sample("clinic-cold").lines);
  assert.equal(r.ok, true);
  assert.equal(r.fields.visit, "outpatient");
  assert.equal(r.fields.hospital, "clinic");
  assert.equal(r.fields.coveredPartial, 12000);
  assert.equal(r.fields.prescription, 4500);
  assert.equal(r.fields.non.general, 0);
  assert.equal(r.fields.coPayment, 45000);
  assert.equal(r.meta.computed, 16500);
  assert.equal(r.meta.patientTotal, 16500);
  assert.equal(r.warnings.filter((w) => w.code === "sum_mismatch").length, 0);
});

test("가상② 상급종합 입원+MRI — 상급병실 500,000(2일)·MRI 700,000·일반 50,000", () => {
  const r = parseReceiptLines(sample("tertiary-mri").lines);
  assert.equal(r.fields.visit, "inpatient");
  assert.equal(r.fields.hospital, "tertiary");
  assert.equal(r.fields.coveredPartial, 850000);
  assert.equal(r.fields.non.mri, 700000);
  assert.equal(r.fields.room, 500000);
  assert.equal(r.fields.roomDays, 2);
  assert.equal(r.fields.non.general, 50000);
  assert.equal(r.meta.computed, 2100000);
  assert.equal(r.warnings.length, 0);
});

test("가상③ 도수·주사 통원 — 도수 130,000(2건 합산)·주사 25,000·일반 0", () => {
  const r = parseReceiptLines(sample("clinic-physical").lines);
  assert.equal(r.fields.coveredPartial, 9500);
  assert.equal(r.fields.non.physical, 130000);
  assert.equal(r.fields.non.injection, 25000);
  assert.equal(r.fields.non.general, 0);
  assert.equal(r.meta.computed, 164500);
  assert.equal(r.warnings.length, 0);
});

/* ── 2. 약국 ─────────────────────────────────────────────────── */
test("약국 약제비 영수증 — 본인부담금이 처방조제비로 (급여 본인부담 0)", () => {
  const r = parseReceiptLines([
    "온누리약국",
    "약제비 영수증",
    "교부번호: 2026-11-18-001",
    "처방조제비       8,500",
    "공단부담금      22,000",
    "본인부담금       8,500",
    "환자부담총액     8,500",
  ]);
  assert.equal(r.kind, "pharmacy");
  assert.equal(r.fields.prescription, 8500);
  assert.equal(r.fields.coveredPartial, 0);
  assert.equal(r.fields.coPayment, 22000);
  assert.equal(r.meta.computed, 8500);
  assert.equal(r.warnings.length, 0);
});

test("약국 영수증에 '본인부담금'만 있어도 처방조제비로 잡는다", () => {
  const r = parseReceiptLines(["행복약국", "약제비 영수증", "본인부담금  6,200", "공단부담금 14,000", "합계금액 6,200"]);
  assert.equal(r.fields.prescription, 6200);
  assert.equal(r.fields.coveredPartial, 0);
});

/* ── 3. OCR 오인식 · 탭 PDF ──────────────────────────────────── */
test("OCR 오인식(0→O, 1→l) 복원 — 12,000·45,000", () => {
  const r = parseReceiptLines([
    "한빛내과의원",
    "진료비 계산서·영수증",
    "진료구분 : 외래",
    "급여 본인부담금      l2,OOO",
    "공단부담금           45,OOO",
    "환자부담총액          l2,OOO",
  ]);
  assert.equal(r.fields.coveredPartial, 12000);
  assert.equal(r.fields.coPayment, 45000);
  assert.equal(r.meta.patientTotal, 12000);
  assert.equal(r.warnings.filter((w) => w.code === "sum_mismatch").length, 0);
});

test("항목 이름 오인식(료→로, 주사→주사)도 받는다", () => {
  const r = parseReceiptLines([
    "바른정형외과의원",
    "진료구분: 외래",
    "급여 본인부담금   10,000",
    "도수치로          80,000",
    "비급여 주사로      20,000",
    "비급여 합계       100,000",
    "환자부담총액      110,000",
  ]);
  assert.equal(r.fields.non.physical, 80000);
  assert.equal(r.fields.non.injection, 20000);
  assert.equal(r.meta.computed, 110000);
});

test("탭으로 나뉜 PDF 줄(구분·급여·비급여 3열)", () => {
  const r = parseReceiptLines([
    "세브란스병원 (상급종합병원)",
    "JINRYO CALCULATOR",
    "진료구분\t외래",
    "구분\t급여\t비급여",
    "본인부담금\t35,000\t420,000",
    "공단부담금\t120,000\t0",
    "환자부담총액\t455,000",
  ]);
  assert.equal(r.fields.coveredPartial, 35000);
  assert.equal(r.fields.non.general, 420000);
  assert.equal(r.fields.coPayment, 120000);
  assert.equal(r.meta.computed, 455000);
});

/* ── 4. 병원 등급 · 진료 구분 ────────────────────────────────── */
const gradeCase = (title, expected) => {
  const r = parseReceiptLines([title, "진료구분: 외래", "급여 본인부담금 10,000", "환자부담총액 10,000"]);
  assert.equal(r.fields.hospital, expected, title);
};
test("병원 등급 — 의원", () => gradeCase("튼튼소아청소년과의원", "clinic"));
test("병원 등급 — 병원", () => gradeCase("부천성모병원", "hospital"));
test("병원 등급 — 종합병원", () => gradeCase("가톨릭대학교 부천성모병원 (종합병원)", "general"));
test("병원 등급 — 상급종합", () => gradeCase("서울아산병원 (상급종합병원)", "tertiary"));

test("입원 판별 — '진료구분' 없이 '입원일수'만 있어도 입원", () => {
  const r = parseReceiptLines(["○○병원", "입원일수: 5일", "본인부담금 300,000", "환자부담총액 300,000"]);
  assert.equal(r.fields.visit, "inpatient");
});

test("외래 판별 — '외래' 문구", () => {
  const r = parseReceiptLines(["○○의원", "외래 진료", "본인부담금 8,000"]);
  assert.equal(r.fields.visit, "outpatient");
});

/* ── 5. 비급여 합계 − 세부 ──────────────────────────────────── */
test("비급여 합계만 있으면 전부 일반 비급여", () => {
  const r = parseReceiptLines(["○○의원", "진료구분: 외래", "급여 본인부담금 10,000", "비급여 합계 250,000", "환자부담총액 260,000"]);
  assert.equal(r.fields.non.general, 250000);
  assert.equal(r.meta.computed, 260000);
});

test("전액본인부담금 — 급여 전액본인부담 칸으로", () => {
  const r = parseReceiptLines(["○○의원", "진료구분: 외래", "전액본인부담금 30,000", "환자부담총액 30,000"]);
  assert.equal(r.fields.coveredFull, 30000);
  assert.equal(r.fields.coveredPartial, 0);
});

test("괄호 안 횟수·일수가 금액으로 잡히지 않는다(세부 항목은 가장 큰 수)", () => {
  const r = parseReceiptLines([
    "○○종합병원",
    "진료구분: 입원",
    "도수치료(10회 중 3회) 90,000",
    "상급병실료 차액 (1914), 22) 900,000",
    "환자담당총액 990,000",
  ]);
  assert.equal(r.fields.non.physical, 90000);
  assert.equal(r.fields.room, 900000);
});

test("상급병실 '특실' + 일수 표기", () => {
  const r = parseReceiptLines([
    "○○종합병원",
    "진료구분: 입원",
    "본인부담금 200,000",
    "특실료(1일) 150,000",
    "환자부담총액 350,000",
  ]);
  assert.equal(r.fields.room, 150000);
  assert.equal(r.fields.roomDays, 1);
});

/* ── 6. 검산 경고 ────────────────────────────────────────────── */
test("합계 불일치 경고 — 총액 100,000 vs 세부 90,000", () => {
  const r = parseReceiptLines(["○○의원", "급여 본인부담금 90,000", "환자부담총액 100,000"]);
  const w = r.warnings.find((x) => x.code === "sum_mismatch");
  assert.ok(w, "sum_mismatch 경고가 있어야 한다");
  assert.match(w.text, /10,000원/);
});

test("총액이 없으면 '검산 못 함' 경고", () => {
  const r = parseReceiptLines(["○○의원", "급여 본인부담금 90,000", "공단부담금 210,000"]);
  assert.equal(r.fields.coveredPartial, 90000);
  assert.ok(r.warnings.some((x) => x.code === "no_total"));
});

test("금액이 없으면 no_amounts 경고 + ok=false", () => {
  const r = parseReceiptLines(["○○의원", "진료비 계산서·영수증", "환자 성명: 홍길동"]);
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((x) => x.code === "no_amounts"));
});

test("빈 입력 — empty 경고", () => {
  const r = parseReceiptLines([]);
  assert.equal(r.ok, false);
  assert.equal(r.warnings[0].code, "empty");
});

/* ── 7. 근거(evidence)·신뢰도 ────────────────────────────────── */
test("값마다 원문 줄 근거와 신뢰도가 붙는다", () => {
  const r = parseReceiptLines(sample("clinic-cold").lines);
  const cp = r.items.find((i) => i.key === "coveredPartial");
  assert.ok(cp.evidence.includes("12,000"), `근거: ${cp.evidence}`);
  assert.ok(cp.confidence >= 0.9);
  const rx = r.items.find((i) => i.key === "prescription");
  assert.ok(rx.evidence.includes("처방조제비"));
  assert.ok(r.items.every((i) => i.confidence > 0 && i.confidence <= 1));
});

test("공단부담금·전액본인부담금도 항목 목록에 근거와 함께 남는다", () => {
  const r = parseReceiptLines(sample("clinic-cold").lines);
  const ins = r.items.find((i) => i.key === "coPayment");
  assert.ok(ins, "공단부담금 항목이 있어야 한다");
  assert.equal(ins.value, 45000);
  assert.ok(ins.evidence.includes("공단부담금"), ins.evidence);
  assert.ok(ins.confidence >= 0.9);

  const f = parseReceiptLines(["○○의원", "진료구분: 외래", "전액본인부담금 30,000", "환자부담총액 30,000"]);
  const full = f.items.find((i) => i.key === "coveredFull");
  assert.ok(full && full.value === 30000, "전액본인부담금 항목");
  assert.ok(full.evidence.includes("전액"));
});

test("비급여 합계에서 세부를 뺀 일반 비급여는 '계산값'으로 표시", () => {
  const r = parseReceiptLines([
    "○○병원",
    "진료구분: 외래",
    "급여 본인부담금 20,000",
    "비급여 합계 200,000",
    "MRI·MRA 150,000",
    "환자부담총액 220,000",
  ]);
  const g = r.items.find((i) => i.key === "nonGeneral");
  assert.equal(g.value, 50000);
  assert.ok(/합계|계산/.test(g.note || ""), `note: ${g.note}`);
  assert.equal(r.meta.computed, 220000);
});

/* ── 8. 엔진 연결 ────────────────────────────────────────────── */
test("파싱 결과 → 계산 엔진 입력 → 4세대 보험금이 계산된다", () => {
  const p = parseReceiptLines(sample("tertiary-mri").lines);
  const input = toSilsonInput(p, { primary: "gen4", visitCap: 200000 });
  assert.equal(input.visit, "inpatient");
  assert.equal(input.hospital, "tertiary");
  const r = compare(input);
  assert.equal(r.total, 2100000);
  assert.ok(r.primary.payout > 0, "보험금이 0보다 커야 한다");
});

test("약국 영수증 → 계산 엔진 입력 → 처방조제비만 있는 통원", () => {
  const p = parseReceiptLines(["○○약국", "약제비 영수증", "처방조제비 8,500", "본인부담금 8,500"]);
  const input = toSilsonInput(p, { primary: "gen4" });
  const r = compare(input);
  assert.equal(r.total, 8500);
  const covered = r.primary.items.find((i) => i.key === "covered" || i.key === "prescription");
  assert.ok(covered, "급여(처방조제) 항목이 있어야 한다");
  assert.match(covered.reason, /처방조제비/);
});

test("parseReceiptText — 줄바꿈 텍스트도 같은 결과", () => {
  const text = sample("clinic-physical").lines.join("\n");
  const a = parseReceiptText(text);
  const b = parseReceiptLines(sample("clinic-physical").lines);
  assert.deepEqual(a.fields, b.fields);
});

/* ── 결과 ───────────────────────────────────────────────────── */
const pass = cases.filter((c) => c.ok).length;
const fail = cases.filter((c) => !c.ok);

for (const c of cases) console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.ok ? "" : `\n    → ${c.error}`}`);
console.log(`\n${pass}/${cases.length} 통과`);

const report = {
  at: new Date().toISOString(),
  pass,
  total: cases.length,
  cases,
  samples: RECEIPT_SAMPLES.map((s) => {
    const r = parseReceiptLines(s.lines);
    return { id: s.id, name: s.name, fields: r.fields, summary: r.summary, warnings: r.warnings };
  }),
};
fs.writeFileSync(path.join(OUT, "parser-unit-test.json"), JSON.stringify(report, null, 2));

if (fail.length) {
  console.error(`\n실패 ${fail.length}건`);
  process.exit(1);
}
