// Actual geography; every incident coordinate is a training assumption, not a real facility record.
export const SITES={
 underpass:{name:'고립·구조 지점',type:'구조 대응',label:'A',color:'#bd403c',coord:[36.9925,128.3655],task:'rescue'},
 care:{name:'이동약자 대피 지점',type:'주민 대피',label:'B',color:'#b67518',coord:[36.9815,128.3735],task:'evacuate'},
 road:{name:'접근로 점검 지점',type:'교통·접근로',label:'C',color:'#987534',coord:[37.0035,128.349],task:'clear'},
 hospital:{name:'의료지원 거점',type:'응급의료',label:'D',color:'#16847c',coord:[36.978,128.360],task:'receive'}
};
export function setupMap({select,notify}){
 const el=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const map=L.map('geoMap',{zoomControl:false,preferCanvas:true}).setView([36.992,128.363],14);
 L.control.zoom({position:'bottomright'}).addTo(map);L.control.scale({position:'bottomleft',imperial:false}).addTo(map);
 const layers={
  sat:L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'}),
  street:L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,maxNativeZoom:12,attribution:'Tiles © Esri, USGS, NGA, NASA, GIS User Community · 지역 개요지도'}),
  fallback:L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,maxNativeZoom:12,attribution:'Tiles © Esri, USGS, NGA, NASA, GIS User Community · 개요지도 확대'})
 };
 const incident=L.layerGroup().addTo(map),resources=L.layerGroup().addTo(map),areas=L.layerGroup();let base='sat',loaded=0,failed=0,generation=0,timer;
 function setBase(key){
  generation++;Object.values(layers).forEach(l=>map.removeLayer(l));base=key;loaded=failed=0;el('mapError').hidden=true;
  document.querySelectorAll('[data-base]').forEach(b=>b.classList.toggle('active',b.dataset.base===(key==='fallback'?'street':key)));
  el('mapConnection').textContent=key==='sat'?'항공영상 연결 중…':'일반지도 연결 중…';layers[key].addTo(map);
  clearTimeout(timer);const current=generation;timer=setTimeout(()=>{if(current===generation&&!loaded){el('mapError').hidden=false;el('mapConnection').textContent='배경지도 연결 지연 · 다시 연결할 수 있습니다.';}},18000);
 }
 for(const [key,layer]of Object.entries(layers)){
  layer.on('tileload',()=>{if(base!==key)return;loaded++;el('mapError').hidden=true;el('mapConnection').textContent=key==='sat'?'항공영상 수신 · 실시간 영상 아님':key==='fallback'?'일반지도 대체 연결 · 지역 개요지도 확대':'일반지도 수신 · Esri 지역 개요 / 상세 확대 제한';});
  layer.on('tileerror',()=>{if(base!==key)return;failed++;if(failed>=4&&key==='street'&&!loaded){setBase('fallback');notify('일반지도 연결이 원활하지 않아 지역 개요지도로 전환했습니다.');}else if(failed>=4&&!loaded){el('mapError').hidden=false;el('mapConnection').textContent='배경지도 수신 실패';}});
 }
 document.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>setBase(b.dataset.base));el('retryMap').onclick=()=>setBase(base==='fallback'?'street':base);
 const fit=()=>map.fitBounds(Object.values(SITES).map(s=>s.coord),{padding:[95,95],maxZoom:14});el('fitMap').onclick=()=>{fit();el('areaLabel').textContent='단양읍 일대';};
 [['layerIncidents',incident],['layerResources',resources],['layerAreas',areas]].forEach(([id,layer])=>{el(id).onchange=()=>el(id).checked?layer.addTo(map):map.removeLayer(layer);});
 let lastSearch=0;const cache=new Map();el('mapSearch').onsubmit=async e=>{
  e.preventDefault();const q=el('mapQuery').value.trim();if(!q)return;
  const xy=q.split(',').map(Number);if(xy.length===2&&xy.every(Number.isFinite)&&Math.abs(xy[0])<85&&Math.abs(xy[1])<=180){map.setView(xy,14);el('areaLabel').textContent='입력 좌표';el('mapResults').hidden=true;return;}
  if(Date.now()-lastSearch<1500)return;lastSearch=Date.now();el('mapSearchButton').disabled=true;el('mapSearchButton').textContent='검색 중';el('mapResults').hidden=true;
  try{
   let data=cache.get(q);if(!data){const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=4&countrycodes=kr&q='+encodeURIComponent(q.replace(/\s*일대$/,'')),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('검색 서비스 응답 오류');data=await r.json();cache.set(q,data);}
   el('mapResults').replaceChildren();el('mapResults').hidden=false;
   if(!data.length)el('mapResults').textContent='검색 결과가 없습니다. 시·군·읍면 이름 또는 위도, 경도로 찾아보세요.';
   for(const d of data){const b=document.createElement('button');b.textContent=d.display_name;b.onclick=()=>{map.setView([Number(d.lat),Number(d.lon)],14);el('areaLabel').textContent=d.display_name;el('mapResults').hidden=true;notify('지도 시점을 이동했습니다. 훈련 사건은 기존 위치에 유지됩니다.');};el('mapResults').append(b);}
  }catch{notify('지역 검색 연결 실패. 위도, 경도를 입력하거나 훈련 구역으로 돌아가세요.');}
  finally{el('mapSearchButton').disabled=false;el('mapSearchButton').textContent='지역 찾기';}
 };
 setBase('sat');setTimeout(fit,100);
 return {
  focus(id){if(SITES[id])map.panTo(SITES[id].coord);},
  resize(){requestAnimationFrame(()=>map.invalidateSize());},
  render(v,selected,tasks){
   incident.clearLayers();resources.clearLayers();areas.clearLayers();
   for(const [id,s]of Object.entries(SITES)){
    const r=v.reports.filter(r=>r.place===id).at(-1),known=!!r;
    L.marker(s.coord,{icon:L.divIcon({className:'incidentMarker',html:`<button class="mapPin ${id==='hospital'?'pinLeft':''} ${selected===id?'selected':''}" style="--pin:${s.color}" aria-label="${safe(s.name)}"><span class="pinLetter">${s.label}</span><span class="pinText"><strong>${safe(s.name)}</strong><small>${known?`${r.time}分`.replace('分','분')+' 보고 확인':'정보 확인 필요'} <em>훈련 가정</em></small></span></button>`,iconSize:[236,60],iconAnchor:[id==='hospital'?(window.innerWidth<800?185:221):17,30]})}).addTo(incident).on('click',()=>select(id));
    if(known)L.circle(s.coord,{radius:id==='hospital'?100:180,color:s.color,fillColor:s.color,fillOpacity:.13,weight:1,dashArray:'5 5'}).bindTooltip('훈련 가정 위험반경 · 실제 침수 예측 아님').addTo(areas);
   }
   for(const r of v.requests.filter(r=>r.status==='active')){
    const t=tasks[r.task],site=SITES[t.place];if(!site)continue;
    const origin=[36.9885,128.378];L.polyline([origin,site.coord],{color:'#397ac3',weight:3,dashArray:'8 7',opacity:.8}).bindTooltip('수행 임무 연결선 · 실제 도로 이동경로 아님').addTo(resources);
    L.marker(origin,{icon:L.divIcon({className:'resourceMarker',html:'<span>출동 기준점</span>',iconSize:[88,25]})}).addTo(resources);
   }
  }
 };
}
