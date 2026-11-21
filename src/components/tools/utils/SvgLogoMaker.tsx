import { useMemo, useState } from "react";
import { CopyButton, TextInput, UtilShell } from "./UtilShell";
import { Line, QuickChoices, num } from "./fields-c";

/**
 * SVG 미니 로고·아이콘 메이커.
 *
 *  · 심볼 8종은 24px 격자에 1.6px 선으로 그린 자체 도형이다(외부 아이콘 세트 미사용).
 *  · 같은 심볼·이름·강조색으로 default / light / dark / mono 네 벌을 만든다.
 *  · 결과는 순수 SVG 코드이고, PNG는 브라우저 캔버스로 변환해 내려받는다.
 *  · 파일은 어디에도 올리지 않는다(Blob URL로만 내려받기).
 */

type Variant = "default" | "light" | "dark" | "mono";

const SYMBOLS: { id: string; label: string; d: string }[] = [
  /* 책갈피 — 저장·아카이브 */
  { id: "bookmark", label: "책갈피", d: "M7 3.4h10a1.4 1.4 0 0 1 1.4 1.4v16L12 16.6 5.6 20.8V4.8A1.4 1.4 0 0 1 7 3.4Z" },
  /* 방패 — 보장·보안 */
  { id: "shield", label: "방패", d: "M12 2.9 5 5.7v5.2c0 4.2 2.9 7.6 7 10.2 4.1-2.6 7-6 7-10.2V5.7L12 2.9Z" },
  /* 차트 — 금융·성장 */
  { id: "chart", label: "차트", d: "M3.6 20.2h16.8M3.6 20.2V3.8M7.2 17.4v-4.6M11.4 17.4V9.2M15.6 17.4v-6.8M19.4 17.4V5.6" },
  /* 별 — 브랜드·품질 */
  { id: "star", label: "별", d: "m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.2Z" },
  /* 다이아몬드 — 가치·프리미엄 */
  { id: "diamond", label: "다이아", d: "M12 3.2 20 9.4 12 20.8 4 9.4 12 3.2ZM4 9.4h16M9.4 9.4 12 3.2l2.6 6.2-2.6 11.4-2.6-11.4Z" },
  /* 잎 — 생활·건강 */
  { id: "leaf", label: "잎", d: "M20 4c-8.6 0-14 3.4-14 9.4A6.6 6.6 0 0 0 12.6 20C18.4 20 20 13.4 20 4ZM6 20c1.2-5 4-8.6 8.4-10.6" },
  /* 번개 — 속도·테크 */
  { id: "bolt", label: "번개", d: "M13.4 2.8 5.6 13.6h5l-1.4 7.6 8.2-11h-5.2l1.2-7.4Z" },
  /* 고리 — 연결·네트워크 */
  { id: "ring", label: "고리", d: "M9.6 14.4 14.4 9.6M8.4 12.2 6.2 14.4a3.2 3.2 0 0 0 4.6 4.6l2.2-2.2M15.6 11.8l2.2-2.2a3.2 3.2 0 0 0-4.6-4.6l-2.2 2.2" },
];

const ACCENTS = ["#0e5344", "#14b8a6", "#1f4e79", "#243b53", "#8a6320", "#b1637a", "#c2452d", "#111827"];

const VARIANTS: { id: Variant; label: string; note: string }[] = [
  { id: "default", label: "default", note: "투명 배경 · 강조색" },
  { id: "light", label: "light", note: "흰 배경 · 화면용" },
  { id: "dark", label: "dark", note: "어두운 배경 · 다크 테마" },
  { id: "mono", label: "mono", note: "단색 · 인쇄·각인" },
];

const INK = "#12212e";
const CREAM = "#f3ede2";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 글자 폭 어림 — 한글은 1em, 영대문자 0.66em, 숫자·소문자 0.55em.
 * 이 값으로 캔버스 폭을 잡아 이름이 길어도 SVG 밖으로 넘치지 않게 한다.
 */
const charW = (ch: string) => {
  if (/[\uAC00-\uD7A3\u3131-\u318E]/.test(ch)) return 1.0;
  if (/[A-Z]/.test(ch)) return 0.66;
  if (/[0-9]/.test(ch)) return 0.58;
  if (ch === " ") return 0.3;
  return 0.54;
};

function buildSvg(symbol: string, rawName: string, accent: string, variant: Variant, responsive = false) {
  const name = (rawName.trim() || "BRAND").slice(0, 16);
  const sym = SYMBOLS.find((s) => s.id === symbol) ?? SYMBOLS[0];
  const fs = name.length > 10 ? 24 : name.length > 7 ? 28 : 32;
  const chars = [...name];
  const textW = chars.reduce((n, ch) => n + charW(ch), 0) * fs - Math.max(0, chars.length - 1) * 0.8;
  const width = Math.max(180, Math.round(88 + textW + 20));
  const height = 120;
  const bg = variant === "light" ? "#ffffff" : variant === "dark" ? "#0e1b24" : "none";
  const mark = variant === "mono" ? INK : accent;
  const text = variant === "dark" ? CREAM : INK;
  /* 미리보기는 높이를 고정해 카드 안에서 로고가 자연스러운 크기로 보이게 한다 */
  const size = responsive
    ? `style="height:96px;width:auto;max-width:100%;display:block;margin:0 auto"`
    : `width="${width}" height="${height}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${size} role="img" aria-label="${esc(name)} 로고">`,
    bg === "none" ? "" : `  <rect width="${width}" height="${height}" rx="10" fill="${bg}"/>`,
    `  <g transform="translate(18 32) scale(2.34)" fill="none" stroke="${mark}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`,
    `    <path d="${sym.d}"/>`,
    `  </g>`,
    `  <text x="88" y="72" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="${fs}" font-weight="800" letter-spacing="-0.8" fill="${text}">${esc(name)}</text>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function SvgLogoMaker({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("버핏킴즈");
  const [symbol, setSymbol] = useState("bookmark");
  const [accent, setAccent] = useState("#0e5344");
  const [pngSize, setPngSize] = useState(1024);
  const [busy, setBusy] = useState<string>("");

  const svgs = useMemo(
    () => VARIANTS.map((v) => ({ ...v, svg: buildSvg(symbol, name, accent, v.id) })),
    [symbol, name, accent]
  );

  const savePng = async (variant: Variant) => {
    setBusy(variant);
    try {
      const svg = buildSvg(symbol, name, accent, variant);
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const img = new Image();
      img.decoding = "sync";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg load failed"));
        img.src = src;
      });
      const ratio = img.naturalHeight / img.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = pngSize;
      canvas.height = Math.round(pngSize * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      if (variant !== "default" && variant !== "mono") {
        ctx.fillStyle = variant === "dark" ? "#0e1b24" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) download(`logo-${variant}-${pngSize}.png`, blob);
        setBusy("");
      }, "image/png");
    } catch {
      setBusy("");
    }
  };

  return (
    <UtilShell
      id="svg-logo-maker"
      title="SVG 미니 로고 메이커"
      subtitle="심볼·브랜드명·강조색을 정하면 네 가지 배경의 SVG 로고와 PNG를 만듭니다."
      note={
        <>
          만든 SVG 코드와 PNG는 <strong className="font-semibold text-ink">내 브라우저에서만</strong> 만들어져 바로
          내려받습니다. 서버로 보내지 않고, 상표 등록 가능 여부는 판단하지 않습니다.
        </>
      }
    >
      <div className={compact ? "space-y-1" : "space-y-1"}>
        <TextInput
          label="브랜드명 (최대 16자)"
          value={name}
          onChange={setName}
          maxLength={16}
          placeholder="예: 버핏킴즈"
        />

        <QuickChoices
          label="심볼"
          value={symbol}
          onChange={setSymbol}
          options={SYMBOLS.map((s) => ({ value: s.id, label: s.label }))}
        />

        <div className="py-3">
          <p className="text-[13.5px] font-semibold text-ink">강조색</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`강조색 ${c}`}
                aria-pressed={accent.toLowerCase() === c}
                onClick={() => setAccent(c)}
                className={
                  "h-11 w-11 rounded-full border-2 transition-transform " +
                  (accent.toLowerCase() === c ? "scale-[1.06] border-ink" : "border-line")
                }
                style={{ background: c }}
              />
            ))}
            <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-soft">
              직접 선택
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <span className="mono text-[12px] text-ink-faint">{accent}</span>
          </div>
        </div>

        <QuickChoices
          label="PNG 크기"
          value={pngSize}
          onChange={setPngSize}
          options={[
            { value: 512, label: "512px" },
            { value: 1024, label: "1024px" },
            { value: 2048, label: "2048px" },
          ]}
        />
      </div>

      <div className="mt-4 space-y-3">
        {svgs.map((v) => (
          <div key={v.id} className="rounded-xl border border-line bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-bold text-ink">
                  {v.label} <span className="font-semibold text-ink-faint">· {v.note}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <CopyButton text={v.svg} label="SVG 코드" small />
                <button
                  type="button"
                  onClick={() =>
                    download(`logo-${v.id}.svg`, new Blob([v.svg], { type: "image/svg+xml;charset=utf-8" }))
                  }
                  className="min-h-[32px] rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand/45 hover:text-brand"
                >
                  SVG 저장
                </button>
                <button
                  type="button"
                  onClick={() => savePng(v.id)}
                  className="min-h-[32px] rounded-full border border-line bg-white px-2.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand/45 hover:text-brand"
                >
                  {busy === v.id ? "만드는 중…" : "PNG 저장"}
                </button>
              </div>
            </div>
            <div
              className={
                "mt-2 overflow-hidden rounded-lg p-2 " +
                (v.id === "dark" ? "bg-[#0e1b24]" : v.id === "mono" ? "bg-[#f2f0ea]" : "bg-[#fbfbf8]")
              }
              // 만든 SVG를 그대로 그린다(외부 요청 없음)
              dangerouslySetInnerHTML={{ __html: buildSvg(symbol, name, accent, v.id, true) }}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-paper-deep p-4">
        <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a5c17]">만들 때 지킨 것</p>
        <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#4a4636]">
          <li>· 도형은 24px 격자 선 도형이라 작은 파비콘·프로필에서도 형태가 남습니다.</li>
          <li>· 글자 폭에 맞춰 캔버스 폭을 계산합니다. 이름이 길면 글자가 작아질 뿐 넘치지 않습니다.</li>
          <li>· SVG에는 불필요한 메타데이터가 없어 코드를 그대로 붙여 넣어 쓸 수 있습니다.</li>
          <li>· 상표 등록 전에는 특허청 키프리스에서 같은 이름·도형을 확인하세요.</li>
        </ul>
      </div>

      <Line label="파일 크기(SVG)" value={`약 ${num(Math.round(svgs[0].svg.length / 102.4) / 10, 1)}KB`} />
      <Line label="PNG 저장 크기" value={`${num(pngSize)}px 폭`} />
    </UtilShell>
  );
}
