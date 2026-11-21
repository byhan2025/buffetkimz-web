#!/usr/bin/env python3
"""오늘 확인 허브 데이터 갱신 — `src/data/today.ts` 를 JSON 입력으로 안전하게 바꾼다 (v5.9.3).

06:00 · 08:20 · 19:00 파이프라인이 수집 결과를 JSON 한 장으로 넘기면, 이 스크립트가
`src/data/today.ts` 의 **값과 시각만** 고친다(구조·주석·타입은 건드리지 않는다).

계약 (v5.9 보고서 §7.1)
  · 성공: `asOf`(실제 실행 시각) · `nextCheckAt` · 카드별 기준 시각을 갱신하고 `status: "ok"`.
          지표 값은 id로 찾아 바꾸며, 파일에 없는 id는 **오류로 처리**한다(조용히 무시하지 않는다).
  · 실패: 값을 그대로 두고 `status: "failed"` + `lastGoodAsOf`(직전 정상 기준 시각)만 적는다.
          화면은 직전 정상값을 그대로 보여 주면서 '갱신 실패'라고 말한다(빈 카드 금지).
  · 쓰기 전에 후보 파일을 Node로 실제로 import 해 값이 맞는지 확인하고, `--build` 면 `npm run build`까지
    통과해야 원본을 바꾼다. 하나라도 실패하면 원본은 **한 바이트도 바뀌지 않는다**.
  · v5.9.3 — `scheduleConnected`(자동 갱신 연결 표시)는 **등록된 정기 스케줄러가 넘기는
    명시적 플래그 --schedule-connected 와 성공 회차가 둘 다일 때만** true 로 켠다.
      - 기본(수동) 실행: 기존 값을 그대로 둔다 → false 는 계속 false ('수동 확인' 유지).
      - `--fail` 회차: 플래그가 와도 false 를 유지한다(실패한 회차는 자동 갱신을 약속할 근거가 아니다).
      - 이미 true 인 파일을 수동 실행해도 false 로 되돌리지 않는다(연결을 끊는 일은 별도 판단).

사용
  python3 scripts/update_today_hub.py --input payload.json            # 수동 갱신 + import 검증
  python3 scripts/update_today_hub.py --input payload.json --build    # + npm run build 검증
  python3 scripts/update_today_hub.py --input payload.json --dry-run  # 미리보기(파일 안 씀)
  python3 scripts/update_today_hub.py --fail "19:00 수집 실패: 원문 응답 없음"   # 실패 회차 기록

  # 등록된 정기 스케줄러(06:00·08:20·19:00)만 넘기는 플래그 — 성공했을 때만 '자동 확인'으로 전환
  python3 scripts/update_today_hub.py --input payload.json --schedule-connected --build

입력 JSON (성공 회차)
  {
    "asOf": "2026-11-21T19:00:41+09:00",
    "nextCheckAt": "2026-11-22T06:00:00+09:00",
    "indicators": [{"id": "kospi", "value": "4,912.35", "change": "+0.87%", "direction": "up",
                    "asOf": "2026-11-21T15:30:00+09:00", "asOfLabel": "장 마감 11. 21.",
                    "source": "한국거래소", "sourceUrl": "https://www.yna.co.kr/view/...", "basis": "42.39포인트 올림"}],
    "items": [{"id": "mid-tax-2026", "status": "failed", "lastGoodAsOf": "2026-11-21T14:00:00+09:00"}],
    "highlights": [{"text": "...", "meta": "장 마감 11. 21."}],
    "ai": {"label": "AI 정리", "asOf": "...", "asOfLabel": "...", "sourceLabel": "...", "sourceUrl": "https://...",
           "lines": ["...", "...", "..."], "note": "..."}
  }
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

APP = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_FILE = APP / "src" / "data" / "today.ts"
NODE_CANDIDATES = ("node", "/workspace/.local/node-v22/bin/node")

# 화면 카피 규칙 — 파이프라인이 자극어를 밀어 넣지 못하게 막는다(빌드 HTML 검사와 같은 목록)
BANNED = ("실시간", "속보", "초비상", "지금 당장", "폭탄", "역대급", "긴급")

# 출처 링크와 라벨이 어긋나지 않게 — 호스트별로 라벨에 반드시 있어야 하는 말
#  뉴스 호스트(연합뉴스·CNBC)는 라벨이 데이터 기관을 가리키는 경우가 정상이라 넣지 않는다.
SOURCE_HOST_LABELS = {
    "finance.naver.com": ("네이버 금융",),
    "www.fsc.go.kr": ("금융위",),
    "fsc.go.kr": ("금융위",),
    "www.nts.go.kr": ("국세청",),
    "www.law.go.kr": ("소득세법", "법령"),
}

DIRECTIONS = ("up", "down", "flat")
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$")

HEADER_RE = re.compile(
    r"  asOf: AS_OF,\n"
    r"  updatedAt: AS_OF,\n"
    r"  nextCheckAt: NEXT_CHECK,\n"
    r"(?:  status: \"(?:ok|failed)\",\n)?"
    r"(?:  lastGoodAsOf: \"[^\"]*\",\n)?"
    r"  staleAfterDays: (\d+),\n"
)
# 파이프라인 연결 스위치 (v5.9.2 값) — v5.9.3부터는 성공 회차 + --schedule-connected 일 때만 켜진다
SCHEDULE_CONNECTED_RE = re.compile(r"\n  scheduleConnected: (true|false),\n")
AS_OF_LINE_RE = re.compile(r'const AS_OF = "[^"]*";')
NEXT_CHECK_LINE_RE = re.compile(r'const NEXT_CHECK = "[^"]*";')


class UpdateError(Exception):
    """입력이나 결과가 계약을 어겼다 — 원본은 바뀌지 않는다."""


# ---------------------------------------------------------------------------- 검증
def _iso(value: object, field: str) -> str:
    if not isinstance(value, str) or not ISO_RE.match(value):
        raise UpdateError(f"{field}: ISO 8601 시각이 아닙니다 ({value!r})")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:  # pragma: no cover - 정규식이 먼저 걸러 대부분 여기 오지 않는다
        raise UpdateError(f"{field}: 시각을 해석할 수 없습니다 ({value!r})") from exc
    return value


def _text(value: object, field: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise UpdateError(f"{field}: 문자열이 아닙니다 ({value!r})")
    if not value.strip() and not allow_empty:
        raise UpdateError(f"{field}: 비어 있습니다")
    for word in BANNED:
        if word in value:
            raise UpdateError(f"{field}: 금지어 '{word}' — 자극어는 쓰지 않습니다")
    if "\n" in value:
        raise UpdateError(f"{field}: 한 줄 문자열에 줄바꿈이 있습니다")
    return value


def _url(value: object, field: str) -> str:
    text = _text(value, field)
    if not text.startswith("https://"):
        raise UpdateError(f"{field}: https 주소만 씁니다 ({text})")
    return text


def _check_source(source: str, url: str, field: str) -> None:
    host = re.sub(r"^https://", "", url).split("/")[0]
    need = SOURCE_HOST_LABELS.get(host)
    if need and not any(word in source for word in need):
        raise UpdateError(
            f"{field}: 라벨('{source}')과 링크({host})가 어긋납니다 — 라벨에 {'/'.join(need)} 중 하나가 있어야 합니다"
        )


def validate(payload: dict, current: dict) -> dict:
    """입력을 검사하고 정규화한다. current는 지금 파일의 값(실패 시 마지막 정상값 계산용)."""
    if not isinstance(payload, dict):
        raise UpdateError("입력은 JSON 객체여야 합니다")

    status = payload.get("status", "ok")
    if status not in ("ok", "failed"):
        raise UpdateError(f"status: 'ok' 또는 'failed'만 씁니다 ({status!r})")

    out: dict = {"status": status, "indicators": [], "items": [], "highlights": None, "ai": None}

    if status == "failed":
        reason = payload.get("reason") or ""
        if reason:
            out["reason"] = _text(reason, "reason")
        # 실패 회차: 기준 시각은 그대로 두고 lastGoodAsOf만 확정한다
        out["lastGoodAsOf"] = payload.get("lastGoodAsOf") or current["asOf"]
        _iso(out["lastGoodAsOf"], "lastGoodAsOf")
        out["asOf"] = current["asOf"]
        out["nextCheckAt"] = payload.get("nextCheckAt") or current["nextCheckAt"]
        _iso(out["nextCheckAt"], "nextCheckAt")
        return out

    out["asOf"] = _iso(payload.get("asOf"), "asOf")
    out["nextCheckAt"] = _iso(payload.get("nextCheckAt"), "nextCheckAt")
    if datetime.fromisoformat(out["nextCheckAt"].replace("Z", "+00:00")) <= datetime.fromisoformat(
        out["asOf"].replace("Z", "+00:00")
    ):
        raise UpdateError("nextCheckAt은 asOf보다 뒤여야 합니다")

    known_ids = set(current["indicator_ids"])
    for idx, ind in enumerate(payload.get("indicators") or []):
        field = f"indicators[{idx}]"
        if not isinstance(ind, dict):
            raise UpdateError(f"{field}: 객체가 아닙니다")
        iid = ind.get("id")
        if iid not in known_ids:
            raise UpdateError(f"{field}: today.ts에 없는 지표 id입니다 ({iid!r}) — 새 지표는 파일을 먼저 고칩니다")
        row = {"id": iid}
        for key in ("value", "change"):
            row[key] = _text(ind.get(key), f"{field}.{key}")
        direction = ind.get("direction")
        if direction not in DIRECTIONS:
            raise UpdateError(f"{field}.direction: {DIRECTIONS} 중 하나여야 합니다 ({direction!r})")
        row["direction"] = direction
        row["asOf"] = _iso(ind.get("asOf"), f"{field}.asOf")
        row["asOfLabel"] = _text(ind.get("asOfLabel"), f"{field}.asOfLabel")
        row["source"] = _text(ind.get("source"), f"{field}.source")
        row["sourceUrl"] = _url(ind.get("sourceUrl"), f"{field}.sourceUrl")
        _check_source(row["source"], row["sourceUrl"], field)
        if ind.get("basis") is not None:
            row["basis"] = _text(ind["basis"], f"{field}.basis")
        if row["id"] in [r["id"] for r in out["indicators"]]:
            raise UpdateError(f"{field}: 같은 id가 두 번 왔습니다 ({iid})")
        out["indicators"].append(row)

    item_ids = set(current["item_ids"])
    for idx, item in enumerate(payload.get("items") or []):
        field = f"items[{idx}]"
        if not isinstance(item, dict):
            raise UpdateError(f"{field}: 객체가 아닙니다")
        iid = item.get("id")
        if iid not in item_ids:
            raise UpdateError(f"{field}: today.ts에 없는 카드 id입니다 ({iid!r})")
        row = {"id": iid}
        st = item.get("status", "ok")
        if st not in ("ok", "failed"):
            raise UpdateError(f"{field}.status: 'ok' 또는 'failed'만 씁니다 ({st!r})")
        row["status"] = st
        if st == "failed":
            row["lastGoodAsOf"] = _iso(
                item.get("lastGoodAsOf") or current["item_as_of"].get(iid) or current["asOf"],
                f"{field}.lastGoodAsOf",
            )
        out["items"].append(row)

    highlights = payload.get("highlights")
    if highlights is not None:
        if not isinstance(highlights, list) or not 1 <= len(highlights) <= 3:
            raise UpdateError("highlights: 1~3줄이어야 합니다")
        out["highlights"] = [
            {
                "text": _text(h.get("text"), f"highlights[{i}].text"),
                "meta": _text(h.get("meta"), f"highlights[{i}].meta"),
            }
            for i, h in enumerate(highlights)
        ]

    ai = payload.get("ai")
    if ai is not None:
        if not isinstance(ai, dict):
            raise UpdateError("ai: 객체여야 합니다")
        lines = ai.get("lines")
        if not isinstance(lines, list) or not 1 <= len(lines) <= 3:
            raise UpdateError("ai.lines: 1~3줄이어야 합니다")
        out["ai"] = {
            "label": _text(ai.get("label"), "ai.label"),
            "asOf": _iso(ai.get("asOf"), "ai.asOf"),
            "asOfLabel": _text(ai.get("asOfLabel"), "ai.asOfLabel"),
            "sourceLabel": _text(ai.get("sourceLabel"), "ai.sourceLabel"),
            "sourceUrl": _url(ai.get("sourceUrl"), "ai.sourceUrl"),
            "lines": [_text(line, f"ai.lines[{i}]") for i, line in enumerate(lines)],
            "note": _text(ai.get("note"), "ai.note"),
        }
    return out


# ---------------------------------------------------------------------------- 파일 읽기
def snapshot(text: str) -> dict:
    """지금 파일에서 갱신에 필요한 값만 뽑는다(구조 검증도 겸한다)."""
    as_of = AS_OF_LINE_RE.search(text)
    next_check = NEXT_CHECK_LINE_RE.search(text)
    if not as_of or not next_check:
        raise UpdateError("today.ts에서 AS_OF / NEXT_CHECK 상수를 찾지 못했습니다")
    if not HEADER_RE.search(text):
        raise UpdateError("today.ts의 today 객체 머리(asOf·updatedAt·nextCheckAt·staleAfterDays)를 찾지 못했습니다")
    schedule = SCHEDULE_CONNECTED_RE.search(text)
    if not schedule:
        raise UpdateError("today.ts에 scheduleConnected 필드가 없습니다 — v5.9.2 스키마를 확인하세요")

    indicator_ids = re.findall(r'\n      id: "([a-z0-9\-_]+)",', text)
    # indicators·items 블록을 각각 잘라 id를 모은다(같은 정규식이 두 번 걸리므로 구간으로 나눈다)
    ind_start = text.find("  indicators: [")
    ind_end = text.find("\n  items: [")
    if ind_start == -1 or ind_end == -1:
        raise UpdateError("today.ts에서 indicators / items 배열을 찾지 못했습니다")
    indicator_ids = re.findall(r'\n      id: "([a-z0-9\-_]+)",', text[ind_start:ind_end])
    item_start = ind_end
    item_end = text.find("\n  ai:", item_start)
    item_ids = re.findall(r'\n      id: "([a-z0-9\-_]+)",', text[item_start:item_end])

    item_as_of = {}
    for iid in item_ids:
        block = block_of(text, "id", iid)
        if block is None:
            continue
        m = re.search(r'\n      asOf: (?:"([^"]*)"|AS_OF),', block)
        item_as_of[iid] = m.group(1) if m and m.group(1) else as_of.group(0).split('"')[1]

    return {
        "asOf": as_of.group(0).split('"')[1],
        "nextCheckAt": next_check.group(0).split('"')[1],
        "scheduleConnected": schedule.group(1) == "true",
        "indicator_ids": indicator_ids,
        "item_ids": item_ids,
        "item_as_of": item_as_of,
    }


def brace_end(text: str, open_index: int) -> int:
    """open_index의 '{'와 짝이 맞는 '}' 위치(문자열 안의 중괄호는 건너뛴다)."""
    depth = 0
    in_str = False
    esc = False
    for i in range(open_index, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
    return -1


def block_of(text: str, key: str, value: str) -> str | None:
    """`key: "value"` 를 품은 중괄호 블록을 문자열을 건너뛰며 잘라 낸다."""
    needle = f'{key}: "{value}"'
    pos = text.find(needle)
    if pos == -1:
        return None
    start = text.rfind("{", 0, pos)
    if start == -1:
        return None
    end = brace_end(text, start)
    return text[start : end + 1] if end != -1 else None


def replace_field(block: str, field: str, value: str, indent: str = "      ") -> str:
    """블록 안의 `field: "..."` 한 줄을 바꾼다(참조 값 AS_OF/NEXT_CHECK 도 문자열로 바꾼다)."""
    pattern = re.compile(rf"(\n{re.escape(indent)}{field}: )(?:\"(?:[^\"\\]|\\.)*\"|[A-Z_]+)(,)")
    new, count = pattern.subn(lambda m: m.group(1) + json.dumps(value, ensure_ascii=False) + m.group(2), block, count=1)
    if count == 0:
        raise UpdateError(f"{field}: 블록에서 값을 찾지 못했습니다")
    return new


def remove_field(block: str, field: str, indent: str = "      ") -> str:
    return re.sub(rf"\n{re.escape(indent)}{field}: \"[^\"]*\",", "", block, count=1)


def insert_after_field(block: str, after: str, field: str, value: str, indent: str = "      ") -> str:
    line = f"\n{indent}{field}: {json.dumps(value, ensure_ascii=False)},"
    pattern = re.compile(rf"(\n{re.escape(indent)}{after}: (?:\"(?:[^\"\\]|\\.)*\"|[A-Z_]+),)")
    if pattern.search(block):
        return pattern.sub(lambda m: m.group(1) + line, block, count=1)
    return block


# ---------------------------------------------------------------------------- 갱신
def update_text(text: str, payload: dict, *, schedule_connected: bool = False) -> tuple[str, dict]:
    """갱신 결과 텍스트와 계획을 돌려준다.

    schedule_connected 는 **등록된 스케줄러가 호출할 때만** True 로 넘긴다.
    그래도 성공 회차(plan.status == 'ok')가 아니면 켜지 않는다 — 실패 회차는 자동 갱신의 근거가 아니다.
    """
    current = snapshot(text)
    plan = validate(payload, current)
    # 전환 판단은 여기 한 곳에서만 한다: 기존 값 유지, 단 '성공 + 명시 플래그'일 때만 켠다.
    plan["scheduleConnected"] = bool(
        current["scheduleConnected"] or (schedule_connected and plan["status"] == "ok")
    )
    out = text

    if plan["status"] == "failed":
        # 값은 그대로, 상태만 실패로 남긴다
        header = (
            "  asOf: AS_OF,\n"
            "  updatedAt: AS_OF,\n"
            "  nextCheckAt: NEXT_CHECK,\n"
            '  status: "failed",\n'
            f'  lastGoodAsOf: {json.dumps(plan["lastGoodAsOf"], ensure_ascii=False)},\n'
            f'  staleAfterDays: {HEADER_RE.search(text).group(1)},\n'
        )
        out = HEADER_RE.sub(header, out, count=1)
        for iid in current["item_ids"]:
            block = block_of(out, "id", iid)
            if block is None:
                continue
            last_good = current["item_as_of"].get(iid) or plan["lastGoodAsOf"]
            new_block = replace_field(block, "status", "failed")
            new_block = insert_after_field(new_block, "status", "lastGoodAsOf", last_good)
            out = out.replace(block, new_block, 1)
        # 실패 회차는 자동 갱신 연결을 켜지 않는다(기존 값 유지)
        out = set_schedule_connected(out, plan["scheduleConnected"])
        return out, plan

    # 성공 회차 — 기준 시각부터
    out = AS_OF_LINE_RE.sub(f'const AS_OF = {json.dumps(plan["asOf"], ensure_ascii=False)};', out, count=1)
    out = NEXT_CHECK_LINE_RE.sub(
        f'const NEXT_CHECK = {json.dumps(plan["nextCheckAt"], ensure_ascii=False)};', out, count=1
    )
    header = (
        "  asOf: AS_OF,\n"
        "  updatedAt: AS_OF,\n"
        "  nextCheckAt: NEXT_CHECK,\n"
        '  status: "ok",\n'
        f'  staleAfterDays: {HEADER_RE.search(text).group(1)},\n'
    )
    out = HEADER_RE.sub(header, out, count=1)

    for ind in plan["indicators"]:
        block = block_of(out, "id", ind["id"])
        if block is None:
            raise UpdateError(f"지표 블록을 찾지 못했습니다: {ind['id']}")
        new_block = block
        for field in ("value", "change", "direction", "asOf", "asOfLabel", "source", "sourceUrl"):
            new_block = replace_field(new_block, field, ind[field])
        if "basis" in ind:
            new_block = replace_field(new_block, "basis", ind["basis"])
        out = out.replace(block, new_block, 1)

    overrides = {row["id"]: row for row in plan["items"]}
    for iid in current["item_ids"]:
        block = block_of(out, "id", iid)
        if block is None:
            continue
        row = overrides.get(iid, {"id": iid, "status": "ok"})
        new_block = block
        if row["status"] == "failed":
            new_block = replace_field(new_block, "status", "failed")
            new_block = insert_after_field(new_block, "status", "lastGoodAsOf", row["lastGoodAsOf"])
        else:
            new_block = replace_field(new_block, "asOf", plan["asOf"])
            new_block = replace_field(new_block, "fetchedAt", plan["asOf"])
            new_block = replace_field(new_block, "nextCheckAt", plan["nextCheckAt"])
            new_block = replace_field(new_block, "status", "ok")
            new_block = remove_field(new_block, "lastGoodAsOf")
        out = out.replace(block, new_block, 1)

    if plan["highlights"]:
        start = out.find("  highlights: [\n")
        end = out.find("\n  ],\n", start)
        if start == -1 or end == -1:
            raise UpdateError("highlights 블록을 찾지 못했습니다")
        rows = "".join(
            f'    {{ text: {json.dumps(h["text"], ensure_ascii=False)}, meta: {json.dumps(h["meta"], ensure_ascii=False)} }},\n'
            for h in plan["highlights"]
        )
        out = out[:start] + "  highlights: [\n" + rows + "  ],\n" + out[end + len("\n  ],\n") :]

    if plan["ai"]:
        ai = plan["ai"]
        start = out.find("  ai: {")
        open_idx = out.find("{", start)
        close_idx = brace_end(out, open_idx) if start != -1 else -1
        if start == -1 or close_idx == -1:
            raise UpdateError("ai 블록을 찾지 못했습니다")
        tail_end = out.find("\n", close_idx) + 1
        lines = "".join(f"      {json.dumps(line, ensure_ascii=False)},\n" for line in ai["lines"])
        new_ai = (
            "  ai: {\n"
            f'    label: {json.dumps(ai["label"], ensure_ascii=False)},\n'
            f'    asOf: {json.dumps(ai["asOf"], ensure_ascii=False)},\n'
            f'    asOfLabel: {json.dumps(ai["asOfLabel"], ensure_ascii=False)},\n'
            f'    sourceLabel: {json.dumps(ai["sourceLabel"], ensure_ascii=False)},\n'
            f'    sourceUrl: {json.dumps(ai["sourceUrl"], ensure_ascii=False)},\n'
            "    lines: [\n" + lines + "    ],\n"
            f'    note: {json.dumps(ai["note"], ensure_ascii=False)},\n'
            "  },\n"
        )
        out = out[:start] + new_ai + out[tail_end:]

    # 성공 회차: --schedule-connected 로 등록된 스케줄러가 불렀을 때만 켠다('수동 확인' → '자동 확인')
    out = set_schedule_connected(out, plan["scheduleConnected"])
    return out, plan


def set_schedule_connected(text: str, connected: bool) -> str:
    """`scheduleConnected` 한 줄만 바꾼다(이미 같은 값이면 그대로)."""
    value = "true" if connected else "false"
    new, count = SCHEDULE_CONNECTED_RE.subn(f"\n  scheduleConnected: {value},\n", text, count=1)
    if count == 0:
        raise UpdateError("today.ts에 scheduleConnected 필드가 없습니다 — v5.9.2 스키마를 확인하세요")
    return new


def _first_highlight_text(text: str) -> str:  # pragma: no cover - 테스트·수동 점검용
    m = re.search(r'highlights: \[\n    \{ text: "(?:[^"\\]|\\.)*"', text)
    if not m:
        raise UpdateError("highlights 첫 줄을 찾지 못했습니다")
    row = re.search(r'text: "((?:[^"\\]|\\.)*)"', m.group(0))
    return json.loads(f'"{row.group(1)}"') if row else ""


# ---------------------------------------------------------------------------- 검증 실행
def find_node() -> str | None:
    for cand in NODE_CANDIDATES:
        path = shutil.which(cand) or (cand if os.path.exists(cand) else None)
        if path:
            return path
    return None


def verify_import(candidate: pathlib.Path, plan: dict) -> None:
    """후보 파일을 Node로 실제 import 해 값이 의도대로인지 확인한다."""
    node = find_node()
    if not node:
        print("! node를 찾지 못해 import 검증을 건너뜁니다", file=sys.stderr)
        return
    holder = pathlib.Path(tempfile.mkdtemp(prefix="today-check-"))
    probe = holder / "check.mjs"
    probe.write_text(
        "import { today } from " + json.dumps(candidate.as_uri()) + ";\n"
        "console.log(JSON.stringify({asOf: today.asOf, nextCheckAt: today.nextCheckAt, status: today.status ?? 'ok',"
        " scheduleConnected: today.scheduleConnected,"
        " indicators: today.indicators.map((i) => [i.id, i.value]), items: today.items.map((i) => [i.id, i.status])}));\n",
        encoding="utf-8",
    )
    run = subprocess.run([node, "--experimental-strip-types", str(probe)], capture_output=True, text=True)
    if run.returncode != 0:
        raise UpdateError(f"후보 파일을 import 할 수 없습니다: {(run.stderr or run.stdout).strip()[:500]}")
    data = json.loads(run.stdout.strip().splitlines()[-1])
    if data["asOf"] != plan["asOf"] or data["nextCheckAt"] != plan["nextCheckAt"]:
        raise UpdateError(f"기준 시각이 반영되지 않았습니다: {data['asOf']} / {data['nextCheckAt']}")
    if data.get("scheduleConnected") is not plan["scheduleConnected"]:
        raise UpdateError(
            "scheduleConnected가 계획과 다릅니다 "
            f"(파일: {data.get('scheduleConnected')!r} / 기대: {plan['scheduleConnected']!r}) — "
            "수동·실패 회차는 false, 성공 + --schedule-connected 에서만 true 여야 합니다"
        )
    if plan["status"] == "ok":
        for row in plan["indicators"]:
            got = dict(data["indicators"]).get(row["id"])
            if got != row["value"]:
                raise UpdateError(f"{row['id']} 값이 반영되지 않았습니다: {got!r} != {row['value']!r}")
    else:
        statuses = dict(data["items"])
        if any(st != "failed" for st in statuses.values()):
            raise UpdateError(f"실패 회차인데 카드 상태가 failed가 아닙니다: {statuses}")
    shutil.rmtree(holder, ignore_errors=True)


def run_build(expect_as_of: str | None = None) -> None:
    node = find_node()
    if not node:
        raise UpdateError("npm run build 검증에 node가 필요합니다")
    env = dict(os.environ)
    env["PATH"] = f"{pathlib.Path(node).parent}:{env.get('PATH', '')}"
    run = subprocess.run(["npm", "run", "build"], cwd=str(APP), capture_output=True, text=True, env=env)
    if run.returncode != 0:
        raise UpdateError(f"npm run build 실패: {(run.stderr or run.stdout)[-800:]}")
    if expect_as_of:
        home = APP / "dist" / "index.html"
        if not home.exists() or f'data-as-of="{expect_as_of}"' not in home.read_text(encoding="utf-8"):
            raise UpdateError("빌드 결과 홈에 새 기준 시각이 반영되지 않았습니다")


# ---------------------------------------------------------------------------- CLI
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="오늘 확인 허브(today.ts) 갱신 — v5.9.3")
    ap.add_argument("--input", help="수집 결과 JSON 경로")
    ap.add_argument("--fail", help="실패 회차로 기록한다(사유). 값은 그대로 두고 status: failed")
    ap.add_argument("--last-good-as-of", help="실패 회차의 마지막 정상 기준 시각(기본: 지금 파일의 asOf)")
    ap.add_argument("--file", default=str(DEFAULT_FILE), help="대상 파일(기본 src/data/today.ts)")
    ap.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 결과만 확인")
    ap.add_argument("--build", action="store_true", help="쓰기 전에 npm run build 까지 검증")
    ap.add_argument(
        "--schedule-connected",
        action="store_true",
        help="등록된 정기 스케줄러가 넘기는 플래그 — 성공 회차에서만 '자동 확인'으로 전환(수동 실행은 쓰지 않는다)",
    )
    ap.add_argument("--no-verify", action="store_true", help="Node import 검증 건너뛰기(테스트용)")
    args = ap.parse_args(argv)

    target = pathlib.Path(args.file)
    if not target.exists():
        print(f"대상 파일이 없습니다: {target}", file=sys.stderr)
        return 2

    if bool(args.input) == bool(args.fail):
        print("--input 또는 --fail 중 하나만 주세요", file=sys.stderr)
        return 2

    schedule_flag = bool(args.schedule_connected)
    if args.fail and schedule_flag:
        # 실패 회차에 연결 플래그가 와도 켜지 않는다 — 무시했다는 사실을 조용히 넘기지 않는다
        print("안내: 실패 회차(--fail)이므로 --schedule-connected 를 무시합니다 — 연결 표시는 그대로 둡니다", file=sys.stderr)
        schedule_flag = False

    if args.fail:
        payload: dict = {"status": "failed", "reason": args.fail}
        if args.last_good_as_of:
            payload["lastGoodAsOf"] = args.last_good_as_of
    else:
        try:
            payload = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"입력을 읽지 못했습니다: {exc}", file=sys.stderr)
            return 2

    original = target.read_text(encoding="utf-8")
    try:
        updated, plan = update_text(original, payload, schedule_connected=schedule_flag)
    except UpdateError as exc:
        print(f"거부: {exc}", file=sys.stderr)
        return 1

    if updated == original:
        print("바뀐 내용이 없습니다")
        return 0

    if args.dry_run:
        changed = sum(1 for a, b in zip(original.splitlines(), updated.splitlines()) if a != b)
        print(
            f"미리보기 — {changed}줄이 바뀝니다 (status={plan['status']}, asOf={plan['asOf']}, "
            f"scheduleConnected={str(plan['scheduleConnected']).lower()})"
        )
        return 0

    tmp = target.with_name(f"{target.stem}.candidate{target.suffix}")
    tmp.write_text(updated, encoding="utf-8")
    try:
        if not args.no_verify:
            verify_import(tmp, plan)
        if args.build:
            if target.resolve() == DEFAULT_FILE.resolve():
                # 빌드는 src/data/today.ts 를 읽는다 — 후보를 제자리에 놓고 빌드하고, 실패하면 되돌린다
                os.replace(tmp, target)
                try:
                    run_build(plan["asOf"] if plan["status"] == "ok" else None)
                except UpdateError:
                    target.write_text(original, encoding="utf-8")
                    raise
                print(
                    f"갱신 완료 + build 통과 — {target} (status={plan['status']}, asOf={plan['asOf']}, "
                    f"scheduleConnected={str(plan['scheduleConnected']).lower()})"
                )
                return 0
            run_build()
    except UpdateError as exc:
        tmp.unlink(missing_ok=True)
        print(f"검증 실패 — 원본을 그대로 둡니다: {exc}", file=sys.stderr)
        return 1

    os.replace(tmp, target)
    print(
        f"갱신 완료 — {target} (status={plan['status']}, asOf={plan['asOf']}, "
        f"scheduleConnected={str(plan['scheduleConnected']).lower()})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
