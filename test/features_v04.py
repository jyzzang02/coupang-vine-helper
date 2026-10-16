from pathlib import Path
from playwright.sync_api import sync_playwright

p = Path(__file__).resolve().parent.parent
script = (p/'extension/content.js').read_text(encoding='utf-8')
original = "location.hostname === 'my.coupang.com' &&\n    location.pathname.replace(/\\/$/, '') === VINE_PATH"
assert original in script
script = script.replace(original, "document.documentElement.dataset.mockVine === 'yes'")

# The browser simulates a longer, lazy-loaded product list without contacting Coupang.
items = ''.join(f'<div class="product-card" data-item="{i}"><a href="https://www.coupang.com/vp/products/{70000+i}"><span class="product-name">상품 {i} 노트북 테스트</span></a><div class="product-price">{(i+1)*10000:,}원</div></div>' for i in range(30))
doc = f'''<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body {{font:16px Arial,sans-serif}} #scrollarea {{overflow-y:auto;height:450px;width:800px; border:1px solid black}}
.product-card {{height:130px;border:1px solid #ddd;margin:8px; padding:6px; background:#fff}}
</style></head><body><h1>Mock Vine page</h1><div id="scrollarea">{items}</div></body></html>'''
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':900})
    page.set_content(doc)
    page.evaluate("document.documentElement.dataset.mockVine = 'yes'")
    page.add_script_tag(path=str(p/'extension/scoring.js'))
    page.add_script_tag(content=script)
    root = page.locator('#vine-helper-extension-root')
    root.evaluate("el => el.shadowRoot.getElementById('launch').click()")
    page.wait_for_timeout(700)
    def state():
        return page.evaluate('''() => ({
           badges:document.querySelectorAll('.vine-helper-inline-recommendation').length,
           marked:document.querySelectorAll('.vine-helper-recommended-card').length,
           duplicate:[...document.querySelectorAll('.vine-helper-recommended-card')].filter(e=>e.querySelectorAll('.vine-helper-inline-recommendation').length!==1).length,
           autoVisible:!document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('auto').hidden,
           stopVisible:!document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('stop').hidden,
           status:document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('scrollStatus').textContent,
           top:document.querySelector('#scrollarea').scrollTop,
           summary:document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('summary').textContent
        })''')
    initial=state()
    print('initial',initial)
    assert initial['badges']==10 and initial['marked']==10 and initial['duplicate']==0
    page.wait_for_timeout(1400)
    assert state()['badges']==10 and state()['duplicate']==0, 'Observer caused duplicate badges'
    # Excluding every card removes inline recommendations but not the site's product cards.
    root.evaluate("el => el.shadowRoot.getElementById('options').click()")
    root.evaluate("el => {el.shadowRoot.getElementById('excludeKeywords').value = '노트북';el.shadowRoot.getElementById('save').click()}")
    page.wait_for_timeout(300)
    assert state()['badges']==0
    assert page.locator('.product-card').count()==30
    root.evaluate("el => el.shadowRoot.getElementById('options').click()")
    root.evaluate("el => {el.shadowRoot.getElementById('excludeKeywords').value = '';el.shadowRoot.getElementById('save').click()}")
    assert state()['badges']==10
    # Start and stop should not navigate or submit anything.
    root.evaluate("el => el.shadowRoot.getElementById('speed').value='750'")
    root.evaluate("el => el.shadowRoot.getElementById('auto').click()")
    page.wait_for_timeout(1900)
    progressing=state()
    print('auto progressing', progressing)
    assert progressing['stopVisible'] and progressing['top']>0
    root.evaluate("el => el.shadowRoot.getElementById('stop').click()")
    halted=state()
    assert halted['autoVisible'] and not halted['stopVisible']
    prior=halted['top'];page.wait_for_timeout(1300)
    assert abs(state()['top']-prior)<3, 'scroll did not stop'
    # Automated crawl completes at the actual end without endless looping.
    root.evaluate("el => el.shadowRoot.getElementById('auto').click()")
    page.wait_for_function("document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('auto').hidden===false",timeout=24000)
    finished=state()
    print('auto finished',finished)
    scroller=page.locator('#scrollarea')
    scrollinfo=scroller.evaluate('el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight})')
    print('scroll bounds',scrollinfo)
    assert finished['autoVisible'] and finished['badges']==10 and finished['duplicate']==0
    assert scrollinfo['max']-scrollinfo['top']<5
    # Clicking the result location doesn't perform a purchase.
    root.evaluate("el=>el.shadowRoot.querySelector('.product .copy').click()")
    page.wait_for_timeout(600)
    assert page.url=='about:blank'
    page.screenshot(path=str(p/'test/demo_v04.png'), full_page=True)
    print('new features test passed')
    browser.close()
