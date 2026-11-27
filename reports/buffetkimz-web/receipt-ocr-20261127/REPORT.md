# 진료비 영수증 OCR 자동 입력기 — 웹·InsureCRM 듀얼 장착 (2026-11-27)

## 무엇을 만들었나

세대별 실손 계산기의 `① 영수증 입력` 단계 맨 위에 **"영수증 사진·PDF 올려서 자동 채우기"** 를 붙였다.
진료비 계산서·영수증 또는 약제비 영수증을 올리면 항목을 읽어 입력 칸을 채우고, 값마다 **원문 줄과 신뢰도**를
보여 준다. 파일은 **브라우저 안에서만** 처리하며 외부 서버·외부 CDN으로 나가지 않는다.

- 라이브(웹): https://byhan2025.github.io/buffetkimz-web/apps/silson-compare/run/
- CRM: `apps/insure-crm/` v2.9.5 (드라이브 `InsureCRM_v2.9.5` / `reports/insure-crm/v2.9.5/MD5검증.md`)

## 구조 (엔진 한 벌, 두 앱)

| 파일 | 역할 |
| --- | --- |
| `src/lib/silson/receiptParser.js` | 순수 파서 — 줄 목록 → 실손 계산기 입력값. 값마다 `evidence`·`confidence`, 합계 검산 경고 |
| `src/lib/silson/receiptOcr.ts` | PDF.js 글자 추출 + 로컬 Tesseract(kor+eng) OCR·전처리·TSV→줄 복원. 엔진은 `public/vendor/ocr/` 에서만 |
| `src/components/tools/SilsonCompare.tsx` | 드롭존·진행률(%)·인식 요약 배너·원문 근거·신뢰도 배지. 390px 1열 터치 44px |
| `scripts/build_receipt_core.mjs` | 위 파서 → `apps/insure-crm/receipt-core.js` (`window.SilsonReceipt`, `--check` 지원) |

읽는 항목: 진료 구분(통원·입원) / 병원 등급(의원·병원·종합병원·상급종합) / 급여 일부·전액 본인부담금 /
공단부담금 / 처방조제비 / 일반 비급여 / 도수·체외충격파·증식 / 비급여 주사 / MRI·MRA / 상급병실료 차액·입원일수.

안전장치
- 값마다 원문 줄과 신뢰도(정확·보통·확인 필요) — OCR 오인식을 사용자가 그 자리에서 판단.
- 환자부담총액 대조: 세부 합계가 다르면 **경고 배지**(조용히 틀린 숫자를 넣지 않는다).
- 비급여 합계에서 도수·주사·MRI·상급병실료를 뺀 나머지를 일반 비급여로 계산(이중 계상 방지).
- OCR 오인식 보정: `0↔O`, `1↔l`, `료↔로`, 괄호 안 횟수·일수를 금액으로 오인하지 않음(세부 항목은 가장 큰 수).
- 약국 '약제비 영수증'은 본인부담금을 처방조제비로 옮겨 잡는다.

## 검증 결과 (2026-11-27)

| 시험 | 결과 |
| --- | --- |
| `node scripts/test_receipt_parser.mjs` | **28/28 통과** (표준 3종·약국·OCR 노이즈·탭 PDF·병원 등급 4종·검산 경고·엔진 연결) |
| `node scripts/test_silson_core.mjs` | 79/79 통과(회귀 없음) |
| `npm run verify:tax` | 22/22 통과 |
| `python3 scripts/test_receipt_ocr_e2e.py live 390x844` | **PASS** — 가상 3종·PNG OCR 1.9s·글자 PDF 0.5s·스캔 PDF 1.1s, 가로 넘침 0, 콘솔 오류 0 |
| `python3 scripts/test_receipt_ocr_e2e.py live 1280x800` | **PASS** |
| InsureCRM `test_insure_crm_silson.py` | **PASS** — PNG 2.4s / 글자 PDF 0.2s / 스캔 PDF 2.6s, 404·콘솔 오류 0 |
| InsureCRM `test_insure_crm_bojang.py` · `test_simpyeong.py` | PASS(회귀 없음) |

합성 영수증(실제 OCR 파이프라인): `fixtures/receipt-clinic.png`(의원 외래 12,000·4,500·총 16,500),
`receipt-inpatient.png`(상급종합 입원 850,000·MRI 700,000·상급병실 500,000(2일)·일반 50,000·총 2,100,000)
→ 웹·CRM 모두 값 일치.

## 화면 캡처

- `local-390x844-01-empty.png` … `07-pdf-scan.png` (로컬 빌드)
- `live-390x844-01-empty.png` … `live-390x844-07-pdf-scan.png` (라이브)
- `live-1280x800-*.png`
- `e2e-local*.json` · `e2e-live*.json` · `parser-unit-test.json` (검사 기록)

## 알려진 한계

- 스캔 PDF는 페이지를 그림으로 다시 그려 읽는다. 인쇄가 흐리면 숫자를 잘못 읽을 수 있고,
  그때는 **합계 불일치 경고**로 알린다(웹은 같은 파일을 정확히 읽었고, CRM은 상급병실료를 900,000으로 오독 → 경고 표시).
- 사진은 정면·밝은 곳에서 찍은 것이 가장 정확하다. 기울기 보정·이진화 보정을 넣었지만 손글씨·구겨진 종이는 약하다.
- 1건 기준 계산기이므로 여러 날 입원의 영수증을 여러 장 올려도 한 번에 한 장씩 처리한다(최대 3장까지 올리면 각각의 항목을 합쳐 읽는다).
