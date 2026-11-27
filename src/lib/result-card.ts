/**
 * 계산 결과 카드 이미지 — 기기 안에서만 그린다(v9.8.0).
 *
 * 왜 필요한가
 *  · 숫자를 본 사람이 그 화면을 닫으면 결과가 남지 않는다. 계산을 마친 사람이
 *    "내 숫자"를 저장·공유할 수 있으면 다시 열 이유가 생긴다.
 *
 * 지키는 것
 *  · 캔버스에서 그려 PNG로 내려받는다 — 입력값을 서버로 보내지 않는다(외부 전송 0건).
 *  · 카드에는 도구 이름·입력 요약·결과·기준일·사이트 주소만 적는다. 개인 식별 정보는 넣지 않는다.
 *  · 색은 DESIGN.md 토큰(잉크·종이·행동 파랑)만 쓴다. 새 색·로고를 만들지 않는다.
 */

export type ResultCardRow = { label: string; value: string; sub?: string };

export type ResultCardInput = {
  /** 카드 위 작은 라벨 — 'buffetkimz · 계산 결과' */
  kicker?: string;
  title: string;
  /** 입력 요약 한 줄 */
  subtitle?: string;
  rows: ResultCardRow[];
  /** 아래 작은 글씨 2~3줄 — 가정·한계·기준일 */
  notes?: string[];
  /** 파일 이름 앞부분 */
  fileBase?: string;
};

const INK = "#0b1b29";
const INK_MUTED = "#3f4b57";
const INK_FAINT = "#55626e";
const PAPER = "#faf9f6";
const PAPER_DEEP = "#f2f0e8";
const BRAND = "#1a4ffd";
const LINE = "#dde3e8";

const FONT = '"Pretendard Variable", Pretendard, -apple-system, system-ui, "Apple SD Gothic Neo", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      out.push(line);
      line = ch;
      if (out.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (out.length < maxLines && line) out.push(line);
  if (out.length === maxLines && (line || text.length > out.join("").length)) {
    const joined = out.join("");
    if (joined.length < text.length) out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + "…";
  }
  return out;
}

/** 캔버스에 결과 카드를 그리고 data URL을 돌려준다. */
export function renderResultCard(input: ResultCardInput): string {
  const W = 1080;
  const H = 1350;
  const pad = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  /* 위 띠 — 행동 파랑은 이 한 줄에만 */
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 10);

  let y = 96;
  ctx.textBaseline = "top";

  ctx.fillStyle = INK_FAINT;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(input.kicker ?? "buffetkimz · 계산 결과", pad, y);
  y += 52;

  ctx.fillStyle = INK;
  ctx.font = `700 56px ${FONT}`;
  for (const line of wrap(ctx, input.title, W - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 70;
  }

  if (input.subtitle) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `400 28px ${FONT}`;
    for (const line of wrap(ctx, input.subtitle, W - pad * 2, 2)) {
      ctx.fillText(line, pad, y);
      y += 40;
    }
  }

  y += 16;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 34;

  const rows = input.rows.slice(0, 5);
  for (const row of rows) {
    const first = row === rows[0];
    ctx.fillStyle = INK_FAINT;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(row.label, pad, y + (first ? 14 : 6));

    ctx.textAlign = "right";
    ctx.fillStyle = first ? BRAND : INK;
    ctx.font = `700 ${first ? 54 : 38}px ${FONT}`;
    ctx.fillText(row.value, W - pad, y + (first ? -2 : 8));
    ctx.textAlign = "left";
    y += first ? 66 : 54;

    if (row.sub) {
      ctx.fillStyle = INK_FAINT;
      ctx.font = `400 23px ${FONT}`;
      for (const line of wrap(ctx, row.sub, W - pad * 2 - 24, 2)) {
        ctx.fillText(line, pad + 18, y);
        y += 32;
      }
    }
    y += first ? 16 : 10;
  }

  /* 아래 메모 — 결과 바로 밑에 붙여 빈 공간을 만들지 않는다 */
  const notes = (input.notes ?? []).slice(0, 3);
  if (notes.length) {
    y += 14;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
    y += 22;
    ctx.fillStyle = INK_MUTED;
    ctx.font = `400 23px ${FONT}`;
    for (const note of notes) {
      for (const line of wrap(ctx, note, W - pad * 2, 2)) {
        ctx.fillText(line, pad, y);
        y += 33;
      }
    }
  }

  /* 아래 띠 — 빈 공간을 '여백'으로 읽히게 하는 마감선 */
  ctx.fillStyle = PAPER_DEEP;
  ctx.fillRect(0, H - 124, W, 124);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, H - 124);
  ctx.lineTo(W, H - 124);
  ctx.stroke();
  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText("입력값은 서버로 전송되지 않았습니다", pad, H - 74);
  ctx.textAlign = "right";
  ctx.fillText("buffetkimz.com", W - pad, H - 74);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

/** data URL을 파일로 내려받는다. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
