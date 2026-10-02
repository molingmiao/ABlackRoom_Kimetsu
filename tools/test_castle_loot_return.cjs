const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Use the real victory renderer, loot rows, event stack and button dispatcher.
// Tiny DOM buttons only replace animations/cooldowns; no manual banking before clicking exits.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.values = {}; this.classes = new Set(); this.nodes = []; this.content = ''; }
}
function descendants(node) { return node.nodes.flatMap(child => [child, ...descendants(child)]); }
function matches(node, selector) {
  const id = selector.match(/#([\w-]+)/), cls = selector.match(/\.([\w-]+)/), tag = selector.match(/^[\w]+/);
  return (!id || node.attrs.id === id[1]) && (!cls || node.classes.has(cls[1])) && (!tag || node.tag === tag[0]);
}
function fixture(outfit = {}, capacity = 20) {
  const root = new Element('body');
  const records = [], notices = [];
  const state = { stores: {}, outfit, character: {}, game: {} };
  class Query {
    constructor(nodes) { this.nodes = nodes; this.length = nodes.length; }
    find(selector) {
      let found = this.nodes;
      for (const part of selector.split(/\s+/)) found = found.flatMap(descendants).filter(node => matches(node, part));
      return new Query(found);
    }
    children(selector) { return new Query(this.nodes.flatMap(node => node.nodes).filter(node => !selector || matches(node, selector))); }
    parent() { return new Query(this.nodes.map(node => node.parent).filter(Boolean)); }
    appendTo(target) {
      const parent = $(target).nodes[0];
      if (!parent) return this;
      for (const node of this.nodes) {
        if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node);
        node.parent = parent; parent.nodes.push(node);
      }
      return this;
    }
    append(content) { $(content).appendTo(this); return this; }
    insertBefore(target) {
      const sibling = $(target).nodes[0], parent = sibling?.parent;
      if (!parent) return this;
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
    addClass(names) { for (const node of this.nodes) for (const name of names.split(' ')) node.classes.add(name); return this; }
    removeClass(names) { for (const node of this.nodes) for (const name of names.split(' ')) node.classes.delete(name); return this; }
    hasClass(name) { return !!this.nodes[0]?.classes.has(name); }
    text(value) {
      if (!arguments.length) return this.nodes.map(node => [node, ...descendants(node)].map(child => child.content).join('')).join('');
      this.empty(); for (const node of this.nodes) node.content = value; return this;
    }
    get() { return this.nodes; }
    first() { return new Query(this.nodes.slice(0, 1)); }
    each(callback) { this.nodes.forEach((node, index) => callback.call(node, index)); return this; }
    remove() { for (const node of this.nodes) { if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); node.parent = null; } return this; }
    click(callback) {
      if (callback) { for (const node of this.nodes) node.click = callback; }
      else for (const node of this.nodes) if (!node.classes.has('disabled')) node.click?.call(node, { stopPropagation() {} });
      return this;
    }
    animate(properties, duration, easing, callback) {
      if (callback) for (const node of this.nodes) callback.call(node);
      return this;
    }
    css() { return this; }
    focus() { return this; }
    mouseenter() { return this; }
    val() { return ''; }
  }
  function $(selector, context) {
    if (selector instanceof Query) return selector;
    if (selector instanceof Element) return new Query([selector]);
    if (typeof selector === 'string' && selector.startsWith('<')) return new Query([new Element(selector.match(/^<(\w+)/)[1])]);
    if (selector === 'body') return new Query([root]);
    return (context ? $(context) : new Query([root])).find(selector);
  }
  $('<div>').attr('id', 'wrapper').appendTo($(root));
  const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
  const sm = {
    get(key, zero) { let value = state; for (const part of parts(key)) value = value && value[part]; return value == null && zero ? 0 : value; },
    set(key, value) { const keys = parts(key); let object = state; for (const part of keys.slice(0, -1)) object = object[part] || (object[part] = {}); object[keys.at(-1)] = value; },
    add(key, amount) { sm.set(key, sm.get(key, true) + amount); },
    addM(key, values) { for (const item in values) sm.add(key + '["' + item + '"]', values[item]); },
    hasPerk() { return false; }
  };
  const c = {
    $, $SM: sm, _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]),
    Engine: { options: {}, event() {}, log() {}, setTimeout(callback) { callback(); }, activeModule: null },
    World: { updateSupplies() {} }, Notifications: { notify(_, text) { notices.push(text); } },
    Prestige: { getBonus() { return 0; }, recordKill() {} },
    AudioEngine: { stopEventMusic() {} }, clearInterval() {}, clearTimeout() {},
    CastleReport: { recordMaterial(...record) { records.push(record); }, recordKill() {} },
    Button: {
      Button: function(options) {
        const button = $('<div>').attr('id', options.id).addClass('button');
        $('<span>').text(options.text).appendTo(button); $('<div>').addClass('cooldown').appendTo(button);
        return button.click(function() { options.click($(this)); });
      },
      cooldown() {},
      setDisabled(button, disabled = true) { button[disabled ? 'addClass' : 'removeClass']('disabled'); }
    }
  };
  c.window = c;
  vm.createContext(c);
  for (const file of ['path.js', 'events.js', 'space.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), c);
  c.Engine.activeModule = c.Space;
  c.Path.outfit = outfit;
  c.Path.getCapacity = () => capacity;
  c.Space.currentFloor = 10;
  c.Space._pickEnemy = () => ({ enemy: 'test demon', dmg: 5, hit: 1, delay: 1, hp: 10 });
  c.Space._applyPotion = value => value;
  c.Space._pickBloodArts = () => [];
  const fixedLoot = () => ({ scales: { min: 6, max: 6, chance: 1 }, medicine: { min: 3, max: 3, chance: 1 } });
  c.Space._battleLoot = c.Space._bossLoot = fixedLoot;
  c.Space.afterBattle = () => { c.finished = (c.finished || 0) + 1; };
  c.Space._afterBossBattle = c.Space.afterBattle;
  c.Space._ambushEnd = () => { c.finished = (c.finished || 0) + 1; };
  c.Space.incMetaBossKilled = () => {};
  c.Events.eventStack = [];
  c.Events.startCombat = () => {
    c.Events.won = false; c.Events.fought = false;
    $('<div>').attr('id', 'enemy').appendTo($('#description', c.Events.eventPanel()));
  };
  c.Events.removePause = () => {};
  const win = () => { c.Events.won = true; c.Events.winFight(); };
  const click = id => $('#' + id, c.Events.eventPanel()).click();
  const take = key => $('#take_' + key.replace(/ /g, '-'), c.Events.eventPanel());
  return { c, sm, state, $, records, notices, win, click, take };
}

const start = (c, kind) => {
  if (kind === 'boss') c.Space.triggerBossFight();
  else if (kind === 'ambush') { c.Space._ambushRemaining = 1; c.Space._ambushNext(); }
  else c.Space.triggerBattle(kind === 'elite');
};
for (const kind of ['ordinary', 'elite', 'boss', 'ambush']) {
  for (const action of ['bank', 'continue', ...(kind === 'boss' ? ['recraft'] : [])]) {
    const f = fixture(); start(f.c, kind);
    f.c.Space._collectRemainingLoot();
    assert.deepEqual(f.state.stores, {}, 'live enemies cannot be banked');
    f.win();
    f.c.Events.getLoot(f.take('medicine'));
    assert.equal(f.c.Path.outfit.medicine, 1);
    f.click(action === 'bank' ? 'bankLoot' : action === 'recraft' ? 'recraft' : kind === 'ambush' ? 'next' : 'continue');
    assert.equal(f.state.stores.scales, 6, kind + ' banks raw materials through the real button');
    assert.equal(f.state.stores.medicine, 2, 'only unpicked medicine is banked');
    assert.equal(f.c.Path.outfit.medicine, 1, 'manual pickup stays in the backpack');
    const expected = JSON.stringify(f.state.stores);
    f.c.Space._collectRemainingLoot();
    assert.equal(JSON.stringify(f.state.stores), expected, 'repeated completion cannot duplicate loot');
    assert.equal(f.records.filter(record => record[0] === 'banked' && record[1] === 'scales').length, 1);
    if (action === 'bank') {
      assert.equal(f.c.Events.activeScene, 'start');
      assert.ok(f.c.Events.activeEvent(), 'bank-only keeps the result screen open');
      assert.equal(f.take('scales').length, 0, 'banked rows no longer advertise backpack pickup');
      assert.equal(f.$('#loot_takeEverything', f.c.Events.eventPanel()).hasClass('disabled'), true);
      const newLoot = f.c.Events.drawLootRow('scales', 2);
      newLoot.appendTo(f.$('#lootButtons', f.c.Events.eventPanel()));
      f.c.Events.updateButtons(); f.click('bankLoot');
      assert.equal(f.state.stores.scales, 8, 'new ground loot after a bank-only action can still be banked');
      assert.equal(f.c.finished || 0, 0, 'bank-only does not grant talents or advance floors');
    } else if (action === 'recraft') {
      assert.equal(f.c.Events.activeScene, 'recraft', 'boss materials reach home before the merchant scene replaces loot rows');
    } else {
      assert.equal(f.c.Events.activeEvent(), null);
      assert.equal(f.c.finished, 1, 'the original post-battle transition remains exactly once');
    }
  }
  const f = fixture({ medicine: 1 }, 3);
  f.sm.set('character.loadouts.castle', { targets: { medicine: 3 } });
  start(f.c, kind); f.win(); f.click('collectConfigured');
  assert.equal(f.c.Path.outfit.medicine, 3, kind + ' refills the saved castle target');
  assert.equal(f.state.stores.scales, 6);
  assert.equal(f.state.stores.medicine, 1);
  assert.equal(f.c.finished, 1);
  assert.equal(f.c.Events.activeEvent(), null);
  const full = fixture({ torch: 1 }, 1);
  start(full.c, kind); full.win(); full.click('bankLoot');
  assert.deepEqual(full.c.Path.outfit, { torch: 1 }, 'a full backpack is never changed by banking');
  assert.equal(full.state.stores.scales, 6, kind + ' can bank materials even when the backpack is full');
  assert.equal(full.state.stores.medicine, 3);
}

// A stale/background event with identical loot IDs must never contribute rewards.
{
  const f = fixture(); start(f.c, 'boss'); f.win();
  const background = f.$('<div>').attr('id', 'background').appendTo(f.$('body'));
  const loot = f.$('<div>').attr('id', 'lootButtons').appendTo(background);
  f.c.Events.drawLootRow('iron', 99).appendTo(loot);
  f.click('bankLoot');
  assert.equal(f.state.stores.iron || 0, 0, 'banking is scoped to the current victory panel');
  f.c.Engine.activeModule = f.c.Path;
  f.c.Space._collectRemainingLoot();
  assert.equal(f.state.stores.iron || 0, 0, 'banking is unavailable outside the castle');
}
for (const rounds of [3, 4, 5]) {
  const f = fixture();
  f.c.Space._ambushRemaining = rounds;
  f.c.Space._ambushNext();
  for (let round = 0; round < rounds; round++) { f.win(); f.click('next'); }
  assert.equal(f.state.stores.scales, rounds * 6, 'every ambush battle banks its own materials');
  assert.equal(f.state.stores.medicine, rounds * 3);
  assert.equal(f.c.finished, 1);
  assert.equal(f.c.Events.activeEvent(), null);
}
console.log('PASS: real ordinary/elite/boss/ambush victories bank remaining loot, preserve manual/configured pickups, refresh bank-only rows, and prevent duplicate/background rewards.');
