const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Small DOM fixture exercising the production inventory renderer, not a copy of it.
class Element {
  constructor(tag) { this.tag=tag; this.attrs={}; this.nodes=[]; this.content=''; this.data={}; this.visible=true; }
}
const root=new Element('body');
const descendants=node=>node.nodes.flatMap(child=>[child,...descendants(child)]);
const matches=(node,selector)=>{
  const parts=selector.match(/^([\w-]+)?(?:#([\w-]+))?(?:\.([\w-]+))?$/);
  return !!parts && (!parts[1]||node.tag===parts[1]) && (!parts[2]||node.attrs.id===parts[2])
    && (!parts[3]||(node.attrs.class||'').split(' ').includes(parts[3]));
};
function select(nodes,selector) {
  const parts=selector.split(/\s*>\s*/);
  return nodes.filter(node=>matches(node,parts.at(-1)) && (parts.length===1 || node.parent&&matches(node.parent,parts[0])));
}
class Query {
  constructor(nodes) { this.nodes=nodes; this.length=nodes.length; nodes.forEach((node,i)=>{this[i]=node;}); }
  attr(key,value) {
    if(typeof key==='object') {this.nodes.forEach(node=>Object.assign(node.attrs,key));return this;}
    if(arguments.length===1)return this[0]?.attrs[key];
    this.nodes.forEach(node=>{node.attrs[key]=value;});return this;
  }
  addClass(value) {this.nodes.forEach(node=>{node.attrs.class=[node.attrs.class,value].filter(Boolean).join(' ');});return this;}
  hasClass(value) {return (this[0]?.attrs.class||'').split(' ').includes(value);}
  css() {return this;}
  animate() {return this;}
  children(selector) {const nodes=this.nodes.flatMap(node=>node.nodes);return new Query(selector?select(nodes,selector):nodes);}
  find(selector) {return new Query(select(this.nodes.flatMap(descendants),selector));}
  each(callback) {this.nodes.forEach((node,i)=>callback.call(node,i,node));return this;}
  text(value) {
    if(!arguments.length)return this.nodes.map(node=>[node,...descendants(node)].map(child=>child.content).join('')).join('');
    this.nodes.forEach(node=>{node.nodes=[];node.content=String(value);});return this;
  }
  remove() {this.nodes.forEach(node=>{if(node.parent)node.parent.nodes=node.parent.nodes.filter(child=>child!==node);node.parent=null;});return this;}
  appendTo(target) {const parent=$(target)[0];this.remove();this.nodes.forEach(node=>{node.parent=parent;parent.nodes.push(node);});return this;}
  prependTo(target) {const parent=$(target)[0];this.remove();this.nodes.forEach(node=>{node.parent=parent;parent.nodes.unshift(node);});return this;}
  prepend(child) {$(child).prependTo(this);return this;}
  insertAfter(target) {const previous=$(target)[0],parent=previous.parent;this.remove();parent.nodes.splice(parent.nodes.indexOf(previous)+1,0,...this.nodes);this.nodes.forEach(node=>{node.parent=parent;});return this;}
  toggle(value) {this.nodes.forEach(node=>{node.visible=!!value;});return this;}
  data(key,value) {if(arguments.length===1)return this[0]?.data[key];this.nodes.forEach(node=>{node.data[key]=value;});return this;}
  on() {return this;}
}
function $(value,context) {
  if(value instanceof Query)return value;
  if(value instanceof Element)return new Query([value]);
  if(value.startsWith('<'))return new Query([new Element(value.match(/^<(\w+)/)[1])]);
  if(value==='body')return new Query([root]);
  return new Query(select(context?$(context).nodes.flatMap(descendants):descendants(root),value));
}
$.Dispatch=()=>({publish() {}});
const c={$,State:{},_:value=>value,AudioLibrary:{},Engine:{log() {},saveGame() {}},
  Fabricator:{Craftables:{'nichirin blade water':{type:'weapon'}}},
  World:{Weapons:{'wisteria gun':{cost:{'wisteria bullet':1}},'nichirin blade water':{nichirinForged:true}}},
  Path:{getWeaponTier:()=>4,openPath() {}},Outside:{updateVillage() {}}};
c.window=c;
vm.createContext(c);
for(const file of ['state_manager.js','room.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../script',file),'utf8'),c);
const SM=c.$SM=c.StateManager,R=c.Room;
R.updateIncomeView=()=>{};
$('<div>').attr('id','storesContainer').appendTo('body');
const row=key=>$('#row_'+key.replaceAll(' ','-'));
const ammo=()=>$('#ammorow_wisteria-gun_wisteria-bullet');
const snapshot=()=>JSON.stringify(c.State);

SM.set('stores',{'bone yari':0,torch:0,compass:0,'wisteria gun':1,'wisteria bullet':0,
  'nichirin blade water':0,wood:0});
SM.set('game.knownButtons',{'bone yari':true,torch:true});
SM.set('character.blueprints',{'nichirin blade water':true});
SM.set('game.loadouts.default.targets',{'bone yari':5,torch:10});
const initial=snapshot();R.updateStoresView();
assert.equal(snapshot(),initial,'rendering never deletes zero inventory keys or preparation/discovery data');
for(const key of ['bone yari','torch','compass','nichirin blade water'])assert.equal(row(key).length,0,key+' zero item hidden');
assert.equal(row('wood').length,1,'materials visibility is intentionally unchanged');
assert.equal(row('wisteria gun').length,1);assert.equal(ammo().length,0,'zero ammunition subrows hidden');
assert.equal($('#weapons')[0].visible,true);
SM.set('stores["wisteria bullet"]',3);SM.set('stores.torch',2);SM.set('stores["nichirin blade water"]',1);
const replenished=snapshot();R.updateStoresView();
assert.equal(snapshot(),replenished);
assert.equal(ammo().length,1);assert.equal(ammo().find('.row_val').text(),'3');
assert.equal(row('torch').length,1);assert.equal(row('torch').find('.row_val').text(),'2');
assert.equal(row('nichirin blade water').hasClass('weapon-tier-4'),true,'replenished forged weapons keep their grade style');
SM.set('stores["wisteria bullet"]',0);R.updateStoresView();assert.equal(ammo().length,0);
SM.set('stores["wisteria bullet"]',4);R.updateStoresView();assert.equal(ammo().length,1);
SM.set('stores["wisteria gun"]',0);R.updateStoresView();
assert.equal(row('wisteria gun').length,0);assert.equal(ammo().length,0,'empty parent weapon removes its remaining ammo subrows');
SM.set('stores["wisteria gun"]',1);R.updateStoresView();assert.equal(ammo().length,1,'weapon restock restores positive ammo');
SM.remove('stores["wisteria gun"]');R.updateStoresView();
assert.equal(row('wisteria gun').length,0);assert.equal(ammo().length,0,'save migration key deletion does not leave stale item rows');
SM.set('stores.torch',0);SM.set('stores["nichirin blade water"]',0);SM.set('stores["wisteria bullet"]',0);R.updateStoresView();
assert.equal($('#weapons')[0].visible,false,'empty item group header is hidden');
SM.set('stores.torch',1);R.updateStoresView();
assert.equal($('#weapons')[0].visible,true);assert.equal(row('torch').length,1,'empty group restores without duplicates');
assert.equal($('#weapons').children('.storeGroupHeader').length,1);
assert.equal(SM.get('game.loadouts.default.targets.torch'),10);
assert.equal(SM.get('game.knownButtons.torch'),true);
assert.equal(SM.get('character.blueprints["nichirin blade water"]'),true);
console.log('PASS: real warehouse renderer hides zero tools/weapons/specials and ammo, restores restocked items/groups, removes migrated stale rows, preserves materials/discovery/blueprints/loadout targets.');
