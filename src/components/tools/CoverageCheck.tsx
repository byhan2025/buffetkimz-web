import { useMemo, useState } from "react";
import {
  COVERAGE_BASIS,
  COVERAGE_BASIS_LABEL,
  COVERAGE_EXAMPLE,
  COVERAGE_LABEL,
  COVERAGE_NOTE,
  BAND_LABEL,
  type CoverageBand,
} from "../../lib/coverage";
import {
  Bar,
  MoneySlider,
  Note,
  ResultStat,
  RunnerShell,
  Segmented,
  StickySummary,
  formatMan,
} from "./ui";

type Band = CoverageBand;

const BASIS = COVERAGE_BASIS;

type Row = {
  key: string;
  name: string;
  need: number;
  have: number;
  unit?: string;
  desc: string;
};

/* 홈 미리보기·도해와 같은 3상태 라벨을 쓴다 — "충족"은 보장 충분 판정으로 읽힌다. */
function judge(ratio: number) {
  if (ratio >= 1) return { label: COVERAGE_LABEL.ok, cls: "text-jade", tone: "jade" as const };
  if (ratio >= 0.7) return { label: COVERAGE_LABEL.review, cls: "text-[#7a5c17]", tone: "brand" as const };
  return { label: COVERAGE_LABEL.check, cls: "text-[#a8455c]", tone: "rose" as const };
}

export default function CoverageCheck({ compact = false }: { compact?: boolean }) {
  const [band, setBand] = useState<Band>(COVERAGE_EXAMPLE.band);
  const [cancer, setCancer] = useState(COVERAGE_EXAMPLE.cancer);
  const [brain, setBrain] = useState(COVERAGE_EXAMPLE.brain);
  const [heart, setHeart] = useState(COVERAGE_EXAMPLE.heart);
  const [surgIll, setSurgIll] = useState(COVERAGE_EXAMPLE.surgIll);
  const [surgInj, setSurgInj] = useState(COVERAGE_EXAMPLE.surgInj);
  const [nursing, setNursing] = useState(COVERAGE_EXAMPLE.nursing);

  /* 첫 화면은 예시 값이다. 증권을 보며 바꾼 뒤 언제든 되돌릴 수 있게 둔다. */
  const resetExample = () => {
    setBand(COVERAGE_EXAMPLE.band);
    setCancer(COVERAGE_EXAMPLE.cancer);
    setBrain(COVERAGE_EXAMPLE.brain);
    setHeart(COVERAGE_EXAMPLE.heart);
    setSurgIll(COVERAGE_EXAMPLE.surgIll);
    setSurgInj(COVERAGE_EXAMPLE.surgInj);
    setNursing(COVERAGE_EXAMPLE.nursing);
  };

  const basis = BASIS[band];

  const rows: Row[] = useMemo(
    () => [
      {
        key: "cancer",
        name: "암 진단비",
        need: basis.cancer,
        have: cancer,
        desc: "진단 확정 시 지급. 유사암·소액암은 별도 한도인 경우가 많습니다.",
      },
      {
        key: "brain",
        name: "뇌혈관 진단비",
        need: basis.brain,
        have: brain,
        desc: "뇌졸중·뇌출혈 등. 후유장해 보장이 따로 있는지 확인합니다.",
      },
      {
        key: "heart",
        name: "심장 진단비",
        need: basis.heart,
        have: heart,
        desc: "급성심근경색·협심증 등. 수술비와 분리되어 있는지 봅니다.",
      },
      {
        key: "surgIll",
        name: "질병 수술비",
        need: basis.surgIll,
        have: surgIll,
        desc: "질병으로 인한 수술. 1~5종 분류에 따라 금액이 다릅니다.",
      },
      {
        key: "surgInj",
        name: "상해 수술비",
        need: basis.surgInj,
        have: surgInj,
        desc: "상해로 인한 수술. 질병 수술비와 별도 구성이어야 합니다.",
      },
      {
        key: "nursing",
        name: "간병비 일당",
        need: basis.nursing,
        have: nursing,
        desc: "요양병원 입원이 포함되는지, 총 지급 한도가 얼마인지 확인합니다.",
      },
    ],
    [basis, cancer, brain, heart, surgIll, surgInj, nursing]
  );

  const evaluated = rows.map((r) => {
    const ratio = r.need === 0 ? 1 : r.have / r.need;
    return { ...r, ratio, ...judge(ratio) };
  });

  const okCount = evaluated.filter((r) => r.ratio >= 1).length;
  const priorities = [...evaluated].filter((r) => r.ratio < 1).sort((a, b) => a.ratio - b.ratio);

  const shown = compact ? evaluated.slice(0, 3) : evaluated;

  return (
    <RunnerShell
      title="보장 점검 시뮬레이터"
      subtitle={`${BAND_LABEL[band]} 기준점 대비 내 담보를 비교합니다.`}
      example="증권에 적힌 가입금액으로 바꿔 보세요."
    >
      <div className="flex justify-end border-b border-line-soft py-2">
        <button
          type="button"
          onClick={resetExample}
          className="min-h-[44px] shrink-0 text-[12px] font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          예시 값으로 되돌리기
        </button>
      </div>
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <Segmented
          label="연령대"
          value={band}
          onChange={setBand}
          options={[
            { value: "30", label: "30대" },
            { value: "40", label: "40대" },
            { value: "50", label: "50대" },
            { value: "60", label: "60대 이상" },
          ]}
          hint="기준점이 연령대별로 달라집니다."
        />
        <MoneySlider label="암 진단비" value={cancer} onChange={setCancer} min={0} max={10000} step={500} />
        <MoneySlider label="뇌혈관 진단비" value={brain} onChange={setBrain} min={0} max={5000} step={100} />
        <MoneySlider label="심장 진단비" value={heart} onChange={setHeart} min={0} max={5000} step={100} />
        <MoneySlider label="질병 수술비" value={surgIll} onChange={setSurgIll} min={0} max={1000} step={50} />
        <MoneySlider label="상해 수술비" value={surgInj} onChange={setSurgInj} min={0} max={1000} step={50} />
        <MoneySlider
          label="간병비 일당"
          value={nursing}
          onChange={setNursing}
          min={0}
          max={20}
          step={1}
          format={(v) => `${v}만원/일`}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ResultStat label="기준 도달 담보" value={`${okCount} / ${evaluated.length}`} tone="jade" sub="예시 기준점 이상" />
        <ResultStat
          label={COVERAGE_LABEL.check}
          value={`${priorities.length}개`}
          tone={priorities.length > 0 ? "brand" : "jade"}
          sub={priorities.length > 0 ? priorities[0].name + "부터" : "기준점을 채웠습니다"}
        />
        <ResultStat
          label="암 보장 격차"
          value={cancer >= basis.cancer ? "없음" : formatMan(basis.cancer - cancer)}
          sub={`기준 ${formatMan(basis.cancer)} / 보유 ${formatMan(cancer)}`}
        />
      </div>

      {/* 결과 숫자 바로 아래에 두는 단순 비교 고지 — 판정으로 읽히지 않게 */}
      <p className="mt-2 rounded-lg bg-paper-deep/70 px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
        {COVERAGE_NOTE}
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <caption className="sr-only">담보별 기준점과 보유 금액 비교</caption>
          <thead>
            <tr className="border-b border-line bg-paper-deep text-left">
              <th scope="col" className="w-[42%] px-2 py-2.5 font-semibold text-ink-soft sm:w-[34%] sm:px-3">
                담보
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right font-semibold text-ink-soft sm:table-cell sm:w-[22%]"
              >
                필요
              </th>
              <th
                scope="col"
                className="w-[29%] px-2 py-2.5 text-right font-semibold text-ink-soft sm:w-[22%] sm:px-3"
              >
                보유
              </th>
              <th
                scope="col"
                className="w-[29%] px-2 py-2.5 text-right font-semibold text-ink-soft sm:w-[22%] sm:px-3"
              >
                비교
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="border-b border-line-soft last:border-0">
                <td className="px-2 py-2.5 sm:px-3">
                  <span className="font-semibold text-ink">{r.name}</span>
                  {/* 좁은 화면에서는 '필요' 열 대신 이름 아래에 한 줄로 둔다 */}
                  <span className="mt-0.5 block text-[12px] tabular-nums text-ink-muted sm:hidden">
                    필요 {r.key === "nursing" ? `${r.need}만/일` : formatMan(r.need)}
                  </span>
                  <div className="mt-1.5 w-full sm:w-28">
                    <Bar ratio={r.ratio} tone={r.tone} />
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-muted sm:table-cell">
                  {r.key === "nursing" ? `${r.need}만/일` : formatMan(r.need)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums text-ink sm:px-3">
                  {r.key === "nursing" ? `${r.have}만/일` : formatMan(r.have)}
                </td>
                <td className={`px-2 py-2.5 text-right font-bold ${r.cls} sm:px-3`}>{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {compact && (
          <p className="border-t border-line-soft px-3 py-2 text-[12px] text-ink-faint">
            전체 6개 담보는 도구 실행 화면에서 확인할 수 있습니다.
          </p>
        )}
      </div>

      {!compact && priorities.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">우선 확인 순서</p>
          <ol className="mt-2 space-y-1.5">
            {priorities.slice(0, 3).map((r, i) => (
              <li key={r.key} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paper-deep text-[12px] font-bold text-ink-muted">
                  {i + 1}
                </span>
                <span>
                  <strong className="font-semibold text-ink">{r.name}</strong> — {r.desc}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!compact && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4" data-coverage-guide>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">5대 담보 기준 가이드</p>
            <span className="chip !min-h-[24px] !px-2 !text-[11px]">확인 순서 고정</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            담보는 이름을 나열하는 것보다 확인 순서를 정해 두는 편이 빠뜨리지 않습니다 —
            <strong className="font-semibold text-ink"> 암 → 뇌혈관 → 심장 → 수술비(질병·상해) → 간병비</strong>.
            아래 표는 위 계산에 쓰인 기준점을 연령대별로 한 번에 보여 줍니다.
          </p>
          <ol className="mt-3 space-y-1.5">
            {[
              "암 진단비 — 진단 확정 시 지급. 유사암·소액암은 한도가 따로인 경우가 많습니다.",
              "뇌혈관 진단비 — 뇌졸중·뇌출혈 등. 후유장해 보장이 따로 있는지 봅니다.",
              "심장 진단비 — 급성심근경색·협심증 등. 수술비와 분리되어 있는지 봅니다.",
              "수술비 — 질병과 상해가 별도 구성인지, 1~5종 분류가 어떻게 붙었는지 봅니다.",
              "간병비 일당 — 요양병원 입원이 포함되는지, 총 지급 한도가 얼마인지 봅니다.",
            ].map((line, i) => (
              <li key={line} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paper-deep text-[11px] font-bold text-ink-muted">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full border-collapse text-[12px]">
              <caption className="sr-only">연령대별 5대 담보 기준점</caption>
              <thead>
                <tr className="border-b border-line bg-paper-deep text-left">
                  <th scope="col" className="px-2.5 py-2 font-semibold text-ink-soft">담보</th>
                  {["30", "40", "50", "60"].map((b) => (
                    <th key={b} scope="col" className="px-2.5 py-2 text-right font-semibold text-ink-soft">
                      {BAND_LABEL[b as Band]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "cancer", name: "암 진단비", unit: "만원" },
                  { key: "brain", name: "뇌혈관 진단비", unit: "만원" },
                  { key: "heart", name: "심장 진단비", unit: "만원" },
                  { key: "surgIll", name: "질병 수술비", unit: "만원" },
                  { key: "surgInj", name: "상해 수술비", unit: "만원" },
                  { key: "nursing", name: "간병비 일당", unit: "만원/일" },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-line-soft last:border-0">
                    <td className="px-2.5 py-2 font-semibold text-ink">{row.name}</td>
                    {(["30", "40", "50", "60"] as Band[]).map((b) => {
                      const v = COVERAGE_BASIS[b][row.key as keyof (typeof COVERAGE_BASIS)[Band]];
                      return (
                        <td key={b} className={`px-2.5 py-2 text-right tabular-nums ${b === band ? "font-bold text-brand" : "text-ink-muted"}`}>
                          {formatMan(v)}
                          {row.unit === "만원/일" ? "/일" : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            기준점은 {COVERAGE_BASIS_LABEL}입니다. 담보 이름이 같아도 가입 시기·상품·특약에 따라 지급 조건이
            다르므로, 표는 판정이 아니라 확인의 출발선입니다.
          </p>
          <p className="mt-2">
            <a
              href="https://byhan2025.github.io/bojang-counsel-guide/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-brand-deep link"
            >
              상담 자리에서 기록하는 5대 담보 확인 가이드 열기 →
            </a>
          </p>
        </div>
      )}

      <StickySummary
        items={[
          { label: "기준점 충족", value: `${okCount} / ${evaluated.length}` },
          { label: "먼저 볼 항목", value: priorities[0]?.name ?? "없음" },
        ]}
      />

      <Note>
        기준점은 참고용 내부 예시 기준(공식 약관·보험사 기준 아님)으로, 5대 담보를 소비자용으로
        단순화한 값입니다. 가입 시기·상품·특약에 따라 지급 조건이 다르므로, 이 결과는
        <strong>가입 판정이 아니라 확인할 항목</strong>입니다.
      </Note>
    </RunnerShell>
  );
}
