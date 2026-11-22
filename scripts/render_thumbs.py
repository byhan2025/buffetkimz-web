#!/usr/bin/env python3
"""
buffetkimz 에디토리얼 썸네일 렌더러 (v5.8)

배경 아트(`images` CLI로 만든 글자 없는 16:9 이미지) 위에 타이포그래피를 얹어
1200×630 WebP를 만든다. 문안은 `scripts/thumbs.json` 한 곳에서 관리한다.

    python3 scripts/render_thumbs.py                      # manifest 전체
    python3 scripts/render_thumbs.py --only silson-switch-2026
    python3 scripts/render_thumbs.py --board --keep-png   # 검수 보드 + 마스터 PNG

원칙
 · 얇은 1px 프레임 + 좌상단 buffetkimz / 우상단 날짜
 · 투톤 배지(분류 | 기준월) 15px
 · 하단 다크 스크림 위 두 색 볼드 헤드라인(최대 3줄, 줄당 12자 안팎) + 1줄 서브카피
 · 강조색은 지정한 한 줄에만.
 · 글자 영역의 배경 대비는 '스크림만 남긴 판'을 따로 렌더해 픽셀에서 실측한다(4.5:1 미만이면 경고).
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = pathlib.Path("/workspace/.tools/fonts/PretendardVariable.woff2")
MANIFEST = ROOT / "scripts" / "thumbs.json"
REPORT = pathlib.Path("/workspace/reports/buffetkimz-web/v58-upgrade")
MASTER_DIR = REPORT / "thumbnail-masters"

W, H = 1200, 630
NIGHT = "6,17,24"
# 이 작업 환경에는 헤드리스 셸용 시스템 라이브러리가 없어 전체 chromium 바이너리를 쓴다.
CHROME = os.environ.get(
    "PK_CHROME", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
)


def data_uri(path: pathlib.Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_face() -> str:
    if not FONT.exists():
        raise SystemExit(f"한글 폰트가 없습니다: {FONT}")
    b64 = base64.b64encode(FONT.read_bytes()).decode()
    return (
        "@font-face{font-family:'PK';src:url(data:font/woff2;base64,"
        + b64
        + ") format('woff2');font-weight:45 920;font-style:normal;}"
    )


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    )


def resolve(p: str) -> pathlib.Path:
    path = pathlib.Path(p)
    if path.is_absolute():
        return path
    if p.startswith("downloads/"):
        return ROOT.parent.parent / p
    return ROOT / p


def build_html(item: dict, bg_uri: str, text: bool = True) -> str:
    accent = item["accent"]
    lines = item.get("headline") or []
    accent_line = int(item.get("accentLine", len(lines) - 1))
    head = "".join(
        f'<span class="line{" accent" if i == accent_line else ""}">{esc(t)}</span>'
        for i, t in enumerate(lines[:3])
    )
    b1, b2 = item["badge"]
    dotted = item["date"]
    body = (
        f"""
    <div class="top"><span class="brand">buffetkimz</span><span class="date">{esc(dotted)}</span></div>
    <div class="rule"></div>
    <div class="bottom">
      <div class="badge"><span class="b1">{esc(b1)}</span><span class="b2">{esc(b2)}</span></div>
      <h1 class="head">{head}</h1>
      <p class="sub">{esc(item["sub"])}</p>
    </div>
    <div class="bar"><span>기준일 {esc(dotted)}</span><span class="site">buffetkimz.com</span></div>
"""
        if text
        else ""
    )
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
{font_face()}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#071019}}
.canvas{{position:relative;width:{W}px;height:{H}px;overflow:hidden;font-family:'PK','Noto Sans CJK KR',sans-serif;color:#fff;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.scrim{{position:absolute;inset:0;background:
  linear-gradient(180deg, rgba({NIGHT},.74) 0%, rgba({NIGHT},.46) 11%, rgba({NIGHT},.10) 26%, rgba({NIGHT},0) 36%, rgba({NIGHT},.52) 52%, rgba({NIGHT},.93) 76%, rgba({NIGHT},.97) 100%),
  linear-gradient(90deg, rgba({NIGHT},.60) 0%, rgba({NIGHT},.10) 40%, rgba({NIGHT},0) 62%)}}
.frame{{position:absolute;inset:16px;border:1px solid rgba(255,255,255,.34)}}
.top{{position:absolute;left:44px;right:44px;top:34px;display:flex;align-items:baseline;justify-content:space-between;z-index:3}}
.brand{{font-size:21px;font-weight:640;letter-spacing:.20em;color:#ffffff;text-shadow:0 1px 10px rgba(0,0,0,.5)}}
.date{{font-size:18px;font-weight:500;letter-spacing:.10em;color:rgba(255,255,255,.88);font-variant-numeric:tabular-nums;text-shadow:0 1px 8px rgba(0,0,0,.5)}}
.rule{{position:absolute;left:44px;right:44px;top:74px;height:1px;background:rgba(255,255,255,.28);z-index:3}}
.bottom{{position:absolute;left:44px;right:44px;bottom:62px;z-index:3}}
.badge{{display:inline-flex;align-items:stretch;height:34px;font-size:15px;font-weight:700;letter-spacing:.04em;line-height:1}}
.badge .b1{{display:flex;align-items:center;padding:0 13px;background:{accent};color:#10202b}}
.badge .b2{{display:flex;align-items:center;padding:0 13px;background:#0b1822;color:#ffffff;border:1px solid rgba(255,255,255,.34);border-left:0;font-variant-numeric:tabular-nums}}
.head{{margin-top:16px;display:flex;flex-direction:column;font-weight:800;font-size:64px;line-height:1.14;letter-spacing:-.035em;text-shadow:0 3px 22px rgba(0,0,0,.55)}}
.head .line{{display:block;white-space:nowrap;color:#ffffff}}
.head .line.accent{{color:{accent}}}
.sub{{margin-top:14px;font-size:24px;font-weight:500;letter-spacing:-.012em;color:#ffffff;opacity:.93;text-shadow:0 2px 14px rgba(0,0,0,.6)}}
.bar{{position:absolute;left:44px;right:44px;bottom:24px;display:flex;justify-content:space-between;align-items:baseline;font-size:14px;font-weight:500;letter-spacing:.10em;color:rgba(255,255,255,.80);z-index:3}}
.bar .site{{letter-spacing:.16em;color:rgba(255,255,255,.86)}}
</style></head><body><div class="canvas">
    <img class="bg" src="{bg_uri}">
    <div class="scrim"></div>
    <div class="frame"></div>{body}
  </div></body></html>"""


FIT_JS = """
() => {
  const head = document.querySelector('.head');
  if (!head) return [];
  const boxW = head.clientWidth;
  const out = [];
  for (const line of head.querySelectorAll('.line')) {
    let size = parseFloat(getComputedStyle(line).fontSize);
    let guard = 0;
    while (line.scrollWidth > boxW + 0.5 && size > 34 && guard < 80) {
      size -= 1;
      line.style.fontSize = size + 'px';
      guard += 1;
    }
    out.push({ text: line.textContent, size: Math.round(size), overflow: line.scrollWidth > boxW + 0.5 });
  }
  return out;
}
"""

BOXES_JS = """
() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { sel, x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const out = [pick('.brand'), pick('.date')];
  document.querySelectorAll('.head .line').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    out.push({ sel: 'line' + i, x: r.left, y: r.top, w: r.width, h: r.height,
               accent: el.classList.contains('accent') });
  });
  out.push(pick('.sub'));
  out.push(pick('.bar span:first-child'));
  out.push(pick('.bar .site'));
  return out.filter(Boolean);
}
"""


def srgb_lum(c: int) -> float:
    s = c / 255
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def rel_lum(rgb) -> float:
    r, g, b = rgb
    return 0.2126 * srgb_lum(r) + 0.7152 * srgb_lum(g) + 0.0722 * srgb_lum(b)


def contrast(a, b) -> float:
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def make_board(items: list[dict]) -> None:
    from PIL import Image

    REPORT.mkdir(parents=True, exist_ok=True)
    cols, cell_w, gap, pad, label_h = 4, 300, 18, 26, 34
    rows = (len(items) + cols - 1) // cols
    cell_h = int(round(cell_w * H / W))
    small_w = 120
    small_h = int(round(small_w * H / W))
    board_w = pad * 2 + cols * cell_w + (cols - 1) * gap
    board_h = pad * 2 + rows * (cell_h + label_h + gap) + 120
    board = Image.new("RGB", (board_w, board_h), (250, 249, 246))
    from PIL import ImageDraw

    d = ImageDraw.Draw(board)
    y = pad
    for i, item in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (cell_w + gap)
        y = pad + r * (cell_h + label_h + gap)
        try:
            im = Image.open(resolve(item["out"])).convert("RGB")
        except FileNotFoundError:
            continue
        board.paste(im.resize((cell_w, cell_h), Image.LANCZOS), (x, y))
        small = im.resize((small_w, small_h), Image.LANCZOS)
        board.paste(small, (x + cell_w - small_w, y + cell_h + 8))
        d.text((x, y + cell_h + 10), item["slug"], fill=(30, 40, 50))
    board.save(REPORT / "thumbnail-board.png")

    # 120px 축소본만 모은 판 — 카드에서 읽히는지 눈으로 보는 용도
    per_row, gap2 = 6, 16
    rows2 = (len(items) + per_row - 1) // per_row
    w2 = pad * 2 + per_row * small_w + (per_row - 1) * gap2
    h2 = pad * 2 + rows2 * (small_h + 26 + gap2)
    sheet = Image.new("RGB", (w2, h2), (250, 249, 246))
    for i, item in enumerate(items):
        r, c = divmod(i, per_row)
        x = pad + c * (small_w + gap2)
        y = pad + r * (small_h + 26 + gap2)
        try:
            im = Image.open(resolve(item["out"])).convert("RGB")
        except FileNotFoundError:
            continue
        sheet.paste(im.resize((small_w, small_h), Image.LANCZOS), (x, y))
        d.text((x, y + small_h + 6), item["slug"][:22], fill=(30, 40, 50))
    sheet.save(REPORT / "thumbnail-board-120px.png")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="이 slug만 렌더")
    ap.add_argument("--board", action="store_true", help="검수 보드 생성")
    ap.add_argument("--keep-png", action="store_true", help="@2x 마스터 PNG 보관")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    items = manifest["items"]
    if args.only:
        items = [i for i in items if i["slug"] in args.only]

    from playwright.sync_api import sync_playwright
    from PIL import Image

    # 2026-11-23 — 실행 환경에 chromium 공용 라이브러리가 빠져 죽는 일이 있어 경로를 합친다.
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from browser_env import ensure_browser_libs

    ensure_browser_libs()

    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME if pathlib.Path(CHROME).exists() else None,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
        for item in items:
            bg = resolve(item["art"])
            if not bg.exists():
                print(f"!! 배경 없음: {item['art']}", file=sys.stderr)
                continue
            uri = data_uri(bg)

            page.set_content(build_html(item, uri, text=True))
            page.evaluate("() => document.fonts.ready")
            fit = page.evaluate(FIT_JS)
            boxes = page.evaluate(BOXES_JS)
            png = page.screenshot(type="png")

            page.set_content(build_html(item, uri, text=False))
            page.evaluate("() => document.fonts.ready")
            flat = Image.open(io.BytesIO(page.screenshot(type="png"))).convert("RGB").resize((W, H), Image.LANCZOS)

            # 글자 영역 배경에서 가장 밝은 픽셀 기준 최악 대비
            checks = []
            for b in boxes:
                x0, y0 = max(0, int(b["x"])), max(0, int(b["y"]))
                x1, y1 = min(W, int(b["x"] + b["w"])), min(H, int(b["y"] + b["h"]))
                if x1 <= x0 or y1 <= y0:
                    continue
                region = flat.crop((x0, y0, x1, y1))
                px = list(region.getdata())
                worst = max(px, key=rel_lum)
                fg = hex_rgb(item["accent"]) if b.get("accent") else (255, 255, 255)
                checks.append({"el": b["sel"], "ratio": round(contrast(fg, worst), 2), "bg": worst})

            out = resolve(item["out"])
            out.parent.mkdir(parents=True, exist_ok=True)
            im = Image.open(io.BytesIO(png)).convert("RGB")
            hi = im.copy()
            im.resize((W, H), Image.LANCZOS).save(out, "WEBP", quality=90, method=6)
            if args.keep_png:
                hi.save(MASTER_DIR / f"{item['slug']}@2x.png")

            low = [c for c in checks if c["ratio"] < 4.5]
            results.append(
                {
                    "slug": item["slug"],
                    "out": item["out"],
                    "bytes": out.stat().st_size,
                    "lines": fit,
                    "minContrast": min((c["ratio"] for c in checks), default=None),
                    "contrastChecks": checks,
                    "belowAA": low,
                }
            )
            flag = "⚠" if low else "✓"
            print(
                f"{flag} {item['slug']:<34} {out.stat().st_size // 1024:>4}KB  "
                f"lines={[f['size'] for f in fit]}  minContrast={results[-1]['minContrast']}"
            )
            if low:
                print("   대비 미달:", [(c['el'], c['ratio']) for c in low], file=sys.stderr)
        browser.close()

    REPORT.mkdir(parents=True, exist_ok=True)
    (REPORT / "thumbnail-contrast-report.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2)
    )
    (ROOT / "scripts" / "thumbs.render-report.json").write_text(
        json.dumps([{k: r[k] for k in ("slug", "out", "bytes", "lines")} for r in results], ensure_ascii=False, indent=2)
    )
    if args.board:
        make_board(json.loads(MANIFEST.read_text())["items"])
        print("· board → reports/buffetkimz-web/v58-upgrade/thumbnail-board.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
