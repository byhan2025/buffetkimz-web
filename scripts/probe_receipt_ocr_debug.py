#!/usr/bin/env python3
"""OCR 상태 디버그 — 파일을 올린 뒤 상태 상자를 2초마다 찍는다

  python3 scripts/probe_receipt_ocr.py debug [file.png]
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys
import threading
import time

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP / "reports" / "buffetkimz-web" / "receipt-ocr-20261127"
PORT = 8796
img = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / "fixtures" / "receipt-clinic.png"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP / "dist"), **kw)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

sys.path.insert(0, str(APP / "scripts"))
from browser_env import ensure_browser_libs  # noqa: E402

ensure_browser_libs()
from playwright.sync_api import sync_playwright  # noqa: E402

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome", args=["--no-sandbox"])
        page = b.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR").new_page()
        logs: list[str] = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: logs.append(f"reqfail: {r.url} {r.failure}"))
        page.goto(f"http://127.0.0.1:{PORT}/apps/silson-compare/run/", wait_until="domcontentloaded")
        page.wait_for_selector('[data-receipt-ocr="drop"]', timeout=30000)

        info = page.evaluate(
            """() => {
                const inputs = [...document.querySelectorAll('input[type=file]')];
                return { count: inputs.length, aria: inputs.map(i => i.getAttribute('aria-label')) };
            }"""
        )
        print("file inputs:", json.dumps(info, ensure_ascii=False))

        page.set_input_files('[data-receipt-ocr="drop"] input[type="file"]', str(img))
        for i in range(40):
            time.sleep(2)
            st = page.evaluate(
                """() => {
                    const q = s => { const el = document.querySelector(s); return el ? el.textContent.trim().slice(0, 160) : ''; };
                    return { status: q('[data-receipt-ocr="status"]'), error: q('[data-receipt-ocr="error"]'), result: q('[data-receipt-ocr="result"]') };
                }"""
            )
            print(i * 2, json.dumps(st, ensure_ascii=False))
            if st["result"] or st["error"]:
                break
        print("LOGS:", json.dumps(logs[-15:], ensure_ascii=False, indent=1))
        page.screenshot(path=str(OUT / "probe-debug.png"))
        b.close()
finally:
    httpd.shutdown()
