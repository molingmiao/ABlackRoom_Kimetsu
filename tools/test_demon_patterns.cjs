const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(options = {}) {
  let now = 0, id = 0, strikes = 0, hits = 0;
  const timers = new Map(), notices = [];
  function node(name) {
    const el = { length: 1, values: {}, attrs: {id: name}, children: [], classes: new Set(), content: '',
      get() { return el; },
      data(key, value) { if (arguments.length === 1) return el.values[key]; el.values[key] = value; return el; },
      attr(key, value) { if (typeof key === 'object') Object.assign(el.attrs, key); else if (arguments.length === 1) return el.attrs[key]; else el.attrs[key] = value; return el; },
      addClass(value) { el.classes.add(value); return el; }, removeClass(value) { el.classes.delete(value); return el; },
      appendTo(parent) { parent.children.push(el); return el; }, remove() { el.removed = true; return el; },
      text(value) { el.content = value; return el; }
    };
    return el;
  }
  const enemy = node('enemy').data('hp', 200).data('maxHp', 300).data('status', 'none');
  const player = node('wanderer').data('hp', 160).data('maxHp', 160).data('status', 'none');
  const panel = node('panel');
  panel.find = selector => selector === '#enemy' ? enemy : player;
  const Space = { currentFloor: 61, getDamageMult: () => 1, getLifestealPct: () => 0, getHealMult: () => 1, addMetaHealed() {} };
  const ctx = {
    $: arg => typeof arg === 'string' ? arg === '#enemy' ? enemy : arg === '#wanderer' ? player : node() : arg,
    _: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    $SM: { hasPerk: () => false, set() {}, get: () => 0 },
    World: { health: 160, Weapons: { sword: {type: 'melee'}, gun: {type: 'ranged'}, forged: {type: 'melee'} },
      setHp(value) { ctx.World.health = value; }, getMaxHealth: () => 160, updateSupplies() {} },
    Space, Path: {outfit: {}},
    Button: {setDisabled() {}},
    Notifications: {notify(module, text) { notices.push(text); }},
    AudioEngine: {playSound() {}}, AudioLibrary: {},
    Date: {now: () => now}, Math: Object.assign(Object.create(Math), {random: () => 0}),
    clearTimeout: timer => timers.delete(timer), clearInterval: timer => timers.delete(timer)
  };
  const setTimer = (callback, ms, repeat, scale = 1) => {
    const key = ++id;
    timers.set(key, {callback, at: now + ms / scale, interval: repeat ? ms / scale : 0});
    return key;
  };
  const scale = options.testerMode ? options.combatTimeScale || 1 : 1;
  ctx.Engine = {activeModule: Space, options,
    combatSetTimeout: (fn, ms) => setTimer(fn, ms, false, scale),
    combatSetInterval: (fn, ms) => setTimer(fn, ms, true, scale)
  };
  ctx.setTimeout = (fn, ms) => setTimer(fn, ms, false);
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['events.js', 'combat_telegraphs.js', 'demon_patterns.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), ctx);
  }
  const scene = {combat: true, damage: 20, health: 200, castleElite: !!options.elite, demonPatternIds: ctx.DemonPatterns.TYPES.map(type => type.id)};
  scene.telegraphAttacks = scene.demonPatternIds.map(key => Object.assign(ctx.DemonPatterns.makeArt(key, 20), {interval: 60, telegraphSec: 0.2}));
  if (options.variant) {
    ctx.DemonPatterns.configureScene(scene, options.floor || 21, options.elite ? 'elite' : 'normal', options.variant);
    enemy.data('hp', scene.health).data('maxHp', scene.health);
  }
  const event = {scenes: {start: scene}};
  let current = event;
  const Events = ctx.Events;
  Object.assign(Events, {
    activeScene: 'start', won: false, fought: false, activeEvent: () => current, eventPanel: () => panel,
    updateFighterDiv() {}, drawFloatText() {}, setHeal() {}, setTakeAll() {}, canLeave() {}, winFight() { Events.won = true; },
    checkPlayerDeath() {
      if (ctx.World.health > 0) return false;
      if (options.revive && !Events._revived) {
        Events._revived = true; player.data('hp', 48); ctx.World.health = 48; return false;
      }
      Events.fought = true;
      ctx.CombatTelegraphs.stop();
      return true;
    },
    animateMelee(from, dmg, cb, info) {
      strikes++;
      Events.damage(from, player, dmg, 'melee', null, info);
      if (cb) cb();
    }
  });
  Events.animateRanged = Events.animateMelee;
  const api = ctx.DemonPatterns;
  const tick = ms => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [key, timer] = due;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(key);
      timer.callback();
    }
    now = end;
  };
  ctx.CombatTelegraphs.start(scene, panel);
  const cast = name => { ctx.CombatTelegraphs.queue(scene.telegraphAttacks.find(art => art.patternType === name)); tick(200 / scale); };
  const hit = (name = 'sword', damage = 12) => {
    const before = enemy.data('hp');
    Events.damage(player, enemy, damage, 'melee', null, {weaponName: name});
    hits += before > enemy.data('hp') ? 1 : 0;
  };
  const control = () => Events.damage(player, enemy, 'stun', 'ranged', null, {weaponName: 'gun'});
  return {ctx, api, scene, enemy, player, event, timers, cast, tick, hit, control, notices,
    strikes: () => strikes, hits: () => hits, stop: () => ctx.CombatTelegraphs.stop(),
    changeScene: () => {current = {scenes: {start: {combat: true}}};}
  };
}

{
  const f = fixture();
  for (const [floor, length] of [[1, 0], [10, 0], [11, 1], [20, 1], [21, 2], [31, 3], [41, 4], [51, 5]]) {
    assert.equal(f.api.available(floor).length, length, 'mechanics unlock in a readable progression');
  }
  for (let floor = 1; floor <= 20; floor++) {
    const stats = {hp: 144, dmg: 7, delay: 1.3};
    f.api.strengthen(stats, floor);
    assert.deepEqual(stats, {hp: 144, dmg: 7, delay: 1.3}, 'early-floor strength stays unchanged');
  }
  const stats = f.api.strengthen({hp: 1000, dmg: 100, delay: 1}, 10000);
  assert.deepEqual(stats, {hp: 1120, dmg: 116, delay: 1}, 'extra growth has bounded HP/damage and no faster normals');
  for (const [floor, kind, cap] of [[10, 'boss', 3], [21, 'normal', 1], [31, 'elite', 3], [50, 'boss', 3], [60, 'boss', 4]]) {
    const original = [{dmg: 1}, {dmg: 2}, {dmg: 3}];
    const scene = {damage: 20, telegraphAttacks: original};
    f.api.configureScene(scene, floor, kind, 'armour');
    assert.ok(scene.telegraphAttacks.length <= cap, 'warning count stays bounded');
    assert.equal(original.length, 3, 'configuring a fight must not mutate the original arts pool');
    if (floor >= 21) assert.ok(scene.demonPatternIds.includes('armour'));
    else assert.equal(scene.demonPatternIds, undefined);
  }
  f.stop();
}
{
  const f = fixture(); f.stop();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/space.js'), 'utf8'), f.ctx);
  const first = f.ctx.Space._pickEnemy(10, false);
  assert.equal(first.hp, 74); assert.equal(first.dmg, 5); assert.equal(first.patternId, null);
  for (const [floor, name] of [[11, 'combo'], [21, 'armour'], [31, 'siphon'], [41, 'bind'], [51, 'shadow']]) {
    let rolls = 0;
    f.ctx.Math.random = () => rolls++ % 2 ? 0.999 : 0.3;
    const specialist = f.ctx.Space._pickEnemy(floor, true);
    assert.equal(specialist.patternId, name, 'real castle enemy generation chooses each progressive specialist');
    assert.equal(specialist.isElite, true);
    assert.ok(specialist.hp > 0 && specialist.dmg > 0);
  }
  f.ctx.Math.random = () => 0.999;
  assert.equal(f.ctx.Space._pickEnemy(51, false).patternId, null, 'familiar demons remain alongside specialist variants');
}
{
  const f = fixture(); f.stop();
  assert.equal(f.api.availableVariants(10).length, 0);
  assert.equal(f.api.availableVariants(11).length, 1);
  assert.equal(f.api.availableVariants(21).length, 2);
  for (const [floor, normal, elite] of [[21, 4, 6], [31, 5, 7], [101, 12, 14], [10000, 12, 18]]) {
    assert.equal(f.api.requiredHits(floor, false), normal);
    assert.equal(f.api.requiredHits(floor, true), elite);
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/space.js'), 'utf8'), f.ctx);
  for (const floor of [11, 20, 51, 10000]) for (const elite of [false, true]) {
    f.ctx.Math.random = () => 0;
    const e = f.ctx.Space._pickEnemy(floor, elite);
    assert.equal(e.patternId, 'scurry');
    assert.equal(e.dmg, elite ? 2 : 1, 'fast small demon never gains high late-floor damage');
    assert.equal(e.delay, 0.4);
    const scene = {damage: e.dmg * 1.6, health: e.hp, castleElite: elite, telegraphAttacks: [{dmg: 100}]};
    f.api.configureScene(scene, floor, elite ? 'elite' : 'normal', e.patternId);
    assert.equal(scene.damage, elite ? 2 : 1, 'even curse/elite setup cannot multiply the bounded fast strike');
    assert.equal(scene.attackDelay, 0.4);
    assert.equal(scene.telegraphAttacks.length, 0, 'fast demons do not inherit damaging blood arts');
    assert.equal(scene.castleVariantId, 'scurry');
  }
  for (const elite of [false, true]) {
    let rolls = 0;
    f.ctx.Math.random = () => rolls++ % 2 ? 0.999 : 0;
    const e = f.ctx.Space._pickEnemy(31, elite);
    assert.equal(e.patternId, 'bloodless');
    assert.equal(e.hp, elite ? 7 : 5);
    const scene = {health: 1, damage: e.dmg, castleElite: elite, telegraphAttacks: [{patternType: 'siphon'}]};
    f.api.configureScene(scene, 31, elite ? 'elite' : 'normal', e.patternId);
    assert.equal(scene.health, elite ? 7 : 5, 'damage potions cannot bypass required hit count');
    assert.equal(scene.castleHitCount, scene.health);
    assert.equal(scene.telegraphAttacks.length, 0, 'a bloodless body cannot heal its hit counter through siphon');
  }
  const boss = {castleBoss: true, damage: 30, health: 1000};
  f.api.configureScene(boss, 51, 'boss', 'bloodless');
  assert.equal(boss.castleVariantId, undefined, 'named guardians keep their story identity and health');
  assert.equal(boss.health, 1000);
}
for (const variant of ['scurry', 'bloodless']) {
  const f = fixture({variant});
  assert.ok(f.api._fight, 'intrinsic demon guide starts without a blood-art timer');
  assert.equal(f.ctx.CombatTelegraphs._fight.arts.length, 0);
  assert.ok(f.api._fight.box.children[0].content.includes(variant === 'bloodless' ? '空壳鬼' : '疾爪小鬼'));
  assert.ok(f.api._fight.live.content.includes(variant === 'bloodless' ? '4 / 4' : '0.4 秒'));
  const callbacks = [...f.timers.values()].map(timer => timer.callback);
  f.changeScene(); f.tick(100);
  assert.equal(f.api._fight, null); assert.equal(f.timers.size, 0);
  callbacks.forEach(fn => fn());
  assert.equal(f.strikes(), 0, 'a stale intrinsic guide never creates attacks or progress in a later battle');
}
for (const elite of [false, true]) {
  const f = fixture({variant: 'scurry', elite, floor: 51});
  f.scene.hit = 1;
  f.ctx.Events.startEnemyAttacks();
  f.tick(1600);
  assert.equal(f.strikes(), 4, 'the real normal-attack scheduler delivers a strike every 0.4 seconds');
  assert.equal(f.ctx.World.health, 160 - 4 * (elite ? 2 : 1), 'the real damage path keeps repeated fast strikes individually low');
  f.control();
  const strikes = f.strikes(); f.tick(2800);
  assert.equal(f.strikes(), strikes, 'control creates a meaningful opening against fast small demons');
  f.ctx.Events.clearTimeouts(); f.tick(f.ctx.Events.STUN_DURATION);
  assert.equal(f.api._fight, null); assert.equal(f.timers.size, 0, 'battle cleanup owns both fast normals and intrinsic guide');
}
{
  const f = fixture({variant: 'bloodless'});
  const total = f.scene.castleHitCount;
  f.ctx.Space.getLifestealPct = () => 1;
  f.ctx.World.health = 60; f.player.data('hp', 60);
  let colorHeals = 0;
  f.ctx.Engine.NichirinColors = {red: {healOnHit: 10}};
  f.ctx.Engine.getNichirinColor = () => 'red';
  f.ctx.Events.restoreHealth = () => { colorHeals++; };
  f.hit('nichirin katana', 1000000);
  assert.equal(f.enemy.data('hp'), total - 1, 'even huge direct damage removes only one required hit');
  assert.equal(f.ctx.World.health, 60); assert.equal(colorHeals, 0, 'bloodless attacks provide neither talent nor blade-color healing');
  f.hit('sword', -1);
  assert.equal(f.enemy.data('hp'), total - 1, 'miss does not progress required hits');
  f.enemy.data('status', 'shield'); f.hit('sword', 1000000);
  assert.equal(f.enemy.data('hp'), total - 1, 'shield absorption neither progresses nor restores a hit count');
  assert.equal(f.enemy.data('status'), 'none');
  f.control(); assert.equal(f.enemy.data('hp'), total - 1, 'control alone does not progress required hits');
  f.ctx.Events.dotDamage(f.enemy, 1000000, 'poison');
  assert.equal(f.enemy.data('hp'), total - 1, 'damage-over-time cannot bypass count or kill a bloodless body');
  assert.equal(f.ctx.Events.won, false);
  for (let i = 0; i < total - 2; i++) f.hit('gun', 1000000);
  assert.equal(f.enemy.data('hp'), 1, 'every melee or ranged direct attack counts exactly once');
  f.api.update(); assert.ok(f.api._fight.live.content.includes('1 / 4'));
  f.hit('sword', 1); assert.equal(f.enemy.data('hp'), 0, 'the exact final required direct hit defeats the body');
  f.stop(); f.tick(f.ctx.Events.STUN_DURATION); assert.equal(f.timers.size, 0);
}
for (const variant of ['scurry', 'bloodless']) for (const elite of [false, true]) for (const pathName of ['normal', 'ambush']) {
  const f = fixture(); f.stop();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/space.js'), 'utf8'), f.ctx);
  const space = f.ctx.Space;
  space.currentFloor = 31;
  const stats = {enemy: variant, hp: 140, dmg: 10, hit: 0.9, delay: 1.2, isElite: elite, patternId: variant};
  space._pickEnemy = () => Object.assign({}, stats);
  space._configureBattleLoot = () => {};
  let event;
  f.ctx.Events.startEvent = value => {event = value;};
  if (pathName === 'normal') space.triggerBattle(elite);
  else { space._ambushRemaining = 3; space._ambushNext(); }
  const scene = event.scenes.start;
  assert.equal(scene.castlePatternId, variant, pathName + ' carries the selected intrinsic body into the actual fight scene');
  assert.equal(scene.castleElite, elite);
  f.api.configureScene(scene, 31, elite ? 'elite' : 'normal', scene.castlePatternId);
  assert.equal(scene.castleVariantId, variant);
  if (variant === 'bloodless') assert.equal(scene.health, elite ? 7 : 5);
  else { assert.equal(scene.damage, elite ? 2 : 1); assert.equal(scene.attackDelay, 0.4); }
}
{
  const f = fixture(); f.cast('combo');
  assert.equal(f.strikes(), 1);
  f.tick(1500);
  assert.equal(f.strikes(), 3, 'a real three-part combo releases three independent attacks');
  assert.equal(f.ctx.World.health, 127);
  f.stop(); assert.equal(f.timers.size, 0);
}
{
  const f = fixture(); f.cast('combo'); f.control();
  assert.equal(f.api._fight.combo, null, 'control can cancel already released remaining combo parts');
  f.tick(4500); assert.equal(f.strikes(), 1); f.stop(); assert.equal(f.timers.size, 0);
}
{
  const f = fixture(); f.cast('armour');
  assert.equal(f.api.modifyDamage(12), 9);
  f.hit('sword', -1); assert.equal(f.api._fight.armour.hits, 3, 'a miss never removes armour stacks');
  f.enemy.data('status', 'shield'); f.hit();
  assert.equal(f.api._fight.armour.hits, 3, 'a shield-absorbed blow is not an armour-breaking hit');
  f.hit(); f.hit(); assert.equal(f.api._fight.armour.hits, 1);
  f.hit(); assert.equal(f.api._fight.armour, null);
  assert.equal(f.api.modifyDamage(12), 12); f.stop();
}
{
  const f = fixture(); f.cast('armour'); f.tick(8000);
  assert.equal(f.api._fight.armour, null, 'armour expires without persisting into another fight');
  f.stop();
}
for (const shield of [false, true]) {
  const f = fixture(); f.player.data('status', shield ? 'shield' : 'none'); f.cast('siphon');
  assert.equal(f.enemy.data('hp'), shield ? 200 : 211, 'lifesteal is based on actual damage, never shielding');
  f.stop();
}
{
  const f = fixture(); f.enemy.data('hp', 299); f.cast('siphon');
  assert.equal(f.enemy.data('hp'), 300, 'a demon cannot heal above its maximum HP'); f.stop();
}
{
  const f = fixture(); f.ctx.Math.random = () => 0.999; f.cast('siphon');
  assert.equal(f.enemy.data('hp'), 200); assert.equal(f.ctx.World.health, 160); f.stop();
}
{
  const f = fixture(); f.cast('bind');
  assert.equal(f.api.modifyHitChance(0.8), 0.65);
  f.hit('sword', -1); assert.equal(f.api._fight.bind.hits, 3);
  f.hit(); f.hit(); f.hit(); assert.equal(f.api.modifyHitChance(0.8), 0.8); f.stop();
}
for (const item of ['medicine', 'wisteria oil']) {
  const f = fixture(); f.cast('bind');
  assert.equal(f.api.canUseMedicine('cured meat'), false);
  f.ctx.World.health = 160; f.player.data('hp', 160); f.ctx.Path.outfit[item] = 1;
  assert.equal(f.api.canUseMedicine(item), true, 'medicine can clear binding even if lifesteal already restored full HP');
  f.ctx.Events.doHeal(item, 30, {});
  assert.equal(f.ctx.Path.outfit[item], 0, 'cleansing consumes exactly one item');
  assert.equal(f.api._fight.bind, null);
  assert.equal(f.ctx.World.health, 160); f.stop();
}
{
  const f = fixture(); f.cast('bind'); f.tick(6000);
  assert.equal(f.api.modifyHitChance(0.8), 0.8); f.stop();
}
{
  const f = fixture(); f.cast('shadow'); f.tick(10000);
  assert.equal(f.strikes(), 4, 'a shadow makes four low-damage attacks at most');
  assert.equal(f.api._fight.shadow, null); f.stop(); assert.equal(f.timers.size, 0);
}
for (const weapon of ['sword', 'gun']) {
  const f = fixture(); f.cast('shadow');
  f.hit(weapon, -1); assert.equal(f.api._fight.shadow.hits, 3);
  for (let i = 0; i < (weapon === 'gun' ? 1 : 3); i++) f.hit(weapon);
  assert.equal(f.api._fight.shadow, null, 'all lineages can remove a shadow; ranged needs fewer hits');
  f.tick(11000); assert.equal(f.strikes(), 0); f.stop();
}
{
  const f = fixture(); f.cast('armour'); f.cast('bind'); f.cast('shadow'); f.cast('combo'); f.control();
  for (const effect of ['armour', 'bind', 'shadow', 'combo']) assert.equal(f.api._fight[effect], null);
  f.tick(4500); assert.equal(f.strikes(), 2); f.stop(); assert.equal(f.timers.size, 0);
}
for (const id of ['combo', 'armour', 'siphon', 'bind', 'shadow']) {
  const f = fixture();
  const art = f.scene.telegraphAttacks.find(art => art.patternType === id);
  const rhythm = f.ctx.CombatTelegraphs._fight.arts.find(own => own.attack === art);
  f.ctx.CombatTelegraphs.queue(art); f.control();
  assert.equal(rhythm.interval, 48, 'new arts preserve accelerated retries after interruption');
  f.tick(4000); f.enemy.data('stunned', false); f.cast(id);
  assert.equal(rhythm.interval, 60, 'released new arts restore the original interval');
  f.stop();
}
for (const mechanism of ['shadow', 'combo', 'armour', 'bind']) {
  const f = fixture(); f.cast(mechanism);
  const callbacks = [...f.timers.values()].map(timer => timer.callback);
  const strikesBefore = f.strikes();
  f.changeScene(); f.tick(100);
  assert.equal(f.api._fight, null); assert.equal(f.timers.size, 0);
  callbacks.forEach(fn => fn());
  assert.equal(f.strikes(), strikesBefore, 'even already dispatched callbacks cannot hit a later scene');
}
for (const revive of [false, true]) {
  const f = fixture({revive}); f.ctx.World.health = 1; f.player.data('hp', 1); f.cast('combo');
  assert.equal(f.ctx.World.health, revive ? 48 : 0);
  f.tick(1500);
  assert.equal(f.strikes(), revive ? 3 : 1, 'fatal blows stop remaining parts, second wind keeps the same live fight');
  f.stop(); assert.equal(f.timers.size, 0);
}
{
  const f = fixture({testerMode: true, combatTimeScale: 4}); f.cast('combo'); f.tick(375);
  assert.equal(f.strikes(), 3, 'combo spacing uses tester combat speed exactly once'); f.stop();
}
{
  const f = fixture();
  f.ctx.NichirinForge = {getDamageMultiplier: key => key === 'forged' ? 1.25 : 1};
  f.hit('forged', 12); assert.equal(f.enemy.data('hp'), 185, 'matching forged blade applies once to real castle damage');
  f.hit('forged', -1); assert.equal(f.enemy.data('hp'), 185);
  f.ctx.Engine.activeModule = {}; f.hit('forged', 12); assert.equal(f.enemy.data('hp'), 173, 'outside the castle no matching-style multiplier is applied');
  f.ctx.Engine.activeModule = f.ctx.Space; f.stop();
}
console.log('PASS: five progressive demon tactics, fast low-damage bodies, bounded bloodless hit counts, no lifesteal/color healing/DOT bypass, real-hit counters, adaptation, death/revive and stale-timer cleanup.');
