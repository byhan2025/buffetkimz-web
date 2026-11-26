/**
 * 주요 보험사 대표 고객센터 번호 — 증권북 ③ '보험사 연락처' 장에 그대로 인쇄된다.
 *
 * 원칙
 *  · 각 보험사 공식 홈페이지에서 확인한 번호만 적는다. 기억·블로그·카페 값은 쓰지 않는다.
 *  · 확인일(checkedAt)과 출처 주소(source)를 함께 남긴다. 번호가 바뀌면 이 파일만 고치고
 *    `node scripts/build_bojang_core.mjs` 를 다시 돌려 InsureCRM 쪽 사본도 맞춘다.
 *  · 표에 없는 보험사는 증권에 적힌 번호를 쓰도록 화면·인쇄에 안내한다.
 *
 * 확인 기록 (2026-11-27)
 *  · 삼성생명 1588-3114 — samsunglife.com 푸터 '고객센터 1588-3114'
 *  · 한화생명 1588-6363 — hanwhalife.com 푸터 '대표번호 1588-6363'
 *  · 교보생명 1588-1001 — kyobo.com 푸터 '고객센터 1588-1001'
 *  · 신한라이프 1588-5580 — shinhanlife.co.kr 푸터 tel:1588-5580
 *  · KB라이프 1588-3374 — kblife.co.kr '고객센터(평일 9~18시) 1588-3374'
 *  · NH농협생명 1544-4000 — nhlife.co.kr 고객센터 '일반상담 1544-4000'
 *  · 미래에셋생명 1588-0220 — miraeassetlife.com '고객센터 1588-0220'
 *  · 동양생명 1577-1004 — myangel.co.kr 공시실 '콜센터 1577-1004'
 *  · 흥국생명 1588-2288 — heungkuklife.co.kr '국내 이용 1588-2288'
 *  · 삼성화재 1588-5114 — samsungfire.com '고객콜센터 1588-5114'
 *  · 현대해상 1588-5656 — hi.co.kr '대표콜센터 1588-5656'
 *  · DB손해보험 1588-0100 — idbins.com '고객상담센터 1588-0100'
 *  · KB손해보험 1544-0114 — kbinsure.co.kr '대표콜센터 1544-0114'
 *  · 메리츠화재 1566-7711 — meritzfire.com '고객 콜센터 1566-7711'
 *  · 한화손해보험 1566-8000 — hwgeneralins.com '대표번호 1566-8000'
 *  · NH농협손해보험 1644-9000 — nhfire.co.kr 전화상담안내 '대표번호 1644-9000'
 *  · 흥국화재 1688-1688 — heungkukfire.co.kr '고객 콜센터(대표) 1688-1688'
 *  · 롯데손해보험 1588-3344 — lotteins.co.kr '고객 콜센터 1588-3344'
 */

export const INSURER_CHECKED_AT = "2026-11-27";

export const INSURERS = [
  { name: "삼성생명", kind: "생명", phone: "1588-3114", source: "samsunglife.com" },
  { name: "한화생명", kind: "생명", phone: "1588-6363", source: "hanwhalife.com" },
  { name: "교보생명", kind: "생명", phone: "1588-1001", source: "kyobo.com" },
  { name: "신한라이프", kind: "생명", phone: "1588-5580", source: "shinhanlife.co.kr" },
  { name: "KB라이프", kind: "생명", phone: "1588-3374", source: "kblife.co.kr" },
  { name: "NH농협생명", kind: "생명", phone: "1544-4000", source: "nhlife.co.kr" },
  { name: "미래에셋생명", kind: "생명", phone: "1588-0220", source: "miraeassetlife.com" },
  { name: "동양생명", kind: "생명", phone: "1577-1004", source: "myangel.co.kr" },
  { name: "흥국생명", kind: "생명", phone: "1588-2288", source: "heungkuklife.co.kr" },
  { name: "삼성화재", kind: "손해", phone: "1588-5114", source: "samsungfire.com" },
  { name: "현대해상", kind: "손해", phone: "1588-5656", source: "hi.co.kr" },
  { name: "DB손해보험", kind: "손해", phone: "1588-0100", source: "idbins.com" },
  { name: "KB손해보험", kind: "손해", phone: "1544-0114", source: "kbinsure.co.kr" },
  { name: "메리츠화재", kind: "손해", phone: "1566-7711", source: "meritzfire.com" },
  { name: "한화손해보험", kind: "손해", phone: "1566-8000", source: "hwgeneralins.com" },
  { name: "NH농협손해보험", kind: "손해", phone: "1644-9000", source: "nhfire.co.kr" },
  { name: "흥국화재", kind: "손해", phone: "1688-1688", source: "heungkukfire.co.kr" },
  { name: "롯데손해보험", kind: "손해", phone: "1588-3344", source: "lotteins.co.kr" },
];

/** 인쇄·화면에 함께 쓰는 안내 — 확인일과 한계를 밝힌다 */
export const INSURER_NOTE =
  "각 보험사 공식 홈페이지에 게시된 대표 고객센터 번호입니다. 상담 시간은 보험사·업무별로 다르고, 사고 접수·긴급출동은 24시간 운영하는 곳이 있습니다. 표에 없는 보험사는 증권에 적힌 번호를 확인하세요.";
