const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let saves = [], published = [], onPublish = null;
const c = {State:{},_:s=>s,Notifications:{notify(){}},Engine:{log(){},saveGame(){saves.push(JSON.stringify(c.State));}},
  $:{Dispatch:()=>({publish(){published.push(JSON.stringify(c.State));if(onPublish)onPublish();}})}};
c.window=c;vm.createContext(c);
for (const file of ['state_manager.js','prestige.js','achievements.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
c.$SM=c.StateManager;
const A=c.Achievements,P=c.Prestige;
const plain=value=>JSON.parse(JSON.stringify(value));
function reset(state={}) {c.State=state;saves=[];published=[];onPublish=null;}
// Previously the flag and rewards saved before the no-event bonus write.
const achievement={id:'testAtomic',title:'test',reward:{wood:5},bonuses:{woodGather:0.05}};
A._byId={testAtomic:achievement};
reset({stores:{wood:10}});onPublish=()=>A.unlock('testAtomic');A.unlock('testAtomic');
assert.equal(saves.length,1);assert.equal(c.State.stores.wood,15);
assert.equal(c.State.previous.legacy.bonuses.woodGather,0.05);
for(const snapshot of saves.concat(published)) {
  const state=JSON.parse(snapshot);assert.equal(state.achievements.testAtomic,true);
  assert.equal(state.stores.wood,15);assert.equal(state.previous.legacy.bonuses.woodGather,0.05);
}
c.State=JSON.parse(saves[0]);A.unlock('testAtomic');assert.equal(saves.length,1,'reload never repeats rewards');
for(const entry of [{id:'flagOnly',title:'flag'},{id:'bonusOnly',title:'bonus',bonuses:{fistDmg:1}}]) {
  reset();A._byId[entry.id]=entry;A.unlock(entry.id);assert.equal(saves.length,1);
  assert.equal(JSON.parse(saves[0]).achievements[entry.id],true);
}
// Collecting a parcel used to save its contents while retaining the unclaimed parcel.
reset({stores:{wood:7},previous:{stores:[20,4]}});onPublish=()=>assert.equal(P.collectStores(),false);
assert.equal(P.collectStores(),true);assert.equal(saves.length,1);
assert.equal(c.State.stores.wood,27);assert.equal(c.State.stores.fur,4);
assert.deepEqual(plain(c.State.previous.stores),[]);
for(const snapshot of saves.concat(published)) assert.deepEqual(JSON.parse(snapshot).previous.stores,[]);
c.State=JSON.parse(saves[0]);assert.equal(P.collectStores(),false);assert.equal(c.State.stores.wood,27);
reset({previous:{stores:[NaN,-3,Infinity,'50',2.7]}});P.collectStores();
assert.equal(c.State.stores.coal,2);assert.equal(Object.keys(c.State.stores).length,1,'invalid and missing parcel entries do not corrupt stores');
for(const parcel of [undefined,null,{},[], 'bad']) {reset({previous:{stores:parcel}});assert.equal(P.collectStores(),false);assert.equal(saves.length,0);}
// All milestone flags, resources and perks must survive the first save together.
reset({previous:{legacy:{kills:500}},character:{perks:{'breath no food':true}}});
onPublish=()=>P.applyLegacy();P.applyLegacy();assert.equal(saves.length,1);
for(const snapshot of saves.concat(published)) {
  const state=JSON.parse(snapshot);assert.equal(state.stores.wood,50);assert.equal(state.stores['cured meat'],20);
  assert.equal(state.stores['wisteria charm'],7);assert.equal(state.stores.medicine,5);
  for(const tier of P.LegacyTiers) assert.equal(state.previous.legacy.appliedTiers[tier.key],true);
  assert.equal(state.character.perks['kehai dansha'],true);assert.equal(state.character.perksNew['kehai dansha'],true);
  assert.equal(state.character.perksNew['breath no food'],undefined,'owned perks are not marked new again');
}
c.State=JSON.parse(saves[0]);P.applyLegacy();assert.equal(saves.length,1);
reset({previous:{legacy:{kills:50,appliedTiers:{tier1:true}}},stores:{wood:80}});P.applyLegacy();
assert.equal(c.State.stores.wood,80);assert.equal(c.State.stores['cured meat'],20);
console.log('PASS: achievement flags/rewards/bonuses, inherited parcels and legacy milestones save atomically, reject duplicate/reentrant/reloaded grants and preserve existing progress.');
