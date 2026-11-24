import CoverageCheck from "./CoverageCheck";
import DisclosureCheck from "./DisclosureCheck";
import SilsonCompare from "./SilsonCompare";
import PensionTax from "./PensionTax";
import PensionDraw from "./PensionDraw";
import RetirementFlow from "./RetirementFlow";
import CompoundReturn from "./CompoundReturn";
import AccountTaxCompare from "./AccountTaxCompare";
/* v7.3 — 유용한앱 7종. 모두 브라우저 로컬 처리(파일 서버 미전송). */
import UrlCleaner from "../useful/UrlCleaner";
import PdfImage from "../useful/PdfImage";
import ImageCompress from "../useful/ImageCompress";
import QrGenerator from "../useful/QrGenerator";
/* v7.3 — 유용한앱 2탄 8종(텍스트·문서·보안·디자인). 모두 브라우저 로컬 처리. */
import TextCounter from "./utils/TextCounter";
import PrivacyMasker from "./utils/PrivacyMasker";
import DataFormatter from "./utils/DataFormatter";
import DiffChecker from "./utils/DiffChecker";
import ColorExtractor from "./utils/ColorExtractor";
import TextToCard from "./utils/TextToCard";
import UnitDateCalc from "./utils/UnitDateCalc";
/* v7.3 — 유용한앱 3탄 8종(금융·생활 계산). */
import SalaryNetCalc from "./utils/SalaryNetCalc";
import LoanRepayCalc from "./utils/LoanRepayCalc";
import VatMarginCalc from "./utils/VatMarginCalc";
import RentJeonseCalc from "./utils/RentJeonseCalc";
import SeverancePayCalc from "./utils/SeverancePayCalc";
import DividendTaxCalc from "./utils/DividendTaxCalc";
/* v7.3 — 유용한앱 4탄 4종(업스케일·단축·PDF 병합/추출·세계시계). */
import UrlShortener from "./utils/UrlShortener";
import MarketWorldClock from "./utils/MarketWorldClock";
/* v7.4 — 유용한앱 5탄 12종(로고·부동산·노동·세금·금융 계산). 모두 브라우저 로컬 처리. */
import SvgLogoMaker from "./utils/SvgLogoMaker";
import BrokerageFeeCalc from "./utils/BrokerageFeeCalc";
import AcquisitionTaxCalc from "./utils/AcquisitionTaxCalc";
import SubscriptionScoreCalc from "./utils/SubscriptionScoreCalc";
import HealthPremiumCompare from "./utils/HealthPremiumCompare";
import AnnualLeaveCalc from "./utils/AnnualLeaveCalc";
import UnemploymentCalc from "./utils/UnemploymentCalc";
import OverseasStockTaxCalc from "./utils/OverseasStockTaxCalc";

/**
 * 실행 화면이 있는 도구 → 컴포넌트.
 *
 * v8.8.0 — 흡수된 11종(korean-age-pension · deposit-savings · hourly-wage · freelancer-tax ·
 * image-resize · image-upscale · watermark · exif-mosaic · pdf-merge-split · moving-dday)은
 * 자기 주소를 잃고 통합 도구의 탭으로 들어갔다. 그래서 이 표에서도 빠진다.
 * 옛 주소는 `astro.config.mjs`의 redirects가 통합 도구로 넘긴다.
 * (실무자용 보상분석 가이드는 2026-11-24 전용 도구실로 옮겼다 — 일반 도구 표에는 두지 않는다.)
 */
const MAP: Record<string, (props: { compact?: boolean }) => React.ReactElement> = {
  "pension-tax": PensionTax,
  "pension-draw": PensionDraw,
  "retirement-flow": RetirementFlow,
  "compound-return": CompoundReturn,
  "account-tax-compare": AccountTaxCompare,
  "coverage-check": CoverageCheck,
  "disclosure-check": DisclosureCheck,
  "silson-compare": SilsonCompare,
  "url-cleaner": UrlCleaner,
  "pdf-image": PdfImage,
  "image-compress": ImageCompress,
  "qr-generator": QrGenerator,
  "text-counter": TextCounter,
  "privacy-masker": PrivacyMasker,
  "json-csv-formatter": DataFormatter,
  "diff-checker": DiffChecker,
  "color-extractor": ColorExtractor,
  "text-to-card": TextToCard,
  "unit-date-calc": UnitDateCalc,
  "salary-net": SalaryNetCalc,
  "loan-repay": LoanRepayCalc,
  "vat-margin": VatMarginCalc,
  "rent-jeonse": RentJeonseCalc,
  "severance-pay": SeverancePayCalc,
  "dividend-tax": DividendTaxCalc,
  "url-shortener": UrlShortener,
  "market-world-clock": MarketWorldClock,
  "svg-logo-maker": SvgLogoMaker,
  "brokerage-fee": BrokerageFeeCalc,
  "acquisition-tax": AcquisitionTaxCalc,
  "subscription-score": SubscriptionScoreCalc,
  "health-insurance-compare": HealthPremiumCompare,
  "annual-leave": AnnualLeaveCalc,
  "unemployment-benefit": UnemploymentCalc,
  "overseas-stock-tax": OverseasStockTaxCalc,
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
