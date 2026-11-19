import { useMemo, useState } from "react";
import { Note, RunnerShell, Toggle } from "./ui";

type Question = {
  key: string;
  label: string;
  description: string;
  months: 3 | 24 | 60 | 0;
};

const QUESTIONS: Question[] = [
  {
    key: "q3m",
    months: 3,
    label: "최근 3개월 이내 입원·수술·추가검사 소견",
    description: "질병 확정 진단, 의심 소견, 추가(재)검사 필요 소견, 7일 이상 투약 등",
  },
  {
    key: "q2y",
    months: 24,
    label: "최근 2년 이내 입원 또는 수술",
    description: "제왕절개 포함. 통원 치료만 받은 경우는 보통 해당하지 않습니다.",
  },
  {
    key: "q5y",
    months: 60,
    label: "최근 5년 이내 7일 이상 치료 또는 30일 이상 약 복용",
    description: "입원·수술·통원 치료를 포함해 기간 기준을 넘는 경우",
  },
  {
    key: "q10",
    months: 60,
    label: "최근 5년 이내 10대 질병 진단·치료",
    description: "암, 백혈병, 고혈압, 협심증, 심근경색, 심장판막증, 간경화증, 뇌졸중, 당뇨병, 에이즈",
  },
];

type ProductType = "305" | "325" | "355";

/** 간편고지 유형별 질문 구성(일반적 구성): 3개월 / 2년 / 5년 */
const PRODUCTS: Record<ProductType, { months: (3 | 24 | 60)[]; note: string }> = {
  "305": { months: [3, 60], note: "2년 이력 질문이 없는 유형" },
  "325": { months: [3, 24, 60], note: "3개월·2년·5년을 묻는 표준 유형" },
  "355": { months: [3, 60], note: "2년 대신 5년 기준을 쓰는 유형" },
};

export default function DisclosureCheck() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [onMeds, setOnMeds] = useState(false);

  const hits = useMemo(
    () => QUESTIONS.filter((q) => checked[q.key]),
    [checked]
  );

  const result = useMemo(() => {
    const has3m = hits.some((h) => h.months === 3);
    const has24 = hits.some((h) => h.months === 24);
    const has60 = hits.some((h) => h.months === 60);
    /* 2년 이내 입원·수술은 5년 기준에도 들어간다 — 2년 질문이 없는 유형(305·355)에서도
       같은 이력이 '해당 없음'으로 뒤집히지 않도록 5년 판정에 함께 넣는다. */

    return (Object.keys(PRODUCTS) as ProductType[]).map((p) => {
      const asked = PRODUCTS[p].months;
      const reasons: string[] = [];
      if (has3m && asked.includes(3)) reasons.push("3개월 이내 항목");
      if (has24 && asked.includes(24)) reasons.push("2년 이내 항목");
      if (asked.includes(60)) {
        if (has60) reasons.push("5년 이내 항목");
        else if (has24 && !asked.includes(24)) reasons.push("2년 이내 입원·수술(5년 기준 포함)");
      }
      return { type: p, asked, reasons, flagged: reasons.length > 0 };
    });
  }, [hits]);

  const documents = [
    "진단서 또는 진료확인서",
    "입·퇴원확인서",
    "수술확인서",
    "처방전·약제비 영수증",
    "건강검진 결과지",
  ];

  const flaggedCount = result.filter((r) => r.flagged).length;

  return (
    <RunnerShell
      title="고지 항목 자가체크"
      subtitle="최근 이력을 기준 기간에 대입해, 가입 전에 확인할 항목을 정리합니다."
      example="해당되는 이력을 체크해 보세요. 아무것도 고르지 않은 상태로 시작합니다."
    >
      <div className="space-y-2">
        {QUESTIONS.map((q) => (
          <Toggle
            key={q.key}
            label={q.label}
            description={q.description}
            checked={Boolean(checked[q.key])}
            onChange={(v) => setChecked((prev) => ({ ...prev, [q.key]: v }))}
          />
        ))}
        <Toggle
          label="현재 복용 중인 약이 있다"
          description="복용 자체가 고지 대상은 아닙니다. 다만 질환·치료 이력 확인에 참고가 됩니다."
          checked={onMeds}
          onChange={setOnMeds}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {result.map((r) => (
          <div
            key={r.type}
            className={
              "rounded-xl border p-4 " +
              (r.flagged ? "border-[#e2c9cf] bg-[#fbf4f5]" : "border-[#d5e4dc] bg-[#f4f9f6]")
            }
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">{r.type}</p>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[12px] font-bold " +
                  (r.flagged ? "bg-[#a8455c] text-white" : "bg-[#2f8f6f] text-white")
                }
              >
                {r.flagged ? "고지 대상" : "해당 없음"}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-muted">{PRODUCTS[r.type].note}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
              {r.flagged
                ? r.reasons.join(" · ") + "에 해당합니다."
                : "선택한 이력 중 이 유형의 질문에 걸리는 항목이 없습니다."}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">가입 전 준비 서류</p>
          <ul className="mt-2 space-y-1.5">
            {documents.map((d) => (
              <li key={d} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                <span className="h-1 w-1 rounded-full bg-ink-faint" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">확인 결과</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {flaggedCount === 0
              ? "선택한 이력이 없습니다. 그래도 청약서 질문표를 직접 읽고 답해야 합니다."
              : `3개 유형 중 ${flaggedCount}개에서 고지 대상 항목이 확인됐습니다.`}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {onMeds
              ? "복용 중인 약이 있다면 약 이름과 처방 사유를 메모해 두세요. 가입 절차에서 질환 분류를 확인합니다."
              : "복용 중인 약이 없다면 처방 이력만 확인하면 됩니다."}
          </p>
        </div>
      </div>

      <Note>
        이 도구는 <strong>가입 가능 여부를 판정하지 않습니다.</strong> 간편고지 유형별 질문 구성은 보험회사
        상품마다 다르며, 실제 판정은 청약서 질문표와 보험회사 심사에 따릅니다. 고지는 설계사에게 구두로
        알리는 것이 아니라 청약서에 직접 기재해야 효력이 있습니다.
      </Note>
    </RunnerShell>
  );
}
