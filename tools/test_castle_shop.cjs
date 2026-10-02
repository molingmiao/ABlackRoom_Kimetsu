const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const state = { stores: { 'cargo crow': 1 }, outfit: {}, character: { blueprints: {} }, game: {} };
  const translations = {}, labels = {}, notices = [], spent = [];
  const translate = (s, ...args) => (translations[s] || s).replace(/\{(\d+)\}/g, (_, n) => args[n]);
  translate.setTranslation = translate.addTranslation = rows => Object.assign(translations, rows);
  const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
  const sm = {
    get(key, zero) { let v = state; for (const k of parts(key)) v = v && v[k]; return v == null && zero ? 0 : v; },
    set(key, value) { const ks = parts(key); let obj = state; for (const k of ks.slice(0, -1)) obj = obj[k] || (obj[k] = {}); obj[ks.at(-1)] = value; },
    setM(key, values) { for (const k in values) sm.set(key + '["' + k + '"]', values[k]); }
  };
  const panel = { addClass(value) { this.className = value; return this; }, find() { return this; }, text(value) { this.title = value; return this; } };
  const c = { _: translate, $SM: sm, AudioLibrary: {}, Engine: { options: {} },
    Notifications: { notify(_, value) { notices.push(value); } },
    CastleReport: { recordMaterial(kind, item, amount) { spent.push([kind, item, amount]); } },
    Events: { eventPanel: () => panel },
    $: selector => ({ text(value) { labels[selector] = value; return this; } })
  };
  c.window = c;
  vm.createContext(c);
  for (const file of ['lang/zh_cn/strings.js', 'lang/zh_cn/castle_updates.js', 'script/room.js', 'script/world.js', 'script/path.js', 'script/fabricator.js', 'script/space.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  }
  c.Path.outfit = state.outfit;
  c.Engine.activeModule = c.Space;
  return { c, state, sm, labels, notices, spent, panel };
}

const originalCosts = {
  medicine: { teeth: 12, scales: 8 },
  'wisteria oil': { teeth: 8, scales: 12, cloth: 2 },
  'concentration pill': { scales: 10, iron: 4, steel: 2 },
  'firefly orb': { teeth: 8, 'solar crystal': 3, steel: 4 },
  'cured meat': { meat: 8, teeth: 4 },
  'wisteria bullet': { teeth: 6, iron: 3, sulphur: 2 },
  'wisteria bomb': { scales: 12, steel: 6, sulphur: 5 },
  kusarigama: { steel: 8, iron: 5, cloth: 3 },
  'bind kunai': { teeth: 10, steel: 5, cloth: 2 },
  torch: { wood: 4, sulphur: 2 }
};

{
  const { c, state, labels, panel } = fixture();
  const options = c.Space._bossRecraftOptions();
  assert.equal(options.length, 12);
  assert.equal(new Set(options.map(o => o.item)).size, options.length);
  for (const [item, cost] of Object.entries(originalCosts)) {
    assert.deepEqual(JSON.parse(JSON.stringify(options.find(o => o.item === item).cost)), cost, item + ': keep the existing guardian supply price');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(options.find(o => o.item === 'solar crystal').cost)), JSON.parse(JSON.stringify(c.Room.TradeGoods['solar crystal'].cost())));
  assert.deepEqual(JSON.parse(JSON.stringify(options.find(o => o.item === 'wisteria charm').cost)), { teeth: 6, cloth: 2 });
  // Every ammunition/throwable cost in the real weapon table can be replenished here.
  for (const weapon of Object.values(c.World.Weapons)) {
    for (const item of Object.keys(weapon.cost || {})) assert.ok(options.some(o => o.item === item), item + ' must not disappear from the full list');
  }
  const before = JSON.stringify(state), scene = c.Space._bossRecraftScene();
  assert.equal(Object.keys(scene.buttons).length, options.length + 1);
  assert.equal(Object.keys(scene.buttons).at(-1), 'leave');
  assert.equal(JSON.stringify(state), before, 'opening/previewing does not consume materials');
  options.forEach((o, index) => {
    const button = scene.buttons['recraft_' + index];
    assert.equal(button.cost, undefined, 'the general event dispatcher must not debit estate ingredients a second time');
    assert.equal(button.available(), false);
    assert.match(button.text, /家中材料|蓝图/);
    assert.equal(labels['#recraft_' + index], button.text, 'state refresh keeps the quantity and disabled reason current');
  });
  scene.onLoad();
  assert.equal(panel.className, 'castleRecraftShop');
  assert.equal(panel.title, '守关补给商店');
  assert.equal(c._('recraft supplies'), '楼层补给');
  assert.ok(scene.text.every(line => !/[a-z]{4,}/i.test(line)), 'the shop description is translated');
}

{
  const { c, state, sm, spent } = fixture();
  const options = c.Space._bossRecraftOptions();
  for (const o of options) {
    for (const key of Object.keys(o.cost)) state.stores[key] = 1000;
    state.character.blueprints[o.item] = true;
  }
  const scene = c.Space._bossRecraftScene();
  options.forEach((o, index) => {
    const button = scene.buttons['recraft_' + index], before = { ...state.stores };
    assert.equal(button.available(), true);
    button.onChoose();
    assert.equal(c.Path.outfit[o.item], 1);
    assert.equal(sm.get('outfit["' + o.item + '"]'), 1);
    for (const key of Object.keys(o.cost)) assert.equal(state.stores[key], before[key] - o.cost[key], 'charge only estate ' + key);
    assert.equal(state.stores[o.item], before[o.item], 'purchase goes to the current backpack, not the estate warehouse');
    assert.equal(button.nextScene, 'recraft', 'purchases remain in the same boss event');
  });
  assert.equal(spent.length, options.reduce((n, o) => n + Object.keys(o.cost).length, 0));
  assert.ok(c.Path.getFreeSpace() >= 0);
}

{
  const { c, state, notices, spent } = fixture();
  state.stores.scales = 60; state.stores.teeth = 60;
  const option = c.Space._bossRecraftOptions().find(o => o.item === 'solar crystal');
  delete state.stores['cargo crow'];
  c.Path.outfit['cured meat'] = 10;
  const before = JSON.stringify(state);
  assert.equal(c.Space._recraftToBackpack(option.item, option.cost), false);
  assert.equal(JSON.stringify(state), before, 'a full bag must not be charged');
  assert.match(notices.at(-1), /背包容量不足/);
  assert.equal(spent.length, 0);
  // A crystal weighs 0.2: buying the last fitting one must succeed, then stop.
  c.Path.outfit['cured meat'] = 9; c.Path.outfit['solar crystal'] = 4;
  assert.equal(c.Space._recraftToBackpack(option.item, option.cost), true);
  const filled = JSON.stringify(state);
  assert.equal(c.Space._recraftToBackpack(option.item, option.cost), false);
  assert.equal(JSON.stringify(state), filled);
  assert.ok(c.Path.getFreeSpace() >= -0.000001);
}

{
  const { c, state } = fixture();
  const oil = c.Space._bossRecraftOptions().find(o => o.item === 'wisteria oil');
  Object.assign(state.stores, { teeth: 100, scales: 100, cloth: 100 });
  let before = JSON.stringify(state);
  assert.equal(c.Space._recraftToBackpack(oil.item, oil.cost), false, 'not-yet-unlocked forge consumables remain unavailable');
  assert.equal(JSON.stringify(state), before);
  state.character.blueprints[oil.item] = true;
  assert.equal(c.Space._recraftPreview(oil.item, oil.cost).available, true);
  state.stores.scales = 0;
  before = JSON.stringify(state);
  assert.equal(c.Space._recraftToBackpack(oil.item, oil.cost), false, 'recheck ingredients immediately before committing the purchase');
  assert.equal(JSON.stringify(state), before);
  assert.match(c.Space._recraftPreview(oil.item, oil.cost).reason, /鳞片 ×12/);
  state.stores[oil.item] = 0; delete state.character.blueprints[oil.item];
  assert.equal(c.Space._recraftUnlocked(oil.item), true, 'a previously seen zero-stock supply stays unlocked');
  for (const cost of [{}, { scales: -1 }, { scales: Infinity }, { scales: 0.5 }]) {
    assert.equal(c.Space._recraftToBackpack('medicine', cost), false);
  }
}

{
  const { c, state } = fixture();
  c.Engine.options.testerMode = true;
  const crystal = c.Space._bossRecraftOptions().find(o => o.item === 'solar crystal');
  const stores = JSON.stringify(state.stores);
  assert.equal(c.Space._recraftToBackpack(crystal.item, crystal.cost), true);
  assert.equal(JSON.stringify(state.stores), stores, 'tester mode retains free supplies');
  delete state.stores['cargo crow']; c.Path.outfit['cured meat'] = 10;
  assert.equal(c.Space._recraftToBackpack(crystal.item, crystal.cost), false, 'tester mode still respects backpack capacity');
}

{
  const css = fs.readFileSync(path.join(__dirname, '../css/space.css'), 'utf8');
  assert.match(css, /\.castleRecraftShop #exitButtons\s*\{[^}]*max-height:\s*48vh;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.castleRecraftShop #exitButtons #leave\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/);
}

console.log('PASS guardian supply list, translations, estate charging, unlocks and backpack limits');
