/**
 * 유용한앱 2탄 — 텍스트·문서·보안·디자인 유틸리티 8종의 앱스토어 데이터.
 *
 * 이 파일은 **메인 병합용 대기 파일**이다. 공유 파일(`apps.ts`, `store.ts`, `run.astro`,
 * `ToolRunner.tsx`)을 건드리지 않기 위해 여기서만 App·StoreItem 모양을 만든다.
 *
 * ── 병합 순서 (메인에서 4곳 + α) ─────────────────────────────────────
 * 1) `src/data/apps.ts`
 *    · `App["art"]` 유니언에 `UtilsArt`(이 파일의 8개 키)를 더한다.
 *    · `apps` 배열 끝에 `...utilsBApps`를 펼친다. 이걸로 카드·상세·실행 페이지가 함께 생긴다.
 * 2) `src/data/store.ts`
 *    · `StoreIcon` 유니언에 `UtilsArt`를 더하고, `artToIcon`에 8개를 1:1로 매핑한다.
 *    · **`utilsBStore`는 storeItems에 펼치지 않는다** — 1)에서 apps에 넣으면 `fromApps`가
 *      같은 카드를 이미 만들기 때문에, 둘 다 넣으면 카드가 두 번 나온다(실제로 확인함).
 *    · 정렬은 `orderBySlug`에 8개를 더한다(값은 아래 `utilsBStore`의 `order` 그대로).
 * 3) `src/components/tools/ToolRunner.tsx`
 *    · 8개 컴포넌트를 import하고 `MAP`에 `UTILS_B_RUNNER`의 slug→컴포넌트를 그대로 연결한다.
 * 4) `src/components/apps/AppStoreIcon.astro`
 *    · `name` 유니언에 8개 키를 더하고 `paths`에 `UTILS_B_ICONS`의 경로를 붙인다(24px 선 격자).
 * 5) 상세 페이지 도해(`AppArt.astro`) — 새 art 키에는 분기가 없어 자리가 빈다.
 *    · `art` prop 유니언에 8개 키를 더하고, 아래 `UTILS_B_ART_ROWS`로 3단 도해를 그리면 된다
 *      (예: guide 분기와 같은 모양으로 ● 1·2·3 목록).
 *    · 도해를 만들기 전까지는 빈 자리가 보이므로, 병합과 같은 커밋에서 처리하는 편이 좋다.
 */
import type { App, AppCategoryId } from "./apps.ts";
import type { StoreItem } from "./store.ts";

export type UtilsArt =
  | "text-counter"
  | "privacy-masker"
  | "json-csv-formatter"
  | "diff-checker"
  | "color-extractor"
  | "text-to-card"
  | "unit-date-calc";

/** App의 `art`만 이 파일 전용 키로 바꾼 모양 — 병합할 때 apps.ts의 유니언에 키를 더하면 그대로 맞는다 */
export type UtilsApp = Omit<App, "art"> & { art: UtilsArt };
export type UtilsStoreItem = Omit<StoreItem, "icon"> & { icon: UtilsArt; category: AppCategoryId };

const MADE_IN = "2026년 11월";
const STATUS = "live" as const;

export const utilsBApps: UtilsApp[] = [
  {
    slug: "text-counter",
    name: "글자수·스레드 분할",
    subtitle: "몇 자인지, 어디서 끊을지 한 번에",
    summary:
      "공백 포함·제외 글자수, UTF-8 바이트, 200자 원고지 매수를 세고, 스레드 500자를 넘으면 문장 단위로 나눠 편마다 복사할 수 있게 합니다.",
    question: "이 글은 몇 자이고, 어디서 끊어야 하나",
    kind: "텍스트",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "쓴 글의 분량을 세고, 스레드 한도를 넘으면 문장 중간에서 끊기지 않게 나눠 줍니다.",
    why: [
      "글을 올리기 직전에 가장 자주 하는 일이 글자수를 세는 일입니다. 그런데 세는 기준이 도구마다 다릅니다. 공백을 넣고 세는 곳, 빼고 세는 곳, 바이트로 세는 곳이 섞여 있어서 같은 글도 숫자가 달라집니다.",
      "스레드는 한 편에 500자입니다. 넘치면 두 편으로 나눠야 하는데, 문장 중간에서 잘리면 읽는 사람이 첫 편에서 멈춥니다. 그래서 세는 일과 끊는 일을 한 화면에 두었습니다.",
    ],
    features: [
      {
        title: "네 가지 기준을 같이",
        body: "공백 포함·제외 글자수, 단어 수, UTF-8 바이트, 200자 원고지 매수를 동시에 보여 줍니다.",
      },
      {
        title: "문장 단위 분할",
        body: "마침표·줄바꿈에서 먼저 끊고, 한 문장이 한도를 넘을 때만 쉼표·공백 순으로 자릅니다.",
      },
      {
        title: "편마다 복사",
        body: "나뉜 편마다 글자수와 복사 버튼이 붙습니다. 1/4 같은 번호를 붙일지도 고를 수 있습니다.",
      },
      {
        title: "기준 선택",
        body: "스레드 500자 외에 X 280자, 인스타그램 캡션 2,200자 기준으로도 나눌 수 있습니다.",
      },
    ],
    audience: "스레드·SNS에 글을 올리는 사람, 원고 분량을 맞춰야 하는 사람.",
    basis: [
      "스레드 한 편 500자, X 280자, 인스타그램 캡션 2,200자는 각 서비스가 안내하는 작성 한도입니다.",
      "원고지 매수는 공백 제외 글자수를 200으로 나눠 올림한 값입니다. 실제 원고지 작성 규칙(한 칸에 한 글자, 줄바꿈 포함)과는 다를 수 있습니다.",
      "글자 수는 유니코드 문자(코드 포인트) 기준이라 이모지를 2자로 세지 않습니다.",
    ],
    inputs: ["글", "나눌 기준(500·280·2,200자)", "편 번호 표시 여부"],
    outputs: ["공백 포함·제외 글자수", "UTF-8 바이트", "200자 원고지 매수", "나뉜 편과 편별 글자수"],
    runNote: "글을 붙여넣으면 분량이 바로 세지고, 한도를 넘으면 문장 단위로 나뉩니다.",
    sourceLine: "서비스별 작성 한도(스레드 500자·X 280자·인스타그램 2,200자) · 기준일 2026. 11. 21.",
    assumptions: ["한 글자에 3바이트를 쓰는 한글 기준으로 바이트를 계산합니다(UTF-8)."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "text-counter",
    tags: ["글자수", "바이트", "원고지", "스레드", "500자", "분할"],
  },
  {
    slug: "privacy-masker",
    name: "개인정보 가리기",
    subtitle: "보내기 전에 번호부터 지우기",
    summary:
      "글 안의 전화번호·주민등록번호·계좌번호·이메일·카드번호를 찾아 앞뒤 몇 자리만 남기고 *로 가린 사본을 만듭니다.",
    question: "이 글에서 무엇을 지우고 보내야 하나",
    kind: "보안",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "상담 내용·거래 내역을 남에게 보내기 전에, 번호와 계좌를 한 번에 가립니다.",
    why: [
      "상담 메모나 거래 내역을 메신저로 넘길 때, 필요한 정보보다 많은 것이 함께 갑니다. 이름과 계좌번호까지 그대로 가는 일이 흔합니다.",
      "손으로 지우면 빠뜨립니다. 그래서 번호 모양을 찾아 자동으로 가리고, 어디를 가렸는지 원문에 색으로 표시해 확인할 수 있게 했습니다.",
    ],
    features: [
      {
        title: "다섯 가지 번호 탐지",
        body: "전화번호, 주민등록번호, 카드번호, 계좌번호, 이메일을 한 번에 찾습니다.",
      },
      {
        title: "앞뒤만 남기는 마스킹",
        body: "010-****-5678처럼 확인은 되고 그대로는 쓸 수 없게 가립니다. 형식(하이픈)은 유지합니다.",
      },
      {
        title: "원문 위치 표시",
        body: "어디가 잡혔는지 원문에 색으로 보여 줘서, 빠진 정보가 없는지 눈으로 확인합니다.",
      },
      {
        title: "한 번에 복사",
        body: "가린 사본을 그대로 복사해 메일에 붙일 수 있습니다. 원문은 어디에도 저장되지 않습니다.",
      },
    ],
    audience: "고객 메모·거래 내역을 외부로 보내는 사람, 개인정보가 섞인 글을 공유해야 하는 사람.",
    basis: [
      "탐지는 정규식 패턴입니다. 주민등록번호 13자리, 카드번호 16자리, 국내 전화번호 형식처럼 모양이 정해진 번호만 잡습니다.",
      "이름·주소·차량번호·외국인등록번호처럼 모양이 일정하지 않은 정보는 잡지 못합니다. 자동 마스킹은 보조 수단이고, 최종 확인은 사람이 해야 합니다.",
    ],
    inputs: ["가릴 글이 담긴 텍스트"],
    outputs: ["가린 사본", "유형별 탐지 건수", "원문에서 잡힌 위치"],
    runNote: "글을 붙여넣으면 번호를 찾아 가린 사본을 만들고, 어디를 가렸는지 표시합니다.",
    sourceLine: "국내 전화번호·주민등록번호·카드번호 형식 기준 · 기준일 2026. 11. 21.",
    assumptions: ["가린 결과와 원문 모두 브라우저 메모리에만 있고, 새로 고치면 사라집니다."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "privacy-masker",
    tags: ["개인정보", "마스킹", "주민등록번호", "계좌번호", "가림"],
  },
  {
    slug: "json-csv-formatter",
    name: "JSON·CSV 정리",
    subtitle: "데이터를 표로, 표를 데이터로",
    summary:
      "JSON을 들여쓰기해 펴거나 한 줄로 압축하고 문법 오류 위치를 알려 줍니다. CSV와 마크다운 표도 서로 바꿉니다.",
    question: "이 데이터는 어디가 틀렸고, 표로는 어떻게 생겼나",
    kind: "문서·데이터",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "JSON 문법을 확인해 펴 주고, CSV를 마크다운 표로(또는 반대로) 바꿔 줍니다.",
    why: [
      "API 응답이나 설정 파일을 붙여넣었을 때, 한 줄로 뭉개진 JSON은 눈으로 읽을 수 없습니다. 어디가 틀렸는지도 알려 주지 않으면 괄호를 하나씩 세어야 합니다.",
      "표도 마찬가지입니다. 엑셀에서 복사한 CSV를 블로그나 노션에 붙이려면 마크다운 표 문법으로 바꿔야 하는데, 손으로 하면 칸이 어긋납니다.",
    ],
    features: [
      {
        title: "JSON 펴기·압축",
        body: "들여쓰기 2칸으로 펴거나, 전송용으로 한 줄로 줄입니다. 키 개수와 깊이도 함께 셉니다.",
      },
      {
        title: "오류 위치 안내",
        body: "문법이 틀리면 몇 번째 줄·칸 근처인지와 그 부분을 보여 줍니다.",
      },
      {
        title: "CSV → 마크다운 표",
        body: "따옴표로 감싼 칸, 칸 안의 쉼표·줄바꿈까지 지켜 읽고 표 문법으로 바꿉니다.",
      },
      {
        title: "표 → CSV",
        body: "마크다운 표를 다시 CSV로. 칸에 구분자가 있으면 자동으로 따옴표를 붙입니다.",
      },
    ],
    audience: "API 응답·설정 파일을 읽는 사람, 엑셀 데이터를 문서에 표로 옮기는 사람.",
    basis: [
      "JSON은 브라우저의 JSON.parse로 검증합니다. 주석(//), 작은따옴표, 마지막 쉼표는 표준 JSON이 아니므로 오류로 표시됩니다.",
      "CSV는 RFC 4180의 따옴표 규칙(칸 안의 구분자·줄바꿈, 따옴표 두 번 이스케이프)을 따릅니다.",
      "마크다운 표는 첫 줄을 머리행으로, 두 번째 줄의 --- 를 정렬 줄로 씁니다.",
    ],
    inputs: ["JSON 텍스트", "CSV 텍스트 또는 마크다운 표", "구분자(쉼표·탭·세미콜론)"],
    outputs: ["펴거나 압축한 JSON", "문법 오류 위치", "마크다운 표 문법", "CSV"],
    runNote: "JSON을 붙여넣으면 바로 펴서 보여 주고, CSV는 표와 표 문법으로 함께 보여 줍니다.",
    sourceLine: "RFC 4180(CSV), JSON 표준(RFC 8259) · 기준일 2026. 11. 21.",
    assumptions: ["변환은 브라우저에서만 하고, 붙여넣은 데이터를 저장하거나 전송하지 않습니다."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "json-csv-formatter",
    tags: ["JSON", "CSV", "마크다운", "표", "포맷", "정리"],
  },
  {
    slug: "diff-checker",
    name: "두 글 비교",
    subtitle: "무엇이 바뀌었는지 색으로",
    summary:
      "원문 A와 수정본 B를 나란히 넣으면 바뀐 줄을 맞춰 놓고, 짝지어진 줄은 바뀐 단어까지 색으로 표시합니다.",
    question: "수정하면서 무엇이 달라졌나",
    kind: "문서",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "두 글을 줄 단위로 맞춰 놓고, 들어온 것과 나간 것을 색으로 보여 줍니다.",
    why: [
      "원고를 두 번 고치면, 어디를 고쳤는지 기억에 의존하게 됩니다. 눈으로 두 글을 번갈아 읽으면 빠뜨린 곳이 생깁니다.",
      "줄만 맞추면 '한 줄이 통째로 바뀌었다'까지만 보입니다. 그래서 짝지어진 줄은 단어 단위로 다시 비교해, 어느 단어가 빠지고 들어왔는지까지 표시합니다.",
    ],
    features: [
      {
        title: "줄 맞춤 비교",
        body: "같은 줄은 그대로 두고, 늘어난 줄과 빠진 줄을 좌우로 맞춰 보여 줍니다.",
      },
      {
        title: "단어 단위 표시",
        body: "바뀐 줄은 단어 경계로 다시 비교해, 삭제는 붉게 추가는 초록으로 칠합니다.",
      },
      {
        title: "요약 숫자",
        body: "추가·삭제·변경·동일 줄 수와 일치율을 함께 보여 줍니다.",
      },
      {
        title: "바뀐 줄만 보기",
        body: "긴 글에서 달라진 곳만 모아 봅니다. A와 B를 바꿔 보는 버튼도 있습니다.",
      },
    ],
    audience: "원고를 여러 번 고치는 사람, 계약서·약관 개정 전후를 비교하는 사람.",
    basis: [
      "줄 비교는 최장 공통 부분수열(LCS)로 맞춥니다. 같은 순서로 나타나는 줄을 최대한 남기는 방식입니다.",
      "한글 단어 경계는 브라우저의 Intl.Segmenter를 쓰고, 지원하지 않는 환경에서는 공백 기준으로 나눕니다.",
      "한쪽이 1,200줄을 넘으면 앞부분만 비교합니다.",
    ],
    inputs: ["원문 A", "수정본 B"],
    outputs: ["나란히 맞춘 줄", "바뀐 단어 강조", "추가·삭제·변경·동일 줄 수와 일치율"],
    runNote: "예시 원고 두 편이 들어 있습니다. 한쪽을 고치면 바로 표시가 바뀝니다.",
    sourceLine: "줄 단위 LCS 비교 · 기준일 2026. 11. 21.",
    assumptions: ["줄바꿈이 다르면 다른 줄로 봅니다. 공백만 다른 줄은 같은 줄로 봅니다."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "diff-checker",
    tags: ["diff", "비교", "원고", "수정", "LCS"],
  },
  {
    slug: "color-extractor",
    name: "이미지 대표색 추출",
    subtitle: "사진에서 색 여섯 개 뽑기",
    summary:
      "이미지를 올리면 픽셀을 세어 대표색 6개를 뽑고 HEX·RGB와 비중, 글자 대비까지 보여 줍니다. 색을 누르면 복사됩니다.",
    question: "이 이미지의 색을 코드로 쓰려면 무슨 값인가",
    kind: "디자인",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "사진·썸네일의 대표색을 뽑아 HEX·RGB로 바꿔 주고, CSS 변수로도 만들어 줍니다.",
    why: [
      "카드뉴스나 썸네일을 만들 때, 이미지에서 색을 집어 오려면 스포이드 도구를 따로 켜야 합니다. 색을 여섯 개 뽑으려면 여섯 번 반복해야 합니다.",
      "색을 뽑는 것보다 중요한 것은 그 색 위에 글씨가 읽히는지입니다. 그래서 대표색마다 흰 글씨·검은 글씨의 대비를 함께 계산해, 배경으로 쓸 수 있는 색인지 알려 줍니다.",
    ],
    features: [
      {
        title: "대표색 6개",
        body: "픽셀을 32단계로 묶어 세고, 많은 순서로 보면서 서로 충분히 다른 색만 남깁니다.",
      },
      {
        title: "HEX·RGB·비중",
        body: "색마다 16진수 코드, RGB 값, 화면에서 차지하는 비율을 함께 보여 줍니다.",
      },
      {
        title: "눌러서 복사",
        body: "색 타일을 누르면 HEX가 복사됩니다. 전체 HEX와 CSS 변수도 한 번에 복사합니다.",
      },
      {
        title: "글자 대비 확인",
        body: "가장 많은 색 위에 흰 글씨·검은 글씨를 얹었을 때의 대비를 계산해 줍니다.",
      },
    ],
    audience: "카드뉴스·썸네일을 만드는 사람, 사이트 색을 이미지에서 맞추는 사람.",
    basis: [
      "색은 채널당 5비트(32단계)로 묶어 세고, 각 묶음의 평균색을 씁니다. 아주 미세한 그라데이션은 한 색으로 합쳐집니다.",
      "대비는 WCAG 2.1의 상대 휘도 공식으로 계산합니다. 본문 글씨 기준 4.5:1, 큰 글씨 기준 3:1을 넘겨야 읽힙니다.",
      "투명도 50% 미만 픽셀은 세지 않습니다.",
    ],
    inputs: ["이미지 파일(PNG·JPG·WEBP, 15MB 이하)"],
    outputs: ["대표색 6개(HEX·RGB·비중)", "가장 많은 색과 글자 대비", "CSS 변수 묶음"],
    runNote: "이미지를 끌어 놓거나 골라 주세요. 이미지는 브라우저 밖으로 나가지 않습니다.",
    sourceLine: "WCAG 2.1 대비 공식 · 기준일 2026. 11. 21.",
    assumptions: ["긴 변 260px로 줄여 그린 뒤 픽셀을 읽습니다. 아주 작은 점 하나의 색은 대표색에 들지 않을 수 있습니다."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "color-extractor",
    tags: ["색추출", "컬러", "HEX", "RGB", "팔레트", "디자인"],
  },
  {
    slug: "text-to-card",
    name: "텍스트 → 카드 이미지",
    subtitle: "제목·본문을 4:5 카드로",
    summary:
      "짧은 제목과 본문, 출처를 넣으면 1080×1350(4:5) PNG 카드로 그려 줍니다. 다크·크림·딥그린 세 가지 배경을 고를 수 있습니다.",
    question: "이 문장을 카드 한 장으로 만들려면",
    kind: "디자인",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "글을 넣으면 인스타그램·스레드에 올릴 수 있는 4:5 카드 이미지로 만들어 줍니다.",
    why: [
      "카드뉴스 한 장을 만들려고 디자인 도구를 켜면, 레이아웃을 잡고 글자 크기를 맞추는 데 시간이 더 듭니다. 정작 하고 싶은 일은 문장을 보기 좋게 놓는 것뿐입니다.",
      "그래서 글자만 넣으면 되게 만들었습니다. 제목은 길이에 따라 크기를 줄여 세 줄 안에 담고, 본문은 남는 자리만큼만 넣습니다. 미리보기와 저장되는 PNG가 같은 캔버스라 어긋나지 않습니다.",
    ],
    features: [
      {
        title: "1080×1350 PNG",
        body: "인스타그램 피드·스레드에 그대로 올릴 수 있는 4:5 비율로 저장합니다.",
      },
      {
        title: "세 가지 테마",
        body: "다크·크림·딥그린. 사이트의 색 토큰에서 가져와 글과 배경의 대비를 유지합니다.",
      },
      {
        title: "글자 크기 자동",
        body: "제목 길이에 따라 92~56px 사이에서 줄여 세 줄에 담고, 넘치는 본문은 줄임표로 마무리합니다.",
      },
      {
        title: "미리보기 = 저장본",
        body: "화면에 보이는 캔버스를 그대로 PNG로 저장합니다. 글꼴이 늦게 붙어도 한 번 더 그립니다.",
      },
    ],
    audience: "금융·보험 이야기를 카드 한 장으로 정리하는 사람, SNS용 이미지를 빠르게 만들어야 하는 사람.",
    basis: [
      "카드 비율 4:5(1080×1350)는 인스타그램 피드 권장 비율입니다.",
      "글꼴은 사이트 본문과 같은 Pretendard 계열을 쓰고, 없으면 기기 기본 고딕으로 그립니다.",
      "출처 칸은 카드 아래에 작게 들어갑니다. 숫자·기준일을 넣어 두면 카드만 따로 돌아다녀도 기준이 남습니다.",
    ],
    inputs: ["제목", "본문", "출처", "배경 테마"],
    outputs: ["1080×1350 카드 미리보기", "PNG 파일"],
    runNote: "예시 문장으로 카드가 그려져 있습니다. 글을 바꾸면 미리보기가 바로 바뀝니다.",
    sourceLine: "인스타그램 피드 권장 비율 4:5 · 기준일 2026. 11. 21.",
    assumptions: ["입력한 글은 브라우저 안에서만 그려지고 서버로 전송되지 않습니다."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "text-to-card",
    tags: ["카드뉴스", "이미지", "PNG", "4:5", "썸네일", "디자인"],
  },
  {
    slug: "unit-date-calc",
    name: "날짜 계산·단위 변환",
    subtitle: "며칠 남았나, 몇 ㎡인가",
    summary:
      "두 날짜 사이 일수와 D-Day, 주말을 뺀 영업일을 세고, 평↔㎡·인치↔cm·MB↔GB를 즉시 바꿉니다.",
    question: "며칠 남았고, 이 숫자는 얼마인가",
    kind: "생활 계산",
    madeIn: MADE_IN,
    status: STATUS,
    oneLine:
      "날짜 사이 일수·영업일과 D-Day를 세고, 평·인치·용량을 서로 바꿔 줍니다.",
    why: [
      "계약 만기, 서류 제출, 보험 갱신처럼 날짜를 놓치면 손해인 일이 많습니다. 그런데 '며칠 남았나'를 셀 때 주말을 빼야 하는지 헷갈립니다.",
      "단위도 마찬가지입니다. 부동산 공고는 ㎡, 이야기는 평으로 합니다. 24평이 몇 ㎡인지 매번 검색하는 대신, 두 칸을 나란히 두고 어느 쪽에 넣어도 반대쪽이 바뀌게 했습니다.",
    ],
    features: [
      {
        title: "일수와 D-Day",
        body: "두 날짜 사이 일수, 양 끝을 포함한 일수, 오늘 기준 D-Day를 함께 보여 줍니다.",
      },
      {
        title: "영업일 계산",
        body: "토·일을 뺀 영업일과 주말 일수를 따로 셉니다. 공휴일은 반영하지 않는다고 밝힙니다.",
      },
      {
        title: "세 가지 단위",
        body: "평↔㎡, 인치↔cm, MB↔GB. 어느 칸에 넣어도 반대쪽이 즉시 바뀝니다.",
      },
      {
        title: "기준 함께",
        body: "1평=3.3058㎡, 1GB=1,024MB 같은 기준과 자주 쓰는 평수를 같이 적어 둡니다.",
      },
    ],
    audience: "계약·제출 기한을 세는 사람, 부동산·화면 크기·파일 용량을 환산하는 사람.",
    basis: [
      "1평 = 400/121㎡ ≈ 3.305785㎡(한국 계량 단위), 1인치 = 2.54cm, 1GB = 1,024MB입니다.",
      "영업일은 토요일·일요일만 제외합니다. 설·추석 연휴, 임시공휴일, 근로자의 날은 넣지 않았습니다.",
      "날짜는 시간대 영향을 받지 않도록 UTC 자정 기준으로 계산합니다.",
    ],
    inputs: ["시작일·종료일", "변환할 숫자(평·인치·MB 등)"],
    outputs: ["일수·포함 일수", "D-Day", "영업일·주말 일수", "변환된 값"],
    runNote: "오늘부터 100일 뒤가 기본값입니다. 날짜나 숫자를 바꾸면 즉시 다시 계산합니다.",
    sourceLine: "1평=400/121㎡ · 1in=2.54cm · 1GB=1,024MB · 기준일 2026. 11. 21.",
    assumptions: ["공휴일·임시공휴일은 반영하지 않습니다. 기한이 중요한 일은 공휴일을 따로 확인하세요."],
    internal: true,
    runMode: "tool",
    category: "utility",
    art: "unit-date-calc",
    tags: ["날짜", "D-Day", "영업일", "평수", "단위변환", "용량"],
  },
];

export const utilsBStore: UtilsStoreItem[] = utilsBApps.map((a, i) => ({
  id: a.slug,
  name: a.name,
  tagline: a.subtitle,
  summary: a.summary,
  category: "utility" as AppCategoryId,
  href: `/apps/${a.slug}`,
  openHref: `/apps/${a.slug}/run`,
  external: false,
  status: a.status,
  icon: a.art,
  meta: a.kind + " · 서버 미전송",
  order: 30 + i * 10,
  featured: false,
  tags: a.tags,
}));

/** 상세 페이지 도해용 — 앱마다 '입력 → 처리 → 결과' 세 줄 */
export const UTILS_B_ART_ROWS: Record<UtilsArt, [string, string, string]> = {
  "text-counter": ["글 붙여넣기", "글자·바이트·원고지 세기", "한도 넘으면 문장 단위로 나누기"],
  "privacy-masker": ["상담 메모·거래 내역 붙여넣기", "번호 다섯 종류 찾기", "앞뒤만 남겨 가린 사본"],
  "json-csv-formatter": ["JSON·CSV 붙여넣기", "문법 확인·표 변환", "복사할 코드"],
  "diff-checker": ["원문 A·수정본 B", "줄·단어 단위 비교", "바뀐 곳 색으로 보기"],
  "color-extractor": ["이미지 올리기", "픽셀 세어 대표색 뽑기", "HEX·RGB·CSS 변수"],
  "text-to-card": ["제목·본문·출처", "1080×1350 캔버스에 그리기", "PNG 내려받기"],
  "unit-date-calc": ["날짜·숫자 넣기", "일수·영업일·환산", "D-Day·변환 값"],
};

/** ToolRunner의 MAP에 그대로 펼치는 매핑 — slug → 컴포넌트 */
export const UTILS_B_RUNNER: Record<string, string> = {
  "text-counter": "TextCounter",
  "privacy-masker": "PrivacyMasker",
  "json-csv-formatter": "DataFormatter",
  "diff-checker": "DiffChecker",
  "color-extractor": "ColorExtractor",
  "text-to-card": "TextToCard",
  "unit-date-calc": "UnitDateCalc",
};

/** AppStoreIcon.astro의 paths에 붙일 24px 선 아이콘 — 이름은 art 키와 같다 */
export const UTILS_B_ICONS: Record<UtilsArt, string> = {
  "text-counter":
    "M4 5.6h16M4 10.4h16M4 15.2h9M15.4 15.2h.1M18 15.2h.1M20.6 15.2h.1M4 20h5.2",
  "privacy-masker":
    "M3.4 12s3.4-6.2 8.6-6.2c1.7 0 3.2.6 4.5 1.4M20.6 12s-3.4 6.2-8.6 6.2c-1.7 0-3.2-.6-4.5-1.4M4 4l16 16M9.9 9.9a3 3 0 0 0 4.3 4.3",
  "json-csv-formatter":
    "M8.4 3.6H6.6a1.4 1.4 0 0 0-1.4 1.4v4.4L3.6 12l1.6 2.6V19a1.4 1.4 0 0 0 1.4 1.4h1.8M15.6 3.6h1.8a1.4 1.4 0 0 1 1.4 1.4v4.4L20.4 12l-1.6 2.6V19a1.4 1.4 0 0 1-1.4 1.4h-1.8M12 8.4v7.2",
  "diff-checker":
    "M4.4 5.4h6v13.2h-6zM13.6 5.4h6v13.2h-6zM6.2 9h2.4M6.2 12h2.4M6.2 15h1.4M15.4 9h2.4M15.4 12h2.4M15.4 15h1.4",
  "color-extractor":
    "M12 3.4c-4.8 0-8.6 3.9-8.6 8.6S7.2 20.6 12 20.6c1.6 0 2.2-1 2.2-2.2s.6-2.2 2.2-2.2h1.4a2.8 2.8 0 0 0 2.8-2.8c0-5.5-4.4-9.9-8.6-9.9ZM7.6 12.4h.1M9.8 8.8h.1M14.2 8h.1M17 10.8h.1",
  "text-to-card":
    "M3.6 5.4h16.8v13.2H3.6zM6.4 8.8h6M6.4 11.6h4M6.4 16.6h11.2M14.8 8.6h3v3.2h-3z",
  "unit-date-calc":
    "M4 6.6h16v13H4zM8 3v3.4M16 3v3.4M4 11h16M7.6 15h-1M7.6 17.4h-1M11.4 15h-1M11.4 17.4h-1M15.2 15h-1M15.2 17.4h-1",
};
