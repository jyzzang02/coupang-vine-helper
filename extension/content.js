/* 사용자가 연 쿠팡 화면의 DOM 분석. 자동 새로고침은 명시적으로 ON인 경우에만 페이지 reload를 실행한다. */
(() => {
  'use strict';
  if (window.__vineHelperLoaded) return;
  window.__vineHelperLoaded = true;

  const scoring = window.VineScoring;
  if (!scoring) return;
  const STORAGE_KEY = 'vineHelperSettingsV1';
  const PANEL_KEY = 'vineHelperPanelOpenV08';
  const MIN_REFRESH_SEC = 30;
  const STOCK_KEY = isDemoStorageKey();
  function isDemoStorageKey() { return location.protocol === 'chrome-extension:' ? 'vineHelperDemoStockV07' : 'vineHelperStockV07'; }
  const VINE_PATH = '/productreview/adventurer/productList';
  const REVIEW_PATH = '/productreview/reviewable';
  const isReviewTestPage = () => location.hostname === 'my.coupang.com' &&
    location.pathname.replace(/\/$/, '') === REVIEW_PATH;
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
  const previousStock = new Map();
  const stockChanges = new Map();
  let stockReady = false;
  let stockSaveTimer = null;
  let nextRefreshAt = 0;
  let refreshInProgress = false;
  let reviewEditorTouched = false;
  const pageLoadedAt = new Date();
  const loadTime = pageLoadedAt.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
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
  .stock{font-size:10px;background:#e7f8f0;color:#087442;border-radius:6px;padding:2px 5px;font-weight:700}
  .delta{font-size:10px;background:#fff0dd;color:#944b00;border-radius:6px;padding:2px 5px}
  .changes{flex:0 0 auto;max-height:106px;overflow:auto;font-size:11px;line-height:1.65;padding:8px 13px;background:#fffbf1;border-top:1px solid #f4dfb7;color:#895a12}
  .changes b{display:block;margin-bottom:2px;color:#715017}
  .changes .ch{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}

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
  .refreshBar{padding:8px 13px;display:flex;align-items:center;gap:8px;background:#f7f9fd;border-top:1px solid #e6ecf5;flex-wrap:wrap}
  .refreshBar label{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700}
  .refreshBar select{font-size:12px;padding:5px;border:1px solid #dce3ec;border-radius:6px;background:white}
  .refreshBar .small{flex:1;text-align:right;min-width:95px}
  .foot{padding:8px 13px;border-top:1px solid #edf1f6;color:#66758a;font-size:11px;background:#f8fafc}
  .empty{padding:25px 0;text-align:center;color:#6d788a;line-height:1.7;white-space:pre-line}
  </style>
  <button id="launch" class="launcher">🔎 상품 분석</button>
  <div id="panel" class="panel" hidden>
    <div class="top"><div><h2 id="viewTitle">체험단 상품 우선순위</h2><div class="small" id="summary">화면에 표시된 상품만 분석</div></div><button class="btn" id="close">닫기 ×</button></div>
    <div class="toolbar"><button class="btn primary" id="scan">화면 다시 분석</button><button class="btn" id="options">⚙ 가중치 설정</button><button class="btn" id="export">CSV 저장</button><button class="btn" id="clear">누적 초기화</button></div>
    <div class="toolbar" style="padding-top:0"><button class="btn primary" id="auto">↡ 자동 스크롤 시작</button><button class="btn" id="stop" hidden>■ 스크롤 중지</button><label for="speed" class="small">속도</label><select id="speed" class="speed"><option value="1600">천천히</option><option value="1100" selected>보통</option><option value="750">빠르게</option></select><span id="scrollStatus" class="small">수동 시작</span></div>
    <div class="refreshBar"><label><input id="refreshEnabled" type="checkbox"> 자동 새로고침</label><select id="refreshInterval"><option value="30">30초</option><option value="60" selected>60초</option><option value="120">2분</option><option value="300">5분</option></select><span class="small" id="refreshStatus">기본 OFF</span></div>
    <div id="leader" class="leader"><b id="leaderLabel">현재 추천 1위</b><span id="leaderName">분석 대기 중</span></div>
    <div id="changes" class="changes" hidden></div>
    <div id="results" class="results"><div class="empty">상품을 분석하려면 '다시 스캔'을 누르세요.</div></div>
    <div id="settings" class="settings" hidden>
      <div class="field"><label>최우선 키워드 (포함 시 일반 상품보다 우선)</label><textarea id="priorityKeywords" rows="2"></textarea></div>
      <div class="field"><label>선호 키워드 (추가 점수)</label><textarea id="preferredKeywords" rows="2"></textarea></div>
      <div class="field"><label>제외 키워드 (결과에서 완전히 숨김)</label><textarea id="excludeKeywords" rows="2"></textarea></div>
      <div class="field"><label>카테고리별 선호도 (키워드,키워드:0~100)</label><textarea id="categoryRules" rows="4"></textarea></div>
      <div class="field"><label>가격 평가 방식</label><select id="priceMode" style="width:100%;padding:7px;background:white;border:1px solid #cbd5e1;border-radius:6px"><option value="relative">이번 목록 가격 중앙값 기준 (추천)</option><option value="target">고정 목표 가격 기준</option></select></div>
      <div class="field"><label>가격 가중치</label><div class="range"><input id="priceWeight" type="range" min="0" max="100"><span id="priceWeightView"></span></div></div>
      <div class="field"><label>선호 키워드 가중치</label><div class="range"><input id="keywordWeight" type="range" min="0" max="100"><span id="keywordWeightView"></span></div></div>
      <div class="field"><label>카테고리 가중치</label><div class="range"><input id="categoryWeight" type="range" min="0" max="100"><span id="categoryWeightView"></span></div></div>
      <div class="double"><div class="field"><label>고정 모드 목표가격(원)</label><input id="preferredPrice" type="number" min="1000" step="10000"></div><div class="field"><label>최저 가격 필터(원)</label><input id="minPrice" type="number" min="0" step="10000"></div></div>
      <div class="double"><div class="field"><label>최고 가격 필터(원, 0=제한 없음)</label><input id="maxPrice" type="number" min="0" step="10000"></div><div class="field"><label style="margin-top:21px"><input id="hideUnavailable" type="checkbox" checked disabled> 모두 소진은 항상 제외</label></div></div>
      <button id="save" class="btn primary">설정 저장하고 다시 계산</button> <button id="reset" class="btn">기본값으로 초기화</button>
    </div>
    <div class="foot" id="foot">재고는 마지막 새로고침 기준 · 자동 새로고침 기본 OFF · 신청은 휴대폰에서 직접</div>
  </div>`;
  document.documentElement.appendChild(host);

  const $ = id => shadow.getElementById(id);
  const setVisible = open => {
    visible = open;
    $('panel').hidden = !open;
    $('launch').hidden = open;
    try { sessionStorage.setItem(PANEL_KEY, open ? 'yes' : 'no'); } catch (_) { }
    if (open) { previousRanking = ''; scan(); armRefresh(); }
    else { stopAutoScroll('분석 창 닫음'); nextRefreshAt = 0; updateRefreshStatus(); }
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
  $('refreshEnabled').addEventListener('change', () => {
    if (isReviewTestPage()) settings.reviewAutoRefreshEnabled = $('refreshEnabled').checked;
    else settings.autoRefreshEnabled = $('refreshEnabled').checked;
    saveRefreshPreference();
  });
  $('refreshInterval').addEventListener('change', () => {
    if (isReviewTestPage()) settings.reviewRefreshIntervalSeconds = Number($('refreshInterval').value);
    else settings.refreshIntervalSeconds = Number($('refreshInterval').value);
    saveRefreshPreference();
  });
  $('clear').addEventListener('click', () => {
    productCache.clear(); clearHighlights(); previousRanking = ''; previousLeader = '';
    rankUpdateCount = 0; scan();
  });
  window.addEventListener('pagehide', () => stopAutoScroll('페이지 이동'));
  for (const id of ['priceWeight', 'keywordWeight', 'categoryWeight']) {
    $(id).addEventListener('input', () => { $(id + 'View').textContent = $(id).value; });
  }

  const canRefreshHere = () => isVineProductPage() || isReviewTestPage();
  const currentRefreshEnabled = () => isReviewTestPage() ? Boolean(settings.reviewAutoRefreshEnabled) : Boolean(settings.autoRefreshEnabled);
  const currentRefreshSeconds = () => isReviewTestPage() ? Number(settings.reviewRefreshIntervalSeconds) : Number(settings.refreshIntervalSeconds);

  // Browser extension storage only. The test page uses in-memory defaults.
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(STORAGE_KEY, data => {
        const saved = data && data[STORAGE_KEY];
        if (saved && typeof saved === 'object') settings = { ...settings, ...saved };
        if (settingsOpen) fillSettings();
        syncRefreshControls();
        armRefresh();
        if (visible) scan();
      });
    }
  } catch (_) { /* demo without extension API */ }

  // 체험단과 리뷰 작성 페이지의 자동 새로고침은 별도 ON/OFF 및 주기.
  function reviewEditorOpen() {
    if (!isReviewTestPage()) return false;
    if (reviewEditorTouched) return true;
    const inputs = document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]');
    for (const input of inputs) {
      if (!host.contains(input) && isShown(input)) return true;
    }
    return [...document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')]
      .some(dialog => !host.contains(dialog) && isShown(dialog) && /리뷰|평가|후기/.test(dialog.innerText || ''));
  }
  document.addEventListener('input', event => {
    if (!isReviewTestPage() || host.contains(event.target)) return;
    const el = event.target;
    if (el.matches?.('textarea,input:not([type="hidden"]),[contenteditable="true"],[role="textbox"]') || el.closest?.('[contenteditable="true"]')) {
      reviewEditorTouched = true;
      updateRefreshStatus();
    }
  }, true);
  function syncRefreshControls() {
    const supported = canRefreshHere();
    const allowed = [30, 60, 120, 300];
    const seconds = currentRefreshSeconds();
    const normalized = allowed.includes(seconds) ? seconds : 60;
    if (isReviewTestPage()) settings.reviewRefreshIntervalSeconds = normalized;
    else settings.refreshIntervalSeconds = normalized;
    $('refreshEnabled').checked = supported && currentRefreshEnabled();
    $('refreshEnabled').disabled = !supported;
    $('refreshInterval').disabled = !supported;
    $('refreshInterval').value = String(normalized);
    updateRefreshStatus();
  }
  function saveRefreshPreference() {
    syncRefreshControls();
    try { if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({[STORAGE_KEY]:settings}); }
    catch (_) { if (isDemoPage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    armRefresh();
  }
  function armRefresh() {
    nextRefreshAt = visible && canRefreshHere() && currentRefreshEnabled() && !document.hidden
      ? Date.now() + Math.max(MIN_REFRESH_SEC, currentRefreshSeconds()) * 1000 : 0;
    updateRefreshStatus();
  }
  function updateRefreshStatus() {
    if (!canRefreshHere()) $('refreshStatus').textContent = '이 페이지에서는 지원 안 함';
    else if (!currentRefreshEnabled()) $('refreshStatus').textContent = '꺼짐';
    else if (!visible) $('refreshStatus').textContent = '창을 열면 시작';
    else if (document.hidden) $('refreshStatus').textContent = '탭 비활성 · 일시중지';
    else if (reviewEditorOpen()) $('refreshStatus').textContent = '리뷰 편집 감지 · 일시중지';
    else if (!nextRefreshAt) $('refreshStatus').textContent = '대기 중';
    else if (autoRunning) $('refreshStatus').textContent = '스크롤 분석 완료 대기';
    else $('refreshStatus').textContent = '다음 확인 ' + Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000)) + '초 후';
  }
  function persistAndReload() {
    if (refreshInProgress || (isReviewTestPage() && reviewEditorOpen())) return;
    refreshInProgress = true;
    try { sessionStorage.setItem(PANEL_KEY, 'yes'); } catch (_) { }
    if (isReviewTestPage()) { location.reload(); return; }
    const items = Object.fromEntries([...productCache.values()].slice(0,1200).map(p => [
      productKey(p), {remaining:p.remaining ?? null, availability:p.availability || 'unknown'}]));
    const snapshot = {seenAt:Date.now(), items};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({[STOCK_KEY]:snapshot}, () => location.reload());
    } else {
      storageSave(STOCK_KEY,snapshot);
      location.reload();
    }
  }
  setInterval(() => {
    if (!currentRefreshEnabled() || !visible || !canRefreshHere() || document.hidden) {
      updateRefreshStatus(); return;
    }
    if (!nextRefreshAt) armRefresh();
    if (Date.now() >= nextRefreshAt && !refreshInProgress) {
      if (autoRunning || reviewEditorOpen() || (isDemoPage() && !document.querySelector('#intro')?.hidden)) {
        updateRefreshStatus(); return;
      }
      persistAndReload(); return;
    }
    updateRefreshStatus();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) nextRefreshAt = 0;
    else armRefresh();
  });

  function storageFetch(key, cb) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(key, result => cb(result?.[key] || null));
        return;
      }
      if (isDemoPage()) cb(JSON.parse(localStorage.getItem(key) || 'null'));
      else cb(null);
    } catch (_) { cb(null); }
  }
  function storageSave(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({[key]:value});
      else if (isDemoPage()) localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* storage not available in test mode */ }
  }
  function productKey(product) { return `${product.itemIndex ?? ''}|` + product.name.toLocaleLowerCase('ko-KR').replace(/\s+/g,' ').trim(); }
  function stockLabel(item) {
    if (!item) return '정보 없음';
    if (item.availability === 'soldout') return '모두 소진';
    if (item.availability === 'available' && Number.isFinite(item.remaining)) return `${item.remaining}개 남음`;
    if (item.availability === 'available') return '신청 가능';
    return '재고 확인 필요';
  }
  storageFetch(STOCK_KEY, snapshot => {
    if (snapshot?.items && typeof snapshot.items === 'object') {
      for (const [key,val] of Object.entries(snapshot.items).slice(0,1200)) {
        if (val && typeof val === 'object') previousStock.set(key,val);
      }
    }
    stockReady = true;
    if (visible) scan();
  });
  function trackStockChanges(products) {
    if (!stockReady || isVineProductPage() === false) return;
    for (const p of products) {
      const prev = previousStock.get(productKey(p));
      if (!prev || p.availability === 'unknown') continue;
      if (prev.availability === p.availability && prev.remaining === p.remaining) continue;
      stockChanges.set(productKey(p), {
        name:p.name, before:stockLabel(prev), after:stockLabel(p), soldout:p.availability === 'soldout'
      });
    }
    const target = $('changes');
    const list = [...stockChanges.values()];
    target.hidden = list.length === 0;
    if (!list.length) return;
    target.replaceChildren(mk('b', null, `📉 지난 분석과 비교 · ${list.length}개 변화`));
    for (const change of list.slice(0,4)) target.appendChild(mk('div', {class:'ch'},
      `${change.soldout ? '⛔':'↓'} ${change.before} → ${change.after} · ${change.name}`));
  }
  function scheduleStockSave() {
    if (!stockReady || !productCache.size || stockSaveTimer) return;
    stockSaveTimer = setTimeout(() => {
      stockSaveTimer = null;
      const items = Object.fromEntries([...productCache.values()].slice(0,1200).map(p=>[
        productKey(p),{remaining:p.remaining ?? null, availability:p.availability || 'unknown'}]));
      storageSave(STOCK_KEY,{seenAt:Date.now(),items});
    },600);
  }
  function fillSettings() {
    $('priceMode').value = settings.priceMode === 'target' ? 'target' : 'relative';
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
    settings.priceMode = $('priceMode').value;
    for (const id of numbers) settings[id] = Math.max(0, Number($(id).value) || 0);
    settings.hideUnavailable = true;
    try { if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({ [STORAGE_KEY]: settings }); } catch (_) { }
    settingsOpen = false;
    $('settings').hidden = true;
    previousRanking = '';
    scan();
  }

  const priceWithWon = /(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원/g;
  const stockExact = /^(모두\s*소진|\d{1,6}\s*개\s*남음|품절|신청\s*마감)$/;
  const soldOutRe = /모두\s*소진|일시\s*품절|품절|신청\s*마감/;
  const remainRe = /(\d{1,6})\s*개\s*남음/;
  function readAvailability(text) {
    const str = String(text || '');
    if (soldOutRe.test(str)) return {availability:'soldout',remaining:0,unavailable:true};
    const remain = str.match(remainRe);
    if (remain) {
      const count = Number(remain[1]);
      return {availability:count > 0 ? 'available':'soldout',remaining:count,unavailable:count <= 0};
    }
    if (/신청\s*가능/.test(str)) return {availability:'available',remaining:null,unavailable:false};
    return {availability:'unknown',remaining:null,unavailable:false};
  }
  function findPrice(card) {
    const priceNode = card.querySelector('[class*="price"],[class*="Price"],[data-price]');
    const chosen = priceNode?.getAttribute('data-price') || priceNode?.textContent || '';
    const direct = [...chosen.matchAll(priceWithWon)].map(m=>Number(m[1].replaceAll(',','')));
    if (direct.length) return Math.max(...direct);
    const all = [...(card.innerText || '').matchAll(priceWithWon)].map(m=>Number(m[1].replaceAll(',','')));
    return all.length ? Math.max(...all) : 0;
  }
  function cleanName(value) {
    return String(value || '').replace(/\s+/g,' ').trim().replace(/^\d{1,3}\s+/, '').slice(0,165);
  }
  function readName(card) {
    // Prefer a product name element, but real Coupang DOM may not contain a product detail link.
    const explicit = card.querySelector('[class*="product-name"],[class*="productName"],[class*="product-title"],[class*="productTitle"],[class*="item-name"],[class*="itemName"],[data-product-name]');
    if (explicit) {
      const name = cleanName(explicit.textContent);
      if (name.length >= 5) return name;
    }
    const lines=(card.innerText || '').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^\d{1,4}$/.test(line) || stockExact.test(line) || /^\d[\d,]*\s*원$/.test(line)) continue;
      if (/^쿠팡체험단$|^상품보기$/.test(line)) continue;
      const name = cleanName(line);
      if (name.length >= 5) return name;
    }
    const img=card.querySelector('img[alt]');
    const alternative=cleanName(img?.alt);
    return alternative.length > 5 ? alternative : '';
  }
  function isShown(node) {
    if (!node || !node.isConnected || !node.getClientRects().length) return false;
    const style=getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }
  function findStockCard(leaf) {
    // Choose smallest ancestor representing exactly one item, with image, price and stock label.
    let node=leaf;
    for (let d=0;d<9 && node && node !== document.body;d++,node=node.parentElement) {
      if (node === host || node.contains(host)) return null;
      const txt=node.innerText || '';
      if (txt.length < 15 || txt.length > 650) continue;
      if (!node.querySelector('img')) continue;
      if (!/\d[\d,]*\s*원/.test(txt)) continue;
      const statuses=(txt.match(/모두\s*소진|\d{1,6}\s*개\s*남음|신청\s*마감/g)||[]).length;
      if (statuses !== 1) continue;
      if (!isShown(node)) continue;
      return node;
    }
    return null;
  }
  function extractProducts() {
    if (!isVineProductPage() || hasNoProductsNotice()) return [];
    const found=new Map();
    const leaves=Array.from(document.querySelectorAll('div,span,p,small,strong,em,li'));
    for (const node of leaves.slice(0,12000)) {
      if (host.contains(node) || !isShown(node)) continue;
      if (node.children.length && [...node.children].some(child=>stockExact.test(child.textContent?.trim() || ''))) continue;
      const text=node.textContent?.trim() || '';
      if (!stockExact.test(text)) continue;
      const card=findStockCard(node);
      if (!card) continue;
      const name=readName(card);
      if (name.length < 5) continue;
      const stock=readAvailability(text);
      const anchor=card.querySelector('a[href*="/products/"]');
      const indexCandidate=(card.querySelector('.number,[class*="itemIndex"],[class*="item-index"],[class*="rank"]')?.textContent || card.innerText.split(/\n/).map(x=>x.trim())[0] || '').trim();
      const itemIndex=/^\d{1,4}$/.test(indexCandidate) ? Number(indexCandidate) : null;
      const product={name,price:findPrice(card),url:anchor?.href||'',card,itemIndex,...stock};
      const key=productKey(product);
      const previous=found.get(key);
      if (!previous || (!previous.price && product.price)) found.set(key,product);
    }
    return [...found.values()];
  }
  // 리뷰 작성 목록은 체험단 상품이 아니다. DOM 인식/스크롤/키워드 검증 전용으로만 사용한다.
  function extractReviewProducts() {
    if (!isReviewTestPage()) return [];
    const found = new Map();
    const leaves = [...document.querySelectorAll('a,button,span,div,strong')].slice(0,16000);
    for (const leaf of leaves) {
      if (leaf.children.length || host.contains(leaf) || !isShown(leaf)) continue;
      if (!/^리뷰\s*작성하기$/.test((leaf.textContent || '').trim())) continue;
      let card = null;
      for (let node=leaf.parentElement, depth=0; node && node!==document.body && depth<10;
           node=node.parentElement,depth++) {
        if (node.contains(host)) break;
        const txt = node.innerText || '';
        if (txt.length > 1400 || !node.querySelector('img')) continue;
        if ((txt.match(/리뷰\s*작성하기/g) || []).length !== 1) continue;
        if (txt.trim().length < 15 || !isShown(node)) continue;
        card = node;
        break;
      }
      if (!card) continue;
      const explicit = card.querySelector('[class*="product-name"],[class*="productName"],[class*="product-title"],[class*="productTitle"],[class*="item-name"],[class*="itemName"]');
      const lines = (card.innerText || '').split(/\n+/).map(x=>x.trim()).filter(Boolean)
        .filter(line => !/^리뷰\s*작성하기$|^숨기기$|^\d{4}\.\d{2}\.\d{2}.*(배송|주문)|^쿠팡체험단$/.test(line));
      const name = cleanName(explicit?.textContent || lines[0] || card.querySelector('img[alt]')?.alt);
      if (name.length < 5 || /리뷰\s*작성/.test(name)) continue;
      const key = name.toLocaleLowerCase('ko-KR').replace(/\s+/g,' ').trim();
      if (!found.has(key)) found.set(key,{name,price:0,availability:'review-test',remaining:null,card,itemIndex:null,url:''});
    }
    return [...found.values()];
  }

  function scanReviewable() {
    $('viewTitle').textContent = '리뷰 작성 · 인식 테스트';
    $('leaderLabel').textContent = '키워드 일치 1위';
    $('changes').hidden = true;
    const products=extractReviewProducts();
    for (const item of products) {
      const key=productKey(item);
      productCache.set(key,{...productCache.get(key),...item});
    }
    for (const item of productCache.values()) if (item.card && !item.card.isConnected) item.card=null;
    observedCount=productCache.size;
    // 재고나 가격 없이 키워드 매칭 정확도만 검사한다. 임의로 '신청 가능'으로 분류하지 않는다.
    const probeSettings = {...settings,priceWeight:0,minPrice:0,maxPrice:0,hideUnknownStock:false};
    ranked=scoring.rankProducts([...productCache.values()],probeSettings);
    paintHighlights();
    const leader=ranked[0];
    $('leaderName').textContent=leader ? `${leader.name} (${leader.score}점)` : '키워드에 맞는 상품이 없습니다';
    $('summary').textContent=`리뷰 작성 상품 감지 ${observedCount}개 · 키워드 통과 ${ranked.length}개 · 재고/가격 검증 불가`;
    $('foot').textContent='리뷰 작성 테스트 · 가격/재고 미확인 · 신청과 무관 · 자동 새로고침 켜고 끌 수 있음 · 편집 중 보호';
    const signature=ranked.map(p=>`${p.name}:${p.score}`).join('|')+'|review';
    if (signature===previousRanking) return;
    previousRanking=signature;
    const area=$('results'),scroll=area.scrollTop;
    area.replaceChildren();
    if (!ranked.length) {
      area.appendChild(mk('div',{class:'empty'},observedCount
        ? '상품명은 읽었으나 모두 제외 키워드에 해당합니다.'
        : '리뷰 작성 상품을 인식하지 못했어요. 목록을 스크롤하거나 화면을 다시 분석해 주세요. 실제 쿠팡 HTML 구조에 맞춰 조정이 필요할 수 있습니다.'));
      return;
    }
    for (const [i,p] of ranked.slice(0,100).entries()) {
      const item=mk('div',{class:'product'});
      const number=mk('div',{class:'rank'},String(i+1));
      const info=mk('div',{class:'info'});
      info.append(mk('div',{class:'name'},p.name),
        mk('div',{class:'meta'},'리뷰 상품 테스트 · 가격 및 재고 정보 없음'),
        mk('div',{class:'reason'},p.reasons.join(' · ')||'기본 순서'));
      const locate=mk('button',{class:'copy'},'위치');
      locate.disabled=!p.card?.isConnected;
      locate.addEventListener('click',()=>{if(!p.card?.isConnected)return;stopAutoScroll('상품 위치 보기');p.card.scrollIntoView({behavior:'smooth',block:'center'});});
      item.append(number,info,locate);
      area.appendChild(item);
    }
    area.scrollTop=scroll;
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
      const text = isReviewTestPage()
        ? `${rank <= 3 ? '★ ' : ''}리뷰 테스트 ${rank}위 · ${product.score}점`
        : `${rank <= 3 ? '★ ' : ''}추천 ${rank}위 · ${product.score}점`;
      if (badge.textContent !== text) badge.textContent = text;
      const description = product.reasons.join(' · ') || '기본 점수';
      if (badge.title !== description) badge.title = description;
      decoratedCards.add(card);
    }
  }

  function getScrollElement() {
    const firstCard = (isReviewTestPage() ? extractReviewProducts() : extractProducts())
      .find(p => p.card?.isConnected)?.card;
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
    if (currentRefreshEnabled() && nextRefreshAt && Date.now() >= nextRefreshAt)
      nextRefreshAt = Date.now() + 10000;
  }
  function startAutoScroll() {
    if (autoRunning) return;
    if (!isVineProductPage() && !isReviewTestPage()) {
      $('scrollStatus').textContent = '체험단 또는 리뷰 목록에서만 가능';
      return;
    }
    if (!isReviewTestPage() && hasNoProductsNotice()) {
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
      if (!visible || (!isVineProductPage() && !isReviewTestPage()) || (!isReviewTestPage() && hasNoProductsNotice())) {
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
    if (isReviewTestPage()) {
      scanReviewable();
      return;
    }
    $('viewTitle').textContent = '체험단 상품 우선순위';
    $('leaderLabel').textContent = '현재 추천 1위';
    // 상품 점수 목록을 이전 페이지에서 가져오는 것처럼 보이지 않게 초기화.
    if (!isVineProductPage()) {
      stopAutoScroll('체험단 상품 페이지가 아님');
      productCache.clear(); clearHighlights(); $('changes').hidden=true;
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
      productCache.clear(); clearHighlights(); $('changes').hidden=true;
      previousRanking = ''; previousLeader = '';
      $('leaderName').textContent = '상품 목록이 아직 공개되지 않았어요';
      observedCount = 0; ranked = [];
      $('summary').textContent = '감지 0개 · 쿠팡체험단 상품 미공개';
      $('results').replaceChildren(mk('div', {class:'empty'},
        '현재 쿠팡체험단 상품이 없습니다.\n상품 목록이 공개된 후 다시 스캔해 주세요.'));
      $('foot').textContent = `상품 미공개 · 자동 새로고침 ${settings.autoRefreshEnabled ? 'ON' : 'OFF'} · 마지막 로드 ${loadTime}`;
      return;
    }
    $('foot').textContent = `${isDemoPage() ? '모의 테스트' : '쿠팡 페이지'} · 마지막 로드 ${loadTime} · 재고는 새로고침 기준 · 자동 새로고침 ${settings.autoRefreshEnabled ? 'ON' : 'OFF'}`;
    const products = extractProducts();
    for (const product of products) {
      const key = productKey(product);
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
    trackStockChanges(products);
    scheduleStockSave();
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
    const availableCount = [...productCache.values()].filter(p => p.availability === 'available').length;
    const soldCount = [...productCache.values()].filter(p => p.availability === 'soldout').length;
    const pc = scoring.priceContext([...productCache.values()], settings);
    $('summary').textContent = `목록 ${observedCount}개 · 신청 가능 ${availableCount} · 추천 ${ranked.length} · 가격대 ${pc.bandLabel}`;
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
      meta.appendChild(mk('span', {class:'stock'}, stockLabel(product)));
      const previous=previousStock.get(productKey(product));
      if (previous && (previous.remaining !== product.remaining || previous.availability !== product.availability))
        meta.appendChild(mk('span', {class:'delta'}, `${stockLabel(previous)} → ${stockLabel(product)}`));
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
    if (isReviewTestPage()) {
      const quote = v => '"' + String(v == null ? '' : v).replaceAll('"', '""') + '"';
      const lines = [['테스트순위','리뷰작성 상품명','키워드 점수','판단근거'],
        ...ranked.map((p,i)=>[i+1,p.name,p.score,p.reasons.join(' / ')])];
      const blob = new Blob(['\ufeff' + lines.map(row=>row.map(quote).join(',')).join('\r\n')],
        {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href=url; link.download='리뷰상품_인식테스트.csv';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      return;
    }
    const quote = v => '"' + String(v == null ? '' : v).replaceAll('"', '""') + '"';
    const rows = [['순위','상품명','가격(원)','재고상태','남은수량','점수','판단근거','링크'],
      ...ranked.map((p,i) => [i+1,p.name,p.price || '',stockLabel(p),p.remaining ?? '',p.score,p.reasons.join(' / '),p.url])];
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
  try {
    if (sessionStorage.getItem(PANEL_KEY) === 'yes' && (isVineProductPage() || isReviewTestPage())) {
      setVisible(true);
      setTimeout(() => { if (visible && currentRefreshEnabled() && !autoRunning && !reviewEditorOpen()) startAutoScroll(); }, 1400);
    }
  } catch (_) { /* session storage blocked */ }
})();
