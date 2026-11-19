#!/usr/bin/env bash
# GitHub Pages 배포 — 서브패스(/buffetkimz-web/)로 빌드해 gh-pages 브랜치에 올린다.
# 사용: SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web bash scripts/deploy_pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_URL="${SITE_URL:-https://byhan2025.github.io}"
BASE_PATH="${BASE_PATH:-/buffetkimz-web}"
ORIGIN="$(git remote get-url origin)"

echo "▶ build  SITE_URL=$SITE_URL  BASE_PATH=$BASE_PATH"
SITE_URL="$SITE_URL" BASE_PATH="$BASE_PATH" npm run build

# NFS에서 git 객체 핸들이 남아 rm이 실패하는 경우가 있어 매번 새 임시 폴더를 쓴다.
DEPLOY_DIR=".deploy-gh-pages-$(date +%s)"
rm -rf .deploy-gh-pages* 2>/dev/null || true
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"
git init -q
git checkout -q -b gh-pages
cp -r ../dist/. .
touch .nojekyll
git add -A
git -c user.name="byhan2025" -c user.email="byhan2025@users.noreply.github.com" \
    commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%MZ) ($BASE_PATH)"
git remote add origin "$ORIGIN"
git push -f origin gh-pages
cd ..
rm -rf "$DEPLOY_DIR" 2>/dev/null || true
echo "▶ pushed gh-pages"
