(() => {
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('game'),lobby=$('lobby'),screen=$('gameScreen');
let scene,camera,renderer,clock,worldGroup,weaponGroup,GLTFLoaderClass=null,skeletonClone=null,soldierTemplate=null,soldierAnimations=[],weaponTemplates={};
let playing=false,run=false,crouch=false,jumpV=0,playerY=1.7;
let yaw=0,pitch=0,lastShot=0,fireHeld=false,inspect=0,coins=500;
let selectedMap='desert',weaponSlot=0;
const slots=['AK-47','UMP45'];
const weaponData=[
 {name:'AK-47',kind:'rifle',rate:330,color:0x46545b},
 {name:'UMP45',kind:'smg',rate:210,color:0x354b5a},
 {name:'Kar98k',kind:'sniper',rate:850,color:0x69523e},
 {name:'M700',kind:'sniper',rate:900,color:0x3d4a53},
 {name:'MP5',kind:'smg',rate:170,color:0x354c5e},
 {name:'Uzi',kind:'smg',rate:125,color:0x4c555b},
 {name:'Cuchillo',kind:'knife',rate:380,color:0xb8c8d0}
];
let player={x:0,z:18};
let joy={x:0,y:0,id:null},look={id:null,x:0,y:0};
let bots=[],botMeshes=[],keys={},colliders=[],projectiles=[],playerAvatar=null,avatarLimbs=[];
let playerHealth=100,recoil=0,walkTime=0,slideTimer=0,weaponKick=0,weaponBob=0;
const raycaster=new THREE.Raycaster();
const materials={};
function mat(color,roughness=1){const key=color+'_'+roughness;if(!materials[key])materials[key]=new THREE.MeshStandardMaterial({color,roughness,metalness:0.02});return materials[key]}
function box(parent,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(parent,x,y,z,r1,r2,h,color,segments=8){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
function addPyramid(x,z,size,height){
 colliders.push({minX:x-size*.72,maxX:x+size*.72,minZ:z-size*.72,maxZ:z+size*.72});
 const m=new THREE.Mesh(new THREE.ConeGeometry(size,height,4,1),mat(0xb8895d));m.rotation.y=Math.PI/4;m.position.set(x,height/2,z);m.castShadow=true;m.receiveShadow=true;worldGroup.add(m);
}
function addBuilding(x,z,w,h,d,color){
 colliders.push({minX:x-w/2-.25,maxX:x+w/2+.25,minZ:z-d/2-.25,maxZ:z+d/2+.25});
 const b=box(worldGroup,x,h/2,z,w,h,d,color);
 box(worldGroup,x,h+0.12,z,w+0.3,.24,d+0.3,0x43596c);
 for(let y=1.6;y<h-1;y+=2.2)for(let dx=-w/2+1;dx<w/2-.5;dx+=2.2){
  const win=box(worldGroup,x+dx,y,z-d/2-.025,.8,.9,.05,0x9bcbd3);
 }
}
function addPalm(x,z){
 cylinder(worldGroup,x,2,z,.24,.38,4,0x76543a,7);
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=box(worldGroup,x+Math.cos(a)*1.05,4.05,z+Math.sin(a)*1.05,2.3,.13,.48,0x28785a);leaf.rotation.y=-a;leaf.rotation.z=-.18}
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
 const bot={group:g,alive:true,x,z,limbs:[armL,armR,legL,legR],phase:Math.random()*6};bots.push(bot);if(soldierTemplate)applySoldier(g,bot);
}
function clearWorld(){
 if(worldGroup){scene.remove(worldGroup);worldGroup.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
 worldGroup=new THREE.Group();scene.add(worldGroup);bots=[];colliders=[];projectiles=[];
}
function buildWorld(){
 clearWorld();
 const sky=selectedMap==='desert'?0xd9a875:selectedMap==='city'?0x71849a:0x8dcac6;
 scene.background=new THREE.Color(sky);scene.fog=new THREE.Fog(sky,42,145);
 const groundColor=selectedMap==='desert'?0xc39461:selectedMap==='city'?0x4b5966:0xd7c28b;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),mat(groundColor));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;worldGroup.add(ground);
 const grid=new THREE.GridHelper(180,45,0x806d58,0x9d876b);grid.position.y=.005;grid.material.transparent=true;grid.material.opacity=.025;worldGroup.add(grid);
 const sun=new THREE.HemisphereLight(0xe5f2ff,0x806044,2.0);scene.add(sun);
 const key=new THREE.DirectionalLight(0xffe0b2,2.2);key.position.set(-25,45,20);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
 if(selectedMap==='desert'){
  addPyramid(-20,-48,10,16);addPyramid(0,-72,15,24);addPyramid(21,-54,9,15);addPyramid(34,-88,13,21);
 }else if(selectedMap==='city'){
  [[-13,-28,8,13,8],[12,-34,9,18,9],[-25,-54,10,20,10],[24,-61,9,15,9],[-5,-78,11,24,11],[17,-95,10,19,10],[-34,-88,8,16,8]].forEach((a,i)=>addBuilding(a[0],a[1],a[2],a[3],a[4],i%2?0x344b60:0x526577));
 }else{
  [[-13,-22],[12,-30],[-23,-47],[24,-54],[-8,-68],[18,-82],[34,-36],[-35,-75]].forEach(p=>addPalm(p[0],p[1]));
  const water=new THREE.Mesh(new THREE.PlaneGeometry(220,65),mat(0x3999a8,.4));water.rotation.x=-Math.PI/2;water.position.set(0,.02,-95);worldGroup.add(water);
 }
 // Volumetric cover blocks.
 [[-5,-13],[7,-24],[-15,-32],[15,-39],[2,-48]].forEach((p,i)=>{colliders.push({minX:p[0]-1.65,maxX:p[0]+1.65,minZ:p[1]-1.65,maxZ:p[1]+1.65});box(worldGroup,p[0],.9,p[1],3.3,1.8,3.3,i%2?0x80664d:0x9c7957)});
 // Rocas, escombros y pequeñas variaciones visuales para dar escala al terreno.
 for(let i=0;i<58;i++){
  const x=(Math.random()-.5)*112,z=-8-Math.random()*92;
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.25+Math.random()*.65,0),mat(selectedMap==='desert'?0x94704f:selectedMap==='city'?0x48515a:0x887b59));
  rock.position.set(x,.12,z);rock.scale.set(1+Math.random(),.45+Math.random()*.45,.8+Math.random());rock.rotation.set(Math.random(),Math.random()*Math.PI,Math.random());rock.castShadow=true;rock.receiveShadow=true;worldGroup.add(rock);
 }
 const pts=selectedMap==='desert'?[[-5,-15],[5,-20],[-10,-29],[10,-34],[0,-43]]:selectedMap==='city'?[[-12,-20],[13,-28],[-20,-44],[22,-50],[0,-65]]:[[-14,-18],[14,-24],[-22,-40],[20,-48],[0,-60]];
 pts.forEach((p,i)=>addBot(p[0],p[1],i));
 scene.add(new THREE.AmbientLight(0xffffff,.18));
}
async function loadGameAssets(){
 try{
  const [loaderMod,skelMod]=await Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'),import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js')]);
  GLTFLoaderClass=loaderMod.GLTFLoader;skeletonClone=skelMod.clone;
  const loader=new GLTFLoaderClass();
  loader.load('https://toolbenchdev.com/gamedev/cc0-game-assets/low-poly-squad-kit/files/glb/figure.glb',g=>{
   soldierTemplate=g.scene;soldierAnimations=g.animations||[];
   if(playerAvatar)applySoldier(playerAvatar,{});
   for(const b of bots)if(b.group)applySoldier(b.group,b);
  },undefined,e=>console.warn('Soldier asset load failed',e));
  const urls={rifle:'weapon_rifle.glb',smg:'weapon_smg.glb',sniper:'weapon_sniper.glb',pistol:'weapon_pistol.glb'};
  for(const [kind,file] of Object.entries(urls))loader.load('https://toolbenchdev.com/gamedev/cc0-game-assets/low-poly-squad-kit/files/glb/'+file,g=>{weaponTemplates[kind]=g.scene;if(weaponGroup)refreshWeaponModel();},undefined,e=>console.warn('Weapon asset load failed',e));
 }catch(e){console.warn('External 3D assets unavailable; using fallback models',e)}
}
function applySoldier(target,entity){
 if(!soldierTemplate)return;
 const model=skeletonClone?skeletonClone(soldierTemplate):soldierTemplate.clone(true);
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=2.05/Math.max(size.y,.01);model.scale.setScalar(scale);
 model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 target.clear();target.add(model);
 entity.mixer=new THREE.AnimationMixer(model);entity.actions={};target.userData.mixer=entity.mixer;target.userData.actions=entity.actions;
 for(const clip of soldierAnimations){const action=entity.mixer.clipAction(clip);entity.actions[clip.name.toLowerCase()]=action;}
 const idle=Object.keys(entity.actions).find(n=>n.includes('idle'))||Object.keys(entity.actions)[0];
 if(idle)entity.actions[idle].play();
 entity.currentAction=idle;target.userData.currentAction=idle;
}
function setSoldierAction(entity,kind){
 if(!entity.actions)return;
 const key=Object.keys(entity.actions).find(n=>n===kind||n.includes(kind));
 if(!key||key===entity.currentAction)return;
 if(entity.currentAction&&entity.actions[entity.currentAction])entity.actions[entity.currentAction].fadeOut(.16);
 entity.actions[key].reset().fadeIn(.16).play();entity.currentAction=key;
}
function refreshWeaponModel(){
 if(!weaponGroup)return;
 const name=slots[weaponSlot],kind=name==='Kar98k'||name==='M700'?'sniper':(['UMP45','MP5','Uzi'].includes(name)?'smg':'rifle');
 const template=weaponTemplates[kind];if(!template)return;
 const model=template.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z);
 model.scale.setScalar(1.18/Math.max(max,.01));model.rotation.y=Math.PI;
 model.position.set(0,0,0);weaponGroup.clear();weaponGroup.add(model);
}
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
function updateProjectiles(dt){
 for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i],step=Math.min(p.speed*dt,p.remaining),origin=p.mesh.position.clone();
  raycaster.set(origin,p.direction);raycaster.far=step+.12;
  const hits=raycaster.intersectObjects(worldGroup.children.filter(o=>o!==p.mesh),true);
  let hitPoint=null,hitBot=null;
  if(hits.length){hitPoint=hits[0].point;let root=hits[0].object;while(root.parent&&root.parent!==worldGroup)root=root.parent;hitBot=bots.find(b=>b.group===root&&b.alive)||null;}
  if(hitPoint){p.mesh.position.copy(hitPoint);if(hitBot){hitBot.alive=false;hitBot.group.visible=false;coins+=25;updateCoins();setMessage('IMPACTO · BOT ELIMINADO +25 BB')}else setMessage('IMPACTO');}
  else{p.mesh.position.addScaledVector(p.direction,step);p.remaining-=step;}
  p.trail.geometry.setFromPoints([p.mesh.position.clone().addScaledVector(p.direction,-.65),p.mesh.position]);
  if(hitPoint||p.remaining<=0){worldGroup.remove(p.mesh);scene.remove(p.trail);p.mesh.geometry.dispose();p.trail.geometry.dispose();projectiles.splice(i,1);}
 }
}
function makeWeapon(name){
 const d=weaponData.find(w=>w.name===name)||weaponData[0],g=new THREE.Group(),metal=mat(d.color,.55),dark=mat(0x17212a,.85),wood=mat(0x72533b);
 if(d.kind==='knife'){
  box(g,0,0,0,.12,.18,.58,dark);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.08,.72),mat(0xc5d4dc,.25));blade.position.set(0,.08,-.56);blade.rotation.x=-.12;g.add(blade);
 }else{
  const long=d.kind==='sniper'?1.65:d.kind==='smg'?.82:1.12;
  box(g,0,0,0,.18,.2,long,d.color);
  box(g,0,-.02,long*.54,.09,.09,.45,dark);
  box(g,0,-.16,-.05,.14,.38,.25,d.kind==='sniper'?0x514337:0x263544);
  box(g,0,.17,-.04,.12,.13,.32,0x1b2834);
  box(g,0,.28,-.12,.25,.13,.32,0x273e52);
  if(d.kind==='sniper')box(g,0,.25,-.1,.18,.17,.65,0x263746);
  if(d.kind==='smg')box(g,0,-.14,.22,.16,.32,.2,0x1c2833);
 }
 // A simple forearm/hand anchors the first-person weapon in view.
 const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.52,4,8),mat(0x354454));sleeve.position.set(-.13,-.4,.12);sleeve.rotation.z=-.12;g.add(sleeve);const glove=new THREE.Mesh(new THREE.SphereGeometry(.14,9,7),mat(0x252d35));glove.position.set(-.12,-.1,-.12);g.add(glove);
 return g;
}
function equipWeapon(){
 if(weaponGroup)camera.remove(weaponGroup);
 weaponGroup=makeWeapon(slots[weaponSlot]);refreshWeaponModel();weaponGroup.position.set(.48,-.48,-.88);weaponGroup.rotation.set(-.08,-.08,0);camera.add(weaponGroup);
 const w=weaponData.find(a=>a.name===slots[weaponSlot])||weaponData[0];
 $('weaponName').textContent=w.name;$('weaponType').textContent=w.kind==='knife'?'CUERPO A CUERPO':w.kind==='sniper'?'FRANCOTIRADOR':w.kind==='smg'?'SUBFUSIL':'FUSIL DE ASALTO';
 $('weaponSlotLabel').textContent=(weaponSlot+1)+' / 2';
}
function updateCoins(){$('coinCount').textContent=coins;$('gameCoins').textContent=coins}
function setMessage(t){$('gameMessage').textContent=t}
function resize(){
 if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function init3D(){
 if(!window.THREE){setMessage('No se pudo cargar el motor 3D. Revisa tu conexión e inténtalo otra vez.');return false}
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.1,240);
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setSize(innerWidth,innerHeight,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 camera.position.set(0,3.9,22);scene.add(camera);makePlayerAvatar();
 clock=new THREE.Clock();buildWorld();equipWeapon();loadGameAssets();
 window.addEventListener('resize',resize);
 return true;
}
function enterGame(){
 $('lobbyHeader').hidden=true;lobby.hidden=true;screen.hidden=false;document.body.style.overflow='hidden';
 if(!renderer&&!init3D()){return}
 playing=true;run=false;crouch=false;jumpV=0;playerY=1.7;yaw=0;pitch=0;player={x:0,z:18};playerHealth=100;$('healthValue').textContent='100';camera.position.set(0,3.9,22);camera.rotation.set(0,0,0);if(playerAvatar)playerAvatar.position.set(0,0,18);weaponSlot=0;equipWeapon();updateCoins();
 $('mapTitle').textContent=selectedMap==='desert'?'PIRÁMIDES DEL DESIERTO':selectedMap==='city'?'CIUDAD NEÓN':'ISLA TROPICAL';
 buildWorld();equipWeapon();setMessage('ESCENA 3D ACTIVA · USA VARIOS DEDOS PARA JUGAR');
}
function leaveGame(){playing=false;joy.id=null;joy.x=joy.y=0;look.id=null;run=false;crouch=false;fireHeld=false;screen.hidden=true;lobby.hidden=false;$('lobbyHeader').hidden=false;document.body.style.overflow='';}
window.startBloxWorld=enterGame;
$('playBtn').addEventListener('click',enterGame);
$('backLobbyBtn').addEventListener('click',leaveGame);
$('shopOpen').addEventListener('click',()=>$('shopModal').hidden=false);
$('shopClose').addEventListener('click',()=>$('shopModal').hidden=true);
$('shopModal').addEventListener('click',e=>{if(e.target===$('shopModal'))$('shopModal').hidden=true});
document.querySelectorAll('.map-option').forEach(b=>b.addEventListener('click',()=>{selectedMap=b.dataset.map;document.querySelectorAll('.map-option').forEach(x=>x.classList.toggle('selected',x===b));const n={desert:'PIRÁMIDES DEL DESIERTO',city:'CIUDAD NEÓN',island:'ISLA TROPICAL'};$('lobbyMapName').textContent=n[selectedMap];$('lobbyMapNumber').textContent=selectedMap==='desert'?'01':selectedMap==='city'?'02':'03'}));
$('switchBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();weaponSlot=1-weaponSlot;equipWeapon();setMessage('CAMBIASTE A '+slots[weaponSlot].toUpperCase())});
$('arsenalBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();$('arsenalPanel').hidden=!$('arsenalPanel').hidden});
$('arsenalClose').addEventListener('pointerdown',e=>{e.preventDefault();$('arsenalPanel').hidden=true});
$('slotOne').addEventListener('pointerdown',e=>{e.preventDefault();weaponSlot=0;$('slotOne').classList.add('active');$('slotTwo').classList.remove('active')});
$('slotTwo').addEventListener('pointerdown',e=>{e.preventDefault();weaponSlot=1;$('slotTwo').classList.add('active');$('slotOne').classList.remove('active')});
document.querySelectorAll('.equip-weapon').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();slots[weaponSlot]=weaponData[Number(b.dataset.weapon)].name;equipWeapon();$('arsenalPanel').hidden=true;setMessage(slots[weaponSlot]+' EQUIPADA')}));
$('inspectBtn').addEventListener('pointerdown',e=>{e.preventDefault();inspect=1;setMessage('INSPECCIONANDO '+slots[weaponSlot])});
$('runBtn').addEventListener('pointerdown',e=>{e.preventDefault();run=!run;$('runBtn').classList.toggle('active',run)});
$('crouchBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(run&&Math.hypot(joy.x,joy.y)>.12){slideTimer=.78;crouch=true;run=false;$('runBtn').classList.remove('active');setMessage('¡DESLIZAMIENTO!')}else{crouch=!crouch;slideTimer=0}$('crouchBtn').classList.toggle('active',crouch)});
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(playerY<=1.72)jumpV=6.2;$('jumpBtn').classList.add('active');setTimeout(()=>$('jumpBtn').classList.remove('active'),160)});
$('shootBtn').addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;shoot()});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$('shootBtn').addEventListener(ev,()=>fireHeld=false));
const joyEl=$('joystick');
function joyMove(e){const r=joyEl.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,m=r.width*.34,l=Math.hypot(dx,dy)||1,k=Math.min(1,m/l);joy.x=dx*k/m;joy.y=dy*k/m;$('joystickThumb').style.transform='translate(calc(-50% + '+joy.x*m+'px),calc(-50% + '+joy.y*m+'px))'}
joyEl.addEventListener('pointerdown',e=>{e.preventDefault();joy.id=e.pointerId;joyEl.setPointerCapture(e.pointerId);joyMove(e)});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)joyMove(e)});
function joyEnd(e){if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;$('joystickThumb').style.transform='translate(-50%,-50%)'}}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joyEl.addEventListener(ev,joyEnd));
// Look only on empty canvas area. Pointer capture keeps the drag alive while other fingers touch controls.
canvas.addEventListener('pointerdown',e=>{if(!playing||look.id!==null)return;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==look.id)return;const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;yaw-=dx*.0045;pitch=Math.max(-.85,Math.min(.85,pitch-dy*.0035))});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,e=>{if(e.pointerId===look.id)look.id=null}));
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault()});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function shoot(){
 if(!playing)return;const w=weaponData.find(a=>a.name===slots[weaponSlot])||weaponData[0],now=performance.now();if(now-lastShot<w.rate)return;lastShot=now;recoil=Math.min(.12,recoil+.035);weaponKick=Math.min(.18,weaponKick+.12);
 if(w.kind==='knife'){let hit=null,dist=3.2;for(const b of bots){if(!b.alive)continue;const d=Math.hypot(b.x-player.x,b.z-player.z);if(d<dist) {const dx=b.x-player.x,dz=b.z-player.z,a=Math.abs(Math.atan2(-dx,-dz)-yaw);if(a<.75){hit=b;dist=d}}}if(hit){hit.alive=false;hit.group.visible=false;coins+=25;updateCoins();setMessage('ELIMINACIÓN +25 BB')}else setMessage('ACÉRCATE AL RIVAL');return}
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const direction=raycaster.ray.direction.clone().normalize(),origin=new THREE.Vector3(player.x,1.48,player.z).addScaledVector(direction,.42);
 const range=w.kind==='sniper'?150:w.kind==='rifle'?105:w.kind==='smg'?62:0;
 const speed=w.kind==='sniper'?180:w.kind==='rifle'?145:195;
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),new THREE.MeshBasicMaterial({color:0xffe6a1}));
 mesh.position.copy(origin);worldGroup.add(mesh);
 const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,origin.clone().addScaledVector(direction,.65)]),new THREE.LineBasicMaterial({color:0xffbd67,transparent:true,opacity:.9}));
 scene.add(trail);projectiles.push({mesh,trail,direction,speed,remaining:range});
 setMessage('BALA EN VUELO · ALCANCE '+range+' M');
}
function collidesAt(x,z){
 const r=.43;
 if(x < -58+r || x > 58-r || z < -112+r || z > 26-r) return true;
 for(const b of bots){if(b.alive&&Math.hypot(x-b.x,z-b.z)<.88)return true;}
 for(const c of colliders){
  const px=Math.max(c.minX,Math.min(x,c.maxX)),pz=Math.max(c.minZ,Math.min(z,c.maxZ));
  const dx=x-px,dz=z-pz;
  if(dx*dx+dz*dz<r*r)return true;
 }
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
  b.group.rotation.y=Math.atan2(dx,dz);if(b.mixer)b.mixer.update(dt);setSoldierAction(b,dist>12?'run':dist>5.5?'walk':'idle');b.phase+=dt*(dist>5.5?8:2);b.group.position.y=Math.abs(Math.sin(b.phase))*(dist>5.5?.035:.008);const swing=Math.sin(b.phase)*.62;b.limbs[0].rotation.x=swing;b.limbs[1].rotation.x=-swing;b.limbs[2].rotation.x=-swing;b.limbs[3].rotation.x=swing;
  if(dist>5.5&&dist<34){
   const speed=dist>12?1.25:.55,step=speed*dt,tx=b.x+dx/dist*step,tz=b.z+dz/dist*step;
   if(!collidesAt(tx,tz)){b.x=tx;b.z=tz;b.group.position.set(b.x,0,b.z);}
  }
  b.cooldown=(b.cooldown||0)-dt;
  if(dist<26&&b.cooldown<=0){b.cooldown=1.35+Math.random()*.8;if(Math.random()>.38)hurtPlayer(4);}
 }
}
function animate(){
 requestAnimationFrame(animate);if(!renderer||!scene)return;const dt=Math.min(clock.getDelta(),.04);
 if(playing){
  if(fireHeld)shoot();
  let f=-joy.y,s=joy.x;
  if(keys.w||keys.arrowup)f=1;if(keys.s||keys.arrowdown)f=-1;if(keys.a||keys.arrowleft)s=-1;if(keys.d||keys.arrowright)s=1;
  const len=Math.hypot(f,s)||1;if(len>1){f/=len;s/=len}
  const speed=slideTimer>0?10.5*(.55+slideTimer/.78):crouch?2.0:run?7.4:4.1;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt;
  const dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt;
  moveWithCollision(dx,dz);
  jumpV-=16*dt;playerY+=jumpV*dt;if(playerY<1.7){playerY=1.7;jumpV=0}
  if(slideTimer>0){slideTimer=Math.max(0,slideTimer-dt);if(slideTimer===0){crouch=false;$('crouchBtn').classList.remove('active')}}
  const targetY=slideTimer>0?.78:crouch?1.05:1.7;playerY+=(targetY-playerY)*Math.min(1,dt*(slideTimer>0?18:12));
  const moving=Math.hypot(f,s)>.08;walkTime+=moving?dt*(run?13:8):0;
  if(playerAvatar){playerAvatar.position.set(player.x,slideTimer>0?-.42:crouch?-.22:0,player.z);playerAvatar.rotation.y=yaw;const swing=moving?Math.sin(walkTime)*.62:0;avatarLimbs[0].rotation.x=swing;avatarLimbs[1].rotation.x=-swing;avatarLimbs[2].rotation.x=-swing;avatarLimbs[3].rotation.x=swing;}
  if(playerAvatar&&playerAvatar.userData.mixer){setSoldierAction(playerAvatar.userData,slideTimer>0?'crouch':moving?(run?'run':'walk'):'idle');playerAvatar.userData.mixer.update(dt);}
  camera.position.set(player.x+Math.sin(yaw)*4.2,playerY+2.05,player.z+Math.cos(yaw)*4.2);camera.rotation.order='YXZ';camera.rotation.set(pitch+recoil,yaw,0);recoil=Math.max(0,recoil-dt*.24);
  if(weaponGroup){weaponBob=moving?Math.sin(walkTime)*.018:0;weaponKick=Math.max(0,weaponKick-dt*4.5);weaponGroup.position.set(.48,-.48+weaponBob+(inspect?Math.sin((1-inspect)*Math.PI)*.3:0),-.88+weaponKick);weaponGroup.rotation.set(-.08-weaponKick*.55,-.08,Math.sin(walkTime)*.012+(inspect?Math.sin((1-inspect)*Math.PI)*.7:0));}
  if(inspect>0)inspect=Math.max(0,inspect-dt*1.6);
  updateBots(dt);updateProjectiles(dt);
 }
 renderer.render(scene,camera);
}
if(!window.THREE){setMessage('Cargando motor 3D…')}
animate();
updateCoins();
})();