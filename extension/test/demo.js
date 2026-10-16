"use strict";
// 실제 쇼핑몰 API 또는 로그인 요청이 없는 확장 프로그램 내부 전용 시험 데이터
const products = [
 ['주방 다용도 선반 정리함 2개 세트', 28900, '🗄️'],
 ['대형 여행용 파우치 정리백 5개', 19000, '🧳'],
 ['프리미엄 실리콘 조리도구 세트', 52000, '🥄'],
 ['소프트 홈 슬리퍼 세트', 13000, '🥿'],
 ['보온 스테인리스 텀블러 900ml', 37000, '🥤'],
 ['코튼 호텔식 세면 수건 10장', 39000, '🧺'],
 ['디지털 탁상 알람시계', 25000, '⏰'],
 ['무선 휴대용 선풍기 3단계', 43000, '🌀'],
 ['홈카페 캡슐 커피 보관함', 34000, '☕'],
 ['무선 청소기 소모품 리필 6개', 42000, '🧹'],
 ['이어폰 투명 보호 케이스', 17900, '🎧'],
 ['홈 인테리어 테이블 조명', 79000, '💡'],
 ['삼성 갤럭시 태블릿 11인치', 790000, '📱'],
 ['스마트폰 보호필름 2세트', 23000, '📱'],
 ['가정용 에어프라이어 대용량 6리터', 159000, '🍟'],
 ['사무용 데스크 매트 및 키보드 받침대', 37000, '⌨️'],
 ['고급 천연 라텍스 매트리스 토퍼', 230000, '🛏️'],
 ['소형 제습기 원룸용', 120000, '💧'],
 ['삼성 비스포크 냉장고 4도어', 1790000, '🧊'],
 ['자연산 견과 선물세트', 69000, '🥜'],
 ['거실 3인용 패브릭 소파', 489000, '🛋️'],
 ['휴대용 무선 마우스', 49000, '🖱️'],
 ['바디워시 대용량 1L 2개', 32000, '🧴'],
 ['백색소음 수면 무드등', 28000, '🌙'],
 ['LG 울트라와이드 모니터 34인치', 690000, '🖥️'],
 ['고급 헤드폰 거치대 메탈', 55000, '🎧'],
 ['생활 방수 등산 가방 32L', 99000, '🎒'],
 ['대용량 로봇청소기 3세대', 980000, '🤖'],
 ['게이밍 의자 허리 받침형', 289000, '🪑'],
 ['전동 높이 조절 책상', 380000, '🖥️'],
 ['고급 세라믹 프라이팬 2개', 119000, '🍳'],
 ['자동차 유리 세정제 대용량', 19000, '🚗'],
 ['애플 태블릿 13인치 프로', 1690000, '📱'],
 ['삼성 고급형 무선 청소기', 750000, '🧹'],
 ['기계식 키보드 104키', 129000, '⌨️'],
 ['정수기 리필 카트리지 5개', 90000, '🚰'],
 ['LG 노트북 그램 17인치', 1890000, '💻'],
 ['고급 모니터 거치대 듀얼암', 259000, '🖥️'],
 ['스마트 워치 스포츠 에디션', 299000, '⌚'],
 ['프리미엄 노트북 가방 케이스', 68000, '💼'],
 ['홈시어터 5.1채널 사운드바', 860000, '🔊'],
 ['스마트 빔프로젝터 4K', 990000, '📽️'],
 ['디지털 피아노 88건반', 650000, '🎹'],
 ['전동 킥보드 접이식', 540000, '🛴'],
 ['대형 냉동고 직냉식 180L', 480000, '❄️'],
 ['멀티 포트 고속 충전기', 85000, '🔌'],
 ['브랜드 헤어드라이어', 139000, '💨'],
 ['코튼 이불 침구 세트', 99000, '🛏️']
];
const $ = id => document.getElementById(id);
let added = 0;
let locked = false;
let injected = false;
const batchSize = 12;
function appendBatch(forceCount = batchSize) {
 if (locked) return;
 locked = true;
 const target = Math.min(products.length, added + forceCount);
 const frag = document.createDocumentFragment();
 for (; added < target; added++) {
   const [name, price, emoji] = products[added];
   const card = document.createElement('article');
   card.className = 'product-card';
   const status = added === 20 || added === 41 ? '신청 마감' : '신청 가능';
   card.innerHTML = `<div class="photo" aria-hidden="true"></div><a class="demo-link" href="/products/${10000+added}"><div class="product-name"></div></a><div class="product-price"></div><div class="available"></div>`;
   card.querySelector('.photo').textContent = emoji;
   card.querySelector('.photo').style.setProperty('--bg', ['#e7f3ff','#f9edf3','#eff9ef','#fff3df'][added%4]);
   card.querySelector('.product-name').textContent = name;
   card.querySelector('.product-price').textContent = price.toLocaleString('ko-KR') + '원';
   card.querySelector('.available').textContent = status;
   card.querySelector('.available').className = status.includes('마감') ? 'soldout' : 'available';
   frag.appendChild(card);
 }
 $('items').appendChild(frag);
 $('count').textContent = added+'개 로딩';
 $('status').textContent = `현재 ${added}/${products.length}개 표시 · 스크롤하여 추가 불러오기`;
 if (added === products.length) $('end').textContent = '마지막 상품까지 불러왔습니다. 추천 순위를 확인하세요.';
 locked=false;
}
function addSpecial() {
 if(injected) return;
 injected = true;
 const card=document.createElement('article');
 card.className='product-card';
 card.style.background='#fff8e8';
 card.innerHTML='<div class="photo">💻</div><a class="demo-link" href="/products/99999"><div class="product-name">삼성 노트북 모니터 태블릿 올인원 2026년형</div></a><div class="product-price">2,990,000원</div><div class="available">신청 가능 · 새로 등장한 최우선 상품</div>';
 $('items').appendChild(card);
 $('status').textContent = '최우선 상품 1개가 새로 등장했습니다. 추천 1위 변경 여부 확인!';
 $('count').textContent = (added+1)+'개 로딩';
}
function onScroll() {
 if (locked || added >= products.length) return;
 const remain = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
 if (remain < 850) appendBatch();
}
window.addEventListener('scroll', onScroll, {passive:true});
$('add').addEventListener('click',()=>appendBatch());
$('leader').addEventListener('click',addSpecial);
$('restart').addEventListener('click',()=>{added=0;injected=false;$('items').replaceChildren();$('end').textContent='아래로 스크롤하면 다음 상품이 추가됩니다.';window.scrollTo({top:0,behavior:'instant'});appendBatch();});
$('items').addEventListener('click',event=>{if(event.target.closest('.demo-link'))event.preventDefault()});
appendBatch();
