const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let active=null,overlay=null,saves=[],publications=[],onPublish=null;
const c={State:{},_:s=>s,Engine:{options:{},keyLock:false,saveGame(){saves.push(JSON.stringify(c.State));},log(){}},
  AudioLibrary:{},AudioEngine:{playSound(){}},Notifications:{notify(){}},Events:{activeEvent:()=>active},
  Path:{},Outside:{},Ship:{},Space:{},document:{querySelector:()=>overlay}};
c.window=c;c.$=element=>element;c.$.Dispatch=()=>({publish(event){publications.push(JSON.stringify(c.State));if(onPublish)onPublish(event);}});
vm.createContext(c);
for(const file of ['state_manager.js','world.js','room.js','fabricator.js','ui_context.js','crafting.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
c.$SM=c.StateManager;
const sm=c.$SM,R=c.Room,F=c.Fabricator,plain=value=>JSON.parse(JSON.stringify(value));
const button=(key,kind='buildThing')=>({attr:name=>name===kind?key:undefined});
function reset(){
  c.State={stores:{wood:200,teeth:10,cloth:20,'demon stone':3},features:{location:{fabricator:true}},
    game:{builder:{level:4},temperature:{value:4},buildings:{workshop:1}},character:{blueprints:{'wisteria oil':true}}};
  c.Engine.activeModule=R;c.Engine.options.testerMode=false;c.Engine.keyLock=false;active=overlay=onPublish=null;saves=[];publications=[];
}
reset();onPublish=()=>assert.equal(R.build(button('bone yari')),false,'stock listeners cannot recursively craft');
assert.equal(R.build(button('bone yari')),true);assert.equal(saves.length,1);
assert.equal(c.State.stores.wood,100);assert.equal(c.State.stores.teeth,5);assert.equal(c.State.stores['bone yari'],1);
assert.ok(saves.concat(publications).every(snapshot=>JSON.parse(snapshot).stores['bone yari']===1),'save and listeners only see the complete transaction');
reset();assert.equal(R.build(button('cart')),true);assert.equal(saves.length,1);
assert.equal(JSON.parse(saves[0]).game.buildings.cart,1);assert.equal(JSON.parse(saves[0]).stores.wood,170);
let snapshot=JSON.stringify(c.State);assert.equal(R.build(button('cart')),false);assert.equal(JSON.stringify(c.State),snapshot);
for(const bad of ['missing','cold','builder','workshop','shortage','nan','infinite','overflow','event','modal','location']){
  reset();let item='bone yari';
  if(bad==='missing')item='no such recipe';if(bad==='cold')c.State.game.temperature.value=0;
  if(bad==='builder')c.State.game.builder.level=1;if(bad==='workshop')c.State.game.buildings.workshop=0;
  if(bad==='shortage')c.State.stores.teeth=4;if(bad==='nan')c.State.stores.wood=NaN;
  if(bad==='infinite')c.State.stores.wood=Infinity;if(bad==='overflow')c.State.stores['bone yari']=sm.MAX_STORE;
  if(bad==='event')active={};if(bad==='modal')overlay={};if(bad==='location')c.Engine.activeModule=c.World;
  snapshot=JSON.stringify(c.State);assert.equal(R.build(button(item)),false,bad);assert.equal(JSON.stringify(c.State),snapshot,bad+' never charges');assert.equal(saves.length,0);
}
reset();c.Engine.activeModule=F;onPublish=()=>assert.equal(F.fabricate(button('wisteria oil','fabricateThing')),false);
assert.equal(F.fabricate(button('wisteria oil','fabricateThing')),true);assert.equal(c.State.stores['demon stone'],2);assert.equal(c.State.stores['wisteria oil'],5);assert.equal(saves.length,1);
assert.ok(saves.concat(publications).every(snapshot=>JSON.parse(snapshot).stores['wisteria oil']===5));
for(const bad of ['blueprint','unknown','feature','batch-overflow','invalid-inventory']){
  reset();c.Engine.activeModule=F;let item='wisteria oil';
  if(bad==='blueprint')c.State.character.blueprints['wisteria oil']=false;if(bad==='unknown')item='unknown';
  if(bad==='feature')c.State.features.location.fabricator=false;if(bad==='batch-overflow')c.State.stores['wisteria oil']=sm.MAX_STORE-2;
  if(bad==='invalid-inventory')c.State.stores['wisteria oil']=-1;
  snapshot=JSON.stringify(c.State);assert.equal(F.fabricate(button(item,'fabricateThing')),false);assert.equal(JSON.stringify(c.State),snapshot);assert.equal(saves.length,0);
}
reset();c.Engine.options.testerMode=true;c.State.stores={};assert.equal(R.build(button('bone yari')),true);assert.equal(c.State.stores['bone yari'],1);assert.equal(c.State.stores.wood,undefined);
// All read-only panels share the same live context guard, including the real lexical forge export.
reset();for(const module of [R,F,c.Outside,c.Path,c.Ship]){c.Engine.activeModule=module;assert.equal(c.UIContext.canInspect(),true);}
for(const module of [c.World,c.Space]){c.Engine.activeModule=module;assert.equal(c.UIContext.canInspect(),false);}
c.Engine.activeModule=R;overlay={};assert.equal(c.UIContext.canInspect(),false);overlay=null;active={};assert.equal(c.UIContext.canInspect(),false);
active=null;c.Engine.keyLock=true;assert.equal(c.UIContext.canInspect(),false);
assert.equal(F.canFabricate('unknown'),false);
// Scheduled events must not interrupt native inspection/quantity dialogs.
vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/events.js'),'utf8'),c);
let launches=0,retries=[];c.Events.eventStack=[];c.Events.EventPool=[{isAvailable:()=>true}];
c.Events.startEvent=()=>{launches++;};c.Events.scheduleNextEvent=scale=>retries.push(scale);
c.Events.MerchantScrap={};c.Engine.activeModule=R;
for(const reason of ['lock','overlay']){
  c.Engine.keyLock=reason==='lock';overlay=reason==='overlay'?{}:null;
  assert.equal(c.Events.triggerEvent(),false);c.Events.tryMerchant();assert.equal(launches,0);
}
assert.deepEqual(retries,[0.5,0.5]);c.Engine.keyLock=false;overlay=null;c.Events.triggerEvent();assert.equal(launches,1);
console.log('PASS: real room/forge recipes commit once with complete snapshots, batch yield/blueprints/limits, stale and reentrant rejection, and unified safe modal contexts.');
