/** Player-facing, offline update history. Add future batches here and in CHANGELOG.md. Reading never changes a save. */
var UpdateNotes = window.UpdateNotes = {
  categories: ['全部', '玩法', '资源', '界面', '修复'],
  entries: [
    {
      id: '2026-10-02-planning', date: '2026-10-02', title: '采购预算与配置目标编辑',
      items: [
        ['界面', '批量购买预算预览', '按住 Shift 购买，先查看当前库存、最多可买数量及每种材料的总花费和购买后剩余；默认选 1 件，修改数量实时更新。'],
        ['修复', '采购确认不再猜数量', '空值、小数、负数及超过当前可买数量的输入不执行；库存变化后重新检查，取消或 Escape 不扣费，过期确认不会重复购买。'],
        ['界面', '直接编辑配置目标', '远征和无限城配置可以直接修改目标数量，已发现但库存为 0 的物品也能规划；不必先装满背包再保存，0 表示不主动补齐。'],
        ['界面', '规划与实际装包分开', '显示目标重量、当前预计可补齐量和库存／空间缺口；保存只更新目标，不购买、不装包、不换装备，超过容量的目标仍受实际补齐规则限制。']
      ]
    },
    {
      id: '2026-10-02-notices', date: '2026-10-02', title: '更新公告、生产诊断与回收预览',
      items: [
        ['界面', '菜单更新公告', '新增游戏内公告入口，按开发批次整理近期更新；可按玩法、资源、界面、修复筛选，历史内容可展开或收起。'],
        ['界面', '生产情况分层展示', '优先查看缺料、保留库存停工和持续供需缺口，各工种的整组配方可折叠；刷新保留展开状态。'],
        ['界面', '批量回收收益预览', '按住 Shift 点击回收，可先查看仓库数量、背包保护数量及本次返还材料；修改数量实时更新收益。'],
        ['修复', '回收确认更安全', '非法数量和超过当前可回收库存的操作不会扣除物品；取消或按 Escape 退出不消耗资源。']
      ]
    },
    {
      id: '2026-10-02-equipment', date: '2026-10-02', title: '制造与装备更直观',
      items: [
        ['界面', '制作前查看武器品级', '制造按钮直接显示品级颜色、基础伤害与攻击间隔；悬停可查看弹药消耗，伤害武器按基础伤害由高到低排列，控制武器单独标注。'],
        ['界面', '制造材料现有／所需', '缺少材料时显示缺口并暂时禁用制造；仓库补足后自动恢复，不必重新进入页面。'],
        ['界面', '装备就绪检查', '区分已选装备、已装入背包和可实际使用的武器，提示未装包或缺弹药，并显示背包弹药可用次数。'],
        ['界面', '永久升级完成后退场', '已完成的水容量、背包容量、护甲、永久建筑和锻造升级不再占据制造列表；可重复制作的武器仍保留。'],
        ['修复', '日轮刀回收入口', '回收按钮随仓库和装包数量更新，卸下后立即出现；只回收背包之外的库存，保护正在携带的部分。'],
        ['修复', '夜间模式切换', '清理遗留的页面背景颜色，切换主题时制造和整备界面保持清晰。']
      ]
    },
    {
      id: '2026-10-02-campaign', date: '2026-10-02', title: '矿业、剧情阶段与资源配方',
      items: [
        ['玩法', '主线扩展为 20 个阶段', '铁矿后补齐煤矿、炼钢、硫磺矿、军械补给、蜘蛛山、无限列车、游郭、刀匠村、柱训练等准备阶段，再衔接无限城；完成阶段可手动领取一次性推进奖励，旧存档已开放的无限城入口保留。'],
        ['玩法', '可游玩的无限列车支援', '地图 T 站台新增救援与魇梦分身战斗，区别于原有 X 列车残骸；完成剧情后安全返回庄园才保存章节进展。'],
        ['资源', '毛皮兑换降价', '交易中毛皮成本降至原来的十分之一，例如鳞片 150 → 15、牙齿 300 → 30；其他材料成本按当前配方执行。'],
        ['资源', '熏肉配方调整', '2 个肉 + 5 块木头制作 1 个熏肉，手工制作与工人生产使用一致配方。'],
        ['界面', '材料获取途径重排', '按鳞片、牙齿、布料切换，分别列出野外、庄园和无限城来源；已知地形、距离和掉落信息突出显示。'],
        ['界面', '远征回顾更易读', '修复夜间白底，按结果、探索进展、物资变化、下次准备分区，重点数值加粗。'],
        ['界面', '战后离开置底', '治疗、拾取和丢弃操作在上，离开按钮固定作为战后最后一组操作；丢弃列表显示背包数量、将丢数量和剩余量。']
      ]
    },
    {
      id: '2026-10-01-opening', date: '2026-10-01', title: '前期成长与首次远征引导',
      items: [
        ['资源', '前期建设更快', '首间小屋和猎屋、交易站、熏肉房、工坊的木材门槛降低；后续住所递增成本与剧情条件仍保留。'],
        ['玩法', '阶段主线与奖励', '从推车、住所、陷阱和狩猎逐步引导到交易、罗盘、生产与探索；一次只显示当前任务，奖励需手动领取且不会重复发放。'],
        ['玩法', '开局主动照料', '林地开放且大厅温暖后，可消耗木材推进蝴蝶忍恢复；前期升温等待缩短，仍保留序章、来客和温度条件。'],
        ['资源', '首次陷阱保底', '新开局第一次有效查陷阱保证获得可用的毛皮和肉；这是一次性保底，旧存档不重复补发。'],
        ['资源', '猎屋阶段一次性补给', '符合条件时可选择优先探路或优先扩建补给，不自动建设、装包或解锁地图。'],
        ['界面', '手动安排初期猎人', '猎屋无人生产时提供安排入口，从空闲人员中安排少量猎人并保留采木人手，不覆盖已有分工。'],
        ['界面', '首次远征准备清单', '按实际库存、背包、武器、弹药和容量检查准备情况；可用现有库存建立近郊配置并补齐，已有配置不会被覆盖。'],
        ['修复', '领奖与出发复核', '领奖标记随奖励保存，防止重复领取；出发前复核库存、数量和承重，失败不部分扣费，重复出发不会重复消耗。']
      ]
    },
    {
      id: '2026-10-01-expedition', date: '2026-10-01', title: '远征归途、途中疗伤与完成报告',
      items: [
        ['界面', '归途补给提醒', '显示庄园方向、最短返程步数与熏肉／水需求估算，考虑当前消耗周期和相关能力；不自动寻路或撤退，也不保证路线安全。'],
        ['玩法', '地图主动疗伤', '使用背包中的熏肉、药剂或藤花精油治疗，显示实际可恢复生命和 1／2／3 快捷键；满血不消耗，事件、战斗和死亡期间不可从地图治疗。'],
        ['界面', '已结束远征可回顾', '记录步数、最远距离、地图进展、解锁和背包净变化；断粮、断水、战斗失败分别给出下次准备建议。'],
        ['修复', '结算符合真实归还规则', '死亡不保存本次地图变化，但剩余背包按原规则归还；防止重复返还，并明确净变化不是总掉落或总消耗。'],
        ['修复', '空口粮与治疗边界', '修正空口粮变成非法数量、绕过饥饿，以及过期治疗重复扣费的问题；治疗不重置赶路耗粮耗水周期，最后一份口粮仍可正常解除饥饿。'],
        ['修复', '危险范围判断', '修正铁甲玩家在相应安全范围内仍显示危险的判断；保留原有野外怪物数值与遭遇规则。']
      ]
    },
    {
      id: '2026-10-01-logistics', date: '2026-10-01', title: '生产储备、材料账本与战利品配置',
      items: [
        ['玩法', '生产保留库存', '可设置自动生产原料的保留量；不足以完成整组配方并保留目标时，本轮不扣原料也不产出。默认 0，手工制作、交易和出征不受此保护。'],
        ['界面', '无限城材料账本', '完成战报分别记录鳞片、牙齿、布料的掉落、购买、送回、归还和净收支，不混入庄园生产。'],
        ['界面', '已知材料定向获取', '备战页可查询已发现材料与已遭遇敌人的获取信息；无限城路线显示已知材料的基础掉落范围和概率。'],
        ['玩法', '普通战按配置收取', '无限城普通战可从本场剩余战利品补齐已保存配置，受背包容量限制；其余送回仓库，不调用家中库存或自动更换装备。'],
        ['界面', '天赋收益预览', '选择前展示生命、伤害／冷却或对应加成以及下次入城继承变化；吸血达到上限时说明没有即时提升。'],
        ['修复', '防止战利品重复入库', '手动拾取只进入背包，归还时再入库；重复宝箱、收取和过期回调不会再发奖励。']
      ]
    },
    {
      id: '2026-09-12-14-midgame', date: '2026-09-12 ～ 09-14', title: '前中期供需与中后期资源平衡',
      items: [
        ['资源', '鳞片供应补齐', '无限城普通战保底鳞片，精英和 Boss 保底鳞片、牙齿、布料，宝箱追加鳞片；按十层阶梯增长并封顶。'],
        ['资源', '野外与交易补充', '提高中远距离相关鬼类的鳞片收益，降低多种药剂、弹药和后期物品的交易消耗；近郊敌人和罗盘门槛保持原规则。'],
        ['界面', '配置补齐预览', '实时显示已装数量、目标和预计补齐结果，区分库存不足与空间不足；保留额外物资，不自动换装。'],
        ['界面', '武器换装对比', '换装前对比基础伤害、攻击间隔、重量和同类共享冷却；控制武器及弹药需求单独说明。'],
        ['界面', '生产供需诊断', '按实际分工展示整组配方、缺料原因和每分钟计划供需差额，帮助判断上游是否不足；计划产量不等于实际产量。'],
        ['玩法', '开局采木与安置提速', '初期采木和首批幸存者到来更稳定，当前事务可收起；旧存档已完成进度不重置。'],
        ['修复', '手动装备优先', '首次手动选装不会被自动配装覆盖；出征确认反复检查，避免库存扣负或重复收费。']
      ]
    },
    {
      id: '2026-09-07-11-castle', date: '2026-09-07 ～ 09-11', title: '无限城成长、流派与实战收尾',
      items: [
        ['玩法', '人物成长与敌人成长重平衡', '提高天赋成长收益，放缓后期普通怪和 Boss 的伤害增长，保留旧天赋与永久传承进度。'],
        ['玩法', '不同呼吸流派改变打法', '技巧、水、炎、雷提供控制衔接、防御／治疗、持续伤害与蓄力爆发等差异，不再只是相同的数值加成。'],
        ['界面', '补齐我的配置', '分别保存远征和无限城目标配置，使用库存补足短缺，尊重背包容量，不清空多带物资或自动换装。'],
        ['界面', '失败也有信息的战报', '结束后展示伤害来源、治疗和物资消耗、天赋及永久成长；战报只供回顾，不能恢复已结束探索。'],
        ['玩法', '血鬼术倒计时与打断', '固定位置显示敌方蓄力预警，控制命中可打断正在蓄力的血鬼术；护盾完全挡住伤害时不会附加流血。'],
        ['修复', '攻击与治疗热键', '修复战斗和整顿栏按键无响应，松键后可再次触发；按住键不重复消耗，输入框和弹窗不会误用背后补给。'],
        ['修复', '每十层补给与天赋结算', '修复重复采购、Boss 补给后天赋选择、围剿奖励及部分强化效果，补给实际使用家中资源。'],
        ['修复', '战斗结算时序', '修复第二瓶药水失效、部分回血漏记、致命伤恢复和旧攻击动画重复结算；统一战内外治疗规则。']
      ]
    },
    {
      id: '2026-07-27-08-14-foundation', date: '2026-07-27 ～ 08-14', title: '键盘战斗、传承与锻刀场',
      items: [
        ['玩法', '键盘攻击和治疗', 'Q／W／E／R／T／Y 对应攻击，1～6 对应治疗／整顿；按钮显示实际快捷键，冷却、禁用和未持有物品不能触发。'],
        ['玩法', '永久成长与减伤', '修复减伤天赋没有应用的问题，增强累计楼层、探索与治疗传承；敌人与人物成长后续又进行了调整，以当前效果为准。'],
        ['玩法', '日轮锻刀场与列车残骸', '补充后期锻造路线和原有坠毁列车探索内容；本轮新 T 站台剧情与旧 X 残骸独立。'],
        ['界面', '批量购买', '按住 Shift 购买可选择数量，方便整备弹药和补给；确认时仍按实际库存与配方扣费。']
      ]
    },
    {
      id: '2026-07-06-07-equipment', date: '2026-07-06 ～ 07-07', title: '装备栏与常驻回收',
      items: [
        ['界面', '独立装备栏', '显示护甲、负重、水容量以及双手、副手、道具槽，已持有武器可按槽选择；装备与供应分栏展示。'],
        ['玩法', '常驻回收系统', '有制作或交易成本的可回收物品按材料成本的 30% 返还并取整，回收结果显示具体材料；只允许回收未选入背包的库存。'],
        ['界面', '弹药与品级显示', '武器下方列出弹药子行，装备选项使用品级颜色；辎重相关名称与鬼灭背景统一。'],
        ['修复', '中文与装备同步', '补全中文装备和回收文字；修复回收按钮遮挡、最后一件物品回收后的刷新和无效装备引用。']
      ]
    }
  ],
  filteredEntries: function(category) {
    return UpdateNotes.entries.map(function(entry) {
      return {id: entry.id, date: entry.date, title: entry.title,
        items: entry.items.filter(function(item) { return category === '全部' || item[0] === category; })};
    }).filter(function(entry) { return entry.items.length > 0; });
  },
  canShow: function() {
    if (!window.Engine || !window.Events || Events.activeEvent()) return false;
    if (![window.Room, window.Outside, window.Path, window.Ship, window.Fabricator].some(function(module) {
      return module && Engine.activeModule === module;
    })) return false;
    return !document.getElementById('scrapQuantityOverlay') && !document.getElementById('buyQuantityOverlay') && !document.getElementById('loadoutEditorOverlay');
  },
  show: function() {
    if (!UpdateNotes.canShow()) return false;
    Events.startEvent({title: '更新公告', scenes: {start: {text: [], buttons: {
      closeUpdateNotes: {text: '关闭公告', nextScene: 'end', onEnd: function() { $('#updateNotesButton').trigger('focus'); }}
    }}}}, {width: '580px'});
    var panel = Events.eventPanel().addClass('updateNotes').attr({role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'updateNotesTitle'});
    panel.children('.eventTitle').attr('id', 'updateNotesTitle');
    var desc = panel.find('#description').empty();
    $('<p>').addClass('updateNotesIntro').text('近期更新按开发批次整理，最新在前，重点加粗。历史公告保留当时的改动，后续调整以较新公告和当前配方为准。').appendTo(desc);
    var tools = $('<div>').addClass('updateNotesTools').appendTo(desc);
    $('<label>').attr('for', 'updateNotesCategory').text('查看：').appendTo(tools);
    var select = $('<select>').attr('id', 'updateNotesCategory').appendTo(tools);
    UpdateNotes.categories.forEach(function(category) { $('<option>').val(category).text(category).appendTo(select); });
    $('<button>').attr({type: 'button', id: 'expandUpdateNotes'}).text('展开全部').on('click', function() {
      panel.find('.updateNotesEntry').prop('open', true);
    }).appendTo(tools);
    $('<button>').attr({type: 'button', id: 'collapseUpdateNotes'}).text('收起历史').on('click', function() {
      panel.find('.updateNotesEntry').prop('open', false).first().prop('open', true);
      panel.find('#updateNotesBody').scrollTop(0);
    }).appendTo(tools);
    var body = $('<div>').attr('id', 'updateNotesBody').appendTo(desc);
    var render = function() {
      body.empty().scrollTop(0);
      UpdateNotes.filteredEntries(select.val()).forEach(function(entry, index) {
        var card = $('<details>').addClass('updateNotesEntry').attr('data-update', entry.id).prop('open', index === 0).appendTo(body);
        var heading = $('<summary>').text(entry.title).appendTo(card);
        $('<time>').text(entry.date).appendTo(heading);
        var list = $('<ul>').appendTo(card);
        entry.items.forEach(function(item) {
          var row = $('<li>').appendTo(list);
          $('<strong>').text(item[1] + '：').appendTo(row);
          $('<span>').text(item[2]).appendTo(row);
        });
      });
    };
    select.on('change', render);
    render();
    var close = panel.find('#closeUpdateNotes').attr({role: 'button', tabindex: 0}).on('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(this).trigger('click'); }
    });
    panel.on('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); Events.endEvent(function() { $('#updateNotesButton').trigger('focus'); }); }
      if (e.key !== 'Tab') return;
      var stops = panel.find('button, select, summary, [tabindex="0"]').filter(':visible').get();
      var first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    close.trigger('focus');
    return true;
  }
};
