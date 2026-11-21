/**
 * URL 추적제거 — 붙여 넣은 주소에서 캠페인·광고·공유 추적 파라미터만 걷어낸다.
 *
 * 판단 기준은 파라미터 이름이다. 값은 건드리지 않으므로 남는 주소는 원래 주소와
 * 같은 페이지를 가리킨다(추적에 쓰이는 이름만 빠진다). 서버로 보내지 않는다.
 */
import { useMemo, useState } from "react";
import { Btn, LocalNote, Panel, PanelTitle, Stat, UtilityShell, copyText } from "./kit";
import { Note } from "../tools/ui";

type Group = "utm" | "ads" | "share" | "empty" | "hash";

const GROUP_META: { id: Group; label: string; desc: string }[] = [
  { id: "utm", label: "utm_* 캠페인", desc: "utm_source·utm_medium·utm_campaign 등" },
  { id: "ads", label: "광고 클릭 ID", desc: "fbclid·gclid·msclkid·srsltid 등" },
  { id: "share", label: "공유 추적", desc: "YouTube si, igshid 등" },
  { id: "empty", label: "빈 값 파라미터", desc: "?a=&b= 처럼 값이 빈 항목" },
  { id: "hash", label: "주소 뒤 #붙은 부분", desc: "#section 같은 위치 표시" },
];

const ADS: Record<string, string> = {
  fbclid: "페이스북 광고",
  gclid: "구글 광고",
  gclsrc: "구글 광고",
  dclid: "구글 디스플레이",
  gbraid: "구글 광고",
  wbraid: "구글 광고",
  msclkid: "마이크로소프트 광고",
  yclid: "얀덱스 광고",
  twclid: "X 광고",
  ttclid: "틱톡 광고",
  igshid: "인스타그램 공유",
  igsh: "인스타그램 공유",
  mc_cid: "메일 캠페인",
  mc_eid: "메일 캠페인",
  _hsenc: "허브스팟 추적",
  _hsmi: "허브스팟 추적",
  vero_id: "메일 추적",
  vero_conv: "메일 추적",
  srsltid: "구글 쇼핑",
  spm: "알리바바 추적",
  sc_cid: "광고 클릭",
  oly_anon_id: "아마존 추적",
  oly_enc_id: "아마존 추적",
  ref_src: "X 공유",
  ref_url: "X 공유",
  mkt_tok: "마케팅 토큰",
};

const SHARE: Record<string, string> = {
  si: "유튜브 공유",
  share: "공유 경로",
  share_id: "공유 경로",
  __twitter_impression: "트위터 공유",
};

/** 이름 하나 → 왜 지우는지. 지우지 않는 이름이면 null. */
function reasonOf(key: string, value: string, on: Record<Group, boolean>): string | null {
  const k = key.toLowerCase();
  if (on.utm && (k.startsWith("utm_") || k === "utm")) return "캠페인 추적";
  if (on.ads && ADS[k]) return ADS[k];
  if (on.share && SHARE[k]) return SHARE[k];
  if (on.empty && value === "") return "빈 값";
  return null;
}

type RemovedParam = { key: string; value: string; why: string };
type CleanResult = {
  raw: string;
  clean: string;
  removed: RemovedParam[];
  pieces: { text: string; removed: boolean }[];
};

const MAX_ITEMS = 40;

function analyze(raw: string, on: Record<Group, boolean>): CleanResult {
  const trimmed = raw.trim();
  const hashAt = trimmed.indexOf("#");
  const hash = hashAt >= 0 ? trimmed.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed;
  const qAt = beforeHash.indexOf("?");
  const base = qAt >= 0 ? beforeHash.slice(0, qAt) : beforeHash;
  const query = qAt >= 0 ? beforeHash.slice(qAt + 1) : "";
  const dropHash = on.hash && hash.length > 0;

  const removed: RemovedParam[] = [];
  const kept: string[] = [];
  const pieces: { text: string; removed: boolean }[] = [];
  if (base) pieces.push({ text: base, removed: false });

  if (query) {
    pieces.push({ text: "?", removed: false });
    let emitted = 0;
    query.split("&").forEach((part) => {
      if (!part) return;
      const eq = part.indexOf("=");
      const key = eq >= 0 ? part.slice(0, eq) : part;
      const value = eq >= 0 ? part.slice(eq + 1) : "";
      const why = reasonOf(key, value, on);
      const sep = emitted > 0 ? "&" : "";
      emitted += 1;
      if (why) {
        removed.push({ key, value, why });
        pieces.push({ text: sep + part, removed: true });
      } else {
        kept.push(part);
        pieces.push({ text: sep + part, removed: false });
      }
    });
  }

  if (hash) pieces.push({ text: hash, removed: dropHash });

  const clean = base + (kept.length ? `?${kept.join("&")}` : "") + (hash && !dropHash ? hash : "");
  return { raw: trimmed, clean, removed, pieces };
}

const EXAMPLE = `https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=AbCdEf123456&feature=share
https://smartstore.naver.com/buffetkimz/products/123456?utm_source=instagram&utm_medium=social&utm_campaign=nov&fbclid=IwAR2xyz
https://blog.naver.com/buffetkimz/223456789?ref=thread&utm_content=card#section2
https://buffetkimz.com/apps/pension-tax?gclid=Cj0KCQ&srsltid=AfmBOo&page=2`;

export default function UrlCleaner({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState(EXAMPLE);
  const [on, setOn] = useState<Record<Group, boolean>>({
    utm: true,
    ads: true,
    share: true,
    empty: true,
    hash: false,
  });
  const [copied, setCopied] = useState<"all" | number | null>(null);

  const results = useMemo(() => {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_ITEMS)
      .map((line) => analyze(line, on));
  }, [text, on]);

  const totalRemoved = results.reduce((n, r) => n + r.removed.length, 0);
  const beforeLen = results.reduce((n, r) => n + r.raw.length, 0);
  const afterLen = results.reduce((n, r) => n + r.clean.length, 0);
  const saved = beforeLen ? Math.round((1 - afterLen / beforeLen) * 100) : 0;

  const copyAll = async () => {
    const ok = await copyText(results.map((r) => r.clean).join("\n"));
    if (ok) {
      setCopied("all");
      window.setTimeout(() => setCopied(null), 1600);
    }
  };

  const copyOne = async (i: number) => {
    const ok = await copyText(results[i].clean);
    if (ok) {
      setCopied(i);
      window.setTimeout(() => setCopied(null), 1600);
    }
  };

  return (
    <UtilityShell
      title="URL 추적제거"
      subtitle="붙여 넣은 주소에서 캠페인·광고·공유 추적 파라미터만 걷어냅니다."
      steps={["주소 붙여 넣기", "지울 항목 고르기", "정리된 주소 복사"]}
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {/* 왼쪽 — 입력과 규칙 */}
        <div className="space-y-3">
          <Panel>
            <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">줄마다 주소 1개</span>}>
              정리할 주소
            </PanelTitle>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              aria-label="정리할 주소 목록"
              rows={compact ? 6 : 8}
              className="mono w-full resize-y rounded-xl border border-line bg-white p-3 text-[12px] leading-[1.75] text-ink focus:border-brand/60 focus:outline-none"
              placeholder="https://example.com/page?utm_source=...&fbclid=..."
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11.5px] text-ink-faint">
                {results.length}개 주소 · 최대 {MAX_ITEMS}줄
              </span>
              <div className="flex gap-1.5">
                <Btn tone="secondary" small onClick={() => setText(EXAMPLE)}>
                  예시로 되돌리기
                </Btn>
                <Btn tone="secondary" small onClick={() => setText("")}>
                  비우기
                </Btn>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle right={<span className="mono text-[11.5px] text-ink-faint">켜진 항목만 제거</span>}>
              지울 항목
            </PanelTitle>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {GROUP_META.map((g) => {
                const active = on[g.id];
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOn((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                    className={
                      "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors " +
                      (active ? "border-brand/45 bg-[#f1f8f5]" : "border-line bg-white hover:border-line/70")
                    }
                  >
                    <span
                      className={
                        "mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border text-[10px] font-bold text-white " +
                        (active ? "border-brand bg-brand" : "border-line bg-white text-transparent")
                      }
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold leading-snug text-ink">{g.label}</span>
                      <span className="mono mt-0.5 block break-all text-[10.5px] leading-snug text-ink-faint">{g.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* 오른쪽 — 결과 */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="정리한 주소" value={`${results.length}개`} />
            <Stat label="제거한 파라미터" value={`${totalRemoved}개`} tone="brand" />
            <Stat label="길이 감소" value={`${saved}%`} tone="jade" sub={`${beforeLen} → ${afterLen}자`} />
          </div>

          <Panel className="!p-0">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">정리 결과</p>
              <Btn small tone={copied === "all" ? "secondary" : "primary"} onClick={copyAll} disabled={!results.length}>
                {copied === "all" ? "복사됨 ✓" : "전체 복사"}
              </Btn>
            </div>

            <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto" data-url-results>
              {results.length === 0 && (
                <li className="px-4 py-8 text-center text-[12px] text-ink-faint">주소를 넣으면 여기에 정리 결과가 나옵니다.</li>
              )}
              {results.map((r, i) => (
                <li key={`${i}-${r.clean}`} className="px-4 py-3" data-url-result>
                  <p className="mono min-w-0 break-all text-[11.5px] leading-[1.7] text-ink-faint">
                    {r.pieces.map((p, j) =>
                      p.removed ? (
                        <span key={j} className="bg-[#fbeee8] text-clay line-through decoration-clay/60" data-removed-token>
                          {p.text}
                        </span>
                      ) : (
                        <span key={j}>{p.text}</span>
                      ),
                    )}
                  </p>

                  <div className="mt-1.5 flex items-start gap-2">
                    <p
                      className="mono min-w-0 flex-1 break-all rounded-lg bg-[#f6f8f7] px-2.5 py-2 text-[11.5px] leading-[1.7] text-ink"
                      data-clean-url
                    >
                      {r.clean || "(주소 없음)"}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyOne(i)}
                      className="mt-0.5 shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-ink-muted hover:border-brand/45 hover:text-brand"
                    >
                      {copied === i ? "복사됨 ✓" : "복사"}
                    </button>
                  </div>

                  {r.removed.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.removed.map((p) => (
                        <span
                          key={`${p.key}-${p.value}`}
                          className="mono rounded-full bg-[#fbeee8] px-2 py-[2px] text-[10.5px] font-semibold text-clay"
                          data-removed-param={p.key}
                        >
                          {p.key} · {p.why}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-ink-faint">지울 추적 파라미터가 없습니다.</p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Note>
            이름을 보고 지우는 방식이라, 사이트가 자체적으로 쓰는 같은 이름의 파라미터(예: 어떤 검색 결과의{" "}
            <span className="mono">si</span>)까지 빠질 수 있습니다. 결과 주소를 한 번 열어 확인한 뒤 공유해
            주세요.
          </Note>
          <LocalNote>주소는 브라우저 메모리에서만 바뀌고 어디로도 전송되지 않습니다.</LocalNote>
        </div>
      </div>
    </UtilityShell>
  );
}
