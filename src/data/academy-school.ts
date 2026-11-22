/**
 * 「버핏킴즈 금융생활학교」 52주 편성 — v8.2.0.
 *
 * 출처: 구글 시트 「버핏킴즈 금융생활학교 | 52주 최종기획·교차검증」
 *   (`1B2g7uDzjvDXsIKCt1GgamgzRSCt9AwG0I-sCJhfq0ig`)의 `02 52주 편성` 탭을 그대로 옮겼다.
 *   · 6트랙 × 8편 + 특집 4편 = 52주. 성인 심화 41강(`academy.ts`)과 합산하지 않는다.
 *   · 주차·ID·대상·제목·학습목표·모의 실습·이해 확인 기준·가져갈 것은 시트 열 순서 그대로다.
 *   · `lessonSlug`는 지금 열린 강의가 있는 주에만 붙는다(나머지는 연재 예정).
 */

export type SchoolTrackId =
  | "elementary"
  | "teen"
  | "firstpay"
  | "household"
  | "asset"
  | "retire"
  | "special";

export type SchoolWeek = {
  week: number;
  id: string;
  track: SchoolTrackId;
  /** 시트의 대상 표기 — 초등 · 청소년 · 사회초년 · 가계 · 자산형성 · 은퇴 · 특집 */
  target: string;
  title: string;
  /** 학습목표 */
  goal: string;
  /** 모의 실습 — 가상 금액만 */
  practice: string;
  /** 이해 확인 기준 */
  check: string;
  /** 가져갈 것 — 그 주에 남는 한 장 */
  takeaway: string;
  /** 지금 열린 강의가 이 주를 다루면 그 강의 주소 조각 */
  lessonSlug?: string;
};

export type SchoolTrack = {
  id: SchoolTrackId;
  label: string;
  /** 탭 아래 한 줄 */
  blurb: string;
  weeks: number;
};

export const SCHOOL_TRACKS: SchoolTrack[] = [
  { id: "elementary", label: "초등 고학년", blurb: "용돈·저축·물가 — 가상 금액으로 선택 연습", weeks: 8 },
  { id: "teen", label: "청소년", blurb: "소액결제·BNPL·금융사기 — 1년 비용으로 보기", weeks: 8 },
  { id: "firstpay", label: "첫 월급 · 사회초년생", blurb: "명세서·비상금·첫해 운영표", weeks: 8 },
  { id: "household", label: "가계", blurb: "공동비용·주거·보험금 지급 조건", weeks: 8 },
  { id: "asset", label: "자산형성", blurb: "계좌·수익률·분산·리밸런싱", weeks: 8 },
  { id: "retire", label: "은퇴", blurb: "연금·건강보험·인출 순서", weeks: 8 },
  { id: "special", label: "특집", blurb: "가족 대화·모의 결제·뉴스 읽기", weeks: 4 },
];

export const SCHOOL_WEEKS: SchoolWeek[] = [
  {
    week: 1, id: "FL-01", track: "elementary", target: "초등",
    title: "필요한 것과 갖고 싶은 것",
    goal: "선택 이유 설명",
    practice: "가상 1만 원으로 장바구니 만들기",
    check: "두 품목 중 먼저 살 것과 이유를 말한다",
    takeaway: "용돈 약속 카드",
  },
  {
    week: 2, id: "FL-02", track: "elementary", target: "초등",
    title: "일주일 용돈 세 칸 나누기",
    goal: "지금·목표·남겨둘 돈 구분",
    practice: "7,000원을 세 칸에 배정",
    check: "세 칸 합계 7,000원과 배정 이유를 확인",
    takeaway: "용돈 약속 카드",
    lessonSlug: "school-elementary-allowance",
  },
  {
    week: 3, id: "FL-03", track: "elementary", target: "초등",
    title: "목표 가격과 모을 기간",
    goal: "한 번에 모을 금액 계산",
    practice: "목표 30,000원, 보유 6,000원, 8주",
    check: "주 3,000원. 2주를 쉬면 주 4,000원",
    takeaway: "목표 저금표",
    lessonSlug: "school-elementary-allowance",
  },
  {
    week: 4, id: "FL-04", track: "elementary", target: "초등",
    title: "같은 상품 단위가격 비교",
    goal: "같은 수량 기준으로 비교",
    practice: "100g 1,000원과 200g 1,500원",
    check: "100g당 1,000원과 750원을 비교하고 필요량을 설명",
    takeaway: "가격 비교표",
  },
  {
    week: 5, id: "FL-05", track: "elementary", target: "초등",
    title: "영수증 확인",
    goal: "수량·금액·거스름돈 확인",
    practice: "가상 영수증에서 중복 품목 찾기",
    check: "어떤 항목이 얼마만큼 틀렸는지 찾는다",
    takeaway: "영수증 체크표",
  },
  {
    week: 6, id: "FL-06", track: "elementary", target: "초등",
    title: "게임 속 결제와 환불",
    goal: "가상재화의 실제 가격 읽기",
    practice: "코인 묶음을 원화로 환산",
    check: "실제 결제액과 보호자에게 물을 조건을 말한다",
    takeaway: "결제 전 약속",
  },
  {
    week: 7, id: "FL-07", track: "elementary", target: "초등",
    title: "낯선 경품 링크와 보호자 도움",
    goal: "낯선 요청에서 멈추기",
    practice: "모의 경품 메시지에서 행동 고르기",
    check: "클릭 전 보호자에게 알리고 공식 경로를 확인한다",
    takeaway: "멈춤 카드",
  },
  {
    week: 8, id: "FL-08", track: "elementary", target: "초등",
    title: "가족과 첫 돈 회의",
    goal: "다른 선택의 이유 듣기",
    practice: "가상 용돈을 놓고 두 사람의 배분 비교",
    check: "서로 지킬 약속 하나에 합의한다",
    takeaway: "완성 용돈 약속 카드",
  },
  {
    week: 9, id: "FL-09", track: "teen", target: "청소년",
    title: "월 구독료의 1년 비용",
    goal: "반복 비용을 연간으로 환산",
    practice: "두 구독의 월·연 결제 비교",
    check: "연간 총액과 해지 시 확인할 항목을 표시",
    takeaway: "구독 정리표",
    lessonSlug: "school-teen-payments",
  },
  {
    week: 10, id: "FL-10", track: "teen", target: "청소년",
    title: "알바 급여명세서",
    goal: "근무시간·공제·입금액 구분",
    practice: "가상 명세서의 합계 읽기",
    check: "일한 시간, 총액, 받은 금액을 구분",
    takeaway: "첫 명세서 읽기표",
  },
  {
    week: 11, id: "FL-11", track: "teen", target: "청소년",
    title: "통장과 체크카드",
    goal: "잔액·거래내역·결제 한도 구분",
    practice: "두 모의 거래의 결제 후 잔액 계산",
    check: "남은 잔액을 계산하고 내역에서 확인",
    takeaway: "통장 점검표",
  },
  {
    week: 12, id: "FL-12", track: "teen", target: "청소년",
    title: "빌린 돈과 이자",
    goal: "원금과 총상환액 구분",
    practice: "같은 원금의 두 상환 조건 비교",
    check: "이자와 수수료를 포함해 총비용 비교",
    takeaway: "총상환 비교표",
    lessonSlug: "school-teen-payments",
  },
  {
    week: 13, id: "FL-13", track: "teen", target: "청소년",
    title: "물가와 구매력",
    goal: "같은 돈의 구매량 변화 설명",
    practice: "품목 가격이 오른 장바구니 비교",
    check: "명목 용돈과 실제 구매량을 구분",
    takeaway: "구매력 카드",
  },
  {
    week: 14, id: "FL-14", track: "teen", target: "청소년",
    title: "SNS 투자 권유 읽기",
    goal: "수익 보장 표현 검토",
    practice: "가상 광고의 근거·비용·위험 표시",
    check: "빠진 정보 두 가지와 확인 경로 제시",
    takeaway: "광고 확인표",
  },
  {
    week: 15, id: "FL-15", track: "teen", target: "청소년",
    title: "이상 송금 요청과 도움받기",
    goal: "본인 확인과 공식 신고 경로 구분",
    practice: "합성 송금 요청을 보고 순서 선택",
    check: "송금 전 별도 연락으로 확인하고 도움을 요청",
    takeaway: "송금 전 확인표",
    lessonSlug: "school-teen-payments",
  },
  {
    week: 16, id: "FL-16", track: "teen", target: "청소년",
    title: "첫 월간예산 다시 짜기",
    goal: "예상 밖 지출에 대응",
    practice: "교통비가 늘어난 가상 월예산 수정",
    check: "변경 전후 합계와 줄일 항목 확인",
    takeaway: "완성 결제·송금 확인표",
  },
  {
    week: 17, id: "FL-17", track: "firstpay", target: "사회초년",
    title: "첫 월급명세서",
    goal: "세전·공제·실수령 구분",
    practice: "가상 급여명세서 재구성",
    check: "명세 항목과 입금액 대조",
    takeaway: "실수령 확인표",
    lessonSlug: "school-firstpay-stub",
  },
  {
    week: 18, id: "FL-18", track: "firstpay", target: "사회초년",
    title: "고정비·변동비·돌발지출",
    goal: "지출 성격을 분류",
    practice: "가상 한 달 거래에 태그 지정",
    check: "항목 분류와 여유금 산출",
    takeaway: "월 현금흐름표",
    lessonSlug: "school-firstpay-stub",
  },
  {
    week: 19, id: "FL-19", track: "firstpay", target: "사회초년",
    title: "소득 공백과 비상금",
    goal: "필수비 기준으로 공백 계산",
    practice: "가상 저축액을 월 필수비로 나누기",
    check: "버틸 수 있는 기간과 가정 명시",
    takeaway: "비상금 계획",
  },
  {
    week: 20, id: "FL-20", track: "firstpay", target: "사회초년",
    title: "카드 결제·할부·연체 비용",
    goal: "월 부담과 전체 부담 구분",
    practice: "가상 결제 조건에서 총비용 비교",
    check: "월 납부액과 총 납부액을 함께 설명",
    takeaway: "결제 비용표",
  },
  {
    week: 21, id: "FL-21", track: "firstpay", target: "사회초년",
    title: "대출 계약서에서 볼 숫자",
    goal: "금리·기간·상환 조건 구분",
    practice: "두 모의 대출 견적에 표시",
    check: "총비용과 중도상환 조건 찾기",
    takeaway: "대출 비교표",
  },
  {
    week: 22, id: "FL-22", track: "firstpay", target: "사회초년",
    title: "전월세 계약 비용",
    goal: "초기비용과 월비용 분리",
    practice: "보증금·월세·이사비 달력 표시",
    check: "입주 전 필요한 현금과 월비용 산출",
    takeaway: "입주 예산표",
  },
  {
    week: 23, id: "FL-23", track: "firstpay", target: "사회초년",
    title: "세전과 세후 수익",
    goal: "명목 수익과 실수령 구분",
    practice: "예시 세액·수수료를 빼기",
    check: "선택 근거와 가정 표기",
    takeaway: "실수령 비교표",
  },
  {
    week: 24, id: "FL-24", track: "firstpay", target: "사회초년",
    title: "첫해 운영표",
    goal: "점검 일자와 자동 이체 우선순위 설정",
    practice: "월 단위 납부·저축 일정 배치",
    check: "첫 달 실행 항목과 재검토일 지정",
    takeaway: "완성 첫 월급 운영표",
  },
  {
    week: 25, id: "FL-25", track: "household", target: "가계",
    title: "공동비용과 개인비용",
    goal: "가구 분담 기준 비교",
    practice: "가상 가계에 균등·비례 배분",
    check: "두 방식 차이와 합의 항목 한 가지",
    takeaway: "가계 분담표",
  },
  {
    week: 26, id: "FL-26", track: "household", target: "가계",
    title: "보증금·월세·이사비의 총비용",
    goal: "주거 선택 총비용 비교",
    practice: "이사 시나리오 두 개 비교",
    check: "월비용과 초기 현금을 각각 제시",
    takeaway: "주거 비용표",
  },
  {
    week: 27, id: "FL-27", track: "household", target: "가계",
    title: "고정금리와 변동금리",
    goal: "금리 변화가 월 부담에 미치는 영향 파악",
    practice: "가상 금리 변동 시나리오 비교",
    check: "비용 범위와 감당 가능한 조건 표시",
    takeaway: "대출 경계표",
  },
  {
    week: 28, id: "FL-28", track: "household", target: "가계",
    title: "생애 이벤트 예산",
    goal: "기한과 우선순위를 배치",
    practice: "이사·교육·수리의 예상 지출 달력",
    check: "같은 달 겹치는 지출의 조정안 작성",
    takeaway: "연간 지출표",
  },
  {
    week: 29, id: "FL-29", track: "household", target: "가계",
    title: "보험금 지급 조건 읽기",
    goal: "보장금액과 지급 요건 구분",
    practice: "합성 약관에서 정의·면책·증빙 표시",
    check: "같은 금액이어도 결과가 다른 이유 설명",
    takeaway: "약관 읽기표",
  },
  {
    week: 30, id: "FL-30", track: "household", target: "가계",
    title: "교육비와 노후의 동시 계획",
    goal: "가까운 목표와 먼 목표 나누기",
    practice: "서로 다른 기한의 가상 적립계획 비교",
    check: "월 배분과 조정할 때의 원칙 설정",
    takeaway: "목표 배치표",
  },
  {
    week: 31, id: "FL-31", track: "household", target: "가계",
    title: "돌봄과 소득 공백",
    goal: "돌봄 비용과 소득 변화 동시 반영",
    practice: "6개월 가상 돌봄 시나리오 비교",
    check: "월 부족액과 다시 확인할 항목 산출",
    takeaway: "돌봄 비용표",
  },
  {
    week: 32, id: "FL-32", track: "household", target: "가계",
    title: "가계 스트레스 실습",
    goal: "가정이 바뀌면 행동계획 수정",
    practice: "소득 감소와 돌발 지출을 함께 적용",
    check: "우선순위와 다음 검토일을 결정",
    takeaway: "완성 가계 자금 일정표",
  },
  {
    week: 33, id: "FL-33", track: "asset", target: "자산형성",
    title: "계좌와 상품의 차이",
    goal: "담는 곳과 담는 자산 구분",
    practice: "가상 계좌·상품 카드 짝짓기",
    check: "인출 제약과 자산 위험을 각각 설명",
    takeaway: "계좌 역할표",
  },
  {
    week: 34, id: "FL-34", track: "asset", target: "자산형성",
    title: "수익률과 손실률",
    goal: "손실 후 회복률 비교",
    practice: "가상 100이 80이 된 뒤 필요한 상승률 계산",
    check: "손실 20%와 회복 25%의 차이 설명",
    takeaway: "수익·손실 카드",
  },
  {
    week: 35, id: "FL-35", track: "asset", target: "자산형성",
    title: "물가·수수료·세후 수익",
    goal: "실질 순수익을 비교",
    practice: "같은 표면 수익의 두 가상 사례 비교",
    check: "비용·세금·물가를 구분해 설명",
    takeaway: "순수익 확인표",
  },
  {
    week: 36, id: "FL-36", track: "asset", target: "자산형성",
    title: "분산과 집중",
    goal: "종목 수와 위험 노출의 차이 이해",
    practice: "구성 자산이 겹치는 두 포트 비교",
    check: "겹치는 위험을 한 가지 식별",
    takeaway: "집중도 점검표",
  },
  {
    week: 37, id: "FL-37", track: "asset", target: "자산형성",
    title: "ETF 구성과 비용 읽기",
    goal: "기초지수·구성·비용 구분",
    practice: "가상 운용설명서에서 핵심 항목 표시",
    check: "같은 테마 ETF 차이 두 가지 설명",
    takeaway: "ETF 비교표",
  },
  {
    week: 38, id: "FL-38", track: "asset", target: "자산형성",
    title: "ISA·연금저축·IRP 비교 기준",
    goal: "목표·입출금 조건·세제 비교",
    practice: "2년 후 목돈과 은퇴 준비의 선택 사례",
    check: "적용 조건과 확인할 공식 자료 표시",
    takeaway: "계좌 선택표",
  },
  {
    week: 39, id: "FL-39", track: "asset", target: "자산형성",
    title: "리밸런싱 판단",
    goal: "비중 이탈·비용 확인",
    practice: "목표 비중과 현재 비중 비교",
    check: "무조정·추가 납입·매매의 차이 설명",
    takeaway: "점검 규칙",
  },
  {
    week: 40, id: "FL-40", track: "asset", target: "자산형성",
    title: "장기 운영 규칙 만들기",
    goal: "실행 조건과 변경 조건 문서화",
    practice: "가상 하락장 대응 규칙 작성",
    check: "손실·비용·유동성을 포함한 규칙 완성",
    takeaway: "완성 투자 운영 원칙",
  },
  {
    week: 41, id: "FL-41", track: "retire", target: "은퇴",
    title: "은퇴 후 월 생활비",
    goal: "필수비와 선택비 구분",
    practice: "가상 은퇴 가계 월지출 배치",
    check: "필수비 합계와 여유 범위 계산",
    takeaway: "은퇴 지출표",
  },
  {
    week: 42, id: "FL-42", track: "retire", target: "은퇴",
    title: "국민·퇴직·개인연금 지도",
    goal: "소득원과 개시 시점 구분",
    practice: "세 가지 모의 연금 일정을 달력에 표시",
    check: "공백이 생기는 구간과 확인 기관 찾기",
    takeaway: "연금 지도",
  },
  {
    week: 43, id: "FL-43", track: "retire", target: "은퇴",
    title: "연금 개시와 인출 일정",
    goal: "인출의 시간 순서 비교",
    practice: "모의 현금흐름 두 가지 실습",
    check: "월 부족액과 인출 가정 명시",
    takeaway: "인출 일정표",
  },
  {
    week: 44, id: "FL-44", track: "retire", target: "은퇴",
    title: "건강보험료 확인 경로",
    goal: "세금과 건보 판단을 구분",
    practice: "가상의 소득·가입 형태 사례에서 문의 항목 찾기",
    check: "공식 기관에 확인할 질문 두 가지 작성",
    takeaway: "건보 확인표",
  },
  {
    week: 45, id: "FL-45", track: "retire", target: "은퇴",
    title: "의료·돌봄 지출",
    goal: "반복비용과 큰 일회비용 분리",
    practice: "가상 돌봄기간을 바꿔 예산 비교",
    check: "가정과 추가 확인이 필요한 비용 표시",
    takeaway: "돌봄 예산표",
  },
  {
    week: 46, id: "FL-46", track: "retire", target: "은퇴",
    title: "가족 간 돈 의사결정",
    goal: "정보 접근·결정·도움 요청 구분",
    practice: "가상 상황의 역할 카드 배치",
    check: "가족과 나눌 결정·문의 사항 구분",
    takeaway: "가족 대화 카드",
  },
  {
    week: 47, id: "FL-47", track: "retire", target: "은퇴",
    title: "은퇴층 금융사기 모의 연습",
    goal: "입금 요청을 공식 경로로 재확인",
    practice: "가상 기관 사칭 메시지 대응 선택",
    check: "멈춤·별도 확인·도움 요청 순서 설명",
    takeaway: "사기 대응 카드",
  },
  {
    week: 48, id: "FL-48", track: "retire", target: "은퇴",
    title: "1년 인출·현금흐름 점검",
    goal: "월 운영표에 변동 요인 반영",
    practice: "수입 개시 지연 시 12개월 달력 수정",
    check: "예상 부족월과 점검일 표시",
    takeaway: "완성 은퇴 월급표",
  },
  {
    week: 49, id: "FL-49", track: "special", target: "특집",
    title: "가족이 만 원을 다르게 쓰는 이유",
    goal: "세대별 우선순위 설명",
    practice: "같은 가상 만 원을 나이별로 배분",
    check: "각 세대의 이유 한 가지씩 확인",
    takeaway: "가족 대화 기록",
  },
  {
    week: 50, id: "FL-50", track: "special", target: "특집",
    title: "모의 결제·사기 대응 실전",
    goal: "낯선 요청에서 올바른 순서 선택",
    practice: "게임 결제·송금 요청 모의 사례 풀기",
    check: "서로 다른 상황에서 대응을 구분",
    takeaway: "가족 안전 체크표",
  },
  {
    week: 51, id: "FL-51", track: "special", target: "특집",
    title: "경제뉴스에서 내 돈에 필요한 숫자 찾기",
    goal: "숫자·단위·기준기간 읽기",
    practice: "공개 공지의 날짜·비교 기준 표시",
    check: "달라진 사실 하나와 영향 경로 설명",
    takeaway: "뉴스 읽기 카드",
  },
  {
    week: 52, id: "FL-52", track: "special", target: "특집",
    title: "내 돈 운영표 총정리",
    goal: "한 해 배운 내용을 점검",
    practice: "내 상황의 플랜과 다음 점검일 기록",
    check: "목표·실행·재검토 일정을 각각 한 줄로 완성",
    takeaway: "다음 해 점검표",
  },
];

/** 트랙별 주 — 탭 필터가 읽는다 */
export const weeksOfTrack = (track: SchoolTrackId) => SCHOOL_WEEKS.filter((w) => w.track === track);

/** 지금 열린 강의가 있는 주 — 허브에서 '지금 열림' 표시에 쓴다 */
export const OPEN_WEEKS = SCHOOL_WEEKS.filter((w) => w.lessonSlug);

export const SCHOOL_COUNTS = {
  weeks: SCHOOL_WEEKS.length,
  tracks: SCHOOL_TRACKS.length,
  openWeeks: OPEN_WEEKS.length,
} as const;
