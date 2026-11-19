import CoverageCheck from "./CoverageCheck";
import DisclosureCheck from "./DisclosureCheck";
import SilsonCompare from "./SilsonCompare";
import PensionTax from "./PensionTax";

const MAP: Record<string, (props: { compact?: boolean }) => React.ReactElement> = {
  "coverage-check": CoverageCheck,
  "disclosure-check": DisclosureCheck,
  "silson-compare": SilsonCompare,
  "pension-tax": PensionTax,
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
