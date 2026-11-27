#!/usr/bin/env node
/**
 * 진료자료 활용 동의서 — 엔진 단위 테스트.
 *
 *   node scripts/test_disclosure_consent.mjs
 *
 * 검사 항목
 *  1. 연락처 자동 서식·휴대폰 판별
 *  2. 생년월일 정리(8자리·6자리·점/슬래시)와 실재하지 않는 날짜·미래 날짜 거르기
 *  3. 만 나이 계산(기준일 고정)
 *  4. 작성 완료 조건 — 성명·연락처·생년월일·필수 2개·서명
 *  5. 동의번호 형식과 한국 시간 날짜
 *  6. 요약·안내 문구에 들어가야 하는 값(동의번호·보관기간·가상 예시 경고)
 *  7. 다섯 약속·동의 항목 구성(필수 2·선택 1)
 */
import assert from "node:assert/strict";
import {
  CONSENT_ITEMS,
  CONSENT_FORM_VERSION,
  PROMISES,
  ageFromBirth,
  buildGuide,
  buildSummary,
  formatDateKo,
  formatDateTimeKo,
  formatPhone,
  isValidPhone,
  makeConsentNo,
  normalizeBirth,
  safeFilePart,
  todayKo,
  validateConsent,
} from "../src/lib/consent/engine.js";

let passed = 0;
const fail = [];
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
  } catch (e) {
    fail.push({ name, error: String(e?.message ?? e) });
  }
};

const TODAY = new Date("2026-11-27T12:00:00+09:00");
const valid = {
  name: "홍길동",
  phone: "010-1234-5678",
  birth: "1981-08-23",
  checks: { privacy: true, sensitive: true, contact: false },
  hasSignature: true,
};

/* 1. 연락처 */
check("formatPhone 11자리", () => assert.equal(formatPhone("01012345678"), "010-1234-5678"));
check("formatPhone 자릿수 부족", () => assert.equal(formatPhone("0101234"), "010-1234"));
check("formatPhone 4자리", () => assert.equal(formatPhone("0101"), "010-1"));
check("formatPhone 숫자만 남김", () => assert.equal(formatPhone("010-1234-5678 (집)"), "010-1234-5678"));
check("formatPhone 빈 값", () => assert.equal(formatPhone(""), ""));
check("isValidPhone 휴대폰", () => assert.equal(isValidPhone("010-1234-5678"), true));
check("isValidPhone 옛 번호", () => assert.equal(isValidPhone("011-123-4567"), true));
check("isValidPhone 유선", () => assert.equal(isValidPhone("02-123-4567"), false));
check("isValidPhone 자리수 부족", () => assert.equal(isValidPhone("010123456"), false));

/* 2. 생년월일 */
check("birth YYYY-MM-DD", () => assert.equal(normalizeBirth("1981-08-23", TODAY), "1981-08-23"));
check("birth 점 구분", () => assert.equal(normalizeBirth("1981.8.23", TODAY), "1981-08-23"));
check("birth 슬래시 구분", () => assert.equal(normalizeBirth("1981/08/23", TODAY), "1981-08-23"));
check("birth 8자리", () => assert.equal(normalizeBirth("19810823", TODAY), "1981-08-23"));
check("birth 6자리 1900년대", () => assert.equal(normalizeBirth("810823", TODAY), "1981-08-23"));
check("birth 6자리 2000년대", () => assert.equal(normalizeBirth("050101", TODAY), "2005-01-01"));
check("birth 없는 날짜", () => assert.equal(normalizeBirth("1981-02-30", TODAY), ""));
check("birth 미래", () => assert.equal(normalizeBirth("2027-01-01", TODAY), ""));
check("birth 6자리 미래", () => assert.equal(normalizeBirth("261231", TODAY), ""));
check("birth 1900년 이전", () => assert.equal(normalizeBirth("1899-12-31", TODAY), ""));
check("birth 빈 값", () => assert.equal(normalizeBirth("", TODAY), ""));
check("birth 7자리 무시", () => assert.equal(normalizeBirth("1981082", TODAY), ""));

/* 3. 나이 */
check("age 1981-08-23", () => assert.equal(ageFromBirth("1981-08-23", TODAY), 45));
check("age 생일 전", () => assert.equal(ageFromBirth("1981-12-31", TODAY), 44));
check("age 생일 당일", () => assert.equal(ageFromBirth("1981-11-27", TODAY), 45));
check("age 생일 다음날", () => assert.equal(ageFromBirth("1981-11-26", TODAY), 45));
check("age 무효", () => assert.equal(ageFromBirth("", TODAY), null));

/* 4. 작성 완료 조건 */
check("유효한 작성", () => {
  const r = validateConsent(valid, TODAY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalized, { name: "홍길동", phone: "010-1234-5678", birth: "1981-08-23" });
});
check("성명 없음", () => {
  const r = validateConsent({ ...valid, name: " " }, TODAY);
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
});
check("성명 한 글자", () => {
  const r = validateConsent({ ...valid, name: "김" }, TODAY);
  assert.ok(r.errors.name);
});
check("성명 숫자", () => {
  const r = validateConsent({ ...valid, name: "홍길동1" }, TODAY);
  assert.ok(r.errors.name);
});
check("연락처 유선", () => {
  const r = validateConsent({ ...valid, phone: "02-123-4567" }, TODAY);
  assert.ok(r.errors.phone);
});
check("생년월일 무효", () => {
  const r = validateConsent({ ...valid, birth: "1981-02-30" }, TODAY);
  assert.ok(r.errors.birth);
});
check("필수 동의 누락", () => {
  const r = validateConsent({ ...valid, checks: { privacy: true, sensitive: false, contact: true } }, TODAY);
  assert.equal(r.ok, false);
  assert.ok(r.errors.required);
});
check("선택 동의만 없으면 통과", () => {
  const r = validateConsent({ ...valid, checks: { privacy: true, sensitive: true, contact: false } }, TODAY);
  assert.equal(r.ok, true);
});
check("서명 없음", () => {
  const r = validateConsent({ ...valid, hasSignature: false }, TODAY);
  assert.equal(r.ok, false);
  assert.ok(r.errors.signature);
});
check("6자리 생년월일도 통과", () => {
  const r = validateConsent({ ...valid, birth: "810823" }, TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.normalized.birth, "1981-08-23");
});

/* 5. 동의번호·날짜 */
check("동의번호 형식", () => {
  const no = makeConsentNo("2026-11-27T03:00:00Z", () => 0);
  assert.equal(no, "DC-20261127-0000");
  assert.match(makeConsentNo("2026-11-27T03:00:00Z"), /^DC-\d{8}-[0-9A-Z]{4}$/);
});
check("한국 시간 날짜", () => assert.equal(todayKo(new Date("2026-11-27T16:30:00Z")), "2026-11-28"));
check("한국 시간 날짜(밤)", () => assert.equal(todayKo(new Date("2026-11-27T14:30:00Z")), "2026-11-27"));
check("날짜 표기", () => assert.equal(formatDateKo("2026-11-27"), "2026년 11월 27일"));
check("일시 표기 KST", () => assert.equal(formatDateTimeKo("2026-11-27T06:04:00Z"), "2026년 11월 27일 15:04"));

/* 6. 요약·안내 */
const record = {
  no: "DC-20261127-AB12",
  at: "2026-11-27T06:04:00Z",
  name: "홍길동",
  phone: "010-1234-5678",
  birth: "1981-08-23",
  checks: { privacy: true, sensitive: true, contact: false },
  hasSignature: true,
  example: false,
};
check("요약에 핵심 값", () => {
  const s = buildSummary(record);
  for (const t of ["DC-20261127-AB12", "2026년 11월 27일 15:04", "홍길동", "010-1234-5678", "미동의(선택)", "30일"]) {
    assert.ok(s.includes(t), `요약에 '${t}' 없음`);
  }
});
check("가상 예시 경고", () => {
  const s = buildSummary({ ...record, example: true });
  assert.ok(s.includes("가상 예시"));
  assert.ok(s.includes("효력"));
});
check("안내 문구에 주소·약속", () => {
  const g = buildGuide(record, "https://buffetkimz.com/apps/disclosure-consent/run/");
  assert.ok(g.includes("https://buffetkimz.com/apps/disclosure-consent/run/"));
  assert.ok(g.includes("인증서·비밀번호는 받지 않습니다"));
  assert.ok(g.includes("30일"));
});
check("파일 이름 정리", () => {
  assert.equal(safeFilePart("홍 길동/테스트"), "홍길동테스트");
  assert.equal(safeFilePart(""), "고객");
});

/* 7. 구성 */
check("다섯 약속", () => {
  assert.equal(PROMISES.length, 5);
  assert.deepEqual(PROMISES.map((p) => p.no), [1, 2, 3, 4, 5]);
  assert.ok(PROMISES[1].title.includes("인증서"));
  assert.ok(PROMISES[4].title.includes("30일"));
});
check("필수 2·선택 1", () => {
  assert.equal(CONSENT_ITEMS.length, 3);
  assert.deepEqual(CONSENT_ITEMS.filter((i) => i.required).map((i) => i.key), ["privacy", "sensitive"]);
  assert.equal(CONSENT_ITEMS.filter((i) => !i.required)[0].key, "contact");
  const privacy = CONSENT_ITEMS[0];
  const keys = privacy.lines.map(([k]) => k);
  for (const k of ["목적", "항목", "보유기간", "거부권"]) assert.ok(keys.includes(k), `'${k}' 없음`);
});
check("서식 버전", () => assert.match(CONSENT_FORM_VERSION, /^\d{4}-\d{2}-\d{2}$/));

const total = passed + fail.length;
console.log(`\n진료자료 활용 동의서 단위 테스트 — ${passed}/${total} 통과`);
if (fail.length) {
  for (const f of fail) console.log(`  ✗ ${f.name} — ${f.error}`);
  process.exit(1);
}
console.log("PASS");
