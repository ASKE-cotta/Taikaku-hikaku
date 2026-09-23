(function(){
'use strict';

const P={
  red:'#E43D45', blue:'#2786C1', deep:'#165477', cyan:'#55B8D0',
  cream:'#FFF1D6', pink:'#F19AAF', yellow:'#F4C84B', purple:'#7359A6',
  orange:'#E98438', sand:'#D7B576', ink:'#172B3C', white:'#F5F4ED',
  rock:'#55545A', rockHi:'#8b97a2', rockDark:'#394c50', green:'#4a9b63',
  wine:'#8C2028', wood:'#8B5B3E'
};

function px(ctx,x,y,w,h,c){
  ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}

function drawPlayerShip(ctx,x,y,lean,flash){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate((lean||0)*.075);
  if(flash)ctx.globalAlpha=.28;

  // hull + shadow
  px(ctx,-20,-31,40,55,P.ink);
  px(ctx,-15,-27,30,45,P.sand);
  px(ctx,-11,-23,22,36,'#b88453');
  px(ctx,-9,12,18,10,P.red);

  // mast + striped sail
  px(ctx,-3,-36,6,43,P.ink);
  px(ctx,3,-31,22,29,P.white);
  px(ctx,3,-31,7,29,P.red);
  px(ctx,18,-31,7,29,P.red);
  px(ctx,8,-27,10,5,P.cream);

  // tiny clown-pirate emblem
  px(ctx,10,-17,8,8,P.cream);
  px(ctx,12,-15,4,4,P.red);
  px(ctx,8,-11,3,3,P.blue);px(ctx,17,-11,3,3,P.blue);

  // stern details / foam
  px(ctx,-8,18,6,5,P.blue);px(ctx,2,18,6,5,P.yellow);
  px(ctx,-16,24,8,4,P.white);px(ctx,8,24,8,4,P.white);

  ctx.restore();
}

function drawPirateShip(ctx,x,y,variant){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  px(ctx,-27,-16,54,31,P.ink);
  px(ctx,-22,-12,44,23,P.wine);
  px(ctx,-17,8,34,9,P.sand);
  px(ctx,-3,-43,6,34,P.ink);
  px(ctx,3,-40,25,20,P.cream);

  if((variant||0)%2===0){
    px(ctx,10,-35,11,4,P.ink);px(ctx,13,-39,5,12,P.ink);
  }else{
    px(ctx,7,-36,17,4,P.ink);px(ctx,14,-40,4,15,P.ink);
    px(ctx,4,-22,22,4,P.red);
  }
  px(ctx,-20,13,9,4,P.white);px(ctx,11,13,9,4,P.white);
  ctx.restore();
}

function drawMarineShip(ctx,x,y,scale){
  scale=scale||1;ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
  px(ctx,-30,-16,60,32,P.ink);
  px(ctx,-24,-11,48,23,'#d7e7ef');
  px(ctx,-17,10,34,8,P.sand);
  px(ctx,-3,-48,6,38,P.ink);
  px(ctx,3,-45,31,24,P.white);
  px(ctx,9,-41,19,5,P.blue);
  px(ctx,13,-32,11,4,P.blue);
  px(ctx,-25,13,10,4,P.cyan);px(ctx,15,13,10,4,P.cyan);
  ctx.restore();
}

function drawSeaKing(ctx,x,y,r,variant){
  r=Math.max(26,Math.round(r||34));
  const s=Math.max(1,Math.round(r/32));
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(s,s);

  // chunky face silhouette with fins
  px(ctx,-34,-27,68,54,P.ink);
  px(ctx,-29,-22,58,44,P.purple);
  px(ctx,-37,-10,8,20,P.deep);px(ctx,29,-10,8,20,P.deep);

  if((variant||0)%2===0){
    px(ctx,-19,-12,12,11,P.white);px(ctx,7,-12,12,11,P.white);
    px(ctx,-15,-8,5,5,P.ink);px(ctx,10,-8,5,5,P.ink);
  }else{
    px(ctx,-20,-10,14,9,P.yellow);px(ctx,6,-10,14,9,P.yellow);
    px(ctx,-15,-7,5,5,P.ink);px(ctx,10,-7,5,5,P.ink);
  }

  px(ctx,-19,8,38,9,P.red);
  px(ctx,-15,8,6,12,P.white);px(ctx,9,8,6,12,P.white);
  px(ctx,-5,8,10,6,P.ink);
  px(ctx,-23,-27,8,7,P.blue);px(ctx,15,-27,8,7,P.blue);
  ctx.restore();
}

function drawRock(ctx,x,y,r,variant){
  x=Math.round(x);y=Math.round(y);r=Math.max(14,Math.round(r||22));
  const jag=(variant||0)%3;
  px(ctx,x-r,y-r+7,r*2,r*2-8,P.ink);
  px(ctx,x-r+4,y-r+3,r*2-8,r*2-9,P.rock);
  px(ctx,x-r+8,y-r+7,Math.max(8,r-2),7,P.rockHi);
  px(ctx,x+2-jag*2,y+1,Math.max(8,r-5),Math.max(7,r-8),P.rockDark);
  px(ctx,x-r+5,y+r-9,8,5,'#315d69');
}

function drawFoam(ctx,x,y,variant){
  variant=variant||0;
  px(ctx,x,y,18,3,P.white);
  px(ctx,x+6,y+6,26,3,variant%2?P.cream:P.cyan);
  if(variant%3===0)px(ctx,x+22,y-4,11,3,P.cream);
}

function drawBuoy(ctx,x,y){
  px(ctx,x-4,y-14,8,18,P.ink);
  px(ctx,x-7,y-12,14,9,P.red);
  px(ctx,x-4,y-9,8,3,P.white);
  px(ctx,x-2,y-20,4,6,P.yellow);
}

function drawSmallIsland(ctx,x,y,variant){
  variant=variant||0;
  px(ctx,x-34,y-9,68,16,P.ink);
  px(ctx,x-29,y-13,58,17,P.sand);
  px(ctx,x-20,y-18,40,10,P.green);
  if(variant%2===0){px(ctx,x-3,y-34,6,18,P.wood);px(ctx,x+3,y-34,13,7,P.green);}
  else{px(ctx,x-14,y-26,28,7,P.rockDark);}
}

window.PixelAssets={palette:P,px,drawPlayerShip,drawPirateShip,drawMarineShip,drawSeaKing,drawRock,drawFoam,drawBuoy,drawSmallIsland};
})();