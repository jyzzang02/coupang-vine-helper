"""Test extension auto-scroll against the staged offline mock, no network calls."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]/'extension'
html=(ROOT/'test/demo.html').read_text(encoding='utf-8').split('<script src="demo.js">')[0]+'</body></html>'
content=(ROOT/'content.js').read_text(encoding='utf-8')
content=content.replace("""  const isDemoPage = () => location.protocol === 'chrome-extension:' &&
    location.pathname === '/test/demo.html';""","  const isDemoPage = () => true;")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':760})
    page.set_content(html)
    page.evaluate("""() => {const data={};Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}});window.chrome={storage:{local:{get:(k,cb)=>cb({}),set:(x,cb)=>cb?.()}}};}""")
    page.add_script_tag(content=(ROOT/'test/demo.js').read_text(encoding='utf-8'))
    page.evaluate("document.querySelector('#view').click()")
    page.add_script_tag(content=(ROOT/'scoring.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=content)
    page.evaluate("document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('launch').click()")
    page.evaluate("document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('auto').click()")
    data=None
    for i in range(35):
        page.wait_for_timeout(500)
        data=page.evaluate("""() => {const s=document.querySelector('#vine-helper-extension-root').shadowRoot;return {demo:__vineDemoDebug(),ranked:s.querySelectorAll('#results .product').length,auto:s.getElementById('auto').hidden}}""")
        if data['demo']['shown']==92 and not data['auto']:break
    assert data['demo']['shown']==92, data
    assert data['ranked']==10, data
    print('PASS: auto-scroll found all 92 dynamically loaded mock products, TOP 10 correct')
    browser.close()
