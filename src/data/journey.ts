/**
 * v6.1 방문자 동선(여정) — 어디서 다음으로 갈지 정하는 규칙 한 곳.
 *
 * 화면에 손으로 적은 '다음 글'을 두지 않는다. 트랙(묶음)의 순서만 여기서 정하고,
 * 제목·주소·기준일은 빌드할 때 글 컬렉션과 도구 목록에서 가져온다.
 *
 *  · 읽기 여정 — 글 → 글 → 도구. 순서는 `입문 → 심화 → 실전 도구`.
 *    마지막 글에서 도구로 넘어가므로, 읽던 사람이 계산까지 이어진다.
 *  · 도구 여정 — 도구 → 도구. '이 다음으로 많이 쓰는 도구'로 잇는다.
 *
 * 트랙에 없는 글(새로 쓴 글)은 그 글의 연결 도구를 '실전 도구'로 권한다.
 */

export type ReadStage = "입문" | "심화" | "실전 도구";

type TrackStep = { id: string; stage: Exclude<ReadStage, "실전 도구"> };

type ReadingTrack = {
  /** 트랙 이름 — 화면에는 쓰지 않고, 관리할 때만 본다 */
  name: string;
  steps: TrackStep[];
  /** 마지막 글 다음에 권하는 도구 */
  end: { href: string; name: string; why: string };
  /** 단계마다 '왜 다음에 이 글인지' 한 줄 — 다음 단계 기준으로 적는다 */
  why: Record<string, string>;
};

/**
 * 트랙 순서 — 기존 홈 아카이브의 시리즈(6묶음)를 뼈대로 두고,
 * 11-21에 새로 쓴 두 편(ISA·실손 전환)을 제자리에 넣었다.
 * 기존 시리즈 순서를 바꾸지 않아 홈의 '시리즈로 읽기'와 어긋나지 않는다.
 */
const readingTracks: ReadingTrack[] = [
  {
    name: "연금·노후",
    steps: [
      { id: "pension-tax-order", stage: "입문" },
      { id: "isa-pension-300", stage: "심화" },
      { id: "retire-fixed-cost", stage: "심화" },
    ],
    end: {
      href: "/apps/retirement-flow",
      name: "은퇴 월 현금흐름 시뮬레이터",
      why: "읽은 기준을 내 숫자로 바꿔 봅니다 — 은퇴 후 매달 쓸 수 있는 돈",
    },
    why: {
      "isa-pension-300":
        "연금계좌에 넣는 순서를 잡았다면, ISA 만기 자금을 60일 안에 옮길 때 한도가 어떻게 늘어나는지 이어서 봅니다.",
      "retire-fixed-cost":
        "넣는 돈 다음은 받는 돈 — 은퇴 후 목돈보다 매달 나가는 고정비가 왜 먼저인지 봅니다.",
    },
  },
  {
    name: "투자·절세",
    steps: [
      { id: "invest-dca-rule", stage: "입문" },
      { id: "invest-dividend-total-return", stage: "심화" },
      { id: "finance-rate-gap", stage: "심화" },
    ],
    end: {
      href: "/apps/compound-return",
      name: "투자 복리·세후 수익률 계산기",
      why: "읽은 규칙을 내 적립액·기간으로 넣어 세전·세후로 나눠 봅니다",
    },
    why: {
      "invest-dividend-total-return":
        "적립 규칙 다음은 '무엇을 수익으로 볼 것인가' — 배당을 총수익으로 다시 계산합니다.",
      "finance-rate-gap":
        "수익을 세는 기준을 잡았으니, 반대편 비용 — 기준금리가 내려도 대출 이자가 그대로인 이유를 봅니다.",
    },
  },
  {
    name: "보험·제도 확인",
    steps: [
      { id: "insurance-coverage-conditions", stage: "입문" },
      { id: "insurance-silson-5th", stage: "심화" },
      { id: "silson-switch-2026", stage: "심화" },
    ],
    end: {
      href: "/apps/coverage-check",
      name: "보장 점검 시뮬레이터",
      why: "내 증권의 5대 담보 금액을 기준점과 나란히 놓고 빈 칸을 정리해 봅니다",
    },
    why: {
      "insurance-silson-5th":
        "담보는 '지급 조건'에서 갈린다는 기준을 잡았으니, 실손 5세대의 보험료·자기부담을 같은 병원비로 봅니다.",
      "silson-switch-2026":
        "세대별 차이를 봤다면, 11월 23일부터 달라지는 1·2세대 실손의 두 가지 선택지를 확인합니다.",
    },
  },
  {
    name: "경제·생활",
    steps: [
      { id: "economy-service-prices", stage: "입문" },
      { id: "economy-fx-grocery", stage: "심화" },
    ],
    end: {
      href: "/calendar",
      name: "골든타임",
      why: "지표를 읽었으니, 놓치면 손해가 생기는 기한과 절차를 날짜로 확인합니다",
    },
    why: {
      "economy-fx-grocery":
        "체감물가의 시차를 봤다면, 환율이 오를 때 장바구니에서 먼저 오르는 품목을 봅니다.",
    },
  },
  {
    name: "AI·도구 만들기",
    steps: [
      { id: "ai-work-order", stage: "입문" },
      { id: "ai-coverage-tool", stage: "심화" },
    ],
    end: {
      href: "/apps/coverage-check",
      name: "보장 점검 시뮬레이터",
      why: "직접 만든 도구를 열어 내 담보로 확인해 봅니다",
    },
    why: {
      "ai-coverage-tool":
        "맡기기 전에 정할 것을 정했다면, 실제로 만든 도구에서 무엇이 바뀌고 무엇이 바뀌지 않았는지 봅니다.",
    },
  },
  {
    name: "계산 뒤의 질문",
    steps: [{ id: "philosophy-numbers-are-questions", stage: "입문" }],
    end: {
      href: "/principles",
      name: "편집 원칙",
      why: "숫자를 대하는 태도 다음에, 이 사이트가 글을 쓰고 출처를 다는 기준을 봅니다",
    },
    why: {},
  },
];

type IndexEntry = {
  nextId?: string;
  nextStage: ReadStage;
  why: string;
  end: ReadingTrack["end"];
};

const readingIndex = new Map<string, IndexEntry>();
for (const track of readingTracks) {
  track.steps.forEach((step, i) => {
    const next = track.steps[i + 1];
    readingIndex.set(step.id, {
      nextId: next?.id,
      nextStage: next ? next.stage : "실전 도구",
      why: next ? (track.why[next.id] ?? "") : track.end.why,
      end: track.end,
    });
  });
}

export type ReadingNext =
  | { kind: "post"; id: string; stage: ReadStage; why: string }
  | { kind: "tool"; stage: "실전 도구"; href: string; name: string; why: string };

/**
 * 이 글 다음에 읽을 것 — 같은 트랙의 다음 글, 트랙의 끝이면 그 트랙의 도구.
 * 트랙에 없는 글은 null을 돌려주고, 화면은 그 글의 연결 도구를 쓴다.
 */
export function nextReading(postId: string): ReadingNext | null {
  const entry = readingIndex.get(postId);
  if (!entry) return null;
  if (entry.nextId) return { kind: "post", id: entry.nextId, stage: entry.nextStage, why: entry.why };
  return { kind: "tool", stage: "실전 도구", href: entry.end.href, name: entry.end.name, why: entry.why };
}

/**
 * 도구 여정 — '이 다음으로 많이 쓰는 도구'.
 * 예: 세액공제(넣는 돈) → 연금 인출(받는 돈) → 은퇴 현금흐름 → 복리 → 실손 비교 → 보장 점검 → 고지.
 * 마지막은 앱스토어 전체로 돌려 보낸다.
 */
export type ToolNext = { href: string; name: string; why: string };

const toolTrack: Record<string, ToolNext> = {
  "pension-tax": {
    href: "/apps/pension-draw",
    name: "연금 인출·세금 시뮬레이터",
    why: "넣는 돈(세액공제) 다음은 받는 돈 — 받는 해의 세금을 봅니다",
  },
  "pension-draw": {
    href: "/apps/retirement-flow",
    name: "은퇴 월 현금흐름 시뮬레이터",
    why: "받는 해의 세금 다음은, 은퇴 후 매달 들어오는 돈 전체입니다",
  },
  "retirement-flow": {
    href: "/apps/compound-return",
    name: "투자 복리·세후 수익률 계산기",
    why: "그 현금흐름을 만드는 적립 — 기간과 세금을 넣어 계산합니다",
  },
  "account-tax-compare": {
    href: "/apps/pension-draw",
    name: "연금 인출·세금 시뮬레이터",
    why: "네 계좌를 비교했다면, 꺼내는 해의 세금 — 1,500만원 기준을 이어서 봅니다",
  },
  "compound-return": {
    href: "/calendar",
    name: "골든타임",
    why: "수익률 다음은 놓치면 손해인 기한 — 연말정산·납입 마감을 날짜로 봅니다",
  },
  "silson-compare": {
    href: "/apps/coverage-check",
    name: "보장 점검 시뮬레이터",
    why: "병원비 비교 다음은 담보 공백 — 5대 담보를 기준점과 나란히 봅니다",
  },
  "coverage-check": {
    href: "/apps/disclosure-check",
    name: "고지 항목 자가체크",
    why: "점검한 담보로 계약을 볼 때는 고지 항목을 먼저 정리합니다",
  },
  "disclosure-check": {
    href: "/apps",
    name: "앱스토어 전체",
    why: "고지까지 확인했다면, 남은 계산 도구를 한자리에서 골라 봅니다",
  },
  "trade-timemachine": {
    href: "/apps/compound-return",
    name: "투자 복리·세후 수익률 계산기",
    why: "진입·손절 규칙을 되짚었다면, 적립의 세후 결과를 계산해 봅니다",
  },
};

export function nextTool(slug: string): ToolNext {
  return (
    toolTrack[slug] ?? {
      href: "/apps",
      name: "앱스토어 전체",
      why: "다른 도구도 같은 자리에서 열어 볼 수 있습니다",
    }
  );
}
