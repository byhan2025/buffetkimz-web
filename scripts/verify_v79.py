#!/usr/bin/env python3
"""v7.9.0 브랜드 자산 검증 — 확정 공식 로고·파비콘·OG·색 기준.

  A. 자산 — public/brand 원본 3종 + 투명 크롭 3종(+webp 3폭) · 파비콘/앱아이콘 · OG
  B. HTML/CSS — 옛 서표 심볼(brand-lockup__symbol·M3.9 2H…) 0 · 캘리그라피 배너 0
  C. 색 — 브랜드 토큰이 로고 블루(#1a4ffd) · 옛 초록 토큰 0
  D. 파비콘 16px 실측 — 세 고리가 뭉개지지 않는지 알파 반경 프로파일로 잰다
  E. OG — 1200×630 · 라이트 로고 중심

사용: npm run build && python3 scripts/verify_v79.py
결과: reports/buffetkimz-web/v79-official-logo/verify-v79.json
"""
from __future__ import annotations

import json
import pathlib
import re

import numpy as np
from PIL import Image

APP = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = APP / "public"
DIST = APP / "dist"
OUT = pathlib.Path("/workspace/reports/buffetkimz-web/v79-official-logo")
OUT.mkdir(parents=True, exist_ok=True)

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": str(detail)})


def img_size(p: pathlib.Path) -> tuple[int, int] | None:
    try:
        with Image.open(p) as im:
            return im.size
    except Exception:  # noqa: BLE001
        return None


def radial_profile(img: Image.Image, cx: float, cy: float, rmax: float, step: float = 0.5) -> list[float]:
    """중심에서 바깥으로 알파 평균 — 고리(봉우리)와 간격(골)을 수치로 본다."""
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot(xx - cx, yy - cy)
    al = a[..., 3] / 255.0
    out = []
    for i in np.arange(step / 2, rmax, step):
        sel = (r >= i - step / 2) & (r < i + step / 2)
        out.append(float(al[sel].mean()) if sel.any() else 0.0)
    return out


def dips(profile: list[float], peaks_min: float = 0.4) -> list[float]:
    """봉우리 사이의 골 값 — 작을수록 고리 간격이 살아 있다."""
    res = []
    for i in range(1, len(profile) - 1):
        if profile[i] <= profile[i - 1] and profile[i] <= profile[i + 1]:
            res.append(round(profile[i], 2))
    return res


def main() -> None:
    # A. 자산 -----------------------------------------------------------------
    originals = ["logo-en-light.png", "logo-en-dark.png", "logo-ko-dark.png"]
    for f in originals:
        p = APP / "brand-source" / f
        size = img_size(p)
        check(f"A 원본 보존 brand-source/{f}", p.exists() and size == (7680, 4320), f"{size}")

    crops = {
        "logo-en-light-tr.png": (3342, 883),
        "logo-en-dark-tr.png": (3109, 803),
        "logo-ko-dark-tr.png": (3332, 921),
    }
    for f, exp in crops.items():
        p = PUBLIC / "brand" / f
        size = img_size(p)
        ok = p.exists() and abs(size[0] - exp[0]) <= 2 and abs(size[1] - exp[1]) <= 2
        check(f"A 투명 크롭 {f}", ok, f"{size} (기대 {exp})")
        if p.exists():
            arr = np.asarray(Image.open(p).convert("RGBA"))
            alpha = arr[..., 3]
            border = np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]])
            check(f"A 테두리 잘림 없음 {f}", int((border > 40).sum()) == 0, f"불투명 테두리 {int((border>40).sum())}px")
            # 흰 테두리(언프리멀티플리 오류) — 라이트본만 의미 있다
            if "light" in f:
                a = alpha / 255.0
                semi = (a > 0.15) & (a < 0.9)
                lum = arr[..., :3][semi].mean(axis=1)
                halo = int(((lum > 250) & (a[semi] < 0.35)).sum())
                check("A 흰 테두리 없음 (라이트)", halo == 0, f"{halo}px")
        for w in (480, 960, 1920):
            wp = PUBLIC / "brand" / f.replace("-tr.png", f"-tr-{w}.webp")
            check(f"A webp {w}w {f}", wp.exists() and wp.stat().st_size > 8000, f"{wp.stat().st_size if wp.exists() else 0}B")

    for f, exp in {"favicon-16.png": (16, 16), "favicon-32.png": (32, 32), "apple-touch-icon.png": (180, 180), "icon-512.png": (512, 512)}.items():
        size = img_size(PUBLIC / f)
        check(f"A 아이콘 {f}", size == exp, f"{size}")
    check("A favicon.svg", (PUBLIC / "favicon.svg").exists() and (PUBLIC / "favicon.svg").stat().st_size > 1000)
    check("A favicon-16.svg", (PUBLIC / "favicon-16.svg").exists())
    check("A og.png 1200×630", img_size(PUBLIC / "og.png") == (1200, 630), f"{img_size(PUBLIC / 'og.png')}")
    check("A og-default.png 1200×630", img_size(PUBLIC / "og-default.png") == (1200, 630))

    # B. 옛 브랜드 흔적 ---------------------------------------------------------
    pages = sorted(DIST.rglob("*.html"))
    old_symbol = []
    calligraphy = []
    for p in pages:
        s = p.read_text(encoding="utf-8", errors="ignore")
        if "brand-lockup__symbol" in s or "M3.9 2H13.9V22" in s:
            old_symbol.append(str(p.relative_to(DIST)))
        if "calligraphy" in s:
            calligraphy.append(str(p.relative_to(DIST)))
    check("B 옛 서표 심볼 0", not old_symbol, f"{len(old_symbol)}쪽 {old_symbol[:3]}")
    check("B 옛 캘리그라피 배너 0", not calligraphy, f"{len(calligraphy)}쪽 {calligraphy[:3]}")
    check("B 구 캘리그라피 파일 삭제", not list((PUBLIC / "brand").glob("*calligraphy*")), "")

    css = "".join(f.read_text(encoding="utf-8", errors="ignore") for f in (DIST / "_astro").glob("*.css"))
    check("B 옛 초록 브랜드 토큰 0", "--color-brand:#146c58" not in css)
    check("C 브랜드 = 로고 블루", "--color-brand:#1a4ffd" in css and "--color-brand-deep:#1233b8" in css)
    check("C 다크 액센트 = #93a9ff", "--color-brand-glow:#93a9ff" in css)
    check("C jade(의미색) 유지", "--color-jade:#1f7a62" in css)

    index = (DIST / "index.html").read_text(encoding="utf-8")
    check("B 홈 파비콘 링크", 'rel="icon"' in index and "favicon.svg" in index)
    check("B 홈 OG 이미지", "og.png" in index)
    about = (DIST / "about/index.html").read_text(encoding="utf-8")
    check("B 소개 국문 로고", "logo-ko-dark-tr" in about)
    logos_on_pages = len(re.findall(r"/brand/logo-en-light-tr", index))
    check("B 헤더·푸터 라이트 로고", logos_on_pages >= 2, f"{logos_on_pages}곳")

    # D. 16px 실측 ------------------------------------------------------------
    ic16 = Image.open(PUBLIC / "favicon-16.png")
    prof16 = radial_profile(ic16, 7.5, 7.5, 7.4)
    ic32 = Image.open(PUBLIC / "favicon-32.png")
    prof32 = radial_profile(ic32, 15.5, 15.5, 15.4)
    d16, d32 = dips(prof16), dips(prof32)
    peaks16 = sum(1 for v in prof16 if v >= 0.45)
    check(
        "D 16px 세 고리 분리",
        len([d for d in d16 if d <= 0.32]) >= 2,
        f"골 {d16} · 고리봉우리 {peaks16}",
    )
    check("D 32px 세 고리 분리", len([d for d in d32 if d <= 0.2]) >= 2, f"골 {d32}")
    check(
        "D 16px 알파 프로파일 기록",
        True,
        " ".join(f"{v:.2f}" for v in prof16),
    )

    ok = sum(1 for c in CHECKS if c["ok"])
    (OUT / "verify-v79.json").write_text(
        json.dumps({"checks": CHECKS, "passed": ok, "total": len(CHECKS), "profiles": {"16": prof16, "32": prof32}},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    for c in CHECKS:
        print(("PASS " if c["ok"] else "FAIL ") + c["name"] + (f"  [{c['detail']}]" if c["detail"] else ""))
    print(f"\n{ok}/{len(CHECKS)} 통과 → {OUT/'verify-v79.json'}")


if __name__ == "__main__":
    main()
