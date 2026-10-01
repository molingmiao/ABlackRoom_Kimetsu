const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual drop/pickup functions, including jQuery text() removing the old menu.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.values = {}; this.classes = new Set(); this.nodes = []; this.content = ''; }
}
function descendants(node) { return node.nodes.flatMap(child => [child, ...descendants(child)]); }
function matches(node, selector) {
  return selector.startsWith('#') ? node.attrs.id === selector.slice(1) : selector.startsWith('.') ? node.classes.has(selector.slice(1)) : node.tag === selector;
}
function fixture(outfit, capacity, weights = {}) {
  const root = new Element('div'), calls = { updates: 0 };
  class Query {
    constructor(nodes) { this.nodes = nodes; this.length = nodes.length; }
    find(selector) { return new Query(this.nodes.flatMap(descendants).filter(node => matches(node, selector))); }
    children(selector) { return new Query(this.nodes.flatMap(node => node.nodes).filter(node => !selector || matches(node, selector))); }
    parent() { return new Query(this.nodes.map(node => node.parent).filter(Boolean)); }
    closest(selector) {
      return new Query(this.nodes.map(node => { while (node && !matches(node, selector)) node = node.parent; return node; }).filter(Boolean));
    }
    appendTo(target) {
      const parent = $(target).nodes[0];
      for (const node of this.nodes) {
        if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node);
        node.parent = parent; parent.nodes.push(node);
      }
      return this;
    }
    insertBefore(target) {
      const sibling = $(target).nodes[0], parent = sibling.parent;
      for (const node of this.nodes) { node.parent = parent; parent.nodes.splice(parent.nodes.indexOf(sibling), 0, node); }
      return this;
    }
    empty() { for (const node of this.nodes) { for (const child of node.nodes) child.parent = null; node.nodes = []; node.content = ''; } return this; }
    attr(key, value) {
      if (typeof key === 'object') { for (const node of this.nodes) Object.assign(node.attrs, key); return this; }
      if (arguments.length === 1) return this.nodes[0]?.attrs[key];
      for (const node of this.nodes) node.attrs[key] = value; return this;
    }
    data(key, value) { if (arguments.length === 1) return this.nodes[0]?.values[key]; for (const node of this.nodes) node.values[key] = value; return this; }
    addClass(name) { for (const node of this.nodes) node.classes.add(name); return this; }
    removeClass(name) { for (const node of this.nodes) node.classes.delete(name); return this; }
    hasClass(name) { return !!this.nodes[0]?.classes.has(name); }
    text(value) {
      if (!arguments.length) return this.nodes.map(node => [node, ...descendants(node)].map(child => child.content).join('')).join('');
      this.empty(); for (const node of this.nodes) node.content = value; return this;
    }
    first() { return new Query(this.nodes.slice(0, 1)); }
    each(callback) { this.nodes.forEach((node, index) => callback.call(node, index)); return this; }
    remove() { for (const node of this.nodes) { if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); node.parent = null; } return this; }
    click(callback) {
      if (callback) { for (const node of this.nodes) node.click = callback; }
      else for (const node of this.nodes) node.click?.call(node, { stopPropagation() {} });
      return this;
    }
    mouseenter() { return this; }
    one() { return this; }
    animate(properties, duration, easing, callback) { for (const node of this.nodes) callback.call(node); return this; }
  }
  function $(selector, context) {
    if (selector instanceof Query) return selector;
    if (selector instanceof Element) return new Query([selector]);
    if (typeof selector === 'string' && selector.startsWith('<')) return new Query([new Element(selector.match(/^<(\w+)/)[1])]);
    return (context ? $(context) : new Query([root])).find(selector);
  }
  const translations = { 'cured meat': '熏肉', medicine: '药剂', fur: '毛皮', pockets: '背包', 'drop:': '丢弃:', nothing: '不丢弃' };
  const context = {
    $, _: text => translations[text] || text, window: {},
    Engine: { log() {} }, World: { updateSupplies() { calls.updates++; } },
    Path: { outfit, getWeight: key => weights[key] ?? 1, getFreeSpace: () => capacity - Object.entries(outfit).reduce((sum, [key, quantity]) => sum + (weights[key] ?? 1) * quantity, 0) },
    Button: {
      Button: function(options) {
        const button = $('<div>').attr('id', options.id).addClass('button');
        $('<span>').text(options.text).appendTo(button); $('<div>').addClass('cooldown').appendTo(button);
        return button;
      },
      setDisabled(button, disabled = true) { button[disabled ? 'addClass' : 'removeClass']('disabled'); }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/events.js'), 'utf8'), context);
  const events = context.Events, lootButtons = $('<div>').attr('id', 'lootButtons').appendTo($(root));
  const allRow = $('<div>').addClass('takeETrow').appendTo(lootButtons);
  $('<div>').attr('id', 'loot_takeEverything').appendTo(allRow);
  function loot(key, count) { events.drawLootRow(key, count).insertBefore(allRow); return $('#take_' + key.replace(/ /g, '-')); }
  function drop(key) { $('#drop_' + key.replace(/ /g, '-')).click(); }
  return { $, events, loot, drop, outfit, calls, context };
}

{
  const f = fixture({ 'cured meat': 12, medicine: 2, wood: 0 }, 14);
  const target = f.loot('fur', 4);
  const original = JSON.stringify(f.outfit);
  f.events.drawDrop(target);
  assert.equal(JSON.stringify(f.outfit), original, 'opening the menu must not change inventory');
  assert.equal(f.$('#drop_cured-meat').text(), '熏肉 · 背包 12 · 丢弃 1');
  assert.equal(f.$('#drop_medicine').text(), '药剂 · 背包 2 · 丢弃 1');
  assert.equal(f.$('#drop_wood').length, 0, 'empty inventory is not a discard choice');
  f.drop('cured meat');
  assert.equal(f.outfit['cured meat'], 11); assert.equal(f.outfit.fur, 1);
  assert.equal(target.data('numLeft'), 3, 'discarding creates space and picks up one requested item');
  assert.equal(f.$('#take_cured-meat').data('numLeft'), 1, 'discarded supplies stay available as ground loot');
  assert.equal(f.$('#drop_cured-meat').text(), '熏肉 · 背包 11 · 丢弃 1', 'the still-full menu displays the new bag quantity');
  f.drop('medicine');
  assert.equal(f.$('#drop_medicine').text(), '药剂 · 背包 1 · 丢弃 1');
  f.drop('medicine');
  assert.equal(f.outfit.medicine, 0); assert.equal(f.$('#drop_medicine').length, 0);
  assert.equal(f.$('#take_medicine').data('numLeft'), 2, 'repeated discards merge into existing ground loot');
  assert.equal(f.outfit.fur, 3); assert.equal(target.data('numLeft'), 1);
  assert.equal(f.context.Path.getFreeSpace(), 0, 'pickup keeps the same capacity accounting');
  f.drop('cured meat');
  assert.equal(f.outfit.fur, 4); assert.equal(target.data('numLeft'), 0);
  assert.equal(f.$('#dropMenu').length, 0, 'an exhausted pickup target never keeps a discard menu open');
  assert.ok(f.calls.updates >= 4, 'the existing supplies feedback is still refreshed');
}
{
  const f = fixture({ 'cured meat': 2, medicine: 1, token: 1 }, 3, { fur: 6, token: 0 });
  const target = f.loot('fur', 1);
  f.events.drawDrop(target);
  assert.equal(f.$('#drop_cured-meat').text(), '熏肉 · 背包 2 · 丢弃 2', 'the requested discard amount is capped at the bag count');
  assert.equal(f.$('#drop_token').length, 0, 'weightless items cannot create room');
  f.drop('cured meat');
  assert.equal(f.outfit['cured meat'], 0); assert.equal(f.$('#drop_cured-meat').length, 0);
  assert.equal(target.data('numLeft'), 1, 'insufficient space cannot pick up a heavy item');
  assert.equal(f.$('#drop_medicine').text(), '药剂 · 背包 1 · 丢弃 1');
  f.drop('medicine');
  assert.equal(f.context.Path.getFreeSpace(), 3); assert.equal(target.data('numLeft'), 1);
  assert.equal(f.$('#dropMenu').children().length, 1, 'only the cancel choice remains when no weighted inventory is left');
}
{
  const f = fixture({ 'cured meat': 12, medicine: 2 }, 14);
  const target = f.loot('fur', 2);
  f.events.drawDrop(target);
  const stale = f.$('#drop_cured-meat');
  f.outfit['cured meat'] = 0; f.outfit.medicine = 14;
  stale.click();
  assert.equal(f.outfit['cured meat'], 0); assert.equal(f.$('#take_cured-meat').length, 0, 'a stale choice cannot duplicate missing items');
  assert.equal(f.$('#drop_cured-meat').length, 0); assert.equal(target.data('numLeft'), 2);
  f.outfit.medicine = 1;
  f.events.drawDrop(target);
  assert.equal(f.$('#dropMenu').length, 0, 'space becoming sufficient closes the obsolete menu');
}
console.log('PASS: discard choices show live backpack and discard quantities, refresh after pickup, hide empty items, preserve capacity/ground loot, and reject stale inventory choices.');
