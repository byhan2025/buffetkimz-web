#!/usr/bin/env python3
"""
v7.9.0 — 확정 공식 로고 3종(8K 원본)에서 사이트용 자산을 만든다.

  1) 원본 그대로 복사  : brand-source/logo-en-light.png / logo-en-dark.png / logo-ko-dark.png
     (8K 원본 30MB는 gh-pages 푸시 한도를 넘겨 배포에서 제외한다 — 저장소에는 그대로 보존)
  2) 투명 배경 크롭 PNG: public/brand/logo-*-tr.png (+ -480 / -960 / -1920 webp)
  3) 동심원 심볼 벡터  : public/favicon.svg, public/favicon-16.svg

투명화 원리 — 배경이 단색(크림 / 딥네이비)이므로 합성식을 되돌린다.
  px = bg*(1-a) + fg*a  →  a = (px-bg)·(fg-bg)/|fg-bg|²,  fg = bg + (px-bg)/a
색 팔레트(로고의 실제 색)만 알고 있으면 안티앨리어싱 경계까지 원래 색이 그대로 복원되고,
가장자리에 흰 테두리(언프리멀티플리 오류)나 잘림이 생기지 않는다.

8K 원본은 한 번에 float 배열로 올리면 메모리가 부족하므로,
작업 해상도(긴 변 3840px)로 줄인 뒤 가로 띠 단위로 처리한다.

실행: python3 scripts/make_brand_assets.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[1]
SRC_DIR = WORKSPACE / "attachments/2026-11-22"
OUT = ROOT / "public" / "brand"
ORIG = ROOT / "brand-source"  # 8K 원본 — 저장소에 보존하고 배포(dist)에서는 뺀다
TMP = ROOT / "tmp/brand-assets"

SOURCES = {
    "logo-en-light": SRC_DIR / "buffetkimz-english-light-8k-2e9d306127904e47bb605a2bc2c9bcb9.png",
    "logo-en-dark": SRC_DIR / "buffetkimz-english-dark-8k-976fe483c17941a999c8853cd662b6da.png",
    "logo-ko-dark": SRC_DIR / "buffetkimz-korean-dark-8k-c1fa9e629c07400caf72ae0c071e2bde.png",
}

# 로고가 실제로 쓰는 색 (8K 원본 픽셀 히스토그램에서 확인)
PALETTE = {
    "logo-en-light": [(0, 22, 62), (26, 79, 253)],
    "logo-en-dark": [(248, 248, 248), (32, 80, 250), (168, 184, 245)],
    "logo-ko-dark": [(248, 248, 248), (32, 80, 250), (168, 184, 245)],
}
BG = {
    "logo-en-light": (244, 240, 236),
    "logo-en-dark": (9, 20, 44),
    "logo-ko-dark": (11, 22, 44),
}
WORK_LONG = 3840  # 작업 해상도(긴 변)
TR_FLOOR = 0.055  # 이보다 옅은 잔여 안개는 투명으로 — 배경 압축 잡음 제거
CROP_PAD = 0.004  # 크롭 여백(긴 변 대비)


def load_work(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    scale = WORK_LONG / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return np.asarray(im)


def unpremultiply(rgb: np.ndarray, bg: tuple[int, int, int], palette, floor: float = TR_FLOOR):
    """단색 배경 위 합성 이미지 → (알파, 복원 색). 가로 띠 단위 처리."""
    h, w = rgb.shape[:2]
    alpha = np.zeros((h, w), np.float32)
    color = np.zeros((h, w, 3), np.uint8)
    bgv = np.array(bg, np.float32)
    fgvs = [np.array(c, np.float32) for c in palette]
    axis = [f - bgv for f in fgvs]
    denom = [float((a * a).sum()) for a in axis]

    step = 256
    for y0 in range(0, h, step):
        y1 = min(h, y0 + step)
        block = rgb[y0:y1].astype(np.float32)
        diff = block - bgv
        best_a = np.zeros(block.shape[:2], np.float32)
        best_res = np.full(block.shape[:2], np.inf, np.float32)
        for a_axis, den in zip(axis, denom):
            if den < 1e-6:
                continue
            proj = np.clip((diff * a_axis).sum(axis=2) / den, 0.0, 1.0)
            modeled = bgv + proj[..., None] * a_axis
            res = ((block - modeled) ** 2).sum(axis=2)
            better = res < best_res
            best_res = np.where(better, res, best_res)
            best_a = np.where(better, proj, best_a)
        a = np.clip((best_a - floor) / (1.0 - floor), 0.0, 1.0)
        safe = np.maximum(a, 1e-3)[..., None]
        fg = np.clip(bgv + diff / safe, 0, 255)
        alpha[y0:y1] = a
        color[y0:y1] = fg.astype(np.uint8)
        del block, diff, best_a, best_res, a, fg
    return alpha, color


def to_cropped_rgba(rgb: np.ndarray, bg, palette) -> tuple[Image.Image, dict]:
    a, fg = unpremultiply(rgb, bg, palette)
    rgba = np.dstack([fg, (a * 255.0).round()]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    bbox = img.getbbox()
    if bbox is None:
        raise SystemExit("투명화 결과가 비었습니다")
    x0, y0, x1, y1 = bbox
    pad = max(4, int(max(x1 - x0, y1 - y0) * CROP_PAD))
    box = (max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad))
    return img.crop(box), {"bbox": list(bbox), "crop_box": list(box)}


def resize_rgba(img: Image.Image, width: int) -> Image.Image:
    """프리멀티플라이드 공간에서 축소 — 가장자리 어두운 테두리 방지."""
    if width >= img.width:
        return img.copy()
    h = max(1, round(img.height * width / img.width))
    arr = np.asarray(img)
    a = arr[..., 3].astype(np.float32) / 255.0
    pm = np.dstack([arr[..., :3].astype(np.float32) * a[..., None], a[..., None] * 255.0])
    small = Image.fromarray(pm.round().astype(np.uint8), "RGBA").resize((width, h), Image.LANCZOS)
    out = np.asarray(small).astype(np.float32)
    aa = out[..., 3:4] / 255.0
    rgb = np.where(aa > 1e-4, out[..., :3] / np.maximum(aa, 1e-4), 255.0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), out[..., 3:4]]).round().astype(np.uint8), "RGBA")


def check_edges(img: Image.Image) -> dict:
    """가장자리 검수 — 잘림(테두리에 불투명 픽셀)·흰 테두리(투명 근처 흰색) 확인."""
    arr = np.asarray(img).astype(np.float32)
    alpha = arr[..., 3]
    border = np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]])
    solid_border = int((border > 40).sum())
    a = alpha / 255.0
    semi = (a > 0.15) & (a < 0.9)
    white_halo = 0
    if semi.any():
        lum = arr[..., :3][semi].mean(axis=1)
        white_halo = int(((lum > 250) & (a[semi] < 0.35)).sum())
    return {
        "size": list(img.size),
        "opaque_border_px": solid_border,
        "white_halo_px": white_halo,
        "transparent_ratio": round(float((a < 0.05).mean()), 4),
        "min_edge_alpha": int(border.min()),
    }


# ----------------------------------------------------------------------------
# 동심원 심볼 벡터화 — 라이트 로고의 심볼을 작업 해상도에서 윤곽 추적
# ----------------------------------------------------------------------------
SYMBOL_VIEWBOX = 1000
NAVY = "#0a1a3c"
BLUE = "#1f4ffd"
PAPER = "#f5f7ff"
BLUE_DARK = "#7c9bff"


def trace_symbol(light: np.ndarray) -> dict:
    import cv2

    a, fg = unpremultiply(light, BG["logo-en-light"], PALETTE["logo-en-light"], floor=0.02)
    solid = a > 0.5
    cols = np.where(solid.any(axis=0))[0]
    gaps = np.where(np.diff(cols) > 12)[0]
    sym_x1 = int(cols[gaps[0]]) if len(gaps) else int(cols.max())
    sym = solid[:, : sym_x1 + 1]
    ys, xs = np.where(sym)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = side / 2 * 1.03

    navy_ref = np.array(PALETTE["logo-en-light"][0], np.float32)
    blue_ref = np.array(PALETTE["logo-en-light"][1], np.float32)
    d_navy = np.linalg.norm(fg.astype(np.float32) - navy_ref, axis=2)
    d_blue = np.linalg.norm(fg.astype(np.float32) - blue_ref, axis=2)
    # 심볼 상자 밖(워드마크)은 버린다 — 벡터에는 동심원만 남긴다
    region = np.zeros_like(solid)
    region[y0 : y1 + 1, x0 : x1 + 1] = True
    navy_mask = solid & region & (d_navy <= d_blue)
    blue_mask = solid & region & (d_blue < d_navy)

    def path_of(mask: np.ndarray, min_area: float) -> str:
        m = (mask.astype(np.uint8) * 255)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        contours, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        parts = []
        for cnt in contours:
            if cv2.contourArea(cnt) < min_area:
                continue
            pts = cv2.approxPolyDP(cnt, 0.8, True).reshape(-1, 2).astype(np.float64)
            X = (pts[:, 0] - cx) / half * (SYMBOL_VIEWBOX / 2) + SYMBOL_VIEWBOX / 2
            Y = (pts[:, 1] - cy) / half * (SYMBOL_VIEWBOX / 2) + SYMBOL_VIEWBOX / 2
            d = f"M{X[0]:.1f} {Y[0]:.1f}"
            for x, y in zip(X[1:], Y[1:]):
                d += f"L{x:.1f} {y:.1f}"
            parts.append(d + "Z")
        return "".join(parts)

    return {
        "navy": path_of(navy_mask, 300),
        "blue": path_of(blue_mask, 300),
        "bbox": [x0, y0, x1, y1],
        "work_size": [int(light.shape[1]), int(light.shape[0])],
    }


def favicon_svg(navy_path: str, blue_path: str, navy: str, blue: str, navy_dark: str, blue_dark: str, size: int | None = None) -> str:
    vb = f"0 0 {SYMBOL_VIEWBOX} {SYMBOL_VIEWBOX}"
    attr = f' width="{size}" height="{size}"' if size else ""
    # 기본색은 presentation attribute로 두고, 다크 모드만 CSS로 덮는다.
    # (CSS를 못 읽는 렌더러에서도 기본색으로 그려진다 — 파비콘 PNG 생성용)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{attr}>\n'
        "  <style>\n"
        "    @media (prefers-color-scheme: dark) {\n"
        f"      .bk-ring {{ fill: {navy_dark}; }}\n"
        f"      .bk-arc {{ fill: {blue_dark}; }}\n"
        "    }\n"
        "  </style>\n"
        f'  <path class="bk-ring" fill="{navy}" fill-rule="evenodd" d="{navy_path}"/>\n'
        f'  <path class="bk-arc" fill="{blue}" fill-rule="evenodd" d="{blue_path}"/>\n'
        "</svg>\n"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ORIG.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    report: dict = {}

    for name, src in SOURCES.items():
        if not src.exists():
            raise SystemExit(f"원본 없음: {src}")
        shutil.copy2(src, ORIG / f"{name}.png")  # 원본 절대 보존(배포 제외 폴더)
        work = load_work(src)
        cropped, info = to_cropped_rgba(work, BG[name], PALETTE[name])
        cropped.save(OUT / f"{name}-tr.png", optimize=True)
        report[name] = {"crop": info, "tr_size": list(cropped.size), "edge_check": check_edges(cropped)}
        for w in (480, 960, 1920):
            resize_rgba(cropped, w).save(OUT / f"{name}-tr-{w}.webp", "WEBP", quality=92, method=6)
        del work

    light = load_work(SOURCES["logo-en-light"])
    sym = trace_symbol(light)
    (ROOT / "public/favicon.svg").write_text(
        favicon_svg(sym["navy"], sym["blue"], NAVY, BLUE, PAPER, BLUE_DARK), encoding="utf-8"
    )
    (ROOT / "public/favicon-16.svg").write_text(
        favicon_svg(sym["navy"], sym["blue"], NAVY, BLUE, PAPER, BLUE_DARK, size=16), encoding="utf-8"
    )
    (TMP / "favicon-paths.json").write_text(json.dumps(sym, ensure_ascii=False, indent=1), encoding="utf-8")
    report["symbol"] = {k: (len(v) if isinstance(v, str) else v) for k, v in sym.items()}

    (TMP / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
