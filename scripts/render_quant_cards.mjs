#!/usr/bin/env node
/**
 * 4대 시장 퀀트 스크리닝 카드뉴스 렌더러 — v1.0 (2026-11-24)
 *
 * 왜 만드셨나 — 매일 08:20 퀀트 결과를 6장 카드뉴스로 다시 그리려면, 이미지 생성 모델에
 * 숫자를 맡기면 오타·환각이 섞인다. 그래서 배경 일러스트 6장(scripts/quant-bg/)은 그림으로 두고,
 * 글자·숫자는 HTML/CSS로 100% 선명하게 얹은 뒤 Playwright로 1080×1350 PNG → WebP로 굽는다.
 * 같은 JSON을 넣으면 매일 100% 같은 다크 네이비·골드 디자인이 나온다.
 *
 * 쓰는 법
 *   node scripts/render_quant_cards.mjs --data scripts/quant-data/2026-11-24.json
 *   node scripts/render_quant_cards.mjs --data <json> --gallery          # 자료앨범 세트까지 갱신
 *   node scripts/render_quant_cards.mjs --data <json> --only 1,2,6       # 미리보기 3장만
 *
 * 주요 옵션
 *   --data <path>       카드 내용 JSON (필수)
 *   --out <dir>         WebP 출력 폴더 (기본 public/gallery/quant-screening-daily)
 *   --png <dir>         검수용 PNG 사본 폴더 (기본 /workspace/reports/buffetkimz-web/quant-cards)
 *   --bg-dir <dir>      배경 일러스트 폴더 (기본 scripts/quant-bg)
 *   --only 1,2,6        지정한 장만 렌더(미리보기). 생략하면 6장 전부
 *   --scale 2           렌더 배율(2 = 2160×2700로 그린 뒤 1080×1350로 다운샘플, 기본 2)
 *   --quality 84        WebP 품질
 *   --gallery           public WebP 6장 경로로 galleryItem 블록을 gallery.ts에 생성·갱신
 *   --no-png            PNG 사본을 남기지 않음
 *
 * 환경
 *   PLAYWRIGHT_CORE_PATH  playwright-core 모듈 경로(자동 탐색 실패 시)
 *   QUANT_CHROMIUM        chromium 실행 파일 경로(자동 탐색 실패 시)
 *   QUANT_FONT_DIR        Pretendard 폰트 폴더(기본 /workspace/.local/share/fonts)
 *
 * 종료 코드: 0 성공 · 1 렌더/검증 실패 · 2 사용법 오류
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const WORKSPACE = path.resolve(APP, "..", "..");

// ── 인자 ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const flag = (name) => argv.includes(`--${name}`);

if (flag("help") || argv.length === 0) {
  console.log(
    "사용법: node scripts/render_quant_cards.mjs --data scripts/quant-data/YYYY-MM-DD.json [--gallery] [--only 1,2,6]",
  );
  process.exit(argv.length === 0 ? 2 : 0);
}

const DATA_PATH = path.resolve(APP, String(arg("data") || ""));
const OUT_DIR = path.resolve(APP, String(arg("out") || "public/gallery/quant-screening-daily"));
const PNG_DIR = path.resolve(String(arg("png") || path.join(WORKSPACE, "reports/buffetkimz-web/quant-cards")));
const BG_DIR = path.resolve(APP, String(arg("bg-dir") || "scripts/quant-bg"));
const SCALE = Number(arg("scale", 2));
const QUALITY = Number(arg("quality", 84));
const WRITE_PNG = !flag("no-png");
const ONLY = String(arg("only", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);
const GALLERY = flag("gallery");

if (!arg("data") || !fs.existsSync(DATA_PATH)) {
  console.error(`✗ 데이터 JSON을 찾지 못했습니다: ${DATA_PATH}`);
  process.exit(2);
}

// ── 검증: 금지어·필수값 ──────────────────────────────────────────────────────
const FORBIDDEN = ["실시간", "속보", "긴급", "상담 신청", "문의 주세요", "가입 권유", "지금 바로 가입", "수익 보장"];
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const flat = [];
const walk = (v, p = "") => {
  if (typeof v === "string") flat.push([p, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
};
walk(data);
const hits = flat.filter(([, s]) => FORBIDDEN.some((w) => s.includes(w)));
if (hits.length) {
  console.error("✗ 금지어가 들어 있습니다(카드에는 쓰지 않습니다):");
  for (const [p, s] of hits) console.error(`   ${p}: ${s}`);
  process.exit(1);
}
for (const key of ["date", "headerDate", "cover", "screens", "closing"]) {
  if (!data[key]) {
    console.error(`✗ 필수 항목 누락: ${key}`);
    process.exit(1);
  }
}
if (data.screens.length !== 4) {
  console.error(`✗ screens는 4개(미국주식·미국ETF·국내주식·국내ETF)여야 합니다 — 현재 ${data.screens.length}개`);
  process.exit(1);
}
if ((data.closing.items || []).length !== 3) {
  console.error(`✗ closing.items는 3개여야 합니다 — 현재 ${(data.closing.items || []).length}개`);
  process.exit(1);
}

// ── 의존: playwright-core · chromium · sharp ─────────────────────────────────
const req = createRequire(path.join(APP, "noop.cjs"));
async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE_PATH,
    "playwright-core",
    "playwright",
    "/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core",
  ].filter(Boolean);
  const shape = (mod) => (mod?.chromium ? mod : mod?.default?.chromium ? mod.default : null);
  for (const c of candidates) {
    try {
      const m = shape(await import(pathToFileURL(req.resolve(c)).href));
      if (m) return m;
    } catch {
      /* 다음 후보 */
    }
  }
  // npx 캐시 전역 탐색
  const roots = ["/workspace/.npm/_npx", path.join(WORKSPACE, ".npm/_npx")];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, "node_modules", "playwright-core");
      if (fs.existsSync(p)) {
        const m = shape(await import(pathToFileURL(p).href));
        if (m) return m;
      }
    }
  }
  throw new Error("playwright-core를 찾지 못했습니다. PLAYWRIGHT_CORE_PATH를 지정하세요.");
}

function findChromium() {
  if (process.env.QUANT_CHROMIUM && fs.existsSync(process.env.QUANT_CHROMIUM)) return process.env.QUANT_CHROMIUM;
  const roots = ["/workspace/.cache/ms-playwright", path.join(process.env.HOME || "", ".cache/ms-playwright")];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse();
    for (const d of dirs) {
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

// chromium이 요구하는 시스템 라이브러리(저장소 밖에 풀어 둔 것들)
for (const d of [
  "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu",
  "/workspace/.local/lib",
  "/workspace/.tools/chromelibs",
  "/workspace/.tools/libs/usr/lib/x86_64-linux-gnu",
]) {
  if (fs.existsSync(d)) {
    const cur = process.env.LD_LIBRARY_PATH || "";
    if (!cur.split(":").includes(d)) process.env.LD_LIBRARY_PATH = cur ? `${d}:${cur}` : d;
  }
}

// Pretendard 폰트 — 폰트 폴더를 file:// 로 직접 물린다
const FONT_DIR = process.env.QUANT_FONT_DIR || "/workspace/.local/share/fonts";
const FONT_FILES = {
  400: "Pretendard-Medium.otf",
  500: "Pretendard-Medium.otf",
  600: "Pretendard-SemiBold.otf",
  700: "Pretendard-Bold.otf",
  800: "Pretendard-ExtraBold.otf",
  900: "Pretendard-Black.otf",
};
function fontFaceCss() {
  const out = [];
  for (const [weight, file] of Object.entries(FONT_FILES)) {
    const p = path.join(FONT_DIR, file);
    if (fs.existsSync(p)) {
      out.push(
        `@font-face{font-family:"QuantSans";font-weight:${weight};font-style:normal;font-display:block;src:url("${pathToFileURL(p).href}") format("opentype");}`,
      );
    }
  }
  return out.join("\n");
}

// ── 템플릿 ───────────────────────────────────────────────────────────────────
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bgUrl = (file) => pathToFileURL(path.join(BG_DIR, file)).href;

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1080px;height:1350px;overflow:hidden;}
body{
  font-family:"QuantSans","Noto Sans CJK KR","Noto Sans KR",sans-serif;
  background:linear-gradient(166deg,#0c1e33 0%,#0a1728 46%,#071320 100%);
  color:#fff;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;
}
.card{position:relative;width:1080px;height:1350px;padding:0 44px;display:flex;flex-direction:column;}
.card::after{content:"";position:absolute;inset:16px;border:1px solid rgba(214,190,132,.16);pointer-events:none;}
.corner{position:absolute;height:4px;z-index:5;}
.corner.tl{left:16px;top:4px;width:74px;background:#8fc0e8;}
.corner.br{right:16px;bottom:4px;width:64px;background:#c9a227;}
.header{height:66px;margin-top:34px;display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.16);}
.brand{font-size:30px;font-weight:500;letter-spacing:.2px;color:#e6eef7;}
.hdate{font-size:30px;font-weight:400;letter-spacing:.4px;color:#c8d6e4;}

.hero{position:relative;margin-top:16px;height:534px;overflow:hidden;background:#0a1725;}
.hero .img{position:absolute;inset:0;background-size:cover;background-position:center;}
.hero .fade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,23,40,.30) 0%,rgba(10,23,40,0) 26%,rgba(9,20,35,.18) 52%,rgba(10,23,40,.86) 84%,#0a1728 100%);}
.badge{position:absolute;left:20px;top:20px;z-index:3;padding:9px 15px;border:1px solid rgba(201,162,39,.85);background:rgba(8,19,32,.74);font-size:25px;font-weight:600;letter-spacing:.2px;color:#e6c478;}
.hero .caption{position:absolute;left:24px;right:24px;bottom:22px;z-index:3;display:flex;flex-direction:column;gap:8px;}
.hero .ticker{font-size:24px;font-weight:500;letter-spacing:2.4px;color:#a6cde9;}
.hero .name{font-size:74px;font-weight:800;letter-spacing:-1.2px;line-height:1.06;white-space:nowrap;}
.hero .sub{font-size:27px;font-weight:400;color:rgba(255,255,255,.74);white-space:nowrap;white-space:normal;}

.price{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;}
.price .l .cap{font-size:23px;font-weight:400;color:#93a5b9;margin-bottom:4px;}
.price .l .num{font-size:84px;font-weight:700;letter-spacing:-1.4px;line-height:1;font-variant-numeric:tabular-nums;}
.price .r{text-align:right;}
.price .r .cap{font-size:23px;font-weight:400;color:#93a5b9;margin-bottom:4px;}
.price .r .num{font-size:64px;font-weight:800;letter-spacing:-1px;line-height:1.05;font-variant-numeric:tabular-nums;}
.up{color:#e3b961;}
.down{color:#ef8f8f;}

.metrics{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1.18fr;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(255,255,255,.035);overflow:hidden;}
.metrics .cell{padding:17px 26px 19px;}
.metrics .cell+.cell{border-left:1px solid rgba(255,255,255,.11);}
.metrics .k{font-size:22px;font-weight:400;color:#8b9db1;margin-bottom:6px;white-space:nowrap;}
.metrics .v{font-size:39px;font-weight:700;letter-spacing:-.6px;white-space:nowrap;}
.metrics .v.gold{color:#e3b961;}

.note{margin-top:19px;font-size:24px;font-weight:400;color:#8fa3b7;white-space:nowrap;}
.note b{font-weight:500;color:#a9cde8;}
.rule{margin-top:21px;border-top:1px solid rgba(255,255,255,.10);}
.headline{margin-top:24px;font-size:44px;font-weight:700;letter-spacing:-.8px;color:#d8b36a;line-height:1.28;}
.body{margin-top:14px;font-size:29px;font-weight:400;color:#dbe4ee;line-height:1.62;letter-spacing:-.2px;}

.footer{position:absolute;left:44px;right:44px;bottom:38px;display:flex;align-items:center;justify-content:space-between;}
.footer .src{font-size:21px;font-weight:400;color:#7f92a7;}
.footer .pg{font-size:24px;font-weight:500;letter-spacing:1px;color:#9cc6e8;}
.spacer{flex:1;}

/* ── 표지 ─────────────────────────────────────────────────── */
.eyebrow{margin-top:26px;font-size:29px;font-weight:700;letter-spacing:.6px;color:#d8b36a;}
.cover-hero{margin-top:16px;height:536px;}
.cover-hero .fade{background:linear-gradient(to bottom,rgba(10,23,40,.22) 0%,rgba(10,23,40,0) 30%,rgba(10,23,40,.55) 66%,#0a1728 94%,#0a1728 100%);}
.cover-title{margin-top:-62px;position:relative;z-index:4;}
.cover-title .t1{font-size:92px;font-weight:800;letter-spacing:-2px;line-height:1.06;color:#fff;}
.cover-title .t2{font-size:98px;font-weight:800;letter-spacing:-2.4px;line-height:1.1;color:#9dc9ea;}
.cover-title .lead{margin-top:22px;font-size:40px;font-weight:700;letter-spacing:-.6px;color:#e6c478;}
.cover-title .note{margin-top:12px;font-size:29px;color:#b9c7d6;white-space:normal;}
.boxes{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:150px;}
.box{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);padding:16px 16px 18px;height:96px;display:flex;flex-direction:column;justify-content:center;}
.box .k{font-size:21px;color:#93a5b9;margin-bottom:5px;white-space:nowrap;}
.box .v{font-size:31px;font-weight:700;letter-spacing:-.6px;white-space:nowrap;}

/* ── 마무리 ───────────────────────────────────────────────── */
.close-hero{height:556px;}
.close-title{margin-top:-172px;position:relative;z-index:4;}
.close-title .t1{font-size:92px;font-weight:800;letter-spacing:-2px;line-height:1.08;color:#fff;}
.close-title .t2{font-size:78px;font-weight:800;letter-spacing:-1.8px;line-height:1.12;color:#9dc9ea;}
.close-items{margin-top:10px;}
.ci{display:flex;gap:22px;padding:21px 0 22px;border-top:1px solid rgba(255,255,255,.11);}
.ci:last-child{border-bottom:1px solid rgba(255,255,255,.11);}
.ci .no{font-size:37px;font-weight:700;color:#d8b36a;letter-spacing:.5px;width:56px;flex:none;padding-top:2px;}
.ci .txt{flex:1;}
.ci .h{font-size:32px;font-weight:700;color:#e0bd75;margin-bottom:7px;}
.ci .m{font-size:34px;font-weight:700;color:#fff;letter-spacing:-.6px;line-height:1.3;}
.ci .s{margin-top:7px;font-size:24px;font-weight:400;color:#96a9bd;line-height:1.4;}
`;

function header(d) {
  return `<div class="header"><div class="brand">buffetkimz</div><div class="hdate">${esc(d.headerDate)}</div></div>`;
}
function footer(left, pageNo) {
  return `<div class="footer"><div class="src">${esc(left)}</div><div class="pg">${pageNo} / 06</div></div>`;
}
const frame = () => `<div class="corner tl"></div><div class="corner br"></div>`;

function coverHtml(d) {
  const c = d.cover;
  return `<div class="card" data-card="1">${frame()}${header(d)}
  <div class="eyebrow">${esc(c.eyebrow)}</div>
  <div class="hero cover-hero"><div class="img" style="background-image:url('${bgUrl(c.bg)}')"></div><div class="fade"></div></div>
  <div class="cover-title">
    <div class="t1">${esc(c.titleA)}</div>
    <div class="t2">${esc(c.titleB)}</div>
    <div class="lead">${esc(c.lead)}</div>
    <div class="note">${esc(c.note)}</div>
  </div>
  <div class="spacer"></div>
  <div class="boxes">${c.boxes
    .map((b) => `<div class="box"><div class="k">${esc(b.label)}</div><div class="v" data-fit="31">${esc(b.value)}</div></div>`)
    .join("")}</div>
  ${footer(c.footerLeft, "01")}
</div>`;
}

function screenHtml(s, i) {
  const pageNo = String(i + 2).padStart(2, "0");
  const tone = s.tone === "down" ? "down" : "up";
  return `<div class="card" data-card="${i + 2}">${frame()}${header(data)}
  <div class="hero">
    <div class="img" style="background-image:url('${bgUrl(s.bg)}')"></div><div class="fade"></div>
    <div class="badge">${esc(s.badge)}</div>
    <div class="caption">
      <div class="ticker">${esc(s.ticker)}</div>
      <div class="name" data-fit="74" data-fit-ratio="0.9">${esc(s.name)}</div>
      <div class="sub" data-fit="27">${esc(s.sub)}</div>
    </div>
  </div>
  <div class="price">
    <div class="l"><div class="cap">${esc(s.priceLabel)}</div><div class="num" data-fit-price="84">${esc(s.price)}</div></div>
    <div class="r"><div class="cap">${esc(s.changeLabel)}</div><div class="num ${tone}">${esc(s.change)}</div></div>
  </div>
  <div class="metrics">${s.metrics
    .map(
      (m) =>
        `<div class="cell"><div class="k">${esc(m.label)}</div><div class="v${m.emphasis ? " gold" : ""}" data-fit="39">${esc(m.value)}</div></div>`,
    )
    .join("")}</div>
  <div class="note" data-fit="24">${esc(s.note)}</div>
  <div class="rule"></div>
  <div class="headline" data-fit-line="44">${esc(s.headline)}</div>
  <div class="body">${s.body.map((b) => `<div>${esc(b)}</div>`).join("")}</div>
  ${footer(s.source, pageNo)}
</div>`;
}

function closingHtml(d) {
  const c = d.closing;
  return `<div class="card" data-card="6">${frame()}${header(d)}
  <div class="hero close-hero">
    <div class="img" style="background-image:url('${bgUrl(c.bg)}')"></div><div class="fade"></div>
    <div class="badge">${esc(c.badge)}</div>
  </div>
  <div class="close-title">
    <div class="t1">${esc(c.titleA)}</div>
    <div class="t2">${esc(c.titleB)}</div>
  </div>
  <div class="close-items">${c.items
    .map(
      (it) => `<div class="ci"><div class="no">${esc(it.no)}</div><div class="txt">
      <div class="h">${esc(it.title)}</div>
      <div class="m" data-fit-line="34">${esc(it.main)}</div>
      <div class="s" data-fit-line="24">${esc(it.sub)}</div></div></div>`,
    )
    .join("")}</div>
  ${footer(c.footerLeft, "06")}
</div>`;
}

const AUTO_FIT_JS = `(() => {
  // 블록 요소의 scrollWidth는 늘 clientWidth와 같아서 폭 비교에 쓸 수 없다.
  // Range로 '글자 자체의 폭'을 재서 카드 밖으로 넘칠 때만 한 단계씩 줄인다.
  const textWidth = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const w = r.getBoundingClientRect().width;
    return w > 0 ? w : el.scrollWidth;
  };
  const shrink = (el, start, min) => {
    let size = parseFloat(start) || parseFloat(getComputedStyle(el).fontSize);
    el.style.whiteSpace = 'nowrap';
    const limit = el.clientWidth * (parseFloat(el.dataset.fitRatio) || 0.985);
    let guard = 0;
    while (size > min && textWidth(el) > limit && guard++ < 90) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  };
  document.querySelectorAll('[data-fit]').forEach((el) => shrink(el, el.dataset.fit, 18));
  document.querySelectorAll('[data-fit-price]').forEach((el) => shrink(el, el.dataset.fitPrice, 40));
  document.querySelectorAll('[data-fit-line]').forEach((el) => {
    let size = parseFloat(el.dataset.fitLine);
    while (size > 18 && el.getBoundingClientRect().height > size * 2.95) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  });
  return true;
})()`;

// ── 렌더 ─────────────────────────────────────────────────────────────────────
const cards = [
  { id: 1, html: coverHtml(data), file: "01" },
  ...data.screens.map((s, i) => ({ id: i + 2, html: screenHtml(s, i), file: String(i + 2).padStart(2, "0") })),
  { id: 6, html: closingHtml(data), file: "06" },
];
const targets = ONLY.length ? cards.filter((c) => ONLY.includes(c.id)) : cards;
if (!targets.length) {
  console.error(`✗ --only 값(${ONLY.join(",")})에 맞는 장이 없습니다(1~6).`);
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
if (WRITE_PNG) fs.mkdirSync(PNG_DIR, { recursive: true });

const { chromium } = await loadPlaywright();
const sharp = (await import(req.resolve("sharp"))).default;
const executablePath = findChromium();
const W = 1080;
const H = 1350;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--hide-scrollbars",
    "--disable-lcd-text",
  ],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});

const written = [];
const tmpDir = fs.mkdtempSync(path.join(fs.existsSync("/workspace/tmp") ? "/workspace/tmp" : process.env.TMPDIR || "/tmp", "quant-cards-"));
try {
  for (const card of targets) {
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${fontFaceCss()}${CSS}</style></head><body>${card.html}</body></html>`;
    // file:// 문서로 열어야 배경 일러스트(file://)·Pretendard 폰트를 그대로 물릴 수 있다
    const tmpHtml = path.join(tmpDir, `${card.file}.html`);
    fs.writeFileSync(tmpHtml, html);
    await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.querySelectorAll(".img")].map(
          (el) =>
            new Promise((res) => {
              const m = /url\("?([^")]+)"?\)/.exec(el.style.backgroundImage);
              if (!m) return res();
              const img = new Image();
              img.onload = img.onerror = () => res();
              img.src = m[1];
            }),
        ),
      );
    });
    await page.evaluate(AUTO_FIT_JS);
    if (process.env.DEBUG_FIT) {
      const dbg = await page.evaluate(() =>
        [...document.querySelectorAll("[data-fit],[data-fit-price]")].map((e) => {
          const r = document.createRange();
          r.selectNodeContents(e);
          return [e.className || e.tagName, getComputedStyle(e).fontSize, Math.round(r.getBoundingClientRect().width), e.clientWidth];
        }),
      );
      console.log("   fit:", JSON.stringify(dbg));
    }
    await page.waitForTimeout(120);
    const pngBuf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    const webpPath = path.join(OUT_DIR, `${card.file}.webp`);
    await sharp(pngBuf)
      .resize(W, H, { fit: "fill", kernel: "lanczos3" })
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(webpPath);
    if (WRITE_PNG) await sharp(pngBuf).resize(W, H, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(path.join(PNG_DIR, `quant-${data.date}-${card.file}.png`));
    // 갤러리 목록은 480×600 썸네일을 쓴다(/gallery/thumbs/…) — 없으면 목록 카드가 빈다
    if (!flag("no-thumbs")) {
      const thumbDir = path.join(APP, "public/gallery/thumbs/quant-screening-daily");
      fs.mkdirSync(thumbDir, { recursive: true });
      await sharp(pngBuf)
        .resize(480, 600, { kernel: "lanczos3" })
        .webp({ quality: 80, effort: 5 })
        .toFile(path.join(thumbDir, `${card.file}.webp`));
    }
    const { size } = fs.statSync(webpPath);
    written.push({ file: `${card.file}.webp`, bytes: size });
    console.log(`  ✓ ${card.file}.webp  ${(size / 1024).toFixed(0)}KB`);
  }
} finally {
  await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// 렌더 결과 기록 — 다음 실행·검수에서 '언제 무엇으로 구웠는지' 확인용
const manifestPath = path.join(APP, "scripts/quant-data/last-render.json");
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
fs.writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      dataFile: path.relative(APP, DATA_PATH),
      date: data.date,
      headerDate: data.headerDate,
      renderedAt: new Date().toISOString(),
      basis: data.basis || `${data.date} 08:20 퀀트 스크리닝 결과`,
      cards: written,
      previous: prev ? { date: prev.date, renderedAt: prev.renderedAt } : null,
    },
    null,
    2,
  )}\n`,
);

// ── gallery.ts 세트 갱신 ─────────────────────────────────────────────────────
if (GALLERY) {
  const id = "quant-screening-daily";
  const slides = cards.map((c) => {
    const src = `/gallery/quant-screening-daily/${c.file}.webp`;
    let alt, caption;
    if (c.id === 1) {
      alt = `표지 — ${data.cover.titleA} ${data.cover.titleB}, ${data.cover.boxes.map((b) => `${b.label} ${b.value}`).join("·")}`;
      caption = "표지 — 골든 시그널로 본 4종목";
    } else if (c.id === 6) {
      alt = `${data.closing.titleA} ${data.closing.titleB} — ${data.closing.items.map((i) => `${i.title} ${i.main}`).join(", ")}`;
      caption = "마무리 — 개장 전 체크포인트 3";
    } else {
      const s = data.screens[c.id - 2];
      alt = `${s.badge} — ${s.name} ${s.price} (${s.change}), ${s.metrics.map((m) => `${m.label} ${m.value}`).join(", ")}`;
      caption = `${s.badge.split(" / ")[0]} 1위 — ${s.name} ${s.price} (${s.change})`;
    }
    return { src, width: 1080, height: 1350, alt, caption };
  });
  const mmdd = data.date.slice(5).replace("-", "/");
  const block = `  /* quant-screening-daily:BEGIN — render_quant_cards.mjs --gallery가 매일 이 블록만 새로 씁니다 */
  {
    id: "${id}",
    title: "4대 시장 퀀트 스크리닝 (${mmdd})",
    tagline: "골든 시그널로 본 4종목",
    summary:
      "${String(data.summary || `미국 주식·미국 ETF·국내 주식·국내 ETF 네 시장을 같은 기준(이동평균선 정배열·RSI·거래량)으로 훑은 ${data.date.replace(/-/g, ". ")} 기준 결과입니다. 시장별 1위 4종목과 개장 전 체크포인트 3가지를 6장에 담았습니다.`).replace(/"/g, '\\"')}",
    category: "cardnews",
    createdAt: "${data.date}",
    tags: ["퀀트 스크리닝", "골든 시그널", "미국 주식", "국내 주식", "ETF"],
    slides: [
${slides.map((s) => `      { src: "${s.src}", width: ${s.width}, height: ${s.height}, alt: ${JSON.stringify(s.alt)}, caption: ${JSON.stringify(s.caption)} },`).join("\n")}
    ],
    basis:
      "기준 ${data.date.replace(/-/g, ". ")} 08:20 · 시세 Yahoo Finance·KRX / 지수 S&P·Nasdaq / 환율 08:20 기준 · 투자 권유가 아닌 기록입니다",
    related: [{ label: "오늘의 시장 확인 — 데일리 브리프", href: "/board/" }],
  },
  /* quant-screening-daily:END */`;

  const galleryTs = path.join(APP, "src/data/gallery.ts");
  let ts = fs.readFileSync(galleryTs, "utf8");
  const begin = "  /* quant-screening-daily:BEGIN";
  const end = "  /* quant-screening-daily:END */";
  if (ts.includes(begin) && ts.includes(end)) {
    const re = /  \/\* quant-screening-daily:BEGIN[\s\S]*?\/\* quant-screening-daily:END \*\//;
    ts = ts.replace(re, block);
  } else {
    const anchor = "export const galleryItems: GalleryItem[] = [\n";
    if (!ts.includes(anchor)) {
      console.error("✗ gallery.ts에서 galleryItems 배열 시작 지점을 찾지 못했습니다.");
      process.exit(1);
    }
    ts = ts.replace(anchor, `${anchor}${block}\n`);
  }
  fs.writeFileSync(galleryTs, ts);
  console.log(`  ✓ gallery.ts 세트 갱신 — ${id} (${mmdd})`);
}

console.log(`■ 완료: ${targets.length}장 · ${path.relative(APP, OUT_DIR)}${WRITE_PNG ? ` · PNG ${path.relative(WORKSPACE, PNG_DIR)}` : ""}`);
