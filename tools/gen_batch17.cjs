// 从源码精准抓 5 个 mojibake key 字节生成 batch17
const fs = require('fs');
let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const files = ['script/events/global.js', 'script/events/room.js'];
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

// 关键词 → 译文
const map = {
	'crow is found at dawn': '破晓时分，传讯鸦被发现倒毙于墙下——爪中令印已被撕成碎片。',
	'rider crow falls':      '传讯鸦坠地——绝大多数补给散失。',
	'Corps issues a writ':   '鬼杀队下达指令——补给已送达庄园门前。',
	'claws find skin':       '你旋身闪避——但爪尖仍触及肌肤。鬼影旋即没入黑暗。',
	'demon strikes from the woodpile': '柴堆中冲出一鬼——你身负伤痕。'
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
fs.writeFileSync('tools/translations_batch17.cjs', lines.join('\n') + '\n');
console.log('wrote batch17 with', Object.keys(out).length, 'entries');
