/**
 * 유용한앱 4탄 — 이미지·링크·문서·시각 유틸리티 4종의 앱스토어 데이터.
 *
 * 이 파일은 **메인 병합용 대기 파일**이다(2탄 `utils-b.ts`·3탄 `utils-c.ts`와 같은 방식).
 * 공유 파일을 건드리지 않기 위해 여기서만 App·StoreItem 모양을 만든다.
 *
 * ── 병합 순서 (메인에서 4곳만 고치면 된다) ──────────────────────────────
 * 1) `src/data/apps.ts`
 *    · `App["art"]` 유니언에 아래 `UtilsArt` 4개 키를 더한다.
 *    · `apps` 배열에 `...utilsDApps`를 펼쳐 넣는다(카테고리는 이미 "utility").
 * 2) `src/data/store.ts`
 *    · `StoreIcon` 유니언에 같은 4개 키를 더하고 `artToIcon`에 1:1 매핑을 넣는다.
 *    · `storeItems` 생성부에 `...utilsDStore`를 더한다.
 * 3) `src/components/tools/ToolRunner.tsx`
 *    · 아래 `UTILS_D_RUNNER` 매핑을 그대로 `MAP`에 펼친다.
 * 4) `src/components/apps/AppStoreIcon.astro`
 *    · `name` 유니언에 4개 키를 더하고 `paths`에 `UTILS_D_ICONS`의 경로를 붙인다.
 *
 * 실행 화면은 `/apps/<slug>/run`이 자동으로 만들어진다(내부 앱 + ToolRunner 매핑).
 * 컴포넌트는 `src/components/tools/utils/` 아래에 있고, 함께 병합되는 `UtilShell.tsx`를 쓴다.
 *
 * 이 4종 중 **URL 단축기만 값을 외부로 보낸다**(spoo.me). 그래서 `notice`에 그 사실을 적었고,
 * 컴포넌트의 배지도 '서버 미전송'이 아니라 '단축 서버 전송'으로 두었다. 나머지 3종은 100% 로컬이다.
 */
import type { App, AppCategoryId } from "./apps.ts";
import type { StoreItem } from "./store.ts";

export type UtilsArt = "u-upscale" | "u-shorten" | "u-pdf-split" | "u-clock";

/** App의 `art`만 이 파일 전용 키로 바꾼 모양 — 병합할 때 apps.ts의 유니언에 키를 더하면 그대로 맞는다 */
export type UtilsApp = Omit<App, "art"> & { art: UtilsArt };
export type UtilsStoreItem = Omit<StoreItem, "icon"> & { icon: UtilsArt; category: AppCategoryId };

const MADE_IN = "2026년 11월";
const STATUS = "live" as const;

export const utilsDApps: UtilsApp[] = [
  {
    slug: "url-shortener",
    archived: true,
    name: "URL 주소 단축기",
    subtitle: "긴 주소를 짧게, 추적은 떼고",
    summary:
      "긴 주소에서 utm_*·fbclid 같은 추적 파라미터를 떼어 내고, 공개 단축 서비스로 짧은 주소를 만듭니다. 같은 주소의 QR 코드도 바로 그려 줍니다.",
    question: "이 긴 주소를 보내기 좋게 줄이려면",
    kind: "링크",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "긴 주소를 정리해 짧게 만들고, 휴대폰으로 바로 열 수 있는 QR 코드를 함께 만들어 줍니다.",
    why: [
      "메신저로 주소를 보내면 추적 파라미터가 붙은 채로 길게 남습니다. 어디서 왔는지 세는 값인데, 받는 사람에게는 읽을 수 없는 글자 덩어리일 뿐입니다.",
      "그래서 정리와 단축을 한 화면에 두었습니다. 추적 파라미터를 떼면 주소가 짧아지고, 그래도 길면 단축 서비스로 한 번 더 줄입니다.",
      "단축은 내 브라우저 밖으로 주소를 보내는 일입니다. 그 사실을 숨기지 않으려고 화면 위 배지를 '단축 서버 전송'으로 두고, 민감한 주소는 단축하지 말라고 먼저 적었습니다. 서비스가 막혀도 쓸 수 있도록 정리한 주소와 QR은 브라우저에서 그대로 만듭니다.",
    ],
    features: [
      {
        title: "추적 파라미터 제거",
        body: "utm_*, fbclid, gclid, yclid, igshid, mc_cid 같은 값만 떼고, 나머지 질의 값은 그대로 둡니다. 몇 개를 뗐는지 함께 보여 줍니다.",
      },
      {
        title: "짧은 주소 만들기",
        body: "공개 단축 서비스(spoo.me)로 주소를 보내 짧은 주소를 받습니다. 실패하면 이유와 함께 정리한 주소를 그대로 쓰라고 안내합니다.",
      },
      {
        title: "QR 코드",
        body: "정리한 주소와 짧은 주소 각각의 QR을 브라우저에서 직접 그립니다. 서비스가 막혀도 QR은 만들 수 있습니다.",
      },
      {
        title: "복사·목록",
        body: "짧은 주소·정리한 주소·QR을 복사하고, 이번 화면에서 만든 주소를 최근 5개까지 모아 둡니다.",
      },
    ],
    audience: "카톡·문자·SNS로 링크를 보내는 사람, 오프라인 안내문에 QR을 넣어야 하는 사람.",
    basis: [
      "브라우저 CORS 확인(2026-11-21): tinyurl·is.gd·v.gd는 Access-Control-Allow-Origin을 우리 출처에 열지 않아 브라우저에서 호출할 수 없습니다. spoo.me는 `*`로 열려 있고 JSON으로 답해 브라우저에서 바로 쓸 수 있습니다.",
      "단축 요청은 분당 요청 수 제한이 있습니다. 제한에 걸리면 1분 뒤 다시 시도하라고 안내합니다.",
      "QR은 qrcode-generator로 브라우저 안에서 그립니다. QR 이미지도 서버로 가지 않습니다.",
      "단축 주소는 spoo.me 서버에 저장됩니다. 그 주소를 누가 얼마나 눌렀는지도 그쪽에 남습니다.",
    ],
    inputs: ["긴 주소", "추적 파라미터 제거 여부"],
    outputs: ["정리한 주소", "짧은 주소", "QR 코드", "이번 화면에서 만든 주소 목록"],
    runNote: "주소를 넣으면 정리된 주소가 바로 나옵니다. [짧은 주소 만들기]를 누르면 짧은 주소와 QR이 함께 나옵니다.",
    sourceLine: "spoo.me 공개 API · CORS 확인 2026. 11. 21.",
    assumptions: [
      "짧은 주소를 만들 때만 입력한 주소가 외부(spoo.me)로 전송됩니다. 정리·QR은 브라우저 안에서만 처리합니다.",
      "단축 서비스가 응답하지 않으면 짧은 주소는 만들어지지 않습니다. 이때도 정리한 주소와 QR은 그대로 쓸 수 있습니다.",
    ],
    notice:
      "짧은 주소를 만들면 입력한 주소가 외부 단축 서비스(spoo.me)로 전송·저장됩니다. 고객 이름·연락처가 들어간 주소는 단축하지 마세요.",
    sendsDataOut: true,
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "u-shorten",
    tags: ["URL", "단축", "링크", "QR", "UTM", "추적제거"],
  },
  {
    slug: "market-world-clock",
    archived: true,
    name: "글로벌 증시 개장시간",
    subtitle: "한국·미국·일본·영국·유럽 지금 시각",
    summary:
      "한국(KRX)·미국(NYSE·NASDAQ)·일본(TSE)·영국(LSE)·유럽(Euronext)의 현지 시각과 지금이 프리·정규·애프터·휴장 중 어디인지, 다음 개장·마감까지 남은 시간을 1초마다 보여 줍니다.",
    question: "지금 뉴욕은 장중인가, 다음 개장까지 몇 시간인가",
    kind: "금융·시각",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "주요 거래소 다섯 곳의 현지 시각과 개장·마감까지 남은 시간을 서머타임까지 반영해 보여 줍니다.",
    why: [
      "미국 장을 보려면 밤낮이 뒤집힙니다. 그런데 서머타임이 시작되고 끝나는 두 번의 주에 시간이 한 시간씩 밀리거나 당겨져서, 매번 '몇 시에 열지'를 다시 찾게 됩니다.",
      "그래서 시간대 이름만 쓰고 오프셋을 직접 더하지 않았습니다. 브라우저가 그 시점의 표준시·서머타임을 알고 있어서, 미국 3월·11월과 영국 3월·10월 전환이 저절로 반영됩니다. 지금이 서머타임인지도 함께 적었습니다.",
      "한국에서 보는 사람이 기준을 잡기 쉽도록, 각 거래소의 다음 개장·마감 시각을 한국 시간으로도 같이 적었습니다.",
    ],
    features: [
      {
        title: "다섯 거래소 한 화면",
        body: "KRX, NYSE·NASDAQ, TSE, LSE, Euronext의 현지 시각을 1초마다 갱신합니다.",
      },
      {
        title: "구간 표시",
        body: "프리마켓·정규장·애프터마켓·개장 전·장 사이 휴장·마감·주말 휴장을 색으로 구분합니다.",
      },
      {
        title: "다음 경계까지",
        body: "지금 구간의 마감까지, 또는 다음 구간의 시작까지 남은 시간을 초 단위로 셉니다.",
      },
      {
        title: "서머타임 자동",
        body: "미국·영국·유럽의 서머타임 전환이 자동 반영되고, 지금 적용 중인지도 표시합니다.",
      },
    ],
    audience: "미국·유럽 장 시간에 맞춰 일하는 사람, 해외 주식·ETF를 보는 사람, 해외 거래처와 통화 시간을 잡는 사람.",
    basis: [
      "시간대는 IANA 이름(Asia/Seoul, America/New_York, Europe/London 등)으로 계산합니다. 브라우저의 Intl이 그 시점의 오프셋을 알려 주므로 서머타임이 자동 반영됩니다.",
      "정규장 시간 — KRX 09:00–15:30 · NYSE/NASDAQ 09:30–16:00(프리 04:00–09:30, 애프터 16:00–20:00) · TSE 09:00–11:30·12:30–15:30 · LSE 08:00–16:30 · Euronext 09:00–17:30.",
      "프리·애프터마켓 시간은 증권사마다 다릅니다. 미국은 04:00–20:00(ET) 기준으로 계산합니다.",
      "휴장일(설·추석·추수감사절·크리스마스 등)과 임시 휴장은 반영하지 않습니다.",
    ],
    inputs: ["없음 (열면 바로 계산)"],
    outputs: ["거래소별 현지 시각", "지금 구간(프리·정규·애프터·휴장)", "다음 개장·마감까지 남은 시간", "한국 시간 기준 개장·마감 시각"],
    runNote: "열면 바로 다섯 거래소의 시각이 흐릅니다. 별도 입력 없이 브라우저의 시간대 정보로 계산합니다.",
    sourceLine: "각 거래소 정규장 시간 · IANA 시간대 · 기준일 2026. 11. 21.",
    assumptions: [
      "시각은 기기의 시계를 기준으로 합니다. 기기 시계가 틀리면 함께 틀립니다.",
      "휴장일·조기 마감(반일장)은 반영하지 않습니다. 실제 주문 전에는 증권사 공지를 확인하세요.",
    ],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "u-clock",
    tags: ["세계시계", "개장시간", "서머타임", "뉴욕", "런던", "도쿄", "증시"],
  },
];

export const utilsDStore: UtilsStoreItem[] = utilsDApps.map((a, i) => ({
  id: a.slug,
  name: a.name,
  tagline: a.subtitle,
  summary: a.summary,
  category: "utility" as AppCategoryId,
  href: `/apps/${a.slug}`,
  openHref: `/apps/${a.slug}/run`,
  external: false,
  status: a.status,
  icon: a.art,
  meta: a.kind + (a.slug === "url-shortener" ? " · 단축은 외부 전송" : " · 서버 미전송"),
  order: 200 + i * 10,
  featured: false,
  tags: a.tags,
}));

/** ToolRunner의 MAP에 그대로 펼치는 매핑 — slug → 컴포넌트 */
export const UTILS_D_RUNNER: Record<string, string> = {
  "image-upscale": "ImageUpscale",
  "url-shortener": "UrlShortener",
  "pdf-merge-split": "PdfMergeSplit",
  "market-world-clock": "MarketWorldClock",
};

/** AppStoreIcon.astro의 paths에 붙일 24px 선 아이콘 — 이름은 art 키와 같다 */
export const UTILS_D_ICONS: Record<UtilsArt, string> = {
  "u-upscale":
    "M4 5.4h9.4v9.4H4zM10.6 9.6h9.4v9H10.6zM4 12.4l2.4-2 2.6 2.4M13.4 18.6l2.2-2.2 2.6 2.2",
  "u-shorten":
    "M9.6 14.4l4.8-4.8M7.8 11.4l-1.6 1.6a3.3 3.3 0 0 0 4.7 4.7l1.6-1.6M16.2 12.6l1.6-1.6a3.3 3.3 0 0 0-4.7-4.7l-1.6 1.6",
  "u-pdf-split":
    "M6.4 3.4h7.2l4 4v13.2H6.4zM13.2 3.6v4h4M9 12.4h6M9 15.6h6M9 18.4h3.4",
  "u-clock":
    "M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM12 7.2v5l3.4 2M3.6 12h2M18.4 12h2M12 3.6v2M12 18.4v2",
};
