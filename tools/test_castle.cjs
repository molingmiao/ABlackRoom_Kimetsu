const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const state = { stores: {}, outfit: {}, character: {}, game: {} };
  const animations = [];
  let lastDuration = 0;
  function element(id, data = {}, length = 1) {
    const node = { length, _data: data, _classes: new Set(),
      attr(key, value) { if (arguments.length === 1) return key === 'id' ? id : undefined; return node; },
      data(key, value) { if (arguments.length === 1) return data[key]; data[key] = value; return node; },
      addClass(c) { node._classes.add(c); return node; },
      removeClass(c) { node._classes.delete(c); return node; },
      hasClass(c) { return node._classes.has(c); },
      animate(props, duration, easing, cb) { lastDuration = duration; if (typeof cb === 'function') animations.push(cb); return node; },
      each() { return node; }, get() { return []; },
      children() { return element('', {}, 0); }, find() { return element('', {}, 0); }
    };
    for (const method of ['css', 'text', 'appendTo', 'empty', 'remove', 'focus', 'width', 'first', 'click', 'append', 'stop']) node[method] = () => node;
    return node;
  }
  const $ = arg => typeof arg === 'object' ? arg : element(typeof arg === 'string' ? arg.replace('#', '') : '', {}, arg === '#wanderer' ? 0 : 1);
  const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
  const sm = {
    get(key, zero) { let v = state; for (const k of parts(key)) v = v && v[k]; return v == null && zero ? 0 : v; },
    set(key, value) { const ks = parts(key); let obj = state; for (const k of ks.slice(0, -1)) obj = obj[k] || (obj[k] = {}); obj[ks.at(-1)] = value; },
    setM(key, values) { for (const k in values) sm.set(key + '["' + k + '"]', values[k]); },
    add(key, value) { sm.set(key, (sm.get(key, true) || 0) + value); },
    hasPerk(key) { return !!sm.get('character.perks["' + key + '"]'); }
  };
  const ctx = { $, $SM: sm, _: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    Engine: { options: {}, event() {}, log() {}, setInterval() {}, activeModule: null },
    Path: { outfit: state.outfit }, Notifications: { notify() {} }, AudioEngine: { stopEventMusic() {}, playSound() {} }, AudioLibrary: {},
    setTimeout() { throw Error('reward flow must use event completion, not a guessed timeout'); },
    clearInterval() {}, clearTimeout() {},
    World: { health: 40, getMaxHealth() { return 85 + ctx.Space.getMaxHpBonus(); }, setHp(hp) { this.health = hp; },
      updateSupplies() {}, meatHeal() { return sm.hasPerk('breath nourish') ? 16 : 8; }, medsHeal: () => 20, hypoHeal: () => 30 }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['Button.js', 'events.js', 'space.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), ctx);
  ctx.Engine.activeModule = ctx.Space;
  ctx.Events.eventStack = [];
  ctx.Events.startCombat = ctx.Events.startStory = ctx.Events.updateButtons = ctx.Events.setHeal = () => {};
  ctx.Space.showFloor = () => {};
  ctx.Space._collectRemainingLoot = () => {};
  const click = id => ctx.Events.buttonClick({ attr: () => id });
  const flush = () => { while (animations.length) animations.shift()(); };
  return { ctx, state, sm, click, flush, element, duration: () => lastDuration };
}

// Reward transitions use the real event stack and button dispatcher, including the fade callback.
for (const floor of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
  for (const shop of [false, true]) {
    const { ctx: c, sm, click, flush } = fixture();
    c.Space.currentFloor = floor;
    sm.set('stores', { teeth: 24, scales: 16 });
    c.Space.triggerBossFight();
    if (shop) {
      click('recraft');
      assert.equal(c.Events.activeScene, 'recraft');
      click('recraft_0'); click('recraft_0'); click('recraft_0');
      assert.equal(c.Path.outfit.medicine, 2);
      assert.equal(sm.get('stores.teeth'), 0);
      assert.equal(c.Space.currentFloor, floor);
      click('leave');
    } else click('continue');
    flush();
    for (let reward = 0; reward < 2; reward++) {
      assert.equal(c.Events.activeEvent().title, 'slayer talent');
      click('talent_0'); flush();
    }
    assert.equal(c.Space.currentFloor, floor + 1);
    assert.equal(c.Events.eventStack.length, 0);
    assert.equal(c.Space.TALENTS.reduce((n, t) => n + c.Space.getTalentLevel(t.id), 0), 2);
  }
}
for (const count of [3, 4, 5]) {
  const { ctx: c, click, flush } = fixture();
  c.Space.currentFloor = 8;
  c.Space._ambushSnapshot = {};
  c.Space._pendingAmbushTalentChoices = count;
  c.Space._ambushEnd(); click('continue'); flush();
  for (let i = 0; i < count; i++) { click('talent_0'); flush(); }
  assert.equal(c.Space.TALENTS.reduce((n, t) => n + c.Space.getTalentLevel(t.id), 0), count);
  assert.equal(c.Space.currentFloor, 9);
}
{
  const { ctx: c, click, flush } = fixture();
  const child = { title: 'child', scenes: { start: { buttons: {} } } };
  c.Events.startEvent({ title: 'parent', scenes: { start: { buttons: { next: {
    onChoose() { c.Events.startEvent(child); }, nextScene: 'end'
  } } } } });
  click('next'); flush();
  assert.equal(c.Events.activeEvent(), child, 'closing a parent must not close its new child');
}
{
  const { ctx: c, sm, element, duration } = fixture();
  c.Space.setTalentLevel('hardBody', 1);
  assert.equal(c.World.health, 45);
  assert.equal(c.World.getMaxHealth(), 90);
  c.Space.setTalentLevel('swiftBlade', 20);
  c.Button.cooldown(element('attack_nichirin-katana', { cooldown: 2, boosted: () => false }), 2);
  assert.equal(duration(), 1400, 'shared weapon cooldown also applies the talent');
  sm.set('game.castleMeta.totalHealed', 2000);
  sm.set('character.perks["breath nourish"]', true);
  c.Path.outfit['cured meat'] = 3;
  const oldHp = c.World.health;
  assert.equal(c.Events.doHeal('cured meat', c.World.meatHeal(), element('eat')), 20);
  assert.equal(c.World.health, oldHp + 20);
  assert.equal(sm.get('game.castleMeta.totalHealed'), 2020);
  c.World.health = c.World.getMaxHealth();
  assert.equal(c.Events.doHeal('cured meat', 16, element('eat')), 0);
  assert.equal(c.Path.outfit['cured meat'], 2, 'full HP must not consume medicine');
}
{
  const { ctx: c, element } = fixture();
  c.Events.updateFighterDiv = c.Events.drawFloatText = () => {};
  const player = element('wanderer', { status: 'none' });
  const enemy = element('enemy', { hp: 1000, maxHp: 1000, status: 'none' });
  c.Space.setTalentLevel('sharpEdge', 1);
  for (let i = 0; i < 25; i++) c.Events.damage(player, enemy, 12, 'ranged', null, { weaponName: 'thunder gun' });
  assert.equal(1000 - enemy.data('hp'), 312, 'fractional growth is preserved across actual hits');
  c.Space._sharpenedBattle = true;
  c.Space.setTalentLevel('sharpEdge', 0);
  const before = enemy.data('hp');
  c.Events.damage(player, enemy, 12, 'ranged', null, { weaponName: 'thunder gun' });
  assert.equal(before - enemy.data('hp'), 13, 'sharpening affects actual damage');
  c.Space.setTalentLevel('bloodDrink', 5);
  enemy.data('status', 'shield');
  const hp = c.World.health;
  c.Events.damage(player, enemy, 12, 'ranged', null, { weaponName: 'thunder gun' });
  assert.equal(c.World.health, hp, 'shielded attacks cannot grant lifesteal');
}
{
  const { ctx: c } = fixture();
  const math = Object.create(Math);
  c.Math = math;
  for (const floor of [2, 15, 26, 99]) {
    const types = new Set();
    for (let i = 0; i < 1000; i++) {
      let n = 0;
      math.random = () => n++ === 0 ? 0 : (i + 0.5) / 1000;
      const nodes = c.Space._buildRegularFloor(floor);
      assert.equal(nodes.length, 2);
      types.add(nodes[1].type);
    }
    assert.ok(types.has('hashira'));
    assert.ok(types.has('shrine'));
  }
  let lastHp = 0;
  for (let floor = 1; floor <= 99; floor++) {
    const enemy = c.Space._pickEnemy(floor, false);
    assert.ok(enemy.hp > lastHp && enemy.delay >= 1);
    lastHp = enemy.hp;
  }
  assert.ok(c.Space._bossDef(90).hp / c.Space._bossDef(80).hp < 1.5);
}
console.log('PASS: all Boss branches, 3–5 ambush rewards, event ownership, growth, shared cooldown, healing, node probabilities, and balance bounds.');
