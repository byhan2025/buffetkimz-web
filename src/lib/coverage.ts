/**
 * 5대 담보 기준점 — 실행 화면(CoverageCheck)과 홈의 미리보기 카드가
 * 같은 숫자를 쓰도록 한 곳에 둔다. 한쪽만 고치면 화면이 어긋난다.
 */
export type CoverageBand = "30" | "40" | "50" | "60";

/**
 * 기준점의 성격을 한 문장으로 고정한다. 홈·/apps·근거 화면·실행 화면이 모두 이 표현을 쓴다.
 * "현장 기준표"처럼 공식 기준으로 읽힐 여지를 두지 않는다.
 */
export const COVERAGE_BASIS_LABEL = "참고용 내부 예시 기준(공식 약관·보험사 기준 아님)";

/**
 * 결과 숫자·상태 옆에 붙는 문구. 보장 충분성 판정으로 읽히지 않게 하고,
 * 계산 근거와 기준의 성격을 같은 줄에서 밝힌다.
 */
export const COVERAGE_NOTE =
  `입력한 가상 기준과의 단순 비교(보장 충분성 판정 아님) · 기준점은 ${COVERAGE_BASIS_LABEL}이며, 공개 약관·감독 자료와 비교해 소비자용으로 단순화한 값입니다`;

export type CoverageBasis = {
  cancer: number;
  brain: number;
  heart: number;
  /** 질병 수술비 */
  surgIll: number;
  /** 상해 수술비 */
  surgInj: number;
  /** 간병비 일당(만원) */
  nursing: number;
};

export const COVERAGE_BASIS: Record<CoverageBand, CoverageBasis> = {
  "30": { cancer: 5000, brain: 2000, heart: 2000, surgIll: 300, surgInj: 300, nursing: 10 },
  "40": { cancer: 5000, brain: 2000, heart: 2000, surgIll: 300, surgInj: 300, nursing: 10 },
  "50": { cancer: 5000, brain: 2000, heart: 2000, surgIll: 500, surgInj: 500, nursing: 15 },
  "60": { cancer: 3000, brain: 1000, heart: 1000, surgIll: 500, surgInj: 500, nursing: 15 },
};

export const BAND_LABEL: Record<CoverageBand, string> = {
  "30": "30대",
  "40": "40대",
  "50": "50대",
  "60": "60대 이상",
};

/** 실행 화면이 처음 열릴 때 채워 두는 예시 입력값 */
export const COVERAGE_EXAMPLE = {
  band: "40" as CoverageBand,
  cancer: 5000,
  brain: 2000,
  heart: 1000,
  surgIll: 300,
  surgInj: 100,
  nursing: 5,
};

export type CoverageVerdict = { label: string; key: "ok" | "review" | "check" };

/** 점·막대·글자 색 — 범례와 행 라벨이 같은 색을 쓰도록 한 곳에 둔다. */
export const COVERAGE_TONE: Record<CoverageVerdict["key"], { dot: string; text: string }> = {
  ok: { dot: "#2f8f6f", text: "#1f6f55" },
  review: { dot: "#c0a05c", text: "#7d5f18" },
  check: { dot: "#b57e8b", text: "#8f3549" },
};

/**
 * 범례는 화면에 실제로 나온 상태만 보여 준다.
 * 쓰이지 않는 상태를 범례에 남기면 라벨과 범례가 어긋나기 때문이다.
 */
export function presentVerdicts(rows: { verdict: CoverageVerdict["key"] }[]) {
  return (["ok", "review", "check"] as const).filter((key) => rows.some((r) => r.verdict === key));
}

/**
 * 3상태 라벨 — 홈 미리보기·게이지 도해·실행 화면이 같은 말을 쓴다.
 * "충족"은 보장이 충분하다는 판정으로 읽히므로 쓰지 않는다.
 */
export const COVERAGE_LABEL = {
  ok: "예시 기준 도달",
  review: "보완 검토",
  check: "추가 확인 필요",
} as const;

export function judgeRatio(ratio: number): CoverageVerdict {
  if (ratio >= 1) return { label: COVERAGE_LABEL.ok, key: "ok" };
  if (ratio >= 0.7) return { label: COVERAGE_LABEL.review, key: "review" };
  return { label: COVERAGE_LABEL.check, key: "check" };
}

/** 홈 도해·미리보기 카드가 쓰는 5칸 요약 (수술비는 질병+상해를 합쳐 한 칸) */
export function coverageSummary(band: CoverageBand = COVERAGE_EXAMPLE.band) {
  const need = COVERAGE_BASIS[band];
  const have = COVERAGE_EXAMPLE;
  const rows = [
    { key: "cancer", name: "암", need: need.cancer, have: have.cancer, unit: "만원" },
    { key: "brain", name: "뇌혈관", need: need.brain, have: have.brain, unit: "만원" },
    { key: "heart", name: "심장", need: need.heart, have: have.heart, unit: "만원" },
    { key: "surgery", name: "수술비", need: need.surgIll + need.surgInj, have: have.surgIll + have.surgInj, unit: "만원" },
    { key: "nursing", name: "간병비", need: need.nursing, have: have.nursing, unit: "만원/일" },
  ].map((r) => {
    const ratio = r.need === 0 ? 1 : r.have / r.need;
    const verdict = judgeRatio(ratio);
    /* key(담보 이름)를 덮어쓰지 않고 verdict에 상태를 따로 담는다 —
       화면의 상태 개수와 범례가 실제 행 라벨과 어긋나지 않게 하기 위해서다. */
    return { ...r, ratio, label: verdict.label, verdict: verdict.key };
  });

  const count = (v: "ok" | "review" | "check") => rows.filter((r) => r.verdict === v).length;
  return { band, rows, ok: count("ok"), review: count("review"), check: count("check") };
}
