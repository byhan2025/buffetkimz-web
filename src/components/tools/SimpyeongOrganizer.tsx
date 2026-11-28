/**
 * 심평원 고지 정리기 — 실행 화면 (2026-11-26)
 *
 * 심평원 '내 진료정보 열람' 자료(기본진료·세부진료·처방조제)를 브라우저에서만 읽어
 * ① 입원·수술·마취·투약·통원을 자동으로 나누고
 * ② 고지 문항(3개월·1년·2년·5년)에 걸리는 항목을 정리하고
 * ③ 심사용 요약문 복사, 단독 HTML 레포트 저장, 카톡 안내 문구 복사를 내놓는다.
 *
 * 파일은 어디로도 전송되지 않는다(엔진에도 통신 코드가 없다).
 * 같은 엔진을 InsureCRM(`apps/insure-crm`)이 고객 화면에서 함께 쓴다.
 */
import { useMemo, useState } from "react";
import {
  Btn,
  Dropzone,
  Label,
  LocalNote,
  Panel,
  PanelTitle,
  Select,
  TextInput,
  UtilityShell,
  copyText,
  downloadBlob,
  todayStamp,
} from "../useful/kit";
import { ModeTabs, useMode } from "./ModeTabs";
import DisclosureCheck from "./DisclosureCheck";
import { withBase } from "@/config/site";
import {
  EXAMPLE_TABLES,
  analyze,
  buildCustomerMessage,
  buildReportHTML,
  buildSummary,
  dotDate,
  todayISO,
} from "../../lib/simpyeong/engine.js";
import { readSimpyeongFiles } from "../../lib/simpyeong/read-files";

type Mode = "file" | "check";
const MODES = ["file", "check"] as const;

type Table = { name: string; rows: string[][] };
type Result = ReturnType<typeof analyze>;

const REVIEW_TYPES = [
  { value: "일반심사(표준 계약 전 알릴 의무)", label: "일반심사 · 표준 계약 전 알릴 의무" },
  { value: "간편심사(3개월·2년·5년)", label: "간편심사 · 3개월·2년·5년 질문" },
  { value: "간편심사(3개월·5년)", label: "간편심사 · 3개월·5년 질문" },
  { value: "재심사·추가심사", label: "재심사·추가심사" },
];

const SECTION_LABELS: { key: string; label: string }[] = [
  { key: "inpatient", label: "입원" },
  { key: "surgery", label: "수술·마취" },
  { key: "recent3m", label: "3개월 이내" },
  { key: "meds", label: "투약" },
  { key: "notable", label: "주의 병명" },
  { key: "frequent", label: "7회 이상 통원" },
  { key: "q", label: "고지 문항" },
];

const QUESTION_TEXT: { no: number; short: string; text: string; note?: string }[] = [
  {
    no: 1,
    short: "3개월",
    text: "최근 3개월 이내 진찰·검사로 질병 진단, 질병의심소견, 치료·입원·수술·투약을 받은 사실",
    note: "3개월 전에 처방받아 아직 복용 중인 약도 포함합니다.",
  },
  { no: 2, short: "1년", text: "최근 1년 이내 재검사(추가검사)를 받은 사실", note: "자료에 재검사 표기가 없으면 '해당 없음'이 아니라 직접 확인으로 봅니다." },
  { no: 3, short: "2년", text: "최근 2년 이내 입원·수술을 받은 사실" },
  { no: 4, short: "5년", text: "최근 5년 이내 7일 이상 치료 또는 30일 이상 약 복용" },
  { no: 5, short: "10대 질병", text: "최근 5년 이내 10대 질병 진단·치료", note: "암, 백혈병, 고혈압, 협심증, 심근경색, 심장판막증, 간경화증, 뇌졸중, 당뇨병, 에이즈" },
];

function lineOf(rec: Record<string, unknown>, base: string, extra?: string) {
  const parts = [dotDate(String(rec.date || "")), String(rec.hospital || ""), String(rec.dept || "")];
  const disease = [rec.code, rec.name].filter(Boolean).join(" ");
  if (disease) parts.push(disease);
  parts.push(extra || String(rec.visit || ""));
  return parts.filter(Boolean).join(" / ");
}

function won(n: number) {
  return n.toLocaleString("ko-KR");
}

export default function SimpyeongOrganizer({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useMode<Mode>("file", MODES);
  return (
    <div data-merged-tool="simpyeong-disclosure">
      {/* 2026-11-27 — 자료를 받기 전에 동의서를 먼저 받도록 실행 화면 맨 위에서 안내한다. */}
      <div
        data-consent-gate="1"
        className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand/25 bg-brand-soft/60 px-3.5 py-2.5"
      >
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          진료자료를 받기 전에{" "}
          <a href={withBase("/apps/disclosure-consent/run")} className="font-semibold text-brand-deep link">
            진료자료 활용 동의서
          </a>
          로 목적·보관기간을 확인하고 서명을 먼저 받으세요.
        </p>
        <span className="text-[11.5px] text-ink-faint">안전 5대 약속 포함</span>
      </div>
      <ModeTabs
        label="고지 정리 방법"
        value={mode}
        onChange={setMode}
        options={[
          { value: "file", label: "심평원 자료로 정리" },
          { value: "check", label: "이력 자가체크" },
        ]}
        note="자료가 있으면 자동으로 나누고, 없으면 질문에 체크해 확인 항목만 골라도 됩니다."
      />
      <div hidden={mode !== "file"}>
        <SimpyeongPane compact={compact} />
      </div>
      <div hidden={mode !== "check"}>
        <DisclosureCheck />
      </div>
    </div>
  );
}

function SimpyeongPane({ compact = false }: { compact?: boolean }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isExample, setIsExample] = useState(false);

  const [customer, setCustomer] = useState("");
  const [birth, setBirth] = useState("");
  const [baseDate, setBaseDate] = useState(todayISO());
  const [reviewType, setReviewType] = useState(REVIEW_TYPES[0].value);
  const [surgeryThreshold, setSurgeryThreshold] = useState("200000");
  const [totalThreshold, setTotalThreshold] = useState("1000000");
  const [sections, setSections] = useState<string[]>(SECTION_LABELS.map((s) => s.key));
  const [highlightQ, setHighlightQ] = useState<number | null>(null);
  const triggerHighlight = (no: number) => {
    setHighlightQ(no);
    window.setTimeout(() => setHighlightQ((cur) => (cur === no ? null : cur)), 1400);
  };
  const [copied, setCopied] = useState<"" | "summary" | "message">("");

  const result: Result | null = useMemo(() => {
    if (!tables.length) return null;
    return analyze(tables, {
      baseDate,
      customer,
      birth,
      reviewType,
      surgeryThreshold: Number(surgeryThreshold) || 0,
      totalThreshold: Number(totalThreshold) || 0,
    });
  }, [tables, baseDate, customer, birth, reviewType, surgeryThreshold, totalThreshold]);

  const reset = () => {
    setTables([]);
    setFileNames([]);
    setStatus("");
    setError("");
    setIsExample(false);
    setCopied("");
  };

  const loadExample = () => {
    setError("");
    setIsExample(true);
    setFileNames(["기본진료정보(예시)", "세부진료정보(예시)", "처방조제정보(예시)"]);
    setTables(EXAMPLE_TABLES(baseDate) as Table[]);
    setStatus("예시 데이터로 채웠습니다. 실제 파일을 올리면 이 내용이 바뀝니다.");
  };

  const onFiles = async (files: File[]) => {
    setError("");
    setCopied("");
    setIsExample(false);
    setBusy(true);
    setStatus("파일 읽는 중");
    try {
      const { tables: read, skipped, error: readError } = await readSimpyeongFiles(files, setStatus);
      if (readError) setError(readError);
      if (skipped.length) setError(`읽지 못한 형식: ${skipped.join(", ")} (엑셀·CSV·PDF만 됩니다)`);
      if (!read.length) {
        setStatus("");
        return;
      }
      setTables(read);
      setFileNames(read.map((t) => t.name));
      setStatus(`${read.length}개 표를 읽었습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const summary = result ? buildSummary(result, sections) : "";
  const message = result ? buildCustomerMessage(result, {}) : "";

  const doCopy = async (kind: "summary" | "message") => {
    const ok = await copyText(kind === "summary" ? summary : message);
    setCopied(ok ? kind : "");
    if (!ok) setError("복사가 막힌 브라우저입니다. 글상자에서 직접 선택해 복사해 주세요.");
    window.setTimeout(() => setCopied(""), 2200);
  };

  const saveReport = () => {
    if (!result) return;
    const html = buildReportHTML(result, {});
    const who = customer.trim() || "고객";
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `심평원-고지정리-${who}-${todayStamp()}.html`);
  };

  const cards = result ? result.cards : [];
  const showCards = compact ? cards.slice(0, 6) : cards;

  return (
    <UtilityShell
      title="심평원 고지 정리기"
      subtitle="기본진료, 세부진료, 처방조제를 한 번에 올리면 입원과 수술, 마취, 투약, 통원을 나눠 고지 문항에 맞춰 정리합니다."
      steps={["자료 올리기", "자동 분류", "요약문·레포트"]}
    >
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-3">
          <Panel>
            <PanelTitle
              right={
                isExample ? (
                  <span className="chip !min-h-[24px] !border-transparent !bg-[#fbf3e4] !px-2 !text-[11.5px] !text-[#8a6320]">
                    예시 데이터
                  </span>
                ) : undefined
              }
            >
              자료 올리기
            </PanelTitle>
            <Dropzone
              accept=".xlsx,.xls,.xlsm,.csv,.pdf,.txt"
              multiple
              onFiles={onFiles}
              title="파일을 끌어다 놓기"
              hint="여러 개를 한 번에 올려도 됩니다. 엑셀(xlsx·xls), CSV, PDF"
              compact={compact}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn tone="secondary" small onClick={loadExample} disabled={busy}>
                예시 데이터로 체험하기
              </Btn>
              {(tables.length > 0 || error) && (
                <Btn tone="ghost" small onClick={reset}>
                  초기화
                </Btn>
              )}
            </div>
            {fileNames.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line-soft pt-2.5">
                {fileNames.slice(0, 8).map((n, i) => (
                  <li key={`${n}-${i}`} className="flex items-baseline justify-between gap-2 text-[12px] text-ink-muted">
                    <span className="min-w-0 truncate">{n}</span>
                    <span className="shrink-0 text-ink-faint">
                      {result?.files[i]?.failed ? "머리글 못 찾음" : result?.files[i] ? `${result.files[i].rows}줄` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint" role="status" aria-live="polite">
              {busy ? status : status || "심평원 '내 진료정보 열람'에서 내려받은 파일을 그대로 올리면 됩니다."}
            </p>
            {error && <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] leading-relaxed text-clay">{error}</p>}
          </Panel>

          <Panel>
            <PanelTitle>기준</PanelTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <Label htmlFor="sp-name" hint="요약문에 들어갑니다">
                  고객명
                </Label>
                <TextInput id="sp-name" value={customer} onChange={setCustomer} placeholder="예: 홍길동" />
              </div>
              <div>
                <Label htmlFor="sp-birth">생년월일</Label>
                <TextInput id="sp-birth" value={birth} onChange={setBirth} placeholder="1961-05-25" inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="sp-base">기준일(청약 예정일)</Label>
                <TextInput id="sp-base" value={baseDate} onChange={setBaseDate} type="date" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="sp-review">심사 유형</Label>
                <Select id="sp-review" value={reviewType} onChange={setReviewType} options={REVIEW_TYPES} ariaLabel="심사 유형" />
              </div>
              <div>
                <Label htmlFor="sp-surgery" hint="원">
                  수술 의심 기준(본인부담)
                </Label>
                <TextInput id="sp-surgery" value={surgeryThreshold} onChange={setSurgeryThreshold} inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="sp-total" hint="0이면 사용 안 함">
                  총진료비 기준
                </Label>
                <TextInput id="sp-total" value={totalThreshold} onChange={setTotalThreshold} inputMode="numeric" />
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
              세부진료가 없는 진료 가운데 본인부담이 기준을 넘는 건을 수술·시술 후보로 표시합니다. 비급여라 세부진료에 남지 않는 경우를
              잡기 위한 값입니다.
            </p>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelTitle
              right={
                result ? (
                  <span className="text-[11.5px] text-ink-faint">
                    기준일 {dotDate(result.baseDate)}
                  </span>
                ) : undefined
              }
            >
              점검 요약
            </PanelTitle>
            {!result ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-[#fcfcfa] px-4 py-8 text-center">
                <p className="max-w-[32ch] text-[12.5px] leading-relaxed text-ink-muted">
                  자료를 올리면 입원·수술·마취·투약·통원을 자동으로 나눠 여기에 보여 줍니다. 실제 파일이 없으면 예시 데이터로 먼저
                  확인해 보세요.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {showCards.map((c) => (
                    <a
                      key={c.key}
                      {...(compact ? {} : { href: `#sp-${c.key === "anesthesia" ? "surgery" : c.key}` })}
                      className={
                        "rounded-xl border px-3 py-2.5 transition-colors " +
                        (c.tone === "rose"
                          ? "border-[#e7cdd2] bg-[#fbf4f5] hover:border-[#d7a8ae]"
                          : c.tone === "amber" || c.tone === "rown"
                            ? "border-[#ecdfc4] bg-[#fbf6ea] hover:border-[#d9c294]"
                            : "border-[#d5e4dc] bg-[#f4f9f6] hover:border-[#a9cbbd]")
                      }
                    >
                      <span className="block text-[11.5px] leading-tight text-ink-muted">{c.label}</span>
                      <strong
                        className={
                          "mt-1 block text-[18px] font-extrabold tracking-[-0.03em] tabular-nums " +
                          (c.tone === "rose" ? "text-[#a8455c]" : c.tone === "amber" || c.tone === "rown" ? "text-[#8a6320]" : "text-jade")
                        }
                      >
                        {c.value}
                        {c.unit}
                      </strong>
                      <span className="mt-0.5 block text-[11px] leading-tight text-ink-faint">{c.sub}</span>
                    </a>
                  ))}
                </div>
                {result.failedFiles.length > 0 && (
                  <p className="mt-2 rounded-lg bg-[#fbeee8] px-3 py-2 text-[11.5px] leading-relaxed text-clay">
                    {result.failedFiles.join(", ")} — 표 머리글을 찾지 못했습니다. 심평원에서 내려받은 원본인지, 여러 시트로 나뉘어
                    있는지 확인해 주세요.
                  </p>
                )}
                {result.records.length === 0 && (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                    읽은 줄이 없습니다. 다른 파일을 올리거나 예시 데이터로 화면을 확인해 보세요.
                  </p>
                )}
              </>
            )}
            {!compact && result && result.records.length > 0 && (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
                진료 줄 {won(result.records.length)}개를 읽었습니다. 카드를 누르면 근거 줄로 내려갑니다.
              </p>
            )}
          </Panel>

          {result && result.records.length > 0 && (
            <Panel>
              <PanelTitle right={<span className="text-[11.5px] text-ink-faint">5년 기준</span>}>고지 문항</PanelTitle>
              <div className="space-y-1.5">
                {QUESTION_TEXT.map((q) => {
                  const key = (["q3m", "q1y", "q2y", "q5y", "q10"] as const)[q.no - 1];
                  const obj = result.questions[key];
                  const open = q.no === 1;
                  return (
                    <details
                      key={q.no}
                      id={`sp-q${q.no}`}
                      open={open}
                      className={
                        "scroll-mt-24 rounded-xl border px-3 py-2.5 transition-all duration-500 motion-reduce:transition-none " +
                        (highlightQ === q.no
                          ? "border-amber-400 bg-amber-50/90 ring-2 ring-amber-300/60"
                          : "border-line bg-white")
                      }
                    >
                      <summary
                        onClick={() => triggerHighlight(q.no)}
                        className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-deep">
                          {q.no}
                        </span>
                        <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-ink">
                          {q.short}. {q.text}
                        </span>
                        <span
                          className={
                            "shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold text-white " +
                            (obj.hit ? "bg-[#a8455c]" : "bg-jade")
                          }
                        >
                          {obj.hit ? `해당 ${obj.count}건` : q.no === 2 ? "직접 확인" : "해당 없음"}
                        </span>
                      </summary>
                      {q.note && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{q.note}</p>}
                      {obj.rows.length > 0 ? (
                        <ul className="mt-1.5 space-y-1 border-t border-line-soft pt-1.5">
                          {obj.rows.slice(0, 12).map((r: Record<string, unknown>, i: number) => (
                            <li key={i} className="text-[11.5px] leading-relaxed text-ink-soft">
                              {lineOf(r, result.baseDate)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[11.5px] text-ink-faint">자료에서 찾은 줄이 없습니다.</p>
                      )}
                    </details>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {!compact && result && result.records.length > 0 && (
        <div className="mt-4 space-y-4">
          <ResultLists result={result} />

          <Panel>
            <PanelTitle right={<span className="text-[11.5px] text-ink-faint">필요한 항목만 골라 복사</span>}>
              심사용 요약문
            </PanelTitle>
            <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {SECTION_LABELS.map((s) => (
                <label key={s.key} className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 text-[12px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={sections.includes(s.key)}
                    onChange={(e) =>
                      setSections((prev) => (e.target.checked ? [...prev, s.key] : prev.filter((k) => k !== s.key)))
                    }
                    className="h-4 w-4 accent-[#1233b8]"
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <textarea
              readOnly
              value={summary}
              aria-label="심사용 요약문"
              className="mono h-56 w-full resize-y rounded-xl border border-line bg-[#fcfcfa] p-3 text-[12px] leading-[1.75] text-ink-soft"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn onClick={() => doCopy("summary")}>{copied === "summary" ? "복사했습니다" : "요약문 복사"}</Btn>
              <Btn tone="secondary" onClick={saveReport}>
                레포트 HTML 저장
              </Btn>
            </div>
          </Panel>

          <Panel>
            <PanelTitle right={<span className="text-[11.5px] text-ink-faint">카톡에 붙여넣기</span>}>고객 안내 문구</PanelTitle>
            <textarea
              readOnly
              value={message}
              aria-label="고객 안내 문구"
              className="h-44 w-full resize-y rounded-xl border border-line bg-[#fcfcfa] p-3 text-[12.5px] leading-[1.75] text-ink-soft"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn tone="secondary" onClick={() => doCopy("message")}>
                {copied === "message" ? "복사했습니다" : "안내 문구 복사"}
              </Btn>
              <Btn tone="ghost" onClick={saveReport}>
                레포트도 저장
              </Btn>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
              레포트는 한 개의 HTML 파일로 저장됩니다. 파일을 열면 요약 카드를 눌러 해당 항목으로 바로 이동하고, 인쇄·PDF 저장도 됩니다.
              인터넷 없이 열립니다.
            </p>
          </Panel>
        </div>
      )}

      <p className="mt-3 border-l-2 border-ink bg-paper-deep px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
        예시·참고용 정리 도구이며, 최종 고지 판단은 고객 본인 확인과 보험사 청약서 질문 기준을 따릅니다. 이 화면은 판정하지 않고 확인할
        항목만 정리합니다. 올린 파일은 이 브라우저 안에서만 처리되고 어디에도 전송되지 않습니다.
      </p>
      <LocalNote>
        파일은 이 기기 안에서만 열리고, 결과도 이 브라우저에서 만들어집니다. 고객 이름과 진료기록이 들어 있으니 저장한 레포트는 고객별로
        따로 보관해 주세요.
      </LocalNote>
    </UtilityShell>
  );
}

/** 고지 문항 아래 — 요약 카드가 가리키는 근거 목록(앵커 대상).
 *  2026-11-28 전수 점검: 목록 머리의 건수가 요약 카드의 수와 달랐다(수술 카드 N vs 목록 N+마취 1,
 *  '3개월 처방' 카드 N vs 목록 N+진료, 투약 카드 혈압·고지혈 vs 목록 3줄). 같은 수를 쓰게 맞춘다.
 */
function ResultLists({ result }: { result: Result }) {
  const groups: { key: string; title: string; meta: string; items: { main: string; sub?: string }[] }[] = [
    {
      key: "inpatient",
      title: "입원",
      meta: `${result.admissions.length}건`,
      items: result.admissions.map((a: any) => ({ main: lineOf(a.rec, result.baseDate), sub: `입원 ${a.days}일` })),
    },
    {
      key: "surgery",
      title: "수술·마취",
      meta: `${result.surgeries.length}건${result.anesthesia.length ? ` · 마취 ${result.anesthesia.length}건` : ""}`,
      items: [
        ...result.surgeries.map((r: any) => ({ main: lineOf(r, result.baseDate, r.item || r.category || "수술") })),
        ...(result.anesthesia.length ? [{ main: `마취 기록 ${result.anesthesia.length}건`, sub: "수술·시술 여부 확인 필요" }] : []),
      ],
    },
    {
      key: "noDetail",
      title: "세부진료 없음",
      meta: result.detailFile ? `${result.suspected.length || result.noDetail.length}건` : "확인 불가",
      items: result.detailFile
        ? (result.suspected.length ? result.suspected : result.noDetail).map((r: any) => ({ main: lineOf(r, result.baseDate) }))
        : [{ main: "세부진료 파일을 올리지 않아 세지 않았습니다." }],
    },
    {
      key: "recent3m",
      title: "3개월 이내 진료·투약",
      /* 카드는 '처방조제 기준' N건이다. 목록은 진료까지 함께 보여 주므로 두 수를 나눠 적는다. */
      meta: `진료 ${Math.max(result.recent3mAll.length - result.recent3m.length, 0)}건 · 처방 ${result.recent3m.length}건`,
      items: result.recent3mAll.map((r: any) => ({
        main: lineOf(r, result.baseDate, r.drug ? `${r.drug}${r.days ? ` ${r.days}일분` : ""}` : ""),
      })),
    },
    {
      key: "bpLipidDm",
      title: "투약",
      meta: [result.groups.bp.length ? "혈압" : "", result.groups.lipid.length ? "고지혈" : "", result.groups.dm.length ? "당뇨" : ""].filter(Boolean).join("·") || "없음",
      items: [
        { main: `고혈압 ${result.groups.bp.length ? "있음" : "없음"}`, sub: result.groups.bp[0]?.drug || undefined },
        { main: `고지혈 ${result.groups.lipid.length ? "있음" : "없음"}`, sub: result.groups.lipid[0]?.drug || undefined },
        { main: `당뇨 ${result.groups.dm.length ? "있음" : "없음"}`, sub: result.groups.dm[0]?.drug || undefined },
      ],
    },
    {
      key: "long30",
      title: "30일 이상 연속 투약",
      meta: `${result.longCourses.length}건`,
      items: result.longCourses.map((c: any) => ({ main: c.drug, sub: `${c.days}일 (${dotDate(c.start)}~${dotDate(c.end)})` })),
    },
    {
      key: "otherDrugs",
      title: "그 외 주요 약",
      meta: `${result.otherDrugs.length}성분`,
      items: result.otherDrugs.map((d: any) => ({ main: d.name, sub: `${d.rows.length}회` })),
    },
    {
      key: "warnDisease",
      title: "주의 병명",
      meta: result.warnKeys.length ? `${result.warnKeys.length}분야` : "없음",
      items: result.warnKeys.length
        ? [{ main: result.warnKeys.join(", "), sub: "5년 내 진료 기록 기준" }]
        : [{ main: "기준에 걸리는 병명 없음" }],
    },
    {
      key: "frequent",
      title: "같은 질병 7회 이상 통원",
      meta: `${result.frequent.length}건`,
      items: result.frequent.map((f: any) => ({
        main: `${f.code ? f.code + " " : ""}${f.name || ""}`,
        sub: `${f.count}회 (${dotDate(f.dates[0])}~${dotDate(f.dates[f.dates.length - 1])})`,
      })),
    },
    {
      key: "questions",
      title: "고지 문항 요약",
      meta: `${result.questionHits}개 해당`,
      items: [
        { main: `해당 ${result.questionHits}개`, sub: result.questionUnsure ? `직접 확인 ${result.questionUnsure}개` : "3개월·1년·2년·5년" },
      ],
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((g) => (
        <Panel key={g.key} className="scroll-mt-24">
          <div id={`sp-${g.key}`} className="scroll-mt-24" />
          <PanelTitle right={<span className="text-[11.5px] text-ink-faint">{g.meta}</span>}>{g.title}</PanelTitle>
          {g.items.length ? (
            <ul className="space-y-1">
              {g.items.slice(0, 14).map((it, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="min-w-0">{it.main}</span>
                  {it.sub && <span className="shrink-0 text-ink-faint">{it.sub}</span>}
                </li>
              ))}
              {g.items.length > 14 && <li className="text-[11.5px] text-ink-faint">외 {g.items.length - 14}건은 레포트에 모두 들어갑니다.</li>}
            </ul>
          ) : (
            <p className="text-[11.5px] text-ink-faint">기록 없음</p>
          )}
        </Panel>
      ))}
    </div>
  );
}
