import { useMemo, useState } from "react";
import { CopyButton, OutputBox, TextArea, UtilShell } from "./UtilShell";

/**
 * 개인정보 마스킹 — 붙여넣은 글에서 전화번호·주민등록번호·계좌번호·이메일·카드번호를 찾아
 * 가운데를 *로 가린 사본을 만든다.
 *
 * 탐지는 정규식 패턴이다. 이름·주소·생년월일처럼 패턴이 없는 정보는 잡지 못하므로,
 * "가려졌다"가 아니라 "패턴에 걸린 것을 가렸다"로 읽어야 한다.
 * 원문은 화면 상태로만 들고 있고 어디에도 저장하지 않는다.
 */

type Kind = "email" | "rrn" | "card" | "phone" | "account";

const KIND_LABEL: Record<Kind, string> = {
  email: "이메일",
  rrn: "주민등록번호",
  card: "카드번호",
  phone: "전화번호",
  account: "계좌번호",
};

const KIND_TONE: Record<Kind, string> = {
  email: "bg-[#eef4fb] text-[#2c5e8f] border-[#cfdfef]",
  rrn: "bg-[#fbf0ea] text-[#8a4a2e] border-[#e8d3c6]",
  card: "bg-[#f6eefb] text-[#6d3f88] border-[#ddcfe8]",
  phone: "bg-[#eef7f2] text-[#1f6b52] border-[#cbe3d8]",
  account: "bg-[#f7f4ea] text-[#7a6420] border-[#e4dcc2]",
};

/** 순서가 곧 우선순위 — 앞의 패턴이 잡은 구간은 뒤 패턴이 다시 잡지 않는다 */
const PATTERNS: { kind: Kind; re: RegExp }[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g },
  { kind: "rrn", re: /\b\d{6}[-\s]?[1-8]\d{6}\b/g },
  { kind: "card", re: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { kind: "phone", re: /\b(?:01[016789]|0(?:2|[3-6][1-5])|1[5-8]\d{2})[-\s]?\d{3,4}[-\s]?\d{4}\b/g },
  { kind: "account", re: /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}\b|\b\d{10,16}\b/g },
];

type Found = { kind: Kind; raw: string; start: number; end: number; masked: string };

/** 첫 묶음에 든 숫자 개수 — 02-345-6789의 '02'처럼 지역번호는 남긴다 */
function firstGroupDigits(raw: string): number {
  const groups = raw.split(/[-\s]+/);
  return (groups[0]?.match(/\d/g) ?? []).length;
}

/** 숫자를 자리별로 남기거나 가린다 — 하이픈·공백은 그대로 둔다 */
function maskDigits(raw: string, keep: (index: number, total: number) => boolean): string {
  const total = (raw.match(/\d/g) ?? []).length;
  let i = 0;
  return raw.replace(/\d/g, (d) => {
    const keepIt = keep(i, total);
    i += 1;
    return keepIt ? d : "*";
  });
}

function maskOne(kind: Kind, raw: string): string {
  if (kind === "email") {
    const [local, domain] = raw.split("@");
    const head = Array.from(local);
    const keep = head.length >= 3 ? 2 : 1;
    return `${head.slice(0, keep).join("")}${"*".repeat(Math.max(3, head.length - keep))}@${domain}`;
  }
  if (kind === "rrn") {
    /* 900101-1****** — 생년월일과 성별 자리 한 개만 남긴다 */
    return maskDigits(raw, (i) => i < 7);
  }
  if (kind === "card") {
    /* 1234-****-****-5678 — 앞 4자리와 뒤 4자리만 */
    return maskDigits(raw, (i, total) => i < 4 || i >= total - 4);
  }
  if (kind === "phone") {
    const head = firstGroupDigits(raw);
    return maskDigits(raw, (i, total) => i < head || i >= total - 4);
  }
  /* 계좌번호 — 앞 묶음과 끝 3자리만. 은행 앱 표기와 같은 방식 */
  const head = firstGroupDigits(raw);
  return maskDigits(raw, (i, total) => i < head || i >= total - 3);
}

export function findSensitive(text: string): Found[] {
  const found: Found[] = [];
  const taken: { start: number; end: number }[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = taken.some((t) => start < t.end && end > t.start);
      if (!overlaps) {
        found.push({ kind, raw: m[0], start, end, masked: maskOne(kind, m[0]) });
        taken.push({ start, end });
      }
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

const SAMPLE = `[상담 접수]
고객명: 김민수
연락처: 010-1234-5678 (오후 통화 가능)
이메일: minsu.kim@gmail.com
주민등록번호: 900101-1234567
결제 카드: 1234-5678-9012-3456
환급 계좌: 110-123-456789 (농협)
사무실: 02-345-6789`;

export default function PrivacyMasker() {
  const [text, setText] = useState(SAMPLE);
  const [showOriginal, setShowOriginal] = useState(true);

  const found = useMemo(() => findSensitive(text), [text]);
  const masked = useMemo(() => {
    if (found.length === 0) return text;
    let out = "";
    let cursor = 0;
    for (const f of found) {
      out += text.slice(cursor, f.start) + f.masked;
      cursor = f.end;
    }
    return out + text.slice(cursor);
  }, [text, found]);

  const counts = useMemo(() => {
    const map = new Map<Kind, number>();
    for (const f of found) map.set(f.kind, (map.get(f.kind) ?? 0) + 1);
    return [...map.entries()];
  }, [found]);

  /** 원문에서 잡힌 구간을 색으로 표시한 조각들 */
  const segments = useMemo(() => {
    const out: { text: string; kind?: Kind }[] = [];
    let cursor = 0;
    for (const f of found) {
      if (f.start > cursor) out.push({ text: text.slice(cursor, f.start) });
      out.push({ text: text.slice(f.start, f.end), kind: f.kind });
      cursor = f.end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor) });
    return out;
  }, [text, found]);

  return (
    <UtilShell
      id="privacy-masker"
      title="개인정보 가리기"
      subtitle="글 안의 전화번호·주민번호·계좌·이메일·카드번호를 찾아 *로 가린 사본을 만듭니다."
      note={
        <>
          가린 사본은 <strong className="font-semibold text-ink">이 브라우저 안에서만</strong> 만들어집니다. 원문을
          서버로 보내지 않고 저장하지도 않습니다. 다만 탐지는 패턴 규칙이라 이름·주소는 잡지 못합니다 — 보내기 전에
          한 번 더 눈으로 확인하세요.
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div>
          <TextArea
            label="원문 붙여넣기"
            value={text}
            onChange={setText}
            rows={13}
            placeholder="가릴 내용이 담긴 글을 붙여넣으세요."
            hint={`줄 ${text ? text.split("\n").length : 0}개 · 글자 ${text.length.toLocaleString("ko-KR")}자`}
            right={
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setText(SAMPLE)}
                  className="min-h-[32px] rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
                >
                  예시
                </button>
                <button
                  type="button"
                  onClick={() => setText("")}
                  className="min-h-[32px] rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
                >
                  지우기
                </button>
              </div>
            }
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5" data-mask-counts>
            <span className="text-[12px] font-semibold text-ink-faint">탐지</span>
            {counts.length === 0 ? (
              <span className="chip !min-h-[26px] !text-[12px]">패턴에 걸린 항목 없음</span>
            ) : (
              counts.map(([kind, n]) => (
                <span
                  key={kind}
                  className={`inline-flex min-h-[26px] items-center gap-1 rounded-full border px-2.5 text-[12px] font-semibold ${KIND_TONE[kind]}`}
                  data-mask-kind={kind}
                >
                  {KIND_LABEL[kind]} {n}
                </span>
              ))
            )}
            <span className="ml-auto text-[12px] text-ink-muted" data-mask-total={found.length}>
              모두 {found.length}건
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="field-label">가린 사본</p>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                앞뒤 몇 자리만 남깁니다 — 확인은 되고, 그대로는 쓸 수 없게.
              </p>
            </div>
            <CopyButton label="가린 글 복사" text={masked} disabled={!masked} />
          </div>
          <div className="mt-1.5">
            <OutputBox text={masked} maxHeight={300} empty="원문을 붙여넣으면 가린 사본이 여기에 나옵니다." />
          </div>

          <div className="mt-3 rounded-xl border border-line bg-white">
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3.5 text-[12.5px] font-semibold text-ink-soft">
              원문에서 잡힌 위치 보기
              <input
                type="checkbox"
                checked={showOriginal}
                onChange={(e) => setShowOriginal(e.target.checked)}
                className="h-4 w-4 accent-[#1233b8]"
              />
            </label>
            {showOriginal && (
              <div className="border-t border-line-soft px-3.5 py-2.5 text-[12.5px] leading-[1.8] text-ink" data-mask-highlight>
                {text ? (
                  <p className="whitespace-pre-wrap break-words">
                    {segments.map((s, i) =>
                      s.kind ? (
                        <mark
                          key={i}
                          className={`rounded px-0.5 font-semibold ${KIND_TONE[s.kind]}`}
                          title={`${KIND_LABEL[s.kind]}로 탐지`}
                        >
                          {s.text}
                        </mark>
                      ) : (
                        <span key={i}>{s.text}</span>
                      )
                    )}
                  </p>
                ) : (
                  <p className="text-ink-faint">표시할 원문이 없습니다.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-line bg-[#fbfcfa] px-3.5 py-3 text-[12px] leading-[1.7] text-ink-muted">
            <p className="font-semibold text-ink">가리는 방식</p>
            <ul className="mt-1 space-y-0.5">
              <li>· 주민등록번호 <span className="mono">900101-1******</span> — 생년월일·성별 자리만</li>
              <li>· 카드번호 <span className="mono">1234-****-****-3456</span> — 앞뒤 4자리만</li>
              <li>· 전화번호 <span className="mono">010-****-5678</span> — 지역번호·끝 4자리만</li>
              <li>· 계좌번호 <span className="mono">110-***-***789</span> — 앞 묶음·끝 3자리만</li>
              <li>· 이메일 <span className="mono">mi***@gmail.com</span> — 아이디 앞 2자만</li>
            </ul>
            <p className="mt-1.5 text-ink-faint">
              외국인등록번호·법인번호처럼 13자리 규칙이 다른 번호, 이름·주소·차량번호는 잡지 못합니다.
            </p>
          </div>
        </div>
      </div>
    </UtilShell>
  );
}
