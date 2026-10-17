"use strict";
const $=id=>document.getElementById(id);
const rows=[["해커리아 나드 딥 리페어 손톱영양제, 1개, 15ml",8900],["하리보 포켓 오아시스 키즈 클리어 휴대폰 케이스, 아이폰 14 프로",7500],["서울우유 단백질 강화 프로틴 우유 200ml 24개입",27700],["이플스 스마트 시계형 22mm 20mm 삼성 갤럭시 시리즈",32000],["포터블 스탠드 버즈프로 크리스탈 케이스",9900],["3M 고급형 다용도통 4.5kg 대용량",6400],["스킨랩 엑스트라 마사지리페어 마스크팩, 10p",12500],["도브릭 오렌지 컬러 헤어브러시",3900],["블랙 스포츠 방수 힙색 가방",16700],["라포티셀 멀티 액티브 하이드레이팅 크림, 100g",16800],["러스터릭 발수 방염 보온 접이식 스텐레스 케이스",41000],["에버드라운스 초음파 세정용 보습 크림, 300ml",17900],["몬베르 테이블 USB 충전 3단 스마트 조명 세트",34500],["ALLMETAL 세차 디테일 브러쉬 5종 세트",16900],["누아트 에어팟 맥스 크리스탈 하드 케이스 투명",7900],["비앤비 마스크 화이트 30매입",14500],["나에게 선물하는 더블 두피스 카메라 케이스",12500],["필라모유 휴대용 블루투스 멀티 거치대",11300],["대한 PM1.0 항균필터 에어컨필터, 2개",14000],["고무모 판넬 변형 방열 방수용 슬리퍼 2개입",17000],["스텐드 접이식 마그네틱 고속충전 보조배터리",17500],["마이그린 일회용 장갑, 10개입, 5개",4700],["닥터제로 리프레쉬 비타민C 수딩스팟, 50ml",10000],["구스페리 아이폰 호환 3축 충전 케이블 1m",5400],["네오멀티 에어필터 안전 마스크 세트",4500],["핀시즈 강화유리 액정보호 필름",9700],["대용량 친환경 화장솜 세트 300개입",4000],["심플 원목 서랍 정리함 3칸",28900],["에어프라이어 실리콘 조리 용기 세트",17900],["무선 청소기 교체 필터 4종 세트",25900],["노트북 17인치 충격보호 파우치",29900],["탁상용 무선 미니 선풍기",32900],["모니터 받침대 높이 조절형",42000],["실리콘 냉장고 정리함 4종",29000],["프리미엄 식기세척기 세제",28000],["블루투스 이어폰 실리콘 케이스",11900],["노트북 65W USB-C 고속 충전기",49000],["사무용 키보드 키캡 세트",18700],["캡슐 커피 보관 거치대 40구",23900],["바이오 콜라겐 히알루론산 크림",45000],["휴대용 USB 미니 가습기",26900],["빨래 건조대 접이식 실내용",35900],["스마트폰 투명 보호필름 세트",11000],["무소음 기계식 마우스",45000],["컴퓨터 의자 등받이 쿠션",29000],["전자레인지용 찜기 2종 세트",9900],["다용도 식품건조망 4단",27000],["고급형 타블렛 거치대",35000],["프리미엄 탄산수 24개입",21000],["차량용 휴대 미니 공기정화 필터",22000],["스테인리스 텀블러 900ml",44000],["생활방수 여행 파우치",19000],["태블릿 거치대 각도 조절형",34900],["사운드바 호환 벽걸이 브라켓",18500],["대용량 세탁세제 3.2L",28000],["여행용 캐리어 정리 파우치 8종",29900],["스마트폰 케이스 2개",7900],["여름용 쿨링 베개커버 2매",25000],["높낮이 조절 노트북 받침대",39000],["스마트워치 스포츠 교체 밴드",18000],["다용도 무선 미니 청소기 필터",17800],["주방 조리도구 5종 실리콘 세트",28900],["애플 워치 충전 거치대",28000],["침구 정리 압축팩 8매",24500],["무드등 수면 램프 터치식",29900],["주방 원형 프라이팬 코팅 관리 도구",18900],["아파트 현관 무선 초인종 배터리",12000],["정리함 투명 플라스틱 박스",13900],["접이식 블루투스 키보드 거치대",34900],["마이크용 폼 윈드스크린 세트",12500],["차량용 먼지 제거 젤",6600],["티에스에이치 인견 5부 반바지, 2, 이너색",12200],["바림라 판스타 + 소스 캡핑 세트, 1세트",26800],["네파 여성용 윙릿지 쿠션 스니커즈 양말 5켤레 세트",14900],["스피아노 모노 머쉬룸 터치 LED 충전식 무드등 SL-MR01",29900],["에뛰드 더블래스팅 파운데이션 30g, 허니샌드",13900],["여성용 더블 레이어 스틱 목걸이",17000],["데이지크 섀도우 팔레트, 18 베리 스무디",27200],["건강곡간 제주 참기장, 2kg, 1개",18900],["아네에 데일리 마스크 대형 KF94 + 항균파우치 세트",17700],["마르마르디 락시트 바디워시 베르가못향, 1개, 1000ml",18900],["잉가 타투 쿠션 15g, 1개, 2N2 뉴트럴 베이지",17500],["JOYU 3세대 N10 애완동물 전동 연마기 전자동 발 수리 각종 애완동물용",39600],["호랑이보감 여주돼지감자환 30p, 90g, 1개",22900],["까사체클린 피크닉 대형 방수 체크 매트 돗자리 PB3",10900],["내추럴코튼 뉴 시그니처 슬림 슈퍼롱 오버나이트 생리대",12900],["스마트 라이프 손소독 세정제 2개 세트",14900],["데일리 유기농 카카오 초콜릿",18000],["라벤더 보습 바디 로션 대용량",19500],["닥터지 레드 블레미쉬 클리어 수딩 토너, 200ml",16200],["까사체클린 피크닉 대형 방수 체크 매트 돗자리 PB3",10900],["내추럴코튼 뉴 시그니처 슬림 슈퍼롱 오버나이트 생리대",12900]];
const thumbnailCount=92;
const stageKey='vineHelperStockStageV07';const modalKey='vineHelperDemoIntroSeenV07';
let stage=Number(sessionStorage.getItem(stageKey) || 0);
let prepared=stage;
let shown=0;
const FIRST_PAGE_SIZE=8;
const NEXT_PAGE_SIZE=10;
const LOAD_DELAY_MS=350; // network-like delay to test scrolling + DOM updates
const LOAD_THRESHOLD_PX=280;
let loading=false;
let scrollEventCount=0;
let pageLoads=0;
function countFor(i,level){
  if(i>=71)return 0; // Many goods in the supplied screenshots were already sold out.
  let initial= (i%13===0 ? 1 : i%9===0 ? 3 : i%7===0 ? 2 : i%5===0 ? 5 : 10);
  if(i===35)initial=6;
  if(level===0)return initial;
  if(level===1)return Math.max(0, initial-(i%4===0 ? 2 : i%3===0 ? 4 : 1));
  return Math.max(0,initial-(i%2===0 ? 12 : 5));
}
function appendChunk(size){
  const fragment=document.createDocumentFragment();
  const max=Math.min(shown+size,rows.length);
  for(let i=shown;i<max;i++){
    const [name,price]=rows[i], count=countFor(i,stage);
    const card=document.createElement('article');card.className='product-row'+(count===0?' soldout':'');
    const n=document.createElement('span');n.className='number';n.textContent=i+1;
    const img=document.createElement('img');img.className='thumb';img.alt='상품 이미지';img.src=`images/product_${String((i%thumbnailCount)+1).padStart(2,'0')}.jpg`;
    const detail=document.createElement('div');detail.className='detail';
    const title=document.createElement('div');title.className='product-name';title.textContent=name;
    const cost=document.createElement('div');cost.className='product-price';cost.textContent=price.toLocaleString('ko-KR')+'원';
    const stock=document.createElement('div');stock.className='stock-text';stock.textContent=count>0?`${count}개 남음`:'모두 소진';
    detail.append(title,cost,stock);card.append(n,img,detail);fragment.appendChild(card);
  }
  shown=max;pageLoads++;
  $('items').appendChild(fragment);
  $('count').textContent=`${shown} / ${rows.length}개 표시 (추가 로딩 ${pageLoads-1}회)`;
  $('end').textContent=shown>=rows.length
    ? '목록 끝 · 재고는 F5 새로고침 시점에만 갱신됩니다.'
    : '아래로 스크롤하면 다음 10개 상품을 불러옵니다.';
}
function queueNextPage(){
  // Only a scroll event near the bottom starts another batch.
  if(loading || shown>=rows.length || !$('intro').hidden) return;
  const left=document.scrollingElement.scrollHeight-window.innerHeight-window.scrollY;
  if(left>LOAD_THRESHOLD_PX) return;
  loading=true;
  $('end').textContent='상품을 불러오는 중…';
  $('end').setAttribute('aria-busy','true');
  setTimeout(()=>{
    appendChunk(NEXT_PAGE_SIZE);
    loading=false;
    $('end').removeAttribute('aria-busy');
  },LOAD_DELAY_MS);

}
function refreshHint(){
 $('state').textContent=`현재 재고 상태: ${stage+1}단계`;
 $('help').textContent=prepared>stage
   ? `다음 상태(${prepared+1}단계)가 준비됐습니다. 이제 F5를 누르면 새 수량과 품절 상태가 표시됩니다.`
   : '「다음 재고 상태 준비」를 누르고 F5를 눌러주세요. 새로고침 전에는 남은 수량이 절대 바뀌지 않습니다.';
}
function initModal(){
 const intro=$('intro');intro.hidden=sessionStorage.getItem(modalKey)==='yes';
 const close=()=>{intro.hidden=true;sessionStorage.setItem(modalKey,'yes');};
 $('close').addEventListener('click',close);$('view').addEventListener('click',close);
 $('reopen').addEventListener('click',()=>{intro.hidden=false;window.scrollTo({top:0,behavior:'instant'});});
}
$('prepare').addEventListener('click',()=>{prepared=Math.min(2,Number(sessionStorage.getItem(stageKey)||0)+1);sessionStorage.setItem(stageKey,String(prepared));refreshHint();});
$('reset').addEventListener('click',()=>{sessionStorage.setItem(stageKey,'0');sessionStorage.removeItem(modalKey);window.location.reload();});
window.addEventListener('scroll',()=>{
  scrollEventCount++;
  queueNextPage();
},{passive:true});
initModal();refreshHint();appendChunk(FIRST_PAGE_SIZE);
// Test-only diagnostic. No remote requests.
window.__vineDemoDebug=()=>({shown,total:rows.length,loading,scrollEventCount,pageLoads,allPricesWithin50k:rows.every(r=>r[1]<=50000)});
