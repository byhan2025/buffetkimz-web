import { useEffect, useMemo, useRef, useState } from "react";
import { withBase } from "@/config/site";
import { searchDocs, rememberQuery, splitHighlight, typeLabels, type SearchDoc, type SearchHit } from "../lib/search";

let inlineCache: SearchDoc[] | null = null;

async function loadInlineIndex(): Promise<SearchDoc[]> {
  if (inlineCache) return inlineCache;
  try {
    const res = await fetch(withBase("/search-index.json"), { headers: { accept: "application/json" } });
    const data: { docs: SearchDoc[] } = await res.json();
    inlineCache = data.docs;
    return inlineCache;
  } catch {
    return [];
  }
}

function Hi({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {splitHighlight(text, terms).map((p, i) =>
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

/**
 * 첫 화면의 검색 입력. 입력하는 즉시 결과를 아래에 보여 주고,
 * 제출하면 /search 로 넘어간다.
 */
export default function SearchInline({ placeholder }: { placeholder?: string }) {
  const [value, setValue] = useState("");
  const [docs, setDocs] = useState<SearchDoc[] | null>(inlineCache);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadInlineIndex().then(setDocs);
  }, []);

  const hits: SearchHit[] = useMemo(() => {
    if (!docs || value.trim() === "") return [];
    return searchDocs(docs, value).slice(0, 5);
  }, [docs, value]);

  useEffect(() => {
    setActive(-1);
  }, [value]);

  return (
    <div
      ref={boxRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form
        action={withBase("/search")}
        method="get"
        role="search"
        onSubmit={(e) => {
          /* 검색어를 주소로 넘기지 않는다 — 같은 탭 메모리로만 건넨다. */
          e.preventDefault();
          rememberQuery(value);
          window.location.assign(withBase("/search"));
        }}
      >
        <label htmlFor="hero-search" className="sr-only">
          사이트 안에서 검색
        </label>
        <input
          id="hero-search"
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              window.location.assign(hits[active].doc.url);
            }
          }}
          placeholder={placeholder ?? "찾고 싶은 것 — 연금, 실손, 5세대"}
          className="search-field"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && value.trim() !== ""}
          aria-controls="hero-search-results"
        />
        <button
          type="submit"
          aria-label="검색"
          className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink transition-colors hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="11" cy="11" r="6.4" />
            <path d="m16 16 4.2 4.2" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      {open && value.trim() !== "" && (
        <div
          id="hero-search-results"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[64vh] overflow-y-auto border border-ink bg-surface shadow-[0_18px_40px_-24px_rgba(25,22,18,0.55)]"
        >
          {docs === null ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-faint">검색 인덱스를 불러오는 중…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-muted">일치하는 결과가 없습니다. 단어를 줄여 보세요.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {hits.map((hit, i) => (
                <li key={hit.doc.id}>
                  <a
                    href={withBase(hit.doc.url)}
                    onMouseEnter={() => setActive(i)}
                    className={`block px-4 py-3 ${i === active ? "bg-paper-deep" : ""}`}
                  >
                    <span className="text-[12px] font-semibold text-brand">{typeLabels[hit.doc.type]}</span>
                    {hit.doc.group && <span className="ml-1.5 text-[12px] text-ink-faint">{hit.doc.group}</span>}
                    <span className="mt-0.5 block text-[13.5px] font-semibold leading-snug text-ink">
                      <Hi text={hit.doc.title} terms={hit.terms} />
                    </span>
                    <span className="clamp-1 mt-0.5 block text-[12px] leading-snug text-ink-muted">
                      <Hi text={hit.snippet} terms={hit.terms} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a
            href={withBase("/search")}
            onClick={() => rememberQuery(value)}
            className="flex min-h-[44px] items-center justify-between border-t border-line px-4 text-[12px] font-semibold text-ink-soft hover:text-ink"
          >
            전체 결과 보기
            <span className="text-ink-faint">{hits.length}건</span>
          </a>
        </div>
      )}
    </div>
  );
}
