"""Offline browser check for clickable category presets (no Coupang requests)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'extension'
source=(ROOT/'content.js').read_text('utf-8')
source=source.replace("  const isVineProductPage = () => isDemoPage() || (location.hostname === 'my.coupang.com' &&\n    location.pathname.replace(/\\/$/, '') === VINE_PATH);",
 "  const isVineProductPage = () => true;")
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1420,'height':900})
    page.set_content('<html><body><div id="inventory"></div></body></html>')
    page.evaluate("""() => {let db={};window.__settingsStore=db;window.chrome={storage:{local:{get:(k,cb)=>cb({[k]:db[k]}),set:(o,cb)=>{Object.assign(db,o);cb?.()}}}}}""")
    page.add_script_tag(content=(ROOT/'scoring.js').read_text('utf-8'))
    page.add_script_tag(content=source)
    def do(js):
        return page.evaluate("""(js)=>{let s=document.querySelector('#vine-helper-extension-root').shadowRoot;return new Function('s',js)(s)}""",js)
    do("s.getElementById('launch').click();s.getElementById('options').click()")
    assert do("return s.querySelectorAll('#categoryPresets button').length")==14
    old=do("return s.querySelectorAll('.categoryRow').length")
    do("s.querySelector('[data-preset=car]').click()")
    assert do("return s.querySelectorAll('.categoryRow').length")==old+1
    assert do("return s.querySelector('[data-preset=car]').getAttribute('aria-pressed')")=='true'
    do("s.querySelector('[data-preset=car]').click()")
    assert do("return s.querySelectorAll('.categoryRow').length")==old
    do("s.querySelector('[data-preset=car]').click();s.getElementById('save').click()")
    assert '와이퍼' in page.evaluate("window.__settingsStore.vineHelperSettingsV1.categoryRules")
    do("s.getElementById('options').click()")
    assert do("return s.querySelector('[data-preset=car]').getAttribute('aria-pressed')")=='true'
    print('PASS: preset add/remove, no duplicate, persisted state')
    b.close()
