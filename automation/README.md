# automation/ — buffetkimz.com 콘텐츠 자동화 시스템

이 폴더는 `buffetkimz.com`의 콘텐츠를 **1차 원천에서 직접 받아** 글·계산기·일정·자료앨범 4곳에 동시에 꽂기 위한 자동화 자산이다.
운영 규칙(편제·7단계·게이트·금지규칙)은 **`AUTOMATION-A-TO-Z.md`** 가 정본이다.

## 1. 무엇이 들어 있나

| 파일 | 역할 |
|---|---|
| `AUTOMATION-A-TO-Z.md` | 운영 지침서 정본(7단계 파이프라인·10명 편제·OSMU 4연동·폴백·금지규칙) |
| `sources-catalog.json` | **1차 원천 소스 336개** 마스터 카탈로그(기계 판독) |
| `SOURCES-CATALOG.md` | 같은 데이터의 사람용 표(검증 결과 포함) |
| `verification-report.md` / `.json` | 336개 전수 HTTP 실측 결과 |
| `output/` | S1 수집 결과(`collected-YYYYMMDD-HHMM.json` / `.md`) |
| `tools/build_catalog.py` | 카탈로그 빌더(필드·중복 URL 검사, verify 보존) |
| `tools/verify_catalog.py` | 전수 실측 검증기(재시도·curl 폴백·DNS 판별) |
| `tools/catalog_data/cat1~8_*.py` | 분야별 원천 정의(수정 지점) |

수집기 본체는 `../scripts/collect_sources_sample.py` 에 있다.

## 2. 30초 사용법

```bash
cd apps/buffetkimz-web

# 오늘의 원천 수집 (성공 15/15 · 신선 57건 실측)
python3 scripts/collect_sources_sample.py --days 1 --limit 15

# 카탈로그 재생성 / 검사
python3 automation/tools/build_catalog.py
python3 automation/tools/build_catalog.py --check

# 링크·소스 신선도 검증(주간)
python3 automation/tools/verify_catalog.py --retry-errors
```

## 3. 검증 스냅샷 (2026-11-22)

- 총 **336개** · 8개 분야 · HTML 292 / RSS 22 / API 21 / CSV 1
- **OK 282 · KEY/차단 36 · REDIRECT 4 · ENV(환경제약) 14 · 404 0**
- 수집기 1회 실행: **15/15 피드 성공** — 3일 창 신선 57건 / 1일 창 신선 29건(연합뉴스·매일경제 당일 기사 포함)
- 현재 아카이브 `publish_pipeline.py validate` 기준선: error 0건(2026-11-22 정리 완료) — 신규 글도 0건 기준 적용

## 4. 하지 않는 일

- 라이브 사이트 배포, 로고·브랜드 변경 (김대표님 승인 전 금지)
- 확인되지 않은 수치의 추정 복원
- 원본 기사 제목의 그대로 노출
- 대외 발송(소식지·SNS) — 승인 후에만
