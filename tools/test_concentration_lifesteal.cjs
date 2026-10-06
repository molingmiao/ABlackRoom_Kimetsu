const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(options = {}) {
  let now = 1000, next = 0, current;
  const timers = new Map(), heals = [], state = {};
  function node(id) {
    const data = {}, attrs = {id};
    const value = {length: 1, hpText: '', data(key, val) { if(val === undefined) return data[key]; data[key] = val; return value; },
      attr(key, val) { if(val === undefined) return attrs[key]; attrs[key] = val; return value; },
      text(val) { value.hpText = val; return value; }, addClass() { return value; }, find() { return value; }};
    return value;
  }
  const player = node('wanderer').data('hp',70).data('maxHp',200).data('status','none');
  const enemy = node('enemy').data('hp',10000).data('maxHp',10000).data('status','none');
  const hpLabel = node('hp');
  const ctx = {State: state, Room: {}, Path: {outfit: {'concentration pill': 5}}, AudioEngine: {playSound() {}}, AudioLibrary: {},
    Date: {now: () => now}, Math: Object.create(Math),
    $: arg => arg === '#wanderer' ? player : arg === '#enemy' ? enemy : arg === '.hp' ? hpLabel : node(),
    _: (str, ...args) => str.replace(/\{(\d+)\}/g, (_, n) => args[n]),
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    World: {health: 70, getMaxHealth: () => 200, updateSupplies() {}, Weapons: {sword:{type:'melee',damage:1,cooldown:2,verb:'attack'}},
      setHp(value) { ctx.World.health = value; }},
    Notifications: {notify() {}}, Button: {Button: function(opts) { const button=node(opts.id); button.options=opts; return button; },setDisabled() {}}
  };
  function timer(callback, ms, repeat, scale = 1) {
    const id = ++next;
    timers.set(id,{callback,at:now+ms/scale,interval:repeat ? ms/scale : 0}); return id;
  }
  const scale = options.testerMode ? Math.max(1,options.combatTimeScale||1) : 1;
  ctx.$.Dispatch = () => ({publish() {}});
  ctx.Engine = {options, log() {}, saveGame() {}, combatSetTimeout: (cb,ms) => timer(cb,ms,false,scale),
    combatSetInterval: (cb,ms) => timer(cb,ms,true,scale)};
  ctx.setTimeout = (cb,ms) => timer(cb,ms,false);
  ctx.window = ctx; vm.createContext(ctx);
  for(const file of ['state_manager.js','events.js','space.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),ctx);
  ctx.$SM = ctx.StateManager;
  ctx.Engine.activeModule = ctx.Space;
  ctx.Space.getDamageMult = () => 1;
  ctx.Space.addMetaHealed = value => heals.push(value);
  const scene = {combat:true}, event = {scenes:{start:scene}}; current = event;
  Object.assign(ctx.Events,{activeScene:'start',activeEvent:()=>current,setHeal() {},checkPlayerDeath() {return false;},
    drawFloatText() {},winFight() {}});
  const tick = ms => {
    const end = now+ms;
    for(;;) {
      const due = [...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!due) break;
      const [id,t] = due; now=t.at;
      if(t.interval) t.at+=t.interval; else timers.delete(id);
      t.callback();
    }
    now=end;
  };
  const hit = damage => ctx.Events.damage(player,enemy,damage,'melee',null,{weaponName:'sword'});
  return {ctx,player,enemy,hpLabel,timers,scene,tick,hit,heals,setEvent:event=>{current=event;},get now(){return now;}};
}

for(const options of [{},{testerMode:true,combatTimeScale:5}]) {
  const f=fixture(options), {ctx:c}=f, scale=options.combatTimeScale||1;
  assert.equal(c.Events.BOOST_DURATION,15000);
  const button=c.Events.createAttackButton('sword');
  assert.equal(button.options.boosted(),false);
  c.Events.useStim();
  assert.equal(c.Path.outfit['concentration pill'],4);
  assert.equal(c.World.health,60,'one pill still pays the intended 10 HP');
  assert.equal(c.Events.boostRemaining(),15);
  assert.equal(button.options.boosted(),true);
  assert.match(f.hpLabel.hpText,/全集中 15秒/);
  f.tick(5000/scale);
  assert.equal(c.Events.boostRemaining(),10);
  for(let i=0;i<20;i++) c.Events.updateFighterDiv(f.player);
  f.tick(9999/scale);
  assert.equal(button.options.boosted(),true);
  f.tick(1/scale);
  assert.equal(c.Events.boostRemaining(),0);
  assert.equal(button.options.boosted(),false,'refreshes do not extend the real deadline');
  assert.equal(f.player.data('status'),'none');
  assert.equal(f.player.attr('class'),'fighter');
  assert.doesNotMatch(f.hpLabel.hpText,/全集中/);
  assert.equal(f.timers.size,0,'expiry removes its ticker');
  c.Events.useStim(); f.tick(10000/scale);
  c.Events.useStim();
  assert.equal(c.Events.boostRemaining(),15,'reuse refreshes, never stacks');
  assert.equal(f.timers.size,2,'only the current expiry and display ticker remain');
  f.tick(5000/scale);
  assert.equal(c.Events.boostRemaining(),10,'previous expiry cannot cancel refreshed pill');
  f.player.data('status','shield');
  f.tick(10000/scale);
  assert.equal(f.player.data('status'),'shield','old pill expiry cannot remove a later shield');
  c.Events.useStim(); c.Events.clearTimeouts();
  assert.equal(c.Events.boostRemaining(),0);
  assert.equal(f.timers.size,0);
  const count=c.Path.outfit['concentration pill'];
  c.Events.won=true; c.Events.useStim();
  assert.equal(c.Path.outfit['concentration pill'],count,'settled fights cannot consume a pill');
}
{
  const f=fixture(), {ctx:c}=f;
  c.World.health=10; f.player.data('hp',10); c.Events.useStim();
  assert.equal(c.Path.outfit['concentration pill'],5,'pill cannot cause fatal self-damage');
  c.World.health=70; f.player.data('hp',70); f.scene.combat=false; c.Events.useStim();
  assert.equal(c.Path.outfit['concentration pill'],5,'story scenes cannot consume pills');
  f.scene.combat=true; c.Events.useStim();
  const stale=[...f.timers.values()].map(t=>t.callback);
  c.Events.clearTimeouts(); f.setEvent({scenes:{start:{combat:true}}});
  f.player.data('status','shield'); stale.forEach(cb=>cb());
  assert.equal(f.player.data('status'),'shield');
  assert.equal(c.Events.boostRemaining(),0);
}
{
  const f=fixture(), {ctx:c}=f;
  for(const perks of [[],['water breath I'],['water breath I','flame breath I','thunder breath I']]) {
    c.$SM.set('character.perks',{});
    perks.forEach(key=>c.$SM.set('character.perks["'+key+'"]',true));
    for(const level of [0,1,10,20,25,30,1000]) {
      const total=level*.01+perks.length*.05, overflow=Math.max(0,total-.25);
      const before=Math.min(.25,total)+.15*overflow/(overflow+.15);
      assert.equal(c.Space.getLifestealPct(level),before*.5,'every level/perk combination is exactly half');
    }
  }
  c.Space.getLifestealPct=()=>.05;
  for(let i=0;i<19;i++) f.hit(1);
  assert.equal(c.World.health,70,'small hits do not each force a one-HP refund');
  f.hit(1); assert.equal(c.World.health,71,'fractional healing accumulates accurately');
  f.enemy.data('status','shield'); f.hit(100); f.hit(-1);
  assert.equal(c.World.health,71,'blocked hits and misses do not siphon');
  c.Events.dotDamage(f.enemy,100,'poison');
  assert.equal(c.World.health,71,'DOT never siphons');
  f.hit(1); c.Events.clearTimeouts(); assert.equal(c.Events._lifestealCarry,0,'no cross-fight healing credit');
}
console.log('PASS: exact half lifesteal at all levels/perks, fractional real-hit healing, fixed 15s concentration expiry/refresh/display, combat-speed and stale callback cleanup.');
