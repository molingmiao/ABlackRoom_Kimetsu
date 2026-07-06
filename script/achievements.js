/**
 * 成就系统
 * - 每次状态更新检查未解锁的条目
 * - 解锁时通知 + 派发奖励
 * - 提供查看面板（菜单中"achievements." 按钮触发）
 */
var Achievements = {

	name: 'Achievements',

	// 成就定义。每条:
	//   id: 持久化 key
	//   group: 分组（用于面板分类显示）
	//   title: 简短标题
	//   desc: 一句话功能描述
	//   condition(): 是否完成 → bool
	//   progress(): 进度 → [cur, target]（可选）
	//   reward: 完成奖励 stores
	List: [
		/* ----- 房间与基础资源 ----- */
		{
			id: 'firstFire', group: 'room',
			title: _('warming up'), desc: _('stoke the fire for the first time'),
			condition: function() { return $SM.get('stores.wood', true) > 0; },
			reward: { 'wood': 5 }
		},
		{
			id: 'woodCollector', group: 'room',
			title: _('forest sweeper'), desc: _('accumulate 1000 wood'),
			condition: function() { return $SM.get('stores.wood', true) >= 1000; },
			progress: function() { return [Math.min(1000, $SM.get('stores.wood', true)), 1000]; },
			reward: { 'wood': 100 }
		},
		{
			id: 'firstIron', group: 'room',
			title: _('it got hard'), desc: _('obtain iron for the first time'),
			condition: function() { return $SM.get('stores.iron', true) > 0; },
			reward: { 'coal': 20 }
		},
		{
			id: 'firstSteel', group: 'room',
			title: _('even harder'), desc: _('obtain steel for the first time'),
			condition: function() { return $SM.get('stores.steel', true) > 0; },
			reward: { 'iron': 20 }
		},
		{
			id: 'firstDemonStone', group: 'room',
			title: _('light and shadow'), desc: _('obtain demon stone for the first time'),
			condition: function() { return $SM.get('stores["demon stone"]', true) > 0; },
			reward: { 'wisteria charm': 3 }
		},
		{
			id: 'firstSolarCrystal', group: 'room',
			title: _('a fragment of the sun'), desc: _('obtain solar crystal for the first time'),
			condition: function() { return $SM.get('stores["solar crystal"]', true) > 0; },
			reward: { 'solar crystal': 1 }
		},

		/* ----- 村庄 ----- */
		{
			id: 'firstVillager', group: 'village',
			title: _('a first arrival'), desc: _('first villager joins the wisteria estate'),
			condition: function() { return $SM.get('game.population', true) >= 1; },
			reward: { 'cured meat': 5 }
		},
		{
			id: 'villageChief', group: 'village',
			title: _('you are the keeper now'), desc: _('village population reaches its cap'),
			condition: function() {
				if (typeof Outside === 'undefined' || !Outside.getMaxPopulation) return false;
				var pop = $SM.get('game.population', true);
				var max = Outside.getMaxPopulation();
				return max > 0 && pop >= max;
			},
			progress: function() {
				if (typeof Outside === 'undefined' || !Outside.getMaxPopulation) return [0, 1];
				return [$SM.get('game.population', true), Outside.getMaxPopulation() || 1];
			},
			reward: { 'cured meat': 50 }
		},
		{
			id: 'trapMaster', group: 'village',
			title: _('layered defenses'), desc: _('build 10 traps'),
			condition: function() { return $SM.get('game.buildings["trap"]', true) >= 10; },
			progress: function() { return [Math.min(10, $SM.get('game.buildings["trap"]', true)), 10]; },
			reward: { 'bait': 10 }
		},
		{
			id: 'workshopBuilt', group: 'village',
			title: _('she has tools now'), desc: _('build the workshop'),
			condition: function() { return $SM.get('game.buildings["workshop"]', true) >= 1; },
			reward: { 'leather': 30 }
		},
		{
			id: 'steelworksBuilt', group: 'village',
			title: _('the forge never sleeps'), desc: _('build the steelworks'),
			condition: function() { return $SM.get('game.buildings["steelworks"]', true) >= 1; },
			reward: { 'coal': 50 }
		},

		/* ----- 战斗 ----- */
		{
			id: 'firstKill', group: 'combat',
			title: _('opening strike'), desc: _('slay the first demon'),
			condition: function() { return $SM.get('previous.legacy.kills', true) >= 1; },
			reward: { 'cured meat': 5 }
		},
		{
			id: 'killCount50', group: 'combat',
			title: _('rising slayer'), desc: _('cumulative 50 kills across all runs'),
			condition: function() { return $SM.get('previous.legacy.kills', true) >= 50; },
			progress: function() { return [Math.min(50, $SM.get('previous.legacy.kills', true) || 0), 50]; },
			reward: { 'wisteria charm': 2 }
		},
		{
			id: 'killCount200', group: 'combat',
			title: _('seasoned slayer'), desc: _('cumulative 200 kills across all runs'),
			condition: function() { return $SM.get('previous.legacy.kills', true) >= 200; },
			progress: function() { return [Math.min(200, $SM.get('previous.legacy.kills', true) || 0), 200]; },
			reward: { 'medicine': 5 }
		},
		{
			id: 'firstUpperMoon', group: 'combat',
			title: _('a face-to-face'), desc: _('defeat an upper moon candidate'),
			condition: function() { return $SM.get('game.upperMoonSlain', true) >= 1; },
			reward: { 'demon stone': 1 }
		},
		{
			id: 'muzanDown', group: 'combat',
			title: _('dawn at last'), desc: _('the Demon King falls'),
			condition: function() { return $SM.get('game.muzanSlain', true) === true; },
			reward: { 'fleet beacon': 1 }
		},

		/* ----- 探索 ----- */
		{
			id: 'firstEmbark', group: 'path',
			title: _('on the dusty path'), desc: _('embark on a journey'),
			condition: function() { return $SM.get('game.embarks', true) >= 1; },
			reward: { 'torch': 3 }
		},
		{
			id: 'farTraveler', group: 'path',
			title: _('long strider'), desc: _('reach a distance of 50 from the wisteria'),
			condition: function() { return $SM.get('game.maxDistance', true) >= 50; },
			progress: function() { return [Math.min(50, $SM.get('game.maxDistance', true) || 0), 50]; },
			reward: { 'cured meat': 10 }
		},
		{
			id: 'firstDeath', group: 'path',
			title: _('rehearsing death'), desc: _('die once'),
			condition: function() { return $SM.get('previous.legacy.deaths', true) >= 1; },
			reward: { 'wisteria charm': 1 }
		},

		/* ----- 培养 ----- */
		{
			id: 'firstPerk', group: 'training',
			title: _('first breath'), desc: _('learn any perk'),
			condition: function() {
				var perks = $SM.get('character.perks');
				if (!perks) return false;
				for (var k in perks) { if (perks[k]) return true; }
				return false;
			},
			reward: { 'wisteria charm': 1 }
		},
		{
			id: 'nichirinForged', group: 'training',
			title: _('the colored blade'), desc: _('forge a nichirin katana'),
			condition: function() { return $SM.get('stores["nichirin katana"]', true) >= 1; },
			reward: { 'solar crystal': 2 }
		},
		{
			id: 'disasterSurvived', group: 'training',
			title: _('the unforeseen'), desc: _('survive any village disaster'),
			condition: function() {
				return $SM.get('game.demonRaidDone')
					|| $SM.get('game.plagueDone')
					|| $SM.get('game.taintedWaterDone');
			},
			reward: { 'medicine': 5 }
		},

		/* ----- 跨周目特赌（解锁即予永久 buff） ----- */
		{
			id: 'kill100Buff', group: 'prestige',
			title: _('hundred-fold edge'), desc: _('cumulative 100 demons slain across all runs'),
			condition: function() { return ($SM.get('previous.legacy.kills', true) || 0) >= 100; },
			progress: function() { return [Math.min(100, $SM.get('previous.legacy.kills', true) || 0), 100]; },
			bonuses: { fistDmg: 1 }
		},
		{
			id: 'kill500Buff', group: 'prestige',
			title: _('five-hundred breaths'), desc: _('cumulative 500 demons slain across all runs'),
			condition: function() { return ($SM.get('previous.legacy.kills', true) || 0) >= 500; },
			progress: function() { return [Math.min(500, $SM.get('previous.legacy.kills', true) || 0), 500]; },
			bonuses: { fistDmg: 1, eventLoot: 0.05 }
		},
		{
			id: 'kill1000Buff', group: 'prestige',
			title: _('thousand graves'), desc: _('cumulative 1000 demons slain across all runs'),
			condition: function() { return ($SM.get('previous.legacy.kills', true) || 0) >= 1000; },
			progress: function() { return [Math.min(1000, $SM.get('previous.legacy.kills', true) || 0), 1000]; },
			bonuses: { eventLoot: 0.10, trapDrop: 0.05 }
		},
		{
			id: 'death5Buff', group: 'prestige',
			title: _('iron from ashes'), desc: _('die 5 times across all runs'),
			condition: function() { return ($SM.get('previous.legacy.deaths', true) || 0) >= 5; },
			progress: function() { return [Math.min(5, $SM.get('previous.legacy.deaths', true) || 0), 5]; },
			bonuses: { fistDmg: 1 }
		},
		{
			id: 'gather100Buff', group: 'prestige',
			title: _('forest hand'), desc: _('gather wood 100 times'),
			condition: function() { return ($SM.get('game.gatherCount', true) || 0) >= 100; },
			progress: function() { return [Math.min(100, $SM.get('game.gatherCount', true) || 0), 100]; },
			bonuses: { woodGather: 0.05 }
		},
		{
			id: 'trap100Buff', group: 'prestige',
			title: _('snare master'), desc: _('check traps 100 times'),
			condition: function() { return ($SM.get('game.trapCount', true) || 0) >= 100; },
			progress: function() { return [Math.min(100, $SM.get('game.trapCount', true) || 0), 100]; },
			bonuses: { trapDrop: 0.05 }
		},
		{
			id: 'embark30Buff', group: 'prestige',
			title: _('frequent wayfarer'), desc: _('embark 30 times'),
			condition: function() { return ($SM.get('game.embarks', true) || 0) >= 30; },
			progress: function() { return [Math.min(30, $SM.get('game.embarks', true) || 0), 30]; },
			bonuses: { eventLoot: 0.05 }
		}
	],

	options: {},

	init: function(options) {
		this.options = $.extend(this.options, options);
		Achievements._byId = {};
		Achievements.List.forEach(function(a) { Achievements._byId[a.id] = a; });
		// 状态变化时检查未完成项（在轻量节流后）
		$.Dispatch('stateUpdate').subscribe(Achievements._scheduleCheck);
		// 启动时延迟检查一次（让 Outside/Path 等模块先 init）
		setTimeout(Achievements.checkAll, 1000);
	},

	_scheduleCheck: function() {
		if (Achievements._pending) return;
		Achievements._pending = setTimeout(function() {
			Achievements._pending = null;
			Achievements.checkAll();
		}, 250);
	},

	checkAll: function() {
		for (var i = 0; i < Achievements.List.length; i++) {
			Achievements.check(Achievements.List[i].id);
		}
	},

	check: function(id) {
		var ach = Achievements._byId[id];
		if (!ach) return;
		if ($SM.get('achievements["' + id + '"]')) return;
		var done = false;
		try { done = !!ach.condition(); } catch (e) { done = false; }
		if (done) Achievements.unlock(id);
	},

	unlock: function(id) {
		var ach = Achievements._byId[id];
		if (!ach) return;
		if ($SM.get('achievements["' + id + '"]')) return;
		$SM.set('achievements["' + id + '"]', true);
		Notifications.notify(null, _('achievement unlocked: {0}', ach.title));
		if (ach.reward) {
			$SM.addM('stores', ach.reward);
			var msgs = [];
			for (var k in ach.reward) {
				msgs.push(_(k) + ' +' + ach.reward[k]);
			}
			if (msgs.length) Notifications.notify(null, _('rewards: ') + msgs.join(', '));
		}
		// 跨周目 buff 奏动：将 bonuses 叠加到 previous.legacy.bonuses
		if (ach.bonuses && typeof Prestige !== 'undefined' && Prestige.addBonus) {
			var bmsgs = [];
			for (var bn in ach.bonuses) {
				Prestige.addBonus(bn, ach.bonuses[bn]);
				bmsgs.push(Achievements._bonusLabel(bn, ach.bonuses[bn]));
			}
			if (bmsgs.length) Notifications.notify(null, _('permanent boon: ') + bmsgs.join(', '));
		}
	},

	// 将 buff (名, 增量) 译为可读文本。整数 表示加成，小数 表示百分比
	_bonusLabel: function(name, delta) {
		var nameMap = {
			fistDmg:    _('unarmed dmg'),
			woodGather: _('wood gather'),
			trapDrop:   _('trap yield'),
			eventLoot:  _('event loot')
		};
		var label = nameMap[name] || name;
		if (Number.isInteger(delta)) {
			return label + ' +' + delta;
		}
		return label + ' +' + Math.round(delta * 100) + '%';
	},

	groupNames: {
		'room':     '房间与资源',
		'village':  '村庄',
		'combat':   '战斗',
		'path':     '探索',
		'training': '培养',
		'prestige': '跨周目特赌'
	},

	showPanel: function() {
		if ($('#achievementsOverlay').length) return;
		var overlay = $('<div>').attr('id', 'achievementsOverlay');
		var panel = $('<div>').attr('id', 'achievementsPanel').appendTo(overlay);
		$('<div>').addClass('achTitle').text(_('achievements')).appendTo(panel);

		var summary = $('<div>').addClass('achSummary').appendTo(panel);
		var total = Achievements.List.length;
		var done = 0;
		for (var i = 0; i < Achievements.List.length; i++) {
			if ($SM.get('achievements["' + Achievements.List[i].id + '"]')) done++;
		}
		summary.text(_('progress: {0}/{1}', done, total));

		// 跨周目 buff 总览
		try {
			var b = $SM.get('previous.legacy.bonuses') || {};
			var items = [];
			for (var bn in b) {
				if (b[bn]) items.push(Achievements._bonusLabel(bn, b[bn]));
			}
			if (items.length) {
				var bsum = $('<div>').addClass('achSummary').appendTo(panel);
				bsum.text(_('active boons: ') + items.join(', '));
			}
		} catch (e) { /* ignore */ }

		var listDiv = $('<div>').addClass('achList').appendTo(panel);

		// 按 group 分组渲染
		var groups = ['room', 'village', 'combat', 'path', 'training', 'prestige'];
		groups.forEach(function(g) {
			var groupItems = Achievements.List.filter(function(a) { return a.group === g; });
			if (!groupItems.length) return;
			$('<div>').addClass('achGroupTitle').text(_(Achievements.groupNames[g])).appendTo(listDiv);
			groupItems.forEach(function(a) {
				var unlocked = !!$SM.get('achievements["' + a.id + '"]');
				var row = $('<div>').addClass('achRow').toggleClass('unlocked', unlocked).appendTo(listDiv);
				$('<div>').addClass('achMark').text(unlocked ? '✓' : '·').appendTo(row);
				var body = $('<div>').addClass('achBody').appendTo(row);
				$('<div>').addClass('achName').text(a.title).appendTo(body);
				$('<div>').addClass('achDesc').text(a.desc).appendTo(body);
				if (!unlocked && a.progress) {
					try {
						var p = a.progress();
						if (p && p.length === 2) {
							$('<div>').addClass('achProgress').text(_('progress: {0}/{1}', p[0], p[1])).appendTo(body);
						}
					} catch (e) { /* ignore */ }
				}
				if (a.reward) {
					var rewards = [];
					for (var k in a.reward) rewards.push(_(k) + ' +' + a.reward[k]);
					$('<div>').addClass('achReward').text(_('reward: {0}', rewards.join(', '))).appendTo(body);
				}
				if (a.bonuses) {
					var boons = [];
					for (var bn in a.bonuses) boons.push(Achievements._bonusLabel(bn, a.bonuses[bn]));
					$('<div>').addClass('achReward').text(_('permanent boon: ') + boons.join(', ')).appendTo(body);
				}
			});
		});

		$('<div>').addClass('achClose menuBtn').text(_('close.'))
			.click(Achievements.closePanel)
			.appendTo(panel);

		overlay.appendTo('body');
		overlay.click(function(e) {
			if (e.target === overlay[0]) Achievements.closePanel();
		});
	},

	closePanel: function() {
		$('#achievementsOverlay').remove();
	}
};
