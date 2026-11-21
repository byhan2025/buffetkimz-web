import os, pathlib
os.environ.setdefault("LD_LIBRARY_PATH","/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib")
from playwright.sync_api import sync_playwright
OUT=pathlib.Path('/workspace/reports/buffetkimz-web/v70-portal')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":390,"height":844},locale="ko-KR")
    pg.goto("https://byhan2025.github.io/buffetkimz-web/",wait_until="networkidle"); pg.wait_for_timeout(2000)
    pg.evaluate("()=>window.__bkFilm&&window.__bkFilm.seek(9.35)"); pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT/"film-scene5-390.png"))
    r=pg.evaluate("()=>{const b=document.querySelector('[data-guide-open]');const c=document.querySelector('.film-ctas');const br=b?.getBoundingClientRect();const cr=c?.getBoundingClientRect();return {btn:br&&[Math.round(br.top),Math.round(br.bottom)],cta:cr&&[Math.round(cr.top),Math.round(cr.bottom)]}}")
    print(r)
    pg.close(); b.close()
