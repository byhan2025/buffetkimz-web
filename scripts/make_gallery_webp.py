#!/usr/bin/env python3
"""자료앨범 카드 PNG → WebP 경량화 (v8.9.0, 감사 보고 I6).

왜 필요한가
  · 2026-11-23 기준 `public/gallery/*.png` 114장이 63MB(장당 평균 555KB, 최대 1.4MB)로
    `dist/` 88MB의 72%를 차지했다. GitHub Pages 푸시 한도(80MB 경고)에 붙어 있었다.
  · 카드는 1080×1350 고정이고 대부분 3D 클레이 일러스트 + 큰 글씨라, 같은 해상도에서
    WebP q84면 글씨가 뭉개지지 않으면서 장당 26~133KB로 줄어든다(육안 1:1 대조 확인).

무엇을 만드나
  public/gallery/<이름>.webp          1080×1350 · q84 — 카드 원본 크기(스토리·라이트박스)
  public/gallery/thumbs/<이름>.webp    480×600  · q80 — 표지 그리드·뷰어 썸네일
  assets/gallery-png/<이름>.png               — 원본은 배포 밖으로 옮겨 보존한다(재출력용).

사용
  python3 scripts/make_gallery_webp.py             # 변환 + PNG를 assets/로 이동
  python3 scripts/make_gallery_webp.py --keep-png  # 변환만(원본을 public에 그대로 둠)
  python3 scripts/make_gallery_webp.py --quality 86 --width 1080

주의
  · 이미 .webp가 있으면 원본 PNG보다 새로울 때만 다시 만든다(--force로 강제).
  · PNG를 public에서 지우므로, 이 스크립트를 돌린 뒤에는 `gallery.ts`·`academy-*.ts`의
    `src`가 `.webp`인지 반드시 확인한다(빌드 시 `availableSlides`가 파일 존재로 거른다).
"""
from __future__ import annotations

import argparse
import pathlib
import shutil
import sys

from PIL import Image

APP = pathlib.Path(__file__).resolve().parent.parent
GALLERY = APP / "public" / "gallery"
THUMBS = GALLERY / "thumbs"
ARCHIVE = APP / "assets" / "gallery-png"
W, H = 1080, 1350
TW, TH = 480, 600


def convert(src: pathlib.Path, quality: int, width: int, force: bool) -> tuple[int, int]:
    dst = src.with_suffix(".webp")
    height = round(width * H / W)
    if dst.exists() and not force and dst.stat().st_mtime >= src.stat().st_mtime:
        return 0, 0
    im = Image.open(src).convert("RGB")
    if im.size != (width, height):
        im = im.resize((width, height), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)
    thumb = im.resize((round(width * TW / W), round(width * TH / W)), Image.LANCZOS)
    thumb_path = THUMBS / dst.name
    thumb.save(thumb_path, "WEBP", quality=80, method=6)
    return dst.stat().st_size, thumb_path.stat().st_size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=int, default=84, help="카드 WebP 품질(기본 84)")
    ap.add_argument("--width", type=int, default=W, help="카드 폭(기본 1080)")
    ap.add_argument("--keep-png", action="store_true", help="원본 PNG를 public에 남긴다")
    ap.add_argument("--force", action="store_true", help="이미 있어도 다시 만든다")
    args = ap.parse_args()

    THUMBS.mkdir(parents=True, exist_ok=True)
    if not args.keep_png:
        ARCHIVE.mkdir(parents=True, exist_ok=True)

    sources = sorted(GALLERY.glob("*.png"))
    if not sources:
        print("변환할 PNG가 없습니다(이미 .webp만 있음).")
        return 0

    before = sum(p.stat().st_size for p in sources)
    full = thumb = moved = 0
    for src in sources:
        a, b = convert(src, args.quality, args.width, args.force)
        full += a
        thumb += b
        if not args.keep_png:
            shutil.move(str(src), str(ARCHIVE / src.name))
            moved += 1

    full_total = sum(p.stat().st_size for p in GALLERY.glob("*.webp"))
    thumb_total = sum(p.stat().st_size for p in THUMBS.glob("*.webp"))
    print(f"카드 {len(sources)}장 · 원본 PNG {before / 1048576:.1f}MB ({before / len(sources) / 1024:.0f}KB/장)")
    print(f"  → .webp {len(list(GALLERY.glob('*.webp')))}장 {full_total / 1048576:.1f}MB (q{args.quality}, {args.width}px)")
    print(f"  → 썸네일 {len(list(THUMBS.glob('*.webp')))}장 {thumb_total / 1048576:.1f}MB ({TW}px)")
    if moved:
        print(f"  → 원본 PNG {moved}장을 {ARCHIVE.relative_to(APP)}/ 로 옮겼습니다(배포 밖).")
    ratio = before / max(full_total, 1)
    print(f"  → 카드 용량 {ratio:.1f}배 감소")
    return 0


if __name__ == "__main__":
    sys.exit(main())
