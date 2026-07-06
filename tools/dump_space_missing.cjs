// 列 space.js 未译 keys（含 mojibake）
const fs = require('fs');
let t = {};
global._ = { setTranslation: o => { t = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));
const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const text = fs.readFileSync('script/space.js', 'utf8');
const out = new Set();
let m;
while ((m = RE.exec(text)) !== null) {
	const r = m[2].replace(/\\(.)/g, '$1');
	if (!r || r.includes('${')) continue;
	if (t[r] === undefined) out.add(r);
}
for (const k of out) console.log(JSON.stringify(k));
