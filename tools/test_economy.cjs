const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const c = {_:s=>s, AudioLibrary:{}, Events:{}, Math:Object.create(Math)};
c.window=c;
vm.createContext(c);
for (const file of ['room.js','space.js','events/encounters.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
}
const expected = drop => drop.chance * (drop.min + Math.max(drop.min,drop.max-1)) / 2;
const valid = loot => Object.values(loot).forEach(drop=>{
  assert.ok(Number.isInteger(drop.min) && drop.min > 0);
  assert.ok(Number.isInteger(drop.max) && drop.max >= drop.min);
  assert.ok(drop.chance > 0 && drop.chance <= 1);
});
let last=0;
for (let floor=1;floor<=99;floor++) {
  const normal=c.Space._battleLoot(floor,false), elite=c.Space._battleLoot(floor,true);
  valid(normal);valid(elite);
  assert.equal(normal.scales.chance,1);
  assert.equal(elite.scales.chance,1);
  assert.ok(expected(normal.scales)>=last,'deeper normal encounters never reduce scale income');
  assert.ok(expected(elite.scales)>expected(normal.scales),'elite risk pays more scales');
  assert.equal(elite.cloth.chance,1);
  if (floor>=10) assert.ok(normal.cloth);
  last=expected(normal.scales);
}
for (const floor of c.Space.BOSS_FLOORS) {
  const loot=c.Space._bossLoot(floor);valid(loot);
  for (const item of ['scales','teeth','cloth']) assert.equal(loot[item].chance,1);
  assert.ok(loot.scales.min>=20);
  assert.ok(expected(loot.scales)>expected(c.Space._battleLoot(floor,true).scales));
}
assert.equal(c.Space._battleLoot(1,false)['demon stone'],undefined,'common shallow fights do not farm rare crow currency');
assert.equal(c.Space._battleLoot(90,false)['demon stone'].chance,0.25,'rare drop rate unchanged');
// Both random boundaries: scale bonus is independent of the original treasure selection.
for (const random of [0,0.999999]) {
  c.Math.random=()=>random;
  for (const floor of [1,10,25,50,99]) {
    const loot=c.Space._rollTreasure(floor),tier=Math.floor(floor/10);
    assert.ok(loot.scales>=5+tier && loot.scales<=10+2*tier);
    assert.ok(Object.keys(loot).some(key=>key!=='scales'),'bonus must not replace the existing treasure');
  }
}
const encounter = name => c.Events.Encounters.find(e=>e.scenes.start.enemy===name).scenes.start.loot.scales;
assert.equal(encounter('blood mist demon').chance,0.8,'opening encounters remain unchanged');
assert.equal(encounter('spider demon spawn').chance,1);
assert.equal(encounter('water demon').chance,1);
assert.ok(expected(encounter('thunder demon'))>expected(encounter('spider demon spawn')));
assert.equal(c.Room.TradeGoods.medicine.cost().scales,20);
assert.equal(c.Room.TradeGoods['wisteria bullet'].cost().scales,4);
assert.equal(c.Room.TradeGoods['demon stone'].cost().scales,250);
assert.equal(c.Room.TradeGoods.compass.cost().scales,20,'opening gate unchanged');
const furExchangeCosts = {
  scales: {fur:15},
  teeth: {fur:30},
  iron: {fur:15,scales:50},
  coal: {fur:20,teeth:50},
  steel: {fur:30,scales:50,teeth:50},
  'demon stone': {fur:150,scales:250,teeth:100},
  compass: {fur:40,scales:20,teeth:10}
};
for (const [item,cost] of Object.entries(furExchangeCosts)) {
  assert.deepEqual(JSON.parse(JSON.stringify(c.Room.TradeGoods[item].cost())),cost,`${item}: exchange fur is one tenth; other ingredients stay unchanged`);
}
assert.deepEqual(Object.keys(c.Room.TradeGoods).filter(item=>c.Room.TradeGoods[item].cost().fur).sort(),Object.keys(furExchangeCosts).sort(),'every fur-consuming exchange is covered');
for (const [item,fur] of [['lodge',10],['trading post',100],['tannery',50]]) {
  assert.equal(c.Room.Craftables[item].cost().fur,fur,'construction fur costs must not receive the purchase discount');
}
// Exercise actual purchase accounting, including quantity and failed purchases.
let stores={scales:40,teeth:24,medicine:0};
const itemKey=key=>key.replace(/^stores[.\["']+/, '').replace(/[\]"']+$/, '');
c.$=button=>button;
c.$SM={get(key){return stores[itemKey(key)] || 0;},setM(key,values){Object.assign(stores,values);},add(key,n){stores[itemKey(key)]=(stores[itemKey(key)]||0)+n;}};
c.Engine={options:{testerMode:false}};
c.Notifications={notify(){}};
c.AudioEngine={playSound(){}};
c.Room.buy({attr:()=> 'medicine'}, {shiftKey:true,customQuantity:2});
assert.deepEqual(stores,{scales:0,teeth:0,medicine:2});
stores={scales:40,teeth:11,medicine:2};
const beforeBuy=JSON.stringify(stores);
assert.equal(c.Room.buy({attr:()=> 'medicine'}),false);
assert.equal(JSON.stringify(stores),beforeBuy,'missing second ingredient does not partially charge the first');
// Use the real purchase handler for every discounted exchange, including its quantity cap.
for (const [item,cost] of Object.entries(furExchangeCosts)) {
  const quantity=item==='compass'?1:3;
  const stockForPurchase=()=>({...Object.fromEntries(Object.entries(cost).map(([ingredient,price])=>[ingredient,price*quantity])),[item]:0,wood:37});
  stores=stockForPurchase();
  assert.equal(c.Room._getBuyMax(item,c.Room.TradeGoods[item]),quantity);
  c.Room.buy({attr:()=>item},{shiftKey:true,customQuantity:item==='compass'?99:quantity});
  assert.deepEqual(stores,{...Object.fromEntries(Object.keys(cost).map(ingredient=>[ingredient,0])),[item]:quantity,wood:37},`${item}: batch purchase charges the discounted fur and every unchanged ingredient`);
  if (item==='compass') {
    const atMaximum=JSON.stringify(stores);
    c.Room.buy({attr:()=>item},{shiftKey:true,customQuantity:99});
    assert.equal(JSON.stringify(stores),atMaximum,'compass maximum remains one even with bulk purchases');
  }
  for (const missing of Object.keys(cost)) {
    stores=stockForPurchase(); stores[missing]--;
    const before=JSON.stringify(stores);
    assert.equal(c.Room._getBuyMax(item,c.Room.TradeGoods[item]),quantity-1,`${item}: quantity preview is limited by ${missing}`);
    assert.equal(c.Room.buy({attr:()=>item},{shiftKey:true,customQuantity:quantity}),false);
    assert.equal(JSON.stringify(stores),before,`${item}: insufficient ${missing} neither consumes another ingredient nor grants the item`);
  }
}
// Revisiting the same treasure scene cannot mint a second reward.
c.$SM.addM=(key,values)=>Object.keys(values).forEach(item=>{stores[item]=(stores[item]||0)+values[item];});
let treasureEvent;
c.Events.startEvent=event=>{treasureEvent=event;};
c.Space.currentFloor=25;
c.Math.random=()=>0.999999;
c.Space.triggerTreasure();
treasureEvent.scenes.start.onLoad();
const afterTreasure=JSON.stringify(stores);
treasureEvent.scenes.start.onLoad();
assert.equal(JSON.stringify(stores),afterTreasure,'treasure scene grants once');
// A ten-floor illustrative route, not a promise of encounter frequency or player win rate.
for (const floor of [10,30,60,90]) {
  const normal=c.Space._battleLoot(floor-1,false),elite=c.Space._battleLoot(floor-1,true),boss=c.Space._bossLoot(floor);
  const scales=6*expected(normal.scales)+expected(elite.scales)+expected(boss.scales);
  const teeth=6*expected(normal.teeth)+expected(elite.teeth)+expected(boss.teeth);
  assert.ok(scales>=40 && scales<300,'six normal fights, one elite and boss support supplies without explosive inflation');
  assert.ok(teeth>=24,'route materials support at least two boss-shop medicines');
  console.log(`MODEL floor ${floor}: six normal wins + one elite + boss = ${scales.toFixed(1)} scales, ${teeth.toFixed(1)} teeth expected (no prestige bonus).`);
}
console.log('PASS: guaranteed materials, bounded floor growth, elite/boss incentives, treasure bonus, tenth-price fur exchanges, unchanged non-fur/construction costs and atomic batch purchases.');
