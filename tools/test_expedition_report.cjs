const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = {};
let writes = 0, shown = null, activeEvent = null, className;
const renderedText = [];
const element = {
  addClass(name) { if (name === 'expeditionReport') className = name; return this; },
  find() { return this; }, empty() { renderedText.length = 0; return this; },
  appendTo() { return this; }, text(value) { renderedText.push(value); return this; }
};
const context = {
  $: () => element,
  $SM: {get: key => state[key], set: (key, value) => { writes++; state[key] = value; }},
  _: text => text,
  Engine: {activeModule: null},
  Space: {},
  World: {Weapons: {
    'bone yari': {damage: 2},
    'wisteria gun': {damage: 5, cost: {'wisteria bullet': 1}},
    kusarigama: {damage: 'stun', cost: {kusarigama: 1}}
  }},
  Path: {getWeaponCategory: key => key === 'bone yari' ? 'primary' : 'secondary'},
  Events: {
    activeEvent: () => activeEvent,
    startEvent: (event, options) => { shown = {event, options}; },
    eventPanel: () => element
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/expedition_report.js'), 'utf8'), context);
const report = context.ExpeditionReport;
assert.equal(report.latest(), null, 'old saves have no report');
assert.equal(report.finish('return'), null, 'no active run cannot create a report');
assert.equal(report.show(), false);
assert.equal(writes, 0);
const begin = {
  outfit: {'cured meat': 8, 'bone yari': 1},
  map: [['A', 'H'], ['O!', ';']], mask: [[true, false], [true, false]],
  equipped: {primary: ['bone yari'], secondary: []}
};
report.begin(begin);
assert.equal(writes, 0, 'active run is memory only');
begin.outfit['cured meat'] = 999;
begin.map[0][1] = 'H!'; begin.mask[0][1] = true;
report.recordMove(3); report.recordMove(1); report.recordMove(5);
assert.equal(writes, 0, 'moves are memory only');
const end = {
  outfit: {'cured meat': 4, 'bone yari': 1, fur: 5},
  map: [['A', 'H!'], ['O!', ';']], mask: [[true, true], [true, true]],
  unlocks: ['iron mine', 'iron mine'],roadNotes:['补好的绳结','补好的绳结','名单的空白处']
};
let completed = report.finish('return', end);
assert.equal(writes, 1);
assert.equal(report._run, null);
assert.equal(completed.steps, 3);
assert.equal(completed.farthestDistance, 5);
assert.equal(completed.newTiles, 2, 'new visibility is a cell difference, not total map size');
assert.equal(completed.newLocations, 1, 'previously visited markers do not count again');
assert.equal(completed.mapSaved, true);
assert.equal(completed.gained.fur, 5);
assert.equal(completed.reduced['cured meat'], 4);
assert.equal(completed.returned['bone yari'], 1);
assert.equal(completed.unlocks.length, 1);
assert.equal(completed.roadNotes.length,2,'read-only notes are bounded and deduplicated');
end.outfit.fur = 999; end.unlocks.push('coal mine'); completed.returned.fur = 123;
assert.equal(report.latest().returned.fur, 5, 'input and result dictionaries cannot mutate saved report');
assert.equal(report.latest().unlocks.length, 1);
const snapshot = JSON.stringify(state);
assert.deepEqual(JSON.parse(JSON.stringify(report.finish('death'))), JSON.parse(JSON.stringify(report.latest())));
report.recordMove(500);
assert.equal(writes, 1, 'duplicate finish cannot overwrite a completed report');
assert.equal(JSON.stringify(state), snapshot);
assert.equal(report.show(), true);
assert.equal(className, 'expeditionReport');
assert.equal(shown.event.scenes.start.buttons.closeExpeditionReport.nextScene, 'end');
assert.equal(shown.event.scenes.start.text.length, 0, 'structured sections replace flat paragraphs');
assert.match(renderedText.join(' '), /净增加.*净减少.*不含庄园生产/);
assert.match(renderedText.join(' '), /已返回庄园.*地图进展已保存.*探索进展.*3 步.*本次解锁.*iron mine.*下次准备/);
assert.match(renderedText.join(' '),/沿途见闻.*已收录.*补好的绳结/);
assert.equal(JSON.stringify(state), snapshot, 'review is read-only');
activeEvent = {};
assert.equal(report.show(), false, 'cannot interrupt another event');
activeEvent = null;
context.Engine.activeModule = context.World;
assert.equal(report.show(), false, 'old report cannot interrupt world exploration');
context.Engine.activeModule = context.Space;
assert.equal(report.show(), false, 'old report cannot interrupt a castle descent');
context.Engine.activeModule = null;
// Reload preserves the finished report but never resumes the expedition.
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/expedition_report.js'), 'utf8'), context);
const reloaded = context.ExpeditionReport;
assert.equal(reloaded._run, null);
assert.equal(reloaded.latest().steps, 3);
assert.equal(reloaded.show(), true);
// Current death rules return the remainder, not lose the whole pack.
reloaded.begin({outfit: {'cured meat': 10, 'wisteria gun': 1, 'wisteria bullet': 5}, map: [['H']], mask: [[false]], equipped: {secondary: ['wisteria gun']}});
completed = reloaded.finish('death', {outfit: {'cured meat': 7, 'wisteria gun': 1, fur: 4}, map: [['H!']], mask: [[true]], reason: 'combat'});
assert.equal(completed.mapSaved, false);
assert.equal(completed.newTiles, 1);
assert.equal(completed.newLocations, 1);
assert.equal(completed.returned['cured meat'], 7);
assert.equal(completed.reduced['cured meat'], 3);
assert.equal(completed.reduced['wisteria bullet'], 5);
assert.equal(completed.reduced['wisteria gun'], undefined, 'returned weapon is not falsely reported lost');
assert.equal(completed.gained.fur, 4, 'loot returned on death counts as net gain');
assert.match(reloaded.lines(completed).join(' '), /地图变化未保存，剩余背包已归还仓库/);
assert.match(reloaded.suggestions(completed)[0], /wisteria bullet.*近战/);
reloaded.render(completed, element);
assert.match(renderedText.join(' '), /本次倒下.*地图变化未保存.*剩余背包已归还仓库/);
['map', 'mask', 'position', 'curPos', 'outfit', 'equipped', 'state'].forEach(key => {
  assert.equal(Object.hasOwn(completed, key), false, 'completed report contains no resumable ' + key);
});
reloaded.begin({outfit: {}, equipped: {}});
const fist = reloaded.finish('death', {outfit: {}, reason: 'combat'});
assert.match(reloaded.suggestions(fist)[0], /装备槽/);
reloaded.begin({});
const food = reloaded.finish('death', {reason: 'food'});
assert.match(reloaded.suggestions(food)[0], /口粮/);
reloaded.begin({});
const water = reloaded.finish('death', {reason: 'water'});
assert.match(reloaded.suggestions(water)[0], /缺水/);
// Malformed and oversized inputs remain bounded, and the API never reads stores.
const many = Object.fromEntries(Array.from({length: 200}, (_, i) => ['resource' + i, i + 1]));
many.bad = NaN;
const names = Array.from({length: 50}, (_, i) => 'unlock' + i);
reloaded.begin({outfit: many});
assert.equal(reloaded.finish('invalid', {}), null);
assert.notEqual(reloaded._run, null, 'invalid outcome does not erase the active run');
const bounded = reloaded.finish('return', {outfit: many, unlocks: names, reason: 'arbitrary user text'});
assert.equal(Object.keys(bounded.returned).length, 80);
assert.equal(bounded.unlocks.length, 12);
assert.equal(bounded.reason, null);
console.log('PASS ordinary expedition reports: progress, net resources, death recovery, read-only review, reload and bounded summaries');
