const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(options = {}) {
  let now = 0, nextId = 0, attacks = 0, bleeds = 0;
  const timers = new Map();
  const nodes = [];
  function node() {
    const el = { length: 1, values: {}, attrs: {}, classes: new Set(), children: [], content: '',
      get() { return el; },
      data(key, value) { if (arguments.length === 1) return el.values[key]; el.values[key] = value; return el; },
      attr(key, value) { if (typeof key === 'object') Object.assign(el.attrs, key); else el.attrs[key] = value; return el; },
      addClass(name) { el.classes.add(name); return el; }, removeClass(name) { el.classes.delete(name); return el; },
      appendTo(parent) { parent.children.push(el); return el; }, remove() { el.removed = true; return el; },
      text(value) { el.content = value; return el; }
    };
    nodes.push(el);
    return el;
  }
  const enemy = node().data('hp', 100), player = node().data('hp', 100), panel = node();
  panel.find = selector => selector === '#enemy' ? enemy : player;
  const scene = { combat: true, telegraphAttacks: [{interval: 20, telegraphSec: 5, dmg: 20}] };
  let currentScene = scene;
  const scale = options.testerMode ? options.combatTimeScale || 1 : 1;
  const setTimer = (callback, ms, repeat) => {
    const id = ++nextId;
    timers.set(id, {callback, at: now + ms / scale, interval: repeat ? ms / scale : 0});
    return id;
  };
  const ctx = {
    $: arg => typeof arg === 'string' ? node() : arg,
    _: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    Date: {now: () => now}, Math: Object.assign(Object.create(Math), {random: () => 0.5}),
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
    World: {health: 100}, Notifications: {notify() {}},
    Engine: {options, combatSetInterval: (fn, ms) => setTimer(fn, ms, true), combatSetTimeout: (fn, ms) => setTimer(fn, ms, false)},
    Events: {
      activeScene: 'start', activeEvent: () => currentScene && ({scenes: {start: currentScene}}), eventPanel: () => panel,
      updateFighterDiv() {}, checkPlayerDeath() {},
      animateMelee(enemy, dmg, cb, info) {
        attacks++;
        if (info.isValid() && player.data('status') !== 'shield') { ctx.World.health -= dmg; info.onDamage(dmg); }
        if (cb) cb();
      },
      dotDamage() { bleeds++; }
    }
  };
  ctx.Events.animateRanged = ctx.Events.animateMelee;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/combat_telegraphs.js'), 'utf8'), ctx);
  const api = ctx.CombatTelegraphs;
  const tick = ms => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, t] = due;
      now = t.at;
      if (t.interval) t.at += t.interval; else timers.delete(id);
      t.callback();
    }
    now = end;
  };
  api.start(scene, panel);
  return {api, ctx, enemy, player, scene, tick, timers, nodes, changeScene: () => {currentScene = {};}, attacks: () => attacks, bleeds: () => bleeds};
}

{
  const f = fixture();
  f.api.queue(f.scene.telegraphAttacks[0]);
  const charge = f.api._fight.charges[0];
  f.tick(1200);
  assert.match(charge.countdown.content, /3.8s/);
  assert.equal(Math.round(charge.progress.attrs.value), 24);
  f.enemy.data('stunned', true);
  f.api.interrupt(f.enemy);
  assert.equal(f.api._fight.charges.length, 0);
  assert.equal(f.enemy.classes.has('charging'), false);
  f.enemy.data('stunned', false);
  f.tick(5000);
  assert.equal(f.attacks(), 0, 'an interrupted long cast stays cancelled after stun wears off');
}
{
  const f = fixture();
  f.api.queue({telegraphSec: 1, dmg: 10});
  f.api.queue({telegraphSec: 3, dmg: 10});
  f.tick(1000);
  assert.equal(f.attacks(), 1);
  assert.equal(f.enemy.classes.has('charging'), true, 'another overlapping warning keeps its indicator');
  f.api.interrupt(f.enemy);
  f.tick(3000);
  assert.equal(f.attacks(), 1);
}
for (const shield of [false, true]) {
  const f = fixture();
  f.player.data('status', shield ? 'shield' : 'none');
  f.api.queue({telegraphSec: 1, dmg: 10, bleedSec: 3, bleedPerSec: 2});
  f.tick(4500);
  assert.equal(f.bleeds(), shield ? 0 : 3, 'bleeding requires actual damage and stops at the exact tick count');
  f.api.stop();
  assert.equal(f.timers.size, 0);
}
{
  const f = fixture();
  f.player.data('status', 'shield');
  f.api.queue({telegraphSec: 1, dmg: 20, shieldBreaker: true});
  f.tick(1000);
  assert.equal(f.attacks(), 0);
  assert.equal(f.player.data('status'), 'none');
  assert.equal(f.ctx.World.health, 100);
  f.api.queue({telegraphSec: 1, dmg: 20});
  f.changeScene(); f.tick(2000);
  assert.equal(f.attacks(), 0, 'old-scene timers cannot attack the next event');
  assert.equal(f.timers.size, 0, 'scene changes clean up warning timers');
}
for (const testerMode of [false, true]) {
  const f = fixture({testerMode, combatTimeScale: 4});
  f.api.queue({telegraphSec: 4, dmg: 10});
  f.tick(1000);
  assert.equal(f.attacks(), testerMode ? 1 : 0, 'normal games ignore stale tester speed settings');
  f.api.stop();
}
for (const revive of [false, true]) {
  const f = fixture();
  let deaths = 0;
  f.ctx.Events.checkPlayerDeath = () => {
    if (f.ctx.World.health <= 0) {
      deaths++;
      if (revive) f.ctx.World.health = 30;
      else { f.ctx.Events.fought = true; f.api.stop(); return true; }
    }
    return false;
  };
  // No animation completion callback: fatal hits must settle inside onDamage.
  f.ctx.Events.animateMelee = (enemy, damage, cb, info) => {
    f.ctx.World.health = 0;
    info.onDamage(damage);
    assert.equal(deaths, 1, 'lethal damage settles before the animation ends');
  };
  f.api.queue({telegraphSec: 1, dmg: 200, bleedSec: 3, bleedPerSec: 2});
  f.tick(1100);
  assert.equal(f.ctx.World.health, revive ? 30 : 0);
  assert.equal(!!f.api._fight, revive, 'a second wind keeps the active fight alive');
  f.api.stop();
}
{
  const f = fixture();
  f.ctx.World.health = 0;
  f.tick(200);
  assert.ok(f.api._fight, 'a pending ordinary-hit recovery keeps blood-art scheduling');
  f.ctx.World.health = 30;
  f.api.queue({telegraphSec: 1, dmg: 5});
  f.tick(1000);
  assert.equal(f.attacks(), 1, 'blood arts remain active after ordinary-hit recovery');
  f.api.stop();
}
console.log('PASS: warning countdown, permanent cast interruption, overlapping casts, shield/bleed resolution, cleanup and tester speed.');
