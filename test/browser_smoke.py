from pathlib import Path
from playwright.sync_api import sync_playwright

p = Path(__file__).resolve().parent.parent
script = (p / 'extension/content.js').read_text(encoding='utf-8')
# 브라우저 보안상 실제 coupang.com에 접속하지 않는다.
# 테스트용 페이지 표시만 해당 함수에 주입하고 실제 배포 파일은 변경하지 않는다.
original = "location.hostname === 'my.coupang.com' &&\n    location.pathname.replace(/\\/$/, '') === VINE_PATH"
assert original in script
mock_script = script.replace(original, "document.documentElement.dataset.mockVine === 'yes'")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    demo_html = (p / 'test/demo.html').read_text(encoding='utf-8')
    wrong_html = '<html><body><h1>리뷰 작성 목록</h1>' + ''.join(
        '<div class="product-card"><a href="https://www.coupang.com/vp/products/%d"><span class="product-name">졸지마 찌릿찌릿 캔디</span></a><span class="product-price">22,900원</span></div>' % i
        for i in range(5)) + '</body></html>'
    empty_html = '<html><body><h1>쿠팡체험단</h1><div>쿠팡체험단 상품이 없습니다.</div><a href="https://www.coupang.com/vp/products/123">무관한 광고 링크</a></body></html>'

    def load(doc, is_vine=True):
        page = browser.new_page(viewport={'width':1440,'height':950})
        page.set_content(doc)
        page.evaluate("flag => document.documentElement.dataset.mockVine = flag", 'yes' if is_vine else 'no')
        page.add_script_tag(path=str(p/'extension/scoring.js'))
        page.add_script_tag(content=mock_script)
        root = page.locator('#vine-helper-extension-root')
        root.evaluate("el => el.shadowRoot.getElementById('launch').click()")
        page.wait_for_timeout(550)
        return page, root

    def info(root):
        return root.evaluate("""el => ({summary: el.shadowRoot.getElementById('summary').textContent,
           names: [...el.shadowRoot.querySelectorAll('.product .name')].map(x=>x.textContent),
           empty: el.shadowRoot.querySelector('.empty')?.textContent || '',
           visible: !el.shadowRoot.getElementById('panel').hidden})""")

    page, root = load(demo_html)
    result = info(root)
    print('체험단 화면 (가상 데이터):', result)
    assert result['visible'] and len(result['names']) == 3
    assert result['names'][0] == '삼성 노트북 15인치'
    page.click('#add')
    page.wait_for_timeout(700)
    result = info(root)
    print('상품 추가:', result)
    assert len(result['names']) == 4
    root.evaluate("el => el.shadowRoot.getElementById('options').click()")
    root.evaluate("el => {el.shadowRoot.getElementById('excludeKeywords').value += ', 모니터'; el.shadowRoot.getElementById('save').click()}")
    result = info(root)
    assert not any('모니터' in name for name in result['names'])
    print('제외 키워드:', result)
    page.screenshot(path=str(p/'test/demo_preview.png'), full_page=True)
    page.close()

    page, root = load(wrong_html, is_vine=False)
    result = info(root)
    print('리뷰 작성 화면 차단:', result)
    assert not result['names'] and '리뷰 작성' in result['empty']
    page.close()

    page, root = load(empty_html, is_vine=True)
    result = info(root)
    print('빈 체험단 화면:', result)
    assert not result['names'] and '상품이 없습니다' in result['empty']
    page.close()
    browser.close()
    print('브라우저 테스트 전체 통과')
