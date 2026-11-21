import { useEffect, useMemo, useRef, useState } from "react";
import { TextArea, TextInput, UtilShell } from "./UtilShell";

/**
 * 텍스트 → 4:5 카드 이미지.
 *
 * 미리보기를 DOM이 아니라 캔버스에 직접 그린다. 화면에 보이는 것과 내려받는 PNG가
 * 같은 캔버스라서 글자 위치·줄바꿈이 어긋나지 않는다. 외부 라이브러리 없이 1080×1350.
 */

type Theme = "dark" | "cream" | "green";

const THEMES: Record<Theme, { label: string; bg: string; text: string; muted: string; accent: string; rule: string; dot: string }> = {
  dark: {
    label: "다크",
    bg: "#0b1b29",
    text: "#f7f4ec",
    muted: "#b6c2cc",
    accent: "#58c3a4",
    rule: "rgba(247,244,236,0.20)",
    dot: "#0b1b29",
  },
  cream: {
    label: "크림",
    bg: "#faf7ef",
    text: "#0b1b29",
    muted: "#5b5346",
    accent: "#a85a3b",
    rule: "rgba(11,27,41,0.16)",
    dot: "#faf7ef",
  },
  green: {
    label: "딥그린",
    bg: "#0e5344",
    text: "#f2f0e8",
    muted: "#c2dbd1",
    accent: "#9ed8c5",
    rule: "rgba(242,240,232,0.22)",
    dot: "#0e5344",
  },
};

const W = 1080;
const H = 1350;
const PAD = 96;
const FONT = `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`;

const SAMPLE_TITLE = "실손보험, 세대가 바뀌면 내가 내는 돈도 바뀝니다";
const SAMPLE_BODY = `4세대는 비중증 비급여 30%, 5세대는 50%를 내가 부담합니다.
보험료가 낮아진 것과 내가 내는 돈이 줄어든 것은 다른 이야기입니다.`;
const SAMPLE_SOURCE = "기준일 2026. 11. 21. · 보험업 감독규정 개정안";

function tokenize(line: string): string[] {
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const token of tokenize(paragraph)) {
      const next = line + token;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
        continue;
      }
      if (line.trim()) out.push(line.trimEnd());
      line = token.trimStart();
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  return out;
}

function drawCard(
  canvas: HTMLCanvasElement,
  opts: { title: string; body: string; source: string; theme: Theme }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const t = THEMES[opts.theme];
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  /* 위 브랜드 줄 */
  ctx.fillStyle = t.accent;
  ctx.fillRect(PAD, 104, 56, 6);
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = t.muted;
  ctx.letterSpacing = "6px";
  ctx.fillText("BUFFETKIMZ", PAD, 176);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "right";
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText("금융·연금 메모", W - PAD, 176);
  ctx.textAlign = "left";
  ctx.strokeStyle = t.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 214);
  ctx.lineTo(W - PAD, 214);
  ctx.stroke();

  /* 제목 — 길이에 따라 크기를 낮춰 3줄 안에 담는다 */
  const title = opts.title.trim() || "제목을 입력하세요";
  const titleWidth = W - PAD * 2;
  let titleSize = 88;
  let titleLines: string[] = [];
  for (const size of [92, 84, 74, 64, 56]) {
    ctx.font = `800 ${size}px ${FONT}`;
    const lines = wrapText(ctx, title, titleWidth);
    if (lines.length <= 3) {
      titleSize = size;
      titleLines = lines;
      break;
    }
    titleSize = size;
    titleLines = lines;
  }
  ctx.font = `800 ${titleSize}px ${FONT}`;
  const titleLineHeight = Math.round(titleSize * 1.24);
  titleLines = titleLines.slice(0, 3);

  /* 본문 — 남는 높이만큼만, 넘치면 마지막 줄을 줄임표로 */
  const bodyLineHeight = 58;
  const footerTop = 1150;
  const headerBottom = 214;
  const gap = 34;

  /* 제목·본문 묶음을 위아래 여백 사이에 놓는다 — 짧은 글도 아래가 비어 보이지 않게 */
  const measureTitle = titleLines.length * titleLineHeight;
  const available = footerTop - headerBottom - 40;
  const maxBodyLines = Math.max(0, Math.floor((available - measureTitle - gap) / bodyLineHeight));
  ctx.font = `400 38px ${FONT}`;
  const bodyLines = wrapText(ctx, opts.body.trim(), W - PAD * 2);
  const shown = bodyLines.slice(0, maxBodyLines);
  if (bodyLines.length > shown.length && shown.length > 0) {
    let last = shown[shown.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > W - PAD * 2) last = last.slice(0, -1);
    shown[shown.length - 1] = `${last.replace(/[.,·\s]+$/, "")}…`;
  }
  const blockHeight = measureTitle + (shown.length > 0 ? gap + shown.length * bodyLineHeight : 0);
  const top = headerBottom + Math.max(48, (available - blockHeight) * 0.45);

  ctx.font = `800 ${titleSize}px ${FONT}`;
  ctx.fillStyle = t.text;
  let y = top + titleSize;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += titleLineHeight;
  }

  y += gap;
  ctx.font = `400 38px ${FONT}`;
  ctx.fillStyle = t.muted;
  for (const line of shown) {
    ctx.fillText(line, PAD, y);
    y += bodyLineHeight;
  }

  /* 아래 출처 줄 */
  ctx.strokeStyle = t.rule;
  ctx.beginPath();
  ctx.moveTo(PAD, footerTop);
  ctx.lineTo(W - PAD, footerTop);
  ctx.stroke();
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText(opts.source.trim() || "출처를 입력하세요", PAD, footerTop + 56);
  ctx.textAlign = "right";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = t.accent;
  ctx.fillText("buffetkimz.com", W - PAD, footerTop + 56);
  ctx.textAlign = "left";
}

export default function TextToCard() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [body, setBody] = useState(SAMPLE_BODY);
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [theme, setTheme] = useState<Theme>("dark");
  const [saved, setSaved] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (canvas) drawCard(canvas, { title, body, source, theme });
  };

  useEffect(() => {
    setSaved("");
    draw();
    /* 웹폰트가 늦게 붙으면 글자 폭이 달라지므로, 폰트 준비 뒤 한 번 더 그린다 */
    if (typeof document !== "undefined" && document.fonts?.ready) {
      let alive = true;
      document.fonts.ready.then(() => {
        if (alive) draw();
      });
      return () => {
        alive = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, source, theme]);

  const stamp = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `buffetkimz-card-${theme}-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 3000);
      setSaved(`buffetkimz-card-${theme}-${stamp}.png`);
    }, "image/png");
  };

  return (
    <UtilShell
      id="text-to-card"
      title="텍스트 → 카드 이미지"
      subtitle="제목·본문·출처를 넣으면 1080×1350(4:5) PNG 카드로 그려 드립니다."
      note={
        <>
          카드는 <strong className="font-semibold text-ink">이 브라우저의 캔버스에서</strong> 그려집니다. 입력한 글은
          서버로 보내지 않고, 내려받은 PNG만 남습니다.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_0.92fr] md:gap-5">
        <div className="space-y-3">
          <TextInput
            label="제목"
            value={title}
            onChange={setTitle}
            maxLength={60}
            placeholder="한 줄로 말하고 싶은 것"
          />
          <TextArea
            label="본문"
            value={body}
            onChange={setBody}
            rows={5}
            hint={`${body.length}자 · 줄바꿈은 그대로 들어갑니다. 길면 아래에서 잘립니다.`}
          />
          <TextInput label="출처" value={source} onChange={setSource} maxLength={80} placeholder="기준일·자료 이름" />

          <div>
            <p className="field-label">배경 테마</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(THEMES) as Theme[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={theme === k}
                  onClick={() => setTheme(k)}
                  className={
                    "inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold transition-colors " +
                    (theme === k
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-white text-ink-soft hover:border-brand/40")
                  }
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-line"
                    style={{ backgroundColor: THEMES[k].dot }}
                  />
                  {THEMES[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white px-3.5 py-3 text-[12px] leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink">카드 규격</p>
            <p className="mt-1">
              1080 × 1350 · 4:5 · PNG. 인스타그램 피드·스레드 이미지에 그대로 올릴 수 있는 비율입니다. 제목은 길이에
              따라 글자 크기를 줄여 세 줄까지 담고, 본문은 남는 자리만큼만 넣습니다.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="field-label">미리보기</p>
              <p className="mt-0.5 text-[12px] text-ink-muted">저장되는 이미지와 같은 화면입니다.</p>
            </div>
            <span className="chip !min-h-[26px] !text-[11.5px]">1080×1350</span>
          </div>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-paper-deep p-2">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="mx-auto block h-auto w-full max-w-[380px] rounded-lg"
              data-card-canvas
              aria-label="카드 미리보기"
            />
          </div>
          <button
            type="button"
            onClick={download}
            data-card-download
            className="mt-2.5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-deep"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.6v11.2M7.6 10.4 12 14.8l4.4-4.4M4.4 18.4v1.4a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-1.4" />
            </svg>
            PNG 내려받기
          </button>
          {saved && (
            <p className="mt-1.5 text-center text-[12px] text-ink-muted" data-card-saved>
              저장했습니다 · <span className="mono">{saved}</span>
            </p>
          )}
        </div>
      </div>
    </UtilShell>
  );
}
