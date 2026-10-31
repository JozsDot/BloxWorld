(() => {
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('game'),lobby=$('lobby'),screen=$('gameScreen');
let scene,camera,renderer,clock,worldGroup,weaponGroup;
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
let bots=[],botMeshes=[],keys={};
const raycaster=new THREE.Raycaster();
const materials={};
function mat(color,roughness=1){const key=color+'_'+roughness;if(!materials[key])materials[key]=new THREE.MeshStandardMaterial({color,roughness,metalness:0.02});return materials[key]}
function box(parent,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(parent,x,y,z,r1,r2,h,color,segments=8){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
function addPyramid(x,z,size,height){
 const m=new THREE.Mesh(new THREE.ConeGeometry(size,height,4,1),mat(0xb8895d));m.rotation.y=Math.PI/4;m.position.set(x,height/2,z);m.castShadow=true;m.receiveShadow=true;worldGroup.add(m);
}
function addBuilding(x,z,w,h,d,color){
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
 const team=index%2?0x315f91:0x9c4053;
 box(g,0,1.25,0,.82,1.05,.48,team);
 box(g,0,2.05,0,.58,.58,.58,0xc99b79);
 box(g,0,2.25,-.3,.6,.16,.12,0x263648);
 box(g,-.55,1.3,0,.25,.95,.28,team);box(g,.55,1.3,0,.25,.95,.28,team);
 box(g,-.23,.42,0,.28,.84,.34,0x263c57);box(g,.23,.42,0,.28,.84,.34,0x263c57);
 // Fixed face orientation: bots do not rotate toward the player.
 const eyeMat=mat(0x8bdde9,.45);
 const e1=new THREE.Mesh(new THREE.BoxGeometry(.1,.06,.025),eyeMat);e1.position.set(-.14,2.08,-.3);g.add(e1);
 const e2=e1.clone();e2.position.x=.14;g.add(e2);
 bots.push({group:g,alive:true,x,z});
}
function clearWorld(){
 if(worldGroup){scene.remove(worldGroup);worldGroup.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
 worldGroup=new THREE.Group();scene.add(worldGroup);bots=[];
}
function buildWorld(){
 clearWorld();
 const sky=selectedMap==='desert'?0xd9a875:selectedMap==='city'?0x71849a:0x8dcac6;
 scene.background=new THREE.Color(sky);scene.fog=new THREE.Fog(sky,42,145);
 const groundColor=selectedMap==='desert'?0xc39461:selectedMap==='city'?0x4b5966:0xd7c28b;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),mat(groundColor));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;worldGroup.add(ground);
 const grid=new THREE.GridHelper(180,45,0x806d58,0x9d876b);grid.position.y=.005;grid.material.transparent=true;grid.material.opacity=.12;worldGroup.add(grid);
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
 [[-5,-13],[7,-24],[-15,-32],[15,-39],[2,-48]].forEach((p,i)=>box(worldGroup,p[0],.9,p[1],2.8,1.8,2.8,i%2?0x80664d:0x9c7957));
 const pts=selectedMap==='desert'?[[-5,-15],[5,-20],[-10,-29],[10,-34],[0,-43]]:selectedMap==='city'?[[-12,-20],[13,-28],[-20,-44],[22,-50],[0,-65]]:[[-14,-18],[14,-24],[-22,-40],[20,-48],[0,-60]];
 pts.forEach((p,i)=>addBot(p[0],p[1],i));
 scene.add(new THREE.AmbientLight(0xffffff,.18));
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
 box(g,-.13,-.42,.12,.28,.72,.35,0xb77d5d);
 return g;
}
function equipWeapon(){
 if(weaponGroup)camera.remove(weaponGroup);
 weaponGroup=makeWeapon(slots[weaponSlot]);weaponGroup.position.set(.48,-.48,-.88);weaponGroup.rotation.set(-.08,-.08,0);camera.add(weaponGroup);
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
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 camera.position.set(0,1.7,18);scene.add(camera);
 clock=new THREE.Clock();buildWorld();equipWeapon();
 window.addEventListener('resize',resize);
 return true;
}
function enterGame(){
 $('lobbyHeader').hidden=true;lobby.hidden=true;screen.hidden=false;document.body.style.overflow='hidden';
 if(!renderer&&!init3D()){return}
 playing=true;run=false;crouch=false;jumpV=0;playerY=1.7;yaw=0;pitch=0;player={x:0,z:18};camera.position.set(0,playerY,18);camera.rotation.set(0,0,0);weaponSlot=0;equipWeapon();updateCoins();
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
$('crouchBtn').addEventListener('pointerdown',e=>{e.preventDefault();crouch=!crouch;$('crouchBtn').classList.toggle('active',crouch)});
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
 if(!playing)return;const w=weaponData.find(a=>a.name===slots[weaponSlot])||weaponData[0],now=performance.now();if(now-lastShot<w.rate)return;lastShot=now;
 if(w.kind==='knife'){let hit=null,dist=3.2;for(const b of bots){if(!b.alive)continue;const d=Math.hypot(b.x-player.x,b.z-player.z);if(d<dist) {const dx=b.x-player.x,dz=b.z-player.z,a=Math.abs(Math.atan2(-dx,-dz)-yaw);if(a<.75){hit=b;dist=d}}}if(hit){hit.alive=false;hit.group.visible=false;coins+=25;updateCoins();setMessage('ELIMINACIÓN +25 BB')}else setMessage('ACÉRCATE AL RIVAL');return}
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const hits=raycaster.intersectObjects(bots.filter(b=>b.alive).map(b=>b.group),true);
 if(hits.length){let root=hits[0].object;while(root.parent&&root.parent!==worldGroup)root=root.parent;const b=bots.find(v=>v.group===root);if(b){b.alive=false;b.group.visible=false;coins+=25;updateCoins();setMessage('BOT ELIMINADO +25 BB')}}else setMessage('DISPARO · AJUSTA LA MIRA');
}
function animate(){
 requestAnimationFrame(animate);if(!renderer||!scene)return;const dt=Math.min(clock.getDelta(),.04);
 if(playing){
  if(fireHeld)shoot();
  let f=-joy.y,s=joy.x;
  if(keys.w||keys.arrowup)f=1;if(keys.s||keys.arrowdown)f=-1;if(keys.a||keys.arrowleft)s=-1;if(keys.d||keys.arrowright)s=1;
  const len=Math.hypot(f,s)||1;if(len>1){f/=len;s/=len}
  const speed=crouch?2.0:run?7.4:4.1;
  player.x+=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt;
  player.z+=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt;
  player.x=Math.max(-58,Math.min(58,player.x));player.z=Math.max(-112,Math.min(26,player.z));
  jumpV-=16*dt;playerY+=jumpV*dt;if(playerY<1.7){playerY=1.7;jumpV=0}
  const targetY=crouch?1.05:1.7;playerY+=(targetY-playerY)*Math.min(1,dt*12);
  camera.position.set(player.x,playerY,player.z);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
  if(weaponGroup){weaponGroup.position.y=-.48+(inspect?Math.sin((1-inspect)*Math.PI)*.3:0);weaponGroup.rotation.z=inspect?Math.sin((1-inspect)*Math.PI)*.7:0}
  if(inspect>0)inspect=Math.max(0,inspect-dt*1.6);
  // Bots stay fixed in orientation: no camera tracking behavior.
 }
 renderer.render(scene,camera);
}
if(!window.THREE){setMessage('Cargando motor 3D…')}
animate();
updateCoins();
})();