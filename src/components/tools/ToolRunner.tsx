import CoverageCheck from "./CoverageCheck";
import DisclosureCheck from "./DisclosureCheck";
import SilsonCompare from "./SilsonCompare";
import PensionTax from "./PensionTax";
import PensionDraw from "./PensionDraw";
import RetirementFlow from "./RetirementFlow";
import CompoundReturn from "./CompoundReturn";
import AccountTaxCompare from "./AccountTaxCompare";
/* v7.3 — 유용한앱 7종. 모두 브라우저 로컬 처리(파일 서버 미전송). */
import ExifMosaic from "../useful/ExifMosaic";
import UrlCleaner from "../useful/UrlCleaner";
import PdfImage from "../useful/PdfImage";
import ImageCompress from "../useful/ImageCompress";
import QrGenerator from "../useful/QrGenerator";
import ImageResize from "../useful/ImageResize";
import Watermark from "../useful/Watermark";

const MAP: Record<string, (props: { compact?: boolean }) => React.ReactElement> = {
  "pension-tax": PensionTax,
  "pension-draw": PensionDraw,
  "retirement-flow": RetirementFlow,
  "compound-return": CompoundReturn,
  "account-tax-compare": AccountTaxCompare,
  "coverage-check": CoverageCheck,
  "disclosure-check": DisclosureCheck,
  "silson-compare": SilsonCompare,
  "exif-mosaic": ExifMosaic,
  "url-cleaner": UrlCleaner,
  "pdf-image": PdfImage,
  "image-compress": ImageCompress,
  "qr-generator": QrGenerator,
  "image-resize": ImageResize,
  watermark: Watermark,
};

export default function ToolRunner({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const Cmp = MAP[slug];
  if (!Cmp) {
    return (
      <div className="rounded-xl border border-line bg-white p-6 text-[13px] text-ink-muted">
        이 도구는 준비 중입니다.
      </div>
    );
  }
  return <Cmp compact={compact} />;
}
