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
    id: "surgery",
    group: "surgery",
    test: /(수술|절개|N대|n대|[1-5]종)/,
  },
  {
    id: "hospital",
    group: "hospital",
    test: /(입원|간병|간호|요양|치매|일당|통원)/,
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
  if (/일당/.test(name)) tags.push("daily");
  if (/후유장해|장해/.test(name)) tags.push("disability");
  if (/사망/.test(name)) tags.push("death");
  if (/갱신/.test(name)) tags.push("renewal");
  return tags;
}

/**
 * 담보 이름 → { group, kind, tags, rule }
 * 이름이 비었거나 어느 규칙에도 걸리지 않으면 '기타'(rule:null).
 */
export function classify(name) {
  const original = String(name || "");
  const s = original.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, "").trim();
  const tags = tagsOf(s);
  /* 비율 표기(3~100%)는 괄호 안에 있어도 살린다 — 금액이 아니라 비율 담보이기 때문 */
  const rate = /%/.test(original);
  for (const rule of RULES) {
    if (rule.test.test(s)) {
      const kind = rate ? "rate" : rule.kind || (tags.includes("daily") ? "daily" : kindOf(s));
      return { group: rule.group, kind, tags, rule: rule.id };
    }
  }
  return { group: "etc", kind: rate ? "rate" : kindOf(s), tags, rule: null };
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      cols = null;
      continue;
    }
    const cells = splitCells(line);

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
    rows.push({
      name,
      amount: isRate ? null : amount,
      rate: isRate ? amountRaw.trim() : "",
      premium: premium != null && premium < 1000000 ? premium : null,
      term: term || "",
      raw: line,
      unit,
    });
  }

  return { rows: rows.filter((r) => r.name), premiumSum, sawPremiumLabel };
}

/** 담보 이름 정리 — 앞 번호·불릿, 꼬리 주석을 떼어 낸다 */
function cleanName(s) {
  return String(s || "")
    .replace(/^[\s\d.)\-–•·*①-⑳]+/, "")
    .replace(/[·•\-–]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
    list.push({
      id: `${list.length + 1}`,
      name,
      group,
      kind,
      tags: cls.tags,
      amount: kind === "rate" ? null : amount,
      rate: r.rate || (kind === "rate" ? String(r.amountRaw || "") : ""),
      premium: r.premium == null ? null : Number(r.premium) || null,
      insurer: r.insurer || "",
      product: r.product || "",
      startDate: r.startDate || "",
      term: r.term || "",
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
 *  · targets    { [groupId]: 원 } — 있으면 충족률·부족 판정을 계산한다
 *  · targetsAreManwon  targets 가 만원 단위인지
 */
export function summarize(coverages, opts = {}) {
  const list = Array.isArray(coverages) ? coverages : [];
  const targets = opts.targets || null;
  const tMul = opts.targetsAreManwon ? 10000 : 1;

  const groups = GROUPS.map((g) => {
    const items = list.filter((c) => c.group === g.id);
    const lump = items.filter((c) => c.kind === "lump");
    const daily = items.filter((c) => c.kind === "daily");
    const limits = items.filter((c) => c.kind === "limit");
    const rates = items.filter((c) => c.kind === "rate");
    const lumpTotal = lump.reduce((a, c) => a + (c.amount || 0), 0);
    const target = targets && targets[g.id] != null ? Number(targets[g.id]) * tMul : null;
    let ratio = null;
    let level = items.length ? "has" : "none";
    if (target && target > 0) {
      ratio = lumpTotal / target;
      level = lumpTotal <= 0 ? "none" : ratio >= 1 ? "ok" : ratio >= 0.5 ? "low" : "vlow";
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
      daily,
      limits,
      rates,
      target,
      ratio,
      level,
      has: items.length > 0,
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
    unknown: list.filter((c) => c.group === "etc").map((c) => ({ name: c.name, amount: c.amount })),
    missingTargets: list.filter((c) => c.amount == null && c.kind !== "rate" && c.kind !== "limit").map((c) => c.name),
  };
}

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
  return { a, b, groups, rows, premium, changed: rows.filter((r) => r.status !== "same").length };
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

/* ────────────────────────────── 복사용 문구 ────────────────────────────── */

/** 카톡·문자로 보낼 요약 문구 — 숫자는 요약 결과를 그대로 옮긴다 */
export function buildMessage(summary, opts = {}) {
  const name = opts.name ? `${opts.name}님 ` : "";
  const lines = [`${name}보장 정리 요약`, ""];
  if (summary.count) {
    lines.push(`· 담보 ${summary.count}건${summary.contracts ? ` · 계약 ${summary.contracts}건` : ""}`);
    if (summary.premiumKnown) lines.push(`· 월 보험료 합계 ${summary.premium.toLocaleString("ko-KR")}원`);
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

/** 화면 예시용 가상 자료(실제 고객 아님) — 두 설계의 차이를 보여 준다 */
export const SAMPLES = {
  before: `담보명\t가입금액\t월보험료
질병사망\t1,000만원\t3,000원
재해사망\t5,000만원\t2,000원
암진단비\t2,000만원\t9,800원
유사암진단비\t500만원\t1,200원
뇌혈관질환진단비\t1,000만원\t4,300원
허혈성심장질환진단비\t1,000만원\t3,900원
질병수술비\t200만원\t2,100원
상해수술비\t200만원\t1,500원
질병입원일당\t3만원\t1,800원
실손의료비(4세대)\t\t18,400원
교통사고처리지원금\t2,000만원\t1,100원
`,
  after: `담보명\t가입금액\t월보험료
질병사망\t1억원\t12,000원
재해사망\t1억원\t6,000원
암진단비\t5,000만원\t21,000원
유사암진단비\t1,000만원\t2,400원
뇌혈관질환진단비\t2,000만원\t7,600원
허혈성심장질환진단비\t2,000만원\t6,900원
질병수술비\t500만원\t3,400원
상해수술비\t500만원\t2,600원
질병입원일당\t5만원\t2,900원
간병인사용일당\t10만원\t4,200원
실손의료비(4세대)\t\t18,400원
교통사고처리지원금\t1억원\t2,800원
변호사선임비용\t5,000만원\t1,600원
`,
};
