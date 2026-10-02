const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A small DOM fixture runs the actual dialog callbacks, not a second recycling implementation.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.props = {}; this.nodes = []; this.content = ''; this.handlers = {}; }
}
const descendants = node => node.nodes.flatMap(child => [child, ...descendants(child)]);
const root = new Element('html'), body = new Element('body');
body.parent = root; root.nodes.push(body);
let activeElement = body;
const document = {
  documentElement: { contains: node => node === root || descendants(root).includes(node) },
  getElementById: id => descendants(root).find(node => node.attrs.id === id) || null,
  get activeElement() { return activeElement; }
};
const matches = (node, selector) => selector[0] === '#' ? node.attrs.id === selector.slice(1)
  : selector[0] === '.' ? (node.attrs.class || '').split(' ').includes(selector.slice(1)) : node.tag === selector;
class Query {
  constructor(nodes) { this.nodes = nodes; this.length = nodes.length; nodes.forEach((node, i) => { this[i] = node; }); }
  attr(key, value) {
    if (typeof key === 'object') { this.nodes.forEach(node => Object.assign(node.attrs, key)); return this; }
    if (arguments.length === 1) return this[0]?.attrs[key];
    this.nodes.forEach(node => { node.attrs[key] = value; }); return this;
  }
  prop(key, value) {
    if (arguments.length === 1) return this[0]?.props[key];
    this.nodes.forEach(node => { node.props[key] = value; }); return this;
  }
  addClass(name) { this.nodes.forEach(node => { node.attrs.class = [node.attrs.class, name].filter(Boolean).join(' '); }); return this; }
  empty() { this.nodes.forEach(node => { node.nodes.forEach(child => { child.parent = null; }); node.nodes = []; node.content = ''; }); return this; }
  text(value) {
    if (!arguments.length) return this.nodes.map(node => [node, ...descendants(node)].map(child => child.content).join('')).join('');
    this.empty(); this.nodes.forEach(node => { node.content = String(value); }); return this;
  }
  val(value) {
    if (!arguments.length) return this[0]?.value ?? this[0]?.attrs.value ?? '';
    this.nodes.forEach(node => { node.value = value; }); return this;
  }
  appendTo(target) {
    const parent = $(target)[0];
    this.nodes.forEach(node => { node.parent = parent; parent.nodes.push(node); }); return this;
  }
  on(types, callback) {
    this.nodes.forEach(node => types.split(' ').forEach(type => { (node.handlers[type] ||= []).push(callback); })); return this;
  }
  trigger(type, options = {}) {
    this.nodes.forEach(node => {
      const event = { type, target:node, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
      for (const callback of node.handlers[type] || []) callback.call(node, event);
    }); return this;
  }
  remove() {
    this.nodes.forEach(node => { if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); node.parent = null; }); return this;
  }
  focus() { this[0]?.focus(); return this; }
  select() { return this; }
}
function $(selector) {
  if (selector instanceof Query) return selector;
  if (selector instanceof Element) return new Query([selector]);
  if (selector.startsWith('<')) {
    const node = new Element(selector.match(/^<(\w+)/)[1]);
    node.focus = () => { activeElement = node; };
    return new Query([node]);
  }
  return new Query(descendants(root).filter(node => matches(node, selector)));
}
const subscribers = new Set();
$.Dispatch = () => ({
  subscribe: callback => subscribers.add(callback),
  unsubscribe: callback => subscribers.delete(callback),
  publish: event => [...subscribers].forEach(callback => callback(event))
});
let saves = 0, redraws = 0, notifications = 0, event = null;
const context = {
  $, document, State:{}, AudioLibrary:{},
  _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
  Engine: { saveGame() { saves++; }, log() {} },
  Events: { activeEvent:() => event },
  Notifications: { notify() { notifications++; } }
};
context.window = context;
vm.createContext(context);
for (const file of ['state_manager.js','room.js','fabricator.js','path.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),context);
}
const P = context.Path, SM = context.$SM = context.StateManager;
P.updateOutfitting = () => { redraws++; };
context.Engine.activeModule = P;
const plain = value => JSON.parse(JSON.stringify(value));
function reset(key = 'bone yari', total = 8, packed = 1) {
  P.closeScrapQuantityDialog(false);
  context.State = { stores:{[key]:total, wood:0, teeth:0, leather:0, steel:0}, outfit:{[key]:packed} };
  P.outfit = context.State.outfit;
  context.Engine.activeModule = P; event = null; saves = redraws = notifications = 0;
}
const trigger = $('<button>').attr('id','originalScrap').appendTo('body')[0];
function open() { assert.equal(P._showScrapQuantityDialog('bone yari',trigger),true); }
function input(value) { $('#scrapQuantityInput').val(value).trigger('input'); }
const before = () => JSON.stringify(context.State);

reset();
const unchanged = before();
const batch = plain(P.scrapPreview('bone yari','3'));
assert.deepEqual(batch, {have:8,carried:1,permanent:0,equipped:0,available:7,amount:3,refund:{wood:90,teeth:4},remainder:{wood:0,teeth:50},valid:true,error:''});
assert.equal(batch.refund.teeth,4,'whole batch rounding must not floor each item then multiply');
assert.equal(before(),unchanged,'preview does not change inventory or save data');
for (const value of ['', ' ', '1.5', '3.0', 'NaN', NaN, Infinity, -1, 0, '9', 9, null, false, {}, '1e2']) {
  assert.equal(P.scrapPreview('bone yari',value).valid,false,`invalid preview quantity ${String(value)}`);
  assert.equal(P.scrapItem('bone yari',value),false,`invalid execution quantity ${String(value)}`);
  assert.equal(before(),unchanged,'invalid requests never consume resources');
}
assert.equal(saves,0);
open();
assert.equal($('#scrapQuantityPanel').attr('role'),'dialog');
let stopped = false;
$('#scrapQuantityOverlay')[0].handlers.keyup[0]({key:'d',stopPropagation() { stopped = true; }});
assert.equal(stopped,true,'keyup must not escape the dialog into global page-switch shortcuts');
assert.match($('.scrapQuantityStock').text(),/仓库总数8背包保护1可回收7/);
input('3');
assert.match($('#scrapQuantityRefund').text(),/回收 3 件，将返还：wood\+90teeth\+4/);
assert.equal($('.scrapQuantityOk').prop('disabled'),false);
const cancelButton = $('.scrapQuantityActions').nodes[0].nodes[1];
cancelButton.focus();
$('#scrapQuantityOverlay').trigger('keydown',{key:'Tab',target:cancelButton});
assert.equal(document.activeElement,$('#scrapQuantityInput')[0],'Tab wraps from the last action into the input');
$('#scrapQuantityOverlay').trigger('keydown',{key:'Tab',shiftKey:true,target:$('#scrapQuantityInput')[0]});
assert.equal(document.activeElement,cancelButton,'Shift+Tab keeps focus within the dialog');
const oldCommit = $('.scrapQuantityOk')[0].handlers.click[0];
$('.scrapQuantityOk').trigger('click');
assert.equal(context.State.stores['bone yari'],5); assert.equal(P.outfit['bone yari'],1);
assert.equal(context.State.stores.wood,90); assert.equal(context.State.stores.teeth,4);
assert.equal(saves,1,'the inventory deduction and refund publish as one state update');
assert.equal(notifications,1); assert.equal(redraws,1); assert.equal(subscribers.size,0);
assert.equal(document.activeElement,trigger,'successful completion restores the triggering button if it still exists');
const completed = before(); oldCommit(); oldCommit();
assert.equal(before(),completed,'duplicate or detached dialog callbacks cannot recycle twice');

reset(); open(); input('5');
P.outfit['bone yari']=5; SM.fireUpdate('outfit');
assert.match($('.scrapQuantityStock').text(),/仓库总数8背包保护5可回收3/);
assert.equal($('#scrapQuantityInput').attr('max'),3);
assert.equal($('.scrapQuantityOk').prop('disabled'),true);
assert.match($('#scrapQuantityError').text(),/数量超过/);
const stale = $('.scrapQuantityOk')[0].handlers.click[0];
const packed = before(); stale(); assert.equal(before(),packed,'submit rechecks protected backpack quantities');
input('2');
SM.set('stores["bone yari"]',6,true); // Deliberately bypass dispatch to exercise the final submit recheck.
const lowStock = before(); stale(); assert.equal(before(),lowStock);
assert.equal($('.scrapQuantityOk').prop('disabled'),true);
SM.set('stores["bone yari"]',9); assert.equal($('.scrapQuantityOk').prop('disabled'),false,'stock changes refresh an open preview');
input(''); assert.equal($('.scrapQuantityOk').prop('disabled'),true);
assert.equal($('#scrapQuantityRefund').text(),'');
const cancelSnapshot=before();
$('#scrapQuantityOverlay').trigger('keydown',{key:'Escape',target:$('#scrapQuantityInput')[0]});
assert.equal(before(),cancelSnapshot); assert.equal(document.activeElement,trigger); assert.equal(subscribers.size,0);

reset(); open();
const superseded = $('.scrapQuantityOk')[0].handlers.click[0];
const supersededCancel = $('.scrapQuantityActions').nodes[0].nodes[1].handlers.click[0];
open(); const replacement = before(); superseded(); assert.equal(before(),replacement);
supersededCancel();
assert.equal($('#scrapQuantityOverlay').length,1); assert.equal(subscribers.size,1);
$('.scrapQuantityActions').nodes[0].nodes[1].handlers.click[0]();
assert.equal(before(),replacement); assert.equal(document.activeElement,trigger); assert.equal(subscribers.size,0);

reset('nichirin katana',3,1);
assert.equal(P.scrapItem('nichirin katana',2),true);
assert.equal(context.State.stores['nichirin katana'],1,'a packed Nichirin katana must remain untouched');
assert.equal(context.State.stores.wood,300); assert.equal(context.State.stores.leather,60); assert.equal(context.State.stores.steel,12);
reset();
context.Engine.activeModule = context.Room;
assert.equal(P._showScrapQuantityDialog('bone yari',trigger),false); assert.equal(P.scrapItem('bone yari',1),false);
context.Engine.activeModule = P; event = {};
assert.equal(P._showScrapQuantityDialog('bone yari',trigger),false); assert.equal(P.scrapItem('bone yari',1),false);
event = null; open();
context.Engine.activeModule = context.Room;
const changedLocation=before(); $('.scrapQuantityOk').trigger('click');
assert.equal(before(),changedLocation); assert.equal($('#scrapQuantityOverlay').length,0);
assert.equal(subscribers.size,0,'navigation/active-event guards clean up the dialog listener');
assert.equal(saves,0);
console.log('PASS: live batch recycling preview, whole-batch refunds, packed inventory protection, strict quantities, atomic payment, stale/duplicate callbacks, cancel/Escape focus, and active-location guards.');
