const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const chain = {removeClass(){return this;},stop(){return this;},animate(){return this;},css(){return this;}};
const c = {State:{},_:text=>text,AudioLibrary:{},AudioEngine:{playSound(){}},Room:{},Outside:{},
  Path:{outfit:{},onArrival(){}},Events:{Setpieces:{},_LEAVE_COOLDOWN:1},
  Engine:{options:{},Perks:{},log(){},saveGame(){},event(){}},Notifications:{notify(){}},Math:Object.create(Math)};
c.$ = () => chain;
c.$.extend = (...values) => Object.assign(...values.filter(value=>typeof value !== 'boolean'));
c.$.Dispatch = () => ({publish(){}});
c.window = c;
vm.createContext(c);
for (const file of ['state_manager.js','world.js','early_game.js','events/global.js','events/story_chapters.js','events/road_stories.js','world_story_guide.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
c.$SM = c.StateManager;
const sm = c.$SM, world = c.World, chapter = c.Events.StoryChapters;
const guide = c.WorldStoryGuide;
// DOM rendering is exercised by the real-browser suite; keep the pure model here.
guide.update = () => {};
const copy = value => JSON.parse(JSON.stringify(value));
const map = () => Array.from({length:61},()=>Array(61).fill('.'));
const count = (value,tile) => value.flat().filter(cell=>typeof cell==='string'&&cell[0]===tile).length;
let old = map(); old[30][30]='A'; old[42][30]='P'; old[52][30]='Y!'; old[35][30]='I!';
sm.set('game.world',{map:old,mask:[[true,false]],ironmine:true});
sm.set('game.swordsmithVillageDone',true); sm.set('game.campaignClaims',{smiths:true,pillars:true});
sm.set('character.perks',{mikiri:true}); sm.set('stores',{'nichirin katana':2,scales:8});
sm.set('game.castleMeta.perfectExploration',true);
const original = copy(c.State);
assert.equal(world.ensureStoryLandmarks(),true);
const migrated = sm.get('game.world.map');
assert.equal(count(migrated,'K'),1);assert.equal(count(migrated,'E'),1);
for (const tile of ['Q','G','J']) assert.equal(count(migrated,tile),1);
assert.equal(migrated.flat().filter(cell=>cell==='K').length,1,'old smith completion still permits the new full chapter');
assert.deepEqual(copy(sm.get('game.world.mask')),original.game.world.mask);
assert.deepEqual(copy(sm.get('stores')),original.stores);
assert.deepEqual(copy(sm.get('game.campaignClaims')),original.game.campaignClaims);
assert.equal(sm.get('game.swordsmithVillageDone'),true);assert.equal(!!sm.get('game.swordsmithChapterDone'),false);
assert.equal(sm.get('character.perks.mikiri'),true);assert.equal(sm.get('game.castleMeta.perfectExploration'),true);
assert.equal(migrated[42][30],'P');assert.equal(migrated[52][30],'Y!');assert.equal(migrated[35][30],'I!');
assert.equal(count(old,'K')+count(old,'E'),0,'in-use old map references are not overwritten');
const after = JSON.stringify(c.State);
assert.equal(world.ensureStoryLandmarks(),false);assert.equal(JSON.stringify(c.State),after,'migration is idempotent');
for (const tile of ['E','K','Q','G','J']) {
  const position=migrated.flatMap((row,x)=>row.map((cell,y)=>cell===tile?[x,y]:null).filter(Boolean))[0];
  assert.equal(world.getDistance(position),{E:12,K:22,Q:7,G:11,J:16}[tile]);
}
sm.set('game.world.swordsmith',true);
assert.equal(world.ensureStoryLandmarks(),true,'a safely saved full-chapter map migrates the completion flag');
assert.equal(sm.get('game.swordsmithChapterDone'),true);
assert.equal(count(sm.get('game.world.map'),'K'),1);assert.ok(sm.get('game.world.map').flat().includes('K!'));
const full = Array.from({length:61},()=>Array(61).fill('P!'));
sm.set('game.world',{map:full});sm.set('game.swordsmithChapterDone',false);
assert.equal(world.ensureStoryLandmarks(),false,'no existing landmark or safe house can be overwritten');
assert.deepEqual(copy(sm.get('game.world.map')),full);
sm.set('game.world.map',null);assert.equal(world.ensureStoryLandmarks(),false,'missing maps are not regenerated');

// Fresh generation includes both unique sites; migration does not add duplicates.
c.State={};sm.set('features.location.world',true);sm.set('features.executioner',true);
old=map();old[30][30]='A';old[48][30]='T';old[15][30]='O';sm.set('game.world.map',old);
const originalJquery = c.$;
c.$=Object.assign(()=>{throw new Error('stop after landmark setup');},c.$);
assert.throws(()=>world.init({}),/stop after landmark setup/);
c.$=originalJquery;
const generated=world.generateMap();
assert.equal(count(generated,'K'),1);assert.equal(count(generated,'E'),1);
for (const [tile,scene] of [['Q','sagiriRoad'],['G','drumRoad'],['J','wisteriaHouse']]) {
  assert.equal(count(generated,tile),1);assert.equal(world.LANDMARKS[tile].scene,scene);
}
assert.equal(world.LANDMARKS.K.scene,'swordsmithVillage');assert.equal(world.LANDMARKS.E.scene,'butterflyEstate');
assert.equal(world.LANDMARKS.B.scene,'borehole','E does not collide with the existing B landmark');

// Entering and leaving a briefing cannot award the old remote village victory.
c.Engine.activeModule=c.Room;
const briefing=c.Events.Global.find(event=>event.title==='Smith Village Under Siege');
sm.set('game.buildings.workshop',1);sm.set('game.yoshiwaraDone',true);
assert.equal(briefing.isAvailable(),true);assert.equal(briefing.storySupply,true);
assert.equal(briefing.scenes.start.buttons.refuse.onLoad,undefined);
assert.equal(briefing.scenes.start.buttons.depart.cost,undefined);
briefing.scenes.briefing.onLoad();assert.equal(sm.get('game.swordsmithBriefed'),true);
assert.equal(!!sm.get('game.swordsmithVillageDone'),false);assert.equal(!!sm.get('game.swordsmithChapterDone'),false);
assert.equal(briefing.isAvailable(),false,'the read briefing does not repeat');
assert.equal(c.Events.Global.find(event=>event.title==='The Pillars Convene').storySupply,true);

function enter(id) {
  const definition=chapter.definitions[id];
  const saved=map();saved[30][30]='A';saved[45][30]=definition.tile;saved[40][30]='M!';
  sm.set('game.world',{map:saved,mask:[[true]],mugentrain:true});
  world.state=copy(sm.get('game.world'));world.curPos=[45,30];world.dead=false;
  c.Engine.activeModule=world;chapter.reset(id);
}
function progress(id) {chapter.definitions[id].required.forEach(key=>chapter.mark(id,key));}
world.testMap=()=>{};world.redeemBlueprints=()=>{};world.returnOutfit=()=>{};world.updateTravelGuide=()=>{};
world._reportExpeditionSummary=()=>{};
for (const id of ['butterfly','swordsmith','sagiri','drumRoad','wisteriaHouse']) {
  const definition=chapter.definitions[id];sm.set(definition.flag,false);
  if(definition.legacyFlag) sm.set(definition.legacyFlag,false);
  enter(id);assert.equal(chapter.ready(id),true);
  assert.equal(chapter.finish(id),false,'jumping to the conclusion cannot complete a chapter');
  progress(id);world.state.map[45][30]='Y';assert.equal(chapter.finish(id),false,'another city cannot impersonate the unique story site');
  world.state.map[45][30]=definition.tile;assert.equal(chapter.finish(id),true);
  assert.equal(world.state[id],true);assert.equal(world.state.map[45][30],definition.tile+'!');
  assert.equal(!!sm.get(definition.flag),false,'map completion remains temporary');
  assert.equal(chapter.commit(),false,'calling the commit API before safe return cannot award anything');
  const beforeDeath = copy(c.State);
  world.die('chapter retreat');
  assert.equal(world.state,null,'the actual death path discards the temporary chapter');
  assert.equal(!!sm.get(definition.flag),false);assert.equal(!!sm.hasPerk(definition.perk),false);
  assert.deepEqual(copy(sm.get('game.world')),beforeDeath.game.world,'failed expeditions never save the map');
  assert.equal(chapter.commit(),false);assert.equal(world.goHome(),false,'dead players cannot commit by calling goHome');
  enter(id);assert.equal(chapter.has(id,definition.required[0]),false,'starting another expedition does not resume chapter choices');
  progress(id);assert.equal(chapter.finish(id),true);
  const beforeReward=sm.get('stores["nichirin katana"]',true);
  const rewardBefore=copy(sm.get('stores') || {});
  assert.equal(world.goHome(),true,'the actual safe-return path commits chapter completion');
  assert.equal(sm.get(definition.flag),true);assert.equal(sm.get('game.world.'+id),true);
  if (definition.perk) assert.equal(sm.hasPerk(definition.perk),true);
  else {
    assert.equal(!!sm.hasPerk('undefined'),false,'side stories cannot create an undefined perk');
    for (const [key,amount] of Object.entries(definition.reward)) {
      assert.equal(sm.get('stores['+JSON.stringify(key)+']'),(rewardBefore[key]||0)+amount,'safe return grants exact side reward once');
    }
  }
  if(definition.legacyFlag) {
    assert.equal(sm.get(definition.legacyFlag),true);
    assert.equal(sm.get('stores["nichirin katana"]'),beforeReward+1,'new players receive one village blade on safe return');
  }
  const committed=JSON.stringify(c.State);assert.equal(chapter.commit(),false);
  assert.equal(JSON.stringify(c.State),committed,'repeat completion cannot duplicate training or blade rewards');
}

// Old village players can play the new full chapter without losing eligibility or getting a second blade.
sm.set('game.swordsmithChapterDone',false);sm.set('game.swordsmithVillageDone',true);sm.set('game.yoshiwaraDone',false);
sm.set('game.campaignClaims',{smiths:true,pillars:true});
enter('swordsmith');assert.equal(chapter.ready('swordsmith'),true,'old completion itself retains new-chapter access');
progress('swordsmith');assert.equal(chapter.finish('swordsmith'),true);
const oldBlade=sm.get('stores["nichirin katana"]');assert.equal(world.goHome(),true);
assert.equal(sm.get('stores["nichirin katana"]'),oldBlade,'new full chapter cannot duplicate the legacy fixed reward');
assert.equal(sm.get('game.swordsmithVillageDone'),true);assert.equal(sm.get('game.swordsmithChapterDone'),true);
assert.deepEqual(copy(sm.get('game.campaignClaims')),{smiths:true,pillars:true});

// All scene edges are playable; each chapter has a real battle and no mandatory rare-item dead end.
for(const [key,min,battles] of [['butterflyEstate',20,1],['swordsmithVillage',20,3],['sagiriRoad',12,0],['drumRoad',12,1],['wisteriaHouse',12,1]]) {
  const event=c.Events.Setpieces[key],scenes=event.scenes;
  assert.equal(event.storySupply,true);assert.ok(Object.keys(scenes).length>=min);
  assert.equal(Object.values(scenes).filter(scene=>scene.combat).length,battles);
  const seen=new Set(),queue=['start'];
  while(queue.length) {
    const current=queue.shift();if(seen.has(current)) continue;seen.add(current);
    Object.values(scenes[current].buttons||{}).forEach(button=>{
      const next=button.nextScene;if(next==='end'||!next) return;
      assert.equal(typeof next,'string');assert.ok(scenes[next],`missing ${key} scene ${next}`);queue.push(next);
    });
  }
  assert.equal(seen.size,Object.keys(scenes).length,'no new story scene is unreachable');
}
assert.equal(c.Events.Setpieces.butterflyEstate.scenes.supplies.buttons.day.cost,undefined);
assert.equal(c.Events.Setpieces.swordsmithVillage.scenes.forge.buttons.window.cost,undefined);
assert.equal(c.Events.Setpieces.swordsmithVillage.scenes.dawnChoice.buttons.carry.cost,undefined);
assert.match(c.Events.Setpieces.swordsmithVillage.scenes.start.text.join(' '),/善逸与伊之助此时在别处/);
assert.match(c.Events.Setpieces.swordsmithVillage.scenes.nezuko.text.join(' '),/炭治郎追上半天狗/);
assert.match(c.Events.Setpieces.swordsmithVillage.scenes.genya.text.join(' '),/霞柱已经斩下玉壶/);
assert.equal(c.EarlyGame.milestones().length,21);
const task=c.EarlyGame.milestones().find(item=>item.id==='butterfly');
assert.equal(task.legacyFlag,'game.world.mugentrain','progressed saves are not forced to replay rehabilitation for old mainline rewards');

// New optional sites never add another gate to the existing exploration blessing.
sm.set('game.castleMeta.perfectExploration',false);
sm.set('game.landmarksVisited',Object.fromEntries(Object.keys(world.LANDMARKS).filter(tile=>!['Q','G','J'].includes(tile)).map(tile=>[tile,true])));
assert.equal(world.recordLandmarkVisit('I'),true);
// Revisit uses the ordinary map dispatcher, not a shortcut which awards again.
for (const [id,scene] of [['sagiri','sagiriRoad'],['drumRoad','drumRoad'],['wisteriaHouse','wisteriaHouse']]) {
  enter(id);world.state.map[45][30]=chapter.definitions[id].tile+'!';
  let opened=null;c.Events.startEvent=event=>{opened=event;};
  world.doSpace();assert.equal(opened,c.Events.Setpieces[scene]);
  assert.equal(opened.scenes.start.buttons.enter.available(),false);
  assert.equal(opened.scenes.start.buttons.recap.available(),true);
  const saved=JSON.stringify(c.State);assert.equal(chapter.finish(id),false);assert.equal(JSON.stringify(c.State),saved);
}
assert.equal(world.isRoadStoryTile('K!'),false,'existing cleared landmarks keep their old behavior');

// Guide cannot disclose a hidden point, mutate fog/state, or persist an active journey.
enter('sagiri');sm.set('game.sagiriRoadDone',false);
world.state.mask=Array.from({length:61},()=>Array(61).fill(false));world.curPos=[30,30];
const beforeGuide=JSON.stringify([c.State,world.state]);
let entry=guide.entries().find(site=>site.tile==='Q');
assert.equal(entry.status,'unknown');assert.ok(!entry.route.includes('东'));
assert.equal(JSON.stringify([c.State,world.state]),beforeGuide);
world.state.mask[45][30]=true;
entry=guide.entries().find(site=>site.tile==='Q');assert.equal(entry.status,'known');assert.match(entry.route,/东15 格/);
world.state.sagiri=true;assert.equal(guide.entries().find(site=>site.tile==='Q').status,'pending');
sm.set('game.sagiriRoadDone',true);assert.equal(guide.entries().find(site=>site.tile==='Q').status,'done');
world.dead=true;assert.equal(guide.entries().length,0);
console.log('PASS: five unique story sites, safe migration/death/return, once-only rewards, read-only revisits, fog-safe guide and unchanged mainline/exploration gates.');
