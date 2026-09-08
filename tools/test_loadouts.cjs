const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let saves = 0, message = '';
const context = {
  State: {},
  _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
  Engine: { saveGame() { saves++; }, log() {} },
  $: { Dispatch: () => ({ publish() {} }) },
};
vm.createContext(context);
for (const file of ['state_manager.js', 'world.js', 'path.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
}
const P = context.Path, SM = context.$SM = context.StateManager;
P.updateOutfitting = () => {};
P.updateLoadoutPanel = () => {};
P.showLoadoutResult = text => { message = text; };
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
console.log('loadout tests passed: profile persistence, inventory accounting, refill limits, equipment and suggestions');
