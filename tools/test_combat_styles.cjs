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
function readState(key) {
  if (Object.hasOwn(state, key)) return state[key];
  const fields = key.replace(/\["([^"\]]+)"\]/g, '.$1').split('.');
  for (let split = fields.length - 1; split > 0; split--) {
    const prefix = fields.slice(0, split).join('.');
    if (Object.hasOwn(state, prefix)) return fields.slice(split).reduce((value, field) => value?.[field], state[prefix]);
  }
  return fields.reduce((value, field) => value?.[field], state);
}
const Space = {
  addMetaHealed: amount => { healed += amount; },
  getTalentLevel: id => (state['character.infinityTalents'] || {})[id] || 0,
  getTalentCap: () => 20,
  getTotalFloors: () => readState('game.castleMeta.totalFloors') || 0
};
const Engine = {
  activeModule: {}, options: {},
  combatSetInterval(callback, ms) {
    const id = ++timerId;
    const interval = ms / (Engine.options.testerMode ? Engine.options.combatTimeScale || 1 : 1);
    timers.set(id, { callback, interval, at: now + interval });
    return id;
  },
  combatSetTimeout(callback, ms) {
    const id = ++timerId;
    const delay = ms / (Engine.options.testerMode ? Engine.options.combatTimeScale || 1 : 1);
    timers.set(id, { callback, interval: 0, at: now + delay });
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
    'nichirin blade flame': { type: 'melee', damage: 12, nichirinForged: true, breathingStyle: 'flame', tier: 4 },
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
  $SM: { get: readState, set: (key, value) => { state[key] = value; }, hasPerk: perk => perks.has(perk) },
  Date: { now: () => now },
  clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id)
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/combat_styles.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/breathing_cultivation.js'), 'utf8'), context);
const styles = context.CombatStyles;
const enemy = $('#enemy');
function advance(ms) {
  const end = now + ms;
  for (;;) {
    const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    now = due[1].at;
    if (due[1].interval) due[1].at += due[1].interval;
    else timers.delete(due[0]);
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
assert.equal(options.length, 15, 'the selector includes the original technique and fourteen breathing lineages');
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
styles.afterHit('nichirin blade flame', 50, enemy);
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

// Keep progression/levels isolated from the legacy tests above: their original
// four forms must retain exactly the same values at zero cultivation levels.
Engine.options = {};
state['character.infinityTalents'] = {};
const campaignFlags = ['game.yoshiwaraDone', 'game.swordsmithVillageDone', 'game.pillarConvocationDone'];
function progression(floors = 0, bosses = 0) {
  campaignFlags.forEach(flag => { state[flag] = false; });
  state['game.world.map'] = [];
  state['game.castleMeta'] = { totalFloors: floors, bossKilled: bosses };
}
const newLineages = [
  ['beast', 5, 'game.yoshiwaraDone'], ['insect', 10],
  ['sound', 20, 'game.yoshiwaraDone'], ['mist', 25, 'game.swordsmithVillageDone'],
  ['wind', 30, 'game.pillarConvocationDone'], ['stone', 35, 'game.pillarConvocationDone'],
  ['flower', 40], ['love', 45, 'game.swordsmithVillageDone'], ['serpent', 50, 'game.pillarConvocationDone']
];
for (const [id, floor, flag] of newLineages) {
  assert.ok(styles.definition(id), 'the breathing library contains ' + id);
  progression(floor - 1);
  assert.equal(styles.isUnlocked(id), false, 'one floor below the practice threshold stays locked: ' + id);
  progression(floor);
  assert.equal(styles.isUnlocked(id), true, 'meeting the practice threshold unlocks ' + id);
  if (flag) {
    progression(); state[flag] = true;
    assert.equal(styles.isUnlocked(id), true, 'the corresponding campaign milestone also unlocks ' + id);
  }
}
progression();
state['game.world.map'] = [['.', 'M']];
assert.equal(styles.isUnlocked('insect'), false, 'finding the spider mountain without completing it does not unlock insect training');
state['game.world.map'] = [['.', 'M!']];
assert.equal(styles.isUnlocked('insect'), true, 'a completed spider mountain in the saved home map unlocks insect training');
state['game.world.map'] = null;
assert.equal(styles.isUnlocked('insect'), false, 'an absent/invalid map does not imply a completed story');
for (const [id, obsoleteFlag] of [['mist', 'game.swordsmithDone'], ['wind', 'game.hashiraTrained'], ['insect', 'game.natagumoDone']]) {
  progression(); state[obsoleteFlag] = true;
  assert.equal(styles.isUnlocked(id), false, 'nonexistent historical aliases cannot unlock a real campaign lineage: ' + id);
  delete state[obsoleteFlag];
}
for (const [id, floors, bosses] of [['sun', 80, 5], ['moon', 120, 8]]) {
  progression(floors, bosses);
  assert.equal(styles.isUnlocked(id), false, 'advanced sword study requires hashira training: ' + id);
  state['game.pillarConvocationDone'] = true;
  assert.equal(styles.isUnlocked(id), true);
  progression(floors - 1, bosses); state['game.pillarConvocationDone'] = true;
  assert.equal(styles.isUnlocked(id), false, 'advanced forms require both practice and victories: ' + id);
  progression(floors, bosses - 1); state['game.pillarConvocationDone'] = true;
  assert.equal(styles.isUnlocked(id), false, 'advanced forms cannot skip the boss threshold: ' + id);
}
progression(200, 10);
campaignFlags.forEach(flag => { state[flag] = true; });
function strike(weapon = 'nichirin katana', damage = 100) {
  const dealt = styles.modifyAttack(weapon, damage);
  styles.afterHit(weapon, dealt, enemy);
  return dealt;
}

start('wind');
assert.equal(strike(), 100);
assert.equal(strike(), 108);
assert.equal(strike(), 116);
assert.equal(strike(), 124);
assert.equal(styles.modifyAttack('nichirin katana', 100), 132, 'four continuous wind hits build four blade-pressure layers');
assert.equal(styles.modifyAttack('wisteria gun', 100), 100, 'wind blade pressure only empowers melee');
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 132, 'wind pressure does not stack past four layers');
advance(4001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'wind pressure expires across a long attack gap');

start('stone');
assert.equal(styles.modifyIncoming(100), 88, 'stone training reduces direct damage');
for (let i = 0; i < 3; i++) { styles.afterIncoming(0); styles.afterIncoming(10, { dot: true }); }
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'blocked blows and DOT cannot farm stone counter charges');
for (let i = 0; i < 3; i++) styles.afterIncoming(10);
assert.equal(styles.modifyAttack('nichirin katana', 100), 150, 'three real direct hits arm a stone counter');
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 150, 'a blocked counter is not consumed');
assert.equal(styles.modifyAttack('wisteria gun', 100), 100, 'a ranged shot cannot use the melee counter');
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'a landed counter consumes only one prepared strike');

start('mist');
assert.equal(styles.modifyIncoming(100), 60, 'mist starts with its evasive window ready');
styles.afterIncoming(0);
assert.equal(styles.modifyIncoming(100), 60, 'a shielded/zero-damage attack does not consume mist evasion');
styles.afterIncoming(5, { dot: true });
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'bleeding cannot manufacture a mist counter window');
assert.equal(styles.modifyIncoming(100), 60, 'bleeding does not consume direct-hit evasion');
styles.afterIncoming(60);
assert.equal(styles.modifyIncoming(100), 100);
assert.equal(styles.modifyAttack('nichirin katana', 100), 125, 'real incoming damage opens a short mist counter window');
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 125);
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'mist counter is used by one landed melee hit');
advance(7999);
assert.equal(styles.modifyIncoming(100), 100);
advance(1);
assert.equal(styles.modifyIncoming(100), 60, 'mist recovers its evasion once every eight seconds');
styles.afterIncoming(60);
advance(3001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'mist counter expires after three seconds');

start('insect');
styles.afterHit('wisteria gun', 100, enemy);
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(timers.size, 0, 'poison requires a damaging melee thrust');
styles.afterHit('nichirin katana', 100, enemy);
advance(1000);
assert.equal(enemy.data('hp'), 185, 'the first insect dose adds 3% to its base 12% poison');
styles.afterHit('nichirin spear', 50, enemy);
assert.equal(timers.size, 1, 'new insect doses refresh one poison timer rather than stacking it');
advance(4000);
assert.equal(enemy.data('hp'), 149, 'a second dose lasts exactly four ticks of its updated actual-hit damage');
assert.equal(timers.size, 0);
start('insect'); enemy.data('hp', 1000);
for (let i = 0; i < 8; i++) styles.afterHit('nichirin katana', 100, enemy);
assert.equal(timers.size, 1);
advance(4000);
assert.equal(enemy.data('hp'), 892, 'insect dose strength caps at five and cannot create recursive poison strikes');
assert.equal(timers.size, 0);

start('sound');
assert.equal(strike('nichirin katana'), 100);
assert.equal(strike('nichirin spear'), 100);
assert.equal(styles.modifyAttack('wisteria gun', 100), 160, 'a third distinct damaging weapon completes the sound score');
styles.afterHit('wisteria gun', 0, enemy);
assert.equal(styles.modifyAttack('wisteria gun', 100), 160, 'missed/shielded notes do not consume the completed score');
strike('wisteria gun');
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'the three-note score resets after its finisher');
strike('nichirin katana'); strike('nichirin katana');
assert.equal(styles.modifyAttack('nichirin spear', 100), 100, 'repeating a weapon restarts the score at one note');
strike('nichirin spear');
advance(6001);
assert.equal(styles.modifyAttack('wisteria gun', 100), 100, 'long gaps break the sound score');

start('beast');
assert.equal(strike(), 100);
assert.equal(styles.modifyAttack('wisteria gun', 100), 100, 'beast change-ups are melee swordplay, not ranged shots');
assert.equal(strike('nichirin spear'), 135, 'changing melee weapons quickly powers a beast change-up');
assert.equal(styles.modifyAttack('nichirin spear', 100), 100, 'the same blade cannot trigger its own change-up');
advance(5001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'the beast change-up requires a recent melee hit');

start('flower');
styles.afterHit('wisteria gun', 100, enemy);
for (let i = 0; i < 3; i++) strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 160, 'three clean melee hits prepare flower insight');
styles.afterHit('nichirin katana', 0, enemy); styles.afterIncoming(0);
assert.equal(styles.modifyAttack('nichirin katana', 100), 160, 'blocked outgoing and incoming hits do not spend flower insight');
styles.afterIncoming(5, { dot: true });
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'any actual damage, including DOT, breaks the clean flower chain');
for (let i = 0; i < 3; i++) strike();
advance(6001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'flower insight expires if the next stroke is delayed');
for (let i = 0; i < 3; i++) strike();
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'a landed flower insight strike spends its preparation');

start('love');
for (const item of ['lifesteal', 'water style', 'nichirin color']) styles.afterHeal(10, item);
styles.afterHeal(0, 'medicine');
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'passive recovery and overhealing cannot trigger love protection');
assert.equal(styles.modifyIncoming(100), 100);
styles.afterHeal(10, 'medicine');
assert.equal(styles.modifyAttack('nichirin katana', 100), 125, 'real consumable healing opens love resolve');
assert.equal(styles.modifyIncoming(100), 85);
assert.equal(styles.modifyAttack('wisteria gun', 100), 100, 'love resolve only empowers melee');
advance(4001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100);
assert.equal(styles.modifyIncoming(100), 100, 'love protection expires after four seconds');

start('serpent');
styles.afterControl('bind kunai', enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'failed control does not create a serpent opening');
enemy.data('stunned', true); styles.afterControl('bind kunai', enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 140);
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 140, 'blocked strikes do not waste a serpent opening');
strike('wisteria gun');
assert.equal(strike(), 140);
assert.equal(strike(), 140);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'serpent control creates exactly two empowered melee strikes');
styles.afterControl('bind kunai', enemy);
advance(6001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'serpent openings have a six-second time limit');

start('sun');
styles.afterHit('wisteria gun', 100, enemy);
for (let i = 0; i < 3; i++) strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'sun dance still requires a fourth melee stroke');
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 130, 'four landed strokes open the sun dance window');
advance(4001);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'sun dance lasts four seconds');

start('moon');
assert.equal(styles.modifyAttack('nichirin katana', 100), 120, 'moon sword study starts with its spacing prepared');
assert.equal(styles.modifyAttack('wisteria gun', 100), 100);
styles.afterHit('nichirin katana', 0, enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 120, 'a blocked moon stroke does not consume preparation');
strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 100);
assert.equal(timers.size, 1, 'moon sword aftercuts use one bounded timer');
advance(3000);
assert.equal(enemy.data('hp'), 158, 'moon imitation leaves three physical aftercuts, each 12% of actual damage');
assert.equal(timers.size, 0);
advance(1999);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100);
advance(1);
assert.equal(styles.modifyAttack('nichirin katana', 100), 120, 'five seconds without a landed melee stroke restore moon spacing');
strike();
advance(2000); strike();
advance(3000);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'early melee attacks restart moon preparation even without aftercuts');

for (const id of ['insect', 'moon']) {
  start(id); strike(); styles.renderStatus(pickerParent);
  assert.ok(timers.size >= 2, 'a damaging lineage owns damage and status timers: ' + id);
  styles.endFight();
  assert.equal(timers.size, 0, 'closing a fight clears every cultivation timer: ' + id);
  advance(5000);
  assert.equal(enemy.data('hp'), 200, 'old aftercuts/poison cannot hit another fight: ' + id);
  start(id); strike(); styles.renderStatus(pickerParent);
  activeScene = { combat: true }; advance(1000);
  assert.equal(enemy.data('hp'), 200, 'changing scene identities cancels cultivation damage: ' + id);
  assert.equal(timers.size, 0);
}
for (const id of ['insect', 'moon']) {
  start(id); enemy.data('hp', 1);
  const previousWins = wins;
  strike(); advance(1000);
  assert.equal(enemy.data('hp'), 0);
  assert.equal(wins, previousWins + 1, 'fatal cultivation ticks settle combat victory exactly once: ' + id);
  assert.equal(timers.size, 0);
}
Engine.options = { testerMode: true, combatTimeScale: 4 };
start('moon'); strike(); advance(750);
assert.equal(enemy.data('hp'), 158, 'moon aftercut tick speed is scaled exactly once');
advance(499);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100);
advance(1);
assert.equal(styles.modifyAttack('nichirin katana', 100), 120, 'moon preparation follows tester combat time');
start('love'); styles.afterHeal(10, 'medicine'); advance(999);
assert.equal(styles.modifyAttack('nichirin katana', 100), 125);
advance(2);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'love protection follows tester combat time');
styles.endFight();
Engine.options = { testerMode: false, combatTimeScale: 4 };
start('moon'); strike(); advance(1250);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'ordinary games ignore stale tester speed settings');
styles.endFight();
Engine.options = {};
start('stone');
for (let i = 0; i < 3; i++) styles.afterIncoming(10);
Engine.activeModule = {};
assert.equal(styles.modifyAttack('nichirin katana', 100), 100, 'advanced forms never modify overworld attacks');
assert.equal(styles.modifyIncoming(100), 100, 'advanced forms never modify overworld defence');
styles.afterIncoming(10); styles.afterHeal(10, 'medicine');
assert.equal(timers.size, 0);
styles.endFight();

// Every form is tied to one of the original six saved talent IDs, not an
// expanded pool that would silently change the all-six breakthrough condition.
const trainingIds = ['hardBody', 'sharpEdge', 'ironWall', 'bloodDrink', 'steadyHand', 'swiftBlade'];
const signatureKey = {
  technique: 'opening', water: 'waterHeal', flame: 'cut', thunder: 'thunderBurst',
  wind: 'windStep', stone: 'stoneGuard', mist: 'mistGuard', insect: 'poison',
  sound: 'soundBurst', beast: 'beastBurst', flower: 'flowerBurst', love: 'loveBurst',
  serpent: 'serpentBurst', sun: 'sunBurst', moon: 'moonBurst'
};
for (const style of styles.STYLES) {
  Engine.activeModule = {};
  state['character.infinityTalents'] = {};
  assert.equal(styles.setSelected(style.id), true);
  assert.ok(trainingIds.includes(style.focus), 'every signature uses a compatible existing cultivation ID: ' + style.id);
  for (const id of trainingIds) {
    const name = styles.trainingName(id);
    assert.equal(typeof name, 'string');
    assert.ok(name.includes(styles.getName(style.id)), 'training labels include the selected lineage: ' + id);
    const preview = styles.trainingPreview(id, 0, 30);
    if (id !== style.focus) assert.equal(preview, '', 'unrelated cultivation does not promise a signature improvement');
    else {
      const key = signatureKey[style.id];
      const base = styles.parameters(style.id, 0)[key], improved = styles.parameters(style.id, 30)[key];
      assert.ok(improved > base, 'the focus improves its lineage signature: ' + style.id);
      assert.ok(preview.includes((base * 100).toFixed(3) + '%'), 'the preview includes the current signature value');
      assert.ok(preview.includes((improved * 100).toFixed(3) + '%'), 'the preview includes the next signature value');
    }
  }
  const base = styles.parameters(style.id, 0);
  state['character.infinityTalents'] = Object.fromEntries(trainingIds.map(id => [id, id === style.focus ? 0 : 30]));
  for (const key of Object.keys(base)) assert.equal(styles.parameters(style.id)[key], base[key], 'other training IDs do not inflate the signature: ' + style.id);
  state['character.infinityTalents'][style.focus] = 30;
  const override = styles.parameters(style.id, 30), improved = styles.parameters(style.id);
  for (const key of Object.keys(override)) assert.equal(improved[key], override[key], 'saved focus levels power live parameters: ' + style.id);
  for (const badLevel of [-1, NaN, Infinity, '30', 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    state['character.infinityTalents'][style.focus] = badLevel;
    assert.equal(styles.parameters(style.id)[signatureKey[style.id]], base[signatureKey[style.id]], 'invalid saved cultivation safely falls back to zero');
  }
}
const extreme = styles.parameters('wind', 1_000_000);
assert.ok(extreme.windStep < 0.12 && extreme.stoneGuard < 0.2 && extreme.mistGuard < 0.5, 'unbounded breakthrough levels cannot create invulnerable defensive signatures');
assert.ok(extreme.waterHeal < 0.08 && extreme.controlCooldown > 0.7 && extreme.thunderWait > 3.2, 'healing and cooldown improvements stay bounded');
assert.ok(Object.values(extreme).every(value => Number.isFinite(value) && value > 0), 'all signature parameters remain finite and positive');

state['character.infinityTalents'] = { sharpEdge: 30 };
start('wind');
for (let i = 0; i < 4; i++) strike();
assert.equal(styles.modifyAttack('nichirin katana', 100), 140, 'cultivation visibly improves wind from 32% to 40% four-layer damage');
styles.endFight();
state['character.infinityTalents'] = { bloodDrink: 30 };
start('water');
for (let i = 0; i < 3; i++) styles.afterHit('nichirin katana', 10, enemy);
assert.equal(World.health, 76, 'water cultivation increases real three-hit healing without changing the zero-level baseline');
assert.equal(styles.modifyIncoming(100), 80, 'water cultivation also strengthens its temporary guard');
styles.endFight();
state['character.infinityTalents'] = { swiftBlade: 30 };
start('thunder');
assert.equal(styles.modifyAttack('nichirin katana', 100), 175, 'thunder cultivation powers a stronger charged stroke');
styles.afterHit('nichirin katana', 175, enemy);
advance(3599);
assert.equal(styles.modifyAttack('nichirin katana', 100), 100);
advance(1);
assert.equal(styles.modifyAttack('nichirin katana', 100), 175, 'thunder cultivation shortens preparation to 3.6 combat seconds');
styles.endFight();
start('technique');
assert.equal(styles.cooldownMultiplier('bind kunai'), 0.75, 'rhythm cultivation improves technique control cooldown');
enemy.data('stunned', true); styles.afterControl('bind kunai', enemy);
assert.equal(styles.modifyAttack('nichirin katana', 100), 148, 'rhythm cultivation also strengthens its actual-control opening');
styles.endFight();
state['character.infinityTalents'] = { sharpEdge: 30 };
start('flame'); styles.afterHit('nichirin katana', 100, enemy);
advance(1000);
assert.equal(enemy.data('hp'), 177, 'flame cultivation increases its wound using actual landed damage');
styles.endFight();
assert.equal(timers.size, 0, 'all signature test fights leave no pending timers');

console.log('PASS: fourteen breathing lineages, campaign/practice unlocks, zero-level legacy balance, actual-hit/incoming/healing triggers, bounded combos/poison/aftercuts, fatal and stale-timer cleanup, overworld isolation and combat speed.');
