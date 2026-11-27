/**
 * 보장분석 요약 엔진 — 담보 목록을 주요 보장 그룹으로 묶고, 기존과 제안을 비교한다.
 *
 * 쓰는 곳
 *  · buffetkimz.com — `src/components/tools/BojangSummary.tsx` 가 ES 모듈로 직접 import
 *  · InsureCRM      — `node scripts/build_bojang_core.mjs` 가 `apps/insure-crm/bojang-core.js`(window.Bojang) 로 옮긴다
 *
 * 설계 원칙
 *  1. 순수 함수만 둔다. DOM·통신·파일 코드를 넣지 않는다. 입력값은 어디로도 나가지 않는다.
 *  2. 금액을 읽지 못한 담보를 0원으로 바꾸지 않는다. `null` 로 남겨 '확인 필요'로 보여 준다.
 *  3. 성격이 다른 금액을 한 숫자로 더하지 않는다 — 정액(lump)·일당(daily)·한도(limit)·비율(rate)을 나눠 센다.
 *  4. '부족' 판정은 기준(target)이 있을 때만 한다. 공개 도구는 기준 없이 '표에 없음'까지만 말한다.
 *
 * 보장분류 기준(업계 공통 구조)
 *  · 실손은 한도, 진단비는 정액, 입원·간병은 일당, 후유장해는 가입금액 대비 비율로 지급된다.
 *  · 암·뇌혈관·허혈성심장은 진단비를 따로 세는 것이 보장분석의 기본 단위다.
 *  · 담보 이름은 보험사마다 다르므로 이름 안의 낱말로 분류하고, 어느 규칙에도 걸리지 않으면 '기타'로 남긴다.
 */

export const FORMAT = "bojang-summary/1";

/* ────────────────────────────── 보장 그룹 ────────────────────────────── */

/**
 * 그룹 순서가 화면·인쇄 순서다.
 *  · kind: 이 그룹의 대표 지급 방식. 그룹 합계는 같은 방식끼리만 더한다.
 *  · core: 보장분석에서 빠지면 '표에 없음'으로 알리는 기본 항목.
 */
export const GROUPS = [
  {
    id: "silson",
    label: "실손의료비",
    short: "실손",
    tone: "#1a4ffd",
    kind: "limit",
    core: true,
    note: "입원·통원 의료비를 한도 안에서 보상합니다. 한도는 보험금 합계가 아닙니다.",
  },
  {
    id: "cancer",
    label: "암·유사암",
    short: "암",
    tone: "#b1637a",
    kind: "lump",
    core: true,
    note: "진단비는 정액, 입원·치료비는 일당·한도로 나뉩니다.",
  },
  {
    id: "brain",
    label: "뇌혈관·허혈성심장",
    short: "뇌·심",
    tone: "#7c5cbf",
    kind: "lump",
    core: true,
    note: "뇌졸중·뇌출혈·뇌경색과 급성심근경색·협심증을 함께 봅니다.",
  },
  {
    id: "surgery",
    label: "질병·상해 수술비",
    short: "수술",
    tone: "#1f7a62",
    kind: "lump",
    core: true,
    note: "암·뇌·심장 수술비는 각 그룹에 넣었습니다(여기서 또 더하지 않습니다).",
  },
  {
    id: "outpatient",
    label: "통원·처방",
    short: "통원",
    tone: "#3d7f8c",
    kind: "lump",
    core: false,
    note: "통원 1회당 정액, 처방조제비처럼 외래에서 나가는 담보입니다. 입원일당과 섞지 않습니다.",
  },
  {
    id: "hospital",
    label: "입원·간병",
    short: "입원·간병",
    tone: "#2c7be0",
    kind: "daily",
    core: true,
    note: "입원일당은 하루 금액, 간병·치매 진단비는 정액입니다.",
  },
  {
    id: "driver",
    label: "운전자",
    short: "운전자",
    tone: "#8a6320",
    kind: "lump",
    core: false,
    note: "교통사고처리지원금·변호사선임비·벌금 등 형사·행정 비용 담보입니다.",
  },
  {
    id: "liability",
    label: "배상책임",
    short: "배상",
    tone: "#a85a3b",
    kind: "limit",
    core: false,
    note: "일상생활배상책임처럼 사고로 남에게 입힌 손해를 보상합니다.",
  },
  {
    id: "death",
    label: "사망·후유장해",
    short: "사망·장해",
    tone: "#0b1b29",
    kind: "lump",
    core: true,
    note: "후유장해는 가입금액의 3~100%를 지급하는 비율 담보입니다.",
  },
  {
    id: "etc",
    label: "기타",
    short: "기타",
    tone: "#55626e",
    kind: "lump",
    core: false,
    note: "치아·화재·재물처럼 위 항목에 들지 않은 담보입니다.",
  },
];

export const GROUP_IDS = GROUPS.map((g) => g.id);
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

/** 지급 방식 — 같은 방식끼리만 합산한다 */
export const PAY_KINDS = {
  lump: "정액",
  daily: "일당",
  limit: "한도",
  rate: "비율",
};

/* ────────────────────────────── 금액 읽기 ────────────────────────────── */

const UNIT_WON = { 억: 1e8, 천만: 1e7, 백만: 1e6, 십만: 1e5, 만: 1e4, 천: 1e3, 백: 1e2, 십: 10 };

/**
 * 한국식 금액 표기를 원 단위 숫자로 바꾼다.
 *
 *   parseAmount("1,000만원")        → 10,000,000
 *   parseAmount("1억 5,000만원")     → 150,000,000
 *   parseAmount("3만원")            → 30,000
 *   parseAmount("100백만")          → 100,000,000
 *   parseAmount("3,000", {unit:"만원"}) → 30,000,000
 *   parseAmount("3~100%")           → null (비율은 금액이 아니다)
 *
 * 읽지 못하면 null. 0 으로 바꾸지 않는다.
 */
export function parseAmount(input, opts = {}) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  /* 전각 숫자·쉼표·공백 정리. '약', '(최대)' 같은 꾸밈말은 떼어 낸다. */
  s = s
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ",")
    .replace(/．/g, ".")
    .replace(/[,\s]/g, "")
    .replace(/^약/, "");
  if (!s) return null;
  if (/[%]/.test(s)) return null;
  if (!/\d/.test(s)) return null;

  const unit = opts.unit === "만원" ? 1e4 : 1;
  let total = 0;
  let rest = s;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)(억|천만|백만|십만|만|천|백|십)?(원)?/g;
  let m;
  while ((m = re.exec(rest))) {
    const num = Number(m[1]);
    if (!Number.isFinite(num)) continue;
    const u = m[2];
    matched = true;
    if (u) {
      total += num * (UNIT_WON[u] || 1);
    } else {
      /* 단위 없는 숫자 — 원 표기면 그대로, 아니면 표의 단위를 따른다 */
      total += m[3] ? num : num * unit;
    }
  }
  if (!matched) return null;
  /* '1,000만원' 처럼 숫자만 있고 단위가 없는 경우(단위 열이 만원) */
  if (total <= 0) return null;
  return Math.round(total);
}

/** 금액을 사람이 읽는 표기로 — 3,000만원 / 1억 2,000만원 / 3만원 */
export function formatMan(won) {
  if (won == null || !Number.isFinite(won)) return "-";
  const n = Math.round(won);
  if (n === 0) return "0원";
  const neg = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e8) {
    const eok = Math.floor(a / 1e8);
    const man = Math.floor((a % 1e8) / 1e4);
    return `${neg}${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}원`;
  }
  if (a >= 1e4) {
    const man = Math.floor(a / 1e4);
    const rest = a % 1e4;
    if (a % 1e4 === 0) return `${neg}${man.toLocaleString("ko-KR")}만원`;
    return `${neg}${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원`;
  }
  return `${neg}${a.toLocaleString("ko-KR")}원`;
}

/* ────────────────────────────── 담보 분류 ────────────────────────────── */

/** 이름에서 지급 방식의 단서를 찾는다 */
function kindOf(name) {
  if (/[%]/.test(name) || /비율/.test(name)) return "rate";
  if (/일당|1일|1일당|하루/.test(name)) return "daily";
  if (/실손|실비/.test(name)) return "limit";
  return "lump";
}

/**
 * 분류 규칙 — 위에서부터 먼저 걸리는 하나가 그 담보의 주 그룹이 된다.
 * tags 에는 겹치는 성격(수술·진단·입원 등)을 남겨 화면에서 설명에 쓴다.
 */
const RULES = [
  {
    id: "silson",
    group: "silson",
    test: /(실손|실비)/,
    kind: "limit",
  },
  {
    id: "cancer",
    group: "cancer",
    test: /(암|유사암|소액암|갑상선|피부암|제자리|경계성|항암|표적|면역항암|호르몬치료)/,
  },
  {
    id: "brain",
    group: "brain",
    test: /(뇌졸중|뇌출혈|뇌경색|뇌혈관|뇌심|허혈성심장|심근경색|협심증|심장질환|심혈관|뇌·심|뇌심장)/,
  },
  {
    id: "driver",
    group: "driver",
    test: /(교통사고처리|변호사선임|벌금|자동차부상|운전자|사고처리지원금|형사합의|방어운전)/,
  },
  {
    id: "liability",
    group: "liability",
    test: /(배상책임|일상생활배상|가족일상|일배책|영업배상|시설배상|화재배상|생활배상)/,
    kind: "limit",
  },
  {
    id: "outpatient",
    group: "outpatient",
    test: /(통원|외래|처방조제|처방비)/,
  },
  {
    id: "surgery",
    group: "surgery",
    test: /(수술|절개|N대|n대|[1-5]종)/,
  },
  {
    id: "hospital",
    group: "hospital",
    test: /(입원|간병|간호|요양|치매|일당)/,
  },
  {
    id: "death",
    group: "death",
    test: /(사망|후유장해|장해|재해|상해사망|질병사망)/,
  },
  {
    id: "etc",
    group: "etc",
    test: /(치아|치과|화재|재물|가전|어린이|자녀|배달|펫|반려|여행|골프|레저|휴대폰)/,
  },
];

/** 이름에서 분류에 도움되는 꼬리표를 뽑는다 */
function tagsOf(name) {
  const tags = [];
  if (/수술/.test(name)) tags.push("surgery");
  if (/진단/.test(name)) tags.push("diagnosis");
  if (/입원/.test(name)) tags.push("hospital");
  if (/통원|외래|처방/.test(name)) tags.push("outpatient");
  if (/일당/.test(name)) tags.push("daily");
  if (/후유장해|장해/.test(name)) tags.push("disability");
  if (/사망/.test(name)) tags.push("death");
  if (/갱신/.test(name)) tags.push("renewal");
  if (/만기|년납|세만기/.test(name)) tags.push("term");
  return tags;
}

/**
 * 같은 그룹 안에서도 성격이 다른 금액을 가른다.
 *  · 암·뇌심 그룹에서 '암수술비'를 진단비 합계에 더하면 3,000만원 진단비가 5,000만원으로 보인다.
 *  · 그래서 진단(diagnosis) / 수술(surgery) / 치료(treatment)를 따로 센다.
 */
function subOf(name) {
  if (/수술/.test(name)) return "surgery";
  if (/(항암|표적|면역항암|호르몬치료|방사선|치료비|약물치료)/.test(name)) return "treatment";
  if (/(입원|일당)/.test(name)) return "inpatient";
  if (/(통원|외래|처방)/.test(name)) return "outpatient";
  if (/(진단|진단비)/.test(name)) return "diagnosis";
  if (/사망/.test(name)) return "death";
  if (/(후유장해|장해)/.test(name)) return "disability";
  return "";
}

/**
 * 담보 이름 → { group, kind, tags, rule }
 * 이름이 비었거나 어느 규칙에도 걸리지 않으면 '기타'(rule:null).
 */
export function classify(name) {
  const original = String(name || "");
  const s = original.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, "").trim();
  const tags = tagsOf(s);
  const sub = subOf(s);
  /* 비율 표기(3~100%)는 괄호 안에 있어도 살린다 — 금액이 아니라 비율 담보이기 때문 */
  const rate = /%/.test(original);
  for (const rule of RULES) {
    if (rule.test.test(s)) {
      const kind = rate ? "rate" : rule.kind || (tags.includes("daily") ? "daily" : kindOf(s));
      return { group: rule.group, kind, tags, sub, rule: rule.id };
    }
  }
  return { group: "etc", kind: rate ? "rate" : kindOf(s), tags, sub, rule: null };
}

/* ────────────────────────────── 실손 세대 ────────────────────────────── */

/**
 * 계약일로 실손 세대를 찾는다. 경계일은 실손 계산 엔진(`src/lib/silson/engine.js`)과 같아야 한다
 * (테스트가 두 엔진의 결과를 날짜 60개로 대조한다).
 */
export function silsonGeneration(dateStr) {
  const s = String(dateStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split("-").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (s < "2009-10-01") return { id: "gen1", label: "1세대" };
  if (s < "2017-04-01") return { id: "gen2", label: "2세대" };
  if (s < "2021-07-01") return { id: "gen3", label: "3세대" };
  if (s < "2026-05-06") return { id: "gen4", label: "4세대" };
  return { id: "gen5", label: "5세대" };
}

/** 담보 이름에 적힌 세대 표기('4세대 실손')를 읽는다 */
function generationFromName(name) {
  const m = String(name || "").match(/([1-5])\s*세대/);
  return m ? { id: `gen${m[1]}`, label: `${m[1]}세대`, from: "담보명" } : null;
}

/* ────────────────────────────── 텍스트 → 담보 ────────────────────────────── */

/** 한 줄을 칸으로 나눈다 — 탭 > 2칸 이상 공백 > 파이프 > 단일 공백 순 */
export function splitCells(line) {
  const s = String(line || "").trim();
  if (!s) return [];
  /* 탭·파이프는 빈 칸의 자리를 지킨다(가입금액이 빈 실손 행 등) */
  const trimTail = (arr) => {
    const a = arr.map((x) => (x == null ? "" : String(x).trim()));
    while (a.length && !a[a.length - 1]) a.pop();
    return a;
  };
  if (s.includes("\t")) return trimTail(s.split("\t"));
  if (/ {2,}/.test(s)) return s.split(/ {2,}/).map((x) => x.trim()).filter(Boolean);
  if (s.includes("|")) return trimTail(s.split("|"));
  return [s];
}

/*
 * 계약 머리글 — 증권·설계서는 보통 계약마다 "보험사 / 상품명 / 계약일 / 납입기간 / 만기"를 한 줄씩 적고
 * 그 아래에 담보 표를 둔다. 이 줄을 읽어 두면 담보가 어느 계약(상품)에 들어 있는지 묶을 수 있다.
 *  · 계약자·피보험자 이름은 읽지 않는다(개인정보).
 */
const CONTRACT_INSURER = /^(?:보험사명?|보험회사|회사명)\s*[:：]?\s*(.+)$/;
const CONTRACT_PRODUCT = /^(?:상품명?|계약명|보험종목|종목명)\s*[:：]?\s*(.+)$/;
const CONTRACT_START = /^(?:최초\s*)?(?:계약일|가입일|청약일|가입\s*예정일)\s*[:：]?\s*(.+)$/;
const CONTRACT_PAY = /^(?:납입기간|납기|납입년수)\s*[:：]?\s*(.+)$/;
const CONTRACT_TERM = /^(?:만기|보험기간|보장기간)\s*[:：]?\s*(.+)$/;

/**
 * 한 줄이 계약 머리글인지 본다. 맞으면 { reset, fields } 를 낸다.
 *  · reset — 새 계약이 시작되어 앞 계약의 상품명·계약일 등을 지운다.
 *  · '[한결생명] 무배당 ○○보험' 처럼 대괄호로 회사·상품을 함께 적은 줄도 계약 머리글로 본다.
 */
function contractLine(line) {
  const s = String(line || "").trim();
  if (!s) return null;
  const bracket = s.match(/^[\[【]\s*([^\]】]{2,24})\s*[\]】]\s*(.+)$/);
  if (bracket && /(보험|연금|보장|저축|공제)/.test(bracket[2]) && !/\d[\d,.]*\s*(?:원|만)/.test(bracket[2])) {
    return { reset: true, fields: { insurer: bracket[1].trim(), product: bracket[2].trim() } };
  }
  let m = s.match(CONTRACT_INSURER);
  if (m && !/\d[\d,.]*\s*(?:원|만)/.test(m[1])) return { reset: true, fields: { insurer: m[1].trim() } };
  m = s.match(CONTRACT_PRODUCT);
  if (m && !/\d[\d,.]*\s*(?:원|만)/.test(m[1])) {
    /* 상품명 줄은 새 계약의 시작이지만 회사명은 그대로 쓴다 */
    return { reset: "soft", fields: { product: m[1].trim() } };
  }
  m = s.match(CONTRACT_START);
  if (m) return { reset: false, fields: { startDate: isoDate(m[1].trim()) } };
  m = s.match(CONTRACT_PAY);
  if (m && /\d|전기|종신/.test(m[1])) return { reset: false, fields: { payTerm: m[1].trim() } };
  m = s.match(CONTRACT_TERM);
  if (m && /\d|종신|만기/.test(m[1])) return { reset: false, fields: { coverTerm: m[1].trim() } };
  return null;
}

const HEADER_NAME = /(담보명|보장명|보장내용|특약명|급부명|담보|보장항목|지급사유)/;
const HEADER_AMOUNT = /(가입금액|보장금액|지급금액|보험가입금액|보장한도|가입금액\(|금액)/;
const HEADER_PREMIUM = /(보험료|월보험료|납입보험료)/;
const NOISE = /^(페이지|page|가입설계서|보험증권|증권번호|계약자|피보험자|상품명|보험사|상품|계약일|만기일|납입기간|보험기간|합계|소계|총보험료|월보험료합계|※|\*|\(주\)|출력일|작성일)/i;

/**
 * PDF/붙여넣기 텍스트 → 담보 행 목록.
 *
 * 표 머리글(담보명·가입금액·보험료)을 찾으면 그 열 순서를 따르고,
 * 머리글이 없거나 칸이 어긋나면 "이름 … 금액 … 보험료" 순서로 읽는 추정 규칙을 쓴다.
 * 읽은 행은 `{ name, amount, premium, term, raw, unit }` 모양이며 아직 분류 전이다.
 */
export function parseText(text) {
  const src = String(text || "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/\u00a0/g, " ");
  const lines = src.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const rows = [];
  let cols = null;
  let unit = "원";
  let premiumSum = 0;
  let sawPremiumLabel = false;
  /** 지금 읽고 있는 계약 — 아래 담보 줄에 회사·상품·계약일·납입·만기를 붙인다 */
  let ctx = { insurer: "", product: "", startDate: "", payTerm: "", coverTerm: "" };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      cols = null;
      continue;
    }
    const cells = splitCells(line);

    /* 계약 머리글 — 담보 줄로 읽지 않고, 아래 담보에 붙일 값으로 기억한다.
       칸이 하나인 줄만 본다(표 머리글·담보 줄을 계약 머리글로 잘못 읽지 않게). */
    const ctxLine = cells.length === 1 ? contractLine(line) : null;
    if (ctxLine) {
      if (ctxLine.reset === true) ctx = { insurer: "", product: "", startDate: "", payTerm: "", coverTerm: "" };
      if (ctxLine.reset === "soft") ctx = { ...ctx, startDate: "", payTerm: "", coverTerm: "" };
      for (const [k, v] of Object.entries(ctxLine.fields)) if (v) ctx[k] = v;
      continue;
    }

    /* 표 머리글 — 열 위치와 단위를 기억한다 */
    if (cells.length >= 2 && HEADER_NAME.test(cells[0]) && cells.some((c) => HEADER_AMOUNT.test(c))) {
      const nameIdx = cells.findIndex((c) => HEADER_NAME.test(c));
      let amountIdx = cells.findIndex((c) => HEADER_AMOUNT.test(c));
      const premiumIdx = cells.findIndex((c) => HEADER_PREMIUM.test(c));
      /* '담보' 열이 두 개(구분·담보명)일 때는 더 구체적인 '담보명'을 쓴다 */
      const namedIdx = cells.findIndex((c) => /(담보명|보장명|특약명|급부명)/.test(c));
      cols = {
        name: namedIdx >= 0 ? namedIdx : nameIdx,
        amount: amountIdx >= 0 ? amountIdx : null,
        premium: premiumIdx >= 0 ? premiumIdx : null,
      };
      unit = /만원/.test(cells.join(" ")) ? "만원" : "원";
      continue;
    }

    /* 합계 줄 — 월 보험료 합계로만 받는다 */
    if (/^(총\s*)?(월\s*)?보험료\s*(합계|계)?\s*[:：]?/.test(line) || /^합계\s*[:：]?/.test(line) || /^총\s*보험료/.test(line)) {
      const nums = line.match(/[\d,]+(?:\.\d+)?\s*(?:억|만|천|백)?\s*원?/g);
      if (nums && nums.length) {
        const v = parseAmount(nums[nums.length - 1], { unit: "원" });
        if (v && v >= 1000 && v <= 1000000) {
          premiumSum = Math.max(premiumSum, v);
          sawPremiumLabel = true;
        }
      }
      continue;
    }
    if (NOISE.test(line) && !/[가-힣]{2,}(비|금|일당|한도)/.test(line)) continue;

    let name = "";
    let amountRaw = "";
    let premiumRaw = "";
    let term = "";

    if (cols && cells.length > cols.name) {
      name = cells[cols.name] || "";
      amountRaw = cols.amount != null ? cells[cols.amount] || "" : "";
      premiumRaw = cols.premium != null ? cells[cols.premium] || "" : "";
      term = cells.find((c) => /(년납|만기|세만기|\d+년|\d+세)/.test(c) && c !== name) || "";
    }
    if (!name) {
      /* 추정 읽기 — 단위(원·만원 등)가 붙은 금액을 먼저 찾고, 그 앞을 이름으로 본다 */
      const moneyRe = /(\d[\d,.]*)\s*(억|천만|백만|십만|만|천|백|십)?\s*(원|%)?/g;
      const found = [];
      let mm;
      while ((mm = moneyRe.exec(line))) {
        const raw = mm[0];
        const isRate = mm[3] === "%";
        const hasUnit = Boolean(mm[2] || mm[3]);
        if (!hasUnit) continue; /* 단위 없는 숫자는 담보명 속 숫자(1~5종)·쪽번호일 수 있다 */
        const won = isRate ? null : parseAmount(raw, { unit });
        if (!isRate && won == null) continue;
        found.push({ raw, won, index: mm.index, isRate });
      }
      if (!found.length) continue;
      const first = found[0];
      name = line.slice(0, first.index);
      amountRaw = first.raw;
      /* 두 번째 숫자가 작으면 월 보험료로 본다 */
      if (found[1] && (found[1].won == null || found[1].won < 100000)) premiumRaw = found[1].raw;
      const termM = line.match(/(\d+\s*년납|\d+\s*세\s*만기|\d+\s*년\s*만기|종신)/);
      term = termM ? termM[0] : "";
    }

    name = cleanName(name);
    if (!name) continue;
    if (/^(합계|소계|총액|보험료|월보험료)$/.test(name)) continue;

    const amount = parseAmount(amountRaw, { unit });
    const premium = premiumRaw ? parseAmount(premiumRaw, { unit: "원" }) : null;
    const isRate = /%/.test(amountRaw);
    const payTerm = (line.match(/\d{1,2}\s*년\s*납/) || [""])[0] || ctx.payTerm;
    const coverTerm = (line.match(/\d{1,3}\s*(?:세|년)\s*만기|종신/) || [""])[0] || ctx.coverTerm;
    const renew = /비갱신/.test(line) ? "비갱신" : /갱신/.test(line) ? "갱신" : "";
    rows.push({
      name,
      amount: isRate ? null : amount,
      rate: isRate ? amountRaw.trim() : "",
      premium: premium != null && premium < 1000000 ? premium : null,
      payTerm,
      coverTerm,
      renew,
      term: term || payTerm || coverTerm || "",
      insurer: ctx.insurer,
      product: ctx.product,
      startDate: ctx.startDate,
      raw: line,
      unit,
    });
  }

  return { rows: rows.filter((r) => r.name), premiumSum, sawPremiumLabel };
}

/**
 * 담보 이름 정리 — 앞 목록 번호·불릿, 꼬리 주석을 떼어 낸다.
 *
 * 주의: "2세대 실손의료비"처럼 이름이 숫자로 시작하는 담보가 있다. 맨 앞 숫자를 모두 지우면
 * "세대 실손의료비"가 되어 세대 판정이 빠진다(4호 봇 재현). 그래서 숫자+구분자(1. / 2) / ①)만 번호로 보고,
 * "2세대"·"3대"·"1종"처럼 뒤에 말이 붙은 숫자는 이름의 일부로 남긴다.
 */
function cleanName(s) {
  return String(s || "")
    .replace(/^\s*(?:[①-⑳]|[-–•·*])\s*/, "")
    .replace(/^\s*\d{1,2}\s*[.)]\s*/, "")
    .replace(/^\s*\d{1,2}\s+(?=[가-힣])/, "")
    .replace(/[·•\-–]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 납입기간 표기("20년납", "20년", "10년")에서 납입년수를 읽는다. 읽지 못하면 null.
 * 화면에서 납입기간을 고칠 때도 같은 규칙을 쓰도록 함수로 둔다.
 */
export function parsePayYears(payTerm) {
  const yrs = Number((String(payTerm || "").match(/(\d{1,2})/) || [])[1] || 0) || 0;
  return yrs > 0 ? yrs : null;
}

/**
 * 총납입보험료 추정 = 월보험료 × 12 × 납입년수.
 * 보험료가 없거나 0, 또는 납입기간에서 년수를 읽지 못하면 null(0원이 아니라 '모름').
 * 표를 읽을 때와 화면에서 손으로 고칠 때가 같은 값을 내도록 한 곳에서 계산한다.
 */
export function estimatePaidTotal(premium, payTerm) {
  const p = premium == null ? 0 : Number(premium) || 0;
  const yrs = parsePayYears(payTerm);
  return p > 0 && yrs ? Math.round(p * 12 * yrs) : null;
}

/**
 * 읽은 행을 담보 객체로 정규화한다. 분류·지급방식·확신도를 붙인다.
 * `confidence` — high: 이름과 금액 모두 읽음 / mid: 분류는 됐지만 금액 없음 / low: 분류 불가(기타)
 */
export function normalizeRows(rows, opts = {}) {
  const list = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const name = cleanName(r && r.name);
    if (!name) continue;
    const cls = classify(name);
    const amount = r.amount == null ? null : Number(r.amount) || null;
    const kind = r.rate ? "rate" : r.kind && PAY_KINDS[r.kind] ? r.kind : cls.kind;
    const group = opts.keepGroup ? r.group || cls.group : cls.group;
    const confidence = group === "etc" || !cls.rule ? "low" : amount == null && !r.rate ? "mid" : "high";
    const payTerm = r.payTerm || "";
    const coverTerm = r.coverTerm || "";
    const renew = r.renew || (/비갱신/.test(name) ? "비갱신" : /갱신/.test(name) ? "갱신" : "");
    list.push({
      id: `${list.length + 1}`,
      name,
      group,
      kind,
      sub: cls.sub || "",
      tags: cls.tags,
      amount: kind === "rate" ? null : amount,
      rate: r.rate || (kind === "rate" ? String(r.amountRaw || "") : ""),
      premium: r.premium == null ? null : Number(r.premium) || null,
      insurer: r.insurer || "",
      product: r.product || "",
      startDate: r.startDate || "",
      term: r.term || payTerm || coverTerm || "",
      payTerm,
      coverTerm,
      renew,
      /** 납입기간이 있으면 총납입보험료를 추정한다(월보험료 × 12 × 납입년수) */
      paidTotal: estimatePaidTotal(r.premium, payTerm),
      note: r.note || "",
      raw: r.raw || "",
      confidence,
      rule: cls.rule,
    });
  }
  return list;
}

/** JSON(배열 또는 {coverages:[...]}) → 담보 목록. 수동 입력·저장본 복원에 쓴다. */
export function parseJSON(data) {
  let obj = data;
  if (typeof data === "string") {
    try {
      obj = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const arr = Array.isArray(obj) ? obj : Array.isArray(obj?.coverages) ? obj.coverages : [];
  return normalizeRows(arr, { keepGroup: Boolean(obj && obj.keepGroup) });
}

/** 텍스트 한 번에 → 담보 목록 */
export function readDocument(text, opts = {}) {
  const parsed = parseText(text);
  const coverages = normalizeRows(parsed.rows);
  const premiumFromRows = coverages.reduce((a, c) => a + (c.premium || 0), 0);
  return {
    coverages,
    premium: opts.premium ?? (parsed.premiumSum || premiumFromRows || null),
    premiumSource: parsed.premiumSum ? "합계 줄" : premiumFromRows ? "담보별 보험료 합" : null,
    rowCount: parsed.rows.length,
  };
}

/* ────────────────────────────── 요약 ────────────────────────────── */

/**
 * 담보 목록 → 그룹 요약.
 *
 * opts
 *  · label      자료 이름('보유', '제안' 등)
 *  · premium    월 보험료 합계(원)
 *  · contracts  계약 건수
 *  · contractsMeta 계약 원장([{insurer, product, startDate, premium, payTerm, coverTerm}]) — 계약 단위 표에 보험료를 채운다
 *  · targets    { [groupId]: 원 } — 있으면 충족률·부족 판정을 계산한다
 *  · targetsAreManwon  targets 가 만원 단위인지
 */
export function summarize(coverages, opts = {}) {
  const list = Array.isArray(coverages) ? coverages : [];
  const tMul = opts.targetsAreManwon ? 10000 : 1;
  /* 기준금액 — 화면이 넘긴 값이 우선, 없으면(공개 화면 기본값) 권장 기준을 쓴다 */
  const targets = {};
  if (opts.useDefaultTargets !== false) Object.assign(targets, DEFAULT_TARGETS);
  for (const [k, v] of Object.entries(opts.targets || {})) if (v != null && v !== "") targets[k] = Number(v) * tMul;

  const groups = GROUPS.map((g) => {
    const items = list.filter((c) => c.group === g.id);
    const lumpAll = items.filter((c) => c.kind === "lump");
    const daily = items.filter((c) => c.kind === "daily");
    const limits = items.filter((c) => c.kind === "limit");
    const rates = items.filter((c) => c.kind === "rate");
    const isDiagGroup = g.id === "cancer" || g.id === "brain";
    /* 진단비 그룹에서는 수술·치료비를 진단비 합계에 더하지 않는다 */
    const surgeryItems = isDiagGroup ? lumpAll.filter((c) => c.sub === "surgery") : [];
    const treatItems = isDiagGroup ? lumpAll.filter((c) => c.sub === "treatment") : [];
    const lump = isDiagGroup ? lumpAll.filter((c) => c.sub !== "surgery" && c.sub !== "treatment") : lumpAll;
    const lumpTotal = lump.reduce((a, c) => a + (c.amount || 0), 0);
    const surgeryTotal = surgeryItems.reduce((a, c) => a + (c.amount || 0), 0);
    const treatTotal = treatItems.reduce((a, c) => a + (c.amount || 0), 0);

    /* 암은 일반암과 유사암·소액암을 따로 센다 */
    const isSimilar = (n) => /(유사암|소액암|갑상선|피부암|제자리|경계성)/.test(n);
    const generalCancer = g.id === "cancer" ? lump.filter((c) => /암/.test(c.name) && !isSimilar(c.name)).reduce((a, c) => a + (c.amount || 0), 0) : 0;
    const similarCancer = g.id === "cancer" ? lump.filter((c) => isSimilar(c.name)).reduce((a, c) => a + (c.amount || 0), 0) : 0;

    /* 사망은 질병·재해를 나누고, 후유장해는 비율 담보와 정액을 따로 센다 */
    const deathDisease = g.id === "death" ? items.filter((c) => /질병/.test(c.name) && /사망/.test(c.name)).reduce((a, c) => a + (c.amount || 0), 0) : 0;
    const deathAccident = g.id === "death" ? items.filter((c) => /(재해|상해|교통)/.test(c.name) && /사망/.test(c.name)).reduce((a, c) => a + (c.amount || 0), 0) : 0;
    const disability = g.id === "death" ? items.filter((c) => /(후유장해|장해)/.test(c.name) && c.kind !== "rate").reduce((a, c) => a + (c.amount || 0), 0) : 0;

    const renewalItems = items.filter((c) => c.renew === "갱신");
    const target = targets[g.id] != null && Number(targets[g.id]) > 0 ? Number(targets[g.id]) : null;
    let ratio = null;
    let level = items.length ? "has" : "none";
    if (target) {
      ratio = lumpTotal / target;
      level = levelOf(ratio, lumpTotal);
    }
    return {
      id: g.id,
      label: g.label,
      short: g.short,
      tone: g.tone,
      note: g.note,
      core: g.core,
      items,
      count: items.length,
      lump: lumpTotal,
      surgery: surgeryTotal,
      treatment: treatTotal,
      surgeryItems,
      treatItems,
      generalCancer,
      similarCancer,
      deathDisease,
      deathAccident,
      disability,
      daily,
      limits,
      rates,
      target,
      ratio,
      level,
      levelLabel: LEVEL_LABELS[level] || "",
      has: items.length > 0,
      renewCount: renewalItems.length,
      nonRenewCount: items.filter((c) => c.renew === "비갱신").length,
      renewPremium: renewalItems.reduce((a, c) => a + (c.premium || 0), 0),
      paidTotal: items.reduce((a, c) => a + (c.paidTotal || 0), 0),
    };
  });

  const premiumFromRows = list.reduce((a, c) => a + (c.premium || 0), 0);
  const premium =
    opts.premium == null ? (premiumFromRows > 0 ? premiumFromRows : null) : Number(opts.premium) || 0;
  const silsonItems = list.filter((c) => c.group === "silson");
  const silson = detectSilson(silsonItems);
  const checks = buildChecks(groups, list, { premium });

  return {
    format: FORMAT,
    label: opts.label || "보장 정리",
    at: opts.at || "",
    count: list.length,
    contracts: opts.contracts == null ? null : Number(opts.contracts) || 0,
    premium,
    premiumKnown: premium != null && premium > 0,
    groups,
    silson,
    checks,
    /* 25개 기둥 체크리스트 — 화면·인쇄·증권북이 같은 값을 읽는다 */
    pillars: pillars(list, { at: opts.at }),
    /* 계약(상품) 단위 표 — 담보에 적힌 보험사·상품명·계약일로 묶는다 */
    contractTable: groupContracts(list, { contracts: opts.contractsMeta }),
    /* 기준 대비 판정 — 공개 화면·인쇄가 그대로 읽는다 */
    judge: groups
      .filter((g) => g.target)
      .map((g) => ({ id: g.id, label: g.label, value: g.lump, target: g.target, ratio: g.ratio, level: g.level, levelLabel: g.levelLabel })),
    renew: {
      count: list.filter((c) => c.renew === "갱신").length,
      nonRenewCount: list.filter((c) => c.renew === "비갱신").length,
      unknown: list.filter((c) => !c.renew).length,
      premium: list.filter((c) => c.renew === "갱신").reduce((a, c) => a + (c.premium || 0), 0),
    },
    paidTotal: list.reduce((a, c) => a + (c.paidTotal || 0), 0),
    targetsNote: DEFAULT_TARGET_NOTE,
    unknown: list.filter((c) => c.group === "etc").map((c) => ({ name: c.name, amount: c.amount })),
    missingTargets: list.filter((c) => c.amount == null && c.kind !== "rate" && c.kind !== "limit").map((c) => c.name),
  };
}

/** 기준 대비 판정 단계 — 부족/적정/충분을 네 단계로 */
export function levelOf(ratio, total) {
  if (!total || total <= 0) return "none";
  if (ratio < 0.5) return "vlow";
  if (ratio < 1) return "low";
  if (ratio < 1.5) return "ok";
  return "rich";
}

export const LEVEL_LABELS = { none: "없음", vlow: "매우 부족", low: "부족", ok: "적정", rich: "충분", has: "가입" };

/**
 * 기준금액 기본값(원) — 보장분석 실무에서 쓰는 참고값이다. 법정 기준이 아니며 화면에서 고칠 수 있다.
 *  · 암: 일반암 진단비 3,000만원, 뇌·심: 뇌혈관 1,000만 + 허혈성심장 1,000만
 *  · 수술: 질병+상해 수술비 300만원, 사망: 1억원, 운전자: 교통사고처리지원금 2억원
 */
export const DEFAULT_TARGETS = {
  cancer: 30000000,
  brain: 20000000,
  surgery: 3000000,
  death: 100000000,
  driver: 200000000,
};

export const DEFAULT_TARGET_NOTE =
  "권장 기준금액은 보장분석 실무에서 쓰는 참고값(당사 기준)이며 법정 기준이 아닙니다. 고객의 소득·가족력·부채에 따라 달라지므로 아래 칸에서 고쳐 쓸 수 있습니다.";

/** 실손 세대 — 담보명 표기를 먼저 보고, 없으면 계약일로 찾는다 */
function detectSilson(items) {
  if (!items.length) return { found: false, generation: null, label: null, from: null, items: [] };
  const byName = items.map((it) => ({ it, g: generationFromName(it.name) })).find((x) => x.g);
  if (byName) {
    return { found: true, generation: byName.g.id, label: byName.g.label, from: "담보명", items };
  }
  const byDate = items
    .map((it) => ({ it, g: silsonGeneration(it.startDate) }))
    .filter((x) => x.g)
    .sort((a, b) => String(b.g.id).localeCompare(String(a.g.id)))[0];
  if (byDate) {
    return { found: true, generation: byDate.g.id, label: byDate.g.label, from: "계약일", items };
  }
  return { found: true, generation: null, label: null, from: null, items };
}

/** 확인할 점 — 판정이 아니라 '원문에서 확인할 목록'이다 */
function buildChecks(groups, list, ctx) {
  const out = [];
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  for (const g of groups) {
    if (!g.core) continue;
    if (!g.has) {
      out.push({
        level: "check",
        code: `missing:${g.id}`,
        group: g.id,
        text: `표에서 ${g.label} 담보를 찾지 못했습니다. 증권 원문에서 한 번 더 확인하세요.`,
      });
    }
  }
  /* 일반암(유사암·소액암이 아닌 암) 담보가 있는지 */
  const hasGeneralCancer = byId.cancer.items.some(
    (c) => /암/.test(c.name) && !/(유사암|소액암|갑상선|피부암|제자리|경계성)/.test(c.name),
  );
  if (byId.cancer.has && !hasGeneralCancer) {
    out.push({
      level: "check",
      code: "cancer:no-general",
      group: "cancer",
      text: "유사암·소액암 담보만 보입니다. 일반암 진단비가 따로 있는지 확인하세요.",
    });
  }
  const brainHas = byId.brain.items.some((c) => /뇌|뇌졸중|뇌출혈|뇌경색|뇌혈관/.test(c.name));
  const heartHas = byId.brain.items.some((c) => /심장|심근|협심|허혈/.test(c.name));
  if (byId.brain.has && brainHas !== heartHas) {
    out.push({
      level: "check",
      code: "brain:partial",
      group: "brain",
      text: `${brainHas ? "뇌혈관" : "허혈성심장"} 쪽만 표시됩니다. 반대쪽 담보가 있는지 확인하세요.`,
    });
  }
  if (!byId.silson.has) {
    out.push({ level: "check", code: "silson:none", group: "silson", text: "실손 담보가 목록에 없습니다. 별도 증권에 있는지 확인하세요." });
  } else if (byId.silson.items.some((c) => /1세대|2세대|[12]세대/.test(c.name))) {
    out.push({ level: "info", code: "silson:early", group: "silson", text: "1·2세대 실손으로 표시됩니다. 자기부담률은 가입 시기·상품형에 따라 다르니 약관으로 확인하세요." });
  }
  /* 실손 2건 이상 — 세대가 달라도 비례보상된다 */
  if (byId.silson.count >= 2) {
    out.push({
      level: "check",
      code: "silson:duplicate",
      group: "silson",
      text: `실손 담보가 ${byId.silson.count}건입니다. 세대가 달라도(예: 2세대+4세대) 실손은 비례보상되어 두 곳 합쳐 보장 한도까지만 지급됩니다. 중복 가입 여부와 보험료를 확인하세요.`,
    });
  }
  /* 갱신형 — 갱신 때 보험료·보장이 바뀐다 */
  const renewal = list.filter((c) => c.renew === "갱신");
  if (renewal.length) {
    out.push({
      level: "info",
      code: "renew:count",
      text: `갱신형 담보 ${renewal.length}건(월 보험료 ${renewal
        .reduce((a, c) => a + (c.premium || 0), 0)
        .toLocaleString("ko-KR")}원). 갱신 주기와 인상률은 증권으로 확인하세요. 비갱신형 ${list.filter((c) => c.renew === "비갱신").length}건.`,
    });
  }
  /* 진단비와 수술·치료비를 섞지 않았다는 안내 */
  const diagSplit = ["cancer", "brain"].some((id) => byId[id].surgery > 0 || byId[id].treatment > 0);
  if (diagSplit) {
    out.push({
      level: "info",
      code: "kind:diagnosis-split",
      text: "암·뇌심 그룹은 진단비와 수술·치료비를 나눠 셈했습니다. 진단비 합계에 수술비를 더하지 않았습니다.",
    });
  }
  const noAmount = list.filter((c) => c.amount == null && c.kind !== "rate" && c.kind !== "limit");
  if (noAmount.length) {
    out.push({
      level: "check",
      code: "amount:missing",
      text: `가입금액을 읽지 못한 담보 ${noAmount.length}건(${noAmount.slice(0, 3).map((c) => c.name).join(", ")}${noAmount.length > 3 ? " 외" : ""}). 직접 입력해 주세요.`,
    });
  }
  const etc = list.filter((c) => c.group === "etc");
  if (etc.length) {
    out.push({
      level: "info",
      code: "group:etc",
      text: `분류를 확인할 담보 ${etc.length}건(${etc.slice(0, 3).map((c) => c.name).join(", ")}${etc.length > 3 ? " 외" : ""}).`,
    });
  }
  const dupNames = Object.entries(
    list.reduce((acc, c) => {
      const k = c.name.replace(/\s/g, "");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  ).filter(([, n]) => n > 1);
  if (dupNames.length) {
    out.push({
      level: "info",
      code: "duplicate",
      text: `같은 이름의 담보가 여러 계약에 있습니다(${dupNames.length}종). 그룹 합계에는 모두 더했습니다.`,
    });
  }
  if (ctx.premium == null || ctx.premium === 0) {
    out.push({ level: "info", code: "premium:none", text: "월 보험료를 찾지 못했습니다. 보험료 합계는 직접 입력할 수 있습니다." });
  }
  const dailyAny = list.some((c) => c.kind === "daily");
  const limitAny = list.some((c) => c.kind === "limit");
  if (dailyAny || limitAny) {
    out.push({
      level: "info",
      code: "kind:separate",
      text: "일당·한도·비율 담보는 정액 진단비와 성격이 달라 그룹 합계에 더하지 않고 따로 적었습니다.",
    });
  }
  return out;
}

/* ────────────────────────────── 비교 ────────────────────────────── */

const normKey = (s) => String(s || "").replace(/[\s()[\]]/g, "").replace(/무배당|특약|갱신형|비갱신형/g, "");

/**
 * 기존 vs 제안 비교.
 * 그룹 단위 증감과, 같은 이름 담보의 금액 차이를 함께 낸다.
 */
export function compare(before, after) {
  const a = summarize(before);
  const b = summarize(after);
  const groups = GROUPS.map((g, i) => {
    const ga = a.groups[i];
    const gb = b.groups[i];
    const delta = gb.lump - ga.lump;
    let status = "same";
    if (!ga.has && gb.has) status = "new";
    else if (ga.has && !gb.has) status = "removed";
    else if (delta > 0) status = "up";
    else if (delta < 0) status = "down";
    else if (!ga.has && !gb.has) status = "none";
    return {
      id: g.id,
      label: g.label,
      short: g.short,
      tone: g.tone,
      before: { count: ga.count, lump: ga.lump, level: ga.level },
      after: { count: gb.count, lump: gb.lump, level: gb.level },
      delta,
      status,
    };
  });

  const map = new Map();
  for (const c of Array.isArray(before) ? before : []) {
    const k = normKey(c.name);
    const e = map.get(k) || { name: c.name, group: c.group, kind: c.kind, before: null, after: null };
    e.before = (e.before || 0) + (c.amount || 0);
    map.set(k, e);
  }
  for (const c of Array.isArray(after) ? after : []) {
    const k = normKey(c.name);
    const e = map.get(k) || { name: c.name, group: c.group, kind: c.kind, before: null, after: null };
    e.after = (e.after || 0) + (c.amount || 0);
    map.set(k, e);
  }
  const rows = [...map.values()]
    .map((e) => {
      const delta = (e.after || 0) - (e.before || 0);
      const status = e.before == null ? "new" : e.after == null ? "removed" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
      return { ...e, delta, status };
    })
    .filter((e) => e.status !== "same" || e.group !== "etc")
    .sort((x, y) => GROUP_IDS.indexOf(x.group) - GROUP_IDS.indexOf(y.group) || Math.abs(y.delta) - Math.abs(x.delta));

  const premium = {
    before: a.premium,
    after: b.premium,
    delta: a.premium != null && b.premium != null ? b.premium - a.premium : null,
  };
  return { a, b, groups, rows, premium, changed: rows.filter((r) => r.status !== "same").length, pillars: comparePillars(before, after) };
}

/** 비교 결과를 한 줄 요약 문장들로 */
export function compareLines(cmp) {
  const out = [];
  if (cmp.premium.delta != null) {
    const d = cmp.premium.delta;
    out.push(`월 보험료 ${d === 0 ? "변동 없음" : `${d > 0 ? "+" : "-"}${Math.abs(d).toLocaleString("ko-KR")}원`}`);
  }
  const up = cmp.groups.filter((g) => g.delta > 0);
  const down = cmp.groups.filter((g) => g.delta < 0);
  for (const g of up) out.push(`${g.label} +${formatMan(g.delta)}`);
  for (const g of down) out.push(`${g.label} ${formatMan(g.delta)}`);
  return out;
}

/* ────────────────────────── 보장 기둥 25 ────────────────────────── */

/**
 * 25대 핵심 보장 기둥 — 보장분석 체크리스트의 기준표.
 *
 * 구조: 뿌리(실손의료비) 위에 25개 기둥을 세운다. 기둥은 우리 10개 보장 그룹을 그대로 쓰고
 * (group), 그룹 안에서 다시 '무엇을 보는지'(include·exclude·cause)로 나눈다. 그래서 새 분류 체계를
 * 하나 더 만들지 않고도 기존 담보 분류 결과를 그대로 재사용한다.
 *
 *  · measure  무엇으로 재는지
 *      sum      같은 성격의 담보 금액을 더한다(계약이 여러 건이면 각각 지급되므로)
 *      causeMax 원인(질병·재해)별로 더한 뒤 큰 쪽을 쓴다 — 서로 다른 사고라 한 번에 지급되지 않는다
 *      max      가장 큰 금액 하나(한도·1회 지급 담보)
 *      daily    하루 금액 중 가장 큰 값(일당)
 *      presence 금액을 읽지 않아도 가입 여부로 본다(실손)
 *  · target   실무 참고 기준금액(원). 법정 기준이 아니고, 화면에서 고치는 기준금액(그룹)과도 별개다.
 *  · cause    'disease' | 'accident' — 담보 이름의 원인 표기로 가른다. 원인 표기가 없는 담보는
 *             양쪽에 함께 센다(공통). 하나의 담보로 두 기둥이 차는 대신, 화면에 '공통'으로 밝힌다.
 *  · include / exclude  담보 이름에서 이 기둥에 넣을 말 / 뺄 말. include 가 null 이면 그룹 전체.
 */
export const PILLAR_ROOT = {
  label: "실손의료비",
  short: "실손",
  note: "입원·통원 의료비를 한도 안에서 보상하는 뿌리입니다. 1~5세대에 따라 자기부담률이 달라지고, 두 건이면 비례보상됩니다.",
};

export const PILLARS = [
  {
    id: "cancer-general",
    label: "일반암 진단비",
    short: "일반암",
    group: "cancer",
    measure: "sum",
    target: 30000000,
    include: /암/,
    exclude: /(유사암|소액암|갑상선|피부암|자궁경부|제자리|경계성|수술|항암|표적|면역|호르몬|방사선|치료|입원|일당|통원|처방)/,
  },
  {
    id: "cancer-similar",
    label: "유사암·소액암 진단비",
    short: "유사암",
    group: "cancer",
    measure: "sum",
    target: 10000000,
    include: /(유사암|소액암|갑상선|피부암|자궁경부|제자리|경계성)/,
    exclude: /(수술|항암|표적|치료|입원|일당)/,
  },
  {
    id: "cancer-surgery",
    label: "암 수술비",
    short: "암수술",
    group: "cancer",
    measure: "sum",
    target: 5000000,
    include: /수술/,
    exclude: /(입원|일당)/,
  },
  {
    id: "cancer-treatment",
    label: "항암 치료비",
    short: "항암치료",
    group: "cancer",
    measure: "max",
    target: 20000000,
    include: /(항암|표적|면역|호르몬|방사선|약물|치료비)/,
    exclude: /수술/,
    note: "치료 종류(수술·방사선·약물)별로 지급되므로 더하지 않고 큰 금액 하나로 봅니다.",
  },
  {
    id: "cancer-daily",
    label: "암 입원일당",
    short: "암입원",
    group: "cancer",
    measure: "daily",
    target: 50000,
    include: /(입원|일당)/,
    exclude: null,
  },
  {
    id: "brain-vascular",
    label: "뇌혈관질환 진단비",
    short: "뇌혈관",
    group: "brain",
    measure: "sum",
    target: 10000000,
    include: /뇌/,
    exclude: /(수술|치료|입원|일당|후유장해|장해|치매)/,
  },
  {
    id: "brain-heart",
    label: "허혈성심장질환 진단비",
    short: "허혈성심장",
    group: "brain",
    measure: "sum",
    target: 10000000,
    include: /(심장|심근|협심|허혈|관상동맥)/,
    exclude: /(수술|치료|입원|일당|후유장해|장해)/,
  },
  {
    id: "brain-surgery",
    label: "뇌·심장 수술비",
    short: "뇌심수술",
    group: "brain",
    measure: "sum",
    target: 5000000,
    include: /수술/,
    exclude: /(입원|일당)/,
  },
  {
    id: "brain-treatment",
    label: "뇌·심장 주요치료비",
    short: "뇌심치료",
    group: "brain",
    measure: "max",
    target: 10000000,
    include: /(주요치료|치료|중환자실|혈전용해|스텐트)/,
    exclude: /수술/,
    note: "혈전용해·수술·중환자실처럼 치료 종류별로 지급되어 큰 금액 하나로 봅니다.",
  },
  {
    id: "surgery-disease",
    label: "질병 수술비",
    short: "질병수술",
    group: "surgery",
    measure: "sum",
    target: 3000000,
    include: null,
    exclude: /(화상|골절|치아|치과|화재|산재|장기이식)/,
    cause: "disease",
  },
  {
    id: "surgery-accident",
    label: "상해 수술비",
    short: "상해수술",
    group: "surgery",
    measure: "sum",
    target: 3000000,
    include: null,
    exclude: /(화상|골절|치아|치과|화재|산재|장기이식)/,
    cause: "accident",
  },
  {
    id: "hospital-disease",
    label: "질병 입원일당",
    short: "질병입원",
    group: "hospital",
    measure: "daily",
    target: 50000,
    include: /(입원|일당)/,
    exclude: /(간병|간호|요양|치매)/,
    cause: "disease",
  },
  {
    id: "hospital-accident",
    label: "상해 입원일당",
    short: "상해입원",
    group: "hospital",
    measure: "daily",
    target: 50000,
    include: /(입원|일당)/,
    exclude: /(간병|간호|요양|치매)/,
    cause: "accident",
  },
  {
    id: "care-daily",
    label: "간병인 사용 일당",
    short: "간병",
    group: "hospital",
    measure: "daily",
    target: 100000,
    include: /(간병|간호|요양)/,
    exclude: /치매/,
  },
  {
    id: "care-dementia",
    label: "중증 치매 진단비",
    short: "치매",
    group: "hospital",
    measure: "sum",
    target: 10000000,
    include: /치매/,
    exclude: null,
  },
  {
    id: "outpatient",
    label: "통원·처방비",
    short: "통원",
    group: "outpatient",
    measure: "max",
    target: 10000,
    include: null,
    exclude: null,
    note: "통원 1회당 정액입니다. 횟수 한도는 담보마다 달라 약관으로 확인합니다.",
  },
  {
    id: "death-disease",
    label: "질병 사망보험금",
    short: "질병사망",
    group: "death",
    measure: "sum",
    target: 100000000,
    include: /사망/,
    exclude: null,
    cause: "disease",
  },
  {
    id: "death-accident",
    label: "재해 사망보험금",
    short: "재해사망",
    group: "death",
    measure: "sum",
    target: 100000000,
    include: /사망/,
    exclude: null,
    cause: "accident",
  },
  {
    id: "disability-disease",
    label: "질병 후유장해",
    short: "질병장해",
    group: "death",
    measure: "sum",
    target: 100000000,
    include: /(후유장해|장해)/,
    exclude: /사망/,
    cause: "disease",
    note: "가입금액의 3~100%를 지급하는 비율 담보입니다. 금액을 읽지 못하면 '확인 필요'로 둡니다.",
  },
  {
    id: "disability-accident",
    label: "상해 후유장해",
    short: "상해장해",
    group: "death",
    measure: "sum",
    target: 100000000,
    include: /(후유장해|장해)/,
    exclude: /사망/,
    cause: "accident",
    note: "가입금액의 3~100%를 지급하는 비율 담보입니다. 금액을 읽지 못하면 '확인 필요'로 둡니다.",
  },
  {
    id: "injury-fracture",
    label: "골절 진단비",
    short: "골절",
    group: "etc",
    measure: "sum",
    target: 500000,
    include: /(골절|깁스)/,
    exclude: /(화상|화재)/,
  },
  {
    id: "injury-burn",
    label: "화상 진단비",
    short: "화상",
    group: "etc",
    measure: "sum",
    target: 500000,
    include: /화상/,
    exclude: /화재/,
  },
  {
    id: "driver-traffic",
    label: "교통사고처리지원금",
    short: "교통사고",
    group: "driver",
    measure: "max",
    target: 200000000,
    include: /(교통사고|사고처리)/,
    exclude: /(변호사|법률|벌금|합의)/,
  },
  {
    id: "driver-lawyer",
    label: "변호사선임·벌금",
    short: "변호사",
    group: "driver",
    measure: "max",
    target: 50000000,
    include: /(변호사|법률|벌금|합의)/,
    exclude: null,
  },
  {
    id: "liability",
    label: "일상생활배상책임",
    short: "배상책임",
    group: "liability",
    measure: "max",
    target: 100000000,
    include: null,
    exclude: null,
  },
];

export const PILLAR_TOTAL = PILLARS.length;
export const PILLAR_STATUS_LABELS = { met: "충족", short: "부족", none: "미보유", check: "확인 필요" };
export const PILLAR_NOTE =
  "기둥 기준금액은 보장분석 실무에서 쓰는 참고값(당사 기준)이며 법정 기준이 아닙니다. 원인(질병·재해) 표기가 없는 담보는 두 기둥에 함께 세고, 금액을 읽지 못한 담보는 0원이 아니라 '확인 필요'로 둡니다.";

const CAUSE_WORDS = { disease: /질병|질환/, accident: /재해|상해|교통|사고/ };

/** 담보 이름의 원인 표기 — 질병 / 재해 / 둘 다 / 구분 없음(공통) */
export function causeOf(name) {
  const s = String(name || "");
  const d = CAUSE_WORDS.disease.test(s);
  const a = CAUSE_WORDS.accident.test(s);
  if (d && a) return "both";
  if (d) return "disease";
  if (a) return "accident";
  return "common";
}

function causeFits(name, cause) {
  const c = causeOf(name);
  return c === "both" || c === "common" || c === cause;
}

/** 기둥 하나에 들어가는 담보를 고른다 */
export function pillarItems(pillar, coverages) {
  const p = PILLARS.find((x) => x.id === pillar) || pillar;
  if (!p) return [];
  return (Array.isArray(coverages) ? coverages : []).filter((c) => {
    if (c.group !== p.group) return false;
    const name = String(c.name || "");
    if (p.include && !p.include.test(name)) return false;
    if (p.exclude && p.exclude.test(name)) return false;
    if (p.cause && !causeFits(name, p.cause)) return false;
    return true;
  });
}

/** 고른 담보들에서 기둥의 한 숫자를 낸다. 읽지 못했으면 null(0원이 아니다). */
function pillarValue(measure, items) {
  if (measure === "presence") return null;
  const nums = items.filter((c) => c.kind !== "rate" && Number(c.amount) > 0).map((c) => Number(c.amount));
  if (!nums.length) return null;
  if (measure === "daily" || measure === "max") return Math.max(...nums);
  if (measure === "causeMax") {
    const buckets = {};
    for (const c of items) {
      if (c.kind === "rate" || !(Number(c.amount) > 0)) continue;
      const k = causeOf(c.name);
      buckets[k] = (buckets[k] || 0) + Number(c.amount);
    }
    const vals = Object.values(buckets);
    return vals.length ? Math.max(...vals) : null;
  }
  return nums.reduce((a, v) => a + v, 0);
}

/**
 * 보유 담보(또는 보유+제안) → 25개 기둥의 충족·부족·미보유와 '보장 기둥 N / 25'.
 *  · 충족(met)   : 기준금액 이상
 *  · 부족(short) : 담보는 있지만 기준금액에 못 미침
 *  · 미보유(none): 표에 없음(0원이 아니라 '없음')
 *  · 확인(check) : 담보는 있는데 금액을 읽지 못함(비율 담보 등) — 0원으로 바꾸지 않는다
 * N(보장 기둥)은 충족만 센다. 부족·확인을 충족으로 올리지 않는다.
 */
export function pillars(coverages, opts = {}) {
  const list = Array.isArray(coverages) ? coverages : [];
  const items = PILLARS.map((p) => {
    const matched = pillarItems(p, list);
    const value = pillarValue(p.measure, matched);
    let status;
    if (!matched.length) status = "none";
    else if (p.measure === "presence") status = "met";
    else if (value == null) status = "check";
    else status = value >= p.target ? "met" : "short";
    const g = GROUP_BY_ID[p.group] || {};
    const common = Boolean(p.cause) && matched.some((c) => ["common", "both"].includes(causeOf(c.name)));
    return {
      id: p.id,
      label: p.label,
      short: p.short,
      group: p.group,
      groupLabel: g.label || p.group,
      tone: g.tone || "#55626e",
      measure: p.measure,
      cause: p.cause || "",
      target: p.target,
      value,
      status,
      statusLabel: PILLAR_STATUS_LABELS[status],
      ratio: value != null && p.target ? value / p.target : null,
      count: matched.length,
      names: matched.map((c) => c.name),
      common,
      note: p.note || "",
    };
  });
  const count = (s) => items.filter((i) => i.status === s).length;
  const met = count("met");
  const silsonItems = list.filter((c) => c.group === "silson");
  const sil = detectSilson(silsonItems);
  const groups = GROUPS.filter((g) => items.some((i) => i.group === g.id)).map((g) => {
    const gi = items.filter((i) => i.group === g.id);
    return {
      id: g.id,
      label: g.label,
      short: g.short,
      tone: g.tone,
      met: gi.filter((i) => i.status === "met").length,
      total: gi.length,
    };
  });
  const pick = (s) => items.filter((i) => i.status === s);
  return {
    at: opts.at || "",
    total: PILLARS.length,
    met,
    short: count("short"),
    none: count("none"),
    check: count("check"),
    ratio: PILLARS.length ? met / PILLARS.length : 0,
    summaryLine: `보장 기둥 ${met} / ${PILLARS.length}`,
    items,
    groups,
    thin: pick("short"),
    empty: pick("none"),
    unconfirmed: pick("check"),
    root: {
      label: PILLAR_ROOT.label,
      short: PILLAR_ROOT.short,
      note: PILLAR_ROOT.note,
      status: silsonItems.length ? "met" : "none",
      statusLabel: silsonItems.length ? "가입" : "미보유",
      count: silsonItems.length,
      generation: sil.generation,
      generationLabel: sil.label,
      from: sil.from,
      names: silsonItems.map((c) => c.name),
    },
    note: PILLAR_NOTE,
  };
}

/**
 * 기존 vs 제안 — 기둥 단위 이동.
 *  change: new(미보유→충족, 새로 세워짐) · filled(부족→충족) · up(부족끼리 증액) ·
 *          lost(충족→아래로) · dropped(있던 담보가 빠짐) · same · none(여전히 미보유)
 */
export function comparePillars(before, after) {
  const a = pillars(before);
  const b = pillars(after);
  const items = a.items.map((x, i) => {
    const y = b.items[i];
    let change = "same";
    if (x.status !== "met" && y.status === "met") change = x.status === "none" ? "new" : "filled";
    else if (x.status === "met" && y.status !== "met") change = "lost";
    else if (x.status === "none" && y.status !== "none") change = "raised";
    else if (x.status !== "none" && y.status === "none") change = "dropped";
    else if (y.status === "short" && x.status === "short" && (y.value || 0) > (x.value || 0)) change = "up";
    return {
      id: x.id,
      label: x.label,
      short: x.short,
      group: x.group,
      groupLabel: x.groupLabel,
      tone: x.tone,
      measure: x.measure,
      target: x.target,
      before: { status: x.status, value: x.value, count: x.count },
      after: { status: y.status, value: y.value, count: y.count },
      delta: x.value != null || y.value != null ? (y.value || 0) - (x.value || 0) : null,
      change,
    };
  });
  const built = items.filter((i) => i.change === "new");
  const filled = items.filter((i) => i.change === "filled");
  const lost = items.filter((i) => ["lost", "dropped", "down"].includes(i.change));
  const empty = items.filter((i) => i.after.status !== "met");
  return {
    before: a,
    after: b,
    items,
    built,
    filled,
    lost,
    empty,
    metDelta: b.met - a.met,
    summaryLine: `보장 기둥 ${a.met} / ${a.total} → ${b.met} / ${b.total}`,
    changed: items.filter((i) => i.change !== "same" && i.change !== "none").length,
  };
}

/** 기둥 비교를 한 줄 문장들로 — 화면·인쇄·증권북이 같은 문구를 쓴다 */
export function pillarCompareLines(cmp) {
  if (!cmp) return [];
  const out = [cmp.summaryLine];
  if (cmp.metDelta) out.push(`충족 ${cmp.metDelta > 0 ? "+" : "−"}${Math.abs(cmp.metDelta)}개`);
  if (cmp.built.length) out.push(`새로 세워지는 기둥 — ${cmp.built.map((i) => i.label).join(", ")}`);
  if (cmp.filled.length) out.push(`부족에서 충족으로 — ${cmp.filled.map((i) => i.label).join(", ")}`);
  if (cmp.empty.length) out.push(`제안 후에도 비어 있는 기둥 ${cmp.empty.length}개`);
  if (cmp.lost.length) out.push(`약해지는 기둥 — ${cmp.lost.map((i) => i.label).join(", ")}`);
  return out;
}

/* ────────────────────────── 계약(상품) 단위 묶음 ────────────────────────── */

/** 담보가 어느 계약에 속하는지 가르는 열쇠 — 보험사·상품명·계약일 */
export function contractKeyOf(c) {
  const s = (v) => String(v == null ? "" : v).trim();
  return [s(c.insurer), s(c.product), s(c.startDate).slice(0, 10)].join("|");
}

/**
 * 담보 목록 → 계약(상품) 단위 표.
 *
 *  · 담보마다 붙은 보험사·상품명·계약일로 묶는다(같은 계약의 담보는 같은 값이 붙어 있다).
 *  · opts.contracts 로 계약 원장([{insurer, product, startDate, premium, payTerm, coverTerm, paidTotal}])을
 *    넘기면 담보에 보험료가 없어도 그 계약의 월 보험료를 채운다(InsureCRM).
 *  · 성격이 다른 정액 담보를 하나로 더한 '총 보장금액'은만들지 않는다. 합산은 월 보험료·총납입 추정만.
 */
export function groupContracts(coverages, opts = {}) {
  const list = Array.isArray(coverages) ? coverages : [];
  const extra = Array.isArray(opts.contracts) ? opts.contracts : [];
  const map = new Map();
  const upsert = (key, seed) => {
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        insurer: seed.insurer || "",
        product: seed.product || "",
        startDate: seed.startDate || "",
        payTerm: seed.payTerm || "",
        coverTerm: seed.coverTerm || "",
        premiumSum: 0,
        premiumKnown: false,
        ledgerPremium: seed.premium == null ? null : Number(seed.premium) || 0,
        paidTotalSum: 0,
        ledgerPaidTotal: seed.paidTotal == null ? null : Number(seed.paidTotal) || 0,
        items: [],
      };
      map.set(key, g);
    } else {
      /* 원장이 먼저 들어온 경우 비어 있던 값을 채운다 */
      for (const k of ["insurer", "product", "startDate", "payTerm", "coverTerm"]) {
        if (!g[k] && seed[k]) g[k] = seed[k];
      }
      if (g.ledgerPremium == null && seed.premium != null) g.ledgerPremium = Number(seed.premium) || 0;
      if (g.ledgerPaidTotal == null && seed.paidTotal != null) g.ledgerPaidTotal = Number(seed.paidTotal) || 0;
    }
    return g;
  };

  for (const k of extra) {
    upsert(contractKeyOf(k), {
      insurer: k.insurer,
      product: k.product,
      startDate: isoDate(k.startDate),
      payTerm: k.payTerm || "",
      coverTerm: k.coverTerm || "",
      premium: k.premium,
      paidTotal: k.paidTotal,
    });
  }
  for (const c of list) {
    const g = upsert(contractKeyOf(c), { insurer: c.insurer, product: c.product, startDate: isoDate(c.startDate) });
    g.items.push(c);
    if (c.premium != null && Number(c.premium) > 0) {
      g.premiumSum += Number(c.premium);
      g.premiumKnown = true;
    }
    if (c.paidTotal != null && Number(c.paidTotal) > 0) g.paidTotalSum += Number(c.paidTotal);
    if (!g.payTerm && c.payTerm) g.payTerm = c.payTerm;
    if (!g.coverTerm && c.coverTerm) g.coverTerm = c.coverTerm;
  }

  const groups = [...map.values()]
    .map((g) => {
      /* 계약 원장(InsureCRM)이 있으면 그 계약의 월 보험료가 우선이다 — 담보 행의 보험료를 고쳐도
         계약 자체의 보험료는 남아 있기 때문. 원장이 없으면(웹) 담보별 보험료를 더한다. */
      const premium = g.ledgerPremium != null ? g.ledgerPremium : g.premiumKnown ? g.premiumSum : null;
      const paidTotal = g.paidTotalSum > 0 ? g.paidTotalSum : g.ledgerPaidTotal != null ? g.ledgerPaidTotal : estimatePaidTotal(premium, g.payTerm);
      const withAmount = g.items
        .filter((c) => c.kind !== "rate" && Number(c.amount) > 0)
        .sort((a, b) => Number(b.amount) - Number(a.amount));
      const top = (withAmount.length ? withAmount : g.items).slice(0, 3).map((c) => (c.kind === "daily" ? `${c.name} 일당` : c.name));
      return {
        key: g.key,
        insurer: g.insurer,
        product: g.product,
        startDate: g.startDate,
        payTerm: g.payTerm,
        coverTerm: g.coverTerm,
        count: g.items.length,
        premium,
        premiumKnown: premium != null && premium > 0,
        paidTotal: paidTotal || null,
        top,
        kinds: {
          lump: g.items.filter((c) => c.kind === "lump").length,
          daily: g.items.filter((c) => c.kind === "daily").length,
          limit: g.items.filter((c) => c.kind === "limit").length,
          rate: g.items.filter((c) => c.kind === "rate").length,
        },
        /** 보험사·상품명이 모두 비어 있으면 '계약 구분 없음'으로 보여 준다 */
        unnamed: !g.insurer && !g.product,
        items: g.items,
      };
    })
    .sort((a, b) => {
      if (a.unnamed !== b.unnamed) return a.unnamed ? 1 : -1;
      const d = String(a.startDate || "").localeCompare(String(b.startDate || ""));
      if (d) return d;
      return String(a.insurer + a.product).localeCompare(String(b.insurer + b.product), "ko");
    });

  const premiumTotal = groups.reduce((a, g) => a + (g.premiumKnown ? g.premium : 0), 0);
  const paidTotal = groups.reduce((a, g) => a + (g.paidTotal || 0), 0);
  return {
    groups,
    count: groups.length,
    premium: premiumTotal > 0 ? premiumTotal : null,
    paidTotal: paidTotal > 0 ? paidTotal : null,
    unnamed: groups.filter((g) => g.unnamed).reduce((a, g) => a + g.count, 0),
    note:
      "계약 단위 표는 담보에 적힌 보험사·상품명·계약일로 묶습니다. 성격이 다른 정액 담보 금액은 더하지 않고, 월 보험료와 총납입 추정만 합산합니다.",
  };
}

/* ────────────────────────────── 복사용 문구 ────────────────────────────── */

/** 카톡·문자로 보낼 요약 문구 — 숫자는 요약 결과를 그대로 옮긴다 */
export function buildMessage(summary, opts = {}) {
  const name = opts.name ? `${opts.name}님 ` : "";
  const lines = [`${name}보장 정리 요약`, ""];
  const pil = opts.pillars || (summary && summary.pillars) || null;
  if (summary.count) {
    lines.push(`· 담보 ${summary.count}건${summary.contracts ? ` · 계약 ${summary.contracts}건` : ""}`);
    if (summary.premiumKnown) lines.push(`· 월 보험료 합계 ${summary.premium.toLocaleString("ko-KR")}원`);
    if (pil) {
      const extra = [];
      if (pil.short) extra.push(`부족 ${pil.short}`);
      if (pil.check) extra.push(`확인 ${pil.check}`);
      if (pil.none) extra.push(`미보유 ${pil.none}`);
      lines.push(`· ${pil.summaryLine}${extra.length ? ` (${extra.join(" · ")})` : ""}`);
      if (pil.root.status !== "met") lines.push("· 뿌리 실손: 미보유 — 의료비 담보가 표에 없습니다");
    }
    if (summary.silson.found) {
      lines.push(`· 실손 ${summary.silson.label ? `${summary.silson.label}${summary.silson.from === "계약일" ? "(계약일 기준)" : ""}` : "세대 확인 필요"}`);
    }
    lines.push("");
    for (const g of summary.groups) {
      if (!g.has) continue;
      const parts = [];
      if (g.lump) parts.push(formatMan(g.lump));
      if (g.daily.length) {
        const dailyAmounts = [...new Set(g.daily.map((d) => d.amount || 0))].filter((v) => v > 0).sort((a, b) => b - a);
        if (dailyAmounts.length) parts.push(`일 ${formatMan(dailyAmounts[0])}${dailyAmounts.length > 1 ? ` 외 ${dailyAmounts.length - 1}` : ""}`);
      }
      if (!g.lump && !g.daily.length && g.limits.length) parts.push("가입");
      lines.push(`· ${g.label}: ${parts.join(" / ") || "가입"}`);
    }
  } else {
    lines.push("아직 담보가 정리되지 않았습니다. 증권이나 설계서를 넣어 주세요.");
  }
  const checks = summary.checks.filter((c) => c.level === "check");
  if (checks.length) {
    lines.push("", "확인할 점");
    for (const c of checks.slice(0, 4)) lines.push(`· ${c.text}`);
  }
  lines.push("", "정리한 내용은 참고용입니다. 실제 지급 여부·금액은 약관과 보험사 심사에 따릅니다.");
  return lines.join("\n");
}

/* ────────────────────────────── 샘플 ────────────────────────────── */

/** 화면 예시용 가상 자료(실제 고객 아님) — 두 설계의 차이를 보여 준다. 보험사·상품명도 가상이다. */
export const SAMPLES = {
  before: `보험사: 한결생명
상품명: 무배당 한결 종신보험
계약일: 2014-03-12
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
질병사망\t1,000만원\t3,000원
재해사망\t5,000만원\t2,000원

보험사: 한결생명
상품명: 무배당 한결 건강보험
계약일: 2016-09-05
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
암진단비\t2,000만원\t9,800원
유사암진단비\t500만원\t1,200원
뇌혈관질환진단비\t1,000만원\t4,300원
허혈성심장질환진단비\t1,000만원\t3,900원
질병수술비\t200만원\t2,100원
상해수술비\t200만원\t1,500원
질병입원일당\t3만원\t1,800원

보험사: 바른손해보험
상품명: 무배당 바른 실손의료보험
계약일: 2021-11-02
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
실손의료비(4세대)\t\t18,400원

보험사: 바른손해보험
상품명: 무배당 바른 운전자보험
계약일: 2019-06-18
납입기간: 20년납
만기: 80세
담보명\t가입금액\t월보험료
교통사고처리지원금\t2,000만원\t1,100원
`,
  after: `보험사: 한결생명
상품명: 무배당 한결 종신보험(개편)
가입예정일: 2026-12-01
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
질병사망\t1억원\t12,000원
재해사망\t1억원\t6,000원

보험사: 한결생명
상품명: 무배당 한결 건강보험(개편)
가입예정일: 2026-12-01
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
암진단비\t5,000만원\t21,000원
유사암진단비\t1,000만원\t2,400원
뇌혈관질환진단비\t2,000만원\t7,600원
허혈성심장질환진단비\t2,000만원\t6,900원
질병수술비\t500만원\t3,400원
상해수술비\t500만원\t2,600원
질병입원일당\t5만원\t2,900원
간병인사용일당\t10만원\t4,200원

보험사: 바른손해보험
상품명: 무배당 바른 실손의료보험
계약일: 2021-11-02
납입기간: 20년납
만기: 100세
담보명\t가입금액\t월보험료
실손의료비(4세대)\t\t18,400원

보험사: 바른손해보험
상품명: 무배당 바른 운전자보험(개편)
가입예정일: 2026-12-01
납입기간: 20년납
만기: 80세
담보명\t가입금액\t월보험료
교통사고처리지원금\t1억원\t2,800원
변호사선임비용\t5,000만원\t1,600원
`,
};

/* ────────────────────────── 내보내기(CSV·증권북) ────────────────────────── */

/**
 * 기준일 표기 — Date·'2026-11-27'·'2026. 11. 27.' 어느 것이 와도 `YYYY-MM-DD` 로 맞춘다.
 * 화면이 넘긴 기준일(baseDate)이 CSV 요약 행·증권북 표지에 그대로 찍히게 하는 자리다.
 * (기존에는 '2026. 11. 27.' 을 10자로 잘라 '2026. 11. ' 만 남아 일자가 빠졌다.)
 */
export function isoDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s.slice(0, 10);
}

const csvCell = (v) => {
  const s = String(v == null ? "" : v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * 담보 표 + 요약 → CSV 문자열(엑셀에서 바로 열린다).
 * 화면은 앞에 BOM(\uFEFF)을 붙여 저장한다 — 한글이 깨지지 않게.
 */
export function buildCSV(coverages, summary) {
  const list = Array.isArray(coverages) ? coverages : [];
  const head = ["구분", "담보", "보장그룹", "지급방식", "가입금액(원)", "지급비율", "월보험료(원)", "갱신", "납입기간", "만기", "보험사", "가입일", "비고"];
  const rows = [head];
  for (const c of list) {
    const g = GROUP_BY_ID[c.group];
    rows.push([
      summary && summary.label ? summary.label : "",
      c.name,
      g ? g.label : c.group,
      PAY_KINDS[c.kind] || c.kind,
      c.amount == null ? "" : c.amount,
      c.rate || "",
      c.premium == null ? "" : c.premium,
      c.renew || "",
      c.payTerm || "",
      c.coverTerm || "",
      c.insurer || "",
      c.startDate || "",
      c.confidence === "high" ? "" : c.confidence === "mid" ? "금액 확인" : "분류 확인",
    ]);
  }
  rows.push([]);
  rows.push(["요약", "담보", "계약", "월 보험료", "총납입보험료(추정)", "실손 세대", "기준일"]);
  rows.push([
    summary ? summary.label : "",
    summary ? summary.count : "",
    summary && summary.contracts != null ? summary.contracts : "",
    summary && summary.premium != null ? summary.premium : "",
    summary && summary.paidTotal ? summary.paidTotal : "",
    summary && summary.silson && summary.silson.label ? summary.silson.label : "확인 필요",
    isoDate(summary && summary.at),
  ]);
  rows.push([]);
  rows.push(["그룹", "정액", "수술·치료", "일당", "기준금액", "충족률(%)", "판정"]);
  const groups = (summary && summary.groups) || [];
  for (const g of groups.filter((x) => x.has)) {
    const dailyTop = g.daily.length ? Math.max(...g.daily.map((d) => d.amount || 0)) : "";
    rows.push([
      g.label,
      g.lump || "",
      g.surgery + g.treatment || "",
      dailyTop,
      g.target || "",
      g.ratio == null ? "" : Math.round(g.ratio * 1000) / 10,
      g.levelLabel || "",
    ]);
  }

  /* 계약(상품) 단위 — 정액 담보 금액은 더하지 않고 월 보험료·총납입만 합산한다 */
  const ct = (summary && summary.contractTable) || groupContracts(list);
  if (ct.groups.length) {
    rows.push([]);
    rows.push(["계약", "보험사", "상품명", "계약일", "납입기간", "만기", "월 보험료(원)", "총납입 추정(원)", "담보 수", "주요 담보"]);
    for (const g2 of ct.groups) {
      rows.push([
        summary && summary.label ? summary.label : "",
        g2.unnamed ? "(미기재)" : g2.insurer || "",
        g2.unnamed ? "계약 구분 없음" : g2.product || "",
        g2.startDate || "",
        g2.payTerm || "",
        g2.coverTerm || "",
        g2.premiumKnown ? g2.premium : "",
        g2.paidTotal || "",
        g2.count,
        g2.top.join(" · "),
      ]);
    }
    rows.push([
      "합계",
      `계약 ${ct.count}건`,
      "",
      "",
      "",
      "",
      ct.premium == null ? "" : ct.premium,
      ct.paidTotal == null ? "" : ct.paidTotal,
      ct.groups.reduce((a, g2) => a + g2.count, 0),
      "정액 담보 금액은 더하지 않음",
    ]);
  }

  /* 25개 보장 기둥 체크리스트 */
  const pil = (summary && summary.pillars) || pillars(list);
  rows.push([]);
  rows.push(["보장 기둥", pil.summaryLine, `부족 ${pil.short}`, `확인 ${pil.check}`, `미보유 ${pil.none}`, "", ""]);
  rows.push([
    "뿌리 실손",
    pil.root.statusLabel,
    pil.root.generationLabel || "",
    "",
    "",
    "",
    pil.root.names.join(" · "),
  ]);
  rows.push(["기둥", "보장 그룹", "상태", "가입 금액(원)", "기준(원)", "가입 담보", ""]);
  for (const it of pil.items) {
    rows.push([
      it.label,
      it.groupLabel,
      it.statusLabel,
      it.value == null ? "" : it.value,
      it.target == null ? "" : it.target,
      it.names.join(" · "),
      it.common ? "공통" : "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * 증권북형 출력 — 표지 · 탭별 요약 · 기준 대비 판정 · 비교 · 보험사 연락처.
 * opts: { name, at, insurers, compare, letter }
 */
export function buildBookHTML(summary, opts = {}) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const man = (v) => formatMan(v);
  const at = isoDate(opts.at || (summary && summary.at) || "");
  const insurers = Array.isArray(opts.insurers) ? opts.insurers : [];
  const days = [
    { key: "silson", tab: "실손" },
    { key: "cancer", tab: "암·진단비" },
    { key: "brain", tab: "뇌·심장" },
    { key: "surgery", tab: "수술·처치" },
    { key: "outpatient", tab: "통원·처방" },
    { key: "hospital", tab: "입원·간병" },
    { key: "driver", tab: "운전자" },
    { key: "liability", tab: "배상" },
    { key: "death", tab: "사망·후유" },
    { key: "etc", tab: "기타" },
  ];
  const byId = Object.fromEntries(((summary && summary.groups) || []).map((g) => [g.id, g]));
  const tabs = days
    .map((d) => {
      const g = byId[d.key];
      if (!g || !g.has) return "";
      const lines = g.items
        .slice(0, 40)
        .map(
          (c) =>
            `<tr><td>${esc(c.name)}${c.renew ? `<span class="tag">${esc(c.renew)}</span>` : ""}</td><td class="r">${esc(
              c.kind === "rate" ? c.rate : c.kind === "limit" ? "가입" : man(c.amount)
            )}</td><td class="r">${c.premium == null ? "" : `${c.premium.toLocaleString("ko-KR")}원`}</td><td class="s">${esc(
              [c.payTerm, c.coverTerm].filter(Boolean).join(" · ")
            )}</td></tr>`
        )
        .join("");
      const judge = g.target
        ? `<p class="judge">기준 ${man(g.target)} 대비 <b>${esc(g.levelLabel)}</b> (${Math.round((g.ratio || 0) * 100)}%)</p>`
        : "";
      return `<section class="day"><h2>${esc(d.tab)} <span class="cnt">${g.count}건</span></h2>${judge}<table><thead><tr><th>담보</th><th class="r">금액</th><th class="r">월 보험료</th><th class="s">납입·만기</th></tr></thead><tbody>${lines}</tbody></table></section>`;
    })
    .join("");
  const judgeRows = ((summary && summary.judge) || [])
    .map((j) => `<tr><td>${esc(j.label)}</td><td class="r">${man(j.value)}</td><td class="r">${man(j.target)}</td><td class="r">${j.ratio == null ? "" : `${Math.round(j.ratio * 100)}%`}</td><td class="r"><span class="lv ${esc(j.level)}">${esc(j.levelLabel)}</span></td></tr>`)
    .join("");
  /* 25개 기둥 — 표지 통계와 본문 체크리스트 */
  const pil = (summary && summary.pillars) || pillars([]);
  const pillarGroups = pil.groups
    .map(
      (g) => `<div class="pgrp"><div class="pgh"><span class="dot" style="background:${esc(g.tone)}"></span>${esc(g.label)}<small>${g.met}/${g.total}</small></div><div class="pills">${pil.items
        .filter((it) => it.group === g.id)
        .map(
          (it) => `<span class="pill ${esc(it.status)}"><b>${esc(it.label)}</b><i>${esc(
            it.measure === "presence" ? "가입" : it.value == null ? "—" : `${it.measure === "daily" ? "일 " : ""}${man(it.value)}`
          )}</i></span>`,
        )
        .join("")}</div></div>`,
    )
    .join("");
  const pillarHTML = `<section class="day"><h2>보장 기둥 <span class="cnt">${pil.summaryLine}</span></h2>
    <div class="pscore"><b>${pil.met} / ${pil.total}</b><span>층족 ${pil.met} · 부족 ${pil.short} · 확인 ${pil.check} · 미보유 ${pil.none}</span></div>
    <p class="judge">뿌리 · ${esc(pil.root.label)} — <b>${esc(pil.root.status === "met" ? pil.root.generationLabel || "가입" : "미보유")}</b>${
      pil.root.names.length ? `<span class="sub2">${esc(pil.root.names.slice(0, 3).join(", "))}</span>` : ""
    }</p>
    ${pillarGroups}
    <p class="foot">${esc(pil.note)}</p></section>`;
  /* 계약(상품) 단위 표 — 정액 담보 금액은 더하지 않고 보험료·총납입만 합산 */
  const ct = (summary && summary.contractTable) || null;
  const contractHTML =
    ct && ct.groups.length
      ? `<section class="day"><h2>계약(상품) 단위 <span class="cnt">계약 ${ct.count}건 · 월 ${ct.premium != null ? man(ct.premium) : "보험료 미확인"}</span></h2><table><thead><tr><th>보험사</th><th>상품명</th><th class="r">계약일</th><th class="r">납입·만기</th><th class="r">월 보험료</th><th class="r">담보</th></tr></thead><tbody>${ct.groups
          .map(
            (g) => `<tr><td>${esc(g.unnamed ? "(미기재)" : g.insurer || "-")}</td><td>${esc(g.unnamed ? "계약 구분 없음" : g.product || "-")}<div class="s">${esc(g.top.join(" · "))}</div></td><td class="r">${esc(g.startDate || "-")}</td><td class="r">${esc([g.payTerm, g.coverTerm].filter(Boolean).join(" · ") || "-")}</td><td class="r">${g.premiumKnown ? `${g.premium.toLocaleString("ko-KR")}원` : "-"}</td><td class="r">${g.count}건</td></tr>`,
          )
          .join("")}</tbody></table><p class="foot">${esc(ct.note)}</p></section>`
      : "";
  const cmp = opts.compare;
  const cpil = cmp && cmp.pillars ? cmp.pillars : null;
  const cmpPillarHTML = cpil
    ? `<h3 class="sub3">보장 기둥 이동</h3><p class="judge"><b>${esc(cpil.summaryLine)}</b> (${
        cpil.metDelta >= 0 ? "+" : "−"
      }${Math.abs(cpil.metDelta)}) · 월 보험료 ${man(cmp.premium.before)} → ${man(cmp.premium.after)}${
        cmp.premium.delta == null ? "" : ` (${cmp.premium.delta > 0 ? "+" : cmp.premium.delta < 0 ? "−" : ""}${man(Math.abs(cmp.premium.delta))})`
      }</p>${
        cpil.built.length
          ? `<p class="judge">새로 세워지는 기둥 <span class="cnt">${cpil.built.length}</span> — ${cpil.built.map((i) => `<span class="chip2 ok">${esc(i.label)}</span>`).join(" ")}</p>`
          : ""
      }${
        cpil.filled.length
          ? `<p class="judge">부족에서 충족으로 — ${cpil.filled.map((i) => `<span class="chip2 ok">${esc(i.label)}</span>`).join(" ")}</p>`
          : ""
      }${
        cpil.empty.length
          ? `<p class="judge">제안 후에도 비어 있는 기둥 <span class="cnt">${cpil.empty.length}</span> — ${cpil.empty.map((i) => `<span class="chip2 none">${esc(i.label)}</span>`).join(" ")}</p>`
          : ""
      }${
        cpil.lost.length ? `<p class="judge">약해지는 기둥 — ${cpil.lost.map((i) => `<span class="chip2 warn">${esc(i.label)}</span>`).join(" ")}</p>` : ""
      }`
    : "";
  const cmpHTML = cmp
    ? `<section class="day"><h2>제안 비교</h2>${cmpPillarHTML}<table><thead><tr><th>그룹</th><th class="r">보유</th><th class="r">제안</th><th class="r">증감</th></tr></thead><tbody>${cmp.groups
        .filter((g) => g.status !== "none")
        .map((g) => `<tr><td>${esc(g.label)}</td><td class="r">${g.before.count ? man(g.before.lump) : "—"}</td><td class="r">${g.after.count ? man(g.after.lump) : "—"}</td><td class="r">${g.delta === 0 ? "—" : `${g.delta > 0 ? "+" : ""}${man(g.delta)}`}</td></tr>`)
        .join("")}</tbody></table></section>`
    : "";
  const contacts = insurers.length
    ? `<section class="day"><h2>보험사 고객센터</h2><div class="tel">${insurers
        .map((i) => `<div><b>${esc(i.name)}</b><span>${esc(i.phone)}</span></div>`)
        .join("")}</div><p class="foot">번호는 각 보험사 공식 홈페이지에서 확인한 값입니다. 표에 없는 보험사는 증권에 적힌 번호를 쓰세요.</p></section>`
    : "";
  const checks = ((summary && summary.checks) || [])
    .filter((c) => c.level === "check")
    .map((c) => `<li>${esc(c.text)}</li>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc((opts.name || "고객") + "님 보장 정리")}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif; color: #0b1b29; font-size: 11.5px; line-height: 1.55; margin: 0; }
  .cover { min-height: 92vh; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; border-top: 6px solid #0b1b29; padding-top: 28px; }
  .cover h1 { font-size: 30px; letter-spacing: -0.03em; margin: 0 0 4px; }
  .cover .sub { color: #55626e; }
  .cover .box { display: flex; gap: 8px; margin-top: 18px; }
  .cover .box div { flex: 1; border: 1px solid #dde3e8; border-radius: 8px; padding: 8px 10px; }
  .cover .box span { display: block; color: #55626e; font-size: 10.5px; }
  .cover .box b { font-size: 15px; }
  .cover .mt { margin-top: auto; color: #55626e; font-size: 10.5px; }
  section.day { page-break-inside: avoid; margin-bottom: 16px; }
  h2 { font-size: 13.5px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #0b1b29; }
  h2 .cnt { font-weight: 500; color: #55626e; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eaefF2; padding: 3.5px 5px; text-align: left; }
  th { background: #f4f2ea; font-size: 10.5px; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.s { color: #55626e; font-size: 10.5px; }
  .tag { margin-left: 4px; border: 1px solid #d8dfe5; border-radius: 3px; padding: 0 3px; font-size: 9.5px; color: #55626e; }
  .judge { margin: 2px 0 6px; color: #3f4b57; font-size: 11px; }
  .lv { padding: 0 4px; border-radius: 3px; font-weight: 700; }
  .lv.none, .lv.vlow { background: #f6e7ea; color: #a8455c; }
  .lv.low { background: #fdf1e0; color: #8a6320; }
  .lv.ok { background: #e6f2ec; color: #1f7a62; }
  .lv.rich { background: #e8eefc; color: #1233b8; }
  .tel { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
  .tel div { display: flex; justify-content: space-between; border-bottom: 1px dotted #dde3e8; padding: 2px 0; }
  .foot { margin-top: 10px; color: #55626e; font-size: 10px; }
  ul { margin: 4px 0 0 16px; padding: 0; }
  .pscore { display: flex; align-items: baseline; gap: 8px; margin: 2px 0 6px; }
  .pscore b { font-size: 22px; letter-spacing: -0.02em; }
  .pscore span { color: #55626e; font-size: 10.5px; }
  .pgrp { margin-bottom: 7px; }
  .pgh { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: #26333f; margin-bottom: 3px; }
  .pgh small { font-weight: 500; color: #55626e; }
  .pgh .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
  .pill { border: 1px solid #e6ebef; border-radius: 5px; padding: 3px 5px; display: flex; justify-content: space-between; gap: 4px; font-size: 9.5px; }
  .pill b { font-weight: 600; }
  .pill i { font-style: normal; font-variant-numeric: tabular-nums; white-space: nowrap; color: #55626e; }
  .pill.met { background: #e6f2ec; border-color: #cfe4d9; }
  .pill.short { background: #fdf1e0; border-color: #f0dfc4; }
  .pill.none { background: #fafafa; color: #8a949e; }
  .pill.check { background: #f1f3f6; border-color: #e2e7ec; }
  .sub2 { margin-left: 6px; color: #8a949e; font-size: 9.5px; }
  .sub3 { font-size: 11px; margin: 10px 0 3px; color: #26333f; }
  .chip2 { display: inline-block; border-radius: 3px; padding: 0 4px; font-size: 9.5px; }
  .chip2.ok { background: #e6f2ec; color: #1f7a62; }
  .chip2.none { background: #f6e7ea; color: #a8455c; }
  .chip2.warn { background: #fdf1e0; color: #8a6320; }
  td .s { color: #55626e; font-size: 9.5px; margin-top: 1px; }
</style></head><body>
<div class="cover">
  <div>
    <h1>${esc(opts.name ? opts.name + "님" : "고객")} 보장 정리</h1>
    <div class="sub">${esc(at ? `${at} 기준` : "")} · 담보 ${summary ? summary.count : 0}건${
      summary && summary.contracts != null ? ` · 계약 ${summary.contracts}건` : ""
    }</div>
    <div class="box">
      <div><span>월 보험료</span><b>${summary && summary.premium != null ? man(summary.premium) : "확인 필요"}</b></div>
      <div><span>총납입보험료(추정)</span><b>${summary && summary.paidTotal ? man(summary.paidTotal) : "—"}</b></div>
      <div><span>실손</span><b>${esc(summary && summary.silson && summary.silson.label ? summary.silson.label : "확인 필요")}</b></div>
      <div><span>보장 기둥</span><b>${(summary && summary.pillars ? summary.pillars.met : 0)} / ${(summary && summary.pillars ? summary.pillars.total : PILLAR_TOTAL)}</b></div>
    </div>
  </div>
  <div class="mt">
    ${opts.letter ? `<p>${esc(opts.letter)}</p>` : ""}
    <p>이 정리는 담보 이름을 기준으로 묶은 참고 자료입니다. 실제 지급 여부·금액·면책은 가입 약관과 보험사 심사에 따릅니다.</p>
  </div>
</div>

<section class="day"><h2>기준 대비 판정</h2>${judgeRows ? `<table><thead><tr><th>그룹</th><th class="r">가입</th><th class="r">기준</th><th class="r">충족률</th><th class="r">판정</th></tr></thead><tbody>${judgeRows}</tbody></table>` : `<p class="judge">기준금액을 넣으면 그룹별 부족·적정·충분을 표시합니다.</p>`}<p class="foot">${esc((summary && summary.targetsNote) || "")}</p></section>

${pillarHTML}
${contractHTML}

${checks ? `<section class="day"><h2>확인할 점</h2><ul>${checks}</ul></section>` : ""}
${tabs}
${cmpHTML}
${contacts}
<p class="foot">buffetkimz.com 보장분석 요약기에서 만든 자료입니다. 입력값은 브라우저 안에서만 처리됩니다.</p>
</body></html>`;
}
