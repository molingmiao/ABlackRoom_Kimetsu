const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let now = 100000, selected = 'water';
const meta = { totalFloors: 18, totalHealed: 190, peakTalent: { hardBody: 2 } };
const saved = {}, writes = [];
const c = {
  _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
  Date: { now: () => now },
  $SM: {
    get(key) { return key === 'game.castleMeta' ? meta : saved[key]; },
    set(key, value) { writes.push(key); saved[key] = value; }
  },
  Path: { outfit: { medicine: 2, 'cured meat': 1 } },
  Space: {
    currentFloor: 1, MAX_FLOOR: 100,
    TALENTS: [{ id: 'hardBody', nameKey: 'hardened body', maxLevel: 20 }],
    getPermanentHpBonus: () => meta.totalFloors >= 20 ? 8 : 0,
    getPermanentDmgMult: () => meta.totalFloors >= 50 ? 0.05 : 0,
    getPermanentDR: () => 0,
    getHealMult: () => meta.totalHealed >= 200 ? 1.1 : 1,
    getStartingTalentLevel: (id, peak) => peak >= 6 ? 2 : peak >= 3 ? 1 : 0
  },
  CombatStyles: { getSelected: () => selected, definition: id => ['water', 'technique'].includes(id), getName: id => 'name:' + id }
};
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/castle_report.js'), 'utf8'), c);
const r = c.CastleReport;
r.begin();
c.Space.currentFloor = 10;
const first = { enemy: 'demon', combat: true };
r.startFight(first); r.startFight(first);
r.recordDamage(20, 'normal attack');
r.recordDamage(30, 'blood art');
r.recordDamage(10, 'bleeding');
r.recordDamage(NaN, 'normal attack'); r.recordDamage(-10, 'normal attack');
r.recordHealing(10, 'water style');
r.recordConsumption('medicine', 2); r.recordConsumption('medicine', 1);
r.recordKill(); r.recordKill();
now += 92000;
c.Space.currentFloor = 12;
meta.totalFloors = 21;
meta.totalHealed = 205;
meta.peakTalent.hardBody = 6;
r.startFight({ enemy: 'boss', combat: true });
assert.deepEqual(writes, [], 'an active run must not be persisted');
const report = r.finish('death');
assert.equal(report.highestFloor, 12);
assert.equal(report.durationSeconds, 92);
assert.equal(report.fights, 2);
assert.equal(report.kills, 1);
assert.equal(report.damageTaken, 60);
assert.equal(report.healingReceived, 10);
assert.equal(report.consumed.medicine, 3);
assert.equal(report.healingRemaining, 3);
assert.equal(report.growth.floors, 3);
assert.equal(report.growth.healed, 15);
assert.equal(report.growth.hp, 8);
assert.equal(report.growth.healing, 10);
assert.equal(report.growth.talents[0].inheritedBefore, 0);
assert.equal(report.growth.talents[0].inheritedAfter, 2);
assert.ok(r.suggestions(report)[0].includes('blood arts'));
assert.ok(r.suggestions(report)[1].includes('29 more floors'));
assert.equal(r._styleName('technique'), 'name:technique');
assert.deepEqual(writes, ['game.castleLastReport']);
assert.equal(r._run, null);
const stored = JSON.stringify(saved['game.castleLastReport']);
r.recordDamage(500, 'late callback');
r.recordKill();
r.finish('retreat');
assert.equal(JSON.stringify(saved['game.castleLastReport']), stored, 'late events cannot rewrite a completed result');
const copy = r.getLastReport();
copy.highestFloor = 99;
assert.equal(r.getLastReport().highestFloor, 12, 'summary readers do not mutate saved data');
assert.equal('scene' in report, false);
assert.equal('outfit' in report, false);
assert.equal('floorNodes' in report, false);
assert.equal(r.show(), false, 'headless callers do not create a dialog');

selected = 'technique'; c.Space.currentFloor = 1;
r.begin();
assert.equal(writes.length, 1);
const second = r.finish('retreat');
assert.equal(second.highestFloor, 1);
assert.equal(second.damageTaken, 0);
assert.equal(second.kills, 0);
assert.equal(second.growth.floors, 0);
assert.equal(second.growth.talents.length, 0);
assert.equal(second.styles[0], 'technique');
assert.equal(writes.length, 2);

// Do not describe an empty starting loadout or a voluntary retreat as exhausted supplies.
const adviceReport = { outcome: 'death', damageSources: [], damageTaken: 90, healingReceived: 20,
  healingRemaining: 0, consumed: {}, growth: { totalFloors: 0 } };
assert.equal(r.suggestions(adviceReport).some(line => line.includes('ran out')), false);
adviceReport.consumed.medicine = 2;
assert.equal(r.suggestions(adviceReport).some(line => line.includes('ran out')), true);
adviceReport.outcome = 'retreat';
assert.equal(r.suggestions(adviceReport).some(line => line.includes('ran out')), false);

// A used vigor potion must not mutate the recipe for the next bottle.
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/space.js'), 'utf8'), c);
c.window = c;
c.Notifications = { notify() {} };
c.World = { health: 35, getMaxHealth: () => 100, setHp(hp) { this.health = hp; } };
c.Space.addMetaHealed = () => { throw Error('report accounting must not change free-potion legacy growth'); };
const potion = c.Space.POTIONS.find(item => item.id === 'vigor');
r.begin();
c.Space._drinkPotion(potion);
c.Space._applyPotion({ hp: 50, dmg: 5 });
assert.equal(c.World.health, 100);
assert.equal(r._run.healingReceived, 65);
assert.equal(potion.effect.healFull, true, 'the shared vigor recipe remains usable');
c.World.health = 70;
c.Space._applyPotion({ hp: 50, dmg: 5 });
assert.equal(c.World.health, 70, 'one bottle only heals at the first battle');
assert.equal(r._run.healingReceived, 65);
c.Space._drinkPotion(potion);
c.Space._applyPotion({ hp: 50, dmg: 5 });
assert.equal(c.World.health, 100, 'a fresh bottle restores health again');
assert.equal(r._run.healingReceived, 95);
c.Space._drinkPotion(potion);
c.Space._applyPotion({ hp: 50, dmg: 5 });
assert.equal(r._run.healingReceived, 95, 'full-health preparation is not counted as healing');
r.finish('retreat');
console.log('PASS: report damage, healing, consumption, kill deduplication, inheritance deltas, accurate advice, reusable vigor potions, immutable summaries and no resumable run state.');
