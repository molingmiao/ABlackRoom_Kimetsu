const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const messages = [], publications = [];
  let clears = 0, dialog, saves = 0, reportContext;
  const element = {
    text() { return this; }, animate() { return this; }, addClass() { return this; },
    css() { return this; }, attr() { return this; }
  };
  const $ = () => element;
  $.Dispatch = () => ({ publish(event) {
    publications.push({ event, stores: JSON.parse(JSON.stringify(ctx.State.stores)), module: ctx.Engine.activeModule });
  } });
  const ctx = {
    $, State: {}, document: {},
    _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    Engine: { options: { testerMode: false }, isLightsOff: () => false, saveGame() { saves++; }, log() {} },
    AudioEngine: { playSound() {}, playBackgroundMusic() {} }, AudioLibrary: {},
    Button: { setDisabled(_, value) { element.disabled = value; }, clearCooldown() { clears++; } },
    Events: { activeEvent: () => null, startEvent(event) { dialog = event; } },
    Notifications: { notify(_, message) { messages.push(message); } },
    CastleReport: { begin() { reportContext = { module: ctx.Engine.activeModule, hp: ctx.World.health }; } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['state_manager.js', 'world.js', 'path.js', 'space.js', 'combat_styles.js', 'ship.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), ctx);
  }
  ctx.$SM = ctx.StateManager;
  ctx.State = {
    stores: { 'nichirin katana': 1, medicine: 8, 'wind armour': 1 },
    outfit: { 'nichirin katana': 1, medicine: 3 },
    character: { equipped: { primary: ['nichirin katana'], secondary: [], tool: [] }, perks: {} },
    game: { spaceShip: { crows: 2 } }
  };
  ctx.Path.outfit = ctx.State.outfit;
  ctx.Engine.activeModule = ctx.Ship;
  ctx.Space.generateFloors = ctx.Space.showFloor = () => {};
  return { ctx, messages, publications, clears: () => clears, dialog: () => dialog, saves: () => saves, report: () => reportContext };
}
const copy = value => JSON.parse(JSON.stringify(value));

{
  const { ctx: c } = fixture();
  const before = copy(c.State);
  let info = c.Ship.getDepartureInfo();
  assert.match(info.warnings.join(' '), /needs a usable control weapon/);
  assert.equal(info.errors.length, 0, 'style mismatch is advisory');
  assert.equal(info.weapons[0].key, 'nichirin katana');
  assert.equal(info.healing[0].amount, 3);
  assert.deepEqual(copy(c.State), before, 'preflight never changes equipment, stocks or loadout');

  c.State.character.equipped.tool = ['bind kunai'];
  c.State.stores['bind kunai'] = c.Path.outfit['bind kunai'] = 1;
  assert.ok(!c.Ship.getDepartureInfo().warnings.some(w => /control weapon/.test(w)));
  for (const style of ['water', 'thunder', 'flame']) {
    c.State.character.castleStyle = style;
    c.State.character.perks[style + ' breath I'] = true;
    assert.ok(!c.Ship.getDepartureInfo().warnings.length, 'katana is compatible with ' + style);
  }
  c.State.character.equipped.primary = [];
  info = c.Ship.getDepartureInfo();
  assert.match(info.warnings.join(' '), /flame form needs/);
  assert.ok(!info.weapons.some(w => w.key === 'nichirin katana'), 'packed but unequipped weapons are not advertised as usable');
  for (const style of ['water', 'thunder']) {
    c.State.character.castleStyle = style;
    assert.match(c.Ship.getDepartureInfo().warnings.join(' '), /fists and ranged attacks do not activate/);
  }
  c.State.character.equipped.primary = ['flame blade'];
  assert.match(c.Ship.getDepartureInfo().warnings.join(' '), /equipped but not packed: flame blade/);
}

{
  const { ctx: c } = fixture();
  c.State.character.equipped.secondary = ['nichirin gun', 'thunder gun'];
  for (const weapon of c.State.character.equipped.secondary) c.State.stores[weapon] = c.Path.outfit[weapon] = 1;
  let info = c.Ship.getDepartureInfo();
  assert.equal(info.weapons.find(w => w.key === 'thunder gun').uses, 0);
  assert.match(info.warnings.join(' '), /no ammunition for thunder gun/);
  c.Path.outfit['solar crystal'] = 7;
  c.State.stores['solar crystal'] = 9;
  info = c.Ship.getDepartureInfo();
  assert.equal(info.weapons.find(w => w.key === 'thunder gun').uses, 7);
  assert.equal(info.weapons.find(w => w.key === 'nichirin gun').uses, 7);
  assert.match(c.Ship.departureSummary(info).join(' '), /share the supply/);
  assert.ok(!info.warnings.some(w => /ammunition/.test(w)));
  c.State.character.equipped.tool = ['kusarigama'];
  c.State.stores.kusarigama = c.Path.outfit.kusarigama = 2;
  assert.equal(c.Ship.getDepartureInfo().weapons.find(w => w.key === 'kusarigama').uses, 2, 'consumable control weapons use their own stock');
  c.State.stores.medicine = 1;
  assert.equal(c.Ship.getDepartureInfo().healing[0].amount, 1, 'summary only counts valid stocked supplies');
}

for (const invalid of ['missing stock', 'missing crow', 'negative', 'fraction', 'not number', 'infinite']) {
  const f = fixture(), c = f.ctx;
  if (invalid === 'missing stock') c.State.stores.medicine = 1;
  if (invalid === 'missing crow') c.State.game.spaceShip.crows = 0;
  if (invalid === 'negative') c.Path.outfit.medicine = -1;
  if (invalid === 'fraction') c.Path.outfit.medicine = 1.5;
  if (invalid === 'not number') c.Path.outfit.medicine = '3';
  if (invalid === 'infinite') c.Path.outfit.medicine = Infinity;
  const before = copy(c.State);
  assert.equal(c.Ship.descend(), false, invalid);
  assert.deepEqual(copy(c.State), before, 'failed departure is atomic: ' + invalid);
  assert.equal(c.Engine.activeModule, c.Ship);
  assert.equal(f.clears(), 1, 'failed departure clears the liftoff cooldown');
  assert.equal(f.publications.length, 0, 'failure does not publish partial deductions');
  assert.ok(f.messages[0]);
}

{
  const f = fixture(), c = f.ctx;
  c.Ship.checkDescend();
  assert.match(f.dialog().scenes.start.text.join(' '), /chosen form: battle technique/);
  const descend = f.dialog().scenes.start.buttons.descend;
  assert.equal(descend.onChoose, undefined, 'departure begins after the confirmation has closed');
  assert.equal(descend.nextScene, 'end');
  c.State.stores.medicine = 0;
  assert.equal(descend.onEnd(), false, 'inventory is checked again when confirming, not just while opening the dialog');
  assert.equal(c.State.game.spaceShip.crows, 2);
  assert.equal(c.State.stores['nichirin katana'], 1);
  assert.equal(c.State.game.spaceShip.seenWarning, undefined);
}

{
  const f = fixture(), c = f.ctx;
  c.State.character.castleStyle = 'water';
  c.State.character.perks['water breath I'] = true;
  c.State.game.castleMeta = { totalFloors: 200, peakTalent: { hardBody: 20 }, perfectExploration: true };
  c.World.dead = true;
  assert.equal(c.Ship.descend(), true);
  assert.equal(c.State.game.spaceShip.crows, 1);
  assert.equal(c.State.stores.medicine, 5);
  assert.equal(c.State.stores['nichirin katana'], 0);
  assert.equal(c.Path.outfit.medicine, 3);
  assert.equal(c.State.outfit, c.Path.outfit);
  assert.equal(c.World.dead, false, 'a fresh run clears the previous death flag');
  assert.equal(c.World.health, 162, '85 base + 40 inherited + 16 permanent + 21 explorer HP');
  assert.equal(c.World.health, c.World.getMaxHealth());
  assert.equal(f.report().module, c.Space, 'report starts with the castle context already active');
  assert.equal(f.report().hp, 162);
  assert.equal(c.document.title, 'Upper Castle');
  for (const update of f.publications) {
    assert.equal(update.stores.medicine, 5);
    assert.equal(update.stores['nichirin katana'], 0, 'listeners see only complete deductions');
    assert.equal(update.module, c.Space);
  }
  const before = copy(c.State);
  assert.equal(c.Ship.descend(), false, 'duplicate clicks cannot start and charge another run');
  assert.deepEqual(copy(c.State), before);
}

{
  const f = fixture(), c = f.ctx;
  c.Engine.options.testerMode = true;
  c.State.game.spaceShip.crows = 0;
  c.State.stores = {};
  const before = copy(c.State.stores);
  assert.equal(c.Ship.descend(), true, 'tester mode preserves free entry');
  assert.deepEqual(copy(c.State.stores), before);
  assert.equal(c.State.game.spaceShip.crows, 0);
}
console.log('departure tests passed: advisory form/ammo checks, atomic stock validation, stale confirmations, cooldown recovery, full inherited HP and fresh-run context');
