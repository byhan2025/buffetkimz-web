/**
 * QR 코드 생성기 — 외부 API 없이 `qrcode` 라이브러리가 만든 모듈 행렬을
 * SVG path와 Canvas로 직접 그린다. 색·여백·크기를 그대로 반영한다.
 */
import { useMemo, useState } from "react";
import {
  Btn,
  Label,
  LocalNote,
  Panel,
  PanelTitle,
  RangeRow,
  Select,
  Stat,
  TextInput,
  UtilityShell,
  canvasToBlob,
  downloadBlob,
} from "./kit";
// qrcode는 브라우저 빌드(lib/browser.js)로 들어온다 — Node 전용 모듈은 번들에 없다.
import QRCode from "qrcode";

type Kind = "link" | "text" | "tel" | "email";
type Level = "L" | "M" | "Q" | "H";

const LEVEL_LABEL: Record<Level, string> = {
  L: "L · 7% 복원",
  M: "M · 15% 복원",
  Q: "Q · 25% 복원",
  H: "H · 30% 복원 (로고 넣을 때)",
};

const PRESET_COLORS = ["#0b1b29", "#1233b8", "#1a4ffd", "#a85a3b", "#ffffff"];

/** 모듈 행렬 → SVG path. 가로로 이어진 칸은 한 번에 그려 path 길이를 줄인다. */
function matrixToPath(size: number, data: Uint8Array, offset: number): string {
  const parts: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        const start = x;
        while (x < size && data[y * size + x]) x += 1;
        parts.push(`M${start + offset} ${y + offset}h${x - start}v1H${start + offset}z`);
      } else {
        x += 1;
      }
    }
  }
  return parts.join("");
}

function payloadOf(kind: Kind, value: string): { payload: string; shown: string } {
  const v = value.trim();
  if (kind === "tel") {
    const digits = v.replace(/[^\d+]/g, "");
    return { payload: digits ? `tel:${digits}` : "", shown: digits ? `tel:${digits}` : "" };
  }
  if (kind === "email") {
    return { payload: v ? `mailto:${v}` : "", shown: v ? `mailto:${v}` : "" };
  }
  if (kind === "link") {
    if (!v) return { payload: "", shown: "" };
    const fixed = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    return { payload: fixed, shown: fixed };
  }
  return { payload: v, shown: v };
}

export default function QrGenerator({ compact = false }: { compact?: boolean }) {
  const [kind, setKind] = useState<Kind>("link");
  const [value, setValue] = useState("https://buffetkimz.com/apps");
  const [level, setLevel] = useState<Level>("M");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [fg, setFg] = useState("#0b1b29");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);

  const { payload, shown } = payloadOf(kind, value);

  const qr = useMemo(() => {
    if (!payload) return null;
    try {
      const code = QRCode.create(payload, { errorCorrectionLevel: level });
      const n = code.modules.size;
      return {
        version: code.version,
        size: n,
        path: matrixToPath(n, code.modules.data as unknown as Uint8Array, margin),
        viewBox: n + margin * 2,
      };
    } catch {
      return { error: true as const };
    }
  }, [payload, level, margin]);

  const error = Boolean(qr && "error" in qr);

  /** PNG — 모듈 한 칸이 정수 픽셀이 되도록 배율을 정해 그린다. */
  const toPngBlob = async (): Promise<Blob | null> => {
    if (!qr || "error" in qr) return null;
    const total = qr.viewBox;
    const scale = Math.max(1, Math.floor(size / total));
    const px = total * scale;
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, px, px);
    }
    // path는 문자열이라 픽셀로 다시 그릴 수 없어 모듈 행렬을 한 번 더 만든다(수 ms).
    const code = QRCode.create(payload, { errorCorrectionLevel: level });
    const data = code.modules.data as unknown as Uint8Array;
    const n = code.modules.size;
    ctx.fillStyle = fg;
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (data[y * n + x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
    return canvasToBlob(canvas, "image/png");
  };

  const svgString = (): string => {
    if (!qr || "error" in qr) return "";
    const rect = transparent ? "" : `<rect width="${qr.viewBox}" height="${qr.viewBox}" fill="${bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.viewBox} ${qr.viewBox}" shape-rendering="crispEdges" width="${size}" height="${size}">${rect}<path d="${qr.path}" fill="${fg}"/></svg>`;
  };

  const downloadPng = async () => {
    setBusy(true);
    try {
      const blob = await toPngBlob();
      if (blob) downloadBlob(blob, `buffetkimz-qr-${size}.png`);
    } finally {
      setBusy(false);
    }
  };

  const downloadSvg = () => {
    const s = svgString();
    if (!s) return;
    downloadBlob(new Blob([s], { type: "image/svg+xml;charset=utf-8" }), "buffetkimz-qr.svg");
  };

  return (
    <UtilityShell
      title="QR 코드 생성기"
      subtitle="링크·텍스트·전화번호를 QR로 만들고 PNG·SVG로 내려받습니다. 외부 API를 부르지 않습니다."
      steps={["내용 입력", "색·크기 조정", "PNG 또는 SVG 저장"]}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-3">
          <Panel>
            <PanelTitle>담을 내용</PanelTitle>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {(
                [
                  { value: "link", label: "링크" },
                  { value: "text", label: "텍스트" },
                  { value: "tel", label: "전화번호" },
                  { value: "email", label: "이메일" },
                ] as { value: Kind; label: string }[]
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={kind === o.value}
                  onClick={() => {
                    setKind(o.value);
                    setValue(
                      o.value === "link"
                        ? "https://buffetkimz.com/apps"
                        : o.value === "tel"
                          ? "010-4908-4175"
                          : o.value === "email"
                            ? "hello@buffetkimz.com"
                            : "buffetkimz · 연금·보험 계산 노트",
                    );
                  }}
                  className={
                    "min-h-[36px] rounded-full px-3 text-[12px] font-semibold transition-colors " +
                    (kind === o.value
                      ? "bg-brand text-white"
                      : "border border-line bg-white text-ink-soft hover:border-brand/45 hover:text-brand")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Label htmlFor="qr-value" hint={kind === "link" ? "https:// 없이 넣어도 붙여 줍니다" : undefined}>
              {kind === "link" ? "주소" : kind === "text" ? "문구" : kind === "tel" ? "전화번호" : "메일 주소"}
            </Label>
            <TextInput
              id="qr-value"
              value={value}
              onChange={setValue}
              placeholder={kind === "link" ? "buffetkimz.com" : "내용을 입력하세요"}
              inputMode={kind === "tel" ? "tel" : kind === "link" ? "url" : "text"}
              ariaLabel="QR에 담을 내용"
            />
            {shown && <p className="mono mt-1.5 break-all text-[11px] text-ink-faint">QR에 들어가는 값 · {shown}</p>}
          </Panel>

          <Panel>
            <PanelTitle
              right={
                <span className="mono text-[11.5px] text-ink-faint">
                  모듈 {qr && !error ? `${qr.size}×${qr.size}` : "—"}
                </span>
              }
            >
              모양
            </PanelTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="qr-level">오류 복원</Label>
                <Select
                  id="qr-level"
                  value={level}
                  onChange={setLevel}
                  ariaLabel="오류 복원 수준"
                  options={(Object.keys(LEVEL_LABEL) as Level[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
                />
              </div>
              <div>
                <Label htmlFor="qr-size">내보낼 PNG 크기</Label>
                <Select
                  id="qr-size"
                  value={String(size)}
                  onChange={(v) => setSize(Number(v))}
                  ariaLabel="PNG 크기"
                  options={[256, 512, 1024, 2048].map((s) => ({ value: String(s), label: `${s} × ${s}px` }))}
                />
              </div>
            </div>

            <RangeRow label="여백 (모듈)" value={margin} onChange={setMargin} min={0} max={8} format={(v) => `${v}칸`} />

            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qr-fg">전경색</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="qr-fg"
                    type="color"
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`전경색 ${c}`}
                        onClick={() => setFg(c)}
                        className="h-5 w-5 rounded-full border border-line"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="qr-bg">배경색</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="qr-bg"
                    type="color"
                    value={bg}
                    onChange={(e) => {
                      setBg(e.target.value);
                      setTransparent(false);
                    }}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                  />
                  <button
                    type="button"
                    aria-pressed={transparent}
                    onClick={() => setTransparent((t) => !t)}
                    className={
                      "min-h-[40px] rounded-lg border px-2 text-[11.5px] font-semibold " +
                      (transparent ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-muted")
                    }
                  >
                    투명 배경
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelTitle right={<span className="chip !min-h-[24px] !px-2 !text-[11px]">실시간 미리보기</span>}>
              미리보기
            </PanelTitle>
            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-line bg-[#f6f8f7] p-4">
              {qr && !error ? (
                <svg
                  viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
                  width={compact ? 200 : 240}
                  height={compact ? 200 : 240}
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="생성된 QR 코드"
                  data-qr-preview
                  className="h-auto max-w-full rounded-lg bg-white shadow-[0_10px_30px_-24px_rgba(11,27,41,0.7)]"
                >
                  <rect width={qr.viewBox} height={qr.viewBox} fill={transparent ? "transparent" : bg} />
                  <path d={qr.path} fill={fg} />
                </svg>
              ) : (
                <p className="text-[12px] text-ink-faint">
                  {error ? "내용이 너무 길어 QR로 만들 수 없습니다. 문구를 줄여 주세요." : "내용을 입력하면 QR이 나타납니다."}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="담긴 글자" value={`${payload.length}자`} />
              <Stat
                label="모듈"
                value={qr && !error ? `${qr.size}²` : "—"}
                sub={qr && !error ? `버전 ${qr.version}` : undefined}
              />
              <Stat label="오류 복원" value={level} tone="brand" sub={level === "H" ? "가장 강함" : undefined} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn onClick={downloadPng} disabled={!qr || error || busy} full>
                PNG 저장
              </Btn>
              <Btn tone="secondary" onClick={downloadSvg} disabled={!qr || error} full>
                SVG 저장
              </Btn>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              PNG는 선택한 크기에 맞춰 모듈을 정수 픽셀로 그립니다. 인쇄용은 1024px 이상을 권합니다.
            </p>
          </Panel>

          <LocalNote>입력한 값은 브라우저 메모리에만 있고 서버로 전송되지 않습니다.</LocalNote>
        </div>
      </div>
    </UtilityShell>
  );
}
