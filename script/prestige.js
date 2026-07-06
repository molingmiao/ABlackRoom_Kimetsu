var Prestige = {
		
	name: 'Prestige',

	options: {},

	init: function(options) {
		this.options = $.extend(this.options, options);
	},
	
	storesMap: [
		{ store: 'wood', type: 'g' },
		{ store: 'fur', type: 'g' },
		{ store: 'meat', type: 'g' },
		{ store: 'iron', type: 'g' },
		{ store: 'coal', type: 'g' },
		{ store: 'sulphur', type: 'g' },
		{ store: 'steel', type: 'g' },
		{ store: 'cured meat', type: 'g' },
		{ store: 'scales', type: 'g' },
		{ store: 'teeth', type: 'g' },
		{ store: 'leather', type: 'g' },
		{ store: 'bait', type: 'g' },
		{ store: 'torch', type: 'g' },
		{ store: 'cloth', type: 'g' },
		{ store: 'bone yari', type: 'w' },
		{ store: 'kou katana', type: 'w' },
		{ store: 'nichirin katana', type: 'w' },
		{ store: 'nichirin spear', type: 'w' },
		{ store: 'wisteria gun', type: 'w' },
		{ store: 'nichirin gun', type: 'w' },
		{ store: 'wisteria bullet', type: 'a' },
		{ store: 'solar crystal', type: 'a' },
		{ store: 'wisteria bomb', type: 'a' },
		{ store: 'kusarigama', type: 'a' }
	],
	
	getStores: function(reduce) {
		var stores = [];
		
		for(var i in this.storesMap) {
			var s = this.storesMap[i];
			stores.push(Math.floor($SM.get('stores["' + s.store + '"]', true) / 
					(reduce ? this.randGen(s.type) : 1)));
		}
		
		return stores;
	},
	
	get: function() {
		return {
			stores: $SM.get('previous.stores'),
			score: $SM.get('previous.score'),
			legacy: $SM.get('previous.legacy')
		};
	},
	
	set: function(prestige) {
		$SM.set('previous.stores', prestige.stores);
		$SM.set('previous.score', prestige.score);
		if (prestige.legacy) {
			$SM.set('previous.legacy', prestige.legacy);
		}
	},
	
	save: function() {
		$SM.set('previous.stores', this.getStores(true));
		$SM.set('previous.score', Score.totalScore());
		// previous.legacy.* 是跨周目累计数据，有 winFight 随时叠加，这里不需重设
	},
  
	collectStores : function() {
		var prevStores = $SM.get('previous.stores');
		if(prevStores != null) {
			var toAdd = {};
			for(var i in this.storesMap) {
				var s = this.storesMap[i];
				toAdd[s.store] = prevStores[i];
			}
			$SM.addM('stores', toAdd);
			
			// Loading the stores clears em from the save
			prevStores.length = 0;
		}
	},

	randGen : function(storeType) {
		var amount;
		switch(storeType) {
		case 'g':
			amount = Math.floor(Math.random() * 10);
			break;
		case 'w':
			amount = Math.floor(Math.floor(Math.random() * 10) / 2);
			break;
		case 'a':
			amount = Math.ceil(Math.random() * 10 * Math.ceil(Math.random() * 10));
			break;
		default:
			return 1;
		}
		if (amount !== 0) {
			return amount;
		}
		return 1;
	},

	// 血脉传承：跨周目累计击杀里程碑。每个层级在新存档启动后只应用一次
	LegacyTiers: [
		{ threshold: 10,  key: 'tier1', name: 'Legacy I',   apply: function() {
			$SM.add('stores.wood', 50);
			Notifications.notify(null, _('legacy of fallen slayers — 50 wood at your gate.'));
		}},
		{ threshold: 50,  key: 'tier2', name: 'Legacy II',  apply: function() {
			$SM.add('stores["cured meat"]', 20);
			$SM.add('stores["wisteria charm"]', 2);
			Notifications.notify(null, _('legacy of fallen slayers — supplies left at the wisteria gate.'));
		}},
		{ threshold: 200, key: 'tier3', name: 'Legacy III', apply: function() {
			if (!$SM.hasPerk('breath no food')) $SM.addPerk('breath no food');
			Notifications.notify(null, _('legacy of fallen slayers — their endurance lives on in you.'));
		}},
		{ threshold: 500, key: 'tier4', name: 'Legacy IV',  apply: function() {
			$SM.add('stores["medicine"]', 5);
			$SM.add('stores["wisteria charm"]', 5);
			if (!$SM.hasPerk('kehai dansha')) $SM.addPerk('kehai dansha');
			Notifications.notify(null, _('legacy of fallen slayers — a full caravan arrives in your name.'));
		}}
	],

	// 在新存档起步后调用：检查跨周目累计击杀是否达到某档，未应用过则应用一次
	applyLegacy: function() {
		var kills = $SM.get('previous.legacy.kills', true);
		if (!kills || kills <= 0) return;
		var applied = $SM.get('previous.legacy.appliedTiers') || {};
		var dirty = false;
		for (var i = 0; i < Prestige.LegacyTiers.length; i++) {
			var tier = Prestige.LegacyTiers[i];
			if (kills >= tier.threshold && !applied[tier.key]) {
				tier.apply();
				applied[tier.key] = true;
				dirty = true;
			}
		}
		if (dirty) $SM.set('previous.legacy.appliedTiers', applied, true);
	},

	// winFight 调用：累计跨周目击杀
	recordKill: function() {
		var k = $SM.get('previous.legacy.kills', true) || 0;
		$SM.set('previous.legacy.kills', k + 1, true);
	},

	// 跨周目 buff 接口：成就系统会向这里叠加永久增益，各游戏机制在计算时调用 getBonus。
	// 字段说明：
	//   fistDmg     拳脚伤害加成（整数）
	//   woodGather  伐木倒数倍率（1 + N，N 是 0.01 的倍数）
	//   trapDrop    陷阱产出倍率（1 + N）
	//   eventLoot   事件 loot 产出倍率（1 + N）
	getBonus: function(name) {
		var b = $SM.get('previous.legacy.bonuses');
		return (b && typeof b[name] === 'number') ? b[name] : 0;
	},

	addBonus: function(name, delta) {
		var b = $SM.get('previous.legacy.bonuses') || {};
		b[name] = (b[name] || 0) + delta;
		$SM.set('previous.legacy.bonuses', b, true);
	}

};
