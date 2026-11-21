/**
 * 신선도 배지를 **브라우저에서** 다시 계산해 DOM에 반영한다 — v5.9.1.
 *
 * v5.9.0은 배지를 빌드 시각에만 계산했다. 정적 사이트는 그 순간부터 배지가 멈추므로,
 * 19:00이 지나도 화면은 '정상'인 채로 남았다. 이 모듈은 같은 규칙(`freshnessOf`)을
 * 브라우저에서 다시 돌려, 페이지를 열 때와 1분마다 배지·안내 문구를 갱신한다.
 *
 * 규칙은 fresh.ts 하나만 쓴다(서버·브라우저가 같은 함수). 여기서는 DOM 읽기·쓰기만 한다.
 *
 * 읽는 속성 (허브 섹션과 카드 li 모두 같은 이름)
 *   data-as-of            이 내용을 확인한 시각 (ISO)
 *   data-next-check-at    다음 확인 예정 시각 (ISO)
 *   data-stale-days       '지난 정보' 기준 일수
 *   data-status           'ok' | 'failed'
 *   data-last-good-as-of  실패 시 마지막 정상 기준 시각 (ISO, 없으면 빈 문자열)
 *   data-schedule-connected  자동 갱신 연결 여부(v5.9.2) — false면 지연 문구가 '아직 연결되지 않았다'로 바뀐다
 *
 * 쓰는 곳
 *   [data-fresh]         현재 상태 (ok / delayed / stale / failed)
 *   [data-fresh-badge]   배지 — data-fresh-badge·클래스·라벨·설명·hidden
 *   [data-hub-next]      '다음 확인 19:00' 한 줄 — 정상일 때만 보인다
 *   [data-fresh-checked-at] 이 계산을 마지막으로 돌린 시각 (검증·실측용)
 */
import { clockLabel, freshnessOf, type FreshInput, type FreshState } from "./fresh";

/** 이 요소가 자기 카드의 배지인지 — 안쪽 카드(li)의 배지는 건드리지 않는다. */
function ownsBadge(el: Element, root: HTMLElement): boolean {
  const owner = el.closest("[data-hub-item], [data-hub]");
  return owner === root;
}

/** DOM에 심은 data-* 속성 → freshnessOf 입력 */
export function freshnessInputOf(el: HTMLElement): FreshInput {
  const d = el.dataset;
  const stale = d.staleDays ? Number(d.staleDays) : undefined;
  // 카드는 허브 섹션의 연결 상태를 물려받는다(카드 li에는 속성을 따로 심지 않는다)
  const schedule = d.scheduleConnected ?? el.closest<HTMLElement>("[data-schedule-connected]")?.dataset.scheduleConnected;
  return {
    asOf: d.asOf ?? "",
    nextCheckAt: d.nextCheckAt || undefined,
    staleAfterDays: Number.isFinite(stale) ? stale : undefined,
    status: d.status === "failed" ? "failed" : "ok",
    lastGoodAsOf: d.lastGoodAsOf || undefined,
    scheduleConnected: schedule === "false" ? false : undefined,
  };
}

/** 한 요소(허브 섹션 또는 카드 li)의 배지를 `now` 기준으로 다시 그린다. */
export function applyFreshness(el: HTMLElement, now: Date = new Date()): FreshState {
  const input = freshnessInputOf(el);
  if (!input.asOf) return (el.dataset.fresh as FreshState) ?? "ok";

  const fresh = freshnessOf(input, now);
  el.dataset.fresh = fresh.state;

  for (const badge of el.querySelectorAll<HTMLElement>("[data-fresh-badge]")) {
    if (!ownsBadge(badge, el)) continue;
    badge.className = `hub-fresh hub-fresh--${fresh.state}`;
    badge.dataset.freshBadge = fresh.state;
    const label = badge.querySelector<HTMLElement>(".hub-fresh-label");
    const detail = badge.querySelector<HTMLElement>(".hub-fresh-detail");
    if (label) label.textContent = fresh.label;
    if (detail) detail.textContent = fresh.detail;
    badge.hidden = fresh.state === "ok";
  }

  /*
   * '다음 확인 19:00'은 자동 갱신이 연결됐을 때만 말한다(v5.9.2).
   * 수동 확인 모드(data-schedule-connected="false")에서는 이 줄 자체를 그리지 않는다.
   */
  const connected = el.dataset.scheduleConnected !== "false";
  for (const next of el.querySelectorAll<HTMLElement>("[data-hub-next]")) {
    if (!ownsBadge(next, el)) continue;
    if (!connected) {
      next.hidden = true;
      continue;
    }
    if (input.nextCheckAt) next.textContent = `다음 확인 ${clockLabel(input.nextCheckAt)}`;
    next.hidden = fresh.state !== "ok";
  }

  el.dataset.freshCheckedAt = now.toISOString();
  return fresh.state;
}

/** 허브 섹션 + 그 안의 카드 전부를 한 번에 다시 그린다. */
export function refreshHub(root: HTMLElement, now: Date = new Date()): FreshState[] {
  const states = [applyFreshness(root, now)];
  for (const item of root.querySelectorAll<HTMLElement>("[data-hub-item]")) {
    states.push(applyFreshness(item, now));
  }
  return states;
}
