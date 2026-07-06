// batch 5：补完最后一批未翻译项
// 17 条 space.js 已是中文 key（自映射占位）+ 11 条真未译
const cjkSelf = [
	"下弦之鬼・六", "下弦之鬼・三",
	"上弦之鬼・四・半天狗", "上弦之鬼・壹・黑死牟",
	"鬼王・无惨",
	"炎柱・煉獄杏寿郎", "炎之呼吸・壹ノ型・不知火",
	"水柱・富冈义勇", "水之呼吸・拾壹ノ型・凪",
	"蛇柱・伊黑小芭内", "蛇之呼吸・伍ノ型・蜿蜒走り",
	"恋柱・甘露寺蜜璃", "恋之呼吸・陸ノ型・猫足恋風",
	"风柱・不死川实弥", "风之呼吸・伍ノ型・木枯らし颪",
	"報告: 炎柱・煉獄杏寿郎... fallen.", "報告: 水柱・富冈义勇... fallen."
];

const out = {};
for (const k of cjkSelf) out[k] = k.replace(/報告/g, '报告').replace(/煉獄/g, '炼狱').replace(/壹ノ型/g, '一型').replace(/拾壹ノ型/g, '十一型').replace(/伍ノ型/g, '五型').replace(/陸ノ型/g, '六型').replace(/猫足恋風/g, '猫足恋风').replace(/木枯らし颪/g, '凛冽寒风').replace(/蜿蜒走り/g, '蜿蜒疾走');

// 真正需要翻译的英文 / mojibake key
Object.assign(out, {
	"perks": "天赋",
	"kinetic": "动能护具",
	"emits a soft red glow": "散发着柔和的红色辉光",
	"stun": "震慑",
	"builder knows the strange device when she sees it. takes it for herself real quick. doesn’t ask where it came from.": "工匠一眼便认出那件奇异装置——二话不说收为己有，不曾过问它的来历。",
	// setpieces.js 无限城三句（` Ethe ` 是源码中破折号 mojibake，照搬以匹配）
	"this is where Muzan hides his fortress  Ethe Infinity Castle.": "鬼舞辻无惨便将其要塞——无限城——藏于此处。",
	"blood demon art fills the corridor  Ethe torchlight bends and dims.": "血鬼术充盈走廊——火光为之扭曲、黯然。",
	"the geometry shifts around it  Ebut the path downward is clear.": "周遭的空间在它身边扭曲变形——但通往深处的路，依然清晰。",
});

module.exports = out;
