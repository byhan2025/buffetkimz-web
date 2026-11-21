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
        title: "AI·반도체 투매, 국내도 −5%대",
        line: "이런 날 확인할 것은 수익률이 아니라 계좌별 비중입니다. 떨어진 뒤에 비중이 커진 자산부터 봅니다.",
        meta: "기준 11. 21. 06:00 · 연합뉴스",
        href: "/posts/invest-dca-rule",
        cta: "적립 규칙 읽기",
      },
      {
        title: "적립식은 금액보다 간격이 먼저",
        line: "매달 같은 날 같은 금액이 들어가면, 시장이 흔들릴 때 매수 단가가 스스로 분산됩니다.",
        meta: "기준 11. 21. · 자산리포트",
        href: "/posts/invest-dca-rule",
        cta: "글 읽기",
      },
      {
        title: "연금은 받는 해의 세금까지",
        line: "연 1,500만 원을 넘으면 과세 방식이 갈립니다. 받기 전에 두 갈래를 같은 화면에 놓고 봅니다.",
        meta: "소득세법 제64조의4 · 기준일 11. 21.",
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
        line: "연금저축 600만 원, IRP 합산 900만 원. 채우면 최대 148만 5,000원을 돌려받습니다.",
        meta: "소득세법 제59조의3 · D-40",
        href: "/apps/pension-tax/run",
        cta: "남은 한도 계산",
      },
      {
        title: "11월 30일, 중간예납 마지막 날",
        line: "고지서가 나온 사업소득자는 이 날까지 내야 합니다. 넘기면 납부지연 가산세가 붙습니다.",
        meta: "국세청 · D-9",
        href: "/calendar#m11",
        cta: "골든타임 11월",
      },
      {
        title: "ISA 만기 이전은 추가 공제",
        line: "ISA 만기금을 연금계좌로 옮기면 300만 원까지 더 공제됩니다. 이전 기한이 따로 있습니다.",
        meta: "조세특례제한법 · 기준일 11. 21.",
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
        title: "1·2세대 실손 전환, 11월 23일 시작",
        line: "5세대로 바꾸면 3년간 보험료 50% 할인, 그대로 두면 고른 항목만 빼고 최대 37% 할인입니다.",
        meta: "금융위 2026. 11. 19. · D-2",
        href: "/apps/silson-compare/run",
        cta: "세대별 비교",
      },
      {
        title: "5대 담보는 이름보다 지급 조건",
        line: "같은 '암 진단비'라도 일반암·소액암·유사암의 지급액이 다릅니다. 금액만 비교하면 절반만 보는 셈입니다.",
        meta: "기준 11. 21. · 자산리포트",
        href: "/posts/insurance-coverage-conditions",
        cta: "지급 조건 읽기",
      },
      {
        title: "고지의무는 청약서에 적는 일",
        line: "구두로 알린 내용만으로는 효력이 인정되지 않을 수 있습니다. 3개월·2년·5년 질문을 미리 정리합니다.",
        meta: "금융감독원 안내 · 기준일 11. 21.",
        href: "/apps/disclosure-check/run",
        cta: "고지 항목 체크",
      },
    ],
  },
];
