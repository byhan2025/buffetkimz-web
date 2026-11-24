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

/** 마크다운 본문 안의 내부 링크("/apps/…")에도 배포 접두를 붙인다. */
function rehypeBase(base) {
  const prefix = base.replace(/\/$/, '');
  return () => (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && (node.tagName === 'a' || node.tagName === 'img')) {
        const key = node.tagName === 'a' ? 'href' : 'src';
        const value = node.properties?.[key];
        if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
          node.properties[key] = `${prefix}${value}`;
        }
      }
      (node.children ?? []).forEach(walk);
    };
    walk(tree);
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
  },
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    react(),
    sitemap({
      // 실행 화면·검색·옛 주소 이동 페이지는 사이트맵에서 뺀다
      // v8.8.0 — 보관함(archived) 도구도 뺀다. 앱스토어·검색에서 숨긴 페이지를 사이트맵에 올리면
      //          'noindex + 사이트맵'이 서로 모순된다. 목록은 `src/data/apps.ts`의 archived 항목과 같다.
      filter: (page) =>
        !page.includes('/run') &&
        !page.includes('/search') &&
        !page.includes('/tools') &&
        !page.includes('/topics') &&
        !ARCHIVED_PATHS.some((p) => page.includes(p)),
      changefreq: 'weekly',
      lastmod: new Date('2026-11-23'),
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
      rehypePlugins: [rehypeTableWrap(), rehypeBase(BASE), rehypeAdBreak, rehypeNoStrikethrough()],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
