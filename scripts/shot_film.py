"""필름 장면 캡처 — window.__bkFilm.seek(t)로 결정적으로 다시 그린다."""
import os, sys, http.server, socketserver, threading, pathlib
os.environ.setdefault("LD_LIBRARY_PATH","/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright
APP=pathlib.Path(__file__).resolve().parent.parent; ROOT=APP/"dist"
OUT=APP.parent.parent/"reports"/"buffetkimz-web"/"v70-portal"; OUT.mkdir(parents=True,exist_ok=True)
PORT=8195; PREFIX="/buffetkimz-web"
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(ROOT),**k)
    def translate_path(self,p):
        p=p.split("?",1)[0].split("#",1)[0]
        if p==PREFIX: p="/"
        elif p.startswith(PREFIX+"/"): p=p[len(PREFIX):]
        return super().translate_path(p)
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),H); threading.Thread(target=httpd.serve_forever,daemon=True).start()
times=[float(x) for x in (sys.argv[1].split(",") if len(sys.argv)>1 else ["8.9"])]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",args=["--no-sandbox"])
    for w,h in ((1280,900),(390,844)):
        pg=b.new_page(viewport={"width":w,"height":h},locale="ko-KR")
        pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}/",wait_until="networkidle"); pg.wait_for_timeout(1600)
        for t in times:
            pg.evaluate(f"() => window.__bkFilm && window.__bkFilm.seek({t})")
            pg.wait_for_timeout(320)
            pg.screenshot(path=str(OUT/f"film-s{t}-{w}.png"))
        pg.close()
    b.close()
httpd.shutdown()
