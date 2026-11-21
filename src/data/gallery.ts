/**
 * 자료앨범(/gallery) 데이터 — v7.5.
 *
 * ── 운영 방식(관리자 전용) ────────────────────────────────────────────────
 * 이 사이트는 정적 빌드(GitHub Pages)입니다. 그래서 **웹에 업로드 폼이나 API를 두지 않습니다.**
 * 방문자는 미리보기와 다운로드만 하고, 새 자료는 관리자(김대표님·에이전트)가
 *   ① 이미지를 `public/gallery/`에 넣고
 *   ② 아래 `galleryItems`에 카드 한 건을 추가한 뒤
 *   ③ 빌드·배포(`npm run deploy:pages`)하는 방식으로만 등록됩니다.
 * 즉, 이 파일이 곧 '공개된 자료 목록'이며, 저장소에 푸시할 수 있는 사람만 자료를 올릴 수 있습니다.
 *
 * ── 카드 규격 ────────────────────────────────────────────────────────────
 * · 이미지: 1080×1350 (4:5) PNG — 카드뉴스·캐러셀·인포그래픽·체크리스트 공통
 * · 세트: `slides` 배열에 순서대로 담는다. 1장이면 단일 카드, 2장 이상이면 캐러셀.
 * · 파일 이름은 `public/gallery/` 아래 경로를 그대로 적는다(다운로드 파일명도 이 이름).
 *
 * 카테고리를 늘리려면 GALLERY_CATEGORIES에 한 줄만 더하면 탭·개수가 자동으로 따라옵니다.
 */

export type GalleryCategoryId = "cardnews" | "carousel" | "infographic" | "checklist";

export type GalleryCategory = {
  id: GalleryCategoryId;
  label: string;
  /** 탭 아래·섹션에 쓰는 한 줄 */
  blurb: string;
};

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  { id: "cardnews", label: "카드뉴스", blurb: "한 주제를 3~5장으로 끊어 읽는 카드" },
  { id: "carousel", label: "캐러셀", blurb: "넘기며 보는 연속 카드 세트" },
  { id: "infographic", label: "인포그래픽", blurb: "한 장에 담은 구조와 순서" },
  { id: "checklist", label: "체크리스트", blurb: "확인할 항목을 순서대로" },
];

export type GallerySlide = {
  /** public 기준 경로 */
  src: string;
  width: number;
  height: number;
  /** 화면 낭독기·라이트박스 설명 */
  alt: string;
  /** 카드 아래 한 줄 — 이 장이 말하는 것 */
  caption: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  /** 카드 이름 아래 한 줄 */
  tagline: string;
  summary: string;
  category: GalleryCategoryId;
  /** 등록일(기준일) */
  createdAt: string;
  tags: string[];
  slides: GallerySlide[];
  /** 이 자료를 만든 기준 — 카드 하단에 그대로 보인다 */
  basis: string;
  /** 이어 읽을 글·도구 */
  related?: { label: string; href: string }[];
};

const W = 1080;
const H = 1350;

/** 카드뉴스 ① — 4대 계좌 비교 4장 */
const accountsSlides: GallerySlide[] = [
  {
    src: "/gallery/pension-accounts-01.png",
    width: W,
    height: H,
    alt: "4대 계좌 비교 표지 — 네 개의 막대와 '같은 돈, 네 개의 그릇'이라는 제목",
    caption: "표지 — 같은 5,000만원 수익, 네 계좌의 세후 결말",
  },
  {
    src: "/gallery/pension-accounts-02.png",
    width: W,
    height: H,
    alt: "네 계좌의 세금 시점을 2×2로 정리한 카드 — 연금저축·IRP·ISA·일반계좌",
    caption: "네 계좌 — 납입·운용·수령의 세금 시점",
  },
  {
    src: "/gallery/pension-accounts-03.png",
    width: W,
    height: H,
    alt: "5,000만원 수익의 계좌별 세금과 세후 실수령을 비교한 표",
    caption: "같은 5,000만원 수익, 세후로 남는 돈",
  },
  {
    src: "/gallery/pension-accounts-04.png",
    width: W,
    height: H,
    alt: "비교할 때 기억할 세 가지 조건 — 자산 유형, 9.9%의 구성, 연금 수령 요건",
    caption: "숫자보다 먼저 볼 세 가지 조건",
  },
];

/** 카드뉴스 ② — 연말 세 숫자 3장 */
const yearendSlides: GallerySlide[] = [
  {
    src: "/gallery/pension-yearend-01.png",
    width: W,
    height: H,
    alt: "연말 세액공제 표지 — 600·900·300 세 숫자와 12월 달력",
    caption: "표지 — 12월 31일 전에 확인할 세 숫자",
  },
  {
    src: "/gallery/pension-yearend-02.png",
    width: W,
    height: H,
    alt: "연금저축 600만원과 IRP 900만원 한도, 공제율 16.5%와 13.2% 비교",
    caption: "600과 900 — 한도와 공제율",
  },
  {
    src: "/gallery/pension-yearend-03.png",
    width: W,
    height: H,
    alt: "ISA 만기 전환 300만원은 공제대상 납입액이며 환급액이 아니라는 설명",
    caption: "300 — 환급액이 아니라 공제대상 납입액",
  },
];

export const galleryItems: GalleryItem[] = [
  /**
   * v7.5.0 — 3D 클레이 스토리 캐러셀(세트당 6장).
   * 일러스트에는 글자를 넣지 않고(NO text), 하단 38% 그라데이션 패널에 한글 타이포를 합성했다.
   * 렌더: `python3 scripts/render_gallery_3d.py`
   */
  {
    id: "yearend-order-3d",
    title: "연말정산 148만 원, 연금 순서",
    tagline: "3D 스토리 카드 6장 · 연금저축 600 → IRP 300",
    summary:
      "같은 월급인데 환급액이 달라지는 이유를 6장의 3D 스토리로 따라갑니다. 연금저축 600만 원 → IRP 300만 원 → 16.5% 환급 → 해지 주의 → 12월 31일 마감 순서입니다.",
    category: "carousel",
    createdAt: "2026-11-21",
    tags: ["연말정산", "연금저축", "IRP", "세액공제", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-yearend-order-01.png",
        width: W,
        height: H,
        alt: "표지 — 서류 두 장을 든 안경 쓴 너구리 캐릭터와 '똑같은 월급인데 연말정산이 다른 이유'",
        caption: "표지 — 같은 월급, 다른 연말정산",
      },
      {
        src: "/gallery/3d-yearend-order-02.png",
        width: W,
        height: H,
        alt: "연금저축 600만 원 — 유리병에 동전을 넣는 캐릭터와 '연금저축 먼저 600만 원'",
        caption: "1단계 — 연금저축 600만 원",
      },
      {
        src: "/gallery/3d-yearend-order-03.png",
        width: W,
        height: H,
        alt: "IRP 300만 원 — 금고에 동전을 채우는 캐릭터와 'IRP로 300만 원 더 채우기'",
        caption: "2단계 — IRP로 300만 원",
      },
      {
        src: "/gallery/3d-yearend-order-04.png",
        width: W,
        height: H,
        alt: "환급 — 봉투를 안고 웃는 캐릭터와 '총급여 5,500만 이하 환급률 16.5%'",
        caption: "3단계 — 16.5%, 최대 148만 5천 원",
      },
      {
        src: "/gallery/3d-yearend-order-05.png",
        width: W,
        height: H,
        alt: "주의 — 유리 돔과 자물쇠에 갇힌 저금통, '55세 전 해지하면 16.5% 추징'",
        caption: "주의 — 55세 전 해지 16.5%",
      },
      {
        src: "/gallery/3d-yearend-order-06.png",
        width: W,
        height: H,
        alt: "마감 — 달력에 동그라미를 치는 캐릭터와 '올해 12월 31일 입금분까지 적용'",
        caption: "클로징 — 12월 31일 입금분까지",
      },
    ],
    basis:
      "소득세법 제59조의3·제21조, 국세청 연말정산·연금계좌 세액공제 안내 · 기준 2026. 11. 21. · 총급여 5,500만 원 이하 16.5%(지방소득세 포함) 가정",
    related: [
      { label: "3편 — 연말 연금저축 600·IRP 900·ISA 전환 300", href: "/posts/pension-master-03-yearend-900" },
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
    ],
  },
  {
    id: "isa-basics-3d",
    title: "ISA 5분 정리, 핵심 네 가지",
    tagline: "3D 스토리 카드 6장 · 비과세·손익통산·한도·전환",
    summary:
      "이자·배당에 붙는 15.4%를 그냥 내지 않으려면 ISA부터 봅니다. 비과세 한도 → 손익통산 → 납입한도 → 연금계좌 전환까지 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-21",
    tags: ["ISA", "비과세", "손익통산", "납입한도", "연금전환", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-isa-basics-01.png",
        width: W,
        height: H,
        alt: "표지 — 한 입 베인 동전 더미를 보는 캐릭터와 '예금 이자 15.4% 세금, 그냥 다 내시나요?'",
        caption: "표지 — 이자 15.4%, 그냥 내시나요",
      },
      {
        src: "/gallery/3d-isa-basics-02.png",
        width: W,
        height: H,
        alt: "비과세 — 크고 작은 두 유리병과 '서민형 400만·일반형 200만 비과세'",
        caption: "핵심 1 — 비과세 400만·200만",
      },
      {
        src: "/gallery/3d-isa-basics-03.png",
        width: W,
        height: H,
        alt: "손익통산 — 저울 양팔에 수익과 손실 동전, '수익과 손실을 합쳐서 계산합니다'",
        caption: "핵심 2 — 손익통산",
      },
      {
        src: "/gallery/3d-isa-basics-04.png",
        width: W,
        height: H,
        alt: "납입한도 — 사다리 위에서 거대한 저금통에 동전을 붓는 캐릭터",
        caption: "핵심 3 — 연 2,000만·최대 1억",
      },
      {
        src: "/gallery/3d-isa-basics-05.png",
        width: W,
        height: H,
        alt: "연금 전환 — 동전 바구니를 든 캐릭터와 모래시계, '3년 채우고 연금계좌로 넘기면'",
        caption: "핵심 4 — 3년 후 연금 전환",
      },
      {
        src: "/gallery/3d-isa-basics-06.png",
        width: W,
        height: H,
        alt: "클로징 — 초록 문 앞에 선 캐릭터와 '일반 계좌 쓰기 전에 ISA부터'",
        caption: "클로징 — 일반 계좌 전에 ISA",
      },
    ],
    basis:
      "조세특례제한법 제91조의18, 소득세법 제129조·제59조의3 · 기준 2026. 11. 21. · 일반형·서민형 비과세 한도와 9.9% 분리과세 기준",
    related: [
      { label: "ISA 만기 자금, 60일 안에 옮길 때", href: "/posts/isa-pension-300" },
      { label: "4대 계좌 세후 비교 시뮬레이터", href: "/apps/account-tax-compare/run" },
    ],
  },
  {
    id: "pension-accounts",
    title: "4대 계좌, 같은 돈의 네 가지 결말",
    tagline: "일반·ISA·연금저축·IRP 세후 비교",
    summary:
      "같은 5,000만원 수익이 네 계좌에서 얼마씩 남는지 4장으로 정리했습니다. 계좌별 세금 시점 → 세후 숫자 → 비교할 때의 조건 순서로, 한 장에 한 가지만 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-21",
    tags: ["4대 계좌", "ISA", "연금저축", "IRP", "세후 비교"],
    slides: accountsSlides,
    basis: "소득세법 제17조·제129조, 조세특례제한법 제91조의18 · 기준 2026. 11. 21. · 과세대상 이익 5,000만원 가정",
    related: [
      { label: "2편 — 5,000만원 수익 시 4계좌 세후 차이", href: "/posts/pension-master-02-tax-compare" },
      { label: "4대 계좌 세후 비교 시뮬레이터", href: "/apps/account-tax-compare/run" },
    ],
  },
  {
    id: "pension-yearend",
    title: "12월의 세 숫자, 600 · 900 · 300",
    tagline: "연금저축·IRP 한도와 ISA 전환",
    summary:
      "연말정산 전에 확인할 세 숫자를 3장으로 끊었습니다. 600과 900은 공제대상 납입액, 300은 ISA에서 옮겼을 때 늘어나는 공제대상 한도입니다.",
    category: "cardnews",
    createdAt: "2026-11-21",
    tags: ["세액공제", "연금저축", "IRP", "ISA 전환", "연말정산"],
    slides: yearendSlides,
    basis: "소득세법 제59조의3·시행령 제118조의2·제118조의3 · 기준 2026. 11. 21.",
    related: [
      { label: "3편 — 연말 연금저축 600·IRP 900·ISA 전환 300", href: "/posts/pension-master-03-yearend-900" },
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
    ],
  },
  {
    id: "pension-draw-order",
    title: "연금 인출 순서 4단계",
    tagline: "세금이 없는 돈부터 나옵니다",
    summary:
      "연금계좌에서 돈이 나오는 순서를 한 장에 담았습니다. 세액공제 안 받은 원금 → 퇴직금 → 공제받은 원금 → 운용수익 순서와, 각 단계의 과세 방식을 함께 봅니다.",
    category: "infographic",
    createdAt: "2026-11-21",
    tags: ["연금 인출", "인출 순서", "1,500만원", "연금소득세"],
    slides: [
      {
        src: "/gallery/pension-draw-order.png",
        width: W,
        height: H,
        alt: "연금 인출 순서 4단계 인포그래픽 — 비과세 원금, 퇴직금, 공제분, 운용수익",
        caption: "인출 순서 4단계와 단계별 세율",
      },
    ],
    basis: "소득세법 제20조의3·제129조, 시행령 제40조의2 · 기준 2026. 11. 21.",
    related: [
      { label: "5편 — 인출 순서 4단계와 연 1,500만원", href: "/posts/pension-master-05-draw-1500" },
      { label: "연금 인출·세금 시뮬레이터", href: "/apps/pension-draw/run" },
    ],
  },
  {
    id: "pension-retire-checklist",
    title: "은퇴 전 점검 7가지",
    tagline: "건보료·중도인출·계좌 분리",
    summary:
      "은퇴 5~10년 전에 확인할 일곱 가지를 체크리스트 한 장으로 묶었습니다. 55세·5년 요건부터 건보료 기준, IRP 중도인출 사유까지 순서대로 확인합니다.",
    category: "checklist",
    createdAt: "2026-11-21",
    tags: ["은퇴 점검", "건강보험료", "IRP 중도인출", "체크리스트"],
    slides: [
      {
        src: "/gallery/pension-retire-checklist.png",
        width: W,
        height: H,
        alt: "은퇴 전 점검 7가지 체크리스트 — 요건, 계좌 분리, 건보료, 중도인출",
        caption: "은퇴 전 확인 7항목",
      },
    ],
    basis: "국민건강보험법 시행규칙 별표 1의2, 근로자퇴직급여 보장법 시행령 제18조 · 기준 2026. 11. 21.",
    related: [
      { label: "6편 — 은퇴 전후 건보료·중도인출 체크리스트", href: "/posts/pension-master-06-healthcheck" },
    ],
  },
];

export const galleryCount = galleryItems.length;
export const gallerySlideCount = galleryItems.reduce((n, i) => n + i.slides.length, 0);
export const categoryCount = (id: GalleryCategoryId) => galleryItems.filter((i) => i.category === id).length;
