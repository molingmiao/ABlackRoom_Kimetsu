// 直接从源文件抽出剩余 4 条未译 key 的精确字节，生成 batch6
const fs = require('fs');

let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const files = ['script/events/setpieces.js', 'script/events/executioner.js'];
const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const missing = [];
for (const f of files) {
	const text = fs.readFileSync(f, 'utf8');
	let m;
	while ((m = RE.exec(text)) !== null) {
		const raw = m[2].replace(/\\(.)/g, '$1');
		if (!raw || raw.includes('${')) continue;
		if (table[raw] === undefined) missing.push(raw);
	}
}

// 期望的中文译文（按出现顺序）
const cn = {
	'fortress': '鬼舞辻无惨便将其要塞——无限城——藏于此处。',
	'corridor': '血鬼术充盈走廊——火光为之扭曲、黯然。',
	'geometry': '周遭的空间在它身边扭曲变形——但通往深处的路，依然清晰。',
	'systems': '或许列车的系统仍能运转。'
};

const out = {};
for (const k of missing) {
	for (const tag of Object.keys(cn)) {
		if (k.includes(tag)) { out[k] = cn[tag]; break; }
	}
}

const lines = ['module.exports = {'];
for (const [k, v] of Object.entries(out)) {
	lines.push(`\t${JSON.stringify(k)}: ${JSON.stringify(v)},`);
}
lines.push('};');
fs.writeFileSync('tools/translations_batch6.cjs', lines.join('\n') + '\n');
console.log('wrote batch6 with', Object.keys(out).length, 'entries');
