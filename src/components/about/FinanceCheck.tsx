/**
 * 고민 선택 진단 — v7.0 소개(/about). (회의실 부이 대리 A+C 혼합 포맷)
 *
 * 네 개의 고민 칩(연금 · 투자 · 절세 · 보험) 가운데 하나를 누르면,
 *  ① 그 고민에 맞춘 안내 문장  ② 지금 확인할 앱 2종  ③ 함께 읽을 글 1편을 그 자리에서 보여 준다.
 * 아래의 기간 칩(1년 / 3~5년 / 10년 이상)은 설명의 결을 한 번 더 좁힌다(선택).
 *
 * 판정하지 않는다 — 무엇부터 확인할지 순서만 제안한다.
 * 고른 값은 상태로만 쓰고 어디에도 저장하지 않는다(새로고침하면 처음으로 돌아간다).
 */
import { useMemo, useState } from "react";
import { withBase } from "@/config/site";

type Interest = "pension" | "invest" | "tax" | "risk";
type Horizon = "near" | "mid" | "long";

const INTERESTS: { value: Interest; label: string; hint: string; letter: string }[] = [
  { value: "pension", label: "연금", hint: "언제부터 얼마를 받는지", letter: "A" },
  { value: "invest", label: "투자", hint: "얼마나 버티는 구조인지", letter: "B" },
  { value: "tax", label: "절세", hint: "올해 돌려받을 금액", letter: "C" },
  { value: "risk", label: "보험", hint: "빈 칸과 지급 조건", letter: "D" },
];

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "near", label: "1년 안" },
  { value: "mid", label: "3~5년" },
  { value: "long", label: "10년 이상" },
];

type Rec = {
  /** 고민에 맞춘 안내 문장 — 두 문장 */
  consult: string[];
  apps: { name: string; href: string; note: string }[];
  /**
   * 추천 글 — href가 진실이고, title은 글 컬렉션에서 온 값으로 덮인다.
   * (손으로 적은 제목과 실제 글 제목이 갈라지지 않게 한다)
   */
  post: { href: string; title: string };
};

export type FinanceCheckProps = {
  /** postPath('/posts/…') → 실제 글 제목. 소개 페이지가 컬렉션에서 만들어 넘긴다. */
  postTitles?: Record<string, string>;
};

const RECS: Record<Interest, Rec> = {
  pension: {
    consult: [
      "연금은 적립보다 인출이 어렵습니다. 넣는 금액보다 '언제부터, 얼마씩, 몇 년 동안' 받을지가 노후의 현금흐름을 정합니다.",
      "국민·퇴직·개인연금을 한 줄로 세우고, 사적연금 1,500만 원 경계에서 세금이 어떻게 갈리는지까지 같은 화면에서 확인합니다.",
    ],
    apps: [
      { name: "은퇴 월 현금흐름 시뮬레이터", href: "/apps/retirement-flow/run", note: "은퇴 시점 월 수령액을 명목과 오늘 가치로" },
      { name: "연금 인출·세금 시뮬레이터", href: "/apps/pension-draw/run", note: "1,500만 원 경계, 종합과세와 분리과세 비교" },
    ],
    post: { title: "인출 순서 4단계와 연 1,500만 원 — 3.3~5.5% 저율과세 지키는 법", href: "/posts/pension-master-05-draw-1500" },
  },
  invest: {
    consult: [
      "투자는 수익률보다 구조가 먼저입니다. 같은 수익률이라도 계좌와 세금, 손실을 버티는 힘에 따라 남는 돈이 달라집니다.",
      "원금·세전·세후를 나란히 놓고, 계획한 진입·손절·목표가 과거 흔들림에서 몇 번 버텼는지까지 확인합니다.",
    ],
    apps: [
      { name: "투자 복리·세후 수익률 계산기", href: "/apps/compound-return/run", note: "일반·ISA·연금저축 과세 방식 비교" },
      { name: "한국형 타임머신", href: "/apps/trade-timemachine", note: "계획을 과거 봉에 1만 번 다시 걸어 보기" },
    ],
    post: { title: "적립식이 유리한 이유는 수익률이 아니라 '실수 횟수'에 있다", href: "/posts/invest-dca-rule" },
  },
  tax: {
    consult: [
      "절세는 제도가 정한 기한 안에서만 줄어듭니다. 12월 31일을 넘긴 납입은 그해 공제로 돌아오지 않습니다.",
      "총급여 구간에 따라 공제율이 갈리고, 세액공제는 산출세액을 넘을 수 없습니다. 남은 한도와 실제 환급액을 함께 계산합니다.",
    ],
    apps: [
      { name: "연금저축·IRP 세액공제 계산기", href: "/apps/pension-tax/run", note: "올해 남은 한도와 12월 전 채울 금액" },
      { name: "연금 인출·세금 시뮬레이터", href: "/apps/pension-draw/run", note: "받을 때의 세금까지 이어서" },
    ],
    post: { title: "연금저축 900만원보다 먼저 계산해야 할 것", href: "/posts/pension-tax-order" },
  },
  risk: {
    consult: [
      "보장은 상품이 아니라 구조입니다. 같은 이름의 담보라도 지급 조건과 가입 시기에 따라 받는 금액이 다릅니다.",
      "5대 담보의 빈 칸, 실손 세대별 자기부담, 고지의무를 순서대로 확인해 무엇부터 볼지 정합니다.",
    ],
    apps: [
      { name: "세대별 실손 계산기", href: "/apps/silson-compare/run", note: "같은 병원비로 1~5세대·유병력자 비교" },
      { name: "보장 점검 시뮬레이터", href: "/apps/coverage-check/run", note: "5대 담보를 연령대 기준점과 나란히" },
    ],
    post: { title: "실손 5세대, 보험료 30% 낮아졌다는 말의 앞뒤", href: "/posts/insurance-silson-5th" },
  },
};

const HORIZON_LINE: Record<Horizon, string> = {
  near: "1년 안이라면 기한이 있는 항목부터 — 올해 안에 끝낼 수 있는 공제와 일정을 먼저 봅니다.",
  mid: "3~5년은 한 번 정한 규칙이 결과를 만드는 구간 — 납입과 배분의 규칙을 먼저 봅니다.",
  long: "10년 이상은 시간이 일합니다 — 복리와 수령 시점을 같은 시간축에 놓고 확인합니다.",
};

const STAGE_HINT: Record<Interest, string> = {
  pension: "받는 나이와 수령 기간을 바꿔 보면 답이 달라집니다.",
  invest: "수익률 가정을 바꿔 보면 원금 손실 구간이 보입니다.",
  tax: "납입액을 바꾸면 남은 한도가 그 자리에서 다시 계산됩니다.",
  risk: "가진 금액을 넣으면 먼저 볼 항목 세 개가 정리됩니다.",
};

export default function FinanceCheck({ postTitles = {} }: FinanceCheckProps = {}) {
  const [interest, setInterest] = useState<Interest | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("mid");

  const rec = useMemo(() => (interest ? RECS[interest] : null), [interest]);

  return (
    <div className="fcheck" data-finance-check data-step={interest ? "result" : "start"}>
      <div className="fcheck-head">
        <p className="fcheck-kicker">3초 재무 진단</p>
        <p className="fcheck-progress mono" aria-live="polite">
          {interest ? "진단 완료" : "고민 하나를 고르세요"}
        </p>
      </div>

      <div className="fcheck-chips" role="group" aria-label="지금 가장 궁금한 영역">
        {INTERESTS.map((o) => (
          <button
            key={o.value}
            type="button"
            className="fcheck-chip"
            data-on={interest === o.value ? "1" : "0"}
            aria-pressed={interest === o.value}
            onClick={() => setInterest(o.value)}
          >
            <span className="fcheck-chip-letter mono">{o.letter}</span>
            <span className="fcheck-chip-body">
              <span className="fcheck-chip-label">{o.label}</span>
              <span className="fcheck-chip-hint">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {!rec && (
        <p className="fcheck-note">
          고른 내용은 저장하지 않습니다. 고민 하나를 누르면 그 자리에서 결과가 나옵니다.
        </p>
      )}

      {rec && (
        <div className="fcheck-result" role="status">
          <p className="fcheck-result-eyebrow mono">맞춤 안내 · {INTERESTS.find((i) => i.value === interest)?.label}</p>
          {rec.consult.map((line) => (
            <p className="fcheck-consult" key={line}>
              {line}
            </p>
          ))}
          <p className="fcheck-result-sub">{HORIZON_LINE[horizon]}</p>

          <div className="fcheck-horizon" role="group" aria-label="확인 기간">
            {HORIZONS.map((h) => (
              <button
                key={h.value}
                type="button"
                className="fcheck-horizon-chip"
                data-on={horizon === h.value ? "1" : "0"}
                aria-pressed={horizon === h.value}
                onClick={() => setHorizon(h.value)}
              >
                {h.label}
              </button>
            ))}
          </div>

          <ol className="fcheck-apps">
            {rec.apps.map((a, i) => (
              <li key={a.href}>
                <a href={withBase(a.href)} className="fcheck-app">
                  <span className="fcheck-app-no mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="fcheck-app-body">
                    <span className="fcheck-app-name">{a.name}</span>
                    <span className="fcheck-app-note">{a.note}</span>
                  </span>
                  <span className="fcheck-app-go" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ol>

          <a href={withBase(rec.post.href)} className="fcheck-post">
            <span className="fcheck-post-label mono">함께 읽기</span>
            <span className="fcheck-post-title">{postTitles[rec.post.href] ?? rec.post.title}</span>
          </a>

          <p className="fcheck-stage">{STAGE_HINT[interest as Interest]}</p>

          <div className="fcheck-actions">
            <a href={withBase(rec.apps[0].href)} className="btn btn-primary btn-sm">
              첫 번째 앱 열기
            </a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInterest(null)}>
              다시 고르기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
