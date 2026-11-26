#!/usr/bin/env python3
"""심평원 고지 정리기 — PDF 경로 시험용 표 PDF 만들기 (2026-11-26)

실제 심평원 PDF 내려받기가 없어서, 같은 표 모양을 Chromium 인쇄로 PDF로 만든다.
글자가 살아 있는 PDF라 pdfjs 추출 → 표 머리글 인식 경로를 그대로 시험할 수 있다.

  python3 scripts/make_simpyeong_sample_pdf.py
  → tmp/files/hira-sample.pdf
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP / "tmp" / "files"
OUT.mkdir(parents=True, exist_ok=True)

# 엔진의 예시 데이터를 그대로 표로 그린다(엑셀 시험과 같은 값).
NODE = r"""
import { EXAMPLE_TABLES, todayISO } from './src/lib/simpyeong/engine.js';
console.log(JSON.stringify(EXAMPLE_TABLES(todayISO())));
"""
node = "/workspace/.tools/node-v22.23.4-linux-x64/bin/node"
raw = subprocess.run([node, "--input-type=module", "-e", NODE], cwd=APP, capture_output=True, text=True, check=True).stdout
tables = json.loads(raw)


def esc(v: str) -> str:
    return str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


parts = []
for t in tables:
    rows = t["rows"]
    head, body = rows[0], rows[1:]
    parts.append(f"<h2>{esc(t['name'])}</h2><table><thead><tr>")
    parts.append("".join(f"<th>{esc(c)}</th>" for c in head))
    parts.append("</tr></thead><tbody>")
    for r in body:
        parts.append("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in r) + "</tr>")
    parts.append("</tbody></table>")

html = f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<style>
 body{{font-family:"Noto Sans CJK KR","WenQuanYi Zen Hei",sans-serif;font-size:9px;padding:12px}}
 h2{{font-size:11px;margin:10px 0 4px}}
 table{{border-collapse:collapse;width:100%;margin-bottom:10px}}
 th,td{{border:1px solid #999;padding:2px 4px;text-align:left}}
</style>
<h1 style="font-size:13px">건강보험심사평원 내 진료정보 열람</h1>
{''.join(parts)}
</html>"""

target = OUT / "hira-sample.pdf"
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
        args=["--no-sandbox"],
    )
    page = browser.new_page()
    page.set_content(html, wait_until="load")
    page.pdf(path=str(target), format="A4", print_background=True)
    browser.close()

print(target, target.stat().st_size, "bytes")
