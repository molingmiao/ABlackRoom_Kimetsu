const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const chain = { length: 0, each() { return this; }, removeClass() { return this; }, stop() { return this; },
    animate() { return this; }, css() { return this; }, text() { return this; }, find() { return this; } };
  let active = null;
  const openedEvents = [];
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
  c.Events.eventStack = [];
  c.Events.eventPanel = () => chain;
  c.Events.updateButtons = () => {};
  c.Events.loadScene = name => { c.Events.activeScene = name; active.scenes[name].onLoad?.(); };
  // Replace only the DOM/fade side of event lifecycle. The entry point and buttonClick
  // remain production code, including live affordability/perk checks and deductions.
  c.Events.startEvent = event => {
    openedEvents.push(event);
    event.ending = false;
    c.Events.eventStack.unshift(event);
    active = event;
    c.Engine.keyLock = true;
    c.Engine.tabNavigation = false;
    c.Events.loadScene('start');
  };
  c.Events.endEvent = (onEnd, sourceEvent) => {
    const event = sourceEvent || active;
    if (!event || event.ending) return;
    event.ending = true;
    const index = c.Events.eventStack.indexOf(event);
    if (index >= 0) c.Events.eventStack.splice(index, 1);
    active = c.Events.eventStack[0] || null;
    c.Engine.keyLock = c.Events.eventStack.length > 0;
    c.Engine.tabNavigation = !c.Engine.keyLock;
    if (typeof onEnd === 'function') onEnd();
  };
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
  return { c, sm, world, chapter, enter, complete, pillars, openedEvents,
    setEvent(value) {
      active = value;
      c.Events.eventStack = value ? [value] : [];
      if (value) value.ending = false;
    } };
}
const snapshot = c => JSON.stringify(c.State);
const click = (c, id) => c.Events.buttonClick({ attr: () => id });

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
  sm.set('game.swordsmithBlueprintGranted', true);
  assert.equal(c.EarlyGame.smithBlueprintPending(), true, 'other blueprints and an old grant flag cannot hide a missing fixed blueprint');
  const inventory = JSON.stringify(sm.get('stores'));
  assert.equal(c.EarlyGame.claimSmithBlueprint(), true, 'the old flag can be repaired without rerunning K');
  assert.equal(sm.get('character.blueprints["wisteria oil"]'), true);
  assert.equal(sm.get('character.blueprints["wind armour"]'), true);
  assert.equal(sm.get('character.blueprints["bind kunai"]'), null);
  assert.equal(sm.get('game.swordsmithBlueprintGranted'), true);
  assert.equal(JSON.stringify(sm.get('stores')), inventory, 'repairing the fixed blueprint does not duplicate equipment or supplies');
  assert.equal(c.EarlyGame.smithBlueprintPending(), false);
  const known = snapshot(c);
  assert.equal(c.EarlyGame.claimSmithBlueprint(), false);
  assert.equal(snapshot(c), known);
  assert.match(c.EarlyGame.milestones().find(task => task.id === 'pillars').hint, /大厅主线栏补领/);
  assert.match(c.EarlyGame.benefit('wreck'), /P 只是补给驿站/);
}

// The Hall's entry is deterministic, free, and respects story/location/modal guards.
{
  const f = fixture(), { c, sm } = f;
  sm.set('stores', { 'cured meat': 0, meat: 500, torch: 0 });
  sm.set('character.blueprints', { 'wind armour': true });
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'a blueprint alone cannot skip K');
  sm.set('game.swordsmithChapterDone', true);
  sm.set('character.blueprints', { 'wind armour': false });
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'false blueprint entries do not count');
  sm.set('character.blueprints', {});
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'K without any real blueprint remains blocked');
  sm.set('character.blueprints', { 'wind armour': true });
  assert.equal(c.EarlyGame.canStartPillarTraining(), true, 'any actual blueprint retains the existing training route');
  c.Engine.keyLock = true;
  assert.equal(c.EarlyGame.startPillarTraining(), false);
  c.Engine.keyLock = false;
  c.document = { querySelector: () => ({}) };
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'an open modal cannot be overlaid by a second event');
  delete c.document;
  f.setEvent({ scenes: {} });
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'an active event cannot be replaced');
  f.setEvent(null);
  for (const location of [c.World, c.Outside]) {
    c.Engine.activeModule = location;
    assert.equal(c.EarlyGame.startPillarTraining(), false, 'training is only opened in the Hall');
  }
  c.Engine.activeModule = c.Room;
  assert.equal(f.openedEvents.length, 0, 'blocked attempts never call startEvent');
  const before = snapshot(c);
  const originalRandom = c.Math.random;
  c.Math.random = () => { throw new Error('opening training must not wait for or roll a random event'); };
  assert.equal(c.EarlyGame.startPillarTraining(), true);
  c.Math.random = originalRandom;
  assert.equal(snapshot(c), before, 'opening the council is free, even with no training materials');
  assert.equal(f.openedEvents[0], f.pillars);
  assert.equal(c.Events.activeEvent(), f.pillars);
  assert.equal(c.Events.activeScene, 'start');
  assert.equal(c.Events.eventStack.length, 1);
  assert.equal(c.Engine.keyLock, true);
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'rapid repeated clicks cannot double-open');
  assert.equal(f.openedEvents.length, 1);
  click(c, 'choose');
  assert.equal(c.Events.activeScene, 'select');
  assert.equal(snapshot(c), before, 'entering the choice screen still does not consume resources');
  click(c, 'review');
  assert.equal(c.Events.activeScene, 'select');
  assert.equal(snapshot(c), before, 'raw meat does not satisfy cured-meat training costs');
  click(c, 'leave');
  assert.equal(c.Events.activeEvent(), null);
  assert.equal(c.Engine.keyLock, false);
  assert.equal(!!sm.get('game.pillarConvocationDone'), false, 'declining is not successful training');
  assert.equal(snapshot(c), before, 'declining is free');
  assert.equal(c.EarlyGame.startPillarTraining(), true, 'declined training can be reopened immediately');
  assert.equal(f.openedEvents.length, 2);
  click(c, 'humble');
  click(c, 'leave');
  assert.equal(snapshot(c), before);
}

// All ordinary options cost exactly 50 cured meat and one torch; Wind costs 80.
for (const [choice, food, perk] of [
  ['flame', 50, 'slash mastery'], ['water', 50, 'step yushin'],
  ['mist', 50, 'mikiri'], ['love', 50, 'breath nourish'],
  ['serpent', 50, 'kehai dansha'], ['review', 50, null], ['wind', 80, 'fist form master']
]) {
  const f = fixture(), { c, sm } = f;
  sm.set('game.swordsmithVillageDone', true);
  sm.set('character.blueprints["wisteria oil"]', true);
  sm.set('stores', { 'cured meat': food, torch: 1, meat: 100, steel: 8 });
  const before = snapshot(c);
  assert.equal(c.EarlyGame.startPillarTraining(), true);
  assert.equal(snapshot(c), before);
  click(c, 'choose');
  assert.equal(snapshot(c), before);
  sm.set('stores["cured meat"]', food - 1);
  const lowFood = snapshot(c);
  click(c, choice);
  assert.equal(snapshot(c), lowFood, choice + ': one short cannot partially charge or mark completion');
  sm.set('stores["cured meat"]', food);
  sm.set('stores.torch', 0);
  const missingTorch = snapshot(c);
  click(c, choice);
  assert.equal(snapshot(c), missingTorch, choice + ': missing torch cannot consume the food first');
  sm.set('stores.torch', 1);
  click(c, choice);
  assert.equal(c.Events.activeScene, 'thanks');
  assert.equal(sm.get('game.pillarConvocationDone'), true);
  assert.equal(sm.get('stores["cured meat"]'), 0, choice + ': exact live food charge');
  assert.equal(sm.get('stores.torch'), 0, choice + ': exact live torch charge');
  assert.equal(sm.get('stores.meat'), 100);
  assert.equal(sm.get('stores.steel'), 8);
  if (perk) assert.equal(sm.hasPerk(perk), true);
  if (choice === 'wind') {
    assert.equal(sm.hasPerk('fist form one'), true);
    assert.equal(sm.hasPerk('fist form four'), true);
  }
  click(c, 'rest');
  assert.equal(c.Events.activeEvent(), null);
  assert.equal(c.Engine.keyLock, false);
  assert.equal(c.EarlyGame.pillarTrainingPending(), false);
  const done = snapshot(c);
  assert.equal(c.EarlyGame.startPillarTraining(), false, 'completed training cannot be reopened');
  assert.equal(snapshot(c), done);
  assert.equal(f.openedEvents.length, 1);
}

// Veteran saves that already know every offered perk still have a paid completion route.
{
  const f = fixture(), { c, sm } = f;
  sm.set('game.swordsmithChapterDone', true);
  sm.set('character.blueprints["wind armour"]', true);
  for (const perk of ['slash mastery', 'step yushin', 'mikiri', 'breath nourish', 'kehai dansha', 'fist form master']) sm.addPerk(perk);
  sm.set('stores', { 'cured meat': 50, torch: 1 });
  assert.equal(c.EarlyGame.startPillarTraining(), true);
  click(c, 'choose');
  const before = snapshot(c);
  click(c, 'flame');
  assert.equal(snapshot(c), before, 'an already learned training is not charged');
  click(c, 'review');
  assert.equal(sm.get('game.pillarConvocationDone'), true);
  assert.equal(sm.get('stores["cured meat"]'), 0);
  assert.equal(sm.get('stores.torch'), 0);
}

// Existing carried light sources substitute for the torch without being consumed.
{
  const f = fixture(), { c, sm } = f;
  sm.set('game.swordsmithChapterDone', true);
  sm.set('character.blueprints["wisteria oil"]', true);
  sm.set('stores', { 'cured meat': 50, torch: 0 });
  c.Path.outfit['firefly orb'] = 1;
  sm.set('outfit', c.Path.outfit);
  assert.equal(c.EarlyGame.startPillarTraining(), true);
  click(c, 'choose');
  click(c, 'review');
  assert.equal(c.Events.activeScene, 'thanks');
  assert.equal(sm.get('game.pillarConvocationDone'), true);
  assert.equal(sm.get('stores["cured meat"]'), 0, 'a carried orb only substitutes for the torch, not food');
  assert.equal(sm.get('stores.torch'), 0);
  assert.equal(c.Path.outfit['firefly orb'], 1, 'training never consumes the carried orb');
  assert.equal(sm.get('outfit["firefly orb"]'), 1);
}

console.log('PASS: safe-home K fixed-blueprint backfill and old-flag repair; immediate free Hall training, retry/cancel/reentry guards, live 50/80 food + torch fees, unchanged real Pillar/Sun/Moon gates.');
