// 检查动态 _(key) 调用的翻译覆盖（stores keys / weapons verbs / armour 等）
const fs = require('fs');
const path = require('path');

let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

// 从源码扫所有 stores key 候选（包括 stores['x']、'x': { quantity 之类、reward/loot key、craftable key）
const sources = [
	'script/path.js', 'script/world.js', 'script/room.js',
	'script/fabricator.js', 'script/ship.js', 'script/outside.js',
	'script/space.js',
	'script/events/global.js', 'script/events/room.js', 'script/events/outside.js',
	'script/events/encounters.js', 'script/events/setpieces.js',
	'script/events/executioner.js', 'script/events/prologue.js',
	'script/events/marketing.js'
];

const keys = new Set();

// 收集字符串字面量 key
for (const f of sources) {
	const text = fs.readFileSync(f, 'utf8');
	// stores['x'] 或 stores["x"]
	for (const m of text.matchAll(/stores\[\s*['"]([^'"]+)['"]\s*\]/g)) keys.add(m[1]);
	// reward / loot / cost 等里的 'x': { 形式
	for (const m of text.matchAll(/['"]([a-z][a-z0-9 ]*?)['"]\s*:\s*\{\s*(?:min|max|chance|type|verb|cost|damage|cooldown|quantity)/g)) keys.add(m[1]);
}

// 已知 stores key 集合（用 state_manager 重命名表里的新名 + 常见基础资源）
const known = [
	'wood', 'fur', 'meat', 'cured meat', 'scales', 'teeth', 'cloth', 'leather',
	'iron', 'coal', 'steel', 'sulphur', 'medicine', 'bait', 'torch',
	'wisteria bullet', 'wisteria gun', 'wisteria bomb', 'wisteria charm',
	'nichirin gun', 'nichirin katana', 'nichirin spear', 'kou katana',
	'bone yari', 'kusarigama', 'flame blade', 'bind kunai', 'thunder gun',
	'demon stone', 'solar crystal', 'firefly orb', 'grenade', 'bolas',
	'l armour', 'i armour', 's armour', 'wind armour',
	'kinetic', 'rope', 'compass', 'wagon', 'rucksack', 'convoy', 'cargo crow',
	'energy cell', 'alien alloy', 'water', 'hp'
];
known.forEach(k => keys.add(k));

const missing = [];
for (const k of keys) {
	if (table[k] === undefined) missing.push(k);
}

console.log('total candidate keys:', keys.size);
console.log('untranslated dynamic keys:', missing.length);
console.log('');
missing.sort().forEach(k => console.log('  ' + JSON.stringify(k)));
