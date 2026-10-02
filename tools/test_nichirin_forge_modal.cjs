const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run actual modal handlers in a small DOM; real-browser geometry is checked separately.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.props = {}; this.data = {}; this.nodes = []; this.text = ''; this.handlers = {}; }
  focus() { activeElement = this; }
}
const root = new Element('html'), body = new Element('body');
root.nodes.push(body); body.parent = root;
let activeElement = body;
const descendants = node => node.nodes.flatMap(child => [child, ...descendants(child)]);
const matches = (node, selector) => {
  if (selector === '[role="dialog"]') return node.attrs.role === 'dialog';
  if (selector === '[role="dialog"]:not(#nichirinForgePanel)') return node.attrs.role === 'dialog' && node.attrs.id !== 'nichirinForgePanel';
  if (selector[0] === '#') return node.attrs.id === selector.slice(1);
  if (selector[0] === '.') return (node.attrs.class || '').split(' ').includes(selector.slice(1));
  return node.tag === selector;
};
const selected = (nodes, selector) => {
  const options = selector.split(',').map(part => part.trim());
  return nodes.filter(node => options.some(option => {
    const parts = option.split(/\s+/);
    if (!matches(node, parts.pop())) return false;
    let ancestor = node.parent;
    for (const part of parts.reverse()) {
      while (ancestor && !matches(ancestor, part)) ancestor = ancestor.parent;
      if (!ancestor) return false;
      ancestor = ancestor.parent;
    }
    return true;
  }));
};
class Query {
  constructor(nodes) { this.nodes = nodes; this.length = nodes.length; nodes.forEach((node, index) => { this[index] = node; }); }
  attr(key, value) {
    if (typeof key === 'object') { this.nodes.forEach(node => Object.assign(node.attrs, key)); return this; }
    if (arguments.length === 1) return this[0]?.attrs[key];
    this.nodes.forEach(node => { node.attrs[key] = value; }); return this;
  }
  prop(key, value) {
    if (arguments.length === 1) return this[0]?.props[key];
    this.nodes.forEach(node => { node.props[key] = value; }); return this;
  }
  data(key, value) {
    if (arguments.length === 1) return this[0]?.data[key];
    this.nodes.forEach(node => { node.data[key] = value; }); return this;
  }
  addClass(value) { this.nodes.forEach(node => { node.attrs.class = [node.attrs.class, value].filter(Boolean).join(' '); }); return this; }
  empty() { this.nodes.forEach(node => { node.nodes.forEach(child => { child.parent = null; }); node.nodes = []; node.text = ''; }); return this; }
  text(value) {
    if (!arguments.length) return this.nodes.map(node => [node, ...descendants(node)].map(child => child.text).join('')).join('');
    this.empty(); this.nodes.forEach(node => { node.text = String(value); }); return this;
  }
  append(child) { $(child).appendTo(this); return this; }
  appendTo(target) {
    const parent = $(target)[0];
    this.nodes.forEach(node => { node.parent = parent; parent.nodes.push(node); }); return this;
  }
  prependTo(target) {
    const parent = $(target)[0];
    this.nodes.forEach(node => { node.parent = parent; parent.nodes.unshift(node); }); return this;
  }
  on(types, callback) { this.nodes.forEach(node => types.split(' ').forEach(type => { (node.handlers[type] ||= []).push(callback); })); return this; }
  trigger(type, options = {}) {
    const events = [];
    this.nodes.forEach(node => {
      const event = { type, target: node, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
      for (const callback of node.handlers[type] || []) callback.call(node, event);
      events.push(event);
    });
    return events;
  }
  find(selector) { return new Query(selected(this.nodes.flatMap(descendants), selector)); }
  filter(callback) { return new Query(this.nodes.filter((node, index) => callback.call(node, index, node))); }
  each(callback) { this.nodes.forEach((node, index) => callback.call(node, index, node)); return this; }
  get() { return this.nodes; }
  focus() { this[0]?.focus(); return this; }
  remove() { this.nodes.forEach(node => { if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); node.parent = null; }); return this; }
}
function $(value) {
  if (value instanceof Query) return value;
  if (value instanceof Element) return new Query([value]);
  if (value.startsWith('<')) return new Query([new Element(value.match(/^<(\w+)/)[1])]);
  return new Query(selected(descendants(root), value));
}
const subscribers = new Set();
$.extend = Object.assign;
$.Dispatch = () => ({ subscribe: callback => subscribers.add(callback), unsubscribe: callback => subscribers.delete(callback),
  publish: event => [...subscribers].forEach(callback => callback(event)) });
let saves = 0, activeEvent = null;
const context = {
  State: { stores: { 'demon stone': 20, steel: 500, wood: 5000 }, features: { location: { fabricator: true } }, game: { nichirinForge: { attempts: 9 } } },
  $, _: text => text, Engine: { saveGame() { saves++; }, log() {}, keyLock: false },
  AudioLibrary: {}, AudioEngine: { playSound() {} }, Notifications: { notify() {} },
  Events: { activeEvent: () => activeEvent },
  document: { documentElement: { contains: node => descendants(root).includes(node) },
    get activeElement() { return activeElement; }, querySelector: selector => selected(descendants(root), selector)[0] || null }
};
context.window = context;
vm.createContext(context);
for (const file of ['state_manager.js', 'world.js', 'path.js', 'room.js', 'fabricator.js', 'nichirin_forge.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
}
vm.runInContext('window.Fabricator = Fabricator;', context);
const F = context.NichirinForge;
context.Fabricator.panel = $('<div>').attr('id', 'fabricatorPanel').appendTo('body');
$('<div>').addClass('forgeWorkbench').appendTo(context.Fabricator.panel);
context.Engine.activeModule = context.Fabricator;
F.render(); F.render();
assert.equal($('#openNichirinForge').length, 1, 'the forge page exposes exactly one trigger');
assert.equal($('.nichirinForge').length, 0, 'forging details do not occupy the crafting workbench');
const trigger = $('#openNichirinForge')[0], snapshot = () => JSON.stringify(context.State);
const before = snapshot();
$('#openNichirinForge').trigger('click');
assert.equal($('#nichirinForgePanel').attr('role'), 'dialog');
assert.equal($('#nichirinForgePanel').attr('aria-modal'), 'true');
assert.equal(activeElement, $('#nichirinForgePanel')[0]);
assert.equal(subscribers.size, 1);
assert.equal(F.open(trigger), false, 'a second call cannot duplicate a modal');
assert.equal(snapshot(), before); assert.equal(saves, 0);
assert.equal($('#forgeNichirin1').prop('disabled'), true);
assert.match($('.nichirinForgeProgress').text(), /累计锻造 9 次.*保底 1 次/);
assert.match($('.nichirinForgeMaterials').text(), /steel ×500/);
$('#forgeRiskAccepted').prop('checked', true).trigger('change');
assert.equal($('#forgeNichirin1').prop('disabled'), false, 'only its own dialog is excluded from the forge guard');
assert.equal(F.canForge(F._context), true);
const conflicting = $('<section>').attr({ id: 'anotherDialog', role: 'dialog' }).appendTo('body');
assert.equal(F.canForge(F._context), false);
conflicting.remove();

// All keyboard events stay local; Tab wraps through only currently enabled controls.
$('#cancelNichirinForge').focus();
let event = $('#nichirinForgeOverlay').trigger('keydown', { key: 'Tab' })[0];
assert.equal(event.prevented, true); assert.equal(event.stopped, true);
assert.equal(activeElement, $('#closeNichirinForge')[0]);
event = $('#nichirinForgeOverlay').trigger('keydown', { key: 'Tab', shiftKey: true })[0];
assert.equal(activeElement, $('#cancelNichirinForge')[0]);
assert.equal(event.prevented, true);
assert.equal($('#nichirinForgeOverlay').trigger('keyup', { key: 'd' })[0].stopped, true, 'keyup cannot switch to the background location');
const stale = F._context;
event = $('#nichirinForgeOverlay').trigger('keydown', { key: 'Escape' })[0];
assert.equal(event.prevented, true); assert.equal(event.stopped, true);
assert.equal($('#nichirinForgeOverlay').length, 0); assert.equal(subscribers.size, 0);
assert.equal(activeElement, trigger); assert.equal(F._context, null);
assert.equal(F.forge(1, stale), false); assert.equal(snapshot(), before); assert.equal(saves, 0);

for (const exit of ['cancel', 'close', 'mask']) {
  assert.equal(F.open(trigger), true);
  assert.equal($('#forgeRiskAccepted').prop('checked') || false, false, 'reopening requests fresh risk acknowledgment');
  if (exit === 'mask') $('#nichirinForgeOverlay').trigger('click');
  else $(exit === 'cancel' ? '#cancelNichirinForge' : '#closeNichirinForge').trigger('click');
  assert.equal(F._context, null); assert.equal(subscribers.size, 0);
  assert.equal(activeElement, trigger); assert.equal(snapshot(), before);
}

for (const block of ['event', 'lock', 'location', 'feature', 'dialog']) {
  let other;
  if (block === 'event') activeEvent = {};
  if (block === 'lock') context.Engine.keyLock = true;
  if (block === 'location') context.Engine.activeModule = context.Path;
  if (block === 'feature') context.State.features.location.fabricator = false;
  if (block === 'dialog') other = $('<section>').attr('role', 'dialog').appendTo('body');
  assert.equal(F.open(trigger), false, `${block}: inappropriate background state cannot open forging`);
  activeEvent = null; context.Engine.keyLock = false; context.Engine.activeModule = context.Fabricator;
  context.State.features.location.fabricator = true; if (other) other.remove();
}

assert.equal(F.open(trigger), true);
context.State.stores.steel = 5; context.StateManager.fireUpdate('stores');
assert.match($('.nichirinForgeMaterials').text(), /steel ×5/);
$('#forgeRiskAccepted').prop('checked', true).trigger('change');
assert.equal($('#forgeNichirin1').prop('disabled'), true, 'incoming inventory changes refresh the affordable buttons');
context.Engine.activeModule = context.Path; context.StateManager.fireUpdate('stores');
assert.equal(F._context, null, 'a stale context closes itself when location changes');
assert.equal(subscribers.size, 0); assert.equal(saves, 0);
assert.equal(context.State.game.nichirinForge.attempts, 9);
console.log('PASS: forge-button-only workbench, native modal lifecycle, fresh risk consent, no-cost cancel/Escape/mask, focus trapping/restoration, live stock, conflicting-dialog guards, stale contexts and listener cleanup.');
