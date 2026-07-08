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

	MAX_FLOOR: 100,
	BOSS_FLOORS: [10, 20, 30, 40, 50, 60, 70, 80, 90],
	MUZAN_FLOOR: 100,

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
		Space._potionEffect = null;

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

		// 元进程：授予历次最高等级的起始技能
		try { Space._grantStartingTalents(); } catch (e) { /* ignore */ }

		// 生成节点数据
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
			else if(f < 40)   { t = _("Bleeding Halls");           chapterKey = 'bleedhalls'; }
			else if(f < 50)   { t = _("The Abyss");                chapterKey = 'abyss'; }
			else if(f < 60)   { t = _("Fields of the Dead");       chapterKey = 'fields'; }
			else if(f < 70)   { t = _("Coiled Depths");            chapterKey = 'coiled'; }
			else if(f < 80)   { t = _("The Blood Sea");            chapterKey = 'bloodsea'; }
			else if(f < 90)   { t = _("Muzan's Antechamber");      chapterKey = 'antechamber'; }
			else if(f < 100)  { t = _("Approach to the Throne");   chapterKey = 'approach'; }
			else              { t = _("Muzan's Throne");           chapterKey = 'throne'; }
			document.title = t;

			if (Space._lastChapter && Space._lastChapter !== chapterKey) {
				var transitions = {
					'corridors':   _('the corridors twist into a maze. there is no way back.'),
					'labyrinth':   _('the walls bleed shadow. you are deep below the world now.'),
					'bleedhalls':  _('the halls weep. every step leaves a red print.'),
					'abyss':       _('the air grows thick with blood. the demons here are no mere foot soldiers.'),
					'fields':      _('dead slayers and dead demons alike carpet the floor. the corps has been here.'),
					'coiled':      _('the walls curl inward like a serpent. down is not down anymore.'),
					'bloodsea':    _('you wade through blood. the demons swim in it.'),
					'antechamber': _('a low hum. Muzan is close now.'),
					'approach':    _('all the demons pull toward one point. the throne.'),
					'throne':      _("Muzan's throne hall yawns open. the final descent.")
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
			battle:   0.24,
			elite:    0.14,
			shop:     0.14,
			rest:     0.18,
			treasure: 0.15,
			ambush:   0.08, // 围剿：3~5 只鬼连打 + 补给
			shrine:   0.04, // 太阳咒纹祭坛：小概率永久 buff
			hashira:  0.03  // 柱之邂逅：免费天赋
		};
		if (floor < 5)  { weights.elite = 0.05; weights.ambush = 0; weights.hashira = 0.06; }
		if (floor > 25) { weights.elite = 0.22; weights.ambush = 0.12; weights.rest = 0.12; }
		var typeOrder = ['battle', 'elite', 'shop', 'rest', 'treasure', 'ambush', 'shrine', 'hashira'];
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

	// 击杀里程碑（对应成就）：显示最近未达成的一个
	KILL_MILESTONES: [
		{ target: 1,    titleKey: 'opening strike' },
		{ target: 50,   titleKey: 'rising slayer' },
		{ target: 100,  titleKey: 'hundred-fold edge' },
		{ target: 200,  titleKey: 'seasoned slayer' },
		{ target: 500,  titleKey: 'five-hundred breaths' },
		{ target: 1000, titleKey: 'thousand graves' }
	],
	_nearestKillMilestone: function(kills) {
		for (var i = 0; i < Space.KILL_MILESTONES.length; i++) {
			if (kills < Space.KILL_MILESTONES[i].target) return Space.KILL_MILESTONES[i];
		}
		return Space.KILL_MILESTONES[Space.KILL_MILESTONES.length - 1];
	},

	/**
	 * 渲染当前层 UI：HP 状态 + 行动菜单 + 节点选择按钮
	 */
	showFloor: function() {
		var panel = Space.panel;
		panel.empty();
		Space.floorEntered = false;
		Space.setTitle();

		// 顶部：随身背包展示（与地图一致，展示 Path.outfit）
		Space._renderCarry(panel);

		// 顶部状态
		var hdr = $('<div>').attr('id', 'floorHeader').appendTo(panel);
		$('<div>').addClass('floorTitle')
			.text(_('Floor {0} / {1}', Space.currentFloor, Space.MAX_FLOOR))
			.appendTo(hdr);
		// 随时离开无限城
		$('<div>').addClass('floorExitBtn').text(_('leave the castle'))
			.click(Space.exitCastle).appendTo(hdr);
		var statusBar = $('<div>').addClass('floorStatus').appendTo(hdr);
		$('<span>').addClass('floorHp')
			.text(_('hp: {0}/{1}', World.health, World.getMaxHealth()))
			.appendTo(statusBar);
		// 最近的击杀成就进度（如 崭露锋芒 25/50 只鬼）
		var _kills = $SM.get('previous.legacy.kills', true) || 0;
		var _ms = Space._nearestKillMilestone(_kills);
		if (_ms) {
			$('<span>').addClass('floorAchieve')
				.text('  ' + _(_ms.titleKey) + '  ' + Math.min(_kills, _ms.target) + '/' + _ms.target + ' ' + _('demons'))
				.appendTo(statusBar);
		}
		// 本次 run 的天赋等级列表
		var _talents = Space.TALENTS.filter(function(t) { return Space.getTalentLevel(t.id) > 0; });
		if (_talents.length) {
			var talBar = $('<div>').addClass('floorTalents').appendTo(hdr);
			$('<span>').addClass('talentLabel').text(_('talents:') + ' ').appendTo(talBar);
			_talents.forEach(function(t) {
				$('<span>').addClass('talentChip').text(_(t.nameKey) + ' Lv.' + Space.getTalentLevel(t.id)).appendTo(talBar);
			});
		}
		// 元进程状态提示：治疗加成 + 探索者赐福
		var _mHealMult = Space.getHealMult();
		var _mExplorer = Space.hasExplorerBoon();
		if (_mHealMult > 1 || _mExplorer) {
			var metaBar = $('<div>').addClass('floorMeta').appendTo(hdr);
			$('<span>').addClass('talentLabel').text(_('legacy:') + ' ').appendTo(metaBar);
			if (_mHealMult > 1) $('<span>').addClass('metaChip').text(_('heal +{0}%', Math.round((_mHealMult - 1) * 100))).appendTo(metaBar);
			if (_mExplorer)     $('<span>').addClass('metaChip').text(_('explorer +5% hp')).appendTo(metaBar);
		}

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

	// 顶部背包展示条：与地图一致，显示当前随身携带（Path.outfit）
	_renderCarry: function(panel) {
		var bar = $('<div>').attr('id', 'castleCarry').appendTo(panel);
		$('<div>').addClass('carryTitle').text(_('carried:')).appendTo(bar);
		var list = $('<div>').addClass('carryList').appendTo(bar);
		var outfit = Path.outfit || {};
		var keys = Object.keys(outfit).sort();
		var any = false;
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if ((outfit[k] || 0) > 0) {
				any = true;
				$('<div>').addClass('supplyItem').text(_(k) + '：' + outfit[k]).appendTo(list);
			}
		}
		if (!any) $('<div>').addClass('supplyItem empty').text(_('backpack empty')).appendTo(list);
	},

	// 随时离开无限城：确认后带着剩余背包返回地表
	exitCastle: function() {
		if (Space.done) return;
		Events.startEvent({
			title: _('leave the Infinity Castle?'),
			scenes: {
				'start': {
					text: [ _('you turn back toward the surface, keeping whatever remains in your pack.') ],
					buttons: {
						'leave': {
							text: _('leave'),
							onChoose: function() {
								Space.done = true;
								Space.clearPillarTimers();
								Space.returnToShip();
							},
							nextScene: 'end'
						},
						'stay': {
							text: _('stay'),
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	_addActionBtn: function(parent, item, label) {
		var have = (Path.outfit && Path.outfit[item]) || 0;
		var btn = $('<div>').addClass('floorActionBtn menuBtn').text(label + '  \u00d7' + have);
		if (have <= 0) btn.addClass('disabled');
		btn.click(function() {
			if (btn.hasClass('disabled')) return;
			var heal = 0;
			if (item === 'cured meat') heal = World.MEAT_HEAL || 8;
			else if (item === 'medicine') heal = World.MEDS_HEAL || 20;
			else if (item === 'wisteria oil') heal = 30;
			Path.outfit[item] = (Path.outfit[item] || 0) - 1;
			$SM.set('outfit["' + item + '"]', Path.outfit[item]);
			World.setHp(Math.min(World.getMaxHealth(), World.health + heal));
			Space.showFloor(); // 刷新 UI（含 HP/背包）
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
			case 'ambush':   return _('demon ambush') + '<br><small>' + _('several demons at once, supply drop after') + '</small>';
			case 'shrine':   return _('sun-marked shrine') + '<br><small>' + _('offer to receive a lasting boon') + '</small>';
			case 'hashira':  return _('a hashira waits') + '<br><small>' + _('free training') + '</small>';
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
			case 'shop':     Space._initShopStock(); Space.triggerShop();        break;
			case 'rest':     Space.triggerRest();        break;
			case 'treasure': Space.triggerTreasure();    break;
			case 'ambush':   Space.triggerAmbush();      break;
			case 'shrine':   Space.triggerShrine();      break;
			case 'hashira':  Space.triggerHashiraEncounter(); break;
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

	// 玩家未拾取的战斗掉落，由后援队伍直接收进紫藤屋仓库（stores）
	_collectRemainingLoot: function() {
		var rows = $('#lootButtons .lootRow');
		if (!rows.length) return;
		var collected = [];
		rows.each(function() {
			var name = $(this).data('item');
			var take = $(this).children('.lootTake').first();
			var numLeft = take.data('numLeft') || 0;
			if (name && numLeft > 0) {
				$SM.add('stores["' + name + '"]', numLeft);
				collected.push(_(name) + '+' + numLeft);
			}
		});
		if (collected.length) {
			Notifications.notify(null, _('the support corps sends the rest back to the wisteria estate: {0}', collected.join(', ')));
		}
	},

	// 战斗结束推进：先把未拾取掉落送回仓库，再触发天赋选择（或直接进入下一层）
	// 延后一帧：让按钮的 nextScene:'end' 先把战斗事件淡出关闭，再打开天赋事件，避免被 endEvent 立即关掉
	afterBattle: function() {
		Space._collectRemainingLoot();
		setTimeout(function() { Space._offerTalent(); }, 400);
	},

	// ---- 天赋系统：胜利后 3 选 1，可加已有天赋等级或选新天赋。仅本次 run 有效（returnToShip 清除）----
	TALENTS: [
		{ id: 'hardBody',   nameKey: 'hardened body',   maxLevel: 20, per: 5,    descKey: '+{0} max hp per level' },
		{ id: 'sharpEdge',  nameKey: 'sharpened edge',  maxLevel: 20, per: 0.02, descKey: '+{0}% weapon damage per level' },
		{ id: 'ironWall',   nameKey: 'iron wall',       maxLevel: 20, per: 0.01, descKey: '+{0}% damage reduction per level (cap 30%)' },
		{ id: 'bloodDrink', nameKey: 'blood drinker',   maxLevel: 20, per: 0.01, descKey: '+{0}% lifesteal per level (needs water breath)' },
		{ id: 'steadyHand', nameKey: 'steady hand',     maxLevel: 20, per: 0.01, descKey: '+{0}% hit chance per level' },
		{ id: 'swiftBlade', nameKey: 'swift blade',     maxLevel: 20, per: 0.01, descKey: '-{0}% weapon cooldown per level (cap 50%)' }
	],
	getTalentLevel: function(id) { return $SM.get('character.infinityTalents["' + id + '"]', true) || 0; },
	setTalentLevel: function(id, lvl) {
		$SM.set('character.infinityTalents["' + id + '"]', lvl, true);
		// 记录跨 run 最高等级（元进程），用于下次入城起始等级授予
		var meta = $SM.get('game.castleMeta.peakTalent') || {};
		if ((meta[id] || 0) < lvl) { meta[id] = lvl; $SM.set('game.castleMeta.peakTalent', meta, true); }
	},
	clearTalents: function() { $SM.set('character.infinityTalents', {}, true); },
	// ---- 元进程（跨 run 永久累积） ----
	getMetaHealed: function() { return $SM.get('game.castleMeta.totalHealed', true) || 0; },
	addMetaHealed: function(amt) {
		var cur = Space.getMetaHealed();
		$SM.set('game.castleMeta.totalHealed', cur + amt, true);
	},
	// 治疗加成（元进程累计回复解锁）：>=500 +5%, >=1000 +10%, >=2000 +15%, >=5000 +20%
	getHealMult: function() {
		var t = Space.getMetaHealed();
		if (t >= 5000) return 1.20;
		if (t >= 2000) return 1.15;
		if (t >= 1000) return 1.10;
		if (t >= 500)  return 1.05;
		return 1;
	},
	// 起始技能授予：peak 5→+1, 10→+2, 15→+3, 20→+5
	_grantStartingTalents: function() {
		var meta = $SM.get('game.castleMeta.peakTalent') || {};
		Space.TALENTS.forEach(function(t) {
			var peak = meta[t.id] || 0;
			var grant = 0;
			if (peak >= 20) grant = 5;
			else if (peak >= 15) grant = 3;
			else if (peak >= 10) grant = 2;
			else if (peak >= 5)  grant = 1;
			if (grant > 0) {
				$SM.set('character.infinityTalents["' + t.id + '"]', Math.min(t.maxLevel, grant), true);
			}
		});
	},
	// 探索者赐福：所有地标类型探索过 → 入城 +5% max HP
	hasExplorerBoon: function() {
		return !!$SM.get('game.castleMeta.perfectExploration', true);
	},
	// Boss 击杀元进程计数（用于成就与豪华掉落上调）
	incMetaBossKilled: function() {
		var n = $SM.get('game.castleMeta.bossKilled', true) || 0;
		$SM.set('game.castleMeta.bossKilled', n + 1, true);
	},
	getMaxHpBonus: function() {
		var bonus = Space.getTalentLevel('hardBody') * 5;
		if (Space.hasExplorerBoon()) bonus += Math.floor(85 * 0.05);
		return bonus;
	},
	getDamageMult: function() { return 1 + Space.getTalentLevel('sharpEdge') * 0.02; },
	getDamageReduction: function() { return Math.min(0.30, Space.getTalentLevel('ironWall') * 0.01); },
	getLifestealPct: function() {
		var base = Space.getTalentLevel('bloodDrink') * 0.01;
		// 呼吸法加成：水/炎/雷各 +5%，累计
		var perkBonus = 0;
		try {
			if ($SM.hasPerk('water breath I')) perkBonus += 0.05;
			if ($SM.hasPerk('flame breath I')) perkBonus += 0.05;
			if ($SM.hasPerk('thunder breath I')) perkBonus += 0.05;
		} catch (e) { /* ignore */ }
		return Math.min(0.25, base + perkBonus);
	},
	getAccuracyBonus: function() { return Space.getTalentLevel('steadyHand') * 0.01; },

	_offerTalent: function() {
		// 从池中随机抽 3 项供选择（含已达上限的不选）
		var pool = Space.TALENTS.filter(function(t) { return Space.getTalentLevel(t.id) < t.maxLevel; });
		if (pool.length === 0) { Space.afterNode(); return; }
		// 打乱后取前 3
		pool.sort(function() { return Math.random() - 0.5; });
		var picks = pool.slice(0, Math.min(3, pool.length));

		var buttons = {};
		picks.forEach(function(t, i) {
			var curLvl = Space.getTalentLevel(t.id);
			var displayPer = (t.per < 1) ? Math.round(t.per * 100) : t.per;
			var label = _(t.nameKey) + ' Lv.' + (curLvl + 1) + '/' + t.maxLevel;
			buttons['talent_' + i] = {
				text: label,
				onChoose: (function(tid) { return function() { Space._takeTalent(tid); }; })(t.id),
				nextScene: 'end'
			};
		});
		buttons['skip'] = {
			text: _('skip'),
			onChoose: function() { Space.afterNode(); },
			nextScene: 'end'
		};

		var text = [_('the demon fades. faint red motes drift toward you \u2014 pick one to absorb.')];
		picks.forEach(function(t) {
			var curLvl = Space.getTalentLevel(t.id);
			var val = (t.per < 1) ? Math.round(t.per * 100) : t.per;
			text.push('\u2022 ' + _(t.nameKey) + ' Lv.' + (curLvl + 1) + ': ' + _(t.descKey, val));
		});
		Events.startEvent({
			title: _('slayer talent'),
			scenes: {
				'start': {
					text: text,
					buttons: buttons
				}
			}
		});
	},

	_takeTalent: function(id) {
		var curLvl = Space.getTalentLevel(id);
		Space.setTalentLevel(id, curLvl + 1);
		var t = Space.TALENTS.find(function(x) { return x.id === id; });
		Notifications.notify(null, _('you take up {0} (now Lv.{1})', _(t.nameKey), curLvl + 1));
		Space.afterNode();
	},

	// ---- 节点：战斗 ----

	_pickEnemy: function(floor, isElite) {
		// 大幅提升：初层 200 HP、+30/层；伤害 8+2/层；命中 0.85→上限 0.95；
		// 攻击频率翻倍（delay 减半）：基础 1.0s，下限 0.5s
		var hp = Math.floor(200 + floor * 30);
		var dmg = Math.floor(8 + floor * 2);
		var hit = 0.85 + Math.min(0.10, floor * 0.003);
		var delay = Math.max(0.5, 1.0 - floor * 0.01);

		var enemyNames = [
			'forest demon', 'claw demon', 'blood mist demon',
			'twin demon', 'centipede demon', 'man-eater',
			'spider demon', 'water demon', 'thread demon',
			'frenzied demon', 'lower moon shadow'
		];
		var enemy = enemyNames[Math.min(enemyNames.length - 1, Math.floor(floor / 4))];

		if (isElite) {
			hp = Math.floor(hp * 1.8);
			dmg = Math.floor(dmg * 1.5);
			enemy = 'elite ' + enemy;
		}
		return { enemy: enemy, hp: hp, dmg: dmg, hit: hit, delay: delay, isElite: !!isElite };
	},

	// ---- 药水系统：购买/开箱时立即饮下，只影响下一场战斗 ----
	// 实现方式：不改动战斗内核，而是在构建下一场战斗时调整敌人 HP/伤害（或回满血）。
	POTIONS: [
		{ id:'might',   nameKey:'potion of might',   descKey:'next fight: your strikes cut far deeper',      effect:{ enemyHpMult:0.6 },                  kind:'boon' },
		{ id:'iron',    nameKey:'potion of iron',    descKey:'next fight: you take much less damage',        effect:{ enemyDmgMult:0.5 },                 kind:'boon' },
		{ id:'vigor',   nameKey:'potion of vigor',   descKey:'next fight: you begin at full health',         effect:{ healFull:true },                    kind:'boon' },
		{ id:'berserk', nameKey:'berserker brew',    descKey:'next fight: deal much more, but take more',    effect:{ enemyHpMult:0.5, enemyDmgMult:1.4 }, kind:'mixed' },
		{ id:'turtle',  nameKey:'turtle draught',    descKey:'next fight: take far less, but deal less',     effect:{ enemyDmgMult:0.4, enemyHpMult:1.5 }, kind:'mixed' },
		{ id:'tainted', nameKey:'tainted vial',      descKey:'next fight: the demon\u2019s blows cut deeper', effect:{ enemyDmgMult:1.6 },                 kind:'curse' },
		{ id:'frailty', nameKey:'vial of frailty',   descKey:'next fight: your blows land softer',           effect:{ enemyHpMult:1.6 },                  kind:'curse' }
	],
	_potionEffect: null,

	_randomPotion: function() {
		return Space.POTIONS[Math.floor(Math.random() * Space.POTIONS.length)];
	},

	_drinkPotion: function(potion) {
		if (!potion) return;
		Space._potionEffect = potion.effect;
		var tag = potion.kind === 'curse' ? _('(curse)') : (potion.kind === 'mixed' ? _('(mixed)') : _('(boon)'));
		Notifications.notify(null, _('you gulp down {0} {1} \u2014 {2}', _(potion.nameKey), tag, _(potion.descKey)));
	},

	// 构建下一场战斗时应用药水效果（改敌人 hp/dmg 或回满血），用后即清（只一场）
	_applyPotion: function(e) {
		var pot = Space._potionEffect;
		if (!pot) return e;
		if (pot.enemyHpMult)  e.hp  = Math.max(1, Math.floor(e.hp  * pot.enemyHpMult));
		if (pot.enemyDmgMult) e.dmg = Math.max(1, Math.floor(e.dmg * pot.enemyDmgMult));
		if (pot.healFull) World.setHp(World.getMaxHealth());
		Space._potionEffect = null;
		return e;
	},

	// 血鬼术库：供精英/Boss/无惨使用。每项返回一个适配 Events.startEvent 的描述或效果。
	BLOOD_ARTS: {
		bleed: function(dmg) { return {
			interval: 12,
			telegraphSec: 1.5,
			telegraph: _('the demon paints a crimson sigil in the air — blood tendrils spring toward you'),
			interruptedText: _('the sigil scatters.'),
			dmg: Math.max(1, Math.floor(dmg * 0.6)),
			hit: 0.95,
			ranged: true,
			bleedSec: 10,
			bleedPerSec: 2
		}; },
		charged: function(dmg) { return {
			interval: 15,
			telegraphSec: 5,
			telegraph: _('the demon crouches, gathering blood art — a devastating strike is coming'),
			interruptedText: _('the technique fizzles.'),
			dmg: Math.floor(dmg * 2.0),
			hit: 1.0,
			shieldBreaker: true
		}; },
		frenzy: function(dmg) { return {
			interval: 9,
			telegraphSec: 1.0,
			telegraph: _('the demon becomes a red blur — rapid slashes'),
			interruptedText: _('the blur breaks apart.'),
			dmg: Math.max(1, Math.floor(dmg * 0.5)),
			hit: 0.9
		}; },
		mist: function(dmg) { return {
			interval: 18,
			telegraphSec: 2,
			telegraph: _('a blood-red mist rolls out from the demon — hard to breathe'),
			interruptedText: _('the mist thins.'),
			dmg: Math.max(1, Math.floor(dmg * 0.4)),
			hit: 1.0,
			ranged: true
		}; }
	},
	_pickBloodArts: function(count, dmg) {
		var keys = Object.keys(Space.BLOOD_ARTS);
		var out = [];
		for (var i = 0; i < count && keys.length; i++) {
			var idx = Math.floor(Math.random() * keys.length);
			out.push(Space.BLOOD_ARTS[keys[idx]](dmg));
			keys.splice(idx, 1);
		}
		return out;
	},

	triggerBattle: function(isElite) {
		var e = Space._pickEnemy(Space.currentFloor, isElite);
		e = Space._applyPotion(e);
		var titleText = isElite ? _(e.enemy) + ' ' + _('(elite)') : _(e.enemy);
		var scene = {
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
					onChoose: Space.afterBattle,
					nextScene: 'end'
				}
			}
		};
		// 精英附带 1 项血鬼术（弹药不够时更易重伤）
		if (isElite) scene.telegraphAttacks = Space._pickBloodArts(1, e.dmg);
		Events.startEvent({ title: titleText, scenes: { 'start': scene } });
	},

	// ---- 节点：精英楼层 Boss（每 10 层）----

	_bossDef: function(floor) {
		// 楼层 boss 数据：HP 大幅提升，高伤高命中快攻击（每 10 层一个）
		if (floor === 10) return { enemy: 'lower moon six',              hp: 1200,  dmg: 18,  hit: 0.85, delay: 0.9 };
		if (floor === 20) return { enemy: 'lower moon three',            hp: 2400,  dmg: 28,  hit: 0.88, delay: 0.8 };
		if (floor === 30) return { enemy: 'upper moon four (the dome)',  hp: 4500,  dmg: 42,  hit: 0.90, delay: 0.7 };
		if (floor === 40) return { enemy: 'upper moon five (the trickster)',  hp: 7000,  dmg: 55,  hit: 0.90, delay: 0.65 };
		if (floor === 50) return { enemy: 'upper moon four (the puppeteer)', hp: 10000, dmg: 70,  hit: 0.90, delay: 0.6 };
		if (floor === 60) return { enemy: 'upper moon three (the spearman)', hp: 14000, dmg: 85,  hit: 0.92, delay: 0.6 };
		if (floor === 70) return { enemy: 'upper moon two (the wisteria one)', hp: 20000, dmg: 100, hit: 0.92, delay: 0.55 };
		if (floor === 80) return { enemy: 'upper moon one (the sorrowful)',   hp: 28000, dmg: 120, hit: 0.94, delay: 0.55 };
		if (floor === 90) return { enemy: 'kokushibou reborn',                hp: 40000, dmg: 150, hit: 0.95, delay: 0.5 };
		return null;
	},

	// 分层掉落：楼层越深，材料越高级；BOSS 概率掉归阵符
	_battleLoot: function(floor, isElite) {
		var t = Math.floor(floor / 10); // 0..9 tier
		var loot = {
			'meat':      { min: 2 + t, max: 5 + t*2, chance: 0.9 },
			'cured meat':{ min: 1 + Math.floor(t/2), max: 2 + t, chance: 0.55 },
			'teeth':     { min: 1 + t, max: 4 + t*2, chance: 0.7 }
		};
		if (t >= 1) loot['iron']    = { min: 1, max: 3 + t, chance: 0.55 };
		if (t >= 2) loot['steel']   = { min: 1, max: 2 + t, chance: 0.45 };
		if (t >= 3) loot['sulphur'] = { min: 1, max: 2 + t, chance: 0.40 };
		if (t >= 4) loot['leather'] = { min: 1, max: 3 + t, chance: 0.40 };
		if (t >= 5) loot['solar crystal']  = { min: 1, max: 2 + Math.floor(t/2), chance: 0.35 };
		if (t >= 6) loot['wisteria charm'] = { min: 1, max: 2, chance: 0.30 };
		if (t >= 7) loot['medicine'] = { min: 1, max: 3, chance: 0.55 };
		if (t >= 8) loot['wisteria oil'] = { min: 1, max: 2, chance: 0.30 };
		if (t >= 9) loot['demon stone'] = { min: 1, max: 1, chance: 0.25 };
		if (isElite) {
			loot['medicine'] = { min: 2, max: 4, chance: 0.85 };
			loot['demon stone'] = { min: 1, max: 1, chance: 0.35 };
		}
		return loot;
	},

	// BOSS 专属豪华掉落：按 floor 递升，末层 90 有较高归阵符几率
	_bossLoot: function(floor) {
		var t = Math.floor(floor / 10);
		var loot = {
			'demon stone':    { min: 1 + Math.floor(t/2), max: 2 + Math.floor(t/2), chance: 1.0 },
			'medicine':       { min: 3, max: 5 + t, chance: 1.0 },
			'solar crystal':  { min: 2, max: 3 + t, chance: 0.85 },
			'wisteria charm': { min: 1, max: 3, chance: 0.70 },
			'wisteria oil':   { min: 1, max: 2, chance: 0.60 }
		};
		// 从 30 层 boss 开始有归阵符几率，越深越高
		if (t >= 3) loot['fleet beacon'] = { min: 1, max: 1, chance: Math.min(0.65, 0.10 + t * 0.06) };
		return loot;
	},

	triggerBossFight: function() {
		var b = Space._bossDef(Space.currentFloor);
		if (!b) { Space.afterNode(); return; }
		b = Space._applyPotion(b);
		var loot = Space._bossLoot(Space.currentFloor);
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
					telegraphAttacks: Space._pickBloodArts(3, b.dmg),
					buttons: {
						'continue': {
							text: _('continue down'),
							cooldown: Events._LEAVE_COOLDOWN,
							onChoose: Space.afterBattle,
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
			oilScales:      Math.ceil(40 * s)
		};
	},

	// 商店购买：花费的是家里库存（紫藤屋后援），买到的物品进入当前背包（Path.outfit）
	_buyToBackpack: function(item) {
		if (!Path.outfit) Path.outfit = {};
		Path.outfit[item] = (Path.outfit[item] || 0) + 1;
		$SM.set('outfit["' + item + '"]', Path.outfit[item]);
		Notifications.notify(null, _('bought {0}.', _(item)));
	},

	// 每次进店随机生成各商品的限购数量（3~10）；并有几率进货一瓶神秘药水
	_initShopStock: function() {
		var rand = function() { return 3 + Math.floor(Math.random() * 8); };
		Space._shopStock = { 'medicine': rand(), 'wisteria oil': rand(), 'potion': (Math.random() < 0.7 ? 1 : 0) };
	},

	// 神秘药水：赌博式——买下即随机饮下一瓶（可能增益/权衡/诅咒）
	_tryBuyPotion: function(mat, cost) {
		if (!Space._shopStock || (Space._shopStock.potion || 0) <= 0) {
			Notifications.notify(null, _('the potion shelf is bare.'));
			return;
		}
		if (!Engine.options.testerMode && ($SM.get('stores["' + mat + '"]', true) || 0) < cost) {
			Notifications.notify(null, _('not enough {0}.', _(mat)));
			return;
		}
		if (!Engine.options.testerMode) $SM.add('stores["' + mat + '"]', -cost);
		Space._shopStock.potion = (Space._shopStock.potion || 1) - 1;
		Space._drinkPotion(Space._randomPotion());
	},

	// 商店购买：检查限购与家里材料 → 扣家里材料 → 进背包 → 反馈（+1/共N/剩M）
	_tryBuy: function(item, mat, cost) {
		if (!Space._shopStock) Space._shopStock = {};
		var stock = Space._shopStock[item];
		if (typeof stock !== 'number') stock = 99;
		if (stock <= 0) {
			Notifications.notify(null, _('{0} is sold out.', _(item)));
			return;
		}
		if (!Engine.options.testerMode && ($SM.get('stores["' + mat + '"]', true) || 0) < cost) {
			Notifications.notify(null, _('not enough {0}.', _(mat)));
			return;
		}
		if (!Engine.options.testerMode) $SM.add('stores["' + mat + '"]', -cost);
		Space._shopStock[item] = stock - 1;
		if (!Path.outfit) Path.outfit = {};
		Path.outfit[item] = (Path.outfit[item] || 0) + 1;
		$SM.set('outfit["' + item + '"]', Path.outfit[item]);
		Notifications.notify(null, _('bought {0} (+1, now {1}); {2} left in stock.', _(item), Path.outfit[item], Space._shopStock[item]));
	},

	triggerShop: function() {
		var p = Space._shopPrices(Space.currentFloor);
		var potionTeeth = 25;
		var buttons = {
			'buyMed': {
				text: _('buy medicine ({0} wood)', p.medicineWood),
				onChoose: function() { Space._tryBuy('medicine', 'wood', p.medicineWood); },
				nextScene: { 1: 'start' }
			},
			'buyOil': {
				text: _('buy wisteria oil ({0} scales)', p.oilScales),
				onChoose: function() { Space._tryBuy('wisteria oil', 'scales', p.oilScales); },
				nextScene: { 1: 'start' }
			}
		};
		// 有货时提供神秘药水（赌博）
		if (Space._shopStock && (Space._shopStock.potion || 0) > 0) {
			buttons['buyPotion'] = {
				text: _('buy mystery potion ({0} teeth)', potionTeeth),
				onChoose: function() { Space._tryBuyPotion('teeth', potionTeeth); },
				nextScene: { 1: 'start' }
			};
		}
		buttons['leave'] = {
			text: _('leave shop'),
			onChoose: Space.afterNode,
			nextScene: 'end'
		};
		Events.startEvent({
			title: _('shadow merchant'),
			scenes: {
				'start': {
					text: [
						_('a hooded figure sits on a crate of unmarked goods.'),
						_('"wood or scales \u2014 and i will keep your wounds closed on the way down."')
					],
					buttons: buttons
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
		var potion = (Math.random() < 0.35) ? Space._randomPotion() : null;
		var lootMsg = [];
		for (var k in loot) lootMsg.push(_(k) + ' +' + loot[k]);
		var text = [
			_('something glints in a crack of the wall \u2014 a small cache, left by someone long gone.'),
			_('inside: ') + lootMsg.join(', ') + '.'
		];
		if (potion) text.push(_('a small vial rolls out. you uncork it and drink it down.'));
		Events.startEvent({
			title: _('a hidden cache'),
			scenes: {
				'start': {
					text: text,
					onLoad: function() { $SM.addM('stores', loot); if (potion) Space._drinkPotion(potion); },
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

	// ---- 节点：围剿（3~5 只鬼连打，胜利后由后援队伍送来治疗和消耗品） ----
	// 记录出发时背包，胜利时按消耗的 50% 补回（药/弹/紫藤精油/熏肉）
	triggerAmbush: function() {
		var count = 3 + Math.floor(Math.random() * 3);
		Space._ambushRemaining = count;
		Space._ambushSnapshot = JSON.parse(JSON.stringify(Path.outfit || {}));
		Notifications.notify(null, _('demons circle you from every side \u2014 {0} of them.', count));
		Space._ambushNext();
	},

	_ambushNext: function() {
		if (Space._ambushRemaining <= 0) { Space._ambushEnd(); return; }
		Space._ambushRemaining--;
		// 直接触发一场战斗，胜利后走 _ambushAfter 而非 afterBattle
		var e = Space._pickEnemy(Space.currentFloor, Math.random() < 0.25);
		e = Space._applyPotion(e);
		var scene = {
			combat: true,
			enemy: e.enemy,
			enemyName: _(e.enemy),
			chara: '\u9b3c',
			damage: e.dmg,
			hit: e.hit,
			attackDelay: e.delay,
			health: e.hp,
			notification: _('another demon leaps from the shadows \u2014 {0} more after this', Space._ambushRemaining),
			deathMessage: _('this demon falls. the swarm presses closer.'),
			loot: Space._battleLoot(Space.currentFloor, false),
			buttons: {
				'next': {
					text: (Space._ambushRemaining > 0) ? _('brace for the next') : _('finish the ambush'),
					cooldown: Events._LEAVE_COOLDOWN,
					onChoose: function() {
						Space._collectRemainingLoot();
						// 延后打开下一场事件，让本场先淡出关闭
						setTimeout(function() {
							if (Space._ambushRemaining > 0) Space._ambushNext();
							else Space._ambushEnd();
						}, 400);
					},
					nextScene: 'end'
				}
			}
		};
		if (e.isElite) scene.telegraphAttacks = Space._pickBloodArts(1, e.dmg);
		Events.startEvent({ title: _('demon ambush') + ' \u2014 ' + (Space._ambushRemaining + 1) + '/?', scenes: { 'start': scene } });
	},

	_ambushEnd: function() {
		// 按消耗的 50% 补回（药 / 藤花精油 / 熏肉 / 太阳结晶 / 藤花弹）
		var refills = {};
		var tracked = ['medicine', 'wisteria oil', 'cured meat', 'solar crystal', 'wisteria bullet'];
		tracked.forEach(function(k) {
			var before = Space._ambushSnapshot[k] || 0;
			var now = (Path.outfit && Path.outfit[k]) || 0;
			var used = before - now;
			if (used > 0) refills[k] = Math.ceil(used * 0.5);
		});
		var msg = [];
		for (var k in refills) {
			Path.outfit[k] = (Path.outfit[k] || 0) + refills[k];
			$SM.set('outfit["' + k + '"]', Path.outfit[k]);
			msg.push(_(k) + '+' + refills[k]);
		}
		Events.startEvent({
			title: _('the swarm breaks'),
			scenes: {
				'start': {
					text: [
						_('the last demon falls. you hear boots on stone \u2014 the support corps has caught up.'),
						msg.length ? (_('they resupply what you spent: ') + msg.join(', ') + '.') : _('you spent nothing. they salute and go.')
					],
					buttons: {
						'continue': {
							text: _('continue down'),
							onChoose: Space.afterBattle,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：太阳咒纹祭坛（献 HP 换永久 buff：随机加一层已有天赋等级或直接补药水） ----
	triggerShrine: function() {
		var costHp = Math.min(Math.floor(World.getMaxHealth() * 0.3), World.health - 5);
		var canOffer = costHp > 0;
		Events.startEvent({
			title: _('sun-marked shrine'),
			scenes: {
				'start': {
					text: [
						_('a small stone shrine, cut with sun-mark carvings. blood pools at its base.'),
						_('offer your blood and receive a lasting mark.')
					],
					buttons: {
						'offer': {
							text: _('offer {0} hp', costHp),
							onChoose: function() {
								if (!canOffer) return;
								World.setHp(Math.max(1, World.health - costHp));
								// 随机加一层天赋（若已有则升一级）
								var eligible = Space.TALENTS.filter(function(t) { return Space.getTalentLevel(t.id) < t.maxLevel; });
								if (eligible.length) {
									var pick = eligible[Math.floor(Math.random() * eligible.length)];
									Space.setTalentLevel(pick.id, Space.getTalentLevel(pick.id) + 1);
									Notifications.notify(null, _('the mark burns into your arm: {0} Lv.{1}', _(pick.nameKey), Space.getTalentLevel(pick.id)));
								}
								Space.afterNode();
							},
							nextScene: 'end'
						},
						'leave': {
							text: _('leave the shrine'),
							onChoose: Space.afterNode,
							nextScene: 'end'
						}
					}
				}
			}
		});
	},

	// ---- 节点：柱之邂逅（免费训练一次，直接抬升一项天赋） ----
	triggerHashiraEncounter: function() {
		var pillars = [
			{ nameKey: 'Water Hashira \u2014 Tomioka', talent: 'sharpEdge' },
			{ nameKey: 'Insect Hashira \u2014 Shinobu', talent: 'steadyHand' },
			{ nameKey: 'Flame Hashira \u2014 Rengoku', talent: 'hardBody' },
			{ nameKey: 'Sound Hashira \u2014 Uzui', talent: 'swiftBlade' },
			{ nameKey: 'Wind Hashira \u2014 Sanemi', talent: 'bloodDrink' },
			{ nameKey: 'Stone Hashira \u2014 Himejima', talent: 'ironWall' }
		];
		var p = pillars[Math.floor(Math.random() * pillars.length)];
		var talent = Space.TALENTS.find(function(t) { return t.id === p.talent; });
		Events.startEvent({
			title: _('a hashira waits'),
			scenes: {
				'start': {
					text: [
						_('a hashira sits at a crossroad here, teaching what they can spare.'),
						_('{0} offers a lesson: {1}', _(p.nameKey), _(talent.nameKey))
					],
					buttons: {
						'accept': {
							text: _('accept the lesson'),
							onChoose: function() {
								var cur = Space.getTalentLevel(p.talent);
								if (cur < talent.maxLevel) {
									Space.setTalentLevel(p.talent, cur + 1);
									Notifications.notify(null, _('{0} teaches you the way: {1} Lv.{2}', _(p.nameKey), _(talent.nameKey), cur + 1));
								} else {
									Notifications.notify(null, _('you have already mastered this. they smile and give you a wisteria charm.'));
									$SM.add('stores["wisteria charm"]', 1);
								}
								Space.afterNode();
							},
							nextScene: 'end'
						},
						'pass': {
							text: _('bow and pass on'),
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
Space._muzanPhase = 1;
Space._muzanDawnSecs = 60 * 5; // 5 阶段 × 60 秒

Events.startEvent({
title: _('鬼王・无惨'),
scenes: {
'start': {
combat: true,
enemy: _('鬼王・无惨'),
chara: 'M',
damage: 25,
hit: 0.95,
attackDelay: 0.9,
health: 60000, // 极高血量：前中期几乎打不出显著变化，靠柱推动阶段与柱一击各削 10000
notification: _('the Demon King Muzan stands at the heart of his castle. hold on until dawn.'),
loot: {},
telegraphAttacks: [
	{
		interval: 8,
		telegraphSec: 1.5,
		telegraph: _('blood demon art coalesces \u2014 a long, narrow strike is coming.'),
		interruptedText: _('the technique fractures mid-form; he reels back.'),
		dmg: 20,
		hit: 0.95,
		ranged: true,
		bleedSec: 10,
		bleedPerSec: 2
	},
	{
		interval: 20,
		telegraphSec: 5,
		telegraph: _('he opens both hands \u2014 something heavy is being shaped.'),
		interruptedText: _('the shaped technique scatters into the dark.'),
		dmg: 60,
		hit: 1.0,
		shieldBreaker: true
	},
	{
		interval: 30,
		telegraphSec: 2,
		telegraph: _('a wave of red mist rolls out \u2014 hard to breathe'),
		interruptedText: _('the mist dissipates.'),
		dmg: 15,
		hit: 1.0,
		ranged: true
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

// 5 阶段 × 60 秒：每阶段柱赶到（补给 + 一击削血 + 阶段推进 + 距天明倒计时）
var pillars = [
{ name: _('炎柱・煉獄杏寿郎'), move: _('炎之呼吸・壹ノ型・不知火') },
{ name: _('水柱・富冈义勇'),   move: _('水之呼吸・拾壹ノ型・凪') },
{ name: _('蛇柱・伊黑小芭内'), move: _('蛇之呼吸・伍ノ型・蜿蜒走り') },
{ name: _('恋柱・甘露寺蜜璃'), move: _('恋之呼吸・陸ノ型・猫足恋風') },
{ name: _('风柱・不死川实弥'), move: _('风之呼吸・伍ノ型・木枯らし颪') }
];
// 距天明倒计时（5 分钟）——每秒刷新一次通知栏上方标题
Space._muzanTimerId = Engine.combatSetInterval(function() {
	if (Space.done || !Events.activeEvent()) { clearInterval(Space._muzanTimerId); return; }
	if (Space._muzanDawnSecs <= 0) { clearInterval(Space._muzanTimerId); return; }
	Space._muzanDawnSecs--;
	var mm = Math.floor(Space._muzanDawnSecs / 60);
	var ss = Space._muzanDawnSecs % 60;
	var t = (ss < 10 ? '0' : '') + ss;
	document.title = _('Muzan \u2014 dawn in {0}:{1}', mm, t);
}, 1000);
Space._pillarTimers.push(Space._muzanTimerId);

for(var i = 0; i < pillars.length; i++) {
(function(idx, p) {
var tid = window.setTimeout(function() {
Space._muzanPhase = idx + 2; // 1→2→3→4→5→6(dawn)
try { Notifications.notify(null, _('=== phase {0}/5: the demon king\'s form shifts ===', Math.min(5, idx + 1))); } catch (_) {}
Space.doPillarAssist(p.name, p.move);
}, 60000 * (idx + 1));
Space._pillarTimers.push(tid);
})(i, pillars[i % pillars.length]);
}

// 全部柱赶到后再等 3 秒，天明强制来临
var forceId = window.setTimeout(Space.forceDawn, 60000 * pillars.length + 3000);
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

// 治疗玩家到满血并补给（药+3、归阵符+1）
$SM.add('stores.medicine', 3);
$SM.add('stores["fleet beacon"]', 1);
var maxHp = World.getMaxHealth();
World.setHp(maxHp);
var wanderer = $('#wanderer');
wanderer.data('hp', maxHp);
Events.updateFighterDiv(wanderer);
Events.drawFloatText(_('+回复'), $('.hp', wanderer));

// 柱对无惨发起一击（削 10000）
var hp = Math.max(0, enemy.data('hp') - 10000);
enemy.data('hp', hp);
Events.updateFighterDiv(enemy);
Events.drawFloatText('-10000', $('.hp', enemy));
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
// 与远征一致：把剩余背包归还到家里库存
try { World.returnOutfit(); } catch (e) { /* ignore */ }
// 天赋只在本次 run 内有效：出无限城即清空
try { Space.clearTalents(); } catch (e) { /* ignore */ }
Space._potionEffect = null;
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
