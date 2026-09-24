(function(){
'use strict';
window.__BUGGY_BOOTED=true;
window.__BUGGY_VERSION='0.14';
var D=window.ROUTE_DATA,A=window.PixelAssets,W=600,H=900;
if(!A)throw new Error('PixelAssets v0.14 not loaded');
var canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
var timeEl=document.getElementById('time'),placeEl=document.getElementById('place'),routeNowEl=document.getElementById('routeNow');
var banner=document.getElementById('banner'),sensorEl=document.getElementById('sensor'),flash=document.getElementById('flash');
var planning=document.getElementById('planning'),liveMap=document.getElementById('liveMap'),end=document.getElementById('end');
var endTitle=document.getElementById('endTitle'),endText=document.getElementById('endText');
var player={x:300,y:730,vx:0,vy:0,r:20},input={x:0,y:0},manual={x:0,y:0};
var baseB=null,baseG=null,baseMX=null,baseMY=null,lastOri=0,lastMotion=0,sensorListenersAdded=false;
var running=false,last=performance.now(),gameMinutes=D.initialMinutes,damage=0,invuln=0;
var currentNode=D.start,currentEdge=null,edgeProgress=0,nextHazard=0,hazards=[],pendingPatterns=[],lastEncounterLabels=[],flowDir=1,terrainHitCooldown=0,encounterIndex=0;
var fork=null,forkY=-180,forkDelay=0,visitedNodes=[D.start],visitedEdges=[];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function fmt(m){m=Math.max(0,Math.ceil(m));var h=Math.floor(m/60),mm=m%60;return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');}
function key(e){return e.from+'-'+e.to;}
function outgoing(n){return D.edges.filter(function(e){return e.from===n;});}
function riskStars(n){return '★'.repeat(n)+'☆'.repeat(4-n);}
function meta(h){return D.hazardMeta[h]||{short:h,cue:''};}
function countPaths(node,seen){
  if(node===D.goal)return 1;
  seen=seen||{};if(seen[node])return 0;
  var next=Object.assign({},seen);next[node]=true;
  return outgoing(node).reduce(function(sum,e){return sum+countPaths(e.to,next);},0);
}
var TOTAL_ROUTES=countPaths(D.start,{});
function loadRecords(){
  try{
    var r=JSON.parse(localStorage.getItem('buggy-return-records-v1')||'{}');
    return {attempts:r.attempts||0,successes:r.successes||0,bestRemaining:Number.isFinite(r.bestRemaining)?r.bestRemaining:null,minDamage:Number.isFinite(r.minDamage)?r.minDamage:null,routes:r.routes||{}};
  }catch(e){return {attempts:0,successes:0,bestRemaining:null,minDamage:null,routes:{}};}
}
function saveRecords(r){try{localStorage.setItem('buggy-return-records-v1',JSON.stringify(r));}catch(e){}}
function routeSignature(){return visitedNodes.join('>');}
function updateRecordSummary(){
  var el=document.getElementById('recordSummary');if(!el)return;
  var r=loadRecords(),unique=Object.keys(r.routes).length;
  el.innerHTML='<b>航海記録</b>　成功 '+r.successes+' / 挑戦 '+r.attempts+'　｜　帰還成功ルート '+unique+'種'+(r.bestRemaining!==null?'　｜　BEST残り '+fmt(r.bestRemaining):'');
}
function screenAngle(){var a=screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0);return((a%360)+360)%360;}
function rotate(x,y){var a=screenAngle();if(a===90)return{x:y,y:-x};if(a===270)return{x:-y,y:x};if(a===180)return{x:-x,y:-y};return{x:x,y:y};}
function onOrientation(e){
  if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
  if(baseB===null){baseB=e.beta;baseG=e.gamma;}
  var p=rotate(e.gamma-baseG,e.beta-baseB);
  input.x=clamp(p.x/20,-1,1);input.y=clamp(p.y/20,-1,1);lastOri=performance.now();sensorEl.textContent='傾き入力 ON';
}
function onMotion(e){
  if(performance.now()-lastOri<700)return;
  var a=e.accelerationIncludingGravity;if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.y))return;
  var p=rotate(a.x,a.y);if(baseMX===null){baseMX=p.x;baseMY=p.y;}
  input.x=clamp((p.x-baseMX)/4,-1,1);input.y=clamp(-(p.y-baseMY)/4,-1,1);lastMotion=performance.now();sensorEl.textContent='モーション入力 ON';
}
async function enableSensor(){
  try{
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      var r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')throw new Error();
    }
    if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
      var m=await DeviceMotionEvent.requestPermission();if(m!=='granted')throw new Error();
    }
    if(!sensorListenersAdded){
      window.addEventListener('deviceorientation',onOrientation,true);
      window.addEventListener('devicemotion',onMotion,true);
      sensorListenersAdded=true;
    }
    sensorEl.textContent='端末を傾けてください';
  }catch(e){sensorEl.textContent='センサー不可：ボタン操作';}
}
function updateLiveMapMarker(){
  var marker=document.getElementById('mapShip'),info=document.getElementById('liveRouteInfo');
  if(marker){
    if(currentEdge){
      var a=D.nodes[currentEdge.from],b=D.nodes[currentEdge.to],t=clamp(edgeProgress/currentEdge.sail,0,1);
      var x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      marker.setAttribute('transform','translate('+x+' '+y+')');marker.style.display='';
    }else{
      marker.style.display='none';
    }
  }
  if(info){
    info.textContent=currentEdge
      ? 'NOW '+currentEdge.from+'→'+currentEdge.to+' ｜ 主:'+meta(currentEdge.hazard).short+' '+riskStars(currentEdge.risk)+' ｜ '+Math.max(0,Math.ceil(currentEdge.sail-edgeProgress))+'分'
      : (fork?'NOW '+currentNode+' ｜ 次の航路を選択中':'NOW '+D.nodes[currentNode].name);
  }
}
function updateHud(){
  timeEl.textContent=fmt(gameMinutes);
  placeEl.textContent=D.nodes[currentNode].name;
  routeNowEl.textContent=currentEdge?D.nodes[currentEdge.to].name+'へ / '+meta(currentEdge.hazard).short+' '+riskStars(currentEdge.risk):fork?'航路選択中':'待機';
  
  var lm=document.getElementById('liveTime');if(lm)lm.textContent=fmt(gameMinutes);
  updateLiveMapMarker();
}
function buildMap(targetId,live){
  var host=document.getElementById(targetId),svg=[];
  svg.push('<svg viewBox="0 0 600 580" class="routeSvg" aria-label="ドット航路海図">');
  svg.push('<rect x="0" y="0" width="600" height="580" fill="transparent"/>');

  D.edges.forEach(function(e){
    var a=D.nodes[e.from],b=D.nodes[e.to],eid=key(e),cls='mapEdge';
    if(visitedEdges.indexOf(eid)>=0)cls+=' visited';
    if(currentEdge&&key(currentEdge)===eid)cls+=' current';
    svg.push('<line class="'+cls+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>');
    var mx=Math.round((a.x+b.x)/2),my=Math.round((a.y+b.y)/2);
    svg.push('<text class="edgeLabel" x="'+mx+'" y="'+(my-5)+'" text-anchor="middle">'+e.sail+'m '+riskStars(e.risk)+'</text>');
  });

  Object.keys(D.nodes).forEach(function(id){
    var n=D.nodes[id],cls='mapNode';
    if(visitedNodes.indexOf(id)>=0)cls+=' visited';
    if(currentNode===id)cls+=' current';
    if(id===D.goal)cls+=' goal';
    var x=n.x,y=n.y;
    svg.push('<g class="'+cls+'">');
    svg.push('<rect class="islandSand" x="'+(x-25)+'" y="'+(y+8)+'" width="50" height="10"/>');
    svg.push('<rect class="islandSand" x="'+(x-19)+'" y="'+(y+18)+'" width="38" height="7"/>');
    svg.push('<rect class="islandGreen" x="'+(x-18)+'" y="'+(y+1)+'" width="36" height="11"/>');
    svg.push('<rect class="nodeBadge" x="'+(x-13)+'" y="'+(y-16)+'" width="26" height="20"/>');
    svg.push('<text x="'+x+'" y="'+(y-2)+'" text-anchor="middle">'+(id===D.goal?'K':id)+'</text>');
    if(id!==D.start&&id!==D.goal)svg.push('<text class="nodeSub" x="'+x+'" y="'+(y+39)+'" text-anchor="middle">LOG '+n.log+'m</text>');
    if(id===D.goal)svg.push('<text class="nodeSub" x="'+x+'" y="'+(y+39)+'" text-anchor="middle">KARAI BARI</text>');
    svg.push('</g>');
  });

  if(live){
    svg.push('<g id="mapShip" class="shipMarker" style="display:none"><path d="M0 -13 L9 8 L3 8 L3 14 L-3 14 L-3 8 L-9 8 Z"/></g>');
  }
  svg.push('</svg>');

  var rows=D.edges.map(function(e){
    return '<div class="edgeRow"><b>'+e.from+'→'+e.to+'</b><span>'+e.sail+'m</span><span>'+meta(e.hazard).short+'</span><span>'+riskStars(e.risk)+'</span></div>';
  }).join('');
  var legend='<div class="hazardLegend"><b>MAIN HAZARD</b>　砲撃 / 岩礁水道 / 強海流 / 追尾船 / 海王類<br><b>★が多いほど別種危険も同時発生</b>　※安全そうでも時間は自分で足せ。</div>';
  var detail=live
    ? '<div id="liveRouteInfo" class="liveRouteStrip"></div>'+legend
    : '<div class="mapLegend">島＝LOG待ち / 線＝航行時間 / ★＝危険レイヤー数</div>'+legend+'<div class="edgeTable">'+rows+'</div>';
  host.innerHTML='<div class="mapTop">'+(live
    ? '<b>LIVE CHART / 一瞬で確認しろ</b><span>残り <strong id="liveTime">'+fmt(gameMinutes)+'</strong></span>'
    : '<b>PRE-SAIL CHART / 作戦会議</b><span>時間停止中</span>')+'</div>'+svg.join('')+detail;
  if(live)updateLiveMapMarker();
}
function resetGame(){
  player.x=300;player.y=730;player.vx=player.vy=0;input.x=input.y=manual.x=manual.y=0;
  baseB=baseG=baseMX=baseMY=null;lastOri=lastMotion=0;
  gameMinutes=D.initialMinutes;damage=0;invuln=0;currentNode=D.start;currentEdge=null;edgeProgress=0;nextHazard=0;hazards=[];pendingPatterns=[];lastEncounterLabels=[];flowDir=1;terrainHitCooldown=0;encounterIndex=0;
  fork=null;forkY=-180;forkDelay=.4;visitedNodes=[D.start];visitedEdges=[];banner.textContent='まずは最初の航路を選べ！';
  updateHud();updateRecordSummary();buildMap('planningMap',false);buildMap('liveMapBody',true);
}
function startGame(){
  resetGame();planning.classList.add('hidden');end.classList.add('hidden');liveMap.classList.add('hidden');running=true;last=performance.now();enableSensor();prepareFork();
}
function prepareFork(){
  var outs=outgoing(currentNode);if(!outs.length)return;
  if(outs.length===1){beginEdge(outs[0]);return;}
  fork={edges:outs};forkY=-160;forkDelay=.6;currentEdge=null;hazards=[];
  banner.textContent='次の航路を選べ！ '+outs.map(function(e){return e.to+'('+meta(e.hazard).short+')';}).join(' / ');
  updateHud();
}
function forkCenters(count){return count===2?[180,420]:count===3?[100,300,500]:[300];}
function resolveFork(){
  if(!fork)return;
  var centers=forkCenters(fork.edges.length),best=0,dist=9999;
  centers.forEach(function(x,i){var d=Math.abs(player.x-x);if(d<dist){dist=d;best=i;}});
  var e=fork.edges[best];fork=null;beginEdge(e);
}
function beginEdge(e){
  currentEdge=e;edgeProgress=0;nextHazard=220;hazards=[];pendingPatterns=[];lastEncounterLabels=[];terrainHitCooldown=0;encounterIndex=0;visitedEdges.push(key(e));
  if(e.hazard==='海流'){
    var seed=(e.from.charCodeAt(0)+e.to.charCodeAt(0)+e.risk)%2;
    flowDir=seed===0?-1:1;
  }
  banner.textContent=e.to+'へ！ 主:'+meta(e.hazard).short+' '+riskStars(e.risk)+' — '+meta(e.hazard).cue+(e.risk>=4?'＋全危険混在！':'')+(e.hazard==='海流'?(flowDir<0?'（←へ流される）':'（→へ流される）'):'');
  updateHud();buildMap('liveMapBody',true);
}
function arrive(){
  var n=D.nodes[currentEdge.to];currentNode=currentEdge.to;visitedNodes.push(currentNode);currentEdge=null;hazards=[];pendingPatterns=[];lastEncounterLabels=[];
  if(currentNode===D.goal){finish(true);return;}
  gameMinutes-=n.log;
  banner.textContent=n.name+' 到着！ ログ記録 -'+n.log+'分';
  flash.style.background='#9ff3ca';flash.style.opacity='.65';setTimeout(function(){flash.style.opacity='0';},170);
  if(gameMinutes<=0){finish(false);return;}
  updateHud();buildMap('liveMapBody',true);
  setTimeout(function(){if(running)prepareFork();},650);
}
function hazardPenalty(type,risk){
  if(type==='rock')return 7+risk*2;
  if(type==='cannon')return 10+risk*3;
  if(type==='pirate')return 11+risk*3;
  return 15+risk*4;
}
function pickHazard(e){
  if(e.hazard==='岩礁'||e.hazard==='海流')return null;
  if(e.hazard==='海軍')return'cannon';
  if(e.hazard==='海賊')return'pirate';
  if(e.hazard==='海王類')return'king';
  var pool=['rock','cannon','pirate','king'];return pool[Math.floor(Math.random()*pool.length)];
}
function spawnRockGate(e){
  var risk=e.risk,gap=205-risk*12,center=120+Math.random()*360,y=-45;
  var leftEnd=center-gap/2,rightStart=center+gap/2;
  var xs=[40,95,150,205,260,315,370,425,480,535,580];
  xs.forEach(function(x){
    if(x<leftEnd||x>rightStart){
      hazards.push({type:'rock',state:'active',risk:risk,x:x+(Math.random()*18-9),y:y+(Math.random()*24-12),r:22+Math.random()*10,pen:hazardPenalty('rock',risk)});
    }
  });
}
function spawnCannonShot(e,offset,delay){
  var risk=e.risk,tx=clamp(player.x+offset+(Math.random()*54-27),45,555),ty=clamp(player.y+(Math.random()*150-75),285,825);
  hazards.push({type:'cannon',state:'warning',risk:risk,targetX:tx,targetY:ty,x:tx,y:ty,r:11,timer:Math.max(.30,.92-risk*.10)+(delay||0),pen:hazardPenalty('cannon',risk)});
}
function spawnCannon(e){
  var risk=e.risk,count=risk>=4?3:(risk>=2?2:1),spacing=125;
  for(var i=0;i<count;i++){
    var centered=i-(count-1)/2;
    spawnCannonShot(e,centered*spacing,i*.07);
  }
}
function spawnPirate(e){
  var risk=e.risk,count=risk>=3?2:1;
  for(var i=0;i<count;i++){
    var lane=(i+1)/(count+1);
    hazards.push({type:'pirate',state:'active',risk:risk,x:70+lane*460+(Math.random()*70-35),y:-70-i*60,r:28,vy:55+risk*12,seek:56+risk*22,pen:hazardPenalty('pirate',risk)});
  }
}
function spawnKing(e){
  var risk=e.risk,count=risk>=3?2:1,firstSide=Math.random()<.5?-1:1;
  for(var i=0;i<count;i++){
    var side=i===0?firstSide:-firstSide,y=300+Math.random()*470;
    hazards.push({type:'king',state:'warning',risk:risk,side:side,x:side<0?-58:658,y:y,r:37,timer:Math.max(.42,1.10-risk*.10)+i*.32,vx:0,pen:hazardPenalty('king',risk)});
  }
}
function spawnPattern(type,e){
  if(type==='rock')spawnRockGate(e);
  else if(type==='cannon')spawnCannon(e);
  else if(type==='pirate')spawnPirate(e);
  else if(type==='king')spawnKing(e);
}
function primaryPatternFor(e){
  if(e.hazard==='海軍')return'cannon';
  if(e.hazard==='海賊')return'pirate';
  if(e.hazard==='海王類')return'king';
  if(e.hazard==='岩礁')return'rock';
  return null;
}
function patternLabel(t){
  if(t==='rock')return'岩礁';
  if(t==='cannon')return'砲撃';
  if(t==='pirate')return'海賊';
  if(t==='king')return'海王類';
  return t;
}
function shuffledPool(excludes){
  excludes=excludes||[];
  var pool=['rock','cannon','pirate','king'].filter(function(t){return excludes.indexOf(t)<0;});
  for(var i=pool.length-1;i>0;i--){
    var j=Math.floor(Math.random()*(i+1)),tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;
  }
  return pool;
}
function encounterTypesFor(e){
  var risk=e.risk,primary=primaryPatternFor(e),types=[];
  var terrainPrimary=(e.hazard==='岩礁'||e.hazard==='海流');

  if(e.hazard==='混在'){
    var mixed=shuffledPool([]);
    if(risk<=1)return mixed.slice(0,1);
    if(risk===2)return mixed.slice(0,2);
    if(risk===3)return mixed.slice(0,3);
    // ★4 mixed seas: three at once; rotate the omitted type by wave.
    var omit=encounterIndex%4;
    return mixed.filter(function(_,i){return i!==omit;}).slice(0,3);
  }

  // ★1 should still ask the player to do something regularly.
  // Terrain itself counts as the main layer; add a secondary sometimes.
  if(risk<=1){
    if(!terrainPrimary&&primary)types.push(primary);
    if(Math.random()<.38){
      var mild=shuffledPool(types.concat(terrainPrimary?['rock']:[]))[0];
      if(mild)types.push(mild);
    }
    return types;
  }

  // ★4: three layers in the main wave, keeping the route's identity.
  // A delayed fourth layer is added only on some waves by queueEncounter().
  if(risk>=4){
    if(!terrainPrimary&&primary)types.push(primary);
    var hardExcludes=types.concat(terrainPrimary?['rock']:[]);
    return types.concat(shuffledPool(hardExcludes).slice(0,2));
  }

  // ★2–3: keep main identity, then add secondary patterns.
  if(!terrainPrimary&&primary)types.push(primary);
  var visibleLayers=terrainPrimary?1:types.length;
  var need=Math.max(0,risk-visibleLayers);
  var extras=shuffledPool(types.concat(terrainPrimary?['rock']:[])).slice(0,need);
  return types.concat(extras);
}
function terrainLabelFor(e){
  if(e.hazard==='岩礁')return'岩礁地形';
  if(e.hazard==='海流')return'海流';
  return null;
}
function queueEncounter(types,e){
  var risk=e.risk;
  var gap=risk>=4?.52:(risk===3?.46:(risk===2?.36:.28));
  types.forEach(function(t,i){
    pendingPatterns.push({type:t,edge:e,delay:i*gap});
  });

  // ★4: every third wave introduces the missing fourth danger later,
  // after the player has had time to react to the first three.
  if(risk>=4&&e.hazard!=='混在'&&encounterIndex%3===2){
    var missing=shuffledPool(types)[0];
    if(missing)pendingPatterns.push({type:missing,edge:e,delay:1.7});
  }

  var labels=[];
  var terrain=terrainLabelFor(e);if(terrain)labels.push(terrain);
  types.forEach(function(t){labels.push(patternLabel(t));});
  lastEncounterLabels=labels;
  encounterIndex++;
}
function updatePendingPatterns(dt){
  if(!pendingPatterns.length)return;
  pendingPatterns.forEach(function(p){p.delay-=dt;});
  var due=pendingPatterns.filter(function(p){return p.delay<=0;});
  pendingPatterns=pendingPatterns.filter(function(p){return p.delay>0;});
  due.forEach(function(p){spawnPattern(p.type,p.edge);});
}
function spawnHazard(){
  if(!currentEdge)return;
  var types=encounterTypesFor(currentEdge);
  queueEncounter(types,currentEdge);
}
function nextSpawnDistance(e){
  // Difficulty now comes mainly from overlap/decision load, not constant spam.
  if(e.risk>=4)return 300+Math.random()*95;
  if(e.risk===3)return 315+Math.random()*100;
  if(e.risk===2)return 335+Math.random()*110;
  // ★1 used to be too empty; keep the single-pattern pressure coming.
  return 300+Math.random()*105;
}

function reefCenterAt(screenY){
  if(!currentEdge)return 300;
  var phase=edgeProgress*.105+(H-screenY)*.0105;
  var amp=105+currentEdge.risk*20;
  var raw=300+Math.sin(phase)*amp+Math.sin(phase*.47+1.3)*32;
  return Math.round(raw/8)*8;
}
function reefHalfWidth(){
  if(!currentEdge)return 220;
  return Math.max(78,145-currentEdge.risk*13);
}
function hitTerrain(label,pen){
  if(terrainHitCooldown>0||invuln>0)return;
  terrainHitCooldown=.85;invuln=.65;damage++;gameMinutes-=pen;
  banner.textContent=label+'！ -'+pen+'分';
  flash.style.background='#ff8d4a';flash.style.opacity='.52';setTimeout(function(){flash.style.opacity='0';},140);
  if(gameMinutes<=0)finish(false);
}
function updateReefTerrain(dt){
  if(!currentEdge||currentEdge.hazard!=='岩礁')return;
  var c=reefCenterAt(player.y),hw=reefHalfWidth();
  var left=c-hw+player.r,right=c+hw-player.r;
  if(player.x<left){
    player.x=left;player.vx=Math.max(90,Math.abs(player.vx)*.42);
    hitTerrain('岩壁に接触',8+currentEdge.risk*2);
  }else if(player.x>right){
    player.x=right;player.vx=-Math.max(90,Math.abs(player.vx)*.42);
    hitTerrain('岩壁に接触',8+currentEdge.risk*2);
  }
}
function updateCurrentForce(dt){
  if(!currentEdge||currentEdge.hazard!=='海流')return;
  var strength=125+currentEdge.risk*42;
  var pulse=.78+.22*Math.sin(edgeProgress*.36);
  player.vx+=flowDir*strength*pulse*dt;
  if(player.x<34||player.x>566)hitTerrain('海流に押し流された',7+currentEdge.risk*2);
}
function drawReefTerrain(){
  if(!currentEdge||currentEdge.hazard!=='岩礁')return;
  var hw=reefHalfWidth(),left=[],right=[];
  for(var y=-30;y<=H+30;y+=24){
    var c=reefCenterAt(y);
    left.push({x:c-hw,y:y});right.push({x:c+hw,y:y});
  }
  ctx.fillStyle='#394c50';ctx.beginPath();ctx.moveTo(0,-30);
  left.forEach(function(p){ctx.lineTo(p.x,p.y);});ctx.lineTo(0,H+30);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(W,-30);right.forEach(function(p){ctx.lineTo(p.x,p.y);});ctx.lineTo(W,H+30);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#788b83';ctx.lineWidth=8;ctx.beginPath();left.forEach(function(p,i){if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();
  ctx.beginPath();right.forEach(function(p,i){if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();
  ctx.fillStyle='rgba(188,207,180,.45)';
  for(var i=0;i<left.length;i+=3){
    ctx.beginPath();ctx.arc(left[i].x-7,left[i].y,7,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(right[i].x+7,right[i].y+9,6,0,Math.PI*2);ctx.fill();
  }
}
function drawCurrent(){
  if(!currentEdge||currentEdge.hazard!=='海流')return;
  var dir=flowDir,shift=Math.floor((performance.now()*.09)%96/8)*8;
  ctx.save();ctx.fillStyle='rgba(200,245,255,.68)';
  for(var y=176;y<850;y+=112){
    for(var x=-96+shift;x<696;x+=128){
      var xx=dir>0?x:W-x;
      ctx.fillRect(xx,y,dir*40,6);
      ctx.fillRect(xx+dir*32,y-8,dir*8,8);
      ctx.fillRect(xx+dir*32,y+6,dir*8,8);
    }
  }
  ctx.restore();
}
function hit(h){
  if(invuln>0||h.state==='warning')return;
  invuln=1.05;damage++;gameMinutes-=h.pen;
  var name=h.type==='rock'?'岩礁':h.type==='cannon'?'海軍砲撃':h.type==='pirate'?'海賊船':'海王類';
  banner.textContent=name+'！ -'+h.pen+'分';
  flash.style.background='#ff334e';flash.style.opacity='.65';setTimeout(function(){flash.style.opacity='0';},140);
  var dx=player.x-h.x,dy=player.y-h.y,l=Math.hypot(dx,dy)||1;player.vx+=dx/l*260;player.vy+=dy/l*180;
  h.dead=true;if(gameMinutes<=0)finish(false);
}
function updateHazard(h,dt){
  if(h.type==='rock'){
    h.y+=D.scrollSpeed*dt;return;
  }
  if(h.type==='cannon'){
    if(h.state==='warning'){
      h.timer-=dt;
      if(h.timer<=0){
        h.state='active';h.x=clamp(h.targetX+(Math.random()*220-110),30,570);h.y=-35;
        var dx=h.targetX-h.x,dy=h.targetY-h.y,l=Math.hypot(dx,dy)||1,s=390+h.risk*55;
        h.vx=dx/l*s;h.vy=dy/l*s;
      }
    }else{h.x+=h.vx*dt;h.y+=(h.vy+D.scrollSpeed*.18)*dt;}
    return;
  }
  if(h.type==='pirate'){
    h.x+=Math.sign(player.x-h.x)*h.seek*dt;
    h.y+=(D.scrollSpeed+h.vy)*dt;return;
  }
  if(h.type==='king'){
    if(h.state==='warning'){
      h.timer-=dt;
      if(h.timer<=0){h.state='active';h.vx=(h.side<0?1:-1)*(330+h.risk*75);}
    }else{
      h.x+=h.vx*dt;h.y+=Math.sin(performance.now()*.008+h.x*.01)*20*dt;
    }
  }
}
function hazardAlive(h){
  if(h.dead)return false;
  if(h.type==='cannon'&&h.state==='warning')return true;
  if(h.type==='king'&&h.state==='warning')return true;
  return h.y<H+110&&h.y>-150&&h.x>-160&&h.x<W+160;
}
function finish(ok){
  running=false;liveMap.classList.add('hidden');end.classList.remove('hidden');
  end.classList.toggle('success',!!ok);end.classList.toggle('failure',!ok);

  var records=loadRecords(),sig=routeSignature(),wasNew=false;records.attempts++;
  if(ok){
    records.successes++;
    if(!records.routes[sig]){records.routes[sig]=1;wasNew=true;}else records.routes[sig]++;
    if(records.bestRemaining===null||gameMinutes>records.bestRemaining)records.bestRemaining=gameMinutes;
    if(records.minDamage===null||damage<records.minDamage)records.minDamage=damage;
  }
  saveRecords(records);

  var eyebrow=document.getElementById('resultEyebrow');
  if(ok){
    eyebrow.textContent='MISSION COMPLETE?';
    endTitle.textContent='帰還成功！';
    endText.innerHTML='<b>まだ……たぶんバレてねェ！！</b><br>残り '+fmt(gameMinutes)+' / 接触 '+damage+'回<span class="routeResult">経由 '+visitedNodes.join(' → ')+'</span>';
  }else{
    eyebrow.textContent='CROSS GUILD / INCOMING';
    endTitle.textContent='……バギー。';
    endText.innerHTML='<span class="apology">ごめんなさい。<br>すいませんでした。<br>二度としません。<br>許してください。</span><span class="routeResult">時間切れ / 経由 '+visitedNodes.join(' → ')+'</span>';
  }

  var unique=Object.keys(records.routes).length,rt=document.getElementById('recordText');
  if(rt)rt.innerHTML='<b>'+((ok&&wasNew)?'NEW ROUTE!':'航海記録')+'</b>　帰還成功ルート '+unique+'種'+(records.bestRemaining!==null?'　｜ BEST '+fmt(records.bestRemaining):'')+(records.minDamage!==null?'　｜ 最少接触 '+records.minDamage:'');
  updateRecordSummary();
}
function update(dt){
  if(!running)return;
  var ix=clamp(input.x+manual.x,-1,1),iy=clamp(input.y+manual.y,-1,1);
  player.vx+=ix*900*dt;player.vy+=iy*675*dt;
  var drag=Math.pow(.055,dt);player.vx*=drag;player.vy*=drag;
  var sp=Math.hypot(player.vx,player.vy),max=500;if(sp>max){player.vx*=max/sp;player.vy*=max/sp;}
  player.x=clamp(player.x+player.vx*dt,30,570);player.y=clamp(player.y+player.vy*dt,240,835);
  if(invuln>0)invuln-=dt;
  if(terrainHitCooldown>0)terrainHitCooldown-=dt;
  updateCurrentForce(dt);
  updateReefTerrain(dt);
  gameMinutes-=dt*D.minutesPerSecond;updateHud();
  if(gameMinutes<=0){finish(false);return;}
  if(fork){
    if(forkDelay>0)forkDelay-=dt;else forkY+=D.scrollSpeed*dt;
    if(forkY>player.y-35)resolveFork();return;
  }
  if(currentEdge){
    edgeProgress+=dt*D.minutesPerSecond;
    nextHazard-=dt*D.scrollSpeed;
    if(nextHazard<=0){spawnHazard();nextHazard=nextSpawnDistance(currentEdge);}
    updatePendingPatterns(dt);
    hazards.forEach(function(h){updateHazard(h,dt);if(h.state!=='warning'&&Math.hypot(player.x-h.x,player.y-h.y)<player.r+h.r)hit(h);});
    hazards=hazards.filter(hazardAlive);
    if(edgeProgress>=currentEdge.sail)arrive();
  }
}
function drawSea(){
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#2786C1';ctx.fillRect(0,0,W,H);

  var off=Math.floor((performance.now()*.055)%48);
  ctx.fillStyle='#55B8D0';
  for(var y=-48+off;y<H;y+=48){
    for(var x=0;x<W;x+=72){
      ctx.fillRect(x,y+((x/72)%2)*8,30,4);
      ctx.fillRect(x+10,y+8+((x/72)%2)*8,28,4);
    }
  }

  // Decorative foam is non-collidable and intentionally sparse.
  var foamOff=Math.floor((performance.now()*.032)%120);
  for(var fy=-100+foamOff;fy<H;fy+=150){
    for(var fx=24;fx<W;fx+=170){
      A.drawFoam(ctx,fx+((fy/50)%2)*26,fy,(fx+fy)%3);
    }
  }

  // Route identity appears in the unreachable top band.
  if(currentEdge&&currentEdge.hazard==='海軍'){
    A.drawMarineShip(ctx,96,104,.72);
    A.drawMarineShip(ctx,510,132,.62);
  }else if(currentEdge&&currentEdge.hazard==='岩礁'){
    A.drawSmallIsland(ctx,52,116,0);
    A.drawSmallIsland(ctx,548,145,1);
  }else if(currentEdge&&currentEdge.hazard==='海賊'){
    A.drawPirateShip(ctx,90,122,1);
  }

  // Small buoy field gives scale but never enters player collision logic.
  if(currentEdge&&currentEdge.risk>=3){
    A.drawBuoy(ctx,55,210);
    A.drawBuoy(ctx,545,185);
  }
}
function drawRock(h){
  A.drawRock(ctx,h.x,h.y,h.r,Math.floor(h.x+h.y)%3);
}
function drawCannon(h){
  if(h.state==='warning'){
    var tx=Math.round(h.targetX/4)*4,ty=Math.round(h.targetY/4)*4;
    ctx.fillStyle='#F4C84B';
    ctx.fillRect(tx-34,ty-3,24,6);ctx.fillRect(tx+10,ty-3,24,6);
    ctx.fillRect(tx-3,ty-34,6,24);ctx.fillRect(tx-3,ty+10,6,24);
    ctx.fillStyle='#E43D45';ctx.fillRect(tx-8,ty-8,16,16);
    ctx.fillStyle='#172B3C';ctx.fillRect(tx-4,ty-4,8,8);
  }else{
    var x=Math.round(h.x),y=Math.round(h.y);
    ctx.fillStyle='#E98438';ctx.fillRect(x-4,y-20,8,12);
    ctx.fillStyle='#172B3C';ctx.fillRect(x-9,y-9,18,18);
    ctx.fillStyle='#55545A';ctx.fillRect(x-5,y-5,10,10);
  }
}
function drawPirate(h){
  A.drawPirateShip(ctx,h.x,h.y,Math.floor(h.x/80)%2);
}
function drawKing(h){
  var y=Math.round(h.y/4)*4;
  if(h.state==='warning'){
    ctx.fillStyle='rgba(241,154,175,.25)';ctx.fillRect(0,y-44,W,88);
    ctx.fillStyle='#E43D45';
    if(h.side<0){ctx.fillRect(8,y-6,48,12);ctx.fillRect(44,y-16,12,32);}
    else{ctx.fillRect(W-56,y-6,48,12);ctx.fillRect(W-56,y-16,12,32);}
    ctx.fillStyle='#FFF1D6';ctx.font='bold 18px monospace';ctx.textAlign=h.side<0?'left':'right';
    ctx.fillText('SEA KING!',h.side<0?70:530,y+6);
  }else{
    A.drawSeaKing(ctx,h.x,h.y,h.r,Math.floor(h.y/90)%2);
  }
}
function drawHazard(h){if(h.type==='rock')drawRock(h);else if(h.type==='cannon')drawCannon(h);else if(h.type==='pirate')drawPirate(h);else drawKing(h);}
function drawFork(){
  if(!fork)return;var cs=forkCenters(fork.edges.length);
  ctx.fillStyle='rgba(255,241,214,.18)';
  if(fork.edges.length===2)ctx.fillRect(297,0,6,H);
  else{ctx.fillRect(197,0,6,H);ctx.fillRect(397,0,6,H);}

  fork.edges.forEach(function(e,i){
    var x=Math.round(cs[i]),y=Math.round(forkY),n=D.nodes[e.to];
    // pixel island sign
    ctx.fillStyle='#172B3C';ctx.fillRect(x-54,y-33,108,66);
    ctx.fillStyle='#D7B576';ctx.fillRect(x-49,y-28,98,56);
    ctx.fillStyle='#4a9b63';ctx.fillRect(x-35,y-22,70,12);
    ctx.fillStyle='#FFF1D6';ctx.fillRect(x-42,y-7,84,29);
    ctx.fillStyle='#172B3C';ctx.textAlign='center';ctx.font='bold 17px monospace';ctx.fillText(e.to+'島',x,y+5);
    ctx.font='bold 10px monospace';ctx.fillText('LOG '+n.log+'m / '+e.sail+'m',x,y+18);
    ctx.fillStyle='#E43D45';ctx.font='bold 10px monospace';ctx.fillText(meta(e.hazard).short+' '+riskStars(e.risk),x,y+41);
  });
}
function drawPlayer(){
  var lean=clamp(player.vx/500,-1,1);
  var flashState=invuln>0&&Math.floor(invuln*12)%2===0;
  A.drawPlayerShip(ctx,player.x,player.y,lean,flashState);
}
function draw(){
  drawSea();drawCurrent();drawReefTerrain();hazards.forEach(drawHazard);drawFork();drawPlayer();
  ctx.fillStyle='#FFF1D6';ctx.font='bold 12px monospace';ctx.textAlign='left';
  if(currentEdge){
    ctx.fillText(currentEdge.from+'→'+currentEdge.to+'  '+Math.floor(edgeProgress)+' / '+currentEdge.sail+'m  MAIN:'+meta(currentEdge.hazard).short,12,H-29);

  }
}
function loop(now){var dt=clamp((now-last)/1000,0,.033);last=now;update(dt);draw();requestAnimationFrame(loop);}
document.getElementById('start').addEventListener('click',startGame);
window.__BUGGY_START_READY=true;
document.getElementById('retry').addEventListener('click',function(){planning.classList.remove('hidden');end.classList.add('hidden');end.classList.remove('success','failure');resetGame();});
document.getElementById('mapBtn').addEventListener('click',function(){buildMap('liveMapBody',true);liveMap.classList.remove('hidden');});
document.getElementById('closeMap').addEventListener('click',function(){liveMap.classList.add('hidden');});
var keys=new Set();function keyUpdate(){manual.x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);manual.y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);}
window.addEventListener('keydown',function(e){keys.add(e.code);keyUpdate();});window.addEventListener('keyup',function(e){keys.delete(e.code);keyUpdate();});
document.querySelectorAll('.dpad button').forEach(function(b){var x=Number(b.dataset.x),y=Number(b.dataset.y);function p(e){e.preventDefault();manual.x=x;manual.y=y;}function r(e){e.preventDefault();manual.x=0;manual.y=0;}b.addEventListener('pointerdown',p);b.addEventListener('pointerup',r);b.addEventListener('pointercancel',r);b.addEventListener('pointerleave',r);});
resetGame();requestAnimationFrame(loop);
})();