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
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    react(),
    sitemap({
      // 실행 화면·검색·옛 주소 이동 페이지는 사이트맵에서 뺀다
      filter: (page) =>
        !page.includes('/run') &&
        !page.includes('/search') &&
        !page.includes('/tools') &&
        !page.includes('/topics'),
      changefreq: 'weekly',
      lastmod: new Date('2026-11-22'),
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
