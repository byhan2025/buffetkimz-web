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
