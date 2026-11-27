/**
 * 진료자료 활용 동의서 — 확인증 그림(캔버스).
 *
 * 같은 그림을 PNG(휴대폰 보관용)와 A4 PDF(인쇄·보관용)에 함께 쓴다.
 * 브라우저 안에서만 그린다 — 서버로 보내는 값이 없다.
 */
import {
  CONSENT_ITEMS,
  PROMISES,
  RETENTION_DAYS,
  formatDateKo,
  formatDateTimeKo,
} from "./engine.js";

const FONT_SANS =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, "Cascadia Mono", "Noto Sans Mono CJK KR", monospace';

export const SHEET_RATIO = 210 / 297; // A4 세로

const INK = "#14263c";
const INK_SOFT = "#41566c";
const INK_FAINT = "#6c7f92";
const LINE = "#d7dfe6";
const BRAND = "#1233b8";
const BRAND_SOFT = "#eef2ff";
const PAPER = "#ffffff";

function wrap(ctx, text, maxWidth) {
  const out = [];
  let line = "";
  for (const ch of String(text ?? "")) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      out.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const lines = wrap(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function checkMark(ctx, x, y, size, filled) {
  ctx.save();
  ctx.lineWidth = Math.max(1.4, size * 0.12);
  if (filled) {
    ctx.fillStyle = BRAND;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.6, size * 0.15);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.24, y + size * 0.52);
    ctx.lineTo(x + size * 0.44, y + size * 0.72);
    ctx.lineTo(x + size * 0.78, y + size * 0.3);
    ctx.stroke();
  } else {
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 확인증 한 장을 그린다.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} record  { no, at, name, phone, birth, checks, signature, hasSignature, example }
 * @param {object} opts    { width, height, signatureImage(HTMLImageElement|null), origin }
 */
export function drawConsentSheet(ctx, record, opts) {
  const W = opts.width;
  const H = opts.height;
  const pad = W * 0.066;
  const contentW = W - pad * 2;
  const px = (n) => (n / 720) * W; // 720 기준 좌표를 화면 폭에 맞춘다

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // ── 머리 띠
  const headH = px(124);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, headH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${px(13)}px ${FONT_SANS}`;
  ctx.fillText("버핏킴즈 · 금융생활 도구", pad, px(34));
  ctx.font = `800 ${px(30)}px ${FONT_SANS}`;
  ctx.fillText("진료자료 활용 동의서", pad, px(78));
  ctx.font = `500 ${px(13)}px ${FONT_SANS}`;
  ctx.fillStyle = "#c7d3e2";
  ctx.fillText("확인증 · 계약 전 알릴의무 확인 및 보장 상담용", pad, px(104));

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${px(13)}px ${FONT_MONO}`;
  ctx.fillText(record.no, W - pad, px(52));
  ctx.fillStyle = "#c7d3e2";
  ctx.font = `500 ${px(11.5)}px ${FONT_SANS}`;
  ctx.fillText(record.example ? "가상 예시 · 효력 없음" : "고객 서명 확인증", W - pad, px(74));
  ctx.textAlign = "left";

  let y = headH + px(26);

  // ── 동의 정보 표
  const rows = [
    ["성명", record.name],
    ["생년월일", `${record.birth} (${formatDateKo(record.birth)})`],
    ["연락처", record.phone],
    ["동의 일시", formatDateTimeKo(record.at)],
  ];
  const rowH = px(34);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1, px(1));
  roundRect(ctx, pad, y, contentW, rowH * rows.length, px(8));
  ctx.stroke();
  rows.forEach(([k, v], i) => {
    const ry = y + i * rowH;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(pad, ry);
      ctx.lineTo(pad + contentW, ry);
      ctx.stroke();
    }
    ctx.fillStyle = "#f5f7f9";
    ctx.fillRect(pad + 1, ry + 1, px(120), rowH - 2);
    ctx.fillStyle = INK_FAINT;
    ctx.font = `600 ${px(12.5)}px ${FONT_SANS}`;
    ctx.fillText(k, pad + px(14), ry + rowH * 0.63);
    ctx.fillStyle = INK;
    ctx.font = `600 ${px(13)}px ${FONT_SANS}`;
    ctx.fillText(String(v ?? "-"), pad + px(146), ry + rowH * 0.63);
  });
  y += rowH * rows.length + px(22);

  // ── 동의 항목
  ctx.fillStyle = INK;
  ctx.font = `800 ${px(16)}px ${FONT_SANS}`;
  ctx.fillText("동의 항목", pad, y + px(16));
  y += px(28);

  for (const item of CONSENT_ITEMS) {
    const checked = Boolean(record.checks?.[item.key]);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(1, px(1));
    roundRect(ctx, pad, y, contentW, px(92), px(8));
    ctx.fill();
    ctx.stroke();
    checkMark(ctx, pad + px(14), y + px(15), px(17), checked);
    ctx.fillStyle = INK;
    ctx.font = `700 ${px(13.5)}px ${FONT_SANS}`;
    ctx.fillText(item.title + (item.required ? " (필수)" : " (선택)"), pad + px(42), y + px(29));
    ctx.textAlign = "right";
    ctx.fillStyle = checked ? BRAND : INK_FAINT;
    ctx.font = `700 ${px(12)}px ${FONT_SANS}`;
    ctx.fillText(checked ? "동의함" : "동의하지 않음", pad + contentW - px(14), y + px(29));
    ctx.textAlign = "left";
    let ly = y + px(48);
    for (const [k, v] of item.lines.slice(0, 2)) {
      ctx.fillStyle = INK_FAINT;
      ctx.font = `600 ${px(10.5)}px ${FONT_SANS}`;
      ctx.fillText(k, pad + px(42), ly);
      ctx.fillStyle = INK_SOFT;
      ctx.font = `500 ${px(10.5)}px ${FONT_SANS}`;
      const text = String(v);
      const maxW = contentW - px(42) - px(60);
      ctx.fillText(wrap(ctx, text, maxW)[0] + (ctx.measureText(text).width > maxW ? "…" : ""), pad + px(42) + px(52), ly);
      ly += px(15);
    }
    y += px(100);
  }

  // 보유기간·거부권 — 항목마다 되풀이하지 않고 한 곳에 모아 적는다.
  ctx.fillStyle = INK_FAINT;
  ctx.font = `500 ${px(10)}px ${FONT_SANS}`;
  const retention =
    `보유기간: 목적 달성 후 지체 없이 파기(최대 ${RETENTION_DAYS}일) · ` +
    "동의 거부권: 동의를 거부할 수 있으며, 거부하면 진료자료를 활용한 고지 확인과 보장 상담이 어렵습니다.";
  drawWrapped(ctx, retention, pad, y + px(8), contentW, px(12.5), 2);
  y += px(32);

  // ── 서명
  const sigH = px(140);
  ctx.fillStyle = "#fbfcfe";
  ctx.strokeStyle = LINE;
  roundRect(ctx, pad, y, contentW, sigH, px(8));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK_FAINT;
  ctx.font = `600 ${px(11.5)}px ${FONT_SANS}`;
  ctx.fillText("서명 (본인이 직접 작성)", pad + px(14), y + px(20));
  ctx.textAlign = "right";
  ctx.fillText(formatDateKo(record.at?.slice(0, 10) ?? ""), pad + contentW - px(14), y + px(20));
  ctx.textAlign = "left";
  if (opts.signatureImage) {
    const maxW = contentW - px(28);
    const maxH = sigH - px(36);
    const iw = opts.signatureImage.width;
    const ih = opts.signatureImage.height;
    const scale = Math.min(maxW / iw, maxH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(opts.signatureImage, pad + px(14) + (maxW - dw) / 2, y + px(28) + (maxH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `500 ${px(11)}px ${FONT_SANS}`;
    ctx.fillText("서명 이미지 없음", pad + px(14), y + sigH * 0.62);
  }
  y += sigH + px(18);

  // ── 다섯 약속(요약)
  ctx.fillStyle = BRAND_SOFT;
  roundRect(ctx, pad, y, contentW, px(104), px(8));
  ctx.fill();
  ctx.fillStyle = BRAND;
  ctx.font = `800 ${px(12)}px ${FONT_SANS}`;
  ctx.fillText("심평원 진료자료 안전 확인 5대 약속", pad + px(14), y + px(21));
  ctx.font = `500 ${px(10.5)}px ${FONT_SANS}`;
  ctx.fillStyle = INK_SOFT;
  let py = y + px(40);
  for (const p of PROMISES) {
    ctx.fillStyle = BRAND;
    ctx.font = `700 ${px(10.5)}px ${FONT_SANS}`;
    ctx.fillText(`${p.no}`, pad + px(14), py);
    ctx.fillStyle = INK_SOFT;
    ctx.font = `500 ${px(10.5)}px ${FONT_SANS}`;
    ctx.fillText(p.title, pad + px(30), py);
    py += px(14);
  }
  y += px(104) + px(16);

  // ── 바닥 안내
  ctx.fillStyle = INK_FAINT;
  ctx.font = `500 ${px(9.5)}px ${FONT_SANS}`;
  const note =
    `이 확인증은 고객 기기에서 만들어졌으며 서버로 전송되지 않았습니다. 받은 진료자료와 확인증 사본은 확인 후 ${RETENTION_DAYS}일 안에 파기합니다. ` +
    "이 동의서는 상담 전 확인용이며, 보험회사 청약서의 고지의무를 대신하지 않습니다.";
  drawWrapped(ctx, note, pad, y, contentW, px(13), 3);

  // ── 가상 예시 표식
  if (record.example) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(190, 40, 40, 0.13)";
    ctx.font = `800 ${px(74)}px ${FONT_SANS}`;
    ctx.fillText("가상 예시 · 효력 없음", 0, 0);
    ctx.restore();
  }

  ctx.restore();
  return { width: W, height: H };
}

/** 서명 캔버스(dataURL)를 이미지로 읽는다. 없으면 null. */
export function loadSignatureImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** PNG 확인증을 Blob으로 만든다. */
export async function makeConsentPng(record, opts = {}) {
  const width = opts.width ?? 1080;
  const height = Math.round(width / SHEET_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const signatureImage = await loadSignatureImage(record.signature);
  drawConsentSheet(ctx, record, { width, height, signatureImage, origin: opts.origin });
  const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  return blob;
}

/** A4 PDF(1장)를 만든다 — 그림을 A4 크기에 맞춰 넣는다(글꼴 파일이 필요 없다). */
export async function makeConsentPdf(record, opts = {}) {
  const { PDFDocument } = await import("pdf-lib");
  const pxW = 1240; // 150dpi A4 폭
  const pxH = Math.round(pxW / SHEET_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  const signatureImage = await loadSignatureImage(record.signature);
  drawConsentSheet(ctx, record, { width: pxW, height: pxH, signatureImage, origin: opts.origin });
  const jpeg = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = await PDFDocument.create();
  pdf.setTitle("진료자료 활용 동의서");
  pdf.setAuthor("버핏킴즈");
  pdf.setSubject("진료자료 활용 동의 확인증");
  pdf.setCreator("buffetkimz.com — 기기 안에서 만든 PDF");
  pdf.setProducer("버핏킴즈");
  const page = pdf.addPage([595.28, 841.89]);
  const img = await pdf.embedJpg(jpeg);
  page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}
