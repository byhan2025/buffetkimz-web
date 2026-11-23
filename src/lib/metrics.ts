/**
 * 배지 해석 — v9.0.0 P0 신설 (reports/buffetkimz-web/learning-blueprint-v1-20261123.md §4-2·§4-4).
 *
 * 배지 두 종류를 **하나의 함수**로 읽는다.
 *   M 시장 배지 — `today.ts`의 `indicators` (하루 네 번 갱신, 값마다 기준 시각)
 *   R 제도 배지 — `metric-badges.ts` (법·요율, 연 단위)
 *
 * 지켜야 하는 세 가지 (설계 §4-2·§8)
 *  ① 값만 있고 **기준 시각이 없는 배지는 그리지 않는다.** `asOfLabel`·`source`·`sourceUrl` 중 하나라도 없으면 null.
 *     → 그래서 이 파일은 '빈 배지'를 만들 수 없다. 화면은 null을 받으면 그 자리를 비운다.
 *  ② 신선도는 `fresh.ts` 하나로만 판정한다. '실시간'이라는 말을 만들지 않고, 지연·지난 정보·갱신 실패를
 *     같은 어휘로 말한다.
 *  ③ 이 파일에는 숫자가 없다. 시장 값은 `today.ts`, 제도 값은 `metric-badges.ts`가 유일한 출처다.
 *     (`verify_tax_consistency.py` B1이 `src/lib`의 세율 리터럴을 막는다.)
 *
 * 지금 단계(P0)에서 이 파일은 해석기만이다. 배지를 그리는 컴포넌트는 P1(`components/metrics/LiveMetricBadge.astro`).
 */
import { today as hubToday, type Indicator } from "../data/today";
import { metricBadgeById, type MetricBadge, type MetricBadgeId } from "../data/metric-badges";
import { freshnessOf, type Fresh } from "./fresh";

/** 허브 전체의 신선도 — 배지 경고는 이 값만 본다(지표별 나이는 값의 성질이라 경고가 아니다). */
export function hubFreshness(): Fresh {
  return freshnessOf({
    asOf: hubToday.asOf,
    nextCheckAt: hubToday.nextCheckAt,
    status: hubToday.status,
    lastGoodAsOf: hubToday.lastGoodAsOf,
    scheduleConnected: hubToday.scheduleConnected,
    staleAfterDays: hubToday.staleAfterDays,
  });
}

/** 시장 배지 — 값·등락·기준 시각·출처가 모두 있을 때만 만들어진다. */
export type MarketBadge = {
  kind: "market";
  id: string;
  ind: Indicator;
  /**
   * 지표 하나의 나이 — 기준금리처럼 **값이 한 달씩 유지되는 지표**는 3일 규칙에 걸려 '지난 정보'가 된다.
   * 그래서 화면의 경고는 이 값이 아니라 `hubFresh`(허브 전체의 신선도)로 판단한다.
   */
  fresh: Fresh;
  /**
   * 허브 전체의 신선도 — 파이프라인이 실패했거나 허브가 3일 넘게 멈췄을 때만 경고를 띄운다.
   * 지표 값 자체의 기준 시각은 언제나 `ind.asOfLabel`로 함께 보인다(값과 기준이 떨어지지 않는다).
   */
  hubFresh: Fresh;
  /** 화면 낭독용 한 줄 — '코스피 4,715.38, 전일 대비 3.17% 내림, 11. 23. 13:30 장중 기준, 한국거래소' */
  aria: string;
};

/** 제도 배지 — `metric-badges.ts`의 항목 그대로. */
export type RuleBadge = MetricBadge & { kind: "rule" };

export type Badge = MarketBadge | RuleBadge;

/** 배지 묶음 지정 — 글 frontmatter `metrics`, 트랙 `stage.badges`, 강의 `metricIds`가 같은 모양을 쓴다. */
export type BadgeSpec = {
  market?: string[];
  rules?: (MetricBadgeId | string)[];
};

const directionWord = (ind: Indicator): string => {
  if (ind.direction === "up") return "오름";
  if (ind.direction === "down") return "내림";
  return "변동 없음";
};

/** 값·등락·기준 시각·출처가 한 줄에 다 있는 배지만 돌려준다. */
function ariaOf(ind: Indicator): string {
  // '동결'처럼 등락률이 아닌 말은 '전일 대비 … 변동 없음'으로 늘리지 않는다(읽으면 뜻이 흐려진다).
  const change = ind.change?.trim()
    ? ind.direction === "flat"
      ? `, ${ind.change.trim()}`
      : `, 전일 대비 ${ind.change.replace(/^[−-]/, "")} ${directionWord(ind)}`
    : "";
  return `${ind.name} ${ind.value}${change}, ${ind.asOfLabel} 기준, ${ind.source}`;
}

/**
 * 시장 배지 하나. 없는 id·기준 시각 없는 지표·출처 없는 지표는 **null**이다.
 * null은 '아직 안 만든 것'이 아니라 '말할 수 없는 것'이므로 화면은 그 자리를 비운다.
 */
export function marketBadge(id: string): MarketBadge | null {
  const ind = hubToday.indicators.find((item) => item.id === id);
  if (!ind) return null;
  if (!ind.asOfLabel || !ind.asOf || !ind.source || !ind.sourceUrl) return null;
  return {
    kind: "market",
    id,
    ind,
    fresh: freshnessOf({
      asOf: ind.asOf,
      nextCheckAt: hubToday.nextCheckAt,
      status: hubToday.status,
      lastGoodAsOf: hubToday.lastGoodAsOf,
      scheduleConnected: hubToday.scheduleConnected,
      staleAfterDays: hubToday.staleAfterDays,
    }),
    hubFresh: hubFreshness(),
    aria: ariaOf(ind),
  };
}

/** 제도 배지 하나. 카탈로그에 없는 id는 null. */
export function ruleBadge(id: string): RuleBadge | null {
  const badge = metricBadgeById(id);
  if (!badge) return null;
  if (!badge.value || !badge.law || !badge.lawUrl) return null;
  return { ...badge, kind: "rule" };
}

/** 지정 순서를 지켜 배지 배열을 만든다 — 해석되지 않는 id는 조용히 빠진다(검증 스크립트가 따로 잡는다). */
export function badgesOf(spec: BadgeSpec): Badge[] {
  const out: Badge[] = [];
  for (const id of spec.market ?? []) {
    const badge = marketBadge(id);
    if (badge) out.push(badge);
  }
  for (const id of spec.rules ?? []) {
    const badge = ruleBadge(id);
    if (badge) out.push(badge);
  }
  return out;
}

/** 해석되지 않은 id 목록 — 검증 스크립트·개발 중 진단용(화면에는 쓰지 않는다). */
export function unresolvedBadgeIds(spec: BadgeSpec): { market: string[]; rules: string[] } {
  return {
    market: (spec.market ?? []).filter((id) => marketBadge(id) === null),
    rules: (spec.rules ?? []).filter((id) => ruleBadge(id) === null),
  };
}

type PostLike = { id: string; data: { metrics?: BadgeSpec } };

/**
 * 글 frontmatter `metrics` 참조 검사 — 글·트랙·강의가 없는 지표 id를 가리키면 빌드가 선다.
 * `validatePairs`(글↔카드)와 같은 자리에서 부른다.
 */
export function validateBadgeRefs(posts: PostLike[], specs: { where: string; spec: BadgeSpec }[] = []): void {
  const errors: string[] = [];
  const all = [
    ...posts.map((p) => ({ where: `글 ${p.id}`, spec: p.data.metrics ?? {} })),
    ...specs,
  ];
  for (const { where, spec } of all) {
    const missing = unresolvedBadgeIds(spec);
    for (const id of missing.market) errors.push(`${where} metrics.market: today.ts에 "${id}" 지표가 없습니다`);
    for (const id of missing.rules) errors.push(`${where} metrics.rules: metric-badges.ts에 "${id}"가 없습니다`);
  }
  if (errors.length) throw new Error(`배지 참조 불일치 ${errors.length}건:\n- ${errors.join("\n- ")}`);
}
