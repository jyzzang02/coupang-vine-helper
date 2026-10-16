const assert = require('node:assert/strict');
const { DEFAULT_SETTINGS, rankProducts, scoreProduct } = require('../extension/scoring.js');
const s = { ...DEFAULT_SETTINGS, priorityKeywords: '노트북', preferredKeywords: '삼성', excludeKeywords: '필름', categoryRules: '모니터,노트북:100\n과자,음료:20', priceWeight: 80, keywordWeight: 60, categoryWeight: 50, preferredPrice: 400000 };
const products = [
  {name:'삼성 노트북 15인치', price:450000},
  {name:'일반 프리미엄 냉장고', price:1500000},
  {name:'화면 보호 필름', price:9000},
  {name:'삼성 모니터', price:320000},
  {name:'삼성 노트북 마감', price:800000, unavailable:true}
];
const ranked = rankProducts(products, s);
assert.equal(ranked[0].name, '삼성 노트북 15인치', '최우선 키워드는 가격보다 우선');
assert.equal(ranked.length, 3, '제외/마감 상품은 결과에서 제거');
assert.ok(ranked[0].score > ranked[1].score);
assert.equal(scoreProduct({name:'삼성 필름',price:100000},s),null);
assert.equal(scoreProduct({name:'삼성 모니터',price:700000},{...s,maxPrice:600000}),null);
assert.equal(scoreProduct({name:'삼성 모니터',price:200000},{...s,minPrice:300000}),null);
assert.ok(scoreProduct({name:'미확인 가격 모니터',price:0},s).reasons.includes('가격 미확인'));
console.log('모든 점수 계산 테스트 통과');
