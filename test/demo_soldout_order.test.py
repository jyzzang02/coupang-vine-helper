"""Offline test for sold-out products moved to bottom by depletion time."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1] / 'extension' / 'test'
HTML=(ROOT/'demo.html').read_text(encoding='utf-8').split('<script src="demo.js">')[0]+'</body></html>'
JS=(ROOT/'demo.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    storage={}
    page=None
    def load():
        global page,storage
        if page:
            storage=page.evaluate('sessionStorage.snapshot()')
            page.close()
        page=browser.new_page(viewport={'width':1280,'height':850})
        page.set_content(HTML)
        page.evaluate("""saved => {
            const state={...saved};
            Object.defineProperty(window,'sessionStorage',{configurable:true,value:{
                getItem:k=>state[k]??null,setItem:(k,v)=>state[k]=String(v),
                removeItem:k=>delete state[k],snapshot:()=>({...state})
            }});
        }""",storage)
        page.add_script_tag(content=JS)
    load()
    if page.locator('#intro').is_visible():page.locator('#view').click()
    previous=[]
    for stage in range(11):
        data=page.evaluate('window.__vineDemoDebug()')
        assert data['stage']==stage
        order=data['order']
        depleted=data['depleted']
        ids=[x['id'] for x in depleted]
        assert len(order)==len(set(order))==92
        assert order[-len(ids):]==ids
        assert ids[:len(previous)]==previous,('previously depleted moved',stage)
        assert [x['soldOutAt'] for x in depleted]==sorted(x['soldOutAt'] for x in depleted)
        visible=page.locator('.product-row').evaluate_all('(xs)=>xs.map(el=>Number(el.dataset.productId))')
        assert visible==order[:len(visible)]
        previous=ids
        if stage<10:load()
    assert len(previous)==92
    page.evaluate("sessionStorage.setItem('vineHelperSkipAutoDeclineV089','yes');sessionStorage.removeItem('vineHelperAutoDeclineVisitsV089');sessionStorage.setItem('vineHelperStockStageV07','2')")
    load()
    order=page.evaluate('window.__vineDemoDebug().order')
    for _ in range(14):
        if page.evaluate('window.__vineDemoDebug().shown')==92:break
        page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
        page.wait_for_timeout(500)
    cards=page.locator('.product-row').evaluate_all('(xs)=>xs.map(el=>Number(el.dataset.productId))')
    assert cards==order and len(cards)==92
    print('PASS: sold-out order stable across F5 and scroll pagination')
    browser.close()
