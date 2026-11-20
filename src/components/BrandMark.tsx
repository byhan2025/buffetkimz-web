/**
 * 브랜드 록업(React) — 1P 브랜드 필름처럼 React 컴포넌트 안에서 쓰는 자리용.
 * 도형·비율·색은 src/components/BrandLockup.astro와 같다(시안 A · 서표/인덱스 탭).
 */
type Props = {
  tone?: "light" | "dark";
  className?: string;
  /** 워드마크 글자 크기. 생략하면 부모 font-size(1em)를 따른다 */
  size?: string;
  wordmark?: boolean;
};

export default function BrandMark({ tone = "dark", className = "", size, wordmark = true }: Props) {
  const style = size ? ({ "--lockup-size": size } as React.CSSProperties) : undefined;
  return (
    <span className={`brand-lockup${tone === "dark" ? " is-dark" : ""}${className ? ` ${className}` : ""}`} style={style}>
      <svg className="brand-lockup__symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path className="brand-lockup__ink" d="M3.9 2H13.9V22L8.9 16.2 3.9 22Z" />
        <rect className="brand-lockup__tab" x="13.9" y="5.8" width="6.4" height="2.8" rx="1.4" />
      </svg>
      {wordmark && <span className="brand-lockup__word serif">buffetkimz</span>}
    </span>
  );
}
