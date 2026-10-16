/* 사용자가 이미 연 쿠팡 웹화면의 DOM만 읽는다. 페이지 이동/클릭/HTTP 요청 없음. */
(() => {
  'use strict';
  if (window.__vineHelperLoaded) return;
  window.__vineHelperLoaded = true;

  const scoring = window.VineScoring;
  if (!scoring) return;
  const STORAGE_KEY = 'vineHelperSettingsV1';
  let settings = { ...scoring.DEFAULT_SETTINGS };
  let visible = false;
  let observedCount = 0;
  let ranked = [];
  let observer;
  let scanTimer;
  let settingsOpen = false;
  const host = document.createElement('div');
  host.id = 'vine-helper-extension-root';
  host.style.cssText = 'position:fixed!important;z-index:2147483646!important;right:20px;bottom:18px;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
  :host{all:initial} [hidden]{display:none!important} *,*::before,*::after{box-sizing:border-box}
  .launcher,.panel{pointer-events:auto;font-family:'Malgun Gothic',Arial,sans-serif;color:#172237;font-size:13px}
  button,input,textarea{font-family:inherit} button{cursor:pointer}
  .launcher{float:right;border:0;border-radius:40px;padding:12px 17px;background:#1450a8;color:white;font-weight:700;box-shadow:0 4px 18px #0003}
  .panel{width:min(470px,calc(100vw - 24px));max-height:min(82vh,740px);display:flex;flex-direction:column;background:#fff;border:1px solid #d8e1ee;box-shadow:0 8px 35px #14243b44;border-radius:14px;overflow:hidden}
  .top{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid #e8edf3}
  h2{margin:0;font-size:15px;line-height:1.5} .small{font-size:11px;color:#66758a}
  .toolbar{padding:11px 13px;display:flex;flex-wrap:wrap;align-items:center;gap:7px}
  .btn{padding:7px 10px;background:#f2f5fa;border:1px solid #dce3ec;color:#223247;border-radius:7px;font-size:12px}
  .btn.primary{background:#1761c2;border-color:#1761c2;color:white;font-weight:700}
  .results{overflow:auto;flex:1;min-height:85px;max-height:390px;padding:3px 13px 14px}
  .product{border-bottom:1px solid #eff1f5;padding:9px 0;display:flex;gap:10px;align-items:start}
  .rank{flex:0 0 33px;text-align:center;font-weight:800;color:#1761c2;font-size:14px}
  .info{flex:1;min-width:0}.name{font-weight:700;word-break:break-all;line-height:1.5}
  .meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:5px;font-size:12px}.price{color:#d14b20;font-weight:700}
  .pill{font-size:10px;background:#e9f1ff;color:#1a5ab3;border-radius:6px;padding:2px 5px}
  .reason{color:#69788f;font-size:11px;margin-top:4px;line-height:1.5}
  .copy{font-size:11px;align-self:center;padding:5px 7px;border:1px solid #d6deea;background:white;border-radius:6px}
  .settings{padding:10px 13px;border-top:1px solid #e8edf3;overflow:auto;max-height:360px;background:#f8fafc}
  .field{margin:0 0 10px}.field label{display:block;font-weight:700;font-size:12px;margin-bottom:4px}
  .field textarea,.field input[type=number]{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;font-size:12px;background:white;color:#182436}
  .field textarea{resize:vertical;min-height:44px;line-height:1.5}
  .double{display:flex;gap:8px}.double .field{flex:1;min-width:0}
  .range{display:flex;align-items:center;gap:8px}.range input{flex:1}.range span{width:25px;text-align:right}
  .foot{padding:8px 13px;border-top:1px solid #edf1f6;color:#66758a;font-size:11px;background:#f8fafc}
  .empty{padding:25px 0;text-align:center;color:#6d788a;line-height:1.7}
  </style>
  <button id="launch" class="launcher">🔎 상품 분석</button>
  <div id="panel" class="panel" hidden>
    <div class="top"><div><h2>체험단 상품 우선순위</h2><div class="small" id="summary">화면에 표시된 상품만 분석</div></div><button class="btn" id="close">닫기 ×</button></div>
    <div class="toolbar"><button class="btn primary" id="scan">다시 스캔</button><button class="btn" id="options">⚙ 가중치 설정</button><button class="btn" id="export">CSV 저장</button></div>
    <div id="results" class="results"><div class="empty">상품을 분석하려면 '다시 스캔'을 누르세요.</div></div>
    <div id="settings" class="settings" hidden>
      <div class="field"><label>최우선 키워드 (포함 시 일반 상품보다 우선)</label><textarea id="priorityKeywords" rows="2"></textarea></div>
      <div class="field"><label>선호 키워드 (추가 점수)</label><textarea id="preferredKeywords" rows="2"></textarea></div>
      <div class="field"><label>제외 키워드 (결과에서 완전히 숨김)</label><textarea id="excludeKeywords" rows="2"></textarea></div>
      <div class="field"><label>카테고리별 선호도 (키워드,키워드:0~100)</label><textarea id="categoryRules" rows="4"></textarea></div>
      <div class="field"><label>가격 가중치</label><div class="range"><input id="priceWeight" type="range" min="0" max="100"><span id="priceWeightView"></span></div></div>
      <div class="field"><label>선호 키워드 가중치</label><div class="range"><input id="keywordWeight" type="range" min="0" max="100"><span id="keywordWeightView"></span></div></div>
      <div class="field"><label>카테고리 가중치</label><div class="range"><input id="categoryWeight" type="range" min="0" max="100"><span id="categoryWeightView"></span></div></div>
      <div class="double"><div class="field"><label>가격 점수 만점 기준(원)</label><input id="preferredPrice" type="number" min="1000" step="10000"></div><div class="field"><label>최저 가격 필터(원)</label><input id="minPrice" type="number" min="0" step="10000"></div></div>
      <div class="double"><div class="field"><label>최고 가격 필터(원, 0=제한 없음)</label><input id="maxPrice" type="number" min="0" step="10000"></div><div class="field"><label style="margin-top:21px"><input id="hideUnavailable" type="checkbox"> 품절/마감 상품 제외</label></div></div>
      <button id="save" class="btn primary">설정 저장하고 다시 계산</button> <button id="reset" class="btn">기본값으로 초기화</button>
    </div>
    <div class="foot" id="foot">신청·구매·페이지 새로고침 없음 · 화면을 스크롤하면 재분석</div>
  </div>`;
  document.documentElement.appendChild(host);

  const $ = id => shadow.getElementById(id);
  const setVisible = open => {
    visible = open;
    $('panel').hidden = !open;
    $('launch').hidden = open;
    if (open) scan();
  };
  $('launch').addEventListener('click', () => setVisible(true));
  $('close').addEventListener('click', () => setVisible(false));
  $('scan').addEventListener('click', scan);
  $('options').addEventListener('click', () => {
    settingsOpen = !settingsOpen;
    $('settings').hidden = !settingsOpen;
    if (settingsOpen) fillSettings();
  });
  $('save').addEventListener('click', saveSettings);
  $('reset').addEventListener('click', () => { settings = { ...scoring.DEFAULT_SETTINGS }; fillSettings(); saveSettings(); });
  $('export').addEventListener('click', exportCsv);
  for (const id of ['priceWeight', 'keywordWeight', 'categoryWeight']) {
    $(id).addEventListener('input', () => { $(id + 'View').textContent = $(id).value; });
  }

  // Browser extension storage only. The test page uses in-memory defaults.
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(STORAGE_KEY, data => {
        const saved = data && data[STORAGE_KEY];
        if (saved && typeof saved === 'object') settings = { ...settings, ...saved };
        if (settingsOpen) fillSettings();
        if (visible) scan();
      });
    }
  } catch (_) { /* demo without extension API */ }

  function fillSettings() {
    for (const id of ['priorityKeywords','preferredKeywords','excludeKeywords','categoryRules',
                      'priceWeight','keywordWeight','categoryWeight','preferredPrice','minPrice','maxPrice']) {
      $(id).value = settings[id];
    }
    $('hideUnavailable').checked = Boolean(settings.hideUnavailable);
    for (const id of ['priceWeight','keywordWeight','categoryWeight']) $(id + 'View').textContent = settings[id];
  }
  function saveSettings() {
    const fields = ['priorityKeywords','preferredKeywords','excludeKeywords','categoryRules'];
    const numbers = ['priceWeight','keywordWeight','categoryWeight','preferredPrice','minPrice','maxPrice'];
    for (const id of fields) settings[id] = $(id).value;
    for (const id of numbers) settings[id] = Math.max(0, Number($(id).value) || 0);
    settings.hideUnavailable = $('hideUnavailable').checked;
    try { if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({ [STORAGE_KEY]: settings }); } catch (_) { }
    settingsOpen = false;
    $('settings').hidden = true;
    scan();
  }

  const priceRe = /(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?/g;
  const priceWithWon = /(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원/g;
  function findPrice(node, text) {
    const candidates = [];
    const selectors = ['[class*="price"]','[class*="Price"]','[data-price]'];
    for (const selector of selectors) {
      const els = node.querySelectorAll(selector);
      for (const el of Array.from(els).slice(0, 8)) {
        const line = el.getAttribute('data-price') || el.textContent || '';
        const matched = [...line.matchAll(priceRe)].map(m => Number(m[1].replaceAll(',', '')));
        candidates.push(...matched.filter(p => p >= 100 && p <= 100000000));
      }
    }
    if (candidates.length) return Math.max(...candidates);
    const matches = [...text.matchAll(priceWithWon)].map(m => Number(m[1].replaceAll(',', '')));
    return matches.length ? Math.max(...matches) : 0;
  }
  function cleanName(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.replace(/(?:₩\s*)?\d{1,3}(?:,\d{3})+\s*원.*$/,'').replace(/\s+(?:마감|신청 완료|품절).*$/,'').trim().slice(0, 130);
  }
  function findTitle(node, anchor, fallbackText) {
    const targetSelectors = '[class*="product-name"],[class*="productName"],[class*="product-title"],[class*="productTitle"],[class*="item-name"],[class*="itemName"],[class*="title"],[class*="name"]';
    for (const el of Array.from(node.querySelectorAll(targetSelectors)).slice(0, 16)) {
      if (el.closest('button')) continue;
      const candidate = cleanName(el.textContent);
      if (candidate.length >= 5 && candidate.length <= 130 && !/^\d+[\d,]*원?$/.test(candidate)) return candidate;
    }
    const img = anchor?.querySelector('img[alt]') || node.querySelector('img[alt]');
    const imgAlt = cleanName(img?.alt);
    if (imgAlt.length >= 5 && !/^(product|image|상품 이미지)$/i.test(imgAlt)) return imgAlt;
    const anchorText = cleanName(anchor?.innerText || anchor?.textContent || '');
    if (anchorText.length >= 5) return anchorText;
    return cleanName(fallbackText.split(/\n/)[0]);
  }
  function isShown(node) {
    if (!node || !node.isConnected || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }
  function findCard(anchor) {
    const list = [];
    let node = anchor;
    for (let depth = 0; node && depth <= 5; node = node.parentElement, depth++) {
      if (node === document.body || node === document.documentElement || node === host) break;
      const text = node.innerText || '';
      if (text.length < 15 || text.length > 750) continue;
      if (node.querySelectorAll('a[href*="/products/"]').length > 4) continue;
      list.push({ node, text });
    }
    const candidate = list.find(x => priceWithWon.test(x.text));
    priceWithWon.lastIndex = 0;
    return candidate || list.at(0) || { node: anchor, text: anchor.innerText || '' };
  }
  function extractProducts() {
    const found = new Map();
    const candidates = Array.from(document.querySelectorAll('a[href*="/products/"]'));
    for (const anchor of candidates.slice(0, 2000)) {
      if (host.contains(anchor) || !isShown(anchor)) continue;
      const { node, text } = findCard(anchor);
      const name = findTitle(node, anchor, text);
      if (name.length < 5 || /^(더보기|장바구니|전체메뉴|구매하기|상품 상세 보기)$/.test(name)) continue;
      const url = anchor.href || '';
      const price = findPrice(node, text);
      const unavailable = /(신청\s*완료|신청\s*마감|일시\s*품절|품절|쿠폰\s*마감)/.test(text);
      const idMatch = url.match(/\/products\/(\d+)/);
      const key = idMatch ? 'product:' + idMatch[1] : 'name:' + name.toLowerCase();
      const entry = { name, price, unavailable, url };
      const previous = found.get(key);
      if (!previous || (previous.name.length < name.length && name.length <= 100) || (!previous.price && price)) found.set(key, entry);
    }
    // 상품 상세 링크가 없는 페이지를 위한 보조 탐지: 화면의 상품 카드만 추정.
    if (found.size < 3) {
      const selector = '[class*="product-item"],[class*="productItem"],[class*="product-card"],[class*="productCard"],[class*="item-card"]';
      for (const node of Array.from(document.querySelectorAll(selector)).slice(0, 500)) {
        if (host.contains(node) || !isShown(node)) continue;
        if (node.querySelectorAll(selector).length) continue;
        const text = node.innerText || '';
        if (text.length < 15 || text.length > 650) continue;
        const anchor = node.querySelector('a[href]');
        const name = findTitle(node, anchor, text);
        const price = findPrice(node, text);
        if (name.length < 5 || (!price && !node.querySelector('img'))) continue;
        const key = 'name:' + name.toLowerCase();
        if (!found.has(key)) found.set(key, {
          name, price, url: anchor?.href || '',
          unavailable: /(신청\s*완료|신청\s*마감|일시\s*품절|품절|쿠폰\s*마감)/.test(text)
        });
      }
    }
    return [...found.values()];
  }
  function mk(tag, attrs, value) {
    const el = document.createElement(tag);
    if (attrs) for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, String(val));
    if (value != null) el.textContent = String(value);
    return el;
  }
  function scan() {
    if (!visible) return;
    const products = extractProducts();
    observedCount = products.length;
    ranked = scoring.rankProducts(products, settings);
    const summary = $('summary');
    summary.textContent = `감지 ${observedCount}개 · 조건 통과 ${ranked.length}개 · 현재 열린 화면 기준`;
    const resultArea = $('results');
    resultArea.replaceChildren();
    if (!ranked.length) {
      resultArea.appendChild(mk('div', { class:'empty' }, observedCount ?
        '상품을 감지했지만 모두 제외 조건에 해당해요. 설정을 확인해 보세요.' :
        '상품을 찾지 못했어요. 체험단 상품 목록에서 직접 스크롤한 후 다시 스캔해 보세요.\nPC 사이트의 실제 상품 구조에 따라 인식 보정이 필요할 수 있어요.'));
      return;
    }
    for (const [index, product] of ranked.slice(0, 100).entries()) {
      const item = mk('div', { class:'product' });
      const rankEl = mk('div', { class:'rank' }, String(index + 1));
      const info = mk('div', { class:'info' });
      const nameEl = mk('div', { class:'name' }, product.name);
      const meta = mk('div', { class:'meta' });
      meta.appendChild(mk('span', { class:'price' }, product.price > 0 ? product.price.toLocaleString('ko-KR') + '원' : '가격 미확인'));
      meta.appendChild(mk('span', { class:'pill' }, product.score + '점'));
      if (product.priority) meta.appendChild(mk('span', { class:'pill' }, '최우선'));
      info.append(nameEl, meta, mk('div', { class:'reason' }, product.reasons.join(' · ') || '기본 기준'));
      const copy = mk('button', { class:'copy', title:'상품명 복사' }, '복사');
      copy.addEventListener('click', () => {
        navigator.clipboard?.writeText(product.name).then(() => { copy.textContent = '완료'; }, () => fallbackCopy(product.name));
      });
      item.append(rankEl, info, copy);
      resultArea.appendChild(item);
    }
    if (ranked.length > 100) resultArea.appendChild(mk('div', { class:'small' }, `상위 100개만 표시 중 (총 ${ranked.length}개)`));
  }
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text; document.body.appendChild(textarea); textarea.select();
    try { document.execCommand('copy'); } finally { textarea.remove(); }
  }
  function exportCsv() {
    if (!ranked.length) return;
    const quote = v => '"' + String(v == null ? '' : v).replaceAll('"', '""') + '"';
    const rows = [['순위','상품명','추정가격(원)','점수','판단근거','링크'],
      ...ranked.map((p,i) => [i+1,p.name,p.price || '',p.score,p.reasons.join(' / '),p.url])];
    const csv = '\ufeff' + rows.map(r => r.map(quote).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = '체험단_우선순위.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function scheduleScan() {
    if (!visible || scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 400);
  }
  observer = new MutationObserver(changes => {
    if (changes.some(change => !host.contains(change.target))) scheduleScan();
  });
  observer.observe(document.body || document.documentElement, {childList:true, subtree:true, characterData:true});
  window.addEventListener('scroll', scheduleScan, { passive:true });
  window.addEventListener('load', scheduleScan, { once:true });
})();
