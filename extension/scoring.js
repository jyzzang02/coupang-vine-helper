/* 체험단 상품 추천 규칙. 외부 통신/계정 조작 없음. */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    priorityKeywords: '노트북, 모니터, 태블릿',
    preferredKeywords: '삼성, LG, 애플',
    excludeKeywords: '케이스, 필름, 리필',
    categoryRules: '노트북,컴퓨터,모니터,태블릿:100\n냉장고,세탁기,청소기,에어컨:90\n책상,의자,매트리스:70\n식품,과자,음료:20',
    priceWeight: 75,
    priceMode: 'relative', // relative = 이번 회차 상품들의 중앙값 대비 가격
    autoRefreshEnabled: false,
    refreshIntervalSeconds: 60,
    reviewAutoRefreshEnabled: false,
    reviewRefreshIntervalSeconds: 60,
    keywordWeight: 65,
    categoryWeight: 60,
    preferredPrice: 300000,
    minPrice: 0,
    maxPrice: 0,
    hideUnavailable: true,
    hideUnknownStock: true
  });

  const normalize = (x) => String(x || '').trim().toLocaleLowerCase('ko-KR');
  const splitKeywords = (text) => String(text || '')
    .split(/[,，;\n]/).map(normalize).filter(Boolean);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function parseCategories(input) {
    return String(input || '').split('\n').map((line) => {
      const index = line.lastIndexOf(':');
      if (index < 0) return null;
      const names = splitKeywords(line.slice(0, index));
      const strength = Number(line.slice(index + 1).trim());
      if (!names.length || !Number.isFinite(strength)) return null;
      return { names, strength: clamp(strength, 0, 100) };
    }).filter(Boolean);
  }

  function priceContext(products, rawSettings) {
    const s = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
    const excluded = splitKeywords(s.excludeKeywords);
    const prices = products.filter(p => !p.unavailable && p.availability !== 'soldout' &&
      !(p.availability === 'unknown' && s.hideUnknownStock !== false) &&
      !excluded.some(k => normalize(p.name).includes(k)) &&
      (Number(s.minPrice) <= 0 || +p.price >= +s.minPrice) &&
      (Number(s.maxPrice) <= 0 || +p.price <= +s.maxPrice))
      .map(p => Number(p.price)).filter(price => Number.isFinite(price) && price > 0).sort((a,b) => a-b);
    const mid = Math.floor(prices.length / 2);
    const medianPrice = prices.length ? (prices.length % 2 ? prices[mid] : (prices[mid-1] + prices[mid]) / 2) : 0;
    const bands = [10000, 50000, 300000, 1000000];
    const upper = bands.find(v => medianPrice <= v);
    return { medianPrice, sampleCount: prices.length,
      bandLabel: !medianPrice ? '분석 중' : upper ? `${(upper/10000).toLocaleString('ko-KR')}만원 이하 (추정)` : '100만원 초과 (추정)' };
  }

  function scoreProduct(product, rawSettings, context = null) {
    const s = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
    const name = normalize(product.name);
    const price = Number.isFinite(+product.price) ? Math.max(0, +product.price) : 0;
    if (!name || name.length < 3) return null;
    if (product.unavailable || product.availability === 'soldout') return null;
    if (product.availability === 'unknown' && s.hideUnknownStock !== false) return null;
    if (s.minPrice > 0 && price > 0 && price < Number(s.minPrice)) return null;
    if (s.maxPrice > 0 && price > 0 && price > Number(s.maxPrice)) return null;
    const excluded = splitKeywords(s.excludeKeywords).find(k => name.includes(k));
    if (excluded) return null;

    const priority = splitKeywords(s.priorityKeywords).filter(k => name.includes(k));
    const preferred = splitKeywords(s.preferredKeywords).filter(k => name.includes(k));
    const categories = parseCategories(s.categoryRules);
    let topCategory = null;
    for (const cat of categories) {
      const match = cat.names.find(k => name.includes(k));
      if (match && (!topCategory || cat.strength > topCategory.strength)) {
        topCategory = { keyword: match, strength: cat.strength };
      }
    }
    const reasons = [];
    let score = 0;
    if (priority.length) {
      // 최고 우선순위 키워드가 있는 상품은 일반 점수보다 항상 높도록 설계.
      score += 1000 + Math.min(3, priority.length - 1) * 70;
      reasons.push('최우선: ' + priority.join(', '));
    }
    if (preferred.length) {
      score += clamp(+s.keywordWeight || 0, 0, 100) * (1 + 0.1 * Math.min(3, preferred.length - 1));
      reasons.push('선호: ' + preferred.join(', '));
    }
    if (topCategory) {
      score += clamp(+s.categoryWeight || 0, 0, 100) * topCategory.strength / 100;
      reasons.push('카테고리: ' + topCategory.keyword);
    }
    if (price > 0) {
      const isRelative = s.priceMode !== 'target';
      const median = context?.medianPrice > 0 ? context.medianPrice : price;
      const reference = isRelative ? median : Math.max(1000, Number(s.preferredPrice) || 300000);
      const ratio = clamp(price / reference, 0, isRelative ? 2 : 1);
      score += clamp(+s.priceWeight || 0, 0, 100) * (isRelative ? ratio / 2 : ratio);
      if (isRelative && context?.sampleCount >= 2) reasons.push(`이번 목록 중앙값 대비 ${(price / median).toFixed(2)}배`);
      else if (!isRelative && price >= reference) reasons.push('목표 가격 이상');
    } else {
      reasons.push('가격 미확인');
    }
    return { ...product, score: Math.round(score * 10) / 10, priority: priority.length > 0, reasons };
  }

  function rankProducts(products, settings) {
    const context = priceContext(products, settings);
    return products.map(p => scoreProduct(p, settings, context)).filter(Boolean)
      .sort((a, b) => b.score - a.score || (b.price || 0) - (a.price || 0) || a.name.localeCompare(b.name, 'ko'));
  }
  const api = { DEFAULT_SETTINGS, splitKeywords, parseCategories, scoreProduct, rankProducts, priceContext };
  root.VineScoring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
