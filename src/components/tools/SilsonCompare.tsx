import { useMemo, useState } from "react";
import {
  compare,
  comparisonRows,
  comparisonSummary,
  generationFromDate,
  HOSPITALS,
  NON_LABELS,
  PROFILES,
  type HospitalId,
  type ProfileId,
  type Variant23,
  type CoveredKind,
  type Severity,
} from "@/lib/silson/engine";
import { Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "./ui";

/**
 * 세대별 실손 계산기 (1~5세대 · 유병력자)
 *
 * 계산은 전부 `src/lib/silson/engine.js` 가 한다. 이 파일은 입력·표시·인쇄만 맡는다.
 * InsureCRM 은 같은 엔진을 `silson-core.js`(window.Silson)로 받아 쓴다 — 두 앱의 숫자가 갈라지면 안 된다.
 */

const PROFILE_OPTIONS = PROFILES.map((p) => ({ value: p.id as ProfileId, label: p.short }));

/** 금액 입력 — 정확한 금액은 타이핑, 빠른 조정은 슬라이더 */
function AmountField({
  label,
  hint,
  value,
  onChange,
  max,
  step = 1000,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  step?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const percent = Math.min(100, (value / max) * 100);
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-semibold text-ink" htmlFor={`amt-${label}`}>
          {label}
        </label>
        <input
          id={`amt-${label}`}
          inputMode="numeric"
          value={text ?? (value ? value.toLocaleString("ko-KR") : "")}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            setText(digits ? Number(digits).toLocaleString("ko-KR") : "");
            onChange(Math.min(max, Number(digits || 0)));
          }}
          onBlur={() => setText(null)}
          placeholder="0"
          className="w-[128px] rounded-lg border border-line bg-white px-2.5 py-1.5 text-right text-[13px] tabular-nums text-ink focus:border-brand focus:outline-none"
          aria-describedby={hint ? `hint-${label}` : undefined}
        />
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range mt-2"
        style={{ "--pct": `${percent}%` } as React.CSSProperties}
        aria-label={`${label} 슬라이더`}
      />
      {hint && (
        <p id={`hint-${label}`} className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

function rowTone(diff: number) {
  if (diff > 0) return "text-jade";
  if (diff < 0) return "text-[#a8455c]";
  return "text-ink-faint";
}

/** A4 인쇄용 HTML — 새 창에서 인쇄한다(사이트 전체 인쇄 CSS를 건드리지 않는다) */
function buildPrintHTML(result: ReturnType<typeof compare>, baseDate: string) {
  const p = result.primary;
  const i = result.input;
  const rows = comparisonRows(result);
  const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const nonLines = Object.entries(i.non)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<tr><td>${esc(NON_LABELS[k as keyof typeof NON_LABELS])}</td><td class="r">${won(v)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>세대별 실손 계산 요약</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif; color: #0b1b29; font-size: 12px; line-height: 1.55; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.02em; }
  .sub { color: #55626e; font-size: 11px; margin-bottom: 14px; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #dde3e8; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eaefF2; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f2f0e8; font-weight: 700; font-size: 11px; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  .hero { display: flex; gap: 10px; margin: 8px 0 2px; }
  .hero div { flex: 1; border: 1px solid #dde3e8; border-radius: 8px; padding: 8px 10px; }
  .hero span { display: block; color: #55626e; font-size: 10.5px; }
  .hero b { font-size: 16px; letter-spacing: -0.02em; }
  .reason { color: #3f4b57; font-size: 10.5px; }
  .foot { margin-top: 18px; border-top: 1px solid #dde3e8; padding-top: 8px; color: #55626e; font-size: 10px; line-height: 1.5; }
  .nowrap { white-space: nowrap; }
</style></head><body>
<h1>세대별 실손 계산 요약</h1>
<div class="sub">기준일 ${esc(baseDate)} · buffetkimz.com · 진료 1건 기준 모의계산</div>

<div class="hero">
  <div><span>병원비</span><b>${won(result.total)}</b></div>
  <div><span>${esc(p.label)} 본인부담</span><b>${won(p.self)}</b></div>
  <div><span>${esc(p.label)} 예상 보험금</span><b>${won(p.payout)}</b></div>
</div>

<h2>진료 조건</h2>
<table>
  <tr><th>진료 구분</th><td>${i.visit === "inpatient" ? "입원" : "통원"}</td><th>의료기관</th><td>${esc(HOSPITALS[i.hospital].label)}</td></tr>
  <tr><th>급여 본인부담금</th><td>${won(i.coveredAmount)} (${i.coveredKind === "full" ? "전액본인부담" : "일부본인부담"})</td><th>비급여 구분</th><td>${i.severity === "severe" ? "중증" : "비중증"}</td></tr>
</table>
${nonLines ? `<h2>비급여</h2><table><tr><th>항목</th><th class="r">금액</th></tr>${nonLines}</table>` : ""}

<h2>내 세대 항목별 계산</h2>
<table>
  <thead><tr><th>항목</th><th class="r">보장대상</th><th class="r">공제</th><th class="r">보험금</th></tr></thead>
  <tbody>
  ${p.items
    .map(
      (it) =>
        `<tr><td>${esc(it.label)}<div class="reason">${esc(it.reason)}</div></td><td class="r">${won(it.base)}</td><td class="r">${won(
          it.deductible
        )}</td><td class="r">${won(it.payout)}</td></tr>`
    )
    .join("")}
  </tbody>
</table>

<h2>세대별 비교</h2>
<table>
  <thead><tr><th>세대</th><th class="r">예상 보험금</th><th class="r">본인부담</th><th class="r">보장률</th></tr></thead>
  <tbody>
  ${rows
    .map(
      (r) =>
        `<tr><td class="nowrap">${esc(r.label)}${r.primary ? " (내 세대)" : ""}</td><td class="r">${won(r.payout)}</td><td class="r">${won(
          r.self
        )}</td><td class="r">${(r.payoutRate * 100).toFixed(1)}%</td></tr>`
    )
    .join("")}
  </tbody>
</table>
<p class="reason">${esc(comparisonSummary(result))}</p>

<div class="foot">
  기준: 금융위원회 2026-05-06 보도자료(5세대), 2021-06-29 보도자료(4세대), 2018-01-16 보도자료(유병력자), 금융감독원 2026-06-03 세대별 표, 보험업감독업무시행세칙 [별표 15] 실손의료보험 표준약관.<br>
  진료 1건만 계산하며 연간 누적 한도(비급여 5천만·1천만원, 통원 100회)와 보험료는 반영하지 않습니다. 1~3세대는 상품형·가입시기별 약관 차이가 커 대표 구조로 계산했습니다. 실제 지급은 가입 약관·증권과 보험사 심사에 따릅니다.
</div>
</body></html>`;
}

export default function SilsonCompare({ compact = false }: { compact?: boolean }) {
  const [visit, setVisit] = useState<"outpatient" | "inpatient">("outpatient");
  const [hospital, setHospital] = useState<HospitalId>("general");
  const [coveredKind, setCoveredKind] = useState<CoveredKind>("partial");
  const [severity, setSeverity] = useState<Severity>("mild");
  const [primary, setPrimary] = useState<ProfileId>("gen4");
  const [variant23, setVariant23] = useState<Variant23>("standard");
  const [covered, setCovered] = useState(200000);
  const [non, setNon] = useState({ general: 300000, physical: 100000, injection: 0, mri: 0 });
  const [birthDate, setBirthDate] = useState("");

  const input = { visit, hospital, coveredKind, severity, variant23, coveredAmount: covered, non, primary };
  const result = useMemo(() => compare(input), [visit, hospital, coveredKind, severity, variant23, covered, non, primary]);
  const rows = comparisonRows(result);
  const p = result.primary;
  const guess = generationFromDate(birthDate);

  const setNonKey = (k: keyof typeof non, v: number) => setNon((s) => ({ ...s, [k]: v }));

  const printSheet = () => {
    const html = buildPrintHTML(result, new Date().toLocaleDateString("ko-KR"));
    const w = window.open("", "_blank", "width=920,height=1200");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  /** 요약 카드 PNG — 1080×1350. 브랜드 색만 쓰고, 숫자는 엔진 결과 그대로 */
  const saveCard = async () => {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* 글꼴 준비를 못 기다려도 기본 글꼴로 그린다 */
    }
    const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif';
    const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
    ctx.fillStyle = "#faf9f6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0b1b29";
    ctx.fillRect(0, 0, W, 12);

    ctx.fillStyle = "#55626e";
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText("세대별 실손 계산", 72, 104);

    ctx.fillStyle = "#0b1b29";
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText(`${visit === "inpatient" ? "입원" : "통원"} · ${HOSPITALS[hospital].label}`, 72, 176);

    ctx.font = `500 30px ${FONT}`;
    ctx.fillStyle = "#3f4b57";
    ctx.fillText(`병원비 ${won(result.total)}`, 72, 226);

    // 내 세대 결과
    ctx.fillStyle = "#1233b8";
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${p.label} 예상 보험금`, 72, 320);
    ctx.fillStyle = "#0b1b29";
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText(won(p.payout), 72, 420);
    ctx.fillStyle = "#3f4b57";
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`본인부담 ${won(p.self)} · 보장률 ${(p.payoutRate * 100).toFixed(1)}%`, 72, 470);

    // 세대별 막대
    const max = Math.max(...rows.map((r) => r.payout), 1);
    let y = 560;
    ctx.font = `500 26px ${FONT}`;
    for (const r of rows) {
      ctx.fillStyle = "#55626e";
      ctx.fillText(r.label + (r.primary ? " · 내 세대" : ""), 72, y);
      const barX = 420;
      const barW = 420;
      ctx.fillStyle = "#eaefF2";
      ctx.fillRect(barX, y - 22, barW, 24);
      ctx.fillStyle = r.primary ? "#1a4ffd" : "#243b53";
      ctx.fillRect(barX, y - 22, Math.max(2, (r.payout / max) * barW), 24);
      ctx.fillStyle = "#0b1b29";
      ctx.textAlign = "right";
      ctx.fillText(won(r.payout), W - 72, y);
      ctx.textAlign = "left";
      y += 66;
    }

    // 각주
    ctx.fillStyle = "#55626e";
    ctx.font = `400 22px ${FONT}`;
    const notes = [
      "진료 1건 기준 모의계산입니다. 연간 누적 한도와 보험료는 반영하지 않았습니다.",
      "1~3세대는 상품형·가입시기별 약관 차이가 커 대표 구조로 계산했습니다.",
      "실제 지급은 가입 약관·증권과 보험사 심사에 따릅니다.",
      `기준일 ${new Date().toLocaleDateString("ko-KR")} · buffetkimz.com`,
    ];
    let ny = 1120;
    for (const line of notes) {
      ctx.fillText(line, 72, ny);
      ny += 36;
    }
    ctx.strokeStyle = "#dde3e8";
    ctx.beginPath();
    ctx.moveTo(72, 1080);
    ctx.lineTo(W - 72, 1080);
    ctx.stroke();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `실손계산_${visit === "inpatient" ? "입원" : "통원"}_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  };

  return (
    <RunnerShell
      title="세대별 실손 계산기"
      subtitle="1세대부터 5세대·유병력자까지. 병원비를 넣으면 내 세대의 예상 보험금과 다른 세대의 금액을 나란히 보여 줍니다."
      example="금액을 고치면 결과가 바로 바뀝니다. 진료 1건 기준이고, 새로 고치면 예시값으로 돌아갑니다."
    >
      <div className="grid gap-x-8 md:grid-cols-2">
        <Segmented
          label="진료 구분"
          value={visit}
          onChange={(v) => setVisit(v)}
          options={[
            { value: "outpatient", label: "통원" },
            { value: "inpatient", label: "입원" },
          ]}
        />
        <Segmented
          label="의료기관"
          value={hospital}
          onChange={(v) => setHospital(v)}
          options={[
            { value: "clinic", label: "의원" },
            { value: "hospital", label: "병원" },
            { value: "general", label: "종합병원" },
            { value: "tertiary", label: "상급종합" },
          ]}
          hint={
            visit === "outpatient"
              ? `5세대 급여 통원은 건강보험 본인부담률(${Math.round(HOSPITALS[hospital].ghRate * 100)}%)과 연동합니다.`
              : undefined
          }
        />
      </div>

      <div className="mt-1 grid gap-x-8 border-t border-line-soft pt-2 md:grid-cols-2">
        <div>
          <Segmented
            label="급여 구분"
            value={coveredKind}
            onChange={(v) => setCoveredKind(v)}
            options={[
              { value: "partial", label: "일부본인부담" },
              { value: "full", label: "전액본인부담" },
            ]}
            hint="전액본인부담 통원은 4세대부터 보상 대상에서 빠집니다."
          />
          <AmountField
            label="급여 본인부담금"
            value={covered}
            onChange={setCovered}
            max={visit === "inpatient" ? 30000000 : 1000000}
            step={10000}
            hint="영수증의 급여 본인부담금(공단부담금 제외) 금액입니다."
          />
        </div>
        <div>
          <Segmented
            label="비급여 구분"
            value={severity}
            onChange={(v) => setSeverity(v)}
            options={[
              { value: "mild", label: "비중증" },
              { value: "severe", label: "중증(산정특례)" },
            ]}
            hint="암·뇌혈관·심장·희귀난치 질환 치료비는 중증입니다. 5세대에서 특약1·특약2를 가릅니다."
          />
          <AmountField label={NON_LABELS.general} value={non.general} onChange={(v) => setNonKey("general", v)} max={visit === "inpatient" ? 30000000 : 2000000} step={10000} />
        </div>
      </div>

      <details className="mt-1 rounded-xl border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-ink">
          3대 비급여 — 도수·체외충격파·증식 / 비급여 주사 / MRI·MRA
        </summary>
        <div className="grid gap-x-8 border-t border-line-soft px-4 pb-2 md:grid-cols-2">
          <AmountField label={NON_LABELS.physical} value={non.physical} onChange={(v) => setNonKey("physical", v)} max={5000000} step={10000} />
          <AmountField label={NON_LABELS.injection} value={non.injection} onChange={(v) => setNonKey("injection", v)} max={5000000} step={10000} />
          <AmountField label={NON_LABELS.mri} value={non.mri} onChange={(v) => setNonKey("mri", v)} max={5000000} step={10000} />
          <p className="py-2 text-[12px] leading-relaxed text-ink-faint md:py-4">
            3세대부터는 이 세 항목을 특약으로 따로 봅니다. 5세대 비중증에서는 도수·체외충격파·주사가 보장 대상에서 빠집니다.
          </p>
        </div>
      </details>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[13px] font-semibold text-ink">내 실손 세대</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PROFILE_OPTIONS.map((o) => {
            const active = o.value === primary;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setPrimary(o.value)}
                className={
                  "min-h-[44px] rounded-lg border px-2 text-[12.5px] font-semibold transition-colors " +
                  (active
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {(primary === "gen2" || primary === "gen3") && (
          <div className="mt-3">
            <Segmented
              label="2·3세대 상품형"
              value={variant23}
              onChange={(v) => setVariant23(v)}
              options={[
                { value: "standard", label: "표준형(20%)" },
                { value: "selective", label: "선택형(급여 10%)" },
              ]}
              hint="선택형은 자기부담률이 낮은 대신 보험료가 높습니다. 이 선택은 2·3세대 비교 줄에 함께 적용됩니다."
            />
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-ink-muted" htmlFor="gen-date">
            가입일로 찾기
          </label>
          <input
            id="gen-date"
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value);
              const g = generationFromDate(e.target.value);
              if (g?.id === "gen1") setPrimary("gen1d");
              else if (g) setPrimary(g.id as ProfileId);
            }}
            className="min-h-[40px] rounded-lg border border-line bg-white px-2 text-[12.5px] text-ink focus:border-brand focus:outline-none"
          />
          <span className="text-[12px] leading-relaxed text-ink-faint">
            {guess ? `${guess.label} · ${guess.note}` : "증권의 최초 가입일을 넣으면 세대를 표시합니다."}
          </span>
        </div>
        {guess?.id === "gen1" && (
          <p className="mt-1 text-[12px] text-ink-muted">
            위에서 <strong className="font-semibold">1세대 손보</strong>(자기부담 0%)와 <strong className="font-semibold">1세대 생보</strong>(20%) 중 가입한 회사를 골라 주세요.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <ResultStat label="병원비 합계" value={formatKrw(result.total)} sub={`${visit === "inpatient" ? "입원" : "통원"} · ${HOSPITALS[hospital].label}`} />
        <ResultStat label={`${p.label} 본인부담`} value={formatKrw(p.self)} sub={`보장률 ${(p.payoutRate * 100).toFixed(1)}%`} />
        <ResultStat label={`${p.label} 예상 보험금`} value={formatKrw(p.payout)} tone="brand" sub={`보장대상 ${formatKrw(p.base)}`} />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">세대별 예상 보험금 비교</caption>
          <thead>
            <tr className="border-b border-line bg-paper-deep text-left">
              <th scope="col" className="px-2.5 py-2.5 font-semibold text-ink-soft sm:px-3">
                세대
              </th>
              <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">
                보험금
              </th>
              <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink-soft sm:px-3">
                본인부담
              </th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-semibold text-ink-soft sm:table-cell">
                내 세대 대비
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={"border-b border-line-soft last:border-0 " + (r.primary ? "bg-[#f4f8fb]" : "")}>
                <th scope="row" className="px-2.5 py-2.5 text-left font-semibold text-ink sm:px-3">
                  <span className="whitespace-nowrap">{r.label}</span>
                  {r.primary && <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-deep">내 세대</span>}
                </th>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-ink sm:px-3">{formatKrw(r.payout)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted sm:px-3">{formatKrw(r.self)}</td>
                <td className={"hidden px-3 py-2.5 text-right font-semibold tabular-nums sm:table-cell " + rowTone(r.diff)}>
                  {r.diff === 0 ? "—" : `${r.diff > 0 ? "+" : "−"}${formatKrw(Math.abs(r.diff))}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{comparisonSummary(result)}</p>

      <div className="mt-4 rounded-xl border border-line bg-white">
        <div className="border-b border-line-soft px-4 py-3">
          <p className="text-[12px] font-bold tracking-[0.02em] text-ink-faint">왜 이 금액인가 — {p.label}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            항목마다 보장대상에서 공제한 금액과 이유를 적었습니다. 금액을 바꾸면 함께 바뀝니다.
          </p>
        </div>
        <ul className="divide-y divide-line-soft">
          {p.items.map((it) => (
            <li key={it.key} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold text-ink">{it.label}</span>
                <span className="text-[13px] font-bold tabular-nums text-brand">{formatKrw(it.payout)}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{it.reason}</p>
              <p className="mt-1 text-[12px] tabular-nums text-ink-faint">
                보장대상 {formatKrw(it.base)} · 공제 {formatKrw(it.deductible)}
              </p>
            </li>
          ))}
          {!p.items.length && <li className="px-4 py-4 text-[12.5px] text-ink-muted">금액을 넣으면 항목별 계산이 나타납니다.</li>}
        </ul>
      </div>

      {p.notes.length > 0 && (
        <Note>
          {p.notes.map((n, i) => (
            <span key={i} className="block">
              {n}
            </span>
          ))}
        </Note>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={printSheet}
          className="min-h-[44px] rounded-full bg-brand px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          A4 요약 인쇄
        </button>
        <button
          type="button"
          onClick={saveCard}
          className="min-h-[44px] rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
        >
          요약 카드 저장(PNG)
        </button>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.02em] text-ink-faint">세대별 구조 한눈에</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
            <li>· 1세대(2009년 9월 이전) — 손해보험사 자기부담 0%, 생명보험사 20%. 급여와 비급여를 합쳐 계산합니다.</li>
            <li>· 2세대(2009년 10월~2017년 3월) — 표준형 20%·선택형 10%, 통원은 병원별 최소 공제와 비교합니다.</li>
            <li>· 3세대(2017년 4월~2021년 6월) — 도수·주사·MRI를 특약(30%)으로 떼고 한도를 두었습니다.</li>
            <li>· 4세대(2021년 7월~2026년 5월 5일) — 급여 20%·비급여 30%, 급여 통원과 비급여 통원 한도가 각각 20만원입니다.</li>
            <li>· 5세대(2026년 5월 6일 이후) — 중증 비급여 30%·비중증 50%, 비중증 통원은 50%와 5만원 중 큰 금액을 뺍니다.</li>
            <li>· 유병력자 실손(2018년 4월 이후) — 입원 30%·최소 10만원, 통원 30%·최소 2만원, 3대 비급여는 보장하지 않습니다.</li>
          </ul>
        </div>
      )}

      <StickySummary
        items={[
          { label: `${p.label} 보험금`, value: formatKrw(p.payout) },
          { label: "본인부담", value: formatKrw(p.self) },
        ]}
      />
    </RunnerShell>
  );
}
