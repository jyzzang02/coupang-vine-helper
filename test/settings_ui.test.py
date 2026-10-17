"""Browser-only regression for separate settings and TOP 10 colors (no Coupang requests)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1] / 'extension'
src=(root/'content.js').read_text('utf-8')
scores=(root/'scoring.js').read_text('utf-8')
start=src.index("  const isVineProductPage = () =>")
end=src.index("VINE_PATH);",start)+len("VINE_PATH);")
src=src[:start]+"  const isVineProductPage = () => true;"+src[end:]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':720})
    page.set_content('<!doctype html><html><body><div id="items"></div></body></html>')
    page.evaluate("""() => {
      document.getElementById('items').innerHTML=Array.from({length:15},(_,i)=>'<article style="height:100px"><img width="65" height="65" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="><span>노트북 '+i+'</span><span>29000원</span><span>5개 남음</span></article>').join('');
      const x={}; window.__settingsData=x; window.chrome={storage:{local:{get:(k,cb)=>cb({[k]:x[k]}),set:(v,cb)=>{Object.assign(x,v);cb?.()}}}};
    }""")
    page.add_script_tag(content=scores)
    page.add_script_tag(content=src)
    def ui(expression):
        return page.evaluate("""(code) => {const s=document.querySelector('#vine-helper-extension-root').shadowRoot;return (new Function('s',code))(s)}""",expression)
    ui("s.getElementById('launch').click()")
    page.wait_for_timeout(200)
    assert ui("return s.querySelectorAll('#results .product').length")==10
    colors=ui("return [...s.querySelectorAll('#results .rank')].map(x=>getComputedStyle(x).backgroundColor)")
    assert colors==['rgb(198, 40, 40)']*3+['rgb(255, 216, 61)']*2+['rgb(23, 97, 194)']*5,colors
    ui("s.getElementById('options').click()")
    assert ui("return s.getElementById('mainView').hidden && !s.getElementById('settings').hidden")
    assert ui("return s.querySelectorAll('.categoryRow').length")>=4
    ui("s.getElementById('addCategory').click()")
    assert ui("return s.querySelectorAll('.categoryRow').length")>=5
    ui("s.getElementById('minPrice').value=50000;s.getElementById('maxPrice').value=10000;s.getElementById('save').click()")
    assert ui("return !s.getElementById('settingsError').hidden")
    ui("s.getElementById('maxPrice').value=0;s.getElementById('save').click()")
    assert ui("return s.getElementById('settings').hidden && !s.getElementById('mainView').hidden")
    b.close()
print('PASS: 1-3 red, 4-5 yellow, 6-10 blue; independent settings; category edit; price validation')
