const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const c = {State:{},_:text=>text,AudioLibrary:{},Room:{},Outside:{},Events:{Setpieces:{}},
  Engine:{options:{},Perks:{},log(){},saveGame(){}},Notifications:{notify(){}},Math:Object.create(Math)};
c.$ = () => {throw new Error('stop after landmark setup');};
c.$.extend = (...values) => Object.assign(...values.filter(value=>typeof value !== 'boolean'));
c.$.Dispatch = () => ({publish(){}});
c.window = c;
vm.createContext(c);
for (const file of ['state_manager.js','world.js','early_game.js','events/global.js','events/setpieces.js','events/campaign.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
c.$SM = c.StateManager;
const sm = c.$SM, world = c.World, chapter = c.Events.Yoshiwara;
const copy = value => JSON.parse(JSON.stringify(value));
const map = () => Array.from({length:61},()=>Array(61).fill('.'));
const count = (map,tile) => map.flat().filter(cell=>typeof cell === 'string' && cell[0] === tile).length;
let old = map();
old[30][30] = 'A'; old[35][30] = 'I!'; old[48][30] = 'T!'; old[0][0] = 'Y!'; old[2][2] = 'P';
const positions = [[15,30],[16,30],[17,30],[18,30],[19,30],[20,30],[21,30],[22,30],[23,30],[24,30]];
positions.forEach(([x,y],i)=>old[x][y]=i%3 ? 'O' : 'O!');
sm.set('game.world',{map:old,mask:[[true,false]],mugentrain:true,ironmine:true});
sm.set('game.landmarksVisited',{O:true,Y:true});
sm.set('game.campaignClaims',{train:true}); sm.set('stores',{fur:12});
const original = copy(c.State);
assert.equal(world.ensureDistrictLandmarks(),true);
const migrated = sm.get('game.world.map');
assert.equal(count(migrated,'O'),1);
assert.equal(count(migrated,'D'),5);
assert.equal(count(migrated,'R'),4);
positions.forEach(([x,y])=>assert.equal(migrated[x][y].slice(1),old[x][y].slice(1),'cleared markers survive renaming'));
assert.deepEqual(copy(sm.get('game.world.mask')),original.game.world.mask);
assert.deepEqual(copy(sm.get('game.landmarksVisited')),original.game.landmarksVisited);
assert.deepEqual(copy(sm.get('game.campaignClaims')),original.game.campaignClaims);
assert.deepEqual(copy(sm.get('stores')),original.stores);
assert.equal(old[16][30],'O','an in-use map reference is never edited');
assert.equal(migrated[15][30],'D!','a cleared generic town is not reused as an inaccessible unfinished chapter');
assert.equal(migrated[0][0],'Y!');assert.equal(migrated[2][2],'P');assert.equal(migrated[35][30],'I!');
const after = JSON.stringify(c.State);
assert.equal(world.ensureDistrictLandmarks(),false);
assert.equal(JSON.stringify(c.State),after,'migration is idempotent');

// Completed old quests remain completed, even if every former town became an outpost.
old = map();old[30][30]='A';old[20][30]='P';old[48][30]='T';
sm.set('game.world.map',old);sm.set('game.yoshiwaraDone',true);
assert.equal(world.ensureDistrictLandmarks(),true);
assert.equal(count(sm.get('game.world.map'),'O'),1);
assert.ok(sm.get('game.world.map').flat().includes('O!'));
assert.equal(sm.get('game.world.map')[20][30],'P','cleared supply outposts are not repurposed');
assert.equal(sm.get('game.yoshiwaraDone'),true);
sm.set('game.world.map',Array.from({length:61},()=>Array(61).fill('P!')));
assert.equal(world.ensureDistrictLandmarks(),false,'a full map is never destructively regenerated');
sm.set('game.world.map',null);assert.equal(world.ensureDistrictLandmarks(),false);
sm.set('game.yoshiwaraDone',false);old=map();old[30][30]='A';old[15][30]='O!';old[16][30]='O!';
sm.set('game.world.map',old);assert.equal(world.ensureDistrictLandmarks(),true);
assert.equal(count(sm.get('game.world.map'),'O'),1);
assert.ok(sm.get('game.world.map').flat().includes('O'),'an unfinished old chapter gets an accessible entrance');
assert.equal(sm.get('game.world.map')[15][30],'D!');assert.equal(sm.get('game.world.map')[16][30],'R!');

// New maps contain exactly one O and nine independent generic towns.
c.State={};sm.set('features.location.world',true);sm.set('features.executioner',true);
old=map();old[30][30]='A';old[48][30]='T';sm.set('game.world.map',old);
assert.throws(()=>world.init({}),/stop after landmark setup/);
const generated = world.generateMap();
assert.equal(count(generated,'O'),1);assert.equal(count(generated,'D'),5);assert.equal(count(generated,'R'),4);
assert.equal(world.LANDMARKS.O.scene,'town');assert.equal(world.LANDMARKS.D.scene,'roadTown');assert.equal(world.LANDMARKS.R.scene,'marketTown');
assert.notEqual(c.Events.Setpieces.roadTown.title,c.Events.Setpieces.marketTown.title);
assert.notEqual(c.Events.Setpieces.roadTown.scenes.start.text,c.Events.Setpieces.marketTown.scenes.start.text);
assert.equal(c.Events.Setpieces.roadTown.scenes.start.buttons.enter.nextScene[0.3],'a1','ordinary town encounters stay intact');
assert.equal(c.Events.Setpieces.marketTown.scenes.end1.onLoad,c.Events.Setpieces.roadTown.scenes.end1.onLoad);

// Cleared old maps may have no D/R left. Generic town variants add no new
// exploration gate, while the unique district O and train T remain required.
const originalTypes=Object.keys(world.LANDMARKS).filter(tile=>!['P','D','R'].includes(tile));
sm.set('game.world.map',map());
assert.equal(count(sm.get('game.world.map'),'D')+count(sm.get('game.world.map'),'R'),0);
sm.set('game.landmarksVisited',Object.fromEntries(originalTypes.map(tile=>[tile,true])));
sm.set('game.castleMeta.perfectExploration',false);
assert.equal(world.recordLandmarkVisit('I'),true,'already visited old types can finish the award without nonexistent D/R');
assert.equal(sm.get('game.castleMeta.perfectExploration'),true);
sm.set('game.landmarksVisited',{});
assert.equal(world.recordLandmarkVisit('D'),false);
assert.equal(sm.get('game.castleMeta.perfectExploration'),true,'an already earned boon is never revoked');
for(const missing of ['O','T']) {
  sm.set('game.castleMeta.perfectExploration',false);
  sm.set('game.landmarksVisited',Object.fromEntries(originalTypes.filter(tile=>tile!==missing).map(tile=>[tile,true])));
  assert.equal(world.recordLandmarkVisit('D'),false,`generic D cannot substitute for ${missing}`);
  assert.equal(world.recordLandmarkVisit('R'),false,`generic R cannot substitute for ${missing}`);
  assert.equal(world.recordLandmarkVisit(missing),true,`the unique ${missing} is required`);
}
sm.set('game.castleMeta.perfectExploration',false);
sm.set('game.landmarksVisited',Object.fromEntries(originalTypes.filter(tile=>tile!=='X').map(tile=>[tile,true])));
world.state={map:map()};world.curPos=[15,30];world.state.map[15][30]='X';
c.Events.Executioner={'executioner-intro':{},'executioner-antechamber':{}};
c.Events.startEvent=()=>{};
world.doSpace();
assert.equal(sm.get('game.landmarksVisited.X'),true,'special executioner dispatch records its actual landmark');
assert.equal(sm.get('game.castleMeta.perfectExploration'),true);

// No information choice or failed/unfinished expedition can claim the district victory.
world.state={map:map()};world.curPos=[15,30];world.state.map[15][30]='O';c.Engine.activeModule=world;
assert.equal(chapter.ready(),false);sm.set('game.world.mugentrain',true);assert.equal(chapter.ready(),true);
chapter.resetSearch();chapter.gather('makio');chapter.gather('suma');
assert.equal(chapter.searchedAll(),false);assert.equal(chapter.finish(),false);
chapter.gather('hinatsuru');assert.equal(chapter.searchedAll(),true);
assert.equal(chapter.finish(),true);assert.equal(world.state.map[15][30],'O!');assert.equal(world.state.yoshiwara,true);
assert.equal(!!sm.get('game.yoshiwaraDone'),false,'finishing on the map does not commit the chapter');
assert.equal(!!sm.hasPerk('kehai dansha'),false,'training is not handed out before safe return');
assert.equal(chapter.finish(),false,'scene reentry cannot complete twice');
world.state=null;
assert.equal(chapter.commit(),false,'discarding the temporary map preserves uncompleted mainline state');
assert.equal(!!sm.get('game.yoshiwaraDone'),false);
world.state={map:map(),yoshiwara:true};
const chain={removeClass(){return this;},stop(){return this;},animate(){return this;}};
c.$=Object.assign(()=>chain,c.$);
c.Path={outfit:{},onArrival(){}};
world.testMap=()=>{};world.redeemBlueprints=()=>{};world.returnOutfit=()=>{};world.updateTravelGuide=()=>{};
assert.equal(world.goHome(),true,'the actual safe-return path commits the chapter');
assert.equal(world.state,null);
assert.equal(sm.get('game.world.yoshiwara'),true);
assert.equal(sm.get('game.yoshiwaraDone'),true);assert.equal(sm.hasPerk('kehai dansha'),true);
assert.equal(chapter.commit(),false,'safe return is a one-time chapter award');
chapter.resetSearch();assert.equal(chapter.searchedAll(),false,'search choices are not resumed between expeditions');

// All paths resolve to real scenes; all three searches are needed before advancing.
const scenes=c.Events.Setpieces.town.scenes;
assert.ok(Object.keys(scenes).length>=18);
assert.equal(Object.values(scenes).filter(scene=>scene.combat).length,3);
Object.values(scenes).forEach(scene=>Object.values(scene.buttons||{}).forEach(button=>{
  const next=button.nextScene;
  if(typeof next==='string') assert.ok(next==='end'||scenes[next],`missing scene: ${next}`);
}));
assert.equal(scenes.search.buttons.assemble.available(),false);
assert.equal(scenes.routes.buttons.alley.cost,undefined,'every player has a non-consumable rescue route');
assert.equal(scenes.routes.buttons.wisteria.cost['wisteria charm'],1);
assert.equal(scenes.dawn.onLoad,chapter.finish);
assert.match(scenes.together.text.join(' '),/同一时刻/);
assert.match(scenes.brother.text.join(' '),/不是独自/);
console.log('PASS: unique O, D/R settlements, safe/idempotent old-map migration, three-wife rescue, 3 battles, chapter graph and safe-return-only victory.');
