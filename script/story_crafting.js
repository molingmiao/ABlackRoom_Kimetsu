/* Explicit, one-off manor commissions for marked story choices, not expedition resupply. */
var StoryCrafting = window.StoryCrafting = {
	quantity: function(value) {
		return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
	},
	// Reuse the live recipes so story commissions cannot drift from ordinary crafting.
	recipe: function(item) {
		if (item === 'flame blade' || item === 'energy blade' || (window.NichirinForge && NichirinForge.items[item])) return null;
		var recipe = Room.Craftables[item];
		if (recipe && ['good', 'tool', 'weapon'].indexOf(recipe.type) >= 0) {
			if ($SM.get('game.builder.level', true) < 4 ||
				$SM.get('game.temperature.value', true) <= Room.TempEnum.Cold.value ||
				(Room.needsWorkshop(recipe.type) && !$SM.get('game.buildings.workshop', true))) return null;
			return { cost: recipe.cost(), quantity: 1, maximum: recipe.maximum };
		}
		if (typeof Fabricator !== 'undefined' && $SM.get('features.location.fabricator')) {
			recipe = Fabricator.Craftables[item];
			if (recipe && ['good', 'tool', 'weapon'].indexOf(recipe.type) >= 0 && Fabricator.canFabricate(item)) {
				return { cost: recipe.cost(), quantity: recipe.quantity || 1, maximum: recipe.maximum };
			}
		}
		var production = {
			'cured meat': ['smokehouse', 'charcutier'],
			'leather': ['tannery', 'tanner'],
			'steel': ['steelworks', 'steelworker']
		}[item];
		if (!production || !$SM.get('game.buildings["' + production[0] + '"]', true)) return null;
		var income = Outside._INCOME[production[1]].stores, cost = {};
		Object.keys(income).forEach(function(key) { if (income[key] < 0) cost[key] = -income[key]; });
		return { cost: cost, quantity: income[item] };
	},
	context: function(id) {
		var event = Events.activeEvent(), scene = event && event.scenes[Events.activeScene];
		if (!event || event.ending || !event.storySupply || !scene ||
			Engine.activeModule === Space || (scene.combat && !(Events.won && Events.fought))) return null;
		var info = scene.buttons && scene.buttons[id];
		if (!info || !info.cost || info.storySupply === false ||
			(typeof info.available === 'function' && !info.available())) return null;
		return { event: event, scene: scene, info: info, module: Engine.activeModule, version: Events.sceneVersion };
	},
	plan: function(info) {
		var world = Engine.activeModule === World, original = $SM.get('stores') || {};
		var home = {}, pool = {}, outfit = Object.assign({}, Path.outfit || {});
		Object.keys(original).forEach(function(key) { home[key] = pool[key] = StoryCrafting.quantity(original[key]); });
		var plan = { missing: [], craft: [], take: [], costs: {}, stores: home, outfit: outfit, ready: true, reason: '' };
		var cost = Events.getChoiceCost(info), pending = [];
		// Reserve ALL directly requested goods before spending any shared ingredient.
		Object.keys(cost).forEach(function(item) {
			var needed = cost[item], have = StoryCrafting.quantity(Events.getQuantity(item));
			if (!Number.isSafeInteger(needed) || needed < 0 || needed > 10000) {
				plan.reason = '剧情需求数量无效'; return;
			}
			if (have < needed) plan.missing.push({ item: item, quantity: needed - have });
			if (item === 'hp' || item === 'water') {
				if (have < needed) plan.reason = '生命和饮水不能通过庄园代制补齐';
				return;
			}
			if (!world) pool[item] = Math.max(0, (pool[item] || 0) - Math.min(have, needed));
			if (have >= needed) return;
			var missing = needed - have, take = world ? Math.min(pool[item] || 0, missing) : 0;
			if (take) {
				pool[item] -= take; home[item] -= take;
				outfit[item] = have + take;
				plan.take.push({ item: item, quantity: take });
			}
			if (missing > take) pending.push({ item: item, quantity: missing - take });
		});
		pending.forEach(function(request) {
			if (plan.reason) return;
			var recipe = StoryCrafting.recipe(request.item);
			if (!recipe) { plan.reason = _(request.item) + '：庄园库存不足，且没有已解锁的代制配方'; return; }
			var batches = Math.ceil(request.quantity / recipe.quantity), produced = batches * recipe.quantity;
			if (!Number.isSafeInteger(produced) || produced < request.quantity) { plan.reason = '制作数量无效'; return; }
			if (typeof recipe.maximum === 'number' &&
				(home[request.item] || 0) + (world ? StoryCrafting.quantity(outfit[request.item]) : 0) + produced > recipe.maximum) {
				plan.reason = _(request.item) + '已达制作上限'; return;
			}
			var inputs = {};
			Object.keys(recipe.cost).forEach(function(item) {
				var amount = recipe.cost[item] * batches;
				if (!Number.isSafeInteger(amount) || amount < 0) { plan.reason = '制作配方无效'; return; }
				inputs[item] = amount;
				plan.costs[item] = (plan.costs[item] || 0) + amount;
				if ((pool[item] || 0) < amount) plan.reason = '庄园缺' + _(item) + '×' + (amount - (pool[item] || 0));
			});
			plan.craft.push({ item: request.item, quantity: produced, deliver: request.quantity, costs: inputs });
			if (plan.reason) return;
			Object.keys(inputs).forEach(function(item) { pool[item] -= inputs[item]; home[item] -= inputs[item]; });
			if (world) outfit[request.item] = StoryCrafting.quantity(outfit[request.item]) + request.quantity;
			var extra = world ? produced - request.quantity : produced;
			home[request.item] = (home[request.item] || 0) + extra;
			// Only surplus may be used by another recipe; required goods remain reserved.
			pool[request.item] = (pool[request.item] || 0) + produced - request.quantity;
		});
		if (world && !plan.reason) {
			var weight = Object.keys(outfit).reduce(function(sum, item) {
				return sum + StoryCrafting.quantity(outfit[item]) * Path.getWeight(item);
			}, 0);
			if (weight > Path.getCapacity() + 0.000001) plan.reason = '背包空间不足，请先丢弃物品腾出空间';
		}
		Object.keys(home).forEach(function(item) {
			if (!Number.isFinite(home[item]) || home[item] < 0 || home[item] > $SM.MAX_STORE) plan.reason = '庄园库存超出可制作范围';
		});
		plan.ready = plan.missing.length > 0 && !plan.reason;
		return plan;
	},
	format: function(items) {
		return items.map(function(row) { return _(row.item) + '×' + row.quantity; }).join('、');
	},
	commit: function(id, expected) {
		var current = StoryCrafting.context(id);
		// Detached/obsolete controls must not commission goods for a later scene.
		if (!current || !expected || current.event !== expected.event || current.scene !== expected.scene ||
			current.info !== expected.info || current.module !== expected.module || current.version !== expected.version) return false;
		var plan = StoryCrafting.plan(current.info);
		if (!plan.ready) { StoryCrafting.refresh(); return false; }
		// A single synchronous transaction: recheck first, publish only AFTER both inventories agree.
		$SM.setM('stores', plan.stores, true);
		if (current.module === World) {
			Path.outfit = plan.outfit;
			$SM.set('outfit', Path.outfit, true);
		}
		Engine.saveGame();
		$SM.fireUpdate('stores');
		if (current.module === World) { World.updateSupplies(); $SM.fireUpdate('outfit'); }
		Notifications.notify(null, '庄园已补齐本次剧情所需物品。点击原剧情选项即可继续。');
		StoryCrafting.refresh();
		return true;
	},
	refresh: function() {
		var event = Events.activeEvent();
		if (!event) return;
		var panel = Events.eventPanel();
		if (!panel || !panel.length) return;
		var area = panel.find('.storySupplies'), scene = event.scenes[Events.activeScene];
		var candidates = [];
		if (scene && scene.buttons) Object.keys(scene.buttons).forEach(function(id) {
			var context = StoryCrafting.context(id);
			if (!context) return;
			var plan = StoryCrafting.plan(context.info);
			if (plan.missing.length) candidates.push({ id: id, context: context, plan: plan });
		});
		if (!candidates.length) { area.remove(); return; }
		if (!area.length) {
			area = $('<div>').addClass('storySupplies').appendTo(panel.find('#description'));
			$('<strong>').text('剧情缺料 · 庄园补齐').appendTo(area);
			$('<p>').addClass('storySupplyHint').text('仅补齐所选剧情需求，不采购、不自动制作前置材料；背包容量和作坊/蓝图条件仍有效。制作的整批余量留在庄园。').appendTo(area);
		}
		var ids = candidates.map(function(row) { return row.id; });
		area.children('.storySupplyChoice').each(function() { if (ids.indexOf($(this).data('choice')) < 0) $(this).remove(); });
		candidates.forEach(function(row) {
			var block = area.children('.storySupplyChoice').filter(function() { return $(this).data('choice') === row.id; });
			if (!block.length) {
				block = $('<div>').addClass('storySupplyChoice').data('choice', row.id).appendTo(area);
				$('<strong>').addClass('storySupplyTitle').appendTo(block);
				$('<p>').addClass('storySupplyDetails').appendTo(block);
				$('<button type="button">').addClass('storySupplyAction').appendTo(block).on('click', function(e) {
					e.stopPropagation(); StoryCrafting.commit(row.id, row.context);
				});
			}
			var plan = row.plan, details = ['尚缺：' + StoryCrafting.format(plan.missing)];
			if (plan.take.length) details.push('从庄园调取：' + StoryCrafting.format(plan.take));
			if (plan.craft.length) details.push('代制：' + StoryCrafting.format(plan.craft));
			if (Object.keys(plan.costs).length) details.push('消耗庄园材料：' + StoryCrafting.format(Object.keys(plan.costs).map(function(item) { return { item: item, quantity: plan.costs[item] }; })));
			if (plan.reason) details.push('暂不能补齐：' + plan.reason);
			block.find('.storySupplyTitle').text('为「' + row.context.info.text + '」补齐');
			block.find('.storySupplyDetails').text(details.join('\n'));
			block.find('.storySupplyAction').text(plan.craft.length ? '庄园代制并补齐' : '调取庄园物品').prop('disabled', !plan.ready);
		});
	}
};
