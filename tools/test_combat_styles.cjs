const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let now = 1000;
let timerId = 0;
const timers = new Map();
const state = {};
const perks = new Set();
let healed = 0;
let wins = 0;
const nodes = [];
function node() {
  const result = { attrs: {}, classes: new Set(), props: {}, data: {}, children: [], handlers: {}, text: '' };
  nodes.push(result);
  return result;
}
const enemyNode = node(); enemyNode.attrs.id = 'enemy';
const playerNode = node(); playerNode.attrs.id = 'wanderer';
function match(el, selector) {
  return selector[0] === '.' ? el.classes.has(selector.slice(1)) : el.attrs.id === selector.slice(1);
}
function selection(items) {
  const result = {
    length: items.length,
    get: index => items[index],
    attr(key, value) {
      if (typeof key === 'object') { items.forEach(el => Object.assign(el.attrs, key)); return result; }
      if (value === undefined) return items[0]?.attrs[key];
      items.forEach(el => { el.attrs[key] = value; }); return result;
    },
    prop(key, value) { items.forEach(el => { el.props[key] = value; }); return result; },
    data(key, value) {
      if (value === undefined) return items[0]?.data[key];
      items.forEach(el => { el.data[key] = value; }); return result;
    },
    addClass(classes) { items.forEach(el => classes.split(' ').forEach(c => el.classes.add(c))); return result; },
    toggleClass(c, on) { items.forEach(el => on ? el.classes.add(c) : el.classes.delete(c)); return result; },
    text(value) { if (value === undefined) return items[0]?.text; items.forEach(el => { el.text = value; }); return result; },
    appendTo(parent) { const target = $(parent).get(0); items.forEach(el => { target.children.push(el); el.parent = target; }); return result; },
    find(selector) {
      const found = [];
      const walk = el => el.children.forEach(child => { if (match(child, selector)) found.push(child); walk(child); });
      items.forEach(walk); return selection(found);
    },
    remove() { items.forEach(el => { if (el.parent) el.parent.children = el.parent.children.filter(child => child !== el); el.removed = true; }); return result; },
    on(event, handler) { items.forEach(el => { el.handlers[event] = handler; }); return result; }
  };
  return result;
}
function $(arg) {
  if (arg?.get) return arg;
  if (typeof arg !== 'string') return selection(arg ? [arg] : []);
  if (arg[0] === '<') return selection([node()]);
  return selection(nodes.filter(el => !el.removed && match(el, arg)));
}
const scene = { combat: true };
let activeScene = scene;
const Space = { addMetaHealed: amount => { healed += amount; } };
const Engine = {
  activeModule: {}, options: {},
  combatSetInterval(callback, ms) {
    const id = ++timerId;
    const interval = ms / (Engine.options.testerMode ? Engine.options.combatTimeScale || 1 : 1);
    timers.set(id, { callback, interval, at: now + interval });
    return id;
  }
};
const World = {
  health: 70,
  getMaxHealth: () => 100,
  setHp: hp => { World.health = hp; },
  Weapons: {
    'nichirin katana': { type: 'melee', damage: 6 },
    'nichirin spear': { type: 'melee', damage: 8 },
    'flame blade': { type: 'melee', damage: 10 },
    'bone yari': { type: 'melee', damage: 2 },
    'wisteria gun': { type: 'ranged', damage: 5 },
    'bind kunai': { type: 'ranged', damage: 'stun' }
  }
};
const Events = {
  won: false, fought: false, activeScene: 'start',
  activeEvent: () => ({ scenes: { start: activeScene } }),
  updateFighterDiv() {}, drawFloatText() {}, setHeal() {},
  dotDamage(target, damage) {
    target.data('hp', Math.max(0, target.data('hp') - damage));
    if (target.data('hp') <= 0 && !Events.won) { Events.won = true; wins++; }
  }
};
const context = {
  $, Engine, Space, World, Events,
  _: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, index) => args[index]),
  $SM: { get: key => state[key], set: (key, value) => { state[key] = value; }, hasPerk: perk => perks.has(perk) },
  Date: { now: () => now },
  clearInterval: id => timers.delete(id)
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/combat_styles.js'), 'utf8'), context);
const styles = context.CombatStyles;
const enemy = $('#enemy');
function advance(ms) {
  const end = now + ms;
  for (;;) {
    const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    now = due[1].at;
    due[1].at += due[1].interval;
    due[1].callback();
  }
  now = end;
}
function start(id) {
  styles.endFight();
  Engine.activeModule = {};
  assert.equal(styles.setSelected(id), true);
  Engine.activeModule = Space;
  Events.won = Events.fought = false;
  World.health = 70;
  enemy.data('hp', 200).data('stunned', false);
  activeScene = scene;
  styles.startFight(scene);
}

assert.equal(styles.getSelected(), 'technique');
assert.equal(styles.setSelected('water'), false, 'existing proficiency must unlock water');
assert.equal(styles.setSelected('unknown'), false);
const pickerParent = node();
styles.renderPicker(pickerParent);
let options = $(pickerParent).find('.castleStyleOption');
assert.equal(options.length, 4);
assert.equal(options.get(1).props.disabled, true, 'locked forms cannot be selected');
assert.match(selection(options.get(1).children).text(), /water/);
perks.add('water breath I'); perks.add('flame breath I'); perks.add('thunder breath I');
styles.renderPicker(pickerParent);
options = $(pickerParent).find('.castleStyleOption');
options.get(1).handlers.click();
assert.equal(styles.getSelected(), 'water', 'visible selector saves the chosen form');
assert.equal($(pickerParent).find('.castleStylePicker').length, 1, 'redraw replaces the prior picker');
assert.equal(styles.getName(), 'water form');

start('water');
assert.equal(styles.setSelected('flame'), false, 'cannot change form while inside the castle');
styles.afterHit('nichirin katana', 0, enemy);
styles.afterHit('wisteria gun', 10, enemy);
assert.equal(styles._fight.combo, 0, 'only melee hits that remove HP build flow');
styles.afterHit('nichirin katana', 10, enemy);
advance(2000);
styles.afterHit('nichirin katana', 10, enemy);
advance(2000);
styles.afterHit('nichirin katana', 10, enemy);
assert.equal(World.health, 74);
assert.equal(healed, 4, 'actual recovery contributes to permanent healing progress');
assert.equal(styles.modifyIncoming(20), 17);
advance(4001);
assert.equal(styles.modifyIncoming(20), 20, 'guard expires');
styles.afterHit('nichirin katana', 10, enemy);
advance(6001);
styles.afterHit('nichirin katana', 10, enemy);
assert.equal(styles._fight.combo, 1, 'long gaps reset the chain');
World.health = 99;
styles.afterHit('nichirin katana', 10, enemy);
styles.afterHit('nichirin katana', 10, enemy);
assert.equal(World.health, 100);
assert.equal(healed, 5, 'overhealing does not award permanent progress');

start('thunder');
assert.equal(styles.modifyAttack('nichirin katana', 10), 16);
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 10), 16, 'blocked damage does not spend charge');
assert.equal(styles.modifyAttack('wisteria gun', 10), 10);
styles.afterHit('wisteria gun', 10, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 10), 16, 'ranged fire leaves charge ready');
styles.afterHit('nichirin katana', 16, enemy);
advance(3999);
assert.equal(styles.modifyAttack('nichirin katana', 10), 10);
advance(1);
assert.equal(styles.modifyAttack('nichirin katana', 10), 16);
styles.afterHit('nichirin katana', 16, enemy);
advance(2000);
styles.afterHit('nichirin katana', 10, enemy);
advance(2000);
assert.equal(styles.modifyAttack('nichirin katana', 10), 10, 'early melee hits restart gathering breath');

start('technique');
assert.equal(styles.cooldownMultiplier('bind kunai'), 0.8);
assert.equal(styles.cooldownMultiplier('nichirin katana'), 1);
styles.afterControl('bind kunai', enemy);
assert.equal(styles.modifyAttack('nichirin katana', 20), 20, 'missed control creates no opening');
enemy.data('stunned', true);
styles.afterControl('bind kunai', enemy);
assert.equal(styles.modifyAttack('nichirin katana', 20), 27);
assert.equal(styles.modifyAttack('wisteria gun', 20), 27);
advance(4000);
assert.equal(styles.modifyAttack('nichirin katana', 20), 20);

start('flame');
styles.afterHit('wisteria gun', 100, enemy);
styles.afterHit('bone yari', 100, enemy);
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(timers.size, 0, 'invalid, blocked and non-nichirin hits cannot leave cuts');
styles.afterHit('nichirin katana', 100, enemy);
advance(1000);
assert.equal(enemy.data('hp'), 182);
styles.afterHit('flame blade', 50, enemy);
assert.equal(timers.size, 1, 'cuts refresh instead of stacking timers');
advance(3000);
assert.equal(enemy.data('hp'), 155, 'refreshed cut deals three ticks of the latest hit');
assert.equal(timers.size, 0);
styles.afterHit('nichirin spear', 100, enemy);
enemy.data('hp', 10);
advance(1000);
assert.equal(enemy.data('hp'), 0);
assert.equal(wins, 1, 'a fatal cut resolves combat victory');
assert.equal(timers.size, 0, 'winning clears the cut timer');

start('flame');
styles.afterHit('nichirin katana', 100, enemy);
styles.renderStatus(pickerParent);
assert.equal(timers.size, 2);
styles.endFight();
assert.equal(timers.size, 0, 'endFight clears both damage and status timers');
advance(5000);
assert.equal(enemy.data('hp'), 200, 'closed fights cannot keep dealing damage');
start('flame');
styles.afterHit('nichirin katana', 100, enemy);
activeScene = { combat: true };
advance(1000);
assert.equal(enemy.data('hp'), 200, 'scene identity prevents damage leaking to later fights');
assert.equal(timers.size, 0);
start('thunder');
styles.afterHit('nichirin katana', 16, enemy);
styles.startFight(scene);
assert.equal(styles.modifyAttack('nichirin katana', 10), 16, 'new fights begin with clean temporary state');
Engine.activeModule = {};
assert.equal(styles.modifyAttack('nichirin katana', 10), 10, 'forms do not affect the overworld');
assert.equal(styles.cooldownMultiplier('bind kunai'), 1);
styles.endFight();
Engine.options = { testerMode: true, combatTimeScale: 4 };
start('thunder');
styles.afterHit('nichirin katana', 16, enemy);
advance(999);
assert.equal(styles.modifyAttack('nichirin katana', 10), 10);
advance(1);
assert.equal(styles.modifyAttack('nichirin katana', 10), 16, 'charge uses combat speed');
styles.endFight();

console.log('PASS: selectable/locked forms; water actual-hit healing and guard; thunder charge; control openings; cut refresh, fatal ticks and scene cleanup; overworld isolation and combat speed.');
