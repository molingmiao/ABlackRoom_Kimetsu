// 一次性脚本：dump 一批文件的未翻译 _() 字符串到 .untranslated-batch1.json
const fs = require('fs');
const path = require('path');

let table = {};
global._ = { setTranslation: (o) => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;

const TARGETS = [
	'script/ship.js',
	'script/events/marketing.js',
	'script/engine.js',
	'script/events/global.js',
	'script/events/setpieces.js'
];

const out = {};
for (const f of TARGETS) {
	const text = fs.readFileSync(f, 'utf8');
	out[f] = [];
	let m;
	while ((m = RE.exec(text)) !== null) {
		const raw = m[2].replace(/\\(.)/g, '$1');
		if (raw.length === 0) continue;
		if (raw.includes('${')) continue;
		if (table[raw] !== undefined) continue;
		if (!out[f].includes(raw)) out[f].push(raw);
	}
}

fs.writeFileSync('tools/translations-cache/.untranslated-batch1.json', JSON.stringify(out, null, 2), 'utf8');
let total = 0;
for (const f of Object.keys(out)) {
	console.log(f.padEnd(35), out[f].length);
	total += out[f].length;
}
console.log('--- total batch 1:', total);
