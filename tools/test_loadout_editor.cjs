const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual editor callbacks in a minimal DOM, including stale buttons.
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.props = {}; this.nodes = []; this.content = ''; this.handlers = {}; }
}
const descendants = node => node.nodes.flatMap(child => [child, ...descendants(child)]);
const root = new Element('html'), body = new Element('body');
body.parent = root; root.nodes.push(body);
let activeElement = body;
const document = {
  documentElement: {contains: node => node === root || descendants(root).includes(node)},
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
      const event = {type, target:node, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options};
      for (const callback of node.handlers[type] || []) callback.call(node, event);
    }); return this;
  }
  remove() { this.nodes.forEach(node => { if (node.parent) node.parent.nodes = node.parent.nodes.filter(child => child !== node); node.parent = null; }); return this; }
  focus() { this[0]?.focus(); return this; }
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
$.extend = Object.assign;
const subscribers = new Set();
$.Dispatch = () => ({subscribe: callback => subscribers.add(callback), unsubscribe: callback => subscribers.delete(callback), publish: event => [...subscribers].forEach(callback => callback(event))});
let saves = 0, redraws = 0, event = null, result = '';
const context = {$, document, State:{}, AudioLibrary:{}, _: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
  Engine: {saveGame() { saves++; }, log() {}}, Events: {activeEvent:() => event}};
context.window = context;
vm.createContext(context);
for (const file of ['state_manager.js','room.js','fabricator.js','world.js','path.js','loadout_editor.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),context);
}
const P = context.Path, SM = context.$SM = context.StateManager, L = context.LoadoutEditor;
P.updateOutfitting = () => { redraws++; };
P.updateLoadoutPanel = () => {};
P.showLoadoutResult = value => { result = value; };
const plain = value => JSON.parse(JSON.stringify(value));
const trigger = $('<button>').attr('id','editOrigin').appendTo('body')[0];
const input = key => new Query($('input').nodes.filter(node => node.attrs['data-loadout-item'] === key));
const snapshot = () => JSON.stringify(context.State);
function reset(saved = true) {
  L.close(false);
  context.State = {stores:{'cured meat':3,medicine:0,'bone yari':1,torch:2,wood:100}, outfit:{'cured meat':1,torch:2}, character:{selectedLoadout:'expedition',
    equipped:{primary:['bone yari',null],secondary:['wisteria gun',null],tool:[]},
    loadouts:{castle:{version:1,targets:{medicine:9},equipped:{primary:['nichirin spear']}}}}};
  if (saved) context.State.character.loadouts.expedition = {
    version:1,targets:{'cured meat':5,medicine:2,'legacy relic':7},equipped:{primary:['nichirin katana',null]},meta:{old:true}
  };
  P.outfit = context.State.outfit;
  context.Engine.activeModule = P; event = null; saves = redraws = 0; result = '';
}
function open() { assert.equal(L.show(trigger),true); }
function edit(key, value) { input(key).val(value).trigger('input'); }

for (const value of [0, 3, Number.MAX_SAFE_INTEGER, '0', '12']) assert.equal(L.parseCount(value),Number(value));
for (const value of ['', ' ', '1.2', '3.0', '01', '1e3', '-1', NaN, Infinity, null, false, -1, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(L.parseCount(value),null,`reject non-integer/safe input ${String(value)}`);
}
reset();
const before = snapshot(), bag = P.outfit, equipped = context.State.character.equipped, other = plain(context.State.character.loadouts.castle);
const keys = Array.from(L.editableKeys(P.getLoadout('expedition')));
for (const key of ['medicine','torch','bone yari','wisteria gun','wisteria bullet','nichirin katana']) assert.ok(keys.includes(key));
for (const key of ['wood','nichirin spear','solar crystal','legacy relic']) assert.ok(!keys.includes(key),`unseen or non-carryable item hidden: ${key}`);
open();
assert.equal($('#loadoutEditorPanel').attr('role'),'dialog');
assert.equal(input('medicine').val(),2);
edit('medicine','30'); edit('torch','0');
assert.match($('.loadoutEditorSummary').text(),/目标超过当前容量/);
assert.match($('.loadoutEditorSummary').text(),/medicine：仍缺 30（库存不足 30）/);
assert.equal(snapshot(),before,'opening and changing draft does not save, pack, spend or equip');
assert.equal(saves,0); assert.equal(redraws,0);
const inputNode = input('medicine')[0]; inputNode.focus();
SM.set('stores.medicine',3,true); SM.fireUpdate('stores');
assert.equal(input('medicine')[0],inputNode,'stock refresh retains live input and cursor focus');
assert.equal(input('medicine').val(),'30'); assert.equal(document.activeElement,inputNode);
assert.match(input('medicine').nodes[0].parent.nodes[0].nodes[1].content,/库存 3/);
let stopped = false;
$('#loadoutEditorOverlay')[0].handlers.keyup[0]({key:'d',stopPropagation() { stopped = true; }});
assert.equal(stopped,true,'global page shortcuts cannot escape an input');
const cancel = $('#cancelLoadoutTargets')[0]; cancel.focus();
$('#loadoutEditorOverlay').trigger('keydown',{key:'Tab',target:cancel});
assert.equal(document.activeElement,L._dialog.rows[0].input[0]);
$('#loadoutEditorOverlay').trigger('keydown',{key:'Tab',shiftKey:true,target:document.activeElement});
assert.equal(document.activeElement,cancel);
const oldCommit = $('#saveLoadoutTargets')[0].handlers.click[0];
const savedStock = plain(context.State.stores);
$('#saveLoadoutTargets').trigger('click');
assert.equal(saves,1,'only one explicit preset write');
assert.equal(P.getLoadout('expedition').targets.medicine,30,'future targets are not clamped to home stock');
assert.equal(P.getLoadout('expedition').targets.torch,0,'zero stops refill, not removal of extra current supplies');
assert.equal(P.getLoadout('expedition').targets['legacy relic'],7);
assert.deepEqual(plain(P.getLoadout('expedition').equipped),{primary:['nichirin katana',null]},'old preset equipment preserved without sanitizing');
assert.deepEqual(plain(P.getLoadout('expedition').meta),{old:true});
assert.deepEqual(plain(context.State.character.loadouts.castle),other);
assert.deepEqual(plain(context.State.stores),savedStock); assert.equal(P.outfit,bag); assert.equal(context.State.character.equipped,equipped);
assert.equal(redraws,0,'save must not call mutation-capable updateOutfitting');
assert.match(result,/背包、库存和当前装备未改变/);
assert.equal(document.activeElement,trigger); assert.equal(subscribers.size,0);
const committed = snapshot(); oldCommit(); oldCommit(); assert.equal(snapshot(),committed,'duplicate detached save callbacks do nothing');

reset(); open(); edit('medicine','1.5');
assert.equal($('#saveLoadoutTargets').prop('disabled'),true);
const invalid = snapshot(); $('#saveLoadoutTargets').trigger('click'); assert.equal(snapshot(),invalid); assert.equal(saves,0);
edit('medicine','9007199254740992'); assert.equal($('#saveLoadoutTargets').prop('disabled'),true);
edit('medicine','12'); assert.equal($('#saveLoadoutTargets').prop('disabled'),false);
$('#cancelLoadoutTargets').trigger('click'); assert.equal(snapshot(),invalid); assert.equal(document.activeElement,trigger); assert.equal(subscribers.size,0);
open(); edit('medicine','10'); const escape = snapshot();
$('#loadoutEditorOverlay').trigger('keydown',{key:'Escape'}); assert.equal(snapshot(),escape); assert.equal(saves,0); assert.equal(subscribers.size,0);

reset(); open(); edit('medicine','20'); const stale = $('#saveLoadoutTargets')[0].handlers.click[0];
SM.set('character.loadouts.expedition.targets.medicine',9,true);
const newer = snapshot(); stale(); assert.equal(snapshot(),newer); assert.equal(saves,0);
assert.match($('#loadoutEditorError').text(),/其他操作中改变/);
assert.equal($('#saveLoadoutTargets').prop('disabled'),true);
L.close(false); open(); const superseded = $('#saveLoadoutTargets')[0].handlers.click[0];
const supersededCancel = $('#cancelLoadoutTargets')[0].handlers.click[0];
open(); superseded(); supersededCancel(); assert.equal($('#loadoutEditorOverlay').length,1); assert.equal(subscribers.size,1);
$('#cancelLoadoutTargets').trigger('click'); assert.equal(subscribers.size,0);

for (const change of [() => { context.Engine.activeModule = context.Room; }, () => { event = {}; }, () => { context.State.character.selectedLoadout = 'castle'; }]) {
  reset(); open(); edit('medicine','99'); const late = $('#saveLoadoutTargets')[0].handlers.click[0]; change();
  const blocked = snapshot(); late(); assert.equal(snapshot(),blocked); assert.equal(saves,0); assert.equal($('#loadoutEditorOverlay').length,0); assert.equal(subscribers.size,0);
}
for (const id of ['scrapQuantityOverlay','buyQuantityOverlay','castleReportOverlay','achievementsOverlay']) {
  reset(); const blocker = $('<div>').attr('id',id).appendTo('body'); assert.equal(L.show(trigger),false); blocker.remove(); assert.equal(saves,0);
}
reset(); context.Engine.activeModule = context.Space; assert.equal(L.show(trigger),false);
context.Engine.activeModule = P; event = {}; assert.equal(L.show(trigger),false);
reset(); open(); assert.equal(P.canScrap(),false,'editor blocks new recycling dialogs'); L.close(false);

reset(false); const absent = snapshot(); open();
assert.match($('.loadoutEditorNote').text(),/尚无保存配置/);
assert.equal(input('cured meat').val(),1); assert.equal(input('medicine').val(),0);
edit('medicine','5'); assert.equal(snapshot(),absent);
$('#saveLoadoutTargets').trigger('click'); assert.equal(saves,1);
assert.equal(P.getLoadout('expedition').targets.medicine,5);
assert.deepEqual(plain(P.getLoadout('expedition').equipped),{primary:['bone yari',null],secondary:['wisteria gun',null],tool:[null,null]});
assert.deepEqual(plain(context.State.outfit),{'cured meat':1,torch:2});
assert.equal(context.State.stores.medicine,0);

// Legacy unknown keys are preserved, even names meaningful to object prototypes.
reset(); context.State.character.loadouts.expedition.targets = JSON.parse('{"medicine":2,"__proto__":4,"legacy relic":7}');
open(); edit('medicine','3'); $('#saveLoadoutTargets').trigger('click');
assert.equal(Object.prototype.hasOwnProperty.call(P.getLoadout('expedition').targets,'__proto__'),true);
assert.equal(P.getLoadout('expedition').targets.__proto__,4);
assert.equal(saves,1);
console.log('PASS: pure future-target drafts, discovery filtering, live stock and space preview, safe integers, preserved unknown targets/equipment, one-save commits, stale/duplicate protection, focus/keyboard isolation, zero-write cancellation, and exploration guards.');
