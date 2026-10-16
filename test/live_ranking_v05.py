"""쿠팡 접속 없이 실시간 점수 재계산, 자동 스크롤, 카드 마커 동기화 검증."""
from pathlib import Path
from playwright.sync_api import sync_playwright

home=Path(__file__).resolve().parent.parent
source=(home/'extension/content.js').read_text(encoding='utf-8')
check="location.hostname === 'my.coupang.com' &&\n    location.pathname.replace(/\\/$/, '') === VINE_PATH"
assert check in source
source=source.replace(check, "document.documentElement.dataset.mockVine === 'yes'")

# 원래 DOM에 4개. 이동 후 상품 1개가 뒤늦게 붙는 지연 로딩 재현.
html='''<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial} #list{width:690px;height:300px;overflow-y:auto;border:1px solid #888}
.product-card{height:230px;border-bottom:1px solid gray;box-sizing:border-box;padding:20px;position:relative}
</style></head><body><div id="list">
<div class="product-card"><a href="https://www.coupang.com/vp/products/81001"><span class="product-name">생활용품 다용도 걸이</span></a><div class="product-price">30,000원</div></div>
<div class="product-card"><a href="https://www.coupang.com/vp/products/81002"><span class="product-name">크리스마스 장식 선물 세트</span></a><div class="product-price">25,000원</div></div>
<div class="product-card"><a href="https://www.coupang.com/vp/products/81003"><span class="product-name">주방용 라텍스 수세미</span></a><div class="product-price">20,000원</div></div>
<div class="product-card"><a href="https://www.coupang.com/vp/products/81004"><span class="product-name">버튼형 벽걸이 시계</span></a><div class="product-price">40,000원</div></div>
</div><script>
const sc=document.getElementById('list');
sc.addEventListener('scroll', () => {
 if(sc.scrollTop>=175 && !document.getElementById('fresh')) {
  const d=document.createElement('div'); d.id='fresh'; d.className='product-card';
  d.innerHTML='<a href="https://www.coupang.com/vp/products/81005"><span class="product-name">LG 최고급 노트북 체험단</span></a><div class="product-price">1,900,000원</div>';
  sc.appendChild(d);
 }
});
</script></body></html>'''

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1380,'height':950})
    page.set_content(html)
    page.evaluate("document.documentElement.dataset.mockVine='yes'")
    page.add_script_tag(path=str(home/'extension/scoring.js'))
    page.add_script_tag(content=source)
    sh=lambda code: page.locator('#vine-helper-extension-root').evaluate('el => '+code)
    sh("el.shadowRoot.getElementById('launch').click()")
    def leader(): return sh("el.shadowRoot.getElementById('leaderName').textContent")
    def summary(): return sh("el.shadowRoot.getElementById('summary').textContent")
    assert '4개' in summary(),summary()
    assert '노트북' not in leader(),leader()
    # 사용자 수동 스크롤 이벤트 시에도 즉시(0.12~0.3초) 갱신
    page.eval_on_selector('#list', 'el => el.scrollTop=260')
    page.wait_for_function("document.querySelector('#vine-helper-extension-root').shadowRoot.getElementById('leaderName').textContent.includes('노트북')",timeout=2400)
    assert '5개' in summary(),summary()
    assert '추천 1위' in page.locator('#fresh .vine-helper-inline-recommendation').inner_text()
    assert page.locator('.vine-helper-inline-recommendation').count() == 5
    assert page.locator('.vine-helper-inline-recommendation').count() == page.locator('.vine-helper-recommended-card').count()
    assert sh("el.shadowRoot.getElementById('leader').classList.contains('changed')")
    page.wait_for_timeout(650)
    assert page.locator('.vine-helper-inline-recommendation').count()==5,'badge duplication due to observer'
    # 자동 스크롤 신규 데이터에 대해서도 동일하게 동기화되고 멈출 수 있어야 함.
    sh("el.shadowRoot.getElementById('clear').click()")
    assert '5개' in summary()
    sh("el.shadowRoot.getElementById('auto').click()")
    page.wait_for_timeout(850)
    assert sh("el.shadowRoot.getElementById('stop').hidden") is False
    sh("el.shadowRoot.getElementById('stop').click()")
    assert sh("el.shadowRoot.getElementById('auto').hidden") is False
    assert '노트북' in leader()
    assert page.locator('#fresh .vine-helper-inline-recommendation').count()==1
    print('LIVE UPDATE TEST PASSED:',summary(),'|',leader())
    browser.close()
