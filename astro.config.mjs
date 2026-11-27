import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkGfm from 'remark-gfm';
import { rehypeAdBreak } from './src/lib/rehype-ad-break.mjs';
import { rehypeTableWrap } from './src/lib/rehype-table-wrap.mjs';
import { rehypeNoStrikethrough } from './src/lib/rehype-no-strikethrough.mjs';

/**
 * 배포 주소 분기.
 * - 기본: https://buffetkimz.com (루트 배포)
 * - GitHub Pages 미리보기: SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web npm run build
 * 커스텀 도메인을 붙이면 환경변수 없이 다시 빌드하는 것만으로 루트 경로로 돌아온다.
 */
const raw = (t) => (t ?? '').trim();
const SITE = raw(process.env.SITE_URL) || 'https://buffetkimz.com';
let BASE = raw(process.env.BASE_PATH) || '/';
if (!BASE.startsWith('/')) BASE = `/${BASE}`;
if (!BASE.endsWith('/')) BASE = `${BASE}/`;

/**
 * 보관함(비노출) 도구의 페이지 경로 — 사이트맵에서만 뺀다.
 * 값은 `src/data/apps.ts`에서 `archived: true`로 둔 8종과 같다(그쪽을 고치면 여기도 함께 고친다).
 */
/**
 * 리다이렉트 목적지에 배포 접두를 붙인다 — Astro의 `redirects`는 값을 그대로 쓰기 때문에,
 * 서브패스 배포(gh-pages `/buffetkimz-web/`)에서는 접두가 없으면 404로 간다.
 * 루트 배포(BASE='/')에서는 접두가 빈 문자열이라 주소가 그대로다.
 */
const redirectTo = (path) => `${BASE.replace(/\/$/, '')}${path}`;

const ARCHIVED_PATHS = [
  '/apps/json-csv-formatter',
  '/apps/diff-checker',
  '/apps/color-extractor',
  '/apps/text-to-card',
  '/apps/svg-logo-maker',
  '/apps/url-shortener',
  '/apps/url-cleaner',
  '/apps/market-world-clock',
];

/**
 * 마크다운 본문 안의 내부 링크("/apps/…")에도 배포 접두를 붙인다.
 *
 * v9.5.1(2026-11-28 전수 점검): 본문에 섞어 쓴 **원시 HTML 앵커**(`<a href="/posts/…">`)는
 *   rehype-raw 없이 hast의 `raw` 노드로 남아 위 element 검사에 걸리지 않았다. 그래서 서브패스 배포
 *   (`/buffetkimz-web/`)에서 그 링크만 접두가 빠져 404가 났다(리볼빙·신용점수·중도상환·금리인하요구권 글).
 *   raw 노드의 href/src도 같은 규칙으로 고치고, 소식지 본문처럼 **사이트 자기 주소를 절대 URL로 적은 링크**
 *   (`https://buffetkimz.com/posts/…`)도 배포 접두가 붙은 경로로 바꾼다.
 *   도메인 루트 배포(BASE='/')에서는 접두가 빈 문자열이라 주소가 그대로다.
 */
function rehypeBase(base, siteUrl) {
  const prefix = base.replace(/\/$/, '');
  const ownHosts = new Set(['buffetkimz.com', 'www.buffetkimz.com']);
  try {
    ownHosts.add(new URL(siteUrl).host);
  } catch {
    /* site 값이 비어 있어도 위 두 호스트는 유지한다 */
  }
  const rewrite = (value) => {
    if (prefix && (value === prefix || value.startsWith(`${prefix}/`))) return value;
    if (value.startsWith('/') && !value.startsWith('//')) return `${prefix}${value}`;
    if (/^https?:\/\//.test(value)) {
      try {
        const url = new URL(value);
        if (ownHosts.has(url.host) && !url.pathname.startsWith(`${prefix}/`)) {
          return `${prefix}${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        /* 주소로 읽히지 않으면 손대지 않는다 */
      }
    }
    return value;
  };
  return () => (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && (node.tagName === 'a' || node.tagName === 'img')) {
        const key = node.tagName === 'a' ? 'href' : 'src';
        const value = node.properties?.[key];
        if (typeof value === 'string') node.properties[key] = rewrite(value);
      } else if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = node.value.replace(
          /(\s(?:href|src)=)("|')([^"']*)\2/g,
          (_m, attr, quote, value) => `${attr}${quote}${rewrite(value)}${quote}`,
        );
      }
      (node.children ?? []).forEach(walk);
    };
    walk(tree);
  };
}

/**
 * 페이지별 사이트맵 기준일 — `scripts/gen_site_basis.mjs`가 빌드 전에 다시 만든다.
 *  { default: 'YYYY-MM-DD', paths: { '/posts/slug': 'YYYY-MM-DD', … } }
 * 파일이 없으면(첫 체크아웃 등) 사이트 공통 기준일 바닥값으로 돌아간다.
 */
const sitemapLastmod = (() => {
  try {
    const file = fileURLToPath(new URL('./src/config/sitemap-lastmod.generated.json', import.meta.url));
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { default: '2026-11-24', paths: {} };
  }
})();

/**
 * 빌드 결과의 href/src 안에 남은 `&#x26;`(본문 자동 링크가 만드는 숫자 문자 참조)를 `&amp;`로 바꾼다.
 *
 * 2026-11-28 전수 점검: 소식지 본문의 국세청 링크처럼 `&`가 든 주소를 GFM 자동 링크가 만들면
 *   속성값이 `…?cntntsId=7875&#x26;mi=2304`로 나간다. 브라우저는 둘을 같이 읽지만, 주소를 문자열로
 *   읽는 검사기·수집기는 `#x26;mi=2304`를 프래그먼트로 보아 주소가 잘린 것으로 판단한다.
 *   두 표기는 같은 값이므로 속성 안만 표준 표기(`&amp;`)로 통일한다.
 */
function normalizeAmpInHref() {
  return {
    name: 'buffetkimz:normalize-amp-in-href',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const { readdir, readFile, writeFile } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const root = fileURLToPath(dir);
        const walk = async (path) => {
          for (const entry of await readdir(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) {
              await walk(full);
              continue;
            }
            if (!entry.name.endsWith('.html')) continue;
            const html = await readFile(full, 'utf8');
            const next = html.replace(/(\s(?:href|src)="[^"]*)"|(\s(?:href|src)='[^']*)'/g, (m) =>
              m.includes('&#x26;') ? m.replaceAll('&#x26;', '&amp;') : m,
            );
            if (next !== html) await writeFile(full, next, 'utf8');
          }
        };
        await walk(root);
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'ignore',
  /*
   * v8.8.0 — 도구 11종을 8개 화면으로 흡수했다.
   * 흡수된 도구의 옛 주소(`/apps/<옛 슬러그>/`, `/run/`, `/tools/<옛 슬러그>/`)는
   * 반드시 새 통합 도구의 해당 탭으로 보낸다 — 기존 글·강의·북마크에서 깨진 링크(404)가 0건이어야 한다.
   * 정적 빌드에서는 Astro가 meta refresh + JS 이동 HTML을 만들어 준다.
   */
  redirects: {
    '/apps/korean-age-pension': redirectTo('/apps/pension-draw?mode=age'),
    '/apps/korean-age-pension/run': redirectTo('/apps/pension-draw/run?mode=age'),
    '/tools/korean-age-pension': redirectTo('/apps/pension-draw?mode=age'),

    '/apps/deposit-savings': redirectTo('/apps/compound-return?mode=deposit'),
    '/apps/deposit-savings/run': redirectTo('/apps/compound-return/run?mode=deposit'),
    '/tools/deposit-savings': redirectTo('/apps/compound-return?mode=deposit'),

    /* 2026-11-24 — 실무자용 보장분석 상담 가이드는 전용 도구실(비밀번호 잠금)로 옮겼다.
     * 옛 주소는 안내 페이지 없이 404 로 둔다: 리다이렉트를 만들면 그 주소가 다시 공개 지도에
     * 남고, 빌드 결과에 도구 이름이 평문으로 다시 실린다. */

    '/apps/hourly-wage': redirectTo('/apps/salary-net?mode=hourly'),
    '/apps/hourly-wage/run': redirectTo('/apps/salary-net/run?mode=hourly'),
    '/tools/hourly-wage': redirectTo('/apps/salary-net?mode=hourly'),

    '/apps/freelancer-tax': redirectTo('/apps/vat-margin?mode=freelance'),
    '/apps/freelancer-tax/run': redirectTo('/apps/vat-margin/run?mode=freelance'),
    '/tools/freelancer-tax': redirectTo('/apps/vat-margin?mode=freelance'),

    '/apps/image-resize': redirectTo('/apps/image-compress?mode=resize'),
    '/apps/image-resize/run': redirectTo('/apps/image-compress/run?mode=resize'),
    '/tools/image-resize': redirectTo('/apps/image-compress?mode=resize'),

    '/apps/image-upscale': redirectTo('/apps/image-compress?mode=upscale'),
    '/apps/image-upscale/run': redirectTo('/apps/image-compress/run?mode=upscale'),
    '/tools/image-upscale': redirectTo('/apps/image-compress?mode=upscale'),

    '/apps/watermark': redirectTo('/apps/image-compress?mode=watermark'),
    '/apps/watermark/run': redirectTo('/apps/image-compress/run?mode=watermark'),
    '/tools/watermark': redirectTo('/apps/image-compress?mode=watermark'),

    '/apps/exif-mosaic': redirectTo('/apps/image-compress?mode=exif'),
    '/apps/exif-mosaic/run': redirectTo('/apps/image-compress/run?mode=exif'),
    '/tools/exif-mosaic': redirectTo('/apps/image-compress?mode=exif'),

    '/apps/pdf-merge-split': redirectTo('/apps/pdf-image?mode=merge'),
    '/apps/pdf-merge-split/run': redirectTo('/apps/pdf-image/run?mode=merge'),
    '/tools/pdf-merge-split': redirectTo('/apps/pdf-image?mode=merge'),

    '/apps/moving-dday': redirectTo('/apps/unit-date-calc?mode=moving'),
    '/apps/moving-dday/run': redirectTo('/apps/unit-date-calc/run?mode=moving'),
    '/tools/moving-dday': redirectTo('/apps/unit-date-calc?mode=moving'),

    /* 2026-11-26 — 「돈의 나이테」는 /money-lens/가 정본이다. 짧은 옛 주소만 받는다. */
    '/tools/money-lens': redirectTo('/money-lens/'),
  },
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    react(),
    normalizeAmpInHref(),
    sitemap({
      // 실행 화면·검색·옛 주소 이동 페이지는 사이트맵에서 뺀다
      // v8.8.0 — 보관함(archived) 도구도 뺀다. 앱스토어·검색에서 숨긴 페이지를 사이트맵에 올리면
      //          'noindex + 사이트맵'이 서로 모순된다. 목록은 `src/data/apps.ts`의 archived 항목과 같다.
      // 2026-11-25 — 여기 목록은 **noindex 로 나가는 경로 가족**과 짝을 이뤄야 한다.
      //   새 noindex 페이지 가족을 만들면 이 filter에도 같은 접두를 넣는다(사이트맵 × noindex 모순 방지).
      //   현재 noindex: /search · /404 · /apps/*\/run · /topics · /tools · archived 앱/
      //   그리고 빈 분야·빈 카드세트·빈 소식지(그 상태가 되면 `scripts/audit_index_thin.py`가 알린다).
      filter: (page) =>
        !page.includes('/run') &&
        !page.includes('/search') &&
        !page.includes('/tools') &&
        !page.includes('/topics') &&
        !ARCHIVED_PATHS.some((p) => page.includes(p)),
      changefreq: 'weekly',
      // v9.5.1(2026-11-28 전수 점검) — 모든 URL이 11.24로 고정돼 11.27 글까지 반영되지 않았다.
      //   prebuild(`scripts/gen_site_basis.mjs`)가 페이지별 기준일 표를 만들고, 여기서 그 값을 쓴다.
      //   글은 그 글의 baseDate, 카드는 세트 기준일, 나머지 화면은 사이트 공통 기준일이다.
      lastmod: new Date(`${sitemapLastmod.default}T00:00:00Z`),
      serialize: (item) => {
        const url = new URL(item.url);
        let path = url.pathname;
        const prefix = BASE.replace(/\/$/, '');
        if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) path = path.slice(prefix.length) || '/';
        path = path.replace(/\/$/, '') || '/';
        const iso = sitemapLastmod.paths?.[path];
        return iso ? { ...item, lastmod: new Date(`${iso}T00:00:00Z`).toISOString() } : item;
      },
    }),
  ],
  markdown: {
    /*
     * v6.0 — 본문 표를 .table-wrap으로 감싸고(수치 셀 tabular-nums) 내부 링크에 배포 접두를 붙이는
     * rehype 플러그인을 쓰려면 unified 프로세서를 명시해야 한다. Astro 7 기본 프로세서(Sätteri)는
     * `markdown.rehypePlugins`를 읽지 않아, 그대로 두면 이 플러그인들이 조용히 무시된다.
     *
     * v7.2 — GFM 취소선 사고의 원천 차단.
     * remark-gfm은 기본값이 `singleTilde: true`라서 `3.3~5.5%`처럼 한 줄에 물결표가 두 번 나오면
     * 뒤 문장까지 한 덩어리로 취소선(`<del>`)이 되어 글자가 사라진다. 그래서 GFM은 여기서 옵션과 함께
     * 직접 등록하고(`singleTilde: false` — `~~` 두 개만 취소선), Astro의 기본 등록은 끈다(`gfm: false`).
     * 더해 `rehypeNoStrikethrough`가 본문에 취소선이 하나라도 생기면 빌드를 세워 배포 전에 알린다.
     */
    gfm: false,
    processor: unified({
      gfm: false,
      remarkPlugins: [[remarkGfm, { singleTilde: false }]],
      rehypePlugins: [rehypeTableWrap(), rehypeBase(BASE, SITE), rehypeAdBreak, rehypeNoStrikethrough()],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
