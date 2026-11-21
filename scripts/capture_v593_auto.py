#!/usr/bin/env python3
"""v5.9.3 자동 확인 모드 실측 — `--schedule-connected` 한 번으로 화면이 실제로 '자동 확인'으로 바뀌는지 본다.

순서(끝나면 저장소를 원상 복구한다):
  1) `src/data/today.ts` 원문을 백업한다(바이트 그대로).
  2) `scripts/update_today_hub.py --input <payload> --schedule-connected --build` 를 **실제로** 돌린다.
     → 파일의 `scheduleConnected` 가 true 로 바뀌고 `npm run build` 까지 통과해야 한다.
  3) 그 빌드를 1270/1280 뷰포트로 열어 기준 줄·다음 확인·하단 고지를 글로 읽고 캡처를 남긴다
     (`14-hub-auto-mode-1280.png`, `14b-hub-auto-mode-390.png`).
  4) 백업한 원문을 되돌리고 다시 빌드한 뒤, `data-schedule-connected="false"` 와 '14:00 수동 확인'이
     돌아왔는지 확인한다.

결과: reports/buffetkimz-web/v593-hub/auto-mode-flip.json (측정값 + 복구 확인)
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import socketserver
import subprocess
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / "dist"
OUT = APP.parent.parent / "reports" / "buffetkimz-web" / "v593-hub"
TODAY = APP / "src" / "data" / "today.ts"
PORT = 8123
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read_state(browser, label: str, viewport: dict) -> dict:
    ctx = browser.new_context(viewport=viewport, device_scale_factor=2, locale="ko-KR", timezone_id="Asia/Seoul")
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1200)
    state = page.evaluate(
        """() => {
            const t = (sel) => {
              const el = document.querySelector(sel);
              return el ? el.textContent.replace(/\\\\s+/g, ' ').trim() : null;
            };
            const hub = document.querySelector('[data-hub]');
            const next = hub ? hub.querySelector('[data-hub-next]') : null;
            return {
              scheduleConnected: hub ? hub.dataset.scheduleConnected : null,
              hubBasis: t('[data-hub-basis]'),
              scheduleNote: hub && hub.querySelector('[data-hub-schedule-note]')
                ? t('[data-hub-schedule-note]') : null,
              nextCheck: next ? { text: next.textContent.replace(/\\\\s+/g, ' ').trim(), hidden: next.hidden } : null,
              notice: t('[data-hub-notice]'),
            };
        }"""
    )
    state["viewport"] = label
    page.screenshot(path=str(OUT / f"14-hub-auto-mode-{label}.png"), full_page=False)
    ctx.close()
    return state


def build() -> None:
    node_bin = pathlib.Path("/workspace/.local/node-v22/bin")
    env = dict(os.environ)
    env["PATH"] = f"{node_bin}:{env.get('PATH', '')}"
    run = subprocess.run(["npm", "run", "build"], cwd=str(APP), capture_output=True, text=True, env=env)
    if run.returncode != 0:
        raise SystemExit(f"build failed: {(run.stderr or run.stdout)[-600:]}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    original = TODAY.read_bytes()
    backup = pathlib.Path(tempfile.mkdtemp(prefix="v593-auto-")) / "today.ts"
    backup.write_bytes(original)
    evidence: dict = {"version": "5.9.3", "steps": []}
    httpd = None
    try:
        payload = pathlib.Path(tempfile.mkdtemp(prefix="v593-payload-")) / "payload.json"
        payload.write_text(
            json.dumps(
                {
                    # 배포본과 같은 기준 시각을 그대로 두고 연결 표시만 켠다(차이가 표시뿐임을 보이기 위해)
                    "asOf": "2026-11-21T14:00:00+09:00",
                    "nextCheckAt": "2026-11-21T19:00:00+09:00",
                    "indicators": [],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        node_bin = "/workspace/.local/node-v22/bin"
        env = dict(os.environ)
        env["PATH"] = f"{node_bin}:{env.get('PATH', '')}"
        run = subprocess.run(
            [
                sys.executable,
                "scripts/update_today_hub.py",
                "--input",
                str(payload),
                "--schedule-connected",
                "--build",
            ],
            cwd=str(APP),
            capture_output=True,
            text=True,
            env=env,
        )
        evidence["updater"] = {
            "exit": run.returncode,
            "stdout": run.stdout.strip(),
            "stderr": run.stderr.strip(),
        }
        if run.returncode != 0:
            raise SystemExit(f"updater failed: {run.stderr[-800:]}")
        if "scheduleConnected: true," not in TODAY.read_text(encoding="utf-8"):
            raise SystemExit("today.ts 의 scheduleConnected 가 true 로 바뀌지 않았습니다")
        evidence["file_after"] = "scheduleConnected: true"

        httpd = serve()
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            evidence["auto"] = {
                "1280": read_state(browser, "1280", {"width": 1280, "height": 1000}),
                "390": read_state(browser, "390", {"width": 390, "height": 844}),
            }
            browser.close()
    finally:
        if httpd:
            httpd.shutdown()
        # 원상 복구 — 파일을 바이트 그대로 되돌리고 다시 빌드한다
        TODAY.write_bytes(backup.read_bytes())
    build()
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    evidence["restored"] = {
        "file_scheduleConnected_false": "scheduleConnected: false," in TODAY.read_text(encoding="utf-8"),
        "dist_false_attribute": 'data-schedule-connected="false"' in home,
        "dist_manual_basis": "2026. 11. 21. 14:00 수동 확인" in home,
        "dist_no_auto_cadence": "하루 3회" not in home.split("data-hub")[1][:200000],
    }
    if not all(evidence["restored"].values()):
        raise SystemExit(f"복구 확인 실패: {evidence['restored']}")
    (OUT / "auto-mode-flip.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
