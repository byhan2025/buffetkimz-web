#!/usr/bin/env bash
# buffetkimz.com 표준 빌드·검증·배포 래퍼 (2026-11-22 신설)
#
# 왜 필요한가 — 리허설(reports/buffetkimz-web/automation-rehearsal-20261122.md §5) 실측:
#   ① 스케줄 러너의 기본 PATH(/opt/pickle-cli:/usr/local/bin:/usr/bin:/bin)에는 node·npm이 없다.
#      → export PATH 없이 `npm run build`를 부르면 즉시 실패하고, npm을 절대경로로 불러도
#        `env: node: No such file or directory`로 죽는다.
#   ② 06:00·08:20·19:00·05:30 액션이 같은 시각에 빌드하면 서로의 dist를 밟아
#      `Rolldown panicked … thread pool has not been initialized`, INDEX_MISSING이 난다.
#   ③ 메모리 제한 환경에서 병렬 스레드를 줄이지 않으면 빌드가 간헐적으로 깨진다.
#
# 그래서 이 스크립트 하나만 쓰면 ①PATH ②flock(/tmp/buffetkimz-build.lock, 300초) ③스레드·힙 제한
# ④dist 준비 검사(index.html + HTML 50개 이상)가 자동으로 걸린다.
#
# 사용법
#   bash scripts/build_with_lock.sh status              # 환경·락·dist 진단(아무것도 바꾸지 않음)
#   bash scripts/build_with_lock.sh build               # npm run build (도메인 루트)
#   bash scripts/build_with_lock.sh build-pages         # GitHub Pages 서브패스 빌드
#   bash scripts/build_with_lock.sh verify              # npm run verify:tax + dist 준비 검사
#   bash scripts/build_with_lock.sh deploy              # verify:tax → dist 검사 → npm run deploy:pages
#   bash scripts/build_with_lock.sh all                 # build → verify:tax → deploy:pages (S6 표준)
#
# 종료 코드는 **처음 실패한 단계**의 값을 그대로 낸다. v9.4.0(2026-11-24 전수 감사) 이전에는
#   `step_deploy`가 실패한 deploy:pages 뒤에도 "배포 후 dist 재확인"을 계속 돌고 그 성공(0)을
#   스크립트 종료값으로 내보내서, gh-pages 푸시가 403으로 막혀도 화면에는 "■ deploy 성공"이 찍혔다.
#   스케줄 액션이 그 문구를 믿고 "배포 완료"로 기록하는 사고가 실제로 났다(S2~S6 노트 11-23 3항).
#   bash scripts/build_with_lock.sh run -- python3 scripts/publish_pipeline.py validate
#   bash scripts/build_with_lock.sh deploy --dry-run    # 실행 계획만 출력(부작용 없음)
#
# 환경변수
#   BUILD_LOCK_FILE   기본 /tmp/buffetkimz-build.lock (브리프 지정 경로)
#   BUILD_LOCK_EXTRA  기본 /workspace/tmp/buffetkimz-build.lock — /tmp가 호출마다 초기화되는
#                     환경에서도 직렬화가 걸리도록 함께 잡는 작업공간 락(빈 값이면 끔)
#   BUILD_LOCK_WAIT   기본 300(초). 락을 못 잡으면 exit 75로 끝난다(다른 빌드가 도는 중).
#   BUFFETKIMZ_NODE_BIN  PATH 앞에 붙일 node 디렉터리(콜론 구분). 기본은 v22 → v26 순.
#   SITE_URL / BASE_PATH  build-pages·deploy에 쓸 배포 주소(기본 https://byhan2025.github.io, /buffetkimz-web)
#
# 종료 코드: 0 성공 · 1 단계 실패 · 2 사용법 오류 · 75 락 대기 시간 초과
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SELF_DIR/.." && pwd)"
cd "$APP_DIR"

# ── 환경 보정(①) — 이 블록이 없으면 스케줄 러너 셸에서는 아무것도 실행되지 않는다.
NODE_BIN="${BUFFETKIMZ_NODE_BIN:-/workspace/.tools/node-v22.23.4-linux-x64/bin:/workspace/.toolchain/node-v26.13.1-linux-x64/bin}"
export PATH="$NODE_BIN:$PATH"
export MALLOC_ARENA_MAX=1
export RAYON_NUM_THREADS=1
export UV_THREADPOOL_SIZE=1
export NODE_OPTIONS="--max-old-space-size=1100"
export ASTRO_TELEMETRY_DISABLED=1

LOCK_FILE="${BUILD_LOCK_FILE:-/tmp/buffetkimz-build.lock}"
# 실측: 이 런타임의 /tmp는 호출마다 새로 만들어지는 tmpfs라 락이 공유되지 않는다.
# 그래서 /tmp 락(브리프 지정 경로)과 작업공간 락을 둘 다 잡는다 — 둘 중 하나만 공유되어도 직렬화된다.
LOCK_EXTRA="${BUILD_LOCK_EXTRA-/workspace/tmp/buffetkimz-build.lock}"
LOCK_WAIT="${BUILD_LOCK_WAIT:-300}"
SITE_URL="${SITE_URL:-https://byhan2025.github.io}"
BASE_PATH="${BASE_PATH:-/buffetkimz-web}"
DRY_RUN=0
MIN_HTML=50

CMD=""
RUN_ARGS=()

usage() {
  cat <<'USE'
사용법: bash scripts/build_with_lock.sh <명령> [옵션]

명령
  status         환경·락·dist 진단(아무것도 바꾸지 않음)
  build          npm run build (도메인 루트)
  build-pages    SITE_URL/BASE_PATH로 서브패스 빌드
  verify         npm run verify:tax + dist 준비 검사
  deploy         verify:tax → dist 검사 → npm run deploy:pages
  all            build → verify:tax → deploy:pages (S6 표준)
  run -- <cmd>   락·환경을 건 채 임의 명령 실행

옵션
  --dry-run              실행 계획만 출력(부작용 없음)
  --wait <초>            락 대기 시간(기본 300)
  --site-url <url>       build-pages·deploy 배포 주소
  --base-path </path>    build-pages·deploy 서브패스
USE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --wait) LOCK_WAIT="$2"; shift 2 ;;
    --site-url) SITE_URL="$2"; shift 2 ;;
    --base-path) BASE_PATH="$2"; shift 2 ;;
    -h|--help|help) usage; exit 0 ;;
    run)
      CMD="run"; shift
      [ "${1:-}" = "--" ] && shift
      RUN_ARGS=("$@")
      break ;;
    -*) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
    *) CMD="$1"; shift ;;
  esac
done

[ -n "$CMD" ] || { usage >&2; exit 2; }

say() { printf '%s\n' "$*"; }
hr() { printf '%s\n' "──────────────────────────────────────────────────────────────"; }

note_env() {
  say "▶ 작업 폴더: $APP_DIR"
  say "▶ node: $(command -v node || echo '(없음)') $(node -v 2>/dev/null || true)"
  say "▶ npm : $(command -v npm || echo '(없음)') $(npm -v 2>/dev/null || true)"
  say "▶ 제한: MALLOC_ARENA_MAX=$MALLOC_ARENA_MAX RAYON_NUM_THREADS=$RAYON_NUM_THREADS UV_THREADPOOL_SIZE=$UV_THREADPOOL_SIZE NODE_OPTIONS=$NODE_OPTIONS"
  say "▶ 락  : $LOCK_FILE ${LOCK_EXTRA:+(+ $LOCK_EXTRA )}(최대 ${LOCK_WAIT}초 대기)"
}

preflight() {
  command -v node >/dev/null 2>&1 || {
    echo "✗ node를 찾지 못했습니다. BUFFETKIMZ_NODE_BIN을 확인하세요." >&2
    exit 1
  }
  command -v npm >/dev/null 2>&1 || {
    echo "✗ npm을 찾지 못했습니다. BUFFETKIMZ_NODE_BIN을 확인하세요." >&2
    exit 1
  }
  command -v flock >/dev/null 2>&1 || {
    echo "✗ flock이 없습니다 — 동시 빌드 방지가 불가능하므로 중단합니다." >&2
    exit 1
  }
}

dist_html_count() {
  if [ -d dist ]; then
    find dist -name '*.html' -type f | wc -l | tr -d ' '
  else
    echo 0
  fi
}

assert_dist_ready() {  # $1 = 어느 단계에서 검사했는지
  local where="${1:-}"
  local count
  count="$(dist_html_count)"
  if [ ! -f dist/index.html ]; then
    echo "✗ dist 준비 실패($where): dist/index.html이 없습니다 — 빌드가 끝나지 않았거나 깨졌습니다. 배포하지 않습니다." >&2
    return 1
  fi
  if [ "$count" -lt "$MIN_HTML" ]; then
    echo "✗ dist 준비 실패($where): HTML ${count}개(< ${MIN_HTML}개) — 빌드 산출물이 비었습니다. 배포하지 않습니다." >&2
    return 1
  fi
  say "   dist 준비 OK: index.html + HTML ${count}개"
}

run_step() {  # $1 = 이름, 나머지 = 명령
  local name="$1"; shift
  hr
  say "▶ $name"
  say "   \$ $*"
  if [ "$DRY_RUN" -eq 1 ]; then
    say "   (dry-run — 실행하지 않음)"
    return 0
  fi
  local started=$SECONDS
  if "$@"; then
    say "✓ $name 완료 ($((SECONDS - started))초)"
  else
    local rc=$?
    echo "✗ $name 실패(exit $rc) — 다음 단계로 넘어가지 않습니다." >&2
    return "$rc"
  fi
}

step_build() {
  run_step "npm run build (도메인 루트)" npm run build
}

step_build_pages() {
  run_step "npm run build (서브패스 $BASE_PATH)" env SITE_URL="$SITE_URL" BASE_PATH="$BASE_PATH" npm run build
}

step_verify_tax() {
  run_step "npm run verify:tax (세율 단일출처 22항목)" npm run verify:tax
}

step_deploy() {
  step_verify_tax || return $?
  hr
  say "▶ dist 준비 검사(배포 직전)"
  if [ "$DRY_RUN" -eq 1 ]; then say "   (dry-run — 검사 생략)"; else assert_dist_ready "배포 직전" || return $?; fi
  run_step "npm run deploy:pages (gh-pages 델타 미러)" npm run deploy:pages || return $?
  hr
  say "▶ 배포 후 dist 재확인"
  if [ "$DRY_RUN" -eq 1 ]; then say "   (dry-run — 검사 생략)"; else assert_dist_ready "배포 후" || return $?; fi
}

step_all() {
  step_build || return $?
  step_verify_tax || return $?
  hr
  say "▶ dist 준비 검사"
  assert_dist_ready "배포 직전" || return $?
  run_step "npm run deploy:pages (gh-pages 델타 미러)" npm run deploy:pages || return $?
  hr
  say "▶ 배포 후 dist 재확인"
  assert_dist_ready "배포 후" || return $?
}

cmd_status() {
  note_env
  hr
  say "▶ dist: HTML $(dist_html_count)개 · index.html $([ -f dist/index.html ] && echo 있음 || echo 없음)"
  if [ -d dist ]; then
    say "   dist 크기: $(du -sh dist 2>/dev/null | cut -f1)"
  fi
  local cap="/workspace/reports/buffetkimz-web/pipeline-v2/mobile-390.json"
  [ -f "$cap" ] || cap="reports/buffetkimz-web/pipeline-v2/mobile-390.json"
  if [ -f "$cap" ]; then
    local fails
    fails=$(python3 - "$cap" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    print(f"failures {len(d.get('failures') or [])}")
except Exception:
    print("읽기 실패")
PY
)
    say "▶ 390px 캡처 게이트: $cap ($(date -r "$cap" '+%Y-%m-%d %H:%M'), $fails)"
  else
    say "▶ 390px 캡처 게이트: 없음 — verify_pipeline_v2.py를 먼저 실행해야 합니다."
  fi
  if flock -n "$LOCK_FILE" true 2>/dev/null && { [ -z "$LOCK_EXTRA" ] || flock -n "$LOCK_EXTRA" true 2>/dev/null; }; then
    say "▶ 락: 지금 비어 있음"
  else
    say "▶ 락: 다른 빌드·배포가 잡고 있음 ($LOCK_FILE${LOCK_EXTRA:+, $LOCK_EXTRA})"
  fi
  return 0
}

if [ "$CMD" = "status" ]; then
  preflight
  cmd_status
  exit 0
fi

preflight
note_env

if [ "$DRY_RUN" -eq 1 ]; then
  say "▶ dry-run: 락을 잡지 않고 실행 계획만 출력합니다."
  case "$CMD" in
    build) step_build ;;
    build-pages) step_build_pages ;;
    verify) step_verify_tax; say "▶ dist 준비 검사"; assert_dist_ready "verify" ;;
    deploy) step_deploy ;;
    all) step_all ;;
    run) run_step "사용자 지정 명령" "${RUN_ARGS[@]}" ;;
    *) echo "알 수 없는 명령: $CMD" >&2; exit 2 ;;
  esac
  exit 0
fi

# ── 락(②) — 06:00/08:20/19:00/05:30 액션이 동시에 빌드하지 않도록 직렬화한다.
exec 9>"$LOCK_FILE"
if ! flock -w "$LOCK_WAIT" 9; then
  echo "✗ 빌드 락 획득 실패: ${LOCK_WAIT}초 대기 후에도 $LOCK_FILE 이 잡혀 있습니다." >&2
  echo "   다른 액션이 빌드·배포 중입니다. 이번 실행은 중단합니다(동시 빌드는 dist를 깨뜨립니다)." >&2
  exit 75
fi
say "▶ 락 획득: $LOCK_FILE (PID $$)"

if [ -n "$LOCK_EXTRA" ]; then
  mkdir -p "$(dirname "$LOCK_EXTRA")" 2>/dev/null || true
  exec 8>"$LOCK_EXTRA"
  if ! flock -w "$LOCK_WAIT" 8; then
    echo "✗ 작업공간 락 획득 실패: ${LOCK_WAIT}초 대기 후에도 $LOCK_EXTRA 이 잡혀 있습니다." >&2
    exit 75
  fi
  say "▶ 락 획득: $LOCK_EXTRA"
fi

set +e
case "$CMD" in
  build) step_build ;;
  build-pages) step_build_pages ;;
  verify)
    step_verify_tax
    hr
    say "▶ dist 준비 검사"
    assert_dist_ready "verify" ;;
  deploy) step_deploy ;;
  all) step_all ;;
  run)
    [ "${#RUN_ARGS[@]}" -gt 0 ] || { echo "run 뒤에 실행할 명령이 필요합니다." >&2; exit 2; }
    run_step "사용자 지정 명령" "${RUN_ARGS[@]}" ;;
  *) echo "알 수 없는 명령: $CMD" >&2; usage >&2; exit 2 ;;
esac
rc=$?
set -e
hr
if [ "$rc" -eq 0 ]; then
  say "■ $CMD 성공"
else
  say "■ $CMD 실패(exit $rc)"
fi
exit "$rc"
