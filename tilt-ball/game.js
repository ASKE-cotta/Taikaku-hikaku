(function(){
'use strict';
var D=window.ROUTE_DATA,W=600,H=900;
var canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
var timeEl=document.getElementById('time'),placeEl=document.getElementById('place'),routeNowEl=document.getElementById('routeNow'),damageEl=document.getElementById('damage');
var banner=document.getElementById('banner'),sensorEl=document.getElementById('sensor'),flash=document.getElementById('flash');
var planning=document.getElementById('planning'),liveMap=document.getElementById('liveMap'),end=document.getElementById('end');
var endTitle=document.getElementById('endTitle'),endText=document.getElementById('endText');
var player={x:300,y:730,vx:0,vy:0,r:20},input={x:0,y:0},manual={x:0,y:0};
var baseB=null,baseG=null,baseMX=null,baseMY=null,lastOri=0,lastMotion=0;
var running=false,last=performance.now(),gameMinutes=D.initialMinutes,damage=0,invuln=0;
var currentNode=D.start,currentEdge=null,edgeProgress=0,nextHazard=0,hazards=[];
var fork=null,forkY=-180,forkDelay=0,visitedNodes=[D.start],visitedEdges=[];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function fmt(m){m=Math.max(0,Math.ceil(m));var h=Math.floor(m/60),mm=m%60;return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');}
function key(e){return e.from+'-'+e.to;}
function outgoing(n){return D.edges.filter(function(e){return e.from===n;});}
function riskStars(n){return '★'.repeat(n)+'☆'.repeat(4-n);}
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
    window.addEventListener('deviceorientation',onOrientation,true);
    window.addEventListener('devicemotion',onMotion,true);
    sensorEl.textContent='端末を傾けてください';
  }catch(e){sensorEl.textContent='センサー不可：ボタン操作';}
}
function updateHud(){
  timeEl.textContent=fmt(gameMinutes);
  placeEl.textContent=D.nodes[currentNode].name;
  routeNowEl.textContent=currentEdge?D.nodes[currentEdge.to].name+'へ / '+currentEdge.hazard+' '+riskStars(currentEdge.risk):fork?'航路選択中':'待機';
  damageEl.textContent=String(damage);
  var lm=document.getElementById('liveTime');if(lm)lm.textContent=fmt(gameMinutes);
}
function buildMap(targetId,live){
  var host=document.getElementById(targetId),svg=[];
  svg.push('<svg viewBox="0 0 600 580" class="routeSvg" aria-label="航路海図">');
  D.edges.forEach(function(e){
    var a=D.nodes[e.from],b=D.nodes[e.to],eid=key(e);
    var cls='mapEdge';
    if(visitedEdges.indexOf(eid)>=0)cls+=' visited';
    if(currentEdge&&key(currentEdge)===eid)cls+=' current';
    svg.push('<line class="'+cls+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>');
    var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    svg.push('<text class="edgeLabel" x="'+mx+'" y="'+(my-4)+'" text-anchor="middle">'+e.sail+'m '+riskStars(e.risk)+'</text>');
  });
  Object.keys(D.nodes).forEach(function(id){
    var n=D.nodes[id],cls='mapNode';
    if(visitedNodes.indexOf(id)>=0)cls+=' visited';
    if(currentNode===id)cls+=' current';
    if(id===D.goal)cls+=' goal';
    svg.push('<g class="'+cls+'"><circle cx="'+n.x+'" cy="'+n.y+'" r="'+(id===D.goal?31:25)+'"/><text x="'+n.x+'" y="'+(n.y-2)+'" text-anchor="middle">'+(id===D.goal?'GOAL':id)+'</text>');
    if(id!==D.start&&id!==D.goal)svg.push('<text class="nodeSub" x="'+n.x+'" y="'+(n.y+13)+'" text-anchor="middle">LOG '+n.log+'m</text>');
    svg.push('</g>');
  });
  svg.push('</svg>');
  var rows=D.edges.map(function(e){return '<div class="edgeRow"><b>'+e.from+'→'+e.to+'</b><span>'+e.sail+'分</span><span>'+e.hazard+'</span><span>'+riskStars(e.risk)+'</span></div>';}).join('');
  host.innerHTML='<div class="mapTop">'+(live?'<b>航海中：海図を見ても止まりません</b><span>残り <strong id="liveTime">'+fmt(gameMinutes)+'</strong></span>':'<b>出航前：ここでは時間停止</b><span>じっくり作戦を立ててOK</span>')+'</div>'+svg.join('')+'<div class="mapLegend">島の数字＝ログ記録時間 / 線の数字＝航行時間 / ★＝危険度</div><div class="edgeTable">'+rows+'</div>';
}
function resetGame(){
  player.x=300;player.y=730;player.vx=player.vy=0;input.x=input.y=manual.x=manual.y=0;
  gameMinutes=D.initialMinutes;damage=0;invuln=0;currentNode=D.start;currentEdge=null;edgeProgress=0;nextHazard=0;hazards=[];
  fork=null;forkY=-180;forkDelay=.4;visitedNodes=[D.start];visitedEdges=[];banner.textContent='まずは最初の航路を選べ！';
  updateHud();buildMap('planningMap',false);buildMap('liveMapBody',true);
}
function startGame(){
  resetGame();planning.classList.add('hidden');end.classList.add('hidden');liveMap.classList.add('hidden');running=true;last=performance.now();enableSensor();prepareFork();
}
function prepareFork(){
  var outs=outgoing(currentNode);
  if(!outs.length)return;
  if(outs.length===1){beginEdge(outs[0]);return;}
  fork={edges:outs};forkY=-160;forkDelay=.6;currentEdge=null;hazards=[];
  banner.textContent='次の航路を選べ！ '+outs.map(function(e){return e.to;}).join(' / ');
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
  currentEdge=e;edgeProgress=0;nextHazard=240;hazards=[];visitedEdges.push(key(e));
  banner.textContent=e.to+'へ！ '+e.sail+'分 / '+e.hazard+' '+riskStars(e.risk);
  updateHud();buildMap('liveMapBody',true);
}
function arrive(){
  var n=D.nodes[currentEdge.to];currentNode=currentEdge.to;visitedNodes.push(currentNode);currentEdge=null;hazards=[];
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
  if(type==='pirate')return 12+risk*3;
  return 15+risk*4;
}
function edgeHazardType(e){
  if(e.hazard==='岩礁')return'rock';
  if(e.hazard==='海軍')return Math.random()<.75?'cannon':'rock';
  if(e.hazard==='海賊')return Math.random()<.75?'pirate':'rock';
  if(e.hazard==='海王類')return Math.random()<.8?'king':'rock';
  return['rock','cannon','pirate','king'][Math.floor(Math.random()*4)];
}
function spawnHazard(){
  var e=currentEdge;if(!e)return;
  var t=edgeHazardType(e),h={type:t,risk:e.risk,x:55+Math.random()*490,y:-55,r:24,vy:0,vx:0};
  if(t==='rock'){h.r=20+Math.random()*18;}
  if(t==='cannon'){h.r=10;h.vy=120+e.risk*25;}
  if(t==='pirate'){h.r=25;h.vx=(Math.random()<.5?-1:1)*(80+e.risk*18);}
  if(t==='king'){h.r=34;h.x=Math.random()<.5?-60:660;h.y=120+Math.random()*280;h.vx=h.x<0?(105+e.risk*18):-(105+e.risk*18);}
  h.pen=hazardPenalty(t,e.risk);hazards.push(h);
}
function hit(h){
  if(invuln>0)return;invuln=1.05;damage++;gameMinutes-=h.pen;damageEl.textContent=String(damage);
  var name=h.type==='rock'?'岩礁':h.type==='cannon'?'海軍砲撃':h.type==='pirate'?'海賊船':'海王類';
  banner.textContent=name+'！ -'+h.pen+'分';
  flash.style.background='#ff334e';flash.style.opacity='.65';setTimeout(function(){flash.style.opacity='0';},140);
  var dx=player.x-h.x,dy=player.y-h.y,l=Math.hypot(dx,dy)||1;player.vx+=dx/l*260;player.vy+=dy/l*180;
  if(gameMinutes<=0)finish(false);
}
function finish(ok){
  running=false;liveMap.classList.add('hidden');end.classList.remove('hidden');
  endTitle.textContent=ok?'帰還成功！':'……バギー。';
  endText.innerHTML=ok?'残り <b>'+fmt(gameMinutes)+'</b> でカライ・バリ島へ帰還。<br>被害 '+damage+'回 / 経由 '+visitedNodes.join(' → '):'時間切れ。<br>経由 '+visitedNodes.join(' → ')+'<br>嫌な予感しかしない。';
}
function update(dt){
  if(!running)return;
  var ix=clamp(input.x+manual.x,-1,1),iy=clamp(input.y+manual.y,-1,1);
  player.vx+=ix*900*dt;player.vy+=iy*760*dt;
  var drag=Math.pow(.055,dt);player.vx*=drag;player.vy*=drag;
  var sp=Math.hypot(player.vx,player.vy),max=500;if(sp>max){player.vx*=max/sp;player.vy*=max/sp;}
  player.x=clamp(player.x+player.vx*dt,30,570);player.y=clamp(player.y+player.vy*dt,240,835);
  if(invuln>0)invuln-=dt;
  gameMinutes-=dt*D.minutesPerSecond;updateHud();
  if(gameMinutes<=0){finish(false);return;}
  if(fork){
    if(forkDelay>0)forkDelay-=dt;else forkY+=D.scrollSpeed*dt;
    if(forkY>player.y-35)resolveFork();
    return;
  }
  if(currentEdge){
    edgeProgress+=dt*D.minutesPerSecond;
    nextHazard-=dt*D.scrollSpeed;
    if(nextHazard<=0){spawnHazard();nextHazard=(320-currentEdge.risk*45)+Math.random()*180;}
    hazards.forEach(function(h){h.y+=D.scrollSpeed*dt+(h.vy||0)*dt;h.x+=(h.vx||0)*dt;if(Math.hypot(player.x-h.x,player.y-h.y)<player.r+h.r)hit(h);});
    hazards=hazards.filter(function(h){return h.y<H+100&&h.x>-120&&h.x<W+120;});
    if(edgeProgress>=currentEdge.sail)arrive();
  }
}
function drawSea(){
  ctx.fillStyle='#0a5d78';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=2;
  var off=(performance.now()*.05)%70;
  for(var y=-70+off;y<H;y+=70){ctx.beginPath();for(var x=0;x<=W;x+=30)ctx.lineTo(x,y+Math.sin((x+y)*.035)*5);ctx.stroke();}
}
function drawHazard(h){
  if(h.type==='rock'){ctx.fillStyle='#66747d';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();}
  else if(h.type==='cannon'){ctx.fillStyle='#111';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffb347';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(h.x,h.y-14);ctx.lineTo(h.x,h.y-26);ctx.stroke();}
  else if(h.type==='pirate'){ctx.fillStyle='#8e3b46';ctx.fillRect(h.x-24,h.y-16,48,32);ctx.fillStyle='#eee';ctx.fillRect(h.x-2,h.y-34,4,30);}
  else{ctx.fillStyle='#7c3aed';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h.x-10,h.y-7,4,0,Math.PI*2);ctx.arc(h.x+10,h.y-7,4,0,Math.PI*2);ctx.fill();}
}
function drawFork(){
  if(!fork)return;var cs=forkCenters(fork.edges.length);
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.setLineDash([8,8]);
  if(fork.edges.length===2){ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(300,H);ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(200,0);ctx.lineTo(200,H);ctx.moveTo(400,0);ctx.lineTo(400,H);ctx.stroke();}
  ctx.setLineDash([]);
  fork.edges.forEach(function(e,i){
    var x=cs[i],n=D.nodes[e.to];ctx.fillStyle='#e8d7a1';ctx.beginPath();ctx.ellipse(x,forkY,78,48,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#10212e';ctx.textAlign='center';ctx.font='bold 19px sans-serif';ctx.fillText(e.to+'島',x,forkY-5);
    ctx.font='12px sans-serif';ctx.fillText('LOG '+n.log+'m',x,forkY+13);ctx.fillText(e.sail+'m / '+riskStars(e.risk),x,forkY+29);
  });
}
function drawPlayer(){
  ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.vx*.0005);if(invuln>0&&Math.floor(invuln*12)%2===0)ctx.globalAlpha=.25;
  ctx.fillStyle='#f4c24d';ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(24,23);ctx.lineTo(0,15);ctx.lineTo(-24,23);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8b2727';ctx.fillRect(-4,-12,8,30);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,-8,7,0,Math.PI*2);ctx.fill();ctx.restore();
}
function draw(){
  drawSea();hazards.forEach(drawHazard);drawFork();drawPlayer();
  ctx.fillStyle='rgba(255,255,255,.76)';ctx.font='12px sans-serif';ctx.textAlign='left';
  if(currentEdge)ctx.fillText(currentEdge.from+'→'+currentEdge.to+' '+Math.floor(edgeProgress)+' / '+currentEdge.sail+'分',12,H-15);
}
function loop(now){var dt=clamp((now-last)/1000,0,.033);last=now;update(dt);draw();requestAnimationFrame(loop);}
document.getElementById('start').addEventListener('click',startGame);
document.getElementById('retry').addEventListener('click',function(){planning.classList.remove('hidden');end.classList.add('hidden');resetGame();});
document.getElementById('mapBtn').addEventListener('click',function(){buildMap('liveMapBody',true);liveMap.classList.remove('hidden');});
document.getElementById('closeMap').addEventListener('click',function(){liveMap.classList.add('hidden');});
var keys=new Set();function keyUpdate(){manual.x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);manual.y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);}
window.addEventListener('keydown',function(e){keys.add(e.code);keyUpdate();});window.addEventListener('keyup',function(e){keys.delete(e.code);keyUpdate();});
document.querySelectorAll('.dpad button').forEach(function(b){var x=Number(b.dataset.x),y=Number(b.dataset.y);function p(e){e.preventDefault();manual.x=x;manual.y=y;}function r(e){e.preventDefault();manual.x=0;manual.y=0;}b.addEventListener('pointerdown',p);b.addEventListener('pointerup',r);b.addEventListener('pointercancel',r);b.addEventListener('pointerleave',r);});
resetGame();requestAnimationFrame(loop);
})();