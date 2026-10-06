const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Real inventory, recipes, weapon registry, equipment categories and recycling.
let saves = 0, publishes = [], onPublish = null, checked = true, mounted = true, modal = false;
const ui = {length:0,find(){return this;},attr(){return '';}};
const c = {
  State:{},_:text=>text,$:value=>value && typeof value.attr==='function' ? value : ui,
  Engine:{options:{testerMode:false},keyLock:false,saveGame(){saves++;},log(){}},
  Space:{},CombatStyles:{getSelected(){return 'water';}},
  Notifications:{notify(){}},AudioEngine:{playSound(){}},AudioLibrary:{CRAFT:'craft'},
  document:{documentElement:{contains(){return mounted;}},querySelector(){return modal ? {} : null;}}
};
c.window=c; c.$.Dispatch=()=>({publish(event){publishes.push(event.category);if(onPublish) onPublish(event);},unsubscribe(){}});
c.$.extend=Object.assign;
c._.addTranslation=values=>{c.labels=values;};
vm.createContext(c);
for (const file of ['state_manager.js','world.js','path.js','room.js','fabricator.js','events.js','story_crafting.js','nichirin_forge.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
vm.runInContext('window.Fabricator=Fabricator;',c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../lang/zh_cn/nichirin_forge.js'),'utf8'),c);
const forge=c.NichirinForge, plain=value=>JSON.parse(JSON.stringify(value));
forge.render=()=>{}; c.Path.updateOutfitting=()=>{};
let rolls=[], randomCalls=0;
vm.runInContext('Math.random=()=>window.nextRandom();',c);
c.nextRandom=()=>{randomCalls++;assert.ok(rolls.length,'unexpected random draw');return rolls.shift();};
function reset(attempts=0,resources={'demon stone':100,steel:2000,wood:10000}) {
  c.State={stores:{...resources},features:{location:{fabricator:true}},game:{nichirinForge:{attempts}},character:{equipped:{primary:['nichirin blade flame',null]}}};
  c.Path.outfit={torch:2}; c.Engine.activeModule=c.Fabricator; c.Engine.keyLock=false;
  c.Events.eventStack=[]; checked=mounted=true; modal=false; forge._busy=false;
  forge._context={node:{},overlay:{remove(){}},accepted:{prop(){return checked;}},closed:false};
  saves=randomCalls=0;publishes=[];onPublish=null;rolls=[];
}
const snapshot=()=>JSON.stringify({state:c.State,outfit:c.Path.outfit});
const perform=count=>forge.forge(count,forge._context);
const key=forge.key('water',4), gold=forge.key('water',5);

assert.equal(Object.keys(forge.FORMS).length,14);
assert.equal(Object.keys(forge.items).length,28);
for(const style of Object.keys(forge.FORMS)) for(const tier of [4,5]) {
  const item=forge.key(style,tier),weapon=c.World.Weapons[item];
  assert.equal(weapon.damage,tier===5?18:12); assert.equal(weapon.cooldown,2);
  assert.equal(weapon.breathingStyle,style); assert.equal(weapon.type,'melee');
  assert.equal(c.Path.getWeaponTier(item),tier); assert.equal(c.Path.getWeaponCategory(item),'primary');
  assert.equal(c.Path.getWeight(item),5); assert.ok(c.Path.carryables()[item]);
  assert.equal(c.Room.MiscItems[item].type,'weapon'); assert.match(c.Room.StoreDescriptions[item],/不解锁/);
  assert.equal(c.labels[item],(tier===5?'极日轮刀':'日轮刀')+'【'+forge.FORMS[style]+'】');
  assert.deepEqual(plain(c.Path.getScrapCost(item)),plain(forge.COST));
}
const primarySize=c.Path.WeaponCategory.primary.length;
forge.register(); assert.equal(c.Path.WeaponCategory.primary.length,primarySize,'registration is idempotent');
for(const [value,tier] of [[0,0],[.199999,0],[.2,4],[.949999,4],[.95,5],[.999999,5]]) {
  const values=[value,.999999];
  const result=forge.roll(1,()=>values.shift());
  assert.equal(result.tier,tier);
  if(tier) assert.equal(result.style,'moon','last uniform form remains reachable');
}
for(const value of [NaN,Infinity,-.1,1]) assert.equal(forge.roll(1,()=>value),null);
let guaranteedCalls=0;
assert.equal(forge.roll(10,()=>{guaranteedCalls++;return 0;}).tier,5);
assert.equal(guaranteedCalls,1,'guarantee only rolls the breathing affiliation');

reset(); rolls=[.1]; let before=snapshot();
assert.equal(forge.preview(1).ready,true); assert.equal(snapshot(),before); assert.equal(randomCalls,0);
assert.equal(perform(1),true);
assert.deepEqual(plain(c.State.stores),{'demon stone':99,steel:1980,wood:9900});
assert.equal(forge.attempts(),1); assert.equal(saves,1); assert.deepEqual(publishes,['stores']);
assert.equal(c.State.game.nichirinForge.lastResults[0].tier,0,'failure produces nothing and has no refund');
assert.deepEqual(plain(c.Path.outfit),{torch:2});
assert.deepEqual(plain(c.State.character.equipped.primary),['nichirin blade flame',null],'forging never auto-equips');

reset(); rolls=[.95,0]; assert.equal(perform(1),true); assert.equal(c.State.stores[gold],1);
assert.equal(forge.attempts(),1,'natural gold never resets the fixed-ten counter');
rolls=Array(8).fill(.01);for(let i=0;i<8;i++) assert.equal(perform(1),true);
const persisted=JSON.parse(JSON.stringify(c.State)); c.State=persisted;
rolls=[0]; assert.equal(perform(1),true); assert.equal(forge.attempts(),10);
assert.equal(c.State.stores[gold],2); assert.equal(c.State.game.nichirinForge.lastResults[0].guaranteed,true);
assert.equal(c.State.stores['demon stone'],90);

reset(7); rolls=[.01,.4,0,0,...Array(7).fill(.01)];
assert.equal(perform(10),true); assert.equal(forge.attempts(),17);
assert.equal(c.State.stores[key],1);assert.equal(c.State.stores[gold],1);
assert.equal(c.State.game.nichirinForge.lastResults.length,10);
assert.equal(c.State.game.nichirinForge.lastResults[2].guaranteed,true,'crossing ten inside a batch gives the gold at exactly the tenth');
assert.equal(saves,1);assert.equal(randomCalls,11);

for(const count of [0,2,1.5,-1,NaN,Infinity,'1']) {
  reset();before=snapshot();assert.equal(perform(count),false);assert.equal(snapshot(),before);assert.equal(randomCalls,0);
}
for(const material of Object.keys(forge.COST)) {
  reset();c.State.stores[material]=forge.COST[material]*10-1;
  before=snapshot();assert.equal(perform(10),false);assert.equal(snapshot(),before);assert.equal(randomCalls,0);
}
for(const value of [NaN,Infinity,-1,'2000',null]) {
  reset();c.State.stores.steel=value;before=snapshot();
  assert.equal(perform(1),false);assert.equal(snapshot(),before);assert.equal(randomCalls,0);
}
for(const value of [NaN,Infinity,-1,1.5,'1',null,c.StateManager.MAX_STORE]) {
  reset();c.State.stores[key]=value;before=snapshot();assert.equal(perform(1),false);assert.equal(snapshot(),before);
}
reset(c.StateManager.MAX_STORE); before=snapshot(); assert.equal(perform(1),false); assert.equal(snapshot(),before);
assert.equal(randomCalls,0,'state-manager counter cap cannot recycle a tenth guarantee');
reset();rolls=[.4,NaN];before=snapshot();assert.equal(perform(1),false);assert.equal(snapshot(),before);
assert.equal(forge._busy,false,'invalid RNG releases the forge lock without paying');

for(const block of ['confirmation','mount','modal','event','keyLock','location','feature','stale','closed']) {
  reset();let context=forge._context;
  if(block==='confirmation') checked=false;
  if(block==='mount') mounted=false;
  if(block==='modal') modal=true;
  if(block==='event') c.Events.eventStack=[{}];
  if(block==='keyLock') c.Engine.keyLock=true;
  if(block==='location') c.Engine.activeModule=c.Path;
  if(block==='feature') c.State.features.location.fabricator=false;
  if(block==='stale') context={...context};
  if(block==='closed') context.closed=true;
  before=snapshot(); assert.equal(forge.forge(1,context),false,block);assert.equal(snapshot(),before);assert.equal(randomCalls,0);
}
reset();const oldContext=forge._context;before=snapshot();
assert.equal(forge.close(false),true);assert.equal(forge._context,null);
assert.equal(oldContext.closed,true);assert.equal(forge.forge(1,oldContext),false);
assert.equal(snapshot(),before);assert.equal(randomCalls,0,'closing or reusing a closed modal never charges materials');
reset();rolls=[.4,0];onPublish=()=>assert.equal(perform(1),false,'publication cannot reenter forging');
assert.equal(perform(1),true);assert.equal(forge.attempts(),1);assert.equal(c.State.stores[key],1);
assert.equal(forge._busy,false);onPublish=null;
reset();c.Engine.options.testerMode=true;rolls=[.01];perform(1);
assert.equal(c.State.stores.steel,1980,'tester mode does not bypass forge costs');c.Engine.options.testerMode=false;

reset();c.State.stores['flame blade']=2;c.State.stores['nichirin blade flame']=3;
c.StateManager.cleanupRenamedKeys();before=snapshot();
assert.equal(c.State.stores['nichirin blade flame'],5);
assert.equal(c.State.stores['flame blade'],undefined);
assert.equal(c.Fabricator.fabricate({attr(){return 'flame blade';}}),false);
assert.equal(snapshot(),before,'legacy guaranteed exchange is inaccessible while old blades remain intact');
assert.equal(c.StoryCrafting.recipe('flame blade'),null);
assert.equal(c.StoryCrafting.recipe(key),null,'story commission cannot bypass a random forge');
assert.equal(c.Path.carryables()['flame blade'],undefined);assert.equal(c.Path.getScrapCost('flame blade'),null);
assert.ok(c.Path.carryables()['nichirin blade flame']);assert.ok(c.Path.getScrapCost('nichirin blade flame'));
reset();c.Engine.activeModule=c.Space;assert.equal(forge.getDamageMultiplier(key),1.15);assert.equal(forge.getDamageMultiplier(gold),1.25);
assert.equal(forge.getDamageMultiplier(forge.key('flame',5)),1);assert.equal(forge.getDamageMultiplier('nichirin katana'),1);
c.Engine.activeModule=c.World;assert.equal(forge.getDamageMultiplier(gold),1,'matching bonus is castle-only');
reset();c.Engine.activeModule=c.Path;c.State.stores[key]=11;c.Path.outfit[key]=1;
const scrap=c.Path.scrapPreview(key,10);assert.equal(scrap.valid,true);
assert.deepEqual(plain(scrap.refund),{'demon stone':3,steel:60,wood:300});
assert.equal(c.Path.scrapItem(key,11),false,'carried weapons cannot be scrapped');
assert.equal(c.Path.scrapItem(key,10),true);assert.equal(c.State.stores[key],1);
assert.equal(c.State.stores.steel,2060);assert.equal(c.Path.outfit[key],1);
console.log('PASS: 28 forge weapons, exact probability boundaries, fixed-ten guarantees, failure costs, persistence, atomic batches, stale/reentrant guards, damage affinity, legacy blades and recycling');
