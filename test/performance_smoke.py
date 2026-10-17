"""Offline performance sanity check; does not access Coupang."""
from pathlib import Path
from playwright.sync_api import sync_playwright
B=Path(__file__).resolve().parents[1]/'extension'
scoring=(B/'scoring.js').read_text(encoding='utf-8')
content=(B/'content.js').read_text(encoding='utf-8')
# Disable hostname gate in local fixture only.
start=content.index('  const isVineProductPage = () =>')
end=content.index('\n',content.index('VINE_PATH);',start))+1
content=content[:start]+'  const isVineProductPage = () => true;\n'+content[end:]
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1100,'height':750})
  page.set_content('<body><div id="items"></div></body>')
  page.add_script_tag(content=scoring)
  page.add_script_tag(content=content)
  page.evaluate('''() => document.getElementById('vine-helper-extension-root').shadowRoot.getElementById('launch').click()''')
  result=page.evaluate('''async () => {
     const target=document.getElementById('items');
     const cards=Array.from({length:220}, (_,i)=>`<article style="min-height:100px"><img src="data:," width="30" height="30"><div class="product-name">실험용 상품 ${i} 생활 가전 모니터</div><div>100,000원</div><span>${i % 10 ? '2개 남음' : '모두 소진'}</span></article>`).join('');
     const t0=performance.now();target.innerHTML=cards;
     return await new Promise(resolve=>{const id=setInterval(()=>{
       const root=document.getElementById('vine-helper-extension-root').shadowRoot;
       const summary=root.getElementById('summary').textContent;
       if(summary.includes('220개')) {clearInterval(id);resolve({elapsedMs:Math.round(performance.now()-t0),summary})}
       else if(performance.now()-t0>5500){clearInterval(id);resolve({elapsedMs:-1,summary})}
     },15)});
  }''')
  print('PERF',result)
  assert result['elapsedMs']>=0, result
  browser.close()