const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let active = null, overlay = null;
const context = {
  Engine: {activeModule: null}, Events: {activeEvent: () => active},
  Room: {}, Outside: {}, Path: {}, Ship: {}, Fabricator: {}, World: {}, Space: {},
  document: {getElementById: id => id === overlay ? {} : null},
  State: {stores: {wood: 123}, game: {campaignClaims: {cart: true}}}
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'script/update_notes.js'), 'utf8'), context);
const U = context.UpdateNotes;
const before = JSON.stringify([context.State, U.entries]);
const ids = U.entries.map(entry => entry.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(U.entries.length >= 10);
for (const entry of U.entries) {
  assert.ok(entry.date && entry.title && entry.items.length);
  for (const item of entry.items) {
    assert.equal(item.length, 3);
    assert.ok(U.categories.includes(item[0]) && item[1] && item[2]);
  }
}
assert.equal(U.filteredEntries('全部').length, U.entries.length);
for (const category of U.categories.slice(1)) {
  const groups = U.filteredEntries(category);
  assert.ok(groups.length > 0);
  assert.ok(groups.every(group => group.items.every(item => item[0] === category)));
}
assert.equal(U.filteredEntries('不存在').length, 0);
const notes = JSON.stringify(U.entries);
for (const text of ['20 个阶段', '硫磺矿', '无限列车', '150 → 15', '300 → 30', '2 个肉 + 5 块木头',
  '现有／所需', '日轮刀回收', '永久升级', '背包弹药', '生产保留库存', '材料账本', '疗伤', '归途', '流派', '每十层', '批量购买预算', '直接编辑配置目标', '战后返仓入口', '太阳结晶', '天赋共同突破', '25 级继承 10 级']) {
  assert.ok(notes.includes(text), 'recent update missing: ' + text);
}
for (const module of [context.Room, context.Outside, context.Path, context.Ship, context.Fabricator]) {
  context.Engine.activeModule = module;
  assert.equal(U.canShow(), true);
}
for (const module of [context.World, context.Space, null, {}]) {
  context.Engine.activeModule = module;
  assert.equal(U.canShow(), false);
  assert.equal(U.show(), false, 'reading notices must not pause exploration');
}
context.Engine.activeModule = context.Room;
active = {scenes: {}};
assert.equal(U.show(), false, 'must not replace or stack an ongoing event');
active = null;
for (const id of ['scrapQuantityOverlay', 'buyQuantityOverlay', 'loadoutEditorOverlay', 'nichirinForgeOverlay']) {
  overlay = id;
  assert.equal(U.show(), false, 'must not stack onto a quantity dialog');
}
assert.equal(JSON.stringify([context.State, U.entries]), before, 'filtering and blocked actions are read-only');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(index.includes('script/update_notes.js') && index.includes('css/update_notes.css'));
const engine = fs.readFileSync(path.join(root, 'script/engine.js'), 'utf8');
const published = engine.replace(/\/\*\s*@strip:([a-zA-Z0-9_-]+)-start\s*\*\/[\s\S]*?\/\*\s*@strip:\1-end\s*\*\//g, '');
assert.ok(published.includes('updateNotesButton') && published.includes('UpdateNotes.show()'), 'notice menu entry survives release stripping');
console.log('PASS: categorized recent history, release menu wiring, read-only filtering and exploration/event isolation.');
