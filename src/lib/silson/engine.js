/**
 * 실손(실비) 세대별 계산 엔진 — 순수 함수만 둔다.
 *
 * 쓰는 곳
 *  · buffetkimz.com  — `src/components/tools/SilsonCompare.tsx` 가 ES 모듈로 직접 import
 *  · InsureCRM       — `node scripts/build_silson_core.mjs` 가 `apps/insure-crm/silson-core.js`(window.Silson) 로 옮긴다
 *
 * 두 앱의 계산이 갈라지면 같은 병원비에 다른 보험금이 나간다. 숫자·문구는 여기서만 고친다.
 * 통신·DOM 코드를 넣지 않는다. 입력값은 브라우저 안에서만 계산된다.
 *
 * 기준(1차 출처)
 *  · 금융위원회 2026-05-06 보도자료 「5세대 실손의료보험 상품 출시」 — 4·5세대 급여/비급여 자기부담·한도 비교표
 *  · 금융위원회 2021-06-29 보도자료 「7.1일부터 제4세대 실손의료보험이 출시됩니다」 — 3·4세대 비교
 *  · 금융위원회 2018-01-16 보도자료 「유병력자 실손의료보험 마련」 — 자기부담 30%, 최소 10만·2만원
 *  · 금융감독원 2026-06-03 자료 「실손보험 세대별 주요 보장내용」 — 1~5세대 판매 시기·자기부담률
 *  · 손해보험협회 5세대 실손 FAQ·보험료 비교공시 — 기본형·특약1·특약2 한도
 *  · 보험업감독업무시행세칙 [별표 15] 실손의료보험 표준약관(2026-05-06 개정)
 *  · 약관 원문 대조: 삼성화재 1704.1(3세대)·2107.1(4세대)·2605.1(5세대), 롯데손보 2013·2605,
 *    현대해상 Hi0910, ABL생명 2013, 삼성화재 유병력자 상품요약서 2601.10
 *
 * 계산 원칙
 *  · 종목마다 `공제(deductible)` 와 `한도 삭감(capped)` 을 나눠 센다. 둘을 합쳐 '본인부담'이라 부르면
 *    2세대 통원처럼 회당 한도에 걸린 경우 자기부담률이 50%로 보여 오해를 만든다.
 *  · 한도는 진료 1건 기준 금액 한도만 적용한다. 연간 누적 한도·횟수는 반영하지 않는다(화면에 밝힌다).
 *  · 1~3세대는 상품형·가입시기별 약관 차이가 커 '대표 구조'로 계산하고, 차이가 큰 지점은 입력으로 가른다.
 */

/** 의료기관 등급 — 최소 자기부담금과 건강보험 본인부담률(5세대 급여 통원 연동) */
export const HOSPITAL_LIST = [
  { id: "clinic", label: "의원", fixed: 10000, fixed45: 10000, fixed1: 5000, ghRate: 0.3, upper: false },
  { id: "hospital", label: "병원", fixed: 15000, fixed45: 10000, fixed1: 5000, ghRate: 0.4, upper: false },
  { id: "general", label: "종합병원", fixed: 20000, fixed45: 20000, fixed1: 10000, ghRate: 0.5, upper: true },
  { id: "tertiary", label: "상급종합병원", fixed: 20000, fixed45: 20000, fixed1: 10000, ghRate: 0.6, upper: true },
];

/** id → 등급 객체 (기존 코드가 HOSPITALS[input.hospital] 로 쓰던 모양을 그대로 둔다) */
export const HOSPITALS = Object.fromEntries(HOSPITAL_LIST.map((h) => [h.id, h]));

export const HOSPITAL_IDS = HOSPITAL_LIST.map((h) => h.id);

/** 비급여 입력 — 일반 + 3대 비급여. 상급병실료 차액은 따로 받는다(room) */
export const NON_KEYS = ["general", "physical", "injection", "mri"];

export const NON_LABELS = {
  general: "일반 비급여",
  physical: "도수·체외충격파·증식",
  injection: "비급여 주사",
  mri: "MRI·MRA",
  room: "상급병실료 차액",
};

/** 3대 비급여 — 3세대부터 특약으로 떼어 낸 종목 */
export const BIG3_KEYS = ["physical", "injection", "mri"];

/** 3대 비급여 연간 한도(3·4·5세대 중증 특약) — 금융위원회 2016-12-20 */
export const BIG3_LIMITS = { physical: 3500000, injection: 2500000, mri: 3000000 };

/** 통원 회당 한도 가입금액 선택지 — 4·5세대는 10/15/20만원(가입금액) */
export const VISIT_CAPS = [100000, 150000, 200000];
/** 1세대 통원 회당 한도 — 상품별 10만~30만원 */
export const GEN1_CAPS = [100000, 200000, 300000];
/** 2·3세대 통원(외래+처방 합산) 회당 한도 — 가입 때 정한 금액(최대 30만원) */
export const GEN23_CAPS = [100000, 150000, 200000, 250000, 300000];
/** 5세대 비중증(특약2) 병·의원 입원 회당 한도 */
export const GEN5_MILD_INPATIENT_CAP = 3000000;
/** 상급병실료 차액 — 1일 평균 10만원 한도, 50% 보상(전 세대 공통) */
export const ROOM_DAY_CAP = 100000;
export const ROOM_RATE = 0.5;
/** 처방조제 1건 공제(2·3세대 약국 정액) */
export const PHARMACY_FIXED = 8000;
/** 입원 자기부담 연간 상한 */
export const ADMIT_SELF_CAP = 2000000;
/** 5세대 중증 특약1 상급·종합병원 입원 자기부담 상한 */
export const GEN5_SEVERE_CAP = 5000000;

/**
 * 세대 프로필.
 *  · purchase: 판매 시기(세대 판별용)
 *  · era: 세대 번호 — 구조 분기의 기준
 *  · selfRate: 1세대 자기부담률(손보 0%·생보 20%)
 *  · standard/selective: 2세대 표준형(20%)·선택형Ⅰ(10%)
 *  · sel2Covered/sel2Non: 선택형Ⅱ(급여 10%·비급여 20%)
 */
export const PROFILES = [
  {
    id: "gen1d",
    label: "1세대 · 손해보험사",
    short: "1세대(손보)",
    purchase: "2009년 9월 이전",
    era: 1,
    selfRate: 0,
    insurer: "손해보험사",
  },
  {
    id: "gen1l",
    label: "1세대 · 생명보험사",
    short: "1세대(생보)",
    purchase: "2009년 9월 이전",
    era: 1,
    selfRate: 0.2,
    insurer: "생명보험사",
  },
  {
    id: "gen2",
    label: "2세대",
    short: "2세대",
    purchase: "2009년 10월 ~ 2017년 3월",
    era: 2,
    standard: 0.2,
    selective: 0.1,
    sel2Covered: 0.1,
    sel2Non: 0.2,
  },
  {
    id: "gen3",
    label: "3세대",
    short: "3세대",
    purchase: "2017년 4월 ~ 2021년 6월",
    era: 3,
    standard: 0.2,
    selective: 0.1,
    sel2Covered: 0.1,
    sel2Non: 0.2,
    special: 0.3,
  },
  {
    id: "gen4",
    label: "4세대",
    short: "4세대",
    purchase: "2021년 7월 ~ 2026년 5월 5일",
    era: 4,
  },
  {
    id: "gen5",
    label: "5세대",
    short: "5세대",
    purchase: "2026년 5월 6일 이후",
    era: 5,
  },
  {
    id: "chronic",
    label: "유병력자 실손",
    short: "유병력자",
    purchase: "2018년 4월 이후 (간편심사)",
    era: 0,
  },
];

export const PROFILE_IDS = PROFILES.map((p) => p.id);

const won = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};
const pct = (r) => `${Math.round(r * 1000) / 10}%`;
const comma = (v) => Math.round(v).toLocaleString("ko-KR");
const capArr = (list, v, fallback) => (list.includes(Number(v)) ? Number(v) : fallback);

/** 세대 판별 — 최초 가입일(YYYY-MM-DD)로 나눈다. 1세대는 보험사 종류를 함께 봐야 한다. */
export function generationFromDate(dateStr) {
  const s = String(dateStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  if (s < "2009-10-01")
    return {
      id: "gen1",
      label: "1세대",
      note: "2009년 9월 이전 계약입니다. 손해보험사(자기부담 0%)와 생명보험사(20%)를 증권으로 확인하세요.",
    };
  if (s < "2017-04-01")
    return {
      id: "gen2",
      label: "2세대",
      note: "2009년 10월 ~ 2017년 3월 계약입니다. 상품형(표준형·선택형Ⅰ·Ⅱ)에 따라 자기부담률이 다릅니다.",
    };
  if (s < "2021-07-01")
    return {
      id: "gen3",
      label: "3세대",
      note: "2017년 4월 ~ 2021년 6월 계약입니다. 도수·주사·MRI는 특약으로 따로 봅니다.",
    };
  if (s < "2026-05-06") return { id: "gen4", label: "4세대", note: "2021년 7월 ~ 2026년 5월 5일 계약입니다." };
  return {
    id: "gen5",
    label: "5세대",
    note: "2026년 5월 6일 이후 계약입니다. 비급여가 중증(특약1)과 비중증(특약2)으로 나뉩니다.",
  };
}

/** 세대 판매 시기 안에서의 상품형 이름 — 화면 라벨에 쓴다(2세대는 선택형Ⅱ가 2015.9~2017.3에만 있다) */
export function variantLabel(variant23) {
  return variant23 === "sel2" ? "선택형Ⅱ" : variant23 === "selective" ? "선택형Ⅰ" : "표준형";
}

/** 입력 정규화 — 화면·CRM 어디서 들어와도 같은 모양으로 만든다 */
export function normalizeInput(input = {}) {
  const visit = input.visit === "inpatient" ? "inpatient" : "outpatient";
  const hospital = HOSPITALS[input.hospital] ? input.hospital : "hospital";
  const severity = input.severity === "severe" ? "severe" : "mild";
  const variant23 = input.variant23 === "selective" ? "selective" : input.variant23 === "sel2" ? "sel2" : "standard";  const non = {};
  for (const k of NON_KEYS) non[k] = won((input.non || {})[k]);

  /* 급여 — 일부본인부담금과 전액본인부담금을 나눈다. 옛 입력(coveredAmount+coveredKind)도 받는다. */
  const legacyFull = input.coveredKind === "full";
  const coveredPartial = won(input.coveredPartial != null ? input.coveredPartial : legacyFull ? 0 : input.coveredAmount);
  const coveredFull = won(input.coveredFull != null ? input.coveredFull : legacyFull ? input.coveredAmount : 0);

  return {
    visit,
    hospital,
    severity,
    /** 산정특례(암·뇌·심장·희귀) 등록 환자 — 비급여 중증 선택과 별개로 급여 통원 건보율에만 쓴다 */
    special: Boolean(input.special),
    variant23,
    /** 2세대 2013.1 이전 판 — 통원 공제가 정액뿐(20%와 비교하지 않음) */
    gen2Early: Boolean(input.gen2Early),
    coveredPartial,
    coveredFull,
    /**
     * 처방조제비(급여) — 통원에서만 쓴다.
     * 입원으로 바꾸면 0으로 둔다. 화면에서 통원일 때 넣은 값이 남아 있어도 병원비 합계(total)와
     * 계산 상세에 처방조제비가 따라오지 않게 하기 위해서다(입원에는 약국 처방조제 건이 없다).
     */
    prescription: visit === "inpatient" ? 0 : won(input.prescription),
    non,
    /** 상급병실료 차액과 입원일수 */
    room: won(input.room != null ? input.room : (input.non || {}).room),
    roomDays: Math.min(60, Math.max(0, Math.round(Number(input.roomDays) || 0))),
    /** 5세대 급여 통원 건보율 실측용 공단부담금 */
    coPayment: won(input.coPayment),
    /** 4·5세대 통원 회당 한도(가입금액) */
    visitCap: capArr(VISIT_CAPS, input.visitCap, 200000),
    /** 1세대 통원 회당 한도(상품별) */
    gen1Cap: capArr(GEN1_CAPS, input.gen1Cap, 300000),
    /** 2·3세대 통원(외래+처방 합산) 회당 한도 — 가입금액 */
    gen23Cap: capArr(GEN23_CAPS, input.gen23Cap, 300000),
    primary: PROFILE_IDS.includes(input.primary) ? input.primary : "gen4",
  };
}

/** 한 진료의 계산 재료 */
function context(input) {
  const h = HOSPITALS[input.hospital];
  const nonAll = NON_KEYS.reduce((s, k) => s + input.non[k], 0);
  const coveredAll = input.coveredPartial + input.coveredFull;
  return {
    ...input,
    h,
    nonAll,
    coveredAll,
    total: coveredAll + input.prescription + nonAll + input.room,
    minFixed45: h.fixed45,
    minFixedOld: h.fixed,
    fixed1: h.fixed1,
    ghRate: h.ghRate,
  };
}

/** 공제액 = 보장대상 × 비율 vs 최소 공제 중 큰 금액(보장대상 이내) */
function deduct(base, rate, min) {
  return Math.min(base, Math.max(Math.round(base * rate), Math.round(min || 0)));
}

/**
 * 종목 하나 — base 에서 공제(deductible)하고 남은 금액에 한도(cap)를 적용한다.
 * 한도에 걸려 지급하지 못한 금액은 `capped` 로 따로 남긴다(본인부담률 오해 방지).
 */
function item(key, label, base, opts = {}) {
  const b = won(base);
  const deductible = Math.min(b, won(opts.deductible));
  const raw = b - deductible;
  const cap = opts.cap == null ? Infinity : Math.max(0, Number(opts.cap));
  const payout = Math.min(raw, cap);
  const capped = raw - payout;
  return {
    key,
    label,
    base: b,
    deductible,
    capped,
    payout,
    reason: opts.reason || "",
    tag: opts.tag || "",
  };
}

/** 입원 자기부담 연 200만원 상한 — 초과분을 돌려준다 */
function applyAdmitCap(self, reason, cap = ADMIT_SELF_CAP) {
  if (self <= cap) return { self, give: 0, reason };
  return {
    self: cap,
    give: self - cap,
    reason: `${reason} 자기부담이 연 ${comma(cap)}원을 넘어 초과분 ${comma(self - cap)}원을 다시 더했습니다.`,
  };
}

/** 상급병실료 차액 — 전 세대 공통: 차액의 50%, 1일 평균 10만원 한도 */
function roomItem(ctx, items, notes) {
  if (!ctx.room) return;
  const days = Math.max(1, ctx.roomDays || 1);
  const baseCap = ROOM_DAY_CAP * days;
  const eligible = Math.min(ctx.room, baseCap);
  const payout = Math.round(eligible * ROOM_RATE);
  items.push(
    item("room", "상급병실료 차액", ctx.room, {
      deductible: ctx.room - payout,
      reason: `상급병실료 차액 ${comma(ctx.room)}원의 50%를 보상합니다. 1일 평균 ${comma(ROOM_DAY_CAP)}원 한도(입원 ${days}일 → ${comma(
        baseCap
      )}원)를 넘는 차액 ${comma(Math.max(0, ctx.room - eligible))}원은 보상 대상이 아닙니다.${
        ctx.roomDays ? "" : " 입원일수를 넣지 않아 1일로 계산했습니다."
      }`,
    })
  );
  notes.push(
    "상급병실료 차액은 1~5세대·유병력자 모두 차액의 50%, 1일 평균 10만원 한도로 보상합니다. 일반 비급여 칸에 넣지 말고 이 칸에 따로 넣어 주세요."
  );
}

/* ───────────────────────── 1세대 ───────────────────────── */
function calcGen1(profile, ctx) {
  const rate = profile.selfRate;
  const items = [];
  const notes = [];

  /* 1세대는 급여와 비급여를 합쳐 보상한다. 200만원 초과분 보상은 2009.10 표준화 때 생긴 조항이라 두지 않는다. */
  if (ctx.visit === "inpatient") {
    const base = ctx.coveredAll + ctx.nonAll;
    const self = Math.round(base * rate);
    items.push(
      item("covered", "급여·비급여 입원", base, {
        deductible: self,
        reason:
          rate === 0
            ? `손해보험사 가입으로 입원 자기부담이 없습니다. 급여와 비급여 ${comma(base)}원을 그대로 보상합니다.`
            : `급여와 비급여를 합친 ${comma(base)}원의 ${pct(rate)}인 ${comma(self)}원을 뺐습니다.`,
      })
    );
    notes.push(
      "1세대 입원은 급여와 비급여를 합쳐 계산합니다. 연 200만원 초과분 보상 조항은 2009년 10월 표준화 이후에 생겨 1세대 약관에는 없습니다."
    );
  } else {
    const base = ctx.coveredAll + ctx.prescription + ctx.nonAll;
    /*
     * 1세대 통원 공제는 상품별 외래 정액(5천~2만원)과 자기부담률(생보 20%) 중 큰 금액을 한 번 뺀다.
     * 다만 외래 병원비가 0인 약국 영수증 단독 건에는 외래 정액을 붙이지 않고 약국 정액 8,000원만 뺀다 —
     * 예전에는 종합병원을 고르면 1만원 정액이 붙어 약국 10,000원이 0원 지급이 됐다.
     */
    const fixed = ctx.fixed1;
    const visitBase = ctx.coveredAll + ctx.nonAll;
    const pharmacySelf = ctx.prescription ? Math.min(ctx.prescription, PHARMACY_FIXED) : 0;
    const self = Math.min(base, visitBase ? deduct(base, rate, fixed) : pharmacySelf);
    items.push(
      item("covered", "급여·비급여 통원", base, {
        deductible: self,
        cap: ctx.gen1Cap,
        reason: `${
          visitBase
            ? `통원 1회 정액 공제 ${comma(fixed)}원${rate ? `과 ${pct(rate)}(${comma(base * rate)}원)` : " (손보 자기부담 0%)"} 중 큰 금액 ${comma(
                self
              )}원`
            : `외래 병원비가 0원이라 외래 정액 대신 약국 처방조제 정액 ${comma(pharmacySelf)}원`
        }을 뺐습니다. 통원 회당 한도 ${comma(ctx.gen1Cap)}원을 적용합니다.`,
      })
    );
    notes.push(
      "1세대 통원 공제는 상품별로 5천원~2만원이었습니다(약국 8천원 수준). 여기서는 다수 상품의 5천원(의원·병원)·1만원(종합·상급)을 적용했고, 통원 회당 한도는 상품별 10만~30만원이라 최대(30만원)를 기본으로 두었습니다. 증권의 가입금액으로 바꿔 주세요. 약국 영수증만 있는 건은 약국 정액 8,000원만 적용합니다."
    );
  }
  roomItem(ctx, items, notes);
  return { items, notes };
}

/* ───────────────────────── 2세대 ───────────────────────── */
function calcGen2(profile, ctx) {
  const variant = ctx.variant23;
  const coveredRate = variant === "selective" ? profile.selective : variant === "sel2" ? profile.sel2Covered : profile.standard;
  const nonRate = variant === "sel2" ? profile.sel2Non : coveredRate;
  const sel2Note = variant === "sel2" ? " 선택형Ⅱ(급여 10%·비급여 20%)로 계산했습니다." : "";
  const items = [];
  const notes = [];

  if (ctx.visit === "inpatient") {
    const coveredBase = ctx.coveredAll;
    const nonBase = ctx.nonAll;
    const coveredSelf = Math.round(coveredBase * coveredRate);
    const nonSelf = Math.round(nonBase * nonRate);
    const cap = applyAdmitCap(coveredSelf + nonSelf, `급여 ${comma(coveredBase)}원의 ${pct(coveredRate)}(${comma(coveredSelf)}원), 비급여 ${comma(
      nonBase
    )}원의 ${pct(nonRate)}(${comma(nonSelf)}원)을 뺐습니다.`);
    items.push(
      item("covered", "급여·비급여 입원", coveredBase + nonBase, {
        deductible: cap.self,
        reason: cap.reason + sel2Note,
      })
    );
    notes.push("2세대 입원은 급여+비급여 자기부담을 합쳐 연 200만원을 넘으면 초과분을 보상합니다(현대해상 Hi0910 p.7, ABL생명 2013 p.13).");
  } else {
    const base = ctx.coveredAll + ctx.prescription + ctx.nonAll;
    /*
     * 외래 공제 = min(외래비, max(병원 정액, 비율)). 2013.1 이전 판은 정액만(현대해상 Hi0910 p.7).
     * 외래비가 0이면(예: 약국 처방조제비만 넣은 경우) 외래 공제도 0이다 — 정액을 그대로 빼면
     * 처방 10,000원이 0원 지급이 된다. 처방조제는 따로 min(처방비, 8,000원)만 뺀다.
     */
    const fixed = ctx.h.fixed;
    const rateSelf = Math.round(ctx.coveredAll * coveredRate);
    const visitSelf = ctx.gen2Early
      ? Math.min(ctx.coveredAll, fixed)
      : Math.min(ctx.coveredAll, Math.max(fixed, rateSelf));
    const pharmacySelf = ctx.prescription ? Math.min(ctx.prescription, PHARMACY_FIXED) : 0;
    const nonSelf = Math.round(ctx.nonAll * nonRate);
    const self = Math.min(base, visitSelf + pharmacySelf + nonSelf);
    items.push(
      item("covered", "급여·비급여 통원", base, {
        deductible: self,
        cap: ctx.gen23Cap,
        reason: ctx.gen2Early
          ? `2013.1 이전 판으로 통원 정액 공제 ${comma(visitSelf)}원만 적용했습니다(20%와 비교하지 않음). 비급여는 ${pct(nonRate)}인 ${comma(
              nonSelf
            )}원을 뺐습니다. 외래와 처방조제를 합쳐 회당 ${comma(ctx.gen23Cap)}원 한도입니다.${
              ctx.coveredAll ? "" : " 외래 병원비가 0원이라 외래 공제는 적용하지 않았습니다."
            }${sel2Note}`
          : `통원 정액 공제 ${comma(fixed)}원과 ${pct(coveredRate)}(${comma(rateSelf)}원) 중 큰 ${comma(visitSelf)}원${
              pharmacySelf ? `, 처방조제 정액 ${comma(pharmacySelf)}원` : ""
            }, 비급여 ${pct(nonRate)}(${comma(nonSelf)}원)을 뺐습니다. 외래와 처방조제를 합쳐 회당 ${comma(ctx.gen23Cap)}원 한도입니다.${
              ctx.coveredAll ? "" : " 외래 병원비가 0원이라 외래 공제는 적용하지 않았습니다."
            }${sel2Note}`,
      })
    );
    notes.push(
      `2세대 통원 한도는 외래와 처방조제를 합쳐 회(건)당 30만원 안에서 가입할 때 정한 금액입니다(롯데손보 2013 p.9). 여기서는 ${comma(
        ctx.gen23Cap
      )}원으로 계산했습니다 — 증권의 가입금액으로 맞춰 주세요.`
    );
    notes.push("2세대는 표준형 20%·선택형Ⅰ 10%·선택형Ⅱ(2015.9~2017.3, 급여 10%·비급여 20%)로 나뉩니다. 위쪽 상품형에서 고를 수 있습니다.");
  }
  roomItem(ctx, items, notes);
  return { items, notes };
}

/* ───────────────────────── 3세대 ───────────────────────── */
function calcGen3(profile, ctx) {
  const variant = ctx.variant23;
  const coveredRate = variant === "selective" ? profile.selective : variant === "sel2" ? profile.sel2Covered : profile.standard;
  const nonRate = variant === "sel2" ? profile.sel2Non : coveredRate;
  const specialRate = profile.special;
  const items = [];
  const notes = [];

  if (ctx.visit === "inpatient") {
    const coveredBase = ctx.coveredAll;
    const nonBase = ctx.non.general;
    const coveredSelf = Math.round(coveredBase * coveredRate);
    const nonSelf = Math.round(nonBase * nonRate);
    if (coveredBase + nonBase) {
      const cap = applyAdmitCap(
        coveredSelf + nonSelf,
        `급여 ${comma(coveredBase)}원의 ${pct(coveredRate)}(${comma(coveredSelf)}원), 일반 비급여 ${comma(nonBase)}원의 ${pct(nonRate)}(${comma(
          nonSelf
        )}원)을 뺐습니다.`
      );
      items.push(item("covered", "급여·일반 비급여 입원", coveredBase + nonBase, { deductible: cap.self, reason: cap.reason }));
    }
    notes.push("3세대 입원은 급여+일반 비급여 자기부담을 합쳐 연 200만원을 넘으면 초과분을 보상합니다(삼성화재 1704.1 p.17).");
  } else {
    const base = ctx.coveredAll + ctx.prescription + ctx.non.general;
    /* 외래 공제 = min(외래비, max(정액, 비율)). 외래 0원이면 공제도 0 — 처방조제만 따로 8,000원까지 뺀다. */
    const fixed = ctx.h.fixed;
    const rateSelf = Math.round(ctx.coveredAll * coveredRate);
    const visitSelf = Math.min(ctx.coveredAll, Math.max(fixed, rateSelf));
    const pharmacySelf = ctx.prescription ? Math.min(ctx.prescription, PHARMACY_FIXED) : 0;
    const nonSelf = Math.round(ctx.non.general * nonRate);
    const self = Math.min(base, visitSelf + pharmacySelf + nonSelf);
    items.push(
      item("covered", "급여·일반 비급여 통원", base, {
        deductible: self,
        cap: ctx.gen23Cap,
        reason: `통원 정액 공제 ${comma(fixed)}원과 ${pct(coveredRate)}(${comma(rateSelf)}원) 중 큰 ${comma(visitSelf)}원${
          pharmacySelf ? `, 처방조제 정액 ${comma(pharmacySelf)}원` : ""
        }, 일반 비급여 ${pct(nonRate)}(${comma(nonSelf)}원)을 뺐습니다. 외래와 처방조제를 합쳐 회당 ${comma(ctx.gen23Cap)}원 한도입니다.${
          ctx.coveredAll ? "" : " 외래 병원비가 0원이라 외래 공제는 적용하지 않았습니다."
        }`,
      })
    );
    notes.push(
      `3세대 통원 한도는 외래와 처방조제를 합쳐 회(건)당 30만원 안에서 가입할 때 정한 금액입니다(삼성화재 1704.1 p.49). 여기서는 ${comma(
        ctx.gen23Cap
      )}원으로 계산했습니다.`
    );
  }

  /* 3대 비급여 특약 — 입원·통원 모두 1회당 2만원과 30% 중 큰 금액, 종목별 연 한도 */
  for (const key of BIG3_KEYS) {
    const base = ctx.non[key];
    if (!base) continue;
    const self = deduct(base, specialRate, 20000);
    items.push(
      item(key, `${NON_LABELS[key]} (특약)`, base, {
        deductible: self,
        cap: BIG3_LIMITS[key],
        reason: `1회당 공제 2만원과 ${pct(specialRate)}(${comma(base * specialRate)}원) 중 큰 ${comma(self)}원을 뺐습니다(입원·통원 모두). 연 한도 ${comma(
          BIG3_LIMITS[key]
        )}원입니다.`,
      })
    );
  }
  notes.push(
    "3세대 3대 비급여(도수·체외충격파·증식, 비급여 주사, MRI·MRA)는 특약으로 따로 계산했습니다. 한도는 도수 350만원·주사 250만원·MRI 300만원입니다(금융위원회 2016-12-20). 도수는 연 50회, 주사는 입원·통원 합산 50회 한도가 더 있습니다."
  );
  roomItem(ctx, items, notes);
  return { items, notes };
}

/* ───────────────────────── 4세대 ───────────────────────── */
function calcGen4(_profile, ctx) {
  const items = [];
  const notes = [];

  /* 급여 — 입원 20%(연 200만 상한), 통원 20%와 1만·2만 중 큰 금액 + 회당 한도 */
  if (ctx.visit === "inpatient") {
    const base = ctx.coveredAll;
    if (base) {
      const cap = applyAdmitCap(Math.round(base * 0.2), `급여 입원 본인부담금 ${comma(base)}원의 20%인 ${comma(base * 0.2)}원을 뺐습니다.`);
      items.push(item("covered", "급여 입원", base, { deductible: cap.self, reason: cap.reason }));
    }
  } else if (ctx.coveredPartial || ctx.prescription) {
    const base = ctx.coveredPartial + ctx.prescription;
    const self = deduct(base, 0.2, ctx.minFixed45);
    items.push(
      item("covered", "급여 통원", base, {
        deductible: self,
        cap: ctx.visitCap,
        reason: `${ctx.prescription ? `처방조제비 ${comma(ctx.prescription)}원을 합친 ` : ""}급여 ${comma(base)}원의 20%(${comma(
          base * 0.2
        )}원)와 최소 공제 ${comma(ctx.minFixed45)}원 중 큰 ${comma(self)}원을 뺐습니다. 통원 회당 한도 ${comma(ctx.visitCap)}원입니다.`,
      })
    );
    if (ctx.coveredFull) {
      items.push(
        item("coveredFull", "급여 통원 (전액본인부담)", ctx.coveredFull, {
          deductible: ctx.coveredFull,
          reason:
            "4세대 통원의 전액본인부담금은 보상 대상에서 빼고 계산했습니다. 4세대 약관의 문구가 상품마다 달라 증권으로 확인하세요(5세대는 표준약관이 명시적으로 제외).",
        })
      );
      notes.push("4세대 통원 전액본인부담금은 상품 약관에 따라 보상 여부가 갈립니다. 여기서는 제외로 계산했습니다.");
    }
  } else if (ctx.coveredFull) {
    items.push(
      item("coveredFull", "급여 통원 (전액본인부담)", ctx.coveredFull, {
        deductible: ctx.coveredFull,
        reason: "4세대 통원의 전액본인부담금은 보상 대상에서 빼고 계산했습니다.",
      })
    );
    notes.push("4세대 통원 전액본인부담금은 상품 약관에 따라 보상 여부가 갈립니다. 여기서는 제외로 계산했습니다.");
  }

  /* 비급여 일반 — 입원 30%, 통원 3만원과 30% 중 큰 금액 + 회당 한도 */
  if (ctx.non.general) {
    const base = ctx.non.general;
    const min = ctx.visit === "outpatient" ? 30000 : 0;
    if (ctx.visit === "inpatient") {
      items.push(
        item("nonGeneral", "일반 비급여 입원", base, {
          deductible: Math.round(base * 0.3),
          reason: `일반 비급여 입원 ${comma(base)}원의 30%인 ${comma(base * 0.3)}원을 뺐습니다.`,
        })
      );
    } else {
      items.push(
        item("nonGeneral", "일반 비급여 통원", base, {
          deductible: deduct(base, 0.3, min),
          cap: ctx.visitCap,
          reason: `30%(${comma(base * 0.3)}원)와 공제 3만원 중 큰 ${comma(deduct(base, 0.3, min))}원을 뺐습니다. 통원 회당 한도 ${comma(
            ctx.visitCap
          )}원입니다.`,
        })
      );
    }
  }

  /* 3대 비급여 — 종목별 별도 공제(1회당 3만원·30%)·통원 회당 한도·연 한도 */
  for (const key of BIG3_KEYS) {
    const base = ctx.non[key];
    if (!base) continue;
    items.push(
      item(key, `${NON_LABELS[key]} (특약)`, base, {
        deductible: deduct(base, 0.3, 30000),
        cap: Math.min(ctx.visit === "outpatient" ? ctx.visitCap : Infinity, BIG3_LIMITS[key]),
        reason: `1회당 공제 3만원과 30%(${comma(base * 0.3)}원) 중 큰 ${comma(deduct(base, 0.3, 30000))}원을 뺐습니다(입원·통원 모두).${
          ctx.visit === "outpatient" ? ` 통원 회당 한도 ${comma(ctx.visitCap)}원,` : ""
        } 연 한도 ${comma(BIG3_LIMITS[key])}원입니다.`,
      })
    );
  }
  notes.push(
    "4세대는 일반 비급여와 3대 비급여(도수·주사·MRI)를 각각 따로 계산합니다. 3대 비급여는 종목마다 1회당 3만원·통원 회당 한도(가입금액 10·15·20만원)와 연 한도(도수 350만·주사 250만·MRI 300만)가 붙습니다(삼성화재 2107.1 p.11~12)."
  );
  notes.push(
    `급여 통원 회당 한도는 가입금액에 따라 10·15·20만원이고, 여기서는 ${comma(ctx.visitCap)}원으로 계산했습니다. 도수는 최초 10회 보장 뒤 10회 단위로 이어서 보상합니다.`
  );
  notes.push("4세대 급여 입원 자기부담도 연 200만원을 넘으면 초과분을 보상합니다(삼성화재 2107.1 p.51). 비급여에는 이 조항이 없습니다.");
  roomItem(ctx, items, notes);
  return { items, notes };
}

/* ───────────────────────── 5세대 ───────────────────────── */
function calcGen5(_profile, ctx) {
  const items = [];
  const notes = [];
  const severe = ctx.severity === "severe";

  /* 급여 — 입원 20%(연 200만 상한), 통원은 건보 본인부담률·20%·최소 공제 중 큰 금액 */
  if (ctx.visit === "inpatient") {
    const base = ctx.coveredAll;
    if (base) {
      const cap = applyAdmitCap(Math.round(base * 0.2), `급여 입원 본인부담금 ${comma(base)}원의 20%인 ${comma(base * 0.2)}원을 뺐습니다.`);
      items.push(item("covered", "급여 입원", base, { deductible: cap.self, reason: cap.reason }));
    }
  } else if (ctx.coveredPartial || ctx.prescription) {
    const base = ctx.coveredPartial + ctx.prescription;
    /* 건보 본인부담률은 영수증의 일부본인부담금 ÷ (일부본인부담금 + 공단부담금). 산정특례는 체크했을 때만 5%. */
    const measured = ctx.coPayment > 0 ? base / (base + ctx.coPayment) : null;
    const specialRate = ctx.special ? 0.05 : ctx.ghRate;
    const ghRate = measured != null ? measured : specialRate;
    const gh = Math.round(base * ghRate);
    const self = Math.min(base, Math.max(ctx.minFixed45, Math.round(base * 0.2), gh));
    items.push(
      item("covered", "급여 통원", base, {
        deductible: self,
        cap: ctx.visitCap,
        reason: measured != null
          ? `영수증의 공단부담금 ${comma(ctx.coPayment)}원으로 계산한 건강보험 본인부담률 ${pct(ghRate)}(${comma(gh)}원), 20%(${comma(
              base * 0.2
            )}원), 최소 공제 ${comma(ctx.minFixed45)}원 중 큰 ${comma(self)}원을 뺐습니다. 통원 회당 한도 ${comma(ctx.visitCap)}원입니다.`
          : `건강보험 본인부담률 ${pct(ghRate)}(${comma(gh)}원)${ctx.special ? " (산정특례 5% 가정)" : ` (${ctx.h.label} 기준)`}, 20%(${comma(
              base * 0.2
            )}원), 최소 공제 ${comma(ctx.minFixed45)}원 중 큰 ${comma(self)}원을 뺐습니다. 통원 회당 한도 ${comma(ctx.visitCap)}원입니다.`,
      })
    );
    notes.push(
      measured != null
        ? "건강보험 본인부담률은 영수증에 적힌 일부본인부담금과 공단부담금으로 계산했습니다(표준약관 방식)."
        : "공단부담금을 넣으면 영수증의 실제 건강보험 본인부담률로 계산합니다. 넣지 않으면 병원 등급 평균값을 쓰고, '산정특례'를 체크한 경우에만 5%로 봅니다 — 어느 쪽이든 20% 하한이 더 크면 20%를 씁니다."
    );
    if (ctx.coveredFull) {
      items.push(
        item("coveredFull", "급여 통원 (전액본인부담)", ctx.coveredFull, {
          deductible: ctx.coveredFull,
          reason: "5세대 급여 통원은 일부본인부담금만 보상합니다. 전액본인부담금은 표준약관이 보상 대상에서 제외합니다.",
        })
      );
    }
  } else if (ctx.coveredFull) {
    items.push(
      item("coveredFull", "급여 통원 (전액본인부담)", ctx.coveredFull, {
        deductible: ctx.coveredFull,
        reason: "5세대 급여 통원은 일부본인부담금만 보상합니다(표준약관 2026-05-06 신설).",
      })
    );
  }

  const group = [];
  const push = (key, label, base, rate, min, cap, head) => {
    const self = deduct(base, rate, min);
    group.push({
      key,
      label,
      base,
      self,
      cap,
      reason: `${head} ${comma(base)}원의 ${pct(rate)}${min ? `(${comma(base * rate)}원)와 공제 ${comma(min)}원 중 큰 금액` : ""} ${comma(
        self
      )}원을 뺐습니다.`,
    });
  };

  if (severe) {
    /* 특약1 — 중증 비급여: 입원·통원 3만원과 30%, 종목별 연 한도, 상급·종합 입원 500만 상한 */
    if (ctx.non.general)
      push("nonGeneral", "중증 비급여 (특약1)", ctx.non.general, 0.3, 30000, 50000000, "중증(특약1) 일반 비급여");
    for (const key of BIG3_KEYS) {
      if (ctx.non[key]) push(key, `${NON_LABELS[key]} (특약1)`, ctx.non[key], 0.3, 30000, BIG3_LIMITS[key], "중증 질환 치료로 특약1에서");
    }
    /* 500만원 상한 모수 = 일반 비급여 + MRI (도수·주사는 제외) */
    if (ctx.visit === "inpatient" && ctx.h.upper) {
      const pool = group.filter((g) => g.key === "nonGeneral" || g.key === "mri");
      let over = pool.reduce((s, g) => s + g.self, 0) - GEN5_SEVERE_CAP;
      for (const g of pool) {
        if (over <= 0) break;
        const give = Math.min(g.self, over);
        g.self -= give;
        over -= give;
        g.reason += ` 상급·종합병원 입원은 연간 자기부담 ${comma(GEN5_SEVERE_CAP)}원을 넘지 않아 초과분 ${comma(
          give
        )}원을 다시 더했습니다(도수·주사 제외).`;
      }
    }
  } else {
    /* 특약2 — 비중증: 일반 비급여 50%·5만원, 1일당 한도. 도수·주사 제외, MRI는 5만원·50%·연 200만 */
    if (ctx.non.general) {
      const cap = ctx.visit === "inpatient" && !ctx.h.upper ? GEN5_MILD_INPATIENT_CAP : 10000000;
      push("nonGeneral", "비중증 비급여 (특약2)", ctx.non.general, 0.5, 50000, cap, "비중증(특약2) 일반 비급여");
    }
    if (ctx.non.mri) push("mri", "MRI·MRA (특약2)", ctx.non.mri, 0.5, 50000, 2000000, "비중증 MRI로 특약2에서");
    for (const key of ["physical", "injection"]) {
      if (!ctx.non[key]) continue;
      items.push(
        item(key, `${NON_LABELS[key]} (보장 제외)`, ctx.non[key], {
          deductible: ctx.non[key],
          reason: "5세대 특약2는 근골격계 이학요법·체외충격파·비급여 주사제를 보상하지 않습니다. 전액 본인부담입니다.",
        })
      );
    }
  }

  /* 특약 한도 — 일반 비급여(중증은 모든 종목)만 통원 회당 한도, MRI는 연 한도만 */
  for (const g of group) {
    const visitCap = ctx.visit === "outpatient" && (severe || g.key === "nonGeneral") ? ctx.visitCap : Infinity;
    items.push(
      item(g.key, g.label, g.base, {
        deductible: g.self,
        cap: Math.min(g.cap, visitCap),
        reason:
          g.reason +
          (visitCap !== Infinity ? ` 통원 회당 한도 ${comma(ctx.visitCap)}원을 적용했습니다.` : "") +
          (g.cap < 10000000 ? ` 연 한도 ${comma(g.cap)}원을 적용했습니다.` : ""),
      })
    );
  }

  notes.push("5세대는 비급여가 중증(특약1)·비중증(특약2)으로 나뉩니다. 위쪽 '비급여 구분'을 바꾸면 같은 금액이 다른 특약으로 계산됩니다.");
  notes.push(
    "5세대 특약2(비중증)는 연 1천만원·통원 1일당 가입금액(10·15·20만원)·병의원 입원 회당 300만원 한도이고, MRI는 따로 5만원·50%·연 200만원입니다(삼성화재 2605.1 p.9·p.67). 특약1(중증)은 입·통원 합산 연 5천만원에 3대 비급여 종목별 연 한도(도수 350만·주사 250만·MRI 300만)가 함께 붙고, 통원은 회당 가입금액 한도·연 100회입니다(금융위 2026-05-06 참고1, 삼성화재 2605.1 p.9). 이 계산은 진료 1건만 봅니다."
  );
  roomItem(ctx, items, notes);
  return { items, notes };
}

/* ─────────────────────── 유병력자 실손 ─────────────────────── */
function calcChronic(_profile, ctx) {
  const items = [];
  const notes = [];
  const coveredBase = ctx.coveredAll + ctx.non.general;

  if (ctx.visit === "inpatient") {
    if (coveredBase) {
      const self = Math.min(coveredBase, Math.max(100000, Math.round(coveredBase * 0.3)));
      const cap = applyAdmitCap(self, `30%(${comma(coveredBase * 0.3)}원)와 최소 자기부담 10만원 중 큰 ${comma(self)}원을 뺐습니다.`);
      items.push(
        item("covered", "급여·일반 비급여 입원", coveredBase, {
          deductible: cap.self,
          cap: 50000000,
          reason: cap.reason,
        })
      );
    }
  } else if (coveredBase) {
    const self = Math.min(coveredBase, Math.max(20000, Math.round(coveredBase * 0.3)));
    items.push(
      item("covered", "급여·일반 비급여 통원", coveredBase, {
        deductible: self,
        cap: ctx.visitCap,
        reason: `30%(${comma(coveredBase * 0.3)}원)와 최소 자기부담 2만원 중 큰 ${comma(self)}원을 뺐습니다. 통원 회당 한도 ${comma(
          ctx.visitCap
        )}원입니다.`,
      })
    );
  }

  if (ctx.prescription) {
    items.push(
      item("prescription", "처방조제비", ctx.prescription, {
        deductible: ctx.prescription,
        reason: "유병력자 실손은 처방조제비를 보장하지 않습니다. 전액 본인부담입니다.",
      })
    );
  }

  for (const key of BIG3_KEYS) {
    if (!ctx.non[key]) continue;
    items.push(
      item(key, `${NON_LABELS[key]} (보장 제외)`, ctx.non[key], {
        deductible: ctx.non[key],
        reason: "유병력자 실손은 3대 비급여(도수·주사·MRI)를 보장하지 않습니다. 전액 본인부담입니다.",
      })
    );
  }
  notes.push(
    "유병력자 실손은 입원 30%·최소 10만원(자기부담 연 200만원 초과분 보상), 통원 30%·최소 2만원을 뺍니다. 처방조제비는 보장하지 않고, 통원은 회당 20만원·연 180회 한도입니다(삼성화재 유병력자 상품요약서 2601.10)."
  );
  roomItem(ctx, items, notes);
  return { items, notes };
}

const CALC = {
  gen1d: calcGen1,
  gen1l: calcGen1,
  gen2: calcGen2,
  gen3: calcGen3,
  gen4: calcGen4,
  gen5: calcGen5,
  chronic: calcChronic,
};

/**
 * 프로필 하나 계산.
 * @param {string} profileId
 * @param {object} input normalizeInput 결과(또는 원본)
 */
export function calculateProfile(profileId, input) {
  const profile = PROFILES.find((p) => p.id === profileId) || PROFILES.find((p) => p.id === "gen4");
  const ctx = context(normalizeInput(input));
  const { items, notes } = CALC[profile.id](profile, ctx);
  const base = items.reduce((s, i) => s + i.base, 0);
  const deductible = items.reduce((s, i) => s + i.deductible, 0);
  const capped = items.reduce((s, i) => s + i.capped, 0);
  const payout = items.reduce((s, i) => s + i.payout, 0);
  return {
    id: profile.id,
    label: profile.label,
    short: profile.short,
    purchase: profile.purchase,
    items,
    notes,
    base,
    deductible,
    capped,
    payout,
    self: base - payout,
    payoutRate: base ? payout / base : 0,
    selfRate: base ? (base - payout) / base : 0,
  };
}

/** 내 세대 + 전체 비교 */
export function compare(input) {
  const norm = normalizeInput(input);
  const rows = PROFILES.map((p) => calculateProfile(p.id, norm));
  const primary = rows.find((r) => r.id === norm.primary) || rows.find((r) => r.id === "gen4");
  const total = norm.coveredPartial + norm.coveredFull + norm.prescription + NON_KEYS.reduce((s, k) => s + norm.non[k], 0) + norm.room;
  return {
    input: norm,
    hospital: HOSPITALS[norm.hospital],
    total,
    primary,
    rows,
    diffs: rows.map((r) => ({ id: r.id, label: r.label, short: r.short, diff: r.payout - primary.payout })),
  };
}

/** 비교 표에 쓰는 행 — 내 세대를 표시한다 */
export function comparisonRows(result) {
  return result.rows.map((r) => ({
    id: r.id,
    label: r.label,
    short: r.short,
    payout: r.payout,
    self: r.self,
    capped: r.capped,
    payoutRate: r.payoutRate,
    primary: r.id === result.primary.id,
    diff: r.payout - result.primary.payout,
  }));
}

/** 한 줄 요약 — 화면·인쇄·복사 문구가 같은 문장을 쓴다 */
export function headline(result) {
  const i = result.input;
  return `${i.visit === "inpatient" ? "입원" : "통원"} · ${HOSPITALS[i.hospital].label} · 병원비 ${comma(result.total)}원`;
}

/** A4 요약·카톡 문구에 쓰는 본문 줄 */
export function summaryLines(result) {
  const p = result.primary;
  return [
    `${p.label} 기준, 병원비 ${comma(result.total)}원 중 본인부담 ${comma(p.self)}원, 예상 보험금 ${comma(p.payout)}원입니다.`,
    ...p.items.map(
      (it) =>
        `${it.label}: 보험금 ${comma(it.payout)}원 (공제 ${comma(it.deductible)}원${it.capped ? ` · 한도 삭감 ${comma(it.capped)}원` : ""}) — ${it.reason}`
    ),
  ];
}

/** 한도에 걸려 잘린 금액이 있는지 — 화면 안내 문구용 */
export function capNotice(result) {
  const p = result.primary;
  if (!p.capped) return null;
  const worst = p.items.filter((i) => i.capped > 0).sort((a, b) => b.capped - a.capped)[0];
  return {
    amount: p.capped,
    item: worst ? worst.label : "",
    text: `${worst ? worst.label : "일부 항목"}에서 회당·종목 한도를 넘어 ${comma(
      p.capped
    )}원은 이번 청구에서 지급되지 않습니다. 그래서 본인부담이 병원비의 ${pct(p.selfRate)}로 보입니다 — 공제 ${comma(
      p.deductible
    )}원과 한도 삭감 ${comma(p.capped)}원을 나눠 보세요.`,
  };
}

/**
 * 고객에게 보낼 안내 문구(카톡 복사용).
 * 영업 문구를 넣지 않는다 — 숫자와 기준만 적는다.
 */
export function buildMessage(result, opts = {}) {
  const name = String(opts.name || "").trim();
  const who = name ? `${name}님` : "고객님";
  const i = result.input;
  const p = result.primary;
  const lines = [];
  lines.push(`${who} 실손 예상 금액입니다.`);
  lines.push(`· 가입 세대: ${p.label}`);
  lines.push(`· 진료: ${i.visit === "inpatient" ? "입원" : "통원"} (${HOSPITALS[i.hospital].label})`);
  lines.push(`· 병원비: ${comma(result.total)}원`);
  lines.push(`· 본인부담: ${comma(p.self)}원 (공제 ${comma(p.deductible)}원${p.capped ? ` · 한도 삭감 ${comma(p.capped)}원` : ""})`);
  lines.push(`· 예상 보험금: ${comma(p.payout)}원`);
  if (p.items.length > 1) {
    lines.push("· 항목별");
    for (const it of p.items) lines.push(`  - ${it.label} ${comma(it.payout)}원`);
  }
  lines.push("약관·증권과 보험사 심사에 따라 달라질 수 있습니다.");
  return lines.join("\n");
}

/** 세대별 비교 한 줄 — 인쇄·화면 공용 */
export function comparisonSummary(result) {
  const p = result.primary;
  const best = result.rows.slice().sort((a, b) => b.payout - a.payout)[0];
  if (!best || best.id === p.id) return `이 병원비에서는 ${p.label}이 가장 많이 돌려받습니다.`;
  const gap = best.payout - p.payout;
  return `이 병원비에서는 ${best.label}이 ${comma(gap)}원 더 돌려받습니다. 보험료 차이는 따로 봐야 합니다.`;
}

/** 세대별 규칙표 — 화면·인쇄에 그대로 쓰는 요약(숫자는 이 파일에서만 고친다) */
export const RULE_TABLE = [
  {
    id: "gen1",
    label: "1세대 (~2009.9)",
    inpatient: "손보 0% · 생보 20%, 급여+비급여 합산",
    outpatient: "상품별 정액 5천~2만원(약국 8천), 회당 10~30만원",
    big3: "따로 없음(일반 비급여와 합산)",
  },
  {
    id: "gen2",
    label: "2세대 (2009.10~2017.3)",
    inpatient: "표준형 20% · 선택형Ⅰ 10% · 선택형Ⅱ 급여10/비급여20, 합산 연 200만원 상한",
    outpatient: "병원 정액(의원 1만·병원 1.5만·종합 2만)과 비율 중 큰 금액 + 처방 8천, 외래+처방 30만원",
    big3: "따로 없음(급여·비급여 합산)",
  },
  {
    id: "gen3",
    label: "3세대 (2017.4~2021.6)",
    inpatient: "표준형 20% · 선택형Ⅱ 급여10/비급여20, 합산 연 200만원 상한",
    outpatient: "정액과 20% 중 큰 금액 + 처방 8천, 외래+처방 30만원",
    big3: "특약 1회당 2만원·30%, 도수 350만·주사 250만·MRI 300만",
  },
  {
    id: "gen4",
    label: "4세대 (2021.7~2026.5.5)",
    inpatient: "급여 20%(연 200만 상한) · 비급여 30%",
    outpatient: "급여 1만·2만과 20% 중 큰 금액, 회당 10·15·20만원 / 비급여 3만·30%, 회당 10·15·20만원",
    big3: "종목별 1회당 3만·30%, 회당 한도 + 도수 350만·주사 250만·MRI 300만",
  },
  {
    id: "gen5",
    label: "5세대 (2026.5.6~)",
    inpatient: "급여 20%(연 200만 상한) · 중증 30%(연 500만 상한) · 비중증 50%",
    outpatient: "급여 건보 본인부담률·20%·1만/2만 중 큰 금액, 회당 10·15·20만원 / 비중증 5만·50%",
    big3: "중증만 종목별 30%(350/250/300만), 비중증은 MRI만 연 200만",
  },
  {
    id: "chronic",
    label: "유병력자 (2018.4~)",
    inpatient: "30%·최소 10만원, 자기부담 연 200만원 초과분 보상",
    outpatient: "30%·최소 2만원, 회당 20만원·연 180회",
    big3: "보장하지 않음, 처방조제비도 보장하지 않음",
  },
];

export const RULE_SOURCE =
  "금융위원회 2026-05-06·2021-06-29·2018-01-16 보도자료, 금융감독원 2026-06-03 세대별 표, 손해보험협회 5세대·유병력자 표, 보험업감독업무시행세칙 [별표 15] 표준약관(2026-05-06), 삼성화재 1704.1·2107.1·2605.1, 롯데손보 2013·2605, 현대해상 Hi0910, ABL생명 2013";

export const FORMAT = { comma, pct };
