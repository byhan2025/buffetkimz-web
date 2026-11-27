import { useMemo, useRef, useState } from "react";
import { RECEIPT_SAMPLES, parseReceiptLines, type ReceiptParse } from "@/lib/silson/receiptParser";
import {
  buildMessage,
  capNotice,
  compare,
  comparisonRows,
  comparisonSummary,
  generationFromDate,
  GEN1_CAPS,
  GEN23_CAPS,
  HOSPITALS,
  NON_LABELS,
  PROFILES,
  RULE_SOURCE,
  RULE_TABLE,
  VISIT_CAPS,
  type HospitalId,
  type ProfileId,
  type Variant23,
} from "@/lib/silson/engine";
import { Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "./ui";

/**
 * 세대별 실손 계산기 (1~5세대 · 유병력자)
 *
 * 계산은 전부 `src/lib/silson/engine.js` 가 한다. 이 파일은 입력·표시·인쇄만 맡는다.
 * InsureCRM 은 같은 엔진을 `silson-core.js`(window.Silson)로 받아 쓴다 — 두 앱의 숫자가 갈라지면 안 된다.
 *
 * 입력은 영수증 그대로 받는다 — 급여 일부본인부담 / 급여 전액본인부담 / 처방조제 / 일반 비급여 /
 * 3대 비급여 / 상급병실료 차액. 공제와 한도 삭감을 나눠 보여 주는 이유는, 통원 회당 한도에 걸린
 * 금액까지 '본인부담'으로 뭉뚱그리면 자기부담률이 50%처럼 보여 계산 오류로 오해되기 때문이다.
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
  const id = `amt-${label.replace(/[\s·()]/g, "-")}`;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-semibold text-ink" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
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
          aria-describedby={hint ? `${id}-hint` : undefined}
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
        <p id={`${id}-hint`} className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">
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

/** 항목이 어느 계약(주계약·특약)에서 나오는지 — '표준형·특약 분리' 표시 */
function itemTag(key: string, era: number): string {
  if (key === "room") return "비급여 · 병실료";
  if (key === "covered" || key === "coveredFull") return "주계약 · 급여";
  if (key === "prescription") return "급여 · 처방조제";
  if (key === "nonGeneral") return era >= 4 ? "비급여 특약" : "비급여";
  if (key === "physical" || key === "injection" || key === "mri") return era >= 3 ? "3대 비급여 특약" : "비급여";
  return "비급여";
}

/**
 * 영수증 인식 결과 요약 배너.
 * 값마다 **원문 줄**을 펼쳐 볼 수 있게 한다 — OCR이 숫자를 잘못 읽었는지 사용자가 직접 판단해야 한다.
 */
function ReceiptBanner({ result, onClose }: { result: ReceiptParse; onClose: () => void }) {
  const confTone = (c: number) =>
    c >= 0.9 ? { text: "정확", cls: "bg-[#eaf5ee] text-[#1f7a62]" } : c >= 0.75 ? { text: "보통", cls: "bg-[#fdf8ee] text-[#7a5b1f]" } : { text: "확인 필요", cls: "bg-[#fbeef1] text-[#a8455c]" };
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-brand/25 bg-[#f7fafc]" role="status" aria-live="polite" data-receipt-ocr="result">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-brand/15 px-3.5 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-brand-deep">인식한 내용으로 칸을 채웠습니다</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{result.summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] shrink-0 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-muted hover:border-brand/40 hover:text-brand"
        >
          닫기
        </button>
      </div>

      {result.warnings.length > 0 && (
        <ul className="border-b border-brand/15 bg-[#fdf8ee] px-3.5 py-2 sm:px-4">
          {result.warnings.map((w) => (
            <li key={w.code} className="text-[12px] leading-relaxed text-[#7a5b1f]">
              ⚠ {w.text}
            </li>
          ))}
        </ul>
      )}

      <details className="px-3.5 py-2 sm:px-4">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">
          항목 {result.items.length}개 · 원문 근거 보기
        </summary>
        <ul className="mt-2 space-y-1.5">
          {result.items.map((it) => (
            <li key={it.key} className="rounded-lg bg-white px-2.5 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-[12px] font-semibold text-ink">{it.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${confTone(it.confidence).cls}`}>{confTone(it.confidence).text}</span>
                  <span className="text-[12.5px] font-bold tabular-nums text-brand-deep">{it.value.toLocaleString("ko-KR")}원</span>
                </span>
              </div>
              {it.evidence && (
                <p className="mt-1 overflow-x-auto whitespace-nowrap text-[11px] tabular-nums text-ink-faint" title={it.evidence}>
                  원문: {it.evidence}
                </p>
              )}
              {it.note && <p className="mt-0.5 text-[11px] text-ink-faint">{it.note}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          숫자가 틀렸으면 위 입력칸에서 직접 고치세요. 고친 값으로 계산이 바로 다시 됩니다.
        </p>
      </details>
    </div>
  );
}

/** A4 인쇄용 HTML — 새 창에서 인쇄한다(사이트 전체 인쇄 CSS를 건드리지 않는다) */
function buildPrintHTML(result: ReturnType<typeof compare>, baseDate: string, name: string) {
  const p = result.primary;
  const i = result.input;
  const rows = comparisonRows(result);
  const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const nonLines = Object.entries(i.non)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<tr><td>${esc(NON_LABELS[k as keyof typeof NON_LABELS])}</td><td class="r">${won(v)}</td></tr>`)
    .join("");
  const notice = capNotice(result);
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
  .notice { margin: 8px 0 0; border: 1px solid #e6d9c2; background: #fdf8ee; border-radius: 6px; padding: 6px 8px; font-size: 10.5px; color: #7a5b1f; }
  .foot { margin-top: 18px; border-top: 1px solid #dde3e8; padding-top: 8px; color: #55626e; font-size: 10px; line-height: 1.5; }
  .nowrap { white-space: nowrap; }
</style></head><body>
<h1>세대별 실손 계산 요약</h1>
<div class="sub">${name ? `${esc(name)}님 · ` : ""}기준일 ${esc(baseDate)} · buffetkimz.com · 진료 1건 기준 모의계산</div>

<div class="hero">
  <div><span>병원비</span><b>${won(result.total)}</b></div>
  <div><span>${esc(p.label)} 공제</span><b>${won(p.deductible)}</b></div>
  <div><span>한도 삭감</span><b>${won(p.capped)}</b></div>
  <div><span>${esc(p.label)} 예상 보험금</span><b>${won(p.payout)}</b></div>
</div>
${notice ? `<p class="notice">${esc(notice.text)}</p>` : ""}

<h2>진료 조건</h2>
<table>
  <tr><th>진료 구분</th><td>${i.visit === "inpatient" ? "입원" : "통원"}</td><th>의료기관</th><td>${esc(HOSPITALS[i.hospital].label)}</td></tr>
  <tr><th>급여 일부본인부담</th><td>${won(i.coveredPartial)}</td><th>급여 전액본인부담</th><td>${won(i.coveredFull)}</td></tr>
  <tr><th>처방조제비</th><td>${won(i.prescription)}</td><th>비급여 구분</th><td>${i.severity === "severe" ? "중증(특약1)" : "비중증(특약2)"}</td></tr>
  <tr><th>통원 회당 한도</th><td>${won(i.visitCap)} (가입금액)</td><th>상급병실료 차액</th><td>${won(i.room)}${i.room ? ` · ${i.roomDays || 1}일` : ""}</td></tr>
</table>
${nonLines ? `<h2>비급여</h2><table><tr><th>항목</th><th class="r">금액</th></tr>${nonLines}</table>` : ""}

<h2>내 세대 항목별 계산</h2>
<table>
  <thead><tr><th>항목</th><th class="r">보장대상</th><th class="r">공제</th><th class="r">한도 삭감</th><th class="r">보험금</th></tr></thead>
  <tbody>
  ${p.items
    .map(
      (it) =>
        `<tr><td>${esc(it.label)}<div class="reason">${esc(it.reason)}</div></td><td class="r">${won(it.base)}</td><td class="r">${won(
          it.deductible
        )}</td><td class="r">${won(it.capped)}</td><td class="r">${won(it.payout)}</td></tr>`
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

<h2>세대별 규칙</h2>
<table>
  <thead><tr><th>세대</th><th>입원</th><th>통원</th><th>3대 비급여</th></tr></thead>
  <tbody>
  ${RULE_TABLE.map((r) => `<tr><td class="nowrap">${esc(r.label)}</td><td>${esc(r.inpatient)}</td><td>${esc(r.outpatient)}</td><td>${esc(r.big3)}</td></tr>`).join("")}
  </tbody>
</table>

<div class="foot">
  기준: ${esc(RULE_SOURCE)}.<br>
  진료 1건만 계산하며 연간 누적 한도와 보험료는 반영하지 않습니다. 1~3세대는 상품형·가입시기별 약관 차이가 커 대표 구조로 계산했고, 가정한 값은 화면에 적었습니다. 실제 지급은 가입 약관·증권과 보험사 심사에 따릅니다.
</div>
</body></html>`;
}

export default function SilsonCompare({ compact = false }: { compact?: boolean }) {
  const [visit, setVisit] = useState<"outpatient" | "inpatient">("outpatient");
  const [hospital, setHospital] = useState<HospitalId>("general");
  const [severity, setSeverity] = useState<"mild" | "severe">("mild");
  const [primary, setPrimary] = useState<ProfileId>("gen4");
  const [variant23, setVariant23] = useState<Variant23>("standard");
  const [gen2Early, setGen2Early] = useState(false);
  const [coveredPartial, setCoveredPartial] = useState(120000);
  const [coveredFull, setCoveredFull] = useState(0);
  const [prescription, setPrescription] = useState(8000);
  const [non, setNon] = useState({ general: 200000, physical: 0, injection: 0, mri: 0 });
  const [room, setRoom] = useState(0);
  const [roomDays, setRoomDays] = useState(1);
  const [coPayment, setCoPayment] = useState(0);
  const [special, setSpecial] = useState(false);
  const [visitCap, setVisitCap] = useState(200000);
  const [gen1Cap, setGen1Cap] = useState(300000);
  const [gen23Cap, setGen23Cap] = useState(300000);
  const [gJoinDate, setJoinDate] = useState("");
  const [customer, setCustomer] = useState("");
  const [copied, setCopied] = useState(false);

  /* 영수증 자동 입력 — 파일은 이 브라우저 안에서만 읽는다 */
  const [receipt, setReceipt] = useState<ReceiptParse | null>(null);
  const [ocr, setOcr] = useState<{ busy: boolean; msg: string; pct: number; error: string; modes: string[] }>({
    busy: false,
    msg: "",
    pct: 0,
    error: "",
    modes: [],
  });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** 인식 결과를 입력칸에 채운다 */
  const applyReceipt = (p: ReceiptParse) => {
    setReceipt(p);
    const f = p.fields;
    if (!f) return;
    setVisit(f.visit);
    setHospital(f.hospital);
    setCoveredPartial(f.coveredPartial);
    setCoveredFull(f.coveredFull);
    setPrescription(f.prescription);
    setNon({ general: f.non.general, physical: f.non.physical, injection: f.non.injection, mri: f.non.mri });
    setRoom(f.room);
    setRoomDays(f.room && f.visit === "inpatient" ? Math.max(1, f.roomDays) : 1);
    setCoPayment(f.coPayment);
  };

  /** 사진·PDF 올리기 → 인식 → 자동 채움 */
  const readFiles = async (files: File[]) => {
    if (!files.length) return;
    setOcr({ busy: true, msg: "파일 확인 중…", pct: 3, error: "", modes: [] });
    setReceipt(null);
    try {
      const { readReceiptFiles } = await import("@/lib/silson/receiptOcr");
      const read = await readReceiptFiles(files, (msg, pct) =>
        setOcr((s) => ({ ...s, busy: true, msg, pct: Math.max(s.pct, Math.round(pct ?? s.pct)) }))
      );
      const parsed = parseReceiptLines(read.lines);
      applyReceipt(parsed);
      setOcr({
        busy: false,
        msg: "",
        pct: 100,
        error: parsed.fields ? "" : parsed.warnings[0]?.text || "영수증에서 금액을 찾지 못했습니다.",
        modes: read.modes,
      });
    } catch (e) {
      setOcr({ busy: false, msg: "", pct: 0, error: (e as Error).message || "파일을 읽지 못했습니다.", modes: [] });
    }
  };

  /** 가상 영수증 체험 — OCR 없이 같은 파서를 그대로 돌린다 */
  const trySample = (id: string) => {
    const s = RECEIPT_SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setOcr({ busy: true, msg: "가상 영수증을 읽는 중…", pct: 40, error: "", modes: [] });
    setTimeout(() => {
      const parsed = parseReceiptLines(s.lines);
      applyReceipt(parsed);
      setOcr({ busy: false, msg: "", pct: 100, error: "", modes: [`가상 영수증 · ${s.name}`] });
    }, 220);
  };

  const input = {
    visit,
    hospital,
    severity,
    special,
    variant23,
    gen2Early,
    coveredPartial,
    coveredFull,
    /* 입원에는 약국 처방조제 건이 없다 — 통원에서 넣어 둔 값이 합계·상세에 남지 않게 0으로 넘긴다 */
    prescription: visit === "inpatient" ? 0 : prescription,
    non,
    room,
    roomDays,
    coPayment,
    visitCap,
    gen1Cap,
    gen23Cap,
    primary,
  };
  const result = useMemo(
    () => compare(input),
    [visit, hospital, severity, special, variant23, gen2Early, coveredPartial, coveredFull, prescription, non, room, roomDays, coPayment, visitCap, gen1Cap, gen23Cap, primary]
  );
  const rows = comparisonRows(result);
  const p = result.primary;
  const notice = capNotice(result);
  const guess = generationFromDate(gJoinDate);
  const era = PROFILES.find((x) => x.id === primary)?.era ?? 4;
  const setNonKey = (k: keyof typeof non, v: number) => setNon((s) => ({ ...s, [k]: v }));

  const printSheet = () => {
    const html = buildPrintHTML(result, new Date().toLocaleDateString("ko-KR"), customer.trim());
    const w = window.open("", "_blank", "width=920,height=1200");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  const copyMsg = () => {
    const text = buildMessage(result, { name: customer.trim() });
    void (navigator.clipboard?.writeText(text) ?? Promise.resolve()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
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
    ctx.fillText(`병원비 ${won(result.total)}${customer.trim() ? ` · ${customer.trim()}님` : ""}`, 72, 226);

    ctx.fillStyle = "#1233b8";
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${p.label} 예상 보험금`, 72, 320);
    ctx.fillStyle = "#0b1b29";
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText(won(p.payout), 72, 420);
    ctx.fillStyle = "#3f4b57";
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`공제 ${won(p.deductible)} · 한도 삭감 ${won(p.capped)} · 보장률 ${(p.payoutRate * 100).toFixed(1)}%`, 72, 470);

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

    ctx.fillStyle = "#55626e";
    ctx.font = `400 22px ${FONT}`;
    const notes = [
      "진료 1건 기준 모의계산입니다. 연간 누적 한도와 보험료는 반영하지 않았습니다.",
      "1~3세대는 상품형·가입시기별 약관 차이가 커 대표 구조로 계산했습니다.",
      "실제 지급은 가입 약관·증권과 보험사 심사에 따릅니다.",
      `기준일 ${new Date().toLocaleDateString("ko-KR")} · buffetkimz.com`,
    ];
    let ny = 1150;
    for (const line of notes) {
      ctx.fillText(line, 72, ny);
      ny += 36;
    }
    ctx.strokeStyle = "#dde3e8";
    ctx.beginPath();
    ctx.moveTo(72, 1110);
    ctx.lineTo(W - 72, 1110);
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
      subtitle="영수증 사진·PDF를 올리면 금액을 읽어 자동으로 채웁니다. 1세대부터 5세대·유병력자까지 내 세대의 예상 보험금과 다른 세대의 금액을 나란히 보여 줍니다."
      example="금액을 고치면 결과가 바로 바뀝니다. 진료 1건 기준이고, 새로 고치면 예시값으로 돌아갑니다."
    >
      <div className="grid gap-x-8 md:grid-cols-2">
        <Segmented
          label="진료 구분"
          value={visit}
          onChange={(v) => setVisit(v)}
          options={[
            { value: "outpatient", label: "통원(외래)" },
            { value: "inpatient", label: "입원" },
          ]}
        />
        <Segmented
          label="병원 등급"
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
              ? `5세대 급여 통원은 건강보험 본인부담률(${Math.round(HOSPITALS[hospital].ghRate * 100)}%)과 연동합니다. 상급종합 진찰료는 급여 일부본인부담금에 넣으세요.`
              : undefined
          }
        />
      </div>

      {/* ⓪ 영수증으로 자동 채우기 — 파일은 이 브라우저 안에서만 읽는다 */}
      <div className="mt-3 rounded-xl border border-line bg-white p-3 sm:p-4" data-receipt-ocr="drop">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[13px] font-bold text-ink">영수증 사진·PDF 올려서 자동 채우기</p>
          <span className="rounded-full bg-[#eaf5ee] px-2 py-0.5 text-[11px] font-semibold text-[#1f7a62]">기기 안에서만 처리 · 전송 없음</span>
        </div>

        <div
          className={
            "mt-2 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors " +
            (dragging ? "border-brand bg-brand-soft/40" : "border-line bg-[#fcfcfa]")
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles([...e.dataTransfer.files]);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              void readFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
            aria-label="진료비 영수증 사진 또는 PDF 선택"
          />
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            진료비 계산서·영수증 또는 약제비 영수증을 <strong className="font-semibold text-ink">사진으로 찍었거나 PDF로 받았으면</strong> 여기에 올리세요. 항목을 읽어 아래 칸을 채웁니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={ocr.busy}
              className="min-h-[44px] rounded-full bg-brand px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              사진 · PDF 고르기
            </button>
            <button
              type="button"
              onClick={() => trySample(RECEIPT_SAMPLES[0].id)}
              disabled={ocr.busy}
              className="min-h-[44px] rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
            >
              가상 영수증 체험
            </button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
            사진(JPG·PNG·WEBP) 또는 PDF · 한 번에 3장까지 (영수증 + 약국 영수증) · 드래그해서 놓아도 됩니다
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-ink-faint">가상 영수증 3종:</span>
          {RECEIPT_SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => trySample(s.id)}
              disabled={ocr.busy}
              title={s.note}
              className="min-h-[36px] rounded-full border border-line bg-white px-3 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
            >
              {s.name}
            </button>
          ))}
        </div>

        {ocr.busy && (
          <div className="mt-3 rounded-lg border border-line-soft bg-white px-3 py-2.5" role="status" aria-live="polite" data-receipt-ocr="status">
            <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-ink">
              <span className="min-w-0 truncate">{ocr.msg || "읽는 중…"}</span>
              <span className="tabular-nums text-brand">{ocr.pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(4, ocr.pct)}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">파일은 이 기기 밖으로 나가지 않습니다. 첫 인식 때는 글자 인식 엔진을 받느라 몇 초 더 걸립니다.</p>
          </div>
        )}

        {ocr.error && (
          <p className="mt-3 rounded-lg border border-[#f2d7de] bg-[#fbeef1] px-3 py-2 text-[12px] leading-relaxed text-[#a8455c]" role="alert" data-receipt-ocr="error">
            {ocr.error} 사진이 흐리면 밝은 곳에서 반듯하게 다시 찍거나, 병원 앱·홈페이지에서 받은 PDF를 올려 주세요.
          </p>
        )}

        {receipt && !ocr.busy && <ReceiptBanner result={receipt} onClose={() => setReceipt(null)} />}
      </div>

      {/* ① 영수증 금액 */}
      <div className="mt-2 rounded-xl border border-line bg-white px-4 pb-2">
        <p className="border-b border-line-soft py-3 text-[12px] font-bold tracking-[0.02em] text-ink-faint">
          ① 영수증 금액 — 영수증의 칸 이름 그대로 넣습니다
        </p>
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <AmountField
              label="급여 · 일부 본인부담금"
              value={coveredPartial}
              onChange={setCoveredPartial}
              max={visit === "inpatient" ? 30000000 : 3000000}
              step={10000}
              hint="영수증 '본인부담금' 합계(공단부담금 제외)."
            />
            <AmountField
              label="급여 · 전액 본인부담금"
              value={coveredFull}
              onChange={setCoveredFull}
              max={visit === "inpatient" ? 30000000 : 3000000}
              step={10000}
              hint="4·5세대 통원은 보상 대상에서 빠집니다(입원은 포함)."
            />
            {visit === "outpatient" && (
              <AmountField
                label="처방조제비"
                value={prescription}
                onChange={setPrescription}
                max={1000000}
                step={1000}
                hint="약국 영수증의 급여 본인부담금. 2·3세대는 8천원 정액 공제로 따로 뺍니다."
              />
            )}
          </div>
          <div>
            <AmountField
              label={NON_LABELS.general}
              value={non.general}
              onChange={(v) => setNonKey("general", v)}
              max={visit === "inpatient" ? 30000000 : 3000000}
              step={10000}
              hint="상급병실료 차액은 여기 말고 아래 '상급병실료 차액' 칸에 넣으세요."
            />
            <Segmented
              label="비급여 구분"
              value={severity}
              onChange={(v) => setSeverity(v)}
              options={[
                { value: "mild", label: "비중증(특약2)" },
                { value: "severe", label: "중증(특약1)" },
              ]}
              hint="암·뇌혈관·심장·희귀난치(산정특례) 치료비는 중증입니다. 5세대에서 특약1·특약2를 가릅니다."
            />
          </div>
        </div>

        <details className="mt-1 rounded-xl border border-line-soft bg-[#fcfcfa]">
          <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-semibold text-ink">
            3대 비급여 — {NON_LABELS.physical} / {NON_LABELS.injection} / {NON_LABELS.mri}
          </summary>
          <div className="grid gap-x-8 border-t border-line-soft px-3 pb-2 md:grid-cols-2">
            <AmountField label={NON_LABELS.physical} value={non.physical} onChange={(v) => setNonKey("physical", v)} max={5000000} step={10000} />
            <AmountField label={NON_LABELS.injection} value={non.injection} onChange={(v) => setNonKey("injection", v)} max={5000000} step={10000} />
            <AmountField label={NON_LABELS.mri} value={non.mri} onChange={(v) => setNonKey("mri", v)} max={5000000} step={10000} />
            <p className="py-2 text-[12px] leading-relaxed text-ink-faint md:py-4">
              3세대부터 이 세 항목은 특약으로 따로 봅니다. 4세대는 종목마다 3만원·30%와 회당·연 한도, 5세대 비중증은 도수·주사가 보장 제외이고 MRI만 남습니다.
            </p>
          </div>
        </details>

        <details className="mt-1 mb-2 rounded-xl border border-line-soft bg-[#fcfcfa]">
          <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-semibold text-ink">상급병실료 차액 — 전 세대 50%, 1일 평균 10만원 한도</summary>
          <div className="grid gap-x-8 border-t border-line-soft px-3 pb-2 md:grid-cols-2">
            <AmountField label={NON_LABELS.room} value={room} onChange={setRoom} max={10000000} step={10000} hint="일반 비급여 칸에 넣으면 세대별 자기부담률이 잘못 적용됩니다." />
            <label className="block py-2.5">
              <span className="mb-1 block text-[12px] text-ink-faint">입원일수 (차액이 발생한 날)</span>
              <input
                type="number"
                min={0}
                max={60}
                value={roomDays}
                onChange={(e) => setRoomDays(Math.min(60, Math.max(0, Number(e.target.value) || 0)))}
                className="w-[96px] rounded-lg border border-line bg-white px-2.5 py-1.5 text-right text-[13px] tabular-nums text-ink focus:border-brand focus:outline-none"
              />
              <span className="ml-1 text-[12px] text-ink-faint">일</span>
            </label>
          </div>
        </details>
      </div>

      {/* ② 내 세대 */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[13px] font-semibold text-ink">② 내 실손 세대</p>
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
                  (active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand")
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
              options={
                primary === "gen2"
                  ? [
                      { value: "standard", label: "표준형 20%" },
                      { value: "selective", label: "선택형Ⅰ 10%" },
                      { value: "sel2", label: "선택형Ⅱ 급여10·비급여20" },
                    ]
                  : [
                      { value: "standard", label: "표준형 20%" },
                      { value: "sel2", label: "선택형Ⅱ 급여10·비급여20" },
                    ]
              }
              hint="선택형Ⅱ는 2세대 2015.9~2017.3, 3세대 전 기간에 있습니다. 3세대 선택형Ⅰ은 없습니다."
            />
            {primary === "gen2" && (
              <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-muted">
                <input type="checkbox" checked={gen2Early} onChange={(e) => setGen2Early(e.target.checked)} className="h-4 w-4" />
                2013.1 이전 판(통원 공제가 정액뿐, 20%와 비교하지 않음)
              </label>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-ink-muted" htmlFor="gen-date">
            최초 가입일로 찾기
          </label>
          <input
            id="gen-date"
            type="date"
            value={gJoinDate}
            onChange={(e) => {
              setJoinDate(e.target.value);
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

      {/* ③ 가정과 한도 */}
      <details className="mt-3 rounded-xl border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-ink">
          ③ 가정과 한도 — 가입금액을 모르면 최대값으로 계산합니다
        </summary>
        <div className="grid gap-x-8 border-t border-line-soft px-4 pb-3 md:grid-cols-3">
          <label className="block py-2.5">
            <span className="mb-1 block text-[12px] text-ink-faint">4·5세대 통원 회당 한도</span>
            <select
              value={visitCap}
              onChange={(e) => setVisitCap(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
            >
              {VISIT_CAPS.map((v) => (
                <option key={v} value={v}>
                  {v / 10000}만원
                </option>
              ))}
            </select>
          </label>
          <label className="block py-2.5">
            <span className="mb-1 block text-[12px] text-ink-faint">1세대 통원 회당 한도</span>
            <select
              value={gen1Cap}
              onChange={(e) => setGen1Cap(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
            >
              {GEN1_CAPS.map((v) => (
                <option key={v} value={v}>
                  {v / 10000}만원
                </option>
              ))}
            </select>
          </label>
          <label className="block py-2.5">
            <span className="mb-1 block text-[12px] text-ink-faint">2·3세대 통원 회당 한도(외래+처방)</span>
            <select
              value={gen23Cap}
              onChange={(e) => setGen23Cap(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
            >
              {GEN23_CAPS.map((v) => (
                <option key={v} value={v}>
                  {v / 10000}만원
                </option>
              ))}
            </select>
          </label>
          <AmountField
            label="5세대 급여 공단부담금"
            value={coPayment}
            onChange={setCoPayment}
            max={5000000}
            step={10000}
            hint="영수증의 공단부담금. 넣으면 실제 건보 본인부담률로 계산합니다(넣지 않으면 병원 등급 평균)."
          />
          <label className="flex items-start gap-2 py-2.5 text-[12.5px] text-ink-muted md:col-span-2">
            <input type="checkbox" checked={special} onChange={(e) => setSpecial(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              <b className="font-semibold text-ink">산정특례(암·뇌혈관·심장·희귀난치) 등록 환자</b> — 체크하면 5세대 급여 통원의 건강보험 본인부담률을 5%로 보고,
              20% 하한과 비교합니다. 비급여 ‘중증(특약1)’ 선택과는 별개입니다(중증 비급여라도 산정특례가 아니면 병원 등급 본인부담률).
            </span>
          </label>
          <p className="py-3 text-[12px] leading-relaxed text-ink-faint md:col-span-2 md:py-6">
            금액은 진료 1건 기준입니다. 연간 누적 한도(비급여 5천만·1천만원, 통원 100회·100일)와 보험료는 반영하지 않습니다. 도수치료는 2026년 7월부터 관리급여(본인부담 95%)로 바뀌어
            급여 칸에 넣는 것이 맞고, 비급여 3대 칸에는 2026년 7월 이전 진료만 넣으세요.
          </p>
        </div>
      </details>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ResultStat label="병원비 합계" value={formatKrw(result.total)} sub={`${visit === "inpatient" ? "입원" : "통원"} · ${HOSPITALS[hospital].label}`} />
        <ResultStat label={`${p.label} 공제`} value={formatKrw(p.deductible)} sub="비율·최소 공제로 뺀 금액" />
        <ResultStat label="한도 삭감" value={formatKrw(p.capped)} sub={p.capped ? "회당·연 한도 초과분" : "한도에 걸린 금액 없음"} />
        <ResultStat label={`${p.label} 예상 보험금`} value={formatKrw(p.payout)} tone="brand" sub={`본인부담 ${formatKrw(p.self)} · 보장률 ${(p.payoutRate * 100).toFixed(1)}%`} />
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-[#e6d9c2] bg-[#fdf8ee] px-4 py-3">
          <p className="text-[12px] font-bold text-[#7a5b1f]">한도에 걸려 지급되지 않은 금액이 있습니다</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6b5220]">{notice.text}</p>
        </div>
      )}

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
                  {r.capped > 0 && <span className="ml-1 block text-[11px] font-normal text-ink-faint">한도 삭감 {formatKrw(r.capped)}</span>}
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
            주계약(급여)과 특약을 나눠, 항목마다 공제와 한도 삭감을 적었습니다. 금액을 바꾸면 함께 바뀝니다.
          </p>
        </div>
        <ul className="divide-y divide-line-soft">
          {p.items.map((it) => (
            <li key={it.key} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold text-ink">
                  <span className="mr-1.5 rounded bg-paper-deep px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">{itemTag(it.key, era)}</span>
                  {it.label}
                </span>
                <span className="text-[13px] font-bold tabular-nums text-brand">{formatKrw(it.payout)}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{it.reason}</p>
              <p className="mt-1 text-[12px] tabular-nums text-ink-faint">
                보장대상 {formatKrw(it.base)} · 공제 {formatKrw(it.deductible)}
                {it.capped > 0 ? ` · 한도 삭감 ${formatKrw(it.capped)}` : ""}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="고객 이름 (선택 · 인쇄에만 표시)"
          aria-label="고객 이름"
          className="min-h-[44px] w-[190px] rounded-lg border border-line bg-white px-3 text-[13px] text-ink focus:border-brand focus:outline-none"
        />
        <button type="button" onClick={printSheet} className="min-h-[44px] rounded-full bg-brand px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep">
          A4 요약 인쇄 · PDF 저장
        </button>
        <button
          type="button"
          onClick={saveCard}
          className="min-h-[44px] rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
        >
          요약 카드 저장(PNG)
        </button>
        <button
          type="button"
          onClick={copyMsg}
          className="min-h-[44px] rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
        >
          {copied ? "복사했습니다" : "결과 문구 복사"}
        </button>
      </div>

      <details className="mt-4 rounded-xl border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-ink">세대별 규칙표와 출처 — 숫자가 어디서 나왔나</summary>
        <div className="overflow-x-auto border-t border-line-soft px-4 pb-3">
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-2 font-semibold text-ink-soft">세대</th>
                <th className="py-2 pr-2 font-semibold text-ink-soft">입원</th>
                <th className="py-2 pr-2 font-semibold text-ink-soft">통원</th>
                <th className="py-2 font-semibold text-ink-soft">3대 비급여</th>
              </tr>
            </thead>
            <tbody>
              {RULE_TABLE.map((r) => (
                <tr key={r.id} className="border-b border-line-soft align-top last:border-0">
                  <th scope="row" className="whitespace-nowrap py-2 pr-2 text-left font-semibold text-ink">
                    {r.label}
                  </th>
                  <td className="py-2 pr-2 text-ink-muted">{r.inpatient}</td>
                  <td className="py-2 pr-2 text-ink-muted">{r.outpatient}</td>
                  <td className="py-2 text-ink-muted">{r.big3}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">출처: {RULE_SOURCE}.</p>
        </div>
      </details>

      {!compact && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.02em] text-ink-faint">세대별 구조 한눈에</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
            <li>· 1세대(2009년 9월 이전) — 손해보험사 자기부담 0%, 생명보험사 20%. 통원은 상품별 정액 공제(5천~2만원)와 회당 한도(10~30만원)가 붙습니다.</li>
            <li>· 2세대(2009년 10월~2017년 3월) — 표준형 20%·선택형Ⅰ 10%·선택형Ⅱ(급여10·비급여20). 통원은 외래+처방 합산 30만원 한도.</li>
            <li>· 3세대(2017년 4월~2021년 6월) — 표준형 20%·선택형Ⅱ. 도수·주사·MRI는 특약(2만원·30%)으로 떼고 연 한도를 두었습니다.</li>
            <li>· 4세대(2021년 7월~2026년 5월 5일) — 급여 20%·비급여 30%, 3대 비급여는 3만원·30%로 종목별 회당·연 한도.</li>
            <li>· 5세대(2026년 5월 6일 이후) — 급여 통원은 건보 본인부담률 연동, 비급여는 중증 30%·비중증 50%, 비중증은 도수·주사 제외.</li>
            <li>· 유병력자 실손(2018년 4월 이후) — 입원 30%·최소 10만원, 통원 30%·최소 2만원, 3대 비급여와 처방조제비는 보장하지 않습니다.</li>
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
