#!/usr/bin/env node
/**
 * 보장분석 엔진 단위 테스트
 *
 *   node scripts/test_bojang_core.mjs
 *
 * 확인하는 것
 *  1. 금액 표기 읽기 — 만원·억·천만·백만, 단위 열(만원), 비율(%) 배제
 *  2. 담보 이름 분류 — 9개 그룹, 지급 방식(정액·일당·한도·비율)
 *  3. 표 파싱 — 탭·여러 칸 공백·단일 공백, 빈 가입금액(실손), 머리글의 만원 단위
 *  4. 그룹 합산 — 정액만 합계, 일당·한도는 따로, 실손 세대(담보명·계약일)
 *  5. 확인할 점 — 빠진 핵심 담보, 유사암만 있는 경우, 금액 미확인
 *  6. 기존 vs 제안 비교 — 그룹 증감·보험료 차이·신규/삭제
 *  7. 실손 세대 경계일이 실손 계산 엔진(silson)과 같은지 — 날짜 60개 대조
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SAMPLES,
  buildBookHTML,
  buildCSV,
  buildMessage,
  classify,
  compare,
  compareLines,
  estimatePaidTotal,
  formatMan,
  normalizeRows,
  parsePayYears,
  parseAmount,
  parseJSON,
  parseText,
  readDocument,
  silsonGeneration,
  summarize,
} from "../src/lib/bojang/engine.js";
import { generationFromDate } from "../src/lib/silson/engine.js";
import { INSURERS, INSURER_CHECKED_AT } from "../src/lib/bojang/insurers.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];

function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fails.push(`${label}\n    기대 ${e}\n    실제 ${a}`);
  }
}
function ok(label, cond, detail = "") {
  if (cond) pass++;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. 금액 ── */
eq("1,000만원", parseAmount("1,000만원"), 10000000);
eq("3천만원", parseAmount("3천만원"), 30000000);
eq("1억", parseAmount("1억"), 100000000);
eq("1억 5,000만원", parseAmount("1억 5,000만원"), 150000000);
eq("5백만원", parseAmount("5백만원"), 5000000);
eq("3만원", parseAmount("3만원"), 30000);
eq("1만 5천원", parseAmount("1만 5천원"), 15000);
eq("100백만", parseAmount("100백만"), 100000000);
eq("50,000,000원", parseAmount("50,000,000원"), 50000000);
eq("만원 열 3,000", parseAmount("3,000", { unit: "만원" }), 30000000);
eq("원 열 3,000", parseAmount("3,000", { unit: "원" }), 3000);
eq("비율 3~100%", parseAmount("3~100%"), null);
eq("빈 문자열", parseAmount(""), null);
eq("글자만", parseAmount("없음"), null);
eq("전각 숫자", parseAmount("１，０００만원"), 10000000);
eq("0원", parseAmount("0원"), null);

/* ── 2. 표기 ── */
eq("formatMan 1,000만", formatMan(10000000), "1,000만원");
eq("formatMan 1억 5,000만", formatMan(150000000), "1억 5,000만원");
eq("formatMan 3만", formatMan(30000), "3만원");
eq("formatMan 9,000", formatMan(9000), "9,000원");
eq("formatMan 1억", formatMan(100000000), "1억원");
eq("formatMan null", formatMan(null), "-");

/* ── 3. 분류 ── */
const C = (n) => {
  const c = classify(n);
  return [c.group, c.kind];
};
eq("암진단비", C("암진단비"), ["cancer", "lump"]);
eq("유사암진단비", C("유사암진단비"), ["cancer", "lump"]);
eq("갑상선암진단비", C("갑상선암진단비"), ["cancer", "lump"]);
eq("표적항암약물허가치료비", C("표적항암약물허가치료비"), ["cancer", "lump"]);
eq("암수술비", C("암수술비"), ["cancer", "lump"]);
eq("암입원일당", C("암입원일당"), ["cancer", "daily"]);
eq("뇌혈관질환진단비", C("뇌혈관질환진단비"), ["brain", "lump"]);
eq("허혈성심장질환진단비", C("허혈성심장질환진단비"), ["brain", "lump"]);
eq("급성심근경색증", C("급성심근경색증"), ["brain", "lump"]);
eq("질병수술비", C("질병수술비"), ["surgery", "lump"]);
eq("상해수술비", C("상해수술비"), ["surgery", "lump"]);
eq("질병수술비(1~5종)", C("질병수술비(1~5종)"), ["surgery", "lump"]);
eq("질병입원일당", C("질병입원일당"), ["hospital", "daily"]);
eq("상해입원일당", C("상해입원일당"), ["hospital", "daily"]);
eq("간병인사용일당", C("간병인사용일당"), ["hospital", "daily"]);
eq("중증치매진단비", C("중증치매진단비"), ["hospital", "lump"]);
eq("실손의료비(4세대)", C("실손의료비(4세대)"), ["silson", "limit"]);
eq("실비보험", C("실비보험"), ["silson", "limit"]);
eq("교통사고처리지원금", C("교통사고처리지원금"), ["driver", "lump"]);
eq("변호사선임비용", C("변호사선임비용"), ["driver", "lump"]);
eq("일상생활배상책임", C("일상생활배상책임"), ["liability", "limit"]);
eq("질병사망", C("질병사망"), ["death", "lump"]);
eq("재해사망", C("재해사망"), ["death", "lump"]);
eq("후유장해(3~100%)", C("후유장해(3~100%)"), ["death", "rate"]);
eq("치아보철", C("치아보철"), ["etc", "lump"]);
ok("분류 근거(rule) 남김", classify("암진단비").rule === "cancer");
ok("꼬리표(수술)", classify("암수술비").tags.includes("surgery"));

/* ── 4. 표 파싱 ── */
const doc = readDocument(SAMPLES.before);
eq("샘플 담보 수", doc.rowCount, 11);
eq("샘플 월 보험료", doc.premium, 49100);
eq("실손 가입금액 없음", doc.coverages.find((c) => c.group === "silson").amount, null);
eq("실손 보험료", doc.coverages.find((c) => c.group === "silson").premium, 18400);
eq("암진단비 금액", doc.coverages.find((c) => c.name === "암진단비").amount, 20000000);

const one = readDocument("암진단비 3,000만원 12,000원");
eq("한 줄 읽기", [one.rowCount, one.coverages[0].amount, one.coverages[0].premium], [1, 30000000, 12000]);

const wide = readDocument("담보명   가입금액   월보험료\n암진단비   5,000만원   21,000원\n실손의료비   　  18,400원");
eq("여러 칸 공백", wide.rowCount, 2);
eq("여러 칸 공백 금액", wide.coverages[0].amount, 50000000);

const man = readDocument("담보명\t가입금액(만원)\t보험료\n뇌혈관질환진단비\t2,000\t7,600원");
eq("만원 단위 열", man.coverages[0].amount, 20000000);

const pct = readDocument("후유장해\t가입금액의 3~100%\t1,000원");
eq("비율 담보 방식", pct.coverages[0].kind, "rate");
eq("비율 담보 금액 없음", pct.coverages[0].amount, null);

const sums = parseText("보험료 합계 49,100원\n암진단비 1,000만원 9,800원");
eq("보험료 합계 줄", readDocument("보험료 합계 49,100원\n암진단비 1,000만원 9,800원").premium, 49100);
ok("합계 줄 인식", sums.sawPremiumLabel === true);

/* ── 5. 요약 ── */
const s = summarize(doc.coverages, { premium: doc.premium, label: "보유", contracts: 3 });
const G = Object.fromEntries(s.groups.map((g) => [g.id, g]));
eq("암 정액 합계", G.cancer.lump, 25000000);
eq("뇌·심 정액 합계", G.brain.lump, 20000000);
eq("수술 정액 합계", G.surgery.lump, 4000000);
eq("사망 정액 합계", G.death.lump, 60000000);
eq("입원 일당 합계 제외", G.hospital.lump, 0);
eq("입원 일당 금액", G.hospital.daily[0].amount, 30000);
eq("실손 한도 합계 제외", G.silson.lump, 0);
eq("실손 세대", [s.silson.generation, s.silson.from], ["gen4", "담보명"]);
eq("월 보험료", s.premium, 49100);
ok("확인 필요 없음(샘플은 핵심 담보 모두 있음)", s.checks.every((c) => c.level !== "check"), JSON.stringify(s.checks));

const withTarget = summarize(doc.coverages, { targets: { cancer: 50000000, brain: 20000000 } });
eq("기준 대비 암", withTarget.groups.find((g) => g.id === "cancer").level, "low");
eq("기준 대비 뇌·심", withTarget.groups.find((g) => g.id === "brain").level, "ok");

const partial = summarize(
  normalizeRows([
    { name: "유사암진단비", amount: 10000000 },
    { name: "뇌혈관질환진단비", amount: 10000000 },
  ]),
);
ok("유사암만 → 확인", partial.checks.some((c) => c.code === "cancer:no-general"));
ok("뇌만 → 확인", partial.checks.some((c) => c.code === "brain:partial"));
ok("실손 없음 → 확인", partial.checks.some((c) => c.code === "silson:none"));
ok("수술 없음 → 확인", partial.checks.some((c) => c.code === "missing:surgery"));

const noAmount = summarize(normalizeRows([{ name: "암진단비", amount: null }]));
ok("금액 미확인 → 확인", noAmount.checks.some((c) => c.code === "amount:missing"));

const byDate = summarize(normalizeRows([{ name: "실손의료비", startDate: "2019-05-01" }]));
eq("계약일로 세대", [byDate.silson.generation, byDate.silson.from], ["gen3", "계약일"]);

const dup = summarize(normalizeRows([{ name: "암진단비", amount: 10000000 }, { name: "암진단비", amount: 20000000 }]));
eq("같은 담보 합산", dup.groups.find((g) => g.id === "cancer").lump, 30000000);
ok("같은 담보 안내", dup.checks.some((c) => c.code === "duplicate"));

/* ── 6. 비교 ── */
const before = readDocument(SAMPLES.before).coverages;
const after = readDocument(SAMPLES.after).coverages;
const cmp = compare(before, after);
eq("비교 보험료 전", cmp.premium.before, 49100);
eq("비교 보험료 후", cmp.premium.after, 91800);
eq("비교 보험료 차", cmp.premium.delta, 42700);
const CG = Object.fromEntries(cmp.groups.map((g) => [g.id, g]));
eq("암 증감", CG.cancer.delta, 35000000);
eq("교통사고처리지원금 증감", CG.driver.delta, 130000000);
eq("간병 신규(일당)", CG.hospital.status, "same");
ok("변호사선임비용 신규", cmp.rows.some((r) => r.name === "변호사선임비용" && r.status === "new"));
ok("비교 문장", compareLines(cmp).some((l) => l.includes("월 보험료")));

/* ── 7. 문구 ── */
const msg = buildMessage(s, { name: "김가상" });
ok("문구에 이름", msg.includes("김가상님"));
ok("문구에 실손 4세대", msg.includes("4세대"));
ok("문구에 보험료", msg.includes("49,100원"));
ok("문구에 안내 문구", msg.includes("약관과 보험사 심사"));

/* ── 8. JSON ── */
const j = parseJSON(JSON.stringify({ coverages: [{ name: "암진단비", amount: 30000000 }] }));
eq("JSON 복원", [j.length, j[0].name, j[0].amount, j[0].group], [1, "암진단비", 30000000, "cancer"]);
eq("깨진 JSON", parseJSON("{nope").length, 0);
const jr = parseJSON({
  coverages: [{ name: "실손의료비", amount: null, kind: "limit", group: "silson", premium: 18400 }],
  keepGroup: true,
});
eq("저장본 그룹 유지", [jr[0].group, jr[0].kind], ["silson", "limit"]);

/* ── 9. 실손 세대 경계일 대조 ── */
let dateChecks = 0;
const dates = [];
for (let y = 2008; y <= 2027; y++) {
  for (const md of ["-01-01", "-04-01", "-05-05", "-05-06", "-06-30", "-07-01", "-09-30", "-10-01", "-12-31"]) {
    dates.push(`${y}${md}`);
  }
}
for (const d of dates) {
  const a = silsonGeneration(d);
  const b = generationFromDate(d);
  if ((a && a.id) !== (b && b.id)) fails.push(`실손 세대 불일치 ${d}: bojang=${a && a.id} silson=${b && b.id}`);
  else dateChecks++;
}
ok(`실손 세대 경계 ${dateChecks}/${dates.length}일 일치`, dateChecks === dates.length);
eq("경계 전날 2026-05-05", silsonGeneration("2026-05-05").id, "gen4");
eq("경계일 2026-05-06", silsonGeneration("2026-05-06").id, "gen5");
eq("잘못된 날짜", silsonGeneration("2026-13-40"), null);

/* ── 10. 보험사 연락처 자료 ── */
ok("보험사 18곳", INSURERS.length === 18, String(INSURERS.length));
ok("생명 9·손해 9", INSURERS.filter((i) => i.kind === "생명").length === 9 && INSURERS.filter((i) => i.kind === "손해").length === 9);
ok("모든 번호에 출처", INSURERS.every((i) => /^\d{3,4}-\d{3,4}(-\d{4})?$/.test(i.phone) && i.source.includes(".")));
ok("확인일", /^\d{4}-\d{2}-\d{2}$/.test(INSURER_CHECKED_AT));
const phones = INSURERS.map((i) => i.phone);
eq("전화번호 중복 없음", phones.length, new Set(phones).size);

/* ── 10. 2026-11-27 보완 — 세대 이름·진단비 분리·사망 분리·중복·기준 판정 ── */
const genName = readDocument("2세대 실손의료비\t\t18,400원");
eq("숫자로 시작하는 담보명 보존", genName.coverages[0].name, "2세대 실손의료비");
eq("숫자로 시작해도 세대 판정", genName.coverages[0] && summarize(genName.coverages).silson.generation, "gen2");

const mixed = summarize(normalizeRows([
  { name: "암진단비", amount: 30000000 },
  { name: "암수술비", amount: 5000000 },
  { name: "표적항암약물허가치료비", amount: 10000000 },
  { name: "유사암진단비", amount: 5000000 },
]));
const MC = mixed.groups.find((g) => g.id === "cancer");
eq("암 진단비에 수술비를 더하지 않는다", MC.lump, 35000000);
eq("암 수술비는 따로", MC.surgery, 5000000);
eq("암 치료비는 따로", MC.treatment, 10000000);
eq("일반암 합계", MC.generalCancer, 30000000);
eq("유사암 합계", MC.similarCancer, 5000000);
eq("진단비·수술비 분리 안내", mixed.checks.some((c) => c.code === "kind:diagnosis-split"), true);

const deathSum = summarize(normalizeRows([
  { name: "질병사망", amount: 100000000 },
  { name: "재해사망", amount: 50000000 },
  { name: "후유장해(3~100%)", amount: null },
]));
const DS = deathSum.groups.find((g) => g.id === "death");
eq("질병사망 분리", DS.deathDisease, 100000000);
eq("재해사망 분리", DS.deathAccident, 50000000);
eq("후유장해는 정액 합계에 없음", DS.lump, 150000000);

const dupSil = summarize(normalizeRows([
  { name: "실손의료비(2세대)", amount: null, kind: "limit" },
  { name: "실손의료비(4세대)", amount: null, kind: "limit" },
]));
ok("실손 2건 → 비례보상 경고", dupSil.checks.some((c) => c.code === "silson:duplicate"));
eq("실손 2건 경고 레벨", dupSil.checks.find((c) => c.code === "silson:duplicate").level, "check");

eq("통원은 입원·간병이 아니라 통원 그룹", classify("통원 1회당 1만원").group, "outpatient");

eq("통원 담보 그룹 합산", summarize(normalizeRows([{ name: "질병통원", amount: 10000 }])).groups.find((g) => g.id === "outpatient").lump, 10000);

const renewSum = summarize(normalizeRows([{ name: "암진단비(갱신형)", amount: 30000000, premium: 12000, payTerm: "20년납" }]));
eq("갱신 표기 읽기", renewSum.renew.count, 1);
ok("갱신형 안내", renewSum.checks.some((c) => c.code === "renew:count"));
eq("총납입보험료 추정", renewSum.paidTotal, 2880000);
const payParsed = readDocument("암진단비\t3,000만원\t20년납 100세만기\t12,000원");
ok("납입기간·만기 분리", payParsed.coverages[0].payTerm.includes("20") && payParsed.coverages[0].coverTerm.includes("100"));

/* 2026-11-27 화면 결함 — 표에서 읽은 뒤 보험료·납입기간을 손으로 고치면 총납입이 다시 계산되는지.
   (결함 재현: 첫 담보에 3,000원·20년납을 넣어도 '보험료·납입기간을 넣으면…' 문구가 남았다) */
eq("납입년수 읽기 — 20년납", parsePayYears("20년납"), 20);
eq("납입년수 읽기 — 빈 값", parsePayYears(""), null);
eq("총납입 추정 — 3,000원 × 20년", estimatePaidTotal(3000, "20년납"), 720000);
eq("총납입 추정 — 보험료 없음", estimatePaidTotal(null, "20년납"), null);
eq("총납입 추정 — 납입기간 없음", estimatePaidTotal(3000, ""), null);
eq("총납입 추정 — 납입기간만 있던 행에 보험료를 넣음", estimatePaidTotal(3000, "20년"), 720000);
const handRows = normalizeRows([{ name: "암진단비", amount: 30000000 }]);
handRows[0].premium = 3000;
handRows[0].payTerm = "20년납";
handRows[0].paidTotal = estimatePaidTotal(handRows[0].premium, handRows[0].payTerm);
eq("손으로 고친 행의 총납입", handRows[0].paidTotal, 720000);
eq("요약 합계도 따라옴", summarize(handRows).paidTotal, 720000);
eq("요약 합계 문구(만원)", formatMan(summarize(handRows).paidTotal), "72만원");

const low = summarize(normalizeRows([{ name: "암진단비", amount: 10000000 }]));
const okT = summarize(normalizeRows([{ name: "암진단비", amount: 30000000 }]));
const rich = summarize(normalizeRows([{ name: "암진단비", amount: 50000000 }]));
eq("기본 기준 — 1,000만은 매우 부족", low.groups.find((g) => g.id === "cancer").level, "vlow");
eq("기본 기준 — 3,000만은 적정", okT.groups.find((g) => g.id === "cancer").level, "ok");
eq("기본 기준 — 5,000만은 충분", rich.groups.find((g) => g.id === "cancer").level, "rich");
ok("판정 목록 노출", okT.judge.some((j) => j.id === "cancer" && j.levelLabel === "적정"));

const csv = buildCSV(doc.coverages, s);
ok("CSV 머리글", csv.startsWith("구분,담보,보장그룹"));
ok("CSV 에 담보", csv.includes("암진단비"));
ok("CSV 에 판정 행", csv.includes("판정"));
const book = buildBookHTML(s, { name: "김가상", at: "2026-11-27", insurers: INSURERS });
ok("증권북 표지", book.includes("김가상님 보장 정리"));
ok("증권북 보험사 번호", book.includes("1588-3114"));
ok("증권북 기준 판정", book.includes("기준 대비 판정"));

/* ── 11. 생성 파일이 원본과 같은지 ── */
const corePath = path.resolve(HERE, "../../insure-crm/bojang-core.js");
if (fs.existsSync(corePath)) {
  const src = fs.readFileSync(corePath, "utf8");
  ok("bojang-core.js 에 window.Bojang", src.includes("window.Bojang"));
  ok("bojang-core.js 에 통신 코드 없음", !/fetch\(|XMLHttpRequest|WebSocket/.test(src));
  ok("bojang-core.js 에 보험사 표", src.includes("1588-3114"));
} else {
  fails.push("apps/insure-crm/bojang-core.js 가 없습니다 — node scripts/build_bojang_core.mjs 로 만드세요.");
}

/* ── 결과 ── */
if (fails.length) {
  console.error(`\n실패 ${fails.length}건 / 통과 ${pass}건\n`);
  for (const f of fails) console.error(` ✗ ${f}`);
  process.exit(1);
}
console.log(`보장분석 엔진 테스트 통과 ${pass}/${pass}`);
