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
/* v7.3 — 유용한앱 2탄 8종(텍스트·문서·보안·디자인). 모두 브라우저 로컬 처리. */
import TextCounter from "./utils/TextCounter";
import PrivacyMasker from "./utils/PrivacyMasker";
import DataFormatter from "./utils/DataFormatter";
import PasswordGenerator from "./utils/PasswordGenerator";
import DiffChecker from "./utils/DiffChecker";
import ColorExtractor from "./utils/ColorExtractor";
import TextToCard from "./utils/TextToCard";
import UnitDateCalc from "./utils/UnitDateCalc";
/* v7.3 — 유용한앱 3탄 8종(금융·생활 계산). */
import KoreanAgePension from "./utils/KoreanAgePension";
import SalaryNetCalc from "./utils/SalaryNetCalc";
import LoanRepayCalc from "./utils/LoanRepayCalc";
import VatMarginCalc from "./utils/VatMarginCalc";
import RentJeonseCalc from "./utils/RentJeonseCalc";
import SeverancePayCalc from "./utils/SeverancePayCalc";
import DividendTaxCalc from "./utils/DividendTaxCalc";
import HourlyWageCalc from "./utils/HourlyWageCalc";
/* v7.3 — 유용한앱 4탄 4종(업스케일·단축·PDF 병합/추출·세계시계). */
import ImageUpscale from "./utils/ImageUpscale";
import UrlShortener from "./utils/UrlShortener";
import PdfMergeSplit from "./utils/PdfMergeSplit";
import MarketWorldClock from "./utils/MarketWorldClock";

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
  "text-counter": TextCounter,
  "privacy-masker": PrivacyMasker,
  "json-csv-formatter": DataFormatter,
  "password-generator": PasswordGenerator,
  "diff-checker": DiffChecker,
  "color-extractor": ColorExtractor,
  "text-to-card": TextToCard,
  "unit-date-calc": UnitDateCalc,
  "korean-age-pension": KoreanAgePension,
  "salary-net": SalaryNetCalc,
  "loan-repay": LoanRepayCalc,
  "vat-margin": VatMarginCalc,
  "rent-jeonse": RentJeonseCalc,
  "severance-pay": SeverancePayCalc,
  "dividend-tax": DividendTaxCalc,
  "hourly-wage": HourlyWageCalc,
  "image-upscale": ImageUpscale,
  "url-shortener": UrlShortener,
  "pdf-merge-split": PdfMergeSplit,
  "market-world-clock": MarketWorldClock,
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
