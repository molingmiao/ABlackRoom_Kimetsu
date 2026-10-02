const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(options = {}) {
  let now = 0, nextId = 0, attacks = 0, bleeds = 0;
  const timers = new Map(), notices = [];
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
    World: {health: 100}, Notifications: {notify(module, text) { notices.push(text); }}, Space: {},
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
  if (options.castle) ctx.Engine.activeModule = ctx.Space;
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
  return {api, ctx, enemy, player, scene, tick, timers, nodes, notices, changeScene: () => {currentScene = {};}, attacks: () => attacks, bleeds: () => bleeds};
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
{
  const f = fixture({castle: true});
  const configBefore = JSON.stringify(f.scene.telegraphAttacks);
  const art = f.api._fight.arts[0];
  assert.equal(art.interval, 20);
  f.tick(20000);
  assert.equal(f.api._fight.charges.length, 1, 'the first castle cast uses its original interval');
  f.tick(1000);
  f.enemy.data('stunned', true);
  f.api.interrupt(f.enemy);
  assert.equal(art.interval, 16, 'an interrupted castle technique retries 20% faster');
  assert.equal(art.interruptions, 1);
  f.api.interrupt(f.enemy);
  assert.equal(art.interruptions, 1, 'repeated controls without a pending cast do not stack adaptation');
  f.enemy.data('stunned', false);
  f.tick(14999);
  assert.equal(f.api._fight.charges.length, 0);
  f.tick(1);
  assert.equal(f.api._fight.charges[0].duration, 5, 'faster retries preserve the full warning window');
  assert.match(art.row.content, /charging/);
  f.tick(5000);
  assert.equal(f.attacks(), 1);
  assert.equal(art.interval, 20, 'a completed cast restores the original interval');
  assert.equal(art.interruptions, 0);
  assert.equal(art.nextAt, 56000, 'restoration is measured from the preceding cast start, not its completion');
  assert.equal(JSON.stringify(f.scene.telegraphAttacks), configBefore, 'adaptation must not mutate shared attack definitions');
  assert.ok(f.notices.some(text => /adapts/.test(text)) && f.notices.some(text => /returns/.test(text)), 'players learn why the rhythm changed');
  f.api.stop();
  assert.equal(f.timers.size, 0);
}
{
  const f = fixture({castle: true});
  const art = f.api._fight.arts[0];
  for (let i = 0; i < 12; i++) {
    f.api.queue(art.attack);
    f.api.interrupt(f.enemy);
  }
  assert.equal(art.interval, 10, 'repeated interruption is capped at half the original interval');
  assert.equal(f.api._fight.charges.length, 0);
  const previousFight = f.api._fight;
  f.api.start(f.scene, f.nodes[2]);
  assert.equal(f.api._fight.arts[0].interval, 20, 'the next fight does not inherit adaptations');
  assert.equal(f.api._fight.arts[0].interruptions, 0);
  f.api._resolve({attack: art.attack, art, row: f.nodes[0]}, previousFight);
  assert.equal(f.attacks(), 0, 'an old fight cannot release a cast against the new fight');
  f.api.stop();
  assert.equal(f.timers.size, 0);
}
for (const outcome of ['shield', 'shieldBreaker', 'miss']) {
  const f = fixture({castle: true});
  const art = f.api._fight.arts[0];
  f.api.queue(art.attack); f.api.interrupt(f.enemy);
  f.player.data('status', outcome === 'miss' ? 'none' : 'shield');
  art.attack.shieldBreaker = outcome === 'shieldBreaker';
  art.attack.hit = outcome === 'miss' ? 0 : 1;
  f.api.queue(art.attack);
  f.tick(5000);
  assert.equal(art.interval, 20, 'a released technique resets its rhythm even when defended or missed: ' + outcome);
  assert.equal(f.ctx.World.health, 100);
  f.api.stop();
}
{
  const f = fixture({castle: true});
  const art = f.api._fight.arts[0];
  f.api.queue(art.attack);
  f.enemy.data('stunned', true);
  f.tick(5000);
  assert.equal(art.interval, 16, 'control still cancels and adapts a cast if the direct interruption hook was missed');
  f.tick(11000);
  assert.equal(f.api._fight.charges.length, 0, 'a controlled demon cannot start another cast');
  f.enemy.data('stunned', false);
  f.tick(250);
  assert.equal(f.api._fight.charges.length, 1, 'a deferred retry resumes after control ends');
  f.api.stop();
  assert.equal(f.timers.size, 0);
}
{
  const f = fixture({castle: true});
  const art = f.api._fight.arts[0];
  f.api.queue(art.attack);
  f.ctx.World.health = 0;
  f.tick(5000);
  assert.equal(f.api._fight.charges.length, 0, 'an expired charge cannot jam the queue during second-wind settlement');
  f.ctx.World.health = 30;
  f.tick(15000);
  assert.equal(f.api._fight.charges.length, 1, 'a revived player can face the next properly scheduled cast');
  f.changeScene(); f.tick(100);
  assert.equal(f.timers.size, 0, 'all adaptive retry timers are cleared when the event changes');
}
{
  const f = fixture();
  f.api.queue(f.scene.telegraphAttacks[0]); f.api.interrupt(f.enemy);
  assert.equal(f.api._fight.adaptive, false, 'outdoor demons keep their existing rhythm');
  assert.equal(f.api._fight.arts.length, 0);
  f.tick(19999);
  assert.equal(f.api._fight.charges.length, 0);
  f.tick(1);
  assert.equal(f.api._fight.charges.length, 1, 'outdoor casts keep their original fixed interval after interruption');
  f.api.stop();
}
{
  const f = fixture({castle: true, testerMode: true, combatTimeScale: 4});
  const art = f.api._fight.arts[0];
  f.tick(5000); f.tick(250); f.api.interrupt(f.enemy);
  assert.equal(art.interval, 16);
  f.tick(3750);
  assert.equal(f.api._fight.charges[0].duration, 5);
  f.tick(1250);
  assert.equal(art.interval, 20, 'adaptive retry and reset follow tester combat speed exactly once');
  f.api.stop();
}
{
  const f = fixture({castle: true});
  const shortArt = {interval: 6, telegraphSec: 5, dmg: 5};
  f.scene.telegraphAttacks.push(shortArt);
  f.api.start(f.scene, f.nodes[2]);
  const firstArt = f.api._fight.arts[0], secondArt = f.api._fight.arts[1];
  for (let i = 0; i < 6; i++) {
    f.api.queue(shortArt); f.api.interrupt(f.enemy);
  }
  assert.equal(firstArt.interval, 20, 'one technique adapting does not accelerate unrelated techniques');
  assert.equal(secondArt.interval, 5.5, 'the minimum retry interval preserves its warning window and a recovery gap');
  f.api.queue(firstArt.attack); f.api.queue(shortArt);
  assert.equal(f.api._fight.charges.length, 2);
  assert.equal(f.api.queue(firstArt.attack), false, 'each castle technique can only own one concurrent cast');
  f.api.interrupt(f.enemy);
  assert.equal(firstArt.interval, 16);
  assert.equal(secondArt.interval, 5.5);
  assert.equal(f.api._fight.box.children[0], f.api._fight.chargeBox, 'live warnings appear before the persistent rhythm guide');
  f.api.stop();
  assert.equal(f.timers.size, 0);
}
{
  const f = fixture({castle: true});
  f.api.queue(f.scene.telegraphAttacks[0]);
  f.enemy.data('hp', 0);
  f.tick(5000);
  assert.equal(f.attacks(), 0, 'a dead enemy cannot release or stack an adaptive cast');
  f.ctx.Events.won = true;
  f.tick(100);
  assert.equal(f.timers.size, 0, 'victory removes all warning, repeat and retry timers');
}
console.log('PASS: warning countdown, permanent interruption, bounded castle adaptation/reset, outdoor rhythm, shields, stale timers, second wind and tester speed.');
