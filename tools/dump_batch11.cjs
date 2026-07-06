// dump 待翻译 keys (achievements + engine 增量)
const fs = require('fs');
let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const files = ['script/achievements.js', 'script/engine.js'];
const out = new Set();
for (const f of files) {
	const text = fs.readFileSync(f, 'utf8');
	let m;
	while ((m = RE.exec(text)) !== null) {
		const raw = m[2].replace(/\\(.)/g, '$1');
		if (!raw || raw.includes('${')) continue;
		if (table[raw] === undefined) out.add(raw);
	}
}
const arr = [...out];
fs.writeFileSync('tools/translations-cache/.untranslated-batch11.json', JSON.stringify(arr, null, 2));
console.log('dumped', arr.length, 'keys');
