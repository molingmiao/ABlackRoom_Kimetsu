const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A deliberately small DOM fixture: enough to test stable native buttons and their callbacks.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.props = {}; this.classes = new Set(); this.values = {}; this.nodes = []; this.handlers = {}; this.hidden = false; this.content = ''; }
}
const root = new Element('div');
function matches(node, selector) { return selector[0] === '#' ? node.attrs.id === selector.slice(1) : selector[0] === '.' ? node.classes.has(selector.slice(1)) : node.tag === selector; }
function descendants(node) { return node.nodes.flatMap(child => [child, ...descendants(child)]); }
class Query {
  constructor(nodes) { this.nodes = nodes; this.length = nodes.length; }
  find(selector) { return new Query(this.nodes.flatMap(descendants).filter(node => matches(node, selector))); }
  children(selector) { return new Query(this.nodes.flatMap(node => node.nodes).filter(node => !selector || matches(node, selector))); }
  appendTo(target) { const parent = $(target).nodes[0]; if (parent) for (const node of this.nodes) { parent.nodes.push(node); node.parent = parent; } return this; }
  attr(key, value) { if (arguments.length === 1) return this.nodes[0]?.attrs[key]; for (const node of this.nodes) node.attrs[key] = value; return this; }
  prop(key, value) { if (arguments.length === 1) return this.nodes[0]?.props[key]; for (const node of this.nodes) node.props[key] = value; return this; }
  data(key, value) { if (arguments.length === 1) return this.nodes[0]?.values[key]; for (const node of this.nodes) node.values[key] = value; return this; }
  addClass(value) { for (const node of this.nodes) for (const name of value.split(' ')) node.classes.add(name); return this; }
  removeClass(value) { for (const node of this.nodes) node.classes.delete(value); return this; }
  toggleClass(value, enabled) { return enabled ? this.addClass(value) : this.removeClass(value); }
  text(value) { if (!arguments.length) return this.nodes[0]?.content; for (const node of this.nodes) node.content = value; return this; }
  on(event, handler) { for (const node of this.nodes) (node.handlers[event] ||= []).push(handler); return this; }
  trigger(event) { for (const node of this.nodes) if (!node.props.disabled) for (const handler of node.handlers[event] || []) handler.call(node); return this; }
  remove() { for (const node of this.nodes) if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); return this; }
  hide() { for (const node of this.nodes) node.hidden = true; return this; }
  show() { for (const node of this.nodes) node.hidden = false; return this; }
  toggle(enabled) { return enabled ? this.show() : this.hide(); }
}
function $(selector) {
  if (selector instanceof Query) return selector;
  if (selector instanceof Element) return new Query([selector]);
  if (typeof selector === 'string' && selector.startsWith('<')) return new Query([new Element(selector.match(/^<(\w+)/)[1])]);
  if (typeof selector === 'string') return new Query([root, ...descendants(root)].filter(node => matches(node, selector)));
  return new Query([]);
}
let now = 1000, nextTimer = 0, timers = new Map(), sounds = [], writes = [], reentry = [], supplyUpdates = 0, healthUpdates = 0;
let activeEvent = null, reenter = false, maxHp = 100;
const perks = new Set();
class TestDate extends Date { static now() { return now; } }
const context = {
  $, Date: TestDate, _: value => value,
  setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, at: now + ms }); return id; },
  clearTimeout: id => timers.delete(id),
  $SM: {
    get(key) { if (key.startsWith('stores')) throw new Error('Treatment must not consult warehouse supplies'); return undefined; },
    set: (key, value) => writes.push([key, value]), hasPerk: key => perks.has(key)
  },
  Engine: { activeModule: null, keyLock: false },
  Path: { outfit: {} },
  Button: { setDisabled: (btn, disabled) => { if (btn) btn.toggleClass('disabled', disabled).data('disabled', disabled); } },
  AudioEngine: { playSound: sound => sounds.push(sound) }, AudioLibrary: { EAT_MEAT: 'eat', USE_MEDS: 'medicine' }
};
context.window = context;
vm.createContext(context);
for (const file of ['world.js', 'events.js', 'field_treatment.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
const W = context.World, E = context.Events, F = context.FieldTreatment, P = context.Path;
E.activeEvent = () => activeEvent;
E.setHeal = () => false;
W.getMaxHealth = () => maxHp;
W.travelInfo = () => ({ budget: { food: 4 } });
W.updateSupplies = () => { supplyUpdates++; F.update(); if (reenter) reentry.push(F.use('cured meat'), F.use('medicine')); };
W.setHp = hp => { W.health = hp; healthUpdates++; F.update(); if (reenter) reentry.push(F.use('cured meat')); };
function prepare(outfit = { 'cured meat': 5, medicine: 2, 'wisteria oil': 1 }) {
  F.reset(); W.state = {}; W.dead = false; W.health = 10; maxHp = 100;
  W.foodMove = 1; W.waterMove = 1; W.starvation = true; W.thirst = true; W.water = 5;
  P.outfit = outfit; context.Engine.activeModule = W; context.Engine.keyLock = false; activeEvent = null; reenter = false; perks.clear();
  F.update();
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
prepare(); F.init($(root));
const meatButton = $('#worldHeal_meat').nodes[0];
F.init($(root)); F.update(); F.init($(root));
assert.equal($('#worldFieldTreatment').length, 1);
assert.equal($('.fieldTreatmentActions').children().length, 3);
assert.equal($('#worldHeal_meat').nodes[0], meatButton, 'updates and repeated init retain the button object');
assert.equal(meatButton.handlers.click.length, 1, 'only one click handler');
assert.equal(meatButton.tag, 'button'); assert.equal(meatButton.attrs.type, 'button'); assert.equal(meatButton.attrs['data-hotkey'], '1');
assert.equal($('#worldHeal_meat').children('.hotkeyBadge').length, 1);
assert.match($('.fieldTreatmentNote').text(), /不重置移动耗粮计数/);
assert.match($('.fieldTreatmentNote').text(), /水不能当治疗品/);
const before = JSON.stringify([P.outfit, W.health, writes, F._readyAt, timers.size]);
assert.deepEqual(plain(F.info('cured meat')), { item: 'cured meat', id: 'worldHeal_meat', key: '1', label: '吃熏肉', count: 5, base: 8, amount: 8, missingHp: 90, heal: 8, healingAvailable: true, reason: null, cooldownSeconds: 0, foodWarning: false, foodNeeded: 4 });
assert.equal(JSON.stringify([P.outfit, W.health, writes, F._readyAt, timers.size]), before, 'preview is read-only and starts no timer');
assert.equal(F.info('water'), null); assert.equal(F.info('__proto__'), null); assert.equal(F.use('water'), 0);

reenter = true;
assert.equal(F.use('cured meat'), 8); assert.equal(W.health, 18); assert.equal(P.outfit['cured meat'], 4);
assert.ok(reentry.every(result => result === 0), 'supply/health callbacks cannot consume more treatment, even a different item');
assert.equal(F.use('cured meat'), 0); assert.equal(P.outfit['cured meat'], 4);
assert.equal(F.info('cured meat').cooldownSeconds, 5); assert.equal(F.info('cured meat').foodWarning, true);
assert.equal(W.foodMove, 1); assert.equal(W.waterMove, 1); assert.equal(W.starvation, true); assert.equal(W.thirst, true); assert.equal(W.water, 5);
assert.equal(timers.size, 1, 'one short timer, despite reentrant updates');
reenter = false;
assert.equal(F.use('medicine'), 20, 'medicine has an independent cooldown');
assert.equal(F.use('wisteria oil'), 30); assert.equal(P.outfit['wisteria oil'], 0);
assert.equal(F.info('wisteria oil').cooldownSeconds, 7, 'cooldown remains visible when the last item was used');
assert.match($('#worldHeal_oil').find('.fieldTreatmentLabel').text(), /携带 0.*7 秒/);
assert.equal(timers.size, 1); assert.equal(supplyUpdates, 3); assert.equal(healthUpdates, 3);
assert.deepEqual(sounds, ['eat', 'medicine', 'medicine']);
assert.ok(writes.every(([key]) => key.startsWith('outfit[')), 'only the existing outfit-consumption path writes state');
activeEvent = {}; F.update(); assert.equal($('#worldHeal_medicine').prop('disabled'), true);
now += 1200; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
assert.equal(F.info('medicine').cooldownSeconds, 6); assert.equal(timers.size, 1, 'countdown continues while an event disables controls');
activeEvent = null; now += 7000; F.update(); assert.equal(timers.size, 0); assert.equal(F.info('cured meat').healingAvailable, true);
assert.equal($('#worldHeal_meat').nodes[0], meatButton); assert.equal($('#worldHeal_meat').children('.hotkeyBadge').length, 1);

prepare(); perks.add('breath nourish'); W.health = 90;
assert.equal(F.info('cured meat').base, 16); assert.equal(F.info('cured meat').heal, 10);
assert.equal(F.use('cured meat'), 10, 'preview matches real perk healing clamped to missing HP');
assert.equal(W.health, 100); const fullCount = P.outfit['cured meat'], soundCount = sounds.length;
assert.equal(F.use('medicine'), 0); assert.equal(P.outfit['cured meat'], fullCount); assert.equal(P.outfit.medicine, 2); assert.equal(sounds.length, soundCount);

for (const condition of ['event', 'locked', 'dead', 'noState', 'away', 'staleState', 'staleOutfit']) {
  prepare();
  if (condition === 'event') activeEvent = {};
  if (condition === 'locked') context.Engine.keyLock = true;
  if (condition === 'dead') W.dead = true;
  if (condition === 'noState') W.state = null;
  if (condition === 'away') context.Engine.activeModule = {};
  if (condition === 'staleState') W.state = {};
  if (condition === 'staleOutfit') P.outfit = { ...P.outfit };
  const inventory = JSON.stringify(P.outfit), writeCount = writes.length;
  assert.equal(F.use('cured meat'), 0, condition); assert.equal(JSON.stringify(P.outfit), inventory); assert.equal(writes.length, writeCount);
}
for (const quantity of [NaN, Infinity, -1, 0, 0.5, undefined]) {
  prepare({ 'cured meat': quantity }); const writeCount = writes.length;
  assert.equal(F.info('cured meat').healingAvailable, false); assert.equal(F.use('cured meat'), 0); assert.equal(writes.length, writeCount);
}
for (const invalidHealth of [NaN, Infinity, 0, -1]) {
  prepare(); W.health = invalidHealth;
  assert.equal(F.info('cured meat').healingAvailable, false); assert.equal(F.use('cured meat'), 0); assert.equal(P.outfit['cured meat'], 5);
}
for (const invalidMax of [NaN, Infinity, 0, -1]) {
  prepare(); maxHp = invalidMax; assert.equal(F.use('medicine'), 0); assert.equal(P.outfit.medicine, 2);
}
const healingAmount = E.getHealingAmount, baseAmount = E.getBaseHealingAmount;
for (const invalidHeal of [NaN, Infinity, 0, -1]) {
  prepare(); E.getHealingAmount = () => invalidHeal; assert.equal(F.info('medicine').heal, 0); assert.equal(F.use('medicine'), 0); assert.equal(P.outfit.medicine, 2);
}
E.getHealingAmount = healingAmount;
prepare(); E.getBaseHealingAmount = () => NaN; assert.equal(F.use('medicine'), 0); E.getBaseHealingAmount = baseAmount;

prepare(); $('#worldHeal_meat').trigger('click'); assert.equal(P.outfit['cured meat'], 4); $('#worldHeal_meat').trigger('click'); assert.equal(P.outfit['cured meat'], 4, 'native disabled control cannot click twice');
const oldTimer = [...timers.values()][0].callback;
timers.clear(); W.state = {}; oldTimer(); assert.equal(F._state === W.state, false, 'an old timer cannot capture a replaced journey');
F.reset(); assert.equal(timers.size, 0); assert.deepEqual(plain(F._readyAt), {}); assert.equal(F._state, null); assert.equal(F._outfit, null);
oldTimer(); assert.equal(F._state, null, 'even a previously queued callback cannot reactivate treatment after reset');
assert.equal($('#worldFieldTreatment').nodes[0].hidden, true); assert.equal(F.use('cured meat'), 0, 'reset invalidates stale handlers until a valid update');
F.update(); assert.equal(F.info('cured meat').cooldownSeconds, 0, 'no cooldown persists across reset');
context.Engine.activeModule = {}; F.update(); assert.equal(timers.size, 0); assert.equal($('#worldFieldTreatment').nodes[0].hidden, true);
console.log('PASS: read-only field treatment preview, actual perk/clamped healing, backpack-only use, stable native hotkey controls, independent memory cooldowns, precise food warning, context guards and reentrancy/reset safety.');
