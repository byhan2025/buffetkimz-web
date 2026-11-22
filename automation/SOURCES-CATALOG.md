# buffetkimz.com 1차 원천 소스 마스터 카탈로그

- 총 **336개** 소스 · **8개** 분야
- 기계 판독용 원본: `automation/sources-catalog.json` (이 문서는 같은 데이터의 사람용 뷰)
- 검증: `python3 automation/tools/verify_catalog.py` 실측 결과를 각 표의 `검증` 열에 반영
- 필드: `id` / `name` / `url_or_endpoint` / `fetch_method` / `update_cycle` / `target_site_section` / `owner_role` / `note`

## 연동 섹션 정의

- **자산리포트(장문 글)**
- **골든타임(일정·타임라인)**
- **앱스토어(계산기·도구)**
- **자료앨범(3D 카드·갤러리)**

## 분야별 소스 수

| 분야 | 소스 수 | 주 담당 |
|---|---:|---|
| ①거시경제·중앙은행·금리·환율 | 41 | 챗GPT총괄(22), 큐이대리(17) |
| ②국내 증시·공시·ETF | 35 | 큐이대리(34), 키링대리(1) |
| ③미국·글로벌 증시·기업공시 | 50 | 챗GPT총괄(31), 큐이대리(18) |
| ④세법·연금·절세·노동 | 36 | 인스팅대리(28), 한대리(6) |
| ⑤보험·건강·복지 | 47 | 한대리(26), 보반대리(21) |
| ⑥부동산·청약·주거 | 33 | 보반대리(29), 키링대리(4) |
| ⑦AI·테크 1차 연구·오픈소스 | 53 | 제미나이 이사(48), 뮤즈대리(5) |
| ⑧콘텐츠 훅·스토리텔링 벤치마킹 | 41 | 부이대리(25), 뮤즈대리(16) |
| **합계** | **336** | |

## ①거시경제·중앙은행·금리·환율

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `macro-001` | 한국은행 ECOS Open API | <https://ecos.bok.or.kr/api/> | API | 일간(통계별 상이) | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 인증키 필요(ECOS Open API), JSON/XML. 기준금리·국고채·M2·물가 시계열의 단일 출처 |
| `macro-002` | 한국은행 기준금리 및 통화정책방향 | <https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643> | HTML | 발표일(연 8회 금통위) | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 금통위 결정문 원문. 기준금리 변동 시 계산기 변수 동시 갱신 |
| `macro-003` | 한국은행 보도자료 | <https://www.bok.or.kr/portal/singl/newsData/list.do?menuNo=200761> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 금통위 의결·국제수지·통화신용정책보고서 1차 원문 |
| `macro-004` | 한국은행 경제통계시스템 100대 지표 | <https://ecos.bok.or.kr/#/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 대시보드형 핵심 지표(성장·물가·고용·금리) |
| `macro-005` | 국가데이터처(구 통계청) KOSIS Open API | <https://kosis.kr/openapi/> | API | 일간~월간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 인증키 필요. 인구·가계금융·고용·물가 통계 원자료 |
| `macro-006` | 국가데이터처(구 통계청) 보도자료 | <https://kostat.go.kr/board.es?mid=a10301010000&bid=210> | HTML | 발표일(월 1~2회 다수) | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 소비자물가·고용동향·가계금융복지조사 원문 |
| `macro-007` | 국가데이터처 소비자물가동향 | <https://kostat.go.kr/board.es?mid=a10301010000&bid=210&act=view&list_no=430016> | HTML | 월간(매월 초) | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 물가 상승률 산식·가중치 확인용. 목록 페이지에서 최신 호 추적 |
| `macro-008` | 기획재정부 보도자료 | <https://www.moef.go.kr/nw/nes/nesdta.do?menuNo=404010> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 경제정책방향·세제개편안·재정집행 1차 발표 |
| `macro-009` | 기획재정부 경제정책방향 | <https://www.moef.go.kr/> | HTML | 반기(하반기·연간) | 자산리포트 | 큐이대리 | OK 200 | 정부 공식 거시 전망·정책 패키지 |
| `macro-010` | KDI 한국개발연구원 | <https://www.kdi.re.kr/> | HTML | 월간~분기 | 자산리포트 | 챗GPT총괄 | OK 200 | KDI 경제동향·연구보고서 |
| `macro-011` | KDI 경제정보센터 | <https://eiec.kdi.re.kr/> | HTML | 일간 | 자산리포트 · 골든타임 | 챗GPT총괄 | OK 200 | 국내외 경제지표 해설·북리뷰 |
| `macro-012` | 미국 연준 FOMC 일정·성명 | <https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm> | HTML | 발표일(연 8회) | 자산리포트 · 골든타임 | 챗GPT총괄 | OK 200 | FOMC 성명·의사록·경제전망요약(SEP) 원문 |
| `macro-013` | 미국 연준 보도자료 RSS | <https://www.federalreserve.gov/feeds/press_all.xml> | RSS | 실시간 | 자산리포트 · 골든타임 | 챗GPT총괄 | OK 200 | 연준 모든 보도자료 피드 |
| `macro-014` | FRED API(세인트루이스 연은) | <https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&file_type=json> | API | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | KEY/차단 400 | API 키 필요. 미국 금리·물가·고용 시계열 표준 |
| `macro-015` | FRED 10년물 국채금리 시계열 | <https://fred.stlouisfed.org/series/DGS10> | HTML | 일간 | 자산리포트 · 골든타임 | 큐이대리 | ENV(환경제약) | DGS10 차트·다운로드(CSV) |
| `macro-016` | FRED ALFRED 빈티지 데이터 | <https://alfred.stlouisfed.org/> | HTML | 발표일 | 자산리포트 | 큐이대리 | ENV(환경제약) | 지표 리비전(수정치) 추적 — '발표 당시 값' 검증용 |
| `macro-017` | 미국 노동통계국 BLS 보도자료 | <https://www.bls.gov/news.release/> | HTML | 발표일(월간) | 자산리포트 · 골든타임 | 챗GPT총괄 | KEY/차단 403 | CPI·고용상황·PPI 원문 |
| `macro-018` | BLS 최신 발표 RSS | <https://www.bls.gov/feed/bls_latest.rss> | RSS | 발표일 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | BLS 전체 최신 발표 피드 |
| `macro-019` | 미국 경제분석국 BEA | <https://www.bea.gov/news> | HTML | 발표일(분기·월간) | 자산리포트 | 챗GPT총괄 | OK 200 | GDP·PCE 물가 원문 |
| `macro-020` | 유럽중앙은행 ECB 보도자료 RSS | <https://www.ecb.europa.eu/rss/press.html> | RSS | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | ECB 통화정책 결정·성명 |
| `macro-021` | ECB 통화정책 | <https://www.ecb.europa.eu/mopo/html/index.en.html> | HTML | 발표일 | 자산리포트 | 챗GPT총괄 | OK 200 | 정책금리·자산매입 프로그램 |
| `macro-022` | 일본은행 BOJ | <https://www.boj.or.jp/en/> | HTML | 발표일 | 자산리포트 | 챗GPT총괄 | OK 200 | 금융정책결정회합·엔화·JGB |
| `macro-023` | IMF 뉴스 | <https://www.imf.org/en/News> | HTML | 수시 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 세계경제전망(WEO)·금융안정보고서(GFSR) |
| `macro-024` | IMF DataMapper | <https://www.imf.org/external/datamapper/> | HTML | 분기 | 자산리포트 · 앱스토어 | 챗GPT총괄 | KEY/차단 403 | 국가별 성장률·부채비율 비교 데이터 |
| `macro-025` | 국제결제은행 BIS | <https://www.bis.org/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | 국제 은행·금융안정 통계 |
| `macro-026` | OECD | <https://www.oecd.org/> | HTML | 월간~분기 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 경제전망·고용·연금 정책 보고서 |
| `macro-027` | OECD 데이터 익스플로러 | <https://data-explorer.oecd.org/> | HTML | 월간 | 자산리포트 · 앱스토어 | 챗GPT총괄 | OK 200 | 회원국 비교 통계(구 stats.oecd.org 대체) |
| `macro-028` | 미국 재무부 | <https://home.treasury.gov/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 재정·국채 발행·제재 발표 |
| `macro-029` | 미국 일별 국채 금리(재무부) | <https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 1개월~30년물 커브 원자료(CSV 다운로드) |
| `macro-030` | CME FedWatch Tool | <https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html> | HTML | 일간 | 자산리포트 · 골든타임 | 큐이대리 | KEY/차단 403 | 금리 선물 내재 확률 — 시장 기대 기준 |
| `macro-031` | 클리블랜드 연은 인플레이션 Nowcast | <https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting> | HTML | 월간 | 자산리포트 | 챗GPT총괄 | OK 200 | CPI·PCE 즉시 추정치 |
| `macro-032` | 애틀랜타 연은 GDPNow | <https://www.atlantafed.org/cqer/research/gdpnow> | HTML | 주간(분기중) | 자산리포트 | 챗GPT총괄 | OK 200 | 미국 분기 GDP 실시간 추정 |
| `macro-033` | 산업통상자원부 수출입동향 | <https://www.motie.go.kr/> | HTML | 월간(매월 1일) | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 월간 수출입·무역수지 속보 |
| `macro-034` | 관세청 무역통계 | <https://tradedata.go.kr/> | HTML | 일간~월간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 품목·국가별 수출입 원자료(공공데이터 API 연계) |
| `macro-035` | 국제금융센터 | <https://www.kcif.or.kr/> | HTML | 일간 | 자산리포트 | 챗GPT총괄 | OK 200 | 해외 금융시장 데일리 브리핑 |
| `macro-036` | 한국금융연구원 | <https://www.kif.re.kr/> | HTML | 주간~월간 | 자산리포트 | 챗GPT총괄 | OK 200 | 금융산업·가계부채 연구보고서 |
| `macro-037` | 자본시장연구원 | <https://www.kcmi.re.kr/> | HTML | 월간 | 자산리포트 | 챗GPT총괄 | OK 200 | 자본시장 정책·연금 연구 |
| `macro-038` | 연합인포맥스 | <https://news.einfomax.co.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 채권·외환·금리 시장 속보 |
| `macro-039` | World Bank Open Data API | <https://api.worldbank.org/v2/country/KOR/indicator/NY.GDP.MKTP.CD?format=json> | API | 연간 | 자산리포트 · 앱스토어 | 챗GPT총괄 | OK 200 | 국가별 GDP·인구·물가 시계열 |
| `macro-040` | Investing.com 경제 캘린더 | <https://www.investing.com/economic-calendar/> | HTML | 실시간 | 골든타임 | 키링대리 | OK 200 | 글로벌 지표 발표 일정(중복·일정 필터의 기준) |
| `macro-041` | Trading Economics 캘린더 | <https://tradingeconomics.com/calendar> | HTML | 실시간 | 골든타임 | 키링대리 | OK 200 | 국가별 지표 발표 예정·직전치 |

## ②국내 증시·공시·ETF

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `kr-market-001` | 금융감독원 DART Open API | <https://opendart.fss.or.kr/api/> | API | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 인증키 필요. 공시·재무제표 원문 API |
| `kr-market-002` | DART 전자공시시스템 | <https://dart.fss.or.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 공시 원문 검색 — 1차 근거 링크의 표준 |
| `kr-market-003` | KRX 정보데이터시스템 | <http://data.krx.co.kr/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 지수·종목·투자자별 매매·공매도 통계 |
| `kr-market-004` | KRX 시장데이터 JSON 엔드포인트 | <http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd> | API | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | KEY/차단 403 | POST(bld 파라미터) 방식. 일별 시세·지수 원자료 |
| `kr-market-005` | 한국거래소 KRX | <https://www.krx.co.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 시장 운영·제도 변경·보도자료 |
| `kr-market-006` | KIND 상장공시시스템 | <https://kind.krx.co.kr/> | HTML | 실시간 | 자산리포트 | 큐이대리 | KEY/차단 403 | 상장사 공시·배당·주주총회 일정 |
| `kr-market-007` | 금융투자협회 전자공시 | <https://dis.kofia.or.kr/> | HTML | 실시간 | 자산리포트 | 큐이대리 | OK 200 | 펀드·증권사 공시 |
| `kr-market-008` | 금융투자협회 채권정보센터 | <https://www.kofiabond.or.kr/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 국고채·회사채 최종호가수익률 |
| `kr-market-009` | 한국예탁결제원 SEIBro | <https://seibro.or.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | 주식·채권 권리·배당 지급 정보 |
| `kr-market-010` | 한국예탁결제원 KSD | <https://www.ksd.or.kr/> | HTML | 월간 | 자산리포트 | 큐이대리 | OK 200 | 결제·예탁 통계 |
| `kr-market-011` | 네이버 금융 | <https://finance.naver.com/> | HTML | 실시간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 국내 시세·재무·컨센서스 요약(보조 확인용) |
| `kr-market-012` | 네이버 금융 일별시세 JSON | <https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=1&startTime=20260101&endTime=20261231&timeframe=day> | API | 일간 | 앱스토어 · 자산리포트 | 큐이대리 | OK 200 | 종목 일별 시세 시계열(비공식 엔드포인트, 보조용) |
| `kr-market-013` | 다음 금융 | <https://finance.daum.net/> | HTML | 실시간 | 자산리포트 | 큐이대리 | OK 200 | 국내외 시세·업종 지표 |
| `kr-market-014` | K-ETF | <https://www.k-etf.com/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 국내 ETF 비교·순자산·보수 |
| `kr-market-015` | ETF Check | <https://www.etfcheck.co.kr/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | ETF 수익률·구성종목 비교 |
| `kr-market-016` | 삼성자산운용 KODEX | <https://www.samsungfund.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | KODEX ETF 공식 상품 공시 |
| `kr-market-017` | 미래에셋자산운용 TIGER ETF | <https://www.tigeretf.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | KEY/차단 403 | TIGER ETF 공식 상품 공시 |
| `kr-market-018` | KB자산운용 RISE ETF | <https://www.riseetf.co.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | ENV(환경제약) | RISE ETF 공식 상품 공시 |
| `kr-market-019` | 한화자산운용 PLUS ETF | <https://www.plusetf.co.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | ENV(환경제약) | PLUS ETF 공식 상품 공시 |
| `kr-market-020` | 신한자산운용 SOL ETF | <https://www.soletf.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | SOL ETF 공식 상품 공시 |
| `kr-market-021` | 한국투자신탁운용 ACE ETF | <https://www.aceetf.co.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | ACE ETF 공식 상품 공시 |
| `kr-market-022` | 키움투자자산운용 KOSEF | <https://www.kosef.co.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | KOSEF ETF 공식 상품 공시 |
| `kr-market-023` | NICE신용평가 | <https://www.nicerating.com/> | HTML | 수시 | 자산리포트 | 큐이대리 | KEY/차단 400 | 회사채·기업 신용등급 |
| `kr-market-024` | 한국기업평가 | <https://www.korearating.com/> | HTML | 수시 | 자산리포트 | 큐이대리 | ENV(환경제약) | 기업·채권 신용등급 보고서 |
| `kr-market-025` | 한국신용평가 | <https://www.kisrating.com/> | HTML | 수시 | 자산리포트 | 큐이대리 | OK 200 | 신용등급·산업 리서치(도메인은 존재하나 해외 IP 접속 차단으로 실측 불가) |
| `kr-market-026` | 한국IR협의회 | <https://www.kirs.or.kr/> | HTML | 일간 | 자산리포트 | 큐이대리 | ENV(환경제약) | 상장사 기업설명회·IR 자료 |
| `kr-market-027` | 코스닥협회 | <https://www.kosdaqca.or.kr/> | HTML | 주간 | 자산리포트 | 큐이대리 | ENV(환경제약) | 코스닥 상장사 공시·정책 |
| `kr-market-028` | 한국상장회사협의회 | <https://www.klca.or.kr/> | HTML | 주간 | 자산리포트 | 큐이대리 | OK 200 | 상장사 지배구조·배당 실무 자료 |
| `kr-market-029` | KRX 투자자별 거래실적 | <http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020201> | HTML | 일간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 기관·외국인 순매수 추이 |
| `kr-market-030` | KRX 공매도 종합포털 | <https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020506> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | 공매도 잔고·거래 비중 |
| `kr-market-031` | 에프앤가이드 컴퍼스 | <https://comp.fnguide.com/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 기업 재무·컨센서스·밸류에이션(보조 확인용) |
| `kr-market-032` | 한국거래소 지수 안내 | <https://www.krx.co.kr/main/main.jsp> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | KOSPI·KOSDAQ·KOSPI200 산출 기준 |
| `kr-market-033` | 배당정보(KIND) | <https://kind.krx.co.kr/main.do?method=loadInitPage> | HTML | 수시 | 자산리포트 · 골든타임 | 키링대리 | KEY/차단 403 | 배당락·배당지급 일정 |
| `kr-market-034` | 주식 물타기·평단 계산 참고 시세 | <https://finance.naver.com/sise/sise_market_sum.naver> | HTML | 일간 | 앱스토어 | 큐이대리 | OK 200 | 전 종목 시세 스냅샷(계산기 기본값 점검) |
| `kr-market-035` | 코스콤 CHECK | <https://www.koscom.co.kr/> | HTML | 월간 | 자산리포트 | 큐이대리 | OK 200 | 증권 인프라·시세 데이터 사업 공시 |

## ③미국·글로벌 증시·기업공시

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `global-market-001` | SEC EDGAR 기업검색 | <https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany> | HTML | 실시간 | 자산리포트 · 골든타임 | 챗GPT총괄 | KEY/차단 403 | 미국 상장사 공시 원문(10-K/10-Q/8-K) |
| `global-market-002` | SEC EDGAR Full-Text Search API | <https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22&forms=8-K> | API | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 공시 본문 키워드 검색(JSON) |
| `global-market-003` | SEC XBRL companyfacts API | <https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json> | API | 분기 | 자산리포트 · 앱스토어 | 챗GPT총괄 | OK 200 | 재무제표 태깅 데이터(매출·이익 원자료) |
| `global-market-004` | SEC 보도자료 RSS | <https://www.sec.gov/news/pressreleases.rss> | RSS | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | SEC 규제·집행 발표 |
| `global-market-005` | SEC 13F 기관 보유공시 | <https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=13F&dateb=&owner=include&count=40> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 헤지펀드·기관 포트폴리오 |
| `global-market-006` | Nasdaq 시세 API | <https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks> | API | 실시간 | 앱스토어 · 자산리포트 | 큐이대리 | OK 200 | 미국 종목 시세(JSON, 비공식) |
| `global-market-007` | Nasdaq Trader | <https://www.nasdaqtrader.com/> | HTML | 일간 | 자산리포트 | 챗GPT총괄 | OK 200 | 거래소 공지·상장폐지·규정 |
| `global-market-008` | NYSE | <https://www.nyse.com/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 뉴욕증권거래소 공시·상장 정보 |
| `global-market-009` | S&P Dow Jones Indices | <https://www.spglobal.com/spdji/en/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | KEY/차단 403 | S&P500·다우 지수 산출 방법·구성종목 |
| `global-market-010` | MSCI | <https://www.msci.com/> | HTML | 분기 | 자산리포트 | 큐이대리 | OK 200 | 글로벌 지수·ESG 평가 |
| `global-market-011` | FTSE Russell | <https://www.ftserussell.com/> | HTML | 분기 | 자산리포트 | 큐이대리 | OK 200 | 글로벌 지수·채권 지수 |
| `global-market-012` | Yahoo Finance 차트 API | <https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d> | API | 실시간 | 앱스토어 · 자산리포트 | 큐이대리 | OK 200 | 글로벌 종목·지수 시계열(JSON) |
| `global-market-013` | Yahoo Finance | <https://finance.yahoo.com/> | HTML | 실시간 | 자산리포트 | 큐이대리 | OK 200 | 시세·재무 요약(보조 확인용) |
| `global-market-014` | Stooq CSV 시세 | <https://stooq.com/q/d/l/?s=%5Espx&i=d> | CSV | 일간 | 앱스토어 | 큐이대리 | OK 200 | 지수 일별 종가 CSV(백테스트·계산기 검증) |
| `global-market-015` | CNBC 최신뉴스 RSS | <https://www.cnbc.com/id/100003114/device/rss/rss.html> | RSS | 실시간 | 자산리포트 · 골든타임 | 챗GPT총괄 | OK 200 | 미국 시장 속보 피드 |
| `global-market-016` | CNBC Markets | <https://www.cnbc.com/markets/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 지수·금리·유가·환율 대시보드 |
| `global-market-017` | Reuters Markets | <https://www.reuters.com/markets/> | HTML | 실시간 | 자산리포트 · 골든타임 | 챗GPT총괄 | KEY/차단 401 | 글로벌 시장 1차 통신 보도 |
| `global-market-018` | WSJ Markets | <https://www.wsj.com/finance> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | KEY/차단 401 | 월스트리트저널 시장·금융 |
| `global-market-019` | FT Markets | <https://www.ft.com/markets> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 파이낸셜타임스 시장·정책 |
| `global-market-020` | Bloomberg Markets | <https://www.bloomberg.com/markets> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 블룸버그 시장 데이터·보도 |
| `global-market-021` | AP Business | <https://apnews.com/hub/business> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | AP 통신 경제·기업 보도 |
| `global-market-022` | MarketWatch Top Stories RSS | <https://feeds.content.dowjones.io/public/rss/mw_topstories> | RSS | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 미국 시장 주요 기사 피드 |
| `global-market-023` | Barron's | <https://www.barrons.com/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | KEY/차단 401 | 주간 시장 분석·기업 심층 |
| `global-market-024` | Morningstar | <https://www.morningstar.com/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 펀드·ETF 등급·공정가치 추정 |
| `global-market-025` | CBOE VIX | <https://www.cboe.com/tradable_products/vix/> | HTML | 일간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 변동성지수 공식 산출·종가 |
| `global-market-026` | FINRA | <https://www.finra.org/> | HTML | 수시 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 미국 브로커 규제·투자자 보호 |
| `global-market-027` | Federal Register API | <https://www.federalregister.gov/api/v1/documents.json> | API | 일간 | 자산리포트 | 챗GPT총괄 | OK 200 | 미국 연방 규정 원문(JSON) |
| `global-market-028` | Freddie Mac 주택담보대출 금리 | <https://www.freddiemac.com/pmms> | HTML | 주간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 미국 30년 고정 모기지 금리 |
| `global-market-029` | NAR 기존주택판매 | <https://www.nar.realtor/research-and-statistics> | HTML | 월간 | 자산리포트 | 챗GPT총괄 | OK 200 | 미국 주택시장 통계 |
| `global-market-030` | S&P Case-Shiller 주택가격지수 | <https://www.spglobal.com/spdji/en/index-family/indicators/sp-corelogic-case-shiller/> | HTML | 월간 | 자산리포트 | 큐이대리 | KEY/차단 403 | 미국 주요 도시 주택가격 |
| `global-market-031` | EIA Open Data API | <https://api.eia.gov/v2/> | API | 주간 | 자산리포트 · 앱스토어 | 큐이대리 | KEY/차단 403 | 원유·가스 재고·가격(키 필요) |
| `global-market-032` | World Gold Council | <https://www.gold.org/> | HTML | 월간 | 자산리포트 | 큐이대리 | OK 200 | 금 수요·중앙은행 매입 통계 |
| `global-market-033` | OPEC | <https://www.opec.org/> | HTML | 월간 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 원유 생산쿼터·월간 보고서 |
| `global-market-034` | Apple Investor Relations | <https://investor.apple.com/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | 실적발표·주주서한 원문 |
| `global-market-035` | Microsoft Investor Relations | <https://www.microsoft.com/en-us/investor> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | 실적발표·가이던스 원문 |
| `global-market-036` | NVIDIA Investor Relations | <https://investor.nvidia.com/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | AI 반도체 실적·데이터센터 매출 |
| `global-market-037` | Tesla Investor Relations | <https://ir.tesla.com/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 분기 실적·인도량 |
| `global-market-038` | Alphabet Investor Relations | <https://abc.xyz/investor/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | 구글·유튜브 실적 원문 |
| `global-market-039` | Amazon Investor Relations | <https://ir.aboutamazon.com/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | AWS·리테일 실적 |
| `global-market-040` | Meta Investor Relations | <https://investor.atmeta.com/> | HTML | 분기 | 자산리포트 | 챗GPT총괄 | OK 200 | 광고·AI capex 실적 |
| `global-market-041` | TSMC Investor Relations | <https://investor.tsmc.com/> | HTML | 월간·분기 | 자산리포트 | 챗GPT총괄 | KEY/차단 403 | 월별 매출·파운드리 가이던스 |
| `global-market-042` | CompaniesMarketCap | <https://companiesmarketcap.com/> | HTML | 일간 | 자산리포트 · 앱스토어 | 큐이대리 | OK 200 | 시가총액 순위(비교용) |
| `global-market-043` | StockAnalysis | <https://stockanalysis.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | 재무·배당·ETF 데이터 정리 |
| `global-market-044` | Finviz | <https://finviz.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | 스크리너·섹터 히트맵 |
| `global-market-045` | Nasdaq 실적 캘린더 | <https://www.nasdaq.com/market-activity/earnings> | HTML | 일간 | 골든타임 | 키링대리 | OK 200 | 미국 기업 실적발표 일정 |
| `global-market-046` | CME Group | <https://www.cmegroup.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | KEY/차단 403 | 금리·원자재 선물 시세 |
| `global-market-047` | ICE | <https://www.ice.com/> | HTML | 일간 | 자산리포트 | 큐이대리 | OK 200 | 원유(Brent)·금융 선물 거래소 |
| `global-market-048` | Nikkei | <https://www.nikkei.com/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 일본 시장·기업 뉴스 |
| `global-market-049` | Nikkei Asia | <https://asia.nikkei.com/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 아시아 경제·공급망 |
| `global-market-050` | SCMP | <https://www.scmp.com/> | HTML | 실시간 | 자산리포트 | 챗GPT총괄 | OK 200 | 중국·홍콩 시장 보도 |

## ④세법·연금·절세·노동

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `tax-pension-labor-001` | 국세청 | <https://www.nts.go.kr/> | HTML | 수시 | 자산리포트 · 골든타임 | 인스팅대리 | OK 200 | 세정·신고 안내 원문 |
| `tax-pension-labor-002` | 국세법령정보시스템 | <https://taxlaw.nts.go.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 세법 조문·예규·해석 — 세율·공제 한도의 최종 근거 |
| `tax-pension-labor-003` | 홈택스 | <https://www.hometax.go.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 신고 서식·모의계산·연말정산 |
| `tax-pension-labor-004` | 국세청 연말정산 미리보기 안내 | <https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6558&cntntsId=7901> | HTML | 연간(12~2월) | 앱스토어 · 자산리포트 | 인스팅대리 | OK 200 | 공제 항목·한도 기준 |
| `tax-pension-labor-005` | 법제처 국가법령정보센터 | <https://www.law.go.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 법률·시행령·시행규칙 원문(시행일 확인) |
| `tax-pension-labor-006` | 법령 Open API | <https://open.law.go.kr/LSO/openApi/guideResult.do> | API | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 법령 본문·시행일 자동 조회 |
| `tax-pension-labor-007` | 국민연금공단 | <https://www.nps.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 가입·수급·소득대체율 기준 |
| `tax-pension-labor-008` | 국민연금 내연금 알아보기 | <https://csa.nps.or.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 인스팅대리 | OK 200 | 예상 수령액 계산 로직 참고 |
| `tax-pension-labor-009` | 근로복지공단 | <https://www.comwel.or.kr/> | HTML | 수시 | 자산리포트 | 한대리 | KEY/차단 400 | 산재·고용보험 급여 안내 |
| `tax-pension-labor-010` | 고용노동부 | <https://www.moel.go.kr/> | HTML | 수시 | 자산리포트 · 골든타임 | 인스팅대리 | OK 200 | 근로기준·퇴직급여·최저임금 정책 |
| `tax-pension-labor-011` | 고용24 | <https://www.work24.go.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 한대리 | OK 200 | 실업급여·구직급여 자격·상하한액 |
| `tax-pension-labor-012` | 금융감독원 통합연금포털 | <https://100lifeplan.fss.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 연금저축·IRP·퇴직연금 수익률 공시 |
| `tax-pension-labor-013` | 서민금융진흥원 | <https://www.kinfa.or.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 서민금융 상품·채무조정 |
| `tax-pension-labor-014` | 열린재정 | <https://www.openfiscaldata.go.kr/> | HTML | 일간 | 자산리포트 | 인스팅대리 | OK 200 | 국가 재정·세입세출 실시간 공개 |
| `tax-pension-labor-015` | 4대사회보험 정보연계센터 | <https://www.4insure.or.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 한대리 | OK 200 | 건보·연금·고용·산재 보험료 기준 |
| `tax-pension-labor-016` | 최저임금위원회 | <https://www.minimumwage.go.kr/> | HTML | 연간(7~8월 결정) | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 연도별 최저임금 고시 |
| `tax-pension-labor-017` | 조세심판원 | <https://www.tt.go.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 세금 불복 결정례 |
| `tax-pension-labor-018` | 한국세무사회 | <https://www.kacpta.or.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 세무 실무 해설·개정 세법 요약 |
| `tax-pension-labor-019` | 한국조세재정연구원 | <https://www.kipf.re.kr/> | HTML | 월간 | 자산리포트 | 인스팅대리 | OK 200 | 조세·재정 연구보고서 |
| `tax-pension-labor-020` | 소득세법(국가법령정보센터) | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EC%86%8C%EB%93%9D%EC%84%B8%EB%B2%95> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 종합소득세율·공제 조문 |
| `tax-pension-labor-021` | 상속세 및 증여세법 | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EC%83%81%EC%86%8D%EC%84%B8%20%EB%B0%8F%20%EC%A6%9D%EC%97%AC%EC%84%B8%EB%B2%95> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 공제 한도·세율 조문 |
| `tax-pension-labor-022` | 주택임대차보호법 | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EC%A3%BC%ED%83%9D%EC%9E%84%EB%8C%80%EC%B0%A8%EB%B3%B4%ED%98%B8%EB%B2%95> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 전월세 계약·갱신 요구권 |
| `tax-pension-labor-023` | 근로기준법 | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EA%B7%BC%EB%A1%9C%EA%B8%B0%EC%A4%80%EB%B2%95> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 연차·퇴직금·해고 조문 |
| `tax-pension-labor-024` | 고용보험법 | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EA%B3%A0%EC%9A%A9%EB%B3%B4%ED%97%98%EB%B2%95> | HTML | 수시 | 앱스토어 | 한대리 | OK 200 | 구직급여 수급 요건 조문 |
| `tax-pension-labor-025` | 산업재해보상보험법 | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EC%82%B0%EC%97%85%EC%9E%AC%ED%95%B4%EB%B3%B4%EC%83%81%EB%B3%B4%ED%97%98%EB%B2%95> | HTML | 수시 | 자산리포트 | 한대리 | OK 200 | 산재 인정·급여 조문 |
| `tax-pension-labor-026` | 퇴직연금 감독규정(금융위) | <https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000263562> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | DC·IRP 운용 규제(고시 개정 추적) |
| `tax-pension-labor-027` | 금융투자협회 ISA 안내 | <https://www.kofia.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 개인종합자산관리계좌 세제 혜택 |
| `tax-pension-labor-028` | 국세청 상속·증여세 안내 | <https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6514&cntntsId=7900> | HTML | 수시 | 자산리포트 | 인스팅대리 | OK 200 | 상속·증여 신고 절차와 세율 |
| `tax-pension-labor-029` | 국세청 모의계산 | <https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6609&cntntsId=7931> | HTML | 수시 | 앱스토어 · 자산리포트 | 인스팅대리 | OK 200 | 종합소득세·양도세 모의계산 산식 참고 |
| `tax-pension-labor-030` | 국세청 양도소득세 안내 | <https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6525&cntntsId=7908> | HTML | 수시 | 자산리포트 · 앱스토어 | 인스팅대리 | OK 200 | 부동산·주식 양도세 기준 |
| `tax-pension-labor-031` | 한국고용정보원 | <https://www.keis.or.kr/> | HTML | 월간 | 자산리포트 | 인스팅대리 | OK 200 | 고용·직업 통계 |
| `tax-pension-labor-032` | 워크넷 | <https://www.work.go.kr/> | HTML | 수시 | 앱스토어 | 한대리 | ENV(환경제약) | 구인·직업훈련 |
| `tax-pension-labor-033` | 한국노동연구원 | <https://www.kli.re.kr/> | HTML | 월간 | 자산리포트 | 인스팅대리 | OK 200 | 노동시장·임금 연구 |
| `tax-pension-labor-034` | 통계청 경제활동인구조사 | <https://kostat.go.kr/> | HTML | 월간 | 자산리포트 · 골든타임 | 큐이대리 | OK 200 | 고용률·실업률 원문 |
| `tax-pension-labor-035` | 한국재정학회 | <https://www.kafa.or.kr/> | HTML | 수시 | 자산리포트 | 인스팅대리 | ENV(환경제약) | 재정·조세 학술 자료(보조) |
| `tax-pension-labor-036` | 국세청 국세통계포털 | <https://stats.nts.go.kr/> | HTML | 월간 | 자산리포트 | 인스팅대리 | OK 200 | 국세 통계 원자료 |

## ⑤보험·건강·복지

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `insurance-health-001` | 금융위원회 | <https://www.fsc.go.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 한대리 | OK 200 | 보험·금융 정책 발표 원문 |
| `insurance-health-002` | 금융위원회 보도자료 | <https://www.fsc.go.kr/no010101> | HTML | 실시간 | 자산리포트 · 골든타임 | 한대리 | OK 200 | 보험업 감독·상품 규제 발표 |
| `insurance-health-003` | 금융감독원 | <https://www.fss.or.kr/> | HTML | 실시간 | 자산리포트 | 한대리 | OK 200 | 감독·검사·소비자 보호 자료 |
| `insurance-health-004` | 금융감독원 보도자료 | <https://www.fss.or.kr/fss/bbs/B0000188/list.do?menuNo=200218> | HTML | 실시간 | 자산리포트 · 골든타임 | 한대리 | OK 200 | 보험금 지급·민원·광고 심의 기준 |
| `insurance-health-005` | 보험다모아(금융감독원) | <https://e-insmarket.or.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 한대리 | REDIRECT 302 | 실손·자동차·보장성 보험료 비교 공시 |
| `insurance-health-006` | 생명보험협회 | <https://www.klia.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 생명보험 통계·약관·공시 |
| `insurance-health-007` | 손해보험협회 | <https://www.knia.or.kr/> | HTML | 수시 | 자산리포트 | 한대리 | OK 200 | 손해보험 통계·약관·표준 상품 |
| `insurance-health-008` | 보험개발원 | <https://www.kidi.or.kr/> | HTML | 월간 | 자산리포트 | 한대리 | OK 200 | 보험 통계·위험률·요율 |
| `insurance-health-009` | 보험연구원 | <https://www.kiri.or.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 보험산업 연구보고서 |
| `insurance-health-010` | 생명보험 공시실 | <https://www.klia.or.kr/pub> | HTML | 일간 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 생보 상품 공시(보험료·해약환급금) |
| `insurance-health-011` | 손해보험 공시실 | <https://kpub.knia.or.kr/main.do> | HTML | 일간 | 자산리포트 · 앱스토어 | 한대리 | OK 200 | 손보 상품 공시(보험료·보장 내용) |
| `insurance-health-012` | 손해보험협회 소비자포털 | <https://consumer.knia.or.kr/main.do> | HTML | 수시 | 자산리포트 · 앱스토어 | 한대리 | OK 200 | 보험민원·보험금 부지급률·불완전판매비율 공시 |
| `insurance-health-013` | 금융감독원 상품 비교공시 | <https://www.fss.or.kr/main/prc/is/sub/is008.jsp?menuNo=900399> | HTML | 수시 | 앱스토어 · 자산리포트 | 한대리 | OK 200 | 보험상품 비교공시 안내(보험다모아·협회 공시 연결) |
| `insurance-health-014` | 국민건강보험공단 | <https://www.nhis.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 한대리 | OK 200 | 건강보험 보장·본인부담 기준 |
| `insurance-health-015` | 건강보험심사평가원 | <https://www.hira.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 한대리 | OK 200 | 진료비 심사 기준·수가 |
| `insurance-health-016` | 심평원 보건의료빅데이터 | <https://opendata.hira.or.kr/> | HTML | 월간 | 자산리포트 · 자료앨범 | 한대리 | OK 200 | 질병·진료 통계 원자료 |
| `insurance-health-017` | 질병관리청 | <https://www.kdca.go.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 한대리 | OK 200 | 감염병·만성질환 통계 |
| `insurance-health-018` | 감염병포털 | <https://dportal.kdca.go.kr/> | HTML | 일간 | 자산리포트 | 한대리 | OK 200 | 발생 현황·예방 접종 |
| `insurance-health-019` | 식품의약품안전처 | <https://www.mfds.go.kr/> | HTML | 실시간 | 자산리포트 | 한대리 | OK 200 | 의약품·의료기기 안전 정보 |
| `insurance-health-020` | 의약품안전나라 | <https://nedrug.mfds.go.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 한대리 | OK 200 | 허가사항·부작용·상호작용 |
| `insurance-health-021` | 보건복지부 | <https://www.mohw.go.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 보반대리 | OK 200 | 복지·건강보험 정책 발표 |
| `insurance-health-022` | 복지로 | <https://www.bokjiro.go.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 복지급여 조회·신청 기준 |
| `insurance-health-023` | 국가암정보센터 | <https://www.cancer.go.kr/> | HTML | 수시 | 자산리포트 · 자료앨범 | 한대리 | OK 200 | 암 종류별 발생·치료·생존율 |
| `insurance-health-024` | 국립암센터 | <https://www.ncc.re.kr/> | HTML | 수시 | 자산리포트 | 한대리 | OK 200 | 암 연구·임상 자료 |
| `insurance-health-025` | 한국건강증진개발원 | <https://www.khealth.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 건강증진·생활습관 통계 |
| `insurance-health-026` | 건강iN(건보공단) | <https://hi.nhis.or.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 한대리 | OK 200 | 건강검진·본인부담 조회 |
| `insurance-health-027` | 사회보장정보원 | <https://www.ssis.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 사회보장 정보 연계 기준 |
| `insurance-health-028` | 한국장애인고용공단 | <https://www.kead.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 장애인 고용·지원 제도 |
| `insurance-health-029` | 국가보훈부 | <https://www.mpva.go.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 보훈 대상·지원 제도 |
| `insurance-health-030` | IAIS 국제보험감독자협의회 | <https://www.iaisweb.org/> | HTML | 분기 | 자산리포트 | 보반대리 | OK 200 | 글로벌 보험 감독 기준 |
| `insurance-health-031` | Swiss Re Institute | <https://www.swissre.com/institute/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 시그마 보고서(재해·보험 손해) |
| `insurance-health-032` | Munich Re | <https://www.munichre.com/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 재보험·기후 리스크 보고서 |
| `insurance-health-033` | OECD Health | <https://www.oecd.org/health/> | HTML | 연간 | 자산리포트 | 보반대리 | KEY/차단 403 | 회원국 보건지출·기대수명 |
| `insurance-health-034` | WHO | <https://www.who.int/> | HTML | 주간 | 자산리포트 | 한대리 | OK 200 | 국제 질병·보건 통계 |
| `insurance-health-035` | 은행연합회 | <https://www.kfb.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 대출·예금 금리 비교 공시 |
| `insurance-health-036` | 저축은행중앙회 | <https://www.fsb.or.kr/> | HTML | 수시 | 앱스토어 | 보반대리 | OK 200 | 저축은행 금리 비교 |
| `insurance-health-037` | 금융결제원 | <https://www.kftc.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 지급결제·계좌이체 인프라 |
| `insurance-health-038` | 한국의료분쟁조정중재원 | <https://www.k-medi.or.kr/> | HTML | 수시 | 자산리포트 | 한대리 | OK 200 | 의료분쟁 조정 사례 |
| `insurance-health-039` | 한국보건사회연구원 | <https://www.kihasa.re.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 사회보장·건강보험 연구 |
| `insurance-health-040` | 한국보건산업진흥원 | <https://www.khidi.or.kr/> | HTML | 월간 | 자산리포트 | 한대리 | OK 200 | 보건산업 통계·동향 |
| `insurance-health-041` | 금융소비자보호재단 | <https://www.fcsc.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 금융소비자 권리·피해 사례 |
| `insurance-health-042` | 보험연수원 | <https://www.insure.or.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | ENV(환경제약) | 보험 전문 교육·자격 자료(도메인은 존재하나 해외 IP 접속 차단으로 실측 불가) |
| `insurance-health-043` | 금융감독원 불법금융신고센터 | <https://www.fss.or.kr/fss/main/main.do> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 보험사기·불법금융 신고 기준 |
| `insurance-health-044` | 국민권익위원회 | <https://www.acrc.go.kr/> | HTML | 수시 | 자산리포트 | 보반대리 | OK 200 | 공공기관 민원·제도 개선 |
| `insurance-health-045` | 대한의사협회 | <https://www.kma.org/> | HTML | 수시 | 자산리포트 | 한대리 | ENV(환경제약) | 의료 정책·진료 지침 |
| `insurance-health-046` | 대한병원협회 | <https://www.kha.or.kr/> | HTML | 수시 | 자산리포트 | 한대리 | OK 200 | 병원 경영·수가 자료 |
| `insurance-health-047` | 건강보험심사평가원 약제급여목록 | <https://www.hira.or.kr/bbsDummy.do?pgmid=HIRAA020002000100> | HTML | 월간 | 앱스토어 · 자산리포트 | 한대리 | OK 200 | 약제 급여 기준(비급여 판단) |

## ⑥부동산·청약·주거

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `real-estate-001` | 국토교통부 | <https://www.molit.go.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 보반대리 | REDIRECT 307 | 부동산·주택 정책 발표 원문 |
| `real-estate-002` | 국토교통부 실거래가 공공데이터 API | <https://openapi.molit.go.kr/OpenAPI_ToolInstallPage.do> | API | 일간 | 앱스토어 · 자산리포트 | 보반대리 | ENV(환경제약) | 아파트·연립·오피스텔 매매/전월세 실거래가(키 필요) |
| `real-estate-003` | 실거래가 조회 서비스 | <https://rt.molit.go.kr/> | HTML | 일간 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 지역·단지별 실거래가 조회 |
| `real-estate-004` | 청약홈 | <https://www.applyhome.co.kr/> | HTML | 일간 | 골든타임 · 자산리포트 | 키링대리 | OK 200 | 청약 일정·경쟁률·가점 기준 |
| `real-estate-005` | 한국부동산원 | <https://www.reb.or.kr/> | HTML | 주간 | 자산리포트 | 보반대리 | OK 200 | 부동산 통계·시장 동향 |
| `real-estate-006` | 한국부동산원 R-ONE | <https://www.reb.or.kr/r-one/> | HTML | 주간 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 주간 아파트가격·전세가격지수 |
| `real-estate-007` | LH 한국토지주택공사 | <https://www.lh.or.kr/> | HTML | 일간 | 골든타임 · 자산리포트 | 보반대리 | OK 200 | 공공주택 공급·임대 공고 |
| `real-estate-008` | LH 청약센터 | <https://apply.lh.or.kr/> | HTML | 일간 | 골든타임 · 앱스토어 | 키링대리 | OK 200 | LH 청약 자격·일정 |
| `real-estate-009` | HUG 주택도시보증공사 | <https://www.khug.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 전세보증금반환보증·임대보증 기준 |
| `real-estate-010` | 주택도시기금 | <https://nhuf.molit.go.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 보반대리 | OK 200 | 버팀목·디딤돌 대출 금리·한도 |
| `real-estate-011` | 한국주택금융공사 HF | <https://www.hf.go.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 보금자리론·주택연금 |
| `real-estate-012` | 국토연구원 | <https://www.krihs.re.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 주택시장·국토정책 연구 |
| `real-estate-013` | 건설산업연구원 | <https://www.cerik.re.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 건설경기·주택 착공 통계 |
| `real-estate-014` | 대한건설협회 | <https://www.cak.or.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 건설공사비지수·업계 동향 |
| `real-estate-015` | 부동산공시가격알리미 | <https://www.realtyprice.kr/> | HTML | 연간(4월) | 앱스토어 · 자산리포트 | 보반대리 | OK 200 | 공동주택·개별주택 공시가격 |
| `real-estate-016` | 부동산거래관리시스템 | <https://rtms.molit.go.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 보반대리 | OK 200 | 매매·임대차 신고 절차 |
| `real-estate-017` | 법원경매정보 | <https://www.courtauction.go.kr/> | HTML | 일간 | 자산리포트 | 보반대리 | OK 200 | 경매 물건·권리분석 |
| `real-estate-018` | 온비드 | <https://www.onbid.co.kr/> | HTML | 일간 | 자산리포트 | 보반대리 | OK 200 | 공매·압류재산 공고 |
| `real-estate-019` | KB부동산 | <https://kbland.kr/> | HTML | 주간 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | KB 시세·주간 가격 동향 |
| `real-estate-020` | 네이버부동산 | <https://land.naver.com/> | HTML | 실시간 | 자산리포트 | 보반대리 | OK 200 | 매물·시세 참고(보조) |
| `real-estate-021` | 직방 | <https://www.zigbang.com/> | HTML | 실시간 | 자산리포트 | 보반대리 | OK 200 | 전월세·매매 시세 참고 |
| `real-estate-022` | 다방 | <https://www.dabangapp.com/> | HTML | 실시간 | 자산리포트 | 보반대리 | OK 200 | 원룸·오피스텔 시세 참고 |
| `real-estate-023` | 부동산114 | <https://www.r114.com/> | HTML | 주간 | 자산리포트 | 보반대리 | OK 200 | 단지 시세·미분양 통계 |
| `real-estate-024` | SH 서울주택도시공사 | <https://www.i-sh.co.kr/> | HTML | 일간 | 골든타임 | 키링대리 | OK 200 | 서울 공공임대·분양 공고 |
| `real-estate-025` | GH 경기주택도시공사 | <https://www.gh.or.kr/> | HTML | 일간 | 골든타임 | 키링대리 | OK 200 | 경기 공공주택 공고 |
| `real-estate-026` | 국토교통통계누리 | <https://stat.molit.go.kr/> | HTML | 월간 | 자산리포트 · 앱스토어 | 보반대리 | OK 200 | 주택·토지·건설 통계 원자료 |
| `real-estate-027` | 한국공인중개사협회 | <https://www.kar.or.kr/> | HTML | 수시 | 자산리포트 · 앱스토어 | 보반대리 | ENV(환경제약) | 중개보수 요율·계약서 기준 |
| `real-estate-028` | 한국리츠협회 | <https://www.reits.or.kr/> | HTML | 월간 | 자산리포트 | 보반대리 | OK 200 | 리츠 시장·배당 정보 |
| `real-estate-029` | 서울시 부동산정보 | <https://land.seoul.go.kr/> | HTML | 주간 | 자산리포트 | 보반대리 | OK 200 | 서울 지가·거래 동향 |
| `real-estate-030` | 마이홈 주거복지포털 | <https://www.myhome.go.kr/> | HTML | 수시 | 앱스토어 · 자산리포트 | 보반대리 | ENV(환경제약) | 주거급여·공공임대 자격 |
| `real-estate-031` | 주택공급에 관한 규칙(청약 가점 근거) | <https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&query=%EC%A3%BC%ED%83%9D%EA%B3%B5%EA%B8%89%EC%97%90%20%EA%B4%80%ED%95%9C%20%EA%B7%9C%EC%B9%99> | HTML | 수시 | 앱스토어 · 자산리포트 | 보반대리 | OK 200 | 가점 산정 기준(무주택기간·부양가족·통장기간)의 법적 근거 |
| `real-estate-032` | 전세보증금반환보증 안내(HUG) | <https://www.khug.or.kr/hug/web/ig/igc/insuranceGuaranteeIntro.jsp> | HTML | 수시 | 앱스토어 · 자산리포트 | 보반대리 | KEY/차단 406 | 보증 가입 조건·보증료 |
| `real-estate-033` | 국토교통부 주택공급 통계 | <https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp> | HTML | 월간 | 자산리포트 | 보반대리 | REDIRECT 307 | 주택 인허가·착공·준공 실적 |

## ⑦AI·테크 1차 연구·오픈소스

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `ai-tech-001` | arXiv API(cs.AI) | <http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=20> | API | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 논문 초록·저자·링크(Atom XML) |
| `ai-tech-002` | arXiv cs.AI 최신 목록 | <https://arxiv.org/list/cs.AI/recent> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | AI 논문 최신 등록 |
| `ai-tech-003` | arXiv cs.LG 최신 목록 | <https://arxiv.org/list/cs.LG/recent> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 머신러닝 논문 최신 등록 |
| `ai-tech-004` | arXiv cs.CL 최신 목록 | <https://arxiv.org/list/cs.CL/recent> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 자연어처리 논문 최신 등록 |
| `ai-tech-005` | OpenAI 뉴스 | <https://openai.com/news/> | HTML | 수시 | 자산리포트 · 골든타임 | 제미나이 이사 | OK 200 | 모델·정책 공식 발표 |
| `ai-tech-006` | OpenAI 뉴스 RSS | <https://openai.com/news/rss.xml> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 공식 발표 피드 |
| `ai-tech-007` | Anthropic 뉴스 | <https://www.anthropic.com/news> | HTML | 수시 | 자산리포트 · 골든타임 | 제미나이 이사 | OK 200 | Claude 모델·안전성 발표 |
| `ai-tech-008` | Anthropic 문서 | <https://docs.anthropic.com/> | HTML | 수시 | 앱스토어 | 제미나이 이사 | OK 200 | API·모델 스펙(서비스 비교 근거) |
| `ai-tech-009` | Google DeepMind 블로그 | <https://deepmind.google/discover/blog/> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 연구·모델 공식 발표 |
| `ai-tech-010` | Google AI 블로그 RSS | <https://blog.google/technology/ai/rss/> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 구글 AI 제품·연구 피드 |
| `ai-tech-011` | Meta AI 블로그 | <https://ai.meta.com/blog/> | HTML | 수시 | 자산리포트 | 제미나이 이사 | KEY/차단 400 | Llama·연구 공식 발표 |
| `ai-tech-012` | Microsoft Research 블로그 RSS | <https://www.microsoft.com/en-us/research/feed/> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | MS 연구 발표 피드 |
| `ai-tech-013` | Hugging Face 블로그 RSS | <https://huggingface.co/blog/feed.xml> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 오픈모델·라이브러리 발표 |
| `ai-tech-014` | Hugging Face 모델 API | <https://huggingface.co/api/models?sort=trendingScore&limit=20> | API | 일간 | 자산리포트 · 앱스토어 | 제미나이 이사 | OK 200 | 트렌딩 오픈모델 목록(JSON) |
| `ai-tech-015` | GitHub Trending | <https://github.com/trending> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 일간 인기 저장소 |
| `ai-tech-016` | GitHub 저장소 검색 API | <https://api.github.com/search/repositories?q=stars:%3E1000+pushed:%3E2026-11-01&sort=stars> | API | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 스타·최근 푸시 기준 검색(JSON) |
| `ai-tech-017` | GitHub Releases Atom(예: Ollama) | <https://github.com/ollama/ollama/releases.atom> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 오픈소스 릴리스 추적 표준 형식 |
| `ai-tech-018` | Papers with Code | <https://paperswithcode.com/> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 논문·코드·벤치마크 연결 |
| `ai-tech-019` | Semantic Scholar API | <https://api.semanticscholar.org/graph/v1/paper/search?query=large+language+model&limit=5> | API | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 논문 검색·인용(JSON) |
| `ai-tech-020` | OpenAlex API | <https://api.openalex.org/works?filter=concepts.id:C154945781&per-page=10> | API | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 학술 메타데이터·인용 지도 |
| `ai-tech-021` | NeurIPS | <https://neurips.cc/> | HTML | 연간 | 자산리포트 | 제미나이 이사 | OK 200 | 최신 논문·튜토리얼 |
| `ai-tech-022` | ICML | <https://icml.cc/> | HTML | 연간 | 자산리포트 | 제미나이 이사 | OK 200 | 머신러닝 학회 논문 |
| `ai-tech-023` | ICLR | <https://iclr.cc/> | HTML | 연간 | 자산리포트 | 제미나이 이사 | OK 200 | 표현학습 학회 논문 |
| `ai-tech-024` | Stanford HAI AI Index | <https://aiindex.stanford.edu/> | HTML | 연간 | 자산리포트 · 자료앨범 | 제미나이 이사 | OK 200 | AI 투자·채택·성능 통계 |
| `ai-tech-025` | Epoch AI | <https://epoch.ai/> | HTML | 월간 | 자산리포트 | 제미나이 이사 | OK 200 | 컴퓨트·모델 성능 추세 데이터 |
| `ai-tech-026` | LM Arena | <https://lmarena.ai/> | HTML | 주간 | 자산리포트 | 제미나이 이사 | OK 200 | 모델 선호도 리더보드 |
| `ai-tech-027` | The Batch(DeepLearning.AI) | <https://www.deeplearning.ai/the-batch/> | HTML | 주간 | 자산리포트 | 제미나이 이사 | OK 200 | 주간 AI 해설 |
| `ai-tech-028` | Import AI(Jack Clark) | <https://importai.substack.com/> | HTML | 주간 | 자산리포트 | 제미나이 이사 | OK 200 | 정책·연구 큐레이션 뉴스레터 |
| `ai-tech-029` | Simon Willison 블로그 | <https://simonwillison.net/> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | LLM 실무·도구 리뷰 |
| `ai-tech-030` | Hacker News API | <https://hacker-news.firebaseio.com/v0/topstories.json> | API | 실시간 | 자산리포트 · 골든타임 | 제미나이 이사 | OK 200 | 테크 커뮤니티 상위 글 ID(JSON) |
| `ai-tech-031` | TechCrunch AI RSS | <https://techcrunch.com/category/artificial-intelligence/feed/> | RSS | 실시간 | 자산리포트 | 제미나이 이사 | OK 200 | AI 스타트업·투자 보도 |
| `ai-tech-032` | The Verge AI | <https://www.theverge.com/ai-artificial-intelligence> | HTML | 실시간 | 자산리포트 | 제미나이 이사 | OK 200 | AI 제품·정책 보도 |
| `ai-tech-033` | Ars Technica | <https://arstechnica.com/> | HTML | 실시간 | 자산리포트 | 제미나이 이사 | OK 200 | 기술 심층 보도 |
| `ai-tech-034` | VentureBeat AI | <https://venturebeat.com/category/ai/> | HTML | 실시간 | 자산리포트 | 제미나이 이사 | OK 200 | 엔터프라이즈 AI 동향 |
| `ai-tech-035` | NVIDIA 블로그 | <https://blogs.nvidia.com/> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | GPU·AI 인프라 공식 발표 |
| `ai-tech-036` | Cloudflare 블로그 RSS | <https://blog.cloudflare.com/rss/> | RSS | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 인터넷 인프라·보안 |
| `ai-tech-037` | AI타임스 | <https://www.aitimes.com/> | HTML | 일간 | 자산리포트 · 골든타임 | 제미나이 이사 | OK 200 | 국내 AI 산업 보도 |
| `ai-tech-038` | 전자신문 | <https://www.etnews.com/> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 국내 IT 정책·산업 |
| `ai-tech-039` | ZDNet Korea | <https://zdnet.co.kr/> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | 국내 테크 뉴스 |
| `ai-tech-040` | 블로터 | <https://www.bloter.net/> | HTML | 일간 | 자산리포트 | 제미나이 이사 | OK 200 | IT·스타트업 심층 |
| `ai-tech-041` | 요즘IT | <https://yozm.wishket.com/magazine/> | HTML | 주간 | 자산리포트 · 자료앨범 | 뮤즈대리 | OK 200 | 개발·기획 실무 아티클 |
| `ai-tech-042` | 네이버 D2 | <https://d2.naver.com/> | HTML | 주간 | 자산리포트 | 뮤즈대리 | OK 200 | 기술 블로그(국문 심층) |
| `ai-tech-043` | 카카오테크 | <https://tech.kakao.com/> | HTML | 주간 | 자산리포트 | 뮤즈대리 | OK 200 | 카카오 기술 블로그 |
| `ai-tech-044` | 토스테크 | <https://toss.tech/> | HTML | 주간 | 자산리포트 · 자료앨범 | 뮤즈대리 | OK 200 | 금융 UX·프로덕트 사례 |
| `ai-tech-045` | 우아한형제들 기술블로그 | <https://techblog.woowahan.com/> | HTML | 주간 | 자산리포트 | 뮤즈대리 | KEY/차단 403 | 서비스 개발·운영 사례 |
| `ai-tech-046` | OpenAI API 가격 | <https://openai.com/api/pricing/> | HTML | 수시 | 앱스토어 | 제미나이 이사 | OK 200 | 모델별 토큰 단가(비용 계산 근거) |
| `ai-tech-047` | Gemini API 문서 | <https://ai.google.dev/gemini-api/docs> | HTML | 수시 | 앱스토어 | 제미나이 이사 | OK 200 | 모델·요금·한도 |
| `ai-tech-048` | vLLM 릴리스 | <https://github.com/vllm-project/vllm/releases> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 추론 엔진 릴리스 노트 |
| `ai-tech-049` | Llama 모델 릴리스 | <https://github.com/meta-llama/llama-models/releases> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 오픈모델 버전·라이선스 |
| `ai-tech-050` | xAI 뉴스 | <https://x.ai/news> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | Grok 모델 발표 |
| `ai-tech-051` | Mistral AI 뉴스 | <https://mistral.ai/news/> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 유럽 오픈모델 발표 |
| `ai-tech-052` | Cohere 블로그 | <https://cohere.com/blog> | HTML | 수시 | 자산리포트 | 제미나이 이사 | OK 200 | 엔터프라이즈 LLM 사례 |
| `ai-tech-053` | Perplexity 허브 | <https://www.perplexity.ai/hub/blog> | HTML | 수시 | 자산리포트 | 제미나이 이사 | KEY/차단 403 | 검색형 AI 제품 발표 |

## ⑧콘텐츠 훅·스토리텔링 벤치마킹

| id | 이름 | 엔드포인트 | 방식 | 주기 | 연동 섹션 | 담당 | 검증 | 메모 |
|---|---|---|---|---|---|---|---|---|
| `content-hook-001` | 박종훈의 지식한방(@kpunch) | <https://www.youtube.com/@kpunch> | HTML | 일간 | 자산리포트 · 자료앨범 | 부이대리 | OK 200 | 지정 5대 채널 — 경제사 서사형 오프닝 훅 |
| `content-hook-002` | 박종훈의 지식한방 RSS | <https://www.youtube.com/feeds/videos.xml?channel_id=UCOB62fKRT7b73X7tRxMuN2g> | RSS | 일간 | 골든타임 · 자산리포트 | 부이대리 | OK 200 | 신규 영상 제목·설명 자동 수집(채널ID 실측) |
| `content-hook-003` | 박곰희TV(@gomhee) | <https://www.youtube.com/@gomhee> | HTML | 일간 | 자산리포트 · 자료앨범 | 부이대리 | OK 200 | 지정 5대 채널 — 절세·연금 실전 사례형 훅 |
| `content-hook-004` | 박곰희TV RSS | <https://www.youtube.com/feeds/videos.xml?channel_id=UCr7XsrSrvAn_WcU4kF99bbQ> | RSS | 일간 | 골든타임 · 자산리포트 | 부이대리 | OK 200 | 신규 영상 자동 수집(채널ID 실측) |
| `content-hook-005` | 교양이를 부탁해(@sbs_explained) | <https://www.youtube.com/@sbs_explained> | HTML | 주간 | 자산리포트 · 자료앨범 | 뮤즈대리 | OK 200 | 지정 5대 채널 — 다큐형 정보 구조·자료 화면 |
| `content-hook-006` | 교양이를 부탁해 RSS | <https://www.youtube.com/feeds/videos.xml?channel_id=UChY8VUjXv0aA7RF9hDQ0ISg> | RSS | 주간 | 자산리포트 | 뮤즈대리 | OK 200 | 신규 영상 자동 수집(채널ID 실측) |
| `content-hook-007` | 지식인사이드(UCA_hgsFzmynpv1zkvA5A7jA) | <https://www.youtube.com/channel/UCA_hgsFzmynpv1zkvA5A7jA> | HTML | 주간 | 자산리포트 · 자료앨범 | 부이대리 | OK 200 | 지정 5대 채널 — 인물·질문형 롱폼 서사 |
| `content-hook-008` | 지식인사이드 RSS | <https://www.youtube.com/feeds/videos.xml?channel_id=UCA_hgsFzmynpv1zkvA5A7jA> | RSS | 주간 | 자산리포트 | 부이대리 | OK 200 | 신규 영상 자동 수집(채널ID 실측) |
| `content-hook-009` | 부티플(@money-multiple) | <https://www.youtube.com/@money-multiple> | HTML | 주간 | 자산리포트 · 자료앨범 | 부이대리 | OK 200 | 지정 5대 채널 — 숫자·비교형 머니 콘텐츠 |
| `content-hook-010` | 부티플 RSS | <https://www.youtube.com/feeds/videos.xml?channel_id=UCriq8I8GEESkQq0svX19oCw> | RSS | 주간 | 골든타임 · 자산리포트 | 부이대리 | OK 200 | 신규 영상 자동 수집(채널ID 실측) |
| `content-hook-011` | EasyAI Lab Threads(@easyai_lab) | <https://www.threads.com/@easyai_lab> | HTML | 일간 | 자료앨범 · 자산리포트 | 뮤즈대리 | OK 200 | 김대표 지정 레퍼런스 — 3D 클레이 캐릭터+6장 카드뉴스 1세트 포맷(유튜브 아님·Threads 실측) |
| `content-hook-012` | 삼프로TV | <https://www.youtube.com/@3protv> | HTML | 일간 | 골든타임 · 자산리포트 | 부이대리 | OK 200 | 시장 이슈 토크형 훅(보조 벤치마크) |
| `content-hook-013` | 슈카월드 | <https://www.youtube.com/@syukaworld> | HTML | 주간 | 골든타임 | 부이대리 | OK 200 | 경제사·밈 결합 훅 |
| `content-hook-014` | 신사임당 | <https://www.youtube.com/@sinsaimdang_> | HTML | 주간 | 자산리포트 | 부이대리 | OK 200 | 기업·부동산 서사형 훅 |
| `content-hook-015` | YouTube 채널 영상 RSS 표준 형식 | <https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw> | RSS | 일간 | 골든타임 | 부이대리 | OK 200 | 채널ID만 바꿔 쓰는 범용 피드(Google Developers 채널 예) |
| `content-hook-016` | 네이버 데이터랩 | <https://datalab.naver.com/> | HTML | 일간 | 골든타임 · 자산리포트 | 부이대리 | OK 200 | 검색어 트렌드·인구통계 기반 소재 발굴 |
| `content-hook-017` | Google Trends | <https://trends.google.com/trends/> | HTML | 실시간 | 골든타임 | 부이대리 | OK 200 | 실시간 급상승 검색어(국내) |
| `content-hook-018` | 네이버 뉴스 랭킹 | <https://news.naver.com/main/ranking/popularDay.naver> | HTML | 일간 | 골든타임 | 부이대리 | OK 200 | 일간 많이 본 뉴스(대중 관심 검증) |
| `content-hook-019` | 연합뉴스 RSS | <https://www.yna.co.kr/rss/news.xml> | RSS | 실시간 | 자산리포트 · 골든타임 | 부이대리 | OK 200 | 국내 1차 통신 피드 |
| `content-hook-020` | 한국경제 RSS | <https://www.hankyung.com/feed/all-news> | RSS | 실시간 | 자산리포트 | 부이대리 | KEY/차단 403 | 경제지 1차 피드 |
| `content-hook-021` | 매일경제 RSS | <https://www.mk.co.kr/rss/30000001/> | RSS | 실시간 | 자산리포트 | 부이대리 | OK 200 | 경제지 1차 피드 |
| `content-hook-022` | 조선비즈 | <https://biz.chosun.com/> | HTML | 실시간 | 자산리포트 | 부이대리 | OK 200 | 기업·금융 심층 |
| `content-hook-023` | 머니투데이 | <https://www.mt.co.kr/> | HTML | 실시간 | 자산리포트 · 골든타임 | 부이대리 | OK 200 | 증시·정책 속보 |
| `content-hook-024` | 이데일리 | <https://www.edaily.co.kr/> | HTML | 실시간 | 자산리포트 | 부이대리 | OK 200 | 금융·부동산 속보 |
| `content-hook-025` | 서울경제 | <https://www.sedaily.com/> | HTML | 실시간 | 자산리포트 | 부이대리 | OK 200 | 경제 정책·기업 |
| `content-hook-026` | SBS 뉴스 | <https://news.sbs.co.kr/> | HTML | 실시간 | 골든타임 | 뮤즈대리 | OK 200 | 방송 1차 보도(사실 확인) |
| `content-hook-027` | KBS 뉴스 | <https://news.kbs.co.kr/> | HTML | 실시간 | 골든타임 | 뮤즈대리 | OK 200 | 방송 1차 보도 |
| `content-hook-028` | MBC 뉴스 | <https://imnews.imbc.com/> | HTML | 실시간 | 골든타임 | 뮤즈대리 | OK 200 | 방송 1차 보도 |
| `content-hook-029` | JTBC 뉴스 | <https://news.jtbc.co.kr/> | HTML | 실시간 | 골든타임 | 뮤즈대리 | OK 200 | 방송 1차 보도 |
| `content-hook-030` | 브런치 | <https://brunch.co.kr/> | HTML | 일간 | 자산리포트 | 부이대리 | REDIRECT 302 | 에세이형 서사 벤치마크 |
| `content-hook-031` | 뉴닉 | <https://newneek.co/> | HTML | 일간 | 골든타임 | 부이대리 | OK 200 | 뉴스레터형 요약·친근체 |
| `content-hook-032` | 어피티 | <https://uppity.co.kr/> | HTML | 일간 | 골든타임 | 부이대리 | OK 200 | 20대 금융 콘텐츠 구성 |
| `content-hook-033` | 캐릿 | <https://www.careet.net/> | HTML | 일간 | 골든타임 | 뮤즈대리 | OK 200 | 카드뉴스·밈 트렌드 |
| `content-hook-034` | 토스 피드 | <https://toss.im/tossfeed> | HTML | 주간 | 자산리포트 · 자료앨범 | 뮤즈대리 | OK 200 | 금융 서비스 카피·정보 설계 |
| `content-hook-035` | 카카오뱅크 | <https://www.kakaobank.com/> | HTML | 주간 | 자산리포트 · 자료앨범 | 뮤즈대리 | OK 200 | 금융 서비스 화면·카피 사례(뱅크스토리 하위 경로는 404) |
| `content-hook-036` | Behance | <https://www.behance.net/> | HTML | 일간 | 자료앨범 | 뮤즈대리 | KEY/차단 403 | 카드뉴스·인포그래픽 레퍼런스 |
| `content-hook-037` | Dribbble | <https://dribbble.com/> | HTML | 일간 | 자료앨범 | 뮤즈대리 | OK 202 | UI·일러스트 레퍼런스 |
| `content-hook-038` | Pinterest | <https://www.pinterest.co.kr/> | HTML | 일간 | 자료앨범 | 뮤즈대리 | OK 200 | 비주얼 무드보드 |
| `content-hook-039` | TikTok Creative Center | <https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/ko> | HTML | 주간 | 골든타임 | 뮤즈대리 | OK 200 | 숏폼 인기 해시태그·포맷 |
| `content-hook-040` | 인스타그램 탐색 | <https://www.instagram.com/explore/> | HTML | 실시간 | 자료앨범 | 뮤즈대리 | OK 200 | 릴스·카드뉴스 트렌드(로그인 제한 주의) |
| `content-hook-041` | Threads 탐색 | <https://www.threads.com/> | HTML | 실시간 | 자료앨범 · 골든타임 | 뮤즈대리 | OK 200 | 텍스트+이미지 포맷 트렌드 |

