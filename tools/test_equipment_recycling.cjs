const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Use the shipped registries and StateManager. No parallel recycling implementation.
let saves = 0, notifications = 0, redraws = 0, activeEvent = null, onPublish = null;
const publishes = [];
const emptyQuery = { length: 0, find() { return this; }, attr() { return ''; } };
const context = {
  State: {}, $: () => emptyQuery,
  _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]),
  Engine: { saveGame() { saves++; }, log() {}, options: { testerMode: false } },
  AudioLibrary: {}, Notifications: { notify() { notifications++; } },
  document: { documentElement: { contains() { return false; } } }
};
context.window = context;
context.$.extend = Object.assign;
context.$.Dispatch = () => ({ publish(event) { publishes.push(event.category); if (onPublish) onPublish(event); } });
vm.createContext(context);
for (const file of ['state_manager.js', 'world.js', 'path.js', 'room.js', 'fabricator.js', 'nichirin_forge.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
}
vm.runInContext('window.Fabricator = Fabricator;', context);
context.Events = { activeEvent: () => activeEvent };
const P = context.Path, SM = context.StateManager;
P.updateOutfitting = () => { redraws++; };
const plain = value => JSON.parse(JSON.stringify(value));
function reset(stores = {}, outfit = {}, remainders) {
  context.State = { stores: { ...stores }, outfit: { ...outfit }, game: {}, character: {} };
  if (remainders !== undefined) context.State.game.scrapRemainders = { ...remainders };
  P.outfit = context.State.outfit;
  context.Engine.activeModule = P;
  activeEvent = null;
  onPublish = null;
  saves = notifications = redraws = 0;
  publishes.length = 0;
}
const snapshot = () => JSON.stringify(context.State);
const savedRemainders = () => plain(context.State.game.scrapRemainders || {});
function rejected(key, amount) {
  const before = snapshot(), oldSaves = saves;
  assert.equal(P.scrapPreview(key, amount).valid, false, `invalid preview: ${key}/${String(amount)}`);
  assert.equal(P.scrapItem(key, amount), false, `invalid execution: ${key}/${String(amount)}`);
  assert.equal(snapshot(), before, 'a rejected request never consumes stock or changes refund credit');
  assert.equal(saves, oldSaves);
}

// Discover every weapon, including all dynamically registered purple/gold blades.
const weapons = Object.keys(context.World.Weapons).filter(key => key !== 'fists');
assert.equal(weapons.length, 38, 'the legacy flame alias is merged into the 28 breathing-specific blades');
assert.equal(Object.keys(context.NichirinForge.items).length, 28);
for (const key of weapons) {
  assert.ok(P.getWeaponCategory(key), `equipment category covers ${key}`);
  assert.equal(P.carryables()[key]?.type, 'weapon', `packing registry covers ${key}`);
  const source = context.Room.Craftables[key] || context.Room.TradeGoods[key] || context.Fabricator.Craftables[key];
  const expectedCost = context.NichirinForge.items[key] ? context.NichirinForge.COST : source.cost();
  assert.deepEqual(plain(P.getScrapCost(key)), plain(expectedCost), `real recipe covers ${key}`);

  reset({ [key]: 2 }, { [key]: 1 });
  let info = P.scrapPreview(key, 1), before = snapshot();
  assert.equal(info.valid, true, `${key} has a single-item recycling route even below one material`);
  assert.equal(info.available, 1);
  assert.equal(info.carried, 1);
  assert.equal(info.permanent, 0);
  assert.equal(info.equipped, 0);
  assert.equal(snapshot(), before, 'preview is read-only');
  assert.equal(P.scrapItem(key, 1), true, `${key} executes recycling`);
  assert.equal(context.State.stores[key], 1, `${key}: the packed copy is untouched`);
  assert.equal(P.outfit[key], 1);
  for (const [material, amount] of Object.entries(info.refund)) assert.equal(context.State.stores[material], amount);
  for (const [material, amount] of Object.entries(info.remainder)) assert.equal(savedRemainders()[material], amount);
  assert.equal(saves, 1, 'refund credit and inventory save together');
  assert.equal(notifications, 1);
  assert.equal(redraws, 1);
  rejected(key, 1);

  reset({ [key]: 9 }, { [key]: 2 });
  info = P.scrapPreview(key, 7);
  assert.equal(info.available, 7);
  assert.equal(info.valid, true);
  assert.equal(P.scrapItem(key, 7), true, `${key}: batch recycling covers excess copies`);
  assert.equal(context.State.stores[key], 2);
  assert.equal(P.outfit[key], 2);

  reset({ [key]: 3 });
  context.State.character.equipped = { [P.getWeaponCategory(key)]: [key, null] };
  info = P.scrapPreview(key, 2);
  assert.equal(info.carried, 0);
  assert.equal(info.equipped, 1);
  assert.equal(info.available, 2, `${key}: equipment slots protect a copy even if it was not packed`);
  assert.equal(P.scrapItem(key, 2), true);
  assert.equal(context.State.stores[key], 1);
  assert.equal(context.State.character.equipped[P.getWeaponCategory(key)][0], key);
  rejected(key, 1);

  reset({ [key]: 5 }, { [key]: 3 });
  context.State.character.equipped = { [P.getWeaponCategory(key)]: [key, null] };
  assert.equal(P.scrapPreview(key, 2).available, 2, 'equipped and packed protection must overlap');
  assert.equal(P.scrapItem(key, 2), true);
  assert.equal(context.State.stores[key], 3);
}

// Permanent inventory upgrades are equipment too, but their first copy must survive.
const permanentDefinitions = [context.Room.Craftables, context.Fabricator.Craftables]
  .flatMap(list => Object.keys(list).filter(key => list[key].type === 'upgrade'))
  .concat(Object.keys(context.Room.TradeGoods).filter(key => context.Room.TradeGoods[key].type === 'special'));
const registeredPermanent = Array.isArray(P.PERMANENT_EQUIPMENT) ? [...P.PERMANENT_EQUIPMENT] : Object.keys(P.PERMANENT_EQUIPMENT);
assert.deepEqual(registeredPermanent.sort(), permanentDefinitions.sort(), 'every permanent armour, bag, water upgrade and compass is protected and recyclable');
assert.equal(registeredPermanent.length, 13);
for (const key of registeredPermanent) {
  reset({ [key]: 1 });
  assert.equal(P.scrapPreview(key, 1).permanent, 1, `${key}: the retained permanent copy is explicit`);
  assert.equal(P.scrapPreview(key, 1).available, 0);
  rejected(key, 1);

  reset({ [key]: 4 });
  let info = P.scrapPreview(key, 3);
  assert.equal(info.available, 3);
  assert.equal(info.carried, 0);
  assert.equal(info.permanent, 1);
  assert.equal(info.valid, true, `${key}: duplicate permanent equipment can be recycled`);
  assert.equal(P.scrapItem(key, 3), true);
  assert.equal(context.State.stores[key], 1, `${key}: never remove its lasting benefit`);
  rejected(key, 1);

  reset({ [key]: 5 }, { [key]: 3 });
  info = P.scrapPreview(key, 2);
  assert.equal(info.available, 2, 'packed and permanent protection overlap; do not subtract the retained copy twice');
  assert.equal(info.carried, 3);
  assert.equal(info.permanent, 1);
  assert.equal(info.valid, true);
  assert.equal(P.scrapItem(key, 2), true);
  assert.equal(context.State.stores[key], 3);
  assert.equal(P.outfit[key], 3);
}

// Only genuine portable items and permanent equipment participate; buildings/materials do not.
for (const key of ['trap', 'hut', 'cart', 'workshop', 'iron', 'steel', 'scales', 'teeth']) {
  assert.equal(P.getScrapCost(key), null, `${key}: buildings and raw materials are not equipment recipes`);
  reset({ [key]: 5 });
  rejected(key, 1);
}

// Cheap forged gear must not vanish from the recycling UI or lose fractional value.
for (const key of ['bind kunai', 'thunder gun']) {
  reset({ [key]: 4 });
  for (let index = 1; index <= 4; index++) {
    const info = P.scrapPreview(key, 1);
    assert.equal(info.valid, true);
    assert.equal(info.refund['demon stone'] || 0, index === 4 ? 1 : 0);
    assert.equal(info.remainder['demon stone'], (index * 30) % 100);
    assert.equal(P.scrapItem(key, 1), true);
    assert.equal(context.State.stores['demon stone'] || 0, index === 4 ? 1 : 0);
  }
  assert.equal(context.State.stores[key], 0);
  assert.equal(savedRemainders()['demon stone'], 20);
}

reset({ 'bind kunai': 1, 'thunder gun': 3 });
for (const key of ['bind kunai', 'thunder gun', 'thunder gun', 'thunder gun']) assert.equal(P.scrapItem(key, 1), true);
assert.equal(context.State.stores['demon stone'], 1, 'credit is shared by material, not stranded on an item or rarity');
assert.equal(savedRemainders()['demon stone'], 20);

// Five oil bottles cost one stone: never price every bottle as a full craft batch.
assert.equal(P.getScrapCost('wisteria oil')['demon stone'], 0.2);
reset({ 'wisteria oil': 5 });
let info = P.scrapPreview('wisteria oil', 5);
assert.equal(info.valid, true);
assert.equal(info.refund['demon stone'] || 0, 0);
assert.equal(info.remainder['demon stone'], 30);
assert.equal(P.scrapItem('wisteria oil', 5), true);
assert.equal(context.State.stores['demon stone'] || 0, 0);
assert.equal(savedRemainders()['demon stone'], 30);
reset({ 'wisteria oil': 20 });
assert.equal(P.scrapItem('wisteria oil', 20), true);
assert.equal(context.State.stores['demon stone'], 1);
assert.equal(savedRemainders()['demon stone'], 20, 'twenty bottles return 30% of four crafts, not six stones');

// Splitting up a batch, switching weapons, or refreshing cannot destroy/duplicate credit.
for (const key of [...weapons, ...registeredPermanent, 'torch', 'wisteria oil', 'concentration pill', 'firefly orb']) {
  const retained = registeredPermanent.includes(key) ? 1 : 0;
  reset({ [key]: 17 + retained }, {}, { 'demon stone': 17, teeth: 11, wood: 9, cloth: 31 });
  assert.equal(P.scrapItem(key, 17), true);
  const batch = plain(context.State.stores), batchRemainders = savedRemainders();
  reset({ [key]: 17 + retained }, {}, { 'demon stone': 17, teeth: 11, wood: 9, cloth: 31 });
  for (let count = 0; count < 17; count++) {
    assert.equal(P.scrapItem(key, 1), true);
    if (count === 5) {
      context.State = plain(context.State);
      P.outfit = context.State.outfit;
    }
  }
  assert.deepEqual(plain(context.State.stores), batch, `${key}: total material return is independent of batch size`);
  assert.deepEqual(savedRemainders(), batchRemainders, `${key}: fractional value survives a save reload`);
}

// Every guard runs before payment, including integer quantities and warehouse overflow.
reset({ 'bone yari': 5 }, { 'bone yari': 2 });
for (const amount of ['', ' ', '1.5', '3.0', 'NaN', NaN, Infinity, -1, 0, '4', 4, null, false, {}, '1e2', Number.MAX_SAFE_INTEGER]) {
  rejected('bone yari', amount);
}
assert.equal(P.scrapPreview('bone yari', ' 3 ').valid, true);
reset({ 'bone yari': 1, wood: SM.MAX_STORE });
rejected('bone yari', 1);
reset({ 'bone yari': 1, wood: SM.MAX_STORE - 29 });
rejected('bone yari', 1);
reset({ 'bone yari': 1, wood: SM.MAX_STORE - 30 });
assert.equal(P.scrapItem('bone yari', 1), true);
assert.equal(context.State.stores.wood, SM.MAX_STORE);
reset({ 'thunder gun': 1, 'demon stone': SM.MAX_STORE }, {}, { 'demon stone': 99 });
rejected('thunder gun', 1);
reset({ 'thunder gun': 1, 'demon stone': SM.MAX_STORE }, {}, { 'demon stone': 0 });
assert.equal(P.scrapItem('thunder gun', 1), true, 'a pure fractional-credit update does not overflow an already full material stock');
assert.equal(savedRemainders()['demon stone'], 30);
for (const badStock of [-1, NaN, Infinity, '20', SM.MAX_STORE + 1]) {
  reset({ 'bone yari': 1, wood: badStock });
  rejected('bone yari', 1);
}
for (const badRemainder of [-1, 100, 1.5, NaN, Infinity, '30']) {
  reset({ 'thunder gun': 1 }, {}, { 'demon stone': badRemainder });
  rejected('thunder gun', 1);
}
reset({ 'bone yari': 1 });
for (const key of ['fists', 'unknown equipment']) rejected(key, 1);
const inactiveSnapshot = snapshot();
context.Engine.activeModule = context.Room;
assert.equal(P.scrapItem('bone yari', 1), false);
context.Engine.activeModule = P; activeEvent = {};
assert.equal(P.scrapItem('bone yari', 1), false);
assert.equal(snapshot(), inactiveSnapshot);
assert.equal(saves, 0);

reset({ 'bone yari': 3 });
let nested = 0;
onPublish = () => {
  nested++;
  assert.equal(P.scrapItem('bone yari', 1), false, 'synchronous state-update callbacks cannot enter recycling twice');
};
assert.equal(P.scrapItem('bone yari', 1), true);
assert.ok(nested > 0, 'exercise the real publish boundary');
assert.equal(context.State.stores['bone yari'], 2);
assert.equal(context.State.stores.wood, 30);
assert.equal(savedRemainders().teeth, 50);
assert.equal(saves, 1);
onPublish = null;
assert.equal(P.scrapItem('bone yari', 1), true, 'the lock is released after publication');

console.log(`PASS: recycling covers all ${weapons.length} weapons and ${registeredPermanent.length} permanent equipment entries; packed/first-copy protection, saved fractional refunds, craft-batch quantities, split/batch equivalence and overflow guards.`);
