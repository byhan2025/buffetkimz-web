/**
 * 진료비 영수증 파서 — 영수증에서 뽑은 '줄 목록'을 실손 계산기 입력칸으로 바꾼다.
 *
 * 쓰는 곳
 *  · buffetkimz.com   — `src/components/tools/SilsonCompare.tsx` 가 ES 모듈로 직접 import
 *  · InsureCRM        — `node scripts/build_receipt_core.mjs` 가 `apps/insure-crm/receipt-core.js`
 *                       (window.SilsonReceipt)로 옮긴다. 두 앱의 인식 결과가 갈라지면 안 된다.
 *
 * 하는 일
 *  · PDF에서 뽑은 글자 줄, 사진을 OCR로 읽은 줄 모두 **같은 모양**(문자열 배열)으로 받는다.
 *  · 대한민국 표준 '진료비 계산서·영수증'과 '약제비 영수증'의 항목 이름을 기준으로
 *    급여 일부본인부담금 / 급여 전액본인부담금 / 공단부담금 / 처방조제비 /
 *    일반 비급여 / 비급여 주사 / 도수·체외충격파 / MRI·MRA / 상급병실료 차액 / 입원일수를 찾는다.
 *  · 값마다 **원문 줄(evidence)과 신뢰도(confidence)** 를 함께 돌려준다 — OCR 오인식을 사용자가
 *    한눈에 보고 고칠 수 있어야 하기 때문이다.
 *  · 숫자 합계를 검산한다(환자부담총액 ≠ 세부 합계면 경고).
 *
 * 이 파일에는 DOM·통신 코드가 없다. 순수 함수만 둔다(테스트는 node에서 그대로 돌린다).
 */

export const RECEIPT_VERSION = "1.0.0";

/** 항목 이름 표기 기준 */
export const RECEIPT_SOURCE = "대한민국 표준 '진료비 계산서·영수증'·'약제비 영수증' 항목명";

/**
 * OCR이 자주 헷갈리는 글자 — 항목 이름을 찾을 때만 쓴다(숫자는 따로 보정한다).
 * 예: '료'를 '로'로, '약'을 '악'으로 읽는 경우.
 */
const CONF = {
  부: "[부무]",
  담: "[담닭]",
  금: "[금끔]",
  급: "[급금]",
  여: "[여어]",
  본: "[본본]",
  인: "[인언]",
  료: "[료로]",
  액: "[액엑]",
  약: "[약악]",
  주: "[주쭈]",
  사: "[사샤]",
  도: "[도되]",
  수: "[수슈]",
  병: "[병벙]",
  실: "[실싱]",
  차: "[차자]",
  전: "[전젼]",
  공: "[공꽁]",
  단: "[단딴]",
  제: "[제저]",
  조: "[조져]",
  처: "[처쳐]",
  방: "[방빵]",
  진: "[진짂]",
  의: "[의으]",
};

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 한글 단어 → OCR 오인식까지 받아 주는 정규식(글자 사이 공백 허용) */
function labelRe(word) {
  const body = [...word.replace(/\s+/g, "")].map((ch) => CONF[ch] || reEsc(ch)).join("\\s*");
  return new RegExp(body);
}

/** 라벨 비교용 — 공백·구두점을 지운 문자열 */
const squash = (s) => String(s || "").replace(/[\s|ㅣ:：.,·ㆍ'"`\-_~()[\]{}「」『』]/g, "");

/**
 * 숫자로 잘못 읽힌 글자 보정.
 * 앞(보정된 글자 포함)이나 뒤가 숫자·쉼표일 때만 바꾼다 — "MRI"의 I, "OPD"의 O는 건드리지 않는다.
 */
const NUM_FIX = {
  O: "0", o: "0", Q: "0", D: "0",
  l: "1", I: "1", "|": "1", "!": "1",
  S: "5", s: "5", B: "8", Z: "2", b: "6", G: "6", g: "9",
};
export function fixDigits(s) {
  const src = String(s ?? "");
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const p = out.slice(-1);
    const n = src[i + 1] || "";
    const near = /[\d,]/.test(p) || /[\d,]/.test(n);
    out += near && NUM_FIX[ch] ? NUM_FIX[ch] : ch;
  }
  // 전각 숫자·전각 쉼표
  return out.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10)).replace(/，/g, ",");
}

/** 표의 칸 — 탭 또는 2칸 이상 공백으로 나눈다 */
const splitCells = (line) =>
  String(line || "")
    .split(/\t+| {2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 금액 후보 — 3자리 이상이거나 쉼표가 있는 숫자('1인실'·'2일' 같은 작은 수는 뺀다) */
const AMT_RE = /\d[\d,]{1,}/g;
function amountsIn(s) {
  const out = [];
  const t = fixDigits(s);
  for (const m of t.matchAll(AMT_RE)) {
    const raw = m[0].replace(/,+$/, "");
    const digits = raw.replace(/,/g, "");
    if (digits.length < 3 && !raw.includes(",")) continue;
    const value = Number(digits);
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ value, raw: m[0], start: m.index ?? 0 });
  }
  return out;
}

/** 라벨을 지운 나머지 문자열 — 라벨의 '비공백 글자 수'만큼 원문에서 잘라 낸다 */
function cutAfterLabel(cell, re) {
  const sq = squash(cell);
  const m = sq.match(re);
  if (!m) return null;
  let i = 0;
  let k = 0;
  while (i < cell.length && k < m[0].length) {
    if (!/[\s|ㅣ:：.,·ㆍ'"`]/.test(cell[i])) k++;
    i++;
  }
  return cell.slice(i);
}

/**
 * 라벨이 있는 칸에서 금액을 찾는다 — 라벨 뒤 → 오른쪽 칸 → 줄 전체 순.
 *
 * pick
 *  · "first" — 요약 줄(본인부담금 12,000 | 45,000)은 칸 순서가 곧 항목 순서다.
 *  · "max"   — 세부 항목 줄(도수치료(10회 중 3회) 90,000 / 상급병실료 차액 (1인실, 2일) 500,000)은
 *              괄호 안 횟수·일수가 금액으로 잡히면 안 되므로 가장 큰 수를 금액으로 본다.
 */
function amountForLabel(line, res, pick = "first") {
  const cells = splitCells(line);
  for (let c = 0; c < cells.length; c++) {
    for (const re of res) {
      const rest = cutAfterLabel(cells[c], re);
      if (rest == null) continue;
      const own = amountsIn(rest);
      if (pick === "max") {
        /* 세부 항목 줄 — 라벨 뒤 칸들까지 모아 가장 큰 수를 금액으로 본다 */
        const all = own.slice();
        for (let k = c + 1; k < Math.min(cells.length, c + 3); k++) all.push(...amountsIn(cells[k]));
        if (all.length) {
          const best = all.reduce((a, b) => (b.value > a.value ? b : a));
          return { value: best.value, raw: cells[c] };
        }
      } else {
        if (own.length) return { value: own[0].value, raw: cells[c] };
        for (let k = c + 1; k < cells.length; k++) {
          const b = amountsIn(cells[k]);
          if (b.length) return { value: b[0].value, raw: `${cells[c]} ${cells[k]}`.trim() };
        }
      }
      const w = amountsIn(line);
      if (w.length) return { value: w[w.length - 1].value, raw: line };
      return { value: 0, raw: line };
    }
  }
  return null;
}

/**
 * 항목 규칙 — 배열 순서가 곧 우선순위다.
 * 위쪽(더 구체적인 이름)이 먼저 걸리므로 '환자부담총액'이 '본인부담금'으로 잡히지 않는다.
 *
 *  · put  : 한 값만 있는 항목(총액·본인부담금 등) — 신뢰도가 높은 쪽을 남긴다.
 *  · add  : 여러 줄이 합쳐지는 항목(도수치료 여러 건, 주사 여러 건) — 더한다.
 */
const RULES = [
  { key: "coveredFull", mode: "put", label: "급여 전액본인부담금", re: [labelRe("전액본인부담금"), labelRe("전액본인부담"), labelRe("전액 본인부담")] },
  { key: "insurerPaid", mode: "put", label: "공단부담금", re: [labelRe("공단부담금"), labelRe("공단부담"), labelRe("보험자부담금")] },
  { key: "patientTotal", mode: "put", label: "환자부담총액", re: [labelRe("환자부담총액"), labelRe("본인부담총액"), labelRe("환자부담금"), labelRe("수납금액"), labelRe("결제금액"), labelRe("납입금액"), labelRe("총수납금액")] },
  { key: "prescription", mode: "put", label: "처방조제비", re: [labelRe("처방조제비"), labelRe("처방조제"), labelRe("조제료"), labelRe("조제비"), labelRe("약제비"), labelRe("복약지도료")] },
  { key: "nonTotal", mode: "put", label: "비급여 합계", re: [labelRe("비급여합계"), labelRe("비급여계"), labelRe("비급여총액")] },
  { key: "generalExplicit", mode: "put", label: "기타 비급여", re: [labelRe("기타비급여"), labelRe("비급여일반"), labelRe("선택진료비")] },
  { key: "injection", mode: "add", label: "비급여 주사", re: [labelRe("비급여주사료"), labelRe("주사료"), labelRe("주사치료"), labelRe("주사")] },
  { key: "physical", mode: "add", label: "도수·체외충격파", re: [labelRe("도수치료"), labelRe("도수"), labelRe("체외충격파"), labelRe("증식치료"), labelRe("충격파")] },
  { key: "mri", mode: "add", label: "MRI·MRA", re: [labelRe("MRI·MRA"), labelRe("MRI"), labelRe("MRA"), labelRe("자기공명영상"), labelRe("영상진단")] },
  { key: "room", mode: "add", label: "상급병실료 차액", re: [labelRe("상급병실료차액"), labelRe("상급병실료"), labelRe("병실료차액"), labelRe("상급병실"), labelRe("특실료"), labelRe("1인실"), labelRe("2인실")] },
  { key: "coveredPartial", mode: "put", label: "급여 일부본인부담금", re: [labelRe("급여본인부담금"), labelRe("본인일부부담금"), labelRe("일부본인부담금"), labelRe("급여본인부담"), labelRe("본인부담금")] },
];

/** 상급병실료로 봐야 하는 줄 — '병실'이 들어가되 일반 입원료는 아니다 */
const ROOM_STRICT = /상급병실|병실료\s*차액|특실|1인실|2인실/;

/** 어느 서류인가 — 약국 '약제비 영수증'이면 본인부담금이 곧 처방조제비다 */
export function detectKind(lines) {
  const t = squash(lines.join(" "));
  if (/약제비영수증|약국|처방조제비|조제료/.test(t) && !/진료비계산서|진료비영수증/.test(t)) return "pharmacy";
  return "clinic";
}

/** 입원/통원 — 명시 문구가 세부 항목보다 우선한다 */
export function detectVisit(lines) {
  const t = squash(lines.join(" "));
  if (/진료구분[:：]?입원|입원구분|입원일수|재원일수|퇴원일|입원기간|입원료/.test(t)) return { visit: "inpatient", why: "입원 문구" };
  if (/진료구분[:：]?외래|외래|통원|OPD/i.test(t)) return { visit: "outpatient", why: "외래·통원 문구" };
  return { visit: "outpatient", why: "문구 없음(통원으로 둠)" };
}

/** 병원 등급 — '상급종합' → '종합병원' → '의원' → '병원' 순으로 본다 */
export function detectHospital(lines) {
  const t = squash(lines.join(" "));
  if (/상급종합/.test(t)) return { hospital: "tertiary", why: "상급종합병원" };
  if (/종합병원/.test(t)) return { hospital: "general", why: "종합병원" };
  if (/한의원|치과의원|의원|클리닉/.test(t)) return { hospital: "clinic", why: "의원" };
  if (/병원/.test(t)) return { hospital: "hospital", why: "병원" };
  return { hospital: "clinic", why: "문구 없음(의원으로 둠)" };
}

/** 값 기록 — put(하나만) 과 add(여러 줄 합산) 를 나눈다 */
function makeSink() {
  const cap = {};
  return {
    cap,
    put(key, value, { evidence = "", confidence = 0.8, source = "label" } = {}) {
      if (!Number.isFinite(value) || value < 0) return;
      const prev = cap[key];
      if (prev && prev.confidence >= confidence) return;
      cap[key] = { value, evidence: String(evidence || "").trim(), confidence, source };
    },
    add(key, value, { evidence = "", confidence = 0.8, source = "label" } = {}) {
      if (!Number.isFinite(value) || value <= 0) return;
      const prev = cap[key];
      if (!prev) {
        cap[key] = { value, evidence: String(evidence || "").trim(), confidence, source };
        return;
      }
      prev.value += value;
      prev.evidence = prev.evidence ? `${prev.evidence} · ${String(evidence || "").trim()}` : String(evidence || "").trim();
      prev.confidence = Math.min(prev.confidence, confidence);
    },
    get(key) {
      return cap[key] ? cap[key].value : null;
    },
    del(key) {
      delete cap[key];
    },
  };
}

/**
 * 영수증 줄 목록 → 입력칸 값.
 *
 * @param {string[]|string} input 탭으로 칸을 나눈 줄 목록(또는 줄바꿈 텍스트)
 * @returns {{
 *   ok: boolean, kind: string, fields: object, items: Array, warnings: Array,
 *   summary: string, meta: object
 * }}
 */
export function parseReceiptLines(input) {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(/\r?\n/);
  const lines = raw.map((l) => fixDigits(String(l ?? "")).replace(/\u00a0/g, " ").trim()).filter(Boolean);
  const warnings = [];
  const sink = makeSink();

  if (!lines.length) {
    return {
      ok: false,
      kind: "clinic",
      fields: null,
      items: [],
      warnings: [{ code: "empty", text: "읽은 글자가 없습니다. 사진을 다시 찍거나 PDF로 올려 주세요." }],
      summary: "인식된 내용이 없습니다.",
      meta: {},
    };
  }

  const kind = detectKind(lines);
  const { visit, why: visitWhy } = detectVisit(lines);
  const { hospital, why: hospitalWhy } = detectHospital(lines);

  /* --- ① '구분 | 급여 | 비급여' 표 머리글을 찾으면 그 아래를 열로 읽는다 --- */
  let tableAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const sq = squash(lines[i]);
    if (!/급여/.test(sq) || !/비급여/.test(sq)) continue;
    if (amountsIn(lines[i]).length) continue;
    if (!/구분|항목|내역|계/.test(sq)) continue;
    tableAt = i;
    break;
  }
  if (tableAt >= 0) {
    for (let j = tableAt + 1; j < Math.min(lines.length, tableAt + 10); j++) {
      const sq = squash(lines[j]);
      const amts = amountsIn(lines[j]);
      if (amts.length < 2) continue;
      if (/전액본인부담/.test(sq)) sink.put("coveredFull", amts[0].value, { evidence: lines[j], confidence: 0.85, source: "table" });
      else if (/공단부담/.test(sq)) sink.put("insurerPaid", amts[0].value, { evidence: lines[j], confidence: 0.85, source: "table" });
      else if (/본인부담/.test(sq)) {
        sink.put("coveredPartial", amts[0].value, { evidence: lines[j], confidence: 0.85, source: "table" });
        sink.put("nonTotal", amts[1].value, { evidence: lines[j], confidence: 0.8, source: "table" });
      }
    }
  }

  /* --- ② 항목 이름으로 값 찾기 --- */
  for (const line of lines) {
    const sq = squash(line);
    for (const rule of RULES) {
      if (!rule.re.some((re) => re.test(sq))) continue;
      /* 상급병실료 규칙은 '병실' 문구가 확실할 때만 (일반 '입원료'를 병실 차액으로 오인하지 않게) */
      if (rule.key === "room" && !ROOM_STRICT.test(sq)) continue;
      const hit = amountForLabel(line, rule.re, rule.mode === "add" ? "max" : "first");
      if (!hit) break;
      /* 금액이 없는 머리글 줄("약제비 영수증")은 0으로 기록하지 않는다 — 아래 값이 덮이지 않게 */
      if (!hit.value) break;
      (rule.mode === "add" ? sink.add : sink.put).call(sink, rule.key, hit.value, {
        evidence: line,
        confidence: rule.re.length > 1 ? 0.9 : 0.95,
        source: "label",
      });
      break;
    }
  }

  /* --- ③ 라벨 없이 '급여 / 비급여'로 시작하는 요약 줄 --- */
  for (const line of lines) {
    const sq = squash(line);
    if (/^비급여/.test(sq) && !/합계|계|총액|세부|내역/.test(sq)) {
      const a = amountsIn(line);
      if (a.length && sink.get("nonTotal") == null) sink.put("nonTotal", a[0].value, { evidence: line, confidence: 0.75, source: "summary" });
      continue;
    }
    if (/^급여/.test(sq) && !/비급여/.test(sq)) {
      const a = amountsIn(line);
      if (!a.length) continue;
      if (sink.get("coveredPartial") == null) sink.put("coveredPartial", a[0].value, { evidence: line, confidence: 0.8, source: "summary" });
      if (a.length > 1 && sink.get("insurerPaid") == null) sink.put("insurerPaid", a[1].value, { evidence: line, confidence: 0.75, source: "summary" });
    }
  }

  /* --- ④ 약국 영수증: 본인부담금이 곧 처방조제비다 --- */
  if (kind === "pharmacy") {
    const paid = sink.get("coveredPartial");
    if (paid != null && !sink.get("prescription")) {
      sink.put("prescription", paid, { evidence: sink.cap.coveredPartial.evidence, confidence: 0.9, source: "pharmacy" });
    }
    sink.del("coveredPartial");
    sink.del("coveredFull");
  }

  /* --- ⑤ 값을 정리한다 --- */
  const num = (k) => sink.get(k) ?? 0;
  const coveredPartial = num("coveredPartial");
  const coveredFull = num("coveredFull");
  const prescription = kind === "pharmacy" ? num("prescription") : num("prescription");
  const insurerPaid = num("insurerPaid");
  const room = num("room");
  const physical = num("physical");
  const injection = num("injection");
  const mri = num("mri");

  /* 일반 비급여 = '기타 비급여'가 적혀 있으면 그 값, 없으면 비급여 합계에서 세부 항목을 뺀 나머지 */
  const detailSum = physical + injection + mri;
  const nonTotal = sink.get("nonTotal");
  const explicitGeneral = sink.get("generalExplicit");
  let general = explicitGeneral ?? 0;
  if (explicitGeneral == null && nonTotal != null) general = Math.max(0, nonTotal - detailSum - room);

  /* --- ⑥ 입원일수 — 병실 차액이 발생한 날을 먼저 본다 --- */
  let roomLineDays = 0;
  let admitDays = 0;
  for (const line of lines) {
    const sq = squash(line);
    const m = /(\d{1,2})\s*일/.exec(fixDigits(line));
    if (!m) continue;
    const d = Number(m[1]);
    if (!(d > 0 && d <= 60)) continue;
    if (ROOM_STRICT.test(sq)) roomLineDays = Math.max(roomLineDays, d);
    else if (/입원일수|재원일수|입원기간/.test(sq)) admitDays = Math.max(admitDays, d);
  }
  let roomDays = visit === "inpatient" ? roomLineDays || admitDays || (room ? 1 : 0) : 0;

  const fields = {
    visit,
    hospital,
    coveredPartial,
    coveredFull,
    prescription,
    coPayment: insurerPaid,
    non: { general, physical, injection, mri },
    room,
    roomDays,
  };

  const computed = coveredPartial + coveredFull + prescription + general + physical + injection + mri + room;

  /* --- ⑦ 검산 --- */
  const patientTotal = sink.get("patientTotal");
  let diff = 0;
  if (patientTotal != null) {
    diff = computed - patientTotal;
    if (diff !== 0) {
      warnings.push({
        code: "sum_mismatch",
        text: `영수증의 환자부담총액 ${patientTotal.toLocaleString("ko-KR")}원과 세부 합계 ${computed.toLocaleString(
          "ko-KR"
        )}원이 ${Math.abs(diff).toLocaleString("ko-KR")}원 다릅니다. 인식이 틀린 칸이 있는지 확인하세요.`,
      });
    }
  }
  if (insurerPaid && coveredPartial > insurerPaid * 20) {
    warnings.push({
      code: "ratio_suspect",
      text: "공단부담금에 비해 본인부담금이 지나치게 큽니다. 급여/비급여 칸이 바뀌지 않았는지 확인하세요.",
    });
  }
  if (!computed && !patientTotal) {
    warnings.push({ code: "no_amounts", text: "금액을 찾지 못했습니다. 표가 잘린 사진이면 영수증 전체가 보이게 다시 찍어 주세요." });
  }
  if (computed > 0 && patientTotal == null) {
    warnings.push({ code: "no_total", text: "환자부담총액이 없어 합계 검산을 하지 못했습니다. 값은 각 항목 이름으로만 찾았습니다." });
  }

  /* --- ⑧ 화면에 보여 줄 항목 목록 --- */
  const items = [];
  /** key: 화면 항목 / capKey: 근거를 가져올 기록 이름(비급여 총액·공단부담금은 이름이 다르다) */
  const push = (key, label, value, extra = {}, capKey = key) => {
    if (value == null || (!value && key !== "coPayment")) return;
    const c = sink.cap[capKey];
    items.push({
      key,
      label,
      value,
      evidence: c?.evidence || "",
      confidence: c?.confidence ?? 0.6,
      source: c?.source || "derived",
      ...extra,
    });
  };
  push("coveredPartial", "급여 일부 본인부담금", coveredPartial);
  push("coveredFull", "급여 전액 본인부담금", coveredFull);
  push("prescription", "처방조제비", prescription);
  /* 일반 비급여 — '기타 비급여'가 있으면 그 줄, 없으면 '비급여 합계'에서 세부를 뺀 값(계산값) */
  if (explicitGeneral != null) {
    push("nonGeneral", "일반 비급여", general, {}, "generalExplicit");
  } else if (general) {
    push("nonGeneral", "일반 비급여", general, { note: "비급여 합계에서 세부 항목을 뺀 값" }, "nonTotal");
  }
  push("nonPhysical", "도수·체외충격파·증식", physical, {}, "physical");
  push("nonInjection", "비급여 주사", injection, {}, "injection");
  push("nonMri", "MRI·MRA", mri, {}, "mri");
  push("room", "상급병실료 차액", room, room ? { note: `입원 ${roomDays}일` } : {}, "room");
  push("coPayment", "공단부담금", insurerPaid, {}, "insurerPaid");
  if (patientTotal != null) {
    items.push({ key: "patientTotal", label: "환자부담총액(영수증)", value: patientTotal, evidence: sink.cap.patientTotal.evidence, confidence: 1, source: "label" });
  }

  const hospitalLabel = { clinic: "의원", hospital: "병원", general: "종합병원", tertiary: "상급종합병원" }[hospital];
  const head = kind === "pharmacy" ? "약국 약제비 영수증" : `${hospitalLabel} ${visit === "inpatient" ? "입원" : "외래"}`;
  const parts = [];
  const commaWon = (v) => `${v.toLocaleString("ko-KR")}원`;
  if (coveredPartial) parts.push(`급여 ${commaWon(coveredPartial)}`);
  if (coveredFull) parts.push(`급여(전액) ${commaWon(coveredFull)}`);
  if (prescription) parts.push(`처방조제 ${commaWon(prescription)}`);
  if (general) parts.push(`일반 비급여 ${commaWon(general)}`);
  if (physical) parts.push(`도수 ${commaWon(physical)}`);
  if (injection) parts.push(`주사 ${commaWon(injection)}`);
  if (mri) parts.push(`MRI ${commaWon(mri)}`);
  if (room) parts.push(`상급병실 ${commaWon(room)}(${roomDays}일)`);
  const summary = parts.length ? `${head} · ${parts.join(" · ")}` : `${head} · 금액을 찾지 못했습니다`;

  return {
    ok: items.length > 0 && computed > 0,
    kind,
    fields,
    items,
    warnings,
    summary,
    meta: {
      computed,
      patientTotal: patientTotal ?? null,
      diff,
      visitWhy,
      hospitalWhy,
      hospitalLabel,
      version: RECEIPT_VERSION,
    },
  };
}

/** 줄바꿈 텍스트 → 파싱 (PDF 글자 추출 결과를 그대로 넣을 때) */
export function parseReceiptText(text) {
  return parseReceiptLines(String(text ?? "").split(/\r?\n/));
}

/**
 * 파싱 결과 → 실손 계산 엔진 입력.
 * 화면의 다른 설정(가입금액·세대 등)은 사용자가 고른 값을 그대로 이어받는다.
 */
export function toSilsonInput(parsed, base = {}) {
  if (!parsed || !parsed.fields) return base;
  const f = parsed.fields;
  const out = {
    ...base,
    visit: f.visit,
    hospital: f.hospital,
    coveredPartial: f.coveredPartial,
    coveredFull: f.coveredFull,
    prescription: f.prescription,
    non: { ...f.non },
    room: f.room,
    roomDays: f.roomDays,
    coPayment: f.coPayment,
  };
  /* 예전 입력 모양(coveredAmount·coveredKind)이 섞여 들어와도 영수증 값이 이기게 한다 */
  delete out.coveredAmount;
  delete out.coveredKind;
  return out;
}

/**
 * 가상 영수증 3종 — 한 번 눌러 체험하는 용도.
 * 실제 서류와 같은 항목 이름·줄 모양으로 두어 인식 결과를 그대로 확인할 수 있게 한다.
 */
export const RECEIPT_SAMPLES = [
  {
    id: "clinic-cold",
    name: "의원 외래 + 처방",
    note: "감기로 동네 의원에 다녀온 날의 영수증",
    visit: "outpatient",
    hospital: "clinic",
    lines: [
      "한빛내과의원",
      "진료비 계산서·영수증",
      "환자 성명: 김○○      등록번호: 2026-1187",
      "진료기간: 2026-11-18 ~ 2026-11-18",
      "진료구분: 외래      진찰과: 내과",
      "구분          급여        비급여",
      "본인부담금    12,000      0",
      "공단부담금    45,000      0",
      "진찰료        12,000",
      "처방조제비(약국)  4,500",
      "환자부담총액  16,500",
      "결제금액      16,500",
    ],
  },
  {
    id: "tertiary-mri",
    name: "상급종합 입원 + MRI",
    note: "허리 디스크로 3일 입원하고 MRI를 찍은 영수증",
    visit: "inpatient",
    hospital: "tertiary",
    lines: [
      "서울중앙대학교병원  (상급종합병원)",
      "진료비 계산서·영수증",
      "진료구분: 입원      입원일수: 3일",
      "퇴원일: 2026-11-20",
      "구분          급여          비급여",
      "본인부담금    850,000       1,250,000",
      "공단부담금    2,400,000     0",
      "비급여 세부내역",
      "MRI·MRA (요추)            700,000",
      "상급병실료 차액 (1인실, 2일)  500,000",
      "기타 비급여                50,000",
      "환자부담총액  2,100,000",
    ],
  },
  {
    id: "clinic-physical",
    name: "도수·주사 통원",
    note: "정형외과에서 도수치료와 주사를 맞은 영수증",
    visit: "outpatient",
    hospital: "clinic",
    lines: [
      "바른정형외과의원",
      "진료비 계산서·영수증",
      "진료구분: 외래",
      "급여 본인부담금        9,500",
      "공단부담금             28,000",
      "비급여 합계            155,000",
      "도수치료(10회 중 3회)    90,000",
      "비급여 주사료           25,000",
      "체외충격파              40,000",
      "환자부담총액           164,500",
    ],
  },
];

/** 항목 이름 → 화면에 보여 줄 짧은 이름 */
export const RECEIPT_FIELD_LABELS = {
  coveredPartial: "급여 일부 본인부담금",
  coveredFull: "급여 전액 본인부담금",
  prescription: "처방조제비",
  nonGeneral: "일반 비급여",
  nonPhysical: "도수·체외충격파·증식",
  nonInjection: "비급여 주사",
  nonMri: "MRI·MRA",
  room: "상급병실료 차액",
  coPayment: "공단부담금",
  patientTotal: "환자부담총액(영수증)",
};
