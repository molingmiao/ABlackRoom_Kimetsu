const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let saves = 0, message = '';
const context = {
  State: {},
  _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
  Engine: { options:{testerMode:false}, saveGame() { saves++; }, log() {} },
  Events: {activeEvent:()=>null},
  $: { Dispatch: () => ({ publish() {} }) },
};
vm.createContext(context);
context.window=context;
for (const file of ['state_manager.js', 'world.js', 'path.js', 'space.js','camp_guide.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
}
const P = context.Path, SM = context.$SM = context.StateManager;
P.updateOutfitting = () => {};
P.updateLoadoutPanel = () => {};
P.showLoadoutResult = text => { message = text; };
P.updateJourneyGuide=()=>{};
const plain = value => JSON.parse(JSON.stringify(value));
const weight = bag => Object.keys(bag).reduce((sum, key) => sum + bag[key] * P.getWeight(key), 0);
function reset() {
  context.State = { character: {}, stores: {}, outfit: {} };
  P.outfit = context.State.outfit;
  saves = 0;
  message = '';
}
function plan(targets, current, stores, capacity, equipped = {}) {
  return plain(P.planLoadout({ targets, equipped }, current, stores, capacity));
}

reset();
assert.equal(P.getLoadoutId(), 'expedition', 'old saves use the expedition slot without migration');
assert.equal(P.getLoadout('expedition'), null);
P.autoFillSupplies();
assert.match(message, /no saved loadout/);
assert.equal(saves, 0, 'no profile must not clear an old selection or change stores');

let result = plan({ 'cured meat': 10 }, { 'cured meat': 4 }, { 'cured meat': 10 }, 20);
assert.equal(result.outfit['cured meat'], 10, 'stores include the existing four selected items');
assert.equal(result.added, 6);
assert.equal(result.shortages.length, 0);
result = plan({ medicine: 2 }, { medicine: 7, torch: 2 }, { medicine: 7, torch: 3 }, 20);
assert.deepEqual(result.outfit, { medicine: 7, torch: 2 }, 'extra supplies and unlisted items remain');
assert.equal(result.added, 0);

result = plan({ medicine: 10 }, { medicine: 1, torch: 2 }, { medicine: 6, torch: 2 }, 5);
assert.deepEqual(result.outfit, { medicine: 3, torch: 2 });
assert.deepEqual(result.shortages, [{ key: 'medicine', missing: 7, stock: 4, space: 3 }]);
const previewProfile={targets:{medicine:10}}, previewBag={medicine:1,torch:2}, previewStores={medicine:6,torch:2};
const previewBefore=JSON.stringify([previewProfile,previewBag,previewStores]);
const preview=P.loadoutPreview(previewProfile,previewBag,previewStores,5);
assert.equal(preview.added,2);
assert.match(preview.lines.join('\n'), /packed 1\/10; after refill 3/);
assert.match(preview.lines.join('\n'), /stock short by 4/);
assert.match(preview.lines.join('\n'), /bag space short by 3/);
assert.equal(JSON.stringify([previewProfile,previewBag,previewStores]),previewBefore,'preview cannot mutate targets, bag or home stock');
result = plan({ medicine: 1 }, { torch: 8 }, { torch: 8, medicine: 5 }, 5);
assert.deepEqual(result.outfit, { torch: 8 }, 'already-overweight selection is preserved without adding');
assert.equal(result.shortages[0].space, 1);
result = plan({ 'wisteria bullet': 3 }, {}, { 'wisteria bullet': 10 }, 0.3);
assert.equal(result.outfit['wisteria bullet'], 3, 'fractional weights do not lose a slot to float rounding');

result = plan({ torch: 8, medicine: 3, 'cured meat': 3, 'bone yari': 1 }, {},
  { torch: 8, medicine: 3, 'cured meat': 3, 'bone yari': 1 }, 8, { primary: ['bone yari'] });
assert.deepEqual(result.outfit, { 'bone yari': 1, 'cured meat': 3, medicine: 3 }, 'saved weapon and healing precede filler');
result = plan({ medicine: 4 }, { medicine: 99, torch: NaN }, { medicine: 2, torch: 1 }, 10);
assert.deepEqual(result.outfit, { medicine: 2 }, 'stale selections cannot create inventory');
assert.ok(result.adjusted.includes('medicine'));
result = plan({ medicine: Infinity, torch: -2 }, {}, { medicine: 10, torch: 5 }, 10);
assert.deepEqual(result.outfit, {}, 'malformed saved targets are ignored');

reset();
SM.set('stores', { 'bone yari': 1, 'flame blade': 1, 'cured meat': 30, medicine: 10, wagon: 1 }, true);
SM.set('character.equipped', { primary: ['bone yari', null], secondary: [], tool: [] }, true);
P.outfit = { 'cured meat': 6, medicine: 2 };
P.saveLoadout();
assert.equal(P.getLoadout('expedition').targets['bone yari'], 1, 'saving includes equipped-but-not-yet-packed weapons');
assert.equal(P.getLoadout('expedition').targets['cured meat'], 6);
P.outfit['cured meat'] = 1;
SM.set('character.equipped.primary', ['flame blade', null], true);
const beforeStores = plain(context.State.stores);
P.autoFillSupplies();
assert.deepEqual(plain(context.State.stores), beforeStores, 'refill selects but does not withdraw home inventory');
assert.equal(SM.get('character.equipped.primary')[0], 'flame blade', 'refill never reselects strongest weapons');
assert.equal(P.outfit['cured meat'], 6);
const firstFill = plain(P.outfit);
P.autoFillSupplies();
assert.deepEqual(plain(P.outfit), firstFill, 'repeating refill is idempotent');
P.applyLoadoutEquipment();
assert.equal(SM.get('character.equipped.primary')[0], 'bone yari', 'only the explicit equipment action changes slots');
SM.set('character.selectedLoadout', 'castle', true);
P.outfit = { medicine: 7 };
P.saveLoadout();
assert.equal(P.getLoadout('castle').targets.medicine, 7);
assert.equal(P.getLoadout('expedition').targets.medicine, 2, 'the named profiles are independent');
context.State = plain(context.State); // Simulate JSON save/reload.
assert.equal(P.getLoadout('castle').targets.medicine, 7);
SM.set('stores["bone yari"]', 0, true);
P.applyLoadoutEquipment();
assert.equal(SM.get('character.equipped.primary')[0], null, 'missing saved weapons cannot be equipped');
assert.match(message, /unavailable weapons/);
assert.ok(saves > 0, 'profiles and selection use normal persistent StateManager writes');

reset();
SM.set('stores', { 'bone yari': 1, 'wisteria gun': 1, 'cured meat': 30, medicine: 20, torch: 10, wagon: 1 }, true);
SM.set('character.equipped', { primary: ['bone yari'], secondary: ['wisteria gun'], tool: [] }, true);
P.createSuggestedLoadout();
const suggested = P.getLoadout('expedition');
assert.ok(suggested.targets['cured meat'] > 0);
assert.ok(suggested.targets.medicine > 0);
assert.equal(suggested.targets['wisteria bullet'], 10, 'suggested ammunition matches selected weapon');
assert.equal(suggested.targets['solar crystal'], undefined, 'unmatched ammunition is not packed');
assert.ok(weight(suggested.targets) <= P.getCapacity() + 0.000001);
assert.equal(suggested.targets['flame blade'], undefined, 'suggestions do not replace selected weapons');

// Deterministic boundary coverage across inventories, target amounts and small bags.
const keys = ['cured meat', 'medicine', 'wisteria bullet', 'solar crystal', 'bone yari'];
for (let seed = 0; seed < 120; seed++) {
  const stores = {}, current = {}, targets = {};
  keys.forEach((key, i) => {
    stores[key] = (seed * (i + 3) + 7) % 17;
    current[key] = (seed + i * 3) % (stores[key] + 1);
    targets[key] = (seed + i * 7) % 20;
  });
  const capacity = weight(current) + (seed % 13) / 10;
  const outcome = plan(targets, current, stores, capacity);
  assert.ok(weight(outcome.outfit) <= capacity + 0.000001);
  for (const key of keys) {
    assert.ok((outcome.outfit[key] || 0) >= current[key]);
    assert.ok((outcome.outfit[key] || 0) <= stores[key]);
  }
}
const battleProfile={targets:{medicine:3,'cured meat':5}}, battleBag={medicine:1,torch:2}, battleLoot={medicine:4,scales:10};
const originalBattle=JSON.stringify([battleProfile,battleBag,battleLoot]);
let pickup=plain(context.Space.planBattlePickup(battleProfile,battleBag,battleLoot,20));
assert.equal(pickup.outfit.medicine,3,'only refill to saved targets');
assert.equal(pickup.outfit.torch,2,'preserve extra carried supplies');
assert.equal(pickup.outfit.scales,undefined,'untargeted materials go home');
assert.equal(pickup.outfit['cured meat'],undefined,'home stock cannot fill missing battle loot');
assert.equal(JSON.stringify([battleProfile,battleBag,battleLoot]),originalBattle);
pickup=plain(context.Space.planBattlePickup(battleProfile,battleBag,battleLoot,3));
assert.equal(pickup.added,0,'full bags pick up nothing');
pickup=plain(context.Space.planBattlePickup(battleProfile,{medicine:6},battleLoot,20));
assert.equal(pickup.outfit.medicine,6,'never discard extras to meet a lower target');
assert.equal(context.Space.planBattlePickup(battleProfile,battleBag,{},20).added,0);
// Beginner setup uses the same planner and never charges stores or replaces custom presets.
reset();
SM.set('features.location.path',true,true);
SM.set('stores',{'bone yari':1,'cured meat':12,torch:2},true);
SM.set('character.equipped',{primary:['bone yari'],secondary:[],tool:[]},true);
P.outfit={torch:2};
context.Engine.activeModule=P;
const beginnerStores=plain(context.State.stores), beginnerGear=plain(context.State.character.equipped);
const checklistBefore=JSON.stringify(context.State);
assert.match(P.journeyChecklist().join('\n'),/口粮待备/);
assert.equal(JSON.stringify(context.State),checklistBefore,'checklist is read-only');
assert.equal(P.prepareJourney(),true);
assert.equal(P.outfit['bone yari'],1);assert.equal(P.outfit['cured meat'],5);assert.equal(P.outfit.torch,2);
assert.deepEqual(plain(context.State.stores),beginnerStores,'selection is only charged by actual departure');
assert.deepEqual(plain(context.State.character.equipped),beginnerGear,'selected equipment is retained');
assert.ok(weight(P.outfit)<=P.getCapacity());
assert.match(P.journeyChecklist().join('\n'),/口粮已备/);
assert.match(P.journeyChecklist().join('\n'),/可用上阵武器/);
const firstPreset=plain(P.getLoadout('expedition')), firstBag=plain(P.outfit);
assert.equal(P.prepareJourney(),true);
assert.deepEqual(plain(P.outfit),firstBag,'beginner refill is idempotent');
assert.deepEqual(plain(P.getLoadout('expedition')),firstPreset);
SM.set('character.loadouts.expedition',{version:1,targets:{'cured meat':2,torch:1},equipped:{}},true);
SM.set('character.loadouts.castle',{version:1,targets:{medicine:7}},true);
SM.set('character.selectedLoadout','castle',true);
P.outfit={'cured meat':1,torch:2};
const customPresets=plain(context.State.character.loadouts);
assert.equal(P.prepareJourney(),true);
assert.equal(P.outfit['cured meat'],2);assert.equal(P.outfit.torch,2,'extra selections are not discarded');
assert.equal(SM.get('character.selectedLoadout'),'expedition');
assert.deepEqual(plain(context.State.character.loadouts),customPresets,'both existing presets preserved');
context.Events.activeEvent=()=>({});
const blocked=JSON.stringify(context.State);assert.equal(P.prepareJourney(),false);assert.equal(JSON.stringify(context.State),blocked);
context.Events.activeEvent=()=>null;context.Engine.activeModule=context.Space;
assert.equal(P.prepareJourney(),false,'hidden path action cannot refill an active castle bag');
context.Engine.activeModule=P;
for (const [key,value] of [['game.embarks',3],['game.maxDistance',8],['features.location.spaceShip',true],['game.buildings["iron mine"]',1]]) {
  SM.set(key,value,true);assert.equal(P.journeyGuideVisible(),false);assert.equal(P.prepareJourney(),false);
  SM.set(key,0,true);
}
reset();SM.set('features.location.path',true,true);context.Engine.activeModule=P;
SM.set('stores',{'wisteria gun':1,'wisteria bullet':2,'cured meat':3},true);
SM.set('character.equipped',{secondary:['wisteria gun']},true);
assert.equal(P.prepareJourney(),true);
assert.equal(P.outfit['wisteria bullet'],2,'ammo cannot be created from missing stock');
assert.ok(weight(P.outfit)<=10);
assert.match(message,/stock short/);
assert.equal(SM.get('character.loadouts.expedition.targets["wisteria bullet"]'),5,'preset records five ammunition uses');
reset();SM.set('features.location.path',true,true);context.Engine.activeModule=P;
SM.set('stores',{torch:10,'cured meat':6},true);P.outfit={torch:10};
assert.equal(P.prepareJourney(),true);
assert.equal(P.outfit['cured meat'],undefined,'full bag is not silently cleared to fit tutorial supplies');
assert.match(message,/space short/);
P.outfit=undefined;
assert.doesNotThrow(()=>P.journeyChecklist(),'first unlocked path can have no prior backpack');
assert.match(P.journeyChecklist().join('\n'),/口粮待备/);
SM.set('stores',{},true);SM.set('game.campaignClaims.compass',true,true);
assert.match(P.journeyChecklist().join('\n'),/需要生肉和木材/);
assert.ok(!P.journeyChecklist().join('\n').includes('尚未领取'),'claimed rewards are not recommended as a repeatable food source');
SM.set('stores',{'bone yari':0,'cured meat':6},true);
SM.set('character.equipped',{primary:['bone yari']},true);
P.outfit={'bone yari':1,'cured meat':5};
assert.match(P.journeyChecklist().join('\n'),/出发受阻/);
assert.ok(!P.journeyChecklist().join('\n').includes('可用上阵武器'),'stale unavailable backpack selections are not advertised as ready');
console.log('loadout tests passed: persistent targets, accounting, refill limits, beginner checklist and presets, custom profile preservation and battle-only pickup plans');
