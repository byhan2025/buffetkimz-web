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
  | "watermark";

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
  meta: a.basis?.[0] ? a.kind : a.kind,
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

/** 카테고리별 개수 — `금융투자앱 5` 같은 표기를 데이터에서 센다. */
export const categoryCount = (id: AppCategoryId) => storeItems.filter((i) => i.category === id).length;

export const storePath = (item: StoreItem) => item.href;
