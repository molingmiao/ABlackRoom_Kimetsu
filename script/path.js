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

	// 装备槽系统：主/副/道具 3 类 × 2 槽，同类上阵后共享冷却
	SLOT_LIMIT: 2,
	WeaponCategory: {
		primary:   ['bone yari','kou katana','nichirin katana','nichirin spear','flame blade'],
		secondary: ['wisteria gun','nichirin gun','thunder gun','wisteria bomb'],
		tool:      ['kusarigama','bind kunai']
	},
	CATEGORY_LABELS: {
		primary:   'primary',
		secondary: 'secondary',
		tool:      'tool'
	},
	getWeaponCategory: function(key) {
		for (var cat in Path.WeaponCategory) {
			if (Path.WeaponCategory[cat].indexOf(key) >= 0) return cat;
		}
		return null;
	},
	getEquippedSlots: function(category) {
		var e = $SM.get('character.equipped["'+category+'"]');
		if (!Array.isArray(e)) e = [];
		e = e.slice();
		while (e.length < Path.SLOT_LIMIT) e.push(null);
		return e;
	},
	getEquipped: function(category) {
		return Path.getEquippedSlots(category).filter(function(k) { return k != null; });
	},
	isEquipped: function(key) {
		var cat = Path.getWeaponCategory(key);
		if (!cat) return false;
		return Path.getEquipped(cat).indexOf(key) >= 0;
	},
	unequipItem: function(key) {
		var cat = Path.getWeaponCategory(key);
		if (!cat) return;
		var eq = Path.getEquippedSlots(cat).slice();
		var changed = false;
		for (var i = 0; i < eq.length; i++) {
			if (eq[i] === key) { eq[i] = null; changed = true; }
		}
		if (changed) {
			$SM.set('character.equipped["'+cat+'"]', eq);
			Path.updateEquipDoll();
		}
	},
	setEquipSlot: function(category, slotIndex, weaponKey) {
		var eq = Path.getEquippedSlots(category);
		eq[slotIndex] = weaponKey || null;
		if (weaponKey) {
			for (var i = 0; i < eq.length; i++) {
				if (i !== slotIndex && eq[i] === weaponKey) eq[i] = null;
			}
		}
		$SM.set('character.equipped["'+category+'"]', eq);
		Path.updateEquipDoll();
		Path.updateOutfitting();
	},
	autoEquip: function() {
		if ($SM.get('character.equippedInit')) return;
		Path.autoEquipStrongest();
		$SM.set('character.equippedInit', true, true);
	},
	autoEquipStrongest: function() {
		for (var cat in Path.WeaponCategory) {
			var candidates = Path.WeaponCategory[cat].filter(function(k) {
				return $SM.get('stores["'+k+'"]', true) > 0;
			});
			candidates.sort(function(a, b) {
				var da = World.Weapons[a] ? World.Weapons[a].damage : 0;
				var db = World.Weapons[b] ? World.Weapons[b].damage : 0;
				if (da === 'stun') da = 100;
				if (db === 'stun') db = 100;
				return db - da;
			});
			var eq = candidates.slice(0, Path.SLOT_LIMIT);
			while (eq.length < Path.SLOT_LIMIT) eq.push(null);
			$SM.set('character.equipped["'+cat+'"]', eq, true);
		}
	},
	updateEquipDoll: function() {
		var doll = $('#equipDoll');
		if (doll.length === 0) return;

		// 联动清理：stores=0 的装备槽自动卸下
		for (var _cat in Path.WeaponCategory) {
			var _eq = Path.getEquippedSlots(_cat).slice();
			var _changed = false;
			for (var _i = 0; _i < _eq.length; _i++) {
				if (_eq[_i] && !($SM.get('stores["'+_eq[_i]+'"]', true) > 0)) {
					_eq[_i] = null;
					_changed = true;
				}
			}
			if (_changed) $SM.set('character.equipped["'+_cat+'"]', _eq, true);
		}

		var body = doll.find('.equipDollBody');
		if (body.length === 0) {
			body = $('<div>').addClass('equipDollBody').appendTo(doll);
		}
		body.empty();

		// 护甲行（带 +HP 数值）
		var armourName = _('none');
		var armourHp = 0;
		if ($SM.get('stores["wind armour"]', true) > 0) { armourName = _('wind armour'); armourHp = 75; }
		else if ($SM.get('stores["s armour"]', true) > 0) { armourName = _('s armour'); armourHp = 35; }
		else if ($SM.get('stores["i armour"]', true) > 0) { armourName = _('i armour'); armourHp = 15; }
		else if ($SM.get('stores["l armour"]', true) > 0) { armourName = _('l armour'); armourHp = 5; }
		var armourLabel = armourHp > 0 ? armourName + ' (+' + armourHp + ' hp)' : armourName;
		var armourRow = $('<div>').addClass('equipRow cat-armour').appendTo(body);
		$('<div>').addClass('equipRowLabel').text(_('armour')).appendTo(armourRow);
		$('<div>').addClass('equipSlot filled').css({'flex':'1','cursor':'default','border-style':'solid'}).text(armourLabel).appendTo(armourRow);

		// 载具行（带容量）
		var bagName = _('none');
		var bagCap = Path.DEFAULT_BAG_SPACE;
		if ($SM.get('stores["cargo crow"]', true) > 0) { bagName = _('cargo crow'); bagCap = Path.DEFAULT_BAG_SPACE + 100; }
		else if ($SM.get('stores.convoy', true) > 0) { bagName = _('convoy'); bagCap = Path.DEFAULT_BAG_SPACE + 60; }
		else if ($SM.get('stores.wagon', true) > 0) { bagName = _('wagon'); bagCap = Path.DEFAULT_BAG_SPACE + 30; }
		else if ($SM.get('stores.rucksack', true) > 0) { bagName = _('rucksack'); bagCap = Path.DEFAULT_BAG_SPACE + 10; }
		var bagRow = $('<div>').addClass('equipRow cat-bag').appendTo(body);
		$('<div>').addClass('equipRowLabel').text(_('carry')).appendTo(bagRow);
		$('<div>').addClass('equipSlot filled').css({'flex':'1','cursor':'default','border-style':'solid'}).text(bagName + ' (' + bagCap + ')').appendTo(bagRow);

		// 水容器行（带上限）
		var waterName = _('none');
		var waterCap = World.BASE_WATER;
		if ($SM.get('stores["water cycle"]', true) > 0) { waterName = _('water cycle'); waterCap = World.BASE_WATER + 100; }
		else if ($SM.get('stores["water tank"]', true) > 0) { waterName = _('water tank'); waterCap = World.BASE_WATER + 50; }
		else if ($SM.get('stores.cask', true) > 0) { waterName = _('cask'); waterCap = World.BASE_WATER + 20; }
		else if ($SM.get('stores.waterskin', true) > 0) { waterName = _('waterskin'); waterCap = World.BASE_WATER + 10; }
		var waterRow = $('<div>').addClass('equipRow cat-water').appendTo(body);
		$('<div>').addClass('equipRowLabel').text(_('water')).appendTo(waterRow);
		$('<div>').addClass('equipSlot filled').css({'flex':'1','cursor':'default','border-style':'solid'}).text(waterName + ' (' + waterCap + ')').appendTo(waterRow);

		$('<div>').addClass('equipDollSep').appendTo(body);

		['primary','secondary','tool'].forEach(function(cat) {
			var slots = Path.getEquippedSlots(cat);
			var rowDiv = $('<div>').addClass('equipRow cat-'+cat).appendTo(body);
			$('<div>').addClass('equipRowLabel').text(_(Path.CATEGORY_LABELS[cat])).appendTo(rowDiv);
			for (var i = 0; i < Path.SLOT_LIMIT; i++) {
				(function(idx) {
					var key = slots[idx];
					var slot = $('<div>').addClass('equipSlot').attr('data-cat', cat).attr('data-slot', idx);
					if (key) {
						slot.addClass('filled').attr('title', _(key)).text(_(key));
						var wDef = World.Weapons[key];
						var dmg = wDef ? wDef.damage : 0;
						var tier;
						if (dmg === 'stun') tier = 5;
						else if (dmg <= 2) tier = 1;
						else if (dmg <= 5) tier = 2;
						else if (dmg <= 8) tier = 3;
						else if (dmg <= 12) tier = 4;
						else tier = 5;
						slot.addClass('weapon-tier-'+tier);
					} else {
						slot.addClass('empty').text('—');
					}
					slot.on('click', function(e) {
						e.stopPropagation();
						Path.showEquipPicker($(this), cat, idx);
					});
					slot.appendTo(rowDiv);
				})(i);
			}
		});
	},
	showEquipPicker: function(slotEl, category, slotIndex) {
		$('.equipPickerBackdrop, .equipPicker').remove();
		var backdrop = $('<div>').addClass('equipPickerBackdrop').appendTo('body');
		var picker = $('<div>').addClass('equipPicker');
		picker.on('mousedown click', function(e) { e.stopPropagation(); });
		var close = function() { backdrop.remove(); picker.remove(); };
		backdrop.on('mousedown', function(e) { e.stopPropagation(); close(); });
		var currentKey = Path.getEquippedSlots(category)[slotIndex];
		if (currentKey) {
			$('<div>').addClass('pickerOption unequip').text(_('— unequip —')).on('click', function(e) {
				e.stopPropagation();
				Path.setEquipSlot(category, slotIndex, null);
				close();
			}).appendTo(picker);
		}
		Path.WeaponCategory[category].forEach(function(k) {
			var have = $SM.get('stores["'+k+'"]', true) || 0;
			if (have <= 0) return;
			if (k === currentKey) return;
			var opt = $('<div>').addClass('pickerOption').text(_(k)).on('click', function(e) {
				e.stopPropagation();
				Path.setEquipSlot(category, slotIndex, k);
				close();
			});
			var wDef = World.Weapons[k];
			if (wDef) {
				var dmg = wDef.damage;
				var tier;
				if (dmg === 'stun') tier = 5;
				else if (dmg <= 2) tier = 1;
				else if (dmg <= 5) tier = 2;
				else if (dmg <= 8) tier = 3;
				else if (dmg <= 12) tier = 4;
				else tier = 5;
				opt.addClass('weapon-tier-' + tier);
			}
			opt.appendTo(picker);
		});
		if (picker.children().length === 0) {
			$('<div>').addClass('pickerOption disabled').text(_('nothing to equip')).appendTo(picker);
		}
		var rect = slotEl[0].getBoundingClientRect();
		picker.css({
			position: 'fixed',
			top: rect.bottom + 2,
			left: rect.left,
			right: 'auto',
			width: Math.max(120, rect.width)
		});
		$('body').append(picker);
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
		var suppliesRow = $('<div>').attr('id', 'suppliesRow').appendTo(this.scroller);
		var outfitting = $('<div>').attr({'id': 'outfitting', 'data-legend': _('supplies:')}).appendTo(suppliesRow);
		$('<div>').attr('id', 'bagspace').appendTo(outfitting);

		// 装备栏：3 类×2 槽（主武器/副武器/道具）
		$('<div>').attr({'id': 'equipDoll', 'data-legend': _('equipment')}).appendTo(suppliesRow);

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
				if (r.length && $SM.get('character.perksNew["'+k+'"]')) {
					r.addClass('new-perk');
					r.off('click.perkNew').on('click.perkNew', (function(pk) {
						return function() {
							$(this).removeClass('new-perk');
							$SM.remove('character.perksNew["'+pk+'"]', true);
						};
					})(k));
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
		Path.autoEquip();
		Path.updateEquipDoll();
		var outfit = $('div#outfitting');
		
		if(!Path.outfit) {
			Path.outfit = {};
		}
		
		// Add the armour row
		// 护甲/水已移到装备栏（equipDoll）；仍需一个错点导致后面 outfit 行插入位置——直接用 outfit 容器顶部
		// 清除旧的 armourRow / waterRow（先前版本存档可能还在）
		$('#armourRow, #waterRow', outfit).remove();

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

		// 分类排序：武器按伤害降序 → 消耗品按名称升序
		var weaponKeys = [], toolKeys = [];
		for (var ck in carryable) {
			var ct = carryable[ck].type;
			var ch = $SM.get('stores["'+ck+'"]');
			if ((ct !== 'tool' && ct !== 'weapon') || !(ch > 0)) continue;
			if (ct === 'weapon') weaponKeys.push(ck);
			else toolKeys.push(ck);
		}
		weaponKeys.sort(function(a, b) {
			var da = World.Weapons[a] ? World.Weapons[a].damage : 0;
			var db = World.Weapons[b] ? World.Weapons[b].damage : 0;
			if (da === 'stun') da = 100;
			if (db === 'stun') db = 100;
			return db - da;
		});
		toolKeys.sort(function(a, b) { return _(a).localeCompare(_(b)); });
		var sortedKeys = weaponKeys.concat(toolKeys);

		// 分隔线：武器和消耗品之间
		var sepId = 'outfit_separator';
		if (weaponKeys.length > 0 && toolKeys.length > 0) {
			if ($('#' + sepId, outfit).length === 0) {
				// 分隔线在第一次转入 toolKeys 时插入
			}
		}

		for(var si = 0; si < sortedKeys.length; si++) {
			var k = sortedKeys[si];
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
					// 按 sortedKeys 顺序：找到前一个已存在的行，插在其后
					var prevRow = null;
					for (var pi = si - 1; pi >= 0; pi--) {
						var prevId = 'outfit_row_' + sortedKeys[pi].replace(/ /g, '-');
						var prevEl = $('#' + prevId, outfit);
						if (prevEl.length) { prevRow = prevEl; break; }
					}
					if (prevRow) {
						row.insertAfter(prevRow);
					} else {
						row.prependTo(outfit);
					}
					// 插入分隔线：在第一个消耗品行前
					if (store.type === 'tool' && $('#' + sepId, outfit).length === 0) {
						$('<div>').attr('id', sepId).addClass('outfitSep').insertBefore(row);
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

		// 弹药子行：每把武器下方列出 cost 中的消耗品当前的 outfit 携带量
		$('.outfitRow.ammoRow', outfit).remove();
		// 移除库存已归零的物品行：sortedKeys 已过滤掉 stores<=0 的物品，
		// 主循环不会再访问它们，旧行会残留在 DOM 中（回收最后一件后需刷新才消失）——这里显式清理
		$('.outfitRow', outfit).each(function() {
			var rk = $(this).attr('key');
			if (!rk) return;
			if (!($SM.get('stores["'+rk+'"]', true) > 0)) $(this).remove();
		});
		for (var wi = 0; wi < sortedKeys.length; wi++) {
			var wk = sortedKeys[wi];
			var wDef = World.Weapons[wk];
			if (!wDef || !wDef.cost) continue;
			var wRow2 = $('#outfit_row_' + wk.replace(/ /g, '-'), outfit);
			if (wRow2.length === 0) continue;
			var lastNode = wRow2;
			for (var ammoKey in wDef.cost) {
				if (ammoKey === wk) continue;
				var ammoInBag = Path.outfit[ammoKey] || 0;
				var ammoInStore = $SM.get('stores["'+ammoKey+'"]', true) || 0;
				if (ammoInStore <= 0) continue;
				var ammoRow = $('<div>').addClass('outfitRow ammoRow');
				$('<div>').addClass('row_key').text('— ' + _(ammoKey)).appendTo(ammoRow);
				$('<div>').addClass('row_val').text(ammoInBag).appendTo(ammoRow);
				$('<div>').addClass('clear').appendTo(ammoRow);
				ammoRow.insertAfter(lastNode);
				lastNode = ammoRow;
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
		if(store.type == 'weapon') {
			var dmg = World.getDamage(key);
			var tier;
			if(dmg === 'stun') tier = 5;
			else if(dmg <= 2) tier = 1;
			else if(dmg <= 5) tier = 2;
			else if(dmg <= 8) tier = 3;
			else if(dmg <= 12) tier = 4;
			else tier = 5;
			row.addClass('weapon weapon-tier-' + tier);
		}
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

		// 回收按钮：武器/弹药/消耗品，只要能找到成本定义就可回收（30%）
		// 但不能回收正在携带的部分：仅当「库存 − 携带 > 0」时才提供回收
		var scrapCost = Path.getScrapCost(key);
		if (scrapCost && (numAvailable - num) > 0) {
			var parts = [];
			for (var mat in scrapCost) {
				var rv = Math.floor(scrapCost[mat] * 0.3);
				if (rv > 0) parts.push(_(mat) + '+' + rv);
			}
			if (parts.length > 0) {
				(function(wKey) {
					$('<div>').addClass('scrapBtn').attr('title', parts.join(' ')).text(_('scrap'))
						.on('click', function(e) {
							e.stopPropagation();
							Path.scrapItem(wKey);
						}).appendTo(row);
				})(key);
			}
		}

		return row;
	},

	// 从 Room.Craftables / Room.TradeGoods / Fabricator.Craftables 中取 cost
	getScrapCost: function(key) {
		var src = (Room.Craftables && Room.Craftables[key])
			|| (Room.TradeGoods && Room.TradeGoods[key])
			|| (Fabricator.Craftables && Fabricator.Craftables[key]);
		if (!src || typeof src.cost !== 'function') return null;
		try { return src.cost(); } catch (e) { return null; }
	},

	scrapItem: function(key) {
		var have = $SM.get('stores["'+key+'"]', true);
		if (have <= 0) return;
		// 不能回收正在携带的最后一件：回收只消耗携带量之外的富余
		var carried = (Path.outfit && typeof Path.outfit[key] === 'number') ? Path.outfit[key] : 0;
		if (have - carried <= 0) return;
		var costObj = Path.getScrapCost(key);
		if (!costObj) return;
		$SM.add('stores["'+key+'"]', -1);
		var refundText = [];
		for (var mat in costObj) {
			var rv = Math.floor(costObj[mat] * 0.3);
			if (rv > 0) {
				$SM.add('stores["'+mat+'"]', rv);
				refundText.push(_(mat) + '+' + rv);
			}
		}
		Notifications.notify(null, _('scrapped ') + _(key) + ' (' + refundText.join(', ') + ')');
		Path.updateOutfitting();
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
			// 携带数量清零时，自动卸下对应装备槽中的该物品
			if (Path.outfit[supply] <= 0) Path.unequipItem(supply);
			Path.updateOutfitting();
		}
	},

	// 一键装满：重置装备为每类最强 2 件各 1 把；消耗品按预设上限装载，不填满
	autoFillSupplies: function() {
		Path.autoEquipStrongest();

		Path.outfit = {};
		$SM.set('outfit', Path.outfit, true);

		// 1. 每类已装备的武器各 1 把
		for (var cat in Path.WeaponCategory) {
			var equipped = Path.getEquipped(cat);
			equipped.forEach(function(wKey) {
				var have = $SM.get('stores["'+wKey+'"]', true) || 0;
				if (have <= 0) return;
				Path.outfit[wKey] = 1;
				$SM.set('outfit["'+wKey+'"]', 1, true);
			});
		}

		// 2. 消耗品预设上限（受库存 & 背包空间双重约束）
		var caps = {
			'cured meat':      20,
			'wisteria bullet': 10,
			'solar crystal':   10,
			'kusarigama':      10,
			'wisteria bomb':    5,
			'torch':            5,
			'medicine':        10,
			'wisteria oil':     5
		};
		var used = 0;
		for (var uk in Path.outfit) used += (Path.outfit[uk] || 0) * Path.getWeight(uk);
		var capacity = Path.getCapacity();
		for (var itemKey in caps) {
			var target = caps[itemKey];
			var stored = $SM.get('stores["'+itemKey+'"]', true) || 0;
			var want = Math.min(target, stored);
			var weight = Path.getWeight(itemKey);
			var space = capacity - used;
			var byWeight = weight > 0 ? Math.floor(space / weight) : want;
			want = Math.min(want, byWeight);
			if (want > 0) {
				Path.outfit[itemKey] = want;
				$SM.set('outfit["'+itemKey+'"]', want, true);
				used += want * weight;
			}
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
		// 进入地图（远征）：隐藏左侧的天赋/物品/装备栏，只留地图
		$('body').addClass('world-active');
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
