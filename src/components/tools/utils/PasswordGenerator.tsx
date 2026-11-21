import { useEffect, useMemo, useState } from "react";
import { Toggle } from "../ui";
import { CopyButton, UtilShell } from "./UtilShell";

/**
 * 비밀번호 생성.
 *
 * 난수는 crypto.getRandomValues로 뽑고(편향이 없도록 버리는 표본 방식), 고른 문자 종류마다
 * 최소 한 글자가 반드시 들어가게 만든 뒤 섞는다. 강도는 가능한 조합 수의 로그(엔트로피)로만
 * 계산한 이론값이다 — 사람이 고른 비밀번호의 실제 안전성은 이 값보다 낮다.
 */

const SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digit: "0123456789",
  symbol: "!@#$%^&*()-_=+[]{};:,.?/",
} as const;

type SetKey = keyof typeof SETS;
const SIMILAR = new Set(["I", "l", "1", "O", "0", "o", "|", "`", "'", '"']);

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

function poolOf(keys: SetKey[], excludeSimilar: boolean): string {
  let pool = keys.map((k) => SETS[k]).join("");
  if (excludeSimilar) pool = Array.from(pool).filter((c) => !SIMILAR.has(c)).join("");
  return pool;
}

export function generatePassword(length: number, keys: SetKey[], excludeSimilar: boolean): string {
  const pool = poolOf(keys, excludeSimilar);
  if (!pool || length < 1) return "";
  const chars: string[] = [];
  /* 종류마다 한 글자씩 먼저 넣는다 — '소문자만 있는데 대문자 옵션 켬' 같은 결과를 막는다 */
  for (const k of keys) {
    const set = Array.from(SETS[k]).filter((c) => !excludeSimilar || !SIMILAR.has(c));
    if (set.length > 0 && chars.length < length) chars.push(set[randomIndex(set.length)]);
  }
  while (chars.length < length) chars.push(pool[randomIndex(pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const LEVELS = [
  { label: "매우 약함", cls: "text-clay", bg: "bg-[#b1637a]" },
  { label: "약함", cls: "text-clay", bg: "bg-[#c08a4a]" },
  { label: "보통", cls: "text-amber", bg: "bg-[#c9a227]" },
  { label: "강함", cls: "text-jade", bg: "bg-[#2f8f6f]" },
  { label: "매우 강함", cls: "text-brand", bg: "bg-brand" },
];

function levelOf(bits: number): number {
  if (bits < 40) return 0;
  if (bits < 60) return 1;
  if (bits < 80) return 2;
  if (bits < 110) return 3;
  return 4;
}

/** 1초에 1,000억 번 대입한다고 가정한 평균 소요 시간(2^bits / 2) */
function crackTime(bits: number): string {
  const seconds = Math.pow(2, bits) / 2 / 1e11;
  if (seconds < 1) return "1초 안";
  if (seconds < 60) return `${Math.round(seconds)}초`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}시간`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)}일`;
  const years = seconds / 31536000;
  if (years < 10000) return `${Math.round(years).toLocaleString("ko-KR")}년`;
  if (years < 1e8) return `${Math.round(years / 1e4).toLocaleString("ko-KR")}만 년`;
  return `약 ${Math.round(years / 1e8).toLocaleString("ko-KR")}억 년`;
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [enabled, setEnabled] = useState<Record<SetKey, boolean>>({
    upper: true,
    lower: true,
    digit: true,
    symbol: true,
  });
  const [excludeSimilar, setExcludeSimilar] = useState(true);
  const [nonce, setNonce] = useState(0);
  /* 서버 렌더와 브라우저 렌더가 같은 글자를 그리도록, 난수는 화면이 붙은 뒤에 만든다 */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const keys = (Object.keys(SETS) as SetKey[]).filter((k) => enabled[k]);
  const pool = poolOf(keys, excludeSimilar);
  const possible = pool.length > 0 && length >= 4;
  const keySig = keys.join("");

  const main = useMemo(
    () => (mounted && possible ? generatePassword(length, keys, excludeSimilar) : ""),
    [length, keySig, excludeSimilar, nonce, possible, mounted]
  );
  const list = useMemo(
    () => (mounted && possible ? Array.from({ length: 5 }, () => generatePassword(length, keys, excludeSimilar)) : []),
    [length, keySig, excludeSimilar, nonce, possible, mounted]
  );

  const bits = pool.length > 0 ? length * Math.log2(pool.length) : 0;
  const level = levelOf(bits);

  return (
    <UtilShell
      id="password-generator"
      title="비밀번호 만들기"
      subtitle="길이와 문자 종류를 고르면, 기기 안에서 무작위로 만듭니다."
      note={
        <>
          만든 비밀번호는 <strong className="font-semibold text-ink">화면에만</strong> 있습니다. 어디에도 저장되지
          않으니, 쓰실 것은 만든 즉시 비밀번호 관리자에 넣으세요. 같은 비밀번호를 두 곳에 쓰지 않는 것이 길이보다
          중요합니다.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1.15fr] md:gap-5">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="pw-len" className="field-label">
              길이
            </label>
            <output htmlFor="pw-len" className="text-[15px] font-extrabold tabular-nums text-brand">
              {length}자
            </output>
          </div>
          <input
            id="pw-len"
            type="range"
            min={8}
            max={64}
            step={1}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="range mt-1"
            style={{ ["--pct" as string]: `${((length - 8) / 56) * 100}%` }}
          />
          <div className="flex justify-between text-[12px] text-ink-faint">
            <span>8자</span>
            <span>권장 16자 이상</span>
            <span>64자</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="col-span-2 space-y-1.5">
              <Toggle label="대문자 A~Z" checked={enabled.upper} onChange={(v) => setEnabled({ ...enabled, upper: v })} />
              <Toggle label="소문자 a~z" checked={enabled.lower} onChange={(v) => setEnabled({ ...enabled, lower: v })} />
              <Toggle label="숫자 0~9" checked={enabled.digit} onChange={(v) => setEnabled({ ...enabled, digit: v })} />
              <Toggle
                label="특수문자 !@#$…"
                description="사이트가 막는 경우가 있으면 끄세요."
                checked={enabled.symbol}
                onChange={(v) => setEnabled({ ...enabled, symbol: v })}
              />
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={excludeSimilar}
                  onChange={(e) => setExcludeSimilar(e.target.checked)}
                  className="h-4 w-4 accent-[#1233b8]"
                />
                헷갈리는 글자 빼기 <span className="mono text-[12px] text-ink-faint">I l 1 O 0 o</span>
              </label>
            </div>
          </div>
          {!possible && (
            <p className="mt-2 rounded-lg border border-[#e8d3c6] bg-[#fbf3ef] px-3 py-2 text-[12px] font-semibold text-[#8a4a2e]">
              문자 종류를 하나 이상 고르세요.
            </p>
          )}
        </div>

        <div>
          <div className="rounded-xl border border-brand/25 bg-[#f4f8fb] p-3.5" data-pw-main>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold tracking-[0.08em] text-ink-faint">만든 비밀번호</p>
              <span className="mono text-[12px] tabular-nums text-ink-faint">
                {pool.length > 0 ? `${pool.length}종 문자` : "0종"}
              </span>
            </div>
            <p
              className="mono mt-2 break-all text-[20px] font-bold leading-[1.45] tracking-[0.01em] text-ink"
              data-pw-value
            >
              {main || "—"}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <CopyButton label="비밀번호 복사" text={main} disabled={!main} />
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-line bg-white px-3.5 text-[12.5px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
                data-pw-regenerate
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 11.4A8 8 0 0 0 6.3 6.6L4 8.8M4 12.6a8 8 0 0 0 13.7 4.8L20 15.2M4 4.4v4.4h4.4M20 19.6v-4.4h-4.4" />
                </svg>
                다시 만들기
              </button>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-semibold text-ink-faint">보안 강도</p>
                <p className={"text-[13px] font-bold " + LEVELS[level].cls} data-pw-level>
                  {LEVELS[level].label} · {bits.toFixed(0)}비트
                </p>
              </div>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={
                      "h-2 flex-1 rounded-full " + (i <= level ? LEVELS[level].bg : "bg-line-soft")
                    }
                  />
                ))}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                {pool.length > 0
                  ? `${pool.length}종 × ${length}자 = 약 ${bits.toFixed(0)}비트. 1초에 1,000억 번 대입한다고 가정하면 평균 ${crackTime(bits)} 걸립니다(이론값).`
                  : "문자 종류를 고르면 강도를 계산합니다."}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-end justify-between gap-2">
              <p className="field-label">5개 한 번에</p>
              <CopyButton small label="5개 모두 복사" text={list.join("\n")} disabled={list.length === 0} />
            </div>
            <ul className="mt-1.5 space-y-1.5" data-pw-list>
              {list.length === 0 ? (
                <li className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] text-ink-faint">
                  문자 종류를 고르면 여기에 5개가 나옵니다.
                </li>
              ) : (
                list.map((pw, i) => (
                  <li
                    key={`${pw}-${i}`}
                    className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5"
                  >
                    <span className="mono w-4 shrink-0 text-[12px] tabular-nums text-ink-faint">{i + 1}</span>
                    <span className="mono min-w-0 flex-1 break-all text-[13px] font-semibold text-ink" data-pw-item>
                      {pw}
                    </span>
                    <CopyButton small label="복사" text={pw} />
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </UtilShell>
  );
}
