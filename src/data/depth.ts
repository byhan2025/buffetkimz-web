/**
 * 읽기 깊이 표시 — 2026-11-25 깃밥 벤치마킹 3항.
 *
 * 왜 데이터 파일인가
 *  · 같은 글·도구가 홈(자산리포트 카드)과 목록(`/posts`)에서 서로 다른 깊이로 보이면 안 된다.
 *    깊이를 정하는 규칙은 이 파일 하나에만 두고, 화면은 `depthOfPost`·`depthOfTool`만 부른다.
 *  · 이모지 대신 단색 3칸 막대로 그린다(DESIGN §3 — 아이콘은 단색 SVG, 이모지 금지).
 *
 * 규칙 (2026-11-25 확정)
 *  · 글 — 읽는 분량을 기준으로 한다. 6분 이하 입문, 7~9분 실무, 10분 이상 심화.
 *    분량만으로는 어긋나는 글은 아래 `POST_DEPTH_OVERRIDE`에 한 줄씩 적는다(추정을 화면에 두지 않는다).
 *  · 도구 — 무엇을 넣어야 하는지(입력값의 수)와 결과를 읽는 난이도로 정한다. 8종 도구의 값은 아래 표가 정본이다.
 *  · 트랙 단계(`data/tracks.ts`)가 붙은 글이 생기면 1·2·3단계가 위 규칙보다 먼저다.
 */
import { stageOfPost } from "@/lib/tracks";

export const DEPTHS = ["입문", "실무", "심화"] as const;
export type Depth = (typeof DEPTHS)[number];

/** 막대 칸 수 — 1·2·3 */
export const DEPTH_LEVEL: Record<Depth, 1 | 2 | 3> = {
  입문: 1,
  실무: 2,
  심화: 3,
};

/**
 * 분량 기준과 어긋나는 글 — 배경지식이 먼저 필요한 글만 적는다.
 * (예: 6분이지만 금리·듀레이션 개념을 전제하는 글)
 */
const POST_DEPTH_OVERRIDE: Record<string, Depth> = {
  "invest-bond-duration": "심화",
  "invest-overseas-stock-tax": "실무",
  "isa-pension-300": "실무",
  "finance-rate-gap": "실무",
  "pension-early-withdrawal-165": "실무",
};

/** 글 하나의 읽기 깊이 — 트랙 단계 → 예외표 → 읽는 분량 순으로 정한다. */
export function depthOfPost(input: { id: string; readingMinutes: number }): Depth {
  const stage = stageOfPost(input.id);
  if (stage) {
    const no = stage.stage.no;
    return no === 1 ? "입문" : no === 2 ? "실무" : "심화";
  }
  const override = POST_DEPTH_OVERRIDE[input.id];
  if (override) return override;
  if (input.readingMinutes >= 10) return "심화";
  if (input.readingMinutes >= 7) return "실무";
  return "입문";
}

/**
 * 도구 8종의 깊이 — `data/tools.ts`의 key.
 *  · 입문: 값을 하나만 넣어도 결과가 나오는 계산기
 *  · 실무: 두세 값과 가정(수익률·물가·과세 방식)을 함께 넣는 시뮬레이터
 *  · 심화: 제도·약관의 기간·유형을 먼저 확인해야 하는 점검 도구
 */
const TOOL_DEPTH: Record<string, Depth> = {
  pension: "입문",
  "compound-return": "입문",
  calendar: "입문",
  "retirement-flow": "실무",
  "pension-draw": "실무",
  coverage: "실무",
  silson: "실무",
  disclosure: "심화",
};

/** 도구 카드에 붙일 깊이 — 표에 없는 도구는 표시하지 않는다(추정하지 않는다) */
export const depthOfTool = (key: string): Depth | undefined => TOOL_DEPTH[key];
