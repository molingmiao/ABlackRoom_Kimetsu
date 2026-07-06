var Path = {
	DEFAULT_BAG_SPACE: 10,
	_STORES_OFFSET: 0,
	// Everything not in this list weighs 1
	Weight: {
		'bone yari': 2,
		'kou katana': 3,
		'nichirin katana': 5,
		'wisteria gun': 5,
		'wisteria bullet': 0.1,
		'solar crystal': 0.2,
		'nichirin gun': 5,
    'thunder gun': 5,
		'kusarigama': 0.5,
	},
		
	name: 'Path',
	options: {}, // Nuthin'
	init: function(options) {
		this.options = $.extend(
			this.options,
			options
		);

		// 标记位置已解锁（永久），以便刷新页面后仅凭该标志即可重建 Path tab，
		// 不再依赖可变的 stores.compass 数值。
		$SM.set('features.location.path', true);

		// Init the World
		World.init();
		
		// Create the path tab
		this.tab = Header.addLocation(_("A Dusty Path"), "path", Path);
		
		// Create the Path panel
		this.panel = $('<div>').attr('id', "pathPanel")
			.addClass('location')
			.appendTo('div#locationSlider');

		this.scroller = $('<div>').attr('id', 'pathScroller').appendTo(this.panel);
		
		// Add the outfitting area
		var outfitting = $('<div>').attr({'id': 'outfitting', 'data-legend': _('supplies:')}).appendTo(this.scroller);
		$('<div>').attr('id', 'bagspace').appendTo(outfitting);

		// 一键装满 + 出发 并排：autoFill 在左，embark 在右
		var buttonsRow = $('<div>').attr('id', 'pathButtonsRow').appendTo(this.scroller);
		new Button.Button({
			id: 'autoFillBtn',
			text: _('auto fill'),
			click: Path.autoFillSupplies,
			width: '80px'
		}).appendTo(buttonsRow);
		new Button.Button({
			id: 'embarkButton',
			text: _("embark"),
			click: Path.embark,
			width: '80px',
			cooldown: World.DEATH_COOLDOWN
		}).appendTo(buttonsRow);
		
		Path.outfit = $SM.get('outfit');
		
		Engine.updateSlider();
		
		//subscribe to stateUpdates
		$.Dispatch('stateUpdate').subscribe(Path.handleStateUpdates);
	},
	
	openPath: function() {
		Path.init();
		Engine.event('progress', 'path');
		Notifications.notify(Room, _('the compass points ' + World.dir));
	},
	
	getWeight: function(thing) {
		var w = Path.Weight[thing];
		if(typeof w != 'number') w = 1;
		
		return w;
	},
	
	getCapacity: function() {
		if($SM.get('stores["cargo crow"]', true) > 0) {
			return Path.DEFAULT_BAG_SPACE + 100;
		} else if($SM.get('stores.convoy', true) > 0) {
			return Path.DEFAULT_BAG_SPACE + 60;
		} else if($SM.get('stores.wagon', true) > 0) {
			return Path.DEFAULT_BAG_SPACE + 30;
		} else if($SM.get('stores.rucksack', true) > 0) {
			return Path.DEFAULT_BAG_SPACE + 10;
		}
		return Path.DEFAULT_BAG_SPACE;
	},
	
	getFreeSpace: function() {
		var num = 0;
		if(Path.outfit) {
			for(var k in Path.outfit) {
				var n = Path.outfit[k];
				if(isNaN(n)) {
					// No idea how this happens, but I will fix it here!
					Path.outfit[k] = n = 0;
				}
				num += n * Path.getWeight(k);
			}
		}
		return Path.getCapacity() - num;
	},
	
	updatePerks: function(ignoreStores) {
		if($SM.get('character.perks')) {
			var perks = $('#perks');
			var needsAppend = false;
			if(perks.length === 0) {
				needsAppend = true;
				perks = $('<div>').attr({'id': 'perks', 'data-legend': _('perks')});
			}
			for(var k in $SM.get('character.perks')) {
				var id = 'perk_' + k.replace(/ /g, '-');
				var r = $('#' + id);
				if($SM.get('character.perks["'+k+'"]') && r.length === 0) {
					r = $('<div>').attr('id', id).addClass('perkRow').appendTo(perks);
					$('<div>').addClass('row_key').text(_(k)).appendTo(r);
					$('<div>').addClass('tooltip bottom right').text(Engine.Perks[k].desc).appendTo(r);
				}
			}

			// 日轮刀颜色行：玩家拥有日轮刀（stores 或 outfit）后才显示
			var hasKatana = ($SM.get('stores["nichirin katana"]', true) > 0)
				|| (Path.outfit && Path.outfit['nichirin katana'] > 0);
			if (hasKatana && Engine.NichirinColors && Engine.getNichirinColor) {
				var color = Engine.getNichirinColor();
				var spec = Engine.NichirinColors[color];
				var colorRow = $('#nichirinColorRow');
				if (colorRow.length === 0) {
					colorRow = $('<div>').attr('id', 'nichirinColorRow').addClass('perkRow').appendTo(perks);
					$('<div>').addClass('row_key').text(_('sword color')).appendTo(colorRow);
					$('<div>').addClass('row_val').appendTo(colorRow);
					$('<div>').addClass('tooltip bottom right').appendTo(colorRow);
				}
				if (spec) {
					$('.row_val', colorRow).text(_(spec.name));
					$('.tooltip', colorRow).text(_(spec.desc));
				}
			}

			if(needsAppend && perks.children().length > 0) {
				perks.prependTo(Path.panel);
			}

			if(!ignoreStores && Engine.activeModule === Path) {
				$('#storesContainer').css({top: perks.height() + 26 + Path._STORES_OFFSET + 'px'});
			}
		}
	},
	
	updateOutfitting: function() {
		var outfit = $('div#outfitting');
		
		if(!Path.outfit) {
			Path.outfit = {};
		}
		
		// Add the armour row
		var armour = _("none");
    if($SM.get('stores["wind armour"]', true) > 0)
			armour = _("kinetic");
		else if($SM.get('stores["s armour"]', true) > 0)
			armour = _("steel");
		else if($SM.get('stores["i armour"]', true) > 0)
			armour = _("iron");
		else if($SM.get('stores["l armour"]', true) > 0)
			armour = _("leather");
		var aRow = $('#armourRow');
		if(aRow.length === 0) {
			aRow = $('<div>').attr('id', 'armourRow').addClass('outfitRow').prependTo(outfit);
			$('<div>').addClass('row_key').text(_('armour')).appendTo(aRow);
			$('<div>').addClass('row_val').text(armour).appendTo(aRow);
			$('<div>').addClass('clear').appendTo(aRow);
		} else {
			$('.row_val', aRow).text(armour);
		}
		
		// Add the water row
		var wRow = $('#waterRow');
		if(wRow.length === 0) {
			wRow = $('<div>').attr('id', 'waterRow').addClass('outfitRow').insertAfter(aRow);
			$('<div>').addClass('row_key').text(_('water')).appendTo(wRow);
			$('<div>').addClass('row_val').text(World.getMaxWater()).appendTo(wRow);
			$('<div>').addClass('clear').appendTo(wRow);
		} else {
			$('.row_val', wRow).text(World.getMaxWater());
		}
		
		var space = Path.getFreeSpace();
		var currentBagCapacity = 0;
		// Add the non-craftables to the craftables
		var carryable = $.extend({
			'cured meat': { type: 'tool', desc: _('restores') + ' ' + World.MEAT_HEAL + ' ' + _('hp') },
			'wisteria bullet': { type: 'tool', desc: _('use with rifle') },
			'wisteria bomb': {type: 'weapon' },
			'kusarigama': {type: 'weapon' },
			'nichirin gun': {type: 'weapon' },
			'solar crystal': {type: 'tool', desc: _('emits a soft red glow') },
			'nichirin spear': {type: 'weapon' },
			'wisteria charm': { type: 'tool', desc: _('reduces hostile encounter rate; each crumbles when one is averted') },
			'demon stone': { type: 'tool' },
			'medicine': {type: 'tool', desc: _('restores') + ' ' + World.MEDS_HEAL + ' ' + _('hp') }
		}, Room.Craftables, Fabricator.Craftables);
		
		for(var k in carryable) {
			var lk = _(k);
			var store = carryable[k];
			var have = $SM.get('stores["'+k+'"]');
			var num = Path.outfit[k];
			num = typeof num == 'number' ? num : 0;
			if (have !== undefined) {
				if (have < num) { num = have; }
				$SM.set(k, num, true);
			}

			var row = $('div#outfit_row_' + k.replace(/ /g, '-'), outfit);
			if((store.type == 'tool' || store.type == 'weapon') && have > 0) {
				currentBagCapacity += num * Path.getWeight(k);
				if(row.length === 0) {
					row = Path.createOutfittingRow(k, num, store, store.name);
					
					var curPrev = null;
					outfit.children().each(function(i) {
						var child = $(this);
						if(child.attr('id').indexOf('outfit_row_') === 0) {
							var cName = child.children('.row_key').text();
							if(cName < lk) {
								curPrev = child.attr('id');
							}
						}
					});
					if(curPrev == null) {
						row.insertAfter(wRow);
					} else {
						row.insertAfter(outfit.find('#' + curPrev));
					}
				} else {
					$('div#' + row.attr('id') + ' > div.row_val > span', outfit).text(num);
					$('div#' + row.attr('id') + ' .tooltip .numAvailable', outfit).text(have - num);
				}
				if(num === 0) {
					$('.dnBtn', row).addClass('disabled');
					$('.dnManyBtn', row).addClass('disabled');
				} else {
					$('.dnBtn', row).removeClass('disabled');
					$('.dnManyBtn', row).removeClass('disabled');
				}
				if(num == have || space < Path.getWeight(k)) {
					$('.upBtn', row).addClass('disabled');
					$('.upManyBtn', row).addClass('disabled');
				} else {
					$('.upBtn', row).removeClass('disabled');
					$('.upManyBtn', row).removeClass('disabled');
				}
			} else if(have === 0 && row.length > 0) {
				row.remove();
			}
		}

		Path.updateBagSpace(currentBagCapacity);

	},

	updateBagSpace: function(currentBagCapacity) {
		// Update bagspace
		$('#bagspace').text(_('free {0}/{1}', Math.floor(Path.getCapacity() - currentBagCapacity) , Path.getCapacity()));

		if(Path.outfit['cured meat'] > 0) {
			Button.setDisabled($('#embarkButton'), false);
		} else {
			Button.setDisabled($('#embarkButton'), true);
		}

	},
	
	createOutfittingRow: function(key, num, store) {
		if(!store.name) store.name = _(key);
		var row = $('<div>').attr('id', 'outfit_row_' + key.replace(/ /g, '-')).addClass('outfitRow').attr('key',key);
		$('<div>').addClass('row_key').text(store.name).appendTo(row);
		var val = $('<div>').addClass('row_val').appendTo(row);
		
		$('<span>').text(num).appendTo(val);
		$('<div>').addClass('upBtn').appendTo(val).click([1], Path.increaseSupply);
		$('<div>').addClass('dnBtn').appendTo(val).click([1], Path.decreaseSupply);
		$('<div>').addClass('upManyBtn').appendTo(val).click([10], Path.increaseSupply);
		$('<div>').addClass('dnManyBtn').appendTo(val).click([10], Path.decreaseSupply);
		$('<div>').addClass('clear').appendTo(row);
		
		var numAvailable = $SM.get('stores["'+key+'"]', true);
		var tt = $('<div>').addClass('tooltip bottom right').appendTo(row);

		if(store.type == 'weapon') {
			$('<div>').addClass('row_key').text(_('damage')).appendTo(tt);
			$('<div>').addClass('row_val').text(World.getDamage(key)).appendTo(tt);
		} else if(store.type == 'tool' && store.desc != "undefined") {
			$('<div>').addClass('row_key').text(store.desc).appendTo(tt);
		}

		$('<div>').addClass('row_key').text(_('weight')).appendTo(tt);
		$('<div>').addClass('row_val').text(Path.getWeight(key)).appendTo(tt);
		$('<div>').addClass('row_key').text(_('available')).appendTo(tt);
		$('<div>').addClass('row_val').addClass('numAvailable').text(numAvailable).appendTo(tt);
		
		return row;
	},
	
	increaseSupply: function(btn) {
		var supply = $(this).closest('.outfitRow').attr('key');
		Engine.log('increasing ' + supply + ' by up to ' + btn.data);
		var cur = Path.outfit[supply];
		cur = typeof cur == 'number' ? cur : 0;
		if(Path.getFreeSpace() >= Path.getWeight(supply) && cur < $SM.get('stores["'+supply+'"]', true)) {
			var maxExtraByWeight = Math.floor(Path.getFreeSpace() / Path.getWeight(supply));
			var maxExtraByStore  = $SM.get('stores["'+supply+'"]', true) - cur;
			Path.outfit[supply] = cur + Math.min(btn.data, maxExtraByWeight, maxExtraByStore);
			$SM.set('outfit['+supply+']', Path.outfit[supply]);
			Path.updateOutfitting();
		}
	},
	
	decreaseSupply: function(btn) {
		var supply = $(this).closest('.outfitRow').attr('key');
		Engine.log('decreasing ' + supply + ' by up to ' + btn.data);
		var cur = Path.outfit[supply];
		cur = typeof cur == 'number' ? cur : 0;
		if(cur > 0) {
			Path.outfit[supply] = Math.max(0, cur - btn.data);
			$SM.set('outfit['+supply+']', Path.outfit[supply]);
			Path.updateOutfitting();
		}
	},

	// 一键装满：优先保证干肉，然后每种武器装1把，最后按重量升序充满消耗品/弹药
	autoFillSupplies: function() {
		if(!Path.outfit) Path.outfit = {};

		var carryable = $.extend({
			'cured meat': { type: 'tool' },
			'wisteria bullet': { type: 'tool' },
			'wisteria bomb': { type: 'weapon' },
			'kusarigama': { type: 'weapon' },
			'nichirin gun': { type: 'weapon' },
			'solar crystal': { type: 'tool' },
			'nichirin spear': { type: 'weapon' },
			'wisteria charm': { type: 'tool' },
			'demon stone': { type: 'tool' },
			'medicine': { type: 'tool' }
		}, Room.Craftables, Fabricator.Craftables);

		var weapons = [];
		var tools = [];
		for(var k in carryable) {
			var store = carryable[k];
			if(store.type !== 'tool' && store.type !== 'weapon') continue;
			var have = $SM.get('stores["'+k+'"]', true);
			if(have <= 0) continue;
			var item = { key: k, have: have, weight: Path.getWeight(k) };
			if(store.type === 'weapon') weapons.push(item);
			else tools.push(item);
		}
		weapons.sort(function(a, b) { return a.weight - b.weight; });
		tools.sort(function(a, b) { return a.weight - b.weight; });

		// 1. 保底五份干肉（出征门槛）
		var meatHave = $SM.get('stores["cured meat"]', true);
		if(meatHave > 0) {
			var curMeat = Path.outfit['cured meat'] || 0;
			var meatWeight = Path.getWeight('cured meat');
			var meatTarget = Math.min(5, meatHave);
			if(curMeat < meatTarget) {
				var addable = Math.min(meatTarget - curMeat, Math.floor(Path.getFreeSpace() / meatWeight));
				if(addable > 0) Path.outfit['cured meat'] = curMeat + addable;
			}
		}

		// 2. 每种武器装 1 把（轻量优先）
		for(var i = 0; i < weapons.length; i++) {
			var w = weapons[i];
			var curW = Path.outfit[w.key] || 0;
			if(curW >= 1) continue;
			if(Path.getFreeSpace() >= w.weight && curW < w.have) {
				Path.outfit[w.key] = curW + 1;
			}
		}

		// 3. 按重量升序充满所有消耗品/弹药
		for(var j = 0; j < tools.length; j++) {
			var t = tools[j];
			var curT = Path.outfit[t.key] || 0;
			var space = Path.getFreeSpace();
			if(space < t.weight) continue;
			var maxByWeight = Math.floor(space / t.weight);
			var maxByStore = t.have - curT;
			var addable = Math.min(maxByWeight, maxByStore);
			if(addable > 0) {
				Path.outfit[t.key] = curT + addable;
			}
		}

		// 4. 持久化
		for(var k2 in Path.outfit) {
			$SM.set('outfit['+k2+']', Path.outfit[k2]);
		}
		Path.updateOutfitting();
	},
	
	onArrival: function(transition_diff) {
		Path.setTitle();
		Path.updateOutfitting();
		Path.updatePerks(true);
		
		AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_DUSTY_PATH);

		Engine.moveStoresView($('#perks'), transition_diff);
	},
	
	setTitle: function() {
		document.title = _('A Dusty Path');
	},
	
	embark: function() {
		// 远征快照：记录出发时的 outfit 与 stores 快照，供回到村里时对比出结算
		$SM.set('previous.embarkSnapshot', {
			outfit: JSON.parse(JSON.stringify(Path.outfit || {})),
			stores: JSON.parse(JSON.stringify($SM.get('stores') || {}))
		}, true);
		if (!Engine.options.testerMode) {
			for(var k in Path.outfit) {
				$SM.add('stores["'+k+'"]', -Path.outfit[k]);
			}
		}
		// 记录出征次数
		$SM.add('game.embarks', 1);
		World.onArrival();
		$('#outerSlider').animate({left: '-700px'}, 300);
		Engine.activeModule = World;
		AudioEngine.playSound(AudioLibrary.EMBARK);
	},
	
	handleStateUpdates: function(e){
		if(e.category == 'character' && e.stateName.indexOf('character.perks') === 0 && Engine.activeModule == Path){
			Path.updatePerks();
		} else if(e.category == 'income' && Engine.activeModule == Path){
			Path.updateOutfitting();
		}
	}
};
