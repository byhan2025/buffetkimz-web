import { useMemo, useState } from "react";
import { UtilShell } from "./UtilShell";
import { DateField, Line, num } from "./fields-c";

/**
 * 전입·확정일자 이사 D-Day 체커.
 *
 *  · 전입신고: 전입한 날부터 14일 이내(주민등록법 제16조).
 *  · 대항력: 인도 + 전입신고를 마친 다음 날 0시(주택임대차보호법 제3조 제1항).
 *  · 우선변제권: 전입신고 + 임대차계약서 확정일자(같은 법 제3조의2).
 * 체크 상태는 브라우저 메모리에만 있고 저장하지 않는다.
 */

const DAY = 86400000;

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function fmt(d: Date) {
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}.`;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

type Item = { offset: number; title: string; body: string; legal?: string };

const ITEMS: Item[] = [
  {
    offset: -30,
    title: "잔금·대출·이사 예약",
    body: "잔금일과 대출 실행일을 맞추고, 이사·청소·인터넷·가스 이전을 예약합니다. 관리사무소에는 이사 일정을 미리 알립니다.",
  },
  {
    offset: -7,
    title: "계약서·서류 준비",
    body: "임대차계약서 원본, 계약금 영수증, 주민등록등본·신분증을 챙깁니다. 확정일자와 전입신고에 같은 서류를 씁니다.",
  },
  {
    offset: 0,
    title: "잔금 지급 · 열쇠 인수",
    body: "잔금을 치르고 열쇠를 받습니다. 입주 전 관리비·수도·가스·전기 검침을 사진으로 남기고, 도어락 비밀번호를 바꿉니다.",
    legal: "잔금일 = 인도일이면 이날부터 대항력 요건(인도)이 충족됩니다.",
  },
  {
    offset: 1,
    title: "전입신고 (14일 이내)",
    body: "주민센터 또는 정부24에서 전입신고를 합니다. 이 신고로 대항력이 생기고, 주민등록등본도 새 주소로 바뀝니다.",
    legal: "전입한 날부터 14일 이내(주민등록법 제16조) · 대항력은 신고 다음 날 0시(주택임대차보호법 제3조)",
  },
  {
    offset: 1,
    title: "확정일자 받기",
    body: "임대차계약서에 확정일자를 받습니다. 전입신고만으로는 대항력만 생기고, 보증금을 먼저 받아낼 권리(우선변제권)는 확정일자를 받아야 생깁니다.",
    legal: "주민센터 또는 인터넷등기소 · 전입신고 + 확정일자 = 우선변제권(같은 법 제3조의2)",
  },
  {
    offset: 3,
    title: "보증금 반환보증 검토",
    body: "HUG·HF·SGI의 전세보증금반환보증 가입 요건을 확인합니다. 보증기관마다 보증금 한도·주택 가격 기준·필요 서류가 다릅니다.",
    legal: "가입은 계약 기간 중에도 가능하지만, 요건은 기관별로 확인해야 합니다.",
  },
  {
    offset: 14,
    title: "전입신고 기한 마지막 날",
    body: "이 날을 넘기면 과태료가 부과될 수 있고, 대항력 발생일도 그만큼 밀립니다. 집주인에게도 전입 사실을 알려 두세요.",
    legal: "주민등록법 제16조 · 기한 초과 시 과태료",
  },
  {
    offset: 30,
    title: "정산·신고 확인",
    body: "관리비·공과금 정산서를 받고, 임대인이면 주택임대차 신고(보증금 6억 초과 또는 월세 30만원 초과) 대상인지 확인합니다.",
    legal: "주택임대차 신고는 계약체결일부터 30일 이내(임대인 의무)",
  },
];

const CHECKS = [
  "관리비·수도·가스·전기 검침값 사진으로 남기기",
  "장기수선충당금 정산 확인(계약서 기재 여부)",
  "도어락 비밀번호·열쇠 교체",
  "우편물 전송 서비스(주소 이전) 신청",
  "인터넷·TV 설치 일정 확정",
  "자동이체·카드 배송지 주소 변경",
  "건강보험 피부양자·지역가입자 전환 확인",
];

export default function MovingDday({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `unit-date-calc`의 '이사 D-Day' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [balance, setBalance] = useState("2026-12-15");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const calc = useMemo(() => {
    const base = parseDate(balance);
    const today = startOfToday();
    if (!base) return null;
    const untilBase = Math.round((base.getTime() - today.getTime()) / DAY);
    const reportLimit = addDays(base, 14);
    const daysLeft = Math.round((reportLimit.getTime() - today.getTime()) / DAY);
    const rows = ITEMS.map((it) => ({ ...it, date: addDays(base, it.offset) }));
    return { base, today, untilBase, reportLimit, daysLeft, rows };
  }, [balance]);

  if (!calc) {
    const empty = <p className="text-[13px] text-ink-muted">잔금일을 선택해 주세요.</p>;
    if (embedded) return empty;
    return (
      <UtilShell id="moving-dday" title="전입·확정일자 이사 D-Day" subtitle="잔금일을 넣으면 일정이 계산됩니다.">
        {empty}
      </UtilShell>
    );
  }

  const dLabel = calc.untilBase > 0 ? `D-${calc.untilBase}` : calc.untilBase === 0 ? "D-DAY" : `D+${-calc.untilBase}`;

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">전입·확정일자 이사 D-Day</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">잔금일 기준으로 전입신고 14일 기한과 대항력·우선변제권 시점을 역산합니다.</p>
        </div>
      )}
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <DateField
          label="잔금일(이사일)"
          value={balance}
          onChange={setBalance}
          hint="잔금과 입주가 같은 날이라고 봅니다"
        />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">잔금일까지</p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-brand">{dLabel}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{fmt(calc.base)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">전입신고 기한</p>
          <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">{fmt(calc.reportLimit)}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {calc.daysLeft >= 0 ? `${num(calc.daysLeft)}일 남음` : `기한 ${num(-calc.daysLeft)}일 지남`}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="text-[12px] font-semibold text-ink-faint">대항력 발생</p>
          <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">
            {fmt(addDays(calc.base, 1))} 0시
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">전입신고를 잔금일에 마쳤을 때</p>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {calc.rows.map((row) => {
          const passed = row.date.getTime() < calc.today.getTime();
          const isToday = row.date.getTime() === calc.today.getTime();
          return (
            <li
              key={`${row.offset}-${row.title}`}
              className={
                "rounded-xl border p-3 " +
                (isToday ? "border-brand/45 bg-brand-soft/40" : passed ? "border-line bg-paper-deep/60" : "border-line bg-white")
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-ink">
                  {row.offset === 0 ? "D-DAY" : row.offset > 0 ? `D+${row.offset}` : `D${row.offset}`} · {row.title}
                </p>
                <p className="mono text-[11.5px] text-ink-faint">{fmt(row.date)}</p>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{row.body}</p>
              {row.legal && (
                <p className="mt-1.5 border-l-2 border-jade/50 pl-2 text-[11.5px] leading-relaxed text-jade">
                  {row.legal}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl border border-line bg-white p-3.5">
        <p className="text-[12.5px] font-bold text-ink">이사 당일 정산 체크</p>
        <ul className="mt-2 space-y-1">
          {CHECKS.map((c) => (
            <li key={c}>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[12.5px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={Boolean(checked[c])}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [c]: e.target.checked }))}
                  className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span className={checked[c] ? "line-through opacity-60" : ""}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <Line label="대항력" value="인도 + 전입신고 → 다음 날 0시" />
        <Line label="우선변제권" value="전입신고 + 확정일자" />
        <Line label="전입신고 기한" value="전입한 날부터 14일 이내" />
        <Line label="확정일자" value="주민센터·인터넷등기소" strong />
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <UtilShell
      id="moving-dday"
      title="전입·확정일자 이사 D-Day"
      subtitle="잔금일을 기준으로 전입신고 14일 기한과 대항력·우선변제권 시점을 역산합니다."
      note={
        <>
          체크 상태는 <strong className="font-semibold text-ink">이 브라우저 메모리에만</strong> 있고 저장하지 않습니다.
          새로 고치면 초기화됩니다.
        </>
      }
    >
      {content}
    </UtilShell>
  );
}
