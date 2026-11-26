import { useMemo, useState } from "react";
import { Note, RunnerShell, Toggle } from "./ui";
import { withBase } from "@/config/site";

type QuestionKey = "q3m" | "q2y" | "q5y" | "q10";

type Question = {
  key: QuestionKey;
  label: string;
  description: string;
};

const QUESTIONS: Question[] = [
  {
    key: "q3m",
    label: "최근 3개월 이내 입원·수술·추가검사 소견",
    description: "질병 확정 진단, 의심 소견, 추가(재)검사 필요 소견, 7일 이상 투약 등",
  },
  {
    key: "q2y",
    label: "최근 2년 이내 입원 또는 수술",
    description: "제왕절개 포함. 통원 치료만 받은 경우는 보통 해당하지 않습니다.",
  },
  {
    key: "q5y",
    label: "최근 5년 이내 7일 이상 치료 또는 30일 이상 약 복용",
    description: "입원·수술·통원 치료를 포함해 기간 기준을 넘는 경우",
  },
  {
    key: "q10",
    label: "최근 5년 이내 10대 질병 진단·치료",
    description: "암, 백혈병, 고혈압, 협심증, 심근경색, 심장판막증, 간경화증, 뇌졸중, 당뇨병, 에이즈",
  },
];

type ProductType = "305" | "325" | "355";

/**
 * 간편고지 유형별 질문 구성(일반적 구성).
 * 305는 5년 질문이 '10대 질병'이고, 5년 이내 입원·수술은 상품에 따라 함께 묻기도 한다(약관 확인).
 * 355·325의 5년 질문은 '입원·수술·7일 이상 치료'다.
 */
const PRODUCTS: Record<ProductType, { questions: QuestionKey[]; note: string }> = {
  "305": {
    questions: ["q3m", "q10"],
    note: "2년 이력 질문이 없는 유형 · 5년 이내 입원·수술을 함께 묻는 상품은 약관 확인",
  },
  "325": { questions: ["q3m", "q2y", "q5y"], note: "3개월·2년·5년을 묻는 표준 유형" },
  "355": { questions: ["q3m", "q5y"], note: "2년 대신 5년 기준을 쓰는 유형" },
};

/** 체크한 이력이 실제로 답이 되는 질문 — 2년 이내 입원·수술은 5년 이내 입원·수술(치료) 질문에도 들어간다.
 *  10대 질병 질문(q10)은 별개다. */
const COVERS: Record<QuestionKey, QuestionKey[]> = {
  q3m: ["q3m"],
  q2y: ["q2y", "q5y"],
  q5y: ["q5y"],
  q10: ["q10"],
};

const REASON: Record<QuestionKey, string> = {
  q3m: "3개월 이내 항목",
  q2y: "2년 이내 항목",
  q5y: "5년 이내 입원·수술·치료 항목",
  q10: "5년 이내 10대 질병 항목",
};

export default function DisclosureCheck() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [onMeds, setOnMeds] = useState(false);

  const hits = useMemo(
    () => QUESTIONS.filter((q) => checked[q.key]),
    [checked]
  );

  const result = useMemo(() => {
    const checkedKeys = hits.map((h) => h.key);

    return (Object.keys(PRODUCTS) as ProductType[]).map((p) => {
      const asked = PRODUCTS[p].questions;
      const reasons: string[] = [];
      for (const k of checkedKeys) {
        /* 그 유형이 같은 질문을 직접 하면 그 라벨로, 아니면 이 이력을 담는 질문의 라벨로 적는다.
           (예: 2년 이내 입원·수술 → 355에서는 '5년 이내 입원·수술·치료 항목') */
        const direct = asked.includes(k);
        const covering = direct ? undefined : asked.find((q) => COVERS[k].includes(q));
        const label = direct ? REASON[k] : covering ? REASON[covering] : undefined;
        if (label && !reasons.includes(label)) reasons.push(label);
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
        <p className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-muted">
          심평원 ‘내 진료정보 열람’ 자료가 있다면{" "}
          <a href={withBase("/apps/simpyeong-disclosure/run")} className="font-semibold text-brand-deep link">
            심평원 고지 정리기
          </a>
          가 같은 질문에 근거 줄까지 붙여 정리합니다.
        </p>
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
        상품마다 다르며, 실제 판정은 청약서 질문표와 보험회사 심사에 따릅니다. 2년 이내 입원·수술은 5년 이내
        입원·수술·치료 질문에 포함되지만, 5년 이내 10대 질병 질문과는 별개입니다(305 유형 일부 상품은 5년
        이내 입원·수술도 함께 묻습니다). 고지는 설계사에게 구두로 알리는 것이 아니라 청약서에 직접
        기재해야 효력이 있습니다.
      </Note>
    </RunnerShell>
  );
}
