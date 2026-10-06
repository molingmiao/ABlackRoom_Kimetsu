const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const state = { character: {}, game: {}, stores: {} };
  const notifications = [];
  const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
  const sm = {
    get(key, zero) { let value = state; for (const keyPart of parts(key)) value = value && value[keyPart]; return value == null && zero ? 0 : value; },
    set(key, value) { const keys = parts(key); let target = state; for (const keyPart of keys.slice(0, -1)) target = target[keyPart] || (target[keyPart] = {}); target[keys.at(-1)] = value; },
    add(key, amount) { sm.set(key, sm.get(key, true) + amount); },
    hasPerk(key) { return !!sm.get('character.perks["' + key + '"]'); }
  };
  let event, progressed = 0;
  const c = {
    $SM: sm, _: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    Engine: { activeModule: null }, Notifications: { notify(module, text) { notifications.push(text); } },
    Events: { startEvent(value) { event = value; }, eventPanel() { return { addClass() {} }; } },
    World: { BASE_HIT_CHANCE: 0.8, health: 100, getBaseMaxHealth: () => 85,
      getMaxHealth() { return 85 + c.Space.getMaxHpBonus(); }, setHp(value) { this.health = value; } }
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/space.js'), 'utf8'), c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/castle_report.js'), 'utf8'), c);
  c.Engine.activeModule = c.Space;
  c.Space.afterNode = () => { progressed++; };
  const fill = level => c.Space.TALENTS.forEach(t => sm.set('character.infinityTalents["' + t.id + '"]', level));
  return { c, state, sm, notifications, fill, event: () => event, progressed: () => progressed };
}

// Skills at the tier ceiling are never offered while any other skill needs training.
{
  const { c, sm, fill, event } = fixture();
  fill(20); sm.set('character.infinityTalents.swiftBlade', 19);
  c.Space._offerTalent();
  const choices = Object.entries(event().scenes.start.buttons).filter(([id]) => id !== 'skip');
  assert.equal(choices.length, 1);
  assert.match(choices[0][1].text, /swift blade Lv\.20\/20/);
  assert.equal(c.Space._takeTalent('hardBody', () => {}), false);
  assert.equal(c.Space.getTalentLevel('hardBody'), 20);
  assert.equal(c.Space._takeTalent('unknown', () => {}), false);
  choices[0][1].onChoose();
  assert.equal(c.Space.getTalentLevel('swiftBlade'), 20);
  assert.equal(c.Space.getTalentCap(), 25);
}

// The common ceiling increases only when all six skills reach it in this descent.
{
  const { c, sm, fill, notifications } = fixture();
  c.Space.TALENTS.forEach(t => sm.set('game.castleMeta.peakTalent["' + t.id + '"]', 20));
  fill(1);
  assert.equal(c.Space.eligibleTalents().length, 6);
  assert.equal(c.Space.getTalentCap(), 20, 'mixed historical peaks do not unlock a tier');
  fill(20);
  assert.equal(c.Space.eligibleTalents().length, 6);
  assert.equal(c.Space.getTalentCap(), 25);
  assert.equal(sm.get('game.castleMeta.talentCap'), 25);
  c.Space.eligibleTalents();
  assert.equal(notifications.length, 1, 'reopening rewards does not repeat a breakthrough');
  for (const t of c.Space.TALENTS) c.Space.setTalentLevel(t.id, 25);
  assert.equal(c.Space.getTalentCap(), 30);
  for (const t of c.Space.TALENTS) c.Space.setTalentLevel(t.id, 30);
  assert.equal(c.Space.getTalentCap(), 35);
  assert.equal(notifications.length, 3);
  c.Space.clearTalents();
  assert.equal(c.Space.getTalentCap(), 35, 'leaving clears run levels but not unlocked tiers');
  c.Space._grantStartingTalents();
  for (const t of c.Space.TALENTS) assert.equal(c.Space.getTalentLevel(t.id), 12);
  assert.equal(c.Space.getTalentCap(), 35, 'starting inheritance does not trigger another tier');
}

// Existing saves retain their early inheritance curve, then scale at 40% above Lv.20.
{
  const { c, sm } = fixture();
  for (const [peak, expected] of [[0,0],[2,0],[3,1],[6,2],[10,3],[15,5],[20,8],[24,9]]) {
    assert.equal(c.Space.getStartingTalentLevel('hardBody', peak), expected);
  }
  sm.set('game.castleMeta.talentCap', 30);
  assert.equal(c.Space.getStartingTalentLevel('hardBody', 25), 10);
  assert.equal(c.Space.getStartingTalentLevel('hardBody', 30), 12);
  assert.equal(c.CastleReport._inherited('hardBody', 25), 10);
  assert.equal(c.CastleReport._inherited('hardBody', 30), 12);
  assert.equal(c.Space.getStartingTalentLevel('hardBody', Infinity), 0);
  for (const invalid of [null, '25', -10, Infinity, NaN]) {
    sm.set('game.castleMeta.talentCap', invalid);
    assert.equal(c.Space.getTalentCap(), 20);
  }
  sm.set('game.castleMeta.talentCap', Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(c.Space.getTalentCap()));
  assert.ok(c.Space.getTalentCap() <= Number.MAX_SAFE_INTEGER);
}

// A legacy save's actual completed tier is honored without reviving its old expedition.
{
  const { c, sm, fill } = fixture();
  fill(20);
  c.Space.TALENTS.forEach(t => sm.set('game.castleMeta.peakTalent["' + t.id + '"]', 20));
  c.Space._grantStartingTalents();
  assert.equal(c.Space.getTalentCap(), 25);
  for (const t of c.Space.TALENTS) assert.equal(c.Space.getTalentLevel(t.id), 8);
}

// Shrine and Pillar training share the same pool and can unlock the next tier.
for (const entry of ['triggerShrine', 'triggerHashiraEncounter']) {
  const { c, sm, fill, event, progressed } = fixture();
  fill(20); sm.set('character.infinityTalents.ironWall', 19);
  c.Space[entry]();
  const buttons = event().scenes.start.buttons;
  if (entry === 'triggerHashiraEncounter') {
    assert.match(event().scenes.start.text.join(' '), /iron wall/);
    buttons.accept.onChoose();
  } else buttons.offer.onChoose();
  assert.equal(c.Space.getTalentLevel('ironWall'), 20);
  assert.equal(c.Space.getTalentCap(), 25);
  assert.equal(progressed(), 1);
  c.Space[entry]();
  assert.equal(c.Space.getTalentCap(), 25);
  const before = c.Space.TALENTS.reduce((sum, t) => sum + c.Space.getTalentLevel(t.id), 0);
  const nextButtons = event().scenes.start.buttons;
  (entry === 'triggerShrine' ? nextButtons.offer : nextButtons.accept).onChoose();
  const after = c.Space.TALENTS.reduce((sum, t) => sum + c.Space.getTalentLevel(t.id), 0);
  assert.equal(after, before + 1, entry + ' keeps providing actual training after breakthrough');
}

// Every tier continues to change actual combat getters without unsafe reductions/cooldowns.
{
  const { c, sm, fill, state } = fixture();
  sm.set('game.castleMeta.talentCap', 1005);
  for (const perk of ['water breath I', 'flame breath I', 'thunder breath I', 'mikiri']) sm.set('character.perks["' + perk + '"]', true);
  fill(20);
  const original = JSON.stringify(state), health = c.World.health;
  for (const t of c.Space.TALENTS) {
    const p = c.Space.talentPreview(t.id);
    assert.equal(p.next, 21);
    assert.equal(p.capped, false);
    assert.ok(p.before !== p.after || p.damageAfter > p.damageBefore, t.id + ' still grows after Lv.20');
    assert.match(c.Space.talentPreviewText(t.id), /→/);
  }
  assert.equal(JSON.stringify(state), original, 'previews do not mutate cap, talents or legacy');
  assert.equal(c.World.health, health);
  assert.ok(c.Space.getDamageReduction(21) > c.Space.getDamageReduction(20));
  assert.ok(c.Space.getCooldownMult(21) < c.Space.getCooldownMult(20));
  assert.ok(c.Space.getLifestealPct(21) > c.Space.getLifestealPct(20));
  assert.ok(c.Space.getDamageReduction(1000) < 0.4);
  assert.ok(c.Space.getCooldownMult(1000) > 0.4);
  assert.ok(c.Space.getLifestealPct(1000) < 0.2);
  assert.equal(c.Space.getDamageReduction(10), 0.15);
  assert.equal(c.Space.getCooldownMult(10), 0.85);
  const mult = c.Space.getDamageMult();
  c.Space.setTalentLevel('steadyHand', 21);
  assert.ok(c.Space.getDamageMult() > mult, 'accuracy overflow reaches real weapon damage');
  const steady = c.Space.talentPreview('steadyHand');
  assert.ok(steady.damageAfter > steady.damageBefore);
  assert.match(c.Space.talentPreviewText('steadyHand'), /excess accuracy weapon damage multiplier/);
  const blood = c.Space.getLifestealPct(10);
  assert.equal(blood, 0.125);
  assert.ok(c.Space.getLifestealPct(11) > blood, 'breath perks no longer make a blood upgrade worthless');
  delete c.World.BASE_HIT_CHANCE;
  assert.ok(c.Space.getSteadyHandDamageMult(21) > 1, 'older fixtures use the actual 0.8 hit chance default');
}

console.log('PASS: shared tier breakthroughs, non-maxed offers, Shrine/Pillar rewards, persistent 40% inheritance, read-only previews and useful bounded combat growth.');
