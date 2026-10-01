const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const persistent = {game: {world: {mugentrain: false}}, stores: {medicine: 2, scales: 12}};
const initialPersistent = JSON.stringify(persistent);
const existingEvent = {title: 'existing setpiece'};
let ready = false;
let readyChecks = 0;
let marked = 0;
const context = {
  Events: {Setpieces: {existing: existingEvent}, _LEAVE_COOLDOWN: 1},
  EarlyGame: {trainReady() {readyChecks++; return ready;}},
  AudioLibrary: {LANDMARK_TOWN: 'town.flac'},
  $SM: {
    get() {return persistent;},
    set() {throw new Error('chapter must not mutate persistent state');},
    add() {throw new Error('chapter must not grant permanent inventory');},
    addM() {throw new Error('chapter must not grant permanent rewards');}
  },
  World: {
    curPos: [1, 2],
    state: {map: [[';', ';', ';'], [';', ';', 'T']]},
    markVisited(x, y) {marked++; this.state.map[x][y] += '!';}
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/events/campaign.js'), 'utf8'), context);
const event = context.Events.Setpieces.mugenTrain;
const scenes = event.scenes;
assert.equal(context.Events.Setpieces.existing, existingEvent, 'adding the chapter preserves existing setpieces');
assert.equal(event.title, '无限列车');
assert.equal(scenes.start.buttons.board.available(), false, 'incomplete prerequisites disable boarding');
ready = true;
assert.equal(scenes.start.buttons.board.available(), true, 'boarding checks the shared campaign prerequisites');
assert.equal(readyChecks, 2);
context.World.state.mugentrain = true;
assert.equal(scenes.start.buttons.board.available(), false, 'a completed temporary chapter cannot be replayed for more loot');
delete context.World.state.mugentrain;
const temporary = context.World.state;
context.World.state = null;
assert.equal(scenes.start.buttons.board.available(), false, 'boarding requires an active world expedition');
scenes.dawn.onLoad();
assert.equal(marked, 0, 'loading the finale without a temporary world cannot create progress');
context.World.state = temporary;

const reached = new Set();
const pending = ['start'];
while (pending.length) {
  const name = pending.shift();
  if (name === 'end' || reached.has(name)) continue;
  assert.ok(scenes[name], 'scene reference exists: ' + name);
  reached.add(name);
  const scene = scenes[name];
  assert.equal(scene.reward, undefined, 'no direct warehouse reward: ' + name);
  for (const button of Object.values(scene.buttons || {})) {
    assert.equal(typeof button.nextScene, 'string', 'chapter transitions are deterministic');
    assert.ok(button.nextScene === 'end' || scenes[button.nextScene], 'every transition resolves');
    pending.push(button.nextScene);
  }
  if (!scene.combat && name !== 'dawn') {
    const exits = Object.values(scene.buttons).filter(button => button.nextScene === 'end');
    assert.ok(exits.length, 'non-combat scenes allow abandoning the task: ' + name);
    assert.equal(scene.onLoad, undefined, 'visiting an unfinished scene cannot mark completion');
    const before = JSON.stringify(context.World.state);
    for (const exit of exits) {
      if (exit.onChoose) exit.onChoose();
      if (exit.onEnd) exit.onEnd();
    }
    assert.equal(JSON.stringify(context.World.state), before, 'abandoning does not mark the chapter completed');
  }
}
assert.deepEqual([...reached].sort(), Object.keys(scenes).sort(), 'all scenes are reachable');
const fights = Object.values(scenes).filter(scene => scene.combat);
assert.equal(fights.length, 1, 'there is exactly one ordinary world fight');
assert.equal(fights[0].health, 40);
assert.equal(fights[0].damage, 6);
assert.equal(fights[0].attackDelay, 2.5);
assert.equal(fights[0].hit, 0.85);
assert.match(fights[0].enemy, /enmu/);
assert.doesNotMatch(fights[0].enemy + fights[0].enemyName, /akaza|猗窝座/i, 'the player does not fight or kill Akaza');
assert.match(scenes.hashira.text.join(' '), /猗窝座.*逃入林中/);
assert.equal(scenes.dawn.loot, undefined, 'the finale cannot be revisited for loot');
assert.equal(scenes.dawn.reward, undefined, 'campaign rewards remain explicit, one-time claims');
assert.equal(marked, 0, 'no early scene marks chapter completion');

const storyPath = ['start', 'dream', 'flesh', 'passengers', 'hashira', 'dawn'];
for (let i = 0; i < storyPath.length - 1; i++) {
  assert.ok(Object.values(scenes[storyPath[i]].buttons).some(button => button.nextScene === storyPath[i + 1]), 'story advances in order');
}
scenes.dawn.onLoad();
assert.equal(context.World.state.mugentrain, true, 'completion exists only on the temporary world');
assert.equal(context.World.state.map[1][2], 'T!');
assert.equal(marked, 1);
scenes.dawn.onLoad();
assert.equal(marked, 1, 'repeated finale loads do not append another visited marker');
assert.equal(JSON.stringify(persistent), initialPersistent, 'completion never changes saved progress or warehouse inventory');
context.World.state = JSON.parse(JSON.stringify(persistent.game.world));
assert.equal(context.World.state.mugentrain, false, 'discarding the temporary expedition discards chapter completion');
console.log('Infinite Train chapter tests passed.');
