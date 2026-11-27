# public/vendor/ 오픈소스 라이선스 고지

buffetkimz.com 은 외부 CDN에 기대지 않고 사이트 안의 파일만으로 도구를 돌린다.
아래 라이브러리는 `public/vendor/`에 원본 그대로 두었고, 각 폴더의 `LICENSE*` 파일이 원문이다.

| 파일 | 라이브러리 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| `vendor/ocr/tesseract-core-lstm.js` · `tesseract-core-simd-lstm.js` · `*.wasm` | tesseract.js-core (Tesseract 5 LSTM 빌드) | Apache-2.0 | 진료비 영수증·서류 사진의 글자 인식(브라우저 안에서만 실행) |
| `vendor/ocr/kor.traineddata` | tessdata_fast `kor` 학습데이터 | Apache-2.0 | 한국어 글자 인식 |
| `vendor/ocr/eng.traineddata` | tessdata_fast `eng` 학습데이터 | Apache-2.0 | 영문·숫자(검사명 MRI·MRA, 병원 영문명) 인식 보조 |

## 저작권 고지

- **tesseract.js-core** — Apache License 2.0, Copyright (c) 2018 Tesseract.js contributors
- **tessdata_fast (kor·eng)** — Apache License 2.0, Copyright Google Inc. / Tesseract OCR contributors

원문: `vendor/ocr/LICENSE-tesseract.js-core.txt`, `vendor/ocr/LICENSE-tessdata.txt`

## 어떻게 쓰이나

- 영수증 사진·스캔 PDF는 **브라우저 안에서** 위 엔진으로 읽는다. 파일은 어느 서버로도 전송되지 않는다.
- 글자가 들어 있는 PDF는 엔진 없이 PDF.js(사이트 번들)로 글자만 뽑는다.
- 엔진 파일은 사용자가 영수증을 올릴 때만 내려받는다(도구 첫 화면에서는 내려받지 않는다).
