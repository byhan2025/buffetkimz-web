/**
 * 「한스푼 아카데미」 데이터 — v8.0 파일럿.
 *
 * 왜 데이터 파일인가
 *  · 6 STEP·41강·9세트와 수강 경로, 파일럿 1강의 숫자는 허브와 강의 페이지가 함께 읽는다.
 *    허브에서 '6 STEP · 41강'이라 적은 숫자와 강의 페이지의 회차 표기가 어긋나지 않게 한 곳에서 센다.
 *  · 금액·세율은 `data/tax-rules.ts`에서만 가져온다. 이 파일은 금액을 손으로 적지 않고
 *    한도 × 공제율로 만들어, 세율이 바뀌면 문구도 같이 따라오게 한다.
 *
 * 원칙
 *  · 특정 상품·운용사를 권하지 않는다. 보험은 재무설계의 도구로만 다룬다.
 *  · 외부 채널·영상·시리즈 이름은 쓰지 않는다. 회차 표기는 `STEP-강`(예: 2-3강) 하나만 쓴다.
 *  · 과정 이름과 STEP 이름은 대표님 확정 전까지 이 파일 안에서만 바뀐다(화면 코드는 이름을 직접 쓰지 않는다).
 */
import { PENSION_ACCOUNT, PRIVATE_PENSION_TAX, wonLabel, manLabel, pct } from "./tax-rules";

/** 만원 단위 납입액 × 공제율 → 원 단위 공제액 */
export const creditWon = (man: number, rate: number) => Math.round(man * 10000 * rate);

export const ACADEMY = {
  name: "한스푼 아카데미",
  /** 히어로 아래 한 줄 */
  tagline: "하루 한스푼, 15분",
  /** 프로그램 목적 한 문장 */
  promise:
    "영상 한 편을 5분 읽기·계산기·카드 6장·1차 출처로 다시 묶었습니다. 강의마다 내 숫자로 끝나는 15분을 만듭니다.",
  /** 강의 1개의 표준 구성 */
  standard: "5분 읽기 → 10분 계산기 → 카드 6장 확인 → 출처 1개 직접 열어보기 → 다음 강 1문장",
  counts: { steps: 6, lessons: 41, cardSets: 9, cards: 54, hours: "약 11시간 40분" },
} as const;

/** 강의 1개의 4종 세트 — 허브에서 설명하는 네 칸 */
export const ACADEMY_SET = [
  {
    no: "①",
    title: "5분 한스푼 읽기",
    minutes: "5분",
    body: "개념·기준·예외를 한 번에 끝내는 1,200~1,500자 글. 한 문장에 한 뜻만 담고, 어려운 말은 처음 나올 때 풀어 씁니다.",
  },
  {
    no: "②",
    title: "내 숫자 계산기",
    minutes: "10분",
    body: "사이트의 계산기에 내 숫자를 넣어 결론을 봅니다. 입력값은 주소에도 서버에도 남기지 않고 그 화면 안에서만 계산합니다.",
  },
  {
    no: "③",
    title: "3D 카드 6장",
    minutes: "3분",
    body: "1080×1350 카드 한 세트로 저장·공유·출력합니다. 카드 하단에 그 숫자의 조문과 기준일을 함께 적었습니다.",
  },
  {
    no: "④",
    title: "1차 출처",
    minutes: "2분",
    body: "법령 조문과 기관 안내 원문으로 제가 직접 확인할 수 있게 남깁니다. 요약은 원문과 대조한 뒤에만 씁니다.",
  },
] as const;

export type AcademyStep = {
  /** 1~6 */
  no: number;
  /** 주소 조각 — /academy/step2-… */
  slug: string;
  name: string;
  /** 이 STEP이 답하는 질문 */
  question: string;
  lessons: number;
  /** 자료앨범 카드 세트 */
  cards: string;
  time: string;
  /** 수료 기준 — STEP 끝에 남기는 산출물 1장 */
  deliverable: string;
  /** open: 이번 파일럿에서 강의가 열린 STEP */
  status: "open" | "soon";
  /** 파일럿에서 공개한 강의 수 */
  opened: number;
};

/** 6단계 41강 — 순서가 화면 순서다. */
export const ACADEMY_STEPS: AcademyStep[] = [
  {
    no: 1,
    slug: "step1-money-basics",
    name: "돈의 기초 체력",
    question: "내 돈은 어디서 들어와 어디로 나가나",
    lessons: 6,
    cards: "A. 세 칸의 지도",
    time: "1시간 40분",
    deliverable: "세 칸을 채운 내 현금흐름표 1장",
    status: "soon",
    opened: 0,
  },
  {
    no: 2,
    slug: "step2-account-placement",
    name: "계좌 배치",
    question: "세금은 언제, 어느 계좌에서 떼이나",
    lessons: 7,
    cards: "B. 세 순간 · C. 계좌 배치표",
    time: "2시간",
    deliverable: "세액공제액·ISA 납입액·건보료 경계를 적은 배치표 1장",
    status: "open",
    opened: 1,
  },
  {
    no: 3,
    slug: "step3-asset-structure",
    name: "굴리는 구조",
    question: "무엇을, 얼마씩, 어떻게 들고 갈까",
    lessons: 8,
    cards: "D. ETF 6개 숫자 · E. 낙폭과 회복",
    time: "2시간 20분",
    deliverable: "목표·3층 비율·리밸런싱 밴드를 적은 투자정책서 1장",
    status: "soon",
    opened: 0,
  },
  {
    no: 4,
    slug: "step4-retirement-draw",
    name: "받는 설계",
    question: "언제부터, 얼마를, 어떤 순서로 받나",
    lessons: 8,
    cards: "F. 1,500만 원 경계선 · G. 퇴직연금 3층",
    time: "2시간 20분",
    deliverable: "은퇴 후 월 수령액과 인출 순서표 1장",
    status: "soon",
    opened: 0,
  },
  {
    no: 5,
    slug: "step5-risk-cover",
    name: "잃지 않는 장치",
    question: "무엇이 나를 무너뜨릴 수 있나",
    lessons: 6,
    cards: "H. 보장 공백 5칸",
    time: "1시간 40분",
    deliverable: "5대 담보 빈칸 표 1장",
    status: "soon",
    opened: 0,
  },
  {
    no: 6,
    slug: "step6-year-sheet",
    name: "1년 운영표",
    question: "12개월을 어떤 순서로 돌리나",
    lessons: 6,
    cards: "I. 12개월 금융 달력",
    time: "1시간 40분",
    deliverable: "12개월 달력 1장과 결산 3숫자",
    status: "soon",
    opened: 0,
  },
];

export const stepByNo = (no: number) => ACADEMY_STEPS.find((s) => s.no === no);

/** 수강 경로 3가지 — 진단 3문항의 답 개수로 갈린다. */
export const ACADEMY_PATHS = [
  {
    id: "starter",
    name: "입문",
    steps: [1, 2],
    stepsText: "STEP 1 → 2",
    lessons: 13,
    who: "계좌가 2개 이하이고, 투자 경험이 1년 미만",
    goal: "내 숫자 3개와 계좌 배치 한 장을 먼저 만듭니다.",
  },
  {
    id: "builder",
    name: "자산가",
    steps: [1, 2, 3, 6],
    stepsText: "STEP 1 → 2 → 3 → 6",
    lessons: 27,
    who: "월 투자금은 있지만, 어느 계좌에 얼마를 둘지 기준이 없음",
    goal: "배치 기준과 3층 비율, 12개월 운영표까지 한 번에 세웁니다.",
  },
  {
    id: "retiree",
    name: "은퇴",
    steps: [1, 2, 4, 6],
    stepsText: "STEP 1 → 2 → 4 → 6",
    lessons: 27,
    who: "50세 이상이거나 퇴직·연금 수령이 10년 안",
    goal: "받는 순서와 세금 경계를 먼저 정하고, 운영표로 마무리합니다.",
  },
] as const;

/** 진단 3문항 — 0~1개 입문 / 2개 자산가·은퇴 / 3개 6단계 전체 */
export const ACADEMY_DIAGNOSIS = [
  "지금 내 계좌를 3개 이상 말할 수 있다.",
  "지난 1년간 내 투자 수익률을 숫자로 안다.",
  "은퇴 후 월 생활비를 숫자로 적어본 적이 있다.",
] as const;

/** 파일럿 1강 — 2-3강. 숫자는 전부 tax-rules 상수에서 만든다. */
const LOW = PENSION_ACCOUNT.creditRateLow;
const HIGH = PENSION_ACCOUNT.creditRateHigh;
const SAV = PENSION_ACCOUNT.savingsLimit; // 600
const COMBO = PENSION_ACCOUNT.combinedLimit; // 900

export const PILOT = {
  slug: "step2-pension-tax-limit",
  step: 2,
  no: 3,
  /** 회차 표기 — 우리 표기는 `2-3강` 하나 */
  label: "2-3강",
  title: `연금저축 ${manLabel(SAV)}·IRP ${manLabel(COMBO)}, 내 소득에서 얼마나 돌려받을까?`,
  shortTitle: "연금저축 600 · IRP 900",
  question: "세액공제는 어디서 얼마나 줄어드는 걸까",
  readingMinutes: 5,
  /** ① 조건별 손익 반전 훅 */
  hook: "여윳돈 월 30만 원이 같아도, 2년 뒤 전세 자금이 필요한 사람과 아닌 사람은 계좌 배치가 완전히 다릅니다.",
  numbers: {
    /** 900만 × 16.5% */
    maxCredit: creditWon(COMBO, LOW),
    maxCreditLabel: wonLabel(creditWon(COMBO, LOW)),
    /** 900만 × 13.2% */
    highCredit: creditWon(COMBO, HIGH),
    highCreditLabel: wonLabel(creditWon(COMBO, HIGH)),
    /** 600만 × 16.5% */
    savingsOnly: creditWon(SAV, LOW),
    savingsOnlyLabel: wonLabel(creditWon(SAV, LOW)),
    /** 800만 × 16.5% — IRP를 300에서 200으로 줄였을 때 */
    irp200: creditWon(800, LOW),
    irp200Label: wonLabel(creditWon(800, LOW)),
    /** 660만 × 16.5% — 월 30만 원(연 360만) + IRP 300만 */
    monthly30: creditWon(660, LOW),
    monthly30Label: wonLabel(creditWon(660, LOW)),
    /** 해지 시 되돌아가는 세금 — 공제받은 납입액 × 기타소득세 */
    clawbackLabel: wonLabel(creditWon(COMBO, PENSION_ACCOUNT.earlyWithdrawRateWithLocal)),
    /** 900만 × 13.2% 와의 차이 */
    bracketGapLabel: wonLabel(creditWon(COMBO, LOW) - creditWon(COMBO, HIGH)),
    rateLow: pct(LOW),
    rateHigh: pct(HIGH),
    rateDrawUnder70: pct(PRIVATE_PENSION_TAX.rateUnder70),
    rateDraw80: pct(PRIVATE_PENSION_TAX.rate80),
    earlyRate: pct(PENSION_ACCOUNT.earlyWithdrawRateWithLocal),
    savingsLimit: manLabel(SAV),
    combinedLimit: manLabel(COMBO),
  },
  /** ① 훅 카드 두 갈래 */
  fork: {
    short: {
      head: "2년 뒤 전세 자금이 필요하다",
      body: `연금계좌에 넣은 돈을 55세 전에 연금이 아닌 방식으로 찾으면, 공제받은 납입액에 기타소득세 ${pct(
        PENSION_ACCOUNT.earlyWithdrawRateWithLocal,
      )}가 다시 붙습니다. 돌려받은 ${wonLabel(creditWon(COMBO, LOW))}을 그대로 다시 내는 셈입니다.`,
      verdict: "연금계좌 대신, 만기가 짧은 다른 계좌가 먼저입니다.",
    },
    long: {
      head: "5년 넘게 묶어 둘 수 있다",
      body: `연금저축 ${manLabel(SAV)}에 IRP ${manLabel(COMBO - SAV)}을 더하면 합산 ${manLabel(
        COMBO,
      )}이 공제 대상이 됩니다. 연말정산에서 ${wonLabel(creditWon(COMBO, LOW))}이 줄어듭니다.`,
      verdict: "이 글의 주제입니다. 아래 계산기에서 내 숫자로 확인합니다.",
    },
  },
  /** ③ 계산기 실습 시나리오 — 값은 화면에만 적고 주소에는 붙이지 않는다 */
  scenarios: [
    {
      id: "base",
      label: "기본",
      title: "총급여 4,800만 원 · 연금저축 600 · IRP 300",
      settings: ["소득 구간: 총급여 5,500만원 이하", "연금저축 납입액: 600만원", "IRP 납입액: 300만원"],
      result: `예상 세액공제 ${wonLabel(creditWon(COMBO, LOW))}`,
      expect: "합산 한도 900만 원을 꽉 채운 경우입니다.",
    },
    {
      id: "step",
      label: "계단",
      title: "IRP를 0 → 100 → 200 → 300으로",
      settings: ["소득 구간: 총급여 5,500만원 이하", "연금저축 납입액: 600만원", "IRP 납입액: 0 · 100 · 200 · 300만원"],
      result: `${wonLabel(creditWon(SAV, LOW))} → 115만 5,000원 → ${wonLabel(
        creditWon(800, LOW),
      )} → ${wonLabel(creditWon(COMBO, LOW))}`,
      expect: "IRP 100만 원마다 16만 5,000원씩 계단처럼 오릅니다.",
    },
    {
      id: "high",
      label: "구간 경계",
      title: "총급여 5,500만 원 초과 · 연금저축 600 · IRP 300",
      settings: ["소득 구간: 5,500만원 초과", "연금저축 납입액: 600만원", "IRP 납입액: 300만원"],
      result: `예상 세액공제 ${wonLabel(creditWon(COMBO, HIGH))}`,
      expect: `같은 900만 원인데 공제율이 ${pct(HIGH)}로 내려가 ${wonLabel(
        creditWon(COMBO, LOW) - creditWon(COMBO, HIGH),
      )} 차이가 납니다.`,
    },
  ],
  /** ④ 1차 출처 */
  sources: [
    {
      label: "소득세법 제59조의3 — 연금계좌세액공제",
      what: "연금저축 600만 원, 연금저축·퇴직연금 합산 900만 원, 공제율 15%·12%(지방소득세 포함 16.5%·13.2%)",
      url: "https://www.law.go.kr/법령/소득세법",
      host: "law.go.kr",
    },
    {
      label: "소득세법 시행령 제118조의2 — 연금계좌 납입한도와 ISA 전환",
      what: "한도 초과 납입액의 다음 연도 전환, ISA 만기 자금의 10%·최대 300만 원 추가",
      url: "https://www.law.go.kr/법령/소득세법시행령",
      host: "law.go.kr",
    },
    {
      label: "국세청 — 연말정산 안내: 연금계좌 세액공제",
      what: "12월 31일 입금분까지 그해 공제 대상, 공제율 적용 방식",
      url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=2304",
      host: "nts.go.kr",
    },
    {
      label: "금융감독원 통합연금포털 — 내 연금 확인",
      what: "공적연금·퇴직연금·개인연금 가입 내역을 한 번에 조회",
      url: "https://100lifeplan.fss.or.kr/",
      host: "fss.or.kr",
    },
  ],
  /**
   * ④ 자료앨범 3D 카드 세트 — v8.0에서 자료앨범 Set B(`tax-moments-3d`)로 연결했다.
   * 이 강의의 뼈대(공제받고 16.5%로 되돌아가는 순간)를 6장으로 담은 세트다.
   * 카드의 제목·한 줄은 `data/gallery.ts`의 같은 세트와 어긋나지 않게 여기서도 그대로 적는다.
   */
  cardSet: {
    id: "tax-moments-3d",
    title: "모르면 16.5% 떼이는 세금 세 순간",
    meta: "3D 스토리 카드 6장 · 이자·중도해지·연금수령",
    href: "/gallery/?cat=carousel",
  },
  /** ⑤ 내 돈 운영표 — 이 강의로 채우는 1칸 */
  sheet: {
    title: "내 돈 운영표",
    slotNo: 2,
    slotTitle: "계좌 배치표",
    slots: [
      { no: 1, name: "현금흐름표", step: "STEP 1" },
      { no: 2, name: "계좌 배치표", step: "STEP 2" },
      { no: 3, name: "투자정책서", step: "STEP 3" },
      { no: 4, name: "인출 순서표", step: "STEP 4" },
      { no: 5, name: "보장 빈칸표", step: "STEP 5" },
      { no: 6, name: "12개월 달력", step: "STEP 6" },
    ],
  },
  /** 다음 강 — STEP 2의 2-4강(ISA) */
  next: {
    label: "다음 강",
    title: "2-4강 · ISA의 세 가지 장치",
    body: "손익통산·비과세 200/400·3년 의무가입이 각각 무엇을 막는지, 연금계좌와 어떻게 이어지는지 정리합니다.",
    status: "준비중",
  },
  /** 면책 — 강의 페이지 하단 고정 */
  disclaimer: "이 글은 특정 상품을 권하지 않습니다.",
} as const;

/**
 * ② 5분 한스푼 읽기 원고 — 1,200~1,500자.
 *  · 첫 문장은 질문, 그다음은 결론, 그 뒤에 이유·내 숫자·예외·출처 순서.
 *  · 금액은 전부 PILOT.numbers에서 온다. 문장과 계산기가 다른 숫자를 말하지 않게.
 */
type ReadingSection = { h: string; ps: string[] };

const N = PILOT.numbers;

export const PILOT_READING: ReadingSection[] = [
  {
    h: "세 문이 있는 방",
    ps: [
      `연금저축 한 계좌만으로는 ${N.savingsLimit}까지 공제 대상입니다. 여기에 IRP를 더하면 두 계좌 합계로 ${N.combinedLimit}까지 늘어납니다. '세액공제'는 낸 세금에서 정해진 비율을 빼 주는 제도입니다. 통장에 현금이 들어오는 것이 아니라, 다음 연말정산에서 낼 세금이 그만큼 줄어듭니다.`,
      `연금계좌는 문이 세 개인 방과 같습니다. 넣을 때는 공제를 받고, 굴릴 때는 세금을 미루고, 꺼낼 때 연금소득세를 냅니다. 넣을 때 받는 공제율은 ${N.rateLow}, 70세 전에 연금으로 받을 때 내는 세율은 ${N.rateDrawUnder70}입니다. 두 숫자가 다르다는 점이 이 구조의 핵심입니다.`,
      `두 계좌의 쓰임도 다릅니다. 연금저축은 직장 없이도 만들 수 있고, IRP는 퇴직금을 받는 그릇이기도 합니다. 그래서 한도가 둘로 나뉘어 있습니다.`,
    ],
  },
  {
    h: "공제율은 소득에 따라 둘로 갈립니다",
    ps: [
      `공제율은 총급여 5,500만원을 경계로 갈립니다. 이하이면 ${N.rateLow}, 넘으면 ${N.rateHigh}입니다. 둘 다 지방소득세를 포함한 숫자입니다. 그래서 같은 ${N.combinedLimit}이라도 낮은 구간은 ${N.maxCreditLabel}, 높은 구간은 ${N.highCreditLabel}이 됩니다. 차이는 ${N.bracketGapLabel}입니다.`,
      `지방소득세는 소득세의 10%입니다. 15%와 12%에 각각 1.5%포인트와 1.2%포인트가 붙은 것이 ${N.rateLow}와 ${N.rateHigh}입니다.`,
      `공제액은 납입액에 비례합니다. 연금저축만 ${N.savingsLimit}이면 ${N.savingsOnlyLabel}, IRP 200만원을 더해 800만원이면 ${N.irp200Label}입니다.`,
    ],
  },
  {
    h: "내 숫자로 바꾸면",
    ps: [
      `예를 들어 총급여 4,800만원인 사람이 연금저축 600만원, IRP 300만원을 넣으면 공제액은 ${N.maxCreditLabel}입니다. 여기서 IRP를 200만원으로 줄이면 ${N.irp200Label}으로 내려갑니다. 100만원을 덜 넣어 16만 5,000원을 포기하는 셈입니다.`,
      `월 30만원을 연금저축에 넣으면 1년에 360만원입니다. 여기에 IRP 300만원을 더한 660만원이면 공제액은 ${N.monthly30Label}입니다. 한도를 다 채우지 않아도 돌아오는 돈은 비례해서 늘어납니다.`,
    ],
  },
  {
    h: "받을 때는 세율이 내려갑니다",
    ps: [
      `55세 이후 연금으로 받으면 연금소득세는 70세 전 ${N.rateDrawUnder70}, 80세 이상 ${N.rateDraw80}입니다. 오래 들고 갈수록 세율이 낮아집니다. 연금으로 인정받으려면 55세 이후여야 하고, 연금저축은 가입 기간 5년도 채워야 합니다. 그래서 이 계좌는 세금을 안 내는 계좌가 아니라, 세금을 나중에 더 낮게 내는 계좌입니다.`,
    ],
  },
  {
    h: "예외 — 중간에 깨면 계산이 뒤집힙니다",
    ps: [
      `55세 전에 해지해 연금이 아닌 방식으로 찾으면, 공제받은 ${N.combinedLimit}에 기타소득세 ${N.earlyRate}가 다시 붙습니다. 돌려받은 ${N.maxCreditLabel}을 그대로 다시 내는 셈입니다. 2년 뒤 전세 자금처럼 곧 쓸 돈은 연금계좌가 아니라 다른 계좌에 두어야 합니다.`,
      `또 하나, 세액공제는 그해 낸 세금을 넘을 수 없습니다. 소득이 적어 낼 세금이 작으면 돌려받는 금액도 그만큼 작아집니다. 한도는 목표가 아니라 상한입니다.`,
      `한도를 넘겨 넣은 금액은 그해 공제되지 않습니다. 다음 해로 넘겨 공제받는 절차가 따로 있습니다.`,
    ],
  },
  {
    h: "출처와 기준일",
    ps: [
      `근거는 소득세법 제59조의3입니다. 숫자의 기준일은 2026. 11. 21.이고, 제도가 바뀌면 이 글의 금액도 함께 달라집니다. 아래 1차 출처에서 직접 확인해 보세요.`,
    ],
  },
];

/** 원고 분량 — 화면에 '1,4xx자'로 적고, 1,200~1,500자 범위를 벗어나면 빌드에서 알린다. */
export const READING_CHARS = PILOT_READING.reduce(
  (n, s) => n + s.h.replace(/\s/g, "").length + s.ps.join("").replace(/\s/g, "").length,
  0,
);

/** 강의 목록에서 '이미 열린 강의'를 세는 데 쓴다(허브의 파일럿 카드). */
export const OPEN_LESSONS = [{ ...PILOT, href: `/academy/${PILOT.slug}/` }];
