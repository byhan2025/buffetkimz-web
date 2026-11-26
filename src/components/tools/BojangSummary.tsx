import { useMemo, useRef, useState } from "react";
import {
  GROUPS,
  SAMPLES,
  buildMessage,
  compare,
  formatMan,
  parseAmount,
  readDocument,
  summarize,
  type Coverage,
  type GroupId,
  type Summary,
} from "@/lib/bojang/engine";
import { Note, ResultStat, RunnerShell, Segmented, StickySummary } from "./ui";

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
      <span className="mb-1 block text-[11.5px] text-ink-faint">{label}</span>
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

function buildPrintHTML(summary: Summary, cmp: ReturnType<typeof compare> | null, name: string): string {
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
  .foot { margin-top: 14px; border-top: 1px solid #dde3e8; padding-top: 6px; color: #55626e; font-size: 9.5px; line-height: 1.45; }
</style></head><body>
<h1>보장 정리 요약${name ? ` · ${esc(name)}` : ""}</h1>
<div class="sub">기준일 ${esc(new Date().toLocaleDateString("ko-KR"))} · buffetkimz.com · 참고용 정리</div>

<div class="hero">
  <div><span>담보</span><b>${summary.count}건</b></div>
  <div><span>월 보험료</span><b>${summary.premiumKnown ? esc(won(summary.premium)) : "확인 필요"}</b></div>
  <div><span>실손 세대</span><b>${summary.silson.label ? esc(summary.silson.label) : "확인 필요"}</b></div>
  <div><span>확인할 점</span><b>${summary.checks.filter((c) => c.level === "check").length}개</b></div>
</div>

<h2>보장 그룹 요약</h2>
<table><thead><tr><th>그룹</th><th class="r">정액(진단·수술)</th><th class="r">일당</th><th class="r">건수</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4">정리된 담보가 없습니다.</td></tr>`}</tbody></table>
${missing.length ? `<p>표에서 찾지 못한 기본 항목: ${esc(missing.join(", "))} — 증권 원문에서 확인하세요.</p>` : ""}

${
  cmp
    ? `<h2>기존 · 제안 비교</h2>
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cur = sides[side];

  const summary = useMemo(
    () => summarize(cur.rows, { label: side === "before" ? "보유" : "제안", premium: cur.premium }),
    [cur.rows, cur.premium, side],
  );
  const both = sides.before.rows.length && sides.after.rows.length;
  const cmp = useMemo(() => (both ? compare(sides.before.rows, sides.after.rows) : null), [both, sides.before.rows, sides.after.rows]);

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

  const patchRow = (i: number, patch: Partial<Coverage>) => {
    setSideState(side, { rows: cur.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
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
          tags: [],
          amount: null,
          rate: "",
          premium: null,
          insurer: "",
          product: "",
          startDate: "",
          term: "",
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
    const html = buildPrintHTML(summary, cmp, name.trim());
    const w = window.open("", "_blank", "width=920,height=1200");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
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
      `기준일 ${new Date().toLocaleDateString("ko-KR")} · buffetkimz.com`,
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

  return (
    <RunnerShell
      title="보장분석 요약기"
      subtitle="증권·설계서의 담보를 그룹으로 정리하고, 기존과 제안 설계를 나란히 비교합니다."
      example="PDF를 올리거나 담보 목록을 붙여넣으면 그 자리에서 다시 정리합니다. 표의 이름·금액을 고치면 요약이 바로 바뀝니다."
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
          <span className="text-[11.5px] text-ink-faint">
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
              담보 {cur.rows.length}건 <span className="font-normal text-ink-faint">— 이름·그룹·금액을 고칠 수 있습니다</span>
            </p>
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink"
            >
              + 담보 추가
            </button>
          </div>
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
                    <span className="mb-1 block text-[11.5px] text-ink-faint">그룹</span>
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
                      <span className="mb-1 block text-[11.5px] text-ink-faint">지급 비율</span>
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
                {r.confidence !== "high" && (
                  <p className="mt-1.5 text-[11.5px] text-[#8a6320]">
                    {r.group === "etc" ? "그룹을 확인해 주세요" : r.amount == null && r.kind !== "limit" ? "가입금액을 읽지 못했습니다" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ③ 요약 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResultStat label="담보" value={`${summary.count}건`} sub={summary.silson.label ? `실손 ${summary.silson.label}` : "실손 세대 확인 필요"} />
        <ResultStat
          label="월 보험료"
          value={summary.premiumKnown ? won(summary.premium) : "확인 필요"}
          sub={summary.premiumKnown ? "담보 보험료 합" : "합계 줄이나 담보별 보험료를 넣어 주세요"}
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
                  <span className="w-8 text-right text-[11.5px] tabular-nums text-ink-faint">{g.count ? `${g.count}건` : ""}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
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
          <div className="mt-2">
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(44px,auto)_minmax(44px,auto)_minmax(54px,auto)] gap-x-1.5 border-b border-line pb-1 text-[11px] font-semibold text-ink-faint">
                <span>그룹</span>
                <span className="text-right">기존</span>
                <span className="text-right">제안</span>
                <span className="text-right">증감</span>
              </div>
              {cmp.groups
                .filter((g) => g.status !== "none")
                .map((g) => (
                  <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_minmax(44px,auto)_minmax(44px,auto)_minmax(54px,auto)] items-baseline gap-x-1.5 border-b border-line-soft py-1.5 text-[11.5px] last:border-0">
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
              <p className="mt-1 text-[11.5px] text-ink-faint">외 {cmp.rows.filter((r) => r.status !== "same").length - 12}건은 인쇄본에 담깁니다.</p>
            )}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
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

      <StickySummary
        items={[
          { label: "담보", value: `${summary.count}건` },
          { label: side === "before" ? "보유 보험료" : "제안 보험료", value: summary.premiumKnown ? won(summary.premium) : "확인 필요" },
          { label: "실손", value: summary.silson.label ?? "확인 필요" },
        ]}
      />
    </RunnerShell>
  );
}
