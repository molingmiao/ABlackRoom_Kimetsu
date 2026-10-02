const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real purchase dialog and state manager through a small DOM fixture.
class Element {
  constructor(tag) { this.tag=tag; this.attrs={}; this.props={}; this.nodes=[]; this.content=''; this.handlers={}; }
}
const descendants = node => node.nodes.flatMap(child => [child,...descendants(child)]);
const root=new Element('html'), body=new Element('body');
root.nodes.push(body); body.parent=root;
let activeElement=body;
const document={documentElement:{contains:node=>node===root || descendants(root).includes(node)}, get activeElement() { return activeElement; }};
const matches=(node,selector)=>selector[0]==='#' ? node.attrs.id===selector.slice(1)
  : selector[0]==='.' ? (node.attrs.class || '').split(' ').includes(selector.slice(1)) : node.tag===selector;
class Query {
  constructor(nodes) { this.nodes=nodes; this.length=nodes.length; nodes.forEach((node,i)=>{this[i]=node;}); }
  attr(key,value) {
    if(typeof key==='object') { this.nodes.forEach(node=>Object.assign(node.attrs,key)); return this; }
    if(arguments.length===1) return this[0]?.attrs[key];
    this.nodes.forEach(node=>{node.attrs[key]=value;}); return this;
  }
  prop(key,value) {
    if(arguments.length===1) return this[0]?.props[key];
    this.nodes.forEach(node=>{node.props[key]=value;}); return this;
  }
  addClass(name) { this.nodes.forEach(node=>{node.attrs.class=[node.attrs.class,name].filter(Boolean).join(' ');}); return this; }
  empty() { this.nodes.forEach(node=>{node.nodes.forEach(child=>{child.parent=null;}); node.nodes=[]; node.content='';}); return this; }
  text(value) {
    if(!arguments.length) return this.nodes.map(node=>[node,...descendants(node)].map(child=>child.content).join('')).join('');
    this.empty(); this.nodes.forEach(node=>{node.content=String(value);}); return this;
  }
  val(value) { if(!arguments.length) return this[0]?.value ?? this[0]?.attrs.value ?? ''; this.nodes.forEach(node=>{node.value=value;}); return this; }
  appendTo(target) { const parent=$(target)[0]; this.nodes.forEach(node=>{node.parent=parent; parent.nodes.push(node);}); return this; }
  on(types,callback) { this.nodes.forEach(node=>types.split(' ').forEach(type=>{(node.handlers[type] ||= []).push(callback);})); return this; }
  trigger(type,options={}) {
    this.nodes.forEach(node=>{const event={type,target:node,preventDefault() {this.prevented=true;},stopPropagation() {this.stopped=true;},...options};
      for(const callback of node.handlers[type] || []) callback.call(node,event);
    }); return this;
  }
  remove() { this.nodes.forEach(node=>{if(node.parent) node.parent.nodes=node.parent.nodes.filter(child=>child!==node); node.parent=null;}); return this; }
  focus() { this[0]?.focus(); return this; }
  select() { return this; }
}
function $(selector) {
  if(selector instanceof Query) return selector;
  if(selector instanceof Element) return new Query([selector]);
  if(selector.startsWith('<')) { const node=new Element(selector.match(/^<(\w+)/)[1]); node.focus=()=>{activeElement=node;}; return new Query([node]); }
  return new Query(descendants(root).filter(node=>matches(node,selector)));
}
const subscribers=new Set();
$.Dispatch=()=>({subscribe:callback=>subscribers.add(callback),unsubscribe:callback=>subscribers.delete(callback),publish:event=>[...subscribers].forEach(callback=>callback(event))});
let saves=0, audio=0, event=null;
const c={$,document,State:{},AudioLibrary:{},_: (text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[i]),
  Engine:{options:{testerMode:false},saveGame() {saves++;},log() {}},
  AudioEngine:{playSound() {audio++;}},Events:{activeEvent:()=>event},Notifications:{notify() {}}};
c.window=c;
vm.createContext(c);
for(const file of ['state_manager.js','room.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
const R=c.Room, SM=c.$SM=c.StateManager;
const trigger=$('<button>').attr({id:'purchaseTrigger',buildThing:'medicine'}).appendTo('body')[0];
const plain=value=>JSON.parse(JSON.stringify(value));
const snapshot=()=>JSON.stringify(c.State);
function reset(stores={scales:100,teeth:60,medicine:2}) {
  R.closeBuyQuantityDialog(false); c.State={stores:{...stores}};
  $(trigger).attr('buildThing','medicine'); c.Engine.activeModule=R; c.Engine.options.testerMode=false; event=null; saves=audio=0;
}
function open(thing='medicine') {
  $(trigger).attr('buildThing',thing);
  assert.equal(R._showBuyQuantityDialog(trigger,thing,R.TradeGoods[thing]),true);
}
const input=value=>$('#buyQuantityInput').val(value).trigger('input');

reset();
const original=snapshot();
assert.deepEqual(plain(R.buyPreview('medicine','3')),{have:2,maximum:5,amount:3,materials:[
  {key:'scales',have:100,cost:60,remaining:40},{key:'teeth',have:60,cost:36,remaining:24}
],valid:true,error:''});
assert.equal(snapshot(),original,'preview never changes inventory');
for(const value of ['', ' ', '1.5','3.0','NaN',NaN,Infinity,-1,0,'6',6,null,false,{},'1e2',Number.MAX_SAFE_INTEGER+1]) {
  assert.equal(R.buyPreview('medicine',value).valid,false,`invalid preview ${String(value)}`);
  if(![6,'6'].includes(value)) assert.equal(R.buy(trigger,{shiftKey:true,customQuantity:value}),false,`invalid purchase ${String(value)}`);
  assert.equal(snapshot(),original,'invalid quantities never partially charge ingredients');
}
assert.equal(saves,0);
open();
assert.equal($('#buyQuantityPanel').attr('role'),'dialog');
assert.equal($('#buyQuantityInput').val(),1,'batch purchase starts at one rather than maximum');
assert.match($('.buyQuantityStock').text(),/仓库现有2目前最多可买5本次购买1/);
let keydown=false,keyup=false;
$('#buyQuantityOverlay').trigger('keydown',{key:'a',stopPropagation() {keydown=true;}});
$('#buyQuantityOverlay').trigger('keyup',{key:'d',stopPropagation() {keyup=true;}});
assert.equal(keydown,true); assert.equal(keyup,true,'both key phases are isolated from background shortcuts');
input('3');
assert.equal($('.buyQuantityOk').prop('disabled'),false);
assert.match($('#buyQuantityCost').text(),/scales1006040teeth603624/);
const cancel=$('.buyQuantityCancel')[0]; cancel.focus();
$('#buyQuantityOverlay').trigger('keydown',{key:'Tab',target:cancel});
assert.equal(document.activeElement,$('#buyQuantityInput')[0]);
$('#buyQuantityOverlay').trigger('keydown',{key:'Tab',shiftKey:true,target:$('#buyQuantityInput')[0]});
assert.equal(document.activeElement,cancel,'focus remains within the purchase dialog');
const oldCommit=$('.buyQuantityOk')[0].handlers.click[0];
$('.buyQuantityOk').trigger('click');
assert.deepEqual(plain(c.State.stores),{scales:40,teeth:24,medicine:5});
assert.equal(saves,1,'payment and goods publish together in one saved update');
assert.equal(audio,1); assert.equal(subscribers.size,0); assert.equal(document.activeElement,trigger);
const purchased=snapshot(); oldCommit(); oldCommit();
assert.equal(snapshot(),purchased,'detached or duplicate confirmation callbacks cannot buy twice');

reset(); open(); input('4');
SM.set('stores.scales',39);
assert.match($('.buyQuantityStock').text(),/目前最多可买1本次购买4/);
assert.equal($('#buyQuantityInput').attr('max'),1); assert.equal($('.buyQuantityOk').prop('disabled'),true);
assert.equal($('#buyQuantityInput').val(),'4','live shortages do not silently change the requested quantity');
const stale=$('.buyQuantityOk')[0].handlers.click[0], low=snapshot(); stale(); assert.equal(snapshot(),low);
SM.set('stores.scales',100); assert.equal($('.buyQuantityOk').prop('disabled'),false);
SM.set('stores.teeth',35,true); // Simulate an unannounced inventory update before clicking.
const changed=snapshot(); stale(); assert.equal(snapshot(),changed,'confirmation rechecks every ingredient, not only visible preview');
assert.equal($('.buyQuantityOk').prop('disabled'),true);
input(''); assert.equal($('.buyQuantityOk').prop('disabled'),true); assert.match($('#buyQuantityCost').text(),/—/);
SM.set('stores.teeth',60,true); SM.fireUpdate('income');
input('2'); assert.equal($('.buyQuantityOk').prop('disabled'),false,'worker income refreshes the open purchase budget');
const cancelled=snapshot();
$('#buyQuantityOverlay').trigger('keydown',{key:'Escape',target:$('#buyQuantityInput')[0]});
assert.equal(snapshot(),cancelled); assert.equal(document.activeElement,trigger); assert.equal(subscribers.size,0);

reset(); open();
const replaced=$('.buyQuantityOk')[0].handlers.click[0], replacedCancel=$('.buyQuantityCancel')[0].handlers.click[0];
open(); const unchanged=snapshot(); replaced(); replacedCancel();
assert.equal(snapshot(),unchanged); assert.equal($('#buyQuantityOverlay').length,1); assert.equal(subscribers.size,1);
$('.buyQuantityCancel').trigger('click'); assert.equal(subscribers.size,0); assert.equal(document.activeElement,trigger);

reset({scales:0,teeth:0,medicine:3}); open();
assert.equal($('.buyQuantityOk').prop('disabled'),true,'zero resources can still show the shortage budget');
c.Engine.options.testerMode=true; SM.fireUpdate('config.testerMode'); input('4');
assert.equal($('.buyQuantityOk').prop('disabled'),false); assert.match($('#buyQuantityError').text(),/测试模式/);
assert.deepEqual(plain(R.buyPreview('medicine',4).materials),[{key:'scales',have:0,cost:0,remaining:0},{key:'teeth',have:0,cost:0,remaining:0}]);
$('.buyQuantityOk').trigger('click'); assert.deepEqual(plain(c.State.stores),{scales:0,teeth:0,medicine:7});
assert.equal(saves,1,'tester purchase adds goods once without deducting resources');

reset({fur:400,scales:200,teeth:100,compass:0}); open('compass'); input('2');
assert.equal($('.buyQuantityOk').prop('disabled'),true,'UI rejects a quantity above the limited-item maximum');
$('.buyQuantityCancel').trigger('click');
assert.equal(R.buy(trigger,{shiftKey:true,customQuantity:99}),true,'legacy explicit purchase API still clamps compass to one');
assert.equal(c.State.stores.compass,1); assert.equal(c.State.stores.fur,360);
const atMaximum=snapshot(); assert.equal(R.buy(trigger,{shiftKey:true,customQuantity:99}),false); assert.equal(snapshot(),atMaximum);

reset({scales:40,teeth:24,medicine:0});
assert.equal(R.buy(trigger,{customQuantity:99}),true,'normal click remains a one-item purchase');
assert.deepEqual(plain(c.State.stores),{scales:20,teeth:12,medicine:1});
reset({scales:100,teeth:11,medicine:2});
const missingSecond=snapshot(); assert.equal(R.buy(trigger),false); assert.equal(snapshot(),missingSecond);

reset({scales:100,teeth:60,medicine:SM.MAX_STORE}); open();
assert.equal(R.buyPreview('medicine',1).maximum,0,'store limits prevent paying for goods silently discarded by the state cap');
assert.equal($('.buyQuantityOk').prop('disabled'),true);
R.closeBuyQuantityDialog(false); const capped=snapshot(); assert.equal(R.buy(trigger),false); assert.equal(snapshot(),capped);

reset(); c.Engine.activeModule={}; assert.equal(R._showBuyQuantityDialog(trigger,'medicine',R.TradeGoods.medicine),false);
c.Engine.activeModule=R; event={}; assert.equal(R._showBuyQuantityDialog(trigger,'medicine',R.TradeGoods.medicine),false);
event=null; const other=$('<div>').attr('id','loadoutEditorOverlay').appendTo('body');
assert.equal(R._showBuyQuantityDialog(trigger,'medicine',R.TradeGoods.medicine),false); other.remove();
open(); c.Engine.activeModule={}; const moved=snapshot(); $('.buyQuantityOk').trigger('click');
assert.equal(snapshot(),moved); assert.equal($('#buyQuantityOverlay').length,0); assert.equal(subscribers.size,0);
assert.equal(saves,0);
console.log('PASS: real live purchase preview, explicit quantities, one-save payment, strict invalid inputs, live stock and income refresh, limited goods, tester and ordinary purchase compatibility, stale/duplicate callbacks, Escape focus, shortcut isolation, and location guards.');
