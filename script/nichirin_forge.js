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
    return !NichirinForge._busy && context && context === NichirinForge._context &&
      Engine.activeModule === Fabricator && !!$SM.get('features.location.fabricator') &&
      !Engine.keyLock && !Events.activeEvent() && document.documentElement.contains(context.node) &&
      context.accepted.prop('checked') && !document.querySelector('#scrapQuantityOverlay, #buyQuantityOverlay, #loadoutEditorOverlay, [role="dialog"]');
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
    var card = Fabricator.panel.find('.nichirinForge');
    if (!card.length) {
      var workbench = Fabricator.panel.find('.forgeWorkbench');
      card=$('<section>').addClass('nichirinForge').prependTo(workbench.length ? workbench : Fabricator.panel);
      $('<h3>').text('日轮刀锻造').appendTo(card);
      var odds=$('<p>').appendTo(card);
      $('<strong>').text('普通次数：20% 失败（材料全部消耗）').appendTo(odds);
      $('<span>').text('、').appendTo(odds);
      $('<strong>').addClass('weapon-tier-4').text('75% 紫色日轮刀').appendTo(odds);
      $('<span>').text('、').appendTo(odds);
      $('<strong>').addClass('weapon-tier-5').text('5% 金色极日轮刀').appendTo(odds);
      $('<span>').text('。成功后等概率随机分配 14 系呼吸归属；不直接解锁该流派。').appendTo(odds);
      var guarantee=$('<p>').appendTo(card);
      $('<strong>').text('每第 10、20、30… 次必出金色').appendTo(guarantee);
      $('<span>').text('，失败计入次数；提前随机出金不重置。所有呼吸共享保底，不因刷新而丢失。保底次覆盖普通概率。').appendTo(guarantee);
      $('<p>').append($('<strong>').text('每次消耗：青鬼石 ×1、钢 ×20、木头 ×100。')).appendTo(card);
      var stats=$('<p>').appendTo(card);
      $('<strong>').addClass('weapon-tier-4').text('紫刀 12 伤害（匹配 +15%）').appendTo(stats);
      $('<span>').text('／').appendTo(stats);
      $('<strong>').addClass('weapon-tier-5').text('极刀 18 伤害（匹配 +25%）').appendTo(stats);
      $('<span>').text('，均 2 秒间隔／重 5；匹配增伤仅在无限城生效，不匹配也能使用。').appendTo(stats);
      var progress=$('<p>').addClass('nichirinForgeProgress').appendTo(card);
      var label=$('<label>').addClass('nichirinForgeRisk').appendTo(card);
      var accepted=$('<input>').attr({type:'checkbox',id:'forgeRiskAccepted'}).appendTo(label);
      $('<span>').text('我确认失败不返还材料，且不会自动装备或装入背包。').appendTo(label);
      var actions=$('<div>').addClass('nichirinForgeActions').appendTo(card);
      var context={node:card[0],accepted:accepted,progress:progress,results:$('<div>').addClass('nichirinForgeResults').attr('aria-live','polite').appendTo(card)};
      NichirinForge._context=context;
      [1,10].forEach(function(count) {
        $('<button>').attr({type:'button',id:'forgeNichirin'+count}).text(count===1 ? '锻造 1 次' : '锻造 10 次（至少 1 把金色）')
          .data('count',count).on('click',function(){NichirinForge.forge(count,context);}).appendTo(actions);
      });
      accepted.on('change',NichirinForge.render);
    }
    var context= NichirinForge._context, attempts= NichirinForge.attempts();
    context.progress.text('累计锻造 ' + attempts + ' 次 · 距下次固定金色保底 ' + (10-attempts%10) + ' 次');
    card.find('.nichirinForgeActions button').each(function() {
      var plan=NichirinForge.preview($(this).data('count'));
      $(this).prop('disabled',!plan.ready || !context.accepted.prop('checked') || NichirinForge._busy)
        .attr('title',plan.ready ? '确认后立即消耗材料并锻造，不能撤销' : plan.reason);
    });
    var results=$SM.get('game.nichirinForge.lastResults') || [], signature=JSON.stringify(results);
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
