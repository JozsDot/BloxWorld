(() => {
'use strict';
const $=id=>document.getElementById(id);
const lobby=$('lobby'), gameScreen=$('gameScreen'), canvas=$('game');
const ctx=canvas.getContext('2d',{alpha:false});
const coinsEl=$('coinCount'),gameCoinsEl=$('gameCoins'),message=$('gameMessage');
let coins=500,playing=false,run=false,crouch=false;
let selectedMap='desert',weaponSlot=0,inspectTime=0,lastShot=0,jumpVelocity=0,moveClock=0;
const weaponSlots=[{name:'AK-47',type:'rifle',rate:360,range:70,color:'#4c5b62'},{name:'UMP45',type:'smg',rate:220,range:48,color:'#526879'}];
const weaponPool=[{name:'AK-47',type:'rifle',rate:360,range:70},{name:'UMP45',type:'smg',rate:220,range:48},{name:'Kar98k',type:'sniper',rate:900,range:110},{name:'M700',type:'sniper',rate:1000,range:125},{name:'MP5',type:'smg',rate:170,range:50},{name:'Uzi',type:'smg',rate:130,range:34},{name:'Cuchillo',type:'knife',rate:420,range:4.5}];
let player={x:0,z:18,yaw:0,pitch:0};
let joy={x:0,y:0,pointer:null};
let lookPointer=null,lastLookX=0,lastLookY=0;
let jumpPower=0,lastTime=0,damage=100;
let targets=[];
const savedBots=[[-5,-15],[5,-20],[-10,-29],[10,-34],[0,-43]];
function setMessage(t){message.textContent=t}
function currentWeapon(){return weaponSlots[weaponSlot]}
function updateWeaponHud(){const w=currentWeapon();$('weaponName').textContent=w.name;$('weaponType').textContent=w.type==='knife'?'CUERPO A CUERPO':w.type==='sniper'?'PRECISIÓN · CERROJO':w.type==='smg'?'SUBFUSIL · AUTOMÁTICO':'FUSIL DE ASALTO';$('weaponSlotLabel').textContent=(weaponSlot+1)+' / 2';}
function updateCoins(){coinsEl.textContent=coins;gameCoinsEl.textContent=coins}
function resize(){
 const dpr=Math.min(window.devicePixelRatio||1,2),w=window.innerWidth,h=window.innerHeight;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',resize);
function enterGame(){
 try {
 playing=true;run=false;crouch=false;player={x:0,z:18,yaw:0,pitch:0};jumpPower=0;jumpVelocity=0;weaponSlot=0;inspectTime=0;lastShot=0;
 targets=(selectedMap==='desert'?savedBots:selectedMap==='city'?[[-12,-20],[13,-28],[-20,-44],[22,-50],[0,-65]]:[[-14,-18],[14,-24],[-22,-40],[20,-48],[0,-60]]).map((p,i)=>({x:p[0],z:p[1],alive:true,id:i}));
 $('runBtn').classList.remove('active');$('crouchBtn').classList.remove('active');
 $('lobbyHeader').hidden=true;lobby.hidden=true;gameScreen.hidden=false;
 document.body.style.overflow='hidden';resize();updateCoins();updateWeaponHud();$('mapTitle').textContent=selectedMap==='desert'?'PIRÁMIDES DEL DESIERTO':selectedMap==='city'?'CIUDAD NEÓN':'ISLA TROPICAL';setMessage('Explora el mapa y prueba tu equipo');
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
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(playing&&jumpPower<=0.02){jumpVelocity=4.8;$('jumpBtn').classList.add('active');setTimeout(()=>$('jumpBtn').classList.remove('active'),180)}});
$('switchBtn').addEventListener('click',()=>{weaponSlot=1-weaponSlot;updateWeaponHud();setMessage('Arma equipada: '+currentWeapon().name)});
$('arsenalBtn').addEventListener('click',()=>{$('arsenalPanel').hidden=!$('arsenalPanel').hidden});$('arsenalClose').addEventListener('click',()=>$('arsenalPanel').hidden=true);
document.querySelectorAll('.equip-weapon').forEach(btn=>btn.addEventListener('click',()=>{weaponSlots[weaponSlot]=weaponPool[Number(btn.dataset.weapon)];updateWeaponHud();$('arsenalPanel').hidden=true;setMessage(weaponSlots[weaponSlot].name+' equipado en espacio '+(weaponSlot+1))}));
$('inspectBtn').addEventListener('click',()=>{inspectTime=1;setMessage('Inspeccionando '+currentWeapon().name)});
document.querySelectorAll('.map-option').forEach(btn=>btn.addEventListener('click',()=>{selectedMap=btn.dataset.map;document.querySelectorAll('.map-option').forEach(b=>b.classList.toggle('selected',b===btn));const names={desert:'PIRÁMIDES DEL DESIERTO',city:'CIUDAD NEÓN',island:'ISLA TROPICAL'};$('lobbyMapName').textContent=names[selectedMap];$('lobbyMapNumber').textContent=selectedMap==='desert'?'01':selectedMap==='city'?'02':'03';}));
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
 const weapon=currentWeapon();if(weapon.type==='knife'){let near=null,nd=weapon.range;for(const t of targets){if(!t.alive)continue;const d=Math.hypot(t.x-player.x,t.z-player.z),a=Math.abs(wrapAngle(Math.atan2(-(t.x-player.x),-(t.z-player.z))-player.yaw));if(d<nd&&a<.75){near=t;nd=d}}if(near){near.alive=false;coins+=25;updateCoins();setMessage('¡Eliminación cuerpo a cuerpo! +25 BB')}else setMessage('Acércate más para usar el cuchillo');return}
 const now=performance.now();if(now-lastShot<weapon.rate)return;lastShot=now;
 let best=null,bestAngle=weapon.type==='sniper'?.10:.18,bestDist=weapon.range;
 for(const t of targets){if(!t.alive)continue;const dx=t.x-player.x,dz=t.z-player.z,dist=Math.hypot(dx,dz),ang=wrapAngle(Math.atan2(-dx,-dz)-player.yaw);
  if(dist<bestDist&&Math.abs(ang)<bestAngle){best=t;bestAngle=Math.abs(ang);bestDist=dist}
 }
 if(best){best.alive=false;inspectTime=0;coins+=25;updateCoins();setMessage('¡Bot eliminado! +25 Bloxbux');if(targets.every(t=>!t.alive)){targets=savedBots.map((p,i)=>({x:p[0],z:p[1],alive:true,id:i}));setMessage('¡Nueva ronda! Los bots han vuelto.')}}else setMessage('No diste en el blanco. Ajusta la mira y dispara.');
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
function drawBuilding(b,w,h){const p=project(b.x,0,b.z,w,h);if(!p)return;const s=Math.min(150,p.scale*b.size),hh=s*b.height/b.size;ctx.fillStyle='#26394b';ctx.fillRect(p.x-s/2,p.y-hh,s,hh);ctx.fillStyle='#526a7c';ctx.beginPath();ctx.moveTo(p.x-s/2,p.y-hh);ctx.lineTo(p.x-s*.32,p.y-hh-s*.12);ctx.lineTo(p.x+s*.62,p.y-hh-s*.12);ctx.lineTo(p.x+s/2,p.y-hh);ctx.fill();for(let r=0;r<3;r++)for(let q=0;q<3;q++){ctx.fillStyle=(r+q)%2?'#b5d8df':'#e7c98c';ctx.fillRect(p.x-s*.38+q*s*.27,p.y-hh*.82+r*hh*.23,s*.12,hh*.11)}ctx.fillStyle='#182b3c';ctx.fillRect(p.x-s*.08,p.y-hh*.25,s*.16,hh*.25)}
function drawPalm(x,z,w,h,i){const p=project(x,0,z,w,h);if(!p)return;const s=Math.min(70,p.scale*1.8);ctx.strokeStyle='#77553a';ctx.lineWidth=Math.max(2,s*.12);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-s*.08,p.y-s*1.35);ctx.stroke();ctx.fillStyle='#26765c';for(let k=0;k<7;k++){const a=(Math.PI*2*k/7);ctx.beginPath();ctx.ellipse(p.x-s*.08+Math.cos(a)*s*.38,p.y-s*1.35+Math.sin(a)*s*.23,s*.42,s*.12,a,0,Math.PI*2);ctx.fill()}}
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
const cityBuildings=[{x:-13,z:-28,size:7,height:13},{x:12,z:-34,size:8,height:18},{x:-25,z:-54,size:9,height:20},{x:24,z:-61,size:8,height:15},{x:-5,z:-78,size:11,height:24},{x:17,z:-95,size:10,height:19},{x:-34,z:-88,size:8,height:16}];
const islandPalms=[[-13,-22],[12,-30],[-23,-47],[24,-54],[-8,-68],[18,-82],[34,-36],[-35,-75]];
const blocks=[{x:-5,z:-13,size:2.5,height:1.8},{x:7,z:-24,size:2.8,height:2},{x:-15,z:-32,size:3,height:2.1},{x:15,z:-39,size:3,height:2.2},{x:2,z:-48,size:3.4,height:2.4}];
function drawScene(w,h,dt){
 const palettes={desert:['#6d8ca8','#e8ae78','#e5b276','#b98258','#d8a269'],city:['#263c59','#758ba5','#9aa9b7','#42566b','#596b7c'],island:['#4c9da9','#9bd5d0','#e7d69d','#328b83','#d7bd79']};const pal=palettes[selectedMap];
 const sky=ctx.createLinearGradient(0,0,0,h*.7);sky.addColorStop(0,pal[0]);sky.addColorStop(.58,pal[1]);sky.addColorStop(1,pal[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=selectedMap==='city'?'#e5e5d0':'#ffe6ad';ctx.beginPath();ctx.arc(w*.78,h*.18,Math.min(w,h)*.065,0,Math.PI*2);ctx.fill();
 const horizon=h*(.43+player.pitch*.28);
 ctx.fillStyle=pal[3];ctx.beginPath();ctx.moveTo(0,horizon+24);ctx.lineTo(w*.16,horizon+4);ctx.lineTo(w*.34,horizon+20);ctx.lineTo(w*.53,horizon+8);ctx.lineTo(w*.72,horizon+25);ctx.lineTo(w*.88,horizon+9);ctx.lineTo(w,horizon+22);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
 ctx.fillStyle=pal[4];ctx.beginPath();ctx.moveTo(0,horizon+92);ctx.lineTo(w*.18,horizon+66);ctx.lineTo(w*.37,horizon+88);ctx.lineTo(w*.58,horizon+70);ctx.lineTo(w*.79,horizon+94);ctx.lineTo(w,horizon+73);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
 // Perspectiva del suelo
 const focal=w*.92;
 for(let i=1;i<=13;i++){
  const dist=i*5+4,z=player.z-dist,p1=project(-55,0,z,w,h),p2=project(55,0,z,w,h);
  if(p1&&p2){ctx.strokeStyle=i%2?'#f8d39a28':'#71492d22';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
 }
 // Elementos 3D ordenados por distancia
 const things=[];
 if(selectedMap==='desert')pyramids.forEach(p=>{const q=project(p.x,0,p.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawPyramid(p,w,h)})});
 if(selectedMap==='city')cityBuildings.forEach(b=>{const q=project(b.x,0,b.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawBuilding(b,w,h)})});
 if(selectedMap==='island')islandPalms.forEach((p,i)=>{const q=project(p[0],0,p[1],w,h);if(q)things.push({d:q.depth,draw:()=>drawPalm(p[0],p[1],w,h,i)})});
 blocks.forEach(b=>{const q=project(b.x,0,b.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawBlock(b,w,h)})});
 targets.filter(t=>t.alive).forEach(t=>{const q=project(t.x,0,t.z,w,h);if(q)things.push({d:q.depth,draw:()=>drawBot(t,w,h)})});
 things.sort((a,b)=>b.d-a.d).forEach(o=>o.draw());
 // Arma en primera persona, con animación de inspección
 const weapon=currentWeapon(),unit=Math.min(w,h);ctx.save();const inspect=inspectTime>0?Math.sin((1-inspectTime)*Math.PI)*.7:0;ctx.translate(w*.79+inspect*unit*.12,h*.91-inspect*unit*.09);ctx.rotate(-.12+inspect*.85);
 ctx.fillStyle='#101b2a';ctx.beginPath();ctx.moveTo(-unit*.025,unit*.20);ctx.lineTo(unit*.19,unit*.20);ctx.lineTo(unit*.16,-unit*.015);ctx.lineTo(unit*.055,-unit*.045);ctx.closePath();ctx.fill();
 ctx.fillStyle='#344b61';ctx.beginPath();ctx.moveTo(unit*.005,unit*.16);ctx.lineTo(unit*.155,unit*.16);ctx.lineTo(unit*.13,unit*.015);ctx.lineTo(unit*.055,-unit*.01);ctx.closePath();ctx.fill();ctx.fillStyle='#71869a';ctx.fillRect(unit*.035,unit*.015,unit*.115,unit*.018);
 ctx.fillStyle='#172536';ctx.beginPath();ctx.moveTo(-unit*.045,-unit*.12);ctx.lineTo(unit*.025,-unit*.14);ctx.lineTo(unit*.055,-unit*.025);ctx.lineTo(-unit*.01,unit*.015);ctx.closePath();ctx.fill();
 ctx.fillStyle=weapon.type==='knife'?'#aab9c5':weapon.type==='sniper'?'#4b5a65':weapon.type==='smg'?'#354b5b':'#26394c';ctx.beginPath();ctx.moveTo(-unit*.005,-unit*.16);ctx.lineTo(unit*(weapon.type==='sniper'?.31:.22),-unit*.19);ctx.lineTo(unit*(weapon.type==='sniper'?.33:.235),-unit*.115);ctx.lineTo(unit*.015,-unit*.075);ctx.closePath();ctx.fill();ctx.fillStyle='#657d91';ctx.fillRect(unit*.045,-unit*.177,unit*.135,unit*.018);ctx.fillStyle='#101b29';ctx.fillRect(unit*.19,-unit*.17,unit*(weapon.type==='sniper'?.27:.19),unit*.035);ctx.fillStyle='#8197a8';ctx.fillRect(unit*.205,-unit*.177,unit*(weapon.type==='sniper'?.25:.17),unit*.009);
 ctx.fillStyle='#101a27';ctx.fillRect(unit*.095,-unit*.225,unit*(weapon.type==='sniper'?.14:.07),unit*.045);ctx.fillStyle='#7d96aa';ctx.fillRect(unit*.11,-unit*.218,unit*.04,unit*.012);ctx.fillStyle='#0c1724';ctx.fillRect(unit*.045,-unit*.09,unit*.065,unit*.105);
 ctx.fillStyle='#172536';ctx.beginPath();ctx.moveTo(unit*.06,-unit*.09);ctx.lineTo(unit*.12,-unit*.10);ctx.lineTo(unit*.135,unit*.015);ctx.lineTo(unit*.09,unit*.035);ctx.closePath();ctx.fill();
 if(weapon.type==='knife'){ctx.fillStyle='#d3e0e7';ctx.beginPath();ctx.moveTo(unit*.06,-unit*.16);ctx.lineTo(unit*.30,-unit*.32);ctx.lineTo(unit*.19,-unit*.12);ctx.closePath();ctx.fill();ctx.fillStyle='#28394b';ctx.fillRect(unit*.02,-unit*.13,unit*.11,unit*.035)}else{ctx.fillStyle='#c58d68';ctx.beginPath();ctx.roundRect(unit*.075,-unit*.105,unit*.078,unit*.075,unit*.018);ctx.fill();ctx.fillStyle='#e0ad82';ctx.fillRect(unit*.085,-unit*.095,unit*.058,unit*.014)}ctx.restore();
 // viñeta ligera
 const vg=ctx.createRadialGradient(w/2,h*.48,Math.min(w,h)*.18,w/2,h*.48,Math.max(w,h)*.8);vg.addColorStop(.5,'#00000000');vg.addColorStop(1,'#07101e55');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}
function tick(time){
 const dt=Math.min(.04,(time-lastTime)/1000||.016);lastTime=time;
 if(playing){
  let f=-joy.y,s=joy.x;
  if(keys.w||keys.arrowup)f=1;if(keys.s||keys.arrowdown)f=-1;if(keys.a||keys.arrowleft)s=-1;if(keys.d||keys.arrowright)s=1;
  const speed=run ? 0.22 : 0.105;
  const mag=Math.hypot(f,s)||1;if(Math.hypot(f,s)>1){f/=mag;s/=mag}
  const forwardX=-Math.sin(player.yaw),forwardZ=-Math.cos(player.yaw),rightX=Math.cos(player.yaw),rightZ=-Math.sin(player.yaw);
  player.x+=(forwardX*f+rightX*s)*speed*(dt*60);player.z+=(forwardZ*f+rightZ*s)*speed*(dt*60);
  const bounds=selectedMap==='city'?48:selectedMap==='island'?58:42;player.x=Math.max(-bounds,Math.min(bounds,player.x));player.z=Math.max(-110,Math.min(28,player.z));
  if(jumpVelocity!==0||jumpPower>0){jumpPower+=jumpVelocity*dt;jumpVelocity-=11.5*dt;if(jumpPower<=0){jumpPower=0;jumpVelocity=0}}
  moveClock+=dt*Math.hypot(f,s)*(run?2.2:1.3);if(inspectTime>0)inspectTime=Math.max(0,inspectTime-dt*1.5);
  drawScene(window.innerWidth,window.innerHeight,dt);
 }
 requestAnimationFrame(tick);
}
resize();requestAnimationFrame(tick);updateCoins();
})();