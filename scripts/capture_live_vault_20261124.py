#!/usr/bin/env python3
"""전용 도구실 라이브 검증 — 2026-11-24 배포 뒤 실주소 확인.

대상: https://byhan2025.github.io/buffetkimz-web/apps/
  1) 잠금 전: 버튼만 보이고 도구 이름·주소 평문 0 — 내려받은 HTML·search-index·사이트맵까지
  2) 오답 거부 → 정해진 비밀번호(.vault/pass.txt 또는 VAULT_PASS)로 3종 복호화·렌더
  3) 1440·390 가로 넘침 0, 콘솔 오류 0
  4) 옛 주소 /apps/bojang-counsel-guide 404
  5) 스크린샷 reports/buffetkimz-web/apps-vault-{locked,unlocked}.png (+390 판)

사용: python3 scripts/capture_live_vault_20261124.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "https://byhan2025.github.io/buffetkimz-web"
SHOTS = pathlib.Path("/workspace/reports/buffetkimz-web")
WRONG = "vault-wrong-pass"

APP = pathlib.Path(__file__).resolve().parent.parent


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


def text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def overflow(page) -> int:
    return page.evaluate("() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")


def main() -> int:
    print("[0] 내려받은 문서 검사")
    for path in ("/apps/", "/search-index.json", "/rss.xml", "/sitemap-0.xml"):
        body = text(BASE + path)
        hits = [label for label, value in FORBIDDEN if value in body]
        check(not hits, f"라이브 {path} 평문 0건", f"{hits}" if hits else "0건")

    req = urllib.request.Request(BASE + "/apps/bojang-counsel-guide", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    check(code == 404, "옛 주소 /apps/bojang-counsel-guide = 404", str(code))

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        for label, width, height in (("desktop", 1440, 900), ("mobile", 390, 844)):
            print(f"\n[{label} {width}] 라이브")
            ctx = browser.new_context(viewport={"width": width, "height": height})
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            page.goto(f"{BASE}/apps/", wait_until="networkidle")
            check(overflow(page) == 0, "잠금 전 가로 넘침 0", f"{overflow(page)}px")
            check(not [label for label, value in FORBIDDEN if value in page.content()], "잠금 전 DOM 평문 0")
            check(page.locator("[data-vault-card]").count() == 0, "잠금 전 카드 0장")
            if label == "desktop":
                page.screenshot(path=str(SHOTS / "apps-vault-locked.png"))
            else:
                page.screenshot(path=str(SHOTS / "apps-vault-locked-390.png"))

            page.click("[data-vault-open]")
            page.wait_for_selector("[data-vault-dialog][open]", timeout=6000)
            check(overflow(page) == 0, "모달 가로 넘침 0", f"{overflow(page)}px")

            page.fill("[data-vault-pass]", WRONG)
            page.click("[data-vault-submit]")
            page.wait_for_selector("[data-vault-error]:not([hidden])", timeout=10000)
            check("비밀번호가 맞지 않습니다" in page.locator("[data-vault-error]").inner_text(), "오답 거부")

            page.fill("[data-vault-pass]", PASSWORD)
            page.click("[data-vault-submit]")
            page.wait_for_selector(".vault-card", timeout=20000)
            names = [n.strip() for n in page.locator(".vault-card-name").all_inner_texts()]
            check(len(names) == 3, "도구 3종 복호화", " / ".join(names))
            hrefs = page.locator(".vault-card-open").evaluate_all("els => els.map(e => e.href)")
            check("keyword-portal.pages.dev" in hrefs[0] and "bojang-counsel-guide" in hrefs[1] and "drive.google.com" in hrefs[2], "카드 링크 정상", " / ".join(hrefs))
            check(overflow(page) == 0, "카드 렌더 가로 넘침 0", f"{overflow(page)}px")

            if label == "desktop":
                page.screenshot(path=str(SHOTS / "apps-vault-unlocked.png"))
            else:
                page.screenshot(path=str(SHOTS / "apps-vault-unlocked-390.png"))

            page.click("[data-vault-lock]")
            page.wait_for_timeout(300)
            check(page.locator(".vault-card").count() == 0, "잠그기 즉시 재잠금")
            check(not [label for label, value in FORBIDDEN if value in page.content()], "잠근 뒤 DOM 평문 0")
            check(not errors, "콘솔·페이지 오류 0", f"{len(errors)}건 {errors[:3]}" if errors else "0건")
            ctx.close()
        browser.close()

    ok = sum(1 for r in results if r[0])
    print(f"\n{ok}/{len(results)} 통과")
    (SHOTS / "apps-vault-live.json").write_text(
        json.dumps([{"ok": r[0], "name": r[1], "detail": r[2]} for r in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
