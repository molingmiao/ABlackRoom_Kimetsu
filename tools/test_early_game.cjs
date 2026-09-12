const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const state = {};
const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
const sm = {
  get(key, zero) {let v = state; for (const k of parts(key)) v = v && v[k]; return v == null && zero ? 0 : v;},
  set(key, v) {const keys = parts(key); let o = state; for (const k of keys.slice(0,-1)) o = o[k] || (o[k] = {}); o[keys.at(-1)] = v;},
  add(key, n) {sm.set(key, sm.get(key,true) + n);}
};
let delay, scheduled;
const c = { $SM:sm, _:s=>s, AudioLibrary:{}, AudioEngine:{playSound(){}}, Notifications:{notify(){}},
  Engine:{log(){},setTimeout(fn, ms){scheduled=fn;delay=ms;return 1;}},
  $:()=>({each(){}}), Math:Object.assign(Object.create(Math),{random:()=>0.99})
};
c.window=c;
vm.createContext(c);
for (const file of ['room.js','outside.js','early_game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
const e=c.EarlyGame;
assert.equal(e.task(),null);
sm.set('game.prologue.done',true);
assert.match(e.task().text,/hearth/);
sm.set('game.fire.value',3);
assert.match(e.task().text,/warm up/);
sm.set('features.location.outside',true);
assert.match(e.task().text,/guest recovers/);
sm.set('game.builder.level',4);sm.set('game.temperature.value',4);
assert.match(e.task().text,/cart/);
assert.equal(e.task().cost.wood,30);
const before=JSON.stringify(state);e.task();e.render();assert.equal(JSON.stringify(state),before,'render is read-only');
for (let n=0;n<5;n++) {sm.set('game.gatherCount',n);assert.equal(e.gatherCooldown(60),n<3?20:60);}
assert.equal(e.gatherCooldown(0),0,'tester cooldown remains zero');
sm.set('game.gatherCount',0);sm.set('game.buildings.cart',1);
assert.match(e.task().text,/first shelter/);
sm.set('game.buildings.hut',1);sm.set('game.population',0);
assert.equal(e.gatherCooldown(60),60,'first shelter ends the introductory boost');
c.Outside.schedulePopIncrease();assert.equal(delay,30000);
assert.equal(scheduled,c.Outside.increasePopulation);
c.Outside.increasePopulation();
assert.equal(sm.get('game.population'),2);
assert.equal(sm.get('game.earlyResidentsArrived'),true);
assert.equal(delay,150000,'later arrivals use the original random schedule');
sm.set('game.population',0);sm.set('game.buildings.hut',0);
assert.equal(e.gatherCooldown(60),60,'losing residents or shelters cannot reset the boost');
sm.set('game.buildings.hut',1);assert.equal(e.firstResidentsPending(),false);
sm.set('game.population',2);assert.match(e.task().text,/trap/);
sm.set('game.buildings.trap',1);assert.match(e.task().text,/hunting lodge/);
sm.set('game.buildings.lodge',1);assert.match(e.task().text,/trading post/);
sm.set('game.buildings.trading post',1);assert.equal(e.task().cost.fur,400);
sm.set('stores.compass',1);assert.equal(e.task(),null);
sm.set('stores.compass',0);sm.set('features.location.path',true);assert.equal(e.task(),null);
assert.equal(e.gatherCooldown(60),60,'old advanced saves receive no opening boost');
console.log('PASS: stage guidance, live costs, three early cooldowns, deterministic first residents, old-save gating and read-only rendering.');
