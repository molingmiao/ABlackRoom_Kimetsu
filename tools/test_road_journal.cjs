const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let active=null,notifications=[];
const c={State:{},_:s=>s,AudioLibrary:{},Engine:{options:{},log(){},saveGame(){},activeModule:null,keyLock:false},
  Events:{Setpieces:{},activeEvent:()=>active},Path:{outfit:{}},Room:{},
  Notifications:{notify:(module,text)=>notifications.push(text)},Math:Object.create(Math)};
c.$={Dispatch:()=>({publish(){}})};
c.window=c;c.Math.random=()=>0;vm.createContext(c);
for(const file of ['state_manager.js','world.js','early_game.js','events/story_chapters.js','events/road_stories.js','world_road_stories.js','world_story_guide.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
c.$SM=c.StateManager;c.WorldStoryGuide.update=()=>{};
const W=c.World,R=c.WorldRoadStories,G=c.WorldStoryGuide,sm=c.$SM,copy=v=>JSON.parse(JSON.stringify(v));
function start(){
  W.state={map:Array.from({length:61},()=>Array(61).fill('.')),mask:Array.from({length:61},()=>Array(61).fill(false))};
  W.curPos=[30,30];W.dead=false;W.health=10;W.starvation=W.thirst=false;c.Engine.activeModule=W;c.Engine.keyLock=false;active=null;R.begin();
}
const step=i=>{W.curPos=[31+i%6,30+Math.floor(i/6)];return R.onMove();};
start();const original=JSON.stringify(c.State);
for(let i=0;i<5;i++)assert.equal(step(i),false);
assert.equal(step(5),true);assert.equal(R.notes().length,1);assert.equal(notifications.length,1);
for(let i=0;i<100;i++)assert.equal(step(5),false,'pacing on the same cell cannot farm notes');
assert.equal(JSON.stringify(c.State),original,'active exploration never writes a resumable save');
for(let i=6;i<18;i++)step(i);
assert.equal(R.notes().length,3);assert.equal(new Set(R.notes()).size,3);
assert.equal(step(20),false,'at most three notes per expedition');
assert.equal(R.commit(),false,'not yet home');
const heard=copy(R.notes());sm.set('game.world.map',W.state.map,true);assert.equal(R.commit(),true);
assert.deepEqual(copy(sm.get('game.roadsideSeen')),heard);
assert.equal(R.commit(),false,'duplicate hand-in has no effect');
assert.equal(sm.get('stores'),undefined,'reading stories never creates inventory');
R.reset();assert.equal(R.notes().length,0);

start();for(let i=0;i<6;i++){W.curPos=[40+i,30];R.onMove();}
assert.equal(R.notes()[0],'middle_list','region selects middle-distance prose');
const saved=JSON.stringify(c.State);W.dead=true;assert.equal(R.commit(),false);
R.reset();W.state=null;assert.equal(JSON.stringify(c.State),saved,'death loses unpublished notes');
start();for(let i=0;i<6;i++){W.curPos=[50+i,30];R.onMove();}
assert.equal(R.notes()[0],'far_smith','outer map uses a different story pool');
sm.set('game.world.map',W.state.map,true);assert.equal(R.commit(),true);
start();for(let i=0;i<6;i++){W.curPos=[50+i,30];R.onMove();}
assert.equal(R.notes()[0],'far_letter','unread entries are preferred on another journey');

for(const gate of ['event','lock','dead','starvation','thirst','hp','otherModule']) {
  start();for(let i=0;i<5;i++)step(i);
  if(gate==='event')active={};else if(gate==='lock')c.Engine.keyLock=true;else if(gate==='hp')W.health=2;
  else if(gate==='otherModule')c.Engine.activeModule=c.Room;else W[gate]=true;
  assert.equal(step(5),false,'no distraction during '+gate);assert.equal(R.notes().length,0);
}
start();for(let i=0;i<5;i++)step(i);W.curPos=[37,30];W.state.map[37][30]='Q';assert.equal(R.onMove(),false,'landmark scenes retain exclusive control');
W.state={...W.state};assert.equal(R.current(),null,'old callbacks cannot write into a different expedition');
assert.equal(R.commit(),false);
assert.deepEqual(copy(R.ids(['unknown','near_rope','near_rope','__proto__'])),['near_rope']);

// Real access gates, not a second set of invented unlock rules.
start();sm.set('game',{campaignVersion:2,world:{map:[]}});
for(const [tile,flag]of [['T',null],['O','game.yoshiwaraDone'],['K','game.swordsmithChapterDone'],['E','game.butterflyEstateDone']]){
  W.state.map[35][30]=tile;W.state.mask[35][30]=true;
  const entry=G.entries().find(e=>e.tile===tile);assert.ok(entry.access);assert.match(entry.statusText,/前置未齐/);
  if(flag)assert.equal(!!sm.get(flag),false);
}
sm.set('game.buildings',{'iron mine':1,'coal mine':1,steelworks:1});sm.set('game.world.map',[['M!']]);
assert.equal(G.entries().find(e=>e.tile==='T').access,'');assert.equal(G.entries().find(e=>e.tile==='E').access,'');
sm.set('game.world.mugentrain',true);assert.equal(G.entries().find(e=>e.tile==='O').access,'');
sm.set('game.yoshiwaraDone',true);assert.equal(G.entries().find(e=>e.tile==='K').access,'');
sm.set('game.yoshiwaraDone',false);sm.set('game.swordsmithVillageDone',true);
assert.equal(G.entries().find(e=>e.tile==='K').access,'','legacy village access preserved');
const chapter=c.Events.StoryChapters;chapter.reset('sagiri');
assert.equal(G.entries().find(e=>e.tile==='Q').objectives.length,3);
chapter.mark('sagiri','route');assert.ok(G.entries().find(e=>e.tile==='Q').objectives[0].startsWith('✓'));
chapter.reset('sagiri');assert.ok(G.entries().find(e=>e.tile==='Q').objectives.every(s=>s.startsWith('○')));
W.state={...W.state};assert.equal(G.entries().find(e=>e.tile==='Q').objectives.length,0,'objectives cannot leak across runs');
console.log('PASS: nine regional vignettes, spacing/caps, unread-first, battle/fatal isolation, safe-return-only journal, no loot/resume, live prerequisites and transient objectives.');
