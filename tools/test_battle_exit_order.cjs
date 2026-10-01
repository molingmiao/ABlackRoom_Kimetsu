const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real victory renderer and hotkey/loot wiring with a small DOM fixture.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.values = {}; this.classes = new Set(); this.nodes = []; this.content = ''; }
}
function descendants(node) { return node.nodes.flatMap(child => [child, ...descendants(child)]); }
function matches(node, selector) {
  return selector.startsWith('#') ? node.attrs.id === selector.slice(1) : selector.startsWith('.') ? node.classes.has(selector.slice(1)) : node.tag === selector;
}
function fixture(scene, outfit = {}, castle = false, canTakeEverything = true) {
  const root = new Element('div');
  const calls = { ended: 0, loaded: [], clicked: [], healed: [], cooldown: [], lootTaken: 0, kills: 0, bossKills: 0 };
  class Query {
    constructor(nodes) { this.nodes = nodes; this.length = nodes.length; }
    find(selector) {
      const [parentSelector, childSelector] = selector.split(/\s*>\s*/);
      const candidates = this.nodes.flatMap(descendants).filter(node => matches(node, parentSelector));
      return new Query(childSelector ? candidates.flatMap(node => node.nodes).filter(node => matches(node, childSelector)) : candidates);
    }
    children(selector) { return new Query(this.nodes.flatMap(node => node.nodes).filter(node => !selector || matches(node, selector))); }
    appendTo(target) {
      const parent = $(target).nodes[0];
      for (const node of this.nodes) {
        if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node);
        node.parent = parent; parent.nodes.push(node);
      }
      return this;
    }
    empty() { for (const node of this.nodes) { for (const child of node.nodes) child.parent = null; node.nodes = []; node.content = ''; } return this; }
    attr(key, value) {
      if (typeof key === 'object') { for (const node of this.nodes) Object.assign(node.attrs, key); return this; }
      if (arguments.length === 1) return this.nodes[0]?.attrs[key];
      for (const node of this.nodes) node.attrs[key] = value; return this;
    }
    data(key, value) { if (arguments.length === 1) return this.nodes[0]?.values[key]; for (const node of this.nodes) node.values[key] = value; return this; }
    addClass(name) { for (const node of this.nodes) for (const item of name.split(' ')) node.classes.add(item); return this; }
    hasClass(name) { return !!this.nodes[0]?.classes.has(name); }
    text(value) {
      if (!arguments.length) return this.nodes.map(node => [node, ...descendants(node)].map(child => child.content).join('')).join('');
      for (const node of this.nodes) node.content = value; return this;
    }
    get() { return this.nodes; }
    first() { return new Query(this.nodes.slice(0, 1)); }
    each(callback) { this.nodes.forEach((node, index) => callback.call(node, index)); return this; }
    remove() { for (const node of this.nodes) if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); return this; }
    click() { for (const node of this.nodes) if (!node.classes.has('disabled')) node.click?.($(node)); return this; }
    animate(properties, duration, easing, callback) { callback(); return this; }
  }
  function $(selector, context) {
    if (selector instanceof Query) return selector;
    if (selector instanceof Element) return new Query([selector]);
    if (typeof selector === 'string' && selector.startsWith('<')) return new Query([new Element(selector.match(/^<(\w+)/)[1])]);
    return (context ? $(context) : new Query([root])).find(selector);
  }
  const panel = $('<div>').appendTo($(root));
  $('<div>').attr('id', 'description').appendTo(panel);
  $('<div>').attr('id', 'buttons').appendTo(panel);
  $('<div>').attr('id', 'enemy').appendTo(panel);
  const context = {
    $, _: text => text,
    Path: { outfit }, World: {}, Space: { incMetaBossKilled() { calls.bossKills++; } },
    Engine: { setTimeout(callback) { callback(); } },
    Prestige: { recordKill() { calls.kills++; } },
    $SM: { add() { throw new Error('Button reordering must not change resources or progression'); } },
    Button: {
      Button: function(options) {
        const button = $('<div>').attr('id', options.id).addClass('button');
        $('<span>').text(options.text).appendTo(button);
        button.nodes[0].click = options.click;
        return button;
      },
      cooldown(button) { calls.cooldown.push(button.attr('id')); },
      setDisabled(button, disabled) { if (disabled) button.addClass('disabled'); }
    }
  };
  context.window = context;
  context.Engine.activeModule = castle ? context.Space : context.World;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/events.js'), 'utf8'), context);
  const events = context.Events;
  events.activeEvent = () => ({ scenes: { start: scene } }); events.activeScene = 'start';
  events.eventPanel = () => panel;
  events.endFight = () => { events.fought = true; };
  events.updateButtons = () => {};
  events.setHeal = () => {};
  events.endEvent = () => { calls.ended++; };
  events.loadScene = name => calls.loaded.push(name);
  events.buttonClick = button => calls.clicked.push(button.attr('id'));
  events.takeAll = () => { calls.lootTaken++; };
  for (const [method, id] of [['createEatMeatButton', 'eat'], ['createUseMedsButton', 'meds'], ['createUseHypoButton', 'hypo']]) {
    events[method] = cooldown => {
      assert.equal(cooldown, 0, 'post-combat healing retains its existing no-cooldown setup');
      return new context.Button.Button({ id, text: id, click: () => calls.healed.push(id) });
    };
  }
  events.drawLoot = () => {
    const loot = $('<div>').attr('id', 'lootButtons').appendTo($('#description', panel));
    const row = $('<div>').addClass('lootRow').appendTo(loot);
    $('<div>').addClass('lootTakeAll').appendTo(row);
    return new context.Button.Button({ id: 'loot_takeEverything', text: 'take everything', click: events.takeEverything })
      .data('canTakeEverything', canTakeEverything).appendTo(loot);
  };
  return { events, calls, panel, $, children: () => $('#buttons', panel).children().get().map(node => node.attrs.id) };
}

for (const outfit of [{}, { medicine: 2, 'wisteria oil': 1 }]) {
  const before = JSON.stringify(outfit);
  const f = fixture({ deathMessage: 'victory', loot: {} }, outfit);
  f.events.winFight();
  assert.deepEqual(f.children(), ['healButtons', 'exitButtons'], 'leaving is the final action group, after every treatment');
  const heals = f.$('#healButtons', f.panel).children('.button');
  assert.deepEqual(heals.get().map(node => node.attrs.id), outfit.medicine ? ['eat', 'meds', 'hypo'] : ['eat']);
  assert.deepEqual(heals.get().map(node => node.attrs['data-hotkey']), outfit.medicine ? ['1', '2', '3'] : ['1']);
  heals.each(function() { f.$(this).click(); });
  assert.equal(f.calls.healed.length, heals.length, 'the original treatment callbacks remain attached');
  const take = f.$('#loot_takeEverything', f.panel), leave = f.$('#leaveBtn', f.panel);
  assert.equal(take.data('leaveBtn').get()[0], leave.get()[0], 'loot retains the identical moved leave button');
  assert.equal(take.data('canLeave'), true);
  assert.equal(take.children('span').text(), 'take everything and leave');
  take.click();
  assert.equal(f.calls.lootTaken, 1); assert.equal(f.calls.ended, 1, 'take everything still leaves in one click');
  assert.equal(JSON.stringify(outfit), before, 'rendering changes no supplies');
  f.events.winFight();
  assert.deepEqual(f.children(), ['healButtons', 'exitButtons'], 'a duplicate win callback adds no buttons');
}

{
  const f = fixture({ nextScene: 'after', deathMessage: 'victory' });
  f.events.winFight(); f.$('#leaveBtn', f.panel).click();
  assert.deepEqual(f.calls.loaded, ['after'], 'the leave button still advances a chained battle scene');
  assert.equal(f.calls.ended, 0);
}
{
  const f = fixture({ deathMessage: 'victory' }, {}, false, false);
  f.events.winFight(); f.$('#loot_takeEverything', f.panel).click();
  assert.equal(f.calls.ended, 0, 'a full backpack must not automatically leave after partial pickup');
  assert.equal(f.calls.lootTaken, 1);
}
for (const buttons of [
  { continue: { text: 'continue down', cooldown: 1 } },
  { continue: { text: 'continue down', cooldown: 1 }, recraft: { text: 'recraft supplies' } }
]) {
  const f = fixture({ deathMessage: 'victory', castleBoss: true, buttons }, { medicine: 2 }, true);
  f.events.winFight();
  assert.deepEqual(f.children(), ['exitButtons'], 'castle custom choices do not gain unrelated treatment controls');
  assert.deepEqual(f.$('#exitButtons', f.panel).children('.button').get().map(node => node.attrs.id), Object.keys(buttons));
  assert.equal(f.calls.bossKills, 1);
  const take = f.$('#loot_takeEverything', f.panel);
  assert.equal(take.data('canLeave'), Object.keys(buttons).length === 1, 'ambiguous castle choices never auto-select a route');
  f.$('#continue', f.panel).click(); assert.deepEqual(f.calls.clicked, ['continue']);
}
{
  const f = fixture({ text: ['a story'], buttons: { leave: { text: 'leave' }, stay: { text: 'stay' } } });
  f.events.startStory(f.events.activeEvent().scenes.start);
  assert.deepEqual(f.children(), ['exitButtons']);
  assert.deepEqual(f.$('#exitButtons', f.panel).children('.button').get().map(node => node.attrs.id), ['leave', 'stay'], 'non-combat story ordering remains unchanged');
}
console.log('PASS: victory treatment precedes leaving, healing hotkeys and callbacks survive, take-all-and-leave/backpack guards stay intact, and custom castle/story choices are unchanged.');
