import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withBase } from "@/config/site";
import {
  popularQueries,
  queryTerms,
  searchDocs,
  splitHighlight,
  typeLabels,
  type SearchDoc,
  type SearchHit,
} from "../lib/search";

/* 인덱스는 한 번만 받아 재사용한다. */
let cache: SearchDoc[] | null = null;
let pending: Promise<SearchDoc[]> | null = null;

function loadIndex(): Promise<SearchDoc[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch(withBase("/search-index.json"), { headers: { accept: "application/json" } })
      .then((res) => res.json())
      .then((data: { docs: SearchDoc[] }) => {
        cache = data.docs;
        return cache;
      })
      .catch(() => {
        pending = null;
        return [] as SearchDoc[];
      });
  }
  return pending;
}

type TypeFilter = "all" | "post" | "app" | "calendar";

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "post", label: "금융지식" },
  { value: "app", label: "앱" },
  { value: "calendar", label: "금융캘린더" },
];

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = splitHighlight(text, terms);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="mark">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

function HitRow({
  hit,
  index,
  active,
  onHover,
  highlight,
}: {
  hit: SearchHit;
  index: number;
  active: number;
  onHover: (i: number) => void;
  highlight: boolean;
}) {
  const d = hit.doc;
  return (
    <li>
      <a
        href={withBase(d.url)}
        onMouseEnter={() => onHover(index)}
        className={`group block py-4 ${index === active && highlight ? "bg-paper-deep/70" : ""}`}
      >
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-semibold text-brand">{typeLabels[d.type]}</span>
          {d.group && <span className="text-ink-faint">· {d.group}</span>}
          {d.type === "post" && d.date && (
            <span className="dateline ml-auto text-[12px] text-ink-faint">{d.date}</span>
          )}
        </div>
        <p className="mt-1 text-[15.5px] font-semibold leading-snug tracking-[-0.02em] text-ink group-hover:underline group-hover:underline-offset-4">
          <Highlight text={d.title} terms={hit.terms} />
        </p>
        <p className="clamp-2 mt-1 text-[13px] leading-[1.7] text-ink-muted">
          <Highlight text={hit.snippet} terms={hit.terms} />
        </p>
      </a>
    </li>
  );
}

const SECTION_ORDER: { type: SearchDoc["type"]; label: string }[] = [
  { type: "post", label: "금융지식 글" },
  { type: "app", label: "앱" },
  { type: "calendar", label: "금융캘린더" },
];

type Props = {
  variant?: "page" | "overlay";
  onClose?: () => void;
  /** 오버레이를 열 때 함께 넘기는 검색어(예: 글의 태그) — 컴포넌트 안에서만 쓰고 저장하지 않는다. */
  initialQuery?: string;
};

export default function SearchApp({ variant = "page", onClose, initialQuery = "" }: Props) {
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<TypeFilter>("all");
  const [group, setGroup] = useState<string>("all");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isPage = variant === "page";

  useEffect(() => {
    if (!isPage) inputRef.current?.focus();
  }, [isPage]);

  useEffect(() => {
    let alive = true;
    loadIndex().then((list) => {
      if (alive) setDocs(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isPage) inputRef.current?.focus();
  }, [isPage]);

  const terms = useMemo(() => queryTerms(query), [query]);

  const hits = useMemo(() => {
    if (!docs) return [] as SearchHit[];
    return searchDocs(docs, query, { type, group });
  }, [docs, query, type, group]);

  useEffect(() => setActive(0), [query, type, group]);

  const groups = useMemo(() => {
    if (!docs) return [] as string[];
    const list: string[] = [];
    for (const d of docs) {
      if (d.group && !list.includes(d.group)) list.push(d.group);
    }
    return list;
  }, [docs]);

  const shown = hits.slice(0, isPage ? 40 : 8);

  const openHit = useCallback(
    (hit: SearchHit) => {
      /* 서브패스 배포(/buffetkimz-web)에서도 검색 결과로 이동하도록 접두를 붙인다. */
      window.location.assign(withBase(hit.doc.url));
    },
    []
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = shown[active] ?? shown[0];
      if (hit) openHit(hit);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="relative">
        <label htmlFor={`search-input-${variant}`} className="sr-only">
          금융지식 글, 앱, 금융캘린더 검색
        </label>
        <input
          ref={inputRef}
          id={`search-input-${variant}`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isPage ? "검색어를 입력하세요 — 예: 연금, 실손, 고지의무" : "검색 — 연금, 실손, 고지의무, 환율"}
          className="search-field"
          autoComplete="off"
          enterKeyHint="search"
          aria-controls="search-results"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="검색어 지우기"
            className="absolute right-11 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink-faint transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="11" cy="11" r="6.4" />
            <path d="m16 16 4.2 4.2" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
        <span className="text-ink-faint">많이 찾는 말</span>
        {popularQueries.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setQuery(p)}
            className="min-h-[44px] rounded-full border border-line px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-muted hover:text-ink"
          >
            {p}
          </button>
        ))}
      </div>

      {isPage && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-line py-1">
          <div role="tablist" aria-label="결과 종류" className="flex gap-5">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={type === t.value}
                className="tab"
                onClick={() => {
                  setType(t.value);
                  if (t.value === "all") setGroup("all");
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink-faint">
            {docs === null ? "인덱스를 불러오는 중" : `${hits.length}건`}
          </p>
        </div>
      )}

      {isPage && type === "post" && groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => setGroup("all")}
            className={`min-h-[44px] text-[12.5px] ${group === "all" ? "font-bold text-ink underline underline-offset-4" : "text-ink-muted"}`}
          >
            모든 카테고리
          </button>
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`min-h-[44px] text-[12.5px] ${group === g ? "font-bold text-ink underline underline-offset-4" : "text-ink-muted"}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div id="search-results" className="mt-4" aria-live="polite">
        {docs === null ? (
          <p className="py-10 text-center text-[13px] text-ink-faint">검색 인덱스를 불러오는 중입니다.</p>
        ) : query.trim() === "" ? (
          <div className="pt-2">
            <p className="text-[13px] text-ink-muted">
              제목, 본문, 태그, 앱 이름까지 한 번에 찾습니다. 단어를 띄워 쓰면 모두 들어 있는 글만 보여 줍니다.
            </p>
            <p className="mt-6 text-[12px] font-semibold tracking-[0.01em] text-ink-faint">최근 올라온 글</p>
            <ul className="mt-2 divide-y divide-line-soft border-t border-line-soft">
              {docs
                .filter((d) => d.type === "post")
                .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                .slice(0, 5)
                .map((d) => (
                  <li key={d.id}>
                    <a href={withBase(d.url)} className="group flex items-baseline justify-between gap-4 py-3">
                      <span className="text-[14px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                        {d.title}
                      </span>
                      <span className="dateline shrink-0 text-[12px]">{d.date}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ) : hits.length === 0 ? (
          <div className="py-10">
            <p className="text-[14px] font-semibold text-ink">‘{query.trim()}’ 에 해당하는 결과가 없습니다.</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              단어를 짧게 줄이거나, 띄어 쓴 단어 중 하나를 지워 보세요. 예: ‘5세대 실손’ → ‘실손’
            </p>
          </div>
        ) : isPage && type === "all" ? (
          <div>
            {SECTION_ORDER.map((section) => {
              const list = hits.filter((h) => h.doc.type === section.type);
              if (list.length === 0) return null;
              return (
                <section key={section.type} className="mb-6">
                  <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                    <h2 className="text-[13px] font-bold tracking-[-0.01em] text-ink">{section.label}</h2>
                    <span className="text-[12px] tabular-nums text-ink-faint">{list.length}건</span>
                  </div>
                  <ul className="divide-y divide-line-soft">
                    {list.map((hit) => {
                      const idx = shown.indexOf(hit);
                      return (
                        <HitRow
                          key={hit.doc.id}
                          hit={hit}
                          index={idx}
                          active={active}
                          onHover={setActive}
                          highlight={false}
                        />
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {shown.map((hit, i) => (
              <HitRow
                key={hit.doc.id}
                hit={hit}
                index={i}
                active={active}
                onHover={setActive}
                highlight={!isPage}
              />
            ))}
          </ul>
        )}
      </div>

      {!isPage && query.trim() !== "" && hits.length > 0 && (
        <button
          type="button"
          onClick={() => {
            window.location.assign(withBase("/search"));
          }}
          className="mt-2 inline-flex min-h-[40px] items-center text-[12.5px] font-semibold text-brand link"
        >
          전체 결과 {hits.length}건 보기
        </button>
      )}

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-faint">
        {isPage ? (
          <>
            <span>제목·본문·태그·앱을 함께 찾습니다</span>
            <span>서버 없이 브라우저에서 검색합니다</span>
          </>
        ) : (
          <>
            <span>↑↓ 이동</span>
            <span>Enter 열기</span>
            <span>Esc 닫기</span>
          </>
        )}
      </p>
    </div>
  );
}
