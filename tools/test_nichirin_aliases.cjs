const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let saves = 0, publishes = 0;
const c = { State:{}, _:text=>text, Engine:{log(){},saveGame(){saves++;}}, AudioLibrary:{},
  $:()=>({length:0}), Events:{Setpieces:{}} };
c.window=c; c.$.extend=Object.assign; c.$.Dispatch=()=>({publish(){publishes++;}});
vm.createContext(c);
for (const file of ['state_manager.js','world.js','path.js','room.js','fabricator.js','story_crafting.js','nichirin_forge.js','events/executioner.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
vm.runInContext('window.Fabricator=Fabricator;',c);
const SM=c.StateManager, F=c.NichirinForge, flame=F.key('flame',4);
const plain=value=>JSON.parse(JSON.stringify(value));
const snapshot=()=>JSON.stringify(c.State);
const beforeResources={wood:117,steel:81,'demon stone':9,medicine:5};
function fixture(version=1.4) {
  saves=publishes=0;
  c.State={version,stores:{...beforeResources,'flame blade':2,'energy blade':3,[flame]:4},
    outfit:{'flame blade':1,'energy blade':2,[flame]:1},
    character:{equippedInit:true,equipped:{primary:['flame blade',flame],secondary:['wisteria gun',null],tool:['bind kunai',null]},
      weaponHits:{'flame blade':8,'energy blade':7,[flame]:5},blueprints:{'flame blade':false,'energy blade':true,[flame]:false},
      loadouts:{expedition:{version:1,targets:{'flame blade':1,'energy blade':2,[flame]:3,medicine:4},
        equipped:{primary:['energy blade','flame blade'],secondary:['wisteria gun',null],tool:[]}},
        castle:{version:1,targets:{'flame blade':2,[flame]:3},equipped:{primary:['nichirin katana','flame blade']}}}},
    game:{nichirinForge:{attempts:19,lastResults:[{attempt:19,tier:4,key:'flame blade',style:'flame'}]},
      lastExpeditionReport:{version:1,outcome:'return',returned:{'flame blade':2,[flame]:3},gained:{'energy blade':1},reduced:{'flame blade':1}},
      lastCastleReport:{floor:50,consumed:{'flame blade':3,[flame]:1},record:[{item:'flame blade',amount:1}],endingWeapon:'human description untouched'},
      scrapRemainders:{'demon stone':30,steel:20,wood:10},campaignClaims:{smiths:true,pillars:true},pillarConvocationDone:true},
    previous:{stores:{'energy blade':1,'flame blade':2,[flame]:1},embarkSnapshot:{stores:{'flame blade':3,[flame]:2},outfit:{'energy blade':1,[flame]:1}}},
    notes:{title:'flame blade',text:'旧炎之日轮刀是在村子里拿到的。',messages:['flame blade','two old blades'],otherEquipped:{primary:['bone yari','bone yari']}}};
  c.Path.outfit=c.State.outfit;
}
assert.equal(Object.keys(c.World.Weapons).filter(key=>key!=='fists').length,38);
assert.equal(Object.keys(F.items).length,28);
assert.equal(c.World.Weapons[flame].damage,12,'old 10-damage blade is upgraded to the standard purple flame weapon');
assert.equal(c.World.Weapons[flame].tier,4);assert.equal(c.World.Weapons[flame].breathingStyle,'flame');
assert.equal(c.Path.getWeight(flame),5);assert.equal(c.Path.getWeaponCategory(flame),'primary');
assert.deepEqual(plain(c.Path.getScrapCost(flame)),plain(F.COST));
for(const old of ['energy blade','flame blade']) {
  assert.equal(c.World.Weapons[old],undefined);assert.equal(c.Fabricator.Craftables[old],undefined);
  assert.equal(c.Path.carryables()[old],undefined);assert.equal(c.Path.getWeaponCategory(old),null);
  assert.equal(c.StoryCrafting.recipe(old),null);
  assert.equal(SM._RENAME_STORES[old],flame,'runtime legacy-key fallback leads directly to the one real item');
}
assert.equal(c.StoryCrafting.recipe(flame),null,'neither legacy exchange nor home-story crafting bypasses the random forge');
let canonicalDrops=0;
function checkDrops(value) {
  if(!value || typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)) {
    assert.notEqual(key,'flame blade','new loot never creates a duplicate legacy item');
    if(key===flame)canonicalDrops++;
    checkDrops(child);
  }
}
checkDrops(c.Events.Executioner);assert.equal(canonicalDrops,2);

for(const version of [1.3,1.4,2]) {
  fixture(version);const notes=plain(c.State.notes), claims=plain(c.State.game.campaignClaims), ledger=plain(c.State.game.scrapRemainders);
  SM.cleanupRenamedKeys();
  assert.equal(c.State.stores[flame],9);assert.equal(c.State.outfit[flame],4);
  assert.equal(c.Path.outfit[flame],4,'in-place migration preserves a live outfit reference');
  for(const old of ['energy blade','flame blade']) {assert.equal(c.State.stores[old],undefined);assert.equal(c.State.outfit[old],undefined);}
  assert.deepEqual(plain(c.State.character.equipped.primary),[flame,null],'merged aliases occupy one equipment slot');
  assert.deepEqual(plain(c.State.character.loadouts.expedition.equipped.primary),[flame,null]);
  assert.deepEqual(plain(c.State.character.loadouts.castle.equipped.primary),['nichirin katana',flame]);
  assert.equal(c.State.character.loadouts.expedition.targets[flame],6);
  assert.equal(c.State.character.loadouts.castle.targets[flame],5);
  assert.equal(c.State.character.weaponHits[flame],20);
  assert.equal(c.State.character.blueprints[flame],true);
  assert.equal(c.State.previous.stores[flame],4);
  assert.equal(c.State.previous.embarkSnapshot.stores[flame],5);assert.equal(c.State.previous.embarkSnapshot.outfit[flame],2);
  assert.equal(c.State.game.lastExpeditionReport.returned[flame],5);assert.equal(c.State.game.lastExpeditionReport.gained[flame],1);
  assert.equal(c.State.game.lastExpeditionReport.reduced[flame],1);
  assert.equal(c.State.game.lastCastleReport.consumed[flame],4);
  assert.equal(c.State.game.lastCastleReport.record[0].item,flame);
  assert.equal(c.State.game.nichirinForge.lastResults[0].key,flame);
  assert.equal(c.State.game.nichirinForge.attempts,19);
  assert.deepEqual(plain(c.State.notes),notes,'human notes and unrelated history are not rewritten');
  assert.deepEqual(plain(c.State.game.campaignClaims),claims);assert.deepEqual(plain(c.State.game.scrapRemainders),ledger);
  assert.equal(c.State.game.pillarConvocationDone,true);
  for(const [key,amount] of Object.entries(beforeResources))assert.equal(c.State.stores[key],amount,'migration never grants forging costs or stage rewards');
  const migrated=snapshot();for(let index=0;index<4;index++)SM.cleanupRenamedKeys();
  assert.equal(snapshot(),migrated,'repeat cleanup never doubles inventory, equipment or historical counts');
  assert.equal(saves,0);assert.equal(publishes,0,'normalization is silent until the surrounding load/save workflow commits');
}

fixture(1.3);c.State.stores['energy blade blueprint']=2;c.State.outfit['flame blade blueprint']=1;
SM.updateOldState();assert.equal(c.State.version,1.4);assert.equal(c.State.stores[flame+' blueprint'],2);
assert.equal(c.State.outfit[flame+' blueprint'],1);assert.equal(c.State.stores[flame],9);
const reloaded=plain(c.State);c.State=reloaded;c.Path.outfit=c.State.outfit;SM.updateOldState();
assert.deepEqual(plain(c.State),reloaded,'loading an upgraded save does not issue any duplicate rewards');

// Half-corrupted or maximum-size collisions must remain recoverable, never silently clamp.
for(const bad of ['3',-1,1.5,null,NaN,Infinity,{saved:3}]) {
  fixture();c.State.stores['energy blade']=bad;c.State.stores['flame blade']=0;c.State.stores[flame]=2;
  SM.cleanupRenamedKeys();assert.equal(c.State.stores[flame],2);
  assert.deepEqual(c.State.stores['energy blade'],bad,'the original malformed payload is preserved rather than discarded');
  const once=snapshot();SM.cleanupRenamedKeys();assert.equal(snapshot(),once);
}
fixture();c.State.stores={'flame blade':SM.MAX_STORE,[flame]:SM.MAX_STORE};
SM.cleanupRenamedKeys();assert.equal(c.State.stores['flame blade'],SM.MAX_STORE);assert.equal(c.State.stores[flame],SM.MAX_STORE);
assert.equal(c.State.stores['flame blade']+c.State.stores[flame],2*SM.MAX_STORE,'overflow cannot delete a legacy copy or wrap the total');
const overflow=snapshot();SM.cleanupRenamedKeys();assert.equal(snapshot(),overflow);

console.log('PASS: one canonical purple flame blade, 38 real weapons, 28 forge variants, all inventory/loadout/history aliases, slot-only deduplication, preserved notes and progress, no duplicated rewards, reload idempotence and lossless malformed/overflow handling.');
