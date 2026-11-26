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
 *
 * 한계(화면에 그대로 밝힌다)
 *  · 진료 1건만 계산한다. 연간 누적 한도(비급여 5천만·1천만, 통원 100회)는 반영하지 않는다.
 *  · 1~3세대는 상품형·가입시기별 약관 차이가 커서 '대표 구조'로 계산한다.
 */

/** 의료기관 등급 — 최소 자기부담금과 건강보험 본인부담률(5세대 급여 통원 연동) */
export const HOSPITALS = {
  clinic: { id: "clinic", label: "의원", fixed: 10000, fixed45: 10000, ghRate: 0.3, upper: false },
  hospital: { id: "hospital", label: "병원", fixed: 15000, fixed45: 10000, ghRate: 0.4, upper: false },
  general: { id: "general", label: "종합병원", fixed: 20000, fixed45: 20000, ghRate: 0.5, upper: true },
  tertiary: { id: "tertiary", label: "상급종합병원", fixed: 20000, fixed45: 20000, ghRate: 0.6, upper: true },
};

export const HOSPITAL_IDS = ["clinic", "hospital", "general", "tertiary"];

/** 비급여 입력 4종 — 3대 비급여(도수·주사·MRI)를 따로 받는다 */
export const NON_KEYS = ["general", "physical", "injection", "mri"];

export const NON_LABELS = {
  general: "일반 비급여",
  physical: "도수·체외충격파·증식",
  injection: "비급여 주사",
  mri: "MRI·MRA",
};

/**
 * 세대 프로필.
 *  · purchase: 판매 시기(세대 판별용)
 *  · era: 3세대 이하 여부 — 전액본인부담 통원 포함, 합산 자기부담 구조를 가른다
 *  · standard/selective: 2·3세대 상품형별 자기부담률
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
  },
  {
    id: "gen3",
    label: "3세대",
    short: "3세대",
    purchase: "2017년 4월 ~ 2021년 6월",
    era: 3,
    standard: 0.2,
    selCovered: 0.1,
    selNon: 0.2,
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
      note: "2009년 10월 ~ 2017년 3월 계약입니다. 상품형(표준형·선택형)에 따라 자기부담률이 다릅니다.",
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

/** 입력 정규화 — 화면·CRM 어디서 들어와도 같은 모양으로 만든다 */
export function normalizeInput(input = {}) {
  const visit = input.visit === "inpatient" ? "inpatient" : "outpatient";
  const hospital = HOSPITALS[input.hospital] ? input.hospital : "hospital";
  const coveredKind = input.coveredKind === "full" ? "full" : "partial";
  const severity = input.severity === "severe" ? "severe" : "mild";
  const variant23 = input.variant23 === "selective" ? "selective" : "standard";
  const non = {};
  for (const k of NON_KEYS) non[k] = won((input.non || {})[k]);
  return {
    visit,
    hospital,
    coveredKind,
    severity,
    variant23,
    coveredAmount: won(input.coveredAmount),
    non,
    primary: PROFILE_IDS.includes(input.primary) ? input.primary : "gen4",
  };
}

/** 한 진료의 계산 재료 — 보상 대상 금액과 공제 계산에 쓰는 값 */
function context(input) {
  const h = HOSPITALS[input.hospital];
  return {
    ...input,
    h,
    total: input.coveredAmount + NON_KEYS.reduce((s, k) => s + input.non[k], 0),
    /** 급여 통원 최소 공제 — 1~3세대는 병원 1만 5천, 4·5세대는 2만원 체계 */
    minFixed45: h.fixed45,
    minFixedOld: h.fixed,
    ghRate: h.ghRate,
  };
}

/** 공제액 = 보장대상 × 비율 vs 최소 공제 중 큰 금액(보장대상 이내) */
function deduct(base, rate, min) {
  return Math.min(base, Math.max(Math.round(base * rate), Math.round(min || 0)));
}

function item(key, label, base, payout, reason, extra = {}) {
  const b = won(base);
  const p = Math.min(b, won(payout));
  return { key, label, base: b, deductible: b - p, payout: p, reason, ...extra };
}

/* ───────────────────────── 1세대 ───────────────────────── */
function calcGen1(profile, ctx) {
  const rate = profile.selfRate;
  const items = [];
  const notes = [];

  // 1세대는 급여와 비급여를 합쳐 보상한다(상급병실료 차액 등 일부 제외).
  const nonAll = NON_KEYS.reduce((s, k) => s + ctx.non[k], 0);
  const combinedBase = ctx.coveredAmount + nonAll;

  if (ctx.visit === "inpatient") {
    let self = Math.round(combinedBase * rate);
    let payout = combinedBase - self;
    let reason =
      rate === 0
        ? `손해보험사 가입으로 입원 자기부담이 없습니다. 급여와 비급여 ${comma(combinedBase)}원을 그대로 보상합니다.`
        : `급여와 비급여를 합친 ${comma(combinedBase)}원의 ${pct(rate)}인 ${comma(self)}원을 뺐습니다.`;
    if (self > 2000000) {
      const back = self - 2000000;
      payout += back;
      self = 2000000;
      reason += ` 입원 자기부담이 연 200만원을 넘어 초과분 ${comma(back)}원을 다시 더했습니다.`;
    }
    items.push(item("covered", "급여·비급여 입원", combinedBase, payout, reason));
    notes.push(
      "1세대 입원은 급여와 비급여를 합쳐 계산하는 상품이 많습니다. 연 200만원 초과분 보상 조항은 가입 약관에 따라 다를 수 있습니다."
    );
  } else {
    const fixed = ctx.minFixedOld;
    const self = Math.min(combinedBase, Math.max(fixed, Math.round(combinedBase * rate)));
    const payout = combinedBase - self;
    items.push(
      item(
        "covered",
        "급여·비급여 통원",
        combinedBase,
        payout,
        `통원 1회 최소 공제 ${comma(fixed)}원${rate ? `과 ${pct(rate)}(${comma(combinedBase * rate)}원)` : ""} 중 큰 금액 ${comma(self)}원을 뺐습니다.`
      )
    );
    notes.push(
      "1세대 통원 공제는 상품별로 5천원~2만원으로 달랐습니다. 여기서는 의원 1만원·병원 1만5천원·종합 2만원(표준화 직전 다수 상품)을 적용했습니다."
    );
    notes.push("1세대는 상품별 통원 한도(회당 10만~30만원)가 있어 실제 지급액이 이보다 작을 수 있습니다.");
  }
  return { items, notes };
}

/* ───────────────────────── 2세대 ───────────────────────── */
function calcGen2(profile, ctx) {
  const rate = ctx.variant23 === "selective" ? profile.selective : profile.standard;
  const items = [];
  const notes = [];
  const nonAll = NON_KEYS.reduce((s, k) => s + ctx.non[k], 0);
  const combinedBase = ctx.coveredAmount + nonAll;

  if (ctx.visit === "inpatient") {
    let self = Math.round(combinedBase * rate);
    let payout = combinedBase - self;
    let reason = `급여와 비급여를 합친 ${comma(combinedBase)}원의 ${pct(rate)}인 ${comma(self)}원을 뺐습니다.`;
    if (self > 2000000) {
      const back = self - 2000000;
      payout += back;
      self = 2000000;
      reason += ` 입원 자기부담이 연 200만원을 넘어 초과분 ${comma(back)}원을 다시 더했습니다.`;
    }
    items.push(item("covered", "급여·비급여 입원", combinedBase, payout, reason));
  } else {
    const fixed = ctx.minFixedOld;
    const self = Math.min(combinedBase, Math.max(fixed, Math.round(combinedBase * rate)));
    const raw = combinedBase - self;
    const payout = Math.min(raw, 300000);
    items.push(
      item(
        "covered",
        "급여·비급여 통원",
        combinedBase,
        payout,
        `최소 공제 ${comma(fixed)}원과 ${pct(rate)}(${comma(combinedBase * rate)}원) 중 큰 ${comma(self)}원을 뺐습니다.${
          raw > 300000 ? ` 통원 회당 한도 30만원을 넘어 ${comma(raw - 300000)}원은 지급되지 않습니다.` : ""
        }`
      )
    );
    notes.push("2세대 통원은 외래와 처방조제를 합쳐 회당 30만원 한도입니다(가입금액 선택에 따라 더 작을 수 있습니다).");
  }
  notes.push("2세대는 선택형Ⅰ(10%)·표준형(20%)·선택형Ⅱ(급여 10%·비급여 20%)로 나뉩니다. 위쪽 '2·3세대 상품형'을 바꾸면 선택형으로 계산합니다.");
  return { items, notes };
}

/* ───────────────────────── 3세대 ───────────────────────── */
function calcGen3(profile, ctx) {
  const selective = ctx.variant23 === "selective";
  const coveredRate = selective ? profile.selCovered : profile.standard;
  const nonRate = selective ? profile.selNon : profile.standard;
  const items = [];
  const notes = [];
  const specialRate = profile.special;
  const specialFixed = 20000;
  const limits = { physical: 3500000, injection: 2500000, mri: 3000000 };

  if (ctx.visit === "inpatient") {
    const coveredBase = ctx.coveredAmount;
    const nonBase = ctx.non.general;
    let coveredSelf = Math.round(coveredBase * coveredRate);
    let nonSelf = Math.round(nonBase * nonRate);
    let reasonCovered = `급여 본인부담금 ${comma(coveredBase)}원의 ${pct(coveredRate)}인 ${comma(coveredSelf)}원을 뺐습니다.`;
    const sumSelf = coveredSelf + nonSelf;
    if (sumSelf > 2000000) {
      const back = sumSelf - 2000000;
      // 초과분은 급여 자기부담에서 먼저 돌려주는 것으로 계산한다.
      const give = Math.min(coveredSelf, back);
      coveredSelf -= give;
      nonSelf -= back - give;
      reasonCovered += ` 급여·비급여 자기부담 합계가 연 200만원을 넘어 초과분 ${comma(back)}원을 다시 더했습니다.`;
    }
    items.push(item("covered", "급여 입원", coveredBase, coveredBase - coveredSelf, reasonCovered));
    if (nonBase)
      items.push(
        item(
          "nonGeneral",
          "일반 비급여 입원",
          nonBase,
          nonBase - nonSelf,
          `일반 비급여 ${comma(nonBase)}원의 ${pct(nonRate)}인 ${comma(Math.round(nonBase * nonRate))}원을 뺐습니다.`
        )
      );
  } else {
    const combinedBase = ctx.coveredAmount + ctx.non.general;
    if (combinedBase) {
      if (selective) {
        const calcSelf = Math.round(ctx.coveredAmount * coveredRate) + Math.round(ctx.non.general * nonRate);
        const self = Math.min(combinedBase, Math.max(ctx.minFixedOld, calcSelf));
        const raw = combinedBase - self;
        const payout = Math.min(raw, 300000);
        items.push(
          item(
            "covered",
            "급여·일반 비급여 통원",
            combinedBase,
            payout,
            `급여는 ${pct(coveredRate)}(${comma(ctx.coveredAmount * coveredRate)}원), 일반 비급여는 ${pct(nonRate)}(${comma(
              ctx.non.general * nonRate
            )}원)를 뺐습니다.${raw > 300000 ? " 통원 회당 한도 30만원을 적용했습니다." : ""}`
          )
        );
      } else {
        const self = Math.min(combinedBase, Math.max(ctx.minFixedOld, Math.round(combinedBase * coveredRate)));
        const raw = combinedBase - self;
        const payout = Math.min(raw, 300000);
        items.push(
          item(
            "covered",
            "급여·일반 비급여 통원",
            combinedBase,
            payout,
            `최소 공제 ${comma(ctx.minFixedOld)}원과 ${pct(coveredRate)}(${comma(combinedBase * coveredRate)}원) 중 큰 ${comma(self)}원을 뺐습니다.${
              raw > 300000 ? " 통원 회당 한도 30만원을 적용했습니다." : ""
            }`
          )
        );
      }
    }
  }

  // 3대 비급여 특약 — 입·통원 모두 30%, 통원은 2만원과 비교, 항목별 연 한도
  for (const key of ["physical", "injection", "mri"]) {
    const base = ctx.non[key];
    if (!base) continue;
    const min = ctx.visit === "outpatient" ? specialFixed : 0;
    const self = Math.min(base, Math.max(min, Math.round(base * specialRate)));
    const raw = base - self;
    const payout = Math.min(raw, limits[key]);
    items.push(
      item(
        key,
        `${NON_LABELS[key]} (특약)`,
        base,
        payout,
        `${pct(specialRate)}${min ? `(${comma(base * specialRate)}원)와 공제 ${comma(min)}원 중 큰 금액` : ""} ${comma(
          self
        )}원을 뺐습니다. 연 한도 ${comma(limits[key])}원.${raw > limits[key] ? ` 한도를 넘어 ${comma(raw - limits[key])}원은 지급되지 않습니다.` : ""}`
      )
    );
  }
  notes.push(
    "3세대 3대 비급여(도수·체외충격파·증식, 비급여 주사, MRI·MRA)는 특약으로 따로 계산했습니다. 한도는 도수 350만원·주사 250만원·MRI 300만원입니다(금융위원회 2016-12-20)."
  );
  return { items, notes };
}

/* ───────────────────────── 4세대 ───────────────────────── */
function calcGen4(_profile, ctx) {
  const items = [];
  const notes = [];
  const coveredIncluded = ctx.coveredKind === "partial" || ctx.visit === "inpatient" ? ctx.coveredAmount : 0;

  // 급여 — 입원 20%, 통원 20%와 최소 공제(1만·2만) 중 큰 금액
  if (coveredIncluded) {
    if (ctx.visit === "inpatient") {
      let self = Math.round(coveredIncluded * 0.2);
      let payout = coveredIncluded - self;
      let reason = `급여 입원 본인부담금 ${comma(coveredIncluded)}원의 20%인 ${comma(self)}원을 뺐습니다.`;
      if (self > 2000000) {
        const back = self - 2000000;
        payout += back;
        self = 2000000;
        reason += ` 연 200만원을 넘어 초과분 ${comma(back)}원을 다시 더했습니다.`;
      }
      items.push(item("covered", "급여 입원", coveredIncluded, payout, reason));
    } else {
      const min = ctx.minFixed45;
      const self = deduct(coveredIncluded, 0.2, min);
      const raw = coveredIncluded - self;
      const payout = Math.min(raw, 200000);
      items.push(
        item(
          "covered",
          "급여 통원",
          coveredIncluded,
          payout,
          `20%(${comma(coveredIncluded * 0.2)}원)와 최소 공제 ${comma(min)}원 중 큰 ${comma(self)}원을 뺐습니다.${
            raw > 200000 ? " 통원 회당 한도 20만원을 적용했습니다." : ""
          }`
        )
      );
    }
  } else if (ctx.coveredKind === "full") {
    notes.push("4세대부터 급여 통원의 전액본인부담금은 보상 대상에서 빠집니다. 이 금액은 전액 본인부담입니다.");
  }

  // 비급여 — 4세대는 모두 30% (입원 30%, 통원 30%와 3만원 중 큰 금액)
  const nonTotal = NON_KEYS.reduce((s, k) => s + ctx.non[k], 0);
  if (nonTotal) {
    const min = ctx.visit === "outpatient" ? 30000 : 0;
    const self = Math.min(nonTotal, Math.max(min, Math.round(nonTotal * 0.3)));
    const raw = nonTotal - self;
    let payout = raw;
    let reason = `비급여 ${comma(nonTotal)}원의 30%${min ? `(${comma(nonTotal * 0.3)}원)와 공제 ${comma(min)}원 중 큰 금액` : ""} ${comma(
      self
    )}원을 뺐습니다.`;
    if (ctx.visit === "outpatient" && raw > 200000) {
      payout = 200000;
      reason += " 통원 회당 한도 20만원을 적용했습니다.";
    }
    items.push(item("nonAll", "비급여 (특약)", nonTotal, payout, reason));
    notes.push(
      "4세대 비급여는 입원 30%, 통원은 30%와 3만원 중 큰 금액을 뺍니다. 연간 5천만원·통원 회당 20만원 한도는 이 계산에서 넘지 않는다고 봤습니다."
    );
  }
  return { items, notes };
}

/* ───────────────────────── 5세대 ───────────────────────── */
function calcGen5(_profile, ctx) {
  const items = [];
  const notes = [];
  const coveredIncluded = ctx.coveredKind === "partial" || ctx.visit === "inpatient" ? ctx.coveredAmount : 0;

  if (coveredIncluded) {
    if (ctx.visit === "inpatient") {
      let self = Math.round(coveredIncluded * 0.2);
      let payout = coveredIncluded - self;
      let reason = `급여 입원 본인부담금 ${comma(coveredIncluded)}원의 20%인 ${comma(self)}원을 뺐습니다.`;
      if (self > 2000000) {
        const back = self - 2000000;
        payout += back;
        self = 2000000;
        reason += ` 연 200만원을 넘어 초과분 ${comma(back)}원을 다시 더했습니다.`;
      }
      items.push(item("covered", "급여 입원", coveredIncluded, payout, reason));
    } else {
      const min = ctx.minFixed45;
      const gh = Math.round(coveredIncluded * ctx.ghRate);
      const self = Math.min(coveredIncluded, Math.max(min, Math.round(coveredIncluded * 0.2), gh));
      const raw = coveredIncluded - self;
      const payout = Math.min(raw, 200000);
      items.push(
        item(
          "covered",
          "급여 통원",
          coveredIncluded,
          payout,
          `건강보험 본인부담률 ${pct(ctx.ghRate)}(${comma(gh)}원), 20%(${comma(coveredIncluded * 0.2)}원), 최소 공제 ${comma(
            min
          )}원 중 큰 ${comma(self)}원을 뺐습니다.${raw > 200000 ? " 통원 회당 한도 20만원을 적용했습니다." : ""}`
        )
      );
      notes.push(
        `건강보험 본인부담률은 ${HOSPITALS[ctx.hospital].label} 기준 ${pct(ctx.ghRate)}로 계산했습니다. 실제 영수증의 가중평균 본인부담률과 다를 수 있습니다.`
      );
    }
  } else if (ctx.coveredKind === "full") {
    notes.push("5세대 급여 통원은 일부본인부담금만 보상합니다. 전액본인부담금은 빠집니다.");
  }

  const severe = ctx.severity === "severe";

  /**
   * 특약1(중증)·특약2(비중증)는 같은 특약 안에서 한도·공제를 함께 본다.
   *  · 입원: 항목별 연 한도(3대 비급여)만 적용
   *  · 통원: 특약 통원 한도(1회·1일 20만원)를 그룹 합계로 적용
   */
  const group = [];
  const pushGroup = (key, label, base, rate, min, limit, head) => {
    if (!base) return;
    const self = Math.min(base, Math.max(min, Math.round(base * rate)));
    group.push({
      key,
      label,
      base,
      self,
      limit,
      reason: `${head} ${comma(base)}원의 ${pct(rate)}${min ? `(${comma(base * rate)}원)와 공제 ${comma(min)}원 중 큰 금액` : ""} ${comma(self)}원을 뺐습니다.`,
    });
  };
  const minOut = severe ? 30000 : 50000;
  const minIn = 0;
  const minOf = () => (ctx.visit === "outpatient" ? minOut : minIn);

  // 일반 비급여
  if (severe) {
    pushGroup("nonGeneral", "중증 비급여 (특약1)", ctx.non.general, 0.3, minOf(), 50000000, "중증(특약1) 일반 비급여");
  } else {
    const cap = ctx.visit === "inpatient" && !ctx.h.upper ? 3000000 : 10000000;
    pushGroup("nonGeneral", "비중증 비급여 (특약2)", ctx.non.general, 0.5, minOf(), cap, "비중증(특약2) 일반 비급여");
  }

  // 3대 비급여 — 중증 질환 치료면 특약1, 아니면 도수·주사는 보장 제외, MRI만 특약2(연 200만)
  for (const key of ["physical", "injection", "mri"]) {
    const base = ctx.non[key];
    if (!base) continue;
    if (severe) {
      const limits = { physical: 3500000, injection: 2500000, mri: 3000000 };
      pushGroup(key, `${NON_LABELS[key]} (특약1)`, base, 0.3, minOf(), limits[key], "중증 질환 치료로 특약1에서");
    } else if (key === "mri") {
      pushGroup("mri", "MRI·MRA (특약2)", base, 0.5, minOf(), 2000000, "비중증 MRI로 특약2에서");
    } else {
      items.push(
        item(
          key,
          `${NON_LABELS[key]} (보장 제외)`,
          base,
          0,
          "5세대 특약2는 근골격계 물리치료·체외충격파·비급여 주사제를 보장하지 않습니다. 전액 본인부담입니다."
        )
      );
    }
  }

  // 특약1 입원 — 상급·종합병원은 연간 자기부담 500만원 상한
  if (severe && ctx.visit === "inpatient" && ctx.h.upper) {
    let over = group.reduce((s, g) => s + g.self, 0) - 5000000;
    for (const g of group) {
      if (over <= 0) break;
      const give = Math.min(g.self, over);
      g.self -= give;
      over -= give;
      g.reason += ` 상급·종합병원 입원은 연간 자기부담 500만원을 넘지 않아 초과분 ${comma(give)}원을 다시 더했습니다.`;
    }
  }

  // 통원은 특약 1회(1일) 20만원 한도를 그룹 합계로 적용한다.
  let budget = ctx.visit === "outpatient" ? 200000 : Infinity;
  for (const g of group) {
    let pay = Math.min(g.base - g.self, g.limit);
    if (pay < g.base - g.self) g.reason += ` 연 한도 ${comma(g.limit)}원을 적용했습니다.`;
    if (pay > budget) {
      pay = Math.max(0, budget);
      g.reason += " 통원 한도 20만원을 적용했습니다.";
    }
    budget -= pay;
    items.push(item(g.key, g.label, g.base, pay, g.reason));
  }

  notes.push("5세대는 비급여가 중증(특약1)·비중증(특약2)으로 나뉩니다. 위쪽 '비급여 구분'을 바꾸면 같은 금액이 다른 특약으로 계산됩니다.");
  notes.push("5세대 비중증 비급여는 연 1천만원, 통원 일당 20만원, 병·의원 입원 회당 300만원 한도입니다. 이 계산은 진료 1건만 봅니다.");
  return { items, notes };
}

/* ─────────────────────── 유병력자 실손 ─────────────────────── */
function calcChronic(_profile, ctx) {
  const items = [];
  const notes = [];
  const coveredBase = ctx.coveredAmount + ctx.non.general;

  if (coveredBase) {
    if (ctx.visit === "inpatient") {
      const min = 100000;
      const self = Math.min(coveredBase, Math.max(min, Math.round(coveredBase * 0.3)));
      const raw = coveredBase - self;
      const payout = Math.min(raw, 50000000);
      items.push(
        item(
          "covered",
          "급여·일반 비급여 입원",
          coveredBase,
          payout,
          `30%(${comma(coveredBase * 0.3)}원)와 최소 자기부담 10만원 중 큰 ${comma(self)}원을 뺐습니다.${
            raw > 50000000 ? " 입원 한도 5천만원을 적용했습니다." : ""
          }`
        )
      );
    } else {
      const min = 20000;
      const self = Math.min(coveredBase, Math.max(min, Math.round(coveredBase * 0.3)));
      const raw = coveredBase - self;
      const payout = Math.min(raw, 200000);
      items.push(
        item(
          "covered",
          "급여·일반 비급여 통원",
          coveredBase,
          payout,
          `30%(${comma(coveredBase * 0.3)}원)와 최소 자기부담 2만원 중 큰 ${comma(self)}원을 뺐습니다.${
            raw > 200000 ? " 통원 회당 한도 20만원을 적용했습니다." : ""
          }`
        )
      );
    }
  }

  for (const key of ["physical", "injection", "mri"]) {
    const base = ctx.non[key];
    if (!base) continue;
    items.push(
      item(
        key,
        `${NON_LABELS[key]} (보장 제외)`,
        base,
        0,
        "유병력자 실손은 3대 비급여(도수·주사·MRI)를 보장하지 않습니다. 전액 본인부담입니다."
      )
    );
  }
  notes.push("유병력자 실손은 입원 30%·최소 10만원, 통원 30%·최소 2만원을 뺍니다. 처방조제비는 보장하지 않고, 통원은 회당 20만원·연 180회 한도입니다.");
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
  const payout = items.reduce((s, i) => s + i.payout, 0);
  return {
    id: profile.id,
    label: profile.label,
    short: profile.short,
    purchase: profile.purchase,
    items,
    notes,
    base,
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
  const total = norm.coveredAmount + NON_KEYS.reduce((s, k) => s + norm.non[k], 0);
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
    ...p.items.map((it) => `${it.label}: 보험금 ${comma(it.payout)}원 (공제 ${comma(it.deductible)}원) — ${it.reason}`),
  ];
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
  lines.push(`· 본인부담: ${comma(p.self)}원`);
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

export const FORMAT = { comma, pct };
