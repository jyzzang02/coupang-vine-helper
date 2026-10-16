/* 사용자가 이미 연 쿠팡 웹화면의 DOM만 읽는다. 페이지 이동/클릭/HTTP 요청 없음. */
(() => {
  'use strict';
  if (window.__vineHelperLoaded) return;
  window.__vineHelperLoaded = true;

  const scoring = window.VineScoring;
  if (!scoring) return;
  const STORAGE_KEY = 'vineHelperSettingsV1';
  const VINE_PATH = '/productreview/adventurer/productList';
  // 설치된 확장 프로그램 내부의 오프라인 테스트 페이지 외에는 기존 쿠팡 목록만 분석한다.
  const isDemoPage = () => location.protocol === 'chrome-extension:' &&
    location.pathname === '/test/demo.html';
  const isVineProductPage = () => isDemoPage() || (location.hostname === 'my.coupang.com' &&
    location.pathname.replace(/\/$/, '') === VINE_PATH);
  const hasNoProductsNotice = () => /쿠팡체험단\s*상품이\s*없습니다/.test(document.body?.innerText || '');
  let settings = { ...scoring.DEFAULT_SETTINGS };
  let visible = false;
  let observedCount = 0;
  let ranked = [];
  let observer;
  let scanTimer;
  let settingsOpen = false;
  let previousRanking = '';
  let previousLeader = '';
  let rankUpdateCount = 0;
  const productCache = new Map();
  const decoratedCards = new Set();
  let autoTimer = null;
  let autoRunning = false;
  let autoStepCount = 0;
  let autoStalledCount = 0;
  const MAX_SCROLL_STEPS = 80;
  const MARKER_CLASS = 'vine-helper-inline-recommendation';
  const CARD_CLASS = 'vine-helper-recommended-card';
  const highlightCss = document.createElement('style');
  highlightCss.id = 'vine-helper-highlight-style';
  highlightCss.textContent = `
    .${CARD_CLASS} { position:relative!important; outline:2px solid #2774ce!important; outline-offset:-2px!important; }
    .${CARD_CLASS}[data-vine-helper-top="true"] { outline:3px solid #e9a228!important; }
    .${MARKER_CLASS} { position:absolute!important;right:5px!important;top:5px!important;
      display:block!important;width:max-content!important;max-width:90%!important;
      z-index:2147483600!important;background:#1253a6!important;color:#fff!important;
      font:700 12px/1.4 'Malgun Gothic',Arial,sans-serif!important;letter-spacing:0!important;
      padding:5px 8px!important;border-radius:7px!important;box-shadow:0 2px 8px #0003!important;
      pointer-events:none!important;white-space:normal!important;text-align:left!important; }
    .${CARD_CLASS}[data-vine-helper-top="true"] > .${MARKER_CLASS} { background:#9c5a00!important; }
  `;
  (document.head || document.documentElement).appendChild(highlightCss);
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
  .speed{border:1px solid #dce3ec;color:#223247;border-radius:7px;padding:6px;font-size:12px;background:white;cursor:pointer}
  .copy{font-size:11px;align-self:center;padding:5px 7px;border:1px solid #d6deea;background:white;border-radius:6px}
  .settings{padding:10px 13px;border-top:1px solid #e8edf3;overflow:auto;max-height:360px;background:#f8fafc}
  .field{margin:0 0 10px}.field label{display:block;font-weight:700;font-size:12px;margin-bottom:4px}
  .field textarea,.field input[type=number]{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;font-size:12px;background:white;color:#182436}
  .field textarea{resize:vertical;min-height:44px;line-height:1.5}
  .double{display:flex;gap:8px}.double .field{flex:1;min-width:0}
  .range{display:flex;align-items:center;gap:8px}.range input{flex:1}.range span{width:25px;text-align:right}
  .leader{display:flex;align-items:flex-start;gap:6px;border-top:1px solid #ecf1f7;background:#f0f6ff;padding:8px 13px;font-size:12px;line-height:1.5}
  .leader b{color:#1559a8;flex-shrink:0}.leader span{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .leader.changed{background:#fff0d6;transition:background 0.5s ease}
  .foot{padding:8px 13px;border-top:1px solid #edf1f6;color:#66758a;font-size:11px;background:#f8fafc}
  .empty{padding:25px 0;text-align:center;color:#6d788a;line-height:1.7;white-space:pre-line}
  </style>
  <button id="launch" class="launcher">🔎 상품 분석</button>
  <div id="panel" class="panel" hidden>
    <div class="top"><div><h2>체험단 상품 우선순위</h2><div class="small" id="summary">화면에 표시된 상품만 분석</div></div><button class="btn" id="close">닫기 ×</button></div>
    <div class="toolbar"><button class="btn primary" id="scan">다시 스캔</button><button class="btn" id="options">⚙ 가중치 설정</button><button class="btn" id="export">CSV 저장</button><button class="btn" id="clear">누적 초기화</button></div>
    <div class="toolbar" style="padding-top:0"><button class="btn primary" id="auto">↡ 자동 스크롤 시작</button><button class="btn" id="stop" hidden>■ 스크롤 중지</button><label for="speed" class="small">속도</label><select id="speed" class="speed"><option value="1600">천천히</option><option value="1100" selected>보통</option><option value="750">빠르게</option></select><span id="scrollStatus" class="small">수동 시작</span></div>
    <div id="leader" class="leader"><b>현재 추천 1위</b><span id="leaderName">분석 대기 중</span></div>
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
    <div class="foot" id="foot">화면에 표시된 상품만 분석 · 신청/주문 자동화 없음</div>
  </div>`;
  document.documentElement.appendChild(host);

  const $ = id => shadow.getElementById(id);
  const setVisible = open => {
    visible = open;
    $('panel').hidden = !open;
    $('launch').hidden = open;
    if (open) { previousRanking = ''; scan(); }
    else stopAutoScroll('분석 창 닫음');
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
  $('auto').addEventListener('click', startAutoScroll);
  $('stop').addEventListener('click', () => stopAutoScroll('사용자 중지'));
  $('clear').addEventListener('click', () => {
    productCache.clear(); clearHighlights(); previousRanking = ''; previousLeader = '';
    rankUpdateCount = 0; scan();
  });
  window.addEventListener('pagehide', () => stopAutoScroll('페이지 이동'));
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
    previousRanking = '';
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
    // 리뷰 작성 목록 등 다른 페이지에서는 상품을 절대 추출하지 않는다.
    if (!isVineProductPage() || hasNoProductsNotice()) return [];
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
      // 한 상품에 여러 링크가 있더라도 결과에는 한 번만 표시한다.
      const key = 'name:' + name.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
      const entry = { name, price, unavailable, url, card: node };
      const previous = found.get(key);
      if (!previous || (!previous.price && price) || (!previous.url && url)) found.set(key, entry);
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
          name, price, url: anchor?.href || '', card: node,
          unavailable: /(신청\s*완료|신청\s*마감|일시\s*품절|품절|쿠폰\s*마감)/.test(text)
        });
      }
    }
    return [...found.values()];
  }
  // 상품 카드 상단에 보조 프로그램 전용 순위 배지를 삽입한다.
  // 쿠팡 상품이나 신청 버튼을 누르지 않으며, 제외된 상품도 화면에서 숨기지 않는다.
  function clearHighlights() {
    for (const card of decoratedCards) {
      if (card.isConnected) {
        card.classList.remove(CARD_CLASS);
        delete card.dataset.vineHelperTop;
        for (const badge of card.querySelectorAll('.' + MARKER_CLASS)) badge.remove();
      }
    }
    decoratedCards.clear();
  }
  function paintHighlights() {
    const wanted = new Map();
    ranked.slice(0, 10).forEach((product, index) => {
      const card = product.card;
      if (card?.isConnected && !card.contains(host) && !wanted.has(card)) {
        wanted.set(card, {rank:index+1,product});
      }
    });
    for (const card of [...decoratedCards]) {
      if (!card.isConnected || !wanted.has(card)) {
        if (card.isConnected) {
          card.classList.remove(CARD_CLASS);
          delete card.dataset.vineHelperTop;
          card.querySelectorAll('.' + MARKER_CLASS).forEach(x => x.remove());
        }
        decoratedCards.delete(card);
      }
    }
    for (const [card, {rank,product}] of wanted) {
      card.classList.add(CARD_CLASS);
      if (rank <= 3) card.dataset.vineHelperTop = 'true';
      else delete card.dataset.vineHelperTop;
      let badge = [...card.children].find(el => el.classList?.contains(MARKER_CLASS));
      if (!badge) {
        badge = mk('div',{class:MARKER_CLASS});
        card.appendChild(badge);
      }
      const text = `${rank <= 3 ? '★ ' : ''}추천 ${rank}위 · ${product.score}점`;
      if (badge.textContent !== text) badge.textContent = text;
      const description = product.reasons.join(' · ') || '기본 점수';
      if (badge.title !== description) badge.title = description;
      decoratedCards.add(card);
    }
  }

  function getScrollElement() {
    const firstCard = extractProducts().find(p => p.card?.isConnected)?.card;
    if (firstCard) {
      for (let parent = firstCard.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.clientHeight > 240 &&
            parent.scrollHeight > parent.clientHeight + 70) return parent;
      }
    }
    return document.scrollingElement || document.documentElement;
  }
  function stopAutoScroll(reason = '완료') {
    if (autoTimer != null) clearTimeout(autoTimer);
    autoTimer = null;
    autoRunning = false;
    $('auto').hidden = false;
    $('stop').hidden = true;
    $('scrollStatus').textContent = reason;
  }
  function startAutoScroll() {
    if (autoRunning) return;
    if (!isVineProductPage()) {
      $('scrollStatus').textContent = '체험단 페이지에서만 가능';
      return;
    }
    if (hasNoProductsNotice()) {
      scan();
      $('scrollStatus').textContent = '상품이 아직 없음';
      return;
    }
    autoRunning = true;
    autoStepCount = 0;
    autoStalledCount = 0;
    $('auto').hidden = true;
    $('stop').hidden = false;
    const scroller = getScrollElement();
    scroller.scrollTop = 0;
    scan();
    const tick = () => {
      if (!autoRunning) return;
      if (!visible || !isVineProductPage() || hasNoProductsNotice()) {
        stopAutoScroll('페이지 이동 또는 상품 없음');
        return;
      }
      if (autoStepCount >= MAX_SCROLL_STEPS) {
        stopAutoScroll(`안전 제한 ${MAX_SCROLL_STEPS}회 도달`);
        return;
      }
      const beforeTop = scroller.scrollTop;
      const beforeHeight = scroller.scrollHeight;
      const beforeCount = productCache.size;
      const stride = Math.max(220, Math.round(scroller.clientHeight * 0.75));
      scroller.scrollTop = Math.min(beforeTop + stride, beforeHeight - scroller.clientHeight);
      autoStepCount++;
      // 첫 번째 갱신은 스크롤 직후, 두 번째 갱신은 지연 로딩 대기 후에 이루어진다.
      // 중첩 스크롤 컨테이너에도 작동하며 새 카드 발견 시 순위가 다시 정렬된다.
      scheduleScan(100);
      const delay = Number($('speed').value) || 1100;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (!autoRunning) return;
        scan();
        const moved = scroller.scrollTop > beforeTop + 3;
        const extended = scroller.scrollHeight > beforeHeight + 3;
        const discovered = productCache.size > beforeCount;
        autoStalledCount = (moved || extended || discovered) ? 0 : autoStalledCount + 1;
        $('scrollStatus').textContent = `${autoStepCount}/${MAX_SCROLL_STEPS}회 · ${productCache.size}개 발견`;
        if (autoStalledCount >= 4) {
          stopAutoScroll('맨 아래 도달 · 분석 완료');
          return;
        }
        tick();
      }, delay);
    };
    tick();
  }

  function mk(tag, attrs, value) {
    const el = document.createElement(tag);
    if (attrs) for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, String(val));
    if (value != null) el.textContent = String(value);
    return el;
  }
  function scan() {
    if (!visible) return;
    // 상품 점수 목록을 이전 페이지에서 가져오는 것처럼 보이지 않게 초기화.
    if (!isVineProductPage()) {
      stopAutoScroll('체험단 상품 페이지가 아님');
      productCache.clear(); clearHighlights();
      previousRanking = ''; previousLeader = '';
      $('leaderName').textContent = '체험단 상품 목록에서만 분석 가능';
      observedCount = 0; ranked = [];
      $('summary').textContent = '분석 중지 · 체험단 상품 목록 페이지가 아님';
      $('results').replaceChildren(mk('div', {class:'empty'},
        '여기는 리뷰 작성/구매 내역 페이지예요.\n쿠팡체험단 탭에서 상품 목록을 열어주세요.\n\n분석 대상: my.coupang.com/productreview/adventurer/productList'));
      $('foot').textContent = '이 페이지의 구매 이력은 수집하거나 분석하지 않습니다.';
      return;
    }
    if (hasNoProductsNotice()) {
      stopAutoScroll('상품 미공개');
      productCache.clear(); clearHighlights();
      previousRanking = ''; previousLeader = '';
      $('leaderName').textContent = '상품 목록이 아직 공개되지 않았어요';
      observedCount = 0; ranked = [];
      $('summary').textContent = '감지 0개 · 쿠팡체험단 상품 미공개';
      $('results').replaceChildren(mk('div', {class:'empty'},
        '현재 쿠팡체험단 상품이 없습니다.\n상품 목록이 공개된 후 다시 스캔해 주세요.'));
      $('foot').textContent = '신청/주문/새로고침 없음 · 열린 목록만 로컬 분석';
      return;
    }
    $('foot').textContent = isDemoPage() ? '오프라인 가상 상품 테스트 · 실제 쿠팡 접속/신청 없음' : '페이지 스크롤은 사이트의 지연 로딩을 유발할 수 있음 · 자동 신청/새로고침 없음';
    const products = extractProducts();
    for (const product of products) {
      const key = product.name.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
      const previous = productCache.get(key);
      productCache.set(key, {
        ...previous, ...product,
        price: product.price || previous?.price || 0,
        url: product.url || previous?.url || '',
        card: product.card || previous?.card || null
      });
    }
    for (const item of productCache.values()) {
      if (item.card && !item.card.isConnected) item.card = null;
    }
    observedCount = productCache.size;
    ranked = scoring.rankProducts([...productCache.values()], settings);
    paintHighlights();
    const leader = ranked[0];
    const leaderKey = leader ? `${leader.name}|${leader.price}|${leader.score}` : '';
    const orderSignature = ranked.map(p => `${p.name}:${p.price}:${p.score}`).join('|');
    const changed = previousRanking !== orderSignature;
    if (changed) {
      rankUpdateCount++;
      const justChangedLeader = Boolean(previousLeader && leaderKey && previousLeader !== leaderKey);
      $('leaderName').textContent = leader ? `${leader.name} (${leader.score}점)` : '추천 대상 상품 없음';
      $('leader').classList.toggle('changed', justChangedLeader);
      previousLeader = leaderKey;
      previousRanking = orderSignature;
    }
    $('summary').textContent = `누적 ${observedCount}개 · 추천 ${ranked.length}개 · 순위 갱신 ${rankUpdateCount}회`;
    // 순서가 달라질 때만 목록을 다시 만든다. 스크롤 중에도 별도 순위 창이 튀지 않는다.
    if (!changed) return;
    const resultArea = $('results');
    const prevListScroll = resultArea.scrollTop;
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
      const jump = mk('button', { class:'copy', title:'쿠팡 페이지의 이 상품으로 이동' }, '위치');
      jump.disabled = !product.card?.isConnected;
      jump.addEventListener('click', () => {
        if (!product.card?.isConnected) return;
        stopAutoScroll('상품 위치 보기');
        product.card.scrollIntoView({behavior:'smooth',block:'center'});
      });
      item.append(rankEl, info, jump, copy);
      resultArea.appendChild(item);
    }
    if (ranked.length > 100) resultArea.appendChild(mk('div', { class:'small' }, `상위 100개만 표시 중 (총 ${ranked.length}개)`));
    resultArea.scrollTop = prevListScroll;
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
  function scheduleScan(delay = 140) {
    if (!visible || scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, delay);
  }
  observer = new MutationObserver(changes => {
    const external = changes.some(change => {
      if (host.contains(change.target) || change.target === highlightCss) return false;
      if (change.target.nodeType === 1 && change.target.closest?.('.' + MARKER_CLASS)) return false;
      if (change.type === 'childList' && [...change.addedNodes, ...change.removedNodes].every(node =>
        node.nodeType === 1 && (node.classList?.contains(MARKER_CLASS) || node.id === 'vine-helper-highlight-style'))) return false;
      return true;
    });
    if (external) scheduleScan();
  });
  observer.observe(document.body || document.documentElement, {childList:true, subtree:true, characterData:true});
  // capture=true: 쿠팡이 페이지 안에 별도 스크롤 영역을 만들어도 변화 감지.
  // 자동 스크롤은 매 단계의 상품 추출 결과를 누적해 실시간으로 순위를 갱신한다.
  document.addEventListener('scroll', () => scheduleScan(120), { passive:true, capture:true });
  window.addEventListener('scroll', () => scheduleScan(120), { passive:true });
  window.addEventListener('load', scheduleScan, { once:true });
})();
