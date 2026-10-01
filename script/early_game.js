/** Stage guidance and explicit, one-time campaign rewards. */
var EarlyGame = {
  milestones: function() {
    return [
      {id:'cart', title:'整备运输', goal:'建造推车', building:'cart', reward:{wood:40}},
      {id:'shelter', title:'重建庇护所', goal:'建造小屋并迎来幸存者', building:'hut', population:true, reward:{wood:60,fur:5,meat:5}},
      {id:'traps', title:'林间补给', goal:'建造第一座陷阱', building:'trap', reward:{fur:10,meat:5,bait:3}},
      {id:'hunters', title:'稳定食物来源', goal:'建造狩猎小屋', building:'lodge', reward:{wood:100,fur:40}},
      {id:'trade', title:'接通商路', goal:'建造交易站', building:'trading post', reward:{fur:100,scales:20,teeth:10}},
      {id:'compass', title:'走出庄园', goal:'获得罗盘，解锁世界探索', feature:'path', reward:{wood:150,meat:30,'cured meat':15}},
      {id:'food', title:'备足远行口粮', goal:'建造熏肉房', building:'smokehouse', reward:{wood:150,leather:30,'cured meat':15}},
      {id:'workshop', title:'整备猎鬼装备', goal:'建造工坊', building:'workshop', reward:{leather:30,scales:10,'cured meat':10}},
      {id:'mine', title:'建立矿石供应', goal:'找到铁矿并安全返回，解锁铁矿工', building:'iron mine', reward:{iron:40,wood:200,'cured meat':20}},
      {id:'castle', title:'通往决战之地', goal:'找到无限城入口并安全返回', feature:'spaceShip', reward:{'demon stone':2,medicine:5,'cured meat':15}}
    ];
  },
  milestone: function() {
    if (!$SM.get('game.prologue.done')) return null;
    if ($SM.get('game.builder.level',true) < 4 && !$SM.get('features.location.path')) return null;
    var claims = $SM.get('game.campaignClaims') || {};
    var task = EarlyGame.milestones().find(function(m) {return !claims[m.id];});
    if (!task) return null;
    task.ready = task.feature ? !!$SM.get('features.location.' + task.feature) : $SM.get('game.buildings[' + JSON.stringify(task.building) + ']',true) > 0;
    if (task.population) task.ready = task.ready && $SM.get('game.population',true) > 0;
    // World exploration proves the opening milestones were passed, even after lost buildings.
    if (['cart','shelter','traps','hunters','trade'].indexOf(task.id) >= 0 && $SM.get('features.location.path')) task.ready = true;
    return task;
  },
  claimMilestone: function(id) {
    var task = EarlyGame.milestone();
    if (!task || task.id !== id || !task.ready) return false;
    // Mark before publishing inventory updates so reentrant clicks cannot grant twice.
    $SM.set('game.campaignClaims[' + JSON.stringify(id) + ']',true,true);
    $SM.addM('stores',task.reward,true);
    Engine.saveGame();
    $SM.fireUpdate('stores');
    Notifications.notify(null, _('阶段完成：') + task.title + '。' + EarlyGame.benefit(task.id));
    EarlyGame.render();
    return true;
  },
  init: function() {
    if (!EarlyGame._subscribed) {
      $.Dispatch('stateUpdate').subscribe(EarlyGame.render);
      EarlyGame._subscribed = true;
    }
    EarlyGame.render();
  },
  gatherCooldown: function(normal) {
    var early = !$SM.get('features.location.path') && !$SM.get('game.buildings.hut', true)
      && !$SM.get('game.earlyResidentsArrived') && !$SM.get('game.population', true)
      && $SM.get('game.gatherCount', true) < 3;
    return early ? Math.min(normal, 20) : normal;
  },
  firstResidentsPending: function() {
    return !$SM.get('game.earlyResidentsArrived') && !$SM.get('features.location.path')
      && $SM.get('game.buildings.hut', true) > 0 && !$SM.get('game.population', true);
  },
  warmDelay: function(normal) {
    return $SM.get('game.prologue.done') && !$SM.get('features.location.path')
      && $SM.get('game.builder.level',true) < 4 ? Math.min(normal,15000) : normal;
  },
  canTendGuest: function() {
    var level = $SM.get('game.builder.level');
    return !!$SM.get('game.prologue.done') && !$SM.get('features.location.path')
      && !!$SM.get('features.location.outside') && (level === 1 || level === 2)
      && $SM.get('game.temperature.value',true) >= Room.TempEnum.Warm.value
      && $SM.get('stores.wood',true) >= 1 && Engine.activeModule === Room
      && !(window.Events && Events.activeEvent());
  },
  tendGuest: function() {
    if (!EarlyGame.canTendGuest()) return false;
    var level = $SM.get('game.builder.level');
    $SM.add('stores.wood',-1,true);
    $SM.set('game.builder.level',level + 1,true);
    Engine.saveGame();
    $SM.fireUpdate('stores');
    $SM.fireUpdate('game.builder.level');
    Notifications.notify(Room, level === 1 ? _('你添了一块柴，将温水递给蝴蝶忍。她的呼吸慢慢平稳下来。') : _('你替蝴蝶忍换好绷带。她望向残破的庄园：“接下来，让我帮忙吧。”'));
    Room.welcomeBuilder();
    EarlyGame.render();
    return true;
  },
  firstCatchPending: function() {
    return !!$SM.get('game.prologue.done') && !$SM.get('features.location.path')
      && !$SM.get('game.firstTrapCatch') && !$SM.get('game.trapCount',true);
  },
  supplyChoices: function() {
    return [
      {id:'journey', title:'优先探路', text:'忍联系了沿路的猎户。先积攒交易用的毛皮，为买到指南针铺路。', reward:{fur:180,'cured meat':5}},
      {id:'estate', title:'优先扩建', text:'忍请队士送来修缮物资。先扩建住所、加快庄园供给，再准备远行。', reward:{wood:200,fur:100}}
    ];
  },
  supplyPending: function() {
    return !!$SM.get('game.prologue.done') && !$SM.get('features.location.path')
      && !$SM.get('stores.compass',true) && !$SM.get('game.openingSupplyChoice')
      && $SM.get('game.builder.level',true) >= 4 && $SM.get('game.buildings.lodge',true) > 0;
  },
  openingHunterPlan: function() {
    if (!$SM.get('game.prologue.done') || $SM.get('features.location.path')
      || $SM.get('game.buildings.lodge',true) < 1 || $SM.get('game.workers.hunter',true) > 0) return null;
    var population = $SM.get('game.population',true), workers = $SM.get('game.workers') || {};
    if (!Number.isInteger(population) || population < 0) return null;
    var assigned = 0;
    for (var key in workers) {
      if (!Number.isInteger(workers[key]) || workers[key] < 0) return null;
      assigned += workers[key];
    }
    var amount = Math.min(2,Math.max(0,population - assigned - 1));
    var income = Outside._INCOME.hunter;
    return {amount:amount, furPerMinute:amount * income.stores.fur * 60 / income.delay,
      meatPerMinute:amount * income.stores.meat * 60 / income.delay};
  },
  assignOpeningHunters: function() {
    var plan = EarlyGame.openingHunterPlan();
    if (!plan || !plan.amount || (Engine.activeModule !== Room && Engine.activeModule !== Outside)
      || (window.Events && Events.activeEvent())) return false;
    // Only unassigned gatherers change jobs; all existing specialists are preserved.
    $SM.set('game.workers.hunter',plan.amount);
    Notifications.notify(null,'已安排猎人 ' + plan.amount + ' 名，至少保留 1 人采木。每分钟毛皮 +' + plan.furPerMinute + '、生肉 +' + plan.meatPerMinute + '；可在庄园分工中随时调整。');
    EarlyGame.render();
    return true;
  },
  chooseSupply: function(id) {
    if (!EarlyGame.supplyPending() || (Engine.activeModule !== Room && Engine.activeModule !== Outside)
      || (window.Events && Events.activeEvent())) return false;
    var choice = EarlyGame.supplyChoices().find(function(c) {return c.id === id;});
    if (!choice) return false;
    $SM.set('game.openingSupplyChoice',id,true);
    $SM.addM('stores',choice.reward,true);
    Engine.saveGame();
    $SM.fireUpdate('stores');
    Notifications.notify(null, choice.text + ' 奖励：' + EarlyGame.rewardText(choice.reward));
    EarlyGame.render();
    return true;
  },
  rewardText: function(reward) {
    return Object.keys(reward).map(function(item) {return _(item) + ' ×' + reward[item];}).join(' / ');
  },
  benefit: function(id) {
    return {
      cart:'推车让每次采木从 10 提升到 50；下一步给幸存者搭建住所。',
      shelter:'幸存者会帮助采木；住所也解锁自动采木和查看陷阱，可在庄园手动开启。',
      traps:'陷阱带来毛皮、生肉等材料；猎屋将让食物来源不再只靠运气。',
      hunters:'猎屋解锁猎人分工；在庄园安排猎人，就能持续获得毛皮和生肉。',
      trade:'贸易站可以购买指南针；它将打开庄园之外的地图，而不是直接进入战斗。',
      compass:'世界探索已经开放；先把食物和武器装进背包，再从近郊熟悉探索与战斗。',
      food:'熏肉房解锁熏肉工人，生肉加工成可恢复生命的远征口粮。',
      workshop:'工坊开启武器、护甲与携行装备制作，装备和补给仍需在备战页装配。',
      mine:'安排铁矿工维持矿石供应，为更强的装备做准备。',
      castle:'无限城入口已开放；配置好装备与补给，再迎接逐层推进的战斗。'
    }[id] || '';
  },
  task: function() {
    if (!$SM.get('game.prologue.done') || $SM.get('features.location.path') || $SM.get('stores.compass', true)) return null;
    if (!$SM.get('game.fire.value', true)) return {text: 'light the hearth first. warmth will make this estate a refuge again.'};
    if (!$SM.get('features.location.outside')) return {text: 'keep the fire burning. the room and your guest need time to warm up.'};
    if ($SM.get('game.builder.level') === 3) return {text:'your guest is ready to help. return to the hall to hear her plan.'};
    if (($SM.get('game.builder.level') || 0) < 4) return {text: 'gather wood while your guest recovers, then return to the hall to speak with her.'};
    if ($SM.get('game.temperature.value', true) <= Room.TempEnum.Cold.value) return {text: 'warm the hall before building. Shinobu cannot work while shivering.'};
    var buildings = $SM.get('game.buildings') || {};
    if (!buildings.cart) return {text: 'build a cart: each wood gathering rises from 10 to 50, before legacy bonuses.', cost: Room.Craftables.cart.cost()};
    if (!buildings.hut) return {text: $SM.get('game.earlyResidentsArrived') ? 'there is room for survivors. gather supplies while you wait for their arrival.' : 'build your first shelter. two survivors will arrive after 30 seconds and help gather wood.', cost: Room.Craftables.hut.cost()};
    if (!$SM.get('game.population', true)) return {text: 'there is room for survivors. gather supplies while you wait for their arrival.'};
    if (!buildings.trap) return {text: 'set a trap to discover food and materials. check it when its cooldown ends.', cost: Room.Craftables.trap.cost()};
    if (!buildings.lodge) return {text: 'build a hunting lodge for a steady source of meat and fur. check traps for missing materials.', cost: Room.Craftables.lodge.cost()};
    if (!buildings['trading post']) return {text: 'build a trading post to prepare for journeys beyond the estate.', cost: Room.Craftables['trading post'].cost()};
    return {text: 'obtain a compass to open world exploration. prepare food and a weapon before leaving.', cost: Room.TradeGoods.compass.cost()};
  },
  render: function() {
    var task = EarlyGame.task();
    var milestone = EarlyGame.milestone();
    $('#roomPanel, #outsidePanel').each(function() {
      var panel = $(this), box = panel.children('.earlyGameTask');
      if (!task && !milestone) { box.remove(); panel.css('--early-guide-height', '0px'); return; }
      if (!box.length) {
        box = $('<details>').addClass('earlyGameTask').prop('open', true).prependTo(panel);
        $('<summary>').text(_('current estate task')).appendTo(box);
        $('<p>').addClass('earlyGameTaskText').appendTo(box);
        $('<p>').addClass('earlyGameTaskCost').appendTo(box);
        $('<p>').addClass('guestCareHint').appendTo(box);
        $('<button>').attr('type','button').addClass('guestCare').text('照料来客（木材 1）').appendTo(box).on('click',EarlyGame.tendGuest);
        $('<p>').addClass('campaignGoal').appendTo(box);
        $('<p>').addClass('campaignBenefit').appendTo(box);
        $('<p>').addClass('campaignReward').appendTo(box);
        $('<button>').attr('type','button').addClass('campaignClaim').appendTo(box);
        $('<div>').addClass('openingSupply').appendTo(box);
        var hunters = $('<div>').addClass('openingHunters').appendTo(box);
        $('<p>').appendTo(hunters);
        $('<button>').attr('type','button').on('click',EarlyGame.assignOpeningHunters).appendTo(hunters);
        box.on('toggle', function() { EarlyGame.layout(panel, box); });
      }
      box.find('.earlyGameTaskText').text(task ? _(task.text) : '按阶段完成准备，逐步推进到无限城。');
      var cost = task && task.cost || (!task && milestone && milestone.building && Room.Craftables[milestone.building] ? Room.Craftables[milestone.building].cost() : {});
      var costs = Object.keys(cost).map(function(item) {
        var have = Math.max(0, $SM.get('stores[' + JSON.stringify(item) + ']', true));
        return _('{0}: {1}/{2}', _(item), have, cost[item]);
      });
      box.find('.earlyGameTaskCost').text(costs.join(' · '));
      var care = panel.attr('id') === 'roomPanel' && [1,2].indexOf($SM.get('game.builder.level')) >= 0;
      box.find('.guestCareHint').toggle(care).text('大厅暖到“温暖”、林地开放后，可主动照料，也可等待自然恢复。');
      box.find('.guestCare').toggle(care).prop('disabled',!EarlyGame.canTendGuest());
      var stage = milestone ? EarlyGame.milestones().findIndex(function(m) {return m.id === milestone.id;}) + 1 : 0;
      box.find('.campaignGoal').toggle(!!milestone).text(milestone ? '阶段主线 ' + stage + '/10 · ' + milestone.title + '：' + milestone.goal : '');
      box.find('.campaignBenefit').toggle(!!milestone).text(milestone ? '完成后：' + EarlyGame.benefit(milestone.id) : '');
      box.find('.campaignReward').text(milestone ? '一次性奖励：' + EarlyGame.rewardText(milestone.reward) : '');
      box.find('.campaignClaim').toggle(!!milestone).prop('disabled',!milestone || !milestone.ready).text(milestone && milestone.ready ? '领取阶段奖励' : '目标尚未完成').off('click').on('click',function() {if (milestone) EarlyGame.claimMilestone(milestone.id);});
      var supply = box.find('.openingSupply').toggle(EarlyGame.supplyPending());
      if (EarlyGame.supplyPending() && !supply.children().length) {
        $('<p>').text('忍的补给安排 · 选一份当前最需要的物资（仅一次，不锁定后续玩法）').appendTo(supply);
        EarlyGame.supplyChoices().forEach(function(choice) {
          $('<button>').attr({'type':'button','data-choice':choice.id}).text(choice.title + '：' + EarlyGame.rewardText(choice.reward)).appendTo(supply).on('click',function() {EarlyGame.chooseSupply(choice.id);});
        });
      }
      var hunterPlan = EarlyGame.openingHunterPlan();
      box.find('.openingHunters').toggle(!!hunterPlan);
      if (hunterPlan) {
        box.find('.openingHunters p').text(hunterPlan.amount ? '猎屋需要分工才会持续产出。只调动空闲采木人手，不改变已有工种。' : '至少需要两名空闲采木人手：安排一名猎人，保留一名采木。可以建住所招募，或手动调整分工。');
        box.find('.openingHunters button').prop('disabled',!hunterPlan.amount).text('安排猎人 ' + hunterPlan.amount + ' 名 · 每分钟毛皮 +' + hunterPlan.furPerMinute + '、生肉 +' + hunterPlan.meatPerMinute);
      }
      EarlyGame.layout(panel, box);
    });
  },
  layout: function(panel, box) {
    panel.css('--early-guide-height', box.outerHeight(true) + 'px');
  }
};
