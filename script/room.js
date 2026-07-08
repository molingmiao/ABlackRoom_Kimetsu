/**
 * Module that registers the simple room functionality
 */
var Room = {
	// times in (minutes * seconds * milliseconds)
	_FIRE_COOL_DELAY: 5 * 60 * 1000, // time after a stoke before the fire cools
	_ROOM_WARM_DELAY: 30 * 1000, // time between room temperature updates
	_BUILDER_STATE_DELAY: 0.5 * 60 * 1000, // time between builder state updates
	_STOKE_COOLDOWN: 10, // cooldown to stoke the fire
	_NEED_WOOD_DELAY: 15 * 1000, // from when the stranger shows up, to when you need wood
	buttons: {},

	// 库存物品用途说明——控制样式用于 storeRow 悬浮 tooltip
	StoreDescriptions: {
		// 基础资源
		'wood': _('烧火、建造与合成的基础原料'),
		'fur': _('兽皮——可用于交易、鞄皮成牋革'),
		'meat': _('生肉，可腐坏；不能直接骨出征心充体力'),
		'cured meat': _('熏肉，远征口粮。食用可恢复生命'),
		'bait': _('授诱猟物，配合陷阱使用'),
		'scales': _('鲗鳞——可与商人交换冶炼金属'),
		'teeth': _('兽齿——可与商人交换炼炭'),
		'cloth': _('布料，用于缝装与制作某些装备'),
		'leather': _('鞄皮后的兽革，用于护具、背包、装备组件'),
		'iron': _('铁错——锻造较高阶装备的原料'),
		'coal': _('炭火，炼钢场燃料'),
		'steel': _('钢错——高级锻造与重型装备原料'),
		'sulphur': _('硝碎，炼制酱粉与炸裂物的原料'),
		'compass': _('指南针——解锁世界探索与面包'),

		// 远征消耗品
		'medicine': _('药品，使用后大幅恢复生命'),
		'wisteria oil': _('紫藤油，使用与药品同类，远征中助息'),
		'concentration pill': _('丸药，恢复气力与状态'),
		'torch': _('火把，黑暗场景必备；能被萤火珠替代'),
		'firefly orb': _('萤火珠——走远征时永久照明，代替火把'),
		'wisteria charm': _('紫藤护身符——身携可驱鬼'),
		'solar crystal': _('日轮结晶——散发柔和红光，是高阶武器的能源'),
		'demon stone': _('鬼石——锻造高阶战争器械的稀有原料'),

		// 弹药 / 投掷
		'wisteria bullet': _('紫藤弹——配合枪型武器发射'),
		'wisteria bomb': _('紫藤之雷——投掷型，范围伤害'),

		// 近身武器
		'bone yari': _('骨枪——初期粗陋但实用的近战兵器'),
		'kou katana': _('铁口刯——中期主力近战'),
		'nichirin katana': _('日轮刀——鬼杀队魂之武器，与使用者呼吸共鸣'),
		'nichirin spear': _('日轮枪——长柄、高伤害，适合面对强鬼'),
		'flame blade': _('焰刃刀——炼狱杯醁郎所持之刀'),

		// 远程 / 特殊武器
		'wisteria gun': _('紫藤之枪——响着烈响射出紫藤弹的枪型武器'),
		'nichirin gun': _('日轮枪——由日轮结晶驱动的远程利器'),
		'thunder gun': _('雷鸣枪——电光般迅猛，同以日轮结晶驱动'),
		'kusarigama': _('鎖镰——超远程束缚型兵器，令鬼短暂动弹不得'),
		'bind kunai': _('缚式苦无——投出后使鬼短暂鲁钝'),

		// 护具升级（不会出现在库存列表，但说明文案保留作免表单报警）
		'l armour': _('革护甲——初阶护身'),
		'i armour': _('铁护甲——提升远征中身组'),
		's armour': _('钢护甲——中后期主力护具'),
		'wind armour': _('风之铠——顶级护甲，减伤并提升机动'),

		// 携行 / 水袋 / 交通工具
		'rucksack': _('布背包——背包容量 +10'),
		'wagon': _('行李架——背包容量 +30'),
		'convoy': _('辎重箱——背包容量 +60'),
		'cargo crow': _('传计鸦队——背包容量 +100'),
		'waterskin': _('水袋——上限上调'),
		'cask': _('木桶——水上限进一步上调'),
		'water tank': _('水槽——顶阶水容量'),

		// 鬼灭术语与特殊道具
		'fleet beacon': _('归阵符——战斗中可召集柱前来驰援，瞬间回满血'),
		'rope': _('绳索，某些险境探索中会用到'),

		// 旧 key 兼容（_RENAME_STORES 迁移前的老存档可能短暂可见）
		'alien alloy': _('鬼石（旧名）'),
		'energy cell': _('日轮结晶（旧名）'),
		'bullets': _('紫藤弹（旧名）'),
		'rifle': _('紫藤之枪（旧名）'),
		'bolas': _('鎖镰（旧名）'),
		'grenade': _('紫藤之雷（旧名）')
	},
	Craftables: {
		'trap': {
			name: _('trap'),
			button: null,
			maximum: 10,
			availableMsg: _('Shinobu says she can rig traps along the forest paths'),
			buildMsg: _('more traps to catch more creatures'),
			maxMsg: _("more traps won't help now"),
			type: 'building',
			cost: function () {
				var n = $SM.get('game.buildings["trap"]', true);
				return {
					'wood': 10 + (n * 10)
				};
			},
			audio: AudioLibrary.BUILD_TRAP
		},
		'cart': {
			name: _('cart'),
			button: null,
			maximum: 1,
			availableMsg: _('Shinobu says she can build a cart for hauling wood'),
			buildMsg: _('the rickety cart will carry more wood from the forest'),
			type: 'building',
			cost: function () {
				return {
					'wood': 30
				};
			},
			audio: AudioLibrary.BUILD_CART
		},
		'hut': {
			name: _('hut'),
			button: null,
			maximum: 20,
			availableMsg: _("Shinobu says there are more survivors out there. says they'll join the corps."),
			buildMsg: _('Shinobu raises a shelter at the forest edge. word will reach those who seek refuge.'),
			maxMsg: _('no more room for huts.'),
			type: 'building',
			cost: function () {
				var n = $SM.get('game.buildings["hut"]', true);
				return {
					'wood': 100 + (n * 50)
				};
			},
			audio: AudioLibrary.BUILD_HUT
		},
		'lodge': {
			name: _('lodge'),
			button: null,
			maximum: 1,
			availableMsg: _('villagers could help hunt, given the means'),
			buildMsg: _('the hunting lodge stands in the forest, a ways out of town'),
			type: 'building',
			cost: function () {
				return {
					wood: 200,
					fur: 10,
					meat: 5
				};
			},
			audio: AudioLibrary.BUILD_LODGE
		},
		'trading post': {
			name: _('trading post'),
			button: null,
			maximum: 1,
			availableMsg: _("a trading post would make commerce easier"),
			buildMsg: _("now the nomads have a place to set up shop, they might stick around a while"),
			type: 'building',
			cost: function () {
				return {
					'wood': 400,
					'fur': 100
				};
			},
			audio: AudioLibrary.BUILD_TRADING_POST
		},
		'tannery': {
			name: _('tannery'),
			button: null,
			maximum: 1,
			availableMsg: _("Shinobu says leather could be useful. says the villagers know how to work it."),
			buildMsg: _('tannery goes up quick, on the edge of the village'),
			type: 'building',
			cost: function () {
				return {
					'wood': 500,
					'fur': 50
				};
			},
			audio: AudioLibrary.BUILD_TANNERY
		},
		'smokehouse': {
			name: _('smokehouse'),
			button: null,
			maximum: 1,
			availableMsg: _("the meat should be preserved before it spoils. Shinobu says she can arrange something."),
			buildMsg: _('Shinobu finishes the smokehouse. she glances at the cured meat with quiet satisfaction.'),
			type: 'building',
			cost: function () {
				return {
					'wood': 600,
					'meat': 50
				};
			},
			audio: AudioLibrary.BUILD_SMOKEHOUSE
		},
		'workshop': {
			name: _('workshop'),
			button: null,
			maximum: 1,
			availableMsg: _("Shinobu says she could craft finer things, given the right tools"),
			buildMsg: _("the workshop stands ready. Shinobu wastes no time."),
			type: 'building',
			cost: function () {
				return {
					'wood': 800,
					'leather': 100,
					'scales': 10
				};
			},
			audio: AudioLibrary.BUILD_WORKSHOP
		},
		'steelworks': {
			name: _('steelworks'),
			button: null,
			maximum: 1,
			availableMsg: _("Shinobu says the villagers could smelt steel, given the forge"),
			buildMsg: _("a haze falls over the village as the steelworks fires up"),
			type: 'building',
			cost: function () {
				return {
					'wood': 1500,
					'iron': 100,
					'coal': 100
				};
			},
			audio: AudioLibrary.BUILD_STEELWORKS
		},
		'armoury': {
			name: _('armoury'),
			button: null,
			maximum: 1,
			availableMsg: _("Shinobu says a steady supply of bullets would help the slayers"),
			buildMsg: _("armoury's done, welcoming back the weapons of the past."),
			type: 'building',
			cost: function () {
				return {
					'wood': 3000,
					'steel': 100,
					'sulphur': 50
				};
			},
			audio: AudioLibrary.BUILD_ARMOURY
		},
		'torch': {
			name: _('torch'),
			button: null,
			type: 'tool',
			buildMsg: _('a torch to keep the dark away'),
			cost: function () {
				return {
					'wood': 1,
					'cloth': 1
				};
			},
			audio: AudioLibrary.CRAFT_TORCH
		},
		'waterskin': {
			name: _('waterskin'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('this waterskin\'ll hold a bit of water, at least'),
			cost: function () {
				return {
					'leather': 50
				};
			},
			audio: AudioLibrary.CRAFT_WATERSKIN
		},
		'cask': {
			name: _('cask'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('the cask holds enough water for longer expeditions'),
			cost: function () {
				return {
					'leather': 100,
					'iron': 20
				};
			},
			audio: AudioLibrary.CRAFT_CASK
		},
		'water tank': {
			name: _('water tank'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('never go thirsty again'),
			cost: function () {
				return {
					'iron': 100,
					'steel': 50
				};
			},
			audio: AudioLibrary.CRAFT_WATER_TANK
		},
		'bone yari': {
			name: _('bone yari'),
			button: null,
			type: 'weapon',
			buildMsg: _("this spear's not elegant, but it's pretty good at stabbing"),
			cost: function () {
				return {
					'wood': 100,
					'teeth': 5
				};
			},
			audio: AudioLibrary.CRAFT_BONE_SPEAR
		},
		'rucksack': {
			name: _('rucksack'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('carrying more means longer expeditions to the wilds'),
			cost: function () {
				return {
					'leather': 200
				};
			},
			audio: AudioLibrary.CRAFT_RUCKSACK
		},
		'wagon': {
			name: _('wagon'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('the wagon can carry a lot of supplies'),
			cost: function () {
				return {
					'wood': 500,
					'iron': 100
				};
			},
			audio: AudioLibrary.CRAFT_WAGON
		},
		'convoy': {
			name: _('convoy'),
			button: null,
			type: 'upgrade',
			maximum: 1,
			buildMsg: _('the convoy can haul mostly everything'),
			cost: function () {
				return {
					'wood': 1000,
					'iron': 200,
					'steel': 100
				};
			},
			audio: AudioLibrary.CRAFT_CONVOY
		},
		'l armour': {
			name: _('l armour'),
			type: 'upgrade',
			maximum: 1,
			buildMsg: _("leather's not strong. better than rags, though."),
			cost: function () {
				return {
					'leather': 200,
					'scales': 20
				};
			},
			audio: AudioLibrary.CRAFT_LEATHER_ARMOUR
		},
		'i armour': {
			name: _('i armour'),
			type: 'upgrade',
			maximum: 1,
			buildMsg: _("iron's stronger than leather"),
			cost: function () {
				return {
					'leather': 200,
					'iron': 100
				};
			},
			audio: AudioLibrary.CRAFT_IRON_ARMOUR
		},
		's armour': {
			name: _('s armour'),
			type: 'upgrade',
			maximum: 1,
			buildMsg: _("steel's stronger than iron"),
			cost: function () {
				return {
					'leather': 200,
					'steel': 100
				};
			},
			audio: AudioLibrary.CRAFT_STEEL_ARMOUR
		},
		'kou katana': {
			name: _('kou katana'),
			button: null,
			type: 'weapon',
			buildMsg: _("sword is sharp. good protection out in the wilds."),
			cost: function () {
				return {
					'wood': 200,
					'leather': 50,
					'iron': 20
				};
			},
			audio: AudioLibrary.CRAFT_IRON_SWORD
		},
		'nichirin katana': {
			name: _('nichirin katana'),
			button: null,
			type: 'weapon',
			buildMsg: _("the steel is strong, and the blade true."),
			cost: function () {
				return {
					'wood': 500,
					'leather': 100,
					'steel': 20
				};
			},
			audio: AudioLibrary.CRAFT_STEEL_SWORD
		},
		'nichirin gun': {
			name: _('nichirin gun'),
			button: null,
			type: 'weapon',
			buildMsg: _("a sun-steel barrel, bored true \u2014 it drinks solar crystals and spits light."),
			cost: function () {
				return {
					'wood': 500,
					'leather': 60,
					'steel': 20,
					'sulphur': 20
				};
			},
			audio: AudioLibrary.CRAFT_RIFLE
		},
		'wisteria gun': {
			name: _('wisteria gun'),
			type: 'weapon',
			buildMsg: _("black powder and bullets, like the old days."),
			cost: function () {
				return {
					'wood': 200,
					'steel': 50,
					'sulphur': 50
				};
			},
			audio: AudioLibrary.CRAFT_RIFLE
		}
	},

	TradeGoods: {
		'scales': {
			type: 'good',
			cost: function () {
				return { fur: 150 };
			},
			audio: AudioLibrary.BUY_SCALES
		},
		'teeth': {
			type: 'good',
			cost: function () {
				return { fur: 300 };
			},
			audio: AudioLibrary.BUY_TEETH
		},
		'iron': {
			type: 'good',
			cost: function () {
				return {
					'fur': 150,
					'scales': 50
				};
			},
			audio: AudioLibrary.BUY_IRON
		},
		'coal': {
			type: 'good',
			cost: function () {
				return {
					'fur': 200,
					'teeth': 50
				};
			},
			audio: AudioLibrary.BUY_COAL
		},
		'steel': {
			type: 'good',
			cost: function () {
				return {
					'fur': 300,
					'scales': 50,
					'teeth': 50
				};
			},
			audio: AudioLibrary.BUY_STEEL
		},
		'medicine': {
			type: 'good',
			cost: function () {
				return {
					'scales': 50, 'teeth': 30
				};
			},
			audio: AudioLibrary.BUY_MEDICINE
		},
		'wisteria bullet': {
			type: 'good',
			cost: function () {
				return {
					'scales': 10
				};
			},
			audio: AudioLibrary.BUY_BULLETS
		},
		'solar crystal': {
			type: 'good',
			cost: function () {
				return {
					'scales': 10,
					'teeth': 10
				};
			},
			audio: AudioLibrary.BUY_ENERGY_CELL
		},
		'kusarigama': {
			type: 'weapon',
			cost: function () {
				return {
					'teeth': 10
				};
			},
			audio: AudioLibrary.BUY_BOLAS
		},
		'wisteria bomb': {
			type: 'weapon',
			cost: function () {
				return {
					'scales': 100,
					'teeth': 50
				};
			},
			audio: AudioLibrary.BUY_GRENADES
		},
		'nichirin spear': {
			type: 'weapon',
			cost: function () {
				return {
					'scales': 500,
					'teeth': 250
				};
			},
			audio: AudioLibrary.BUY_BAYONET
		},
		'demon stone': {
			type: 'good',
			cost: function () {
				return {
					'fur': 1500,
					'scales': 750,
					'teeth': 300
				};
			},
			audio: AudioLibrary.BUY_ALIEN_ALLOY
		},
		'compass': {
			type: 'special',
			maximum: 1,
			cost: function () {
				return {
					fur: 400,
					scales: 20,
					teeth: 10
				};
			},
			audio: AudioLibrary.BUY_COMPASS
		}
	},

	MiscItems: {
		'nichirin gun': {
			type: 'weapon'
		}
	},

	name: _("Wisteria Hall"),
	init: function (options) {
		this.options = $.extend(
			this.options,
			options
		);

		Room.pathDiscovery = Boolean($SM.get('stores["compass"]'));

		if (Engine._debug) {
			this._ROOM_WARM_DELAY = 5000;
			this._BUILDER_STATE_DELAY = 5000;
			this._STOKE_COOLDOWN = 0;
			this._NEED_WOOD_DELAY = 5000;
		}

		if (typeof $SM.get('features.location.room') == 'undefined') {
			$SM.set('features.location.room', true);
			$SM.set('game.builder.level', -1);
		}

		// Trigger the DS opening prologue once for any player who hasn't seen it yet.
		// Uses a dedicated flag so it fires even on existing saves from before the mod.
		if (!$SM.get('game.prologue.done')) {
			// Suppress the "Sound Available!" popup so it doesn't interrupt the prologue.
			$SM.set('playStats.audioAlertShown', true);
			Engine.setTimeout(function () {
				if (typeof Events !== 'undefined' && typeof Events.Prologue !== 'undefined') {
					Events.startEvent(Events.Prologue);
				}
			}, 500);
		}

		// If this is the first time playing, the fire is dead and it's freezing. 
		// Otherwise grab past save state temp and fire level.
		$SM.set('game.temperature', $SM.get('game.temperature.value') === undefined ? this.TempEnum.Freezing : $SM.get('game.temperature'));
		$SM.set('game.fire', $SM.get('game.fire.value') === undefined ? this.FireEnum.Dead : $SM.get('game.fire'));

		// Create the room tab
		this.tab = Header.addLocation(_("Wisteria Hall"), "room", Room);

		// Create the Room panel
		this.panel = $('<div>')
			.attr('id', "roomPanel")
			.addClass('location')
			.appendTo('div#locationSlider');

		Engine.updateSlider();

		// Create the light button
		new Button.Button({
			id: 'lightButton',
			text: _('light fire'),
			click: Room.lightFire,
			cooldown: Room._STOKE_COOLDOWN,
			width: '80px',
			cost: { 'wood': 5 }
		}).appendTo('div#roomPanel');

		// Create the stoke button
		new Button.Button({
			id: 'stokeButton',
			text: _("stoke fire"),
			click: Room.stokeFire,
			cooldown: Room._STOKE_COOLDOWN,
			width: '80px',
			cost: { 'wood': 1 }
		}).appendTo('div#roomPanel');

		// Create the stores container
		$('<div>').attr('id', 'storesContainer').prependTo('div#roomPanel');

		//subscribe to stateUpdates
		$.Dispatch('stateUpdate').subscribe(Room.handleStateUpdates);

		Room.updateButton();
		Room.updateStoresView();
		Room.updateIncomeView();
		Room.updateBuildButtons();

		Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
		Room._tempTimer = Engine.setTimeout(Room.adjustTemp, Room._ROOM_WARM_DELAY);

		/*
		 * Builder states:
		 * 0 - Approaching
		 * 1 - Collapsed
		 * 2 - Shivering
		 * 3 - Sleeping
		 * 4 - Helping
		 */
		if ($SM.get('game.builder.level') >= 0 && $SM.get('game.builder.level') < 3) {
			Room._builderTimer = Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
		}
		if ($SM.get('game.builder.level') == 1 && $SM.get('stores.wood', true) < 0) {
			Engine.setTimeout(Room.unlockForest, Room._NEED_WOOD_DELAY);
		}
		Engine.setTimeout($SM.collectIncome, 1000);

		Notifications.notify(Room, _("the room is {0}", Room.TempEnum.fromInt($SM.get('game.temperature.value')).text));
		Notifications.notify(Room, _("the fire is {0}", Room.FireEnum.fromInt($SM.get('game.fire.value')).text));
	},

	options: {}, // Nothing for now

	onArrival: function (transition_diff) {
		Room.setTitle();
		if (Room.changed) {
			Notifications.notify(Room, _("the fire is {0}", Room.FireEnum.fromInt($SM.get('game.fire.value')).text));
			Notifications.notify(Room, _("the room is {0}", Room.TempEnum.fromInt($SM.get('game.temperature.value')).text));
			Room.changed = false;
		}
		if ($SM.get('game.builder.level') == 3) {
			$SM.add('game.builder.level', 1);
			$SM.setIncome('builder', {
				delay: 10,
				stores: { 'wood': 2 }
			});
			Room.updateIncomeView();
			Notifications.notify(Room, _("Shinobu is on her feet. she surveys the estate and says she can restore it."));
		}

		Engine.moveStoresView(null, transition_diff);
		
		Room.setMusic();
	},

	TempEnum: {
		fromInt: function (value) {
			for (var k in this) {
				if (typeof this[k].value != 'undefined' && this[k].value == value) {
					return this[k];
				}
			}
			return null;
		},
		Freezing: { value: 0, text: _('freezing') },
		Cold: { value: 1, text: _('cold') },
		Mild: { value: 2, text: _('mild') },
		Warm: { value: 3, text: _('warm') },
		Hot: { value: 4, text: _('hot') }
	},

	FireEnum: {
		fromInt: function (value) {
			for (var k in this) {
				if (typeof this[k].value != 'undefined' && this[k].value == value) {
					return this[k];
				}
			}
			return null;
		},
		Dead: { value: 0, text: _('dead') },
		Smoldering: { value: 1, text: _('smoldering') },
		Flickering: { value: 2, text: _('flickering') },
		Burning: { value: 3, text: _('burning') },
		Roaring: { value: 4, text: _('roaring') }
	},

	setTitle: function () {
		var title = $SM.get('game.fire.value') < 2 ? _("Wisteria Hall — Dark") : _("Wisteria Hall — Lit");
		if (Engine.activeModule == this) {
			document.title = title;
		}
		$('div#location_room').text(title);
	},

	updateButton: function () {
		var light = $('#lightButton.button');
		var stoke = $('#stokeButton.button');
		if ($SM.get('game.fire.value') == Room.FireEnum.Dead.value && stoke.css('display') != 'none') {
			stoke.hide();
			light.show();
			if (stoke.hasClass('disabled')) {
				Button.cooldown(light);
			}
		} else if (light.css('display') != 'none') {
			stoke.show();
			light.hide();
			if (light.hasClass('disabled')) {
				Button.cooldown(stoke);
			}
		}

		if (!$SM.get('stores.wood')) {
			light.addClass('free');
			stoke.addClass('free');
		} else {
			light.removeClass('free');
			stoke.removeClass('free');
		}
	},

	_fireTimer: null,
	_tempTimer: null,
	lightFire: function () {
		var wood = $SM.get('stores.wood');
		if (wood < 5) {
			Notifications.notify(Room, _("not enough firewood to light the hearth"));
			Button.clearCooldown($('#lightButton.button'));
			return;
		} else if (wood > 4) {
			$SM.set('stores.wood', wood - 5);
		}
		$SM.set('game.fire', Room.FireEnum.Burning);
		AudioEngine.playSound(AudioLibrary.LIGHT_FIRE);
		Room.onFireChange();
	},

	stokeFire: function () {
		var wood = $SM.get('stores.wood');
		if (wood === 0) {
			Notifications.notify(Room, _("the firewood is exhausted"));
			Button.clearCooldown($('#stokeButton.button'));
			return;
		}
		if (wood > 0) {
			$SM.set('stores.wood', wood - 1);
		}
		if ($SM.get('game.fire.value') < 4) {
			$SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') + 1));
		}
		AudioEngine.playSound(AudioLibrary.STOKE_FIRE);
		Room.onFireChange();
	},

	onFireChange: function () {
		if (Engine.activeModule != Room) {
			Room.changed = true;
		}
		Notifications.notify(Room, _("the fire is {0}", Room.FireEnum.fromInt($SM.get('game.fire.value')).text), true);
		if ($SM.get('game.fire.value') > 1 && $SM.get('game.builder.level') < 0) {
			$SM.set('game.builder.level', 0);
			Notifications.notify(Room, _("firelight seeps through the wisteria vines, into the night"));
			Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
		}
		window.clearTimeout(Room._fireTimer);
		Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
		Room.updateButton();
		Room.setTitle();

		// only update music if in the room
		if (Engine.activeModule == Room) {
			Room.setMusic();
		}
	},

	coolFire: function () {
		var wood = $SM.get('stores.wood');
		if ($SM.get('game.fire.value') <= Room.FireEnum.Flickering.value &&
			$SM.get('game.builder.level') > 3 && wood > 0) {
			Notifications.notify(Room, _("Shinobu tends the hearth"), true);
			$SM.set('stores.wood', wood - 1);
			$SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') + 1));
		}
		if ($SM.get('game.fire.value') > 0) {
			$SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') - 1));
			Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
			Room.onFireChange();
		}
	},

	adjustTemp: function () {
		var old = $SM.get('game.temperature.value');
		if ($SM.get('game.temperature.value') > 0 && $SM.get('game.temperature.value') > $SM.get('game.fire.value')) {
			$SM.set('game.temperature', Room.TempEnum.fromInt($SM.get('game.temperature.value') - 1));
			Notifications.notify(Room, _("the room is {0}", Room.TempEnum.fromInt($SM.get('game.temperature.value')).text), true);
		}
		if ($SM.get('game.temperature.value') < 4 && $SM.get('game.temperature.value') < $SM.get('game.fire.value')) {
			$SM.set('game.temperature', Room.TempEnum.fromInt($SM.get('game.temperature.value') + 1));
			Notifications.notify(Room, _("the room is {0}", Room.TempEnum.fromInt($SM.get('game.temperature.value')).text), true);
		}
		if ($SM.get('game.temperature.value') != old) {
			Room.changed = true;
		}
		Room._tempTimer = Engine.setTimeout(Room.adjustTemp, Room._ROOM_WARM_DELAY);
	},

	unlockForest: function () {
		$SM.set('stores.wood', 4);
		Outside.init();
		Notifications.notify(Room, _("the wisteria branches scrape against the walls"));
		Notifications.notify(Room, _("the firewood is running low"));
		Engine.event('progress', 'outside');
	},

	updateBuilderState: function () {
		var lBuilder = $SM.get('game.builder.level');
		if (lBuilder === 0) {
			Notifications.notify(Room, _("a wounded insect pillar staggers through the gate and collapses by the hearth"));
			lBuilder = $SM.setget('game.builder.level', 1);
			Engine.setTimeout(Room.unlockForest, Room._NEED_WOOD_DELAY);
		}
		else if (lBuilder < 3 && $SM.get('game.temperature.value') >= Room.TempEnum.Warm.value) {
			var msg = "";
			switch (lBuilder) {
				case 1:
					msg = _("Shinobu shivers by the fire, murmuring something beneath her breath.");
					break;
				case 2:
					msg = _("Shinobu's breathing steadies. her colour returns.");
					break;
			}
			Notifications.notify(Room, msg);
			if (lBuilder < 3) {
				lBuilder = $SM.setget('game.builder.level', lBuilder + 1);
			}
		}
		if (lBuilder < 3) {
			Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
		}
		Engine.saveGame();
	},

	updateStoresView: function () {
		var stores = $('div#stores');
		var resources = $('div#resources');
		var special = $('div#special');
		var tools = $('div#tools');
		var weapons = $('div#weapons');
		var needsAppend = false, rNeedsAppend = false, sNeedsAppend = false, tNeedsAppend = false, wNeedsAppend = false, newRow = false;
		if (stores.length === 0) {
			stores = $('<div>').attr({
				'id': 'stores',
				'data-legend': _('materials')
			}).addClass('storeGroup').css('opacity', 0);
			needsAppend = true;
		}
		if (resources.length === 0) {
			resources = $('<div>').attr({
				id: 'resources'
			}).css('opacity', 0);
			rNeedsAppend = true;
		}
		if (special.length === 0) {
			special = $('<div>').attr({
				id: 'special'
			}).css('opacity', 0);
			sNeedsAppend = true;
		}
		if (tools.length === 0) {
			tools = $('<div>').attr({
				id: 'tools'
			}).css('opacity', 0);
			tNeedsAppend = true;
		}
		if (weapons.length === 0) {
			weapons = $('<div>').attr({
				'id': 'weapons',
				'data-legend': _('items')
			}).addClass('storeGroup').css('opacity', 0);
			wNeedsAppend = true;
		}
		for (var k in $SM.get('stores')) {

			if (k.indexOf('blueprint') > 0) {
				// don't show blueprints
				continue;
			}

			const good =  
        Room.Craftables[k] ||
        Room.TradeGoods[k] ||
        Room.TradeGoods[k] ||
        Room.MiscItems[k] ||
        Fabricator.Craftables[k];
      const type = good ? good.type : null;

			var location;
			switch (type) {
				case 'upgrade':
					// Don't display upgrades on the Room screen
					continue;
				case 'building':
					// Don't display buildings either
					continue;
				case 'weapon':
				case 'special':
				case 'tool':
					location = weapons;
					break;
				default:
					location = resources;
					break;
			}

			var id = "row_" + k.replace(/ /g, '-');
			var row = $('div#' + id, location);
			var num = $SM.get('stores["' + k + '"]');

			if (typeof num != 'number' || isNaN(num)) {
				// No idea how counts get corrupted, but I have reason to believe that they occassionally do.
				// Build a little fence around it!
				num = 0;
				$SM.set('stores["' + k + '"]', 0);
			}

			var lk = _(k);

			// thieves?
			if (typeof $SM.get('game.thieves') == 'undefined' && num > 5000 && $SM.get('features.location.world')) {
				$SM.startThieves();
			}

			if (row.length === 0) {
				row = $('<div>').attr('id', id).addClass('storeRow');
				$('<div>').addClass('row_key').text(lk).appendTo(row);
				$('<div>').addClass('row_val').text(Math.floor(num)).appendTo(row);
				$('<div>').addClass('clear').appendTo(row);
				// 物品用途 tooltip
				var desc = Room.StoreDescriptions[k];
				if (desc) {
					var tt = $('<div>').addClass('tooltip bottom right').appendTo(row);
					$('<div>').addClass('row_key').text(desc).appendTo(tt);
				}
				var curPrev = null;
				location.children().each(function (i) {
					var child = $(this);
					var cName = child.children('.row_key').text();
					if (cName < lk) {
						curPrev = child.attr('id');
					}
				});
				if (curPrev == null) {
					row.prependTo(location);
				} else {
					row.insertAfter(location.find('#' + curPrev));
				}
				newRow = true;
			} else {
				$('div#' + row.attr('id') + ' > div.row_val', location).text(Math.floor(num));
			}
			if (type === 'weapon') {
				Room._updateWeaponAmmoRow(k, location);
			}
		}

		if (rNeedsAppend && resources.children().length > 0) {
			resources.prependTo(stores);
			resources.animate({ opacity: 1 }, 300, 'linear');
		}

		if (tNeedsAppend && tools.children().length > 0) {
			tools.appendTo(stores);
			tools.animate({ opacity: 1 }, 300, 'linear');
		}

		if (sNeedsAppend && special.children().length > 0) {
			special.appendTo(stores);
			special.animate({ opacity: 1 }, 300, 'linear');
		}

		if (needsAppend && stores.find('div.storeRow').length > 0) {
			stores.appendTo('div#storesContainer');
			stores.animate({ opacity: 1 }, 300, 'linear');
			Room._wireStoreGroupToggle(stores);
		}

		if (wNeedsAppend && weapons.children().length > 0) {
			weapons.appendTo('div#storesContainer');
			weapons.animate({ opacity: 1 }, 300, 'linear');
			Room._wireStoreGroupToggle(weapons);
		}

		if (newRow) {
			Room.updateIncomeView();
		}

		if ($("div#outsidePanel").length) {
			Outside.updateVillage();
		}

		if ($SM.get('stores.compass') && !Room.pathDiscovery) {
			Room.pathDiscovery = true;
			Path.openPath();
		}
	},

	// 给面板按钮代表第一次出现的快捷样式提示，玩家点过一次后发载该提示
	_markNewlyUnlocked: function(btn, thing) {
		if (!btn || !thing) return;
		if ($SM.get('game.knownButtons["' + thing + '"]')) return;
		btn.addClass('newly-unlocked');
		btn.one('click.unlocked', function() {
			$(this).removeClass('newly-unlocked');
			$SM.set('game.knownButtons["' + thing + '"]', true, true);
		});
	},

	// 给库存分组（#stores / #weapons）注入可点击 header，支持折叠/展开并持久化
	_wireStoreGroupToggle: function(group) {
		if(group.data('toggleWired')) return;
		group.data('toggleWired', true);
		var id = group.attr('id');
		var legend = group.attr('data-legend') || id;
		var header = $('<div>').addClass('storeGroupHeader').appendTo(group);
		$('<span>').addClass('storeGroupCaret').text('▼').appendTo(header);
		$('<span>').addClass('storeGroupTitle').text(legend).appendTo(header);
		group.prepend(header);

		var saved = $SM.get('config.storeCollapsed["' + id + '"]');
		if(saved) {
			group.addClass('collapsed');
			$('.storeGroupCaret', header).text('▶');
		}

		header.on('click', function() {
			group.toggleClass('collapsed');
			var collapsed = group.hasClass('collapsed');
			$('.storeGroupCaret', header).text(collapsed ? '▶' : '▼');
			$SM.set('config.storeCollapsed["' + id + '"]', collapsed, true);
		});
	},

	_updateWeaponAmmoRow: function(weaponKey, container) {
		if (typeof World === 'undefined' || !World.Weapons) return;
		var wDef = World.Weapons[weaponKey];
		if (!wDef || !wDef.cost) return;
		var weaponRow = $('#row_' + weaponKey.replace(/ /g, '-'), container);
		if (weaponRow.length === 0) return;
		var lastNode = weaponRow;
		for (var ammoKey in wDef.cost) {
			if (ammoKey === weaponKey) continue;
			var ammoId = 'ammorow_' + weaponKey.replace(/ /g, '-') + '_' + ammoKey.replace(/ /g, '-');
			var ammoRow = $('#' + ammoId, container);
			var ammoNum = $SM.get('stores["' + ammoKey + '"]', true) || 0;
			if (ammoRow.length === 0) {
				ammoRow = $('<div>').attr('id', ammoId).addClass('storeRow ammoRow');
				$('<div>').addClass('row_key').text('— ' + _(ammoKey)).appendTo(ammoRow);
				$('<div>').addClass('row_val').text(Math.floor(ammoNum)).appendTo(ammoRow);
				$('<div>').addClass('clear').appendTo(ammoRow);
				ammoRow.insertAfter(lastNode);
			} else {
				$('.row_val', ammoRow).text(Math.floor(ammoNum));
			}
			lastNode = ammoRow;
		}
	},

	updateIncomeView: function () {
		var stores = $('div#resources');
		var totalIncome = {};
		if (stores.length === 0 || typeof $SM.get('income') == 'undefined') return;
		$('div.storeRow', stores).each(function (index, el) {
			el = $(el);
			$('div.tooltip', el).remove();
			var ttPos = index > 10 ? 'top right' : 'bottom right';
			var tt = $('<div>').addClass('tooltip ' + ttPos);
			var storeName = el.attr('id').substring(4).replace('-', ' ');
			for (var incomeSource in $SM.get('income')) {
				var income = $SM.get('income["' + incomeSource + '"]');
				for (var store in income.stores) {
					if (store == storeName && income.stores[store] !== 0) {
						$('<div>').addClass('row_key').text(_(incomeSource)).appendTo(tt);
						$('<div>')
							.addClass('row_val')
							.text(Engine.getIncomeMsg(income.stores[store], income.delay))
							.appendTo(tt);
						if (!totalIncome[store] || totalIncome[store].income === undefined) {
							totalIncome[store] = { income: 0 };
						}
						totalIncome[store].income += Number(income.stores[store]);
						totalIncome[store].delay = income.delay;
					}
				}
			}
			if (tt.children().length > 0) {
				var total = totalIncome[storeName].income;
				$('<div>').addClass('total row_key').text(_('total')).appendTo(tt);
				$('<div>').addClass('total row_val').text(Engine.getIncomeMsg(total, totalIncome[storeName].delay)).appendTo(tt);
				tt.appendTo(el);
			}
		});
	},

	buy: function (buyBtn) {
		var thing = $(buyBtn).attr('buildThing');
		var good = Room.TradeGoods[thing];
		var numThings = $SM.get('stores["' + thing + '"]', true);
		if (numThings < 0) numThings = 0;
		if (good.maximum <= numThings) {
			return;
		}

		var storeMod = {};
		var cost = good.cost();
		for (var k in cost) {
			var have = $SM.get('stores["' + k + '"]', true);
			if (have < cost[k] && !Engine.options.testerMode) {
				Notifications.notify(Room, _("not enough " + k));
				return false;
			} else {
				storeMod[k] = have - cost[k];
			}
		}
		if (!Engine.options.testerMode) {
			$SM.setM('stores', storeMod);
		}

		Notifications.notify(Room, good.buildMsg);

		$SM.add('stores["' + thing + '"]', 1);

		// audio
		AudioEngine.playSound(AudioLibrary.BUY);
	},

	build: function (buildBtn) {
		var thing = $(buildBtn).attr('buildThing');
		if ($SM.get('game.temperature.value') <= Room.TempEnum.Cold.value) {
			Notifications.notify(Room, _("builder just shivers"));
			return false;
		}
		var craftable = Room.Craftables[thing];

		var numThings = 0;
		switch (craftable.type) {
			case 'good':
			case 'weapon':
			case 'tool':
			case 'upgrade':
				numThings = $SM.get('stores["' + thing + '"]', true);
				break;
			case 'building':
				numThings = $SM.get('game.buildings["' + thing + '"]', true);
				break;
		}

		if (numThings < 0) numThings = 0;
		if (craftable.maximum <= numThings) {
			return;
		}

		var storeMod = {};
		var cost = craftable.cost();
		for (var k in cost) {
			var have = $SM.get('stores["' + k + '"]', true);
			if (have < cost[k] && !Engine.options.testerMode) {
				Notifications.notify(Room, _("not enough " + k));
				return false;
			} else {
				storeMod[k] = have - cost[k];
			}
		}
		if (!Engine.options.testerMode) {
			$SM.setM('stores', storeMod);
		}

		Notifications.notify(Room, craftable.buildMsg);

		switch (craftable.type) {
			case 'good':
			case 'weapon':
			case 'upgrade':
			case 'tool':
				$SM.add('stores["' + thing + '"]', 1);
				break;
			case 'building':
				$SM.add('game.buildings["' + thing + '"]', 1);
				break;
		}

		// audio
		switch (craftable.type) {
			case 'weapon':
			case 'upgrade':
			case 'tool':
				AudioEngine.playSound(AudioLibrary.CRAFT);
				break;
			case 'building':
				AudioEngine.playSound(AudioLibrary.BUILD);
				break;
		}
	},

	needsWorkshop: function (type) {
		return type == 'weapon' || type == 'upgrade' || type == 'tool';
	},

	craftUnlocked: function (thing) {
		if (Room.buttons[thing]) {
			return true;
		}
		if ($SM.get('game.builder.level') < 4) return false;
		var craftable = Room.Craftables[thing];
		if (Room.needsWorkshop(craftable.type) && $SM.get('game.buildings["' + 'workshop' + '"]', true) === 0) return false;
		var cost = craftable.cost();

		//show button if one has already been built
		if ($SM.get('game.buildings["' + thing + '"]') > 0) {
			Room.buttons[thing] = true;
			return true;
		}
		// Show buttons if we have at least 1/2 the wood, and all other components have been seen.
		if ($SM.get('stores.wood', true) < cost['wood'] * 0.5) {
			return false;
		}
		for (var c in cost) {
			// 只要存档里写过该资源（哪怕当前数量为 0）就算"见过"，刷新后不再因临时为 0 而隐藏按钮
			if (typeof $SM.get('stores["' + c + '"]') === 'undefined') {
				return false;
			}
		}

		Room.buttons[thing] = true;
		//don't notify if it has already been built before
		if (!$SM.get('game.buildings["' + thing + '"]')) {
			Notifications.notify(Room, craftable.availableMsg);
		}
		return true;
	},

	buyUnlocked: function (thing) {
		if (Room.buttons[thing]) {
			return true;
		} else if ($SM.get('game.buildings["trading post"]', true) > 0) {
			if (thing == 'compass' || typeof $SM.get('stores["' + thing + '"]') != 'undefined') {
				// Allow the purchase of stuff once you've seen it
				return true;
			}
		}
		return false;
	},

	updateBuildButtons: function () {
		var buildSection = $('#buildBtns');
		var needsAppend = false;
		if (buildSection.length === 0) {
			buildSection = $('<div>').attr({ 'id': 'buildBtns', 'data-legend': _('build:') }).css('opacity', 0);
			needsAppend = true;
		}

		var craftSection = $('#craftBtns');
		var cNeedsAppend = false;
		if (craftSection.length === 0 && $SM.get('game.buildings["workshop"]', true) > 0) {
			craftSection = $('<div>').attr({ 'id': 'craftBtns', 'data-legend': _('craft:') }).css('opacity', 0);
			cNeedsAppend = true;
		}

		var buySection = $('#buyBtns');
		var bNeedsAppend = false;
		if (buySection.length === 0 && $SM.get('game.buildings["trading post"]', true) > 0) {
			buySection = $('<div>').attr({ 'id': 'buyBtns', 'data-legend': _('buy:') }).css('opacity', 0);
			bNeedsAppend = true;
		}

		for (var k in Room.Craftables) {
			var craftable = Room.Craftables[k];
			var max = $SM.num(k, craftable) + 1 > craftable.maximum;
			if (craftable.button == null) {
				if (Room.craftUnlocked(k)) {
					var loc = Room.needsWorkshop(craftable.type) ? craftSection : buildSection;
					craftable.button = new Button.Button({
						id: 'build_' + k.replace(/ /g, '-'),
						cost: craftable.cost(),
						text: _(k),
						click: Room.build,
						width: '80px',
						ttPos: loc.children().length > 10 ? 'top right' : 'bottom right'
					}).css('opacity', 0).attr('buildThing', k).appendTo(loc).animate({ opacity: 1 }, 300, 'linear');
					Room._markNewlyUnlocked(craftable.button, k);
				}
			} else {
				// refresh the tooltip
				var costTooltip = $('.tooltip', craftable.button);
				costTooltip.empty();
				var cost = craftable.cost();
				for (var c in cost) {
					$("<div>").addClass('row_key').text(_(c)).appendTo(costTooltip);
					$("<div>").addClass('row_val').text(cost[c]).appendTo(costTooltip);
				}
				if (max && !craftable.button.hasClass('disabled')) {
					Notifications.notify(Room, craftable.maxMsg);
				}
			}
			if (max) {
				Button.setDisabled(craftable.button, true);
			} else {
				Button.setDisabled(craftable.button, false);
			}
		}

		for (var g in Room.TradeGoods) {
			var good = Room.TradeGoods[g];
			var goodsMax = $SM.num(g, good) + 1 > good.maximum;
			if (good.button == null) {
				if (Room.buyUnlocked(g)) {
					good.button = new Button.Button({
						id: 'build_' + g,
						cost: good.cost(),
						text: _(g),
						click: Room.buy,
						width: '80px',
						ttPos: buySection.children().length > 10 ? 'top right' : 'bottom right'
					}).css('opacity', 0).attr('buildThing', g).appendTo(buySection).animate({ opacity: 1 }, 300, 'linear');
					Room._markNewlyUnlocked(good.button, g);
				}
			} else {
				// refresh the tooltip
				var goodsCostTooltip = $('.tooltip', good.button);
				goodsCostTooltip.empty();
				var goodCost = good.cost();
				for (var gc in goodCost) {
					$("<div>").addClass('row_key').text(_(gc)).appendTo(goodsCostTooltip);
					$("<div>").addClass('row_val').text(goodCost[gc]).appendTo(goodsCostTooltip);
				}
				if (goodsMax && !good.button.hasClass('disabled')) {
					Notifications.notify(Room, good.maxMsg);
				}
			}
			if (goodsMax) {
				Button.setDisabled(good.button, true);
			} else {
				Button.setDisabled(good.button, false);
			}
		}

		if (needsAppend && buildSection.children().length > 0) {
			buildSection.appendTo('div#roomPanel').animate({ opacity: 1 }, 300, 'linear');
		}
		if (cNeedsAppend && craftSection.children().length > 0) {
			craftSection.appendTo('div#roomPanel').animate({ opacity: 1 }, 300, 'linear');
		}
		if (bNeedsAppend && buildSection.children().length > 0) {
			buySection.appendTo('div#roomPanel').animate({ opacity: 1 }, 300, 'linear');
		}
	},

	compassTooltip: function (direction) {
		var ttPos = $('div#resources').children().length > 10 ? 'top right' : 'bottom right';
		var tt = $('<div>').addClass('tooltip ' + ttPos);
		$('<div>').addClass('row_key').text(_('the compass points ' + direction)).appendTo(tt);
		tt.appendTo($('#row_compass'));
	},

	handleStateUpdates: function (e) {
		if (e.category == 'stores') {
			Room.updateStoresView();
			Room.updateBuildButtons();
		} else if (e.category == 'income') {
			Room.updateStoresView();
			Room.updateIncomeView();
		} else if (e.stateName.indexOf('game.buildings') === 0) {
			Room.updateBuildButtons();
		}
	},

	setMusic() {
		// set music based on fire level
		var fireValue = $SM.get('game.fire.value');
		switch (fireValue) {
			case 0:
				AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_FIRE_DEAD);
				break;
			case 1:
				AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_FIRE_SMOLDERING);
				break;
			case 2:
				AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_FIRE_FLICKERING);
				break;
			case 3:
				AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_FIRE_BURNING);
				break;
			case 4:
				AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_FIRE_ROARING);
				break;
		}
	}
};
