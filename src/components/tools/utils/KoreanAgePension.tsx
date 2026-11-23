import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { Bar, Note, ResultStat, RunnerShell, Segmented, StickySummary, formatKrw } from "../ui";
import { AmountField, CaveatBox, DateField, Line, TableScroll } from "./fields-c";

/**
 * 만 나이 · 국민연금 개시연령 · 사적연금 55세 계산기.
 *
 * 근거
 *  · 만 나이 통일: 2023. 6. 28. 시행 「행정기본법」 제7조의2 — 일상의 나이는 만 나이로 센다.
 *  · 국민연금 노령연금 수급개시연령: 국민연금법 부칙(2013. 5. 22.) 출생연도별 61~65세.
 *  · 조기노령연금: 국민연금법 제61조 — 수급개시연령 5년 전부터, 1년당 6%(월 0.5%) 감액, 최대 30%.
 *  · 사적연금(연금저축·IRP): 소득세법 시행령 제40조의2 — 만 55세 이후 연금 수령.
 */

type YMD = { y: number; m: number; d: number };

const DAY = 86400000;

function parseYmd(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 같은 월·일로 n년 뒤 — 2월 29일생이 평년을 만나면 2월 28일로 본다 */
function addYears(date: YMD, n: number): YMD {
  const y = date.y + n;
  if (date.m === 2 && date.d === 29 && !isLeap(y)) return { y, m: 2, d: 28 };
  return { y, m: date.m, d: date.d };
}

const time = (d: YMD) => Date.UTC(d.y, d.m - 1, d.d);
const daysBetween = (a: YMD, b: YMD) => Math.round((time(b) - time(a)) / DAY);
const ymdLabel = (d: YMD) => `${d.y}년 ${d.m}월 ${d.d}일`;

/** 만 나이 — 생일이 지나지 않았으면 한 살 적다 */
function fullAge(birth: YMD, base: YMD) {
  let years = base.y - birth.y;
  let months = base.m - birth.m;
  let days = base.d - birth.d;
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(Date.UTC(base.y, base.m - 1, 0)).getUTCDate();
    days += prevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

type PensionAge = { age: number; label: string };
function pensionStartAge(year: number): PensionAge {
  if (year <= 1952) return { age: 60, label: "1952년생 이하" };
  if (year <= 1956) return { age: 61, label: "1953~1956년생" };
  if (year <= 1960) return { age: 62, label: "1957~1960년생" };
  if (year <= 1964) return { age: 63, label: "1961~1964년생" };
  if (year <= 1968) return { age: 64, label: "1965~1968년생" };
  return { age: 65, label: "1969년생 이후" };
}

const PENSION_ROWS = [
  { band: "1952년생 이하", age: 60 },
  { band: "1953~1956년생", age: 61 },
  { band: "1957~1960년생", age: 62 },
  { band: "1961~1964년생", age: 63 },
  { band: "1965~1968년생", age: 64 },
  { band: "1969년생 이후", age: 65 },
];

export default function KoreanAgePension({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  /** v8.8.0 — `pension-draw`의 '개시일·나이' 탭으로 들어갈 때 껍데기 없이 본문만 그린다 */
  embedded?: boolean;
}) {
  const [birthText, setBirthText] = useState("1975-03-15");
  const [earlyYears, setEarlyYears] = useState<"0" | "1" | "2" | "3" | "4" | "5">("0");
  const [monthlyPension, setMonthlyPension] = useState(120);

  const base: YMD = useMemo(() => parseYmd(site.baseDate) ?? { y: 2026, m: 11, d: 21 }, []);
  const birth = parseYmd(birthText);

  const calc = useMemo(() => {
    if (!birth) return null;
    const age = fullAge(birth, base);
    const start = pensionStartAge(birth.y);
    const pensionDate = addYears(birth, start.age);
    const private55 = addYears(birth, 55);
    const earlyStart = addYears(birth, start.age - 5);
    const early = Number(earlyYears);
    const reduction = early * 6; // 1년 6% (월 0.5%)
    const appliedDate = addYears(birth, start.age - early);
    const dPension = daysBetween(base, pensionDate);
    const dPrivate = daysBetween(base, private55);
    const dEarly = daysBetween(base, earlyStart);
    const pensioned = dPension <= 0;
    return {
      age,
      start,
      pensionDate,
      private55,
      earlyStart,
      reduction,
      appliedDate,
      dPension,
      dPrivate,
      dEarly,
      pensioned,
    };
  }, [birth, base, earlyYears]);

  const monthly = monthlyPension * 10000;
  const reduced = Math.round(monthly * (1 - (calc ? calc.reduction : 0) / 100));

  const content = (
    <>
      {/* v8.8.0 — 통합 도구의 탭 안에서는 껍데기 대신 이 한 줄이 화면 이름을 알린다 */}
      {embedded && (
        <div className="mb-1 border-b border-line-soft pb-2.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">만 나이 · 연금 개시일</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">생년월일 하나로 만 나이와 국민연금·사적연금 개시일을 계산합니다.</p>
        </div>
      )}
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-8">
        <DateField
          label="생년월일"
          value={birthText}
          onChange={setBirthText}
          min="1930-01-01"
          max="2026-12-31"
          hint="주민등록상 생년월일 (예: 1975-03-15)"
        />
        <div className="py-3">
          <p className="text-[13.5px] font-semibold text-ink">기준일</p>
          <p className="mt-2 rounded-lg border border-line bg-paper-deep px-3 py-2 text-[14px] font-bold tabular-nums text-ink">
            {site.baseDateLabel}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            만 나이는 이 날짜를 기준으로 셉니다. 실제 오늘 날짜와 다르면 표시된 나이도 그만큼 달라집니다.
          </p>
        </div>
      </div>

      {!calc && (
        <p className="mt-4 rounded-xl border border-[#e2c9c9] bg-[#fbf3f1] px-4 py-3 text-[13px] text-[#7a3b3b]">
          생년월일을 8자리 날짜로 입력해 주세요. (예: 1975-03-15)
        </p>
      )}

      {calc && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div data-testid="age-now">
              <ResultStat
                label="만 나이 (기준일)"
                value={`${calc.age.years}세`}
                tone="brand"
                sub={`${calc.age.months}개월 ${calc.age.days}일 지남 · ${calc.start.label}`}
              />
            </div>
            <div data-testid="pension-date">
              <ResultStat
                label="국민연금 노령연금 개시"
                value={`${calc.start.age}세`}
                sub={
                  calc.pensioned
                    ? `${ymdLabel(calc.pensionDate)} · 이미 개시`
                    : `${ymdLabel(calc.pensionDate)} · ${calc.dPension.toLocaleString("ko-KR")}일 남음`
                }
              />
            </div>
            <div data-testid="private-date">
              <ResultStat
                label="사적연금 55세 개시"
                value="55세"
                tone="jade"
                sub={
                  calc.dPrivate > 0
                    ? `${ymdLabel(calc.private55)} · ${calc.dPrivate.toLocaleString("ko-KR")}일 남음`
                    : `${ymdLabel(calc.private55)} · 이미 개시 가능`
                }
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">세 가지 시점</p>
              <div className="mt-3 space-y-3">
                {[
                  {
                    label: "사적연금(연금저축·IRP)",
                    sub: "만 55세",
                    date: calc.private55,
                    d: calc.dPrivate,
                    tone: "jade" as const,
                    ratio: 1 - Math.max(0, calc.dPrivate) / Math.max(1, daysBetween(birth!, calc.private55)),
                  },
                  {
                    label: `국민연금 노령연금 (${calc.start.age}세)`,
                    sub: "출생연도별 개시연령",
                    date: calc.pensionDate,
                    d: calc.dPension,
                    tone: "brand" as const,
                    ratio: 1 - Math.max(0, calc.dPension) / Math.max(1, daysBetween(birth!, calc.pensionDate)),
                  },
                  {
                    label: `조기노령연금 가능 (${calc.start.age - 5}세)`,
                    sub: "최대 30% 감액",
                    date: calc.earlyStart,
                    d: calc.dEarly,
                    tone: "rose" as const,
                    ratio: 1 - Math.max(0, calc.dEarly) / Math.max(1, daysBetween(birth!, calc.earlyStart)),
                  },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="font-semibold text-ink">{row.label}</span>
                      <span className="tabular-nums text-ink-muted">{ymdLabel(row.date)}</span>
                    </div>
                    <div className="mt-1">
                      <Bar ratio={row.ratio} tone={row.tone as "brand" | "jade" | "rose"} />
                    </div>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {row.sub} ·{" "}
                      {row.d > 0 ? `${row.d.toLocaleString("ko-KR")}일 남음` : "지난 시점(이미 해당)"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                막대는 태어난 날부터 그 시점까지의 진행률입니다. 개시일은 생일이 있는 날이며, 2월 29일생이
                평년을 만나면 2월 28일로 봅니다.
              </p>
            </div>

            <CaveatBox
              items={[
                "국민연금 개시연령은 출생연도로만 정해집니다. 가입기간 10년(120개월) 미만이면 노령연금 대신 반환일시금 대상입니다.",
                "조기노령연금은 개시 5년 전부터 신청할 수 있고, 1년당 6%씩 최대 30%가 깎입니다. 2015년 8월 이후 조기수령은 소득이 있으면 일부가 정지될 수 있습니다.",
                "사적연금은 55세 이전에 해지하면 그동안 받은 세액공제액에 기타소득세가 붙습니다. 55세 이후라도 '연금' 형태로 받아야 연금소득세(3.3~5.5%)가 적용됩니다.",
                "이 계산은 수급 자격·가입기간·소득 이력을 보지 않습니다. 정확한 예상액은 국민연금공단 '내 연금 알아보기'에서 확인하세요.",
              ]}
            />
          </div>

          <div className="mt-5 rounded-xl border border-line bg-white p-4">
            <p className="text-[12px] font-bold tracking-[0.1em] text-ink-faint">조기수령 감액 시뮬레이션</p>
            <div className="mt-2">
              <Segmented
                label={`개시연령보다 몇 년 먼저 받을까 (${calc.start.age}세 → ${calc.start.age - Number(earlyYears)}세)`}
                value={earlyYears}
                onChange={setEarlyYears}
                options={[
                  { value: "0", label: "정상 수령" },
                  { value: "1", label: "1년 조기" },
                  { value: "2", label: "2년 조기" },
                  { value: "3", label: "3년 조기" },
                  { value: "4", label: "4년 조기" },
                  { value: "5", label: "5년 조기" },
                ]}
                hint="조기 1년마다 6% 감액 · 5년 조기 시 평생 70% 수령"
              />
            </div>
            <div className="mt-1">
              <AmountField
                label="정상 수령 시 월 연금액(예시)"
                value={monthlyPension}
                onChange={setMonthlyPension}
                min={30}
                max={300}
                step={5}
                hint="내 예상액을 모르면 예시값으로 두세요"
              />
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-[#fbfbf8] p-4">
                <Line label="개시 시점" value={ymdLabel(calc.appliedDate)} />
                <Line label="감액률" value={`${calc.reduction}%`} tone="clay" />
                <Line label="수령률" value={`${100 - calc.reduction}%`} />
                <Line label="월 예상액" value={formatKrw(reduced)} strong tone="brand" />
                <Line label="정상 수령 대비 손실" value={`${formatKrw(monthly - reduced)} / 월`} />
              </div>
              <div className="rounded-xl border border-line bg-[#fbfbf8] p-4">
                <p className="text-[12px] font-semibold text-ink">같은 기간에 받는 금액 (10년 기준)</p>
                <Line label="조기 수령" value={formatKrw(reduced * 12 * 10)} strong />
                <Line
                  label={`정상 수령 (${calc.pensioned ? "이미 개시" : `${calc.dPension}일 뒤`}부터)`}
                  value={formatKrw(monthly * 12 * 10)}
                />
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                  조기수령은 일찍 받는 만큼 매달 금액이 줄어 장기적으로는 손실이 커집니다. 소득 공백
                  기간을 메우는 용도인지, 평생 수령액을 보는지에 따라 판단이 달라집니다.
                </p>
              </div>
            </div>
          </div>

          {!compact && (
            <div className="mt-5 rounded-xl border border-line bg-white">
              <TableScroll><table className="w-full border-collapse text-[12.5px]">
                <caption className="border-b border-line bg-paper-deep px-3 py-2.5 text-left text-[12px] font-semibold text-ink-soft">
                  출생연도별 국민연금 노령연금 수급개시연령 (국민연금법 부칙)
                </caption>
                <thead>
                  <tr className="border-b border-line bg-[#fbfbf8] text-left">
                    <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">출생연도</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">개시연령</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">조기 가능</th>
                  </tr>
                </thead>
                <tbody>
                  {PENSION_ROWS.map((row) => {
                    const active = calc.start.age === row.age;
                    return (
                      <tr
                        key={row.band}
                        className={`border-b border-line-soft last:border-0 ${active ? "bg-jade-soft/50" : ""}`}
                      >
                        <td className="px-3 py-2 font-semibold text-ink">
                          {row.band}
                          {active && <span className="ml-1.5 text-[12px] font-normal text-brand">내 구간</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">만 {row.age}세</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-faint">만 {row.age - 5}세</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></TableScroll>
            </div>
          )}

          {!embedded && (
            <StickySummary
              items={[
                { label: "만 나이", value: `${calc.age.years}세` },
                { label: "국민연금 개시", value: `${calc.start.age}세` },
                { label: "사적연금", value: calc.dPrivate > 0 ? `${calc.dPrivate}일 남음` : "개시 가능" },
              ]}
              note={`출생연도 기준 · 확인 기준일 ${site.baseDateLabel}`}
            />
          )}

          <Note>
            기준일 {site.baseDateLabel}. 만 나이는 행정기본법 제7조의2, 개시연령은 국민연금법 부칙, 조기감액은
            같은 법 제61조, 사적연금 55세는 소득세법 시행령 제40조의2를 따랐습니다. 이 계산은 참고용
            모의계산이며, 실제 수급 시점과 금액은 가입기간·소득·연금 종류에 따라 달라집니다.
          </Note>
        </>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <RunnerShell
      title="만 나이 · 연금 개시일 계산"
      subtitle="생년월일 하나로 만 나이, 국민연금 노령연금 개시연령, 조기수령 감액, 사적연금 55세 개시일을 계산합니다."
      example="생년월일과 조기수령 희망 연수를 바꿔 보세요. 기준일은 2026년 11월 21일입니다."
    >
      {content}
    </RunnerShell>
  );
}
