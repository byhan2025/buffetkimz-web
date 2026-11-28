import { useMemo, useRef, useState } from "react";
import {
  GROUPS,
  LEVEL_LABELS,
  SAMPLES,
  buildBookHTML,
  buildCSV,
  buildMessage,
  compare,
  comparePillars,
  estimatePaidTotal,
  formatMan,
  groupContracts,
  isoDate,
  parseAmount,
  readDocument,
  summarize,
  type Coverage,
  type GroupId,
  type PillarItem,
  type Summary,
} from "@/lib/bojang/engine";
import { INSURERS } from "@/lib/bojang/insurers";
import { Note, ResultStat, RunnerShell, SaveResultCard, Segmented, StickySummary } from "./ui";

/**
 * 보장분석 요약기 (공개 도구)
 *
 * 흐름: 증권·설계서(PDF 또는 붙여넣기) → 담보 표 → 그룹 요약 → (제안이 있으면) 비교.
 * 계산·분류는 전부 `src/lib/bojang/engine.js` 가 한다. 이 파일은 입력·편집·표시·인쇄만 맡는다.
 * InsureCRM 은 같은 엔진을 `bojang-core.js`(window.Bojang)로 받아 쓴다.
 *
 * 개인정보: PDF는 브라우저 안에서 글자만 뽑는다(pdfjs-dist). 파일은 어디로도 전송되지 않는다.
 */

type Side = "before" | "after";

type SideState = {
  rows: Coverage[];
  premium: number | null;
  text: string;
  source: string;
};

const EMPTY: SideState = { rows: [], premium: null, text: "", source: "" };

/** 첫 화면 — 가상 예시로 시작한다(RunnerShell 의 '예시 입력값(가상)' 안내와 맞춘다) */
function sampleSide(text: string, label: string): SideState {
  const d = readDocument(text);
  return { rows: d.coverages, premium: d.premium, text, source: label };
}

/** 일당 담보는 서로 다른 사건에 각각 지급되므로 더하지 않고 큰 금액과 건수로 적는다 */
function dailyText(g: { daily: { amount: number | null }[] }): string {
  const amounts = [...new Set(g.daily.map((d) => d.amount || 0))].filter((v) => v > 0).sort((a, b) => b - a);
  if (!amounts.length) return "";
  return `일 ${formatMan(amounts[0])}${amounts.length > 1 ? ` 외 ${amounts.length - 1}` : ""}`;
}

const won = (v: number | null) => (v == null ? "-" : v.toLocaleString("ko-KR") + "원");
const man = (v: number | null) => (v == null ? "-" : `${Math.round(v / 10000).toLocaleString("ko-KR")}만`);

/** 기준 판정 색 — 부족은 붉게, 적정·충분은 차분하게 */
function levelTone(level: string): string {
  if (level === "none" || level === "vlow") return "bg-[#f6e7ea] text-[#a8455c]";
  if (level === "low") return "bg-[#fdf1e0] text-[#8a6320]";
  if (level === "ok") return "bg-[#e6f2ec] text-[#1f7a62]";
  if (level === "rich") return "bg-[#e8eefc] text-[#1233b8]";
  return "bg-paper-deep text-ink-muted";
}

/** 기둥 상태 색 — 충족(초록) · 부족(주황) · 확인(회색) · 미보유(흐린 회색) */
const PILLAR_TONE: Record<string, string> = {
  met: "border-[#cfe4d9] bg-[#e6f2ec]",
  short: "border-[#f0dfc4] bg-[#fdf1e0]",
  check: "border-line bg-paper-deep",
  none: "border-line bg-[#fafafa]",
};
const PILLAR_TEXT: Record<string, string> = {
  met: "text-jade",
  short: "text-[#8a6320]",
  check: "text-ink-muted",
  none: "text-ink-faint",
};

/** 기둥의 한 줄 값 — 일당은 '일 3만원', 금액을 못 읽었으면 '금액 확인' */
function pillarValueText(it: PillarItem): string {
  if (it.measure === "presence") return "가입";
  if (it.value == null) return it.count ? "금액 확인" : "표에 없음";
  const v = it.measure === "daily" ? `일 ${formatMan(it.value)}` : formatMan(it.value);
  const t = it.measure === "daily" ? `일 ${formatMan(it.target)}` : formatMan(it.target);
  return `${v} / 기준 ${t}`;
}

/** 기준금액 입력 항목 — 엔진의 기본값과 같은 그룹 */
const TARGET_FIELDS: { id: string; label: string }[] = [
  { id: "cancer", label: "암 진단비" },
  { id: "brain", label: "뇌·심" },
  { id: "surgery", label: "수술비" },
  { id: "death", label: "사망" },
  { id: "driver", label: "운전자" },
];

/** 금액 입력 — "3,000만원" 처럼 써도 되고 숫자만 써도 된다(만원 단위) */
function AmountInput({
  value,
  onCommit,
  unit = "만원",
  label,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  unit?: "만원" | "원";
  label: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? "" : formatMan(value));
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-ink-faint">{label}</span>
      <input
        inputMode="text"
        value={shown}
        placeholder={unit === "만원" ? "예: 3,000만원" : "예: 3만원"}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const t = (text ?? "").trim();
          setText(null);
          if (!t) return onCommit(null);
          const v = parseAmount(t, { unit });
          onCommit(v);
        }}
        className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink tabular-nums focus:border-brand focus:outline-none"
      />
    </label>
  );
}

/** PDF → 줄 단위 글자. 페이지 안에서 같은 높이의 글자를 한 줄로 묶고, 벌어진 간격은 칸으로 남긴다. */
async function pdfToText(file: File, onStatus?: (s: string) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const lines: string[] = [];
  const pages = Math.min(doc.numPages, 40);
  for (let p = 1; p <= pages; p++) {
    onStatus?.(`PDF ${p}/${pages}쪽 읽는 중`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    type Item = { str?: string; transform?: number[]; width?: number; height?: number };
    const items = (tc.items as Item[]).filter((i) => i.transform && (i.str || "").trim());
    const rows = new Map<number, { x: number; w: number; t: string }[]>();
    for (const it of items) {
      const y = Math.round((it.transform![5] as number) / 3) * 3;
      const x = it.transform![4] as number;
      const w = it.width || 0;
      const arr = rows.get(y) || [];
      arr.push({ x, w, t: (it.str || "").trim() });
      rows.set(y, arr);
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, arr] of sorted) {
      arr.sort((a, b) => a.x - b.x);
      let line = "";
      let prevEnd = -1;
      for (const piece of arr) {
        if (!line) line = piece.t;
        else {
          const gap = piece.x - prevEnd;
          line += gap > 8 ? "  " : gap > 2 ? " " : "";
          line += piece.t;
        }
        prevEnd = piece.x + piece.w;
      }
      if (line.trim()) lines.push(line);
    }
    lines.push("");
  }
  await doc.destroy().catch(() => {});
  return lines.join("\n");
}

function groupOptions() {
  return GROUPS.map((g) => ({ value: g.id, label: g.label }));
}

/** A4 인쇄용 HTML — 새 창에서 인쇄한다(사이트 인쇄 CSS를 건드리지 않는다) */
const COMPARE_MONEY = (v: number | null) => (v == null ? "-" : v.toLocaleString("ko-KR") + "원");

function buildPrintHTML(summary: Summary, cmp: ReturnType<typeof compare> | null, name: string, baseDate: string): string {
  const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const rows = summary.groups
    .filter((g) => g.has)
    .map(
      (g) => `<tr>
        <td>${esc(g.label)}</td>
        <td class="r">${g.lump ? esc(formatMan(g.lump)) : g.limits.length ? "가입" : "-"}</td>
        <td class="r">${g.daily.length ? g.daily.map((d) => esc(formatMan(d.amount))).join(" / ") : "-"}</td>
        <td class="r">${g.count}</td>
      </tr>`,
    )
    .join("");
  const missing = summary.groups.filter((g) => g.core && !g.has).map((g) => g.label);
  const judgeRows = summary.judge
    .map(
      (j) => `<tr><td>${esc(j.label)}</td><td class="r">${esc(formatMan(j.value))}</td><td class="r">${esc(formatMan(j.target))}</td><td class="r">${
        j.ratio == null ? "-" : `${Math.round(j.ratio * 100)}%`
      }</td><td class="r">${esc(j.levelLabel)}</td></tr>`,
    )
    .join("");
  const cmpRows = cmp
    ? cmp.groups
        .filter((g) => g.status !== "none")
        .map(
          (g) => `<tr><td>${esc(g.label)}</td><td class="r">${g.before.count ? (g.before.lump ? esc(formatMan(g.before.lump)) : "가입") : "-"}</td>
          <td class="r">${g.after.count ? (g.after.lump ? esc(formatMan(g.after.lump)) : "가입") : "-"}</td>
          <td class="r ${g.delta > 0 ? "up" : g.delta < 0 ? "down" : ""}">${g.delta === 0 ? "-" : `${g.delta > 0 ? "+" : "−"}${esc(formatMan(Math.abs(g.delta)))}`}</td></tr>`,
        )
        .join("")
    : "";
  const detail = summary.groups
    .flatMap((g) => g.items.map((it) => ({ g, it })))
    .map(
      ({ g, it }) =>
        `<tr><td>${esc(it.name)}</td><td>${esc(g.short)}</td><td class="r">${
          it.kind === "rate" ? esc(it.rate) : it.kind === "limit" ? "한도" : esc(formatMan(it.amount))
        }</td><td class="r">${it.premium ? esc(formatMan(it.premium)) : "-"}</td></tr>`,
    )
    .join("");
  const changedRows = cmp
    ? cmp.rows
        .filter((r) => r.status !== "same")
        .slice(0, 18)
        .map((r) => {
          const label = r.status === "new" ? "신규" : r.status === "removed" ? "빠짐" : r.status === "up" ? "증액" : "감액";
          return `<tr><td>${esc(r.name)}</td><td>${esc(label)}</td><td class="r">${
            r.before ? esc(formatMan(r.before)) : "-"
          }</td><td class="r">${r.after ? esc(formatMan(r.after)) : "-"}</td><td class="r ${r.delta > 0 ? "up" : r.delta < 0 ? "down" : ""}">${
            r.delta === 0 ? "-" : `${r.delta > 0 ? "+" : "−"}${esc(formatMan(Math.abs(r.delta)))}`
          }</td></tr>`;
        })
        .join("")
    : "";
  const checks = summary.checks
    .filter((c) => c.level === "check")
    .map((c) => `<li>${esc(c.text)}</li>`)
    .join("");

  /* 25개 기둥·계약 단위 표·기둥 이동 — 화면과 같은 값을 A4에 적는다 */
  const pil = summary.pillars;
  const ct = summary.contractTable;
  const cpil = cmp && cmp.pillars ? cmp.pillars : null;
  const pillHTML = pil
    ? `<h2>보장 기둥 <span class="sub" style="margin:0">${esc(pil.summaryLine)} · 부족 ${pil.short} · 확인 ${pil.check} · 미보유 ${pil.none}</span></h2>
  <p style="margin:2px 0 4px">뿌리 · ${esc(pil.root.label)} — <b>${esc(pil.root.status === "met" ? pil.root.generationLabel || "가입" : "미보유")}</b></p>
  <div class="pills">${pil.items
    .map(
      (it) => `<div class="pill ${esc(it.status)}"><b>${esc(it.label)}</b><i>${esc(
        it.measure === "presence" ? "가입" : it.value == null ? "—" : `${it.measure === "daily" ? "일 " : ""}${formatMan(it.value)}`
      )}</i></div>`,
    )
    .join("")}</div>
  <p class="sub" style="margin:4px 0 0">${esc(pil.note)}</p>`
    : "";
  const ctHTML = ct && ct.groups.length
    ? `<h2>계약(상품) 단위 <span class="sub" style="margin:0">계약 ${ct.count}건 · 월 ${ct.premium != null ? esc(won(ct.premium)) : "보험료 미확인"}</span></h2>
  <table><thead><tr><th>보험사</th><th>상품명</th><th class="r">계약일</th><th class="r">납입·만기</th><th class="r">월 보험료</th><th class="r">담보</th></tr></thead><tbody>${ct.groups
    .map(
      (g) => `<tr><td>${esc(g.unnamed ? "(미기재)" : g.insurer || "-")}</td><td>${esc(g.unnamed ? "계약 구분 없음" : g.product || "-")}<div class="s">${esc(g.top.join(" · "))}</div></td><td class="r">${esc(g.startDate || "-")}</td><td class="r">${esc([g.payTerm, g.coverTerm].filter(Boolean).join(" · ") || "-")}</td><td class="r">${g.premiumKnown ? esc(won(g.premium)) : "-"}</td><td class="r">${g.count}건</td></tr>`,
    )
    .join("")}</tbody></table>
  <p class="sub" style="margin:4px 0 0">${esc(ct.note)}</p>`
    : "";
  const cpilHTML = cpil
    ? `<div class="pillar-cmp"><p><b>${esc(cpil.summaryLine)}</b> (${cpil.metDelta >= 0 ? "+" : "−"}${Math.abs(cpil.metDelta)})</p>
  ${cpil.built.length ? `<p>새로 세워지는 기둥 — ${cpil.built.map((i) => esc(i.label)).join(", ")}</p>` : ""}
  ${cpil.filled.length ? `<p>부족에서 충족으로 — ${cpil.filled.map((i) => esc(i.label)).join(", ")}</p>` : ""}
  ${cpil.empty.length ? `<p>제안 후에도 비어 있는 기둥 ${cpil.empty.length} — ${cpil.empty.map((i) => esc(i.label)).join(", ")}</p>` : ""}
  ${cpil.lost.length ? `<p>약해지는 기둥 — ${cpil.lost.map((i) => esc(i.label)).join(", ")}</p>` : ""}</div>`
    : "";

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>보장 정리 요약</title>
<style>
  @page { size: A4 portrait; margin: 13mm; }
  * { box-sizing: border-box; }
  body { font-family: "Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif; color: #0b1b29; font-size: 11.5px; line-height: 1.5; margin: 0; }
  h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -0.02em; }
  .sub { color: #55626e; font-size: 10.5px; margin-bottom: 12px; }
  h2 { font-size: 12.5px; margin: 16px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #dde3e8; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eaefF2; padding: 3.5px 5px; text-align: left; vertical-align: top; }
  th { background: #f2f0e8; font-weight: 700; font-size: 10.5px; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  .hero { display: flex; gap: 8px; margin: 6px 0 2px; }
  .hero div { flex: 1; border: 1px solid #dde3e8; border-radius: 7px; padding: 6px 9px; }
  .hero span { display: block; color: #55626e; font-size: 10px; }
  .hero b { font-size: 15px; letter-spacing: -0.02em; }
  .up { color: #1f7a62; } .down { color: #a8455c; }
  ul { margin: 4px 0 0 16px; padding: 0; }
  li { margin-bottom: 2px; }
  .pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
  .pill { border: 1px solid #e6ebef; border-radius: 4px; padding: 3px 5px; display: flex; justify-content: space-between; gap: 4px; font-size: 9.5px; }
  .pill b { font-weight: 600; }
  .pill i { font-style: normal; white-space: nowrap; color: #55626e; }
  .pill.met { background: #e6f2ec; border-color: #cfe4d9; }
  .pill.short { background: #fdf1e0; border-color: #f0dfc4; }
  .pill.none { background: #fafafa; color: #8a949e; }
  .pill.check { background: #f1f3f6; }
  td .s { color: #55626e; font-size: 9.5px; }
  .pillar-cmp { border: 1px solid #e6ebef; border-radius: 6px; padding: 6px 9px; margin: 4px 0 6px; }
  .pillar-cmp p { margin: 2px 0; font-size: 10.5px; }
  .foot { margin-top: 14px; border-top: 1px solid #dde3e8; padding-top: 6px; color: #55626e; font-size: 9.5px; line-height: 1.45; }
</style></head><body>
<h1>보장 정리 요약${name ? ` · ${esc(name)}` : ""}</h1>
<div class="sub">기준일 ${esc(baseDate)} · buffetkimz.com · 참고용 정리</div>

<div class="hero">
  <div><span>담보</span><b>${summary.count}건</b></div>
  <div><span>월 보험료</span><b>${summary.premiumKnown ? esc(won(summary.premium)) : "확인 필요"}</b></div>
  <div><span>보장 기둥</span><b>${pil ? `${pil.met} / ${pil.total}` : "-"}</b></div>
  <div><span>실손 세대</span><b>${summary.silson.label ? esc(summary.silson.label) : "확인 필요"}</b></div>
  <div><span>확인할 점</span><b>${summary.checks.filter((c) => c.level === "check").length}개</b></div>
</div>

<h2>보장 그룹 요약</h2>
<table><thead><tr><th>그룹</th><th class="r">정액(진단·수술)</th><th class="r">일당</th><th class="r">건수</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4">정리된 담보가 없습니다.</td></tr>`}</tbody></table>
${missing.length ? `<p>표에서 찾지 못한 기본 항목: ${esc(missing.join(", "))} — 증권 원문에서 확인하세요.</p>` : ""}

<h2>기준금액 대비 판정</h2>
${
  judgeRows
    ? `<table><thead><tr><th>그룹</th><th class="r">가입</th><th class="r">기준</th><th class="r">충족률</th><th class="r">판정</th></tr></thead><tbody>${judgeRows}</tbody></table><p class="sub" style="margin:4px 0 0">${esc(
        summary.targetsNote
      )}</p>`
    : `<p>기준금액을 넣으면 부족·적정·충분을 표시합니다.</p>`
}

${pillHTML}
${ctHTML}

${
  cmp
    ? `<h2>기존 · 제안 비교</h2>${cpilHTML}
<table><thead><tr><th>그룹</th><th class="r">기존</th><th class="r">제안</th><th class="r">증감</th></tr></thead><tbody>${cmpRows}</tbody>
<tfoot><tr><th>월 보험료</th><th class="r">${COMPARE_MONEY(cmp.premium.before)}</th><th class="r">${COMPARE_MONEY(cmp.premium.after)}</th><th class="r">${
        cmp.premium.delta == null ? "-" : `${cmp.premium.delta > 0 ? "+" : "−"}${esc(formatMan(Math.abs(cmp.premium.delta)))}`
      }</th></tr></tfoot></table>`
    : ""
}
${changedRows ? `<h2>달라진 담보</h2><table><thead><tr><th>담보</th><th>구분</th><th class="r">기존</th><th class="r">제안</th><th class="r">증감</th></tr></thead><tbody>${changedRows}</tbody></table>` : ""}

${checks ? `<h2>확인할 점</h2><ul>${checks}</ul>` : ""}

<h2>담보 상세</h2>
<table><thead><tr><th>담보</th><th>그룹</th><th class="r">가입금액</th><th class="r">월 보험료</th></tr></thead><tbody>${detail}</tbody></table>

<div class="foot">
  담보 이름을 기준으로 묶은 참고용 정리입니다. 그룹 구분은 실무에서 쓰는 묶음이며 법정 기준이 아닙니다. 실제 지급 여부·금액·면책은 가입 약관과 보험사 심사에 따릅니다.
  금액을 읽지 못한 담보는 0원이 아니라 '확인 필요'로 남겼습니다. 일당·한도 담보는 정액 합계에 더하지 않았습니다.
</div>
</body></html>`;
}

export default function BojangSummary({ compact = false }: { compact?: boolean }) {
  const [side, setSide] = useState<Side>("before");
  const [sides, setSides] = useState<Record<Side, SideState>>(() => ({
    before: sampleSide(SAMPLES.before, "예시 자료(가상)"),
    after: { ...EMPTY },
  }));
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  /** 담보 표를 '담보별'로 볼지 '계약(상품)별'로 볼지 — 같은 자료를 두 방식으로 보여 준다 */
  const [tableView, setTableView] = useState<"rows" | "contracts">("rows");
  /** 기둥 목록을 부족·미보유만 볼지 */
  const [gapsOnly, setGapsOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** 기준일은 화면·인쇄·카드·CSV·증권북이 모두 같은 날짜를 쓴다 — YYYY-MM-DD 그대로 찍힌다 */
  const baseDate = useMemo(() => isoDate(new Date()), []);
  /** 기준금액 — 만원 단위. 빈 칸이면 그 그룹은 판정하지 않는다 */
  const [targets, setTargets] = useState<Record<string, string>>({
    cancer: "3000",
    brain: "2000",
    surgery: "300",
    death: "10000",
    driver: "20000",
  });

  const cur = sides[side];

  const summary = useMemo(
    () =>
      summarize(cur.rows, {
        label: side === "before" ? "보유" : "제안",
        premium: cur.premium,
        at: baseDate,
        targets: Object.fromEntries(Object.entries(targets).filter(([, v]) => String(v).trim() !== "").map(([k, v]) => [k, Number(v)])),
        targetsAreManwon: true,
      }),
    [cur.rows, cur.premium, side, targets, baseDate],
  );
  const both = sides.before.rows.length && sides.after.rows.length;
  const cmp = useMemo(() => (both ? compare(sides.before.rows, sides.after.rows) : null), [both, sides.before.rows, sides.after.rows]);
  /** 25개 기둥·계약 단위 표 — 요약 엔진이 같은 값을 함께 낸다 */
  const pil = summary.pillars;
  const ct = summary.contractTable;
  const cpil = cmp?.pillars ?? null;

  const setSideState = (s: Side, patch: Partial<SideState>) =>
    setSides((prev) => ({ ...prev, [s]: { ...prev[s], ...patch } }));

  const applyText = (s: Side, text: string, source: string) => {
    setErr("");
    const doc = readDocument(text);
    if (!doc.rowCount) {
      setErr("담보 줄을 찾지 못했습니다. '담보명 … 가입금액 …' 형태인지 확인하거나 아래 표에 직접 추가해 주세요.");
      setSideState(s, { text, source });
      return;
    }
    setSideState(s, { rows: doc.coverages, premium: doc.premium, text, source });
    setStatus(`${doc.rowCount}개 담보를 읽었습니다. 표에서 이름·금액을 확인하세요.`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErr("");
    setStatus("PDF 글자를 읽는 중…");
    try {
      const text = await pdfToText(file, setStatus);
      applyText(side, text, file.name);
    } catch {
      setErr("PDF를 읽지 못했습니다. 스캔 이미지 PDF는 글자가 없어 읽을 수 없습니다. 텍스트를 붙여넣어 주세요.");
      setStatus("");
    }
  };

  /** 행을 고친다 — 보험료·납입기간이 바뀌면 총납입 추정도 그 자리에서 다시 계산한다. */
  const patchRow = (i: number, patch: Partial<Coverage>) => {
    setSideState(side, {
      rows: cur.rows.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if ("premium" in patch || "payTerm" in patch) {
          next.paidTotal = estimatePaidTotal(next.premium, next.payTerm);
        }
        return next;
      }),
    });
  };
  const removeRow = (i: number) => setSideState(side, { rows: cur.rows.filter((_, idx) => idx !== i) });
  const addRow = () =>
    setSideState(side, {
      rows: [
        ...cur.rows,
        {
          id: String(Date.now()),
          name: "",
          group: "etc",
          kind: "lump",
          sub: "",
          tags: [],
          amount: null,
          rate: "",
          premium: null,
          insurer: "",
          product: "",
          startDate: "",
          term: "",
          payTerm: "",
          coverTerm: "",
          renew: "",
          paidTotal: null,
          note: "",
          raw: "",
          confidence: "low",
          rule: null,
        },
      ],
    });

  const clearSide = () => {
    setSideState(side, { ...EMPTY });
    setStatus("");
    setErr("");
  };

  const printSheet = () => {
    const html = buildPrintHTML(summary, cmp, name.trim(), baseDate);
    const w = window.open("", "_blank", "width=920,height=1200");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  /** 증권북형 HTML — 표지·탭별 요약·보험사 연락처. 파일로 저장하거나 인쇄한다 */
  const saveBook = () => {
    const html = buildBookHTML(summary, { name: name.trim(), at: baseDate, insurers: INSURERS, compare: cmp });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `보장증권북_${name.trim() || "고객"}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  /** 엑셀(CSV) — 담보 표·요약·판정. BOM을 붙여 한글이 깨지지 않게 한다 */
  const saveCSV = () => {
    const csv = "\uFEFF" + buildCSV(cur.rows, summary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `보장분석_${side === "before" ? "보유" : "제안"}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(buildMessage(summary, { name: name.trim() }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr("브라우저가 복사를 막았습니다. 인쇄로 저장해 주세요.");
    }
  };

  /** 요약 카드 PNG — 1080×1350 */
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
      /* 글꼴을 못 기다려도 기본 글꼴로 그린다 */
    }
    const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif';
    ctx.fillStyle = "#faf9f6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0b1b29";
    ctx.fillRect(0, 0, W, 12);

    ctx.fillStyle = "#55626e";
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText("보장 정리 요약", 72, 104);

    ctx.fillStyle = "#0b1b29";
    ctx.font = `700 50px ${FONT}`;
    ctx.fillText(name.trim() ? `${name.trim()}님 보장` : "담보 현황", 72, 172);

    ctx.font = `500 28px ${FONT}`;
    ctx.fillStyle = "#3f4b57";
    ctx.fillText(`담보 ${summary.count}건 · 월 보험료 ${summary.premiumKnown ? won(summary.premium) : "확인 필요"}`, 72, 220);
    ctx.fillText(`보장 기둥 ${pil.met} / ${pil.total} (부족 ${pil.short} · 미보유 ${pil.none})`, 72, 262);

    /* 그룹별 막대 — 정액 담보가 있는 그룹만 */
    const bars = summary.groups.filter((g) => g.has);
    const max = Math.max(1, ...bars.map((g) => g.lump));
    /* 그룹이 적으면 줄 간격을 넓혀 카드 가운데를 채운다 */
    const step = Math.min(84, Math.max(54, Math.floor(560 / Math.max(1, Math.min(9, bars.length)))));
    let y = 300;
    ctx.font = `500 25px ${FONT}`;
    for (const g of bars.slice(0, 9)) {
      ctx.fillStyle = "#3f4b57";
      ctx.fillText(g.label, 72, y);
      const barX = 420;
      const barW = 420;
      ctx.fillStyle = "#eaefF2";
      ctx.fillRect(barX, y - 20, barW, 22);
      if (g.lump > 0) {
        ctx.fillStyle = g.tone;
        ctx.fillRect(barX, y - 20, Math.max(2, (g.lump / max) * barW), 22);
      }
      ctx.fillStyle = "#0b1b29";
      ctx.textAlign = "right";
      ctx.fillText(g.lump ? formatMan(g.lump) : g.daily.length ? dailyText(g) : "가입", W - 72, y);
      ctx.textAlign = "left";
      y += step;
    }

    /* 실손 세대 · 확인할 점 */
    y = y + 26;
    ctx.fillStyle = "#55626e";
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText("실손", 72, y);
    ctx.fillStyle = "#0b1b29";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(summary.silson.label ? `${summary.silson.label}${summary.silson.from === "계약일" ? " (계약일 기준)" : ""}` : "확인 필요", 72, y + 40);

  const checks = summary.checks.filter((c) => c.level === "check");
    ctx.fillStyle = "#55626e";
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(`확인할 점 ${checks.length}개`, 560, y);
    ctx.fillStyle = "#0b1b29";
    ctx.font = `400 21px ${FONT}`;
    checks.slice(0, 3).forEach((c, i) => {
      const text = c.text.length > 34 ? c.text.slice(0, 33) + "…" : c.text;
      ctx.fillText(text, 560, y + 36 + i * 30);
    });

    ctx.strokeStyle = "#dde3e8";
    ctx.beginPath();
    ctx.moveTo(72, 1150);
    ctx.lineTo(W - 72, 1150);
    ctx.stroke();

    ctx.fillStyle = "#55626e";
    ctx.font = `400 21px ${FONT}`;
    const notes = [
      "담보 이름을 기준으로 묶은 참고용 정리입니다. 그룹 구분은 법정 기준이 아닙니다.",
      "일당·한도 담보는 정액 합계에 더하지 않았고, 읽지 못한 금액은 '확인 필요'로 남겼습니다.",
      "실제 지급 여부·금액은 가입 약관과 보험사 심사에 따릅니다.",
      `기준일 ${baseDate} · buffetkimz.com`,
    ];
    let ny = 1194;
    for (const line of notes) {
      ctx.fillText(line, 72, ny);
      ny += 34;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `보장요약_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  };

  const loadSample = (s: Side) => {
    applyText(s, SAMPLES[s], `예시 자료(${s === "before" ? "보유" : "제안"})`);
  };

  /** 가상 비교 예시 — 보유·제안을 한 번에 채워 기둥 이동과 보험료 변화를 바로 보게 한다 */
  const loadPair = () => {
    /* 직접 넣은 자료가 화면에 있으면 먼저 묻는다 — 저장되지 않은 입력을 말없이 지우지 않는다 */
    const typed = (["before", "after"] as Side[]).some(
      (s) => sides[s].rows.length > 0 && !String(sides[s].source || "").startsWith("예시"),
    );
    if (typed && !window.confirm("지금 화면의 담보를 가상 예시(보유+제안)로 바꿉니다. 저장되지 않은 입력은 사라집니다.")) return;
    applyText("before", SAMPLES.before, "예시 자료(가상) · 보유");
    applyText("after", SAMPLES.after, "예시 자료(가상) · 제안");
    setSide("before");
    setStatus("가상 예시(보유+제안)를 넣었습니다. 아래 '기존 · 제안 비교'에서 기둥 이동과 보험료 변화를 보세요.");
  };

  return (
    <RunnerShell
      title="보장분석 요약기"
      subtitle="증권·설계서의 담보를 그룹·계약 단위로 정리하고, 25개 보장 기둥과 기존·제안 비교를 한 화면에서 봅니다."
      example="PDF를 올리거나 담보 목록을 붙여넣으면 그 자리에서 다시 정리합니다. [가상 비교 예시]를 누르면 보유·제안 두 벌이 한 번에 들어가 기둥 이동과 보험료 변화를 바로 볼 수 있습니다."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Segmented
          label="정리할 자료"
          value={side}
          onChange={(v) => setSide(v as Side)}
          options={[
            { value: "before", label: "보유(기존)" },
            { value: "after", label: "제안(설계)" },
          ]}
          hint="두 쪽을 모두 채우면 아래에 증감 비교가 나옵니다."
        />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-ink">이름 (선택)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="인쇄·문구에만 쓰고 저장하지 않습니다"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      {/* ① 자료 넣기 */}
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink">
            {side === "before" ? "보유 증권·설계서" : "제안 설계서"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink"
            >
              PDF 올리기
            </button>
            <button
              type="button"
              onClick={() => loadSample(side)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink"
            >
              예시 넣기
            </button>
            <button
              type="button"
              onClick={loadPair}
              className="rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1.5 text-[12px] font-semibold text-brand-deep hover:border-brand"
            >
              가상 비교 예시
            </button>
            <button
              type="button"
              onClick={clearSide}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-ink"
            >
              비우기
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <textarea
          value={cur.text}
          onChange={(e) => setSideState(side, { text: e.target.value })}
          onBlur={() => {
            if (cur.text.trim() && !cur.rows.length) applyText(side, cur.text, "붙여넣기");
          }}
          rows={compact ? 4 : 6}
          placeholder={"예)\n담보명\t가입금액\t월보험료\n암진단비\t3,000만원\t12,000원\n질병입원일당\t3만원\t1,800원"}
          className="mt-2 w-full rounded-lg border border-line bg-[#fbfbf8] px-3 py-2 font-mono text-[12px] leading-relaxed text-ink focus:border-brand focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyText(side, cur.text, "붙여넣기")}
            className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-ink-soft"
          >
            담보 정리하기
          </button>
          <span className="text-[12px] text-ink-faint">
            {cur.source ? `자료: ${cur.source}` : "PDF·텍스트 모두 이 브라우저 안에서만 처리합니다."}
          </span>
        </div>
        {status && <p className="mt-2 text-[12px] text-jade">{status}</p>}
        {err && <p className="mt-2 text-[12px] text-[#a8455c]">{err}</p>}
      </div>

      {/* ② 담보 확인·수정 */}
      {cur.rows.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">
              담보 {cur.rows.length}건{" "}
              <span className="font-normal text-ink-faint">
                {tableView === "rows" ? "— 이름·그룹·금액을 고칠 수 있습니다" : `— 계약 ${ct.count}건으로 묶었습니다`}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label="담보 표 보기 방식">
                {(
                  [
                    { v: "rows", t: "담보별" },
                    { v: "contracts", t: "계약별" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="tab"
                    aria-selected={tableView === o.v}
                    onClick={() => setTableView(o.v)}
                    className={
                      "rounded-md px-2.5 py-1 text-[12px] font-semibold " +
                      (tableView === o.v ? "bg-ink text-white" : "text-ink-muted hover:text-ink")
                    }
                  >
                    {o.t}
                  </button>
                ))}
              </div>
              {tableView === "rows" && (
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink"
                >
                  + 담보 추가
                </button>
              )}
            </div>
          </div>

          {/* 계약(상품) 단위 표 — 같은 담보를 계약으로 묶어 본다. 정액 금액은 더하지 않는다. */}
          {tableView === "contracts" && (
            <div data-contracts className="mt-2 rounded-xl border border-line bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-ink">계약 {ct.count}건</p>
                <p className="text-[12px] text-ink-muted">
                  월 보험료 {ct.premium != null ? won(ct.premium) : "확인 필요"}
                  {ct.paidTotal ? ` · 총납입 추정 ${formatMan(ct.paidTotal)}` : ""}
                </p>
              </div>
              {/* 폰: 계약마다 카드로 */}
              <div className="mt-2 space-y-2 md:hidden">
                {ct.groups.map((g) => (
                  <div key={g.key} className="rounded-lg border border-line p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">
                        {g.unnamed ? "계약 구분 없음" : g.product || "상품명 미기재"}
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-faint">{g.count}건</span>
                    </div>
                    <p className="text-[12px] text-ink-muted">{g.unnamed ? "보험사·상품명이 적힌 담보가 없습니다" : g.insurer || "보험사 미기재"}</p>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
                      <div className="flex justify-between gap-1">
                        <dt className="text-ink-faint">계약일</dt>
                        <dd className="tabular-nums text-ink">{g.startDate || "-"}</dd>
                      </div>
                      <div className="flex justify-between gap-1">
                        <dt className="text-ink-faint">납입·만기</dt>
                        <dd className="tabular-nums text-ink">{[g.payTerm, g.coverTerm].filter(Boolean).join(" · ") || "-"}</dd>
                      </div>
                      <div className="flex justify-between gap-1">
                        <dt className="text-ink-faint">월 보험료</dt>
                        <dd className="tabular-nums text-ink">{g.premiumKnown ? won(g.premium) : "-"}</dd>
                      </div>
                      <div className="flex justify-between gap-1">
                        <dt className="text-ink-faint">담보</dt>
                        <dd className="tabular-nums text-ink">{g.count}건</dd>
                      </div>
                    </dl>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">주요 담보: {g.top.join(" · ") || "-"}</p>
                  </div>
                ))}
              </div>
              {/* 데스크톱: 표 */}
              <div className="mt-2 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] text-ink-faint">
                      <th className="py-1.5 pr-2 text-left font-semibold">보험사</th>
                      <th className="py-1.5 pr-2 text-left font-semibold">상품명</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">계약일</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">납입·만기</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">월 보험료</th>
                      <th className="py-1.5 text-right font-semibold">담보</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ct.groups.map((g) => (
                      <tr key={g.key} className="border-b border-line-soft align-top last:border-0">
                        <td className="py-1.5 pr-2 text-ink">{g.unnamed ? "(미기재)" : g.insurer || "-"}</td>
                        <td className="py-1.5 pr-2 text-ink">
                          <span className="font-semibold">{g.unnamed ? "계약 구분 없음" : g.product || "-"}</span>
                          <span className="mt-0.5 block text-[10.5px] text-ink-faint">{g.top.join(" · ")}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-ink-muted">{g.startDate || "-"}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-ink-muted">
                          {[g.payTerm, g.coverTerm].filter(Boolean).join(" · ") || "-"}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{g.premiumKnown ? won(g.premium) : "-"}</td>
                        <td className="py-1.5 text-right tabular-nums text-ink-muted">{g.count}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{ct.note}</p>
            </div>
          )}

          {tableView === "rows" && (
          <div className="mt-2 space-y-2">
            {cur.rows.map((r, i) => (
              <div key={r.id + i} className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => patchRow(i, { name: e.target.value })}
                    placeholder="담보 이름"
                    aria-label={`담보 ${i + 1} 이름`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`${r.name || "담보"} 삭제`}
                    className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-[12px] text-ink-faint hover:border-[#a8455c] hover:text-[#a8455c]"
                  >
                    삭제
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-ink-faint">그룹</span>
                    <select
                      value={r.group}
                      onChange={(e) => patchRow(i, { group: e.target.value as GroupId })}
                      className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    >
                      {groupOptions().map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {r.kind === "rate" ? (
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-ink-faint">지급 비율</span>
                      <input
                        value={r.rate}
                        onChange={(e) => patchRow(i, { rate: e.target.value })}
                        placeholder="예: 3~100%"
                        className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink tabular-nums focus:border-brand focus:outline-none"
                      />
                    </label>
                  ) : (
                    <AmountInput
                      label={r.kind === "daily" ? "1일 금액" : r.kind === "limit" ? "보장 한도(선택)" : "가입금액"}
                      unit={r.kind === "daily" ? "원" : "만원"}
                      value={r.amount}
                      onCommit={(v) => patchRow(i, { amount: v })}
                    />
                  )}
                  <AmountInput label="월 보험료(선택)" unit="원" value={r.premium} onCommit={(v) => patchRow(i, { premium: v })} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-ink-faint">갱신</span>
                    <select
                      value={r.renew || ""}
                      onChange={(e) => patchRow(i, { renew: e.target.value as Coverage["renew"] })}
                      className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    >
                      <option value="">확인 필요</option>
                      <option value="갱신">갱신형</option>
                      <option value="비갱신">비갱신형</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-ink-faint">납입기간</span>
                    <input
                      value={r.payTerm || ""}
                      onChange={(e) => patchRow(i, { payTerm: e.target.value })}
                      placeholder="예: 20년납"
                      className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-ink-faint">만기(보장기간)</span>
                    <input
                      value={r.coverTerm || ""}
                      onChange={(e) => patchRow(i, { coverTerm: e.target.value })}
                      placeholder="예: 100세"
                      className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </label>
                  <p className="self-end pb-1.5 text-[12px] text-ink-faint">
                    {r.paidTotal ? `총납입 추정 ${formatMan(r.paidTotal)}` : "보험료·납입기간을 넣으면 총납입을 추정합니다"}
                  </p>
                </div>
                {r.confidence !== "high" && (
                  <p className="mt-1.5 text-[12px] text-[#8a6320]">
                    {r.group === "etc" ? "그룹을 확인해 주세요" : r.amount == null && r.kind !== "limit" ? "가입금액을 읽지 못했습니다" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* ③ 요약 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResultStat label="담보" value={`${summary.count}건`} sub={summary.silson.label ? `실손 ${summary.silson.label}` : "실손 세대 확인 필요"} />
        <ResultStat
          label="월 보험료"
          value={summary.premiumKnown ? won(summary.premium) : "확인 필요"}
          sub={
            summary.paidTotal
              ? `총납입 추정 ${formatMan(summary.paidTotal)} · 담보 보험료 합`
              : summary.premiumKnown
                ? "담보 보험료 합"
                : "합계 줄이나 담보별 보험료를 넣어 주세요"
          }
        />
        <ResultStat
          label="암 진단비"
          value={summary.groups.find((g) => g.id === "cancer")?.lump ? man(summary.groups.find((g) => g.id === "cancer")!.lump) : "—"}
          sub={`수술비 ${summary.groups.find((g) => g.id === "surgery")?.lump ? man(summary.groups.find((g) => g.id === "surgery")!.lump) : "—"}`}
          tone="brand"
        />
        <ResultStat
          label="확인할 점"
          value={`${summary.checks.filter((c) => c.level === "check").length}개`}
          sub="0원이 아니라 '표에 없음'으로 남깁니다"
        />
      </div>

      {/* ③-기둥 — 뿌리(실손) 위에 세운 25개 기둥 체크리스트 */}
      {summary.count > 0 && (
        <div data-pillars="25" className="mt-4 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">보장 기둥 25 체크리스트</p>
            <p className="text-[12px] tabular-nums text-ink-muted">
              충족 {pil.met} · 부족 {pil.short} · 확인 {pil.check} · 미보유 {pil.none}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{pil.met}</span>
              <span className="text-[13px] text-ink-faint">/ {pil.total}</span>
            </div>
            <div
              className="h-2 min-w-[90px] flex-1 overflow-hidden rounded-full bg-[#eef1f4]"
              role="img"
              aria-label={`보장 기둥 ${pil.met} / ${pil.total}`}
            >
              <div
                className="h-full rounded-full bg-ink transition-all duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${(pil.met / pil.total) * 100}%` }}
              />
            </div>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[12px] font-semibold " +
                (pil.root.status === "met" ? "bg-jade-soft text-jade" : "bg-[#f6e7ea] text-[#a8455c]")
              }
            >
              뿌리 실손 · {pil.root.status === "met" ? pil.root.generationLabel ?? "가입" : "미보유"}
            </span>
            <button
              type="button"
              aria-pressed={gapsOnly}
              onClick={() => setGapsOnly((v) => !v)}
              className={
                "rounded-full border px-2.5 py-1 text-[12px] font-semibold " +
                (gapsOnly ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-muted hover:border-ink")
              }
            >
              {gapsOnly ? "전체 보기" : "부족·미보유만"}
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {pil.groups.map((g) => {
              const items = pil.items.filter((it) => it.group === g.id && (!gapsOnly || it.status !== "met"));
              if (!items.length) return null;
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: g.tone }} aria-hidden="true" />
                    <span className="text-[12px] font-semibold text-ink-soft">{g.label}</span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eef1f4]" aria-hidden="true">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none"
                        style={{
                          width: `${g.total ? (g.met / g.total) * 100 : 0}%`,
                          background: g.tone,
                        }}
                      />
                    </div>
                    <span className="text-[12px] tabular-nums text-ink-faint">
                      {g.met}/{g.total}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        title={`${it.names.join(", ") || "표에 없음"}${it.note ? ` — ${it.note}` : ""}`}
                        className={"rounded-lg border px-2 py-1.5 transition-colors duration-300 motion-reduce:transition-none " + PILLAR_TONE[it.status]}
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className={
                              "line-clamp-2 text-[12px] font-semibold leading-tight " +
                              (it.status === "none" ? "text-ink-faint" : "text-ink")
                            }
                          >
                            {it.label}
                          </span>
                          <span className={"shrink-0 text-[12px] font-semibold " + PILLAR_TEXT[it.status]}>{it.statusLabel}</span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] leading-tight tabular-nums text-ink-muted">{pillarValueText(it)}</div>
                        {it.common && (
                          <span className="mt-0.5 inline-block rounded bg-white/70 px-1 text-[9.5px] text-ink-faint">공통</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{pil.note}</p>
        </div>
      )}

      {summary.count > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[13px] font-semibold text-ink">그룹별 현황</p>
            <div className="mt-2 space-y-1.5">
              {summary.groups.map((g) => (
                <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2 border-b border-line-soft pb-1.5 last:border-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: g.tone }} aria-hidden="true" />
                    <span className="truncate text-[12.5px] text-ink">{g.label}</span>
                  </span>
                  <span className="text-right text-[12.5px] font-semibold tabular-nums text-ink">
                    {g.lump ? formatMan(g.lump) : g.daily.length ? dailyText(g) : g.limits.length ? "가입" : "—"}
                  </span>
                  <span className="w-8 text-right text-[12px] tabular-nums text-ink-faint">{g.count ? `${g.count}건` : ""}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              일당·한도 담보는 정액 합계에 더하지 않고 따로 적었습니다. 암·뇌·심장 수술비는 각 그룹에 들어갑니다.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[13px] font-semibold text-ink">확인할 점</p>
            {summary.checks.length ? (
              <ul className="mt-2 space-y-2">
                {summary.checks.map((c) => (
                  <li key={c.code} className="flex gap-2 text-[12px] leading-relaxed">
                    <span className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c.level === "check" ? "bg-[#8a6320]" : "bg-line"}`} aria-hidden="true" />
                    <span className={c.level === "check" ? "text-ink" : "text-ink-muted"}>{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-ink-muted">표에서 확인할 점이 없습니다. 다만 이 정리는 담보 이름을 기준으로 묶은 것이라, 지급 조건은 약관으로 한 번 더 확인해 주세요.</p>
            )}
          </div>
        </div>
      )}

      {/* ③-2 기준 대비 판정 */}
      {summary.count > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">기준금액 대비 판정</p>
            <p className="text-[12px] text-ink-faint">기준은 만원 단위 · 직접 고칠 수 있습니다</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TARGET_FIELDS.map((t) => (
              <label key={t.id} className="block">
                <span className="mb-1 block text-[12px] text-ink-faint">{t.label}</span>
                <input
                  inputMode="numeric"
                  value={targets[t.id] ?? ""}
                  onChange={(e) => setTargets((prev) => ({ ...prev, [t.id]: e.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="0"
                  aria-label={`${t.label} 기준금액(만원)`}
                  className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right text-[12.5px] tabular-nums text-ink focus:border-brand focus:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {summary.groups
              .filter((g) => g.target)
              .map((g) => (
                <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-2 border-b border-line-soft pb-1.5 last:border-0">
                  <span className="truncate text-[12.5px] text-ink">{g.label}</span>
                  <span className="text-right text-[12px] font-semibold tabular-nums text-ink">{formatMan(g.lump)}</span>
                  <span className="text-right text-[12px] tabular-nums text-ink-faint">/ {formatMan(g.target)}</span>
                  <span className={"rounded px-1.5 py-0.5 text-[12px] font-semibold " + levelTone(g.level)}>{g.levelLabel}</span>
                </div>
              ))}
          </div>
          {(summary.groups.find((g) => g.id === "cancer")?.count || 0) > 0 && (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              암 진단비 — 일반암 {formatMan(summary.groups.find((g) => g.id === "cancer")!.generalCancer)} · 유사암·소액암{" "}
              {formatMan(summary.groups.find((g) => g.id === "cancer")!.similarCancer)}
              {(summary.groups.find((g) => g.id === "cancer")!.surgery || 0) > 0
                ? ` · 암 수술비 ${formatMan(summary.groups.find((g) => g.id === "cancer")!.surgery)}(진단비 합계에 더하지 않음)`
                : ""}
            </p>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{summary.targetsNote}</p>
        </div>
      )}

      {/* ④ 비교 */}
      {cmp && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">기존 · 제안 비교</p>
            <p className="text-[12px] text-ink-muted">
              월 보험료 {won(cmp.premium.before)} → {won(cmp.premium.after)}{" "}
              {cmp.premium.delta != null && (
                <b className={cmp.premium.delta > 0 ? "text-[#a8455c]" : cmp.premium.delta < 0 ? "text-jade" : "text-ink-faint"}>
                  ({cmp.premium.delta > 0 ? "+" : "−"}
                  {Math.abs(cmp.premium.delta).toLocaleString("ko-KR")}원)
                </b>
              )}
            </p>
          </div>

          {/* 기둥 이동 — 새로 세워지는 기둥 · 제안 후에도 비어 있는 기둥 · 보험료 변화 */}
          {cpil && (
            <div data-pillar-cmp className="mt-3 rounded-lg border border-line-soft bg-[#fbfbf8] p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[12.5px] font-semibold text-ink">
                  보장 기둥 <span className="tabular-nums">{cpil.before.met}</span> →{" "}
                  <span className="tabular-nums">{cpil.after.met}</span>
                  <span className="font-normal text-ink-faint"> / {cpil.after.total}</span>
                </p>
                <b className={cpil.metDelta > 0 ? "text-jade" : cpil.metDelta < 0 ? "text-[#a8455c]" : "text-ink-faint"}>
                  ({cpil.metDelta > 0 ? "+" : cpil.metDelta < 0 ? "−" : ""}
                  {Math.abs(cpil.metDelta)})
                </b>
                <span className="text-[12px] text-ink-muted">
                  월 보험료 {won(cmp.premium.before)} → {won(cmp.premium.after)}
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] font-semibold text-jade">
                    새로 세워지는 기둥 <span className="tabular-nums">{cpil.built.length}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cpil.built.length ? (
                      cpil.built.map((i) => (
                        <span key={i.id} className="rounded bg-jade-soft px-1.5 py-0.5 text-[12px] font-semibold text-jade">
                          {i.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-ink-faint">없음 — 제안에 새로 들어간 담보가 기둥을 세우지 못했습니다</span>
                    )}
                  </div>
                  {cpil.filled.length > 0 && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                      부족에서 충족으로: {cpil.filled.map((i) => i.label).join(" · ")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#a8455c]">
                    제안 후에도 비어 있는 기둥 <span className="tabular-nums">{cpil.empty.length}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cpil.empty.slice(0, 12).map((i) => (
                      <span key={i.id} className="rounded bg-white px-1.5 py-0.5 text-[12px] text-ink-muted ring-1 ring-line">
                        {i.label}
                      </span>
                    ))}
                    {cpil.empty.length > 12 && <span className="text-[12px] text-ink-faint">외 {cpil.empty.length - 12}개</span>}
                  </div>
                </div>
              </div>
              {cpil.lost.length > 0 && (
                <p className="mt-2 text-[12px] text-[#8a6320]">약해지는 기둥: {cpil.lost.map((i) => i.label).join(" · ")}</p>
              )}
            </div>
          )}

          <div className="mt-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(44px,auto)_minmax(44px,auto)_minmax(54px,auto)] gap-x-1.5 border-b border-line pb-1 text-[12px] font-semibold text-ink-faint">
              <span>그룹</span>
              <span className="text-right">기존</span>
              <span className="text-right">제안</span>
              <span className="text-right">증감</span>
            </div>
              {cmp.groups
                .filter((g) => g.status !== "none")
                .map((g) => (
                  <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_minmax(44px,auto)_minmax(44px,auto)_minmax(54px,auto)] items-baseline gap-x-1.5 border-b border-line-soft py-1.5 text-[12px] last:border-0">
                    <span className="truncate text-ink">{g.label}</span>
                    <span className="text-right tabular-nums text-ink-muted">{g.before.count ? (g.before.lump ? man(g.before.lump) : "가입") : "—"}</span>
                    <span className="text-right tabular-nums text-ink-muted">{g.after.count ? (g.after.lump ? man(g.after.lump) : "가입") : "—"}</span>
                    <span
                      className={`text-right font-semibold tabular-nums ${
                        g.delta > 0 ? "text-jade" : g.delta < 0 ? "text-[#a8455c]" : "text-ink-faint"
                      }`}
                    >
                      {g.delta === 0 ? "—" : `${g.delta > 0 ? "+" : "−"}${man(Math.abs(g.delta))}`}
                    </span>
                  </div>
                ))}
          </div>
          <div className="mt-3 border-t border-line-soft pt-2">
            <p className="text-[12px] font-semibold text-ink">달라진 담보</p>
            <div className="mt-1 space-y-1">
              {cmp.rows
                .filter((r) => r.status !== "same")
                .slice(0, 12)
                .map((r) => (
                  <div key={r.name + r.status} className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[10.5px] font-semibold ${
                          r.status === "new"
                            ? "bg-jade-soft text-jade"
                            : r.status === "removed"
                              ? "bg-[#f6e7ea] text-[#a8455c]"
                              : r.status === "up"
                                ? "bg-brand-soft text-brand-deep"
                                : "bg-[#f6e7ea] text-[#a8455c]"
                        }`}
                      >
                        {r.status === "new" ? "신규" : r.status === "removed" ? "빠짐" : r.status === "up" ? "증액" : "감액"}
                      </span>
                      <span className="truncate text-ink">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums text-ink-muted">
                      {r.before ? man(r.before) : "—"} → {r.after ? man(r.after) : "—"}
                    </span>
                  </div>
                ))}
            </div>
            {cmp.rows.filter((r) => r.status !== "same").length > 12 && (
              <p className="mt-1 text-[12px] text-ink-faint">외 {cmp.rows.filter((r) => r.status !== "same").length - 12}건은 인쇄본에 담깁니다.</p>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            같은 이름의 담보를 짝지어 비교합니다. 이름이 다르면 새 담보·빠진 담보로 보이니, 표에서 이름을 맞춰 주세요.
          </p>
        </div>
      )}

      {/* ⑤ 저장 */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={printSheet}
          disabled={!summary.count}
          className="rounded-lg border border-ink bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-ink-soft disabled:opacity-40"
        >
          A4 요약 인쇄 · PDF
        </button>
        <button
          type="button"
          onClick={saveCard}
          disabled={!summary.count}
          className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:opacity-40"
        >
          요약 카드 PNG
        </button>
        <button
          type="button"
          onClick={saveBook}
          disabled={!summary.count}
          className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:opacity-40"
        >
          증권북형 HTML 저장
        </button>
        <button
          type="button"
          onClick={saveCSV}
          disabled={!summary.count}
          className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:opacity-40"
        >
          엑셀(CSV) 내보내기
        </button>
        <button
          type="button"
          onClick={copyMsg}
          disabled={!summary.count}
          className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:opacity-40"
        >
          {copied ? "복사했습니다" : "요약 문구 복사"}
        </button>
      </div>

      <Note>
        담보 이름을 기준으로 묶은 <b>참고용 정리</b>입니다. 그룹 구분은 보장분석 실무에서 쓰는 묶음이며 법정 기준이
        아닙니다. 실제 지급 여부·금액·면책은 가입 약관과 보험사 심사에 따릅니다. PDF는 이 브라우저 안에서 글자만
        뽑고, 파일과 입력값은 서버로 보내지 않습니다.
      </Note>

      <SaveResultCard
        title="보장분석 요약"
        subtitle={`${side === "before" ? "보유" : "제안"} 설계 · 담보 ${summary.count}건`}
        rows={[
          { label: "월 보험료", value: summary.premiumKnown ? won(summary.premium) : "확인 필요", sub: "담보 보험료 합" },
          {
            label: "암 진단비",
            value: summary.groups.find((g) => g.id === "cancer")?.lump ? man(summary.groups.find((g) => g.id === "cancer")!.lump) : "—",
          },
          { label: "확인할 점", value: `${summary.checks.filter((c) => c.level === "check").length}개` },
          { label: "실손", value: summary.silson.label ?? "확인 필요" },
        ]}
        notes={["담보 이름으로 묶은 참고용 정리입니다. 지급 여부·금액·면책은 약관과 보험사 심사에 따릅니다.", "파일과 입력값은 브라우저 안에서만 처리했습니다."]}
        fileBase="buffetkimz-보장분석"
      />

      <StickySummary
        items={[
          { label: "담보", value: `${summary.count}건` },
          { label: side === "before" ? "보유 보험료" : "제안 보험료", value: summary.premiumKnown ? won(summary.premium) : "확인 필요" },
          { label: "보장 기둥", value: `${pil.met} / ${pil.total}` },
          { label: "실손", value: summary.silson.label ?? "확인 필요" },
        ]}
      />
    </RunnerShell>
  );
}
