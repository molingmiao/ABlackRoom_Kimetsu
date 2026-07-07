/**
 * 鬼灭之刃 - 营地室内随机事件
 **/
Events.Room = [
{ /* 面具商人 - 替换游牧商人 */
title: _('The Mask Merchant'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.fur', true) > 0;
},
scenes: {
'start': {
text: [
_('a merchant with a peculiar ceramic mask arrives at the base.'),
_('says the swordsmith village sent him with rare goods for those who slay demons.')
],
notification: _('a mask merchant arrives, laden with wares'),
blink: true,
buttons: {
'buyScales': {
text: _('buy demon scales'),
cost: { 'fur': 100 },
reward: { 'scales': 1 },
notification: _('the merchant exchanges fur for demon scales.')
},
'buyTeeth': {
text: _('buy demon claws'),
cost: { 'fur': 200 },
reward: { 'teeth': 1 },
notification: _('the merchant hands over a bundle of demon claws.')
},
'buyBait': {
text: _('buy human scent bait'),
cost: { 'fur': 5 },
reward: { 'bait': 1 },
notification: _('the bait will lure demons into traps more reliably.')
},
'buyCompass': {
available: function() {
return $SM.get('stores.compass', true) < 1;
},
text: _('buy navigation compass'),
cost: { fur: 300, scales: 15, teeth: 5 },
reward: { 'compass': 1 },
notification: _('the compass is old but reliable — it will guide through demon territory.')
},
'goodbye': {
text: _('see him off'),
nextScene: 'end'
}
}
}
},
audio: AudioLibrary.EVENT_NOMAD
},
{ /* 妹妹的呜咽声 - 替换室外噪音 */
title: _('The Bamboo Box'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.wood');
},
scenes: {
'start': {
text: [
_('soft scratching sounds come from beyond the wall.'),
_('and beneath them — is that weeping?')
],
notification: _('strange sounds drift through the walls at nightfall'),
blink: true,
buttons: {
'investigate': {
text: _('go outside'),
nextScene: { 0.2: 'bitten', 0.5: 'nezuko', 1: 'nothing' }
},
'ignore': {
text: _('stay inside'),
nextScene: 'end'
}
}
},
'bitten': {
text: [
_('a hand of fingers too long reaches from behind the woodpile.'),
_('you twist away — but not before claws find skin. the demon vanishes into the dark.'),
_('the wound burns. you stagger inside, leaving a trail.')
],
notification: _('a demon strikes from the woodpile — you take wounds.'),
onLoad: function() {
	var lostMeat = Math.min(5, $SM.get('stores["cured meat"]', true));
	if (lostMeat > 0) $SM.add('stores["cured meat"]', -lostMeat);
	var lostWood = Math.min(15, $SM.get('stores.wood', true));
	if (lostWood > 0) $SM.add('stores.wood', -lostWood);
},
buttons: {
'backinside': {
text: _('limp back inside'),
nextScene: 'end'
}
}
},
'nothing': {
reward: { wood: 5 },
text: [
_('shapes move in the moonlight, just out of sight.'),
_('the sounds fade into the wind. you gather a few sticks on the way back.')
],
buttons: {
'backinside': {
text: _('go back inside'),
nextScene: 'end'
}
}
},
'nezuko': {
reward: { wood: 100, fur: 10 },
text: [
_('a bamboo-sealed box rests just outside the door, wrapped in a haori.'),
_('inside — warmth. something important, carefully preserved against the night.')
],
buttons: {
'backinside': {
text: _('carry it inside'),
nextScene: 'end'
}
}
}
},
audio: AudioLibrary.EVENT_NOISES_OUTSIDE
},
{ /* 鬼气侵入仓库 - 替换室内噪音 */
title: _('Demon Presence'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.wood');
},
scenes: {
start: {
text: [
_('a foul stench drifts from the supply room.'),
_('something with claws has been in here.')
],
notification: _('a demon has been in the supply room'),
blink: true,
buttons: {
'investigate': {
text: _('investigate'),
nextScene: { 0.5: 'scales', 0.8: 'teeth', 1: 'cloth' }
},
'ignore': {
text: _('seal the room'),
nextScene: 'end'
}
}
},
scales: {
text: [
_('bamboo charcoal is missing.'),
_('demon scales litter the floor — proof of the intruder.')
],
onLoad: function() {
var numWood = $SM.get('stores.wood', true);
numWood = Math.floor(numWood * 0.1);
if(numWood === 0) numWood = 1;
var numScales = Math.floor(numWood / 5);
if(numScales === 0) numScales = 1;
$SM.addM('stores', {'wood': -numWood, 'scales': numScales});
},
buttons: {
'leave': { text: _('clean up'), nextScene: 'end' }
}
},
teeth: {
text: [
_('bamboo charcoal is missing.'),
_('demon claws lie scattered where the creature squeezed through.')
],
onLoad: function() {
var numWood = $SM.get('stores.wood', true);
numWood = Math.floor(numWood * 0.1);
if(numWood === 0) numWood = 1;
var numTeeth = Math.floor(numWood / 5);
if(numTeeth === 0) numTeeth = 1;
$SM.addM('stores', {'wood': -numWood, 'teeth': numTeeth});
},
buttons: {
'leave': { text: _('clean up'), nextScene: 'end' }
}
},
cloth: {
text: [
_('bamboo charcoal is missing.'),
_('torn strips of black cloth hang from the broken shelves.')
],
onLoad: function() {
var numWood = $SM.get('stores.wood', true);
numWood = Math.floor(numWood * 0.1);
if(numWood === 0) numWood = 1;
var numCloth = Math.floor(numWood / 5);
if(numCloth === 0) numCloth = 1;
$SM.addM('stores', {'wood': -numWood, 'cloth': numCloth});
},
buttons: {
'leave': { text: _('clean up'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_NOISES_INSIDE
},
{ /* 受伤的鬼杀队员 - 替换乞丐 */
title: _('The Wounded Slayer'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.fur');
},
scenes: {
start: {
text: [
_('a demon slayer stumbles into camp, uniform torn and bloodied.'),
_('asks for furs to bind the wounds before the night claims him.')
],
notification: _('a wounded slayer collapses at the gate'),
blink: true,
buttons: {
'50furs': {
text: _('give 50 hides'),
cost: {fur: 50},
nextScene: { 0.5: 'scales', 0.8: 'teeth', 1: 'cloth' }
},
'100furs': {
text: _('give 100 hides'),
cost: {fur: 100},
nextScene: { 0.5: 'teeth', 0.8: 'scales', 1: 'cloth' }
},
'deny': {
text: _('turn him away'),
nextScene: 'end'
}
}
},
scales: {
reward: { scales: 20 },
text: [
_('the slayer leaves in the morning.'),
_('a bundle of demon scales — stripped from a recent kill — is all he leaves behind.')
],
buttons: {
'leave': { text: _('see him off'), nextScene: 'end' }
}
},
teeth: {
reward: { teeth: 20 },
text: [
_('the slayer recovers. he leaves at dawn without a word.'),
_('a pouch of demon claws sits on the doorstep.')
],
buttons: {
'leave': { text: _('see him off'), nextScene: 'end' }
}
},
cloth: {
reward: { cloth: 20 },
text: [
_('the slayer rises before the sun.'),
_('leaves a bundle of wisteria-dyed cloth — effective against demons — on the shelf.')
],
buttons: {
'leave': { text: _('see him off'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_BEGGAR
},
{ /* 冒牌训练师 - 替换可疑建筑工 */
title: _('The Fake Trainer'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('game.buildings["hut"]', true) >= 5 && $SM.get('game.buildings["hut"]', true) < 20;
},
scenes: {
'start': {
text: [
_('a man claiming to be a former Hashira passes through.'),
_('says he can build a training camp for less charcoal than the usual cost.')
],
notification: _('a suspicious trainer offers his services'),
buttons: {
'build': {
text: _('300 charcoal'),
cost: { 'wood' : 300 },
nextScene: {0.6: 'fraud', 1: 'build'}
},
'deny': { text: _('send him away'), nextScene: 'end' }
}
},
'fraud': {
text: [ _('the fake trainer vanishes with the charcoal in the night.') ],
notification: _('the fake trainer has made off with the charcoal'),
buttons: {
'end': { text: _('grit teeth'), nextScene: 'end' }
}
},
'build': {
text: [ _('the trainer actually builds a proper camp. perhaps not entirely a fraud.') ],
notification: _('a training camp is built'),
onLoad: function() {
var n = $SM.get('game.buildings["hut"]', true);
if(n < 20){ $SM.set('game.buildings["hut"]',n+1); }
},
buttons: {
'end': { text: _('return to watch'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_SHADY_BUILDER
},
{ /* 神秘柱士 - 以木材换更多木材 */
title: _('The Mysterious Hashira'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.wood');
},
scenes: {
start: {
text: [
_('a hashira arrives and surveys the stockpiles without expression.'),
_('says the Corps can resupply the camp, but first needs charcoal for the swordsmith.'),
_('the resident builder eyes the hashira with suspicion.')
],
notification: _('a mysterious hashira appears at the gates'),
blink: true,
buttons: {
'wood100': {
text: _('give 100 charcoal'),
cost: {wood: 100},
nextScene: { 1: 'wood100'}
},
'wood500': {
text: _('give 500 charcoal'),
cost: {wood: 500},
nextScene: { 1: 'wood500' }
},
'deny': { text: _('turn her away'), nextScene: 'end' }
}
},
'wood100': {
text: [ _('the hashira leaves with the charcoal, expression unchanged.') ],
action: function(inputDelay) {
var delay = inputDelay || false;
Events.saveDelay(function() {
$SM.add('stores.wood', 300);
Notifications.notify(Room, _('the hashira returns with quality charcoal from the swordsmith village.'));
}, 'Room[5].scenes.wood100.action', delay);
},
onLoad: function() {
if(Math.random() < 0.5) { this.action(60); }
},
buttons: {
'leave': { text: _('wait'), nextScene: 'end' }
}
},
'wood500': {
text: [ _('the hashira leaves with the charcoal, a slight nod of acknowledgment.') ],
action: function(inputDelay) {
var delay = inputDelay || false;
Events.saveDelay(function() {
$SM.add('stores.wood', 1500);
Notifications.notify(Room, _('the hashira returns with an enormous cart of charcoal. a debt repaid.'));
}, 'Room[5].scenes.wood500.action', delay);
},
onLoad: function() {
if(Math.random() < 0.3) { this.action(60); }
},
buttons: {
'leave': { text: _('wait'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_MYSTERIOUS_WANDERER
},
{ /* 隐秘的斥候 - 以皮毛换皮毛 */
title: _('The Hidden Scout'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.fur');
},
scenes: {
start: {
text: [
_('a cloaked figure arrives, face hidden under a wisteria-woven hood.'),
_('says she has demon hides from the eastern mountains. wants some from the west to complete a set.')
],
notification: _('a hidden scout arrives to trade demon hides'),
blink: true,
buttons: {
'fur100': {
text: _('give 100 hides'),
cost: {fur: 100},
nextScene: { 1: 'fur100'}
},
'fur500': {
text: _('give 500 hides'),
cost: {fur: 500},
nextScene: { 1: 'fur500' }
},
'deny': { text: _('send her away'), nextScene: 'end' }
}
},
'fur100': {
text: [ _('the scout disappears between the trees without a sound.') ],
action: function(inputDelay) {
var delay = inputDelay || false;
Events.saveDelay(function() {
$SM.add('stores.fur', 300);
Notifications.notify(Room, _('the scout returns with a bundle of rare demon hides from deep in the mountains.'));
}, 'Room[6].scenes.fur100.action', delay);
},
onLoad: function() {
if(Math.random() < 0.5) { this.action(60); }
},
buttons: {
'leave': { text: _('wait'), nextScene: 'end' }
}
},
'fur500': {
text: [ _('the scout nods once and vanishes into the night.') ],
action: function(inputDelay) {
var delay = inputDelay || false;
Events.saveDelay(function() {
$SM.add('stores.fur', 1500);
Notifications.notify(Room, _('the scout returns with an overwhelming cache of demon hides.'));
}, 'Room[6].scenes.fur500.action', delay);
},
onLoad: function() {
if(Math.random() < 0.3) { this.action(60); }
},
buttons: {
'leave': { text: _('wait'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_MYSTERIOUS_WANDERER
},
{ /* 前哨情报官 */
title: _('The Crow Scout'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('features.location.world');
},
scenes: {
'start': {
text: [
_("a crow scout arrives at the camp, exhausted from days of reconnaissance."),
_("willing to share what she knows of the demon territories, for a price.")
],
notification: _('a crow scout rests at the camp'),
blink: true,
buttons: {
'buyMap': {
text: _('buy demon territory map'),
cost: { 'fur': 200, 'scales': 10 },
available: function() { return !World.seenAll; },
notification: _('the map reveals patrol routes of demon blood art users'),
onChoose: World.applyMap
},
'learn': {
text: _('learn tracking'),
cost: { 'fur': 1000, 'scales': 50, 'teeth': 20 },
available: function() { return !$SM.hasPerk('crow scout'); },
onChoose: function() { $SM.addPerk('crow scout'); }
},
'leave': { text: _('see her off'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_SCOUT
},
{ /* 呼吸法传承者 - 替换漫游大师 */
title: _('The Breathing Master'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('features.location.world');
},
scenes: {
'start': {
text: [
_('an elderly master slayer arrives, bearing a hashira scar across her face.'),
_('she says she has not much longer to teach. asks only for shelter and food.')
],
notification: _('a breathing master seeks lodging for the night'),
blink: true,
buttons: {
'agree': {
text: _('welcome her'),
cost: { 'cured meat': 100, 'fur': 100, 'torch': 1 },
nextScene: {1: 'agree'}
},
'deny': { text: _('turn her away'), nextScene: 'end' }
}
},
'agree': {
text: [ _('through the night, she teaches what she knows of breathing forms.') ],
buttons: {
'evasion': {
text: _('Mist Breathing'),
available: function() { return !$SM.hasPerk('step yushin'); },
onChoose: function() { $SM.addPerk('step yushin'); },
nextScene: 'end'
},
'precision': {
text: _('Insect Breathing'),
available: function() { return !$SM.hasPerk('mikiri'); },
onChoose: function() { $SM.addPerk('mikiri'); },
nextScene: 'end'
},
'force': {
text: _('Flame Breathing'),
available: function() { return !$SM.hasPerk('slash mastery'); },
onChoose: function() { $SM.addPerk('slash mastery'); },
nextScene: 'end'
},
'nothing': { text: _('listen only'), nextScene: 'end' }
}
}
},
audio: AudioLibrary.EVENT_WANDERING_MASTER
},
{ /* 中毒的队员 - 替换病人 */
title: _('The Poisoned Slayer'),
isAvailable: function() {
return Engine.activeModule == Room && $SM.get('stores.medicine', true) > 0;
},
scenes: {
'start': {
text: [
_("a slayer staggers into camp, lips turning blue."),
_("whispers that a poison-type demon stung him hours ago.")
],
notification: _('a poisoned slayer collapses at the gates'),
blink: true,
buttons: {
'help': {
text: _('give antidote'),
cost: { 'medicine': 1 },
notification: _('the slayer drinks the antidote, shuddering'),
nextScene: { 0.1: 'alloy', 0.3: 'cells', 0.5: 'scales', 1.0: 'nothing' }
},
'ignore': { text: _('turn him away'), nextScene: 'end' }
}
},
'alloy': {
text: [
_("the slayer recovers."),
_('he leaves a strange fragment of metal — pried from a demon of no earthly origin.')
],
onLoad: function() { $SM.add('stores["demon stone"]', 1); },
buttons: { 'bye': { text: _('see him off'), nextScene: 'end' } }
},
'cells': {
text: [
_("the slayer recovers."),
_('he leaves glowing capsules — from a cave where demons dare not enter.')
],
onLoad: function() { $SM.add('stores["solar crystal"]', 3); },
buttons: { 'bye': { text: _('see him off'), nextScene: 'end' } }
},
'scales': {
text: [
_("the slayer recovers."),
_('all he has to offer are demon scales stripped in his last battle.')
],
onLoad: function() { $SM.add('stores.scales', 5); },
buttons: { 'bye': { text: _('see him off'), nextScene: 'end' } }
},
'nothing': {
text: [ _("the slayer bows deeply before disappearing into the dawn.") ],
buttons: { 'bye': { text: _('see him off'), nextScene: 'end' } }
}
},
audio: AudioLibrary.EVENT_SICK_MAN
},
{ /* 善逸的怒吼 - 新增特殊事件 */
title: _("Zenitsu's Outburst"),
isAvailable: function() {
return Engine.activeModule == Room
&& $SM.get('game.buildings["hut"]', true) >= 3;
},
scenes: {
'start': {
text: [
_('a blond slayer bursts into the base, screaming at the top of his lungs.'),
_('says he smelled a demon nearby. says he wants to go home.'),
_('collapses at your feet, sobbing.')
],
notification: _('screaming erupts from the training camp'),
blink: true,
buttons: {
'calm': {
text: _('calm him down'),
nextScene: {0.6: 'calmed', 1: 'asleep'}
},
'ignore': {
text: _('ignore the noise'),
nextScene: { 1: 'ignore_loss' }
}
}
},
'ignore_loss': {
text: [
_('the screaming lasts the better part of the night.'),
_('you keep the fire stoked just to drown it out. by morning, the wood is half what it was.')
],
notification: _('a sleepless night by the fire — wood is burned through.'),
onLoad: function() {
	var wood = $SM.get('stores.wood', true);
	if(wood > 10) { $SM.add('stores.wood', -Math.floor(wood * 0.15)); }
},
buttons: { 'leave': { text: _('rub your eyes'), nextScene: 'end' } }
},
'calmed': {
text: [
_('the blond slayer stops crying.'),
_('sniffling, he demonstrates a thunderclap breathing form — faster than the eye can follow.'),
_('he leaves a folded charm at the threshold before vanishing.')
],
notification: _('a breathing form is taught — and a charm left at the gate.'),
onLoad: function() {
if(!$SM.hasPerk('mikiri')) { $SM.addPerk('mikiri'); }
$SM.add('stores["wisteria charm"]', 2);
},
buttons: { 'leave': { text: _('return inside'), nextScene: 'end' } }
},
'asleep': {
text: [
_('the blond slayer falls asleep mid-sob.'),
_('in his sleep, he mutters about a girl.'),
_('by morning, he is gone — along with some of the cured meat and a charm or two.')
],
notification: _('the slayer wanders off at dawn — supplies missing.'),
onLoad: function() {
var meat = $SM.get('stores["cured meat"]', true);
if(meat > 5) { $SM.add('stores["cured meat"]', -Math.floor(meat * 0.15)); }
var charms = $SM.get('stores["wisteria charm"]', true);
if(charms > 1) { $SM.add('stores["wisteria charm"]', -1); }
},
buttons: { 'leave': { text: _('sigh'), nextScene: 'end' } }
}
},
audio: AudioLibrary.EVENT_BEGGAR
},
{ /* 猪突猛进 - 伊之助闯入 */
title: _('The Boar-Headed Challenger'),
isAvailable: function() {
return Engine.activeModule == Room
&& $SM.get('game.buildings["lodge"]', true) >= 1;
},
scenes: {
'start': {
text: [
_('the door explodes inward. a slayer wearing a boar head charges in screaming.'),
_('demands to fight the strongest here. says only those who bleed deserve to breathe.')
],
notification: _('a wild slayer charges into the base'),
blink: true,
buttons: {
'fight': {
text: _('accept the challenge'),
nextScene: {0.5: 'win', 1: 'lose'}
},
'refuse': {
text: _('ignore him'),
nextScene: { 1: 'refuse_loss' }
}
}
},
'refuse_loss': {
text: [
_('the boar-headed slayer snorts in disgust.'),
_('he kicks over a stack of supplies on his way out, sending pelts and skins everywhere.')
],
notification: _('the wild slayer trashes some supplies on his way out.'),
onLoad: function() {
	var fur = $SM.get('stores.fur', true);
	if(fur > 5) { $SM.add('stores.fur', -Math.floor(fur * 0.08)); }
	var leather = $SM.get('stores.leather', true);
	if(leather > 3) { $SM.add('stores.leather', -Math.floor(leather * 0.08)); }
},
buttons: { 'leave': { text: _('right the shelves'), nextScene: 'end' } }
},
'win': {
text: [
_('the boar-headed slayer is bested.'),
_('he sits stunned, then laughs with wild delight.'),
_('teaches you a dual-blade breathing form before storming back into the forest.'),
_('a bundle of trophies is left behind — fangs, leather, charms.')
],
notification: _('the wild slayer is bested — trophies and a perk are gained.'),
onLoad: function() {
if(!$SM.hasPerk('slash mastery')) { $SM.addPerk('slash mastery'); }
$SM.add('stores.teeth', 8);
$SM.add('stores.leather', 5);
$SM.add('stores["wisteria charm"]', 1);
},
buttons: { 'leave': { text: _('watch him leave'), nextScene: 'end' } }
},
'lose': {
text: [
_('the boar-headed slayer pins you in seconds.'),
_('declares himself the strongest and runs back into the wild.'),
_('some supplies are scattered in the chaos — and you favour the bruised side for days.')
],
notification: _('beaten by the wild slayer — supplies scattered, rations spent on recovery.'),
onLoad: function() {
var wood = $SM.get('stores.wood', true);
if(wood > 20) { $SM.add('stores.wood', -Math.floor(wood * 0.08)); }
var meat = $SM.get('stores["cured meat"]', true);
if(meat > 3) { $SM.add('stores["cured meat"]', -Math.floor(meat * 0.1)); }
},
buttons: { 'leave': { text: _('pick up the mess'), nextScene: 'end' } }
}
},
audio: AudioLibrary.EVENT_SHADY_BUILDER
},
{ /* 全集中·常中 - Total Concentration Breathing: Constant */
title: _('The Final Lesson'),
isAvailable: function() {
	return Engine.activeModule == Room
		&& $SM.get('features.location.world')
		&& !$SM.hasPerk('total concentration');
},
scenes: {
	'start': {
		text: [
			_('the breathing master returns in the dead of night.'),
			_('says she has one final technique to pass on, one that may save your life.'),
			_('Total Concentration Breathing — Constant. the body never stops breathing at full capacity.')
		],
		notification: _('the breathing master returns with a final gift'),
		blink: true,
		buttons: {
			'learn': {
				text: _('learn the technique'),
				cost: { 'cured meat': 200, 'fur': 200 },
				onChoose: function() { $SM.addPerk('total concentration'); },
				notification: _('you master Total Concentration Breathing — Constant. in battle, a second wind awaits.'),
				nextScene: 'end'
			},
			'refuse': { text: _('decline'), nextScene: 'end' }
		}
	}
},
audio: AudioLibrary.EVENT_WANDERING_MASTER
}
];

/* 游方铁匠：不进 EventPool 随机池，由 Events._merchantTimer 每 10 分钟触发一次
   动态按玩家拥有的武器类物品生成回收按钮，按 30% 材料价返还 */
Events.MerchantScrap = {
	title: _('游方铁匠'),
	isAvailable: function() { return true; },
	scenes: {
		'start': {
			text: [
				_('一位背着熔炉的行商停在营地边。'),
				_('他能按三成材料价回收多余的武器装备。')
			],
			notification: _('游方铁匠来到营地——可回收多余武器换回材料'),
			blink: true,
			onLoad: function() {
				var scene = Events.MerchantScrap.scenes.start;
				scene.buttons = {};
				var idx = 0;
				var buildRefund = function(cost) {
					var r = {};
					var text = [];
					for (var mat in cost) {
						var v = Math.floor(cost[mat] * 0.3);
						if (v > 0) {
							r[mat] = v;
							text.push(_(mat) + '+' + v);
						}
					}
					return { reward: r, text: text.join(' ') };
				};
				var addScrapBtn = function(key, srcObj) {
					if (typeof srcObj.cost !== 'function') return;
					var count = $SM.get('stores["' + key + '"]', true);
					if (count <= 0) return;
					var costObj;
					try { costObj = srcObj.cost(); } catch (e) { return; }
					if (!costObj) return;
					var built = buildRefund(costObj);
					if (Object.keys(built.reward).length === 0) return;
					var id = 'scrap' + (idx++);
					(function(k, r) {
						scene.buttons[id] = {
							text: _('回收 ') + _(k) + ' (' + built.text + ')',
							reward: r,
							available: function() { return $SM.get('stores["' + k + '"]', true) > 0; },
							onChoose: function() {
								if ($SM.get('stores["' + k + '"]', true) > 0) {
									$SM.add('stores["' + k + '"]', -1);
								}
							},
							notification: _('回收了 ') + _(k)
						};
					})(key, built.reward);
				};
				for (var key in Room.Craftables) {
					var item = Room.Craftables[key];
					if (item.type === 'weapon') addScrapBtn(key, item);
				}
				scene.buttons['leave'] = { text: _('目送他离开'), nextScene: 'end' };
			},
			buttons: {} // 占位；由 onLoad 动态填充
		}
	}
};
