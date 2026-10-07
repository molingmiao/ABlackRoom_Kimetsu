const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let active=null;
const chain={removeClass(){return this;},stop(){return this;},animate(){return this;},css(){return this;}};
const c={State:{},_:s=>s,AudioLibrary:{},AudioEngine:{playSound(){}},Notifications:{notify(){}},
  Engine:{options:{},saveGame(){},event(){},log(){},keyLock:false},Space:{currentFloor:1},Room:{},Path:{outfit:{},onArrival(){}},
  Events:{Setpieces:{},_LEAVE_COOLDOWN:0,activeEvent:()=>active,startEvent:event=>{active=event;load('start');}}};
c.$=()=>chain;c.$.Dispatch=()=>({publish(){}});c.window=c;vm.createContext(c);
for(const file of ['state_manager.js','world.js','achievements.js','world_road_stories.js','long_quests.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
c.$SM=c.StateManager;
const Q=c.LongQuests,W=c.World,sm=c.$SM,copy=v=>JSON.parse(JSON.stringify(v));
c.Achievements._byId=Object.fromEntries(c.Achievements.List.map(item=>[item.id,item]));
W.testMap=W.redeemBlueprints=W.returnOutfit=W.updateTravelGuide=W._reportExpeditionSummary=()=>{};
const map=()=>Array.from({length:61},()=>Array(61).fill('.'));
function load(scene){c.Events.activeScene=scene;const s=active.scenes[scene];if(s.combat)c.Events.fought=false;if(s.onLoad)s.onLoad();}
function click(id){const b=active.scenes[c.Events.activeScene].buttons[id];assert.ok(b,'button '+id);if(b.available)assert.ok(b.available(),'available '+id);if(b.onChoose)b.onChoose();if(b.nextScene==='end'){active=null;c.Engine.keyLock=false;}else load(b.nextScene);}
function embark(){const saved=sm.get('game.world')||{map:map(),mask:[[true]]};W.state=copy(saved);W.curPos=[30,30];W.dead=false;c.Engine.activeModule=W;c.Engine.keyLock=false;active=null;Q.begin();}
function locate(tile){W.curPos=[35,30];W.state.map[35][30]=tile;}
function clues(){click('begin');assert.equal(active.scenes.investigate.buttons.decide.available(),false);click('clueA');click('back');click('clueB');click('back');click('decide');}
function finishStage(branch){
  const before=Q.run().data.npc.stage;clues();click(before===0?branch:'continue');click('act');
  if(before===0)click(branch==='mercy'?'spare':'battle');
  if(c.Events.activeScene==='fight'){
    const s=active;const stateBefore=JSON.stringify(Q.run().data);load('result');assert.equal(JSON.stringify(Q.run().data),stateBefore,'jumping over victory cannot advance');
    load('fight');c.Events.fought=true;click('report');assert.equal(active,s);
  }
  assert.equal(Q.run().data.npc.stage,before+1);click('leave');
}

// Old maps add only five optional sites, never destroy terrain features or fog.
let grid=map();grid[0][0]='I!';grid[60][0]='P';grid[0][60]='Q!';grid[60][60]='K!';grid[21][30]='A';
sm.set('game.world',{map:grid,mask:[[true,false]]},true);const old=copy(grid);Q.configure();
assert.equal(Q.ensureMap(),true);const migrated=sm.get('game.world.map');
for(const tile of ['N','1','2','3','4'])assert.equal(migrated.flat().filter(v=>v===tile).length,1);
for(const [x,y]of [[0,0],[60,0],[0,60],[60,60],[21,30]])assert.equal(migrated[x][y],old[x][y]);
assert.deepEqual(copy(sm.get('game.world.mask')),[[true,false]]);assert.deepEqual(copy(grid),old);
assert.equal(Q.ensureMap(),false);sm.set('game.world.map',Array.from({length:61},()=>Array(61).fill('P!')),true);assert.equal(Q.ensureMap(),false);

// A lost first chapter does not lock a choice or award an ending.
c.State={};embark();locate('N');assert.equal(Q.openNpc(false),true);
load('result');assert.equal(Q.run().data.npc.stage,0);load('start');finishStage('mercy');
assert.equal(sm.get('game.longQuests'),undefined);assert.equal(Q.commit(),false);
W.die('combat');assert.equal(Q._run,null);assert.equal(sm.get('game.longQuests'),undefined);

for(const branch of ['mercy','slay']){
  c.State={};let battles=0;
  for(let stage=0;stage<10;stage++){
    embark();locate(Q.stages[stage].tile);assert.equal(Q.openNpc(false),true);
    const old=JSON.stringify(Q.saved());
    // Actual route differences: murder branch must fight at start and at the cache.
    const event=active;clues();click(stage===0?branch:'continue');click('act');
    if(stage===0)click(branch==='mercy'?'spare':'battle');
    if(c.Events.activeScene==='fight'){
      battles++;if(stage===8)assert.equal(active.scenes.fight.health,branch==='mercy'?80:130);
      c.Events.fought=true;click('report');
    }
    assert.equal(Q.run().data.npc.stage,stage+1);assert.equal(JSON.stringify(Q.saved()),old,'progress is temporary');
    const next=copy(Q.run().data);event.scenes.result.onLoad();assert.deepEqual(copy(Q.run().data),next,'duplicate/stale result ignored');
    click('leave');assert.equal(W.goHome(),true);assert.equal(Q.saved().npc.stage,stage+1);assert.equal(Q.saved().npc.branch,branch);
    assert.equal(Q._run,null,'return drops the in-memory session');
  }
  assert.equal(battles,branch==='mercy'?1:3);
  assert.equal(!!sm.get('achievements.namelessMercy'),branch==='mercy');assert.equal(!!sm.get('achievements.namelessSlay'),branch==='slay');
  const stock=JSON.stringify(sm.get('stores'));Q.checkAchievements();assert.equal(JSON.stringify(sm.get('stores')),stock);
}

c.State={};embark();
for(const tile of ['4','2','1','3']){
  locate(tile);assert.equal(Q.openSite(tile),true);load('lit');assert.ok(!Q.run().data.corners.includes(tile),'cannot skip the switch');
  load('start');click('read');click('wrong');assert.ok(!Q.run().data.corners.includes(tile));click('retry');click('correct');click('leave');
}
assert.equal(Q.saved().corners.length,0);assert.equal(W.goHome(),true);assert.equal(Q.saved().corners.length,4);
assert.equal(!!sm.get('achievements.fourCornerLights'),false,'switches alone never award castle-entry achievement');
assert.equal(Q.onCastleEntry(),false,'opening or cancelling confirmation is not entering');
c.Engine.activeModule=c.Space;c.Engine.options.testerMode=true;assert.equal(Q.onCastleEntry(),false);
c.Engine.options.testerMode=false;assert.equal(Q.onCastleEntry(),true);assert.equal(sm.get('achievements.fourCornerLights'),true);
assert.equal(Q.onCastleEntry(),false);assert.equal(sm.get('stores["solar crystal"]'),5);

embark();Q.visit('Q');Q.visit('J');assert.equal(Q.run().route,0);Q.visit('Q');Q.visit('D');Q.visit('G');Q.visit('J');
assert.equal(Q.run().data.echo,true);assert.equal(Q.saved().echo,false);W.die('combat');assert.equal(Q.saved().echo,false);
embark();['Q','G!','J!'].forEach(Q.visit);assert.equal(W.goHome(),true);assert.equal(sm.get('achievements.roadEcho'),true);
embark();locate('J');assert.equal(Q.openArchive(),false);sm.set('game.roadsideSeen',c.WorldRoadStories.entries.map(e=>e.id),true);
assert.equal(Q.openArchive(),true);load('ending');assert.equal(Q.run().data.archive,false);load('start');click('finish');click('leave');
assert.equal(Q.saved().archive,false);assert.equal(W.goHome(),true);assert.equal(sm.get('achievements.namelessArchive'),true);
const stock=JSON.stringify(sm.get('stores'));embark();locate('J');assert.equal(Q.openArchive(),false);W.goHome();assert.equal(JSON.stringify(sm.get('stores')),stock);
// Corrupt/partial imported values stay bounded and cannot manufacture a branch.
for(const [stage,tile]of [[2,'D'],[6,'R']]){
  sm.set('game.longQuests',{npc:{stage,branch:'mercy'}},true);sm.set('game.world',{map:map()},true);embark();locate('N');
  assert.equal(Q.target(stage),'N','fully cleared towns use the hub instead of locking old saves');assert.equal(Q.openNpc(false),true);
  finishStage('mercy');assert.equal(W.goHome(),true);assert.equal(Q.saved().npc.stage,stage+1);
  sm.set('game.longQuests',{npc:{stage,branch:'slay'}},true);embark();locate(tile);Q.visit(tile);W.state.map[35][30]='P';
  assert.equal(Q.target(stage),'P','a just-cleared town can hand off the quest in place');assert.equal(Q.openNpc(false),true);finishStage('slay');W.goHome();
}
sm.set('game.longQuests',{npc:{stage:99,branch:'unknown'},corners:{}},true);assert.equal(Q.saved().npc.stage,0);assert.equal(Q.saved().corners.length,0);
console.log('PASS: ten real stages on both branches (1 vs 3 battles), death/return checkpoints, choice lock, no duplicate ending rewards, corner migration/switches/real entry, ordered-route and archive eggs.');
