#!/usr/bin/env bash
# 실 도메인(buffetkimz.com) 배포 — 루트 경로 빌드 + CNAME + gh-pages 푸시.
#
# 준비(한 번만):
#   1) GitHub 저장소 Settings → Pages → Custom domain 에 buffetkimz.com 저장 (DNS 전파 전에도 가능)
#   2) 카페24 DNS: 기존 웹호스팅/주차 A레코드 삭제 → GitHub Pages A 4개 + www CNAME
#      (자세한 순서: reports/buffetkimz-web/domain-seo-v3/00-domain-dns-guide.md)
#   3) dig buffetkimz.com +short 가 185.199.108.153 등을 돌려주는지 확인
#
# 사용:
#   CONFIRM=deploy-domain bash scripts/deploy_domain.sh
#
# 이 스크립트는 광고 자리 프리뷰(AD_PREVIEW)를 절대 켜지 않는다 — 실수로 켜진 환경변수도 지운다.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${CONFIRM:-}" != "deploy-domain" ]; then
  echo "중단: CONFIRM=deploy-domain 을 붙여야 실행됩니다(도메인 전환은 되돌리기 어려운 단계)."
  exit 1
fi

unset AD_PREVIEW ADS_PREVIEW || true
SITE_URL="https://buffetkimz.com"
BASE_PATH="/"
ORIGIN="$(git remote get-url origin)"

echo "▶ build  SITE_URL=$SITE_URL  BASE_PATH=$BASE_PATH  (ads off)"
SITE_URL="$SITE_URL" BASE_PATH="$BASE_PATH" ADS_ENABLED=0 npm run build

# CNAME 은 저장소의 deploy/CNAME 을 배포 루트로 복사한다.
# (public/CNAME 으로 두면 아직 살아 있는 서브패스 배포에도 커스텀 도메인이 먼저 걸려
#  github.io 주소가 죽는다. 도메인 전환이 끝난 뒤에는 public/CNAME 으로 옮겨도 된다.)
cp deploy/CNAME dist/CNAME
touch dist/.nojekyll

grep -q '^buffetkimz.com$' dist/CNAME || { echo "CNAME 내용이 올바르지 않습니다"; exit 1; }
! grep -q 'data-ad-slot' -r dist || { echo "광고 자리 DOM 이 남아 있습니다(ADS_ENABLED 확인)"; exit 1; }

DEPLOY_DIR=".deploy-gh-pages-$(date +%s)"
rm -rf .deploy-gh-pages* 2>/dev/null || true
mkdir -p "$DEPLOY_DIR"
cp -r dist/. "$DEPLOY_DIR"/
cd "$DEPLOY_DIR"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="byhan2025" -c user.email="byhan2025@users.noreply.github.com" \
    commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%MZ) (buffetkimz.com, root)"
git remote add origin "$ORIGIN"
git push -f origin gh-pages
cd ..
rm -rf "$DEPLOY_DIR" 2>/dev/null || true

echo "▶ pushed gh-pages (custom domain: buffetkimz.com)"
echo "  다음: GitHub Pages → Enforce HTTPS 체크, DNS 전파 확인, 검색엔진 사이트맵 제출"
