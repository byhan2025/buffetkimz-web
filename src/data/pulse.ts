/**
 * 분야별 30초 브리핑 — v7.0 홈 포털.
 *
 * 금융포털의 '탭 피드'가 읽는 한 파일. 세 탭(투자·연금 / 절세·세법 / 보험·리스크)마다
 * 세 줄씩, 한 줄에 하나의 판단 재료만 둔다. 문장은 전부 이미 발행한 글·도구와
 * `today.ts`의 확인값에서 나온 것이어야 한다(여기서 새 사실을 만들지 않는다).
 *
 * `href`는 읽을 글 또는 바로 열 도구 하나만 가리킨다.
 */

export type PulseGroupId = "invest" | "tax" | "risk";

export type PulseItem = {
  title: string;
  /** 왜 내 돈과 관련 있는가 — 한 문장 */
  line: string;
  /** 기준 표기 — '기준 11. 21. · 금융위' */
  meta: string;
  /** 이어서 볼 글 또는 도구 */
  href: string;
  cta: string;
};

export type PulseGroup = {
  id: PulseGroupId;
  label: string;
  en: string;
  /** 탭 위 한 줄 */
  line: string;
  items: PulseItem[];
};

export const pulseGroups: PulseGroup[] = [
  {
    id: "invest",
    label: "투자·연금",
    en: "INVEST · PENSION",
    line: "수익률보다 먼저 볼 것 — 비중, 간격, 받는 해의 세금.",
    items: [
      {
        /* 2026-11-28 — 줄이 11. 21.에 멈춰 있어 그날의 시황·D-day가 지난 채로 남았다. 발행한 글의 숫자로 바꾼다. */
        title: "국민연금, 3개월에 202조 원이 줄었습니다",
        line: "6월 말 1,865.6조 원에서 9월 말 1,663.7조 원입니다. 원금 회복에 12.1%, 연 8.04%로 1년 6개월이 걸립니다.",
        meta: "기준 11. 28. · 자산리포트",
        href: "/posts/pension-fund-loss-recovery-math",
        cta: "계산 읽기",
      },
      {
        title: "해외주식은 결제일이 귀속연도를 정합니다",
        line: "미국 주식은 T+1, 국내·홍콩·일본은 T+2입니다. 12월 31일 체결한 매도는 어느 시장이든 다음 해 소득입니다.",
        meta: "소득세법 제94조·제102조 · 기준 11. 22.",
        href: "/posts/invest-overseas-stock-tax",
        cta: "양도세 읽기",
      },
      {
        title: "연금은 받는 해의 세금까지",
        line: "연 1,500만 원을 넘으면 과세 방식이 갈립니다. 받기 전에 두 갈래를 같은 화면에 놓고 봅니다.",
        meta: "소득세법 제64조의4",
        href: "/apps/pension-draw/run",
        cta: "인출 세금 계산",
      },
    ],
  },
  {
    id: "tax",
    label: "절세·세법",
    en: "TAX · DEDUCTION",
    line: "날짜를 놓치면 그해 공제가 사라지는 항목부터.",
    items: [
      {
        title: "12월 31일까지 넣은 금액만 공제",
        line: "연금저축 600만 원, IRP 합산 900만 원. 채우면 최대 148만 5,000원만큼 세금이 줄어듭니다(결정세액 한도 내).",
        meta: "소득세법 제59조의3 · 12. 31. 마감",
        href: "/apps/pension-tax/run",
        cta: "남은 한도 계산",
      },
      {
        title: "카드 공제는 25%를 넘긴 뒤 결제수단이 정합니다",
        line: "총급여 6,000만 원에 2,000만 원을 쓰면 전부 신용카드일 때 75만 원, 체크카드로 500만 원을 채우면 150만 원입니다.",
        meta: "기준 11. 28. · 소득세법",
        href: "/posts/year-end-credit-card-deduction-2026",
        cta: "공제 계산",
      },
      {
        title: "ISA 만기 이전은 추가 공제",
        line: "옮긴 금액의 10%(최대 300만 원)만큼 공제 대상 납입액이 늘어납니다. 실제 절감은 49만 5,000원 또는 39만 6,000원입니다.",
        meta: "조세특례제한법 제91조의18",
        href: "/posts/isa-pension-300",
        cta: "이전 조건 읽기",
      },
    ],
  },
  {
    id: "risk",
    label: "보험·리스크",
    en: "RISK · COVERAGE",
    line: "이름이 아니라 지급 조건과 고지로 확인합니다.",
    items: [
      {
        title: "1·2세대 실손 전환, 11월 23일부터 시행 중",
        line: "5세대로 바꾸면 3년간 보험료 50% 할인, 그대로 두면 고른 항목만 빼고 최대 37% 할인입니다.",
        meta: "금융위 2026. 11. 19. · 11. 23. 시행",
        href: "/apps/silson-compare/run",
        cta: "세대별 비교",
      },
      {
        title: "폐암 담보는 병리 결과지 코드로 갈립니다",
        line: "C34는 일반암, D02.2는 제자리암, D38.1은 경계성종양입니다. 검진 이력이 아니라 결과지의 코드를 봅니다.",
        meta: "기준 11. 27. · 자산리포트",
        href: "/posts/insurance-lung-cancer-never-smoker",
        cta: "코드 확인",
      },
      {
        title: "고지의무는 청약서에 적는 일",
        line: "구두로 알린 내용만으로는 효력이 인정되지 않을 수 있습니다. 3개월·2년·5년 질문을 미리 정리합니다.",
        meta: "금융감독원 안내",
        href: "/apps/disclosure-check/run",
        cta: "고지 항목 체크",
      },
    ],
  },
];
