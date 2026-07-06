// 从 global.js 抓精确 mojibake key 字节并生成 batch9
const fs = require('fs');
let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const text = fs.readFileSync('script/events/global.js', 'utf8');
const missing = [];
let m;
while ((m = RE.exec(text)) !== null) {
	const raw = m[2].replace(/\\(.)/g, '$1');
	if (!raw || raw.includes('${')) continue;
	if (table[raw] === undefined) missing.push(raw);
}

// 关键词 → 译文（按短语片段定位）
const map = {
	'great deal of medicine': '她说她能止住它——但需要大量药品，且要快。',
	'save half for emergencies': '克扣一半，留作应急',
	'sickness passes': '疫病堪堪退去。',
	'about half is still ruined': '蒸馏只保住了一半熏房——另一半仍要丢弃。'
};

const out = {};
for (const k of missing) {
	for (const frag of Object.keys(map)) {
		if (k.includes(frag)) { out[k] = map[frag]; break; }
	}
}

const lines = ['module.exports = {'];
for (const [k, v] of Object.entries(out)) lines.push('\t' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
lines.push('};');
fs.writeFileSync('tools/translations_batch9.cjs', lines.join('\n') + '\n');
console.log('wrote batch9 with', Object.keys(out).length, 'entries');
