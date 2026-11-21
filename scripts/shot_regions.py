"""구역 캡처 — 홈 허브·포털 픽·소개 진단."""
import os, http.server, socketserver, threading, pathlib
os.environ.setdefault("LD_LIBRARY_PATH","/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright
APP=pathlib.Path(__file__).resolve().parent.parent; ROOT=APP/"dist"
OUT=APP.parent.parent/"reports"/"buffetkimz-web"/"v70-portal"
PORT=8193; PREFIX="/buffetkimz-web"
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
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",args=["--no-sandbox"])
    for w,h,tag in ((1280,1150,'1280'),(390,900,'390')):
        pg=b.new_page(viewport={"width":w,"height":h},locale="ko-KR")
        pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}/",wait_until="networkidle"); pg.wait_for_timeout(1400)
        pg.evaluate("()=>document.querySelector('[data-hub]').scrollIntoView()"); pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT/f"r-hub-{tag}.png"))
        pg.evaluate("()=>window.scrollBy(0,1050)"); pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT/f"r-hub2-{tag}.png"))
        pg.evaluate("()=>document.querySelector('#picks').scrollIntoView()"); pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT/f"r-picks-{tag}.png"))
        pg.close()
        pg=b.new_page(viewport={"width":w,"height":h},locale="ko-KR")
        pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}/about/",wait_until="networkidle"); pg.wait_for_timeout(900)
        pg.evaluate("()=>document.querySelector('#diagnosis').scrollIntoView()"); pg.wait_for_timeout(400)
        pg.click(".fcheck-chip"); pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT/f"r-diag-{tag}.png"))
        pg.close()
        pg=b.new_page(viewport={"width":w,"height":h},locale="ko-KR")
        pg.goto(f"http://127.0.0.1:{PORT}{PREFIX}/apps/",wait_until="networkidle"); pg.wait_for_timeout(900)
        pg.evaluate("()=>window.scrollBy(0,520)"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT/f"r-apps-{tag}.png"))
        pg.close()
    b.close()
httpd.shutdown()
