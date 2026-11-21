#!/usr/bin/env python3
"""v5.9.3 실브라우저 캡처 — v5.9.2 캡처(`capture_v592.py`)를 그대로 돌리되 결과 폴더만 v593-hub 로 바꾼다.

v5.9.3 은 **화면을 바꾸지 않은 판**이다(파이프라인 스크립트의 연결 표시 판정 + 버전 표기만 고쳤다).
그래서 캡처 계측·시나리오도 v5.9.2 와 같은 것을 이 빌드에 대해 다시 돌려, 화면이 정말 그대로인지 확인한다.
결과: reports/buffetkimz-web/v593-hub/capture-notes.json (+ 캡처 PNG)
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import capture_v592 as base  # noqa: E402

OUT = base.APP.parent.parent / "reports" / "buffetkimz-web" / "v593-hub"


def main() -> int:
    base.OUT = OUT
    OUT.mkdir(parents=True, exist_ok=True)
    base.main()
    notes_path = OUT / "capture-notes.json"
    notes = json.loads(notes_path.read_text(encoding="utf-8"))
    notes["version"] = "5.9.3"
    notes["based_on"] = "capture_v592.py (화면 무변경 판 — 같은 계측을 이 빌드에 다시 실행)"
    notes_path.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {notes_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
