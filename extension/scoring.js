/* 체험단 상품 추천 규칙. 외부 통신/계정 조작 없음. */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    priorityKeywords: '노트북, 모니터, 태블릿',
    preferredKeywords: '삼성, LG, 애플',
    excludeKeywords: '리필',
    categoryRules: '노트북,컴퓨터,모니터,태블릿:100\n냉장고,세탁기,청소기,에어컨:90\n책상,의자,매트리스:70\n식품,과자,음료:20',
    priceWeight: 75,
    priceMode: 'relative', // relative = 이번 회차 상품들의 중앙값 대비 가격
    autoRefreshEnabled: false,
    refreshIntervalSeconds: 15,
    reviewAutoRefreshEnabled: false,
    reviewRefreshIntervalSeconds: 15,
    keywordWeight: 65,
    categoryWeight: 60,
    preferredPrice: 300000,
    minPrice: 0,
    maxPrice: 0,
    hideUnavailable: true,
    hideUnknownStock: true,
    excludeBabyItems: true, excludeWomenItems: true, strictSizeMatching: true,
    clothingSize: '', shoeSize: '',
    phoneModel: '갤럭시 S24+', watchModel: '갤럭시워치6 44mm'
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


  function deviceKey(v) { return normalize(v).replace(/[\s._-]+/g,'').replace(/갤럭시|galaxy/g,''); }
  const clothingRe=/(?:티셔츠|반팔|긴팔|셔츠|블라우스|바지|슬랙스|레깅스|원피스|스커트|점퍼|자켓|재킷|코트|후드|니트|조끼|맨투맨|드로즈|팬티|트렁크|상의|하의|속옷|수영복|패딩)/i;
  const shoeRe=/(?:운동화|스니커즈|신발|구두|샌들|슬리퍼|로퍼|부츠|워커|크록스|양말)/i;
  const babyRe=/(?:신생아|유아용|아동용|영아용|아기용|기저귀|분유|젖병|유모차|이유식|수유|베이비|키즈|영유아|출산용품)/i;
  const womenRe=/(?:여성용|여성복|여성용품|여성\s*(?:전용|의류|옷|신발|구두|속옷|샌들|양말|레깅스|스니커즈|목걸이)|여자용|우먼스|레이디스|womens|ladies|생리대|탐폰|팬티라이너|여성청결제|브래지어|브라렛|산모용품|임산부용)/i;
  function sizeMatches(name,wanted) {
    if(!wanted)return false;
    return new RegExp('(^|[^0-9a-z가-힣])'+wanted+'(?:mm)?(?=$|[^0-9a-z가-힣])','i').test(name);
  }
  function phoneInfo(value) {
    const v=deviceKey(value);
    const m=v.match(/s(\d{2})(울트라|ultra|플러스|plus|\+)?/);
    if (m) return {brand:'s',generation:m[1],variant:/울트라|ultra/.test(m[2]||'')?'ultra':/플러스|plus|\+/.test(m[2]||'')?'plus':'base'};
    const i=v.match(/(?:아이폰|iphone)(\d{2})(프로맥스|promax|프로|pro|플러스|plus|\+)?/);
    if(i)return {brand:'iphone',generation:i[1],variant:(i[2]||'base').replace(/프로맥스|promax/,'promax').replace(/프로|pro/,'pro').replace(/플러스|plus|\+/,'plus')};
    return null;
  }
  function matchesPhone(name,model) {
    const target=phoneInfo(model);
    if(!target)return false;
    const r=/(?:갤럭시\s*|galaxy\s*)?s\s*2\d\s*(?:울트라|ultra|플러스|plus|\+)?|(?:아이폰|iphone)\s*\d{2}\s*(?:프로맥스|promax|프로|pro|플러스|plus|\+)?/gi;
    return [...name.matchAll(r)].some(m=>{
      const p=phoneInfo(m[0]);
      return p && p.brand===target.brand && p.generation===target.generation && p.variant===target.variant;
    });
  }
  function matchesWatch(name,model) {
    const target=deviceKey(model).match(/(?:워치|watch)([4-9]|1[0-2]).*?(40|41|42|43|44|45|46|47)mm/);
    if(!target || /(?:애플|apple|아이폰|iphone)/i.test(name))return false;
    const v=deviceKey(name);
    const series=[...v.matchAll(/(?:워치|watch)([4-9]|1[0-2])/g)].map(m=>m[1]);
    const multiple=v.match(/(?:워치|watch)([4-9](?:\/[4-9])*)/);
    if(multiple)series.push(...multiple[1].split('/'));
    const sizes=[...name.matchAll(/(?:40|41|42|43|44|45|46|47)\s*mm/gi)].map(m=>m[0].replace(/\D/g,''));
    return series.includes(target[1]) && sizes.includes(target[2]);
  }
  function checkCompatibility(rawName,rawSettings) {
    const s={...DEFAULT_SETTINGS,...(rawSettings||{})}, n=normalize(rawName);
    const reject=reason=>({eligible:false,reason});
    if(s.excludeBabyItems && babyRe.test(n))return reject('아기·유아용품 제외');
    if(s.excludeWomenItems && (womenRe.test(n) || (/(?:여성|여자|여아)/.test(n) && (clothingRe.test(n)||shoeRe.test(n)||/목걸이|반지|귀걸이/.test(n)))))return reject('여성 전용 상품 제외');
    if(s.strictSizeMatching!==false && shoeRe.test(n) && !sizeMatches(n,s.shoeSize))return reject('신발 사이즈 미일치 또는 미표기');
    if(s.strictSizeMatching!==false && clothingRe.test(n) && !sizeMatches(n,s.clothingSize))return reject('의류 사이즈 미일치 또는 미표기');
    const watch=/(?:갤럭시\s*워치|galaxy\s*watch|애플\s*워치|apple\s*watch|스마트\s*워치|워치\s*\d)/i.test(n) && /케이스|커버|필름|강화유리|보호|밴드|스트랩|베젤|충전독|충전기/i.test(n);
    if(watch && !matchesWatch(n,s.watchModel))return reject('워치 기종·크기 불일치 또는 미표기');
    const phone=/케이스|범퍼|커버|필름|강화유리|액정보호|카메라보호|렌즈보호/i.test(n) && /갤럭시|galaxy|아이폰|iphone|스마트폰|휴대폰|폰케이스|s2\d/i.test(n) && !watch;
    if(phone && !matchesPhone(n,s.phoneModel))return reject('휴대폰 기종 불일치 또는 미표기');
    return {eligible:true,reason:''};
  }

  function priceContext(products, rawSettings) {
    const s = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
    const excluded = splitKeywords(s.excludeKeywords);
    const prices = products.filter(p => !p.unavailable && p.availability !== 'soldout' &&
      !(p.availability === 'unknown' && s.hideUnknownStock !== false) &&
      !excluded.some(k => normalize(p.name).includes(k)) &&
      checkCompatibility(p.name,s).eligible &&
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
    if (!checkCompatibility(product.name,s).eligible) return null;

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
  const api = { DEFAULT_SETTINGS, splitKeywords, parseCategories, scoreProduct, rankProducts, priceContext, checkCompatibility };
  root.VineScoring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);