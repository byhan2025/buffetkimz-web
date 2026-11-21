import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { CopyButton, UtilShell } from "./UtilShell";

/**
 * URL 주소 단축기.
 *
 * 두 가지를 한 화면에 둔다.
 *  1) 정리(클린 URL) — utm_* 같은 추적 파라미터를 떼어 낸 주소를 브라우저에서 만든다.
 *  2) 단축 — 공개 단축 서비스(spoo.me)에 주소를 보내 짧은 주소를 받는다.
 *
 * 정직하게 적어 둘 것: 2번은 값을 밖으로 보내는 일이다. 주소가 spoo.me 서버에 저장되고,
 * 그 주소를 누가 얼마나 눌렀는지도 그쪽에 남는다. 그래서 화면 위 배지를 '서버 미전송'이
 * 아니라 '단축 서버 전송'으로 두고, 민감한 주소는 단축하지 말라고 먼저 적는다.
 *
 * 3번째는 QR — 단축이 막혀도(서비스 장애·요청 제한) 정리한 주소로 QR을 만들어 쓸 수 있다.
 * 브라우저 CORS 확인(2026-11-21): tinyurl·is.gd·v.gd는 Access-Control-Allow-Origin을 우리
 * 출처에 열어 주지 않아 브라우저에서 호출할 수 없다. spoo.me는 `*`로 열려 있고 JSON으로 답한다.
 */

type Short = { short: string; original: string; at: number };

const SPOO = "https://spoo.me/";

/** 널리 쓰이는 추적 파라미터 — 값만 떼고 나머지 질의는 그대로 둔다 */
const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "ncid",
  "spm",
  "scm",
  "ref_src",
  "ref_url",
]);

const isTracking = (key: string) => key.toLowerCase().startsWith("utm_") || TRACKING_KEYS.has(key.toLowerCase());

type Parsed =
  | { ok: false; error: string }
  | { ok: true; url: string; clean: string; removed: string[] };

export function parseUrl(raw: string): Parsed {
  const text = raw.trim();
  if (!text) return { ok: false, error: "주소를 넣어 주세요." };
  let candidate = text;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) candidate = "https://" + candidate;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "주소의 모양이 맞지 않습니다. 예: https://example.com/page" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "http·https 주소만 다룰 수 있습니다." };
  }
  if (!url.hostname.includes(".")) {
    return { ok: false, error: "도메인 모양을 확인해 주세요. 예: naver.com" };
  }
  const removed: string[] = [];
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (isTracking(key)) removed.push(key);
    else kept.append(key, value);
  });
  const cleanUrl = new URL(url.toString());
  cleanUrl.search = kept.toString();
  /* 추적 파라미터만 있던 주소면 물음표가 남지 않게 한다 */
  const clean = kept.toString() ? cleanUrl.toString() : cleanUrl.toString().replace(/\?$/, "");
  return { ok: true, url: url.toString(), clean, removed };
}

/** QR 코드 — 라이브러리가 만든 data URL을 그대로 그린다(서버 왕복 없음) */
function qrDataUrl(text: string): string {
  try {
    const qr = qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    return qr.createDataURL(6, 4);
  } catch {
    return "";
  }
}

const friendlyError = (status: number): string => {
  if (status === 429) return "요청이 잠시 제한되었습니다(분당 요청 수 제한). 1분 뒤 다시 시도해 주세요.";
  if (status >= 500) return "단축 서비스가 잠시 응답하지 않습니다. 아래 정리한 주소와 QR을 그대로 쓰셔도 됩니다.";
  if (status === 400) return "단축 서비스가 이 주소를 받지 않았습니다. 주소를 확인해 주세요.";
  return `단축하지 못했습니다(응답 ${status}). 아래 정리한 주소와 QR은 그대로 쓸 수 있습니다.`;
};

export default function UrlShortener() {
  const [raw, setRaw] = useState("https://www.example.com/2026-financial-plan?utm_source=threads&utm_medium=social&fbclid=AbC123&page=2");
  const [dropTracking, setDropTracking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [short, setShort] = useState<Short | null>(null);
  const [history, setHistory] = useState<Short[]>([]);
  const [qrFor, setQrFor] = useState<"clean" | "short">("clean");

  const parsed = useMemo(() => parseUrl(raw), [raw]);
  const cleanUrl = parsed.ok && dropTracking ? parsed.clean : parsed.ok ? parsed.url : "";
  const qrTarget = qrFor === "short" && short ? short.short : cleanUrl;
  const qr = useMemo(() => (qrTarget ? qrDataUrl(qrTarget) : ""), [qrTarget]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const shorten = useCallback(async () => {
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const target = cleanUrl;
    setError("");
    setShort(null);
    setBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(SPOO, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: target }).toString(),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        setError(friendlyError(res.status));
        return;
      }
      const data = (await res.json()) as { short_url?: string; error?: string };
      if (!data.short_url) {
        setError("단축 서비스가 주소를 돌려주지 않았습니다. 정리한 주소와 QR을 그대로 쓸 수 있습니다.");
        return;
      }
      /* 서비스가 http로 답해도 https로 연다 — 요즘 브라우저는 http 주소를 경고한다 */
      const fixed = data.short_url.replace(/^http:\/\//i, "https://");
      const entry: Short = { short: fixed, original: target, at: Date.now() };
      setShort(entry);
      setHistory((prev) => [entry, ...prev].slice(0, 5));
      setQrFor("short");
    } catch {
      setError(
        "단축 서비스에 닿지 못했습니다(연결 실패·시간 초과). 광고 차단기나 사내망이 막았을 수 있습니다. 아래 정리한 주소와 QR은 그대로 쓸 수 있습니다."
      );
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  }, [parsed, cleanUrl]);

  return (
    <UtilShell
      id="url-shortener"
      title="URL 주소 단축기"
      subtitle="긴 주소를 짧게, 추적 파라미터는 떼고 QR까지"
      badge={{ label: "단축 서버 전송", tone: "amber" }}
      note={
        <>
          주소를 정리하고 QR을 만드는 일은 <strong className="font-semibold text-ink">이 브라우저 안에서</strong>
          끝납니다. 다만 <strong className="font-semibold text-ink">짧은 주소를 만들 때는 입력한 주소가 외부 단축
          서비스(spoo.me)로 전송·저장</strong>됩니다. 고객 이름·연락처가 들어간 주소처럼 민감한 링크는 단축하지 마세요.
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="url-short-input" className="field-label">
              긴 주소
            </label>
            <button
              type="button"
              onClick={() =>
                setRaw("https://www.example.com/2026-financial-plan?utm_source=threads&utm_medium=social&fbclid=AbC123&page=2")
              }
              className="text-[12px] font-semibold text-brand hover:underline"
            >
              예시 넣기
            </button>
          </div>
          <input
            id="url-short-input"
            data-short-input
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setShort(null);
              setError("");
              setQrFor("clean");
            }}
            spellCheck={false}
            inputMode="url"
            placeholder="https://..."
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint/80 focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
          />
          {!parsed.ok && raw.trim() !== "" && (
            <p data-short-error className="mt-1 text-[12px] text-clay">
              {parsed.error}
            </p>
          )}
        </div>

        <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
          <input
            type="checkbox"
            checked={dropTracking}
            onChange={(e) => setDropTracking(e.target.checked)}
            className="h-4 w-4 accent-[#1a4ffd]"
          />
          추적 파라미터(utm_*·fbclid 등) 떼기
        </label>

        {parsed.ok && (
          <div className="rounded-xl border border-line bg-white px-3.5 py-3" data-short-clean>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-ink-faint">
                정리한 주소
                {parsed.removed.length > 0 ? (
                  <span data-removed-count className="ml-1.5 text-brand">
                    추적 {parsed.removed.length}개 제거
                  </span>
                ) : (
                  <span className="ml-1.5">떼어 낼 추적 파라미터 없음</span>
                )}
              </p>
              <CopyButton text={cleanUrl} small label="복사" />
            </div>
            <p className="mt-1.5 break-all font-mono text-[12.5px] leading-[1.7] text-ink">{cleanUrl}</p>
            <p className="mt-1 text-[11.5px] text-ink-faint">
              {cleanUrl.length}자
              {parsed.removed.length > 0 ? ` · 떼어 낸 항목: ${parsed.removed.join(", ")}` : ""}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-short-run
            onClick={() => void shorten()}
            disabled={busy || !parsed.ok}
            className="min-h-[44px] rounded-xl bg-brand px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
          >
            {busy ? "만드는 중…" : "짧은 주소 만들기"}
          </button>
          <span className="text-[11.5px] text-ink-faint">spoo.me 공개 API · 분당 요청 수 제한 있음</span>
        </div>

        {error && (
          <p data-short-error className="rounded-xl border border-clay/40 bg-[#fbf3ef] px-3 py-2.5 text-[12.5px] leading-relaxed text-clay">
            {error}
          </p>
        )}

        {short && (
          <div data-short-result className="rounded-xl border border-brand/30 bg-brand-soft/40 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-ink-faint">짧은 주소</p>
              <div className="flex items-center gap-1.5">
                <CopyButton text={short.short} small label="복사" />
                <a
                  href={short.short}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[32px] items-center rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-soft hover:border-brand/45 hover:text-brand"
                >
                  열어 보기
                </a>
              </div>
            </div>
            <p className="mt-1.5 break-all font-mono text-[15px] font-bold leading-[1.6] text-brand-deep">{short.short}</p>
            <p className="mt-1 break-all text-[11.5px] text-ink-faint">
              {short.original.length}자 → {short.short.length}자
            </p>
          </div>
        )}

        {qr && (
          <div data-short-qr className="rounded-xl border border-line bg-white px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-ink-faint">
                QR 코드 — {qrFor === "short" && short ? "짧은 주소" : "정리한 주소"}
              </p>
              <div className="flex gap-1">
                {short && (
                  <button
                    type="button"
                    onClick={() => setQrFor("short")}
                    className={
                      "min-h-[30px] rounded-full px-2.5 text-[11.5px] font-semibold " +
                      (qrFor === "short" ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
                    }
                  >
                    짧은 주소
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQrFor("clean")}
                  className={
                    "min-h-[30px] rounded-full px-2.5 text-[11.5px] font-semibold " +
                    (qrFor === "clean" ? "bg-brand text-white" : "border border-line bg-white text-ink-soft")
                  }
                >
                  정리한 주소
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="입력한 주소의 QR 코드"
                data-short-qr-img
                className="h-[132px] w-[132px] rounded-lg border border-line-soft bg-white"
              />
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                휴대폰 카메라로 비추면 바로 열립니다. 이미지는 이 화면에서만 그려지고 저장되지 않습니다.
              </p>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div data-short-history className="rounded-xl border border-line bg-white px-3.5 py-3">
            <p className="text-[12px] font-semibold text-ink-faint">이번 화면에서 만든 주소 {history.length}개</p>
            <ul className="mt-1.5 space-y-1.5">
              {history.map((h) => (
                <li key={h.short} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12.5px] text-ink">{h.short}</span>
                  <CopyButton text={h.short} small label="복사" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          단축 주소는 spoo.me에 저장되므로, 만든 뒤에도 그쪽에서 주소가 보입니다. 새로 고치면 이 화면의 목록은 사라집니다.
        </p>
      </div>
    </UtilShell>
  );
}
