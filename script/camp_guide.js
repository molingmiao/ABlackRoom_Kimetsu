/** Read-only production diagnostics and expedition preparation. */
var CampGuide = {
  discoverEnemy: function(enemy) {
    var seen = $SM.get('game.materialSourcesSeen') || [];
    if (seen.indexOf(enemy) < 0) $SM.set('game.materialSourcesSeen', seen.concat([enemy]), true);
  },
  knownMaterial: function(item) {
    return Object.prototype.hasOwnProperty.call($SM.get('stores') || {}, item) || (Path.outfit || {})[item] > 0;
  },
  materialSources: function(item) {
    var seen = $SM.get('game.materialSourcesSeen') || [];
    return (Events.Encounters || []).filter(function(event) {
      var scene = event.scenes.start;
      return seen.indexOf(scene.enemy) >= 0 && scene.loot && scene.loot[item];
    }).map(function(event) {
      var scene = event.scenes.start, drop = scene.loot[item];
      var areas = {'spider demon spawn':'距庄园 11～20 格的平原', 'water demon':'距庄园 11～20 格的森林', 'thunder demon':'距庄园超过 20 格的森林'};
      return _(scene.enemyName || scene.enemy) + (areas[scene.enemy] ? '（' + areas[scene.enemy] + '）' : '') + '：' + drop.min + '～' + Math.max(drop.min, drop.max - 1) + '，' + Math.round(drop.chance * 100) + '%';
    });
  },
  showMaterialSources: function() {
    if (Events.activeEvent()) return;
    var text = ['仅列出已持有过的材料和已遭遇的野外敌人；数量为基础掉落，不含周目加成。旧存档未记录过的敌人需再次遭遇后显示。'];
    ['scales','teeth','cloth'].filter(CampGuide.knownMaterial).forEach(function(item) {
      var sources = CampGuide.materialSources(item);
      text.push(_(item) + '：' + (sources.length ? sources.join('；') : '尚无已记录的野外来源。'));
      if ($SM.get('game.buildings.trap', true) > 0) text.push('陷阱：有概率获得，诱饵可增加收获次数。');
      if (Room.buyUnlocked(item)) text.push('交易站：已解锁购买，可在家中查看当前价格。');
      if ($SM.get('features.location.spaceShip')) text.push(item === 'scales' ? '无限城：普通战、精英、Boss 保底；宝箱额外提供。' : item === 'teeth' ? '无限城：普通战概率掉落，精英与 Boss 保底。' : '无限城：10 层起普通战概率掉落，精英与 Boss 保底。');
    });
    if (text.length === 1) text.push('尚未发现鳞片、牙齿或布料。');
    Events.startEvent({title:'材料获取途径', scenes:{start:{text:text,buttons:{close:{text:_('close'),nextScene:'end'}}}}});
    Events.eventPanel().addClass('productionOverview');
  },
  routeMaterials: function(type, floor) {
    if (['battle','elite','boss','treasure'].indexOf(type) < 0) return '';
    var loot = type === 'boss' ? Space._bossLoot(floor) : Space._battleLoot(floor, type === 'elite');
    if (type === 'treasure') {
      var tier = Math.max(0, Math.min(9, Math.floor(floor / 10)));
      loot = {scales:{min:5+tier,max:11+2*tier,chance:1}};
    }
    var parts = ['scales','teeth','cloth'].filter(CampGuide.knownMaterial).filter(function(item) {return loot[item];}).map(function(item) {
      var drop = loot[item];
      return _(item) + ' ' + drop.min + '～' + Math.max(drop.min,drop.max-1) + (drop.chance === 1 ? '（必掉）' : '（' + Math.round(drop.chance*100) + '%）');
    });
    return parts.length ? '<br><small>' + parts.join(' / ') + ' · 基础掉落</small>' : '';
  },
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
  production: function(incomes, stores, reserves) {
    var rows = [], net = {}, flow = {};
    Object.keys(incomes || {}).forEach(function(key) {
      var income = incomes[key];
      if (!income || !(income.delay > 0)) return;
      var inputs = [], outputs = [];
      Object.keys(income.stores || {}).forEach(function(item) {
        var amount = income.stores[item];
        if (!Number.isFinite(amount) || !amount) return;
        net[item] = (net[item] || 0) + amount * 60 / income.delay;
        if (!flow[item]) flow[item] = {item:item, supply:0, demand:0, producers:[], consumers:[]};
        var rate = Math.abs(amount) * 60 / income.delay;
        if (amount > 0) { flow[item].supply += rate; flow[item].producers.push(key); }
        else { flow[item].demand += rate; flow[item].consumers.push(key); }
        if (amount < 0) inputs.push({item:item, amount:-amount, have:Math.max(0, stores[item] || 0)});
        else outputs.push({item:item, amount:amount});
      });
      if (inputs.length || outputs.length) rows.push({key:key, delay:income.delay, inputs:inputs, outputs:outputs,
        missing:inputs.filter(function(input) { return input.have < input.amount; }),
        reserved:inputs.filter(function(input) {return reserves && reserves[input.item] > 0 && input.have >= input.amount && input.have - input.amount < reserves[input.item];})});
    });
    return {rows:rows, net:net, deficits:Object.keys(flow).map(function(item) {return flow[item];}).filter(function(row) {
      return row.demand - row.supply > 0.001;
    })};
  },
  productionText: function() {
    var incomes = $SM.get('income') || {}, selected = {};
    Object.keys(incomes).forEach(function(key) {
      if (Outside._INCOME[key] || key === 'builder') selected[key] = incomes[key];
    });
    var reserves = {};
    Object.keys($SM.get('game.productionReserves') || {}).forEach(function(item) { reserves[item] = $SM.getProductionReserve(item); });
    var report = CampGuide.production(selected, $SM.get('stores') || {}, reserves);
    var text = [_('production snapshot: recipes below are for the entire assigned group, not one worker.')];
    var jobName = function(key) {return key === 'builder' ? _('Shinobu') : _(key);};
    var rateText = function(value) {return String(Math.round(value * 100) / 100);};
    if (report.deficits.length) {
      text.push(_('these assigned jobs consume materials faster than they produce them at full operation; current stock only buffers the gap.'));
      report.deficits.forEach(function(row) {
        text.push(_('{0}: supply {1}/min, demand {2}/min, shortfall {3}/min. assigned sources: {4}; consumers: {5}.', _(row.item), rateText(row.supply), rateText(row.demand), rateText(row.demand - row.supply), row.producers.map(jobName).join(' / ') || _('none'), row.consumers.map(jobName).join(' / ')));
      });
      text.push(_('increase available upstream jobs or reduce consumers. manual gathering and trading can also cover the gap; these figures are not a depletion countdown.'));
    }
    var format = function(items) { return items.map(function(item) {return _(item.item) + ' ×' + item.amount;}).join(' / ') || _('none'); };
    report.rows.forEach(function(row) {
      text.push(_('{0}: every {1}s, consume {2}; produce {3}.', row.key === 'builder' ? _('Shinobu') : _(row.key), row.delay, format(row.inputs), format(row.outputs)));
      if (row.missing.length) {
        text.push(_('not enough for one group batch: {0}. reduce this assignment or supply its inputs.', row.missing.map(function(item) {
          return _('{0}: {1}/{2}', _(item.item), item.have, item.amount);
        }).join(' / ')));
      }
      if (row.reserved.length) text.push(_('production held for reserves: {0}. no inputs are consumed for this batch.', row.reserved.map(function(input) {
        return _('{0}: stock {1}, reserved {2}, batch needs {3}', _(input.item), input.have, reserves[input.item], input.amount);
      }).join(' / ')));
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
      reserves:{text:_('production reserves'), onChoose:CampGuide.editReserves},
      close:{text:_('close'), nextScene:'end'}
    }, onLoad:function() { Events.activeEvent().scenes.start.text = CampGuide.productionText(); }}}});
    Events.eventPanel().addClass('productionOverview');
  },
  reserveItems: function() {
    var items = {}, stores = $SM.get('stores') || {}, saved = $SM.get('game.productionReserves') || {};
    Object.keys(Outside._INCOME).forEach(function(job) {
      var cost = Outside._INCOME[job].stores;
      Object.keys(cost).forEach(function(item) {
        if (cost[item] < 0 && (Object.prototype.hasOwnProperty.call(stores,item) || saved[item] > 0)) items[item] = true;
      });
    });
    return Object.keys(items);
  },
  editReserves: function() {
    var panel = Events.eventPanel(), desc = $('#description', panel).empty(), buttons = $('#buttons', panel).empty();
    $('<p>').text(_('reserves only limit automatic worker production. zero disables protection. manual crafting, trade, departure and events can still use these materials.')).appendTo(desc);
    var inputs = {};
    CampGuide.reserveItems().forEach(function(item, index) {
      var row = $('<div>').addClass('productionReserveRow').appendTo(desc), id = 'productionReserve_' + index;
      $('<label>').attr('for',id).text(_(item)).appendTo(row);
      inputs[item] = $('<input>').attr({id:id,type:'number',min:0,max:$SM.MAX_STORE,step:1,'data-material':item}).val($SM.getProductionReserve(item)).appendTo(row);
    });
    if (!Object.keys(inputs).length) $('<p>').text(_('no known production inputs yet.')).appendTo(desc);
    var status = $('<p>').attr({role:'status','aria-live':'polite',id:'productionReserveStatus'}).appendTo(desc);
    $('<button>').attr({id:'saveProductionReserves',type:'button'}).text(_('save')).on('click',function() {
      var next = Object.assign({}, $SM.get('game.productionReserves') || {}), valid = true;
      Object.keys(inputs).forEach(function(item) {
        var raw = inputs[item].val(), value = raw === '' ? 0 : Number(raw);
        if (!inputs[item][0].validity.valid || !Number.isSafeInteger(value) || value < 0 || value > $SM.MAX_STORE) valid = false;
        else next[item] = value;
      });
      if (!valid) {status.text(_('reserve quantities must be whole numbers from 0 to {0}. nothing was saved.', $SM.MAX_STORE));return;}
      $SM.set('game.productionReserves',next);
      Events.loadScene('start');
    }).appendTo(buttons);
    $('<button>').attr({id:'cancelProductionReserves',type:'button'}).text(_('cancel')).on('click',function() {Events.loadScene('start');}).appendTo(buttons);
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
