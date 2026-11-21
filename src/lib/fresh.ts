/**
 * 신선도(기준 시각) 계산 — v5.9.
 *
 * 정적 사이트는 '실시간'을 약속할 수 없다. 대신 카드마다 **확인한 시각**과 **다음 확인 예정 시각**을
 * 박아 두고, 빌드 시각과 비교해 배지 하나를 정한다. 이 파일은 그 판정만 한다.
 *
 *   ① 정상      — 다음 확인 시점 이전. 회색 작은 글씨만.
 *   ② 확인 지연 — 다음 확인 시점을 넘김. 마지막 기준 시각을 함께 보여 준다.
 *   ③ 지난 정보 — 기준 시각이 3일을 넘김. 카드를 지우지 않고 톤만 낮춘다.
 *   ④ 갱신 실패 — 파이프라인이 실패해 직전 정상값을 그대로 보여 주는 중. lastGoodAsOf를 함께 쓴다.
 *
 * 우선순위는 ④ → ③ → ② → ①. 실패한 카드가 오래됐다면 '갱신 실패'가 먼저 보여야 한다
 * (지연된 사실 자체를 숨기지 않는다).
 */

export type FreshState = "ok" | "delayed" | "stale" | "failed";

export type FreshInput = {
  /** 이 카드 내용을 확인한 시각 (ISO) */
  asOf: string | Date;
  /** 다음 자동 확인 예정 시각 (ISO) */
  nextCheckAt?: string | Date;
  /** 파이프라인 기록 — 실패한 회차면 failed */
  status?: "ok" | "failed";
  /** 마지막으로 성공한 회차의 확인 시각 (status가 failed일 때 쓴다) */
  lastGoodAsOf?: string | Date;
  /** '지난 정보'로 넘기는 기준(일). 카드·데이터가 정하지 않으면 3일 */
  staleAfterDays?: number;
};

export type Fresh = {
  state: FreshState;
  /** 배지에 쓰는 짧은 말 */
  label: string;
  /** 배지 옆·아래에 붙는 한 줄 설명 (정상이면 빈 문자열) */
  detail: string;
};

/** '지난 정보'로 넘기는 기준 — 3일(72시간) 초과 */
export const STALE_AFTER_DAYS = 3;
const DAY_MS = 86400000;

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));

/** 2026-11-21T14:00:00+09:00 → '2026. 11. 21. 14:00' (24시간제) */
export function asOfLabel(value: string | Date, withYear = true): string {
  const d = toDate(value);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hh = get("hour") === "24" ? "00" : get("hour");
  const date = withYear
    ? `${get("year")}. ${get("month")}. ${get("day")}.`
    : `${get("month").padStart(2, "0")}. ${get("day").padStart(2, "0")}.`;
  return `${date} ${hh}:${get("minute")}`;
}

/** 2026-11-21T19:00:00+09:00 → '19:00' */
export function clockLabel(value: string | Date): string {
  const d = toDate(value);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/^24/, "00");
}

/**
 * 배지 하나를 정한다. `now`는 빌드 시각(또는 테스트에서 고정한 시각)이다.
 * 정상일 때도 기준 시각은 화면에 남으므로 label을 비우지 않고 '정상'을 돌려준다.
 */
export function freshnessOf(input: FreshInput, now: Date = new Date()): Fresh {
  const asOf = toDate(input.asOf);
  const lastGood = input.lastGoodAsOf ? toDate(input.lastGoodAsOf) : asOf;

  if (input.status === "failed") {
    const next = input.nextCheckAt ? clockLabel(input.nextCheckAt) : "다음";
    return {
      state: "failed",
      label: "갱신 실패",
      detail: `${next} 갱신에 실패해 ${asOfLabel(lastGood, false)} 기준 내용을 그대로 보여드립니다.`,
    };
  }

  const staleAfter = input.staleAfterDays ?? STALE_AFTER_DAYS;
  const ageDays = (now.getTime() - asOf.getTime()) / DAY_MS;
  if (ageDays > staleAfter) {
    return {
      state: "stale",
      label: "지난 정보",
      detail: `기준 ${asOfLabel(asOf, false)} · ${Math.floor(ageDays)}일 지난 값입니다.`,
    };
  }

  if (input.nextCheckAt && now.getTime() > toDate(input.nextCheckAt).getTime()) {
    return {
      state: "delayed",
      label: "확인 지연",
      detail: `다음 확인이 지연되고 있습니다. 마지막 기준 ${asOfLabel(asOf, false)}.`,
    };
  }

  return { state: "ok", label: "정상", detail: "" };
}
