(() => {
'use strict';
const $=id=>document.getElementById(id);
const lobby=$('lobby'), gameScreen=$('gameScreen'), canvas=$('game');
const ctx=canvas.getContext('2d',{alpha:false});
const coinsEl=$('coinCount'),gameCoinsEl=$('gameCoins'),message=$('gameMessage');
let coins=500,playing=false,run=false,crouch=false;
let player={x:0,z:18,yaw:0,pitch:0};
let joy={x:0,y:0,pointer:null};
let lookPointer=null,lastLookX=0,lastLookY=0;
let jumpPower=0,lastTime=0,damage=100;
let targets=[];
const savedBots=[[-5,-15],[5,-20],[-10,-29],[10,-34],[0,-43]];
function setMessage(t){message.textContent=t}
function updateCoins(){coinsEl.textContent=coins;gameCoinsEl.textContent=coins}
function resize(){
 const dpr=Math.min(window.devicePixelRatio||1,2),w=window.innerWidth,h=window.innerHeight;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',resize);
function enterGame(){
 try {
 playing=true;run=false;crouch=false;player={x:0,z:18,yaw:0,pitch:0};jumpPower=0;
 targets=savedBots.map((p,i)=>({x:p[0],z:p[1],alive:true,id:i}));
 $('runBtn').classList.remove('active');$('crouchBtn').classList.remove('active');
 $('lobbyHeader').hidden=true;lobby.hidden=true;gameScreen.hidden=false;
 document.body.style.overflow='hidden';resize();updateCoins();setMessage('Encuentra a los bots. ¡Buena suerte!');
 } catch(error) { console.error('BloxWorld start error:',error); gameScreen.hidden=false; setMessage('Error al iniciar: '+error.message); }
}
function leaveGame(){
 playing=false;joy.x=0;joy.y=0;joy.pointer=null;run=false;crouch=false;
 $('lobbyHeader').hidden=false;lobby.hidden=false;gameScreen.hidden=true;
 document.body.style.overflow='';$('joystickThumb').style.transform='translate(-50%,-50%)';updateCoins();
}
window.startBloxWorld=enterGame;
$('playBtn').addEventListener('click',enterGame);
$('backLobbyBtn').addEventListener('click',leaveGame);
$('shopOpen').addEventListener('click',()=>$('shopModal').hidden=false);
$('shopClose').addEventListener('click',()=>$('shopModal').hidden=true);
$('shopModal').addEventListener('click',e=>{if(e.target===$('shopModal'))$('shopModal').hidden=true});
$('runBtn').addEventListener('click',()=>{run=!run;$('runBtn').classList.toggle('active',run);if(run)crouch=false;$('crouchBtn').classList.toggle('active',crouch)});
$('crouchBtn').addEventListener('click',()=>{crouch=!crouch;$('crouchBtn').classList.toggle('active',crouch);if(crouch){run=false;$('runBtn').classList.remove('active')}});
$('jumpBtn').addEventListener('click',()=>{if(jumpPower<=0)jumpPower=1;});
$('shootBtn').addEventListener('pointerdown',e=>{e.preventDefault();shoot()});

function joystickPoint(e){
 const r=$('joystick').getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const max=r.width*.34,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len);
 joy.x=dx*k/max;joy.y=dy*k/max;
 $('joystickThumb').style.transform='translate(calc(-50% + '+(joy.x*max)+'px),calc(-50% + '+(joy.y*max)+'px))';
}
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();joy.pointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);joystickPoint(e)});
$('joystick').addEventListener('pointermove',e=>{if(e.pointerId===joy.pointer)joystickPoint(e)});
function releaseJoy(e){if(e.pointerId===joy.pointer){joy.pointer=null;joy.x=0;joy.y=0;$('joystickThumb').style.transform='translate(-50%,-50%)'}}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$('joystick').addEventListener(ev,releaseJoy));

canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{
 if(lookPointer!==e.pointerId)return;
 const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;lastLookX=e.clientX;lastLookY=e.clientY;
 player.yaw-=dx*.006;player.pitch=Math.max(-.38,Math.min(.38,player.pitch-dy*.003));
});
function stopLook(e){if(lookPointer===e.pointerId)lookPointer=null}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,stopLook));
const keys={};
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault();if(e.key==='Shift')run=true});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.key==='Shift')run=false});
function wrapAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a< -Math.PI)a+=Math.PI*2;return a}
function shoot(){
 if(!playing)return;
 let best=null,bestAngle=.18,bestDist=60;
 for(const t of targets){if(!t.alive)continue;const dx=t.x-player.x,dz=t.z-player.z,dist=Math.hypot(dx,dz),ang=wrapAngle(Math.atan2(-dx,-dz)-player.yaw);
  if(dist<bestDist&&Math.abs(ang)<bestAngle){best=t;bestAngle=Math.abs(ang);bestDist=dist}
 }
 if(best){best.alive=false;coins+=25;updateCoins();setMessage('¡Bot eliminado! +25 Bloxbux');if(targets.every(t=>!t.alive)){targets=savedBots.map((p,i)=>({x:p[0],z:p[1],alive:true,id:i}));setMessage('¡Nueva ronda! Los bots han vuelto.')}}else setMessage('No diste en el blanco. Ajusta la mira y dispara.');
}
function project(x,y,z,w,h){
 const dx=x-player.x,dz=z-player.z,cs=Math.cos(player.yaw),sn=Math.sin(player.yaw);
 const side=dx*cs-dz*sn,depth=-dx*sn-dz*cs;
 if(depth<1)return null;
 const focal=w*.92,camY=crouch?1.08:1.65;
 return {x:w/2+side*focal/depth,y:h*.43-(y+ jumpPower*.8-camY)*focal/depth+player.pitch*focal*.65,depth,scale:focal/depth};
}
function polygon(points,color){
 ctx.beginPath();points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function drawPyramid(obj,w,h){
 const {x,z,size,height}=obj;
 const corners=[[-size,0,-size],[size,0,-size],[size,0,size],[-size,0,size]].map(([a,b,c])=>project(x+a,b,z+c,w,h));
 const apex=project(x,height,z,w,h);if(!apex||corners.some(p=>!p))return;
 const faces=[[0,1],[1,2],[2,3],[3,0]].map(([a,b],i)=>({pts:[corners[a],corners[b],apex],depth:(corners[a].depth+corners[b].depth+apex.depth)/3,shade:i%2?'#a76d43':'#d6a06a'})).sort((a,b)=>b.depth-a.depth);
 faces.forEach(f=>polygon(f.pts,f.shade));
 polygon([corners[0],corners[1],corners[2],corners[3]],'#9a613e');
}
function drawBlock(obj,w,h){
 const p=project(obj.x,0,obj.z,w,h);if(!p)return;
 const s=Math.max(2,Math.min(90,p.scale*obj.size));
 const height=s*obj.height/obj.size;
 ctx.fillStyle='#896446';ctx.fillRect(p.x-s/2,p.y-height,s,height);
 ctx.fillStyle='#c69a66';ctx.beginPath();ctx.moveTo(p.x-s/2,p.y-height);ctx.lineTo(p.x-s*.25,p.y-height-s*.18);ctx.lineTo(p.x+s*.55,p.y-height-s*.18);ctx.lineTo(p.x+s/2,p.y-height);ctx.fill();
 ctx.fillStyle='#6f5038';ctx.fillRect(p.x+s*.05,p.y-height*.55,s*.17,height*.55);
}
function drawBot(t,w,h){
 const p=project(t.x,.9,t.z,w,h);if(!p)return;
 const s=Math.min(54,p.scale*1.15);if(s<2)return;
 const bodyH=s*1.15,head=s*.55;
 ctx.fillStyle='#211f2b55';ctx.beginPath();ctx.ellipse(p.x,p.y+bodyH*.95,s*.55,s*.15,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#253c68';ctx.fillRect(p.x-s*.32,p.y+bodyH*.48,s*.25,bodyH*.53);ctx.fillRect(p.x+s*.07,p.y+bodyH*.48,s*.25,bodyH*.53);
 ctx.fillStyle='#e34d66';ctx.fillRect(p.x-s*.48,p.y,s*.96,bodyH*.65);
 ctx.fillStyle='#f1c396';ctx.fillRect(p.x-head/2,p.y-head*.9,head,head);
 ctx.fillStyle='#293042';ctx.fillRect(p.x-head*.42,p.y-head*.28,head*.84,head*.16);
 ctx.fillStyle='#fff';ctx.fillRect(p.x-s*.16,p.y-head*.45,s*.08,s*.06);ctx.fillRect(p.x+s*.08,p.y-head*.45,s*.08,s*.06);
}
const pyramids=[{x:-19,z:-51,size:11,height:17},{x:0,z:-73,size:16,height:25},{x:20,z:-55,size:10,height:16},{x:34,z:-88,size:14,height:22}];
const blocks=[{x:-5,z:-13,size:2.5,height:1.8},{x:7,z:-24,size:2.8,height:2},{x:-15,z:-32,size:3,height:2.1},{x:15,z:-39,size:3,height:2.2},{x:2,z:-48,size:3.4,height:2.4}];
function drawScene(w,h,dt){
 const sky=ctx.createLinearGradient(0,0,0,h*.7);sky.addColorStop(0,'#6d8ca8');sky.addColorStop(.58,'#e8ae78');sky.addColorStop(1,'#e5b276');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#ffe6ad';ctx.beginPath();ctx.arc(w*.78,h*.18,Math.min(w,h)*.065,0,Math.PI*2);ctx.fill();
 const horizon=h*(.43-player.pitch*.28);
 ctx.fillStyle='#b98258';ctx.beginPath();ctx.moveTo(0,horizon+10);ctx.quadraticCurveTo(w*.23,horizon-65,w*.49,horizon+5);ctx.quadraticCurveTo(w*.76,horizon-58,w,horizon+12);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
 ctx.fillStyle='#d8a269';ctx.beginPath();ctx.moveTo(0,horizon+80);ctx.quadraticCurveTo(w*.28,horizon+5,w*.53,horizon+88);ctx.quadraticCurveTo(w*.78,horizon+30,w,horizon+76);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
 // Perspectiva del suelo
 const focal=w*.92;
 for(let i=1;i<=13;i++){
  const dist=i*5+4,z=player.z-dist,p1=project(-55,0,z,w,h),p2=project(55,0,z,w,h);
  if(p1&&p2){ctx.strokeStyle=i%2?'#f8d39a28':'#71492d22';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
 }
 // Elementos 3D ordenados por distancia
 const things=[];
 pyramids.forEach(p=>{const q=project(p.x,0,p.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawPyramid(p,w,h)})});
 blocks.forEach(b=>{const q=project(b.x,0,b.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawBlock(b,w,h)})});
 targets.filter(t=>t.alive).forEach(t=>{const q=project(t.x,0,t.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawBot(t,w,h)})});
 things.sort((a,b)=>b.d-a.d).forEach(o=>o.draw());
 // arma en primer plano
 ctx.save();ctx.translate(w*.79,h*.88);ctx.rotate(-.08);
 ctx.fillStyle='#19293c';ctx.fillRect(-8,-10,w*.16,h*.12);ctx.fillStyle='#65788d';ctx.fillRect(w*.025,-h*.14,w*.12,h*.11);ctx.fillStyle='#2d4055';ctx.fillRect(w*.04,-h*.17,w*.11,h*.05);
 ctx.fillStyle='#0b1829';ctx.fillRect(w*.065,-h*.09,w*.045,h*.095);ctx.restore();
 // viñeta ligera
 const vg=ctx.createRadialGradient(w/2,h*.48,Math.min(w,h)*.18,w/2,h*.48,Math.max(w,h)*.8);vg.addColorStop(.5,'#00000000');vg.addColorStop(1,'#07101e55');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}
function tick(time){
 const dt=Math.min(.04,(time-lastTime)/1000||.016);lastTime=time;
 if(playing){
  let f=-joy.y,s=joy.x;
  if(keys.w||keys.arrowup)f=1;if(keys.s||keys.arrowdown)f=-1;if(keys.a||keys.arrowleft)s=-1;if(keys.d||keys.arrowright)s=1;
  const speed=run ? 0.24 : 0.12;
  const mag=Math.hypot(f,s)||1;if(Math.hypot(f,s)>1){f/=mag;s/=mag}
  const forwardX=-Math.sin(player.yaw),forwardZ=-Math.cos(player.yaw),rightX=Math.cos(player.yaw),rightZ=-Math.sin(player.yaw);
  player.x+=(forwardX*f+rightX*s)*speed*(dt*60);player.z+=(forwardZ*f+rightZ*s)*speed*(dt*60);
  player.x=Math.max(-42,Math.min(42,player.x));player.z=Math.max(-65,Math.min(23,player.z));
  if(jumpPower>0)jumpPower=Math.max(0,jumpPower-dt*1.7);
  drawScene(window.innerWidth,window.innerHeight,dt);
 }
 requestAnimationFrame(tick);
}
resize();requestAnimationFrame(tick);updateCoins();
})();