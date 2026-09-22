(function(){
'use strict';
var D=window.ROUTE_DATA,W=600,H=900;
var canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
var timeEl=document.getElementById('time'),placeEl=document.getElementById('place'),routeNowEl=document.getElementById('routeNow');
var banner=document.getElementById('banner'),sensorEl=document.getElementById('sensor'),flash=document.getElementById('flash');
var planning=document.getElementById('planning'),liveMap=document.getElementById('liveMap'),end=document.getElementById('end');
var endTitle=document.getElementById('endTitle'),endText=document.getElementById('endText');
var player={x:300,y:730,vx:0,vy:0,r:20},input={x:0,y:0},manual={x:0,y:0};
var baseB=null,baseG=null,baseMX=null,baseMY=null,lastOri=0,lastMotion=0,sensorListenersAdded=false;
var running=false,last=performance.now(),gameMinutes=D.initialMinutes,damage=0,invuln=0;
var currentNode=D.start,currentEdge=null,edgeProgress=0,nextHazard=0,hazards=[],pendingPatterns=[],lastEncounterLabels=[],flowDir=1,terrainHitCooldown=0;
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
  gameMinutes=D.initialMinutes;damage=0;invuln=0;currentNode=D.start;currentEdge=null;edgeProgress=0;nextHazard=0;hazards=[];pendingPatterns=[];lastEncounterLabels=[];flowDir=1;terrainHitCooldown=0;
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
  currentEdge=e;edgeProgress=0;nextHazard=220;hazards=[];pendingPatterns=[];lastEncounterLabels=[];terrainHitCooldown=0;visitedEdges.push(key(e));
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
  var risk=e.risk,gap=190-risk*18,center=120+Math.random()*360,y=-45;
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
  var risk=e.risk,count=risk>=4?4:(risk>=3?3:2),spacing=115;
  for(var i=0;i<count;i++){
    var centered=i-(count-1)/2;
    spawnCannonShot(e,centered*spacing,i*.07);
  }
}
function spawnPirate(e){
  var risk=e.risk,count=risk>=4?3:(risk>=3?2:1);
  for(var i=0;i<count;i++){
    var lane=(i+1)/(count+1);
    hazards.push({type:'pirate',state:'active',risk:risk,x:70+lane*460+(Math.random()*70-35),y:-70-i*60,r:28,vy:55+risk*12,seek:58+risk*26,pen:hazardPenalty('pirate',risk)});
  }
}
function spawnKing(e){
  var risk=e.risk,count=risk>=3?2:1,firstSide=Math.random()<.5?-1:1;
  for(var i=0;i<count;i++){
    var side=i===0?firstSide:-firstSide,y=300+Math.random()*470;
    hazards.push({type:'king',state:'warning',risk:risk,side:side,x:side<0?-58:658,y:y,r:37,timer:Math.max(.36,1.02-risk*.11)+i*.24,vx:0,pen:hazardPenalty('king',risk)});
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
  if(e.hazard==='混在'){
    return shuffledPool([]).slice(0,risk>=4?4:(risk>=3?3:2));
  }
  if(risk>=4)return['rock','cannon','pirate','king'];

  var terrainPrimary=(e.hazard==='岩礁'||e.hazard==='海流');
  if(!terrainPrimary&&primary)types.push(primary);

  // 「危険レイヤー数」を★数と一致させる。
  // 岩礁/海流は地形そのものを1レイヤーとして数える。
  var visibleLayers=terrainPrimary?1:types.length;
  var need=Math.max(0,risk-visibleLayers);
  var extras=shuffledPool(types).slice(0,need);
  return types.concat(extras);
}
function terrainLabelFor(e){
  if(e.hazard==='岩礁')return'岩礁地形';
  if(e.hazard==='海流')return'海流';
  return null;
}
function queueEncounter(types,e){
  pendingPatterns=[];
  types.forEach(function(t,i){
    pendingPatterns.push({type:t,edge:e,delay:i*.16});
  });
  var labels=[];
  var terrain=terrainLabelFor(e);if(terrain)labels.push(terrain);
  types.forEach(function(t){labels.push(patternLabel(t));});
  lastEncounterLabels=labels;
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
  if((e.hazard==='岩礁'||e.hazard==='海流')&&e.risk<=1)return 99999;
  if(e.risk>=4)return 205+Math.random()*72;
  if(e.risk===3)return 245+Math.random()*92;
  if(e.risk===2)return 310+Math.random()*105;
  return 390+Math.random()*120;
}

function reefCenterAt(screenY){
  if(!currentEdge)return 300;
  var phase=edgeProgress*.105+(H-screenY)*.0105;
  var amp=105+currentEdge.risk*20;
  return 300+Math.sin(phase)*amp+Math.sin(phase*.47+1.3)*32;
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
  var dir=flowDir,shift=(performance.now()*.11)%90;
  ctx.save();ctx.strokeStyle='rgba(139,225,255,.55)';ctx.fillStyle='rgba(139,225,255,.55)';ctx.lineWidth=5;
  for(var y=170;y<850;y+=115){
    for(var x=-90+shift;x<690;x+=120){
      var xx=dir>0?x:W-x;
      ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx+dir*52,y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(xx+dir*52,y);ctx.lineTo(xx+dir*36,y-10);ctx.lineTo(xx+dir*36,y+10);ctx.closePath();ctx.fill();
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
  ctx.fillStyle='rgba(245,244,237,.72)';
  for(var yy=-70+off*2;yy<H;yy+=96){
    for(var xx=20;xx<W;xx+=120)ctx.fillRect(xx,yy,18,3);
  }
}
function drawRock(h){
  var x=Math.round(h.x),y=Math.round(h.y),r=Math.max(12,Math.round(h.r));
  ctx.fillStyle='#172B3C';ctx.fillRect(x-r,y-r+6,r*2,r*2-8);
  ctx.fillStyle='#55545A';ctx.fillRect(x-r+4,y-r+2,r*2-8,r*2-8);
  ctx.fillStyle='#8b97a2';ctx.fillRect(x-r+8,y-r+7,Math.max(7,r-4),7);
  ctx.fillStyle='#394c50';ctx.fillRect(x+2,y+3,Math.max(7,r-5),Math.max(7,r-8));
}
function drawCannon(h){
  if(h.state==='warning'){
    var pulse=.65+.25*Math.sin(performance.now()*.015);ctx.strokeStyle='rgba(255,190,70,'+pulse+')';ctx.lineWidth=4;ctx.setLineDash([10,7]);
    ctx.beginPath();ctx.arc(h.targetX,h.targetY,30,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(h.targetX-42,h.targetY);ctx.lineTo(h.targetX+42,h.targetY);ctx.moveTo(h.targetX,h.targetY-42);ctx.lineTo(h.targetX,h.targetY+42);ctx.stroke();ctx.setLineDash([]);
  }else{ctx.fillStyle='#111';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffb347';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(h.x-h.vx*.025,h.y-h.vy*.025);ctx.lineTo(h.x-h.vx*.055,h.y-h.vy*.055);ctx.stroke();}
}
function drawPirate(h){
  var x=Math.round(h.x),y=Math.round(h.y);
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#172B3C';ctx.fillRect(-24,-14,48,28);
  ctx.fillStyle='#8C2028';ctx.fillRect(-20,-10,40,20);
  ctx.fillStyle='#D7B576';ctx.fillRect(-14,10,28,8);
  ctx.fillStyle='#172B3C';ctx.fillRect(-3,-42,6,33);
  ctx.fillStyle='#F5F4ED';ctx.fillRect(3,-39,23,19);
  ctx.fillStyle='#172B3C';ctx.fillRect(9,-34,10,3);ctx.fillRect(13,-38,3,11);
  ctx.restore();
}
function drawKing(h){
  if(h.state==='warning'){
    ctx.fillStyle='rgba(255,80,110,.24)';ctx.fillRect(0,h.y-48,W,96);ctx.fillStyle='#ff7891';ctx.font='bold 23px sans-serif';ctx.textAlign=h.side<0?'left':'right';ctx.fillText(h.side<0?'▶ 海王類':'海王類 ◀',h.side<0?12:588,h.y+7);
  }else{
    ctx.fillStyle='#7c3aed';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h.x-11,h.y-8,4,0,Math.PI*2);ctx.arc(h.x+11,h.y-8,4,0,Math.PI*2);ctx.fill();
  }
}
function drawHazard(h){if(h.type==='rock')drawRock(h);else if(h.type==='cannon')drawCannon(h);else if(h.type==='pirate')drawPirate(h);else drawKing(h);}
function drawFork(){
  if(!fork)return;var cs=forkCenters(fork.edges.length);
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.setLineDash([8,8]);
  if(fork.edges.length===2){ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(300,H);ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(200,0);ctx.lineTo(200,H);ctx.moveTo(400,0);ctx.lineTo(400,H);ctx.stroke();}
  ctx.setLineDash([]);
  fork.edges.forEach(function(e,i){
    var x=cs[i],n=D.nodes[e.to];ctx.fillStyle='#e8d7a1';ctx.beginPath();ctx.ellipse(x,forkY,82,52,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#10212e';ctx.textAlign='center';ctx.font='bold 18px sans-serif';ctx.fillText(e.to+'島',x,forkY-14);
    ctx.font='11px sans-serif';ctx.fillText('LOG '+n.log+'m / 航行 '+e.sail+'m',x,forkY+4);ctx.fillText(meta(e.hazard).short+' '+riskStars(e.risk),x,forkY+22);
  });
}
function drawPlayer(){
  var x=Math.round(player.x),y=Math.round(player.y),lean=clamp(player.vx/500,-1,1);
  ctx.save();ctx.translate(x,y);ctx.rotate(lean*.08);
  if(invuln>0&&Math.floor(invuln*12)%2===0)ctx.globalAlpha=.25;
  // top-down pixel ship: always points upward.
  ctx.fillStyle='#172B3C';ctx.fillRect(-18,-32,36,53);
  ctx.fillStyle='#D7B576';ctx.fillRect(-13,-27,26,42);
  ctx.fillStyle='#8C2028';ctx.fillRect(-10,10,20,10);
  ctx.fillStyle='#172B3C';ctx.fillRect(-3,-35,6,40);
  // loud Buggy-style red/white sail.
  ctx.fillStyle='#F5F4ED';ctx.fillRect(3,-30,19,28);
  ctx.fillStyle='#E43D45';ctx.fillRect(3,-30,7,28);ctx.fillRect(17,-30,5,28);
  ctx.fillStyle='#2786C1';ctx.fillRect(-8,-10,7,7);
  ctx.fillStyle='#F4C84B';ctx.fillRect(-4,17,8,6);
  ctx.restore();
}
function draw(){
  drawSea();drawCurrent();drawReefTerrain();hazards.forEach(drawHazard);drawFork();drawPlayer();
  ctx.fillStyle='#FFF1D6';ctx.font='bold 12px monospace';ctx.textAlign='left';
  if(currentEdge){
    ctx.fillText(currentEdge.from+'→'+currentEdge.to+' '+Math.floor(edgeProgress)+' / '+currentEdge.sail+'分　'+meta(currentEdge.hazard).short,12,H-29);

  }
}
function loop(now){var dt=clamp((now-last)/1000,0,.033);last=now;update(dt);draw();requestAnimationFrame(loop);}
document.getElementById('start').addEventListener('click',startGame);
document.getElementById('retry').addEventListener('click',function(){planning.classList.remove('hidden');end.classList.add('hidden');end.classList.remove('success','failure');resetGame();});
document.getElementById('mapBtn').addEventListener('click',function(){buildMap('liveMapBody',true);liveMap.classList.remove('hidden');});
document.getElementById('closeMap').addEventListener('click',function(){liveMap.classList.add('hidden');});
var keys=new Set();function keyUpdate(){manual.x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);manual.y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);}
window.addEventListener('keydown',function(e){keys.add(e.code);keyUpdate();});window.addEventListener('keyup',function(e){keys.delete(e.code);keyUpdate();});
document.querySelectorAll('.dpad button').forEach(function(b){var x=Number(b.dataset.x),y=Number(b.dataset.y);function p(e){e.preventDefault();manual.x=x;manual.y=y;}function r(e){e.preventDefault();manual.x=0;manual.y=0;}b.addEventListener('pointerdown',p);b.addEventListener('pointerup',r);b.addEventListener('pointercancel',r);b.addEventListener('pointerleave',r);});
resetGame();requestAnimationFrame(loop);
})();