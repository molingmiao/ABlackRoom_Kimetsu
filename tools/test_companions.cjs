const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let now = 1000000000, hour = 6, active = null, modal = false, published = 0, onPublish = null;
let mountainDone = true, saves = 0;
class ClockDate extends Date {
  constructor(...args) {super(...(args.length ? args : [now]));}
  static now() {return now;}
  getHours() {return hour;}
}
const c = {
  State:{}, _:text => text, Room:{}, Outside:{}, World:{}, Space:{}, Path:{},
  Events:{Global:[{title:'existing event'}], activeEvent(){return active;}},
  Engine:{keyLock:false,activeModule:null,saveGame(){saves++;},log(){}},
  EarlyGame:{worldChapterCleared(tile){assert.equal(tile,'M');return mountainDone;}},
  document:{querySelector(){return modal ? {} : null;}},
  Date:ClockDate, Math:Object.create(Math), AudioLibrary:{},
  $:Object.assign(()=>({}),{Dispatch(){return {publish(event){published++;if(onPublish) onPublish(event);}};}})
};
c.window = c;
c.Math.random = () => 0;
vm.createContext(c);
for (const file of ['state_manager.js','events/companions.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
c.$SM = c.StateManager;
const sm = c.$SM, api = c.Events.Companions, event = api.event;
const copy = value => JSON.parse(JSON.stringify(value));
function reset(stage=0) {
  c.State = {game:{prologue:{done:true},world:{}},stores:{wood:7},features:{location:{path:true}}};
  if(stage >= 1) sm.set('game.world.mugentrain',true,true);
  if(stage >= 2) sm.set('game.yoshiwaraDone',true,true);
  now += api.ENTRY_COOLDOWN + 1; hour = 6; active = null; modal = false; c.Engine.keyLock = false;
  c.Engine.activeModule = c.Room; c.Events.activeScene = null; c.Room._buyDialog = null;
  c.Room._scrapDialog = null; mountainDone = true; onPublish = null; api._session = null;
}
function open() {
  assert.equal(event.isAvailable(),true);
  active = event; c.Events.activeScene = 'start'; c.Engine.keyLock = true;
  assert.equal(api.begin(),true);
  assert.match(event.scenes.start.text[0],/本地时段/);
  assert.equal(Object.keys(event.scenes.start.buttons).length,3);
}
function finish(index=0) {
  c.Events.activeScene = 'reply' + index;
  return api.complete(index);
}

assert.equal(c.Events.Global.length,2,'one global pool entry, not twelve extra weighted entries');
assert.equal(c.Events.Global[0].title,'existing event');
assert.equal(c.Events.Global[1],event);
assert.equal(event.storySupply,true);
assert.deepEqual(copy(c.State),{},'registration does not mutate a save');
assert.equal(api.entries.length,12);
assert.equal(new Set(api.entries.map(entry=>entry.id)).size,12);
for(const [at,expected] of [[0,'night'],[4,'night'],[5,'morning'],[9,'morning'],[10,'day'],[16,'day'],[17,'dusk'],[20,'dusk'],[21,'night'],[23,'night']]) {
  hour = at; assert.equal(api.period(),'night'===expected ? 'night' : expected,`clock boundary ${at}`);
}
reset();
let before = JSON.stringify(c.State);
assert.equal(event.isAvailable(),true);
assert.equal(JSON.stringify(c.State),before,'availability is read-only');
mountainDone = false;
assert.equal(event.isAvailable(),false,'no trio in the opening cabin before rehabilitation');
sm.set('game.butterflyEstateDone',true,true); assert.equal(event.isAvailable(),true);
sm.set('game.butterflyEstateDone',false,true); mountainDone = true;
for(const module of [c.World,c.Space,c.Path]) {
  c.Engine.activeModule = module; assert.equal(event.isAvailable(),false,'no journey, castle or loadout interruption');
}
c.Engine.activeModule = c.Outside; assert.equal(event.isAvailable(),true,'courtyard permits letters');
c.Engine.activeModule = c.Room;
for(const blocker of ['event','key','modal','buy','scrap','loadout']) {
  active = blocker==='event' ? {scenes:{fight:{combat:true}}} : null;
  c.Engine.keyLock = blocker==='key'; modal = blocker==='modal';
  c.Room._buyDialog = blocker==='buy' ? {} : null; c.Room._scrapDialog = blocker==='scrap' ? {} : null;
  c.LoadoutEditor = {_dialog:blocker==='loadout' ? {} : null};
  assert.equal(event.isAvailable(),false,`blocked by ${blocker}`);
}
delete c.LoadoutEditor;

// Every stage/clock episode can choose either a genuine alternative outcome.
const hours = {morning:6,day:12,dusk:18,night:23};
for(const entry of api.entries) {
  for(let choice=0;choice<2;choice++) {
    reset(entry.stage); hour = hours[entry.period];
    const mainline = copy({world:c.State.game.world,yoshiwara:c.State.game.yoshiwaraDone});
    const inventory = copy(c.State.stores);
    open(); assert.equal(api._session.entry.id,entry.id);
    assert.ok(event.scenes.start.buttons['reply'+choice].text.includes('首次'));
    assert.ok(event.scenes.start.buttons['reply'+choice].text.includes(api.rewardText(entry.choices[choice].reward)));
    let reentrant = null;
    onPublish = update => {
      if(update.category === 'stores') {
        assert.equal(sm.get('game.companionInteractions.entries.' + entry.id + '.claimed'),true,'flag exists before inventory publication');
        reentrant = api.complete(choice);
      }
    };
    assert.equal(finish(choice),true);
    assert.equal(reentrant,false,'reentrant inventory callbacks cannot grant twice');
    for(const [item,quantity] of Object.entries(entry.choices[choice].reward)) {
      assert.equal(sm.get('stores["'+item+'"]'),(inventory[item]||0)+quantity);
    }
    before = JSON.stringify(c.State);
    assert.equal(finish(choice),false); assert.equal(finish(1-choice),false);
    assert.equal(JSON.stringify(c.State),before,'reloading the outcome or changing answer is idempotent');
    assert.deepEqual(copy({world:c.State.game.world,yoshiwara:c.State.game.yoshiwaraDone}),mainline,'letters never complete chapters');
    onPublish = null; active = null; c.Engine.keyLock = false;
    assert.equal(event.isAvailable(),false,'shared and per-entry cooldown start even when time is accelerated elsewhere');
    now += api.COOLDOWN + 1;
    assert.equal(event.isAvailable(),false,'same entry still waits its full hour');
    now += api.ENTRY_COOLDOWN;
    open(); assert.match(event.scenes.start.buttons.reply0.text,/已领过补给/);
    const stores = JSON.stringify(c.State.stores);
    assert.equal(finish(1-choice),true);
    assert.equal(JSON.stringify(c.State.stores),stores,'another answer in a later visit cannot farm supply');
  }
}

reset();open();
assert.equal(finish(9),false,'invalid answer cannot grant reward');
assert.equal(api.complete(0),false,'wrong active scene cannot claim');
c.Events.activeScene = 'reply0'; c.Engine.activeModule = c.World;
assert.equal(api.complete(0),false,'switching away from home invalidates the response');
c.Engine.activeModule = c.Room; modal = true;
assert.equal(api.complete(0),false,'a newly opened modal blocks the response');
modal = false; active = {title:'different event'};
assert.equal(api.complete(0),false,'foreign event cannot claim another event session');
active = event;assert.equal(api.complete(0),true);

// Decline/reload waits, while a deliberately changed clock can never duplicate rewards.
active = null;c.Engine.keyLock = false;
now -= 2 * api.ENTRY_COOLDOWN;
assert.equal(event.isAvailable(),true,'clock moved backwards does not permanently lock dialogue');
const stores = JSON.stringify(c.State.stores);
open();assert.equal(finish(1),true);assert.equal(JSON.stringify(c.State.stores),stores);
active = null;c.Engine.keyLock = false;now += api.ENTRY_COOLDOWN + 1;
open();active = null;c.Engine.keyLock = false;
assert.equal(event.isAvailable(),false,'declining still respects its cooldown');

reset();sm.set('features.location.spaceShip',true,true);
assert.equal(api.stage(),2,'legacy endgame saves see post-district letters instead of opening rehabilitation');
sm.set('game.swordsmithVillageDone',true,true);
assert.match(api.entries.find(entry=>entry.id==='districtMorning').text().join(' '),/刀匠村的支援已安全交付/);
assert.match(api.entries.find(entry=>entry.id==='districtNight').text().join(' '),/不同地点/);
assert.ok(saves>0 && published>0,'choices persist and refresh inventory');

// Chapter trio branches preserve the original battle and safe-return completion routes.
c.Events.Setpieces = {};c.Events._LEAVE_COOLDOWN = 1;
c.World.state = {map:[['T']],mugentrain:false};c.World.curPos = [0,0];c.World.TILE = {TOWN:'O'};
c.World.markVisited = () => {throw new Error('unfinished trio scenes cannot mark the map');};
let healed = 0;c.Events.restoreHealth = (amount,item) => {assert.equal(item,'medicine');healed+=amount;};
vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/events/campaign.js'),'utf8'),c);
const train = c.Events.Setpieces.mugenTrain, district = c.Events.Setpieces.town;
assert.equal(train.storySupply,true);assert.equal(district.storySupply,true);
assert.equal(train.scenes.dream.buttons.defend.nextScene,'flesh','old direct rescue path stays available');
assert.equal(train.scenes.dream.buttons.coordinate.nextScene,'trioPlan');
assert.equal(train.scenes.trioPlan.buttons.dress.cost.medicine,1);
c.World.getMaxHealth = () => 100; c.World.health = 100;
assert.equal(train.scenes.trioPlan.buttons.dress.available(),false,'full-health characters do not waste medicine');
c.World.health = 70;
assert.equal(train.scenes.trioPlan.buttons.dress.available(),true);
const unchangedState = JSON.stringify(c.State), temporary = JSON.stringify(c.World.state);
train.scenes.trioPlan.buttons.dress.onChoose();assert.equal(healed,10);
for(const id of ['trioListening','trioRoute','trioDressing']) {
  assert.equal(train.scenes[id].buttons.defend.nextScene,'flesh');
  assert.equal(train.scenes[id].onLoad,undefined,'trio visit never marks chapter progress');
}
for(const id of ['trioTanjiro','trioZenitsu','trioInosuke']) {
  assert.equal(district.scenes[id].buttons.back.nextScene,'search');
  assert.equal(district.scenes[id].onLoad,undefined,'trio clues cannot substitute for three-wife investigation');
}
assert.equal(JSON.stringify(c.State),unchangedState);
assert.equal(JSON.stringify(c.World.state),temporary);
console.log('PASS: 12 chapter-aware local-time trio interactions, 24 choices, single pool entry, safe home/modal gates, persisted one-time rewards, replay/reentrancy and clock-change safety; optional train/district trio branches preserve battles and safe-return progress.');
