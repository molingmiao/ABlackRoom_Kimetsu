const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const state={};
const get=(key)=>key.split(/[.\[\]"']+/).filter(Boolean).reduce((v,k)=>v&&v[k],state);
const set=(key,value)=>{const keys=key.split(/[.\[\]"']+/).filter(Boolean);let o=state;for(const k of keys.slice(0,-1)) o=o[k]||(o[k]={});o[keys.at(-1)]=value;};
const jquery={hide(){return this;},show(){return this;},text(){return this;},attr(){return this;},length:0};
let notify=[],reportMoves=[];
const c={_:s=>s,$:()=>jquery,$SM:{get:(key,zero)=>get(key)??(zero?0:undefined),set,hasPerk:key=>!!get('character.perks.'+key),add:(key,n)=>set(key,(get(key)||0)+n)},
  Engine:{activeModule:null,keyLock:false,log(){}},AudioLibrary:{},AudioEngine:{playSound(){}},Notifications:{notify:(m,text)=>notify.push(text)},
  Events:{activeEvent:()=>null},Room:{Craftables:{}},Path:{outfit:{},getWeight:()=>1},ExpeditionReport:{recordMove:n=>reportMoves.push(n)}};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/world.js'),'utf8'),c);
const W=c.World, originalCheckDanger=W.checkDanger, plain=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(W.travelBudget(1,0,0,2,1)),{steps:0,food:0,water:0},'village arrival costs no supplies');
assert.deepEqual(plain(W.travelBudget(5,1,0,2,1)),{steps:4,food:2,water:4});
assert.deepEqual(plain(W.travelBudget(5,0,1,4,2)),{steps:4,food:1,water:2},'perk periods and partial cycles respected');
for(const rate of [1,2,4]) for(let phase=0;phase<rate;phase++) for(let distance=0;distance<35;distance++) {
  let ticks=phase,consumed=0;
  for(let n=0;n<Math.max(0,distance-1);n++) {ticks++;if(ticks>=rate){ticks=0;consumed++;}}
  assert.equal(W.travelBudget(distance,phase,phase,rate,rate).food,consumed,'estimate matches the real ordinary-terrain reset loop');
}
W.state={map:[],mask:[]};W.curPos=[W.RADIUS+3,W.RADIUS+2];W.dead=false;c.Engine.activeModule=W;
W.foodMove=1;W.waterMove=0;W.health=W.BASE_HEALTH;W.water=6;c.Path.outfit={'cured meat':4};
let info=W.travelInfo();assert.equal(info.direction,'西3 格、北2 格');assert.equal(info.distance,5);assert.equal(info.status,'normal');
const unchanged=JSON.stringify([state,W.state,c.Path.outfit,W.water,W.foodMove,W.waterMove]);W.travelInfo();assert.equal(JSON.stringify([state,W.state,c.Path.outfit,W.water,W.foodMove,W.waterMove]),unchanged,'risk computation read-only');
W.water=4;assert.equal(W.travelInfo().status,'caution');W.water=3;assert.equal(W.travelInfo().status,'danger');
W.water=6;W.thirst=true;assert.equal(W.travelInfo().status,'danger');W.thirst=false;
W.health=1;assert.equal(W.travelInfo().status,'caution');W.health=W.BASE_HEALTH;
set('character.perks.breath no food',true);set('character.perks.breath no water',true);
info=W.travelInfo();assert.equal(info.budget.food,1);assert.equal(info.budget.water,2);
c.Engine.activeModule=c.Path;assert.equal(W.travelInfo(),null,'guide does not inspect castle or camp');assert.equal(W.move([1,0]),false);
c.Engine.activeModule=W;W.dead=true;assert.equal(W.move([1,0]),false);W.dead=false;
c.Events.activeEvent=()=>({});assert.equal(W.move([1,0]),false);c.Events.activeEvent=()=>null;
c.Engine.keyLock=true;assert.equal(W.move([1,0]),false);c.Engine.keyLock=false;
assert.equal(W.move([2,0]),false);assert.equal(W.move([1,1]),false);W.curPos=[0,0];assert.equal(W.move([-1,0]),false);
W.state=null;assert.equal(W.move([1,0]),false);assert.equal(W.goHome(),false,'duplicate return is rejected before mutating stores');
W.state={map:Array.from({length:W.RADIUS*2+1},()=>Array(W.RADIUS*2+1).fill(W.TILE.FOREST)),mask:[]};W.curPos=[W.RADIUS,W.RADIUS];
W.narrateMove=W.lightMap=W.drawMap=W.updateTravelGuide=()=>{};W.checkDanger=()=>false;
W.doSpace=()=>{W.dead=true;W.state=null;};
assert.equal(W.move([1,0]),true);assert.deepEqual(reportMoves,[1],'fatal move recorded before the run is finished');assert.equal(get('game.maxDistance'),1);
W.dead=false;W.state={};c.Path.outfit={'cured meat':0};W.foodMove=1;W.waterMove=0;W.starvation=true;
set('character.perks',{});let cause;W.die=reason=>{cause=reason;};
assert.equal(W.useSupplies(),false);assert.equal(cause,'food');
c.Path.outfit={'cured meat':5};W.foodMove=0;W.waterMove=0;W.water=0;W.thirst=true;W.starvation=false;
assert.equal(W.useSupplies(),false);assert.equal(cause,'water');
// A legal empty backpack must not bypass starvation with undefined-- => NaN.
W.updateSupplies=()=>{};W.setWater=n=>{W.water=n;};W.setHp=n=>{W.health=Math.min(W.getMaxHealth(),n);};
for(const invalidFood of [undefined,NaN,Infinity,-1]) {
  c.Path.outfit={};if(invalidFood!==undefined)c.Path.outfit['cured meat']=invalidFood;
  W.foodMove=1;W.waterMove=0;W.water=10;W.starvation=false;W.thirst=false;cause=null;
  assert.equal(W.useSupplies(),true);assert.equal(c.Path.outfit['cured meat'],0);assert.equal(W.starvation,true);
  W.foodMove=1;assert.equal(W.useSupplies(),false);assert.equal(cause,'food','empty or invalid rations retain the original starvation grace period');
}
c.Path.outfit={'cured meat':1};W.foodMove=1;W.waterMove=0;W.water=1;W.health=1;W.starvation=true;W.thirst=true;cause=null;
assert.equal(W.useSupplies(),true);assert.equal(c.Path.outfit['cured meat'],0);assert.equal(W.health,1+W.meatHeal(),'last real ration heals');
assert.equal(W.starvation,false);assert.equal(W.thirst,false);assert.equal(W.water,0,'last real water unit satisfies thirst');
W.foodMove=0;assert.equal(W.useSupplies(),true);assert.equal(W.thirst,true,'a new water shortage starts with the original grace interval');
W.foodMove=1;W.water=10;assert.equal(W.useSupplies(),true,'zero after last ration gets normal grace');assert.equal(W.starvation,true);
W.checkDanger=originalCheckDanger;W.curPos=[W.RADIUS+17,W.RADIUS];W.danger=true;set('stores.i armour',1);
assert.equal(W.checkDanger(),true,'armored return from outer danger becomes safer inside distance 18');assert.equal(W.danger,false);
W.danger=true;set('stores.i armour',0);assert.equal(W.checkDanger(),false);assert.equal(W.danger,true,'unarmored players still face the original danger outside distance 8');
console.log('PASS: phase-aware terrain return estimates, perk periods, resource risk, read-only UI data, guarded movement/return, fatal move recording and precise supply failure causes.');
