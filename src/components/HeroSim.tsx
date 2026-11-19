import { useId, useState, type CSSProperties } from "react";
import { site, withBase } from "@/config/site";
import {
  PENSION_MAX_CREDIT,
  PENSION_RULE,
  RETIREMENT_EXAMPLE,
  manLabel,
  pctLabel,
  retirementProjection,
} from "@/lib/finance";

/**
 * 첫 화면의 '작동하는' 증거 창.
 *
 * 실행 화면(/apps/retirement-flow/run)과 같은 계산(lib/finance.ts)을 그대로 쓰고,
 * 히어로 안에서 은퇴 나이와 개인연금 월 납입액만 움직여 볼 수 있게 했다.
 * 입력값은 브라우저 메모리에서만 계산되고 어디로도 전송되지 않는다.
 */
export default function HeroSim() {
  const [retireAge, setRetireAge] = useState(RETIREMENT_EXAMPLE.retireAge);
  const [monthly, setMonthly] = useState(RETIREMENT_EXAMPLE.personalMonthly);
  const ageId = useId();
  const monthlyId = useId();

  const input = { ...RETIREMENT_EXAMPLE, retireAge, personalMonthly: monthly };
  const r = retirementProjection(input);

  const rows = [
    { key: "nps", name: "국민연금", value: r.nominal.nps, real: r.real.nps },
    { key: "dc", name: "퇴직연금", value: r.nominal.dc, real: r.real.dc },
    { key: "personal", name: "개인연금", value: r.nominal.personal, real: r.real.personal },
  ];
  const maxBar = Math.max(...rows.map((row) => row.value), 1);
  const pct = (v: number) => Math.max(3, Math.min(100, Math.round((v / maxBar) * 100)));
  const creditLabel = `${PENSION_MAX_CREDIT.toLocaleString("ko-KR")}원`;
  const gapLabel = `${r.gap >= 0 ? "＋" : "−"}${manLabel(Math.abs(r.gap))}`;

  const fill = (value: number, min: number, max: number) => ((value - min) / (max - min)) * 100;

  return (
    <div className="sim hero-card" data-hero-sim>
      <div className="sim-bar">
        <span className="sim-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span className="sim-url">buffetkimz.com/apps/retirement-flow</span>
        <span className="chip !min-h-0 !border-sky-deep/25 !bg-sky !px-2 !py-0.5 !text-[12px] !text-brand-deep">
          가상 예시
        </span>
      </div>

      <div className="sim-body p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono text-[12px] tracking-[0.06em] text-brand">TOOL · 은퇴 시뮬레이터</p>
            <p className="mt-1 text-[16px] font-bold leading-snug tracking-[-0.02em] text-ink">은퇴 월 현금흐름</p>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-muted">
              {RETIREMENT_EXAMPLE.currentAge}세 → {retireAge}세 은퇴 · {r.payoutYears}년 수령 가정
            </p>
          </div>
          <span className="chip shrink-0 !min-h-[26px] !border-brand/20 !bg-brand-soft !px-2 !text-[12px] !text-brand-deep">
            조작해 보세요
          </span>
        </div>

        <p
          className="mt-2.5 rounded-lg bg-sky-soft px-2.5 py-2 text-[12.5px] font-semibold leading-[1.55] text-ink-soft"
          data-hero-verdict
        >
          예시 가정 기준 월 {manLabel(r.nominal.total)} · 오늘 가치 {manLabel(r.real.total)} — 목표{" "}
          {manLabel(r.targetMonthly)}과 {gapLabel} 차이
        </p>

        <ul className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[54px_1fr_auto] items-center gap-2.5" data-hero-row={row.key}>
              <span className="text-[12px] text-ink-muted">{row.name}</span>
              <span className="mini-track !h-[6px]">
                <i style={{ width: `${pct(row.value)}%` }} />
              </span>
              <span className="mono whitespace-nowrap text-[12px] text-ink">
                {Math.round(row.value).toLocaleString("ko-KR")}만
                <span className="ml-1 text-ink-faint">/ {Math.round(row.real).toLocaleString("ko-KR")}만</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mono mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
          <span>합계 <strong className="font-semibold text-ink">{manLabel(r.nominal.total)}</strong>/월</span>
          <span className="text-ink-faint">· 오늘 가치 <strong className="font-semibold text-ink">{manLabel(r.real.total)}</strong></span>
        </p>
      </div>

      <div className="sim-foot px-4 pb-4 pt-3 md:px-5">
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ageId} className="text-[12px] font-semibold text-ink">
                은퇴 나이 <span className="font-normal text-ink-faint">55–70세</span>
              </label>
              <output htmlFor={ageId} className="mono text-[12px] font-bold text-brand">{retireAge}세</output>
            </div>
            <input
              id={ageId}
              type="range"
              min={55}
              max={70}
              step={1}
              value={retireAge}
              onChange={(e) => setRetireAge(Number(e.target.value))}
              className="range"
              style={{ "--pct": `${fill(retireAge, 55, 70)}%` } as CSSProperties}
              aria-label="은퇴 나이"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={monthlyId} className="text-[12px] font-semibold text-ink">
                개인연금 월 납입 <span className="font-normal text-ink-faint">0–100만원</span>
              </label>
              <output htmlFor={monthlyId} className="mono text-[12px] font-bold text-brand">{monthly}만원</output>
            </div>
            <input
              id={monthlyId}
              type="range"
              min={0}
              max={100}
              step={5}
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
              className="range"
              style={{ "--pct": `${fill(monthly, 0, 100)}%` } as CSSProperties}
              aria-label="개인연금 월 납입액"
            />
          </div>
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
          <span className="font-semibold text-brand-deep">세액공제</span>
          <span>연 {PENSION_RULE.totalLimit}만원 × {pctLabel(PENSION_RULE.rateLow)} = <strong className="font-semibold text-ink">{creditLabel}</strong></span>
          <span className="text-ink-faint">(총급여 5,500만 이하 · 지방소득세 포함)</span>
        </p>
        <p className="mt-1 text-[12px] leading-[1.55] text-ink-faint">
          예시 입력값(가상) · 오늘 가치 환산은 물가 2.5% 가정 · 기준일 {site.baseDate}
        </p>
        <a href={withBase("/apps/retirement-flow/run")} className="btn btn-primary btn-sm mt-3 w-full">
          시뮬레이터 열기
        </a>
      </div>
    </div>
  );
}
