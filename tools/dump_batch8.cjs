// dump 待翻译 keys（events/global.js + outside.js + path.js）
const fs = require('fs');
let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const files = ['script/events/global.js', 'script/outside.js', 'script/path.js'];
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
fs.writeFileSync('tools/translations-cache/.untranslated-batch8.json', JSON.stringify(arr, null, 2));
console.log('dumped', arr.length, 'keys to tools/translations-cache/.untranslated-batch8.json');
