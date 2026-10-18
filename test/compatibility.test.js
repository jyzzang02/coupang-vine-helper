const assert=require('node:assert/strict');
const {DEFAULT_SETTINGS,checkCompatibility,rankProducts}=require('../extension/scoring.js');
const s={...DEFAULT_SETTINGS,excludeKeywords:'',clothingSize:'110',shoeSize:'270'};
for(const title of ['갤럭시 S24+ 전용 케이스','갤럭시워치6 44mm 보호 케이스','남성 티셔츠 110','운동화 270','USB-C 공용 충전기'])
  assert(checkCompatibility(title,s).eligible,title);
for(const title of ['갤럭시 S25+ 전용 케이스','갤럭시 S24 울트라 강화유리 필름',
 '갤럭시워치7 44mm 보호 케이스','갤럭시워치6 40mm 보호 케이스',
 '남성 티셔츠 100','운동화 260','여성용 스니커즈 270',
 '아기용 젖병 세트','생리대 대형 40매','휴대폰 케이스 모델 미표기'])
  assert(!checkCompatibility(title,s).eligible,title);
assert.equal(rankProducts([
 {name:'갤럭시 S24+ 케이스',price:25000,availability:'available'},
 {name:'갤럭시 S25+ 케이스',price:30000,availability:'available'},
 {name:'아기용 젖병',price:49900,availability:'available'}],s).length,1);
console.log('v0.8.9 호환성 필터 테스트 통과');
