const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const state = {character:{infinityTalents:{},perks:{}},game:{castleMeta:{talentCap:25,peakTalent:{}}},stores:{}};
const parts = key => key.split(/[.\[\]"']+/).filter(Boolean);
const sm = {
  get(key,zero) {let value=state;for(const part of parts(key))value=value&&value[part];return value===undefined&&zero?0:value;},
  set(key,value) {const keys=parts(key);let target=state;for(const part of keys.slice(0,-1))target=target[part]||(target[part]={});target[keys.at(-1)]=value;},
  hasPerk(key) {return !!state.character.perks[key];}
};
let offered, completed=0;
const context={
  $SM:sm,_:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[i]),
  Engine:{activeModule:null},Notifications:{notify(){}},
  Events:{startEvent(event){offered=event;},eventPanel(){return {addClass(){}};}},
  World:{BASE_HIT_CHANCE:.8,health:85,getBaseMaxHealth(){return 85;},getMaxHealth(){return 85+context.Space.getMaxHpBonus();},setHp(value){this.health=value;}},
  CombatStyles:{trainingName:id=>'Training '+id,trainingPreview:(id,before,after)=>id==='sharpEdge'?'Signature '+before+' → '+after:''}
};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/space.js'),'utf8'),context);
const space=context.Space;context.Engine.activeModule=space;space.afterNode=()=>{completed++;};
const plain=value=>JSON.parse(JSON.stringify(value));
for(const talent of space.TALENTS) {
  sm.set('character.infinityTalents["'+talent.id+'"]',20);
  sm.set('game.castleMeta.peakTalent["'+talent.id+'"]',20);
}
// Display models use actual combat previews but never mutate levels or inheritance.
const before=JSON.stringify(state),health=context.World.health;
for(const talent of space.TALENTS) {
  const card=plain(space.talentCardData(talent.id)),preview=space.talentPreview(talent.id);
  assert.equal(card.id,talent.id);assert.equal(card.name,'Training '+talent.id);
  assert.equal(card.level,20);assert.equal(card.next,21);assert.equal(card.cap,25);
  assert.equal(card.capped,false);assert.ok(card.description.length);
  assert.match(card.benefits[0],/→/);assert.ok(card.benefits[0].includes(preview.metric));
  assert.equal(card.inheritance,'next descent inheritance: Lv.8 → Lv.8');
  if(talent.id==='sharpEdge')assert.equal(card.signature,'Signature 20 → 21');else assert.equal(card.signature,'');
  if(talent.id==='steadyHand') {
    assert.equal(card.benefits.length,3);
    assert.match(card.benefits[1],/excess accuracy weapon damage multiplier/);
    assert.match(card.benefits[2],/instead of being wasted/);
  } else assert.equal(card.benefits.length,1);
}
assert.equal(space.talentCardData('unknown'),null);
assert.equal(JSON.stringify(state),before);assert.equal(context.World.health,health);
sm.set('character.infinityTalents.hardBody',25);
const capped=space.talentCardData('hardBody');
assert.equal(capped.level,25);assert.equal(capped.next,25);assert.equal(capped.capped,true);
assert.match(capped.benefits[0],/already at the current level limit/);

// Reward metadata and callbacks are preserved for ordinary, multi-reward and pillar events.
for(const talent of space.TALENTS)sm.set('character.infinityTalents["'+talent.id+'"]',25);
sm.set('character.infinityTalents.swiftBlade',24);
space._offerTalent({batchLeft:2,onComplete:()=>{completed++;}});
const buttons=offered.scenes.start.buttons,choices=Object.keys(buttons).filter(key=>key.startsWith('talent_'));
assert.equal(choices.length,1);assert.match(buttons.talent_0.text,/Training swiftBlade Lv\.25\/25/);
const chosen=buttons.talent_0;chosen.onChoose();
assert.equal(space.getTalentLevel('swiftBlade'),25);assert.equal(space.getTalentCap(),30);
chosen.onEnd();assert.equal(Object.keys(offered.scenes.start.buttons).filter(key=>key.startsWith('talent_')).length,3);
assert.equal(completed,0);
offered.scenes.start.buttons.skip.onEnd();assert.equal(completed,1);
space.triggerHashiraEncounter();
assert.ok(offered.scenes.start.text.some(line=>line.includes('offers a lesson')));
const total=space.TALENTS.reduce((sum,t)=>sum+space.getTalentLevel(t.id),0);
offered.scenes.start.buttons.accept.onChoose();
assert.equal(space.TALENTS.reduce((sum,t)=>sum+space.getTalentLevel(t.id),0),total+1);
space.triggerShrine();
const shrineTotal=space.TALENTS.reduce((sum,t)=>sum+space.getTalentLevel(t.id),0);
offered.scenes.start.buttons.offer.onChoose();
assert.equal(space.TALENTS.reduce((sum,t)=>sum+space.getTalentLevel(t.id),0),shrineTotal+1);
console.log('PASS: read-only talent card models, accurate grade and benefit previews, signature/inheritance separation, capped metadata and unchanged ordinary/batch/shrine/pillar reward callbacks.');
