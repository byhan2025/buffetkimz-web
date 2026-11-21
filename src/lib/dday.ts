/**
 * D-Day 뱃지 — 골든타임·홈 허브가 **같은 함수**를 쓴다 (v5.9).
 *
 * 계산은 날짜 단위로만 한다(시각 차이로 하루가 흔들리지 않게). 오늘·D-n·기한 지남 세 가지로 나누고,
 * 색은 자극을 피해 세 단계만 쓴다.
 *
 *   D-7 이상  회색        어느 정도 여유가 있다
 *   D-3~D-6   주황        준비를 시작할 시점
 *   D-2 이하·오늘  진한 회색 + 굵게   빨강 대신 무게로 급함을 표현한다
 *   기한 지남  회색 + 취소선 없음     지우지 않고 사실만 남긴다
 *
 * 뱃지 옆에는 **항상 실제 날짜**를 함께 쓴다 (D-2만 보고는 무슨 날인지 알 수 없다).
 */

export type DDayTone = "past" | "today" | "near" | "soon" | "later";

export type DDay = {
  /** 오늘 기준 남은 일수 (지났으면 음수) */
  days: number;
  /** 뱃지 문구 — '오늘' · 'D-2' · '기한 지남' */
  label: string;
  tone: DDayTone;
  /** 함께 쓰는 실제 날짜 — '11. 23.' */
  dateLabel: string;
  /** 화면 낭독용 — '11월 23일까지 2일 남음' */
  aria: string;
};

const DAY_MS = 86400000;

/** 'YYYY-MM-DD' 또는 ISO → UTC 자정 기준 일수 (시간대 영향 제거) */
function dayNumber(value: string | Date): number {
  if (value instanceof Date) {
    return Math.floor(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS
    );
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return Number.NaN;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** 2026-11-23 → '11. 23.' */
export function shortDate(value: string | Date): string {
  const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  const month = m ? Number(m[2]) : value instanceof Date ? value.getMonth() + 1 : 0;
  const day = m ? Number(m[3]) : value instanceof Date ? value.getDate() : 0;
  if (!month || !day) return "";
  return `${String(month).padStart(2, "0")}. ${String(day).padStart(2, "0")}.`;
}

/**
 * 기준일과 기한일로 뱃지를 만든다.
 * `today`는 사이트 기준일(site.today) 또는 테스트에서 고정한 날짜.
 */
export function ddayOf(due: string | Date, today: Date = new Date()): DDay {
  const days = dayNumber(due) - dayNumber(today);
  const dateLabel = shortDate(due);

  if (Number.isNaN(days)) {
    return { days: Number.NaN, label: "", tone: "later", dateLabel: "", aria: "" };
  }
  if (days < 0) {
    return {
      days,
      label: "기한 지남",
      tone: "past",
      dateLabel,
      aria: `${dateLabel} 기한이 지났습니다`,
    };
  }
  if (days === 0) {
    return { days, label: "오늘", tone: "today", dateLabel, aria: `${dateLabel} 오늘입니다` };
  }
  const tone: DDayTone = days <= 2 ? "near" : days <= 6 ? "soon" : "later";
  return {
    days,
    label: `D-${days}`,
    tone,
    dateLabel,
    aria: `${dateLabel}까지 ${days}일 남았습니다`,
  };
}

/** 기한이 지난 항목은 달력에서 기본으로 뱃지를 달지 않는다 — 지난 달 전체가 뱃지로 덮인다. */
export function isUpcoming(due: string | Date, today: Date = new Date()): boolean {
  return dayNumber(due) >= dayNumber(today);
}
