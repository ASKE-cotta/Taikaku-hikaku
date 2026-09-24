(function(){
'use strict';
var F=window.PixelAssets,D=window.PixelSpriteData;
if(!F||!D)return;

var img=null,ready=false;
try{
  if(typeof Image!=='undefined'){
    img=new Image();
    img.onload=function(){ready=true;window.__PIXEL_SPRITES_READY=true;};
    img.onerror=function(){ready=false;window.__PIXEL_SPRITES_READY=false;};
    img.src=D.src;
  }
}catch(e){ready=false;}

function frame(name){return D.frames[name];}
function drawFrame(ctx,name,x,y,w,h,rot,alpha,flipX){
  var f=frame(name); if(!ready||!img||!f)return false;
  w=w||f[2];h=h||f[3];rot=rot||0;alpha=alpha==null?1:alpha;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha*=alpha;
  ctx.translate(Math.round(x),Math.round(y));
  if(rot)ctx.rotate(rot);
  if(flipX)ctx.scale(-1,1);
  ctx.drawImage(img,f[0],f[1],f[2],f[3],Math.round(-w/2),Math.round(-h/2),Math.round(w),Math.round(h));
  ctx.restore();
  return true;
}

var old={
  player:F.drawPlayerShip,pirate:F.drawPirateShip,marine:F.drawMarineShip,
  king:F.drawSeaKing,rock:F.drawRock,foam:F.drawFoam,buoy:F.drawBuoy,island:F.drawSmallIsland
};

F.drawPlayerShip=function(ctx,x,y,lean,flash){
  if(!drawFrame(ctx,'player',x,y,64,64,(lean||0)*.075,flash?.28:1,false))old.player(ctx,x,y,lean,flash);
};
F.drawPirateShip=function(ctx,x,y,variant){
  if(!drawFrame(ctx,'pirate',x,y,64,64,0,1,(variant||0)%2===1))old.pirate(ctx,x,y,variant);
};
F.drawMarineShip=function(ctx,x,y,scale){
  scale=scale||1;
  if(!drawFrame(ctx,'marine',x,y,64*scale,64*scale,0,1,false))old.marine(ctx,x,y,scale);
};
F.drawSeaKing=function(ctx,x,y,r,variant){
  var size=Math.max(56,(r||34)*2);
  if(!drawFrame(ctx,'seaking',x,y,size,size,0,1,(variant||0)%2===1))old.king(ctx,x,y,r,variant);
};
F.drawRock=function(ctx,x,y,r,variant){
  var size=Math.max(38,(r||22)*2.1),name=(variant||0)%2?'rock2':'rock1';
  if(!drawFrame(ctx,name,x,y,size,size,0,1,false))old.rock(ctx,x,y,r,variant);
};
F.drawFoam=function(ctx,x,y,variant){
  if(!drawFrame(ctx,'foam',x+28,y+12,64,32,0,.9,(variant||0)%2===1))old.foam(ctx,x,y,variant);
};
F.drawBuoy=function(ctx,x,y){
  if(!drawFrame(ctx,'buoy',x,y-2,32,48,0,1,false))old.buoy(ctx,x,y);
};
F.drawSmallIsland=function(ctx,x,y,variant){
  if(!drawFrame(ctx,'island',x,y-2,72,54,0,1,(variant||0)%2===1))old.island(ctx,x,y,variant);
};

F.drawCannonTarget=function(ctx,x,y,scale){
  return drawFrame(ctx,'cannonTarget',x,y,48*(scale||1),48*(scale||1),0,1,false);
};
F.drawCannonball=function(ctx,x,y,scale){
  return drawFrame(ctx,'cannonball',x,y,32*(scale||1),32*(scale||1),0,1,false);
};
F.drawCurrentArrow=function(ctx,x,y,dir,scale,alpha){
  return drawFrame(ctx,'current',x,y,64*(scale||1),32*(scale||1),0,alpha==null?.75:alpha,dir<0);
};
F.drawImpact=function(ctx,x,y,scale,alpha){
  return drawFrame(ctx,'impact',x,y,32*(scale||1),32*(scale||1),0,alpha==null?1:alpha,false);
};
F.drawCloud=function(ctx,x,y,scale,alpha){
  return drawFrame(ctx,'cloud',x,y,32*(scale||1),32*(scale||1),0,alpha==null?.8:alpha,false);
};
F.drawHazardIcon=function(ctx,type,x,y,size){
  var name=type==='海軍'?'marineIcon':type==='海賊'?'pirateIcon':type==='海王類'?'kingIcon':type==='岩礁'?'rockIcon':'current';
  return drawFrame(ctx,name,x,y,size||28,size||28,0,1,false);
};
F.spriteReady=function(){return ready;};
F.spriteFrame=drawFrame;
window.PixelAssets=F;
})();