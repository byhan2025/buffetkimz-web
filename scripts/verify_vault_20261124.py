#!/usr/bin/env python3
"""전용 도구실(🔒) 검증 — 2026-11-24.

빌드된 `dist/`를 그대로 서빙해 확인한다.
  1) 잠금 전: 도구 이름·주소 평문 0, 버튼만 보임, 검색(/search/) 미노출
  2) 오답 비밀번호 거부 → 정답으로 3종 카드 렌더
  3) sessionStorage 유지(새로고침) · [잠그기] 즉시 재잠금
  4) 데스크톱 1440 · 모바일 390 가로 넘침 0, 콘솔 오류 0
  5) 스크린샷 → reports/buffetkimz-web/apps-vault-{locked,unlocked}.png

사용: python3 scripts/verify_vault_20261124.py
종료 코드: 0 통과 · 1 실패
"""
from __future__ import annotations

import functools
import http.server
import json
import os
import pathlib
import socketserver
import sys
import tempfile
import threading

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
DIST = APP / "dist"
SHOTS = pathlib.Path("/workspace/reports/buffetkimz-web")
WRONG = "not-the-password"


def load_password() -> str:
    """비밀번호는 저장소에 두지 않는다 — 환경변수 또는 .vault/pass.txt(둘 다 저장소 밖)."""
    env = os.environ.get("VAULT_PASS")
    if env:
        return env
    f = APP / ".vault" / "pass.txt"
    if f.exists():
        return f.read_text(encoding="utf-8").rstrip("\n")
    sys.exit("비밀번호가 없습니다: VAULT_PASS 환경변수 또는 apps/buffetkimz-web/.vault/pass.txt")


PASSWORD = load_password()

# (표기, 찾을 문자열) — 비밀번호는 값은 비교하되 이름으로만 보고한다(로그에 남기지 않는다).
FORBIDDEN = [
    ("keyword-portal.pages.dev", "keyword-portal.pages.dev"),
    ("bojang-counsel-guide", "bojang-counsel-guide"),
    ("비밀번호", PASSWORD),
    ("키워드랩", "키워드랩"),
    ("InsureCRM", "InsureCRM"),
    ("보장분석 상담 가이드", "보장분석 상담 가이드"),
]

results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    results.append((bool(ok), name, detail))
    print(f"  {'PASS' if ok else 'FAIL'} {name}" + (f"  [{detail}]" if detail else ""))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):  # noqa: D401 - 로그를 끈다
        pass


def serve() -> tuple[socketserver.TCPServer, int, str]:
    """dist 를 그대로 서빙한다. 배포용(서브패스) 빌드면 /buffetkimz-web/ 아래에 걸어 둔다."""
    html = (DIST / "apps" / "index.html").read_text(encoding="utf-8")
    prefix = "/buffetkimz-web" if '"/buffetkimz-web/' in html else ""
    root = DIST
    if prefix:
        root = pathlib.Path(tempfile.mkdtemp(prefix="vault-dist-"))
        (root / "buffetkimz-web").symlink_to(DIST, target_is_directory=True)
    handler = functools.partial(Quiet, directory=str(root))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port, prefix


def overflow(page) -> int:
    return page.evaluate("() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")


def main() -> int:
    httpd, port, prefix = serve()
    base = f"http://127.0.0.1:{port}{prefix}"
    print(f"▶ dist 서빙 {base}")

    # ── 0) 정적 검사: 빌드 결과에 평문 0건 ────────────────────────────────
    print("\n[0] 빌드 결과 평문 검사")
    leaked = {
        label: [str(q.relative_to(DIST)) for q in DIST.rglob("*") if q.is_file() and value.encode() in q.read_bytes()]
        for label, value in FORBIDDEN
    }
    for label, files in leaked.items():
        check(not files, f"dist 에 '{label}' 평문 0건", f"{len(files)}건 {files[:3]}" if files else "0건")
    check(not (DIST / "apps/bojang-counsel-guide").exists(), "/apps/bojang-counsel-guide 페이지 없음")
    check(not (DIST / "tools/bojang-counsel-guide").exists(), "/tools/bojang-counsel-guide 페이지 없음")
    sitemap = (DIST / "sitemap-0.xml").read_text(encoding="utf-8")
    rss = (DIST / "rss.xml").read_text(encoding="utf-8")
    check(not any(v in sitemap for _, v in FORBIDDEN), "사이트맵 평문 0건")
    check(not any(v in rss for _, v in FORBIDDEN), "RSS 평문 0건")
    check("apps/bojang-counsel-guide" not in sitemap, "사이트맵에 옛 주소 없음")

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])

        for label, width, height in (("desktop", 1440, 900), ("mobile", 390, 844)):
            print(f"\n[{label} {width}]")
            ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            page.goto(f"{base}/apps/", wait_until="networkidle")
            check(overflow(page) == 0, "잠금 전 가로 넘침 0", f"{overflow(page)}px")

            body = page.content()
            plain = [label for label, value in FORBIDDEN if value in body]
            check(not plain, "잠금 전 페이지 평문 0", f"{plain}" if plain else "0건")

            btn = page.locator("[data-vault-open]")
            check(btn.count() == 1 and btn.is_visible(), "전용 도구실 버튼 보임")
            check(page.locator("[data-vault-card]").count() == 0, "잠금 전 카드 0장")

            if label == "desktop":
                page.screenshot(path=str(SHOTS / "apps-vault-locked.png"), full_page=False)
                page.screenshot(path=str(SHOTS / "apps-vault-locked-full.png"), full_page=True)

            # 1) 모달 열기
            btn.click()
            page.wait_for_selector("[data-vault-dialog][open]", timeout=4000)
            check(page.locator("[data-vault-pass]").is_visible(), "비밀번호 입력칸 보임")
            check(overflow(page) == 0, "모달 열림 가로 넘침 0", f"{overflow(page)}px")
            check(
                page.locator("[data-vault-form]").inner_text().strip().count("워드랩") == 0,
                "잠긴 모달에 도구 이름 0",
            )
            if label == "desktop":
                page.screenshot(path=str(SHOTS / "apps-vault-password.png"), full_page=False)

            # 2) 오답 거부
            page.fill("[data-vault-pass]", WRONG)
            page.click("[data-vault-submit]")
            page.wait_for_selector("[data-vault-error]:not([hidden])", timeout=8000)
            err = page.locator("[data-vault-error]").inner_text()
            check("비밀번호가 맞지 않습니다" in err, "오답 비밀번호 거부", err.strip())
            check(page.locator("[data-vault-card]").count() == 0, "오답 뒤 카드 0장")
            storage = page.evaluate("() => sessionStorage.getItem('bk-vault-v1')")
            check(storage is None, "오답은 sessionStorage 에 남지 않음")

            # 3) 정답 → 카드 3장
            page.fill("[data-vault-pass]", PASSWORD)
            page.click("[data-vault-submit]")
            page.wait_for_selector(".vault-card", timeout=15000)
            cards = page.locator(".vault-card")
            check(cards.count() == 3, "도구 카드 3장 렌더", f"{cards.count()}장")
            names = [n.strip() for n in page.locator(".vault-card-name").all_inner_texts()]
            check(
                names == ["버핏킴즈 키워드랩", "보장분석 상담 가이드", "InsureCRM (고객관리)"],
                "카드 이름 정확",
                " / ".join(names),
            )
            hrefs = page.locator(".vault-card-open").evaluate_all("els => els.map(e => e.href)")
            want = [
                "https://keyword-portal.pages.dev/",
                "https://byhan2025.github.io/bojang-counsel-guide/",
                "https://drive.google.com/drive/folders/10e16XIRjbIMU6AZFMYzHMnf1I_6ZJ3oj",
            ]
            check(hrefs == want, "카드 링크 3개 일치", " / ".join(hrefs))
            check(
                page.locator(".vault-card-open").evaluate_all("els => els.every(e => e.target === '_blank' && e.rel.includes('noopener'))"),
                "링크는 새 창 + noopener",
            )
            check(overflow(page) == 0, "카드 렌더 뒤 가로 넘침 0", f"{overflow(page)}px")
            stored = page.evaluate("() => sessionStorage.getItem('bk-vault-v1')")
            check(bool(stored) and "keyword-portal" in (stored or ""), "sessionStorage 에만 열린 상태 유지")

            if label == "desktop":
                page.screenshot(path=str(SHOTS / "apps-vault-unlocked.png"), full_page=False)
                page.screenshot(path=str(SHOTS / "apps-vault-unlocked-full.png"), full_page=True)
            else:
                page.screenshot(path=str(SHOTS / "apps-vault-unlocked-390.png"), full_page=False)
                page.screenshot(path=str(SHOTS / "apps-vault-locked-390.png"), full_page=False)

            # 4) 새로고침 — 다시 묻지 않고 열린 상태 복원
            page.reload(wait_until="networkidle")
            check(page.locator("[data-vault-label]").inner_text().strip().endswith("열림"), "새로고침 뒤 열린 상태 유지")
            page.click("[data-vault-open]")
            page.wait_for_selector(".vault-card", timeout=4000)
            check(page.locator(".vault-card").count() == 3, "복원된 카드 3장")

            # 5) 잠그기 — DOM·sessionStorage 즉시 비움
            page.click("[data-vault-lock]")
            page.wait_for_timeout(200)
            check(page.locator(".vault-card").count() == 0, "잠그면 카드 DOM 0장")
            check(page.evaluate("() => sessionStorage.getItem('bk-vault-v1')") is None, "잠그면 sessionStorage 비움")
            body = page.content()
            plain = [label for label, value in FORBIDDEN if value in body]
            check(not plain, "잠근 뒤 페이지 평문 0", f"{plain}" if plain else "0건")

            # 6) 검색 페이지 — 도구 이름 미노출
            page.goto(f"{base}/search/", wait_until="networkidle")
            page.wait_for_timeout(400)
            html = page.content()
            plain = [t for t in ["키워드랩", "InsureCRM", "보장분석 상담 가이드"] if t in html]
            check(not plain, "검색 페이지 도구 이름 미노출", f"{plain}" if plain else "0건")
            # 배포 빌드는 서브패스에 걸리므로 현재 주소 기준 상대 경로로 받는다.
            idx = page.evaluate("async () => (await fetch(new URL('../search-index.json', location.href))).text()")
            hits = [t for t in ["키워드랩", "InsureCRM", "보장분석 상담 가이드", "bojang", "keyword-portal"] if t in idx]
            check(not hits, "search-index.json 미노출", f"{hits}" if hits else "0건")
            check(overflow(page) == 0, "검색 페이지 가로 넘침 0", f"{overflow(page)}px")

            # 7) 앱스토어 진열대 숫자·목록 정합
            page.goto(f"{base}/apps/", wait_until="networkidle")
            check(page.locator("[data-store-item='coverage-check']").count() == 1, "보장 점검 시뮬레이터(독자용)는 유지")
            check(page.locator("[data-store-item='trade-timemachine']").count() == 1, "타임머신은 유지")

            check(not errors, "콘솔·페이지 오류 0", f"{len(errors)}건 {errors[:3]}" if errors else "0건")
            ctx.close()

        browser.close()

    httpd.shutdown()

    ok = sum(1 for r in results if r[0])
    print(f"\n{ok}/{len(results)} 통과")
    report = SHOTS / "apps-vault-verify.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        json.dumps(
            [{"ok": r[0], "name": r[1], "detail": r[2]} for r in results],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"→ {report}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
