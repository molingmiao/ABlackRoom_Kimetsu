// 一次性迁移测试脚本：模拟旧存档跑 updateOldState 并断言新 key 都正确
// 用法：node tools/test_migrate.cjs

// 模拟 jQuery 与依赖
global.$ = function(){ return { extend: ()=>{} }; };
global.$.extend = (a,b) => Object.assign({},a,b);
global.$.Dispatch = ()=>({ subscribe: ()=>{}, publish: ()=>{} });

global.State = {
  version: 1.3,
  stores: {
    'alien alloy': 5,
    'energy cell': 12,
    'bullets': 200,
    'charm': 3,
    'bolas': 10,
    'grenade': 4,
    'bayonet': 1,
    'rifle': 2,
    'laser rifle': 1,
    'plasma rifle': 1,
    'bone spear': 1,
    'iron sword': 1,
    'steel sword': 1,
    'energy blade': 1,
    'wood': 1000,
    'fur': 500,
    'hypo blueprint': 1
  },
  outfit: {
    'bullets': 50,
    'hypo': 3,
    'cured meat': 20
  },
  character: {
    perks: {
      'boxer': true,
      'unarmed master': true,
      'evasive': true,
      'scout': true,
      'slow metabolism': true
    },
    blueprints: {
      'hypo': true,
      'kinetic armour': true,
      'plasma rifle': true
    }
  }
};

global.Notifications = { notify: ()=>{} };
global.Engine = { log: ()=>{}, saveGame: ()=>{} };

const fs = require('fs');
const src = fs.readFileSync('script/state_manager.js','utf8');
eval(src);
global.$SM = StateManager;
$SM.init({});

console.log('BEFORE migration:');
console.log('  stores:', JSON.stringify(State.stores));
console.log('  outfit:', JSON.stringify(State.outfit));
console.log('  perks:', JSON.stringify(State.character.perks));
console.log('  blueprints:', JSON.stringify(State.character.blueprints));

$SM.updateOldState();

console.log('\nAFTER migration (version=' + State.version + '):');
console.log('  stores:', JSON.stringify(State.stores));
console.log('  outfit:', JSON.stringify(State.outfit));
console.log('  perks:', JSON.stringify(State.character.perks));
console.log('  blueprints:', JSON.stringify(State.character.blueprints));

const assert = (cond, msg) => { if(!cond){ console.error('FAIL:', msg); process.exit(1); } };
assert(State.version === 1.4, 'version not 1.4');
assert(State.stores['demon stone'] === 5, 'demon stone not 5');
assert(State.stores['alien alloy'] === undefined, 'old alien alloy still present');
assert(State.stores['wisteria bullet'] === 200, 'wisteria bullet not 200');
assert(State.stores['bone yari'] === 1, 'bone yari not 1');
assert(State.stores['nichirin katana'] === 1, 'nichirin katana not 1');
assert(State.stores['flame blade'] === 1, 'flame blade not 1');
assert(State.stores['wisteria oil blueprint'] === 1, 'wisteria oil blueprint not migrated');
assert(State.outfit['wisteria bullet'] === 50, 'outfit wisteria bullet not 50');
assert(State.outfit['wisteria oil'] === 3, 'outfit wisteria oil not 3');
assert(State.outfit['hypo'] === undefined, 'outfit old hypo still present');
assert(State.character.perks['fist form one'] === true, 'fist form one not set');
assert(State.character.perks['fist form master'] === true, 'fist form master not set');
assert(State.character.perks['step yushin'] === true, 'step yushin not set');
assert(State.character.perks['crow scout'] === true, 'crow scout not set');
assert(State.character.perks['breath no food'] === true, 'breath no food not set');
assert(State.character.perks['boxer'] === undefined, 'old boxer still present');
assert(State.character.blueprints['wisteria oil'] === true, 'blueprint wisteria oil');
assert(State.character.blueprints['wind armour'] === true, 'blueprint wind armour');
assert(State.character.blueprints['thunder gun'] === true, 'blueprint thunder gun');
assert(State.character.blueprints['hypo'] === undefined, 'old blueprint hypo still present');

console.log('\n--- ALL MIGRATION ASSERTIONS PASSED ---');
