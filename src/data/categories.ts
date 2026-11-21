/**
 * 자산리포트 카테고리 8개.
 * slug는 URL(/posts/{slug})에, name은 화면에 쓴다.
 * tone은 목록의 작은 괘선·점 하나에만 쓰는 잉크색이다.
 */
export type CategorySlug =
  | "finance"
  | "invest"
  | "economy"
  | "insurance"
  | "retire"
  | "pension"
  | "ai"
  | "philosophy";

export type Category = {
  slug: CategorySlug;
  name: string;
  /** 카테고리 페이지 첫 문장 */
  lead: string;
  /** 이 칸에서 다루는 것 */
  covers: string[];
  tone: string;
};

export const categories: Category[] = [
  {
    slug: "finance",
    name: "금융",
    lead:
      "금리와 대출, 환율과 통장. 뉴스의 첫 문장과 내 계좌 사이에 놓인 몇 단계를 풀어 씁니다.",
    covers: ["기준금리와 대출금리", "고정·변동금리 선택", "현금흐름과 부채"],
    tone: "#2f4b6e",
  },
  {
    slug: "invest",
    name: "투자",
    lead:
      "수익률 이야기보다 먼저, 얼마를 잃고도 버틸 수 있는 구조를 적습니다.",
    covers: ["적립과 배분", "리밸런싱 규칙", "절세 계좌"],
    tone: "#3c5a3e",
  },
  {
    slug: "economy",
    name: "경제",
    lead:
      "지표 하나가 내 살림에 닿기까지의 경로를 따라갑니다. 환율, 물가, 금리, 성장.",
    covers: ["환율과 수입물가", "물가와 임금의 시차", "경기 지표 읽기"],
    tone: "#7a4b2a",
  },
  {
    slug: "insurance",
    name: "보험",
    lead:
      "약관과 증권을 읽는 기준. 지급되는 조건과 지급되지 않는 조건을 함께 보고, 담보의 빈 칸을 순서대로 확인합니다.",
    covers: ["실손 세대별 구조", "5대 담보 지급 조건", "고지의무와 청구"],
    tone: "#7d3f47",
  },
  {
    slug: "retire",
    name: "노후준비",
    lead:
      "은퇴 후 30년을 버티게 하는 것은 목돈보다 매달 나가는 돈의 구조입니다.",
    covers: ["은퇴 후 고정비", "건강보험료 전환", "간병과 요양"],
    tone: "#6b5a2e",
  },
  {
    slug: "pension",
    name: "연금",
    lead:
      "연금은 상품이 아니라 시간표입니다. 언제 넣고, 언제 멈추고, 언제부터 받는지.",
    covers: ["국민·퇴직·개인연금", "세액공제 한도", "수령 시점 설계"],
    tone: "#4b4569",
  },
  {
    slug: "ai",
    name: "AI",
    lead:
      "써 보지 않은 사용 후기는 쓰지 않습니다. 실제 업무에 붙여 보고 남은 기록만 올립니다.",
    covers: ["업무 자동화", "검수와 책임", "작은 도구 만들기"],
    tone: "#2d5c5f",
  },
  {
    slug: "philosophy",
    name: "철학·에세이",
    lead:
      "계산이 끝난 뒤에 남는 질문들. 돈을 버는 일과 쓰는 일, 설명하는 일에 대한 짧은 글.",
    covers: ["판단과 결정", "설명의 기술", "남기고 포기하는 일"],
    tone: "#565149",
  },
];

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug);

export const categoryName = (slug: string) => categoryBySlug(slug)?.name ?? slug;
