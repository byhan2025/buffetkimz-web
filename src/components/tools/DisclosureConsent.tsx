import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { withBase } from "@/config/site";
import {
  CONSENT_ITEMS,
  CONSENT_FORM_VERSION,
  PROMISES,
  RETENTION_DAYS,
  ageFromBirth,
  buildGuide,
  buildSummary,
  formatDateKo,
  formatDateTimeKo,
  formatPhone,
  makeConsentNo,
  normalizeBirth,
  safeFilePart,
  todayKo,
  validateConsent,
} from "../../lib/consent/engine.js";
import { makeConsentPdf, makeConsentPng } from "../../lib/consent/sheet.js";

type Checks = { privacy: boolean; sensitive: boolean; contact: boolean };

type Record_ = {
  no: string;
  at: string;
  name: string;
  phone: string;
  birth: string;
  checks: Checks;
  signature: string;
  hasSignature: boolean;
  example: boolean;
};

const EMPTY_CHECKS: Checks = { privacy: false, sensitive: false, contact: false };

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export default function DisclosureConsent({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [checks, setChecks] = useState<Checks>(EMPTY_CHECKS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record_ | null>(null);
  const [signedDataUrl, setSignedDataUrl] = useState("");
  const [example, setExample] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [copied, setCopied] = useState<"" | "summary" | "guide">("");
  const [busy, setBusy] = useState<"" | "png" | "pdf">("");
  const [saveMsg, setSaveMsg] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const today = todayKo();
  const age = useMemo(() => ageFromBirth(birth, new Date()), [birth]);

  /* 서명 캔버스 — 폼이 다시 나타날 때(완료 → 수정/새로 작성)마다 기기 해상도에 맞춰 준비한다.
     부모 컴포넌트는 그대로라서 [] 로는 다시 그려지지 않는다. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(780 * ratio);
    canvas.height = Math.round(300 * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 780, 300);
    ctx.strokeStyle = "#e3e9ef";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 238);
    ctx.lineTo(756, 238);
    ctx.stroke();
    ctx.strokeStyle = "#14263c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (signedDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 780, 300);
        setHasInk(true);
      };
      img.src = signedDataUrl;
    }
  }, [done, signedDataUrl]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const ratio = canvas.width / 780;
    ctx.strokeStyle = "#e3e9ef";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 238);
    ctx.lineTo(756, 238);
    ctx.stroke();
    ctx.strokeStyle = "#14263c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    setHasInk(false);
    setSignedDataUrl("");
  };

  const pointOf = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 780,
      y: ((e.clientY - rect.top) / rect.height) * 300,
    };
  };

  const startDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (done) return;
    const p = pointOf(e);
    const canvas = canvasRef.current;
    if (!p || !canvas) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    lastRef.current = p;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#14263c";
    ctx.fill();
    setHasInk(true);
    setErrors((prev) => ({ ...prev, signature: "" }));
  };

  const moveDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = pointOf(e);
    const canvas = canvasRef.current;
    if (!p || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const last = lastRef.current ?? p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const signatureDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return "";
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    if (!ctx || !width || !height) return "";
    /* 잉크가 있는 부분만 잘라 낸다 — 확인증에서 서명이 작게 보이지 않게. */
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 20 && data[i] < 200 && data[i + 1] < 200) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return canvas.toDataURL("image/png");
    const pad = Math.round(width / 780) * 14;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width - sx, maxX - minX + pad * 2);
    const sh = Math.min(height - sy, maxY - minY + pad * 2);
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const octx = out.getContext("2d");
    if (!octx) return "";
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, sw, sh);
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  };

  const applyExample = () => {
    setName("홍길동");
    setPhone("010-1234-5678");
    setBirth("1981-08-23");
    setChecks({ privacy: true, sensitive: true, contact: true });
    setErrors({});
    setExample(true);
    setDone(null);
    setSaveMsg("");
    const canvas = canvasRef.current;
    if (canvas) {
      clearSignature(); // 앞서 그린 서명이 있으면 지우고 예시 서명만 남긴다
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.strokeStyle = "#14263c";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(210, 168);
        ctx.bezierCurveTo(250, 108, 300, 96, 320, 138);
        ctx.bezierCurveTo(336, 172, 300, 196, 280, 170);
        ctx.bezierCurveTo(258, 142, 330, 120, 366, 146);
        ctx.bezierCurveTo(400, 170, 372, 198, 352, 176);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(420, 196);
        ctx.bezierCurveTo(452, 152, 492, 132, 520, 154);
        ctx.bezierCurveTo(548, 176, 508, 206, 486, 190);
        ctx.stroke();
        ctx.restore();
      }
      setHasInk(true);
    }
  };

  const resetAll = () => {
    setName("");
    setPhone("");
    setBirth("");
    setChecks(EMPTY_CHECKS);
    setErrors({});
    setDone(null);
    setExample(false);
    setSaveMsg("");
    setCopied("");
    setSignedDataUrl("");
    setHasInk(false);
    clearSignature();
  };

  const submit = () => {
    const result = validateConsent({ name, phone, birth, checks, hasSignature: hasInk });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const at = new Date().toISOString();
    const signature = signatureDataUrl();
    const record: Record_ = {
      no: makeConsentNo(at),
      at,
      name: result.normalized.name,
      phone: result.normalized.phone,
      birth: result.normalized.birth,
      checks: { ...checks },
      signature,
      hasSignature: hasInk,
      example,
    };
    setSignedDataUrl(signature);
    setErrors({});
    setDone(record);
    setSaveMsg("");
    window.setTimeout(() => document.getElementById("consent-done")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const savePng = async () => {
    if (!done) return;
    setBusy("png");
    setSaveMsg("");
    try {
      const blob = await makeConsentPng(done);
      if (!blob) throw new Error("이미지를 만들지 못했습니다.");
      download(blob, `진료자료-활용-동의서-${safeFilePart(done.name)}-${done.at.slice(0, 10).replace(/-/g, "")}${done.example ? "-가상예시" : ""}.png`);
      setSaveMsg("확인증 이미지(PNG)를 저장했습니다. 기기의 다운로드 폴더를 확인해 주세요.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "이미지를 저장하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const savePdf = async () => {
    if (!done) return;
    setBusy("pdf");
    setSaveMsg("");
    try {
      const blob = await makeConsentPdf(done);
      download(blob, `진료자료-활용-동의서-${safeFilePart(done.name)}-${done.at.slice(0, 10).replace(/-/g, "")}${done.example ? "-가상예시" : ""}.pdf`);
      setSaveMsg("A4 PDF를 저장했습니다. 인쇄하거나 보관용으로 쓰세요.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "PDF를 저장하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const copySummary = async () => {
    if (!done) return;
    const ok = await copyText(buildSummary(done));
    setCopied(ok ? "summary" : "");
    setSaveMsg(ok ? "설계사 기록용 요약을 복사했습니다." : "복사하지 못했습니다. 화면의 내용을 직접 선택해 주세요.");
  };

  const copyGuide = async () => {
    if (!done) return;
    const link = `${window.location.origin}${window.location.pathname}`;
    const ok = await copyText(buildGuide(done, link));
    setCopied(ok ? "guide" : "");
    setSaveMsg(ok ? "고객에게 보낼 안내 문구를 복사했습니다. 메신저나 문자에 붙여넣으세요." : "복사하지 못했습니다.");
  };

  const err = (key: string) =>
    errors[key] ? (
      <p className="mt-1 text-[12px] font-semibold text-[#b3261e]" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="space-y-3" data-consent-form>
      {/* 다섯 약속 */}
      <section className="rounded-2xl border border-line bg-white p-4 md:p-5" aria-labelledby="promises-title">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip !min-h-[24px] !border-transparent !bg-jade-soft !px-2.5 !text-[11.5px] !text-jade">기기 안에서만</span>
          <span className="text-[11.5px] text-ink-faint">서버 전송 0</span>
        </div>
        <h2 id="promises-title" className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-ink">
          심평원 진료자료 안전 확인 5대 약속
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          진료자료를 받기 전에 이 다섯 가지를 먼저 확인하세요. 고객이 안심하고 자료를 맡길 수 있는 기준입니다.
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROMISES.map((p) => (
            <li key={p.no} className="flex gap-2.5 rounded-xl border border-line-soft bg-[#fbfbf8] px-3 py-2.5">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11.5px] font-bold text-white">
                {p.no}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-snug text-ink">{p.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-[1.6] text-ink-muted">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!done && (
        <>
          {/* 작성 정보 */}
          <section className={`rounded-2xl border border-line bg-[#fbfbf8] ${compact ? "p-4" : "p-4 md:p-6"}`} aria-labelledby="writer-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="writer-title" className="text-[15.5px] font-bold tracking-[-0.02em] text-ink">
                  작성자 정보
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-muted">동의서에 적힐 정보입니다. 본인이 직접 확인하고 적어 주세요.</p>
              </div>
              <button
                type="button"
                onClick={applyExample}
                className="inline-flex min-h-[40px] items-center rounded-full border border-line bg-white px-3.5 text-[12px] font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
              >
                가상 예시 채우기
              </button>
            </div>
            {example && (
              <p className="mt-3 rounded-lg bg-[#fff4e5] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a00]">
                가상 예시로 채웠습니다. 확인증에 ‘효력 없음’ 표식이 붙습니다. 실제 작성은 [새로 작성]으로 처음부터 하세요.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12.5px] font-semibold text-ink">
                성명 <span className="text-[#b3261e]">*</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="예: 홍길동"
                  autoComplete="name"
                  className={inputCls}
                />
                {err("name")}
              </label>
              <label className="block text-[12.5px] font-semibold text-ink">
                연락처 <span className="text-[#b3261e]">*</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value));
                    setErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  className={inputCls}
                />
                {err("phone")}
              </label>
              <label className="block text-[12.5px] font-semibold text-ink">
                생년월일 <span className="text-[#b3261e]">*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={birth}
                  onChange={(e) => {
                    setBirth(e.target.value);
                    setErrors((prev) => ({ ...prev, birth: "" }));
                  }}
                  onBlur={() => {
                    const iso = normalizeBirth(birth);
                    if (iso) setBirth(iso);
                  }}
                  placeholder="1981-08-23 또는 810823"
                  className={inputCls}
                />
                {birth && age !== null && !errors.birth ? (
                  <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">만 {age}세로 확인됩니다.</span>
                ) : null}
                {err("birth")}
              </label>
              <label className="block text-[12.5px] font-semibold text-ink">
                동의 일자
                <input
                  type="text"
                  value={formatDateKo(today)}
                  readOnly
                  aria-readonly="true"
                  className={`${inputCls} bg-white/70 text-ink-muted`}
                />
                <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">오늘 날짜로 자동 기록됩니다.</span>
              </label>
            </div>
          </section>

          {/* 동의 항목 */}
          <section className="rounded-2xl border border-line bg-white p-4 md:p-5" aria-labelledby="items-title">
            <h2 id="items-title" className="text-[15.5px] font-bold tracking-[-0.02em] text-ink">
              동의 항목
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              필수 2개에 체크해 주세요. 선택 항목은 동의하지 않아도 됩니다.
            </p>
            <div className="mt-3 space-y-2.5">
              {CONSENT_ITEMS.map((item) => (
                <div key={item.key} className="rounded-xl border border-line-soft bg-[#fbfbf8] px-3.5 py-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={checks[item.key as keyof Checks]}
                      onChange={(e) => {
                        setChecks((prev) => ({ ...prev, [item.key]: e.target.checked }));
                        setErrors((prev) => ({ ...prev, required: "" }));
                      }}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-[#1233b8]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink">
                        {item.title} <span className={item.required ? "text-[#b3261e]" : "text-ink-faint"}>{item.required ? "(필수)" : "(선택)"}</span>
                      </span>
                      <dl className="mt-1.5 space-y-1">
                        {item.lines.map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-[11.5px] leading-[1.6]">
                            <dt className="w-[52px] shrink-0 font-semibold text-ink-faint">{k}</dt>
                            <dd className="min-w-0 text-ink-muted">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </span>
                  </label>
                </div>
              ))}
            </div>
            {err("required")}
            <p className="mt-3 rounded-lg bg-paper-deep px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
              동의는 언제든지 철회할 수 있습니다. 철회하면 받은 진료자료와 확인증 사본을 지체 없이 파기합니다. 보관기간은 최대 {RETENTION_DAYS}일입니다.
            </p>
          </section>

          {/* 서명 */}
          <section className="rounded-2xl border border-line bg-white p-4 md:p-5" aria-labelledby="sign-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="sign-title" className="text-[15.5px] font-bold tracking-[-0.02em] text-ink">
                  전자서명 <span className="text-[#b3261e]">*</span>
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-muted">손가락이나 마우스로 서명해 주세요. 서명은 이 기기 안에서만 처리됩니다.</p>
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="inline-flex min-h-[40px] items-center rounded-full border border-line bg-white px-3.5 text-[12px] font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
              >
                지우기
              </button>
            </div>
            <div className="relative mt-2.5 overflow-hidden rounded-xl border border-line bg-white">
              <canvas
                ref={canvasRef}
                aria-label="서명란"
                className="block w-full cursor-crosshair"
                style={{ aspectRatio: "780 / 300", touchAction: "none" }}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerCancel={endDraw}
                onPointerLeave={endDraw}
              />
              {!hasInk && (
                <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] text-ink-faint">
                  여기에 서명해 주세요
                </p>
              )}
            </div>
            {err("signature")}
          </section>

          <div className="rounded-2xl border border-line bg-white p-4 md:p-5">
            <button
              type="button"
              onClick={submit}
              className="min-h-[48px] w-full rounded-full bg-brand px-5 text-[14.5px] font-bold text-white shadow-[0_10px_24px_-16px_rgba(15,53,80,0.9)] hover:bg-brand-deep"
            >
              동의서 작성 완료
            </button>
            <p className="mt-2 text-center text-[11.5px] leading-relaxed text-ink-faint">
              완료하면 확인증(PNG·A4 PDF)을 내려받을 수 있습니다. 입력값은 서버로 전송되지 않습니다.
            </p>
          </div>
        </>
      )}

      {done && (
        <section id="consent-done" className="rounded-2xl border border-jade/40 bg-white p-4 md:p-6" aria-labelledby="done-title">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip !min-h-[24px] !border-transparent !bg-jade-soft !px-2.5 !text-[11.5px] !text-jade">작성 완료</span>
            {done.example && <span className="chip !min-h-[24px] !border-transparent !bg-[#fff4e5] !px-2.5 !text-[11.5px] !text-[#8a5a00]">가상 예시 · 효력 없음</span>}
          </div>
          <h2 id="done-title" className="mt-2 text-[17px] font-bold tracking-[-0.02em] text-ink">
            {done.name}님의 진료자료 활용 동의가 기록되었습니다
          </h2>
          <dl className="mt-3 grid gap-2 rounded-xl border border-line-soft bg-[#fbfbf8] p-3.5 sm:grid-cols-2">
            {[
              ["동의번호", done.no],
              ["동의 일시", formatDateTimeKo(done.at)],
              ["성명", done.name],
              ["생년월일", done.birth],
              ["연락처", done.phone],
              ["서명", done.hasSignature ? "확인(전자서명)" : "없음"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12.5px]">
                <dt className="w-[62px] shrink-0 font-semibold text-ink-faint">{k}</dt>
                <dd className="min-w-0 font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-1 text-[12px] leading-relaxed text-ink-muted">
            {CONSENT_ITEMS.map((item) => (
              <li key={item.key}>
                {done.checks[item.key as keyof Checks] ? "☑" : "☐"} {item.title} {item.required ? "(필수)" : "(선택)"} —{" "}
                {done.checks[item.key as keyof Checks] ? "동의함" : "동의하지 않음"}
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={savePdf}
              disabled={busy !== ""}
              className="min-h-[48px] rounded-full bg-brand px-4 text-[13.5px] font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {busy === "pdf" ? "PDF 만드는 중…" : "A4 PDF 저장"}
            </button>
            <button
              type="button"
              onClick={savePng}
              disabled={busy !== ""}
              className="min-h-[48px] rounded-full border border-brand/30 bg-white px-4 text-[13.5px] font-bold text-brand-deep hover:border-brand disabled:opacity-60"
            >
              {busy === "png" ? "이미지 만드는 중…" : "확인증 이미지(PNG) 저장"}
            </button>
            <button
              type="button"
              onClick={copySummary}
              className="min-h-[44px] rounded-full border border-line bg-white px-4 text-[12.5px] font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
            >
              {copied === "summary" ? "복사됨" : "설계사 기록용 요약 복사"}
            </button>
            <button
              type="button"
              onClick={copyGuide}
              className="min-h-[44px] rounded-full border border-line bg-white px-4 text-[12.5px] font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
            >
              {copied === "guide" ? "복사됨" : "고객에게 보낼 안내 문구 복사"}
            </button>
          </div>

          {saveMsg && <p className="mt-2 rounded-lg bg-paper-deep px-3 py-2 text-[12px] leading-relaxed text-ink-muted">{saveMsg}</p>}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setCopied("");
                setSaveMsg("");
              }}
              className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-brand-deep link"
            >
              내용 수정하기
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-ink-muted link"
            >
              새로 작성
            </button>
            <a
              href={withBase("/apps/simpyeong-disclosure/run")}
              className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-brand-deep link"
            >
              이어서 심평원 고지 정리기 →
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            받은 진료자료와 확인증 사본은 확인 후 {RETENTION_DAYS}일 안에 파기합니다. 확인증 파일은 이 기기의 다운로드 폴더에 저장됩니다.
          </p>
        </section>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        이 동의서는 상담 전 확인용 서식입니다. 보험회사 청약서의 고지의무를 대신하지 않으며, 최종 문구는 소속 회사의 개인정보 처리방침과 동의서 양식을 함께 확인하세요.
        <span className="mono ml-1">서식 v{CONSENT_FORM_VERSION}</span>
      </p>
    </div>
  );
}
