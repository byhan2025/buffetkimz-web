/**
 * 앱스토어 데이터 — v7.0.
 *
 * 앱스토어(`/apps`)와 홈 추천 칸이 함께 읽는 **한 파일**.
 *
 *  · 앱(`apps.ts`)은 그대로 두고, 사이트 안의 계산 도구와 골든타임을 같은 진열대로 모은다.
 *  · 카테고리는 `APP_CATEGORIES`(apps.ts)의 id만 쓴다. 새 카테고리는 배열에 한 줄,
 *    새 앱은 `apps.ts`에 한 항목 + `category` 한 줄이면 탭·섹션·개수가 자동으로 따라온다.
 *  · 앱스토어 진열 순서(`order`)는 카테고리 안에서만 쓴다. 숫자가 낮을수록 앞.
 */
import { apps, APP_CATEGORIES, type App, type AppCategoryId } from "./apps.ts";
import { calendar } from "./calendar.ts";
import { galleryCount, gallerySlideCount } from "./gallery.ts";

export type StoreIcon =
  | "pension"
  | "pension-draw"
  | "retirement"
  | "compound"
  | "accounts"
  | "coverage"
  | "disclosure"
  | "silson"
  | "guide"
  | "timemachine"
  | "calendar"
  | "gallery"
  | "exif"
  | "url"
  | "pdf"
  | "compress"
  | "qr"
  | "resize"
  | "watermark"
  /* v7.3 유용한앱 2탄 · 3탄 — art 키를 그대로 아이콘 이름으로 쓴다 */
  | "text-counter"
  | "privacy-masker"
  | "json-csv-formatter"
  | "password-generator"
  | "diff-checker"
  | "color-extractor"
  | "text-to-card"
  | "unit-date-calc"
  | "age"
  | "salary"
  | "loan"
  | "vat"
  | "rent"
  | "severance"
  | "dividend"
  | "hourly"
  /* v7.3 유용한앱 4탄 */
  | "u-upscale"
  | "u-shorten"
  | "u-pdf-split"
  | "u-clock"
  /* v7.4 유용한앱 5탄 */
  | "svg-logo"
  | "brokerage-fee"
  | "acquisition-tax"
  | "subscription-score"
  | "moving-dday"
  | "health-premium"
  | "annual-leave"
  | "unemployment"
  | "freelancer-tax"
  | "overseas-tax"
  | "deposit-compare"
  | "stock-average";

export type StoreItem = {
  id: string;
  name: string;
  /** 카드에서 이름 아래 한 줄 */
  tagline: string;
  /** 소개·검색에 쓰는 1~2문장 */
  summary: string;
  category: AppCategoryId;
  /** 소개(상세) 페이지 */
  href: string;
  /** 바로 여는 곳 — 실행 화면 또는 외부 앱 */
  openHref: string;
  /** 사이트 밖에서 열리는 앱 */
  external?: boolean;
  status: "live" | "preview";
  /** 실무자용 표시 */
  practitioner?: boolean;
  notice?: string;
  icon: StoreIcon;
  /** 카드 아래 메타 한 줄 */
  meta: string;
  /** 카테고리 안 진열 순서 */
  order: number;
  /** 홈 추천에 올릴지 */
  featured?: boolean;
  tags: string[];
};

const artToIcon: Record<App["art"], StoreIcon> = {
  guide: "guide",
  coverage: "coverage",
  disclosure: "disclosure",
  silson: "silson",
  pension: "pension",
  "pension-draw": "pension-draw",
  retirement: "retirement",
  compound: "compound",
  accounts: "accounts",
  timemachine: "timemachine",
  "u-exif": "exif",
  "u-url": "url",
  "u-pdf": "pdf",
  "u-compress": "compress",
  "u-qr": "qr",
  "u-resize": "resize",
  "u-watermark": "watermark",
  /* v7.3 — 2·3탄은 art 키 = 아이콘 이름 */
  "text-counter": "text-counter",
  "privacy-masker": "privacy-masker",
  "json-csv-formatter": "json-csv-formatter",
  "password-generator": "password-generator",
  "diff-checker": "diff-checker",
  "color-extractor": "color-extractor",
  "text-to-card": "text-to-card",
  "unit-date-calc": "unit-date-calc",
  age: "age",
  salary: "salary",
  loan: "loan",
  vat: "vat",
  rent: "rent",
  severance: "severance",
  dividend: "dividend",
  hourly: "hourly",
  "u-upscale": "u-upscale",
  "u-shorten": "u-shorten",
  "u-pdf-split": "u-pdf-split",
  "u-clock": "u-clock",
  /* v7.4 — 5탄은 art 키 = 아이콘 이름 */
  "svg-logo": "svg-logo",
  "brokerage-fee": "brokerage-fee",
  "acquisition-tax": "acquisition-tax",
  "subscription-score": "subscription-score",
  "moving-dday": "moving-dday",
  "health-premium": "health-premium",
  "annual-leave": "annual-leave",
  unemployment: "unemployment",
  "freelancer-tax": "freelancer-tax",
  "overseas-tax": "overseas-tax",
  "deposit-compare": "deposit-compare",
  "stock-average": "stock-average",
};

/** 카드 아래 메타 한 줄 — 앱마다 다른 값을 쓰는 새 앱만 여기에 적는다. */
const metaBySlug: Record<string, string> = {
  "text-counter": "텍스트 · 서버 미전송",
  "privacy-masker": "보안 · 서버 미전송",
  "json-csv-formatter": "문서·데이터 · 서버 미전송",
  "password-generator": "보안 · 서버 미전송",
  "diff-checker": "문서 · 서버 미전송",
  "color-extractor": "디자인 · 서버 미전송",
  "text-to-card": "디자인 · 서버 미전송",
  "unit-date-calc": "생활 계산 · 서버 미전송",
  "korean-age-pension": "행정기본법·국민연금법 기준",
  "salary-net": "2026년 요율 · 근로소득세 근사",
  "loan-repay": "원리금균등·원금균등·만기일시",
  "vat-margin": "부가세 10% · 3탭 계산",
  "rent-jeonse": "전환율·기회비용 포함 비교",
  "severance-pay": "평균임금·통상임금 기준",
  "dividend-tax": "금융소득종합과세 기준선",
  "hourly-wage": "2026 최저임금 10,320원",
  "image-upscale": "이미지 · 서버 미전송",
  "url-shortener": "URL · 단축은 외부 전송",
  "pdf-merge-split": "PDF · 서버 미전송",
  "market-world-clock": "시각 · 서버 미전송",
  /* v7.4 — 유용한앱 5탄 */
  "svg-logo-maker": "디자인 · 서버 미전송",
  "brokerage-fee": "중개보수 · 서버 미전송",
  "acquisition-tax": "2026 세율 · 서버 미전송",
  "subscription-score": "84점 만점 · 서버 미전송",
  "moving-dday": "전입 14일 · 서버 미전송",
  "health-insurance-compare": "7.19% · 서버 미전송",
  "annual-leave": "근로기준법 제60조",
  "unemployment-benefit": "상한 68,100원 · 서버 미전송",
  "freelancer-tax": "3.3% 양방향 · 서버 미전송",
  "overseas-stock-tax": "250만원 공제 · 서버 미전송",
  "deposit-savings": "15.4% · 서버 미전송",
  "stock-averaging": "평단가 · 서버 미전송",
};

/** 홈 진열 순서 — 금융·연금 계산이 먼저, 앱이 뒤, 보험이 마지막. */
const orderBySlug: Record<string, number> = {
  "pension-tax": 10,
  "retirement-flow": 20,
  "compound-return": 30,
  "account-tax-compare": 35,
  "pension-draw": 40,
  "trade-timemachine": 50,
  "coverage-check": 10,
  "silson-compare": 20,
  "disclosure-check": 30,
  "bojang-counsel-guide": 40,
  "exif-mosaic": 30,
  "url-cleaner": 40,
  "pdf-image": 50,
  "image-compress": 60,
  "qr-generator": 70,
  "image-resize": 80,
  watermark: 90,
  /* v7.3 — 유용한앱 2탄 */
  "text-counter": 100,
  "privacy-masker": 110,
  "json-csv-formatter": 120,
  "password-generator": 130,
  "diff-checker": 140,
  "color-extractor": 150,
  "text-to-card": 160,
  "unit-date-calc": 170,
  /* v7.3 — 유용한앱 3탄(금융·생활 계산) */
  "korean-age-pension": 180,
  "salary-net": 190,
  "loan-repay": 200,
  "vat-margin": 210,
  "rent-jeonse": 220,
  "severance-pay": 230,
  "dividend-tax": 240,
  "hourly-wage": 250,
  /* v7.3 — 유용한앱 4탄 */
  "image-upscale": 260,
  "url-shortener": 270,
  "pdf-merge-split": 280,
  "market-world-clock": 290,
  /* v7.4 — 유용한앱 5탄(부동산·노동·세금·금융 계산) */
  "svg-logo-maker": 300,
  "brokerage-fee": 310,
  "acquisition-tax": 320,
  "subscription-score": 330,
  "moving-dday": 340,
  "health-insurance-compare": 350,
  "annual-leave": 360,
  "unemployment-benefit": 370,
  "freelancer-tax": 380,
  "overseas-stock-tax": 390,
  "deposit-savings": 400,
  "stock-averaging": 410,
};

const fromApps: StoreItem[] = apps.map((a) => ({
  id: a.slug,
  name: a.name,
  tagline: a.subtitle,
  summary: a.summary,
  category: a.category,
  href: `/apps/${a.slug}`,
  openHref: a.externalUrl ?? `/apps/${a.slug}/run`,
  external: Boolean(a.externalUrl),
  status: a.status,
  practitioner: a.scope === "practitioner",
  notice: a.notice,
  icon: artToIcon[a.art],
  meta: metaBySlug[a.slug] ?? a.kind,
  order: orderBySlug[a.slug] ?? 90,
  featured: ["pension-tax", "retirement-flow", "trade-timemachine", "silson-compare"].includes(a.slug),
  tags: a.tags,
}));

/** 골든타임 — 계산 도구는 아니지만 앱스토어의 '유용한앱' 칸에 놓는다. */
const calendarItem: StoreItem = {
  id: "finance-calendar",
  name: "골든타임",
  tagline: "1~12월, 놓치면 손해인 날",
  summary: `${calendar.length}건의 금융·세무·건보 일정을 월별로 봅니다. 연말정산, 연금 납입 마감, 건보료 정산, 실손 갱신처럼 날짜를 놓치면 돈이 새는 절차를 한 장에 모았습니다.`,
  category: "utility",
  href: "/calendar",
  openHref: "/calendar",
  status: "live",
  icon: "calendar",
  meta: `일정 ${calendar.length}건 · 월별 분류`,
  order: 10,
  featured: true,
  tags: ["골든타임", "연말정산", "연금 납입", "건보료", "실손 갱신"],
};

/** 자료앨범 — 방문자 다운로드 전용. 관리자가 등록한 카드뉴스·캐러셀을 모아 둔 칸. */
const galleryItem: StoreItem = {
  id: "gallery",
  name: "자료앨범",
  tagline: "카드뉴스·인포그래픽 내려받기",
  summary: `연금·금융 주제를 4:5 카드(${galleryCount}세트 ${gallerySlideCount}장)로 정리해 미리보기와 다운로드로 제공합니다. 페이지에서 바로 크게 보고, 한 장만 또는 세트 전체를 내려받습니다.`,
  category: "utility",
  href: "/gallery",
  openHref: "/gallery",
  status: "live",
  icon: "gallery",
  meta: `카드 ${galleryCount}세트 · ${gallerySlideCount}장 · 1080×1350`,
  order: 20,
  featured: false,
  tags: ["자료앨범", "카드뉴스", "캐러셀", "인포그래픽", "체크리스트", "다운로드"],
};

export const storeItems: StoreItem[] = [...fromApps, calendarItem, galleryItem].sort((a, b) => {
  const ca = APP_CATEGORIES.findIndex((c) => c.id === a.category);
  const cb = APP_CATEGORIES.findIndex((c) => c.id === b.category);
  return ca === cb ? a.order - b.order : ca - cb;
});

export const storeByCategory = APP_CATEGORIES.map((c) => ({
  category: c,
  items: storeItems.filter((i) => i.category === c.id),
}));

export const storeCount = storeItems.length;

/** 홈 '추천 앱' — 다섯 종. 카테고리마다 하나씩, 금융은 두 개. */
export const featuredStore: StoreItem[] = [
  storeItems.find((i) => i.id === "pension-tax")!,
  storeItems.find((i) => i.id === "retirement-flow")!,
  storeItems.find((i) => i.id === "trade-timemachine")!,
  storeItems.find((i) => i.id === "silson-compare")!,
  calendarItem,
];

export const storeById = (id: string) => storeItems.find((i) => i.id === id);

/** 카테고리별 개수 — `금융투자앱 5` 같은 표기를 데이터에서 센다.
 *  메뉴 주소(`/apps/#cat-finance`)에서 잘라 낸 문자열을 그대로 넘길 수 있게 `string`을 받는다.
 *  모르는 값이면 0으로 센다(빌드 중 화면 숫자가 틀어지지 않게). */
export const categoryCount = (id: string) =>
  storeItems.filter((i) => i.category === (id as AppCategoryId)).length;

export const storePath = (item: StoreItem) => item.href;
