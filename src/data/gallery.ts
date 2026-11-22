/**
 * 자료앨범(/gallery) 데이터 — v7.8.
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
   * v8.4.0 — STEP 6 리밸런싱·현금 비중, 학교 자산형성 1강과 함께 온 1세트(6장).
   * 스타일은 v8.2/8.3과 같은 **손글씨 + 형광펜 + 크림지 + 파스텔 2D 손그림**이다(렌더 `tmp/clay1222/render_hand2.py`).
   * 목표 비중·점검 주기·현금 비중을 6장으로 끊었고, 특정 종목·상품 권유는 없다.
   */
  {
    id: "asset-rebalance-hand",
    title: "오를 때 덜고 내릴 때 채우기 — 리밸런싱과 현금 비중",
    tagline: "손글씨 카드 6장 · 목표 비중 70:30, 연 1회 + 5%p 점검",
    summary: "리밸런싱은 수익을 포기하는 일이 아니라 한 자산에 쏠리는 위험을 규칙으로 줄이는 일입니다. 목표 비중을 금액으로 바꾸는 산식(목표금액 = 총자산 × 목표비중), 1년에 한 번과 ±5%p 임계 점검, 생활비 3~6개월과 3년 안에 쓸 돈을 투자 밖에 두는 현금 원칙을 6장에 담았습니다. 특정 종목·상품 권유는 없습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "리밸런싱", "현금 비중", "자산배분", "목표 비중", "자산형성"],
    slides: [
      {
        src: "/gallery/3d-asset-rebalance-01.png",
        width: W,
        height: H,
        alt: "표지 — 저울 위 두 단지 사이에서 동전을 옮겨 담는 마스코트와 '오를 때 덜고 내릴 때 채웁니다'",
        caption: "표지 — 리밸런싱은 오를 때 덜고 내릴 때 채우는 일",
      },
      {
        src: "/gallery/3d-asset-rebalance-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 무너질 듯 높이 쌓은 동전 탑을 붙든 마스코트, 오른쪽은 크기가 고른 세 단지를 나란히 둔 마스코트",
        caption: "오해 vs 팩트 — 그냥 두기 / 목표금액 = 총자산 × 목표비중, 넘으면 덜기",
      },
      {
        src: "/gallery/3d-asset-rebalance-03.png",
        width: W,
        height: H,
        alt: "목표 비중 — 둘로 나눈 파이 옆에서 자와 연필을 든 마스코트, '총자산 1,000만이면 주식 700만'",
        caption: "① 목표 비중 — 총자산 1,000만이면 주식 700만, 지금 820만이면 120만 덜기",
      },
      {
        src: "/gallery/3d-asset-rebalance-04.png",
        width: W,
        height: H,
        alt: "점검 주기 — 달력의 한 칸에 동그라미를 치는 마스코트와 작은 종, '1년에 한 번, 5%p 넘으면 그때도'",
        caption: "② 점검 — 정기 연 1회 + 임계 ±5%p, 점검 날짜를 달력에 먼저 적기",
      },
      {
        src: "/gallery/3d-asset-rebalance-05.png",
        width: W,
        height: H,
        alt: "현금 비중 — 울타리 친 동전 나무와, 바구니·우산을 올려둔 나무 선반을 가리키는 마스코트",
        caption: "③ 현금 비중 — 생활비 3~6개월 + 3년 안에 쓸 돈은 투자 밖에",
      },
      {
        src: "/gallery/3d-asset-rebalance-06.png",
        width: W,
        height: H,
        alt: "요약 — 체크박스 세 칸이 있는 클립보드를 든 마스코트와 3줄 규칙",
        caption: "요약 — 내 리밸런싱 3줄 규칙",
      },
    ],
    basis: "자체 정리·자체 계산(목표금액 = 총자산 × 목표비중) · 기준일 2026. 11. 22.",
    related: [
      { label: "적립식이 유리한 이유는 수익률이 아니라 '실수 횟수'", href: "/posts/invest-dca-rule" },
      { label: "복리 계산기", href: "/apps/compound-return/run" },
    ],
  },
  /**
   * v8.4.0 — STEP 4 은퇴 첫 5년 인출 순서, 학교 은퇴 1강과 함께 온 1세트(6장).
   * 3억·연 1,500만 인출을 5년 수익률 순서만 바꿔 돌린 자체 시뮬레이션(평균 0%)이다.
   * 4장에서 사적연금 1,500만원(소득세법)과 소득 합계 2,000만원(건강보험법)을 분리해 적는다.
   */
  {
    id: "retire-drawdown-hand",
    title: "은퇴 첫 5년의 순서 위험 — 같은 수익률, 인출 순서가 만든 차이",
    tagline: "손글씨 카드 6장 · 3억 · 연 1,500만 인출, 1억 6,760만 vs 2억 1,307만",
    summary: "은퇴 초기에 하락장과 인출이 겹치면 같은 수익률이라도 남는 돈이 달라집니다. 3억 원에서 매년 1,500만 원을 인출하며 −30·−20·+5·+20·+25%를 '하락 먼저'와 '상승 먼저'로 배열하면 1억 6,760만 원 vs 2억 1,307만 원, 차이는 4,547만 원입니다. 하락장에 팔지 않게 만드는 현금 버퍼 원칙과, 사적연금 1,500만 원(소득세법 — 분리과세·종합과세 선택 기준)과 소득 합계 2,000만 원(건강보험 피부양자 기준)이 서로 다른 제도임을 함께 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "은퇴 인출", "순서 위험", "현금 버퍼", "1,500만", "건보료 피부양자", "은퇴"],
    slides: [
      {
        src: "/gallery/3d-retire-drawdown-01.png",
        width: W,
        height: H,
        alt: "표지 — 회색 두 개와 노란 세 개로 놓인 징검다리를 동전 바구니를 들고 건너는 마스코트, '같은 수익률도 순서가 갈립니다'",
        caption: "표지 — 은퇴 첫 5년, 같은 수익률도 순서가 결과를 가른다",
      },
      {
        src: "/gallery/3d-retire-drawdown-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 같은 동전 더미 둘을 비교하며 갸우뚱하는 마스코트, 오른쪽은 내려갔다 오르는 선을 그린 종이를 든 마스코트",
        caption: "오해 vs 팩트 — 평균이 같으면 같다? / 인출이 있으면 순서가 결과를 바꾼다",
      },
      {
        src: "/gallery/3d-retire-drawdown-03.png",
        width: W,
        height: H,
        alt: "계산 — 막대 두 개와 달력, 지갑을 든 마스코트, '하락 먼저 1억 6,760만 / 상승 먼저 2억 1,307만' 비교표",
        caption: "① 3억·연 1,500만 인출 — 5개 수익률을 순서만 바꾸면 4,547만 원 차이",
      },
      {
        src: "/gallery/3d-retire-drawdown-04.png",
        width: W,
        height: H,
        alt: "현금 버퍼 — 골짜기 위 다리에 늘어놓은 자루와 우산, 자루를 들고 다리를 건너는 마스코트",
        caption: "② 현금 버퍼 — 생활비 2년치는 현금으로, 하락장에도 투자를 팔지 않기",
      },
      {
        src: "/gallery/3d-retire-drawdown-05.png",
        width: W,
        height: H,
        alt: "두 개의 선 — 높이가 다른 두 팻말 사이에서 연필을 든 마스코트, '사적연금 1,500만 / 소득 합계 2,000만' 구분표",
        caption: "③ 사적연금 1,500만(세금)과 소득 합계 2,000만(건보료)은 다른 제도",
      },
      {
        src: "/gallery/3d-retire-drawdown-06.png",
        width: W,
        height: H,
        alt: "요약 — 클립보드와 안락의자에 앉은 마스코트, 은퇴 첫 5년 3줄 점검",
        caption: "요약 — 은퇴 첫 5년 3줄 점검",
      },
    ],
    basis: "자체 시뮬레이션(3억 원·연 1,500만 원 인출) / 소득세법 제20조의3·제64조의4 / 국민건강보험법 시행규칙 별표1의2 · 기준일 2026. 11. 22.",
    related: [
      { label: "인출 순서 4단계와 연 1,500만 원", href: "/posts/pension-master-05-draw-1500" },
      { label: "노후 파산은 고정비에서 시작된다", href: "/posts/retire-fixed-cost" },
      { label: "연금 인출 계산기", href: "/apps/pension-draw/run" },
    ],
  },
  /**
   * v8.3.0 — 가계 1강(고정비·대출 원리금, 가계 현금희름 3줄)과 함께 온 1세트(6장).
   * 스타일은 v8.2.0과 같은 **손글씨 + 형광팼 + 크림지 + 파스텔 2D**다(렌더 `tmp/clay1222/render_household.py`).
   * 6장 연속 세트라 분류는 `carousel`이고, 카드 속 금액은 모두 가상 예시다.
   */
  {
    id: "household-budget-hand",
    title: "월 500만, 남는 돈은 어디서 줄까",
    tagline: "손글씨 카드 6장 · 실수령 500 · 고정비 160 · 원리금 61",
    summary:
      "가계 현금희름은 세 줄이면 보입니다. ① 실수령 500만원 ② 고정비 160만원과 대출 원리금 61만원 ③ 남는 돈 139만원. 대출 1억 원을 4%에서 6%로 올리면 원리금이 61만원에서 72만원으로 늘어나는 것까지 한 세트에 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "학교 트랙", "가계", "현금희름", "고정비", "대출 원리금"],
    slides: [
      {
        src: "/gallery/3d-household-budget-01.png",
        width: W,
        height: H,
        alt: "표지 — 크림 종이 위 세 줄짜리 장부와 동전, 장부를 가리키는 마스코트",
        caption: "표지 — 들어오는 돈과 나가는 돈, 세 줄로",
      },
      {
        src: "/gallery/3d-household-budget-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 큰 동전 하나를 든 마스코트, 오른쪽은 여러 작은 통으로 동전이 빠져나가는 모습을 보는 마스코트",
        caption: "오해 vs 팩트 — 소득이 크면 남는다 / 고정비·원리금이 먼저다",
      },
      {
        src: "/gallery/3d-household-budget-03.png",
        width: W,
        height: H,
        alt: "배관 하나로 유리병에 동전이 차곡차곡 흘러드는 장면과 마스코트",
        caption: "1줄 — 실수령 500만, 세전이 아닙니다",
      },
      {
        src: "/gallery/3d-household-budget-04.png",
        width: W,
        height: H,
        alt: "달력이 붙은 작은 통 네 개가 나란히 놓인 선반과 마스코트",
        caption: "2줄 — 고정비 160만, 날짜가 정해진 지출",
      },
      {
        src: "/gallery/3d-household-budget-05.png",
        width: W,
        height: H,
        alt: "지붕 위에 큰 동전을 올린 집 모형과 위로 향한 이자 화살표",
        caption: "3줄 — 대출 원리금 61만, 금리 오르면 이자가 는다",
      },
      {
        src: "/gallery/3d-household-budget-06.png",
        width: W,
        height: H,
        alt: "클립보드와 계산기를 든 마스코트, 세 줄 체크리스트",
        caption: "점검 — 세 줄에 날짜 붙이기",
      },
    ],
    basis:
      "자체 계산 — 원리금균등분할상환 공식(대출 1억원·20년·4%·6%) · 기준일 2026. 11. 22. · 금액은 가상 예시, 실제 금리는 금융감독원 파인에서 확인",
    related: [
      { label: "가계 1강 — 가계 현금희름 3줄", href: "/academy/school-household-cashflow/" },
      { label: "대출 원리금 계산기", href: "/apps/loan-repay/run" },
    ],
  },
  /**
   * v8.2.0 — 「버핏킴즈 금융생활학교」 초등·청소년·첫 월급 3강과 함께 온 3세트(18장).
   * A. 용돈 세 칸 / B. 소액결제와 사기 방어 / C. 첫 월급명세서 3줄.
   * 스타일은 2차 배치와 같은 **손글씨 + 형광펜 + 크림지 + 파스텔 2D**다(렌더 `tmp/clay1222/render_school.py`).
   * 6장 연속 세트라 분류는 `carousel`이고, 태그 `손글씨 다이어그램`·`학교 트랙`으로 구분한다.
   * 카드 속 금액은 모두 가상 예시이며, 기준일은 2026. 11. 22.이다.
   */
  {
    id: "allowance-three-rooms-hand",
    title: "용돈 7,000원, 세 칸으로 나누기",
    tagline: "손글씨 카드 6장 · 쓸 돈 3,000 · 모을 돈 3,000 · 남길 돈 1,000",
    summary:
      "용돈을 받은 날 먼저 세 칸으로 나누면 남는 돈을 세지 않아도 됩니다. 7,000원을 ① 쓸 돈 3,000원, ② 모을 돈 3,000원, ③ 남길 돈 1,000원으로 나누고, 목표 30,000원까지 8주를 계산합니다. 물가가 오르면 같은 돈으로 살 수 있는 양이 줄어든다는 한 줄도 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "학교 트랙", "초등", "용돈", "저축", "물가"],
    slides: [
      {
        src: "/gallery/3d-allowance-01.png",
        width: W,
        height: H,
        alt: "표지 — 나무 책상 위 봉투 세 개와 동전, 첫 봉투에 동전을 넣는 마스코트와 '용돈 7,000원, 세 칸으로 나눠 볼까?'",
        caption: "표지 — 용돈 7,000원을 세 칸으로 나눠 볼까?",
      },
      {
        src: "/gallery/3d-allowance-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 빈 지갑을 든 마스코트와 세 봉투에 동전을 나눠 담는 마스코트",
        caption: "오해 vs 팩트 — 남으면 모은다 / 먼저 나눈다",
      },
      {
        src: "/gallery/3d-allowance-03.png",
        width: W,
        height: H,
        alt: "칸 ① — 동전 하나와 간식·연필이 든 장바구니를 든 마스코트, '이번 주에 쓸 돈 3,000원'",
        caption: "칸 ① — 이번 주에 쓸 돈 3,000원",
      },
      {
        src: "/gallery/3d-allowance-04.png",
        width: W,
        height: H,
        alt: "칸 ② — 유리병에 동전을 넣는 마스코트와 병에 기댄 사다리, 병 위의 자전거 그림",
        caption: "칸 ② — 목표 30,000원, 매주 3,000원",
      },
      {
        src: "/gallery/3d-allowance-05.png",
        width: W,
        height: H,
        alt: "칸 ③ — 뚜껑 있는 작은 통에 동전을 넣는 마스코트와 옆에 세운 우산",
        caption: "칸 ③ — 급할 때 쓰는 돈 1,000원",
      },
      {
        src: "/gallery/3d-allowance-06.png",
        width: W,
        height: H,
        alt: "오늘 할 일 — 봉투 세 개에 연필로 이름을 쓰는 마스코트와 동전 더미, 세 칸 체크리스트",
        caption: "오늘 할 일 — 봉투 3개에 이름 붙이기",
      },
    ],
    basis:
      "자체 기준(세 칸 비율·목표 주수는 예시) · 기준일 2026. 11. 22. · 모든 금액 가상 · 물가 통계는 통계청 소비자물가지수에서 확인",
    related: [
      { label: "초등 1강 — 용돈 7,000원, 세 칸", href: "/academy/school-elementary-allowance/" },
      { label: "금융생활학교 52주 로드맵", href: "/academy/#school-weeks" },
    ],
  },
  {
    id: "teen-pay-traps-hand",
    title: "월 5,000원이 1년이면 60,000원",
    tagline: "손글씨 카드 6장 · 구독 12개월 · BNPL 수수료 · 112·1332",
    summary:
      "작은 결제도 12개월로 바꾸면 크기가 보입니다. 월 5,000원 구독은 1년 60,000원, 월 30,000원 소액결제는 1년 360,000원입니다. 200,000원을 3개월로 나눠 갚을 때 수수료 5%면 10,000원이 붙어 총 210,000원을 갚습니다. 송금 요청 앞에서 멈추고 112·1332로 확인하는 순서도 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "학교 트랙", "청소년", "소액결제", "BNPL", "금융사기"],
    slides: [
      {
        src: "/gallery/3d-teen-pay-01.png",
        width: W,
        height: H,
        alt: "표지 — 화면에서 동전이 흘러나와 유리병에 담기는 휴대폰과 놀란 마스코트",
        caption: "표지 — 월 5,000원이 1년이면 60,000원",
      },
      {
        src: "/gallery/3d-teen-pay-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 동전 하나를 든 마스코트와 달력 12칸에 동전이 쌓인 모습을 보는 마스코트",
        caption: "오해 vs 팩트 — 한 달 5천 원 / 1년으로 보기",
      },
      {
        src: "/gallery/3d-teen-pay-03.png",
        width: W,
        height: H,
        alt: "반복 결제 — 달력 12칸마다 동전 하나씩, 그 옆을 가리키는 마스코트",
        caption: "반복 결제 — 한 달 30,000원이면 1년 360,000원",
      },
      {
        src: "/gallery/3d-teen-pay-04.png",
        width: W,
        height: H,
        alt: "BNPL — 가게에서 작은 상자를 받는 마스코트와 위에 떠 있는 시계·수수료 동전",
        caption: "BNPL — 200,000원 3개월, 수수료 10,000원",
      },
      {
        src: "/gallery/3d-teen-pay-05.png",
        width: W,
        height: H,
        alt: "사기 신호 — 휴대폰에서 물음표 봉투가 나오고 한 손을 든 채 뒤로 물러서는 마스코트, 경찰 호루라기와 방패",
        caption: "사기 신호 — 송금 요청은 멈추고 확인(112·1332)",
      },
      {
        src: "/gallery/3d-teen-pay-06.png",
        width: W,
        height: H,
        alt: "오늘 할 일 — 세 칸 체크리스트를 든 마스코트와 휴대폰·호루라기",
        caption: "오늘 할 일 — 결제 내역에서 3개 찾기",
      },
    ],
    basis:
      "자체 계산(구독·소액결제·BNPL 금액은 가상) · 기준일 2026. 11. 22. · 신고 경로는 경찰청 112·금융감독원 불법금융신고센터 1332 안내",
    related: [
      { label: "청소년 1강 — 소액결제와 먼저 받는 돈", href: "/academy/school-teen-payments/" },
      { label: "금융생활학교 52주 로드맵", href: "/academy/#school-weeks" },
    ],
  },
  {
    id: "firstpay-stub-hand",
    title: "세전 300만, 통장엔 267만",
    tagline: "손글씨 카드 6장 · 지급 · 공제 33만(가상) · 실수령",
    summary:
      "월급명세서는 세 줄입니다. ① 지급 합계(세전) ② 공제 합계 ③ 실수령입니다. 세전 300만 원에서 4대보험과 세금 33만 원(가상)을 빼면 실수령 267만 원이고, 여기서 고정비·변동비를 빼 남는 돈을 세 칸으로 나눕니다. 4대보험 이름 네 개와 근로자 부담 몫을 카드에 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "학교 트랙", "첫 월급", "명세서", "4대보험", "실수령"],
    slides: [
      {
        src: "/gallery/3d-firstpay-01.png",
        width: W,
        height: H,
        alt: "표지 — 세 줄이 그어진 긴 명세서를 두 손으로 든 마스코트와 지갑",
        caption: "표지 — 세전 300만, 통장엔 267만",
      },
      {
        src: "/gallery/3d-firstpay-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 큰 동전 자루를 안고 빈 지갑을 본 마스코트와 작은 자루를 들고 통에 동전을 나눠 주는 마스코트",
        caption: "오해 vs 팩트 — 세전 300만 / 실수령 267만",
      },
      {
        src: "/gallery/3d-firstpay-03.png",
        width: W,
        height: H,
        alt: "1줄 지급 — 책상 위 빈 카드 세 장과 동전, 첫 장을 가리키는 마스코트",
        caption: "1줄 지급 — 기본급·수당을 더한 세전",
      },
      {
        src: "/gallery/3d-firstpay-04.png",
        width: W,
        height: H,
        alt: "2줄 공제 — 작은 통 네 개에 동전이 쏟아지는 모습을 살피는 마스코트",
        caption: "2줄 공제 — 4대보험과 세금, 가상 33만 원",
      },
      {
        src: "/gallery/3d-firstpay-05.png",
        width: W,
        height: H,
        alt: "3줄 실수령 — 동전을 세 유리병에 나누는 마스코트, 우산·달력·새싹이 각 병 옆에",
        caption: "3줄 실수령 — 267만 원을 세 칸으로",
      },
      {
        src: "/gallery/3d-firstpay-06.png",
        width: W,
        height: H,
        alt: "오늘 할 일 — 긴 명세서의 세 줄을 빨간 연필로 동그라미하는 마스코트",
        caption: "오늘 할 일 — 세 숫자에 동그라미",
      },
    ],
    basis:
      "4대보험료율 2026년 기준(국민연금 9.5%·근로자 4.75%, 건강보험 7.19%, 장기요양 0.9448%, 고용보험 1.8%는 사업주 포함·근로자 몫은 절반) · 공제 33만 원과 세금은 가상 · 기준일 2026. 11. 22. · 실제 금액은 명세서와 국세청 안내에서 확인",
    related: [
      { label: "첫 월급 1강 — 명세서 3줄", href: "/academy/school-firstpay-stub/" },
      { label: "금융생활학교 52주 로드맵", href: "/academy/#school-weeks" },
    ],
  },
  /**
   * v8.1.0 — 「한스푼 아카데미」 STEP 1·2 확장과 함께 온 2차 5세트(30장).
   * C. 계좌 배치표 / E. 낙폭과 회복 / G. 퇴직연금 3층 / H. 보장 공백 5칸 / I. 12개월 금융 달력.
   * 스타일은 3D 클레이가 아니라 **손글씨 + 형광펜 + 크림지**다. 파일 이름만 기존 경로 규칙(`3d-`)을 유지했고,
   * 태그에 '손글씨 다이어그램'을 달아 3D 세트와 구분한다. 6장 연속 세트라 분류는 `carousel`이다.
   * 원본: `tmp/gallery_batch2_20261122.json` · 렌더 `tmp/clay1222/render_hand.py` · 기준일 2026. 11. 22.
   */
  {
    id: "account-order-hand",
    title: "연봉 5,500만, 계좌 넣는 순서",
    tagline: "손글씨 카드 6장 · 연금저축 600 → IRP 300 → ISA",
    summary:
      "남는 돈이 생겼을 때 아무 계좌에나 넣으면 세액공제도 유동성도 놓칩니다. 비상금 다음으로 연금저축 600만(16.5%·13.2%) → IRP 300만(합산 900만) → 3년 묶을 돈은 ISA(비과세 400·200만) 순서로 채우는 기준을 6장에 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "계좌 순서", "연금저축", "IRP", "ISA", "세액공제"],
    slides: [
      {
        src: "/gallery/3d-account-order-01.png",
        width: W,
        height: H,
        alt: "표지 — 세 단 계단 위 동전 단지를 오르는 마스코트와 '남는 돈, 어디부터 넣어야 할까'",
        caption: "표지 — 연봉 5,500만 원 기준 계좌 3순위 배치표",
      },
      {
        src: "/gallery/3d-account-order-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 빈 단지 옆에 앉은 시무룩한 마스코트, 오른쪽은 세 단지에 동전을 나눠 담는 마스코트",
        caption: "오해 vs 팩트 — 아무 계좌나 넣기 / 세액공제율·유동성 순서대로 채우기",
      },
      {
        src: "/gallery/3d-account-order-03.png",
        width: W,
        height: H,
        alt: "1순위 — 우산과 동전 단지, 저금통, 동전을 넣는 마스코트",
        caption: "1순위 — 비상금 다음은 연금저축 600만 (16.5%·13.2%)",
      },
      {
        src: "/gallery/3d-account-order-04.png",
        width: W,
        height: H,
        alt: "2순위 — 나란한 두 단지를 잇는 작은 다리와 클립보드를 든 마스코트",
        caption: "2순위 — IRP 300만 추가, 합산 900만 원 한도",
      },
      {
        src: "/gallery/3d-account-order-05.png",
        width: W,
        height: H,
        alt: "3순위 — 열린 보물상자와 기대어 놓은 달력, 동전을 든 마스코트",
        caption: "3순위 — 3년 안 쓸 돈은 ISA (서민형 400만·일반형 200만)",
      },
      {
        src: "/gallery/3d-account-order-06.png",
        width: W,
        height: H,
        alt: "요약 — 클립보드 체크리스트를 든 마스코트와 3줄 배치표",
        caption: "요약 — 내 상황이면 이 순서",
      },
    ],
    basis:
      "소득세법 제59조의3(연금계좌 세액공제), 조세특례제한법 제91조의18(ISA) · 기준일 2026. 11. 22. · 총급여 5,500만 원 이하 16.5%·초과 13.2%(지방소득세 포함) 가정, 한도·비율은 가입 조건에 따라 다름",
    related: [
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
      { label: "3편 — 연말 연금저축 600·IRP 900·ISA 전환 300", href: "/posts/pension-master-03-yearend-900" },
    ],
  },
  {
    id: "drawdown-recovery-hand",
    title: "반 토막이면 두 배 — 낙폭과 회복",
    tagline: "손글씨 카드 6장 · −10%→+11.1%, −50%→+100%",
    summary:
      "−50%에서 본전이 되려면 +100%가 필요합니다. 낙폭과 회복은 크기가 다른 비대칭이고, 오를수록 기준점이 낮아져 회복은 더뎌집니다. 구간별 회복률과 변동성 끌림, 낙폭을 줄이는 두 장치를 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "낙폭", "회복률", "변동성", "리스크 관리"],
    slides: [
      {
        src: "/gallery/3d-drawdown-recovery-01.png",
        width: W,
        height: H,
        alt: "표지 — V자 골짜기 아래에 선 마스코트와 반대편 언덕 위의 작은 깃발",
        caption: "표지 — 낙폭과 회복의 비대칭",
      },
      {
        src: "/gallery/3d-drawdown-recovery-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 금 간 동전을 든 걱정스러운 마스코트, 오른쪽은 깃발이 있는 긴 사다리를 오르는 마스코트",
        caption: "오해 vs 팩트 — +50%면 본전? / 반 토막 뒤엔 +100%",
      },
      {
        src: "/gallery/3d-drawdown-recovery-03.png",
        width: W,
        height: H,
        alt: "구간별 회복률 — 동전이 담긴 네 개의 단지와 자, 네 줄 비교표",
        caption: "구간별 회복률 — −10%→+11.1%, −20%→+25%, −30%→+42.9%, −50%→+100%",
      },
      {
        src: "/gallery/3d-drawdown-recovery-04.png",
        width: W,
        height: H,
        alt: "함정 — 울퉁불퉁한 길에서 동전을 떨어뜨리는 수레와 옆의 평평한 길",
        caption: "함정 — 변동성 끌림, 오를수록 덜 오릅니다",
      },
      {
        src: "/gallery/3d-drawdown-recovery-05.png",
        width: W,
        height: H,
        alt: "두 장치 — 우산 두 개와 달걀 바구니, 동전 주머니를 든 마스코트",
        caption: "낙폭을 줄이는 두 장치 — 분산과 현금 비중",
      },
      {
        src: "/gallery/3d-drawdown-recovery-06.png",
        width: W,
        height: H,
        alt: "원칙 — 방패와 클립보드를 든 마스코트와 3줄 체크리스트",
        caption: "원칙 — 크게 잃지 않는 포트폴리오 규칙",
      },
    ],
    basis:
      "자체 정리 — 회복률 = 1 ÷ (1 − 낙폭) − 1 · 기준일 2026. 11. 22. · 회복률은 수익률 전망이 아니라 손실을 만회하는 데 필요한 산술 조건",
    related: [
      { label: "투자 복리·세후 수익률 계산기", href: "/apps/compound-return/run" },
      { label: "적립식 투자, 흔들리지 않는 규칙", href: "/posts/invest-dca-rule" },
    ],
  },
  {
    id: "retirement-3tier-hand",
    title: "퇴직연금 DB·DC·IRP, 어디에 담을까",
    tagline: "손글씨 카드 6장 · 임금상승률 vs 운용수익률",
    summary:
      "퇴직금은 다 똑같지 않습니다. 임금상승률이 높고 오래 다니면 DB, 직접 굴리고 이직이 잦으면 DC, 받은 퇴직금과 추가 세액공제는 IRP로 갑니다. 수령할 때 연금으로 받으면 퇴직소득세 30~40%를 감면받는 것까지 6장으로 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "퇴직연금", "DB", "DC", "IRP", "퇴직소득세"],
    slides: [
      {
        src: "/gallery/3d-retirement-3tier-01.png",
        width: W,
        height: H,
        alt: "표지 — 세 층으로 쌓은 블록과 동전, 맨 위층을 가리키는 마스코트",
        caption: "표지 — 퇴직연금 DB·DC·IRP 한눈 비교",
      },
      {
        src: "/gallery/3d-retirement-3tier-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 같은 동전 두 개를 든 갸우뚱한 마스코트, 오른쪽은 저울로 동전 더미를 비교하는 마스코트",
        caption: "오해 vs 팩트 — 퇴직금은 다 똑같다 / 임금상승률 vs 운용수익률",
      },
      {
        src: "/gallery/3d-retirement-3tier-03.png",
        width: W,
        height: H,
        alt: "DB형 — 창문과 금고가 있는 회사 건물, 사다리를 오르는 마스코트",
        caption: "DB형 — 임금상승률이 높고 오래 다닐 때",
      },
      {
        src: "/gallery/3d-retirement-3tier-04.png",
        width: W,
        height: H,
        alt: "DC형 — 동전을 돛으로 단 종이배를 조타하는 마스코트",
        caption: "DC형 — 직접 굴릴 때, 이직이 잦을 때",
      },
      {
        src: "/gallery/3d-retirement-3tier-05.png",
        width: W,
        height: H,
        alt: "IRP — 문과 동전 투입구가 있는 단지에 서류 가방을 넣는 마스코트",
        caption: "IRP — 퇴직금 받을 통장 + 세액공제 300만",
      },
      {
        src: "/gallery/3d-retirement-3tier-06.png",
        width: W,
        height: H,
        alt: "수령 체크 — 모래시계에서 동전이 손으로 떨어지고 달력과 단지가 놓인 장면",
        caption: "수령 — 일시금 vs 연금, 퇴직소득세 30~40% 감면",
      },
    ],
    basis:
      "근로자퇴직급여 보장법(DB·DC·IRP), 소득세법 제59조의3(IRP 세액공제)·제55조의2(퇴직소득세), 국세청 연금수령 감면 안내 · 기준일 2026. 11. 22. · 감면율·요건은 국세청 원문에서 확인",
    related: [{ label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" }],
  },
  {
    id: "coverage-gaps-hand",
    title: "보장 공백 5칸 — 약관에서 갈리는 것",
    tagline: "손글씨 카드 6장 · 면책·감액·지급 기준",
    summary:
      "같은 1억이라도 실제 수령액은 다릅니다. 실손 세대별 자기부담, 면책·감액기간, 유사암·경계성종양과 뇌혈관·허혈성 범위, 수술비 종수, 사적연금 1,500만 원과 건보료 피부양자까지 — 가입금액보다 먼저 볼 약관 5칸을 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "보장 공백", "면책기간", "감액기간", "유사암", "수술비", "피부양자"],
    slides: [
      {
        src: "/gallery/3d-coverage-gaps-01.png",
        width: W,
        height: H,
        alt: "표지 — 다섯 칸 빈 종이 위의 돋보기와 들여다보는 마스코트",
        caption: "표지 — 가입금액 전에 볼 약관 공백 5칸",
      },
      {
        src: "/gallery/3d-coverage-gaps-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 금 간 방패와 큰 동전을 든 마스코트, 오른쪽은 돋보기로 계약서를 보는 마스코트",
        caption: "오해 vs 팩트 — 진단비 크기만 크면 든든 / 면책·감액·지급 기준",
      },
      {
        src: "/gallery/3d-coverage-gaps-03.png",
        width: W,
        height: H,
        alt: "공백 1·2 — 서로 다른 색 종이 세 장과 청진기, 두 장을 비교하는 마스코트",
        caption: "공백 ① ② — 실손 세대별 자기부담, 면책 90일·감액 1~2년",
      },
      {
        src: "/gallery/3d-coverage-gaps-04.png",
        width: W,
        height: H,
        alt: "공백 3 — 크기가 다른 세 원과 가장 작은 원을 돋보기로 보는 마스코트",
        caption: "공백 ③ — 유사암·경계성종양은 일반암의 10~20%",
      },
      {
        src: "/gallery/3d-coverage-gaps-05.png",
        width: W,
        height: H,
        alt: "공백 4·5 — 병원과 저울, 서류 더미와 동전 주머니를 가리키는 마스코트",
        caption: "공백 ④ ⑤ — 수술비 종수와 사적연금 2,000만 원(피부양자)",
      },
      {
        src: "/gallery/3d-coverage-gaps-06.png",
        width: W,
        height: H,
        alt: "점검 — 안경과 펜이 꽂힌 클립보드를 든 마스코트와 3줄 체크리스트",
        caption: "점검 — 내 증권에서 확인할 3줄",
      },
    ],
    basis:
      "금융위원회 실손의료보험 제도 안내, 보험업감독규정 표준약관, 국민건강보험법 시행규칙 별표 1의2(피부양자 소득 요건) · 기준일 2026. 11. 22. · 세대·상품·약관에 따라 지급 기준이 다름",
    related: [{ label: "내 실손 세대 비교", href: "/apps/silson-compare/run" }],
  },
  {
    id: "finance-calendar-hand",
    title: "12개월 금융 달력 — 놓치면 손해",
    tagline: "손글씨 카드 6장 · 1월·2월·5월·11월·12월",
    summary:
      "연말정산은 12월 31일 하루에 끝나지 않습니다. 1월 15일 간소화 자료, 2월 환급과 4월 건보료 정산, 5월 종합소득세, 여름의 ISA 만기·리밸런싱, 11~12월 연금저축·IRP 900만 마감까지 — 1년에 다섯 번 챙길 달을 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["카드뉴스", "손글씨 다이어그램", "연말정산", "종합소득세", "ISA 만기", "연금저축 900만", "금융 달력"],
    slides: [
      {
        src: "/gallery/3d-finance-calendar-01.png",
        width: W,
        height: H,
        alt: "표지 — 벽에 걸린 달력 격자와 동그라미 표시, 연필과 동전을 든 마스코트",
        caption: "표지 — 12개월 금융 달력",
      },
      {
        src: "/gallery/3d-finance-calendar-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 마지막 칸에 엑스 표시된 달력 앞에서 조는 마스코트, 오른쪽은 네 칸을 동그라미하는 마스코트",
        caption: "오해 vs 팩트 — 12월 31일에만 챙긴다 / 다섯 번의 타이밍",
      },
      {
        src: "/gallery/3d-finance-calendar-03.png",
        width: W,
        height: H,
        alt: "1~3월 — 체크 표시한 달력과 영수증, 계산기, 동전을 든 마스코트",
        caption: "1~3월 — 간소화 자료 1월 15일, 2월 환급·4월 건보료 정산",
      },
      {
        src: "/gallery/3d-finance-calendar-04.png",
        width: W,
        height: H,
        alt: "5~6월 — 서명란이 있는 서류와 달력, 봉투가 놓인 장면",
        caption: "5~6월 — 종합소득세 5월 31일, 건보료·피부양자 확인",
      },
      {
        src: "/gallery/3d-finance-calendar-05.png",
        width: W,
        height: H,
        alt: "7~10월 — 톱니와 동전을 올린 저울을 조절하는 마스코트와 달력",
        caption: "7~10월 — ISA 만기와 중간 리밸런싱",
      },
      {
        src: "/gallery/3d-finance-calendar-06.png",
        width: W,
        height: H,
        alt: "11~12월 — 동전 더미와 단지, 마지막 칸에 동그라미 친 달력, 엄지척 마스코트",
        caption: "11~12월 — 연금저축·IRP 900만 원 마지막 점검",
      },
    ],
    basis:
      "국세청 연말정산·종합소득세 안내, 국민건강보험공단 보험료 정산 안내, 조세특례제한법 제91조의18(ISA), 소득세법 제59조의3(연금계좌) · 기준일 2026. 11. 22.",
    related: [
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
      { label: "3편 — 연말 연금저축 600·IRP 900·ISA 전환 300", href: "/posts/pension-master-03-yearend-900" },
    ],
  },
  /**
   * v8.0.0 — 「한스푼 아카데미」 STEP별 자료앨범 1차 4세트(24장) 추가.
   * A. 세 칸의 지도(월급 3통) / B. 세 순간(15.4%·16.5%·연금소득세) /
   * D. ETF 6개 숫자 / F. 사적연금 1,500만 원 경계선 — 아카데미 STEP 1·2·3·4와 짝을 이룬다.
   * 파일: `public/gallery/3d-{three-buckets,tax-moments,etf-6numbers,pension-1500}-NN.png`
   */
  {
    id: "three-buckets-3d",
    title: "월급이 들어오면, 3개의 통",
    tagline: "3D 스토리 카드 6장 · 비상금 · 단기목표 · 장기투자",
    summary:
      "월급이 들어온 날 바로 세 칸으로 나누면 남는 돈이 달라집니다. 비상금(생활비 3~6개월) → 단기목표(1~3년) → 장기투자(5년 이상·절세계좌) 순서와, 오늘 자동이체 3줄로 끝내는 방법까지 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["월급관리", "비상금", "단기목표", "장기투자", "자동이체", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-three-buckets-01.png",
        width: W,
        height: H,
        alt: "표지 — 세 칸으로 나뉜 나무 쟁반에 금화·작은 집·새싹이 담겨 있고, 양팔을 벌린 너구리 캐릭터와 '월급이 들어오면 나뉘는 3개의 통'",
        caption: "표지 — 월급이 들어오면 나뉘는 3개의 통",
      },
      {
        src: "/gallery/3d-three-buckets-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 거의 빈 단지 옆에 시무룩하게 선 캐릭터, 오른쪽은 동전을 세 갈래로 나눠 세 단지에 담는 캐릭터",
        caption: "오해 vs 팩트 — 남는 돈 모으기 / 먼저 나누고 쓰기",
      },
      {
        src: "/gallery/3d-three-buckets-03.png",
        width: W,
        height: H,
        alt: "비상금 — 금화와 지폐가 든 유리병에 동전을 넣는 캐릭터, 옆에 작은 우산과 방패, 알람시계",
        caption: "통 ① — 생활비 3~6개월, 바로 꺼낼 수 있게",
      },
      {
        src: "/gallery/3d-three-buckets-04.png",
        width: W,
        height: H,
        alt: "단기목표 — 자물쇠와 깃발이 달린 저금함에 봉투를 넣는 캐릭터, 옆에 작은 여행 가방과 세 개의 달력 블록",
        caption: "통 ② — 1~3년 안에 쓸 돈은 예·적금으로",
      },
      {
        src: "/gallery/3d-three-buckets-05.png",
        width: W,
        height: H,
        alt: "장기투자 — 금화가 열매로 달린 작은 나무 화분에 물을 주는 캐릭터와 옆의 모래시계",
        caption: "통 ③ — 5년 이상 묶을 돈은 절세계좌에",
      },
      {
        src: "/gallery/3d-three-buckets-06.png",
        width: W,
        height: H,
        alt: "체크리스트 — 세 개의 빈 체크 동그라미가 있는 클립보드를 든 캐릭터, 책상 위 기어 세 개와 알람시계",
        caption: "오늘 할 일 — 자동이체 3줄 세팅",
      },
    ],
    basis:
      "자체 정리(생활비 3~6개월·1~3년·5년 이상 분리 원칙), 소득세법 제59조의3, 조세특례제한법 제91조의18 · 기준일 2026. 11. 22. · 금액과 비율은 소득·지출 구조에 따라 다름",
    related: [
      { label: "4대 계좌 세후 비교 시뮬레이터", href: "/apps/account-tax-compare/run" },
      { label: "3편 — 연말 연금저축 600·IRP 900·ISA 전환 300", href: "/posts/pension-master-03-yearend-900" },
    ],
  },
  {
    id: "tax-moments-3d",
    title: "모르면 16.5% 떼이는 세금 세 순간",
    tagline: "3D 스토리 카드 6장 · 이자·중도해지·연금수령",
    summary:
      "세금은 세 번의 순간에 떼어집니다. 일반계좌 이자·배당 15.4%(원천징수), 연금계좌 중도해지 16.5%(기타소득세), 연금수령 5.5~3.3%. 세액공제를 받았으니 이득이라는 착각과, 꺼낼 돈·묶을 돈을 가르는 기준까지 6장으로 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["세금", "15.4%", "16.5%", "연금소득세", "중도해지", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-tax-moments-01.png",
        width: W,
        height: H,
        alt: "표지 — 나무 선반 위 세 개의 작은 알람시계, 걱정스러운 표정으로 손가락을 든 캐릭터와 '모르면 16.5% 떼이는 세금 세 순간'",
        caption: "표지 — 모르면 16.5% 떼이는 세 순간",
      },
      {
        src: "/gallery/3d-tax-moments-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 환급 봉투를 안고 웃는 캐릭터, 오른쪽은 밑이 깨진 금고에서 동전이 새는 것을 보고 놀란 캐릭터",
        caption: "오해 vs 팩트 — 공제받았으니 이득 / 해지하면 16.5%",
      },
      {
        src: "/gallery/3d-tax-moments-03.png",
        width: W,
        height: H,
        alt: "순간 1 — 은행 모형으로 이어지는 동전 레일에서 집게가 동전을 집어 상자에 담고, 동전 하나를 든 채 시무룩한 캐릭터",
        caption: "순간 1 — 이자·배당 15.4%, 이미 떼고 받습니다",
      },
      {
        src: "/gallery/3d-tax-moments-04.png",
        width: W,
        height: H,
        alt: "순간 2 — 거대한 가위가 금고의 자물쇠를 자르고, 빨간 경보 종이 울리며 동전이 쏟아지는 장면",
        caption: "순간 2 — 중도해지 16.5% 기타소득세",
      },
      {
        src: "/gallery/3d-tax-moments-05.png",
        width: W,
        height: H,
        alt: "순간 3 — 수도꼭지에서 동전이 한 방울씩 떨어져 모래시계를 거쳐 쟁반으로 흐르고, 손잡이를 돌리는 캐릭터",
        caption: "순간 3 — 연금으로 받으면 5.5%~3.3%",
      },
      {
        src: "/gallery/3d-tax-moments-06.png",
        width: W,
        height: H,
        alt: "요약 — 왼쪽은 동전 몇 개가 담긴 열린 접시, 오른쪽은 자물쇠가 달린 작은 궤짝, 그 사이에 선 캐릭터",
        caption: "요약 — 꺼낼 돈과 묶을 돈, 먼저 나눠 두기",
      },
    ],
    basis:
      "소득세법 제129조(이자·배당 15.4%)·제21조(기타소득 16.5%)·제20조의3(연금소득세 5.5~3.3%), 국세청 연금소득 안내 · 기준일 2026. 11. 22.",
    related: [
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
      { label: "5편 — 인출 순서 4단계와 연 1,500만원", href: "/posts/pension-master-05-draw-1500" },
    ],
  },
  {
    id: "etf-6numbers-3d",
    title: "수익률 전에 볼 ETF 6개 숫자",
    tagline: "3D 스토리 카드 6장 · 비용·유동성·추적",
    summary:
      "같은 지수를 따라가는 ETF라도 실제로 내는 돈은 다릅니다. 순자산총액·거래량(유동성), 총보수+기타비용(실부담 비용), 추적오차·괴리율까지 여섯 숫자를 보고, 매수 전 10초 점검 3가지로 끝내는 순서를 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["ETF", "총보수", "기타비용", "추적오차", "괴리율", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-etf-6numbers-01.png",
        width: W,
        height: H,
        alt: "표지 — 여섯 개의 빈 계기판 다이얼이 달린 콘솔, 확대경으로 다이얼을 들여다보는 캐릭터와 '수익률 전에 볼 ETF 6개 숫자'",
        caption: "표지 — 수익률 전에 볼 6개 숫자",
      },
      {
        src: "/gallery/3d-etf-6numbers-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 아주 작은 가격표가 달린 택배 상자를 든 캐릭터, 오른쪽은 저울 아래 숨은 추 때문에 기운 상자",
        caption: "오해 vs 팩트 — 보수만 싸면 제일 싼 ETF? / 총비용으로 비교",
      },
      {
        src: "/gallery/3d-etf-6numbers-03.png",
        width: W,
        height: H,
        alt: "순자산·거래량 — 동전이 수북한 큰 좌판과 줄을 선 미니어처 군중, 위에서 깔때기로 동전이 쏟아지는 시장",
        caption: "숫자 ① ② — 순자산과 거래량, 클수록 유동성",
      },
      {
        src: "/gallery/3d-etf-6numbers-04.png",
        width: W,
        height: H,
        alt: "총보수+기타비용 — 물 위로 드러난 작은 빙산 끝과 물속의 거대한 얼음 덩어리, 옆 작은 배에 탄 캐릭터",
        caption: "숫자 ③ ④ — 총보수+기타비용이 실제 비용",
      },
      {
        src: "/gallery/3d-etf-6numbers-05.png",
        width: W,
        height: H,
        alt: "추적오차·괴리율 — 트랙에서 줄무늬 주자가 앞서 달리고, 캐릭터가 눈금 없는 긴 줄자를 들고 뒤쫓는 장면",
        caption: "숫자 ⑤ ⑥ — 추적오차·괴리율, 지수를 얼마나 따라가나",
      },
      {
        src: "/gallery/3d-etf-6numbers-06.png",
        width: W,
        height: H,
        alt: "매수 전 10초 — 빈 문자판의 큰 회중시계와 세 개의 빈 타일, 손가락을 들어 알려 주는 캐릭터",
        caption: "매수 전 10초 — 체크 3가지",
      },
    ],
    basis:
      "금융투자협회 펀드공시(총보수·기타비용·매매중개수수료), 금융감독원 ETF 비용 안내, 한국거래소 ETF 시장 안내 · 기준일 2026. 11. 22.",
    related: [
      { label: "적립식 투자, 흔들리지 않는 규칙", href: "/posts/invest-dca-rule" },
    ],
  },
  {
    id: "pension-1500-3d",
    title: "사적연금 연 1,500만 원 경계선",
    tagline: "3D 스토리 카드 6장 · 분리과세 vs 종합과세",
    summary:
      "사적연금은 연 1,500만 원까지 3.3~5.5% 저율 분리과세로 끝납니다. 무엇이 1,500만 원에 포함되는지, 넘었을 때 16.5% 분리과세와 종합과세 중 고르는 기준, 10년 이상 나눠 받는 인출 속도까지 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["사적연금", "1500만원", "분리과세", "종합과세", "연금수령", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-pension-1500-01.png",
        width: W,
        height: H,
        alt: "표지 — 흰 선이 그어진 흙길과 작은 나무 게이트, 금화 바구니를 든 캐릭터와 빈 나무 표지판",
        caption: "표지 — 사적연금 연 1,500만 원 경계선",
      },
      {
        src: "/gallery/3d-pension-1500-02.png",
        width: W,
        height: H,
        alt: "오해 vs 팩트 — 왼쪽은 바람 빠진 풍선을 든 시무룩한 캐릭터, 오른쪽은 두 갈래 길에 자신 있게 선 캐릭터",
        caption: "오해 vs 팩트 — 넘으면 무조건 손해? / 유리한 쪽을 고릅니다",
      },
      {
        src: "/gallery/3d-pension-1500-03.png",
        width: W,
        height: H,
        alt: "1,500만 원 이하 — 완만한 미끄럼틀을 따라 금화가 쟁반으로 미끄러지고, 꼭대기에 앉아 있는 캐릭터",
        caption: "이하 — 3.3~5.5% 저율 분리과세로 끝",
      },
      {
        src: "/gallery/3d-pension-1500-04.png",
        width: W,
        height: H,
        alt: "포함 범위 — 두 칸으로 나뉜 큰 단지에 동전이 쏟아지고, 작은 집과 원반은 테두리에 튕겨 밖으로 나가는 장면",
        caption: "포함 범위 — 공제받은 원금 + 운용수익만",
      },
      {
        src: "/gallery/3d-pension-1500-05.png",
        width: W,
        height: H,
        alt: "1,500만 원 초과 — 금빛 아치문과 크림색 아치문 사이에서 금화와 원반을 양손에 들고 저울질하는 캐릭터",
        caption: "초과 시 — 16.5% 분리과세 vs 종합과세",
      },
      {
        src: "/gallery/3d-pension-1500-06.png",
        width: W,
        height: H,
        alt: "인출 속도 — 수도꼭지에서 금화 한 닢이 여섯 개 컵 중 첫 컵으로 떨어지고, 손잡이를 천천히 조절하는 캐릭터",
        caption: "인출 속도 — 10년 이상 나눠 받기, 한 해 금액 낮추기",
      },
    ],
    basis:
      "소득세법 제14조 제3항 제9호(분리과세 기준 1,500만 원)·제64조의3·제20조의3, 국세청 연금소득 안내 · 기준일 2026. 11. 22.",
    related: [
      { label: "연금 인출·세금 시뮬레이터", href: "/apps/pension-draw/run" },
      { label: "5편 — 인출 순서 4단계와 연 1,500만원", href: "/posts/pension-master-05-draw-1500" },
    ],
  },
  /**
   * v7.8.0 — 3D 클레이 스토리 캐러셀 2세트 추가.
   * 세트3: 1·2세대 실손 계약전환(2026. 11. 23. 시행) / 세트4: 연말 전 900만 원 채우는 순서.
   * 렌더: `python3 scripts/render_gallery_3d.py --prefix s3,s4`
   */
  {
    id: "silson-switch-3d",
    title: "실손 50% 할인, 갈아타기 전 3가지",
    tagline: "3D 스토리 카드 6장 · 11. 23. 시행 계약전환",
    summary:
      "11월 23일부터 1·2세대 실손을 5세대로 바꾸면 3년간 5세대 보험료의 50%를 깎아 줍니다. 대상 조건부터 비중증 비급여 자기부담률, 선택형 특약의 1회 제한, 기존 계약을 해지했을 때 할인이 끝나는 조건까지 6장으로 정리했습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["실손보험", "계약전환", "선택형 할인", "5세대 실손", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-silson-switch-01.png",
        width: W,
        height: H,
        alt: "표지 — 보험 증권 두 권을 양손에 들고 번갈아 보는 너구리 캐릭터와 '내일부터 시작되는 실손 50% 할인'",
        caption: "표지 — 내일부터 시작되는 50% 할인",
      },
      {
        src: "/gallery/3d-silson-switch-02.png",
        width: W,
        height: H,
        alt: "대상 — 낡은 증권 한 권을 두 손으로 든 캐릭터와 '2013년 3월 이전 1·2세대 실손'",
        caption: "대상 — 2013년 3월 이전 계약",
      },
      {
        src: "/gallery/3d-silson-switch-03.png",
        width: W,
        height: H,
        alt: "함정 1 — 병원 모형과 저금통을 저울에 올려 견주는 캐릭터와 '병원 자주 간다면 먼저 따져야 해요'",
        caption: "함정 1 — 병원 이용이 많다면 자기부담률",
      },
      {
        src: "/gallery/3d-silson-switch-04.png",
        width: W,
        height: H,
        alt: "함정 2 — 잠긴 유리함 앞에서 황금 티켓 한 장을 든 캐릭터와 '선택형 할인은 철회·해지 1회'",
        caption: "함정 2 — 철회·해지는 1회",
      },
      {
        src: "/gallery/3d-silson-switch-05.png",
        width: W,
        height: H,
        alt: "함정 3 — 가위를 든 캐릭터와 '전환 전 6개월 기존 계약 해지하면'",
        caption: "함정 3 — 기존 계약을 해지하면 할인 종료",
      },
      {
        src: "/gallery/3d-silson-switch-06.png",
        width: W,
        height: H,
        alt: "클로징 — 증권을 돋보기로 들여다보는 캐릭터와 '숫자보다 증권을 먼저 펼쳐 보세요'",
        caption: "클로징 — 가입일과 병원 이용 빈도부터",
      },
    ],
    basis:
      "금융위원회 보도자료(2026. 11. 19.), 시행 2026. 11. 23.~신청 2027. 5. 22. · 기준 2026. 11. 22. · 할인율·보장은 보험사와 선택 조건에 따라 다름",
    related: [
      { label: "1·2세대 실손, 11월 23일부터 달라지는 두 가지 선택", href: "/posts/silson-switch-2026" },
      { label: "내 실손 세대 비교", href: "/apps/silson-compare/run" },
    ],
  },
  {
    id: "pension-900-3d",
    title: "연말 전 900만 원, 채우는 순서",
    tagline: "3D 스토리 카드 6장 · 연금저축 600 → IRP 300 → ISA 300",
    summary:
      "900만 원은 목표가 아니라 한도입니다. 연금저축 600만 원 → IRP 300만 원 → ISA 전환 300만 원 순서로 채우고, 내 공제율 16.5%·13.2%와 12월 31일 마감까지 6장으로 담았습니다.",
    category: "carousel",
    createdAt: "2026-11-22",
    tags: ["연말정산", "연금저축", "IRP", "ISA 전환", "세액공제", "3D 카드"],
    slides: [
      {
        src: "/gallery/3d-pension-tax-01.png",
        width: W,
        height: H,
        alt: "표지 — 동전 자루를 유리병에 붓는 캐릭터와 '연말 전 900만 원 채우는 순서'",
        caption: "표지 — 연금저축 600 → IRP 300 → ISA 300",
      },
      {
        src: "/gallery/3d-pension-tax-02.png",
        width: W,
        height: H,
        alt: "1단계 — 동전 자루를 큰 유리병에 붓는 캐릭터와 '먼저 연금저축 600만 원'",
        caption: "1단계 — 연금저축 600만 원",
      },
      {
        src: "/gallery/3d-pension-tax-03.png",
        width: W,
        height: H,
        alt: "2단계 — 금고에 동전을 쏟아 넣는 캐릭터와 'IRP로 300만 원 더 채우기'",
        caption: "2단계 — IRP로 300만 원, 합산 900만 원",
      },
      {
        src: "/gallery/3d-pension-tax-04.png",
        width: W,
        height: H,
        alt: "3단계 — 동전을 유리병에 넣는 캐릭터와 'ISA 만기 자금 300만 원 더'",
        caption: "3단계 — ISA 전환 300만 원 추가 한도",
      },
      {
        src: "/gallery/3d-pension-tax-05.png",
        width: W,
        height: H,
        alt: "내 숫자 — 금고 문 앞에서 손을 내미는 캐릭터와 '총급여 5,500만 기준 16.5% 아니면 13.2%'",
        caption: "내 공제율 — 16.5% 또는 13.2%",
      },
      {
        src: "/gallery/3d-pension-tax-06.png",
        width: W,
        height: H,
        alt: "마감 — 마지막 동전을 병에 넣는 캐릭터와 '12월 31일 입금분까지, 해지는 55세 이후에'",
        caption: "마감 — 12월 31일 입금분까지",
      },
    ],
    basis:
      "소득세법 제59조의3·제21조, 국세청 연말정산·연금계좌 세액공제 안내 · 기준 2026. 11. 22. · 총급여 5,500만 원 이하 16.5%(지방소득세 포함) 가정",
    related: [
      { label: "연금저축 900만원보다 먼저 계산해야 할 것", href: "/posts/pension-tax-order" },
      { label: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run" },
    ],
  },
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
/** 카테고리별 세트 수 — 메뉴 주소(`/gallery/?cat=cardnews`)에서 잘라 낸 문자열을 그대로 받는다. */
export const categoryCount = (id: string) =>
  galleryItems.filter((i) => i.category === (id as GalleryCategoryId)).length;
