// Read-only production rendering tests using a small DOM fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.classes = new Set(); this.value = ''; this.content = ''; this.open = false; this.scroll = 0; }
}
const descend = node => node.children.flatMap(child => [child, ...descend(child)]);
const matches = (node, selector) => {
  if (selector.startsWith('#')) return node.attrs.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classes.has(selector.slice(1));
  if (selector === 'details[data-production-fold]') return node.tag === 'details' && node.attrs['data-production-fold'] !== undefined;
  return node.tag === selector;
};
class Query {
  constructor(nodes) { this.nodes = nodes; this.length = nodes.length; nodes.forEach((node, i) => { this[i] = node; }); }
  addClass(value) { this.nodes.forEach(node => value.split(' ').forEach(name => node.classes.add(name))); return this; }
  toggleClass(name, value) { this.nodes.forEach(node => value ? node.classes.add(name) : node.classes.delete(name)); return this; }
  attr(name, value) {
    if (typeof name === 'object') { this.nodes.forEach(node => Object.assign(node.attrs, name)); return this; }
    if (value === undefined) return this[0]?.attrs[name];
    this.nodes.forEach(node => { node.attrs[name] = value; }); return this;
  }
  prop(name, value) { if (value === undefined) return this[0]?.[name]; this.nodes.forEach(node => { node[name] = value; }); return this; }
  text(value) {
    if (value === undefined) return this.nodes.map(node => [node, ...descend(node)].map(child => child.content).join('')).join('');
    this.nodes.forEach(node => { node.content = String(value); }); return this;
  }
  appendTo(parent) { const target = parent instanceof Query ? parent[0] : parent; this.nodes.forEach(node => { target.children.push(node); }); return this; }
  find(selector) { return new Query(this.nodes.flatMap(descend).filter(node => matches(node, selector))); }
  each(callback) { this.nodes.forEach((node, i) => callback.call(node, i, node)); return this; }
  empty() { this.nodes.forEach(node => { node.children = []; node.content = ''; }); return this; }
  scrollTop(value) { if (value === undefined) return this[0]?.scroll || 0; this.nodes.forEach(node => { node.scroll = value; }); return this; }
  on() { return this; }
  val(value) { if (value === undefined) return this[0]?.value; this.nodes.forEach(node => { node.value = value; }); return this; }
}
const panel = new Element('div'), description = new Element('div'), buttons = new Element('div');
description.attrs.id = 'description'; buttons.attrs.id = 'buttons'; panel.children.push(description, buttons);
const $ = (value, scope) => {
  if (value instanceof Query) return value;
  if (value instanceof Element) return new Query([value]);
  if (value.startsWith('<')) return new Query([new Element(value.match(/^<([a-z]+)/)[1])]);
  return new Query(descend(scope instanceof Query ? scope[0] : panel).filter(node => matches(node, value)));
};
const state = {
  stores: { wood: 100, meat: 3 },
  income: {
    gatherer: { delay: 10, stores: { wood: 3 } },
    charcutier: { delay: 10, stores: { wood: -10, meat: -4, 'cured meat': 2 } },
    irrelevant: { delay: 10, stores: { wood: 999 } }
  },
  game: { productionReserves: { wood: 95 } }
};
let event = { productionGuide: true };
const context = {
  $, _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]),
  $SM: {
    get(key) { return key.split('.').reduce((value, part) => value?.[part], state); },
    getProductionReserve(item) { return state.game.productionReserves[item] || 0; },
    set() { throw Error('view rendering must not write state'); }
  },
  Outside: { _INCOME: { gatherer: {}, charcutier: {} } },
  Events: { activeEvent: () => event, eventPanel: () => $(panel) }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/camp_guide.js'), 'utf8'), context);
const guide = context.CampGuide;
const snapshot = JSON.stringify(state);
assert.equal(guide.productionSnapshot().rows.length, 2, 'unrelated income sources remain excluded');
assert.equal(guide.productionSnapshot().reserves.wood, 95);
assert.equal(guide.renderProduction(), true);
assert.equal($(panel).find('.productionBlockedRow').length, 1, 'missing and reserved reasons share one stalled group');
assert.equal($(panel).find('.productionReason').length, 2, 'both shortage and reserve reasons are visible');
assert.equal($(panel).find('.productionDeficitRow').length, 2, 'theoretical deficits remain even while a group is stopped');
assert.match($(description).text(), /持续供需缺口/);
assert.match($(description).text(), /当前生产方/);
assert.match($(description).text(), /not enough for one group batch/);
assert.match($(description).text(), /production held for reserves/);
const fold = key => $(description).find('details[data-production-fold]').nodes.find(node => node.attrs['data-production-fold'] === key);
assert.equal(fold('jobs').open, false, 'routine recipes start collapsed');
fold('jobs').open = true; fold('job:charcutier').open = true; description.scroll = 45;
state.stores.meat = 4;
guide.renderProduction();
assert.equal(fold('jobs').open, true, 'refresh preserves the recipe group expansion');
assert.equal(fold('job:charcutier').open, true, 'refresh preserves each recipe expansion');
assert.equal(description.scroll, 45, 'refresh preserves reading position');
assert.doesNotMatch($(description).text(), /not enough for one group batch/);
assert.match($(description).text(), /production held for reserves/);
assert.match(guide.productionText().join('\n'), /production held for reserves/, 'legacy text diagnostics stay compatible');
state.game.productionReserves.wood = 0;
guide.renderProduction();
assert.equal($(panel).find('.productionBlockedRow').length, 0, 'stock/reserve changes are reflected without worker reassignment');
assert.match($(description).text(), /没有单组停工/);
assert.equal($(panel).find('.productionSummary').length, 1, 'refresh does not duplicate summaries');
assert.equal($(panel).find('.productionDeficitRow').length, 2, 'restocking does not hide the continuing imbalance');
state.stores.meat = 3; state.game.productionReserves.wood = 95;
assert.equal(JSON.stringify(state), snapshot, 'rendering neither consumes resources nor changes workers or reserve policy');
const before = $(description).text();
event.ending = true;
assert.equal(guide.renderProduction(), false);
assert.equal($(description).text(), before, 'closing dialogs ignore stale refresh callbacks');
event = { productionGuide: true };
state.income = {};
guide.renderProduction();
assert.match($(description).text(), /no active production yet/);
console.log('PASS: structured production shortage/reserve cards, planned deficits, read-only rendering, retained folds/scroll, empty state and compatible text diagnostics.');
