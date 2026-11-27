/**
 * 13월의 월급 지도 — 2026년 귀속 연말정산 허브의 데이터 (v9.8.0).
 *
 * 왜 데이터로 두는가
 *  · D-데이·단계·체크리스트·연계 도구·글이 한 파일에 있어야 화면 문구와 숫자가 어긋나지 않는다.
 *  · 체크리스트는 진단 3문항(총급여 구간·자녀 수·월세)의 답에 따라 **남길 항목만** 고른다.
 *    조건은 함수가 아니라 선언(match)으로 적는다 — React 섬(island)에 그대로 넘길 수 있어야 하기 때문이다.
 *  · 서버 저장은 없다. 답은 화면 안 상태로만 쓰고 어디에도 보내지 않는다.
 *
 * 근거
 *  · 소득세법 제59조의3(연금계좌)·제59조의4(특별세액공제)·제59조의2(자녀세액공제)
 *  · 조세특례제한법 제126조의2(신용카드 등)·제58조(고향사랑 기부금)·제132조의2(소득공제 종합한도)
 *  · 국세청 연말정산 안내·미리보기 안내(2026. 10. 23. 정책브리핑)
 */

export const TAX_HUB = {
  /** 이 지도가 다루는 귀속 연도와 정산 시기 */
  badge: "2026년 귀속 (2027년 1~2월 정산)",
  year: 2026,
  title: "13월의 월급 지도",
  lede:
    "연말정산은 12월에 끝나는 일이 아닙니다. 12월 31일까지 채우는 단계, 1월에 모아 내는 단계, 2~5월에 확인하는 단계로 나뉩니다. 지금 내 자리부터 확인하세요.",
} as const;

export type Milestone = {
  id: string;
  /** 기한일 (YYYY-MM-DD). 2027년 1월처럼 날짜가 정해지지 않은 항목은 비운다. */
  dueDate?: string;
  /** 화면에 그대로 쓰는 날짜 표기 */
  dateLabel: string;
  title: string;
  body: string;
  source: string;
};

/** D-데이 띠 — 일정이 확정된 것만 날짜를 적는다. */
export const MILESTONES: Milestone[] = [
  {
    id: "preview-close",
    dueDate: "2026-12-18",
    dateLabel: "2026. 12. 18.(금)",
    title: "연말정산 미리보기 마감",
    body: "홈택스 미리보기는 2026. 10. 28.에 열려 12. 18.에 닫힙니다. 1~9월 카드 사용액과 10~12월 예상 지출을 넣으면 예상 세액이 나옵니다.",
    source: "국세청 (2026. 10. 23. 정책브리핑 '13월의 월급, 나는 얼마나 받을까?')",
  },
  {
    id: "spend-close",
    dueDate: "2026-12-31",
    dateLabel: "2026. 12. 31.(목)",
    title: "올해 지출·납입 마감",
    body: "연금저축·IRP 납입, 카드 사용, 고향사랑기부, 보장성보험료는 12월 31일까지의 금액이 2026년 귀속분입니다. 결제일이 아니라 승인·입금 기준으로 확인하세요.",
    source: "소득세법 제59조의3, 조세특례제한법 제126조의2·제58조",
  },
  {
    id: "simplified-open",
    dateLabel: "2027년 1월",
    title: "간소화 서비스 개통",
    body: "보험료·연금저축·의료비·교육비 납입증명서를 한 번에 조회하는 간소화 서비스는 2027년 1월에 열립니다. 개통일은 아직 발표되지 않았습니다.",
    source: "국세청 연말정산 안내 (개통 일정 미발표)",
  },
];

export type SalaryBand = "le5500" | "b5500_7000" | "b7000_8000" | "gt8000";

export const SALARY_BANDS: { value: SalaryBand; label: string; note: string }[] = [
  { value: "le5500", label: "5,500만원 이하", note: "연금계좌 공제율 16.5%" },
  { value: "b5500_7000", label: "5,500 ~ 7,000만원", note: "연금계좌 공제율 13.2%" },
  { value: "b7000_8000", label: "7,000 ~ 8,000만원", note: "카드 기본 한도 250만원대" },
  { value: "gt8000", label: "8,000만원 초과", note: "문화·체육 별도 칸 없음" },
];

export type Answers = {
  salary: SalaryBand;
  /** 기본공제 자녀등 수 (0·1·2 이상은 2로 둔다) */
  children: 0 | 1 | 2;
  /** 무주택 월세 거주 여부 */
  rent: boolean;
};

export type ChecklistItem = {
  id: string;
  title: string;
  /** 이 항목이 남는 조건 — 비어 있으면 늘 남는다 */
  match?: {
    salary?: SalaryBand[];
    childrenMin?: number;
    rent?: boolean;
  };
  /** 확인할 숫자 한 줄 */
  amount: string;
  body: string;
  source: string;
  href?: string;
  hrefLabel?: string;
};

/** 진단 3문항으로 걸러지는 체크리스트 — 조건은 선언으로만 적는다. */
export const CHECKLIST: ChecklistItem[] = [
  {
    id: "card",
    title: "신용카드 등 사용액과 25% 문턱",
    amount: "총급여의 25%를 넘긴 금액부터 공제 · 한도 300만~400만원",
    body: "이미 쓴 신용카드 금액이 문턱을 넘겼는지, 공제액이 한도에 닿았는지 두 숫자를 확인합니다. 문턱을 못 넘었으면 12월에 결제수단을 바꿔도 공제는 늘지 않습니다.",
    source: "조세특례제한법 제126조의2",
    href: "/apps/credit-card-deduction/run",
    hrefLabel: "신용카드 공제 계산기",
  },
  {
    id: "pension",
    title: "연금저축·IRP 납입 (12월 31일 입금분)",
    amount: "연금저축 600만원 · 합산 900만원",
    body: "총급여 5,500만원 이하 16.5%, 넘으면 13.2% 세액공제입니다. 900만원을 채우면 최대 148만 5,000원이 줄지만, 그해 산출세액을 넘는 공제는 환급되지 않습니다.",
    source: "소득세법 제59조의3",
    href: "/apps/pension-tax/run",
    hrefLabel: "연금저축·IRP 세액공제 계산기",
  },
  {
    id: "isa",
    title: "ISA 만기 이전 추가 한도",
    amount: "이전액의 10% · 최대 300만원",
    body: "ISA를 만기 해지해 연금계좌로 옮기면 900만원 위에 300만원까지 더 공제됩니다. 이전 절차는 만기 전에 금융사에 미리 물어봐야 합니다.",
    source: "소득세법 제59조의3·조세특례제한법 제91조의18",
    href: "/apps/pension-tax/run",
    hrefLabel: "이전액까지 계산하기",
  },
  {
    id: "insurance",
    title: "보장성보험료 납입증명서 확인",
    amount: "기본공제대상자 1명당 100만원 한도 · 12%",
    body: "12월 31일까지 낸 보험료가 대상입니다. 보장성보험만 해당하고 저축성·연금보험료는 빠집니다. 증권이 아니라 납입증명서의 금액으로 확인하세요.",
    source: "소득세법 제59조의4 제1항",
    href: "/posts/year-end-credit-card-deduction-2026",
    hrefLabel: "12월 체크리스트로 보기",
  },
  {
    id: "medical",
    title: "의료비 — 총급여 3% 초과분",
    amount: "총급여 3%를 넘긴 금액 · 15%(난임 30%)",
    body: "병원비·약값·안경·보청기·산후조리원비가 대상입니다. 실손보험에서 돌려받은 금액은 빼고 계산합니다.",
    source: "소득세법 제59조의4 제2항",
  },
  {
    id: "child",
    title: "자녀세액공제·교육비 세액공제",
    amount: "자녀 수와 나이 요건 확인 · 8세 이상 여부",
    match: { childrenMin: 1 },
    body: "자녀가 있으면 세액공제와 교육비 공제 대상 여부가 함께 달라집니다. 취학 전 아동과 대학생은 교육비 한도가 다릅니다.",
    source: "소득세법 제59조의2·제59조의4 제3항",
  },
  {
    id: "birth",
    title: "출산·입양 세액공제 (첫해)",
    amount: "자녀 1명당 · 해당 과세기간 1회",
    match: { childrenMin: 1 },
    body: "해당 과세기간에 자녀를 낳거나 입양한 경우 한 번 받는 공제입니다. 자녀세액공제와 별개로 계산합니다.",
    source: "소득세법 제59조의2 제3항",
  },
  {
    id: "rent",
    title: "월세 세액공제",
    amount: "연 750만원 한도 · 15~17%",
    match: { rent: true },
    body: "총급여 8,000만원 이하 무주택 세대주가 대상입니다. 월세액을 낸 계좌이체 내역과 임대차계약서, 주민등록등본을 확인합니다.",
    source: "소득세법 제59조의4 제6항",
  },
  {
    id: "home-savings",
    title: "주택자금·전세자금대출 이자",
    amount: "주택임차차입금 원리금 상환액 300만원 한도(소득요건)",
    match: { salary: ["le5500"], rent: false },
    body: "무주택 세대주가 전세자금대출 이자를 냈다면 소득공제 대상입니다. 월세 세액공제와는 요건이 다르니 둘 중 하나만 고를 수 있는지 확인합니다.",
    source: "소득세법 제52조",
  },
  {
    id: "gohyang",
    title: "고향사랑 기부금 (12월 31일까지)",
    amount: "10만원까지 100% · 10만~20만원 40%",
    body: "주소지가 아닌 지방자치단체에 기부한 금액은 세액공제로 돌려받습니다. 20만원을 기부하면 소득세·지방소득세를 합쳐 약 14만 4,000원이 줄어듭니다.",
    source: "조세특례제한법 제58조·고향사랑 기부금에 관한 법률",
    href: "/posts/gohyang-love-donation-200k-2026",
    hrefLabel: "20만원 계산과 실무",
  },
  {
    id: "culture",
    title: "문화·체육 사용분 30% 칸",
    amount: "도서·공연·영화·수영장·체력단련장",
    match: { salary: ["le5500", "b5500_7000"] },
    body: "총급여 7,000만원 이하면 문화·체육 사용분에 30%가 따로 붙습니다. 7,000만원을 넘으면 이 칸이 없어져 결제수단 공제율로 계산됩니다.",
    source: "조세특례제한법 제126조의2 제2항 제3호",
    href: "/apps/credit-card-deduction/run",
    hrefLabel: "문화·체육 넣어 계산하기",
  },
  {
    id: "cap",
    title: "소득공제 종합한도 2,500만원",
    amount: "여러 소득공제를 합쳐 2,500만원",
    match: { salary: ["gt8000", "b7000_8000"] },
    body: "신용카드·주택자금·연금보험료 등 여러 소득공제를 합쳐 2,500만원을 넘으면 넘는 부분은 공제되지 않습니다. 세액공제는 이 한도 밖입니다.",
    source: "조세특례제한법 제132조의2",
  },
];

export type Step = {
  id: string;
  tab: string;
  title: string;
  when: string;
  items: { title: string; body: string }[];
};

/** 3단계 — 화면 탭 순서가 곧 시간 순서다. */
export const STEPS: Step[] = [
  {
    id: "now",
    tab: "1단계 · 지금~12월 말 채우기",
    title: "12월 31일까지, 채울 수 있는 것만 채웁니다",
    when: "2026년 11월 ~ 12월 31일",
    items: [
      {
        title: "미리보기에서 내 문턱과 한도 확인",
        body: "홈택스 연말정산 미리보기(10. 28. ~ 12. 18.)에 1~9월 카드 사용액과 연금 납입액이 보입니다. 빠진 내역이 있으면 1월 간소화에서 다시 확인합니다.",
      },
      {
        title: "연금저축·IRP는 12월 31일 입금분까지",
        body: "연금저축 600만원, IRP를 합쳐 900만원. 총급여 구간에 따라 16.5% 또는 13.2%가 줄어듭니다. 납입 예정일이 1월이면 올해 공제에서 빠집니다.",
      },
      {
        title: "카드 결제수단은 문턱을 넘긴 뒤에 바꾸기",
        body: "신용카드 사용액이 총급여의 25%를 넘겼고 공제액이 한도에 닿지 않았을 때만 체크카드 전환이 공제를 늘립니다. 두 조건은 계산기로 바로 확인됩니다.",
      },
      {
        title: "보장성보험료·고향사랑기부 마감 확인",
        body: "보장성보험료는 100만원 한도, 고향사랑기부는 10만원까지 100%·10만~20만원 40% 세액공제입니다. 둘 다 12월 31일까지 낸 금액이 대상입니다.",
      },
    ],
  },
  {
    id: "january",
    tab: "2단계 · 1월 자료 모으기·제출",
    title: "1월에는 모아서 냅니다 — 새로 만들 수는 없습니다",
    when: "2027년 1월 ~ 2월",
    items: [
      {
        title: "간소화 서비스에서 빠진 자료 찾기",
        body: "2027년 1월에 열리는 간소화 서비스는 보험료·연금저축·의료비·교육비·기부금 납입증명서를 모아 줍니다. 미리보기와 금액이 다르면 이 자료가 기준입니다.",
      },
      {
        title: "주택·기부·신용카드 자료는 직접 챙기기",
        body: "월세 계좌이체 내역, 전세자금대출 이자, 고향사랑기부 영수증, 가족카드 사용분은 간소화에 다 나오지 않는 경우가 있어 직접 첨부합니다.",
      },
      {
        title: "회사에 제출하고 원천징수영수증 받기",
        body: "회사가 처리한 결과는 2월 급여와 원천징수영수증에 나옵니다. 결정세액과 공제 내역을 그대로 보관하세요. 경정청구의 출발점입니다.",
      },
    ],
  },
  {
    id: "later",
    tab: "3단계 · 2~5월 환급 확인·경정청구",
    title: "2월에 급여로, 5월에 신고로 확인합니다",
    when: "2027년 2월 ~ 5월 (경정청구는 5년)",
    items: [
      {
        title: "2월 급여에서 환급·추납 확인",
        body: "환급이면 2월 급여에 더해지고, 부족하면 추가로 징수됩니다. 예상보다 적으면 빠진 공제가 무엇인지 원천징수영수증에서 확인합니다.",
      },
      {
        title: "5월 종합소득세 신고 대상인지",
        body: "근로소득 외에 사업·임대·금융소득이 있으면 5월에 직접 신고합니다. 이때도 연금계좌·기부금 세액공제를 같은 방식으로 받습니다.",
      },
      {
        title: "빠진 공제는 경정청구로 (5년 이내)",
        body: "놓친 공제를 나중에 찾았다면 경정청구를 할 수 있습니다. 2026년 귀속분은 2031년까지 가능하지만, 증빙이 남아 있어야 합니다.",
      },
    ],
  },
];

/** 이 지도에서 바로 여는 계산기 — 순서가 화면 순서다. */
export const HUB_CALCULATORS = [
  {
    href: "/apps/credit-card-deduction/run",
    name: "신용카드 공제 계산기",
    line: "25% 문턱·한도·12월 전환 효과",
    tag: "신규",
  },
  {
    href: "/apps/pension-tax/run",
    name: "연금저축·IRP 세액공제",
    line: "900만원 한도와 남은 금액",
  },
  {
    href: "/apps/salary-net/run",
    name: "연봉 실수령 계산기",
    line: "총급여와 4대보험·세금",
  },
] as const;

/** 이 지도와 이어지는 글 — slug는 실제 발행 글과 짝이어야 한다(빌드에서 확인). */
export const HUB_POSTS = [
  "year-end-credit-card-deduction-2026",
  "finance-pension-900-credit-check",
  "gohyang-love-donation-200k-2026",
] as const;

/** 진단 답으로 남는 항목만 고른다. 서버로 보내지 않고 화면 안에서만 쓴다. */
export function filterChecklist(answers: Answers): ChecklistItem[] {
  return CHECKLIST.filter((item) => {
    const m = item.match;
    if (!m) return true;
    if (m.salary && !m.salary.includes(answers.salary)) return false;
    if (m.childrenMin !== undefined && answers.children < m.childrenMin) return false;
    if (m.rent !== undefined && answers.rent !== m.rent) return false;
    return true;
  });
}

export const ANSWER_NOTE =
  "답은 이 화면 안에서만 쓰고 저장하지 않습니다. 서버로 보내는 값은 없습니다.";
