import { useMemo, useState } from "react";
import { Segmented } from "../ui";
import { CopyButton, OutputBox, StatTile, TextArea, UtilShell } from "./UtilShell";

/**
 * 글자수·바이트·원고지·스레드 분할.
 *
 * 스레드(Threads)는 한 편 500자, X는 280자, 인스타그램 캡션은 2,200자가 기준이다.
 * 분할은 문장(마침표·줄바꿈) 단위로 끊고, 한 문장이 한도를 넘으면 쉼표·공백 순으로 자른다.
 * 글자 수는 유니코드 문자(코드 포인트) 기준 — 이모지를 2자로 세지 않는다.
 */

const SAMPLE = `보험은 가입할 때보다 청구할 때 어렵습니다.
실손보험은 세대마다 자기부담률이 달라서, 같은 병원비라도 돌려받는 금액이 다릅니다.
4세대는 비중증 비급여 30%, 5세대는 50%를 내가 부담합니다.

그래서 보험을 볼 때는 '보험료'보다 '내가 내는 돈'을 먼저 봐야 합니다.
같은 보장이라도 내 통장에서 나가는 돈이 다르면, 그 보험은 다른 보험입니다.`;

type Limit = "500" | "280" | "2200";
const LIMITS: { value: Limit; label: string; note: string }[] = [
  { value: "500", label: "스레드 500자", note: "Threads 한 편 기준" },
  { value: "280", label: "X 280자", note: "X(트위터) 한 편 기준" },
  { value: "2200", label: "인스타 2,200자", note: "인스타그램 캡션 기준" },
];

const chars = (s: string) => Array.from(s).length;
const utcBytes = (s: string) => new TextEncoder().encode(s).length;

/** 문장 토큰 — 마침표·물음표·느낌표·줄바꿈 뒤에서 끊는다 */
function sentenceTokens(text: string): string[] {
  const out: string[] = [];
  const re = /[^\n.!?。！？]+[.!?。！？]*[ \t]*|\n+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0]) out.push(m[0]);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

/** 한도보다 긴 덩어리 — 공백 → 쉼표 → 글자 순으로 자른다 */
function hardSplit(token: string, limit: number): string[] {
  const out: string[] = [];
  let rest = token;
  while (chars(rest) > limit) {
    const slice = Array.from(rest).slice(0, limit).join("");
    const cutSpace = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
    const cutComma = Math.max(slice.lastIndexOf(","), slice.lastIndexOf("·"));
    const cut = cutSpace > limit * 0.5 ? cutSpace + 1 : cutComma > limit * 0.5 ? cutComma + 1 : -1;
    const take = cut > 0 ? Array.from(slice).slice(0, cut).join("") : slice;
    out.push(take);
    rest = rest.slice(take.length).replace(/^[ \t]+/, "");
  }
  if (rest) out.push(rest);
  return out;
}

export function splitThread(text: string, limit: number, numbering: boolean): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const budget = numbering ? limit - 6 : limit;
  if (chars(clean) <= budget) return numbering ? [`1/1 ${clean}`] : [clean];

  const chunks: string[] = [];
  let current = "";
  for (const token of sentenceTokens(clean)) {
    if (chars(token) > budget) {
      if (current.trim()) chunks.push(current.trim());
      current = "";
      const parts = hardSplit(token, budget);
      for (let i = 0; i < parts.length - 1; i++) chunks.push(parts[i].trim());
      current = parts[parts.length - 1] ?? "";
      continue;
    }
    if (chars(current + token) <= budget) {
      current += token;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = token;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return numbering ? chunks.map((c, i) => `${i + 1}/${chunks.length} ${c}`) : chunks;
}

export default function TextCounter() {
  const [text, setText] = useState(SAMPLE);
  const [limit, setLimit] = useState<Limit>("500");
  const [numbering, setNumbering] = useState(false);

  const stats = useMemo(() => {
    const withSpace = chars(text);
    const withoutSpace = chars(text.replace(/\s/g, ""));
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.trim() ? text.replace(/\r\n/g, "\n").split("\n").length : 0;
    return {
      withSpace,
      withoutSpace,
      words,
      lines,
      bytes: utcBytes(text),
      sheets: Math.ceil(withoutSpace / 200),
    };
  }, [text]);

  const limitNum = Number(limit);
  const chunks = useMemo(() => splitThread(text, limitNum, numbering), [text, limitNum, numbering]);
  const overLimit = stats.withSpace > limitNum;
  const meta = LIMITS.find((l) => l.value === limit) ?? LIMITS[0];

  return (
    <UtilShell
      id="text-counter"
      title="글자수·바이트·스레드 분할"
      subtitle="쓴 글의 분량을 세고, 스레드 한도를 넘으면 문장 단위로 나눠 줍니다."
    >
      <div className="grid gap-4 md:grid-cols-[1.25fr_1fr] md:gap-5">
        <div>
          <TextArea
            label="글 입력"
            value={text}
            onChange={setText}
            rows={12}
            hint={`${meta.note} · 공백 포함 ${stats.withSpace.toLocaleString("ko-KR")}자 / ${limitNum}자`}
            right={
              <span
                className={
                  "mono text-[12px] font-bold tabular-nums " + (overLimit ? "text-clay" : "text-jade")
                }
                data-counter-ratio
              >
                {stats.withSpace.toLocaleString("ko-KR")} / {limitNum.toLocaleString("ko-KR")}
              </span>
            }
          />
        </div>

        <div>
          <div className="grid grid-cols-2 gap-2.5" data-counter-stats>
            <StatTile label="공백 포함" value={`${stats.withSpace.toLocaleString("ko-KR")}자`} tone="brand" />
            <StatTile label="공백 제외" value={`${stats.withoutSpace.toLocaleString("ko-KR")}자`} />
            <StatTile label="단어" value={`${stats.words.toLocaleString("ko-KR")}개`} sub={`${stats.lines}줄`} />
            <StatTile
              label="UTF-8 바이트"
              value={`${stats.bytes.toLocaleString("ko-KR")}B`}
              sub={`한글 1자 = 3B`}
            />
            <StatTile
              label="200자 원고지"
              value={`${stats.sheets}매`}
              sub={`공백 제외 ${stats.withoutSpace.toLocaleString("ko-KR")}자 ÷ 200, 올림`}
              tone="jade"
            />
            <StatTile
              label="스레드 여유"
              value={overLimit ? `${(stats.withSpace - limitNum).toLocaleString("ko-KR")}자 초과` : `${(limitNum - stats.withSpace).toLocaleString("ko-KR")}자`}
              sub={overLimit ? `${chunks.length}편으로 나눕니다` : "한 편에 담깁니다"}
            />
          </div>

          <div className="mt-3 rounded-xl border border-line bg-white p-3">
            <Segmented
              label="나눌 기준"
              value={limit}
              onChange={setLimit}
              options={LIMITS.map((l) => ({ value: l.value, label: l.label }))}
            />
            <label className="mt-1 flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[12.5px] font-semibold text-ink-soft">
              <input
                type="checkbox"
                checked={numbering}
                onChange={(e) => setNumbering(e.target.checked)}
                className="h-4 w-4 accent-[#1233b8]"
              />
              각 편에 <span className="mono">1/4</span> 번호 붙이기 (번호 자리만큼 5자 확보)
            </label>
            <p className="mt-1 border-t border-line-soft pt-2 text-[12px] leading-relaxed text-ink-faint">
              글자 수는 유니코드 문자 기준입니다. 원고지 매수는 공백 제외 글자수를 200으로 나눠 올림하며, 빈 줄은 세지
              않습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5" data-thread-list>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="field-label">나눈 결과 {chunks.length}편</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              편마다 복사해 순서대로 올리면 됩니다. 문장 중간에서 끊기지 않게 나눴습니다.
            </p>
          </div>
          <CopyButton
            label="전체 복사"
            text={chunks.join(numbering ? "\n\n" : "\n\n---\n\n")}
            disabled={chunks.length === 0}
          />
        </div>

        {chunks.length === 0 ? (
          <div className="mt-2.5">
            <OutputBox text="" empty="왼쪽에 글을 입력하면 여기에 나뉜 편이 나옵니다." />
          </div>
        ) : (
          <ol className="mt-2.5 space-y-2.5">
            {chunks.map((chunk, i) => (
              <li key={i} className="rounded-xl border border-line bg-white p-3" data-thread-item={i + 1}>
                <div className="flex items-center justify-between gap-2">
                  <span className="chip !min-h-[26px] !px-2 !text-[12px]">
                    {i + 1} / {chunks.length}
                  </span>
                  <span className="mono text-[12px] tabular-nums text-ink-faint">
                    {chars(chunk).toLocaleString("ko-KR")}자
                  </span>
                  <CopyButton small text={chunk} label="이 편 복사" />
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-ink">{chunk}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </UtilShell>
  );
}
