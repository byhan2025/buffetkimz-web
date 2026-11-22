# 1차 원천 소스 카탈로그 실측 검증 보고서

- 검증 시각: 2026-11-22T10:03:55+09:00 (KST)
- 카탈로그: **336개** · 실측 기록 **336개** (개별 검증 시각은 `sources-catalog.json`의 `verify.checked_at`)
- 결과: OK 282 · KEY/차단 36 · ENV(환경제약) 14 · REDIRECT 4

## 판정 기준

- `OK` — 2xx 응답(실제 콘텐츠 수신)
- `KEY/차단` — 400·401·403·405·429. 엔드포인트는 존재하며 API 키·파라미터·브라우저 헤더가 필요
- `REDIRECT` — 3xx(최종 목적지 추적됨)
- `MISSING` — 404·410. 주소 소멸(수정·교체 대상)
- `ERROR` — 5xx·TLS·DNS·타임아웃
- `ENV(환경제약)` — DNS는 해석되나 이 실행 환경에서 접속 차단(해외 IP 차단·방화벽). 주소 자체는 존재
- `DNS없음` — 도메인 자체가 해석되지 않음(폐쇄·이전). 교체 대상

## 분야별 결과

| 분야 | OK | KEY/차단 | REDIRECT | MISSING | ERROR | ENV | DNS없음 |
|---|---:|---:|---:|---:|---:|---:|---:|
| ①거시경제·중앙은행·금리·환율 | 32 | 7 | 0 | 0 | 0 | 2 | 0 |
| ②국내 증시·공시·ETF | 25 | 5 | 0 | 0 | 0 | 5 | 0 |
| ③미국·글로벌 증시·기업공시 | 34 | 16 | 0 | 0 | 0 | 0 | 0 |
| ④세법·연금·절세·노동 | 33 | 1 | 0 | 0 | 0 | 2 | 0 |
| ⑤보험·건강·복지 | 43 | 1 | 1 | 0 | 0 | 2 | 0 |
| ⑥부동산·청약·주거 | 27 | 1 | 2 | 0 | 0 | 3 | 0 |
| ⑦AI·테크 1차 연구·오픈소스 | 50 | 3 | 0 | 0 | 0 | 0 | 0 |
| ⑧콘텐츠 훅·스토리텔링 벤치마킹 | 38 | 2 | 1 | 0 | 0 | 0 | 0 |

## 요청 실패·소멸 목록

- `ENV` macro-015 · FRED 10년물 국채금리 시계열 · <https://fred.stlouisfed.org/series/DGS10> · TimeoutError: The read operation timed out | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` macro-016 · FRED ALFRED 빈티지 데이터 · <https://alfred.stlouisfed.org/> · TimeoutError: The read operation timed out | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` kr-market-018 · KB자산운용 RISE ETF · <https://www.riseetf.co.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` kr-market-019 · 한화자산운용 PLUS ETF · <https://www.plusetf.co.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` kr-market-024 · 한국기업평가 · <https://www.korearating.com/> · DNS: URLError: <urlopen error [Errno -2] Name or service not known> | 도메인 존재 확인(간헐 DNS·해외 IP 접속 차단), 국내망에서 재확인 필요
- `ENV` kr-market-026 · 한국IR협의회 · <https://www.kirs.or.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` kr-market-027 · 코스닥협회 · <https://www.kosdaqca.or.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` tax-pension-labor-032 · 워크넷 · <https://www.work.go.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` tax-pension-labor-035 · 한국재정학회 · <https://www.kafa.or.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` insurance-health-042 · 보험연수원 · <https://www.insure.or.kr/> · DNS: URLError: <urlopen error [Errno -2] Name or service not known> | 도메인 존재 확인(간헐 DNS·해외 IP 접속 차단), 국내망에서 재확인 필요
- `ENV` insurance-health-045 · 대한의사협회 · <https://www.kma.org/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` real-estate-002 · 국토교통부 실거래가 공공데이터 API · <https://openapi.molit.go.kr/OpenAPI_ToolInstallPage.do> · URLError: <urlopen error [Errno 111] Connection refused> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` real-estate-027 · 한국공인중개사협회 · <https://www.kar.or.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
- `ENV` real-estate-030 · 마이홈 주거복지포털 · <https://www.myhome.go.kr/> · URLError: <urlopen error timed out> | DNS는 해석됨(주소는 존재, 이 실행환경에서 접속 차단)
