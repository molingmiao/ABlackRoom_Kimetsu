const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const state = {};
const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
const sm = {
  get(key, zero) {let v = state; for (const k of parts(key)) v = v && v[k]; return v == null && zero ? 0 : v;},
  set(key, v) {const keys = parts(key); let o = state; for (const k of keys.slice(0,-1)) o = o[k] || (o[k] = {}); o[keys.at(-1)] = v;},
  add(key, n) {sm.set(key, sm.get(key,true) + n);},
  addM(parent, values) {Object.keys(values).forEach(key=>sm.add(parent+'["'+key+'"]',values[key]));},
  fireUpdate() {},
  setIncome(source, options) {sm.set('income.'+source,options);}
};
let delay, scheduled;
const c = { $SM:sm, _:s=>s, AudioLibrary:{}, AudioEngine:{playSound(){}}, Notifications:{notify(){}},
  Engine:{log(){},saveGame(){},setTimeout(fn, ms){scheduled=fn;delay=ms;return 1;}},
  $:()=>({each(){}}), Math:Object.assign(Object.create(Math),{random:()=>0.99})
};
c.window=c;
vm.createContext(c);
for (const file of ['room.js','outside.js','early_game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
const e=c.EarlyGame;
assert.equal(e.task(),null);
sm.set('game.prologue.done',true);
assert.match(e.task().text,/hearth/);
sm.set('game.fire.value',3);
assert.match(e.task().text,/warm up/);
sm.set('features.location.outside',true);
assert.match(e.task().text,/guest recovers/);
sm.set('game.builder.level',4);sm.set('game.temperature.value',4);
assert.match(e.task().text,/cart/);
assert.equal(e.task().cost.wood,30);
const before=JSON.stringify(state);e.task();e.render();assert.equal(JSON.stringify(state),before,'render is read-only');
for (let n=0;n<5;n++) {sm.set('game.gatherCount',n);assert.equal(e.gatherCooldown(60),n<3?20:60);}
assert.equal(e.gatherCooldown(0),0,'tester cooldown remains zero');
sm.set('game.gatherCount',0);sm.set('game.buildings.cart',1);
assert.match(e.task().text,/first shelter/);
sm.set('game.buildings.hut',1);sm.set('game.population',0);
assert.equal(e.gatherCooldown(60),60,'first shelter ends the introductory boost');
c.Outside.schedulePopIncrease();assert.equal(delay,30000);
assert.equal(scheduled,c.Outside.increasePopulation);
c.Outside.increasePopulation();
assert.equal(sm.get('game.population'),2);
assert.equal(sm.get('game.earlyResidentsArrived'),true);
assert.equal(delay,150000,'later arrivals use the original random schedule');
sm.set('game.population',0);sm.set('game.buildings.hut',0);
assert.equal(e.gatherCooldown(60),60,'losing residents or shelters cannot reset the boost');
sm.set('game.buildings.hut',1);assert.equal(e.firstResidentsPending(),false);
sm.set('game.population',2);assert.match(e.task().text,/trap/);
sm.set('game.buildings.trap',1);assert.match(e.task().text,/hunting lodge/);
sm.set('game.buildings.lodge',1);assert.match(e.task().text,/trading post/);
sm.set('game.buildings.trading post',1);assert.equal(e.task().cost.fur,40);
sm.set('stores.compass',1);assert.equal(e.task(),null);
sm.set('stores.compass',0);sm.set('features.location.path',true);assert.equal(e.task(),null);
assert.equal(e.gatherCooldown(60),60,'old advanced saves receive no opening boost');
assert.equal(e.milestone().id,'cart','advanced saves can claim opening milestones explicitly');
assert.equal(e.claimMilestone('unknown'),false);
const beforeWood=sm.get('stores.wood',true);
assert.equal(e.claimMilestone('cart'),true);
assert.equal(sm.get('stores.wood'),beforeWood+40);
assert.equal(e.claimMilestone('cart'),false,'duplicate and stale claims cannot pay twice');
const claimsCopy=JSON.parse(JSON.stringify(sm.get('game.campaignClaims')));
sm.set('game.campaignClaims',claimsCopy);
assert.equal(e.claimMilestone('cart'),false,'claim survives save reload');
for(const id of ['shelter','traps','hunters','trade','compass']) assert.equal(e.claimMilestone(id),true);
assert.equal(e.milestone().id,'food');
assert.equal(e.claimMilestone('food'),false,'locked stage cannot be claimed');
for(const [id,building] of [['food','smokehouse'],['workshop','workshop'],['mine','iron mine']]) {
  sm.set('game.buildings["'+building+'"]',1);
  assert.equal(e.claimMilestone(id),true);
}
assert.equal(e.milestones().length,20,'mainline contains mineral and story chapters before the castle');
assert.equal(e.milestone().id,'coal','iron mine no longer jumps straight to castle');
assert.equal(e.trainReady(),false);
assert.equal(e.claimMilestone('coal'),false,'a visited but unreturned mine cannot pay');
for(const [id,building] of [['coal','coal mine'],['steel','steelworks']]) {
  sm.set('game.buildings["'+building+'"]',1);
  assert.equal(e.claimMilestone(id),true);
}
sm.set('game.world.map',[['M']]);
assert.equal(e.milestone().ready,false,'entering spider mountain is not completing it');
c.World={state:{map:[['M!']]}};
assert.equal(e.trainReady(),false,'temporary expedition completion cannot unlock train');
sm.set('game.world.map',[['M!']]);
assert.equal(e.trainReady(),true,'a safely returned old spider mountain completion is recognized');
assert.equal(e.claimMilestone('natagumo'),true);
assert.equal(e.milestone().id,'train');
c.World.state.mugentrain=true;
assert.equal(e.claimMilestone('train'),false,'temporary train win cannot pay before safe return');
sm.set('game.world.mugentrain',true);
assert.equal(e.claimMilestone('train'),true);
const trainRewarded=JSON.stringify(state);
assert.equal(e.claimMilestone('train'),false);
assert.equal(JSON.stringify(state),trainRewarded,'train reward cannot be reclaimed after reload');
for(const [id,building] of [['sulphur','sulphur mine'],['armoury','armoury']]) {
  sm.set('game.buildings["'+building+'"]',1);
  assert.equal(e.claimMilestone(id),true);
}
sm.set('features.location.fabricator',true);assert.equal(e.claimMilestone('wreck'),true);
assert.equal(e.storyPrerequisite('district'),true);
assert.equal(e.storyPrerequisite('smiths'),false);
assert.equal(e.storyPrerequisite('pillars'),false);
for(const [id,flag] of [['district','yoshiwaraDone'],['smiths','swordsmithVillageDone'],['pillars','pillarConvocationDone']]) {
  assert.equal(e.claimMilestone(id),false);
  sm.set('game.'+flag,true);
  assert.equal(e.claimMilestone(id),true);
}
sm.set('features.location.spaceShip',true);assert.equal(e.claimMilestone('castle'),true);
assert.equal(e.milestone(),null,'completed campaign does not remain on screen');
sm.set('game.world.mugentrain',false);sm.set('game.yoshiwaraDone',false);sm.set('game.swordsmithVillageDone',false);
for(const id of ['district','smiths','pillars']) assert.equal(e.storyPrerequisite(id),true,'old castle saves retain event availability');
sm.set('game.buildings.hut',0);assert.equal(c.Room.Craftables.hut.cost().wood,80);
sm.set('game.buildings.hut',1);assert.equal(c.Room.Craftables.hut.cost().wood,150,'only first shelter discounted');
assert.equal(c.Room.Craftables.lodge.cost().wood,160);
assert.equal(c.Room.Craftables['trading post'].cost().wood,320);
assert.equal(c.Room.Craftables.smokehouse.cost().wood,480);
assert.equal(c.Room.Craftables.workshop.cost().wood,640);
// Active recovery retains warmth, forest access and story stages; natural timers cannot repeat it.
for (const key of Object.keys(state)) delete state[key];
c.Engine.activeModule=c.Room;
c.Room.updateIncomeView=c.Room.updateBuildButtons=()=>{};
assert.equal(e.warmDelay(30000),30000,'no shortcut during prologue');
sm.set('game.prologue.done',true);sm.set('game.builder.level',1);
assert.equal(e.milestone(),null,'construction quests do not distract from rescuing the guest');
assert.equal(e.warmDelay(30000),15000);
sm.set('game.fire.value',3);sm.set('game.temperature.value',0);
c.Room.adjustTemp();assert.equal(delay,15000,'real temperature loop uses introductory timing');
assert.equal(sm.get('game.temperature.value'),1,'warming still advances one temperature stage');
assert.equal(e.warmDelay(5000),5000,'debug timing preserved');
sm.set('stores.wood',5);sm.set('game.temperature.value',3);
assert.equal(e.tendGuest(),false,'forest access still required');
sm.set('features.location.outside',true);sm.set('game.temperature.value',2);
assert.equal(e.tendGuest(),false,'warmth still required');
sm.set('game.temperature.value',3);sm.set('stores.wood',0);
assert.equal(e.tendGuest(),false,'care cannot spend missing wood');
sm.set('stores.wood',5);c.Engine.activeModule=c.Outside;
assert.equal(e.tendGuest(),false,'stale hidden room buttons cannot tend guest');
c.Engine.activeModule=c.Room;c.Events={activeEvent:()=>({})};
assert.equal(e.tendGuest(),false,'events cannot be bypassed');
c.Events.activeEvent=()=>null;
assert.equal(e.tendGuest(),true);assert.equal(sm.get('game.builder.level'),2);
assert.equal(sm.get('stores.wood'),4);
assert.equal(e.tendGuest(),true);assert.equal(sm.get('game.builder.level'),4);
assert.equal(sm.get('stores.wood'),3);
assert.equal(sm.get('income.builder.stores.wood'),2);
assert.equal(e.warmDelay(30000),30000,'normal warmth timing resumes after opening');
const helped=JSON.stringify(state);
c.Room.updateBuilderState();c.Room.welcomeBuilder();assert.equal(e.tendGuest(),false);
assert.equal(JSON.stringify(state),helped,'pending natural recovery cannot duplicate helper income or costs');
// First catch floors are not multipliers, apply once, and survive reload.
sm.set('game.buildings.trap',1);
c.Outside.checkTraps();
assert.equal(sm.get('stores.fur'),3);assert.equal(sm.get('stores.meat'),2);
assert.equal(sm.get('game.firstTrapCatch'),true);
assert.equal(sm.get('game.trapCount'),1);
sm.set('game.firstTrapCatch',JSON.parse(JSON.stringify(sm.get('game.firstTrapCatch'))));
c.Outside.checkTraps();
assert.equal(sm.get('stores.fur'),3,'later unlucky checks are not granted opening rewards');
assert.equal(sm.get('stores.meat'),2);
sm.set('game.firstTrapCatch',false);assert.equal(e.firstCatchPending(),false,'old trap history prevents retroactive bonus');
sm.set('game.trapCount',0);sm.set('features.location.path',true);
assert.equal(e.firstCatchPending(),false,'advanced saves never receive introductory catch');
sm.set('features.location.path',false);sm.set('game.buildings.trap',0);
c.Outside.checkTraps();assert.equal(sm.get('game.trapCount'),0,'missing traps cannot trigger a catch');
// One meaningful but non-permanent supply choice; no construction, population or map mutation.
assert.equal(e.chooseSupply('journey'),false,'lodge must be earned first');
sm.set('game.buildings.lodge',1);
assert.equal(e.chooseSupply('invalid'),false);
c.Events.activeEvent=()=>({});assert.equal(e.chooseSupply('journey'),false);
c.Events.activeEvent=()=>null;
for (const choice of e.supplyChoices()) {
  sm.set('game.openingSupplyChoice',false);
  const stores=JSON.parse(JSON.stringify(sm.get('stores')));
  const buildings=JSON.stringify(sm.get('game.buildings'));
  assert.equal(e.chooseSupply(choice.id),true);
  assert.equal(sm.get('game.openingSupplyChoice'),choice.id);
  for (const item of Object.keys(choice.reward)) assert.equal(sm.get('stores["'+item+'"]'),(stores[item]||0)+choice.reward[item]);
  assert.equal(JSON.stringify(sm.get('game.buildings')),buildings);
  assert.equal(sm.get('features.location.path'),false);
  sm.set('game.openingSupplyChoice',JSON.parse(JSON.stringify(sm.get('game.openingSupplyChoice'))));
  const granted=JSON.stringify(state);
  assert.equal(e.chooseSupply('journey'),false);assert.equal(e.chooseSupply('estate'),false);
  assert.equal(JSON.stringify(state),granted,'reloaded or stale choices cannot grant either reward again');
}
sm.set('game.openingSupplyChoice',false);sm.set('stores.compass',1);
assert.equal(e.supplyPending(),false,'already purchased compass ends the opening choice');
sm.set('stores.compass',0);sm.set('features.location.path',true);
assert.equal(e.supplyPending(),false);
// Introductory hunter allocation uses spare gatherers only and reserves one for wood.
sm.set('features.location.path',false);
sm.set('game.population',2);sm.set('game.workers',{hunter:0});
c.Engine.activeModule=c.Outside;
assert.equal(e.openingHunterPlan().amount,1);
assert.equal(e.openingHunterPlan().furPerMinute,3);
const hunterStores=JSON.stringify(sm.get('stores'));
assert.equal(e.assignOpeningHunters(),true);
assert.equal(sm.get('game.workers.hunter'),1);
assert.equal(c.Outside.getNumGatherers(),1);
assert.equal(JSON.stringify(sm.get('stores')),hunterStores,'job allocation grants no instant resources');
assert.equal(e.assignOpeningHunters(),false,'existing hunter allocation is not overwritten');
sm.set('game.population',8);sm.set('game.workers',{hunter:0,tanner:3,charcutier:1});
assert.equal(e.openingHunterPlan().amount,2);
assert.equal(e.assignOpeningHunters(),true);
assert.equal(sm.get('game.workers.tanner'),3);assert.equal(sm.get('game.workers.charcutier'),1);
assert.equal(c.Outside.getNumGatherers(),2);
sm.set('game.population',5);sm.set('game.workers',{tanner:4});
assert.equal(e.openingHunterPlan().amount,0);
assert.equal(e.assignOpeningHunters(),false,'last gatherer remains available for construction');
sm.set('game.population',9);c.Events.activeEvent=()=>({});
assert.equal(e.assignOpeningHunters(),false,'events cannot be bypassed by stale allocation controls');
c.Events.activeEvent=()=>null;
sm.set('game.workers.tanner',-1);assert.equal(e.openingHunterPlan(),null,'malformed allocation is not silently redistributed');
sm.set('game.workers',{});sm.set('features.location.path',true);
assert.equal(e.assignOpeningHunters(),false,'advanced games use the existing manual worker controls');
console.log('PASS: opening guidance, campaign rewards, active guest care, one-time first catch and supply choices, legacy saves, reload safety and unchanged later progression.');
