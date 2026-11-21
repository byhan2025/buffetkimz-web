import os, pathlib
os.environ.setdefault("LD_LIBRARY_PATH","/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright
OUT=pathlib.Path('/workspace/reports/buffetkimz-web/v70-portal')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1280,"height":900},locale="ko-KR")
    pg.goto("https://byhan2025.github.io/buffetkimz-web/about/",wait_until="networkidle")
    pg.evaluate("()=>document.querySelector('#brand').scrollIntoView()")
    pg.wait_for_timeout(1500)
    ok=pg.evaluate("()=>[...document.querySelectorAll('.ab-brand-art img')].map(i=>({src:i.currentSrc.split('/').pop(),w:i.naturalWidth,h:i.naturalHeight,complete:i.complete}))")
    print(ok)
    pg.screenshot(path=str(OUT/"about-brand-live-1280.png"))
    pg.close(); b.close()
