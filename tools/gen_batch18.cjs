// batch 18：善逸/伊之助事件分支补反馈文案
const fs = require('fs');

let table = {};
global._ = { setTranslation: o => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;
const text = fs.readFileSync('script/events/room.js', 'utf8');
const missing = [];
let m;
while ((m = RE.exec(text)) !== null) {
	const raw = m[2].replace(/\\(.)/g, '$1');
	if (!raw || raw.includes('${')) continue;
	if (table[raw] === undefined) missing.push(raw);
}

const map = {
	'screaming lasts the better part':           '尖叫几乎持续了大半夜。',
	'fire stoked just to drown it out':          '你只能不停添柴来盖过他的哭嚎——天亮时，柴堆已被烧去一半。',
	'sleepless night by the fire':               '彻夜难眠——木材被白白烧去不少。',
	'rub your eyes':                             '揉揉酸涩的眼睛',
	'leaves a folded charm at the threshold':    '他在门槛上留下一枚折好的护身符，随即消失。',
	'breathing form is taught':                  '一式呼吸法已得传授——门口还留下一枚护身符。',
	'along with some of the cured meat and a charm': '次日清晨，他不见踪影——熏肉与护身符也少了一些。',
	'slayer wanders off at dawn':                '队员于清晨离去——补给有所遗失。',
	'snorts in disgust':                         '猪头队员鄙夷地哼了一声。',
	'kicks over a stack of supplies':            '他出门时一脚踢翻了一堆补给——毛皮与生皮散落一地。',
	'trashes some supplies':                     '野性队员临走前糟蹋了一些补给。',
	'right the shelves':                         '扶正货架',
	'bundle of trophies is left behind':         '他扔下一捆战利品——獠牙、生皮、护身符散在地上。',
	'wild slayer is bested':                     '野性队员败北——得到战利品和一项技艺。',
	'favour the bruised side for days':          '混乱中物资散落一地——你也因伤侧着身子歇了好几日。',
	'beaten by the wild slayer':                 '被野性队员压制——物资散失，伤药口粮也消耗了几日。'
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
fs.writeFileSync('tools/translations_batch18.cjs', lines.join('\n') + '\n');
console.log('wrote batch18 with', Object.keys(out).length, 'entries');
