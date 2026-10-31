(() => {
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('game'),lobby=$('lobby'),screen=$('gameScreen');
let scene,camera,renderer,clock,worldGroup,weaponGroup,GLTFLoaderClass=null,skeletonClone=null,soldierTemplate=null,soldierAnimations=[],weaponTemplates={};
let playing=false,run=false,crouch=false,jumpV=0,playerY=1.7,jumpOffset=0,cameraMode='third';
let yaw=0,pitch=0,lastShot=0,fireHeld=false,inspect=0,coins=500,aiming=false,aimReturnMode='third',scopeZoom=1,baseFov=76,scopeOverlay=null;
let selectedMap='desert',selectedGameMode='battle',weaponSlot=0;
const slots=['Cuchillo','Cuchillo'];let lootChests=[],nearbyChest=null;
const ammoState={'AK-47':{mag:0,reserve:0},UMP45:{mag:0,reserve:0},Kar98k:{mag:0,reserve:0},M700:{mag:0,reserve:0},MP5:{mag:0,reserve:0},Uzi:{mag:0,reserve:0},Cuchillo:{mag:0,reserve:0}};
let reloading=false,reloadTimer=null;
const weaponData=[
 {name:'AK-47',kind:'rifle',rate:330,mag:30,color:0x46545b},
 {name:'UMP45',kind:'smg',rate:210,mag:25,color:0x354b5a},
 {name:'Kar98k',kind:'sniper',rate:850,mag:5,color:0x69523e},
 {name:'M700',kind:'sniper',rate:900,mag:5,color:0x3d4a53},
 {name:'MP5',kind:'smg',rate:170,mag:30,color:0x354c5e},
 {name:'Uzi',kind:'smg',rate:125,mag:32,color:0x4c555b},
 {name:'Cuchillo',kind:'knife',rate:380,color:0xb8c8d0}
];
let player={x:0,z:18};
let joy={x:0,y:0,id:null},look={id:null,x:0,y:0},activeTouches=new Map();
const weaponScopes={'AK-47':2,UMP45:1,Kar98k:8,M700:6,MP5:1,Uzi:1,Cuchillo:1};
let bots=[],botMeshes=[],keys={},colliders=[],projectiles=[],enemyProjectiles=[],playerAvatar=null,avatarLimbs=[];
let playerHealth=100,recoil=0,walkTime=0,slideTimer=0,slideSpeed=0,weaponKick=0,weaponBob=0;
const raycaster=new THREE.Raycaster();
let networkSocket=null,networkRoom='',networkPlayerId='',networkTick=0,pendingOnlineRoom=null;
const remotePlayers=new Map();
function makeRemotePlayer(id){
 const g=new THREE.Group(),color=(parseInt(id.replace(/[^a-f0-9]/gi,'').slice(0,6),16)||0x4b8ba0)&0xffffff;
 const suit=new THREE.MeshStandardMaterial({color,roughness:.9}),armor=new THREE.MeshStandardMaterial({color:0x253744,roughness:.8}),skin=new THREE.MeshStandardMaterial({color:0xb98263});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,5,8),suit);torso.position.y=1.25;g.add(torso);
 const vest=new THREE.Mesh(new THREE.BoxGeometry(.62,.58,.3),armor);vest.position.set(0,1.34,-.03);g.add(vest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),skin);head.position.y=2.02;g.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8,0,Math.PI*2,0,Math.PI*.58),armor);helmet.position.y=2.12;g.add(helmet);
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.45,.55,.2),armor);pack.position.set(0,1.35,.22);g.add(pack);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 worldGroup.add(g);remotePlayers.set(id,g);return g;
}
function handleNetworkMessage(data){
 if(!data||data.playerId===networkPlayerId)return;
 if(data.type==='state'&&data.player){
  const p=data.player,g=remotePlayers.get(data.playerId)||makeRemotePlayer(data.playerId);
  if(Number.isFinite(p.x)&&Number.isFinite(p.z)){g.position.set(p.x,0,p.z);g.rotation.y=Number(p.yaw)||0}
 }else if(data.type==='leave'){
  const g=remotePlayers.get(data.playerId);if(g){worldGroup.remove(g);remotePlayers.delete(data.playerId)}
 }
}
function sendNetworkState(){
 if(!networkSocket||networkSocket.readyState!==WebSocket.OPEN)return;
 networkSocket.send(JSON.stringify({type:'state',player:{x:player.x,z:player.z,yaw,health:playerHealth,weapon:slots[weaponSlot],aiming}}));
}
function connectMultiplayer(room){
 const base=String(window.BLOXSHOOT_SERVER_URL||'').trim();
 if(!base){setMessage('SERVIDOR AÚN SIN DESPLEGAR · REVISA SERVER_SETUP.md');return}
 networkRoom=room;networkPlayerId=crypto.randomUUID();
 const wsBase=base.replace(/^https:/i,'wss:').replace(/^http:/i,'ws:').replace(/\/$/,'');
 try{networkSocket=new WebSocket(wsBase+'/room/'+encodeURIComponent(room))}
 catch(e){setMessage('NO SE PUDO ABRIR LA SALA ONLINE');return}
 networkSocket.addEventListener('open',()=>{networkSocket.send(JSON.stringify({type:'join',playerId:networkPlayerId}));setMessage('ONLINE · SALA '+room)});
 networkSocket.addEventListener('message',e=>{try{handleNetworkMessage(JSON.parse(e.data))}catch(err){}});
 networkSocket.addEventListener('error',()=>setMessage('ERROR DE CONEXIÓN · REVISA EL SERVIDOR'));
 networkSocket.addEventListener('close',()=>{if(playing)setMessage('CONEXIÓN ONLINE CERRADA')});
}
function disconnectMultiplayer(){
 if(networkSocket){networkSocket.close();networkSocket=null}
 for(const g of remotePlayers.values())if(g.parent)g.parent.remove(g);
 remotePlayers.clear();networkRoom='';networkPlayerId='';networkTick=0;
}

const materials={};
function mat(color,roughness=1){const key=color+'_'+roughness;if(!materials[key])materials[key]=new THREE.MeshStandardMaterial({color,roughness,metalness:0.02});return materials[key]}
function box(parent,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(parent,x,y,z,r1,r2,h,color,segments=8){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
function makeGroundTexture(base){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
 for(let i=0;i<11500;i++){
  const v=Math.random(),alpha=.035+Math.random()*.13;
  ctx.fillStyle=v>.52?'rgba(255,236,198,'+alpha+')':'rgba(48,38,30,'+alpha+')';
  const s=.5+Math.random()*3.2;ctx.fillRect(Math.random()*512,Math.random()*512,s,s);
 }
 for(let i=0;i<180;i++){
  ctx.strokeStyle='rgba(70,54,39,.09)';ctx.lineWidth=.5+Math.random();
  ctx.beginPath();const x=Math.random()*512,y=Math.random()*512;ctx.moveTo(x,y);ctx.lineTo(x+(Math.random()-.5)*28,y+(Math.random()-.5)*28);ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(7,7);texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return texture;
}
function addPyramid(x,z,size,height){
 colliders.push({minX:x-size*.72,maxX:x+size*.72,minZ:z-size*.72,maxZ:z+size*.72});
 const body=new THREE.Mesh(new THREE.ConeGeometry(size,height,4,1),mat(0xb8895d));body.rotation.y=Math.PI/4;body.position.set(x,height/2,z);body.castShadow=true;body.receiveShadow=true;worldGroup.add(body);
 for(let i=0;i<8;i++){const t=i/8,w=size*(1-t*.88),ledge=new THREE.Mesh(new THREE.BoxGeometry(w*1.43,.22,w*1.43),mat(i%2?0xc89b69:0x906744));ledge.position.set(x,height*t,z);ledge.rotation.y=Math.PI/4;ledge.castShadow=true;worldGroup.add(ledge)}
}
function addBuilding(x,z,w,h,d,color){
 colliders.push({minX:x-w/2-.3,maxX:x+w/2+.3,minZ:z-d/2-.3,maxZ:z+d/2+.3});
 box(worldGroup,x,h/2,z,w,h,d,color);
 box(worldGroup,x,h+.13,z,w+.5,.26,d+.5,0x293c4b);
 for(let y=1.5;y<h;y+=3){box(worldGroup,x,y,z-d/2-.09,w,.12,.18,0x9ba9ad)}
 for(let dx=-w/2+.4;dx<w/2-.5;dx+=Math.max(1.8,w/4)){
  box(worldGroup,x+dx,h/2,z-d/2-.1,.12,h,.14,0x263b4b);
  for(let y=1.7;y<h-1;y+=2.4){box(worldGroup,x+dx+.48,y,z-d/2-.13,.76,1.12,.07,0x172c3c);box(worldGroup,x+dx+.48,y,z-d/2-.18,.6,.9,.035,0x78b7c5);box(worldGroup,x+dx+.48,y-.58,z-d/2-.23,.92,.08,.25,0x566d7b)}
 }
 box(worldGroup,x-w*.22,1.05,z-d/2-.14,.95,2.1,.16,0x26343c);
 box(worldGroup,x,h+.42,z,.8,.48,.75,0x53616b);
 // Molduras, pilares y maquinaria de azotea para romper las siluetas cúbicas
 const trim=0x273b4b;
 for(const side of [-1,1])for(const front of [-1,1]){
  const px=x+side*(w/2-.16),pz=z+front*(d/2-.16);
  const pillar=cylinder(worldGroup,px,h/2,pz,.13,.16,h,trim,8);pillar.castShadow=true;
  box(worldGroup,px,h*.72,pz,.38,.12,.38,0x71818a);
 }
 for(let k=0;k<3;k++){
  const unit=box(worldGroup,x-w*.28+k*w*.28,h+.48,z+d*.18,.65,.38,.55,0x263640);
  box(worldGroup,unit.position.x,h+.7,unit.position.z,.72,.07,.62,0x85939a);
 }
 box(worldGroup,x,h*.28,z-d/2-.18,w*.82,.16,.24,0x263b4b);

}
function addPalm(x,z){
 const trunk=cylinder(worldGroup,x,2.2,z,.2,.34,4.4,0x76543a,8);trunk.rotation.z=-.12;
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9,leaf=box(worldGroup,x+Math.cos(a)*1.25,4.2,z+Math.sin(a)*1.25,2.6,.12,.42,0x28785a);leaf.rotation.y=-a;leaf.rotation.z=-.22+Math.cos(a)*.1}
}
function addBot(x,z,index){
 const g=new THREE.Group();g.position.set(x,0,z);worldGroup.add(g);
 const team=index%2?0x315f91:0x9c4053,skin=0xb98263,dark=0x202a35;
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,5,8),mat(team));torso.position.y=1.28;torso.castShadow=true;g.add(torso);
 const vest=new THREE.Mesh(new THREE.CapsuleGeometry(.355,.48,4,8),mat(0x354453));vest.position.set(0,1.34,-.015);vest.castShadow=true;g.add(vest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.235,12,10),mat(skin));head.position.y=2.02;head.castShadow=true;g.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.255,12,8,0,Math.PI*2,0,Math.PI*.58),mat(0x34434a));helmet.position.y=2.12;helmet.castShadow=true;g.add(helmet);
 const faceShield=new THREE.Mesh(new THREE.BoxGeometry(.31,.075,.035),mat(0x182c39,.3));faceShield.position.set(0,2.02,-.21);g.add(faceShield);
 const limbs=[];
 function limb(px,py,pz,len,r,color){const pivot=new THREE.Group();pivot.position.set(px,py,pz);g.add(pivot);const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,7),mat(color));mesh.position.y=-len*.42;mesh.castShadow=true;pivot.add(mesh);return pivot;}
 const armL=limb(-.43,1.65,0,.55,.105,team),armR=limb(.43,1.65,0,.55,.105,team);
 const legL=limb(-.19,.83,0,.68,.14,0x273746),legR=limb(.19,.83,0,.68,.14,0x273746);
 const bootL=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),mat(dark));bootL.position.set(-.19,.12,-.08);g.add(bootL);
 const bootR=bootL.clone();bootR.position.x=.19;g.add(bootR);
 const bot={group:g,alive:true,hp:100,x,z,limbs:[armL,armR,legL,legR],phase:Math.random()*6};bots.push(bot);if(soldierTemplate)applySoldier(g,bot);
}
function clearWorld(){
 lootChests=[];nearbyChest=null;
 if(worldGroup){scene.remove(worldGroup);worldGroup.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
 worldGroup=new THREE.Group();scene.add(worldGroup);bots=[];colliders=[];projectiles=[];enemyProjectiles=[];
}
function addSkyDome(desert,city){
 const geo=new THREE.SphereGeometry(280,40,24),pos=geo.attributes.position,colors=[];
 const top=new THREE.Color(desert?0x547b9b:city?0x405c78:0x3c8292),horizon=new THREE.Color(desert?0xe6b27f:city?0x9aafbd:0xc4d8c4);
 for(let i=0;i<pos.count;i++){const t=THREE.MathUtils.smoothstep(pos.getY(i),-8,42);const c=horizon.clone().lerp(top,t);colors.push(c.r,c.g,c.b)}
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const sky=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false}));
 sky.position.y=5;sky.renderOrder=-1;sky.raycast=()=>{};worldGroup.add(sky);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4.2,20,16),new THREE.MeshBasicMaterial({color:desert?0xffe0ad:0xf2f5ed}));
 sun.position.set(-52,48,-118);sun.raycast=()=>{};worldGroup.add(sun);
}
function addDistantLandmarks(desert,city){
 const rockMat=mat(desert?0x80634e:city?0x344554:0x47634b),farMat=mat(desert?0xa77d5b:city?0x405568:0x56745c);
 for(let i=0;i<24;i++){const x=-150+i*13,z=-225-(i%4)*7,h=10+(i%5)*4,r=7+(i%3)*3;const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,7),i%2?rockMat:farMat);m.position.set(x,h*.48,z);m.rotation.z=(i%3-1)*.08;m.castShadow=false;worldGroup.add(m)}
}
function addLootChest(x,z,index){
 const root=new THREE.Group();root.position.set(x,0,z);worldGroup.add(root);
 const shell=mat(0x39483e,.72),edge=mat(0xb08a4f,.48),dark=mat(0x17221e,.82),glow=new THREE.MeshBasicMaterial({color:0xe8bd65,transparent:true,opacity:.42});
 const base=new THREE.Mesh(new THREE.BoxGeometry(1.25,.62,.86),shell);base.position.y=.42;base.castShadow=true;base.receiveShadow=true;root.add(base);
 const band=new THREE.Mesh(new THREE.BoxGeometry(1.3,.09,.9),edge);band.position.y=.47;root.add(band);
 const lidPivot=new THREE.Group();lidPivot.position.set(0,.73,-.39);root.add(lidPivot);
 const lid=new THREE.Mesh(new THREE.BoxGeometry(1.28,.18,.88),shell);lid.position.set(0,.05,.39);lid.castShadow=true;lidPivot.add(lid);
 const latch=new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.08),edge);latch.position.set(0,-.03,-.04);lidPivot.add(latch);
 for(const side of [-1,1]){const handle=new THREE.Mesh(new THREE.BoxGeometry(.09,.22,.1),dark);handle.position.set(side*.49,.42,-.45);root.add(handle)}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.035,8,28),glow);ring.rotation.x=Math.PI/2;ring.position.y=.06;root.add(ring);
 const lamp=new THREE.PointLight(0xe9bd6b,1.15,5);lamp.position.y=1.25;root.add(lamp);lootChests.push({root,lidPivot,x,z,index,opened:false});
}
function updateLootPrompt(){
 let nearest=null,best=3.35;for(const c of lootChests){if(!c.opened){const d=Math.hypot(player.x-c.x,player.z-c.z);if(d<best){best=d;nearest=c}}}
 nearbyChest=nearest;const b=$('lootBtn');if(b)b.hidden=!playing||!nearest;if(nearest)setMessage('COFRE CERCA · ACÉRCATE Y ABRE EL BOTÍN');
}
function renderInventoryPanel(){
 const host=$('inventoryItems');if(!host)return;
 host.innerHTML=slots.map((n,i)=>'<button class="inventory-weapon '+(weaponSlot===i?'active':'')+'" data-slot="'+i+'"><b>ESPACIO '+(i+1)+'</b><span>'+n.toUpperCase()+'</span><small>'+(n==='Cuchillo'?'CUERPO A CUERPO':ammoState[n].mag+' / '+ammoState[n].reserve)+'</small></button>').join('');
}
function openNearbyChest(){
 if(!playing||!nearbyChest)return;const chest=nearbyChest;chest.opened=true;chest.lidPivot.rotation.x=-1.65;
 const owned=slots.filter(n=>n!=='Cuchillo'),available=weaponData.filter(w=>w.kind!=='knife'&&!owned.includes(w.name));let reward='';
 if(available.length&&(owned.length<2||Math.random()<.38)){
  const w=available[Math.floor(Math.random()*available.length)],slot=slots.findIndex(n=>n==='Cuchillo'),target=slot>=0?slot:weaponSlot;
  slots[target]=w.name;ammoState[w.name]={mag:w.mag,reserve:w.mag*3};weaponSlot=target;equipWeapon();reward='ARMA NUEVA: '+w.name+' · '+w.mag+' / '+(w.mag*3);
 }else if(owned.length&&Math.random()<.72){
  const n=owned[Math.floor(Math.random()*owned.length)],w=weaponData.find(a=>a.name===n);ammoState[n].reserve+=w.mag*2;reward='MUNICIÓN '+n+' · +'+(w.mag*2);
 }else{const before=playerHealth;playerHealth=Math.min(100,playerHealth+35);$('healthValue').textContent=String(playerHealth);reward=playerHealth>before?'BOTIQUÍN · +'+(playerHealth-before)+' HP':'SUMINISTROS · VIDA COMPLETA'}
 $('lootBtn').hidden=true;nearbyChest=null;renderInventoryPanel();setMessage('BOTÍN OBTENIDO · '+reward);
}

function buildWorld(){
 clearWorld();
 const desert=selectedMap==='desert',city=selectedMap==='city',sky=desert?0xc9a27d:city?0x647b91:0x86c5c4;
 scene.background=new THREE.Color(sky);scene.fog=new THREE.Fog(sky,desert?105:city?85:92,desert?320:city?285:300);addSkyDome(desert,city);
 const hemi=new THREE.HemisphereLight(0xd9edff,desert?0x8b6544:0x34433d,1.5);worldGroup.add(hemi);
 const sun=new THREE.DirectionalLight(desert?0xffd3a0:0xd5e7ff,2.35);sun.position.set(-35,55,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-145;sun.shadow.camera.right=145;sun.shadow.camera.top=145;sun.shadow.camera.bottom=-145;sun.shadow.bias=-0.00018;sun.shadow.normalBias=0.025;worldGroup.add(sun);
 const terrain=new THREE.PlaneGeometry(360,360,112,112),pos=terrain.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setZ(i,desert?Math.sin(x*.055+z*.027)*.8+Math.cos(z*.08)*.45:city?0:Math.sin(x*.04)*.35+Math.cos(z*.06)*.3)}
 terrain.computeVertexNormals();const groundTexture=makeGroundTexture(desert?'#b99068':city?'#59656c':'#788b60');const ground=new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({color:0xffffff,map:groundTexture,bumpMap:groundTexture,bumpScale:.12,roughness:.96}));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;worldGroup.add(ground);
 if(city){
  box(worldGroup,0,.015,-112,19,.04,255,0x252e38);for(let z=-5;z>-235;z-=10)box(worldGroup,0,.045,z,.18,.025,4.2,0xe6c66e);
  [[-18,-24,10,15,10],[18,-32,11,21,11],[-28,-55,12,24,12],[29,-62,11,18,11],[-5,-83,13,27,12],[18,-108,12,21,12],[-39,-96,10,18,10],[42,-28,9,14,9],[-55,-145,14,29,13],[52,-160,12,24,12],[-20,-195,15,32,14],[30,-225,13,28,12]].forEach((a,i)=>addBuilding(a[0],a[1],a[2],a[3],a[4],i%2?0x3b5265:0x526577));
 }else if(desert){
  addPyramid(-25,-58,12,19);addPyramid(0,-90,18,29);addPyramid(27,-64,11,18);addPyramid(43,-112,15,24);addPyramid(-58,-166,18,27);addPyramid(58,-205,22,34);addPyramid(-8,-238,15,24);
  for(let i=0;i<38;i++){const x=-82+i*4.5,z=-230+Math.sin(i*.7)*12,rock=new THREE.Mesh(new THREE.DodecahedronGeometry(2+Math.random()*2,1),mat(i%2?0x8d694b:0xa17a55));rock.position.set(x,.5,z);rock.scale.y=.6;rock.rotation.y=Math.random()*3;rock.castShadow=true;worldGroup.add(rock)}
 }else{
  const water=new THREE.Mesh(new THREE.PlaneGeometry(340,115),new THREE.MeshStandardMaterial({color:0x248da0,roughness:.25}));water.rotation.x=-Math.PI/2;water.position.set(0,-.01,-165);worldGroup.add(water);
  for(let i=0;i<52;i++)addPalm((Math.random()-.5)*155,-8-Math.random()*205);
  [[-18,-35],[18,-48],[-30,-92],[32,-114],[54,-155],[-55,-170]].forEach((p,i)=>{box(worldGroup,p[0],1.5,p[1],7,3,6,i%2?0x98734e:0x826044);const roof=new THREE.Mesh(new THREE.ConeGeometry(5,2.5,4),mat(0x604b37));roof.position.set(p[0],4.1,p[1]);roof.rotation.y=Math.PI/4;worldGroup.add(roof);colliders.push({minX:p[0]-3.5,maxX:p[0]+3.5,minZ:p[1]-3,maxZ:p[1]+3})})
 }
 for(let i=0;i<58;i++){const x=(Math.random()-.5)*142,z=-10-Math.random()*190,w=1.5+Math.random()*2,d=1.4+Math.random()*2;colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});box(worldGroup,x,.72,z,w,1.44,d,i%3===0?0x806044:city?0x59636b:0x9a7956);for(let y=.15;y<1.4;y+=.38)box(worldGroup,x,y,z-d/2-.025,w*.9,.045,.05,0x463d32);if(i%4===0)cylinder(worldGroup,x+2,.62,z,.48,.48,1.24,0x5a6268,12)}
 for(let i=0;i<70;i++){const x=(Math.random()-.5)*155,z=-6-Math.random()*200,rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+Math.random()*.9,1),mat(desert?0x92704f:city?0x48515a:0x626e50));rock.position.set(x,.18,z);rock.scale.set(1.4,.55,1);rock.rotation.set(Math.random(),Math.random()*3,Math.random());rock.castShadow=true;worldGroup.add(rock)}
 addDistantLandmarks(desert,city);
 const pts=desert?[[-8,-17],[8,-27],[-17,-36],[18,-46],[0,-56],[31,-42],[-42,-112],[45,-135],[-12,-165],[28,-198]]:city?[[-13,-19],[14,-29],[-22,-44],[23,-51],[0,-68],[34,-78],[-48,-126],[52,-148],[-15,-182],[34,-216]]:[[-14,-18],[14,-24],[-22,-40],[20,-48],[0,-60],[34,-75],[-48,-126],[52,-148],[-15,-182],[34,-216]];
 pts.forEach((p,i)=>addBot(p[0],p[1],i));[[0,8],[-12,-27],[18,-52],[-34,-88],[38,-121],[-52,-166],[48,-207],[0,-238]].forEach((p,i)=>addLootChest(p[0],p[1],i));worldGroup.add(new THREE.AmbientLight(0xffffff,.22));
}
async function loadGameAssets(){
 try{
  const [lm,sm]=await Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'),import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js')]);
  GLTFLoaderClass=lm.GLTFLoader;skeletonClone=sm.clone;const loader=new GLTFLoaderClass();
  loader.load('https://toolbenchdev.com/gamedev/cc0-game-assets/low-poly-squad-kit/files/glb/figure.glb',g=>{soldierTemplate=g.scene;soldierAnimations=g.animations||[];if(playerAvatar)applySoldier(playerAvatar,{});for(const b of bots)if(b.group)applySoldier(b.group,b)},undefined,e=>console.warn('Character asset unavailable',e));
  const assets={akWood:'https://cdn.3dassets.dev/assets/33322/v1/model.glb',kar:'https://cdn.3dassets.dev/assets/33334/v1/model.glb',smgLong:'https://cdn.3dassets.dev/assets/27545/v1/model.glb',smgCompact:'https://cdn.3dassets.dev/assets/19433/v1/model.glb',sniper:'https://cdn.3dassets.dev/assets/19438/v1/model.glb',assault:'https://cdn.3dassets.dev/assets/33318/v1/model.glb'};
  for(const [key,url] of Object.entries(assets))loader.load(url,g=>{weaponTemplates[key]=g.scene;if(slots[weaponSlot]&&weaponAssetKey(slots[weaponSlot])===key)equipWeapon()},undefined,e=>console.warn('Weapon asset unavailable: '+key,e));
 }catch(e){console.warn('3D asset loader unavailable',e)}
}
function addAdvancedSoldierDetails(target){
 const g=new THREE.Group();
 const cloth=new THREE.MeshStandardMaterial({color:0x34483f,roughness:1});
 const rubber=new THREE.MeshStandardMaterial({color:0x171f25,roughness:.9});
 const metal=new THREE.MeshStandardMaterial({color:0x68777a,metalness:.6,roughness:.4});
 const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m)};
 for(const x of [-.42,.42]){
  add(new THREE.SphereGeometry(.17,12,10),cloth,x,1.63,-.01,1.15,1,.9);
  add(new THREE.BoxGeometry(.19,.28,.17),rubber,x,1.03,-.03);
  add(new THREE.BoxGeometry(.2,.09,.24),metal,x,.83,-.04);
 }
 add(new THREE.BoxGeometry(.14,.38,.13),rubber,0,1.25,-.29);
 add(new THREE.BoxGeometry(.38,.08,.28),cloth,0,1.72,-.04);
 add(new THREE.SphereGeometry(.11,12,8),rubber,0,2.15,0,1.5,.45,1.2);
 target.add(g);
}
function addTacticalGear(target){
 const gear=new THREE.Group();
 const armor=new THREE.MeshStandardMaterial({color:0x273a3b,roughness:.92,metalness:.04});
 const fabric=new THREE.MeshStandardMaterial({color:0x465247,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x182329,roughness:.8});
 const metal=new THREE.MeshStandardMaterial({color:0x8c9891,metalness:.55,roughness:.42});
 const part=(geo,material,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;gear.add(m);return m};
 part(new THREE.BoxGeometry(.62,.64,.27),armor,0,1.3,-.12);
 part(new THREE.BoxGeometry(.68,.12,.3),fabric,0,1.63,-.1);
 part(new THREE.BoxGeometry(.11,.58,.1),fabric,-.24,1.31,-.25);
 part(new THREE.BoxGeometry(.11,.58,.1),fabric,.24,1.31,-.25);
 for(let x of [-.2,0,.2]){
  part(new THREE.BoxGeometry(.16,.2,.12),fabric,x,1.18,-.285);
  part(new THREE.BoxGeometry(.16,.06,.13),dark,x,1.29,-.29);
 }
 part(new THREE.BoxGeometry(.12,.24,.12),dark,.37,1.46,-.02);
 part(new THREE.BoxGeometry(.1,.16,.08),metal,.37,1.49,-.09);
 for(let x of [-.19,.19]){
  part(new THREE.BoxGeometry(.27,.18,.24),armor,x,.56,-.08);
  part(new THREE.BoxGeometry(.12,.1,.16),dark,x,.49,-.16);
 }
 part(new THREE.BoxGeometry(.46,.54,.22),fabric,0,1.32,.22);
 part(new THREE.BoxGeometry(.3,.06,.24),dark,0,1.59,.22);
 target.add(gear);
}
function addCombatAccessories(target){
 const g=new THREE.Group();
 const armor=new THREE.MeshStandardMaterial({color:0x27383a,roughness:.9});
 const fabric=new THREE.MeshStandardMaterial({color:0x56604a,roughness:1});
 const rubber=new THREE.MeshStandardMaterial({color:0x151e24,roughness:.86});
 const metal=new THREE.MeshStandardMaterial({color:0x87949a,metalness:.62,roughness:.38});
 const add=(geo,material,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m)};
 // Casco con soporte frontal y dos módulos de visión nocturna
 add(new THREE.BoxGeometry(.19,.09,.12),rubber,0,2.22,-.2);
 for(const x of [-.065,.065]){
  add(new THREE.CylinderGeometry(.035,.035,.075,10),metal,x,2.19,-.28,1,1,.8);
  add(new THREE.CylinderGeometry(.025,.025,.012,10),new THREE.MeshBasicMaterial({color:0x6dc8b5}),x,2.19,-.32);
 }
 // Hombreras, rodilleras, bolsillos y radio de comunicaciones
 for(const x of [-.43,.43]){
  add(new THREE.SphereGeometry(.17,10,8),armor,x,1.67,0,1.2,.72,1);
  add(new THREE.BoxGeometry(.24,.2,.16),fabric,x,.72,-.13);
 }
 for(const x of [-.23,0,.23]){
  add(new THREE.BoxGeometry(.15,.19,.09),fabric,x,1.1,-.31);
  add(new THREE.BoxGeometry(.13,.035,.1),rubber,x,1.19,-.32);
 }
 add(new THREE.BoxGeometry(.13,.28,.12),rubber,.39,1.48,.02);
 const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.008,.012,.42,6),metal);antenna.position.set(.42,1.82,.04);antenna.rotation.z=-.08;g.add(antenna);
 target.add(g);
}
function applySoldier(target,entity){if(!soldierTemplate)return;const model=skeletonClone?skeletonClone(soldierTemplate):soldierTemplate.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=2.05/Math.max(size.y,.01);model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);target.clear();target.add(model);addTacticalGear(target);addAdvancedSoldierDetails(target);addCombatAccessories(target);entity.mixer=new THREE.AnimationMixer(model);entity.actions={};target.userData.mixer=entity.mixer;target.userData.actions=entity.actions;for(const clip of soldierAnimations)entity.actions[clip.name.toLowerCase()]=entity.mixer.clipAction(clip);const idle=Object.keys(entity.actions).find(n=>n.includes('idle'))||Object.keys(entity.actions)[0];if(idle)entity.actions[idle].play();entity.currentAction=idle;target.userData.currentAction=idle;if(target===playerAvatar&&weaponGroup&&cameraMode==='third'){target.add(weaponGroup);weaponGroup.position.set(.42,1.34,-.28);weaponGroup.rotation.y=Math.PI;weaponGroup.scale.setScalar(.68)}}
function setSoldierAction(entity,kind){
 if(!entity.actions)return;
 const key=Object.keys(entity.actions).find(n=>n===kind||n.includes(kind));
 if(!key||key===entity.currentAction)return;
 if(entity.currentAction&&entity.actions[entity.currentAction])entity.actions[entity.currentAction].fadeOut(.16);
 entity.actions[key].reset().fadeIn(.16).play();entity.currentAction=key;
}
function refreshWeaponModel(){}
function makePlayerAvatar(){
 const g=new THREE.Group();scene.add(g);
 const suit=mat(0x344d61),vest=mat(0x263b4d),skin=mat(0xb98263),dark=mat(0x17232d);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,5,9),suit);torso.position.y=1.28;g.add(torso);
 const chest=new THREE.Mesh(new THREE.BoxGeometry(.58,.58,.28),vest);chest.position.set(0,1.38,-.02);g.add(chest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),skin);head.position.y=2.02;g.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8,0,Math.PI*2,0,Math.PI*.58),dark);helmet.position.y=2.12;g.add(helmet);
 const limbs=[];
 function limb(x,y,len,r,color){const p=new THREE.Group();p.position.set(x,y,0);g.add(p);const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,8),mat(color));m.position.y=-len*.42;p.add(m);return p;}
 limbs.push(limb(-.43,1.62,.58,.115,0x344d61),limb(.43,1.62,.58,.115,0x344d61),limb(-.19,.83,.72,.14,0x273746),limb(.19,.83,.72,.14,0x273746));
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.48,.58,.2),mat(0x435365));pack.position.set(0,1.35,.22);g.add(pack);
 playerAvatar=g;avatarLimbs=limbs;if(soldierTemplate)applySoldier(g,{});
}
function updateEnemyProjectiles(dt){for(let i=enemyProjectiles.length-1;i>=0;i--){const p=enemyProjectiles[i];p.life-=dt;p.mesh.position.addScaledVector(p.dir,p.speed*dt);if(p.mesh.position.distanceTo(new THREE.Vector3(player.x,1.05+jumpOffset,player.z))<.58){hurtPlayer(8);if(p.mesh.parent)p.mesh.parent.remove(p.mesh);p.mesh.geometry.dispose();enemyProjectiles.splice(i,1);continue}if(p.life<=0){if(p.mesh.parent)p.mesh.parent.remove(p.mesh);p.mesh.geometry.dispose();enemyProjectiles.splice(i,1)}}}
function updateProjectiles(dt){
 for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i],step=Math.min(p.speed*dt,p.remaining);
  p.mesh.position.addScaledVector(p.direction,step);p.remaining-=step;
  p.trail.geometry.setFromPoints([p.mesh.position.clone().addScaledVector(p.direction,-.72),p.mesh.position]);
  if(p.remaining<=0){
   worldGroup.remove(p.mesh);scene.remove(p.trail);p.mesh.geometry.dispose();p.trail.geometry.dispose();projectiles.splice(i,1);
  }
 }
}
function weaponAssetKey(name){if(name==='AK-47')return null;if(name==='Uzi')return 'smgCompact';if(name==='UMP45')return 'smgLong';if(name==='MP5')return 'smgCompact';if(name==='Kar98k')return 'kar';if(name==='M700')return 'sniper';return null}
function makeDetailedAK(){
 const g=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:0x252b2e,metalness:.82,roughness:.29});
 const darkSteel=new THREE.MeshStandardMaterial({color:0x111719,metalness:.68,roughness:.38});
 const wood=new THREE.MeshStandardMaterial({color:0x70452a,roughness:.78});
 const woodLight=new THREE.MeshStandardMaterial({color:0x93613a,roughness:.7});
 const rubber=new THREE.MeshStandardMaterial({color:0x202629,roughness:.92});
 const sight=new THREE.MeshStandardMaterial({color:0x090d0f,metalness:.55,roughness:.42});
 const boxPart=(x,y,z,w,h,d,m,rz=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.z=rz;o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
 const cyl=(x,y,z,r,len,m)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,16),m);o.position.set(x,y,z);o.rotation.x=Math.PI/2;o.castShadow=true;g.add(o);return o};
 const tube=(pts,r,m)=>{const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2])));const o=new THREE.Mesh(new THREE.TubeGeometry(curve,28,r,10,false),m);o.castShadow=true;g.add(o);return o};
 // Culata de madera y cantonera
 boxPart(0,0,.76,.2,.22,.65,wood);
 boxPart(0,-.015,1.09,.22,.24,.09,rubber);
 boxPart(0,.015,.43,.17,.16,.24,woodLight);
 // Cajón de mecanismos, tapa superior y guardamanos
 boxPart(0,.015,.08,.22,.25,.57,steel);
 boxPart(0,.155,.08,.2,.045,.55,darkSteel);
 boxPart(0,.015,-.37,.19,.17,.42,wood);
 boxPart(0,.12,-.36,.18,.045,.39,woodLight);
 // Cañón largo, bloque de gas y bocacha
 cyl(0,.055,-.86,.047,.72,steel);
 cyl(0,.055,-1.24,.035,.12,darkSteel);
 cyl(0,.055,-1.31,.05,.12,steel);
 // Punto de mira delantero y alza trasera
 boxPart(0,.19,-1.02,.055,.18,.055,darkSteel);
 boxPart(0,.22,-1.02,.09,.035,.08,steel);
 boxPart(0,.19,.28,.07,.13,.08,darkSteel);
 boxPart(0,.27,.28,.11,.035,.08,steel);
 // Empuñadura inclinada y guardamonte
 boxPart(0,-.23,.2,.13,.34,.17,rubber,-.22);
 tube([[-.105,-.15,.02],[-.11,-.3,-.08],[-.1,-.3,-.24],[.1,-.3,-.24],[.105,-.15,.02]],.018,steel);
 // Cargador curvo característico del AK, no cargador recto de ametralladora
 tube([[0,-.12,-.015],[0,-.27,-.015],[0,-.39,.045],[0,-.47,.16],[0,-.49,.31],[0,-.45,.39]],.085,steel);
 boxPart(0,-.26,.0,.17,.09,.16,darkSteel);
 // Remates de madera y tornillería visibles
 for(const z of [-.53,-.22,.48,.9]){
  const pin=cyl(0,.0,z,.018,.012,darkSteel);pin.rotation.x=Math.PI/2;
 }
 for(const side of [-1,1]){
  boxPart(side*.116,.01,.07,.012,.13,.32,darkSteel);
  boxPart(side*.1,-.06,-.38,.018,.035,.24,woodLight);
 }
 return g;
}
function makeWeapon(name){
 if(name==='AK-47')return makeDetailedAK();
 const g=new THREE.Group(),M=new THREE.MeshStandardMaterial({color:0x303b43,metalness:.8,roughness:.3}),D=new THREE.MeshStandardMaterial({color:0x151b20,metalness:.45,roughness:.4}),W=new THREE.MeshStandardMaterial({color:0x754a2c,roughness:.8}),P=new THREE.MeshStandardMaterial({color:0x303a40,roughness:.7}),R=new THREE.MeshStandardMaterial({color:0x171b1e,roughness:.9}),S=new THREE.MeshStandardMaterial({color:0x9aa4a8,metalness:.9,roughness:.2});
 const B=(x,y,z,a,b,c,m,r=0)=>{let o=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),m);o.position.set(x,y,z);o.rotation.z=r;o.castShadow=true;g.add(o)},C=(x,y,z,r,l,m)=>{let o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,12),m);o.position.set(x,y,z);o.rotation.x=Math.PI/2;g.add(o)},T=(pts,r,m)=>{let o=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),18,r,8,false),m);g.add(o)};
 if(name==='Cuchillo'){B(0,0,.1,.14,.2,.42,R);B(0,.02,-.35,.07,.04,.7,S);B(0,0,-.12,.2,.07,.07,D);return g}
 const ak=name==='AK-47',ump=name==='UMP45',kar=name==='Kar98k',m7=name==='M700',mp=name==='MP5',uzi=name==='Uzi',sn=kar||m7,L=sn?1.95:ak?1.58:ump?1.28:mp?1.16:uzi ? .88:1.1;
 B(0,0,0,.22,.22,sn?.72:.58,ak?D:P);B(0,.15,-.02,.13,.05,.7,M);B(0,0,-L*.48,.07,.07,L*.54,M);C(0,.02,-L*.7,.04,.34,M);
 if(ak){B(0,0,.54,.2,.18,.66,W);B(0,0,.9,.22,.2,.1,R);B(0,.1,.25,.18,.13,.46,W);B(0,0,-.37,.23,.18,.58,W);C(0,0,-.91,.04,.35,M);T([[0,-.2,0],[0,-.34,-.04],[0,-.49,-.12],[0,-.58,-.24]],.075,M);B(0,-.16,.14,.13,.3,.18,W,-.12)}
 else if(sn){B(0,-.02,.58,.24,.22,.94,kar?W:P);B(0,0,1.05,.25,.23,.12,R);B(0,0,-.4,.17,.15,.72,kar?W:P);B(0,.2,-.15,.07,.07,.4,D);B(.14,.08,.03,.07,.07,.2,M);B(0,-.18,-.06,.13,.27,.2,kar?W:D);if(m7){C(0,.29,-.14,.08,.48,D);C(0,.29,-.14,.05,.49,S)}}
 else if(ump||mp){B(0,0,.48,.13,.1,.5,M);B(0,0,.77,.22,.14,.13,R);B(0,0,-.35,.23,.17,.45,P);B(0,-.17,-.4,.14,.22,.18,D);B(0,.16,-.43,.08,.12,.3,M);B(0,-.22,-.1,.14,.34,.2,D)}
 else{B(0,-.06,.25,.18,.24,.24,P);B(0,.02,-.2,.22,.25,.34,M);B(0,.18,-.2,.08,.08,.24,D);B(0,-.32,-.05,.15,.36,.2,M)}
 B(0,.22,-.18,.07,.1,.08,D);B(0,.18,-.7,.06,.12,.07,D);B(0,-.16,.08,.11,.25,.14,ak||kar?W:R,-.16);T([[-.09,-.12,.08],[-.09,-.28,.02],[-.09,-.28,-.12],[-.09,-.12,-.16]],.018,M);C(0,.02,-L*.84,.05,.12,D);B(0,-.36,.04,.18,.2,.4,P,.16);return g
}
function equipWeapon(){
 if(reloadTimer){clearTimeout(reloadTimer);reloadTimer=null}reloading=false;
 if(weaponGroup&&weaponGroup.parent)weaponGroup.parent.remove(weaponGroup);
 const name=slots[weaponSlot],assetKey=weaponAssetKey(name),template=assetKey&&weaponTemplates[assetKey];
 weaponGroup=new THREE.Group();
 if(template){
  const model=template.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const desiredLength=name==='M700'||name==='Kar98k'?1.55:name==='Uzi'?.9:name==='AK-47'?1.42:1.28,scale=desiredLength/Math.max(size.z,.01);
  model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.rotation.y=cameraMode==='first'?Math.PI:0;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});weaponGroup.add(model);
 }else{weaponGroup.add(makeWeapon(name));if(cameraMode==='third')weaponGroup.rotation.y=Math.PI}
 if(cameraMode==='first'){camera.add(weaponGroup);weaponGroup.position.set(.5,-.43,-1.05)}
 else if(playerAvatar){playerAvatar.add(weaponGroup);weaponGroup.position.set(.4,1.25,-.22)}
 attachWeaponOptic(weaponGroup,name);const w=weaponData.find(a=>a.name===name)||weaponData[0];$('weaponName').textContent=w.name;$('weaponType').textContent=w.kind==='knife'?'CUERPO A CUERPO':w.kind==='sniper'?'FRANCOTIRADOR':w.kind==='smg'?'SUBFUSIL':'FUSIL DE ASALTO';updateAmmoHud();renderScopeOptions();renderInventoryPanel();
}
function scopeOptionsFor(name){
 if(name==='AK-47')return [1,2,3,4];
 if(name==='UMP45'||name==='Uzi'||name==='MP5')return [1];
 if(name==='M700')return [1,6];
 if(name==='Kar98k')return [1,8];
 return [1];
}
function renderScopeOptions(){
 const host=$('scopeChoices');if(!host)return;
 const name=slots[weaponSlot],options=scopeOptionsFor(name);
 if(!options.includes(weaponScopes[name]))weaponScopes[name]=options[0];
 host.innerHTML=options.map(n=>'<button type="button" class="scope-choice '+(weaponScopes[name]===n?'active':'')+'" data-zoom="'+n+'">×'+n+'</button>').join('');
 host.querySelectorAll('.scope-choice').forEach(btn=>btn.addEventListener('pointerdown',e=>{
  e.preventDefault();e.stopPropagation();weaponScopes[name]=Number(btn.dataset.zoom);renderScopeOptions();equipWeapon();
  if(aiming){scopeZoom=weaponScopes[name];updateAimView()}
  setMessage('MIRA ×'+weaponScopes[name]+' EQUIPADA');
 }));
}
function attachWeaponOptic(group,name){
 if(!group||name==='Cuchillo')return;
 const zoom=weaponScopes[name]||1,optic=new THREE.Group();
 const metal=new THREE.MeshStandardMaterial({color:0x202a30,metalness:.78,roughness:.27});
 const dark=new THREE.MeshStandardMaterial({color:0x111a20,metalness:.58,roughness:.42});
 const glass=new THREE.MeshPhysicalMaterial({color:zoom>=6?0x83b9d0:0x6cc5db,metalness:.22,roughness:.1,transparent:true,opacity:.72,clearcoat:1,emissive:0x12303b,emissiveIntensity:.18});
 const rail=new THREE.Mesh(new THREE.BoxGeometry(.2,.035,.38),dark);rail.position.set(0,.105,-.1);optic.add(rail);
 const tubeLength=zoom>=6?.34:zoom>=2?.24:.14;
 const body=new THREE.Mesh(new THREE.CylinderGeometry(zoom>=6?.082:.067,zoom>=6?.082:.067,tubeLength,18),metal);
 body.rotation.x=Math.PI/2;body.position.set(0,.18,-.1);optic.add(body);
 for(const z of [-.1-tubeLength/2,-.1+tubeLength/2]){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(zoom>=6?.083:.069,.012,8,20),dark);
  ring.position.set(0,.18,z);optic.add(ring);
 }
 const lens=new THREE.Mesh(new THREE.CylinderGeometry(zoom>=6?.061:.05,zoom>=6?.061:.05,.008,18),glass);
 lens.rotation.x=Math.PI/2;lens.position.set(0,.18,-.1-tubeLength/2-.006);optic.add(lens);
 if(zoom===1){
  const hood=new THREE.Mesh(new THREE.BoxGeometry(.13,.045,.12),dark);hood.position.set(0,.24,-.1);optic.add(hood);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),new THREE.MeshBasicMaterial({color:0xff453c}));dot.position.set(0,.18,-.1-tubeLength/2-.012);optic.add(dot);
 }
 group.add(optic);
}
function updateAimView(){
 if(!camera)return;
 const aimButton=$('aimBtn');if(aimButton)aimButton.classList.toggle('active',aiming);
 const weapon=slots[weaponSlot],zoom=aiming?(weaponScopes[weapon]||1):1;
 const type=zoom>=6?'sniper':zoom>=2?'holo':(['UMP45','MP5','Uzi'].includes(weapon)?'dot':'cross');
 scopeZoom=zoom;camera.fov=baseFov/zoom;camera.updateProjectionMatrix();
 const overlay=$('scopeOverlay');if(overlay)overlay.classList.toggle('visible',aiming&&zoom>1);
 const crosshair=document.querySelector('.crosshair');
 if(crosshair)crosshair.className='crosshair reticle-'+type;
 const lens=document.querySelector('.scope-lens');
 if(lens){lens.className='scope-lens reticle-'+type;lens.innerHTML='<i></i><span class="reticle-hash"></span><b>×'+zoom+'</b>';}
 const label=$('aimBtn')?.querySelector('small');if(label)label.textContent=aiming?'CERRAR MIRA':'APUNTAR';
 const mag=$('scopeMagnification');if(mag)mag.textContent='×'+zoom;
}
function toggleAim(){
 if(!playing)return;
 $('aimBtn').classList.toggle('active',!aiming);
 aiming=!aiming;
 if(aiming){aimReturnMode=cameraMode;cameraMode='first';equipWeapon()}
 else{cameraMode=aimReturnMode;equipWeapon()}
 $('cameraBtn').querySelector('small').textContent=aiming?'MODO MIRA':cameraMode==='third'?'TERCERA PERSONA':'PRIMERA PERSONA';
 updateAimView();setMessage(aiming?'MIRA ×'+(weaponScopes[slots[weaponSlot]]||1)+' ACTIVADA':'MIRA CERRADA');
}
function updateCoins(){$('coinCount').textContent=coins;$('gameCoins').textContent=coins}
function updateAmmoHud(){const n=slots[weaponSlot],w=weaponData.find(x=>x.name===n),a=ammoState[n];$('weaponSlotLabel').textContent=w&&w.kind==='knife'?'∞':a?a.mag+' / '+a.reserve:'--';if($('weaponName'))$('weaponName').textContent=n}
function reloadWeapon(){const n=slots[weaponSlot],w=weaponData.find(x=>x.name===n),a=ammoState[n];if(!playing||!w||w.kind==='knife'||reloading||!a||a.mag===w.mag||a.reserve<=0)return;reloading=true;$('reloadBtn').classList.add('active');setMessage('RECARGANDO '+n.toUpperCase());reloadTimer=setTimeout(()=>{const need=w.mag-a.mag,take=Math.min(need,a.reserve);a.mag+=take;a.reserve-=take;reloading=false;reloadTimer=null;$('reloadBtn').classList.remove('active');updateAmmoHud();setMessage('RECARGA COMPLETA')},w.kind==='sniper'?1750:1350)}
function setMessage(t){$('gameMessage').textContent=t}
function resize(){
 if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function init3D(){
 if(!window.THREE){setMessage('No se pudo cargar el motor 3D. Revisa tu conexión e inténtalo otra vez.');return false}
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(baseFov,innerWidth/innerHeight,.1,360);
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 camera.position.set(0,3.9,22);scene.add(camera);makePlayerAvatar();
 clock=new THREE.Clock();buildWorld();equipWeapon();loadGameAssets();
 window.addEventListener('resize',resize);
 return true;
}
function enterGame(){
 disconnectMultiplayer();
 aiming=false;cameraMode='third';updateAimView();
 $('lobbyHeader').hidden=true;lobby.hidden=true;screen.hidden=false;document.body.style.overflow='hidden';
 if(!renderer&&!init3D()){return}
 playing=true;run=false;crouch=false;jumpV=0;jumpOffset=0;playerY=1.7;yaw=0;pitch=0;slots[0]='Cuchillo';slots[1]='Cuchillo';Object.keys(ammoState).forEach(n=>{ammoState[n]={mag:0,reserve:0}});weaponSlot=0;player={x:0,z:18};playerHealth=100;$('healthValue').textContent='100';camera.position.set(0,3.9,22);camera.rotation.set(0,0,0);if(playerAvatar)playerAvatar.position.set(0,0,18);weaponSlot=0;equipWeapon();updateCoins();
 $('lootBtn').hidden=true;renderInventoryPanel();$('mapTitle').textContent=selectedMap==='desert'?'PIRÁMIDES DEL DESIERTO':selectedMap==='city'?'CIUDAD NEÓN':'ISLA TROPICAL';
 $('matchModeLabel').textContent=selectedGameMode==='battle'?'BATTLE ROYALE · PROTOTIPO':'COMBATE POR EQUIPOS · PROTOTIPO';
 buildWorld();equipWeapon();setMessage(pendingOnlineRoom?'CONECTANDO A SALA '+pendingOnlineRoom:'ESCENA 3D ACTIVA · USA VARIOS DEDOS PARA JUGAR');
 if(pendingOnlineRoom){connectMultiplayer(pendingOnlineRoom);pendingOnlineRoom=null}
}
function leaveGame(){disconnectMultiplayer();if($('lootBtn'))$('lootBtn').hidden=true;aiming=false;updateAimView();activeTouches.clear();playing=false;if(reloadTimer){clearTimeout(reloadTimer);reloadTimer=null}reloading=false;joy.id=null;joy.x=joy.y=0;look.id=null;run=false;crouch=false;fireHeld=false;screen.hidden=true;lobby.hidden=false;$('lobbyHeader').hidden=false;document.body.style.overflow='';}
window.startBloxWorld=enterGame;
$('playBtn').addEventListener('click',enterGame);
$('onlinePlayBtn').addEventListener('click',()=>{const room=(prompt('Escribe un código de sala (por ejemplo ARENA01):')||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,16);if(!room)return;pendingOnlineRoom=room;enterGame()});
$('backLobbyBtn').addEventListener('click',leaveGame);
$('shopOpen').addEventListener('click',()=>$('shopModal').hidden=false);
$('shopClose').addEventListener('click',()=>$('shopModal').hidden=true);
$('shopModal').addEventListener('click',e=>{if(e.target===$('shopModal'))$('shopModal').hidden=true});
document.querySelectorAll('.map-option').forEach(b=>b.addEventListener('click',()=>{selectedMap=b.dataset.map;document.querySelectorAll('.map-option').forEach(x=>x.classList.toggle('selected',x===b));const n={desert:'PIRÁMIDES DEL DESIERTO',city:'CIUDAD NEÓN',island:'ISLA TROPICAL'};$('lobbyMapName').textContent=n[selectedMap];$('lobbyMapNumber').textContent=selectedMap==='desert'?'01':selectedMap==='city'?'02':'03'}));
document.querySelectorAll('.mode-option').forEach(b=>b.addEventListener('click',()=>{selectedGameMode=b.dataset.mode;document.querySelectorAll('.mode-option').forEach(x=>{const active=x===b;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',String(active))});$('lobbyModeName').textContent=selectedGameMode==='battle'?'BATTLE ROYALE':'COMBATE POR EQUIPOS'}));
$('cameraBtn').addEventListener('pointerdown',e=>{e.preventDefault();cameraMode=cameraMode==='third'?'first':'third';equipWeapon();$('cameraBtn').querySelector('small').textContent=cameraMode==='third'?'TERCERA PERSONA':'PRIMERA PERSONA';setMessage(cameraMode==='third'?'CÁMARA EN TERCERA PERSONA':'CÁMARA EN PRIMERA PERSONA')});
$('switchBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();weaponSlot=1-weaponSlot;equipWeapon();setMessage('CAMBIASTE A '+slots[weaponSlot].toUpperCase())});
$('arsenalBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();renderInventoryPanel();$('arsenalPanel').hidden=!$('arsenalPanel').hidden});
$('arsenalClose').addEventListener('pointerdown',e=>{e.preventDefault();$('arsenalPanel').hidden=true});
$('slotOne').addEventListener('pointerdown',e=>{e.preventDefault();weaponSlot=0;$('slotOne').classList.add('active');$('slotTwo').classList.remove('active');equipWeapon()});$('slotTwo').addEventListener('pointerdown',e=>{e.preventDefault();weaponSlot=1;$('slotTwo').classList.add('active');$('slotOne').classList.remove('active');equipWeapon()});
$('arsenalPanel').addEventListener('pointerdown',e=>{const b=e.target.closest('.inventory-weapon');if(!b)return;e.preventDefault();e.stopPropagation();weaponSlot=Number(b.dataset.slot);equipWeapon();$('arsenalPanel').hidden=true;setMessage(slots[weaponSlot].toUpperCase()+' EQUIPADO')});$('lootBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();openNearbyChest()});
$('inspectBtn').addEventListener('pointerdown',e=>{e.preventDefault();inspect=1;setMessage('INSPECCIONANDO '+slots[weaponSlot])});
$('reloadBtn').addEventListener('pointerdown',e=>{e.preventDefault();reloadWeapon()});
$('aimBtn').addEventListener('pointerdown',e=>{e.preventDefault();toggleAim()});
$('runBtn').addEventListener('pointerdown',e=>{e.preventDefault();run=!run;$('runBtn').classList.toggle('active',run)});
$('crouchBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(run){slideTimer=.95;slideSpeed=12.4;crouch=true;run=false;$('runBtn').classList.remove('active');setMessage('¡DESLIZAMIENTO!')}else{crouch=!crouch;slideTimer=0}$('crouchBtn').classList.toggle('active',crouch)});
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(jumpOffset<=.02){jumpV=7.1;slideTimer=0;crouch=false;$('crouchBtn').classList.remove('active')}$('jumpBtn').classList.add('active');setTimeout(()=>$('jumpBtn').classList.remove('active'),160)});
$('shootBtn').addEventListener('pointerdown',e=>{e.preventDefault();$('shootBtn')._firePointerId=e.pointerId;fireHeld=true;shoot()});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>window.addEventListener(ev,e=>{if(e.pointerId===$('shootBtn')._firePointerId)fireHeld=false}));
const joyEl=$('joystick');
function joyMove(e){const r=joyEl.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,m=r.width*.34,l=Math.hypot(dx,dy)||1,k=Math.min(1,m/l);joy.x=dx*k/m;joy.y=dy*k/m;$('joystickThumb').style.transform='translate(calc(-50% + '+joy.x*m+'px),calc(-50% + '+joy.y*m+'px))'}
joyEl.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(joy.id!==null)return;joy.id=e.pointerId;activeTouches.set(e.pointerId,'move');joyMove(e)});
canvas.addEventListener('pointerdown',e=>{if(!playing||e.pointerType==='mouse')return;e.preventDefault();if(activeTouches.has(e.pointerId))return;activeTouches.set(e.pointerId,'look');look={id:e.pointerId,x:e.clientX,y:e.clientY}});
window.addEventListener('pointermove',e=>{
 const role=activeTouches.get(e.pointerId);
 if(role==='move'&&e.pointerId===joy.id)joyMove(e);
 if(role==='look'){const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;const sensitivity=aiming?.0026:.0052;yaw-=dx*sensitivity;pitch=Math.max(-.95,Math.min(.95,pitch-dy*sensitivity*.78))}
},{passive:false});
function endTouch(e){
 const role=activeTouches.get(e.pointerId);if(!role)return;
 activeTouches.delete(e.pointerId);
 if(role==='move'&&e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;$('joystickThumb').style.transform='translate(-50%,-50%)'}
 if(role==='look'&&e.pointerId===look.id)look.id=null;
}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>window.addEventListener(ev,endTouch));

window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault()});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function shoot(){
 if(!playing||reloading)return;
 const w=weaponData.find(a=>a.name===slots[weaponSlot])||weaponData[0],now=performance.now();
 if(now-lastShot<w.rate)return;
 if(w.kind!=='knife'&&ammoState[w.name].mag<=0){setMessage('SIN MUNICIÓN · PULSA RECARGAR');return}
 lastShot=now;
 if(w.kind!=='knife'){ammoState[w.name].mag--;updateAmmoHud()}
 const recoilStep=aiming?.012:w.kind==='sniper'?.075:w.kind==='rifle'?.045:.026;recoil=Math.min(.22,recoil+recoilStep);weaponKick=Math.min(.24,weaponKick+(aiming?.07:.12));
 if(w.kind==='knife'){
  let hit=null,dist=3.2;
  for(const b of bots){if(!b.alive)continue;const d=Math.hypot(b.x-player.x,b.z-player.z);if(d<dist){const dx=b.x-player.x,dz=b.z-player.z,a=Math.abs(Math.atan2(-dx,-dz)-yaw);if(a<.75){hit=b;dist=d}}}
  if(hit){hit.alive=false;hit.hp=0;hit.group.visible=false;coins+=25;updateCoins();setMessage('ELIMINACIÓN +25 BB')}else setMessage('ACÉRCATE AL RIVAL');
  return;
 }
 const range=w.kind==='sniper'?280:w.kind==='rifle'?220:150;
 const movingSpread=Math.hypot(joy.x,joy.y)>.22||run||slideTimer>0,spread=aiming?(w.kind==='sniper'?.00035:.0015):(movingSpread?.018:.008);
 raycaster.setFromCamera(new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread),camera);
 raycaster.near=.05;raycaster.far=range;
 const hits=raycaster.intersectObjects(worldGroup.children,true);
 const firstHit=hits.length?hits[0]:null;
 const direction=raycaster.ray.direction.clone().normalize();
 const cameraOrigin=raycaster.ray.origin.clone();
 const endPoint=firstHit?firstHit.point.clone():cameraOrigin.clone().addScaledVector(direction,range);
 let hitBot=null;
 if(firstHit){
  let node=firstHit.object;
  while(node&&node!==worldGroup){hitBot=bots.find(b=>b.group===node&&b.alive)||null;if(hitBot)break;node=node.parent}
 }
 if(hitBot){
  const distance=cameraOrigin.distanceTo(firstHit.point),headshot=firstHit.point.y>hitBot.group.position.y+1.78;
  const baseDamage=w.kind==='sniper'?88:w.kind==='rifle'?36:24;
  const falloff=Math.max(.48,1-Math.max(0,distance-range*.3)/(range*.7)*.52);
  const damage=Math.max(1,Math.round(baseDamage*falloff*(headshot?1.75:1)));
  hitBot.hp=Math.max(0,(hitBot.hp??100)-damage);
  if(hitBot.hp<=0){hitBot.alive=false;hitBot.group.visible=false;coins+=25;updateCoins();setMessage('ELIMINACIÓN · '+Math.round(distance)+' M · +25 BB')}
  else setMessage((headshot?'¡DISPARO A LA CABEZA! · ':'IMPACTO · ')+damage+' DAÑO · '+Math.round(distance)+' M');
 }else if(firstHit){setMessage('IMPACTO EN SUPERFICIE · '+Math.round(cameraOrigin.distanceTo(firstHit.point))+' M')}
 else{setMessage('DISPARO A LARGA DISTANCIA · '+range+' M')}
 const origin=new THREE.Vector3(player.x,1.48+jumpOffset,player.z).addScaledVector(direction,.48);
 const travel=endPoint.distanceTo(origin),visualDirection=endPoint.clone().sub(origin).normalize();
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),new THREE.MeshBasicMaterial({color:0xffe6a1}));
 mesh.position.copy(origin);worldGroup.add(mesh);
 const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,endPoint]),new THREE.LineBasicMaterial({color:0xffbd67,transparent:true,opacity:.88}));
 scene.add(trail);
 projectiles.push({mesh,trail,direction:visualDirection,speed:620,remaining:Math.max(.1,travel)});
}
function collidesAt(x,z,ignoreBot=null){
 const r=.43;
 if(x < -166+r || x > 166-r || z < -260+r || z > 32-r)return true;
 for(const b of bots){if(b!==ignoreBot&&b.alive&&Math.hypot(x-b.x,z-b.z)<.88)return true}
 for(const c of colliders){const px=Math.max(c.minX,Math.min(x,c.maxX)),pz=Math.max(c.minZ,Math.min(z,c.maxZ)),dx=x-px,dz=z-pz;if(dx*dx+dz*dz<r*r)return true}
 return false;
}
function moveWithCollision(dx,dz){
 const nx=player.x+dx,nz=player.z+dz;
 if(!collidesAt(nx,player.z))player.x=nx;
 if(!collidesAt(player.x,nz))player.z=nz;
}
function hurtPlayer(amount){
 playerHealth=Math.max(0,playerHealth-amount);$('healthValue').textContent=String(playerHealth);
 if(playerHealth===0){playing=false;setMessage('TE ELIMINARON · VUELVE AL LOBBY PARA REINTENTAR');}
}
function updateBots(dt){
 for(const b of bots){
  if(!b.alive)continue;
  const dx=player.x-b.x,dz=player.z-b.z,dist=Math.hypot(dx,dz);
  b.group.rotation.y=Math.atan2(dx,dz);
  if(b.mixer)b.mixer.update(dt);
  setSoldierAction(b,dist>12?'run':dist>5.5?'walk':'idle');
  b.phase+=dt*(dist>5.5?8:2);
  if(b.limbs){const swing=Math.sin(b.phase)*.62;b.limbs[0].rotation.x=swing;b.limbs[1].rotation.x=-swing;b.limbs[2].rotation.x=-swing;b.limbs[3].rotation.x=swing}
  if(dist>5.5&&dist<125){const speed=dist>40?2.35:dist>12?1.8:1.05,step=speed*dt,tx=b.x+dx/dist*step,tz=b.z+dz/dist*step;if(!collidesAt(tx,tz,b)){b.x=tx;b.z=tz;b.group.position.set(b.x,0,b.z)}}
  b.cooldown=(b.cooldown||0)-dt;
  if(dist<30&&b.cooldown<=0){b.cooldown=1.45+Math.random()*.7;const origin=new THREE.Vector3(b.x,1.45,b.z),target=new THREE.Vector3(player.x,1.05+jumpOffset,player.z),dir=target.sub(origin).normalize(),shot=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),new THREE.MeshBasicMaterial({color:0xff765d}));shot.position.copy(origin);worldGroup.add(shot);enemyProjectiles.push({mesh:shot,dir,life:2.2,speed:25})}
 }
}
function animate(){
 requestAnimationFrame(animate);if(!renderer||!scene)return;const dt=Math.min(clock.getDelta(),.04);
 if(playing){
  if(fireHeld)shoot();
  networkTick+=dt;if(networkTick>=.1){networkTick=0;sendNetworkState()}
  let f=-joy.y,s=joy.x;
  if(keys.w||keys.arrowup)f=1;if(keys.s||keys.arrowdown)f=-1;if(keys.a||keys.arrowleft)s=-1;if(keys.d||keys.arrowright)s=1;
  const len=Math.hypot(f,s)||1;if(len>1){f/=len;s/=len}
  const baseSpeed=slideTimer>0?slideSpeed*(.72+slideTimer/.95):crouch?2.0:run?8.8:4.5,speed=aiming?baseSpeed*.76:baseSpeed;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt;
  const dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt;
  moveWithCollision(dx,dz);
  if(jumpOffset>0||jumpV>0){jumpV-=18*dt;jumpOffset=Math.max(0,jumpOffset+jumpV*dt);if(jumpOffset===0)jumpV=0}
  if(slideTimer>0){slideTimer=Math.max(0,slideTimer-dt);if(slideTimer===0){slideSpeed=0;crouch=false;$('crouchBtn').classList.remove('active')}}
  const targetY=slideTimer>0?-.18:crouch?-.1:0;
  const moving=Math.hypot(f,s)>.08;if(run&&crouch&&moving&&slideTimer<=0){slideTimer=.95;slideSpeed=12.4}walkTime+=moving?dt*(run?13:8):0;
  if(playerAvatar){playerAvatar.position.set(player.x,targetY+jumpOffset,player.z);playerAvatar.rotation.y=yaw+Math.PI;const swing=moving?Math.sin(walkTime)*.62:0;avatarLimbs[0].rotation.x=swing;avatarLimbs[1].rotation.x=-swing;avatarLimbs[2].rotation.x=-swing;avatarLimbs[3].rotation.x=swing;}
  if(playerAvatar&&playerAvatar.userData.mixer){setSoldierAction(playerAvatar.userData,slideTimer>0?'slide':jumpOffset>.08?'jump':crouch?'crouch':moving?(run?'run':'walk'):'idle');playerAvatar.userData.mixer.update(dt);}
  if(cameraMode==='third'){camera.position.set(player.x+Math.sin(yaw)*4.2,2.85+jumpOffset+(slideTimer>0?-.55:0),player.z+Math.cos(yaw)*4.2);camera.rotation.order='YXZ';camera.rotation.set(pitch+recoil,yaw,0)}else{camera.position.set(player.x-Math.sin(yaw)*.18,1.62+jumpOffset,player.z-Math.cos(yaw)*.18);camera.rotation.order='YXZ';camera.rotation.set(pitch+recoil,yaw,0)}recoil=Math.max(0,recoil-dt*.24);
  if(weaponGroup){weaponBob=moving?Math.sin(walkTime)*.018:0;weaponKick=Math.max(0,weaponKick-dt*4.5);if(cameraMode==='first'){weaponGroup.position.set(.48,-.43+weaponBob,-.95+weaponKick);weaponGroup.rotation.set(-.08-weaponKick*.55,-.08,Math.sin(walkTime)*.012)}else{weaponGroup.position.y=1.34+weaponBob;weaponGroup.rotation.z=Math.sin(walkTime)*.012}}
  if(inspect>0)inspect=Math.max(0,inspect-dt*1.6);
  const desiredFov=aiming?baseFov/(weaponScopes[slots[weaponSlot]]||1):baseFov;camera.fov+= (desiredFov-camera.fov)*Math.min(1,dt*10);camera.updateProjectionMatrix();
  updateBots(dt);updateProjectiles(dt);updateEnemyProjectiles(dt);updateLootPrompt();
 }
 renderer.render(scene,camera);
}
if(!window.THREE){setMessage('Cargando motor 3D…')}
animate();
updateCoins();
})();