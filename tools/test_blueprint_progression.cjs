const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const chain = { length: 0, each() { return this; }, removeClass() { return this; }, stop() { return this; },
    animate() { return this; }, css() { return this; }, text() { return this; }, find() { return this; } };
  let active = null;
  const c = { State: {}, _: text => text, AudioLibrary: {}, AudioEngine: { playSound() {} },
    Room: {}, Outside: {}, Path: { outfit: {}, onArrival() {} }, Events: { Setpieces: {}, _LEAVE_COOLDOWN: 1 },
    Engine: { options: {}, Perks: {}, log() {}, saveGame() {}, event() {} }, Notifications: { notify() {} },
    Math: Object.create(Math), clearInterval() {} };
  c.$ = () => chain;
  c.$.extend = (...values) => Object.assign(...values.filter(value => typeof value !== 'boolean'));
  c.$.Dispatch = () => ({ publish() {} });
  c.window = c;
  vm.createContext(c);
  for (const file of ['state_manager.js', 'world.js', 'early_game.js', 'events.js', 'events/global.js',
    'events/campaign.js', 'events/story_chapters.js', 'combat_styles.js', 'breathing_cultivation.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), c);
    if (file === 'events.js') c.Events.Setpieces = {};
  }
  c.$SM = c.StateManager;
  const sm = c.$SM, world = c.World, chapter = c.Events.StoryChapters;
  c.Engine.activeModule = c.Room;
  c.Events.activeEvent = () => active;
  c.Events.eventPanel = () => chain;
  c.Events.updateButtons = () => {};
  c.Events.loadScene = name => { c.Events.activeScene = name; active.scenes[name].onLoad?.(); };
  c.EarlyGame.render = () => {};
  world.testMap = world._reportExpeditionSummary = world.updateTravelGuide = () => {};
  const enter = () => {
    const map = Array.from({ length: 61 }, () => Array(61).fill('.'));
    map[30][30] = 'A'; map[52][30] = 'K';
    sm.set('game.world', { map, mask: [[true]] });
    sm.set('game.yoshiwaraDone', true);
    world.state = JSON.parse(JSON.stringify(sm.get('game.world')));
    world.curPos = [52, 30]; world.dead = false; c.Engine.activeModule = world;
    chapter.reset('swordsmith');
  };
  const complete = () => {
    chapter.definitions.swordsmith.required.forEach(key => chapter.mark('swordsmith', key));
    assert.equal(chapter.finish('swordsmith'), true);
  };
  const pillars = c.Events.Global.find(event => event.title === 'The Pillars Convene');
  return { c, sm, world, chapter, enter, complete, pillars, setEvent(value) { active = value; } };
}
const snapshot = c => JSON.stringify(c.State);

// New K completion always has a deterministic blueprint, but only after a safe home return.
{
  const f = fixture(), { c, sm, chapter, world } = f;
  sm.set('stores', { 'nichirin katana': 2, steel: 7 });
  f.enter();
  const before = snapshot(c);
  c.Events.Setpieces.swordsmithVillage.scenes.final.onLoad();
  assert.equal(snapshot(c), before, 'skipping required support/battles cannot issue the reward');
  f.complete();
  assert.equal(!!sm.get('character.blueprints["wisteria oil"]'), false);
  assert.equal(chapter.grantSwordsmithBlueprint(), false, 'in-flight rewards are not committed');
  assert.equal(chapter.commit(), false, 'publishing no safe map cannot award a blueprint');
  const savedWorld = JSON.stringify(sm.get('game.world'));
  world.die('failed K return');
  assert.equal(world.state, null);
  assert.equal(!!sm.get('game.swordsmithChapterDone'), false);
  assert.equal(!!sm.get('character.blueprints["wisteria oil"]'), false);
  assert.equal(!!sm.get('game.swordsmithBlueprintGranted'), false);
  assert.equal(JSON.stringify(sm.get('game.world')), savedWorld);
  assert.equal(world.goHome(), false);
  f.enter();
  assert.equal(chapter.has('swordsmith', 'forge'), false, 'a failed run cannot resume chapter choices');
  f.complete(); assert.equal(world.goHome(), true);
  assert.equal(sm.get('character.blueprints["wisteria oil"]'), true);
  assert.equal(sm.get('game.swordsmithBlueprintGranted'), true);
  assert.equal(sm.get('game.swordsmithVillageDone'), true);
  assert.equal(sm.get('game.swordsmithChapterDone'), true);
  assert.equal(sm.get('stores["nichirin katana"]'), 3);
  assert.equal(sm.get('stores.steel'), 7);
  assert.equal(!!sm.get('game.pillarConvocationDone'), false, 'the blueprint is not a training completion');
  c.Engine.activeModule = c.Room;
  assert.equal(f.pillars.isAvailable(), true, 'safe K reward unblocks the actual Pillar event');
  const after = snapshot(c);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(chapter.grantSwordsmithBlueprint(), false);
  assert.equal(chapter.commit(), false);
  assert.equal(snapshot(c), after, 'revisits and duplicate claims do not duplicate weapons/resources/blueprints');
}

// Both old and new completion flags support a safe, explicit, once-only Hall backfill.
for (const flag of ['game.swordsmithVillageDone', 'game.swordsmithChapterDone']) {
  const f = fixture(), { c, sm, chapter } = f;
  sm.set(flag, true);
  sm.set('stores', { 'nichirin katana': 4, scales: 17, 'cured meat': 2, torch: 1 });
  sm.set('character.blueprints', { 'wind armour': false });
  sm.set('game.campaignClaims', { smiths: true });
  assert.equal(f.pillars.isAvailable(), false, 'false blueprint keys do not satisfy the event');
  assert.equal(c.EarlyGame.smithBlueprintPending(), true);
  const before = snapshot(c), resources = JSON.stringify(sm.get('stores')), claims = JSON.stringify(sm.get('game.campaignClaims'));
  c.Engine.activeModule = c.World;
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(chapter.grantSwordsmithBlueprint(), false);
  c.Engine.activeModule = c.Outside;
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  c.Engine.activeModule = c.Room;
  f.setEvent({ scenes: {} }); assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(snapshot(c), before, 'wrong place or active event cannot backfill rewards');
  f.setEvent(null);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), true);
  assert.equal(c.EarlyGame.smithBlueprintPending(), false);
  assert.equal(sm.get('character.blueprints["wisteria oil"]'), true);
  assert.equal(sm.get('character.blueprints["wind armour"]'), false);
  assert.equal(JSON.stringify(sm.get('stores')), resources);
  assert.equal(JSON.stringify(sm.get('game.campaignClaims')), claims);
  assert.equal(!!sm.get('game.pillarConvocationDone'), false);
  assert.equal(c.EarlyGame.storyPrerequisite('pillars'), true);
  assert.equal(f.pillars.isAvailable(), true);
  const claimed = snapshot(c);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(snapshot(c), claimed);
}

// Replaying full K after the old village success grants the missing blueprint, not a second blade.
{
  const f = fixture(), { c, sm } = f;
  sm.set('game.swordsmithVillageDone', true);
  sm.set('stores', { 'nichirin katana': 2 });
  sm.set('game.campaignClaims', { smiths: true, pillars: true });
  f.enter(); f.complete(); assert.equal(f.world.goHome(), true);
  assert.equal(sm.get('stores["nichirin katana"]'), 2);
  assert.equal(sm.get('character.blueprints["wisteria oil"]'), true);
  assert.equal(sm.get('game.campaignClaims.smiths'), true);
  assert.equal(sm.get('game.campaignClaims.pillars'), true);
  assert.equal(!!sm.get('game.pillarConvocationDone'), false);
}

// This extra blueprint never impersonates real Pillar training or Sun/Moon practice thresholds.
{
  const f = fixture(), { c, sm } = f;
  sm.set('game.swordsmithChapterDone', true);
  sm.set('game.castleMeta.totalFloors', 200); sm.set('game.castleMeta.bossKilled', 10);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), true);
  assert.equal(c.CombatStyles.isUnlocked('sun'), false);
  assert.equal(c.CombatStyles.isUnlocked('moon'), false);
  f.setEvent(f.pillars); c.Events.activeScene = 'select';
  sm.set('stores', { 'cured meat': 49, torch: 1 });
  c.Events.buttonClick({ attr: () => 'review' });
  assert.equal(!!sm.get('game.pillarConvocationDone'), false, 'insufficient training food stays blocked');
  sm.set('stores["cured meat"]', 50);
  c.Events.buttonClick({ attr: () => 'review' });
  assert.equal(sm.get('game.pillarConvocationDone'), true, 'the actual paid training reaches its completion scene');
  assert.equal(sm.get('stores["cured meat"]'), 0); assert.equal(sm.get('stores.torch'), 0);
  assert.equal(c.CombatStyles.isUnlocked('sun'), true); assert.equal(c.CombatStyles.isUnlocked('moon'), true);
  for (const [id, floors, bosses] of [['sun', 80, 5], ['moon', 120, 8]]) {
    sm.set('game.castleMeta.totalFloors', floors - 1); sm.set('game.castleMeta.bossKilled', bosses);
    assert.equal(c.CombatStyles.isUnlocked(id), false, id + ' keeps its floor requirement');
    sm.set('game.castleMeta.totalFloors', floors); sm.set('game.castleMeta.bossKilled', bosses - 1);
    assert.equal(c.CombatStyles.isUnlocked(id), false, id + ' keeps its Boss requirement');
  }
}
{
  const f = fixture(), { c, sm } = f;
  const before = snapshot(c);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(f.chapter.grantSwordsmithBlueprint(), false);
  assert.equal(snapshot(c), before, 'uncompleted villages cannot claim a free prerequisite');
  sm.set('game.swordsmithVillageDone', true); sm.set('character.blueprints["wisteria oil"]', true);
  assert.equal(c.EarlyGame.smithBlueprintPending(), false, 'already known fixed blueprints do not display a duplicate claim');
  sm.set('character.blueprints', { 'wind armour': true, 'wisteria oil': false, 'bind kunai': null });
  assert.equal(c.EarlyGame.smithBlueprintPending(), false, 'any already unlocked blueprint preserves the original training path without a new claim step');
  const known = snapshot(c);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(snapshot(c), known);
  assert.match(c.EarlyGame.milestones().find(task => task.id === 'pillars').hint, /大厅主线栏补领/);
  assert.match(c.EarlyGame.benefit('wreck'), /试验设施 P/);
}
console.log('PASS: deterministic safe-home K blueprint, explicit one-time old/new save backfill, death/reentry safety, unchanged rewards and real Pillar/Sun/Moon gates.');
