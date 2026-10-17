"""Offline Playwright tests: stock visibility, bottom detection, cooldown and OFF.
No requests to Coupang. location.reload is replaced with a local spy.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parents[1] / 'extension'
SCORE = (BASE/'scoring.js').read_text(encoding='utf-8')
SOURCE = (BASE/'content.js').read_text(encoding='utf-8')

BOOT = '''() => {window.__refreshCalls=[];window.__store={};window.chrome={storage:{local:{get(k,cb){cb({[k]:window.__store[k]??null});},set(obj,cb){Object.assign(window.__store,obj);cb?.();}}}};}'''

def test_js(mode):
    content = SOURCE
    begin = content.index('  const isReviewTestPage = () =>')
    end = content.index('\n', content.index('REVIEW_PATH;', begin))+1
    content = content[:begin] + f"  const isReviewTestPage = () => {str(mode=='review').lower()};\n" + content[end:]
    if mode=='vine':
        begin=content.index('  const isVineProductPage = () =>')
        end=content.index('\n',content.index('VINE_PATH);',begin))+1
        content=content[:begin]+"  const isVineProductPage = () => true;\n"+content[end:]
    content=content.replace('location.reload();','window.__refreshCalls.push(Date.now());')
    assert content.count('window.__refreshCalls.push')==1
    return content

REVIEW_HTML='''<!doctype html><html lang="ko"><meta charset="utf-8"><body><article>
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E" width="100" height="100">
<div class="product-name">삼성 노트북 충전기</div><button>리뷰 작성하기</button></article></body>'''
VINE_HTML='''<!doctype html><html lang="ko"><meta charset="utf-8"><body style="margin:0">
<article style="height:180px"><img width="65" height="65" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E">
<div class="product-name">모니터 노트북 거치대</div><p>120,000원</p><span>20개 남음</span></article>
<div style="height:600px"></div>
<article id="soldout" style="height:250px"><img width="65" height="65" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E">
<div class="product-name">대형 TV 초특가</div><p>650,000원</p><span>모두 소진</span></article>
<div style="height:1900px"></div></body>'''

def setup(browser,mode='review',settings=None):
    page=browser.new_page(viewport={'width':1000,'height':720})
    page.clock.install()
    page.set_content(REVIEW_HTML if mode=='review' else VINE_HTML)
    page.evaluate(BOOT)
    setting_key='review' if mode=='review' else 'auto'
    defaults={
        'reviewAutoRefreshEnabled':mode=='review',
        'reviewRefreshIntervalSeconds':5,
        'autoRefreshEnabled':mode=='vine',
        'refreshIntervalSeconds':5,
    }
    defaults.update(settings or {})
    page.evaluate('(x) => {window.__store.vineHelperSettingsV1=x;}',defaults)
    page.add_script_tag(content=SCORE)
    page.add_script_tag(content=test_js(mode))
    page.evaluate("() => document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('launch').click()")
    return page

def get(page, id, prop='textContent'):
    return page.evaluate('(x) => document.getElementById("vine-helper-extension-root").shadowRoot.getElementById(x.id)[x.prop]',{'id':id,'prop':prop})

def click(page,id):
    page.evaluate('(id) => document.getElementById("vine-helper-extension-root").shadowRoot.getElementById(id).click()',id)

def calls(page):
    return page.evaluate('() => window.__refreshCalls.length')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=setup(browser,'review')
    opts=page.evaluate('() => [...document.getElementById("vine-helper-extension-root").shadowRoot.getElementById("refreshInterval").options].map(o=>Number(o.value))')
    assert opts==[5,10,15,20,30],opts
    click(page,'auto')
    page.clock.run_for(4800)
    assert calls(page)==0, ('early review refresh',calls(page))
    page.clock.run_for(1300)
    assert calls(page)==1, ('bottom should refresh after minimum guard',calls(page))
    assert '목록 끝' in get(page,'scrollStatus'),get(page,'scrollStatus')
    print('PASS review: 5..30 seconds, bottom trigger, >=5 sec guard')
    page.close()

    page=setup(browser,'vine')
    click(page,'auto')
    page.clock.run_for(1800)
    assert calls(page)==0
    assert '품절 상품 발견' in get(page,'scrollStatus'),get(page,'scrollStatus')
    page.clock.run_for(3500)
    assert calls(page)==1, ('soldout should refresh after minimum guard',calls(page))
    print('PASS vine: newly visible sold-out card triggers refresh')
    page.close()

    page=setup(browser,'review',{'reviewAutoRefreshEnabled':False})
    click(page,'auto')
    page.clock.run_for(9000)
    assert calls(page)==0
    assert '분석 완료' in get(page,'scrollStatus')
    print('PASS OFF: reaching bottom never refreshes')
    page.close()

    page=setup(browser,'vine')
    click(page,'auto')
    page.clock.run_for(1600)
    assert calls(page)==0
    page.evaluate('''() => {const el=document.getElementById("vine-helper-extension-root").shadowRoot.getElementById("refreshEnabled"); el.checked=false;el.dispatchEvent(new Event("change"));}''')
    page.clock.run_for(7500)
    assert calls(page)==0
    print('PASS OFF during pending cooldown cancels the refresh')
    page.close()

    page=setup(browser,'review')
    click(page,'auto')
    page.evaluate('''() => {const ta=document.createElement('textarea');ta.value='미완료 리뷰';document.body.append(ta);ta.dispatchEvent(new Event('input',{bubbles:true}));}''')
    page.clock.run_for(8000)
    assert calls(page)==0
    print('PASS review editor protection')
    page.close()
    browser.close()
print('All conditional refresh tests passed.')