/**
 * 진료비 영수증 읽기 — 사진·PDF를 **브라우저 안에서만** 글자로 바꾼다.
 *
 *  · 글자가 들어 있는 PDF : PDF.js(사이트 번들)로 글자와 좌표를 뽑는다 → 거의 100% 정확
 *  · 스캔 PDF             : 페이지를 그림으로 그린 뒤 OCR
 *  · 사진(JPG·PNG·WEBP)   : Tesseract(한국어+영문) OCR + 사진 보정
 *
 * 엔진 파일은 `public/vendor/ocr/` 에서만 가져온다 — 외부 CDN·외부 서버 전송이 없다.
 * 파일 내용은 어느 시점에도 이 기기 밖으로 나가지 않는다(네트워크 요청은 우리 사이트의 정적 파일뿐).
 *
 * 결과는 `receiptParser.js` 가 먹는 '줄 목록'(칸은 탭)이다. 칸을 탭으로 나눠 두면
 * "본인부담금  12,000" 처럼 라벨과 값이 같은 줄에 있는 표를 파서가 정확히 읽는다.
 */

import { parseReceiptLines, type ReceiptParse } from "./receiptParser";

/** 진행 상태 문구와 진행률(%)을 화면에 그대로 보여 준다 */
export type StatusFn = (msg: string, pct?: number) => void;

export type ReadResult = {
  lines: string[];
  modes: string[];
  ms: number;
  pages: number;
  /** 진행률(0~100) — 화면 진행 바 */
  progress: number;
};

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
/**
 * 엔진 파일 주소는 **절대 주소**여야 한다.
 * 워커는 Blob URL로 만들기 때문에, 그 안에서 importScripts('vendor/ocr/…')처럼 상대 주소를 쓰면
 * blob: 기준으로 풀려 파일을 찾지 못한다(2026-11-27 실측).
 */
const ocrBase = () => new URL(`${BASE}/vendor/ocr/`, typeof location !== "undefined" ? location.href : "https://buffetkimz.com/").href;
const OCR_BASE = ocrBase();

/* ───────────────────────── 워커 ───────────────────────── */

/**
 * Tesseract 코어를 워커 안에서 돌린다(메인 스레드를 멈추지 않게).
 * 코어 파일은 우리 사이트의 vendor/ocr 에서만 importScripts 한다.
 */
const WORKER_SRC = `
let M = null, api = null, cur = 0;
const SIMD = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
async function gunzip(b) {
  if (!(b[0] === 31 && b[1] === 139)) return b;
  const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
self.onmessage = async (e) => {
  const { id, cmd, a } = e.data; cur = id;
  try {
    if (cmd === 'init') {
      const simd = WebAssembly.validate(SIMD);
      importScripts(a.core + (simd ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'));
      M = await TesseractCore({ locateFile: (f) => a.core + f, TesseractProgress: (p) => self.postMessage({ id: cur, progress: p }) });
      for (const l of a.langs) {
        const r = await fetch(l.url);
        if (!r.ok) throw new Error('언어 데이터를 받지 못했습니다 (' + l.url + ' ' + r.status + ')');
        M.FS.writeFile(l.name, await gunzip(new Uint8Array(await r.arrayBuffer())));
      }
      api = new M.TessBaseAPI();
      if (api.Init(null, a.lang) === -1) throw new Error('인식 엔진을 시작하지 못했습니다');
      api.SetVariable('user_defined_dpi', '300');
      self.postMessage({ id, ok: true, simd });
      return;
    }
    if (cmd === 'rec') {
      M.FS.writeFile('/input', a.img);
      api.SetVariable('tessedit_pageseg_mode', String(a.psm || 3));
      if (api.SetImageFile(1, 0) === 1) throw new Error('이미지를 읽지 못했습니다');
      api.Recognize(null);
      self.postMessage({ id, ok: true, tsv: api.GetTSVText(0), conf: api.MeanTextConf() });
      return;
    }
  } catch (err) { self.postMessage({ id, ok: false, err: String((err && err.message) || err) }); }
};
`;

type Pending = { res: (v: { tsv: string; conf: number }) => void; rej: (e: Error) => void; prog?: (p: number) => void };

const engine: { ready: Promise<boolean> | null; worker: Worker | null; cb: Record<number, Pending>; seq: number; simd: boolean } = {
  ready: null,
  worker: null,
  cb: {},
  seq: 0,
  simd: false,
};

function call(cmd: string, args: unknown, onProgress?: (p: number) => void, timeout = 180000) {
  return new Promise<{ tsv: string; conf: number }>((res, rej) => {
    const id = ++engine.seq;
    const t = setTimeout(() => {
      delete engine.cb[id];
      rej(new Error("글자 인식 시간이 너무 오래 걸립니다. 사진 크기를 줄이거나 다시 시도해 주세요."));
    }, timeout);
    engine.cb[id] = { res: (v) => (clearTimeout(t), res(v)), rej: (e) => (clearTimeout(t), rej(e)), prog: onProgress };
    engine.worker!.postMessage({ id, cmd, a: args }, []);
  });
}

/** 엔진 준비 — 처음 한 번만. 이미 받은 파일은 브라우저 캐시에서 온다 */
async function initEngine(onStatus?: StatusFn) {
  if (engine.ready) return engine.ready;
  engine.ready = (async () => {
    onStatus?.("글자 인식 엔진 준비 중… (처음 한 번만, 몇 초)");
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    const w = new Worker(url);
    engine.worker = w;
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { id: number; ok?: boolean; err?: string; tsv?: string; conf?: number; progress?: number };
      const cb = engine.cb[m.id];
      if (!cb) return;
      if (m.progress != null) {
        cb.prog?.(m.progress);
        return;
      }
      delete engine.cb[m.id];
      if (m.ok) cb.res({ tsv: m.tsv || "", conf: m.conf || 0 });
      else cb.rej(new Error(m.err || "인식 엔진 오류"));
    };
    w.onerror = (e) => {
      for (const k of Object.keys(engine.cb)) {
        engine.cb[Number(k)].rej(new Error((e as ErrorEvent).message || "인식 엔진 오류"));
        delete engine.cb[Number(k)];
      }
    };
    const langs = [
      { name: "kor.traineddata", url: `${OCR_BASE}kor.traineddata` },
      { name: "eng.traineddata", url: `${OCR_BASE}eng.traineddata` },
    ];
    const m = (await call("init", { core: OCR_BASE, langs, lang: "kor+eng" }, undefined, 120000)) as unknown as { simd?: boolean };
    engine.simd = Boolean(m?.simd);
    return true;
  })().catch((e) => {
    engine.ready = null;
    try {
      engine.worker?.terminate();
    } catch {
      /* 이미 끝난 워커 */
    }
    engine.worker = null;
    throw new Error(`글자 인식 엔진을 불러오지 못했습니다 — 잠시 뒤 다시 시도하거나 PDF로 올려 주세요. (${(e as Error).message})`);
  });
  return engine.ready;
}

/* ───────────────────── 사진 준비·보정 ───────────────────── */

type Bitmap = ImageBitmap | HTMLImageElement;

async function loadBitmap(file: Blob): Promise<Bitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("이미지를 열 수 없습니다."));
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
}

/** 글자가 알맞은 크기가 되게 확대하고 회색조로 — 영수증은 작은 글씨가 많다 */
function toCanvas(img: Bitmap) {
  const w0 = (img as ImageBitmap).width;
  const h0 = (img as ImageBitmap).height;
  let s = 1;
  if (w0 < 1500) s = Math.min(3, 1800 / w0);
  if (w0 * s > 2800) s = 2800 / w0;
  if (h0 * s > 4200) s = Math.min(s, 4200 / h0);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w0 * s));
  cv.height = Math.max(1, Math.round(h0 * s));
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, cv.width, cv.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(img as CanvasImageSource, 0, 0, cv.width, cv.height);
  const d = g.getImageData(0, 0, cv.width, cv.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000;
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  return cv;
}

/**
 * 사진 보정 — 주변 밝기를 기준으로 흑백을 가른다(그림자·형광등 얼룩 제거).
 * 영수증은 표 선이 많아, 선을 지우는 대신 대비만 세게 준다(선을 지우면 글자도 함께 끊긴다).
 */
function cleanCanvas(cv: HTMLCanvasElement) {
  const w = cv.width;
  const h = cv.height;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, w, h);
  const p = img.data;
  const W1 = w + 1;
  const ii = new Uint32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += p[(y * w + x) * 4];
      ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + row;
    }
  }
  const r = Math.max(15, ((Math.min(w, h) / 60) | 0) | 1);
  const out = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s = ii[y1 * W1 + x1] - ii[y0 * W1 + x1] - ii[y1 * W1 + x0] + ii[y0 * W1 + x0];
      const mean = s / ((y1 - y0) * (x1 - x0));
      const v = p[(y * w + x) * 4];
      const c = v < mean * 0.86 ? 0 : 255;
      const i = (y * w + x) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = c;
      out.data[i + 3] = 255;
    }
  }
  const c2 = document.createElement("canvas");
  c2.width = w;
  c2.height = h;
  c2.getContext("2d")!.putImageData(out, 0, 0);
  return c2;
}

const canvasPNG = (cv: HTMLCanvasElement) =>
  new Promise<Uint8Array>((res) => cv.toBlob((b) => b!.arrayBuffer().then((a) => res(new Uint8Array(a))), "image/png"));

/* ─────────────── Tesseract TSV → 줄(칸은 탭) ─────────────── */

type Word = { x0: number; y0: number; x1: number; y1: number; cy: number; t: string; ln: string };

function tsvWords(tsv: string): Word[] {
  const out: Word[] = [];
  for (const ln of String(tsv || "").split("\n")) {
    const p = ln.split("\t");
    if (p.length < 12 || p[0] !== "5") continue;
    const t = p[11].trim();
    if (!t) continue;
    const x = +p[6];
    const y = +p[7];
    const w = +p[8];
    const h = +p[9];
    out.push({ x0: x, y0: y, x1: x + w, y1: y + h, cy: y + h / 2, t, ln: p.slice(1, 5).join(".") });
  }
  return out;
}

const HANGUL = /^[가-힣]+$/;

/** 단어 상자 → 줄. 기울어진 사진은 기울기를 보정해 같은 행을 맞춘다 */
function wordsToLines(words: Word[]): string[] {
  if (!words.length) return [];
  /* 기울기 — 줄마다 가장 왼쪽·오른쪽 단어의 중심을 이은 기울기의 중앙값 */
  const byLine: Record<string, Word[]> = {};
  for (const w of words) (byLine[w.ln || ""] ||= []).push(w);
  const slopes: number[] = [];
  for (const ws of Object.values(byLine)) {
    if (ws.length < 2) continue;
    ws.sort((a, b) => a.x0 - b.x0);
    const a = ws[0];
    const b = ws[ws.length - 1];
    const dx = (b.x0 + b.x1) / 2 - (a.x0 + a.x1) / 2;
    if (dx < 150) continue;
    slopes.push(((b.y0 + b.y1) / 2 - (a.y0 + a.y1) / 2) / dx);
  }
  slopes.sort((a, b) => a - b);
  const k = slopes.length >= 3 ? slopes[slopes.length >> 1] : 0;
  for (const w of words) w.cy = (w.y0 + w.y1) / 2 - k * ((w.x0 + w.x1) / 2);

  const hs = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const mh = hs[hs.length >> 1] || 10;
  const sorted = words.slice().sort((a, b) => a.cy - b.cy);
  const rows: { cy: number; w: Word[] }[] = [];
  for (const w of sorted) {
    let best: { cy: number; w: Word[] } | null = null;
    for (const r of rows.slice(-6)) if (Math.abs(r.cy - w.cy) < mh * 0.6) best = r;
    if (best) {
      best.w.push(w);
      const n = best.w.length;
      best.cy = (best.cy * (n - 1) + w.cy) / n;
    } else rows.push({ cy: w.cy, w: [w] });
  }
  return rows
    .sort((a, b) => a.cy - b.cy)
    .map((r) => {
      const ws = r.w.sort((a, b) => a.x0 - b.x0);
      const rh = ws.map((w) => w.y1 - w.y0).sort((a, b) => a - b)[ws.length >> 1] || mh;
      let s = "";
      ws.forEach((w, i) => {
        if (i) {
          const p = ws[i - 1];
          const gap = w.x0 - p.x1;
          const single = HANGUL.test(w.t) && HANGUL.test(p.t) && (w.t.length === 1 || p.t.length === 1);
          if (gap > rh * 1.6) s += "\t";
          else if (gap > rh * (single ? 0.55 : 0.3)) s += " ";
        }
        s += w.t;
      });
      return s.trim();
    })
    .filter((s) => s.replace(/[\s|ㅣ\-_.,'"`~^。、ㆍ[\]{}()「」『』]/g, "").length > 0);
}

/** 인식 품질 — 영수증에 꼭 나오는 것(금액·'원'·항목 이름)이 많을수록 높다 */
function quality(lines: string[]): number {
  const t = lines.join("\n");
  let n = 0;
  for (const re of [/\d{1,3}(?:,\d{3})+\s*원?/g, /(?:급여|비급여|본인부담|공단부담|진료비|영수증|병원|의원|약국|처방|입원|외래)/g]) {
    n += (t.match(re) || []).length;
  }
  return n - 0.3 * (t.match(/[|ㅣ_~^[\]{}]/g) || []).length;
}

const meanConf = (tsv: string) => {
  let s = 0;
  let n = 0;
  for (const ln of tsv.split("\n")) {
    const p = ln.split("\t");
    if (p.length < 12 || p[0] !== "5") continue;
    const c = Number(p[10]);
    if (Number.isFinite(c) && c >= 0) {
      s += c;
      n++;
    }
  }
  return n ? s / n : 0;
};

/** 한 장의 그림 → 글자 줄. 원본으로 한 번, 안 되면 보정본으로 한 번 더 읽는다 */
async function ocrCanvasLines(cv: HTMLCanvasElement, onStatus?: StatusFn, from = 0, to = 100) {
  const span = (pct: number) => from + ((to - from) * Math.max(0, Math.min(100, pct))) / 100;
  await initEngine((m) => onStatus?.(m, span(0)));
  onStatus?.("글자 읽는 중… (영수증 1장에 5~15초)", span(12));
  const a = await call("rec", { img: await canvasPNG(cv), psm: 6 }, (p) => onStatus?.(`글자 읽는 중… ${Math.round(p * 100)}%`, span(14 + p * 46)));
  const la = wordsToLines(tsvWords(a.tsv));
  const qa = quality(la);
  const ca = a.conf || meanConf(a.tsv);
  if (ca >= 70 && qa >= 4) return { lines: la, conf: ca, mode: "원본" };
  onStatus?.("사진 보정(그림자·대비) 후 한 번 더 읽는 중…", span(60));
  const b = await call("rec", { img: await canvasPNG(cleanCanvas(cv)), psm: 6 }, (p) => onStatus?.(`보정본 읽는 중… ${Math.round(p * 100)}%`, span(64 + p * 36)));
  const lb = wordsToLines(tsvWords(b.tsv));
  const qb = quality(lb);
  const cb = b.conf || meanConf(b.tsv);
  const better = qb * 3 + cb > qa * 3 + ca ? { lines: lb, conf: cb, mode: "보정" } : { lines: la, conf: ca, mode: "원본" };
  return better;
}

/* ───────────────────────── PDF ───────────────────────── */

type PdfWord = Word & { h: number };

/** 한 페이지의 글자 상자 → 줄 (PDF는 좌표가 아래에서 위로 오는 경우가 있어 방향을 먼저 본다) */
function pdfWordsToLines(items: PdfWord[], pageHeight: number): string[] {
  if (!items.length) return [];
  const ys = items.map((i) => i.y0).sort((a, b) => a - b);
  const topDown = items[0].y0 <= ys[ys.length >> 1];
  for (const it of items) {
    const cy = topDown ? it.y0 : pageHeight - it.y0;
    it.cy = cy;
    it.y1 = cy + it.h / 2;
    it.y0 = cy - it.h / 2;
  }
  return wordsToLines(items);
}

async function pdfLines(file: File, onStatus?: StatusFn, from = 0, to = 100) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const out: string[] = [];
  const modes: string[] = [];
  const n = doc.numPages || 1;
  for (let i = 1; i <= n; i++) {
    onStatus?.(`PDF ${i}/${n}쪽 읽는 중…`, from + ((to - from) * (i - 1)) / n);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: PdfWord[] = [];
    for (const it of tc.items as { str?: string; transform?: number[]; width?: number; height?: number }[]) {
      const s = (it.str || "").trim();
      if (!s || !it.transform) continue;
      const tr = it.transform;
      const h = Math.hypot(tr[2], tr[3]) || it.height || 10;
      const x0 = tr[4];
      items.push({ x0, x1: x0 + (it.width || s.length * h * 0.6), y0: tr[5], y1: tr[5], cy: tr[5], h, t: s.replace(/\s+/g, " "), ln: "" });
    }
    const chars = items.reduce((a, w) => a + w.t.replace(/\s/g, "").length, 0);
    if (chars >= 25) {
      out.push(...pdfWordsToLines(items, vp.height), "");
      modes.push(`PDF ${i}쪽 글자 그대로`);
      continue;
    }
    /* 스캔본 — 페이지를 그림으로 그려 OCR */
    onStatus?.(`PDF ${i}/${n}쪽 — 그림만 있어 글자 인식 중… (5~15초)`, from + ((to - from) * (i - 1)) / n + 2);
    const sc = Math.min(3, 2000 / vp.width);
    const v2 = page.getViewport({ scale: sc });
    const cv = document.createElement("canvas");
    cv.width = Math.round(v2.width);
    cv.height = Math.round(v2.height);
    const g = cv.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: g, canvas: cv, viewport: v2 } as Parameters<typeof page.render>[0]).promise;
    const r = await ocrCanvasLines(
      cv,
      (m, pct) => onStatus?.(`PDF ${i}/${n}쪽 · ${m}`, from + ((to - from) * (i - 1 + (pct ?? 0) / 100)) / n),
      from + ((to - from) * (i - 1)) / n,
      from + ((to - from) * i) / n
    );
    out.push(...r.lines, "");
    modes.push(`스캔 PDF ${i}쪽 ${r.mode}`);
  }
  try {
    await doc.destroy();
  } catch {
    /* 이미 닫힘 */
  }
  return { lines: out, modes, pages: n };
}

/* ───────────────────────── 진입점 ───────────────────────── */

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
const isImage = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(f.name || "");

/** 올린 파일(들) → 파서가 먹는 줄 목록. 최대 3개까지만 읽는다(영수증·처방전 한 쌍이면 충분) */
export async function readReceiptFiles(files: File[], onStatus?: StatusFn): Promise<ReadResult> {
  const t0 = Date.now();
  const list = files.slice(0, 3).filter((f) => isPdf(f) || isImage(f));
  if (!list.length) throw new Error("사진(JPG·PNG·WEBP) 또는 PDF만 올릴 수 있습니다.");
  const lines: string[] = [];
  const modes: string[] = [];
  let pages = 0;
  const share = 100 / list.length;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const tag = list.length > 1 ? `${i + 1}/${list.length} · ` : "";
    const from = share * i;
    const to = share * (i + 1);
    if (isPdf(f)) {
      const r = await pdfLines(f, (m, pct) => onStatus?.(tag + m, pct), from, to);
      lines.push(...r.lines);
      modes.push(...r.modes);
      pages += r.pages;
    } else {
      onStatus?.(`${tag}사진 읽는 중…`, from);
      const img = await loadBitmap(f);
      const r = await ocrCanvasLines(toCanvas(img), (m, pct) => onStatus?.(tag + m, pct), from, to);
      lines.push(...r.lines, "");
      modes.push(`사진 ${r.mode} · 신뢰도 ${Math.round(r.conf)}`);
      pages += 1;
    }
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return { lines, modes, ms: Date.now() - t0, pages, progress: 100 };
}

/** 파일 없이 '글자 붙여넣기'로도 같은 결과를 낸다(영수증 텍스트를 복사해 온 경우) */
export function readPastedText(text: string) {
  return parseReceiptLines(text.split(/\r?\n/));
}

export type { ReceiptParse };
