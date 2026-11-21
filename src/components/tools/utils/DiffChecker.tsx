import { useMemo, useState } from "react";
import { TextArea, UtilShell } from "./UtilShell";

/**
 * 두 글 비교(diff).
 *
 * 줄 단위로 LCS(최장 공통 부분수열)를 구해 같은 줄·바뀐 줄을 맞춰 놓고,
 * 짝지어진 바뀐 줄은 단어 단위로 다시 비교해 어느 단어가 들어오고 나갔는지 표시한다.
 * 한글은 띄어쓰기 단위가 아니라 Intl.Segmenter의 단어 경계로 나눈다(없으면 공백 기준).
 */

const SAMPLE_A = `보험은 가입할 때보다 청구할 때 어렵습니다.
실손보험은 세대마다 자기부담률이 달라서 같은 병원비라도 돌려받는 금액이 다릅니다.
4세대는 비중증 비급여 30%, 5세대는 50%를 내가 부담합니다.
보험료가 싸졌다는 말은, 내가 내는 돈이 줄었다는 뜻이 아닙니다.`;

const SAMPLE_B = `보험은 가입할 때보다 청구할 때 어렵습니다.
실손보험은 세대마다 자기부담률이 달라서 같은 병원비라도 돌려받는 금액이 다릅니다.
4세대는 비중증 비급여 30%, 5세대는 비중증 비급여 50%를 가입자가 부담합니다.
보험료가 낮아졌다는 말은, 내가 내는 돈이 줄었다는 뜻이 아닙니다.
그래서 보험을 볼 때는 보험료보다 자기부담금을 먼저 봐야 합니다.`;

type Kind = "same" | "change" | "del" | "add";
type Seg = { text: string; type: "same" | "del" | "add" };
type Side = { text: string; no: number };
type Row = { kind: Kind; left?: Side; right?: Side; leftSegs?: Seg[]; rightSegs?: Seg[] };

const MAX_LINES = 1200;

function tokens(line: string): string[] {
  const AnyIntl = Intl as unknown as {
    Segmenter?: new (locale?: string, opts?: { granularity: string }) => {
      segment: (input: string) => Iterable<{ segment: string }>;
    };
  };
  if (AnyIntl.Segmenter) {
    const seg = new AnyIntl.Segmenter("ko", { granularity: "word" });
    return Array.from(seg.segment(line), (s) => s.segment);
  }
  return line.match(/\s+|[^\s]+/g) ?? (line ? [line] : []);
}

/** 토큰 LCS — 좌(삭제)·우(추가) 조각을 같은 순서로 표시하기 위해 */
function wordDiff(a: string, b: string): { left: Seg[]; right: Seg[] } {
  const ta = tokens(a);
  const tb = tokens(b);
  const n = ta.length;
  const m = tb.length;
  if (n * m > 40000) {
    return { left: [{ text: a, type: "del" }], right: [{ text: b, type: "add" }] };
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = ta[i] === tb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: Seg[] = [];
  const right: Seg[] = [];
  const push = (arr: Seg[], text: string, type: Seg["type"]) => {
    if (!text) return;
    const last = arr[arr.length - 1];
    if (last && last.type === type) last.text += text;
    else arr.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i] === tb[j]) {
      push(left, ta[i], "same");
      push(right, tb[j], "same");
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(left, ta[i], "del");
      i += 1;
    } else {
      push(right, tb[j], "add");
      j += 1;
    }
  }
  while (i < n) push(left, ta[i++], "del");
  while (j < m) push(right, tb[j++], "add");
  return { left, right };
}

export function diffLines(textA: string, textB: string): { rows: Row[]; truncated: boolean } {
  const rawA = textA.replace(/\r\n/g, "\n").split("\n");
  const rawB = textB.replace(/\r\n/g, "\n").split("\n");
  const truncated = rawA.length > MAX_LINES || rawB.length > MAX_LINES;
  const a = rawA.slice(0, MAX_LINES);
  const b = rawB.slice(0, MAX_LINES);
  const n = a.length;
  const m = b.length;

  const dp = new Uint16Array((n + 1) * (m + 1));
  const W = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] =
        a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    }
  }

  type Op = { type: "same" | "del" | "add"; text: string; no: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", text: a[i], no: i + 1 });
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) {
      ops.push({ type: "del", text: a[i], no: i + 1 });
      i += 1;
    } else {
      ops.push({ type: "add", text: b[j], no: j + 1 });
      j += 1;
    }
  }
  while (i < n) ops.push({ type: "del", text: a[i], no: ++i });
  while (j < m) ops.push({ type: "add", text: b[j], no: ++j });

  const rows: Row[] = [];
  let dels: Op[] = [];
  let adds: Op[] = [];
  const flush = () => {
    const pairs = Math.min(dels.length, adds.length);
    for (let k = 0; k < pairs; k++) {
      const d = dels[k];
      const ad = adds[k];
      const w = wordDiff(d.text, ad.text);
      rows.push({
        kind: "change",
        left: { text: d.text, no: d.no },
        right: { text: ad.text, no: ad.no },
        leftSegs: w.left,
        rightSegs: w.right,
      });
    }
    for (let k = pairs; k < dels.length; k++) {
      rows.push({ kind: "del", left: { text: dels[k].text, no: dels[k].no } });
    }
    for (let k = pairs; k < adds.length; k++) {
      rows.push({ kind: "add", right: { text: adds[k].text, no: adds[k].no } });
    }
    dels = [];
    adds = [];
  };

  for (const op of ops) {
    if (op.type === "del") dels.push(op);
    else if (op.type === "add") adds.push(op);
    else {
      flush();
      rows.push({ kind: "same", left: { text: op.text, no: op.no }, right: { text: op.text, no: op.no } });
    }
  }
  flush();
  return { rows, truncated };
}

function Cell({ side, segs, tone }: { side?: Side; segs?: Seg[]; tone: "left" | "right" }) {
  if (!side) return <div className="min-h-[26px] border-b border-line-soft bg-[#f7f7f4]" />;
  const base = tone === "left" ? "bg-[#fdf3f5]" : "bg-[#f0f8f3]";
  const markDel = "bg-[#f4c9d3] text-[#7b2740]";
  const markAdd = "bg-[#c6e6d5] text-[#12604a]";
  return (
    <div className={`flex min-h-[26px] items-start gap-2 border-b border-line-soft px-2 py-1 ${segs ? base : ""}`}>
      <span className="w-7 shrink-0 select-none text-right text-[11px] leading-[1.7] tabular-nums text-ink-faint">
        {side.no}
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words text-[12px] leading-[1.7] text-ink">
        {segs
          ? segs.map((s, i) => (
              <span
                key={i}
                className={
                  s.type === "same" ? undefined : s.type === "del" ? `rounded-[2px] ${markDel}` : `rounded-[2px] ${markAdd}`
                }
              >
                {s.text}
              </span>
            ))
          : side.text || " "}
      </span>
    </div>
  );
}

export default function DiffChecker() {
  const [a, setA] = useState(SAMPLE_A);
  const [b, setB] = useState(SAMPLE_B);
  const [onlyChanged, setOnlyChanged] = useState(false);

  const { rows, truncated } = useMemo(() => diffLines(a, b), [a, b]);
  const stats = useMemo(() => {
    const s = { same: 0, change: 0, del: 0, add: 0 };
    for (const r of rows) s[r.kind] += 1;
    return s;
  }, [rows]);
  const total = rows.length || 1;
  const shown = onlyChanged ? rows.filter((r) => r.kind !== "same") : rows;
  const identical = a === b;

  return (
    <UtilShell
      id="diff-checker"
      title="두 글 비교"
      subtitle="원문과 수정본을 나란히 놓고 바뀐 줄·단어를 색으로 표시합니다."
    >
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <TextArea label="원문 A" value={a} onChange={setA} rows={8} hint={`${a.split("\n").length}줄`} />
        <TextArea label="수정본 B" value={b} onChange={setB} rows={8} hint={`${b.split("\n").length}줄`} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setA(b);
            setB(a);
          }}
          className="min-h-[36px] rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
        >
          A ↔ B 바꾸기
        </button>
        <button
          type="button"
          onClick={() => {
            setA(SAMPLE_A);
            setB(SAMPLE_B);
          }}
          className="min-h-[36px] rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
        >
          예시
        </button>
        <button
          type="button"
          aria-pressed={onlyChanged}
          onClick={() => setOnlyChanged((v) => !v)}
          className={
            "min-h-[36px] rounded-full px-3 text-[12px] font-semibold " +
            (onlyChanged
              ? "border border-brand/45 bg-brand-soft text-brand-deep"
              : "border border-line bg-white text-ink-soft")
          }
        >
          바뀐 줄만 보기
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5" data-diff-stats>
          <span className="inline-flex min-h-[26px] items-center rounded-full border border-[#e0c3cd] bg-[#fdf3f5] px-2.5 text-[12px] font-semibold text-[#8c3b52]">
            삭제·변경 −{stats.del + stats.change}
          </span>
          <span className="inline-flex min-h-[26px] items-center rounded-full border border-[#bfe0cf] bg-[#f0f8f3] px-2.5 text-[12px] font-semibold text-[#12604a]">
            추가·변경 +{stats.add + stats.change}
          </span>
          <span className="inline-flex min-h-[26px] items-center rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-muted">
            동일 {stats.same}
          </span>
        </div>
      </div>

      {identical ? (
        <div className="mt-3 rounded-xl border border-line bg-white px-3.5 py-6 text-center text-[13px] text-ink-muted">
          두 글이 같습니다. 한쪽을 고치면 바뀐 곳이 표시됩니다.
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-[#f7f8f6] px-2 py-1.5">
              <span className="text-[12px] font-bold text-ink-soft">원문 A</span>
              <span className="mono text-[11px] text-ink-faint">일치 {Math.round((stats.same / total) * 100)}%</span>
              <span className="text-[12px] font-bold text-ink-soft">수정본 B</span>
            </div>
            <div className="max-h-[460px] overflow-auto" data-diff-table>
              <div className="grid min-w-[520px] grid-cols-2">
                {shown.length === 0 ? (
                  <p className="col-span-2 px-3 py-6 text-center text-[12.5px] text-ink-muted">바뀐 줄이 없습니다.</p>
                ) : (
                  shown.map((r, i) => (
                    <div key={i} className="col-span-2 grid grid-cols-2 border-b border-line-soft last:border-b-0">
                      <Cell side={r.left} segs={r.leftSegs} tone="left" />
                      <Cell side={r.right} segs={r.rightSegs} tone="right" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            {truncated
              ? `줄이 너무 많아 앞 ${MAX_LINES}줄까지만 비교했습니다.`
              : "줄이 바뀐 곳은 줄 전체를, 짝지어진 줄은 바뀐 단어만 색으로 표시합니다. 빈 칸은 그 줄이 한쪽에만 있다는 뜻입니다."}
          </p>
        </>
      )}
    </UtilShell>
  );
}
