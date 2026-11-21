#!/usr/bin/env python3
"""v6.2 소개(/about) 실측 — 로컬 dist 기준 (1280 · 390).

브리프의 판정을 그대로 잰다.
  · HTTP 200 · 콘솔 오류 0 · 가로 넘침 0
  · 첫 화면: 한 줄 선언 + 짧은 소개 2줄 + 확인된 숫자 스트립(기록·도구·일정·가입 권유)
  · 숫자는 홈 크레딧(기록 14편·도구 8종·일정 51건)과 일치 — 페이지마다 다른 숫자를 쓰지 않는다
  · 증빙 없는 자격 표현(AFPK·1인·현장) 0건
  · 쓰는 방식 3장 + 다루지 않는 것 ✕ 칩 + 글↔도구 짝 3장(실제 글·도구 링크)
  · '도구 써 보기 · 원칙 보기' CTA · 모바일 고정 바 없음
  · 390: 캘리그라피 두 장이 한 줄(세로 길이 절감) · 터치 44px

사용: npm run build && python3 scripts/verify_v62.py
결과: reports/buffetkimz-web/v62-about/verify-v62.json (+ PNG)
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import threading

os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)
from playwright.sync_api import sync_playwright  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v62-about"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
PORT = 8152
LIVE = "https://byhan2025.github.io/buffetkimz-web"
MODE = "live" if "--live" in __import__("sys").argv else "local"
BASE = LIVE if MODE == "live" else f"http://127.0.0.1:{PORT}"

# 서브패스 빌드(dist가 /buffetkimz-web/… 를 가리켜도) 그대로 서빙
PREFIX = "/buffetkimz-web"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == PREFIX:
            p = "/"
        elif p.startswith(PREFIX + "/"):
            p = p[len(PREFIX):]
        return super().translate_path(p)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


OVERFLOW_JS = """() => {
  const vw = window.innerWidth;
  const wide = [];
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), over: Math.round(r.right - vw) });
    }
  }
  return { scroll: document.documentElement.scrollWidth, vw, overflow: Math.max(0, document.documentElement.scrollWidth - vw), wide: wide.slice(0, 5) };
}"""


def main() -> int:
    httpd = None if MODE == "live" else serve()
    checks: dict[str, dict] = {}
    errors: list[str] = []

    def add(name: str, ok: bool, detail="") -> None:
        checks[name] = {"ok": bool(ok), "detail": detail}
        if not ok:
            errors.append(name)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # 홈 크레딧 숫자 — 소개와 같은 값을 쓰는지 대조
        home = browser.new_page(viewport={"width": 1280, "height": 900})
        home.goto(f"{BASE}/", wait_until="domcontentloaded")
        home_credits = home.evaluate(
            """() => [...document.querySelectorAll('.film-credit-count')].map(e => e.textContent.trim())"""
        )
        home.close()
        expected = {}
        for text in home_credits:
            if "편" in text:
                expected["posts"] = int("".join(ch for ch in text if ch.isdigit()))
            elif "종" in text:
                expected["tools"] = int("".join(ch for ch in text if ch.isdigit()))
            elif "건" in text:
                expected["calendar"] = int("".join(ch for ch in text if ch.isdigit()))
        add("홈 크레딧 숫자 확보", len(expected) >= 3, str(expected))

        for label, vp in (("1280", {"width": 1280, "height": 900}), ("390", {"width": 390, "height": 844})):
            page = browser.new_page(viewport=vp, locale="ko-KR")
            console: list[str] = []
            page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console.append(str(e)))
            resp = page.goto(f"{BASE}/about/", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1600)
            add(f"{label} HTTP 200", resp is not None and resp.status == 200, str(resp.status if resp else None))
            add(f"{label} 콘솔 오류 0", not console, str(console[:2]))

            over = page.evaluate(OVERFLOW_JS)
            add(f"{label} 가로 넘침 0", over["overflow"] == 0, str(over))

            h1 = page.evaluate("() => document.querySelector('h1')?.innerText.trim() ?? ''")
            add(f"{label} 한 줄 선언", h1 == "가입을 권하지 않습니다.", h1)

            lede = page.evaluate(
                "() => [...document.querySelectorAll('.about-hero-lede span')].map(e => e.innerText.trim())"
            )
            add(f"{label} 소개 2줄", len(lede) == 2 and all(lede), str(lede))

            strip = page.evaluate(
                """() => {
                  const items = [...document.querySelectorAll('[data-about-stats] li')];
                  return items.map(li => ({
                    label: li.querySelector('.about-strip-label')?.textContent.trim(),
                    value: li.querySelector('b')?.textContent.trim(),
                    unit: li.querySelector('.about-strip-value span')?.textContent.trim(),
                  }));
                }"""
            )
            add(f"{label} 숫자 스트립 4칸", len(strip) == 4, json.dumps(strip, ensure_ascii=False))
            if len(strip) == 4:
                labels = [s["label"] for s in strip]
                add(f"{label} 스트립 라벨", labels == ["기록", "도구", "일정", "가입 권유"], str(labels))
                got = {s["label"]: s["value"] for s in strip}
                ok_nums = (
                    got.get("기록") == str(expected.get("posts"))
                    and got.get("도구") == str(expected.get("tools"))
                    and got.get("일정") == str(expected.get("calendar"))
                    and got.get("가입 권유") == "0"
                )
                add(f"{label} 스트립 숫자 = 홈 크레딧", ok_nums, f"{got} vs {expected}")

            text = page.evaluate("() => document.body.innerText")
            banned = [w for w in ("AFPK", "1인 ", "현장", "전문가입니다") if w in text]
            add(f"{label} 증빙 없는 자격 표현 0", not banned, str(banned))

            methods = page.evaluate("() => document.querySelectorAll('.about-method').length")
            add(f"{label} 쓰는 방식 3장", methods == 3, str(methods))
            chips = page.evaluate(
                "() => [...document.querySelectorAll('.about-dont-chips li')].map(e => e.innerText.replace(/✕/g,'').trim())"
            )
            add(f"{label} 다루지 않는 것 ✕ 칩", len(chips) >= 3, str(chips))

            pairs = page.evaluate(
                """() => [...document.querySelectorAll('.about-pair')].map(c => ({
                  post: c.querySelector('.about-pair-post a')?.getAttribute('href') ?? '',
                  tool: c.querySelector('.about-pair-actions a')?.getAttribute('href') ?? '',
                  title: c.querySelector('.about-pair-post')?.innerText.trim() ?? '',
                }))"""
            )
            ok_pairs = len(pairs) == 3 and all("/posts/" in x["post"] and "/apps/" in x["tool"] for x in pairs)
            add(f"{label} 글↔도구 짝 3장", ok_pairs, json.dumps(pairs, ensure_ascii=False)[:220])

            cta = page.evaluate(
                "() => [...document.querySelectorAll('.about-cta-actions .btn')].map(e => e.innerText.trim())"
            )
            add(f"{label} CTA 도구·원칙", cta == ["도구 써 보기", "원칙 보기"], str(cta))

            fixed = page.evaluate(
                """() => [...document.querySelectorAll('main *')].filter(el => {
                  const s = getComputedStyle(el);
                  return s.position === 'fixed' && el.getBoundingClientRect().height > 0;
                }).map(el => String(el.className).slice(0, 30))"""
            )
            add(f"{label} 모바일 고정 바 없음", not [f for f in fixed if "sticky" not in f], str(fixed[:3]))

            if label == "390":
                row = page.evaluate(
                    """() => {
                      const a = document.querySelector('.about-sign-ko img').getBoundingClientRect();
                      const b = document.querySelector('.about-sign-en img').getBoundingClientRect();
                      return { topA: Math.round(a.top), topB: Math.round(b.top), sameRow: Math.abs(a.top - b.top) < 40 && Math.abs(a.left - b.left) > 10 };
                    }"""
                )
                add("390 캘리그라피 한 줄", row["sameRow"], str(row))

            # 캡처
            page.evaluate("() => window.scrollTo(0,0)")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"verify-{MODE}-about-{label}.png"))
            page.screenshot(path=str(OUT / f"verify-{MODE}-about-{label}-full.png"), full_page=True)
            page.close()

        browser.close()
    if httpd:
        httpd.shutdown()

    result = {
        "ok": not errors,
        "passed": sum(1 for c in checks.values() if c["ok"]),
        "total": len(checks),
        "failed": {k: v for k, v in checks.items() if not v["ok"]},
        "checks": checks,
    }
    (OUT / f"verify-v62-{MODE}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{MODE}] {result['passed']}/{result['total']} checks passed")
    for k, v in result["failed"].items():
        print(f"FAIL  {k} — {v['detail']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
