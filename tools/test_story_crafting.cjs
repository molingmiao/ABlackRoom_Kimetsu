const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Real recipes, state manager, choice costs and capacity; only DOM/timers are stubbed.
const ui = { length: 0, find() { return this; }, attr() { return ''; } };
let saves = 0, choices = 0, updates = [], onPublish = null;
const c = {
  State: {}, _: text => text, $: () => ui, AudioLibrary: {},
  Engine: { options: { testerMode: false }, saveGame() { saves++; }, log() {} },
  Notifications: { notify() {} }, Button: { setDisabled() {} }, Space: {},
  World: { water: 10, health: 100, updateSupplies() {}, setHp(value) { this.health = value; }, setWater(value) { this.water = value; } }
};
c.$.Dispatch = () => ({ publish(event) { updates.push(event.category); if (onPublish) onPublish(event); } });
c.window = c;
vm.createContext(c);
for (const file of ['state_manager.js', 'path.js', 'room.js', 'outside.js', 'fabricator.js', 'events.js', 'story_crafting.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), c);
}
const sc = c.StoryCrafting, events = c.Events;
sc.refresh = () => {};
events.eventPanel = () => ui;
const plain = value => JSON.parse(JSON.stringify(value));
function reset(cost, home, bag = {}, atHome = false) {
  c.State = { stores: { ...home }, game: { builder: { level: 4 }, temperature: { value: 4 },
    buildings: { workshop: 1, smokehouse: 1, tannery: 1, steelworks: 1 } }, features: {}, character: {} };
  c.Path.outfit = { ...bag };
  c.Engine.activeModule = atHome ? c.Room : c.World;
  const info = { text: '为同伴准备物资', cost, onChoose() { choices++; } };
  events.eventStack = [{ title: '剧情', storySupply: true, scenes: { start: { buttons: { help: info } } } }];
  events.activeScene = 'start'; events.sceneVersion = (events.sceneVersion || 0) + 1;
  events.won = events.fought = false;
  saves = choices = 0; updates = []; onPublish = null;
  c.World.health = 100; c.World.water = 10;
  return info;
}
const snapshot = () => JSON.stringify({ state: c.State, bag: c.Path.outfit, hp: c.World.health, water: c.World.water });
const commit = () => sc.commit('help', sc.context('help'));
const submit = () => events.buttonClick({ attr() { return 'help'; } });

let info = reset({ 'cured meat': 2 }, { wood: 10, meat: 4, cloth: 7 });
let before = snapshot(), plan = sc.plan(info);
assert.equal(plan.ready, true);
assert.deepEqual(plain(plan.costs), { meat: 4, wood: 10 });
assert.equal(snapshot(), before, 'preview neither crafts nor consumes resources');
assert.equal(commit(), true);
assert.deepEqual(plain(c.State.stores), { wood: 0, meat: 0, cloth: 7, 'cured meat': 0 });
assert.deepEqual(plain(c.Path.outfit), { 'cured meat': 2 });
assert.equal(choices, 0, 'commission does not silently choose the story action');
assert.equal(saves, 1, 'commission saves both inventories together');
assert.deepEqual(plain(c.State.outfit), plain(c.Path.outfit));
assert.deepEqual(updates, ['stores', 'outfit']);
assert.equal(commit(), false, 'duplicate commission cannot charge or mint extra goods');
submit();
assert.equal(choices, 1); assert.equal(c.Path.outfit['cured meat'], 0);

info = reset({ torch: 1 }, { wood: 1, cloth: 1 }, {}, true);
assert.equal(commit(), true);
assert.deepEqual(plain(c.State.stores), { wood: 0, cloth: 0, torch: 1 });
assert.deepEqual(plain(c.Path.outfit), {});
submit(); assert.equal(c.State.stores.torch, 0);

info = reset({ 'cured meat': 4 }, { 'cured meat': 1, wood: 10, meat: 4 }, { 'cured meat': 1 });
plan = sc.plan(info);
assert.deepEqual(plain(plan.take), [{ item: 'cured meat', quantity: 1 }]);
assert.deepEqual(plain(plan.costs), { meat: 4, wood: 10 });
assert.equal(commit(), true); assert.equal(c.Path.outfit['cured meat'], 4);
assert.equal(c.State.stores['cured meat'], 0);

info = reset({ torch: 1 }, { wood: 1, cloth: 1 }, { fur: 10 });
before = snapshot(); assert.match(sc.plan(info).reason, /背包空间/);
assert.equal(commit(), false); assert.equal(snapshot(), before);
c.Path.outfit.fur = 9; assert.equal(commit(), true);

for (const atHome of [false, true]) {
  info = reset({ torch: 1, wood: 1 }, { wood: 1, cloth: 1 }, {}, atHome);
  before = snapshot(); assert.equal(sc.plan(info).ready, false);
  assert.equal(commit(), false); assert.equal(snapshot(), before, 'requested raw material is reserved before crafting');
  c.State.stores.wood = 2; assert.equal(commit(), true); submit(); assert.equal(choices, 1);
  assert.equal(atHome ? c.State.stores.wood : c.Path.outfit.wood, 0);
}
info = reset({ torch: 1, 'cured meat': 1 }, { wood: 5, cloth: 1, meat: 2 });
before = snapshot(); assert.equal(commit(), false); assert.equal(snapshot(), before, 'shared ingredient shortage blocks the entire commission');
c.State.stores.wood = 6; assert.equal(commit(), true);
assert.equal(c.State.stores.wood, 0); assert.equal(c.Path.outfit.torch, 1); assert.equal(c.Path.outfit['cured meat'], 1);

info = reset({ 'wisteria oil': 1 }, { 'demon stone': 1 });
c.State.features.location = { fabricator: true };
before = snapshot(); assert.equal(commit(), false); assert.equal(snapshot(), before, 'locked blueprints cannot be bypassed');
c.State.character.blueprints = { 'wisteria oil': true };
assert.equal(commit(), true);
assert.equal(c.State.stores['demon stone'], 0);
assert.equal(c.State.stores['wisteria oil'], 4, 'unused full-batch output stays at home');
assert.equal(c.Path.outfit['wisteria oil'], 1, 'only requested amount enters backpack');

for (const locked of ['workshop', 'builder', 'temperature', 'smokehouse']) {
  info = reset(locked === 'smokehouse' ? { 'cured meat': 1 } : { torch: 1 }, { wood: 20, cloth: 1, meat: 2 });
  if (locked === 'builder') c.State.game.builder.level = 3;
  else if (locked === 'temperature') c.State.game.temperature.value = c.Room.TempEnum.Cold.value;
  else c.State.game.buildings[locked] = 0;
  before = snapshot(); assert.equal(commit(), false, locked + ' remains required'); assert.equal(snapshot(), before);
}
info = reset({ leather: 2, steel: 1 }, { fur: 10, iron: 1, coal: 1 });
assert.equal(commit(), true);
assert.deepEqual(plain(sc.plan(info).missing), []);
assert.equal(c.Path.outfit.leather, 2); assert.equal(c.Path.outfit.steel, 1);

info = reset({ medicine: 1 }, { medicine: 1 });
const stale = sc.context('help');
events.sceneVersion++;
before = snapshot(); assert.equal(sc.commit('help', stale), false); assert.equal(snapshot(), before);
info.available = () => false; assert.equal(sc.context('help'), null); submit(); assert.equal(choices, 0);
delete info.available;
c.Engine.activeModule = c.Space; assert.equal(sc.context('help'), null);
c.Engine.activeModule = c.World;
events.activeEvent().scenes.start.combat = true; assert.equal(sc.context('help'), null);
events.won = events.fought = true; assert.ok(sc.context('help'));
events.activeEvent().storySupply = false; assert.equal(sc.context('help'), null, 'ordinary exploration cannot use remote supply');

info = reset({ torch: 1 }, { wood: 1, cloth: 1 }, { 'firefly orb': 1 });
assert.equal(sc.plan(info).missing.length, 0); assert.equal(commit(), false);
info = reset({ water: 11, torch: 1 }, { wood: 1, cloth: 1 });
before = snapshot(); assert.equal(commit(), false); submit(); assert.equal(snapshot(), before);
info = reset({ water: 2, hp: 5, torch: 1 }, {});
before = snapshot(); submit(); assert.equal(snapshot(), before, 'later shortage cannot first consume water or HP');
c.Path.outfit.torch = 1; submit(); assert.equal(c.World.health, 95); assert.equal(c.World.water, 8);
assert.equal(choices, 1, 'valid choice uses current health rather than nonexistent World.hp');
for (const invalid of [-1, NaN, Infinity, 1.5, 10001]) {
  info = reset({ torch: invalid }, { wood: 100, cloth: 100 });
  before = snapshot(); assert.equal(commit(), false); assert.equal(snapshot(), before);
}
info = reset({ torch: 1 }, { torch: 2 }, {}, true);
onPublish = () => submit();
submit();
assert.equal(choices, 1); assert.equal(c.State.stores.torch, 1, 'inventory publication cannot reenter the current choice');
assert.equal(events._resolvingChoice, false);
onPublish = null;
const oldContext = { event: events.activeEvent(), scene: events.activeEvent().scenes.start, info, version: events.sceneVersion };
const oldButton = { attr() { return 'help'; }, data() { return oldContext; } };
events.sceneVersion++;
before = snapshot(); events.buttonClick(oldButton);
assert.equal(snapshot(), before, 'old real button context cannot choose a same-name option after scene reload');
assert.equal(choices, 1);
info.onChoose = () => { throw Error('test exception'); };
assert.throws(submit, /test exception/);
assert.equal(events._resolvingChoice, false, 'exception releases the choice lock for future story actions');
console.log('PASS: story commission previews, real recipes, partial stock, atomic costs, blueprint/building gates, capacity, stale contexts and normal choice submission');
