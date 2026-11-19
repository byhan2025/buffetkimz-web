/**
 * 채널 허브 데이터.
 * 주소가 확정된 채널은 url을 채우면 링크로 바뀌고,
 * 비어 있으면 '정리 중'으로 표시된다. 없는 주소를 만들어 넣지 않는다.
 */
export type Channel = {
  name: string;
  /** 이 채널에 올리는 것 */
  note: string;
  url?: string;
  /** 주소를 모를 때 표시할 문구 */
  pending?: string;
};

export const channels: Channel[] = [
  { name: "스레드", note: "짧은 질문과 관점", pending: "주소 정리 중" },
  { name: "인스타그램", note: "카드뉴스와 그림", pending: "주소 정리 중" },
  { name: "네이버 블로그", note: "긴 글과 검색 기록", pending: "주소 정리 중" },
  { name: "유튜브", note: "설명하는 영상", pending: "주소 정리 중" },
  { name: "X", note: "지표와 단문", pending: "주소 정리 중" },
  { name: "카페", note: "질문이 오래 남는 곳", pending: "주소 정리 중" },
  { name: "당근", note: "동네에서 만나는 글", pending: "주소 정리 중" },
];

/** 확인된 외부 링크만 여기에 둔다. */
export const confirmedLinks: { name: string; url: string; note: string }[] = [
  {
    name: "깃허브",
    url: "https://github.com/byhan2025",
    note: "앱의 코드와 배포 기록",
  },
];
