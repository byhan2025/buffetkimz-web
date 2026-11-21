# 유용한앱 4탄 — 병합 안내

작업 위치: worktree `/workspace/.worktrees/bk-utils-d`
검수 결과: `reports/utils-d/test-report.json` **90/90 통과** · 콘솔 오류 0 · 390px 가로 넘침 0

## 브랜치 세 개

| 브랜치 | 기준 | 내용 | 쓰는 때 |
|---|---|---|---|
| **`feat/utils-d-main`** | `main`(v7.3) | **바로 병합할 브랜치.** 위 7종과 나란히 4종이 들어가고 앱스토어·상세·실행·도해까지 연결 완료 | 오늘 밤 그대로 배포할 때 |
| `feat/utils-d-wired` | `f537423`(v7.2.1) | 위와 같은 내용이지만 v7.3 이전 기준 | v7.3을 되돌릴 때만 |
| `feat/utils-d` | `f537423` | 컴포넌트·데이터·검수만(공유 파일 무변경) | 손으로 병합할 때 |

> v7.3(유용한앱 7종)이 `main`에 먼저 들어와 있어서, 그 위로 리베이스한 `feat/utils-d-main`을 만들었다.
> 이 브랜치는 `main`에서 fast-forward로 붙는다(충돌 없음). 아래는 그 브랜치가 고친 곳이다.

## `feat/utils-d-main`이 바꾼 곳

```
src/data/apps.ts                        App["art"]에 UtilsArt(= u-upscale·u-shorten·u-pdf-split·u-clock),
                                        App에 runMode/sendsDataOut, apps 배열 끝에 ...utilsDApps
src/data/store.ts                       StoreIcon에 UtilsArt, artToIcon 4개, 카드 meta·order를 utilsDStore에서 덧씌움
src/components/tools/ToolRunner.tsx     ./utils/ 4개 import + MAP 4줄
src/components/apps/AppStoreIcon.astro  이름 유니언 4개 + paths에 ...UTILS_D_ICONS
src/components/AppArt.astro             4종 도해 + 유니언
src/pages/apps/[slug]/run.astro         설명·칩·아래 안내를 runMode/sendsDataOut으로 한 단계 더 분기
src/pages/apps/[slug].astro             '입력값 서버 미전송' → 단축기는 '단축할 때만 주소 전송'
package.json / lock                     qrcode-generator ^2.0.4 추가(v7.3의 qrcode ^1.5.4와 함께 쓴다)
```

**꼭 알아 둘 것 — URL 단축기는 값을 밖으로 보낸다.**
v7.3의 실행 화면은 `category === "utility"`면 일괄로 `서버 미전송` 칩을 붙인다. 그런데 이 앱은
짧은 주소를 만들 때 주소를 spoo.me로 보낸다. 그래서 `sendsDataOut` 플래그를 만들어 그 앱만
`단축만 외부 전송`으로 바꿨다. 이 분기를 지우면 사이트가 사실과 다른 말을 하게 된다.

새로 들어오는 파일

```
src/components/tools/utils/{ImageUpscale,UrlShortener,PdfMergeSplit,MarketWorldClock,UtilShell}.tsx
src/data/utils-d.ts
src/pages/utils-d-preview.astro      ← 검수용. 병합 뒤 지워도 된다
scripts/test_utils_d.py
reports/utils-d/                     ← 검수 결과·스크린샷·이 안내
```

## 병합 절차 (권장)

```bash
cd apps/buffetkimz-web
git merge --no-ff feat/utils-d-main     # main에서 fast-forward로 붙는다
npm install                             # qrcode-generator
PATH=/workspace/.tools/node-v22.23.4-linux-x64/bin:$PATH npm run build
```

확인할 것

- `/apps` → 유용한앱 탭에 7종 + 4종 = 11종(골든타임·자료앨범 포함 13칸)
- `/apps/image-upscale`, `/apps/url-shortener`, `/apps/pdf-merge-split`, `/apps/market-world-clock` 소개·실행이 열리는지
- `/apps/watermark/run` 같은 기존 7종의 칩·안내 문구가 **그대로**인지(바뀐 것은 4종뿐)

## 2탄·3탄과 함께 병합할 때

`feat/utils-b`(2탄)·`feat/utils-c`(3탄)는 `tools/utils/` 아래 컴포넌트와 `UtilShell.tsx`를 쓴다.
이 브랜치의 `UtilShell.tsx`는 **2탄 것과 같고 배지 문구를 바꿀 수 있는 선택 prop 하나만 더했다**
(`badge?: { label, tone }`, 기본값 `서버 미전송`). add/add 충돌이 나면 **이 브랜치 파일을 남기면**
2탄 컴포넌트도 그대로 동작한다. 3탄이 같은 파일을 고쳤다면 UtilShell 함수 머리와 배지 span 두 곳만 합치면 된다.

## 7종과 겹치는 부분

- `url-cleaner`(URL 추적제거)와 `url-shortener`는 추적 파라미터를 떼는 일이 겹친다. 다만 이쪽은
  **짧은 주소·QR**이 목적이고, 추적 제거는 부수 기능이다. 카드 문구로 구분된다.
- `pdf-image`(PDF↔이미지)와 `pdf-merge-split`은 대상이 다르다(변환 vs 병합·추출).

## 이번 검수에서 확인한 것 (증거)

`reports/utils-d/test-report.json` — 90/90.

- **이미지 업스케일**: 240×180 → 960×720(4배)·720×540(3배) 캔버스 크기, 색 보존, PNG 헤더 960×720,
  선명화 켜기/끄기의 픽셀 합 차이, 한 번에 키운 기준선보다 라플라시안 에너지 0.207 vs 0.129,
  1800×1200에서 4배는 캔버스 한도(16,777,216px) 초과로 **미리 막고** 2배는 열림, 사진을 바꾸면 이전 결과를 지움.
- **URL 단축**: 추적 3개 제거, 잘못된 주소 안내, **실제 spoo.me 호출 200·짧은 주소 생성**, QR, 복사, 목록.
  (tinyurl·is.gd·v.gd는 Access-Control-Allow-Origin을 우리 출처에 열지 않아 브라우저 호출이 막힌다 — 코드 주석에 근거.)
- **PDF**: 2쪽+3쪽 병합 → 5쪽(pypdf 확인), 순서 바꾸기, 손상 파일은 이유를 적고 목록에 넣지 않음,
  범위 초과 안내, `1-2, 4` 추출 → 3쪽, 파일명 `c-4p-p1-2_4.pdf`.
- **세계시계**: 다섯 거래소 시각을 파이썬 zoneinfo와 초 단위 대조, 1초마다 흐름, 11월 서머타임 표기 없음,
  7월 15일로 시계를 심으면 뉴욕 -4h·런던 +1h·파리 +2h와 '서머타임 중' 3곳.
- **공통**: 콘솔 오류 0, 390px에서 페이지·도구 내부 가로 넘침 0.

### 이 환경에서 검수를 돌릴 때

```bash
LD_LIBRARY_PATH=/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu python3 scripts/test_utils_d.py
```
