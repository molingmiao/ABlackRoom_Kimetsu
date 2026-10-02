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
      {id:'coal', title:'打通煤矿', goal:'清理煤矿并安全返回，解锁煤矿工', building:'coal mine', hint:'煤矿位于距庄园 10 格处；准备好护甲、武器与返程口粮。', reward:{coal:50,iron:40,wood:350,'cured meat':20}},
      {id:'steel', title:'锻造升级', goal:'建造炼钢场，让铁矿与煤炭转化为钢材', building:'steelworks', hint:'建成后在庄园安排炼钢工；炼钢会持续消耗铁和煤。', reward:{steel:20,leather:30,'cured meat':25}},
      {id:'natagumo', title:'那田蜘蛛山篇', goal:'完成那田蜘蛛山的累之战与余韵，并安全返回', landmark:'M', hint:'寻找地图上的 M；完成整段剧情后再回庄园，不是仅进入山中。', reward:{medicine:6,'wisteria oil':2,'cured meat':30}},
      {id:'train', title:'无限列车篇', goal:'支援炎柱、救援乘客，完成无限列车剧情并安全返回', flag:'game.world.mugentrain', hint:'列车站台标记为 T，通常距庄园 18 格（旧地图可能略有偏移）；先完成矿业、炼钢和蜘蛛山的准备。', reward:{cloth:25,medicine:8,'cured meat':35}},
      {id:'sulphur', title:'取得硫磺供应', goal:'清理硫磺矿并安全返回，解锁硫磺矿工', building:'sulphur mine', hint:'硫磺矿位于距庄园 20 格处；钢制护甲和治疗物资能帮助应对连续战斗。', reward:{sulphur:25,coal:50,steel:20}},
      {id:'armoury', title:'建立军械补给', goal:'建造军械库，形成持续的藤花弹供应', building:'armoury', hint:'安排军械工，以钢和硫磺制作弹药；别让炼钢原料断供。', reward:{'wisteria bullet':30,medicine:5,'cured meat':30}},
      {id:'wreck', title:'列车残骸与锻造线索', goal:'探明列车残骸、带回装置，开放日轮锻造', feature:'fabricator', hint:'残骸标记为 X，距庄园 28 格；与无限列车支援任务是两个不同地点。', reward:{'demon stone':2,'solar crystal':8,'cured meat':30}},
      {id:'district', title:'游郭篇', goal:'在唯一的游郭完成三妻与居民救援，协助对抗上弦之陆并安全返回', flag:'game.yoshiwaraDone', hint:'游郭标记为 O（通常距庄园 15 格，旧地图可能略有偏移），只有一处；先完成无限列车。D/R 是普通旧街与市镇，不会触发游郭主线。备好武器、治疗和返程口粮。', reward:{medicine:8,'wisteria charm':3,'cured meat':40}},
      {id:'smiths', title:'刀匠村篇', goal:'支援刀匠村，完成霞柱与玄弥的战后剧情', flag:'game.swordsmithVillageDone', hint:'完成游郭后，刀匠村的委托会在庄园出现；可选择参战或保护后方伤员。', reward:{steel:40,leather:40,'cured meat':40}},
      {id:'pillars', title:'柱训练篇', goal:'参加柱合议，完成一位柱的训练', flag:'game.pillarConvocationDone', hint:'完成刀匠村并带回至少一张制造图纸后，回大厅迎接柱合议；训练需要口粮和火把。', reward:{medicine:10,'cured meat':60,fur:100}},
      {id:'castle', title:'通往决战之地', goal:'找到无限城入口并安全返回', feature:'spaceShip', reward:{'demon stone':2,medicine:5,'cured meat':15}}
    ];
  },
  milestone: function() {
    if (!$SM.get('game.prologue.done')) return null;
    if ($SM.get('game.builder.level',true) < 4 && !$SM.get('features.location.path')) return null;
    var claims = $SM.get('game.campaignClaims') || {};
    var task = EarlyGame.milestones().find(function(m) {return !claims[m.id];});
    if (!task) return null;
    task.ready = task.feature ? !!$SM.get('features.location.' + task.feature) : task.flag ? !!$SM.get(task.flag) :
      task.landmark ? EarlyGame.worldChapterCleared(task.landmark) : $SM.get('game.buildings[' + JSON.stringify(task.building) + ']',true) > 0;
    if (task.population) task.ready = task.ready && $SM.get('game.population',true) > 0;
    // World exploration proves the opening milestones were passed, even after lost buildings.
    if (['cart','shelter','traps','hunters','trade'].indexOf(task.id) >= 0 && $SM.get('features.location.path')) task.ready = true;
    return task;
  },
  worldChapterCleared: function(tile) {
    return ($SM.get('game.world.map') || []).some(function(row) {
      return Array.isArray(row) && row.some(function(cell) { return cell === tile + '!'; });
    });
  },
  trainReady: function() {
    return $SM.get('game.buildings["iron mine"]',true) > 0 && $SM.get('game.buildings["coal mine"]',true) > 0
      && $SM.get('game.buildings.steelworks',true) > 0 && EarlyGame.worldChapterCleared('M');
  },
  storyPrerequisite: function(id) {
    // Already unlocked castle saves retain their original event availability.
    if ($SM.get('game.campaignLegacyCastle') || (!$SM.get('game.campaignVersion') && $SM.get('features.location.spaceShip'))) return true;
    if (id === 'district') return !!$SM.get('game.world.mugentrain');
    if (id === 'smiths') return !!$SM.get('game.yoshiwaraDone');
    if (id === 'pillars') return !!$SM.get('game.swordsmithVillageDone');
    return false;
  },
  migrateCampaign: function() {
    if ($SM.get('game.campaignVersion') === 2) return false;
    $SM.set('game.campaignLegacyCastle',!!$SM.get('features.location.spaceShip'),true);
    $SM.set('game.campaignVersion',2,true);
    return true;
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
    EarlyGame.migrateCampaign();
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
      coal:'煤矿工提供炼钢燃料；下一步把铁矿和煤炭接进炼钢链。',
      steel:'炼钢场开启钢材生产，能打造日轮刀、钢制护甲与更强的携行装备。',
      natagumo:'蜘蛛山的经历让你学会善用口粮与恢复；下一次任务是无限列车支援。',
      train:'乘客获救，炎柱的嘱托留了下来；继续完善庄园供给，为上弦级的任务做准备。',
      sulphur:'硫磺矿工提供军械原料，接下来建设军械库补齐弹药。',
      armoury:'军械工能持续制造藤花弹；远征不再只能依靠偶然拾取弹药。',
      wreck:'日轮锻造已经开放；继续探索残骸车厢寻找图纸，制作呼吸流派装备。',
      district:'游郭救援告一段落；下一步帮助刀匠村保护锻造与补给。',
      smiths:'刀匠与队士的经验为决战铺路；带回图纸后准备参加柱训练。',
      pillars:'柱训练已完成；最后确认护甲、武器和治疗配置，再前往无限城。',
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
        $('<p>').addClass('campaignHint').appendTo(box);
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
      box.find('.campaignGoal').toggle(!!milestone).text(milestone ? '阶段主线 ' + stage + '/' + EarlyGame.milestones().length + ' · ' + milestone.title + '：' + milestone.goal : '');
      box.find('.campaignBenefit').toggle(!!milestone).text(milestone ? '完成后：' + EarlyGame.benefit(milestone.id) : '');
      box.find('.campaignHint').toggle(!!(milestone && milestone.hint)).text(milestone && milestone.hint ? '行动提示：' + milestone.hint : '');
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
