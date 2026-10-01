const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Keep the actual worker-income registration and StateManager batch accounting.
// Only view rendering and scheduled timer execution are stubbed.
const ui = { empty() { return this; }, addClass() { return this; }, text() { return this; }, appendTo() { return this; } };
const c = {
  State: {}, _: text => text, AudioLibrary: {}, Space: {},
  Engine: { activeModule: {}, log() {}, saveGame() {}, getIncomeMsg() { return ''; }, setTimeout() { return 1; } },
  $: () => ui
};
c.$.Dispatch = () => ({ publish(event) { c.Outside.handleStateUpdates(event); } });
c.window = c;
vm.createContext(c);
for (const file of ['state_manager.js', 'outside.js', 'room.js', 'camp_guide.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), c);
}
const sm = c.$SM, outside = c.Outside;
c.Room.updateIncomeView = outside.updateVillage = outside.updateWorkersView = () => {};
const plain = value => JSON.parse(JSON.stringify(value));
const expectedBatch = workers => ({ meat: workers ? -2 * workers : 0, wood: workers ? -5 * workers : 0, 'cured meat': workers });
function reset(workers, stores, income = {}, reserves = {}) {
  c.State = { stores: { ...stores }, game: { population: workers, workers: { charcutier: workers }, productionReserves: reserves }, income };
  c.Engine.activeModule = outside;
  outside.updateVillageIncome();
}
function assertRecipe(workers) {
  assert.deepEqual(plain(sm.getIncome('charcutier').stores), expectedBatch(workers));
  assert.equal(sm.getIncome('charcutier').delay, 10, 'production cadence remains every ten seconds');
}
assert.deepEqual(plain(outside._INCOME.charcutier.stores), expectedBatch(1));
assert.equal(c.Room.Craftables['cured meat'], undefined, 'the recipe adjustment must not introduce a new manual-crafting feature');
assert.deepEqual(plain(c.Room.Craftables.smokehouse.cost()), { wood: 480, meat: 50 }, 'the smokehouse construction price is unchanged');

for (const workers of [0, 1, 2, 7]) {
  reset(workers, { wood: 10 * workers, meat: 4 * workers, 'cured meat': 13, fur: 9 });
  assertRecipe(workers);
  const registered = plain(c.State.stores);
  outside.updateVillageIncome();
  assert.deepEqual(plain(c.State.stores), registered, 'registering or re-registering workers neither crafts food nor charges inputs');
  sm.collectIncome();
  assert.deepEqual(plain(c.State.stores), { wood: 5 * workers, meat: 2 * workers, 'cured meat': 13 + workers, fur: 9 }, 'each assigned worker produces one portion from exactly five wood and two raw meat');
  assert.equal(sm.getIncome('charcutier').timeLeft, 10);
  for (let second = 0; second < 9; second++) sm.collectIncome();
  assert.equal(c.State.stores['cured meat'], 13 + workers, 'the recipe discount does not speed up production');
  sm.collectIncome();
  assert.deepEqual(plain(c.State.stores), { wood: 0, meat: 0, 'cured meat': 13 + 2 * workers, fur: 9 }, 'the next ten-second batch uses the identical recipe');
}

for (const workers of [1, 2, 5]) {
  for (const missing of ['wood', 'meat']) {
    const stock = { wood: 5 * workers, meat: 2 * workers, 'cured meat': 13, fur: 9 };
    stock[missing]--;
    reset(workers, stock);
    const before = plain(c.State.stores);
    sm.collectIncome();
    assert.deepEqual(plain(c.State.stores), before, 'one insufficient ingredient blocks the whole assigned-worker batch without partial deductions or output');
    assert.equal(sm.getIncome('charcutier').timeLeft, 10, 'shortages retain the original production schedule');
    const info = c.CampGuide.production(c.State.income, c.State.stores);
    const row = info.rows.find(item => item.key === 'charcutier');
    assert.equal(row.missing.length, 1);
    assert.equal(row.missing[0].item, missing);
    assert.equal(row.missing[0].amount, missing === 'wood' ? 5 * workers : 2 * workers, 'diagnostics quote the actual whole-worker batch');
    sm.add('stores["' + missing + '"]', 1);
    sm.getIncome('charcutier').timeLeft = 0;
    sm.collectIncome();
    assert.deepEqual(plain(c.State.stores), { wood: 0, meat: 0, 'cured meat': 13 + workers, fur: 9 }, 'production recovers using both exact-boundary inputs after restocking');
  }
}

{
  const oldIncome = { charcutier: { delay: 10, timeLeft: 7, stores: { wood: -10, meat: -10, 'cured meat': 2 } } };
  reset(2, { wood: 20, meat: 8, 'cured meat': 0 }, oldIncome);
  assertRecipe(2);
  assert.equal(sm.getIncome('charcutier').timeLeft, 7, 'old assigned workers adopt the cheaper recipe without resetting their countdown');
  for (let second = 0; second < 6; second++) sm.collectIncome();
  assert.equal(c.State.stores['cured meat'], 0);
  sm.collectIncome();
  assert.deepEqual(plain(c.State.stores), { wood: 10, meat: 4, 'cured meat': 2 });
  c.State = plain(c.State);
  outside.updateVillageIncome();
  assertRecipe(2);
  assert.equal(sm.getIncome('charcutier').timeLeft, 10, 'save/reload retains the normal timer');
  sm.set('game.population', 4, true);
  sm.set('game.workers["charcutier"]', 4);
  assertRecipe(4);
  assert.equal(sm.getIncome('charcutier').timeLeft, 10, 'changing worker assignments applies the new group rate through the existing state-update path');
  sm.set('game.workers["charcutier"]', 0);
  assertRecipe(0);
}
{
  reset(2, { wood: 19, meat: 4, 'cured meat': 0 }, {}, { wood: 10 });
  const before = plain(c.State.stores);
  sm.collectIncome();
  assert.deepEqual(plain(c.State.stores), before, 'protected reserves still block a whole production batch');
  reset(2, { wood: 20, meat: 4, 'cured meat': 0 }, {}, { wood: 10 });
  sm.collectIncome();
  assert.deepEqual(plain(c.State.stores), { wood: 10, meat: 0, 'cured meat': 2 }, 'production runs at the exact reserve boundary');
  c.Engine.activeModule = c.Space;
  const state = JSON.stringify(c.State);
  sm.collectIncome();
  assert.equal(JSON.stringify(c.State), state, 'Infinite Castle continues to suspend village production');
}
console.log('PASS: real cured-meat recipe, ten-second cadence, whole-worker atomic batches, shortages/restocking, existing assignments/save timers, production diagnostics and reserves.');
