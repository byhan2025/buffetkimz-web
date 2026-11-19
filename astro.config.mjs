import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

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
      lastmod: new Date('2026-11-19'),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeBase(BASE)],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
