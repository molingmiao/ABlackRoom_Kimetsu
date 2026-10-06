/* Paid virtual-material forging. Fixed ten-attempt guarantees are shared by every form. */
var NichirinForge = window.NichirinForge = {
  FORMS: {water:'水',flame:'炎',thunder:'雷',beast:'兽',insect:'虫',sound:'音',mist:'霞',wind:'风',stone:'岩',flower:'花',love:'恋',serpent:'蛇',sun:'日',moon:'月'},
  COST: {'demon stone':1,steel:20,wood:100},
  items: {},
  _context: null,
  _busy: false,
  key: function(style,tier) {return (tier === 5 ? 'supreme nichirin blade ' : 'nichirin blade ') + style;},
  formName: function(style) {return style === 'moon' ? '月之呼吸剑谱·拟式' : NichirinForge.FORMS[style] + '之呼吸';},
  register: function() {
    // Old flame/energy blades are save aliases, not a second live weapon or recipe.
    ['flame blade','energy blade'].forEach(function(alias) {
      delete World.Weapons[alias];
      delete NichirinForge.items[alias];
      delete Room.MiscItems[alias];
      delete Fabricator.Craftables[alias];
      Object.keys(Path.WeaponCategory).forEach(function(category) {
        Path.WeaponCategory[category] = Path.WeaponCategory[category].filter(function(key) {return key !== alias;});
      });
    });
    Object.keys(NichirinForge.FORMS).forEach(function(style) {
      [4,5].forEach(function(tier) {
        var key = NichirinForge.key(style,tier);
        var weapon = {verb:_('slash'),type:'melee',damage:tier === 5 ? 18 : 12,cooldown:2,
          tier:tier,nichirinForged:true,breathingStyle:style};
        NichirinForge.items[key] = {name:_(key),type:'weapon',forgeOnly:true};
        World.Weapons[key] = weapon;
        Path.Weight[key] = 5;
        if (Path.WeaponCategory.primary.indexOf(key) < 0) Path.WeaponCategory.primary.push(key);
        Room.MiscItems[key] = NichirinForge.items[key];
        Room.StoreDescriptions[key] = (tier === 5 ? '金色极日轮刀' : '紫色日轮刀') + '，基础伤害 ' + weapon.damage +
          '，2 秒近战间隔；无限城匹配' + NichirinForge.formName(style) + '时伤害额外 +' + (tier === 5 ? 25 : 15) + '%。不解锁呼吸。';
      });
    });
  },
  getDamageMultiplier: function(key) {
    var weapon = World.Weapons[key];
    return Engine.activeModule === Space && weapon && weapon.nichirinForged &&
      CombatStyles.getSelected() === weapon.breathingStyle ? (weapon.tier === 5 ? 1.25 : 1.15) : 1;
  },
  getScrapCost: function(key) {return NichirinForge.items[key] ? Object.assign({},NichirinForge.COST) : null;},
  attempts: function() {
    var value = $SM.get('game.nichirinForge.attempts',true);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  },
  stock: function(item) {
    var value = $SM.get('stores["' + item + '"]');
    return value === undefined ? 0 : value;
  },
  preview: function(count) {
    var plan = {count:count,attempts:NichirinForge.attempts(),costs:{},ready:true,reason:''};
    if (count !== 1 && count !== 10) {plan.ready=false;plan.reason='只能锻造 1 次或 10 次';return plan;}
    if (plan.attempts > $SM.MAX_STORE - count) {plan.ready=false;plan.reason='锻造次数已达上限';return plan;}
    Object.keys(NichirinForge.COST).forEach(function(item) {
      var cost = NichirinForge.COST[item] * count, have = NichirinForge.stock(item);
      plan.costs[item] = cost;
      if (!Number.isFinite(have) || have < cost) {plan.ready=false;plan.reason='庄园缺' + _(item) + '×' + Math.max(0,cost-(Number.isFinite(have) ? have : 0));}
    });
    Object.keys(NichirinForge.items).forEach(function(key) {
      var have = NichirinForge.stock(key);
      if (!Number.isSafeInteger(have) || have < 0 || have + count > $SM.MAX_STORE) {plan.ready=false;plan.reason='武器库存异常或已达上限';}
    });
    return plan;
  },
  roll: function(attempt,random) {
    var guaranteed = attempt % 10 === 0;
    var rarity = guaranteed ? 1 : random();
    if (!Number.isFinite(rarity) || rarity < 0 || rarity > 1 || (!guaranteed && rarity === 1)) return null;
    if (!guaranteed && rarity < 0.2) return {attempt:attempt,tier:0,guaranteed:false};
    var tier = guaranteed || rarity >= 0.95 ? 5 : 4, forms = Object.keys(NichirinForge.FORMS), pick = random();
    if (!Number.isFinite(pick) || pick < 0 || pick >= 1) return null;
    var style = forms[Math.floor(pick * forms.length)];
    return {attempt:attempt,tier:tier,style:style,key:NichirinForge.key(style,tier),guaranteed:guaranteed};
  },
  canForge: function(context) {
    return !NichirinForge._busy && context && !context.closed && context === NichirinForge._context &&
      Engine.activeModule === Fabricator && !!$SM.get('features.location.fabricator') &&
      !Engine.keyLock && !Events.activeEvent() && document.documentElement.contains(context.node) &&
      context.accepted.prop('checked') && !document.querySelector('#scrapQuantityOverlay, #buyQuantityOverlay, #loadoutEditorOverlay, [role="dialog"]:not(#nichirinForgePanel)');
  },
  canOpen: function() {
    return !NichirinForge._busy && !NichirinForge._context && Engine.activeModule === Fabricator &&
      !!$SM.get('features.location.fabricator') && !Engine.keyLock && !Events.activeEvent() &&
      !document.querySelector('#nichirinForgeOverlay, #scrapQuantityOverlay, #buyQuantityOverlay, #loadoutEditorOverlay, [role="dialog"]');
  },
  close: function(restoreFocus) {
    var context = NichirinForge._context;
    if (!context) return false;
    NichirinForge._context = null;
    context.closed = true;
    $.Dispatch('stateUpdate').unsubscribe(context.refresh);
    context.overlay.remove();
    if (restoreFocus && context.trigger && document.documentElement.contains(context.trigger)) context.trigger.focus();
    return true;
  },
  open: function(trigger) {
    if (!NichirinForge.canOpen()) return false;
    var overlay = $('<div>').attr('id','nichirinForgeOverlay');
    var card = $('<section>').attr({id:'nichirinForgePanel',role:'dialog','aria-modal':'true',
      'aria-labelledby':'nichirinForgeTitle','aria-describedby':'nichirinForgeOdds nichirinForgeGuarantee',tabindex:-1})
      .addClass('nichirinForge').appendTo(overlay);
    var heading = $('<div>').addClass('nichirinForgeHeading').appendTo(card);
    $('<h2>').attr('id','nichirinForgeTitle').text('日轮刀锻造').appendTo(heading);
    var closeButton = $('<button>').attr({type:'button',id:'closeNichirinForge','aria-label':'关闭日轮刀锻造'}).text('关闭').appendTo(heading);
    var odds = $('<p>').attr('id','nichirinForgeOdds').appendTo(card);
    $('<strong>').text('普通次数：20% 失败（材料全部消耗）').appendTo(odds);
    $('<span>').text('、').appendTo(odds);
    $('<strong>').addClass('weapon-tier-4').text('75% 紫色日轮刀').appendTo(odds);
    $('<span>').text('、').appendTo(odds);
    $('<strong>').addClass('weapon-tier-5').text('5% 金色极日轮刀').appendTo(odds);
    $('<span>').text('。成功后等概率随机分配 14 系呼吸归属；不直接解锁该流派。').appendTo(odds);
    var guarantee = $('<p>').attr('id','nichirinForgeGuarantee').appendTo(card);
    $('<strong>').text('每第 10、20、30… 次必出金色').appendTo(guarantee);
    $('<span>').text('，失败计入次数；提前随机出金不重置。所有呼吸共享保底，不因刷新而丢失。保底次覆盖普通概率。').appendTo(guarantee);
    $('<p>').append($('<strong>').text('每次消耗：青鬼石 ×1、钢 ×20、木头 ×100。')).appendTo(card);
    var materials = $('<p>').addClass('nichirinForgeMaterials').appendTo(card);
    var stats = $('<p>').appendTo(card);
    $('<strong>').addClass('weapon-tier-4').text('紫刀 12 伤害（匹配 +15%）').appendTo(stats);
    $('<span>').text('／').appendTo(stats);
    $('<strong>').addClass('weapon-tier-5').text('极刀 18 伤害（匹配 +25%）').appendTo(stats);
    $('<span>').text('，均 2 秒间隔／重 5；匹配增伤仅在无限城生效，不匹配也能使用。').appendTo(stats);
    var progress = $('<p>').addClass('nichirinForgeProgress').appendTo(card);
    var label = $('<label>').addClass('nichirinForgeRisk').appendTo(card);
    var accepted = $('<input>').attr({type:'checkbox',id:'forgeRiskAccepted'}).appendTo(label);
    $('<span>').text('我确认失败不返还材料，且不会自动装备或装入背包。').appendTo(label);
    var actions = $('<div>').addClass('nichirinForgeActions').appendTo(card);
    var context = {node:card[0],overlay:overlay,trigger:trigger || document.activeElement,accepted:accepted,
      materials:materials,progress:progress,closed:false,results:$('<div>').addClass('nichirinForgeResults').attr('aria-live','polite').appendTo(card)};
    NichirinForge._context = context;
    [1,10].forEach(function(count) {
      $('<button>').attr({type:'button',id:'forgeNichirin'+count}).text(count === 1 ? '锻造 1 次' : '锻造 10 次（至少 1 把金色）')
        .data('count',count).on('click',function() {NichirinForge.forge(count,context);}).appendTo(actions);
    });
    var footer = $('<div>').addClass('nichirinForgeFooter').appendTo(card);
    var cancel = $('<button>').attr({type:'button',id:'cancelNichirinForge'}).text('取消').appendTo(footer);
    var closeThis = function() {if (NichirinForge._context === context) NichirinForge.close(true);};
    closeButton.on('click',closeThis);
    cancel.on('click',closeThis);
    overlay.on('click',function(event) {
      event.stopPropagation();
      if (event.target === overlay[0]) closeThis();
    });
    overlay.on('keydown',function(event) {
      event.stopPropagation();
      if (event.key === 'Escape') {event.preventDefault();closeThis();}
      else if (event.key === 'Tab') {
        var focusable = card.find('input, button').filter(function() {return !$(this).prop('disabled');}).get();
        var index = focusable.indexOf(document.activeElement);
        if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === focusable.length-1)) {
          event.preventDefault();
          focusable[event.shiftKey ? focusable.length-1 : 0].focus();
        }
      }
    });
    overlay.on('keyup',function(event) {event.stopPropagation();});
    accepted.on('change',NichirinForge.render);
    context.refresh = NichirinForge.render;
    $.Dispatch('stateUpdate').subscribe(context.refresh);
    overlay.appendTo('body');
    NichirinForge.render();
    card.focus();
    return true;
  },
  forge: function(count,context) {
    if (!NichirinForge.canForge(context)) return false;
    var plan = NichirinForge.preview(count);
    if (!plan.ready) {NichirinForge.render();return false;}
    NichirinForge._busy = true;
    try {
      var results = [], changes = {};
      for (var i=1;i<=count;i++) {
        var result = NichirinForge.roll(plan.attempts+i,Math.random);
        if (!result) return false;
        results.push(result);
      }
      Object.keys(plan.costs).forEach(function(item) {changes[item]=$SM.get('stores["'+item+'"]',true)-plan.costs[item];});
      results.forEach(function(result) {
        if (result.tier) changes[result.key] = (changes[result.key] === undefined ? $SM.get('stores["'+result.key+'"]',true) : changes[result.key]) + 1;
      });
      // No publication until materials, products and guarantee progress are all committed.
      $SM.setM('stores',changes,true);
      $SM.setM('game.nichirinForge',{attempts:plan.attempts+count,lastResults:results},true);
      Engine.saveGame();
      $SM.fireUpdate('stores');
      Notifications.notify(null,'锻造完成：' + results.filter(function(row){return row.tier===4;}).length + ' 把紫刀，' +
        results.filter(function(row){return row.tier===5;}).length + ' 把极日轮刀，失败 ' + results.filter(function(row){return !row.tier;}).length + ' 次。失败材料不返还，成品已入庄园仓库。');
      AudioEngine.playSound(AudioLibrary.CRAFT);
      return true;
    } finally {
      NichirinForge._busy = false;
      NichirinForge.render();
    }
  },
  render: function() {
    if (!Fabricator.panel || !Fabricator.panel.length) return;
    if (!Fabricator.panel.find('#openNichirinForge').length) {
      var workbench = Fabricator.panel.find('.forgeWorkbench');
      $('<button>').attr({type:'button',id:'openNichirinForge','aria-haspopup':'dialog','aria-controls':'nichirinForgePanel'})
        .text('日轮刀锻造').on('click',function() {NichirinForge.open(this);}).prependTo(workbench.length ? workbench : Fabricator.panel);
    }
    var context = NichirinForge._context;
    if (!context) return;
    if (context.closed || !document.documentElement.contains(context.node) || Engine.activeModule !== Fabricator ||
      !$SM.get('features.location.fabricator') || Engine.keyLock || Events.activeEvent()) {NichirinForge.close(false);return;}
    var card = $(context.node), attempts = NichirinForge.attempts();
    context.materials.text('庄园库存：' + Object.keys(NichirinForge.COST).map(function(item) {
      var stock = NichirinForge.stock(item);
      return _(item)+' ×'+(Number.isFinite(stock) && stock >= 0 ? stock : '异常');
    }).join('、'));
    context.progress.text('累计锻造 ' + attempts + ' 次 · 距下次固定金色保底 ' + (10-attempts%10) + ' 次');
    card.find('.nichirinForgeActions button').each(function() {
      var plan=NichirinForge.preview($(this).data('count'));
      $(this).prop('disabled',!plan.ready || !context.accepted.prop('checked') || NichirinForge._busy)
        .attr('title',plan.ready ? '确认后立即消耗材料并锻造，不能撤销' : plan.reason);
    });
    var savedResults=$SM.get('game.nichirinForge.lastResults'), results=Array.isArray(savedResults) ? savedResults.slice(-10) : [], signature=JSON.stringify(results);
    if (context.results.data('signature') !== signature) {
      context.results.data('signature',signature).empty();
      if (results.length) $('<strong>').text('上次锻造结果（已入仓）').appendTo(context.results);
      results.forEach(function(row) {
        var line=$('<p>').addClass(row.tier ? 'weapon-tier-'+row.tier : 'forgeFailure').appendTo(context.results);
        $('<strong>').text('第 '+row.attempt+' 次：'+(row.tier ? _(row.key)+(row.guaranteed?'（十次保底）':'') : '锻造失败')).appendTo(line);
        if (!row.tier) $('<span>').text(' · 本次材料不返还').appendTo(line);
      });
    }
  }
};
NichirinForge.register();
