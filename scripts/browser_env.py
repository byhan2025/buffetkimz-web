#!/usr/bin/env python3
"""Playwright chromium 공용 라이브러리 보정 (2026-11-23).

왜 필요한가 — 2026-11-23 05:30 실행에서 `render_thumbs.py`가
`libnspr4.so: cannot open shared object file`로 죽었다. 실행 환경에 chromium이 요구하는
시스템 라이브러리(nspr·nss·atk·cairo·pango·alsa·avahi)가 빠져 있었기 때문이다.

해결 — 저장소 밖에 풀어 둔 라이브러리 디렉터리들을 `LD_LIBRARY_PATH` 앞에 붙인다.
  · /workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu  ← 2026-11-15 구성분(129개)
  · /workspace/.local/lib
  · /workspace/.tools/chromelibs                     ← 2026-11-23 보충분(avahi 등)
  · /workspace/.tools/libs/usr/lib/x86_64-linux-gnu
없는 디렉터리는 건너뛰므로 다른 환경에서도 부작용이 없다.
"""
from __future__ import annotations

import os
import pathlib

LIB_DIRS = (
    pathlib.Path("/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu"),
    pathlib.Path("/workspace/.local/lib"),
    pathlib.Path("/workspace/.tools/chromelibs"),
    pathlib.Path("/workspace/.tools/libs/usr/lib/x86_64-linux-gnu"),
)


def ensure_browser_libs() -> str | None:
    """chromium 라이브러리 경로를 LD_LIBRARY_PATH에 보장한다. 새로 붙인 경로를 돌려준다."""
    present = [str(p) for p in LIB_DIRS if p.is_dir()]
    if not present:
        return None
    current = os.environ.get("LD_LIBRARY_PATH", "")
    parts = [p for p in current.split(":") if p]
    add = [p for p in present if p not in parts]
    os.environ["LD_LIBRARY_PATH"] = ":".join(present + parts)
    return ":".join(add) if add else None
