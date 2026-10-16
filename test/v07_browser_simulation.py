from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re,base64
home=Path(__file__).resolve().parent.parent/'extension'
html=re.sub(r'<script[^>]+></script>','',(home/'test/demo.html').read_text())
js=(home/'test/demo.js').read_text()
photos=[base64.b64encode((home/'test/images'/f'product_{i:02d}.jpg').read_bytes()).decode() for i in range(1,93)]
js=js.replace('img.src=`images/product_${String((i%thumbnailCount)+1).padStart(2,\'0\')}.jpg`;', 'img.src="data:image/jpeg;base64,"+IMGS[i%thumbnailCount];')
js='const IMGS='+json.dumps(photos)+';\n'+js
source=(home/'content.js').read_text();original="location.protocol === 'chrome-extension:' &&\n    location.pathname === '/test/demo.html'"; assert original in source
source=source.replace(original,"document.documentElement.dataset.demoPage === 'true'")
def mkstore(store):
 return '''window.__mockStore = '''+json.dumps(store)+''';
for (const [prop,key] of [['sessionStorage','session'],['localStorage','local']]) {
const items=window.__mockStore[key];
Object.defineProperty(window,prop,{configurable:true,value:{getItem:k=>items[k]??null,setItem:(k,v)=>items[k]=String(v),removeItem:k=>delete items[k]}});
}'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def run(stage_store):
  page=browser.new_page(viewport={'width':1536,'height':1000})
  page.set_content(html)
  page.evaluate(mkstore(stage_store))
  page.add_script_tag(content=js)
  page.add_script_tag(path=str(home/'scoring.js'))
  page.add_script_tag(content=source)
  page.wait_for_timeout(400)
  return page
 page=run({'session':{},'local':{}})
 assert page.locator('#intro').is_visible()
 page.locator('#view').click()
 sh=lambda x:page.locator('#vine-helper-extension-root').evaluate('el=>'+x)
 sh("el.shadowRoot.getElementById('launch').click()")
 summary=lambda:sh("el.shadowRoot.getElementById('summary').textContent")
 print('FIRST',summary())
 assert '신청 가능 12' in summary()
 sh("el.shadowRoot.getElementById('speed').value='750'")
 sh("el.shadowRoot.getElementById('auto').click()")
 page.wait_for_function("document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('auto').hidden === false",timeout=60000)
 page.wait_for_timeout(1100)
 print('SCROLLED',summary())
 assert '목록 92개' in summary()
 assert '모두 소진 21' in summary()
 assert page.locator('.product-row.soldout').count()==21
 assert '노트북' in sh("el.shadowRoot.getElementById('leaderName').textContent")
 assert '모두 소진' not in ''.join(sh("[...el.shadowRoot.querySelectorAll('#results .stock')].map(el=>el.textContent)"))
 page.evaluate('document.scrollingElement.scrollTop=0');page.wait_for_timeout(250)
 page.screenshot(path=str(home.parent/'demo_preview.png'),full_page=False)
 page.locator('#prepare').click()
 assert 'F5' in page.locator('#help').inner_text()
 store=page.evaluate('window.__mockStore');print('STORAGE',len(store['local'].get('vineHelperStockV07','')))
 assert len(store['local'].get('vineHelperStockV07',''))>5000
 page.close()
 page=run(store)
 assert not page.locator('#intro').is_visible(),'Intro should remember dismissal'
 assert page.locator('.product-row').first.locator('.stock-text').inner_text()=='모두 소진'
 sh=lambda x:page.locator('#vine-helper-extension-root').evaluate('el=>'+x)
 sh("el.shadowRoot.getElementById('launch').click()")
 page.wait_for_timeout(450)
 text=sh("el.shadowRoot.getElementById('changes').textContent")
 print('CHANGED',text[:400])
 assert '1개 남음 → 모두 소진' in text
 assert not sh("el.shadowRoot.getElementById('changes').hidden")
 assert not sh("el.shadowRoot.getElementById('leaderName').textContent").startswith('해커리아')
 page.screenshot(path=str(home.parent/'stock_change_preview.png'),full_page=False)
 page.close();browser.close()
print('TEST PASS')
