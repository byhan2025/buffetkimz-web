import fs from "node:fs";
import path from "node:path";

/**
 * 블로그 대표이미지(썸네일) 규칙.
 *
 * · 글에 `thumb`가 있으면 그 파일을 쓴다 — public/thumbs/*.webp (16:10, 1280×800)
 * · 없으면 분야(7대 주제) 기본 이미지를 쓴다. 새 글을 쓸 때 이미지를 만들지 않아도
 *   카드가 비지 않고, 분야마다 그림 톤이 유지된다.
 *
 * 그림은 전부 순수 오브젝트·추상 에디토리얼 일러스트다(글자·숫자·차트 없음).
 */
export const topicThumbs: Record<string, string> = {
  finance: "/thumbs/topic-finance.webp",
  invest: "/thumbs/topic-invest.webp",
  economy: "/thumbs/topic-economy.webp",
  insurance: "/thumbs/topic-insurance.webp",
  retire: "/thumbs/topic-retire.webp",
  pension: "/thumbs/topic-pension.webp",
  ai: "/thumbs/topic-ai.webp",
  philosophy: "/thumbs/topic-philosophy.webp",
};

/** 분야별 기본 이미지 설명 — alt가 비었을 때 쓴다 */
export const topicThumbAlts: Record<string, string> = {
  finance: "종이 위의 나침반 — 금융 기록",
  invest: "계단처럼 쌓인 블록과 동전 — 투자 기록",
  economy: "저울에 놓인 상자와 조약돌 — 경제 기록",
  insurance: "종이 방패 — 보험 기록",
  retire: "지붕 아래 봉투 세 개 — 노후 기록",
  pension: "청동 고리가 감긴 종이 탑 — 연금 기록",
  ai: "격자에서 빠져나온 한 칸 — AI 기록",
  philosophy: "펼친 공책 위로 흐르는 선 — 철학 기록",
};

type ThumbSource = { data: { thumb?: string; thumbAlt?: string; category: string } };

export function thumbOf(post: ThumbSource): string {
  return post.data.thumb ?? topicThumbs[post.data.category] ?? topicThumbs.philosophy;
}

export function thumbAltOf(post: ThumbSource): string {
  return (
    post.data.thumbAlt ??
    topicThumbAlts[post.data.category] ??
    "buffetkimz 기록 대표 이미지"
  );
}

/**
 * 대표이미지의 실제 픽셀 크기를 파일 헤더에서 읽는다.
 * 목록 카드·상세의 `width`/`height` 속성이 실제 파일과 맞아야 레이아웃이 흔들리지 않는다.
 * (v5.2 승인본은 1280×800 레거시, 파이프라인 v2 신규 글은 1200×630 규격)
 */
const sizeCache = new Map<string, { width: number; height: number }>();
const FALLBACK = { width: 1280, height: 800 };

function readSize(file: string): { width: number; height: number } {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8X") {
        const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width, height };
      }
      if (chunk === "VP8 ") {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (chunk === "VP8L") {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 10 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {
    /* 파일을 못 읽으면 기본값 */
  }
  return FALLBACK;
}

/** public 기준 경로("/thumbs/x.webp") → 실제 픽셀 크기 */
export function thumbSize(publicPath: string): { width: number; height: number } {
  const cached = sizeCache.get(publicPath);
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  const size = readSize(file);
  sizeCache.set(publicPath, size);
  return size;
}
