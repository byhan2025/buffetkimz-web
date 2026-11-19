import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SearchApp from "./SearchApp";

/**
 * 헤더의 검색 버튼 + 전체 화면 검색 오버레이.
 *
 * 페이지 안의 `data-search-query` 요소(태그·첫 화면 검색 버튼)를 누르면
 * 이 오버레이가 열리고, 그 값은 컴포넌트 메모리로만 건네진다.
 * 저장소(브라우저 저장소 등)·주소창·서버 어디에도 검색어를 남기지 않는다.
 */
export default function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("");
  /** 같은 태그를 다시 눌러도 새 검색어로 시작하도록 오버레이를 다시 마운트하는 열쇠 */
  const [seedKey, setSeedKey] = useState(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* 페이지 안의 검색 진입점 — 첫 화면 검색 버튼, 글의 태그 */
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail ?? "";
      setSeed(typeof detail === "string" ? detail : "");
      setSeedKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener("buffetkimz:open-search", onOpen as EventListener);
    return () => window.removeEventListener("buffetkimz:open-search", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 px-1 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        aria-label="사이트 검색 열기"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="11" cy="11" r="6.4" />
          <path d="m16 16 4.2 4.2" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">검색</span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="사이트 검색"
            className="fixed inset-0 z-[70] overflow-y-auto bg-paper"
          >
            <div className="wrap pb-16 pt-4">
              <div className="flex items-center justify-between border-b border-ink pb-3">
                <span className="serif text-[21px] tracking-[-0.01em] text-ink">buffetkimz</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink"
                >
                  닫기
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="mx-auto mt-8 max-w-[720px]">
                <SearchApp key={seedKey} variant="overlay" initialQuery={seed} onClose={() => setOpen(false)} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
