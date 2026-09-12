/** Read-only production diagnostics and expedition preparation. */
var CampGuide = {
  weaponPreview: function(key, slots, index, definitions, stock) {
    var weapon = definitions[key];
    if (!weapon) return null;
    var next = slots.slice();
    next[index] = key;
    next = next.map(function(item, i) {return i !== index && item === key ? null : item;});
    var shared = next.reduce(function(max, item) {return Math.max(max, definitions[item] ? definitions[item].cooldown : 0);}, 0);
    var uses = null;
    Object.keys(weapon.cost || {}).forEach(function(ammo) {
      var count = Math.floor(Math.max(0, stock[ammo] || 0) / weapon.cost[ammo]);
      uses = uses === null ? count : Math.min(uses, count);
    });
    return {damage:weapon.damage, cooldown:weapon.cooldown, shared:shared, uses:uses, slots:next};
  },
  weaponOptionText: function(key, category, index) {
    var slots = Path.getEquippedSlots(category), current = World.Weapons[slots[index]];
    var preview = CampGuide.weaponPreview(key, slots, index, World.Weapons, $SM.get('stores') || {});
    if (!preview) return '';
    var damageText = function(damage) {return damage === 'stun' ? _('control, not direct damage') : damage;};
    var text = [
      _('base damage: {0} → {1}', current ? damageText(current.damage) : '—', damageText(preview.damage)),
      _('base cooldown: {0}s → {1}s', current ? current.cooldown : '—', preview.cooldown),
      _('weight: {0} → {1}', current ? Path.getWeight(slots[index]) : 0, Path.getWeight(key)),
      _('other equipped weapons in this category enter a {0}s base cooldown after use.', preview.shared)
    ];
    var cost = World.Weapons[key].cost || {};
    if (preview.uses !== null) {
      text.push(_('each use consumes {0}; home stock supports {1} uses.', Object.keys(cost).map(function(item) {return _(item) + ' ×' + cost[item];}).join(' / '), preview.uses));
      if (preview.uses === 0) text.push(_('no ammunition available. equipping alone will not make this weapon usable.'));
    } else text.push(_('no ammunition needed.'));
    return text.join('\n');
  },
  production: function(incomes, stores) {
    var rows = [], net = {};
    Object.keys(incomes || {}).forEach(function(key) {
      var income = incomes[key];
      if (!income || !(income.delay > 0)) return;
      var inputs = [], outputs = [];
      Object.keys(income.stores || {}).forEach(function(item) {
        var amount = income.stores[item];
        if (!Number.isFinite(amount) || !amount) return;
        net[item] = (net[item] || 0) + amount * 60 / income.delay;
        if (amount < 0) inputs.push({item:item, amount:-amount, have:Math.max(0, stores[item] || 0)});
        else outputs.push({item:item, amount:amount});
      });
      if (inputs.length || outputs.length) rows.push({key:key, delay:income.delay, inputs:inputs, outputs:outputs,
        missing:inputs.filter(function(input) { return input.have < input.amount; })});
    });
    return {rows:rows, net:net};
  },
  productionText: function() {
    var incomes = $SM.get('income') || {}, selected = {};
    Object.keys(incomes).forEach(function(key) {
      if (Outside._INCOME[key] || key === 'builder') selected[key] = incomes[key];
    });
    var report = CampGuide.production(selected, $SM.get('stores') || {});
    var text = [_('production snapshot: recipes below are for the entire assigned group, not one worker.')];
    var format = function(items) { return items.map(function(item) {return _(item.item) + ' ×' + item.amount;}).join(' / ') || _('none'); };
    report.rows.forEach(function(row) {
      text.push(_('{0}: every {1}s, consume {2}; produce {3}.', row.key === 'builder' ? _('Shinobu') : _(row.key), row.delay, format(row.inputs), format(row.outputs)));
      if (row.missing.length) {
        text.push(_('not enough for one group batch: {0}. reduce this assignment or supply its inputs.', row.missing.map(function(item) {
          return _('{0}: {1}/{2}', _(item.item), item.have, item.amount);
        }).join(' / ')));
      }
    });
    if (!report.rows.length) text.push(_('no active production yet. house survivors and assign available jobs first.'));
    var rates = Object.keys(report.net).filter(function(item) {return Math.abs(report.net[item]) > 0.001;}).map(function(item) {
      var value = Math.round(report.net[item] * 10) / 10;
      return _(item) + ' ' + (value > 0 ? '+' : '') + value;
    });
    if (rates.length) text.push(_('planned net change per minute: {0}', rates.join(' / ')));
    text.push(_('planned rates assume full inputs and exclude manual gathering and random events. groups compete for materials; a short group batch produces nothing.'));
    return text;
  },
  showProduction: function() {
    if (Events.activeEvent()) return;
    Events.startEvent({title:_('production overview'), scenes:{start:{text:CampGuide.productionText(),buttons:{
      refresh:{text:_('refresh production snapshot'), nextScene:{1:'start'}},
      close:{text:_('close'), nextScene:'end'}
    }, onLoad:function() { Events.activeEvent().scenes.start.text = CampGuide.productionText(); }}}});
    Events.eventPanel().addClass('productionOverview');
  },
  expedition: function(outfit, stores, equipped, weapons, capacity, weight, tester) {
    var errors = [], warnings = [], ready = [];
    var load = 0;
    Object.keys(outfit || {}).forEach(function(item) {
      var amount = outfit[item];
      if (!Number.isInteger(amount) || amount < 0) { errors.push(_('invalid backpack quantity: {0}. adjust your backpack before departure.', _(item))); return; }
      if (!tester && amount > (stores[item] || 0)) errors.push(_('not enough stock for {0}: packed {1}, available {2}.', _(item), amount, stores[item] || 0));
      load += weight(item) * amount;
    });
    if (load > capacity) errors.push(_('backpack is over capacity. remove supplies before departing.'));
    if (!(outfit['cured meat'] > 0)) errors.push(_('pack cured meat before departing. it feeds you on the road and heals wounds.'));
    else if (outfit['cured meat'] < 5) warnings.push(_('only {0} cured meat packed. travel and healing share this supply; keep the first trip short.', outfit['cured meat']));
    equipped.forEach(function(key) {
      if (!weapons[key]) return;
      if (!(outfit[key] > 0)) { warnings.push(_('equipped but not packed: {0}.', _(key))); return; }
      var usable = true;
      Object.keys(weapons[key].cost || {}).forEach(function(ammo) {
        if (!(outfit[ammo] >= weapons[key].cost[ammo])) { usable = false; warnings.push(_('no ammunition for {0}: pack {1}.', _(key), _(ammo))); }
      });
      if (usable && typeof weapons[key].damage === 'number' && weapons[key].damage > 0) ready.push(key);
    });
    if (!ready.length) warnings.push(_('no usable damaging weapon packed. you will need to fight with your fists.'));
    return {errors:errors, warnings:warnings, ready:ready};
  },
  expeditionInfo: function() {
    var equipped = [];
    ['primary','secondary','tool'].forEach(function(cat) { equipped = equipped.concat(Path.getEquipped(cat)); });
    Object.keys(World.Weapons).forEach(function(key) {
      if (!Path.getWeaponCategory(key) && Path.outfit[key] > 0 && equipped.indexOf(key) < 0) equipped.push(key);
    });
    return CampGuide.expedition(Path.outfit || {}, $SM.get('stores') || {}, equipped, World.Weapons, Path.getCapacity(), Path.getWeight, Engine.options.testerMode);
  }
};
