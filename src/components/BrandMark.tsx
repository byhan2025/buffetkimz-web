/**
 * 브랜드 록업(React) — React 컴포넌트 안에서 쓰는 자리용.
 * v7.9.0 — 확정 공식 로고(2026-11-22) 이미지를 그대로 쓴다.
 * 파일·비율은 `src/components/BrandLockup.astro`와 같다.
 */
import { withBase } from "@/config/site";

type Props = {
  tone?: "light" | "dark";
  /** en: 영문 / ko: 국문(어두운 바탕 전용) */
  variant?: "en" | "ko";
  className?: string;
  /** 로고 높이(CSS) — 예: "20px" */
  height?: string;
  sizes?: string;
};

export default function BrandMark({
  tone = "dark",
  variant = "en",
  className = "",
  height = "22px",
  sizes = "(max-width: 767px) 240px, 420px",
}: Props) {
  const ko = variant === "ko";
  const file = ko ? "logo-ko-dark" : tone === "dark" ? "logo-en-dark" : "logo-en-light";
  const [W, H] = ko ? [3332, 921] : tone === "dark" ? [3109, 803] : [3342, 883];
  const srcset = [480, 960, 1920]
    .map((w) => `${withBase(`/brand/${file}-tr-${w}.webp`)} ${w}w`)
    .join(", ");

  return (
    <span className={`brand-lockup${className ? ` ${className}` : ""}`} style={{ "--lockup-h": height } as React.CSSProperties}>
      <img
        src={withBase(`/brand/${file}-tr-960.webp`)}
        srcSet={srcset}
        sizes={sizes}
        width={W}
        height={H}
        alt={ko ? "버핏킴즈" : "buffetkimz"}
        decoding="async"
      />
    </span>
  );
}
