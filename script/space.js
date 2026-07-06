/**
 * 无限城 / Infinity Castle — 层级节点探索
 *
 * 玩家从地表潜入鬼王的领域，逐层下沉。每层有多个节点供选择（战斗 / 精英 /
 * 商店 / 休整 / 宝箱），每 10 层一个楼层 boss，最底层迎战无惨。
 *
 * 设计参考：roguelike 楼层节点选择。进入后无法退出，死亡时整队回到地表，
 * 需要从 Ship 再次 liftoff 重新潜入；HP / 库存均与 World 直接同步。
 */
var Space = {

	MAX_FLOOR: 40,
	BOSS_FLOORS: [10, 20, 30],
	MUZAN_FLOOR: 40,

	// Muzan fight: 5 Pillar assists, one every 12 seconds
	PILLAR_COUNT: 5,
	PILLAR_INTERVAL: 12000,

	done: false,
	currentFloor: 0,
	floorNodes: null,   // { 1: [{type, ...}, ...], ... }
	floorEntered: false, // 当前层是否已选过节点（防止重复）
	_pillarTimers: [],
	_pillarIndex: 0,

	name: "Descent",

	init: function(options) {
		this.options = $.extend(this.options || {}, options);

		this.panel = $('<div>').attr('id', "spacePanel")
			.addClass('location')
			.appendTo('#outerSlider');

		$.Dispatch('stateUpdate').subscribe(Space.handleStateUpdates);
	},

	options: {},

	onArrival: function() {
		Space.done = false;
		Space.currentFloor = 1;
		Space.floorEntered = false;
		Space._pillarTimers = [];
		Space._pillarIndex = 0;
		Space._lastChapter = null;

		// 战前确保 HP 至少 30，给玩家行动余地
		World.setHp(Math.max(30, World.health || 30));

		Engine.keyLock = false;
		Space.setTitle();
		AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_SPACE);

		// 静态背景，不再随时间渐变
		var body_color = Engine.isLightsOff() ? '#272823' : '#FFFFFF';
		$('body').addClass('noMask').css({ backgroundColor: body_color });
		var s = 'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)';
		$('#notifyGradient').attr('style',
			'background-color:' + body_color + ';background:-webkit-' + s + ';background:' + s);

		// 生成 40 层节点数据
		Space.generateFloors();

		// 显示第一层
		Space.showFloor();
	},

	setTitle: function() {
		if(Engine.activeModule == this) {
			var t, chapterKey;
			var f = Space.currentFloor;
			if(f < 10)        { t = _("Upper Castle");             chapterKey = 'upper'; }
			else if(f < 20)   { t = _("Twisting Corridors");       chapterKey = 'corridors'; }
			else if(f < 30)   { t = _("The Dark Labyrinth");       chapterKey = 'labyrinth'; }
			else if(f < 40)   { t = _("The Abyss");                chapterKey = 'abyss'; }
			else              { t = _("Muzan's Throne");           chapterKey = 'throne'; }
			document.title = t;

			if (Space._lastChapter && Space._lastChapter !== chapterKey) {
				var transitions = {
					'corridors': _('the corridors twist into a maze. there is no way back.'),
					'labyrinth': _('the walls bleed shadow. you are deep below the world now.'),
					'abyss':     _('the air grows thick with blood. the demons here are no mere foot soldiers.'),
					'throne':    _("Muzan's throne hall yawns open. the final descent.")
				};
				if (transitions[chapterKey]) {
					try { Notifications.notify(null, transitions[chapterKey]); } catch(_) {}
				}
			}
			Space._lastChapter = chapterKey;
		}
	},

	/**
	 * 生成全部 40 层节点。
	 * - 第 40 层：muzan
	 * - 第 10/20/30 层：boss
	 * - 其它层：2-4 个节点，至少 1 个 battle，其余按权重随机
	 */
	generateFloors: function() {
		Space.floorNodes = {};
		for (var f = 1; f <= Space.MAX_FLOOR; f++) {
			if (f === Space.MUZAN_FLOOR) {
				Space.floorNodes[f] = [{ type: 'muzan' }];
			} else if (Space.BOSS_FLOORS.indexOf(f) !== -1) {
				Space.floorNodes[f] = [{ type: 'boss' }];
			} else {
				Space.floorNodes[f] = Space._buildRegularFloor(f);
			}
		}
	},

	_buildRegularFloor: function(floor) {
		var count = 2 + Math.floor(Math.random() * 3);  // 2-4 节点
		var nodes = [{ type: 'battle' }]; // 必有 1 个 battle
		var weights = {
			battle:   0.30,
			elite:    0.15,
			shop:     0.15,
			rest:     0.20,
			treasure: 0.20
		};
		// 前期减少精英概率，后期增加
		if (floor < 10) weights.elite = 0.05;
		if (floor > 25) { weights.elite = 0.25; weights.rest = 0.15; }
		var typeOrder = ['battle', 'elite', 'shop', 'rest', 'treasure'];
		for (var i = 1; i < count; i++) {
			var r = Math.random();
			var acc = 0;
			for (var j = 0; j < typeOrder.length; j++) {
				acc += weights[typeOrder[j]];
				if (r < acc) {
					nodes.push({ type: typeOrder[j] });
					break;
				}
			}
		}
		return nodes;
	},

	/**
	 * 渲染当前层 UI：HP 状态 + 行动菜单 + 节点选择按钮
	 */
	showFloor: function() {
		var panel = Space.panel;
		panel.empty();
		Space.floorEntered = false;
		Space.setTitle();

		// 顶部状态
		var hdr = $('<div>').attr('id', 'floorHeader').appendTo(panel);
		$('<div>').addClass('floorTitle')
			.text(_('Floor {0} / {1}', Space.currentFloor, Space.MAX_FLOOR))
			.appendTo(hdr);
		var statusBar = $('<div>').addClass('floorStatus').appendTo(hdr);
		$('<span>').addClass('floorHp')
			.text(_('hp: {0}/{1}', World.health, World.getMaxHealth()))
			.appendTo(statusBar);

		// 行动菜单：进入节点前的准备（吃肉 / 用药品 / 用紫藤油）
		var actionBar = $('<div>').addClass('floorActionBar').appendTo(panel);
		$('<div>').addClass('floorSubTitle').text(_('prepare:')).appendTo(actionBar);
		var actionRow = $('<div>').addClass('floorActionRow').appendTo(actionBar);

		Space._addActionBtn(actionRow, 'cured meat', _('eat cured meat (+{0} hp)', World.MEAT_HEAL || 8));
		Space._addActionBtn(actionRow, 'medicine',   _('use medicine (+{0} hp)',   World.MEDS_HEAL || 20));
		Space._addActionBtn(actionRow, 'wisteria oil', _('use wisteria oil (+30 hp)'));

		// 节点选择区
		var nodeWrap = $('<div>').addClass('floorNodeWrap').appendTo(panel);
		$('<div>').addClass('floorSubTitle').text(_('choose your path:')).appendTo(nodeWrap);
		var nodeArea = $('<div>').addClass('floorNodeArea').appendTo(nodeWrap);
		var nodes = Space.floorNodes[Space.currentFloor];
		nodes.forEach(function(n, idx) {
			$('<div>')
				.addClass('nodeBtn nodeType-' + n.type)
				.html(Space._nodeLabel(n))
				.click(function() { Space.enterNode(n, idx); })
				.appendTo(nodeArea);
		});
	},

	_addActionBtn: function(parent, item, label) {
		var btn = $('<div>').addClass('floorActionBtn menuBtn').text(label);
		var have = $SM.get('stores["' + item + '"]', true);
		if (!have || have <= 0) btn.addClass('disabled');
		btn.click(function() {
			if (btn.hasClass('disabled')) return;
			if (item === 'cured meat') {
				$SM.add('stores["cured meat"]', -1);
				World.setHp(Math.min(World.getMaxHealth(), World.health + (World.MEAT_HEAL || 8)));
			} else if (item === 'medicine') {
				$SM.add('stores.medicine', -1);
				World.setHp(Math.min(World.getMaxHealth(), World.health + (World.MEDS_HEAL || 20)));
			} else if (item === 'wisteria oil') {
				$SM.add('stores["wisteria oil"]', -1);
				World.setHp(Math.min(World.getMaxHealth(), World.health + 30));
			}
			Space.showFloor(); // 刷新 UI（含 HP/库存）
		});
		btn.appendTo(parent);
	},

	_nodeLabel: function(n) {
		switch (n.type) {
			case 'battle':   return _('demon ahead') + '<br><small>' + _('combat encounter') + '</small>';
			case 'elite':    return _('elite demon') + '<br><small>' + _('stronger foe, richer loot') + '</small>';
			case 'shop':     return _('shadow merchant') + '<br><small>' + _('trade for supplies') + '</small>';
			case 'rest':     return _('quiet alcove') + '<br><small>' + _('rest and recover') + '</small>';
			case 'treasure': return _('hidden cache') + '<br><small>' + _('a small reward') + '</small>';
			case 'boss':     return _('floor boss') + '<br><small>' + _('a guardian blocks the descent') + '</small>';
			case 'muzan':    return _('throne of Muzan') + '<br><small>' + _('the final confrontation') + '</small>';
		}
		return n.type;
	},

	/**
	 * 进入节点：根据 type 触发对应 event。
	 * Event 结束后玩家点击 'continue' 按钮，触发 Space.afterNode 推进到下一层。
	 */
	enterNode: function(node, idx) {
		if (Space.floorEntered) return;
		Space.floorEntered = true;
		Space.panel.empty();
		switch (node.type) {
			case 'battle':   Space.triggerBattle(false); break;
			case 'elite':    Space.triggerBattle(true);  break;
			case 'shop':     Space.triggerShop();        break;
			case 'rest':     Space.triggerRest();        break;
			case 'treasure': Space.triggerTreasure();    break;
			case 'boss':     Space.triggerBossFight();   break;
			case 'muzan':    Space.triggerMuzan();       break;
		}
	},

	/**
	 * 节点结束回调：推进到下一层，或触发胜利
	 */
	afterNode: function() {
		if (Space.done) return;
		Space.currentFloor++;
		if (Space.currentFloor > Space.MAX_FLOOR) {
			// 不应该到这里（最后一层是 Muzan，胜利由 triggerMuzan 处理）
			return;
		}
		Space.showFloor();
	},

	// ---- 节点：战斗 ----

	_pickEnemy: function(floor, isElite) {
		// 按 floor 缩放敌人参数。Elite 在普通基础上 +50% HP / +30% dmg
		var hp = Math.floor(8 + floor * 1.6);
		var dmg = Math.floor(2 + floor * 0.4);
		var hit = 0.75 + Math.min(0.15, floor * 0.004);
		var delay = Math.max(1.2, 2.4 - floor * 0.02);

		var enemyNames = [
			'forest demon', 'claw demon', 'blood mist demon',
			'twin demon', 'centipede demon', 'man-eater',
			'spider demon', 'water demon', 'thread demon',
			'frenzied demon', 'lower moon shadow'
		];
		var enemy = enemyNames[Math.min(enemyNames.length - 1, Math.floor(floor / 4))];

		if (isElite) {
			hp = Math.floor(hp * 1.6);
			dmg = Math.floor(dmg * 1.3);
			enemy = 'elite ' + enemy;
		}
		return { enemy: enemy, hp: hp, dmg: dmg, hit: hit, delay: delay };
	},

	_battleLoot: function(floor, isElite) {
		var loot = {
			'meat':    { min: 2, max: 5, chance: 0.9 },
			'cured meat': { min: 1, max: 2, chance: 0.5 },
			'teeth':   { min: 1, max: 4, chance: 0.7 }
		};
		if (floor >= 10) loot['wisteria charm'] = { min: 1, max: 1, chance: 0.3 };
		if (floor >= 20) loot['solar crystal']  = { min: 1, max: 2, chance: 0.3 };
		if (isElite) {
			loot['medicine'] = { min: 1, max: 3, chance: 0.7 };
			loot['demon stone'] = { min: 1, max: 1, chance: 0.3 };
		}
		return loot;
	},

	triggerBattle: function(isElite) {
		var e = Space._pickEnemy(Space.currentFloor, isElite);
		var titleText = isElite ? _(e.enemy) + ' ' + _('(elite)') : _(e.enemy);
		Events.startEvent({
			title: titleText,
			scenes: {
				'start': {
					combat: true,
					enemy: e.enemy,
					enemyName: _(e.enemy),
					chara: '鬼',
					damage: e.dmg,
					hit: e.hit,
					attackDelay: e.delay,
					health: e.hp,
					notification: _('a demon blocks the way down.'),
					deathMessage: _('the demon dissolves into ash.'),
					loot: Space._battleLoot(Space.currentFloor, isElite),
					buttons: {
						'continue': {
							text: _('continue down'),
							cooldown: Events._LEAVE_COOLDOWN,
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：精英楼层 Boss（每 10 层）----

	_bossDef: function(floor) {
		// 楼层 boss 数据：HP / dmg 比同层 elite 再强
		if (floor === 10) return { enemy: 'lower moon six', hp: 80,  dmg: 6, hit: 0.80, delay: 1.8 };
		if (floor === 20) return { enemy: 'lower moon three', hp: 130, dmg: 9, hit: 0.85, delay: 1.6 };
		if (floor === 30) return { enemy: 'upper moon four (the dome)', hp: 200, dmg: 13, hit: 0.85, delay: 1.5 };
		return null;
	},

	triggerBossFight: function() {
		var b = Space._bossDef(Space.currentFloor);
		if (!b) { Space.afterNode(); return; }
		var loot = {
			'demon stone':    { min: 1, max: 2, chance: 1.0 },
			'medicine':       { min: 2, max: 5, chance: 1.0 },
			'solar crystal':  { min: 1, max: 3, chance: 0.8 },
			'wisteria charm': { min: 1, max: 3, chance: 0.6 }
		};
		Events.startEvent({
			title: _(b.enemy),
			scenes: {
				'start': {
					combat: true,
					enemy: b.enemy,
					enemyName: _(b.enemy),
					chara: '弦',
					damage: b.dmg,
					hit: b.hit,
					attackDelay: b.delay,
					health: b.hp,
					notification: _('the floor warps. a guardian rises to bar your descent.'),
					deathMessage: _('the guardian collapses into ash. the way down is open.'),
					loot: loot,
					telegraphAttacks: [
						{
							interval: 14,
							telegraphSec: 1.5,
							telegraph: _('the guardian gathers its blood demon art \u2014 brace yourself.'),
							interruptedText: _('the technique fizzles.'),
							dmg: Math.floor(b.dmg * 1.4),
							hit: 0.9
						}
					],
					buttons: {
						'continue': {
							text: _('continue down'),
							cooldown: Events._LEAVE_COOLDOWN,
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：商店 ----

	_shopPrices: function(floor) {
		var s = Math.max(0.6, 1.2 - floor * 0.01);
		return {
			medicineWood:   Math.ceil(80 * s),
			charmFur:       Math.ceil(120 * s),
			oilScales:      Math.ceil(40 * s),
			torchCloth:     Math.ceil(20 * s)
		};
	},

	triggerShop: function() {
		var p = Space._shopPrices(Space.currentFloor);
		Events.startEvent({
			title: _('shadow merchant'),
			scenes: {
				'start': {
					text: [
						_('a hooded figure sits on a crate of unmarked goods.'),
						_('"i take wood, fur, scales, cloth. i give what you need below."')
					],
					buttons: {
						'buyMed': {
							text: _('buy medicine ({0} wood)', p.medicineWood),
							cost: { 'wood': p.medicineWood },
							onChoose: function() { $SM.add('stores.medicine', 1); },
							nextScene: { 1: 'start' }
						},
						'buyCharm': {
							text: _('buy wisteria charm ({0} fur)', p.charmFur),
							cost: { 'fur': p.charmFur },
							onChoose: function() { $SM.add('stores["wisteria charm"]', 1); },
							nextScene: { 1: 'start' }
						},
						'buyOil': {
							text: _('buy wisteria oil ({0} scales)', p.oilScales),
							cost: { 'scales': p.oilScales },
							onChoose: function() { $SM.add('stores["wisteria oil"]', 1); },
							nextScene: { 1: 'start' }
						},
						'buyTorch': {
							text: _('buy torch ({0} cloth)', p.torchCloth),
							cost: { 'cloth': p.torchCloth },
							onChoose: function() { $SM.add('stores.torch', 1); },
							nextScene: { 1: 'start' }
						},
						'leave': {
							text: _('leave shop'),
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：休整点 ----

	triggerRest: function() {
		Events.startEvent({
			title: _('a quiet alcove'),
			scenes: {
				'start': {
					text: [
						_('the corridor widens into a quiet alcove. no demons here.'),
						_('you can breathe. you can mend.')
					],
					buttons: {
						'heal': {
							text: _('rest and recover (+40% hp)'),
							onChoose: function() {
								var heal = Math.floor(World.getMaxHealth() * 0.4);
								World.setHp(Math.min(World.getMaxHealth(), World.health + heal));
								Notifications.notify(null, _('the moment of stillness passes. you breathe again.'));
							},
							nextScene: { 1: 'after' }
						},
						'sharpen': {
							text: _('sharpen your blade (loses 30 wood, +1 to next damage)'),
							cost: { 'wood': 30 },
							onChoose: function() {
								Space._sharpenedNext = true;
								Notifications.notify(null, _('the blade gleams with a fresh edge.'));
							},
							nextScene: { 1: 'after' }
						}
					}
				},
				'after': {
					text: [
						_('it is time to move again.')
					],
					buttons: {
						'continue': {
							text: _('continue down'),
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：宝箱 ----

	_rollTreasure: function(floor) {
		var pool = [
			{ key: 'wisteria charm', min: 1, max: 2 },
			{ key: 'medicine',       min: 1, max: 3 },
			{ key: 'cured meat',     min: 3, max: 6 },
			{ key: 'wisteria bullet', min: 2, max: 5 },
			{ key: 'solar crystal',  min: 1, max: 2 },
			{ key: 'iron',           min: 5, max: 15 },
			{ key: 'steel',          min: 2, max: 8 }
		];
		// 后期偏向稀有
		if (floor >= 25) pool.push({ key: 'demon stone', min: 1, max: 2 });
		// 随机抽 1-2 件
		var n = 1 + (Math.random() < 0.4 ? 1 : 0);
		var loot = {};
		for (var i = 0; i < n; i++) {
			var p = pool[Math.floor(Math.random() * pool.length)];
			var amt = p.min + Math.floor(Math.random() * (p.max - p.min + 1));
			loot[p.key] = (loot[p.key] || 0) + amt;
		}
		return loot;
	},

	triggerTreasure: function() {
		var loot = Space._rollTreasure(Space.currentFloor);
		var lootMsg = [];
		for (var k in loot) lootMsg.push(_(k) + ' +' + loot[k]);
		Events.startEvent({
			title: _('a hidden cache'),
			scenes: {
				'start': {
					text: [
						_('something glints in a crack of the wall \u2014 a small cache, left by someone long gone.'),
						_('inside: ') + lootMsg.join(', ') + '.'
					],
					onLoad: function() { $SM.addM('stores', loot); },
					buttons: {
						'continue': {
							text: _('continue down'),
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- MUZAN BOSS FIGHT ----

	triggerMuzan: function() {
World.setHp(Math.max(30, Space.playerHp));
Space._pillarIndex = 0;
Space._pillarTimers = [];

Events.startEvent({
title: _('鬼王・无惨'),
scenes: {
'start': {
combat: true,
enemy: _('鬼王・无惨'),
chara: 'M',
damage: 8,
hit: 0.90,
attackDelay: 3,
health: 200,
notification: _('the Demon King Muzan stands at the heart of his castle. hold on until dawn.'),
loot: {},
telegraphAttacks: [
	{
		interval: 10,
		telegraphSec: 1.5,
		telegraph: _('blood demon art coalesces — a long, narrow strike is coming.'),
		interruptedText: _('the technique fractures mid-form; he reels back.'),
		dmg: 14,
		hit: 0.95,
		ranged: true
	},
	{
		interval: 25,
		telegraphSec: 2,
		telegraph: _('he opens both hands — something heavy is being shaped.'),
		interruptedText: _('the shaped technique scatters into the dark.'),
		dmg: 22,
		hit: 0.85,
		ranged: false
	}
],
buttons: {
'survive': {
text: _('the sun rises'),
cooldown: Events._LEAVE_COOLDOWN,
onChoose: Space.onMuzanFightEnd,
nextScene: { 1: 'dawn' }
}
}
},
'dawn': {
text: [
_('the first light of dawn pierces the collapsing castle walls.'),
_('Muzan screams — his body begins to disintegrate in the sunlight.'),
_('the Pillars stand around you, battered but alive.'),
_('no more demons will be born. the age of demons is over.')
],
onLoad: function() { $SM.set('game.muzanSlain', true, true); },
buttons: {
'continue': {
text: _('watch him burn'),
nextScene: { 1: 'muzan_fades' }
}
}
},
'muzan_fades': {
text: [
_('Muzan reaches a clawed hand toward the sun. it crumbles before it touches the light.'),
_('he turns to ash, to dust, to nothing — but a faint dark wind that slips into a small figure beside you.'),
_('the small figure is a boy in a black-and-green checked haori. his eyes — once human — are now demon-red.')
],
notification: _('Muzan dies — but a shadow lingers.'),
buttons: {
'kamado': {
text: _('reach for the boy'),
nextScene: { 1: 'kamado_human' }
}
}
},
'kamado_human': {
text: [
_('Kocho draws a syringe. Tomioka holds the boy still. the boy — Kamado — thrashes, fangs lengthening.'),
_('"the antidote." Kocho whispers. "ours. swordsmith\'s. mine. all of it."'),
_("the needle goes in. a long minute. then the boy's eyes return to him."),
_('he is human again. the last demon that ever was. the first demon ever cured.')
],
notification: _("Kamado Tanjiro is dragged back from the dark."),
buttons: {
'continue': {
text: _('look around at the dawn'),
nextScene: { 1: 'roll_call' }
}
}
},
'roll_call': {
text: [
_('the castle ruins are silent now, but for the wind. the pillars take a count.'),
_('炎柱・煉獄, fallen on the train, long before this morning.'),
_('音柱・宇髓, retired — alive, with three wives and no hand.'),
_('恋柱・甘露寺 and 蛇柱・伊黑 — fallen together. their bodies were not separated.'),
_('风柱・不死川 and 岩柱・悲鸣屿, gravely wounded but alive. they will not see another sunrise like this.'),
_('霞柱・時透, fallen. his last breath spoke a name long forgotten — his brother\'s.'),
_('虫柱・胡蝶, fallen. consumed from within by her own poison. the demoness who ate her is gone with her.'),
_("水柱・富岡, alive. wounded everywhere. he is the only pillar still standing at full height.")
],
notification: _('the price has been paid. count it.'),
buttons: {
'continue': {
text: _('turn toward home'),
nextScene: { 1: 'wisteria_return' }
}
}
},
'wisteria_return': {
text: [
_('Shinobu was not at the castle. she was at the wisteria estate, all along.'),
_('— or rather, what is left of her. Kocho the Insect Pillar was her elder sister.'),
_('she greets you at the gate. her sleeve is dark. her smile is not.'),
_('"come inside. the hearth is lit. there is tea."')
],
notification: _('the wisteria estate stands. its keeper still keeps it.'),
buttons: {
'enter': {
text: _('step inside'),
nextScene: { 1: 'century_passes' }
}
}
},
'century_passes': {
text: [
_('years pass. then more years. you grow old in the keeper\'s house.'),
_('Tanjiro\'s grandchildren visit the wisteria grove. then his great-grandchildren.'),
_('one of them — a small girl with the kamado checked pattern — asks why so many old swords hang on the wall.'),
_('"because once," you tell her, "the world was dark. and the people you do not remember held it back, until dawn."')
],
notification: _('a century passes. the wisteria still blooms.'),
buttons: {
'finish': {
text: _('lay down the blade'),
onChoose: Space.triggerGoodEnd,
nextScene: 'end'
}
}
}
}
});

// 5 柱依次赶到，每柱有自己的招式与触发提示；按 12 秒间隔登场
var pillars = [
{ name: _('炎柱・煉獄杏寿郎'), move: _('炎之呼吸・壹ノ型・不知火') },
{ name: _('水柱・富冈义勇'),   move: _('水之呼吸・拾壹ノ型・凪') },
{ name: _('蛇柱・伊黑小芭内'), move: _('蛇之呼吸・伍ノ型・蜿蜒走り') },
{ name: _('恋柱・甘露寺蜜璃'), move: _('恋之呼吸・陸ノ型・猫足恋風') },
{ name: _('风柱・不死川实弥'), move: _('风之呼吸・伍ノ型・木枯らし颪') }
];
for(var i = 0; i < Space.PILLAR_COUNT; i++) {
(function(idx, p) {
var tid = window.setTimeout(function() {
Space.doPillarAssist(p.name, p.move);
}, Space.PILLAR_INTERVAL * (idx + 1));
Space._pillarTimers.push(tid);
})(i, pillars[i % pillars.length]);
}

// Force dawn after all assists + 5-second buffer
var forceId = window.setTimeout(Space.forceDawn,
Space.PILLAR_INTERVAL * Space.PILLAR_COUNT + 5000);
Space._pillarTimers.push(forceId);
},

doPillarAssist: function(name, move) {
if(Space.done) return;
if(!Events.activeEvent()) return;
if(Events.won) return;

var enemy = $('#enemy');
if(enemy.length === 0) return;

// 柱出场通知：姓名 + 招式 + 攻击效果
if (name) {
try { Notifications.notify(null, name + _(' 赶到！')); } catch(_) {}
}
if (move) {
try { Notifications.notify(null, _('斩出 ') + move + '！'); } catch(_) {}
}

// 治疗玩家到满血并补药品
$SM.add('stores.medicine', 5);
var maxHp = World.getMaxHealth();
World.setHp(maxHp);
var wanderer = $('#wanderer');
wanderer.data('hp', maxHp);
Events.updateFighterDiv(wanderer);
Events.drawFloatText(_('+回复'), $('.hp', wanderer));

// 柱对无惨发起一击
var hp = Math.max(0, enemy.data('hp') - 30);
enemy.data('hp', hp);
Events.updateFighterDiv(enemy);
Events.drawFloatText('-30', $('.hp', enemy));
if(hp <= 0 && !Events.won) {
Events.won = true;
Events.endFight();
// Load the dawn scene manually
$('#fight', Events.eventPanel()).remove();
Events.loadScene('dawn');
}
},

forceDawn: function() {
if(Space.done) return;
if(!Events.activeEvent()) return;
if(Events.won) return;
Space.clearPillarTimers();
Events.clearTimeouts();
Events.fought = true;
Events.won = true;
var panel = Events.eventPanel();
if(panel) {
$('#fight', panel).remove();
$('#description', panel).empty();
$('#buttons', panel).empty();
}
Events.loadScene('dawn');
},

onMuzanFightEnd: function() {
Space.clearPillarTimers();
},

clearPillarTimers: function() {
Space._pillarTimers.forEach(function(tid) { clearTimeout(tid); });
Space._pillarTimers = [];
},

// ---- BAD END ----

triggerBadEnd: function() {
if(Space.done) return;
Space.done = true;

Events.startEvent({
title: _('darkness falls'),
scenes: {
'start': {
text: [
_('without guide crows, the path through the Infinity Castle is lost.'),
_('from above, distant sounds of battle filter down — then silence.'),
_('報告: 炎柱・煉獄杏寿郎... fallen.'),
_('報告: 水柱・富冈义勇... fallen.'),
_('one by one, the Pillars are extinguished. the Demon King cannot be reached.'),
_('not today.')
],
buttons: {
'rewind': {
text: _('return to before'),
notification: _('time rewinds — but your supplies are gone.'),
onChoose: Space.doBadEndRewind,
nextScene: 'end'
},
'accept': {
text: _('accept fate'),
onChoose: Space.doBadEndAccept,
nextScene: 'end'
}
}
}
}
});
},

doBadEndRewind: function() {
$SM.setM('stores', {});
$SM.set('game.spaceShip.crows', 0);
$SM.set('game.spaceShip.seenWarning', false);
$('#crowRow .row_val', Ship.panel).text(0);
Button.setDisabled($('#liftoffButton', Ship.panel), true);
Notifications.notify(null, _('you surface from the castle. your supplies are gone. the path must be forged again.'));
Space.returnToShip();
},

doBadEndAccept: function() {
Engine.event('progress', 'loss');
Space.done = true;
Space._triggerGameOver(true);
},

returnToShip: function() {
$('body').stop().removeClass('noMask').css(
'background-color', Engine.isLightsOff() ? '#272823' : '#FFFFFF');
$('#spacePanel').empty().attr('style', '');
$('#outerSlider').animate({ top: '0px' }, 300, 'linear');
Engine.activeModule = Ship;
Ship.onArrival();
Button.cooldown($('#liftoffButton'));
},

// ---- GOOD END ----

triggerGoodEnd: function() {
Space.done = true;
Space.clearPillarTimers();
Space._triggerGameOver(false);
},

_triggerGameOver: function(isLoss) {
clearTimeout(Engine._saveTimer);
clearTimeout(Events._eventTimeout);
if(typeof Outside !== 'undefined') clearTimeout(Outside._popTimeout);
if(typeof Room !== 'undefined') {
clearTimeout(Room._fireTimer);
clearTimeout(Room._tempTimer);
for(var j in Room.Craftables)  Room.Craftables[j].button = null;
for(var k in Room.TradeGoods)  Room.TradeGoods[k].button = null;
}
clearTimeout(Engine._incomeTimeout);

Engine.GAME_OVER = true;
Score.save();
Prestige.save();

$('#starsContainer').remove();

if(isLoss) {
// Bad-end: simple game-over
$('body').stop().removeClass('noMask').css(
'background-color', Engine.isLightsOff() ? '#272823' : '#FFFFFF');
window.setTimeout(function() {
$('#content, #notifications').remove();
Space._showEndingOptions(_('the Demon King endures. the slayers are lost.'));
}, 1000);
return;
}

// Good-end: cinematic outro
AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_ENDING);
$('#content, #notifications').remove();

var c = $('<div>').addClass('outroContainer').appendTo('body');
window.setTimeout(function() {
$('<div>').addClass('outro')
.html('the Pillars stand in the ruins of the Infinity Castle.<br>battered, bleeding — but alive.')
.appendTo(c).animate({ opacity: 1 }, 500);
}, 500);
window.setTimeout(function() {
$('<div>').addClass('outro')
.html('the sun climbs above the shattered corridors.<br>Muzan\'s blood demon art dissolves with him.')
.appendTo(c).animate({ opacity: 1 }, 500);
}, 5500);
window.setTimeout(function() {
$('<div>').addClass('outro').text('no more demons will be born.')
.appendTo(c).animate({ opacity: 1 }, 500);
}, 10500);
window.setTimeout(function() {
$('<div>').addClass('outro').text('the age of demons is over.')
.appendTo(c).animate({ opacity: 1 }, 500);
}, 14000);
window.setTimeout(function() {
Button.Button({
id: 'end-btn', text: _('greet the dawn'),
click: function(btn) {
btn.addClass('disabled');
c.animate({ opacity: 0 }, 5000, 'linear', function() {
c.remove();
Prestige.save();
Space._showEndingOptions(_('the Demon King is slain. the dawn has come.'));
});
}
}).animate({ opacity: 1 }, 500).appendTo(c);
}, 17000);
},

_showEndingOptions: function(msg) {
$('<center>').addClass('centerCont').appendTo('body');
if(msg) {
$('<span>').addClass('endGame').text(msg)
.appendTo('.centerCont').animate({ opacity: 1 }, 1500);
$('<br />').appendTo('.centerCont');
}
$('<span>').addClass('endGame')
.text(_('score for this game: {0}', Score.calculateScore()))
.appendTo('.centerCont').animate({ opacity: 1 }, 1500);
$('<br />').appendTo('.centerCont');
$('<span>').addClass('endGame')
.text(_('total score: {0}', Prestige.get().score))
.appendTo('.centerCont').animate({ opacity: 1 }, 1500);
$('<br />').appendTo('.centerCont');
$('<br />').appendTo('.centerCont');
$('<span>').addClass('endGame endGameOption').text(_('restart.'))
.click(Engine.confirmDelete)
.appendTo('.centerCont').animate({ opacity: 1 }, 1500);
},

// ---- UTIL ----

handleStateUpdates: function(e) {}
};
