from pathlib import Path
from playwright.sync_api import sync_playwright
import time
p=Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':950})
    page.set_content((p/'test/demo.html').read_text(encoding='utf-8'))
    page.add_script_tag(path=str(p/'extension/scoring.js'))
    page.add_script_tag(path=str(p/'extension/content.js'))
    root=page.locator('#vine-helper-extension-root')
    page.locator('#vine-helper-extension-root').evaluate("el => el.shadowRoot.getElementById('launch').click()")
    page.wait_for_timeout(700)
    data=page.locator('#vine-helper-extension-root').evaluate("el => ({summary: el.shadowRoot.getElementById('summary').textContent, rank: [...el.shadowRoot.querySelectorAll('.product .name')].map(x=>x.textContent), visible: !el.shadowRoot.getElementById('panel').hidden})")
    print('초기:',data)
    assert data['visible']
    assert len(data['rank']) == 3, data
    assert data['rank'][0] == '삼성 노트북 15인치', data
    page.click('#add')
    page.wait_for_timeout(700)
    after=page.locator('#vine-helper-extension-root').evaluate("el => ({summary: el.shadowRoot.getElementById('summary').textContent, rank: [...el.shadowRoot.querySelectorAll('.product .name')].map(x=>x.textContent)})")
    print('추가 후:',after)
    assert len(after['rank']) == 4
    page.locator('#vine-helper-extension-root').evaluate("el => el.shadowRoot.getElementById('options').click()")
    page.locator('#vine-helper-extension-root').evaluate("el => {el.shadowRoot.getElementById('excludeKeywords').value += ', 모니터'; el.shadowRoot.getElementById('save').click()}")
    filtered=page.locator('#vine-helper-extension-root').evaluate("el => [...el.shadowRoot.querySelectorAll('.product .name')].map(x=>x.textContent)")
    assert not any('모니터' in x for x in filtered)
    page.screenshot(path=str(p/'test/demo_preview.png'), full_page=True)
    print('설정 후:',filtered)
    browser.close()
