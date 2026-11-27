/**
 * 진료자료 활용 동의서 — 순수 함수만 둔다(입력 정리·검증·문구).
 *
 * 쓰는 곳
 *  · buffetkimz.com — `src/components/tools/DisclosureConsent.tsx`
 *  · InsureCRM      — 같은 문구·검증을 `app.html` 안에 옮겨 둔다(2.9.7).
 *    문구를 고치면 두 곳을 함께 고친다.
 *
 * 통신·DOM 코드를 넣지 않는다. 입력값은 브라우저 안에서만 다룬다.
 * 이 동의서는 법률 자문이 아니라 상담 전 확인용 서식이며, 최종 문구는 소속 회사의
 * 개인정보 처리방침·동의서 양식으로 한 번 더 확인한다.
 */

export const CONSENT_FORM_VERSION = "2026-11-27";
export const RETENTION_DAYS = 30;

/** 상단에 세우는 다섯 약속 — 제목은 짧게, 설명은 한 문장으로. */
export const PROMISES = [
  {
    no: 1,
    title: "진료자료는 고객이 직접 발급합니다",
    body: "심평원 ‘내 진료정보 열람’에서 고객님 본인이 내려받아 주십니다. 발급을 대신 해 드리지 않습니다.",
  },
  {
    no: 2,
    title: "인증서·비밀번호는 절대 받지 않습니다",
    body: "공동인증서·금융인증서·아이디·비밀번호를 알려 주지 않으셔도 됩니다. 요구받으면 거절하십시오.",
  },
  {
    no: 3,
    title: "활용 동의서를 먼저 받습니다",
    body: "자료를 받기 전에 이 동의서로 목적·항목·보관기간을 확인하고 서명을 받습니다.",
  },
  {
    no: 4,
    title: "병력·고지 확인에만 사용합니다",
    body: "계약 전 알릴의무 확인과 보장 상담 목적으로만 쓰고, 다른 목적이나 제3자 제공에 쓰지 않습니다.",
  },
  {
    no: 5,
    title: "확인 후 30일 안에 파기합니다",
    body: "확인이 끝나면 지체 없이, 늦어도 30일 안에 받은 파일과 확인증 사본을 파기합니다.",
  },
];

/** 동의 항목 — 화면·확인증·요약이 모두 이 배열 하나를 읽는다. */
export const CONSENT_ITEMS = [
  {
    key: "privacy",
    required: true,
    title: "개인정보 수집·이용 동의",
    lines: [
      ["목적", "보험 가입 전 계약 전 알릴의무 확인 및 보장 상담"],
      ["항목", "성명, 연락처, 생년월일, 고객이 직접 제출한 심평원 진료·투약 내역"],
      ["보유기간", "목적 달성 후 지체 없이 파기(최대 30일)"],
      ["거부권", "동의를 거부할 수 있습니다. 거부하면 진료자료를 활용한 고지 확인과 보장 상담이 어렵습니다."],
    ],
  },
  {
    key: "sensitive",
    required: true,
    title: "민감정보(건강·질병 정보) 처리 동의",
    lines: [
      ["대상", "진단명, 투약 내역, 입원·수술 이력 등 건강·질병 정보"],
      ["목적", "계약 전 알릴의무 확인 및 보장 상담"],
      ["보유기간", "목적 달성 후 지체 없이 파기(최대 30일)"],
      ["거부권", "민감정보 처리에 동의하지 않으면 진료자료를 활용한 확인이 어렵습니다."],
    ],
  },
  {
    key: "contact",
    required: false,
    title: "상담 안내·후속 연락 수신 동의",
    lines: [
      ["내용", "보장 상담 일정 안내와 후속 연락(전화·문자·메신저)"],
      ["안내", "선택 항목입니다. 동의하지 않아도 동의서 작성과 상담은 진행됩니다."],
    ],
  },
];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** 010-1234-5678 형식으로 맞춘다. 자릿수가 모자라면 있는 만큼만 끊어 보여 준다. */
export function formatPhone(value) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length < 11) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 휴대폰 번호인지 — 01로 시작하는 10~11자리. */
export function isValidPhone(value) {
  const d = digitsOnly(value);
  return /^01[016789]\d{7,8}$/.test(d);
}

function isRealDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * 생년월일을 YYYY-MM-DD로 맞춘다.
 * 받는 형식: 1981-08-23 · 1981.8.23 · 19810823 · 810823
 * 6자리는 2000년대와 1900년대를 오늘 날짜 기준으로 가른다(미래가 되면 1900년대).
 * 형식이 아니거나 실재하지 않는 날짜면 ""를 돌려준다.
 */
export function normalizeBirth(value, today = new Date()) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = digitsOnly(raw);
  let y;
  let m;
  let d;
  if (DATE_RE.test(raw)) {
    [y, m, d] = raw.split("-").map(Number);
  } else if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(raw)) {
    const parts = raw.split(/[.\-/]/).map(Number);
    [y, m, d] = parts;
  } else if (digits.length === 8) {
    y = Number(digits.slice(0, 4));
    m = Number(digits.slice(4, 6));
    d = Number(digits.slice(6, 8));
  } else if (digits.length === 6) {
    const yy = Number(digits.slice(0, 2));
    const nowYY = today.getFullYear() % 100;
    y = yy <= nowYY ? 2000 + yy : 1900 + yy;
    m = Number(digits.slice(2, 4));
    d = Number(digits.slice(4, 6));
  } else {
    return "";
  }
  if (!isRealDate(y, m, d)) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const limit = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (dt > limit) return "";
  if (y < 1900) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function ageFromBirth(birth, today = new Date()) {
  const iso = normalizeBirth(birth, today);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  let age = today.getFullYear() - y;
  const before = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (before) age -= 1;
  return age;
}

/** 2026-11-27 → 2026년 11월 27일 */
export function formatDateKo(iso) {
  const m = DATE_RE.exec(String(iso ?? ""));
  if (!m) return "";
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

/** ISO 시각 → 2026년 11월 27일 15:04 (KST 기준) */
export function formatDateTimeKo(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${Number(get("year"))}년 ${Number(get("month"))}월 ${Number(get("day"))}일 ${get("hour")}:${get("minute")}`;
}

/** 오늘 날짜(한국 시간) YYYY-MM-DD */
export function todayKo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 동의번호 — DC-20261127-4F2A. 같은 날 여러 건이어도 구분되게 임의 4자리를 붙인다. */
export function makeConsentNo(nowIso = new Date().toISOString(), random = Math.random) {
  const ymd = todayKo(new Date(nowIso)).replace(/-/g, "");
  const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let tail = "";
  for (let i = 0; i < 4; i += 1) tail += chars[Math.floor(random() * chars.length) % chars.length];
  return `DC-${ymd}-${tail}`;
}

/**
 * 작성 완료 조건을 검사한다.
 * state: { name, phone, birth, checks: {privacy, sensitive, contact}, hasSignature }
 * 돌려주는 값: { ok, errors: { name?, phone?, birth?, required?, signature? }, normalized }
 */
export function validateConsent(state, today = new Date()) {
  const name = String(state?.name ?? "").trim();
  const phone = formatPhone(state?.phone ?? "");
  const birth = normalizeBirth(state?.birth ?? "", today);
  const checks = state?.checks ?? {};
  const errors = {};

  if (name.length < 2) errors.name = "성명을 두 글자 이상 입력해 주세요.";
  else if (/\d/.test(name)) errors.name = "성명에는 숫자를 넣지 마세요.";
  else if (name.length > 30) errors.name = "성명은 30자 이내로 입력해 주세요.";

  if (!phone) errors.phone = "연락처를 입력해 주세요.";
  else if (!isValidPhone(phone)) errors.phone = "휴대폰 번호(010-0000-0000)를 확인해 주세요.";

  if (!String(state?.birth ?? "").trim()) errors.birth = "생년월일을 입력해 주세요.";
  else if (!birth) errors.birth = "생년월일을 YYYY-MM-DD 또는 6자리로 확인해 주세요.";
  else {
    const age = ageFromBirth(birth, today);
    if (age === null || age < 0 || age > 120) errors.birth = "생년월일을 다시 확인해 주세요.";
  }

  const missing = CONSENT_ITEMS.filter((item) => item.required && !checks[item.key]);
  if (missing.length) errors.required = "필수 동의 항목 두 가지를 모두 확인해 주세요.";

  if (!state?.hasSignature) errors.signature = "서명란에 손가락이나 마우스로 서명해 주세요.";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    normalized: { name, phone, birth },
  };
}

/** 설계사가 자기 기록에 남기는 한 덩어리 요약 */
export function buildSummary(record) {
  const checks = record?.checks ?? {};
  const items = CONSENT_ITEMS.map(
    (item) => `${item.title.replace(" 동의", "")}: ${checks[item.key] ? "동의" : item.required ? "미동의" : "미동의(선택)"}`
  );
  return [
    "[진료자료 활용 동의서]",
    `동의번호 ${record?.no ?? "-"}`,
    `작성 일시 ${formatDateTimeKo(record?.at ?? "")}`,
    `성명 ${record?.name ?? "-"} · 생년월일 ${record?.birth ?? "-"} · 연락처 ${record?.phone ?? "-"}`,
    ...items,
    `서명 ${record?.hasSignature === false ? "없음" : "확인(기기 안 전자서명)"}`,
    `보관 ${RETENTION_DAYS}일 이내 파기 · 외부 전송 없음`,
    record?.example ? "※ 가상 예시로 작성한 확인증입니다. 효력이 없습니다." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 고객에게 보내는 안내 문구 — 페이지 주소를 함께 넣는다. */
export function buildGuide(record, url) {
  return [
    "[진료자료 활용 동의서 안내]",
    "보험 가입 전 계약 전 알릴의무 확인과 보장 상담을 위해 진료자료 활용 동의를 받습니다.",
    "아래 주소에서 내용을 확인하고 직접 서명해 주세요.",
    url,
    "",
    "· 진료자료는 고객님이 직접 발급해 주세요. 인증서·비밀번호는 받지 않습니다.",
    `· 병력·고지 확인에만 사용하고, 확인 후 ${RETENTION_DAYS}일 안에 파기합니다.`,
    "· 동의는 언제든지 거부하거나 철회할 수 있습니다.",
    "",
    `${record?.name ?? "고객"}님, 감사합니다.`,
  ].join("\n");
}

/** 파일 이름에 쓸 수 없는 글자를 지운다. */
export function safeFilePart(value, fallback = "고객") {
  const s = String(value ?? "").replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 20);
  return s || fallback;
}
