// batch 10：武器熟练度 perk + telegraph 预警 + 血脉传承通知
const fs = require('fs');

const map = {
	// perk 三连
	"water breath I": "水之呼吸·初型",
	"melee weapons deal slightly more damage": "近战武器伤害略增",
	"found a rhythm with the blade. the strikes flow now.": "握刀的呼吸已稳——斩击如水流动。",
	"flame breath I": "焰之呼吸·初型",
	"the wisteria gun strikes harder": "紫藤之枪更具威力",
	"breath aligns with the trigger. the gun answers in kind.": "呼吸与扳机合一——枪声亦与之共鸣。",
	"thunder breath I": "雷之呼吸·初型",
	"ranged shots land with extra force": "远程射击附加力道",
	"every shot now arrives a moment ahead of expectation.": "每一发都比预想提前半瞬抵达。"
};

const fragments = {
	'air thickens': '血鬼术汇聚——周遭空气陡然凝重。',
	'technique fizzles': '它的凝神被打断——招式还未成形便消散。',
	'rearranging itself': '鼓点骤紧——一间隔室正在重新排列。',
	'rhythm breaks': '鼓点散乱——隔室停转。',
	'50 wood at your gate': '陨落队员之传承——50 木材陈于门前。',
	'supplies left at the wisteria gate': '陨落队员之传承——一批物资留在紫藤门口。',
	'their endurance lives on in you': '陨落队员之传承——他们的坚忍延续至你身上。',
	'a full caravan arrives in your name': '陨落队员之传承——一队完整的供给队以你之名而至。',
	'long, narrow strike': '血鬼术凝结——一道细长之击正在成形。',
	'fractures mid-form': '招式在成形过程中崩散——他踉跄退后。',
	'something heavy is being shaped': '他双手大张——某种沉重之物正在被塑造。',
	'scatters into the dark': '被塑形的招式溃散于黑暗中。'
};

// 从源码精确读 mojibake key 字节
let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const files = ['script/engine.js', 'script/events/encounters.js', 'script/prestige.js', 'script/space.js'];
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

const out = {};
for (const k of missing) {
	if (map[k]) { out[k] = map[k]; continue; }
	for (const frag of Object.keys(fragments)) {
		if (k.includes(frag)) { out[k] = fragments[frag]; break; }
	}
}

const lines = ['module.exports = {'];
for (const [k, v] of Object.entries(out)) lines.push('\t' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
lines.push('};');
fs.writeFileSync('tools/translations_batch10.cjs', lines.join('\n') + '\n');
console.log('wrote batch10 with', Object.keys(out).length, 'entries');
