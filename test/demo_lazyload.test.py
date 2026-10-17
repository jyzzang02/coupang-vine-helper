"""Test staged lazy loading and 50,000-won tier without contacting Coupang."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'extension/test/demo.html').read_text(encoding='utf-8')
html=html.replace('<script src="demo.js"></script><script src="../scoring.js"></script><script src="../content.js"></script>', '')
js=(ROOT/'extension/test/demo.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':760})
    page.set_content(html)
    page.evaluate("""() => {const d={}; Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>d[k]??null,setItem:(k,v)=>d[k]=String(v),removeItem:k=>delete d[k]}})}""")
    page.add_script_tag(content=js)
    page.evaluate("document.getElementById('view').click()")
    info=lambda:page.evaluate("window.__vineDemoDebug()")
    assert info()['shown']==8 and info()['allPricesWithin50k']
    page.wait_for_timeout(900)
    assert info()['shown']==8
    page.evaluate("window.scrollTo(0,document.body.scrollHeight)")
    page.wait_for_timeout(110)
    assert info()['shown']==8
    page.wait_for_timeout(450)
    assert info()['shown']==18
    page.wait_for_timeout(600)
    assert info()['shown']==18
    while info()['shown'] < info()['total']:
        before=info()['shown']
        page.evaluate("window.scrollTo(0,document.body.scrollHeight)")
        page.wait_for_timeout(520)
        assert info()['shown']>before
    assert info()['total']==92
    assert page.locator('.product-row.soldout').count()>0
    prices=[int(x.replace(',','').replace('원','')) for x in page.locator('.product-price').all_text_contents()]
    assert len(prices)==92 and max(prices)<=50000
    page.locator('#prepare').click()
    assert info()['shown']==92, 'Stock stage should not reload automatically'
    print('PASS: 8 initially, batches of 10, no auto-chain, 92 <= 50k, stock staged for F5')
    browser.close()
