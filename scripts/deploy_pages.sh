#!/usr/bin/env bash
# GitHub Pages 배포 — 서브패스(/buffetkimz-web/)로 빌드해 gh-pages 브랜치에 올린다.
# 사용: SITE_URL=https://byhan2025.github.io BASE_PATH=/buffetkimz-web bash scripts/deploy_pages.sh
#
# 2026-11-22 v8.0.0 — 자료앨범 카드 24장(약 31MB)이 더해져 dist가 85MB가 되자,
#   빈 저장소에 dist 전부를 담아 force-push하던 방식이 `HTTP 413`으로 막혔다(푸시 한도).
#   그래서 gh-pages 사본(mirror)을 하나 두고, 거기서 **바뀐 델타만** 올린다.
#   · mirror가 있으면: fetch(델타) → dist로 맞춤 → commit → push  ← 보통 이 경로
#   · mirror가 없으면: 얕은 clone으로 만든다(내용이 작을 때만 성공)
#   · 그래도 안 되면(413): 처음 배포처럼 새 저장소를 만들어 force-push (내용이 작을 때만)
#
# mirror 위치: 기본 `../.gh-pages-mirror`(저장소 밖) — `GH_PAGES_MIRROR`로 바꿀 수 있다.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_URL="${SITE_URL:-https://byhan2025.github.io}"
BASE_PATH="${BASE_PATH:-/buffetkimz-web}"
ORIGIN="$(git remote get-url origin)"
MIRROR="${GH_PAGES_MIRROR:-$PWD/../.gh-pages-mirror}"

echo "▶ build  SITE_URL=$SITE_URL  BASE_PATH=$BASE_PATH"
SITE_URL="$SITE_URL" BASE_PATH="$BASE_PATH" npm run build

# ── 용량 체크 — gh-pages 푸시 한도(413)에 걸리기 전에 눈으로 확인한다.
python3 - <<'PY'
import pathlib
root = pathlib.Path("dist")
files = [(p.stat().st_size, p) for p in root.rglob("*") if p.is_file()]
total = sum(s for s, _ in files) / 1048576
big = sorted(files, reverse=True)[:3]
print(f"▶ dist 용량 {total:.1f}MB · 파일 {len(files)}개")
for s, p in big:
    print(f"   최대 {s/1048576:.2f}MB  {p}")
if any(s >= 100 * 1024 * 1024 for s, _ in files):
    raise SystemExit("중단: 100MB 이상 파일이 있습니다 — GitHub이 받지 않습니다. 원본은 배포 밖(brand-source/)으로 옮기세요.")
if total > 80:
    print("   주의: 80MB 초과 — 델타 푸시로 올리지만, 새 카드 세트가 계속 늘면 카드 압축/외부 저장을 검토하세요.")
PY

sync_tree() {  # $1 = 작업 트리 경로 — .git만 남기고 비운 뒤 dist를 복사
  python3 - "$1" <<'PY'
import pathlib
import shutil
import sys

dst = pathlib.Path(sys.argv[1])
src = pathlib.Path("dist")
for p in dst.iterdir():
    if p.name == ".git":
        continue
    shutil.rmtree(p) if p.is_dir() else p.unlink()
shutil.copytree(src, dst, dirs_exist_ok=True)
(dst / ".nojekyll").touch()
PY
}

deploy_from_mirror() {  # mirror의 gh-pages를 최신으로 맞추고 dist로 덮은 뒤 델타 푸시
  cd "$MIRROR"
  if git fetch -q --depth 1 origin gh-pages 2>/dev/null; then
    git reset -q --hard FETCH_HEAD
  else
    echo "   (fetch 실패 — 로컬 gh-pages 상태로 진행)"
  fi
  cd - >/dev/null
  sync_tree "$MIRROR"
  cd "$MIRROR"
  if git status --porcelain | grep -q .; then
    git add -A
    git -c user.name="byhan2025" -c user.email="byhan2025@users.noreply.github.com" \
        commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%MZ) ($BASE_PATH)"
    git push origin gh-pages
    echo "▶ pushed gh-pages (델타)"
  else
    echo "▶ gh-pages 변경 없음 — 푸시 생략"
  fi
  cd - >/dev/null
}

if [ -d "$MIRROR/.git" ]; then
  echo "▶ gh-pages mirror 사용: $MIRROR"
  deploy_from_mirror
  exit 0
fi

echo "▶ gh-pages mirror가 없어 얕은 clone으로 만든다: $MIRROR"
if git clone -q --branch gh-pages --depth 1 "$ORIGIN" "$MIRROR" 2>/dev/null; then
  deploy_from_mirror
  exit 0
fi
rm -rf "$MIRROR" 2>/dev/null || true

# ── 마지막 수단 — 빈 저장소에 dist 전부(내용이 작을 때만 통과한다).
echo "▶ clone 실패(413 추정) — 새 저장소로 force-push 시도"
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
echo "▶ pushed gh-pages (최초/전체)"
