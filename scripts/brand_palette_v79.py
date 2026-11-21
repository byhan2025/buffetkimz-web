#!/usr/bin/env python3
"""
v7.9.0 — 사이트 액센트를 확정 로고의 블루/네이비 계열로 통일한다(2026-11-22 사용자 확정).

초록(임시 마크 '서표' 시절의 액센트)만 골라 로고 블루 계열로 바꾼다.
도구 화면의 jade(양호·검증 의미색)와 금색·점토색 같은 의미색은 건드리지 않는다.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 순서가 중요하다 — 먼저 구체적인 것부터
CSS_HEX = {
    # 브랜드 토큰
    "#146c58": "#1a4ffd",
    "#0e5344": "#1233b8",
    "#e7f2ee": "#eef1ff",
    # 브랜드 그라디언트(구 초록 2색 조합)
    "#15745e": "#2a5bff",
    "#0c4a3d": "#0f2a9e",
    # 다크 바탕 위 밝은 액센트(옛 민트)
    "#7fe3c4": "#93a9ff",
    "#7fd7bd": "#a3b8ff",
    "#a3b8ff": "#a3b8ff",
    "#a9f0dd": "#c7d4ff",
    "#b9f5e0": "#cdd9ff",
    "#8ce8cd": "#b7c6ff",
    "#86e0c4": "#c2cfff",
    "#5fe0bd": "#8ea7ff",
    "#a7f3d8": "#c4d2ff",
    "#a9e6d3": "#c6d4ff",
    "#58c3a4": "#6f8dff",
    "#38b795": "#1a4ffd",
    # 어두운 초록 바탕 → 딥네이비
    "#04101a": "#050c1a",
    "#05141f": "#06101f",
    "#020a12": "#03060f",
    "#0a4236": "#132a6b",
    "#06231d": "#0b1b48",
    "#17755d": "#1c4bd8",
    "#0d4a3f": "#1233b8",
    "#062721": "#071130",
    "#071a17": "#071227",
    "#081d1f": "#081428",
    "#0a1f24": "#0a1730",
    "#07181d": "#071326",
    "#06161b": "#061221",
    "#0a2622": "#0a1c3a",
    "#082621": "#081d3c",
    "#06181c": "#06122a",
    "#0a2531": "#0a1b3a",
    "#0a2230": "#0a1934",
    "#071621": "#071129",
    "#071a20": "#071329",
    "#05161a": "#050f22",
    "#061a18": "#061026",
    # 어두운 바탕 위 종이색 글자(초록기 도는 흰색)
    "#eaf4f1": "#eef2ff",
    "#f6f8f7": "#f7f8fb",
}

# jade(의미색) 파생 그라디언트는 브랜드 그라디언트로 보이므로 따로 처리
SPECIAL = {
    "linear-gradient(145deg, #0e5344, #1f7a62)": "linear-gradient(145deg, #1233b8, #1a4ffd)",
}

CSS_RGB = {
    "rgb(20 108 88": "rgb(26 79 253",
    "rgb(127 227 196": "rgb(147 169 255",
    "rgb(127 215 189": "rgb(163 184 255",
    "rgb(134 224 196": "rgb(194 207 255",
    "rgb(56 183 149": "rgb(26 79 253",
    "rgb(95 224 189": "rgb(142 167 255",
    "rgb(4 16 26": "rgb(5 12 26",
    "rgb(16 74 70": "rgb(18 40 96",
    "rgb(18 62 92": "rgb(22 46 104",
    "rgb(2 8 14": "rgb(3 6 16",
    "rgb(9 32 46": "rgb(9 20 44",
    "rgb(9 30 27": "rgb(9 20 42",
    "rgb(3 14 22": "rgb(3 10 24",
    "rgb(21 32 29": "rgb(18 24 48",
    "rgb(7 26 36": "rgb(7 16 38",
    "rgb(6 24 22": "rgb(6 18 38",
    "rgb(3 10 17": "rgb(3 8 20",
}

TARGETS = [
    "src/styles/global.css",
    "src/components/home/BrandFilm.tsx",
    "src/components/Redirect.astro",
    "src/data/apps.ts",
    "src/components/useful/ExifMosaic.tsx",
]


def main() -> None:
    for rel in TARGETS:
        p = ROOT / rel
        s = p.read_text(encoding="utf-8")
        before = s
        for a, b in SPECIAL.items():
            s = s.replace(a, b)
        for a, b in CSS_HEX.items():
            s = s.replace(a, b).replace(a.upper(), b)
        for a, b in CSS_RGB.items():
            s = s.replace(a, b)
        if s != before:
            p.write_text(s, encoding="utf-8")
            print(f"updated {rel}")


if __name__ == "__main__":
    main()
