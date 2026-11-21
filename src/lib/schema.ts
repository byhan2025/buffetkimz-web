/**
 * 구조화 데이터(JSON-LD) 공통 노드 — 3단계 SEO 정리(2026-11-21).
 *
 * 원칙
 * · 주소는 canonical 과 똑같이 끝 슬래시를 붙인다(pageUrl). 검색엔진이 structured data 의 url 과
 *   canonical 을 다른 문서로 읽지 않게 하기 위함이다.
 * · 조직·사이트·작성자는 페이지마다 새로 만들지 않고 `@id` 로 같은 개체를 가리킨다
 *   (Organization `#organization`, WebSite `#website`, Person `#author`).
 * · 확인된 것만 넣는다. SNS 주소는 channels.ts 에서 `url` 이 채워진(확인된) 것만 sameAs 로 쓴다.
 * · 검색 Action(SearchAction)은 넣지 않는다 — 이 사이트의 검색은 주소에 검색어를 남기지 않는
 *   브라우저 안 검색이라 `?q=` 주소로 재현할 수 없다. 재현되지 않는 Action 은 넣지 않는다.
 */
import { absolute, site } from "@/config/site";
import { channels, confirmedLinks } from "@/data/channels";

/** canonical 규칙과 같은 끝 슬래시 절대 주소 */
export function pageUrl(path: string): string {
  const p = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return absolute(p);
}

export const ORG_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const AUTHOR_ID = `${site.url}/#author`;

/** 확인된 외부 프로필만 (channels.ts 의 url + confirmedLinks) */
export function sameAs(): string[] {
  const list = [
    ...confirmedLinks.map((c) => c.url),
    ...channels.filter((c) => c.url).map((c) => c.url as string),
  ];
  return Array.from(new Set(list));
}

/** 조직 — publisher 로 글마다 @id 참조된다. 로고는 OG 카드(1200×630)를 쓴다. */
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: site.brand,
    url: pageUrl("/"),
    description: site.description,
    logo: {
      "@type": "ImageObject",
      url: absolute("/og.png"),
      width: 1200,
      height: 630,
    },
    ...(sameAs().length ? { sameAs: sameAs() } : {}),
  };
}

/** 사이트 — 첫 화면에서 한 번만 선언하고, 하위 페이지는 isPartOf 로 가리킨다. */
export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: pageUrl("/"),
    name: site.brand,
    description: site.description,
    inLanguage: "ko-KR",
    publisher: { "@id": ORG_ID },
  };
}

/** 작성자 — 실명·직업은 넣지 않는다(비영업 개인 브랜드 원칙). */
export function personNode() {
  return {
    "@type": "Person",
    "@id": AUTHOR_ID,
    name: site.author.name,
    description: site.author.bio,
    url: pageUrl("/about"),
    ...(sameAs().length ? { sameAs: sameAs() } : {}),
  };
}

/** BreadcrumbList — 홈 > … 순서. 마지막 항목은 현재 페이지. */
export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: pageUrl(it.path),
    })),
  };
}

/** 여러 노드를 하나의 @graph 문서로 묶는다. */
export function graph(nodes: Record<string, unknown>[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

/** 하위 페이지가 공통으로 붙이는 참조 — 이 페이지가 사이트의 일부임을 밝힌다. */
export const partOfWebsite = { "@id": WEBSITE_ID };
