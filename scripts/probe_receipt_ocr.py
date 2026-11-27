#!/usr/bin/env python3
"""OCR 한 장 처리 시간 재기 — 빠른 점검용

  python3 scripts/probe_receipt_ocr.py 390x844 [file.png]
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
PORT = 8795
vp_label = sys.argv[1] if len(sys.argv) > 1 else "390x844"
img = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / "fixtures" / "receipt-clinic.png"
vp = {"width": 390, "height": 844} if vp_label.startswith("390") else {"width": 1280, "height": 800}


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

log: list[str] = []
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome", args=["--no-sandbox"])
        ctx = b.new_context(viewport=vp, locale="ko-KR")
        page = ctx.new_page()
        page.on("console", lambda m: log.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: log.append(f"pageerror: {e}"))
        page.goto(f"http://127.0.0.1:{PORT}/apps/silson-compare/run/", wait_until="domcontentloaded")
        page.wait_for_selector("text=영수증 사진·PDF 올려서 자동 채우기", timeout=30000)
        t0 = time.time()
        page.set_input_files('input[type="file"]', str(img))
        try:
            page.wait_for_selector("text=인식한 내용으로 칸을 채웠습니다", timeout=120000)
        except Exception as e:  # noqa: BLE001
            log.append(f"WAIT FAIL: {type(e).__name__}")
        elapsed = time.time() - t0
        vals = page.evaluate(
            """() => Object.fromEntries([...document.querySelectorAll('input[id^=\"amt-\"]')].map(i => [i.id, i.value]))"""
        )
        status = page.evaluate(
            """() => {
                const out = [];
                for (const el of document.querySelectorAll('[role=status], [role=alert], .rounded-lg')) {
                  if (el.textContent && el.textContent.trim()) out.push(el.textContent.trim().slice(0, 200));
                }
                return out.slice(-6).join(' || ');
            }"""
        )
        print(json.dumps({"elapsed_s": round(elapsed, 1), "values": vals, "status": status[:400], "log": log[-12:]}, ensure_ascii=False, indent=2))
        page.screenshot(path=str(OUT / f"probe-{vp_label}.png"))
        b.close()
finally:
    httpd.shutdown()
